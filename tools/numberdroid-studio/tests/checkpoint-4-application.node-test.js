import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentTaskService, StudioService } from '../packages/application/src/index.js';
import {
  SqliteAgentTaskStore,
  SqliteProjectStore,
  TaskBranchProjectStore,
} from '../packages/persistence/src/index.js';
import { AGENT, OWNER, OWNER_CONTEXT, PROJECT_ID, command, createProject } from './test-helpers.js';
import { afterTestCleanup, nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';

function sourceCommand(expectedVersion, suffix = 'branch', sourceId = 'source.cp4.shared') {
  return command({
    commandId: `cmd.cp4.source.${suffix}`,
    idempotencyKey: `idem.cp4.source.${suffix}`,
    type: 'source.register',
    expectedVersion,
    payload: {
      sourceId,
      name: `Checkpoint 4 ${suffix}`,
      artifactUri: `studio://project.family-hygiene/artifacts/cp4-${suffix}.png`,
      mediaType: 'image/png',
      width: 64,
      height: 64,
      provenance: { prompt: 'Bounded Checkpoint 4 fixture.', seed: 4 },
    },
  });
}

async function fixture(context) {
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-cp4-app-'));
  afterTestCleanup(context, () => rm(directory, { recursive: true, force: true }));
  const store = await SqliteProjectStore.open({
    filename: join(directory, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  afterTestCleanup(context, () => store.close());
  let tick = 0;
  let fixedNow = null;
  const clock = () => fixedNow ?? new Date(Date.UTC(2026, 7, 23, 10, 0, tick++)).toISOString();
  const studio = new StudioService({ store, clock, agentAttemptAuditReady: true });
  await createProject(studio);
  const taskStore = new SqliteAgentTaskStore({ workspace: store.workspace });
  const tasks = new AgentTaskService({
    studioService: studio,
    projectStore: store,
    taskStore,
    createBranchStore: ({ projectId, taskId }) => new TaskBranchProjectStore({ taskStore, projectId, taskId }),
    clock,
  });
  const created = await tasks.createTask({
    projectId: PROJECT_ID,
    task: {
      taskId: 'task.cp4.source',
      branchId: 'branch.task.cp4.source',
      agentId: AGENT.id,
      title: 'Isolated source task',
      objective: 'Demonstrate a durable branch without touching main.',
      capabilities: ['project.read', 'source.write'],
      objectScopes: [{ kind: 'project', id: PROJECT_ID }],
      budget: { maxCommands: 4, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 },
      expiresAt: '2026-08-23T12:00:00.000Z',
      autoAcceptPolicy: { enabled: false, allowedCommandTypes: [], maxChanges: 0 },
    },
  }, OWNER_CONTEXT);
  const agentContext = {
    actor: AGENT,
    taskId: created.task.taskId,
    branchId: created.task.branchId,
    grantId: created.task.grantId,
  };
  return { store, studio, taskStore, tasks, created, agentContext, setNow(value) { fixedNow = value; } };
}

test('CP4.5 task lists project expiry truth without mutating the durable workflow state', async (context) => {
  const { tasks, taskStore, created, setNow } = await fixture(context);
  assert.equal(tasks.listTasks(PROJECT_ID).tasks[0].effectiveState, 'ACTIVE');
  assert.equal(tasks.readTask(PROJECT_ID, created.task.taskId).task.effectiveState, 'ACTIVE');
  setNow('2026-08-23T12:00:00.001Z');
  assert.equal(tasks.listTasks(PROJECT_ID).tasks[0].effectiveState, 'EXPIRED');
  assert.equal(tasks.readTask(PROJECT_ID, created.task.taskId).task.effectiveState, 'EXPIRED');
  assert.equal(taskStore.getTask(PROJECT_ID, created.task.taskId).state, 'ACTIVE');
});

test('task creation mints bounded authority and branch commands never mutate main', async (context) => {
  const { studio, taskStore, tasks, created, agentContext } = await fixture(context);
  assert.equal(created.task.baseRevision, 2);
  assert.equal((await studio.readProjectTrusted(PROJECT_ID)).revision, 2);
  const committed = await tasks.execute(sourceCommand(2), agentContext);
  assert.equal(committed.branchRevision, 3);
  assert.equal(committed.branchId, 'branch.task.cp4.source');
  assert.equal((await studio.readProjectTrusted(PROJECT_ID)).revision, 2);
  assert.equal((await studio.readProjectTrusted(PROJECT_ID)).snapshot.sources.length, 0);
  assert.equal((await tasks.readBranch(PROJECT_ID, created.task.taskId, agentContext)).snapshot.sources.length, 1);
  assert.equal(taskStore.listBranchRevisions(PROJECT_ID, created.task.taskId)[0].command.payload.sourceId, 'source.cp4.shared');
  assert.equal(taskStore.listTimeline(PROJECT_ID, created.task.taskId).at(-1).type, 'BRANCH_COMMAND_COMMITTED');
  const agentProjection = tasks.readTaskForAgent(PROJECT_ID, agentContext);
  assert.doesNotMatch(JSON.stringify(agentProjection), /grant\.task\.|grantId/);
});

test('pause and resume are durable fail-closed controls', async (context) => {
  const { tasks, created, agentContext } = await fixture(context);
  const paused = await tasks.control(PROJECT_ID, created.task.taskId, 'pause', { actorId: OWNER.id, reason: 'Inspect progress.' });
  assert.equal(paused.task.state, 'PAUSED');
  await assert.rejects(tasks.execute(sourceCommand(2), agentContext), (error) => error.code === 'TASK_PAUSED');
  const resumed = await tasks.control(PROJECT_ID, created.task.taskId, 'resume', { actorId: OWNER.id, reason: 'Continue.' });
  assert.equal(resumed.task.state, 'ACTIVE');
  assert.equal((await tasks.execute(sourceCommand(2), agentContext)).branchRevision, 3);
});

test('request changes supersedes the review and returns the task to an explicit resumable state', async (context) => {
  const { studio, tasks, taskStore, created, agentContext } = await fixture(context);
  await tasks.execute(sourceCommand(2, 'changes-requested'), agentContext);
  const submitted = await tasks.submitReview(PROJECT_ID, created.task.taskId, {
    reviewId: 'review.cp4.changes-requested', actorId: OWNER.id,
  });
  const decided = await tasks.decideReview(PROJECT_ID, created.task.taskId, submitted.review.reviewId, [{
    changeId: submitted.review.items[0].changeId,
    disposition: 'CHANGES_REQUESTED',
    reason: 'Use the approved naming convention.',
  }], { actorId: OWNER.id });
  assert.equal(decided.review.state, 'SUPERSEDED');
  assert.equal(taskStore.getTask(PROJECT_ID, created.task.taskId).state, 'CHANGES_REQUESTED');
  await assert.rejects(
    tasks.execute(sourceCommand(3, 'blocked-before-resume', 'source.cp4.blocked'), agentContext),
    (error) => error.code === 'TASK_NOT_EXECUTABLE',
  );
  const resumed = await tasks.control(PROJECT_ID, created.task.taskId, 'resume', { actorId: OWNER.id });
  assert.equal(resumed.task.state, 'ACTIVE');
  await tasks.execute(sourceCommand(3, 'after-resume', 'source.cp4.after-resume'), agentContext);
  assert.equal((await studio.readProjectTrusted(PROJECT_ID)).revision, 2);
  assert.equal(taskStore.listBranchRevisions(PROJECT_ID, created.task.taskId).length, 2);
});

test('review compare records explicit same-object main/branch conflict', async (context) => {
  const { studio, tasks, created, agentContext } = await fixture(context);
  await tasks.execute(sourceCommand(2), agentContext);
  await studio.execute(sourceCommand(2, 'main'), OWNER_CONTEXT);
  const result = await tasks.submitReview(PROJECT_ID, created.task.taskId, {
    reviewId: 'review.cp4.source', actorId: OWNER.id,
  });
  assert.equal(result.review.state, 'OPEN');
  assert.equal(result.review.items.length, 1);
  assert.equal(result.review.conflicts.length, 1);
  assert.equal(result.review.conflicts[0].code, 'SEMANTIC_MERGE_CONFLICT');
});

test('agent room authoring cannot bypass the isolated task service onto main', async (context) => {
  const { studio, agentContext } = await fixture(context);
  await assert.rejects(studio.execute(command({
    commandId: 'cmd.cp4.main-room-bypass',
    idempotencyKey: 'idem.cp4.main-room-bypass',
    type: 'room.archetype.create',
    expectedVersion: 2,
    payload: {},
  }), agentContext), (error) => error.code === 'TASK_BRANCH_REQUIRED');
});

test('accepted branch changes merge atomically and revert through a new compensating revision', async (context) => {
  const { store, studio, tasks, created, agentContext } = await fixture(context);
  await tasks.execute(sourceCommand(2), agentContext);
  const submitted = await tasks.submitReview(PROJECT_ID, created.task.taskId, {
    reviewId: 'review.cp4.merge', actorId: OWNER.id,
  });
  await tasks.decideReview(PROJECT_ID, created.task.taskId, submitted.review.reviewId, [{
    changeId: submitted.review.items[0].changeId,
    disposition: 'USER_ACCEPTED',
    reason: 'Reviewed against the bounded task.',
  }], { actorId: OWNER.id });
  const merged = await tasks.mergeReview(PROJECT_ID, created.task.taskId, submitted.review.reviewId, {
    mergeId: 'merge.cp4.source', actorId: OWNER.id,
  });
  assert.equal(merged.replayed, false);
  assert.equal(merged.merge.mainParentRevision, 2);
  assert.equal(merged.merge.firstRevision, 3);
  assert.equal(merged.merge.lastRevision, 4);
  const afterMerge = await studio.readProjectTrusted(PROJECT_ID);
  assert.equal(afterMerge.revision, 4);
  assert.equal(afterMerge.snapshot.sources.length, 1);
  assert.ok(afterMerge.snapshot.grants.find(({ id }) => id === created.task.grantId).revokedAt);
  assert.equal(tasks.readTask(PROJECT_ID, created.task.taskId).task.state, 'MERGED');

  const reverted = await tasks.revertMerge(PROJECT_ID, merged.merge.mergeId, {
    revertId: 'revert.cp4.source', actorId: OWNER.id,
  });
  assert.equal(reverted.revert.compensatesMainRevisionRange.firstRevision, 3);
  const afterRevert = await store.loadProject(PROJECT_ID);
  assert.equal(afterRevert.revisions.at(-1).number, 5);
  assert.equal(afterRevert.revisions.at(-1).command.type, 'task.merge.revert');
  assert.equal(afterRevert.revisions.at(-1).snapshot.sources.length, 0);
  assert.equal(afterRevert.revisions.find(({ number }) => number === 3).snapshot.sources.length, 1);
  assert.ok(afterRevert.revisions.at(-1).snapshot.grants.find(({ id }) => id === created.task.grantId).revokedAt);
});
