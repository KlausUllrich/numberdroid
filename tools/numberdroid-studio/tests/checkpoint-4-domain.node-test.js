import assert from 'node:assert/strict';
import test from 'node:test';
import { createReviewFeedback, validateReviewFeedback } from '../packages/domain/src/agent-task.js';

test('review correction feedback requires bounded text and an exact positive review version', () => {
  const trusted = { actorId: 'human.owner', now: '2026-09-06T12:00:00.000Z', changesRequested: true };
  for (const raw of [
    {}, { feedbackSummary: 'Correct the anchor.' },
    { expectedReviewVersion: 1, feedbackSummary: ' \n ' },
    { expectedReviewVersion: 0, feedbackSummary: 'Correct the anchor.' },
    { expectedReviewVersion: 1, feedbackSummary: 'x'.repeat(4001) },
  ]) assert.throws(() => createReviewFeedback({ ...trusted, ...raw }), (error) => error.code === 'VALIDATION_ERROR');
  const value = createReviewFeedback({ ...trusted, expectedReviewVersion: 4, feedbackSummary: '  Correct the anchor.  ' });
  assert.deepEqual(value, { schemaVersion: 1, summary: 'Correct the anchor.', basisReviewVersion: 4, authorId: trusted.actorId, createdAt: trusted.now });
  assert.deepEqual(validateReviewFeedback(value), value);
  assert.equal(createReviewFeedback({ ...trusted, changesRequested: false }), null);
  assert.throws(() => validateReviewFeedback({ ...value, injectedAuthority: true }), (error) => error.code === 'VALIDATION_ERROR');
});
import {
  applyReviewDecisions,
  assertReviewMergeable,
  assertTaskCanExecute,
  createReviewItems,
  findSemanticConflicts,
  transitionAgentTask,
  validateAgentTaskSpec,
} from '../packages/domain/src/index.js';

const NOW = '2026-08-23T10:00:00.000Z';

function taskSpec(overrides = {}) {
  return {
    taskId: 'task.cp4.room',
    branchId: 'branch.task.cp4.room',
    agentId: 'agent.builder',
    title: 'Build room draft',
    objective: 'Create a bounded DRAFT room from accepted project assets.',
    capabilities: ['project.read', 'room.variant.resize'],
    objectScopes: [{ kind: 'project', id: 'project.demo' }],
    budget: { maxCommands: 20, maxJobs: 2, maxArtifactBytes: 1024, maxCostCents: 0 },
    expiresAt: '2026-08-23T12:00:00.000Z',
    autoAcceptPolicy: { enabled: false, allowedCommandTypes: [], maxChanges: 0 },
    ...overrides,
  };
}

function normalizedTask(overrides = {}) {
  return {
    ...validateAgentTaskSpec(taskSpec(), { now: NOW, projectId: 'project.demo', baseRevision: 8 }),
    state: 'ACTIVE',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function branchRevision(number, type, entityType, entityId) {
  return {
    id: `branch.task.cp4.room:revision:${number}`,
    number,
    committedAt: `2026-08-23T10:0${number}:00.000Z`,
    command: { type },
    event: {
      summary: `${type} committed`,
      changes: [{ entityType, entityId, operation: 'versioned' }],
    },
  };
}

test('Checkpoint 4 task contract rejects release/finalization authority and unbounded expiry', () => {
  assert.throws(
    () => validateAgentTaskSpec(taskSpec({ capabilities: ['room.variant.finalize'] }), {
      now: NOW, projectId: 'project.demo', baseRevision: 8,
    }),
    (error) => error.code === 'DELEGATION_CAPABILITY_FORBIDDEN',
  );
  assert.throws(
    () => validateAgentTaskSpec(taskSpec({ capabilities: ['project.read', 'room.variant.shape.set'] }), {
      now: NOW, projectId: 'project.demo', baseRevision: 8,
    }),
    (error) => error.code === 'DELEGATION_CAPABILITY_FORBIDDEN',
  );
  assert.throws(
    () => validateAgentTaskSpec(taskSpec({ expiresAt: '2026-09-23T10:00:00.000Z' }), {
      now: NOW, projectId: 'project.demo', baseRevision: 8,
    }),
    (error) => error.code === 'TASK_EXPIRY_TOO_LONG',
  );
});

test('Checkpoint 4 auto-accept is explicit, bounded, and never human approval', () => {
  const task = validateAgentTaskSpec(taskSpec({
    autoAcceptPolicy: {
      enabled: true,
      allowedCommandTypes: ['room.variant.resize'],
      maxChanges: 1,
    },
  }), { now: NOW, projectId: 'project.demo', baseRevision: 8 });
  const items = createReviewItems([
    branchRevision(9, 'room.variant.resize', 'room_variant', 'room.one'),
    branchRevision(10, 'room.variant.resize', 'room_variant', 'room.two'),
  ], task.autoAcceptPolicy);
  assert.equal(items[0].disposition, 'AUTO_ACCEPTED_BY_POLICY');
  assert.equal(items[0].decidedBy, 'policy');
  assert.equal(items[1].disposition, 'PENDING');
  assert.throws(
    () => applyReviewDecisions(items, [{
      changeId: items[0].changeId, disposition: 'USER_ACCEPTED', reason: 'Rewrite policy as user.',
    }], { actorId: 'owner.one', now: NOW }),
    (error) => error.code === 'POLICY_DECISION_IMMUTABLE',
  );
});

test('Checkpoint 4 task state and trusted branch identity fail closed', () => {
  const task = normalizedTask();
  const context = {
    actor: { kind: 'agent', id: 'agent.builder' },
    taskId: task.taskId,
    branchId: task.branchId,
  };
  assert.equal(assertTaskCanExecute(task, context, NOW), true);
  const paused = transitionAgentTask(task, 'pause', { now: '2026-08-23T10:01:00.000Z', reason: 'Human pause.' });
  assert.equal(paused.state, 'PAUSED');
  assert.throws(() => assertTaskCanExecute(paused, context, NOW), (error) => error.code === 'TASK_PAUSED');
  assert.throws(
    () => assertTaskCanExecute(task, { ...context, branchId: 'branch.other' }, NOW),
    (error) => error.code === 'TASK_BRANCH_MISMATCH',
  );
  assert.equal(transitionAgentTask(paused, 'resume', { now: '2026-08-23T10:02:00.000Z' }).state, 'ACTIVE');
});

test('Checkpoint 4 semantic comparison reports overlapping object changes', () => {
  const branch = [branchRevision(9, 'room.variant.resize', 'room_variant', 'room.one')];
  const main = [{
    number: 12,
    command: { type: 'room.variant.connectors.set' },
    event: { changes: [{ entityType: 'room_variant', entityId: 'room.one', operation: 'versioned' }] },
  }];
  const conflicts = findSemanticConflicts(branch, main);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].code, 'SEMANTIC_MERGE_CONFLICT');
  assert.equal(conflicts[0].entityId, 'room.one');
  assert.equal(findSemanticConflicts(branch, [{
    number: 12,
    command: { type: 'asset.define' },
    event: { changes: [{ entityType: 'asset', entityId: 'asset.other', operation: 'created' }] },
  }]).length, 0);
});

test('Checkpoint 4 merge gate requires terminal decisions, no conflicts, and an accepted change', () => {
  const items = createReviewItems([
    branchRevision(9, 'room.variant.resize', 'room_variant', 'room.one'),
  ], { enabled: false, allowedCommandTypes: [], maxChanges: 0 });
  assert.throws(
    () => assertReviewMergeable({ state: 'OPEN', conflicts: [], items }),
    (error) => error.code === 'REVIEW_INCOMPLETE',
  );
  const decided = applyReviewDecisions(items, [{
    changeId: items[0].changeId, disposition: 'USER_ACCEPTED', reason: 'Reviewed.',
  }], { actorId: 'owner.one', now: NOW });
  assert.equal(assertReviewMergeable({ state: 'OPEN', conflicts: [], items: decided }).length, 1);
  assert.throws(
    () => assertReviewMergeable({ state: 'OPEN', conflicts: [{ code: 'SEMANTIC_MERGE_CONFLICT' }], items: decided }),
    (error) => error.code === 'SEMANTIC_MERGE_CONFLICT',
  );
});
