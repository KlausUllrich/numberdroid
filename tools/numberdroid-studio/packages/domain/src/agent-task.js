import { invariant } from './errors.js';
import { requireId, requireInteger, requireIsoDate, requireRecord, requireString } from './validation.js';

export const AGENT_TASK_STATES = Object.freeze([
  'ACTIVE', 'PAUSED', 'IN_REVIEW', 'CHANGES_REQUESTED', 'MERGED', 'REJECTED', 'CANCELLED',
]);

export const REVIEW_DISPOSITIONS = Object.freeze([
  'PENDING', 'USER_ACCEPTED', 'USER_REJECTED', 'CHANGES_REQUESTED', 'AUTO_ACCEPTED_BY_POLICY',
]);

const TERMINAL_TASK_STATES = new Set(['MERGED', 'REJECTED', 'CANCELLED']);
const FORBIDDEN_DELEGATED_CAPABILITIES = new Set([
  'grant.issue', 'grant.revoke', 'asset.lifecycle.set', 'room.variant.warning.disposition.set',
  'room.variant.shape.set', 'room.variant.finalize', 'project.export', 'project.materialize', 'project.publish',
]);
const FORBIDDEN_AUTO_ACCEPT_COMMANDS = new Set([
  ...FORBIDDEN_DELEGATED_CAPABILITIES, 'project.create', 'source.review.decide',
  'asset.proposal.decide', 'asset.proposal.apply', 'room.placement.proposal.decide',
  'room.placement.proposal.apply', 'room.variant.validate', 'room.variant.fork',
  'asset.processing-result.adopt', 'level.candidate.create',
]);

function exactKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    invariant(allowed.has(key), 'VALIDATION_ERROR', `${label} contains an unsupported field: ${key}.`, { field: key });
  }
}

function sortedUniqueIds(value, label, { maxItems = 128 } = {}) {
  invariant(Array.isArray(value) && value.length > 0 && value.length <= maxItems, 'VALIDATION_ERROR', `${label} must be a non-empty bounded array.`);
  const result = value.map((entry) => requireId(entry, `${label}[]`));
  invariant(new Set(result).size === result.length, 'VALIDATION_ERROR', `${label} must not contain duplicates.`);
  return [...result].sort();
}

function validateObjectScopes(value, projectId) {
  invariant(Array.isArray(value) && value.length > 0 && value.length <= 128, 'VALIDATION_ERROR', 'objectScopes must be a non-empty bounded array.');
  const scopes = value.map((raw, index) => {
    const scope = requireRecord(raw, `objectScopes[${index}]`);
    exactKeys(scope, new Set(['kind', 'id']), `objectScopes[${index}]`);
    return { kind: requireId(scope.kind, `objectScopes[${index}].kind`), id: requireId(scope.id, `objectScopes[${index}].id`) };
  });
  invariant(scopes.every((scope) => scope.kind !== 'project' || scope.id === projectId), 'OBJECT_SCOPE_DENIED', 'A project object scope must match the task project.', { projectId });
  const keys = scopes.map((scope) => `${scope.kind}\0${scope.id}`);
  invariant(new Set(keys).size === keys.length, 'VALIDATION_ERROR', 'objectScopes must not contain duplicates.');
  return scopes.sort((left, right) => `${left.kind}:${left.id}`.localeCompare(`${right.kind}:${right.id}`));
}

function validateBudget(raw) {
  const budget = requireRecord(raw, 'budget');
  exactKeys(budget, new Set(['maxCommands', 'maxJobs', 'maxArtifactBytes', 'maxCostCents']), 'budget');
  return {
    maxCommands: requireInteger(budget.maxCommands, 'budget.maxCommands', { min: 1, max: 10000 }),
    maxJobs: requireInteger(budget.maxJobs, 'budget.maxJobs', { min: 0, max: 1000 }),
    maxArtifactBytes: requireInteger(budget.maxArtifactBytes, 'budget.maxArtifactBytes', { min: 0, max: 10737418240 }),
    maxCostCents: requireInteger(budget.maxCostCents, 'budget.maxCostCents', { min: 0, max: 1000000 }),
  };
}

function validateAutoAcceptPolicy(raw, capabilities) {
  const policy = requireRecord(raw ?? { enabled: false, allowedCommandTypes: [], maxChanges: 0 }, 'autoAcceptPolicy');
  exactKeys(policy, new Set(['enabled', 'allowedCommandTypes', 'maxChanges']), 'autoAcceptPolicy');
  invariant(typeof policy.enabled === 'boolean', 'VALIDATION_ERROR', 'autoAcceptPolicy.enabled must be boolean.');
  const allowedCommandTypes = policy.allowedCommandTypes ?? [];
  invariant(Array.isArray(allowedCommandTypes) && allowedCommandTypes.length <= 32, 'VALIDATION_ERROR', 'autoAcceptPolicy.allowedCommandTypes must be a bounded array.');
  const normalized = allowedCommandTypes.map((type) => requireId(type, 'autoAcceptPolicy.allowedCommandTypes[]'));
  invariant(new Set(normalized).size === normalized.length, 'VALIDATION_ERROR', 'Auto-accept command types must be unique.');
  invariant(normalized.every((type) => capabilities.includes(type)), 'AUTO_ACCEPT_OUTSIDE_CAPABILITIES', 'Auto-accept may only cover delegated capabilities.');
  const forbidden = normalized.find((type) => FORBIDDEN_AUTO_ACCEPT_COMMANDS.has(type));
  invariant(!forbidden, 'AUTO_ACCEPT_FORBIDDEN', 'A human-only or lifecycle command cannot be auto-accepted.', { commandType: forbidden });
  const maxChanges = requireInteger(policy.maxChanges ?? 0, 'autoAcceptPolicy.maxChanges', { min: 0, max: 1000 });
  invariant(
    policy.enabled ? normalized.length > 0 && maxChanges > 0 : normalized.length === 0 && maxChanges === 0,
    'VALIDATION_ERROR',
    'Disabled auto-accept must have an empty allowlist and zero limit; enabled auto-accept needs both.',
  );
  return { enabled: policy.enabled, allowedCommandTypes: [...normalized].sort(), maxChanges };
}

export function validateAgentTaskSpec(raw, { now, projectId, baseRevision }) {
  const task = requireRecord(raw, 'task');
  exactKeys(task, new Set([
    'taskId', 'branchId', 'agentId', 'title', 'objective', 'capabilities', 'objectScopes',
    'budget', 'expiresAt', 'autoAcceptPolicy',
  ]), 'task');
  const normalizedProjectId = requireId(projectId, 'projectId');
  const normalizedNow = requireIsoDate(now, 'now');
  const capabilities = sortedUniqueIds(task.capabilities, 'capabilities', { maxItems: 64 });
  const forbidden = capabilities.find((capability) => FORBIDDEN_DELEGATED_CAPABILITIES.has(capability));
  invariant(!forbidden, 'DELEGATION_CAPABILITY_FORBIDDEN', 'Checkpoint 4 cannot delegate finalization, authority, export, materialization, or publish capabilities.', { capability: forbidden });
  const expiresAt = requireIsoDate(task.expiresAt, 'expiresAt');
  invariant(Date.parse(expiresAt) > Date.parse(normalizedNow), 'TASK_EXPIRED', 'Task expiry must be in the future.');
  invariant(Date.parse(expiresAt) <= Date.parse(normalizedNow) + (7 * 24 * 60 * 60 * 1000), 'TASK_EXPIRY_TOO_LONG', 'Task expiry may be at most seven days.');
  return {
    schemaVersion: 1,
    taskId: requireId(task.taskId, 'taskId'),
    projectId: normalizedProjectId,
    branchId: requireId(task.branchId, 'branchId'),
    agentId: requireId(task.agentId, 'agentId'),
    title: requireString(task.title, 'title', { max: 160 }),
    objective: requireString(task.objective, 'objective', { max: 4000 }),
    baseRevision: requireInteger(baseRevision, 'baseRevision', { min: 1 }),
    capabilities,
    objectScopes: validateObjectScopes(task.objectScopes, normalizedProjectId),
    budget: validateBudget(task.budget),
    usage: { commands: 0, jobs: 0, artifactBytes: 0, costCents: 0 },
    expiresAt,
    autoAcceptPolicy: validateAutoAcceptPolicy(task.autoAcceptPolicy, capabilities),
  };
}

export function assertTaskCanExecute(task, context, now) {
  invariant(task && typeof task === 'object', 'TASK_NOT_FOUND', 'The agent task does not exist.');
  invariant(task.state === 'ACTIVE', task.state === 'PAUSED' ? 'TASK_PAUSED' : 'TASK_NOT_EXECUTABLE', 'The agent task is not executable.', { state: task.state });
  invariant(Date.parse(task.expiresAt) > Date.parse(requireIsoDate(now, 'now')), 'TASK_EXPIRED', 'The agent task has expired.');
  invariant(context?.actor?.kind === 'agent' && context.actor.id === task.agentId, 'TASK_ACTOR_MISMATCH', 'The trusted actor does not match the task agent.');
  invariant(context.taskId === task.taskId, 'TASK_CONTEXT_MISMATCH', 'The trusted task does not match the task branch.');
  invariant(context.branchId === task.branchId, 'TASK_BRANCH_MISMATCH', 'The trusted branch does not match the task branch.');
  return true;
}

export function transitionAgentTask(task, action, { now, reason = null } = {}) {
  invariant(!TERMINAL_TASK_STATES.has(task.state), 'TASK_TERMINAL', 'A terminal task cannot transition.', { state: task.state });
  const transitions = {
    pause: { from: ['ACTIVE'], to: 'PAUSED' },
    resume: { from: ['PAUSED', 'CHANGES_REQUESTED'], to: 'ACTIVE' },
    submit: { from: ['ACTIVE'], to: 'IN_REVIEW' },
    request_changes: { from: ['IN_REVIEW'], to: 'CHANGES_REQUESTED' },
    reject: { from: ['IN_REVIEW', 'CHANGES_REQUESTED'], to: 'REJECTED' },
    cancel: { from: ['ACTIVE', 'PAUSED', 'IN_REVIEW', 'CHANGES_REQUESTED'], to: 'CANCELLED' },
    merge: { from: ['IN_REVIEW'], to: 'MERGED' },
  };
  const transition = transitions[action];
  invariant(transition && transition.from.includes(task.state), 'TASK_STATE_CONFLICT', 'The task action is invalid for its current state.', { action, state: task.state });
  return { ...structuredClone(task), state: transition.to, updatedAt: requireIsoDate(now, 'now'), stateReason: reason };
}

export function semanticChangeKey(change) {
  return `${requireId(change?.entityType, 'change.entityType')}:${requireId(change?.entityId, 'change.entityId')}`;
}

export function findSemanticConflicts(branchRevisions, mainRevisionsAfterBase) {
  const mainByKey = new Map();
  for (const revision of mainRevisionsAfterBase) {
    for (const change of revision.event?.changes ?? []) {
      const key = semanticChangeKey(change);
      const entries = mainByKey.get(key) ?? [];
      entries.push({ revision: revision.number, commandType: revision.command.type, operation: change.operation });
      mainByKey.set(key, entries);
    }
  }
  const findings = [];
  for (const revision of branchRevisions) {
    for (const change of revision.event?.changes ?? []) {
      const key = semanticChangeKey(change);
      if (!mainByKey.has(key)) continue;
      findings.push({
        findingId: `conflict:${revision.id}:${key}`,
        severity: 'ERROR',
        code: 'SEMANTIC_MERGE_CONFLICT',
        changeId: revision.id,
        entityType: change.entityType,
        entityId: change.entityId,
        branchOperation: change.operation,
        mainChanges: structuredClone(mainByKey.get(key)),
      });
    }
  }
  return findings;
}

export function createReviewItems(branchRevisions, autoAcceptPolicy) {
  let autoAccepted = 0;
  return branchRevisions.map((revision, index) => {
    const eligible = autoAcceptPolicy.enabled
      && autoAcceptPolicy.allowedCommandTypes.includes(revision.command.type)
      && autoAccepted < autoAcceptPolicy.maxChanges;
    if (eligible) autoAccepted += 1;
    return {
      changeId: revision.id,
      ordinal: index + 1,
      branchRevision: revision.number,
      commandType: revision.command.type,
      summary: revision.event.summary,
      changes: structuredClone(revision.event.changes ?? []),
      disposition: eligible ? 'AUTO_ACCEPTED_BY_POLICY' : 'PENDING',
      reason: eligible ? 'Matched the explicit task auto-accept allowlist.' : null,
      decidedAt: eligible ? revision.committedAt : null,
      decidedBy: eligible ? 'policy' : null,
    };
  });
}

export function applyReviewDecisions(items, decisions, { actorId, now }) {
  invariant(Array.isArray(decisions) && decisions.length > 0, 'VALIDATION_ERROR', 'Review decisions must be a non-empty array.');
  const byId = new Map(items.map((item) => [item.changeId, structuredClone(item)]));
  const seen = new Set();
  for (const raw of decisions) {
    const decision = requireRecord(raw, 'decision');
    exactKeys(decision, new Set(['changeId', 'disposition', 'reason']), 'decision');
    const changeId = requireId(decision.changeId, 'decision.changeId');
    invariant(!seen.has(changeId), 'VALIDATION_ERROR', 'A review decision may appear only once.', { changeId });
    seen.add(changeId);
    const item = byId.get(changeId);
    invariant(item, 'REVIEW_CHANGE_NOT_FOUND', 'The review change does not exist.', { changeId });
    invariant(item.disposition !== 'AUTO_ACCEPTED_BY_POLICY', 'POLICY_DECISION_IMMUTABLE', 'A policy disposition cannot be rewritten as user approval.');
    invariant(['USER_ACCEPTED', 'USER_REJECTED', 'CHANGES_REQUESTED'].includes(decision.disposition), 'VALIDATION_ERROR', 'Unsupported human review disposition.');
    item.disposition = decision.disposition;
    item.reason = decision.reason === null ? null : requireString(decision.reason, 'decision.reason', { max: 2000 });
    item.decidedAt = requireIsoDate(now, 'now');
    item.decidedBy = requireId(actorId, 'actorId');
  }
  return [...byId.values()].sort((left, right) => left.ordinal - right.ordinal);
}

export function assertReviewMergeable(review) {
  invariant(review?.state === 'OPEN', 'REVIEW_STATE_CONFLICT', 'Only an open review can merge.');
  invariant((review.conflicts ?? []).length === 0, 'SEMANTIC_MERGE_CONFLICT', 'The review contains unresolved semantic conflicts.', { conflicts: review.conflicts });
  const pending = review.items.filter((item) => ['PENDING', 'CHANGES_REQUESTED'].includes(item.disposition));
  invariant(pending.length === 0, 'REVIEW_INCOMPLETE', 'Every review change needs a terminal disposition.', { pendingChangeIds: pending.map((item) => item.changeId) });
  const accepted = review.items.filter((item) => ['USER_ACCEPTED', 'AUTO_ACCEPTED_BY_POLICY'].includes(item.disposition));
  invariant(accepted.length > 0, 'REVIEW_NOTHING_ACCEPTED', 'At least one branch change must be accepted before merge.');
  return accepted;
}
