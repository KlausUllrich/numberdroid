import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import test from 'node:test';
import { prepareReviewFeedbackEvidence } from '../scripts/prepare-review-feedback-evidence.js';

async function fingerprint(root) {
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path); else files.push(path);
    }
  }
  await walk(root);
  const hash = createHash('sha256');
  for (const path of files.sort()) hash.update(relative(root, path)).update(await readFile(path));
  return hash.digest('hex');
}

test('feedback evidence creates only a fresh pending review and never reuses a destination', { timeout: 30_000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'studio-feedback-fixture-test-'));
  try {
    const directory = join(root, 'fresh');
    assert.deepEqual(await prepareReviewFeedbackEvidence(directory), {
      projectId: 'project.review-feedback', taskId: 'task.review-feedback',
      projectRevision: 2, reviewVersion: 1, itemCount: 2,
    });
    const before = await fingerprint(directory);
    await assert.rejects(prepareReviewFeedbackEvidence(directory), { code: 'EEXIST' });
    assert.equal(await fingerprint(directory), before);
    const empty = join(root, 'existing-empty'); await mkdir(empty);
    await assert.rejects(prepareReviewFeedbackEvidence(empty), { code: 'EEXIST' });
    assert.deepEqual(await readdir(empty), []);
    await assert.rejects(prepareReviewFeedbackEvidence('relative'), /absolute new fixture/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
