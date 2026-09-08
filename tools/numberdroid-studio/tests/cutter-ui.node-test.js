import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { cutterGridInfo, cutterEditIssues } from '../apps/studio-server/public/cutter-editor-state.js';

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
