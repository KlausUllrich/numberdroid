import { createHash } from 'node:crypto';
import {
  createTaskCandidateSubmission,
  invariant,
  projectCapabilityManifestSha256,
  validateProjectCapabilityManifest,
  validateTaskCandidateSubmission,
} from '../../domain/src/index.js';
import { requireId, requireInteger, requireRecord, requireString } from '../../domain/src/validation.js';
import {
  createEngineBridgeCandidateSelection,
  validateCandidateWithEngineBridge,
  validateEngineBridgePort,
  validateEngineBridgeValidationReceipt,
} from './engine-bridge.js';
import { validateLevelAuthoringKernel } from './level-authoring-validation.js';
import { fingerprint } from './value-utils.js';

export const LEVEL_CANDIDATE_APPLICATION_SCHEMA_VERSION = 1;
export const LEVEL_CANDIDATE_APPLICATION_KIND = 'studio.level-candidate-application';

function exactFields(value, fields, label) {
  for (const field of Object.keys(value)) {
    invariant(fields.includes(field), 'LEVEL_CANDIDATE_REQUEST_INVALID', `${label}.${field} is not permitted.`, { field: `${label}.${field}` });
  }
  for (const field of fields) {
    invariant(Object.hasOwn(value, field), 'LEVEL_CANDIDATE_REQUEST_INVALID', `${label}.${field} is required.`, { field: `${label}.${field}` });
  }
  return value;
}

function normalizeRequest(raw) {
  const request = exactFields(requireRecord(raw, 'request'), [
    'projectId', 'taskId', 'branchId', 'expectedBaseRevision',
    'expectedBranchHeadRevision', 'idempotencyKey',
  ], 'request');
  return {
    projectId: requireId(request.projectId, 'request.projectId'),
    taskId: requireId(request.taskId, 'request.taskId'),
    branchId: requireId(request.branchId, 'request.branchId'),
    expectedBaseRevision: requireInteger(request.expectedBaseRevision, 'request.expectedBaseRevision', { min: 1 }),
    expectedBranchHeadRevision: requireInteger(request.expectedBranchHeadRevision, 'request.expectedBranchHeadRevision', { min: 1 }),
    idempotencyKey: requireString(request.idempotencyKey, 'request.idempotencyKey', { max: 512 }),
  };
}

function normalizeContext(raw) {
  const context = exactFields(requireRecord(raw, 'trustedContext'), [
    'actor', 'taskId', 'grantId', 'branchId',
  ], 'trustedContext');
  const actor = requireRecord(context.actor, 'trustedContext.actor');
  invariant(Object.keys(actor).every((field) => ['id', 'kind', 'displayName'].includes(field))
    && Object.hasOwn(actor, 'id') && Object.hasOwn(actor, 'kind'),
  'LEVEL_CANDIDATE_REQUEST_INVALID', 'trustedContext.actor contains unsupported or missing identity fields.');
  invariant(actor.kind === 'agent', 'LEVEL_CANDIDATE_CONTEXT_INVALID', 'Level Candidate creation requires a trusted agent context.');
  if (Object.hasOwn(actor, 'displayName')) requireString(actor.displayName, 'trustedContext.actor.displayName', { max: 256 });
  return {
    actor: { id: requireId(actor.id, 'trustedContext.actor.id'), kind: 'agent' },
    taskId: requireId(context.taskId, 'trustedContext.taskId'),
    grantId: requireId(context.grantId, 'trustedContext.grantId'),
    branchId: requireId(context.branchId, 'trustedContext.branchId'),
  };
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function validateComposer(value) {
  invariant(value && typeof value === 'object'
    && value.schemaVersion === 1
    && typeof value.kind === 'string'
    && value.binding && typeof value.binding === 'object'
    && typeof value.source === 'function'
    && typeof value.project === 'function'
    && typeof value.compose === 'function',
  'LEVEL_CANDIDATE_COMPOSER_INVALID', 'A trusted Level Candidate composer port is required.');
  return Object.freeze({
    schemaVersion: value.schemaVersion,
    kind: value.kind,
    binding: structuredClone(value.binding),
    source: (...args) => value.source(...args),
    project: (...args) => value.project(...args),
    compose: (...args) => value.compose(...args),
  });
}

function validateStore(value) {
  invariant(value && typeof value === 'object'
    && value.isLive === true
    && typeof value.lookupReplay === 'function'
    && typeof value.authorizeCreate === 'function'
    && typeof value.submitCandidate === 'function',
  'LEVEL_CANDIDATE_STORE_INVALID', 'A writable atomic Level Candidate store is required.');
  return value;
}

function requestIdentity(request, context, composer, capabilityManifest, engineBridge) {
  return fingerprint({
    schemaVersion: LEVEL_CANDIDATE_APPLICATION_SCHEMA_VERSION,
    kind: LEVEL_CANDIDATE_APPLICATION_KIND,
    projectId: request.projectId,
    taskId: request.taskId,
    branchId: request.branchId,
    expectedBaseRevision: request.expectedBaseRevision,
    expectedBranchHeadRevision: request.expectedBranchHeadRevision,
    actorId: context.actor.id,
    grantId: context.grantId,
    composer: { kind: composer.kind, binding: composer.binding },
    capabilityManifestFingerprint: projectCapabilityManifestSha256(capabilityManifest),
    engineBridge: engineBridge.bridge,
  });
}

function validateComposedClosure(value, { request, authority, composer, capabilityManifest }) {
  invariant(value && typeof value === 'object', 'LEVEL_CANDIDATE_COMPOSER_INVALID', 'The candidate composer returned no closure.');
  invariant(value.projectionFingerprint === composer.binding.projectionFingerprint,
    'LEVEL_CANDIDATE_PROJECTION_MISMATCH', 'The composed projection does not match the configured immutable projection.');
  invariant(value.candidate?.candidateManifest?.project?.projectId === request.projectId
    && value.candidate.candidateManifest.project.revision === authority.branchHeadRevision
    && value.candidate.candidateManifest.capabilityProfile.profileId === capabilityManifest.profileId
    && value.candidate.candidateManifest.capabilityProfile.profileVersion === capabilityManifest.profileVersion
    && value.candidate.candidateManifest.capabilityProfile.fingerprint === projectCapabilityManifestSha256(capabilityManifest)
    && value.candidate.candidateManifest.artifacts.length === 0,
  'LEVEL_CANDIDATE_BINDING_MISMATCH', 'The composed candidate does not match the task head and capability profile.');
  invariant(value.diff.projectId === request.projectId
    && value.diff.taskId === request.taskId
    && value.diff.branchId === request.branchId
    && value.diff.baseRevision === authority.baseRevision
    && value.diff.branchHeadRevision === authority.branchHeadRevision
    && value.diff.changes.length === 1
    && value.diff.changes.every(({ operation }) => operation === 'ADD')
    && value.diff.outputs.every(({ operation, beforeSha256 }) => operation === 'ADD' && beforeSha256 === null),
  'LEVEL_CANDIDATE_DIFF_INVALID', 'The A4c create path requires one ADD-only semantic closure and ADD-only outputs.');
  invariant(Array.isArray(value.compilerPins)
    && value.compilerPins.some(({ id, version, evidenceHash }) => id === 'numberdroid.level-compiler'
      && version === composer.binding.compilerVersion
      && evidenceHash === composer.binding.planSha256),
  'LEVEL_CANDIDATE_COMPILER_MISMATCH', 'The composed candidate does not bind the configured compiler evidence.');
  return value;
}

export class LevelCandidateApplicationService {
  #composer;
  #capabilityManifest;
  #engineBridge;
  #store;
  #clock;

  constructor({ candidateComposer, capabilityManifest, engineBridge, store, clock = () => new Date().toISOString() }) {
    this.#composer = validateComposer(candidateComposer);
    this.#capabilityManifest = validateProjectCapabilityManifest(capabilityManifest);
    invariant(projectCapabilityManifestSha256(this.#capabilityManifest) === this.#composer.binding.profileFingerprint,
      'LEVEL_CANDIDATE_PROFILE_MISMATCH', 'The configured capability profile does not match the candidate composer.');
    this.#engineBridge = validateEngineBridgePort(engineBridge);
    this.#store = validateStore(store);
    invariant(typeof clock === 'function', 'LEVEL_CANDIDATE_APPLICATION_INVALID', 'A clock function is required.');
    this.#clock = clock;
  }

  async create(rawRequest, rawTrustedContext, { signal } = {}) {
    const request = normalizeRequest(rawRequest);
    const trustedContext = normalizeContext(rawTrustedContext);
    invariant(request.taskId === trustedContext.taskId && request.branchId === trustedContext.branchId,
      'LEVEL_CANDIDATE_CONTEXT_MISMATCH', 'Request and trusted task coordinates differ.');
    invariant(request.branchId !== 'branch.main', 'LEVEL_CANDIDATE_MAIN_FORBIDDEN', 'Level Candidates require an isolated non-main task branch.');
    invariant(request.expectedBranchHeadRevision === request.expectedBaseRevision,
      'LEVEL_CANDIDATE_BRANCH_NOT_EMPTY', 'Level Candidate creation requires an otherwise empty isolated task branch.');
    const idempotencyKeyHash = sha256(request.idempotencyKey);
    const taskBoundKeyHash = sha256(`${request.taskId}\0${idempotencyKeyHash}`);
    const submissionId = `candidate:${taskBoundKeyHash}`;
    const reviewId = `review:${taskBoundKeyHash}`;
    const requestFingerprint = requestIdentity(
      request,
      trustedContext,
      this.#composer,
      this.#capabilityManifest,
      this.#engineBridge,
    );
    const identity = {
      projectId: request.projectId,
      taskId: request.taskId,
      branchId: request.branchId,
      actorId: trustedContext.actor.id,
      grantId: trustedContext.grantId,
      submissionId,
      idempotencyKeyHash,
      requestFingerprint,
    };
    const replay = await this.#store.lookupReplay(identity);
    if (replay) return { ...replay, replayed: true };

    let admission;
    try {
      admission = await this.#store.authorizeCreate({
        identity,
        expectedBaseRevision: request.expectedBaseRevision,
        expectedBranchHeadRevision: request.expectedBranchHeadRevision,
        now: this.#clock(),
      });
    } catch (error) {
      const racedReplay = await this.#store.lookupReplay(identity);
      if (racedReplay) return { ...racedReplay, replayed: true };
      throw error;
    }
    invariant(admission?.baseRevision === request.expectedBaseRevision
      && admission?.branchHeadRevision === request.expectedBranchHeadRevision,
    'LEVEL_CANDIDATE_HEAD_MISMATCH', 'The authority preflight returned different branch coordinates.');

    signal?.throwIfAborted();
    const source = await this.#composer.source();
    const authority = {
      baseRevision: request.expectedBaseRevision,
      branchHeadRevision: request.expectedBranchHeadRevision + 1,
    };

    signal?.throwIfAborted();
    const projection = await this.#composer.project();
    const validation = validateLevelAuthoringKernel({
      requirementSet: projection.a3a.requirementSet,
      levelGraph: projection.a3a.levelGraph,
      logicGraph: projection.a3a.logicGraph,
      capabilityManifest: this.#capabilityManifest,
    });
    invariant(validation.status === 'VALID', 'LEVEL_CANDIDATE_VALIDATION_BLOCKED', 'The projected A3a closure is blocked.');
    const composed = validateComposedClosure(await this.#composer.compose({
      projection,
      validation,
      projectId: request.projectId,
      taskId: request.taskId,
      branchId: request.branchId,
      baseRevision: authority.baseRevision,
      branchHeadRevision: authority.branchHeadRevision,
    }), { request, authority, composer: this.#composer, capabilityManifest: this.#capabilityManifest });

    signal?.throwIfAborted();
    const selection = createEngineBridgeCandidateSelection(composed.candidate.candidateManifest);
    const receipt = await validateCandidateWithEngineBridge(this.#engineBridge, selection, { signal });
    const verifiedReceipt = validateEngineBridgeValidationReceipt(receipt, {
      bridge: this.#engineBridge,
      selection,
    });
    const submission = createTaskCandidateSubmission({
      submissionId,
      idempotencyKeyHash,
      projectId: request.projectId,
      taskId: request.taskId,
      branchId: request.branchId,
      baseRevision: authority.baseRevision,
      branchHeadRevision: authority.branchHeadRevision,
      projectionFingerprint: composed.projectionFingerprint,
      candidate: composed.candidate,
      preview: composed.preview,
      diff: composed.diff,
      compilerPins: composed.compilerPins,
      engineBridgeReceipt: verifiedReceipt,
    });
    validateTaskCandidateSubmission(submission);
    signal?.throwIfAborted();
    return this.#store.submitCandidate({
      identity,
      expectedBaseRevision: request.expectedBaseRevision,
      expectedBranchHeadRevision: request.expectedBranchHeadRevision,
      reviewId,
      source,
      submission,
      configuredBinding: {
        composer: this.#composer.binding,
        capabilityManifestFingerprint: projectCapabilityManifestSha256(this.#capabilityManifest),
        engineBridge: this.#engineBridge.bridge,
      },
      trustedContext,
      now: this.#clock(),
    });
  }
}
