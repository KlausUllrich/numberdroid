import { invariant } from '../../../domain/src/errors.js';
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
  return {
    schemaVersion: 1,
    ok: database.ok && artifacts.ok && sourceIntakes.ok && agentAttempts.ok,
    database,
    artifacts,
    sourceIntakes,
    agentAttempts,
  };
}
