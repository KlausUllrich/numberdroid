import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const evidenceDirectory = resolve(process.argv[2] ?? 'artifacts/studio-visual');
const workspaces = ['overview', 'sources', 'assets', 'rooms', 'levels', 'activity'];
const viewports = [[1440, 900], [1060, 900]];
const expected = [
  ...['baseline-1a', 'candidate-1b'].flatMap((candidate) => viewports.flatMap(([width, height]) => (
    workspaces.map((workspace) => [`${candidate}/${workspace}-${width}.png`, width, height])
  ))),
  ...viewports.map(([width, height]) => [`candidate-1b/overview-agent-access-${width}.png`, width, height]),
];

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

const screenshots = [];
const observations = [];
for (const [path, expectedWidth, expectedHeight] of expected) {
  const absolute = join(evidenceDirectory, path);
  const bytes = await readFile(absolute);
  if (bytes.length < 8_000 || bytes.subarray(1, 4).toString('ascii') !== 'PNG') {
    throw new Error(`Visual evidence is missing or invalid: ${path}`);
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== expectedWidth || height !== expectedHeight) {
    throw new Error(`${path} is ${width}x${height}; expected ${expectedWidth}x${expectedHeight}.`);
  }
  screenshots.push({ path, byteSize: bytes.length, sha256: sha256(bytes), width, height });
  const observationPath = path.replace(/\.png$/, '.observation.json');
  const observation = JSON.parse(await readFile(join(evidenceDirectory, observationPath), 'utf8'));
  if (observation.screenshotAfterReadinessInSameSession !== true
    || observation.layout?.viewport?.width !== expectedWidth
    || observation.layout?.viewport?.height !== expectedHeight
    || observation.layout?.horizontalOverflow !== false
    || observation.runtimeNetworkErrors !== 0) {
    throw new Error(`${observationPath} does not prove a ready, error-free same-session capture.`);
  }
  observations.push({ path: observationPath, ...observation });
}
if (new Set(screenshots.map(({ sha256: digest }) => digest)).size < screenshots.length - 2) {
  throw new Error('Too many visual workspaces produced identical screenshots.');
}

const candidateFixture = JSON.parse(await readFile(join(evidenceDirectory, 'candidate-fixture.json'), 'utf8'));
const liveState = JSON.parse(await readFile(join(evidenceDirectory, 'live-state.json'), 'utf8'));
const baselineState = JSON.parse(await readFile(join(evidenceDirectory, 'baseline-state.json'), 'utf8'));
if (candidateFixture.projectId !== liveState.projectId
  || candidateFixture.revision !== liveState.revision
  || candidateFixture.assetCount !== liveState.assetCount) {
  throw new Error('Prepared candidate fixture and independently observed live state differ.');
}

const manifest = {
  schemaVersion: 2,
  checkpoint: '1B-visual-candidate',
  baselineCommit: '2a7ca9cdde0179c8605163ea1f96ba1e6bce1e7d',
  candidateCommit: process.env.STUDIO_VISUAL_CANDIDATE_SHA ?? process.env.GITHUB_SHA ?? 'local-uncommitted',
  browser: process.env.STUDIO_VISUAL_BROWSER ?? 'Chrome/Chromium headless',
  node: process.version,
  locale: process.env.LANG ?? 'unspecified',
  timezone: process.env.TZ ?? 'unspecified',
  sourceManifestHash: '7468adf14333c5fe9bce872526223ebf0134fb90ebf33d1ac2f5d809aa680673',
  fixtures: {
    baseline: baselineState,
    candidate: {
      projectId: liveState.projectId,
      revision: liveState.revision,
      activityCount: liveState.activityCount,
      assetCards: liveState.assetCount,
      previewStates: liveState.previewStates,
      readyPreview: liveState.readyPreview,
      effectivePolicy: liveState.effectivePolicy,
    },
  },
  assertions: {
    liveApiMatchedPreparedFixture: true,
    baselineApiMatchedProtectedFixture: baselineState.revision === 5 && baselineState.activityCount === 5,
    everyScreenshotCapturedAfterReadinessInSameSession: observations.every(
      (observation) => observation.screenshotAfterReadinessInSameSession === true,
    ),
    allCandidateWorkspacesReady: liveState.dom.workspaces.every((workspace) => workspace.ready === 'true'),
    noCandidateHorizontalOverflowAt1060: liveState.dom.workspaces.every(
      (workspace) => workspace.horizontalOverflow === 'false',
    ),
    noCandidateBrowserErrors: liveState.dom.workspaces.every((workspace) => workspace.visualErrorCount === 0),
    readyImageLoaded: liveState.dom.workspaces.find((workspace) => workspace.workspace === 'assets')?.readyImageCount === 1,
    processingFallbackRendered: liveState.dom.workspaces.find(
      (workspace) => workspace.workspace === 'assets',
    )?.processingFallbackCount === 1,
    headerPolicyPopoverOpenAt1060: liveState.dom.agentAccess.open,
  },
  viewports: viewports.map(([width, height]) => ({ width, height })),
  screenshots,
  observations: observations.map((observation) => ({
    path: observation.path,
    mode: observation.mode,
    browser: observation.browser,
    layout: observation.layout,
  })),
};
await writeFile(join(evidenceDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const supportingPaths = [
  'baseline-state.json', 'candidate-fixture.json', 'live-state.json',
  ...observations.map(({ path }) => path),
  ...workspaces.map((workspace) => `candidate-1b/dom/${workspace}-1060.html`),
  'candidate-1b/dom/agent-access-1060.html',
];
const supportingFiles = supportingPaths.map((path) => ({
  path,
  sha256: null,
}));
for (const file of supportingFiles) file.sha256 = sha256(await readFile(join(evidenceDirectory, file.path)));
const sums = [...screenshots, ...supportingFiles, {
  path: 'manifest.json',
  sha256: sha256(await readFile(join(evidenceDirectory, 'manifest.json'))),
}].map(({ sha256: digest, path }) => `${digest}  ${relative(evidenceDirectory, join(evidenceDirectory, path))}`).join('\n');
await writeFile(join(evidenceDirectory, 'SHA256SUMS'), `${sums}\n`);
process.stdout.write(`${JSON.stringify({ status: 'VERIFIED', screenshotCount: screenshots.length })}\n`);
