import { invariant } from '../../../domain/src/errors.js';
import { SqliteWorkspace } from './sqlite-workspace.js';

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function safeOptionalId(value, field) {
  if (value === null || value === undefined) return null;
  invariant(ID_PATTERN.test(value), 'VALIDATION_ERROR', `${field} must be a valid ID.`);
  return value;
}

function projection(row) {
  return {
    schemaVersion: 1,
    attemptId: row.attempt_id,
    projectId: row.project_id,
    correlationId: row.correlation_id,
    actor: { kind: 'agent', id: row.actor_id },
    taskId: row.task_id,
    branchId: row.branch_id,
    commandId: row.command_id,
    commandType: row.command_type,
    target: { kind: row.target_kind, id: row.target_id },
    observedRevision: Number(row.observed_revision),
    status: row.status,
    errorCode: row.error_code,
    details: JSON.parse(row.redacted_details_json),
    occurredAt: row.occurred_at,
  };
}

function allowlistedDetails(details) {
  const allowedKeys = new Set([
    'requiredScope', 'state', 'expectedRevision', 'actualRevision', 'commandType',
  ]);
  return Object.fromEntries(Object.entries(details)
    .filter(([key, value]) => allowedKeys.has(key)
      && (value === null || ['string', 'number', 'boolean'].includes(typeof value)))
    .map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 160) : value]));
}

export class SqliteAgentAttemptStore {
  #workspace;

  constructor({ workspace }) {
    invariant(workspace instanceof SqliteWorkspace, 'VALIDATION_ERROR', 'SqliteWorkspace is required.');
    this.#workspace = workspace;
  }

  get isLive() { return true; }

  recordFailure({
    attemptId,
    projectId,
    correlationId,
    actorId,
    taskId = null,
    branchId,
    commandId = null,
    commandType = 'unknown',
    targetKind = 'project',
    targetId,
    observedRevision,
    status,
    errorCode,
    details = {},
    occurredAt = new Date().toISOString(),
  }) {
    for (const [field, value] of Object.entries({ attemptId, projectId, correlationId, actorId, branchId, targetId })) {
      invariant(ID_PATTERN.test(value), 'VALIDATION_ERROR', `${field} must be a valid ID.`);
    }
    invariant(targetKind === 'project', 'VALIDATION_ERROR', 'Only a safe project target may be stored.');
    invariant(['DENIED', 'FAILED'].includes(status), 'VALIDATION_ERROR', 'Only final denied or failed attempts may be stored.');
    invariant(typeof errorCode === 'string' && /^[A-Z][A-Z0-9_]{0,99}$/.test(errorCode), 'VALIDATION_ERROR', 'A safe errorCode is required.');
    invariant(Number.isInteger(observedRevision) && observedRevision >= 0, 'VALIDATION_ERROR', 'A valid observedRevision is required.');
    invariant(details && !Array.isArray(details) && typeof details === 'object', 'VALIDATION_ERROR', 'Attempt details must be an object.');
    this.#workspace.transaction((database) => {
      database.prepare(`
        INSERT INTO agent_attempts(
          attempt_id, project_id, correlation_id, actor_id, task_id, branch_id,
          command_id, command_type, target_kind, target_id, observed_revision,
          status, error_code, redacted_details_json, occurred_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        attemptId, projectId, correlationId, actorId,
        safeOptionalId(taskId, 'taskId'), branchId, safeOptionalId(commandId, 'commandId'),
        typeof commandType === 'string' ? commandType.slice(0, 100) : 'unknown',
        targetKind, targetId, observedRevision, status, errorCode,
        JSON.stringify(allowlistedDetails(details)), occurredAt,
      );
    });
    return this.get(attemptId);
  }

  get(attemptId) {
    const row = this.#workspace.database.prepare('SELECT * FROM agent_attempts WHERE attempt_id = ?').get(attemptId);
    return row ? projection(row) : null;
  }

  listForProject(projectId, { afterRevision = 0 } = {}) {
    invariant(ID_PATTERN.test(projectId), 'VALIDATION_ERROR', 'A valid projectId is required.');
    invariant(Number.isInteger(afterRevision) && afterRevision >= 0, 'VALIDATION_ERROR', 'afterRevision must be non-negative.');
    return this.#workspace.database.prepare(`
      SELECT * FROM agent_attempts
      WHERE project_id = ? AND observed_revision >= ?
      ORDER BY occurred_at, attempt_id
    `).all(projectId, afterRevision).map(projection);
  }
}
