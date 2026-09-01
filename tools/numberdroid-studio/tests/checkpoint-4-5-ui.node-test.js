import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const appUrl = new URL('../apps/studio-server/public/app.js', import.meta.url);
const stylesUrl = new URL('../apps/studio-server/public/styles.css', import.meta.url);

test('CP4.5 tasks are list-first with one focused create/detail flow and plain next-action truth', async () => {
  const app = await readFile(appUrl, 'utf8');
  assert.match(app, /taskUi: \{\s*view: 'list',\s*selectedTaskId: null,?\s*\}/);
  assert.match(app, /function renderTaskList/);
  assert.match(app, /function renderTaskComposer/);
  assert.match(app, /function renderTaskDetail/);
  assert.match(app, /Who acts next/);
  assert.match(app, /What happens/);
  assert.match(app, /Technical details/);
  assert.match(app, /End task without adding changes/);
  assert.match(app, /entry\.task\.effectiveState \?\? entry\.task\.state/);
  assert.match(app, /presentation\.state === 'PAUSED'/);
  assert.match(app, /presentation\.state === 'CHANGES_REQUESTED'/);
  const effectiveState = app.slice(app.indexOf('function taskEffectiveState'), app.indexOf('function taskWorkflowPresentation'));
  assert.doesNotMatch(effectiveState, /Date\.now/);
});

test('Task overview exposes persisted conflicts and owner actions without inventing merge authority', async () => {
  const app = await readFile(appUrl, 'utf8');
  const styles = await readFile(stylesUrl, 'utf8');
  const attention = app.slice(app.indexOf('function taskAttentionPresentation'), app.indexOf('function processingAttemptCopy'));
  assert.match(attention, /entry\.review\?\.conflicts/);
  assert.match(attention, /taskEffectiveState\(entry\)/);
  assert.match(attention, /kind: 'CONFLICT'/);
  assert.match(attention, /Recorded conflict — action required/);
  assert.match(attention, /saved review comparison at project r/);
  assert.match(attention, /Main is always checked again before any merge/);
  for (const state of ['IN_REVIEW', 'PAUSED', 'CHANGES_REQUESTED', 'EXPIRED']) assert.match(attention, new RegExp(state));
  assert.doesNotMatch(attention, /MERGED:|REVERTED:|AUTO_ACCEPT/);
  assert.match(app, /button\.dataset\.taskAttention = attention\?\.kind \?\? 'NONE'/);
  assert.match(app, /Tasks needing you/);
  assert.match(app, /Task conflicts/);
  assert.match(app, /tasks: \['overview', 'tasks'\]\.includes\(state\.workspace\) \? state\.tasks : null/);
  assert.match(styles, /\.status-pill\[data-task-state="IN_REVIEW"\] \{[^}]*var\(--amber\)/);
  assert.match(styles, /\.task-list-item\[data-task-attention="CONFLICT"\] \{[^}]*repeating-linear-gradient/);
  assert.match(styles, /\.task-list-attention strong \{[^}]*font-size: 10px/);
});

test('CP4.5 passive refresh preserves the focused task composer and its live DOM draft', async () => {
  const app = await readFile(appUrl, 'utf8');
  const reconciliation = app.slice(
    app.indexOf('function reconcileTaskUiAfterRefresh'),
    app.indexOf('function renderWorkspace'),
  );
  assert.match(reconciliation, /state\.taskUi\.view !== 'detail'/);
  assert.match(reconciliation, /state\.taskUi\.selectedTaskId = null;\s*(?:state\.taskAdoption = null;\s*)?return;/);
  assert.match(reconciliation, /state\.taskUi\.view = 'list'/);
  assert.match(app, /state\.tasks = taskDetails;\s*reconcileTaskUiAfterRefresh\(\)/);
  assert.match(app, /function hasLiveTaskComposer\(\)/);
  assert.match(app, /mayPreserveWorkspace && hasLiveTaskComposer\(\)/);
  assert.match(app, /previousWorkspaceFingerprint === workspaceRenderFingerprint\(\)/);
  assert.match(app, /const preserveTaskComposer = hasLiveTaskComposer\(\)/);
  assert.match(app, /if \(!preserveTaskComposer\) renderWorkspace\(\{[\s\S]*preserveTaskContext:/);
  assert.match(app, /if \(!preserveWorkspace\) renderWorkspace/);
  assert.doesNotMatch(app, /state\.tasks = taskDetails;\s*if \(!state\.tasks\.some/);
  const evidence = await readFile(new URL('../scripts/capture-studio-browser-evidence.js', import.meta.url), 'utf8');
  assert.match(evidence, /Refresh-safe task draft/);
  assert.match(evidence, /const runPassiveRefresh = async \(\) =>/);
  assert.match(evidence, /checkpoint4Focus === 'create' \? 30_000 : 10_000/);
  assert.match(evidence, /refreshButton\.click\(\)/);
  assert.match(evidence, /await runPassiveRefresh\(\)/);
  assert.match(evidence, /Concurrent task list update/);
  assert.match(evidence, /const externalSession = await fetch\('\/api\/ui-session'\)/);
  assert.match(evidence, /const concurrentChangeExercised = \$\{width === 1060\}/);
  assert.match(evidence, /serverStateMatched: concurrentChangeExercised/);
  assert.match(evidence, /concurrentChangeExercised === \(width === 1060\)/);
  assert.match(evidence, /textContent === 'Revision 6'/);
  assert.match(evidence, /textContent === '6'/);
  assert.match(evidence, /sameComposer: currentComposer === composer/);
  assert.match(evidence, /sameForm: currentForm === form/);
  assert.match(evidence, /sameField: currentObjectiveField === objectiveField/);
  assert.match(evidence, /document\.activeElement === currentObjectiveField/);
  assert.match(evidence, /selectionStart === 9/);
  assert.match(evidence, /selectionEnd === 17/);
  assert.match(evidence, /scrollUnchanged === true/);
});

test('CP4.5 task timeline uses real durable events and never offers a second undo', async () => {
  const app = await readFile(appUrl, 'utf8');
  assert.match(app, /BRANCH_COMMAND_COMMITTED: 'Agent change saved'/);
  assert.match(app, /TASK_MERGED: 'Accepted changes added to project'/);
  assert.match(app, /MERGE_REVERTED: 'Task changes undone'/);
  assert.match(app, /taskWasReverted\(entry\)/);
  assert.match(app, /review\.mergeId && !taskWasReverted\(entry\)/);
  assert.match(app, /review\?\.state === 'OPEN' && effectiveState === 'IN_REVIEW'/);
  assert.match(app, /event\.actor\?\.id \?\? event\.actorId/);
  assert.match(app, /technical\.append\(technicalSummary, technicalCode\)/);
  assert.match(app, /This result overlaps newer project work and cannot be added safely\. End this task without adding changes, then create a new task from the current project\./);
});

test('CP4.5 preview failures revoke acceptance and placement while rotations transform authored geometry', async () => {
  const app = await readFile(appUrl, 'utf8');
  assert.match(app, /onLoadReady\?\.\(\)/);
  assert.match(app, /figure\.dataset\.previewState = 'LOADING'/);
  assert.match(app, /wrapper\.dataset\.previewReady = 'false'/);
  assert.match(app, /wrapper\.dataset\.previewStatus = canLoad \? 'LOADING' : 'UNAVAILABLE'/);
  assert.match(app, /acceptOption\.disabled = true/);
  assert.match(app, /use\.disabled = true/);
  assert.match(app, /function rotatedPreviewGeometry/);
  assert.match(app, /span\.height - y - height/);
  assert.match(app, /Occupies \$\{geometry\.width\} × \$\{geometry\.height\} cells/);
  assert.match(app, /onBeforeReload: \(\) => \{ draft\.dirty = false; \}/);
  assert.match(app, /prop-top-left-marker/);
  assert.match(app, /authored anchor is \+ at/);
  assert.doesNotMatch(app, /draft\.dirty = false;\s*const result = await executeRoomMutation\(\{ operation: 'room-shape-set'/);
});

test('CP4.5 focused layouts remain bounded at the protected widths', async () => {
  const styles = await readFile(stylesUrl, 'utf8');
  assert.match(styles, /\.task-list-header \{ display: flex/);
  assert.match(styles, /\.task-workflow-state \{[^}]*background:/);
  assert.match(styles, /\.room-editor-shell \{[^}]*grid-template-columns:/);
  assert.match(styles, /@media \(max-width: 1200px\)[\s\S]*\.room-editor-dock \{ grid-column: 2/);
  assert.match(styles, /@media \(max-width: 820px\)[\s\S]*\.room-toolbox \{[^}]*grid-template-columns: repeat\(4/);
});

test('CP4.5 room editor keeps paint drafts exclusive, visible, recoverable, and mutation-safe', async () => {
  const app = await readFile(appUrl, 'utf8');
  assert.match(app, /activeTool: 'SELECT'/);
  assert.match(app, /button\.setAttribute\('aria-pressed', String\(state\.roomUi\.activeTool === value\)\)/);
  assert.match(app, /draft\.voidCells = draft\.voidCells\.filter[\s\S]*draft\.blockedCells = draft\.blockedCells\.filter/);
  assert.match(app, /targetKind === 'VOID'.*draft\.voidCells\.push\(anchor\)/s);
  assert.match(app, /targetKind === 'BLOCKED'.*draft\.blockedCells\.push\(anchor\)/s);
  assert.match(app, /if \(state\.roomUi\.shapeConflict\).*role', 'alert'/s);
  assert.match(app, /Discard the unsaved shape changes and reload the saved room version/);
  assert.match(app, /applyRoomShapeDraftLock/);
  assert.match(app, /form\[data-room-form\]:not\(\[data-room-form="shape-coordinates"\]\)/);
  assert.match(app, /operation !== 'room-shape-set' && state\.roomUi\.shapeDraft\?\.dirty/);
  assert.match(app, /preserveRoomCanvas = false/);
  assert.match(app, /replacementCanvas\.replaceWith\(retainedRoomCanvas\)/);
  assert.match(app, /function settleRoomEditorControlFocus/);
  assert.match(app, /generation !== roomEditorFocusGeneration/);
  assert.match(app, /repair && !focusIsNeutral && focusedKey !== focusKey/);
  assert.match(app, /candidate\.dataset\.selected === 'true'/);
  assert.match(app, /focusSelectedControl\(\{ repair: true \}\)/);
  assert.match(app, /renderRoomDockNavigation\(\), renderRoomLayers\(\)/);
  assert.match(app, /variant\.lifecycle !== 'DRAFT'\) \{ showToast\(`\$\{variant\.lifecycle\} room versions are read-only/);
});
