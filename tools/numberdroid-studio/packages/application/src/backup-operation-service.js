import { randomBytes } from 'node:crypto';
import { types as utilTypes } from 'node:util';
import {
  BACKUP_OPERATION_SCHEMA_VERSION,
  backupOperationFailure,
  backupOperationRequestFingerprint,
  initialBackupOperationState,
  projectBackupOperationFailure,
  validateBackupOperationRequest,
  validateBackupOperationState,
} from '../../domain/src/backup-operation.js';
import { invariant } from '../../domain/src/errors.js';

export const WORKSPACE_BACKUP_CAPABILITY = 'workspace.backup.manage';
export const LOCAL_WORKSPACE_OPERATOR_KIND = 'LOCAL_WORKSPACE_OPERATOR';
export const LOCAL_WORKSPACE_OPERATOR_SUBJECT = 'local.workspace-operator';

export const BACKUP_OPERATION_COMMAND_STORE_SCHEMA_VERSION = 1;
export const BACKUP_OPERATION_COMMAND_STORE_KIND = 'studio.backup-operation-command-store';

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const TERMINAL_STATUSES = new Set(['SUCCEEDED', 'FAILED', 'INTERRUPTED']);

function exactPlainRecord(value, allowed, label, code) {
  invariant(
    value !== null
      && typeof value === 'object'
      && !Array.isArray(value)
      && !utilTypes.isProxy(value),
    code,
    `${label} must be an inspectable plain object.`,
    { port: label },
  );
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    invariant(false, code, `${label} must be inspectable.`, { port: label });
  }
  invariant(
    prototype === Object.prototype || prototype === null,
    code,
    `${label} must be a plain object.`,
    { port: label },
  );
  invariant(
    keys.length === allowed.length
      && keys.every((key) => typeof key === 'string' && allowed.includes(key)),
    code,
    `${label} contains fields outside its exact v1 contract.`,
    { port: label },
  );
  const snapshot = Object.create(null);
  for (const field of allowed) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, field);
    } catch {
      invariant(false, code, `${label}.${field} must be inspectable.`, { port: label });
    }
    invariant(
      descriptor
        && Object.hasOwn(descriptor, 'value')
        && descriptor.enumerable === true,
      code,
      `${label}.${field} must be an enumerable own data field.`,
      { port: label },
    );
    snapshot[field] = descriptor.value;
  }
  return snapshot;
}

function optionalPlainRecord(value, allowed, label, code) {
  if (value === null) return null;
  return exactPlainRecord(value, allowed, label, code);
}

function requireId(value, label, code = 'OPERATIONS_UNAVAILABLE') {
  invariant(
    typeof value === 'string' && value.trim() === value && ID_PATTERN.test(value),
    code,
    `${label} must be an opaque stable identifier.`,
    { port: label },
  );
  return value;
}

function requireIsoDate(value, label, code = 'OPERATIONS_UNAVAILABLE') {
  invariant(
    typeof value === 'string'
      && !Number.isNaN(Date.parse(value))
      && new Date(value).toISOString() === value,
    code,
    `${label} must be a canonical ISO date-time.`,
    { port: label },
  );
  return value;
}

function requireNullableIsoDate(value, label) {
  return value === null ? null : requireIsoDate(value, label);
}

function requireNullableId(value, label) {
  return value === null ? null : requireId(value, label);
}

function requireNullableLabel(value, label) {
  if (value === null) return null;
  invariant(
    typeof value === 'string'
      && value.trim() === value
      && value.length >= 1
      && value.length <= 160
      && !CONTROL_CHARACTER_PATTERN.test(value),
    'OPERATIONS_UNAVAILABLE',
    `${label} must be a bounded safe display label.`,
    { port: label },
  );
  return value;
}

function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function validateLocalWorkspaceOperatorContext(value) {
  if (value === null || value === undefined) throw backupOperationFailure('WORKSPACE_OPERATOR_REQUIRED');
  let context;
  try {
    context = exactPlainRecord(
      value,
      ['schemaVersion', 'kind', 'subject', 'capabilities'],
      'workspaceOperatorContext',
      'WORKSPACE_OPERATOR_FORBIDDEN',
    );
  } catch {
    throw backupOperationFailure('WORKSPACE_OPERATOR_FORBIDDEN');
  }
  let capabilitiesAllowed = false;
  try {
    const capabilityKeys = Reflect.ownKeys(context.capabilities);
    const capability = Object.getOwnPropertyDescriptor(context.capabilities, '0');
    const length = Object.getOwnPropertyDescriptor(context.capabilities, 'length');
    capabilitiesAllowed = Array.isArray(context.capabilities)
      && !utilTypes.isProxy(context.capabilities)
      && Object.getPrototypeOf(context.capabilities) === Array.prototype
      && capabilityKeys.length === 2
      && capabilityKeys.includes('0')
      && capabilityKeys.includes('length')
      && capability
      && Object.hasOwn(capability, 'value')
      && capability.enumerable === true
      && capability.value === WORKSPACE_BACKUP_CAPABILITY
      && length
      && Object.hasOwn(length, 'value')
      && length.value === 1;
  } catch {
    capabilitiesAllowed = false;
  }
  const allowed = context.schemaVersion === 1
    && context.kind === LOCAL_WORKSPACE_OPERATOR_KIND
    && context.subject === LOCAL_WORKSPACE_OPERATOR_SUBJECT
    && capabilitiesAllowed;
  if (!allowed) throw backupOperationFailure('WORKSPACE_OPERATOR_FORBIDDEN');
  return deepFreeze({
    schemaVersion: 1,
    kind: LOCAL_WORKSPACE_OPERATOR_KIND,
    subject: LOCAL_WORKSPACE_OPERATOR_SUBJECT,
    capabilities: [WORKSPACE_BACKUP_CAPABILITY],
  });
}

export function validateBackupOperationCommandStore(value) {
  const port = exactPlainRecord(
    value,
    ['schemaVersion', 'kind', 'reserveOperation', 'readOperation'],
    'backupOperationCommandStore',
    'OPERATIONS_UNAVAILABLE',
  );
  invariant(
    port.schemaVersion === BACKUP_OPERATION_COMMAND_STORE_SCHEMA_VERSION
      && port.kind === BACKUP_OPERATION_COMMAND_STORE_KIND
      && typeof port.reserveOperation === 'function'
      && typeof port.readOperation === 'function'
      && !utilTypes.isProxy(port.reserveOperation)
      && !utilTypes.isProxy(port.readOperation),
    'OPERATIONS_UNAVAILABLE',
    'Unsupported backup operation command store.',
    { port: 'backupOperationCommandStore' },
  );
  const reserveOperation = port.reserveOperation;
  const readOperation = port.readOperation;
  return Object.freeze({
    schemaVersion: BACKUP_OPERATION_COMMAND_STORE_SCHEMA_VERSION,
    kind: BACKUP_OPERATION_COMMAND_STORE_KIND,
    reserveOperation: (reservation) => reserveOperation.call(value, reservation),
    readOperation: (selection) => readOperation.call(value, selection),
  });
}

function validateSafeResult(value) {
  if (value === null) return null;
  const result = optionalPlainRecord(value, [
    'manifestIdentity',
    'itemCount',
    'byteCount',
    'verifiedAt',
    'recoveryTestedAt',
    'backupHealth',
    'restoredCopyLifecycle',
  ], 'backupOperation.result', 'OPERATIONS_UNAVAILABLE');
  invariant(
    result.manifestIdentity === null
      || (typeof result.manifestIdentity === 'string'
        && SHA256_PATTERN.test(result.manifestIdentity)),
    'OPERATIONS_UNAVAILABLE',
    'The operation result manifest identity is invalid.',
  );
  for (const field of ['itemCount', 'byteCount']) {
    invariant(
      result[field] === null || (Number.isSafeInteger(result[field]) && result[field] >= 0),
      'OPERATIONS_UNAVAILABLE',
      `The operation result ${field} is invalid.`,
    );
  }
  for (const field of ['verifiedAt', 'recoveryTestedAt']) {
    if (result[field] !== null) requireIsoDate(result[field], `backupOperation.result.${field}`);
  }
  invariant(
    result.backupHealth === null
      || ['UNVERIFIED', 'VERIFIED', 'SUSPECT', 'MISSING'].includes(result.backupHealth),
    'OPERATIONS_UNAVAILABLE',
    'The operation result backup health is invalid.',
  );
  invariant(
    result.restoredCopyLifecycle === null
      || result.restoredCopyLifecycle === 'QUARANTINED_VERIFIED',
    'OPERATIONS_UNAVAILABLE',
    'The restored-copy lifecycle is invalid.',
  );
  return {
    manifestIdentity: result.manifestIdentity,
    itemCount: result.itemCount,
    byteCount: result.byteCount,
    verifiedAt: result.verifiedAt,
    recoveryTestedAt: result.recoveryTestedAt,
    backupHealth: result.backupHealth,
    restoredCopyLifecycle: result.restoredCopyLifecycle,
  };
}

export function projectBackupOperation(value) {
  const record = exactPlainRecord(value, [
    'schemaVersion',
    'operationId',
    'kind',
    'status',
    'phase',
    'progress',
    'destinationId',
    'destinationLabel',
    'backupId',
    'restoredCopyId',
    'result',
    'failure',
    'createdAt',
    'startedAt',
    'finishedAt',
    'updatedAt',
  ], 'backupOperation', 'OPERATIONS_UNAVAILABLE');
  invariant(
    record.schemaVersion === BACKUP_OPERATION_SCHEMA_VERSION,
    'OPERATIONS_UNAVAILABLE',
    'Unsupported backup operation record schema.',
  );
  const state = validateBackupOperationState({
    kind: record.kind,
    status: record.status,
    phase: record.phase,
    progress: record.progress,
  });
  const terminal = TERMINAL_STATUSES.has(state.status);
  invariant(
    (terminal && record.finishedAt !== null) || (!terminal && record.finishedAt === null),
    'OPERATIONS_UNAVAILABLE',
    'The operation finish timestamp does not match its state.',
  );
  invariant(
    (state.status === 'QUEUED' && record.startedAt === null)
      || (state.status !== 'QUEUED' && record.startedAt !== null),
    'OPERATIONS_UNAVAILABLE',
    'The operation start timestamp does not match its state.',
  );
  const failure = record.failure === null
    ? null
    : projectBackupOperationFailure(record.failure, { kind: state.kind });
  invariant(
    (['FAILED', 'INTERRUPTED'].includes(state.status) && failure !== null)
      || (!['FAILED', 'INTERRUPTED'].includes(state.status) && failure === null),
    'OPERATIONS_UNAVAILABLE',
    'The operation failure projection does not match its state.',
  );
  invariant(
    state.status !== 'INTERRUPTED' || failure.code === 'OPERATION_INTERRUPTED',
    'OPERATIONS_UNAVAILABLE',
    'An interrupted operation must use the fixed interrupted failure code.',
  );
  invariant(
    !['QUEUED', 'RUNNING'].includes(state.status) || record.result === null,
    'OPERATIONS_UNAVAILABLE',
    'A nonterminal operation cannot expose a terminal result.',
  );
  return deepFreeze({
    schemaVersion: BACKUP_OPERATION_SCHEMA_VERSION,
    operationId: requireId(record.operationId, 'backupOperation.operationId'),
    kind: state.kind,
    status: state.status,
    phase: state.phase,
    progress: { ...state.progress },
    destinationId: requireNullableId(record.destinationId, 'backupOperation.destinationId'),
    destinationLabel: requireNullableLabel(record.destinationLabel, 'backupOperation.destinationLabel'),
    backupId: requireNullableId(record.backupId, 'backupOperation.backupId'),
    restoredCopyId: requireNullableId(record.restoredCopyId, 'backupOperation.restoredCopyId'),
    result: validateSafeResult(record.result),
    failure,
    createdAt: requireIsoDate(record.createdAt, 'backupOperation.createdAt'),
    startedAt: requireNullableIsoDate(record.startedAt, 'backupOperation.startedAt'),
    finishedAt: requireNullableIsoDate(record.finishedAt, 'backupOperation.finishedAt'),
    updatedAt: requireIsoDate(record.updatedAt, 'backupOperation.updatedAt'),
  });
}

function opaqueId(namespace) {
  return `${namespace}.${randomBytes(24).toString('base64url')}`;
}

function validateClock(clock) {
  invariant(typeof clock === 'function' && !utilTypes.isProxy(clock), 'OPERATIONS_UNAVAILABLE', 'A trusted operation clock is required.');
  return clock;
}

function validateIdFactory(idFactory) {
  invariant(typeof idFactory === 'function' && !utilTypes.isProxy(idFactory), 'OPERATIONS_UNAVAILABLE', 'A trusted operation ID factory is required.');
  return idFactory;
}

function safeStoreError(error, fallbackCode = 'OPERATIONS_UNAVAILABLE') {
  const projected = projectBackupOperationFailure(error);
  const accepted = new Set([
    'OPERATIONS_UNAVAILABLE',
    'OPERATION_NOT_FOUND',
    'OPERATION_IDEMPOTENCY_CONFLICT',
    'OPERATION_STATE_CONFLICT',
    'BACKUP_DESTINATION_UNKNOWN',
  ]);
  return backupOperationFailure(accepted.has(projected.code) ? projected.code : fallbackCode);
}

async function invokeStore(operation, fallbackCode) {
  try {
    return await operation();
  } catch (error) {
    throw safeStoreError(error, fallbackCode);
  }
}

export class BackupOperationService {
  #store;

  #clock;

  #idFactory;

  constructor({
    store,
    clock = () => new Date().toISOString(),
    idFactory = opaqueId,
  } = {}) {
    this.#store = validateBackupOperationCommandStore(store);
    this.#clock = validateClock(clock);
    this.#idFactory = validateIdFactory(idFactory);
  }

  async requestOperation(requestValue, contextValue) {
    const context = validateLocalWorkspaceOperatorContext(contextValue);
    const request = validateBackupOperationRequest(requestValue);
    const createdAt = requireIsoDate(this.#clock(), 'clock', 'OPERATIONS_UNAVAILABLE');
    const operationId = requireId(this.#idFactory('operation'), 'operationId');
    const createdBackupId = request.kind === 'CREATE'
      ? requireId(this.#idFactory('backup'), 'createdBackupId')
      : null;
    const restoredCopyId = request.kind === 'RESTORE_AS_COPY'
      ? requireId(this.#idFactory('restored-copy'), 'restoredCopyId')
      : null;
    const initial = initialBackupOperationState(request.kind);
    const reservation = deepFreeze({
      schemaVersion: BACKUP_OPERATION_SCHEMA_VERSION,
      operationId,
      kind: request.kind,
      idempotencyKey: request.idempotencyKey,
      requestFingerprint: backupOperationRequestFingerprint(request),
      creatorSubject: context.subject,
      destinationId: request.destinationId ?? null,
      sourceBackupId: request.backupId ?? null,
      createdBackupId,
      restoredCopyId,
      status: initial.status,
      phase: initial.phase,
      progress: { ...initial.progress },
      createdAt,
    });
    const record = await invokeStore(
      () => this.#store.reserveOperation(reservation),
      'OPERATIONS_UNAVAILABLE',
    );
    return projectBackupOperation(record);
  }

  async readOperation(selectionValue, contextValue) {
    validateLocalWorkspaceOperatorContext(contextValue);
    const selection = exactPlainRecord(
      selectionValue,
      ['schemaVersion', 'operationId'],
      'backupOperationSelection',
      'OPERATION_NOT_FOUND',
    );
    invariant(
      selection.schemaVersion === BACKUP_OPERATION_SCHEMA_VERSION,
      'OPERATION_NOT_FOUND',
      'Unsupported backup operation selection schema.',
    );
    const operationId = requireId(selection.operationId, 'operationId', 'OPERATION_NOT_FOUND');
    const record = await invokeStore(
      () => this.#store.readOperation(Object.freeze({
        schemaVersion: BACKUP_OPERATION_SCHEMA_VERSION,
        operationId,
      })),
      'OPERATIONS_UNAVAILABLE',
    );
    if (record === null) throw backupOperationFailure('OPERATION_NOT_FOUND');
    return projectBackupOperation(record);
  }
}
