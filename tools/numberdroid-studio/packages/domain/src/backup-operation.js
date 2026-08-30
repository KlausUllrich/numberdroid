import { createHash } from 'node:crypto';
import { types as utilTypes } from 'node:util';
import { StudioError, invariant } from './errors.js';

export const BACKUP_OPERATION_SCHEMA_VERSION = 1;

export const BACKUP_OPERATION_KINDS = Object.freeze([
  'CREATE',
  'VERIFY',
  'RECOVERY_TEST',
  'RESTORE_AS_COPY',
]);

export const BACKUP_OPERATION_STATUSES = Object.freeze([
  'QUEUED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'INTERRUPTED',
]);

export const BACKUP_OPERATION_PHASES = Object.freeze({
  CREATE: Object.freeze([
    'RESERVED',
    'SOURCE_VERIFIED',
    'DB_SNAPSHOTTED',
    'CAS_COPIED',
    'MANIFEST_WRITTEN',
    'SNAPSHOT_VERIFIED',
    'DURABLY_CLOSED',
    'PUBLISHED',
    'COMPLETED',
  ]),
  VERIFY: Object.freeze([
    'RESERVED',
    'BACKUP_RESOLVED',
    'CONTENT_VERIFIED',
    'COMPLETED',
  ]),
  RECOVERY_TEST: Object.freeze([
    'RESERVED',
    'BACKUP_VERIFIED',
    'COPY_STAGED',
    'COPY_VERIFIED',
    'READ_ONLY_OPENED',
    'PARITY_VERIFIED',
    'TEST_COPY_CLEANED',
    'COMPLETED',
  ]),
  RESTORE_AS_COPY: Object.freeze([
    'RESERVED',
    'BACKUP_VERIFIED',
    'COPY_STAGED',
    'COPY_VERIFIED',
    'QUARANTINE_WRITTEN',
    'DURABLY_CLOSED',
    'PUBLISHED',
    'COMPLETED',
  ]),
});

export const BACKUP_HEALTH_STATES = Object.freeze([
  'UNVERIFIED',
  'VERIFIED',
  'SUSPECT',
  'MISSING',
]);

export const BACKUP_PROVENANCES = Object.freeze(['CREATED', 'DISCOVERED']);
export const RESTORED_COPY_LIFECYCLES = Object.freeze(['QUARANTINED_VERIFIED']);

export const BACKUP_OPERATION_FAILURE_CODES = Object.freeze([
  'WORKSPACE_OPERATOR_REQUIRED',
  'WORKSPACE_OPERATOR_FORBIDDEN',
  'OPERATIONS_UNAVAILABLE',
  'OPERATION_NOT_FOUND',
  'OPERATION_IDEMPOTENCY_CONFLICT',
  'OPERATION_STATE_CONFLICT',
  'OPERATION_LEASE_LOST',
  'BACKUP_DESTINATION_UNKNOWN',
  'BACKUP_PATH_UNSAFE',
  'BACKUP_DESTINATION_CONFLICT',
  'BACKUP_SOURCE_INTEGRITY_FAILED',
  'BACKUP_SNAPSHOT_FAILED',
  'BACKUP_SNAPSHOT_INTEGRITY_FAILED',
  'BACKUP_SCHEMA_UNSUPPORTED',
  'BACKUP_CONTENT_MISMATCH',
  'BACKUP_DURABILITY_FAILED',
  'BACKUP_PUBLISH_FAILED',
  'RECOVERY_TEST_FAILED',
  'RESTORE_COPY_FAILED',
  'RESTORED_COPY_QUARANTINED',
  'OPERATION_INTERRUPTED',
]);

const FAILURE_MESSAGES = Object.freeze({
  WORKSPACE_OPERATOR_REQUIRED: 'A local workspace-operator session is required.',
  WORKSPACE_OPERATOR_FORBIDDEN: 'The local session cannot manage workspace backups.',
  OPERATIONS_UNAVAILABLE: 'Backup operations are unavailable.',
  OPERATION_NOT_FOUND: 'The requested backup operation or record was not found.',
  OPERATION_IDEMPOTENCY_CONFLICT: 'The idempotency key was already used for different input.',
  OPERATION_STATE_CONFLICT: 'The backup operation cannot transition from its current state.',
  OPERATION_LEASE_LOST: 'The backup worker no longer owns this operation.',
  BACKUP_DESTINATION_UNKNOWN: 'The configured backup destination is unavailable.',
  BACKUP_PATH_UNSAFE: 'The configured backup location failed its safety checks.',
  BACKUP_DESTINATION_CONFLICT: 'The reserved backup output already exists.',
  BACKUP_SOURCE_INTEGRITY_FAILED: 'The current workspace did not pass the backup integrity check.',
  BACKUP_SNAPSHOT_FAILED: 'A complete backup snapshot could not be created.',
  BACKUP_SNAPSHOT_INTEGRITY_FAILED: 'The new backup snapshot did not pass verification.',
  BACKUP_SCHEMA_UNSUPPORTED: 'The backup format cannot be verified by this Studio version.',
  BACKUP_CONTENT_MISMATCH: 'The backup content differs from its verified evidence.',
  BACKUP_DURABILITY_FAILED: 'Durable backup completion could not be proved.',
  BACKUP_PUBLISH_FAILED: 'The verified backup output could not be published safely.',
  RECOVERY_TEST_FAILED: 'The read-only recovery test did not complete successfully.',
  RESTORE_COPY_FAILED: 'A verified restored copy could not be created safely.',
  RESTORED_COPY_QUARANTINED: 'The restored copy is quarantined and cannot be opened normally.',
  OPERATION_INTERRUPTED: 'The interrupted backup operation could not be resumed safely.',
});

const FAILURE_CODE_SET = new Set(BACKUP_OPERATION_FAILURE_CODES);
const TERMINAL_STATUSES = new Set(['SUCCEEDED', 'FAILED', 'INTERRUPTED']);
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

const REQUEST_FIELDS = Object.freeze({
  CREATE: Object.freeze(['schemaVersion', 'kind', 'destinationId', 'idempotencyKey']),
  VERIFY: Object.freeze(['schemaVersion', 'kind', 'backupId', 'idempotencyKey']),
  RECOVERY_TEST: Object.freeze(['schemaVersion', 'kind', 'backupId', 'idempotencyKey']),
  RESTORE_AS_COPY: Object.freeze([
    'schemaVersion', 'kind', 'backupId', 'destinationId', 'idempotencyKey',
  ]),
});

function exactPlainRecord(value, allowed, label, code = 'VALIDATION_ERROR') {
  invariant(
    value !== null
      && typeof value === 'object'
      && !Array.isArray(value)
      && !utilTypes.isProxy(value),
    code,
    `${label} must be an inspectable plain object.`,
    { field: label },
  );
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    invariant(false, code, `${label} must be inspectable.`, { field: label });
  }
  invariant(
    prototype === Object.prototype || prototype === null,
    code,
    `${label} must be a plain object.`,
    { field: label },
  );
  invariant(
    keys.length === allowed.length
      && keys.every((key) => typeof key === 'string' && allowed.includes(key)),
    code,
    `${label} contains fields outside its exact v1 contract.`,
    { field: label },
  );
  const snapshot = Object.create(null);
  for (const field of allowed) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, field);
    } catch {
      invariant(false, code, `${label}.${field} must be inspectable.`, { field: `${label}.${field}` });
    }
    invariant(
      descriptor
        && Object.hasOwn(descriptor, 'value')
        && descriptor.enumerable === true,
      code,
      `${label}.${field} must be an enumerable own data field.`,
      { field: `${label}.${field}` },
    );
    snapshot[field] = descriptor.value;
  }
  return snapshot;
}

function inspectPlainRecordFields(value, label, code = 'VALIDATION_ERROR') {
  invariant(
    value !== null
      && typeof value === 'object'
      && !Array.isArray(value)
      && !utilTypes.isProxy(value),
    code,
    `${label} must be an inspectable plain object.`,
    { field: label },
  );
  let keys;
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    invariant(false, code, `${label} must be inspectable.`, { field: label });
  }
  invariant(
    keys.length <= 5 && keys.every((key) => typeof key === 'string'),
    code,
    `${label} must contain only its bounded string fields.`,
    { field: label },
  );
  return keys;
}

function requireOpaqueId(value, label, code = 'VALIDATION_ERROR') {
  invariant(
    typeof value === 'string'
      && value.trim() === value
      && ID_PATTERN.test(value),
    code,
    `${label} must be an opaque stable identifier.`,
    { field: label },
  );
  return value;
}

function requireKind(value, code = 'VALIDATION_ERROR') {
  invariant(
    BACKUP_OPERATION_KINDS.includes(value),
    code,
    'Unsupported backup operation kind.',
    { field: 'kind' },
  );
  return value;
}

function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const fields = Object.keys(value).sort();
  return `{${fields.map((field) => `${JSON.stringify(field)}:${canonicalJson(value[field])}`).join(',')}}`;
}

function semanticRequest(request) {
  const result = { schemaVersion: request.schemaVersion, kind: request.kind };
  if (Object.hasOwn(request, 'backupId')) result.backupId = request.backupId;
  if (Object.hasOwn(request, 'destinationId')) result.destinationId = request.destinationId;
  return result;
}

export function validateBackupOperationRequest(value) {
  const envelope = exactPlainRecord(
    value,
    inspectPlainRecordFields(value, 'backupOperationRequest'),
    'backupOperationRequest',
  );
  invariant(
    envelope.schemaVersion === BACKUP_OPERATION_SCHEMA_VERSION,
    'VALIDATION_ERROR',
    'Unsupported backup operation request schema version.',
    { field: 'schemaVersion' },
  );
  const kind = requireKind(envelope.kind);
  const request = exactPlainRecord(value, REQUEST_FIELDS[kind], 'backupOperationRequest');
  const normalized = {
    schemaVersion: BACKUP_OPERATION_SCHEMA_VERSION,
    kind,
  };
  if (Object.hasOwn(request, 'backupId')) {
    normalized.backupId = requireOpaqueId(request.backupId, 'backupId');
  }
  if (Object.hasOwn(request, 'destinationId')) {
    normalized.destinationId = requireOpaqueId(request.destinationId, 'destinationId');
  }
  normalized.idempotencyKey = requireOpaqueId(request.idempotencyKey, 'idempotencyKey');
  return deepFreeze(normalized);
}

export function canonicalBackupOperationRequestJson(value) {
  return canonicalJson(semanticRequest(validateBackupOperationRequest(value)));
}

export function backupOperationRequestFingerprint(value) {
  return createHash('sha256')
    .update(canonicalBackupOperationRequestJson(value))
    .digest('hex');
}

export function initialBackupOperationState(kindValue) {
  const kind = requireKind(kindValue, 'OPERATION_STATE_CONFLICT');
  const phases = BACKUP_OPERATION_PHASES[kind];
  return deepFreeze({
    kind,
    status: 'QUEUED',
    phase: 'RESERVED',
    progress: { current: 0, total: phases.length - 1 },
  });
}

export function validateBackupOperationState(value) {
  const state = exactPlainRecord(
    value,
    ['kind', 'status', 'phase', 'progress'],
    'backupOperationState',
    'OPERATION_STATE_CONFLICT',
  );
  const kind = requireKind(state.kind, 'OPERATION_STATE_CONFLICT');
  invariant(
    BACKUP_OPERATION_STATUSES.includes(state.status),
    'OPERATION_STATE_CONFLICT',
    'Unsupported backup operation status.',
    { status: state.status },
  );
  const phases = BACKUP_OPERATION_PHASES[kind];
  const phaseIndex = phases.indexOf(state.phase);
  invariant(
    phaseIndex >= 0,
    'OPERATION_STATE_CONFLICT',
    'The phase does not belong to this backup operation kind.',
    { kind, phase: state.phase },
  );
  const progress = exactPlainRecord(
    state.progress,
    ['current', 'total'],
    'backupOperationState.progress',
    'OPERATION_STATE_CONFLICT',
  );
  invariant(
    progress.current === phaseIndex && progress.total === phases.length - 1,
    'OPERATION_STATE_CONFLICT',
    'Backup operation progress must match its monotonic phase position.',
    { kind, phase: state.phase },
  );
  invariant(
    state.status !== 'SUCCEEDED' || state.phase === 'COMPLETED',
    'OPERATION_STATE_CONFLICT',
    'SUCCEEDED must pair with COMPLETED.',
  );
  invariant(
    state.phase !== 'COMPLETED' || state.status === 'SUCCEEDED',
    'OPERATION_STATE_CONFLICT',
    'COMPLETED must pair with SUCCEEDED.',
  );
  invariant(
    state.status !== 'QUEUED' || state.phase === 'RESERVED',
    'OPERATION_STATE_CONFLICT',
    'A queued operation must remain at RESERVED.',
  );
  invariant(
    !['FAILED', 'INTERRUPTED'].includes(state.status) || state.phase !== 'COMPLETED',
    'OPERATION_STATE_CONFLICT',
    'A failed or interrupted operation retains its last incomplete phase.',
  );
  return deepFreeze({
    kind,
    status: state.status,
    phase: state.phase,
    progress: { current: phaseIndex, total: phases.length - 1 },
  });
}

export function nextBackupOperationPhase(kindValue, phase) {
  const kind = requireKind(kindValue, 'OPERATION_STATE_CONFLICT');
  const phases = BACKUP_OPERATION_PHASES[kind];
  const index = phases.indexOf(phase);
  invariant(
    index >= 0 && index < phases.length - 1,
    'OPERATION_STATE_CONFLICT',
    'The backup operation has no next phase.',
    { kind, phase },
  );
  return phases[index + 1];
}

export function transitionBackupOperationState(currentValue, nextValue) {
  const current = validateBackupOperationState(currentValue);
  invariant(
    !TERMINAL_STATUSES.has(current.status),
    'OPERATION_STATE_CONFLICT',
    'A terminal backup operation cannot transition.',
    { status: current.status, phase: current.phase },
  );
  const next = exactPlainRecord(
    nextValue,
    ['status', 'phase'],
    'backupOperationTransition',
    'OPERATION_STATE_CONFLICT',
  );
  invariant(
    BACKUP_OPERATION_STATUSES.includes(next.status),
    'OPERATION_STATE_CONFLICT',
    'Unsupported target backup operation status.',
    { status: next.status },
  );

  if (current.status === 'QUEUED') {
    invariant(
      next.status === 'RUNNING' && next.phase === 'RESERVED',
      'OPERATION_STATE_CONFLICT',
      'A queued operation can only be claimed at RESERVED.',
      { status: next.status, phase: next.phase },
    );
  } else if (['FAILED', 'INTERRUPTED'].includes(next.status)) {
    invariant(
      next.phase === current.phase,
      'OPERATION_STATE_CONFLICT',
      'A terminal failure must retain the last completed phase.',
      { phase: current.phase, targetPhase: next.phase },
    );
  } else {
    const expectedPhase = nextBackupOperationPhase(current.kind, current.phase);
    const expectedStatus = expectedPhase === 'COMPLETED' ? 'SUCCEEDED' : 'RUNNING';
    invariant(
      next.status === expectedStatus && next.phase === expectedPhase,
      'OPERATION_STATE_CONFLICT',
      'The operation must advance exactly one phase.',
      {
        status: current.status,
        phase: current.phase,
        expectedStatus,
        expectedPhase,
      },
    );
  }

  return validateBackupOperationState({
    kind: current.kind,
    status: next.status,
    phase: next.phase,
    progress: {
      current: BACKUP_OPERATION_PHASES[current.kind].indexOf(next.phase),
      total: BACKUP_OPERATION_PHASES[current.kind].length - 1,
    },
  });
}

function fallbackFailureCode(kind) {
  return {
    CREATE: 'BACKUP_SNAPSHOT_FAILED',
    VERIFY: 'BACKUP_CONTENT_MISMATCH',
    RECOVERY_TEST: 'RECOVERY_TEST_FAILED',
    RESTORE_AS_COPY: 'RESTORE_COPY_FAILED',
  }[kind] ?? 'OPERATIONS_UNAVAILABLE';
}

function inspectFailureCode(error) {
  if (error === null || typeof error !== 'object' || utilTypes.isProxy(error)) return null;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(error, 'code');
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) return null;
    return typeof descriptor.value === 'string' ? descriptor.value : null;
  } catch {
    return null;
  }
}

export function projectBackupOperationFailure(error, { kind } = {}) {
  const inspected = inspectFailureCode(error);
  const code = FAILURE_CODE_SET.has(inspected) ? inspected : fallbackFailureCode(kind);
  return deepFreeze({ code, message: FAILURE_MESSAGES[code] });
}

export function backupOperationFailure(code) {
  invariant(
    FAILURE_CODE_SET.has(code),
    'OPERATION_STATE_CONFLICT',
    'The backup operation failure code is not allowlisted.',
    { code },
  );
  return new StudioError(code, FAILURE_MESSAGES[code]);
}
