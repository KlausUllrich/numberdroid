import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { createLibraryUiState, libraryAssetPin, libraryNavigate, libraryBack, libraryRouteKey } from '../apps/studio-server/public/library-state.js';
import { createLibraryPreviewDocument } from '../apps/studio-server/public/library-detail-view.js';

const app = (await readFile(new URL('../apps/studio-server/public/app.js', import.meta.url), 'utf8')).replace(/\r\n?/g, '\n');
function section(start, end) {
  const first = app.indexOf(start), last = app.indexOf(end, first + start.length);
  assert(first >= 0 && last > first, `Production function boundaries are missing: ${start}`);
  return app.slice(first, last);
}
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const flush = () => new Promise(resolve => setImmediate(resolve));
const projectId = 'project.library-race';
const asset = (index = 0) => ({ assetId: `asset.${index}`, assetVersion: 1, metadataVersion: 1, name: `Image ${index}`, kind: 'prop', metadata: {},
  sliceBinding: { projectId, sliceId: `slice.${index}`, sliceVersion: 1, digest: 'a'.repeat(64), mediaType: 'image/png', width: 16, height: 24 } });
const entry = index => ({ contentKind: 'image', asset: asset(index), pin: libraryAssetPin(asset(index)), key: `image:asset.${index}` });

function editorHarness(kind) {
  const read = deferred(), ui = createLibraryUiState(projectId), saved = { ...asset(), contentKind: kind, leafAssets: [] };
  libraryNavigate(ui, { view: 'detail', pin: libraryAssetPin(saved, kind) });
  const opens = [], renders = [], mounted = [];
  const makeController = initial => { const controller = { element: { kind }, afterMount() {}, dispose() {} }; opens.push({ initial, controller }); return controller; };
  const context = {
    state: { workspace: 'assets', project: { projectId, revision: 5, snapshot: {} }, assetMutationPending: false },
    libraryUi: ui, libraryReadGeneration: 0, animationOpenGeneration: 0, assemblyOpenGeneration: 0,
    activeAnimationEditor: null, activeAssemblyEditor: null, animationReturnContext: null, assemblyEditorReturnContext: null,
    libraryExternalOrigins: new Map(), libraryBack, libraryNavigate, libraryRouteKey,
    libraryRouteIdentity: () => `${projectId}:${libraryRouteKey(ui.route)}`,
    libraryNavigationAllowed: () => true, libraryHasEditor: () => false,
    libraryDomSnapshot: () => ({ projectId, workspace: 'assets', page: { x: 0, y: 100 } }),
    libraryOrigin: () => ({ route: structuredClone(ui.route) }), captureLibraryDom() {}, captureAssetDomState() {},
    libraryRestoreCurrent() {}, restoreLibrarySnapshot() {}, cancelPinnedAssetsOnWorkspaceExit() {},
    renderWorkspace: () => renders.push(structuredClone(ui.route)),
    window: { scrollX: 0, scrollY: 100, confirm: () => true }, history: { replaceState() {} },
    elements: { toast: { textContent: '', classList: { remove() {} } }, 'workspace-content': { dataset: { libraryRoute: `${projectId}:${libraryRouteKey(ui.route)}` }, replaceChildren: value => mounted.push(value) } },
    animationCanMutate: () => true, assemblyCanMutate: () => true, mayAbandonAssetAuthoring: () => true,
    readAnimationDetail: () => read.promise, readAssemblyDetail: () => read.promise, resolveAnimationCuts: async () => [],
    createAnimationEditorController: ({ initial }) => makeController(initial), createAssemblyEditorController: ({ initial }) => makeController(initial),
    currentAssetLibrary: () => ({ assets: [] }), currentClipLibrary: () => ({ assets: [] }),
    setAssetMutationPending() {}, showToast() {}, structuredClone, AbortSignal,
  };
  const openCode = kind === 'animation'
    ? section('async function openAnimationEditor(', 'function renderAnimationReviews(')
    : section('async function openAssemblyEditor(', 'function renderAssemblyReviews(');
  const navigation = section('function goLibrary(', 'function libraryAllGroups(');
  const actions = runInNewContext(`${navigation}\n${openCode}\n({open: ${kind === 'animation' ? 'openAnimationEditor' : 'openAssemblyEditor'}, back: libraryBackToPrevious, navigate: goLibrary})`, context);
  return { ...actions, context, ui, saved, read, opens, renders, mounted };
}

for (const kind of ['assembly', 'animation']) {
  for (const navigation of ['back', 'tab', 'unchanged']) {
    test(`${kind}: deferred editor read ${navigation === 'unchanged' ? 'opens on its unchanged route' : `cannot replace a later ${navigation} route`}`, async () => {
      const h = editorHarness(kind), original = structuredClone(h.ui.route);
      const opening = h.open({ asset: h.saved });
      assert.equal(h.opens.length, 0, 'The exact read remains unresolved');
      if (navigation === 'back') h.back();
      if (navigation === 'tab') h.navigate({ view: 'list', tab: 'pending' });
      const destination = structuredClone(h.ui.route);
      assert.equal(h.context.state.workspace, 'assets', 'Workspace identity alone cannot detect this race');
      h.read.resolve(h.saved); await opening;
      assert.deepEqual(h.ui.route, destination);
      assert.equal(h.opens.length, navigation === 'unchanged' ? 1 : 0);
      if (navigation === 'unchanged') {
        assert.deepEqual(h.ui.route, original);
        assert.equal(h.opens[0].initial.asset, h.saved);
        h.opens[0].controller.dispose();
      } else {
        assert.equal(h.mounted.length, 0);
        assert.equal(h.context.activeAnimationEditor, null); assert.equal(h.context.activeAssemblyEditor, null);
      }
    });
  }
}

function cacheHarness(t, extra = {}) {
  const links = [], records = new Map(), retired = new Set();
  const context = {
    state: { project: { projectId, revision: 5 }, workspace: 'assets' }, libraryUi: createLibraryUiState(projectId),
    libraryPreviewRecords: records, libraryRetiredPreviewUrls: retired, libraryDetails: new Map(),
    libraryCardObservers: new Set(), libraryNativeContexts: new Map(), libraryExternalOrigins: new Map(), libraryReadGeneration: 0,
    sharedReviewControllers: new Map(), legacyReviewFallbacks: new Map(),
    elements: { 'workspace-content': { querySelectorAll: () => links } },
    location: { origin: 'http://127.0.0.1:4321' }, URL, Blob, structuredClone, createLibraryPreviewDocument,
    queueLibraryRender() {}, ...extra,
  };
  const code = section('function libraryReleasePreviewUrl(', 'function queueLibraryRender(')
    + section('function libraryLoadPreview(', 'function libraryCompactCard(');
  const actions = runInNewContext(`${code}\n({load: libraryLoadPreview, collect: libraryCollectPreviewUrls, clear: libraryClearReads, key: libraryPreviewKey})`, context);
  t.after(() => { links.length = 0; actions.clear(); assert.equal(records.size, 0); assert.equal(retired.size, 0); });
  return { ...actions, links, records, retired, context };
}

test('evicting an 81st preview preserves a real Blob URL held by a mounted anchor until it is unmounted', async t => {
  const h = cacheHarness(t), first = h.load(entry(0)); await first.promise;
  assert.equal(first.status, 'ready'); h.links.push({ href: first.url });
  for (let index = 1; index <= 80; index += 1) await h.load(entry(index)).promise;
  assert.equal(h.records.size, 80);
  assert.equal(h.records.has(h.key(entry(0))), false);
  assert(h.retired.has(first.url));
  assert.match(await (await fetch(first.url)).text(), /Image 0/);
  h.collect(); assert.match(await (await fetch(first.url)).text(), /Image 0/, 'Collection cannot invalidate a mounted preview');
  h.links.length = 0; h.collect();
  assert.equal(h.retired.has(first.url), false);
  await assert.rejects(fetch(first.url), /fetch failed/);
});

test('persistent card observation retries a failed exact read when the same card reenters the viewport', async t => {
  let reads = 0, observer, currentLink = null;
  const card = { isConnected: true, querySelector: () => currentLink };
  const makeLink = href => ({ href, contains: () => false, focus() {}, replaceWith(next) { currentLink = next; } });
  currentLink = makeLink(null);
  const record = asset(), h = cacheHarness(t, {
    readAssemblyDetail: async () => { if (++reads === 1) throw new Error('Temporary exact read failure'); return record; },
    createLibraryPreviewDocument: () => '<!doctype html><title>Exact saved composition</title>',
    document: { activeElement: null }, queueMicrotask,
    renderLibraryCard: ({ previewUrl }) => previewUrl ? { querySelector: () => makeLink(previewUrl) } : card,
    IntersectionObserver: class {
      constructor(callback) { this.callback = callback; observer = this; }
      observe() {}
      disconnect() {}
    },
  });
  const render = runInNewContext(`${section('function libraryCompactCard(', 'function libraryBoundDetails(')}\nlibraryCompactCard`, {
    ...h.context, libraryPreviewKey: h.key, libraryLoadPreview: h.load,
  });
  const typed = { ...entry(0), contentKind: 'assembly' };
  render(typed); await flush();
  observer.callback([{ isIntersecting: true }]); await flush();
  assert.equal(reads, 1); assert.equal(h.records.get(h.key(typed)).status, 'failed');
  observer.callback([{ isIntersecting: false }]); observer.callback([{ isIntersecting: true }]); await flush();
  assert.equal(reads, 2, 'Viewport reentry must retry the failed cache record');
  assert.equal(h.records.get(h.key(typed)).status, 'ready');
  assert.match(await (await fetch(currentLink.href)).text(), /Exact saved composition/);
  card.isConnected = false; observer.callback([{ isIntersecting: false }]);
});


test('Library cache cleanup retains an unresolved Review until its controller permits disposal', t => {
  let reconciled = false; const controllers = new Map([['pending-review', { dispose: () => reconciled }]]);
  const h = cacheHarness(t, { sharedReviewControllers: controllers });
  h.clear(); assert.equal(controllers.has('pending-review'), true);
  reconciled = true; h.clear(); assert.equal(controllers.size, 0);
});
