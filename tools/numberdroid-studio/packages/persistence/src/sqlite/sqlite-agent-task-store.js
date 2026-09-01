import {
  applyReviewDecisions,
  createReviewItems,
  findSemanticConflicts,
  transitionAgentTask,
} from '../../../domain/src/agent-task.js';
import { StudioError, invariant } from '../../../domain/src/errors.js';
import { ProjectStore, projectSummary } from '../../../application/src/project-store.js';
import { SqliteWorkspace } from './sqlite-workspace.js';
import { assertDerivedTaskAncestorChain } from './sqlite-derived-child-task-store.js';

function parseJson(value, label) {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new StudioError('CORRUPT_AGENT_TASK', `Invalid JSON stored in ${label}.`, { cause: error.message });
  }
}

function clone(value) {
  return structuredClone(value);
}

function taskRow(database, projectId, taskId) {
  return database.prepare(`
    SELECT * FROM agent_tasks WHERE project_id = ? AND task_id = ?
  `).get(projectId, taskId);
}

function mapTask(row) {
  if (!row) return null;
  const task = parseJson(row.task_json, 'agent_tasks.task_json');
  return {
    ...task,
    state: row.state,
    grantId: row.grant_id,
    headRevision: Number(row.head_revision),
    updatedAt: row.updated_at,
  };
}

function nextTimelineSequence(database, projectId, taskId) {
  const row = database.prepare(`
    SELECT COALESCE(MAX(sequence), 0) AS sequence
    FROM task_timeline_events WHERE project_id = ? AND task_id = ?
  `).get(projectId, taskId);
  return Number(row.sequence) + 1;
}

function appendTimeline(database, projectId, taskId, event) {
  const sequence = nextTimelineSequence(database, projectId, taskId);
  const normalized = { schemaVersion: 1, sequence, projectId, taskId, ...clone(event) };
  database.prepare(`
    INSERT INTO task_timeline_events(
      project_id, task_id, sequence, event_id, occurred_at, event_type, event_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(projectId, taskId, sequence, normalized.eventId, normalized.occurredAt, normalized.type, JSON.stringify(normalized));
  return normalized;
}

function latestReviewRow(database, projectId, taskId, reviewId = null) {
  if (reviewId) {
    return database.prepare(`
      SELECT * FROM task_reviews
      WHERE project_id = ? AND task_id = ? AND review_id = ?
      ORDER BY review_version DESC LIMIT 1
    `).get(projectId, taskId, reviewId);
  }
  return database.prepare(`
    SELECT * FROM task_reviews
    WHERE project_id = ? AND task_id = ?
    ORDER BY created_at DESC, review_version DESC LIMIT 1
  `).get(projectId, taskId);
}

function mapReview(row) {
  return row ? parseJson(row.review_json, 'task_reviews.review_json') : null;
}

function hasLevelCandidateSource(database, projectId, taskId) {
  return Boolean(database.prepare(`
    SELECT 1 FROM task_branch_revisions
    WHERE project_id = ? AND task_id = ? AND command_type = 'level.candidate.create'
    LIMIT 1
  `).get(projectId, taskId));
}

function assertNoLevelCandidateSource(database, projectId, taskId, code, message) {
  invariant(!hasLevelCandidateSource(database, projectId, taskId), code, message, { projectId, taskId });
}

export class SqliteAgentTaskStore {
  #workspace;

  constructor({ workspace }) {
    invariant(workspace instanceof SqliteWorkspace, 'VALIDATION_ERROR', 'SqliteWorkspace is required.');
    this.#workspace = workspace;
  }

  get workspace() { return this.#workspace; }
  get isLive() { return this.#workspace.isWriter; }

  hasLevelCandidateSource(projectId, taskId) {
    return hasLevelCandidateSource(this.#workspace.database, projectId, taskId);
  }

  assertExecutionAuthority(projectId, taskId, now) {
    const row = taskRow(this.#workspace.database, projectId, taskId);
    invariant(row, 'TASK_NOT_FOUND', 'The agent task does not exist.', { projectId, taskId });
    return assertDerivedTaskAncestorChain(this.#workspace.database, row, { now });
  }

  taskAuthorityProjection(projectId, taskId, now) {
    const row = taskRow(this.#workspace.database, projectId, taskId);
    invariant(row, 'TASK_NOT_FOUND', 'The agent task does not exist.', { projectId, taskId });
    const relation = this.#workspace.database.prepare(`
      SELECT relation_json FROM derived_task_relations WHERE project_id = ? AND child_task_id = ?
    `).get(projectId, taskId);
    let executionAvailability = 'EXECUTABLE';
    let blockedCode = null;
    try { assertDerivedTaskAncestorChain(this.#workspace.database, row, { now }); }
    catch (error) { executionAvailability = 'BLOCKED_BY_ANCESTOR'; blockedCode = error?.code ?? 'ANCESTOR_TASK_BLOCKED'; }
    return {
      origin: relation ? 'TRUSTED_SERVICE_CHILD' : 'HUMAN_ROOT',
      lineage: relation ? parseJson(relation.relation_json, 'derived_task_relations.relation_json') : null,
      executionAvailability,
      blockedCode,
    };
  }

  createTask({ task, baseDocument, grantId = null, issuedBy, now }) {
    const head = baseDocument.revisions.at(-1);
    invariant(head?.number === task.baseRevision, 'REVISION_CONFLICT', 'Task base document does not match its declared base revision.');
    const storedTask = {
      ...clone(task),
      state: 'ACTIVE',
      grantId,
      headRevision: task.baseRevision,
      createdAt: now,
      updatedAt: now,
      stateReason: null,
    };
    try {
      return this.#workspace.transaction((database) => {
        invariant(!taskRow(database, task.projectId, task.taskId), 'TASK_EXISTS', 'The agent task already exists.', { taskId: task.taskId });
        const branchCollision = database.prepare(`
          SELECT task_id FROM agent_tasks WHERE project_id = ? AND branch_id = ?
        `).get(task.projectId, task.branchId);
        invariant(!branchCollision, 'TASK_BRANCH_EXISTS', 'The task branch identity is already in use.', { branchId: task.branchId });
        database.prepare(`
          INSERT INTO agent_tasks(
            project_id, task_id, branch_id, agent_id, grant_id, base_revision, head_revision,
            state, expires_at, created_at, updated_at, task_json, base_document_json, head_document_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?)
        `).run(
          task.projectId, task.taskId, task.branchId, task.agentId, grantId,
          task.baseRevision, task.baseRevision, task.expiresAt, now, now,
          JSON.stringify(storedTask), JSON.stringify(baseDocument), JSON.stringify(baseDocument),
        );
        appendTimeline(database, task.projectId, task.taskId, {
          eventId: `task-event:${task.taskId}:created`,
          occurredAt: now,
          type: 'TASK_CREATED',
          actorId: issuedBy,
          state: 'ACTIVE',
          branchRevision: task.baseRevision,
          details: { baseRevision: task.baseRevision, branchId: task.branchId },
        });
        return clone(storedTask);
      });
    } catch (error) {
      if (String(error?.message).includes('UNIQUE constraint failed')) {
        throw new StudioError('TASK_EXISTS', 'The agent task or branch already exists.', { taskId: task.taskId, branchId: task.branchId });
      }
      throw error;
    }
  }

  getTask(projectId, taskId) {
    return mapTask(taskRow(this.#workspace.database, projectId, taskId));
  }

  getTaskByBranch(projectId, branchId) {
    return mapTask(this.#workspace.database.prepare(`
      SELECT * FROM agent_tasks WHERE project_id = ? AND branch_id = ?
    `).get(projectId, branchId));
  }

  listTasks(projectId) {
    return this.#workspace.database.prepare(`
      SELECT * FROM agent_tasks WHERE project_id = ? ORDER BY updated_at DESC, task_id
    `).all(projectId).map(mapTask);
  }

  loadBranchDocument(projectId, taskId) {
    const row = taskRow(this.#workspace.database, projectId, taskId);
    return row ? parseJson(row.head_document_json, 'agent_tasks.head_document_json') : null;
  }

  loadBaseDocument(projectId, taskId) {
    const row = taskRow(this.#workspace.database, projectId, taskId);
    return row ? parseJson(row.base_document_json, 'agent_tasks.base_document_json') : null;
  }

  appendBranchRevision(projectId, taskId, expectedRevision, revision) {
    return this.#workspace.transaction((database) => {
      const row = taskRow(database, projectId, taskId);
      invariant(row, 'TASK_NOT_FOUND', 'The agent task does not exist.', { projectId, taskId });
      invariant(row.state === 'ACTIVE', row.state === 'PAUSED' ? 'TASK_PAUSED' : 'TASK_NOT_EXECUTABLE', 'The task branch is not writable.', { state: row.state });
      const actualRevision = Number(row.head_revision);
      invariant(actualRevision === expectedRevision, 'REVISION_CONFLICT', 'The task branch changed after it was read.', {
        projectId, taskId, expectedRevision, actualRevision,
      });
      invariant(revision.number === expectedRevision + 1 && revision.parentRevision === expectedRevision, 'INVALID_REVISION', 'The branch revision does not follow its current head.');
      const document = parseJson(row.head_document_json, 'agent_tasks.head_document_json');
      const nextDocument = { ...document, revisions: [...document.revisions, clone(revision)] };
      const task = mapTask(row);
      const grant = revision.snapshot.grants.find((candidate) => candidate.id === task.grantId);
      const nextTask = {
        ...task,
        usage: grant?.usage ? clone(grant.usage) : task.usage,
        headRevision: revision.number,
        updatedAt: revision.committedAt,
      };
      database.prepare(`
        INSERT INTO task_branch_revisions(
          project_id, task_id, branch_id, branch_revision, revision_id, command_id,
          idempotency_key, command_type, committed_at, revision_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        projectId, taskId, row.branch_id, revision.number, revision.id,
        revision.command.commandId, revision.command.idempotencyKey, revision.command.type,
        revision.committedAt, JSON.stringify(revision),
      );
      const updated = database.prepare(`
        UPDATE agent_tasks
        SET head_revision = ?, updated_at = ?, task_json = ?, head_document_json = ?
        WHERE project_id = ? AND task_id = ? AND head_revision = ? AND state = 'ACTIVE'
      `).run(
        revision.number, revision.committedAt, JSON.stringify(nextTask), JSON.stringify(nextDocument),
        projectId, taskId, expectedRevision,
      );
      invariant(Number(updated.changes) === 1, 'REVISION_CONFLICT', 'Task branch compare-and-swap failed.');
      appendTimeline(database, projectId, taskId, {
        eventId: `task-event:${taskId}:revision:${revision.number}`,
        occurredAt: revision.committedAt,
        type: 'BRANCH_COMMAND_COMMITTED',
        actorId: revision.command.actor.id,
        state: 'ACTIVE',
        branchRevision: revision.number,
        details: {
          commandId: revision.command.commandId,
          commandType: revision.command.type,
          summary: revision.event.summary,
          changes: revision.event.changes,
        },
      });
      return clone(nextDocument);
    });
  }

  listBranchRevisions(projectId, taskId) {
    return this.#workspace.database.prepare(`
      SELECT revision_json FROM task_branch_revisions
      WHERE project_id = ? AND task_id = ? ORDER BY branch_revision
    `).all(projectId, taskId).map((row) => parseJson(row.revision_json, 'task_branch_revisions.revision_json'));
  }

  listTimeline(projectId, taskId) {
    invariant(this.getTask(projectId, taskId), 'TASK_NOT_FOUND', 'The agent task does not exist.', { projectId, taskId });
    return this.#workspace.database.prepare(`
      SELECT event_json FROM task_timeline_events
      WHERE project_id = ? AND task_id = ? ORDER BY sequence
    `).all(projectId, taskId).map((row) => parseJson(row.event_json, 'task_timeline_events.event_json'));
  }

  transition(projectId, taskId, action, { actorId, now, reason = null }) {
    return this.#workspace.transaction((database) => {
      const row = taskRow(database, projectId, taskId);
      invariant(row, 'TASK_NOT_FOUND', 'The agent task does not exist.', { projectId, taskId });
      const next = transitionAgentTask(mapTask(row), action, { now, reason });
      database.prepare(`
        UPDATE agent_tasks SET state = ?, updated_at = ?, task_json = ?
        WHERE project_id = ? AND task_id = ?
      `).run(next.state, now, JSON.stringify(next), projectId, taskId);
      appendTimeline(database, projectId, taskId, {
        eventId: `task-event:${taskId}:${action}:${nextTimelineSequence(database, projectId, taskId)}`,
        occurredAt: now,
        type: `TASK_${action.toUpperCase()}`,
        actorId,
        state: next.state,
        branchRevision: Number(row.head_revision),
        details: { reason },
      });
      return clone(next);
    });
  }

  createReview(projectId, taskId, mainDocument, { reviewId, actorId, now }) {
    return this.#workspace.transaction((database) => {
      const row = taskRow(database, projectId, taskId);
      invariant(row, 'TASK_NOT_FOUND', 'The agent task does not exist.', { projectId, taskId });
      assertNoLevelCandidateSource(database, projectId, taskId,
        'LEVEL_CANDIDATE_GENERIC_REVIEW_FORBIDDEN',
        'A Level Candidate source can only enter its dedicated read-only Candidate review path.');
      const task = mapTask(row);
      const submitted = transitionAgentTask(task, 'submit', { now, reason: 'Branch submitted for human review.' });
      const branchRevisions = database.prepare(`
        SELECT revision_json FROM task_branch_revisions
        WHERE project_id = ? AND task_id = ? AND command_type <> 'task.child.derive'
        ORDER BY branch_revision
      `).all(projectId, taskId).map((entry) => parseJson(entry.revision_json, 'task_branch_revisions.revision_json'));
      invariant(branchRevisions.length > 0, 'TASK_BRANCH_EMPTY', 'An empty task branch cannot be submitted for review.');
      const mainHead = mainDocument.revisions.at(-1);
      const conflicts = findSemanticConflicts(
        branchRevisions,
        mainDocument.revisions.filter((revision) => revision.number > task.baseRevision),
      );
      const review = {
        schemaVersion: 1,
        reviewId,
        reviewVersion: 1,
        projectId,
        taskId,
        branchId: task.branchId,
        baseRevision: task.baseRevision,
        branchHeadRevision: Number(row.head_revision),
        comparedMainRevision: mainHead.number,
        state: 'OPEN',
        items: createReviewItems(branchRevisions, task.autoAcceptPolicy),
        conflicts,
        createdAt: now,
        createdBy: actorId,
      };
      database.prepare(`
        INSERT INTO task_reviews(project_id, task_id, review_id, review_version, state, created_at, review_json)
        VALUES (?, ?, ?, 1, 'OPEN', ?, ?)
      `).run(projectId, taskId, reviewId, now, JSON.stringify(review));
      database.prepare(`
        UPDATE agent_tasks SET state = 'IN_REVIEW', updated_at = ?, task_json = ?
        WHERE project_id = ? AND task_id = ?
      `).run(now, JSON.stringify(submitted), projectId, taskId);
      appendTimeline(database, projectId, taskId, {
        eventId: `task-event:${taskId}:review:${reviewId}:1`,
        occurredAt: now,
        type: 'REVIEW_SUBMITTED',
        actorId,
        state: 'IN_REVIEW',
        branchRevision: Number(row.head_revision),
        details: { reviewId, itemCount: review.items.length, conflictCount: conflicts.length },
      });
      return clone(review);
    });
  }

  getReview(projectId, taskId, reviewId = null) {
    return mapReview(latestReviewRow(this.#workspace.database, projectId, taskId, reviewId));
  }

  decideReview(projectId, taskId, reviewId, decisions, { actorId, now }) {
    return this.#workspace.transaction((database) => {
      const row = latestReviewRow(database, projectId, taskId, reviewId);
      invariant(row, 'REVIEW_NOT_FOUND', 'The task review does not exist.', { reviewId });
      const review = mapReview(row);
      invariant(review.state === 'OPEN', 'REVIEW_STATE_CONFLICT', 'Only an open review can receive decisions.');
      assertNoLevelCandidateSource(database, projectId, taskId,
        'LEVEL_CANDIDATE_REVIEW_DECISION_FORBIDDEN',
        'Level Candidate review decisions require a later explicit owner authority contract.');
      invariant(review.kind !== 'studio.level-candidate-review', 'LEVEL_CANDIDATE_REVIEW_DECISION_FORBIDDEN',
        'Level Candidate review decisions require a later explicit owner authority contract.');
      const storedTaskRow = taskRow(database, projectId, taskId);
      invariant(storedTaskRow, 'TASK_NOT_FOUND', 'The agent task does not exist.', { projectId, taskId });
      const task = mapTask(storedTaskRow);
      invariant(task.state === 'IN_REVIEW', 'TASK_STATE_CONFLICT', 'Review decisions require a task in review.', { state: task.state });
      const items = applyReviewDecisions(review.items, decisions, { actorId, now });
      const changesRequested = items.some((item) => item.disposition === 'CHANGES_REQUESTED');
      const next = {
        ...review,
        reviewVersion: review.reviewVersion + 1,
        state: changesRequested ? 'SUPERSEDED' : 'OPEN',
        items,
        updatedAt: now,
      };
      database.prepare(`
        INSERT INTO task_reviews(project_id, task_id, review_id, review_version, state, created_at, review_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(projectId, taskId, reviewId, next.reviewVersion, next.state, now, JSON.stringify(next));
      let taskState = task.state;
      if (changesRequested) {
        const nextTask = transitionAgentTask(task, 'request_changes', {
          now,
          reason: `Changes requested in review ${reviewId}.`,
        });
        taskState = nextTask.state;
        database.prepare(`
          UPDATE agent_tasks SET state = ?, updated_at = ?, task_json = ?
          WHERE project_id = ? AND task_id = ? AND state = 'IN_REVIEW'
        `).run(nextTask.state, now, JSON.stringify(nextTask), projectId, taskId);
      }
      appendTimeline(database, projectId, taskId, {
        eventId: `task-event:${taskId}:review:${reviewId}:${next.reviewVersion}`,
        occurredAt: now,
        type: changesRequested ? 'REVIEW_CHANGES_REQUESTED' : 'REVIEW_DECIDED',
        actorId,
        state: taskState,
        branchRevision: review.branchHeadRevision,
        details: { reviewId, decisions: clone(decisions) },
      });
      return clone(next);
    });
  }

  getMerge(projectId, mergeId) {
    const row = this.#workspace.database.prepare(`
      SELECT merge_json FROM task_merges WHERE project_id = ? AND merge_id = ?
    `).get(projectId, mergeId);
    return row ? parseJson(row.merge_json, 'task_merges.merge_json') : null;
  }

  getMergeForTask(projectId, taskId) {
    const row = this.#workspace.database.prepare(`
      SELECT merge_json FROM task_merges WHERE project_id = ? AND task_id = ?
    `).get(projectId, taskId);
    return row ? parseJson(row.merge_json, 'task_merges.merge_json') : null;
  }

  completeMergeInTransaction(database, {
    projectId,
    taskId,
    reviewId,
    mergeId,
    mainParentRevision,
    firstRevision,
    lastRevision,
    branchParentRevision,
    mergedAt,
    mergedBy,
    acceptedChangeIds,
  }) {
    const row = taskRow(database, projectId, taskId);
    invariant(row, 'TASK_NOT_FOUND', 'The agent task does not exist.', { projectId, taskId });
    const task = mapTask(row);
    invariant(task.state === 'IN_REVIEW', 'TASK_STATE_CONFLICT', 'Only a task in review can merge.', { state: task.state });
    assertNoLevelCandidateSource(database, projectId, taskId,
      'LEVEL_CANDIDATE_MERGE_FORBIDDEN',
      'Level Candidates cannot be merged or appended to main by the A4c create path.');
    const reviewRow = latestReviewRow(database, projectId, taskId, reviewId);
    invariant(reviewRow, 'REVIEW_NOT_FOUND', 'The task review does not exist.', { reviewId });
    const review = mapReview(reviewRow);
    invariant(review.state === 'OPEN', 'REVIEW_STATE_CONFLICT', 'Only an open review can merge.');
    invariant(review.kind !== 'studio.level-candidate-review', 'LEVEL_CANDIDATE_MERGE_FORBIDDEN',
      'Level Candidates cannot be merged or appended to main by the A4c create path.');
    const merge = {
      schemaVersion: 1,
      mergeId,
      projectId,
      taskId,
      branchId: task.branchId,
      reviewId,
      mainParentRevision,
      branchParentRevision,
      firstRevision,
      lastRevision,
      acceptedChangeIds: clone(acceptedChangeIds),
      mergedAt,
      mergedBy,
      revertedAt: null,
      revertId: null,
    };
    database.prepare(`
      INSERT INTO task_merges(
        project_id, task_id, merge_id, review_id, main_parent_revision,
        first_revision, last_revision, branch_parent_revision, merged_at,
        merged_by, merge_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projectId, taskId, mergeId, reviewId, mainParentRevision,
      firstRevision, lastRevision, branchParentRevision, mergedAt, mergedBy,
      JSON.stringify(merge),
    );
    const mergedReview = { ...review, reviewVersion: review.reviewVersion + 1, state: 'MERGED', mergeId, mergedAt, mergedBy };
    database.prepare(`
      INSERT INTO task_reviews(project_id, task_id, review_id, review_version, state, created_at, review_json)
      VALUES (?, ?, ?, ?, 'MERGED', ?, ?)
    `).run(projectId, taskId, reviewId, mergedReview.reviewVersion, mergedAt, JSON.stringify(mergedReview));
    const mergedTask = transitionAgentTask(task, 'merge', { now: mergedAt, reason: `Merged as ${mergeId}.` });
    database.prepare(`
      UPDATE agent_tasks SET state = 'MERGED', updated_at = ?, task_json = ?
      WHERE project_id = ? AND task_id = ?
    `).run(mergedAt, JSON.stringify(mergedTask), projectId, taskId);
    appendTimeline(database, projectId, taskId, {
      eventId: `task-event:${taskId}:merge:${mergeId}`,
      occurredAt: mergedAt,
      type: 'TASK_MERGED',
      actorId: mergedBy,
      state: 'MERGED',
      branchRevision: branchParentRevision,
      details: { mergeId, mainParentRevision, firstRevision, lastRevision, acceptedChangeIds },
    });
    return merge;
  }

  completeRevertInTransaction(database, {
    projectId,
    mergeId,
    revertId,
    firstRevision,
    lastRevision,
    revertedAt,
    revertedBy,
  }) {
    const row = database.prepare(`
      SELECT merge_json, task_id FROM task_merges WHERE project_id = ? AND merge_id = ?
    `).get(projectId, mergeId);
    invariant(row, 'MERGE_NOT_FOUND', 'The task merge does not exist.', { projectId, mergeId });
    const merge = parseJson(row.merge_json, 'task_merges.merge_json');
    invariant(!merge.revertedAt, 'MERGE_ALREADY_REVERTED', 'The task merge was already reverted.', { mergeId });
    const revert = {
      schemaVersion: 1,
      revertId,
      projectId,
      taskId: row.task_id,
      mergeId,
      firstRevision,
      lastRevision,
      revertedAt,
      revertedBy,
      compensatesMainRevisionRange: { firstRevision: merge.firstRevision, lastRevision: merge.lastRevision },
    };
    database.prepare(`
      INSERT INTO task_reverts(
        project_id, revert_id, merge_id, first_revision, last_revision,
        reverted_at, reverted_by, revert_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(projectId, revertId, mergeId, firstRevision, lastRevision, revertedAt, revertedBy, JSON.stringify(revert));
    appendTimeline(database, projectId, row.task_id, {
      eventId: `task-event:${row.task_id}:revert:${revertId}`,
      occurredAt: revertedAt,
      type: 'MERGE_REVERTED',
      actorId: revertedBy,
      state: 'MERGED',
      branchRevision: merge.branchParentRevision,
      details: { revertId, mergeId, firstRevision, lastRevision },
    });
    return revert;
  }
}

export class TaskBranchProjectStore extends ProjectStore {
  #taskStore;
  #projectId;
  #taskId;

  constructor({ taskStore, projectId, taskId }) {
    super();
    invariant(taskStore instanceof SqliteAgentTaskStore, 'VALIDATION_ERROR', 'SqliteAgentTaskStore is required.');
    this.#taskStore = taskStore;
    this.#projectId = projectId;
    this.#taskId = taskId;
  }

  get isTaskBranchStore() { return true; }
  get supportsAtomicAssetLibrary() { return true; }
  get supportsDurableAssetStore() { return true; }
  get supportsAtomicRoomDesigner() { return true; }

  async createProject() {
    throw new StudioError('TASK_BRANCH_PROJECT_CREATE_FORBIDDEN', 'A task branch cannot create a project.');
  }

  async loadProject(projectId) {
    invariant(projectId === this.#projectId, 'CONTEXT_PROJECT_MISMATCH', 'The task branch cannot access another project.');
    return clone(this.#taskStore.loadBranchDocument(projectId, this.#taskId));
  }

  async appendRevision(projectId, expectedRevision, revision) {
    invariant(projectId === this.#projectId, 'CONTEXT_PROJECT_MISMATCH', 'The task branch cannot access another project.');
    return this.#taskStore.appendBranchRevision(projectId, this.#taskId, expectedRevision, revision);
  }

  async listProjects() {
    const document = this.#taskStore.loadBranchDocument(this.#projectId, this.#taskId);
    return document ? [projectSummary(document)] : [];
  }
}
