import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { copyFile, link, lstat, mkdir, open, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { StudioError, invariant } from '../../../domain/src/errors.js';
import { inspectImageHeader, verifyImageBytes, verifyImageFile } from './image-metadata.js';
import { maintenanceBarrierForRoot } from './root-maintenance-barrier.js';

const DIGEST_PATTERN = /^[a-f0-9]{64}$/;

function assertEffectFence(signal) {
  if (signal !== undefined) AbortSignal.prototype.throwIfAborted.call(signal);
}

async function syncDirectory(path) {
  let handle;
  try {
    handle = await open(path, 'r');
    await handle.sync();
  } catch (error) {
    if (process.platform !== 'win32' || !['EINVAL', 'ENOTSUP', 'EISDIR', 'EPERM'].includes(error.code)) throw error;
  } finally {
    await handle?.close();
  }
}

function iterableFor(input) {
  if (Buffer.isBuffer(input) || input instanceof Uint8Array) return [Buffer.from(input)];
  invariant(input && input[Symbol.asyncIterator], 'VALIDATION_ERROR', 'Artifact input must be bytes or an async iterable.');
  return input;
}

export class ContentAddressedArtifactStore {
  #root;
  #staging;
  #live;
  #quarantine;
  #limits;
  #maintenanceBarrier;
  #maintenanceFaultInjector;

  constructor({
    rootDirectory,
    limits = {
      'image/png': { maxBytes: 128 * 1024 * 1024, maxWidth: 16384, maxHeight: 16384 },
      'image/webp': { maxBytes: 128 * 1024 * 1024, maxWidth: 16384, maxHeight: 16384 },
    },
    maintenanceFaultInjector = null,
  }) {
    invariant(typeof rootDirectory === 'string' && rootDirectory.length > 0, 'VALIDATION_ERROR', 'CAS rootDirectory is required.');
    invariant(
      maintenanceFaultInjector === null || typeof maintenanceFaultInjector === 'function',
      'VALIDATION_ERROR',
      'CAS maintenanceFaultInjector must be a function when supplied.',
    );
    this.#root = resolve(rootDirectory);
    this.#staging = join(this.#root, 'staging');
    this.#live = join(this.#root, 'sha256');
    this.#quarantine = join(this.#root, 'quarantine');
    this.#limits = structuredClone(limits);
    this.#maintenanceBarrier = maintenanceBarrierForRoot(this.#root);
    this.#maintenanceFaultInjector = maintenanceFaultInjector;
  }

  get rootDirectory() { return this.#root; }

  async withSharedMaintenancePermit(operation) {
    invariant(typeof operation === 'function', 'VALIDATION_ERROR', 'Shared CAS maintenance permit requires an operation callback.');
    return this.#maintenanceBarrier.withShared(operation);
  }

  async initialize({ signal } = {}) {
    for (const directory of [this.#staging, this.#live, this.#quarantine]) {
      assertEffectFence(signal);
      await mkdir(directory, { recursive: true, mode: 0o700 });
    }
  }

  #assertDigest(digest) {
    invariant(DIGEST_PATTERN.test(digest), 'ARTIFACT_INVALID_DIGEST', 'Artifact digest must be lowercase SHA-256 hex.', { digest });
  }

  #path(digest) {
    this.#assertDigest(digest);
    return join(this.#live, digest.slice(0, 2), digest.slice(2, 4), digest);
  }

  async ingest(input, { mediaType, expectedDigest = null, limits = null } = {}) {
    await this.initialize();
    const configuredLimit = this.#limits[mediaType];
    invariant(configuredLimit, 'ARTIFACT_UNSUPPORTED_MEDIA', `Unsupported artifact media type: ${mediaType}.`, { mediaType });
    const limit = limits === null ? configuredLimit : {
      maxBytes: Math.min(configuredLimit.maxBytes, limits.maxBytes),
      maxWidth: Math.min(configuredLimit.maxWidth, limits.maxWidth),
      maxHeight: Math.min(configuredLimit.maxHeight, limits.maxHeight),
    };
    invariant(
      Number.isInteger(limit.maxBytes) && limit.maxBytes > 0
        && Number.isInteger(limit.maxWidth) && limit.maxWidth > 0
        && Number.isInteger(limit.maxHeight) && limit.maxHeight > 0,
      'VALIDATION_ERROR',
      'Artifact intake limits must be positive integers.',
    );
    if (expectedDigest !== null) this.#assertDigest(expectedDigest);

    const stagingPath = join(this.#staging, `${randomUUID()}.part`);
    const handle = await open(stagingPath, 'wx', 0o600);
    const hash = createHash('sha256');
    const headerParts = [];
    let headerBytes = 0;
    let byteSize = 0;
    let position = 0;
    try {
      for await (const rawChunk of iterableFor(input)) {
        const chunk = Buffer.from(rawChunk);
        byteSize += chunk.length;
        invariant(byteSize <= limit.maxBytes, 'ARTIFACT_TOO_LARGE', 'Artifact exceeds its media byte limit.', {
          mediaType,
          maxBytes: limit.maxBytes,
        });
        hash.update(chunk);
        if (headerBytes < 64) {
          const part = chunk.subarray(0, Math.min(chunk.length, 64 - headerBytes));
          headerParts.push(part);
          headerBytes += part.length;
        }
        let offset = 0;
        while (offset < chunk.length) {
          const { bytesWritten } = await handle.write(chunk, offset, chunk.length - offset, position);
          invariant(bytesWritten > 0, 'ARTIFACT_WRITE_FAILED', 'Artifact staging write made no progress.');
          offset += bytesWritten;
          position += bytesWritten;
        }
      }
      const dimensions = inspectImageHeader(Buffer.concat(headerParts), mediaType);
      invariant(
        dimensions.width <= limit.maxWidth && dimensions.height <= limit.maxHeight,
        'ARTIFACT_DIMENSIONS_EXCEEDED',
        'Artifact exceeds its image dimension limit.',
        { ...dimensions, maxWidth: limit.maxWidth, maxHeight: limit.maxHeight },
      );
      await handle.sync();
      await handle.close();
      await verifyImageFile(stagingPath, mediaType);

      const digest = hash.digest('hex');
      invariant(!expectedDigest || expectedDigest === digest, 'ARTIFACT_DIGEST_MISMATCH', 'Artifact digest differs from expectedDigest.', {
        expectedDigest,
        actualDigest: digest,
      });
      const destination = this.#path(digest);
      await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
      let deduplicated = false;
      try {
        // link(2) is an atomic, no-clobber publication because staging and live
        // are deliberately on the same filesystem. rename(2) would replace an
        // object when two equal ingests race after both observing ENOENT.
        await link(stagingPath, destination);
        await syncDirectory(dirname(destination));
        await unlink(stagingPath);
        await syncDirectory(this.#staging);
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        const existing = await lstat(destination);
        invariant(existing.isFile() && !existing.isSymbolicLink(), 'ARTIFACT_CORRUPT', 'Existing CAS object is not a regular file.', { digest });
        const verification = await this.verify(digest);
        invariant(verification.byteSize === byteSize, 'ARTIFACT_CORRUPT', 'Existing CAS object size differs.', { digest });
        await unlink(stagingPath);
        deduplicated = true;
      }
      return {
        schemaVersion: 1,
        digest,
        uri: `studio://artifacts/sha256/${digest}`,
        mediaType,
        byteSize,
        ...dimensions,
        deduplicated,
      };
    } catch (error) {
      try { await handle.close(); } catch {}
      await unlink(stagingPath).catch(() => {});
      throw error;
    }
  }

  async verify(digest) {
    const path = this.#path(digest);
    const info = await lstat(path).catch((error) => {
      if (error.code === 'ENOENT') throw new StudioError('ARTIFACT_MISSING', 'CAS object is missing.', { digest });
      throw error;
    });
    invariant(info.isFile() && !info.isSymbolicLink(), 'ARTIFACT_CORRUPT', 'CAS object is not a regular file.', { digest });
    const hash = createHash('sha256');
    let byteSize = 0;
    for await (const chunk of createReadStream(path)) {
      hash.update(chunk);
      byteSize += chunk.length;
    }
    const actualDigest = hash.digest('hex');
    invariant(actualDigest === digest, 'ARTIFACT_CORRUPT', 'CAS object no longer matches its digest.', {
      digest,
      actualDigest,
    });
    return { digest, byteSize, path };
  }

  /**
   * Keeps the no-follow file handle and the exact verified byte image private
   * until operation completes. Callers receive descriptor evidence only; no
   * filesystem path, handle, or mutable byte buffer crosses this boundary.
   */
  async #withVerifiedPngBytes(digest, operation) {
    this.#assertDigest(digest);
    invariant(typeof operation === 'function', 'VALIDATION_ERROR', 'Verified PNG evidence requires an operation callback.');
    const path = this.#path(digest);
    let pathInfo;
    try {
      pathInfo = await lstat(path);
    } catch (error) {
      if (error.code === 'ENOENT') throw new StudioError('ARTIFACT_MISSING', 'CAS object is missing.', { digest });
      throw error;
    }
    invariant(
      pathInfo.isFile() && !pathInfo.isSymbolicLink(),
      'ARTIFACT_CORRUPT',
      'CAS object is not a regular no-follow file.',
      { digest },
    );
    let handle;
    try {
      handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    } catch (error) {
      if (error.code === 'ENOENT') throw new StudioError('ARTIFACT_MISSING', 'CAS object is missing.', { digest });
      if (['ELOOP', 'EMLINK'].includes(error.code)) {
        throw new StudioError('ARTIFACT_CORRUPT', 'CAS object must not be a symbolic link.', { digest });
      }
      throw error;
    }
    try {
      const info = await handle.stat();
      invariant(
        info.isFile() && info.dev === pathInfo.dev && info.ino === pathInfo.ino,
        'ARTIFACT_CORRUPT',
        'CAS object changed while its no-follow handle was acquired.',
        { digest },
      );
      const bytes = await handle.readFile();
      let currentPathInfo;
      try {
        currentPathInfo = await lstat(path);
      } catch (error) {
        if (error.code === 'ENOENT') throw new StudioError('ARTIFACT_MISSING', 'CAS object disappeared during verification.', { digest });
        throw error;
      }
      invariant(
        currentPathInfo.isFile()
          && !currentPathInfo.isSymbolicLink()
          && currentPathInfo.dev === info.dev
          && currentPathInfo.ino === info.ino,
        'ARTIFACT_CORRUPT',
        'CAS object changed during no-follow verification.',
        { digest },
      );
      const actualDigest = createHash('sha256').update(bytes).digest('hex');
      invariant(actualDigest === digest, 'ARTIFACT_CORRUPT', 'CAS object no longer matches its digest.', {
        digest,
        actualDigest,
      });
      verifyImageBytes(bytes, 'image/png');
      const dimensions = inspectImageHeader(bytes.subarray(0, 64), 'image/png');
      const evidence = Object.freeze({
        sha256: digest,
        mediaType: 'image/png',
        byteSize: bytes.length,
        width: dimensions.width,
        height: dimensions.height,
      });
      return await operation(evidence, bytes);
    } finally {
      await handle.close();
    }
  }

  async withVerifiedPngEvidence(digest, operation) {
    this.#assertDigest(digest);
    invariant(typeof operation === 'function', 'VALIDATION_ERROR', 'Verified PNG evidence requires an operation callback.');
    return this.#withVerifiedPngBytes(digest, (evidence) => operation(evidence));
  }

  /**
   * Streams the exact byte image already read and verified through the held
   * no-follow handle. No filesystem path, handle, or mutable CAS buffer crosses
   * the callback boundary, and the callback must finish before verification
   * scope closes.
   */
  async withVerifiedPngReadable(digest, operation) {
    this.#assertDigest(digest);
    invariant(typeof operation === 'function', 'VALIDATION_ERROR', 'Verified PNG streaming requires an operation callback.');
    return this.#withVerifiedPngBytes(digest, (evidence, bytes) => operation(Object.freeze({
      evidence,
      readable: Readable.from([bytes]),
    })));
  }

  async createReadStream(digest) {
    const verified = await this.verify(digest);
    return createReadStream(verified.path);
  }

  async listLiveDigests() {
    await this.initialize();
    const digests = [];
    for (const first of await readdir(this.#live, { withFileTypes: true })) {
      if (!first.isDirectory() || !/^[a-f0-9]{2}$/.test(first.name)) continue;
      for (const second of await readdir(join(this.#live, first.name), { withFileTypes: true })) {
        if (!second.isDirectory() || !/^[a-f0-9]{2}$/.test(second.name)) continue;
        for (const entry of await readdir(join(this.#live, first.name, second.name), { withFileTypes: true })) {
          if (entry.isFile() && DIGEST_PATTERN.test(entry.name)) digests.push(entry.name);
        }
      }
    }
    return digests.sort();
  }

  #maintenanceFault(point) {
    this.#maintenanceFaultInjector?.(point);
  }

  async #markUnreferenced({ referencedDigests, now, retentionMs }) {
    const marked = [];
    for (const digest of await this.listLiveDigests()) {
      if (referencedDigests.has(digest)) continue;
      const source = this.#path(digest);
      const info = await stat(source);
      if (now.getTime() - info.mtimeMs < retentionMs) continue;
      const target = join(this.#quarantine, `${digest}.${now.getTime()}`);
      await rename(source, target);
      await syncDirectory(dirname(source));
      this.#maintenanceFault('after_cas_gc_mark_source_leaf_sync');
      await syncDirectory(this.#quarantine);
      this.#maintenanceFault('after_cas_gc_mark_quarantine_sync');
      marked.push({ digest, path: target, markedAt: now.toISOString() });
    }
    return marked;
  }

  async #sweepQuarantine({ referencedDigests, now, retentionMs }) {
    await this.initialize();
    const removed = [];
    for (const entry of await readdir(this.#quarantine, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const [digest, timestamp] = entry.name.split('.');
      if (!DIGEST_PATTERN.test(digest) || !/^\d+$/.test(timestamp)) continue;
      if (referencedDigests.has(digest)) continue;
      if (now.getTime() - Number(timestamp) < retentionMs) continue;
      await unlink(join(this.#quarantine, entry.name));
      await syncDirectory(this.#quarantine);
      this.#maintenanceFault('after_cas_gc_sweep_unlink_parent_sync');
      removed.push(digest);
    }
    return removed.sort();
  }

  async collectGarbage({
    readReferencedDigests,
    now = new Date(),
    markRetentionMs,
    sweepRetentionMs,
  }) {
    invariant(typeof readReferencedDigests === 'function', 'VALIDATION_ERROR', 'CAS garbage collection requires a fresh reference reader.');
    invariant(now instanceof Date && Number.isFinite(now.getTime()), 'VALIDATION_ERROR', 'CAS garbage collection now must be a valid Date.');
    invariant(Number.isFinite(markRetentionMs) && markRetentionMs >= 0, 'VALIDATION_ERROR', 'markRetentionMs must be non-negative.');
    invariant(Number.isFinite(sweepRetentionMs) && sweepRetentionMs >= 0, 'VALIDATION_ERROR', 'sweepRetentionMs must be non-negative.');
    const maintenanceNow = new Date(now.getTime());
    return this.#maintenanceBarrier.withExclusive(async () => {
      const freshReferences = await readReferencedDigests();
      invariant(freshReferences instanceof Set, 'VALIDATION_ERROR', 'Fresh CAS references must be returned as a Set.');
      const referencedDigests = new Set(freshReferences);
      for (const digest of referencedDigests) this.#assertDigest(digest);
      const marked = await this.#markUnreferenced({
        referencedDigests,
        now: maintenanceNow,
        retentionMs: markRetentionMs,
      });
      const swept = await this.#sweepQuarantine({
        referencedDigests,
        now: maintenanceNow,
        retentionMs: sweepRetentionMs,
      });
      return {
        referencedCount: referencedDigests.size,
        marked,
        swept,
      };
    });
  }

  async createManifest(digests = null, { signal } = {}) {
    const selected = digests ?? await this.listLiveDigests();
    const entries = [];
    for (const digest of [...selected].sort()) {
      assertEffectFence(signal);
      const verified = await this.verify(digest);
      entries.push({ digest, byteSize: verified.byteSize });
    }
    return { schemaVersion: 1, algorithm: 'sha256', entries };
  }

  async backupTo(destinationRoot, digests = null, { signal } = {}) {
    const destination = new ContentAddressedArtifactStore({ rootDirectory: destinationRoot, limits: this.#limits });
    assertEffectFence(signal);
    await destination.initialize({ signal });
    const selected = digests ?? await this.listLiveDigests();
    for (const digest of selected) {
      assertEffectFence(signal);
      await this.verify(digest);
      const target = destination.#path(digest);
      assertEffectFence(signal);
      await mkdir(dirname(target), { recursive: true, mode: 0o700 });
      assertEffectFence(signal);
      try {
        await copyFile(this.#path(digest), target, constants.COPYFILE_EXCL);
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
      }
      await destination.verify(digest);
    }
    assertEffectFence(signal);
    const manifest = await destination.createManifest(new Set(selected), { signal });
    assertEffectFence(signal);
    await writeFile(join(resolve(destinationRoot), 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    return manifest;
  }
}
