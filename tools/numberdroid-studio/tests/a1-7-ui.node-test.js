import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  normalizeProcessingAdoptionProjection,
  processingAdoptionPresentation,
  processingAdoptionPreviewPath,
  processingAdoptionSelectionOwned,
  unavailableProcessingAdoptionProjection,
} from '../apps/studio-server/public/a1-7-state.js';
import { startStudioHttpServer } from '../apps/studio-server/src/server.js';

const PROJECT_ID = 'project.a1-7';
const TASK_ID = 'task.a1-7';

function adoption({
  branchRevision = 2,
  committedAt = '2026-08-29T10:00:00.000Z',
  previewState = 'READY',
  corrections = [{ label: 'Asset role', explanation: 'A role is required.', remediation: 'Choose the semantic role.' }],
  warnings = [{ explanation: 'Review the crop.', remediation: 'Inspect the exact pixels.' }],
} = {}) {
  return {
    branchRevision,
    committedAt,
    operation: 'create',
    displayState: 'WAITING_FOR_YOUR_REVIEW',
    asset: {
      assetId: 'asset.a1-7',
      name: 'Processed DRAFT',
      kind: 'prop',
      lifecycle: 'DRAFT',
      assetVersion: 1,
      metadataVersion: 1,
      pixelSize: { width: 64, height: 48 },
      preview: {
        state: previewState,
        resourceUri: previewState === 'READY'
          ? `/api/projects/${encodeURIComponent(PROJECT_ID)}/tasks/${encodeURIComponent(TASK_ID)}/processing-result-adoptions/${branchRevision}/selected-output`
          : null,
        mediaType: 'image/png',
        width: 64,
        height: 48,
        alt: 'Processed DRAFT processed asset preview',
      },
    },
    quality: { correctionRequired: corrections.length > 0, correctionItems: corrections, unresolvedWarnings: warnings },
  };
}

function projection(adoptions = []) {
  return { schemaVersion: 1, projectId: PROJECT_ID, taskId: TASK_ID, availability: 'AVAILABLE', adoptions };
}

function attempt({ status, id = `attempt.${status}`, occurredAt = '2026-08-29T11:00:00.000Z', taskId = TASK_ID, commandType = 'asset.processing-result.adopt', projectId = PROJECT_ID, actor = { kind: 'agent', id: 'agent.a1-7' } }) {
  return { id, projectId, taskId, commandType, status, occurredAt, actor };
}

test('A1.7 state precedence distinguishes unavailable, empty, attributable attempts, and durable DRAFTs', () => {
  const unavailable = processingAdoptionPresentation({
    projection: unavailableProcessingAdoptionProjection(PROJECT_ID, TASK_ID), activity: [], projectId: PROJECT_ID, taskId: TASK_ID,
  });
  assert.equal(unavailable.state, 'PROJECTION_UNAVAILABLE');
  assert.equal(processingAdoptionPresentation({ projection: projection(), activity: [], projectId: PROJECT_ID, taskId: TASK_ID }).state, 'NO_DRAFT');

  const ignored = [
    attempt({ status: 'denied', projectId: 'project.other' }),
    attempt({ status: 'failed', taskId: 'task.other' }),
    attempt({ status: 'denied', commandType: 'authoring-v2.surface.negotiate' }),
    attempt({ status: 'authorized' }),
    attempt({ status: 'denied', actor: { kind: 'human', id: 'owner.a1-7' } }),
    attempt({ status: 'denied', occurredAt: 'not-an-instant' }),
  ];
  assert.equal(processingAdoptionPresentation({ projection: projection(), activity: [...ignored, attempt({ status: 'denied' })], projectId: PROJECT_ID, taskId: TASK_ID }).state, 'ATTEMPT_DENIED');
  assert.equal(processingAdoptionPresentation({ projection: projection(), activity: [...ignored, attempt({ status: 'failed' })], projectId: PROJECT_ID, taskId: TASK_ID }).state, 'ATTEMPT_FAILED');
  assert.equal(processingAdoptionPresentation({ projection: projection(), activity: {}, projectId: PROJECT_ID, taskId: TASK_ID }).state, 'NO_DRAFT');
  assert.equal(processingAdoptionPresentation({
    projection: projection(),
    activity: [attempt({ status: 'denied', occurredAt: '2026-08-29T10:30:00.000Z' }), attempt({ status: 'failed', occurredAt: '2026-08-29T11:30:00.000Z' })],
    projectId: PROJECT_ID,
    taskId: TASK_ID,
  }).state, 'ATTEMPT_FAILED');

  const older = adoption({ branchRevision: 2, committedAt: '2026-08-29T09:00:00.000Z', corrections: [], warnings: [] });
  const saved = adoption({ branchRevision: 3 });
  const durable = processingAdoptionPresentation({
    projection: projection([older, saved]),
    activity: [
      attempt({ status: 'denied', occurredAt: '2026-08-29T09:30:00.000Z' }),
      attempt({ status: 'failed', occurredAt: '2026-08-29T12:00:00.000Z' }),
    ],
    projectId: PROJECT_ID,
    taskId: TASK_ID,
  });
  assert.equal(durable.state, 'WAITING_FOR_YOUR_REVIEW');
  assert.equal(durable.adoption, saved);
  assert.equal(durable.laterAttempt.status, 'failed');
  assert.deepEqual(durable.substates, ['CORRECTION_REQUIRED', 'WARNINGS_UNRESOLVED']);
  assert.deepEqual(processingAdoptionPresentation({
    projection: projection([adoption({ previewState: 'UNAVAILABLE', corrections: [], warnings: [] })]),
    activity: [], projectId: PROJECT_ID, taskId: TASK_ID,
  }).substates, ['PREVIEW_UNAVAILABLE']);
});

test('A1.7 projection and preview validation fail closed on mismatches, disorder, query, fragment, or fallback URLs', () => {
  const exact = adoption();
  assert.equal(processingAdoptionPreviewPath(exact, PROJECT_ID, TASK_ID), exact.asset.preview.resourceUri);
  for (const resourceUri of [
    'https://example.test/selected-output',
    `${exact.asset.preview.resourceUri}?digest=secret`,
    `${exact.asset.preview.resourceUri}#crop`,
    `/api/projects/other/tasks/${TASK_ID}/processing-result-adoptions/2/selected-output`,
    `/api/projects/${PROJECT_ID}/tasks/task.other/processing-result-adoptions/2/selected-output`,
    `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}/processing-result-adoptions/3/selected-output`,
    `/api/projects/${PROJECT_ID}/artifacts/sha256/${'a'.repeat(64)}`,
  ]) {
    const changed = structuredClone(exact); changed.asset.preview.resourceUri = resourceUri;
    assert.equal(processingAdoptionPreviewPath(changed, PROJECT_ID, TASK_ID), null);
    assert.equal(normalizeProcessingAdoptionProjection(projection([changed]), PROJECT_ID, TASK_ID).availability, 'UNAVAILABLE');
  }
  const unordered = projection([adoption({ branchRevision: 3 }), adoption({ branchRevision: 2 })]);
  assert.equal(normalizeProcessingAdoptionProjection(unordered, PROJECT_ID, TASK_ID).availability, 'UNAVAILABLE');
  const contradictoryQuality = adoption(); contradictoryQuality.quality.correctionRequired = false;
  assert.equal(normalizeProcessingAdoptionProjection(projection([contradictoryQuality]), PROJECT_ID, TASK_ID).availability, 'UNAVAILABLE');
  const missingAlt = adoption(); missingAlt.asset.preview.alt = '   ';
  assert.equal(normalizeProcessingAdoptionProjection(projection([missingAlt]), PROJECT_ID, TASK_ID).availability, 'UNAVAILABLE');
  assert.equal(normalizeProcessingAdoptionProjection(projection([adoption({ committedAt: '2026-08-29T10:00:00Z' })]), PROJECT_ID, TASK_ID).availability, 'UNAVAILABLE');
  assert.equal(normalizeProcessingAdoptionProjection({ ...projection(), taskId: 'task.other' }, PROJECT_ID, TASK_ID).availability, 'UNAVAILABLE');
  assert.equal(normalizeProcessingAdoptionProjection(projection(), PROJECT_ID, TASK_ID).availability, 'AVAILABLE');
});

test('A1.7 render remains after Current step, before task facts, and contains no new action control', async () => {
  const app = await readFile(new URL('../apps/studio-server/public/app.js', import.meta.url), 'utf8');
  const renderer = app.slice(app.indexOf('function renderProcessingAdoption'), app.indexOf('function taskMergeBlockedReason'));
  const taskDetail = app.slice(app.indexOf('function renderTaskDetail'), app.indexOf('function renderTasks'));
  assert.match(taskDetail, /detail\.append\(workflow\);\s*if \(reviewHasConflict\) detail\.append\(renderTaskReview\(selected\)\);\s*if \(taskMayLoadProcessingAdoption\(selected\)\) detail\.append\(renderProcessingAdoption\(selected\)\);\s*const factsSection/);
  assert.match(app.slice(app.indexOf('function taskMayLoadProcessingAdoption'), app.indexOf('async function loadSelectedTaskAdoption')), /capabilities\?\.includes\('asset\.processing-result\.adopt'\)/);
  assert.match(renderer, /Processed asset draft/);
  assert.match(renderer, /Waiting for your review\./);
  assert.match(renderer, /implemented candidate — not user accepted/);
  assert.match(renderer, /This exact image is saved in this task only\. It is not part of Main or the project Asset Library\./);
  assert.match(app.slice(app.indexOf('function processingGuidanceList'), app.indexOf('function processingPreviewFallback')), /document\.createElement\('ul'\)/);
  assert.match(renderer, /processingGuidanceList/);
  assert.match(renderer, /document\.createElement\('dl'\)/);
  assert.match(renderer, /document\.createElement\('details'\)/);
  assert.doesNotMatch(renderer, /createElement\('(button|form|input|select|textarea|a)'\)/);
  assert.doesNotMatch(renderer, /dataset\.taskControl/);
  assert.doesNotMatch(app.slice(app.indexOf('function renderTaskComposer'), app.indexOf('function renderTaskReview')), /asset\.processing-result\.adopt/);
});

test('A1.7 passive refresh fingerprints bounded attempts and preserves compatible DOM context at protected widths', async () => {
  const app = await readFile(new URL('../apps/studio-server/public/app.js', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../apps/studio-server/public/styles.css', import.meta.url), 'utf8');
  const fingerprint = app.slice(app.indexOf('function workspaceRenderFingerprint'), app.indexOf('function renderWorkspace'));
  assert.match(fingerprint, /tasks: \['overview', 'tasks'\]\.includes\(state\.workspace\) \? state\.tasks : null/);
  assert.match(fingerprint, /processingAdoptionPresentation/);
  assert.doesNotMatch(fingerprint, /taskDomState/);
  assert.match(app, /function captureTaskDomState/);
  assert.match(app, /function restoreTaskDomState/);
  assert.match(app, /captureTaskTextSelection/);
  assert.match(app, /restoreTaskTextSelection/);
  assert.match(app, /range\.cloneContents\(\)\.textContent\.length/);
  assert.match(app, /function textPositionCandidates/);
  assert.match(app, /const starts = textPositionCandidates\(container, saved\.start\)\.reverse\(\)/);
  assert.match(app, /if \(range\.toString\(\) !== saved\.text\) continue/);
  assert.match(app, /function taskScrollElements[\s\S]*root\.matches\('\[data-task-scroll\]'\)/);
  assert.match(app, /for \(const element of taskScrollElements\(root\)\)/);
  assert.match(app, /reviewContext: review\?\.dataset\.taskReviewContext/);
  assert.match(app, /if \(preserveTaskContext\) captureTaskDomState\(\)/);
  assert.match(app, /if \(preserveTaskContext\) restoreTaskDomState\(\)/);
  const taskRestore = app.slice(app.indexOf('function restoreTaskDomState'), app.indexOf('function settleRoomEditorControlFocus'));
  assert.ok(taskRestore.indexOf('restoreTaskTextSelection') < taskRestore.indexOf('taskScrollElements(root)'));
  assert.match(app, /function requestTaskAdoptionProjection[\s\S]*AbortController[\s\S]*5_000/);
  assert.match(app, /requestTaskAdoptionProjection\(projectId, selectedTaskId\)/);
  const openTaskDetail = app.slice(
    app.indexOf('async function openTaskDetailWithAdoption'),
    app.indexOf('async function sha256Hex'),
  );
  assert.ok(
    openTaskDetail.indexOf('await requestTaskAdoptionProjection')
      < openTaskDetail.indexOf("state.taskUi.view = 'detail'"),
    'task selection must remain on the prior list/composer until its adoption read resolves',
  );
  assert.match(openTaskDetail, /cancelTaskAdoptionLoad\(\{ channel: 'passive' \}\)/);
  assert.match(openTaskDetail, /requestTaskAdoptionProjection\(projectId, taskId, \{ channel: 'selection' \}\)/);
  assert.match(openTaskDetail, /state\.workspace !== 'tasks'/);
  assert.match(app, /await openTaskDetailWithAdoption\(result\.task\.taskId\)/);
  assert.match(app, /await openTaskDetailWithAdoption\(control\.dataset\.taskId\)/);
  assert.match(app, /state\.workspace === 'tasks' && link\.dataset\.workspace !== 'tasks'[\s\S]{0,160}cancelTaskAdoptionLoad\(\{ channel: 'selection' \}\)/);
  assert.match(app, /state\.workspace === 'tasks' && nextWorkspace !== 'tasks'[\s\S]{0,160}cancelTaskAdoptionLoad\(\{ channel: 'selection' \}\)/);
  assert.match(app, /cancelTaskAdoptionLoad\(\{ channel: 'passive' \}\);\s*const generation = \+\+projectLoadGeneration/);
  assert.doesNotMatch(app, /!selectionOwned && state\.workspace === 'tasks'/);
  assert.match(app, /cancelTaskAdoptionLoad\(\{ clearState: true \}\)/);
  assert.doesNotMatch(app, /taskDetails[\s\S]{0,900}processing-result-adoptions/);
  assert.equal(processingAdoptionSelectionOwned(
    { generation: 4, projectId: PROJECT_ID, taskId: TASK_ID },
    { generation: 4, projectId: PROJECT_ID, taskId: TASK_ID },
  ), true);
  assert.equal(processingAdoptionSelectionOwned(
    { generation: 4, projectId: PROJECT_ID, taskId: 'task.a' },
    { generation: 5, projectId: PROJECT_ID, taskId: 'task.b' },
  ), false);
  assert.equal(processingAdoptionSelectionOwned(
    { generation: 4, projectId: PROJECT_ID, taskId: TASK_ID },
    { generation: 5, projectId: PROJECT_ID, taskId: TASK_ID },
  ), false);
  assert.match(app, /const selectionOwned = processingAdoptionSelectionOwned\(taskSelectionOwner/);
  assert.match(app, /if \(selectionOwned\) \{\s*state\.taskAdoption = selectedAdoption/);
  assert.match(app, /state\.activity = Array\.isArray\(activity\?\.events\) \? activity\.events : \[\]/);
  assert.match(styles, /\.processed-asset-layout \{[^}]*grid-template-columns: minmax\(150px, 220px\) minmax\(0, 1fr\)/);
  assert.match(styles, /@media \(max-width: 1200px\)[\s\S]*\.processed-asset-layout \{ grid-template-columns: 1fr; \}/);
  assert.match(styles, /\.processed-asset-preview-stage \{ margin: 0; \}/);
  assert.match(styles, /\.asset-preview img \{[^}]*object-fit: contain/);
});

test('A1.7 module and evidence wiring are same-origin, real-fixture, two-viewport, and candidate-only', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-a1-7-static-'));
  let running = null;
  context.after(async () => {
    if (running) {
      await new Promise((resolveClose, rejectClose) => {
        running.server.close((error) => (error ? rejectClose(error) : resolveClose()));
      });
    }
    await rm(directory, { recursive: true, force: true });
  });
  running = await startStudioHttpServer({ dataDirectory: directory, port: 0 });
  const base = `http://127.0.0.1:${running.address.port}`;
  const response = await fetch(`${base}/a1-7-state.js`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/javascript/);
  assert.equal(response.headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.match(await response.text(), /processingAdoptionPresentation/);

  const capture = await readFile(new URL('../scripts/capture-studio-browser-evidence.js', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../apps/studio-server/public/styles.css', import.meta.url), 'utf8');
  const prepare = await readFile(new URL('../scripts/prepare-visual-a1-7-evidence.js', import.meta.url), 'utf8');
  const evidenceAssert = await readFile(new URL('../scripts/assert-studio-a1-7-visual-evidence.js', import.meta.url), 'utf8');
  const workflow = await readFile(new URL('../../../.github/workflows/build.yml', import.meta.url), 'utf8');
  assert.match(capture, /checkpoint-4-5\|a1-7/);
  assert.match(capture, /rerenderA17Candidate/);
  assert.match(capture, /exerciseA17ChangedProjectionRetention/);
  assert.match(capture, /firstImage\.src = 'data:image\/png;base64,AAECAw=='/);
  assert.doesNotMatch(capture, /createObjectURL\(new Blob/);
  assert.doesNotMatch(capture, /firstImage\.dispatchEvent\(new Event\('error'\)\)/);
  assert.match(capture, /durableSnapshotUnchanged/);
  assert.match(capture, /accessibilityScope = axRoot \? 'processing-adoption'/);
  assert.match(capture, /sameAdoptionNode/);
  assert.match(capture, /Accessibility\.getFullAXTree/);
  assert.match(capture, /const taskDetailDeadline = Date\.now\(\) \+ 6_000;[\s\S]{0,220}\.task-detail \[data-task-state\]/);
  assert.match(styles, /html\[data-visual-task-scroll-probe="true"\] \.task-detail \{ max-height: 420px; overflow: auto; \}/);
  assert.match(prepare, /internal\/mcp\/authoring-v2\/processing-result-adopt/);
  assert.match(prepare, /task\.task\.state !== 'ACTIVE' \|\| task\.review !== null/);
  assert.doesNotMatch(prepare, /agentTaskService\.(submitReview|decideReview|mergeReview)|\/submit-review|\/reviews\/|\/publish|\/release/);
  assert.match(evidenceAssert, /\[\[1440, 900\], \[1060, 900\]\]/);
  assert.match(evidenceAssert, /implemented candidate — not user accepted/);
  assert.match(evidenceAssert, /userAccepted: false/);
  assert.match(evidenceAssert, /durableProjectionUnchangedAcrossBrowser: true/);
  assert.match(workflow, /timeout 120s node tools\/numberdroid-studio\/scripts\/prepare-visual-a1-7-evidence\.js/);
  assert.match(workflow, /timeout 180s node tools\/numberdroid-studio\/scripts\/capture-studio-browser-evidence\.js/);
  assert.match(workflow, /timeout 60s node tools\/numberdroid-studio\/scripts\/assert-studio-a1-7-visual-evidence\.js/);
});
