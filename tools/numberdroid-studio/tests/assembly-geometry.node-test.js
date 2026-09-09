import assert from 'node:assert/strict';
import test from 'node:test';
import { spatialAliases } from '../packages/domain/src/asset-spatial-geometry.js';
import {
  ASSEMBLY_DECLARATION_SCHEMA, ASSEMBLY_IDENTITY_MATRIX, assemblyAssetKey,
  assemblyShapeBounds, assemblyShapeContained, inverseAssemblyPoint,
  normalizeAssemblyDeclaration, normalizeAssemblyRegions, normalizeAssemblyTransform,
  resolveAssemblyScene, snapshotAssemblyBlocking, transformAssemblyPoint, validateAssemblyGeometry,
} from '../packages/domain/src/assembly-geometry.js';

const pin = (assetId = 'leaf.a', assetVersion = 1) => ({ assetId, assetVersion, metadataVersion: 1 });
const component = (extra = {}) => ({ componentId: 'body', name: 'Body', asset: pin(), position: { x: 200, y: 200 }, rotationDegrees: 0, scale: 1, stateIds: null, variantOverrides: [], ...extra });
function assembly(extra = {}) {
  return { schemaVersion: 1, coordinateSpace: 'assembly-pixels', unitsPerPixel: 1 / 64, placementBounds: { x: 0, y: 0, width: 512, height: 512 }, anchor: { x: 256, y: 480 },
    states: [{ stateId: 'idle', name: 'Idle' }, { stateId: 'ready', name: 'Ready' }], variants: [{ variantId: 'graphite', name: 'Graphite' }, { variantId: 'copper', name: 'Copper' }], defaultStateId: 'idle', defaultVariantId: 'graphite',
    components: [component()], blocking: { mode: 'components', regions: [] }, ...extra };
}
function leaf(extra = {}) {
  const spatial = { schemaVersion: 1, coordinateSpace: 'image-pixels', unitsPerPixel: { x: 0.01, y: 0.02 }, placementBounds: { x: 10, y: 20, width: 100, height: 100 }, anchor: { x: 25, y: 45 },
    blockingRegions: [{ regionId: 'oval', name: 'Oval', shape: { kind: 'oval', x: 20, y: 30, width: 60, height: 60 } }] };
  return { ...pin(), kind: 'prop', metadata: { ...spatialAliases(spatial), spatial, pixelSize: { width: 200, height: 100 }, navigation: { effect: 'blocked' } },
    sliceBinding: { projectId: 'project.a', mediaType: 'image/png', digest: 'a'.repeat(64), width: 200, height: 100 }, ...extra };
}
const resolve = (value = assembly(), assets = [leaf()], selection) => resolveAssemblyScene({ assembly: value, assets, selection, projectId: 'project.a' });
const close = (a, b) => assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)), `${a} != ${b}`);
function sameBounds(left, right) { for (const key of ['x', 'y', 'width', 'height']) close(left[key], right[key]); }

test('strict portable declaration preserves fractions, ordered components and explicit membership', () => {
  assert.equal(ASSEMBLY_DECLARATION_SCHEMA.additionalProperties, false);
  const source = assembly({ components: [component({ position: { x: -1.125, y: 2.5 }, rotationDegrees: -721.5, stateIds: [] })] });
  const value = normalizeAssemblyDeclaration(source);
  assert.equal(value.components[0].rotationDegrees, 358.5);
  assert.deepEqual(value.components[0].stateIds, []);
  assert.deepEqual(value.components[0].position, { x: -1.125, y: 2.5 });
  assert.equal(source.components[0].rotationDegrees, -721.5);
  assert.equal(normalizeAssemblyDeclaration(assembly({ components: [component({ rotationDegrees: 1.1 })] })).components[0].rotationDegrees, 1.1, 'already-normal rotation fractions remain exact');
  assert.equal(normalizeAssemblyDeclaration(assembly({ components: [component({ rotationDegrees: Number.EPSILON })] })).components[0].rotationDegrees, Number.EPSILON);
  assert.throws(() => normalizeAssemblyDeclaration({ ...source, unexpected: true }), /unexpected/);
  assert.throws(() => normalizeAssemblyDeclaration(assembly({ components: [component({ visible: false })] })), /visible/);
  assert.throws(() => normalizeAssemblyDeclaration(assembly({ components: [component({ scale: 0 })] })), /scale/);
  assert.throws(() => normalizeAssemblyDeclaration(assembly({ components: [component({ stateIds: ['missing'] })] })), /stateIds/);
  assert.throws(() => normalizeAssemblyDeclaration(assembly({ components: [component({ variantOverrides: [{ variantId: 'missing', asset: pin() }] })] })), /variantId/);
  assert.throws(() => normalizeAssemblyDeclaration(assembly({ defaultStateId: 'missing' })), /defaultStateId/);
  assert.throws(() => normalizeAssemblyDeclaration(assembly({ components: new Array(1) })), /sparse/);
  assert.throws(() => normalizeAssemblyDeclaration(assembly({ unitsPerPixel: 1 })), /64 project units/);
});

test('pixel matrix lands authored anchor exactly and retains unequal source scale at arbitrary rotation', () => {
  const source = assembly({ components: [component({ rotationDegrees: 37, scale: 1.25 })] }); const before = structuredClone(source);
  const scene = resolve(source); const draw = scene.elements[0];
  const mapped = transformAssemblyPoint({ x: 25, y: 45 }, draw.imageMatrix);
  close(mapped.x, 200); close(mapped.y, 200);
  const origin = transformAssemblyPoint({ x: 0, y: 0 }, draw.imageMatrix);
  const dx = transformAssemblyPoint({ x: 1, y: 0 }, draw.imageMatrix); const dy = transformAssemblyPoint({ x: 0, y: 1 }, draw.imageMatrix);
  close(Math.hypot(dx.x - origin.x, dx.y - origin.y), 0.8);
  close(Math.hypot(dy.x - origin.x, dy.y - origin.y), 1.6);
  const inverse = inverseAssemblyPoint(mapped, draw.imageMatrix); close(inverse.x, 25); close(inverse.y, 45);
  assert.deepEqual(source, before); assert.equal(scene.regions[0].shape.kind, 'oval');
});

test('analytic rotated oval bounds use its ellipse rather than its rotated frame', () => {
  const c = Math.SQRT1_2; const region = { shape: { kind: 'oval', x: -2, y: -1, width: 4, height: 2 }, transform: [c, c, -c, c, 10, 20] };
  const bounds = assemblyShapeBounds(region);
  close(bounds.width, Math.sqrt(10)); close(bounds.height, Math.sqrt(10));
  assert.equal(assemblyShapeContained(region, { x: 8.4, y: 18.4, width: 3.2, height: 3.2 }), true);
  assert.equal(assemblyShapeContained(region, { x: 9, y: 19, width: 2, height: 2 }), false);
});

test('custom snapshot absorbs scale, preserves oval orientation and leaves concave vertices exact', () => {
  const regions = resolve(assembly({ components: [component({ rotationDegrees: 41, scale: 1.7 })] })).regions;
  regions.push({ regionId: 'concave', name: 'L', shape: { kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 0, y: 2 }] }, transform: [0, 2, -2, 0, 10, 10] });
  const before = structuredClone(regions); const snapshot = snapshotAssemblyBlocking(regions);
  assert.equal(snapshot[0].shape.kind, 'oval');
  close(Math.hypot(snapshot[0].transform[0], snapshot[0].transform[1]), 1);
  assert.deepEqual(snapshot[1].transform, ASSEMBLY_IDENTITY_MATRIX);
  assert.equal(snapshot[1].shape.points.length, 6);
  assert.deepEqual(snapshot[1].shape.points[3], { x: 8, y: 12 });
  snapshot.forEach((region, index) => sameBounds(assemblyShapeBounds(region), assemblyShapeBounds(regions[index])));
  assert.deepEqual(regions, before);
});

test('custom regions stay fixed when component position and presentation change', () => {
  const regions = snapshotAssemblyBlocking(resolve().regions);
  const original = assembly({ blocking: { mode: 'custom', regions } });
  const changed = { ...original, components: [component({ position: { x: 400, y: 300 }, stateIds: ['ready'] })] };
  assert.deepEqual(resolve(original).regions, resolve(changed, [leaf()], { stateId: 'idle', variantId: 'copper' }).regions);
  assert.equal(resolve(changed).elements.length, 0);
  assert.equal(resolve(changed, [leaf()], { stateId: 'ready', variantId: 'copper' }).elements.length, 1);
});

test('variant stays selected across presentation state and exact old pins never resolve to head', () => {
  const copper = leaf({ ...pin('leaf.copper', 2), sliceBinding: { ...leaf().sliceBinding, digest: 'b'.repeat(64) } });
  const value = assembly({ components: [component({ variantOverrides: [{ variantId: 'copper', asset: pin('leaf.copper', 2) }] }), component({ componentId: 'cup', name: 'Cup', stateIds: ['ready'], position: { x: 300, y: 300 } })] });
  const assets = [leaf(), copper];
  const idle = resolve(value, assets, { variantId: 'copper', stateId: 'idle' }); const ready = resolve(value, assets, { variantId: 'copper', stateId: 'ready' });
  assert.equal(idle.elements[0].artifact.digest, 'b'.repeat(64)); assert.equal(ready.elements[0].artifact.digest, idle.elements[0].artifact.digest);
  assert.deepEqual(ready.elements.map((v) => v.componentId), ['body', 'cup']);
  assert.throws(() => resolve(value, [leaf({ assetVersion: 2 }), copper], { variantId: 'graphite' }), (error) => error.code === 'ASSEMBLY_ASSET_NOT_FOUND');
  assert.throws(() => resolve(value, assets, { stateId: 'unknown' }), /declared presentation state/);
});

test('all-choice validation checks unused pins and nonpreviewed out-of-bounds blocking', () => {
  const value = assembly({ components: [component(), component({ componentId: 'cup', stateIds: ['ready'], position: { x: 900, y: 900 } })] });
  assert.equal(resolve(value).findings.length, 0);
  const result = validateAssemblyGeometry({ assembly: value, assets: [leaf()], projectId: 'project.a' });
  assert.ok(result.findings.some((f) => f.ruleId === 'studio.assembly.blocking_out_of_bounds' && f.explanation.includes('/ready')));
  assert.equal(result.componentPins.length, 1); assert.ok(result.frameBounds.width > 512);
  const unused = assembly({ components: [component({ stateIds: [], variantOverrides: [{ variantId: 'copper', asset: pin('missing') }] })] });
  assert.equal(resolve(unused).elements.length, 0);
  assert.throws(() => validateAssemblyGeometry({ assembly: unused, assets: [leaf()], projectId: 'project.a' }), /missing/);
});

test('anchor and placement edits do not move artwork or inherited blocking', () => {
  const before = resolve();
  const after = resolve(assembly({ placementBounds: { x: -20, y: -20, width: 550, height: 550 }, anchor: { x: -500, y: 500 } }));
  assert.deepEqual(after.elements, before.elements); assert.deepEqual(after.regions, before.regions);
  assert.deepEqual(after.anchor, { x: -500, y: 500 });
});

test('unsupported nesting, media, foreign project, wrong image facts and duplicate exact records fail', () => {
  for (const source of [leaf({ assembly: {} }), leaf({ sliceBinding: { ...leaf().sliceBinding, mediaType: 'image/webp' } }), leaf({ sliceBinding: { ...leaf().sliceBinding, projectId: 'foreign' } }), leaf({ sliceBinding: { ...leaf().sliceBinding, width: 99 } })]) assert.throws(() => resolve(assembly(), [source]));
  assert.throws(() => resolve(assembly(), [leaf(), leaf()]), (e) => e.code === 'ASSEMBLY_ASSET_DUPLICATE');
  assert.equal(assemblyAssetKey(pin()), 'leaf.a@1:1');
});

test('proper custom transforms reject shear/reflection/extra scale and malformed polygons', () => {
  for (const transform of [[2, 0, 0, 2, 0, 0], [1, 0, 1, 1, 0, 0], [-1, 0, 0, 1, 0, 0], [1, 0, 0, 1, Infinity, 0]]) assert.throws(() => normalizeAssemblyTransform(transform));
  const region = { regionId: 'l', name: 'L', shape: { kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 0 }] }, transform: [1, 0, 0, 1, 0, 0] };
  assert.throws(() => normalizeAssemblyRegions([region]), (error) => error.details.field.startsWith('assembly.blocking.regions[0].shape.points'));
});

test('resolved scene resource limits reject excessive positive scale without clamping', () => {
  const value = assembly({ unitsPerPixel: 0.000001, components: [component({ scale: 1000 })] });
  assert.throws(() => resolve(value), /1000000|1,000,000/);
  assert.equal(value.components[0].scale, 1000);
});

test('inherited region identifiers distinguish legal delimiter-containing component/source IDs', () => {
  const first = leaf(); first.metadata.spatial.blockingRegions[0].regionId = 'b:c';
  const second = leaf({ ...pin('leaf.second') }); second.metadata.spatial.blockingRegions[0].regionId = 'c';
  const value = assembly({ components: [component({ componentId: 'a' }), component({ componentId: 'a:b', asset: pin('leaf.second') })] });
  const scene = resolve(value, [first, second]);
  assert.equal(new Set(scene.regions.map((region) => region.regionId)).size, 2);
});
