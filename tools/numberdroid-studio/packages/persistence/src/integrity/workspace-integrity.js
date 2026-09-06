import { invariant } from '../../../domain/src/errors.js';
import { canonicalRgbaPngByteSize } from '../../../domain/src/atlas-definition.js';
import { createProcessingResultAdoptionPlan } from '../../../domain/src/processing-result-adoption.js';
import {
  processingResultAdoptionCommitResultSha256,
  validateProcessingResultAdoptionAggregate,
  validateProcessingResultAdoptionCommitResult,
} from '../../../domain/src/processing-result-adoption-commit.js';
import { validateTaskCandidateSubmission } from '../../../domain/src/task-candidate.js';
import { validateReviewFeedback } from '../../../domain/src/agent-task.js';
import { fingerprint } from '../../../application/src/value-utils.js';
import { ContentAddressedArtifactStore } from '../artifacts/content-addressed-artifact-store.js';
import { SQLITE_MIGRATIONS } from '../sqlite/migration-runner.js';
import { validateStoredLevelCandidateRow } from '../sqlite/sqlite-level-candidate-store.js';
import { SqliteProjectStore } from '../sqlite/sqlite-project-store.js';

function referencedArtifactRows(database, schemaVersion) {
  const references = schemaVersion >= 13 ? `
    SELECT digest FROM artifact_references
    UNION ALL
    SELECT digest FROM task_branch_processing_result_artifact_references
  ` : 'SELECT digest FROM artifact_references';
  return database.prepare(`
    SELECT
      references_table.digest AS digest,
      artifacts.uri AS uri,
      artifacts.byte_size AS byte_size,
      artifacts.state AS state,
      count(*) AS reference_count
    FROM (${references}) AS references_table
    LEFT JOIN artifacts ON artifacts.digest = references_table.digest
    GROUP BY references_table.digest, artifacts.uri, artifacts.byte_size, artifacts.state
    ORDER BY references_table.digest
  `).all();
}

function finding(digest, code, message, details = {}) {
  return { digest, code, message, ...details };
}

function sameFingerprint(left, right) {
  if (left === undefined || right === undefined) return false;
  try { return fingerprint(left) === fingerprint(right); } catch { return false; }
}

function closesEmbeddedFingerprint(value) {
  if (!value || typeof value !== 'object' || typeof value.fingerprint !== 'string') return false;
  try {
    const core = structuredClone(value);
    delete core.fingerprint;
    return value.fingerprint === fingerprint(core);
  } catch {
    return false;
  }
}

function branchCommandBudgetCharge(revisionJson) {
  let revision;
  try { revision = JSON.parse(revisionJson); } catch { return null; }
  const command = revision?.command;
  if (!command || typeof command.type !== 'string') return null;
  if (command.type === 'task.child.derive') return 0;
  if (!['asset.proposal.submit', 'room.placement.proposal.submit'].includes(command.type)) return 1;
  return Array.isArray(command.payload?.items)
    && command.payload.items.length >= 1
    && command.payload.items.length <= 64
    ? command.payload.items.length
    : null;
}

function taskBranchBaseRevision(row) {
  return Number(row.branch_origin_revision ?? row.base_revision);
}

function reservationCloses(priorUsage, currentUsage, reservation) {
  return [
    ['commands', 'maxCommands'], ['jobs', 'maxJobs'],
    ['artifactBytes', 'maxArtifactBytes'], ['costCents', 'maxCostCents'],
  ].every(([usageField, budgetField]) => (
    Number.isSafeInteger(priorUsage?.[usageField])
      && Number.isSafeInteger(currentUsage?.[usageField])
      && Number.isSafeInteger(reservation?.[budgetField])
      && currentUsage[usageField] === priorUsage[usageField] + reservation[budgetField]
  ));
}

export async function verifyWorkspaceIntegrity({ projectStore, artifactStore }) {
  invariant(projectStore instanceof SqliteProjectStore, 'VALIDATION_ERROR', 'SqliteProjectStore is required.');
  invariant(artifactStore instanceof ContentAddressedArtifactStore, 'VALIDATION_ERROR', 'ContentAddressedArtifactStore is required.');

  const database = projectStore.integrityCheck();
  const latestSupported = SQLITE_MIGRATIONS.at(-1)?.version ?? 0;
  invariant(
    database.userVersion <= latestSupported,
    'DATABASE_SCHEMA_TOO_NEW',
    'Database schema is newer than this Studio build.',
    { userVersion: database.userVersion, latestSupported },
  );
  const findings = [];
  let rows = [];
  try {
    rows = referencedArtifactRows(projectStore.workspace.database, database.userVersion);
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
  const assetFindings = [];
  let assetVersionCount = 0;
  try {
    const db = projectStore.workspace.database;
    const bindings = db.prepare(`SELECT * FROM asset_slice_bindings ORDER BY project_id, slice_id, slice_version`).all();
    const bindingById = new Map(bindings.map((row) => [`${row.project_id}:${row.slice_id}:${row.slice_version}`, row]));
    const artifact = db.prepare('SELECT * FROM artifacts WHERE digest = ?');
    const reference = db.prepare(`
      SELECT 1 FROM artifact_references
      WHERE project_id = ? AND owner_kind = ? AND owner_id = ? AND digest = ?
    `);
    for (const binding of bindings) {
      const stored = artifact.get(binding.artifact_digest);
      if (!stored || stored.state !== 'LIVE' || stored.uri !== binding.artifact_uri
        || stored.media_type !== binding.media_type || Number(stored.byte_size) !== Number(binding.byte_size)
        || Number(stored.width) !== Number(binding.width) || Number(stored.height) !== Number(binding.height)
        || !reference.get(binding.project_id, 'atlas_slice', `${binding.slice_id}.v${binding.slice_version}`, binding.artifact_digest)) {
        assetFindings.push({ projectId: binding.project_id, sliceId: binding.slice_id, sliceVersion: Number(binding.slice_version), code: 'ASSET_SLICE_ARTIFACT_MISMATCH', message: 'An exact slice binding lost its LIVE artifact metadata or reference.' });
      }
      if (!reference.get(binding.project_id, 'source', binding.source_id, binding.source_digest)
        && !reference.get(binding.project_id, 'source_lineage', binding.source_id, binding.source_digest)) {
        assetFindings.push({ projectId: binding.project_id, sliceId: binding.slice_id, code: 'ASSET_SLICE_SOURCE_REFERENCE_MISSING', message: 'An exact slice binding lost its source lineage reference.' });
      }
    }
    const versions = db.prepare(`SELECT * FROM asset_versions ORDER BY project_id, asset_id, asset_version`).all();
    assetVersionCount = versions.length;
    const versionFindings = db.prepare(`
      SELECT * FROM asset_version_findings
      WHERE project_id = ? AND asset_id = ? AND asset_version = ? ORDER BY finding_order
    `);
    const revisionType = db.prepare('SELECT command_type FROM revisions WHERE project_id = ? AND revision_number = ?');
    const lifecycleOrder = ['DRAFT', 'METADATA_COMPLETE', 'VALIDATED', 'FINAL'];
    const latestByAsset = new Map();
    for (const version of versions) {
      const key = `${version.project_id}:${version.asset_id}`;
      const prior = latestByAsset.get(key);
      if (Number(version.asset_version) !== (prior ? Number(prior.asset_version) + 1 : 1)) {
        assetFindings.push({ projectId: version.project_id, assetId: version.asset_id, code: 'ASSET_VERSION_SEQUENCE_INVALID', message: 'Asset versions are not consecutive.' });
      }
      latestByAsset.set(key, version);
      const binding = bindingById.get(`${version.project_id}:${version.slice_id}:${version.slice_version}`);
      if (!binding) {
        assetFindings.push({ projectId: version.project_id, assetId: version.asset_id, code: 'ASSET_VERSION_BINDING_MISSING', message: 'An asset version has no exact slice binding.' });
        continue;
      }
      let metadata;
      let findings;
      try {
        metadata = JSON.parse(version.metadata_json);
        const findingRows = versionFindings.all(version.project_id, version.asset_id, version.asset_version);
        findings = findingRows.map((row) => JSON.parse(row.finding_json));
        for (const [index, row] of findingRows.entries()) {
          const findingValue = findings[index];
          if (findingValue.findingId !== row.finding_id || findingValue.severity !== row.severity
            || findingValue.ruleId !== row.rule_id || findingValue.targetKind !== row.target_kind
            || findingValue.targetId !== row.target_id || findingValue.path !== row.path
            || findingValue.explanation !== row.explanation || findingValue.remediation !== row.remediation
            || findingValue.validatorVersion !== row.validator_version || Number(row.finding_order) !== index) {
            assetFindings.push({ projectId: version.project_id, assetId: version.asset_id, code: 'ASSET_FINDING_COLUMNS_MISMATCH', message: 'Asset finding columns differ from their immutable JSON.' });
          }
        }
      } catch {
        assetFindings.push({ projectId: version.project_id, assetId: version.asset_id, code: 'ASSET_VERSION_JSON_INVALID', message: 'Asset version JSON is invalid.' });
        continue;
      }
      if (fingerprint({ kind: version.kind, metadata }) !== version.metadata_fingerprint) {
        assetFindings.push({ projectId: version.project_id, assetId: version.asset_id, code: 'ASSET_METADATA_FINGERPRINT_MISMATCH', message: 'Asset metadata differs from its fingerprint.' });
      }
      if (fingerprint(findings) !== version.findings_fingerprint) {
        assetFindings.push({ projectId: version.project_id, assetId: version.asset_id, code: 'ASSET_FINDINGS_FINGERPRINT_MISMATCH', message: 'Asset findings differ from their fingerprint.' });
      }
      const expectedMetadataVersion = prior
        ? Number(prior.metadata_version) + (prior.metadata_fingerprint === version.metadata_fingerprint ? 0 : 1)
        : 1;
      if (Number(version.metadata_version) !== expectedMetadataVersion) {
        assetFindings.push({ projectId: version.project_id, assetId: version.asset_id, code: 'ASSET_METADATA_VERSION_INVALID', message: 'Metadata version changed without typed metadata, or typed metadata changed without a version increment.' });
      }
      const commandType = revisionType.get(version.project_id, version.created_revision)?.command_type;
      if (commandType === 'asset.lifecycle.set') {
        const lifecycleStep = prior ? lifecycleOrder.indexOf(version.lifecycle) - lifecycleOrder.indexOf(prior.lifecycle) : -1;
        if (!prior || lifecycleStep !== 1 || version.name !== prior.name || version.kind !== prior.kind
          || version.slice_id !== prior.slice_id || Number(version.slice_version) !== Number(prior.slice_version)
          || version.metadata_fingerprint !== prior.metadata_fingerprint
          || version.proposal_id !== prior.proposal_id || version.proposal_item_id !== prior.proposal_item_id) {
          assetFindings.push({ projectId: version.project_id, assetId: version.asset_id, code: 'ASSET_LIFECYCLE_VERSION_INVALID', message: 'A lifecycle-only version changed immutable content/provenance or skipped lifecycle order.' });
        }
      }
      let acceptedWarningIds = [];
      try { acceptedWarningIds = JSON.parse(version.accepted_warning_ids_json); } catch {}
      const findingIds = new Set(findings.map((entry) => entry.findingId));
      if (!Array.isArray(acceptedWarningIds) || acceptedWarningIds.some((findingId) => !findingIds.has(findingId))) {
        assetFindings.push({ projectId: version.project_id, assetId: version.asset_id, code: 'ASSET_WARNING_DISPOSITION_INVALID', message: 'An asset version accepts a warning that is absent from its findings.' });
      }
      if (version.lifecycle === 'FINAL' && (findings.some((entry) => entry.severity === 'ERROR')
        || findings.some((entry) => entry.severity === 'WARNING' && !acceptedWarningIds.includes(entry.findingId)))) {
        assetFindings.push({ projectId: version.project_id, assetId: version.asset_id, code: 'ASSET_FINAL_FINDINGS_INVALID', message: 'A FINAL asset retains an error or an undispositioned warning.' });
      }
      if (!reference.get(version.project_id, 'asset_version', `${version.asset_id}.v${version.asset_version}`, binding.artifact_digest)) {
        assetFindings.push({ projectId: version.project_id, assetId: version.asset_id, code: 'ASSET_VERSION_REFERENCE_MISSING', message: 'An asset version has no exact artifact reference.' });
      }
    }
    const heads = db.prepare('SELECT * FROM asset_heads ORDER BY project_id, asset_id').all();
    const tagsForHead = db.prepare('SELECT tag, tag_order FROM asset_head_tags WHERE project_id = ? AND asset_id = ? ORDER BY tag_order');
    for (const head of heads) {
      const latest = latestByAsset.get(`${head.project_id}:${head.asset_id}`);
      if (!latest || Number(head.asset_version) !== Number(latest.asset_version)
        || Number(head.metadata_version) !== Number(latest.metadata_version)
        || head.slice_id !== latest.slice_id || Number(head.slice_version) !== Number(latest.slice_version)
        || head.name !== latest.name || head.kind !== latest.kind || head.lifecycle !== latest.lifecycle) {
        assetFindings.push({ projectId: head.project_id, assetId: head.asset_id, code: 'ASSET_HEAD_MISMATCH', message: 'An asset head does not match its latest immutable version.' });
      }
      if (latest) {
        let metadata = {};
        try { metadata = JSON.parse(latest.metadata_json); } catch {}
        const tags = tagsForHead.all(head.project_id, head.asset_id);
        if (tags.some((tag, index) => Number(tag.tag_order) !== index)
          || fingerprint(tags.map((tag) => tag.tag)) !== fingerprint(metadata.tags ?? [])) {
          assetFindings.push({ projectId: head.project_id, assetId: head.asset_id, code: 'ASSET_HEAD_TAGS_MISMATCH', message: 'Asset head tags do not match ordered typed metadata tags.' });
        }
      }
    }
    const proposals = db.prepare('SELECT * FROM asset_proposals ORDER BY project_id, proposal_id').all();
    const itemCount = db.prepare('SELECT count(*) AS count FROM asset_proposal_items WHERE project_id = ? AND proposal_id = ?');
    const decisionCount = db.prepare('SELECT count(*) AS count FROM asset_proposal_decisions WHERE project_id = ? AND proposal_id = ?');
    const application = db.prepare('SELECT * FROM asset_proposal_applications WHERE project_id = ? AND proposal_id = ?');
    const proposalItems = db.prepare('SELECT * FROM asset_proposal_items WHERE project_id = ? AND proposal_id = ? ORDER BY item_order');
    const proposalFindingRows = db.prepare(`
      SELECT * FROM asset_proposal_item_findings
      WHERE project_id = ? AND proposal_id = ? AND item_id = ? ORDER BY finding_order
    `);
    const proposalDecisions = db.prepare('SELECT * FROM asset_proposal_decisions WHERE project_id = ? AND proposal_id = ? ORDER BY item_id');
    const projectHead = db.prepare('SELECT head_snapshot_json FROM projects WHERE project_id = ?');
    for (const proposal of proposals) {
      const items = Number(itemCount.get(proposal.project_id, proposal.proposal_id).count);
      const decisions = Number(decisionCount.get(proposal.project_id, proposal.proposal_id).count);
      const applied = application.get(proposal.project_id, proposal.proposal_id);
      if (items !== Number(proposal.item_count)
        || (proposal.status !== 'PENDING' && decisions !== items)
        || (proposal.status === 'APPLIED' && (!applied || Number(applied.accepted_count) + Number(applied.rejected_count) !== items))) {
        assetFindings.push({ projectId: proposal.project_id, proposalId: proposal.proposal_id, code: 'ASSET_PROPOSAL_PROJECTION_MISMATCH', message: 'Proposal items, decisions, application, and durable state disagree.' });
      }
      const itemRows = proposalItems.all(proposal.project_id, proposal.proposal_id);
      const decisionByItem = new Map(proposalDecisions.all(proposal.project_id, proposal.proposal_id).map((row) => [row.item_id, row]));
      for (const [itemOrder, item] of itemRows.entries()) {
        let metadata;
        let diff;
        let findingValues;
        try {
          metadata = JSON.parse(item.desired_metadata_json);
          diff = JSON.parse(item.diff_json);
          const rows = proposalFindingRows.all(item.project_id, item.proposal_id, item.item_id);
          findingValues = rows.map((row) => JSON.parse(row.finding_json));
          for (const [findingOrder, row] of rows.entries()) {
            const value = findingValues[findingOrder];
            if (Number(row.finding_order) !== findingOrder || value.findingId !== row.finding_id
              || value.severity !== row.severity || value.ruleId !== row.rule_id
              || value.targetKind !== row.target_kind || value.targetId !== row.target_id
              || value.path !== row.path || value.explanation !== row.explanation
              || value.remediation !== row.remediation || value.validatorVersion !== row.validator_version) {
              assetFindings.push({ projectId: item.project_id, proposalId: item.proposal_id, itemId: item.item_id, code: 'ASSET_PROPOSAL_FINDING_COLUMNS_MISMATCH', message: 'Proposal finding columns differ from immutable JSON.' });
            }
          }
        } catch {
          assetFindings.push({ projectId: item.project_id, proposalId: item.proposal_id, itemId: item.item_id, code: 'ASSET_PROPOSAL_ITEM_JSON_INVALID', message: 'Proposal item JSON is invalid.' });
          continue;
        }
        if (Number(item.item_order) !== itemOrder || fingerprint({ kind: item.desired_kind, metadata }) !== item.desired_metadata_fingerprint
          || fingerprint(findingValues) !== item.finding_fingerprint || diff.operation !== item.operation
          || (item.operation === 'create' && (Number(item.expected_asset_version) !== 0 || Number(item.expected_metadata_version) !== 0))) {
          assetFindings.push({ projectId: item.project_id, proposalId: item.proposal_id, itemId: item.item_id, code: 'ASSET_PROPOSAL_ITEM_MISMATCH', message: 'Proposal item ordering, typed metadata, findings, diff, or expected versions disagree.' });
        }
        const decision = decisionByItem.get(item.item_id);
        if (proposal.status !== 'PENDING' && (!decision
          || (decision.decision === 'ACCEPTED' && decision.rejection_reason !== null)
          || (decision.decision === 'REJECTED' && !decision.rejection_reason?.trim())
          || Number(decision.decision_revision) !== Number(proposal.decided_revision))) {
          assetFindings.push({ projectId: item.project_id, proposalId: item.proposal_id, itemId: item.item_id, code: 'ASSET_PROPOSAL_DECISION_MISMATCH', message: 'Proposal decision vector or revision is inconsistent.' });
        }
      }
      let snapshot;
      try { snapshot = JSON.parse(projectHead.get(proposal.project_id).head_snapshot_json); } catch { snapshot = null; }
      const semantic = snapshot?.assetLibrary?.proposals?.find((entry) => entry.proposalId === proposal.proposal_id);
      if (!semantic || semantic.state !== proposal.status || semantic.fingerprint !== proposal.request_fingerprint
        || semantic.items.length !== Number(proposal.item_count)
        || Number(semantic.submittedRevision) !== Number(proposal.created_revision)
        || Number(semantic.decisionRevision) !== Number(proposal.decided_revision)
        || Number(semantic.appliedRevision) !== Number(proposal.applied_revision)) {
        assetFindings.push({ projectId: proposal.project_id, proposalId: proposal.proposal_id, code: 'ASSET_PROPOSAL_SNAPSHOT_MISMATCH', message: 'Durable proposal header differs from the semantic project head.' });
      } else {
        for (const semanticItem of semantic.items) {
          const item = itemRows.find((entry) => entry.item_id === semanticItem.itemId);
          const decision = decisionByItem.get(semanticItem.itemId);
          if (!item || fingerprint(JSON.parse(item.diff_json)) !== fingerprint(semanticItem.diff)
            || fingerprint(JSON.parse(item.desired_metadata_json)) !== fingerprint(semanticItem.metadata)
            || decision?.decision !== semanticItem.decision?.disposition
            || (decision?.rejection_reason ?? null) !== (semanticItem.decision?.reason ?? null)) {
            assetFindings.push({ projectId: proposal.project_id, proposalId: proposal.proposal_id, itemId: semanticItem.itemId, code: 'ASSET_PROPOSAL_SEMANTIC_MISMATCH', message: 'Durable proposal item/decision differs from the semantic project head.' });
          }
        }
        if (proposal.status === 'APPLIED' && (Number(applied?.application_revision) !== Number(semantic.appliedRevision)
          || applied?.applied_at !== semantic.appliedAt || applied?.applied_by !== semantic.appliedBy)) {
          assetFindings.push({ projectId: proposal.project_id, proposalId: proposal.proposal_id, code: 'ASSET_PROPOSAL_APPLICATION_MISMATCH', message: 'Proposal application differs from semantic application state.' });
        }
      }
    }
    const projectRows = db.prepare('SELECT project_id, head_snapshot_json FROM projects ORDER BY project_id').all();
    for (const project of projectRows) {
      let snapshot;
      try { snapshot = JSON.parse(project.head_snapshot_json); } catch { continue; }
      const semanticAssets = snapshot.assetLibrary?.assets ?? [];
      const projectHeads = heads.filter((head) => head.project_id === project.project_id);
      if (semanticAssets.length !== projectHeads.length) {
        assetFindings.push({ projectId: project.project_id, code: 'ASSET_LIBRARY_SNAPSHOT_COUNT_MISMATCH', message: 'Normalized asset heads differ from the semantic project head count.' });
      }
      for (const semantic of semanticAssets) {
        const head = projectHeads.find((entry) => entry.asset_id === semantic.assetId);
        const latest = latestByAsset.get(`${project.project_id}:${semantic.assetId}`);
        if (!head || !latest || Number(latest.asset_version) !== semantic.assetVersion
          || Number(latest.metadata_version) !== semantic.metadataVersion || latest.name !== semantic.name
          || latest.kind !== semantic.kind || latest.lifecycle !== semantic.lifecycle
          || fingerprint(JSON.parse(latest.metadata_json)) !== fingerprint(semantic.metadata)
          || latest.slice_id !== semantic.sliceBinding.sliceId
          || Number(latest.slice_version) !== semantic.sliceBinding.sliceVersion) {
          assetFindings.push({ projectId: project.project_id, assetId: semantic.assetId, code: 'ASSET_LIBRARY_SNAPSHOT_MISMATCH', message: 'Normalized latest asset differs from the semantic project head.' });
        }
      }
    }
  } catch (error) {
    assetFindings.push({ projectId: null, code: 'ASSET_LIBRARY_QUERY_FAILED', message: 'V9 asset integrity could not be inspected.', cause: error.message });
  }
  const assets = { ok: assetFindings.length === 0, versionCount: assetVersionCount, findings: assetFindings };

  const roomFindings = [];
  let roomVersionCount = 0;
  try {
    const db = projectStore.workspace.database;
    const projectHeads = db.prepare('SELECT project_id, head_snapshot_json FROM projects ORDER BY project_id').all();
    const snapshotByProject = new Map(projectHeads.map((row) => {
      try { return [row.project_id, JSON.parse(row.head_snapshot_json)]; } catch { return [row.project_id, null]; }
    }));
    const archetypes = db.prepare('SELECT * FROM room_archetype_versions ORDER BY project_id, room_archetype_id, archetype_version').all();
    const rulesForArchetype = db.prepare(`
      SELECT rule_id, rule_order, summary FROM room_archetype_governing_rules
      WHERE project_id = ? AND room_archetype_id = ? AND archetype_version = ?
      ORDER BY rule_order
    `);
    const latestArchetype = new Map();
    for (const row of archetypes) {
      let value;
      try { value = JSON.parse(row.archetype_json); } catch {
        roomFindings.push({ projectId: row.project_id, roomArchetypeId: row.room_archetype_id, code: 'ROOM_ARCHETYPE_JSON_INVALID', message: 'Room archetype JSON is invalid.' });
        continue;
      }
      if (fingerprint(value) !== row.content_fingerprint || value.roomArchetypeId !== row.room_archetype_id
        || value.version !== Number(row.archetype_version) || value.kind !== row.kind || value.displayName !== row.display_name) {
        roomFindings.push({ projectId: row.project_id, roomArchetypeId: row.room_archetype_id, code: 'ROOM_ARCHETYPE_CONTENT_MISMATCH', message: 'Normalized archetype columns or fingerprint differ from immutable JSON.' });
      }
      const rules = rulesForArchetype.all(row.project_id, row.room_archetype_id, row.archetype_version);
      if (rules.some((rule, index) => Number(rule.rule_order) !== index)
        || fingerprint(rules.map((rule) => ({ ruleId: rule.rule_id, summary: rule.summary }))) !== fingerprint(value.governingRuleRefs ?? [])) {
        roomFindings.push({ projectId: row.project_id, roomArchetypeId: row.room_archetype_id, code: 'ROOM_ARCHETYPE_RULES_MISMATCH', message: 'Normalized governing rules differ from immutable archetype content.' });
      }
      latestArchetype.set(`${row.project_id}:${row.room_archetype_id}`, row);
    }
    const archetypeHeads = db.prepare('SELECT * FROM room_archetype_heads ORDER BY project_id, room_archetype_id').all();
    for (const head of archetypeHeads) {
      const latest = latestArchetype.get(`${head.project_id}:${head.room_archetype_id}`);
      if (!latest || Number(head.archetype_version) !== Number(latest.archetype_version)
        || head.kind !== latest.kind || head.display_name !== latest.display_name) {
        roomFindings.push({ projectId: head.project_id, roomArchetypeId: head.room_archetype_id, code: 'ROOM_ARCHETYPE_HEAD_MISMATCH', message: 'Room archetype head differs from its latest immutable version.' });
      }
    }

    const versions = db.prepare('SELECT * FROM room_variant_versions ORDER BY project_id, room_variant_id, variant_version').all();
    roomVersionCount = versions.length;
    const intentForVersion = db.prepare(`SELECT * FROM room_variant_intent WHERE project_id = ? AND room_variant_id = ? AND variant_version = ? ORDER BY intent_order`);
    const connectorsForVersion = db.prepare(`SELECT * FROM room_variant_connectors WHERE project_id = ? AND room_variant_id = ? AND variant_version = ? ORDER BY connector_order`);
    const placementsForVersion = db.prepare(`SELECT * FROM room_variant_placements WHERE project_id = ? AND room_variant_id = ? AND variant_version = ? ORDER BY placement_order`);
    const shapeForVersion = db.prepare(`SELECT * FROM room_variant_shape_cells WHERE project_id = ? AND room_variant_id = ? AND variant_version = ? ORDER BY cell_order`);
    const findingsForVersion = db.prepare(`SELECT * FROM room_variant_findings WHERE project_id = ? AND room_variant_id = ? AND variant_version = ? ORDER BY finding_order`);
    const dispositionsForVersion = db.prepare(`SELECT * FROM room_variant_warning_dispositions WHERE project_id = ? AND room_variant_id = ? AND variant_version = ? ORDER BY disposition_order`);
    const exactAsset = db.prepare(`SELECT metadata_version FROM asset_versions WHERE project_id = ? AND asset_id = ? AND asset_version = ?`);
    const latestRoom = new Map();
    for (const row of versions) {
      const key = `${row.project_id}:${row.room_variant_id}`;
      const prior = latestRoom.get(key);
      if (Number(row.variant_version) !== (prior ? Number(prior.variant_version) + 1 : 1)
        || Number(row.previous_variant_version ?? 0) !== (prior ? Number(prior.variant_version) : 0)) {
        roomFindings.push({ projectId: row.project_id, roomVariantId: row.room_variant_id, code: 'ROOM_VERSION_SEQUENCE_INVALID', message: 'Room versions or immediate-parent lineage are not consecutive.' });
      }
      latestRoom.set(key, row);
      let value;
      let findings;
      let intent;
      let connectors;
      let placements;
      let voidCells;
      let blockedCells;
      try {
        value = JSON.parse(row.variant_json);
        const findingRows = findingsForVersion.all(row.project_id, row.room_variant_id, row.variant_version);
        findings = findingRows.map((findingRow) => JSON.parse(findingRow.finding_json));
        intent = intentForVersion.all(row.project_id, row.room_variant_id, row.variant_version).map((intentRow) => ({
          layer: intentRow.layer, ruleId: intentRow.rule_id, summary: intentRow.summary, disposition: intentRow.disposition,
        }));
        connectors = connectorsForVersion.all(row.project_id, row.room_variant_id, row.variant_version).map((connectorRow) => JSON.parse(connectorRow.connector_json));
        placements = placementsForVersion.all(row.project_id, row.room_variant_id, row.variant_version).map((placementRow) => JSON.parse(placementRow.placement_json));
        const shapeRows = shapeForVersion.all(row.project_id, row.room_variant_id, row.variant_version);
        if (shapeRows.some((shapeRow, index) => Number(shapeRow.cell_order) !== index)) {
          roomFindings.push({ projectId: row.project_id, roomVariantId: row.room_variant_id, code: 'ROOM_SHAPE_ORDER_MISMATCH', message: 'Normalized room shape cell order is not canonical.' });
        }
        voidCells = shapeRows.filter(({ cell_kind: kind }) => kind === 'VOID').map(({ x, y }) => ({ x: Number(x), y: Number(y) }));
        blockedCells = shapeRows.filter(({ cell_kind: kind }) => kind === 'BLOCKED').map(({ x, y }) => ({ x: Number(x), y: Number(y) }));
        for (const [index, findingRow] of findingRows.entries()) {
          const findingValue = findings[index];
          if (Number(findingRow.finding_order) !== index || findingValue.findingId !== findingRow.finding_id
            || findingValue.severity !== findingRow.severity || findingValue.ruleId !== findingRow.rule_id
            || findingValue.targetKind !== findingRow.target_kind || findingValue.targetId !== findingRow.target_id
            || findingValue.path !== findingRow.path || findingValue.explanation !== findingRow.explanation
            || findingValue.remediation !== findingRow.remediation || findingValue.validatorVersion !== findingRow.validator_version) {
            roomFindings.push({ projectId: row.project_id, roomVariantId: row.room_variant_id, code: 'ROOM_FINDING_COLUMNS_MISMATCH', message: 'Room finding columns differ from immutable JSON.' });
          }
        }
      } catch {
        roomFindings.push({ projectId: row.project_id, roomVariantId: row.room_variant_id, code: 'ROOM_VERSION_JSON_INVALID', message: 'Room version or normalized child JSON is invalid.' });
        continue;
      }
      if (fingerprint({ variant: value, findings }) !== row.content_fingerprint
        || fingerprint(findings) !== row.findings_fingerprint
        || value.version !== Number(row.variant_version) || value.lifecycle !== row.lifecycle
        || value.width !== Number(row.width) || value.height !== Number(row.height)
        || fingerprint(value.intentTrace) !== fingerprint(intent)
        || fingerprint(value.connectors) !== fingerprint(connectors)
        || fingerprint(value.placements) !== fingerprint(placements)
        || fingerprint(value.voidCells ?? []) !== fingerprint(voidCells)
        || fingerprint(value.blockedCells ?? []) !== fingerprint(blockedCells)) {
        roomFindings.push({ projectId: row.project_id, roomVariantId: row.room_variant_id, code: 'ROOM_VERSION_CONTENT_MISMATCH', message: 'Normalized room content, child records, or fingerprints disagree.' });
      }
      for (const placement of placements) {
        const asset = exactAsset.get(row.project_id, placement.assetId, placement.assetVersion);
        if (!asset || Number(asset.metadata_version) !== placement.metadataVersion) {
          roomFindings.push({ projectId: row.project_id, roomVariantId: row.room_variant_id, placementId: placement.placementId, code: 'ROOM_ASSET_PIN_MISSING', message: 'A room placement lost its exact asset and metadata version.' });
        }
      }
      const dispositions = dispositionsForVersion.all(row.project_id, row.room_variant_id, row.variant_version);
      const warningIds = new Set(findings.filter((findingValue) => findingValue.severity === 'WARNING').map((findingValue) => findingValue.findingId));
      if (dispositions.some((entry, index) => Number(entry.disposition_order) !== index || !warningIds.has(entry.finding_id))
        || fingerprint(dispositions.map((entry) => entry.finding_id)) !== fingerprint(value.acceptedWarningFindingIds ?? [])) {
        roomFindings.push({ projectId: row.project_id, roomVariantId: row.room_variant_id, code: 'ROOM_WARNING_DISPOSITION_MISMATCH', message: 'Room warning dispositions differ from current warning findings or semantic content.' });
      }
      if (row.lifecycle === 'FINAL' && (findings.some((findingValue) => findingValue.severity === 'ERROR')
        || findings.some((findingValue) => findingValue.severity === 'WARNING' && !value.acceptedWarningFindingIds.includes(findingValue.findingId)))) {
        roomFindings.push({ projectId: row.project_id, roomVariantId: row.room_variant_id, code: 'ROOM_FINAL_FINDINGS_INVALID', message: 'A FINAL room retains a blocking or undispositioned finding.' });
      }
      const semanticEntry = snapshotByProject.get(row.project_id)?.roomLibrary?.variants?.find((entry) => entry.roomVariantId === row.room_variant_id);
      const semantic = semanticEntry?.versions?.find((version) => version.version === Number(row.variant_version));
      if (!semantic || semantic.contentFingerprint !== row.content_fingerprint
        || fingerprint(semantic.findings) !== fingerprint(findings) || fingerprint({
          projectId: semantic.projectId, roomVariantId: semantic.roomVariantId, version: semantic.version,
          roomArchetypeId: semantic.roomArchetypeId, archetypeVersion: semantic.archetypeVersion,
          displayName: semantic.displayName, lifecycle: semantic.lifecycle, width: semantic.width,
          height: semantic.height, origin: semantic.origin, intentTrace: semantic.intentTrace,
          connectors: semantic.connectors, placements: semantic.placements,
          ...(semantic.voidCells?.length ? { voidCells: semantic.voidCells } : Object.hasOwn(value, 'voidCells') ? { voidCells: semantic.voidCells ?? [] } : {}),
          ...(semantic.blockedCells?.length ? { blockedCells: semantic.blockedCells } : Object.hasOwn(value, 'blockedCells') ? { blockedCells: semantic.blockedCells ?? [] } : {}),
          acceptedWarningFindingIds: semantic.acceptedWarningFindingIds,
          parentVariantVersion: semantic.parentVariantVersion, parentFinalVersion: semantic.parentFinalVersion,
        }) !== fingerprint(value)) {
        roomFindings.push({ projectId: row.project_id, roomVariantId: row.room_variant_id, code: 'ROOM_VERSION_SNAPSHOT_MISMATCH', message: 'Normalized room version differs from the semantic project head history.' });
      }
    }
    const roomHeads = db.prepare('SELECT * FROM room_variant_heads ORDER BY project_id, room_variant_id').all();
    for (const head of roomHeads) {
      const latest = latestRoom.get(`${head.project_id}:${head.room_variant_id}`);
      if (!latest || Number(head.variant_version) !== Number(latest.variant_version)
        || head.lifecycle !== latest.lifecycle || head.display_name !== latest.display_name
        || Number(head.width) !== Number(latest.width) || Number(head.height) !== Number(latest.height)) {
        roomFindings.push({ projectId: head.project_id, roomVariantId: head.room_variant_id, code: 'ROOM_HEAD_MISMATCH', message: 'Room head differs from its latest immutable version.' });
      }
    }
    for (const [projectId, snapshot] of snapshotByProject) {
      if (!snapshot) continue;
      const semanticArchetypes = snapshot.roomLibrary?.archetypes ?? [];
      const semanticVariants = snapshot.roomLibrary?.variants ?? [];
      if (semanticArchetypes.length !== archetypeHeads.filter((head) => head.project_id === projectId).length
        || semanticVariants.length !== roomHeads.filter((head) => head.project_id === projectId).length) {
        roomFindings.push({ projectId, code: 'ROOM_LIBRARY_SNAPSHOT_COUNT_MISMATCH', message: 'Normalized room/archetype heads differ from semantic head counts.' });
      }
    }
    const proposals = db.prepare('SELECT * FROM room_placement_proposals ORDER BY project_id, proposal_id').all();
    for (const proposal of proposals) {
      const items = db.prepare('SELECT * FROM room_placement_proposal_items WHERE project_id = ? AND proposal_id = ? ORDER BY item_order').all(proposal.project_id, proposal.proposal_id);
      const decisions = db.prepare('SELECT * FROM room_placement_proposal_decisions WHERE project_id = ? AND proposal_id = ? ORDER BY item_id').all(proposal.project_id, proposal.proposal_id);
      const application = db.prepare('SELECT * FROM room_placement_proposal_applications WHERE project_id = ? AND proposal_id = ?').get(proposal.project_id, proposal.proposal_id);
      const findingRows = db.prepare('SELECT * FROM room_placement_proposal_findings WHERE project_id = ? AND proposal_id = ? ORDER BY finding_order').all(proposal.project_id, proposal.proposal_id);
      let findingValues = [];
      try { findingValues = findingRows.map((row) => JSON.parse(row.finding_json)); } catch {}
      if (items.length !== Number(proposal.item_count)
        || fingerprint(findingValues) !== proposal.finding_fingerprint
        || (proposal.status !== 'PENDING' && decisions.length !== items.length)
        || (proposal.status === 'APPLIED' && (!application || Number(application.accepted_count) + Number(application.rejected_count) !== items.length))) {
        roomFindings.push({ projectId: proposal.project_id, proposalId: proposal.proposal_id, code: 'ROOM_PROPOSAL_PROJECTION_MISMATCH', message: 'Room proposal items, findings, decisions, application, and state disagree.' });
      }
      const semantic = snapshotByProject.get(proposal.project_id)?.roomLibrary?.proposals?.find((entry) => entry.proposalId === proposal.proposal_id);
      if (!semantic || semantic.state !== proposal.status || semantic.fingerprint !== proposal.request_fingerprint
        || semantic.items.length !== Number(proposal.item_count)
        || Number(semantic.submittedRevision) !== Number(proposal.created_revision)
        || Number(semantic.decisionRevision) !== Number(proposal.decided_revision)
        || Number(semantic.appliedRevision) !== Number(proposal.applied_revision)) {
        roomFindings.push({ projectId: proposal.project_id, proposalId: proposal.proposal_id, code: 'ROOM_PROPOSAL_SNAPSHOT_MISMATCH', message: 'Durable room proposal differs from the semantic project head.' });
      }
    }
  } catch (error) {
    roomFindings.push({ projectId: null, code: 'ROOM_DESIGNER_QUERY_FAILED', message: 'V10 room integrity could not be inspected.', cause: error.message });
  }
  const rooms = { ok: roomFindings.length === 0, versionCount: roomVersionCount, findings: roomFindings };

  const taskFindings = [];
  let taskCount = 0;
  try {
    const db = projectStore.workspace.database;
    const taskRows = db.prepare('SELECT * FROM agent_tasks ORDER BY project_id, task_id').all();
    taskCount = taskRows.length;
    const branchRows = db.prepare(`
      SELECT * FROM task_branch_revisions
      WHERE project_id = ? AND task_id = ? ORDER BY branch_revision
    `);
    const timelineRows = db.prepare(`
      SELECT * FROM task_timeline_events
      WHERE project_id = ? AND task_id = ? ORDER BY sequence
    `);
    const reviewRows = db.prepare(`
      SELECT * FROM task_reviews
      WHERE project_id = ? AND task_id = ? ORDER BY review_id, review_version
    `);
    const mergeRow = db.prepare('SELECT * FROM task_merges WHERE project_id = ? AND task_id = ?');
    const revertRow = db.prepare('SELECT * FROM task_reverts WHERE project_id = ? AND merge_id = ?');
    for (const row of taskRows) {
      let task;
      let baseDocument;
      let headDocument;
      try {
        task = JSON.parse(row.task_json);
        baseDocument = JSON.parse(row.base_document_json);
        headDocument = JSON.parse(row.head_document_json);
      } catch {
        taskFindings.push({ projectId: row.project_id, taskId: row.task_id, code: 'TASK_JSON_INVALID', message: 'Task or branch document JSON is invalid.' });
        continue;
      }
      if (task.projectId !== row.project_id || task.taskId !== row.task_id
        || task.branchId !== row.branch_id || task.agentId !== row.agent_id
        || (task.grantId ?? null) !== row.grant_id || task.state !== row.state
        || Number(task.baseRevision) !== taskBranchBaseRevision(row)
        || Number(task.headRevision) !== Number(row.head_revision)
        || task.expiresAt !== row.expires_at || task.updatedAt !== row.updated_at) {
        taskFindings.push({ projectId: row.project_id, taskId: row.task_id, code: 'TASK_COLUMNS_MISMATCH', message: 'Task columns differ from their durable semantic JSON.' });
      }
      const baseHead = baseDocument?.revisions?.at(-1);
      const branchHead = headDocument?.revisions?.at(-1);
      if (baseDocument?.projectId !== row.project_id || headDocument?.projectId !== row.project_id
        || Number(baseHead?.number) !== taskBranchBaseRevision(row)
        || Number(branchHead?.number) !== Number(row.head_revision)) {
        taskFindings.push({ projectId: row.project_id, taskId: row.task_id, code: 'TASK_BRANCH_HEAD_MISMATCH', message: 'Task base/head documents do not match their durable revision pointers.' });
      }
      const revisions = branchRows.all(row.project_id, row.task_id);
      const expectedHead = revisions.length > 0
        ? taskBranchBaseRevision(row) + revisions.length
        : taskBranchBaseRevision(row);
      if (expectedHead !== Number(row.head_revision)) {
        taskFindings.push({ projectId: row.project_id, taskId: row.task_id, code: 'TASK_BRANCH_SEQUENCE_INVALID', message: 'Task branch revisions are missing or non-consecutive.' });
      }
      for (const [index, revisionRow] of revisions.entries()) {
        let revision;
        try { revision = JSON.parse(revisionRow.revision_json); } catch {
          taskFindings.push({ projectId: row.project_id, taskId: row.task_id, code: 'TASK_BRANCH_REVISION_JSON_INVALID', message: 'A task branch revision contains invalid JSON.' });
          continue;
        }
        const expectedRevision = taskBranchBaseRevision(row) + index + 1;
        const documentRevision = headDocument?.revisions?.find((candidate) => candidate.number === expectedRevision);
        if (Number(revisionRow.branch_revision) !== expectedRevision
          || revision.id !== revisionRow.revision_id || revision.number !== expectedRevision
          || revision.parentRevision !== expectedRevision - 1
          || revision.command?.commandId !== revisionRow.command_id
          || revision.command?.idempotencyKey !== revisionRow.idempotency_key
          || revision.command?.type !== revisionRow.command_type
          || revision.command?.branchId !== row.branch_id
          || revision.command?.taskId !== row.task_id
          || revision.committedAt !== revisionRow.committed_at
          || fingerprint(documentRevision) !== fingerprint(revision)) {
          taskFindings.push({ projectId: row.project_id, taskId: row.task_id, branchRevision: expectedRevision, code: 'TASK_BRANCH_REVISION_MISMATCH', message: 'A normalized task branch revision differs from its immutable branch document.' });
        }
      }
      const events = timelineRows.all(row.project_id, row.task_id);
      const eventsById = new Map();
      let latestEvent = null;
      for (const [index, eventRow] of events.entries()) {
        let event;
        try { event = JSON.parse(eventRow.event_json); } catch {
          taskFindings.push({ projectId: row.project_id, taskId: row.task_id, code: 'TASK_TIMELINE_JSON_INVALID', message: 'A task timeline event contains invalid JSON.' });
          continue;
        }
        latestEvent = event;
        eventsById.set(event.eventId, event);
        if (Number(eventRow.sequence) !== index + 1 || event.sequence !== index + 1
          || event.projectId !== row.project_id || event.taskId !== row.task_id
          || event.eventId !== eventRow.event_id || event.occurredAt !== eventRow.occurred_at
          || event.type !== eventRow.event_type) {
          taskFindings.push({ projectId: row.project_id, taskId: row.task_id, sequence: index + 1, code: 'TASK_TIMELINE_MISMATCH', message: 'Task timeline columns, order, and immutable event JSON disagree.' });
        }
      }
      if (events.length === 0 || latestEvent?.state !== row.state) {
        taskFindings.push({ projectId: row.project_id, taskId: row.task_id, code: 'TASK_TIMELINE_STATE_MISMATCH', message: 'The latest task timeline state does not match the durable task state.' });
      }
      const reviews = reviewRows.all(row.project_id, row.task_id);
      const nextVersionByReview = new Map();
      const expectedFeedbackByReview = new Map();
      for (const reviewRowValue of reviews) {
        let review;
        try { review = JSON.parse(reviewRowValue.review_json); } catch {
          taskFindings.push({ projectId: row.project_id, taskId: row.task_id, reviewId: reviewRowValue.review_id, code: 'TASK_REVIEW_JSON_INVALID', message: 'A task review contains invalid JSON.' });
          continue;
        }
        const expectedVersion = nextVersionByReview.get(reviewRowValue.review_id) ?? 1;
        nextVersionByReview.set(reviewRowValue.review_id, expectedVersion + 1);
        if (Number(reviewRowValue.review_version) !== expectedVersion
          || review.reviewId !== reviewRowValue.review_id || review.reviewVersion !== expectedVersion
          || review.projectId !== row.project_id || review.taskId !== row.task_id
          || review.branchId !== row.branch_id || review.state !== reviewRowValue.state) {
          taskFindings.push({ projectId: row.project_id, taskId: row.task_id, reviewId: reviewRowValue.review_id, reviewVersion: expectedVersion, code: 'TASK_REVIEW_MISMATCH', message: 'Task review versions or normalized columns disagree.' });
        }
        const decisionEvent = eventsById.get(`task-event:${row.task_id}:review:${reviewRowValue.review_id}:${expectedVersion}`);
        if (decisionEvent?.details && Object.hasOwn(decisionEvent.details, 'feedback')) {
          expectedFeedbackByReview.set(reviewRowValue.review_id, decisionEvent.details.feedback);
        }
        // Decision provenance survives later legacy decisions and merge versions.
        // Its presence, rather than the possibly damaged review field, determines
        // whether feedback is required. True legacy histories retain no feedback.
        const expectsFeedback = expectedFeedbackByReview.has(reviewRowValue.review_id);
        if (expectsFeedback || Object.hasOwn(review, 'feedback')) {
          try {
            invariant(expectsFeedback && Object.hasOwn(review, 'feedback')
              && fingerprint(review.feedback) === fingerprint(expectedFeedbackByReview.get(reviewRowValue.review_id)),
            'TASK_REVIEW_FEEDBACK_MISMATCH', 'Review feedback differs from its immutable decision and timeline basis.');
            const feedback = validateReviewFeedback(review.feedback);
            const basis = reviews.find((entry) => entry.review_id === review.reviewId && Number(entry.review_version) === feedback.basisReviewVersion);
            const originRow = reviews.find((entry) => entry.review_id === review.reviewId && Number(entry.review_version) === feedback.basisReviewVersion + 1);
            const origin = originRow ? JSON.parse(originRow.review_json) : null;
            const event = eventsById.get(`task-event:${row.task_id}:review:${review.reviewId}:${feedback.basisReviewVersion + 1}`);
            invariant(review.kind !== 'studio.level-candidate-review' && basis && origin
              && feedback.basisReviewVersion < review.reviewVersion
              && fingerprint(feedback) === fingerprint(review.feedback)
              && fingerprint(origin.feedback) === fingerprint(feedback)
              && origin.updatedAt === feedback.createdAt && originRow.created_at === feedback.createdAt
              && feedback.authorId === review.createdBy
              && ['REVIEW_DECIDED', 'REVIEW_CHANGES_REQUESTED'].includes(event?.type)
              && event.actorId === feedback.authorId && event.occurredAt === feedback.createdAt
              && fingerprint(event.details?.feedback) === fingerprint(feedback),
            'TASK_REVIEW_FEEDBACK_MISMATCH', 'Review feedback differs from its immutable decision and timeline basis.');
          } catch {
            taskFindings.push({ projectId: row.project_id, taskId: row.task_id, reviewId: review.reviewId, reviewVersion: expectedVersion, code: 'TASK_REVIEW_FEEDBACK_MISMATCH', message: 'Review feedback differs from its immutable decision and timeline basis.' });
          }
        }
      }
      const merge = mergeRow.get(row.project_id, row.task_id);
      if (row.state === 'MERGED' && !merge) {
        taskFindings.push({ projectId: row.project_id, taskId: row.task_id, code: 'TASK_MERGE_MISSING', message: 'A merged task has no immutable merge record.' });
      }
      if (merge) {
        let mergeValue;
        try { mergeValue = JSON.parse(merge.merge_json); } catch {}
        if (!mergeValue || mergeValue.mergeId !== merge.merge_id || mergeValue.taskId !== row.task_id
          || mergeValue.projectId !== row.project_id || Number(mergeValue.firstRevision) !== Number(merge.first_revision)
          || Number(mergeValue.lastRevision) !== Number(merge.last_revision)) {
          taskFindings.push({ projectId: row.project_id, taskId: row.task_id, code: 'TASK_MERGE_MISMATCH', message: 'Task merge columns differ from immutable merge JSON.' });
        }
        const revert = revertRow.get(row.project_id, merge.merge_id);
        if (revert) {
          let revertValue;
          try { revertValue = JSON.parse(revert.revert_json); } catch {}
          if (!revertValue || revertValue.revertId !== revert.revert_id || revertValue.mergeId !== merge.merge_id
            || revertValue.projectId !== row.project_id || revertValue.taskId !== row.task_id
            || Number(revertValue.firstRevision) !== Number(revert.first_revision)
            || Number(revertValue.lastRevision) !== Number(revert.last_revision)) {
            taskFindings.push({ projectId: row.project_id, taskId: row.task_id, code: 'TASK_REVERT_MISMATCH', message: 'Task revert columns differ from immutable revert JSON.' });
          }
        }
      }
    }
    if (database.userVersion >= 15) {
      const relations = db.prepare(`
        SELECT * FROM derived_task_relations ORDER BY project_id, parent_task_id, child_task_id
      `).all();
      const relationTaskKeys = new Set(relations.map((row) => JSON.stringify([row.project_id, row.child_task_id])));
      for (const taskRowValue of taskRows) {
        let taskValue = null;
        try { taskValue = JSON.parse(taskRowValue.task_json); } catch {}
        if (taskValue?.derivation?.kind === 'TRUSTED_SERVICE_CHILD'
          && !relationTaskKeys.has(JSON.stringify([taskRowValue.project_id, taskRowValue.task_id]))) {
          taskFindings.push({
            projectId: taskRowValue.project_id,
            taskId: taskRowValue.task_id,
            code: 'DERIVED_TASK_RELATION_MISSING',
            message: 'A service-derived task lost its immutable ancestor relation.',
          });
        }
      }
      for (const row of relations) {
        let relation;
        let result;
        let reservation;
        try {
          relation = JSON.parse(row.relation_json);
          result = JSON.parse(row.result_json);
          reservation = JSON.parse(row.reservation_json);
        } catch {
          taskFindings.push({ projectId: row.project_id, taskId: row.child_task_id, code: 'DERIVED_TASK_JSON_INVALID', message: 'Derived-child lineage JSON is invalid.' });
          continue;
        }
        const parent = taskRows.find((candidate) => candidate.project_id === row.project_id && candidate.task_id === row.parent_task_id);
        const child = taskRows.find((candidate) => candidate.project_id === row.project_id && candidate.task_id === row.child_task_id);
        const childGrant = db.prepare('SELECT * FROM grants WHERE project_id = ? AND grant_id = ?').get(row.project_id, row.child_grant_id);
        let parentTask;
        let childTask;
        let parentDocument;
        let childBaseDocument;
        let childGrantScopes;
        let childGrantObjectScopes;
        let childGrantBudget;
        let childGrantUsage;
        try {
          parentTask = JSON.parse(parent?.task_json ?? 'null');
          childTask = JSON.parse(child?.task_json ?? 'null');
          parentDocument = JSON.parse(parent?.head_document_json ?? 'null');
          childBaseDocument = JSON.parse(child?.base_document_json ?? 'null');
          childGrantScopes = JSON.parse(childGrant?.scopes_json ?? 'null');
          childGrantObjectScopes = JSON.parse(childGrant?.object_scopes_json ?? 'null');
          childGrantBudget = JSON.parse(childGrant?.budget_json ?? 'null');
          childGrantUsage = JSON.parse(childGrant?.usage_json ?? 'null');
        } catch {}
        const parentOriginIndex = parentDocument?.revisions?.findIndex(
          (revision) => Number(revision.number) === Number(row.parent_head_revision),
        ) ?? -1;
        const parentOriginHead = parentOriginIndex >= 0 ? parentDocument.revisions[parentOriginIndex] : null;
        const parentOriginDocument = parentOriginIndex >= 0
          ? { ...parentDocument, revisions: parentDocument.revisions.slice(0, parentOriginIndex + 1) }
          : null;
        const parentPriorHead = parentDocument?.revisions?.find(
          (revision) => Number(revision.number) === Number(row.parent_head_revision) - 1,
        );
        const parentOriginGrant = parentOriginHead?.snapshot?.grants?.find(({ id }) => id === row.parent_grant_id);
        const parentPriorGrant = parentPriorHead?.snapshot?.grants?.find(({ id }) => id === row.parent_grant_id);
        const columnsClose = relation?.kind === 'studio.derived-child-task-relation'
          && relation.projectId === row.project_id
          && relation.childTaskId === row.child_task_id
          && relation.parentTaskId === row.parent_task_id
          && relation.rootTaskId === row.root_task_id
          && relation.childGrantId === row.child_grant_id
          && relation.parentGrantId === row.parent_grant_id
          && Number(relation.parentHeadRevision) === Number(row.parent_head_revision)
          && relation.parentHeadFingerprint === row.parent_head_fingerprint
          && sameFingerprint(relation.reservation, reservation)
          && relation.createdAt === row.created_at
          && result?.kind === 'studio.derived-child-task-result'
          && result?.task?.taskId === row.child_task_id
          && result?.relation?.childTaskId === row.child_task_id;
        const authorityCloses = parent && child && childGrant
          && !relations.some((candidate) => candidate.child_task_id === row.parent_task_id)
          && row.root_task_id === row.parent_task_id
          && fingerprint(parentOriginHead) === row.parent_head_fingerprint
          && Number(child.branch_origin_revision) === Number(row.parent_head_revision)
          && Number(childTask?.baseRevision) === Number(row.parent_head_revision)
          && sameFingerprint(childBaseDocument, parentOriginDocument)
          && childTask?.agentId === parentTask?.agentId
          && childTask?.derivation?.kind === 'TRUSTED_SERVICE_CHILD'
          && childTask?.derivation?.parentTaskId === row.parent_task_id
          && childTask?.derivation?.rootTaskId === row.root_task_id
          && childTask?.derivation?.furtherChildDerivation === 'NOT_AUTHORIZED'
          && sameFingerprint(childTask?.capabilities, ['level.candidate.create'])
          && sameFingerprint(childTask?.objectScopes, parentTask?.objectScopes)
          && sameFingerprint(childTask?.budget, reservation)
          && childTask?.autoAcceptPolicy?.enabled === false
          && Date.parse(childTask?.expiresAt) <= Date.parse(parentTask?.expiresAt)
          && Date.parse(childTask?.expiresAt) <= Date.parse(parentOriginGrant?.expiresAt)
          && sameFingerprint(parentTask?.reservedForChildren, {
            commands: reservation?.maxCommands,
            jobs: reservation?.maxJobs,
            artifactBytes: reservation?.maxArtifactBytes,
            costCents: reservation?.maxCostCents,
          })
          && reservationCloses(parentPriorGrant?.usage, parentOriginGrant?.usage, reservation)
          && childGrant.task_id === row.child_task_id
          && childGrant.agent_id === childTask?.agentId
          && childGrant.branch_id === childTask?.branchId
          && childGrant.expires_at === childTask?.expiresAt
          && sameFingerprint(childGrantScopes, childTask?.capabilities)
          && sameFingerprint(childGrantObjectScopes, childTask?.objectScopes)
          && sameFingerprint(childGrantBudget, reservation)
          && sameFingerprint(childGrantUsage, { commands: 0, jobs: 0, artifactBytes: 0, costCents: 0 })
          && sameFingerprint(result?.relation, relation)
          && sameFingerprint(result?.task?.capabilities, childTask?.capabilities)
          && sameFingerprint(result?.task?.objectScopes, childTask?.objectScopes)
          && sameFingerprint(result?.task?.budget, childTask?.budget)
          && result?.task?.autoAcceptPolicy?.enabled === false;
        if (!columnsClose || !authorityCloses) {
          taskFindings.push({
            projectId: row.project_id,
            taskId: row.child_task_id,
            code: 'DERIVED_TASK_AUTHORITY_MISMATCH',
            message: 'Derived-child lineage, exact parent head, grant, reservation, and immutable task authority disagree.',
          });
        }
      }
    }
    if (database.userVersion >= 13) {
      const adoptionRows = db.prepare(`
        SELECT * FROM task_branch_processing_result_adoptions
        ORDER BY project_id, task_id, branch_revision
      `).all();
      const adoptionReferences = db.prepare(`
        SELECT * FROM task_branch_processing_result_artifact_references
        WHERE project_id = ? AND task_id = ? AND branch_revision = ?
        ORDER BY role
      `);
      const adoptionBranchRevision = db.prepare(`
        SELECT * FROM task_branch_revisions
        WHERE project_id = ? AND task_id = ? AND branch_revision = ?
      `);
      const adoptionTask = db.prepare(`
        SELECT * FROM agent_tasks WHERE project_id = ? AND task_id = ?
      `);
      const artifactForAdoption = db.prepare(`
        SELECT uri, media_type, byte_size, width, height, state
        FROM artifacts WHERE digest = ?
      `);
      const usageChecked = new Set();
      const adoptionProjectionByTask = new Map(taskRows.map((taskRow) => [
        JSON.stringify([taskRow.project_id, taskRow.task_id]),
        {
          projectId: taskRow.project_id,
          taskId: taskRow.task_id,
          assetsByRevision: new Map(),
        },
      ]));

      for (const adoption of adoptionRows) {
        const coordinates = {
          projectId: adoption.project_id,
          taskId: adoption.task_id,
          branchRevision: Number(adoption.branch_revision),
        };
        const adoptionTaskRow = adoptionTask.get(adoption.project_id, adoption.task_id);
        const usageKey = `${adoption.project_id}:${adoption.task_id}`;
        if (!usageChecked.has(usageKey)) {
          usageChecked.add(usageKey);
          let taskValue = null;
          let baseValue = null;
          let headValue = null;
          try {
            taskValue = JSON.parse(adoptionTaskRow?.task_json ?? 'null');
            baseValue = JSON.parse(adoptionTaskRow?.base_document_json ?? 'null');
            headValue = JSON.parse(adoptionTaskRow?.head_document_json ?? 'null');
          } catch {}
          const baseGrant = baseValue?.revisions?.at(-1)?.snapshot?.grants?.find(
            (grant) => grant.id === adoptionTaskRow?.grant_id,
          );
          const headGrant = headValue?.revisions?.at(-1)?.snapshot?.grants?.find(
            (grant) => grant.id === adoptionTaskRow?.grant_id,
          );
          const baseCommands = Number(baseGrant?.usage?.commands);
          const headCommands = Number(headGrant?.usage?.commands);
          const taskCommands = Number(taskValue?.usage?.commands);
          const branchCharges = branchRows.all(adoption.project_id, adoption.task_id)
            .map((row) => branchCommandBudgetCharge(row.revision_json));
          const branchCharge = branchCharges.every(Number.isSafeInteger)
            ? branchCharges.reduce((total, charge) => total + charge, 0)
            : null;
          if (!Number.isSafeInteger(baseCommands)
            || !Number.isSafeInteger(headCommands)
            || !Number.isSafeInteger(taskCommands)
            || !Number.isSafeInteger(branchCharge)
            || headCommands !== taskCommands
            || headCommands !== baseCommands + branchCharge) {
            taskFindings.push({
              projectId: adoption.project_id,
              taskId: adoption.task_id,
              code: 'TASK_PROCESSING_ADOPTION_USAGE_MISMATCH',
              message: 'Task usage and embedded branch-grant usage do not match the canonical branch command-charge history.',
            });
          }
        }
        let aggregate = null;
        let result = null;
        try {
          aggregate = validateProcessingResultAdoptionAggregate(JSON.parse(adoption.record_json));
          result = validateProcessingResultAdoptionCommitResult(JSON.parse(adoption.result_json));
          const taskProjectionKey = JSON.stringify([adoption.project_id, adoption.task_id]);
          const taskProjection = adoptionProjectionByTask.get(taskProjectionKey) ?? {
            projectId: adoption.project_id,
            taskId: adoption.task_id,
            assetsByRevision: new Map(),
          };
          taskProjection.assetsByRevision.set(Number(adoption.branch_revision), aggregate.asset);
          adoptionProjectionByTask.set(taskProjectionKey, taskProjection);
        } catch (error) {
          taskFindings.push({
            ...coordinates,
            code: 'TASK_PROCESSING_ADOPTION_RECORD_INVALID',
            message: 'A private processing-result adoption record or replay result is invalid.',
            validationCode: error.code ?? 'VALIDATION_ERROR',
          });
        }

        const branch = adoptionBranchRevision.get(
          adoption.project_id,
          adoption.task_id,
          adoption.branch_revision,
        );
        let branchValue = null;
        try { branchValue = branch ? JSON.parse(branch.revision_json) : null; } catch {}
        if (!branch || !branchValue
          || branch.branch_id !== adoption.branch_id
          || branch.command_id !== adoption.command_id
          || branch.idempotency_key !== adoption.idempotency_key
          || branch.command_type !== 'asset.processing-result.adopt'
          || branch.committed_at !== adoption.committed_at) {
          taskFindings.push({
            ...coordinates,
            code: 'TASK_PROCESSING_ADOPTION_BRANCH_REVISION_MISMATCH',
            message: 'A private processing-result adoption differs from its immutable task-branch revision ledger.',
          });
        }

        if (aggregate && result) {
          let plan = null;
          try {
            plan = createProcessingResultAdoptionPlan(
              aggregate.command,
              aggregate.authorityBinding,
              aggregate.freshPreflightReceipt,
            );
          } catch {}
          const resultFingerprint = processingResultAdoptionCommitResultSha256(result);
          const columnsMatch = aggregate.project.projectId === adoption.project_id
            && aggregate.project.taskId === adoption.task_id
            && aggregate.project.branchId === adoption.branch_id
            && aggregate.project.branchRevision === Number(adoption.branch_revision)
            && aggregate.operation === adoption.operation
            && aggregate.command.commandId === adoption.command_id
            && aggregate.command.idempotencyKey === adoption.idempotency_key
            && aggregate.asset.assetId === adoption.asset_id
            && aggregate.asset.kind === adoption.asset_kind
            && aggregate.asset.assetVersion === Number(adoption.asset_version)
            && aggregate.asset.metadataVersion === Number(adoption.metadata_version)
            && aggregate.commandFingerprint === adoption.command_fingerprint
            && aggregate.semanticFingerprint === adoption.semantic_fingerprint
            && plan?.authority.bindingFingerprint === adoption.authority_binding_fingerprint
            && aggregate.freshPreflightReceiptFingerprint === adoption.preflight_receipt_fingerprint
            && aggregate.asset.processingBinding.fingerprint === adoption.processing_binding_fingerprint
            && aggregate.planFingerprint === adoption.plan_fingerprint
            && aggregate.asset.metadataFingerprint === adoption.metadata_fingerprint
            && aggregate.asset.findingsFingerprint === adoption.findings_fingerprint
            && resultFingerprint === adoption.result_fingerprint
            && aggregate.committedAt === adoption.committed_at
            && aggregate.committedBy === adoption.committed_by
            && aggregate.commandBudgetCharge === 1
            && result.commandBudgetCharge === 1
            && sameFingerprint(aggregate.commitResult, result);
          if (!columnsMatch) {
            taskFindings.push({
              ...coordinates,
              code: 'TASK_PROCESSING_ADOPTION_PROJECTION_MISMATCH',
              message: 'Normalized processing-result adoption columns differ from the validated immutable Aggregate.',
            });
          }
          if (!branchValue
            || branchValue.command?.commandId !== aggregate.command.commandId
            || branchValue.command?.idempotencyKey !== aggregate.command.idempotencyKey
            || branchValue.command?.type !== aggregate.command.type
            || branchValue.command?.fingerprint !== aggregate.commandFingerprint
            || !sameFingerprint(branchValue.command?.payload, aggregate.command.payload)
            || !sameFingerprint(branchValue.result, result)
            || branchValue.event?.commandId !== aggregate.command.commandId
            || branchValue.event?.commandType !== aggregate.command.type
            || branchValue.snapshot?.processingResultAdoptionHeads?.schemaVersion !== 1
            || !sameFingerprint(branchValue.snapshot?.processingResultAdoptionHeads?.assets?.find(
              (assetValue) => assetValue.assetId === aggregate.asset.assetId,
            ), aggregate.asset)) {
            taskFindings.push({
              ...coordinates,
              code: 'TASK_PROCESSING_ADOPTION_BRANCH_RESULT_MISMATCH',
              message: 'The task-branch command or replay result differs from the persisted processing-result adoption Aggregate.',
            });
          }
        }

        const references = adoptionReferences.all(
          adoption.project_id,
          adoption.task_id,
          adoption.branch_revision,
        );
        const referencesByRole = new Map(references.map((referenceRow) => [referenceRow.role, referenceRow]));
        if (references.length !== 2
          || !referencesByRole.has('recipe-input')
          || !referencesByRole.has('selected-output')) {
          taskFindings.push({
            ...coordinates,
            code: 'TASK_PROCESSING_ADOPTION_REFERENCE_SET_INVALID',
            message: 'A private processing-result adoption must retain exactly its recipe-input and selected-output roles.',
          });
        }
        const expectedReferences = new Map((aggregate?.permanentReferences ?? []).map((reference) => [reference.role, reference.descriptor]));
        for (const referenceRow of references) {
          const descriptor = expectedReferences.get(referenceRow.role);
          const artifact = artifactForAdoption.get(referenceRow.digest);
          const descriptorMatches = descriptor
            && descriptor.sha256 === referenceRow.digest
            && descriptor.artifactUri === referenceRow.artifact_uri
            && descriptor.mediaType === referenceRow.media_type
            && descriptor.byteSize === Number(referenceRow.byte_size)
            && descriptor.width === Number(referenceRow.width)
            && descriptor.height === Number(referenceRow.height);
          const liveMetadataMatches = artifact?.state === 'LIVE'
            && artifact.uri === referenceRow.artifact_uri
            && artifact.media_type === referenceRow.media_type
            && Number(artifact.byte_size) === Number(referenceRow.byte_size)
            && Number(artifact.width) === Number(referenceRow.width)
            && Number(artifact.height) === Number(referenceRow.height);
          if (!descriptorMatches || !liveMetadataMatches
            || referenceRow.verified_at !== adoption.committed_at) {
            taskFindings.push({
              ...coordinates,
              role: referenceRow.role,
              digest: referenceRow.digest,
              code: 'TASK_PROCESSING_ADOPTION_ARTIFACT_MISMATCH',
              message: 'A private processing-result adoption reference lost its exact descriptor or LIVE artifact metadata.',
            });
          }
          try {
            const evidence = JSON.parse(referenceRow.evidence_json);
            const { evidenceFingerprint, ...evidenceBody } = evidence;
            const evidenceKeys = Object.keys(evidence).sort();
            const metadataKeys = Object.keys(evidence.metadata ?? {}).sort();
            const physicalKeys = Object.keys(evidence.physical ?? {}).sort();
            const evidenceMatches = JSON.stringify(evidenceKeys) === JSON.stringify([
              'descriptor', 'evidenceFingerprint', 'metadata', 'physical', 'role', 'verifiedAt',
            ])
              && JSON.stringify(metadataKeys) === JSON.stringify([
                'artifactUri', 'byteSize', 'height', 'mediaType', 'sha256', 'state', 'width',
              ])
              && JSON.stringify(physicalKeys) === JSON.stringify([
                'byteSize', 'height', 'mediaType', 'sha256', 'width',
              ])
              && evidence.role === referenceRow.role
              && evidence.verifiedAt === referenceRow.verified_at
              && evidence.descriptor?.artifactUri === referenceRow.artifact_uri
              && evidence.descriptor?.sha256 === referenceRow.digest
              && evidence.descriptor?.mediaType === referenceRow.media_type
              && evidence.descriptor?.byteSize === Number(referenceRow.byte_size)
              && evidence.descriptor?.width === Number(referenceRow.width)
              && evidence.descriptor?.height === Number(referenceRow.height)
              && evidence.metadata?.artifactUri === referenceRow.artifact_uri
              && evidence.metadata?.sha256 === referenceRow.digest
              && evidence.metadata?.mediaType === referenceRow.media_type
              && evidence.metadata?.byteSize === Number(referenceRow.byte_size)
              && evidence.metadata?.width === Number(referenceRow.width)
              && evidence.metadata?.height === Number(referenceRow.height)
              && evidence.metadata?.state === 'LIVE'
              && evidence.physical?.sha256 === referenceRow.digest
              && evidence.physical?.mediaType === referenceRow.media_type
              && evidence.physical?.byteSize === Number(referenceRow.byte_size)
              && evidence.physical?.width === Number(referenceRow.width)
              && evidence.physical?.height === Number(referenceRow.height)
              && evidenceFingerprint === referenceRow.evidence_fingerprint
              && fingerprint(evidenceBody) === referenceRow.evidence_fingerprint;
            if (!evidenceMatches) {
              taskFindings.push({
                ...coordinates,
                role: referenceRow.role,
                digest: referenceRow.digest,
                code: 'TASK_PROCESSING_ADOPTION_EVIDENCE_FINGERPRINT_MISMATCH',
                message: 'A private processing-result adoption CAS evidence record differs from its immutable fingerprint.',
              });
            }
          } catch {
            taskFindings.push({
              ...coordinates,
              role: referenceRow.role,
              digest: referenceRow.digest,
              code: 'TASK_PROCESSING_ADOPTION_EVIDENCE_INVALID',
              message: 'A private processing-result adoption CAS evidence record is invalid.',
            });
          }
          try {
            await artifactStore.withVerifiedPngEvidence(referenceRow.digest, (physical) => {
              invariant(
                physical.mediaType === referenceRow.media_type
                  && physical.byteSize === Number(referenceRow.byte_size)
                  && physical.width === Number(referenceRow.width)
                  && physical.height === Number(referenceRow.height),
                'TASK_PROCESSING_ADOPTION_PHYSICAL_DESCRIPTOR_MISMATCH',
                'Physical CAS evidence differs from the persisted adoption descriptor.',
              );
            });
          } catch (error) {
            taskFindings.push({
              ...coordinates,
              role: referenceRow.role,
              digest: referenceRow.digest,
              code: error.code ?? 'TASK_PROCESSING_ADOPTION_PHYSICAL_ARTIFACT_INVALID',
              message: 'A private processing-result adoption physical CAS artifact is missing, corrupt, or descriptor-incompatible.',
            });
          }
        }
        if (adoptionTaskRow?.state === 'MERGED') {
          taskFindings.push({
            ...coordinates,
            code: 'TASK_PROCESSING_ADOPTION_MERGE_FORBIDDEN',
            message: 'A private processing-result adoption cannot enter merged Main state.',
          });
        }
      }
      for (const taskProjection of adoptionProjectionByTask.values()) {
        const expectedHeads = new Map();
        for (const revisionRow of branchRows.all(taskProjection.projectId, taskProjection.taskId)) {
          const adoptedAsset = taskProjection.assetsByRevision.get(Number(revisionRow.branch_revision));
          if (adoptedAsset) expectedHeads.set(adoptedAsset.assetId, adoptedAsset);
          let revisionValue = null;
          try { revisionValue = JSON.parse(revisionRow.revision_json); } catch {}
          const actualProjection = revisionValue?.snapshot?.processingResultAdoptionHeads;
          const expectedAssets = [...expectedHeads.values()]
            .sort((left, right) => left.assetId.localeCompare(right.assetId));
          const projectionMatches = expectedAssets.length === 0
            ? actualProjection === undefined
            : actualProjection?.schemaVersion === 1
              && sameFingerprint(actualProjection.assets, expectedAssets);
          if (!projectionMatches) {
            taskFindings.push({
              projectId: taskProjection.projectId,
              taskId: taskProjection.taskId,
              branchRevision: Number(revisionRow.branch_revision),
              code: 'TASK_PROCESSING_ADOPTION_HEAD_PROJECTION_MISMATCH',
              message: 'Private processing-result adoption heads differ from the exact Aggregate history at this branch revision.',
            });
          }
        }
      }
      const missingAdoptions = db.prepare(`
        SELECT revisions.project_id, revisions.task_id, revisions.branch_revision
        FROM task_branch_revisions AS revisions
        LEFT JOIN task_branch_processing_result_adoptions AS adoptions
          ON adoptions.project_id = revisions.project_id
          AND adoptions.task_id = revisions.task_id
          AND adoptions.branch_revision = revisions.branch_revision
        WHERE revisions.command_type = 'asset.processing-result.adopt'
          AND adoptions.branch_revision IS NULL
        ORDER BY revisions.project_id, revisions.task_id, revisions.branch_revision
      `).all();
      for (const row of missingAdoptions) {
        taskFindings.push({
          projectId: row.project_id,
          taskId: row.task_id,
          branchRevision: Number(row.branch_revision),
          code: 'TASK_PROCESSING_ADOPTION_RECORD_MISSING',
          message: 'A processing-result adoption branch revision lost its durable Aggregate.',
        });
      }
      const orphanReferences = db.prepare(`
        SELECT references_table.project_id, references_table.task_id,
          references_table.branch_revision, references_table.role
        FROM task_branch_processing_result_artifact_references AS references_table
        LEFT JOIN task_branch_processing_result_adoptions AS adoptions
          ON adoptions.project_id = references_table.project_id
          AND adoptions.task_id = references_table.task_id
          AND adoptions.branch_revision = references_table.branch_revision
        WHERE adoptions.branch_revision IS NULL
        ORDER BY references_table.project_id, references_table.task_id,
          references_table.branch_revision, references_table.role
      `).all();
      for (const row of orphanReferences) {
        taskFindings.push({
          projectId: row.project_id,
          taskId: row.task_id,
          branchRevision: Number(row.branch_revision),
          role: row.role,
          code: 'TASK_PROCESSING_ADOPTION_REFERENCE_ORPHANED',
          message: 'A private processing-result artifact reference has no durable adoption Aggregate.',
        });
      }
    }
    if (database.userVersion >= 14) {
      const candidateRows = db.prepare(`
        SELECT * FROM task_level_candidate_submissions
        ORDER BY project_id, task_id, submission_id
      `).all();
      const candidateTask = db.prepare(`
        SELECT * FROM agent_tasks WHERE project_id = ? AND task_id = ?
      `);
      const candidateReviewRows = db.prepare(`
        SELECT * FROM task_reviews
        WHERE project_id = ? AND task_id = ? AND review_id = ?
        ORDER BY review_version
      `);
      const candidateTimelineRows = db.prepare(`
        SELECT * FROM task_timeline_events
        WHERE project_id = ? AND task_id = ? AND event_id = ?
      `);
      const candidateMerge = db.prepare(`
        SELECT 1 FROM task_merges WHERE project_id = ? AND task_id = ?
      `);
      for (const row of candidateRows) {
        const coordinates = {
          projectId: row.project_id,
          taskId: row.task_id,
          submissionId: row.submission_id,
        };
        let configuredBinding;
        let aggregate;
        let submission;
        let result;
        try {
          validateStoredLevelCandidateRow(db, row);
          configuredBinding = JSON.parse(row.configured_binding_json);
          aggregate = JSON.parse(row.aggregate_json);
          submission = validateTaskCandidateSubmission(JSON.parse(row.submission_json));
          result = JSON.parse(row.result_json);
        } catch (error) {
          taskFindings.push({
            ...coordinates,
            code: error?.code === 'CORRUPT_LEVEL_CANDIDATE'
              ? 'TASK_LEVEL_CANDIDATE_SEMANTIC_MISMATCH'
              : 'TASK_LEVEL_CANDIDATE_JSON_INVALID',
            message: 'An immutable Level Candidate contains invalid, non-canonical, or fingerprint-divergent semantic state.',
            cause: error.message,
          });
          continue;
        }
        const identity = aggregate?.identity;
        const authorityBinding = aggregate?.authorityBinding;
        const columnsMatch = submission.projectId === row.project_id
          && submission.taskId === row.task_id
          && submission.submissionId === row.submission_id
          && submission.branchId === row.branch_id
          && Number(submission.baseRevision) === Number(row.base_revision)
          && Number(submission.branchHeadRevision) === Number(row.branch_head_revision)
          && submission.idempotencyKeyHash === row.idempotency_key_hash
          && submission.fingerprint === row.submission_fingerprint
          && submission.projectionFingerprint === row.projection_fingerprint
          && submission.candidate.candidateFingerprint === row.candidate_fingerprint
          && identity?.projectId === row.project_id
          && identity?.taskId === row.task_id
          && identity?.submissionId === row.submission_id
          && identity?.branchId === row.branch_id
          && identity?.actorId === row.actor_id
          && identity?.grantId === row.grant_id
          && identity?.idempotencyKeyHash === row.idempotency_key_hash
          && identity?.requestFingerprint === row.request_fingerprint
          && aggregate?.requestFingerprint === row.request_fingerprint
          && aggregate?.authorityBindingFingerprint === row.authority_binding_fingerprint
          && aggregate?.submissionFingerprint === row.submission_fingerprint
          && aggregate?.resultFingerprint === result?.fingerprint
          && aggregate?.reviewId === row.review_id
          && aggregate?.submittedAt === row.submitted_at
          && authorityBinding?.fingerprint === row.authority_binding_fingerprint
          && authorityBinding?.projectId === row.project_id
          && authorityBinding?.taskId === row.task_id
          && authorityBinding?.branchId === row.branch_id
          && authorityBinding?.actorId === row.actor_id
          && authorityBinding?.grantId === row.grant_id
          && Number(authorityBinding?.baseRevision) === Number(row.base_revision)
          && Number(authorityBinding?.branchHeadRevision) === Number(row.branch_head_revision)
          && sameFingerprint(aggregate?.configuredBinding, configuredBinding)
          && closesEmbeddedFingerprint(authorityBinding)
          && closesEmbeddedFingerprint(aggregate)
          && closesEmbeddedFingerprint(result)
          && result?.kind === 'studio.level-candidate-submit-result'
          && result?.status === 'WAITING_FOR_HUMAN_REVIEW'
          && result?.message === 'Waiting for your review'
          && result?.submissionId === row.submission_id
          && result?.submissionFingerprint === row.submission_fingerprint
          && result?.candidateFingerprint === row.candidate_fingerprint
          && result?.reviewId === row.review_id
          && Number(result?.baseRevision) === Number(row.base_revision)
          && Number(result?.branchHeadRevision) === Number(row.branch_head_revision);
        if (!columnsMatch) {
          taskFindings.push({
            ...coordinates,
            code: 'TASK_LEVEL_CANDIDATE_SEMANTIC_MISMATCH',
            message: 'Level Candidate columns, configured authority, Aggregate, submission, and result do not form one fingerprint-closed record.',
          });
        }
        const reviewVersions = candidateReviewRows.all(row.project_id, row.task_id, row.review_id);
        const timeline = candidateTimelineRows.all(
          row.project_id,
          row.task_id,
          `task-event:${row.task_id}:candidate:${row.submission_id}`,
        );
        let review = null;
        let event = null;
        try {
          review = reviewVersions.length === 1 ? JSON.parse(reviewVersions[0].review_json) : null;
          event = timeline.length === 1 ? JSON.parse(timeline[0].event_json) : null;
        } catch {}
        const task = candidateTask.get(row.project_id, row.task_id);
        if (!task
          || !['IN_REVIEW', 'REJECTED', 'CANCELLED'].includes(task.state)
          || reviewVersions.length !== 1
          || review?.kind !== 'studio.level-candidate-review'
          || review?.reviewVersion !== 1
          || review?.state !== 'OPEN'
          || review?.candidateSubmissionId !== row.submission_id
          || review?.items?.length !== 1
          || !review.items.every(({ disposition }) => disposition === 'PENDING')
          || review?.candidateEvidence?.submissionFingerprint !== row.submission_fingerprint
          || review?.candidateEvidence?.candidateFingerprint !== row.candidate_fingerprint
          || timeline.length !== 1
          || event?.type !== 'REVIEW_SUBMITTED'
          || event?.state !== 'IN_REVIEW'
          || event?.details?.reviewId !== row.review_id
          || event?.details?.submissionId !== row.submission_id
          || event?.details?.candidateFingerprint !== row.candidate_fingerprint
          || candidateMerge.get(row.project_id, row.task_id)) {
          taskFindings.push({
            ...coordinates,
            code: 'TASK_LEVEL_CANDIDATE_REVIEW_CLOSURE_MISMATCH',
            message: 'A Level Candidate lost its single PENDING review, REVIEW_SUBMITTED event, or non-merge authority boundary.',
          });
        }
      }
      const orphanCandidateReviews = db.prepare(`
        SELECT reviews.project_id, reviews.task_id, reviews.review_id
        FROM task_reviews AS reviews
        LEFT JOIN task_level_candidate_submissions AS candidates
          ON candidates.project_id = reviews.project_id
          AND candidates.task_id = reviews.task_id
          AND candidates.review_id = reviews.review_id
        WHERE json_extract(reviews.review_json, '$.kind') = 'studio.level-candidate-review'
          AND candidates.submission_id IS NULL
        ORDER BY reviews.project_id, reviews.task_id, reviews.review_id
      `).all();
      for (const row of orphanCandidateReviews) {
        taskFindings.push({
          projectId: row.project_id,
          taskId: row.task_id,
          reviewId: row.review_id,
          code: 'TASK_LEVEL_CANDIDATE_REVIEW_ORPHANED',
          message: 'A Level Candidate review has no immutable Candidate submission.',
        });
      }
      const orphanCandidateTimeline = db.prepare(`
        SELECT events.project_id, events.task_id, events.event_id
        FROM task_timeline_events AS events
        LEFT JOIN task_level_candidate_submissions AS candidates
          ON candidates.project_id = events.project_id
          AND candidates.task_id = events.task_id
          AND candidates.submission_id = json_extract(events.event_json, '$.details.submissionId')
        WHERE events.event_type = 'REVIEW_SUBMITTED'
          AND json_extract(events.event_json, '$.details.submissionId') LIKE 'candidate:%'
          AND candidates.submission_id IS NULL
        ORDER BY events.project_id, events.task_id, events.event_id
      `).all();
      for (const row of orphanCandidateTimeline) {
        taskFindings.push({
          projectId: row.project_id,
          taskId: row.task_id,
          eventId: row.event_id,
          code: 'TASK_LEVEL_CANDIDATE_TIMELINE_ORPHANED',
          message: 'A Level Candidate REVIEW_SUBMITTED event has no immutable Candidate submission.',
        });
      }
    }
  } catch (error) {
    taskFindings.push({ projectId: null, taskId: null, code: 'TASK_QUERY_FAILED', message: 'Checkpoint 4 task integrity could not be inspected.', cause: error.message });
  }
  const tasks = { ok: taskFindings.length === 0, count: taskCount, findings: taskFindings };

  const bundleImportFindings = [];
  let bundleImportJobCount = 0;
  try {
    const db = projectStore.workspace.database;
    const importedJobs = db.prepare('SELECT * FROM bundle_import_applied_jobs ORDER BY project_id, job_id').all();
    bundleImportJobCount = importedJobs.length;
    const outputReference = db.prepare(`
      SELECT 1 FROM artifact_references
      WHERE project_id = ? AND owner_kind IN ('atlas_slice', 'bundle_import_job_output') AND digest = ? LIMIT 1
    `);
    for (const job of importedJobs) {
      let input;
      let outputs;
      let events;
      try {
        input = JSON.parse(job.input_json);
        outputs = JSON.parse(job.output_json);
        JSON.parse(job.result_json);
        events = JSON.parse(job.events_json);
      } catch {
        bundleImportFindings.push({ projectId: job.project_id, jobId: job.job_id, code: 'BUNDLE_IMPORT_JOB_JSON_INVALID', message: 'Imported applied-job history contains invalid JSON.' });
        continue;
      }
      if (fingerprint(input) !== job.input_fingerprint || !Array.isArray(outputs) || !Array.isArray(events)) {
        bundleImportFindings.push({ projectId: job.project_id, jobId: job.job_id, code: 'BUNDLE_IMPORT_JOB_SEMANTIC_MISMATCH', message: 'Imported applied-job history differs from its immutable input or output shape.' });
      }
      for (const output of outputs ?? []) {
        if (!outputReference.get(job.project_id, output.digest)) {
          bundleImportFindings.push({ projectId: job.project_id, jobId: job.job_id, digest: output.digest, code: 'BUNDLE_IMPORT_JOB_REFERENCE_MISSING', message: 'Imported applied-job output has no permanent semantic reference.' });
        }
      }
      if (db.prepare('SELECT 1 FROM jobs WHERE project_id = ? AND job_id = ?').get(job.project_id, job.job_id)) {
        bundleImportFindings.push({ projectId: job.project_id, jobId: job.job_id, code: 'BUNDLE_IMPORT_JOB_LIVE_COLLISION', message: 'Imported history was also installed as a live controllable job.' });
      }
    }
  } catch (error) {
    bundleImportFindings.push({ projectId: null, jobId: null, code: 'BUNDLE_IMPORT_QUERY_FAILED', message: 'Bundle-import integrity could not be inspected.', cause: error.message });
  }
  const bundleImports = { ok: bundleImportFindings.length === 0, appliedJobCount: bundleImportJobCount, findings: bundleImportFindings };
  return {
    schemaVersion: 1,
    ok: database.ok && artifacts.ok && sourceIntakes.ok && agentAttempts.ok && jobs.ok && assets.ok && rooms.ok && tasks.ok && bundleImports.ok,
    database,
    artifacts,
    sourceIntakes,
    agentAttempts,
    jobs,
    assets,
    rooms,
    tasks,
    bundleImports,
  };
}
