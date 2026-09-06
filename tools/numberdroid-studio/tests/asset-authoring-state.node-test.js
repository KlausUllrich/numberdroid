import assert from 'node:assert/strict';
import test from 'node:test';
import { createAssetAuthoringDraft, buildAssetAuthoringRequest, assetAuthoringConflict } from '../apps/studio-server/public/asset-authoring-state.js';
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
