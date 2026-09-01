import {
  assertReviewMergeable,
  assertTaskCanExecute,
  findSemanticConflicts,
  validateAgentTaskSpec,
} from '../../domain/src/agent-task.js';
import { getCommandDefinition, KNOWN_GRANT_SCOPES } from '../../domain/src/command-catalog.js';
import { StudioError, invariant } from '../../domain/src/errors.js';
import { requireId, requireIsoDate, requireRecord } from '../../domain/src/validation.js';
import { StudioService } from './studio-service.js';
import { validateProjectCapabilityProvider } from './project-capability-provider.js';
import { validateTrustedGrantScopes } from './grant-scope-catalog.js';
import { fingerprint } from './value-utils.js';

const BRANCH_EXTERNAL_SIDE_EFFECT_COMMANDS = new Set([
  'source.intake.commit',
  'atlas.preview.slices',
  'atlas.commit.slices',
]);

function ownerContext(projectView, correlationId) {
  return {
    actor: { id: projectView.snapshot.project.ownerId, kind: 'human', displayName: 'Local designer' },
    taskId: null,
    grantId: null,
    branchId: 'branch.main',
    correlationId,
  };
}

function ownerCommand(projectView, { commandId, type, payload }) {
  return {
    schemaVersion: 1,
    commandId,
    idempotencyKey: commandId,
    type,
    projectId: projectView.projectId,
    baseRevision: projectView.revision,
    expectedVersion: projectView.revision,
    dryRun: false,
    payload,
  };
}

function taskProjection(task, timeline, review, now) {
  return {
    schemaVersion: 1,
    task: {
      ...structuredClone(task),
      effectiveState: taskEffectiveState(task, requireIsoDate(now, 'clock')),
    },
    timeline: structuredClone(timeline),
    review: review ? structuredClone(review) : null,
  };
}

function taskEffectiveState(task, now) {
  if (['ACTIVE', 'PAUSED', 'CHANGES_REQUESTED'].includes(task.state)
      && task.expiresAt
      && Date.parse(task.expiresAt) <= Date.parse(now)) return 'EXPIRED';
  return task.state;
}

class MergeSimulationStore {
  isTaskBranchStore = true;
  supportsAtomicAssetLibrary = true;
  supportsDurableAssetStore = true;
  supportsAtomicRoomDesigner = true;
  #document;

  constructor(document) { this.#document = structuredClone(document); }
  async loadProject(projectId) { return this.#document.projectId === projectId ? structuredClone(this.#document) : null; }
  async appendRevision(projectId, expectedRevision, revision) {
    invariant(projectId === this.#document.projectId, 'CONTEXT_PROJECT_MISMATCH', 'Merge simulation project mismatch.');
    invariant(this.#document.revisions.at(-1).number === expectedRevision, 'REVISION_CONFLICT', 'Merge simulation head changed.');
    this.#document.revisions.push(structuredClone(revision));
    return structuredClone(this.#document);
  }
  async createProject() { throw new StudioError('FORBIDDEN', 'Merge simulation cannot create a project.'); }
  async listProjects() { return []; }
  document() { return structuredClone(this.#document); }
}

function compensatingRevision({ projectId, number, merge, currentSnapshot, targetSnapshot, actor, now, changes }) {
  const commandId = `task.merge.revert.${merge.mergeId}`;
  const payload = { mergeId: merge.mergeId };
  const commandFingerprint = fingerprint({
    schemaVersion: 1,
    type: 'task.merge.revert',
    projectId,
    baseRevision: number - 1,
    expectedVersion: number - 1,
    actor,
    taskId: null,
    grantId: null,
    branchId: 'branch.main',
    payload,
  });
  const snapshot = structuredClone(targetSnapshot);
  snapshot.grants = structuredClone(currentSnapshot.grants);
  snapshot.project.updatedAt = now;
  const event = {
    id: `activity:${commandId}`,
    projectId,
    revision: number,
    occurredAt: now,
    actor: structuredClone(actor),
    taskId: null,
    branchId: 'branch.main',
    commandId,
    commandType: 'task.merge.revert',
    status: 'committed',
    summary: `Merge ${merge.mergeId} reverted by a new compensating semantic revision.`,
    changes: changes.map((change) => ({ ...structuredClone(change), operation: 'reverted' })),
  };
  return {
    id: `revision:${number}`,
    number,
    parentRevision: number - 1,
    committedAt: now,
    command: {
      schemaVersion: 1,
      commandId,
      idempotencyKey: commandId,
      type: 'task.merge.revert',
      actor: structuredClone(actor),
      taskId: null,
      grantId: null,
      branchId: 'branch.main',
      payload,
      fingerprint: commandFingerprint,
    },
    snapshot,
    result: { mergeId: merge.mergeId, compensatedRevisionRange: { firstRevision: merge.firstRevision, lastRevision: merge.lastRevision } },
    event,
  };
}

export class AgentTaskService {
  #studioService;
  #projectStore;
  #taskStore;
  #createBranchStore;
  #clock;
  #capabilityProvider;
  #grantScopes;
  #derivedChildService;

  constructor({
    studioService,
    projectStore,
    taskStore,
    createBranchStore,
    clock = () => new Date().toISOString(),
    capabilityProvider = null,
    grantScopes = KNOWN_GRANT_SCOPES,
    derivedChildService = null,
  }) {
    invariant(studioService, 'VALIDATION_ERROR', 'StudioService is required.');
    invariant(projectStore, 'VALIDATION_ERROR', 'The authoritative ProjectStore is required.');
    invariant(taskStore?.isLive === true, 'AGENT_TASK_STORE_DISABLED', 'Checkpoint 4 tasks require the writable SQLite task store.');
    invariant(typeof createBranchStore === 'function', 'VALIDATION_ERROR', 'createBranchStore is required.');
    this.#studioService = studioService;
    this.#projectStore = projectStore;
    this.#taskStore = taskStore;
    this.#createBranchStore = createBranchStore;
    this.#clock = clock;
    this.#capabilityProvider = validateProjectCapabilityProvider(capabilityProvider);
    this.#grantScopes = validateTrustedGrantScopes(grantScopes);
    invariant(derivedChildService === null || typeof derivedChildService?.deriveCandidateChild === 'function',
      'DERIVED_CHILD_APPLICATION_INVALID', 'The derived-child service is invalid.');
    this.#derivedChildService = derivedChildService;
  }

  #authorityTask(task, now) {
    return {
      ...structuredClone(task),
      authority: this.#taskStore.taskAuthorityProjection(task.projectId, task.taskId, now),
    };
  }

  #projection(task, timeline, review, now) {
    return taskProjection(this.#authorityTask(task, now), timeline, review, now);
  }

  #assertExecutionAuthority(task, context, now) {
    assertTaskCanExecute(task, context, now);
    this.#taskStore.assertExecutionAuthority(task.projectId, task.taskId, now);
  }

  async createTask(raw, trustedOwnerContext) {
    const request = requireRecord(raw, 'request');
    const projectId = requireId(request.projectId, 'projectId');
    const now = requireIsoDate(this.#clock(), 'clock');
    const projectView = await this.#studioService.readProjectTrusted(projectId);
    invariant(trustedOwnerContext?.actor?.kind === 'human'
      && trustedOwnerContext.actor.id === projectView.snapshot.project.ownerId,
    'FORBIDDEN', 'Only the project owner can create an agent task.');
    const task = validateAgentTaskSpec(request.task, {
      now,
      projectId,
      baseRevision: projectView.revision + 1,
    });
    const unknownScope = task.capabilities.find((scope) => !this.#grantScopes.includes(scope));
    invariant(!unknownScope, 'UNKNOWN_GRANT_SCOPE', 'The task contains an unknown capability scope.', { scope: unknownScope });
    const existing = this.#taskStore.getTask(projectId, task.taskId);
    if (existing) return this.#projection(existing, this.#taskStore.listTimeline(projectId, task.taskId), this.#taskStore.getReview(projectId, task.taskId), now);

    const grantId = `grant.task.${task.taskId}`;
    let grantIssued = false;
    try {
      await this.#studioService.execute(ownerCommand(projectView, {
        commandId: `task.${task.taskId}.grant.issue`,
        type: 'grant.issue',
        payload: {
          grantId,
          agentId: task.agentId,
          taskId: task.taskId,
          branchId: task.branchId,
          scopes: task.capabilities,
          objectScopes: task.objectScopes,
          budget: task.budget,
          expiresAt: task.expiresAt,
        },
      }), ownerContext(projectView, `task.${task.taskId}.create`));
      grantIssued = true;
      const baseDocument = await this.#projectStore.loadProject(projectId);
      invariant(baseDocument?.revisions.at(-1)?.number === task.baseRevision, 'REVISION_CONFLICT', 'The task grant did not produce the expected immutable base revision.');
      const created = this.#taskStore.createTask({
        task,
        baseDocument,
        grantId,
        issuedBy: trustedOwnerContext.actor.id,
        now,
      });
      return this.#projection(created, this.#taskStore.listTimeline(projectId, task.taskId), null, now);
    } catch (error) {
      if (grantIssued && !this.#taskStore.getTask(projectId, task.taskId)) {
        try {
          const latest = await this.#studioService.readProjectTrusted(projectId);
          await this.#studioService.execute(ownerCommand(latest, {
            commandId: `task.${task.taskId}.grant.compensating-revoke`,
            type: 'grant.revoke',
            payload: { grantId, reason: 'Task creation failed after grant issuance.' },
          }), ownerContext(latest, `task.${task.taskId}.create-failed`));
        } catch {
          // A durable active grant without a matching task still fails closed in AgentTaskService.
        }
      }
      throw error;
    }
  }

  readTask(projectId, taskId) {
    const task = this.#taskStore.getTask(projectId, taskId);
    invariant(task, 'TASK_NOT_FOUND', 'The agent task does not exist.', { projectId, taskId });
    const now = this.#clock();
    return this.#projection(task, this.#taskStore.listTimeline(projectId, taskId), this.#taskStore.getReview(projectId, taskId), now);
  }

  hasTask(projectId, taskId, branchId = null) {
    const task = this.#taskStore.getTask(projectId, taskId);
    return Boolean(task && (!branchId || task.branchId === branchId));
  }

  readTaskForAgent(projectId, trustedContext) {
    const task = this.#taskStore.getTask(projectId, trustedContext.taskId);
    invariant(task, 'TASK_NOT_FOUND', 'The bound agent task does not exist.', { projectId });
    invariant(trustedContext.actor?.kind === 'agent'
      && trustedContext.actor.id === task.agentId
      && trustedContext.taskId === task.taskId
      && trustedContext.branchId === task.branchId
      && trustedContext.grantId === task.grantId,
    'TASK_CONTEXT_MISMATCH', 'The host binding does not match this task.');
    this.#taskStore.assertExecutionAuthority(projectId, task.taskId, this.#clock());
    const { grantId: _grantId, ...redactedTask } = task;
    return this.#projection(
      redactedTask,
      this.#taskStore.listTimeline(projectId, task.taskId),
      this.#taskStore.getReview(projectId, task.taskId),
      this.#clock(),
    );
  }

  async submitOwnReview(projectId, reviewId, trustedContext) {
    const task = this.#taskStore.getTask(projectId, trustedContext.taskId);
    this.#assertExecutionAuthority(task, trustedContext, this.#clock());
    invariant(trustedContext.grantId === task.grantId, 'TASK_GRANT_MISMATCH', 'The bound grant does not match the task.');
    const mainDocument = await this.#projectStore.loadProject(projectId);
    return {
      schemaVersion: 1,
      review: this.#taskStore.createReview(projectId, task.taskId, mainDocument, {
        reviewId: requireId(reviewId, 'reviewId'),
        actorId: trustedContext.actor.id,
        now: this.#clock(),
      }),
    };
  }

  listTasks(projectId) {
    const now = requireIsoDate(this.#clock(), 'clock');
    return {
      schemaVersion: 1,
      projectId,
      tasks: this.#taskStore.listTasks(projectId).map((task) => ({
        ...this.#authorityTask(task, now),
        effectiveState: taskEffectiveState(task, now),
      })),
    };
  }

  async readBranch(projectId, taskId, trustedContext) {
    const task = this.#taskStore.getTask(projectId, taskId);
    invariant(task, 'TASK_NOT_FOUND', 'The agent task does not exist.', { projectId, taskId });
    if (trustedContext.actor.kind === 'agent') {
      invariant(trustedContext.actor.id === task.agentId
        && trustedContext.taskId === task.taskId
        && trustedContext.branchId === task.branchId
        && trustedContext.grantId === task.grantId,
      'TASK_CONTEXT_MISMATCH', 'The agent cannot read another task branch.');
      this.#taskStore.assertExecutionAuthority(projectId, taskId, this.#clock());
    }
    const document = this.#taskStore.loadBranchDocument(projectId, taskId);
    const head = document.revisions.at(-1);
    return {
      schemaVersion: 1,
      projectId,
      taskId,
      branchId: task.branchId,
      baseRevision: task.baseRevision,
      branchRevision: head.number,
      snapshot: structuredClone(head.snapshot),
    };
  }

  readProject({ projectId }, trustedContext) {
    return this.readBranch(projectId, trustedContext.taskId, trustedContext);
  }

  #branchService(projectId, taskId) {
    return new StudioService({
      store: this.#createBranchStore({ projectId, taskId }),
      clock: this.#clock,
      agentAttemptAuditReady: true,
      jobStore: null,
      capabilityProvider: this.#capabilityProvider,
      grantScopes: this.#grantScopes,
    });
  }

  async queryProjectCapabilities(request, trustedContext, options = {}) {
    const task = this.#taskStore.getTask(request.projectId, trustedContext.taskId);
    await this.readBranch(request.projectId, task?.taskId, trustedContext);
    return this.#branchService(request.projectId, task.taskId).queryProjectCapabilities(request, trustedContext, options);
  }

  async queryAssets(request, trustedContext, options = {}) {
    const task = this.#taskStore.getTask(request.projectId, trustedContext.taskId);
    await this.readBranch(request.projectId, task?.taskId, trustedContext);
    return this.#branchService(request.projectId, task.taskId).queryAssets(request, trustedContext, options);
  }

  async queryRooms(request, trustedContext, options = {}) {
    const task = this.#taskStore.getTask(request.projectId, trustedContext.taskId);
    await this.readBranch(request.projectId, task?.taskId, trustedContext);
    return this.#branchService(request.projectId, task.taskId).queryRooms(request, trustedContext, options);
  }

  async proposeAtlasGrid(request, trustedContext, options = {}) {
    const task = this.#taskStore.getTask(request.projectId, trustedContext.taskId);
    this.#assertExecutionAuthority(task, trustedContext, this.#clock());
    return this.#branchService(request.projectId, task.taskId).proposeAtlasGrid(request, trustedContext, options);
  }

  async execute(rawCommand, trustedAgentContext, { signal } = {}) {
    const projectId = requireId(rawCommand?.projectId, 'projectId');
    const taskId = requireId(trustedAgentContext?.taskId, 'trustedExecutionContext.taskId');
    const task = this.#taskStore.getTask(projectId, taskId);
    this.#assertExecutionAuthority(task, trustedAgentContext, this.#clock());
    invariant(trustedAgentContext.grantId === task.grantId, 'TASK_GRANT_MISMATCH', 'The trusted grant does not match the task authority.');
    const definition = getCommandDefinition(rawCommand.type);
    invariant(definition, 'UNKNOWN_COMMAND', 'Unknown Studio command.', { commandType: rawCommand.type });
    invariant(!definition.ownerOnly, 'FORBIDDEN', 'This command remains human-only in Checkpoint 4.', { commandType: rawCommand.type });
    invariant(!BRANCH_EXTERNAL_SIDE_EFFECT_COMMANDS.has(rawCommand.type), 'TASK_BRANCH_EXTERNAL_SIDE_EFFECT_FORBIDDEN', 'This command consumes shared external state and is not branch-safe. Use an already committed source/atlas result.', { commandType: rawCommand.type });
    invariant(!definition.requiredScope || task.capabilities.includes(definition.requiredScope), 'TASK_CAPABILITY_MISSING', 'The task does not include the command capability.', { requiredScope: definition.requiredScope });
    const branchService = this.#branchService(projectId, taskId);
    const result = await branchService.execute(rawCommand, trustedAgentContext, { signal });
    return { ...result, taskId, branchId: task.branchId, branchRevision: result.revision };
  }

  async control(projectId, taskId, action, { actorId, reason = null }) {
    invariant(['pause', 'resume', 'cancel', 'reject'].includes(action), 'VALIDATION_ERROR', 'Unsupported task control action.', { action });
    const project = await this.#studioService.readProjectTrusted(projectId);
    invariant(actorId === project.snapshot.project.ownerId, 'FORBIDDEN', 'Only the project owner can control a task.');
    const task = this.#taskStore.transition(projectId, taskId, action, { actorId, now: this.#clock(), reason });
    if (['cancel', 'reject'].includes(action) && task.grantId) {
      const latest = await this.#studioService.readProjectTrusted(projectId);
      const grant = latest.snapshot.grants.find((candidate) => candidate.id === task.grantId);
      if (grant && !grant.revokedAt) {
        await this.#studioService.execute(ownerCommand(latest, {
          commandId: `task.${taskId}.grant.revoke.${action}`,
          type: 'grant.revoke',
          payload: { grantId: task.grantId, reason: reason ?? `Task ${action}.` },
        }), ownerContext(latest, `task.${taskId}.${action}`));
      }
    }
    return this.readTask(projectId, taskId);
  }

  deriveCandidateChild(projectId, request, trustedContext) {
    invariant(this.#derivedChildService, 'DERIVED_CHILD_APPLICATION_DISABLED', 'Derived-child authority is not configured.');
    return this.#derivedChildService.deriveCandidateChild(projectId, request, trustedContext);
  }

  async submitReview(projectId, taskId, { reviewId, actorId }) {
    const project = await this.#studioService.readProjectTrusted(projectId);
    invariant(actorId === project.snapshot.project.ownerId, 'FORBIDDEN', 'Only the project owner can submit the branch for review.');
    const mainDocument = await this.#projectStore.loadProject(projectId);
    const review = this.#taskStore.createReview(projectId, taskId, mainDocument, {
      reviewId: requireId(reviewId, 'reviewId'), actorId, now: this.#clock(),
    });
    return { schemaVersion: 1, review };
  }

  async decideReview(projectId, taskId, reviewId, decisions, { actorId }) {
    const project = await this.#studioService.readProjectTrusted(projectId);
    invariant(actorId === project.snapshot.project.ownerId, 'FORBIDDEN', 'Only the project owner can decide task changes.');
    return {
      schemaVersion: 1,
      review: this.#taskStore.decideReview(projectId, taskId, reviewId, decisions, { actorId, now: this.#clock() }),
    };
  }

  async mergeReview(projectId, taskId, reviewId, { mergeId, actorId }) {
    const task = this.#taskStore.getTask(projectId, taskId);
    invariant(task, 'TASK_NOT_FOUND', 'The agent task does not exist.', { projectId, taskId });
    invariant(!this.#taskStore.hasLevelCandidateSource(projectId, taskId),
      'LEVEL_CANDIDATE_MERGE_FORBIDDEN',
      'Level Candidates cannot be merged or appended to main by the A4c create path.');
    const existingMerge = this.#taskStore.getMergeForTask(projectId, taskId);
    if (existingMerge) return { schemaVersion: 1, merge: existingMerge, replayed: true };
    const review = this.#taskStore.getReview(projectId, taskId, reviewId);
    invariant(review, 'REVIEW_NOT_FOUND', 'The task review does not exist.', { reviewId });
    invariant(review.kind !== 'studio.level-candidate-review', 'LEVEL_CANDIDATE_MERGE_FORBIDDEN',
      'Level Candidates cannot be merged or appended to main by the A4c create path.');
    const accepted = assertReviewMergeable(review);
    const mainDocument = await this.#projectStore.loadProject(projectId);
    const mainHead = mainDocument.revisions.at(-1);
    invariant(actorId === mainHead.snapshot.project.ownerId, 'FORBIDDEN', 'Only the project owner can merge a task branch.');
    const branchRevisions = this.#taskStore.listBranchRevisions(projectId, taskId);
    const freshConflicts = findSemanticConflicts(
      branchRevisions,
      mainDocument.revisions.filter((revision) => revision.number > task.baseRevision),
    );
    invariant(freshConflicts.length === 0, 'SEMANTIC_MERGE_CONFLICT', 'The main branch changed on an object touched by this task.', { conflicts: freshConflicts });
    invariant(typeof this.#projectStore.appendRevisionBatch === 'function', 'ATOMIC_MERGE_UNAVAILABLE', 'The authoritative store cannot commit an atomic merge batch.');

    const acceptedIds = new Set(accepted.map((item) => item.changeId));
    const selected = branchRevisions.filter((revision) => acceptedIds.has(revision.id));
    invariant(selected.length === accepted.length, 'REVIEW_CHANGE_NOT_FOUND', 'An accepted review change is missing from the immutable branch.');
    const simulationStore = new MergeSimulationStore(mainDocument);
    const simulation = new StudioService({ store: simulationStore, clock: this.#clock, agentAttemptAuditReady: true });
    const context = ownerContext({ snapshot: mainHead.snapshot }, `task.${taskId}.merge.${mergeId}`);
    for (const [index, branchRevision] of selected.entries()) {
      const head = simulationStore.document().revisions.at(-1);
      await simulation.execute({
        schemaVersion: 1,
        commandId: `task.merge.${mergeId}.${index + 1}`,
        idempotencyKey: `task.merge.${mergeId}.${index + 1}`,
        type: branchRevision.command.type,
        projectId,
        baseRevision: head.number,
        expectedVersion: head.number,
        dryRun: false,
        payload: structuredClone(branchRevision.command.payload),
      }, context);
    }
    const beforeRevoke = simulationStore.document();
    const grant = beforeRevoke.revisions.at(-1).snapshot.grants.find((candidate) => candidate.id === task.grantId);
    if (grant && !grant.revokedAt) {
      const head = beforeRevoke.revisions.at(-1);
      await simulation.execute({
        schemaVersion: 1,
        commandId: `task.merge.${mergeId}.grant-revoke`,
        idempotencyKey: `task.merge.${mergeId}.grant-revoke`,
        type: 'grant.revoke',
        projectId,
        baseRevision: head.number,
        expectedVersion: head.number,
        dryRun: false,
        payload: { grantId: task.grantId, reason: `Task merged as ${mergeId}.` },
      }, context);
    }
    const simulatedDocument = simulationStore.document();
    const revisions = simulatedDocument.revisions.filter((revision) => revision.number > mainHead.number);
    const mergedAt = revisions.at(-1).committedAt;
    let merge;
    await this.#projectStore.appendRevisionBatch(projectId, mainHead.number, revisions, {
      afterAppend: (database, range) => {
        merge = this.#taskStore.completeMergeInTransaction(database, {
          projectId,
          taskId,
          reviewId,
          mergeId: requireId(mergeId, 'mergeId'),
          mainParentRevision: mainHead.number,
          firstRevision: range.firstRevision,
          lastRevision: range.lastRevision,
          branchParentRevision: task.headRevision,
          mergedAt,
          mergedBy: actorId,
          acceptedChangeIds: accepted.map((item) => item.changeId),
        });
      },
    });
    return { schemaVersion: 1, merge, replayed: false };
  }

  async revertMerge(projectId, mergeId, { revertId, actorId }) {
    const merge = this.#taskStore.getMerge(projectId, mergeId);
    invariant(merge, 'MERGE_NOT_FOUND', 'The task merge does not exist.', { projectId, mergeId });
    const mainDocument = await this.#projectStore.loadProject(projectId);
    const head = mainDocument.revisions.at(-1);
    invariant(actorId === head.snapshot.project.ownerId, 'FORBIDDEN', 'Only the project owner can revert a task merge.');
    const parent = mainDocument.revisions.find((revision) => revision.number === merge.mainParentRevision);
    invariant(parent, 'CORRUPT_AGENT_TASK', 'The immutable pre-merge parent revision is missing.', { mergeId });
    const branchRevisions = this.#taskStore.listBranchRevisions(projectId, merge.taskId);
    const accepted = new Set(merge.acceptedChangeIds);
    const changes = branchRevisions
      .filter((revision) => accepted.has(revision.id))
      .flatMap((revision) => revision.event.changes ?? []);
    const now = requireIsoDate(this.#clock(), 'clock');
    const revision = compensatingRevision({
      projectId,
      number: head.number + 1,
      merge,
      currentSnapshot: head.snapshot,
      targetSnapshot: parent.snapshot,
      actor: { id: actorId, kind: 'human', displayName: 'Local designer' },
      now,
      changes,
    });
    let revert;
    await this.#projectStore.appendRevisionBatch(projectId, head.number, [revision], {
      afterAppend: (database, range) => {
        revert = this.#taskStore.completeRevertInTransaction(database, {
          projectId,
          mergeId,
          revertId: requireId(revertId, 'revertId'),
          firstRevision: range.firstRevision,
          lastRevision: range.lastRevision,
          revertedAt: now,
          revertedBy: actorId,
        });
      },
    });
    return { schemaVersion: 1, revert };
  }
}
