import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StudioService } from '../packages/application/src/index.js';
import { SqliteProjectStore, SqliteWorkspace, loadMigrationDefinitions } from '../packages/persistence/src/index.js';
import { OWNER_CONTEXT, PROJECT_ID, command, createHarness, createProject, issueGrant } from './test-helpers.js';
import { nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';

async function tempWorkspace(context, prefix = 'numberdroid-sqlite-') {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  context.after(() => rm(directory, { recursive: true, force: true }));
  return { directory, filename: join(directory, 'studio.sqlite') };
}

async function createActiveProject(store) {
  const { studio } = createHarness(store);
  await createProject(studio);
  await studio.execute(command({
    commandId: 'cmd.active',
    idempotencyKey: 'idem.active',
    type: 'project.status.set',
    baseRevision: 1,
    expectedVersion: 1,
    payload: { status: 'active' },
  }), OWNER_CONTEXT);
  return studio;
}

test('SQLite adapter configures durability, restarts, and preserves the immutable ledger', async (context) => {
  const { filename } = await tempWorkspace(context);
  let store = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  await createActiveProject(store);

  assert.equal(store.workspace.database.prepare('PRAGMA journal_mode').get().journal_mode, 'wal');
  assert.equal(Number(store.workspace.database.prepare('PRAGMA foreign_keys').get().foreign_keys), 1);
  assert.equal(Number(store.workspace.database.prepare('PRAGMA synchronous').get().synchronous), 2);
  assert.equal(Number(store.workspace.database.prepare('PRAGMA busy_timeout').get().timeout), 5000);
  assert.equal(store.integrityCheck().ok, true);
  store.close();

  store = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  context.after(() => store.close());
  const restarted = new StudioService({ store });
  const project = await restarted.readProjectTrusted(PROJECT_ID);
  assert.equal(project.revision, 2);
  assert.equal(project.snapshot.project.status, 'active');
  assert.equal(store.workspace.database.prepare('SELECT count(*) AS count FROM revisions').get().count, 2);
  assert.equal(store.workspace.database.prepare('SELECT count(*) AS count FROM activity_events').get().count, 2);
  assert.equal(store.workspace.database.prepare('SELECT count(*) AS count FROM idempotency_records').get().count, 2);
  assert.equal(store.workspace.database.prepare('SELECT version FROM aggregate_versions').get().version, 2);
});

test('one authoritative writer is enforced while a read-only connection can inspect WAL state', async (context) => {
  const { filename } = await tempWorkspace(context, 'numberdroid-sqlite-lock-');
  const writer = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  context.after(() => writer.close());
  await createActiveProject(writer);

  await assert.rejects(
    SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory }),
    (error) => error.code === 'SQLITE_WRITER_LOCKED',
  );
  const readerWorkspace = await SqliteWorkspace.open({
    filename,
    databaseFactory: nodeSqliteDatabaseFactory,
    mode: 'reader',
  });
  const reader = new SqliteProjectStore({ workspace: readerWorkspace });
  context.after(() => reader.close());
  assert.equal((await reader.loadProject(PROJECT_ID)).revisions.length, 2);
  await assert.rejects(
    reader.appendRevision(PROJECT_ID, 2, {}),
    (error) => error.code === 'SQLITE_READ_ONLY',
  );
});

test('faults roll back revision, activity, projection, idempotency, grant, and head atomically', async (context) => {
  const { filename } = await tempWorkspace(context, 'numberdroid-sqlite-fault-');
  let armed = false;
  const store = await SqliteProjectStore.open({
    filename,
    databaseFactory: nodeSqliteDatabaseFactory,
    faultInjector(point) {
      if (armed && point === 'after_activity_insert') throw new Error('simulated storage fault');
    },
  });
  context.after(() => store.close());
  const { studio } = createHarness(store);
  await createProject(studio);
  const beforeProjection = store.workspace.database.prepare("SELECT * FROM projections WHERE projection_type = 'project_head'").get();
  armed = true;

  await assert.rejects(studio.execute(command({
    commandId: 'cmd.faulted',
    idempotencyKey: 'idem.faulted',
    type: 'project.status.set',
    baseRevision: 1,
    expectedVersion: 1,
    payload: { status: 'active' },
  }), OWNER_CONTEXT), /simulated storage fault/);

  assert.equal(store.workspace.database.prepare('SELECT head_revision FROM projects').get().head_revision, 1);
  assert.equal(store.workspace.database.prepare('SELECT count(*) AS count FROM revisions').get().count, 1);
  assert.equal(store.workspace.database.prepare('SELECT count(*) AS count FROM activity_events').get().count, 1);
  assert.equal(store.workspace.database.prepare('SELECT count(*) AS count FROM idempotency_records').get().count, 1);
  assert.deepEqual(
    store.workspace.database.prepare("SELECT * FROM projections WHERE projection_type = 'project_head'").get(),
    beforeProjection,
  );
  assert.equal((await studio.readProjectTrusted(PROJECT_ID)).revision, 1);
});

test('SQLite compare-and-swap allows one of two commands prepared from the same head', async (context) => {
  const { filename } = await tempWorkspace(context, 'numberdroid-sqlite-cas-');
  const store = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  context.after(() => store.close());
  const { studio } = createHarness(store);
  await createProject(studio);

  const settled = await Promise.allSettled(['active', 'paused'].map((status) => studio.execute(command({
    commandId: `cmd.${status}`,
    idempotencyKey: `idem.${status}`,
    type: 'project.status.set',
    baseRevision: 1,
    expectedVersion: 1,
    payload: { status },
  }), OWNER_CONTEXT)));
  assert.equal(settled.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(settled.filter((result) => result.status === 'rejected' && result.reason.code === 'REVISION_CONFLICT').length, 1);
  assert.equal(store.workspace.database.prepare('SELECT count(*) AS count FROM revisions').get().count, 2);
  assert.equal(store.workspace.database.prepare('SELECT count(*) AS count FROM activity_events').get().count, 2);
});

test('projection rebuild is deterministic and migrations reject checksum/version drift', async (context) => {
  const { filename } = await tempWorkspace(context, 'numberdroid-sqlite-rebuild-');
  const store = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  await createActiveProject(store);
  const expected = store.workspace.database.prepare("SELECT projection_hash FROM projections WHERE projection_type = 'project_head'").get().projection_hash;
  store.workspace.database.prepare("UPDATE projections SET projection_json = '{}', projection_hash = 'corrupt'").run();
  const rebuilt = await store.rebuildProjectProjection(PROJECT_ID);
  assert.equal(rebuilt.projectionHash, expected);
  assert.equal(store.workspace.database.prepare("SELECT projection_hash FROM projections WHERE projection_type = 'project_head'").get().projection_hash, expected);
  const migrations = await loadMigrationDefinitions();
  assert.deepEqual(migrations.map(({ version }) => version), [1, 2, 3, 4]);
  store.close();

  const raw = nodeSqliteDatabaseFactory(filename);
  raw.exec('PRAGMA user_version = 99');
  raw.close();
  await assert.rejects(
    SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory }),
    (error) => error.code === 'DATABASE_SCHEMA_TOO_NEW',
  );
});

test('grant projection persists branch, object scope, budgets, usage, and status across restart', async (context) => {
  const { filename } = await tempWorkspace(context, 'numberdroid-sqlite-grant-');
  let store = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  const { studio } = createHarness(store);
  await createProject(studio);
  await issueGrant(studio);

  const row = store.workspace.database.prepare('SELECT * FROM grants WHERE grant_id = ?').get('grant.atlas');
  assert.equal(row.branch_id, 'branch.task.atlas');
  assert.deepEqual(JSON.parse(row.object_scopes_json), [{ kind: 'project', id: PROJECT_ID }]);
  assert.deepEqual(JSON.parse(row.budget_json), {
    maxCommands: 100,
    maxJobs: 10,
    maxArtifactBytes: 536870912,
    maxCostCents: 0,
  });
  assert.deepEqual(JSON.parse(row.usage_json), { commands: 0, jobs: 0, artifactBytes: 0, costCents: 0 });
  assert.equal(row.status, 'ACTIVE');
  assert.equal(row.authorization_status, 'ACTIVE');
  store.close();

  store = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  context.after(() => store.close());
  const grant = (await store.loadProject(PROJECT_ID)).revisions.at(-1).snapshot.grants[0];
  assert.equal(grant.branchId, 'branch.task.atlas');
  assert.equal(grant.status, 'ACTIVE');
  assert.equal(grant.authorizationStatus, 'ACTIVE');
  assert.equal(grant.budget.maxCommands, 100);
});

test('schema migration faults roll back the individual version and safely resume', async (context) => {
  const { filename } = await tempWorkspace(context, 'numberdroid-schema-restart-');
  await assert.rejects(SqliteProjectStore.open({
    filename,
    databaseFactory: nodeSqliteDatabaseFactory,
    faultInjector(point) {
      if (point === 'after_migration_2') throw new Error('simulated migration crash');
    },
  }), /simulated migration crash/);

  const interrupted = nodeSqliteDatabaseFactory(filename);
  assert.equal(interrupted.prepare('PRAGMA user_version').get().user_version, 1);
  assert.deepEqual(
    interrupted.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map((row) => row.version),
    [1],
  );
  interrupted.close();

  const resumed = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  context.after(() => resumed.close());
  assert.equal(resumed.integrityCheck().userVersion, 4);
  assert.deepEqual(
    resumed.workspace.database.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map((row) => row.version),
    [1, 2, 3, 4],
  );
});
