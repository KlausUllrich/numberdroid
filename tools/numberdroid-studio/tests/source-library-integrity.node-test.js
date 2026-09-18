import assert from 'node:assert/strict';
import test from 'node:test';
import { join } from 'node:path';
import { assemblyFixture, owner, projectId } from './assembly-test-helpers.js';
import { nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';
import { canonicalJson, fingerprint } from '../packages/application/src/value-utils.js';
import { SourceLibraryOperationStore } from '../packages/persistence/src/sqlite/source-library-operation-store.js';
import { SourceLibraryService } from '../packages/application/src/index.js';
import { AtlasPreviewWorker } from '../apps/studio-server/src/atlas-preview-worker.js';
import { inspectSourceLibraryIntegrity } from '../packages/persistence/src/integrity/source-library-integrity.js';
import { createWorkspaceBackup, restoreWorkspaceBackup, verifyWorkspaceIntegrity, SqliteProjectStore,
  ContentAddressedArtifactStore, SqliteJobStore, SqliteArtifactMetadataStore, projectSqlitePortableDocument, createSqliteProjectBundle, importSqliteProjectBundle } from '../packages/persistence/src/index.js';

function serviceFor(store) {
  return new SourceLibraryService({ projectStore: store, jobStore: new SqliteJobStore({ workspace: store.workspace }),
    operationStore: new SourceLibraryOperationStore({ workspace: store.workspace }) });
}

async function fixture(context) {
  const f = await assemblyFixture(context);
  const service = serviceFor(f.store), bootstrap = await service.bootstrap({ projectId, atlasId: 'atlas.fixture' }, owner);
  const { assetId, name, kind, metadata } = f.payload();
  const request = { projectId, atlasId: 'atlas.fixture', expectedRevision: bootstrap.revision,
    expectedAtlasVersion: bootstrap.expectedAtlasVersion, expectedAtlasFingerprint: bootstrap.expectedAtlasFingerprint,
    input: bootstrap.savedInput, items: [{ rectangleId: 'rect.fixture', destination: { operation: 'create', assetId, name, kind, metadata } }],
    idempotencyKey: 'operation.integrity' };
  const receipt = await service.save(request, owner);
  return { f, receipt, request };
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
  db.exec('BEGIN');
  try {
    db.exec('DROP TRIGGER source_library_operations_no_delete');
    db.exec('DELETE FROM source_library_operations');
    assert.equal(inspectSourceLibraryIntegrity(db).ok, false, 'A workflow command cannot lose its receipt.');
  } finally { db.exec('ROLLBACK'); }
  await f.restart();
  assert.deepEqual(inspectSourceLibraryIntegrity(f.store.workspace.database), { ok: true, operationCount: 1, findings: [] });
});

test('Workspace backup preserves Library replay records; portable content deliberately excludes their authority', { timeout: 60000 }, async context => {
  const { f, receipt, request } = await fixture(context);
  const backupDirectory = join(f.root, 'source-library-backup'), restored = join(f.root, 'restored');
  const manifest = await createWorkspaceBackup({ projectStore: f.store, artifactStore: f.artifacts, destinationDirectory: backupDirectory });
  assert.equal(manifest.integrity.sourceLibrary.operationCount, 1);
  await restoreWorkspaceBackup({ backupDirectory, databaseDestination: join(restored, 'studio.sqlite'), artifactDestination: join(restored, 'artifacts') });
  const store = await SqliteProjectStore.open({ filename: join(restored, 'studio.sqlite'), databaseFactory: nodeSqliteDatabaseFactory });
  try {
    assert.deepEqual(new SourceLibraryOperationStore({ workspace: store.workspace }).get(projectId, 'operation.integrity').receipt, receipt);
    assert.deepEqual(await serviceFor(store).save(request, owner), { ...receipt, replayed: true });
    const result = await verifyWorkspaceIntegrity({ projectStore: store, artifactStore: new ContentAddressedArtifactStore({ rootDirectory: join(restored, 'artifacts') }) });
    assert.equal(result.ok, true, JSON.stringify(result));
  } finally { store.close(); }
  const portable = projectSqlitePortableDocument({ projectStore: f.store, projectId });
  assert.equal(portable.project.assetLibrary.versions.length, 1);
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

test('generated all-skipped work retains its cut commit; saved all-skipped work is unchanged', { timeout: 30000 }, async context => {
  const { f } = await fixture(context), atlasId = 'atlas.skipped', jobId = 'job.skipped';
  await f.execute('atlas.define.rects', { atlasId, sourceId: 'source.fixture', name: 'Skipped Library destinations', expectedAtlasVersion: 0,
    rectangles: [{ rectangleId: 'rect.skipped', name: 'Skip this image', x: 0, y: 0, width: 8, height: 8, included: true,
      pivot: null, transparentPaddingPolicy: 'preserve_exact_rect', replacesSliceId: null, expectedSliceVersion: null }] });
  const service = serviceFor(f.store), bootstrap = await service.bootstrap({ projectId, atlasId }, owner);
  await f.execute('atlas.preview.slices', { atlasId, expectedAtlasVersion: bootstrap.expectedAtlasVersion,
    expectedDefinitionFingerprint: bootstrap.expectedAtlasFingerprint, jobId });
  const worker = new AtlasPreviewWorker({ jobStore: new SqliteJobStore({ workspace: f.store.workspace }), artifactStore: f.artifacts,
    artifactMetadataStore: new SqliteArtifactMetadataStore({ workspace: f.store.workspace }), workerId: 'worker.skipped' });
  try { await worker.drain(); } finally { await worker.stop(); }
  const request = { projectId, atlasId, expectedRevision: (await f.studio.readProjectTrusted(projectId)).revision,
    expectedAtlasVersion: bootstrap.expectedAtlasVersion, expectedAtlasFingerprint: bootstrap.expectedAtlasFingerprint,
    input: { mode: 'generated', jobId }, items: [{ rectangleId: 'rect.skipped', destination: { operation: 'skip' } }], idempotencyKey: 'skip.generated' };
  const receipt = await service.save(request, owner);
  assert.equal(receipt.status, 'SAVED');
  assert.deepEqual(receipt.summary, { created: 0, updated: 0, unchanged: 0, skipped: 1 });
  const saved = await service.bootstrap({ projectId, atlasId }, owner);
  const unchanged = await service.save({ ...request, expectedRevision: saved.revision, input: saved.savedInput, idempotencyKey: 'skip.saved' }, owner);
  assert.equal(unchanged.status, 'UNCHANGED');
  assert.equal(unchanged.revision, receipt.revision);
  assert.deepEqual(inspectSourceLibraryIntegrity(f.store.workspace.database), { ok: true, operationCount: 3, findings: [] });
  assert.equal((await verifyWorkspaceIntegrity({ projectStore: f.store, artifactStore: f.artifacts })).ok, true);
});
