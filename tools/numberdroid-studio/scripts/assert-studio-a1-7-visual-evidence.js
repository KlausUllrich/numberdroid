import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const evidenceDirectory = resolve(process.argv[2] ?? 'artifacts/studio-a1-7');
const fixturePath = join(evidenceDirectory, 'fixture.json');
const fixtureText = await readFile(fixturePath, 'utf8');
const fixture = JSON.parse(fixtureText);
const viewports = [[1440, 900], [1060, 900]];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function assertSafeEvidenceText(value, label) {
  assert(!/token|grantId|bindingId|digest|sha256|studio:\/\/artifacts|\/workspace|\/home\/runner|file:|[A-Za-z]:\\/i.test(value),
    `${label} exposes a forbidden authority, digest, CAS, or runner path.`);
}

assert(fixture.schemaVersion === 1
  && fixture.projectId === 'numberdroid-studio-a1-7'
  && fixture.revision === 2
  && fixture.taskId === 'task.a1-7.processed-asset-review'
  && fixture.taskState === 'ACTIVE'
  && fixture.review === null
  && fixture.branchRevision === 3
  && fixture.asset?.assetId === 'asset.a1-7.transfer-console'
  && fixture.asset.lifecycle === 'DRAFT'
  && fixture.asset.width === 64 && fixture.asset.height === 64
  && fixture.adoptionCount === 1
  && fixture.correctionCount === 8
  && fixture.warningCount === 1
  && fixture.status === 'implemented candidate — not user accepted',
'A1.7 fixture does not stop at the exact ACTIVE task / branch-local DRAFT boundary.');
assertSafeEvidenceText(fixtureText, 'A1.7 fixture JSON');

const screenshots = [];
const observations = [];
const domFiles = [];
for (const [width, height] of viewports) {
  const screenshotName = `a1-7-review-${width}.png`;
  const screenshotBytes = await readFile(join(evidenceDirectory, screenshotName));
  assert(screenshotBytes.length >= 8_000 && screenshotBytes.subarray(1, 4).toString('ascii') === 'PNG',
    `${screenshotName} is missing or is not a useful PNG.`);
  assert(screenshotBytes.readUInt32BE(16) === width && screenshotBytes.readUInt32BE(20) === height,
    `${screenshotName} has the wrong viewport dimensions.`);
  screenshots.push({ path: screenshotName, width, height, byteSize: screenshotBytes.length, sha256: sha256(screenshotBytes) });

  const observationName = `a1-7-review-${width}.observation.json`;
  const observationText = await readFile(join(evidenceDirectory, observationName), 'utf8');
  assertSafeEvidenceText(observationText, observationName);
  const observation = JSON.parse(observationText);
  const evidence = observation.a17Evidence;
  assert(observation.schemaVersion === 1 && observation.mode === 'a1-7'
    && observation.screenshotAfterReadinessInSameSession === true
    && observation.runtimeNetworkErrors === 0
    && observation.layout?.viewport?.width === width
    && observation.layout?.viewport?.height === height
    && observation.layout.horizontalOverflow === false
    && observation.layout.visualErrorCount === 0
    && evidence?.initial?.state === 'WAITING_FOR_YOUR_REVIEW'
    && evidence.initial.candidate === 'not-user-accepted'
    && evidence.initial.correctionCount === 8
    && evidence.initial.warningCount === 1
    && evidence.initial.mutationControlCount === 0
    && evidence.fallback.decodeFailure === true
    && evidence.fallback.previewState === 'UNAVAILABLE'
    && evidence.fallback.imageCount === 0
    && evidence.restoredReady === true
    && evidence.passiveRefresh.sameTaskNode === true
    && evidence.passiveRefresh.sameAdoptionNode === true
    && evidence.passiveRefresh.focusedSummary === true
    && evidence.passiveRefresh.selectedText === evidence.passiveRefresh.expectedSelectedText
    && evidence.passiveRefresh.scrollUnchanged === true
    && evidence.passiveRefresh.taskScrollUnchanged === true
    && evidence.passiveRefresh.taskScrollExercised === true
    && evidence.changedProjectionRefresh.hookChangedSection === true
    && evidence.changedProjectionRefresh.hookRestored === true
    && evidence.changedProjectionRefresh.taskNodeReplaced === true
    && evidence.changedProjectionRefresh.adoptionNodeReplaced === true
    && evidence.changedProjectionRefresh.focusedSummary === true
    && evidence.changedProjectionRefresh.selectedText === evidence.changedProjectionRefresh.expectedSelectedText
    && evidence.changedProjectionRefresh.scrollUnchanged === true
    && evidence.changedProjectionRefresh.taskScrollUnchanged === true
    && evidence.changedProjectionRefresh.taskScrollExercised === true
    && evidence.durableSnapshotUnchanged === true
    && evidence.accessibilityScope === 'processing-adoption'
    && evidence.final.horizontallyContained === true
    && evidence.final.selectedTaskState === 'ACTIVE'
    && evidence.final.genericTaskReviewSectionPresent === true
    && evidence.browserRequests.every(({ method, path }) => method === 'GET' && !path.startsWith('/internal/')),
  `${observationName} does not prove the exact, read-only, refresh-safe A1.7 browser state.`);
  observations.push({ path: observationName, sha256: sha256(Buffer.from(observationText)) });

  const domName = `a1-7-review-${width}.dom.json`;
  const domText = await readFile(join(evidenceDirectory, domName), 'utf8');
  const dom = JSON.parse(domText);
  assert(dom.schemaVersion === 1
    && dom.projectId === fixture.projectId
    && dom.taskContext === `${fixture.projectId}:${fixture.taskId}`
    && dom.state === 'WAITING_FOR_YOUR_REVIEW'
    && dom.candidate === 'not-user-accepted'
    && dom.sectionHtml.includes('Waiting for your review.')
    && dom.sectionHtml.includes('implemented candidate — not user accepted')
    && dom.sectionHtml.includes('This exact image is saved in this task only.')
    && !/<(?:button|form|input|select|textarea)\b|data-task-control=|href=/i.test(dom.sectionHtml)
    && !/token|grantId|bindingId|digest|sha256|studio:\/\/artifacts|\/workspace|\/home\/runner|file:|[A-Za-z]:\\/i.test(domText),
  `${domName} violates the bounded A1.7 DOM contract.`);
  domFiles.push({ path: domName, sha256: sha256(Buffer.from(domText)) });
}

const serverLog = await readFile(join(evidenceDirectory, 'server.log'));
assertSafeEvidenceText(serverLog.toString('utf8'), 'A1.7 server log');
const manifest = {
  schemaVersion: 1,
  milestone: 'A1.7-visual-review-candidate',
  status: 'implemented candidate — not user accepted',
  authorityBoundary: 'Waiting for your review; no owner review, merge, finalization, materialization, publication, or release authority.',
  candidateCommit: process.env.STUDIO_VISUAL_CANDIDATE_SHA ?? process.env.GITHUB_SHA ?? 'local-uncommitted',
  browser: process.env.STUDIO_VISUAL_BROWSER ?? 'Chrome/Chromium headless',
  node: process.version,
  fixture: {
    projectId: fixture.projectId,
    revision: fixture.revision,
    taskId: fixture.taskId,
    taskState: fixture.taskState,
    branchRevision: fixture.branchRevision,
    assetId: fixture.asset.assetId,
    lifecycle: fixture.asset.lifecycle,
    review: fixture.review,
  },
  assertions: {
    productionAuthoringV2DraftBoundary: true,
    exactPreviewAndDecodeFallback: true,
    eightCorrectionsAndWarning: true,
    noA17MutationControls: true,
    passiveRefreshPreservedContext: true,
    changedProjectionPreservedCompatibleContext: true,
    browserTransportGetOnly: true,
    durableProjectionUnchangedAcrossBrowser: true,
    noHorizontalOverflowAtProtectedWidths: true,
    runtimeNetworkErrors: 0,
    userAccepted: false,
  },
  screenshots,
  observations: observations.map(({ path }) => path),
  dom: domFiles.map(({ path }) => path),
};
const manifestPath = join(evidenceDirectory, 'manifest.json');
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const hashed = [
  { path: 'fixture.json', bytes: Buffer.from(fixtureText) },
  { path: 'server.log', bytes: serverLog },
  ...screenshots.map(({ path }) => ({ path })),
  ...observations.map(({ path }) => ({ path })),
  ...domFiles.map(({ path }) => ({ path })),
  { path: 'manifest.json' },
];
for (const file of hashed) {
  if (!file.bytes) file.bytes = await readFile(join(evidenceDirectory, file.path));
}
const sums = hashed.map(({ path, bytes }) => `${sha256(bytes)}  ${relative(evidenceDirectory, join(evidenceDirectory, path))}`).join('\n');
await writeFile(join(evidenceDirectory, 'SHA256SUMS'), `${sums}\n`);
process.stdout.write(`${JSON.stringify({ status: 'VERIFIED', screenshotCount: screenshots.length })}\n`);
