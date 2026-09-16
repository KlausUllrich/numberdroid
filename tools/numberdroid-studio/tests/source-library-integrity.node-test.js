import assert from 'node:assert/strict';
import test from 'node:test';
import { join } from 'node:path';
import { assemblyFixture, owner, projectId } from './assembly-test-helpers.js';
import { nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';
import { canonicalJson, fingerprint } from '../packages/application/src/value-utils.js';
import { SourceLibraryOperationStore } from '../packages/persistence/src/sqlite/source-library-operation-store.js';
import { inspectSourceLibraryIntegrity } from '../packages/persistence/src/integrity/source-library-integrity.js';
import { createWorkspaceBackup, restoreWorkspaceBackup, verifyWorkspaceIntegrity, SqliteProjectStore,
  ContentAddressedArtifactStore, projectSqlitePortableDocument, createSqliteProjectBundle, importSqliteProjectBundle } from '../packages/persistence/src/index.js';

async function fixture(context) {
  const f = await assemblyFixture(context);
  await f.execute('asset.save', f.payload());
  const project = await f.studio.readProjectTrusted(projectId), asset = project.snapshot.assetLibrary.assets[0];
  const receipt = { schemaVersion: 1, projectId, atlasId: 'atlas.fixture', revision: project.revision,
    status: 'SAVED', summary: { created: 1, updated: 0, unchanged: 0, skipped: 0 },
    items: [{ rectangleId: 'rect.fixture', status: 'created', assetId: asset.assetId,
      assetVersion: asset.assetVersion, metadataVersion: asset.metadataVersion, name: asset.name, kind: asset.kind,
      sliceBinding: asset.sliceBinding, findings: asset.findings }], replayed: false };
  const operation = { projectId, operationKey: 'operation.integrity', actorId: owner.actor.id, atlasId: 'atlas.fixture',
    request: { atlasId: 'atlas.fixture', expectedRevision: project.revision - 1, items: [{ rectangleId: 'rect.fixture', destination: 'new' }] },
    receipt, firstRevision: project.revision, lastRevision: project.revision, createdAt: new Date().toISOString() };
  f.store.workspace.transaction(db => new SourceLibraryOperationStore({ workspace: f.store.workspace }).recordInTransaction(db, operation));
  return { f, receipt, operation };
}

test('Source Library receipts close exact owner revisions, summaries and immutable image pins', { timeout: 30000 }, async context => {
  const { f } = await fixture(context), db = f.store.workspace.database;
  assert.deepEqual(inspectSourceLibraryIntegrity(db), { ok: true, operationCount: 1, findings: [] });
  const result = await verifyWorkspaceIntegrity({ projectStore: f.store, artifactStore: f.artifacts });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.sourceLibrary.operationCount, 1);
  assert.throws(() => db.exec('UPDATE source_library_operations SET actor_id=actor_id'), /immutable/);
  assert.throws(() => db.exec('DELETE FROM source_library_operations'), /retained history/);
  for (const mutate of [
    receipt => { receipt.summary.created = 2; },
    receipt => { receipt.items[0].assetVersion = 999; },
    receipt => { receipt.items[0].sliceBinding.digest = '0'.repeat(64); },
    receipt => { receipt.items[0].rectangleId = 'foreign'; },
    receipt => { receipt.status = 'UNCHANGED'; },
  ]) {
    db.exec('BEGIN');
    try {
      db.exec('DROP TRIGGER source_library_operations_immutable');
      const row = db.prepare('SELECT receipt_json FROM source_library_operations').get(), receipt = JSON.parse(row.receipt_json);
      mutate(receipt);
      db.prepare('UPDATE source_library_operations SET receipt_json=?,receipt_fingerprint=?').run(canonicalJson(receipt), fingerprint(receipt));
      assert.equal(inspectSourceLibraryIntegrity(db).ok, false, 'Re-signing a false receipt must not hide invalid semantics.');
    } finally { db.exec('ROLLBACK'); }
  }
  await f.restart();
  assert.deepEqual(inspectSourceLibraryIntegrity(f.store.workspace.database), { ok: true, operationCount: 1, findings: [] });
});

test('Workspace backup preserves Library replay records; portable content deliberately excludes their authority', { timeout: 60000 }, async context => {
  const { f, receipt } = await fixture(context);
  const backupDirectory = join(f.root, 'source-library-backup'), restored = join(f.root, 'restored');
  const manifest = await createWorkspaceBackup({ projectStore: f.store, artifactStore: f.artifacts, destinationDirectory: backupDirectory });
  assert.equal(manifest.integrity.sourceLibrary.operationCount, 1);
  await restoreWorkspaceBackup({ backupDirectory, databaseDestination: join(restored, 'studio.sqlite'), artifactDestination: join(restored, 'artifacts') });
  const store = await SqliteProjectStore.open({ filename: join(restored, 'studio.sqlite'), databaseFactory: nodeSqliteDatabaseFactory });
  try {
    assert.deepEqual(new SourceLibraryOperationStore({ workspace: store.workspace }).get(projectId, 'operation.integrity').receipt, receipt);
    const result = await verifyWorkspaceIntegrity({ projectStore: store, artifactStore: new ContentAddressedArtifactStore({ rootDirectory: join(restored, 'artifacts') }) });
    assert.equal(result.ok, true, JSON.stringify(result));
  } finally { store.close(); }
  const portable = projectSqlitePortableDocument({ projectStore: f.store, projectId });
  assert.equal(portable.assetLibrary.versions.length, 1);
  assert.equal(JSON.stringify(portable).includes('operation.integrity'), false);
  const bundleDirectory = join(f.root, 'portable-bundle'), importedDirectory = join(f.root, 'imported');
  await createSqliteProjectBundle({ projectStore: f.store, artifactStore: f.artifacts, projectId, destinationDirectory: bundleDirectory });
  await importSqliteProjectBundle({ bundleDirectory, destinationDirectory: importedDirectory, databaseFactory: nodeSqliteDatabaseFactory });
  const imported = await SqliteProjectStore.open({ filename: join(importedDirectory, 'studio.sqlite'), databaseFactory: nodeSqliteDatabaseFactory });
  try {
    assert.deepEqual(projectSqlitePortableDocument({ projectStore: imported, projectId }), portable);
    assert.equal(imported.workspace.database.prepare('SELECT count(*) AS n FROM source_library_operations').get().n, 0);
  } finally { imported.close(); }
});
