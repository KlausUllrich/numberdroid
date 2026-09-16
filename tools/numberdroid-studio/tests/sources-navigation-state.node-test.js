import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createSourcesUiState,
  filterImageWorkbench,
  filterSourceImages,
  imageWorkbenchEntries,
  sourceNeedsReview,
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
  assert.equal(sourceStatusPresentation(sources[0]).label, 'Ready to use');
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
  assert.equal(workbenchStatusPresentation(entries[0]).label, 'Saved work · nothing running');
  assert.equal(workbenchStatusPresentation(entries[1]).label, '2 saved cuts');
  assert.deepEqual(filterImageWorkbench(entries, { search: 'cups' }).map(({ atlas }) => atlas.id), ['atlas.saved']);
  assert.deepEqual(filterImageWorkbench(entries, { attention: 'needs-review' }), []);
});

test('production Sources UI uses the approved names and keeps technical facts collapsed', () => {
  const app = fs.readFileSync(path.join(root, 'apps/studio-server/public/app.js'), 'utf8');
  const cutter = fs.readFileSync(path.join(root, 'apps/studio-server/public/cutter-editor-view.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'apps/studio-server/public/styles.css'), 'utf8');
  assert.match(app, /\['images', 'Source Images'\], \['workbench', 'Image Workbench'\]/);
  assert.match(app, /Review is an attention state, not another production step\./);
  assert.match(app, /Technical details/);
  assert.match(app, /Open in Image Workbench/);
  assert.match(cutter, /Sources \/ Image Workbench/);
  assert.match(cutter, /Back to Image Workbench/);
  assert.doesNotMatch(cutter, /Sources \/ Preparation/);
  assert.match(css, /\.disabled-control-reason:focus-visible/);
});
