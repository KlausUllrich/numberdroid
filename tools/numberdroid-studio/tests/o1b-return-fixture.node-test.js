import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/prepare-o1b-backups-return-fixture.js', import.meta.url));

function run(root) {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, [script, root], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('close', (code) => resolveRun({ code, stdout, stderr }));
  });
}

test('O1b return fixture prepares only fixed disjoint roots under an empty absolute directory', { timeout: 10_000 }, async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'numberdroid-o1b-return-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const result = await run(root);
  assert.equal(result.code, 0, result.stderr);
  assert.doesNotMatch(result.stdout, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const canonicalRoot = await realpath(root);
  const configuration = JSON.parse(await readFile(join(root, 'operations.json'), 'utf8'));
  assert.deepEqual(configuration, {
    schemaVersion: 1,
    controlRoot: join(canonicalRoot, 'operations-control'),
    backupDestinations: [{
      destinationId: 'backup.return-test',
      label: 'Return-test backups',
      root: join(canonicalRoot, 'backups'),
    }],
    restoreDestinations: [{
      destinationId: 'restore.return-test',
      label: 'Return-test restored copies',
      root: join(canonicalRoot, 'restored-copies'),
    }],
  });
});

test('O1b return fixture refuses a non-empty target without adding files', { timeout: 10_000 }, async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'numberdroid-o1b-return-nonempty-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'keep.txt'), 'keep\n');
  const result = await run(root);
  assert.notEqual(result.code, 0);
  assert.equal(await readFile(join(root, 'keep.txt'), 'utf8'), 'keep\n');
  await assert.rejects(readFile(join(root, 'operations.json'), 'utf8'), { code: 'ENOENT' });
});
