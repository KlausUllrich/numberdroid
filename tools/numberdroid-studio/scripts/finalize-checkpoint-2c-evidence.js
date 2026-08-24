import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const evidenceDirectory = resolve(process.argv[2] ?? 'artifacts/studio-checkpoint-2c');
const manifestPath = join(evidenceDirectory, 'evidence-manifest.json');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function json(path) {
  return JSON.parse(await readFile(join(evidenceDirectory, path), 'utf8'));
}

const pendingFixture = await json('fixture-pending.json');
const appliedFixture = await json('fixture-applied.json');
const bundle = await json('bundle-roundtrip.json');
assert(pendingFixture.phase === 'pending' && pendingFixture.revision === 9
  && pendingFixture.proposalState === 'PENDING' && pendingFixture.itemCount === 4,
'Pending 2C fixture metadata is incomplete.');
assert(appliedFixture.revision === 11 && appliedFixture.activityCount === 12
  && appliedFixture.proposal?.state === 'APPLIED'
  && appliedFixture.proposal?.itemCount === 4
  && appliedFixture.assets?.length === 3
  && appliedFixture.authorityEvidence?.deniedOrFailedAttemptCount === 1
  && appliedFixture.authorityEvidence?.finalAttemptCode === 'BUDGET_EXCEEDED',
'Applied 2C fixture metadata is incomplete.');
assert(bundle.status === 'VERIFIED' && bundle.revision === 11 && bundle.artifactCount === 5
  && Object.values(bundle.canonicalRoundTrip).every(Boolean)
  && bundle.importedWorkspace?.integrityOk === true
  && Object.values(bundle.importedWorkspace.liveAuthorityAndOperationalRows).every((count) => count === 0),
'Portable bundle evidence is incomplete.');

for (const width of [1440, 1060]) {
  const pending = await json(`pending/proposal-review-${width}.observation.json`);
  assert(pending.mode === 'checkpoint-2c' && pending.checkpoint2cPhase === 'pending'
    && pending.layout?.viewport?.width === width && pending.layout.viewport.height === 900
    && pending.layout.visualErrorCount === 0 && pending.runtimeNetworkErrors === 0
    && pending.checkpoint2cInteractionEvidence?.focused === true
    && pending.checkpoint2cInteractionEvidence?.localScrollTop > 0
    && pending.checkpoint2cInteractionEvidence?.pageScrollY > 0,
  `Pending ${width}px browser observation is incomplete.`);
  for (const focus of ['inventory', 'proposal']) {
    const applied = await json(`applied/${focus}-${width}.observation.json`);
    assert(applied.mode === 'checkpoint-2c' && applied.checkpoint2cPhase === 'applied'
      && applied.layout?.viewport?.width === width && applied.layout.viewport.height === 900
      && applied.layout.visualErrorCount === 0 && applied.runtimeNetworkErrors === 0
      && applied.layout.cards?.length === 3
      && applied.layout.assetLibrary?.proposalState === 'APPLIED',
    `Applied ${focus} ${width}px browser observation is incomplete.`);
  }
}

const entries = [];
async function walk(directory) {
  for (const name of (await readdir(directory)).sort()) {
    const path = join(directory, name);
    const info = await lstat(path);
    assert(!info.isSymbolicLink(), `Evidence must not contain symlinks: ${relative(evidenceDirectory, path)}`);
    if (info.isDirectory()) await walk(path);
    else if (path !== manifestPath) {
      const bytes = await readFile(path);
      entries.push({
        path: relative(evidenceDirectory, path).replaceAll('\\', '/'),
        byteSize: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
    }
  }
}
await walk(evidenceDirectory);
const expectedFiles = [
  'fixture-applied.json', 'fixture-pending.json', 'bundle-roundtrip.json',
  ...[1440, 1060].flatMap((width) => [
    `pending/proposal-review-${width}.png`,
    `pending/proposal-review-${width}.observation.json`,
    `pending/dom/proposal-review-${width}.html`,
    `applied/inventory-${width}.png`,
    `applied/inventory-${width}.observation.json`,
    `applied/dom/inventory-${width}.html`,
    `applied/proposal-${width}.png`,
    `applied/proposal-${width}.observation.json`,
    `applied/dom/proposal-${width}.html`,
  ]),
];
for (const path of expectedFiles) assert(entries.some((entry) => entry.path === path), `Missing 2C evidence file: ${path}`);
assert(entries.every(({ byteSize }) => byteSize > 0), 'Every 2C evidence file must be nonempty.');

const manifest = {
  schemaVersion: 1,
  checkpoint: '2C',
  status: 'CANDIDATE_NOT_USER_ACCEPTED',
  projectId: 'numberdroid-studio-checkpoint-2c',
  revision: 11,
  viewports: [{ width: 1440, height: 900 }, { width: 1060, height: 900 }],
  fileCount: entries.length,
  files: entries,
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
process.stdout.write(`${JSON.stringify({ status: 'VERIFIED', fileCount: entries.length, manifest: manifestPath })}\n`);
