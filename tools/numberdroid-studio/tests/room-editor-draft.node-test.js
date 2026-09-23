import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { createRoomEditorDraft, roomEditorDelta, roomEditorSavedMatches } from '../apps/studio-server/public/room-editor-draft.js';

const placement = (id, x = 0) => ({ placementId: id, assetId: `asset:${id}`, assetVersion: 1, metadataVersion: 2,
  anchor: { x, y: 1 }, rotation: 0, layer: 'SET_DRESSING', variantTag: null, proposalId: null, proposalItemId: null });
function fixture(overrides = {}) {
  let current = { projectId: 'p', revision: 10, room: { roomVariantId: 'r', version: 3, width: 6, height: 6,
    voidCells: [], blockedCells: [], intentTrace: [], connectors: [], placements: [placement('one'), placement('two', 3)] } };
  const requests = [], renders = [];
  const editor = createRoomEditorDraft({ context: () => current, changed: kind => renders.push(kind), key: () => 'fixed-key',
    send: async request => { requests.push(structuredClone(request)); return { projectId: 'p', revision: 11, value: { roomVariantId: 'r', roomVariantVersion: 4 } }; },
    adopt: async (_response, _request, _base, draft) => { current = { ...current, revision: 11, room: { ...structuredClone(draft), version: 4 } }; }, ...overrides });
  return { editor, requests, renders, current: () => current, replace: value => { current = value; } };
}
const move = (x, id = 'one', rotation = 0) => ({ placementId: id, expectedAssetId: `asset:${id}`, anchor: { x, y: 1 }, rotation });

test('many moves and rotations are local, coalesced, and save once with exact original pins', async () => {
  const f = fixture(); const saved = structuredClone(f.current());
  for (let index = 0; index < 100; index++) f.editor.enqueue(move(index % 5));
  f.editor.enqueue(move(2, 'one', 90)); f.editor.enqueue(move(4, 'two'));
  assert.equal(f.requests.length, 0); assert.deepEqual(f.current(), saved);
  assert.equal(f.editor.getState().message, 'Unsaved changes');
  assert.equal(f.editor.project(f.current().room).placements[0].anchor.x, 2);
  assert.equal(await f.editor.save(), true); assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].body.moves.length, 2); assert.equal(f.requests[0].body.expectedRevision, 10);
  assert.equal(f.current().revision, 11); assert.equal(f.current().room.placements[0].metadataVersion, 2);
  assert.equal(f.editor.hasPending(), false);
});
test('every tool contributes to one delta and one immutable save', async () => {
  const f = fixture();
  f.editor.apply('room-shape-set', { voidCells: [{ x: 5, y: 5 }], blockedCells: [{ x: 0, y: 0 }] });
  f.editor.apply('room-intent-set', { intentTrace: [{ layer: 'room_design', summary: 'Workshop' }] });
  f.editor.apply('room-connectors-set', { connectors: [{ connectorId: 'north', side: 'north' }] });
  f.editor.apply('room-placement-add', { placements: [placement('three', 2)] });
  f.editor.enqueue(move(4, 'three', 180));
  f.editor.apply('room-placement-remove', { placements: [{ placementId: 'two', expectedAssetId: 'asset:two' }] });
  f.editor.apply('room-resize', { width: 7, height: 7, removePlacementIds: [], removeConnectorIds: [] });
  assert.equal(f.requests.length, 0); await f.editor.save();
  const body = f.requests[0].body;
  assert.equal(body.width, 7); assert.equal(body.height, 7); assert.equal(body.addPlacements[0].rotation, 180);
  assert.deepEqual(body.removePlacements, [{ placementId: 'two', expectedAssetId: 'asset:two' }]);
  assert.equal(body.moves.length, 0); assert.equal(body.blockedCells.length, 1); assert.equal(body.voidCells.length, 1);
  assert.equal(body.connectors.length, 1); assert.equal(body.intentTrace.length, 1); assert.equal(f.requests.length, 1);
});
test('returning to original placement and add then remove are no-ops', async () => {
  const f = fixture(); f.editor.enqueue(move(1)); f.editor.enqueue(move(0));
  assert.equal(f.editor.hasPending(), false); assert.equal(await f.editor.save(), false);
  f.editor.apply('room-placement-add', { placements: [placement('new')] });
  f.editor.apply('room-placement-remove', { placements: [{ placementId: 'new', expectedAssetId: 'asset:new' }] });
  assert.equal(f.editor.hasPending(), false); assert.equal(f.requests.length, 0);
});
test('discard preserves saved Room and creates no command', () => {
  const f = fixture(); const before = structuredClone(f.current());
  f.editor.enqueue(move(2)); assert.equal(f.editor.discard(), true);
  assert.deepEqual(f.current(), before); assert.deepEqual(f.editor.project(f.current().room), before.room); assert.equal(f.requests.length, 0);
});
test('unknown save freezes full request and key; retry has no duplicate or draft edits', async () => {
  const requests = []; let first = true;
  const f = fixture({ send: async request => { requests.push(request.serialized); if (first) { first = false; throw new Error('Lost response'); }
    return { projectId: 'p', revision: 11, value: { roomVariantId: 'r', roomVariantVersion: 4 } }; } });
  f.editor.enqueue(move(2)); assert.equal(await f.editor.save(), false);
  assert.equal(f.editor.getState().phase, 'uncertain'); assert.equal(f.editor.discard(), false);
  assert.equal(f.editor.enqueue(move(4)), false); assert.equal(await f.editor.retry(), true);
  assert.equal(requests.length, 2); assert.equal(requests[0], requests[1]);
});
test('confirmed save read failure retries adoption only', async () => {
  let reads = 0;
  const f = fixture({ adopt: async () => { reads++; if (reads === 1) throw new Error('Read unavailable'); } });
  f.editor.enqueue(move(2)); await f.editor.save(); assert.equal(f.editor.getState().phase, 'refresh');
  await f.editor.retry(); assert.equal(f.requests.length, 1); assert.equal(reads, 2);
});
test('definite rejection retains draft for correction and a new deliberate Save', async () => {
  let calls = 0;
  const f = fixture({ send: async () => { calls++; throw Object.assign(new Error('Room conflict'), { status: 409, code: 'REVISION_CONFLICT' }); } });
  f.editor.enqueue(move(2)); await f.editor.save();
  assert.equal(f.editor.getState().dirty, true); assert.equal(f.editor.isLocked(), false);
  assert.equal(f.editor.project(f.current().room).placements[0].anchor.x, 2);
  assert.equal(f.editor.enqueue(move(3)), true); assert.equal(calls, 1);
});
test('lost response followed by rejection remains uncertain', async () => {
  let calls = 0;
  const f = fixture({ send: async () => { calls++; throw calls === 1 ? new Error('Lost response') : Object.assign(new Error('Expired'), { status: 403 }); } });
  f.editor.enqueue(move(2)); await f.editor.save(); await f.editor.retry();
  assert.equal(f.editor.getState().phase, 'uncertain'); assert.equal(f.editor.discard(), false);
});
test('transport 408/499 and unknown 4xx responses keep the exact request and lock', async () => {
  for (const error of [{ status: 408, code: 'VALIDATION_ERROR' }, { status: 499, code: 'REVISION_CONFLICT' }, { status: 409 }, { status: 400, code: 'PROXY_FAILURE' }]) {
    const requests = [];
    const f = fixture({ send: async request => { requests.push(request.serialized); throw Object.assign(new Error('Unconfirmed transport'), error); } });
    f.editor.enqueue(move(2)); await f.editor.save();
    assert.equal(f.editor.getState().phase, 'uncertain'); assert.equal(f.editor.discard(), false);
    assert.equal(f.editor.enqueue(move(3)), false); await f.editor.retry();
    assert.deepEqual(requests, [requests[0], requests[0]]);
  }
});
test('a rejected embedded saved Room forces a fresh read on retry without replacing the receipt', async () => {
  const attempts = [];
  const f = fixture({ adopt: async (response, _request, _base, _draft, options) => {
    attempts.push({ response, ...options }); if (!options.forceRead) throw new Error('Embedded Room mismatch');
  } });
  f.editor.enqueue(move(2)); await f.editor.save();
  assert.equal(f.editor.getState().phase, 'refresh'); assert.equal(f.editor.discard(), false);
  assert.equal(await f.editor.retry(), true); assert.equal(f.requests.length, 1);
  assert.deepEqual(attempts.map(value => value.forceRead), [false, true]);
  assert.equal(attempts[0].response, attempts[1].response);
});
test('actual app adoption recovers invalid embedded Room through one fresh exact read and no second POST', async () => {
  const source = await readFile(new URL('../apps/studio-server/public/app.js', import.meta.url), 'utf8');
  const start = source.indexOf('  async adopt(response, request, previous, draft,');
  assert.ok(start > 0);
  const body = source.slice(start, source.indexOf('  changed(kind) {', start));
  const base = { ...fixture().current().room, lifecycle: 'DRAFT', findings: [] };
  const entry = { headVersion: 3, versions: [base] };
  const state = { project: { projectId: 'p', revision: 10, snapshot: { project: { name: 'Test' } } },
    activity: [], roomUi: { pinnedAssets: { status: 'idle' } } };
  const saved = { ...structuredClone(base), version: 4, createdRevision: 11, contentFingerprint: 'saved' };
  saved.placements[0].anchor.x = 2;
  const response = { projectId: 'p', revision: 11, value: { roomVariantId: 'r', roomVariantVersion: 4,
    contentFingerprint: 'saved', roomVariant: { ...saved, contentFingerprint: 'bad-embedded' } } };
  const receipt = structuredClone(response), requests = [], reads = [];
  const currentRoomVariant = () => ({ entry, variant: entry.versions.at(-1) });
  const adopt = runInNewContext(`({${body}}).adopt`, { state, currentRoomVariant, roomEditorSavedMatches,
    AbortSignal, projectLoadGeneration: 0, cancelRoomPreviewLoad: () => {}, elements: { 'project-select': { options: [] } },
    api: async path => { reads.push(path); return { projectId: 'p', revision: 11, variants: [{ roomVariantId: 'r', current: saved }] }; } });
  const editor = createRoomEditorDraft({ context: () => ({ projectId: 'p', revision: state.project.revision, room: currentRoomVariant().variant }),
    changed: () => {}, key: () => 'fixed', adopt, send: async request => { requests.push(request.serialized); return response; } });
  editor.enqueue(move(2)); assert.equal(await editor.save(), false);
  assert.equal(editor.getState().phase, 'refresh'); assert.equal(reads.length, 0); assert.equal(state.project.revision, 10);
  assert.equal(await editor.retry(), true); assert.equal(requests.length, 1);
  assert.deepEqual(reads, ['/api/projects/p/rooms/r?includeVersions=false&includeProposals=false']);
  assert.equal(state.project.revision, 11); assert.equal(entry.headVersion, 4);
  assert.deepEqual(response, receipt); assert.equal(editor.isLocked(), false);
});
test('newer context does not silently rebase local changes', async () => {
  const f = fixture(); f.editor.enqueue(move(2)); f.replace({ ...f.current(), revision: 11 });
  assert.equal(await f.editor.save(), false); assert.equal(f.requests.length, 0); assert.equal(f.editor.hasPending(), true);
});
test('existing exact pins and provenance cannot be rewritten in draft', () => {
  const f = fixture(); f.editor.enqueue(move(2));
  assert.equal(f.editor.update(room => { room.placements[0].assetVersion = 5; }), false);
  assert.equal(f.editor.project(f.current().room).placements[0].assetVersion, 1);
});
test('delta rejects duplicate or more than 256 placements', () => {
  const f = fixture(), room = f.current().room;
  assert.throws(() => roomEditorDelta(room, { ...room, placements: [placement('one'), placement('one')] }), /distinct/);
  assert.throws(() => roomEditorDelta(room, { ...room, placements: Array.from({ length: 257 }, (_, i) => placement(String(i))) }), /256/);
});
test('clean no-op or rejected initial edit does not pin a stale empty draft', () => {
  for (const invalid of [false, true]) {
    const f = fixture();
    if (invalid) f.editor.update(() => { throw new Error('Invalid edit'); });
    else f.editor.enqueue(move(0));
    assert.equal(f.editor.hasPending(), false);
    f.replace({ ...f.current(), revision: 11, room: { ...f.current().room, version: 4 } });
    assert.equal(f.editor.enqueue(move(2)), true);
    assert.equal(f.editor.getState().dirty, true);
  }
});
test('forced context switch cannot edit the retained draft', () => {
  const f = fixture(); f.editor.enqueue(move(2)); f.replace({ ...f.current(), projectId: 'other' });
  assert.equal(f.editor.canInput(), false); assert.equal(f.editor.enqueue(move(3)), false);
});

test('app draft notification clears the obsolete cell-paint message only after Save or Discard', async () => {
  const source = await readFile(new URL('../apps/studio-server/public/app.js', import.meta.url), 'utf8');
  const start = source.indexOf('  changed(kind) {', source.indexOf('const roomMoveTools ='));
  assert.ok(start > 0);
  const body = source.slice(start, source.indexOf('\n});', start));
  for (const kind of ['discard', 'saved', 'move', 'status', 'content']) {
    const state = { workspace: 'rooms', roomUi: { lastShapeEdit: 'Cell 2,2 painted outside room.' } };
    const changed = runInNewContext(`({${body}}).changed`, { state, roomMoveResultNotice: null,
      roomMoveTools: { getState: () => ({ pending: false, message: 'Saved' }), hasPending: () => false },
      currentRoomVariant: () => ({ variant: null }), renderRoomMoveDisplay: () => {}, renderWorkspace: () => {} });
    changed(kind);
    assert.equal(state.roomUi.lastShapeEdit, ['discard', 'saved'].includes(kind) ? null : 'Cell 2,2 painted outside room.');
  }
});

test('Surface staging and Undo patch placements in place without replacing board, cells, focus or viewport', async () => {
  const source = await readFile(new URL('../apps/studio-server/public/app.js', import.meta.url), 'utf8');
  const start = source.indexOf('function renderRoomMoveDisplay(');
  const body = source.slice(start, source.indexOf('const roomMoveTools =', start));
  const oldPlacement = placement('old'), untouched = placement('untouched', 3), added = placement('added', 2);
  let shown = [untouched, added];
  const cells = [{ id: 'cell0' }, { id: 'cell1' }], scroll = { left: 48, top: 96 };
  const document = { activeElement: cells[1] };
  const board = { cells, children: [], querySelectorAll: () => board.children, append(node) { this.children.push(node); } };
  const node = value => ({ dataset: { placementId: value.placementId, roomPositionKey: `${value.anchor.x}:${value.anchor.y}:${value.rotation}`, selected: 'false' },
    remove() { board.children = board.children.filter(child => child !== this); } });
  const oldNode = node(oldPlacement), unchangedNode = node(untouched); board.children = [oldNode, unchangedNode];
  const root = { querySelector: selector => selector === '[data-room-board]' ? board : { replaceWith() {} } };
  const state = { workspace: 'rooms', roomNavigation: { route: 'editor' }, project: { snapshot: {} }, roomUi: { layers: { SET_DRESSING: true }, selectedPlacementId: null } };
  const render = runInNewContext(`${body}; renderRoomMoveDisplay`, { state, document, elements: { 'workspace-content': root },
    currentRoomVariant: () => ({ variant: { placements: [oldPlacement, untouched] } }),
    roomMoveTools: { project: () => ({ placements: shown }), isLocked: () => false },
    captureRoomDomState() {}, restoreRoomDomState() {}, renderRoomPlacement: node, renderRoomInspector() {}, renderRoomToolOptions() {},
    setRoomMutationPending() {}, applyRoomShapeDraftLock() {}, updateRoomPlacementGhostDom() {} });
  render();
  assert.deepEqual(board.children.map(value => value.dataset.placementId), ['untouched', 'added']);
  assert.equal(board.children[0], unchangedNode); assert.equal(board.cells, cells); assert.equal(document.activeElement, cells[1]);
  assert.deepEqual(scroll, { left: 48, top: 96 });
  shown = [oldPlacement, untouched]; render();
  assert.deepEqual(board.children.map(value => value.dataset.placementId), ['untouched', 'old']);
  assert.equal(board.children[0], unchangedNode); assert.equal(board.cells, cells); assert.equal(document.activeElement, cells[1]);
  assert.match(source, /structuredClone\(plan\.additions\)\]; \}, 'surface'\)/);
  assert.match(source, /structuredClone\(previous\.placements\); \}, 'surface'\)/);
  assert.match(source, /kind === 'move' \|\| kind === 'surface' \|\| kind === 'status'/);
});

test('retained canvas synchronizes tool hit-testing flags when leaving Prop, Clear or paint mode', async () => {
  const source = await readFile(new URL('../apps/studio-server/public/app.js', import.meta.url), 'utf8');
  const start = source.indexOf('  if (retainedRoomCanvas) {');
  const body = source.slice(start, source.indexOf('  const replacementCutterMain', start));
  const modes = ['shapeEditing', 'assetPlacementEditing', 'eraseEditing', 'pendingPlacementRecovery'];
  for (const nextMode of [null, ...modes]) {
    const retainedBoard = { dataset: Object.fromEntries(modes.map(mode => [mode, 'true'])) };
    const replacementBoard = { dataset: nextMode ? { [nextMode]: 'true' } : {} };
    const retainedHint = { textContent: 'Old tool' }; let installed, decorated;
    const retainedRoomCanvas = { querySelector: selector => selector === '[data-room-board]' ? retainedBoard : retainedHint };
    const replacementCanvas = { querySelector: selector => selector === '[data-room-board]' ? replacementBoard : { textContent: 'New tool' },
      replaceWith(value) { installed = value; } };
    runInNewContext(body, { retainedRoomCanvas, content: { querySelector: () => replacementCanvas },
      roomSurfaceTools: { decorate(board) { decorated = board; } } });
    assert.deepEqual(retainedBoard.dataset, nextMode ? { [nextMode]: 'true' } : {});
    assert.equal(installed, retainedRoomCanvas); assert.equal(decorated, retainedBoard); assert.equal(retainedHint.textContent, 'New tool');
  }
});
