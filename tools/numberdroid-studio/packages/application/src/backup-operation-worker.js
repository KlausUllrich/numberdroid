import { types as utilTypes } from 'node:util';
import {
  BACKUP_HEALTH_STATES,
  BACKUP_OPERATION_SCHEMA_VERSION,
  RESTORED_COPY_LIFECYCLES,
  backupOperationFailure,
  nextBackupOperationPhase,
  projectBackupOperationFailure,
  transitionBackupOperationState,
  validateBackupOperationState,
} from '../../domain/src/backup-operation.js';
import { invariant } from '../../domain/src/errors.js';

export const BACKUP_OPERATION_WORKER_STORE_SCHEMA_VERSION = 1;
export const BACKUP_OPERATION_WORKER_STORE_KIND = 'studio.backup-operation-worker-store';
export const BACKUP_OPERATION_PHASE_EXECUTOR_SCHEMA_VERSION = 1;
export const BACKUP_OPERATION_PHASE_EXECUTOR_KIND = 'studio.backup-operation-phase-executor';
export const BACKUP_OPERATION_PHASE_OUTCOME_KIND = 'studio.backup-operation-phase-outcome';

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const FAILURE_HEALTH_EFFECTS = Object.freeze(['UNCHANGED', 'SUSPECT', 'MISSING']);
const PHASE_FAILURE_CODES = new Set([
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
]);

function exactPlainRecord(value, allowed, label, code = 'OPERATIONS_UNAVAILABLE') {
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

function inspectPlainRecordFields(value, label) {
  invariant(
    value !== null
      && typeof value === 'object'
      && !Array.isArray(value)
      && !utilTypes.isProxy(value),
    'OPERATIONS_UNAVAILABLE',
    `${label} must be an inspectable plain object.`,
    { port: label },
  );
  let keys;
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    invariant(false, 'OPERATIONS_UNAVAILABLE', `${label} must be inspectable.`, { port: label });
  }
  invariant(
    keys.length <= 8 && keys.every((key) => typeof key === 'string'),
    'OPERATIONS_UNAVAILABLE',
    `${label} must contain only its bounded string fields.`,
    { port: label },
  );
  return keys;
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

function requireNullableId(value, label) {
  return value === null ? null : requireId(value, label);
}

function requirePositiveInteger(value, label) {
  invariant(
    Number.isSafeInteger(value) && value >= 1,
    'OPERATIONS_UNAVAILABLE',
    `${label} must be a positive safe integer.`,
    { port: label },
  );
  return value;
}

function requireNonnegativeInteger(value, label) {
  invariant(
    Number.isSafeInteger(value) && value >= 0,
    'OPERATIONS_UNAVAILABLE',
    `${label} must be a nonnegative safe integer.`,
    { port: label },
  );
  return value;
}

function requireIsoDate(value, label) {
  invariant(
    typeof value === 'string'
      && !Number.isNaN(Date.parse(value))
      && new Date(value).toISOString() === value,
    'OPERATIONS_UNAVAILABLE',
    `${label} must be a canonical ISO date-time.`,
    { port: label },
  );
  return value;
}

function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function exactPort(value, allowed, label) {
  return exactPlainRecord(value, allowed, label, 'OPERATIONS_UNAVAILABLE');
}

export function validateBackupOperationWorkerStore(value) {
  const port = exactPort(value, [
    'schemaVersion',
    'kind',
    'leaseConfiguration',
    'claimNextOperation',
    'renewOperationLease',
    'commitOperationPhase',
    'failOperation',
  ], 'backupOperationWorkerStore');
  invariant(
    port.schemaVersion === BACKUP_OPERATION_WORKER_STORE_SCHEMA_VERSION
      && port.kind === BACKUP_OPERATION_WORKER_STORE_KIND,
    'OPERATIONS_UNAVAILABLE',
    'Unsupported backup operation worker store.',
    { port: 'backupOperationWorkerStore' },
  );
  const leaseConfiguration = exactPlainRecord(
    port.leaseConfiguration,
    ['schemaVersion', 'ttlMs', 'heartbeatIntervalMs'],
    'backupOperationWorkerStore.leaseConfiguration',
    'OPERATIONS_UNAVAILABLE',
  );
  invariant(
    leaseConfiguration.schemaVersion === 1
      && Number.isSafeInteger(leaseConfiguration.ttlMs)
      && leaseConfiguration.ttlMs >= 1000
      && leaseConfiguration.ttlMs <= 300_000
      && Number.isSafeInteger(leaseConfiguration.heartbeatIntervalMs)
      && leaseConfiguration.heartbeatIntervalMs >= 1
      && leaseConfiguration.heartbeatIntervalMs < leaseConfiguration.ttlMs,
    'OPERATIONS_UNAVAILABLE',
    'The backup worker lease configuration is invalid.',
  );
  for (const method of [
    'claimNextOperation',
    'renewOperationLease',
    'commitOperationPhase',
    'failOperation',
  ]) {
    invariant(
      typeof port[method] === 'function' && !utilTypes.isProxy(port[method]),
      'OPERATIONS_UNAVAILABLE',
      `The backup operation worker store must expose ${method}().`,
      { port: 'backupOperationWorkerStore' },
    );
  }
  return Object.freeze({
    schemaVersion: BACKUP_OPERATION_WORKER_STORE_SCHEMA_VERSION,
    kind: BACKUP_OPERATION_WORKER_STORE_KIND,
    leaseConfiguration: Object.freeze({
      schemaVersion: 1,
      ttlMs: leaseConfiguration.ttlMs,
      heartbeatIntervalMs: leaseConfiguration.heartbeatIntervalMs,
    }),
    claimNextOperation: (claim) => port.claimNextOperation.call(value, claim),
    renewOperationLease: (renewal) => port.renewOperationLease.call(value, renewal),
    commitOperationPhase: (transition) => port.commitOperationPhase.call(value, transition),
    failOperation: (terminal) => port.failOperation.call(value, terminal),
  });
}

export function validateBackupOperationPhaseExecutor(value) {
  const port = exactPort(
    value,
    ['schemaVersion', 'kind', 'executePhase', 'releaseOperationResources'],
    'backupOperationPhaseExecutor',
  );
  invariant(
    port.schemaVersion === BACKUP_OPERATION_PHASE_EXECUTOR_SCHEMA_VERSION
      && port.kind === BACKUP_OPERATION_PHASE_EXECUTOR_KIND
      && typeof port.executePhase === 'function'
      && !utilTypes.isProxy(port.executePhase)
      && typeof port.releaseOperationResources === 'function'
      && !utilTypes.isProxy(port.releaseOperationResources),
    'OPERATIONS_UNAVAILABLE',
    'Unsupported backup operation phase executor.',
    { port: 'backupOperationPhaseExecutor' },
  );
  return Object.freeze({
    schemaVersion: BACKUP_OPERATION_PHASE_EXECUTOR_SCHEMA_VERSION,
    kind: BACKUP_OPERATION_PHASE_EXECUTOR_KIND,
    executePhase: (selection, options) => port.executePhase.call(value, selection, options),
    releaseOperationResources: (selection) => port.releaseOperationResources.call(value, selection),
  });
}

function validateAbortSignal(value) {
  if (value === undefined) return undefined;
  invariant(
    value !== null && typeof value === 'object' && !utilTypes.isProxy(value),
    'OPERATION_STATE_CONFLICT',
    'The worker signal must be an AbortSignal.',
  );
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    invariant(false, 'OPERATION_STATE_CONFLICT', 'The worker signal must be inspectable.');
  }
  invariant(
    prototype === AbortSignal.prototype && keys.every((key) => typeof key === 'symbol'),
    'OPERATION_STATE_CONFLICT',
    'The worker signal must be an unmodified AbortSignal.',
  );
  return value;
}

function abort(signal) {
  if (signal !== undefined) AbortSignal.prototype.throwIfAborted.call(signal);
}

function validateWorkerOperation(value) {
  const operation = exactPlainRecord(value, [
    'schemaVersion',
    'operationId',
    'kind',
    'status',
    'phase',
    'progress',
    'generation',
    'destinationId',
    'sourceBackupId',
    'createdBackupId',
    'restoredCopyId',
  ], 'workerOperation');
  invariant(
    operation.schemaVersion === BACKUP_OPERATION_SCHEMA_VERSION,
    'OPERATIONS_UNAVAILABLE',
    'Unsupported worker operation schema.',
  );
  const state = validateBackupOperationState({
    kind: operation.kind,
    status: operation.status,
    phase: operation.phase,
    progress: operation.progress,
  });
  const coordinates = {
    destinationId: requireNullableId(operation.destinationId, 'workerOperation.destinationId'),
    sourceBackupId: requireNullableId(operation.sourceBackupId, 'workerOperation.sourceBackupId'),
    createdBackupId: requireNullableId(operation.createdBackupId, 'workerOperation.createdBackupId'),
    restoredCopyId: requireNullableId(operation.restoredCopyId, 'workerOperation.restoredCopyId'),
  };
  const coordinateShapeIsValid = {
    CREATE: coordinates.destinationId !== null
      && coordinates.sourceBackupId === null
      && coordinates.createdBackupId !== null
      && coordinates.restoredCopyId === null,
    VERIFY: coordinates.destinationId === null
      && coordinates.sourceBackupId !== null
      && coordinates.createdBackupId === null
      && coordinates.restoredCopyId === null,
    RECOVERY_TEST: coordinates.destinationId === null
      && coordinates.sourceBackupId !== null
      && coordinates.createdBackupId === null
      && coordinates.restoredCopyId === null,
    RESTORE_AS_COPY: coordinates.destinationId !== null
      && coordinates.sourceBackupId !== null
      && coordinates.createdBackupId === null
      && coordinates.restoredCopyId !== null,
  }[state.kind];
  invariant(
    coordinateShapeIsValid,
    'OPERATIONS_UNAVAILABLE',
    'The worker operation coordinates do not match its kind.',
  );
  return deepFreeze({
    schemaVersion: BACKUP_OPERATION_SCHEMA_VERSION,
    operationId: requireId(operation.operationId, 'workerOperation.operationId'),
    kind: state.kind,
    status: state.status,
    phase: state.phase,
    progress: { ...state.progress },
    generation: requirePositiveInteger(operation.generation, 'workerOperation.generation'),
    ...coordinates,
  });
}

function validateEvidence(value) {
  const evidence = exactPlainRecord(value, [
    'manifestIdentity',
    'itemCount',
    'byteCount',
    'verifiedAt',
    'recoveryTestedAt',
    'backupHealth',
    'restoredCopyLifecycle',
    'cleanupConfirmed',
  ], 'backupOperationPhaseOutcome.evidence');
  invariant(
    evidence.manifestIdentity === null
      || (typeof evidence.manifestIdentity === 'string'
        && SHA256_PATTERN.test(evidence.manifestIdentity)),
    'OPERATIONS_UNAVAILABLE',
    'Phase evidence contains an invalid manifest identity.',
  );
  const itemCount = evidence.itemCount === null
    ? null
    : requireNonnegativeInteger(evidence.itemCount, 'evidence.itemCount');
  const byteCount = evidence.byteCount === null
    ? null
    : requireNonnegativeInteger(evidence.byteCount, 'evidence.byteCount');
  const verifiedAt = evidence.verifiedAt === null
    ? null
    : requireIsoDate(evidence.verifiedAt, 'evidence.verifiedAt');
  const recoveryTestedAt = evidence.recoveryTestedAt === null
    ? null
    : requireIsoDate(evidence.recoveryTestedAt, 'evidence.recoveryTestedAt');
  invariant(
    evidence.backupHealth === null || BACKUP_HEALTH_STATES.includes(evidence.backupHealth),
    'OPERATIONS_UNAVAILABLE',
    'Phase evidence contains an invalid backup health.',
  );
  invariant(
    evidence.restoredCopyLifecycle === null
      || RESTORED_COPY_LIFECYCLES.includes(evidence.restoredCopyLifecycle),
    'OPERATIONS_UNAVAILABLE',
    'Phase evidence contains an invalid restored-copy lifecycle.',
  );
  invariant(
    evidence.cleanupConfirmed === null || typeof evidence.cleanupConfirmed === 'boolean',
    'OPERATIONS_UNAVAILABLE',
    'Phase evidence contains an invalid cleanup result.',
  );
  return deepFreeze({
    manifestIdentity: evidence.manifestIdentity,
    itemCount,
    byteCount,
    verifiedAt,
    recoveryTestedAt,
    backupHealth: evidence.backupHealth,
    restoredCopyLifecycle: evidence.restoredCopyLifecycle,
    cleanupConfirmed: evidence.cleanupConfirmed,
  });
}

function failureCodeRecord(code) {
  return Object.freeze(Object.defineProperty({}, 'code', {
    configurable: false,
    enumerable: true,
    writable: false,
    value: code,
  }));
}

function validatePhaseOutcome(value, { operationId, generation, targetPhase, kind }) {
  const base = exactPlainRecord(
    value,
    inspectPlainRecordFields(value, 'backupOperationPhaseOutcome'),
    'backupOperationPhaseOutcome',
  );
  invariant(
    base.schemaVersion === BACKUP_OPERATION_PHASE_EXECUTOR_SCHEMA_VERSION
      && base.kind === BACKUP_OPERATION_PHASE_OUTCOME_KIND
      && ['COMPLETED', 'FAILED'].includes(base.outcome),
    'OPERATIONS_UNAVAILABLE',
    'Unsupported backup operation phase outcome.',
  );
  const allowed = base.outcome === 'COMPLETED'
    ? ['schemaVersion', 'kind', 'outcome', 'operationId', 'generation', 'phase', 'evidence']
    : [
      'schemaVersion', 'kind', 'outcome', 'operationId', 'generation', 'phase',
      'failureCode', 'backupHealthEffect',
    ];
  const outcome = exactPlainRecord(value, allowed, 'backupOperationPhaseOutcome');
  invariant(
    outcome.operationId === operationId
      && outcome.generation === generation
      && outcome.phase === targetPhase,
    'OPERATIONS_UNAVAILABLE',
    'The phase outcome does not match its fenced request.',
  );
  if (outcome.outcome === 'COMPLETED') {
    return deepFreeze({
      outcome: 'COMPLETED',
      evidence: validateEvidence(outcome.evidence),
    });
  }
  const failure = projectBackupOperationFailure(failureCodeRecord(outcome.failureCode), { kind });
  invariant(
    failure.code === outcome.failureCode && PHASE_FAILURE_CODES.has(failure.code),
    'OPERATIONS_UNAVAILABLE',
    'The phase executor returned a failure code outside its bounded effect contract.',
  );
  invariant(
    FAILURE_HEALTH_EFFECTS.includes(outcome.backupHealthEffect),
    'OPERATIONS_UNAVAILABLE',
    'The phase executor returned an invalid backup-health effect.',
  );
  invariant(
    outcome.backupHealthEffect === 'UNCHANGED' || kind !== 'CREATE',
    'OPERATIONS_UNAVAILABLE',
    'Create cannot mutate the health of a source backup.',
  );
  return deepFreeze({
    outcome: 'FAILED',
    failure,
    backupHealthEffect: outcome.backupHealthEffect,
  });
}

function isAbort(error, signal) {
  return signal?.aborted === true;
}

function inspectErrorCode(error) {
  if (error === null || typeof error !== 'object' || utilTypes.isProxy(error)) return null;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(error, 'code');
    return descriptor && Object.hasOwn(descriptor, 'value') && typeof descriptor.value === 'string'
      ? descriptor.value
      : null;
  } catch {
    return null;
  }
}

function sanitizeStoreError(error) {
  const code = inspectErrorCode(error);
  if (['OPERATION_LEASE_LOST', 'OPERATION_STATE_CONFLICT', 'OPERATIONS_UNAVAILABLE'].includes(code)) {
    return backupOperationFailure(code);
  }
  return backupOperationFailure('OPERATIONS_UNAVAILABLE');
}

async function invokeStore(operation) {
  try {
    return await operation();
  } catch (error) {
    throw sanitizeStoreError(error);
  }
}

function workerSummary(operation, failure = null) {
  const state = validateBackupOperationState({
    kind: operation.kind,
    status: operation.status,
    phase: operation.phase,
    progress: operation.progress,
  });
  return deepFreeze({
    schemaVersion: BACKUP_OPERATION_SCHEMA_VERSION,
    operationId: operation.operationId,
    kind: state.kind,
    status: state.status,
    phase: state.phase,
    progress: { ...state.progress },
    failure,
  });
}

function serializedPhaseHeartbeat({ renew, intervalMs, onFailure }) {
  let firstError = null;
  let stopped = false;
  let timer = null;
  let wakeTimer = null;
  let renewalTail = Promise.resolve();

  const heartbeat = () => {
    const renewal = renewalTail.then(async () => {
      if (firstError !== null) throw firstError;
      return renew();
    });
    const observed = renewal.catch((error) => {
      if (firstError === null) {
        firstError = error;
        onFailure(error);
      }
      throw error;
    });
    renewalTail = observed.catch(() => undefined);
    return observed;
  };

  const waitForInterval = () => new Promise((resolveWait) => {
    wakeTimer = resolveWait;
    timer = setTimeout(() => {
      timer = null;
      wakeTimer = null;
      resolveWait();
    }, intervalMs);
  });

  const timerLoop = (async () => {
    while (!stopped && firstError === null) {
      await waitForInterval();
      if (stopped || firstError !== null) break;
      try {
        await heartbeat();
      } catch {
        break;
      }
    }
  })();

  return Object.freeze({
    heartbeat,
    async stop() {
      stopped = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      wakeTimer?.();
      wakeTimer = null;
      await timerLoop;
      await renewalTail;
      return firstError;
    },
  });
}

async function executePhaseWithHeartbeat({ executor, selection, signal, renew, intervalMs }) {
  const fenceController = new AbortController();
  const phaseSignal = signal === undefined
    ? fenceController.signal
    : AbortSignal.any([signal, fenceController.signal]);
  const heartbeat = serializedPhaseHeartbeat({
    renew,
    intervalMs,
    onFailure(error) {
      if (!fenceController.signal.aborted) fenceController.abort(error);
    },
  });
  let value;
  let phaseError = null;
  try {
    value = await executor.executePhase(
      selection,
      Object.freeze({ signal: phaseSignal, heartbeat: heartbeat.heartbeat }),
    );
  } catch (error) {
    phaseError = error;
  }
  const heartbeatError = await heartbeat.stop();
  if (heartbeatError !== null) throw heartbeatError;
  if (phaseError !== null) throw phaseError;
  return value;
}

export class BackupOperationWorker {
  #store;

  #executor;

  #running = false;

  constructor({ store, phaseExecutor } = {}) {
    this.#store = validateBackupOperationWorkerStore(store);
    this.#executor = validateBackupOperationPhaseExecutor(phaseExecutor);
  }

  async runNext({ workerId: workerIdValue, signal: signalValue } = {}) {
    invariant(!this.#running, 'OPERATION_STATE_CONFLICT', 'The serialized backup worker is already running.');
    const workerId = requireId(workerIdValue, 'workerId', 'OPERATION_STATE_CONFLICT');
    const signal = validateAbortSignal(signalValue);
    abort(signal);
    this.#running = true;
    let resourceSelection = null;
    let primaryErrorActive = false;
    try {
      const claimedValue = await invokeStore(() => this.#store.claimNextOperation(Object.freeze({
        schemaVersion: BACKUP_OPERATION_SCHEMA_VERSION,
        workerId,
      })));
      abort(signal);
      if (claimedValue === null) return null;
      let operation = validateWorkerOperation(claimedValue);
      resourceSelection = deepFreeze({
        schemaVersion: BACKUP_OPERATION_SCHEMA_VERSION,
        operationId: operation.operationId,
      });
      invariant(
        operation.status === 'RUNNING',
        'OPERATIONS_UNAVAILABLE',
        'The worker store returned an operation that is not running.',
      );

      while (operation.status === 'RUNNING') {
        abort(signal);
        const targetPhase = nextBackupOperationPhase(operation.kind, operation.phase);
        const expectedState = transitionBackupOperationState({
          kind: operation.kind,
          status: operation.status,
          phase: operation.phase,
          progress: operation.progress,
        }, {
          status: targetPhase === 'COMPLETED' ? 'SUCCEEDED' : 'RUNNING',
          phase: targetPhase,
        });
        const selection = deepFreeze({
          schemaVersion: BACKUP_OPERATION_SCHEMA_VERSION,
          operationId: operation.operationId,
          kind: operation.kind,
          generation: operation.generation,
          completedPhase: operation.phase,
          targetPhase,
          destinationId: operation.destinationId,
          sourceBackupId: operation.sourceBackupId,
          createdBackupId: operation.createdBackupId,
          restoredCopyId: operation.restoredCopyId,
        });
        const leaseOperationId = operation.operationId;
        const leaseGeneration = operation.generation;
        const leasePhase = operation.phase;
        const heartbeat = async () => {
          abort(signal);
          await invokeStore(() => this.#store.renewOperationLease(Object.freeze({
            schemaVersion: BACKUP_OPERATION_SCHEMA_VERSION,
            operationId: leaseOperationId,
            generation: leaseGeneration,
            phase: leasePhase,
          })));
          abort(signal);
        };

        let outcome;
        try {
          const value = await executePhaseWithHeartbeat({
            executor: this.#executor,
            selection,
            signal,
            renew: heartbeat,
            intervalMs: this.#store.leaseConfiguration.heartbeatIntervalMs,
          });
          abort(signal);
          outcome = validatePhaseOutcome(value, {
            operationId: operation.operationId,
            generation: operation.generation,
            targetPhase,
            kind: operation.kind,
          });
        } catch (error) {
          if (isAbort(error, signal)) throw error;
          const code = inspectErrorCode(error);
          if (['OPERATION_LEASE_LOST', 'OPERATION_STATE_CONFLICT', 'OPERATIONS_UNAVAILABLE'].includes(code)) {
            throw backupOperationFailure(code);
          }
          outcome = {
            outcome: 'FAILED',
            failure: projectBackupOperationFailure(error, { kind: operation.kind }),
            backupHealthEffect: 'UNCHANGED',
          };
        }

        if (outcome.outcome === 'FAILED') {
          const failedValue = await invokeStore(() => this.#store.failOperation(deepFreeze({
            schemaVersion: BACKUP_OPERATION_SCHEMA_VERSION,
            operationId: operation.operationId,
            generation: operation.generation,
            expectedStatus: operation.status,
            expectedPhase: operation.phase,
            failure: outcome.failure,
            backupHealthEffect: outcome.backupHealthEffect,
          })));
          const failed = validateWorkerOperation(failedValue);
          invariant(
            failed.status === 'FAILED' && failed.phase === operation.phase,
            'OPERATIONS_UNAVAILABLE',
            'The worker store did not retain the failed operation phase.',
          );
          return workerSummary(failed, outcome.failure);
        }

        const committedValue = await invokeStore(() => this.#store.commitOperationPhase(deepFreeze({
          schemaVersion: BACKUP_OPERATION_SCHEMA_VERSION,
          operationId: operation.operationId,
          generation: operation.generation,
          expectedStatus: operation.status,
          expectedPhase: operation.phase,
          nextStatus: expectedState.status,
          nextPhase: expectedState.phase,
          progress: { ...expectedState.progress },
          evidence: outcome.evidence,
        })));
        operation = validateWorkerOperation(committedValue);
        invariant(
          operation.status === expectedState.status
            && operation.phase === expectedState.phase
            && operation.generation === selection.generation,
          'OPERATIONS_UNAVAILABLE',
          'The worker store returned an unexpected phase transition.',
        );
      }
      return workerSummary(operation);
    } catch (error) {
      primaryErrorActive = true;
      throw error;
    } finally {
      try {
        if (resourceSelection !== null) {
          await this.#executor.releaseOperationResources(resourceSelection);
        }
      } catch {
        if (!primaryErrorActive) {
          throw backupOperationFailure('OPERATIONS_UNAVAILABLE');
        }
      } finally {
        this.#running = false;
      }
    }
  }
}
