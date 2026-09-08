import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { startStudioHttpServer } from '../apps/studio-server/src/server.js';
import { PROJECT_ID, ROOM_ID, MIXED_ROOM_ID, closeServer, prepareRoomPinnedAssetsFixture, serverOptions } from '../scripts/room-pinned-assets-fixture.js';

test('pinned-Asset GET resolves exact historical versions with no writes or extra authority', { timeout: 120_000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'studio-pinned-http-test-')); const directory = join(root, 'new'); let running;
  try {
    const fixture = await prepareRoomPinnedAssetsFixture(directory); assert.equal(fixture.current.revision, 16);
    running = await startStudioHttpServer(serverOptions(directory));
    const base = `http://127.0.0.1:${running.address.port}`;
    const route = ({ revision = 16, roomId = ROOM_ID, version = 1 } = {}) => `/api/projects/${PROJECT_ID}/revisions/${revision}/room-variants/${roomId}/versions/${version}/pinned-assets`;
    const before = await running.studioService.readProjectTrusted(PROJECT_ID);
    let writes = 0; running.studioService.execute = () => { writes += 1; throw new Error('Read endpoint attempted a mutation'); };
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
      const response = await fetch(base + route(), { method }); assert.equal(response.status, 405); assert.equal(response.headers.get('allow'), 'GET'); await response.arrayBuffer();
    }
    for (const suffix of ['?assetVersion=1', '?projectId=other', '?limit=1']) { const response = await fetch(base + route() + suffix); assert.equal(response.status, 400); await response.json(); }
    const response = await fetch(base + route()); assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal(response.headers.get('cross-origin-resource-policy'), 'same-origin');
    const first = await response.json(); assert.equal(first.kind, 'room-pinned-assets'); assert.equal(first.projectRevision, 16); assert.equal(first.roomVersion, 1);
    assert.equal(first.assets.length, 1); assert.equal(first.assets[0].assetVersion, 1); assert.equal(first.assets[0].metadataVersion, 1);
    assert.deepEqual(first.assets[0].metadata, fixture.oldAsset.metadata); assert.deepEqual(first.assets[0].sliceBinding, fixture.oldAsset.sliceBinding);
    assert.equal(first.assets[0].preview.resourceUri, `/api/projects/${PROJECT_ID}/artifacts/sha256/${fixture.oldAsset.sliceBinding.digest}`);
    assert.deepEqual(await (await fetch(base + route())).json(), first);
    const mixed = await (await fetch(base + route({ roomId: MIXED_ROOM_ID }))).json();
    assert.deepEqual(mixed.assets.map(({ assetVersion, metadataVersion }) => [assetVersion, metadataVersion]), [[1, 1], [2, 2]]);
    for (const [request, code] of [[{ revision: 15 }, 'REVISION_CONFLICT'], [{ version: 2 }, 'ROOM_VERSION_CONFLICT']]) { const stale = await fetch(base + route(request)); assert.equal(stale.status, 409); assert.equal((await stale.json()).error.code, code); }
    const originalQuery = running.studioService.queryRoomPreviewSource.bind(running.studioService);
    for (const corrupt of [
      (source) => ({ ...source, assets: [] }),
      (source) => ({ ...source, assets: source.assets.map((asset) => ({ ...asset, sliceBinding: { ...asset.sliceBinding, projectId: 'project.foreign' } })) }),
      (source) => ({ ...source, assets: [...source.assets, fixture.current.snapshot.assetLibrary.assets[0]] }),
    ]) {
      running.studioService.queryRoomPreviewSource = async (...args) => corrupt(await originalQuery(...args));
      const denied = await fetch(base + route()); assert.notEqual(denied.status, 200); const body = await denied.json(); assert.equal(body.assets, undefined);
    }
    running.studioService.queryRoomPreviewSource = async (...args) => { const source = await originalQuery(...args); return { ...source, assets: source.assets.map((asset) => ({ ...asset, privatePath: '/private/do-not-expose', grantId: 'grant.do-not-expose' })) }; };
    const clean = await fetch(base + route()); assert.equal(clean.status, 200); assert.doesNotMatch(await clean.text(), /do-not-expose|privatePath|grantId/);
    assert.equal(writes, 0); assert.deepEqual(await running.studioService.readProjectTrusted(PROJECT_ID), before);
  } finally { if (running) await closeServer(running); await rm(root, { recursive: true, force: true }); }
});
