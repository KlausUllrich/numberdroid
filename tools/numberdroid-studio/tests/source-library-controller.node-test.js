import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { assetEditorDefaultMetadata } from '../apps/studio-server/public/asset-editor-state.js';

// Run the real renderer and handlers against a deliberately minimal inert DOM.
// Exposing async actions in this VM lets tests await completion without polling.
class Node {
  constructor(tag, document) { this.tagName = tag; this.document = document; this.children = []; this.dataset = {}; this.listeners = {}; this.disabled = false; this.isConnected = false; this.text = ''; }
  get parentElement() { return this.parent; }
  set textContent(value) { this.text = value; this.children = []; }
  get textContent() { return this.text + this.children.map(child => child.textContent).join(' '); }
  append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  setAttribute(name, value) { this[name] = value; }
  addEventListener(name, handler) { this.listeners[name] = handler; }
  contains(node) { return Boolean(node) && (node === this || this.children.some(child => child.contains(node))); }
  matches(selector) { const key = selector.slice(6, -1).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()); return selector.startsWith('[data-') && Object.hasOwn(this.dataset, key); }
  closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector) ?? null; }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  focus() { this.document.activeElement = this; }
  setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
}

async function harness({ generated = false, storageFailure = false, storage: retainedStorage, targets = [], request: customRequest, onSaved } = {}) {
  const source = await readFile(new URL('../apps/studio-server/public/source-library-controller.js', import.meta.url), 'utf8');
  const returnMarker = 'return { element, update, hasPending:';
  assert.equal(source.split(returnMarker).length, 2, 'Test seam must match the real controller return exactly.');
  const executable = source.slice(source.indexOf('const clone ='))
    .replace('export function createSourceLibraryController', 'function createSourceLibraryController')
    .replace(returnMarker, 'return { check, save, refresh, inspect: () => ({ uncertain, receipt, busy, error, captured, rows, plan }), element, update, hasPending:');
  const rectangle = { rectangleId: 'rect.one', name: 'Coffee machine', included: true };
  const output = { rectangleId: rectangle.rectangleId, rectangle, sliceId: 'slice.one', version: 1, width: 8, height: 8, digest: 'a'.repeat(64) };
  const context = { projectId: 'project.test', revision: 7,
    atlas: { id: 'atlas.test', definitionVersion: 1, definitionFingerprint: 'b'.repeat(64), rectangles: [rectangle], sliceHeads: [output] },
    job: generated ? { jobId: 'job.test', state: 'SUCCEEDED', outputs: [output] } : null };
  const bootstrap = { projectId: context.projectId, atlasId: context.atlas.id, revision: context.revision,
    expectedAtlasVersion: 1, expectedAtlasFingerprint: context.atlas.definitionFingerprint,
    savedInput: { mode: 'saved', slices: [{ rectangleId: 'rect.one', sliceId: 'slice.one', expectedSliceVersion: 1 }] }, targets, priorMappings: [] };
  const storage = retainedStorage ?? new Map(), calls = [], busyEvents = [], savedEvents = [];
  const defaultRequest = async (action, input) => {
    if (action === 'bootstrap') return structuredClone(bootstrap);
    if (action === 'plan') return { canSave: true, status: 'READY', summary: { created: 1, updated: 0, unchanged: 0, skipped: 0 }, items: [] };
    return { projectId: context.projectId, atlasId: context.atlas.id, revision: 8, status: 'SAVED',
      summary: { created: 1, updated: 0, unchanged: 0, skipped: 0 }, items: [{ rectangleId: 'rect.one', assetId: input.items[0].destination.assetId, assetVersion: 1 }] };
  };
  const document = { createElement: tag => new Node(tag, document), activeElement: null };
  const create = runInNewContext(`${executable}; createSourceLibraryController;`, {
    assetEditorDefaultMetadata, structuredClone, crypto, document,
    window: { scrollX: 0, scrollY: 0, scrollTo() {} }, sessionStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem(key, value) { if (storageFailure) throw new Error('Storage unavailable'); storage.set(key, value); },
      removeItem: key => storage.delete(key),
    },
  });
  const controller = create({ context, request: async (action, input) => {
    calls.push({ action, input: structuredClone(input) });
    return customRequest ? customRequest(action, input, defaultRequest) : defaultRequest(action, input);
  }, onBusy: value => busyEvents.push(value), onOpenAsset() {}, onSaved: async value => { savedEvents.push(value); await onSaved?.(value); } });
  await new Promise(resolve => setImmediate(resolve));
  return { controller, context, bootstrap, storage, calls, busyEvents, savedEvents, document,
    change(field, value) { const target = controller.element.querySelectorAll('[data-source-library-field]').find(node => node.dataset.sourceLibraryField === field);
      assert.ok(target); target.value = value; controller.element.listeners.change({ target }); },
  };
}

test('bootstrap uses exact saved inputs or generated job and offers new, update and skip destinations', { timeout: 5000 }, async () => {
  for (const generated of [false, true]) {
    const h = await harness({ generated, targets: [{ assetId: 'asset.existing', assetVersion: 3, metadataVersion: 2, name: 'Existing machine', kind: 'prop', sliceBinding: { digest: 'c'.repeat(64) } }] });
    try {
      assert.equal(h.controller.inspect().rows.length, 1);
      assert.match(h.controller.element.textContent, /Coffee machine/);
      await h.controller.check();
      const input = h.calls.find(call => call.action === 'plan').input;
      assert.deepEqual(input.input, generated ? { mode: 'generated', jobId: 'job.test' } : h.bootstrap.savedInput);
      assert.equal(input.items[0].destination.operation, 'create');
      h.change('target', 'asset.existing'); await h.controller.check();
      assert.deepEqual(h.calls.at(-1).input.items[0].destination, { operation: 'update', assetId: 'asset.existing',
        expectedAssetVersion: 3, expectedMetadataVersion: 2, name: 'Existing machine' });
      assert.match(h.controller.element.textContent, /In Library · v3/);
      h.change('target', 'skip'); await h.controller.check();
      assert.equal(h.calls.at(-1).input.items[0].destination.operation, 'skip');
      assert.match(h.controller.element.textContent, /Existing content is kept/);
    } finally { h.controller.dispose(); }
  }
});

test('lost save response retains an immutable request and exact key for retry after context changes', { timeout: 5000 }, async () => {
  let attempts = 0;
  const h = await harness({ request: async (action, input, normal) => {
    if (action === 'save' && ++attempts === 1) throw new Error('Connection lost');
    return normal(action, input);
  } });
  try {
    await h.controller.check(); await h.controller.save();
    assert.equal(h.controller.hasPending(), true); assert.equal(h.storage.size, 1);
    const first = h.calls.find(call => call.action === 'save').input;
    h.controller.update({ ...h.context, revision: 20 });
    h.change('name', 'A forbidden new intent');
    await h.controller.save();
    const saves = h.calls.filter(call => call.action === 'save');
    assert.equal(saves.length, 2); assert.deepEqual(saves[1].input, first);
    assert.equal(h.controller.hasPending(), false); assert.equal(h.storage.size, 0);
    assert.equal(h.savedEvents.length, 1);
  } finally { h.controller.dispose(); }
});

test('failed recovery storage prevents sending any save request', { timeout: 5000 }, async () => {
  const h = await harness({ storageFailure: true });
  try {
    await h.controller.check(); await h.controller.save();
    assert.equal(h.calls.filter(call => call.action === 'save').length, 0);
    assert.equal(h.controller.hasPending(), false);
    assert.match(h.controller.element.textContent, /Nothing was sent/);
  } finally { h.controller.dispose(); }
});

test('confirmed save followed by failed refresh remains confirmed, not an unknown mutation', { timeout: 5000 }, async () => {
  let bootstraps = 0;
  const h = await harness({ request: async (action, input, normal) => {
    if (action === 'bootstrap' && ++bootstraps > 1) throw new Error('Refresh is offline');
    return normal(action, input);
  } });
  try {
    await h.controller.check(); await h.controller.save();
    assert.equal(h.controller.hasPending(), false); assert.equal(h.storage.size, 0);
    assert.equal(h.controller.inspect().receipt.status, 'SAVED');
    assert.match(h.controller.element.textContent, /Saved successfully/);
    assert.match(h.controller.element.querySelectorAll('[data-source-library-action]').find(node => node.dataset.sourceLibraryAction === 'save').title, /Recheck/);
    assert.ok(h.controller.element.querySelectorAll('[data-source-library-action]').some(node => node.dataset.sourceLibraryAction === 'recheck' && !node.disabled),
      'A confirmed save with a failed refresh must expose the promised recheck action.');
    assert.doesNotMatch(h.controller.element.textContent, /Confirm the previous save before editing/);
    await h.controller.save(); assert.equal(h.calls.filter(call => call.action === 'save').length, 1);
  } finally { h.controller.dispose(); }
});

test('reopening the controller replays its retained uncertain request instead of starting a new mutation', { timeout: 5000 }, async () => {
  const h = await harness({ request: (action, input, normal) => action === 'save' ? Promise.reject(new Error('Response lost')) : normal(action, input) });
  await h.controller.check(); await h.controller.save();
  const first = h.calls.find(call => call.action === 'save').input;
  h.controller.dispose();
  const reopened = await harness({ storage: h.storage });
  try {
    assert.equal(reopened.controller.hasPending(), true);
    assert.equal(reopened.calls.length, 0, 'Recovery cannot load a new plan before confirming the previous save.');
    await reopened.controller.save();
    assert.deepEqual(reopened.calls.find(call => call.action === 'save').input, first);
    assert.equal(reopened.storage.size, 0); assert.equal(reopened.savedEvents.length, 1);
  } finally { reopened.controller.dispose(); }
});

test('changed project context disables committing a previously checked plan', { timeout: 5000 }, async () => {
  const h = await harness();
  try {
    await h.controller.check(); h.controller.update({ ...h.context, revision: 8 });
    const button = h.controller.element.querySelectorAll('[data-source-library-action]').find(node => node.dataset.sourceLibraryAction === 'save');
    assert.equal(button.disabled, true);
    assert.match(button.title, /Recheck/);
    await h.controller.save(); assert.equal(h.calls.filter(call => call.action === 'save').length, 0);
  } finally { h.controller.dispose(); }
});

test('an in-flight plan cannot authorize a save after the project context changes', { timeout: 5000 }, async () => {
  let complete;
  const h = await harness({ request: (action, input, normal) => action === 'plan' ? new Promise(resolve => { complete = resolve; }) : normal(action, input) });
  try {
    const checking = h.controller.check(); h.controller.update({ ...h.context, revision: 9 });
    complete({ canSave: true, summary: { created: 1, updated: 0, unchanged: 0, skipped: 0 }, items: [] }); await checking;
    await h.controller.save(); assert.equal(h.calls.filter(call => call.action === 'save').length, 0);
    assert.match(h.controller.element.textContent, /Recheck the current versions/);
  } finally { h.controller.dispose(); }
});

test('denied retry after a lost response and reload preserves unresolved exact intent', { timeout: 5000 }, async () => {
  const h = await harness({ request: (action, input, normal) => action === 'save' ? Promise.reject(new Error('Response lost')) : normal(action, input) });
  await h.controller.check(); await h.controller.save();
  const original = h.calls.find(call => call.action === 'save').input;
  h.controller.dispose();
  let denied = true;
  const reopened = await harness({ storage: h.storage, request: (action, input, normal) => {
    if (action === 'save' && denied) throw Object.assign(new Error('Owner access denied'), { status: 403, code: 'PERMISSION_DENIED' });
    return normal(action, input);
  } });
  try {
    await reopened.controller.save();
    assert.equal(reopened.controller.hasPending(), true); assert.equal(reopened.storage.size, 1);
    assert.deepEqual(reopened.calls.at(-1).input, original);
    denied = false; await reopened.controller.save();
    assert.deepEqual(reopened.calls.findLast(call => call.action === 'save').input, original);
    assert.equal(reopened.controller.hasPending(), false); assert.equal(reopened.storage.size, 0);
  } finally { reopened.controller.dispose(); }
});

test('definitive first-attempt rejection clears intent without claiming a save', { timeout: 5000 }, async () => {
  const h = await harness({ request: (action, input, normal) => action === 'save'
    ? Promise.reject(Object.assign(new Error('Stale project'), { status: 409, code: 'REVISION_CONFLICT' })) : normal(action, input) });
  try {
    await h.controller.check(); await h.controller.save();
    assert.equal(h.controller.hasPending(), false); assert.equal(h.storage.size, 0); assert.equal(h.savedEvents.length, 0);
  } finally { h.controller.dispose(); }
});

test('keyboard action focus survives busy rendering and the checked plan result', { timeout: 5000 }, async () => {
  let complete;
  const h = await harness({ request: (action, input, normal) => action === 'plan' ? new Promise(resolve => { complete = resolve; }) : normal(action, input) });
  try {
    const button = h.controller.element.querySelectorAll('[data-source-library-action]').find(node => node.dataset.sourceLibraryAction === 'plan'); button.focus();
    const checking = h.controller.check();
    assert.equal(h.controller.element.contains(h.document.activeElement), true);
    assert.equal(h.document.activeElement.querySelectorAll('[data-source-library-action]')[0]?.dataset.sourceLibraryAction, 'plan');
    complete({ canSave: true, summary: { created: 1, updated: 0, unchanged: 0, skipped: 0 }, items: [] }); await checking;
    assert.equal(h.document.activeElement.dataset.sourceLibraryAction, 'plan'); assert.equal(h.document.activeElement.disabled, false);
  } finally { h.controller.dispose(); }
});
