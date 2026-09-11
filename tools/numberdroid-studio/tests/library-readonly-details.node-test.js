import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { libraryAssetPin, libraryRouteKey, findLibraryItem } from '../apps/studio-server/public/library-state.js';
import { renderLibraryDetail } from '../apps/studio-server/public/library-detail-view.js';

const app = (await readFile(new URL('../apps/studio-server/public/app.js', import.meta.url), 'utf8')).replace(/\r\n?/g, '\n');
function section(start, end) {
  const first = app.indexOf(start), last = app.indexOf(end, first + start.length);
  assert(first >= 0 && last > first, `Missing production function boundary: ${start}`);
  return app.slice(first, last);
}

// Only DOM operations are substituted; the host detail, public detail renderer,
// exact inventory lookup, validation renderer and lifecycle helper are production code.
class Element {
  constructor(tag) { this.tagName = tag; this.dataset = {}; this.children = []; this.attributes = {}; this.className = ''; }
  append(...nodes) { this.children.push(...nodes); }
  set textContent(value) { this.children = []; this.text = String(value); }
  get textContent() { return (this.text ?? '') + this.children.map(child => child.textContent).join(''); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  addEventListener() {}
  matches(selector) {
    const data = /^\[data-([a-z-]+)(?:="([^"]*)")?\]$/.exec(selector);
    if (data) {
      const key = data[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      return Object.hasOwn(this.dataset, key) && (data[2] === undefined || this.dataset[key] === data[2]);
    }
    return selector.startsWith('.') ? this.className.split(' ').includes(selector.slice(1)) : this.tagName === selector;
  }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
}

function harness(t, mode) {
  const priorDocument = globalThis.document;
  const document = { createElement: tag => new Element(tag), createTextNode: text => { const node = new Element('#text'); node.textContent = text; return node; } };
  globalThis.document = document;
  t.after(() => { globalThis.document = priorDocument; });
  const projectId = 'project.readonly-details';
  const record = {
    assetId: 'asset.pinned', assetVersion: 1, metadataVersion: 1, name: 'Pinned image', kind: 'prop', lifecycle: 'VALIDATED',
    metadata: { placement: { confirmation: 'confirmed', modes: ['ground'], wallSafe: false }, connectors: [{ edge: 'north' }], continuityProfile: 'old-profile', collision: { mode: 'none' }, navigation: { effect: 'passable' }, runtimeEligible: false },
    sliceBinding: { projectId, sourceId: 'source.old', sliceId: 'slice.old', sliceVersion: 1, mediaType: 'image/png', digest: 'a'.repeat(64), width: 16, height: 24 },
    findings: [{ findingId: 'finding.old', severity: 'WARNING', ruleId: 'studio.asset.old-warning', path: 'metadata.placement', explanation: 'Retained warning explanation', remediation: 'Inspect the pinned placement' }],
    warningDispositions: ['finding.old'],
  };
  const proposed = mode === 'proposed';
  if (proposed) { delete record.lifecycle; delete record.assetVersion; delete record.metadataVersion; }
  const pin = proposed ? null : libraryAssetPin(record, 'image');
  const route = proposed ? { view: 'detail', proposed: { contentKind: 'image', proposalId: 'proposal.image', proposalVersion: 1 }, itemId: 'item.image' } : { view: 'detail', pin };
  const head = mode === 'stale' ? { ...record, assetVersion: 2, findings: [{ ...record.findings[0], explanation: 'New head warning must not leak' }] } : structuredClone(record);
  const snapshot = { assetLibrary: { assets: proposed ? [] : [head], proposals: [] } };
  const entry = { contentKind: 'image', asset: record, pin, sourceNames: [], relatedReviews: [] };
  const selected = { entry, record, proposed, ready: true, url: `/api/projects/${projectId}/artifacts/sha256/${'a'.repeat(64)}` };
  const context = {
    document, structuredClone, libraryUi: { route }, libraryRouteKey, findLibraryItem, renderLibraryDetail,
    libraryDetails: new Map([[libraryRouteKey(route), selected]]),
    state: { project: { projectId, revision: 2, snapshot }, uiMode: ['remote', 'unknown'].includes(mode) ? mode : 'local', assetMutationPending: mode === 'pending' },
    sliceDisplay: () => ({ label: 'Pinned cut', atlasName: 'Original atlas' }),
  };
  const code = section('function compactValues(', 'function captureAssetDomState(')
    + section('function libraryRenderDetail(', 'function libraryRenderReview(');
  return runInNewContext(`${code}\nlibraryRenderDetail()`, context);
}

for (const mode of ['stale', 'remote', 'unknown', 'proposed', 'pending', 'mutable']) {
  test(`native ${mode} detail preserves exact findings and only current local heads expose lifecycle controls`, t => {
    const root = harness(t, mode), validation = root.querySelector('.library-lifecycle');
    assert(validation, 'Read-only inspection must retain the native validation section');
    assert.match(validation.textContent, /Retained warning explanation/);
    assert.match(validation.textContent, /Inspect the pinned placement/);
    assert.doesNotMatch(validation.textContent, /New head warning must not leak/);
    for (const text of ['Placement', 'Connectivity', 'Collision', 'Navigation', 'Runtime metadata', 'old-profile', 'passable', 'not eligible']) assert(validation.textContent.includes(text), text);
    const lifecycle = root.querySelectorAll('[data-asset-lifecycle]');
    const warnings = root.querySelectorAll('[data-warning-disposition]');
    assert.equal(lifecycle.length, mode === 'mutable' ? 1 : 0);
    assert.equal(warnings.length, mode === 'mutable' ? 1 : 0);
    const edit = root.querySelector('[data-library-action="edit"]');
    if (mode === 'proposed') assert.equal(edit, null);
    else assert.equal(edit.disabled, mode !== 'mutable');
    if (mode === 'mutable') {
      assert.equal(lifecycle[0].dataset.targetLifecycle, 'FINAL');
      assert.equal(lifecycle[0].dataset.assetVersion, 1);
      assert.equal(warnings[0].dataset.warningDisposition, 'finding.old');
      assert.equal(warnings[0].checked, true);
    }
  });
}
