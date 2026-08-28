import { types as utilTypes } from 'node:util';
import {
  AUTHORING_V2_COMMAND_FEATURES,
  AUTHORING_V2_FEATURE_ID,
  AUTHORING_V2_PROCESSING_RESULT_ADOPTION_TOOL,
  AUTHORING_V2_SCHEMA_VERSION,
  PROCESSING_RESULT_ADOPTION_COMMAND_TYPE,
  projectCapabilityManifestSha256,
  validateProcessingResultAdoptionCommand,
} from '../../domain/src/index.js';
import { StudioError, invariant } from '../../domain/src/errors.js';
import { requireActor, requireId } from '../../domain/src/validation.js';
import {
  AuthoringV2AdmissionService,
} from './authoring-v2-admission.js';
import {
  ProcessingResultAdoptionHostBoundCommitService,
  validateProcessingResultAdoptionHostBoundAtomicStore,
} from './processing-result-adoption-commit.js';
import {
  ProcessingResultAdoptionPlanningService,
  validateProcessingResultAdoptionTrustedContext,
} from './processing-result-adoption.js';
import { deepFreeze } from './value-utils.js';

export const AUTHORING_V2_CAPABILITIES_KIND = 'studio.authoring-v2-capabilities';

function exactPlainRecord(value, allowed, label, code = 'AUTHORING_V2_REQUEST_INVALID', { required = allowed } = {}) {
  invariant(
    value !== null
      && typeof value === 'object'
      && !Array.isArray(value)
      && !utilTypes.isProxy(value),
    code,
    `${label} must be an inspectable plain object.`,
  );
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    invariant(false, code, `${label} must be inspectable.`);
  }
  invariant(
    (prototype === Object.prototype || prototype === null)
      && keys.every((key) => typeof key === 'string' && allowed.includes(key)),
    code,
    `${label} contains fields outside its contract.`,
  );
  const snapshot = Object.create(null);
  for (const field of allowed) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, field);
    } catch {
      invariant(false, code, `${label}.${field} must be inspectable.`);
    }
    if (!descriptor) continue;
    invariant(
      Object.hasOwn(descriptor, 'value') && descriptor.enumerable === true,
      code,
      `${label}.${field} must be an enumerable own data field.`,
    );
    snapshot[field] = descriptor.value;
  }
  invariant(required.every((field) => Object.hasOwn(snapshot, field)), code, `${label} is missing required fields.`);
  return snapshot;
}

function validateAbortSignal(value) {
  if (value === undefined) return undefined;
  invariant(
    value !== null && typeof value === 'object' && !utilTypes.isProxy(value),
    'AUTHORING_V2_REQUEST_INVALID',
    'Authoring-v2 signal must be an AbortSignal.',
  );
  let prototype;
  let stringKeys;
  try {
    prototype = Object.getPrototypeOf(value);
    stringKeys = Object.getOwnPropertyNames(value);
  } catch {
    invariant(false, 'AUTHORING_V2_REQUEST_INVALID', 'Authoring-v2 signal must be inspectable.');
  }
  invariant(
    prototype === AbortSignal.prototype && stringKeys.length === 0,
    'AUTHORING_V2_REQUEST_INVALID',
    'Authoring-v2 signal must be an unmodified AbortSignal.',
  );
  return value;
}

function exactOptions(value) {
  const options = exactPlainRecord(
    value,
    ['signal'],
    'authoringV2ExecutionOptions',
    'AUTHORING_V2_REQUEST_INVALID',
    { required: [] },
  );
  return validateAbortSignal(options.signal);
}

function exactTrustedBinding(value) {
  const binding = exactPlainRecord(value, [
    'schemaVersion', 'bindingId', 'projectId', 'grantId', 'actor', 'taskId',
    'branchId', 'issuedBy', 'issuedAt', 'expiresAt', 'revokedAt', 'revokeReason', 'status',
  ], 'trustedAuthoringV2HostBinding', 'AUTHORING_V2_SESSION_INVALID');
  const actorValue = exactPlainRecord(
    binding.actor,
    ['id', 'kind', 'displayName'],
    'trustedAuthoringV2HostBinding.actor',
    'AUTHORING_V2_SESSION_INVALID',
  );
  const actor = requireActor(actorValue);
  const branchId = requireId(binding.branchId, 'trustedAuthoringV2HostBinding.branchId');
  invariant(
    binding.schemaVersion === 1
      && binding.status === 'ACTIVE'
      && binding.revokedAt === null
      && binding.revokeReason === null
      && actor.kind === 'agent'
      && branchId !== 'branch.main',
    'AUTHORING_V2_SESSION_INVALID',
    'Authoring v2 requires one current active task-branch HostBinding.',
  );
  const projectId = requireId(binding.projectId, 'trustedAuthoringV2HostBinding.projectId');
  const taskId = requireId(binding.taskId, 'trustedAuthoringV2HostBinding.taskId');
  const grantId = requireId(binding.grantId, 'trustedAuthoringV2HostBinding.grantId');
  const trustedContext = validateProcessingResultAdoptionTrustedContext({
    actor,
    taskId,
    grantId,
    branchId,
    correlationId: null,
  });
  return deepFreeze({
    projectId,
    actor,
    taskId,
    grantId,
    branchId,
    trustedContext,
  });
}

function exactCapabilitiesRequest(value, projectId) {
  const request = exactPlainRecord(
    value,
    ['schemaVersion', 'featureId', 'projectId'],
    'authoringV2CapabilitiesRequest',
  );
  invariant(
    request.schemaVersion === AUTHORING_V2_SCHEMA_VERSION
      && request.featureId === AUTHORING_V2_FEATURE_ID
      && request.projectId === projectId,
    'AUTHORING_V2_REQUEST_INVALID',
    'The capabilities request is not pinned to this admitted Authoring-v2 project.',
  );
  return deepFreeze({
    schemaVersion: AUTHORING_V2_SCHEMA_VERSION,
    featureId: AUTHORING_V2_FEATURE_ID,
    projectId,
  });
}

function exactExecutionRequest(value, projectId) {
  const request = exactPlainRecord(
    value,
    ['schemaVersion', 'featureId', 'toolName', 'dryRun', 'command'],
    'authoringV2ProcessingResultAdoptionRequest',
  );
  invariant(
    request.schemaVersion === AUTHORING_V2_SCHEMA_VERSION
      && request.featureId === AUTHORING_V2_FEATURE_ID
      && request.toolName === AUTHORING_V2_PROCESSING_RESULT_ADOPTION_TOOL
      && typeof request.dryRun === 'boolean',
    'AUTHORING_V2_REQUEST_INVALID',
    'The adoption request is not pinned to the supported Authoring-v2 operation.',
  );
  const command = validateProcessingResultAdoptionCommand(request.command);
  invariant(
    command.type === PROCESSING_RESULT_ADOPTION_COMMAND_TYPE && command.projectId === projectId,
    'AUTHORING_V2_REQUEST_INVALID',
    'The Authoring-v2 command does not belong to this admitted project or feature.',
  );
  return Object.freeze({
    schemaVersion: AUTHORING_V2_SCHEMA_VERSION,
    featureId: AUTHORING_V2_FEATURE_ID,
    toolName: AUTHORING_V2_PROCESSING_RESULT_ADOPTION_TOOL,
    dryRun: request.dryRun,
    command,
  });
}

function admissionSelection(binding, { expectedRevision, targetAssetId }) {
  return deepFreeze({
    schemaVersion: AUTHORING_V2_SCHEMA_VERSION,
    featureId: AUTHORING_V2_FEATURE_ID,
    projectId: binding.projectId,
    actorId: binding.actor.id,
    taskId: binding.taskId,
    grantId: binding.grantId,
    branchId: binding.branchId,
    expectedRevision,
    targetAssetId,
  });
}

/**
 * One private A1.6b2a operation. The session consumes itself synchronously,
 * derives all authority from its trusted HostBinding, and accepts no caller
 * context, plan, receipt, profile, store, review, lifecycle, or merge input.
 */
export class AuthoringV2ExecutionSession {
  #admissionService;

  #planningService;

  #commitService;

  #binding;

  #used = false;

  constructor(options = {}) {
    const config = exactPlainRecord(
      options,
      ['admissionService', 'planningService', 'hostBoundAtomicStore', 'trustedBinding'],
      'authoringV2ExecutionSessionOptions',
      'AUTHORING_V2_SESSION_INVALID',
    );
    invariant(
      config.admissionService instanceof AuthoringV2AdmissionService
        && config.planningService instanceof ProcessingResultAdoptionPlanningService,
      'AUTHORING_V2_SESSION_INVALID',
      'Authoring v2 requires its exact private admission and planning services.',
    );
    this.#admissionService = config.admissionService;
    this.#planningService = config.planningService;
    this.#commitService = new ProcessingResultAdoptionHostBoundCommitService({
      atomicStore: validateProcessingResultAdoptionHostBoundAtomicStore(config.hostBoundAtomicStore),
    });
    this.#binding = exactTrustedBinding(config.trustedBinding);
  }

  #consume() {
    if (this.#used) {
      throw new StudioError('AUTHORING_V2_SESSION_CONSUMED', 'The private Authoring-v2 session has already been consumed.');
    }
    this.#used = true;
  }

  readCapabilities(requestValue, options = {}) {
    this.#consume();
    const signal = exactOptions(options);
    const request = exactCapabilitiesRequest(requestValue, this.#binding.projectId);
    return this.#readCapabilities(request, signal);
  }

  async #readCapabilities(request, signal) {
    const admitted = await this.#admissionService.admit(
      admissionSelection(this.#binding, { expectedRevision: null, targetAssetId: null }),
      Object.freeze({ signal }),
    );
    return deepFreeze({
      schemaVersion: AUTHORING_V2_SCHEMA_VERSION,
      kind: AUTHORING_V2_CAPABILITIES_KIND,
      featureId: AUTHORING_V2_FEATURE_ID,
      projectId: request.projectId,
      branchRevision: admitted.evidence.branchRevision,
      profile: {
        profileId: admitted.capabilityManifest.profileId,
        profileVersion: admitted.capabilityManifest.profileVersion,
        fingerprint: projectCapabilityManifestSha256(admitted.capabilityManifest),
        manifest: admitted.capabilityManifest,
      },
      commandFeatures: AUTHORING_V2_COMMAND_FEATURES,
    });
  }

  executeProcessingResultAdoption(requestValue, options = {}) {
    this.#consume();
    const signal = exactOptions(options);
    const request = exactExecutionRequest(requestValue, this.#binding.projectId);
    return request.dryRun
      ? this.#dryRun(request.command, signal)
      : this.#commit(request.command, signal);
  }

  async #dryRun(command, signal) {
    const selection = admissionSelection(this.#binding, {
      expectedRevision: command.baseRevision,
      targetAssetId: command.payload.preflightRequest.target.assetId,
    });
    await this.#admissionService.admit(selection, Object.freeze({ signal }));
    const result = await this.#planningService.prepare(
      command,
      this.#binding.trustedContext,
      Object.freeze({ signal }),
    );
    await this.#admissionService.admit(selection, Object.freeze({ signal }));
    return result;
  }

  #commit(command, signal) {
    // Deliberately no full Admission/Planning call here. The freshly bound A1.5
    // store checks current Binding/Grant before ledger-first replay, preserving
    // lost-response recovery after maxCommands has become exhausted.
    return this.#commitService.commit(
      command,
      this.#binding.trustedContext,
      Object.freeze({ signal }),
    );
  }
}
