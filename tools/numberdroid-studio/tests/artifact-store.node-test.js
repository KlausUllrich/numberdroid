import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, symlink, unlink, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ContentAddressedArtifactStore,
  SqliteArtifactMetadataStore,
  SqliteProjectStore,
} from '../packages/persistence/src/index.js';
import { createHarness, createProject, PROJECT_ID } from './test-helpers.js';
import {
  afterTestCleanup, nodeSqliteDatabaseFactory, pngHeader, webpExtendedHeader,
} from './persistence-test-helpers.js';

async function tempDirectory(context, prefix) {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  afterTestCleanup(context, () => rm(directory, { recursive: true, force: true }));
  return directory;
}

test('CAS stages, hashes, atomically promotes, verifies, and deduplicates image bytes', async (context) => {
  const root = await tempDirectory(context, 'numberdroid-cas-');
  const store = new ContentAddressedArtifactStore({ rootDirectory: root });
  const bytes = pngHeader({ width: 64, height: 48, tail: 'atlas-a' });

  const first = await store.ingest(bytes, { mediaType: 'image/png' });
  assert.equal(first.schemaVersion, 1);
  assert.equal(first.width, 64);
  assert.equal(first.height, 48);
  assert.equal(first.byteSize, bytes.length);
  assert.equal(first.deduplicated, false);
  assert.match(first.digest, /^[a-f0-9]{64}$/);
  assert.equal(first.uri, `studio://artifacts/sha256/${first.digest}`);
  const verified = await store.verify(first.digest);
  assert.equal(verified.byteSize, bytes.length);

  const second = await store.ingest((async function* chunks() {
    yield bytes.subarray(0, 12);
    yield bytes.subarray(12);
  }()), { mediaType: 'image/png', expectedDigest: first.digest });
  assert.equal(second.digest, first.digest);
  assert.equal(second.deduplicated, true);
  assert.deepEqual(await store.listLiveDigests(), [first.digest]);
  assert.deepEqual(await readdir(join(root, 'staging')), []);

  const webp = await store.ingest(webpExtendedHeader({ width: 80, height: 45 }), { mediaType: 'image/webp' });
  assert.equal(webp.width, 80);
  assert.equal(webp.height, 45);
  assert.equal((await store.verify(webp.digest)).byteSize, 30);
});

test('concurrent identical CAS ingests publish once without replacing the live digest object', async (context) => {
  const root = await tempDirectory(context, 'numberdroid-cas-concurrent-');
  const store = new ContentAddressedArtifactStore({ rootDirectory: root });
  const bytes = pngHeader({ width: 512, height: 512, tail: 'same-concurrent-atlas' });
  const results = await Promise.all(Array.from({ length: 12 }, () => store.ingest(bytes, { mediaType: 'image/png' })));
  const digests = new Set(results.map((result) => result.digest));
  assert.equal(digests.size, 1);
  assert.equal(results.filter((result) => result.deduplicated === false).length, 1);
  assert.equal(results.filter((result) => result.deduplicated === true).length, 11);
  assert.equal((await store.verify(results[0].digest)).byteSize, bytes.length);
  assert.deepEqual(await readdir(join(root, 'staging')), []);
  assert.deepEqual(await store.listLiveDigests(), [results[0].digest]);
});

test('CAS rejects malformed, oversized, over-dimension, mismatched, and traversal-shaped inputs without residue', async (context) => {
  const root = await tempDirectory(context, 'numberdroid-cas-limits-');
  const store = new ContentAddressedArtifactStore({
    rootDirectory: root,
    limits: { 'image/png': { maxBytes: 1024, maxWidth: 100, maxHeight: 100 } },
  });

  await assert.rejects(store.ingest(Buffer.alloc(1025), { mediaType: 'image/png' }), (error) => error.code === 'ARTIFACT_TOO_LARGE');
  await assert.rejects(store.ingest(Buffer.alloc(24), { mediaType: 'image/png' }), (error) => error.code === 'ARTIFACT_MEDIA_MISMATCH');
  const truncatedPng = pngHeader().subarray(0, -12);
  await assert.rejects(store.ingest(truncatedPng, { mediaType: 'image/png' }), (error) => error.code === 'ARTIFACT_MALFORMED');
  const badCrcPng = Buffer.from(pngHeader());
  badCrcPng[29] ^= 0xff;
  await assert.rejects(store.ingest(badCrcPng, { mediaType: 'image/png' }), (error) => error.code === 'ARTIFACT_MALFORMED');
  await assert.rejects(store.ingest(pngHeader({ width: 101, height: 1 }), { mediaType: 'image/png' }), (error) => error.code === 'ARTIFACT_DIMENSIONS_EXCEEDED');
  await assert.rejects(
    store.ingest(pngHeader(), { mediaType: 'image/png', expectedDigest: '0'.repeat(64) }),
    (error) => error.code === 'ARTIFACT_DIGEST_MISMATCH',
  );
  await assert.rejects(store.ingest(pngHeader(), { mediaType: 'image/jpeg' }), (error) => error.code === 'ARTIFACT_UNSUPPORTED_MEDIA');
  await assert.rejects(store.verify('../outside'), (error) => error.code === 'ARTIFACT_INVALID_DIGEST');
  assert.deepEqual(await readdir(join(root, 'staging')), []);
  assert.deepEqual(await store.listLiveDigests(), []);
});

test('CAS detects corruption and uses quarantine plus delayed sweep for garbage collection', async (context) => {
  const root = await tempDirectory(context, 'numberdroid-cas-gc-');
  const store = new ContentAddressedArtifactStore({ rootDirectory: root });
  const retained = await store.ingest(pngHeader({ tail: 'retained' }), { mediaType: 'image/png' });
  const garbage = await store.ingest(pngHeader({ tail: 'garbage' }), { mediaType: 'image/png' });
  const old = new Date('2026-08-20T00:00:00.000Z');
  await utimes((await store.verify(retained.digest)).path, old, old);
  await utimes((await store.verify(garbage.digest)).path, old, old);

  const marked = await store.markUnreferenced({
    referencedDigests: new Set([retained.digest]),
    now: new Date('2026-08-21T00:00:00.000Z'),
    retentionMs: 1,
  });
  assert.deepEqual(marked.map(({ digest }) => digest), [garbage.digest]);
  assert.equal((await store.verify(retained.digest)).digest, retained.digest);
  await assert.rejects(store.verify(garbage.digest), (error) => error.code === 'ARTIFACT_MISSING');
  assert.deepEqual(await store.sweepQuarantine({ now: new Date('2026-08-21T00:00:00.000Z'), retentionMs: 1 }), []);
  assert.deepEqual(
    await store.sweepQuarantine({ now: new Date('2026-08-22T00:00:00.000Z'), retentionMs: 1 }),
    [garbage.digest],
  );

  const corruption = await store.ingest(pngHeader({ tail: 'corrupt-me' }), { mediaType: 'image/png' });
  await writeFile((await store.verify(corruption.digest)).path, 'changed');
  await assert.rejects(store.verify(corruption.digest), (error) => error.code === 'ARTIFACT_CORRUPT');
});

test('verified PNG evidence holds a no-follow object and exposes descriptor facts only', async (context) => {
  const root = await tempDirectory(context, 'numberdroid-cas-evidence-');
  const store = new ContentAddressedArtifactStore({ rootDirectory: root });
  const bytes = pngHeader({ width: 9, height: 7, tail: 'held-evidence' });
  const artifact = await store.ingest(bytes, { mediaType: 'image/png' });
  const observed = await store.withVerifiedPngEvidence(artifact.digest, async (evidence) => {
    assert.deepEqual(Object.keys(evidence), ['sha256', 'mediaType', 'byteSize', 'width', 'height']);
    assert.ok(Object.isFrozen(evidence));
    assert.equal(evidence.sha256, artifact.digest);
    assert.equal(evidence.byteSize, bytes.length);
    assert.equal(evidence.width, 9);
    assert.equal(evidence.height, 7);
    return 'closed';
  });
  assert.equal(observed, 'closed');

  const path = (await store.verify(artifact.digest)).path;
  const target = join(root, 'symlink-target.png');
  await writeFile(target, bytes);
  await unlink(path);
  try {
    await symlink(target, path);
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOSYS'].includes(error.code)) {
      context.skip(`symbolic links unavailable: ${error.code}`);
      return;
    }
    throw error;
  }
  await assert.rejects(
    store.withVerifiedPngEvidence(artifact.digest, () => 'forbidden'),
    (error) => error.code === 'ARTIFACT_CORRUPT',
  );
});

test('artifact metadata and its live reference commit atomically or both roll back', async (context) => {
  const directory = await tempDirectory(context, 'numberdroid-artifact-meta-');
  const projectStore = await SqliteProjectStore.open({
    filename: join(directory, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  afterTestCleanup(context, () => projectStore.close());
  const { studio } = createHarness(projectStore);
  await createProject(studio);
  const cas = new ContentAddressedArtifactStore({ rootDirectory: join(directory, 'cas') });
  const artifact = await cas.ingest(pngHeader({ width: 256, height: 128 }), { mediaType: 'image/png' });
  const metadata = new SqliteArtifactMetadataStore({ workspace: projectStore.workspace });

  metadata.registerAndReference(artifact, {
    projectId: PROJECT_ID,
    ownerKind: 'source',
    ownerId: 'source.atlas',
    createdRevision: 1,
  });
  assert.deepEqual([...metadata.listReferencedDigests()], [artifact.digest]);
  assert.equal(metadata.listArtifacts()[0].state, 'LIVE');
  assert.throws(
    () => metadata.register({ ...artifact, width: artifact.width + 1 }),
    (error) => error.code === 'ARTIFACT_METADATA_CONFLICT',
  );

  const orphan = await cas.ingest(pngHeader({ width: 16, height: 16, tail: 'orphan' }), { mediaType: 'image/png' });
  assert.throws(() => metadata.registerAndReference(orphan, {
    projectId: 'project.missing',
    ownerKind: 'source',
    ownerId: 'source.orphan',
    createdRevision: 1,
  }));
  assert.equal(projectStore.workspace.database.prepare('SELECT count(*) AS count FROM artifacts WHERE digest = ?').get(orphan.digest).count, 0);
});
