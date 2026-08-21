import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StudioService } from '../packages/application/src/index.js';
import {
  ContentAddressedArtifactStore,
  SqliteArtifactMetadataStore,
  SqliteProjectStore,
  createWorkspaceBackup,
  restoreWorkspaceBackup,
  verifyWorkspaceBackup,
} from '../packages/persistence/src/index.js';
import { PROJECT_ID, createHarness, createProject } from './test-helpers.js';
import { nodeSqliteDatabaseFactory, pngHeader } from './persistence-test-helpers.js';

test('workspace backup and restore preserve a checkpointed SQLite ledger plus referenced CAS objects', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'numberdroid-workspace-backup-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const liveStore = await SqliteProjectStore.open({
    filename: join(root, 'live', 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  context.after(() => liveStore.close());
  const { studio } = createHarness(liveStore);
  await createProject(studio);

  const liveArtifacts = new ContentAddressedArtifactStore({ rootDirectory: join(root, 'live', 'artifacts') });
  const artifact = await liveArtifacts.ingest(pngHeader({ width: 320, height: 240, tail: 'backup' }), {
    mediaType: 'image/png',
  });
  new SqliteArtifactMetadataStore({ workspace: liveStore.workspace }).registerAndReference(artifact, {
    projectId: PROJECT_ID,
    ownerKind: 'source',
    ownerId: 'source.backup',
    createdRevision: 1,
  });

  const backupDirectory = join(root, 'backups', 'backup-001');
  const manifest = await createWorkspaceBackup({
    projectStore: liveStore,
    artifactStore: liveArtifacts,
    destinationDirectory: backupDirectory,
    clock: () => '2026-08-21T12:00:00.000Z',
  });
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.integrity.ok, true);
  assert.deepEqual(manifest.artifacts.entries, [{ digest: artifact.digest, byteSize: artifact.byteSize }]);
  assert.equal((await verifyWorkspaceBackup(backupDirectory)).ok, true);
  await assert.rejects(
    createWorkspaceBackup({ projectStore: liveStore, artifactStore: liveArtifacts, destinationDirectory: backupDirectory }),
    (error) => error.code === 'EEXIST',
  );

  const restoredDatabase = join(root, 'restored', 'studio.sqlite');
  const restoredArtifactsPath = join(root, 'restored', 'artifacts');
  await restoreWorkspaceBackup({
    backupDirectory,
    databaseDestination: restoredDatabase,
    artifactDestination: restoredArtifactsPath,
  });
  const restoredStore = await SqliteProjectStore.open({
    filename: restoredDatabase,
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  context.after(() => restoredStore.close());
  const restoredProject = await new StudioService({ store: restoredStore }).readProjectTrusted(PROJECT_ID);
  assert.equal(restoredProject.revision, 1);
  assert.equal(restoredStore.integrityCheck().ok, true);
  const restoredArtifacts = new ContentAddressedArtifactStore({ rootDirectory: restoredArtifactsPath });
  assert.equal((await restoredArtifacts.verify(artifact.digest)).byteSize, artifact.byteSize);
  assert.deepEqual(
    [...new SqliteArtifactMetadataStore({ workspace: restoredStore.workspace }).listReferencedDigests()],
    [artifact.digest],
  );
});
