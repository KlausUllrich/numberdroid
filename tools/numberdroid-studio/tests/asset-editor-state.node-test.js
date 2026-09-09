import assert from 'node:assert/strict';
import test from 'node:test';
import { createAssetEditorState, assetEditorDefaultMetadata, buildAssetEditorSave, assetEditorIssues, assetEditorSnapshot, assetEditorRemember, assetEditorUndo,
  assetEditorDirty, assetEditorInvalidNumericField, assetEditorResizeBox, assetEditorDrawBox, assetEditorNearestEdge, assetEditorSnap, assetEditorContextConflict } from '../apps/studio-server/public/asset-editor-state.js';

const initial = () => ({ projectId: 'project.editor', projectRevision: 7, pixelSize: { width: 200, height: 300 }, previewUrl: '/exact.png', instanceId: 'editor.one', assetId: 'asset.new', slice: { sliceId: 'slice.one', version: 2, rectangle: { name: 'Coffee machine' } } });
const legacy = () => ({ assetId: 'asset.old', name: 'Saved name', kind: 'prop', assetVersion: 4, metadataVersion: 3,
  sliceBinding: { sliceId: 'slice.old', sliceVersion: 1, width: 200, height: 300 }, metadata: { ...assetEditorDefaultMetadata(), pixelSize: { width: 200, height: 300 }, pivot: null,
    role: 'furniture', tags: ['keep'], compatibilityGroups: ['family'], spanTiles: { width: 2, height: 3 }, anchor: { x: 1, y: 2 }, navigation: { effect: 'blocked', cost: null },
    collision: { mode: 'parts', bounds: null, parts: [{ x: .2, y: .4, width: 1.5, height: 2.2 }] }, extensions: { 'game.opaque': { preserve: true } } } });

test('new Asset takes the saved cut name and creates one exact slice save without proposal identities', () => {
  const state = createAssetEditorState(initial()); const intent = buildAssetEditorSave(state, 'save.once');
  assert.equal(state.model.name, 'Coffee machine'); assert.equal(intent.assetId, 'asset.new');
  assert.deepEqual(intent.payload.image, { mode: 'saved-slice', sliceId: 'slice.one', expectedSliceVersion: 2 });
  assert.equal(intent.payload.operation, 'create'); assert.equal(intent.payload.expectedAssetVersion, 0); assert.equal(intent.payload.metadata.spatial.coordinateSpace, 'image-pixels');
  assert(!('proposalId' in intent.payload)); assert.equal(intent.serialized, JSON.stringify(intent.payload));
  state.model.name = 'Another draft'; assert.equal(intent.payload.name, 'Coffee machine');
});

test('name-only update retains old imagery and all authored metadata without adding spatial or derived image facts', () => {
  const asset = legacy(); const state = createAssetEditorState({ ...initial(), asset }); state.model.name = 'Renamed'; const request = buildAssetEditorSave(state, 'save.rename').payload;
  const expected = structuredClone(asset.metadata); delete expected.pixelSize; delete expected.pivot;
  assert.deepEqual(request.metadata, expected); assert.deepEqual(request.image, { mode: 'retain' }); assert.equal(request.expectedAssetVersion, 4); assert.equal(request.expectedMetadataVersion, 3);
  assert.equal(Object.hasOwn(request.metadata, 'spatial'), false); assert.deepEqual(asset.metadata.tags, ['keep']);
});

test('explicit legacy geometry conversion preserves unequal image scales, authored blocking and unrelated metadata', () => {
  const asset = legacy(); asset.metadata.spanTiles = { width: 4, height: 3 }; const state = createAssetEditorState({ ...initial(), asset }); state.model.geometryEnabled = true;
  const request = buildAssetEditorSave(state, 'save.geometry').payload;
  assert.deepEqual(request.metadata.spatial.unitsPerPixel, { x: .02, y: .01 }); assert.equal(request.metadata.collision.mode, 'spatial');
  assert.deepEqual(request.metadata.extensions, asset.metadata.extensions); assert.deepEqual(request.metadata.spatial.blockingRegions[0].shape, { kind: 'rectangle', x: 10, y: 40, width: 75, height: 220 });
});

test('incomplete legacy footprint still permits a name-only edit without inventing saved geometry', () => {
  const asset = legacy(); asset.metadata.spanTiles = null; const state = createAssetEditorState({ ...initial(), asset }); state.model.name = 'New name';
  assert.match(state.conversionError, /footprint/); const request = buildAssetEditorSave(state, 'save.name').payload; assert.equal(request.metadata.spanTiles, null); assert(!('spatial' in request.metadata));
});

test('bounds and anchor edits leave blocking and image scale intact and invalid containment prevents save', () => {
  const state = createAssetEditorState(initial()); state.model.spatial.blockingRegions = [{ regionId: 'region.body', name: 'Body', shape: { kind: 'oval', x: 20, y: 30, width: 100, height: 200 } }];
  const shapes = structuredClone(state.model.spatial.blockingRegions), scale = structuredClone(state.model.spatial.unitsPerPixel);
  state.model.spatial.placementBounds.width = 60; state.model.spatial.anchor = { x: -15.25, y: 320.75 };
  assert.deepEqual(state.model.spatial.blockingRegions, shapes); assert.deepEqual(state.model.spatial.unitsPerPixel, scale);
  assert(assetEditorIssues(state).some(s => s.includes('placement bounds'))); assert.throws(() => buildAssetEditorSave(state, 'save.invalid'), /placement bounds/);
});

test('concave polygon stays exact; point insertion projects onto the original edge', () => {
  const points = [{ x: 10, y: 10 }, { x: 190, y: 10 }, { x: 190, y: 80 }, { x: 80, y: 80 }, { x: 80, y: 280 }, { x: 10, y: 280 }];
  const edge = assetEditorNearestEdge(points, { x: 90, y: 15 }); assert.equal(edge.index, 0); assert.deepEqual(edge.point, { x: 90, y: 10 });
  const state = createAssetEditorState(initial()); state.model.spatial.blockingRegions = [{ regionId: 'r.one', name: 'Concave body', shape: { kind: 'polygon', points } }];
  assert.deepEqual(buildAssetEditorSave(state, 'save.concave').payload.metadata.spatial.blockingRegions[0].shape.points, points);
});

test('unfinished and crossed polygons are retained but cannot be saved', () => {
  const state = createAssetEditorState(initial()); state.polygonDraft = [{ x: 0, y: 0 }]; assert.throws(() => buildAssetEditorSave(state, 'save.open'), /unfinished polygon/);
  state.polygonDraft = []; state.model.spatial.blockingRegions = [{ regionId: 'r.one', name: 'Crossed', shape: { kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }, { x: 100, y: 0 }] } }];
  assert(assetEditorIssues(state).length); assert.equal(state.model.spatial.blockingRegions[0].shape.points.length, 4);
});

test('edge handles ignore the other pointer axis; Shift retains opposite edge and perpendicular center', () => {
  const original = { x: 10, y: 20, width: 40, height: 60 };
  for (const edge of ['e', 'w']) { const moved = assetEditorResizeBox(original, edge, 7, 11); assert.equal(moved.y, 20); assert.equal(moved.height, 60); const square = assetEditorResizeBox(original, edge, 7, 11, true); assert.equal(square.width, square.height); assert.equal(square.y + square.height / 2, 50); assert.equal(edge === 'e' ? square.x : square.x + square.width, edge === 'e' ? 10 : 50); }
  for (const edge of ['n', 's']) { const moved = assetEditorResizeBox(original, edge, 7, 11); assert.equal(moved.x, 10); assert.equal(moved.width, 40); const square = assetEditorResizeBox(original, edge, 7, 11, true); assert.equal(square.width, square.height); assert.equal(square.x + square.width / 2, 30); assert.equal(edge === 's' ? square.y : square.y + square.height, edge === 's' ? 20 : 80); }
});

test('Shift corner resizing keeps opposite corner; releasing the modifier restores free resizing from gesture origin', () => {
  const original = { x: 10, y: 20, width: 40, height: 60 };
  for (const edge of ['nw', 'ne', 'sw', 'se']) { const square = assetEditorResizeBox(original, edge, 7, 11, true); assert.equal(square.width, square.height);
    assert.equal(edge.includes('w') ? square.x + square.width : square.x, edge.includes('w') ? 50 : 10); assert.equal(edge.includes('n') ? square.y + square.height : square.y, edge.includes('n') ? 80 : 20);
    const free = assetEditorResizeBox(original, edge, 7, 11, false); assert.notEqual(free.width, free.height); }
  assert.deepEqual(assetEditorDrawBox({ x: 100, y: 100 }, { x: 60, y: 80 }, true), { x: 60, y: 60, width: 40, height: 40 });
});

test('Undo and Redo restore geometry, names, selection and unfinished point edits', () => {
  const state = createAssetEditorState(initial()); const before = assetEditorSnapshot(state); state.model.name = 'Revised'; state.polygonDraft.push({ x: 5, y: 5 }); state.selectedPoint = 2; assetEditorRemember(state, before);
  assert(assetEditorDirty(state)); assert(assetEditorUndo(state)); assert.equal(state.model.name, 'Coffee machine'); assert.deepEqual(state.polygonDraft, []); assert.equal(state.selectedPoint, null);
  assert(assetEditorUndo(state, true)); assert.equal(state.model.name, 'Revised'); assert.deepEqual(state.polygonDraft, [{ x: 5, y: 5 }]);
});

test('snapping can be bypassed and exact fractional numeric edits are preserved', () => {
  assert.deepEqual(assetEditorSnap({ x: 16, y: 36 }, { snap: true, step: 25 }), { x: 25, y: 25 }); assert.deepEqual(assetEditorSnap({ x: 16, y: 36 }, { snap: true, step: 25 }, true), { x: 16, y: 36 });
  const state = createAssetEditorState(initial()); state.model.spatial.anchor.x = 15.125; assert.equal(buildAssetEditorSave(state, 'save.precise').payload.metadata.spatial.anchor.x, 15.125);
});

test('project, exact Asset and saved cut context changes require rechecking', () => {
  const state = createAssetEditorState(initial()); const current = { projectId: 'project.editor', projectRevision: 7, slice: initial().slice };
  assert.equal(assetEditorContextConflict(state, current), null); assert.match(assetEditorContextConflict(state, { ...current, projectRevision: 8 }), /project changed/); assert.match(assetEditorContextConflict(state, { ...current, slice: { ...current.slice, version: 3 } }), /image cut changed/);
  const update = createAssetEditorState({ ...initial(), asset: legacy() }); assert.match(assetEditorContextConflict(update, { ...current, asset: { ...legacy(), assetVersion: 5 } }), /Asset changed/);
});


test('an incomplete numeric value is a visible pending edit even when semantic values are unchanged', () => {
  const state = createAssetEditorState({ ...initial(), asset: legacy() });
  assert.equal(assetEditorDirty(state), false);
  state.fieldDrafts['region.width'] = '';
  assert.equal(assetEditorDirty(state), true);
  assert.equal(assetEditorInvalidNumericField(state), 'region.width');
  assert.ok(assetEditorIssues(state).some(message => message.includes('numeric')));
  delete state.fieldDrafts['region.width'];
  assert.equal(assetEditorDirty(state), false);
});
