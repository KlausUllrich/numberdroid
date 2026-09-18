import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StudioService } from '../packages/application/src/index.js';
import { SqliteProjectStore } from '../packages/persistence/src/index.js';
import { SqliteWorkspace } from '../packages/persistence/src/sqlite/sqlite-workspace.js';
import { WorkspaceWriterLock } from '../packages/persistence/src/sqlite/workspace-writer-lock.js';
import { SQLITE_MIGRATIONS, loadMigrationDefinitions } from '../packages/persistence/src/sqlite/migration-runner.js';
import { nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';

function rows(database, tables) {
  return Object.fromEntries(tables.map(name => [name, database.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}"`)
    .all().map(row => JSON.stringify(row)).sort()]));
}

for (const point of ['before_migration_19', 'after_migration_19']) {
  test(`migration19 ${point} rolls back DDL and data, releases the writer, and resumes`, { timeout: 60_000 }, async t => {
    const root = await mkdtemp(join(tmpdir(), 'studio-source-library-migration-'));
    let store = null, database = null, writerLock = null;
    t.after(async () => { store?.close(); database?.close(); writerLock?.close(); await rm(root, { recursive: true, force: true }); });
    const filename = join(root, 'studio.sqlite');
    await loadMigrationDefinitions(); // Verifies the frozen SQL checksums, not just ledger strings.
    // Stop the normal migration runner at 18, never manufacture a downgrade.
    await assert.rejects(SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory,
      faultInjector(actual) { if (actual === 'before_migration_19') throw new Error('seed schema18'); } }), /seed schema18/);
    writerLock = await WorkspaceWriterLock.acquire({ filename, databaseFactory: nodeSqliteDatabaseFactory });
    database = nodeSqliteDatabaseFactory(filename); database.exec('PRAGMA foreign_keys=ON');
    store = new SqliteProjectStore({ workspace: new SqliteWorkspace({ database, filename, writerLock }) });
    database = null; writerLock = null; // The workspace now owns both handles.
    const studio = new StudioService({ store });
    const context = { actor: { id: 'owner.migration', kind: 'human', displayName: 'Migration fixture' } };
    await studio.execute({ schemaVersion: 1, commandId: 'cmd.migration.project', idempotencyKey: 'idem.migration.project',
      type: 'project.create', projectId: 'project.migration', baseRevision: 0, expectedVersion: 0,
      payload: { name: 'Retained schema18 project', description: 'Migration evidence', ownerId: context.actor.id } }, context);
    const retained = await store.loadProject('project.migration');
    const tables = store.workspace.database.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all().map(row => row.name);
    const before = rows(store.workspace.database, tables);
    store.close(); store = null;
    await assert.rejects(SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory,
      faultInjector(actual) { if (actual === point) throw new Error(point); } }), new RegExp(point));
    database = nodeSqliteDatabaseFactory(filename);
    assert.equal(database.prepare('PRAGMA user_version').get().user_version, 18);
    assert.equal(database.prepare("SELECT count(*) AS n FROM sqlite_schema WHERE name LIKE 'source_library_operations%'").get().n, 0);
    assert.deepEqual(rows(database, tables), before);
    assert.deepEqual(database.prepare('SELECT version,checksum FROM schema_migrations ORDER BY version').all().map(row => ({ ...row })),
      SQLITE_MIGRATIONS.slice(0, 18).map(({ version, checksum }) => ({ version, checksum })));
    database.close(); database = null;
    store = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
    assert.equal(store.schemaVersion, 19);
    assert.deepEqual(await store.loadProject('project.migration'), retained);
    assert.deepEqual(rows(store.workspace.database, tables.filter(name => name !== 'schema_migrations')),
      Object.fromEntries(Object.entries(before).filter(([name]) => name !== 'schema_migrations')));
    assert.deepEqual(store.workspace.database.prepare('SELECT version,checksum FROM schema_migrations WHERE version<=18 ORDER BY version').all().map(row => ({ ...row })),
      SQLITE_MIGRATIONS.slice(0, 18).map(({ version, checksum }) => ({ version, checksum })));
    assert.equal(store.workspace.database.prepare("SELECT strict FROM pragma_table_list WHERE name='source_library_operations'").get().strict, 1);
    assert.equal(store.workspace.database.prepare('SELECT count(*) AS n FROM source_library_operations').get().n, 0);
    assert.equal(store.integrityCheck().ok, true);
  });
}
