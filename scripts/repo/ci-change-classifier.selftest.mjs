import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { changedPathsBetween, classifyChangedPaths } from './ci-change-classifier.mjs';

function expect(paths, expected, options) {
  const actual = classifyChangedPaths(paths, options);
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(actual[key], value, `${JSON.stringify(paths)}: expected ${key}=${value}`);
  }
}

expect(
  ['README.md', 'docs/agents/REPOSITORY_WORKFLOW.md'],
  { docs: true, docs_only: true, root: false, root_visual: false, studio: false, studio_visual: false, studio_windows: false, pages: false, full: false },
);

expect(
  ['src/implementation-notes.md'],
  { docs: true, docs_only: false, root: true, root_visual: true, studio: false, pages: true, full: false },
);

expect(
  [
    'tools/numberdroid-studio/packages/domain/src/processing-result.js',
    'tools/numberdroid-studio/tests/processing-result.node-test.js',
  ],
  { docs: false, docs_only: false, root: false, studio: true, studio_visual: false, studio_windows: false, pages: false, full: false },
);

expect(
  [
    'tools/numberdroid-studio/packages/domain/src/processing-adoption-preflight.js',
    'tools/numberdroid-studio/packages/application/src/processing-adoption-preflight.js',
    'tools/numberdroid-studio/tests/processing-adoption-preflight.node-test.js',
  ],
  { docs: false, root: false, studio: true, studio_visual: false, studio_windows: false, pages: false, full: false },
);

expect(
  [
    'tools/numberdroid-studio/packages/application/src/processing-adoption-preflight.js',
    'tools/numberdroid-studio/tests/adoption-preflight.portable.node-test.js',
  ],
  { root: false, studio: true, studio_visual: false, studio_windows: false, pages: false, full: false },
);

expect(
  [
    'tools/numberdroid-studio/packages/domain/src/backup-operation.js',
    'tools/numberdroid-studio/packages/application/src/backup-operation-service.js',
    'tools/numberdroid-studio/packages/application/src/backup-operation-worker.js',
  ],
  { docs: false, root: false, studio: true, studio_visual: false, studio_windows: false, pages: false, full: false },
);

expect(
  [
    'tools/numberdroid-studio/packages/domain/src/backup-operation.js',
    'tools/numberdroid-studio/packages/application/src/backup-operation-service.js',
    'tools/numberdroid-studio/packages/persistence/src/operations/safe-filesystem.js',
    'tools/numberdroid-studio/tests/backup-operations-domain.node-test.js',
  ],
  { docs: false, root: false, studio: true, studio_visual: false, studio_windows: false, pages: false, full: false },
);

expect(
  ['tools/numberdroid-studio/packages/application/src/backup-operation-http.js'],
  { docs: false, root: false, studio: true, studio_visual: true, studio_windows: false, pages: false, full: false },
);

expect(
  [
    'tools/numberdroid-studio/packages/persistence/src/operations/windows-root-inspect.ps1',
    'tools/numberdroid-studio/tests/backup-operations-filesystem.node-test.js',
  ],
  { docs: false, root: false, studio: true, studio_visual: false, studio_windows: false, pages: false, full: false },
);

expect(
  ['tools/numberdroid-studio/packages/application/src/studio-service.js', 'tools/numberdroid-studio/docs/ROADMAP.md'],
  { docs: true, root: false, studio: true, studio_visual: true, studio_windows: false, pages: false, full: false },
);

expect(
  ['tools/numberdroid-studio/packages/domain/src/room-definition.js'],
  { root: false, studio: true, studio_visual: true, studio_windows: false, pages: false, full: false },
);

expect(
  ['tools/numberdroid-studio/packages/domain/package-lock.json'],
  { root: false, studio: true, studio_visual: true, studio_windows: false, pages: false, full: false },
);

expect(
  ['tools/numberdroid-studio/packages/application/src/windows-path.js'],
  { root: false, studio: true, studio_visual: true, studio_windows: false, pages: false, full: false },
);

expect(
  ['tools/numberdroid-studio/packages/preview/native-addon.node'],
  { root: false, studio: true, studio_visual: true, studio_windows: false, pages: false, full: false },
);

expect(
  ['tools/numberdroid-studio/packages/persistence/src/sqlite/sqlite-project-store.js'],
  { root: false, studio: true, studio_visual: false, studio_windows: false, pages: false, full: false },
);

expect(
  ['tools/numberdroid-studio/packages/numberdroid-adapter/src/index.js'],
  { root: true, studio: true, studio_visual: false, studio_windows: false, pages: false, full: false },
);

expect(
  ['tools/numberdroid-studio/apps/studio-server/public/app.js'],
  { root: false, studio: true, studio_visual: true, studio_windows: false, pages: false, full: false },
);

expect(
  ['tools/numberdroid-studio/scripts/finalize-checkpoint-2c-evidence.js'],
  { root: false, studio: true, studio_visual: true, studio_windows: false, pages: false, full: false },
);

expect(
  ['tools/numberdroid-studio/scripts/verify-checkpoint-2c-bundle-roundtrip.js'],
  { root: false, studio: true, studio_visual: true, studio_windows: false, pages: false, full: false },
);

expect(
  ['src/App.tsx'],
  { root: true, root_visual: true, studio: false, studio_visual: false, studio_windows: false, pages: true, full: false },
);

expect(
  ['src/game/campaign.test.ts'],
  { root: true, root_visual: false, studio: false, pages: false, full: false },
);

expect(
  ['scripts/repo/binary-transport-preflight.mjs'],
  { root: true, root_visual: false, studio: false, pages: false, full: false },
);

expect(
  ['package-lock.json'],
  { root: true, root_visual: true, studio: false, pages: true, full: false },
);

expect(
  ['art-source/approved/area-01-transfer-ship/floor-treatment/source/family-hygiene-floor-2x2__source-approved__2026-08-21.png'],
  { root: true, root_visual: true, studio: true, studio_visual: true, studio_windows: false, pages: true, full: false },
);

expect(
  ['art-source/approved/area-01-transfer-ship/transfer-system/source/transfer-apparatus__approved-original__2026-08-17.png'],
  { root: true, root_visual: true, studio: true, studio_visual: true, studio_windows: false, pages: true, full: false },
);

expect(
  ['tools/numberdroid-studio/package-lock.json'],
  { root: false, studio: true, studio_visual: true, studio_windows: false, pages: false, full: false },
);

expect(
  ['.github/workflows/build.yml'],
  { docs: true, root: true, root_visual: true, studio: true, studio_visual: true, studio_windows: false, pages: true, full: true },
);

expect(
  ['.github/dependabot.yml'],
  { docs: true, root: true, root_visual: true, studio: true, studio_visual: true, studio_windows: false, pages: true, full: true },
);

expect(
  ['.gitattributes'],
  { docs: true, root: true, root_visual: true, studio: true, studio_visual: true, studio_windows: false, pages: true, full: true },
);

expect(
  ['docs/NONCANONICAL.MD'],
  { docs: true, root: true, root_visual: true, studio: true, studio_visual: true, studio_windows: false, pages: true, full: true },
);

expect(
  ['docs\\AGENTS.md'],
  { docs: true, root: true, root_visual: true, studio: true, studio_visual: true, studio_windows: false, pages: true, full: true },
);

expect(
  ['docs/injected\nname.md'],
  { docs: true, root: true, root_visual: true, studio: true, studio_visual: true, studio_windows: false, pages: true, full: true },
);

expect(
  ['src/App.tsx', 'docs/App.md'],
  { docs: true, root: true, root_visual: true, studio: false, pages: true, full: false },
);

expect(
  ['tools/numberdroid-studio/packages/domain/src/processing-result.js'],
  { docs: true, root: true, root_visual: true, studio: true, studio_visual: true, studio_windows: false, pages: true, full: true },
  { forceFull: true },
);

expect(
  [],
  { docs: true, root: true, root_visual: true, studio: true, studio_visual: true, studio_windows: false, pages: true, full: true },
);

expect(
  ['unclassified/control-plane.toml'],
  { docs: true, root: true, root_visual: true, studio: true, studio_visual: true, studio_windows: false, pages: true, full: true },
);

// Windows requires an explicit request, never a path, broad-risk fallback,
// ci-full classification or merely truthy API option. Other gates are unchanged.
for (const paths of [
  ['README.md'],
  ['tools/numberdroid-studio/packages/domain/src/processing-result.js'],
  ['tools/numberdroid-studio/apps/studio-server/public/app.js'],
  ['tools/numberdroid-studio/packages/persistence/src/sqlite/sqlite-project-store.js'],
  ['tools/numberdroid-studio/packages/persistence/src/operations/windows-root-inspect.ps1'],
  ['.github/workflows/build.yml'],
  ['unclassified/control-plane.toml'],
  [],
]) {
  for (const forceFull of [false, true]) {
    const baseline = classifyChangedPaths(paths, { forceFull });
    assert.equal(baseline.studio_windows, false);
    assert.deepEqual(classifyChangedPaths(paths, { forceFull, windowsRequested: true }),
      { ...baseline, studio_windows: true });
    for (const windowsRequested of [undefined, null, false, 0, 1, 'true', 'false', 'TRUE', {}, []]) {
      assert.deepEqual(classifyChangedPaths(paths, { forceFull, windowsRequested }), baseline,
        `Only boolean true may request Windows, not ${JSON.stringify(windowsRequested)}`);
    }
  }
}

const classifierScript = fileURLToPath(new URL('./ci-change-classifier.mjs', import.meta.url));
function classifyCli(repository, ...args) {
  const output = execFileSync(process.execPath, [classifierScript, ...args], {
    cwd: repository, encoding: 'utf8', timeout: 10_000, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const entries = output.trim().split('\n').map(line => {
    const [key, value] = line.split('=');
    assert.ok(value === 'true' || value === 'false', `Unexpected classifier CLI output: ${line}`);
    return [key, value === 'true'];
  });
  return Object.fromEntries(entries);
}

{
  const originalCwd = process.cwd();
  const repository = fs.mkdtempSync(path.join(os.tmpdir(), 'numberdroid-classifier-'));
  const git = (...args) => execFileSync('git', args, { cwd: repository, encoding: 'utf8' }).trim();
  try {
    git('init', '--quiet', '--initial-branch=main');
    git('config', 'user.email', 'classifier@example.invalid');
    git('config', 'user.name', 'Classifier Selftest');
    fs.mkdirSync(path.join(repository, 'src'), { recursive: true });
    fs.writeFileSync(path.join(repository, 'src/runtime.ts'), 'export const runtime = true;\n');
    git('add', '.');
    git('commit', '--quiet', '-m', 'base');

    git('checkout', '--quiet', '-b', 'feature');
    fs.mkdirSync(path.join(repository, 'docs'), { recursive: true });
    fs.renameSync(path.join(repository, 'src/runtime.ts'), path.join(repository, 'docs/runtime.md'));
    git('add', '--all');
    git('commit', '--quiet', '-m', 'rename runtime to docs');
    const renameHead = git('rev-parse', 'HEAD');

    fs.rmSync(path.join(repository, 'docs/runtime.md'));
    git('add', '--all');
    git('commit', '--quiet', '-m', 'delete docs target');
    const deleteHead = git('rev-parse', 'HEAD');

    process.chdir(repository);
    assert.deepEqual(changedPathsBetween(renameHead, deleteHead), ['docs/runtime.md']);

    const cliDefault = classifyCli(repository, renameHead, deleteHead);
    assert.equal(cliDefault.docs_only, true);
    assert.equal(cliDefault.studio_windows, false);
    assert.deepEqual(classifyCli(repository, renameHead, deleteHead, 'false', 'false', 'true'),
      { ...cliDefault, studio_windows: true });
    for (const value of ['', 'false', 'TRUE', 'True', '1', 'yes', ' true', 'true ']) {
      assert.deepEqual(classifyCli(repository, renameHead, deleteHead, 'false', 'false', value), cliDefault);
    }
    const cliFull = classifyCli(repository, renameHead, deleteHead, 'true', 'false');
    assert.equal(cliFull.full, true);
    assert.equal(cliFull.root, true);
    assert.equal(cliFull.studio_visual, true);
    assert.equal(cliFull.studio_windows, false, 'Full CI does not request Windows');
    assert.deepEqual(classifyCli(repository, renameHead, deleteHead, 'true', 'false', 'true'),
      { ...cliFull, studio_windows: true });
    assert.deepEqual(classifyCli(repository, 'invalid-base', deleteHead), cliFull,
      'An unresolved diff selects the full non-Windows gate set');
    assert.deepEqual(classifyCli(repository, 'invalid-base', deleteHead, 'false', 'false', 'true'),
      { ...cliFull, studio_windows: true });

    git('checkout', '--quiet', 'main');
    fs.mkdirSync(path.join(repository, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(repository, 'docs/main-only.md'), '# Main only\n');
    git('add', '.');
    git('commit', '--quiet', '-m', 'advance main');
    const currentMain = git('rev-parse', 'HEAD');

    const mergeBasePaths = changedPathsBetween(currentMain, renameHead, { useMergeBase: true });
    assert.deepEqual(mergeBasePaths, ['docs/runtime.md', 'src/runtime.ts']);
    assert.equal(mergeBasePaths.includes('docs/main-only.md'), false);
    const renameClassification = classifyChangedPaths(mergeBasePaths);
    assert.equal(renameClassification.docs, true);
    assert.equal(renameClassification.root, true);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(repository, { recursive: true, force: true });
  }
}

{
  const originalCwd = process.cwd();
  const repository = fs.mkdtempSync(path.join(os.tmpdir(), 'numberdroid-classifier-utf8-'));
  const git = (...args) => execFileSync('git', args, { cwd: repository, encoding: 'utf8' }).trim();
  try {
    git('init', '--quiet', '--initial-branch=main');
    git('config', 'user.email', 'classifier@example.invalid');
    git('config', 'user.name', 'Classifier Selftest');
    fs.writeFileSync(path.join(repository, 'base.txt'), 'base\n');
    git('add', '.');
    git('commit', '--quiet', '-m', 'base');
    const base = git('rev-parse', 'HEAD');

    fs.mkdirSync(path.join(repository, 'docs'), { recursive: true });
    const invalidPath = Buffer.concat([
      Buffer.from(`${repository}${path.sep}docs${path.sep}`),
      Buffer.from([0xff]),
      Buffer.from('.md'),
    ]);
    fs.writeFileSync(invalidPath, '# Invalid filename\n');
    git('add', '--all');
    git('commit', '--quiet', '-m', 'invalid path encoding');
    const head = git('rev-parse', 'HEAD');

    process.chdir(repository);
    assert.throws(() => changedPathsBetween(base, head));
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(repository, { recursive: true, force: true });
  }
}

{
  const workflow = fs.readFileSync(new URL('../../.github/workflows/build.yml', import.meta.url), 'utf8');
  const dispatch = workflow.match(/^  workflow_dispatch:\n([\s\S]*?)(?=^\S)/m)?.[1];
  const windowsInput = dispatch?.match(/^      windows:\n((?:        .*\n)+)/m)?.[1];
  assert.ok(windowsInput, 'Manual Build dispatch must expose the Windows request');
  assert.match(windowsInput, /^        type: boolean$/m);
  assert.match(windowsInput, /^        default: false$/m, 'Windows must be unchecked by default');
  const windowsRequest = workflow.match(/^          WINDOWS_REQUESTED: (.+)$/m)?.[1];
  assert.match(windowsRequest ?? '', /^\$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.windows(?: == true)? \}\}$/,
    'Only an explicit manual Windows input may request that job; full-CI labels and titles may not');
  assert.match(workflow,
    /node scripts\/repo\/ci-change-classifier\.mjs "\$BASE_SHA" "\$HEAD_SHA" "\$FORCE_FULL" "\$USE_MERGE_BASE" "\$WINDOWS_REQUESTED"/,
    'The manual request must be passed as the optional fifth classifier argument');
  const windowsJob = workflow.match(/^  studio-windows:\n([\s\S]*?)(?=^  [\w-]+:|$(?![\s\S]))/m)?.[1];
  assert.match(windowsJob ?? '', /needs\.changes\.outputs\.studio_windows == 'true'/);
}

console.log('CI change classifier self-test passed.');
