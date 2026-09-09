import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ASSET_SPATIAL_SCHEMA, blockingCells, classifyBlockingPair, normalizeAssetSpatial,
  resolveAssetSpatialGeometry, shapeIntersectsRect, spatialAliases,
  spatialFromLegacyAsset, spatialMetadataFindings, transformAssetSpatialGeometry,
  validateSpatialAliases,
} from '../packages/domain/src/asset-spatial-geometry.js';
import { validateAssetMetadataForVisualFacts } from '../packages/domain/src/asset-definition.js';

const polygon = (points) => ({ kind: 'polygon', points: points.map(([x, y]) => ({ x, y })) });
const lShape = polygon([[0, 0], [300, 0], [300, 100], [100, 100], [100, 300], [0, 300]]);
function spatial(overrides = {}) {
  return { schemaVersion: 1, coordinateSpace: 'image-pixels', unitsPerPixel: { x: 0.01, y: 0.01 }, placementBounds: { x: 0, y: 0, width: 300, height: 300 }, anchor: { x: 100, y: 250 }, blockingRegions: [{ regionId: 'body', name: 'Body', shape: lShape }], ...overrides };
}
function asset(s = spatial(), overrides = {}) {
  return { kind: 'prop', metadata: { ...spatialAliases(s), spatial: s, pixelSize: { width: 200, height: 300 }, navigation: { effect: 'blocked', cost: null }, extensions: {}, ...overrides } };
}
const metadata = (s) => ({
  role: 'test', tags: [], variantGroup: null, compatibilityGroups: [], ...spatialAliases(s), spatial: s,
  attachment: 'ground', rotationPolicy: 'cardinal', placement: { modes: ['manual'], wallSafe: true, tags: [], confirmation: 'confirmed' },
  navigation: { effect: 'blocked', cost: null }, runtimeEligible: false, connectors: [], continuityProfile: null,
  continuityTags: [], selectionPriority: 0, visualWeight: 'medium', extensions: {},
});

test('schema is portable, strict and has one semantic spatial document', () => {
  assert.equal(ASSET_SPATIAL_SCHEMA.additionalProperties, false);
  assert.equal(ASSET_SPATIAL_SCHEMA.properties.blockingRegions.maxItems, 16);
  const normalized = normalizeAssetSpatial(spatial());
  assert.deepEqual(normalized, spatial());
  normalized.blockingRegions[0].shape.points[0].x = 20;
  assert.equal(lShape.points[0].x, 0, 'normalization owns its point objects');
  assert.throws(() => normalizeAssetSpatial({ ...spatial(), surprise: 1 }), (e) => e.code === 'ASSET_SPATIAL_INVALID' && e.details.field === 'metadata.spatial.surprise');
  assert.throws(() => normalizeAssetSpatial({ ...spatial(), anchor: { x: Infinity, y: 0 } }), /anchor.x/);
  assert.throws(() => normalizeAssetSpatial({ ...spatial(), unitsPerPixel: { x: 0, y: 1 } }), /unitsPerPixel.x/);
  assert.throws(() => normalizeAssetSpatial({ ...spatial(), placementBounds: { x: 0, y: 0, width: 65535, height: 300 } }), /64 project units/);
});

test('simple concavity is retained; invalid polygon topology is rejected with a correction', () => {
  assert.deepEqual(normalizeAssetSpatial(spatial()).blockingRegions[0].shape, lShape);
  for (const points of [
    [[0, 0], [100, 100], [0, 100], [100, 0]],
    [[0, 0], [100, 0], [0, 0]],
    [[0, 0], [100, 0], [200, 0]],
    [[0, 0], [100, 0], [50, 0], [50, 100]],
  ]) assert.throws(() => normalizeAssetSpatial(spatial({ blockingRegions: [{ regionId: 'bad', name: 'Bad', shape: polygon(points) }] })), (e) => e.code === 'ASSET_SPATIAL_INVALID' && e.details.field.includes('points'));
  const duplicate = spatial(); duplicate.blockingRegions = [duplicate.blockingRegions[0], duplicate.blockingRegions[0]];
  assert.throws(() => normalizeAssetSpatial(duplicate), /regionId/);
  const sparse = spatial(); sparse.blockingRegions = new Array(1);
  assert.throws(() => normalizeAssetSpatial(sparse), /blockingRegions\[0\]/);
});

test('derived aliases clamp only legacy anchor and reject competing geometry', () => {
  const s = spatial({ anchor: { x: -30, y: 900 }, placementBounds: { x: 25, y: 50, width: 150, height: 200 } });
  const expected = { spanTiles: { width: 2, height: 2 }, anchor: { x: 0, y: 1 }, collision: { mode: 'spatial', bounds: null, parts: [] } };
  assert.deepEqual(spatialAliases(s), expected);
  assert.deepEqual(validateSpatialAliases(expected, s), expected);
  assert.throws(() => validateSpatialAliases({ ...expected, spanTiles: { width: 3, height: 2 } }, s), (e) => e.code === 'ASSET_SPATIAL_ALIAS_CONFLICT');
  assert.throws(() => validateSpatialAliases({ ...expected, collision: { mode: 'bounds', bounds: { x: 0, y: 0, width: 2, height: 2 }, parts: [] } }, s), /one authority/);
  assert.deepEqual(s.anchor, { x: -30, y: 900 }, 'authored anchor remains independent and unclamped');
});

test('smaller placement bounds preserve the draft shape and yield containment finding', () => {
  const s = spatial({ placementBounds: { x: 0, y: 0, width: 200, height: 200 } });
  assert.deepEqual(normalizeAssetSpatial(s).blockingRegions[0].shape, lShape);
  const findings = spatialMetadataFindings(s, { kind: 'prop' });
  assert.equal(findings[0].ruleId, 'studio.asset.spatial.blocking_out_of_bounds');
  assert.equal(findings[0].severity, 'ERROR');
  assert.throws(() => blockingCells(resolveAssetSpatialGeometry(asset(s)), { width: 8, height: 8 }), /Correct spatial findings/);
});

test('Surface fractional dimensions and unbacked blocked navigation are actionable findings', () => {
  const s = spatial({ placementBounds: { x: 0, y: 0, width: 150, height: 200 }, blockingRegions: [] });
  const findings = spatialMetadataFindings(s, { kind: 'surface', navigation: { effect: 'blocked' }, extensions: { 'studio.preview.presentation': { schemaVersion: 1 } } });
  assert.deepEqual(findings.map((f) => f.ruleId), ['studio.asset.spatial.surface_integral_required', 'studio.asset.spatial.blocking_required', 'studio.asset.spatial.presentation_conflict']);
  const geometry = resolveAssetSpatialGeometry(asset(s));
  assert.deepEqual(geometry.regions, [], 'no implicit whole-footprint region');
});

test('metadata validation stores exact shapes, stable aliases and findings without caller image facts', () => {
  const s = spatial();
  const validated = validateAssetMetadataForVisualFacts({ assetId: 'asset.test', kind: 'prop', metadata: metadata(s), pixelSize: { width: 200, height: 300 }, pivot: null });
  assert.deepEqual(validated.metadata.spatial, s);
  assert.deepEqual(validated.metadata.pixelSize, { width: 200, height: 300 });
  assert.equal(validated.findings.length, 0);
  const tooSmall = spatial({ placementBounds: { x: 0, y: 0, width: 200, height: 200 } });
  const invalid = validateAssetMetadataForVisualFacts({ assetId: 'asset.test', kind: 'prop', metadata: metadata(tooSmall), pixelSize: { width: 200, height: 300 }, pivot: null });
  assert.ok(invalid.findings.some((f) => f.ruleId === 'studio.asset.spatial.blocking_out_of_bounds' && f.findingId));
  assert.throws(() => validateAssetMetadataForVisualFacts({ assetId: 'asset.test', kind: 'prop', metadata: { ...metadata(s), spatial: null }, pixelSize: { width: 200, height: 300 }, pivot: null }), /metadata.spatial/);
});

test('fixed scale preserves image and blocking size when placement bounds change', () => {
  const initial = spatial({ placementBounds: { x: 0, y: 0, width: 200, height: 300 }, blockingRegions: [{ regionId: 'body', name: 'Body', shape: { kind: 'rectangle', x: 35, y: 80, width: 130, height: 190 } }] });
  const before = transformAssetSpatialGeometry(resolveAssetSpatialGeometry(asset(initial)), { origin: { x: 10, y: 20 } });
  assert.deepEqual(before.imageBounds, { x: 10, y: 20, width: 2, height: 3 });
  assert.deepEqual(before.anchor, { x: 11, y: 22.5 });
  const changed = { ...initial, placementBounds: { x: 25, y: 50, width: 150, height: 200 } };
  const after = transformAssetSpatialGeometry(resolveAssetSpatialGeometry(asset(changed)), { origin: { x: 10, y: 20 } });
  assert.deepEqual(after.placementBounds, { x: 10, y: 20, width: 1.5, height: 2 });
  assert.deepEqual(after.imageBounds, { x: 9.75, y: 19.5, width: 2, height: 3 });
  assert.deepEqual(after.anchor, { x: 10.75, y: 22 });
  assert.equal(after.regions[0].shape.width, before.regions[0].shape.width);
  assert.equal(after.regions[0].shape.height, before.regions[0].shape.height);
});

test('cardinal transforms preserve oval type, concavity and negative overhang', () => {
  const s = spatial({ blockingRegions: [{ regionId: 'oval', name: 'Oval', shape: { kind: 'oval', x: 20, y: 40, width: 100, height: 200 } }] });
  const source = resolveAssetSpatialGeometry(asset(s));
  for (const rotation of [0, 90, 180, 270]) {
    const transformed = transformAssetSpatialGeometry(source, { origin: { x: 4, y: 5 }, rotation });
    assert.equal(transformed.regions[0].shape.kind, 'oval');
    assert.equal(transformed.regions[0].shape.width, rotation % 180 ? 2 : 1);
    assert.equal(transformed.regions[0].shape.height, rotation % 180 ? 1 : 2);
    assert.equal(transformed.findings.length, 0);
  }
  const rotated = transformAssetSpatialGeometry(resolveAssetSpatialGeometry(asset()), { rotation: 90 });
  assert.equal(rotated.regions[0].shape.points.length, 6);
  assert.throws(() => transformAssetSpatialGeometry(source, { rotation: 45 }), /unsupported/);
});

test('strict shape/rectangle overlap preserves concave empty corners and edge tangency', () => {
  const l = polygon([[0, 0], [3, 0], [3, 1], [1, 1], [1, 3], [0, 3]]);
  assert.equal(shapeIntersectsRect(l, { x: 1, y: 1, width: 2, height: 2 }), false);
  assert.equal(shapeIntersectsRect(l, { x: 0.5, y: 0.5, width: 2, height: 2 }), true);
  assert.equal(shapeIntersectsRect(l, { x: 0, y: 0, width: 3, height: 3 }), true);
  assert.equal(shapeIntersectsRect(l, { x: 3, y: 0, width: 1, height: 1 }), false);
  const reversed = { kind: 'polygon', points: [...l.points].reverse() };
  assert.equal(shapeIntersectsRect(reversed, { x: 0.5, y: 0.5, width: 2, height: 2 }), true);
  const rectangle = { kind: 'rectangle', x: 0, y: 0, width: 1, height: 1 };
  assert.equal(shapeIntersectsRect(rectangle, { x: 1, y: 0, width: 1, height: 1 }), false);
  assert.equal(shapeIntersectsRect(rectangle, { x: 1 - Number.EPSILON, y: 0, width: 1, height: 1 }), true);
});

test('analytic oval intersection ignores empty frame corners without polygonization', () => {
  const oval = { kind: 'oval', x: 0, y: 0, width: 4, height: 2 };
  assert.equal(shapeIntersectsRect(oval, { x: 0, y: 0, width: 0.1, height: 0.1 }), false);
  assert.equal(shapeIntersectsRect(oval, { x: 1, y: 0.5, width: 0.5, height: 0.5 }), true);
  assert.equal(shapeIntersectsRect(oval, { x: 4, y: 0.5, width: 1, height: 1 }), false);
  assert.equal(shapeIntersectsRect(oval, { x: -1, y: -1, width: 6, height: 4 }), true);
});

test('pair classifier proves separation or exact supported collision and reports unsupported pairs', () => {
  const a = { kind: 'oval', x: 0, y: 0, width: 2, height: 2 };
  const b = { ...a, x: 1 };
  assert.equal(classifyBlockingPair(a, b), 'UNSUPPORTED');
  assert.equal(classifyBlockingPair(a, { ...b, x: 2 }), 'DISJOINT');
  assert.equal(classifyBlockingPair(a, { kind: 'rectangle', x: 0, y: 0, width: 0.1, height: 0.1 }), 'DISJOINT');
  assert.equal(classifyBlockingPair({ kind: 'rectangle', x: 0.5, y: 0.5, width: 1, height: 1 }, a), 'INTERSECTS');
});

test('navigation uses exact positive-area cell intersections and region union', () => {
  const geometry = resolveAssetSpatialGeometry(asset());
  geometry.regions.push(structuredClone(geometry.regions[0]));
  assert.deepEqual(blockingCells(geometry, { width: 4, height: 4 }), [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }]);
  const oval = resolveAssetSpatialGeometry(asset(spatial({ placementBounds: { x: 0, y: 0, width: 800, height: 800 }, blockingRegions: [{ regionId: 'oval', name: 'Oval', shape: { kind: 'oval', x: 0, y: 0, width: 800, height: 800 } }] })));
  const cells = blockingCells(oval, { width: 8, height: 8 });
  assert.equal(cells.some((p) => p.x === 0 && p.y === 0), false);
  assert.equal(cells.some((p) => p.x === 2 && p.y === 2), true);
});

test('explicit legacy conversion preserves scale, rectangles and old anchor without mutating input', () => {
  const old = { kind: 'prop', metadata: { spanTiles: { width: 2, height: 3 }, anchor: { x: 1, y: 2 }, collision: { mode: 'bounds', bounds: { x: 0.2, y: 0.5, width: 1, height: 2 }, parts: [] }, navigation: { effect: 'blocked' }, pixelSize: { width: 400, height: 300 } } };
  const before = structuredClone(old);
  const s = spatialFromLegacyAsset(old);
  assert.deepEqual(s.unitsPerPixel, { x: 0.005, y: 0.01 });
  assert.deepEqual(s.anchor, { x: 300, y: 250 });
  assert.deepEqual(resolveAssetSpatialGeometry(old).regions[0].shape, { kind: 'rectangle', x: 0.2, y: 0.5, width: 1, height: 2 });
  const converted = resolveAssetSpatialGeometry({ ...old, metadata: { ...old.metadata, ...spatialAliases(s), spatial: s } });
  assert.deepEqual(converted.regions[0].shape, resolveAssetSpatialGeometry(old).regions[0].shape);
  assert.deepEqual(old, before);
});

test('legacy blocked fallback remains exclusive to legacy geometry', () => {
  const old = { metadata: { spanTiles: { width: 2, height: 1 }, collision: { mode: 'none', bounds: null, parts: [] }, navigation: { effect: 'blocked' } } };
  assert.deepEqual(resolveAssetSpatialGeometry(old).regions[0].shape, { kind: 'rectangle', x: 0, y: 0, width: 2, height: 1 });
  assert.equal(Object.hasOwn(old.metadata, 'spatial'), false);
});

test('explicit legacy conversion does not invent an extra grid cell from ratio roundoff', () => {
  for (const [width, span] of [[200, 7], [622, 3]]) {
    const old = { kind: 'surface', metadata: { spanTiles: { width: span, height: span }, anchor: { x: 0, y: 0 }, pixelSize: { width, height: width }, collision: { mode: 'none', bounds: null, parts: [] }, navigation: { effect: 'passable' } } };
    const s = spatialFromLegacyAsset(old); const aliases = spatialAliases(s);
    assert.deepEqual(aliases.spanTiles, old.metadata.spanTiles);
    assert.equal(s.unitsPerPixel.x, span / width, 'stored scale is unchanged');
    const geometry = resolveAssetSpatialGeometry({ ...old, metadata: { ...old.metadata, spatial: s, ...aliases } });
    assert.equal(geometry.placementBounds.width, span);
    assert.equal(geometry.imageBounds.width, span);
    assert.deepEqual(geometry.findings, []);
  }
});
