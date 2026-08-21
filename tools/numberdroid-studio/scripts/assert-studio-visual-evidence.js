import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const evidenceDirectory = resolve(process.argv[2] ?? 'artifacts/studio-visual');
const expected = [
  ...['overview', 'sources', 'assets', 'rooms', 'levels', 'activity']
    .map((workspace) => [`baseline-1a/${workspace}-1440.png`, 1440, 900]),
  ...['overview', 'sources', 'assets', 'rooms', 'levels', 'activity']
    .map((workspace) => [`candidate-1b/${workspace}-1440.png`, 1440, 900]),
  ['candidate-1b/overview-agent-access-1440.png', 1440, 900],
  ['candidate-1b/overview-agent-access-1060.png', 1060, 900],
  ['candidate-1b/assets-1060.png', 1060, 900],
];

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

const screenshots = [];
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
}
if (new Set(screenshots.map(({ sha256: digest }) => digest)).size < screenshots.length - 2) {
  throw new Error('Too many visual workspaces produced identical screenshots.');
}

const manifest = {
  schemaVersion: 1,
  checkpoint: '1B-visual-candidate',
  baselineCommit: '2a7ca9cdde0179c8605163ea1f96ba1e6bce1e7d',
  candidateCommit: process.env.GITHUB_SHA ?? 'local-uncommitted',
  browser: process.env.STUDIO_VISUAL_BROWSER ?? 'Chrome/Chromium headless',
  sourceManifestHash: '7468adf14333c5fe9bce872526223ebf0134fb90ebf33d1ac2f5d809aa680673',
  fixtures: {
    baseline: { projectId: 'numberdroid-studio-demo', revision: 5, activityCount: 5 },
    candidate: {
      projectId: 'numberdroid-studio-demo', revision: 7, activityCount: 7,
      assetCards: 2, previewStates: ['PROCESSING', 'READY'],
    },
  },
  viewports: [{ width: 1440, height: 900 }, { width: 1060, height: 900 }],
  screenshots,
};
await writeFile(join(evidenceDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const sums = [...screenshots, {
  path: 'manifest.json',
  sha256: sha256(await readFile(join(evidenceDirectory, 'manifest.json'))),
}].map(({ sha256: digest, path }) => `${digest}  ${relative(evidenceDirectory, join(evidenceDirectory, path))}`).join('\n');
await writeFile(join(evidenceDirectory, 'SHA256SUMS'), `${sums}\n`);
process.stdout.write(`${JSON.stringify({ status: 'VERIFIED', screenshotCount: screenshots.length })}\n`);
