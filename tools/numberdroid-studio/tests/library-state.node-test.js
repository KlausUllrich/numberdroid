import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createLibraryUiState, librarySetProject, libraryAssetPin, libraryRouteKey, libraryNavigate,
  libraryBack, libraryInventory, libraryReviewGroups, filterLibraryItems, findLibraryItem,
} from '../apps/studio-server/public/library-state.js';
import {
  libraryPreviewDescriptor, createLibraryPreviewDocument, safeLibraryPreviewUrl,
} from '../apps/studio-server/public/library-detail-view.js';

const projectId = 'project.library';
const binding = (overrides = {}) => ({
  projectId, digest: 'a'.repeat(64), mediaType: 'image/png', width: 64, height: 96,
  sliceId: 'slice.body', sliceVersion: 1, sourceId: 'source.sheet', atlasId: 'atlas.sheet', ...overrides,
});
const image = (overrides = {}) => ({
  assetId: 'asset.body', assetVersion: 1, metadataVersion: 1, name: 'Coffee machine body', kind: 'prop',
  lifecycle: 'DRAFT', metadata: { role: 'coffee-machine', tags: ['kitchen'] }, sliceBinding: binding(), ...overrides,
});
const animation = (overrides = {}) => ({
  contentKind: 'animation', assetId: 'clip.glow', assetVersion: 1, metadataVersion: 1,
  name: 'Coffee-ready glow', kind: 'prop', lifecycle: 'DRAFT', metadata: { role: null, tags: [] },
  clip: {
    canvas: { width: 32, height: 20 }, fps: 8, playbackMode: 'pingpong',
    frames: [
      { frameId: 'frame.a', name: 'First light', slice: { sliceId: 'slice.glow', sliceVersion: 1 }, offset: { x: -8, y: -2 } },
      { frameId: 'frame.b', name: 'Second light', slice: { sliceId: 'slice.glow', sliceVersion: 2 }, offset: { x: 28, y: 16 } },
    ],
  },
  frameBindings: [
    { frameId: 'frame.a', sliceBinding: binding({ sliceId: 'slice.glow', width: 32, height: 20, digest: 'b'.repeat(64) }) },
    { frameId: 'frame.b', sliceBinding: binding({ sliceId: 'slice.glow', sliceVersion: 2, width: 40, height: 24, digest: 'c'.repeat(64) }) },
  ],
  ...overrides,
});
const assembly = (overrides = {}) => ({
  contentKind: 'assembly', assetId: 'assembly.coffee', assetVersion: 1, metadataVersion: 1,
  name: 'Coffee station', kind: 'prop', lifecycle: 'DRAFT', metadata: { role: null, tags: [] },
  assembly: {
    placementBounds: { x: 0, y: 0, width: 64, height: 96 }, anchor: { x: 32, y: 80 }, unitsPerPixel: 1 / 64,
    defaultStateId: 'state.idle', defaultVariantId: 'variant.default',
    states: [{ stateId: 'state.idle', name: 'Idle' }], variants: [{ variantId: 'variant.default', name: 'Graphite' }],
    blocking: { mode: 'components' },
    components: [{ componentId: 'component.body', name: 'Body', asset: { assetId: 'asset.body', assetVersion: 1, metadataVersion: 1 } }],
  },
  scene: {
    stateId: 'state.idle', variantId: 'variant.default', visualBounds: { x: -10, y: -5, width: 85, height: 110 },
    elements: [
      { componentId: 'component.display', contentKind: 'animation', clip: { frames: [{ artifact: { digest: 'b'.repeat(64), mediaType: 'image/png', pixelSize: { width: 32, height: 20 } }, imageMatrix: [1, 0, 0, 1, 4, 8] }] } },
      { componentId: 'component.body', contentKind: 'image', artifact: { digest: 'a'.repeat(64), mediaType: 'image/png', pixelSize: { width: 64, height: 96 } }, imageMatrix: [1, 0, 0, 1, -10, -5] },
    ],
  },
  ...overrides,
});
const entry = asset => ({ contentKind: asset.contentKind ?? 'image', asset, pin: libraryAssetPin(asset), key: `${asset.contentKind ?? 'image'}:${asset.assetId}` });
const nativeProposal = (state = 'PENDING') => ({
  proposalId: 'proposal.native', proposalVersion: 1, state, submittedRevision: 2,
  proposer: { actor: { id: 'agent.one', displayName: 'Studio agent' }, taskId: 'task.shared' },
  items: [{ assetId: 'asset.body', name: 'Revised body', kind: 'prop' }, { assetId: 'asset.floor', name: 'Floor', kind: 'surface' }],
});
const typedProposal = (contentKind, status = 'PENDING') => ({
  proposalId: `proposal.${contentKind}`, proposalVersion: 1, status,
  content: { assetId: contentKind === 'animation' ? 'clip.glow' : 'assembly.coffee', name: `Proposed ${contentKind}`, kind: 'prop' },
  proposerActorId: 'agent.one', proposerTaskId: 'task.shared', createdRevision: 3,
});
function snapshot() {
  return {
    sources: [{ sourceId: 'source.sheet', name: 'Approved kitchen sheet' }],
    atlases: [{ atlasId: 'atlas.sheet', sourceId: 'source.sheet', name: 'Kitchen cuts', sliceHeads: [] }],
    assets: [{ id: 'legacy.only', name: 'Legacy content' }],
    assetLibrary: { assets: [image()], proposals: [nativeProposal()] },
    clipLibrary: { assets: [animation()], proposals: [typedProposal('animation')] },
    assemblyLibrary: { assets: [assembly()], proposals: [typedProposal('assembly')] },
  };
}

test('Library combines saved typed heads while proposals, legacy records and exact references remain unchanged', () => {
  const saved = snapshot(), before = JSON.stringify(saved), items = libraryInventory(saved);
  assert.deepEqual(items.map(value => value.contentKind), ['image', 'animation', 'assembly']);
  assert.deepEqual(items.map(value => value.asset.name), ['Coffee machine body', 'Coffee-ready glow', 'Coffee station']);
  assert.equal(items[0].asset, saved.assetLibrary.assets[0]);
  assert.equal(items[0].relatedReviews[0].changeCount, 2);
  assert.equal(items[2].relatedReviews[0].proposalId, 'proposal.assembly');
  assert.equal(JSON.stringify(saved), before);
});

test('name, tag and exact resolved source relationship searches combine with independent Content and Use filters', () => {
  const items = libraryInventory(snapshot());
  assert.equal(filterLibraryItems(items, { search: 'APPROVED KITCHEN SHEET' }).length, 3);
  assert.deepEqual(filterLibraryItems(items, { search: 'kitchen', content: 'assembly', use: 'prop' }).map(value => value.asset.assetId), ['assembly.coffee']);
  assert.equal(filterLibraryItems(items, { content: 'animation', use: 'surface' }).length, 0);
  const saved = snapshot(); saved.assetLibrary.assets[0].assetVersion = 2;
  const assemblyEntry = libraryInventory(saved).find(value => value.contentKind === 'assembly');
  assert.equal(assemblyEntry.sourceNames.includes('Approved kitchen sheet'), false, 'newer heads do not stand in for unresolved exact component source relationships');
});

test('each existing proposal remains a typed review group even when agents and tasks match', () => {
  const saved = snapshot(), groups = libraryReviewGroups(saved);
  assert.equal(groups.length, 3);
  assert.equal(new Set(groups.map(value => value.key)).size, 3);
  assert.deepEqual(groups.map(value => value.changeCount), [2, 1, 1]);
  assert(groups.every(value => value.pending));
  assert(groups.every(value => value.taskId === 'task.shared'));
  const filtered = filterLibraryItems(groups, { content: 'image', use: 'surface' });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].proposal.items.length, 2, 'filters never reduce the native complete decision vector');
});

test('Pending and completed projections retain each backend lifecycle without unsupported partial work', () => {
  const saved = snapshot();
  for (const state of ['PENDING', 'DECIDED', 'APPLIED']) {
    saved.assetLibrary.proposals[0].state = state;
    assert.equal(libraryReviewGroups(saved)[0].pending, state !== 'APPLIED');
  }
  for (const contentKind of ['animation', 'assembly']) {
    const library = contentKind === 'animation' ? saved.clipLibrary : saved.assemblyLibrary;
    for (const status of ['PENDING', 'CHANGES_REQUESTED', 'ACCEPTED', 'DISCARDED']) {
      library.proposals[0].status = status;
      const group = libraryReviewGroups(saved).find(value => value.contentKind === contentKind);
      assert.equal(group.pending, ['PENDING', 'CHANGES_REQUESTED'].includes(status));
      assert.equal(group.changeCount, 1);
    }
  }
});

test('exact detail matching checks content kind, Asset and metadata versions without head fallback', () => {
  const saved = snapshot(), pin = libraryAssetPin(saved.assetLibrary.assets[0]);
  assert.equal(findLibraryItem(saved, pin).asset.assetId, 'asset.body');
  assert.equal(findLibraryItem(saved, { ...pin, metadataVersion: 2 }), null);
  assert.equal(findLibraryItem(saved, { ...pin, assetVersion: 2 }), null);
  assert.equal(findLibraryItem(saved, { ...pin, contentKind: 'assembly' }), null);
  assert.equal(libraryAssetPin({ assetId: 'new', assetVersion: 0, metadataVersion: 0 }), null);
});

test('Details and Review return preserve tab-specific filters, DOM selection snapshots and exact typed identities', () => {
  const ui = createLibraryUiState(projectId);
  ui.filters.assets = { search: 'coffee', content: 'assembly', use: 'prop' };
  ui.filters.pending = { search: 'agent', content: 'animation', use: 'all' };
  const filters = structuredClone(ui.filters), origin = { x: 0, y: 400, focus: 'details', selection: [2, 5], inner: { inventory: { x: 0, y: 60 } } };
  const pin = libraryAssetPin(assembly());
  libraryNavigate(ui, { view: 'detail', pin }, { domSnapshot: origin });
  origin.selection[0] = 99;
  assert.deepEqual(ui.domSnapshots[libraryRouteKey({ view: 'list', tab: 'assets' })].selection, [2, 5]);
  const review = { view: 'review', contentKind: 'assembly', proposalId: 'proposal.same', proposalVersion: 1 };
  libraryNavigate(ui, review);
  libraryNavigate(ui, { view: 'detail', proposed: { contentKind: 'assembly', proposalId: 'proposal.same', proposalVersion: 1 } });
  assert.deepEqual(libraryBack(ui), review);
  assert.deepEqual(libraryBack(ui), { view: 'detail', pin });
  assert.deepEqual(libraryBack(ui), { view: 'list', tab: 'assets' });
  assert.deepEqual(ui.filters, filters);
  assert.equal(libraryBack(ui), null);
  assert.notEqual(libraryRouteKey(review), libraryRouteKey({ ...review, contentKind: 'animation' }));
  assert.notEqual(libraryRouteKey(review), libraryRouteKey({ ...review, proposalVersion: 2 }));
});

test('project switching resets transient routes while same-project refresh preserves their state', () => {
  const ui = createLibraryUiState(projectId); ui.filters.assets.search = 'retained';
  libraryNavigate(ui, { view: 'list', tab: 'pending' });
  assert.equal(librarySetProject(ui, projectId), ui); assert.equal(ui.filters.assets.search, 'retained');
  assert.equal(librarySetProject(ui, 'project.other'), ui);
  assert.deepEqual(ui, createLibraryUiState('project.other'));
  assert.throws(() => libraryNavigate(ui, { view: 'detail', pin: { assetId: 'newer' } }), /exact/);
});

test('Animation preview includes canvas and all frame overhang while displaying its labelled first saved frame', () => {
  const record = animation(), before = JSON.stringify(record);
  const preview = libraryPreviewDescriptor({ entry: entry(record), projectId });
  assert.deepEqual(preview.bounds, { x: -8, y: -2, width: 76, height: 42 });
  assert.equal(preview.images.length, 1);
  assert(preview.images[0].href.endsWith('b'.repeat(64)));
  assert.match(preview.label, /paused at frame 1 of 2/);
  assert.equal(JSON.stringify(record), before);
  record.frameBindings[1].sliceBinding.sliceVersion = 1;
  assert.throws(() => libraryPreviewDescriptor({ entry: entry(record), projectId }), /exact saved Animation frame/);
});

test('Assembly preview retains all scene components, exact transforms, painter order and whole shared frame', () => {
  const record = assembly(), before = JSON.stringify(record);
  const preview = libraryPreviewDescriptor({ entry: entry(record), projectId });
  assert.equal(preview.images.length, 2);
  assert(preview.images[0].href.endsWith('a'.repeat(64)), 'body paints behind display');
  assert(preview.images[1].href.endsWith('b'.repeat(64)));
  assert.deepEqual(preview.images[1].matrix, [1, 0, 0, 1, 4, 8]);
  assert(preview.bounds.x < -10 && preview.bounds.y < -5);
  assert(preview.bounds.width > 85 && preview.bounds.height > 110);
  assert.match(preview.label, /Idle.*Graphite.*paused/);
  assert.equal(JSON.stringify(record), before);
});

test('missing, foreign and newer artwork are explained without unrelated image substitution', () => {
  const saved = image(), typed = entry(saved);
  assert.throws(() => libraryPreviewDescriptor({ entry: typed, record: image({ assetVersion: 2 }), projectId }), /exact saved Asset version/);
  assert.throws(() => libraryPreviewDescriptor({ entry: entry(image({ sliceBinding: binding({ projectId: 'foreign' }) })), projectId }), /exact project image/);
  assert.throws(() => libraryPreviewDescriptor({ entry: entry(image({ sliceBinding: binding({ mediaType: 'image/svg+xml' }) })), projectId }), /unsupported/);
  assert.throws(() => libraryPreviewDescriptor({ entry: entry(assembly({ scene: null })), projectId }), /exact saved Assembly/);
  assert.throws(() => libraryPreviewDescriptor({ entry: entry(image({ sliceBinding: binding({ digest: 'javascript:alert(1)' }) })), projectId }), /exact project image/);
});

test('full-size document escapes names, uses only exact absolute project CAS URLs and has no executable workflow', () => {
  const record = assembly({ name: '</title><script>alert("bad")</script>&' });
  const html = createLibraryPreviewDocument({ entry: entry(record), projectId, origin: 'https://studio.example.test' });
  assert(html.includes('&lt;script&gt;'));
  assert.equal(/<script|<iframe|\son\w+=/i.test(html), false);
  assert.equal((html.match(/<image /g) ?? []).length, 2);
  assert(html.includes(`https://studio.example.test/api/projects/${projectId}/artifacts/sha256/${'a'.repeat(64)}`));
  assert(html.includes(`https://studio.example.test/api/projects/${projectId}/artifacts/sha256/${'b'.repeat(64)}`));
  assert(html.includes('Content-Security-Policy'));
  assert.equal(html.includes('<button'), false);
  assert.throws(() => createLibraryPreviewDocument({ entry: entry(record), projectId, origin: 'javascript:alert(1)' }), /current Studio origin/);
  assert.throws(() => createLibraryPreviewDocument({ entry: entry(record), projectId, origin: 'https://name:secret@studio.example.test' }), /current Studio origin/);
});

test('proposed preview stays read-only without inventing a saved version and unsafe preview links are rejected', () => {
  const record = image(); delete record.assetVersion; delete record.metadataVersion;
  const html = createLibraryPreviewDocument({ entry: { contentKind: 'image', asset: record }, projectId, proposed: true, origin: 'http://127.0.0.1:4321' });
  assert(html.includes('Proposed Image')); assert.equal(html.includes('saved Asset v'), false);
  assert.equal(safeLibraryPreviewUrl('javascript:alert(1)', projectId), null);
  assert.equal(safeLibraryPreviewUrl(`/api/projects/foreign/artifacts/sha256/${'a'.repeat(64)}`, projectId), null);
  const path = `/api/projects/${projectId}/artifacts/sha256/${'a'.repeat(64)}`;
  assert.equal(safeLibraryPreviewUrl(path, projectId), path);
  assert.equal(safeLibraryPreviewUrl(`${path}?retarget=current`, projectId), null);
});
