import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const checker = fileURLToPath(new URL('./check-javascript-syntax.js', import.meta.url));

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'numberdroid-js-check-'));
  for (const directory of ['packages', 'apps', 'scripts', 'tests']) {
    fs.mkdirSync(path.join(root, directory), { recursive: true });
  }
  fs.writeFileSync(path.join(root, 'packages/valid.js'), 'export const js = true;\n');
  fs.writeFileSync(path.join(root, 'apps/valid.mjs'), 'export const mjs = true;\n');
  fs.writeFileSync(path.join(root, 'scripts/valid.cjs'), 'module.exports = true;\n');
  fs.writeFileSync(path.join(root, 'tests/valid.node-test.js'), 'export {};\n');
  return root;
}

function run(root) {
  return spawnSync(process.execPath, [checker], { cwd: root, encoding: 'utf8' });
}

{
  const root = createFixture();
  try {
    const result = run(root);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /JavaScript syntax checked: 4 files/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

{
  const root = createFixture();
  try {
    fs.writeFileSync(path.join(root, 'tests/broken.cjs'), 'module.exports = ;\n');
    const result = run(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /SyntaxError/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

{
  const root = createFixture();
  try {
    fs.symlinkSync('valid.js', path.join(root, 'packages/link.js'));
    const result = run(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /symbolic link/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

{
  const root = createFixture();
  try {
    fs.rmSync(path.join(root, 'packages'), { recursive: true });
    fs.mkdirSync(path.join(root, 'actual-packages'));
    fs.writeFileSync(path.join(root, 'actual-packages/valid.js'), 'export {};\n');
    fs.symlinkSync('actual-packages', path.join(root, 'packages'));
    const result = run(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /source root must be a real directory/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

console.log('Studio JavaScript syntax checker self-test passed.');
