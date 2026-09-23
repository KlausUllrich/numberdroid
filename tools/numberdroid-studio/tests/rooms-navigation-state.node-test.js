import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const app = await readFile(new URL('../apps/studio-server/public/app.js', import.meta.url), 'utf8');
function harness({ roomUi = {}, creation = null, accept = false, dirtyRoom = false } = {}) {
  const state = { roomMutationPending: false, roomUi, roomNavigation: { creation } };
  const prompts = [], messages = [], resets = [], dialogs = [];
  const sandbox = { state, roomSurfaceTools: { isLocked: () => false, hasUnresolved: () => false }, showToast: message => messages.push(message),
    roomMoveTools: { hasPending: () => dirtyRoom },
    window: { confirm: message => { prompts.push(message); return accept; } },
    askRoomCreationDiscard(onDiscard) { dialogs.push(onDiscard); },
    resetRoomUiProjectContext() { resets.push(true); state.roomUi = {}; } };
  const start = app.indexOf('function mayLeaveRoomNavigation(');
  const leave = runInNewContext(`${app.slice(start, app.indexOf('function roomNavigate(', start))}\nmayLeaveRoomNavigation`, sandbox);
  return { state, leave, prompts, messages, resets, dialogs };
}

test('Room navigation blocks outstanding mutations and exact pending placements without discarding recovery', () => {
  const pending = { placementId: 'same-placement', idempotencyKey: 'same-request', anchor: { x: 2, y: 3 } };
  const h = harness({ roomUi: { pendingPlacementAdd: pending }, accept: true });
  assert.equal(h.leave(), false); assert.strictEqual(h.state.roomUi.pendingPlacementAdd, pending);
  assert.equal(h.resets.length, 0); assert.equal(h.prompts.length, 0); assert.match(h.messages[0], /original cell/);
  h.state.roomMutationPending = true; assert.equal(h.leave(), false); assert.equal(h.messages.length, 1);
});

test('Room navigation cannot abandon an active placement or pan gesture', () => {
  for (const key of ['placementGesture', 'canvasPan']) {
    const gesture = { pointerId: 8 }; const h = harness({ roomUi: { [key]: gesture }, accept: true });
    assert.equal(h.leave(), false); assert.strictEqual(h.state.roomUi[key], gesture); assert.equal(h.resets.length, 0);
  }
});

test('Cancel preserves dirty creation fields, shape and review drafts; confirmed discard retains selected room identity', () => {
  for (const kind of ['shape', 'review', 'creation']) {
    const roomUi = { selectedRoomVariantId: 'room.first', ...(kind === 'shape' ? { shapeDraft: { dirty: true, blockedCells: [{ x: 1, y: 1 }] } } : kind === 'review' ? { dirty: true, decisionDrafts: { item: 'REJECTED' } } : {}) };
    const creation = kind === 'creation' ? { values: { displayName: 'My room' }, initial: '{"displayName":""}' } : null;
    const h = harness({ roomUi, creation }); const before = JSON.stringify(h.state);
    assert.equal(h.leave(), false); assert.equal(JSON.stringify(h.state), before); assert.equal(h.prompts.length, kind === 'creation' ? 0 : 1); assert.equal(h.dialogs.length, kind === 'creation' ? 1 : 0); assert.equal(h.resets.length, 0);
    const accepted = harness({ roomUi: structuredClone(roomUi), creation: structuredClone(creation), accept: true });
    assert.equal(accepted.leave(), kind !== 'creation'); assert.equal(accepted.state.roomUi.selectedRoomVariantId, 'room.first');
  }
});

test('Pristine creation and clean Room context do not ask to discard', () => {
  const values = { displayName: '', width: '4', height: '4' };
  const h = harness({ creation: { values, initial: JSON.stringify(values) } });
  assert.equal(h.leave(), true); assert.equal(h.prompts.length, 0); assert.equal(h.resets.length, 0);
});

test('shared unsaved Room draft blocks navigation without implicit discard or a creation prompt', () => {
  const h = harness({ dirtyRoom: true, accept: true, roomUi: { selectedRoomVariantId: 'room.first' } });
  const before = structuredClone(h.state);
  assert.equal(h.leave(), false); assert.deepEqual(h.state, before);
  assert.deepEqual(h.resets, []); assert.deepEqual(h.dialogs, []); assert.deepEqual(h.prompts, []);
  assert.match(h.messages[0], /Save or discard all Room changes/);
});

test('Collection and editor DOM restoration have separate route identities', () => {
  const capture = app.slice(app.indexOf('function captureRoomDomState('), app.indexOf('function textOffsetWithin('));
  assert.equal((capture.match(/state\.roomNavigation\?\.route !== 'editor'/g) ?? []).length, 2);
  const navigation = app.slice(app.indexOf('function captureRoomNavigationDom('), app.indexOf('function mayLeaveRoomNavigation('));
  assert.match(navigation, /saved\.key !== roomNavigationKey\(\)/);
  assert.match(navigation, /root\.dataset\.roomsRoute/);
  assert.match(navigation, /focus\(\{ preventScroll: true \}\)/);
});

test('focused Room creation displays its exact selected template version after every rerender', () => {
  const templates = [1, 2].map(version => ({ roomArchetypeId: 'template.one', version, displayName: `Template v${version}`, kind: 'room',
    dimensionPolicy: { width: { preferred: version + 3 }, height: { preferred: version + 4 } } }));
  const library = { archetypes: templates, variants: [] };
  const state = { project: { projectId: 'project.one' }, roomUi: {}, roomNavigation: { route: 'list', tab: 'rooms' } };
  const forms = [];
  const node = () => ({ children: [], dataset: {}, append(...children) { this.children.push(...children); } });
  const sandbox = { state, document: { createElement: node, createDocumentFragment: node },
    currentRoomLibrary: () => library, mayLeaveRoomNavigation: () => true, roomCreationBlockedReason: () => null,
    captureRoomNavigationDom: () => null, renderWorkspace() {}, window: { scrollTo() {} },
    elements: { 'workspace-content': { querySelector: () => null } }, roomNavigationBack: node, sectionHeading: node,
    renderRoomCreation() {
      // Native HTMLSelectElement.value selects the first matching value. Both
      // historical versions legitimately share that value, so selectedIndex
      // must then restore the exact id/version pair rather than leaving v1 shown.
      const select = { name: 'roomArchetypeId', selectedIndex: 0,
        options: templates.map(template => ({ value: template.roomArchetypeId, textContent: template.displayName, dataset: { version: String(template.version) } })),
        set value(value) { this.selectedIndex = this.options.findIndex(option => option.value === value); },
        get value() { return this.options[this.selectedIndex]?.value ?? ''; } };
      const fields = [{ name: 'displayName' }, select, { name: 'width' }, { name: 'height' }];
      fields.namedItem = name => fields.find(field => field.name === name);
      const form = { elements: fields, querySelectorAll: () => fields.slice(2), querySelector: () => ({ disabled: false }) };
      forms.push(form); return { querySelector: () => form };
    } };
  const navigateSource = app.slice(app.indexOf('function roomNavigate('), app.indexOf('function roomNavigationBack('));
  const renderSource = app.slice(app.indexOf('function renderRoomNavigation('), app.indexOf('function openCreatedRoom('));
  const api = runInNewContext(`${navigateSource}\n${renderSource}\n({ navigate: roomNavigate, render: renderRoomNavigation });`, sandbox);
  api.navigate('new-room');
  assert.equal(state.roomNavigation.creation.templateVersion, 2, 'New room defaults to the newest version of the first template');
  assert.equal(state.roomNavigation.creation.values.width, '5');
  for (let rerender = 0; rerender < 2; rerender += 1) {
    api.render(library);
    const select = forms.at(-1).elements.namedItem('roomArchetypeId');
    assert.equal(select.selectedIndex, 1);
    assert.equal(select.options[select.selectedIndex].textContent, 'Template v2');
    assert.equal(Number(select.options[select.selectedIndex].dataset.version), state.roomNavigation.creation.templateVersion);
  }
  api.navigate('from-template', 'template.one', 1); api.render(library);
  assert.equal(forms.at(-1).elements.namedItem('roomArchetypeId').selectedIndex, 0, 'An explicitly chosen historical version stays visible too');
});

test('Preview to Overview saved-finding navigation opens the actual editor and exact finding', () => {
  const finding = { findingId: 'finding.one', severity: 'ERROR' };
  const variant = { roomVariantId: 'room.one', version: 3, findings: [finding] };
  const state = { project: { projectId: 'project.one' }, workspace: 'rooms', roomNavigation: { route: 'editor', tab: 'rooms' },
    roomUi: { view: 'preview', selectedRoomVariantId: 'room.one' }, taskUi: { view: 'list' } };
  let sidebar, overview, previewCancellations = 0, focused = false; const renders = [], selections = [];
  const target = { dataset: { roomFocusKey: 'finding-focus' }, scrollIntoView() {}, focus() { focused = true; } };
  const sandbox = { state, location: { hash: 'rooms' },
    elements: { 'workspace-nav': { addEventListener(_type, handler) { sidebar = handler; } },
      'workspace-content': { addEventListener(_type, handler) { overview = handler; }, querySelectorAll: () => [target], querySelector: () => target } },
    mayAbandonAssetAuthoring: () => true, mayLeaveRoomNavigation: () => true, cancelPinnedAssetsOnWorkspaceExit() {}, publishVisualEvidence() {},
    cancelRoomPreviewLoad() { previewCancellations += 1; }, clearRoomPaletteAsset() {}, currentRoomVariant: () => ({ variant }),
    selectRoomFinding(selectedRoom, selectedFinding) { selections.push([selectedRoom, selectedFinding]); state.roomUi.selectedFinding = selectedFinding; return 'finding-focus'; },
    renderWorkspace() { renders.push({ workspace: state.workspace, route: state.roomNavigation.route, view: state.roomUi.view, panel: state.roomUi.dockPanel }); },
    requestAnimationFrame: callback => callback() };
  const sidebarStart = app.indexOf("elements['workspace-nav'].addEventListener('click', (event) => {");
  const sidebarSource = app.slice(sidebarStart, app.indexOf("elements['project-select'].addEventListener", sidebarStart));
  const overviewBody = app.indexOf("  const open = event.target.closest('[data-overview-open]');");
  const overviewStart = app.lastIndexOf("elements['workspace-content'].addEventListener('click', (event) => {", overviewBody);
  runInNewContext(`${sidebarSource}\n${app.slice(overviewStart, sidebarStart)}`, sandbox);
  sidebar({ target: { closest: () => ({ dataset: { workspace: 'overview' } }) }, preventDefault() {} });
  assert.equal(state.workspace, 'overview'); assert.equal(state.roomUi.view, 'preview');
  overview({ target: { closest: () => ({ dataset: { overviewOpen: 'room-findings', roomVariantId: 'room.one', findingId: 'finding.one' } }) } });
  assert.equal(previewCancellations, 1); assert.deepEqual(renders.at(-1), { workspace: 'rooms', route: 'editor', view: 'editor', panel: 'check' });
  assert.strictEqual(selections[0][0], variant); assert.strictEqual(selections[0][1], finding);
  assert.strictEqual(state.roomUi.selectedFinding, finding); assert.equal(focused, true);
});

function creationFaultHarness({ lostResponse = false, failedReads = 0, rejectStatus = null, kind = 'room' } = {}) {
  const state = { project: { projectId: 'project.one', revision: 7 }, agentAccessCsrf: 'csrf', roomUi: {}, roomMutationPending: false,
    roomNavigation: { route: 'create-room', creation: { values: { displayName: 'My room' }, initial: '{"displayName":""}' } } };
  let library = { variants: [], archetypes: [] }, commits = 0, keySequence = 0;
  const durable = new Map(), keys = new Map(), posts = [], opened = [], messages = [], discardDialogs = [];
  const settings = { lostResponse, failedReads, rejectStatus };
  const sandbox = { state, structuredClone, roomSurfaceTools: { isLocked: () => false, hasUnresolved: () => false }, showToast: message => messages.push(message), renderWorkspace() {},
    roomMoveTools: { hasPending: () => false },
    setRoomMutationPending: value => { state.roomMutationPending = value; }, currentRoomLibrary: () => library,
    exactRoomHead: entry => entry?.versions.find(head => head.version === entry.headVersion),
    roomOperationKey(operation, target, project) { const key = `${operation}:${target}:${project}`; if (!keys.has(key)) keys.set(key, `key-${++keySequence}`); return keys.get(key); },
    clearRoomOperationKey(operation, target, project) { keys.delete(`${operation}:${target}:${project}`); },
    async api(path, options) {
      const body = JSON.parse(options.body); posts.push({ path, raw: options.body, body });
      if (settings.rejectStatus) throw Object.assign(new Error('Definite rejection'), { status: settings.rejectStatus });
      if (!durable.has(body.idempotencyKey)) { durable.set(body.idempotencyKey, structuredClone(body)); commits += 1; }
      else assert.deepEqual(body, durable.get(body.idempotencyKey), 'An idempotency key must never carry revised inputs');
      if (settings.lostResponse) { settings.lostResponse = false; throw new Error('Connection lost after commit'); }
      return { projectId: 'project.one', revision: 8 };
    },
    async loadProject() {
      if (settings.failedReads > 0) { settings.failedReads -= 1; throw new Error('Authoritative GET failed'); }
      library = { archetypes: [...durable.values()].filter(body => !body.roomVariantId).map(body => ({ ...body, version: 1 })),
        variants: [...durable.values()].filter(body => body.roomVariantId).map(body => ({ roomVariantId: body.roomVariantId, headVersion: 1,
          versions: [{ roomVariantId: body.roomVariantId, version: 1, displayName: body.displayName }] })) };
      state.project.revision = durable.size ? 8 : 7;
    },
    openCreatedRoom(projectId, roomId) { opened.push([projectId, roomId]); state.roomNavigation.creation = null; state.roomNavigation.route = 'editor'; return true; },
    askRoomCreationDiscard(onDiscard) {
      assert.equal(Boolean(state.roomNavigation.creation?.attempt), false, 'Unresolved creation must not offer discard');
      discardDialogs.push(onDiscard);
    }, window: { confirm: () => true, scrollTo() {} } };
  const start = app.indexOf('async function executeRoomMutation(');
  const source = app.slice(start, app.indexOf('function roomManipulationContext(', start));
  const leaveSource = app.slice(app.indexOf('function mayLeaveRoomNavigation('), app.indexOf('function roomNavigate('));
  const api = runInNewContext(`${source}\n${leaveSource}\n({ create: executeRoomCreation, leave: mayLeaveRoomNavigation });`, sandbox);
  const request = kind === 'template' ? { operation: 'room-archetype-create', target: 'template.exact', path: '/api/projects/project.one/room-archetypes', successMessage: 'Template saved',
    body: { roomArchetypeId: 'template.exact', displayName: 'My template', kind: 'room', dimensionPolicy: { width: { min: 3, preferred: 4, max: 64 }, height: { min: 3, preferred: 5, max: 64 } } } }
    : { operation: 'room-variant-create', target: 'room.exact', path: '/api/projects/project.one/rooms', successMessage: 'Created',
    body: { roomVariantId: 'room.exact', roomArchetypeId: 'template.one', archetypeVersion: 2, displayName: 'My room', width: 4, height: 5,
      connectors: [{ connectorId: 'connector.exact', side: 'north' }], placements: [] } };
  return { state, settings, posts, opened, messages, discardDialogs, request, ...api, commits: () => commits };
}

test('missing local CSRF session sends no creation request and never traps the editable form in uncertain recovery', async () => {
  for (const kind of ['room', 'template']) {
    const h = creationFaultHarness({ kind }); h.state.agentAccessCsrf = null;
    const creation = h.state.roomNavigation.creation; const before = JSON.stringify(creation);
    assert.equal(await h.create(h.request), false); assert.equal(h.posts.length, 0); assert.equal(h.commits(), 0);
    assert.equal(JSON.stringify(creation), before); assert.equal(creation.attempt, undefined); assert.equal(creation.uncertain, undefined);
    assert.match(h.messages[0], /local Studio session/);
    assert.equal(h.leave(), false); assert.equal(h.discardDialogs.length, 1, 'Ordinary Keep editing / Discard remains available');
    assert.strictEqual(h.state.roomNavigation.creation, creation); assert.equal(creation.values.displayName, 'My room');
    creation.values.displayName = ''; assert.equal(h.leave(), true, 'A pristine form can be left without a pending-request lock');
  }
});

test('lost Room creation response retries identical captured IDs, body, revision and key after failed reload', async () => {
  const h = creationFaultHarness({ lostResponse: true, failedReads: 1 });
  assert.equal(await h.create(h.request), false); assert.equal(h.commits(), 1);
  const attempt = h.state.roomNavigation.creation.attempt;
  assert.equal(h.state.roomNavigation.creation.uncertain, true); assert.equal(h.leave(), false);
  assert.strictEqual(h.state.roomNavigation.creation.attempt, attempt);
  h.state.project.revision = 20; // A later client projection cannot rewrite the captured request.
  h.request.body.displayName = 'Changed outside the captured intent';
  assert.equal(await h.create(), true);
  assert.equal(h.posts.length, 2); assert.equal(h.posts[1].raw, h.posts[0].raw);
  assert.equal(h.posts[1].body.expectedRevision, 7); assert.equal(h.posts[1].body.roomVariantId, 'room.exact');
  assert.equal(h.posts[1].body.connectors[0].connectorId, 'connector.exact');
  assert.equal(h.commits(), 1); assert.deepEqual(h.opened, [['project.one', 'room.exact']]);
});

test('successful POST with failed authoritative GET retains retry despite clearing the operation-key cache', async () => {
  const h = creationFaultHarness({ failedReads: 2 });
  assert.equal(await h.create(h.request), false); assert.equal(h.state.roomNavigation.creation.uncertain, true);
  assert.equal(h.leave(), false); assert.equal(h.opened.length, 0);
  assert.equal(await h.create(), true); assert.equal(h.posts[1].raw, h.posts[0].raw); assert.equal(h.commits(), 1);
});

test('lost POST response reconciles the exact saved target when the authoritative GET succeeds', async () => {
  const h = creationFaultHarness({ lostResponse: true });
  assert.equal(await h.create(h.request), true); assert.equal(h.posts.length, 1); assert.equal(h.commits(), 1);
  assert.deepEqual(h.opened, [['project.one', 'room.exact']]); assert.equal(h.state.roomNavigation.creation, null);
});

test('template creation recovery repeats the exact request and opens only the reconciled saved template', async () => {
  for (const fault of [{ lostResponse: true, failedReads: 1 }, { failedReads: 2 }]) {
    const h = creationFaultHarness({ kind: 'template', ...fault });
    assert.equal(await h.create(h.request), false); assert.equal(h.commits(), 1); assert.equal(h.leave(), false);
    assert.equal(h.state.roomNavigation.templateId, undefined);
    assert.equal(await h.create(), true); assert.equal(h.posts[1].raw, h.posts[0].raw);
    assert.equal(h.commits(), 1); assert.equal(h.opened.length, 0, 'A template retry must not open or create a Room');
    assert.equal(h.state.roomNavigation.route, 'template'); assert.equal(h.state.roomNavigation.templateId, 'template.exact');
    assert.equal(h.state.roomNavigation.templateVersion, 1); assert.equal(h.state.roomNavigation.creation, null);
  }
});

test('initial definite 4xx permits correction, but a later 4xx cannot discard an uncertain original creation', async () => {
  const rejected = creationFaultHarness({ rejectStatus: 422 });
  assert.equal(await rejected.create(rejected.request), false); assert.equal(rejected.state.roomNavigation.creation.attempt, null);
  assert.equal(rejected.state.roomNavigation.creation.uncertain, false); assert.equal(rejected.commits(), 0);
  rejected.settings.rejectStatus = null; rejected.request.body.displayName = 'Corrected room';
  assert.equal(await rejected.create(rejected.request), true);
  assert.notEqual(rejected.posts[0].body.idempotencyKey, rejected.posts[1].body.idempotencyKey);
  assert.equal(rejected.posts[1].body.displayName, 'Corrected room'); assert.equal(rejected.commits(), 1);
  const uncertain = creationFaultHarness({ lostResponse: true, failedReads: 1 });
  await uncertain.create(uncertain.request); const original = uncertain.state.roomNavigation.creation.attempt;
  uncertain.settings.rejectStatus = 409; uncertain.settings.failedReads = 1;
  assert.equal(await uncertain.create(), false); assert.strictEqual(uncertain.state.roomNavigation.creation.attempt, original);
  assert.equal(uncertain.state.roomNavigation.creation.uncertain, true); assert.equal(uncertain.leave(), false);
});

test('named creation dialog keeps edits by default and only discards the same project/form on explicit action', () => {
  const creation = { values: { displayName: 'Unsaved' } }; const state = { project: { projectId: 'project.one' }, roomNavigation: { creation } };
  const nodes = []; let continued = 0, focusReturned = 0;
  const node = tag => { const value = { tag, dataset: {}, children: [], listeners: {}, append(...children) { this.children.push(...children); },
    setAttribute() {}, addEventListener(type, callback) { this.listeners[type] = callback; }, showModal() { this.shown = true; },
    close() { this.listeners.close?.(); }, remove() { this.removed = true; } }; nodes.push(value); return value; };
  const document = { querySelector: () => null, createElement: node, body: node('body'), activeElement: { isConnected: true, focus() { focusReturned += 1; } } };
  const source = app.slice(app.indexOf('function askRoomCreationDiscard('), app.indexOf('function mayLeaveRoomNavigation('));
  const ask = runInNewContext(`${source}; askRoomCreationDiscard;`, { state, document });
  ask(() => { continued += 1; });
  const keep = nodes.find(value => value.textContent === 'Keep editing');
  assert.equal(keep.autofocus, true); assert.equal(nodes.find(value => value.tag === 'dialog').shown, true);
  keep.listeners.click(); assert.strictEqual(state.roomNavigation.creation, creation); assert.equal(continued, 0); assert.equal(focusReturned, 1);
  ask(() => { continued += 1; }); nodes.filter(value => value.textContent === 'Discard form').at(-1).listeners.click();
  assert.equal(state.roomNavigation.creation, null); assert.equal(continued, 1);
  state.roomNavigation.creation = creation; ask(() => { continued += 1; }); state.project.projectId = 'project.other';
  nodes.filter(value => value.textContent === 'Discard form').at(-1).listeners.click();
  assert.strictEqual(state.roomNavigation.creation, creation); assert.equal(continued, 1);
});
