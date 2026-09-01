import { createHash } from 'node:crypto';
import {
  normalizeDerivedChildTaskRequest,
  normalizeDerivedChildPolicy,
  requireDerivedChildContext,
} from '../../domain/src/derived-child-task.js';
import { invariant } from '../../domain/src/errors.js';
import { requireId, requireIsoDate } from '../../domain/src/validation.js';
import { fingerprint } from './value-utils.js';

function sha256(value) { return createHash('sha256').update(value).digest('hex'); }

export class DerivedChildTaskService {
  #store;
  #clock;
  #policy;

  constructor({
    store,
    policy = { budget: { maxCommands: 1, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 }, ttlSeconds: 3600 },
    clock = () => new Date().toISOString(),
  }) {
    invariant(store?.isLive === true && typeof store.deriveCandidateChild === 'function',
      'DERIVED_CHILD_STORE_INVALID', 'A writable atomic derived-child store is required.');
    invariant(typeof clock === 'function', 'DERIVED_CHILD_APPLICATION_INVALID', 'A clock is required.');
    this.#store = store;
    this.#clock = clock;
    this.#policy = normalizeDerivedChildPolicy(policy);
  }

  deriveCandidateChild(projectId, rawRequest, rawTrustedContext) {
    const now = requireIsoDate(this.#clock(), 'clock');
    const normalizedProjectId = requireId(projectId, 'projectId');
    const request = normalizeDerivedChildTaskRequest(rawRequest, { now });
    const context = requireDerivedChildContext(rawTrustedContext);
    const idempotencyKeyHash = sha256(request.idempotencyKey);
    const taskBoundHash = sha256(`${context.taskId}\0${idempotencyKeyHash}`);
    const requestSemantics = {
      schemaVersion: request.schemaVersion,
      title: request.title,
      objective: request.objective,
      expectedParentHeadRevision: request.expectedParentHeadRevision,
    };
    const identity = Object.freeze({
      projectId: normalizedProjectId,
      parentTaskId: context.taskId,
      parentBranchId: context.branchId,
      parentGrantId: context.grantId,
      actorId: context.actor.id,
      childTaskId: `task.child.${taskBoundHash}`,
      childBranchId: `branch.child.${taskBoundHash}`,
      childGrantId: `grant.child.${taskBoundHash}`,
      idempotencyKeyHash,
      requestFingerprint: fingerprint({
        schemaVersion: 1,
        projectId: normalizedProjectId,
        parentTaskId: context.taskId,
        parentBranchId: context.branchId,
        parentGrantId: context.grantId,
        actorId: context.actor.id,
        request: requestSemantics,
        policy: this.#policy,
      }),
    });
    return this.#store.deriveCandidateChild({ identity, request, policy: this.#policy, now });
  }
}
