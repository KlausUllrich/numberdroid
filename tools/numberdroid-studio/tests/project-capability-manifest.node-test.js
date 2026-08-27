import assert from 'node:assert/strict';
import test from 'node:test';
import {
  StudioError,
  canonicalProjectCapabilityManifestJson,
  projectCapabilityManifestSha256,
  validateProjectCapabilityManifest,
} from '../packages/domain/src/index.js';
import {
  NUMBERDROID_ADAPTER_VERSION,
  NUMBERDROID_PROJECT_CAPABILITY_FINGERPRINT,
  NUMBERDROID_PROJECT_CAPABILITY_MANIFEST,
} from '../packages/numberdroid-adapter/src/index.js';

function cloneManifest() {
  return structuredClone(NUMBERDROID_PROJECT_CAPABILITY_MANIFEST);
}

function rejectsWithCode(mutator, code) {
  const manifest = cloneManifest();
  mutator(manifest);
  assert.throws(
    () => validateProjectCapabilityManifest(manifest),
    (error) => error instanceof StudioError && error.code === code,
  );
}

test('Numberdroid capability profile separates LevelSpec vocabulary from implemented candidate operations', () => {
  const manifest = NUMBERDROID_PROJECT_CAPABILITY_MANIFEST;
  assert.equal(manifest.adapter.version, NUMBERDROID_ADAPTER_VERSION);
  assert.ok(Object.isFrozen(manifest));
  assert.ok(Object.isFrozen(manifest.operations));
  assert.deepEqual(manifest.operations.map(({ id }) => id), [
    'numberdroid.adapter.build-room-candidate',
    'numberdroid.adapter.snapshot-room-candidate',
    'numberdroid.compiler.compile-level-spec',
    'numberdroid.compiler.compile-workbench-plan',
    'numberdroid.compiler.validate-placement-overrides',
  ]);
  assert.equal(
    manifest.outputFormats.find(({ id }) => id === 'studio.project-document').version,
    3,
  );

  assert.deepEqual(manifest.vocabulary.actorKinds, ['encounter', 'staged']);
  assert.ok(manifest.vocabulary.actionKinds.includes('spawn-actor'));
  assert.ok(manifest.vocabulary.triggerKinds.includes('state-change'));
  assert.deepEqual(manifest.vocabulary.conditionKinds, []);
  assert.deepEqual(manifest.vocabulary.variableTypes, []);
  assert.ok(!manifest.vocabulary.triggerKinds.includes('actor-defeated'));
  assert.ok(!manifest.vocabulary.actionKinds.includes('drop-item'));
  assert.ok(!manifest.vocabulary.actionKinds.includes('show-text'));
  assert.ok(!manifest.vocabulary.actionKinds.includes('spawn-wave'));

  const unsupported = manifest.extensions['numberdroid.studio'].unsupportedFeatures;
  assert.ok(manifest.assetKinds.includes('item'));
  assert.ok(unsupported.includes('item-export'));
  assert.ok(unsupported.includes('floor-runtime-mapping'));
  assert.ok(unsupported.includes('actor-authoring'));
  assert.ok(unsupported.includes('typed-variables'));
  assert.ok(unsupported.includes('typed-conditions'));
  assert.ok(unsupported.includes('visible-text'));
  assert.ok(unsupported.includes('waves'));
  assert.ok(unsupported.includes('spawners'));
  for (const forbidden of ['materialize', 'commit', 'publish']) {
    assert.ok(unsupported.includes(forbidden));
    assert.ok(!manifest.operations.some(({ id }) => id.includes(forbidden)));
  }

  assert.match(NUMBERDROID_PROJECT_CAPABILITY_FINGERPRINT, /^[a-f0-9]{64}$/);
  assert.equal(
    NUMBERDROID_PROJECT_CAPABILITY_FINGERPRINT,
    '826a8b7942ccba97393f55efa356525529994ad34189446992a7dff58fe97049',
  );
  assert.equal(
    NUMBERDROID_PROJECT_CAPABILITY_FINGERPRINT,
    projectCapabilityManifestSha256(manifest),
  );
  assert.ok(canonicalProjectCapabilityManifestJson(manifest).endsWith('\n'));
});

test('capability normalization and SHA-256 fingerprint are deterministic for unordered contract sets', () => {
  const reordered = cloneManifest();
  reordered.assetKinds.reverse();
  reordered.modules.reverse();
  reordered.operations.reverse();
  reordered.outputFormats.reverse();
  reordered.limits.reverse();
  reordered.coordinateModel.units.reverse();
  reordered.coordinateModel.rotation.values.reverse();
  for (const values of Object.values(reordered.vocabulary)) values.reverse();
  for (const operation of reordered.operations) {
    operation.moduleIds.reverse();
    operation.inputFormatIds.reverse();
    operation.outputFormatIds.reverse();
  }

  assert.deepEqual(
    validateProjectCapabilityManifest(reordered),
    NUMBERDROID_PROJECT_CAPABILITY_MANIFEST,
  );
  assert.equal(
    canonicalProjectCapabilityManifestJson(reordered),
    canonicalProjectCapabilityManifestJson(NUMBERDROID_PROJECT_CAPABILITY_MANIFEST),
  );
  assert.equal(
    projectCapabilityManifestSha256(reordered),
    NUMBERDROID_PROJECT_CAPABILITY_FINGERPRINT,
  );
});

test('unknown versions, fields, operation kinds, modules, formats, and vocabulary groups fail closed', () => {
  rejectsWithCode((manifest) => { manifest.schemaVersion = 2; }, 'PROJECT_CAPABILITY_MANIFEST_SCHEMA_UNSUPPORTED');
  rejectsWithCode((manifest) => { manifest.kind = 'studio.project-capability-manifest.v2'; }, 'PROJECT_CAPABILITY_MANIFEST_INVALID');
  rejectsWithCode((manifest) => { manifest.unknown = true; }, 'PROJECT_CAPABILITY_MANIFEST_FIELD_FORBIDDEN');
  rejectsWithCode((manifest) => { manifest.adapter.unknown = true; }, 'PROJECT_CAPABILITY_MANIFEST_FIELD_FORBIDDEN');
  rejectsWithCode((manifest) => { manifest.coordinateModel.dimensions = 3; }, 'PROJECT_CAPABILITY_MANIFEST_SCHEMA_UNSUPPORTED');
  rejectsWithCode((manifest) => { manifest.coordinateModel.unknown = true; }, 'PROJECT_CAPABILITY_MANIFEST_FIELD_FORBIDDEN');
  rejectsWithCode((manifest) => { manifest.vocabulary.dialogueKinds = []; }, 'PROJECT_CAPABILITY_MANIFEST_FIELD_FORBIDDEN');
  rejectsWithCode((manifest) => { manifest.operations[0].kind = 'publish'; }, 'PROJECT_CAPABILITY_MANIFEST_INVALID');
  rejectsWithCode((manifest) => { manifest.operations[0].moduleIds.push('studio.unknown'); }, 'PROJECT_CAPABILITY_MANIFEST_REFERENCE_UNKNOWN');
  rejectsWithCode((manifest) => { manifest.operations[0].inputFormatIds.push('studio.unknown-format'); }, 'PROJECT_CAPABILITY_MANIFEST_REFERENCE_UNKNOWN');
});

test('duplicate capability identities fail instead of being silently deduplicated', () => {
  rejectsWithCode((manifest) => { manifest.assetKinds.push(manifest.assetKinds[0]); }, 'PROJECT_CAPABILITY_MANIFEST_DUPLICATE');
  rejectsWithCode((manifest) => { manifest.modules.push(structuredClone(manifest.modules[0])); }, 'PROJECT_CAPABILITY_MANIFEST_DUPLICATE');
  rejectsWithCode((manifest) => { manifest.vocabulary.actionKinds.push(manifest.vocabulary.actionKinds[0]); }, 'PROJECT_CAPABILITY_MANIFEST_DUPLICATE');
  rejectsWithCode((manifest) => { manifest.operations.push(structuredClone(manifest.operations[0])); }, 'PROJECT_CAPABILITY_MANIFEST_DUPLICATE');
  rejectsWithCode((manifest) => { manifest.outputFormats.push(structuredClone(manifest.outputFormats[0])); }, 'PROJECT_CAPABILITY_MANIFEST_DUPLICATE');
  rejectsWithCode((manifest) => { manifest.limits.push(structuredClone(manifest.limits[0])); }, 'PROJECT_CAPABILITY_MANIFEST_DUPLICATE');
  rejectsWithCode((manifest) => { manifest.coordinateModel.units.push(structuredClone(manifest.coordinateModel.units[0])); }, 'PROJECT_CAPABILITY_MANIFEST_DUPLICATE');
  rejectsWithCode((manifest) => { manifest.coordinateModel.rotation.values.push(0); }, 'PROJECT_CAPABILITY_MANIFEST_DUPLICATE');
});

test('limits and namespaced extensions stay bounded and free of authority, paths, URIs, and executable payloads', () => {
  rejectsWithCode((manifest) => { manifest.limits[0].value = 0; }, 'PROJECT_CAPABILITY_MANIFEST_INVALID');
  rejectsWithCode((manifest) => { manifest.extensions = { unnamespaced: {} }; }, 'PROJECT_CAPABILITY_EXTENSION_INVALID');
  rejectsWithCode((manifest) => { manifest.extensions['numberdroid.studio'].accessToken = 'unsafe'; }, 'PROJECT_CAPABILITY_EXTENSION_INVALID');
  rejectsWithCode((manifest) => { manifest.extensions['numberdroid.studio'].machinePath = '/tmp/unsafe'; }, 'PROJECT_CAPABILITY_EXTENSION_INVALID');
  rejectsWithCode((manifest) => { manifest.extensions['numberdroid.studio'].reference = 'https://example.invalid'; }, 'PROJECT_CAPABILITY_EXTENSION_INVALID');
  rejectsWithCode((manifest) => { manifest.extensions['numberdroid.studio'].command = 'echo unsafe'; }, 'PROJECT_CAPABILITY_EXTENSION_INVALID');
  rejectsWithCode((manifest) => {
    manifest.extensions['numberdroid.studio'].nested = { one: { two: { three: { four: { five: true } } } } };
  }, 'PROJECT_CAPABILITY_EXTENSION_INVALID');
});
