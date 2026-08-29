import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, realpath, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { StudioError, invariant } from '../../../domain/src/errors.js';
import {
  RESTORED_COPY_QUARANTINE_MARKER,
  writeRestoredWorkspaceQuarantineMarker,
} from '../backup/workspace-backup.js';
import { isPathWithin } from './operations-config.js';
import { inspectWindowsFilesystem, publishWindowsFilesystem } from './windows-filesystem-proof.js';

const GENERATED_ID_PATTERN = /^[a-f0-9]{8}-[a-f0-9-]{8,55}$/;
const MAX_ROOT_ENTRIES = 10_000;
const QUARANTINE_MARKER = RESTORED_COPY_QUARANTINE_MARKER;

function assertEffectFence(signal) {
  if (signal !== undefined) AbortSignal.prototype.throwIfAborted.call(signal);
}

function safeFailure(code, message, details = undefined) {
  return new StudioError(code, message, details);
}

function identityKey(parts) {
  return createHash('sha256').update(parts.join('\0')).digest('hex');
}

function assertGeneratedId(value, label) {
  invariant(typeof value === 'string' && GENERATED_ID_PATTERN.test(value),
    'BACKUP_PATH_UNSAFE', `${label} is not a generated opaque identity.`);
}

async function inspectPortableRoot(path) {
  const coordinateInfo = await lstat(path);
  invariant(coordinateInfo.isDirectory() && !coordinateInfo.isSymbolicLink(),
    'BACKUP_PATH_UNSAFE', 'Operations root coordinate is unsafe.');
  const canonical = await realpath(path);
  const info = await lstat(canonical);
  invariant(info.isDirectory() && !info.isSymbolicLink(), 'BACKUP_PATH_UNSAFE', 'Operations root identity is unsafe.');
  return Object.freeze({
    rootKey: identityKey(['linux', String(info.dev), String(info.ino)]),
    filesystemKey: identityKey(['linux-device', String(info.dev)]),
    device: String(info.dev),
    inode: String(info.ino),
  });
}

async function inspectDirectory(path) {
  const info = await lstat(path).catch((error) => {
    if (error.code === 'ENOENT') {
      throw safeFailure(
        'BACKUP_CONTENT_MISMATCH',
        'Expected operation-owned directory is missing.',
        { healthEffect: 'MISSING' },
      );
    }
    throw error;
  });
  invariant(info.isDirectory() && !info.isSymbolicLink(),
    'BACKUP_PATH_UNSAFE', 'Operation-owned output must be a no-follow directory.');
  return Object.freeze({ device: String(info.dev), inode: String(info.ino) });
}

async function assertAbsent(path) {
  try {
    await lstat(path);
    throw safeFailure('BACKUP_DESTINATION_CONFLICT', 'Reserved operation output already exists.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function syncHandle(path, signal) {
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY);
    assertEffectFence(signal);
    await handle.sync();
  } catch (error) {
    if (signal?.aborted) throw signal.reason;
    throw safeFailure('BACKUP_DURABILITY_FAILED', 'Required filesystem durability proof failed.');
  } finally {
    await handle?.close().catch(() => {});
  }
}

async function syncTree(path, platform, signal) {
  assertEffectFence(signal);
  const info = await lstat(path);
  invariant(!info.isSymbolicLink(), 'BACKUP_PATH_UNSAFE', 'Operation output contains a symbolic link.');
  if (info.isFile()) {
    await syncHandle(path, signal);
    return;
  }
  invariant(info.isDirectory(), 'BACKUP_PATH_UNSAFE', 'Operation output contains an unsupported filesystem entry.');
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries) {
    invariant(!entry.isSymbolicLink() && (entry.isFile() || entry.isDirectory()),
      'BACKUP_PATH_UNSAFE', 'Operation output contains an unsupported filesystem entry.');
    await syncTree(join(path, entry.name), platform, signal);
  }
  if (platform !== 'win32') await syncHandle(path, signal);
}

function coordinate({ kind, root, operationId, outputId, destinationId = null }) {
  assertGeneratedId(operationId, 'operationId');
  assertGeneratedId(outputId, 'outputId');
  if (kind === 'CREATE') {
    return Object.freeze({
      kind,
      root,
      destinationId,
      operationId,
      outputId,
      stageBasename: `.numberdroid-backup-stage-${operationId}`,
      finalBasename: `backup-${outputId}`,
      stagePath: join(root.path, `.numberdroid-backup-stage-${operationId}`),
      finalPath: join(root.path, `backup-${outputId}`),
    });
  }
  if (kind === 'RESTORE_AS_COPY') {
    return Object.freeze({
      kind,
      root,
      destinationId,
      operationId,
      outputId,
      stageBasename: `.numberdroid-restore-stage-${operationId}`,
      finalBasename: `workspace-copy-${outputId}`,
      stagePath: join(root.path, `.numberdroid-restore-stage-${operationId}`),
      finalPath: join(root.path, `workspace-copy-${outputId}`),
    });
  }
  throw safeFailure('OPERATION_STATE_CONFLICT', 'Operation kind cannot allocate a published output.');
}

export class OperationsFilesystem {
  #configuration;
  #platform;
  #recoveryRoot;
  #roots;
  #spawnProcess;

  static async create({ configuration, platform = process.platform, spawnProcess }) {
    invariant(configuration?.schemaVersion === 1, 'OPERATIONS_UNAVAILABLE', 'Validated operations configuration is required.');
    invariant(typeof configuration.workspaceRoot === 'string'
        && typeof configuration.workspaceInspectionPath === 'string'
        && typeof configuration.controlRoot === 'string'
        && typeof configuration.controlInspectionPath === 'string'
        && configuration.backupDestinations?.every((entry) => typeof entry.inspectionPath === 'string')
        && configuration.restoreDestinations?.every((entry) => typeof entry.inspectionPath === 'string'),
    'OPERATIONS_UNAVAILABLE', 'Canonical and original operations root coordinates are required.');
    invariant(['linux', 'win32'].includes(platform), 'BACKUP_PATH_UNSAFE', 'Operations filesystem is unsupported on this platform.');
    const instance = new OperationsFilesystem({ configuration, platform, spawnProcess });
    await instance.#initialize();
    return instance;
  }

  constructor({ configuration, platform, spawnProcess }) {
    this.#configuration = configuration;
    this.#platform = platform;
    this.#spawnProcess = spawnProcess;
    this.#roots = new Map();
  }

  async #inspect(path, expected = null, { inspectDescendants = false, signal } = {}) {
    assertEffectFence(signal);
    if (this.#platform === 'win32') {
      const proof = await inspectWindowsFilesystem(path, {
        expectedIdentity: expected,
        inspectDescendants,
        spawnProcess: this.#spawnProcess,
        signal,
      });
      return Object.freeze({
        rootKey: identityKey(['win32', proof.volumeSerial, proof.fileId]),
        filesystemKey: identityKey(['win32-volume', proof.volumeSerial]),
        ...proof,
      });
    }
    return inspectPortableRoot(path);
  }

  async #initialize() {
    const configured = [
      {
        registry: 'workspace',
        destinationId: null,
        label: null,
        path: this.#configuration.workspaceRoot,
        inspectionPath: this.#configuration.workspaceInspectionPath,
      },
      {
        registry: 'control',
        destinationId: null,
        label: null,
        path: this.#configuration.controlRoot,
        inspectionPath: this.#configuration.controlInspectionPath,
      },
      ...this.#configuration.backupDestinations.map((entry) => ({
        registry: 'backup', path: entry.root, ...entry,
      })),
      ...this.#configuration.restoreDestinations.map((entry) => ({
        registry: 'restore', path: entry.root, ...entry,
      })),
    ];
    for (const item of configured) {
      const proof = await this.#inspect(item.inspectionPath);
      const key = item.registry === 'workspace'
        ? 'workspace'
        : item.registry === 'control' ? 'control' : item.destinationId;
      this.#roots.set(key, Object.freeze({ ...item, ...proof }));
    }
    const rootKeys = [...this.#roots.values()].map((entry) => entry.rootKey);
    invariant(new Set(rootKeys).size === rootKeys.length, 'BACKUP_PATH_UNSAFE', 'Configured roots must have distinct stable identities.');
    const control = this.#roots.get('control');
    const recoveryRoot = join(control.path, 'recovery-tests');
    try {
      await mkdir(recoveryRoot, { recursive: false, mode: 0o700 });
      if (this.#platform !== 'win32') await syncHandle(control.path);
    } catch (error) {
      if (error.code !== 'EEXIST') throw safeFailure('BACKUP_DURABILITY_FAILED', 'Recovery-test root could not be initialized durably.');
    }
    const recoveryInfo = await lstat(recoveryRoot);
    invariant(recoveryInfo.isDirectory() && !recoveryInfo.isSymbolicLink()
        && isPathWithin(control.path, recoveryRoot, this.#platform),
    'BACKUP_PATH_UNSAFE', 'Recovery-test root is unsafe.');
    const recoveryProof = await this.#inspect(recoveryRoot);
    invariant(!rootKeys.includes(recoveryProof.rootKey),
      'BACKUP_PATH_UNSAFE', 'Recovery-test root must have its own stable identity.');
    this.#recoveryRoot = Object.freeze({
      registry: 'recovery',
      destinationId: null,
      label: null,
      path: recoveryRoot,
      parentRootKey: control.rootKey,
      ...recoveryProof,
    });
  }

  controlPaths() {
    const control = this.#roots.get('control');
    return Object.freeze({
      rootKey: control.rootKey,
      database: join(control.path, 'operations.sqlite'),
      lock: join(control.path, 'operations.lock'),
      recoveryTests: this.#recoveryRoot.path,
    });
  }

  listDestinations(kind) {
    const registry = kind === 'CREATE' ? 'backup' : kind === 'RESTORE_AS_COPY' ? 'restore' : null;
    invariant(registry !== null, 'OPERATION_STATE_CONFLICT', 'Operation kind has no output destination registry.');
    return Object.freeze([...this.#roots.values()]
      .filter((entry) => entry.registry === registry)
      .map((entry) => Object.freeze({ destinationId: entry.destinationId, label: entry.label })));
  }

  async discoverOperationEntries() {
    const discoveries = [];
    const roots = [
      ...[...this.#roots.values()]
        .filter((entry) => entry.registry === 'backup' || entry.registry === 'restore')
        .map((entry) => ({ ...entry, scanPath: entry.path })),
      { ...this.#recoveryRoot, scanPath: this.#recoveryRoot.path },
    ];
    for (const root of roots) {
      if (root.registry === 'recovery') await this.#revalidateRecoveryRoot();
      else await this.#revalidate(root);
      const entries = await readdir(root.scanPath, { withFileTypes: true });
      invariant(entries.length <= MAX_ROOT_ENTRIES,
        'OPERATIONS_UNAVAILABLE', 'An operations root exceeds its fixed discovery bound.');
      for (const entry of entries) {
        let kind = null;
        let role = null;
        let opaqueId = null;
        if (root.registry === 'backup') {
          const stage = /^\.numberdroid-backup-stage-([a-f0-9]{8}-[a-f0-9-]{8,55})$/.exec(entry.name);
          const final = /^backup-([a-f0-9]{8}-[a-f0-9-]{8,55})$/.exec(entry.name);
          if (stage) {
            opaqueId = stage[1];
            kind = 'BACKUP';
            role = 'STAGE';
          } else if (final) {
            opaqueId = final[1];
            kind = 'BACKUP';
            role = 'FINAL';
          }
        } else if (root.registry === 'restore') {
          const stage = /^\.numberdroid-restore-stage-([a-f0-9]{8}-[a-f0-9-]{8,55})$/.exec(entry.name);
          const final = /^workspace-copy-([a-f0-9]{8}-[a-f0-9-]{8,55})$/.exec(entry.name);
          if (stage) {
            opaqueId = stage[1];
            kind = 'RESTORE_COPY';
            role = 'STAGE';
          } else if (final) {
            opaqueId = final[1];
            kind = 'RESTORE_COPY';
            role = 'FINAL';
          }
        } else {
          const stage = /^\.numberdroid-recovery-stage-([a-f0-9]{8}-[a-f0-9-]{8,55})$/.exec(entry.name);
          if (stage) {
            opaqueId = stage[1];
            kind = 'RECOVERY_TEST';
            role = 'STAGE';
          }
        }
        if (kind === null) continue;
        invariant(entry.isDirectory() && !entry.isSymbolicLink(),
          'BACKUP_PATH_UNSAFE', 'A service-named operation entry is not a no-follow directory.');
        const path = join(root.scanPath, entry.name);
        const identity = this.#platform === 'win32' ? await this.#inspect(path) : await inspectDirectory(path);
        discoveries.push(Object.freeze({
          kind,
          role,
          opaqueId,
          basename: entry.name,
          destinationId: root.destinationId ?? null,
          rootKey: kind === 'RECOVERY_TEST' ? 'control.recovery-tests' : root.destinationId,
          rootIdentitySha256: root.rootKey,
          filesystemIdentitySha256: root.filesystemKey,
          identity,
          path,
        }));
      }
    }
    return Object.freeze(discoveries);
  }

  destinationLabel(kind, destinationId) {
    return this.#destination(kind, destinationId).label;
  }

  #destination(kind, destinationId) {
    const expected = kind === 'CREATE' ? 'backup' : kind === 'RESTORE_AS_COPY' ? 'restore' : null;
    const root = this.#roots.get(destinationId);
    invariant(root && root.registry === expected, 'BACKUP_DESTINATION_UNKNOWN', 'Configured operation destination is unknown.');
    return root;
  }

  async #revalidate(root, { signal } = {}) {
    const current = await this.#inspect(root.inspectionPath ?? root.path, root, { signal });
    invariant(current.rootKey === root.rootKey, 'BACKUP_PATH_UNSAFE', 'Configured root identity changed.');
  }

  async #revalidateRecoveryRoot({ signal } = {}) {
    const control = this.#roots.get('control');
    await this.#revalidate(control, { signal });
    invariant(this.#recoveryRoot
        && this.#recoveryRoot.path === join(control.path, 'recovery-tests')
        && this.#recoveryRoot.parentRootKey === control.rootKey
        && isPathWithin(control.path, this.#recoveryRoot.path, this.#platform),
    'BACKUP_PATH_UNSAFE', 'Recovery-test root coordinate changed.');
    await this.#revalidate(this.#recoveryRoot, { signal });
  }

  async allocatePublished({ kind, destinationId, operationId, outputId }, { signal } = {}) {
    const root = this.#destination(kind, destinationId);
    await this.#revalidate(root, { signal });
    const allocated = coordinate({ kind, root, destinationId, operationId, outputId });
    invariant(isPathWithin(root.path, allocated.stagePath, this.#platform)
        && isPathWithin(root.path, allocated.finalPath, this.#platform),
    'BACKUP_PATH_UNSAFE', 'Generated operation coordinate escaped its configured root.');
    await assertAbsent(allocated.stagePath);
    await assertAbsent(allocated.finalPath);
    return allocated;
  }

  async recoveryTestCoordinate({ operationId }, { signal } = {}) {
    assertGeneratedId(operationId, 'operationId');
    await this.#revalidateRecoveryRoot({ signal });
    const path = join(this.#recoveryRoot.path, `.numberdroid-recovery-stage-${operationId}`);
    invariant(isPathWithin(this.#recoveryRoot.path, path, this.#platform),
      'BACKUP_PATH_UNSAFE', 'Generated recovery-test coordinate escaped its fixed root.');
    await assertAbsent(path);
    return Object.freeze({ kind: 'RECOVERY_TEST', operationId, root: this.#recoveryRoot, path });
  }

  async resolveBackup({ backupId, destinationId }, { signal } = {}) {
    assertGeneratedId(backupId, 'backupId');
    const root = this.#destination('CREATE', destinationId);
    await this.#revalidate(root, { signal });
    const finalPath = join(root.path, `backup-${backupId}`);
    invariant(isPathWithin(root.path, finalPath, this.#platform),
      'BACKUP_PATH_UNSAFE', 'Backup identity escaped its configured root.');
    const identity = this.#platform === 'win32'
      ? await this.#inspect(finalPath, null, { inspectDescendants: true, signal })
      : await inspectDirectory(finalPath);
    return Object.freeze({ backupId, destinationId, root, finalPath, identity });
  }

  async resolvePublished({ kind, destinationId, operationId, outputId }, { signal } = {}) {
    const root = this.#destination(kind, destinationId);
    await this.#revalidate(root, { signal });
    const reserved = coordinate({ kind, root, destinationId, operationId, outputId });
    invariant(isPathWithin(root.path, reserved.finalPath, this.#platform),
      'BACKUP_PATH_UNSAFE', 'Published operation identity escaped its configured root.');
    const identity = this.#platform === 'win32'
      ? await this.#inspect(reserved.finalPath, null, { inspectDescendants: true, signal })
      : await inspectDirectory(reserved.finalPath);
    return Object.freeze({ ...reserved, identity });
  }

  async resolveRecoveryTest({ operationId }, { signal } = {}) {
    assertGeneratedId(operationId, 'operationId');
    await this.#revalidateRecoveryRoot({ signal });
    const path = join(this.#recoveryRoot.path, `.numberdroid-recovery-stage-${operationId}`);
    invariant(isPathWithin(this.#recoveryRoot.path, path, this.#platform),
      'BACKUP_PATH_UNSAFE', 'Generated recovery-test coordinate escaped its fixed root.');
    const identity = this.#platform === 'win32'
      ? await this.#inspect(path, null, { inspectDescendants: true, signal })
      : await inspectDirectory(path);
    return Object.freeze({ kind: 'RECOVERY_TEST', operationId, root: this.#recoveryRoot, path, identity });
  }

  async revalidateOperationStage(coordinateValue, expectedIdentity, { signal } = {}) {
    invariant(coordinateValue && typeof coordinateValue === 'object' && expectedIdentity,
      'BACKUP_PATH_UNSAFE', 'Reserved stage coordinate and identity are required.');
    let stagePath;
    if (coordinateValue.kind === 'RECOVERY_TEST') {
      assertGeneratedId(coordinateValue.operationId, 'operationId');
      await this.#revalidateRecoveryRoot({ signal });
      stagePath = join(
        this.#recoveryRoot.path,
        `.numberdroid-recovery-stage-${coordinateValue.operationId}`,
      );
      invariant(coordinateValue.path === stagePath
          && coordinateValue.root?.rootKey === this.#recoveryRoot.rootKey
          && isPathWithin(this.#recoveryRoot.path, stagePath, this.#platform),
      'BACKUP_PATH_UNSAFE', 'Recovery-test stage coordinate changed.');
    } else {
      const root = this.#destination(coordinateValue.kind, coordinateValue.destinationId);
      await this.#revalidate(root, { signal });
      const reserved = coordinate({
        kind: coordinateValue.kind,
        root,
        destinationId: coordinateValue.destinationId,
        operationId: coordinateValue.operationId,
        outputId: coordinateValue.outputId,
      });
      invariant(coordinateValue.root?.rootKey === root.rootKey
          && coordinateValue.stageBasename === reserved.stageBasename
          && coordinateValue.stagePath === reserved.stagePath
          && isPathWithin(root.path, reserved.stagePath, this.#platform),
      'BACKUP_PATH_UNSAFE', 'Published-output stage coordinate changed.');
      stagePath = reserved.stagePath;
    }

    const current = this.#platform === 'win32'
      ? await this.#inspect(stagePath, expectedIdentity, { inspectDescendants: true, signal })
      : await inspectDirectory(stagePath);
    invariant(this.#platform === 'win32'
        || (current.device === expectedIdentity.device && current.inode === expectedIdentity.inode),
    'BACKUP_PATH_UNSAFE', 'Operation stage identity changed.');
    return current;
  }

  async durableStage(path, { signal } = {}) {
    assertEffectFence(signal);
    if (this.#platform === 'win32') {
      await this.#inspect(path, null, { inspectDescendants: true, signal });
    }
    await syncTree(path, this.#platform, signal);
  }

  async writeQuarantineMarker(copyRoot, { copyId, backupId, manifestSha256 }, { signal } = {}) {
    return writeRestoredWorkspaceQuarantineMarker(
      copyRoot,
      { copyId, backupId, manifestSha256 },
      { platform: this.#platform, signal },
    );
  }

  async publish(allocated, { signal } = {}) {
    assertEffectFence(signal);
    await this.#revalidate(allocated.root, { signal });
    const stageIdentity = this.#platform === 'win32'
      ? await this.#inspect(allocated.stagePath, null, { signal })
      : await inspectDirectory(allocated.stagePath);
    await this.durableStage(allocated.stagePath, { signal });
    await this.#revalidate(allocated.root, { signal });
    await assertAbsent(allocated.finalPath);
    assertEffectFence(signal);
    if (this.#platform === 'win32') {
      const code = await publishWindowsFilesystem({
        rootPath: allocated.root.path,
        stagePath: allocated.stagePath,
        finalPath: allocated.finalPath,
        expectedRootVolumeSerial: allocated.root.volumeSerial,
        expectedRootFileId: allocated.root.fileId,
        expectedStageVolumeSerial: stageIdentity.volumeSerial,
        expectedStageFileId: stageIdentity.fileId,
      }, { spawnProcess: this.#spawnProcess, signal });
      if (code !== 'OK') {
        throw safeFailure(code, 'Windows no-overwrite publication failed.');
      }
    } else {
      try {
        await rename(allocated.stagePath, allocated.finalPath);
      } catch {
        throw safeFailure('BACKUP_PUBLISH_FAILED', 'Verified output could not be published atomically.');
      }
      await syncHandle(allocated.root.path, signal);
    }
    const finalIdentity = this.#platform === 'win32'
      ? await this.#inspect(allocated.finalPath, stageIdentity, { inspectDescendants: true, signal })
      : await inspectDirectory(allocated.finalPath);
    invariant(
      this.#platform === 'win32'
        || (stageIdentity.device === finalIdentity.device && stageIdentity.inode === finalIdentity.inode),
      'BACKUP_DURABILITY_FAILED',
      'Published output identity differs from its verified stage.',
    );
    await this.#revalidate(allocated.root, { signal });
    return Object.freeze({ rootKey: allocated.root.rootKey, identity: finalIdentity });
  }

  async cleanupRecoveryTest(coordinateValue, expectedIdentity, { signal } = {}) {
    invariant(coordinateValue?.kind === 'RECOVERY_TEST', 'BACKUP_PATH_UNSAFE', 'Only a recovery-test coordinate can be cleaned.');
    await this.#revalidateRecoveryRoot({ signal });
    const fixedRoot = this.#recoveryRoot.path;
    invariant(
      coordinateValue.path === join(fixedRoot, `.numberdroid-recovery-stage-${coordinateValue.operationId}`)
        && isPathWithin(fixedRoot, coordinateValue.path, this.#platform),
      'BACKUP_PATH_UNSAFE',
      'Recovery cleanup coordinate is not operation-owned.',
    );
    const current = this.#platform === 'win32'
      ? await this.#inspect(coordinateValue.path, expectedIdentity, { inspectDescendants: true, signal })
      : await inspectDirectory(coordinateValue.path);
    invariant(this.#platform === 'win32'
      || (current.device === expectedIdentity.device && current.inode === expectedIdentity.inode),
      'BACKUP_PATH_UNSAFE', 'Recovery-test copy identity changed before cleanup.');
    assertEffectFence(signal);
    await rm(coordinateValue.path, { recursive: true, force: false });
    if (this.#platform !== 'win32') await syncHandle(fixedRoot, signal);
  }

  inspectOperationDirectory(path, { signal } = {}) {
    assertEffectFence(signal);
    return this.#platform === 'win32'
      ? this.#inspect(path, null, { inspectDescendants: true, signal })
      : inspectDirectory(path);
  }

  identitySha256(identity) {
    invariant(identity && typeof identity === 'object', 'BACKUP_PATH_UNSAFE', 'Filesystem identity is required.');
    if (this.#platform === 'win32') {
      invariant(typeof identity.volumeSerial === 'string' && typeof identity.fileId === 'string',
        'BACKUP_PATH_UNSAFE', 'Windows filesystem identity is invalid.');
      return identityKey(['win32-entry', identity.volumeSerial, identity.fileId]);
    }
    invariant(typeof identity.device === 'string' && typeof identity.inode === 'string',
      'BACKUP_PATH_UNSAFE', 'Linux filesystem identity is invalid.');
    return identityKey(['linux-entry', identity.device, identity.inode]);
  }
}

export { QUARANTINE_MARKER };
