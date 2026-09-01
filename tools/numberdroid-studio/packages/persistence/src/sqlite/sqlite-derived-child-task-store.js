import {
  addBudgetUsage,
  assertBudgetReservationFits,
  assertCandidateChildAttenuation,
  candidateChildCapabilities,
  zeroTaskBudgetUsage,
} from '../../../domain/src/derived-child-task.js';
import { StudioError, invariant } from '../../../domain/src/errors.js';
import { requireIsoDate } from '../../../domain/src/validation.js';
import { fingerprint } from '../../../application/src/value-utils.js';
import { SqliteWorkspace } from './sqlite-workspace.js';

function clone(value) { return structuredClone(value); }

function parseJson(value, label) {
  try { return JSON.parse(value); } catch (error) {
    throw new StudioError('CORRUPT_DERIVED_CHILD_TASK', `Invalid JSON stored in ${label}.`, { cause: error.message });
  }
}

function taskRow(database, projectId, taskId) {
  return database.prepare('SELECT * FROM agent_tasks WHERE project_id = ? AND task_id = ?').get(projectId, taskId);
}

function mapTask(row) {
  if (!row) return null;
  const task = parseJson(row.task_json, 'agent_tasks.task_json');
  return { ...task, state: row.state, grantId: task.grantId ?? row.grant_id, headRevision: Number(row.head_revision) };
}

function nextTimelineSequence(database, projectId, taskId) {
  return Number(database.prepare(`
    SELECT COALESCE(MAX(sequence), 0) AS sequence
    FROM task_timeline_events WHERE project_id = ? AND task_id = ?
  `).get(projectId, taskId).sequence) + 1;
}

function appendTimeline(database, projectId, taskId, event) {
  const sequence = nextTimelineSequence(database, projectId, taskId);
  const value = { schemaVersion: 1, sequence, projectId, taskId, ...clone(event) };
  database.prepare(`
    INSERT INTO task_timeline_events(
      project_id, task_id, sequence, event_id, occurred_at, event_type, event_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(projectId, taskId, sequence, value.eventId, value.occurredAt, value.type, JSON.stringify(value));
  return value;
}

function replayRow(database, identity) {
  return database.prepare(`
    SELECT * FROM derived_task_relations
    WHERE project_id = ? AND parent_task_id = ? AND idempotency_key_hash = ?
  `).get(identity.projectId, identity.parentTaskId, identity.idempotencyKeyHash);
}

function replay(database, identity) {
  const row = replayRow(database, identity);
  if (!row) return null;
  invariant(row.child_task_id === identity.childTaskId
    && row.child_grant_id === identity.childGrantId
    && row.request_fingerprint === identity.requestFingerprint,
  'DERIVED_CHILD_IDEMPOTENCY_CONFLICT', 'The child-derivation idempotency key was already used for different semantics.');
  return parseJson(row.result_json, 'derived_task_relations.result_json');
}

function activeGrantRow(database, projectId, grantId) {
  return database.prepare('SELECT * FROM grants WHERE project_id = ? AND grant_id = ?').get(projectId, grantId);
}

function grantFromHead(head, grantId) {
  return head?.snapshot?.grants?.find(({ id }) => id === grantId) ?? null;
}

function requireActiveGrant(grant, row, task, now) {
  invariant(grant && row, 'GRANT_NOT_FOUND', 'The parent grant is missing.');
  invariant(grant.status === 'ACTIVE' && grant.revokedAt === null
    && row.status === 'ACTIVE' && row.authorization_status === 'ACTIVE' && row.revoked_at === null,
  'GRANT_REVOKED', 'The parent grant is not active.');
  invariant(grant.id === task.grantId && row.grant_id === task.grantId,
    'TASK_GRANT_MISMATCH', 'The task and parent grant differ.');
  invariant(grant.agentId === task.agentId && row.agent_id === task.agentId,
    'GRANT_ACTOR_MISMATCH', 'The parent grant belongs to another actor.');
  invariant(grant.taskId === task.taskId && row.task_id === task.taskId
    && grant.branchId === task.branchId && row.branch_id === task.branchId,
  'GRANT_TASK_MISMATCH', 'The parent grant does not bind the parent task branch.');
  invariant(!grant.expiresAt || Date.parse(grant.expiresAt) > Date.parse(now),
    'GRANT_EXPIRED', 'The parent grant has expired.');
  return true;
}

function relationForTask(database, projectId, taskId) {
  return database.prepare(`
    SELECT * FROM derived_task_relations WHERE project_id = ? AND child_task_id = ?
  `).get(projectId, taskId);
}

function assertHumanRooted(database, row, task, document, grantRow) {
  invariant(!relationForTask(database, row.project_id, row.task_id),
    'ANCESTOR_CHAIN_INVALID', 'A derived task cannot serve as the human root in the first child slice.');
  const ownerId = document?.revisions?.at(-1)?.snapshot?.project?.ownerId;
  const firstEvent = database.prepare(`
    SELECT event_json FROM task_timeline_events
    WHERE project_id = ? AND task_id = ? ORDER BY sequence LIMIT 1
  `).get(row.project_id, row.task_id);
  const event = firstEvent ? parseJson(firstEvent.event_json, 'task_timeline_events.event_json') : null;
  invariant(ownerId && grantRow?.issued_by === ownerId
    && event?.type === 'TASK_CREATED' && event.actorId === ownerId
    && task.projectId === row.project_id,
  'ANCESTOR_ROOT_INVALID', 'The task authority chain is not rooted in the project owner.');
}

export function assertDerivedTaskAncestorChain(database, taskRowValue, { now, requireExactParentHead = true } = {}) {
  const timestamp = requireIsoDate(now, 'now');
  const relation = relationForTask(database, taskRowValue.project_id, taskRowValue.task_id);
  if (!relation) return { kind: 'HUMAN_ROOT', executable: true };
  const parentRow = taskRow(database, relation.project_id, relation.parent_task_id);
  invariant(parentRow, 'ANCESTOR_TASK_MISSING', 'A derived task has no durable parent task.');
  invariant(!relationForTask(database, relation.project_id, relation.parent_task_id)
    && relation.root_task_id === relation.parent_task_id,
  'ANCESTOR_CHAIN_INVALID', 'The first derived-child slice requires one human-rooted parent and forbids grandchildren.');
  invariant(parentRow.state === 'ACTIVE',
    ['PAUSED', 'IN_REVIEW', 'CHANGES_REQUESTED'].includes(parentRow.state)
      ? 'ANCESTOR_TASK_BLOCKED' : 'ANCESTOR_TASK_TERMINAL',
    'The parent task does not permit descendant mutation.', { state: parentRow.state });
  invariant(Date.parse(parentRow.expires_at) > Date.parse(timestamp),
    'ANCESTOR_TASK_EXPIRED', 'The parent task has expired.');
  if (requireExactParentHead) {
    invariant(Number(parentRow.head_revision) === Number(relation.parent_head_revision),
      'ANCESTOR_HEAD_STALE', 'The parent branch changed after the child was derived.');
  }
  const parentTask = mapTask(parentRow);
  const parentDocument = parseJson(parentRow.head_document_json, 'agent_tasks.head_document_json');
  invariant(fingerprint(parentDocument.revisions?.at(-1)) === relation.parent_head_fingerprint,
    'ANCESTOR_HEAD_STALE', 'The parent branch head no longer matches the derived-child source fingerprint.');
  const parentGrant = grantFromHead(parentDocument.revisions?.at(-1), relation.parent_grant_id);
  const parentGrantRow = activeGrantRow(database, relation.project_id, relation.parent_grant_id);
  requireActiveGrant(parentGrant, parentGrantRow, parentTask, timestamp);
  assertHumanRooted(database, parentRow, parentTask, parentDocument, parentGrantRow);
  return {
    kind: 'TRUSTED_SERVICE_CHILD',
    executable: true,
    parentTaskId: relation.parent_task_id,
    rootTaskId: relation.root_task_id,
    parentHeadRevision: Number(relation.parent_head_revision),
  };
}

export class SqliteDerivedChildTaskStore {
  #workspace;
  #faultInjector;

  constructor({ workspace, faultInjector = null }) {
    invariant(workspace instanceof SqliteWorkspace, 'VALIDATION_ERROR', 'SqliteWorkspace is required.');
    this.#workspace = workspace;
    this.#faultInjector = faultInjector;
  }

  get isLive() { return this.#workspace.isWriter; }

  deriveCandidateChild({ identity, request, policy, now }) {
    return this.#workspace.transaction((database) => {
      const existing = replay(database, identity);
      if (existing) return { ...existing, replayed: true };
      const parentRow = taskRow(database, identity.projectId, identity.parentTaskId);
      invariant(parentRow, 'TASK_NOT_FOUND', 'The bound parent task does not exist.');
      invariant(!relationForTask(database, identity.projectId, identity.parentTaskId),
        'CHILD_DERIVATION_DEPTH_EXCEEDED', 'A derived child cannot derive another child.');
      invariant(!database.prepare(`
        SELECT 1 FROM derived_task_relations WHERE project_id = ? AND parent_task_id = ? LIMIT 1
      `).get(identity.projectId, identity.parentTaskId),
      'CHILD_DERIVATION_ALREADY_EXISTS', 'The first bounded derivation slice permits one child per human-rooted parent.');
      const parentTask = mapTask(parentRow);
      invariant(parentRow.state === 'ACTIVE', parentRow.state === 'PAUSED' ? 'TASK_PAUSED' : 'TASK_NOT_EXECUTABLE',
        'Only an active parent task can derive a child.', { state: parentRow.state });
      invariant(Date.parse(parentRow.expires_at) > Date.parse(now), 'TASK_EXPIRED', 'The parent task has expired.');
      invariant(parentRow.project_id === identity.projectId
        && parentRow.task_id === identity.parentTaskId
        && parentRow.branch_id === identity.parentBranchId
        && parentRow.grant_id === identity.parentGrantId
        && parentRow.agent_id === identity.actorId,
      'DERIVED_CHILD_CONTEXT_MISMATCH', 'Trusted parent coordinates do not match the durable task.');
      invariant(parentRow.branch_id !== 'branch.main', 'DERIVED_CHILD_MAIN_FORBIDDEN', 'A child cannot derive from main.');
      invariant(Number(parentRow.head_revision) === request.expectedParentHeadRevision,
        'REVISION_CONFLICT', 'The parent branch head changed before child derivation.');
      assertCandidateChildAttenuation(parentTask);
      const parentDocument = parseJson(parentRow.head_document_json, 'agent_tasks.head_document_json');
      const parentHead = parentDocument.revisions?.at(-1);
      invariant(parentHead?.number === Number(parentRow.head_revision),
        'CORRUPT_DERIVED_CHILD_TASK', 'The parent branch head does not close.');
      const parentGrant = grantFromHead(parentHead, identity.parentGrantId);
      const parentGrantRow = activeGrantRow(database, identity.projectId, identity.parentGrantId);
      requireActiveGrant(parentGrant, parentGrantRow, parentTask, now);
      assertHumanRooted(database, parentRow, parentTask, parentDocument, parentGrantRow);
      invariant(fingerprint(parentTask.capabilities) === fingerprint(parentGrant.scopes)
        && fingerprint(parentTask.objectScopes) === fingerprint(parentGrant.objectScopes)
        && fingerprint(parentTask.budget) === fingerprint(parentGrant.budget)
        && fingerprint(parentTask.usage) === fingerprint(parentGrant.usage),
      'CORRUPT_DERIVED_CHILD_TASK', 'Parent task and branch grant authority differ.');
      const requestedExpiry = new Date(Date.parse(now) + (policy.ttlSeconds * 1000)).toISOString();
      const expiresAt = new Date(Math.min(
        ...[requestedExpiry, parentTask.expiresAt, parentGrant.expiresAt]
          .filter(Boolean)
          .map((value) => Date.parse(value)),
      )).toISOString();
      invariant(Date.parse(expiresAt) > Date.parse(now), 'TASK_EXPIRED', 'The derived child would already be expired.');
      const childBudget = policy.budget;
      const parentNextUsage = assertBudgetReservationFits(parentGrant.usage, childBudget, parentGrant.budget);
      const parentReserved = addBudgetUsage(
        parentTask.reservedForChildren ?? zeroTaskBudgetUsage(),
        childBudget,
      );
      this.#faultInjector?.('after_child_reservation_admission');

      const childGrant = {
        id: identity.childGrantId,
        agentId: identity.actorId,
        taskId: identity.childTaskId,
        branchId: identity.childBranchId,
        scopes: [...candidateChildCapabilities()],
        objectScopes: clone(parentTask.objectScopes),
        budget: clone(childBudget),
        usage: zeroTaskBudgetUsage(),
        issuedAt: now,
        issuedBy: 'studio.trusted-service',
        expiresAt,
        revokedAt: null,
        revokeReason: null,
        status: 'ACTIVE',
      };
      const parentSnapshot = clone(parentHead.snapshot);
      const parentGrantIndex = parentSnapshot.grants.findIndex(({ id }) => id === identity.parentGrantId);
      invariant(parentGrantIndex >= 0, 'GRANT_NOT_FOUND', 'The parent branch lost its grant.');
      parentSnapshot.grants[parentGrantIndex] = { ...parentSnapshot.grants[parentGrantIndex], usage: parentNextUsage };
      invariant(!parentSnapshot.grants.some(({ id }) => id === childGrant.id),
        'ENTITY_EXISTS', 'The generated child grant already exists.');
      parentSnapshot.grants.push(clone(childGrant));
      parentSnapshot.grants.sort((left, right) => left.id.localeCompare(right.id));
      const parentNextRevision = Number(parentRow.head_revision) + 1;
      const commandCore = {
        schemaVersion: 1,
        commandId: `task-child-derive:${identity.idempotencyKeyHash}`,
        idempotencyKey: `task-child-derive:${identity.idempotencyKeyHash}`,
        type: 'task.child.derive',
        actor: { id: identity.actorId, kind: 'agent' },
        taskId: identity.parentTaskId,
        grantId: identity.parentGrantId,
        branchId: identity.parentBranchId,
        payload: {
          childTaskId: identity.childTaskId,
          childBranchId: identity.childBranchId,
          reservationFingerprint: fingerprint(childBudget),
        },
      };
      const parentRevision = {
        id: `revision:${parentNextRevision}`,
        number: parentNextRevision,
        parentRevision: Number(parentRow.head_revision),
        committedAt: now,
        command: { ...commandCore, fingerprint: fingerprint(commandCore) },
        snapshot: parentSnapshot,
        result: { childTaskId: identity.childTaskId, childBranchId: identity.childBranchId },
        event: {
          id: `activity:${commandCore.commandId}`,
          projectId: identity.projectId,
          revision: parentNextRevision,
          occurredAt: now,
          actor: { id: identity.actorId, kind: 'agent' },
          taskId: identity.parentTaskId,
          branchId: identity.parentBranchId,
          commandId: commandCore.commandId,
          commandType: commandCore.type,
          status: 'committed',
          summary: 'Studio derived one restricted child task and reserved its authority.',
          changes: [],
        },
      };
      const parentNextDocument = {
        ...parentDocument,
        revisions: [...parentDocument.revisions, clone(parentRevision)],
      };
      const parentNextTask = {
        ...parentTask,
        usage: parentNextUsage,
        reservedForChildren: parentReserved,
        headRevision: parentNextRevision,
        updatedAt: now,
      };
      const childTask = {
        schemaVersion: 1,
        taskId: identity.childTaskId,
        projectId: identity.projectId,
        branchId: identity.childBranchId,
        agentId: identity.actorId,
        title: request.title,
        objective: request.objective,
        baseRevision: parentNextRevision,
        capabilities: [...candidateChildCapabilities()],
        objectScopes: clone(parentTask.objectScopes),
        budget: clone(childBudget),
        usage: zeroTaskBudgetUsage(),
        reservedForChildren: zeroTaskBudgetUsage(),
        expiresAt,
        autoAcceptPolicy: { enabled: false, allowedCommandTypes: [], maxChanges: 0 },
        state: 'ACTIVE',
        grantId: identity.childGrantId,
        headRevision: parentNextRevision,
        createdAt: now,
        updatedAt: now,
        stateReason: null,
        derivation: {
          kind: 'TRUSTED_SERVICE_CHILD',
          parentTaskId: identity.parentTaskId,
          rootTaskId: identity.parentTaskId,
          parentBranchId: identity.parentBranchId,
          parentHeadRevision: parentNextRevision,
          parentHeadFingerprint: fingerprint(parentRevision),
          furtherChildDerivation: 'NOT_AUTHORIZED',
        },
      };

      database.prepare(`
        INSERT INTO grants(
          project_id, grant_id, agent_id, task_id, scopes_json, issued_at, issued_by,
          expires_at, revoked_at, revoke_reason, authorization_status, branch_id,
          object_scopes_json, budget_json, usage_json, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'ACTIVE', ?, ?, ?, ?, 'ACTIVE')
      `).run(
        identity.projectId, childGrant.id, childGrant.agentId, childGrant.taskId,
        JSON.stringify(childGrant.scopes), now, childGrant.issuedBy, childGrant.expiresAt,
        childGrant.branchId, JSON.stringify(childGrant.objectScopes),
        JSON.stringify(childGrant.budget), JSON.stringify(childGrant.usage),
      );
      this.#faultInjector?.('after_child_grant_insert');
      database.prepare(`
        INSERT INTO task_branch_revisions(
          project_id, task_id, branch_id, branch_revision, revision_id, command_id,
          idempotency_key, command_type, committed_at, revision_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'task.child.derive', ?, ?)
      `).run(
        identity.projectId, identity.parentTaskId, identity.parentBranchId,
        parentNextRevision, parentRevision.id, commandCore.commandId,
        commandCore.idempotencyKey, now, JSON.stringify(parentRevision),
      );
      this.#faultInjector?.('after_parent_branch_revision_insert');
      const parentUpdate = database.prepare(`
        UPDATE agent_tasks
        SET head_revision = ?, updated_at = ?, task_json = ?, head_document_json = ?
        WHERE project_id = ? AND task_id = ? AND head_revision = ? AND state = 'ACTIVE'
      `).run(
        parentNextRevision, now, JSON.stringify(parentNextTask), JSON.stringify(parentNextDocument),
        identity.projectId, identity.parentTaskId, Number(parentRow.head_revision),
      );
      invariant(Number(parentUpdate.changes) === 1, 'REVISION_CONFLICT', 'The parent task changed during child derivation.');
      this.#faultInjector?.('after_parent_derivation_revision');
      database.prepare(`
        INSERT INTO agent_tasks(
          project_id, task_id, branch_id, agent_id, grant_id, base_revision, head_revision,
          state, expires_at, created_at, updated_at, task_json, base_document_json,
          head_document_json, branch_origin_revision
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, ?)
      `).run(
        identity.projectId, childTask.taskId, childTask.branchId, childTask.agentId,
        childTask.grantId, Number(parentRow.base_revision), parentNextRevision,
        childTask.expiresAt, now, now, JSON.stringify(childTask),
        JSON.stringify(parentNextDocument), JSON.stringify(parentNextDocument), parentNextRevision,
      );
      this.#faultInjector?.('after_child_task_insert');
      const relation = {
        schemaVersion: 1,
        kind: 'studio.derived-child-task-relation',
        projectId: identity.projectId,
        childTaskId: identity.childTaskId,
        parentTaskId: identity.parentTaskId,
        rootTaskId: identity.parentTaskId,
        childGrantId: identity.childGrantId,
        parentGrantId: identity.parentGrantId,
        parentHeadRevision: parentNextRevision,
        parentHeadFingerprint: fingerprint(parentRevision),
        reservation: clone(childBudget),
        createdAt: now,
      };
      const result = {
        schemaVersion: 1,
        kind: 'studio.derived-child-task-result',
        task: clone(childTask),
        relation: clone(relation),
        replayed: false,
      };
      database.prepare(`
        INSERT INTO derived_task_relations(
          project_id, child_task_id, parent_task_id, root_task_id, child_grant_id,
          parent_grant_id, parent_head_revision, parent_head_fingerprint,
          idempotency_key_hash, request_fingerprint, reservation_json, created_at,
          relation_json, result_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        identity.projectId, identity.childTaskId, identity.parentTaskId, identity.parentTaskId,
        identity.childGrantId, identity.parentGrantId, parentNextRevision,
        relation.parentHeadFingerprint, identity.idempotencyKeyHash, identity.requestFingerprint,
        JSON.stringify(childBudget), now, JSON.stringify(relation), JSON.stringify(result),
      );
      this.#faultInjector?.('after_child_relation_insert');
      appendTimeline(database, identity.projectId, identity.parentTaskId, {
        eventId: `task-event:${identity.parentTaskId}:child:${identity.childTaskId}`,
        occurredAt: now,
        type: 'CHILD_TASK_DERIVED',
        actorId: identity.actorId,
        state: 'ACTIVE',
        branchRevision: parentNextRevision,
        details: { childTaskId: identity.childTaskId, childBranchId: identity.childBranchId, reservation: clone(childBudget) },
      });
      this.#faultInjector?.('after_parent_timeline_insert');
      appendTimeline(database, identity.projectId, identity.childTaskId, {
        eventId: `task-event:${identity.childTaskId}:derived`,
        occurredAt: now,
        type: 'TASK_DERIVED',
        actorId: 'studio.trusted-service',
        state: 'ACTIVE',
        branchRevision: parentNextRevision,
        details: { parentTaskId: identity.parentTaskId, parentHeadRevision: parentNextRevision },
      });
      this.#faultInjector?.('after_child_timeline_insert');
      this.#faultInjector?.('before_child_derivation_commit');
      return result;
    });
  }
}
