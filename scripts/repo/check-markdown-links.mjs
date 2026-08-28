import fs from 'node:fs';
import path from 'node:path';
import { TextDecoder } from 'node:util';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const realRoot = fs.realpathSync(root);
const failures = [];
let checked = 0;
const requiredBootstrap = [
  'README.md',
  'AGENTS.md',
  'REPOSITORY_STRUCTURE.md',
  'docs/agents/ROLE_ENTRYPOINTS.md',
  'docs/agents/REPOSITORY_WORKFLOW.md',
  'docs/agents/CHANGE_RISK_AND_VERIFICATION.md',
  'docs/README.md',
];

function extractTarget(raw) {
  const trimmed = raw.trim();
  if (trimmed.startsWith('<')) {
    const end = trimmed.indexOf('>');
    return end === -1 ? trimmed : trimmed.slice(1, end);
  }
  return trimmed.split(/\s+/, 1)[0];
}

function checkFile(file) {
  let stats;
  try {
    stats = fs.lstatSync(file);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
    return;
  }

  if (stats.isSymbolicLink()) {
    failures.push(`${file}: symbolic links are not documentation-only inputs`);
    return;
  }

  let body;
  try {
    body = new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(file));
  } catch {
    failures.push(`${file}: content is not valid UTF-8`);
    return;
  }

  const lines = body.split(/\r?\n/);
  let fenced = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s*(?:```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) {
      continue;
    }

    for (const match of line.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
      const rawTarget = extractTarget(match[1]);
      if (!rawTarget || /^(?:https?:|mailto:|data:|app:|sandbox:|#)/i.test(rawTarget)) {
        continue;
      }

      let target;
      try {
        target = decodeURIComponent(rawTarget.split('#', 1)[0].split('?', 1)[0]);
      } catch {
        failures.push(`${file}:${index + 1}: invalid URL encoding in ${rawTarget}`);
        continue;
      }
      if (!target) {
        continue;
      }

      const resolved = target.startsWith('/')
        ? path.resolve(root, target.slice(1))
        : path.resolve(path.dirname(file), target);
      checked += 1;
      if (!resolved.startsWith(`${root}${path.sep}`) && resolved !== root) {
        failures.push(`${file}:${index + 1}: target escapes repository: ${rawTarget}`);
      } else if (!fs.existsSync(resolved)) {
        failures.push(`${file}:${index + 1}: missing target: ${rawTarget}`);
      } else {
        const realResolved = fs.realpathSync(resolved);
        if (!realResolved.startsWith(`${realRoot}${path.sep}`) && realResolved !== realRoot) {
          failures.push(`${file}:${index + 1}: target escapes repository through symbolic link: ${rawTarget}`);
        }
      }
    }
  }
}

const requestedFiles = process.argv.slice(2);
let trackedFiles = [];
if (requestedFiles.length === 0) {
  try {
    const rawTrackedFiles = execFileSync('git', ['ls-files', '-z']);
    trackedFiles = new TextDecoder('utf-8', { fatal: true })
      .decode(rawTrackedFiles)
      .split('\0')
      .filter((file) => file.toLowerCase().endsWith('.md'));
  } catch {
    failures.push('Git index path names are not valid UTF-8');
  }
}
const files = (requestedFiles.length > 0
  ? requestedFiles
  : trackedFiles)
  .map((file) => path.normalize(file));

for (const file of files) {
  if (file.toLowerCase().endsWith('.md') && !file.endsWith('.md')) {
    failures.push(`${file}: Markdown paths must use the canonical lowercase .md suffix`);
  }
}

for (const required of requiredBootstrap) {
  let stats;
  try {
    stats = fs.lstatSync(required);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
  if (!stats?.isFile()) {
    failures.push(`${required}: required bootstrap document is missing or not a regular file`);
  }
}

for (const file of files) {
  checkFile(file);
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Markdown links checked: ${checked}; failures: 0; files: ${files.length}`);
}
