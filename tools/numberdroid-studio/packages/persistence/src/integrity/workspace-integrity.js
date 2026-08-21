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
  return {
    schemaVersion: 1,
    ok: database.ok && artifacts.ok,
    database,
    artifacts,
  };
}

