import assert from 'node:assert/strict';
import test from 'node:test';
import { createAssemblyReviewController } from '../apps/studio-server/public/assembly-review-view.js';
import { createAnimationReviewController } from '../apps/studio-server/public/animation-review-view.js';
import { assemblyArtworkPlayback } from '../apps/studio-server/public/assembly-artwork-view.js';
import { libraryPreviewDescriptor } from '../apps/studio-server/public/library-detail-view.js';

// Controller events and mount lifecycle, without a server or persistence fixture.
class Element {
  constructor(tag, document) { this.tagName = tag; this.ownerDocument = document; this.dataset = {}; this.style = {}; this.attributes = {}; this.children = []; this.listeners = {}; this.classList = { add() {}, toggle() {} }; this.scrollTop = 0; this.scrollLeft = 0; }
  get isConnected() { return this.root === true || Boolean(this.parentNode?.isConnected); }
  get firstChild() { return this.children[0]; }
  append(...nodes) { for (const child of nodes) { child.remove(); this.children.push(child); child.parentNode = this; } }
  replaceChildren(...nodes) { if (this.contains(this.ownerDocument.activeElement)) this.ownerDocument.activeElement = null; for (const child of [...this.children]) child.remove(); this.append(...nodes); }
  insertBefore(child, next) { child.remove(); const index = this.children.indexOf(next); this.children.splice(index < 0 ? this.children.length : index, 0, child); child.parentNode = this; }
  remove() { if (this.parentNode) { const siblings = this.parentNode.children; siblings.splice(siblings.indexOf(this), 1); this.parentNode = null; } }
  setAttribute(key, value) { this.attributes[key] = String(value); if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value); }
  getAttribute(key) { return this.attributes[key] ?? null; }
  contains(other) { return Boolean(other) && (other === this || this.children.some(child => child.contains(other))); }
  matches(selector) { const match = selector.match(/^\[data-([a-z-]+)(?:="([^"]*)")?\]$/); if (match) { const key = match[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()); return Object.hasOwn(this.dataset, key) && (match[2] === undefined || this.dataset[key] === match[2]); } return selector.startsWith('.') ? this.className?.split(' ').includes(selector.slice(1)) : this.tagName === selector; }
  closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector) ?? null; }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  addEventListener(type, callback) { this.listeners[type] = callback; }
  focus() { this.ownerDocument.activeElement = this; }
  setSelectionRange(start, end, direction) { this.selectionStart = start; this.selectionEnd = end; this.selectionDirection = direction; }
}
const projectId = 'project.review-details';
const binding = { projectId, sliceId: 'slice.display', sliceVersion: 1, width: 16, height: 16, digest: 'a'.repeat(64), mediaType: 'image/png' };
const clip = { fps: 10, playbackMode: 'pingpong', canvas: { width: 16, height: 16 }, anchor: { x: 8, y: 8 }, unitsPerPixel: 1 / 64, frames: [{ frameId: 'frame.one', name: 'Display', slice: { sliceId: binding.sliceId, sliceVersion: 1 }, durationMs: null, offset: { x: -2, y: 3 } }] };
const assembly = { unitsPerPixel: 1 / 64, placementBounds: { x: 0, y: 0, width: 64, height: 64 }, anchor: { x: 32, y: 32 }, states: [{ stateId: 'idle', name: 'Idle' }, { stateId: 'ready', name: 'Ready' }], variants: [{ variantId: 'default', name: 'Default' }, { variantId: 'copper', name: 'Copper' }], defaultStateId: 'idle', defaultVariantId: 'default', blocking: { mode: 'components', regions: [] }, components: [] };
function fixture(kind) {
  const currentAsset = { contentKind: kind, assetId: `${kind}.display`, assetVersion: 2, metadataVersion: 3, name: 'Saved display', kind: 'prop', metadata: { role: 'display', tags: [] }, [kind === 'assembly' ? 'assembly' : 'clip']: structuredClone(kind === 'assembly' ? assembly : clip) };
  const content = { ...structuredClone(currentAsset), name: 'Proposed display', operation: 'update', expectedAssetVersion: 2, expectedMetadataVersion: 3 };
  return { currentAsset, proposal: { proposalId: `proposal.${kind}`, proposalVersion: 4, status: 'PENDING', content } };
}
const scene = { elements: [], visualBounds: { x: 0, y: 0, width: 64, height: 64 }, findings: [] };
const flush = () => new Promise(resolve => setImmediate(resolve));
function harness(t, kind, { details = true, missingCurrent = false, failPreview = false, resolvedScene = scene } = {}) {
  const previous = { document: globalThis.document, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame };
  const document = { activeElement: null, createElement(tag) { return new Element(tag, this); }, createElementNS(ns, tag) { const node = this.createElement(tag); node.namespaceURI = ns; return node; } };
  globalThis.document = document;
  const frames = new Map(); let sequence = 0;
  globalThis.requestAnimationFrame = callback => { frames.set(++sequence, callback); return sequence; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  const mount = document.createElement('main'); mount.root = true;
  const source = fixture(kind), current = { projectId, projectRevision: 9, proposal: source.proposal, asset: missingCurrent ? null : source.currentAsset };
  const calls = []; let readable = true, mutable = true, queries = 0, writes = 0;
  const host = { getContext: () => current, canRead: () => readable, canMutate: () => mutable, setMutationPending() {}, announce() {},
    resolveDraft: async () => { queries += 1; if (failPreview) throw new Error('Saved component unavailable'); return { scene: structuredClone(resolvedScene), leafAssets: [] }; },
    resolveCuts: async () => { queries += 1; if (failPreview) throw new Error('Saved cut unavailable'); return [binding]; },
    resolve: async () => { writes += 1; throw new Error('Decision response lost'); },
    resolveDecision: async () => { writes += 1; throw new Error('Decision response lost'); },
    onSaved() { throw new Error('Inspection cannot save'); }, refresh() { throw new Error('Inspection cannot refresh'); },
  };
  if (details) host.onDetails = payload => { calls.push(payload); mount.replaceChildren(document.createElement('article')); };
  const controller = (kind === 'assembly' ? createAssemblyReviewController : createAnimationReviewController)({ initial: { ...current, currentAsset: current.asset }, host });
  mount.append(controller.element);
  t.after(() => { controller.dispose(); mount.replaceChildren(); Object.assign(globalThis, previous); });
  const selector = side => `[data-${kind}-review-details="${side}"]`;
  const click = target => controller.element.listeners.click({ target });
  return { controller, current, document, mount, calls, frames, selector, click, host,
    setReadable(value) { readable = value; }, setMutable(value) { mutable = value; }, counts: () => ({ queries, writes }),
    returnToReview() { mount.replaceChildren(controller.element); controller.afterMount(); },
    tick(now) { const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(now); },
  };
}

for (const kind of ['assembly', 'animation']) {
  test(`${kind}: Details is optional and cannot introduce a command for old hosts`, t => {
    const h = harness(t, kind, { details: false });
    assert.equal(h.controller.element.querySelector(h.selector('proposed')), null);
    assert.deepEqual(h.counts(), { queries: 0, writes: 0 });
  });

  test(`${kind}: exact Current/Proposed snapshots retain drafts and selections across a read-only return`, async t => {
    const h = harness(t, kind); h.controller.afterMount(); await flush();
    const state = h.controller.getState(); state.feedback = 'Keep the frame and move the glow.';
    if (kind === 'assembly') { state.previewSide = 'current'; state.selection = { stateId: 'ready', variantId: 'copper' }; }
    else { state.side = 'current'; state.elapsedMs = 237; }
    h.controller.reconcileContext();
    const before = structuredClone(state), counts = h.counts();
    for (const side of ['current', 'proposed']) {
      const control = h.controller.element.querySelector(h.selector(side)); control.focus(); h.click(control);
      const detail = h.calls.at(-1);
      assert.equal(detail.side, side); assert.equal(detail.record.name, side === 'current' ? 'Saved display' : 'Proposed display');
      assert.equal(detail.projectId, projectId); assert.equal(detail.projectRevision, 9); assert.equal(detail.proposalId, `proposal.${kind}`); assert.equal(detail.proposalVersion, 4);
      assert.notEqual(detail.record, side === 'current' ? state.currentAsset : state.proposal.content);
      detail.record.name = 'A detail consumer cannot edit the retained draft';
      h.returnToReview();
      // The route host restores the initiating key after the controller remounts.
      h.controller.element.querySelector(h.selector(side)).focus();
      assert.equal(h.document.activeElement.dataset[`${kind}ReviewFocus`], `details:${side}`);
      assert.deepEqual(state, before); assert.deepEqual(h.counts(), counts);
    }
  });

  test(`${kind}: failed preview still permits metadata inspection; missing Current has no substitute`, async t => {
    const h = harness(t, kind, { missingCurrent: true, failPreview: true }); h.controller.afterMount(); await flush();
    assert.equal(h.controller.element.querySelector(h.selector('current')).disabled, true);
    const proposed = h.controller.element.querySelector(h.selector('proposed')); assert.equal(proposed.disabled, false); h.click(proposed);
    assert.equal(h.calls.length, 1); assert.equal(h.calls[0].side, 'proposed'); assert.equal(h.calls[0].record.name, 'Proposed display'); assert.equal(h.counts().writes, 0);
  });

  test(`${kind}: stale metadata remains inspectable but wrong project and unavailable read capability block Details`, t => {
    const h = harness(t, kind); h.current.projectRevision += 1;
    h.setMutable(false); h.controller.reconcileContext();
    let control = h.controller.element.querySelector(h.selector('proposed')); assert.equal(control.disabled, false); h.click(control); assert.equal(h.calls.length, 1); h.returnToReview();
    for (const unavailable of ['capability', 'project']) {
      if (unavailable === 'capability') h.setReadable(false); else { h.setReadable(true); h.current.projectId = 'project.other'; }
      h.controller.reconcileContext(); control = h.controller.element.querySelector(h.selector('proposed')); assert.equal(control.disabled, true);
      control.disabled = false; h.click(control); assert.equal(h.calls.length, 1, 'The handler rechecks current capability and project rather than trusting old DOM');
    }
    assert.equal(h.counts().writes, 0);
  });

  test(`${kind}: Details cannot hide or replace an uncertain exact decision`, async t => {
    const h = harness(t, kind), state = h.controller.getState(); state.feedback = 'Please correct the display.';
    const action = h.controller.element.querySelector(`[data-${kind}-review-action="REQUEST_CHANGES"]`); h.click(action);
    assert.equal(state.status, 'saving');
    let details = h.controller.element.querySelector(h.selector('proposed')); assert.equal(details.disabled, true); details.disabled = false; h.click(details); assert.equal(h.calls.length, 0);
    await flush(); assert.equal(state.status, 'uncertain');
    const intent = state.intent, serialized = intent.serialized;
    details = h.controller.element.querySelector(h.selector('proposed')); assert.equal(details.disabled, true); details.disabled = false; h.click(details);
    assert.equal(h.calls.length, 0); assert.equal(h.controller.requestLeave(), false); assert.equal(state.intent, intent); assert.equal(state.intent.serialized, serialized); assert.equal(h.counts().writes, 1);
  });

  test(`${kind}: completed review details remain read-only and expose no new review decision`, t => {
    const h = harness(t, kind), state = h.controller.getState(); state.proposal.status = 'ACCEPTED'; h.current.proposal.status = 'ACCEPTED'; state.status = 'done'; h.controller.reconcileContext();
    const inspect = h.controller.element.querySelector(h.selector('proposed')); assert.equal(inspect.disabled, false); h.click(inspect);
    assert.equal(h.calls.length, 1); assert.equal(h.counts().writes, 0);
  });
}

test('Animation inspection suspends time and resumes the same playing phase on return', async t => {
  const h = harness(t, 'animation'); h.controller.afterMount(); await flush();
  const state = h.controller.getState(); h.click(h.controller.element.querySelector('[data-animation-review-action="play"]'));
  h.tick(100); h.tick(180); assert.equal(state.elapsedMs, 80);
  h.click(h.controller.element.querySelector(h.selector('current'))); assert.equal(state.playing, true); assert.equal(h.frames.size, 0);
  h.tick(5000); assert.equal(state.elapsedMs, 80); h.returnToReview(); assert.equal(h.frames.size, 1);
  h.tick(5100); assert.equal(state.elapsedMs, 80); h.tick(5140); assert.equal(state.elapsedMs, 120);
});

test('Assembly inspection preserves animated artwork clocks and selected presentation', async t => {
  const animatedScene = { ...scene, elements: [{ componentId: 'glow', asset: { assetId: 'clip.glow', assetVersion: 1, metadataVersion: 1 }, contentKind: 'animation', clip: { ...clip, frames: [{ ...clip.frames[0], artifact: { digest: binding.digest, pixelSize: { width: 16, height: 16 } }, imageMatrix: [1, 0, 0, 1, 0, 0] }] } }] };
  const h = harness(t, 'assembly', { resolvedScene: animatedScene }); h.controller.afterMount(); await flush();
  const state = h.controller.getState(); h.click(h.controller.element.querySelector('[data-assembly-review-action="playback"]'));
  const artwork = h.controller.element.querySelector('[data-assembly-artwork]');
  const now = performance.now(); h.tick(now + 50); h.tick(now + 100);
  const before = assemblyArtworkPlayback(artwork);
  h.click(h.controller.element.querySelector(h.selector('proposed'))); assert.equal(state.previewPlaying, true); assert.equal(h.frames.size, 0);
  h.returnToReview(); assert.equal(h.controller.element.querySelector('[data-assembly-artwork]'), artwork);
  assert.deepEqual(assemblyArtworkPlayback(artwork), before);
});


test('Animation Details payload feeds the Library descriptor with chosen frame order, repeats and exact pins', t => {
  const h = harness(t, 'animation'), state = h.controller.getState();
  const first = structuredClone(clip.frames[0]), repeat = { ...structuredClone(first), frameId: 'frame.repeat', offset: { x: 20, y: -3 } };
  const second = { ...structuredClone(first), frameId: 'frame.second', slice: { sliceId: binding.sliceId, sliceVersion: 2 } };
  state.currentAsset.clip.frames = [first, repeat, second];
  state.proposal.content.clip.frames = [second, repeat, first];
  const newer = { ...binding, sliceVersion: 2, digest: 'b'.repeat(64) };
  state.bindings = [{ ...binding, projectId: 'project.foreign', digest: 'f'.repeat(64) }, newer, binding];
  state.load = 'ready'; h.controller.reconcileContext();
  for (const side of ['current', 'proposed']) {
    h.click(h.controller.element.querySelector(h.selector(side)));
    const payload = h.calls.at(-1), record = { ...payload.record, frameBindings: payload.frameBindings };
    assert.deepEqual(payload.frameBindings.map(value => value.frameId), record.clip.frames.map(frame => frame.frameId));
    assert.deepEqual(payload.frameBindings.map(value => value.sliceBinding.sliceVersion), side === 'current' ? [1, 1, 2] : [2, 1, 1]);
    assert.ok(payload.frameBindings.every(value => value.sliceBinding.projectId === projectId));
    const descriptor = libraryPreviewDescriptor({ entry: { contentKind: 'animation' }, record, projectId, proposed: side === 'proposed' });
    assert.equal(descriptor.images[0].href, `/api/projects/${projectId}/artifacts/sha256/${side === 'current' ? binding.digest : newer.digest}`);
    assert.deepEqual(descriptor.bounds, { x: -2, y: -3, width: 38, height: 22 });
    h.returnToReview();
  }
  assert.equal(h.counts().writes, 0);
});

test('Animation Details never fills a missing frame with a newer or foreign saved cut', t => {
  const h = harness(t, 'animation'), state = h.controller.getState();
  state.bindings = [{ ...binding, sliceVersion: 2 }, { ...binding, projectId: 'project.foreign' }];
  h.click(h.controller.element.querySelector(h.selector('proposed')));
  const payload = h.calls.at(-1);
  assert.deepEqual(payload.frameBindings, [{ frameId: 'frame.one', sliceBinding: null }]);
  assert.throws(() => libraryPreviewDescriptor({ entry: { contentKind: 'animation' }, record: { ...payload.record, frameBindings: payload.frameBindings }, projectId, proposed: true }), /exact saved Animation frame/);
  assert.equal(h.counts().writes, 0);
});

for (const outcome of ['ACCEPTED', 'DISCARDED']) {
  test(`cached Assembly review adopts external ${outcome} when opened from Activity and retains unsent feedback`, async t => {
    const h = harness(t, 'assembly'); h.controller.afterMount(); await flush();
    const state = h.controller.getState(); state.feedback = 'My unfinished review notes.'; state.selection = { stateId: 'ready', variantId: 'copper' }; state.previewSide = 'current';
    const oldScene = state.currentScene, reads = h.counts().queries;
    h.current.proposal = { ...structuredClone(h.current.proposal), proposalVersion: 5, status: outcome, feedback: 'Decision from another owner session.' };
    h.current.projectRevision = 10;
    if (outcome === 'ACCEPTED') h.current.asset = { ...structuredClone(h.current.asset), name: 'Saved elsewhere', assetVersion: 3 };
    // Activity and Library remount the same cached controller and reconcile its new context.
    h.mount.replaceChildren(); h.controller.reconcileContext(); h.returnToReview(); await flush();
    assert.equal(state.proposal.status, outcome); assert.equal(state.proposal.proposalVersion, 5); assert.equal(state.projectRevision, 10);
    assert.equal(state.status, 'done'); assert.equal(state.completedElsewhere, true); assert.equal(state.intent, null);
    assert.equal(state.feedback, 'My unfinished review notes.'); assert.equal(state.previewSide, 'current'); assert.deepEqual(state.selection, { stateId: 'ready', variantId: 'copper' });
    assert.notEqual(state.currentScene, oldScene); assert.equal(state.load, 'ready'); assert.equal(h.counts().queries, reads + 2);
    assert.ok(h.controller.element.querySelector('[data-assembly-review-unsent-feedback]'));
    assert.equal(h.controller.element.querySelector('[data-assembly-review-action="ACCEPT"]'), null);
    assert.equal(h.controller.element.querySelector('[data-assembly-review-action="REQUEST_CHANGES"]'), null);
    assert.equal(h.controller.element.querySelector('[data-assembly-review-action="DISCARD"]'), null);
    assert.equal(h.controller.element.querySelector(h.selector('proposed')).disabled, false);
    assert.equal(h.counts().writes, 0);
  });
}

test('external Assembly completion cannot overwrite saving or uncertain exact decision delivery', async t => {
  const h = harness(t, 'assembly'), state = h.controller.getState(); state.feedback = 'Unconfirmed feedback';
  h.click(h.controller.element.querySelector('[data-assembly-review-action="REQUEST_CHANGES"]'));
  const intent = state.intent;
  h.current.proposal = { ...structuredClone(h.current.proposal), proposalVersion: 5, status: 'ACCEPTED' }; h.current.projectRevision = 10;
  h.controller.reconcileContext(); assert.equal(state.status, 'saving'); assert.equal(state.intent, intent); assert.equal(state.proposal.status, 'PENDING');
  await flush(); h.controller.reconcileContext();
  assert.equal(state.status, 'uncertain'); assert.equal(state.intent, intent); assert.equal(state.proposal.proposalVersion, 4); assert.equal(state.completedElsewhere, false);
  assert.equal(h.controller.element.querySelector(h.selector('proposed')).disabled, true);
  assert.equal(h.controller.requestLeave(), false);
});

test('Assembly terminal reconciliation rejects foreign identity and leaves no old preview when reads are unavailable', async t => {
  const h = harness(t, 'assembly'); h.controller.afterMount(); await flush();
  const state = h.controller.getState();
  h.current.proposal = { ...structuredClone(h.current.proposal), proposalId: 'proposal.foreign', proposalVersion: 5, status: 'ACCEPTED' };
  h.controller.reconcileContext(); assert.equal(state.proposal.status, 'PENDING');
  h.current.proposal.proposalId = state.proposal.proposalId; h.current.projectId = 'project.foreign';
  h.controller.reconcileContext(); assert.equal(state.proposal.status, 'PENDING');
  h.current.projectId = projectId; h.setReadable(false); h.controller.reconcileContext();
  assert.equal(state.proposal.status, 'ACCEPTED'); assert.equal(state.scene, null); assert.equal(state.currentScene, null);
  assert.equal(h.counts().writes, 0);
});
