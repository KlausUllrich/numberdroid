import assert from 'node:assert/strict';
import test from 'node:test';
import { StudioService } from '../packages/application/src/index.js';
import { StudioError } from '../packages/domain/src/index.js';
import { planRoomSurfaces } from '../packages/domain/src/room-surface-plan.js';
import { OWNER_CONTEXT, PROJECT_ID, command, createProject } from './test-helpers.js';

const PLANNER_VERSION = 'numberdroid-studio.room-surface-plan.v1';

class RoomStore {
  supportsAtomicAssetLibrary = true;
  supportsAtomicRoomDesigner = true;
  documents = new Map();

  async createProject(document) { this.documents.set(document.projectId, structuredClone(document)); }
  async loadProject(projectId) { return structuredClone(this.documents.get(projectId) ?? null); }
  async appendRevision(projectId, expectedRevision, revision) {
    const document = this.documents.get(projectId);
    if (document.revisions.at(-1).number !== expectedRevision) throw new StudioError('REVISION_CONFLICT', 'changed');
    document.revisions.push(structuredClone(revision));
  }
  async listProjects() { return []; }
  updateHead(projectId, update) { update(this.documents.get(projectId).revisions.at(-1).snapshot); }
}

function metadata() {
  return {
    role: 'base', tags: [], variantGroup: null, compatibilityGroups: [],
    spanTiles: { width: 1, height: 1 }, anchor: { x: 0, y: 0 }, attachment: 'ground',
    rotationPolicy: 'cardinal', placement: { modes: ['manual', 'automatic'], wallSafe: true, tags: [], confirmation: 'confirmed' },
    collision: { mode: 'none', bounds: null, parts: [] }, navigation: { effect: 'passable', cost: null },
    runtimeEligible: true, connectors: [], continuityProfile: null, continuityTags: [],
    selectionPriority: 0, visualWeight: 'medium', extensions: {},
  };
}

function asset(assetId) {
  return {
    assetId, assetVersion: 1, metadataVersion: 1, name: assetId, kind: 'surface', lifecycle: 'FINAL',
    metadata: metadata(), metadataFingerprint: '0'.repeat(64), findings: [], sliceBinding: {}, warningDispositions: [],
    createdAt: '2026-09-23T05:00:00.000Z', createdBy: 'designer.one',
    updatedAt: '2026-09-23T05:00:00.000Z', updatedBy: 'designer.one', proposal: null,
  };
}

function placement(x, y, assetId = 'asset.floor') {
  return {
    placementId: `floor.${x}.${y}`, assetId, assetVersion: 1, metadataVersion: 1,
    layer: 'STRUCTURAL_SURFACE', anchor: { x, y }, rotation: 0, variantTag: null,
    proposalId: null, proposalItemId: null,
  };
}

function studioCommand(type, expectedVersion, payload, suffix, dryRun = false) {
  return command({
    type, expectedVersion, payload, dryRun,
    commandId: `cmd.${suffix}`, idempotencyKey: `idem.${suffix}`,
  });
}

async function fixture() {
  const store = new RoomStore();
  let tick = 0;
  const studio = new StudioService({
    store, agentAttemptAuditReady: true,
    clock: () => new Date(Date.UTC(2026, 8, 23, 5, 0, tick++)).toISOString(),
  });
  await createProject(studio);
  store.updateHead(PROJECT_ID, (snapshot) => {
    snapshot.assetLibrary = { schemaVersion: 1, assets: [asset('asset.floor'), asset('asset.alt')], proposals: [] };
  });
  await studio.execute(studioCommand('room.archetype.create', 1, {
    roomArchetypeId: 'archetype.surface', kind: 'room', displayName: 'Surface room', tags: [],
    dimensionPolicy: { width: { min: 3, preferred: 3, max: 64 }, height: { min: 3, preferred: 3, max: 64 } },
    structuralBands: { left: 0, right: 0, top: 0, bottom: 0 }, orientation: 'any',
    connectorPolicy: { min: 0, max: 8, requiredSides: [] }, allowedAssetKinds: ['surface', 'prop', 'item'],
    allowedTags: [], requiredTags: [], rationality: 'neutral', governingRuleRefs: [],
  }, 'archetype'), OWNER_CONTEXT);
  await studio.execute(studioCommand('room.variant.create', 2, {
    roomVariantId: 'room.surface', roomArchetypeId: 'archetype.surface', archetypeVersion: 1,
    displayName: 'Surface room', width: 3, height: 3,
    intentTrace: [
      { layer: 'game_design', ruleId: 'rule.game', summary: 'Game.', disposition: 'governing' },
      { layer: 'level_design', ruleId: 'rule.level', summary: 'Level.', disposition: 'governing' },
      { layer: 'room_design', ruleId: 'rule.room', summary: 'Room.', disposition: 'governing' },
    ],
    connectors: [],
    placements: Array.from({ length: 9 }, (_, index) => placement(index % 3, Math.floor(index / 3))),
  }, 'room'), OWNER_CONTEXT);
  return { store, studio };
}

async function plannedPayload(store, overrides = {}) {
  const document = await store.loadProject(PROJECT_ID);
  const snapshot = document.revisions.at(-1).snapshot;
  const entry = snapshot.roomLibrary.variants[0];
  const room = entry.versions.find(({ version }) => version === entry.headVersion);
  const archetype = snapshot.roomLibrary.archetypes[0];
  const inputs = {
    plannerVersion: PLANNER_VERSION,
    scopeCells: [{ x: 0, y: 0 }], policy: 'replace',
    pool: [{ assetId: 'asset.alt', assetVersion: 1, metadataVersion: 1 }],
    baseRotation: 0, randomRotation: false, seed: 'seed.one',
    placementIdPrefix: 'surface.plan.one', overlapKeepPlacementIds: [],
    ...overrides,
  };
  const plan = planRoomSurfaces({ room, archetype, assets: snapshot.assetLibrary.assets, ...inputs });
  return { room, plan, payload: { roomVariantId: room.roomVariantId, expectedRoomVariantVersion: room.version, ...inputs, planFingerprint: plan.fingerprint } };
}

test('Surface dry-run and apply use one exact plan, one immutable version, and exact replay', async () => {
  const { store, studio } = await fixture();
  const { plan, payload } = await plannedPayload(store);
  const previewCommand = studioCommand('room.variant.surfaces.apply', 3, payload, 'surface.apply', true);
  const preview = await studio.execute(previewCommand, OWNER_CONTEXT);
  assert.equal(preview.dryRun, true);
  assert.equal(preview.revision, 3);
  assert.equal(preview.value.surfacePlan.fingerprint, plan.fingerprint);
  assert.equal((await store.loadProject(PROJECT_ID)).revisions.length, 3);

  const applied = await studio.execute({ ...previewCommand, dryRun: false }, OWNER_CONTEXT);
  assert.equal(applied.revision, 4);
  assert.equal(applied.value.roomVariant.version, 2);
  assert.equal(applied.value.surfacePlan.fingerprint, plan.fingerprint);
  assert.equal(applied.value.roomVariant.placements.find(({ anchor }) => anchor.x === 0 && anchor.y === 0).assetId, 'asset.alt');
  assert.equal(applied.value.undoReceipt.appliedRoomVariantVersion, 2);
  assert.equal((await store.loadProject(PROJECT_ID)).revisions.length, 4);

  const replay = await studio.execute({ ...previewCommand, dryRun: false }, OWNER_CONTEXT);
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.value, applied.value);
  assert.equal((await store.loadProject(PROJECT_ID)).revisions.length, 4);
});

test('Surface apply rejects drift and no-op writes without changing project history', async () => {
  const { store, studio } = await fixture();
  const { payload } = await plannedPayload(store);
  await assert.rejects(
    studio.execute(studioCommand('room.variant.surfaces.apply', 3, { ...payload, planFingerprint: 'f'.repeat(64) }, 'surface.drift'), OWNER_CONTEXT),
    (error) => error.code === 'ROOM_SURFACE_PLAN_DRIFT',
  );
  const noOp = await plannedPayload(store, {
    pool: [{ assetId: 'asset.floor', assetVersion: 1, metadataVersion: 1 }],
    placementIdPrefix: 'surface.plan.noop',
  });
  assert.equal(noOp.plan.noOp, true);
  await assert.rejects(
    studio.execute(studioCommand('room.variant.surfaces.apply', 3, noOp.payload, 'surface.noop'), OWNER_CONTEXT),
    (error) => error.code === 'ROOM_SURFACE_NO_CHANGES',
  );
  assert.equal((await store.loadProject(PROJECT_ID)).revisions.length, 3);
});

test('Surface undo is an exact head-gated compensating version and replays idempotently', async () => {
  const { store, studio } = await fixture();
  const { payload } = await plannedPayload(store);
  const applied = await studio.execute(studioCommand('room.variant.surfaces.apply', 3, payload, 'surface.to-undo'), OWNER_CONTEXT);
  const undoPayload = {
    roomVariantId: 'room.surface', expectedRoomVariantVersion: 2,
    appliedRoomVariantVersion: 2, appliedPlanFingerprint: applied.value.surfacePlan.fingerprint,
  };
  const undoCommand = studioCommand('room.variant.surfaces.undo', 4, undoPayload, 'surface.undo');
  const undone = await studio.execute(undoCommand, OWNER_CONTEXT);
  assert.equal(undone.value.roomVariant.version, 3);
  assert.equal(undone.value.roomVariant.placements.find(({ anchor }) => anchor.x === 0 && anchor.y === 0).assetId, 'asset.floor');
  assert.equal(undone.value.undoReceipt.compensatedRoomVariantVersion, 3);
  const replay = await studio.execute(undoCommand, OWNER_CONTEXT);
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.value, undone.value);

  await assert.rejects(studio.execute(studioCommand('room.variant.surfaces.undo', 5, {
    ...undoPayload, expectedRoomVariantVersion: 3,
  }, 'surface.undo.stale'), OWNER_CONTEXT), (error) => error.code === 'ROOM_SURFACE_UNDO_STALE');
  assert.equal((await store.loadProject(PROJECT_ID)).revisions.length, 5);
});
