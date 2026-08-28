import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
  ['tools/numberdroid-studio/packages/application/src/studio-service.js', 'tools/numberdroid-studio/docs/ROADMAP.md'],
  { docs: true, root: false, studio: true, studio_visual: true, studio_windows: false, pages: false, full: false },
);

expect(
  ['tools/numberdroid-studio/packages/domain/src/room-definition.js'],
  { root: false, studio: true, studio_visual: true, studio_windows: false, pages: false, full: false },
);

expect(
  ['tools/numberdroid-studio/packages/domain/package-lock.json'],
  { root: false, studio: true, studio_visual: true, studio_windows: true, pages: false, full: false },
);

expect(
  ['tools/numberdroid-studio/packages/application/src/windows-path.js'],
  { root: false, studio: true, studio_visual: true, studio_windows: true, pages: false, full: false },
);

expect(
  ['tools/numberdroid-studio/packages/preview/native-addon.node'],
  { root: false, studio: true, studio_visual: true, studio_windows: true, pages: false, full: false },
);

expect(
  ['tools/numberdroid-studio/packages/persistence/src/sqlite/sqlite-project-store.js'],
  { root: false, studio: true, studio_visual: false, studio_windows: true, pages: false, full: false },
);

expect(
  ['tools/numberdroid-studio/packages/numberdroid-adapter/src/index.js'],
  { root: true, studio: true, studio_visual: false, studio_windows: true, pages: false, full: false },
);

expect(
  ['tools/numberdroid-studio/apps/studio-server/public/app.js'],
  { root: false, studio: true, studio_visual: true, studio_windows: true, pages: false, full: false },
);

expect(
  ['tools/numberdroid-studio/scripts/finalize-checkpoint-2c-evidence.js'],
  { root: false, studio: true, studio_visual: true, studio_windows: true, pages: false, full: false },
);

expect(
  ['tools/numberdroid-studio/scripts/verify-checkpoint-2c-bundle-roundtrip.js'],
  { root: false, studio: true, studio_visual: true, studio_windows: true, pages: false, full: false },
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
  { root: true, root_visual: true, studio: true, studio_visual: true, studio_windows: true, pages: true, full: false },
);

expect(
  ['art-source/approved/area-01-transfer-ship/transfer-system/source/transfer-apparatus__approved-original__2026-08-17.png'],
  { root: true, root_visual: true, studio: true, studio_visual: true, studio_windows: true, pages: true, full: false },
);

expect(
  ['tools/numberdroid-studio/package-lock.json'],
  { root: false, studio: true, studio_visual: true, studio_windows: true, pages: false, full: false },
);

expect(
  ['.github/workflows/build.yml'],
  { docs: true, root: true, root_visual: true, studio: true, studio_visual: true, studio_windows: true, pages: true, full: true },
);

expect(
  ['.github/dependabot.yml'],
  { docs: true, root: true, root_visual: true, studio: true, studio_visual: true, studio_windows: true, pages: true, full: true },
);

expect(
  ['.gitattributes'],
  { docs: true, root: true, root_visual: true, studio: true, studio_visual: true, studio_windows: true, pages: true, full: true },
);

expect(
  ['docs/NONCANONICAL.MD'],
  { docs: true, root: true, root_visual: true, studio: true, studio_visual: true, studio_windows: true, pages: true, full: true },
);

expect(
  ['docs\\AGENTS.md'],
  { docs: true, root: true, root_visual: true, studio: true, studio_visual: true, studio_windows: true, pages: true, full: true },
);

expect(
  ['docs/injected\nname.md'],
  { docs: true, root: true, root_visual: true, studio: true, studio_visual: true, studio_windows: true, pages: true, full: true },
);

expect(
  ['src/App.tsx', 'docs/App.md'],
  { docs: true, root: true, root_visual: true, studio: false, pages: true, full: false },
);

expect(
  ['tools/numberdroid-studio/packages/domain/src/processing-result.js'],
  { docs: true, root: true, root_visual: true, studio: true, studio_visual: true, studio_windows: true, pages: true, full: true },
  { forceFull: true },
);

expect(
  [],
  { docs: true, root: true, root_visual: true, studio: true, studio_visual: true, studio_windows: true, pages: true, full: true },
);

expect(
  ['unclassified/control-plane.toml'],
  { docs: true, root: true, root_visual: true, studio: true, studio_visual: true, studio_windows: true, pages: true, full: true },
);

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

console.log('CI change classifier self-test passed.');
