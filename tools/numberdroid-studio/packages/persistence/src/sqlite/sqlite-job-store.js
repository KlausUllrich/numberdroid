import { fingerprint } from '../../../application/src/value-utils.js';
import { MAX_ATLAS_JOB_ATTEMPTS, canonicalRgbaPngByteSize } from '../../../domain/src/atlas-definition.js';
import { StudioError, invariant } from '../../../domain/src/errors.js';
import { insertAuthorizedAgentAttempt } from './sqlite-agent-attempt-store.js';
import { SqliteWorkspace } from './sqlite-workspace.js';

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const STATES = Object.freeze(['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'DISCARDED', 'APPLIED']);
const TERMINAL_STATES = new Set(['SUCCEEDED', 'FAILED', 'CANCELLED', 'DISCARDED', 'APPLIED']);
const MAX_INPUT_BYTES = 256 * 1024;
const MAX_DETAILS_BYTES = 1024 * 1024;

function requireId(value, field) {
  invariant(typeof value === 'string' && ID_PATTERN.test(value), 'VALIDATION_ERROR', `${field} must be a valid ID.`);
  return value;
}

function requireTimestamp(value, field) {
  invariant(
    typeof value === 'string' && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value,
    'VALIDATION_ERROR',
    `${field} must be a canonical ISO date-time.`,
  );
  return value;
}

function requireInteger(value, field, { min = 0 } = {}) {
  invariant(Number.isSafeInteger(value) && value >= min, 'VALIDATION_ERROR', `${field} must be a safe integer >= ${min}.`);
  return value;
}

function requireJsonRecord(value, field, maxBytes = MAX_DETAILS_BYTES) {
  invariant(value !== null && typeof value === 'object' && !Array.isArray(value), 'VALIDATION_ERROR', `${field} must be an object.`);
  let json;
  try { json = JSON.stringify(value); } catch {
    invariant(false, 'VALIDATION_ERROR', `${field} must be JSON serializable.`);
  }
  invariant(json !== undefined && Buffer.byteLength(json, 'utf8') <= maxBytes, 'VALIDATION_ERROR', `${field} is too large.`);
  return { value: JSON.parse(json), json };
}

function requireOutputs(value) {
  invariant(Array.isArray(value) && value.length <= 64, 'VALIDATION_ERROR', 'outputs must be an array of at most 64 artifacts.');
  const seen = new Set();
  const normalized = value.map((candidate, index) => {
    invariant(candidate !== null && typeof candidate === 'object' && !Array.isArray(candidate), 'VALIDATION_ERROR', `outputs[${index}] must be an object.`);
    const rectangleId = requireId(candidate.rectangleId, `outputs[${index}].rectangleId`);
    invariant(!seen.has(rectangleId), 'VALIDATION_ERROR', 'outputs rectangleId values must be unique.');
    seen.add(rectangleId);
    invariant(FINGERPRINT_PATTERN.test(candidate.digest), 'VALIDATION_ERROR', `outputs[${index}].digest must be lowercase SHA-256 hex.`);
    invariant(candidate.mediaType === 'image/png', 'VALIDATION_ERROR', `outputs[${index}].mediaType must be image/png.`);
    return {
      rectangleId,
      digest: candidate.digest,
      mediaType: candidate.mediaType,
      byteSize: requireInteger(candidate.byteSize, `outputs[${index}].byteSize`, { min: 1 }),
      width: requireInteger(candidate.width, `outputs[${index}].width`, { min: 1 }),
      height: requireInteger(candidate.height, `outputs[${index}].height`, { min: 1 }),
    };
  });
  const json = JSON.stringify(normalized);
  invariant(Buffer.byteLength(json, 'utf8') <= MAX_DETAILS_BYTES, 'VALIDATION_ERROR', 'outputs is too large.');
  return { value: normalized, json };
}

function parseJson(value, fallback = null) {
  return value === null ? fallback : JSON.parse(value);
}

function jobProjection(row) {
  if (!row) return null;
  return {
    schemaVersion: 1,
    projectId: row.project_id,
    jobId: row.job_id,
    kind: row.job_kind,
    inputRevision: Number(row.input_revision),
    atlasId: row.atlas_id,
    sourceId: row.source_id,
    creator: {
      actor: { kind: row.creator_actor_kind, id: row.creator_actor_id },
      taskId: row.creator_task_id,
      branchId: row.creator_branch_id,
      grantId: row.creator_grant_id,
    },
    outputArtifactBytes: Number(row.output_artifact_bytes),
    inputFingerprint: row.input_fingerprint,
    idempotencyKey: row.idempotency_key,
    input: parseJson(row.input_json, {}),
    state: row.state,
    attempt: Number(row.attempt),
    progress: { current: Number(row.progress_current), total: Number(row.progress_total) },
    cancelRequested: Boolean(row.cancel_requested),
    lease: row.lease_owner === null ? null : { owner: row.lease_owner, expiresAt: row.lease_expires_at },
    outputs: parseJson(row.output_json),
    result: parseJson(row.result_json),
    error: parseJson(row.error_json),
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    updatedAt: row.updated_at,
    appliedRevision: row.applied_revision === null ? null : Number(row.applied_revision),
  };
}

function requireCreator(value) {
  invariant(value && typeof value === 'object' && !Array.isArray(value), 'VALIDATION_ERROR', 'creator is required.');
  invariant(value.actor && ['human', 'agent'].includes(value.actor.kind), 'VALIDATION_ERROR', 'creator.actor is invalid.');
  const actorId = requireId(value.actor.id, 'creator.actor.id');
  const branchId = requireId(value.branchId, 'creator.branchId');
  if (value.actor.kind === 'human') {
    invariant(value.taskId === null && value.grantId === null, 'VALIDATION_ERROR', 'Human jobs cannot carry task or grant authority.');
    return { actorKind: 'human', actorId, taskId: null, branchId, grantId: null };
  }
  return {
    actorKind: 'agent',
    actorId,
    taskId: requireId(value.taskId, 'creator.taskId'),
    branchId,
    grantId: requireId(value.grantId, 'creator.grantId'),
  };
}

function executionAuthorityError(database, row, now) {
  if (row.creator_actor_kind === 'human') return null;
  const grant = database.prepare(`
    SELECT agent_id, task_id, branch_id, scopes_json, object_scopes_json,
      expires_at, revoked_at, authorization_status, status
    FROM grants WHERE project_id = ? AND grant_id = ?
  `).get(row.project_id, row.creator_grant_id);
  if (!grant) return new StudioError('GRANT_NOT_FOUND', 'The originating job grant no longer exists.');
  if (grant.revoked_at || grant.status === 'REVOKED' || grant.authorization_status === 'REVOKED') {
    return new StudioError('GRANT_REVOKED', 'The originating job grant has been revoked.');
  }
  if ((grant.expires_at && Date.parse(grant.expires_at) <= Date.parse(now))
    || grant.status === 'EXPIRED' || grant.authorization_status === 'EXPIRED') {
    return new StudioError('GRANT_EXPIRED', 'The originating job grant has expired.');
  }
  let scopes;
  let objectScopes;
  try {
    scopes = JSON.parse(grant.scopes_json);
    objectScopes = JSON.parse(grant.object_scopes_json);
  } catch {
    return new StudioError('GRANT_NOT_FOUND', 'The originating job grant is unavailable.');
  }
  if (grant.agent_id !== row.creator_actor_id || grant.task_id !== row.creator_task_id
    || grant.branch_id !== row.creator_branch_id) {
    return new StudioError('JOB_AUTHORITY_MISMATCH', 'The originating job authority no longer matches its immutable binding.');
  }
  if (!scopes.includes('atlas.write')) return new StudioError('GRANT_SCOPE_MISSING', 'The originating job grant no longer allows atlas work.');
  if (!objectScopes.some((scope) => scope.kind === 'project' && scope.id === row.project_id)) {
    return new StudioError('OBJECT_SCOPE_DENIED', 'The originating job grant no longer covers this project.');
  }
  return null;
}

function assertExecutionAuthority(database, row, now) {
  const error = executionAuthorityError(database, row, now);
  if (error) throw error;
}

function recordAuthorized(database, authorizedAttempt) {
  if (authorizedAttempt) insertAuthorizedAgentAttempt(database, authorizedAttempt);
}

function assertAuthorizedAttemptOrigin(row, authorizedAttempt) {
  if (!authorizedAttempt) return;
  invariant(
    row.creator_actor_kind === 'agent'
      && authorizedAttempt.projectId === row.project_id
      && authorizedAttempt.actorId === row.creator_actor_id
      && authorizedAttempt.taskId === row.creator_task_id
      && authorizedAttempt.branchId === row.creator_branch_id
      && authorizedAttempt.targetKind === 'job'
      && authorizedAttempt.targetId === row.job_id,
    'JOB_AUTHORITY_MISMATCH',
    'The authorized attempt does not match the immutable job origin.',
  );
}

function releaseJobOutputs(database, projectId, jobId) {
  database.prepare(`
    DELETE FROM artifact_references
    WHERE project_id = ? AND owner_kind = 'job_output' AND owner_id = ?
  `).run(projectId, jobId);
}

function eventProjection(row) {
  return {
    schemaVersion: 1,
    projectId: row.project_id,
    jobId: row.job_id,
    sequence: Number(row.event_sequence),
    attempt: Number(row.attempt),
    type: row.event_type,
    state: row.state,
    safePoint: row.safe_point,
    progress: { current: Number(row.progress_current), total: Number(row.progress_total) },
    operationIdempotencyKey: row.operation_idempotency_key,
    details: parseJson(row.details_json, {}),
    occurredAt: row.occurred_at,
  };
}

function nextSequence(database, projectId, jobId) {
  const row = database.prepare(`
    SELECT coalesce(max(event_sequence), 0) + 1 AS next_sequence
    FROM job_events WHERE project_id = ? AND job_id = ?
  `).get(projectId, jobId);
  return Number(row.next_sequence);
}

function insertEvent(database, row, {
  type,
  occurredAt,
  safePoint = null,
  operationIdempotencyKey = null,
  details = {},
}) {
  const detailRecord = requireJsonRecord(details, 'details');
  database.prepare(`
    INSERT INTO job_events(
      project_id, job_id, event_sequence, attempt, event_type, state,
      safe_point, progress_current, progress_total, operation_idempotency_key,
      details_json, occurred_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    row.project_id,
    row.job_id,
    nextSequence(database, row.project_id, row.job_id),
    row.attempt,
    type,
    row.state,
    safePoint,
    row.progress_current,
    row.progress_total,
    operationIdempotencyKey,
    detailRecord.json,
    occurredAt,
  );
}

function existingOperation(database, projectId, operationIdempotencyKey) {
  if (operationIdempotencyKey === null) return null;
  return database.prepare(`
    SELECT * FROM job_events
    WHERE project_id = ? AND operation_idempotency_key = ?
  `).get(projectId, operationIdempotencyKey);
}

function replayedOperation(database, projectId, jobId, operationIdempotencyKey, allowedTypes) {
  const event = existingOperation(database, projectId, operationIdempotencyKey);
  if (!event) return null;
  invariant(
    event.job_id === jobId && allowedTypes.includes(event.event_type),
    'IDEMPOTENCY_CONFLICT',
    'The job operation idempotency key was already used for another operation.',
    { projectId, operationIdempotencyKey },
  );
  return { ...jobProjection(database.prepare('SELECT * FROM jobs WHERE project_id = ? AND job_id = ?').get(projectId, jobId)), replayed: true };
}

function assertWorker(row, workerId) {
  invariant(row.state === 'RUNNING', 'JOB_STATE_CONFLICT', 'The job is not running.', { state: row.state });
  invariant(row.lease_owner === workerId, 'JOB_LEASE_LOST', 'The job lease belongs to another worker.');
}

export class SqliteJobStore {
  #workspace;

  constructor({ workspace }) {
    invariant(workspace instanceof SqliteWorkspace, 'VALIDATION_ERROR', 'SqliteWorkspace is required.');
    this.#workspace = workspace;
  }

  get isLive() { return true; }

  create({
    projectId,
    jobId,
    kind = 'ATLAS_PREVIEW',
    inputRevision,
    atlasId,
    sourceId,
    creator,
    outputArtifactBytes,
    inputFingerprint,
    idempotencyKey,
    input,
    createdAt = new Date().toISOString(),
  }) {
    for (const [field, value] of Object.entries({ projectId, jobId, kind, atlasId, sourceId, idempotencyKey })) requireId(value, field);
    invariant(kind === 'ATLAS_PREVIEW', 'JOB_KIND_UNSUPPORTED', 'Checkpoint 2B supports only ATLAS_PREVIEW jobs.');
    requireInteger(inputRevision, 'inputRevision', { min: 1 });
    requireInteger(outputArtifactBytes, 'outputArtifactBytes', { min: 1 });
    requireTimestamp(createdAt, 'createdAt');
    const normalizedCreator = requireCreator(creator);
    invariant(FINGERPRINT_PATTERN.test(inputFingerprint), 'VALIDATION_ERROR', 'inputFingerprint must be lowercase SHA-256 hex.');
    const inputRecord = requireJsonRecord(input, 'input', MAX_INPUT_BYTES);
    invariant(fingerprint(inputRecord.value) === inputFingerprint, 'JOB_INPUT_FINGERPRINT_MISMATCH', 'The supplied input fingerprint is not canonical for the input.');
    return this.#workspace.transaction((database) => {
      const existing = database.prepare('SELECT * FROM jobs WHERE project_id = ? AND idempotency_key = ?').get(projectId, idempotencyKey);
      if (existing) {
        invariant(
          existing.input_fingerprint === inputFingerprint
            && existing.job_kind === kind
            && existing.atlas_id === atlasId
            && existing.source_id === sourceId
            && Number(existing.input_revision) === inputRevision
            && existing.creator_actor_kind === normalizedCreator.actorKind
            && existing.creator_actor_id === normalizedCreator.actorId
            && existing.creator_task_id === normalizedCreator.taskId
            && existing.creator_branch_id === normalizedCreator.branchId
            && existing.creator_grant_id === normalizedCreator.grantId
            && Number(existing.output_artifact_bytes) === outputArtifactBytes,
          'IDEMPOTENCY_CONFLICT',
          'The job idempotency key was already used for different input.',
          { projectId, idempotencyKey, jobId: existing.job_id },
        );
        return { ...jobProjection(existing), replayed: true };
      }
      const project = database.prepare('SELECT head_revision FROM projects WHERE project_id = ?').get(projectId);
      invariant(project, 'PROJECT_NOT_FOUND', 'The project does not exist.', { projectId });
      const revision = database.prepare(`
        SELECT 1 FROM revisions WHERE project_id = ? AND revision_number = ?
      `).get(projectId, inputRevision);
      invariant(revision, 'REVISION_NOT_FOUND', 'The job input revision does not exist.', { projectId, inputRevision });
      if (normalizedCreator.actorKind === 'agent') {
        const authorityRow = {
          project_id: projectId,
          creator_actor_kind: normalizedCreator.actorKind,
          creator_actor_id: normalizedCreator.actorId,
          creator_task_id: normalizedCreator.taskId,
          creator_branch_id: normalizedCreator.branchId,
          creator_grant_id: normalizedCreator.grantId,
        };
        assertExecutionAuthority(database, authorityRow, createdAt);
      }
      database.prepare(`
        INSERT INTO jobs(
          project_id, job_id, job_kind, input_revision, atlas_id, source_id,
          creator_actor_kind, creator_actor_id, creator_task_id, creator_branch_id,
          creator_grant_id, output_artifact_bytes,
          input_fingerprint, idempotency_key, input_json, state, attempt,
          progress_current, progress_total, cancel_requested, lease_owner,
          lease_expires_at, output_json, result_json, error_json, created_at,
          started_at, finished_at, updated_at, applied_revision
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'QUEUED', 1, 0, 0, 0,
          NULL, NULL, NULL, NULL, NULL, ?, NULL, NULL, ?, NULL)
      `).run(
        projectId, jobId, kind, inputRevision, atlasId, sourceId,
        normalizedCreator.actorKind, normalizedCreator.actorId, normalizedCreator.taskId,
        normalizedCreator.branchId, normalizedCreator.grantId, outputArtifactBytes,
        inputFingerprint, idempotencyKey, inputRecord.json, createdAt, createdAt,
      );
      this.#workspace.fault('after_job_create_insert');
      const row = database.prepare('SELECT * FROM jobs WHERE project_id = ? AND job_id = ?').get(projectId, jobId);
      insertEvent(database, row, { type: 'QUEUED', occurredAt: createdAt });
      this.#workspace.fault('after_job_create_event');
      return { ...jobProjection(row), replayed: false };
    });
  }

  start(input) {
    return this.create(input);
  }

  get(projectId, jobId) {
    requireId(projectId, 'projectId');
    requireId(jobId, 'jobId');
    return jobProjection(this.#workspace.database.prepare('SELECT * FROM jobs WHERE project_id = ? AND job_id = ?').get(projectId, jobId));
  }

  list(projectId, { state = null } = {}) {
    requireId(projectId, 'projectId');
    invariant(state === null || STATES.includes(state), 'VALIDATION_ERROR', 'Invalid job state.');
    const rows = state === null
      ? this.#workspace.database.prepare('SELECT * FROM jobs WHERE project_id = ? ORDER BY created_at, job_id').all(projectId)
      : this.#workspace.database.prepare('SELECT * FROM jobs WHERE project_id = ? AND state = ? ORDER BY created_at, job_id').all(projectId, state);
    return rows.map(jobProjection);
  }

  listForProject(projectId, options = {}) {
    return this.list(projectId, options);
  }

  listEvents(projectId, jobId) {
    requireId(projectId, 'projectId');
    requireId(jobId, 'jobId');
    return this.#workspace.database.prepare(`
      SELECT * FROM job_events
      WHERE project_id = ? AND job_id = ? ORDER BY event_sequence
    `).all(projectId, jobId).map(eventProjection);
  }

  claimNext({ workerId, leaseMs, now = new Date().toISOString() }) {
    requireId(workerId, 'workerId');
    requireInteger(leaseMs, 'leaseMs', { min: 1 });
    requireTimestamp(now, 'now');
    const leaseExpiresAt = new Date(Date.parse(now) + leaseMs).toISOString();
    return this.#workspace.transaction((database) => {
      const cancelledAfterLeaseLoss = database.prepare(`
        SELECT * FROM jobs
        WHERE state = 'RUNNING' AND cancel_requested = 1 AND lease_expires_at <= ?
        ORDER BY lease_expires_at, created_at, job_id
        LIMIT 1
      `).get(now);
      if (cancelledAfterLeaseLoss) {
        database.prepare(`
          UPDATE jobs SET state = 'CANCELLED', lease_owner = NULL,
            lease_expires_at = NULL, finished_at = ?, updated_at = ?
          WHERE project_id = ? AND job_id = ? AND state = 'RUNNING'
            AND cancel_requested = 1 AND lease_expires_at <= ?
        `).run(
          now, now, cancelledAfterLeaseLoss.project_id, cancelledAfterLeaseLoss.job_id, now,
        );
        const cancelled = database.prepare('SELECT * FROM jobs WHERE project_id = ? AND job_id = ?')
          .get(cancelledAfterLeaseLoss.project_id, cancelledAfterLeaseLoss.job_id);
        insertEvent(database, cancelled, {
          type: 'CANCELLED', occurredAt: now, safePoint: 'lease_expired_after_cancel',
          details: { abandonedAttempt: Number(cancelledAfterLeaseLoss.attempt) },
        });
        releaseJobOutputs(database, cancelled.project_id, cancelled.job_id);
        this.#workspace.fault('after_job_cancel_recovery_event');
      }
      while (true) {
        const candidate = database.prepare(`
          SELECT * FROM jobs
          WHERE cancel_requested = 0
            AND job_kind = 'ATLAS_PREVIEW'
            AND (state = 'QUEUED' OR (state = 'RUNNING' AND lease_expires_at <= ?))
          ORDER BY CASE state WHEN 'RUNNING' THEN 0 ELSE 1 END, created_at, job_id
          LIMIT 1
        `).get(now);
        if (!candidate) return null;
        const recovering = candidate.state === 'RUNNING';
        const authorityError = executionAuthorityError(database, candidate, now);
        const attemptExhausted = recovering && Number(candidate.attempt) >= MAX_ATLAS_JOB_ATTEMPTS;
        if (authorityError || attemptExhausted) {
          const error = authorityError ?? new StudioError('JOB_ATTEMPT_LIMIT', `Atlas jobs are limited to ${MAX_ATLAS_JOB_ATTEMPTS} attempts.`);
          database.prepare(`
            UPDATE jobs SET state = 'FAILED', lease_owner = NULL, lease_expires_at = NULL,
              error_json = ?, finished_at = ?, updated_at = ?
            WHERE project_id = ? AND job_id = ?
          `).run(JSON.stringify({ code: error.code, message: error.message }), now, now, candidate.project_id, candidate.job_id);
          const failed = database.prepare('SELECT * FROM jobs WHERE project_id = ? AND job_id = ?')
            .get(candidate.project_id, candidate.job_id);
          releaseJobOutputs(database, failed.project_id, failed.job_id);
          insertEvent(database, failed, {
            type: 'FAILED', occurredAt: now, safePoint: 'authority_preclaim',
            details: { error: { code: error.code, message: error.message } },
          });
          this.#workspace.fault('after_job_preclaim_failure');
          continue;
        }
        const attempt = Number(candidate.attempt) + (recovering ? 1 : 0);
        const updated = database.prepare(`
          UPDATE jobs
          SET state = 'RUNNING', attempt = ?, lease_owner = ?, lease_expires_at = ?,
            started_at = coalesce(started_at, ?), updated_at = ?, progress_current = 0,
            output_json = NULL, result_json = NULL, error_json = NULL
          WHERE project_id = ? AND job_id = ?
            AND (state = 'QUEUED' OR (state = 'RUNNING' AND lease_expires_at <= ?))
        `).run(attempt, workerId, leaseExpiresAt, now, now, candidate.project_id, candidate.job_id, now);
        invariant(Number(updated.changes) === 1, 'JOB_CLAIM_CONFLICT', 'The job changed before it could be claimed.');
        const row = database.prepare('SELECT * FROM jobs WHERE project_id = ? AND job_id = ?').get(candidate.project_id, candidate.job_id);
        insertEvent(database, row, {
          type: recovering ? 'RECOVERED' : 'RUNNING',
          occurredAt: now,
          safePoint: 'claimed',
          details: recovering ? { recoveredAttempt: Number(candidate.attempt) } : {},
        });
        this.#workspace.fault('after_job_claim_event');
        return { ...jobProjection(row), recovered: recovering };
      }
    });
  }

  assertExecutionAuthority(projectId, jobId, { workerId, now = new Date().toISOString() }) {
    for (const [field, value] of Object.entries({ projectId, jobId, workerId })) requireId(value, field);
    requireTimestamp(now, 'now');
    return this.#workspace.transaction((database) => {
      const row = database.prepare('SELECT * FROM jobs WHERE project_id = ? AND job_id = ?').get(projectId, jobId);
      invariant(row, 'JOB_NOT_FOUND', 'The job does not exist.', { projectId, jobId });
      assertWorker(row, workerId);
      assertExecutionAuthority(database, row, now);
      return jobProjection(row);
    });
  }

  updateProgress(projectId, jobId, {
    workerId,
    current,
    total,
    safePoint,
    leaseMs,
    now = new Date().toISOString(),
  }) {
    for (const [field, value] of Object.entries({ projectId, jobId, workerId, safePoint })) requireId(value, field);
    requireInteger(current, 'current');
    requireInteger(total, 'total');
    requireInteger(leaseMs, 'leaseMs', { min: 1 });
    invariant(current <= total, 'VALIDATION_ERROR', 'Progress current cannot exceed total.');
    requireTimestamp(now, 'now');
    return this.#workspace.transaction((database) => {
      const row = database.prepare('SELECT * FROM jobs WHERE project_id = ? AND job_id = ?').get(projectId, jobId);
      invariant(row, 'JOB_NOT_FOUND', 'The job does not exist.', { projectId, jobId });
      assertWorker(row, workerId);
      assertExecutionAuthority(database, row, now);
      database.prepare(`
        UPDATE jobs SET progress_current = ?, progress_total = ?, lease_expires_at = ?, updated_at = ?
        WHERE project_id = ? AND job_id = ?
      `).run(current, total, new Date(Date.parse(now) + leaseMs).toISOString(), now, projectId, jobId);
      const updated = database.prepare('SELECT * FROM jobs WHERE project_id = ? AND job_id = ?').get(projectId, jobId);
      insertEvent(database, updated, { type: 'PROGRESS', occurredAt: now, safePoint });
      return jobProjection(updated);
    });
  }

  publishOutput(projectId, jobId, {
    workerId,
    rectangleId,
    artifact,
    current,
    total,
    safePoint,
    leaseMs,
    now = new Date().toISOString(),
  }) {
    for (const [field, value] of Object.entries({ projectId, jobId, workerId, rectangleId, safePoint })) requireId(value, field);
    requireInteger(current, 'current', { min: 1 });
    requireInteger(total, 'total', { min: 1 });
    requireInteger(leaseMs, 'leaseMs', { min: 1 });
    invariant(current <= total, 'VALIDATION_ERROR', 'Progress current cannot exceed total.');
    requireTimestamp(now, 'now');
    invariant(artifact && typeof artifact === 'object' && !Array.isArray(artifact), 'VALIDATION_ERROR', 'Artifact metadata is required.');
    invariant(FINGERPRINT_PATTERN.test(artifact.digest), 'ARTIFACT_INVALID_DIGEST', 'Artifact digest must be lowercase SHA-256 hex.');
    invariant(artifact.uri === `studio://artifacts/sha256/${artifact.digest}`, 'VALIDATION_ERROR', 'Artifact URI does not match its digest.');
    invariant(artifact.mediaType === 'image/png', 'ARTIFACT_UNSUPPORTED_MEDIA', 'Atlas output must be image/png.');
    requireInteger(artifact.byteSize, 'artifact.byteSize', { min: 1 });
    requireInteger(artifact.width, 'artifact.width', { min: 1 });
    requireInteger(artifact.height, 'artifact.height', { min: 1 });
    return this.#workspace.transaction((database) => {
      const row = database.prepare('SELECT * FROM jobs WHERE project_id = ? AND job_id = ?').get(projectId, jobId);
      invariant(row, 'JOB_NOT_FOUND', 'The job does not exist.', { projectId, jobId });
      assertWorker(row, workerId);
      assertExecutionAuthority(database, row, now);
      const input = parseJson(row.input_json, {});
      const rectangle = input.rectangles?.find((candidate) => candidate.rectangleId === rectangleId && candidate.included);
      invariant(rectangle, 'JOB_OUTPUT_MISMATCH', 'The output rectangle is not part of the immutable job input.', { rectangleId });
      invariant(
        artifact.width === rectangle.width && artifact.height === rectangle.height
          && artifact.byteSize === canonicalRgbaPngByteSize(rectangle.width, rectangle.height),
        'JOB_OUTPUT_MISMATCH',
        'The output artifact metadata differs from the exact canonical rectangle output.',
        { rectangleId },
      );
      database.prepare(`
        INSERT INTO artifacts(
          digest, uri, media_type, byte_size, width, height, state, created_at, verified_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'LIVE', ?, ?)
        ON CONFLICT(digest) DO NOTHING
      `).run(
        artifact.digest, artifact.uri, artifact.mediaType, artifact.byteSize,
        artifact.width, artifact.height, now, now,
      );
      const stored = database.prepare(`
        SELECT uri, media_type, byte_size, width, height, state FROM artifacts WHERE digest = ?
      `).get(artifact.digest);
      invariant(
        stored?.uri === artifact.uri && stored.media_type === artifact.mediaType
          && Number(stored.byte_size) === artifact.byteSize
          && Number(stored.width) === artifact.width && Number(stored.height) === artifact.height
          && stored.state === 'LIVE',
        'ARTIFACT_METADATA_CONFLICT',
        'Existing artifact metadata is incompatible with the worker output.',
        { digest: artifact.digest },
      );
      database.prepare(`
        INSERT OR IGNORE INTO artifact_references(
          project_id, owner_kind, owner_id, digest, created_revision
        ) VALUES (?, 'job_output', ?, ?, ?)
      `).run(projectId, jobId, artifact.digest, row.input_revision);
      database.prepare(`
        UPDATE jobs SET progress_current = ?, progress_total = ?, lease_expires_at = ?, updated_at = ?
        WHERE project_id = ? AND job_id = ?
      `).run(current, total, new Date(Date.parse(now) + leaseMs).toISOString(), now, projectId, jobId);
      const updated = database.prepare('SELECT * FROM jobs WHERE project_id = ? AND job_id = ?').get(projectId, jobId);
      insertEvent(database, updated, { type: 'PROGRESS', occurredAt: now, safePoint });
      this.#workspace.fault('after_job_output_publish');
      return jobProjection(updated);
    });
  }

  requestCancellation(projectId, jobId, {
    operationIdempotencyKey,
    now = new Date().toISOString(),
    authorizedAttempt = null,
  }) {
    for (const [field, value] of Object.entries({ projectId, jobId, operationIdempotencyKey })) requireId(value, field);
    requireTimestamp(now, 'now');
    return this.#workspace.transaction((database) => {
      const authorityRow = database.prepare('SELECT * FROM jobs WHERE project_id = ? AND job_id = ?').get(projectId, jobId);
      if (authorizedAttempt) {
        invariant(authorityRow, 'JOB_NOT_FOUND', 'The job does not exist.', { projectId, jobId });
        assertAuthorizedAttemptOrigin(authorityRow, authorizedAttempt);
        assertExecutionAuthority(database, authorityRow, now);
      }
      const replay = replayedOperation(database, projectId, jobId, operationIdempotencyKey, ['CANCELLED', 'CANCEL_REQUESTED']);
      if (replay) {
        recordAuthorized(database, authorizedAttempt);
        this.#workspace.fault('after_job_authorized_attempt_insert');
        return replay;
      }
      const row = database.prepare('SELECT * FROM jobs WHERE project_id = ? AND job_id = ?').get(projectId, jobId);
      invariant(row, 'JOB_NOT_FOUND', 'The job does not exist.', { projectId, jobId });
      invariant(!TERMINAL_STATES.has(row.state), 'JOB_STATE_CONFLICT', 'A terminal job cannot be cancelled.', { state: row.state });
      const immediate = row.state === 'QUEUED';
      if (immediate) {
        database.prepare(`
          UPDATE jobs
          SET state = 'CANCELLED', cancel_requested = 1, lease_owner = NULL,
            lease_expires_at = NULL, finished_at = ?, updated_at = ?
          WHERE project_id = ? AND job_id = ?
        `).run(now, now, projectId, jobId);
      } else {
        database.prepare(`
          UPDATE jobs SET cancel_requested = 1, updated_at = ?
          WHERE project_id = ? AND job_id = ?
        `).run(now, projectId, jobId);
      }
      const updated = database.prepare('SELECT * FROM jobs WHERE project_id = ? AND job_id = ?').get(projectId, jobId);
      insertEvent(database, updated, {
        type: immediate ? 'CANCELLED' : 'CANCEL_REQUESTED',
        occurredAt: now,
        safePoint: immediate ? 'queued' : null,
        operationIdempotencyKey,
      });
      if (immediate) releaseJobOutputs(database, projectId, jobId);
      recordAuthorized(database, authorizedAttempt);
      this.#workspace.fault('after_job_authorized_attempt_insert');
      return { ...jobProjection(updated), replayed: false };
    });
  }

  requestCancel(projectId, jobId, options) {
    return this.requestCancellation(projectId, jobId, options);
  }

  cancelAtSafePoint(projectId, jobId, {
    workerId,
    safePoint,
    operationIdempotencyKey,
    now = new Date().toISOString(),
  }) {
    for (const [field, value] of Object.entries({ projectId, jobId, workerId, safePoint, operationIdempotencyKey })) requireId(value, field);
    requireTimestamp(now, 'now');
    return this.#workspace.transaction((database) => {
      const replay = replayedOperation(database, projectId, jobId, operationIdempotencyKey, ['CANCELLED']);
      if (replay) return replay;
      const row = database.prepare('SELECT * FROM jobs WHERE project_id = ? AND job_id = ?').get(projectId, jobId);
      invariant(row, 'JOB_NOT_FOUND', 'The job does not exist.', { projectId, jobId });
      assertWorker(row, workerId);
      invariant(Boolean(row.cancel_requested), 'JOB_NOT_CANCELLABLE', 'Cancellation was not requested.');
      database.prepare(`
        UPDATE jobs SET state = 'CANCELLED', lease_owner = NULL, lease_expires_at = NULL,
          finished_at = ?, updated_at = ? WHERE project_id = ? AND job_id = ?
      `).run(now, now, projectId, jobId);
      this.#workspace.fault('after_job_transition_update');
      const updated = database.prepare('SELECT * FROM jobs WHERE project_id = ? AND job_id = ?').get(projectId, jobId);
      insertEvent(database, updated, { type: 'CANCELLED', occurredAt: now, safePoint, operationIdempotencyKey });
      releaseJobOutputs(database, projectId, jobId);
      this.#workspace.fault('after_job_transition_event');
      return { ...jobProjection(updated), replayed: false };
    });
  }

  succeed(projectId, jobId, {
    workerId,
    outputs = [],
    result = {},
    operationIdempotencyKey,
    now = new Date().toISOString(),
  }) {
    return this.#finish(projectId, jobId, {
      workerId, state: 'SUCCEEDED', outputs, result, error: null,
      operationIdempotencyKey, now,
    });
  }

  fail(projectId, jobId, {
    workerId,
    error,
    operationIdempotencyKey,
    now = new Date().toISOString(),
  }) {
    return this.#finish(projectId, jobId, {
      workerId, state: 'FAILED', outputs: null, result: null, error,
      operationIdempotencyKey, now,
    });
  }

  #finish(projectId, jobId, {
    workerId,
    state,
    outputs,
    result,
    error,
    operationIdempotencyKey,
    now,
  }) {
    for (const [field, value] of Object.entries({ projectId, jobId, workerId, operationIdempotencyKey })) requireId(value, field);
    requireTimestamp(now, 'now');
    const outputRecord = outputs === null ? null : requireOutputs(outputs);
    const resultRecord = result === null ? null : requireJsonRecord(result, 'result');
    const errorRecord = error === null ? null : requireJsonRecord(error, 'error');
    return this.#workspace.transaction((database) => {
      const replay = replayedOperation(database, projectId, jobId, operationIdempotencyKey, [state]);
      if (replay) {
        invariant(
          fingerprint(replay.outputs) === fingerprint(outputRecord?.value ?? null)
            && fingerprint(replay.result) === fingerprint(resultRecord?.value ?? null)
            && fingerprint(replay.error) === fingerprint(errorRecord?.value ?? null),
          'IDEMPOTENCY_CONFLICT',
          'The job completion idempotency key was reused with different output.',
          { projectId, jobId, operationIdempotencyKey },
        );
        return replay;
      }
      const row = database.prepare('SELECT * FROM jobs WHERE project_id = ? AND job_id = ?').get(projectId, jobId);
      invariant(row, 'JOB_NOT_FOUND', 'The job does not exist.', { projectId, jobId });
      assertWorker(row, workerId);
      invariant(!row.cancel_requested, 'JOB_CANCEL_REQUESTED', 'The job must stop at a cancellation safe point before finishing.');
      if (state === 'SUCCEEDED') {
        assertExecutionAuthority(database, row, now);
        const input = parseJson(row.input_json, {});
        const included = new Map(input.rectangles?.filter((rectangle) => rectangle.included)
          .map((rectangle) => [rectangle.rectangleId, rectangle]) ?? []);
        invariant(outputRecord.value.length === included.size, 'JOB_OUTPUT_MISMATCH', 'Succeeded outputs do not match the immutable rectangle set.');
        let outputBytes = 0;
        for (const output of outputRecord.value) {
          const rectangle = included.get(output.rectangleId);
          invariant(
            rectangle && output.mediaType === 'image/png'
              && output.width === rectangle.width && output.height === rectangle.height
              && output.byteSize === canonicalRgbaPngByteSize(rectangle.width, rectangle.height),
            'JOB_OUTPUT_MISMATCH',
            'Succeeded output metadata is not the canonical immutable rectangle output.',
            { rectangleId: output.rectangleId },
          );
          outputBytes += output.byteSize;
        }
        invariant(outputBytes === Number(row.output_artifact_bytes), 'JOB_OUTPUT_MISMATCH', 'Succeeded output bytes differ from the reserved artifact budget.');
      }
      database.prepare(`
        UPDATE jobs
        SET state = ?, lease_owner = NULL, lease_expires_at = NULL,
          output_json = ?, result_json = ?, error_json = ?, finished_at = ?, updated_at = ?
        WHERE project_id = ? AND job_id = ?
      `).run(
        state, outputRecord?.json ?? null, resultRecord?.json ?? null, errorRecord?.json ?? null,
        now, now, projectId, jobId,
      );
      this.#workspace.fault('after_job_transition_update');
      const updated = database.prepare('SELECT * FROM jobs WHERE project_id = ? AND job_id = ?').get(projectId, jobId);
      insertEvent(database, updated, {
        type: state,
        occurredAt: now,
        safePoint: 'worker_complete',
        operationIdempotencyKey,
        details: state === 'FAILED' ? { error: errorRecord.value } : {},
      });
      if (state === 'FAILED') releaseJobOutputs(database, projectId, jobId);
      this.#workspace.fault('after_job_transition_event');
      return { ...jobProjection(updated), replayed: false };
    });
  }

  retry(projectId, jobId, {
    expectedAttempt,
    operationIdempotencyKey,
    now = new Date().toISOString(),
    authorizedAttempt = null,
  }) {
    for (const [field, value] of Object.entries({ projectId, jobId, operationIdempotencyKey })) requireId(value, field);
    requireInteger(expectedAttempt, 'expectedAttempt', { min: 1 });
    requireTimestamp(now, 'now');
    return this.#workspace.transaction((database) => {
      const replay = replayedOperation(database, projectId, jobId, operationIdempotencyKey, ['RETRIED']);
      if (replay) {
        recordAuthorized(database, authorizedAttempt);
        this.#workspace.fault('after_job_authorized_attempt_insert');
        return replay;
      }
      const row = database.prepare('SELECT * FROM jobs WHERE project_id = ? AND job_id = ?').get(projectId, jobId);
      invariant(row, 'JOB_NOT_FOUND', 'The job does not exist.', { projectId, jobId });
      assertAuthorizedAttemptOrigin(row, authorizedAttempt);
      assertExecutionAuthority(database, row, now);
      invariant(['FAILED', 'CANCELLED'].includes(row.state), 'JOB_STATE_CONFLICT', 'Only failed or cancelled jobs may be retried.', { state: row.state });
      invariant(Number(row.attempt) === expectedAttempt, 'JOB_ATTEMPT_CONFLICT', 'The job attempt changed before retry.', {
        expectedAttempt,
        actualAttempt: Number(row.attempt),
      });
      const nextAttempt = expectedAttempt + 1;
      invariant(nextAttempt <= MAX_ATLAS_JOB_ATTEMPTS, 'JOB_ATTEMPT_LIMIT', `Atlas jobs are limited to ${MAX_ATLAS_JOB_ATTEMPTS} attempts.`, {
        maxAttempts: MAX_ATLAS_JOB_ATTEMPTS,
      });
      database.prepare(`
        UPDATE jobs SET state = 'QUEUED', attempt = ?, progress_current = 0,
          progress_total = 0, cancel_requested = 0, lease_owner = NULL,
          lease_expires_at = NULL, output_json = NULL, result_json = NULL,
          error_json = NULL, started_at = NULL, finished_at = NULL, updated_at = ?
        WHERE project_id = ? AND job_id = ?
      `).run(nextAttempt, now, projectId, jobId);
      this.#workspace.fault('after_job_transition_update');
      const updated = database.prepare('SELECT * FROM jobs WHERE project_id = ? AND job_id = ?').get(projectId, jobId);
      insertEvent(database, updated, {
        type: 'RETRIED', occurredAt: now, safePoint: 'operator_retry',
        operationIdempotencyKey, details: { priorAttempt: expectedAttempt },
      });
      releaseJobOutputs(database, projectId, jobId);
      recordAuthorized(database, authorizedAttempt);
      this.#workspace.fault('after_job_authorized_attempt_insert');
      this.#workspace.fault('after_job_transition_event');
      return { ...jobProjection(updated), replayed: false };
    });
  }

  discard(projectId, jobId, {
    operationIdempotencyKey,
    now = new Date().toISOString(),
    authorizedAttempt = null,
  }) {
    for (const [field, value] of Object.entries({ projectId, jobId, operationIdempotencyKey })) requireId(value, field);
    requireTimestamp(now, 'now');
    return this.#workspace.transaction((database) => {
      const authorityRow = database.prepare('SELECT * FROM jobs WHERE project_id = ? AND job_id = ?').get(projectId, jobId);
      if (authorizedAttempt) {
        invariant(authorityRow, 'JOB_NOT_FOUND', 'The job does not exist.', { projectId, jobId });
        assertAuthorizedAttemptOrigin(authorityRow, authorizedAttempt);
        assertExecutionAuthority(database, authorityRow, now);
      }
      const replay = replayedOperation(database, projectId, jobId, operationIdempotencyKey, ['DISCARDED']);
      if (replay) {
        recordAuthorized(database, authorizedAttempt);
        this.#workspace.fault('after_job_authorized_attempt_insert');
        return replay;
      }
      const row = database.prepare('SELECT * FROM jobs WHERE project_id = ? AND job_id = ?').get(projectId, jobId);
      invariant(row, 'JOB_NOT_FOUND', 'The job does not exist.', { projectId, jobId });
      invariant(row.state !== 'APPLIED', 'JOB_STATE_CONFLICT', 'An applied job cannot be discarded.', { state: row.state });
      invariant(['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(row.state), 'JOB_STATE_CONFLICT', 'Only a terminal unapplied job can be discarded.', { state: row.state });
      database.prepare(`
        UPDATE jobs SET state = 'DISCARDED', updated_at = ?
        WHERE project_id = ? AND job_id = ?
      `).run(now, projectId, jobId);
      const updated = database.prepare('SELECT * FROM jobs WHERE project_id = ? AND job_id = ?').get(projectId, jobId);
      releaseJobOutputs(database, projectId, jobId);
      insertEvent(database, updated, {
        type: 'DISCARDED', occurredAt: now, safePoint: 'operator_discard', operationIdempotencyKey,
      });
      recordAuthorized(database, authorizedAttempt);
      this.#workspace.fault('after_job_authorized_attempt_insert');
      this.#workspace.fault('after_job_transition_event');
      return { ...jobProjection(updated), replayed: false };
    });
  }

  markApplied(projectId, jobId, {
    appliedRevision,
    operationIdempotencyKey,
    now = new Date().toISOString(),
  }) {
    for (const [field, value] of Object.entries({ projectId, jobId, operationIdempotencyKey })) requireId(value, field);
    requireInteger(appliedRevision, 'appliedRevision', { min: 1 });
    requireTimestamp(now, 'now');
    return this.#workspace.transaction((database) => {
      const replay = replayedOperation(database, projectId, jobId, operationIdempotencyKey, ['APPLIED']);
      if (replay) {
        invariant(replay.appliedRevision === appliedRevision, 'IDEMPOTENCY_CONFLICT', 'The apply idempotency key was reused for another revision.');
        return replay;
      }
      const row = database.prepare('SELECT * FROM jobs WHERE project_id = ? AND job_id = ?').get(projectId, jobId);
      invariant(row, 'JOB_NOT_FOUND', 'The job does not exist.', { projectId, jobId });
      invariant(row.state === 'SUCCEEDED', 'JOB_STATE_CONFLICT', 'Only a succeeded job may be marked applied.', { state: row.state });
      const revision = database.prepare('SELECT 1 FROM revisions WHERE project_id = ? AND revision_number = ?').get(projectId, appliedRevision);
      invariant(revision, 'REVISION_NOT_FOUND', 'The applied revision does not exist.', { projectId, appliedRevision });
      database.prepare(`
        UPDATE jobs SET state = 'APPLIED', applied_revision = ?, updated_at = ?
        WHERE project_id = ? AND job_id = ? AND state = 'SUCCEEDED'
      `).run(appliedRevision, now, projectId, jobId);
      this.#workspace.fault('after_job_transition_update');
      const updated = database.prepare('SELECT * FROM jobs WHERE project_id = ? AND job_id = ?').get(projectId, jobId);
      insertEvent(database, updated, {
        type: 'APPLIED', occurredAt: now, safePoint: 'semantic_commit',
        operationIdempotencyKey, details: { appliedRevision },
      });
      this.#workspace.fault('after_job_transition_event');
      return { ...jobProjection(updated), replayed: false };
    });
  }
}
