import { StudioError, invariant } from '../../../domain/src/errors.js';
import { SqliteWorkspace } from './sqlite-workspace.js';

const DIGEST_PATTERN = /^[a-f0-9]{64}$/;

function assertArtifactMetadata(artifact) {
  invariant(artifact && typeof artifact === 'object', 'VALIDATION_ERROR', 'Artifact metadata is required.');
  invariant(DIGEST_PATTERN.test(artifact.digest), 'ARTIFACT_INVALID_DIGEST', 'Artifact digest must be SHA-256 hex.');
  invariant(['image/png', 'image/webp'].includes(artifact.mediaType), 'ARTIFACT_UNSUPPORTED_MEDIA', 'Artifact media type is unsupported.');
  invariant(Number.isInteger(artifact.byteSize) && artifact.byteSize >= 0, 'VALIDATION_ERROR', 'Artifact byteSize is invalid.');
  invariant(Number.isInteger(artifact.width) && artifact.width > 0, 'VALIDATION_ERROR', 'Image artifact width is invalid.');
  invariant(Number.isInteger(artifact.height) && artifact.height > 0, 'VALIDATION_ERROR', 'Image artifact height is invalid.');
}

export class SqliteArtifactMetadataStore {
  #workspace;

  constructor({ workspace }) {
    invariant(workspace instanceof SqliteWorkspace, 'VALIDATION_ERROR', 'SqliteWorkspace is required.');
    this.#workspace = workspace;
  }

  register(artifact, { createdAt = new Date().toISOString() } = {}) {
    assertArtifactMetadata(artifact);
    const expectedUri = `studio://artifacts/sha256/${artifact.digest}`;
    invariant(artifact.uri === expectedUri, 'VALIDATION_ERROR', 'Artifact URI does not match its digest.');
    return this.#workspace.transaction((database) => {
      const existing = database.prepare('SELECT * FROM artifacts WHERE digest = ?').get(artifact.digest);
      if (existing) {
        invariant(
          existing.uri === artifact.uri && existing.media_type === artifact.mediaType
            && Number(existing.byte_size) === artifact.byteSize
            && Number(existing.width) === artifact.width && Number(existing.height) === artifact.height,
          'ARTIFACT_METADATA_CONFLICT',
          'Digest is already registered with different metadata.',
          { digest: artifact.digest },
        );
        return { digest: artifact.digest, deduplicated: true };
      }
      database.prepare(`
        INSERT INTO artifacts(
          digest, uri, media_type, byte_size, width, height, state, created_at, verified_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'LIVE', ?, ?)
      `).run(
        artifact.digest,
        artifact.uri,
        artifact.mediaType,
        artifact.byteSize,
        artifact.width ?? null,
        artifact.height ?? null,
        createdAt,
        createdAt,
      );
      return { digest: artifact.digest, deduplicated: false };
    });
  }

  registerAndReference(artifact, reference, { createdAt = new Date().toISOString() } = {}) {
    assertArtifactMetadata(artifact);
    return this.#workspace.transaction((database) => {
      const expectedUri = `studio://artifacts/sha256/${artifact.digest}`;
      invariant(artifact.uri === expectedUri, 'VALIDATION_ERROR', 'Artifact URI does not match its digest.');
      database.prepare(`
        INSERT INTO artifacts(
          digest, uri, media_type, byte_size, width, height, state, created_at, verified_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'LIVE', ?, ?)
        ON CONFLICT(digest) DO NOTHING
      `).run(
        artifact.digest, artifact.uri, artifact.mediaType, artifact.byteSize,
        artifact.width ?? null, artifact.height ?? null, createdAt, createdAt,
      );
      const stored = database.prepare('SELECT uri, media_type, byte_size, width, height, state FROM artifacts WHERE digest = ?').get(artifact.digest);
      invariant(
        stored.uri === artifact.uri && stored.media_type === artifact.mediaType
          && Number(stored.byte_size) === artifact.byteSize
          && Number(stored.width) === artifact.width && Number(stored.height) === artifact.height
          && stored.state === 'LIVE',
        'ARTIFACT_METADATA_CONFLICT',
        'Existing artifact metadata is incompatible with the ingested blob.',
        { digest: artifact.digest },
      );
      database.prepare(`
        INSERT OR IGNORE INTO artifact_references(
          project_id, owner_kind, owner_id, digest, created_revision
        ) VALUES (?, ?, ?, ?, ?)
      `).run(
        reference.projectId,
        reference.ownerKind,
        reference.ownerId,
        artifact.digest,
        reference.createdRevision,
      );
      return { digest: artifact.digest, referenced: true };
    });
  }

  addReference({ projectId, ownerKind, ownerId, digest, createdRevision }) {
    invariant(DIGEST_PATTERN.test(digest), 'ARTIFACT_INVALID_DIGEST', 'Artifact digest must be SHA-256 hex.');
    return this.#workspace.transaction((database) => {
      const artifact = database.prepare("SELECT state FROM artifacts WHERE digest = ?").get(digest);
      invariant(artifact, 'ARTIFACT_NOT_REGISTERED', 'Artifact metadata must exist before adding a live reference.', { digest });
      invariant(artifact.state === 'LIVE', 'ARTIFACT_NOT_LIVE', 'Only a live artifact can receive a reference.', {
        digest,
        state: artifact.state,
      });
      database.prepare(`
        INSERT OR IGNORE INTO artifact_references(
          project_id, owner_kind, owner_id, digest, created_revision
        ) VALUES (?, ?, ?, ?, ?)
      `).run(projectId, ownerKind, ownerId, digest, createdRevision);
      return { projectId, ownerKind, ownerId, digest };
    });
  }

  listReferencedDigests() {
    const schemaVersion = Number(this.#workspace.database.prepare('PRAGMA user_version').get().user_version);
    const sql = schemaVersion >= 13 ? `
      SELECT digest FROM artifact_references
      UNION
      SELECT digest FROM task_branch_processing_result_artifact_references
      ORDER BY digest
    ` : 'SELECT DISTINCT digest FROM artifact_references ORDER BY digest';
    return new Set(this.#workspace.database.prepare(sql)
      .all().map((row) => row.digest));
  }

  listArtifacts() {
    return this.#workspace.database.prepare(`
      SELECT digest, uri, media_type, byte_size, width, height, state, created_at, verified_at
      FROM artifacts ORDER BY digest
    `).all().map((row) => ({
      digest: row.digest,
      uri: row.uri,
      mediaType: row.media_type,
      byteSize: Number(row.byte_size),
      width: row.width === null ? null : Number(row.width),
      height: row.height === null ? null : Number(row.height),
      state: row.state,
      createdAt: row.created_at,
      verifiedAt: row.verified_at,
    }));
  }

  getArtifact(digest) {
    invariant(DIGEST_PATTERN.test(digest), 'ARTIFACT_INVALID_DIGEST', 'Artifact digest must be SHA-256 hex.');
    const row = this.#workspace.database.prepare(`
      SELECT digest, uri, media_type, byte_size, width, height, state, created_at, verified_at
      FROM artifacts WHERE digest = ?
    `).get(digest);
    if (!row) return null;
    return {
      digest: row.digest,
      uri: row.uri,
      mediaType: row.media_type,
      byteSize: Number(row.byte_size),
      width: row.width === null ? null : Number(row.width),
      height: row.height === null ? null : Number(row.height),
      state: row.state,
      createdAt: row.created_at,
      verifiedAt: row.verified_at,
    };
  }

  hasProjectReference(projectId, digest) {
    invariant(DIGEST_PATTERN.test(digest), 'ARTIFACT_INVALID_DIGEST', 'Artifact digest must be SHA-256 hex.');
    return Boolean(this.#workspace.database.prepare(`
      SELECT 1 FROM artifact_references WHERE project_id = ? AND digest = ? LIMIT 1
    `).get(projectId, digest));
  }

  markState(digest, state, { verifiedAt = null } = {}) {
    invariant(['LIVE', 'MISSING', 'CORRUPT', 'QUARANTINED'].includes(state), 'VALIDATION_ERROR', 'Invalid artifact state.');
    const updated = this.#workspace.database.prepare(`
      UPDATE artifacts SET state = ?, verified_at = COALESCE(?, verified_at) WHERE digest = ?
    `).run(state, verifiedAt, digest);
    if (Number(updated.changes) !== 1) throw new StudioError('ARTIFACT_NOT_REGISTERED', 'Artifact is not registered.', { digest });
  }
}
