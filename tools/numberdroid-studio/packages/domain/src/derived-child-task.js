import { invariant } from './errors.js';
import { requireId, requireInteger, requireIsoDate, requireRecord, requireString } from './validation.js';
import { LEVEL_CANDIDATE_CREATE_REQUIRED_SCOPE } from './level-candidate-authority.js';

export const DERIVED_CHILD_CREATE_REQUIRED_SCOPE = 'task.child.derive';
export const DERIVED_CHILD_PRIVATE_GRANT_SCOPES = Object.freeze([
  DERIVED_CHILD_CREATE_REQUIRED_SCOPE,
]);

const REQUEST_FIELDS = new Set([
  'schemaVersion', 'idempotencyKey', 'title', 'objective', 'expectedParentHeadRevision',
]);

function exactFields(value, allowed, label) {
  for (const field of Object.keys(value)) {
    invariant(allowed.has(field), 'DERIVED_CHILD_REQUEST_INVALID', `${label}.${field} is not permitted.`, { field });
  }
}

function budget(raw) {
  const value = requireRecord(raw, 'request.budget');
  exactFields(value, new Set(['maxCommands', 'maxJobs', 'maxArtifactBytes', 'maxCostCents']), 'request.budget');
  return {
    maxCommands: requireInteger(value.maxCommands, 'request.budget.maxCommands', { min: 1, max: 10000 }),
    maxJobs: requireInteger(value.maxJobs, 'request.budget.maxJobs', { min: 0, max: 1000 }),
    maxArtifactBytes: requireInteger(value.maxArtifactBytes, 'request.budget.maxArtifactBytes', { min: 0, max: 10737418240 }),
    maxCostCents: requireInteger(value.maxCostCents, 'request.budget.maxCostCents', { min: 0, max: 1000000 }),
  };
}

export function normalizeDerivedChildTaskRequest(raw, { now }) {
  const request = requireRecord(raw, 'request');
  exactFields(request, REQUEST_FIELDS, 'request');
  invariant(request.schemaVersion === 1, 'DERIVED_CHILD_REQUEST_INVALID', 'Only derived-child request schema version 1 is supported.');
  requireIsoDate(now, 'now');
  return Object.freeze({
    schemaVersion: 1,
    idempotencyKey: requireString(request.idempotencyKey, 'request.idempotencyKey', { max: 512 }),
    title: requireString(request.title, 'request.title', { max: 160 }),
    objective: requireString(request.objective, 'request.objective', { max: 4000 }),
    expectedParentHeadRevision: requireInteger(
      request.expectedParentHeadRevision,
      'request.expectedParentHeadRevision',
      { min: 1 },
    ),
  });
}

export function normalizeDerivedChildPolicy(raw) {
  const policy = requireRecord(raw, 'policy');
  exactFields(policy, new Set(['budget', 'ttlSeconds']), 'policy');
  return Object.freeze({
    budget: budget(policy.budget),
    ttlSeconds: requireInteger(policy.ttlSeconds, 'policy.ttlSeconds', { min: 1, max: 604800 }),
  });
}

export function assertCandidateChildAttenuation(parentTask) {
  invariant(parentTask.capabilities.includes(DERIVED_CHILD_CREATE_REQUIRED_SCOPE),
    'TASK_CAPABILITY_MISSING', 'The parent task lacks private child-derivation authority.');
  invariant(parentTask.capabilities.includes(LEVEL_CANDIDATE_CREATE_REQUIRED_SCOPE),
    'TASK_CAPABILITY_MISSING', 'The parent task cannot attenuate Level Candidate authority it does not possess.');
  return true;
}

export function candidateChildCapabilities() {
  return Object.freeze([LEVEL_CANDIDATE_CREATE_REQUIRED_SCOPE]);
}

export function zeroTaskBudgetUsage() {
  return { commands: 0, jobs: 0, artifactBytes: 0, costCents: 0 };
}

export function addBudgetUsage(left, right, code = 'BUDGET_EXCEEDED') {
  const result = {};
  for (const [usageField, budgetField] of [
    ['commands', 'maxCommands'], ['jobs', 'maxJobs'],
    ['artifactBytes', 'maxArtifactBytes'], ['costCents', 'maxCostCents'],
  ]) {
    const a = requireInteger(left[usageField], `usage.${usageField}`, { min: 0 });
    const b = requireInteger(right[budgetField], `budget.${budgetField}`, { min: 0 });
    invariant(a <= Number.MAX_SAFE_INTEGER - b, code, 'Budget reservation overflowed.', { dimension: usageField });
    result[usageField] = a + b;
  }
  return result;
}

export function assertBudgetReservationFits(usage, reservation, budgetLimit) {
  const reserved = addBudgetUsage(usage, reservation);
  for (const [usageField, budgetField] of [
    ['commands', 'maxCommands'], ['jobs', 'maxJobs'],
    ['artifactBytes', 'maxArtifactBytes'], ['costCents', 'maxCostCents'],
  ]) {
    invariant(reserved[usageField] <= budgetLimit[budgetField],
      'BUDGET_EXCEEDED', 'The child reservation exceeds the parent remaining budget.', {
        dimension: usageField,
        consumedOrReserved: usage[usageField],
        requested: reservation[budgetField],
        limit: budgetLimit[budgetField],
      });
  }
  return reserved;
}

export function requireDerivedChildContext(raw) {
  const context = requireRecord(raw, 'trustedContext');
  exactFields(context, new Set(['actor', 'taskId', 'grantId', 'branchId']), 'trustedContext');
  const actor = requireRecord(context.actor, 'trustedContext.actor');
  invariant(Object.keys(actor).every((field) => ['id', 'kind', 'displayName'].includes(field)),
    'DERIVED_CHILD_CONTEXT_INVALID', 'trustedContext.actor contains unsupported fields.');
  invariant(actor.kind === 'agent', 'DERIVED_CHILD_CONTEXT_INVALID', 'Child derivation requires a trusted agent context.');
  return Object.freeze({
    actor: { id: requireId(actor.id, 'trustedContext.actor.id'), kind: 'agent' },
    taskId: requireId(context.taskId, 'trustedContext.taskId'),
    grantId: requireId(context.grantId, 'trustedContext.grantId'),
    branchId: requireId(context.branchId, 'trustedContext.branchId'),
  });
}
