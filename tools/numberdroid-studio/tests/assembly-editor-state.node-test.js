import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import * as editorState from '../apps/studio-server/public/assembly-editor-state.js';
import * as geometry from '../packages/domain/src/assembly-geometry.js';
import { spatialAliases } from '../packages/domain/src/asset-spatial-geometry.js';
import { createAssemblyEditorState, assemblyEditorAddComponent, assemblyEditorSnapshot, assemblyEditorRemember, assemblyEditorUndo, assemblyEditorDirty,
  assemblyEditorResolve, assemblyEditorIssues, assemblyEditorPins, assemblyEditorPreviewPin, buildAssemblyEditorSave, assemblyEditorMoveOrder,
  assemblyEditorRemoveComponent, assemblyEditorRemoveChoice, assemblyEditorContextConflict } from '../apps/studio-server/public/assembly-editor-state.js';

function leaf({ assetId = 'asset.body', assetVersion = 1, digest = 'a'.repeat(64) } = {}) {
  const spatial = { schemaVersion: 1, coordinateSpace: 'image-pixels', unitsPerPixel: { x: 1 / 64, y: 1 / 64 }, placementBounds: { x: 0, y: 0, width: 64, height: 64 }, anchor: { x: 32, y: 32 }, blockingRegions: [{ regionId: 'body', name: 'Body blocking', shape: { kind: 'rectangle', x: 10, y: 10, width: 40, height: 40 } }] };
  return { assetId, assetVersion, metadataVersion: 1, name: 'Body', kind: 'prop', metadata: { ...spatialAliases(spatial), spatial, pixelSize: { width: 64, height: 64 }, navigation: { effect: 'blocked' } },
    sliceBinding: { projectId: 'project.ui', mediaType: 'image/png', width: 64, height: 64, digest, sliceId: 'slice.body', sliceVersion: 1, sourceId: 'source.body' } };
}
function state() { const s = createAssemblyEditorState({ projectId: 'project.ui', projectRevision: 7, assetId: 'assembly.machine', instanceId: 'editor.one' }); s.model.name = 'Coffee machine'; assemblyEditorAddComponent(s, leaf(), 'component.body'); return s; }

test('new Assembly saves a typed declaration and exact immutable component reference without image fiction', () => {
  const s = state(), intent = buildAssemblyEditorSave(s, 'save.once');
  assert.equal(intent.assetId, 'assembly.machine'); assert.equal(intent.payload.operation, 'create'); assert.equal(intent.payload.expectedAssetVersion, 0);
  assert.deepEqual(intent.payload.assembly.components[0].asset, { assetId: 'asset.body', assetVersion: 1, metadataVersion: 1 });
  assert.equal('image' in intent.payload, false); assert.equal('sliceBinding' in intent.payload, false); assert.equal(intent.serialized, JSON.stringify(intent.payload));
  s.model.assembly.components[0].position.x = 17.125; s.context.projectRevision = 8;
  assert.equal(intent.payload.assembly.components[0].position.x, 0); assert.equal(intent.payload.expectedRevision, 7);
});

test('independent add, transform, front/back ordering, remove and Undo retain exact component/source identities', () => {
  const s = state(), original = structuredClone(s.assets[0]); const before = assemblyEditorSnapshot(s);
  const second = assemblyEditorAddComponent(s, leaf(), 'component.cup'); second.position = { x: 20.25, y: -15.5 }; second.rotationDegrees = 37.25; second.scale = 1.2; assemblyEditorRemember(s, before);
  assert.equal(s.model.assembly.components.length, 2); assert.equal(s.model.assembly.components[1].position.x, 0);
  assemblyEditorMoveOrder(s, 1); assert.deepEqual(s.model.assembly.components.map(c => c.componentId), ['component.body', 'component.cup']);
  const removal = assemblyEditorSnapshot(s); assemblyEditorRemoveComponent(s); assemblyEditorRemember(s, removal); assert.equal(s.model.assembly.components.length, 1);
  assert(assemblyEditorUndo(s)); assert.deepEqual(s.model.assembly.components[1].position, { x: 20.25, y: -15.5 });
  assert.equal(s.model.assembly.components[1].rotationDegrees, 37.25); assert.deepEqual(s.assets[0], original);
});

test('preview variant/state and inspection visibility never mutate authored membership, sources or saved content', () => {
  const s = state(), a = s.model.assembly, copper = leaf({ assetId: 'asset.copper', assetVersion: 2, digest: 'b'.repeat(64) }); s.assets.push(copper);
  a.states.push({ stateId: 'state.ready', name: 'Ready' }); a.variants.push({ variantId: 'variant.copper', name: 'Copper' });
  a.components[0].variantOverrides.push({ variantId: 'variant.copper', asset: { assetId: copper.assetId, assetVersion: 2, metadataVersion: 1 } });
  const cup = assemblyEditorAddComponent(s, leaf(), 'component.cup'); cup.stateIds = ['state.ready'];
  s.savedModel = structuredClone(s.model); const saved = JSON.stringify(s.model);
  s.preview.variantId = 'variant.copper'; s.hidden.push('component.body'); const idle = assemblyEditorResolve(s);
  s.preview.stateId = 'state.ready'; const ready = assemblyEditorResolve(s);
  assert.equal(idle.elements.length, 1); assert.equal(ready.elements.length, 2); assert.equal(ready.regions.length, 2, 'inspection hide never removes blocking');
  assert.equal(s.preview.variantId, 'variant.copper'); assert.equal(assemblyEditorPreviewPin(a.components.find(c => c.componentId === 'component.body'), s.preview.variantId).assetVersion, 2);
  assert.equal(JSON.stringify(s.model), saved); assert.equal(assemblyEditorDirty(s), false);
});

test('a newer leaf head never silently replaces a saved old pin and missing old pins block Save', () => {
  const s = state(), old = structuredClone(s.assets[0]), head = leaf({ assetVersion: 2, digest: 'c'.repeat(64) }); s.assets.push(head);
  assert.equal(assemblyEditorResolve(s).elements[0].artifact.digest, old.sliceBinding.digest); assert.equal(assemblyEditorPins(s.model.assembly).length, 1);
  s.assets = [head]; assert.throws(() => buildAssemblyEditorSave(s, 'save.missing'), /exact saved|no latest/i);
});

test('custom unfinished geometry session survives Undo/Redo intact and prevents Save even when closed regions are valid', () => {
  const s = state(), before = assemblyEditorSnapshot(s); s.model.assembly.blocking.mode = 'custom';
  s.customDraft = { session: { polygonDraft: [{ x: 1, y: 2 }, { x: 7, y: 8 }], fieldDrafts: {}, history: { past: [{ marker: 'retain' }], future: [] }, zoom: '1.5', selectedPoint: 1, viewContexts: { edit: { scroll: { inspector: { x: 0, y: 97 } } } } }, issues: ['Close the unfinished polygon.'] };
  const retained = structuredClone(s.customDraft); assemblyEditorRemember(s, before);
  assert(assemblyEditorDirty(s)); assert.throws(() => buildAssemblyEditorSave(s, 'save.incomplete'), /unfinished polygon/);
  assert(assemblyEditorUndo(s)); assert.equal(s.customDraft, null); assert(assemblyEditorUndo(s, true)); assert.deepEqual(s.customDraft, retained);
  s.customDraft.session.polygonDraft = []; s.customDraft.issues = []; s.customDraft.session.fieldDrafts = { 'region.width': '' }; assert.throws(() => buildAssemblyEditorSave(s, 'save.numeric'), /numeric/);
});

test('all authored states are validated, including a nonpreviewed out-of-bounds component', () => {
  const s = state(); s.model.assembly.states.push({ stateId: 'state.ready', name: 'Ready' });
  const cup = assemblyEditorAddComponent(s, leaf(), 'component.cup'); cup.stateIds = ['state.ready']; cup.position.x = 800;
  assert.equal(assemblyEditorResolve(s).findings.length, 0); assert(assemblyEditorIssues(s).some(message => /bounds/.test(message))); assert.throws(() => buildAssemblyEditorSave(s, 'save.invalid'), /bounds/);
});

test('removing catalog choices repairs only explicit memberships/defaults and retains every-state membership', () => {
  const s = state(), a = s.model.assembly; a.states.push({ stateId: 'state.ready', name: 'Ready' }); a.variants.push({ variantId: 'variant.copper', name: 'Copper' });
  const c = assemblyEditorAddComponent(s, leaf(), 'component.cup'); c.stateIds = ['state.ready']; c.variantOverrides = [{ variantId: 'variant.copper', asset: structuredClone(c.asset) }];
  a.defaultStateId = 'state.ready'; s.preview.stateId = 'state.ready'; assemblyEditorRemoveChoice(s, 'state', 'state.ready'); assemblyEditorRemoveChoice(s, 'variant', 'variant.copper');
  assert.deepEqual(c.stateIds, []); assert.deepEqual(c.variantOverrides, []); assert.equal(a.components[1].stateIds, null); assert.equal(a.defaultStateId, 'state.idle'); assert.equal(s.preview.stateId, 'state.idle');
  assert.throws(() => assemblyEditorRemoveChoice(s, 'state', 'state.idle'), /at least one/);
});

test('raw numeric fields, project conflicts and unsupported component media fail without discarding drafts', () => {
  const s = state(); s.fieldDrafts['position.x:'] = ''; assert.throws(() => buildAssemblyEditorSave(s, 'save.raw'), /numeric/); assert.equal(s.model.assembly.components[0].position.x, 0);
  const c = { projectId: 'project.ui', projectRevision: 7 }; assert.equal(assemblyEditorContextConflict(s, c), null); assert.match(assemblyEditorContextConflict(s, { ...c, projectRevision: 8 }), /project changed/);
  assert.match(assemblyEditorContextConflict(s, { ...c, projectId: 'other' }), /selected project/);
  const webp = leaf(); webp.sliceBinding.mediaType = 'image/webp'; assert.throws(() => assemblyEditorAddComponent(s, webp), /PNG/);
});

// Exercise production request/session behavior with inert rendering. Native browser
// integration supplies the separate DOM/drag/appearance evidence.
async function harness(overrides = {}) {
  const source = await readFile(new URL('../apps/studio-server/public/assembly-editor-controller.js', import.meta.url), 'utf8');
  const entry = 'return { element,\n    afterMount()'; assert.equal(source.split(entry).length, 2);
  const executable = source.slice(source.indexOf('const copy =')).replace('export function createAssemblyEditorController', 'function createAssemblyEditorController')
    .replace(entry, 'return { save, checkOutcome, editCustomGeometry, resolveReferences, testState: state, element,\n    afterMount()');
  const s = state(), initial = { ...s.context, assets: s.assets, asset: { assetId: s.context.assetId, assetVersion: 0, metadataVersion: 0, ...s.model } };
  const context = { projectId: s.context.projectId, projectRevision: 7 }, pending = [], requests = [], saved = [];
  const host = { getContext: () => context, getNativeAssets: () => s.assets, setMutationPending: value => pending.push(value),
    saveAssembly: async intent => { requests.push(intent); throw new Error('Connection lost'); }, readSavedOutcome: async () => null,
    onSaved: async receipt => saved.push(receipt), announce() {}, confirmDiscard: () => true, ...overrides };
  const element = { isConnected: false, addEventListener() {}, querySelectorAll: () => [], querySelector: () => ({}) };
  const create = runInNewContext(`${executable}; createAssemblyEditorController;`, { ...editorState, ...geometry, structuredClone, crypto, AbortController,
    setTimeout, clearTimeout, document: { activeElement: null }, window: { scrollX: 0, scrollY: 0, addEventListener() {} }, requestAnimationFrame() {},
    createAssemblyEditorView: () => element, updateAssemblyEditorView() {}, syncAssemblyEditorCanvas() {},
    ResizeObserver: class { observe() {} disconnect() {} },
  });
  return { controller: create({ initial, host }), context, pending, requests, saved };
}
const receipt = intent => ({ projectId: intent.projectId, revision: intent.payload.expectedRevision + 1,
  value: { assetId: intent.assetId, assetVersion: intent.payload.expectedAssetVersion + 1, metadataVersion: 1 } });

test('uncertain Assembly saves retain identical bytes across rejected replay and unconfirmed readback', async () => {
  const requests = []; let attempts = 0;
  const h = await harness({ saveAssembly: async intent => { requests.push(intent); if (++attempts === 3) return receipt(intent); const error = new Error('Lost response'); if (attempts === 2) error.status = 403; throw error; }, readSavedOutcome: async intent => receipt(intent) });
  await h.controller.save(); const intent = h.controller.getState().save.intent;
  assert.equal(h.controller.requestLeave(), false); await h.controller.save(true); await h.controller.checkOutcome();
  assert.equal(h.controller.getState().save.status, 'uncertain'); assert.deepEqual(h.controller.getState().save.intent, intent); assert.equal(h.saved.length, 0);
  assert.equal(requests[0], requests[1]); assert.equal(requests[0].serialized, requests[1].serialized);
  await h.controller.save(true); assert.equal(requests[2], requests[0]); assert.equal(h.controller.getState().save.status, 'idle'); assert.equal(h.saved.length, 1); h.controller.dispose();
});

test('custom editor Back retains full unfinished session and reopening receives it without a source save', async () => {
  const sessions = [], retained = { polygonDraft: [{ x: 3, y: 8 }, { x: 9, y: 12 }], fieldDrafts: { 'region.width': '' }, history: { past: [{ retained: true }], future: [] }, zoom: '2', viewContexts: { edit: { scroll: { inspector: { y: 127 } } } } };
  const h = await harness({ editCustomGeometry: async ({ draft }) => { sessions.push(structuredClone(draft)); return { regions: draft.regions, session: retained, issues: ['Close the unfinished polygon.'] }; } });
  await h.controller.editCustomGeometry(); assert.deepEqual(h.controller.getState().customDraft.session, retained); assert.equal(h.controller.getState().embeddedOpen, false);
  await h.controller.save(); assert.equal(h.requests.length, 0); assert.match(h.controller.getState().error, /unfinished polygon|numeric/);
  await h.controller.editCustomGeometry(); assert.deepEqual(sessions[1].session, retained); assert.equal(h.controller.getState().model.assembly.blocking.mode, 'custom'); h.controller.dispose();
});

test('in-flight Assembly save locks edits, rejects wrong receipts and ignores disposed late responses', async () => {
  let finish, signal; const requests = [];
  const h = await harness({ saveAssembly: (intent, options) => { requests.push(intent); signal = options.signal; return new Promise(resolve => { finish = resolve; }); } });
  const saving = h.controller.save(); assert.equal(h.controller.getState().save.status, 'saving'); assert.equal(h.controller.requestLeave(), false);
  await h.controller.save(); await h.controller.save(true); assert.equal(requests.length, 1);
  const prior = h.controller.getState(); h.controller.dispose(); assert(signal.aborted); finish(receipt(requests[0])); await saving;
  assert.deepEqual(h.controller.getState(), prior); assert.equal(h.saved.length, 0); assert.equal(h.pending.at(-1), false);
  const wrong = await harness({ saveAssembly: async intent => ({ ...receipt(intent), projectId: 'other' }) });
  await wrong.controller.save(); assert.equal(wrong.controller.getState().save.status, 'uncertain'); assert.equal(wrong.controller.getState().context.assetVersion, 0); wrong.controller.dispose();
});

test('superseding missing pins cancels their request, clears loading, and ignores the late old closure', async () => {
  let finish, signal, calls = 0;
  const h = await harness({ resolveDraft: (_draft, options) => { calls += 1; signal = options.signal; return new Promise(resolve => { finish = resolve; }); } });
  h.controller.testState.assets = []; const resolving = h.controller.resolveReferences(); assert.equal(h.controller.getState().resolution.status, 'loading');
  await h.controller.resolveReferences(); assert.equal(calls, 1, 'same exact pin request is shared');
  h.controller.testState.model.assembly.components = []; await h.controller.resolveReferences();
  assert(signal.aborted); assert.equal(h.controller.getState().resolution.status, 'ready'); assert.equal(h.controller.getState().scene, null);
  finish([leaf()]); await resolving; assert.equal(h.controller.getState().resolution.status, 'ready'); assert.equal(h.controller.getState().assets.length, 0); h.controller.dispose();
});
