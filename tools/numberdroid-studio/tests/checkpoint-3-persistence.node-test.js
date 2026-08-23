import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StudioService } from '../packages/application/src/index.js';
import {
  ContentAddressedArtifactStore,
  SqliteProjectStore,
  createSqliteProjectBundle,
  importSqliteProjectBundle,
  loadMigrationDefinitions,
  projectSqlitePortableDocument,
  verifyWorkspaceIntegrity,
} from '../packages/persistence/src/index.js';
import { OWNER_CONTEXT, PROJECT_ID, command, createHarness, createProject } from './test-helpers.js';
import { nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';

async function tempDatabase(context, prefix = 'numberdroid-3-persistence-') {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  context.after(() => rm(directory, { recursive: true, force: true }));
  return join(directory, 'studio.sqlite');
}

async function createV9Database(filename) {
  const migrations = (await loadMigrationDefinitions()).filter(({ version }) => version <= 9);
  const database = nodeSqliteDatabaseFactory(filename);
  database.exec('PRAGMA foreign_keys = ON');
  database.exec(`CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL, applied_at TEXT NOT NULL) STRICT`);
  for (const migration of migrations) {
    database.exec('BEGIN EXCLUSIVE');
    database.exec(migration.sql);
    database.prepare('INSERT INTO schema_migrations(version, name, checksum, applied_at) VALUES (?, ?, ?, ?)')
      .run(migration.version, migration.name, migration.checksum, '2026-08-22T00:00:00.000Z');
    database.exec(`PRAGMA user_version = ${migration.version}`);
    database.exec('COMMIT');
  }
  database.close();
}

function archetypeCommand(expectedVersion = 1) {
  return command({
    commandId: `cmd.room.archetype.${expectedVersion}`, idempotencyKey: `idem.room.archetype.${expectedVersion}`,
    type: 'room.archetype.create', expectedVersion,
    payload: {
      roomArchetypeId: 'archetype.persistence', kind: 'room', displayName: 'Persistence Room', tags: ['domestic'],
      dimensionPolicy: { width: { min: 3, preferred: 10, max: 64 }, height: { min: 3, preferred: 8, max: 64 } },
      structuralBands: { left: 0, right: 0, top: 0, bottom: 0 }, orientation: 'any',
      connectorPolicy: { min: 1, max: 8, requiredSides: [] }, allowedAssetKinds: ['surface', 'prop', 'item'],
      allowedTags: [], requiredTags: [], rationality: 'domestic',
      governingRuleRefs: [{ ruleId: 'gd.function-first', summary: 'Function before form.' }],
    },
  });
}

function variantCommand(expectedVersion = 2) {
  return command({
    commandId: `cmd.room.variant.${expectedVersion}`, idempotencyKey: `idem.room.variant.${expectedVersion}`,
    type: 'room.variant.create', expectedVersion,
    payload: {
      roomVariantId: 'room.persistence', roomArchetypeId: 'archetype.persistence', archetypeVersion: 1,
      displayName: 'Persistence Room', width: 4, height: 3,
      intentTrace: [
        { layer: 'game_design', ruleId: 'gd.function-first', summary: 'Function before form.', disposition: 'governing' },
        { layer: 'level_design', ruleId: 'ld.distinct', summary: 'Room and hall remain distinct.', disposition: 'governing' },
        { layer: 'room_design', ruleId: 'rd.use', summary: 'Supports visible use.', disposition: 'governing' },
      ],
      connectors: [{ connectorId: 'connector.west', side: 'west', offset: 1, width: 1, kind: 'standard-door', clearanceInside: 1, clearanceOutside: 1, required: true, tags: [], compatibilityProfile: 'door.standard' }],
      placements: [],
    },
  });
}

test('schema v11 keeps the fixed v10 room schema and migration v9 pinned', async (context) => {
  const filename = await tempDatabase(context);
  const store = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  context.after(() => store.close());
  const migrations = await loadMigrationDefinitions();
  assert.equal(migrations.at(-1).version, 11);
  assert.equal(migrations.at(-1).checksum, 'f6ed508f3098e6cdeb3dca2af0a9be7baca12c18fcd9d518f75f4f353242639d');
  assert.equal(migrations.find(({ version }) => version === 10).checksum, '99d12a3a7ee7572dd9386bd183fb847631ceab0490b0190e3ba5f1b339cfd40e');
  assert.equal(migrations.find(({ version }) => version === 9).checksum, 'e387c3e56fb0bb03bd14743c6a7c7a6baad230c02dde8f158e485e25776e7175');
  const tables = store.workspace.database.prepare(`
    SELECT name, strict FROM pragma_table_list
    WHERE name LIKE 'room_%' ORDER BY name
  `).all();
  assert.deepEqual(tables.map(({ name }) => name), [
    'room_archetype_governing_rules', 'room_archetype_heads', 'room_archetype_versions',
    'room_placement_proposal_applications', 'room_placement_proposal_decisions',
    'room_placement_proposal_findings', 'room_placement_proposal_items', 'room_placement_proposals',
    'room_variant_connectors', 'room_variant_findings', 'room_variant_heads',
    'room_variant_intent', 'room_variant_placements', 'room_variant_versions',
    'room_variant_warning_dispositions',
  ]);
  assert.ok(tables.every(({ strict }) => Number(strict) === 1));
  assert.equal(store.supportsAtomicRoomDesigner, true);
  assert.equal(store.integrityCheck().userVersion, 11);
});

test('a v9 workspace rolls migration 0010 back completely and resumes safely', async (context) => {
  const filename = await tempDatabase(context, 'numberdroid-3-v9-v10-');
  await createV9Database(filename);
  await assert.rejects(SqliteProjectStore.open({
    filename, databaseFactory: nodeSqliteDatabaseFactory,
    faultInjector(point) { if (point === 'after_migration_10') throw new Error('simulated v10 migration crash'); },
  }), /simulated v10 migration crash/);
  const interrupted = nodeSqliteDatabaseFactory(filename);
  assert.equal(Number(interrupted.prepare('PRAGMA user_version').get().user_version), 9);
  assert.equal(interrupted.prepare("SELECT count(*) AS count FROM sqlite_schema WHERE type = 'table' AND name = 'room_variant_versions'").get().count, 0);
  interrupted.close();
  const resumed = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  context.after(() => resumed.close());
  assert.equal(resumed.integrityCheck().userVersion, 11);
  assert.equal(resumed.workspace.database.prepare("SELECT count(*) AS count FROM sqlite_schema WHERE type = 'table' AND name = 'room_variant_versions'").get().count, 1);
});

test('room semantic writes, normalized records, exact asset FKs, immutability, restart, and rebuild hold', async (context) => {
  const filename = await tempDatabase(context, 'numberdroid-3-normalized-');
  let store = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  context.after(() => store?.close());
  let studio = new StudioService({ store, clock: () => '2026-08-22T12:00:00.000Z' });
  await createProject(studio);
  await studio.execute(archetypeCommand(), OWNER_CONTEXT);
  await studio.execute(variantCommand(), OWNER_CONTEXT);
  const db = store.workspace.database;
  assert.equal(db.prepare('SELECT count(*) AS count FROM room_archetype_versions').get().count, 1);
  assert.equal(db.prepare('SELECT count(*) AS count FROM room_archetype_governing_rules').get().count, 1);
  assert.equal(db.prepare('SELECT count(*) AS count FROM room_variant_versions').get().count, 1);
  assert.equal(db.prepare('SELECT count(*) AS count FROM room_variant_intent').get().count, 3);
  assert.equal(db.prepare('SELECT count(*) AS count FROM room_variant_connectors').get().count, 1);
  assert.equal(db.prepare('SELECT count(*) AS count FROM room_variant_findings WHERE severity = \'ERROR\'').get().count, 1);
  assert.throws(() => db.prepare("UPDATE room_variant_versions SET display_name = 'tampered' WHERE project_id = ? AND room_variant_id = 'room.persistence'").run(PROJECT_ID), /room_variant_versions are immutable/);
  assert.throws(() => db.prepare(`
    INSERT INTO room_variant_placements(
      project_id, room_variant_id, variant_version, placement_id, placement_order,
      asset_id, asset_version, metadata_version, layer, anchor_x, anchor_y,
      rotation, placement_json
    ) VALUES (?, 'room.persistence', 1, 'missing.asset', 0, 'asset.missing', 1, 1,
      'SET_DRESSING', 0, 0, 0, '{}')
  `).run(PROJECT_ID), /foreign key constraint failed/i);
  store.close();
  store = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  studio = new StudioService({ store });
  assert.equal((await studio.queryRooms({ schemaVersion: 1, projectId: PROJECT_ID, roomVariantId: 'room.persistence', includeVersions: true }, OWNER_CONTEXT)).variants[0].versions.length, 1);
  await store.rebuildProjectProjection(PROJECT_ID);
  assert.equal(store.workspace.database.prepare("SELECT variant_version FROM room_variant_heads WHERE project_id = ? AND room_variant_id = 'room.persistence'").get(PROJECT_ID).variant_version, 1);
  const artifacts = new ContentAddressedArtifactStore({ rootDirectory: `${filename}.artifacts` });
  await artifacts.initialize();
  assert.equal((await verifyWorkspaceIntegrity({ projectStore: store, artifactStore: artifacts })).rooms.ok, true);
  store.workspace.database.prepare("UPDATE room_variant_heads SET display_name = 'tampered head' WHERE project_id = ? AND room_variant_id = 'room.persistence'").run(PROJECT_ID);
  const tampered = await verifyWorkspaceIntegrity({ projectStore: store, artifactStore: artifacts });
  assert.equal(tampered.rooms.ok, false);
  assert.ok(tampered.rooms.findings.some(({ code }) => code === 'ROOM_HEAD_MISMATCH'));
});

test('every room append stage shares the semantic revision transaction', async (context) => {
  const filename = await tempDatabase(context, 'numberdroid-3-fault-');
  let armedFault = null;
  const store = await SqliteProjectStore.open({
    filename, databaseFactory: nodeSqliteDatabaseFactory,
    faultInjector(point) { if (point === armedFault) throw new Error(`simulated ${point}`); },
  });
  context.after(() => store.close());
  const { studio } = createHarness(store);
  await createProject(studio);
  await studio.execute(archetypeCommand(), OWNER_CONTEXT);
  armedFault = 'after_room_variant_connector_insert';
  await assert.rejects(studio.execute(variantCommand(), OWNER_CONTEXT), /simulated after_room_variant_connector_insert/);
  assert.equal((await studio.readProjectTrusted(PROJECT_ID)).revision, 2);
  assert.equal(store.workspace.database.prepare('SELECT count(*) AS count FROM room_variant_versions').get().count, 0);
  assert.equal(store.workspace.database.prepare('SELECT count(*) AS count FROM room_variant_connectors').get().count, 0);
  armedFault = null;
  const committed = await studio.execute(variantCommand(), OWNER_CONTEXT);
  assert.equal(committed.revision, 3);
  const replayed = await studio.execute({ ...variantCommand(), commandId: 'cmd.room.variant.replay' }, OWNER_CONTEXT);
  assert.equal(replayed.replayed, true);
  assert.equal(store.workspace.database.prepare('SELECT count(*) AS count FROM room_variant_versions').get().count, 1);
});

test('portable schema v2 round-trips normalized room semantics without changing roomless v1 bundles', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-3-bundle-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const store = await SqliteProjectStore.open({ filename: join(directory, 'source.sqlite'), databaseFactory: nodeSqliteDatabaseFactory });
  context.after(() => store.close());
  const studio = new StudioService({ store, clock: () => '2026-08-22T12:00:00.000Z' });
  await createProject(studio); await studio.execute(archetypeCommand(), OWNER_CONTEXT); await studio.execute(variantCommand(), OWNER_CONTEXT);
  const artifactStore = new ContentAddressedArtifactStore({ rootDirectory: join(directory, 'source-artifacts') }); await artifactStore.initialize();
  const sourcePortable = projectSqlitePortableDocument({ projectStore: store, projectId: PROJECT_ID }).project;
  assert.equal(sourcePortable.schemaVersion, 2); assert.equal(sourcePortable.roomLibrary.variants[0].versions.length, 1);
  await createSqliteProjectBundle({ destinationDirectory: join(directory, 'bundle'), projectStore: store, artifactStore, projectId: PROJECT_ID });
  await importSqliteProjectBundle({ bundleDirectory: join(directory, 'bundle'), destinationDirectory: join(directory, 'imported'), databaseFactory: nodeSqliteDatabaseFactory });
  const imported = await SqliteProjectStore.open({ filename: join(directory, 'imported', 'studio.sqlite'), databaseFactory: nodeSqliteDatabaseFactory });
  context.after(() => imported.close());
  assert.deepEqual(projectSqlitePortableDocument({ projectStore: imported, projectId: PROJECT_ID }).project, sourcePortable);
  assert.equal(imported.workspace.database.prepare('SELECT count(*) AS count FROM room_variant_versions').get().count, 1);
  assert.equal(imported.workspace.database.prepare('SELECT count(*) AS count FROM room_variant_findings').get().count, 1);
});
