import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { StudioService } from '../packages/application/src/index.js';
import { ContentAddressedArtifactStore, SqliteProjectStore, verifyWorkspaceIntegrity } from '../packages/persistence/src/index.js';
import { prepareRoomPinnedAssetsFixture, PROJECT_ID, ASSET_ID, MIXED_ROOM_ID } from '../scripts/room-pinned-assets-fixture.js';
import { OWNER } from '../scripts/asset-metadata-evidence-fixture.js';
import { nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';

test('combined editor Save has one atomic checked version, exact historical pins, rollback and restart replay', { timeout: 120_000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'studio-editor-save-')), directory = join(root, 'fresh');
  let store, armedFault;
  try {
    await prepareRoomPinnedAssetsFixture(directory);
    const filename = join(directory, 'studio.sqlite');
    store = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory,
      faultInjector(point) { if (point === armedFault) throw new Error(`editor fault ${point}`); } });
    const studio = new StudioService({ store, clock: () => '2026-09-23T12:00:00.000Z' });
    const original = await store.loadProject(PROJECT_ID), head = original.revisions.at(-1);
    const room = head.snapshot.roomLibrary.variants.find(value => value.roomVariantId === MIXED_ROOM_ID).versions.at(-1);
    const added = { ...room.placements[1], placementId: 'placement.editor.added', anchor: { x: 4, y: 2 }, proposalId: null, proposalItemId: null };
    const command = { schemaVersion: 1, commandId: 'editor.atomic', idempotencyKey: 'editor.atomic', projectId: PROJECT_ID,
      type: 'room.variant.editor.save', baseRevision: head.number, expectedVersion: head.number, dryRun: false,
      payload: { roomVariantId: MIXED_ROOM_ID, expectedRoomVariantVersion: room.version,
        width: room.width + 1, height: room.height, voidCells: [{ x: room.width, y: 0 }], blockedCells: [{ x: room.width, y: 1 }],
        intentTrace: room.intentTrace.map(value => ({ ...value, summary: `${value.summary} Revised.` })), connectors: room.connectors,
        addPlacements: [added], moves: [{ placementId: room.placements[0].placementId, expectedAssetId: ASSET_ID, anchor: { x: 1, y: 2 }, rotation: 90 }],
        removePlacements: [{ placementId: room.placements[1].placementId, expectedAssetId: ASSET_ID }] } };
    for (const point of ['after_revision_insert', 'after_activity_insert', 'after_projection_update', 'after_idempotency_insert',
      'after_grant_projection', 'after_asset_library_revision', 'after_room_designer_revision', 'before_transaction_commit']) {
      armedFault = point;
      try { await assert.rejects(studio.execute(command, OWNER), new RegExp(`editor fault ${point}`)); }
      finally { armedFault = null; }
      assert.deepEqual(await store.loadProject(PROJECT_ID), original);
    }
    const response = await studio.execute(command, OWNER), saved = await store.loadProject(PROJECT_ID);
    assert.equal(saved.revisions.length, original.revisions.length + 1);
    assert.equal(response.revision, head.number + 1);
    assert.equal(response.value.roomVariantVersion, room.version + 1);
    assert.deepEqual(response.value.roomVariant.placements.map(value => [value.assetVersion, value.metadataVersion]), [[1, 1], [2, 2]]);
    assert.deepEqual(saved.revisions.slice(0, -1), original.revisions);
    assert.equal(response.value.roomVariant.contentFingerprint, response.value.contentFingerprint);
    store.close();
    store = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
    assert.deepEqual(await store.loadProject(PROJECT_ID), saved);
    const resumed = new StudioService({ store, clock: () => '2026-09-23T12:01:00.000Z' });
    assert.deepEqual(await resumed.execute(command, OWNER), { ...response, replayed: true });
    await assert.rejects(resumed.execute({ ...command, payload: { ...command.payload, width: room.width } }, OWNER), error => error.code === 'IDEMPOTENCY_CONFLICT');
    await assert.rejects(resumed.execute({ ...command, commandId: 'editor.stale', idempotencyKey: 'editor.stale' }, OWNER), error => error.code === 'REVISION_CONFLICT');
    assert.deepEqual(await store.loadProject(PROJECT_ID), saved);
    assert.equal(store.integrityCheck().ok, true);
    const artifacts = new ContentAddressedArtifactStore({ rootDirectory: join(directory, 'artifacts') });
    const integrity = await verifyWorkspaceIntegrity({ projectStore: store, artifactStore: artifacts });
    assert.equal(integrity.ok, true, JSON.stringify(integrity));
  } finally { store?.close(); await rm(root, { recursive: true, force: true }); }
});
