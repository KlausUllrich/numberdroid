import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentTaskService, StudioService } from '../packages/application/src/index.js';
import {
  ContentAddressedArtifactStore, projectSqlitePortableDocument, SqliteAgentTaskStore,
  SqliteProjectStore, TaskBranchProjectStore, verifyWorkspaceIntegrity,
} from '../packages/persistence/src/index.js';
import { AGENT, OWNER, OWNER_CONTEXT, PROJECT_ID, command, createProject } from './test-helpers.js';
import { afterTestCleanup, nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';

function branchSource(expectedVersion, suffix) {
  return command({
    commandId: `cmd.cp4.race.${suffix}`,
    idempotencyKey: `idem.cp4.race.${suffix}`,
    type: 'source.register', expectedVersion,
    payload: {
      sourceId: `source.cp4.${suffix}`, name: `Source ${suffix}`,
      artifactUri: `studio://project.family-hygiene/artifacts/${suffix}.png`,
      mediaType: 'image/png', width: 16, height: 16,
      provenance: { prompt: `Race fixture ${suffix}`, seed: suffix },
    },
  });
}

async function harness(context, { fault = () => null } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-cp4-adversarial-'));
  afterTestCleanup(context, () => rm(directory, { recursive: true, force: true }));
  const store = await SqliteProjectStore.open({
    filename: join(directory, 'studio.sqlite'), databaseFactory: nodeSqliteDatabaseFactory,
    faultInjector: (point) => fault(point),
  });
  afterTestCleanup(context, () => store.close());
  const artifactStore = new ContentAddressedArtifactStore({ rootDirectory: join(directory, 'artifacts') });
  await artifactStore.initialize();
  let tick = 0;
  const clock = () => new Date(Date.UTC(2026, 7, 23, 10, 0, tick++)).toISOString();
  const studio = new StudioService({ store, clock, agentAttemptAuditReady: true });
  await createProject(studio);
  const taskStore = new SqliteAgentTaskStore({ workspace: store.workspace });
  const tasks = new AgentTaskService({
    studioService: studio, projectStore: store, taskStore, clock,
    createBranchStore: ({ projectId, taskId }) => new TaskBranchProjectStore({ taskStore, projectId, taskId }),
  });
  const created = await tasks.createTask({ projectId: PROJECT_ID, task: {
    taskId: 'task.cp4.adversarial', branchId: 'branch.task.cp4.adversarial', agentId: AGENT.id,
    title: 'Adversarial task', objective: 'Prove authority and race behavior.',
    capabilities: ['project.read', 'source.write'],
    objectScopes: [{ kind: 'project', id: PROJECT_ID }],
    budget: { maxCommands: 8, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 },
    expiresAt: '2026-08-23T12:00:00.000Z',
    autoAcceptPolicy: { enabled: false, allowedCommandTypes: [], maxChanges: 0 },
  } }, OWNER_CONTEXT);
  const agentContext = { actor: AGENT, taskId: created.task.taskId, branchId: created.task.branchId, grantId: created.task.grantId };
  return { store, artifactStore, studio, taskStore, tasks, created, agentContext };
}

test('concurrent branch commands use CAS so exactly one agent wins an identical head', async (context) => {
  const { studio, taskStore, tasks, created, agentContext } = await harness(context);
  const outcomes = await Promise.allSettled([
    tasks.execute(branchSource(2, 'alpha'), agentContext),
    tasks.execute(branchSource(2, 'beta'), agentContext),
  ]);
  assert.equal(outcomes.filter(({ status }) => status === 'fulfilled').length, 1);
  const rejected = outcomes.find(({ status }) => status === 'rejected');
  assert.equal(rejected.reason.code, 'REVISION_CONFLICT');
  assert.equal(taskStore.listBranchRevisions(PROJECT_ID, created.task.taskId).length, 1);
  assert.equal((await studio.readProjectTrusted(PROJECT_ID)).revision, 2);
});

test('wrong actor, branch, grant, finalization, and shared-side-effect attempts fail without a branch write', async (context) => {
  const { taskStore, tasks, created, agentContext } = await harness(context);
  const attempts = [
    [{ ...agentContext, actor: { kind: 'agent', id: 'agent.attacker' } }, 'TASK_ACTOR_MISMATCH', branchSource(2, 'actor')],
    [{ ...agentContext, branchId: 'branch.attacker' }, 'TASK_BRANCH_MISMATCH', branchSource(2, 'branch')],
    [{ ...agentContext, grantId: 'grant.attacker' }, 'TASK_GRANT_MISMATCH', branchSource(2, 'grant')],
  ];
  for (const [authority, code, commandValue] of attempts) {
    await assert.rejects(tasks.execute(commandValue, authority), (error) => error.code === code);
  }
  await assert.rejects(tasks.execute(command({
    commandId: 'cmd.cp4.finalize', idempotencyKey: 'idem.cp4.finalize',
    type: 'room.variant.finalize', expectedVersion: 2,
    payload: { roomVariantId: 'room.one', expectedRoomVariantVersion: 1 },
  }), agentContext), (error) => error.code === 'FORBIDDEN');
  await assert.rejects(tasks.execute(command({
    commandId: 'cmd.cp4.intake', idempotencyKey: 'idem.cp4.intake',
    type: 'source.intake.commit', expectedVersion: 2, payload: {},
  }), agentContext), (error) => error.code === 'TASK_BRANCH_EXTERNAL_SIDE_EFFECT_FORBIDDEN');
  assert.equal(taskStore.listBranchRevisions(PROJECT_ID, created.task.taskId).length, 0);
});

test('merge revision batch and workflow disposition roll back together on a fault, then retry once', async (context) => {
  let armed = null;
  const { store, artifactStore, studio, taskStore, tasks, created, agentContext } = await harness(context, {
    fault(point) { if (point === armed) throw new Error(`simulated ${point}`); },
  });
  await tasks.execute(branchSource(2, 'merge'), agentContext);
  const submitted = await tasks.submitReview(PROJECT_ID, created.task.taskId, { reviewId: 'review.cp4.atomic', actorId: OWNER.id });
  await tasks.decideReview(PROJECT_ID, created.task.taskId, submitted.review.reviewId, [{
    changeId: submitted.review.items[0].changeId, disposition: 'USER_ACCEPTED', reason: 'Reviewed.',
  }], { actorId: OWNER.id });
  armed = 'after_task_merge_revision_batch';
  await assert.rejects(tasks.mergeReview(PROJECT_ID, created.task.taskId, submitted.review.reviewId, {
    mergeId: 'merge.cp4.atomic', actorId: OWNER.id,
  }), /simulated after_task_merge_revision_batch/);
  assert.equal((await studio.readProjectTrusted(PROJECT_ID)).revision, 2);
  assert.equal(taskStore.getTask(PROJECT_ID, created.task.taskId).state, 'IN_REVIEW');
  assert.equal(store.workspace.database.prepare('SELECT count(*) AS count FROM task_merges').get().count, 0);
  assert.equal(store.workspace.database.prepare('SELECT count(*) AS count FROM revisions WHERE project_id = ?').get(PROJECT_ID).count, 2);
  armed = null;
  const merged = await tasks.mergeReview(PROJECT_ID, created.task.taskId, submitted.review.reviewId, {
    mergeId: 'merge.cp4.atomic', actorId: OWNER.id,
  });
  assert.equal(merged.merge.firstRevision, 3);
  assert.equal(taskStore.getTask(PROJECT_ID, created.task.taskId).state, 'MERGED');
  assert.equal(store.integrityCheck().ok, true);
  const integrity = await verifyWorkspaceIntegrity({ projectStore: store, artifactStore });
  assert.equal(integrity.tasks.ok, true, JSON.stringify(integrity.tasks.findings));
});

test('schema v11 task ledgers are STRICT and immutable history rejects updates', async (context) => {
  const { store, tasks, created, agentContext } = await harness(context);
  await tasks.execute(branchSource(2, 'immutable'), agentContext);
  const tables = store.workspace.database.prepare(`
    SELECT name, strict FROM pragma_table_list WHERE name LIKE 'task_%' OR name = 'agent_tasks' ORDER BY name
  `).all();
  assert.deepEqual(tables.map(({ name }) => name), [
    'agent_tasks', 'task_branch_processing_result_adoptions',
    'task_branch_processing_result_artifact_references', 'task_branch_revisions',
    'task_merges', 'task_reverts', 'task_reviews', 'task_timeline_events',
  ]);
  assert.ok(tables.every(({ strict }) => Number(strict) === 1));
  assert.throws(() => store.workspace.database.prepare(`
    UPDATE task_branch_revisions SET command_type = 'tampered'
    WHERE project_id = ? AND task_id = ?
  `).run(PROJECT_ID, created.task.taskId), /task_branch_revisions are immutable/);
  assert.throws(() => store.workspace.database.prepare(`
    UPDATE task_timeline_events SET event_type = 'tampered'
    WHERE project_id = ? AND task_id = ?
  `).run(PROJECT_ID, created.task.taskId), /task_timeline_events are immutable/);
});

test('portable export refuses live branches and strips terminal task authority/history', async (context) => {
  const { store, tasks, created } = await harness(context);
  assert.throws(
    () => projectSqlitePortableDocument({ projectStore: store, projectId: PROJECT_ID }),
    (error) => error.code === 'BUNDLE_NOT_QUIESCENT'
      && error.details.taskIds.includes(created.task.taskId),
  );
  await tasks.control(PROJECT_ID, created.task.taskId, 'cancel', {
    actorId: OWNER.id,
    reason: 'Make the project quiescent for the portable boundary test.',
  });
  const portable = projectSqlitePortableDocument({ projectStore: store, projectId: PROJECT_ID });
  assert.doesNotMatch(JSON.stringify(portable.project), /task\.cp4\.adversarial|grant\.task\./);
});
