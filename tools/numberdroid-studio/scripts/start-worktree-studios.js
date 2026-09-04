import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { createWriteStream } from 'node:fs';
import { access, mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, '../../..');
const STUDIO_RELATIVE_DIRECTORY = join('tools', 'numberdroid-studio');
const SERVER_RELATIVE_FILENAME = join('apps', 'studio-server', 'src', 'server.js');
const REQUIRED_DEPENDENCIES = ['better-sqlite3', 'zod'];
const SOURCE_FINGERPRINT_FILES = [
  'package.json',
  SERVER_RELATIVE_FILENAME,
  join('apps', 'studio-server', 'public', 'app.js'),
  join('apps', 'studio-server', 'public', 'styles.css'),
];
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

export function parseArguments(argv) {
  const options = {
    all: false,
    basePort: 4317,
    dataRoot: null,
    fixture: null,
    help: false,
    json: false,
    list: false,
    repositoryRoot: DEFAULT_REPOSITORY_ROOT,
    select: null,
    startupTimeoutMs: 15_000,
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

function printWorktrees(worktrees, output = process.stdout) {
  output.write('\nAvailable Numberdroid Studio worktrees\n');
  worktrees.forEach((worktree, index) => {
    const branch = worktree.branch ?? `detached@${worktree.head.slice(0, 12)}`;
    output.write(`  ${index + 1}. ${cleanDisplay(branch)}  ${worktree.head.slice(0, 12)}  [${availabilityText(worktree)}]\n`);
    output.write(`     ${cleanDisplay(worktree.path)}\n`);
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
  output.write(`  --select <numbers/ranges>   Select menu indices, for example 1,3-4\n`);
  output.write(`  --all                       Select every eligible worktree\n`);
  output.write(`  --fixture <profile>         empty, vt001-room, or vt001-task\n`);
  output.write(`  --base-port <port>          First preferred port (default: 4317)\n`);
  output.write(`  --data-root <new-path>      New retained launch root (default: OS temp)\n`);
  output.write(`  --startup-timeout-ms <ms>   Per-server readiness deadline (default: 15000)\n`);
  output.write(`  --help                      Show this help\n`);
}

async function chooseInteractively(worktrees) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    fail('Interactive selection needs a terminal; use --select or --all.');
  }
  const firstEligible = worktrees.findIndex((worktree) => worktree.eligible);
  if (firstEligible === -1) fail('No eligible Numberdroid Studio worktree is available.');
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const selectionText = await terminal.question(
      `Select worktrees (comma/range, a=all, q=quit) [${firstEligible + 1}]: `,
    );
    const allRequested = /^(a|all)$/i.test(selectionText.trim());
    const indices = parseSelection(selectionText, worktrees.length, { defaultIndex: firstEligible + 1 });
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

async function sourceFingerprint(studioDirectory) {
  const hash = createHash('sha256');
  for (const relativeFilename of SOURCE_FINGERPRINT_FILES) {
    hash.update(relativeFilename);
    hash.update('\0');
    hash.update(await readFile(join(studioDirectory, relativeFilename)));
    hash.update('\0');
  }
  return hash.digest('hex');
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
    const fingerprint = await sourceFingerprint(worktree.studioDirectory);
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
    pid: running.child.pid,
    sourceFingerprint: `sha256:${running.fingerprint}`,
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
  process.stdout.write(`  Source: ${snapshot.sourceFingerprint.slice(0, 23)}\n`);
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
  if (options.list) {
    if (options.json) {
      process.stdout.write(`${JSON.stringify(worktrees.map((worktree, index) => ({
        index: index + 1,
        path: worktree.path,
        branch: worktree.branch,
        detached: worktree.detached,
        head: worktree.head,
        eligible: worktree.eligible,
        dirty: worktree.dirty,
        unavailableReasons: worktree.unavailableReasons,
      })), null, 2)}\n`);
    } else printWorktrees(worktrees);
    return;
  }
  printWorktrees(worktrees);
  let indices;
  let fixture = options.fixture;
  let allRequested = options.all;
  if (options.all) indices = worktrees.flatMap((worktree, index) => (worktree.eligible ? [index + 1] : []));
  else if (options.select !== null) {
    allRequested = /^(a|all)$/i.test(options.select.trim());
    indices = parseSelection(options.select, worktrees.length);
  }
  else {
    const selected = await chooseInteractively(worktrees);
    if (selected === null) {
      process.stdout.write('No Studio instance started.\n');
      return;
    }
    ({ allRequested, indices, fixture } = selected);
  }
  if (indices.length === 0) fail('No eligible worktree is available.');
  let selectedWorktrees = indices.map((index) => worktrees[index - 1]);
  if (allRequested) {
    for (const worktree of selectedWorktrees) {
      if (!worktree.eligible) {
        process.stdout.write(`Skipping ${cleanDisplay(worktree.path)}: ${worktree.unavailableReasons.join('; ')}\n`);
      }
    }
    selectedWorktrees = selectedWorktrees.filter((worktree) => worktree.eligible);
    if (selectedWorktrees.length === 0) fail('No eligible worktree is available.');
  } else {
    for (const worktree of selectedWorktrees) {
      if (!worktree.eligible) {
        fail(`${worktree.path} is unavailable: ${worktree.unavailableReasons.join('; ')}`);
      }
    }
  }
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
  process.stdout.write('\nAll selected Studio instances are ready. Press Ctrl+C to stop them.\n');
  let stopping = false;
  let resolveStopped;
  const stopped = new Promise((resolveStop) => { resolveStopped = resolveStop; });
  const shutdown = async (signal) => {
    if (stopping) return;
    stopping = true;
    process.stdout.write(`\n${signal}: stopping ${running.length} Studio instance(s)...\n`);
    await Promise.allSettled(running.map(stopChild));
    process.stdout.write(`Stopped. Fixtures and logs retained at ${dataRoot}\n`);
    resolveStopped();
  };
  process.once('SIGINT', () => { void shutdown('SIGINT'); });
  process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
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
