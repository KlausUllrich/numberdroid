import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { roomAssetPinKey, roomPinnedAssetsContext, roomPinnedAssetsKey, roomPinnedAssetsPath, normalizeRoomPinnedAssets } from '../apps/studio-server/public/room-pinned-assets-state.js';
const context = roomPinnedAssetsContext('project.one', 7, { roomVariantId: 'room.one', version: 2 });
const digest = 'a'.repeat(64);
const asset = { assetId: 'asset.one', assetVersion: 1, metadataVersion: 1, name: 'Old exact Asset', kind: 'prop', lifecycle: 'DRAFT',
  metadata: { spanTiles: { width: 2, height: 1 } }, sliceBinding: { projectId: 'project.one', digest }, findings: [],
  preview: { schemaVersion: 1, state: 'READY', resourceUri: `/api/projects/project.one/artifacts/sha256/${digest}`, alt: 'Old exact Asset' } };
const response = () => ({ schemaVersion: 1, kind: 'room-pinned-assets', ...context, assets: [structuredClone(asset)] });

test('exact scoped pinned read deduplicates placements and preserves historical geometry without accepting another head', () => {
  const projected = normalizeRoomPinnedAssets(response(), context, [asset, asset]);
  assert.equal(projected.length, 1); assert.equal(projected[0].metadata.spanTiles.width, 2);
  assert.notEqual(projected[0], asset);
  assert.equal(roomPinnedAssetsPath(context), '/api/projects/project.one/revisions/7/room-variants/room.one/versions/2/pinned-assets');
  for (const field of ['projectId', 'projectRevision', 'roomVariantId', 'roomVersion']) {
    const value = response(); value[field] = field.endsWith('Id') ? 'other.id' : 8;
    assert.throws(() => normalizeRoomPinnedAssets(value, context, [asset]));
  }
  const next = response(); next.assets[0].assetVersion = 2; assert.throws(() => normalizeRoomPinnedAssets(next, context, [asset]));
});

test('missing, duplicate, extra, unsafe-preview and unknown geometry rows fail closed', () => {
  for (const mutate of [
    (value) => { value.assets = []; }, (value) => { value.assets.push(structuredClone(asset)); },
    (value) => { value.assets[0].assetId = 'asset.other'; },
    (value) => { value.assets[0].preview.resourceUri += '?replacement=1'; },
    (value) => { value.assets[0].sliceBinding.projectId = 'project.other'; },
    (value) => { value.assets[0].metadata.spanTiles = null; },
    (value) => { value.assets[0].grant = 'forbidden'; },
  ]) { const value = response(); mutate(value); assert.throws(() => normalizeRoomPinnedAssets(value, context, [asset])); }
});

test('Room resolves exact current heads or its matching scoped cache and never invents missing geometry', async () => {
  const app = await readFile(new URL('../apps/studio-server/public/app.js', import.meta.url), 'utf8');
  const source = app.slice(app.indexOf('function exactRoomAsset('), app.indexOf('function roomPlacementVisual('));
  const snapshot = {}; const state = { project: { snapshot }, roomUi: { pinnedAssets: { key: roomPinnedAssetsKey(context), status: 'ready', assets: [asset] } } };
  let heads = [{ ...asset, assetVersion: 2, metadataVersion: 2, metadata: { spanTiles: { width: 3, height: 2 } } }];
  const api = runInNewContext(`${source}; ({ exactRoomAsset, roomAssetSpan });`, { state, currentAssetLibrary: () => ({ assets: heads }), selectedRoomPinnedContext: () => context, roomPinnedAssetsKey, roomAssetPinKey });
  assert.equal(api.exactRoomAsset(asset), asset); assert.equal(api.roomAssetSpan(api.exactRoomAsset(asset), 90).height, 2);
  state.roomUi.pinnedAssets.key = 'other-context'; assert.equal(api.exactRoomAsset(asset), null); assert.equal(api.roomAssetSpan(null), null);
  heads = [asset]; assert.equal(api.exactRoomAsset(asset), asset);
});

test('fully current placement pins avoid a historical GET', async () => {
  const app = await readFile(new URL('../apps/studio-server/public/app.js', import.meta.url), 'utf8');
  const source = app.slice(app.indexOf('function ensureRoomPinnedAssets('), app.indexOf("elements['workspace-content'].addEventListener('click', (event) => {", app.indexOf('function ensureRoomPinnedAssets(')));
  let reads = 0;
  const state = { project: { projectId: context.projectId, revision: context.projectRevision }, roomUi: { pinnedAssets: { key: null } } };
  const ensure = runInNewContext(`${source}; ensureRoomPinnedAssets;`, { state, roomPinnedAssetsContext, roomPinnedAssetsKey, roomAssetPinKey,
    currentAssetLibrary: () => ({ assets: [asset] }), api() { reads += 1; }, cancelRoomPinnedAssets() { throw new Error('No cancellation needed'); } });
  ensure({ roomVariantId: context.roomVariantId, version: context.roomVersion, placements: [asset] }, {}); assert.equal(reads, 0);
});


test('normal navigation cancels a pending pin read and returning Rooms starts a fresh owned read', async () => {
  const app = await readFile(new URL('../apps/studio-server/public/app.js', import.meta.url), 'utf8');
  const loaderStart = app.indexOf('let roomPinnedAssetsRequest =');
  const loader = app.slice(loaderStart, app.indexOf("elements['workspace-content'].addEventListener('click', (event) => {", loaderStart));
  const navStart = app.indexOf("elements['workspace-nav'].addEventListener('click', (event) => {");
  const nav = app.slice(navStart, app.indexOf("elements['project-select'].addEventListener", navStart));
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  for (const completion of ['resolve-away', 'reject-away', 'resolve-after-new-ready']) {
    const variant = { roomVariantId: context.roomVariantId, version: context.roomVersion, placements: [asset] };
    const state = { project: { projectId: context.projectId, revision: context.projectRevision, snapshot: {} }, workspace: 'rooms',
      roomUi: { pinnedAssets: { key: null, status: 'idle', assets: [] } }, taskUi: { view: 'list' } };
    const requests = []; let navigate;
    const sandbox = { state, AbortController, setTimeout, clearTimeout, structuredClone, roomPinnedAssetsContext, roomPinnedAssetsKey,
      roomPinnedAssetsPath, roomAssetPinKey, normalizeRoomPinnedAssets, currentRoomVariant: () => ({ variant }),
      currentAssetLibrary: () => ({ assets: [{ ...asset, assetVersion: 2 }] }),
      elements: { 'workspace-nav': { addEventListener(_type, callback) { navigate = callback; } } }, location: { hash: 'rooms' },
      api(_path, { signal }) { return new Promise((resolve, reject) => requests.push({ resolve, reject, signal })); },
      publishVisualEvidence() {}, renderWorkspace() {}, restoreRoomPreviewDomState() {},
    };
    const ensure = runInNewContext(`${loader}
${nav}
ensureRoomPinnedAssets;`, sandbox);
    sandbox.renderWorkspace = () => { if (state.workspace === 'rooms') ensure(variant, state.project.snapshot); };
    const go = (workspace) => navigate({ target: { closest: () => ({ dataset: { workspace } }) }, preventDefault() {} });
    ensure(variant, state.project.snapshot); assert.equal(requests.length, 1); assert.equal(state.roomUi.pinnedAssets.status, 'loading');
    go('assets'); assert.equal(requests[0].signal.aborted, true); assert.equal(state.roomUi.pinnedAssets.key, null);
    if (completion === 'resolve-away') requests[0].resolve(response());
    if (completion === 'reject-away') requests[0].reject(new Error('Late failure away from Rooms'));
    await flush(); assert.equal(state.workspace, 'assets'); assert.equal(state.roomUi.pinnedAssets.status, 'idle');
    go('rooms'); assert.equal(requests.length, 2); assert.equal(state.roomUi.pinnedAssets.status, 'loading');
    requests[1].resolve(response()); await flush();
    const resolved = state.roomUi.pinnedAssets; assert.equal(resolved.status, 'ready');
    assert.equal(resolved.assets[0].metadata.spanTiles.width, 2);
    if (completion === 'resolve-after-new-ready') {
      const stale = response(); stale.assets[0].name = 'Stale completion'; requests[0].resolve(stale); await flush();
      assert.equal(state.roomUi.pinnedAssets, resolved); assert.equal(resolved.assets[0].name, 'Old exact Asset');
    }
  }
});
