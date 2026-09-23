import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { StudioService } from '../packages/application/src/index.js';
import { supportsOwnerRoomMoveReads } from '../packages/application/src/project-store.js';
import { InMemoryProjectStore, SqliteProjectStore } from '../packages/persistence/src/index.js';
import { prepareRoomPinnedAssetsFixture, PROJECT_ID, ASSET_ID, MIXED_ROOM_ID } from '../scripts/room-pinned-assets-fixture.js';
import { OWNER } from '../scripts/asset-metadata-evidence-fixture.js';
import { nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';

const clock = () => '2026-09-23T10:00:00.000Z';
const move = (id, revision, version, extra = {}) => ({
  schemaVersion: 1, commandId: `indexed.${id}`, idempotencyKey: `indexed.${id}`,
  projectId: PROJECT_ID, type: 'room.variant.placements.move',
  baseRevision: revision, expectedVersion: revision, dryRun: false,
  payload: { roomVariantId: MIXED_ROOM_ID, expectedRoomVariantVersion: version,
    moves: [{ placementId: 'placement.mixed.old', expectedAssetId: ASSET_ID, anchor: { x: 1, y: 2 }, rotation: 90 }] },
  ...extra,
});

test('Move read optimization is owner/shared-store only and requires both optional ports', () => {
  const store = { loadRoomMoveContext() {}, loadRoomMoveAssetVersions() {} };
  const command = { type: 'room.variant.placements.move', actor: { kind: 'human' } };
  assert.equal(supportsOwnerRoomMoveReads(store, command), true);
  assert.equal(supportsOwnerRoomMoveReads({ ...store, isTaskBranchStore: true }, command), false);
  assert.equal(supportsOwnerRoomMoveReads(store, { ...command, actor: { kind: 'agent' } }), false);
  assert.equal(supportsOwnerRoomMoveReads(store, { ...command, type: 'room.variant.placements.add' }), false);
  assert.equal(supportsOwnerRoomMoveReads({ loadRoomMoveContext() {} }, command), false);
  assert.equal(supportsOwnerRoomMoveReads(new InMemoryProjectStore(), command), false);
});

test('indexed owner Move preserves exact historical pins, ledger precedence, rollback and restart', { timeout: 120_000 }, async context => {
  const root = await mkdtemp(join(tmpdir(), 'studio-indexed-move-'));
  const directory = join(root, 'new');
  let store;
  let armedFault = null;
  try {
    await prepareRoomPinnedAssetsFixture(directory);
    store = await SqliteProjectStore.open({ filename: join(directory, 'studio.sqlite'), databaseFactory: nodeSqliteDatabaseFactory,
      faultInjector(point) { if (point === armedFault) throw new Error(`indexed fault ${point}`); } });
    const studio = new StudioService({ store, clock });
    const fullRead = store.loadProject.bind(store);
    const original = await fullRead(PROJECT_ID);
    const memory = new InMemoryProjectStore();
    memory.supportsAtomicRoomDesigner = true;
    await memory.createProject(original);
    const oracle = new StudioService({ store: memory, clock });
    const first = move('first', 16, 1);
    let firstResult;

    await context.test('dry run and fresh Move equal complete-document fallback with zero history reads', async () => {
      store.loadProject = () => { throw new Error('Fresh Move decoded complete history'); };
      try {
        assert.deepEqual(await studio.execute({ ...first, dryRun: true }, OWNER), await oracle.execute({ ...first, dryRun: true }, OWNER));
        firstResult = await studio.execute(first, OWNER);
        assert.deepEqual(firstResult, await oracle.execute(first, OWNER));
        const assets = await store.loadRoomMoveAssetVersions(PROJECT_ID, await store.loadProjectHead(PROJECT_ID), MIXED_ROOM_ID);
        assert.deepEqual([...assets.values()].map(asset => [asset.assetVersion, asset.metadataVersion]), [[1, 1], [2, 2]]);
        assert.deepEqual(await fullRead(PROJECT_ID), await memory.loadProject(PROJECT_ID));
      } finally { store.loadProject = fullRead; }
    });

    await context.test('replay wins over stale base, command collision, and pin reads; changed semantics still conflict', async () => {
      const second = move('second', 17, 2);
      await studio.execute(second, OWNER);
      const pinRead = store.loadRoomMoveAssetVersions;
      store.loadRoomMoveAssetVersions = () => { throw new Error('Replay read Asset pins'); };
      store.loadProject = () => { throw new Error('Replay decoded history'); };
      try {
        assert.deepEqual(await studio.execute(first, OWNER), { ...firstResult, replayed: true });
        assert.deepEqual(await studio.execute({ ...first, commandId: second.commandId }, OWNER), { ...firstResult, replayed: true });
        await assert.rejects(studio.execute({ ...first, payload: { ...first.payload, moves: [] } }, OWNER), error => error.code === 'IDEMPOTENCY_CONFLICT');
        await assert.rejects(studio.execute({ ...first, idempotencyKey: 'indexed.different' }, OWNER), error => error.code === 'COMMAND_ID_CONFLICT');
        await assert.rejects(studio.execute({ ...first, dryRun: true }, OWNER), error => error.code === 'COMMAND_ID_CONFLICT');
      } finally { store.loadProject = fullRead; store.loadRoomMoveAssetVersions = pinRead; }
    });

    await context.test('stale, foreign owner, invalid placement and missing exact pins remain fail-closed', async () => {
      await assert.rejects(studio.execute(move('stale-project', 16, 1), OWNER), error => error.code === 'REVISION_CONFLICT');
      await assert.rejects(studio.execute(move('stale-room', 18, 1), OWNER), error => error.code === 'ENTITY_VERSION_CONFLICT');
      const pinRead = store.loadRoomMoveAssetVersions;
      store.loadRoomMoveAssetVersions = () => { throw new Error('Denied owner read pins'); };
      try {
        await assert.rejects(studio.execute(move('foreign-owner', 18, 3), { ...OWNER, actor: { ...OWNER.actor, id: 'different.owner' } }), error => error.code === 'FORBIDDEN');
      } finally { store.loadRoomMoveAssetVersions = pinRead; }
      const value = move('missing-placement', 18, 3); value.payload.moves[0].placementId = 'missing';
      await assert.rejects(studio.execute(value, OWNER), error => error.code === 'ROOM_PLACEMENT_NOT_FOUND');
      store.loadRoomMoveAssetVersions = async () => new Map();
      try { await assert.rejects(studio.execute(move('missing-pin', 18, 3), OWNER), error => error.code === 'ROOM_ASSET_VERSION_NOT_FOUND'); }
      finally { store.loadRoomMoveAssetVersions = pinRead; }
      const head = await store.loadProjectHead(PROJECT_ID);
      const room = head.snapshot.roomLibrary.variants.find(room => room.roomVariantId === MIXED_ROOM_ID).versions.at(-1);
      room.placements[0].metadataVersion = 99;
      assert.equal((await store.loadRoomMoveAssetVersions(PROJECT_ID, head, MIXED_ROOM_ID)).has(`${ASSET_ID}@1:99`), false);
    });

    await context.test('every Move transaction stage rolls back without changing authoritative history', async () => {
      const before = await fullRead(PROJECT_ID);
      for (const point of ['after_revision_insert', 'after_activity_insert', 'after_projection_update', 'after_idempotency_insert',
        'after_grant_projection', 'after_asset_library_revision', 'after_room_designer_revision', 'before_transaction_commit']) {
        armedFault = point;
        try { await assert.rejects(studio.execute(move(`fault.${point}`, 18, 3), OWNER), /indexed fault/); }
        finally { armedFault = null; }
        assert.deepEqual(await fullRead(PROJECT_ID), before);
      }
    });

    await context.test('concurrent contenders retain one-winner CAS and exact restart replay', async () => {
      const contenders = [move('race-a', 18, 3), move('race-b', 18, 3)];
      const results = await Promise.allSettled(contenders.map(command => studio.execute(command, OWNER)));
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
      assert.equal(results.find(result => result.status === 'rejected').reason.code, 'REVISION_CONFLICT');
      const before = await fullRead(PROJECT_ID);
      const winner = results.findIndex(result => result.status === 'fulfilled');
      store.close();
      store = await SqliteProjectStore.open({ filename: join(directory, 'studio.sqlite'), databaseFactory: nodeSqliteDatabaseFactory });
      assert.deepEqual(await store.loadProject(PROJECT_ID), before);
      assert.deepEqual(await new StudioService({ store, clock }).execute(contenders[winner], OWNER), { ...results[winner].value, replayed: true });
      assert.equal(store.integrityCheck().ok, true);
    });
  } finally { store?.close(); await rm(root, { recursive: true, force: true }); }
});
