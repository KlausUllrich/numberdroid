import assert from 'node:assert/strict';
import test from 'node:test';
import { createRoomSurfaceTools, surfacePlacementLabel, surfaceRectangle } from '../apps/studio-server/public/room-surface-editor.js';

const turn = () => new Promise(resolve => setImmediate(resolve));
function fixture({ send, assets = null, dirtyShape = false } = {}) {
  const asset = { assetId: 'surface.a', assetVersion: 1, metadataVersion: 1, name: 'Calm', kind: 'surface', metadata: {
    spanTiles: { width: 1, height: 1 }, rotationPolicy: 'cardinal', role: 'base',
    placement: { wallSafe: true }, connectors: [], continuityTags: [], continuityProfile: null,
  } };
  const context = {
    projectId: 'project.a', revision: 1, active: true, pinsReady: true, readOnly: false, dirtyShape,
    room: { roomVariantId: 'room.a', version: 1, width: 4, height: 4, lifecycle: 'DRAFT', placements: [], voidCells: [], blockedCells: [] },
    archetype: { structuralBands: { left: 0, right: 0, top: 0, bottom: 0 } },
    assets: assets ?? [asset], palette: [asset],
  };
  const requests = [], pending = [];
  const tools = createRoomSurfaceTools({ getContext: () => context,
    spanOf: value => value?.metadata.spanTiles, changed() {}, busyChanged() {},
    send: async (operation, request) => {
      requests.push(structuredClone({ operation, request }));
      if (send) return send(operation, request, context);
      return new Promise(resolve => pending.push(() => resolve(response(request, context))));
    },
    saved(result) { context.revision = result.revision; context.room = result.value.roomVariant; },
  });
  tools.sync(); tools.getState().pool.push({ assetId: asset.assetId, assetVersion: 1, metadataVersion: 1 });
  return { tools, context, asset, requests, pending };
}
function response(request, context) {
  const removed = new Set(request.plan.removals.map(value => value.placementId));
  const room = { ...context.room, version: request.body.expectedRoomVariantVersion + 1,
    placements: [...context.room.placements.filter(value => !removed.has(value.placementId)), ...request.plan.additions] };
  return { projectId: context.projectId, revision: request.body.expectedRevision + 1, value: {
    roomVariant: room, surfacePlan: request.plan,
    undoReceipt: { appliedRoomVariantVersion: room.version, appliedPlanFingerprint: request.plan.fingerprint },
  } };
}

test('rectangle selection is inclusive and stable in either drag direction', () => {
  assert.deepEqual(surfaceRectangle({ x: 3, y: 2 }, { x: 2, y: 1 }), [{ x: 2, y: 1 }, { x: 3, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 2 }]);
});

test('overlapping copies of the same Surface have distinguishable keep and removal labels', () => {
  const shared = { assetId: 'surface.a', anchor: { x: 2, y: 2 }, rotation: 0 };
  const first = surfacePlacementLabel({ ...shared, placementId: 'copy.one' }, { name: 'Calm' }, 0);
  const second = surfacePlacementLabel({ ...shared, placementId: 'copy.two' }, { name: 'Calm' }, 1);
  assert.notEqual(first, second); assert.match(first, /copy 1/); assert.match(second, /copy 2/);
  assert.match(first, /2,2, 0°/);
});

test('rapid paint serializes fresh requests against confirmed heads without dropping clicks', async () => {
  const { tools, requests, pending, context } = fixture();
  tools.clickCell({ x: 0, y: 0 }); tools.clickCell({ x: 1, y: 0 });
  assert.equal(requests.length, 1); assert.equal(tools.getState().queue.length, 1);
  pending.shift()(); await turn();
  assert.equal(requests.length, 2);
  assert.equal(requests[1].request.body.expectedRevision, 2);
  assert.notEqual(requests[0].request.body.idempotencyKey, requests[1].request.body.idempotencyKey);
  pending.shift()(); await turn();
  assert.equal(context.room.placements.length, 2); assert.equal(tools.hasUnresolved(), false);
  tools.clickCell({ x: 1, y: 0 }); await turn();
  assert.equal(requests.length, 2, 'same exact paint is a no-op without a POST');
});

test('unknown result retains the exact request, random rotation and key for retry', async () => {
  let fail = true;
  const { tools, requests, context } = fixture({ send: async (_operation, request, current) => {
    if (fail) throw new Error('Connection lost'); return response(request, current);
  } });
  tools.clickCell({ x: 2, y: 1 }); await turn();
  assert.equal(tools.hasUnresolved(), true); assert.equal(context.revision, 1);
  tools.clickCell({ x: 3, y: 1 }); await turn(); assert.equal(requests.length, 1);
  fail = false; await tools.retryPending();
  assert.deepEqual(requests[1], requests[0]); assert.equal(context.revision, 2);
  assert.equal(context.room.placements.length, 1); assert.equal(tools.hasUnresolved(), false);
});

test('a malformed successful response cannot advance local state and exact retry remains available', async () => {
  let malformed = true;
  const { tools, requests, context } = fixture({ send: async (_operation, request, current) => {
    const result = response(request, current);
    if (malformed) result.value.surfacePlan = { ...result.value.surfacePlan, fingerprint: 'f'.repeat(64) };
    return result;
  } });
  tools.clickCell({ x: 2, y: 1 }); await turn();
  assert.equal(context.revision, 1, 'unverified response must not advance the local project');
  assert.equal(context.room.placements.length, 0);
  assert.equal(tools.hasUnresolved(), true);
  assert.match(tools.getState().message, /Save not confirmed/);
  malformed = false; await tools.retryPending();
  assert.deepEqual(requests[1], requests[0], 'retry must preserve the original request and idempotency key');
  assert.equal(context.revision, 2); assert.equal(context.room.placements.length, 1);
});

test('dirty shape creates no pending or queued mutation and leaves save/discard reachable', async () => {
  const { tools, requests } = fixture({ dirtyShape: true });
  tools.clickCell({ x: 0, y: 0 }); await turn();
  assert.equal(requests.length, 0); assert.match(tools.getState().message, /Save or discard/);
  assert.equal(tools.hasUnresolved(), false);
});

test('unrelated large asset libraries do not change the exact Surface planning bound', async () => {
  const first = fixture();
  const assets = Array.from({ length: 1100 }, (_, index) => ({ ...first.asset, assetId: `unrelated.${index}` }));
  assets.push(first.asset);
  const { tools, requests } = fixture({ assets });
  tools.clickCell({ x: 0, y: 0 }); await turn();
  assert.equal(requests.length, 1);
});
