import assert from 'node:assert/strict';
import { startStudioHttpServer } from '../apps/studio-server/src/server.js';
import { PROJECT_ID, ASSET_ID, applyProposal, command, closeServer, prepareAssetMetadataFixture, serverOptions } from './asset-metadata-evidence-fixture.js';
export { PROJECT_ID, ASSET_ID, ROOM_ID, closeServer, serverOptions } from './asset-metadata-evidence-fixture.js';
export const MIXED_ROOM_ID = 'room.pinned.mixed';

export async function prepareRoomPinnedAssetsFixture(directory) {
  const initial = await prepareAssetMetadataFixture(directory);
  const running = await startStudioHttpServer(serverOptions(directory));
  try {
    const oldAsset = initial.snapshot.assetLibrary.assets[0];
    const newSlice = initial.snapshot.atlases[0].sliceHeads[1];
    assert.notEqual(newSlice.digest, oldAsset.sliceBinding.digest, 'Fixture versions must use distinct image bytes');
    const metadata = structuredClone(oldAsset.metadata); delete metadata.pixelSize; delete metadata.pivot;
    metadata.spanTiles = { width: 3, height: 2 }; metadata.anchor = { x: 1, y: 1 }; metadata.placement.wallSafe = true;
    metadata.collision.bounds = { x: 0, y: 0, width: 3, height: 2 };
    await applyProposal(running, { proposalId: 'proposal.pinned.new-head', expectedRevision: 12, items: [{ itemId: 'item.pinned.new-head', operation: 'update', assetId: ASSET_ID, expectedAssetVersion: 1, expectedMetadataVersion: 1, sliceId: newSlice.sliceId, expectedSliceVersion: newSlice.version, name: 'Latest 3×2 Asset', kind: oldAsset.kind, metadata }] });
    const originalRoom = initial.snapshot.roomLibrary.variants[0].versions[0];
    await command(running, 'room.variant.create', 'mixed-room', {
      roomVariantId: MIXED_ROOM_ID, roomArchetypeId: originalRoom.roomArchetypeId, archetypeVersion: originalRoom.archetypeVersion,
      displayName: 'Room with two exact versions', width: 8, height: 6, intentTrace: originalRoom.intentTrace, connectors: originalRoom.connectors,
      placements: [
        { ...originalRoom.placements[0], placementId: 'placement.mixed.old' },
        { ...originalRoom.placements[0], placementId: 'placement.mixed.new', assetVersion: 2, metadataVersion: 2, anchor: { x: 4, y: 2 } },
      ],
    });
    return { initial, oldAsset, current: await running.studioService.readProjectTrusted(PROJECT_ID) };
  } finally { await closeServer(running); }
}
