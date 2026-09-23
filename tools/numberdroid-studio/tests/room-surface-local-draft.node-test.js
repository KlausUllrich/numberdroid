import assert from 'node:assert/strict';
import test from 'node:test';
import { createRoomSurfaceTools } from '../apps/studio-server/public/room-surface-editor.js';

const turn = () => new Promise(resolve => setImmediate(resolve));
class Element {
  constructor(tag, text = '') { this.tagName = tag; this.textContent = text; this.children = []; this.dataset = {}; this.attributes = {}; this.handlers = {}; }
  append(...children) { this.children.push(...children); }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(name, handler) { this.handlers[name] = handler; }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [child, ...child.querySelectorAll(selector)])
      .filter(child => selector === 'img' ? child.tagName === 'img'
        : selector === '[data-surface-disabled-reason]' && child.dataset.surfaceDisabledReason);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
}
function descendants(node) { return [node, ...node.children.flatMap(descendants)]; }
function button(panel, label) {
  const found = descendants(panel).find(node => node.tagName === 'button' && node.textContent === label);
  assert.ok(found, `button ${label} is rendered`); return found;
}
function click(panel, label) { const found = button(panel, label); assert.equal(found.disabled, false, `${label} enabled`); found.handlers.click(); }
function dom(t) {
  const oldDocument = globalThis.document, oldWindow = globalThis.window;
  globalThis.document = { createElement: tag => new Element(tag), createTextNode: text => new Element('#text', text) };
  globalThis.window = { confirm: () => true };
  t.after(() => { globalThis.document = oldDocument; globalThis.window = oldWindow; });
}
function fixture({ dirtyShape = false, refuse = false } = {}) {
  const asset = { assetId: 'surface.a', assetVersion: 2, metadataVersion: 3, name: 'Calm', kind: 'surface', metadata: {
    spanTiles: { width: 1, height: 1 }, rotationPolicy: 'cardinal', role: 'base',
    placement: { wallSafe: true }, connectors: [], continuityTags: [], continuityProfile: null,
  } };
  const context = { projectId: 'project.a', revision: 4, draftGeneration: 0, active: true, pinsReady: true,
    readOnly: false, dirtyShape, otherPending: false,
    room: { roomVariantId: 'room.a', version: 3, width: 4, height: 4, lifecycle: 'DRAFT', placements: [], voidCells: [], blockedCells: [] },
    archetype: { structuralBands: { left: 0, right: 0, top: 0, bottom: 0 } }, assets: [asset], palette: [asset] };
  const initial = structuredClone(context.room), calls = { staged: [], undo: 0, forbidden: [] };
  let prior = null;
  const tools = createRoomSurfaceTools({ getContext: () => context, spanOf: value => value?.metadata.spanTiles,
    changed() {}, busyChanged: value => calls.forbidden.push(['busy', value]),
    send: (...args) => { calls.forbidden.push(['send', ...args]); throw new Error('Local tools must not send HTTP'); },
    saved: (...args) => calls.forbidden.push(['saved', ...args]),
    thumbnail() { const parent = new Element('div'), img = new Element('img'); parent.dataset.previewState = 'READY'; img.complete = true; img.naturalWidth = 12; parent.append(img); return parent; },
    stage(plan) {
      if (refuse) return false;
      calls.staged.push(structuredClone(plan)); prior = structuredClone(context.room.placements);
      const remove = new Set(plan.removals.map(item => item.placementId));
      context.room = { ...context.room, placements: [...context.room.placements.filter(item => !remove.has(item.placementId)), ...structuredClone(plan.additions)] };
      context.draftGeneration += 1; return true;
    },
    stageUndo() { calls.undo += 1; context.room = { ...context.room, placements: prior }; context.draftGeneration += 1; return true; },
  });
  tools.sync(); tools.getState().pool.push({ assetId: asset.assetId, assetVersion: 2, metadataVersion: 3 });
  return { tools, context, calls, initial };
}

test('local Paint is immediate and cumulative without HTTP, a saved receipt or invented versions', async () => {
  const { tools, context, calls, initial } = fixture({ dirtyShape: true });
  tools.clickCell({ x: 0, y: 0 }); tools.clickCell({ x: 1, y: 0 });
  assert.equal(context.room.placements.length, 2, 'both Paint clicks stage synchronously');
  await turn();
  assert.equal(context.revision, 4); assert.equal(context.room.version, 3); assert.equal(initial.placements.length, 0);
  assert.deepEqual(calls.forbidden, []); assert.equal(calls.staged.length, 2);
  for (const item of context.room.placements) {
    assert.equal(item.assetVersion, 2); assert.equal(item.metadataVersion, 3);
  }
  assert.match(tools.getState().message, /Unsaved changes/); assert.equal(tools.hasUnresolved(), false);
  tools.clickCell({ x: 1, y: 0 }); await turn();
  assert.equal(calls.staged.length, 2); assert.match(tools.getState().message, /draft was not changed/);
});

test('local Fill previews a pure plan, and Apply stages the exact random arrangement once', async t => {
  dom(t); const { tools, context, calls } = fixture();
  click(tools.render(), 'Fill');
  const random = descendants(tools.render()).find(node => node.tagName === 'input' && node.type === 'checkbox' && !node.name);
  random.checked = true; random.handlers.change();
  click(tools.render(), 'Preview fill'); await turn();
  const expected = structuredClone(tools.getState().preview.plan);
  assert.equal(context.room.placements.length, 0); assert.equal(calls.staged.length, 0); assert.deepEqual(calls.forbidden, []);
  tools.render(); assert.deepEqual(tools.getState().preview.plan, expected);
  click(tools.render(), 'Apply fill'); await turn();
  assert.deepEqual(calls.staged, [expected]); assert.equal(context.room.placements.length, 16);
  assert.equal(context.revision, 4); assert.equal(context.room.version, 3); assert.deepEqual(calls.forbidden, []);
});

test('any shared draft change invalidates Fill preview, preserves settings, and stale Apply cannot stage', async t => {
  dom(t); const { tools, context, calls } = fixture();
  click(tools.render(), 'Fill'); tools.rotateBrush(); click(tools.render(), 'Preview fill'); await turn();
  const staleApply = button(tools.render(), 'Apply fill');
  context.room = { ...context.room, blockedCells: [{ x: 1, y: 1 }] }; context.draftGeneration += 1;
  tools.sync(); assert.equal(tools.getState().preview, null);
  assert.equal(tools.getState().rotation, 90); assert.equal(tools.getState().pool.length, 1);
  staleApply.handlers.click(); await turn();
  assert.equal(calls.staged.length, 0); assert.deepEqual(calls.forbidden, []);
  assert.match(tools.getState().message, /draft changed/);
});

test('local Surface Undo restores only its placement snapshot and never persists', async t => {
  dom(t); const { tools, context, calls } = fixture();
  tools.clickCell({ x: 0, y: 0 }); tools.clickCell({ x: 1, y: 0 }); await turn();
  click(tools.render(), 'Undo last Surface change');
  assert.equal(calls.undo, 1); assert.equal(context.room.placements.length, 1);
  assert.deepEqual(context.room.placements[0].anchor, { x: 0, y: 0 });
  assert.equal(context.revision, 4); assert.equal(context.room.version, 3); assert.deepEqual(calls.forbidden, []);
  assert.match(tools.getState().message, /Nothing was saved/);
  assert.equal(button(tools.render(), 'Undo last Surface change').disabled, true);
});

test('another shared edit or explicit Save invalidates Surface Undo and clears stale status', async t => {
  dom(t); const { tools, context, calls } = fixture();
  tools.clickCell({ x: 0, y: 0 }); await turn();
  const staleUndo = button(tools.render(), 'Undo last Surface change');
  context.draftGeneration += 1; tools.sync();
  assert.equal(tools.getState().message, ''); assert.equal(button(tools.render(), 'Undo last Surface change').disabled, true);
  staleUndo.handlers.click(); assert.equal(calls.undo, 0);
  tools.clickCell({ x: 1, y: 0 }); await turn();
  context.revision += 1; context.room.version += 1; context.draftGeneration += 1;
  tools.sync(); assert.equal(tools.getState().message, '');
  assert.equal(button(tools.render(), 'Undo last Surface change').disabled, true);
});

test('overlap repair stages only confirmed removals; saved source and unrelated Prop remain untouched', async t => {
  dom(t); const { tools, context, calls } = fixture();
  tools.clickCell({ x: 0, y: 0 }); await turn();
  const first = context.room.placements[0], second = { ...first, placementId: 'duplicate' };
  const prop = { ...first, placementId: 'prop', layer: 'SET_DRESSING' };
  context.room.placements.push(second, prop); context.draftGeneration += 1;
  click(tools.render(), 'Cell 0,0 · 2 Surfaces');
  const keep = descendants(tools.render()).find(node => node.tagName === 'button' && node.textContent.startsWith('Keep Calm · copy 1'));
  assert.ok(keep); window.confirm = () => false; keep.handlers.click(); await turn();
  assert.equal(calls.staged.length, 1);
  window.confirm = () => true; keep.handlers.click(); await turn();
  assert.equal(calls.staged.length, 2);
  assert.deepEqual(context.room.placements.map(item => item.placementId), [first.placementId, 'prop']);
  assert.equal(context.assets.length, 1); assert.equal(context.room.version, 3); assert.deepEqual(calls.forbidden, []);
});

test('refused local staging never creates an uncertain network request or falsely reports saving', async () => {
  const { tools, calls, context } = fixture({ refuse: true });
  tools.clickCell({ x: 0, y: 0 }); await turn();
  assert.equal(context.room.placements.length, 0); assert.equal(tools.hasUnresolved(), false);
  assert.equal(tools.isBusy(), false); assert.equal(tools.getState().undo, null);
  assert.match(tools.getState().message, /could not be added.*Nothing was saved/); assert.deepEqual(calls.forbidden, []);
});

test('displayed snapshot changes invalidate captured Apply even if the adapter omits a generation increment', async t => {
  dom(t); const { tools, context, calls } = fixture();
  click(tools.render(), 'Fill'); click(tools.render(), 'Preview fill'); await turn();
  const apply = button(tools.render(), 'Apply fill');
  context.room = { ...context.room, voidCells: [{ x: 3, y: 3 }] };
  apply.handlers.click(); await turn();
  assert.equal(calls.staged.length, 0); assert.match(tools.getState().message, /draft changed/);
  assert.deepEqual(calls.forbidden, []);
});

test('shared save lock, read-only mode and missing exact pins still block local Surface staging', async () => {
  for (const override of [{ otherPending: true }, { readOnly: true }, { pinsReady: false }]) {
    const { tools, context, calls } = fixture({ dirtyShape: true });
    Object.assign(context, override); tools.clickCell({ x: 0, y: 0 }); await turn();
    assert.equal(calls.staged.length, 0); assert.equal(tools.hasUnresolved(), false);
    assert.deepEqual(calls.forbidden, []);
  }
});
