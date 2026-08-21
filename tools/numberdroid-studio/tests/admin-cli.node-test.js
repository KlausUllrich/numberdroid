import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const execute = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('administration CLI documents non-overwriting migration, backup, verification, and restore commands', async () => {
  const { stdout, stderr } = await execute(process.execPath, ['apps/studio-admin/src/main.js', '--help'], { cwd: root });
  assert.equal(stderr, '');
  assert.match(stdout, /Stop the Studio writer/);
  assert.match(stdout, /manifest-json/);
  assert.match(stdout, /migrate-json/);
  assert.match(stdout, /integrity/);
  assert.match(stdout, /verify-backup/);
  assert.match(stdout, /restore/);
});
