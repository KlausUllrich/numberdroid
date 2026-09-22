import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { renderRoomsCollection, renderRoomTemplateDetail } from '../apps/studio-server/public/rooms-navigation-view.js';

// Deliberately no HTML parser: author-controlled labels must use textContent.
class ViewNode {
  constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.listeners = {}; this.ownText = ''; }
  set textContent(value) { this.ownText = String(value); this.children = []; }
  get textContent() { return this.ownText + this.children.map(node => node.textContent).join(' '); }
  set innerHTML(_value) { throw new Error('Room navigation must not parse author-controlled HTML'); }
  append(...nodes) { this.children.push(...nodes); }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  addEventListener(type, callback) { (this.listeners[type] ??= []).push(callback); }
  dispatch(type, event = {}) { for (const callback of this.listeners[type] ?? []) callback(event); }
  focus(options) { this.focusOptions = options; }
}

const walk = node => [node, ...node.children.flatMap(walk)];
const matching = (root, predicate) => walk(root).filter(predicate);
const button = (root, action) => matching(root, node => node.tagName === 'button' && node.dataset.roomNavAction === action)[0];
const makeDocument = () => ({ createElement: tag => new ViewNode(tag), createElementNS: (_ns, tag) => new ViewNode(tag), getElementById: () => null });
const makeTemplate = (version = 1, extra = {}) => ({ roomArchetypeId: 'template.family', version, displayName: `Family rules v${version}`, kind: 'room', dimensionPolicy: { width: { min: 3, max: 64, preferred: 4 }, height: { min: 3, max: 64, preferred: 5 } }, connectorPolicy: { min: 1, max: 4, requiredSides: ['north'] }, allowedAssetKinds: ['surface', 'prop'], ...extra });
const makeRoom = (version = 1, extra = {}) => ({ version, roomVariantId: 'room.family', displayName: 'Family room', roomArchetypeId: 'template.family', archetypeVersion: 1, lifecycle: 'DRAFT', width: 4, height: 5, placements: [], findings: [], connectors: [], ...extra });
const makeEntry = (room = makeRoom()) => ({ roomVariantId: room.roomVariantId, headVersion: room.version, versions: [room] });
const makeLibrary = () => ({ archetypes: [makeTemplate()], variants: [makeEntry()] });
const makeUi = (extra = {}) => ({ tab: 'rooms', search: { rooms: '', templates: '' }, status: 'all', kind: 'all', ...extra });
const collection = (library = makeLibrary(), ui = makeUi(), callbacks = {}) => renderRoomsCollection({ document: makeDocument(), library, ui, ...callbacks });
function freeze(value) { for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child); return Object.freeze(value); }

test('Room collection never substitutes a historical version for an unavailable exact head', () => {
  const library = { archetypes: [makeTemplate()], variants: [{ roomVariantId: 'room.missing', headVersion: 3, versions: [makeRoom(1, { displayName: 'Stale friendly name' })] }] };
  const root = collection(library);
  assert.match(root.textContent, /The exact saved version is unavailable/);
  assert.match(root.textContent, /No other version is shown as current/);
  assert.doesNotMatch(root.textContent, /Stale friendly name|Draft · editable|0 saved errors/);
  assert.equal(button(root, 'open-room').textContent, 'Inspect unavailable room');
  assert.equal(matching(root, node => node.tagName === 'svg').length, 0);
});

test('Room cards use their pinned template version, never its newer head or arbitrary fallback', () => {
  const library = { archetypes: [makeTemplate(2), makeTemplate(1)], variants: [makeEntry()] };
  assert.match(collection(library).textContent, /Template: Family rules v1/);
  library.archetypes = [makeTemplate(2)];
  const root = collection(library);
  assert.match(root.textContent, /Exact saved template unavailable/);
  assert.doesNotMatch(root.textContent, /Template: Family rules v2/);
});

test('Room lifecycle and attention remain truthful without implying validation or publication', () => {
  const library = makeLibrary();
  library.variants = ['DRAFT', 'VALIDATED', 'FINAL'].map((lifecycle, i) => makeEntry(makeRoom(i + 1, { lifecycle, roomVariantId: `room.${i}`, findings: [{ severity: 'ERROR' }, { severity: 'WARNING' }, { severity: 'WARNING' }, { severity: 'INFO' }] })));
  const root = collection(library);
  const cards = matching(root, node => node.dataset.roomCard);
  assert.equal(cards.length, 3);
  for (const [i, word] of ['Draft · editable', 'Validated · read-only', 'Final · read-only'].entries()) {
    assert.ok(cards[i].textContent.includes(word));
    assert.match(cards[i].textContent, /1 saved error · 2 warnings/);
    assert.equal(button(cards[i], 'open-room').textContent, i ? 'View room' : 'Open room');
  }
  assert.equal(button(root, 'finalize'), undefined);
  assert.equal(button(root, 'publish'), undefined);
  library.variants = [makeEntry(makeRoom(1, { findings: undefined }))];
  assert.match(collection(library).textContent, /Saved findings unavailable — needs attention/);
  assert.doesNotMatch(collection(library).textContent, /0 saved errors/);
});

test('Rendering immutable Rooms and Templates calls no action and changes no model state', () => {
  const library = freeze(makeLibrary()); const ui = freeze(makeUi()); const calls = [];
  const before = JSON.stringify({ library, ui });
  collection(library, ui, { onAction: (...args) => calls.push(args), onFilter: (...args) => calls.push(args) });
  collection(library, freeze(makeUi({ tab: 'templates' })), { onAction: (...args) => calls.push(args) });
  renderRoomTemplateDetail({ document: makeDocument(), template: library.archetypes[0], onAction: (...args) => calls.push(args) });
  assert.equal(JSON.stringify({ library, ui }), before);
  assert.deepEqual(calls, []);
});

test('Empty projects guide template creation; existing templates guide first Room creation', () => {
  const empty = collection({ archetypes: [], variants: [] });
  assert.match(empty.textContent, /Start with a room template/);
  assert.equal(button(empty, 'new-room').disabled, true);
  assert.match(button(empty, 'new-room').title, /Create a template first/);
  assert.equal(button(empty, 'new-template').textContent, 'New template');
  const ready = collection({ archetypes: [makeTemplate()], variants: [] });
  assert.match(ready.textContent, /No rooms yet/);
  assert.match(ready.textContent, /floor and furniture start empty/);
  assert.notEqual(button(ready, 'new-room').disabled, true);
});

test('No matching filter results are not misrepresented as a project with no Rooms', () => {
  const root = collection(makeLibrary(), makeUi({ search: { rooms: 'not present', templates: '' } }));
  assert.match(root.textContent, /0 of 1 rooms/);
  assert.match(root.textContent, /No matches/);
  assert.doesNotMatch(root.textContent, /No rooms yet|Start with a room template/);
  assert.equal(button(root, 'clear-filters').textContent, 'Clear filters');
});

test('Template collection exposes only newest versions and callbacks retain exact displayed version', () => {
  const library = { archetypes: [makeTemplate(2), makeTemplate(1)], variants: [makeEntry()] };
  const calls = []; const root = collection(library, makeUi({ tab: 'templates' }), { onAction: (...args) => calls.push(args) });
  const cards = matching(root, node => node.dataset.roomTemplateCard);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].dataset.roomTemplateVersion, '2');
  assert.match(cards[0].textContent, /0 rooms use this exact template version/);
  assert.match(cards[0].textContent, /No floor or furniture included/);
  button(cards[0], 'from-template').dispatch('click');
  button(cards[0], 'view-template').dispatch('click');
  assert.deepEqual(calls, [['from-template', 'template.family', 2], ['view-template', 'template.family', 2]]);
  const detail = renderRoomTemplateDetail({ document: makeDocument(), template: makeTemplate(1), onAction: (...args) => calls.push(args) });
  button(detail, 'from-template').dispatch('click');
  assert.deepEqual(calls.at(-1), ['from-template', 'template.family', 1]);
  assert.match(detail.textContent, /Rooms retain the exact template version/);
  const unavailable = renderRoomTemplateDetail({ document: makeDocument(), template: null });
  assert.match(unavailable.textContent, /No other version has been opened/);
  assert.equal(button(unavailable, 'from-template'), undefined);
});

test('Newly saved items hidden by filters offer an explicit Show all without changing filters', () => {
  for (const tab of ['rooms', 'templates']) {
    const ui = freeze(makeUi({ tab, search: { rooms: 'no match', templates: 'no match' },
      lastCreated: { tab, id: tab === 'rooms' ? 'room.family' : 'template.family', name: 'untrusted stale name' } }));
    const calls = [], before = JSON.stringify(ui);
    const root = collection(makeLibrary(), ui, { onAction: (...args) => calls.push(args) });
    assert.match(root.textContent, /was saved, but your current filters hide it/);
    assert.doesNotMatch(root.textContent, /untrusted stale name/);
    assert.deepEqual(calls, []); assert.equal(JSON.stringify(ui), before);
    const show = matching(root, node => node.tagName === 'button' && node.textContent === 'Show all')[0];
    show.dispatch('click'); assert.deepEqual(calls, [['clear-filters', undefined, undefined]]);
    const visible = collection(makeLibrary(), { ...ui, search: { rooms: '', templates: '' } });
    assert.doesNotMatch(visible.textContent, /was saved, but your current filters hide it/);
    const missing = collection({ archetypes: [], variants: [] }, ui);
    assert.doesNotMatch(missing.textContent, /was saved, but your current filters hide it/);
  }
});

test('Author-controlled names and rule text remain literal text without HTML interpretation', () => {
  const label = '<img src=x onerror="alert(1)"> & Family';
  const library = { archetypes: [makeTemplate(1, { displayName: label, governingRuleRefs: [{ summary: '<script>bad()</script>' }] })], variants: [makeEntry(makeRoom(1, { displayName: label }))] };
  for (const root of [collection(library), collection(library, makeUi({ tab: 'templates' })), renderRoomTemplateDetail({ document: makeDocument(), template: library.archetypes[0] })]) {
    assert.ok(root.textContent.includes(label));
    assert.equal(matching(root, node => ['img', 'script'].includes(node.tagName)).length, 0);
  }
});

test('Filter and keyboard tab interactions delegate state without mutating the projection inputs', () => {
  const ui = freeze(makeUi()); const calls = []; const filters = [];
  const root = collection(makeLibrary(), ui, { onAction: (...args) => calls.push(args), onFilter: (...args) => filters.push(args) });
  const search = matching(root, node => node.dataset.roomNavFilter === 'search')[0]; search.value = 'Family'; search.dispatch('input');
  const status = matching(root, node => node.dataset.roomNavFilter === 'status')[0]; status.value = 'FINAL'; status.dispatch('change');
  assert.deepEqual(filters, [['search', 'Family'], ['status', 'FINAL']]);
  const tabs = matching(root, node => node.attributes.role === 'tab');
  assert.equal(tabs[0].attributes['aria-selected'], 'true'); assert.equal(tabs[0].tabIndex, 0); assert.equal(tabs[1].tabIndex, -1);
  let prevented = false; tabs[0].dispatch('keydown', { key: 'ArrowRight', preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true); assert.deepEqual(calls, [['tab', 'templates']]);
  assert.equal(ui.tab, 'rooms'); assert.equal(ui.status, 'all'); assert.equal(ui.search.rooms, '');
});

test('Rooms view module has an explicit JavaScript route and imports no mutation transport', async () => {
  const server = await readFile(new URL('../apps/studio-server/src/server.js', import.meta.url), 'utf8');
  const view = await readFile(new URL('../apps/studio-server/public/rooms-navigation-view.js', import.meta.url), 'utf8');
  assert.match(server, /\['\/rooms-navigation-view\.js', \['\.\.\/public\/rooms-navigation-view\.js', 'text\/javascript; charset=utf-8'\]\]/);
  assert.doesNotMatch(view, /\b(?:fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage)\b|innerHTML\s*=/);
});
