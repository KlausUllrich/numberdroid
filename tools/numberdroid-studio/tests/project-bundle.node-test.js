import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ContentAddressedArtifactStore } from '../packages/persistence/src/artifacts/content-addressed-artifact-store.js';
import {
  PROJECT_BUNDLE_LIMITS,
  canonicalBundleJson,
  createPortableProjectBundle,
  importPortableProjectBundle,
  validatePortableProjectDocument,
  verifyPortableProjectBundle,
} from '../packages/persistence/src/bundle/project-bundle.js';
import { pngHeader } from './persistence-test-helpers.js';

function projectDocument(artifactDigests, overrides = {}) {
  return {
    schemaVersion: 1,
    bundleKind: 'numberdroid-studio-project',
    projectHead: {
      projectId: 'project.family-hygiene',
      formatVersion: 1,
      revision: 12,
      revisionId: 'rev.project.family-hygiene.12',
      name: 'Family Hygiene',
      description: null,
      ownerId: 'designer.one',
      status: 'draft',
      statusNote: null,
      createdAt: '2026-08-21T12:00:00.000Z',
      updatedAt: '2026-08-22T12:00:00.000Z',
    },
    artifactDigests: [...artifactDigests].sort(),
    sources: artifactDigests.length === 0 ? [] : [{ sourceId: 'source.family-hygiene', digest: artifactDigests[0] }],
    atlases: artifactDigests.length < 2 ? [] : [{ atlasId: 'atlas.family-hygiene', sourceDigest: artifactDigests[0], slices: [{ sliceId: 'slice.1', artifactDigest: artifactDigests[1] }] }],
    legacyAssets: [{ assetId: 'asset.legacy', legacy: true }],
    assetLibrary: {
      sliceBindings: artifactDigests.length < 2 ? [] : [{ bindingId: 'binding.slice.1.v1', artifactDigest: artifactDigests[1] }],
      versions: artifactDigests.length < 2 ? [] : [{ assetId: 'asset.hygiene.1', assetVersion: 1, artifactDigest: artifactDigests[1], lifecycle: 'DRAFT' }],
      heads: artifactDigests.length < 2 ? [] : [{ assetId: 'asset.hygiene.1', assetVersion: 1 }],
      findings: [{ findingId: 'finding.surface.metadata', severity: 'WARNING', path: '/metadata/connectors' }],
    },
    proposals: [{
      proposalId: 'proposal.family-hygiene',
      status: 'APPLIED',
      items: [{ ordinal: 1, decision: 'ACCEPT' }, { ordinal: 2, decision: 'REJECT', reason: 'Keep one candidate out.' }],
    }],
    appliedJobHistory: [{ jobId: 'job.atlas.family-hygiene', state: 'APPLIED', provenance: 'bundle_import' }],
    activity: [{ eventId: 'activity.12', revision: 12, actorId: 'designer.one', taskId: null, type: 'asset.proposal.apply' }],
    ...overrides,
  };
}

async function fixture(context, name = 'numberdroid-project-bundle-') {
  const root = await mkdtemp(join(tmpdir(), name));
  context.after(() => rm(root, { recursive: true, force: true }));
  const artifactStore = new ContentAddressedArtifactStore({ rootDirectory: join(root, 'live-artifacts') });
  const first = await artifactStore.ingest(pngHeader({ width: 7, height: 5, tail: 'bundle-one' }), { mediaType: 'image/png' });
  const second = await artifactStore.ingest(pngHeader({ width: 11, height: 9, tail: 'bundle-two' }), { mediaType: 'image/png' });
  const artifacts = [second, first].map(({ digest, byteSize, mediaType, width, height }) => ({ digest, byteSize, mediaType, width, height }));
  const project = projectDocument(artifacts.map((entry) => entry.digest));
  return { root, artifactStore, artifacts, project };
}

async function createBundle(value, name = 'bundle') {
  const destinationDirectory = join(value.root, name);
  const result = await createPortableProjectBundle({
    destinationDirectory,
    project: value.project,
    artifacts: value.artifacts,
    artifactStore: value.artifactStore,
  });
  return { destinationDirectory, result };
}

async function expectMissing(path) {
  await assert.rejects(access(path), (error) => error.code === 'ENOENT');
}

test('portable project bundle export is canonical, exact-closure, and deterministic', async (context) => {
  const value = await fixture(context);
  const firstBundle = await createBundle(value, 'bundle-one');
  const secondBundle = await createBundle(value, 'bundle-two');
  assert.equal(firstBundle.result.ok, true);
  assert.equal(firstBundle.result.manifest.projectId, 'project.family-hygiene');
  assert.equal(firstBundle.result.manifest.revision, 12);
  assert.deepEqual(
    firstBundle.result.manifest.artifacts.map((entry) => entry.digest),
    [...value.project.artifactDigests],
  );

  const firstManifest = await readFile(join(firstBundle.destinationDirectory, 'manifest.json'));
  const secondManifest = await readFile(join(secondBundle.destinationDirectory, 'manifest.json'));
  const firstProject = await readFile(join(firstBundle.destinationDirectory, 'project.json'));
  const secondProject = await readFile(join(secondBundle.destinationDirectory, 'project.json'));
  assert.deepEqual(firstManifest, secondManifest);
  assert.deepEqual(firstProject, secondProject);
  assert.equal(firstManifest.toString('utf8'), canonicalBundleJson(JSON.parse(firstManifest)));
  assert.equal(firstProject.toString('utf8'), canonicalBundleJson(value.project));
  assert.equal(
    await readFile(join(firstBundle.destinationDirectory, 'manifest.sha256'), 'ascii'),
    createHash('sha256').update(firstManifest).digest('hex'),
  );
  for (const artifact of firstBundle.result.manifest.artifacts) {
    const path = join(firstBundle.destinationDirectory, 'artifacts', 'sha256', artifact.digest.slice(0, 2), artifact.digest.slice(2, 4), artifact.digest);
    assert.deepEqual(await readFile(path), await readFile((await value.artifactStore.verify(artifact.digest)).path));
  }
  assert.equal((await verifyPortableProjectBundle(firstBundle.destinationDirectory)).ok, true);
});

test('portable project document rejects authority, machine locations, nonterminal work, and unknown fields', async () => {
  const digest = 'a'.repeat(64);
  const base = projectDocument([digest]);
  assert.throws(
    () => validatePortableProjectDocument({ ...base, grants: [] }),
    (error) => error.code === 'BUNDLE_SCHEMA_INVALID',
  );
  assert.throws(
    () => validatePortableProjectDocument({ ...base, schemaVersion: 2 }),
    (error) => error.code === 'BUNDLE_SCHEMA_UNSUPPORTED',
  );
  assert.throws(
    () => validatePortableProjectDocument({ ...base, sources: [{ sourceId: 'source.one', grantId: 'grant.secret' }] }),
    (error) => error.code === 'BUNDLE_AUTHORITY_FORBIDDEN',
  );
  assert.throws(
    () => validatePortableProjectDocument({ ...base, proposals: [{ proposalId: 'proposal.one', status: 'APPLIED', proposerGrantId: 'grant.secret' }] }),
    (error) => error.code === 'BUNDLE_AUTHORITY_FORBIDDEN',
  );
  assert.throws(
    () => validatePortableProjectDocument({ ...base, sources: [{ sourceId: 'source.one', artifactUri: `studio://artifacts/sha256/${digest}` }] }),
    (error) => error.code === 'BUNDLE_MACHINE_LOCATION_FORBIDDEN',
  );
  assert.throws(
    () => validatePortableProjectDocument({ ...base, sources: [{ sourceId: 'source.one', sourcePath: '../../secret.png' }] }),
    (error) => error.code === 'BUNDLE_MACHINE_LOCATION_FORBIDDEN',
  );
  assert.throws(
    () => validatePortableProjectDocument({ ...base, proposals: [{ proposalId: 'proposal.pending', status: 'PENDING', items: [{}] }] }),
    (error) => error.code === 'BUNDLE_NOT_QUIESCENT',
  );
  assert.throws(
    () => validatePortableProjectDocument({ ...base, appliedJobHistory: [{ jobId: 'job.running', state: 'RUNNING' }] }),
    (error) => error.code === 'BUNDLE_NOT_QUIESCENT',
  );
  assert.throws(
    () => validatePortableProjectDocument({ ...base, sources: [{ sourceId: 'source.one', digest: 'b'.repeat(64) }] }),
    (error) => error.code === 'BUNDLE_CAS_CLOSURE_MISMATCH',
  );
});

test('portable project bundle verifier fails closed on noncanonical, tampered, extra, and symlink trees', async (context) => {
  await test('noncanonical project JSON', async () => {
    const value = await fixture(context, 'numberdroid-bundle-noncanonical-');
    const { destinationDirectory } = await createBundle(value);
    await writeFile(join(destinationDirectory, 'project.json'), `${JSON.stringify(value.project, null, 2)}\n`);
    await assert.rejects(verifyPortableProjectBundle(destinationDirectory), (error) => error.code === 'BUNDLE_NONCANONICAL');
  });

  await test('tampered manifest digest', async () => {
    const value = await fixture(context, 'numberdroid-bundle-manifest-');
    const { destinationDirectory } = await createBundle(value);
    await writeFile(join(destinationDirectory, 'manifest.sha256'), '0'.repeat(64));
    await assert.rejects(verifyPortableProjectBundle(destinationDirectory), (error) => error.code === 'BUNDLE_MANIFEST_DIGEST_MISMATCH');
  });

  await test('extra file', async () => {
    const value = await fixture(context, 'numberdroid-bundle-extra-');
    const { destinationDirectory } = await createBundle(value);
    await writeFile(join(destinationDirectory, 'extra.txt'), 'not allowed');
    await assert.rejects(verifyPortableProjectBundle(destinationDirectory), (error) => error.code === 'BUNDLE_TREE_INVALID');
  });

  await test('missing artifact', async () => {
    const value = await fixture(context, 'numberdroid-bundle-missing-');
    const { destinationDirectory, result } = await createBundle(value);
    const artifact = result.manifest.artifacts[0];
    const path = join(destinationDirectory, 'artifacts', 'sha256', artifact.digest.slice(0, 2), artifact.digest.slice(2, 4), artifact.digest);
    await unlink(path);
    await assert.rejects(verifyPortableProjectBundle(destinationDirectory), (error) => error.code === 'BUNDLE_TREE_INVALID');
  });

  await test('symlink', async () => {
    const value = await fixture(context, 'numberdroid-bundle-symlink-');
    const { destinationDirectory } = await createBundle(value);
    await symlink('project.json', join(destinationDirectory, 'extra-link'));
    await assert.rejects(verifyPortableProjectBundle(destinationDirectory), (error) => error.code === 'BUNDLE_SYMLINK_FORBIDDEN');
  });

  await test('artifact corruption', async () => {
    const value = await fixture(context, 'numberdroid-bundle-corrupt-');
    const { destinationDirectory, result } = await createBundle(value);
    const artifact = result.manifest.artifacts[0];
    const path = join(destinationDirectory, 'artifacts', 'sha256', artifact.digest.slice(0, 2), artifact.digest.slice(2, 4), artifact.digest);
    const bytes = await readFile(path);
    bytes[bytes.length - 1] ^= 1;
    await writeFile(path, bytes);
    await assert.rejects(verifyPortableProjectBundle(destinationDirectory), (error) => error.code === 'BUNDLE_ARTIFACT_DIGEST_MISMATCH');
  });

  await test('canonical semantic tamper', async () => {
    const value = await fixture(context, 'numberdroid-bundle-semantic-tamper-');
    const { destinationDirectory } = await createBundle(value);
    const tampered = { ...value.project, projectHead: { ...value.project.projectHead, name: 'Tampered name' } };
    await writeFile(join(destinationDirectory, 'project.json'), canonicalBundleJson(tampered));
    await assert.rejects(verifyPortableProjectBundle(destinationDirectory), (error) => error.code === 'BUNDLE_PROJECT_DIGEST_MISMATCH');
  });
});

test('portable bundle export rejects destination conflicts and metadata/semantic closure mismatches', async (context) => {
  const value = await fixture(context);
  const { destinationDirectory } = await createBundle(value);
  await assert.rejects(
    createPortableProjectBundle({
      destinationDirectory,
      project: value.project,
      artifacts: value.artifacts,
      artifactStore: value.artifactStore,
    }),
    (error) => error.code === 'BUNDLE_DESTINATION_EXISTS',
  );
  await assert.rejects(
    createPortableProjectBundle({
      destinationDirectory: join(value.root, 'wrong-closure'),
      project: { ...value.project, artifactDigests: [value.project.artifactDigests[0]] },
      artifacts: value.artifacts,
      artifactStore: value.artifactStore,
    }),
    (error) => error.code === 'BUNDLE_CAS_CLOSURE_MISMATCH',
  );
  await assert.rejects(
    createPortableProjectBundle({
      destinationDirectory: join(value.root, 'oversize'),
      project: value.project,
      artifacts: value.artifacts,
      artifactStore: value.artifactStore,
      limits: { ...PROJECT_BUNDLE_LIMITS, maxArtifactBytes: 1 },
    }),
    (error) => error.code === 'BUNDLE_SCHEMA_INVALID',
  );
});

test('portable bundle import materializes only through a verified staged v9 seam and publishes atomically', async (context) => {
  const value = await fixture(context);
  const { destinationDirectory: bundleDirectory, result: bundle } = await createBundle(value);
  const destinationDirectory = join(value.root, 'imported-workspace');
  let callbackObserved = false;
  const imported = await importPortableProjectBundle({
    bundleDirectory,
    destinationDirectory,
    materialize: async ({ stagingDirectory, artifactDirectory, project, manifest, artifacts }) => {
      callbackObserved = true;
      assert.equal(project.projectHead.projectId, 'project.family-hygiene');
      assert.equal(manifest.projectId, project.projectHead.projectId);
      assert.equal(artifacts.length, 2);
      for (const artifact of artifacts) assert.equal(Object.hasOwn(artifact, 'path'), false);
      await writeFile(join(stagingDirectory, 'studio.sqlite'), 'semantic-v9-fixture', { flag: 'wx' });
      assert.equal((await readdir(join(artifactDirectory, 'sha256'))).length > 0, true);
      return { databasePath: join(stagingDirectory, 'studio.sqlite'), integrity: { ok: true, schemaVersion: 9 } };
    },
  });
  assert.equal(callbackObserved, true);
  assert.equal(imported.ok, true);
  assert.equal(imported.projectId, 'project.family-hygiene');
  assert.equal(imported.manifestDigest, bundle.manifestDigest);
  assert.equal(await readFile(join(destinationDirectory, 'studio.sqlite'), 'utf8'), 'semantic-v9-fixture');
  await expectMissing(join(destinationDirectory, 'manifest.json'));
  for (const artifact of bundle.manifest.artifacts) {
    const path = join(destinationDirectory, 'artifacts', 'sha256', artifact.digest.slice(0, 2), artifact.digest.slice(2, 4), artifact.digest);
    assert.equal((await readFile(path)).length, artifact.byteSize);
  }
});

test('portable bundle import leaves no visible destination on materializer failure, bad integrity, or staged symlink', async (context) => {
  const value = await fixture(context);
  const { destinationDirectory: bundleDirectory } = await createBundle(value);

  const failedDestination = join(value.root, 'failed-import');
  await assert.rejects(
    importPortableProjectBundle({
      bundleDirectory,
      destinationDirectory: failedDestination,
      materialize: async () => { throw new Error('fixture materialization failed'); },
    }),
    /fixture materialization failed/,
  );
  await expectMissing(failedDestination);

  const badIntegrityDestination = join(value.root, 'bad-integrity-import');
  await assert.rejects(
    importPortableProjectBundle({
      bundleDirectory,
      destinationDirectory: badIntegrityDestination,
      materialize: async () => ({ integrity: { ok: false } }),
    }),
    (error) => error.code === 'BUNDLE_IMPORT_INTEGRITY_FAILED',
  );
  await expectMissing(badIntegrityDestination);

  const symlinkDestination = join(value.root, 'symlink-import');
  await assert.rejects(
    importPortableProjectBundle({
      bundleDirectory,
      destinationDirectory: symlinkDestination,
      materialize: async ({ stagingDirectory }) => {
        await symlink('artifacts', join(stagingDirectory, 'linked-artifacts'));
        return { integrity: { ok: true } };
      },
    }),
    (error) => error.code === 'BUNDLE_SYMLINK_FORBIDDEN',
  );
  await expectMissing(symlinkDestination);

  const existingDestination = join(value.root, 'existing-import');
  await mkdir(existingDestination);
  let called = false;
  await assert.rejects(
    importPortableProjectBundle({
      bundleDirectory,
      destinationDirectory: existingDestination,
      materialize: async () => { called = true; return { integrity: { ok: true } }; },
    }),
    (error) => error.code === 'BUNDLE_DESTINATION_EXISTS',
  );
  assert.equal(called, false);
});
