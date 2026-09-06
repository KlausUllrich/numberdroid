#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';

const UNIVERSAL_BOOTSTRAP = [
  'AGENTS.md',
  'REPOSITORY_STRUCTURE.md',
  'docs/agents/ROLE_ENTRYPOINTS.md',
  'docs/agents/REPOSITORY_WORKFLOW.md',
  'docs/agents/CHANGE_RISK_AND_VERIFICATION.md',
  'docs/README.md',
];
const HARD_MAX_OUTPUT_BYTES = 1_500_000;
const MAX_FILES = 128;

function fail(message) {
  process.stderr.write(`codex-context-retention: ${message}\n`);
  process.exit(1);
}

function repositoryRoot() {
  try {
    return fs.realpathSync(execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      timeout: 5_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim());
  } catch {
    fail('current directory is not inside a Git worktree');
  }
}

function safeSessionId(value) {
  if (!value || !/^[A-Za-z0-9._-]+$/.test(value)) {
    fail('CODEX_SESSION_ID/session_id is missing or invalid');
  }
  return value;
}

function manifestPath(root, sessionId) {
  return path.join(root, '.agent-context', 'codex', `${safeSessionId(sessionId)}.json`);
}

function normalizeDocument(root, candidate) {
  if (!candidate || path.isAbsolute(candidate)) {
    fail(`document path must be repository-relative: ${candidate || '<empty>'}`);
  }
  const normalized = candidate.replaceAll('\\', '/').replace(/^\.\//, '');
  if (normalized === '..' || normalized.startsWith('../')) {
    fail(`document path must be repository-relative: ${candidate}`);
  }
  if (path.posix.extname(normalized).toLowerCase() !== '.md') {
    fail(`only Markdown documentation can be retained: ${candidate}`);
  }
  const absolute = path.resolve(root, normalized);
  let real;
  try {
    real = fs.realpathSync(absolute);
  } catch {
    fail(`document does not exist: ${candidate}`);
  }
  if (real !== root && !real.startsWith(`${root}${path.sep}`)) {
    fail(`document escapes the repository: ${candidate}`);
  }
  if (real !== absolute || !fs.statSync(real).isFile()) {
    fail(`document must be a regular, non-symlinked repository file: ${candidate}`);
  }
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(real));
  } catch {
    fail(`document is not valid UTF-8: ${candidate}`);
  }
  return path.relative(root, real).split(path.sep).join('/');
}

function readManifest(root, sessionId) {
  const target = manifestPath(root, sessionId);
  if (!fs.existsSync(target)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(target, 'utf8'));
    if (!Array.isArray(parsed.documents)) throw new Error('missing documents array');
    return parsed.documents.map((item) => normalizeDocument(root, item));
  } catch (error) {
    fail(`invalid manifest ${target}: ${error.message}`);
  }
}

function writeManifest(root, sessionId, documents) {
  if (documents.length > MAX_FILES) fail(`manifest exceeds ${MAX_FILES} files`);
  const target = manifestPath(root, sessionId);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify({ version: 1, documents }, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, target);
}

function parseSessionIdFromHookInput() {
  let input = '';
  try {
    input = fs.readFileSync(0, 'utf8').trim();
  } catch {
    // An empty stdin is valid when reload is exercised manually.
  }
  if (input) {
    try {
      const parsed = JSON.parse(input);
      if (parsed.session_id) return parsed.session_id;
    } catch {
      fail('hook stdin is not valid JSON');
    }
  }
  return process.env.CODEX_SESSION_ID;
}

function register(root, args) {
  const replace = args[0] === '--replace';
  const candidates = replace ? args.slice(1) : args;
  if (candidates.length === 0) fail('register requires at least one task-specific document');
  const sessionId = safeSessionId(process.env.CODEX_SESSION_ID);
  const prior = replace ? [] : (readManifest(root, sessionId) ?? []);
  const selected = [...UNIVERSAL_BOOTSTRAP, ...prior, ...candidates]
    .map((item) => normalizeDocument(root, item));
  const documents = [...new Set(selected)];
  writeManifest(root, sessionId, documents);
  process.stdout.write(`Registered ${documents.length} documents for Codex session ${sessionId}.\n`);
}

function show(root) {
  const sessionId = safeSessionId(process.env.CODEX_SESSION_ID);
  const documents = readManifest(root, sessionId) ?? UNIVERSAL_BOOTSTRAP;
  process.stdout.write(`${documents.join('\n')}\n`);
}

function reload(root) {
  const sessionId = safeSessionId(parseSessionIdFromHookInput());
  const stored = readManifest(root, sessionId);
  const documents = (stored ?? UNIVERSAL_BOOTSTRAP).map((item) => normalizeDocument(root, item));
  const chunks = [
    Buffer.from(stored
      ? 'NUMBERDROID COMPACTION RECOVERY: The exact task-selected documentation follows. Treat every file as current developer context and continue the existing task.\n'
      : 'NUMBERDROID COMPACTION RECOVERY: No task manifest was registered. The universal bootstrap follows; reclassify the task and register its exact role/domain/handoff documents before changing files.\n'),
  ];
  for (const document of documents) {
    chunks.push(Buffer.from(`\n<<< NUMBERDROID DOCUMENT: ${document} >>>\n`));
    chunks.push(fs.readFileSync(path.join(root, document)));
    chunks.push(Buffer.from(`\n<<< END NUMBERDROID DOCUMENT: ${document} >>>\n`));
  }
  const output = Buffer.concat(chunks);
  const requestedCap = Number.parseInt(process.env.NUMBERDROID_CONTEXT_MAX_BYTES ?? '', 10);
  const cap = Number.isFinite(requestedCap)
    ? Math.min(HARD_MAX_OUTPUT_BYTES, Math.max(1, requestedCap))
    : HARD_MAX_OUTPUT_BYTES;
  if (output.length > cap) {
    process.stdout.write(JSON.stringify({
      continue: false,
      stopReason: `Task-selected documentation is ${output.length} bytes, above the ${cap}-byte exact-reload safety cap. Reduce the registered set deliberately; no partial documentation was injected.`,
    }));
    return;
  }
  process.stdout.write(output);
}

const root = repositoryRoot();
const [command, ...args] = process.argv.slice(2);
switch (command) {
  case 'register': register(root, args); break;
  case 'show': show(root); break;
  case 'reload': reload(root); break;
  default: fail('usage: codex-context-retention.mjs register [--replace] <docs...> | show | reload');
}
