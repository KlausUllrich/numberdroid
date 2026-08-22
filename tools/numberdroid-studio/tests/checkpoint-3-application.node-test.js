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

test('bounded agent proposal charges per item, redacts host authority, and blocks concurrent edits', async () => {
  const { studio } = await fixture();
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
