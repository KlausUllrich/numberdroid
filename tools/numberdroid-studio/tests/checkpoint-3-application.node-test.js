import assert from 'node:assert/strict';
import test from 'node:test';
import { StudioService } from '../packages/application/src/index.js';
import { StudioError } from '../packages/domain/src/index.js';
import { AGENT_CONTEXT, OWNER_CONTEXT, PROJECT_ID, command, createProject, issueGrant } from './test-helpers.js';

class RoomReadyMemoryStore {
  supportsAtomicAssetLibrary = true;
  supportsAtomicRoomDesigner = true;
  documents = new Map();

  async createProject(document) {
    if (this.documents.has(document.projectId)) throw new StudioError('PROJECT_EXISTS', 'exists');
    this.documents.set(document.projectId, structuredClone(document));
  }

  async loadProject(projectId) {
    const value = this.documents.get(projectId);
    return value ? structuredClone(value) : null;
  }

  async appendRevision(projectId, expectedRevision, revision) {
    const document = this.documents.get(projectId);
    if (document.revisions.at(-1).number !== expectedRevision) throw new StudioError('REVISION_CONFLICT', 'changed');
    document.revisions.push(structuredClone(revision));
  }

  async listProjects() { return []; }

  updateHead(projectId, update) {
    update(this.documents.get(projectId).revisions.at(-1).snapshot);
  }
}

function assetMetadata({ kind = 'surface', collision = { mode: 'none', bounds: null, parts: [] } } = {}) {
  return {
    role: kind === 'surface' ? 'base' : 'furniture', tags: ['domestic'], variantGroup: null,
    compatibilityGroups: [], spanTiles: { width: 1, height: 1 }, anchor: { x: 0, y: 0 },
    attachment: 'ground', rotationPolicy: kind === 'surface' ? 'fixed' : 'cardinal',
    placement: { modes: ['manual'], wallSafe: true, tags: [], confirmation: 'confirmed' },
    collision, navigation: { effect: collision.mode === 'none' ? 'passable' : 'blocked', cost: null },
    runtimeEligible: true, connectors: [], continuityProfile: null, continuityTags: [],
    selectionPriority: 0, visualWeight: 'medium', extensions: {},
  };
}

function seededAsset(assetId, kind, metadata) {
  return {
    assetId, assetVersion: 1, metadataVersion: 1, name: assetId, kind, lifecycle: 'FINAL',
    metadata, metadataFingerprint: '0'.repeat(64), findings: [], sliceBinding: {},
    warningDispositions: [], createdAt: '2026-08-22T09:00:00.000Z', createdBy: 'designer.one',
    updatedAt: '2026-08-22T09:00:00.000Z', updatedBy: 'designer.one', proposal: null,
  };
}

function placement({ placementId, assetId, x, y, layer, proposalId = null, proposalItemId = null }) {
  return {
    placementId, assetId, assetVersion: 1, metadataVersion: 1, layer,
    anchor: { x, y }, rotation: 0, variantTag: null, proposalId, proposalItemId,
  };
}

function floorPlacements(width = 4, height = 3) {
  const values = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) values.push(placement({ placementId: `floor.${x}.${y}`, assetId: 'asset.floor', x, y, layer: 'STRUCTURAL_SURFACE' }));
  }
  return values;
}

function roomCommand({ type, expectedVersion, payload, suffix = type }) {
  return command({ commandId: `cmd.${suffix}.${expectedVersion}`, idempotencyKey: `idem.${suffix}.${expectedVersion}`, type, expectedVersion, payload });
}

async function fixture() {
  const store = new RoomReadyMemoryStore();
  let tick = 0;
  const studio = new StudioService({
    store, agentAttemptAuditReady: true,
    clock: () => new Date(Date.UTC(2026, 7, 22, 10, 0, tick++)).toISOString(),
  });
  await createProject(studio);
  store.updateHead(PROJECT_ID, (snapshot) => {
    snapshot.assetLibrary = {
      schemaVersion: 1,
      assets: [
        seededAsset('asset.floor', 'surface', assetMetadata()),
        seededAsset('asset.table', 'prop', assetMetadata({ kind: 'prop', collision: { mode: 'bounds', bounds: { x: 0, y: 0, width: 1, height: 1 }, parts: [] } })),
      ],
      proposals: [],
    };
  });
  await issueGrant(studio, {
    scopes: ['project.read', 'room.proposal.submit'],
    budget: { maxCommands: 4, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 },
  });
  await studio.execute(roomCommand({
    type: 'room.archetype.create', expectedVersion: 2,
    payload: {
      roomArchetypeId: 'archetype.domestic', kind: 'room', displayName: 'Domestic room', tags: ['domestic'],
      dimensionPolicy: { width: { min: 3, preferred: 10, max: 64 }, height: { min: 3, preferred: 8, max: 64 } },
      structuralBands: { left: 0, right: 0, top: 0, bottom: 0 }, orientation: 'any',
      connectorPolicy: { min: 1, max: 8, requiredSides: [] }, allowedAssetKinds: ['surface', 'prop', 'item'],
      allowedTags: [], requiredTags: [], rationality: 'domestic',
      governingRuleRefs: [{ ruleId: 'gd.function-first', summary: 'Function before form.' }],
    },
  }), OWNER_CONTEXT);
  await studio.execute(roomCommand({
    type: 'room.variant.create', expectedVersion: 3,
    payload: {
      roomVariantId: 'room.family-table', roomArchetypeId: 'archetype.domestic', archetypeVersion: 1,
      displayName: 'Family Table Room', width: 4, height: 3,
      intentTrace: [
        { layer: 'game_design', ruleId: 'gd.function-first', summary: 'Function before form.', disposition: 'governing' },
        { layer: 'level_design', ruleId: 'ld.distinct', summary: 'Rooms and halls remain distinct.', disposition: 'governing' },
        { layer: 'room_design', ruleId: 'rd.domestic', summary: 'Supports domestic use.', disposition: 'governing' },
      ],
      connectors: [{ connectorId: 'connector.west', side: 'west', offset: 1, width: 1, kind: 'standard-door', clearanceInside: 1, clearanceOutside: 1, required: true, tags: [], compatibilityProfile: 'door.standard' }],
      placements: floorPlacements(),
    },
  }), OWNER_CONTEXT);
  return { store, studio };
}

function proposal(expectedVersion = 4) {
  return roomCommand({
    type: 'room.placement.proposal.submit', expectedVersion, suffix: 'room.proposal',
    payload: {
      proposalId: 'proposal.set-dressing', roomVariantId: 'room.family-table', expectedRoomVariantVersion: 1,
      items: [{
        itemId: 'item.table', operation: 'add',
        placement: placement({ placementId: 'prop.table', assetId: 'asset.table', x: 2, y: 1, layer: 'SET_DRESSING' }),
        placementId: null, expectedAssetId: null, anchor: null, rotation: null,
      }],
    },
  });
}

async function editorFixture() {
  const value = await fixture();
  const query = await value.studio.queryRooms({ schemaVersion: 1, projectId: PROJECT_ID, roomVariantId: 'room.family-table' }, OWNER_CONTEXT);
  const room = query.variants[0].current;
  const payload = {
    roomVariantId: room.roomVariantId, expectedRoomVariantVersion: room.version,
    width: room.width, height: room.height, voidCells: [], blockedCells: [],
    intentTrace: structuredClone(room.intentTrace), connectors: structuredClone(room.connectors),
    addPlacements: [], moves: [], removePlacements: [],
  };
  return { ...value, room, payload, command: roomCommand({ type: 'room.variant.editor.save', expectedVersion: 4, payload }) };
}

test('atomic owner editor Save checks one combined draft, preserves exact pins, and replays one version', async () => {
  const { studio, store, room, payload, command: save } = await editorFixture();
  payload.width = 5;
  payload.voidCells = [{ x: 4, y: 0 }];
  payload.blockedCells = [{ x: 4, y: 2 }];
  payload.intentTrace[2].summary = 'Saved combined editor changes.';
  payload.connectors[0].offset = 2;
  payload.removePlacements = [{ placementId: 'floor.0.0', expectedAssetId: 'asset.floor' }];
  payload.moves = [{ placementId: 'floor.1.0', expectedAssetId: 'asset.floor', anchor: { x: 4, y: 1 }, rotation: 0 }];
  payload.addPlacements = [placement({ placementId: 'new.table', assetId: 'asset.table', x: 3, y: 1, layer: 'SET_DRESSING' })];
  const before = await store.loadProject(PROJECT_ID);
  const dry = await studio.execute({ ...save, dryRun: true }, OWNER_CONTEXT);
  assert.equal(dry.dryRun, true);
  assert.deepEqual(await store.loadProject(PROJECT_ID), before);
  const result = await studio.execute(save, OWNER_CONTEXT);
  assert.equal(result.revision, 5); assert.equal(result.value.roomVariantVersion, 2);
  const saved = result.value.roomVariant;
  assert.equal(saved.width, 5); assert.equal(saved.placements.length, 12);
  assert.deepEqual(saved.voidCells, payload.voidCells);
  assert.deepEqual(saved.blockedCells, payload.blockedCells);
  assert.deepEqual(saved.connectors, payload.connectors);
  assert.deepEqual(saved.intentTrace, payload.intentTrace);
  const oldPin = room.placements.find(value => value.placementId === 'floor.1.0');
  const moved = saved.placements.find(value => value.placementId === oldPin.placementId);
  assert.deepEqual(moved, { ...oldPin, anchor: { x: 4, y: 1 } });
  assert.equal(saved.contentFingerprint, result.value.contentFingerprint);
  assert.ok(saved.findings.some(value => value.severity === 'ERROR'), 'Incomplete DRAFTs save truthful findings, not fake success.');
  assert.deepEqual((await store.loadProject(PROJECT_ID)).revisions.slice(0, -1), before.revisions);
  assert.deepEqual(await studio.execute(save, OWNER_CONTEXT), { ...result, replayed: true });
  assert.equal((await store.loadProject(PROJECT_ID)).revisions.length, before.revisions.length + 1);
});

test('atomic editor Save fails closed on authority, CAS, duplicate operations, pins and forged version fields', async () => {
  const { studio, store, payload, command: save } = await editorFixture();
  const before = await store.loadProject(PROJECT_ID);
  await assert.rejects(studio.execute(save, AGENT_CONTEXT), error => error.code === 'FORBIDDEN');
  await assert.rejects(studio.execute(save, { ...OWNER_CONTEXT, actor: { ...OWNER_CONTEXT.actor, id: 'other.owner' } }), error => error.code === 'FORBIDDEN');
  await assert.rejects(studio.execute({ ...save, baseRevision: 3, expectedVersion: 3 }, OWNER_CONTEXT), error => error.code === 'REVISION_CONFLICT');
  const attempt = async (change, code) => {
    const modified = structuredClone(save); change(modified.payload);
    await assert.rejects(studio.execute(modified, OWNER_CONTEXT), error => error.code === code, code);
    assert.deepEqual(await store.loadProject(PROJECT_ID), before);
  };
  await attempt(value => { value.expectedRoomVariantVersion = 9; }, 'ENTITY_VERSION_CONFLICT');
  await attempt(value => { value.lifecycle = 'FINAL'; }, 'VALIDATION_ERROR');
  await attempt(value => { delete value.intentTrace; }, 'VALIDATION_ERROR');
  await attempt(value => { value.moves = [{ placementId: 'floor.1.0', expectedAssetId: 'asset.table', anchor: { x: 2, y: 0 }, rotation: 0 }]; }, 'ENTITY_VERSION_CONFLICT');
  await attempt(value => { value.moves = [{ placementId: 'floor.1.0', expectedAssetId: 'asset.floor', anchor: { x: 2, y: 0 }, rotation: 0, metadataVersion: 9 }]; }, 'VALIDATION_ERROR');
  await attempt(value => { value.removePlacements = [{ placementId: 'floor.1.0', expectedAssetId: 'asset.floor' }]; value.addPlacements = [structuredClone(before.revisions.at(-1).snapshot.roomLibrary.variants[0].versions[0].placements.find(item => item.placementId === 'floor.1.0'))]; }, 'ROOM_PLACEMENT_DUPLICATE');
  await attempt(value => { value.addPlacements = [{ ...placement({ placementId: 'new.bad', assetId: 'asset.table', x: 2, y: 1, layer: 'SET_DRESSING' }), metadataVersion: 99 }]; }, 'ROOM_ASSET_VERSION_NOT_FOUND');
  await attempt(value => { value.addPlacements = [{ ...placement({ placementId: 'new.bad', assetId: 'asset.table', x: 2, y: 1, layer: 'SET_DRESSING' }), proposalId: 'forged.proposal' }]; }, 'UNTRUSTED_AUTHORITY_FIELD');
  await attempt(value => { value.moves = Array.from({ length: 257 }, () => ({ placementId: 'floor.1.0', expectedAssetId: 'asset.floor', anchor: { x: 2, y: 0 }, rotation: 0 })); }, 'ROOM_PLACEMENT_LIMIT');
  await attempt(value => { value.width = 3; }, 'ROOM_RESIZE_CLIPS_CONTENT');
  assert.equal(payload.addPlacements.length, 0);
});

test('atomic editor Save evaluates final Surface swaps, not intermediate overlap', async () => {
  const { studio, payload, command: save } = await editorFixture();
  payload.moves = [
    { placementId: 'floor.1.0', expectedAssetId: 'asset.floor', anchor: { x: 2, y: 0 }, rotation: 0 },
    { placementId: 'floor.2.0', expectedAssetId: 'asset.floor', anchor: { x: 1, y: 0 }, rotation: 0 },
  ];
  const result = await studio.execute(save, OWNER_CONTEXT);
  assert.equal(result.value.roomVariant.findings.filter(value => value.severity === 'ERROR').length, 0);
  assert.equal(result.value.roomVariantVersion, 2);
});

test('room archetype and DRAFT variant preserve intent, exact pins, and deterministic findings', async () => {
  const { studio } = await fixture();
  const result = await studio.queryRooms({ schemaVersion: 1, projectId: PROJECT_ID, roomVariantId: 'room.family-table', includeVersions: true }, OWNER_CONTEXT);
  assert.equal(result.revision, 4);
  assert.equal(result.variants[0].archetype.kind, 'room');
  assert.equal(result.variants[0].current.placements.length, 12);
  assert.equal(result.variants[0].current.findings.length, 0);
  assert.equal(result.variants[0].versions.length, 1);
  assert.match(result.variants[0].current.contentFingerprint, /^[a-f0-9]{64}$/);
});

test('owner placement add, move/rotate, and remove each create one immutable version and replay once', async () => {
  const { studio } = await fixture();
  const add = roomCommand({
    type: 'room.variant.placements.add', expectedVersion: 4, suffix: 'room.direct.add',
    payload: {
      roomVariantId: 'room.family-table', expectedRoomVariantVersion: 1,
      placements: [placement({ placementId: 'prop.direct-table', assetId: 'asset.table', x: 2, y: 1, layer: 'SET_DRESSING' })],
    },
  });
  const added = await studio.execute(add, OWNER_CONTEXT);
  const addReplay = await studio.execute(add, OWNER_CONTEXT);
  assert.equal(added.revision, 5);
  assert.equal(added.value.roomVariantVersion, 2);
  assert.equal(addReplay.replayed, true);
  assert.deepEqual({ ...addReplay, replayed: false }, added);
  await assert.rejects(studio.execute({
    ...structuredClone(add),
    payload: { ...structuredClone(add.payload), placements: [placement({ placementId: 'prop.direct-table', assetId: 'asset.table', x: 3, y: 2, layer: 'SET_DRESSING' })] },
  }, OWNER_CONTEXT), (error) => error.code === 'IDEMPOTENCY_CONFLICT');
  await assert.rejects(studio.execute(roomCommand({
    type: 'room.variant.placements.move', expectedVersion: 4, suffix: 'room.direct.stale-project',
    payload: {
      roomVariantId: 'room.family-table', expectedRoomVariantVersion: 2,
      moves: [{ placementId: 'prop.direct-table', expectedAssetId: 'asset.table', anchor: { x: 2, y: 2 }, rotation: 0 }],
    },
  }), OWNER_CONTEXT), (error) => error.code === 'REVISION_CONFLICT');
  await assert.rejects(studio.execute(roomCommand({
    type: 'room.variant.placements.move', expectedVersion: 5, suffix: 'room.direct.stale-room',
    payload: {
      roomVariantId: 'room.family-table', expectedRoomVariantVersion: 1,
      moves: [{ placementId: 'prop.direct-table', expectedAssetId: 'asset.table', anchor: { x: 2, y: 2 }, rotation: 0 }],
    },
  }), OWNER_CONTEXT), (error) => error.code === 'ENTITY_VERSION_CONFLICT');
  await assert.rejects(studio.execute(roomCommand({
    type: 'room.variant.placements.move', expectedVersion: 5, suffix: 'room.direct.wrong-asset',
    payload: {
      roomVariantId: 'room.family-table', expectedRoomVariantVersion: 2,
      moves: [{ placementId: 'prop.direct-table', expectedAssetId: 'asset.floor', anchor: { x: 2, y: 2 }, rotation: 0 }],
    },
  }), OWNER_CONTEXT), (error) => error.code === 'ENTITY_VERSION_CONFLICT');
  assert.equal((await studio.readProjectTrusted(PROJECT_ID)).revision, 5);

  const move = roomCommand({
    type: 'room.variant.placements.move', expectedVersion: 5, suffix: 'room.direct.move',
    payload: {
      roomVariantId: 'room.family-table', expectedRoomVariantVersion: 2,
      moves: [{ placementId: 'prop.direct-table', expectedAssetId: 'asset.table', anchor: { x: 2, y: 2 }, rotation: 90 }],
    },
  });
  const moved = await studio.execute(move, OWNER_CONTEXT);
  const moveReplay = await studio.execute(move, OWNER_CONTEXT);
  assert.equal(moved.revision, 6);
  assert.equal(moved.value.roomVariantVersion, 3);
  assert.equal(moveReplay.replayed, true);
  assert.deepEqual({ ...moveReplay, replayed: false }, moved);

  const remove = roomCommand({
    type: 'room.variant.placements.remove', expectedVersion: 6, suffix: 'room.direct.remove',
    payload: {
      roomVariantId: 'room.family-table', expectedRoomVariantVersion: 3,
      placements: [{ placementId: 'prop.direct-table', expectedAssetId: 'asset.table' }],
    },
  });
  const removed = await studio.execute(remove, OWNER_CONTEXT);
  const removeReplay = await studio.execute(remove, OWNER_CONTEXT);
  assert.equal(removed.revision, 7);
  assert.equal(removed.value.roomVariantVersion, 4);
  assert.equal(removeReplay.replayed, true);
  assert.deepEqual({ ...removeReplay, replayed: false }, removed);

  const room = (await studio.queryRooms({
    schemaVersion: 1, projectId: PROJECT_ID, roomVariantId: 'room.family-table', includeVersions: true,
  }, OWNER_CONTEXT)).variants[0];
  assert.equal(room.versions.length, 4);
  assert.equal(room.versions[0].placements.length, 12);
  assert.equal(room.versions[1].placements.at(-1).placementId, 'prop.direct-table');
  assert.deepEqual(room.versions[1].placements.at(-1).anchor, { x: 2, y: 1 });
  assert.deepEqual(room.versions[2].placements.at(-1).anchor, { x: 2, y: 2 });
  assert.equal(room.versions[2].placements.at(-1).rotation, 90);
  assert.equal(room.current.placements.some(({ placementId }) => placementId === 'prop.direct-table'), false);
});

test('CP4.5 owner shape replacement creates an immutable room version and remains unavailable to agents', async () => {
  const { studio } = await fixture();
  const shaped = await studio.execute(roomCommand({
    type: 'room.variant.shape.set', expectedVersion: 4, suffix: 'room.shape',
    payload: {
      roomVariantId: 'room.family-table', expectedRoomVariantVersion: 1,
      voidCells: [{ x: 3, y: 2 }], blockedCells: [{ x: 2, y: 1 }],
    },
  }), OWNER_CONTEXT);
  assert.equal(shaped.value.roomVariantVersion, 2);
  const room = (await studio.queryRooms({
    schemaVersion: 1, projectId: PROJECT_ID, roomVariantId: 'room.family-table', includeVersions: true,
  }, OWNER_CONTEXT)).variants[0];
  assert.deepEqual(room.current.voidCells, [{ x: 3, y: 2 }]);
  assert.deepEqual(room.current.blockedCells, [{ x: 2, y: 1 }]);
  assert.deepEqual(room.versions[0].voidCells, []);
  await assert.rejects(studio.execute(roomCommand({
    type: 'room.variant.shape.set', expectedVersion: 5, suffix: 'room.shape.agent',
    payload: {
      roomVariantId: 'room.family-table', expectedRoomVariantVersion: 2,
      voidCells: [], blockedCells: [],
    },
  }), AGENT_CONTEXT), (error) => error.code === 'FORBIDDEN');
});

test('bounded agent proposal charges per item, redacts host authority, and blocks concurrent edits', async () => {
  const { studio } = await fixture();
  await assert.rejects(studio.execute(roomCommand({
    type: 'room.placement.proposal.submit', expectedVersion: 4, suffix: 'room.surface-proposal',
    payload: {
      proposalId: 'proposal.surface-forbidden', roomVariantId: 'room.family-table', expectedRoomVariantVersion: 1,
      items: [{ itemId: 'item.surface', operation: 'move', placement: null, placementId: 'floor.0.0', expectedAssetId: 'asset.floor', anchor: { x: 0, y: 0 }, rotation: 0 }],
    },
  }), AGENT_CONTEXT), (error) => error.code === 'ROOM_PROPOSAL_LAYER_FORBIDDEN');
  const submitted = await studio.execute(proposal(), AGENT_CONTEXT);
  assert.equal(submitted.value.state, 'PENDING');
  assert.equal((await studio.readProjectTrusted(PROJECT_ID)).snapshot.grants[0].usage.commands, 1);
  const agentRead = await studio.queryRooms({ schemaVersion: 1, projectId: PROJECT_ID, roomVariantId: 'room.family-table', includeProposals: true }, AGENT_CONTEXT);
  assert.equal(agentRead.proposals[0].proposer.grantId, undefined);
  assert.equal(agentRead.proposals[0].proposer.branchId, undefined);
  assert.equal(agentRead.proposals[0].proposer.taskId, AGENT_CONTEXT.taskId);
  await assert.rejects(studio.execute(roomCommand({
    type: 'room.variant.placements.move', expectedVersion: 5,
    payload: { roomVariantId: 'room.family-table', expectedRoomVariantVersion: 1, moves: [{ placementId: 'floor.3.2', expectedAssetId: 'asset.floor', anchor: { x: 3, y: 2 }, rotation: 0 }] },
  }), OWNER_CONTEXT), (error) => error.code === 'ROOM_PROPOSAL_UNRESOLVED');
});

test('owner decision and accepted-subset apply create one immutable room version', async () => {
  const { studio } = await fixture();
  await studio.execute(proposal(), AGENT_CONTEXT);
  await assert.rejects(studio.execute(roomCommand({
    type: 'room.placement.proposal.decide', expectedVersion: 5,
    payload: { proposalId: 'proposal.set-dressing', expectedProposalVersion: 1, decisions: [{ itemId: 'item.table', disposition: 'ACCEPTED', reason: null }] },
  }), AGENT_CONTEXT), (error) => error.code === 'FORBIDDEN');
  await studio.execute(roomCommand({
    type: 'room.placement.proposal.decide', expectedVersion: 5,
    payload: { proposalId: 'proposal.set-dressing', expectedProposalVersion: 1, decisions: [{ itemId: 'item.table', disposition: 'ACCEPTED', reason: null }] },
  }), OWNER_CONTEXT);
  const applied = await studio.execute(roomCommand({
    type: 'room.placement.proposal.apply', expectedVersion: 6,
    payload: { proposalId: 'proposal.set-dressing', expectedProposalVersion: 2 },
  }), OWNER_CONTEXT);
  assert.equal(applied.value.roomVariantVersion, 2);
  assert.deepEqual(applied.value.appliedItemIds, ['item.table']);
  const room = (await studio.queryRooms({ schemaVersion: 1, projectId: PROJECT_ID, roomVariantId: 'room.family-table', includeVersions: true, includeProposals: true }, OWNER_CONTEXT)).variants[0];
  assert.equal(room.versions.length, 2);
  assert.equal(room.versions[0].placements.length, 12);
  assert.equal(room.current.placements.length, 13);
  assert.equal(room.current.placements.at(-1).proposalId, 'proposal.set-dressing');
});

test('validation, finalization, and fork preserve the immutable FINAL version', async () => {
  const { studio } = await fixture();
  await studio.execute(proposal(), AGENT_CONTEXT);
  await studio.execute(roomCommand({ type: 'room.placement.proposal.decide', expectedVersion: 5, payload: { proposalId: 'proposal.set-dressing', expectedProposalVersion: 1, decisions: [{ itemId: 'item.table', disposition: 'ACCEPTED', reason: null }] } }), OWNER_CONTEXT);
  await studio.execute(roomCommand({ type: 'room.placement.proposal.apply', expectedVersion: 6, payload: { proposalId: 'proposal.set-dressing', expectedProposalVersion: 2 } }), OWNER_CONTEXT);
  await studio.execute(roomCommand({ type: 'room.variant.validate', expectedVersion: 7, payload: { roomVariantId: 'room.family-table', expectedRoomVariantVersion: 2 } }), OWNER_CONTEXT);
  await assert.rejects(studio.execute(roomCommand({ type: 'room.variant.finalize', expectedVersion: 8, payload: { roomVariantId: 'room.family-table', expectedRoomVariantVersion: 3 } }), AGENT_CONTEXT), (error) => error.code === 'FORBIDDEN');
  await studio.execute(roomCommand({ type: 'room.variant.finalize', expectedVersion: 8, payload: { roomVariantId: 'room.family-table', expectedRoomVariantVersion: 3 } }), OWNER_CONTEXT);
  const beforeFork = await studio.queryRooms({ schemaVersion: 1, projectId: PROJECT_ID, roomVariantId: 'room.family-table', includeVersions: true }, OWNER_CONTEXT);
  const finalValue = structuredClone(beforeFork.variants[0].versions.find((version) => version.lifecycle === 'FINAL'));
  await studio.execute(roomCommand({ type: 'room.variant.fork', expectedVersion: 9, payload: { roomVariantId: 'room.family-table', expectedRoomVariantVersion: 4 } }), OWNER_CONTEXT);
  const afterFork = await studio.queryRooms({ schemaVersion: 1, projectId: PROJECT_ID, roomVariantId: 'room.family-table', includeVersions: true }, OWNER_CONTEXT);
  assert.deepEqual(afterFork.variants[0].versions.find((version) => version.lifecycle === 'FINAL'), finalValue);
  assert.equal(afterFork.variants[0].current.lifecycle, 'DRAFT');
  assert.equal(afterFork.variants[0].current.parentFinalVersion, 4);
  assert.equal(afterFork.variants[0].current.version, 5);
});
