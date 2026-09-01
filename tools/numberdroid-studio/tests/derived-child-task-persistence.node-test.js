import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  AgentTaskService,
  DerivedChildTaskService,
  StudioService,
} from '../packages/application/src/index.js';
import { listA4cGrantScopes } from '../packages/domain/src/index.js';
import {
  ContentAddressedArtifactStore,
  SqliteAgentTaskStore,
  SqliteDerivedChildTaskStore,
  SqliteProjectStore,
  TaskBranchProjectStore,
  verifyWorkspaceIntegrity,
} from '../packages/persistence/src/index.js';
import { AGENT, OWNER_CONTEXT, PROJECT_ID, command, createProject } from './test-helpers.js';
import { afterTestCleanup, nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';

const NOW = '2026-09-01T12:00:00.000Z';

async function fixture(context, {
  faultInjector = null,
  parentExpiresAt = '2026-09-01T13:00:00.000Z',
} = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-derived-child-'));
  afterTestCleanup(context, () => rm(directory, { recursive: true, force: true }));
  const projectStore = await SqliteProjectStore.open({
    filename: join(directory, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  let closed = false;
  const close = () => {
    if (!closed) {
      projectStore.close();
      closed = true;
    }
  };
  afterTestCleanup(context, close);
  const artifactStore = new ContentAddressedArtifactStore({ rootDirectory: join(directory, 'artifacts') });
  await artifactStore.initialize();
  const grantScopes = listA4cGrantScopes();
  const clock = () => NOW;
  const studio = new StudioService({ store: projectStore, clock, agentAttemptAuditReady: true, grantScopes });
  await createProject(studio);
  const taskStore = new SqliteAgentTaskStore({ workspace: projectStore.workspace });
  const childStore = new SqliteDerivedChildTaskStore({ workspace: projectStore.workspace, faultInjector });
  const childService = new DerivedChildTaskService({
    store: childStore,
    clock,
    policy: {
      budget: { maxCommands: 1, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 },
      ttlSeconds: 1800,
    },
  });
  const tasks = new AgentTaskService({
    studioService: studio,
    projectStore,
    taskStore,
    createBranchStore: ({ projectId, taskId }) => new TaskBranchProjectStore({ taskStore, projectId, taskId }),
    clock,
    grantScopes,
    derivedChildService: childService,
  });
  const parent = await tasks.createTask({
    projectId: PROJECT_ID,
    task: {
      taskId: 'task.a4c.parent',
      branchId: 'branch.task.a4c.parent',
      agentId: AGENT.id,
      title: 'Human-rooted A4c parent',
      objective: 'Delegate one restricted Candidate child.',
      capabilities: ['level.candidate.create', 'project.read', 'source.write', 'task.child.derive'],
      objectScopes: [{ kind: 'project', id: PROJECT_ID }],
      budget: { maxCommands: 2, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 },
      expiresAt: parentExpiresAt,
      autoAcceptPolicy: { enabled: false, allowedCommandTypes: [], maxChanges: 0 },
    },
  }, OWNER_CONTEXT);
  const trustedContext = {
    actor: AGENT,
    taskId: parent.task.taskId,
    branchId: parent.task.branchId,
    grantId: parent.task.grantId,
  };
  return { directory, projectStore, artifactStore, taskStore, tasks, parent, trustedContext, close };
}

function request(parent, overrides = {}) {
  return {
    schemaVersion: 1,
    idempotencyKey: 'derive.candidate.once',
    title: 'Restricted Candidate child',
    objective: 'Create one immutable Level Candidate and stop for review.',
    expectedParentHeadRevision: parent.task.headRevision,
    ...overrides,
  };
}

test('trusted service atomically derives one exact-head Candidate child and replays it after restart-safe lookup', async (context) => {
  const value = await fixture(context);
  const mainBefore = await value.projectStore.loadProject(PROJECT_ID);
  const created = value.tasks.deriveCandidateChild(PROJECT_ID, request(value.parent), value.trustedContext);
  assert.equal(created.replayed, false);
  assert.deepEqual(created.task.capabilities, ['level.candidate.create']);
  assert.deepEqual(created.task.objectScopes, value.parent.task.objectScopes);
  assert.deepEqual(created.task.autoAcceptPolicy, { enabled: false, allowedCommandTypes: [], maxChanges: 0 });
  assert.equal(created.task.agentId, value.parent.task.agentId);
  assert.notEqual(created.task.branchId, 'branch.main');
  assert.equal(created.task.derivation.furtherChildDerivation, 'NOT_AUTHORIZED');
  assert.equal(created.task.baseRevision, value.parent.task.headRevision + 1);
  const parentAfter = value.taskStore.getTask(PROJECT_ID, value.parent.task.taskId);
  const childDocument = value.taskStore.loadBaseDocument(PROJECT_ID, created.task.taskId);
  const parentDocument = value.taskStore.loadBranchDocument(PROJECT_ID, value.parent.task.taskId);
  assert.deepEqual(childDocument, parentDocument);
  assert.equal(parentAfter.reservedForChildren.commands, 1);
  assert.equal(parentAfter.usage.commands, 1);
  assert.equal(created.task.expiresAt, '2026-09-01T12:30:00.000Z');
  assert.equal((await value.projectStore.loadProject(PROJECT_ID)).revisions.at(-1).number, mainBefore.revisions.at(-1).number);
  const replayed = value.tasks.deriveCandidateChild(PROJECT_ID, request(value.parent), value.trustedContext);
  assert.equal(replayed.replayed, true);
  assert.equal(replayed.task.taskId, created.task.taskId);
  assert.equal(value.projectStore.workspace.database.prepare('SELECT COUNT(*) AS count FROM derived_task_relations').get().count, 1);
  assert.equal(value.projectStore.workspace.database.prepare('SELECT COUNT(*) AS count FROM grants WHERE task_id = ?').get(created.task.taskId).count, 1);
  assert.throws(() => value.projectStore.workspace.database.prepare(
    'DELETE FROM derived_task_relations WHERE project_id = ? AND child_task_id = ?',
  ).run(PROJECT_ID, created.task.taskId), /derived_task_relations cannot be deleted/);
  assert.equal((await verifyWorkspaceIntegrity({ projectStore: value.projectStore, artifactStore: value.artifactStore })).tasks.ok, true);
  value.close();
  const reopened = await SqliteProjectStore.open({
    filename: join(value.directory, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  afterTestCleanup(context, () => reopened.close());
  const replayedAfterRestart = new DerivedChildTaskService({
    store: new SqliteDerivedChildTaskStore({ workspace: reopened.workspace }),
    clock: () => NOW,
    policy: {
      budget: { maxCommands: 1, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 },
      ttlSeconds: 1800,
    },
  }).deriveCandidateChild(PROJECT_ID, request(value.parent), value.trustedContext);
  assert.equal(replayedAfterRestart.replayed, true);
  assert.equal(replayedAfterRestart.task.taskId, created.task.taskId);
  assert.equal(reopened.workspace.database.prepare('SELECT COUNT(*) AS count FROM derived_task_relations').get().count, 1);
});

test('child expiry is the chronological minimum even when parent authority uses an ISO offset', async (context) => {
  const value = await fixture(context, { parentExpiresAt: '2026-09-01T14:15:00+02:00' });
  const created = value.tasks.deriveCandidateChild(PROJECT_ID, request(value.parent), value.trustedContext);
  assert.equal(created.task.expiresAt, '2026-09-01T12:15:00.000Z');
  assert.ok(Date.parse(created.task.expiresAt) <= Date.parse(value.parent.task.expiresAt));
});

test('child derivation rejects hostile authority fields, stale heads, idempotency conflicts, and grandchildren', async (context) => {
  const value = await fixture(context);
  assert.throws(() => value.tasks.deriveCandidateChild(PROJECT_ID, {
    ...request(value.parent),
    branchId: 'branch.main',
  }, value.trustedContext), (error) => error.code === 'DERIVED_CHILD_REQUEST_INVALID');
  assert.throws(() => value.tasks.deriveCandidateChild(PROJECT_ID, request(value.parent, {
    expectedParentHeadRevision: value.parent.task.headRevision + 1,
  }), value.trustedContext), (error) => error.code === 'REVISION_CONFLICT');
  const created = value.tasks.deriveCandidateChild(PROJECT_ID, request(value.parent), value.trustedContext);
  assert.throws(() => value.tasks.deriveCandidateChild(PROJECT_ID, request(value.parent, {
    title: 'Different semantics',
  }), value.trustedContext), (error) => error.code === 'DERIVED_CHILD_IDEMPOTENCY_CONFLICT');
  const childContext = {
    actor: AGENT,
    taskId: created.task.taskId,
    branchId: created.task.branchId,
    grantId: created.task.grantId,
  };
  assert.throws(() => value.tasks.deriveCandidateChild(PROJECT_ID, request({ task: created.task }, {
    idempotencyKey: 'derive.grandchild',
    expectedParentHeadRevision: created.task.headRevision,
  }), childContext), (error) => error.code === 'CHILD_DERIVATION_DEPTH_EXCEEDED');
});

test('ancestor pause blocks child execution authority without changing child or main', async (context) => {
  const value = await fixture(context);
  const created = value.tasks.deriveCandidateChild(PROJECT_ID, request(value.parent), value.trustedContext);
  const childContext = {
    actor: AGENT,
    taskId: created.task.taskId,
    branchId: created.task.branchId,
    grantId: created.task.grantId,
  };
  assert.equal(value.tasks.readTaskForAgent(PROJECT_ID, childContext).task.authority.executionAvailability, 'EXECUTABLE');
  value.taskStore.transition(PROJECT_ID, value.parent.task.taskId, 'pause', {
    actorId: OWNER_CONTEXT.actor.id,
    now: NOW,
    reason: 'Owner pause.',
  });
  assert.throws(() => value.tasks.readTaskForAgent(PROJECT_ID, childContext),
    (error) => error.code === 'ANCESTOR_TASK_BLOCKED');
  const ownerProjection = value.tasks.readTask(PROJECT_ID, created.task.taskId);
  assert.equal(ownerProjection.task.authority.executionAvailability, 'BLOCKED_BY_ANCESTOR');
  assert.equal(ownerProjection.task.state, 'ACTIVE');
});

test('every non-executable ancestor condition blocks the child fail-closed', async (context) => {
  for (const [name, mutate, code] of [
    ['in-review', (value) => {
      const parent = value.taskStore.getTask(PROJECT_ID, value.parent.task.taskId);
      const changed = { ...parent, state: 'IN_REVIEW', updatedAt: NOW };
      value.projectStore.workspace.database.prepare(`
        UPDATE agent_tasks SET state = 'IN_REVIEW', updated_at = ?, task_json = ?
        WHERE project_id = ? AND task_id = ?
      `).run(NOW, JSON.stringify(changed), PROJECT_ID, parent.taskId);
    }, 'ANCESTOR_TASK_BLOCKED'],
    ['terminal', (value) => value.taskStore.transition(PROJECT_ID, value.parent.task.taskId, 'cancel', {
      actorId: OWNER_CONTEXT.actor.id, now: NOW, reason: 'Owner ended the parent.',
    }), 'ANCESTOR_TASK_TERMINAL'],
    ['expired', () => {}, 'ANCESTOR_TASK_EXPIRED'],
    ['grant-revoked', (value) => value.projectStore.workspace.database.prepare(`
      UPDATE grants SET status = 'REVOKED', authorization_status = 'REVOKED', revoked_at = ?
      WHERE project_id = ? AND grant_id = ?
    `).run(NOW, PROJECT_ID, value.parent.task.grantId), 'GRANT_REVOKED'],
    ['head-drift', (value) => value.projectStore.workspace.database.prepare(`
      UPDATE agent_tasks SET head_revision = head_revision + 1
      WHERE project_id = ? AND task_id = ?
    `).run(PROJECT_ID, value.parent.task.taskId), 'ANCESTOR_HEAD_STALE'],
  ]) {
    await context.test(name, async (nested) => {
      const value = await fixture(nested);
      const created = value.tasks.deriveCandidateChild(PROJECT_ID, request(value.parent), value.trustedContext);
      mutate(value);
      const now = name === 'expired' ? '2026-09-01T13:01:00.000Z' : NOW;
      assert.throws(() => value.taskStore.assertExecutionAuthority(PROJECT_ID, created.task.taskId, now),
        (error) => error.code === code);
    });
  }
});

test('deep integrity rejects missing lineage, reservation drift, and child grant authority drift', async (context) => {
  for (const [name, tamper, expectedCode] of [
    ['missing-relation', (value) => {
      const database = value.projectStore.workspace.database;
      database.exec('DROP TRIGGER derived_task_relations_delete_forbidden');
      database.prepare('DELETE FROM derived_task_relations WHERE project_id = ?').run(PROJECT_ID);
    }, 'DERIVED_TASK_RELATION_MISSING'],
    ['reservation', (value) => {
      const database = value.projectStore.workspace.database;
      const row = database.prepare('SELECT task_json FROM agent_tasks WHERE project_id = ? AND task_id = ?')
        .get(PROJECT_ID, value.parent.task.taskId);
      const task = JSON.parse(row.task_json);
      task.reservedForChildren.commands = 0;
      database.prepare('UPDATE agent_tasks SET task_json = ? WHERE project_id = ? AND task_id = ?')
        .run(JSON.stringify(task), PROJECT_ID, value.parent.task.taskId);
    }, 'DERIVED_TASK_AUTHORITY_MISMATCH'],
    ['child-grant', (value, created) => value.projectStore.workspace.database.prepare(`
      UPDATE grants SET usage_json = ? WHERE project_id = ? AND grant_id = ?
    `).run(JSON.stringify({ commands: 1, jobs: 0, artifactBytes: 0, costCents: 0 }), PROJECT_ID, created.task.grantId),
    'DERIVED_TASK_AUTHORITY_MISMATCH'],
  ]) {
    await context.test(name, async (nested) => {
      const value = await fixture(nested);
      const created = value.tasks.deriveCandidateChild(PROJECT_ID, request(value.parent), value.trustedContext);
      tamper(value, created);
      const integrity = await verifyWorkspaceIntegrity({ projectStore: value.projectStore, artifactStore: value.artifactStore });
      assert.equal(integrity.tasks.ok, false);
      assert.ok(integrity.tasks.findings.some(({ code }) => code === expectedCode));
    });
  }
});

test('a later valid parent branch command blocks child execution without corrupting historical lineage', async (context) => {
  const value = await fixture(context);
  const mainBefore = await value.projectStore.loadProject(PROJECT_ID);
  const created = value.tasks.deriveCandidateChild(PROJECT_ID, request(value.parent), value.trustedContext);
  const parentAfter = value.taskStore.getTask(PROJECT_ID, value.parent.task.taskId);
  const committed = await value.tasks.execute(command({
    commandId: 'cmd.parent.after-child',
    idempotencyKey: 'idem.parent.after-child',
    type: 'source.register',
    expectedVersion: parentAfter.headRevision,
    payload: {
      sourceId: 'source.parent.after-child',
      name: 'Parent continues independently',
      artifactUri: 'studio://project.family-hygiene/artifacts/parent-after-child.png',
      mediaType: 'image/png',
      width: 64,
      height: 64,
      provenance: { prompt: 'Bounded parent-head drift fixture.', seed: 15 },
    },
  }), value.trustedContext);
  assert.equal(committed.branchRevision, parentAfter.headRevision + 1);
  assert.throws(() => value.taskStore.assertExecutionAuthority(PROJECT_ID, created.task.taskId, NOW),
    (error) => error.code === 'ANCESTOR_HEAD_STALE');
  assert.equal((await verifyWorkspaceIntegrity({
    projectStore: value.projectStore,
    artifactStore: value.artifactStore,
  })).tasks.ok, true);
  assert.deepEqual(await value.projectStore.loadProject(PROJECT_ID), mainBefore);
});

test('faults at every derivation write boundary leave no child, grant, relation, or parent reservation', async (context) => {
  for (const point of [
    'after_child_reservation_admission',
    'after_child_grant_insert',
    'after_parent_branch_revision_insert',
    'after_parent_derivation_revision',
    'after_child_task_insert',
    'after_child_relation_insert',
    'after_parent_timeline_insert',
    'after_child_timeline_insert',
    'before_child_derivation_commit',
  ]) {
    let activePoint = point;
    const value = await fixture(context, { faultInjector(current) { if (current === activePoint) throw new Error(`fault:${point}`); } });
    assert.throws(() => value.tasks.deriveCandidateChild(PROJECT_ID, request(value.parent), value.trustedContext),
      new RegExp(`fault:${point}`));
    activePoint = null;
    const database = value.projectStore.workspace.database;
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM derived_task_relations').get().count, 0);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM agent_tasks WHERE task_id LIKE 'task.child.%'").get().count, 0);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM grants WHERE grant_id LIKE 'grant.child.%'").get().count, 0);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM task_branch_revisions WHERE command_type = 'task.child.derive'").get().count, 0);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM task_timeline_events WHERE event_type IN ('CHILD_TASK_DERIVED', 'TASK_DERIVED')").get().count, 0);
    const parent = value.taskStore.getTask(PROJECT_ID, value.parent.task.taskId);
    assert.equal(parent.headRevision, value.parent.task.headRevision);
    assert.equal(parent.reservedForChildren, undefined);
  }
});
