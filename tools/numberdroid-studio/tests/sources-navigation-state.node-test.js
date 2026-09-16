import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createSourcesUiState,
  cutterOutputPresentation,
  filterImageWorkbench,
  filterSourceImages,
  imageWorkbenchEntries,
  savedOutputConsumers,
  sourceNeedsReview,
  sourceReviewCounts,
  sourceStatusPresentation,
  workbenchStatusPresentation,
} from '../apps/studio-server/public/sources-navigation-state.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function source(id, lifecycle, disposition, overrides = {}) {
  return {
    id,
    name: overrides.name ?? id,
    mediaType: 'image/png',
    lifecycle: { state: lifecycle },
    review: { disposition },
    provenance: { origin: 'human_upload', prompt: overrides.prompt ?? null },
    ...overrides,
  };
}

test('Source Images treats owner review as an attention filter, not a content tab', () => {
  const ui = createSourcesUiState();
  assert.deepEqual(ui, { tab: 'images', attention: 'all', search: '', importOpen: false });

  const sources = [
    source('source.approved', 'APPROVED_SOURCE', 'USER_APPROVED', { name: 'Approved machine' }),
    source('source.review', 'REVIEWED', 'PENDING', { name: 'Coffee station proposal' }),
    source('source.draft', 'IMPORTED', 'PENDING', { name: 'Unsubmitted sheet' }),
    source('source.rejected', 'REJECTED_SOURCE', 'USER_REJECTED'),
  ];
  assert.equal(sourceNeedsReview(sources[0]), false);
  assert.equal(sourceNeedsReview(sources[1]), true);
  assert.deepEqual(filterSourceImages(sources, { attention: 'needs-review' }).map(({ id }) => id), ['source.review']);
  assert.deepEqual(filterSourceImages(sources, { search: 'machine' }).map(({ id }) => id), ['source.approved']);
  assert.equal(sourceStatusPresentation(sources[0]).label, 'Approved');
  assert.match(sourceStatusPresentation(sources[0]).explanation, /No review needed/);
  assert.equal(sourceStatusPresentation(sources[1]).label, 'Needs review');
  assert.equal(sourceStatusPresentation(sources[2]).label, 'Ready to submit');
  assert.equal(sourceStatusPresentation(sources[3]).label, 'Not approved');
});

test('Image Workbench derives only truthful saved work and output states', () => {
  const approved = source('source.approved', 'APPROVED_SOURCE', 'USER_APPROVED', { name: 'Coffee sheet' });
  const entries = imageWorkbenchEntries({
    sources: [approved],
    atlases: [
      { id: 'atlas.draft', name: 'Draft cuts', sourceId: approved.id, definitionVersion: 1, rectangles: [{}], sliceHeads: [] },
      { id: 'atlas.saved', name: 'Saved cups', sourceId: approved.id, definitionVersion: 2, rectangles: [{}, {}], sliceHeads: [{}, {}] },
    ],
  });
  assert.equal(entries.length, 2);
  assert.equal(entries[0].source, approved);
  assert.equal(workbenchStatusPresentation(entries[0]).label, 'Cut layout saved');
  assert.equal(workbenchStatusPresentation(entries[1]).label, '2 saved output images');
  assert.deepEqual(filterImageWorkbench(entries, { search: 'cups' }).map(({ atlas }) => atlas.id), ['atlas.saved']);
  assert.deepEqual(filterImageWorkbench(entries, { attention: 'needs-review' }), []);
});

test('Sources review counts exclude saved work and unrelated Library proposals', () => {
  const snapshot = {
    sources: [source('source.review', 'REVIEWED', 'PENDING'), source('source.ready', 'APPROVED_SOURCE', 'USER_APPROVED')],
    atlases: [{ id: 'atlas.ready', sourceId: 'source.ready', sliceHeads: [{ sliceId: 'slice.one', version: 1 }] }],
    assetLibrary: { proposals: [{ state: 'PENDING' }] },
    clipLibrary: { proposals: [{ state: 'PENDING' }] },
    assemblyLibrary: { proposals: [{ state: 'PENDING' }] },
    reviews: [{ status: 'PENDING' }],
  };
  assert.deepEqual(sourceReviewCounts(snapshot), { images: 1, workbench: 0 });
  assert.deepEqual(sourceReviewCounts({ ...snapshot, sources: snapshot.sources.slice(1) }), { images: 0, workbench: 0 });
  assert.deepEqual(sourceReviewCounts(), { images: 0, workbench: 0 });
});

test('saved output links match exact image and animation slice versions once', () => {
  const binding = { sliceId: 'slice.coffee', sliceVersion: 2 };
  const image = { assetId: 'image.match', sliceBinding: binding };
  const animation = { assetId: 'clip.match', clip: { frames: [{ slice: binding }, { slice: binding }] } };
  const snapshot = {
    assetLibrary: { assets: [image, { assetId: 'image.old', sliceBinding: { ...binding, sliceVersion: 1 } }, { assetId: 'image.other', sliceBinding: { ...binding, sliceId: 'slice.other' } }] },
    clipLibrary: { assets: [animation, { assetId: 'clip.old', clip: { frames: [{ slice: { ...binding, sliceVersion: 1 } }] } }] },
  };
  assert.deepEqual(savedOutputConsumers(snapshot, { sliceId: binding.sliceId, version: 2 }), [
    { contentKind: 'image', asset: image }, { contentKind: 'animation', asset: animation },
  ]);
  assert.deepEqual(savedOutputConsumers({}, { sliceId: binding.sliceId, version: 2 }), []);
});

test('output presentation distinguishes generated results from saved outputs and local edits', () => {
  const generated = { state: 'SUCCEEDED', outputs: [{ digest: 'example' }] };
  const preview = cutterOutputPresentation({ job: generated, savedCount: 4, dirty: true });
  assert.equal(preview.kind, 'preview');
  assert.equal(preview.label, 'Not saved yet');
  assert.equal(preview.compare, true);
  assert.match(preview.description, /Previously saved images stay available/);
  assert.match(preview.description, /unsaved cut edits are not included/);
  assert.equal(cutterOutputPresentation({ job: generated }).compare, false);
  for (const state of ['QUEUED', 'RUNNING', 'FAILED', 'CANCELLED', 'DISCARDED', 'APPLIED']) {
    const saved = cutterOutputPresentation({ job: { ...generated, state }, savedCount: 4 });
    assert.equal(saved.kind, 'saved', state);
    assert.equal(saved.label, 'Saved output images', state);
    assert.equal(saved.compare, false, state);
    assert.match(saved.description, /not another approval/, state);
  }
  assert.equal(cutterOutputPresentation().label, 'No output images yet');
  assert.equal(cutterOutputPresentation({ job: { state: 'SUCCEEDED', outputs: [] } }).kind, 'saved');
});

test('production Sources UI uses the approved names and keeps technical facts collapsed', () => {
  const app = fs.readFileSync(path.join(root, 'apps/studio-server/public/app.js'), 'utf8');
  const cutter = fs.readFileSync(path.join(root, 'apps/studio-server/public/cutter-editor-view.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'apps/studio-server/public/styles.css'), 'utf8');
  assert.ok(/\['images', 'Source Images'\], \['workbench', 'Image Workbench'\]/.test(app), 'two content tabs');
  assert.equal(/sources-review-attention|sources-workbench-intro/.test(app), false, 'redundant Sources banners removed');
  for (const phrase of ['Technical details', 'Open existing image work', 'workbench-output-previews', 'cutter-primary-outputs', 'cutter-output-comparison']) {
    assert.ok(app.includes(phrase), `Sources presentation includes ${phrase}`);
  }
  assert.match(cutter, /Sources \/ Image Workbench/);
  assert.match(cutter, /Back to Image Workbench/);
  const actions = "[['edit', 'Cut images'], ['outputs', 'View Output']]";
  assert.ok(app.includes(actions), 'Workbench card actions use the same labels and order as the editor');
  assert.ok(cutter.includes(actions), 'Editor actions put cutting left and output right');
  assert.doesNotMatch(cutter, /Sources \/ Preparation/);
  assert.match(css, /\.disabled-control-reason:focus-visible/);
});
