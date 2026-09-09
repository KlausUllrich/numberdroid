import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import * as editorState from '../apps/studio-server/public/asset-editor-state.js';

const appUrl = new URL('../apps/studio-server/public/app.js', import.meta.url);
const stylesUrl = new URL('../apps/studio-server/public/styles.css', import.meta.url);

test('2C Asset Library is additive, ordinal-first, filterable, and keeps exact safe preview provenance', async () => {
  const app = await readFile(appUrl, 'utf8');
  const assetRenderer = app.slice(
    app.indexOf('function renderV2AssetCard'),
    app.indexOf('function renderActivityWorkspace'),
  );
  assert.match(assetRenderer, /article\.className = 'card asset-card asset-v2-card'/);
  assert.match(assetRenderer, /article\.dataset\.assetId = asset\.assetId/);
  assert.match(app, /label: savedSliceLabel\(match\?\.slice \?\? binding, match\?\.ordinal\)/);
  assert.match(assetRenderer, /Canonical slice ID/);
  assert.match(app, /button\.dataset\.copyCanonical = value/);
  assert.match(assetRenderer, /Search name, ID, or tag/);
  assert.match(assetRenderer, /placementSummary\(asset\.metadata\)/);
  assert.match(assetRenderer, /connectivitySummary\(asset\.metadata\)/);
  assert.match(assetRenderer, /collisionSummary\(asset\.metadata\)/);
  assert.match(assetRenderer, /findingSummary\(asset\.findings\)/);
  assert.match(assetRenderer, /committed r/);
  assert.match(assetRenderer, /sha256:/);
  assert.match(assetRenderer, /Legacy asset inventory/);
  assert.match(assetRenderer, /renderCollection\(snapshot\.assets, 'assets'\)/);

  const safePreview = app.slice(app.indexOf('function safeV2Preview'), app.indexOf('function compactValues'));
  assert.match(safePreview, /encodeURIComponent\(projectId\)/);
  assert.match(safePreview, /\^\[a-f0-9\]\{64\}\$/);
  assert.match(safePreview, /declared\.resourceUri\.startsWith\(safeProjectPrefix\)/);
  assert.match(safePreview, /asset\?\.sliceBinding\?\.digest/);
  assert.doesNotMatch(safePreview, /artifactUri/);

  assert.doesNotMatch(app, /api\/projects\/\$\{encodeURIComponent\(projectId\)\}\/assets`/);
});

test('2C proposal review exposes complete decisions, rejection reasons, accepted-subset apply, and stable evidence hooks', async () => {
  const app = await readFile(appUrl, 'utf8');
  assert.match(app, /section\.dataset\.assetProposal = proposal\.proposalId/);
  assert.match(app, /section\.dataset\.proposalState = proposal\.state/);
  assert.match(app, /article\.dataset\.proposalItem = item\.itemId/);
  assert.match(app, /article\.dataset\.proposalRejectionReason/);
  assert.match(app, /Deterministic findings/);
  assert.match(app, /proposalDiffRows\(item\)/);
  assert.match(app, /A rejection reason is required for/);
  assert.match(app, /Record complete decision/);
  assert.match(app, /Apply accepted subset \(\$\{accepted\}\)/);
  assert.match(app, /Rejected items create no assets/);
  assert.match(app, /expectedProposalVersion: proposal\.proposalVersion/);
  assert.match(app, /decisions,/);
  assert.match(app, /confirm: true/);
  assert.match(app, /\/asset-proposals\/\$\{encodeURIComponent\(target\)\}\/decision/);
  assert.match(app, /\/asset-proposals\/\$\{encodeURIComponent\(target\)\}\/apply/);
  assert.match(app, /response\.projectId !== operationProjectId \|\| response\.revision !== operationRevision \+ 1/);
});

test('2C passive refresh retains dirty decision state, focus, selection, local/page scroll, and one poll owner', async () => {
  const app = await readFile(appUrl, 'utf8');
  const capture = app.slice(app.indexOf('function captureAssetDomState'), app.indexOf('function restoreAssetDomState'));
  const restore = app.slice(app.indexOf('function restoreAssetDomState'), app.indexOf('function sourcePreview'));
  assert.match(capture, /selectionStart/);
  assert.match(capture, /selectionEnd/);
  assert.match(capture, /scrollLeft/);
  assert.match(capture, /scrollTop/);
  assert.match(capture, /window\.scrollX/);
  assert.match(capture, /window\.scrollY/);
  assert.match(restore, /focus\(\{ preventScroll: true \}\)/);
  assert.match(restore, /setSelectionRange/);
  assert.match(restore, /window\.scrollTo/);
  assert.match(app, /preserveAssetDraft = preserveCutterDraft && state\.workspace === 'assets'/);
  assert.match(app, /Proposal changed from .*Your local draft was retained but cannot be submitted/);
  assert.match(app, /state\.assetUi\.dirty/);
  assert.match(app, /projectLoadGeneration/);
  assert.equal((app.match(/setInterval\(/g) ?? []).length, 1, 'The shell must retain one passive project poll owner.');
  assert.match(app, /document\.addEventListener\('keydown', \(event\) => \{\s+if \(cutterDrag\) return;/);
});

test('2C Asset Library remains usable at the protected 1060px layout', async () => {
  const styles = await readFile(stylesUrl, 'utf8');
  assert.match(styles, /\.asset-inventory-grid \{[^}]*overflow: auto/);
  assert.match(styles, /\.proposal-items \{[^}]*overflow: auto/);
  assert.match(styles, /\.proposal-item \{[^}]*grid-template-columns: 140px minmax\(0, 1fr\)/);
  assert.match(styles, /\.proposal-diff \{[^}]*table-layout: fixed/);
  assert.match(styles, /@media \(max-width: 1200px\)[\s\S]*\.asset-filters \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 1200px\)[\s\S]*\.proposal-item \{ grid-template-columns: 112px minmax\(0, 1fr\)/);
}
);


// Execute the actual controller with inert rendering and DOM listeners. Expose
// its private async actions only in this VM so each request can be awaited.
async function editorHarness(overrides = {}, timerLimit = null) {
  const source = await readFile(new URL('../apps/studio-server/public/asset-editor-controller.js', import.meta.url), 'utf8');
  assert.equal(source.split('return { element, afterMount()').length, 2);
  const executable = source.slice(source.indexOf('const clone ='))
    .replace('export function createAssetEditorController', 'function createAssetEditorController')
    .replace('return { element, afterMount()', 'return { save, checkOutcome, recheck, element, afterMount()');
  const element = { isConnected: false, addEventListener() {}, querySelectorAll: () => [], querySelector: () => ({}) };
  const initial = { projectId: 'project.test', projectRevision: 7, assetId: 'asset.test',
    pixelSize: { width: 40, height: 40 }, slice: { sliceId: 'slice.test', version: 1, rectangle: { name: 'My prop' } } };
  const context = { projectId: initial.projectId, projectRevision: 7, slice: initial.slice };
  const requests = [], pending = [], announcements = [], saved = []; let confirms = 0;
  const host = { getContext: () => context, setMutationPending: value => pending.push(value),
    saveAsset: async intent => { requests.push(intent); throw new Error('Connection lost'); },
    readSavedOutcome: async () => null, onSaved: async receipt => saved.push(receipt),
    announce: message => announcements.push(message), confirmDiscard: () => { confirms += 1; return true; }, ...overrides };
  const create = runInNewContext(`${executable}; createAssetEditorController;`, { ...editorState, structuredClone, crypto, AbortController,
    setTimeout: timerLimit === null ? setTimeout : (fn, ms) => setTimeout(fn, Math.min(ms, timerLimit)), clearTimeout,
    document: { activeElement: null }, window: { scrollX: 0, scrollY: 0, addEventListener() {} }, requestAnimationFrame() {},
    createAssetEditorView: () => element, updateAssetEditorView() {}, syncAssetEditorCanvas() {},
    ResizeObserver: class { observe() {} disconnect() {} },
  });
  return { controller: create({ initial, host }), context, requests, pending, announcements, saved, confirms: () => confirms };
}
const receiptFor = intent => ({ projectId: intent.projectId, revision: intent.payload.expectedRevision + 1,
  value: { assetId: intent.assetId, assetVersion: intent.payload.expectedAssetVersion + 1, metadataVersion: 1 } });

test('direct Asset Save locks an in-flight request and creates one confirmed draft version', async () => {
  let complete; const requests = [];
  const h = await editorHarness({ saveAsset: intent => { requests.push(intent); return new Promise(resolve => { complete = resolve; }); } });
  const saving = h.controller.save();
  assert.equal(h.controller.getState().save.status, 'saving');
  assert.equal(h.controller.requestLeave(), false); assert.equal(h.confirms(), 0);
  await h.controller.save(); await h.controller.save(true); assert.equal(requests.length, 1);
  const intent = requests[0]; assert.equal(intent.payload.operation, 'create');
  assert.equal(intent.payload.image.mode, 'saved-slice'); assert.equal(intent.payload.metadata.placement.confirmation, 'confirmed');
  complete(receiptFor(intent)); await saving;
  const state = h.controller.getState();
  assert.equal(state.context.assetVersion, 1); assert.equal(state.context.projectRevision, 8);
  assert.equal(state.save.status, 'idle'); assert.equal(state.save.intent, null);
  assert.equal(editorState.assetEditorDirty(state), false); assert.equal(h.saved.length, 1);
  assert.deepEqual(h.pending, [true, false]); h.controller.dispose();
});

test('leaving a dirty Asset editor requires confirmation while uncertain Save cannot be abandoned', async () => {
  const h = await editorHarness();
  assert.equal(h.controller.requestLeave(), true); assert.equal(h.confirms(), 0);
  // A failed Save retains its intent even when the original model was clean.
  await h.controller.save(); const intent = h.controller.getState().save.intent;
  assert.equal(h.controller.requestLeave(), false); assert.equal(h.confirms(), 0);
  assert.match(h.announcements.at(-1), /pending save/);
  assert.deepEqual(h.controller.getState().save.intent, intent); h.controller.dispose();
  // Isolate the same requestLeave closure with a real dirty editor state.
  const source = await readFile(new URL('../apps/studio-server/public/asset-editor-controller.js', import.meta.url), 'utf8');
  const leaveSource = source.slice(source.indexOf('  function requestLeave()'), source.indexOf('  async function click('));
  const state = editorState.createAssetEditorState({ projectId: 'p', projectRevision: 1, assetId: 'a', pixelSize: { width: 40, height: 40 }, slice: { sliceId: 's', version: 1 } });
  state.model.name = 'Unsaved purpose'; let accepted = false; let confirmations = 0;
  const leave = runInNewContext(`${leaveSource}; requestLeave;`, { state, locked: () => false, assetEditorDirty: editorState.assetEditorDirty,
    host: { confirmDiscard(message) { assert.match(message, /Discard these unsaved Asset edits/); confirmations += 1; return accepted; } } });
  assert.equal(leave(), false); assert.equal(state.model.name, 'Unsaved purpose');
  accepted = true; assert.equal(leave(), true); assert.equal(confirmations, 2);
});

test('direct Save refuses receipts with different project, revision, Asset or version identity', async () => {
  for (const mutate of [r => { r.projectId = 'other'; }, r => { r.revision += 1; }, r => { r.value.assetId = 'other'; },
    r => { r.value.assetVersion += 1; }, r => { r.value.metadataVersion = 0; }, r => { r.value.metadataVersion = 1.5; }]) {
    const h = await editorHarness({ saveAsset: async intent => { const receipt = receiptFor(intent); mutate(receipt); return receipt; } });
    await h.controller.save(); const state = h.controller.getState();
    assert.equal(state.save.status, 'uncertain'); assert(state.save.intent); assert.equal(state.context.assetVersion, 0);
    assert.equal(h.saved.length, 0); assert.equal(h.controller.requestLeave(), false); h.controller.dispose();
  }
});

test('saved slices open the human Asset library before a first semantic asset exists', async () => {
  const app = await readFile(appUrl, 'utf8');
  const start = app.indexOf("else if (state.workspace === 'assets') content =");
  const selection = app.slice(start + 'else '.length, app.indexOf("else if (state.workspace === 'rooms')", start));
  for (const [savedSliceCount, expected] of [[4, 'human-library'], [0, 'legacy-library']]) {
    const result = runInNewContext(`let content; ${selection}; content;`, {
      state: { workspace: 'assets', assetAuthoring: null }, snapshot: { assets: [] },
      currentProjectSlices: () => Array.from({ length: savedSliceCount }),
      renderAssetLibrary: () => 'human-library', renderCollection: () => 'legacy-library',
    });
    assert.equal(result, expected);
  }
});


test('uncertain direct Save retains identical bytes and key after rejected retry and failed outcome check', async () => {
  const requests = []; let attempts = 0;
  const h = await editorHarness({ saveAsset: async intent => { requests.push(intent); attempts += 1;
    if (attempts === 3) return receiptFor(intent);
    const error = new Error('Unavailable'); if (attempts === 2) error.status = 403; throw error; },
    readSavedOutcome: async () => { throw new Error('GET failed'); } });
  await h.controller.save(); const intent = h.controller.getState().save.intent;
  await h.controller.save(true); await h.controller.checkOutcome();
  assert.equal(h.controller.getState().save.status, 'uncertain');
  assert.deepEqual(h.controller.getState().save.intent, intent); assert.equal(h.controller.requestLeave(), false);
  assert.equal(requests[0], requests[1]); assert.equal(requests[0].serialized, requests[1].serialized);
  assert.equal(requests[0].payload.idempotencyKey, requests[1].payload.idempotencyKey);
  await h.controller.save(true); assert.equal(requests[2], requests[0]);
  assert.equal(h.controller.getState().save.status, 'idle'); assert.equal(h.controller.getState().context.assetVersion, 1);
  assert.deepEqual(h.pending, [true, false, true, false, true, false, true, false]); h.controller.dispose();
});

test('outcome checks are bounded and matching visible content never confirms delivery', async () => {
  let signal;
  const h = await editorHarness({ readSavedOutcome: (_intent, options) => { signal = options.signal;
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })); } }, 10);
  await h.controller.save(); const intent = h.controller.getState().save.intent;
  await h.controller.checkOutcome(); assert.equal(signal.aborted, true);
  assert.equal(h.controller.getState().save.status, 'uncertain'); assert.deepEqual(h.controller.getState().save.intent, intent);
  h.controller.dispose();
  const matching = await editorHarness({ readSavedOutcome: async intent => receiptFor(intent) });
  await matching.controller.save(); await matching.controller.checkOutcome();
  assert.equal(matching.controller.getState().save.status, 'uncertain'); assert.equal(matching.saved.length, 0);
  assert.match(matching.controller.getState().error, /matching visible content alone cannot confirm delivery/); matching.controller.dispose();
});

test('disposed Asset editors abort requests and ignore late Save and outcome responses', async () => {
  for (const action of ['save', 'checkOutcome']) {
    let complete, signal;
    const deferred = (_intent, options) => { signal = options.signal; return new Promise(resolve => { complete = resolve; }); };
    const h = await editorHarness(action === 'save' ? { saveAsset: deferred } : { readSavedOutcome: deferred });
    if (action === 'checkOutcome') await h.controller.save();
    const pending = h.controller[action](); const state = h.controller.getState(); h.controller.dispose();
    assert.equal(signal.aborted, true); complete(receiptFor(state.save.intent)); await pending;
    assert.deepEqual(h.controller.getState(), state); assert.equal(h.saved.length, 0);
    assert.equal(h.pending.at(-1), false);
  }
});

test('loadProject discards a late aborted project response before applying shared UI state', async () => {
  const app = await readFile(appUrl, 'utf8');
  const source = app.slice(app.indexOf('async function loadProject(projectId,'), app.indexOf('async function requestAgentAccess('));
  const original = { projectId: 'project.test', revision: 7 };
  const state = { project: original, workspace: 'overview', uiMode: 'local' }; const controller = new AbortController();
  let resolveProject; const signals = [];
  const load = runInNewContext(`let projectLoadGeneration = 0; ${source}; loadProject;`, { state,
    elements: { 'project-select': { value: 'project.test' }, 'workspace-content': { dataset: {} } }, cancelTaskAdoptionLoad() {},
    api(path, options) { signals.push(options.signal); return path === '/api/projects/project.test'
      ? new Promise((resolve) => { resolveProject = resolve; }) : Promise.resolve(path.endsWith('/tasks') ? { tasks: [] } : {}); },
  });
  const pending = load('project.test', { signal: controller.signal }); controller.abort();
  resolveProject({ projectId: 'project.test', revision: 8 });
  assert.equal(await pending, false); assert.equal(state.project, original);
  assert(signals.length === 5 && signals.every((signal) => signal === controller.signal));
});


test('useful preview states exact attachment independently from boundaries and preserves rotation identity', async () => {
  const app = await readFile(appUrl, 'utf8');
  const source = app.slice(app.indexOf('function usefulAssetPreview('), app.indexOf('function compactValues('));
  const element = (tag) => ({ tag, dataset: {}, attributes: {}, children: [], style: { setProperty() {} }, classList: { contains: () => true },
    append(...nodes) { this.children.push(...nodes); }, setAttribute(name, value) { this.attributes[name] = value; } });
  const state = { assetUi: { previewRotations: { 'asset.one': 90 } } };
  const render = runInNewContext(`${source}; usefulAssetPreview;`, { state, document: { createElement: element },
    safeV2Preview: () => element('img'), rotatedPreviewGeometry: (span) => ({ ...span, rect: (value) => value, point: (value) => value }),
  });
  const flatten = (node) => [node, ...(node.children ?? []).flatMap(flatten)];
  for (const [attachment, expected] of [['ceiling', 'Attaches to a ceiling'], ['free', 'Free placement'], ['wall', 'Attaches to a wall'], ['ground', 'Attaches to ground']]) {
    const nodes = flatten(render({ assetId: 'asset.one', metadata: { attachment, rotationPolicy: 'cardinal', placement: { wallSafe: true } } }));
    const facts = nodes.filter(({ tag }) => tag === 'li').map(({ textContent }) => textContent);
    assert(facts.includes(expected)); assert(facts.includes('May touch room boundaries'));
    if (attachment !== 'ground') assert(!facts.some((fact) => /ground placement|Attaches to ground/.test(fact)));
    const buttons = nodes.filter(({ tag }) => tag === 'button');
    assert.equal(new Set(buttons.map(({ dataset }) => dataset.assetFocusKey)).size, 4);
    assert.deepEqual(buttons.filter(({ attributes }) => attributes['aria-pressed'] === 'true').map(({ dataset }) => dataset.assetPreviewRotation), ['90']);
    assert(buttons.every(({ dataset }) => dataset.assetFocusKey === `preview-rotation-asset.one-${dataset.assetPreviewRotation}`));
    const second = flatten(render({ assetId: 'asset.two', metadata: { attachment, rotationPolicy: 'cardinal' } }));
    assert(second.filter(({ tag }) => tag === 'button').every(({ dataset }) => !buttons.some((button) => button.dataset.assetFocusKey === dataset.assetFocusKey)));
  }
});
