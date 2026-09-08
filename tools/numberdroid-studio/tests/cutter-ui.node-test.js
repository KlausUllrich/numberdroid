import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { cutterGridInfo, cutterEditIssues } from '../apps/studio-server/public/cutter-editor-state.js';

test('grid output-budget rejection preserves the previous layout and does not create history or a replacement', async () => {
  const app = await readFile(new URL('../apps/studio-server/public/app.js', import.meta.url), 'utf8');
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
