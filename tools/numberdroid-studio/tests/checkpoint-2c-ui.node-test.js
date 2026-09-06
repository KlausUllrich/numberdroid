import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { createAssetAuthoringDraft, buildAssetAuthoringRequest } from '../apps/studio-server/public/asset-authoring-state.js';

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
  assert.match(app, /label: match \? `Slice \$\{match\.ordinal\}` : 'Pinned historical slice'/);
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


test('human Asset form keeps explicit editable choices and locks a submitted request', async () => {
  const app = await readFile(appUrl, 'utf8');
  const source = app.slice(app.indexOf('function renderAssetAuthoring()'), app.indexOf('function assetAuthoringSavedProposal'));
  const makeElement = (tag = 'section') => ({ tag, dataset: {}, children: [], append(...children) { this.children.push(...children); }, setAttribute(name, value) { this[name] = value; } });
  const draft = createAssetAuthoringDraft({ projectId: 'project.test', projectRevision: 7, sliceId: 'slice.test', sliceVersion: 1,
    proposalId: 'proposal.test', itemId: 'item.test', assetId: 'asset.test', idempotencyKey: 'key.test' });
  draft.values.name = 'My prop'; draft.values.role = 'furniture';
  const state = { assetAuthoring: { draft, request: null, pinned: {} }, assetMutationPending: false };
  const render = runInNewContext(`${source}; renderAssetAuthoring;`, { state, document: { createElement: makeElement },
    sectionHeading: makeElement, currentAssetAuthoringConflict: () => null, assetAuthoringPreview: makeElement });
  const flatten = (node) => [node, ...(node.children ?? []).filter((child) => typeof child === 'object').flatMap(flatten)];
  let nodes = flatten(render()); let inputs = nodes.filter(({ name }) => name);
  assert.deepEqual(inputs.map(({ name }) => name).sort(), Object.keys(draft.values).sort());
  assert(inputs.every((input) => input.value === draft.values[input.name] && input.disabled === false));
  assert(nodes.some((node) => node.dataset.assetAuthoringSubmit === '' && node.textContent === 'Prepare asset for review'));
  state.assetAuthoring.request = buildAssetAuthoringRequest(draft);
  nodes = flatten(render()); inputs = nodes.filter(({ name }) => name);
  assert(inputs.every((input) => input.disabled === true));
  assert(nodes.some((node) => node.dataset.assetAuthoringRetry === ''));
  assert.equal(state.assetAuthoring.request.items[0].metadata.placement.confirmation, 'proposed');
});

test('abandoning an Asset draft asks explicitly while unknown delivery keeps its exact request', async () => {
  const app = await readFile(appUrl, 'utf8');
  const source = app.slice(app.indexOf('function mayAbandonAssetAuthoring()'), app.indexOf('function currentAssetAuthoringConflict'));
  let confirms = 0; let message = '';
  const state = { assetAuthoring: { request: {} }, assetMutationPending: false };
  const abandon = runInNewContext(`${source}; mayAbandonAssetAuthoring;`, { state,
    window: { confirm() { confirms += 1; return true; } }, showToast(value) { message = value; } });
  assert.equal(abandon(), false); assert.equal(confirms, 0); assert.match(message, /outcome is not confirmed/);
  state.assetAuthoring.request = null;
  assert.equal(abandon(), true); assert.equal(confirms, 1); assert.equal(state.assetAuthoring, null);
});

test('saved proposal recovery refuses same identity with different authored semantics', async () => {
  const app = await readFile(appUrl, 'utf8');
  const source = app.slice(app.indexOf('function canonicalAssetAuthoringJson('), app.indexOf('async function submitAssetAuthoring('));
  const draft = createAssetAuthoringDraft({ projectId: 'project.test', projectRevision: 7, sliceId: 'slice.test', sliceVersion: 1,
    proposalId: 'proposal.test', itemId: 'item.test', assetId: 'asset.test', idempotencyKey: 'key.test' });
  draft.values.name = 'My prop'; draft.values.role = 'furniture'; const request = buildAssetAuthoringRequest(draft);
  const proposal = { proposalId: request.proposalId, submittedRevision: request.expectedRevision + 1, items: structuredClone(request.items) };
  const authoring = { draft, request }; const state = { project: { projectId: 'project.test' }, assetAuthoring: authoring, assetUi: {} };
  const recover = runInNewContext(`${source}; assetAuthoringSavedProposal;`, { state, currentAssetLibrary: () => ({ proposals: [proposal] }), showToast() {} });
  proposal.items[0].metadata.spanTiles.width = 2;
  assert.equal(recover(authoring), false); assert.equal(state.assetAuthoring, authoring);
  assert.match(authoring.error, /does not match your request/);
  proposal.items = structuredClone(request.items);
  proposal.items[0].operation = 'update'; assert.equal(recover(authoring), false);
  proposal.items[0].operation = 'create'; proposal.items[0].expectedAssetVersion = 1; assert.equal(recover(authoring), false);
  proposal.items[0].expectedAssetVersion = 0; proposal.submittedRevision += 1; assert.equal(recover(authoring), false);
  proposal.submittedRevision -= 1;
  proposal.items[0].metadata.collision.bounds.x = 1; assert.equal(recover(authoring), false);
  proposal.items[0].metadata.spanTiles = { height: 1, width: 1 };
  proposal.items[0].metadata.collision = { parts: [], bounds: { height: 1, width: 1, y: 0, x: 0 }, mode: 'bounds' };
  proposal.items[0].metadata.pixelSize = { width: 40, height: 40 }; proposal.items[0].metadata.pivot = null;
  assert.equal(recover(authoring), true); assert.equal(state.assetAuthoring, null);
  assert.equal(state.assetUi.selectedProposalId, request.proposalId);
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


test('an unknown original submission stays locked after retry rejection and failed reconciliation', async () => {
  const app = await readFile(appUrl, 'utf8');
  const source = app.slice(app.indexOf('async function submitAssetAuthoring('), app.indexOf("window.addEventListener('beforeunload'"));
  const draft = createAssetAuthoringDraft({ projectId: 'project.test', projectRevision: 7, sliceId: 'slice.test', sliceVersion: 1,
    proposalId: 'proposal.test', itemId: 'item.test', assetId: 'asset.test', idempotencyKey: 'key.test' });
  draft.values.name = 'My prop'; draft.values.role = 'furniture';
  const authoring = { draft }; const state = { project: { projectId: 'project.test' }, assetAuthoring: authoring, assetMutationPending: false, agentAccessCsrf: 'csrf' };
  const bodies = []; let attempt = 0;
  const submit = runInNewContext(`${source}; submitAssetAuthoring;`, { state, AbortSignal,
    currentAssetAuthoringConflict: () => null, buildAssetAuthoringRequest, renderWorkspace() {},
    setAssetMutationPending(value) { state.assetMutationPending = value; },
    async api(_path, options) { bodies.push(options.body); attempt += 1; const error = new Error('Unavailable'); if (attempt > 1) error.status = 403; throw error; },
    async refreshAssetAuthoringOutcome() { throw new Error('GET failed'); }, assetAuthoringSavedProposal() { throw new Error('must not reconcile failed GET'); },
  });
  await submit(); const request = authoring.request; assert.equal(authoring.uncertain, true);
  await submit({ retry: true });
  assert.equal(authoring.request, request); assert.equal(bodies[0], bodies[1]);
  assert.equal(authoring.rejected, false); assert.equal(authoring.uncertain, true); assert.equal(state.assetMutationPending, false);
});

test('outcome refresh aborts a hanging read and rejects a late result owned by another draft', async () => {
  const app = await readFile(appUrl, 'utf8');
  const source = app.slice(app.indexOf('async function refreshAssetAuthoringOutcome('), app.indexOf('async function submitAssetAuthoring('));
  const authoring = { draft: { context: { projectId: 'project.test' } } };
  const state = { project: { projectId: 'project.test' }, assetAuthoring: authoring };
  let signal;
  const refresh = runInNewContext(`${source}; refreshAssetAuthoringOutcome;`, { state, AbortController, setTimeout, clearTimeout,
    loadProject(_id, options) { signal = options.signal; return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })); },
  });
  await assert.rejects(refresh(authoring, { timeoutMs: 10 }), /aborted/); assert.equal(signal.aborted, true);
  let complete;
  const later = runInNewContext(`${source}; refreshAssetAuthoringOutcome;`, { state, AbortController, setTimeout, clearTimeout,
    loadProject() { return new Promise((resolve) => { complete = resolve; }); },
  });
  const pending = later(authoring, { timeoutMs: 100 }); state.assetAuthoring = { draft: 'new draft' }; complete(true);
  await assert.rejects(pending, /project changed/); assert.equal(state.assetAuthoring.draft, 'new draft');
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
