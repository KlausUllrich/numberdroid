import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { startStudioHttpServer } from '../apps/studio-server/src/server.js';

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const dataDirectory = resolve(process.argv[2] ?? '.numberdroid-studio-checkpoint-3-visual');
const projectId = 'numberdroid-studio-checkpoint-2c';
const owner = { id: 'local.designer', kind: 'human', displayName: 'Local designer' };
const ownerContext = { actor: owner, taskId: null, grantId: null, branchId: 'branch.main' };
const agent = { id: 'room.layout.agent', kind: 'agent', displayName: 'Room layout agent' };
const taskId = 'task.checkpoint-3-room-layout';
const branchId = 'branch.checkpoint-3-room-layout';
const grantId = 'grant.checkpoint-3-room-layout';
let tick = 0;
const running = await startStudioHttpServer({
  dataDirectory,
  port: 0,
  clock: () => new Date(Date.UTC(2026, 7, 22, 15, 0, tick++)).toISOString(),
});

function command(type, revision, id, payload) {
  return {
    schemaVersion: 1,
    commandId: `visual.3.${id}`,
    idempotencyKey: `visual.3.${id}`,
    type,
    projectId,
    baseRevision: revision,
    expectedVersion: revision,
    dryRun: false,
    payload,
  };
}

function intentTrace(kind) {
  return [
    { layer: 'game_design', ruleId: 'gd.function-first', summary: 'Function before form.', disposition: 'governing' },
    { layer: 'level_design', ruleId: 'ld.room-hall-distinct', summary: 'Rooms and hallways remain mechanically distinct.', disposition: 'governing' },
    { layer: 'room_design', ruleId: `rd.${kind}`, summary: kind === 'room' ? 'Support a legible domestic gathering function.' : 'Preserve a clear traversal function.', disposition: 'governing' },
  ];
}

function connector(connectorId, side, offset = 1) {
  return {
    connectorId, side, offset, width: 1, kind: 'standard-door', clearanceInside: 1,
    clearanceOutside: 1, required: true, tags: ['standard'], compatibilityProfile: 'door.standard',
  };
}

function floorPlacements(asset, width, height, prefix) {
  const placements = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) placements.push({
      placementId: `${prefix}.${x}.${y}`,
      assetId: asset.assetId,
      assetVersion: asset.assetVersion,
      metadataVersion: asset.metadataVersion,
      layer: 'STRUCTURAL_SURFACE',
      anchor: { x, y },
      rotation: 0,
      variantTag: null,
      proposalId: null,
      proposalItemId: null,
    });
  }
  return placements;
}

function propMetadata() {
  return {
    role: 'furniture', tags: ['domestic', 'gathering-table'], variantGroup: null,
    compatibilityGroups: [], spanTiles: { width: 1, height: 1 }, anchor: { x: 0, y: 0 },
    attachment: 'ground', rotationPolicy: 'cardinal',
    placement: { modes: ['manual'], wallSafe: true, tags: ['domestic'], confirmation: 'confirmed' },
    collision: { mode: 'bounds', bounds: { x: 0, y: 0, width: 1, height: 1 }, parts: [] },
    navigation: { effect: 'blocked', cost: null }, runtimeEligible: true,
    connectors: [], continuityProfile: null, continuityTags: [], selectionPriority: 10,
    visualWeight: 'heavy', extensions: {},
  };
}

function mcpPayload(result) {
  if (result?.structuredContent) return result.structuredContent;
  const text = result?.content?.find((entry) => entry.type === 'text')?.text;
  if (typeof text !== 'string') return null;
  try { return JSON.parse(text); } catch { return null; }
}

async function officialMcpClient(token) {
  const { address, port } = running.address;
  const host = address === '::' ? '127.0.0.1' : address;
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve(moduleDirectory, '../apps/studio-mcp/src/main.js')],
    cwd: resolve(moduleDirectory, '..'),
    env: {
      ...process.env,
      NUMBERDROID_STUDIO_PROJECT_ID: projectId,
      NUMBERDROID_STUDIO_SERVICE_URL: `http://${host}:${port}/`,
      NUMBERDROID_STUDIO_BINDING_TOKEN: token,
      NUMBERDROID_STUDIO_AGENT_AUDIT_READY: '1',
      NUMBERDROID_STUDIO_JOB_STORE_READY: '1',
      NUMBERDROID_STUDIO_ASSET_STORE_READY: '1',
      NUMBERDROID_STUDIO_ROOM_STORE_READY: '1',
    },
    stderr: 'pipe',
  });
  const client = new Client(
    { name: 'checkpoint-3-evidence', version: '1.0.0' },
    { versionNegotiation: { mode: { pin: '2026-07-28' } } },
  );
  await client.connect(transport);
  return { client, close: () => client.close() };
}

try {
  const initial = await running.studioService.readProjectTrusted(projectId);
  if (initial.revision !== 11 || initial.snapshot.assetLibrary?.assets?.length !== 3 || initial.snapshot.roomLibrary) {
    throw new Error('Checkpoint 3 visual preparation requires the applied Checkpoint 2C revision-11 fixture.');
  }
  const surfaceAsset = initial.snapshot.assetLibrary.assets[0];
  const propSlice = initial.snapshot.atlases[0].sliceHeads[3];
  const propProposalId = 'proposal.family-table-prop-c3';
  await running.studioService.execute(command('asset.proposal.submit', 11, 'prop-proposal', {
    proposalId: propProposalId, expectedRevision: 11,
    items: [{
      itemId: 'item.family-table-prop-c3', operation: 'create', assetId: 'asset.family-table-prop-c3',
      expectedAssetVersion: 0, expectedMetadataVersion: 0, sliceId: propSlice.sliceId,
      expectedSliceVersion: propSlice.version, name: 'Family Gathering Table', kind: 'prop', metadata: propMetadata(),
    }],
  }), ownerContext);
  await running.studioService.execute(command('asset.proposal.decide', 12, 'prop-decision', {
    proposalId: propProposalId, expectedProposalVersion: 1,
    decisions: [{ itemId: 'item.family-table-prop-c3', disposition: 'ACCEPTED', reason: null }],
  }), ownerContext);
  await running.studioService.execute(command('asset.proposal.apply', 13, 'prop-apply', {
    proposalId: propProposalId, expectedProposalVersion: 2,
  }), ownerContext);
  const propAsset = (await running.studioService.readProjectTrusted(projectId)).snapshot.assetLibrary.assets
    .find(({ assetId }) => assetId === 'asset.family-table-prop-c3');
  await running.studioService.execute(command('room.archetype.create', 14, 'room-archetype', {
    roomArchetypeId: 'archetype.family-gathering', kind: 'room', displayName: 'Family gathering room', tags: ['domestic', 'gathering'],
    dimensionPolicy: { width: { min: 3, preferred: 4, max: 16 }, height: { min: 3, preferred: 3, max: 16 } },
    structuralBands: { left: 0, right: 0, top: 0, bottom: 0 }, orientation: 'any',
    connectorPolicy: { min: 2, max: 8, requiredSides: ['east', 'west'] }, allowedAssetKinds: ['surface', 'prop', 'item'],
    allowedTags: [], requiredTags: [], rationality: 'domestic',
    governingRuleRefs: [{ ruleId: 'gd.function-first', summary: 'Function before form.' }],
  }), ownerContext);
  await running.studioService.execute(command('room.archetype.create', 15, 'hall-archetype', {
    roomArchetypeId: 'archetype.service-hall', kind: 'hallway', displayName: 'Service hallway', tags: ['service', 'traversal'],
    dimensionPolicy: { width: { min: 3, preferred: 6, max: 24 }, height: { min: 3, preferred: 3, max: 8 } },
    structuralBands: { left: 0, right: 0, top: 0, bottom: 0 }, orientation: 'horizontal',
    connectorPolicy: { min: 2, max: 8, requiredSides: ['east', 'west'] }, allowedAssetKinds: ['surface', 'prop', 'item'],
    allowedTags: [], requiredTags: [], rationality: 'system',
    governingRuleRefs: [{ ruleId: 'ld.room-hall-distinct', summary: 'Rooms and hallways remain mechanically distinct.' }],
  }), ownerContext);
  await running.studioService.execute(command('room.variant.create', 16, 'room-create', {
    roomVariantId: 'room.family-gathering', roomArchetypeId: 'archetype.family-gathering', archetypeVersion: 1,
    displayName: 'Family Gathering Room', width: 4, height: 3, intentTrace: intentTrace('room'),
    connectors: [connector('connector.room.west', 'west'), connector('connector.room.east', 'east')],
    placements: floorPlacements(surfaceAsset, 4, 3, 'floor.room'),
  }), ownerContext);
  await running.studioService.execute(command('room.variant.create', 17, 'hall-create', {
    roomVariantId: 'hall.service-east-west', roomArchetypeId: 'archetype.service-hall', archetypeVersion: 1,
    displayName: 'East–West Service Hall', width: 6, height: 3, intentTrace: intentTrace('hallway'),
    connectors: [connector('connector.hall.west', 'west'), connector('connector.hall.east', 'east')],
    placements: floorPlacements(surfaceAsset, 6, 3, 'floor.hall'),
  }), ownerContext);
  await running.studioService.execute(command('grant.issue', 18, 'room-grant', {
    grantId, agentId: agent.id, taskId, branchId,
    scopes: ['project.read', 'room.proposal.submit'], objectScopes: [{ kind: 'project', id: projectId }],
    budget: { maxCommands: 3, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 },
    expiresAt: '2026-08-23T15:00:00.000Z',
  }), ownerContext);
  const binding = running.hostBindingStore.issue({ projectId, grantId, agentId: agent.id, taskId, branchId, issuedBy: owner.id, expiresAt: '2026-08-23T15:00:00.000Z' });
  const mcp = await officialMcpClient(binding.token);
  const proposalId = 'proposal.room.gathering-table';
  const proposalCommand = command('room.placement.proposal.submit', 19, 'room-proposal', {
    proposalId, roomVariantId: 'room.family-gathering', expectedRoomVariantVersion: 1,
    items: [
      {
        itemId: 'item.add-table', operation: 'add',
        placement: { placementId: 'prop.family-table', assetId: propAsset.assetId, assetVersion: propAsset.assetVersion, metadataVersion: propAsset.metadataVersion, layer: 'SET_DRESSING', anchor: { x: 2, y: 1 }, rotation: 0, variantTag: null, proposalId: null, proposalItemId: null },
        placementId: null, expectedAssetId: null, anchor: null, rotation: null,
      },
      { itemId: 'item.keep-entry', operation: 'move', placement: null, placementId: 'floor.room.0.0', expectedAssetId: surfaceAsset.assetId, anchor: { x: 0, y: 0 }, rotation: 0 },
      {
        itemId: 'item.reject-overlap', operation: 'add',
        placement: { placementId: 'prop.family-table-overlap', assetId: propAsset.assetId, assetVersion: propAsset.assetVersion, metadataVersion: propAsset.metadataVersion, layer: 'SET_DRESSING', anchor: { x: 2, y: 1 }, rotation: 0, variantTag: null, proposalId: null, proposalItemId: null },
        placementId: null, expectedAssetId: null, anchor: null, rotation: null,
      },
    ],
  });
  const { type: _type, ...argumentsValue } = proposalCommand;
  const submittedResult = await mcp.client.callTool({ name: 'studio_room_placement_proposal_submit', arguments: argumentsValue });
  const submitted = mcpPayload(submittedResult);
  if (submittedResult.isError || submitted?.revision !== 20 || submitted?.value?.itemCount !== 3) {
    throw new Error(`Official MCP room proposal submission failed: ${JSON.stringify({ result: submittedResult, payload: submitted })}`);
  }
  await mcp.close();
  const rejectionReason = 'Overlaps the accepted gathering table and blocks the same navigation cell.';
  await running.studioService.execute(command('room.placement.proposal.decide', 20, 'room-decision', {
    proposalId, expectedProposalVersion: 1,
    decisions: [
      { itemId: 'item.add-table', disposition: 'ACCEPTED', reason: null },
      { itemId: 'item.keep-entry', disposition: 'ACCEPTED', reason: null },
      { itemId: 'item.reject-overlap', disposition: 'REJECTED', reason: rejectionReason },
    ],
  }), ownerContext);
  await running.studioService.execute(command('room.placement.proposal.apply', 21, 'room-apply', {
    proposalId, expectedProposalVersion: 2,
  }), ownerContext);
  const applied = await running.studioService.readProjectTrusted(projectId);
  const appliedRoom = applied.snapshot.roomLibrary.variants.find(({ roomVariantId }) => roomVariantId === 'room.family-gathering').versions.at(-1);
  const acceptedWarningFindingIds = appliedRoom.findings.filter(({ severity }) => severity === 'WARNING').map(({ findingId }) => findingId);
  await running.studioService.execute(command('room.variant.warning.disposition.set', 22, 'warning-dispositions', {
    roomVariantId: 'room.family-gathering', expectedRoomVariantVersion: 2, acceptedWarningFindingIds,
  }), ownerContext);
  await running.studioService.execute(command('room.variant.validate', 23, 'room-validate', {
    roomVariantId: 'room.family-gathering', expectedRoomVariantVersion: 3,
  }), ownerContext);
  await running.studioService.execute(command('room.variant.finalize', 24, 'room-finalize', {
    roomVariantId: 'room.family-gathering', expectedRoomVariantVersion: 4,
  }), ownerContext);
  await running.studioService.execute(command('room.variant.fork', 25, 'room-fork', {
    roomVariantId: 'room.family-gathering', expectedRoomVariantVersion: 5,
  }), ownerContext);
  const final = await running.studioService.readProjectTrusted(projectId);
  const room = final.snapshot.roomLibrary.variants.find(({ roomVariantId }) => roomVariantId === 'room.family-gathering');
  const proposal = final.snapshot.roomLibrary.proposals.find((candidate) => candidate.proposalId === proposalId);
  const finalVersion = room.versions.find(({ lifecycle }) => lifecycle === 'FINAL');
  if (final.revision !== 26 || room.headVersion !== 6 || finalVersion?.version !== 5 || proposal.state !== 'APPLIED') throw new Error('Checkpoint 3 fixture did not reach its exact applied/final/fork state.');
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 1,
    projectId,
    revision: final.revision,
    activityCount: 27,
    roomVariantId: room.roomVariantId,
    roomVariantVersion: room.headVersion,
    roomCount: final.snapshot.roomLibrary.variants.length,
    roomPlacementCount: room.versions.at(-1).placements.length,
    findingCount: room.versions.at(-1).findings.length,
    finalVersion: finalVersion.version,
    forkVersion: room.headVersion,
    proposal: { proposalId, state: proposal.state, itemCount: proposal.items.length, rejectedItemId: 'item.reject-overlap', rejectionReason, submittedThrough: 'official-mcp-2026-07-28-host-binding' },
  }, null, 2)}\n`);
} finally {
  await new Promise((resolveClose) => running.server.close(resolveClose));
}
