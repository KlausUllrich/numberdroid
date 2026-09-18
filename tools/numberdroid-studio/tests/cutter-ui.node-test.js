import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { cutterGridInfo, cutterEditIssues } from '../apps/studio-server/public/cutter-editor-state.js';
import { cutterActionState } from '../apps/studio-server/public/cutter-editor-view.js';

test('Cutter actions distinguish valid geometry, saved layout, pending work and unchanged save', () => {
  const source = { width: 100, height: 100 };
  const cutter = { dirty: false, rectangles: [{ rectangleId: 'cut.one', x: 0, y: 0, width: 20, height: 20, included: true }] };
  const context = { cutter, source, atlas: { definitionVersion: 1 }, pending: false, job: null };
  let result = cutterActionState(context);
  assert.match(result.saveReason, /already saved/); assert.equal(result.generateReason, '');
  cutter.dirty = true; result = cutterActionState(context);
  assert.equal(result.saveReason, ''); assert.match(result.generateReason, /Save the changed cut layout first/);
  cutter.rectangles[0].width = 101; result = cutterActionState(context);
  assert.equal(result.issues.canPreview, false); assert.match(result.generateReason, /inside the source/);
  cutter.rectangles[0].width = 20; cutter.dirty = false; result = cutterActionState(context);
  assert.equal(result.generateReason, '', 'restoring the saved valid layout re-enables Generate');
  for (const state of ['QUEUED', 'RUNNING']) assert.match(cutterActionState({ ...context, job: { state } }).generateReason, /Wait for completion, or cancel/);
  for (const state of ['FAILED', 'CANCELLED']) assert.match(cutterActionState({ ...context, job: { state } }).generateReason, /Discard the failed or cancelled job/);
  assert.match(cutterActionState({ ...context, job: { state: 'SUCCEEDED' } }).generateReason, /current generated results/);
  assert.match(cutterActionState({ ...context, job: { state: 'RUNNING', cancelRequested: true } }).generateReason, /Cancellation is pending/);
  assert.match(cutterActionState({ ...context, pending: true }).generateReason, /in progress/);
  for (const state of ['APPLIED', 'DISCARDED']) assert.equal(cutterActionState({ ...context, job: { state } }).generateReason, '');
  const staleDraft = { ...cutter, syncedVersion: 1, dirty: false };
  const newerAtlas = { definitionVersion: 2, rectangles: [{ ...cutter.rectangles[0], x: 50 }] };
  const stale = cutterActionState({ ...context, cutter: staleDraft, atlas: newerAtlas });
  assert.match(stale.generateReason, /saved layout changed elsewhere/);
  assert.match(stale.saveReason, /local edits are retained/);
  assert.equal(staleDraft.rectangles[0].x, 0, 'stale reconciliation never silently replaces the displayed draft');
  const uncertain = { ...staleDraft, operations: { define: { idempotencyKey: 'same-original-save', rectangles: structuredClone(cutter.rectangles) } } };
  assert.equal(cutterActionState({ ...context, cutter: uncertain, atlas: newerAtlas }).saveReason, '', 'a lost Save response leaves exact retry reachable');
  assert.match(cutterActionState({ ...context, cutter: uncertain, atlas: newerAtlas }).generateReason, /saved layout changed elsewhere/);
  assert.match(cutterActionState({ ...context, cutter: uncertain, atlas: newerAtlas, pending: true }).saveReason, /in progress/);
  assert.equal(cutterActionState({ ...context, cutter: { ...cutter, syncedVersion: 2 }, atlas: newerAtlas }).generateReason, '');
});

test('grid output-budget rejection preserves the previous layout and does not create history or a replacement', async () => {
  const app = (await readFile(new URL('../apps/studio-server/public/app.js', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  const start = app.indexOf("elements['workspace-content'].addEventListener('submit', (event) => {\n  const form = event.target.closest('[data-cutter-grid-form]');");
  const end = app.indexOf("elements['workspace-content'].addEventListener('change'", start);
  assert(start >= 0 && end > start);
  const original = [{ rectangleId: 'cut.saved', x: 0, y: 0, width: 1, height: 1, included: true }];
  const history = { past: [], future: [] };
  const state = { project: { snapshot: { sources: [{ id: 'source.large', width: 4096, height: 4096 }] } },
    cutter: { sourceId: 'source.large', guide: { width: 2048, height: 2048, x: 0, y: 0, gapX: 0, gapY: 0 }, rectangles: original, history } };
  let handler; let replacements = 0; let sequence = 0;
  runInNewContext(app.slice(start, end), { state, cutterGridInfo, cutterEditIssues,
    crypto: { randomUUID: () => `id-${++sequence}` },
    elements: { 'workspace-content': { addEventListener(_type, callback) { handler = callback; } } },
    syncCurrentCutterCanvas() {}, applyCutterRectangles() { replacements += 1; } });
  handler({ target: { closest: () => ({}) }, preventDefault() {} });
  assert.equal(replacements, 0); assert.equal(state.cutter.rectangles, original); assert.equal(state.cutter.history, history);
  assert.match(state.cutter.error, /16 MiB output limit/);
});


test('deferred Cutter view restoration belongs only to the same instance, workspace and view generation', async () => {
  const app = (await readFile(new URL('../apps/studio-server/public/app.js', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  const start = app.indexOf("  if (state.cutter?.restoreViewContext && state.workspace === 'sources') {");
  const end = app.indexOf("  if (state.workspace === 'rooms' && state.roomUi.zoom", start);
  assert(start >= 0 && end > start);
  for (const change of ['none', 'workspace', 'instance', 'view', 'generation']) {
    let frame; const calls = [];
    const cutter = { view: 'edit', viewGeneration: 2, restoreViewContext: { x: 11, y: 118, focus: 'field' } };
    const state = { workspace: 'sources', cutter };
    runInNewContext(app.slice(start, end), { state, requestAnimationFrame: callback => { frame = callback; },
      elements: { 'workspace-content': { querySelectorAll: () => [{ focus: () => calls.push('focus') }] } },
      cutterControlKey: () => 'field', window: { scrollTo: (x, y) => calls.push([x, y]) } });
    if (change === 'workspace') state.workspace = 'rooms';
    if (change === 'instance') state.cutter = { ...cutter };
    if (change === 'view') cutter.view = 'detail';
    if (change === 'generation') cutter.viewGeneration += 1;
    frame(); assert.deepEqual(calls, change === 'none' ? ['focus', [11, 118]] : []);
  }
});

test('reopening the same Cutter view restores page position after a shorter Workbench list', async () => {
  const app = (await readFile(new URL('../apps/studio-server/public/app.js', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  const start = app.indexOf('function openCutter('), end = app.indexOf('async function loadCutterJob(', start);
  for (const mismatch of ['none', 'projectId', 'sourceId', 'atlasId', 'view']) {
    const closed = { projectId: 'project.test', sourceId: 'source.test', atlasId: 'atlas.test', view: 'edit', x: 0, y: 50 };
    if (mismatch !== 'none') closed[mismatch] = 'different';
    const source = { id: 'source.test', name: 'Original', width: 64, height: 64 };
    const state = { cutterClosedContext: closed, project: { projectId: 'project.test', snapshot: {
      atlases: [{ id: 'atlas.test', sourceId: source.id, rectangles: [], definitionVersion: 1 }],
    } } };
    const open = runInNewContext(`${app.slice(start, end)}; openCutter;`, {
      state, structuredClone, crypto: { randomUUID: () => 'instance.new' },
      cancelCutterJobPolling() {}, resetCutterScroll() {}, renderWorkspace() {}, showToast() {},
    });
    open(source, { atlasId: 'atlas.test', view: 'edit' });
    assert.equal(state.cutterClosedContext, null);
    assert.equal(state.cutter.restoreViewContext?.y, mismatch === 'none' ? 50 : undefined);
    assert.equal(state.cutter.zoom, 'fit');
    assert.equal(state.cutter.dirty, false);
    assert.equal(state.cutter.savedDefinition.sourceId, source.id);
    assert.deepEqual(Array.from(state.cutter.savedDefinition.rectangles), []);
  }
});
