import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ROOM_SURFACE_PLANNER_VERSION,
  findRoomSurfaceOverlaps,
  planRoomSurfaces,
  surfacePlanAssetEligibility,
} from '../packages/domain/src/room-surface-plan.js';

function asset(assetId, { assetVersion = 1, metadataVersion = 1, span = { width: 1, height: 1 },
  kind = 'surface', lifecycle = 'DRAFT', rotationPolicy = 'cardinal', wallSafe = true,
  role = 'base', continuityProfile = null, continuityTags = [], connectors = [], runtimeEligible = true } = {}) {
  return { assetId, assetVersion, metadataVersion, kind, lifecycle, metadata: {
    spanTiles: span, rotationPolicy, role, continuityProfile, continuityTags, connectors, runtimeEligible,
    placement: { wallSafe },
  } };
}

function placement(placementId, surface, x, y, rotation = 0, layer = 'STRUCTURAL_SURFACE') {
  return { placementId, assetId: surface.assetId, assetVersion: surface.assetVersion,
    metadataVersion: surface.metadataVersion, layer, anchor: { x, y }, rotation,
    variantTag: null, proposalId: null, proposalItemId: null };
}

function room(overrides = {}) {
  return { roomVariantId: 'room.surface-plan', version: 7, lifecycle: 'DRAFT', width: 4, height: 4,
    voidCells: [], blockedCells: [], placements: [], ...overrides };
}

function archetype(overrides = {}) {
  return { structuralBands: { left: 0, right: 0, top: 0, bottom: 0 }, ...overrides };
}

function cells(width, height, offsetX = 0, offsetY = 0) {
  return Array.from({ length: width * height }, (_, index) => ({ x: offsetX + index % width, y: offsetY + Math.floor(index / width) }));
}

function input(overrides = {}) {
  const base = asset('surface.base');
  return { room: room(), archetype: archetype(), assets: [base], plannerVersion: ROOM_SURFACE_PLANNER_VERSION,
    scopeCells: cells(4, 4), policy: 'replace', pool: [{ assetId: base.assetId, assetVersion: 1, metadataVersion: 1 }],
    baseRotation: 0, randomRotation: false, seed: 'seed.one', placementIdPrefix: 'fill', overlapKeepPlacementIds: [],
    ...overrides };
}

test('canonical plans are deterministic across input order and exact seed retry, while shuffle changes the arrangement', () => {
  const first = asset('surface.first');
  const second = asset('surface.second');
  const common = { assets: [second, first], pool: [second, first].map(({ assetId, assetVersion, metadataVersion }) => ({ assetId, assetVersion, metadataVersion })),
    scopeCells: [...cells(4, 4)].reverse(), randomRotation: true };
  const planned = planRoomSurfaces(input(common));
  const retry = planRoomSurfaces(input({ ...common, assets: [first, second], pool: [...common.pool].reverse() }));
  assert.deepEqual(retry, planned);
  assert.match(planned.fingerprint, /^[a-f0-9]{64}$/);
  const shuffled = planRoomSurfaces(input({ ...common, seed: 'seed.two' }));
  assert.notEqual(shuffled.fingerprint, planned.fingerprint);
  assert.notDeepEqual(shuffled.additions.map(({ assetId, rotation }) => [assetId, rotation]), planned.additions.map(({ assetId, rotation }) => [assetId, rotation]));
});

test('reapplying an exact pin, anchor and rotation is a true no-op', () => {
  const base = asset('surface.base');
  const existing = cells(4, 4).map(({ x, y }) => placement(`fill.${y}.${x}`, base, x, y));
  const plan = planRoomSurfaces(input({ room: room({ placements: existing }), assets: [base] }));
  assert.equal(plan.noOp, true);
  assert.equal(plan.counts.noOpCells, 16);
  assert.deepEqual(plan.removals, []);
  assert.deepEqual(plan.additions, []);
});

test('2x2 macros align to the post-band origin, include BLOCKED cells and reject VOID or partial scope', () => {
  const macro = asset('surface.macro', { span: { width: 2, height: 2 }, role: 'macro' });
  const validRoom = room({ width: 6, height: 6, blockedCells: [{ x: 2, y: 2 }] });
  const scope = cells(4, 4, 1, 1);
  const plan = planRoomSurfaces(input({ room: validRoom, archetype: archetype({ structuralBands: { left: 1, right: 1, top: 1, bottom: 1 } }),
    assets: [macro], pool: [macro], scopeCells: scope }));
  assert.deepEqual(plan.additions.map(({ anchor }) => anchor), [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 1, y: 3 }, { x: 3, y: 3 }]);
  assert.equal(plan.counts.emptyCellsFilled, 16);
  assert.throws(() => planRoomSurfaces(input({ room: { ...validRoom, voidCells: [{ x: 2, y: 2 }] }, assets: [macro], pool: [macro], scopeCells: scope })), error => error.code === 'ROOM_SURFACE_SCOPE_INVALID');
  assert.throws(() => planRoomSurfaces(input({ room: validRoom, assets: [macro], pool: [macro], scopeCells: scope.slice(1) })), error => error.code === 'ROOM_SURFACE_SCOPE_NOT_TILEABLE');
});

test('mixed pools require exact READY pins, one footprint class and compatible semantics', () => {
  const base = asset('surface.base', { lifecycle: 'DRAFT', runtimeEligible: false });
  const alternate = asset('surface.alternate', { lifecycle: 'FINAL', runtimeEligible: true });
  assert.equal(surfacePlanAssetEligibility(base, { baseRotation: 0, randomRotation: true }).eligible, true);
  assert.doesNotThrow(() => planRoomSurfaces(input({ assets: [base, alternate], pool: [base, alternate] })));
  assert.throws(() => planRoomSurfaces(input({ assets: [base], pool: [{ assetId: base.assetId, assetVersion: 2, metadataVersion: 1 }] })), error => error.code === 'ROOM_SURFACE_ASSET_NOT_FOUND');
  const macro = asset('surface.macro', { span: { width: 2, height: 2 }, role: 'base' });
  assert.throws(() => planRoomSurfaces(input({ assets: [base, macro], pool: [base, macro] })), error => error.code === 'ROOM_SURFACE_POOL_INCOMPATIBLE');
  const incompatible = asset('surface.other', { continuityProfile: 'other' });
  assert.throws(() => planRoomSurfaces(input({ assets: [base, incompatible], pool: [base, incompatible] })), error => error.code === 'ROOM_SURFACE_POOL_INCOMPATIBLE');
  const prop = asset('surface.not-really', { kind: 'prop' });
  assert.throws(() => planRoomSurfaces(input({ assets: [prop], pool: [prop] })), error => error.code === 'ROOM_SURFACE_ASSET_INELIGIBLE');
});

test('rectangular cardinal assets keep one rotated footprint class', () => {
  const rectangle = asset('surface.rectangle', { span: { width: 2, height: 1 } });
  const horizontal = planRoomSurfaces(input({ room: room({ width: 4, height: 2 }), assets: [rectangle], pool: [rectangle], scopeCells: cells(4, 2), randomRotation: true }));
  assert.deepEqual(new Set(horizontal.additions.map(({ rotation }) => rotation)), new Set([0, 180]));
  const vertical = planRoomSurfaces(input({ room: room({ width: 2, height: 4 }), assets: [rectangle], pool: [rectangle], scopeCells: cells(2, 4), baseRotation: 90, randomRotation: true }));
  assert.deepEqual(new Set(vertical.additions.map(({ rotation }) => rotation)), new Set([90, 270]));
});

test('empty-only retains existing cells while replace removes exact whole footprints', () => {
  const old = asset('surface.old');
  const next = asset('surface.next');
  const existing = placement('old.placement', old, 1, 1);
  const retained = planRoomSurfaces(input({ room: room({ placements: [existing] }), assets: [old, next], pool: [next], policy: 'emptyOnly' }));
  assert.equal(retained.counts.existingCellsRetained, 1);
  assert.equal(retained.removals.length, 0);
  assert.equal(retained.additions.length, 15);
  const replaced = planRoomSurfaces(input({ room: room({ placements: [existing] }), assets: [old, next], pool: [next], policy: 'replace' }));
  assert.deepEqual(replaced.removals, [{ placementId: 'old.placement', assetId: old.assetId, assetVersion: 1, metadataVersion: 1 }]);
  assert.equal(replaced.counts.existingCellsReplaced, 1);
  assert.equal(replaced.additions.length, 16);

  const macro = asset('surface.macro', { span: { width: 2, height: 2 } });
  assert.throws(() => planRoomSurfaces(input({ room: room({ width: 2, height: 2, placements: [existing] }),
    assets: [old, macro], pool: [macro], scopeCells: cells(2, 2), policy: 'emptyOnly' })),
  error => error.code === 'ROOM_SURFACE_SCOPE_NOT_TILEABLE');
});

test('overlap repair requires one explicit keeper and removes losers only with their whole footprint scoped', () => {
  const base = asset('surface.base');
  const a = placement('overlap.a', base, 1, 1);
  const b = placement('overlap.b', base, 1, 1);
  const overlappingRoom = room({ placements: [a, b] });
  assert.deepEqual(findRoomSurfaceOverlaps({ room: overlappingRoom, assets: [base] }), [{ cell: { x: 1, y: 1 }, placementIds: ['overlap.a', 'overlap.b'] }]);
  assert.throws(() => planRoomSurfaces(input({ room: overlappingRoom, assets: [base], pool: [], scopeCells: [{ x: 1, y: 1 }] })), error => error.code === 'ROOM_SURFACE_OVERLAP_REQUIRES_KEEP');
  const repair = planRoomSurfaces(input({ room: overlappingRoom, assets: [base], pool: [], scopeCells: [{ x: 1, y: 1 }], overlapKeepPlacementIds: ['overlap.a'] }));
  assert.deepEqual(repair.removals.map(({ placementId }) => placementId), ['overlap.b']);
  assert.equal(repair.additions.length, 0);
  assert.equal(repair.counts.existingCellsReplaced, 1);

  const macro = asset('surface.macro', { span: { width: 2, height: 1 } });
  const macroRoom = room({ placements: [placement('macro.a', macro, 0, 0), placement('macro.b', macro, 0, 0)] });
  assert.throws(() => planRoomSurfaces(input({ room: macroRoom, assets: [macro], pool: [], scopeCells: [{ x: 0, y: 0 }], overlapKeepPlacementIds: ['macro.a'] })), error => error.code === 'ROOM_SURFACE_PARTIAL_REPLACEMENT');
});

test('preflight rejects operation overlap, partial replacement and the 256 placement capacity', () => {
  const base = asset('surface.base');
  const macro = asset('surface.macro', { span: { width: 2, height: 1 } });
  const partialRoom = room({ width: 3, height: 1, placements: [placement('macro.old', macro, 0, 0)] });
  assert.throws(() => planRoomSurfaces(input({ room: partialRoom, assets: [macro, base], pool: [base], scopeCells: [{ x: 0, y: 0 }] })), error => error.code === 'ROOM_SURFACE_PARTIAL_REPLACEMENT');

  const props = Array.from({ length: 256 }, (_, index) => ({ ...placement(`prop.${index}`, base, 0, 0, 0, 'SET_DRESSING') }));
  assert.throws(() => planRoomSurfaces(input({ room: room({ width: 1, height: 1, placements: props }), assets: [base], scopeCells: [{ x: 0, y: 0 }] })), error => error.code === 'ROOM_SURFACE_CAPACITY_EXCEEDED');
});
