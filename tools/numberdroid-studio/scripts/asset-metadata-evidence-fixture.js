import { execFile } from 'node:child_process';
import { lstat } from 'node:fs/promises';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { startStudioHttpServer } from '../apps/studio-server/src/server.js';

export const PROJECT_ID = 'numberdroid-studio-checkpoint-2b';
export const ASSET_ID = 'asset.metadata.fixture';
export const ROOM_ID = 'room.metadata.pinned';
export const OWNER = { actor: { id: 'local.designer', kind: 'human', displayName: 'Local designer' }, taskId: null, grantId: null, branchId: 'branch.main' };
export const closeServer = (running) => new Promise((resolveClose, rejectClose) => running.server.close((error) => error ? rejectClose(error) : resolveClose()));
export const serverOptions = (dataDirectory) => ({ dataDirectory, host: '127.0.0.1', port: 0, storeMode: 'sqlite', pairingEnabled: false, operationsConfigurationFilename: null });
export const hiddenMetadata = (asset) => Object.fromEntries(['tags', 'variantGroup', 'compatibilityGroups', 'continuityProfile', 'continuityTags', 'connectors', 'extensions', 'selectionPriority'].map((key) => [key, asset.metadata[key]]).concat([['placementTags', asset.metadata.placement.tags], ['placementConfirmation', asset.metadata.placement.confirmation], ['placementModes', asset.metadata.placement.modes]]));
export async function command(running, type, id, payload) {
  const { revision } = await running.studioService.readProjectTrusted(PROJECT_ID);
  return running.studioService.execute({ schemaVersion: 1, commandId: `metadata.${id}`, idempotencyKey: `metadata.${id}`, type, projectId: PROJECT_ID, baseRevision: revision, expectedVersion: revision, dryRun: false, payload }, OWNER);
}
export async function applyProposal(running, request) {
  await command(running, 'asset.proposal.submit', `${request.proposalId}.submit`, { proposalId: request.proposalId, expectedRevision: request.expectedRevision, items: request.items });
  await command(running, 'asset.proposal.decide', `${request.proposalId}.decide`, { proposalId: request.proposalId, expectedProposalVersion: 1, decisions: request.items.map(({ itemId }) => ({ itemId, disposition: 'ACCEPTED', reason: null })) });
  await command(running, 'asset.proposal.apply', `${request.proposalId}.apply`, { proposalId: request.proposalId, expectedProposalVersion: 2 });
}
export async function prepareAssetMetadataFixture(dataDirectory) {
  try { await lstat(dataDirectory); throw new Error('Metadata evidence requires a new data directory.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await promisify(execFile)(process.execPath, [fileURLToPath(new URL('./prepare-checkpoint-2b-visual-evidence.js', import.meta.url)), dataDirectory], { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
  const running = await startStudioHttpServer(serverOptions(dataDirectory));
  try {
    const initial = await running.studioService.readProjectTrusted(PROJECT_ID);
    const slice = initial.snapshot.atlases[0].sliceHeads[0];
    const metadata = {
      role: 'furniture', tags: ['authored', 'preserve'], variantGroup: 'fixture.family', compatibilityGroups: ['fixture.compatible'],
      spanTiles: { width: 2, height: 1 }, anchor: { x: 0, y: 0 }, attachment: 'ground', rotationPolicy: 'cardinal',
      placement: { modes: ['manual'], wallSafe: false, tags: ['keep-placement'], confirmation: 'confirmed' },
      collision: { mode: 'bounds', bounds: { x: 0, y: 0, width: 2, height: 1 }, parts: [] },
      navigation: { effect: 'blocked', cost: null }, runtimeEligible: false,
      connectors: [{ edge: 'north', offset: 0.5 }], continuityProfile: 'fixture.continuity', continuityTags: ['continuous'],
      selectionPriority: 7, visualWeight: 'medium', extensions: { 'studio.fixture': { description: 'Retain authored details', values: [1, true] } },
    };
    await applyProposal(running, { proposalId: 'proposal.metadata.initial', expectedRevision: 7, items: [{ itemId: 'item.metadata.initial', operation: 'create', assetId: ASSET_ID, expectedAssetVersion: 0, expectedMetadataVersion: 0, sliceId: slice.sliceId, expectedSliceVersion: slice.version, name: 'Metadata test prop', kind: 'prop', metadata }] });
    await command(running, 'room.archetype.create', 'archetype', { roomArchetypeId: 'archetype.metadata', kind: 'room', displayName: 'Pinned Asset room template', tags: [], dimensionPolicy: { width: { min: 3, preferred: 8, max: 64 }, height: { min: 3, preferred: 6, max: 64 } }, structuralBands: { left: 0, right: 0, top: 0, bottom: 0 }, orientation: 'any', connectorPolicy: { min: 1, max: 32, requiredSides: [] }, allowedAssetKinds: ['surface', 'prop', 'item'], allowedTags: [], requiredTags: [], rationality: 'neutral', governingRuleRefs: [] });
    await command(running, 'room.variant.create', 'room', { roomVariantId: ROOM_ID, roomArchetypeId: 'archetype.metadata', archetypeVersion: 1, displayName: 'Room keeps the original Asset', width: 8, height: 6, intentTrace: ['game_design', 'level_design', 'room_design'].map((layer) => ({ layer, ruleId: `fixture:${layer}`, summary: 'Keep exact pinned metadata', disposition: 'governing' })), connectors: [{ connectorId: 'connector.metadata', side: 'north', offset: 4, width: 1, kind: 'opening', clearanceInside: 1, clearanceOutside: 1, required: true, tags: [], compatibilityProfile: null }], placements: [{ placementId: 'placement.metadata.original', assetId: ASSET_ID, assetVersion: 1, metadataVersion: 1, layer: 'SET_DRESSING', anchor: { x: 2, y: 2 }, rotation: 0, variantTag: null, proposalId: null, proposalItemId: null }] });
    return await running.studioService.readProjectTrusted(PROJECT_ID);
  } finally { await closeServer(running); }
}
