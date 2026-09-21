import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TextDecoder } from 'node:util';

const ZERO_SHA = /^0{40}$/;
const SHA = /^[0-9a-f]{40}$/;
const STUDIO_FIXTURE_ART = new Set([
  'art-source/approved/area-01-transfer-ship/floor-treatment/source/family-hygiene-floor-2x2__source-approved__2026-08-21.png',
  'art-source/approved/area-01-transfer-ship/transfer-system/source/transfer-apparatus__approved-original__2026-08-17.png',
]);

function normalizePaths(paths) {
  return [...new Set(paths)]
    .filter(Boolean)
    .sort();
}

function isMarkdown(path) {
  return path.endsWith('.md');
}

function isNonCanonicalMarkdown(path) {
  return path.toLowerCase().endsWith('.md') && !isMarkdown(path);
}

function isDocumentationOnlyPath(path) {
  if (!isMarkdown(path)) {
    return false;
  }

  return path === 'README.md'
    || path === 'AGENTS.md'
    || path === 'REPOSITORY_STRUCTURE.md'
    || path.startsWith('docs/')
    || path.startsWith('art-source/')
    || path === 'tools/numberdroid-studio/README.md'
    || path.startsWith('tools/numberdroid-studio/docs/')
    || (/^tools\/numberdroid-studio\/fixtures\/.+\/README\.md$/).test(path)
    || path === 'scripts/art/toolkit/README.md';
}

function isKnownRootPath(path) {
  return path.startsWith('src/')
    || path.startsWith('public/')
    || path.startsWith('scripts/')
    || path.startsWith('art-source/')
    || path.startsWith('binary-import-requests/')
    || path.startsWith('.github/')
    || path === '.gitignore'
    || path === 'index.html'
    || path === 'zahlenkern-prototyp-meta-v7.html'
    || /^package(?:-lock)?\.json$/.test(path)
    || /^tsconfig(?:\.[^.]+)?\.json$/.test(path)
    || /^vite\.config\.[cm]?[jt]s$/.test(path);
}

function isStudioVisualPath(path) {
  if (path === 'tools/numberdroid-studio/package.json'
    || path === 'tools/numberdroid-studio/package-lock.json') {
    return true;
  }

  const portableHeadlessContract = /^tools\/numberdroid-studio\/packages\/domain\/src\/(?:index|backup-operation|processing-(?:recipe|result|adoption-preflight)|asset-input-selection|project-capability-manifest|candidate-manifest)\.js$/.test(path)
    || /^tools\/numberdroid-studio\/packages\/application\/src\/(?:index|backup-operation-(?:service|worker)|project-capability-provider|engine-bridge|processing-adoption-preflight)\.js$/.test(path);

  if ((path.startsWith('tools/numberdroid-studio/packages/domain/')
      || path.startsWith('tools/numberdroid-studio/packages/application/'))
    && !portableHeadlessContract) {
    return true;
  }

  return path.startsWith('tools/numberdroid-studio/apps/studio-server/')
    || path.startsWith('tools/numberdroid-studio/packages/preview/')
    || path.startsWith('tools/numberdroid-studio/fixtures/')
    || /^tools\/numberdroid-studio\/scripts\/(?:capture-|assert-studio-|prepare-(?:visual|checkpoint-)|finalize-checkpoint-|verify-checkpoint-)/.test(path);
}

function isRootTestPath(path) {
  return /(?:^|\/)[^/]+\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path);
}

function isRootDeployablePath(path) {
  if (isRootTestPath(path) || isDocumentationOnlyPath(path)) {
    return false;
  }

  if (path.startsWith('src/')) {
    return true;
  }

  return path.startsWith('public/')
    || path.startsWith('art-source/')
    || (path.startsWith('scripts/') && !path.startsWith('scripts/repo/'))
    || path === 'index.html'
    || /^package(?:-lock)?\.json$/.test(path)
    || /^tsconfig(?:\.[^.]+)?\.json$/.test(path)
    || /^vite\.config\.[cm]?[jt]s$/.test(path);
}

function isCriticalClassifierPath(path) {
  return path.startsWith('.github/')
    || path === '.gitattributes'
    || path === '.gitmodules'
    || path === 'scripts/repo/ci-change-classifier.mjs'
    || path === 'scripts/repo/ci-change-classifier.selftest.mjs'
    || path === 'scripts/repo/check-markdown-links.mjs'
    || path === 'scripts/repo/check-markdown-links.selftest.mjs'
    || path === 'tools/numberdroid-studio/scripts/check-javascript-syntax.js'
    || path === 'tools/numberdroid-studio/scripts/check-javascript-syntax.selftest.js'
    || path === 'zahlenkern-prototyp-meta-v7.html';
}

export function classifyChangedPaths(inputPaths, { forceFull = false, windowsRequested = false } = {}) {
  const paths = normalizePaths(inputPaths);
  const unsafePath = paths.some((path) => path.includes('\\') || /[\u0000-\u001f\u007f]/.test(path));
  const unknownPath = paths.some((path) => !isDocumentationOnlyPath(path)
    && !path.startsWith('tools/numberdroid-studio/')
    && !isKnownRootPath(path));
  const failClosed = forceFull
    || paths.length === 0
    || unsafePath
    || paths.some(isNonCanonicalMarkdown)
    || paths.some(isCriticalClassifierPath)
    || unknownPath;

  const markdownPaths = paths.filter(isMarkdown);
  const behaviorPaths = paths.filter((path) => !isDocumentationOnlyPath(path));
  const studioPaths = behaviorPaths.filter((path) => path.startsWith('tools/numberdroid-studio/'));
  const rootPaths = behaviorPaths.filter((path) => !path.startsWith('tools/numberdroid-studio/'));
  const crossBoundaryAdapter = studioPaths.some((path) => path.startsWith('tools/numberdroid-studio/packages/numberdroid-adapter/'));
  const crossBoundaryStudioFixture = rootPaths.some((path) => STUDIO_FIXTURE_ART.has(path));

  const result = {
    docs: markdownPaths.length > 0,
    docs_only: paths.length > 0 && behaviorPaths.length === 0,
    root: rootPaths.length > 0 || crossBoundaryAdapter,
    root_visual: rootPaths.some(isRootDeployablePath),
    studio: studioPaths.length > 0 || crossBoundaryStudioFixture,
    studio_visual: crossBoundaryStudioFixture || studioPaths.some(isStudioVisualPath),
    // Owner policy: Windows is opt-in, independent of paths and full CI.
    studio_windows: windowsRequested === true,
    pages: rootPaths.some(isRootDeployablePath),
    full: failClosed,
  };

  if (failClosed) {
    result.docs = true;
    result.docs_only = false;
    result.root = true;
    result.root_visual = true;
    result.studio = true;
    result.studio_visual = true;
    result.pages = true;
  }

  return { paths, ...result };
}

export function changedPathsBetween(baseSha, headSha, { useMergeBase = false } = {}) {
  if (!SHA.test(baseSha) || !SHA.test(headSha) || ZERO_SHA.test(baseSha)) {
    return [];
  }

  let effectiveBase = baseSha;
  if (useMergeBase) {
    effectiveBase = execFileSync('git', ['merge-base', baseSha, headSha], { encoding: 'utf8' }).trim();
    if (!SHA.test(effectiveBase)) {
      throw new Error('git merge-base did not return a commit SHA');
    }
  }

  const output = execFileSync(
    'git',
    ['diff', '--name-only', '--no-renames', '--diff-filter=ACDMRTUXB', '-z', effectiveBase, headSha],
  );

  const decoded = new TextDecoder('utf-8', { fatal: true }).decode(output);
  return decoded.split('\0').filter(Boolean);
}

function printGithubOutputs(classification) {
  for (const key of [
    'docs',
    'docs_only',
    'root',
    'root_visual',
    'studio',
    'studio_visual',
    'studio_windows',
    'pages',
    'full',
  ]) {
    process.stdout.write(`${key}=${classification[key]}\n`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [baseSha, headSha, forceFullValue = 'false', useMergeBaseValue = 'false', windowsRequestedValue = 'false'] = process.argv.slice(2);
  let paths = [];
  let forceFull = forceFullValue === 'true';

  try {
    paths = changedPathsBetween(baseSha ?? '', headSha ?? '', { useMergeBase: useMergeBaseValue === 'true' });
    if (paths.length === 0) {
      forceFull = true;
    }
  } catch (error) {
    forceFull = true;
    process.stderr.write(`[ci-change-classifier] diff failed; selecting full CI: ${error.message}\n`);
  }

  const classification = classifyChangedPaths(paths, { forceFull, windowsRequested: windowsRequestedValue === 'true' });
  process.stderr.write(`[ci-change-classifier] ${JSON.stringify(classification)}\n`);
  printGithubOutputs(classification);
}
