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
  assert.match(styles, /\.room-focused-layout \{[^}]*grid-template-columns:/);
  assert.match(styles, /@media \(max-width: 1200px\)[\s\S]*\.room-focused-layout \{ grid-template-columns:/);
  assert.match(styles, /@media \(max-width: 820px\)[\s\S]*\.room-focused-layout \{ grid-template-columns: 1fr/);
});
