import { invariant } from '../../../domain/src/errors.js';
import { fingerprint } from '../../../application/src/value-utils.js';
import { SqliteWorkspace } from './sqlite-workspace.js';

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;

function projection(row) {
  if (!row) return null;
  return {
    schemaVersion: 1,
    projectId: row.project_id,
    intakeId: row.intake_id,
    idempotencyKey: row.idempotency_key,
    digest: row.digest,
    origin: row.origin,
    state: row.state,
    createdAt: row.created_at,
    createdRevision: Number(row.created_revision),
    claimedSourceId: row.claimed_source_id,
    claimedRevision: row.claimed_revision === null ? null : Number(row.claimed_revision),
    abandonedAt: row.abandoned_at,
    abandonedBy: row.abandoned_by,
    intake: JSON.parse(row.intake_json),
  };
}

export class SqliteSourceIntakeStore {
  #workspace;

  constructor({ workspace }) {
    invariant(workspace instanceof SqliteWorkspace, 'VALIDATION_ERROR', 'SqliteWorkspace is required.');
    this.#workspace = workspace;
  }

  stage(artifact, {
    projectId,
    intakeId,
    idempotencyKey,
    origin,
    createdRevision,
    createdAt = new Date().toISOString(),
  }) {
    invariant(ID_PATTERN.test(projectId), 'VALIDATION_ERROR', 'A valid projectId is required.');
    invariant(ID_PATTERN.test(intakeId), 'VALIDATION_ERROR', 'A valid intakeId is required.');
    invariant(ID_PATTERN.test(idempotencyKey), 'VALIDATION_ERROR', 'A valid idempotencyKey is required.');
    invariant(DIGEST_PATTERN.test(artifact?.digest ?? ''), 'ARTIFACT_INVALID_DIGEST', 'Artifact digest must be SHA-256 hex.');
    invariant(['human_upload', 'imported_generation'].includes(origin), 'VALIDATION_ERROR', 'Invalid source intake origin.');
    invariant(Number.isInteger(createdRevision) && createdRevision >= 1, 'VALIDATION_ERROR', 'A valid createdRevision is required.');
    const intake = {
      artifact: {
        digest: artifact.digest,
        uri: artifact.uri,
        mediaType: artifact.mediaType,
        byteSize: artifact.byteSize,
        width: artifact.width,
        height: artifact.height,
      },
      origin,
    };
    return this.#workspace.transaction((database) => {
      const project = database.prepare('SELECT head_revision FROM projects WHERE project_id = ?').get(projectId);
      invariant(project, 'PROJECT_NOT_FOUND', 'The project does not exist.', { projectId });
      invariant(Number(project.head_revision) === createdRevision, 'REVISION_CONFLICT', 'The project changed while the source intake was staged.', {
        projectId,
        expectedRevision: createdRevision,
        actualRevision: Number(project.head_revision),
      });
      database.prepare(`
        INSERT INTO artifacts(
          digest, uri, media_type, byte_size, width, height, state, created_at, verified_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'LIVE', ?, ?)
        ON CONFLICT(digest) DO NOTHING
      `).run(
        artifact.digest, artifact.uri, artifact.mediaType, artifact.byteSize,
        artifact.width, artifact.height, createdAt, createdAt,
      );
      const storedArtifact = database.prepare(`
        SELECT uri, media_type, byte_size, width, height, state FROM artifacts WHERE digest = ?
      `).get(artifact.digest);
      invariant(
        storedArtifact?.uri === artifact.uri && storedArtifact.media_type === artifact.mediaType
          && Number(storedArtifact.byte_size) === artifact.byteSize
          && Number(storedArtifact.width) === artifact.width
          && Number(storedArtifact.height) === artifact.height
          && storedArtifact.state === 'LIVE',
        'ARTIFACT_METADATA_CONFLICT',
        'Existing artifact metadata is incompatible with the source intake.',
        { digest: artifact.digest },
      );
      const existing = database.prepare(`
        SELECT * FROM source_intakes WHERE project_id = ? AND idempotency_key = ?
      `).get(projectId, idempotencyKey);
      if (existing) {
        const existingProjection = projection(existing);
        invariant(
          existingProjection.digest === artifact.digest
            && existingProjection.origin === origin
            && fingerprint(existingProjection.intake) === fingerprint(intake),
          'IDEMPOTENCY_CONFLICT',
          'The source intake idempotency key was already used for different content.',
          { projectId, idempotencyKey, intakeId: existingProjection.intakeId },
        );
        return { ...existingProjection, replayed: true };
      }
      database.prepare(`
        INSERT INTO source_intakes(
          project_id, intake_id, idempotency_key, digest, origin, state,
          created_at, created_revision, claimed_source_id, claimed_revision, intake_json
        ) VALUES (?, ?, ?, ?, ?, 'STAGED', ?, ?, NULL, NULL, ?)
      `).run(
        projectId, intakeId, idempotencyKey, artifact.digest, origin,
        createdAt, createdRevision, JSON.stringify(intake),
      );
      database.prepare(`
        INSERT INTO artifact_references(project_id, owner_kind, owner_id, digest, created_revision)
        VALUES (?, 'source_intake', ?, ?, ?)
      `).run(projectId, intakeId, artifact.digest, createdRevision);
      return { ...projection(database.prepare('SELECT * FROM source_intakes WHERE project_id = ? AND intake_id = ?').get(projectId, intakeId)), replayed: false };
    });
  }

  get(projectId, intakeId) {
    invariant(ID_PATTERN.test(projectId), 'VALIDATION_ERROR', 'A valid projectId is required.');
    invariant(ID_PATTERN.test(intakeId), 'VALIDATION_ERROR', 'A valid intakeId is required.');
    return projection(this.#workspace.database.prepare(`
      SELECT * FROM source_intakes WHERE project_id = ? AND intake_id = ?
    `).get(projectId, intakeId));
  }

  list(projectId, { state = null } = {}) {
    invariant(ID_PATTERN.test(projectId), 'VALIDATION_ERROR', 'A valid projectId is required.');
    invariant(state === null || ['STAGED', 'CLAIMED', 'ABANDONED'].includes(state), 'VALIDATION_ERROR', 'Invalid intake state.');
    const rows = state === null
      ? this.#workspace.database.prepare('SELECT * FROM source_intakes WHERE project_id = ? ORDER BY created_at, intake_id').all(projectId)
      : this.#workspace.database.prepare('SELECT * FROM source_intakes WHERE project_id = ? AND state = ? ORDER BY created_at, intake_id').all(projectId, state);
    return rows.map(projection);
  }

  abandon(projectId, intakeId, {
    idempotencyKey,
    abandonedBy,
    abandonedAt = new Date().toISOString(),
  }) {
    invariant(ID_PATTERN.test(projectId), 'VALIDATION_ERROR', 'A valid projectId is required.');
    invariant(ID_PATTERN.test(intakeId), 'VALIDATION_ERROR', 'A valid intakeId is required.');
    invariant(ID_PATTERN.test(idempotencyKey), 'VALIDATION_ERROR', 'A valid idempotencyKey is required.');
    invariant(ID_PATTERN.test(abandonedBy), 'VALIDATION_ERROR', 'A valid abandonedBy is required.');
    return this.#workspace.transaction((database) => {
      const row = database.prepare('SELECT * FROM source_intakes WHERE project_id = ? AND intake_id = ?').get(projectId, intakeId);
      invariant(row, 'SOURCE_INTAKE_NOT_FOUND', 'The source intake does not exist in this project.', { projectId, intakeId });
      if (row.state === 'ABANDONED') {
        invariant(row.abandon_idempotency_key === idempotencyKey, 'IDEMPOTENCY_CONFLICT', 'The intake was abandoned with another idempotency key.', { projectId, intakeId });
        return { ...projection(row), replayed: true };
      }
      invariant(row.state === 'STAGED', 'SOURCE_INTAKE_ALREADY_CLAIMED', 'Only a staged source intake can be abandoned.', { projectId, intakeId, state: row.state });
      const updated = database.prepare(`
        UPDATE source_intakes
        SET state = 'ABANDONED', abandoned_at = ?, abandoned_by = ?, abandon_idempotency_key = ?
        WHERE project_id = ? AND intake_id = ? AND state = 'STAGED'
      `).run(abandonedAt, abandonedBy, idempotencyKey, projectId, intakeId);
      invariant(Number(updated.changes) === 1, 'SOURCE_INTAKE_ALREADY_CLAIMED', 'The intake changed before it could be abandoned.', { projectId, intakeId });
      database.prepare(`
        DELETE FROM artifact_references
        WHERE project_id = ? AND owner_kind = 'source_intake' AND owner_id = ? AND digest = ?
      `).run(projectId, intakeId, row.digest);
      return { ...projection(database.prepare('SELECT * FROM source_intakes WHERE project_id = ? AND intake_id = ?').get(projectId, intakeId)), replayed: false };
    });
  }
}
