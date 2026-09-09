import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { assemblyReviewIntent, assemblyProposalDiffRows, createAssemblyReviewController } from '../apps/studio-server/public/assembly-review-view.js';

const app = await readFile(new URL('../apps/studio-server/public/app.js', import.meta.url), 'utf8');
function proposal() { return { proposalId: 'proposal.a', proposalVersion: 2, status: 'PENDING', feedback: null, content: { assetId: 'assembly.a', operation: 'create', expectedAssetVersion: 0, expectedMetadataVersion: 0, name: 'Machine', kind: 'prop', metadata: { role: null, tags: [] }, assembly: {
  unitsPerPixel: 1 / 64, placementBounds: { x: 0, y: 0, width: 256, height: 256 }, anchor: { x: 128, y: 128 }, states: [{ stateId: 'idle', name: 'Idle' }], variants: [{ variantId: 'default', name: 'Default' }], defaultStateId: 'idle', defaultVariantId: 'default', blocking: { mode: 'components', regions: [] },
  components: [{ componentId: 'body', name: 'Body', asset: { assetId: 'leaf.a', assetVersion: 1, metadataVersion: 1 }, position: { x: 0, y: 0 }, rotationDegrees: 37, scale: 1, stateIds: null, variantOverrides: [] }],
} } }; }

test('Assembly inventory is combined only in Library while Room source remains native', () => {
  const currentNative = app.slice(app.indexOf('function currentAssetLibrary'), app.indexOf('function currentAssemblyLibrary'));
  assert.doesNotMatch(currentNative, /assemblyLibrary/);
  const library = app.slice(app.indexOf('function renderAssetLibrary'), app.indexOf('function currentRoomLibrary'));
  assert.match(library, /const inventory = \[\.\.\.library.assets, \.\.\.assemblies\]/);
  assert.match(library, /asset.contentKind === 'assembly' \? assemblyLibraryCard/);
  assert.match(library, /Room placement for Assemblies is not supported yet/);
  assert.match(app, /activeAssemblyEditor\?\.getState\(\).gesture \|\| activeEmbeddedAssetEditor\?\.getState\(\).gesture/);
  assert.match(app, /if \(link.dataset.workspace !== state.workspace && !mayAbandonAssetAuthoring\(\)\)/);
});

test('Assembly UI uses its independent trusted store capability and excludes remote or unknown mode', () => {
  const code = app.slice(app.indexOf('function assemblySupported'), app.indexOf('function assemblyCanMutate'));
  for (const [uiMode, assemblyAuthoringSupport, hostBindingSupport, expected] of [
    ['local', 'AVAILABLE', 'SQLITE_REQUIRED', true], ['local', 'SQLITE_REQUIRED', 'AVAILABLE', false],
    ['local', undefined, 'AVAILABLE', false], ['remote', 'AVAILABLE', 'AVAILABLE', false], ['unknown', 'AVAILABLE', 'AVAILABLE', false],
  ]) {
    assert.equal(runInNewContext(`${code}; assemblySupported()`, { state: { uiMode, assemblyAuthoringSupport, hostBindingSupport } }), expected);
  }
  assert.match(app, /state\.assemblyAuthoringSupport = agentAccess\.assemblyAuthoringSupport \?\? 'UNAVAILABLE'/);
  assert.match(app, /state\.assemblyAuthoringSupport = response\.assemblyAuthoringSupport \?\? 'UNAVAILABLE'/);
});

test('exact Assembly cache refuses stale revision and never substitutes a newer returned pin', async () => {
  const code = app.slice(app.indexOf('function assemblyReadKey'), app.indexOf('function assemblyLibraryCard'));
  const state = { project: { projectId: 'project.a', revision: 7 } }; const cache = new Map(); let requests = 0;
  const asset = { assetId: 'assembly.a', assetVersion: 1, metadataVersion: 1 };
  const base = { state, assemblyReadCache: cache, assemblySupported: () => true, AbortController, setTimeout, clearTimeout,
    api: async () => { requests += 1; return { projectId: 'project.a', revision: 8, assets: [{ ...asset, leafAssets: [], scene: {} }] }; } };
  const read = runInNewContext(`${code}; readAssemblyDetail`, base);
  await assert.rejects(read(asset), /changed/); assert.equal(requests, 1); assert.equal(cache.values().next().value.status, 'failed');
  const corrected = runInNewContext(`${code}; readAssemblyDetail`, { ...base, api: async () => ({ projectId: 'project.a', revision: 7, assets: [{ ...asset, assetVersion: 2, leafAssets: [], scene: {} }] }) });
  await assert.rejects(corrected(asset, { retry: true }), /changed/);
});

test('Assembly review intent uses exact owner semantics and strips mutable proposed content', () => {
  const intent = assemblyReviewIntent({ projectId: 'project.a', projectRevision: 7, proposal: proposal(), decision: 'REQUEST_CHANGES', feedback: ' Move the body ', idempotencyKey: 'retry.same' });
  assert.deepEqual(intent.payload, { expectedRevision: 7, idempotencyKey: 'retry.same', expectedProposalVersion: 2, decision: 'REQUEST_CHANGES', feedback: 'Move the body', confirmed: true });
  assert.equal(intent.serialized, JSON.stringify(intent.payload));
  assert.throws(() => assemblyReviewIntent({ proposal: proposal(), decision: 'REQUEST_CHANGES', feedback: ' ' }), /feedback/);
  const rows = assemblyProposalDiffRows(proposal(), null); assert.ok(rows.some(row => row[0] === 'body' && row[2].includes('leaf.a@1:1') && row[2].includes('37°')));
  assert.ok(rows.some(row => row[0] === 'Blocking')); assert.ok(rows.some(row => row[0] === 'Front-to-back order'));
});

test('unconfirmed review stays reachable when passive refresh already shows a completed proposal', () => {
  const code = app.slice(app.indexOf('function renderAssemblyReviews'), app.indexOf('function mayAbandonAssetAuthoring'));
  const p = proposal(), live = { ...p, status: 'ACCEPTED', proposalVersion: 3 };
  const state = { project: { projectId: 'project.a', revision: 8 } };
  const reviewElement = {}, controller = { getState: () => ({ projectId: 'project.a', status: 'uncertain', proposal: p }), reconcileContext() {}, element: reviewElement };
  const document = { createDocumentFragment: () => ({ children: [], append(...children) { this.children.push(...children); } }), createElement: () => ({ append() {} }) };
  const render = runInNewContext(`${code}; renderAssemblyReviews`, { state, currentAssemblyLibrary: () => ({ assets: [], proposals: [live] }), document,
    assemblyReviewControllers: new Map([['project.a:proposal.a', controller]]), sectionHeading: () => ({}), queueMicrotask() {} });
  assert.ok(render().children.includes(reviewElement), 'The exact retry remains visible until a receipt resolves delivery.');
});

test('revised pending proposal replaces a cached changes-requested view without losing an unresolved decision', () => {
  const code = app.slice(app.indexOf('function renderAssemblyReviews'), app.indexOf('function mayAbandonAssetAuthoring'));
  for (const [status, intent, shouldReplace] of [['idle', null, true], ['done', null, true], ['saving', { serialized: 'exact request' }, false], ['uncertain', { serialized: 'exact request' }, false], ['idle', { serialized: 'exact request' }, false]]) {
    const previous = { ...proposal(), status: 'CHANGES_REQUESTED' }, revised = { ...previous, status: 'PENDING', proposalVersion: previous.proposalVersion + 1 };
    const cachedState = { projectId: 'project.a', status, intent, proposal: previous }; let disposed = 0, created = 0, initial;
    const oldController = { getState: () => cachedState, dispose() { disposed += 1; }, reconcileContext() {}, element: { cached: true } };
    const controllers = new Map([['project.a:proposal.a', oldController]]), replacement = { getState: () => ({ projectId: 'project.a', status: 'idle', intent: null, proposal: revised }), reconcileContext() {}, element: { revised: true } };
    const render = runInNewContext(`${code}; renderAssemblyReviews`, {
      state: { project: { projectId: 'project.a', revision: 9 } }, currentAssemblyLibrary: () => ({ assets: [], proposals: [revised] }),
      document: { createDocumentFragment: () => ({ children: [], append(...children) { this.children.push(...children); } }) },
      assemblyReviewControllers: controllers, sectionHeading: () => ({}), queueMicrotask() {},
      assemblySupported: () => true, assemblyCanMutate: () => true, setAssetMutationPending() {}, showToast() {},
      createAssemblyReviewController(options) { created += 1; initial = options.initial; return replacement; },
    });
    const result = render();
    assert.equal(disposed, shouldReplace ? 1 : 0, status); assert.equal(created, shouldReplace ? 1 : 0, status);
    assert.equal(controllers.get('project.a:proposal.a'), shouldReplace ? replacement : oldController);
    assert.ok(result.children.includes(shouldReplace ? replacement.element : oldController.element));
    if (shouldReplace) { assert.equal(initial.proposal.status, 'PENDING'); assert.equal(initial.proposal.proposalVersion, 3); assert.equal(initial.projectRevision, 9); }
    else assert.equal(oldController.getState().intent, intent, 'The exact pending request object must remain available.');
  }
});

class Element {
  constructor() { this.dataset = {}; this.style = {}; this.listeners = {}; this.isConnected = false; this.children = []; }
  append(...children) { this.children.push(...children); } replaceChildren(...children) { this.children = children; }
  setAttribute() {} contains() { return false; } querySelectorAll() { return []; }
  addEventListener(type, fn) { this.listeners[type] = fn; }
}
const flush = () => new Promise(resolve => setImmediate(resolve));
test('uncertain review retains exact payload/key and refresh never claims a matching-content receipt', async context => {
  const prior = globalThis.document;
  globalThis.document = { createElement: () => new Element(), activeElement: null };
  context.after(() => { globalThis.document = prior; });
  const p = proposal(), current = { projectId: 'project.a', projectRevision: 7, proposal: p, asset: null }, requests = []; let pending = false, refreshes = 0, failure = true;
  const controller = createAssemblyReviewController({ initial: { ...current, currentAsset: null }, host: {
    getContext: () => current, canMutate: () => !pending, canRead: () => false, setMutationPending: value => { pending = value; }, announce() {},
    resolve: async intent => { requests.push(structuredClone(intent)); if (failure) throw new Error('Response lost'); return { projectId: 'project.a', revision: 8, value: { proposalId: p.proposalId, proposalVersion: 3, status: 'CHANGES_REQUESTED' } }; },
    refresh: async () => { refreshes += 1; current.projectRevision = 8; }, onSaved: async () => {},
  } });
  context.after(() => controller.dispose());
  const click = action => controller.element.listeners.click({ target: { closest: () => ({ disabled: false, dataset: { assemblyReviewAction: action } }) } });
  controller.getState().feedback = 'Move body'; click('REQUEST_CHANGES'); await flush();
  assert.equal(controller.getState().status, 'uncertain'); assert.equal(controller.requestLeave(), false);
  const serialized = controller.getState().intent.serialized;
  click('check'); await flush(); assert.equal(refreshes, 1); assert.equal(controller.getState().status, 'uncertain'); assert.equal(controller.getState().intent.serialized, serialized);
  failure = false; click('retry'); await flush();
  assert.equal(controller.getState().status, 'done'); assert.equal(controller.getState().intent, null); assert.equal(requests.length, 2); assert.equal(requests[0].serialized, requests[1].serialized);
});
