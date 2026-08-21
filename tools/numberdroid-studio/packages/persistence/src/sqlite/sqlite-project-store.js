import { ProjectStore, headRevision, projectSummary } from '../../../application/src/project-store.js';
import { fingerprint } from '../../../application/src/value-utils.js';
import { StudioError, invariant } from '../../../domain/src/errors.js';
import { canonicalRgbaPngByteSize } from '../../../domain/src/atlas-definition.js';
import { SqliteWorkspace } from './sqlite-workspace.js';

function parseJson(value, label) {
  try { return JSON.parse(value); } catch (error) {
    throw new StudioError('CORRUPT_PROJECT', `Invalid JSON stored in ${label}.`, { cause: error.message });
  }
}

function authorizationStatus(grant, { legacy = false, now }) {
  if (legacy) return 'LEGACY_UNBOUND';
  if (grant.revokedAt) return 'REVOKED';
  if (grant.expiresAt && Date.parse(grant.expiresAt) <= Date.parse(now)) return 'EXPIRED';
  return 'ACTIVE';
}

function writeGrants(database, projectId, snapshot, options) {
  const insert = database.prepare(`
    INSERT INTO grants(
      project_id, grant_id, agent_id, task_id, scopes_json, issued_at, issued_by,
      expires_at, revoked_at, revoke_reason, authorization_status, branch_id,
      object_scopes_json, budget_json, usage_json, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id, grant_id) DO UPDATE SET
      agent_id = excluded.agent_id,
      task_id = excluded.task_id,
      scopes_json = excluded.scopes_json,
      issued_at = excluded.issued_at,
      issued_by = excluded.issued_by,
      expires_at = excluded.expires_at,
      revoked_at = excluded.revoked_at,
      revoke_reason = excluded.revoke_reason,
      authorization_status = excluded.authorization_status,
      branch_id = excluded.branch_id,
      object_scopes_json = excluded.object_scopes_json,
      budget_json = excluded.budget_json,
      usage_json = excluded.usage_json,
      status = excluded.status
  `);
  for (const grant of snapshot.grants) {
    const effectiveStatus = authorizationStatus(grant, options);
    invariant(
      options.legacy || (grant.branchId && Array.isArray(grant.objectScopes) && grant.budget && grant.usage),
      'INVALID_GRANT_PROJECTION',
      'Active grants require branch, object-scope, budget, and usage fields.',
      { projectId, grantId: grant.id },
    );
    insert.run(
      projectId,
      grant.id,
      grant.agentId,
      grant.taskId,
      JSON.stringify(grant.scopes),
      grant.issuedAt,
      grant.issuedBy,
      grant.expiresAt,
      grant.revokedAt,
      grant.revokeReason,
      effectiveStatus,
      grant.branchId ?? 'branch.legacy-unbound',
      JSON.stringify(grant.objectScopes ?? []),
      JSON.stringify(grant.budget ?? {}),
      JSON.stringify(grant.usage ?? {}),
      options.legacy ? 'LEGACY_UNBOUND' : (grant.status ?? effectiveStatus),
    );
  }
}

function writeCanonicalSourceArtifactReference(database, projectId, revision) {
  if (revision.command.type !== 'source.register') return;
  const sourceId = revision.result.sourceId;
  const source = revision.snapshot.sources.find((candidate) => candidate.id === sourceId);
  const match = /^studio:\/\/artifacts\/sha256\/([a-f0-9]{64})$/.exec(source?.artifactUri ?? '');
  if (!match) return;
  const digest = match[1];
  const artifact = database.prepare(`
    SELECT media_type, width, height, state FROM artifacts WHERE digest = ?
  `).get(digest);
  invariant(artifact && artifact.state === 'LIVE', 'ARTIFACT_NOT_LIVE', 'Canonical source artifact must be registered and LIVE.', {
    digest,
  });
  invariant(
    artifact.media_type === source.mediaType
      && Number(artifact.width) === source.width && Number(artifact.height) === source.height,
    'ARTIFACT_METADATA_CONFLICT',
    'Canonical source metadata must match the verified artifact row.',
    { digest },
  );
  const existingProjectReference = database.prepare(`
    SELECT 1 FROM artifact_references WHERE project_id = ? AND digest = ? LIMIT 1
  `).get(projectId, digest);
  invariant(existingProjectReference, 'ARTIFACT_NOT_LIVE', 'Canonical source artifact must already belong to this project.', {
    digest,
  });
  database.prepare(`
    INSERT OR IGNORE INTO artifact_references(
      project_id, owner_kind, owner_id, digest, created_revision
    ) VALUES (?, 'source', ?, ?, ?)
  `).run(projectId, sourceId, digest, revision.number);
}

function claimSourceIntake(database, projectId, revision) {
  if (revision.command.type !== 'source.intake.commit') return;
  const { sourceId, intakeId } = revision.result;
  const source = revision.snapshot.sources.find((candidate) => candidate.id === sourceId);
  invariant(source?.schemaVersion === 2 && source.intakeId === intakeId, 'INVALID_REVISION', 'V2 source revision does not match its intake result.', {
    projectId,
    sourceId,
    intakeId,
  });
  const intake = database.prepare(`
    SELECT digest, origin, state, claimed_source_id, claimed_revision
    FROM source_intakes WHERE project_id = ? AND intake_id = ?
  `).get(projectId, intakeId);
  invariant(intake, 'SOURCE_INTAKE_NOT_FOUND', 'The source intake does not exist in this project.', {
    projectId,
    intakeId,
  });
  invariant(intake.state === 'STAGED', 'SOURCE_INTAKE_ALREADY_CLAIMED', 'The source intake is no longer available to claim.', {
    projectId,
    intakeId,
    state: intake.state,
    claimedSourceId: intake.claimed_source_id,
    claimedRevision: intake.claimed_revision,
  });
  const match = /^studio:\/\/artifacts\/sha256\/([a-f0-9]{64})$/.exec(source.artifactUri);
  invariant(match?.[1] === intake.digest, 'SOURCE_INTAKE_ARTIFACT_MISMATCH', 'The committed source does not match the staged intake artifact.', {
    projectId,
    intakeId,
  });
  invariant(source.provenance?.origin === intake.origin, 'SOURCE_INTAKE_ORIGIN_MISMATCH', 'The committed provenance origin does not match the staged intake.', {
    projectId,
    intakeId,
  });
  const artifact = database.prepare(`
    SELECT media_type, byte_size, width, height, state FROM artifacts WHERE digest = ?
  `).get(intake.digest);
  invariant(artifact?.state === 'LIVE', 'ARTIFACT_NOT_LIVE', 'The source intake artifact is not LIVE.', {
    digest: intake.digest,
  });
  invariant(
    artifact.media_type === source.mediaType
      && Number(artifact.byte_size) === source.byteSize
      && Number(artifact.width) === source.width && Number(artifact.height) === source.height,
    'ARTIFACT_METADATA_CONFLICT',
    'Source intake media type and dimensions must match the verified artifact row.',
    { digest: intake.digest },
  );
  if (revision.command.actor?.kind === 'agent') {
    const priorRevision = database.prepare(`
      SELECT revision_json FROM revisions WHERE project_id = ? AND revision_number = ?
    `).get(projectId, revision.parentRevision);
    const priorSnapshot = parseJson(priorRevision?.revision_json ?? '', 'revisions.revision_json').snapshot;
    const priorGrant = priorSnapshot.grants.find((grant) => grant.id === revision.command.grantId);
    const nextGrant = revision.snapshot.grants.find((grant) => grant.id === revision.command.grantId);
    invariant(priorGrant && nextGrant, 'INVALID_GRANT_PROJECTION', 'Source intake agent grant projection is missing.');
    invariant(
      nextGrant.usage.artifactBytes === priorGrant.usage.artifactBytes + source.byteSize
        && nextGrant.usage.artifactBytes <= nextGrant.budget.maxArtifactBytes,
      'INVALID_GRANT_PROJECTION',
      'Source intake artifact bytes must be charged exactly once within the claim transaction.',
      { projectId, grantId: revision.command.grantId },
    );
  }
  const stagedReference = database.prepare(`
    SELECT 1 FROM artifact_references
    WHERE project_id = ? AND owner_kind = 'source_intake' AND owner_id = ? AND digest = ?
  `).get(projectId, intakeId, intake.digest);
  invariant(stagedReference, 'SOURCE_INTAKE_REFERENCE_MISSING', 'The source intake lost its project-scoped artifact reference.', {
    projectId,
    intakeId,
  });
  database.prepare(`
    INSERT INTO artifact_references(project_id, owner_kind, owner_id, digest, created_revision)
    VALUES (?, 'source', ?, ?, ?)
  `).run(projectId, sourceId, intake.digest, revision.number);
  const referenceArtifacts = new Set(source.provenance?.referenceArtifactUris ?? []);
  for (const referenceArtifactUri of referenceArtifacts) {
    const referenceMatch = /^studio:\/\/artifacts\/sha256\/([a-f0-9]{64})$/.exec(referenceArtifactUri);
    invariant(referenceMatch, 'ARTIFACT_URI_REQUIRED', 'Source lineage requires canonical Studio CAS URIs.');
    const referenceDigest = referenceMatch[1];
    const liveProjectReference = database.prepare(`
      SELECT 1
      FROM artifacts
      JOIN artifact_references ON artifact_references.digest = artifacts.digest
      WHERE artifacts.digest = ? AND artifacts.state = 'LIVE'
        AND artifact_references.project_id = ?
      LIMIT 1
    `).get(referenceDigest, projectId);
    invariant(liveProjectReference, 'ARTIFACT_NOT_LIVE', 'A source lineage artifact is not LIVE in this project.');
    database.prepare(`
      INSERT OR IGNORE INTO artifact_references(
        project_id, owner_kind, owner_id, digest, created_revision
      ) VALUES (?, 'source_lineage', ?, ?, ?)
    `).run(projectId, sourceId, referenceDigest, revision.number);
  }
  const claimed = database.prepare(`
    UPDATE source_intakes
    SET state = 'CLAIMED', claimed_source_id = ?, claimed_revision = ?
    WHERE project_id = ? AND intake_id = ? AND state = 'STAGED'
  `).run(sourceId, revision.number, projectId, intakeId);
  invariant(Number(claimed.changes) === 1, 'SOURCE_INTAKE_ALREADY_CLAIMED', 'The source intake claim lost a concurrent race.', {
    projectId,
    intakeId,
  });
  database.prepare(`
    DELETE FROM artifact_references
    WHERE project_id = ? AND owner_kind = 'source_intake' AND owner_id = ? AND digest = ?
  `).run(projectId, intakeId, intake.digest);
}

function writeRevision(database, projectId, revision) {
  database.prepare(`
    INSERT INTO revisions(
      project_id, revision_number, revision_id, parent_revision, committed_at,
      command_id, idempotency_key, command_type, fingerprint, revision_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    projectId,
    revision.number,
    revision.id,
    revision.parentRevision,
    revision.committedAt,
    revision.command.commandId,
    revision.command.idempotencyKey,
    revision.command.type,
    revision.command.fingerprint,
    JSON.stringify(revision),
  );
  database.prepare(`
    INSERT INTO revision_parents(project_id, revision_number, parent_revision)
    VALUES (?, ?, ?)
  `).run(projectId, revision.number, revision.parentRevision);
}

function createAtlasPreviewJob(database, projectId, revision) {
  if (revision.command.type !== 'atlas.preview.slices') return;
  const job = revision.result.job;
  invariant(job?.projectId === projectId && job.requestedRevision === revision.number, 'INVALID_REVISION', 'Atlas preview revision contains an invalid job intent.');
  invariant(fingerprint(job.input) === job.inputFingerprint, 'JOB_INPUT_FINGERPRINT_MISMATCH', 'Atlas preview job intent fingerprint is invalid.');
  const outputArtifactBytes = job.input.rectangles
    .filter((rectangle) => rectangle.included)
    .reduce((total, rectangle) => total + canonicalRgbaPngByteSize(rectangle.width, rectangle.height), 0);
  invariant(
    Number.isSafeInteger(outputArtifactBytes) && outputArtifactBytes > 0
      && job.outputArtifactBytes === outputArtifactBytes,
    'INVALID_REVISION',
    'Atlas preview revision contains invalid deterministic output byte accounting.',
  );
  if (revision.command.actor?.kind === 'agent') {
    const priorRevision = database.prepare(`
      SELECT revision_json FROM revisions WHERE project_id = ? AND revision_number = ?
    `).get(projectId, revision.parentRevision);
    const priorSnapshot = parseJson(priorRevision?.revision_json ?? '', 'revisions.revision_json').snapshot;
    const priorGrant = priorSnapshot.grants.find((grant) => grant.id === revision.command.grantId);
    const nextGrant = revision.snapshot.grants.find((grant) => grant.id === revision.command.grantId);
    invariant(priorGrant && nextGrant, 'INVALID_GRANT_PROJECTION', 'Atlas preview agent grant projection is missing.');
    invariant(
      nextGrant.usage.jobs === priorGrant.usage.jobs + 1
        && nextGrant.usage.jobs <= nextGrant.budget.maxJobs
        && nextGrant.usage.artifactBytes === priorGrant.usage.artifactBytes + outputArtifactBytes
        && nextGrant.usage.artifactBytes <= nextGrant.budget.maxArtifactBytes,
      'INVALID_GRANT_PROJECTION',
      'Atlas preview jobs and output artifact bytes must be charged exactly once within the semantic transaction.',
      { projectId },
    );
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
    projectId,
    job.jobId,
    job.kind,
    revision.number,
    job.input.atlasId,
    job.input.sourceId,
    revision.command.actor.kind,
    revision.command.actor.id,
    revision.command.taskId,
    revision.command.actor.kind === 'agent'
      ? revision.snapshot.grants.find((grant) => grant.id === revision.command.grantId)?.branchId
      : 'branch.main',
    revision.command.grantId,
    outputArtifactBytes,
    job.inputFingerprint,
    job.idempotencyKey,
    JSON.stringify(job.input),
    job.createdAt,
    job.createdAt,
  );
  database.prepare(`
    INSERT INTO job_events(
      project_id, job_id, event_sequence, attempt, event_type, state,
      safe_point, progress_current, progress_total, operation_idempotency_key,
      details_json, occurred_at
    ) VALUES (?, ?, 1, 1, 'QUEUED', 'QUEUED', 'semantic_revision', 0, 0, NULL, '{}', ?)
  `).run(projectId, job.jobId, job.createdAt);
}

function applyAtlasPreviewJob(database, projectId, revision) {
  if (revision.command.type !== 'atlas.commit.slices') return;
  const { jobId, slices } = revision.result;
  const job = database.prepare(`
    SELECT state, applied_revision, output_json FROM jobs
    WHERE project_id = ? AND job_id = ?
  `).get(projectId, jobId);
  invariant(job, 'JOB_NOT_FOUND', 'The atlas preview job does not exist.', { projectId, jobId });
  invariant(job.state === 'SUCCEEDED' && job.applied_revision === null, 'JOB_STATE_CONFLICT', 'The atlas preview job is not ready to apply.', { jobId, state: job.state });
  const outputs = parseJson(job.output_json ?? '[]', 'jobs.output_json');
  const outputByRectangle = new Map(outputs.map((output) => [output.rectangleId, output]));
  invariant(outputByRectangle.size === slices.length, 'JOB_OUTPUT_MISMATCH', 'Committed slices do not match the durable job outputs.', { jobId });
  for (const slice of slices) {
    const output = outputByRectangle.get(slice.rectangleId);
    invariant(
      output?.digest === slice.digest
        && output.mediaType === slice.mediaType
        && Number(output.byteSize) === slice.byteSize
        && Number(output.width) === slice.width && Number(output.height) === slice.height,
      'JOB_OUTPUT_MISMATCH',
      'A committed slice differs from its durable preview output.',
      { jobId, rectangleId: slice.rectangleId },
    );
    const temporaryReference = database.prepare(`
      SELECT artifacts.state AS state, artifacts.media_type AS media_type,
        artifacts.byte_size AS byte_size, artifacts.width AS width, artifacts.height AS height
      FROM artifact_references
      JOIN artifacts ON artifacts.digest = artifact_references.digest
      WHERE artifact_references.project_id = ?
        AND artifact_references.owner_kind = 'job_output'
        AND artifact_references.owner_id = ?
        AND artifact_references.digest = ?
    `).get(projectId, jobId, slice.digest);
    invariant(
      temporaryReference?.state === 'LIVE'
        && temporaryReference.media_type === slice.mediaType
        && Number(temporaryReference.byte_size) === slice.byteSize
        && Number(temporaryReference.width) === slice.width
        && Number(temporaryReference.height) === slice.height,
      'ARTIFACT_NOT_LIVE',
      'A preview output lost its exact LIVE job artifact before commit.',
      { jobId, digest: slice.digest },
    );
    database.prepare(`
      INSERT INTO artifact_references(project_id, owner_kind, owner_id, digest, created_revision)
      VALUES (?, 'atlas_slice', ?, ?, ?)
    `).run(projectId, `${slice.sliceId}.v${slice.version}`, slice.digest, revision.number);
  }
  database.prepare(`
    DELETE FROM artifact_references
    WHERE project_id = ? AND owner_kind = 'job_output' AND owner_id = ?
  `).run(projectId, jobId);
  const applied = database.prepare(`
    UPDATE jobs SET state = 'APPLIED', applied_revision = ?, updated_at = ?
    WHERE project_id = ? AND job_id = ? AND state = 'SUCCEEDED' AND applied_revision IS NULL
  `).run(revision.number, revision.committedAt, projectId, jobId);
  invariant(Number(applied.changes) === 1, 'JOB_STATE_CONFLICT', 'The atlas preview job changed before atomic application.', { jobId });
  const sequence = Number(database.prepare(`
    SELECT coalesce(max(event_sequence), 0) + 1 AS sequence
    FROM job_events WHERE project_id = ? AND job_id = ?
  `).get(projectId, jobId).sequence);
  database.prepare(`
    INSERT INTO job_events(
      project_id, job_id, event_sequence, attempt, event_type, state,
      safe_point, progress_current, progress_total, operation_idempotency_key,
      details_json, occurred_at
    )
    SELECT project_id, job_id, ?, attempt, 'APPLIED', 'APPLIED',
      'semantic_commit', progress_current, progress_total, ?, ?, ?
    FROM jobs WHERE project_id = ? AND job_id = ?
  `).run(
    sequence,
    revision.command.idempotencyKey,
    JSON.stringify({ appliedRevision: revision.number }),
    revision.committedAt,
    projectId,
    jobId,
  );
}

function writeActivity(database, projectId, revision) {
  database.prepare(`
    INSERT INTO activity_events(event_id, project_id, revision_number, occurred_at, event_json)
    VALUES (?, ?, ?, ?, ?)
  `).run(revision.event.id, projectId, revision.number, revision.event.occurredAt, JSON.stringify(revision.event));
}

function writeIdempotency(database, projectId, revision) {
  database.prepare(`
    INSERT INTO idempotency_records(
      project_id, idempotency_key, command_id, fingerprint, revision_number, result_json
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    projectId,
    revision.command.idempotencyKey,
    revision.command.commandId,
    revision.command.fingerprint,
    revision.number,
    JSON.stringify(revision.result),
  );
}

function writeProjection(database, projectId, revision) {
  const projectionJson = JSON.stringify(revision.snapshot);
  const projectionHash = fingerprint(revision.snapshot);
  database.prepare(`
    INSERT INTO projections(
      project_id, projection_type, entity_id, version, revision_number, projection_json, projection_hash
    ) VALUES (?, 'project_head', ?, ?, ?, ?, ?)
    ON CONFLICT(project_id, projection_type, entity_id) DO UPDATE SET
      version = excluded.version,
      revision_number = excluded.revision_number,
      projection_json = excluded.projection_json,
      projection_hash = excluded.projection_hash
  `).run(projectId, projectId, revision.number, revision.number, projectionJson, projectionHash);
  database.prepare(`
    INSERT INTO aggregate_versions(project_id, aggregate_type, aggregate_id, version, revision_number)
    VALUES (?, 'project', ?, ?, ?)
    ON CONFLICT(project_id, aggregate_type, aggregate_id) DO UPDATE SET
      version = excluded.version,
      revision_number = excluded.revision_number
  `).run(projectId, projectId, revision.number, revision.number);
}

function mapSqliteError(error, details = {}) {
  if (error instanceof StudioError) return error;
  if (String(error.code).startsWith('SQLITE_CONSTRAINT')) {
    return new StudioError('PERSISTENCE_CONSTRAINT', 'SQLite rejected a conflicting persistence record.', {
      ...details,
      cause: error.message,
    });
  }
  return error;
}

export class SqliteProjectStore extends ProjectStore {
  #workspace;

  static async open(options) {
    return new SqliteProjectStore({ workspace: await SqliteWorkspace.open(options) });
  }

  constructor({ workspace }) {
    super();
    invariant(workspace instanceof SqliteWorkspace, 'VALIDATION_ERROR', 'SqliteWorkspace is required.');
    this.#workspace = workspace;
  }

  get workspace() { return this.#workspace; }
  get supportsAtomicSourceIntakeClaims() { return true; }
  get supportsAtomicAtlasJobs() { return true; }

  async createProject(document, { legacyGrants = false } = {}) {
    invariant(document.revisions.length === 1, 'INVALID_REVISION', 'A new SQLite project needs exactly one revision.');
    const revision = document.revisions[0];
    invariant(revision.number === 1 && revision.parentRevision === 0, 'INVALID_REVISION', 'Initial revision must be revision 1.');
    try {
      this.#workspace.transaction((database) => {
        const summary = projectSummary(document);
        database.prepare(`
          INSERT INTO projects(project_id, format_version, created_at, head_revision, head_snapshot_json, summary_json)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          document.projectId,
          document.formatVersion,
          document.createdAt,
          revision.number,
          JSON.stringify(revision.snapshot),
          JSON.stringify(summary),
        );
        writeRevision(database, document.projectId, revision);
        this.#workspace.fault('after_revision_insert');
        writeActivity(database, document.projectId, revision);
        this.#workspace.fault('after_activity_insert');
        writeProjection(database, document.projectId, revision);
        this.#workspace.fault('after_projection_update');
        writeIdempotency(database, document.projectId, revision);
        this.#workspace.fault('after_idempotency_insert');
        writeGrants(database, document.projectId, revision.snapshot, {
          legacy: legacyGrants,
          now: revision.committedAt,
        });
        this.#workspace.fault('after_grant_projection');
      });
      return structuredClone(document);
    } catch (error) {
      throw mapSqliteError(error, { projectId: document.projectId });
    }
  }

  async loadProject(projectId) {
    const project = this.#workspace.database.prepare(`
      SELECT project_id, format_version, created_at, head_revision FROM projects WHERE project_id = ?
    `).get(projectId);
    if (!project) return null;
    const revisions = this.#workspace.database.prepare(`
      SELECT revision_json FROM revisions WHERE project_id = ? ORDER BY revision_number
    `).all(projectId).map((row) => parseJson(row.revision_json, 'revisions.revision_json'));
    invariant(revisions.length > 0, 'CORRUPT_PROJECT', 'SQLite project has no revisions.', { projectId });

    const grantRows = this.#workspace.database.prepare(`
      SELECT grant_id, authorization_status, issued_at, revoked_at, revoke_reason
      FROM grants WHERE project_id = ?
    `).all(projectId);
    const grantStatus = new Map(grantRows.map((row) => [row.grant_id, row]));
    const head = revisions.at(-1);
    head.snapshot.grants = head.snapshot.grants.map((grant) => {
      const stored = grantStatus.get(grant.id);
      if (!stored) return grant;
      if (stored.authorization_status === 'LEGACY_UNBOUND') {
        return {
          ...grant,
          status: 'LEGACY_UNBOUND',
          authorizationStatus: 'LEGACY_UNBOUND',
          revokedAt: grant.revokedAt ?? stored.revoked_at ?? stored.issued_at,
          revokeReason: grant.revokeReason ?? 'LEGACY_UNBOUND',
        };
      }
      return { ...grant, authorizationStatus: stored.authorization_status };
    });
    return {
      formatVersion: Number(project.format_version),
      projectId: project.project_id,
      createdAt: project.created_at,
      revisions,
    };
  }

  async appendRevision(projectId, expectedRevision, revision, { legacyGrants = false } = {}) {
    try {
      this.#workspace.transaction((database) => {
        const project = database.prepare('SELECT head_revision FROM projects WHERE project_id = ?').get(projectId);
        if (!project) throw new StudioError('PROJECT_NOT_FOUND', 'The project does not exist.', { projectId });
        const actualRevision = Number(project.head_revision);
        invariant(actualRevision === expectedRevision, 'REVISION_CONFLICT', 'The project changed after it was read.', {
          projectId,
          expectedRevision,
          actualRevision,
        });
        invariant(
          revision.number === expectedRevision + 1 && revision.parentRevision === expectedRevision,
          'INVALID_REVISION',
          'The appended revision does not follow the current head.',
        );
        writeRevision(database, projectId, revision);
        this.#workspace.fault('after_revision_insert');
        createAtlasPreviewJob(database, projectId, revision);
        this.#workspace.fault('after_atlas_preview_job_create');
        writeActivity(database, projectId, revision);
        this.#workspace.fault('after_activity_insert');
        writeProjection(database, projectId, revision);
        this.#workspace.fault('after_projection_update');
        writeIdempotency(database, projectId, revision);
        this.#workspace.fault('after_idempotency_insert');
        writeGrants(database, projectId, revision.snapshot, { legacy: legacyGrants, now: revision.committedAt });
        this.#workspace.fault('after_grant_projection');
        writeCanonicalSourceArtifactReference(database, projectId, revision);
        this.#workspace.fault('after_source_artifact_reference');
        claimSourceIntake(database, projectId, revision);
        this.#workspace.fault('after_source_intake_claim');
        applyAtlasPreviewJob(database, projectId, revision);
        this.#workspace.fault('after_atlas_preview_job_apply');

        const document = {
          formatVersion: 1,
          projectId,
          createdAt: revision.snapshot.project.createdAt,
          revisions: database.prepare('SELECT revision_json FROM revisions WHERE project_id = ? ORDER BY revision_number')
            .all(projectId).map((row) => parseJson(row.revision_json, 'revisions.revision_json')),
        };
        const summary = projectSummary(document);
        const updated = database.prepare(`
          UPDATE projects
          SET head_revision = ?, head_snapshot_json = ?, summary_json = ?
          WHERE project_id = ? AND head_revision = ?
        `).run(revision.number, JSON.stringify(revision.snapshot), JSON.stringify(summary), projectId, expectedRevision);
        invariant(Number(updated.changes) === 1, 'REVISION_CONFLICT', 'Project head compare-and-swap failed.', {
          projectId,
          expectedRevision,
        });
        this.#workspace.fault('before_transaction_commit');
      });
      return this.loadProject(projectId);
    } catch (error) {
      throw mapSqliteError(error, { projectId, expectedRevision });
    }
  }

  async listProjects() {
    return this.#workspace.database.prepare('SELECT summary_json FROM projects ORDER BY project_id')
      .all().map((row) => parseJson(row.summary_json, 'projects.summary_json'))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async importProjectDocument(document, { legacyGrants = true } = {}) {
    const existingRows = this.#workspace.database.prepare(`
      SELECT revision_json FROM revisions WHERE project_id = ? ORDER BY revision_number
    `).all(document.projectId);
    if (existingRows.length > 0) {
      const existingDocument = {
        formatVersion: document.formatVersion,
        projectId: document.projectId,
        createdAt: document.createdAt,
        revisions: existingRows.map((row) => parseJson(row.revision_json, 'revisions.revision_json')),
      };
      invariant(
        fingerprint(existingDocument) === fingerprint(document),
        'MIGRATION_PROJECT_CONFLICT',
        'Destination already contains a different project with the same ID.',
        { projectId: document.projectId },
      );
      return { projectId: document.projectId, imported: false, revision: document.revisions.at(-1).number };
    }
    const initial = { ...structuredClone(document), revisions: [structuredClone(document.revisions[0])] };
    await this.createProject(initial, { legacyGrants });
    for (const revision of document.revisions.slice(1)) {
      await this.appendRevision(document.projectId, revision.parentRevision, revision, { legacyGrants });
    }
    return { projectId: document.projectId, imported: true, revision: document.revisions.at(-1).number };
  }

  async rebuildProjectProjection(projectId) {
    const document = await this.loadProject(projectId);
    if (!document) throw new StudioError('PROJECT_NOT_FOUND', 'The project does not exist.', { projectId });
    const revision = headRevision(document);
    this.#workspace.transaction((database) => {
      writeProjection(database, projectId, revision);
      writeGrants(database, projectId, revision.snapshot, {
        legacy: revision.snapshot.grants.some((grant) => grant.authorizationStatus === 'LEGACY_UNBOUND'),
        now: revision.committedAt,
      });
    });
    return { projectId, revision: revision.number, projectionHash: fingerprint(revision.snapshot) };
  }

  integrityCheck() { return this.#workspace.integrityCheck(); }
  backupTo(destination) { return this.#workspace.backupTo(destination); }
  close() { this.#workspace.close(); }
}
