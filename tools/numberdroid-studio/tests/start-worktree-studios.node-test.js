import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  describeMainRelationship,
  findAvailablePort,
  fixtureCommands,
  orderFriendlyWorktrees,
  parseArguments,
  parseMainRef,
  parseSelection,
  parseWorktreePorcelain,
  pathIsWithin,
  safeLabel,
  stopChild,
} from '../scripts/start-worktree-studios.js';

test('worktree parser preserves paths, branches, detached state, and unusable records', () => {
  const value = [
    'worktree /repo/primary\0HEAD 0123456789abcdef\0branch refs/heads/main',
    'worktree /repo/a branch\0HEAD fedcba9876543210\0detached\0locked retained for QA',
    'worktree /gone\0HEAD aaaaaaaaaaaaaaaa\0detached\0prunable gitdir file points to missing location',
  ].join('\0\0');
  assert.deepEqual(parseWorktreePorcelain(`${value}\0\0`), [
    {
      path: '/repo/primary', head: '0123456789abcdef', branch: 'main', detached: false,
      locked: false, lockReason: null, prunable: false, pruneReason: null,
    },
    {
      path: '/repo/a branch', head: 'fedcba9876543210', branch: null, detached: true,
      locked: true, lockReason: 'retained for QA', prunable: false, pruneReason: null,
    },
    {
      path: '/gone', head: 'aaaaaaaaaaaaaaaa', branch: null, detached: true,
      locked: false, lockReason: null, prunable: true,
      pruneReason: 'gitdir file points to missing location',
    },
  ]);
});

test('worktree parser rejects incomplete records', () => {
  assert.throws(() => parseWorktreePorcelain('worktree /repo\0\0'), /incomplete worktree record/);
});

test('multi-selection accepts numbers, ranges, all, defaults, and quit', () => {
  assert.deepEqual(parseSelection('1,3-5 2', 5), [1, 3, 4, 5, 2]);
  assert.deepEqual(parseSelection('all', 3), [1, 2, 3]);
  assert.deepEqual(parseSelection('', 3, { defaultIndex: 2 }), [2]);
  assert.equal(parseSelection('q', 3), null);
  assert.throws(() => parseSelection('3-1', 4), /runs backwards/);
  assert.throws(() => parseSelection('5', 4), /outside 1-4/);
  assert.throws(() => parseSelection('main', 4), /Invalid worktree selection token/);
});

test('arguments keep safe defaults and validate exclusive selection and fixture profiles', () => {
  assert.deepEqual(parseArguments([]), {
    all: false,
    basePort: 4317,
    dataRoot: null,
    fixture: null,
    help: false,
    json: false,
    list: false,
    offline: false,
    repositoryRoot: fileURLToPath(new URL('../../..', import.meta.url)).replace(/[\\/]$/, ''),
    select: null,
    startupTimeoutMs: 15_000,
    verbose: false,
  });
  assert.equal(parseArguments(['--select', '1,2', '--fixture', 'vt001-room']).fixture, 'vt001-room');
  assert.throws(() => parseArguments(['--all', '--select', '1']), /not both/);
  assert.throws(() => parseArguments(['--fixture', 'personal']), /Unknown fixture profile/);
  assert.throws(() => parseArguments(['--base-port', '80']), /1024 through 65535/);
  assert.throws(() => parseArguments(['--json']), /only with --list/);
});

test('friendly ordering puts latest main first and hides unavailable worktrees', () => {
  const worktree = (id, kind, { current = false, dirty = false, eligible = true } = {}) => ({
    id,
    branch: id === 'latest' ? 'main' : `agent/${id}`,
    current,
    dirty: { error: false, tracked: dirty ? 1 : 0, untracked: 0 },
    eligible,
    mainRelationship: { kind, label: kind },
  });
  const ordered = orderFriendlyWorktrees([
    worktree('dirty-latest', 'latest', { dirty: true }),
    worktree('dirty-current', 'diverged', { current: true, dirty: true }),
    worktree('old', 'behind'),
    worktree('latest', 'latest'),
    worktree('clean-candidate', 'ahead'),
    worktree('hidden', 'unavailable', { eligible: false }),
  ]);
  assert.deepEqual(ordered.map(({ id }) => id), [
    'latest', 'dirty-current', 'clean-candidate', 'dirty-latest', 'old',
  ]);
});

test('latest-main diagnostics parse exact refs and explain branch relationships', () => {
  const mainSha = 'a'.repeat(40);
  assert.equal(parseMainRef(`${mainSha}\trefs/heads/main\n`), mainSha);
  assert.throws(() => parseMainRef(`${mainSha}\trefs/heads/develop\n`), /exact main branch SHA/);
  assert.deepEqual(describeMainRelationship({ head: mainSha, mainSha }), {
    kind: 'latest', label: `latest main (${mainSha.slice(0, 12)})`,
  });
  assert.deepEqual(describeMainRelationship({
    head: 'b'.repeat(40), headTree: 'c'.repeat(40), mainSha, mainTree: 'c'.repeat(40),
  }), {
    kind: 'same-tree', label: 'same committed files as latest main (commit IDs differ)',
  });
  assert.equal(describeMainRelationship({ head: 'b'.repeat(40), mainSha, ahead: 2, behind: 0 }).kind, 'ahead');
  assert.equal(describeMainRelationship({ head: 'b'.repeat(40), mainSha, ahead: 0, behind: 3 }).kind, 'behind');
  assert.equal(describeMainRelationship({ head: 'b'.repeat(40), mainSha, ahead: 2, behind: 3 }).kind, 'diverged');
  assert.equal(describeMainRelationship({ head: 'b'.repeat(40), mainSha }).kind, 'fetch-needed');
  assert.equal(describeMainRelationship({ head: 'b'.repeat(40), mainSha: '' }).kind, 'unavailable');
});

test('fixture profiles produce exact fresh-target preparation commands', () => {
  assert.deepEqual(fixtureCommands('empty', '/tmp/fresh'), []);
  assert.deepEqual(fixtureCommands('vt001-task', '/tmp/fresh'), [
    ['scripts/prepare-checkpoint-4-visual-evidence.js', '/tmp/fresh'],
  ]);
  assert.deepEqual(fixtureCommands('vt001-room', '/tmp/fresh'), [
    ['scripts/prepare-checkpoint-2c-visual-evidence.js', '/tmp/fresh', 'applied'],
    ['scripts/prepare-checkpoint-3-visual-evidence.js', '/tmp/fresh'],
    ['scripts/prepare-checkpoint-4-5-visual-evidence.js', '/tmp/fresh'],
  ]);
  assert.throws(() => fixtureCommands('unknown', '/tmp/fresh'), /Unknown fixture profile/);
});

test('safe labels cannot escape or create nested launch paths', () => {
  assert.equal(safeLabel('agent/Room Preview'), 'agent-room-preview');
  assert.equal(safeLabel('../../'), 'worktree');
  assert.equal(safeLabel('..'), 'worktree');
  assert.equal(safeLabel(''), 'worktree');
  assert.ok(safeLabel('x'.repeat(100)).length <= 72);
});

test('data-root containment check rejects worktree-local launch roots', () => {
  assert.equal(pathIsWithin('/repo/worktree', '/repo/worktree/.numberdroid-studio-launch'), true);
  assert.equal(pathIsWithin('/repo/worktree', '/repo/worktree'), true);
  assert.equal(pathIsWithin('/repo/worktree', '/repo/worktree/..cache/launch'), true);
  assert.equal(pathIsWithin('/repo/worktree', '/repo/worktree-other/launch'), false);
  assert.equal(pathIsWithin('/repo/worktree', '/tmp/numberdroid-studio-launch'), false);
});

test('port allocation skips a port already held on loopback', async (context) => {
  const blocker = createServer();
  await new Promise((resolveListen) => blocker.listen(0, '127.0.0.1', resolveListen));
  context.after(() => new Promise((resolveClose) => blocker.close(resolveClose)));
  const blockedPort = blocker.address().port;
  if (blockedPort === 65_535) return;
  const available = await findAvailablePort(blockedPort);
  assert.ok(available > blockedPort);
});

test('launcher shutdown waits for the child and clears its fallback timer', async (context) => {
  const child = spawn(process.execPath, ['-e', [
    "process.on('SIGTERM', () => process.exit(0));",
    "process.stdout.write('ready\\n');",
    'setInterval(() => {}, 1000);',
  ].join('')], { stdio: ['ignore', 'pipe', 'ignore'] });
  context.after(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  });
  await once(child.stdout, 'data');
  let logEnded = false;
  const startedAt = Date.now();
  await stopChild({ child, log: { end() { logEnded = true; } } });
  assert.ok(Date.now() - startedAt < 2_000);
  assert.equal(logEnded, true);
  assert.ok(child.exitCode !== null || child.signalCode !== null);
});
