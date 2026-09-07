import assert from 'node:assert/strict';
import test from 'node:test';
import { createAssetAuthoringDraft, createAssetMetadataDraft, assetMetadataEditingEligibility, buildAssetAuthoringRequest, assetAuthoringConflict } from '../apps/studio-server/public/asset-authoring-state.js';
import { validateAssetProposal, validateAssetMetadataForVisualFacts } from '../packages/domain/src/asset-definition.js';

const context = { projectId: 'project.human', projectRevision: 7, sliceId: 'slice.saved', sliceVersion: 2,
  proposalId: 'proposal.human', itemId: 'item.human', assetId: 'asset.human', idempotencyKey: 'asset-authoring.request' };
function draft(overrides = {}) {
  const result = createAssetAuthoringDraft(context);
  Object.assign(result.values, { name: 'Human-authored Asset', role: 'Shared-room furnishing', ...overrides });
  return result;
}

test('all three single-slice kinds satisfy actual proposal and metadata validators without imagery authority', () => {
  for (const kind of ['surface', 'prop', 'item']) {
    const value = draft({ kind, role: kind, width: '2', height: '3', anchorX: '1', anchorY: '2',
      movement: kind === 'prop' ? 'blocked' : 'passable', wallSafe: kind === 'surface' ? 'true' : 'false' });
    const request = buildAssetAuthoringRequest(value);
    const { idempotencyKey, ...proposal } = request;
    assert.equal(idempotencyKey, context.idempotencyKey);
    const normalized = validateAssetProposal({ projectId: context.projectId, ...proposal });
    assert.equal(normalized.items.length, 1);
    const item = request.items[0];
    const metadata = validateAssetMetadataForVisualFacts({ assetId: item.assetId, kind, metadata: item.metadata,
      pixelSize: { width: 128, height: 192 }, pivot: null });
    assert.deepEqual(metadata.findings, []);
    assert.equal(item.expectedAssetVersion, 0); assert.equal(item.expectedMetadataVersion, 0);
    assert.equal(item.expectedSliceVersion, 2);
    assert.equal(item.metadata.runtimeEligible, false);
    assert.equal(item.metadata.placement.confirmation, 'proposed');
    assert.deepEqual(item.metadata.collision, kind === 'prop'
      ? { mode: 'bounds', bounds: { x: 0, y: 0, width: 2, height: 3 }, parts: [] }
      : { mode: 'none', bounds: null, parts: [] });
    for (const field of ['pixelSize', 'pivot', 'artifactUri', 'digest', 'sliceBinding', 'authorId']) {
      assert.equal(Object.hasOwn(item, field), false); assert.equal(Object.hasOwn(item.metadata, field), false);
    }
  }
});

test('empty, fractional, out-of-range and implicit boolean form values fail before submission', () => {
  const unassigned = createAssetAuthoringDraft(context);
  unassigned.values.name = 'Named but no purpose yet';
  assert.equal(unassigned.values.role, '');
  assert.throws(() => buildAssetAuthoringRequest(unassigned), /Asset role/);
  for (const values of [
    { name: '' }, { name: 'x'.repeat(161) }, { role: ' ' }, { role: 'x'.repeat(65) },
    { width: '' }, { width: ' ' }, { width: '1.5' }, { width: '1e1' }, { width: '0' }, { height: '65' },
    { anchorX: '' }, { anchorY: '-1' }, { anchorX: '1' }, { kind: 'actor' },
    { kind: 'surface', attachment: 'wall' }, { attachment: '' }, { rotationPolicy: 'any' },
    { movement: 'cost' }, { wallSafe: true }, { runtimeEligible: '' }, { visualWeight: 'unknown' },
  ]) assert.throws(() => buildAssetAuthoringRequest(draft(values)), Error, JSON.stringify(values));
});

test('wall attachment requires boundary suitability and its supported combination remains valid', () => {
  assert.throws(() => buildAssetAuthoringRequest(draft({ attachment: 'wall', wallSafe: 'false' })), /Choose “May touch a boundary” or another attachment/);
  const request = buildAssetAuthoringRequest(draft({ attachment: 'wall', wallSafe: 'true' }));
  const { idempotencyKey: _key, ...proposal } = request;
  validateAssetProposal({ projectId: context.projectId, ...proposal });
  const item = request.items[0];
  const validated = validateAssetMetadataForVisualFacts({ assetId: item.assetId, kind: item.kind, metadata: item.metadata, pixelSize: { width: 64, height: 64 }, pivot: null });
  assert.deepEqual(validated.findings, []);
  assert.equal(validated.metadata.attachment, 'wall');
  assert.equal(validated.metadata.placement.wallSafe, true);
});

test('context and slice conflicts reject foreign, stale, absent, and ambiguous saved imagery', () => {
  const value = draft(); const current = { projectId: context.projectId, projectRevision: 7, slices: [{ sliceId: context.sliceId, version: 2 }] };
  assert.equal(assetAuthoringConflict(value, current), null);
  for (const changed of [
    { ...current, projectId: 'project.foreign' }, { ...current, projectRevision: 8 },
    { ...current, slices: [] }, { ...current, slices: [{ sliceId: context.sliceId, version: 3 }] },
    { ...current, slices: [...current.slices, ...current.slices] },
  ]) assert.equal(typeof assetAuthoringConflict(value, changed), 'string');
  for (const changed of [{ ...context, sliceVersion: 0 }, { ...context, projectRevision: '7' }, { ...context, sliceId: '../slice' }, { ...context, digest: 'forged' }]) {
    assert.throws(() => createAssetAuthoringDraft(changed));
  }
});

test('a built request is immutable and independent of later edits while drafts remain editable', () => {
  const value = draft(); const request = buildAssetAuthoringRequest(value); const original = JSON.stringify(request);
  assert.ok(Object.isFrozen(value.context));
  assert.throws(() => { value.context.sliceVersion = 3; }, TypeError);
  value.values.name = 'Another proposed name'; value.values.width = '4'; value.values.runtimeEligible = 'true';
  assert.equal(JSON.stringify(request), original);
  assert.throws(() => { request.items[0].metadata.spanTiles.width = 9; }, TypeError);
  assert.throws(() => { request.items.push({}); }, TypeError);
  const updated = buildAssetAuthoringRequest(value);
  assert.equal(updated.items[0].name, 'Another proposed name');
  assert.equal(updated.items[0].metadata.runtimeEligible, true);
  assert.equal(updated.idempotencyKey, request.idempotencyKey); // UI freezes/reconciles the first submitted request.
});

function savedAsset() {
  const metadata = structuredClone(buildAssetAuthoringRequest(draft({ width: '2', height: '3', anchorX: '1', anchorY: '2', runtimeEligible: 'true' })).items[0].metadata);
  Object.assign(metadata, { tags: ['authored', 'keep'], variantGroup: 'furniture-family', compatibilityGroups: ['group.one'],
    connectors: [{ edge: 'north', offset: 0.5 }], continuityProfile: 'edge.family', continuityTags: ['joined'],
    selectionPriority: 17, extensions: { 'studio.test.authored': { artist: 'local', nested: ['kept', { weight: 2 }] } } });
  metadata.placement.tags = ['placement-authored']; metadata.placement.confirmation = 'confirmed';
  metadata.pixelSize = { width: 128, height: 192 }; metadata.pivot = { x: 10, y: 20 };
  return { assetId: context.assetId, assetVersion: 3, metadataVersion: 2, name: 'Existing furnishing', kind: 'prop',
    lifecycle: 'FINAL', metadata, sliceBinding: { sliceId: context.sliceId, sliceVersion: 2, mediaType: 'image/png',
      sourceId: 'source.original', atlasId: 'atlas.original' } };
}
function edit(asset = savedAsset()) {
  return createAssetMetadataDraft({ projectId: context.projectId, projectRevision: context.projectRevision,
    asset, proposalId: context.proposalId, itemId: context.itemId, idempotencyKey: context.idempotencyKey });
}

test('metadata revision preserves every unexposed authored field and the fixed image/kind', () => {
  const asset = savedAsset(); const before = structuredClone(asset); const value = edit(asset);
  assert.equal(value.values.name, asset.name); assert.equal(value.values.runtimeEligible, 'true');
  assert.equal(value.values.width, '2'); assert.equal(value.values.anchorY, '2');
  Object.assign(value.values, { name: 'Revised furnishing', width: '4', height: '5', anchorX: '2', anchorY: '4', visualWeight: 'heavy' });
  const request = buildAssetAuthoringRequest(value); const item = request.items[0];
  assert.equal(item.operation, 'update'); assert.equal(item.expectedAssetVersion, 3); assert.equal(item.expectedMetadataVersion, 2);
  assert.equal(item.assetId, asset.assetId); assert.equal(item.kind, asset.kind);
  assert.equal(item.sliceId, asset.sliceBinding.sliceId); assert.equal(item.expectedSliceVersion, 2);
  for (const key of ['tags', 'variantGroup', 'compatibilityGroups', 'connectors', 'continuityProfile', 'continuityTags', 'selectionPriority', 'extensions']) {
    assert.deepEqual(item.metadata[key], asset.metadata[key], key);
  }
  assert.deepEqual(item.metadata.placement, asset.metadata.placement);
  assert.deepEqual(item.metadata.collision.bounds, { x: 0, y: 0, width: 4, height: 5 });
  assert.equal(Object.hasOwn(item.metadata, 'pixelSize'), false); assert.equal(Object.hasOwn(item.metadata, 'pivot'), false);
  const { idempotencyKey: _key, ...proposal } = request;
  validateAssetProposal({ ...proposal, projectId: context.projectId });
  validateAssetMetadataForVisualFacts({ assetId: item.assetId, kind: item.kind, metadata: item.metadata,
    pixelSize: asset.metadata.pixelSize, pivot: asset.metadata.pivot });
  assert.deepEqual(asset, before); assert.ok(Object.isFrozen(value.baselineAsset.metadata.extensions));
  value.values.width = '6'; assert.equal(item.metadata.spanTiles.width, 4);
  value.values.kind = 'surface'; assert.throws(() => buildAssetAuthoringRequest(value), /identity, kind or image/);
});

test('a name-only revision preserves the complete typed metadata fingerprint', () => {
  const asset = savedAsset(); const value = edit(asset); value.values.name = 'Renamed only';
  const item = buildAssetAuthoringRequest(value).items[0];
  const original = structuredClone(asset.metadata); delete original.pixelSize; delete original.pivot;
  assert.deepEqual(item.metadata, original);
  const validate = (metadata) => validateAssetMetadataForVisualFacts({ assetId: asset.assetId, kind: asset.kind, metadata,
    pixelSize: asset.metadata.pixelSize, pivot: asset.metadata.pivot });
  assert.equal(validate(item.metadata).fingerprint, validate(original).fingerprint);
});

test('metadata editor refuses unsupported profiles instead of flattening their semantics', () => {
  assert.deepEqual(assetMetadataEditingEligibility(savedAsset()), { eligible: true, reason: null });
  const cases = [
    (asset) => { delete asset.sliceBinding; },
    (asset) => { asset.sliceBinding = { kind: 'processing-result' }; },
    (asset) => { asset.assetVersion = 0; },
    (asset) => { asset.metadata.placement.modes.push('automatic'); },
    (asset) => { asset.metadata.collision = { mode: 'parts', bounds: null, parts: [{ x: 0, y: 0, width: 1, height: 1 }] }; },
    (asset) => { asset.metadata.collision.bounds.width = 1; },
    (asset) => { asset.metadata.navigation = { effect: 'cost', cost: 2 }; },
  ];
  for (const mutate of cases) {
    const asset = savedAsset(); mutate(asset); const before = structuredClone(asset);
    assert.equal(assetMetadataEditingEligibility(asset).eligible, false);
    assert.throws(() => edit(asset)); assert.deepEqual(asset, before);
  }
});

test('metadata revision conflicts with recuts, changed Asset versions and unavailable baselines', () => {
  const asset = savedAsset(); const value = edit(asset);
  const current = { projectId: context.projectId, projectRevision: 7, slices: [{ sliceId: context.sliceId, version: 2 }], assets: [asset] };
  assert.equal(assetAuthoringConflict(value, current), null);
  for (const altered of [
    { ...current, projectRevision: 8 }, { ...current, slices: [{ sliceId: context.sliceId, version: 3 }] },
    { ...current, assets: [] }, { ...current, assets: [asset, asset] },
    { ...current, assets: [{ ...asset, assetVersion: 4 }] }, { ...current, assets: [{ ...asset, metadataVersion: 3 }] },
    { ...current, assets: [{ ...asset, kind: 'surface' }] },
  ]) assert.equal(typeof assetAuthoringConflict(value, altered), 'string');
  assert.equal(value.context.sliceVersion, 2); assert.equal(value.context.assetVersion, 3);
});
