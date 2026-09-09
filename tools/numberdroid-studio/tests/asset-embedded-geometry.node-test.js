import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssetEditorState, buildAssetEditorSave, assetEditorContextConflict, assetEditorSnapshot, assetEditorRemember, assetEditorUndo } from '../apps/studio-server/public/asset-editor-state.js';
import { embeddedGeometryIssues, embeddedGeometryResult, embeddedFramePoints, resumeEmbeddedGeometry } from '../apps/studio-server/public/asset-embedded-geometry.js';

function state() {
  return createAssetEditorState({ mode: 'assembly-geometry', projectId: 'project.test', projectRevision: 3, assetId: 'assembly.test', title: 'Machine / Custom blocking',
    planeSize: { width: 256, height: 256 }, artworkScene: { visualBounds: { x: -32, y: -16, width: 320, height: 288 }, elements: [] },
    geometry: { spatial: { schemaVersion: 1, coordinateSpace: 'image-pixels', unitsPerPixel: { x: 1 / 64, y: 1 / 64 },
      placementBounds: { x: 0, y: 0, width: 256, height: 256 }, anchor: { x: 128, y: 128 },
      blockingRegions: [{ regionId: 'body', name: 'Rotated body', shape: { kind: 'oval', x: 20, y: 20, width: 80, height: 40 } }] },
    regionTransforms: { body: [0, 1, -1, 0, 200, 0] } } });
}

test('embedded custom geometry retains analytic orientation and never builds a leaf save', () => {
  const draft = state(); assert.deepEqual(embeddedGeometryIssues(draft), []);
  const result = embeddedGeometryResult(draft);
  assert.equal(result.regions[0].shape.kind, 'oval'); assert.deepEqual(result.regions[0].transform, [0, 1, -1, 0, 200, 0]);
  assert.deepEqual(result.assembly.placementBounds, draft.model.spatial.placementBounds);
  assert.throws(() => buildAssetEditorSave(draft, 'save.forbidden'), /never writes a leaf Asset/);
  assert.equal(assetEditorContextConflict(draft, { projectId: 'project.test', projectRevision: 4 }), null);
  assert.match(assetEditorContextConflict(draft, { projectId: 'other' }), /project changed/);
});

test('returning an embedded draft preserves unfinished polygon, raw fields and history', () => {
  const draft = state(), before = assetEditorSnapshot(draft);
  draft.polygonDraft = [{ x: 3, y: 4 }, { x: 12, y: 4 }]; draft.fieldDrafts['region.width'] = '';
  draft.viewContexts.edit = { focus: 'canvas', page: { x: 0, y: 120 }, scroll: { canvas: { x: 20, y: 30 } } };
  assetEditorRemember(draft, before);
  const result = embeddedGeometryResult(draft);
  assert.equal(result.issues.length, 2); assert.deepEqual(result.session.polygonDraft, draft.polygonDraft);
  assert.deepEqual(result.session.fieldDrafts, { 'region.width': '' }); assert.deepEqual(result.session.viewContexts, draft.viewContexts);
  assert.equal(result.session.history.past.length, 1);
  assert.equal(assetEditorUndo(result.session), true); assert.deepEqual(result.session.model.regionTransforms.body, [0, 1, -1, 0, 200, 0]);
  assert.equal(draft.polygonDraft.length, 2, 'Returned snapshots cannot mutate the live draft');
});

test('embedded containment uses transformed shapes and frame includes negative artwork', () => {
  const draft = state(); draft.model.spatial.placementBounds.width = 130;
  assert.ok(embeddedGeometryIssues(draft).some(message => message.includes('Rotated body')));
  assert.ok(embeddedFramePoints(draft).some(point => point.x === -32 && point.y === -16));
});

test('reopening custom geometry keeps later parent placement edits through Undo and Redo', () => {
  const draft = state(), before = assetEditorSnapshot(draft);
  draft.model.spatial.blockingRegions[0].shape.width = 90;
  draft.polygonDraft = [{ x: 3, y: 4 }, { x: 12, y: 4 }];
  draft.fieldDrafts['region.width'] = '';
  assetEditorRemember(draft, before);
  const returned = embeddedGeometryResult(draft);
  const initial = structuredClone(draft.initial);
  Object.assign(initial.geometry.spatial.placementBounds, { width: 300 });
  initial.geometry.spatial.anchor.x = 140;
  initial.geometry.spatial.unitsPerPixel = { x: 1 / 32, y: 1 / 32 };
  const resumed = resumeEmbeddedGeometry(createAssetEditorState(initial), initial, returned.session);
  assert.deepEqual(resumed.polygonDraft, draft.polygonDraft);
  assert.deepEqual(resumed.fieldDrafts, draft.fieldDrafts);
  const expected = { placementBounds: initial.geometry.spatial.placementBounds, anchor: initial.geometry.spatial.anchor, unitsPerPixel: 1 / 32 };
  assert.deepEqual(embeddedGeometryResult(resumed).assembly, expected);
  assert.equal(assetEditorUndo(resumed), true);
  assert.deepEqual(embeddedGeometryResult(resumed).assembly, expected);
  assert.equal(resumed.model.spatial.blockingRegions[0].shape.width, 80);
  assert.equal(assetEditorUndo(resumed, true), true);
  assert.deepEqual(embeddedGeometryResult(resumed).assembly, expected);
  assert.equal(resumed.model.spatial.blockingRegions[0].shape.width, 90);
  assert.equal(returned.session.model.spatial.placementBounds.width, 256);
});
