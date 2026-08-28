import { types as utilTypes } from 'node:util';
import {
  AUTHORING_V2_FEATURE_ID,
  AUTHORING_V2_SCHEMA_VERSION,
  PROCESSING_RESULT_ADOPTION_COMMAND_TYPE,
  PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE,
} from '../../../domain/src/index.js';
import { invariant } from '../../../domain/src/errors.js';
import { requireId, requireInteger, requireIsoDate } from '../../../domain/src/validation.js';
import {
  AUTHORING_V2_ADMISSION_EVIDENCE_KIND,
  AUTHORING_V2_ADMISSION_READER_KIND,
  AUTHORING_V2_ADMISSION_READER_SCHEMA_VERSION,
} from '../../../application/src/authoring-v2-admission.js';
import {
  readProcessingAdoptionPlanningAuthorityEvidence,
} from './sqlite-processing-result-adoption-store.js';
import {
  assertCurrentHostBinding,
  readCurrentHostBindingById,
} from './sqlite-host-binding-admission.js';
import { SqliteWorkspace } from './sqlite-workspace.js';

function exactOwnDataRecord(value, fields, label) {
  invariant(
    value !== null
      && typeof value === 'object'
      && !Array.isArray(value)
      && !utilTypes.isProxy(value),
    'AUTHORING_V2_ADMISSION_INVALID',
    `${label} must be an inspectable plain object.`,
  );
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    invariant(false, 'AUTHORING_V2_ADMISSION_INVALID', `${label} must be inspectable.`);
  }
  invariant(
    (prototype === Object.prototype || prototype === null)
      && keys.length === fields.length
      && keys.every((key) => typeof key === 'string' && fields.includes(key)),
    'AUTHORING_V2_ADMISSION_INVALID',
    `${label} must contain exactly its trusted fields.`,
  );
  const result = Object.create(null);
  for (const field of fields) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, field);
    } catch {
      invariant(false, 'AUTHORING_V2_ADMISSION_INVALID', `${label}.${field} must be inspectable.`);
    }
    invariant(
      descriptor && Object.hasOwn(descriptor, 'value') && descriptor.enumerable === true,
      'AUTHORING_V2_ADMISSION_INVALID',
      `${label}.${field} must be an enumerable own data field.`,
    );
    result[field] = descriptor.value;
  }
  return result;
}

function captureBinding(value) {
  const binding = exactOwnDataRecord(value, [
    'schemaVersion', 'bindingId', 'projectId', 'grantId', 'actor', 'taskId',
    'branchId', 'issuedBy', 'issuedAt', 'expiresAt', 'revokedAt', 'revokeReason', 'status',
  ], 'trustedAuthoringV2HostBinding');
  const actor = exactOwnDataRecord(binding.actor, ['id', 'kind', 'displayName'], 'trustedAuthoringV2HostBinding.actor');
  invariant(
    binding.schemaVersion === 1
      && actor.kind === 'agent'
      && binding.status === 'ACTIVE'
      && binding.revokedAt === null
      && binding.revokeReason === null,
    'AUTHORING_V2_ADMISSION_INVALID',
    'Only a current active agent HostBinding can seed Authoring-v2 admission.',
  );
  const branchId = requireId(binding.branchId, 'trustedAuthoringV2HostBinding.branchId');
  invariant(branchId !== 'branch.main', 'TASK_BRANCH_REQUIRED', 'Authoring v2 requires an isolated task branch.');
  return Object.freeze({
    bindingId: requireId(binding.bindingId, 'trustedAuthoringV2HostBinding.bindingId'),
    projectId: requireId(binding.projectId, 'trustedAuthoringV2HostBinding.projectId'),
    grantId: requireId(binding.grantId, 'trustedAuthoringV2HostBinding.grantId'),
    agentId: requireId(actor.id, 'trustedAuthoringV2HostBinding.actor.id'),
    taskId: requireId(binding.taskId, 'trustedAuthoringV2HostBinding.taskId'),
    branchId,
    issuedBy: requireId(binding.issuedBy, 'trustedAuthoringV2HostBinding.issuedBy'),
    issuedAt: requireIsoDate(binding.issuedAt, 'trustedAuthoringV2HostBinding.issuedAt'),
    expiresAt: binding.expiresAt === null
      ? null
      : requireIsoDate(binding.expiresAt, 'trustedAuthoringV2HostBinding.expiresAt'),
  });
}

function exactSelection(value) {
  const selection = exactOwnDataRecord(value, [
    'schemaVersion', 'featureId', 'projectId', 'actorId', 'taskId', 'grantId',
    'branchId', 'expectedRevision', 'targetAssetId',
  ], 'authoringV2AdmissionSelection');
  invariant(
    selection.schemaVersion === AUTHORING_V2_SCHEMA_VERSION
      && selection.featureId === AUTHORING_V2_FEATURE_ID,
    'AUTHORING_V2_ADMISSION_INVALID',
    'The SQLite admission selection is not pinned to Authoring v2.',
  );
  return Object.freeze({
    schemaVersion: AUTHORING_V2_SCHEMA_VERSION,
    featureId: AUTHORING_V2_FEATURE_ID,
    projectId: requireId(selection.projectId, 'authoringV2AdmissionSelection.projectId'),
    actorId: requireId(selection.actorId, 'authoringV2AdmissionSelection.actorId'),
    taskId: requireId(selection.taskId, 'authoringV2AdmissionSelection.taskId'),
    grantId: requireId(selection.grantId, 'authoringV2AdmissionSelection.grantId'),
    branchId: requireId(selection.branchId, 'authoringV2AdmissionSelection.branchId'),
    expectedRevision: selection.expectedRevision === null
      ? null
      : requireInteger(selection.expectedRevision, 'authoringV2AdmissionSelection.expectedRevision', { min: 1 }),
    targetAssetId: selection.targetAssetId === null
      ? null
      : requireId(selection.targetAssetId, 'authoringV2AdmissionSelection.targetAssetId'),
  });
}

function hasObjectScope(scopes, kind, id) {
  return Array.isArray(scopes) && scopes.some((scope) => scope?.kind === kind && scope?.id === id);
}

function abort(signal) {
  if (signal !== undefined) AbortSignal.prototype.throwIfAborted.call(signal);
}

/**
 * Current SQLite truth for one already strict-resolved HostBinding. This port
 * is read-only and session-bound; it cannot create or widen authority.
 */
export class SqliteAuthoringV2AdmissionReader {
  #workspace;

  #binding;

  #clock;

  constructor({ workspace, trustedBinding, clock = () => new Date().toISOString() } = {}) {
    invariant(workspace instanceof SqliteWorkspace && workspace.isWriter, 'AUTHORING_V2_ADMISSION_INVALID', 'A writable SQLite workspace is required.');
    invariant(typeof clock === 'function' && !utilTypes.isProxy(clock), 'AUTHORING_V2_ADMISSION_INVALID', 'A trusted Authoring-v2 clock is required.');
    this.#workspace = workspace;
    this.#binding = captureBinding(trustedBinding);
    this.#clock = clock;
  }

  asAdmissionReader() {
    const reader = this;
    return Object.freeze({
      schemaVersion: AUTHORING_V2_ADMISSION_READER_SCHEMA_VERSION,
      kind: AUTHORING_V2_ADMISSION_READER_KIND,
      readAuthoringV2Admission: (selection, options) => reader.readAuthoringV2Admission(selection, options),
    });
  }

  readAuthoringV2Admission(selectionValue, { signal } = {}) {
    abort(signal);
    const selection = exactSelection(selectionValue);
    invariant(
      selection.projectId === this.#binding.projectId
        && selection.actorId === this.#binding.agentId
        && selection.taskId === this.#binding.taskId
        && selection.grantId === this.#binding.grantId
        && selection.branchId === this.#binding.branchId,
      'HOST_BINDING_GRANT_MISMATCH',
      'The Authoring-v2 admission selection does not match its HostBinding.',
    );
    invariant(selection.branchId !== 'branch.main', 'TASK_BRANCH_REQUIRED', 'Authoring v2 requires an isolated task branch.');
    const now = requireIsoDate(this.#clock(), 'authoringV2AdmissionClock');
    const database = this.#workspace.database;
    assertCurrentHostBinding(
      readCurrentHostBindingById(database, this.#binding.bindingId),
      now,
      this.#binding,
    );
    const taskRow = database.prepare(`
      SELECT head_revision FROM agent_tasks WHERE project_id = ? AND task_id = ?
    `).get(selection.projectId, selection.taskId);
    invariant(taskRow, 'TASK_NOT_FOUND', 'The bound Authoring-v2 task does not exist.');
    const revision = Number(taskRow.head_revision);
    if (selection.expectedRevision !== null) {
      invariant(
        revision === selection.expectedRevision,
        'REVISION_CONFLICT',
        'The Authoring-v2 task branch changed before admission.',
        { expectedRevision: selection.expectedRevision, actualRevision: revision },
      );
    }
    const authority = readProcessingAdoptionPlanningAuthorityEvidence(database, {
      projectId: selection.projectId,
      actorId: selection.actorId,
      taskId: selection.taskId,
      grantId: selection.grantId,
      branchId: selection.branchId,
      revision,
    });
    const task = authority.task;
    const grant = authority.grant;
    invariant(task, 'TASK_NOT_FOUND', 'The bound Authoring-v2 task does not exist.');
    invariant(task.state === 'ACTIVE', task.state === 'PAUSED' ? 'TASK_PAUSED' : 'TASK_NOT_EXECUTABLE', 'The bound Authoring-v2 task is not executable.', { state: task.state });
    invariant(Date.parse(task.expiresAt) > Date.parse(now), 'TASK_EXPIRED', 'The bound Authoring-v2 task has expired.');
    invariant(
      authority.projectId === selection.projectId
        && authority.branchId === selection.branchId
        && authority.branchRevision === revision
        && task.projectId === selection.projectId
        && task.taskId === selection.taskId
        && task.branchId === selection.branchId
        && task.agentId === selection.actorId
        && task.grantId === selection.grantId,
      'AUTHORING_V2_ADMISSION_INVALID',
      'The Authoring-v2 task coordinates do not close.',
    );
    invariant(task.capabilities.includes(PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE), 'TASK_CAPABILITY_MISSING', 'The task lacks the private Authoring-v2 scope.');
    invariant(!task.autoAcceptCommandTypes.includes(PROCESSING_RESULT_ADOPTION_COMMAND_TYPE), 'AUTO_ACCEPT_FORBIDDEN', 'Processing-result adoption cannot be auto-accepted.');
    invariant(hasObjectScope(task.objectScopes, 'project', selection.projectId), 'OBJECT_SCOPE_DENIED', 'The task does not cover the Authoring-v2 project.');
    if (selection.targetAssetId !== null) {
      invariant(hasObjectScope(task.objectScopes, 'asset', selection.targetAssetId), 'OBJECT_SCOPE_DENIED', 'The task does not cover the selected Asset.');
    }
    invariant(grant, 'GRANT_NOT_FOUND', 'The bound Authoring-v2 grant does not exist.');
    invariant(grant.status === 'ACTIVE' && grant.revokedAt === null, grant.status === 'LEGACY_UNBOUND' ? 'GRANT_REQUIRED' : 'GRANT_REVOKED', 'The bound Authoring-v2 grant is not active.');
    invariant(grant.expiresAt === null || Date.parse(grant.expiresAt) > Date.parse(now), 'GRANT_EXPIRED', 'The bound Authoring-v2 grant has expired.');
    invariant(
      grant.projectId === selection.projectId
        && grant.id === selection.grantId
        && grant.agentId === selection.actorId
        && grant.taskId === selection.taskId
        && grant.branchId === selection.branchId,
      'HOST_BINDING_GRANT_MISMATCH',
      'The Authoring-v2 Grant coordinates do not match the HostBinding.',
    );
    invariant(grant.scopes.includes(PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE), 'GRANT_SCOPE_MISSING', 'The Grant lacks the private Authoring-v2 scope.');
    invariant(hasObjectScope(grant.objectScopes, 'project', selection.projectId), 'OBJECT_SCOPE_DENIED', 'The Grant does not cover the Authoring-v2 project.');
    if (selection.targetAssetId !== null) {
      invariant(hasObjectScope(grant.objectScopes, 'asset', selection.targetAssetId), 'OBJECT_SCOPE_DENIED', 'The Grant does not cover the selected Asset.');
    }
    invariant(
      task.maxCommands === grant.maxCommands
        && task.usedCommands === grant.usedCommands
        && task.usedCommands <= task.maxCommands,
      'CORRUPT_PROCESSING_RESULT_ADOPTION',
      'Authoring-v2 Task and Grant budget coordinates disagree.',
    );
    assertCurrentHostBinding(
      readCurrentHostBindingById(database, this.#binding.bindingId),
      now,
      this.#binding,
    );
    abort(signal);
    return Object.freeze({
      schemaVersion: AUTHORING_V2_ADMISSION_READER_SCHEMA_VERSION,
      kind: AUTHORING_V2_ADMISSION_EVIDENCE_KIND,
      featureId: AUTHORING_V2_FEATURE_ID,
      projectId: selection.projectId,
      actorId: selection.actorId,
      taskId: selection.taskId,
      grantId: selection.grantId,
      branchId: selection.branchId,
      branchRevision: revision,
      targetAssetId: selection.targetAssetId,
      taskMaxCommands: task.maxCommands,
      taskUsedCommands: task.usedCommands,
      grantMaxCommands: grant.maxCommands,
      grantUsedCommands: grant.usedCommands,
    });
  }
}
