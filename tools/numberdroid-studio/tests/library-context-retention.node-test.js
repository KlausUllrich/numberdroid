import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import {
  createLibraryUiState, libraryAssetPin, libraryRouteKey, libraryNavigate, libraryBack,
} from '../apps/studio-server/public/library-state.js';

const app = await readFile(new URL('../apps/studio-server/public/app.js', import.meta.url), 'utf8');
function section(start, end) {
  const from = app.indexOf(`function ${start}(`), to = app.indexOf(`function ${end}(`, from);
  assert(from >= 0 && to > from, `Missing app function boundary: ${start} / ${end}`);
  return app.slice(from, to);
}
const projectId = 'project.library-retention';
const review = () => ({ view: 'review', contentKind: 'assembly', proposalId: 'proposal.one', proposalVersion: 2 });

function detailHarness() {
  const ui = createLibraryUiState(projectId), details = new Map(), retired = new Set();
  const liveUrls = new Set(), revoked = [], mounted = [];
  let sequence = 0;
  const record = { assetId: 'assembly.one', assetVersion: 3, metadataVersion: 2, name: 'Saved Assembly', scene: { elements: [] } };
  const entry = { contentKind: 'assembly', asset: record, pin: libraryAssetPin(record, 'assembly'), relatedReviews: [] };
  ui.route = review();
  const functions = runInNewContext([
    section('libraryReleasePreviewUrl', 'libraryPreviewKey'),
    section('librarySetDetail', 'libraryNativeLifecycleControls'),
    '; ({ libraryOpenReviewDetail, libraryOpenSavedDetail, libraryRenderDetail, libraryCollectPreviewUrls })',
  ].join('\n'), {
    state: { project: { projectId, revision: 7, snapshot: {} }, uiMode: 'local', assetMutationPending: false },
    libraryUi: ui, libraryDetails: details, libraryRetiredPreviewUrls: retired,
    libraryAssetPin, libraryRouteKey, structuredClone, Blob, location: { origin: 'http://127.0.0.1:3000' },
    elements: { 'workspace-content': { querySelectorAll: () => mounted } },
    URL: {
      createObjectURL(blob) { assert(blob instanceof Blob); const url = `blob:test-${++sequence}`; liveUrls.add(url); return url; },
      revokeObjectURL(url) { assert(liveUrls.delete(url), `URL must be released exactly once: ${url}`); revoked.push(url); },
    },
    findLibraryItem: () => entry, assemblyCanMutate: () => true,
    createLibraryPreviewDocument: () => '<!doctype html><title>Exact saved composition</title>',
    renderLibraryDetail: () => ({ dataset: {} }),
    goLibrary(route) { ui.route = route; },
    showToast(message) { assert.fail(message); },
  });
  return { ...functions, ui, details, retired, liveUrls, revoked, mounted, entry,
    open(side) {
      functions.libraryOpenReviewDetail('assembly', { projectId, side, proposalId: 'proposal.one', proposalVersion: 2, record });
      functions.libraryRenderDetail();
      return details.get(libraryRouteKey(ui.route)).url;
    },
  };
}

for (const side of ['proposed', 'current']) {
  test(`repeated ${side} Review Details replace same-key preview URLs without leaking`, () => {
    const h = detailHarness();
    for (let visit = 0; visit < 100; visit += 1) {
      const url = h.open(side);
      assert.equal(h.details.size, 1, 'Repeated visits use the same exact detail identity');
      assert.deepEqual([...h.liveUrls], [url], 'Only the current detail URL remains owned');
      assert.equal(h.revoked.length, visit);
      h.ui.route = review();
    }
  });
}

test('replacing a still-mounted detail retires its URL until the previous link unmounts', () => {
  const h = detailHarness(), first = h.open('current');
  h.mounted.push({ href: first });
  const second = h.open('current');
  assert.notEqual(first, second);
  assert(h.liveUrls.has(first));
  assert(h.retired.has(first));
  h.libraryCollectPreviewUrls();
  assert(h.liveUrls.has(first), 'A mounted full-size link remains usable');
  h.mounted.length = 0;
  h.libraryCollectPreviewUrls();
  assert.deepEqual([...h.liveUrls], [second]);
  assert.equal(h.retired.size, 0);
  h.libraryOpenSavedDetail(h.entry.pin);
  assert.equal(h.liveUrls.size, 0, 'Opening the saved card releases the same-pin review detail URL too');
});

function navigationHarness(workspace = 'activity', matchingMarker = true) {
  const ui = createLibraryUiState(projectId), origins = new Map(), restored = [];
  const state = { project: { projectId }, workspace, assetMutationPending: false };
  const listSnapshot = { projectId, workspace: 'assets', page: { x: 0, y: 900 }, focus: { attribute: 'data-asset-focus-key', value: 'last-card' } };
  const activitySnapshot = { projectId, workspace: 'activity', page: { x: 0, y: 25 }, focus: { attribute: 'data-asset-focus-key', value: 'history-review' } };
  const listKey = libraryRouteKey(ui.route);
  ui.domSnapshots[listKey] = structuredClone(listSnapshot);
  const content = { dataset: { libraryRoute: matchingMarker ? `${projectId}:${listKey}` : 'unrelated-editor' } };
  const currentSnapshot = () => state.workspace === 'activity' ? structuredClone(activitySnapshot)
    : { projectId, workspace: 'assets', page: { x: 0, y: 70 }, focus: { attribute: 'data-asset-focus-key', value: 'current-control' } };
  const functions = runInNewContext([
    section('libraryRouteIdentity', 'libraryFocusToken'),
    section('captureLibraryDom', 'restoreLibrarySnapshot'),
    section('libraryRestoreCurrent', 'libraryOrigin'),
    section('goLibrary', 'libraryAllGroups'),
    '; ({ goLibrary, libraryBackToPrevious })',
  ].join('\n'), {
    state, libraryUi: ui, libraryExternalOrigins: origins, libraryReadGeneration: 0,
    libraryRouteKey, libraryNavigate, libraryBack, structuredClone,
    elements: { 'workspace-content': content }, libraryHasEditor: () => false, libraryNavigationAllowed: () => true,
    libraryDomSnapshot: currentSnapshot, restoreLibrarySnapshot: snapshot => { if (snapshot) restored.push(snapshot); },
    cancelPinnedAssetsOnWorkspaceExit() {}, history: { replaceState() {} },
    renderWorkspace() {
      if (state.workspace === 'assets') content.dataset.libraryRoute = `${projectId}:${libraryRouteKey(ui.route)}`;
      else delete content.dataset.libraryRoute;
    },
    showToast(message) { assert.fail(message); },
  });
  return { ...functions, ui, state, origins, restored, listSnapshot, activitySnapshot, listKey };
}

test('Activity to Review to Details and Back retains Library snapshot and returns to Activity context', () => {
  const h = navigationHarness();
  h.goLibrary(review());
  assert.deepEqual(h.ui.domSnapshots[h.listKey], h.listSnapshot);
  assert.deepEqual(h.origins.get(libraryRouteKey(review())), h.activitySnapshot);
  h.goLibrary({ view: 'detail', proposed: { contentKind: 'assembly', proposalId: 'proposal.one', proposalVersion: 2 }, assetId: 'assembly.one' }, { readonlyDetour: true });
  h.libraryBackToPrevious();
  assert.deepEqual(h.ui.route, review());
  assert.equal(h.state.workspace, 'assets');
  assert.equal(h.origins.size, 1, 'The detail detour must retain the history origin');
  h.libraryBackToPrevious();
  assert.equal(h.state.workspace, 'activity');
  assert.deepEqual(h.restored.at(-1), h.activitySnapshot);
  assert.deepEqual(h.ui.domSnapshots[h.listKey], h.listSnapshot);
  assert.equal(h.origins.size, 0);
});

test('navigation captures matching Library DOM but does not overwrite it with an unrelated mounted route', () => {
  for (const matching of [false, true]) {
    const h = navigationHarness('assets', matching);
    h.goLibrary(review());
    assert.equal(h.ui.domSnapshots[h.listKey].page.y, matching ? 70 : 900);
    assert.equal(h.origins.size, 0);
  }
});
