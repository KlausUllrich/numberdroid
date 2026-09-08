import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { startStudioHttpServer } from '../apps/studio-server/src/server.js';

test('Cutter live fixture starts with one approved source and refuses every existing target', { timeout: 60_000 }, async () => {
  const parent = await mkdtemp(join(tmpdir(), 'studio-cutter-live-test-')); const directory = join(parent, 'fresh'); let running;
  const script = fileURLToPath(new URL('../scripts/prepare-cutter-editor-fixture.js', import.meta.url));
  const prepare = target => promisify(execFile)(process.execPath, [script, target], { timeout: 20_000, maxBuffer: 128 * 1024 });
  try {
    await assert.rejects(prepare(parent), /requires a new directory/);
    const result = JSON.parse((await prepare(directory)).stdout); assert.equal(result.revision, 4); assert.equal(result.sliceCount, 0);
    running = await startStudioHttpServer({ dataDirectory: directory, host: '127.0.0.1', port: 0, operationsConfigurationFilename: null });
    const project = await running.studioService.readProjectTrusted(result.projectId);
    assert.equal(project.snapshot.sources.length, 1); assert.equal(project.snapshot.sources[0].review.disposition, 'USER_APPROVED');
    assert.equal((project.snapshot.atlases ?? []).length, 0); assert.equal(project.snapshot.grants.length, 0);
    await assert.rejects(prepare(directory), /requires a new directory/);
    assert.deepEqual(await running.studioService.readProjectTrusted(result.projectId), project);
  } finally {
    if (running) await new Promise((resolve, reject) => running.server.close(error => error ? reject(error) : resolve()));
    await rm(parent, { recursive: true, force: true });
  }
});


test('Cutter fixture is reachable from launcher help and stable fifth interactive choice', async () => {
  const source = await readFile(new URL('../scripts/start-worktree-studios.js', import.meta.url), 'utf8');
  assert.match(source, /--fixture <profile>[^\n]*cutter-editor/);
  assert.match(source, /5\. VT-019 Cutter editor fixture/);
  assert.match(source, /4: 'review-feedback', 5: 'cutter-editor'/);
});
