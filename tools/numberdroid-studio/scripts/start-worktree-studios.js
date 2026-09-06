import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { createWriteStream } from 'node:fs';
import { access, lstat, mkdir, mkdtemp, readFile, readlink } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, '../../..');
const STUDIO_RELATIVE_DIRECTORY = join('tools', 'numberdroid-studio');
const SERVER_RELATIVE_FILENAME = join('apps', 'studio-server', 'src', 'server.js');
const COMMIT_SHA = /^[0-9a-f]{40}$/;
const REQUIRED_DEPENDENCIES = ['better-sqlite3', 'zod'];
const FIXTURE_PROFILES = Object.freeze({
  empty: Object.freeze({ label: 'Fresh empty workspace', commands: [] }),
  'vt001-room': Object.freeze({
    label: 'VT-001 Room / Preview fixture',
    commands: [
      ['scripts/prepare-checkpoint-2c-visual-evidence.js', '$DATA', 'applied'],
      ['scripts/prepare-checkpoint-3-visual-evidence.js', '$DATA'],
      ['scripts/prepare-checkpoint-4-5-visual-evidence.js', '$DATA'],
    ],
  }),
  'vt001-task': Object.freeze({
    label: 'VT-001 Agent tasks fixture',
    commands: [
      ['scripts/prepare-checkpoint-4-visual-evidence.js', '$DATA'],
    ],
  }),
});

function fail(message) {
  throw new Error(message);
}

function cleanDisplay(value) {
  return String(value).replace(/[\u0000-\u001f\u007f]/g, '?');
}

export function parseWorktreePorcelain(value) {
  if (typeof value !== 'string') fail('Git worktree output must be a string.');
  return value.split('\0\0').filter(Boolean).map((record) => {
    const worktree = {
      path: null,
      head: null,
      branch: null,
      detached: false,
      locked: false,
      lockReason: null,
      prunable: false,
      pruneReason: null,
    };
    for (const field of record.split('\0').filter(Boolean)) {
      const separator = field.indexOf(' ');
      const key = separator === -1 ? field : field.slice(0, separator);
      const fieldValue = separator === -1 ? '' : field.slice(separator + 1);
      if (key === 'worktree') worktree.path = fieldValue;
      else if (key === 'HEAD') worktree.head = fieldValue;
      else if (key === 'branch') worktree.branch = fieldValue.replace(/^refs\/heads\//, '');
      else if (key === 'detached') worktree.detached = true;
      else if (key === 'locked') {
        worktree.locked = true;
        worktree.lockReason = fieldValue || null;
      } else if (key === 'prunable') {
        worktree.prunable = true;
        worktree.pruneReason = fieldValue || null;
      }
    }
    if (!worktree.path || !worktree.head) fail('Git returned an incomplete worktree record.');
    return worktree;
  });
}

export function parseSelection(value, count, { defaultIndex = 1 } = {}) {
  if (!Number.isInteger(count) || count < 1) fail('Selection count must be a positive integer.');
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'q' || normalized === 'quit') return null;
  if (normalized === 'a' || normalized === 'all') {
    return Array.from({ length: count }, (_, index) => index + 1);
  }
  if (!normalized) {
    if (!Number.isInteger(defaultIndex) || defaultIndex < 1 || defaultIndex > count) {
      fail('Default selection is outside the available range.');
    }
    return [defaultIndex];
  }
  const selected = [];
  const seen = new Set();
  const add = (index) => {
    if (!Number.isInteger(index) || index < 1 || index > count) {
      fail(`Worktree selection ${index} is outside 1-${count}.`);
    }
    if (!seen.has(index)) {
      seen.add(index);
      selected.push(index);
    }
  };
  for (const token of normalized.split(/[\s,]+/).filter(Boolean)) {
    const range = /^(\d+)-(\d+)$/.exec(token);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (end < start) fail(`Worktree range ${token} runs backwards.`);
      for (let index = start; index <= end; index += 1) add(index);
      continue;
    }
    if (!/^\d+$/.test(token)) fail(`Invalid worktree selection token: ${token}`);
    add(Number(token));
  }
  if (selected.length === 0) fail('Select at least one worktree.');
  return selected;
}

export function isStopCommand(value) {
  return ['q', 'quit', 'stop', 'exit'].includes(String(value).trim().toLowerCase());
}

export function parseArguments(argv) {
  const options = {
    all: false,
    basePort: 4317,
    dataRoot: null,
    fixture: null,
    help: false,
    json: false,
    list: false,
    offline: false,
    repositoryRoot: DEFAULT_REPOSITORY_ROOT,
    select: null,
    startupTimeoutMs: 15_000,
    verbose: false,
  };
  const takeValue = (argument, index) => {
    if (index + 1 >= argv.length) fail(`${argument} requires a value.`);
    return argv[index + 1];
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--all') options.all = true;
    else if (argument === '--help' || argument === '-h') options.help = true;
    else if (argument === '--json') options.json = true;
    else if (argument === '--list') options.list = true;
    else if (argument === '--offline') options.offline = true;
    else if (argument === '--verbose') options.verbose = true;
    else if (argument === '--base-port') {
      options.basePort = Number(takeValue(argument, index));
      index += 1;
    } else if (argument === '--data-root') {
      options.dataRoot = resolve(takeValue(argument, index));
      index += 1;
    } else if (argument === '--fixture') {
      options.fixture = takeValue(argument, index);
      index += 1;
    } else if (argument === '--repo-root') {
      options.repositoryRoot = resolve(takeValue(argument, index));
      index += 1;
    } else if (argument === '--select') {
      options.select = takeValue(argument, index);
      index += 1;
    } else if (argument === '--startup-timeout-ms') {
      options.startupTimeoutMs = Number(takeValue(argument, index));
      index += 1;
    } else fail(`Unknown argument: ${argument}`);
  }
  if (!Number.isInteger(options.basePort) || options.basePort < 1024 || options.basePort > 65_535) {
    fail('--base-port must be an integer from 1024 through 65535.');
  }
  if (!Number.isInteger(options.startupTimeoutMs) || options.startupTimeoutMs < 1_000
      || options.startupTimeoutMs > 120_000) {
    fail('--startup-timeout-ms must be an integer from 1000 through 120000.');
  }
  if (options.fixture !== null && !Object.hasOwn(FIXTURE_PROFILES, options.fixture)) {
    fail(`Unknown fixture profile: ${options.fixture}`);
  }
  if (options.all && options.select !== null) fail('Use --all or --select, not both.');
  if (options.json && !options.list) fail('--json is supported only with --list.');
  return options;
}

export function fixtureCommands(profile, dataDirectory) {
  const fixture = FIXTURE_PROFILES[profile];
  if (!fixture) fail(`Unknown fixture profile: ${profile}`);
  return fixture.commands.map((command) => command.map((part) => (
    part === '$DATA' ? dataDirectory : part
  )));
}

export function safeLabel(value) {
  const normalized = String(value).toLowerCase().replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '');
  return normalized.slice(0, 72) || 'worktree';
}

export function parseRemoteHeads(value, { prefix = 'refs/heads/' } = {}) {
  const heads = new Map();
  for (const line of String(value).trim().split(/\r?\n/).filter(Boolean)) {
    const match = /^([0-9a-f]{40})\s+(.+)$/.exec(line);
    if (!match || !match[2].startsWith(prefix)) continue;
    const branch = match[2].slice(prefix.length);
    if (branch && branch !== 'HEAD') heads.set(branch, match[1]);
  }
  return heads;
}

export function describeMainRelationship({ ahead = null, behind = null, head, headTree = null, mainSha, mainTree = null }) {
  if (!COMMIT_SHA.test(mainSha)) return { kind: 'unavailable', label: 'latest main unavailable' };
  if (head === mainSha) return { kind: 'latest', label: `latest main (${mainSha.slice(0, 12)})` };
  if (COMMIT_SHA.test(headTree ?? '') && headTree === mainTree) {
    return { kind: 'same-tree', label: 'same committed files as latest main (commit IDs differ)' };
  }
  if (ahead === null || behind === null) {
    return { kind: 'fetch-needed', label: `different from latest main ${mainSha.slice(0, 12)}; fetch needed for comparison` };
  }
  if (behind === 0 && ahead > 0) {
    return { kind: 'ahead', label: `based on latest main + ${ahead} commit${ahead === 1 ? '' : 's'}` };
  }
  if (ahead === 0 && behind > 0) {
    return { kind: 'behind', label: `${behind} commit${behind === 1 ? '' : 's'} behind latest main` };
  }
  return { kind: 'diverged', label: `diverged from latest main (${ahead} ahead, ${behind} behind)` };
}

export function describeRemoteBranch({ ahead = null, behind = null, branch, head, remoteSha }) {
  const suffix = (sha) => `…${sha.slice(-5)}`;
  if (!branch) return { kind: 'detached', label: 'detached snapshot; no branch to pull' };
  if (!COMMIT_SHA.test(remoteSha ?? '')) return { kind: 'local-only', label: 'no matching GitHub branch' };
  if (head === remoteSha) return { kind: 'synced', label: `up to date at ${suffix(head)}` };
  if (ahead === null || behind === null) {
    return { kind: 'remote-not-local', label: `GitHub commit ${suffix(remoteSha)} is not pulled here` };
  }
  if (ahead === 0 && behind > 0) {
    return { kind: 'remote-ahead', label: `${behind} unpulled commit${behind === 1 ? '' : 's'}; GitHub is ${suffix(remoteSha)}` };
  }
  if (behind === 0 && ahead > 0) {
    return { kind: 'local-ahead', label: `${ahead} local commit${ahead === 1 ? '' : 's'} not on GitHub` };
  }
  return { kind: 'diverged', label: `local and GitHub differ (${ahead} local, ${behind} unpulled)` };
}

export function pathIsWithin(parent, candidate) {
  const difference = relative(resolve(parent), resolve(candidate));
  return difference === ''
    || (difference !== '..' && !difference.startsWith(`..${sep}`) && !isAbsolute(difference));
}

function git(repositoryRoot, arguments_, options = {}) {
  const result = spawnSync('git', ['-C', repositoryRoot, ...arguments_], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    ...options,
  });
  if (result.error) fail(`Could not run Git: ${result.error.message}`);
  if (result.status !== 0) fail((result.stderr || 'Git command failed.').trim());
  return result.stdout;
}

function tryGit(repositoryRoot, arguments_, options = {}) {
  return spawnSync('git', ['-C', repositoryRoot, ...arguments_], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    ...options,
  });
}

function latestMain(repositoryRoot, { offline = false } = {}) {
  if (offline) {
    const cached = tryGit(repositoryRoot, [
      'for-each-ref', '--format=%(objectname)%09%(refname:strip=3)', 'refs/remotes/origin',
    ]);
    const heads = cached.status === 0 ? parseRemoteHeads(cached.stdout, { prefix: '' }) : new Map();
    const sha = heads.get('main') ?? null;
    return COMMIT_SHA.test(sha ?? '')
      ? { available: true, heads, live: false, sha, summary: `cached GitHub branches; main is …${sha.slice(-5)}` }
      : { available: false, heads, live: false, sha: null, summary: 'cached GitHub branches are unavailable' };
  }
  const remote = tryGit(repositoryRoot, ['ls-remote', '--exit-code', '--heads', 'origin'], {
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    timeout: 5_000,
  });
  if (remote.status !== 0) {
    const reason = remote.error?.code === 'ETIMEDOUT'
      ? 'check timed out'
      : `check failed (exit ${remote.status ?? 'unknown'})`;
    return { available: false, heads: new Map(), live: true, sha: null, summary: `GitHub check ${reason}` };
  }
  const heads = parseRemoteHeads(remote.stdout);
  const sha = heads.get('main') ?? null;
  return COMMIT_SHA.test(sha ?? '')
    ? { available: true, heads, live: true, sha, summary: `GitHub checked; main is …${sha.slice(-5)}` }
    : { available: false, heads, live: true, sha: null, summary: 'GitHub returned no main branch' };
}

function compareWorktreeWithRemoteBranch(worktree, remote) {
  const remoteSha = worktree.branch ? remote.heads.get(worktree.branch) ?? null : null;
  if (!remote.available && remote.heads.size === 0) {
    return { kind: 'unavailable', label: 'GitHub status unavailable' };
  }
  if (!worktree.branch || !remoteSha || worktree.head === remoteSha) {
    return describeRemoteBranch({ branch: worktree.branch, head: worktree.head, remoteSha });
  }
  const present = tryGit(worktree.path, ['cat-file', '-e', `${remoteSha}^{commit}`]);
  if (present.status !== 0) {
    return describeRemoteBranch({ branch: worktree.branch, head: worktree.head, remoteSha });
  }
  const counts = tryGit(worktree.path, ['rev-list', '--left-right', '--count', `${worktree.head}...${remoteSha}`]);
  if (counts.status !== 0) {
    return describeRemoteBranch({ branch: worktree.branch, head: worktree.head, remoteSha });
  }
  const [ahead, behind] = counts.stdout.trim().split(/\s+/).map(Number);
  return describeRemoteBranch({ ahead, behind, branch: worktree.branch, head: worktree.head, remoteSha });
}

function compareWorktreeWithMain(worktree, main) {
  if (!main.available) return describeMainRelationship({ head: worktree.head, mainSha: '' });
  if (worktree.head === main.sha) return describeMainRelationship({ head: worktree.head, mainSha: main.sha });
  const present = tryGit(worktree.path, ['cat-file', '-e', `${main.sha}^{commit}`]);
  if (present.status !== 0) return describeMainRelationship({ head: worktree.head, mainSha: main.sha });
  const mainTree = tryGit(worktree.path, ['rev-parse', `${main.sha}^{tree}`]);
  const headTree = tryGit(worktree.path, ['rev-parse', `${worktree.head}^{tree}`]);
  if (mainTree.status === 0 && headTree.status === 0
      && mainTree.stdout.trim() === headTree.stdout.trim()) {
    return describeMainRelationship({
      head: worktree.head,
      headTree: headTree.stdout.trim(),
      mainSha: main.sha,
      mainTree: mainTree.stdout.trim(),
    });
  }
  const counts = tryGit(worktree.path, ['rev-list', '--left-right', '--count', `${worktree.head}...${main.sha}`]);
  if (counts.status !== 0) return describeMainRelationship({ head: worktree.head, mainSha: main.sha });
  const [ahead, behind] = counts.stdout.trim().split(/\s+/).map(Number);
  if (!Number.isInteger(ahead) || !Number.isInteger(behind)) {
    return describeMainRelationship({ head: worktree.head, mainSha: main.sha });
  }
  return describeMainRelationship({ ahead, behind, head: worktree.head, mainSha: main.sha });
}

async function exists(filename) {
  try {
    await access(filename);
    return true;
  } catch {
    return false;
  }
}

function dirtySummary(path) {
  const result = spawnSync('git', ['-C', path, 'status', '--porcelain=v1', '--untracked-files=normal'], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) return { error: true, tracked: null, untracked: null };
  const entries = result.stdout.split(/\r?\n/).filter(Boolean);
  return {
    error: false,
    tracked: entries.filter((entry) => !entry.startsWith('??')).length,
    untracked: entries.filter((entry) => entry.startsWith('??')).length,
  };
}

export async function discoverWorktrees(repositoryRoot = DEFAULT_REPOSITORY_ROOT) {
  const raw = git(repositoryRoot, ['worktree', 'list', '--porcelain', '-z']);
  const records = parseWorktreePorcelain(raw);
  const worktrees = [];
  for (const record of records) {
    const studioDirectory = join(record.path, STUDIO_RELATIVE_DIRECTORY);
    const serverFilename = join(studioDirectory, SERVER_RELATIVE_FILENAME);
    const packageFilename = join(studioDirectory, 'package.json');
    const missingDependencies = [];
    for (const dependency of REQUIRED_DEPENDENCIES) {
      if (!await exists(join(studioDirectory, 'node_modules', dependency, 'package.json'))) {
        missingDependencies.push(dependency);
      }
    }
    const studioPresent = await exists(serverFilename) && await exists(packageFilename);
    const dirty = record.prunable ? { error: true, tracked: null, untracked: null } : dirtySummary(record.path);
    const unavailableReasons = [];
    if (record.prunable) unavailableReasons.push(`prunable: ${record.pruneReason ?? 'missing worktree'}`);
    if (!studioPresent) unavailableReasons.push('Numberdroid Studio is absent');
    if (studioPresent && missingDependencies.length > 0) {
      unavailableReasons.push(`missing dependencies: ${missingDependencies.join(', ')}`);
    }
    worktrees.push({
      ...record,
      current: resolve(record.path) === resolve(repositoryRoot),
      dirty,
      eligible: unavailableReasons.length === 0,
      missingDependencies,
      serverFilename,
      studioDirectory,
      unavailableReasons,
    });
  }
  return worktrees;
}

function availabilityText(worktree) {
  if (!worktree.eligible) return `unavailable (${worktree.unavailableReasons.join('; ')})`;
  if (worktree.dirty.error) return 'status unavailable';
  const dirtyCount = worktree.dirty.tracked + worktree.dirty.untracked;
  const status = dirtyCount === 0
    ? 'clean'
    : `dirty: ${worktree.dirty.tracked} tracked, ${worktree.dirty.untracked} untracked`;
  return worktree.locked ? `${status}; Git-locked` : status;
}

function hasLocalChanges(worktree) {
  return worktree.dirty.error || worktree.dirty.tracked + worktree.dirty.untracked > 0;
}

function friendlyBranchName(worktree) {
  const label = worktree.branch ?? `detached snapshot …${worktree.head.slice(-5)}`;
  return worktree.current ? `${label} (current folder)` : label;
}

function friendlyStatus(worktree) {
  let files = 'files clean';
  if (worktree.dirty.error) files = 'local file status unavailable';
  else if (hasLocalChanges(worktree)) {
    const parts = [];
    if (worktree.dirty.tracked > 0) parts.push(`${worktree.dirty.tracked} modified`);
    if (worktree.dirty.untracked > 0) parts.push(`${worktree.dirty.untracked} new`);
    files = `${parts.join(', ')} file${worktree.dirty.tracked + worktree.dirty.untracked === 1 ? '' : 's'}`;
  }
  return `commit …${worktree.head.slice(-5)} · ${files}`;
}

function worktreeRank(worktree) {
  if (worktree.current) return 0;
  if (worktree.branch === 'main') return 1;
  if (worktree.branch) return 2;
  return 3;
}

export function orderFriendlyWorktrees(worktrees) {
  return worktrees.filter((worktree) => worktree.eligible)
    .map((worktree, originalIndex) => ({ originalIndex, worktree }))
    .sort((left, right) => worktreeRank(left.worktree) - worktreeRank(right.worktree)
      || left.originalIndex - right.originalIndex)
    .map(({ worktree }) => worktree);
}

function printFriendlyWorktrees(worktrees, remote, hiddenCount, output = process.stdout) {
  output.write('\nChoose worktree(s) to start\n');
  if (remote.available && remote.live) output.write('GitHub status checked.\n\n');
  else if (remote.available) output.write('Using cached GitHub status; it may be old.\n\n');
  else output.write('GitHub status unavailable; local worktrees are still shown.\n\n');
  worktrees.forEach((worktree, index) => {
    output.write(`  ${index + 1}. ${friendlyBranchName(worktree)}\n`);
    output.write(`     ${friendlyStatus(worktree)}\n`);
    output.write(`     GitHub: ${worktree.remoteBranch.label}\n`);
  });
  if (hiddenCount > 0) output.write(`\n${hiddenCount} unavailable worktree${hiddenCount === 1 ? '' : 's'} hidden. Type d for technical details.\n`);
}

function printTechnicalWorktrees(worktrees, main, output = process.stdout) {
  output.write('\nTechnical worktree details\n');
  output.write(`Latest check: ${main.summary}\n`);
  worktrees.forEach((worktree, index) => {
    const branch = worktree.branch ?? `detached@${worktree.head.slice(0, 12)}`;
    output.write(`  ${index + 1}. ${cleanDisplay(branch)}  ${worktree.head.slice(0, 12)}  [${availabilityText(worktree)}]\n`);
    output.write(`     ${cleanDisplay(worktree.path)}\n`);
    output.write(`     GitHub branch: ${worktree.remoteBranch.label}\n`);
    output.write(`     Main: ${worktree.mainRelationship.label}\n`);
  });
}

function printHelp(output = process.stdout) {
  output.write(`Numberdroid Studio worktree launcher\n\n`);
  output.write(`Usage:\n`);
  output.write(`  npm run dev:worktrees\n`);
  output.write(`  npm run dev:worktrees -- --list\n`);
  output.write(`  npm run dev:worktrees -- --select 1,3-4 --fixture vt001-room\n`);
  output.write(`  npm run dev:worktrees -- --all --fixture empty --base-port 4317\n\n`);
  output.write(`Options:\n`);
  output.write(`  --list                      Print worktrees without starting Studio\n`);
  output.write(`  --json                      Machine-readable output with --list\n`);
  output.write(`  --offline                   Use cached origin branches instead of a live read-only check\n`);
  output.write(`  --verbose                   Show paths, commits, and Git comparison details\n`);
  output.write(`  --select <numbers/ranges>   Select menu indices, for example 1,3-4\n`);
  output.write(`  --all                       Select every eligible worktree\n`);
  output.write(`  --fixture <profile>         empty, vt001-room, or vt001-task\n`);
  output.write(`  --base-port <port>          First preferred port (default: 4317)\n`);
  output.write(`  --data-root <new-path>      New retained launch root (default: OS temp)\n`);
  output.write(`  --startup-timeout-ms <ms>   Per-server readiness deadline (default: 15000)\n`);
  output.write(`  --help                      Show this help\n`);
}

async function chooseInteractively(worktrees, main, hiddenCount) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    fail('Interactive selection needs a terminal; use --select or --all.');
  }
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    let selectionText;
    while (true) {
      selectionText = await terminal.question(
        'Enter one number, or several like 1,2. Press Enter for 1; d=details; q=quit: ',
      );
      if (selectionText.trim().toLowerCase() !== 'd') break;
      printTechnicalWorktrees(worktrees, main);
      if (hiddenCount > 0) process.stdout.write(`${hiddenCount} unavailable worktree${hiddenCount === 1 ? '' : 's'} remain hidden from selection.\n\n`);
    }
    const allRequested = /^(a|all)$/i.test(selectionText.trim());
    const indices = parseSelection(selectionText, worktrees.length, { defaultIndex: 1 });
    if (indices === null) return null;
    process.stdout.write('\nFixture profile\n');
    process.stdout.write('  1. Fresh empty workspace\n');
    process.stdout.write('  2. VT-001 Room / Preview fixture\n');
    process.stdout.write('  3. VT-001 Agent tasks fixture\n');
    const fixtureText = (await terminal.question('Select fixture [1]: ')).trim();
    const fixture = ({ '': 'empty', 1: 'empty', 2: 'vt001-room', 3: 'vt001-task' })[fixtureText];
    if (!fixture) fail(`Invalid fixture selection: ${fixtureText}`);
    return { allRequested, indices, fixture };
  } finally {
    terminal.close();
  }
}

async function reserveDataRoot(requestedRoot) {
  if (requestedRoot === null) return mkdtemp(join(tmpdir(), 'numberdroid-studio-launch-'));
  try {
    await mkdir(requestedRoot);
    return requestedRoot;
  } catch (error) {
    if (error?.code === 'EEXIST') fail(`--data-root must not already exist: ${requestedRoot}`);
    throw error;
  }
}

export function canListen(port, host = '127.0.0.1') {
  return new Promise((resolveAvailable) => {
    const probe = createServer();
    probe.unref();
    probe.once('error', () => resolveAvailable(false));
    probe.listen({ host, port, exclusive: true }, () => {
      probe.close(() => resolveAvailable(true));
    });
  });
}

export async function findAvailablePort(basePort, reserved = new Set()) {
  for (let port = basePort; port <= 65_535; port += 1) {
    if (!reserved.has(port) && await canListen(port)) return port;
  }
  fail(`No free loopback port is available from ${basePort} through 65535.`);
}

async function sourceFingerprint(worktree) {
  const repositoryStudioPath = STUDIO_RELATIVE_DIRECTORY.replaceAll('\\', '/');
  const treeSha = git(worktree.path, ['rev-parse', `HEAD:${repositoryStudioPath}`]).trim();
  const trackedDiff = git(worktree.path, [
    'diff', '--binary', '--no-ext-diff', 'HEAD', '--', repositoryStudioPath,
  ]);
  const untracked = git(worktree.path, [
    'ls-files', '--others', '--exclude-standard', '-z', '--', repositoryStudioPath,
  ]).split('\0').filter(Boolean).sort();
  const hash = createHash('sha256');
  hash.update('tree\0');
  hash.update(treeSha);
  hash.update('\0tracked-diff\0');
  hash.update(trackedDiff);
  for (const repositoryFilename of untracked) {
    const filename = resolve(worktree.path, repositoryFilename);
    if (!pathIsWithin(worktree.path, filename)) fail(`Git reported an unsafe source path: ${repositoryFilename}`);
    const metadata = await lstat(filename);
    hash.update('\0untracked\0');
    hash.update(repositoryFilename);
    hash.update('\0');
    if (metadata.isSymbolicLink()) {
      hash.update('symlink\0');
      hash.update(await readlink(filename));
    } else if (metadata.isFile()) {
      hash.update('file\0');
      hash.update(await readFile(filename));
    } else {
      fail(`Unsupported untracked Studio source entry: ${repositoryFilename}`);
    }
    hash.update('\0');
  }
  return { effectiveSha: hash.digest('hex'), treeSha };
}

async function unsupportedFixtureScripts(worktree, fixture) {
  const relativeScripts = fixtureCommands(fixture, '$DATA').map(([relativeScript]) => relativeScript);
  const missing = [];
  for (const relativeScript of relativeScripts) {
    if (!await exists(join(worktree.studioDirectory, relativeScript))) missing.push(relativeScript);
  }
  return missing;
}

function attachOutput(readable, prefix, log, destination) {
  let pending = '';
  readable.setEncoding('utf8');
  readable.on('data', (chunk) => {
    log.write(chunk);
    pending += chunk;
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? '';
    for (const line of lines) destination.write(`[${prefix}] ${line}\n`);
  });
  readable.on('end', () => {
    if (pending) destination.write(`[${prefix}] ${pending}\n`);
  });
}

function attachLogOnly(readable, log) {
  readable.on('data', (chunk) => log.write(chunk));
}

async function runFixtureCommand({ command, dataDirectory, label, log, studioDirectory }) {
  const [relativeScript, ...arguments_] = command;
  const script = join(studioDirectory, relativeScript);
  if (!await exists(script)) fail(`${label} does not provide fixture script ${relativeScript}.`);
  process.stdout.write(`[${label}] prepare ${relativeScript}\n`);
  const child = spawn(process.execPath, [script, ...arguments_], {
    cwd: studioDirectory,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  attachLogOnly(child.stdout, log);
  attachOutput(child.stderr, label, log, process.stderr);
  const [code, signal] = await once(child, 'exit');
  if (code !== 0) fail(`${label} fixture preparation failed (${signal ?? `exit ${code}`}).`);
  if (!await exists(dataDirectory)) fail(`${label} fixture did not create ${dataDirectory}.`);
  process.stdout.write(`[${label}] prepared ${relativeScript}\n`);
}

async function waitForStudio({ child, timeoutMs, url }) {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'no response';
  while (Date.now() < deadline) {
    if (!childIsRunning(child)) {
      fail(`Studio exited before becoming ready (${child.signalCode ?? `exit ${child.exitCode}`}).`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_500) });
      const body = await response.text();
      if (response.status === 200 && body.includes('<title>Numberdroid Studio</title>')) {
        return { status: response.status, title: 'Numberdroid Studio' };
      }
      lastError = `HTTP ${response.status} with an unexpected page`;
    } catch (error) {
      lastError = error.message;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
  }
  fail(`Studio readiness timed out after ${timeoutMs} ms (${lastError}).`);
}

function childIsRunning(child) {
  return child.exitCode === null && child.signalCode === null;
}

function studioEnvironment(dataDirectory, port) {
  const environment = { ...process.env };
  delete environment.NUMBERDROID_STUDIO_OPERATIONS_CONFIG;
  environment.NUMBERDROID_STUDIO_DATA = dataDirectory;
  environment.NUMBERDROID_STUDIO_HOST = '127.0.0.1';
  environment.NUMBERDROID_STUDIO_PORT = String(port);
  environment.NUMBERDROID_STUDIO_STORE = 'sqlite';
  return environment;
}

async function startOne({ dataDirectory, label, logFilename, port, startupTimeoutMs, worktree }) {
  const log = createWriteStream(logFilename, { flags: 'a' });
  let child = null;
  try {
    const fingerprint = await sourceFingerprint(worktree);
    for (const command of fixtureCommands(worktree.fixture, dataDirectory)) {
      await runFixtureCommand({ command, dataDirectory, label, log, studioDirectory: worktree.studioDirectory });
    }
    child = spawn(process.execPath, [worktree.serverFilename], {
      cwd: worktree.studioDirectory,
      env: studioEnvironment(dataDirectory, port),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    attachOutput(child.stdout, label, log, process.stdout);
    attachOutput(child.stderr, label, log, process.stderr);
    const url = `http://127.0.0.1:${port}`;
    const health = await waitForStudio({ child, timeoutMs: startupTimeoutMs, url });
    return { child, dataDirectory, fingerprint, health, label, log, logFilename, port, url, worktree };
  } catch (error) {
    if (child && childIsRunning(child)) child.kill('SIGTERM');
    log.end();
    throw error;
  }
}

async function waitForChildExit(child, timeoutMs) {
  if (!childIsRunning(child)) return;
  let timeout;
  try {
    await Promise.race([
      once(child, 'exit'),
      new Promise((resolveDelay) => { timeout = setTimeout(resolveDelay, timeoutMs); }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

export async function stopChild(running) {
  if (childIsRunning(running.child)) running.child.kill('SIGTERM');
  await waitForChildExit(running.child, 10_000);
  if (childIsRunning(running.child)) {
    running.child.kill('SIGKILL');
    await waitForChildExit(running.child, 2_000);
  }
  running.log.end();
}

function debugSnapshot(running) {
  const { worktree } = running;
  return {
    branch: worktree.branch ?? '(detached)',
    dataDirectory: running.dataDirectory,
    dirty: worktree.dirty,
    fixture: worktree.fixture,
    head: worktree.head,
    health: running.health,
    log: running.logFilename,
    mainRelationship: worktree.mainRelationship,
    remoteBranch: worktree.remoteBranch,
    pid: running.child.pid,
    sourceFingerprint: `sha256:${running.fingerprint.effectiveSha}`,
    studioTree: running.fingerprint.treeSha,
    url: running.url,
    worktree: worktree.path,
  };
}

function printReady(running) {
  const snapshot = debugSnapshot(running);
  process.stdout.write(`\nREADY ${running.label}\n`);
  process.stdout.write(`  Worktree: ${cleanDisplay(snapshot.worktree)}\n`);
  process.stdout.write(`  Branch: ${cleanDisplay(snapshot.branch)}\n`);
  process.stdout.write(`  HEAD: ${snapshot.head}\n`);
  process.stdout.write(`  Status: ${availabilityText(running.worktree)}\n`);
  process.stdout.write(`  GitHub branch: ${snapshot.remoteBranch.label}\n`);
  process.stdout.write(`  Studio tree: ${snapshot.studioTree}\n`);
  process.stdout.write(`  Effective source: ${snapshot.sourceFingerprint.slice(0, 23)}\n`);
  process.stdout.write(`  Fixture: ${snapshot.fixture}\n`);
  process.stdout.write(`  Health: HTTP ${snapshot.health.status}, ${snapshot.health.title}\n`);
  process.stdout.write(`  PID: ${snapshot.pid}\n`);
  process.stdout.write(`  URL: ${snapshot.url}\n`);
  process.stdout.write(`  Data: ${cleanDisplay(snapshot.dataDirectory)}\n`);
  process.stdout.write(`  Log: ${cleanDisplay(snapshot.log)}\n`);
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  if (options.help) {
    printHelp();
    return;
  }
  const majorNodeVersion = Number(process.versions.node.split('.')[0]);
  if (majorNodeVersion < 22) fail(`Node.js 22 or newer is required; found ${process.versions.node}.`);
  const worktrees = await discoverWorktrees(options.repositoryRoot);
  if (worktrees.length === 0) fail('Git did not report any worktrees.');
  const mainReference = latestMain(options.repositoryRoot, { offline: options.offline });
  for (const worktree of worktrees) {
    worktree.mainRelationship = compareWorktreeWithMain(worktree, mainReference);
    worktree.remoteBranch = compareWorktreeWithRemoteBranch(worktree, mainReference);
  }
  const selectableWorktrees = orderFriendlyWorktrees(worktrees);
  const hiddenCount = worktrees.length - selectableWorktrees.length;
  if (selectableWorktrees.length === 0) fail('No runnable Numberdroid Studio worktree is available.');
  if (options.list) {
    if (options.json) {
      process.stdout.write(`${JSON.stringify({
        github: {
          available: mainReference.available,
          live: mainReference.live,
          mainSha: mainReference.sha,
          summary: mainReference.summary,
        },
        worktrees: worktrees.map((worktree, index) => ({
          index: index + 1,
          path: worktree.path,
          branch: worktree.branch,
          detached: worktree.detached,
          head: worktree.head,
          eligible: worktree.eligible,
          dirty: worktree.dirty,
          mainRelationship: worktree.mainRelationship,
          remoteBranch: worktree.remoteBranch,
          unavailableReasons: worktree.unavailableReasons,
        })),
      }, null, 2)}\n`);
    } else if (options.verbose) printTechnicalWorktrees(worktrees, mainReference);
    else printFriendlyWorktrees(selectableWorktrees, mainReference, hiddenCount);
    return;
  }
  if (options.verbose) printTechnicalWorktrees(selectableWorktrees, mainReference);
  else printFriendlyWorktrees(selectableWorktrees, mainReference, hiddenCount);
  let indices;
  let fixture = options.fixture;
  let allRequested = options.all;
  if (options.all) indices = selectableWorktrees.map((_, index) => index + 1);
  else if (options.select !== null) {
    allRequested = /^(a|all)$/i.test(options.select.trim());
    indices = parseSelection(options.select, selectableWorktrees.length);
  }
  else {
    const selected = await chooseInteractively(selectableWorktrees, mainReference, hiddenCount);
    if (selected === null) {
      process.stdout.write('No Studio instance started.\n');
      return;
    }
    ({ allRequested, indices, fixture } = selected);
  }
  if (indices.length === 0) fail('No eligible worktree is available.');
  let selectedWorktrees = indices.map((index) => selectableWorktrees[index - 1]);
  fixture ??= 'empty';
  const fixtureCompatibility = await Promise.all(selectedWorktrees.map(async (worktree) => ({
    missing: await unsupportedFixtureScripts(worktree, fixture),
    worktree,
  })));
  if (allRequested) {
    for (const { missing, worktree } of fixtureCompatibility) {
      if (missing.length > 0) {
        process.stdout.write(`Skipping ${cleanDisplay(worktree.path)}: fixture ${fixture} requires ${missing.join(', ')}\n`);
      }
    }
    selectedWorktrees = fixtureCompatibility.filter(({ missing }) => missing.length === 0)
      .map(({ worktree }) => worktree);
    if (selectedWorktrees.length === 0) fail(`No eligible worktree supports fixture ${fixture}.`);
  } else {
    const unsupported = fixtureCompatibility.find(({ missing }) => missing.length > 0);
    if (unsupported) {
      fail(`${unsupported.worktree.path} does not support fixture ${fixture}; missing ${unsupported.missing.join(', ')}.`);
    }
  }
  if (options.dataRoot !== null) {
    const containingWorktree = selectedWorktrees.find((worktree) => pathIsWithin(worktree.path, options.dataRoot));
    if (containingWorktree) {
      fail(`--data-root must be outside every selected worktree; ${options.dataRoot} is inside ${containingWorktree.path}.`);
    }
  }
  const dataRoot = await reserveDataRoot(options.dataRoot);
  const logsDirectory = join(dataRoot, 'logs');
  await mkdir(logsDirectory);
  const gitVersion = git(options.repositoryRoot, ['--version']).trim();
  process.stdout.write(`\nLaunch diagnostics\n`);
  process.stdout.write(`  Repository: ${cleanDisplay(options.repositoryRoot)}\n`);
  process.stdout.write(`  Git: ${cleanDisplay(gitVersion)}\n`);
  process.stdout.write(`  Node: ${process.versions.node}\n`);
  process.stdout.write(`  GitHub: ${mainReference.summary}\n`);
  process.stdout.write(`  Fixture: ${fixture} (${FIXTURE_PROFILES[fixture].label})\n`);
  process.stdout.write(`  Data root: ${cleanDisplay(dataRoot)} (retained after shutdown)\n`);
  const running = [];
  const reservedPorts = new Set();
  try {
    for (let index = 0; index < selectedWorktrees.length; index += 1) {
      const worktree = selectedWorktrees[index];
      worktree.fixture = fixture;
      const branchLabel = worktree.branch ?? `detached-${worktree.head.slice(0, 12)}`;
      const label = `${index + 1}-${safeLabel(branchLabel)}`;
      const dataDirectory = join(dataRoot, label);
      const logFilename = join(logsDirectory, `${label}.log`);
      if (await exists(dataDirectory)) fail(`Fresh data target already exists: ${dataDirectory}`);
      const port = await findAvailablePort(options.basePort, reservedPorts);
      reservedPorts.add(port);
      if (port !== options.basePort + index) {
        process.stdout.write(`[${label}] preferred port ${options.basePort + index} unavailable; using ${port}\n`);
      }
      const instance = await startOne({
        dataDirectory,
        label,
        logFilename,
        port,
        startupTimeoutMs: options.startupTimeoutMs,
        worktree,
      });
      running.push(instance);
      printReady(instance);
    }
  } catch (error) {
    await Promise.allSettled(running.map(stopChild));
    process.stderr.write(`Launch root retained for diagnosis: ${dataRoot}\n`);
    throw error;
  }
  let stopping = false;
  let resolveStopped;
  let commandInput = null;
  const stopped = new Promise((resolveStop) => { resolveStopped = resolveStop; });
  const shutdown = async (reason) => {
    if (stopping) return;
    stopping = true;
    commandInput?.close();
    process.stdout.write(`\n${reason}: stopping ${running.length} Studio instance(s)...\n`);
    await Promise.allSettled(running.map(stopChild));
    process.stdout.write(`Stopped. Fixtures and logs retained at ${dataRoot}\n`);
    resolveStopped();
  };
  process.once('SIGINT', () => { void shutdown('Ctrl+C'); });
  process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
  if (process.stdin.isTTY) {
    commandInput = createInterface({ input: process.stdin, output: process.stdout });
    commandInput.on('line', (value) => {
      if (isStopCommand(value)) void shutdown('Stop requested');
      else if (value.trim()) process.stdout.write('Type q and press Enter to stop Studio.\n');
    });
    commandInput.on('SIGINT', () => { void shutdown('Ctrl+C'); });
    process.stdout.write('\nAll selected Studio instances are ready. Type q and press Enter to stop them.\n');
  } else {
    process.stdout.write('\nAll selected Studio instances are ready. Send SIGINT or SIGTERM to stop them.\n');
  }
  for (const instance of running) {
    instance.child.once('exit', (code, signal) => {
      if (!stopping) {
        process.stderr.write(`[${instance.label}] Studio exited unexpectedly (${signal ?? `exit ${code}`}).\n`);
        if (running.every(({ child }) => !childIsRunning(child))) void shutdown('all instances exited');
      }
    });
  }
  await stopped;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`Studio launcher failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
