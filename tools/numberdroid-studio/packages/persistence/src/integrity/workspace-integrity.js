import { invariant } from '../../../domain/src/errors.js';
import { canonicalRgbaPngByteSize } from '../../../domain/src/atlas-definition.js';
import { fingerprint } from '../../../application/src/value-utils.js';
import { ContentAddressedArtifactStore } from '../artifacts/content-addressed-artifact-store.js';
import { SqliteProjectStore } from '../sqlite/sqlite-project-store.js';

function referencedArtifactRows(database) {
  return database.prepare(`
    SELECT
      references_table.digest AS digest,
      artifacts.uri AS uri,
      artifacts.byte_size AS byte_size,
      artifacts.state AS state,
      count(*) AS reference_count
    FROM artifact_references AS references_table
    LEFT JOIN artifacts ON artifacts.digest = references_table.digest
    GROUP BY references_table.digest, artifacts.uri, artifacts.byte_size, artifacts.state
    ORDER BY references_table.digest
  `).all();
}

function finding(digest, code, message, details = {}) {
  return { digest, code, message, ...details };
}

export async function verifyWorkspaceIntegrity({ projectStore, artifactStore }) {
  invariant(projectStore instanceof SqliteProjectStore, 'VALIDATION_ERROR', 'SqliteProjectStore is required.');
  invariant(artifactStore instanceof ContentAddressedArtifactStore, 'VALIDATION_ERROR', 'ContentAddressedArtifactStore is required.');

  const database = projectStore.integrityCheck();
  const findings = [];
  let rows = [];
  try {
    rows = referencedArtifactRows(projectStore.workspace.database);
  } catch (error) {
    findings.push(finding(null, 'ARTIFACT_REFERENCE_QUERY_FAILED', 'Referenced artifact metadata could not be read.', {
      cause: error.message,
    }));
  }

  let verifiedCount = 0;
  for (const row of rows) {
    const expectedByteSize = row.byte_size === null ? null : Number(row.byte_size);
    if (row.uri === null) {
      findings.push(finding(row.digest, 'ARTIFACT_METADATA_MISSING', 'A referenced digest has no artifact metadata row.', {
        referenceCount: Number(row.reference_count),
      }));
      continue;
    }
    if (row.state !== 'LIVE') {
      findings.push(finding(row.digest, 'ARTIFACT_NOT_LIVE', 'A referenced artifact is not marked LIVE.', {
        state: row.state,
        expectedByteSize,
      }));
    }
    try {
      const verified = await artifactStore.verify(row.digest);
      if (verified.byteSize !== expectedByteSize) {
        findings.push(finding(row.digest, 'ARTIFACT_SIZE_MISMATCH', 'CAS object size differs from SQLite metadata.', {
          expectedByteSize,
          actualByteSize: verified.byteSize,
        }));
        continue;
      }
      if (row.state === 'LIVE') verifiedCount += 1;
    } catch (error) {
      findings.push(finding(row.digest, error.code ?? 'ARTIFACT_VERIFY_FAILED', error.message, {
        expectedByteSize,
      }));
    }
  }

  const artifacts = {
    ok: findings.length === 0,
    referencedCount: rows.length,
    verifiedCount,
    findings,
  };
  const intakeFindings = [];
  let intakeCount = 0;
  try {
    const intakes = projectStore.workspace.database.prepare(`
      SELECT project_id, intake_id, digest, state, claimed_source_id, claimed_revision, intake_json
      FROM source_intakes ORDER BY project_id, intake_id
    `).all();
    intakeCount = intakes.length;
    const hasReference = projectStore.workspace.database.prepare(`
      SELECT 1 FROM artifact_references
      WHERE project_id = ? AND owner_kind = ? AND owner_id = ? AND digest = ?
    `);
    for (const intake of intakes) {
      try { JSON.parse(intake.intake_json); } catch {
        intakeFindings.push({
          projectId: intake.project_id,
          intakeId: intake.intake_id,
          code: 'SOURCE_INTAKE_JSON_INVALID',
          message: 'Source intake metadata is not valid JSON.',
        });
      }
      const stagedReference = Boolean(hasReference.get(
        intake.project_id, 'source_intake', intake.intake_id, intake.digest,
      ));
      if (intake.state === 'STAGED' && !stagedReference) {
        intakeFindings.push({
          projectId: intake.project_id,
          intakeId: intake.intake_id,
          code: 'SOURCE_INTAKE_REFERENCE_MISSING',
          message: 'A staged source intake has no project-scoped CAS reference.',
        });
      }
      if (intake.state === 'CLAIMED') {
        if (stagedReference) {
          intakeFindings.push({
            projectId: intake.project_id,
            intakeId: intake.intake_id,
            code: 'SOURCE_INTAKE_STAGED_REFERENCE_RETAINED',
            message: 'A claimed source intake retained its temporary CAS reference.',
          });
        }
        if (!hasReference.get(intake.project_id, 'source', intake.claimed_source_id, intake.digest)) {
          intakeFindings.push({
            projectId: intake.project_id,
            intakeId: intake.intake_id,
            code: 'SOURCE_REFERENCE_MISSING',
            message: 'A claimed source intake has no canonical source CAS reference.',
          });
        }
      }
      if (intake.state === 'ABANDONED' && stagedReference) {
        intakeFindings.push({
          projectId: intake.project_id,
          intakeId: intake.intake_id,
          code: 'SOURCE_INTAKE_STAGED_REFERENCE_RETAINED',
          message: 'An abandoned source intake retained its temporary CAS reference.',
        });
      }
    }
    const projectHeads = projectStore.workspace.database.prepare(`
      SELECT project_id, head_snapshot_json FROM projects ORDER BY project_id
    `).all();
    for (const project of projectHeads) {
      let snapshot;
      try { snapshot = JSON.parse(project.head_snapshot_json); } catch { continue; }
      for (const source of snapshot.sources ?? []) {
        if (source.schemaVersion !== 2) continue;
        for (const uri of source.provenance?.referenceArtifactUris ?? []) {
          const match = /^studio:\/\/artifacts\/sha256\/([a-f0-9]{64})$/.exec(uri);
          if (!match || !hasReference.get(project.project_id, 'source_lineage', source.id, match[1])) {
            intakeFindings.push({
              projectId: project.project_id,
              sourceId: source.id,
              code: 'SOURCE_LINEAGE_REFERENCE_MISSING',
              message: 'A V2 source provenance artifact has no permanent lineage reference.',
            });
          }
        }
      }
    }
  } catch (error) {
    intakeFindings.push({
      projectId: null,
      intakeId: null,
      code: 'SOURCE_INTAKE_QUERY_FAILED',
      message: 'Source intake integrity could not be inspected.',
      cause: error.message,
    });
  }
  const attemptFindings = [];
  let attemptCount = 0;
  try {
    const attempts = projectStore.workspace.database.prepare(`
      SELECT attempt_id, status, error_code, redacted_details_json FROM agent_attempts ORDER BY attempt_id
    `).all();
    attemptCount = attempts.length;
    for (const attempt of attempts) {
      try { JSON.parse(attempt.redacted_details_json); } catch {
        attemptFindings.push({
          attemptId: attempt.attempt_id,
          code: 'AGENT_ATTEMPT_JSON_INVALID',
          message: 'Agent attempt redacted details are not valid JSON.',
        });
      }
      if (['DENIED', 'FAILED'].includes(attempt.status) && !attempt.error_code) {
        attemptFindings.push({
          attemptId: attempt.attempt_id,
          code: 'AGENT_ATTEMPT_ERROR_CODE_MISSING',
          message: 'A denied or failed agent attempt has no stable error code.',
        });
      }
      if (attempt.status === 'AUTHORIZED' && attempt.error_code) {
        attemptFindings.push({
          attemptId: attempt.attempt_id,
          code: 'AGENT_ATTEMPT_UNEXPECTED_ERROR_CODE',
          message: 'An authorized agent attempt unexpectedly has an error code.',
        });
      }
    }
  } catch (error) {
    attemptFindings.push({
      attemptId: null,
      code: 'AGENT_ATTEMPT_QUERY_FAILED',
      message: 'Agent attempt integrity could not be inspected.',
      cause: error.message,
    });
  }
  const sourceIntakes = { ok: intakeFindings.length === 0, count: intakeCount, findings: intakeFindings };
  const agentAttempts = { ok: attemptFindings.length === 0, count: attemptCount, findings: attemptFindings };
  const jobFindings = [];
  let jobCount = 0;
  try {
    const jobs = projectStore.workspace.database.prepare(`
      SELECT project_id, job_id, job_kind, input_revision, atlas_id, source_id,
        creator_actor_kind, creator_actor_id, creator_task_id, creator_branch_id,
        creator_grant_id, output_artifact_bytes, input_fingerprint, input_json,
        state, output_json, result_json, error_json, applied_revision
      FROM jobs ORDER BY project_id, job_id
    `).all();
    jobCount = jobs.length;
    const eventsForJob = projectStore.workspace.database.prepare(`
      SELECT event_sequence, state, details_json
      FROM job_events WHERE project_id = ? AND job_id = ? ORDER BY event_sequence
    `);
    const artifactForDigest = projectStore.workspace.database.prepare(`
      SELECT media_type, byte_size, width, height, state FROM artifacts WHERE digest = ?
    `);
    const hasReference = projectStore.workspace.database.prepare(`
      SELECT 1 FROM artifact_references
      WHERE project_id = ? AND owner_kind = ? AND owner_id = ? AND digest = ?
      LIMIT 1
    `);
    const outputReferences = projectStore.workspace.database.prepare(`
      SELECT digest FROM artifact_references
      WHERE project_id = ? AND owner_kind = 'job_output' AND owner_id = ? ORDER BY digest
    `);
    const revisionAt = projectStore.workspace.database.prepare(`
      SELECT revision_json FROM revisions WHERE project_id = ? AND revision_number = ?
    `);
    for (const job of jobs) {
      let input;
      let outputs;
      try {
        input = JSON.parse(job.input_json);
        outputs = job.output_json === null ? null : JSON.parse(job.output_json);
        if (job.result_json !== null) JSON.parse(job.result_json);
        if (job.error_json !== null) JSON.parse(job.error_json);
      } catch {
        jobFindings.push({ projectId: job.project_id, jobId: job.job_id, code: 'JOB_JSON_INVALID', message: 'Durable job JSON is invalid.' });
        continue;
      }
      if (fingerprint(input) !== job.input_fingerprint) {
        jobFindings.push({ projectId: job.project_id, jobId: job.job_id, code: 'JOB_INPUT_FINGERPRINT_MISMATCH', message: 'Durable job input differs from its immutable fingerprint.' });
      }
      let intentRevision = null;
      try { intentRevision = JSON.parse(revisionAt.get(job.project_id, job.input_revision)?.revision_json ?? 'null'); } catch {}
      const intent = intentRevision?.result?.job;
      const expectedBranch = intentRevision?.command?.actor?.kind === 'agent'
        ? intentRevision.snapshot?.grants?.find((grant) => grant.id === intentRevision.command.grantId)?.branchId
        : 'branch.main';
      if (intentRevision?.command?.type !== 'atlas.preview.slices'
        || intent?.jobId !== job.job_id || intent?.kind !== job.job_kind
        || intent?.input?.atlasId !== job.atlas_id || intent?.input?.sourceId !== job.source_id
        || intent?.inputFingerprint !== job.input_fingerprint || fingerprint(intent?.input) !== job.input_fingerprint
        || intent?.outputArtifactBytes !== Number(job.output_artifact_bytes)
        || intentRevision.command.actor?.kind !== job.creator_actor_kind
        || intentRevision.command.actor?.id !== job.creator_actor_id
        || (intentRevision.command.taskId ?? null) !== job.creator_task_id
        || (intentRevision.command.grantId ?? null) !== job.creator_grant_id
        || expectedBranch !== job.creator_branch_id) {
        jobFindings.push({ projectId: job.project_id, jobId: job.job_id, code: 'JOB_INTENT_REVISION_MISMATCH', message: 'Durable job authority/input does not match its immutable semantic preview revision.' });
      }
      const exactOutputBytes = input.rectangles?.filter((rectangle) => rectangle.included)
        .reduce((total, rectangle) => total + canonicalRgbaPngByteSize(rectangle.width, rectangle.height), 0);
      if (exactOutputBytes !== Number(job.output_artifact_bytes)) {
        jobFindings.push({ projectId: job.project_id, jobId: job.job_id, code: 'JOB_OUTPUT_BUDGET_MISMATCH', message: 'Durable job output bytes differ from its canonical rectangle budget.' });
      }
      if (!hasReference.get(job.project_id, 'source', input.sourceId, input.sourceDigest)) {
        jobFindings.push({ projectId: job.project_id, jobId: job.job_id, code: 'JOB_SOURCE_REFERENCE_MISSING', message: 'Atlas job source has no canonical project reference.' });
      }
      const events = eventsForJob.all(job.project_id, job.job_id);
      if (events.length === 0 || events.some((event, index) => Number(event.event_sequence) !== index + 1)) {
        jobFindings.push({ projectId: job.project_id, jobId: job.job_id, code: 'JOB_EVENT_SEQUENCE_INVALID', message: 'Job events are missing or non-monotonic.' });
      }
      for (const event of events) {
        try { JSON.parse(event.details_json); } catch {
          jobFindings.push({ projectId: job.project_id, jobId: job.job_id, code: 'JOB_EVENT_JSON_INVALID', message: 'A job event details record is invalid JSON.' });
        }
      }
      if (events.at(-1)?.state !== job.state) {
        jobFindings.push({ projectId: job.project_id, jobId: job.job_id, code: 'JOB_EVENT_STATE_MISMATCH', message: 'The last job event does not match the durable job state.' });
      }
      if (['SUCCEEDED', 'APPLIED'].includes(job.state) && !Array.isArray(outputs)) {
        jobFindings.push({ projectId: job.project_id, jobId: job.job_id, code: 'JOB_OUTPUT_MISSING', message: 'A succeeded/applied job has no immutable output list.' });
      }
      if (['SUCCEEDED', 'APPLIED'].includes(job.state) && Array.isArray(outputs)) {
        const includedRectangles = Array.isArray(input.rectangles)
          ? input.rectangles.filter((rectangle) => rectangle?.included === true)
          : [];
        const expectedById = new Map(includedRectangles.map((rectangle) => [rectangle.rectangleId, rectangle]));
        const outputIds = new Set();
        let outputBytes = 0;
        let semanticMismatch = outputs.length !== includedRectangles.length
          || expectedById.size !== includedRectangles.length;
        for (const output of outputs) {
          const rectangle = expectedById.get(output?.rectangleId);
          if (outputIds.has(output?.rectangleId)) semanticMismatch = true;
          outputIds.add(output?.rectangleId);
          const validDimensions = Number.isSafeInteger(output?.width) && output.width > 0
            && Number.isSafeInteger(output?.height) && output.height > 0;
          const canonicalByteSize = validDimensions
            ? canonicalRgbaPngByteSize(output.width, output.height)
            : null;
          if (!rectangle
            || output.width !== rectangle.width || output.height !== rectangle.height
            || output.mediaType !== 'image/png'
            || !Number.isSafeInteger(output.byteSize) || output.byteSize !== canonicalByteSize) {
            semanticMismatch = true;
          }
          if (Number.isSafeInteger(output?.byteSize)) outputBytes += output.byteSize;
          else semanticMismatch = true;
        }
        if (outputBytes !== Number(job.output_artifact_bytes)) semanticMismatch = true;
        if (semanticMismatch) {
          jobFindings.push({
            projectId: job.project_id,
            jobId: job.job_id,
            code: 'JOB_OUTPUT_SEMANTIC_MISMATCH',
            message: 'Succeeded/applied outputs differ from the immutable included rectangle set or reserved canonical byte total.',
          });
        }
      }
      let appliedRevision = null;
      if (job.state === 'APPLIED') {
        try { appliedRevision = JSON.parse(revisionAt.get(job.project_id, job.applied_revision)?.revision_json ?? 'null'); } catch {}
        if (appliedRevision?.command?.type !== 'atlas.commit.slices'
          || appliedRevision?.result?.jobId !== job.job_id
          || !Array.isArray(appliedRevision?.result?.slices)) {
          jobFindings.push({ projectId: job.project_id, jobId: job.job_id, code: 'JOB_APPLIED_REVISION_MISMATCH', message: 'Applied job does not match its semantic slice commit revision.' });
        }
      }
      const appliedByRectangle = new Map((appliedRevision?.result?.slices ?? []).map((slice) => [slice.rectangleId, slice]));
      for (const output of outputs ?? []) {
        const artifact = artifactForDigest.get(output.digest);
        if (!artifact || artifact.state !== 'LIVE'
          || artifact.media_type !== output.mediaType
          || Number(artifact.byte_size) !== output.byteSize
          || Number(artifact.width) !== output.width
          || Number(artifact.height) !== output.height) {
          jobFindings.push({ projectId: job.project_id, jobId: job.job_id, digest: output.digest, code: 'JOB_OUTPUT_ARTIFACT_MISMATCH', message: 'A job output does not match LIVE artifact metadata.' });
          continue;
        }
        const slice = appliedByRectangle.get(output.rectangleId);
        const referenced = job.state === 'APPLIED'
          ? (slice?.digest === output.digest && slice.mediaType === output.mediaType
            && slice.byteSize === output.byteSize && slice.width === output.width && slice.height === output.height
            && hasReference.get(job.project_id, 'atlas_slice', `${slice.sliceId}.v${slice.version}`, output.digest))
          : job.state === 'SUCCEEDED'
            ? hasReference.get(job.project_id, 'job_output', job.job_id, output.digest)
            : true;
        if (!referenced) {
          jobFindings.push({ projectId: job.project_id, jobId: job.job_id, digest: output.digest, code: 'JOB_OUTPUT_REFERENCE_MISSING', message: 'A durable job output has no matching temporary or permanent project reference.' });
        }
      }
      if (job.state === 'APPLIED' && job.applied_revision === null) {
        jobFindings.push({ projectId: job.project_id, jobId: job.job_id, code: 'JOB_APPLIED_REVISION_MISSING', message: 'An applied job has no semantic revision.' });
      }
      const temporary = outputReferences.all(job.project_id, job.job_id).map((row) => row.digest);
      const expectedTemporary = job.state === 'SUCCEEDED'
        ? [...new Set((outputs ?? []).map((output) => output.digest))].sort()
        : null;
      if ((expectedTemporary && JSON.stringify(temporary) !== JSON.stringify(expectedTemporary))
        || (!expectedTemporary && ['QUEUED', 'FAILED', 'CANCELLED', 'DISCARDED', 'APPLIED'].includes(job.state) && temporary.length > 0)) {
        jobFindings.push({ projectId: job.project_id, jobId: job.job_id, code: 'JOB_OUTPUT_REFERENCE_STALE', message: 'Job temporary output references do not match its durable lifecycle state.' });
      }
    }
  } catch (error) {
    jobFindings.push({ projectId: null, jobId: null, code: 'JOB_QUERY_FAILED', message: 'Durable job integrity could not be inspected.', cause: error.message });
  }
  const jobs = { ok: jobFindings.length === 0, count: jobCount, findings: jobFindings };
  return {
    schemaVersion: 1,
    ok: database.ok && artifacts.ok && sourceIntakes.ok && agentAttempts.ok && jobs.ok,
    database,
    artifacts,
    sourceIntakes,
    agentAttempts,
    jobs,
  };
}
