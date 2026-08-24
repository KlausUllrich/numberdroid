import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StudioService } from '../packages/application/src/index.js';
import {
  JsonProjectStore,
  SqliteProjectStore,
  createJsonSourceManifest,
  migrateJsonToSqlite,
} from '../packages/persistence/src/index.js';
import { OWNER, OWNER_CONTEXT } from './test-helpers.js';
import { afterTestCleanup, nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';

async function tempDirectory(context, prefix) {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  afterTestCleanup(context, () => rm(directory, { recursive: true, force: true }));
  return directory;
}

function dto({ projectId, suffix, revision, type, payload }) {
  return {
    schemaVersion: 1,
    commandId: `cmd.${suffix}.${revision}`,
    idempotencyKey: `idem.${suffix}.${revision}`,
    type,
    projectId,
    baseRevision: revision - 1,
    expectedVersion: revision - 1,
    dryRun: false,
    payload,
  };
}

async function createLegacyProject(directory, { projectId, suffix, withGrant = false, withMissingArtifact = false }) {
  let tick = 0;
  const studio = new StudioService({
    store: new JsonProjectStore({ directory }),
    clock: () => new Date(Date.UTC(2026, 7, 20, 10, 0, tick++)).toISOString(),
  });
  await studio.execute(dto({
    projectId,
    suffix,
    revision: 1,
    type: 'project.create',
    payload: { name: `Legacy ${suffix}`, ownerId: OWNER.id },
  }), OWNER_CONTEXT);
  let revision = 1;
  if (withGrant) {
    revision += 1;
    await studio.execute(dto({
      projectId,
      suffix,
      revision,
      type: 'grant.issue',
      payload: {
        grantId: `grant.${suffix}`,
        agentId: `agent.${suffix}`,
        taskId: `task.${suffix}`,
        branchId: `branch.${suffix}`,
        scopes: ['project.read', 'source.write'],
        objectScopes: [{ kind: 'project', id: projectId }],
        budget: { maxCommands: 20, maxJobs: 2, maxArtifactBytes: 1024, maxCostCents: 0 },
      },
    }), OWNER_CONTEXT);
  }
  if (withMissingArtifact) {
    revision += 1;
    await studio.execute(dto({
      projectId,
      suffix,
      revision,
      type: 'source.register',
      payload: {
        sourceId: `source.${suffix}`,
        name: 'Legacy source without a CAS object',
        artifactUri: `file:///legacy/${suffix}.png`,
        mediaType: 'image/png',
        width: 128,
        height: 128,
        provenance: { prompt: 'Legacy atlas prompt', seed: 742 },
      },
    }), OWNER_CONTEXT);
  }
  return { studio, revision };
}

test('JSON-to-SQLite migration copies and verifies history while forcing legacy grants inactive', async (context) => {
  const root = await tempDirectory(context, 'numberdroid-json-migrate-');
  const source = join(root, 'json-source');
  const destination = join(root, 'sqlite-destination');
  const projectId = 'project.legacy.hygiene';
  await createLegacyProject(source, {
    projectId,
    suffix: 'hygiene',
    withGrant: true,
    withMissingArtifact: true,
  });
  const before = await createJsonSourceManifest(source);
  const store = await SqliteProjectStore.open({
    filename: join(destination, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  afterTestCleanup(context, () => store.close());

  const report = await migrateJsonToSqlite({
    sourceDirectory: source,
    destinationDirectory: destination,
    store,
    migrationId: 'migration.hygiene.1',
  });
  assert.equal(report.status, 'VERIFIED');
  assert.equal(report.cutoverPerformed, false);
  assert.equal(report.projects[0].revisionCount, 3);
  assert.equal(report.projects[0].activityCount, 3);
  assert.equal(report.projects[0].legacyGrantCount, 1);
  assert.deepEqual(report.projects[0].eventOrder, [
    'activity:cmd.hygiene.1',
    'activity:cmd.hygiene.2',
    'activity:cmd.hygiene.3',
  ]);
  assert.deepEqual(report.projects[0].aggregateIds.grant, ['grant.hygiene']);
  assert.equal(report.projects[0].sourceProjectionHash, before.projects[0].sourceProjectionHash);
  assert.equal(report.projects[0].effectiveProjectionHash, report.projects[0].expectedEffectiveProjectionHash);
  assert.deepEqual(report.projects[0].validationSummary, { status: 'NOT_AVAILABLE_IN_C1A', findingCount: 0 });
  assert.deepEqual(report.projects[0].unresolvedArtifacts, [{
    sourceId: 'source.hygiene',
    artifactUri: 'file:///legacy/hygiene.png',
    finding: 'MISSING_ARTIFACT',
  }]);
  assert.equal(report.integrity.ok, true);
  assert.equal((await createJsonSourceManifest(source)).manifestHash, before.manifestHash);
  const protectedManifest = JSON.parse(await readFile(
    join(destination, 'protected-json', 'migration.hygiene.1', 'source-manifest.json'),
    'utf8',
  ));
  assert.equal(protectedManifest.manifestHash, before.manifestHash);

  const migrated = await store.loadProject(projectId);
  const legacyGrant = migrated.revisions.at(-1).snapshot.grants[0];
  assert.equal(legacyGrant.status, 'LEGACY_UNBOUND');
  assert.equal(legacyGrant.authorizationStatus, 'LEGACY_UNBOUND');
  assert.ok(legacyGrant.revokedAt);
  assert.equal(legacyGrant.revokeReason, 'LEGACY_UNBOUND');
  const grantRow = store.workspace.database.prepare('SELECT * FROM grants WHERE project_id = ?').get(projectId);
  assert.equal(grantRow.authorization_status, 'LEGACY_UNBOUND');
  assert.equal(grantRow.status, 'LEGACY_UNBOUND');
  assert.equal(grantRow.branch_id, 'branch.hygiene');
  assert.deepEqual(JSON.parse(grantRow.object_scopes_json), [{ kind: 'project', id: projectId }]);

  const rawHistory = store.workspace.database.prepare(
    'SELECT revision_json FROM revisions WHERE project_id = ? ORDER BY revision_number',
  ).all(projectId).map((row) => JSON.parse(row.revision_json));
  assert.equal(rawHistory.at(-1).snapshot.grants[0].authorizationStatus, undefined);
  assert.equal(rawHistory.at(-1).snapshot.grants[0].status, 'ACTIVE');
  assert.equal(rawHistory.at(-1).snapshot.grants[0].revokedAt, null);

  const retry = await migrateJsonToSqlite({
    sourceDirectory: source,
    destinationDirectory: destination,
    store,
    migrationId: 'migration.hygiene.1',
  });
  assert.deepEqual(retry, report);
  assert.equal(store.workspace.database.prepare('SELECT count(*) AS count FROM revisions').get().count, 3);
});

test('copy-and-verify migration resumes after a project-boundary fault without duplicates', async (context) => {
  const root = await tempDirectory(context, 'numberdroid-json-migrate-restart-');
  const source = join(root, 'json-source');
  const destination = join(root, 'sqlite-destination');
  await createLegacyProject(source, { projectId: 'project.legacy.a', suffix: 'a', withGrant: true });
  await createLegacyProject(source, { projectId: 'project.legacy.b', suffix: 'b', withMissingArtifact: true });
  const before = await createJsonSourceManifest(source);
  const store = await SqliteProjectStore.open({
    filename: join(destination, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  afterTestCleanup(context, () => store.close());

  await assert.rejects(migrateJsonToSqlite({
    sourceDirectory: source,
    destinationDirectory: destination,
    store,
    migrationId: 'migration.restart.1',
    faultInjector(point) {
      if (point === 'after_project_1') throw new Error('simulated migration stop');
    },
  }), /simulated migration stop/);
  assert.equal(store.workspace.database.prepare('SELECT status FROM migration_runs').get().status, 'FAILED');
  assert.equal(store.workspace.database.prepare('SELECT count(*) AS count FROM projects').get().count, 1);
  assert.equal((await createJsonSourceManifest(source)).manifestHash, before.manifestHash);

  const report = await migrateJsonToSqlite({
    sourceDirectory: source,
    destinationDirectory: destination,
    store,
    migrationId: 'migration.restart.1',
  });
  assert.equal(report.status, 'VERIFIED');
  assert.equal(report.projects.length, 2);
  assert.equal(store.workspace.database.prepare('SELECT count(*) AS count FROM projects').get().count, 2);
  assert.equal(store.workspace.database.prepare('SELECT count(*) AS count FROM migration_runs').get().count, 1);
  assert.equal((await createJsonSourceManifest(source)).manifestHash, before.manifestHash);
});
