import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

// Kept outside Vitest's discovery pattern; this package uses Node's test runner.
import { StudioService } from '../packages/application/src/index.js';
import { InMemoryProjectStore } from '../packages/persistence/src/index.js';
import { createStudioHttpServer, startStudioHttpServer } from '../apps/studio-server/src/server.js';
import { assetPreviewProjection, jobHttpProjection } from '../apps/studio-server/src/http-projections.js';

async function humanMutationHeaders(base) {
  const session = await fetch(`${base}/api/ui-session`).then((response) => response.json());
  return {
    origin: base,
    'sec-fetch-site': 'same-origin',
    'x-numberdroid-studio-csrf': session.csrfToken,
  };
}

test('Checkpoint 1B refuses a non-loopback HTTP listener before opening workspace data', async () => {
  await assert.rejects(
    startStudioHttpServer({ host: '0.0.0.0', storeMode: 'json' }),
    (error) => error.code === 'LOOPBACK_HOST_REQUIRED',
  );
});

test('visual shell is clickable, creates the demo through commands, and exposes live activity', async (context) => {
  const studioService = new StudioService({ store: new InMemoryProjectStore() });
  const server = createStudioHttpServer({ studioService });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const page = await fetch(base).then((response) => response.text());
  assert.match(page, /Create \/ load demo/);
  assert.match(page, /Activity feed/);
  assert.match(page, /Agent access/);
  assert.match(page, /Propose in draft/);
  assert.match(page, /Effective agent policy/);
  assert.match(page, /DOM state grants nothing/);
  assert.match(page, /Show host setup/);
  assert.match(page, /authorize the waiting host/);
  const clientScript = await fetch(`${base}/app.js`).then((response) => response.text());
  assert.match(clientScript, /idempotent-retry/);
  assert.match(clientScript, /post-revoke-attempt/);
  assert.match(clientScript, /PROCESSING: 'Preview processing'/);
  assert.match(clientScript, /LOAD_FAILED: 'Preview failed'/);
  assert.match(clientScript, /window\.confirm/);
  assert.match(clientScript, /operations: \{ define: null, preview: null, commit: null, cancel: null, retry: null, discard: null \}/);
  assert.match(clientScript, /operations\.define \?\?=/);
  assert.match(clientScript, /operations\.preview \?\?=/);
  assert.match(clientScript, /operations\.commit \?\?=/);
  assert.match(clientScript, /operations\.discard \?\?=/);
  assert.match(clientScript, /data-discard-cutter-job/);
  assert.match(clientScript, /Commit or discard the current preview job/);
  assert.match(clientScript, /aria-live', 'polite/);
  assert.match(clientScript, /response\.projectId !== binding\.projectId \|\| response\.job\?\.atlasId !== binding\.atlasId/);
  assert.match(clientScript, /response\.job\?\.sourceId !== binding\.sourceId/);
  assert.match(clientScript, /currentAtlas\?\.latestPreviewJobId !== jobId/);
  assert.match(clientScript, /cutterButton\.disabled = state\.cutterPending/);
  assert.match(clientScript, /cutterScrollContext\(\)[\s\S]*state\.cutter\.projectId[\s\S]*state\.cutter\.sourceId[\s\S]*state\.cutter\.atlasId[\s\S]*state\.cutter\.instanceId[\s\S]*state\.cutter\.zoom/);
  const cutterScrollHelpers = clientScript.slice(
    clientScript.indexOf('function cutterScrollContext'), clientScript.indexOf('function openCutter'),
  );
  assert.match(cutterScrollHelpers, /left: scroller\.scrollLeft/);
  assert.match(cutterScrollHelpers, /top: scroller\.scrollTop/);
  assert.match(cutterScrollHelpers, /scroller\.scrollLeft = Math\.max\(0, Math\.min/);
  assert.match(cutterScrollHelpers, /scroller\.scrollTop = Math\.max\(0, Math\.min/);
  assert.doesNotMatch(cutterScrollHelpers, /window\.scrollTo/);
  assert.match(cutterScrollHelpers, /context !== cutterScrollContext\(\)/);
  assert.match(cutterScrollHelpers, /cutterScrollResetPending/);
  assert.match(cutterScrollHelpers, /captureCutterDomDraft/);
  assert.match(cutterScrollHelpers, /restoreCutterDomDraft/);
  assert.match(cutterScrollHelpers, /cutter\.dataset\.cutterModelFingerprint !== cutterModelFingerprint\(\)/);
  assert.match(cutterScrollHelpers, /active\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(clientScript, /section\.dataset\.cutterModelFingerprint = cutterModelFingerprint\(\)/);
  assert.match(clientScript, /if \(cutterDrag\) \{[\s\S]*state\.cutterDeferredRender = true;[\s\S]*return;/);
  assert.match(clientScript, /geometryChanged && !cutterDrag\.changed[\s\S]*markCutterDefinitionDirty\(\)/);
  assert.match(clientScript, /!cutterDrag\.svg\.isConnected \|\| !cutterDrag\.target\.isConnected/);
  assert.match(clientScript, /addEventListener\('pointercancel', settleCutterDrag\)/);
  assert.match(clientScript, /addEventListener\('lostpointercapture', settleCutterDrag\)/);
  assert.match(clientScript, /if \(visualFixture\) \{[\s\S]*forceChangedCutterProjectionRender/);
  assert.match(clientScript, /changed: cutterDrag\?\.changed \?\? false/);
  assert.match(clientScript, /targetConnected: cutterDrag\?\.target\?\.isConnected \?\? false/);
  assert.match(clientScript, /hasPointerCapture: Boolean\(cutterDrag\?\.target\?\.hasPointerCapture\?\.\(cutterDrag\.pointerId\)\)/);
  assert.match(clientScript, /scroller\.dataset\.cutterScrollContext = cutterScrollContext\(\)/);
  const workspaceRenderStart = clientScript.indexOf('function renderWorkspace');
  const workspaceRender = clientScript.slice(
    workspaceRenderStart, clientScript.indexOf('function renderActivity()', workspaceRenderStart),
  );
  const captureScroll = workspaceRender.indexOf('captureCutterScroll();');
  const captureDraft = workspaceRender.indexOf('captureCutterDomDraft();');
  const replaceWorkspace = workspaceRender.indexOf("elements['workspace-content'].replaceChildren(content);");
  const restoreScroll = workspaceRender.indexOf('restoreCutterScroll();');
  const restoreDraft = workspaceRender.indexOf('restoreCutterDomDraft();');
  assert.ok(captureScroll >= 0 && captureDraft > captureScroll && replaceWorkspace > captureDraft
    && restoreScroll > replaceWorkspace && restoreDraft > restoreScroll,
  'Cutter scroll/draft must be captured before atomic DOM replacement and restored only after the compatible cutter is attached.');
  assert.doesNotMatch(workspaceRender, /replaceChildren\(\);[\s\S]*append\(content\)/);
  assert.match(workspaceRender, /if \(preserveCutterDraft\) captureCutterDomDraft\(\);[\s\S]*else state\.cutterDomDraft = null/);
  assert.match(workspaceRender, /if \(preserveCutterDraft\) restoreCutterDomDraft\(\)/);
  assert.match(clientScript, /function openCutter\(source\)[\s\S]*resetCutterScroll\(\);[\s\S]*state\.cutter = \{/);
  assert.match(clientScript, /projectId: state\.project\.projectId[\s\S]*instanceId: crypto\.randomUUID\(\)/);
  assert.match(clientScript, /data-close-cutter[\s\S]*resetCutterScroll\(\);[\s\S]*state\.cutter = null/);
  assert.match(clientScript, /state\.project\.projectId !== projectId\)[\s\S]*resetCutterScroll\(\)/);
  assert.match(clientScript, /state\.cutter\.projectId !== projectId[\s\S]*state\.cutter = null/);
  assert.match(clientScript, /if \(!sourceExists\) \{[\s\S]*resetCutterScroll\(\);[\s\S]*state\.cutter = null/);
  assert.match(clientScript, /atlas\.id === state\.cutter\.atlasId && atlas\.sourceId === state\.cutter\.sourceId/);
  assert.match(clientScript, /let cutterJobPollController = \{[\s\S]*timer: null,[\s\S]*inFlight: null,[\s\S]*abortController: null/);
  assert.match(clientScript, /cutterJobPollController\.abortController\?\.abort\(\)/);
  assert.match(clientScript, /if \(!cutterJobPollController\.inFlight\)/);
  assert.match(clientScript, /\{ signal: abortController\.signal \}/);
  assert.match(clientScript, /error\.name !== 'AbortError' && retryableCurrentJob/);
  assert.match(clientScript, /else cancelCutterJobPolling\(\)/);
  assert.match(clientScript, /const priorRenderFingerprint = JSON\.stringify\([\s\S]*const nextRenderFingerprint = JSON\.stringify\([\s\S]*priorRenderFingerprint !== nextRenderFingerprint\)[\s\S]*renderWorkspace\(\{ preserveCutterDraft: true \}\)/);
  const cutterPollHelpersStart = clientScript.indexOf('function cancelCutterJobPolling');
  const cutterPollHelpers = clientScript.slice(
    cutterPollHelpersStart, clientScript.indexOf('function invalidateCutterOperations', cutterPollHelpersStart),
  );
  assert.match(cutterPollHelpers, /if \(cutterJobPollController\.timer !== null\) clearTimeout\(cutterJobPollController\.timer\)/);
  assert.match(cutterPollHelpers, /cutterJobPollController\.context !== binding\.context[\s\S]*!cutterBindingIsCurrent\(binding\)/);
  assert.match(cutterPollHelpers, /response\.projectId !== binding\.projectId[\s\S]*response\.job\?\.atlasId !== binding\.atlasId[\s\S]*response\.job\?\.sourceId !== binding\.sourceId[\s\S]*response\.job\?\.jobId !== jobId[\s\S]*cancelCutterJobPolling\(\)/);
  assert.match(cutterPollHelpers, /currentAtlas\?\.sourceId !== binding\.sourceId[\s\S]*currentAtlas\?\.latestPreviewJobId !== jobId/);
  assert.match(cutterPollHelpers, /!state\.cutterJob \|\| \(state\.cutterJob\.jobId === jobId[\s\S]*scheduleCutterJobPoll\(binding, 1000\)/);
  assert.match(cutterPollHelpers, /\['QUEUED', 'RUNNING'\]\.includes\(response\.job\.state\)[\s\S]*scheduleCutterJobPoll\(binding, 300\)[\s\S]*else cancelCutterJobPolling\(\)/);
  assert.match(clientScript, /preserveWorkspaceIfUnchanged: passive/);
  assert.match(clientScript, /renderProject\(\{ preserveWorkspace, preserveCutterDraft: preserveWorkspaceIfUnchanged \}\)/);
  assert.match(clientScript, /setInterval\(\(\) => refresh\(\{ quiet: true, passive: true \}\), 5000\)/);
  assert.match(clientScript, /previousWorkspaceFingerprint === workspaceRenderFingerprint\(\)/);
  const loadProjectStart = clientScript.indexOf('async function loadProject');
  const loadProjectBody = clientScript.slice(
    loadProjectStart, clientScript.indexOf('async function requestAgentAccess', loadProjectStart),
  );
  assert.match(loadProjectBody, /state\.cutter\?\.projectId && state\.cutter\.projectId !== projectId[\s\S]*cancelCutterJobPolling\(\)[\s\S]*state\.cutter = null/);
  assert.match(loadProjectBody, /candidate\.id === state\.cutter\.atlasId && candidate\.sourceId === state\.cutter\.sourceId/);
  assert.match(clientScript, /let sourceIntakeFormCache = null/);
  assert.match(clientScript, /selectedSourceFile\?\.files\?\.length > 0/);
  assert.match(clientScript, /sourceFileChooserActive/);
  assert.match(clientScript, /Selected .* Ready to import/);
  assert.match(clientScript, /sourceId\.pattern = '\[A-Za-z0-9\]\[A-Za-z0-9\._:\\\\-\]\{0,127\}'/);
  const sourceIdPattern = new RegExp('^(?:[A-Za-z0-9][A-Za-z0-9._:\\-]{0,127})$', 'v');
  for (const accepted of ['a', 'source.family_hygiene:floor-01', `a${'z'.repeat(127)}`]) {
    assert.equal(sourceIdPattern.test(accepted), true, `Expected source ID ${accepted} to satisfy the browser pattern.`);
  }
  for (const rejected of ['', '-source', 'source/path', 'source id', `a${'z'.repeat(128)}`]) {
    assert.equal(sourceIdPattern.test(rejected), false, `Expected source ID ${rejected} to fail the browser pattern.`);
  }
  assert.match(clientScript, /resetSourceIntakeForm\(\)/);
  assert.match(clientScript, /Resume staged intake .* selected file .* current import form will be cleared/s);
  assert.match(clientScript, /if \(file\) file\.value = ''/);
  assert.match(clientScript, /elements\['project-select'\]\.value !== state\.project\.projectId/);
  assert.match(clientScript, /const operationProjectId = state\.project\.projectId/);
  assert.match(clientScript, /const operationRevision = state\.project\.revision/);
  assert.match(clientScript, /const operationCsrf = state\.agentAccessCsrf/);
  assert.match(clientScript, /sourceOperationKey\('source-intake-upload', 'pending', operationProjectId\)/);
  assert.match(clientScript, /const commitIdempotencyTarget = stagedIntake\?\.intakeId \?\? 'pending'/);
  assert.match(clientScript, /'source-intake-commit', commitIdempotencyTarget, operationProjectId/);
  assert.match(clientScript, /state\.project\?\.projectId === operationProjectId[\s\S]*state\.project\.revision === operationRevision[\s\S]*state\.agentAccessCsrf === operationCsrf/);
  assert.match(clientScript, /intake\?\.schemaVersion !== 1 \|\| intake\.projectId !== operationProjectId/);
  assert.match(clientScript, /expectedRevision: operationRevision/);
  assert.match(clientScript, /committed\?\.schemaVersion !== 1 \|\| committed\.projectId !== operationProjectId[\s\S]*committed\.revision !== operationRevision \+ 1/);
  assert.match(clientScript, /let durableIntakeReady = Boolean\(stagedIntake\)/);
  assert.match(clientScript, /resetSourceIntakeForm\(\);[\s\S]*renderWorkspace\(\);[\s\S]*remains staged; retry commits this exact artifact or discard it/);
  const sourceFailureRecovery = clientScript.slice(
    clientScript.indexOf('const needsStagedRecovery'), clientScript.indexOf('} finally {', clientScript.indexOf('const needsStagedRecovery')),
  );
  assert.doesNotMatch(sourceFailureRecovery, /resetSourceIntakeForm\(\);\s*renderWorkspace\(\)/);
  assert.match(sourceFailureRecovery, /const projectReloaded =[\s\S]*await loadProject\(operationProjectId\)/);
  assert.match(sourceFailureRecovery, /needsStagedRecovery && !projectReloaded/);
  const sourcePendingHelper = clientScript.slice(
    clientScript.indexOf('function setSourceIntakeFormPending'), clientScript.indexOf('function sourceOperationKey'),
  );
  assert.match(sourcePendingHelper, /querySelectorAll\('input, select, textarea, button'\)/);
  assert.match(sourcePendingHelper, /control\.disabled = true/);
  assert.doesNotMatch(sourcePendingHelper, /form\.inert/);
  const browserEvidenceScript = await readFile(
    new URL('../scripts/capture-studio-browser-evidence.js', import.meta.url), 'utf8',
  );
  assert.match(browserEvidenceScript, /allFormControlsDisabled/);
  assert.match(browserEvidenceScript, /sourceIdPatternValidity/);
  assert.match(browserEvidenceScript, /input\.value = 'source\.family_hygiene:floor-01'/);
  assert.match(browserEvidenceScript, /input\.value = 'source\/path'/);
  assert.match(browserEvidenceScript, /input\.checkValidity\(\)/);
  assert.match(browserEvidenceScript, /input\.validity\.patternMismatch/);
  assert.match(browserEvidenceScript, /sourceIdPatternValidity\?\.pattern === '\[A-Za-z0-9\]\[A-Za-z0-9\._:\\\\-\]\{0,127\}'/);
  assert.match(browserEvidenceScript, /restoredValue === sourceIdPatternValidity\.priorValue/);
  assert.match(browserEvidenceScript, /let checkpoint2aSourceFocusBeforeLayout = null/);
  assert.match(browserEvidenceScript, /let checkpoint2aSourceFocusFinal = null/);
  assert.match(browserEvidenceScript, /focus === 'staged-intake'[\s\S]*focus === 'approved-source'[\s\S]*data-source-intake-form/);
  assert.match(
    browserEvidenceScript,
    /focus === 'approved-source'[\s\S]*document\.querySelector\('\[data-source-id="source\.family-hygiene-approved"\] \.source-preview-frame'\)/,
  );
  assert.match(browserEvidenceScript, /target\.scrollIntoView\(\{ block: 'center', inline: 'nearest' \}\)/);
  assert.match(browserEvidenceScript, /visible: rect\.x >= 0 && rect\.y >= 0[\s\S]*rect\.right <= innerWidth && rect\.bottom <= innerHeight/);
  assert.doesNotMatch(
    browserEvidenceScript,
    /document\.querySelector\('\[data-source-id="source\.family-hygiene-approved"\] \.source-preview\.ready'\)\?\.scrollIntoView/,
  );
  const syntheticProbeSettled = browserEvidenceScript.indexOf('sourceImportSyntheticEventRange = {');
  const beforeLayoutFocus = browserEvidenceScript.indexOf(
    "checkpoint2aSourceFocusBeforeLayout = await focusCheckpoint2aSourceTarget('before-layout')", syntheticProbeSettled,
  );
  const layoutCapture = browserEvidenceScript.indexOf('const evaluated = await devtools.send', beforeLayoutFocus);
  const keyboardSecurityEnd = browserEvidenceScript.indexOf("Target.closeTarget", layoutCapture);
  const finalFocus = browserEvidenceScript.indexOf(
    "checkpoint2aSourceFocusFinal = await focusCheckpoint2aSourceTarget('before-screenshot')", keyboardSecurityEnd,
  );
  const finalProtocolBound = browserEvidenceScript.indexOf('assertSyntheticProtocolErrorsBounded();', finalFocus);
  const finalProtocolCheck = browserEvidenceScript.indexOf("assertNoProtocolErrors('Before screenshot capture')", finalProtocolBound);
  const screenshotCapture = browserEvidenceScript.indexOf("devtools.send('Page.captureScreenshot'", finalProtocolCheck);
  assert.ok(syntheticProbeSettled > 0 && beforeLayoutFocus > syntheticProbeSettled
    && layoutCapture > beforeLayoutFocus && keyboardSecurityEnd > layoutCapture
    && finalFocus > keyboardSecurityEnd && finalProtocolBound > finalFocus
    && finalProtocolCheck > finalProtocolBound && screenshotCapture > finalProtocolCheck,
  'Checkpoint 2A source focus and strict protocol checks must run after keyboard security checks immediately before capture.');
  assert.match(browserEvidenceScript, /checkpoint2aSourceFocusFinal,\n/);
  assert.match(browserEvidenceScript, /selectedProjectWhilePending/);
  assert.match(browserEvidenceScript, /expectedRevision === sourceImportOperationIsolation\.operationRevision/);
  assert.match(browserEvidenceScript, /mismatch\.commitCount === 0/);
  assert.match(browserEvidenceScript, /commitFailureRecovery\.oldFileCount === 0/);
  assert.match(browserEvidenceScript, /commitFailureRecovery\.currentFileDisabled === true/);
  assert.match(browserEvidenceScript, /liveStatusOutsideInert === true/);
  assert.match(browserEvidenceScript, /sourceImportSyntheticEventRange = \{/);
  const syntheticProtocolFilter = browserEvidenceScript.slice(
    browserEvidenceScript.indexOf('const isExpectedSyntheticSourceImportError'),
    browserEvidenceScript.indexOf('const allProtocolErrors'),
  );
  assert.match(syntheticProtocolFilter, /index < range\.start \|\| index >= range\.end/);
  assert.match(syntheticProtocolFilter, /range\.projectId !== 'numberdroid-studio-checkpoint-2a'/);
  assert.match(syntheticProtocolFilter, /operationRevision !== 4/);
  assert.match(syntheticProtocolFilter, /revisionLabelAfter !== 'Revision 4'/);
  assert.match(syntheticProtocolFilter, /FAMILY_HYGIENE_DIGEST/);
  assert.match(syntheticProtocolFilter, /parsed\.href !== fixtureArtifactUrl/);
  assert.match(syntheticProtocolFilter, /event\.params\?\.type === 'Image'/);
  assert.match(syntheticProtocolFilter, /event\.params\?\.errorText === 'net::ERR_ABORTED'/);
  assert.match(syntheticProtocolFilter, /event\.method === 'Log\.entryAdded'/);
  assert.match(syntheticProtocolFilter, /ERR_ABORTED/);
  assert.doesNotMatch(
    syntheticProtocolFilter,
    /Runtime\.exceptionThrown|Runtime\.consoleAPICalled|Network\.responseReceived/,
  );
  assert.match(browserEvidenceScript, /networkAborts\.length <= 1 && pairedLogs\.length <= 1/);
  assert.match(browserEvidenceScript, /expectedSyntheticRuntimeNetworkErrorSummaries/);
  assert.match(browserEvidenceScript, /unexpected\.map\(protocolErrorSummary\)\.join/);
  assert.match(browserEvidenceScript, /beforeScroller\.scrollLeft = Math\.min\(321/);
  assert.match(browserEvidenceScript, /beforeScroller\.scrollTop = Math\.min\(417/);
  assert.match(browserEvidenceScript, /beforeField\.value = '5'/);
  assert.match(browserEvidenceScript, /refreshButton\.click\(\)/);
  assert.match(browserEvidenceScript, /observations\.length === 2/);
  assert.match(browserEvidenceScript, /observation\.sameScroller === true/);
  assert.match(browserEvidenceScript, /observation\.sameField === true && observation\.focused === true/);
  assert.match(browserEvidenceScript, /observation\.left === scrollRefresh\.result\.value\.before\.left/);
  assert.match(browserEvidenceScript, /observation\.top === scrollRefresh\.result\.value\.before\.top/);
  assert.match(browserEvidenceScript, /observation\.windowLeft === scrollRefresh\.result\.value\.before\.windowLeft/);
  assert.match(browserEvidenceScript, /beforeField\.closest\('form'\)\.requestSubmit\(\)/);
  assert.match(browserEvidenceScript, /firstRectangle\.y === '5'/);
  assert.match(browserEvidenceScript, /firstRectangle\.height === '621'/);
  assert.match(browserEvidenceScript, /committedGridDraft\.result\.value\.scrollerReplaced === true/);
  assert.match(browserEvidenceScript, /scrollPreservation: scrollRefresh\.result\.value/);
  assert.match(browserEvidenceScript, /committedGridDraft: committedGridDraft\.result\.value/);
  assert.match(browserEvidenceScript, /forceChangedCutterProjectionRender/);
  assert.match(browserEvidenceScript, /document\.elementFromPoint\(point\.x, point\.y\)/);
  assert.match(browserEvidenceScript, /dragSetup\.result\.value\.hitTarget === true/);
  const dragPressed = browserEvidenceScript.indexOf('dragPressed = await');
  const dragMoved = browserEvidenceScript.indexOf('dragMoved = await');
  const duringDrag = browserEvidenceScript.indexOf('duringDrag = await');
  assert.ok(dragPressed >= 0 && dragMoved > dragPressed && duringDrag > dragMoved,
    'Browser evidence must establish and move the captured drag before forcing an external projection.');
  assert.match(browserEvidenceScript, /dragPressed\.result\?\.value\?\.observed === true[\s\S]*dragPressed\.result\.value\.interaction\?\.dragActive === true/);
  assert.match(browserEvidenceScript, /dragMoved\.result\?\.value\?\.observed === true[\s\S]*dragMoved\.result\.value\.interaction\?\.dragActive === true/);
  assert.match(browserEvidenceScript, /for \(let frame = 0; frame < 30; frame \+= 1\)/);
  assert.match(browserEvidenceScript, /interaction\.hasPointerCapture === true/);
  assert.match(browserEvidenceScript, /interaction\.changed === true/);
  assert.match(browserEvidenceScript, /pressed: dragPressed\.result\?\.value, moved: dragMoved\.result\?\.value/);
  assert.match(browserEvidenceScript, /forced\?\.dragActive === true/);
  assert.match(browserEvidenceScript, /forced\.deferred === true/);
  assert.match(browserEvidenceScript, /oldTargetConnected === false/);
  assert.match(browserEvidenceScript, /afterDrag\.result\.value\.inspectorX === afterDrag\.result\.value\.x/);
  assert.match(browserEvidenceScript, /afterDrag\.result\.value\.inspectorY === afterDrag\.result\.value\.y/);
  assert.match(browserEvidenceScript, /dragContinuity: \{[\s\S]*pressed: dragPressed\.result\.value,[\s\S]*moved: dragMoved\.result\.value,[\s\S]*during: duringDrag\.result\.value/);
  assert.match(browserEvidenceScript, /afterDrag = await[\s\S]*for \(let frame = 0; frame < 30; frame \+= 1\)[\s\S]*oldTargetConnected === false[\s\S]*inspectorX === x[\s\S]*if \(observation\.observed\) return observation/);
  assert.match(browserEvidenceScript, /afterDrag\.result\?\.value\?\.observed === true/);
  assert.match(browserEvidenceScript, /finally \{[\s\S]*if \(mousePressed\)[\s\S]*type: 'mouseReleased'/);
  assert.match(browserEvidenceScript, /scrollLeft === 0 && restoredFit\.result\.value\.scrollTop === 0/);
  assert.match(browserEvidenceScript, /document\.querySelector\('\[data-cutter-move="0"\]'\)\?\.closest\('g'\)/);
  assert.doesNotMatch(browserEvidenceScript, /data-rectangle-id="rect\.family\.0\.0"/);
  assert.match(browserEvidenceScript, /closeReopenReset/);
  assert.match(browserEvidenceScript, /after\.context !== closeReopenReset\.result\.value\.before\.context/);
  assert.match(browserEvidenceScript, /after\.left === 0/);
  assert.match(browserEvidenceScript, /after\.top === 0/);
  assert.match(clientScript, /response\?\.projectId !== operationProjectId/);
  assert.match(clientScript, /response\.job\?\.jobId !== operationJobId/);
  assert.match(clientScript, /response\.job\?\.sourceId !== operationCutter\.sourceId/);
  assert.match(clientScript, /mutationAtlas\?\.sourceId !== operationCutter\.sourceId/);
  assert.match(clientScript, /mutationAtlas\?\.latestPreviewJobId !== operationJobId/);
  assert.match(clientScript, /state\.cutterJob = response\.job/);
  assert.match(clientScript, /state\.cutterJobEvents = response\.events \?\? \[\]/);
  assert.match(clientScript, /state\.cutterJobEvents\.at\(-1\)\?\.state !== state\.cutterJob\?\.state/);
  assert.match(clientScript, /body: JSON\.stringify\(operation\)/);
  assert.match(clientScript, /Publish is never included/);
  assert.match(clientScript, /Command budget/);
  assert.match(clientScript, /MCP host authorized/);
  assert.match(clientScript, /dataset\.renderFingerprint/);
  assert.match(clientScript, /Close' : 'Open/);
  const sourcePreviewRenderer = clientScript.slice(
    clientScript.indexOf('function sourcePreview'), clientScript.indexOf('function card'),
  );
  assert.match(sourcePreviewRenderer, /link\.target = '_blank'/);
  assert.match(sourcePreviewRenderer, /link\.rel = 'noopener noreferrer'/);
  assert.match(sourcePreviewRenderer, /link\.referrerPolicy = 'no-referrer'/);
  assert.match(sourcePreviewRenderer, /Open .* original source image in a new tab/);
  assert.match(sourcePreviewRenderer, /caption\.textContent = 'Open original in new tab ↗'/);
  assert.match(sourcePreviewRenderer, /link\.setAttribute\('aria-describedby', caption\.id\)/);
  const overviewRenderer = clientScript.slice(
    clientScript.indexOf('function renderOverview'), clientScript.indexOf('function renderCollection'),
  );
  const collectionRenderer = clientScript.slice(
    clientScript.indexOf('function renderCollection'), clientScript.indexOf('function renderActivityWorkspace'),
  );
  assert.doesNotMatch(overviewRenderer, /workspace === 'assets'/);
  assert.match(collectionRenderer, /workspace === 'assets'.*asset-grid/s);
  assert.doesNotMatch(clientScript, /localStorage/);
  assert.doesNotMatch(clientScript, /NUMBERDROID_STUDIO_BINDING_TOKEN/);
  const styles = await fetch(`${base}/styles.css`).then((response) => response.text());
  assert.match(styles, /\.asset-preview/);
  assert.match(styles, /aspect-ratio: 1/);
  assert.match(styles, /object-fit: contain/);
  assert.match(styles, /\.source-preview-frame \{ width: min\(100%, 220px\)/);
  assert.match(styles, /\.source-preview \{[^}]*display: flex[^}]*align-items: center[^}]*justify-content: center[^}]*max-width: 220px[^}]*min-width: 0[^}]*min-height: 0[^}]*aspect-ratio: 1[^}]*padding: 6px[^}]*overflow: visible/);
  assert.match(styles, /\.source-preview img \{[^}]*width: auto[^}]*height: auto[^}]*min-width: 0[^}]*min-height: 0[^}]*max-width: 100%[^}]*max-height: 100%[^}]*object-fit: contain[^}]*object-position: center/);
  assert.match(styles, /\.source-preview-frame figcaption/);
  assert.match(styles, /@media \(max-width: 1200px\)/);
  assert.match(styles, /\.agent-access-input select \{ width: 150px/);

  const blindDemo = await fetch(`${base}/api/demo`, { method: 'POST' });
  assert.equal(blindDemo.status, 403);
  assert.equal((await blindDemo.json()).error.code, 'UI_ORIGIN_REQUIRED');
  const humanHeaders = await humanMutationHeaders(base);
  const demoResponse = await fetch(`${base}/api/demo`, { method: 'POST', headers: humanHeaders });
  assert.equal(demoResponse.status, 200);
  const demo = await demoResponse.json();
  assert.equal(demo.revision, 5);
  assert.equal(demo.schemaVersion, 1);
  assert.equal(demo.snapshot.project.status, 'in_review');
  assert.equal(demo.snapshot.assets[0].kind, 'surface');
  assert.equal(demo.snapshot.assets[0].properties.role, 'floor');

  const projectedProject = await fetch(`${base}/api/projects/${demo.projectId}`).then((response) => response.json());
  assert.deepEqual(projectedProject.snapshot.assets[0].preview, {
    schemaVersion: 1,
    state: 'PROCESSING',
    resourceUri: null,
    kind: 'surface',
    alt: 'surface preview: processing',
  });

  const accessResponse = await fetch(`${base}/api/projects/${demo.projectId}/agent-access`);
  assert.equal(accessResponse.status, 200);
  const access = await accessResponse.json();
  assert.equal(access.effectivePolicy.state, 'ACTIVE_EXECUTE');
  assert.equal(access.effectivePolicy.mode, 'execute_scoped');
  assert.equal(access.effectivePolicy.selectionCreatesAuthority, false);
  assert.equal(access.effectivePolicy.branchId, 'branch.demo-atlas');
  assert.equal(access.effectivePolicy.budget.status, 'ENFORCED');
  assert.equal(access.effectivePolicy.budget.remaining.commands, 97);
  assert.deepEqual(access.effectivePolicy.objectScopes, [{ kind: 'project', id: demo.projectId }]);
  assert.deepEqual(access.effectivePolicy.options.map(({ value }) => value), [
    'off', 'read_only', 'propose_draft', 'execute_scoped', 'custom',
  ]);
  assert.equal(typeof access.csrfToken, 'string');
  assert.equal(access.hostBindingSupport, 'SQLITE_REQUIRED');
  assert.deepEqual(access.hostBindings, []);

  const missingOrigin = await fetch(`${base}/api/projects/${demo.projectId}/agent-access`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-numberdroid-studio-csrf': access.csrfToken },
    body: JSON.stringify({ mode: 'execute_scoped' }),
  });
  assert.equal(missingOrigin.status, 403);
  assert.equal((await missingOrigin.json()).error.code, 'UI_ORIGIN_REQUIRED');

  const missingCsrf = await fetch(`${base}/api/projects/${demo.projectId}/agent-access`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base, 'sec-fetch-site': 'same-origin' },
    body: JSON.stringify({ mode: 'execute_scoped' }),
  });
  assert.equal(missingCsrf.status, 403);
  assert.equal((await missingCsrf.json()).error.code, 'CSRF_INVALID');

  const crossOrigin = await fetch(`${base}/api/projects/${demo.projectId}/agent-access`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: `http://localhost:${port}`,
      'sec-fetch-site': 'cross-site',
      'x-numberdroid-studio-csrf': access.csrfToken,
    },
    body: JSON.stringify({ mode: 'execute_scoped' }),
  });
  assert.equal(crossOrigin.status, 403);
  assert.equal((await crossOrigin.json()).error.code, 'UI_ORIGIN_FORBIDDEN');

  const beforeAccessSelection = await studioService.readProjectTrusted(demo.projectId);
  const publishSpoof = await fetch(`${base}/api/projects/${demo.projectId}/agent-access`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: base,
      'sec-fetch-site': 'same-origin',
      'x-numberdroid-studio-csrf': access.csrfToken,
    },
    body: JSON.stringify({ mode: 'publish', confirmBroaderAccess: true, idempotencyKey: 'ui.spoof.publish' }),
  });
  assert.equal(publishSpoof.status, 400);
  assert.equal((await publishSpoof.json()).error.code, 'UNKNOWN_AGENT_ACCESS_MODE');

  const scopeSpoof = await fetch(`${base}/api/projects/${demo.projectId}/agent-access`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: base,
      'sec-fetch-site': 'same-origin',
      'x-numberdroid-studio-csrf': access.csrfToken,
    },
    body: JSON.stringify({
      mode: 'execute_scoped',
      confirmBroaderAccess: true,
      idempotencyKey: 'ui.spoof.scopes',
      scopes: ['publish'],
    }),
  });
  assert.equal(scopeSpoof.status, 400);
  assert.equal((await scopeSpoof.json()).error.code, 'VALIDATION_ERROR');
  const afterAccessSelection = await studioService.readProjectTrusted(demo.projectId);
  assert.deepEqual(afterAccessSelection, beforeAccessSelection);

  const custom = await fetch(`${base}/api/projects/${demo.projectId}/agent-access`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: base,
      'sec-fetch-site': 'same-origin',
      'x-numberdroid-studio-csrf': access.csrfToken,
    },
    body: JSON.stringify({ mode: 'custom' }),
  }).then((response) => response.json());
  assert.equal(custom.effectivePolicy.customEditorRequired, true);
  assert.equal(custom.effectivePolicy.selectionCreatesAuthority, false);

  const activity = await fetch(`${base}/api/projects/${demo.projectId}/activity`).then((response) => response.json());
  assert.equal(activity.events.length, 5);
  assert.ok(activity.events.some((event) => event.actor.kind === 'agent' && event.taskId));

  const retryResponse = await fetch(`${base}/api/demo/action?action=idempotent-retry`, { method: 'POST', headers: humanHeaders });
  assert.equal(retryResponse.status, 200);
  const retry = await retryResponse.json();
  assert.equal(retry.replayed, true);
  assert.equal(retry.revision, 3);
  assert.equal((await studioService.readProjectTrusted(demo.projectId)).revision, 5);

  const staleResponse = await fetch(`${base}/api/demo/action?action=stale-write`, { method: 'POST', headers: humanHeaders });
  assert.equal(staleResponse.status, 409);
  assert.equal((await staleResponse.json()).error.code, 'REVISION_CONFLICT');
  assert.equal((await studioService.readProjectTrusted(demo.projectId)).revision, 5);

  const revokeResponse = await fetch(`${base}/api/demo/action?action=revoke-grant`, { method: 'POST', headers: humanHeaders });
  assert.equal(revokeResponse.status, 200);
  const revoke = await revokeResponse.json();
  assert.equal(revoke.revision, 6);

  const deniedResponse = await fetch(`${base}/api/demo/action?action=post-revoke-attempt`, { method: 'POST', headers: humanHeaders });
  assert.equal(deniedResponse.status, 403);
  assert.equal((await deniedResponse.json()).error.code, 'GRANT_REVOKED');
  const finalProject = await studioService.readProjectTrusted(demo.projectId);
  assert.equal(finalProject.revision, 6);
  assert.equal(finalProject.snapshot.sources.length, 1);
  assert.ok(finalProject.snapshot.grants[0].revokedAt);
  assert.equal((await studioService.listActivityTrusted(demo.projectId)).length, 6);
  const revokedAccess = await fetch(`${base}/api/projects/${demo.projectId}/agent-access`).then((response) => response.json());
  assert.equal(revokedAccess.effectivePolicy.state, 'REVOKED');
  assert.equal(revokedAccess.effectivePolicy.mode, 'off');

  const spoofedCommand = await fetch(`${base}/api/commands`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actor: { id: 'forged', kind: 'human' } }),
  });
  assert.equal(spoofedCommand.status, 404);

  const forbiddenMethod = await fetch(`${base}/api/commands`, { method: 'DELETE' });
  assert.equal(forbiddenMethod.status, 405);
});

test('cutter job polling has one owner and rejects transient, stale, aborted, terminal, and misbound races', async () => {
  const clientScript = await readFile(new URL('../apps/studio-server/public/app.js', import.meta.url), 'utf8');
  const pollSourceStart = clientScript.indexOf('function currentCutterAtlas');
  const pollSourceEnd = clientScript.indexOf('function invalidateCutterOperations', pollSourceStart);
  assert.ok(pollSourceStart >= 0 && pollSourceEnd > pollSourceStart, 'Cutter poll source was not found.');

  const timers = new Map();
  let nextTimerId = 1;
  const fakeSetTimeout = (callback, delay) => {
    const timerId = nextTimerId++;
    timers.set(timerId, { callback, delay });
    return timerId;
  };
  const fakeClearTimeout = (timerId) => timers.delete(timerId);
  const runTimer = async (delay) => {
    const entry = [...timers.entries()].find(([, timer]) => timer.delay === delay);
    assert.ok(entry, `Expected one ${delay}ms cutter poll timer.`);
    timers.delete(entry[0]);
    entry[1].callback();
    await new Promise((resolve) => setImmediate(resolve));
  };
  const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    return { promise, resolve, reject };
  };
  const response = (stateName, { sourceId = 'source.one' } = {}) => ({
    projectId: 'project.one',
    job: {
      jobId: 'job.one', atlasId: 'atlas.one', sourceId, state: stateName,
      attempt: 1, cancelRequested: false, progress: { current: stateName === 'APPLIED' ? 4 : 0, total: 4 },
    },
    events: [],
  });
  const coalesced = deferred();
  const aborted = deferred();
  const stale = deferred();
  const superseded = deferred();
  const requestSignals = [];
  let requestCount = 0;
  const api = async (_path, options) => {
    requestCount += 1;
    requestSignals.push(options.signal);
    if (requestCount === 1) throw new TypeError('synthetic transient read failure');
    if (requestCount === 2) return response('QUEUED');
    if (requestCount === 3) return coalesced.promise;
    if (requestCount === 4) {
      options.signal.addEventListener('abort', () => {
        aborted.reject(new DOMException('The operation was aborted.', 'AbortError'));
      }, { once: true });
      return aborted.promise;
    }
    if (requestCount === 5) return stale.promise;
    if (requestCount === 6) return response('APPLIED');
    if (requestCount === 7) return response('QUEUED', { sourceId: 'source.wrong' });
    if (requestCount === 8) return superseded.promise;
    throw new Error(`Unexpected cutter poll request ${requestCount}.`);
  };
  const state = {
    project: {
      projectId: 'project.one',
      snapshot: { atlases: [{ id: 'atlas.one', sourceId: 'source.one', latestPreviewJobId: 'job.one' }] },
    },
    cutter: {
      projectId: 'project.one', sourceId: 'source.one', atlasId: 'atlas.one', instanceId: 'instance.one',
      zoom: '2', operations: { preview: null, commit: null, cancel: null, retry: null, discard: null },
    },
    cutterJob: null,
    cutterJobEvents: [],
  };
  const toasts = [];
  let renderCount = 0;
  const sandbox = {
    state,
    elements: { 'workspace-content': { querySelector: () => null } },
    api,
    showToast: (message) => toasts.push(message),
    renderWorkspace: () => { renderCount += 1; },
    setTimeout: fakeSetTimeout,
    clearTimeout: fakeClearTimeout,
    AbortController,
    DOMException,
    JSON,
    structuredClone,
  };
  runInNewContext(`
    let cutterJobPollController = {
      generation: 0, context: null, timer: null, inFlight: null, abortController: null,
    };
    ${clientScript.slice(pollSourceStart, pollSourceEnd)}
    globalThis.pollHarness = {
      loadCutterJob,
      cancelCutterJobPolling,
      snapshot: () => ({
        generation: cutterJobPollController.generation,
        context: cutterJobPollController.context,
        hasTimer: cutterJobPollController.timer !== null,
        hasInFlight: cutterJobPollController.inFlight !== null,
      }),
    };
  `, sandbox);
  const { pollHarness } = sandbox;

  assert.equal(await pollHarness.loadCutterJob('job.one'), false);
  assert.equal(requestCount, 1);
  assert.deepEqual([...timers.values()].map(({ delay }) => delay), [1000]);
  assert.equal(toasts.length, 1);
  await runTimer(1000);
  assert.equal(requestCount, 2);
  assert.equal(state.cutterJob.state, 'QUEUED');
  assert.deepEqual([...timers.values()].map(({ delay }) => delay), [300]);

  const firstCoalescedRead = pollHarness.loadCutterJob('job.one');
  const secondCoalescedRead = pollHarness.loadCutterJob('job.one');
  assert.equal(requestCount, 3, 'Two callers must share the one in-flight poll request.');
  assert.equal(timers.size, 0, 'Starting the coalesced request must consume the sole pending timer.');
  const renderCountBeforeUnchangedPoll = renderCount;
  coalesced.resolve(response('QUEUED'));
  assert.equal(await firstCoalescedRead, true);
  assert.equal(await secondCoalescedRead, true);
  assert.equal(renderCount, renderCountBeforeUnchangedPoll, 'An unchanged job projection must not rebuild the cutter.');
  assert.deepEqual([...timers.values()].map(({ delay }) => delay), [300]);

  const toastCountBeforeAbort = toasts.length;
  await runTimer(300);
  assert.equal(requestCount, 4);
  pollHarness.cancelCutterJobPolling();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requestSignals[3].aborted, true);
  assert.equal(toasts.length, toastCountBeforeAbort, 'AbortError must not surface as a user error.');
  const afterAbort = pollHarness.snapshot();
  assert.equal(afterAbort.context, null);
  assert.equal(afterAbort.hasTimer, false);
  assert.equal(afterAbort.hasInFlight, false);

  state.cutter.instanceId = 'instance.stale';
  state.cutterJob = null;
  const staleRead = pollHarness.loadCutterJob('job.one');
  assert.equal(requestCount, 5);
  pollHarness.cancelCutterJobPolling();
  assert.equal(requestSignals[4].aborted, true);
  state.cutter.instanceId = 'instance.current';
  const currentRead = pollHarness.loadCutterJob('job.one');
  assert.equal(requestCount, 6);
  assert.equal(await currentRead, true);
  assert.equal(state.cutterJob.state, 'APPLIED');
  const terminalRenderCount = renderCount;
  stale.resolve(response('RUNNING'));
  assert.equal(await staleRead, false);
  assert.equal(state.cutterJob.state, 'APPLIED', 'A delayed response from the closed cutter must not replace current state.');
  assert.equal(renderCount, terminalRenderCount, 'A delayed stale response must not render the reopened cutter.');
  assert.equal(timers.size, 0, 'A terminal response must stop polling.');
  assert.equal(pollHarness.snapshot().context, null);

  state.cutter.instanceId = 'instance.misbound';
  state.cutterJob = null;
  assert.equal(await pollHarness.loadCutterJob('job.one'), false);
  assert.equal(requestCount, 7);
  assert.equal(state.cutterJob, null, 'A source-misbound job response must not enter cutter state.');
  assert.equal(pollHarness.snapshot().context, null, 'An identity mismatch must cancel the current poll owner.');
  assert.equal(timers.size, 0);

  state.cutter.instanceId = 'instance.superseded';
  const supersededRead = pollHarness.loadCutterJob('job.one');
  assert.equal(requestCount, 8);
  state.project.snapshot.atlases[0].latestPreviewJobId = 'job.newer';
  superseded.resolve(response('QUEUED'));
  assert.equal(await supersededRead, false);
  assert.equal(state.cutterJob, null, 'A superseded atlas job must not enter cutter state.');
  assert.equal(pollHarness.snapshot().context, null, 'A latest-job mismatch must cancel the current poll owner.');
  assert.equal(timers.size, 0);
});

test('human Agent access presets rotate immutable grants with confirmation and idempotent retry', async (context) => {
  const studioService = new StudioService({ store: new InMemoryProjectStore() });
  const server = createStudioHttpServer({ studioService });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  const humanHeaders = await humanMutationHeaders(base);
  const demo = await fetch(`${base}/api/demo`, { method: 'POST', headers: humanHeaders }).then((response) => response.json());
  const initialAccess = await fetch(`${base}/api/projects/${demo.projectId}/agent-access`).then((response) => response.json());
  assert.deepEqual(initialAccess.effectivePolicy.presets.read_only.scopes, ['project.read']);
  assert.ok(!initialAccess.effectivePolicy.presets.execute_scoped.scopes.some((scope) => scope.includes('publish')));
  assert.equal(initialAccess.effectivePolicy.presets.execute_scoped.branchId, 'branch.demo-atlas');
  assert.equal(initialAccess.effectivePolicy.presets.execute_scoped.budget.maxCommands, 100);
  const headers = {
    'content-type': 'application/json',
    origin: base,
    'sec-fetch-site': 'same-origin',
    'x-numberdroid-studio-csrf': initialAccess.csrfToken,
  };
  const change = (body) => fetch(`${base}/api/projects/${demo.projectId}/agent-access`, {
    method: 'POST', headers, body: JSON.stringify(body),
  });

  const proposalResponse = await change({ mode: 'propose_draft', idempotencyKey: 'access.proposal' });
  assert.equal(proposalResponse.status, 200);
  const proposal = await proposalResponse.json();
  assert.equal(proposal.changed, false);
  assert.equal(proposal.effectivePolicy.draftWorkspaceRequired, true);
  assert.equal(proposal.effectivePolicy.warnings.at(-1).code, 'DRAFT_BRANCH_NOT_AVAILABLE_1B');
  let project = await studioService.readProjectTrusted(demo.projectId);
  assert.equal(project.revision, 5);

  const readOnlyResponse = await change({
    mode: 'read_only', confirmBroaderAccess: true, idempotencyKey: 'access.read-only',
  });
  assert.equal(readOnlyResponse.status, 200);
  const readOnlyInitial = await readOnlyResponse.json();
  assert.equal(readOnlyInitial.effectivePolicy.state, 'ACTIVE_READ_ONLY');
  project = await studioService.readProjectTrusted(demo.projectId);
  assert.equal((await studioService.readProjectTrusted(demo.projectId)).revision, 7);
  let active = project.snapshot.grants.find((grant) => !grant.revokedAt);
  assert.deepEqual(active.scopes, ['project.read']);
  assert.equal(active.branchId, 'branch.demo-atlas');

  const replay = await change({ mode: 'read_only', idempotencyKey: 'access.read-only' }).then((response) => response.json());
  assert.equal(replay.idempotentReplay, true);
  assert.equal((await studioService.readProjectTrusted(demo.projectId)).revision, 7);

  const reusedKey = await change({ mode: 'execute_scoped', idempotencyKey: 'access.read-only' });
  assert.equal(reusedKey.status, 409);
  assert.equal((await reusedKey.json()).error.code, 'IDEMPOTENCY_CONFLICT');
  assert.equal((await studioService.readProjectTrusted(demo.projectId)).revision, 7);

  const unconfirmed = await change({ mode: 'execute_scoped', idempotencyKey: 'access.execute' });
  assert.equal(unconfirmed.status, 409);
  const confirmationError = await unconfirmed.json();
  assert.equal(confirmationError.error.code, 'BROADER_ACCESS_CONFIRMATION_REQUIRED');
  assert.equal(confirmationError.error.details.publishIncluded, false);
  assert.ok(!confirmationError.error.details.scopes.some((scope) => scope.includes('publish')));
  assert.equal((await studioService.readProjectTrusted(demo.projectId)).revision, 7);

  const executed = await change({
    mode: 'execute_scoped', confirmBroaderAccess: true, idempotencyKey: 'access.execute',
  }).then((response) => response.json());
  assert.equal(executed.effectivePolicy.state, 'ACTIVE_EXECUTE');
  project = await studioService.readProjectTrusted(demo.projectId);
  assert.equal(project.revision, 9);
  assert.equal(project.snapshot.grants.length, 3);
  active = project.snapshot.grants.find((grant) => !grant.revokedAt);
  assert.ok(active.scopes.includes('project.status.write'));
  assert.ok(!active.scopes.some((scope) => scope.includes('publish')));
  assert.equal(active.budget.maxCommands, 100);

  const turnedOff = await change({ mode: 'off', idempotencyKey: 'access.off' }).then((response) => response.json());
  assert.equal(turnedOff.changed, true);
  assert.equal(turnedOff.effectivePolicy.mode, 'off');
  project = await studioService.readProjectTrusted(demo.projectId);
  assert.equal(project.revision, 10);
  assert.equal(project.snapshot.grants.filter((grant) => !grant.revokedAt).length, 0);

  const offReplay = await change({ mode: 'off', idempotencyKey: 'access.off' }).then((response) => response.json());
  assert.equal(offReplay.idempotentReplay, true);
  assert.equal((await studioService.readProjectTrusted(demo.projectId)).revision, 10);

  const readWithoutConfirmation = await change({ mode: 'read_only', idempotencyKey: 'access.read' });
  assert.equal(readWithoutConfirmation.status, 409);
  assert.equal((await readWithoutConfirmation.json()).error.code, 'BROADER_ACCESS_CONFIRMATION_REQUIRED');
  const readOnly = await change({
    mode: 'read_only', confirmBroaderAccess: true, idempotencyKey: 'access.read',
  }).then((response) => response.json());
  assert.equal(readOnly.effectivePolicy.state, 'ACTIVE_READ_ONLY');
  project = await studioService.readProjectTrusted(demo.projectId);
  assert.equal(project.revision, 11);
  active = project.snapshot.grants.find((grant) => !grant.revokedAt);
  assert.deepEqual(active.scopes, ['project.read']);

  const beforeCustom = structuredClone(project);
  const custom = await change({ mode: 'custom' }).then((response) => response.json());
  assert.equal(custom.changed, false);
  assert.equal(custom.effectivePolicy.customEditorRequired, true);
  assert.deepEqual(await studioService.readProjectTrusted(demo.projectId), beforeCustom);
});

test('asset preview projection always yields a same-origin preview or a distinct accessible fallback', () => {
  const asset = { id: 'asset.preview', name: 'Preview tile', kind: 'surface', region: { x: 0, y: 0, width: 16, height: 16 } };
  assert.equal(assetPreviewProjection(asset, null).state, 'MISSING');
  assert.equal(assetPreviewProjection(asset, { artifactUri: 'studio://artifact', mediaType: 'image/svg+xml' }).state, 'UNSUPPORTED');
  assert.equal(assetPreviewProjection(asset, { artifactUri: 'studio://artifact', mediaType: 'image/png' }).state, 'PROCESSING');
  assert.equal(assetPreviewProjection({ ...asset, preview: { state: 'READY', resourceUri: 'https://evil.example/asset.png' } }, {}).state, 'LOAD_FAILED');
  assert.equal(assetPreviewProjection(asset, {
    artifactUri: `studio://artifacts/sha256/${'a'.repeat(64)}`,
    mediaType: 'image/png', width: 32, height: 32,
  }, { projectId: 'project.preview' }).state, 'PROCESSING');
  assert.deepEqual(assetPreviewProjection({
    ...asset,
    preview: {
      state: 'READY',
      resourceUri: `/api/projects/project.preview/artifacts/sha256/${'b'.repeat(64)}`,
      alt: 'Clean tile preview',
    },
  }, {}), {
    schemaVersion: 1,
    state: 'READY',
    resourceUri: `/api/projects/project.preview/artifacts/sha256/${'b'.repeat(64)}`,
    kind: 'surface',
    alt: 'Clean tile preview',
  });
});

test('job output projection yields only project-scoped same-origin preview resources', () => {
  const digest = 'c'.repeat(64);
  const projected = jobHttpProjection({
    schemaVersion: 1,
    projectId: 'project.preview',
    job: {
      jobId: 'job.preview',
      state: 'SUCCEEDED',
      outputs: [{
        rectangleId: 'rect.preview', digest, mediaType: 'image/png',
        byteSize: 4, width: 1, height: 1,
      }],
    },
  });
  assert.deepEqual(projected.job.outputs[0].preview, {
    schemaVersion: 1,
    state: 'READY',
    resourceUri: `/api/projects/project.preview/artifacts/sha256/${digest}`,
    alt: 'Atlas preview rect.preview',
  });
  assert.equal(jobHttpProjection({
    schemaVersion: 1,
    projectId: 'project.preview',
    job: { state: 'SUCCEEDED', outputs: [{ rectangleId: 'rect.bad', digest: 'not-a-digest', mediaType: 'image/png' }] },
  }).job.outputs[0].preview.resourceUri, null);
  assert.deepEqual(jobHttpProjection({
    schemaVersion: 1,
    projectId: 'project.preview',
    job: { state: 'DISCARDED', outputs: [{ rectangleId: 'rect.old', digest, mediaType: 'image/png' }] },
  }).job.outputs[0].preview, {
    schemaVersion: 1,
    state: 'MISSING',
    resourceUri: null,
    alt: 'Atlas preview rect.old',
  });
});
