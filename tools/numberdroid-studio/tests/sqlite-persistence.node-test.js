import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StudioService, projectSummary } from '../packages/application/src/index.js';
import { loadProjectHead } from '../packages/application/src/project-store.js';
import {
  SqliteProjectStore,
  SqliteWorkspace,
  loadMigrationDefinitions,
  migrationChecksum,
} from '../packages/persistence/src/index.js';
import { AGENT_CONTEXT, OWNER_CONTEXT, PROJECT_ID, agentSourceCommand, command, createHarness, createProject, issueGrant } from './test-helpers.js';
import { afterTestCleanup, nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';

async function tempWorkspace(context, prefix = 'numberdroid-sqlite-') {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  afterTestCleanup(context, () => rm(directory, { recursive: true, force: true }));
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

test('migration checksums ignore CRLF transport changes but detect SQL changes', () => {
  const lfSql = 'CREATE TABLE example (\n  id TEXT PRIMARY KEY\n) STRICT;\n';
  const crlfSql = lfSql.replaceAll('\n', '\r\n');

  assert.equal(migrationChecksum(crlfSql), migrationChecksum(lfSql));
  assert.notEqual(migrationChecksum(lfSql.replace('PRIMARY KEY', 'NOT NULL')), migrationChecksum(lfSql));
});

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
  afterTestCleanup(context, () => store.close());
  const restarted = new StudioService({ store });
  const project = await restarted.readProjectTrusted(PROJECT_ID);
  assert.equal(project.revision, 2);
  assert.equal(project.snapshot.project.status, 'active');
  assert.equal(store.workspace.database.prepare('SELECT count(*) AS count FROM revisions').get().count, 2);
  assert.equal(store.workspace.database.prepare('SELECT count(*) AS count FROM activity_events').get().count, 2);
  assert.equal(store.workspace.database.prepare('SELECT count(*) AS count FROM idempotency_records').get().count, 2);
  assert.equal(store.workspace.database.prepare('SELECT version FROM aggregate_versions').get().version, 2);
});

test('head-read compatibility falls back to an adapter complete-document read', async () => {
  const expected = { number: 2, snapshot: { project: { name: 'fallback' } } };
  let reads = 0;
  const store = {
    async loadProject(projectId) {
      reads += 1;
      return projectId === PROJECT_ID ? { revisions: [{ number: 1 }, expected] } : null;
    },
  };
  assert.equal(await loadProjectHead(store, PROJECT_ID), expected);
  assert.equal(await loadProjectHead(store, 'project.missing'), null);
  assert.equal(reads, 2);
});

test('head reads equal the authoritative ledger head and preserve live grant overlays across restart', async (context) => {
  const { filename } = await tempWorkspace(context, 'numberdroid-sqlite-head-read-');
  let store = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  afterTestCleanup(context, () => store.close());
  const { studio } = createHarness(store);
  await createProject(studio);
  await issueGrant(studio);

  const assertHeadEqualsFull = async () => {
    const full = await store.loadProject(PROJECT_ID);
    assert.deepEqual(await store.loadProjectHead(PROJECT_ID), full.revisions.at(-1));
    assert.deepEqual(await new StudioService({ store }).readProjectTrusted(PROJECT_ID), {
      schemaVersion: 1,
      projectId: PROJECT_ID,
      revision: full.revisions.at(-1).number,
      snapshot: full.revisions.at(-1).snapshot,
    });
  };
  await assertHeadEqualsFull();

  const query = { schemaVersion: 1, projectId: PROJECT_ID, includeVersions: false, includeProposals: false };
  const expectedRooms = await studio.queryRooms(query, OWNER_CONTEXT);
  assert.deepEqual(await studio.queryRooms(query, AGENT_CONTEXT), expectedRooms);
  const completeRead = store.loadProject;
  store.loadProject = () => { throw new Error('Current-only reads must not decode the full ledger'); };
  try {
    assert.deepEqual(await studio.queryRooms(query, OWNER_CONTEXT), expectedRooms);
    assert.equal((await studio.readProjectTrusted(PROJECT_ID)).revision, 2);
    await assert.rejects(studio.queryRooms(query, { ...OWNER_CONTEXT, actor: { ...OWNER_CONTEXT.actor, id: 'another.owner' } }),
      error => error.code === 'FORBIDDEN');
  } finally { store.loadProject = completeRead; }

  store.workspace.database.prepare(`
    UPDATE grants SET authorization_status = 'LEGACY_UNBOUND', revoked_at = issued_at,
      revoke_reason = 'LEGACY_UNBOUND' WHERE project_id = ? AND grant_id = ?
  `).run(PROJECT_ID, 'grant.atlas');
  await assertHeadEqualsFull();
  const overlaid = await store.loadProjectHead(PROJECT_ID);
  assert.equal(overlaid.snapshot.grants[0].authorizationStatus, 'LEGACY_UNBOUND');
  assert.equal(overlaid.snapshot.grants[0].status, 'LEGACY_UNBOUND');
  assert.equal(overlaid.snapshot.grants[0].revokeReason, 'LEGACY_UNBOUND');
  await assert.rejects(studio.queryRooms(query, AGENT_CONTEXT), error => error.code === 'GRANT_REVOKED');

  store.close();
  store = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  await assertHeadEqualsFull();
  assert.equal(await store.loadProjectHead('project.missing'), null);

  store.workspace.database.prepare('UPDATE projects SET head_revision = 999 WHERE project_id = ?').run(PROJECT_ID);
  await assert.rejects(store.loadProjectHead(PROJECT_ID), (error) => error.code === 'CORRUPT_PROJECT');
});

test('append can skip only its full-document return without weakening rollback, restart, or replay', async (context) => {
  const { filename } = await tempWorkspace(context, 'numberdroid-sqlite-append-no-return-');
  const oracle = createHarness();
  await createProject(oracle.studio);
  const activeCommand = command({
    commandId: 'cmd.no-return.active', idempotencyKey: 'idem.no-return.active',
    type: 'project.status.set', expectedVersion: 1, payload: { status: 'active' },
  });
  const activeResult = await oracle.studio.execute(activeCommand, OWNER_CONTEXT);
  const activeDocument = await oracle.store.loadProject(PROJECT_ID);
  await oracle.studio.execute(command({
    commandId: 'cmd.no-return.paused', idempotencyKey: 'idem.no-return.paused',
    type: 'project.status.set', expectedVersion: 2, payload: { status: 'paused' },
  }), OWNER_CONTEXT);
  const pausedRevision = (await oracle.store.loadProject(PROJECT_ID)).revisions.at(-1);

  let historyReads = 0;
  let failBeforeCommit = false;
  let store = await SqliteProjectStore.open({
    filename,
    databaseFactory(databaseFilename, options) {
      const database = nodeSqliteDatabaseFactory(databaseFilename, options);
      return new Proxy(database, {
        get(target, property) {
          if (property === 'prepare') return (sql) => {
            if (sql.trim().replace(/\s+/g, ' ') === 'SELECT revision_json FROM revisions WHERE project_id = ? ORDER BY revision_number') historyReads += 1;
            return target.prepare(sql);
          };
          const value = Reflect.get(target, property, target);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    },
    faultInjector(point) {
      if (failBeforeCommit && point === 'before_transaction_commit') throw new Error('no-return transaction fault');
    },
  });
  afterTestCleanup(context, () => store.close());
  await store.createProject({ ...activeDocument, revisions: activeDocument.revisions.slice(0, 1) });
  historyReads = 0;
  assert.equal(await store.appendRevision(PROJECT_ID, 1, activeDocument.revisions[1], { returnDocument: false }), undefined);
  assert.equal(historyReads, 0);
  assert.equal(store.workspace.database.prepare('SELECT head_revision FROM projects WHERE project_id = ?').get(PROJECT_ID).head_revision, 2);

  failBeforeCommit = true;
  await assert.rejects(
    store.appendRevision(PROJECT_ID, 2, pausedRevision, { returnDocument: false }),
    /no-return transaction fault/,
  );
  assert.equal(store.workspace.database.prepare('SELECT head_revision FROM projects WHERE project_id = ?').get(PROJECT_ID).head_revision, 2);
  assert.equal(store.workspace.database.prepare('SELECT count(*) AS count FROM revisions WHERE project_id = ?').get(PROJECT_ID).count, 2);
  store.close();

  store = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  assert.deepEqual(await store.loadProject(PROJECT_ID), activeDocument);
  assert.deepEqual(await new StudioService({ store }).execute(activeCommand, OWNER_CONTEXT), { ...activeResult, replayed: true });
  assert.equal(store.integrityCheck().ok, true);
});

test('append summaries use the committed head without a second full-history read and preserve the public ledger return', async (context) => {
  const { filename } = await tempWorkspace(context, 'numberdroid-sqlite-summary-head-');
  const oracle = createHarness();
  await createProject(oracle.studio);
  await oracle.studio.execute(command({
    commandId: 'cmd.summary.active', idempotencyKey: 'idem.summary.active',
    type: 'project.status.set', expectedVersion: 1, payload: { status: 'active' },
  }), OWNER_CONTEXT);
  await oracle.studio.execute(agentSourceCommand({ expectedVersion: 2 }), OWNER_CONTEXT);
  const assetCommand = command({
    commandId: 'cmd.summary.asset', idempotencyKey: 'idem.summary.asset',
    type: 'asset.define', expectedVersion: 3,
    payload: {
      assetId: 'tile.summary.floor', sourceId: 'source.atlas', name: 'Summary floor', kind: 'surface',
      region: { x: 0, y: 0, width: 128, height: 128 }, properties: { role: 'floor' },
    },
  });
  const originalResult = await oracle.studio.execute(assetCommand, OWNER_CONTEXT);
  const expected = await oracle.store.loadProject(PROJECT_ID);
  await oracle.studio.execute(command({
    commandId: 'cmd.summary.paused', idempotencyKey: 'idem.summary.paused',
    type: 'project.status.set', expectedVersion: 4, payload: { status: 'paused' },
  }), OWNER_CONTEXT);
  const faultedRevision = (await oracle.store.loadProject(PROJECT_ID)).revisions.at(-1);

  let historyReads = 0;
  let failBeforeCommit = false;
  let store = await SqliteProjectStore.open({
    filename,
    databaseFactory(databaseFilename, options) {
      const database = nodeSqliteDatabaseFactory(databaseFilename, options);
      return new Proxy(database, {
        get(target, property) {
          if (property === 'prepare') return (sql) => {
            if (sql.trim().replace(/\s+/g, ' ') === 'SELECT revision_json FROM revisions WHERE project_id = ? ORDER BY revision_number') historyReads += 1;
            return target.prepare(sql);
          };
          const value = Reflect.get(target, property, target);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    },
    faultInjector(point) {
      if (failBeforeCommit && point === 'before_transaction_commit') throw new Error('summary transaction fault');
    },
  });
  afterTestCleanup(context, () => store.close());
  await store.createProject({ ...expected, revisions: expected.revisions.slice(0, 1) });
  for (const revision of expected.revisions.slice(1)) {
    historyReads = 0;
    const returned = await store.appendRevision(PROJECT_ID, revision.parentRevision, revision);
    assert.equal(historyReads, 1, 'Only the public full-document return reads history; summary must use the supplied head.');
    assert.deepEqual(returned, { ...expected, revisions: expected.revisions.slice(0, revision.number) });
    assert.deepEqual(JSON.parse(store.workspace.database.prepare('SELECT summary_json FROM projects WHERE project_id = ?').get(PROJECT_ID).summary_json), projectSummary(returned));
    assert.deepEqual(await store.listProjects(), [projectSummary(returned)]);
  }
  assert.equal(projectSummary(expected).sourceCount, 1);
  assert.equal(projectSummary(expected).assetCount, 1);
  const storedBeforeFault = store.workspace.database.prepare('SELECT * FROM projects WHERE project_id = ?').get(PROJECT_ID);
  failBeforeCommit = true;
  await assert.rejects(store.appendRevision(PROJECT_ID, 4, faultedRevision), /summary transaction fault/);
  assert.deepEqual(store.workspace.database.prepare('SELECT * FROM projects WHERE project_id = ?').get(PROJECT_ID), storedBeforeFault);
  assert.deepEqual(await store.loadProject(PROJECT_ID), expected);
  store.close();

  store = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  assert.deepEqual(await store.loadProject(PROJECT_ID), expected);
  assert.deepEqual(await store.listProjects(), [projectSummary(expected)]);
  const replayed = await new StudioService({ store }).execute(assetCommand, OWNER_CONTEXT);
  assert.deepEqual(replayed, { ...originalResult, replayed: true });
  assert.deepEqual(await store.loadProject(PROJECT_ID), expected);
  assert.equal(store.integrityCheck().ok, true);
});

test('one authoritative writer is enforced while a read-only connection can inspect WAL state', async (context) => {
  const { filename } = await tempWorkspace(context, 'numberdroid-sqlite-lock-');
  const writer = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  afterTestCleanup(context, () => writer.close());
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
  afterTestCleanup(context, () => reader.close());
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
  afterTestCleanup(context, () => store.close());
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
  afterTestCleanup(context, () => store.close());
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
  assert.deepEqual(migrations.map(({ version }) => version), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
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
  afterTestCleanup(context, () => store.close());
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
  afterTestCleanup(context, () => resumed.close());
  assert.equal(resumed.integrityCheck().userVersion, 19);
  assert.deepEqual(
    resumed.workspace.database.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map((row) => row.version),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
  );
});

test('migration 0013 rolls back before/after its boundary and resumes with both private ledgers', async (context) => {
  for (const boundary of ['before_migration_13', 'after_migration_13']) {
    await context.test(boundary, async (childContext) => {
      const { filename } = await tempWorkspace(childContext, `numberdroid-schema-${boundary}-`);
      await assert.rejects(SqliteProjectStore.open({
        filename,
        databaseFactory: nodeSqliteDatabaseFactory,
        faultInjector(point) {
          if (point === boundary) throw new Error(`simulated ${boundary} crash`);
        },
      }), new RegExp(`simulated ${boundary} crash`));
      const interrupted = nodeSqliteDatabaseFactory(filename);
      assert.equal(Number(interrupted.prepare('PRAGMA user_version').get().user_version), 12);
      assert.deepEqual(
        interrupted.prepare(`
          SELECT name FROM sqlite_schema
          WHERE type = 'table' AND name LIKE 'task_branch_processing_result_%'
          ORDER BY name
        `).all(),
        [],
      );
      interrupted.close();

      const resumed = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
      afterTestCleanup(childContext, () => resumed.close());
      assert.equal(resumed.integrityCheck().userVersion, 19);
      const tables = resumed.workspace.database.prepare(`
        SELECT name, strict FROM pragma_table_list
        WHERE name LIKE 'task_branch_processing_result_%'
        ORDER BY name
      `).all().map((row) => ({ name: row.name, strict: Number(row.strict) }));
      assert.deepEqual(tables, [
        { name: 'task_branch_processing_result_adoptions', strict: 1 },
        { name: 'task_branch_processing_result_artifact_references', strict: 1 },
      ]);
    });
  }
});

test('migration 0014 rolls back before/after its boundary and resumes with the immutable Candidate ledger', async (context) => {
  for (const boundary of ['before_migration_14', 'after_migration_14']) {
    await context.test(boundary, async (childContext) => {
      const { filename } = await tempWorkspace(childContext, `numberdroid-schema-${boundary}-`);
      await assert.rejects(SqliteProjectStore.open({
        filename,
        databaseFactory: nodeSqliteDatabaseFactory,
        faultInjector(point) {
          if (point === boundary) throw new Error(`simulated ${boundary} crash`);
        },
      }), new RegExp(`simulated ${boundary} crash`));
      const interrupted = nodeSqliteDatabaseFactory(filename);
      assert.equal(Number(interrupted.prepare('PRAGMA user_version').get().user_version), 13);
      assert.equal(interrupted.prepare(`
        SELECT COUNT(*) AS count FROM sqlite_schema
        WHERE type = 'table' AND name = 'task_level_candidate_submissions'
      `).get().count, 0);
      interrupted.close();

      const resumed = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
      afterTestCleanup(childContext, () => resumed.close());
      assert.equal(resumed.integrityCheck().userVersion, 19);
      assert.deepEqual(resumed.workspace.database.prepare(`
        SELECT name, strict FROM pragma_table_list
        WHERE name = 'task_level_candidate_submissions'
      `).all().map((row) => ({ name: row.name, strict: Number(row.strict) })), [
        { name: 'task_level_candidate_submissions', strict: 1 },
      ]);
    });
  }
});

test('migration 0015 rolls back before/after its boundary and resumes with immutable child lineage', async (context) => {
  for (const boundary of ['before_migration_15', 'after_migration_15']) {
    await context.test(boundary, async (childContext) => {
      const { filename } = await tempWorkspace(childContext, `numberdroid-schema-${boundary}-`);
      await assert.rejects(SqliteProjectStore.open({
        filename,
        databaseFactory: nodeSqliteDatabaseFactory,
        faultInjector(point) {
          if (point === boundary) throw new Error(`simulated ${boundary} crash`);
        },
      }), new RegExp(`simulated ${boundary} crash`));
      const interrupted = nodeSqliteDatabaseFactory(filename);
      assert.equal(Number(interrupted.prepare('PRAGMA user_version').get().user_version), 14);
      assert.equal(interrupted.prepare(`
        SELECT COUNT(*) AS count FROM sqlite_schema
        WHERE type = 'table' AND name = 'derived_task_relations'
      `).get().count, 0);
      interrupted.close();

      const resumed = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
      afterTestCleanup(childContext, () => resumed.close());
      assert.equal(resumed.integrityCheck().userVersion, 19);
      assert.deepEqual(resumed.workspace.database.prepare(`
        SELECT name, strict FROM pragma_table_list WHERE name = 'derived_task_relations'
      `).all().map((row) => ({ name: row.name, strict: Number(row.strict) })), [
        { name: 'derived_task_relations', strict: 1 },
      ]);
      assert.ok(resumed.workspace.database.prepare(`
        SELECT 1 FROM pragma_table_info('agent_tasks') WHERE name = 'branch_origin_revision'
      `).get());
    });
  }
});
