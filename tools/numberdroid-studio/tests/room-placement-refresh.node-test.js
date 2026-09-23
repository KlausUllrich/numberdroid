import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { roomPinnedAssetsContext, roomPinnedAssetsKey } from '../apps/studio-server/public/room-pinned-assets-state.js';

const source = await readFile(new URL('../apps/studio-server/public/app.js', import.meta.url), 'utf8');
const block = source.slice(source.indexOf('function confirmedRoomMoveProjection('), source.indexOf('function renderRoomMoveDisplay('))
  + source.slice(source.indexOf('async function executeRoomMutation('), source.indexOf('async function executeRoomCreation('));

function fixture() {
  const previous = { roomVariantId: 'room.test', version: 3, lifecycle: 'DRAFT', createdRevision: 4,
    contentFingerprint: 'old', findings: [], placements: [
      { placementId: 'table', assetId: 'asset.table', assetVersion: 1, metadataVersion: 2,
        layer: 'SET_DRESSING', anchor: { x: 1, y: 1 }, rotation: 270, proposalId: null, proposalItemId: null },
      { placementId: 'floor', assetId: 'asset.floor', assetVersion: 1, metadataVersion: 1,
        layer: 'STRUCTURAL_SURFACE', anchor: { x: 0, y: 0 }, rotation: 0, proposalId: null, proposalItemId: null },
    ] };
  const moves = [{ placementId: 'table', expectedAssetId: 'asset.table', anchor: { x: 2, y: 1 }, rotation: 270 }];
  const room = { ...structuredClone(previous), version: 4, createdRevision: 8, contentFingerprint: 'new' };
  room.placements[0].anchor = { ...moves[0].anchor };
  const response = { schemaVersion: 1, projectId: 'project.test', revision: 8,
    value: { roomVariantId: 'room.test', roomVariantVersion: 4, contentFingerprint: 'new' }, event: { eventId: 'event.move' } };
  const query = { schemaVersion: 1, projectId: 'project.test', revision: 8,
    variants: [{ roomVariantId: 'room.test', headVersion: 4, current: room }] };
  return { previous, moves, response, query, projectId: 'project.test', revision: 7 };
}

function harness(f = fixture(), options = {}) {
  const entry = { roomVariantId: f.previous.roomVariantId, headVersion: f.previous.version, versions: [f.previous] };
  const library = { variants: [entry] };
  const calls = [], stats = { fullLoads: 0, fullRenders: 0, narrowRenders: 0, clearedKeys: 0, captured: 0, cancelledPreview: 0 };
  const state = { project: { projectId: f.projectId, revision: f.revision, snapshot: { project: { name: 'Test' }, roomLibrary: library } },
    workspace: 'rooms', roomNavigation: { route: 'editor' }, roomMutationPending: false,
    agentAccessCsrf: 'local-token', activity: [], roomUi: { view: 'editor', selectedPlacementId: 'table',
      shapeDraft: { dirty: false }, pinnedAssets: { status: 'ready', key: roomPinnedAssetsKey(roomPinnedAssetsContext(f.projectId, f.revision, f.previous)), assets: [{ assetId: 'historical.table' }] } } };
  const context = { state, roomPinnedAssetsContext, roomPinnedAssetsKey, JSON, Map, AbortSignal, manualProjectRefreshActive: false,
    currentRoomVariant: () => ({ variant: entry.versions.find(value => value.version === entry.headVersion) }),
    currentRoomLibrary: () => library, roomPinnedAssetsReady: () => true,
    roomSurfaceTools: { hasUnresolved: () => false, isLocked: () => false },
    elements: { 'project-select': { options: [{ value: f.projectId }] } },
    api: async (path, config) => { calls.push({ path, config }); return options.api ? options.api(path, config, state) : config?.method === 'POST' ? f.response : f.query; },
    setRoomMutationPending: pending => { state.roomMutationPending = pending; },
    captureRoomDomState: () => { stats.captured += 1; },
    showToast: () => {}, roomOperationKey: () => 'exact-key', clearRoomOperationKey: () => { stats.clearedKeys += 1; },
    cancelRoomPinnedAssets: () => { state.roomUi.pinnedAssets = { key: null, status: 'idle', assets: [] }; },
    cancelRoomPreviewLoad: () => { stats.cancelledPreview += 1; }, cancelPassiveProjectRefresh: () => {},
    loadProject: async () => { stats.fullLoads += 1; }, renderWorkspace: () => { stats.fullRenders += 1; },
  };
  runInNewContext(`let projectLoadGeneration = 10; ${block}
    refreshConfirmedRoomMoveDom = () => { onNarrowRender(); };
    this.execute = executeRoomMutation; this.check = confirmedRoomMoveProjection;
    this.refresh = refreshConfirmedRoomMove; this.generation = () => projectLoadGeneration;`,
  Object.assign(context, { onNarrowRender: () => { stats.narrowRenders += 1; } }));
  const run = () => context.execute({ operation: 'room-placement-move', target: 'table:3', path: '/placements-move',
    body: { expectedRoomVariantVersion: f.previous.version, moves: f.moves }, successMessage: 'Moved' });
  return { f, context, state, entry, calls, stats, run };
}

test('confirmed Move adopts only its exact authoritative Room and retains historical pins', async () => {
  const h = harness(), pins = h.state.roomUi.pinnedAssets.assets;
  assert.equal(await h.run(), true);
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[1].path, '/api/projects/project.test/rooms/room.test?includeVersions=false&includeProposals=false');
  assert.equal(JSON.parse(h.calls[0].config.body).idempotencyKey, 'exact-key');
  assert.equal(h.state.project.revision, 8); assert.equal(h.entry.headVersion, 4);
  assert.equal(h.entry.versions.length, 2); assert.equal(h.entry.versions[0].placements[0].anchor.x, 1);
  assert.equal(h.entry.versions[1].placements[0].anchor.x, 2);
  assert.equal(h.state.roomUi.selectedPlacementId, 'table'); assert.equal(h.state.roomUi.pinnedAssets.assets, pins);
  assert.equal(h.state.roomUi.pinnedAssets.key, roomPinnedAssetsKey(roomPinnedAssetsContext('project.test', 8, h.f.query.variants[0].current)));
  assert.equal(h.stats.fullLoads, 0); assert.equal(h.stats.fullRenders, 0); assert.equal(h.stats.narrowRenders, 1);
  assert.equal(h.stats.captured, 1); assert.equal(h.stats.cancelledPreview, 1); assert.equal(h.context.generation(), 12);
  assert.equal(h.state.roomMutationPending, false); assert.deepEqual(h.state.activity, [h.f.response.event]);
});

test('stale/nontarget projections, fingerprints, pins, provenance and moves fail closed', () => {
  const h = harness();
  const changes = [
    f => { f.query.revision += 1; }, f => { f.query.projectId = 'other'; },
    f => { f.query.variants[0].headVersion += 1; }, f => { f.query.variants[0].current.version += 1; },
    f => { f.query.variants[0].current.contentFingerprint = 'mismatch'; },
    f => { f.query.variants[0].current.createdRevision += 1; },
    f => { f.query.variants[0].current.placements[0].assetVersion += 1; },
    f => { f.query.variants[0].current.placements[0].metadataVersion += 1; },
    f => { f.query.variants[0].current.placements[0].proposalId = 'unexpected'; },
    f => { f.query.variants[0].current.placements[0].anchor.x = 3; },
    f => { f.query.variants[0].current.placements[1].rotation = 90; },
    f => { f.moves[0].expectedAssetId = 'other'; },
  ];
  for (const change of changes) { const f = fixture(); change(f); assert.equal(h.context.check(f), null); }
});

test('query failure or context race uses the existing full authoritative recovery', async () => {
  for (const mode of ['failure', 'newer-query', 'changed-local', 'wrong-pin']) {
    const f = fixture();
    const h = harness(f, { api: async (_path, config, state) => {
      if (config?.method === 'POST') return f.response;
      if (mode === 'failure') throw new Error('Read interrupted');
      if (mode === 'newer-query') f.query.revision += 1;
      if (mode === 'changed-local') state.project.revision += 1;
      if (mode === 'wrong-pin') f.query.variants[0].current.placements[0].assetVersion += 1;
      return f.query;
    } });
    assert.equal(await h.run(), true, mode);
    assert.equal(h.stats.fullLoads, 1, mode); assert.equal(h.stats.fullRenders, 1, mode);
    assert.equal(h.stats.narrowRenders, 0, mode); assert.equal(h.entry.headVersion, 3, mode);
  }
});

test('unknown or rejected POST never adopts or queries a speculative Room, preserving recovery and key', async () => {
  for (const status of [undefined, 409]) {
    const h = harness(fixture(), { api: async () => { throw Object.assign(new Error('Save failed'), { status }); } });
    assert.equal(await h.run(), false); assert.equal(h.calls.length, 1);
    assert.equal(h.stats.fullLoads, 1); assert.equal(h.stats.clearedKeys, 0);
    assert.equal(h.stats.narrowRenders, 0); assert.equal(h.state.project.revision, 7);
    assert.equal(h.state.roomMutationPending, false);
  }
});

test('consecutive confirmed moves use the newly adopted context and never repeat a project reload', async () => {
  const h = harness(); await h.run();
  h.f.previous = h.entry.versions[1]; h.f.revision = 8;
  h.f.moves[0].anchor = { x: 3, y: 1 };
  h.f.response = { ...h.f.response, revision: 9, event: { eventId: 'event.move.two' }, value: { ...h.f.response.value, roomVariantVersion: 5, contentFingerprint: 'next' } };
  const room = structuredClone(h.f.previous); room.version = 5; room.createdRevision = 9; room.contentFingerprint = 'next'; room.placements[0].anchor = { x: 3, y: 1 };
  h.f.query = { ...h.f.query, revision: 9, variants: [{ roomVariantId: 'room.test', headVersion: 5, current: room }] };
  assert.equal(await h.run(), true);
  assert.equal(h.state.project.revision, 9); assert.equal(h.entry.versions.at(-1).placements[0].anchor.x, 3);
  assert.equal(h.stats.narrowRenders, 2); assert.equal(h.stats.fullLoads, 0); assert.equal(h.calls.length, 4);
  assert.equal(JSON.parse(h.calls[2].config.body).expectedRoomVariantVersion, 4);
  assert.equal(JSON.parse(h.calls[2].config.body).expectedRevision, 8);
});

test('Rotate uses the same confirmed path without moving the anchor or changing pins', async () => {
  const f = fixture(); f.moves[0].anchor = { x: 1, y: 1 }; f.moves[0].rotation = 0;
  f.query.variants[0].current.placements[0].anchor = { x: 1, y: 1 };
  f.query.variants[0].current.placements[0].rotation = 0;
  const h = harness(f); assert.equal(await h.run(), true);
  assert.equal(h.entry.versions.at(-1).placements[0].rotation, 0);
  assert.equal(h.entry.versions.at(-1).placements[0].anchor.x, 1);
  assert.equal(h.entry.versions.at(-1).placements[0].metadataVersion, 2);
  assert.equal(h.stats.narrowRenders, 1); assert.equal(h.stats.fullLoads, 0);
});

test('Move waits for explicit manual refresh without a POST, then works after refresh finishes', async () => {
  const h = harness(); h.context.manualProjectRefreshActive = true;
  assert.equal(await h.run(), false); assert.equal(h.calls.length, 0);
  assert.equal(h.state.project.revision, 7); assert.equal(h.entry.headVersion, 3);
  h.context.manualProjectRefreshActive = false;
  assert.equal(await h.run(), true); assert.equal(h.calls.length, 2);
  assert.equal(h.state.project.revision, 8);
});

test('a stale historical pin cache is never rebound as exact evidence for the new Room', async () => {
  const h = harness(); h.state.roomUi.pinnedAssets.key = 'another-context';
  assert.equal(await h.run(), true);
  assert.equal(h.state.roomUi.pinnedAssets.status, 'idle');
  assert.equal(h.state.roomUi.pinnedAssets.key, null);
  assert.equal(h.state.roomUi.pinnedAssets.assets.length, 0);
});

test('non-Move Room commands keep their prior full refresh path', async () => {
  const h = harness();
  assert.equal(await h.context.execute({ operation: 'room-shape-set', target: 'room.test', path: '/shape', body: {}, successMessage: 'Saved' }), true);
  assert.equal(h.calls.length, 1); assert.equal(h.stats.fullLoads, 1); assert.equal(h.stats.fullRenders, 1);
  assert.equal(h.stats.narrowRenders, 0); assert.equal(h.context.generation(), 10);
});

test('confirmed Move renderer preserves canvas ownership, refreshes Inspector/findings and restores exact arrow focus', () => {
  const renderer = source.slice(source.indexOf('function refreshConfirmedRoomMoveDom('), source.indexOf('function renderRoomMoveDisplay('));
  assert.match(renderer, /refreshRoomSurfaceDom\(\{ placements: true \}\)/);
  assert.match(renderer, /renderRoomInspector\(variant, state\.project\.snapshot\)/);
  assert.match(renderer, /renderRoomLifecycle\(variant\)/); assert.match(renderer, /renderRoomFindings\(variant\)/);
  assert.match(renderer, /restoreRoomDomState\(\)/); assert.doesNotMatch(renderer, /renderWorkspace\(|replaceChildren\(/);
  assert.match(source, /control\.dataset\.roomFocusKey = `room-move-\$\{selected\.placementId\}-\$\{dx\}-\$\{dy\}`/);
});
