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
      try {
        value = JSON.parse(row.variant_json);
        const findingRows = findingsForVersion.all(row.project_id, row.room_variant_id, row.variant_version);
        findings = findingRows.map((findingRow) => JSON.parse(findingRow.finding_json));
        intent = intentForVersion.all(row.project_id, row.room_variant_id, row.variant_version).map((intentRow) => ({
          layer: intentRow.layer, ruleId: intentRow.rule_id, summary: intentRow.summary, disposition: intentRow.disposition,
        }));
        connectors = connectorsForVersion.all(row.project_id, row.room_variant_id, row.variant_version).map((connectorRow) => JSON.parse(connectorRow.connector_json));
        placements = placementsForVersion.all(row.project_id, row.room_variant_id, row.variant_version).map((placementRow) => JSON.parse(placementRow.placement_json));
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
        || fingerprint(value.placements) !== fingerprint(placements)) {
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
    ok: database.ok && artifacts.ok && sourceIntakes.ok && agentAttempts.ok && jobs.ok && assets.ok && rooms.ok && bundleImports.ok,
    database,
    artifacts,
    sourceIntakes,
    agentAttempts,
    jobs,
    assets,
    rooms,
    bundleImports,
  };
}
