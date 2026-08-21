import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyCheckpoint1aEvidence } from '../scripts/checkpoint-1a-evidence.js';

test('protected Checkpoint 1A fixture migrates to SQLite with exact parity', async () => {
  const evidence = await verifyCheckpoint1aEvidence();
  assert.deepEqual(evidence, {
    schemaVersion: 1,
    status: 'VERIFIED',
    baselineCommit: '2a7ca9cdde0179c8605163ea1f96ba1e6bce1e7d',
    sourceManifestHash: evidence.sourceManifestHash,
    projectId: 'numberdroid-studio-demo',
    headRevision: 6,
    activityCount: 6,
  });
});
