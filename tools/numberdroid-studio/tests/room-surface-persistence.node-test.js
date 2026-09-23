import assert from 'node:assert/strict';
import test from 'node:test';
import { planRoomSurfaces, ROOM_SURFACE_PLANNER_VERSION } from '../packages/domain/src/room-surface-plan.js';
import { assemblyFixture, owner, projectId } from './assembly-test-helpers.js';

function surfaceMetadata() {
  return {
    role: 'base', tags: ['surface-fixture'], variantGroup: null, compatibilityGroups: [],
    spanTiles: { width: 1, height: 1 }, anchor: { x: 0, y: 0 }, attachment: 'ground',
    rotationPolicy: 'cardinal', placement: { modes: ['manual', 'automatic'], wallSafe: true, tags: [], confirmation: 'confirmed' },
    collision: { mode: 'none', bounds: null, parts: [] }, navigation: { effect: 'passable', cost: null },
    runtimeEligible: false, connectors: [], continuityProfile: null, continuityTags: [],
    selectionPriority: 0, visualWeight: 'medium', extensions: {},
  };
}

function placement(x, y) {
  return {
    placementId: `floor.${x}.${y}`, assetId: 'surface.floor', assetVersion: 1, metadataVersion: 1,
    layer: 'STRUCTURAL_SURFACE', anchor: { x, y }, rotation: 0, variantTag: null,
    proposalId: null, proposalItemId: null,
  };
}

test('Surface apply rolls back atomically, retries exactly, and preserves historical pins after SQLite restart', { timeout: 120_000 }, async context => {
  const f = await assemblyFixture(context);
  for (const [assetId, name] of [['surface.floor', 'Floor'], ['surface.alt', 'Alternative']]) {
    await f.execute('asset.save', f.payload({ assetId, name, kind: 'surface', metadata: surfaceMetadata() }));
  }
  await f.execute('room.archetype.create', {
    roomArchetypeId: 'archetype.surface.persistence', kind: 'room', displayName: 'Surface persistence', tags: [],
    dimensionPolicy: { width: { min: 3, preferred: 3, max: 64 }, height: { min: 3, preferred: 3, max: 64 } },
    structuralBands: { left: 0, right: 0, top: 0, bottom: 0 }, orientation: 'any',
    connectorPolicy: { min: 0, max: 8, requiredSides: [] }, allowedAssetKinds: ['surface', 'prop', 'item'],
    allowedTags: [], requiredTags: [], rationality: 'neutral', governingRuleRefs: [],
  });
  await f.execute('room.variant.create', {
    roomVariantId: 'room.surface.persistence', roomArchetypeId: 'archetype.surface.persistence', archetypeVersion: 1,
    displayName: 'Surface persistence', width: 3, height: 3,
    intentTrace: [
      { layer: 'game_design', ruleId: 'fixture.game', summary: 'Game.', disposition: 'governing' },
      { layer: 'level_design', ruleId: 'fixture.level', summary: 'Level.', disposition: 'governing' },
      { layer: 'room_design', ruleId: 'fixture.room', summary: 'Room.', disposition: 'governing' },
    ],
    connectors: [], placements: Array.from({ length: 9 }, (_, index) => placement(index % 3, Math.floor(index / 3))),
  });

  const before = await f.studio.readProjectTrusted(projectId);
  const room = before.snapshot.roomLibrary.variants[0].versions.at(-1);
  const archetype = before.snapshot.roomLibrary.archetypes[0];
  const inputs = {
    plannerVersion: ROOM_SURFACE_PLANNER_VERSION, scopeCells: [{ x: 0, y: 0 }], policy: 'replace',
    pool: [{ assetId: 'surface.alt', assetVersion: 1, metadataVersion: 1 }], baseRotation: 0,
    randomRotation: false, seed: 'surface.persistence', placementIdPrefix: 'surface.persistence',
    overlapKeepPlacementIds: [],
  };
  const surfacePlan = planRoomSurfaces({ room, archetype, assets: before.snapshot.assetLibrary.assets, ...inputs });
  const request = await f.request('room.variant.surfaces.apply', {
    roomVariantId: room.roomVariantId, expectedRoomVariantVersion: room.version,
    ...inputs, planFingerprint: surfacePlan.fingerprint,
  });

  f.fault('after_room_variant_placement_insert');
  await assert.rejects(f.studio.execute(request, owner), /injected after_room_variant_placement_insert/);
  f.fault(null);
  assert.deepEqual(await f.studio.readProjectTrusted(projectId), before);
  assert.equal(Number(f.store.workspace.database.prepare(
    "SELECT count(*) AS count FROM room_variant_versions WHERE project_id = ? AND room_variant_id = 'room.surface.persistence'",
  ).get(projectId).count), 1);

  const applied = await f.studio.execute(request, owner);
  assert.equal(applied.value.roomVariant.version, 2);
  assert.equal((await f.studio.execute({ ...request, commandId: `${request.commandId}.replay` }, owner)).replayed, true);
  await f.execute('asset.save', f.payload({
    assetId: 'surface.alt', operation: 'update', expectedAssetVersion: 1, expectedMetadataVersion: 1,
    name: 'Alternative v2', kind: 'surface', metadata: surfaceMetadata(), image: { mode: 'retain' },
  }));
  await f.restart();
  const revisionBeforeRestartReplay = (await f.studio.readProjectTrusted(projectId)).revision;
  const restartedReplay = await f.studio.execute({ ...request, commandId: `${request.commandId}.restart-replay` }, owner);
  assert.equal(restartedReplay.replayed, true);
  assert.deepEqual(restartedReplay.value, applied.value);
  assert.equal((await f.studio.readProjectTrusted(projectId)).revision, revisionBeforeRestartReplay);
  const restarted = await f.studio.queryRooms({
    schemaVersion: 1, projectId, roomVariantId: 'room.surface.persistence', includeVersions: true,
  }, owner);
  assert.equal(restarted.variants[0].headVersion, 2);
  assert.equal(restarted.variants[0].versions.at(-1).placements.find(({ anchor }) => anchor.x === 0 && anchor.y === 0).assetVersion, 1);
  assert.equal(Number(f.store.workspace.database.prepare(
    "SELECT count(*) AS count FROM room_variant_versions WHERE project_id = ? AND room_variant_id = 'room.surface.persistence'",
  ).get(projectId).count), 2);
  const undone = await f.execute('room.variant.surfaces.undo', {
    roomVariantId: 'room.surface.persistence', expectedRoomVariantVersion: 2,
    appliedRoomVariantVersion: 2, appliedPlanFingerprint: surfacePlan.fingerprint,
  });
  assert.equal(undone.value.roomVariant.version, 3);
  assert.equal(undone.value.roomVariant.placements.length, 9);
  assert.equal(undone.value.roomVariant.placements.every(({ assetId, assetVersion, metadataVersion }) => (
    assetId === 'surface.floor' && assetVersion === 1 && metadataVersion === 1
  )), true);
  assert.equal(Number(f.store.workspace.database.prepare(
    "SELECT count(*) AS count FROM room_variant_versions WHERE project_id = ? AND room_variant_id = 'room.surface.persistence'",
  ).get(projectId).count), 3);
});
