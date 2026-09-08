import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const app = (await readFile(new URL('../apps/studio-server/public/app.js', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const fragment = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));
const helpers = fragment('function currentProjectSlices(', 'function safeV2Preview(');
const snapshot = { atlases: [{ name: 'Test atlas', sliceHeads: [
  { sliceId: 'slice.one', version: 2, rectangle: { name: 'brighter' } },
  { sliceId: 'slice.two', version: 1, rectangle: { name: 'darker' } },
  { sliceId: 'slice.unnamed', version: 1, rectangle: {} },
] }] };
function element(tag) { return { tag, dataset: {}, children: [], append(...nodes) { this.children.push(...nodes); } }; }
const nodes = root => [root, ...(root.children ?? []).flatMap(n => typeof n === 'object' ? nodes(n) : [])];

function context() {
  const previewInputs = [];
  return { state: { project: { snapshot } }, document: { createElement: element },
    currentAssetLibrary: () => ({ assets: [] }), safeV2Preview: value => { previewInputs.push(value); return element('preview'); },
    copyableCanonical: (_label, value) => ({ tag: 'identity', value }),
    createAssetFromSliceButton: slice => ({ tag: 'create', id: slice.sliceId, version: slice.version }), previewInputs };
}

test('Library saved-slice cards display authored names and preserve ordinal fallback and identities', () => {
  const before = JSON.stringify(snapshot); const sandbox = context();
  const render = runInNewContext(`${helpers}\n${fragment('function renderSliceVocabulary(', 'function renderAssetLibrary(')}; renderSliceVocabulary;`, sandbox);
  const output = nodes(render());
  assert.deepEqual(output.filter(n => n.tag === 'h4').map(n => n.textContent), ['brighter', 'darker', 'Slice 3']);
  assert.deepEqual(sandbox.previewInputs.map(n => n.name), ['brighter', 'darker', 'Slice 3']);
  assert.deepEqual(output.filter(n => n.tag === 'create').map(n => [n.id, n.version]), [['slice.one', 2], ['slice.two', 1], ['slice.unnamed', 1]]);
  assert.equal(JSON.stringify(snapshot), before);
});

test('historical binding labels keep their saved name instead of using a newer head name', () => {
  const display = runInNewContext(`${helpers}; sliceDisplay;`, context());
  assert.equal(display({ sliceId: 'slice.one', sliceVersion: 1, rectangle: { name: 'original light' } }).label, 'original light');
  assert.equal(display({ sliceId: 'slice.one', sliceVersion: 2, rectangle: { name: 'brighter' } }).label, 'brighter');
  assert.equal(display({ sliceId: 'slice.one', sliceVersion: 1, rectangle: {} }).label, 'Pinned historical slice');
  assert.equal(display({ sliceId: 'slice.unnamed', sliceVersion: 1, rectangle: {} }).label, 'Slice 3');
});

test('Asset authoring caption uses the saved cut name as plain text without renaming its draft', () => {
  const sandbox = context(); sandbox.buildAssetAuthoringRequest = () => { throw new Error('Incomplete draft'); };
  const render = runInNewContext(`${helpers}\n${fragment('function assetAuthoringPreview(', 'function renderAssetAuthoring(')}; assetAuthoringPreview;`, sandbox);
  const draft = { values: { kind: 'surface', name: 'Human asset purpose' } };
  const output = nodes(render({ draft, pinned: { atlas: { name: 'Test atlas' }, ordinal: 1,
    slice: { sliceId: 'slice.html', version: 1, rectangle: { name: '<b>Named cut</b>' } } } }));
  assert(output.some(n => n.textContent === '<b>Named cut</b> · Test atlas · saved version 1'));
  assert.equal(draft.values.name, 'Human asset purpose');
});
