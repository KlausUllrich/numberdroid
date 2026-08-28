import { types as utilTypes } from 'node:util';
import {
  AUTHORING_V2_COMMAND_FEATURES,
  AUTHORING_V2_FEATURE_ID,
  AUTHORING_V2_PROCESSING_RESULT_ADOPTION_TOOL,
  AUTHORING_V2_SCHEMA_VERSION,
  PROCESSING_RESULT_ADOPTION_COMMAND_TYPE,
  projectCapabilityManifestSha256,
  validateAuthoringV2CapabilityManifest,
  validateProcessingResultAdoptionCommand,
} from '../../domain/src/index.js';
import { StudioError, invariant } from '../../domain/src/errors.js';
import { requireActor, requireId, requireInteger } from '../../domain/src/validation.js';
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
import { deepFreeze, fingerprint } from './value-utils.js';

export const AUTHORING_V2_CAPABILITIES_KIND = 'studio.authoring-v2-capabilities';
export const AUTHORING_V2_SURFACE_NEGOTIATION_REQUEST_KIND = 'studio.authoring-v2-surface-negotiation-request';
export const AUTHORING_V2_SURFACE_NEGOTIATION_KIND = 'studio.authoring-v2-surface-negotiation';

const SHA256 = /^[a-f0-9]{64}$/;

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

function snapshotPlainData(value, label, state = { ancestors: new WeakSet(), nodes: 0 }, depth = 0) {
  state.nodes += 1;
  invariant(
    state.nodes <= 4096 && depth <= 32,
    'AUTHORING_V2_RESPONSE_INVALID',
    `${label} exceeds the bounded plain-data graph accepted by Authoring v2.`,
  );
  if (value === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof value)) return value;
  invariant(
    typeof value === 'object' && !utilTypes.isProxy(value),
    'AUTHORING_V2_RESPONSE_INVALID',
    `${label} must be plain inspectable data.`,
  );
  invariant(
    !state.ancestors.has(value),
    'AUTHORING_V2_RESPONSE_INVALID',
    `${label} must not contain cycles.`,
  );
  state.ancestors.add(value);
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    invariant(false, 'AUTHORING_V2_RESPONSE_INVALID', `${label} must be inspectable.`);
  }
  if (Array.isArray(value)) {
    invariant(prototype === Array.prototype, 'AUTHORING_V2_RESPONSE_INVALID', `${label} must be a plain array.`);
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    const length = lengthDescriptor?.value;
    invariant(
      Number.isSafeInteger(length) && length >= 0 && length <= 512,
      'AUTHORING_V2_RESPONSE_INVALID',
      `${label} must be bounded.`,
    );
    const allowed = new Set(['length', ...Array.from({ length }, (_, index) => String(index))]);
    invariant(
      keys.every((key) => typeof key === 'string' && allowed.has(key)),
      'AUTHORING_V2_RESPONSE_INVALID',
      `${label} contains forbidden array fields.`,
    );
    const result = new Array(length);
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      invariant(
        descriptor && Object.hasOwn(descriptor, 'value') && descriptor.enumerable === true,
        'AUTHORING_V2_RESPONSE_INVALID',
        `${label} must not contain sparse or accessor entries.`,
      );
      result[index] = snapshotPlainData(descriptor.value, `${label}[${index}]`, state, depth + 1);
    }
    state.ancestors.delete(value);
    return result;
  }
  invariant(
    prototype === Object.prototype || prototype === null,
    'AUTHORING_V2_RESPONSE_INVALID',
    `${label} must be a plain object.`,
  );
  const result = Object.create(null);
  for (const key of keys) {
    invariant(typeof key === 'string', 'AUTHORING_V2_RESPONSE_INVALID', `${label} must not contain symbols.`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    invariant(
      descriptor && Object.hasOwn(descriptor, 'value') && descriptor.enumerable === true,
      'AUTHORING_V2_RESPONSE_INVALID',
      `${label}.${key} must be an enumerable own data field.`,
    );
    result[key] = snapshotPlainData(descriptor.value, `${label}.${key}`, state, depth + 1);
  }
  state.ancestors.delete(value);
  return result;
}

function exactProfileSummary(value, label, { includeManifest }) {
  const fields = includeManifest
    ? ['profileId', 'profileVersion', 'fingerprint', 'manifest']
    : ['profileId', 'profileVersion', 'fingerprint'];
  const profile = exactPlainRecord(value, fields, label, 'AUTHORING_V2_RESPONSE_INVALID');
  const profileId = requireId(profile.profileId, `${label}.profileId`);
  const profileVersion = requireInteger(profile.profileVersion, `${label}.profileVersion`, { min: 1 });
  invariant(
    profileVersion === 2 && typeof profile.fingerprint === 'string' && SHA256.test(profile.fingerprint),
    'AUTHORING_V2_RESPONSE_INVALID',
    `${label} is not the supported Authoring-v2 profile.`,
  );
  if (!includeManifest) {
    return deepFreeze({ profileId, profileVersion, fingerprint: profile.fingerprint });
  }
  let manifest;
  try {
    manifest = validateAuthoringV2CapabilityManifest(
      snapshotPlainData(profile.manifest, `${label}.manifest`),
    );
  } catch {
    throw new StudioError('AUTHORING_V2_RESPONSE_INVALID', `${label}.manifest is invalid.`);
  }
  invariant(
    manifest.profileId === profileId
      && manifest.profileVersion === profileVersion
      && projectCapabilityManifestSha256(manifest) === profile.fingerprint,
    'AUTHORING_V2_RESPONSE_INVALID',
    `${label} does not close its capability manifest.`,
  );
  return deepFreeze({ profileId, profileVersion, fingerprint: profile.fingerprint, manifest });
}

function exactCommandFeatures(value, label) {
  const snapshot = snapshotPlainData(value, label);
  invariant(
    fingerprint(snapshot) === fingerprint(AUTHORING_V2_COMMAND_FEATURES),
    'AUTHORING_V2_RESPONSE_INVALID',
    `${label} is not the exact supported Authoring-v2 command registry.`,
  );
  return AUTHORING_V2_COMMAND_FEATURES;
}

function exactResponseExpectations(value) {
  const expectations = exactPlainRecord(
    value,
    ['projectId', 'expectedProfileFingerprint'],
    'authoringV2ResponseExpectations',
    'AUTHORING_V2_RESPONSE_INVALID',
    { required: [] },
  );
  const projectId = expectations.projectId === undefined
    ? null
    : requireId(expectations.projectId, 'authoringV2ResponseExpectations.projectId');
  invariant(
    expectations.expectedProfileFingerprint === undefined
      || (typeof expectations.expectedProfileFingerprint === 'string'
        && SHA256.test(expectations.expectedProfileFingerprint)),
    'AUTHORING_V2_RESPONSE_INVALID',
    'The expected Authoring-v2 profile fingerprint is invalid.',
  );
  return Object.freeze({
    projectId,
    expectedProfileFingerprint: expectations.expectedProfileFingerprint ?? null,
  });
}

function validateAuthoringV2SurfaceNegotiationRequestValue(value) {
  const request = exactPlainRecord(
    value,
    ['schemaVersion', 'kind', 'featureId', 'projectId', 'expectedProfileFingerprint'],
    'authoringV2SurfaceNegotiationRequest',
  );
  invariant(
    request.schemaVersion === AUTHORING_V2_SCHEMA_VERSION
      && request.kind === AUTHORING_V2_SURFACE_NEGOTIATION_REQUEST_KIND
      && request.featureId === AUTHORING_V2_FEATURE_ID
      && typeof request.expectedProfileFingerprint === 'string'
      && SHA256.test(request.expectedProfileFingerprint),
    'AUTHORING_V2_REQUEST_INVALID',
    'The surface-negotiation request is not pinned to the supported Authoring-v2 profile.',
  );
  return deepFreeze({
    schemaVersion: AUTHORING_V2_SCHEMA_VERSION,
    kind: AUTHORING_V2_SURFACE_NEGOTIATION_REQUEST_KIND,
    featureId: AUTHORING_V2_FEATURE_ID,
    projectId: requireId(request.projectId, 'authoringV2SurfaceNegotiationRequest.projectId'),
    expectedProfileFingerprint: request.expectedProfileFingerprint,
  });
}

function validateAuthoringV2SurfaceNegotiationValue(value, expectationsValue) {
  const expectations = exactResponseExpectations(expectationsValue);
  const response = exactPlainRecord(
    snapshotPlainData(value, 'authoringV2SurfaceNegotiation'),
    [
      'schemaVersion', 'kind', 'status', 'featureId', 'projectId', 'branchRevision',
      'budgetState', 'profile', 'commandFeatures',
    ],
    'authoringV2SurfaceNegotiation',
    'AUTHORING_V2_RESPONSE_INVALID',
  );
  const projectId = requireId(response.projectId, 'authoringV2SurfaceNegotiation.projectId');
  const profile = exactProfileSummary(response.profile, 'authoringV2SurfaceNegotiation.profile', { includeManifest: false });
  invariant(
    response.schemaVersion === AUTHORING_V2_SCHEMA_VERSION
      && response.kind === AUTHORING_V2_SURFACE_NEGOTIATION_KIND
      && response.status === 'READY'
      && response.featureId === AUTHORING_V2_FEATURE_ID
      && (response.budgetState === 'AVAILABLE' || response.budgetState === 'REPLAY_ONLY')
      && (expectations.projectId === null || expectations.projectId === projectId)
      && (expectations.expectedProfileFingerprint === null
        || expectations.expectedProfileFingerprint === profile.fingerprint),
    'AUTHORING_V2_RESPONSE_INVALID',
    'The surface-negotiation response does not match the requested Authoring-v2 surface.',
  );
  return deepFreeze({
    schemaVersion: AUTHORING_V2_SCHEMA_VERSION,
    kind: AUTHORING_V2_SURFACE_NEGOTIATION_KIND,
    status: 'READY',
    featureId: AUTHORING_V2_FEATURE_ID,
    projectId,
    branchRevision: requireInteger(
      response.branchRevision,
      'authoringV2SurfaceNegotiation.branchRevision',
      { min: 1 },
    ),
    budgetState: response.budgetState,
    profile,
    commandFeatures: exactCommandFeatures(
      response.commandFeatures,
      'authoringV2SurfaceNegotiation.commandFeatures',
    ),
  });
}

function validateAuthoringV2CapabilitiesValue(value, expectationsValue) {
  const expectations = exactResponseExpectations(expectationsValue);
  const response = exactPlainRecord(
    snapshotPlainData(value, 'authoringV2Capabilities'),
    ['schemaVersion', 'kind', 'featureId', 'projectId', 'branchRevision', 'profile', 'commandFeatures'],
    'authoringV2Capabilities',
    'AUTHORING_V2_RESPONSE_INVALID',
  );
  const projectId = requireId(response.projectId, 'authoringV2Capabilities.projectId');
  const profile = exactProfileSummary(response.profile, 'authoringV2Capabilities.profile', { includeManifest: true });
  invariant(
    response.schemaVersion === AUTHORING_V2_SCHEMA_VERSION
      && response.kind === AUTHORING_V2_CAPABILITIES_KIND
      && response.featureId === AUTHORING_V2_FEATURE_ID
      && (expectations.projectId === null || expectations.projectId === projectId)
      && (expectations.expectedProfileFingerprint === null
        || expectations.expectedProfileFingerprint === profile.fingerprint),
    'AUTHORING_V2_RESPONSE_INVALID',
    'The capabilities response does not match the requested Authoring-v2 surface.',
  );
  return deepFreeze({
    schemaVersion: AUTHORING_V2_SCHEMA_VERSION,
    kind: AUTHORING_V2_CAPABILITIES_KIND,
    featureId: AUTHORING_V2_FEATURE_ID,
    projectId,
    branchRevision: requireInteger(response.branchRevision, 'authoringV2Capabilities.branchRevision', { min: 1 }),
    profile,
    commandFeatures: exactCommandFeatures(response.commandFeatures, 'authoringV2Capabilities.commandFeatures'),
  });
}

function normalizedValidation(operation, code, message) {
  try {
    return operation();
  } catch {
    throw new StudioError(code, message);
  }
}

export function validateAuthoringV2SurfaceNegotiationRequest(value) {
  return normalizedValidation(
    () => validateAuthoringV2SurfaceNegotiationRequestValue(value),
    'AUTHORING_V2_REQUEST_INVALID',
    'The Authoring-v2 surface-negotiation request is invalid.',
  );
}

export function validateAuthoringV2SurfaceNegotiation(value, expectationsValue = {}) {
  return normalizedValidation(
    () => validateAuthoringV2SurfaceNegotiationValue(value, expectationsValue),
    'AUTHORING_V2_RESPONSE_INVALID',
    'The Authoring-v2 surface-negotiation response is invalid.',
  );
}

export function validateAuthoringV2Capabilities(value, expectationsValue = {}) {
  return normalizedValidation(
    () => validateAuthoringV2CapabilitiesValue(value, expectationsValue),
    'AUTHORING_V2_RESPONSE_INVALID',
    'The Authoring-v2 capabilities response is invalid.',
  );
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

function exactTrustedBinding(value, correlationIdValue) {
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
    correlationId: correlationIdValue === null || correlationIdValue === undefined
      ? null
      : requireId(correlationIdValue, 'authoringV2ExecutionSessionOptions.correlationId'),
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

function exactSurfaceNegotiationRequest(value, projectId) {
  const request = validateAuthoringV2SurfaceNegotiationRequest(value);
  invariant(
    request.projectId === projectId,
    'AUTHORING_V2_REQUEST_INVALID',
    'The surface-negotiation request does not belong to this admitted project.',
  );
  return request;
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
 * One private host-bound operation. The session consumes itself synchronously,
 * derives all authority from its trusted HostBinding, and accepts no caller
 * context, plan, receipt, profile, store, review, lifecycle, or merge input.
 * Its optional correlation ID is trusted server context, never request input.
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
      ['admissionService', 'planningService', 'hostBoundAtomicStore', 'trustedBinding', 'correlationId'],
      'authoringV2ExecutionSessionOptions',
      'AUTHORING_V2_SESSION_INVALID',
      { required: ['admissionService', 'planningService', 'hostBoundAtomicStore', 'trustedBinding'] },
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
    this.#binding = exactTrustedBinding(config.trustedBinding, config.correlationId);
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

  negotiateSurface(requestValue, options = {}) {
    this.#consume();
    const signal = exactOptions(options);
    const request = exactSurfaceNegotiationRequest(requestValue, this.#binding.projectId);
    return this.#negotiateSurface(request, signal);
  }

  async #negotiateSurface(request, signal) {
    const admitted = await this.#admissionService.negotiateSurface(
      admissionSelection(this.#binding, { expectedRevision: null, targetAssetId: null }),
      Object.freeze({ signal }),
    );
    invariant(
      request.expectedProfileFingerprint === admitted.capabilityFingerprint,
      'AUTHORING_V2_CAPABILITY_MISMATCH',
      'The requested Authoring-v2 profile is not available.',
    );
    return validateAuthoringV2SurfaceNegotiation({
      schemaVersion: AUTHORING_V2_SCHEMA_VERSION,
      kind: AUTHORING_V2_SURFACE_NEGOTIATION_KIND,
      status: 'READY',
      featureId: AUTHORING_V2_FEATURE_ID,
      projectId: request.projectId,
      branchRevision: admitted.evidence.branchRevision,
      budgetState: admitted.budgetState,
      profile: {
        profileId: admitted.capabilityManifest.profileId,
        profileVersion: admitted.capabilityManifest.profileVersion,
        fingerprint: admitted.capabilityFingerprint,
      },
      commandFeatures: AUTHORING_V2_COMMAND_FEATURES,
    }, {
      projectId: request.projectId,
      expectedProfileFingerprint: request.expectedProfileFingerprint,
    });
  }

  async #readCapabilities(request, signal) {
    const admitted = await this.#admissionService.admit(
      admissionSelection(this.#binding, { expectedRevision: null, targetAssetId: null }),
      Object.freeze({ signal }),
    );
    return validateAuthoringV2Capabilities({
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
    }, {
      projectId: request.projectId,
      expectedProfileFingerprint: admitted.capabilityFingerprint,
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
