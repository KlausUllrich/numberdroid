import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { StudioService } from '../packages/application/src/index.js';
import { upgradeAssemblyDeclaration } from '../packages/domain/src/assembly-geometry.js';
import {
  ContentAddressedArtifactStore, SqliteArtifactMetadataStore, SqliteJobStore, SqliteProjectStore,
  createWorkspaceBackup, restoreWorkspaceBackup, verifyWorkspaceBackup, verifyWorkspaceIntegrity,
  projectSqlitePortableDocument,
} from '../packages/persistence/src/index.js';
import { AtlasPreviewWorker } from '../apps/studio-server/src/atlas-preview-worker.js';
import { assemblyFixture, assemblyPayload, owner, projectId } from './assembly-test-helpers.js';
import { clipPayload } from './clip-test-helpers.js';
import { nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';

test('schema17 workspace backup restores revised cuts and clips while Assembly v2 retains its old exact pins', { timeout: 180000 }, async context => {
  const f = await assemblyFixture(context);
  await f.execute('asset.save', f.payload());
  const clip = clipPayload(f.slice);
  await f.execute('clip.save', clip);
  const assembly = upgradeAssemblyDeclaration(assemblyPayload().assembly);
  assembly.states.push({ stateId: 'brewing', name: 'Brewing' });
  assembly.components[0].stateOverrides.push({ stateId: 'brewing', content: {
    kind: 'animation', asset: { assetId: clip.assetId, assetVersion: 1, metadataVersion: 1 },
  } });
  await f.execute('assembly.save', assemblyPayload({ assembly }));
  const assemblyRequest = { schemaVersion: 1, projectId, assetId: 'assembly.fixture',
    selection: { stateId: 'brewing', variantId: 'default' } };
  const originalAssembly = await f.studio.queryAssemblies(assemblyRequest, owner);
  const originalClip = await f.studio.queryClips({ schemaVersion: 1, projectId, assetId: clip.assetId }, owner);

  const cut = { sliceId: f.slice.sliceId, sourceSliceVersion: 1, expectedSliceVersion: 1,
    expectedAtlasVersion: 1, jobId: 'job.backup-cut-revision', name: 'Trimmed frame',
    rectangle: { x: 1, y: 0, width: 15, height: 16 } };
  await f.execute('slice.revision.prepare', cut);
  const worker = new AtlasPreviewWorker({ jobStore: new SqliteJobStore({ workspace: f.store.workspace }),
    artifactStore: f.artifacts, artifactMetadataStore: new SqliteArtifactMetadataStore({ workspace: f.store.workspace }),
    workerId: 'worker.animation-backup' });
  try { await worker.drain(); } finally { await worker.stop(); }
  const revised = await f.execute('slice.revision.commit', { sliceId: cut.sliceId,
    expectedSliceVersion: 1, expectedAtlasVersion: 1, jobId: cut.jobId });
  assert.equal(revised.value.sliceBinding.sliceVersion, 2);
  assert.notEqual(revised.value.sliceBinding.digest, f.slice.digest);
  const newerClip = structuredClone(clip);
  Object.assign(newerClip, { operation: 'update', expectedAssetVersion: 1, expectedMetadataVersion: 1 });
  newerClip.clip.frames[0].slice.sliceVersion = 2;
  newerClip.clip.frames[0].offset.x = 1;
  await f.execute('clip.save', newerClip);

  const before = await f.studio.readProjectTrusted(projectId);
  const portableBefore = projectSqlitePortableDocument({ projectStore: f.store, projectId }).project;
  assert.equal(portableBefore.schemaVersion, 6);
  assert.equal(portableBefore.clipLibrary.versions.length, 2);
  assert.deepEqual(portableBefore.clipLibrary.sliceBindings.map(binding => binding.sliceVersion), [1, 2]);
  assert.equal(portableBefore.appliedJobHistory.find(job => job.jobId === cut.jobId).input.schemaVersion, 2);
  assert.deepEqual((await f.studio.queryAssemblies(assemblyRequest, owner)).assets, originalAssembly.assets);
  const currentClip = await f.studio.queryClips({ schemaVersion: 1, projectId, assetId: clip.assetId }, owner);
  assert.equal(currentClip.assets[0].assetVersion, 2);
  assert.equal(currentClip.assets[0].frameBindings[0].sliceBinding.sliceVersion, 2);

  const backupDirectory = join(f.root, 'animation-backup');
  const manifest = await createWorkspaceBackup({ projectStore: f.store, artifactStore: f.artifacts,
    destinationDirectory: backupDirectory, clock: () => '2026-09-10T14:00:00.000Z' });
  assert.equal(manifest.integrity.database.userVersion, 18);
  assert.equal(manifest.integrity.clips.ok, true);
  assert.equal(manifest.integrity.sliceRevisions.ok, true);
  const digests = new Set(manifest.artifacts.entries.map(entry => entry.digest));
  for (const digest of [f.slice.digest, revised.value.sliceBinding.digest, ...portableBefore.artifactDigests]) {
    assert(digests.has(digest), `Backup lost referenced CAS object ${digest}.`);
  }
  const verified = await verifyWorkspaceBackup(backupDirectory);
  assert.equal(verified.ok, true);
  const manifestBytes = await readFile(join(backupDirectory, 'workspace-manifest.json'));
  await assert.rejects(createWorkspaceBackup({ projectStore: f.store, artifactStore: f.artifacts,
    destinationDirectory: backupDirectory }), { code: 'EEXIST' });
  assert.deepEqual(await readFile(join(backupDirectory, 'workspace-manifest.json')), manifestBytes);

  // An existing live database is never a restore target; failure must preserve its ledger and CAS.
  await assert.rejects(restoreWorkspaceBackup({ backupDirectory,
    databaseDestination: join(f.root, 'studio.sqlite'), artifactDestination: join(f.root, 'artifacts') }), { code: 'EEXIST' });
  assert.deepEqual(await f.studio.readProjectTrusted(projectId), before);
  assert.deepEqual(projectSqlitePortableDocument({ projectStore: f.store, projectId }).project, portableBefore);
  const liveIntegrity = await verifyWorkspaceIntegrity({ projectStore: f.store, artifactStore: f.artifacts });
  assert.equal(liveIntegrity.ok, true, JSON.stringify(liveIntegrity));

  const restoredDirectory = join(f.root, 'restored-animation-copy');
  const databaseDestination = join(restoredDirectory, 'studio.sqlite');
  const artifactDestination = join(restoredDirectory, 'artifacts');
  await restoreWorkspaceBackup({ backupDirectory, databaseDestination, artifactDestination });
  const restoredStore = await SqliteProjectStore.open({ filename: databaseDestination, databaseFactory: nodeSqliteDatabaseFactory });
  try {
    const restoredArtifacts = new ContentAddressedArtifactStore({ rootDirectory: artifactDestination });
    const restoredService = new StudioService({ store: restoredStore });
    assert.deepEqual(await restoredService.readProjectTrusted(projectId), before);
    assert.deepEqual(projectSqlitePortableDocument({ projectStore: restoredStore, projectId }).project, portableBefore);
    const integrity = await verifyWorkspaceIntegrity({ projectStore: restoredStore, artifactStore: restoredArtifacts });
    assert.equal(integrity.ok, true, JSON.stringify(integrity));
    for (const entry of manifest.artifacts.entries) assert.equal((await restoredArtifacts.verify(entry.digest)).byteSize, entry.byteSize);
    assert.equal(new SqliteJobStore({ workspace: restoredStore.workspace }).get(projectId, cut.jobId).state, 'APPLIED');
    const restoredAssembly = await restoredService.queryAssemblies(assemblyRequest, owner);
    assert.deepEqual(restoredAssembly.assets, originalAssembly.assets);
    const oldClip = restoredAssembly.assets[0].leafAssets.find(asset => asset.contentKind === 'animation');
    assert.equal(oldClip.assetVersion, originalClip.assets[0].assetVersion);
    assert.equal(oldClip.frameBindings[0].sliceBinding.sliceVersion, 1);
    assert.deepEqual((await restoredService.queryClips({ schemaVersion: 1, projectId, assetId: clip.assetId }, owner)).assets, currentClip.assets);
    assert.deepEqual(await f.studio.readProjectTrusted(projectId), before, 'Restore-as-copy must not replace the live project.');
  } finally {
    // Close the restored writer before assemblyFixture closes its worker/store and removes the root (also on Windows).
    restoredStore.close();
  }
});
