import assert from 'node:assert/strict';
import test from 'node:test';
import { validateRoomVariant } from '../packages/domain/src/room-definition.js';
import { spatialAliases } from '../packages/domain/src/asset-spatial-geometry.js';
import { createRoomPreviewScene } from '../packages/preview/src/room-preview-scene.js';

const projectId = 'project.spatial-consumers';
function spatial(shape, overrides = {}) {
  return { schemaVersion: 1, coordinateSpace: 'image-pixels', unitsPerPixel: { x: 0.01, y: 0.01 }, placementBounds: { x: 0, y: 0, width: 300, height: 300 }, anchor: { x: 100, y: 250 }, blockingRegions: [{ regionId: 'body', name: 'Body', shape }], ...overrides };
}
const lShape = { kind: 'polygon', points: [[0, 0], [300, 0], [300, 100], [100, 100], [100, 300], [0, 300]].map(([x, y]) => ({ x, y })) };
function asset(assetId, s, kind = 'prop') {
  return { assetId, assetVersion: 1, metadataVersion: 1, name: assetId, kind, lifecycle: 'FINAL',
    metadata: { role: 'test', tags: [], ...spatialAliases(s), spatial: s, pixelSize: { width: 200, height: 300 }, attachment: 'ground', rotationPolicy: 'cardinal', placement: { modes: ['manual'], wallSafe: true, tags: [], confirmation: 'confirmed' }, navigation: { effect: 'blocked', cost: null }, runtimeEligible: false, extensions: {} },
    sliceBinding: { projectId, digest: 'a'.repeat(64), mediaType: 'image/png', width: 200, height: 300 },
  };
}
function placement(assetValue, x = 0, y = 0, rotation = 0) {
  return { placementId: `placed.${assetValue.assetId}`, assetId: assetValue.assetId, assetVersion: 1, metadataVersion: 1, layer: assetValue.kind === 'surface' ? 'STRUCTURAL_SURFACE' : 'SET_DRESSING', anchor: { x, y }, rotation, variantTag: null, proposalId: null, proposalItemId: null };
}
function connector(side, offset = 1) {
  return { connectorId: `connector.${side}`, side, offset, width: 1, kind: 'standard-door', clearanceInside: 1, clearanceOutside: 1, required: true, tags: [], compatibilityProfile: 'door.standard' };
}
function room(placements) {
  return { projectId, roomVariantId: 'room.spatial', version: 1, roomArchetypeId: 'archetype.spatial', archetypeVersion: 1, displayName: 'Spatial Room', lifecycle: 'DRAFT', width: 3, height: 3, origin: { x: 0, y: 0 },
    intentTrace: ['game_design', 'level_design', 'room_design'].map((layer) => ({ layer, ruleId: `rule.${layer}`, summary: 'Spatial geometry test.', disposition: 'governing' })),
    connectors: [connector('east'), connector('south')], placements, acceptedWarningFindingIds: [], parentVariantVersion: null, parentFinalVersion: null,
  };
}
const archetype = {
  projectId, roomArchetypeId: 'archetype.spatial', version: 1, kind: 'room', displayName: 'Spatial room', tags: [],
  dimensionPolicy: { width: { min: 3, preferred: 3, max: 64 }, height: { min: 3, preferred: 3, max: 64 } },
  structuralBands: { left: 0, right: 0, top: 0, bottom: 0 }, orientation: 'any', connectorPolicy: { min: 1, max: 8, requiredSides: [] },
  allowedAssetKinds: ['surface', 'prop', 'item'], allowedTags: [], requiredTags: [], rationality: 'domestic', governingRuleRefs: [{ ruleId: 'rule.spatial', summary: 'Keep geometry exact.' }],
};
const validate = (assets, placements = assets.map((a) => placement(a))) => validateRoomVariant({ variant: room(placements), archetype, assets: new Map(assets.map((a) => [a.assetId, a])) });
const rules = (result) => new Set(result.findings.map((finding) => finding.ruleId));
function preview(assetValue, rotation = 0) {
  const exactRoom = { ...room([placement(assetValue, 10, 20, rotation)]), width: 32, height: 32, contentFingerprint: '1'.repeat(64), findings: [], voidCells: [], blockedCells: [] };
  return createRoomPreviewScene({ projectId, projectRevision: 42, room: exactRoom, assets: [assetValue] });
}

test('Room connector clearance and navigation preserve the empty concave corner', () => {
  const l = asset('asset.l', spatial(lShape)); const lRules = rules(validate([l]));
  assert.equal(lRules.has('studio.room.connector.clearance_blocked'), false);
  assert.equal(lRules.has('studio.room.navigation.connector_unreachable'), false);
  assert.equal(lRules.has('studio.room.navigation.connectors_disconnected'), false);
  const full = asset('asset.full', spatial({ kind: 'rectangle', x: 0, y: 0, width: 300, height: 300 }));
  const fullRules = rules(validate([full]));
  assert.equal(fullRules.has('studio.room.connector.clearance_blocked'), true);
  assert.equal(fullRules.has('studio.room.navigation.connector_unreachable'), true);
});

test('Room rejects invalid containment before drawing occupancy or inferring blocking', () => {
  const invalid = asset('asset.invalid', spatial(lShape, { placementBounds: { x: 0, y: 0, width: 200, height: 200 } }));
  assert.equal(rules(validate([invalid])).has('studio.room.placement.spatial_invalid'), true);
  assert.throws(() => preview(invalid), (error) => error.code === 'ROOM_PREVIEW_SPATIAL_INVALID');
});

test('cross-layer nonrectangular blockers report unsupported comparison, not guessed collision', () => {
  const surface = asset('asset.surface', spatial({ kind: 'oval', x: 0, y: 0, width: 300, height: 300 }), 'surface');
  const prop = asset('asset.prop', spatial({ kind: 'oval', x: 0, y: 0, width: 100, height: 100 }, { placementBounds: { x: 0, y: 0, width: 100, height: 100 } }));
  const result = rules(validate([surface, prop], [placement(surface), placement(prop, 1, 1)]));
  assert.equal(result.has('studio.room.collision.comparison_unsupported'), true);
  assert.equal(result.has('studio.room.collision.overlap'), false);
});

test('already forbidden set-dressing envelope overlap remains truthful without fake collision', () => {
  const a = asset('asset.a', spatial({ kind: 'oval', x: 0, y: 0, width: 300, height: 300 }));
  const b = { ...structuredClone(a), assetId: 'asset.b' };
  const result = rules(validate([a, b]));
  assert.equal(result.has('studio.room.placement.overlap'), true);
  assert.equal(result.has('studio.room.collision.comparison_unsupported'), false);
  assert.equal(result.has('studio.room.collision.overlap'), false);
});

test('Preview preserves fixed image scale, fractional placement dimensions and rotated ground anchor', () => {
  const s = spatial({ kind: 'rectangle', x: 35, y: 80, width: 100, height: 120 }, { placementBounds: { x: 25, y: 50, width: 150, height: 200 } });
  const a = asset('asset.machine', s); const scene = preview(a, 90); const entity = scene.entities[0];
  assert.deepEqual(entity.visual.bounds, { x: 9.5, y: 19.75, z: 0, width: 3, height: 2 });
  assert.deepEqual(entity.groundAnchor, { x: 10, y: 20.75, z: 0 });
  assert.deepEqual(entity.logicalFootprint, { x: 10, y: 20, z: 0, width: 2, height: 2, cells: [{ x: 10, y: 20 }, { x: 11, y: 20 }, { x: 10, y: 21 }, { x: 11, y: 21 }] });
  assert.equal(scene.source.projectRevision, 42);
  assert.equal(entity.source.assetVersion, 1);
  assert.equal(entity.artifact.pixelSize.width, 200);
});

test('legacy Preview retains cell-anchor and full-span image semantics', () => {
  const a = asset('asset.legacy', spatial(lShape));
  delete a.metadata.spatial;
  a.metadata.spanTiles = { width: 2, height: 3 }; a.metadata.anchor = { x: 1, y: 2 };
  a.metadata.collision = { mode: 'none', bounds: null, parts: [] };
  const entity = preview(a).entities[0];
  assert.deepEqual(entity.visual.bounds, { x: 10, y: 20, z: 0, width: 2, height: 3 });
  assert.deepEqual(entity.groundAnchor, { x: 11.5, y: 22.5, z: 0 });
});


test('zero inside-clearance connectors accept legacy and spatial blockers without a geometry exception', () => {
  const shaped = asset('asset.zero', spatial(lShape));
  const legacy = structuredClone(shaped); delete legacy.metadata.spatial;
  legacy.metadata.collision = { mode: 'bounds', bounds: { x: 0, y: 0, width: 1, height: 1 }, parts: [] };
  for (const candidate of [legacy, shaped]) {
    const variant = room([placement(candidate)]); variant.connectors.forEach(c => { c.clearanceInside = 0; });
    const result = validateRoomVariant({ variant, archetype, assets: new Map([[candidate.assetId, candidate]]) });
    assert.equal(rules(result).has('studio.room.connector.clearance_blocked'), false);
  }
});
