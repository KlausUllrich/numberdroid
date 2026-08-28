import { types as utilTypes } from 'node:util';
import {
  PROCESSING_RESULT_ADOPTION_AUTHORITY_BINDING_KIND,
  PROCESSING_RESULT_ADOPTION_COMMAND_TYPE,
  PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE,
  PROCESSING_RESULT_ADOPTION_SCHEMA_VERSION,
  createProcessingResultAdoptionPlanningResult,
  validateProcessingResultAdoptionCommand,
} from '../../domain/src/processing-result-adoption.js';
import {
  processingAdoptionPreflightRequestSha256,
  validateProcessingAdoptionPreflightReceipt,
} from '../../domain/src/processing-adoption-preflight.js';
import { StudioError, invariant } from '../../domain/src/errors.js';
import {
  requireActor,
  requireId,
  requireInteger,
  requireIsoDate,
} from '../../domain/src/validation.js';
import { deepFreeze } from './value-utils.js';

export const PROCESSING_ADOPTION_TASK_AUTHORITY_READER_SCHEMA_VERSION = 1;
export const PROCESSING_ADOPTION_TASK_AUTHORITY_READER_KIND = 'studio.processing-adoption.task-authority-reader';
export const PROCESSING_ADOPTION_TASK_AUTHORITY_EVIDENCE_KIND = 'studio.processing-adoption.task-authority-evidence';
export const PROCESSING_ADOPTION_TASK_BRANCH_PREFLIGHT_READER_SCHEMA_VERSION = 1;
export const PROCESSING_ADOPTION_TASK_BRANCH_PREFLIGHT_READER_KIND = 'studio.processing-adoption.task-branch-preflight-reader';
export const PROCESSING_ADOPTION_TASK_BRANCH_PREFLIGHT_EVIDENCE_KIND = 'studio.processing-adoption.task-branch-preflight-evidence';

const TASK_STATES = Object.freeze([
  'ACTIVE', 'PAUSED', 'IN_REVIEW', 'CHANGES_REQUESTED', 'MERGED', 'REJECTED', 'CANCELLED',
]);
const GRANT_STATUSES = Object.freeze(['ACTIVE', 'REVOKED', 'LEGACY_UNBOUND']);

function snapshotPlainData(value, label, state = { ancestors: new WeakSet(), nodes: 0 }, depth = 0) {
  state.nodes += 1;
  invariant(
    state.nodes <= 4096 && depth <= 32,
    'PROCESSING_ADOPTION_PORT_RESPONSE_INVALID',
    `${label} exceeds the bounded plain-data graph accepted by the planning seam.`,
    { port: label },
  );
  if (value === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof value)) return value;
  invariant(
    typeof value === 'object' && !utilTypes.isProxy(value),
    'PROCESSING_ADOPTION_PORT_RESPONSE_INVALID',
    `${label} must be plain inspectable data.`,
    { port: label },
  );
  invariant(
    !state.ancestors.has(value),
    'PROCESSING_ADOPTION_PORT_RESPONSE_INVALID',
    `${label} must not contain cycles.`,
    { port: label },
  );
  state.ancestors.add(value);
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    invariant(false, 'PROCESSING_ADOPTION_PORT_RESPONSE_INVALID', `${label} must be inspectable.`, { port: label });
  }
  if (Array.isArray(value)) {
    invariant(prototype === Array.prototype, 'PROCESSING_ADOPTION_PORT_RESPONSE_INVALID', `${label} must be a plain array.`, { port: label });
    let length;
    try {
      length = Object.getOwnPropertyDescriptor(value, 'length')?.value;
    } catch {
      invariant(false, 'PROCESSING_ADOPTION_PORT_RESPONSE_INVALID', `${label} must expose an inspectable length.`, { port: label });
    }
    invariant(Number.isSafeInteger(length) && length >= 0 && length <= 256, 'PROCESSING_ADOPTION_PORT_RESPONSE_INVALID', `${label} must be a bounded array.`, { port: label });
    const allowed = new Set(['length', ...Array.from({ length }, (_, index) => String(index))]);
    invariant(keys.every((key) => typeof key === 'string' && allowed.has(key)), 'PROCESSING_ADOPTION_PORT_RESPONSE_INVALID', `${label} contains forbidden array fields.`, { port: label });
    const result = new Array(length);
    for (let index = 0; index < length; index += 1) {
      let descriptor;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      } catch {
        invariant(false, 'PROCESSING_ADOPTION_PORT_RESPONSE_INVALID', `${label}[${index}] must be inspectable.`, { port: label });
      }
      invariant(descriptor && Object.hasOwn(descriptor, 'value') && descriptor.enumerable === true, 'PROCESSING_ADOPTION_PORT_RESPONSE_INVALID', `${label} must not contain sparse or accessor entries.`, { port: label });
      Object.defineProperty(result, String(index), {
        configurable: true,
        enumerable: true,
        writable: true,
        value: snapshotPlainData(descriptor.value, `${label}[${index}]`, state, depth + 1),
      });
    }
    state.ancestors.delete(value);
    return result;
  }
  invariant(prototype === Object.prototype || prototype === null, 'PROCESSING_ADOPTION_PORT_RESPONSE_INVALID', `${label} must be a plain object.`, { port: label });
  const result = Object.create(null);
  for (const key of keys) {
    invariant(typeof key === 'string', 'PROCESSING_ADOPTION_PORT_RESPONSE_INVALID', `${label} must not contain symbols.`, { port: label });
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      invariant(false, 'PROCESSING_ADOPTION_PORT_RESPONSE_INVALID', `${label}.${key} must be inspectable.`, { port: label });
    }
    invariant(descriptor && Object.hasOwn(descriptor, 'value') && descriptor.enumerable === true, 'PROCESSING_ADOPTION_PORT_RESPONSE_INVALID', `${label}.${key} must be an enumerable data field.`, { port: label });
    result[key] = snapshotPlainData(descriptor.value, `${label}.${key}`, state, depth + 1);
  }
  state.ancestors.delete(value);
  return result;
}

function exactRecord(value, allowed, label, code = 'PROCESSING_ADOPTION_PORT_RESPONSE_INVALID') {
  invariant(value !== null && typeof value === 'object' && !Array.isArray(value), code, `${label} must be an object.`, { port: label });
  invariant(Object.keys(value).every((field) => allowed.includes(field)), code, `${label} contains fields outside its v1 contract.`, { port: label });
  return value;
}

function exactPort(value, allowed, label) {
  invariant(
    value !== null && typeof value === 'object' && !Array.isArray(value) && !utilTypes.isProxy(value),
    'PROCESSING_ADOPTION_PORT_INVALID',
    `${label} must be an inspectable plain object.`,
    { port: label },
  );
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    invariant(false, 'PROCESSING_ADOPTION_PORT_INVALID', `${label} must be inspectable.`, { port: label });
  }
  invariant(prototype === Object.prototype || prototype === null, 'PROCESSING_ADOPTION_PORT_INVALID', `${label} must be a plain object.`, { port: label });
  invariant(keys.length === allowed.length && keys.every((key) => typeof key === 'string' && allowed.includes(key)), 'PROCESSING_ADOPTION_PORT_INVALID', `${label} exposes fields outside its read-only v1 contract.`, { port: label });
  const snapshot = Object.create(null);
  for (const field of allowed) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, field);
    } catch {
      invariant(false, 'PROCESSING_ADOPTION_PORT_INVALID', `${label}.${field} must be inspectable.`, { port: label });
    }
    invariant(descriptor && Object.hasOwn(descriptor, 'value') && descriptor.enumerable === true, 'PROCESSING_ADOPTION_PORT_INVALID', `${label}.${field} must be an enumerable own data field.`, { port: label });
    snapshot[field] = descriptor.value;
  }
  return snapshot;
}

function exactServiceOptions(value) {
  const allowed = ['taskAuthorityReader', 'taskBranchPreflightReader', 'clock'];
  invariant(
    value !== null && typeof value === 'object' && !Array.isArray(value) && !utilTypes.isProxy(value),
    'PROCESSING_ADOPTION_PORT_INVALID',
    'Processing adoption planning options must be an inspectable plain object.',
    { port: 'options' },
  );
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    invariant(false, 'PROCESSING_ADOPTION_PORT_INVALID', 'Processing adoption planning options must be inspectable.', { port: 'options' });
  }
  invariant(prototype === Object.prototype || prototype === null, 'PROCESSING_ADOPTION_PORT_INVALID', 'Processing adoption planning options must be a plain object.', { port: 'options' });
  invariant(keys.every((key) => typeof key === 'string' && allowed.includes(key)), 'PROCESSING_ADOPTION_PORT_INVALID', 'Processing adoption planning options contain fields outside the v1 contract.', { port: 'options' });
  const snapshot = Object.create(null);
  for (const field of allowed) {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    if (!descriptor) continue;
    invariant(Object.hasOwn(descriptor, 'value') && descriptor.enumerable === true, 'PROCESSING_ADOPTION_PORT_INVALID', `Processing adoption planning option ${field} must be an enumerable own data field.`, { port: 'options' });
    snapshot[field] = descriptor.value;
  }
  invariant(Object.hasOwn(snapshot, 'taskAuthorityReader') && Object.hasOwn(snapshot, 'taskBranchPreflightReader'), 'PROCESSING_ADOPTION_PORT_INVALID', 'Processing adoption planning requires both read-only ports.', { port: 'options' });
  return snapshot;
}

function exactPrepareOptions(value) {
  invariant(
    value !== null && typeof value === 'object' && !Array.isArray(value) && !utilTypes.isProxy(value),
    'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID',
    'Processing adoption prepare options must be an inspectable plain object.',
  );
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    invariant(false, 'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID', 'Processing adoption prepare options must be inspectable.');
  }
  invariant(prototype === Object.prototype || prototype === null, 'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID', 'Processing adoption prepare options must be a plain object.');
  invariant(keys.every((key) => key === 'signal'), 'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID', 'Processing adoption prepare options contain fields outside the v1 contract.');
  const descriptor = Object.getOwnPropertyDescriptor(value, 'signal');
  invariant(!descriptor || (Object.hasOwn(descriptor, 'value') && descriptor.enumerable === true), 'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID', 'Processing adoption signal must be an enumerable own data field.');
  return descriptor?.value;
}

export function validateProcessingAdoptionTaskAuthorityReader(value) {
  const port = exactPort(value, ['schemaVersion', 'kind', 'readTaskAuthority'], 'taskAuthorityReader');
  invariant(port.schemaVersion === PROCESSING_ADOPTION_TASK_AUTHORITY_READER_SCHEMA_VERSION && port.kind === PROCESSING_ADOPTION_TASK_AUTHORITY_READER_KIND, 'PROCESSING_ADOPTION_PORT_INVALID', 'Unsupported processing adoption task-authority reader.', { port: 'taskAuthorityReader' });
  invariant(typeof port.readTaskAuthority === 'function', 'PROCESSING_ADOPTION_PORT_INVALID', 'The task-authority reader must expose readTaskAuthority(selection, context).', { port: 'taskAuthorityReader' });
  const implementation = port.readTaskAuthority;
  return Object.freeze({
    schemaVersion: PROCESSING_ADOPTION_TASK_AUTHORITY_READER_SCHEMA_VERSION,
    kind: PROCESSING_ADOPTION_TASK_AUTHORITY_READER_KIND,
    readTaskAuthority: (selection, context) => implementation.call(value, selection, context),
  });
}

export function validateProcessingAdoptionTaskBranchPreflightReader(value) {
  const port = exactPort(value, ['schemaVersion', 'kind', 'preflightTaskBranch'], 'taskBranchPreflightReader');
  invariant(port.schemaVersion === PROCESSING_ADOPTION_TASK_BRANCH_PREFLIGHT_READER_SCHEMA_VERSION && port.kind === PROCESSING_ADOPTION_TASK_BRANCH_PREFLIGHT_READER_KIND, 'PROCESSING_ADOPTION_PORT_INVALID', 'Unsupported processing adoption task-branch preflight reader.', { port: 'taskBranchPreflightReader' });
  invariant(typeof port.preflightTaskBranch === 'function', 'PROCESSING_ADOPTION_PORT_INVALID', 'The task-branch preflight reader must expose preflightTaskBranch(selection, context).', { port: 'taskBranchPreflightReader' });
  const implementation = port.preflightTaskBranch;
  return Object.freeze({
    schemaVersion: PROCESSING_ADOPTION_TASK_BRANCH_PREFLIGHT_READER_SCHEMA_VERSION,
    kind: PROCESSING_ADOPTION_TASK_BRANCH_PREFLIGHT_READER_KIND,
    preflightTaskBranch: (selection, context) => implementation.call(value, selection, context),
  });
}

function requireNullableIsoDate(value, label) {
  return value === null ? null : requireIsoDate(value, label);
}

function sortedUniqueIds(value, label, { allowEmpty = false } = {}) {
  invariant(Array.isArray(value) && (allowEmpty || value.length > 0) && value.length <= 128, 'PROCESSING_ADOPTION_PORT_RESPONSE_INVALID', `${label} must be a bounded array.`, { port: label });
  const result = value.map((entry) => requireId(entry, `${label}[]`));
  invariant(new Set(result).size === result.length, 'PROCESSING_ADOPTION_PORT_RESPONSE_INVALID', `${label} must not contain duplicates.`, { port: label });
  return result.sort();
}

function normalizeObjectScopes(value, label) {
  invariant(Array.isArray(value) && value.length > 0 && value.length <= 128, 'PROCESSING_ADOPTION_PORT_RESPONSE_INVALID', `${label} must be a bounded non-empty array.`, { port: label });
  const scopes = value.map((candidate, index) => {
    const scope = exactRecord(candidate, ['kind', 'id'], `${label}[${index}]`);
    return { kind: requireId(scope.kind, `${label}[${index}].kind`), id: requireId(scope.id, `${label}[${index}].id`) };
  });
  const identities = scopes.map(({ kind, id }) => `${kind}\0${id}`);
  invariant(new Set(identities).size === identities.length, 'PROCESSING_ADOPTION_PORT_RESPONSE_INVALID', `${label} must not contain duplicates.`, { port: label });
  return scopes.sort((left, right) => `${left.kind}:${left.id}`.localeCompare(`${right.kind}:${right.id}`));
}

function normalizeTask(value) {
  if (value === null) return null;
  const task = exactRecord(value, [
    'taskId', 'projectId', 'branchId', 'agentId', 'grantId', 'state', 'expiresAt',
    'capabilities', 'objectScopes', 'maxCommands', 'usedCommands', 'autoAcceptCommandTypes',
  ], 'taskAuthorityEvidence.task');
  invariant(TASK_STATES.includes(task.state), 'PROCESSING_ADOPTION_PORT_RESPONSE_INVALID', 'Task authority evidence contains an unsupported state.', { port: 'taskAuthorityReader' });
  const maxCommands = requireInteger(task.maxCommands, 'task.maxCommands', { min: 1, max: 10000 });
  return {
    taskId: requireId(task.taskId, 'task.taskId'),
    projectId: requireId(task.projectId, 'task.projectId'),
    branchId: requireId(task.branchId, 'task.branchId'),
    agentId: requireId(task.agentId, 'task.agentId'),
    grantId: requireId(task.grantId, 'task.grantId'),
    state: task.state,
    expiresAt: requireIsoDate(task.expiresAt, 'task.expiresAt'),
    capabilities: sortedUniqueIds(task.capabilities, 'task.capabilities'),
    objectScopes: normalizeObjectScopes(task.objectScopes, 'task.objectScopes'),
    maxCommands,
    usedCommands: requireInteger(task.usedCommands, 'task.usedCommands', { min: 0, max: maxCommands }),
    autoAcceptCommandTypes: sortedUniqueIds(task.autoAcceptCommandTypes, 'task.autoAcceptCommandTypes', { allowEmpty: true }),
  };
}

function normalizeGrant(value) {
  if (value === null) return null;
  const grant = exactRecord(value, [
    'id', 'projectId', 'branchId', 'agentId', 'taskId', 'status', 'expiresAt',
    'revokedAt', 'scopes', 'objectScopes', 'maxCommands', 'usedCommands',
  ], 'taskAuthorityEvidence.grant');
  invariant(GRANT_STATUSES.includes(grant.status), 'PROCESSING_ADOPTION_PORT_RESPONSE_INVALID', 'Task authority evidence contains an unsupported grant status.', { port: 'taskAuthorityReader' });
  const maxCommands = requireInteger(grant.maxCommands, 'grant.maxCommands', { min: 1, max: 10000 });
  return {
    id: requireId(grant.id, 'grant.id'),
    projectId: requireId(grant.projectId, 'grant.projectId'),
    branchId: requireId(grant.branchId, 'grant.branchId'),
    agentId: requireId(grant.agentId, 'grant.agentId'),
    taskId: requireId(grant.taskId, 'grant.taskId'),
    status: grant.status,
    expiresAt: requireNullableIsoDate(grant.expiresAt, 'grant.expiresAt'),
    revokedAt: requireNullableIsoDate(grant.revokedAt, 'grant.revokedAt'),
    scopes: sortedUniqueIds(grant.scopes, 'grant.scopes'),
    objectScopes: normalizeObjectScopes(grant.objectScopes, 'grant.objectScopes'),
    maxCommands,
    usedCommands: requireInteger(grant.usedCommands, 'grant.usedCommands', { min: 0, max: maxCommands }),
  };
}

function normalizeAuthorityEvidence(value) {
  const evidence = exactRecord(snapshotPlainData(value, 'taskAuthorityEvidence'), [
    'schemaVersion', 'kind', 'projectId', 'branchId', 'branchRevision', 'task', 'grant',
  ], 'taskAuthorityEvidence');
  invariant(evidence.schemaVersion === 1 && evidence.kind === PROCESSING_ADOPTION_TASK_AUTHORITY_EVIDENCE_KIND, 'PROCESSING_ADOPTION_PORT_RESPONSE_INVALID', 'Unsupported task-authority evidence.', { port: 'taskAuthorityReader' });
  return deepFreeze({
    schemaVersion: 1,
    kind: PROCESSING_ADOPTION_TASK_AUTHORITY_EVIDENCE_KIND,
    projectId: requireId(evidence.projectId, 'taskAuthorityEvidence.projectId'),
    branchId: requireId(evidence.branchId, 'taskAuthorityEvidence.branchId'),
    branchRevision: requireInteger(evidence.branchRevision, 'taskAuthorityEvidence.branchRevision', { min: 1 }),
    task: normalizeTask(evidence.task),
    grant: normalizeGrant(evidence.grant),
  });
}

function hasObjectScope(scopes, kind, id) {
  return scopes.some((scope) => scope.kind === kind && scope.id === id);
}

function assertAuthority(command, context, evidence, now) {
  invariant(evidence.projectId === command.projectId, 'PROCESSING_RESULT_ADOPTION_COMMAND_SCOPE_MISMATCH', 'Task authority evidence belongs to another project.');
  invariant(evidence.branchId === context.branchId, 'TASK_BRANCH_MISMATCH', 'Task authority evidence belongs to another branch.');
  invariant(evidence.branchRevision === command.baseRevision, 'REVISION_CONFLICT', 'The task branch changed after the adoption command was prepared.', { expectedRevision: command.baseRevision, actualRevision: evidence.branchRevision });
  const task = evidence.task;
  invariant(task, 'TASK_NOT_FOUND', 'The bound agent task does not exist.');
  invariant(task.state === 'ACTIVE', task.state === 'PAUSED' ? 'TASK_PAUSED' : 'TASK_NOT_EXECUTABLE', 'The bound agent task is not executable.', { state: task.state });
  invariant(Date.parse(task.expiresAt) > Date.parse(now), 'TASK_EXPIRED', 'The bound agent task has expired.');
  invariant(task.projectId === command.projectId, 'TASK_CONTEXT_MISMATCH', 'The bound task belongs to another project.');
  invariant(task.taskId === context.taskId, 'TASK_CONTEXT_MISMATCH', 'The trusted task does not match the authority evidence.');
  invariant(task.branchId === context.branchId, 'TASK_BRANCH_MISMATCH', 'The trusted branch does not match the task branch.');
  invariant(task.agentId === context.actor.id, 'TASK_ACTOR_MISMATCH', 'The trusted actor does not match the task agent.');
  invariant(task.grantId === context.grantId, 'TASK_GRANT_MISMATCH', 'The trusted grant does not match the task authority.');
  invariant(task.capabilities.includes(PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE), 'TASK_CAPABILITY_MISSING', 'The task lacks the private processing-result adoption capability.', { requiredScope: PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE });
  invariant(!task.autoAcceptCommandTypes.includes(PROCESSING_RESULT_ADOPTION_COMMAND_TYPE), 'AUTO_ACCEPT_FORBIDDEN', 'Processing-result adoption cannot be auto-accepted.');
  invariant(hasObjectScope(task.objectScopes, 'project', command.projectId) && hasObjectScope(task.objectScopes, 'asset', command.payload.preflightRequest.target.assetId), 'OBJECT_SCOPE_DENIED', 'The task does not cover the exact project and target Asset.');
  invariant(task.usedCommands < task.maxCommands, 'BUDGET_EXCEEDED', 'The task command budget is exhausted.');
  const grant = evidence.grant;
  invariant(grant, 'GRANT_NOT_FOUND', 'The bound task grant does not exist.');
  invariant(grant.status === 'ACTIVE' && grant.revokedAt === null, grant.status === 'LEGACY_UNBOUND' ? 'GRANT_REQUIRED' : 'GRANT_REVOKED', 'The bound task grant is not active.');
  invariant(grant.expiresAt === null || Date.parse(grant.expiresAt) > Date.parse(now), 'GRANT_EXPIRED', 'The bound task grant has expired.');
  invariant(grant.projectId === command.projectId, 'OBJECT_SCOPE_DENIED', 'The grant belongs to another project.');
  invariant(grant.agentId === context.actor.id, 'GRANT_ACTOR_MISMATCH', 'The grant belongs to another agent.');
  invariant(grant.taskId === context.taskId, 'GRANT_TASK_MISMATCH', 'The grant belongs to another task.');
  invariant(grant.branchId === context.branchId, 'GRANT_BRANCH_MISMATCH', 'The grant belongs to another branch.');
  invariant(grant.id === context.grantId, 'TASK_GRANT_MISMATCH', 'The trusted grant ID does not match the authority evidence.');
  invariant(grant.scopes.includes(PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE), 'GRANT_SCOPE_MISSING', 'The grant lacks the private processing-result adoption scope.', { requiredScope: PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE });
  invariant(hasObjectScope(grant.objectScopes, 'project', command.projectId) && hasObjectScope(grant.objectScopes, 'asset', command.payload.preflightRequest.target.assetId), 'OBJECT_SCOPE_DENIED', 'The grant does not cover the exact project and target Asset.');
  invariant(grant.usedCommands < grant.maxCommands, 'BUDGET_EXCEEDED', 'The grant command budget is exhausted.');
}

export function validateProcessingResultAdoptionTrustedContext(value) {
  let snapshot;
  try {
    snapshot = snapshotPlainData(value, 'trustedExecutionContext');
  } catch {
    throw new StudioError('PROCESSING_RESULT_ADOPTION_COMMAND_INVALID', 'The trusted execution context is invalid.');
  }
  const context = exactRecord(snapshot, ['actor', 'taskId', 'grantId', 'branchId', 'correlationId'], 'trustedExecutionContext', 'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID');
  const actor = requireActor(exactRecord(
    context.actor,
    ['id', 'kind', 'displayName'],
    'trustedExecutionContext.actor',
    'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID',
  ));
  invariant(actor.kind === 'agent', 'FORBIDDEN', 'Processing-result adoption planning is agent-task-only in A1.4.');
  const branchId = requireId(context.branchId, 'trustedExecutionContext.branchId');
  invariant(branchId !== 'branch.main', 'TASK_BRANCH_REQUIRED', 'Processing-result adoption planning requires an isolated task branch.');
  return deepFreeze({
    actor,
    taskId: requireId(context.taskId, 'trustedExecutionContext.taskId'),
    grantId: requireId(context.grantId, 'trustedExecutionContext.grantId'),
    branchId,
    correlationId: context.correlationId === null || context.correlationId === undefined
      ? null
      : requireId(context.correlationId, 'trustedExecutionContext.correlationId'),
  });
}

function normalizePreflightEvidence(value, selection) {
  const evidence = exactRecord(snapshotPlainData(value, 'taskBranchPreflightEvidence'), [
    'schemaVersion', 'kind', 'projectId', 'branchId', 'revision', 'receipt',
  ], 'taskBranchPreflightEvidence');
  invariant(evidence.schemaVersion === 1 && evidence.kind === PROCESSING_ADOPTION_TASK_BRANCH_PREFLIGHT_EVIDENCE_KIND, 'PROCESSING_ADOPTION_PORT_RESPONSE_INVALID', 'Unsupported task-branch preflight evidence.', { port: 'taskBranchPreflightReader' });
  const projectId = requireId(evidence.projectId, 'taskBranchPreflightEvidence.projectId');
  const branchId = requireId(evidence.branchId, 'taskBranchPreflightEvidence.branchId');
  const revision = requireInteger(evidence.revision, 'taskBranchPreflightEvidence.revision', { min: 1 });
  invariant(projectId === selection.projectId && branchId === selection.branchId && revision === selection.revision, 'PROCESSING_ADOPTION_PORT_RESPONSE_INVALID', 'Task-branch preflight evidence does not match its selection.', { port: 'taskBranchPreflightReader' });
  const receipt = validateProcessingAdoptionPreflightReceipt(evidence.receipt);
  invariant(
    receipt.requestFingerprint === processingAdoptionPreflightRequestSha256(selection.request),
    'PROCESSING_ADOPTION_PORT_RESPONSE_INVALID',
    'Task-branch preflight evidence does not close the selected request.',
    { port: 'taskBranchPreflightReader' },
  );
  return deepFreeze({
    schemaVersion: 1,
    kind: PROCESSING_ADOPTION_TASK_BRANCH_PREFLIGHT_EVIDENCE_KIND,
    projectId,
    branchId,
    revision,
    receipt,
  });
}

function abort(signal) {
  signal?.throwIfAborted();
}

async function invokeReadPort(port, operation, signal) {
  abort(signal);
  try {
    const result = await operation();
    abort(signal);
    return result;
  } catch {
    abort(signal);
    throw new StudioError('PROCESSING_ADOPTION_PORT_FAILED', 'A read-only processing adoption planning dependency failed.', { port });
  }
}

function evaluateResponse(port, evaluator, signal) {
  abort(signal);
  try {
    const result = evaluator();
    abort(signal);
    return result;
  } catch {
    abort(signal);
    throw new StudioError('PROCESSING_ADOPTION_PORT_RESPONSE_INVALID', 'A read-only processing adoption planning dependency returned invalid evidence.', { port });
  }
}

function readTrustedClock(clock, signal) {
  abort(signal);
  let value;
  try {
    value = clock();
    abort(signal);
  } catch {
    abort(signal);
    throw new StudioError(
      'PROCESSING_ADOPTION_PORT_FAILED',
      'A trusted processing adoption planning dependency failed.',
      { port: 'clock' },
    );
  }
  return evaluateResponse('clock', () => requireIsoDate(value, 'clock'), signal);
}

/**
 * Produces a nonauthorizing, nonpersisted A1.4 command plan. The two read ports
 * are deliberately unwired. A1.5 must repeat every check inside one durable
 * atomic unit of work before any branch, Asset, Activity, budget, or CAS write.
 */
export class ProcessingResultAdoptionPlanningService {
  #taskAuthorityReader;

  #taskBranchPreflightReader;

  #clock;

  constructor(options = {}) {
    const config = exactServiceOptions(options);
    const clock = Object.hasOwn(config, 'clock') ? config.clock : () => new Date().toISOString();
    this.#taskAuthorityReader = validateProcessingAdoptionTaskAuthorityReader(config.taskAuthorityReader);
    this.#taskBranchPreflightReader = validateProcessingAdoptionTaskBranchPreflightReader(config.taskBranchPreflightReader);
    invariant(typeof clock === 'function', 'PROCESSING_ADOPTION_PORT_INVALID', 'Processing adoption planning requires a trusted clock.', { port: 'clock' });
    this.#clock = clock;
  }

  async prepare(commandValue, trustedExecutionContext, options = {}) {
    const signal = exactPrepareOptions(options);
    const command = validateProcessingResultAdoptionCommand(commandValue);
    const context = validateProcessingResultAdoptionTrustedContext(trustedExecutionContext);
    abort(signal);
    const authoritySelection = deepFreeze({
      schemaVersion: PROCESSING_ADOPTION_TASK_AUTHORITY_READER_SCHEMA_VERSION,
      projectId: command.projectId,
      branchId: context.branchId,
      revision: command.baseRevision,
      actorId: context.actor.id,
      taskId: context.taskId,
      grantId: context.grantId,
      requiredScope: PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE,
      targetAssetId: command.payload.preflightRequest.target.assetId,
    });
    const authorityValue = await invokeReadPort(
      'taskAuthorityReader',
      () => this.#taskAuthorityReader.readTaskAuthority(authoritySelection, Object.freeze({ signal })),
      signal,
    );
    const authorityEvidence = evaluateResponse(
      'taskAuthorityReader',
      () => normalizeAuthorityEvidence(authorityValue),
      signal,
    );
    const now = readTrustedClock(this.#clock, signal);
    assertAuthority(command, context, authorityEvidence, now);

    const preflightSelection = deepFreeze({
      schemaVersion: PROCESSING_ADOPTION_TASK_BRANCH_PREFLIGHT_READER_SCHEMA_VERSION,
      projectId: command.projectId,
      branchId: context.branchId,
      revision: command.baseRevision,
      request: command.payload.preflightRequest,
    });
    const preflightValue = await invokeReadPort(
      'taskBranchPreflightReader',
      () => this.#taskBranchPreflightReader.preflightTaskBranch(preflightSelection, Object.freeze({ signal })),
      signal,
    );
    const preflightEvidence = evaluateResponse(
      'taskBranchPreflightReader',
      () => normalizePreflightEvidence(preflightValue, preflightSelection),
      signal,
    );
    const authorityBinding = {
      schemaVersion: PROCESSING_RESULT_ADOPTION_SCHEMA_VERSION,
      kind: PROCESSING_RESULT_ADOPTION_AUTHORITY_BINDING_KIND,
      projectId: command.projectId,
      revision: command.baseRevision,
      actorId: context.actor.id,
      taskId: context.taskId,
      grantId: context.grantId,
      branchId: context.branchId,
    };
    return createProcessingResultAdoptionPlanningResult(
      command,
      authorityBinding,
      preflightEvidence.receipt,
    );
  }
}
