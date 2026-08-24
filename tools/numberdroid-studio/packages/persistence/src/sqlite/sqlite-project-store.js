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

function currentSliceHead(snapshot, sliceId) {
  for (const atlas of snapshot.atlases ?? []) {
    const slice = (atlas.sliceHeads ?? []).find((candidate) => candidate.sliceId === sliceId);
    if (slice) return slice;
  }
  return null;
}

function historicalSliceVersion(database, projectId, sliceId, sliceVersion) {
  const rows = database.prepare(`
    SELECT revision_number, revision_json
    FROM revisions
    WHERE project_id = ? AND command_type = 'atlas.commit.slices'
    ORDER BY revision_number DESC
  `).all(projectId);
  for (const row of rows) {
    const historical = parseJson(row.revision_json, 'revisions.revision_json');
    const committed = (historical.result?.slices ?? []).find((candidate) => (
      candidate.sliceId === sliceId && candidate.version === sliceVersion
    ));
    if (!committed) continue;
    const slice = currentSliceHead(historical.snapshot, sliceId);
    invariant(
      slice?.version === sliceVersion && slice.digest === committed.digest,
      'ASSET_SLICE_HISTORY_CORRUPT',
      'The historical committed slice does not agree with its semantic revision.',
      { projectId, sliceId, sliceVersion, revision: Number(row.revision_number) },
    );
    return { slice, committedRevision: Number(row.revision_number) };
  }
  const imported = database.prepare(`
    SELECT * FROM asset_slice_bindings
    WHERE project_id = ? AND slice_id = ? AND slice_version = ?
      AND provenance = 'bundle_import'
  `).get(projectId, sliceId, sliceVersion);
  if (imported) {
    const rectangle = parseJson(imported.rectangle_json, 'asset_slice_bindings.rectangle_json');
    return {
      committedRevision: Number(imported.committed_revision),
      slice: {
        schemaVersion: 1,
        sliceId: imported.slice_id,
        version: Number(imported.slice_version),
        atlasId: imported.atlas_id,
        sourceId: imported.source_id,
        sourceDigest: imported.source_digest,
        definitionVersion: Number(imported.atlas_definition_version),
        definitionFingerprint: imported.atlas_definition_fingerprint,
        rectangleId: imported.rectangle_id,
        rectangle: { rectangleId: imported.rectangle_id, ...rectangle },
        processorId: imported.processor_id,
        digest: imported.artifact_digest,
        artifactUri: imported.artifact_uri,
        mediaType: imported.media_type,
        byteSize: Number(imported.byte_size),
        width: Number(imported.width),
        height: Number(imported.height),
        priorDigest: imported.prior_digest,
        committedAt: imported.committed_at,
        committedBy: imported.committed_by,
        jobId: imported.job_id,
      },
    };
  }
  return null;
}

function exactSliceBinding(database, projectId, revision, item, { requireCurrentHead = true } = {}) {
  const sliceId = item.sliceId;
  const sliceVersion = item.expectedSliceVersion ?? item.sliceVersion;
  invariant(Number.isSafeInteger(sliceVersion) && sliceVersion >= 1, 'ASSET_SLICE_BINDING_INVALID', 'An exact positive slice version is required.', {
    projectId,
    sliceId,
  });
  const historical = historicalSliceVersion(database, projectId, sliceId, sliceVersion);
  invariant(historical, 'ASSET_SLICE_NOT_COMMITTED', 'The exact committed slice version does not exist in this project.', {
    projectId,
    sliceId,
    sliceVersion,
  });
  const { slice, committedRevision } = historical;
  const current = currentSliceHead(revision.snapshot, sliceId);
  if (requireCurrentHead) {
    invariant(current?.version === sliceVersion, 'ENTITY_VERSION_CONFLICT', 'The slice head changed after the asset proposal was prepared.', {
      projectId,
      sliceId,
      expectedVersion: sliceVersion,
      actualVersion: current?.version ?? null,
    });
  }
  const ownerId = `${sliceId}.v${sliceVersion}`;
  const artifact = database.prepare(`
    SELECT a.digest, a.uri, a.media_type, a.byte_size, a.width, a.height, a.state
    FROM artifact_references r
    JOIN artifacts a ON a.digest = r.digest
    WHERE r.project_id = ? AND r.owner_kind = 'atlas_slice'
      AND r.owner_id = ? AND r.digest = ?
  `).get(projectId, ownerId, slice.digest);
  invariant(
    artifact?.state === 'LIVE'
      && artifact.uri === slice.artifactUri
      && artifact.media_type === slice.mediaType
      && Number(artifact.byte_size) === slice.byteSize
      && Number(artifact.width) === slice.width
      && Number(artifact.height) === slice.height,
    'ASSET_SLICE_ARTIFACT_INVALID',
    'The exact slice lost its matching LIVE project artifact reference.',
    { projectId, sliceId, sliceVersion, digest: slice.digest },
  );
  const sourceArtifact = database.prepare(`
    SELECT a.digest, a.state
    FROM artifacts a
    JOIN artifact_references r ON r.digest = a.digest
    WHERE r.project_id = ? AND a.digest = ? AND a.state = 'LIVE'
      AND r.owner_kind IN ('source', 'source_lineage')
    LIMIT 1
  `).get(projectId, slice.sourceDigest);
  invariant(sourceArtifact, 'ASSET_SOURCE_LINEAGE_INVALID', 'The slice source artifact is not LIVE and project-scoped.', {
    projectId,
    sliceId,
    sourceDigest: slice.sourceDigest,
  });
  const { rectangleId: _duplicateRectangleId, ...rectangle } = slice.rectangle;
  const exact = {
    projectId,
    sliceId: slice.sliceId,
    sliceVersion: slice.version,
    atlasId: slice.atlasId,
    sourceId: slice.sourceId,
    sourceDigest: slice.sourceDigest,
    definitionVersion: slice.definitionVersion,
    definitionFingerprint: slice.definitionFingerprint,
    rectangleId: slice.rectangleId,
    rectangle: structuredClone(rectangle),
    processorId: slice.processorId,
    digest: slice.digest,
    artifactUri: slice.artifactUri,
    mediaType: slice.mediaType,
    byteSize: slice.byteSize,
    width: slice.width,
    height: slice.height,
    priorDigest: slice.priorDigest,
    committedRevision,
  };
  if (item.sliceBinding) {
    invariant(
      fingerprint(item.sliceBinding) === fingerprint(exact),
      'ASSET_SLICE_BINDING_MISMATCH',
      'The proposal slice binding does not match the server-resolved immutable lineage.',
      { projectId, sliceId, sliceVersion },
    );
  }
  return { exact, historicalSlice: slice };
}

function writeAssetSliceBinding(database, projectId, revision, item, { requireCurrentHead = true } = {}) {
  const { exact, historicalSlice } = exactSliceBinding(database, projectId, revision, item, { requireCurrentHead });
  const rectangle = exact.rectangle;
  database.prepare(`
    INSERT OR IGNORE INTO asset_slice_bindings(
      project_id, slice_id, slice_version, atlas_id, source_id, source_digest,
      atlas_definition_version, atlas_definition_fingerprint, rectangle_id,
      rectangle_json, rect_x, rect_y, rect_width, rect_height, pivot_x, pivot_y,
      processor_id, artifact_digest, artifact_uri, media_type, byte_size, width,
      height, prior_digest, committed_revision, bound_revision, committed_at,
      committed_by, job_id, provenance
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, 'native_revision')
  `).run(
    projectId,
    exact.sliceId,
    exact.sliceVersion,
    exact.atlasId,
    exact.sourceId,
    exact.sourceDigest,
    exact.definitionVersion,
    exact.definitionFingerprint,
    exact.rectangleId,
    JSON.stringify(rectangle),
    rectangle.x,
    rectangle.y,
    rectangle.width,
    rectangle.height,
    rectangle.pivot?.x ?? null,
    rectangle.pivot?.y ?? null,
    exact.processorId,
    exact.digest,
    exact.artifactUri,
    exact.mediaType,
    exact.byteSize,
    exact.width,
    exact.height,
    exact.priorDigest,
    exact.committedRevision,
    revision.number,
    historicalSlice.committedAt,
    historicalSlice.committedBy,
    historicalSlice.jobId,
  );
  const stored = mapAssetSliceBinding(database.prepare(`
    SELECT * FROM asset_slice_bindings
    WHERE project_id = ? AND slice_id = ? AND slice_version = ?
  `).get(projectId, exact.sliceId, exact.sliceVersion));
  const storedExact = {
    projectId: stored.projectId,
    sliceId: stored.sliceId,
    sliceVersion: stored.sliceVersion,
    atlasId: stored.atlasId,
    sourceId: stored.sourceId,
    sourceDigest: stored.sourceDigest,
    definitionVersion: stored.atlasDefinitionVersion,
    definitionFingerprint: stored.atlasDefinitionFingerprint,
    rectangleId: stored.rectangleId,
    rectangle: stored.rectangle,
    processorId: stored.processorId,
    digest: stored.digest,
    artifactUri: stored.artifactUri,
    mediaType: stored.mediaType,
    byteSize: stored.byteSize,
    width: stored.width,
    height: stored.height,
    priorDigest: stored.priorDigest,
    committedRevision: stored.committedRevision,
  };
  invariant(fingerprint(storedExact) === fingerprint(exact), 'ASSET_SLICE_BINDING_CONFLICT', 'The durable slice binding conflicts with exact historical lineage.', {
    projectId,
    sliceId: exact.sliceId,
    sliceVersion: exact.sliceVersion,
  });
  return exact;
}

function writeProposalFinding(database, projectId, proposalId, itemId, finding, findingOrder) {
  database.prepare(`
    INSERT INTO asset_proposal_item_findings(
      project_id, proposal_id, item_id, finding_id, finding_order, severity,
      rule_id, target_kind, target_id, path, explanation, remediation,
      validator_version, finding_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    projectId,
    proposalId,
    itemId,
    finding.findingId,
    findingOrder,
    finding.severity,
    finding.ruleId,
    finding.targetKind,
    finding.targetId,
    finding.path,
    finding.explanation,
    finding.remediation,
    finding.validatorVersion,
    JSON.stringify(finding),
  );
}

function writeVersionFinding(database, projectId, asset, finding, findingOrder) {
  database.prepare(`
    INSERT INTO asset_version_findings(
      project_id, asset_id, asset_version, finding_id, finding_order, severity,
      rule_id, target_kind, target_id, path, explanation, remediation,
      validator_version, finding_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    projectId,
    asset.assetId,
    asset.assetVersion,
    finding.findingId,
    findingOrder,
    finding.severity,
    finding.ruleId,
    finding.targetKind,
    finding.targetId,
    finding.path,
    finding.explanation,
    finding.remediation,
    finding.validatorVersion,
    JSON.stringify(finding),
  );
}

function priorSnapshot(database, projectId, revision) {
  const row = database.prepare(`
    SELECT revision_json FROM revisions
    WHERE project_id = ? AND revision_number = ?
  `).get(projectId, revision.parentRevision);
  return parseJson(row?.revision_json ?? '', 'revisions.revision_json').snapshot;
}

function writeAssetProposalSubmission(database, projectId, revision, fault) {
  if (revision.command.type !== 'asset.proposal.submit') return;
  const proposal = revision.snapshot.assetLibrary?.proposals?.find((candidate) => (
    candidate.proposalId === revision.result.proposalId
  ));
  invariant(
    proposal?.state === 'PENDING'
      && proposal.proposalVersion === 1
      && proposal.submittedRevision === revision.number
      && proposal.items.length === revision.result.itemCount,
    'INVALID_REVISION',
    'The asset proposal result does not match the durable proposal projection.',
    { projectId, proposalId: revision.result.proposalId },
  );
  if (revision.command.actor?.kind === 'agent') {
    const before = priorSnapshot(database, projectId, revision);
    const priorGrant = before.grants.find((grant) => grant.id === revision.command.grantId);
    const nextGrant = revision.snapshot.grants.find((grant) => grant.id === revision.command.grantId);
    invariant(
      priorGrant && nextGrant
        && nextGrant.usage.commands === priorGrant.usage.commands + proposal.items.length
        && nextGrant.usage.commands <= nextGrant.budget.maxCommands,
      'INVALID_GRANT_PROJECTION',
      'Asset proposal commands must be charged exactly once per contained item.',
      { projectId, itemCount: proposal.items.length },
    );
  }
  for (const item of proposal.items) {
    writeAssetSliceBinding(database, projectId, revision, item);
    fault('after_asset_slice_binding');
  }
  const proposerActor = proposal.proposer?.actor ?? revision.command.actor;
  database.prepare(`
    INSERT INTO asset_proposals(
      project_id, proposal_id, schema_version, base_revision, created_revision,
      status, item_count, request_fingerprint, proposer_actor_kind,
      proposer_actor_id, proposer_task_id, proposer_branch_id,
      proposer_grant_id, created_at, decided_revision, applied_revision
    ) VALUES (?, ?, 1, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
  `).run(
    projectId,
    proposal.proposalId,
    revision.parentRevision,
    revision.number,
    proposal.items.length,
    proposal.fingerprint,
    proposerActor.kind,
    proposerActor.id,
    proposal.proposer?.taskId ?? null,
    proposal.proposer?.branchId ?? (proposerActor.kind === 'human' ? 'branch.main' : null),
    proposerActor.kind === 'agent' ? proposal.proposer?.grantId : null,
    proposal.submittedAt,
  );
  fault('after_asset_proposal_insert');
  const priorAssets = new Map((priorSnapshot(database, projectId, revision).assetLibrary?.assets ?? []).map((asset) => [asset.assetId, asset]));
  for (const item of proposal.items) {
    const before = priorAssets.get(item.assetId) ?? null;
    const diff = {
      operation: item.operation,
      before: before ? {
        assetVersion: before.assetVersion,
        metadataVersion: before.metadataVersion,
        name: before.name,
        kind: before.kind,
        metadata: before.metadata,
        sliceBinding: before.sliceBinding,
      } : null,
      after: {
        name: item.name,
        kind: item.kind,
        metadata: item.metadata,
        sliceBinding: item.sliceBinding,
      },
    };
    invariant(
      item.diff && fingerprint(item.diff) === fingerprint(diff),
      'ASSET_PROPOSAL_DIFF_MISMATCH',
      'The durable proposal diff does not match the exact before/after state.',
      { proposalId: proposal.proposalId, itemId: item.itemId },
    );
    database.prepare(`
      INSERT INTO asset_proposal_items(
        project_id, proposal_id, item_id, item_order, operation, asset_id,
        expected_asset_version, expected_metadata_version, slice_id, slice_version,
        desired_name, desired_kind, desired_metadata_json,
        desired_metadata_fingerprint, diff_json, finding_fingerprint
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projectId,
      proposal.proposalId,
      item.itemId,
      item.ordinal,
      item.operation,
      item.assetId,
      item.expectedAssetVersion,
      item.expectedMetadataVersion,
      item.sliceId,
      item.expectedSliceVersion,
      item.name,
      item.kind,
      JSON.stringify(item.metadata),
      item.metadataFingerprint,
      JSON.stringify(item.diff),
      fingerprint(item.findings),
    );
    fault('after_asset_proposal_item_insert');
    for (const [findingOrder, finding] of item.findings.entries()) {
      writeProposalFinding(database, projectId, proposal.proposalId, item.itemId, finding, findingOrder);
      fault('after_asset_proposal_finding_insert');
    }
  }
}

function writeAssetProposalDecision(database, projectId, revision, fault) {
  if (revision.command.type !== 'asset.proposal.decide') return;
  const proposal = revision.snapshot.assetLibrary?.proposals?.find((candidate) => (
    candidate.proposalId === revision.result.proposalId
  ));
  invariant(
    proposal?.state === 'DECIDED'
      && proposal.proposalVersion === 2
      && proposal.decisionRevision === revision.number,
    'INVALID_REVISION',
    'The asset proposal decision does not match the durable projection.',
    { projectId, proposalId: revision.result.proposalId },
  );
  const durable = database.prepare(`
    SELECT status, item_count FROM asset_proposals
    WHERE project_id = ? AND proposal_id = ?
  `).get(projectId, proposal.proposalId);
  invariant(durable?.status === 'PENDING' && Number(durable.item_count) === proposal.items.length, 'ASSET_PROPOSAL_STATE_CONFLICT', 'Only one complete decision may resolve a pending proposal.', {
    projectId,
    proposalId: proposal.proposalId,
  });
  for (const item of proposal.items) {
    const decision = item.decision;
    invariant(decision?.decisionRevision === revision.number, 'INVALID_REVISION', 'Every proposal item requires one decision in the decision revision.', {
      proposalId: proposal.proposalId,
      itemId: item.itemId,
    });
    database.prepare(`
      INSERT INTO asset_proposal_decisions(
        project_id, proposal_id, item_id, decision, rejection_reason,
        decision_revision, decided_at, decided_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projectId,
      proposal.proposalId,
      item.itemId,
      decision.disposition,
      decision.disposition === 'REJECTED' ? decision.reason : null,
      revision.number,
      decision.decidedAt,
      decision.decidedBy,
    );
    fault('after_asset_proposal_decision_insert');
  }
  const updated = database.prepare(`
    UPDATE asset_proposals SET status = 'DECIDED', decided_revision = ?
    WHERE project_id = ? AND proposal_id = ? AND status = 'PENDING'
  `).run(revision.number, projectId, proposal.proposalId);
  invariant(Number(updated.changes) === 1, 'ASSET_PROPOSAL_STATE_CONFLICT', 'The proposal decision lost a concurrent race.');
  fault('after_asset_proposal_decision_status');
}

function writeAssetVersion(database, projectId, revision, asset, fault, {
  proposalId = null,
  proposalItemId = null,
  requireCurrentSliceHead = true,
} = {}) {
  const priorHead = database.prepare(`
    SELECT h.asset_version, h.metadata_version, v.metadata_fingerprint
    FROM asset_heads h
    JOIN asset_versions v
      ON v.project_id = h.project_id AND v.asset_id = h.asset_id
      AND v.asset_version = h.asset_version
    WHERE h.project_id = ? AND h.asset_id = ?
  `).get(projectId, asset.assetId);
  const expectedVersion = priorHead ? Number(priorHead.asset_version) + 1 : 1;
  invariant(asset.assetVersion === expectedVersion, 'ASSET_VERSION_CONFLICT', 'The next immutable asset version is not consecutive.', {
    projectId,
    assetId: asset.assetId,
    expectedVersion,
    actualVersion: asset.assetVersion,
  });
  const expectedMetadataVersion = priorHead
    ? Number(priorHead.metadata_version) + (priorHead.metadata_fingerprint === asset.metadataFingerprint ? 0 : 1)
    : 1;
  invariant(asset.metadataVersion === expectedMetadataVersion, 'ASSET_METADATA_VERSION_CONFLICT', 'Metadata version must change if and only if typed metadata changes.', {
    projectId,
    assetId: asset.assetId,
    expectedMetadataVersion,
    actualMetadataVersion: asset.metadataVersion,
  });
  const binding = writeAssetSliceBinding(database, projectId, revision, {
    sliceId: asset.sliceBinding.sliceId,
    expectedSliceVersion: asset.sliceBinding.sliceVersion,
    sliceBinding: asset.sliceBinding,
  }, { requireCurrentHead: requireCurrentSliceHead });
  fault('after_asset_version_slice_binding');
  database.prepare(`
    INSERT INTO asset_versions(
      project_id, asset_id, asset_version, metadata_version,
      previous_asset_version, name, kind, lifecycle, slice_id, slice_version,
      metadata_json, metadata_fingerprint, findings_fingerprint,
      accepted_warning_ids_json, created_revision, created_at, created_by,
      proposal_id, proposal_item_id, provenance
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'native_revision')
  `).run(
    projectId,
    asset.assetId,
    asset.assetVersion,
    asset.metadataVersion,
    priorHead ? Number(priorHead.asset_version) : null,
    asset.name,
    asset.kind,
    asset.lifecycle,
    binding.sliceId,
    binding.sliceVersion,
    JSON.stringify(asset.metadata),
    asset.metadataFingerprint,
    fingerprint(asset.findings),
    JSON.stringify(asset.warningDispositions ?? []),
    revision.number,
    asset.updatedAt ?? asset.createdAt ?? revision.committedAt,
    asset.updatedBy ?? asset.createdBy ?? revision.command.actor.id,
    proposalId,
    proposalItemId,
  );
  fault('after_asset_version_insert');
  for (const [findingOrder, finding] of asset.findings.entries()) {
    writeVersionFinding(database, projectId, asset, finding, findingOrder);
    fault('after_asset_version_finding_insert');
  }
  database.prepare(`
    INSERT INTO artifact_references(project_id, owner_kind, owner_id, digest, created_revision)
    VALUES (?, 'asset_version', ?, ?, ?)
  `).run(projectId, `${asset.assetId}.v${asset.assetVersion}`, binding.digest, revision.number);
  fault('after_asset_version_reference_insert');
  database.prepare(`
    INSERT INTO asset_heads(
      project_id, asset_id, asset_version, metadata_version, name, kind,
      lifecycle, slice_id, slice_version, updated_revision
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id, asset_id) DO UPDATE SET
      asset_version = excluded.asset_version,
      metadata_version = excluded.metadata_version,
      name = excluded.name,
      kind = excluded.kind,
      lifecycle = excluded.lifecycle,
      slice_id = excluded.slice_id,
      slice_version = excluded.slice_version,
      updated_revision = excluded.updated_revision
  `).run(
    projectId,
    asset.assetId,
    asset.assetVersion,
    asset.metadataVersion,
    asset.name,
    asset.kind,
    asset.lifecycle,
    binding.sliceId,
    binding.sliceVersion,
    revision.number,
  );
  fault('after_asset_head_update');
  database.prepare(`
    DELETE FROM asset_head_tags WHERE project_id = ? AND asset_id = ?
  `).run(projectId, asset.assetId);
  const insertTag = database.prepare(`
    INSERT INTO asset_head_tags(project_id, asset_id, tag, tag_order)
    VALUES (?, ?, ?, ?)
  `);
  for (const [tagOrder, tag] of (asset.metadata.tags ?? []).entries()) {
    insertTag.run(projectId, asset.assetId, tag, tagOrder);
  }
  fault('after_asset_head_tags_update');
}

function writeAssetProposalApplication(database, projectId, revision, fault) {
  if (revision.command.type !== 'asset.proposal.apply') return;
  const proposal = revision.snapshot.assetLibrary?.proposals?.find((candidate) => (
    candidate.proposalId === revision.result.proposalId
  ));
  invariant(
    proposal?.state === 'APPLIED'
      && proposal.proposalVersion === 3
      && proposal.appliedRevision === revision.number,
    'INVALID_REVISION',
    'The asset proposal application does not match the durable projection.',
    { projectId, proposalId: revision.result.proposalId },
  );
  const durable = database.prepare(`
    SELECT status, item_count FROM asset_proposals
    WHERE project_id = ? AND proposal_id = ?
  `).get(projectId, proposal.proposalId);
  invariant(durable?.status === 'DECIDED' && Number(durable.item_count) === proposal.items.length, 'ASSET_PROPOSAL_STATE_CONFLICT', 'Only a completely decided proposal can be applied.', {
    projectId,
    proposalId: proposal.proposalId,
  });
  const assets = revision.snapshot.assetLibrary?.assets ?? [];
  let acceptedCount = 0;
  let rejectedCount = 0;
  for (const item of proposal.items) {
    const decision = database.prepare(`
      SELECT decision FROM asset_proposal_decisions
      WHERE project_id = ? AND proposal_id = ? AND item_id = ?
    `).get(projectId, proposal.proposalId, item.itemId);
    invariant(decision?.decision === item.decision?.disposition, 'ASSET_PROPOSAL_DECISION_CONFLICT', 'The projected item decision differs from durable review.', {
      proposalId: proposal.proposalId,
      itemId: item.itemId,
    });
    exactSliceBinding(database, projectId, revision, item);
    if (decision.decision === 'REJECTED') {
      rejectedCount += 1;
      invariant(!revision.result.appliedAssetIds.includes(item.assetId), 'INVALID_REVISION', 'A rejected proposal item cannot create an asset version.', { itemId: item.itemId });
      continue;
    }
    acceptedCount += 1;
    const currentHead = database.prepare(`
      SELECT asset_version, metadata_version FROM asset_heads
      WHERE project_id = ? AND asset_id = ?
    `).get(projectId, item.assetId);
    invariant(
      Number(currentHead?.asset_version ?? 0) === item.expectedAssetVersion
        && Number(currentHead?.metadata_version ?? 0) === item.expectedMetadataVersion,
      'ENTITY_VERSION_CONFLICT',
      'An asset changed after the proposal was prepared.',
      { assetId: item.assetId },
    );
    const asset = assets.find((candidate) => (
      candidate.assetId === item.assetId
        && candidate.proposal?.proposalId === proposal.proposalId
        && candidate.proposal?.itemId === item.itemId
        && candidate.proposal?.appliedRevision === revision.number
    ));
    invariant(asset && revision.result.appliedAssetIds.includes(asset.assetId), 'INVALID_REVISION', 'An accepted proposal item has no matching applied asset head.', {
      proposalId: proposal.proposalId,
      itemId: item.itemId,
    });
    writeAssetVersion(database, projectId, revision, asset, fault, {
      proposalId: proposal.proposalId,
      proposalItemId: item.itemId,
    });
  }
  invariant(
    acceptedCount === revision.result.appliedAssetIds.length
      && rejectedCount === revision.result.rejectedItemIds.length,
    'INVALID_REVISION',
    'Proposal application counts do not match its accepted and rejected subset.',
  );
  database.prepare(`
    INSERT INTO asset_proposal_applications(
      project_id, proposal_id, application_revision, accepted_count,
      rejected_count, applied_at, applied_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    projectId,
    proposal.proposalId,
    revision.number,
    acceptedCount,
    rejectedCount,
    proposal.appliedAt,
    proposal.appliedBy,
  );
  fault('after_asset_proposal_application_insert');
  const updated = database.prepare(`
    UPDATE asset_proposals SET status = 'APPLIED', applied_revision = ?
    WHERE project_id = ? AND proposal_id = ? AND status = 'DECIDED'
  `).run(revision.number, projectId, proposal.proposalId);
  invariant(Number(updated.changes) === 1, 'ASSET_PROPOSAL_STATE_CONFLICT', 'The proposal application lost a concurrent race.');
  fault('after_asset_proposal_application_status');
}

function writeAssetLifecycleVersion(database, projectId, revision, fault) {
  if (revision.command.type !== 'asset.lifecycle.set') return;
  const asset = revision.snapshot.assetLibrary?.assets?.find((candidate) => (
    candidate.assetId === revision.result.assetId
      && candidate.assetVersion === revision.result.assetVersion
  ));
  invariant(asset && asset.lifecycle === revision.result.lifecycle, 'INVALID_REVISION', 'The lifecycle result does not match the projected asset version.', {
    projectId,
    assetId: revision.result.assetId,
  });
  writeAssetVersion(database, projectId, revision, asset, fault, {
    proposalId: asset.proposal?.proposalId ?? null,
    proposalItemId: asset.proposal?.itemId ?? null,
    requireCurrentSliceHead: false,
  });
  fault('after_asset_lifecycle_write');
}

function writeRoomFinding(database, table, projectId, roomVariantId, variantVersion, finding, findingOrder) {
  invariant(['room_variant_findings', 'room_placement_proposal_findings'].includes(table), 'VALIDATION_ERROR', 'Unsupported room finding table.');
  if (table === 'room_variant_findings') {
    database.prepare(`
      INSERT INTO room_variant_findings(
        project_id, room_variant_id, variant_version, finding_id, finding_order,
        severity, rule_id, target_kind, target_id, path, explanation,
        remediation, validator_version, finding_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projectId, roomVariantId, variantVersion, finding.findingId, findingOrder,
      finding.severity, finding.ruleId, finding.targetKind, finding.targetId,
      finding.path, finding.explanation, finding.remediation,
      finding.validatorVersion, JSON.stringify(finding),
    );
    return;
  }
  database.prepare(`
    INSERT INTO room_placement_proposal_findings(
      project_id, proposal_id, finding_id, finding_order, severity, rule_id,
      target_kind, target_id, path, explanation, remediation,
      validator_version, finding_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    projectId, roomVariantId, finding.findingId, findingOrder, finding.severity,
    finding.ruleId, finding.targetKind, finding.targetId, finding.path,
    finding.explanation, finding.remediation, finding.validatorVersion,
    JSON.stringify(finding),
  );
}

function semanticRoomVersion(snapshot, roomVariantId, variantVersion) {
  const entry = snapshot.roomLibrary?.variants?.find((candidate) => candidate.roomVariantId === roomVariantId);
  return entry?.versions?.find((candidate) => candidate.version === variantVersion) ?? null;
}

function writeRoomArchetypeCreation(database, projectId, revision, fault) {
  if (revision.command.type !== 'room.archetype.create') return;
  const archetype = revision.snapshot.roomLibrary?.archetypes?.find((candidate) => (
    candidate.roomArchetypeId === revision.result.roomArchetypeId
      && candidate.version === revision.result.archetypeVersion
  ));
  invariant(archetype && archetype.createdRevision === revision.number, 'INVALID_REVISION', 'The room archetype result does not match its semantic projection.');
  const value = {
    projectId: archetype.projectId,
    roomArchetypeId: archetype.roomArchetypeId,
    version: archetype.version,
    kind: archetype.kind,
    displayName: archetype.displayName,
    tags: archetype.tags,
    dimensionPolicy: archetype.dimensionPolicy,
    structuralBands: archetype.structuralBands,
    orientation: archetype.orientation,
    connectorPolicy: archetype.connectorPolicy,
    allowedAssetKinds: archetype.allowedAssetKinds,
    allowedTags: archetype.allowedTags,
    requiredTags: archetype.requiredTags,
    rationality: archetype.rationality,
    governingRuleRefs: archetype.governingRuleRefs,
  };
  invariant(archetype.fingerprint === fingerprint(value), 'ROOM_ARCHETYPE_FINGERPRINT_MISMATCH', 'The archetype fingerprint differs from normalized semantic content.');
  database.prepare(`
    INSERT INTO room_archetype_versions(
      project_id, room_archetype_id, archetype_version, kind, display_name,
      archetype_json, content_fingerprint, created_revision, created_at,
      created_by, provenance
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'native_revision')
  `).run(
    projectId, archetype.roomArchetypeId, archetype.version, archetype.kind,
    archetype.displayName, JSON.stringify(value), archetype.fingerprint,
    revision.number, archetype.createdAt, archetype.createdBy,
  );
  fault('after_room_archetype_version_insert');
  for (const [ruleOrder, rule] of archetype.governingRuleRefs.entries()) {
    database.prepare(`
      INSERT INTO room_archetype_governing_rules(
        project_id, room_archetype_id, archetype_version, rule_id, rule_order, summary
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(projectId, archetype.roomArchetypeId, archetype.version, rule.ruleId, ruleOrder, rule.summary);
    fault('after_room_archetype_rule_insert');
  }
  database.prepare(`
    INSERT INTO room_archetype_heads(
      project_id, room_archetype_id, archetype_version, kind, display_name, updated_revision
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(projectId, archetype.roomArchetypeId, archetype.version, archetype.kind, archetype.displayName, revision.number);
  fault('after_room_archetype_head_insert');
}

function writeRoomVariantVersion(database, projectId, revision, room, fault) {
  const priorHead = database.prepare(`
    SELECT variant_version FROM room_variant_heads
    WHERE project_id = ? AND room_variant_id = ?
  `).get(projectId, room.roomVariantId);
  const expectedVersion = Number(priorHead?.variant_version ?? 0) + 1;
  invariant(room.version === expectedVersion, 'ROOM_VERSION_CONFLICT', 'The next immutable room version is not consecutive.', {
    roomVariantId: room.roomVariantId, expectedVersion, actualVersion: room.version,
  });
  invariant(room.createdRevision === revision.number, 'INVALID_REVISION', 'The room version revision lineage is inconsistent.');
  const value = {
    projectId: room.projectId,
    roomVariantId: room.roomVariantId,
    version: room.version,
    roomArchetypeId: room.roomArchetypeId,
    archetypeVersion: room.archetypeVersion,
    displayName: room.displayName,
    lifecycle: room.lifecycle,
    width: room.width,
    height: room.height,
    origin: room.origin,
    intentTrace: room.intentTrace,
    connectors: room.connectors,
    placements: room.placements,
    acceptedWarningFindingIds: room.acceptedWarningFindingIds,
    parentVariantVersion: room.parentVariantVersion,
    parentFinalVersion: room.parentFinalVersion,
  };
  invariant(room.contentFingerprint === fingerprint({ variant: value, findings: room.findings }), 'ROOM_CONTENT_FINGERPRINT_MISMATCH', 'The room content fingerprint differs from normalized content and findings.');
  if (priorHead) {
    invariant(room.parentVariantVersion === Number(priorHead.variant_version), 'ROOM_LINEAGE_INVALID', 'A room version must name its immediate immutable parent.');
  } else {
    invariant(room.parentVariantVersion === null && room.version === 1, 'ROOM_LINEAGE_INVALID', 'The first room version cannot name a parent.');
  }
  database.prepare(`
    INSERT INTO room_variant_versions(
      project_id, room_variant_id, variant_version, room_archetype_id,
      archetype_version, previous_variant_version, parent_final_version,
      display_name, lifecycle, width, height, variant_json,
      content_fingerprint, findings_fingerprint, created_revision, created_at,
      created_by, proposal_id, provenance
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'native_revision')
  `).run(
    projectId, room.roomVariantId, room.version, room.roomArchetypeId,
    room.archetypeVersion, room.parentVariantVersion, room.parentFinalVersion,
    room.displayName, room.lifecycle, room.width, room.height, JSON.stringify(value),
    room.contentFingerprint, fingerprint(room.findings), revision.number,
    room.createdAt, room.createdBy, room.proposalId,
  );
  fault('after_room_variant_version_insert');
  for (const [intentOrder, intent] of room.intentTrace.entries()) {
    database.prepare(`
      INSERT INTO room_variant_intent(
        project_id, room_variant_id, variant_version, intent_order,
        layer, rule_id, summary, disposition
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(projectId, room.roomVariantId, room.version, intentOrder, intent.layer, intent.ruleId, intent.summary, intent.disposition);
    fault('after_room_variant_intent_insert');
  }
  for (const [connectorOrder, connector] of room.connectors.entries()) {
    database.prepare(`
      INSERT INTO room_variant_connectors(
        project_id, room_variant_id, variant_version, connector_id,
        connector_order, side, offset, aperture_width, clearance_inside,
        clearance_outside, connector_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projectId, room.roomVariantId, room.version, connector.connectorId,
      connectorOrder, connector.side, connector.offset, connector.width,
      connector.clearanceInside, connector.clearanceOutside, JSON.stringify(connector),
    );
    fault('after_room_variant_connector_insert');
  }
  for (const [placementOrder, placement] of room.placements.entries()) {
    const asset = database.prepare(`
      SELECT metadata_version FROM asset_versions
      WHERE project_id = ? AND asset_id = ? AND asset_version = ?
    `).get(projectId, placement.assetId, placement.assetVersion);
    invariant(asset && Number(asset.metadata_version) === placement.metadataVersion, 'ROOM_ASSET_VERSION_NOT_FOUND', 'The normalized room placement lost its exact asset metadata version.', {
      assetId: placement.assetId, assetVersion: placement.assetVersion, metadataVersion: placement.metadataVersion,
    });
    database.prepare(`
      INSERT INTO room_variant_placements(
        project_id, room_variant_id, variant_version, placement_id,
        placement_order, asset_id, asset_version, metadata_version, layer,
        anchor_x, anchor_y, rotation, placement_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projectId, room.roomVariantId, room.version, placement.placementId,
      placementOrder, placement.assetId, placement.assetVersion,
      placement.metadataVersion, placement.layer, placement.anchor.x,
      placement.anchor.y, placement.rotation, JSON.stringify(placement),
    );
    fault('after_room_variant_placement_insert');
  }
  for (const [findingOrder, finding] of room.findings.entries()) {
    writeRoomFinding(database, 'room_variant_findings', projectId, room.roomVariantId, room.version, finding, findingOrder);
    fault('after_room_variant_finding_insert');
  }
  const warnings = new Set(room.findings.filter((finding) => finding.severity === 'WARNING').map((finding) => finding.findingId));
  for (const [dispositionOrder, findingId] of room.acceptedWarningFindingIds.entries()) {
    invariant(warnings.has(findingId), 'ROOM_WARNING_NOT_FOUND', 'Only a current warning may be persisted as dispositioned.', { findingId });
    database.prepare(`
      INSERT INTO room_variant_warning_dispositions(
        project_id, room_variant_id, variant_version, finding_id, disposition_order
      ) VALUES (?, ?, ?, ?, ?)
    `).run(projectId, room.roomVariantId, room.version, findingId, dispositionOrder);
    fault('after_room_variant_warning_disposition_insert');
  }
  database.prepare(`
    INSERT INTO room_variant_heads(
      project_id, room_variant_id, variant_version, room_archetype_id,
      archetype_version, display_name, lifecycle, width, height, updated_revision
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id, room_variant_id) DO UPDATE SET
      variant_version = excluded.variant_version,
      room_archetype_id = excluded.room_archetype_id,
      archetype_version = excluded.archetype_version,
      display_name = excluded.display_name,
      lifecycle = excluded.lifecycle,
      width = excluded.width,
      height = excluded.height,
      updated_revision = excluded.updated_revision
  `).run(
    projectId, room.roomVariantId, room.version, room.roomArchetypeId,
    room.archetypeVersion, room.displayName, room.lifecycle, room.width,
    room.height, revision.number,
  );
  fault('after_room_variant_head_update');
}

function writeRoomProposalSubmission(database, projectId, revision, fault) {
  if (revision.command.type !== 'room.placement.proposal.submit') return;
  const proposal = revision.snapshot.roomLibrary?.proposals?.find((candidate) => candidate.proposalId === revision.result.proposalId);
  invariant(proposal?.state === 'PENDING' && proposal.proposalVersion === 1 && proposal.submittedRevision === revision.number, 'INVALID_REVISION', 'The room proposal result does not match its semantic projection.');
  if (revision.command.actor?.kind === 'agent') {
    const before = priorSnapshot(database, projectId, revision);
    const priorGrant = before.grants.find((grant) => grant.id === revision.command.grantId);
    const nextGrant = revision.snapshot.grants.find((grant) => grant.id === revision.command.grantId);
    invariant(priorGrant && nextGrant
      && nextGrant.usage.commands === priorGrant.usage.commands + proposal.items.length
      && nextGrant.usage.commands <= nextGrant.budget.maxCommands,
    'INVALID_GRANT_PROJECTION', 'Room proposal commands must be charged exactly once per item.');
  }
  const proposer = proposal.proposer?.actor ?? revision.command.actor;
  database.prepare(`
    INSERT INTO room_placement_proposals(
      project_id, proposal_id, schema_version, room_variant_id,
      expected_room_variant_version, base_revision, created_revision, status,
      item_count, request_fingerprint, finding_fingerprint,
      proposer_actor_kind, proposer_actor_id, proposer_task_id,
      proposer_branch_id, proposer_grant_id, created_at,
      decided_revision, applied_revision
    ) VALUES (?, ?, 1, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
  `).run(
    projectId, proposal.proposalId, proposal.roomVariantId,
    proposal.expectedRoomVariantVersion, revision.parentRevision, revision.number,
    proposal.items.length, proposal.fingerprint, fingerprint(proposal.findings),
    proposer.kind, proposer.id, proposal.proposer?.taskId ?? null,
    proposal.proposer?.branchId ?? (proposer.kind === 'human' ? 'branch.main' : null),
    proposer.kind === 'agent' ? proposal.proposer?.grantId : null,
    proposal.submittedAt,
  );
  fault('after_room_proposal_insert');
  for (const item of proposal.items) {
    database.prepare(`
      INSERT INTO room_placement_proposal_items(
        project_id, proposal_id, item_id, item_order, operation,
        placement_id, expected_asset_id, desired_json, diff_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projectId, proposal.proposalId, item.itemId, item.ordinal, item.operation,
      item.operation === 'add' ? item.placement.placementId : item.placementId,
      item.expectedAssetId, JSON.stringify(item), JSON.stringify(item.diff),
    );
    fault('after_room_proposal_item_insert');
  }
  for (const [findingOrder, finding] of proposal.findings.entries()) {
    writeRoomFinding(database, 'room_placement_proposal_findings', projectId, proposal.proposalId, null, finding, findingOrder);
    fault('after_room_proposal_finding_insert');
  }
}

function writeRoomProposalDecision(database, projectId, revision, fault) {
  if (revision.command.type !== 'room.placement.proposal.decide') return;
  const proposal = revision.snapshot.roomLibrary?.proposals?.find((candidate) => candidate.proposalId === revision.result.proposalId);
  invariant(proposal?.state === 'DECIDED' && proposal.proposalVersion === 2 && proposal.decisionRevision === revision.number, 'INVALID_REVISION', 'The room proposal decision does not match its semantic projection.');
  const durable = database.prepare(`SELECT status, item_count FROM room_placement_proposals WHERE project_id = ? AND proposal_id = ?`).get(projectId, proposal.proposalId);
  invariant(durable?.status === 'PENDING' && Number(durable.item_count) === proposal.items.length, 'ROOM_PROPOSAL_STATE_CONFLICT', 'Only one complete decision may resolve a pending room proposal.');
  for (const item of proposal.items) {
    invariant(item.decision?.decisionRevision === revision.number, 'INVALID_REVISION', 'Every room proposal item requires one decision.');
    database.prepare(`
      INSERT INTO room_placement_proposal_decisions(
        project_id, proposal_id, item_id, decision, rejection_reason,
        decision_revision, decided_at, decided_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projectId, proposal.proposalId, item.itemId, item.decision.disposition,
      item.decision.disposition === 'REJECTED' ? item.decision.reason : null,
      revision.number, item.decision.decidedAt, item.decision.decidedBy,
    );
    fault('after_room_proposal_decision_insert');
  }
  const updated = database.prepare(`
    UPDATE room_placement_proposals SET status = 'DECIDED', decided_revision = ?
    WHERE project_id = ? AND proposal_id = ? AND status = 'PENDING'
  `).run(revision.number, projectId, proposal.proposalId);
  invariant(Number(updated.changes) === 1, 'ROOM_PROPOSAL_STATE_CONFLICT', 'The room proposal decision lost a concurrent race.');
  fault('after_room_proposal_decision_status');
}

function writeRoomProposalApplication(database, projectId, revision, fault) {
  if (revision.command.type !== 'room.placement.proposal.apply') return;
  const proposal = revision.snapshot.roomLibrary?.proposals?.find((candidate) => candidate.proposalId === revision.result.proposalId);
  invariant(proposal?.state === 'APPLIED' && proposal.proposalVersion === 3 && proposal.appliedRevision === revision.number, 'INVALID_REVISION', 'The room proposal application does not match its semantic projection.');
  const room = semanticRoomVersion(revision.snapshot, proposal.roomVariantId, proposal.createdRoomVariantVersion);
  invariant(room?.proposalId === proposal.proposalId, 'INVALID_REVISION', 'The applied proposal did not create its named room version.');
  writeRoomVariantVersion(database, projectId, revision, room, fault);
  const acceptedCount = proposal.items.filter((item) => item.decision?.disposition === 'ACCEPTED').length;
  const rejectedCount = proposal.items.length - acceptedCount;
  database.prepare(`
    INSERT INTO room_placement_proposal_applications(
      project_id, proposal_id, room_variant_id, application_revision,
      created_room_variant_version, accepted_count, rejected_count,
      applied_at, applied_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    projectId, proposal.proposalId, proposal.roomVariantId, revision.number,
    proposal.createdRoomVariantVersion, acceptedCount, rejectedCount,
    proposal.appliedAt, proposal.appliedBy,
  );
  fault('after_room_proposal_application_insert');
  const updated = database.prepare(`
    UPDATE room_placement_proposals SET status = 'APPLIED', applied_revision = ?
    WHERE project_id = ? AND proposal_id = ? AND status = 'DECIDED'
  `).run(revision.number, projectId, proposal.proposalId);
  invariant(Number(updated.changes) === 1, 'ROOM_PROPOSAL_STATE_CONFLICT', 'The room proposal application lost a concurrent race.');
  fault('after_room_proposal_application_status');
}

function writeRoomVariantRevision(database, projectId, revision, fault) {
  const createsVersion = revision.result?.roomVariantId && revision.result?.roomVariantVersion
    && revision.command.type !== 'room.placement.proposal.apply';
  if (!createsVersion) return;
  const room = semanticRoomVersion(revision.snapshot, revision.result.roomVariantId, revision.result.roomVariantVersion);
  invariant(room, 'INVALID_REVISION', 'The room command result has no matching semantic room version.');
  writeRoomVariantVersion(database, projectId, revision, room, fault);
}

function writeRoomDesignerRevision(database, projectId, revision, fault) {
  writeRoomArchetypeCreation(database, projectId, revision, fault);
  writeRoomProposalSubmission(database, projectId, revision, fault);
  writeRoomProposalDecision(database, projectId, revision, fault);
  writeRoomProposalApplication(database, projectId, revision, fault);
  writeRoomVariantRevision(database, projectId, revision, fault);
}

function writeAssetLibraryRevision(database, projectId, revision, fault) {
  writeAssetProposalSubmission(database, projectId, revision, fault);
  writeAssetProposalDecision(database, projectId, revision, fault);
  writeAssetProposalApplication(database, projectId, revision, fault);
  writeAssetLifecycleVersion(database, projectId, revision, fault);
}

function rebuildAssetHeads(database, projectId, snapshot = null) {
  database.prepare('DELETE FROM asset_head_tags WHERE project_id = ?').run(projectId);
  database.prepare('DELETE FROM asset_heads WHERE project_id = ?').run(projectId);
  const versions = snapshot
    ? (snapshot.assetLibrary?.assets ?? []).map((asset) => database.prepare(`
      SELECT * FROM asset_versions
      WHERE project_id = ? AND asset_id = ? AND asset_version = ?
    `).get(projectId, asset.assetId, asset.assetVersion)).filter(Boolean)
    : database.prepare(`
    SELECT v.* FROM asset_versions v
    JOIN (
      SELECT project_id, asset_id, max(asset_version) AS asset_version
      FROM asset_versions WHERE project_id = ? GROUP BY project_id, asset_id
    ) latest
      ON latest.project_id = v.project_id AND latest.asset_id = v.asset_id
      AND latest.asset_version = v.asset_version
    ORDER BY v.asset_id
  `).all(projectId);
  const insertHead = database.prepare(`
    INSERT INTO asset_heads(
      project_id, asset_id, asset_version, metadata_version, name, kind,
      lifecycle, slice_id, slice_version, updated_revision
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertTag = database.prepare(`
    INSERT INTO asset_head_tags(project_id, asset_id, tag, tag_order)
    VALUES (?, ?, ?, ?)
  `);
  for (const version of versions) {
    insertHead.run(
      projectId,
      version.asset_id,
      version.asset_version,
      version.metadata_version,
      version.name,
      version.kind,
      version.lifecycle,
      version.slice_id,
      version.slice_version,
      version.created_revision,
    );
    const metadata = parseJson(version.metadata_json, 'asset_versions.metadata_json');
    for (const [tagOrder, tag] of (metadata.tags ?? []).entries()) {
      insertTag.run(projectId, version.asset_id, tag, tagOrder);
    }
  }
}

function rebuildRoomHeads(database, projectId, snapshot = null) {
  database.prepare('DELETE FROM room_variant_heads WHERE project_id = ?').run(projectId);
  database.prepare('DELETE FROM room_archetype_heads WHERE project_id = ?').run(projectId);
  const archetypes = snapshot
    ? (snapshot.roomLibrary?.archetypes ?? []).map((entry) => {
      const archetype = entry.versions.at(-1);
      return database.prepare(`
        SELECT * FROM room_archetype_versions
        WHERE project_id = ? AND room_archetype_id = ? AND archetype_version = ?
      `).get(projectId, archetype.roomArchetypeId, archetype.version);
    }).filter(Boolean)
    : database.prepare(`
    SELECT v.* FROM room_archetype_versions v
    JOIN (
      SELECT project_id, room_archetype_id, max(archetype_version) AS archetype_version
      FROM room_archetype_versions WHERE project_id = ?
      GROUP BY project_id, room_archetype_id
    ) latest ON latest.project_id = v.project_id
      AND latest.room_archetype_id = v.room_archetype_id
      AND latest.archetype_version = v.archetype_version
    ORDER BY v.room_archetype_id
  `).all(projectId);
  for (const row of archetypes) {
    database.prepare(`
      INSERT INTO room_archetype_heads(
        project_id, room_archetype_id, archetype_version, kind,
        display_name, updated_revision
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(projectId, row.room_archetype_id, row.archetype_version, row.kind, row.display_name, row.created_revision);
  }
  const variants = snapshot
    ? (snapshot.roomLibrary?.variants ?? []).map((entry) => {
      const variant = entry.versions.at(-1);
      return database.prepare(`
        SELECT * FROM room_variant_versions
        WHERE project_id = ? AND room_variant_id = ? AND variant_version = ?
      `).get(projectId, variant.roomVariantId, variant.version);
    }).filter(Boolean)
    : database.prepare(`
    SELECT v.* FROM room_variant_versions v
    JOIN (
      SELECT project_id, room_variant_id, max(variant_version) AS variant_version
      FROM room_variant_versions WHERE project_id = ?
      GROUP BY project_id, room_variant_id
    ) latest ON latest.project_id = v.project_id
      AND latest.room_variant_id = v.room_variant_id
      AND latest.variant_version = v.variant_version
    ORDER BY v.room_variant_id
  `).all(projectId);
  for (const row of variants) {
    database.prepare(`
      INSERT INTO room_variant_heads(
        project_id, room_variant_id, variant_version, room_archetype_id,
        archetype_version, display_name, lifecycle, width, height, updated_revision
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projectId, row.room_variant_id, row.variant_version, row.room_archetype_id,
      row.archetype_version, row.display_name, row.lifecycle, row.width,
      row.height, row.created_revision,
    );
  }
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

function mapAssetSliceBinding(row) {
  if (!row) return null;
  return {
    projectId: row.project_id,
    sliceId: row.slice_id,
    sliceVersion: Number(row.slice_version),
    atlasId: row.atlas_id,
    sourceId: row.source_id,
    sourceDigest: row.source_digest,
    atlasDefinitionVersion: Number(row.atlas_definition_version),
    atlasDefinitionFingerprint: row.atlas_definition_fingerprint,
    rectangleId: row.rectangle_id,
    rectangle: parseJson(row.rectangle_json, 'asset_slice_bindings.rectangle_json'),
    processorId: row.processor_id,
    digest: row.artifact_digest,
    artifactUri: row.artifact_uri,
    mediaType: row.media_type,
    byteSize: Number(row.byte_size),
    width: Number(row.width),
    height: Number(row.height),
    priorDigest: row.prior_digest,
    committedRevision: Number(row.committed_revision),
    boundRevision: Number(row.bound_revision),
    committedAt: row.committed_at,
    committedBy: row.committed_by,
    jobId: row.job_id,
    provenance: row.provenance,
  };
}

function mapAssetVersion(row) {
  if (!row) return null;
  return {
    projectId: row.project_id,
    assetId: row.asset_id,
    assetVersion: Number(row.asset_version),
    metadataVersion: Number(row.metadata_version),
    previousAssetVersion: row.previous_asset_version === null ? null : Number(row.previous_asset_version),
    name: row.name,
    kind: row.kind,
    lifecycle: row.lifecycle,
    sliceId: row.slice_id,
    sliceVersion: Number(row.slice_version),
    metadata: parseJson(row.metadata_json, 'asset_versions.metadata_json'),
    metadataFingerprint: row.metadata_fingerprint,
    findingsFingerprint: row.findings_fingerprint,
    acceptedWarningIds: parseJson(row.accepted_warning_ids_json, 'asset_versions.accepted_warning_ids_json'),
    createdRevision: Number(row.created_revision),
    createdAt: row.created_at,
    createdBy: row.created_by,
    proposalId: row.proposal_id,
    proposalItemId: row.proposal_item_id,
    provenance: row.provenance,
  };
}

function mapAssetFinding(row) {
  return {
    findingId: row.finding_id,
    order: Number(row.finding_order),
    severity: row.severity,
    ruleId: row.rule_id,
    targetKind: row.target_kind,
    targetId: row.target_id,
    path: row.path,
    explanation: row.explanation,
    remediation: row.remediation,
    validatorVersion: row.validator_version,
  };
}

function mapAssetProposal(row) {
  if (!row) return null;
  return {
    projectId: row.project_id,
    proposalId: row.proposal_id,
    schemaVersion: Number(row.schema_version),
    baseRevision: Number(row.base_revision),
    createdRevision: Number(row.created_revision),
    status: row.status,
    itemCount: Number(row.item_count),
    requestFingerprint: row.request_fingerprint,
    proposer: {
      actorKind: row.proposer_actor_kind,
      actorId: row.proposer_actor_id,
      taskId: row.proposer_task_id,
      branchId: row.proposer_branch_id,
    },
    createdAt: row.created_at,
    decidedRevision: row.decided_revision === null ? null : Number(row.decided_revision),
    appliedRevision: row.applied_revision === null ? null : Number(row.applied_revision),
  };
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
  get supportsAtomicAssetLibrary() { return true; }
  get supportsDurableAssetStore() { return true; }
  get supportsAtomicRoomDesigner() { return true; }

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
        writeAssetLibraryRevision(database, projectId, revision, (point) => this.#workspace.fault(point));
        this.#workspace.fault('after_asset_library_revision');
        writeRoomDesignerRevision(database, projectId, revision, (point) => this.#workspace.fault(point));
        this.#workspace.fault('after_room_designer_revision');

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

  async appendRevisionBatch(projectId, expectedRevision, revisions, {
    legacyGrants = false,
    afterAppend = null,
  } = {}) {
    invariant(Array.isArray(revisions) && revisions.length > 0, 'VALIDATION_ERROR', 'A non-empty revision batch is required.');
    try {
      this.#workspace.transaction((database) => {
        const project = database.prepare('SELECT head_revision, created_at, format_version FROM projects WHERE project_id = ?').get(projectId);
        if (!project) throw new StudioError('PROJECT_NOT_FOUND', 'The project does not exist.', { projectId });
        const actualRevision = Number(project.head_revision);
        invariant(actualRevision === expectedRevision, 'REVISION_CONFLICT', 'The project changed after the merge simulation.', {
          projectId, expectedRevision, actualRevision,
        });
        let parentRevision = expectedRevision;
        for (const revision of revisions) {
          invariant(
            revision.number === parentRevision + 1 && revision.parentRevision === parentRevision,
            'INVALID_REVISION',
            'Every revision in an atomic batch must follow the prior revision.',
            { parentRevision, revision: revision.number },
          );
          writeRevision(database, projectId, revision);
          this.#workspace.fault('after_revision_insert');
          createAtlasPreviewJob(database, projectId, revision);
          this.#workspace.fault('after_atlas_preview_job_create');
          writeActivity(database, projectId, revision);
          writeProjection(database, projectId, revision);
          writeIdempotency(database, projectId, revision);
          writeGrants(database, projectId, revision.snapshot, { legacy: legacyGrants, now: revision.committedAt });
          writeCanonicalSourceArtifactReference(database, projectId, revision);
          claimSourceIntake(database, projectId, revision);
          applyAtlasPreviewJob(database, projectId, revision);
          writeAssetLibraryRevision(database, projectId, revision, (point) => this.#workspace.fault(point));
          writeRoomDesignerRevision(database, projectId, revision, (point) => this.#workspace.fault(point));
          if (revision.command.type === 'task.merge.revert') {
            rebuildAssetHeads(database, projectId, revision.snapshot);
            rebuildRoomHeads(database, projectId, revision.snapshot);
          }
          parentRevision = revision.number;
        }

        const last = revisions.at(-1);
        const historical = database.prepare(`
          SELECT revision_json FROM revisions WHERE project_id = ? ORDER BY revision_number
        `).all(projectId).map((row) => parseJson(row.revision_json, 'revisions.revision_json'));
        const summary = projectSummary({
          formatVersion: Number(project.format_version),
          projectId,
          createdAt: project.created_at,
          revisions: historical,
        });
        const updated = database.prepare(`
          UPDATE projects
          SET head_revision = ?, head_snapshot_json = ?, summary_json = ?
          WHERE project_id = ? AND head_revision = ?
        `).run(last.number, JSON.stringify(last.snapshot), JSON.stringify(summary), projectId, expectedRevision);
        invariant(Number(updated.changes) === 1, 'REVISION_CONFLICT', 'Project head batch compare-and-swap failed.');
        this.#workspace.fault('after_task_merge_revision_batch');
        afterAppend?.(database, {
          projectId,
          expectedRevision,
          firstRevision: revisions[0].number,
          lastRevision: last.number,
          revisions,
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

  getAssetSliceBinding(projectId, sliceId, sliceVersion) {
    const row = this.#workspace.database.prepare(`
      SELECT * FROM asset_slice_bindings
      WHERE project_id = ? AND slice_id = ? AND slice_version = ?
    `).get(projectId, sliceId, sliceVersion);
    return mapAssetSliceBinding(row);
  }

  listAssetHeads(projectId, {
    kind = null,
    lifecycle = null,
    tag = null,
    search = null,
    limit = 200,
    offset = 0,
  } = {}) {
    invariant(Number.isSafeInteger(limit) && limit >= 1 && limit <= 500, 'VALIDATION_ERROR', 'Asset query limit must be between 1 and 500.');
    invariant(Number.isSafeInteger(offset) && offset >= 0, 'VALIDATION_ERROR', 'Asset query offset must be a non-negative integer.');
    const rows = this.#workspace.database.prepare(`
      SELECT h.*, v.metadata_json, v.metadata_fingerprint, v.findings_fingerprint,
        b.artifact_digest, b.artifact_uri, b.media_type, b.byte_size, b.width, b.height
      FROM asset_heads h
      JOIN asset_versions v
        ON v.project_id = h.project_id AND v.asset_id = h.asset_id
        AND v.asset_version = h.asset_version
      JOIN asset_slice_bindings b
        ON b.project_id = v.project_id AND b.slice_id = v.slice_id
        AND b.slice_version = v.slice_version
      WHERE h.project_id = ?
        AND (? IS NULL OR h.kind = ?)
        AND (? IS NULL OR h.lifecycle = ?)
        AND (? IS NULL OR EXISTS (
          SELECT 1 FROM asset_head_tags t
          WHERE t.project_id = h.project_id AND t.asset_id = h.asset_id AND t.tag = ?
        ))
        AND (? IS NULL OR instr(lower(h.name || ' ' || h.asset_id), lower(?)) > 0)
      ORDER BY lower(h.name), h.asset_id
      LIMIT ? OFFSET ?
    `).all(
      projectId,
      kind, kind,
      lifecycle, lifecycle,
      tag, tag,
      search, search,
      limit, offset,
    );
    const tags = this.#workspace.database.prepare(`
      SELECT tag FROM asset_head_tags
      WHERE project_id = ? AND asset_id = ? ORDER BY tag_order
    `);
    return rows.map((row) => ({
      projectId: row.project_id,
      assetId: row.asset_id,
      assetVersion: Number(row.asset_version),
      metadataVersion: Number(row.metadata_version),
      name: row.name,
      kind: row.kind,
      lifecycle: row.lifecycle,
      sliceId: row.slice_id,
      sliceVersion: Number(row.slice_version),
      updatedRevision: Number(row.updated_revision),
      tags: tags.all(projectId, row.asset_id).map((entry) => entry.tag),
      metadata: parseJson(row.metadata_json, 'asset_versions.metadata_json'),
      metadataFingerprint: row.metadata_fingerprint,
      findingsFingerprint: row.findings_fingerprint,
      imagery: {
        digest: row.artifact_digest,
        artifactUri: row.artifact_uri,
        mediaType: row.media_type,
        byteSize: Number(row.byte_size),
        width: Number(row.width),
        height: Number(row.height),
      },
    }));
  }

  getAsset(projectId, assetId) {
    const head = this.#workspace.database.prepare(`
      SELECT * FROM asset_heads WHERE project_id = ? AND asset_id = ?
    `).get(projectId, assetId);
    if (!head) return null;
    const versions = this.#workspace.database.prepare(`
      SELECT * FROM asset_versions
      WHERE project_id = ? AND asset_id = ? ORDER BY asset_version
    `).all(projectId, assetId).map(mapAssetVersion);
    const findingRows = this.#workspace.database.prepare(`
      SELECT * FROM asset_version_findings
      WHERE project_id = ? AND asset_id = ?
      ORDER BY asset_version, finding_order
    `).all(projectId, assetId);
    const findingsByVersion = new Map();
    for (const row of findingRows) {
      const version = Number(row.asset_version);
      const findings = findingsByVersion.get(version) ?? [];
      findings.push(mapAssetFinding(row));
      findingsByVersion.set(version, findings);
    }
    const tags = this.#workspace.database.prepare(`
      SELECT tag FROM asset_head_tags
      WHERE project_id = ? AND asset_id = ? ORDER BY tag_order
    `).all(projectId, assetId).map((row) => row.tag);
    return {
      projectId,
      assetId,
      head: {
        assetVersion: Number(head.asset_version),
        metadataVersion: Number(head.metadata_version),
        name: head.name,
        kind: head.kind,
        lifecycle: head.lifecycle,
        sliceId: head.slice_id,
        sliceVersion: Number(head.slice_version),
        updatedRevision: Number(head.updated_revision),
        tags,
      },
      versions: versions.map((version) => ({
        ...version,
        sliceBinding: this.getAssetSliceBinding(projectId, version.sliceId, version.sliceVersion),
        findings: findingsByVersion.get(version.assetVersion) ?? [],
      })),
    };
  }

  listAssetProposals(projectId, { status = null, limit = 200, offset = 0 } = {}) {
    invariant(Number.isSafeInteger(limit) && limit >= 1 && limit <= 500, 'VALIDATION_ERROR', 'Proposal query limit must be between 1 and 500.');
    invariant(Number.isSafeInteger(offset) && offset >= 0, 'VALIDATION_ERROR', 'Proposal query offset must be a non-negative integer.');
    return this.#workspace.database.prepare(`
      SELECT * FROM asset_proposals
      WHERE project_id = ? AND (? IS NULL OR status = ?)
      ORDER BY created_revision DESC, proposal_id
      LIMIT ? OFFSET ?
    `).all(projectId, status, status, limit, offset).map(mapAssetProposal);
  }

  getAssetProposal(projectId, proposalId) {
    const proposal = mapAssetProposal(this.#workspace.database.prepare(`
      SELECT * FROM asset_proposals WHERE project_id = ? AND proposal_id = ?
    `).get(projectId, proposalId));
    if (!proposal) return null;
    const itemRows = this.#workspace.database.prepare(`
      SELECT * FROM asset_proposal_items
      WHERE project_id = ? AND proposal_id = ? ORDER BY item_order
    `).all(projectId, proposalId);
    const findingRows = this.#workspace.database.prepare(`
      SELECT * FROM asset_proposal_item_findings
      WHERE project_id = ? AND proposal_id = ? ORDER BY item_id, finding_order
    `).all(projectId, proposalId);
    const decisionRows = this.#workspace.database.prepare(`
      SELECT * FROM asset_proposal_decisions
      WHERE project_id = ? AND proposal_id = ? ORDER BY item_id
    `).all(projectId, proposalId);
    const findingsByItem = new Map();
    for (const row of findingRows) {
      const findings = findingsByItem.get(row.item_id) ?? [];
      findings.push(mapAssetFinding(row));
      findingsByItem.set(row.item_id, findings);
    }
    const decisionsByItem = new Map(decisionRows.map((row) => [row.item_id, {
      decision: row.decision,
      rejectionReason: row.rejection_reason,
      decisionRevision: Number(row.decision_revision),
      decidedAt: row.decided_at,
      decidedBy: row.decided_by,
    }]));
    const application = this.#workspace.database.prepare(`
      SELECT * FROM asset_proposal_applications
      WHERE project_id = ? AND proposal_id = ?
    `).get(projectId, proposalId);
    return {
      ...proposal,
      items: itemRows.map((row) => ({
        itemId: row.item_id,
        order: Number(row.item_order),
        operation: row.operation,
        assetId: row.asset_id,
        expectedAssetVersion: Number(row.expected_asset_version),
        expectedMetadataVersion: Number(row.expected_metadata_version),
        sliceId: row.slice_id,
        sliceVersion: Number(row.slice_version),
        desired: {
          name: row.desired_name,
          kind: row.desired_kind,
          metadata: parseJson(row.desired_metadata_json, 'asset_proposal_items.desired_metadata_json'),
          metadataFingerprint: row.desired_metadata_fingerprint,
        },
        diff: parseJson(row.diff_json, 'asset_proposal_items.diff_json'),
        findingFingerprint: row.finding_fingerprint,
        findings: findingsByItem.get(row.item_id) ?? [],
        decision: decisionsByItem.get(row.item_id) ?? null,
      })),
      application: application ? {
        applicationRevision: Number(application.application_revision),
        acceptedCount: Number(application.accepted_count),
        rejectedCount: Number(application.rejected_count),
        appliedAt: application.applied_at,
        appliedBy: application.applied_by,
      } : null,
    };
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
      rebuildAssetHeads(database, projectId);
      rebuildRoomHeads(database, projectId);
    });
    return { projectId, revision: revision.number, projectionHash: fingerprint(revision.snapshot) };
  }

  integrityCheck() { return this.#workspace.integrityCheck(); }
  backupTo(destination) { return this.#workspace.backupTo(destination); }
  close() { this.#workspace.close(); }
}
