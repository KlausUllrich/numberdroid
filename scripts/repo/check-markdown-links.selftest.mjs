import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const checker = fileURLToPath(new URL('./check-markdown-links.mjs', import.meta.url));
const requiredBootstrap = [
  'README.md',
  'AGENTS.md',
  'REPOSITORY_STRUCTURE.md',
  'docs/agents/ROLE_ENTRYPOINTS.md',
  'docs/agents/REPOSITORY_WORKFLOW.md',
  'docs/agents/CHANGE_RISK_AND_VERIFICATION.md',
  'docs/README.md',
];

function write(root, relativePath, content = '# Test\n') {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'numberdroid-doc-check-'));
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  for (const file of requiredBootstrap) {
    write(root, file);
  }
  write(root, 'docs/guide.md', '[target](../target.txt)\n');
  write(root, 'target.txt', 'target\n');
  execFileSync('git', ['add', '.'], { cwd: root });
  return root;
}

function run(root) {
  return spawnSync(process.execPath, [checker], { cwd: root, encoding: 'utf8' });
}

function expectFailure(root, pattern) {
  const result = run(root);
  assert.notEqual(result.status, 0);
  const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  assert.match(combined, pattern);
}

function scenario(mutator, pattern) {
  const root = createFixture();
  try {
    mutator(root);
    expectFailure(root, pattern);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

{
  const root = createFixture();
  try {
    const result = run(root);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /failures: 0/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

scenario((root) => {
  fs.rmSync(path.join(root, 'target.txt'));
  execFileSync('git', ['add', '--all'], { cwd: root });
}, /missing target/);

scenario((root) => {
  fs.symlinkSync('guide.md', path.join(root, 'docs/symlink.md'));
  execFileSync('git', ['add', 'docs/symlink.md'], { cwd: root });
}, /symbolic links are not documentation-only inputs/);

{
  const root = createFixture();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'numberdroid-doc-outside-'));
  try {
    fs.writeFileSync(path.join(outside, 'secret.txt'), 'outside\n');
    fs.symlinkSync(outside, path.join(root, 'docs/external'));
    write(root, 'docs/guide.md', '[outside](external/secret.txt)\n');
    execFileSync('git', ['add', '--all'], { cwd: root });
    expectFailure(root, /target escapes repository through symbolic link/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
}

scenario((root) => {
  write(root, 'docs/invalid.md', Buffer.from([0xff]));
  execFileSync('git', ['add', 'docs/invalid.md'], { cwd: root });
}, /content is not valid UTF-8/);

scenario((root) => {
  const invalidPath = Buffer.concat([
    Buffer.from(`${root}${path.sep}docs${path.sep}`),
    Buffer.from([0xff]),
    Buffer.from('.md'),
  ]);
  fs.writeFileSync(invalidPath, '# Invalid filename\n');
  execFileSync('git', ['add', '--all'], { cwd: root });
}, /index path names are not valid UTF-8/);

scenario((root) => {
  write(root, 'docs/NONCANONICAL.MD');
  execFileSync('git', ['add', 'docs/NONCANONICAL.MD'], { cwd: root });
}, /canonical lowercase \.md suffix/);

scenario((root) => {
  fs.rmSync(path.join(root, 'AGENTS.md'));
  execFileSync('git', ['add', '--all'], { cwd: root });
}, /AGENTS\.md: required bootstrap document is missing/);

console.log('Markdown link checker self-test passed.');
