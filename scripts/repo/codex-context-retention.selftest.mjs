import assert from 'node:assert/strict';
import { execFileSync as runFileSync, spawnSync as runSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileSync = (file, args, options) => runFileSync(file, args, { timeout: 10_000, ...options });
const spawnSync = (file, args, options) => runSync(file, args, { timeout: 10_000, ...options });

const script = fileURLToPath(new URL('./codex-context-retention.mjs', import.meta.url));
const universal = [
  'AGENTS.md',
  'REPOSITORY_STRUCTURE.md',
  'docs/agents/ROLE_ENTRYPOINTS.md',
  'docs/agents/REPOSITORY_WORKFLOW.md',
  'docs/agents/CHANGE_RISK_AND_VERIFICATION.md',
  'docs/README.md',
];

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'numberdroid-context-retention-'));
try {
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  for (const document of universal) {
    const target = path.join(root, document);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `full:${document}\n`);
  }
  fs.mkdirSync(path.join(root, 'docs', 'tasks'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'tasks', 'alpha.md'), 'ALPHA-CONTENT');
  fs.writeFileSync(path.join(root, 'docs', 'tasks', 'beta.md'), 'BETA-CONTENT\n');

  const env = { ...process.env, CODEX_SESSION_ID: 'selftest-session' };
  execFileSync(process.execPath, [script, 'register', '--replace', 'docs/tasks/alpha.md'], { cwd: root, env });
  execFileSync(process.execPath, [script, 'register', 'docs/tasks/beta.md', 'docs/tasks/alpha.md'], { cwd: root, env });

  const shown = execFileSync(process.execPath, [script, 'show'], { cwd: root, env, encoding: 'utf8' });
  assert.equal(shown.split('\n').filter(Boolean).length, universal.length + 2);
  assert.equal(shown.match(/docs\/tasks\/alpha\.md/g)?.length, 1);

  const hookInput = JSON.stringify({ session_id: 'selftest-session', source: 'compact' });
  const restored = execFileSync(process.execPath, [script, 'reload'], {
    cwd: root,
    env,
    input: hookInput,
    encoding: 'utf8',
  });
  assert.match(restored, /ALPHA-CONTENT\n<<< END NUMBERDROID DOCUMENT: docs\/tasks\/alpha\.md >>>/);
  assert.match(restored, /BETA-CONTENT\n\n<<< END NUMBERDROID DOCUMENT: docs\/tasks\/beta\.md >>>/);
  assert.match(restored, /Use each document according to the repository authority model; historical documents remain task snapshots\. Continue the existing task\./);

  fs.writeFileSync(path.join(root, 'docs', 'tasks', 'alpha.md'), 'UPDATED-CURRENT-CONTENT');
  const current = execFileSync(process.execPath, [script, 'reload'], {
    cwd: root, env, input: hookInput, encoding: 'utf8',
  });
  assert.match(current, /UPDATED-CURRENT-CONTENT/);
  assert.doesNotMatch(current, /ALPHA-CONTENT/);

  const otherSession = execFileSync(process.execPath, [script, 'reload'], {
    cwd: root, env, input: JSON.stringify({ session_id: 'other-session', source: 'compact' }), encoding: 'utf8',
  });
  assert.match(otherSession, /No task manifest was registered/);
  assert.doesNotMatch(otherSession, /UPDATED-CURRENT-CONTENT|BETA-CONTENT/);

  execFileSync(process.execPath, [script, 'register', '--replace', 'docs/tasks/alpha.md'], { cwd: root, env });
  const replaced = execFileSync(process.execPath, [script, 'reload'], {
    cwd: root, env, input: hookInput, encoding: 'utf8',
  });
  assert.match(replaced, /UPDATED-CURRENT-CONTENT/);
  assert.doesNotMatch(replaced, /BETA-CONTENT/);

  const capped = spawnSync(process.execPath, [script, 'reload'], {
    cwd: root,
    env: { ...env, NUMBERDROID_CONTEXT_MAX_BYTES: '16' },
    input: hookInput,
    encoding: 'utf8',
  });
  assert.equal(capped.status, 0);
  const cappedOutput = JSON.parse(capped.stdout);
  assert.equal(cappedOutput.continue, false);
  assert.match(cappedOutput.stopReason, /no partial documentation was injected/);

  const invalid = spawnSync(process.execPath, [script, 'register', '../outside.md'], {
    cwd: root,
    env,
    encoding: 'utf8',
  });
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /repository-relative/);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

console.log('Codex context-retention self-test passed.');
