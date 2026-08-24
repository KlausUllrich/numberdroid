import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyCheckpoint1aEvidence } from '../scripts/checkpoint-1a-evidence.js';

test('protected Checkpoint 1A fixture migrates to SQLite with exact parity', async () => {
  const evidence = await verifyCheckpoint1aEvidence();
  assert.equal(evidence.schemaVersion, 1);
  assert.equal(evidence.status, 'VERIFIED');
  assert.equal(evidence.baselineCommit, '2a7ca9cdde0179c8605163ea1f96ba1e6bce1e7d');
  assert.match(evidence.databaseAdapter, /better-sqlite3|node:sqlite-local-fallback/);
  assert.match(evidence.commitProvenance, /GIT_COMMIT_VERIFIED|EXPORTED_WORKSPACE_NOT_GIT_VERIFIED/);
  assert.equal(evidence.projectId, 'numberdroid-studio-demo');
  assert.equal(evidence.headRevision, 6);
  assert.equal(evidence.activityCount, 6);
});
