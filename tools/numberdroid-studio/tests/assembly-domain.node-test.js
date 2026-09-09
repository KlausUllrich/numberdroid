import assert from 'node:assert/strict';
import test from 'node:test';
import { ASSEMBLY_DECLARATION_SCHEMA, ASSEMBLY_METADATA_SCHEMA, assemblyFingerprint, normalizeAssemblyMetadata, validateAssemblyDefinition } from '../packages/domain/src/assembly-definition.js';

const pin = { assetId: 'leaf.a', assetVersion: 1, metadataVersion: 1 };
function leaf() {
  const digest = 'a'.repeat(64);
  return { ...pin, kind: 'prop', metadata: { pixelSize: { width: 128, height: 64 }, spanTiles: { width: 2, height: 1 }, anchor: { x: 0, y: 0 }, collision: { mode: 'none', bounds: null, parts: [] }, navigation: { effect: 'passable' } },
    sliceBinding: { projectId: 'project.a', sliceId: 'slice.a', sliceVersion: 1, atlasId: 'atlas.a', sourceId: 'source.a', sourceDigest: 'b'.repeat(64), definitionVersion: 1, definitionFingerprint: 'c'.repeat(64), rectangleId: 'rectangle.a',
      rectangle: { x: 0, y: 0, width: 128, height: 64, included: true, pivot: null, transparentPaddingPolicy: 'preserve', replacesSliceId: null, expectedSliceVersion: null },
      processorId: 'processor.a', digest, artifactUri: `studio://artifacts/sha256/${digest}`, mediaType: 'image/png', byteSize: 400, width: 128, height: 64, priorDigest: null, committedRevision: 1 } };
}
function input() {
  return { assetId: 'assembly.a', name: 'Machine', kind: 'prop', metadata: { role: null, tags: ['machine'] }, projectId: 'project.a', assets: [leaf()], assembly: {
    schemaVersion: 1, coordinateSpace: 'assembly-pixels', unitsPerPixel: 1 / 64, placementBounds: { x: 0, y: 0, width: 256, height: 256 }, anchor: { x: 128, y: 200 },
    states: [{ stateId: 'idle', name: 'Idle' }], variants: [{ variantId: 'default', name: 'Default' }], defaultStateId: 'idle', defaultVariantId: 'default',
    components: [{ componentId: 'body', name: 'Body', asset: pin, position: { x: 100, y: 100 }, rotationDegrees: 0, scale: 1, stateIds: null, variantOverrides: [] }], blocking: { mode: 'components', regions: [] },
  } };
}

test('published strict schemas have no source authority or invented slice fields', () => {
  assert.equal(ASSEMBLY_METADATA_SCHEMA.additionalProperties, false);
  assert.equal(ASSEMBLY_DECLARATION_SCHEMA.additionalProperties, false);
  assert.deepEqual(Object.keys(ASSEMBLY_METADATA_SCHEMA.properties), ['role', 'tags']);
  assert.equal(ASSEMBLY_DECLARATION_SCHEMA.properties.components.maxItems, 32);
  assert.equal(ASSEMBLY_DECLARATION_SCHEMA.properties.blocking.properties.regions.maxItems, 512);
  assert.equal(Object.hasOwn(ASSEMBLY_DECLARATION_SCHEMA.properties, 'sliceBinding'), false);
});

test('canonical fingerprints preserve metadata version for name-only edits and include declaration/kind', () => {
  const original = input(); const before = structuredClone(original); const a = validateAssemblyDefinition(original);
  const b = validateAssemblyDefinition({ ...original, name: 'Renamed' });
  assert.equal(a.metadataFingerprint, b.metadataFingerprint); assert.notEqual(a.contentFingerprint, b.contentFingerprint);
  const changed = input(); changed.assembly.components[0].position.x += 0.125;
  assert.notEqual(a.metadataFingerprint, validateAssemblyDefinition(changed).metadataFingerprint);
  assert.notEqual(a.metadataFingerprint, validateAssemblyDefinition({ ...original, kind: 'item' }).metadataFingerprint);
  assert.equal(assemblyFingerprint({ a: 1, b: { c: 2 } }), assemblyFingerprint({ b: { c: 2 }, a: 1 }));
  assert.deepEqual(original, before); assert.deepEqual(a.componentPins, [pin]);
  assert.equal(a.findings[0].severity, 'WARNING'); assert.equal(a.findings[0].targetKind, 'assembly');
  assert.deepEqual(a.findings, validateAssemblyDefinition(original).findings);
});

test('metadata rejects authority fields, duplicate tags, sparse tags and absent required values', () => {
  assert.deepEqual(normalizeAssemblyMetadata({ role: ' prop ', tags: [' metal '] }), { role: 'prop', tags: ['metal'] });
  for (const metadata of [{ role: null, tags: [], grant: 'x' }, { role: null, tags: ['x', ' x '] }, { role: null, tags: new Array(1) }, { role: null }, { role: 'x'.repeat(65), tags: [] }]) assert.throws(() => normalizeAssemblyMetadata(metadata));
});

test('native definition validation checks the complete exact slice binding, not only digest/image size', () => {
  const source = input(); source.assets[0].sliceBinding.artifactUri = `studio://artifacts/sha256/${'b'.repeat(64)}`;
  assert.throws(() => validateAssemblyDefinition(source), /digest-derived/);
  const invalid = input(); invalid.assets[0].sliceBinding.rectangle.included = false;
  assert.throws(() => validateAssemblyDefinition(invalid), /included/);
});

test('large canonical declarations fail the byte bound without truncation', () => {
  const source = input(); const points = Array.from({ length: 64 }, (_, index) => ({ x: Math.cos(index * Math.PI / 32) * 100, y: Math.sin(index * Math.PI / 32) * 100 }));
  source.assembly.blocking.regions = Array.from({ length: 128 }, (_, index) => ({ regionId: `region.${index}`, name: 'Polygon', shape: { kind: 'polygon', points }, transform: [1, 0, 0, 1, 0, 0] }));
  assert.throws(() => validateAssemblyDefinition(source), /256 KiB/);
  assert.equal(source.assembly.blocking.regions.length, 128);
});
