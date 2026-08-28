import { types as utilTypes } from 'node:util';
import {
  PROCESSING_RESULT_ADOPTION_AUTHORITY_BINDING_KIND,
  PROCESSING_RESULT_ADOPTION_SCHEMA_VERSION,
  processingResultAdoptionSemanticSha256,
  validateProcessingResultAdoptionCommand,
} from '../../domain/src/processing-result-adoption.js';
import {
  validateProcessingResultAdoptionCommitResult,
} from '../../domain/src/processing-result-adoption-commit.js';
import { StudioError, invariant } from '../../domain/src/errors.js';
import {
  validateProcessingResultAdoptionTrustedContext,
} from './processing-result-adoption.js';

export const PROCESSING_RESULT_ADOPTION_ATOMIC_STORE_SCHEMA_VERSION = 1;
export const PROCESSING_RESULT_ADOPTION_ATOMIC_STORE_KIND = 'studio.processing-result-adoption-atomic-store';
export const PROCESSING_RESULT_ADOPTION_HOST_BOUND_ATOMIC_STORE_KIND = 'studio.processing-result-adoption-host-bound-atomic-store';

const ATOMIC_STORE_PORT = 'processingResultAdoptionAtomicStore';
const EXPECTED_ATOMIC_REJECTION_CODES = new Set([
  'AUTO_ACCEPT_FORBIDDEN',
  'ARTIFACT_CORRUPT',
  'ARTIFACT_DESCRIPTOR_MISMATCH',
  'ARTIFACT_MISSING',
  'ARTIFACT_NOT_LIVE',
  'ARTIFACT_NOT_REGISTERED',
  'ARTIFACT_PROJECT_REFERENCE_MISSING',
  'ASSET_METADATA_FINGERPRINT_MISMATCH',
  'ASSET_VERSION_CONFLICT',
  'BUDGET_EXCEEDED',
  'COMMAND_ID_CONFLICT',
  'GRANT_ACTOR_MISMATCH',
  'GRANT_BRANCH_MISMATCH',
  'GRANT_EXPIRED',
  'GRANT_NOT_FOUND',
  'GRANT_REQUIRED',
  'GRANT_REVOKED',
  'GRANT_SCOPE_MISSING',
  'GRANT_TASK_MISMATCH',
  'HOST_BINDING_EXPIRED',
  'HOST_BINDING_GRANT_MISMATCH',
  'HOST_BINDING_NOT_FOUND',
  'HOST_BINDING_REVOKED',
  'IDEMPOTENCY_CONFLICT',
  'OBJECT_SCOPE_DENIED',
  'PROCESSING_ADOPTION_ARTIFACT_CONTENT_CORRUPT',
  'PROCESSING_ADOPTION_ARTIFACT_CONTENT_MISSING',
  'PROCESSING_ADOPTION_ARTIFACT_DESCRIPTOR_MISMATCH',
  'PROCESSING_ADOPTION_ARTIFACT_METADATA_MISSING',
  'PROCESSING_ADOPTION_ARTIFACT_NOT_LIVE',
  'PROCESSING_ADOPTION_ARTIFACT_PROJECT_REFERENCE_MISSING',
  'PROCESSING_ADOPTION_ASSET_STATE_NOT_CHECKED',
  'PROCESSING_ADOPTION_CAPABILITY_NOT_CHECKED',
  'PROCESSING_ADOPTION_CAPABILITY_PIN_MISMATCH',
  'PROCESSING_ADOPTION_CAPABILITY_PROFILE_NOT_FOUND',
  'PROCESSING_ADOPTION_CAPABILITY_UNSUPPORTED',
  'PROCESSING_ADOPTION_PROJECT_REVISION_STALE',
  'PROCESSING_ADOPTION_TARGET_AMBIGUOUS',
  'PROCESSING_ADOPTION_TARGET_LEGACY_ONLY',
  'PROCESSING_ADOPTION_TARGET_NOT_FOUND',
  'PROCESSING_ADOPTION_TARGET_OCCUPIED',
  'PROCESSING_ADOPTION_TARGET_VERSION_CONFLICT',
  'PROCESSING_RESULT_ADOPTION_REVALIDATION_BLOCKED',
  'REVISION_CONFLICT',
  'TARGET_KIND_MISMATCH',
  'TARGET_NOT_FOUND',
  'TARGET_OCCUPIED',
  'PROCESSING_ADOPTION_TARGET_KIND_MISMATCH',
  'TASK_ACTOR_MISMATCH',
  'TASK_BRANCH_MISMATCH',
  'TASK_CAPABILITY_MISSING',
  'TASK_EXPIRED',
  'TASK_GRANT_MISMATCH',
  'TASK_NOT_EXECUTABLE',
  'TASK_NOT_FOUND',
  'TASK_PAUSED',
]);

function exactPlainRecord(
  value,
  allowed,
  label,
  code = 'PROCESSING_RESULT_ADOPTION_COMMIT_PORT_INVALID',
) {
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
    invariant(
      false,
      code,
      `${label} must be inspectable.`,
      { port: label },
    );
  }
  invariant(
    prototype === Object.prototype || prototype === null,
    code,
    `${label} must be a plain object.`,
    { port: label },
  );
  invariant(
    keys.every((key) => typeof key === 'string' && allowed.includes(key)),
    code,
    `${label} contains fields outside its v1 contract.`,
    { port: label },
  );
  const snapshot = Object.create(null);
  for (const field of allowed) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, field);
    } catch {
      invariant(
        false,
        code,
        `${label}.${field} must be inspectable.`,
        { port: label },
      );
    }
    if (!descriptor) continue;
    invariant(
      Object.hasOwn(descriptor, 'value') && descriptor.enumerable === true,
      code,
      `${label}.${field} must be an enumerable own data field.`,
      { port: label },
    );
    snapshot[field] = descriptor.value;
  }
  return snapshot;
}

function validateAbortSignal(value) {
  if (value === undefined) return undefined;
  invariant(
    value !== null && typeof value === 'object' && !utilTypes.isProxy(value),
    'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID',
    'Processing-result adoption commit signal must be an AbortSignal.',
  );
  let prototype;
  let stringKeys;
  try {
    prototype = Object.getPrototypeOf(value);
    stringKeys = Object.getOwnPropertyNames(value);
  } catch {
    invariant(
      false,
      'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID',
      'Processing-result adoption commit signal must be inspectable.',
    );
  }
  invariant(
    prototype === AbortSignal.prototype && stringKeys.length === 0,
    'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID',
    'Processing-result adoption commit signal must be an unmodified AbortSignal.',
  );
  return value;
}

function exactCommitOptions(value) {
  const options = exactPlainRecord(
    value,
    ['signal'],
    'processingResultAdoptionCommitOptions',
    'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID',
  );
  return validateAbortSignal(options.signal);
}

function validateAtomicStore(value, expectedKind) {
  const port = exactPlainRecord(value, [
    'schemaVersion',
    'kind',
    'commitProcessingResultAdoption',
  ], ATOMIC_STORE_PORT);
  invariant(
    Object.keys(port).length === 3
      && port.schemaVersion === PROCESSING_RESULT_ADOPTION_ATOMIC_STORE_SCHEMA_VERSION
      && port.kind === expectedKind,
    'PROCESSING_RESULT_ADOPTION_COMMIT_PORT_INVALID',
    'Unsupported processing-result adoption atomic store.',
    { port: ATOMIC_STORE_PORT },
  );
  invariant(
    typeof port.commitProcessingResultAdoption === 'function'
      && !utilTypes.isProxy(port.commitProcessingResultAdoption),
    'PROCESSING_RESULT_ADOPTION_COMMIT_PORT_INVALID',
    'The processing-result adoption atomic store must expose commitProcessingResultAdoption(command, trustedContext, options).',
    { port: ATOMIC_STORE_PORT },
  );
  const implementation = port.commitProcessingResultAdoption;
  return Object.freeze({
    schemaVersion: PROCESSING_RESULT_ADOPTION_ATOMIC_STORE_SCHEMA_VERSION,
    kind: expectedKind,
    commitProcessingResultAdoption: (command, trustedContext, options) => implementation.call(
      value,
      command,
      trustedContext,
      options,
    ),
  });
}

export function validateProcessingResultAdoptionAtomicStore(value) {
  return validateAtomicStore(value, PROCESSING_RESULT_ADOPTION_ATOMIC_STORE_KIND);
}

export function validateProcessingResultAdoptionHostBoundAtomicStore(value) {
  return validateAtomicStore(value, PROCESSING_RESULT_ADOPTION_HOST_BOUND_ATOMIC_STORE_KIND);
}

function abort(signal) {
  if (signal !== undefined) AbortSignal.prototype.throwIfAborted.call(signal);
}

function expectedAtomicRejectionCode(error) {
  if (error === null || typeof error !== 'object' || utilTypes.isProxy(error)) return null;
  try {
    if (Object.getPrototypeOf(error) !== StudioError.prototype) return null;
    const descriptor = Object.getOwnPropertyDescriptor(error, 'code');
    if (!descriptor
      || !Object.hasOwn(descriptor, 'value')
      || typeof descriptor.value !== 'string') return null;
    return EXPECTED_ATOMIC_REJECTION_CODES.has(descriptor.value)
      ? descriptor.value
      : null;
  } catch {
    return null;
  }
}

async function invokeAtomicStore(operation, signal) {
  abort(signal);
  try {
    const pending = operation();
    let result = pending;
    if (pending !== null && typeof pending === 'object' && !utilTypes.isProxy(pending)) {
      let prototype;
      let safePromiseInstrumentation = false;
      try {
        prototype = Object.getPrototypeOf(pending);
        safePromiseInstrumentation = Reflect.ownKeys(pending).every((key) => {
          if (typeof key !== 'symbol') return false;
          const descriptor = Object.getOwnPropertyDescriptor(pending, key);
          return descriptor !== undefined && Object.hasOwn(descriptor, 'value');
        });
      } catch {
        prototype = null;
      }
      if (prototype === Promise.prototype && safePromiseInstrumentation) {
        const envelope = await new Promise((resolve, reject) => {
          Promise.prototype.then.call(
            pending,
            (value) => resolve(Object.freeze({ value })),
            reject,
          );
        });
        result = envelope.value;
      }
    }
    abort(signal);
    // The envelope prevents async Promise resolution from consulting a raw
    // response's possibly hostile `then` property before strict validation.
    return Object.freeze({ value: result });
  } catch (error) {
    abort(signal);
    const rejectionCode = expectedAtomicRejectionCode(error);
    if (rejectionCode !== null) {
      throw new StudioError(
        rejectionCode,
        'The atomic processing-result adoption command was rejected.',
      );
    }
    throw new StudioError(
      'PROCESSING_RESULT_ADOPTION_COMMIT_PORT_FAILED',
      'The processing-result adoption atomic store failed.',
      { port: ATOMIC_STORE_PORT },
    );
  }
}

function assertCommitResultClosure(result, command, trustedContext) {
  const request = command.payload.preflightRequest;
  const authorityBinding = {
    schemaVersion: PROCESSING_RESULT_ADOPTION_SCHEMA_VERSION,
    kind: PROCESSING_RESULT_ADOPTION_AUTHORITY_BINDING_KIND,
    projectId: command.projectId,
    revision: command.baseRevision,
    actorId: trustedContext.actor.id,
    taskId: trustedContext.taskId,
    grantId: trustedContext.grantId,
    branchId: trustedContext.branchId,
  };
  const expectedMetadataVersions = request.target.operation === 'create'
    ? [1]
    : [request.target.expectedMetadataVersion, request.target.expectedMetadataVersion + 1];
  const recipeInput = request.processingRecipe.inputs[0];
  const selectedOutput = request.assetInputSelection.selectedOutput;
  invariant(
    result.projectId === command.projectId
      && result.taskId === trustedContext.taskId
      && result.branchId === trustedContext.branchId
      && result.branchRevision === command.baseRevision + 1
      && result.idempotencyKey === command.idempotencyKey
      && result.semanticFingerprint === processingResultAdoptionSemanticSha256(command, authorityBinding)
      && result.operation === request.target.operation
      && result.asset.assetId === request.target.assetId
      && result.asset.assetVersion === request.target.expectedAssetVersion + 1
      && expectedMetadataVersions.includes(result.asset.metadataVersion)
      && result.permanentReferences[0].digest === recipeInput.sha256
      && result.permanentReferences[1].digest === selectedOutput.sha256,
    'PROCESSING_RESULT_ADOPTION_COMMIT_RESULT_INVALID',
    'The processing-result adoption commit result does not close the requested command and trusted task context.',
  );
  return result;
}

function evaluateCommitResult(value, command, trustedContext, signal) {
  abort(signal);
  try {
    const result = assertCommitResultClosure(
      validateProcessingResultAdoptionCommitResult(value),
      command,
      trustedContext,
    );
    abort(signal);
    return result;
  } catch {
    abort(signal);
    throw new StudioError(
      'PROCESSING_RESULT_ADOPTION_COMMIT_PORT_RESPONSE_INVALID',
      'The processing-result adoption atomic store returned an invalid commit result.',
      { port: ATOMIC_STORE_PORT },
    );
  }
}

/**
 * Private A1.5 application seam for one durable atomic adoption attempt.
 * Authority, freshness, CAS, idempotency, budget, and mutation decisions remain
 * wholly inside the atomic-store unit of work. This service accepts no plan,
 * receipt, evidence, owner decision, or lifecycle/review/merge authority.
 */
class ProcessingResultAdoptionCommitServiceBase {
  #atomicStore;

  constructor(options, validator) {
    const config = exactPlainRecord(options, ['atomicStore'], 'processingResultAdoptionCommitServiceOptions');
    invariant(
      Object.keys(config).length === 1 && Object.hasOwn(config, 'atomicStore'),
      'PROCESSING_RESULT_ADOPTION_COMMIT_PORT_INVALID',
      'Processing-result adoption commit requires one atomic store.',
      { port: ATOMIC_STORE_PORT },
    );
    this.#atomicStore = validator(config.atomicStore);
  }

  async commit(commandValue, trustedExecutionContext, options = {}) {
    const signal = exactCommitOptions(options);
    const command = validateProcessingResultAdoptionCommand(commandValue);
    const trustedContext = validateProcessingResultAdoptionTrustedContext(trustedExecutionContext);
    abort(signal);
    const { value } = await invokeAtomicStore(
      () => this.#atomicStore.commitProcessingResultAdoption(
        command,
        trustedContext,
        Object.freeze({ signal }),
      ),
      signal,
    );
    return evaluateCommitResult(value, command, trustedContext, signal);
  }
}

export class ProcessingResultAdoptionCommitService extends ProcessingResultAdoptionCommitServiceBase {
  constructor(options = {}) {
    super(options, validateProcessingResultAdoptionAtomicStore);
  }
}

export class ProcessingResultAdoptionHostBoundCommitService extends ProcessingResultAdoptionCommitServiceBase {
  constructor(options = {}) {
    super(options, validateProcessingResultAdoptionHostBoundAtomicStore);
  }
}
