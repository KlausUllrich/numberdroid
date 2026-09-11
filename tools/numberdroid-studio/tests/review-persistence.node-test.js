import assert from 'node:assert/strict';
import test from 'node:test';
import { assemblyFixture, assemblyPayload, owner, projectId } from './assembly-test-helpers.js';
import { clipPayload } from './clip-test-helpers.js';
import { verifyWorkspaceIntegrity, projectSqlitePortableDocument } from '../packages/persistence/src/index.js';
import { inspectReviewIntegrity } from '../packages/persistence/src/integrity/review-integrity.js';
import { createWorkspaceBackup, restoreWorkspaceBackup, verifyWorkspaceBackup, SqliteProjectStore, ContentAddressedArtifactStore } from '../packages/persistence/src/index.js';
import { StudioService } from '../packages/application/src/index.js';
import { nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';
import { join } from 'node:path';
import { SQLITE_MIGRATIONS, loadMigrationDefinitions } from '../packages/persistence/src/sqlite/migration-runner.js';

const group = f => ({ reviewId: 'review.mixed', expectedReviewVersion: 0, title: 'Machine and display', items: [
  { itemId: 'body', contentKind: 'image', payload: f.payload(), dependsOn: [] },
  { itemId: 'animation', contentKind: 'animation', payload: clipPayload(f.slice), dependsOn: [] },
  { itemId: 'machine', contentKind: 'assembly', payload: assemblyPayload(), dependsOn: ['body'] },
] });
const request = (version, selectedItemIds = ['body', 'animation', 'machine']) => ({ reviewId: 'review.mixed', expectedReviewVersion: version, selectedItemIds, confirmed: true });
const integrity = f => verifyWorkspaceIntegrity({ projectStore: f.store, artifactStore: f.artifacts });
const assertIntegrity = async f => { const result = await integrity(f); assert.equal(result.ok, true, JSON.stringify(result)); };

test('mixed Review is one atomic content revision, exact replay, immutable receipts and restart', { timeout: 120000 }, async context => {
  const f = await assemblyFixture(context);
  const before = await f.studio.readProjectTrusted(projectId);
  await f.execute('review.proposal.submit', group(f));
  assert.equal((await f.studio.readProjectTrusted(projectId)).snapshot.assetLibrary?.assets.length ?? 0, 0);
  await assertIntegrity(f);
  const command = await f.request('review.accept', request(1));
  const accepted = await f.studio.execute(command, owner);
  assert.equal((await f.studio.execute(command, owner)).replayed, true);
  const saved = await f.studio.readProjectTrusted(projectId);
  assert.equal(saved.revision, before.revision + 2);
  assert.equal(saved.snapshot.assetLibrary.assets.length, 1);
  assert.equal(saved.snapshot.clipLibrary.assets.length, 1);
  assert.equal(saved.snapshot.assemblyLibrary.assets.length, 1);
  assert.equal(accepted.value.accepted.length, 3);
  assert.equal(f.store.workspace.database.prepare('SELECT count(*) AS n FROM review_versions').get().n, 2);
  for (const kind of ['image', 'animation', 'assembly']) assert.equal(f.store.workspace.database.prepare(`SELECT count(*) AS n FROM review_${kind}_acceptances`).get().n, 1);
  await assertIntegrity(f);
  await f.restart();
  assert.deepEqual(await f.studio.readProjectTrusted(projectId), saved);
  await assertIntegrity(f);
  assert.throws(() => projectSqlitePortableDocument({ projectStore: f.store, projectId }), { code: 'REVIEW_BUNDLE_UNSUPPORTED' });
});

test('mixed Review acceptance faults roll back all typed rows, references, history and receipts', { timeout: 120000 }, async context => {
  const f = await assemblyFixture(context);
  await f.execute('review.proposal.submit', group(f));
  const before = await f.studio.readProjectTrusted(projectId);
  const tables = ['revisions', 'activity_events', 'asset_versions', 'clip_versions', 'assembly_versions', 'artifact_references', 'review_versions', 'review_items', 'review_dependencies', 'review_events', 'review_heads', 'review_image_acceptances', 'review_animation_acceptances', 'review_assembly_acceptances'];
  const counts = () => tables.map(table => [table, f.store.workspace.database.prepare(`SELECT count(*) AS n FROM ${table}`).get().n]);
  const original = counts();
  for (const point of ['after_review_version', 'after_review_items', 'after_review_event', 'after_review_references', 'after_review_image_asset', 'after_review_animation_asset', 'after_review_assembly_asset', 'after_review_acceptance', 'after_review_head', 'before_transaction_commit']) {
    f.fault(point);
    await assert.rejects(f.execute('review.accept', request(1)), /injected/);
    f.fault(null);
    assert.deepEqual(await f.studio.readProjectTrusted(projectId), before, point);
    assert.deepEqual(counts(), original, point);
    await assertIntegrity(f);
  }
});

test('partial acceptance survives feedback amendment and accepts exact remaining dependency later', { timeout: 120000 }, async context => {
  const f = await assemblyFixture(context);
  await f.execute('review.proposal.submit', group(f));
  await f.execute('review.accept', request(1, ['body']));
  await f.execute('review.feedback.save', { reviewId: 'review.mixed', expectedReviewVersion: 2, summary: 'Please soften the display.', itemComments: [], confirmed: true });
  await f.execute('review.feedback.save', { reviewId: 'review.mixed', expectedReviewVersion: 3, summary: 'Keep this version after all.', itemComments: [], confirmed: true });
  await f.execute('review.accept', request(4, ['animation', 'machine']));
  const current = await f.studio.readProjectTrusted(projectId);
  assert.equal(current.snapshot.assetLibrary.assets[0].assetVersion, 1);
  assert.equal(current.snapshot.reviewLibrary.groups[0].items.find(item => item.itemId === 'body').accepted.reviewVersion, 2);
  await assertIntegrity(f);
  const db = f.store.workspace.database;
  for (const tamper of [
    () => db.prepare('DELETE FROM review_dependencies').run(),
    () => db.prepare('DELETE FROM review_image_acceptances').run(),
    () => { db.exec('DROP TRIGGER review_events_immutable'); db.prepare("UPDATE review_events SET feedback_json='{}' WHERE review_version=3").run(); },
    () => db.prepare("DELETE FROM artifact_references WHERE owner_kind='review_version'").run(),
    () => db.prepare('UPDATE review_heads SET review_version=1').run(),
  ]) {
    db.exec('BEGIN'); try { tamper(); assert.equal(inspectReviewIntegrity(db).ok, false); } finally { db.exec('ROLLBACK'); }
  }
  await assertIntegrity(f);
});

test('Review SQL history is immutable and per-item agent admission/accounting survive replay', { timeout: 120000 }, async context => {
  const f = await assemblyFixture(context);
  const actor = { actor: { id: 'agent.review', kind: 'agent' }, taskId: 'task.review', grantId: 'grant.review', branchId: 'branch.main' };
  await f.execute('grant.issue', { grantId: actor.grantId, agentId: actor.actor.id, taskId: actor.taskId, branchId: actor.branchId,
    scopes: ['project.read', 'review.proposal.submit'], objectScopes: [{ kind: 'project', id: projectId }],
    budget: { maxCommands: 8, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 } });
  const command = await f.request('review.proposal.submit', group(f));
  await f.studio.execute(command, actor);
  assert.equal((await f.studio.execute(command, actor)).replayed, true);
  let saved = await f.studio.readProjectTrusted(projectId);
  assert.equal(saved.snapshot.grants.find(grant => grant.id === actor.grantId).usage.commands, 3);
  await assertIntegrity(f);
  const db = f.store.workspace.database;
  db.exec('BEGIN');
  try {
    const row = db.prepare("SELECT revision_number,revision_json FROM revisions WHERE command_type='review.proposal.submit'").get();
    const corrupt = JSON.parse(row.revision_json);
    corrupt.snapshot.grants.find(grant => grant.id === actor.grantId).usage.commands += 1;
    db.prepare('UPDATE revisions SET revision_json=? WHERE project_id=? AND revision_number=?').run(JSON.stringify(corrupt), projectId, row.revision_number);
    assert.equal(inspectReviewIntegrity(db).ok, false, 'Re-signed content does not excuse an incorrect agent command charge.');
  } finally { db.exec('ROLLBACK'); }
  await f.execute('review.accept', request(1));
  for (const table of ['review_versions', 'review_items', 'review_dependencies', 'review_events', 'review_image_acceptances', 'review_animation_acceptances', 'review_assembly_acceptances'])
    assert.throws(() => db.prepare(`UPDATE ${table} SET review_id=review_id`).run(), /immutable/, table);
  saved = await f.studio.readProjectTrusted(projectId);
  assert.equal(saved.snapshot.grants.find(grant => grant.id === actor.grantId).usage.commands, 3);
  await assertIntegrity(f);
  const originalHeadJson = db.prepare('SELECT head_snapshot_json FROM projects WHERE project_id=?').get(projectId).head_snapshot_json;
  try {
    const corrupt = structuredClone(saved.snapshot); delete corrupt.reviewLibrary;
    db.prepare('UPDATE projects SET head_snapshot_json=? WHERE project_id=?').run(JSON.stringify(corrupt), projectId);
    assert.throws(() => projectSqlitePortableDocument({ projectStore: f.store, projectId }), { code: 'REVIEW_BUNDLE_UNSUPPORTED' });
  } finally { db.prepare('UPDATE projects SET head_snapshot_json=? WHERE project_id=?').run(originalHeadJson, projectId); }
});

test('Review backup and restore-as-copy preserve feedback history, pending dependencies and accepted provenance', { timeout: 120000 }, async context => {
  const f = await assemblyFixture(context);
  await f.execute('review.proposal.submit', group(f));
  await f.execute('review.accept', request(1, ['body']));
  await f.execute('review.feedback.save', { reviewId: 'review.mixed', expectedReviewVersion: 2, summary: 'Continue with the remaining animation.', itemComments: [{ itemId: 'animation', text: 'Keep its exact cut.' }], confirmed: true });
  const before = await f.studio.readProjectTrusted(projectId);
  const backupDirectory = join(f.root, 'review-backup');
  const manifest = await createWorkspaceBackup({ projectStore: f.store, artifactStore: f.artifacts, destinationDirectory: backupDirectory });
  assert.equal(manifest.integrity.database.userVersion, 18);
  assert.equal(manifest.integrity.reviews.ok, true);
  assert.equal((await verifyWorkspaceBackup(backupDirectory)).ok, true);
  const destination = join(f.root, 'review-restored-copy');
  await restoreWorkspaceBackup({ backupDirectory, databaseDestination: join(destination, 'studio.sqlite'), artifactDestination: join(destination, 'artifacts') });
  const store = await SqliteProjectStore.open({ filename: join(destination, 'studio.sqlite'), databaseFactory: nodeSqliteDatabaseFactory });
  try {
    const service = new StudioService({ store });
    assert.deepEqual(await service.readProjectTrusted(projectId), before);
    const check = await verifyWorkspaceIntegrity({ projectStore: store, artifactStore: new ContentAddressedArtifactStore({ rootDirectory: join(destination, 'artifacts') }) });
    assert.equal(check.ok, true, JSON.stringify(check));
    const query = await service.queryReviews({ schemaVersion: 1, projectId, reviewId: 'review.mixed', includeHistory: true }, owner);
    assert.equal(query.groups[0].feedback.summary, 'Continue with the remaining animation.');
    assert.equal(query.groups[0].items.find(item => item.itemId === 'body').accepted.assetVersion, 1);
  } finally { store.close(); }
  assert.deepEqual(await f.studio.readProjectTrusted(projectId), before);
});

test('migration18 rollback preserves existing schema17 history and frozen migration checksums', { timeout: 120000 }, async context => {
  const f = await assemblyFixture(context);
  await f.execute('asset.save', f.payload());
  await f.execute('clip.save', clipPayload(f.slice));
  const definitions = await loadMigrationDefinitions();
  assert.equal(definitions.at(-1).version, 18);
  const history = f.store.workspace.database.prepare('SELECT revision_json FROM revisions ORDER BY revision_number').all().map(row => row.revision_json);
  for (const point of ['before_migration_18', 'after_migration_18']) {
    const filename = join(f.root, `${point}.sqlite`);
    await f.store.backupTo(filename);
    const legacy = nodeSqliteDatabaseFactory(filename);
    try {
      for (const table of ['review_image_acceptances', 'review_animation_acceptances', 'review_assembly_acceptances', 'review_events', 'review_dependencies', 'review_items', 'review_heads', 'review_versions']) legacy.exec(`DROP TABLE ${table}`);
      legacy.exec('DELETE FROM schema_migrations WHERE version=18; PRAGMA user_version=17');
    } finally { legacy.close(); }
    await assert.rejects(SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory, faultInjector(actual) { if (actual === point) throw new Error(point); } }), new RegExp(point));
    const failed = nodeSqliteDatabaseFactory(filename);
    try {
      assert.equal(failed.prepare('PRAGMA user_version').get().user_version, 17);
      assert.equal(failed.prepare("SELECT count(*) AS n FROM sqlite_schema WHERE name='review_versions'").get().n, 0);
      assert.deepEqual(failed.prepare('SELECT revision_json FROM revisions ORDER BY revision_number').all().map(row => row.revision_json), history);
      assert.deepEqual(failed.prepare('SELECT version,checksum FROM schema_migrations ORDER BY version').all().map(row => ({ ...row })), SQLITE_MIGRATIONS.slice(0, 17).map(({ version, checksum }) => ({ version, checksum })));
    } finally { failed.close(); }
    const resumed = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
    try {
      assert.equal(resumed.schemaVersion, 18);
      assert.deepEqual(resumed.workspace.database.prepare('SELECT revision_json FROM revisions ORDER BY revision_number').all().map(row => row.revision_json), history);
      assert.equal(resumed.workspace.database.prepare("SELECT strict FROM pragma_table_list WHERE name='review_versions'").get().strict, 1);
    } finally { resumed.close(); }
  }
});
