import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../apps/studio-server/public/app.js', import.meta.url), 'utf8');
const loadSource = source.slice(source.indexOf('async function loadProjects('), source.indexOf('let projectLoadGeneration'));
const refreshSource = source.slice(source.indexOf('let passiveProjectRefresh'), source.indexOf('async function executeBackupOperation('));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function harness({ holdSummary = null, holdProject = null, dirtyRoom = false } = {}) {
  const calls = [], fullReads = [], mutations = [];
  const summaryStarted = deferred(), projectStarted = deferred();
  const select = { value: 'project.test', options: [], replaceChildren() { mutations.push('selector'); this.options = []; }, append(option) { this.options.push(option); } };
  const state = { uiMode: 'local', project: { projectId: 'project.test', revision: 7 }, workspace: 'rooms', agentAccessCsrf: 'previous-token', agentAccess: { state: 'OFF' } };
  const context = { state, AbortController,
    elements: { 'project-select': select, 'refresh-button': {}, 'connection-dot': { classList: { add() {}, remove() { mutations.push('offline'); } } }, 'connection-label': {} },
    document: { createElement: () => ({}) },
    roomSurfaceTools: { isLocked: () => false, hasUnresolved: () => false, isSelecting: () => false },
    roomMoveTools: { hasPending: () => dirtyRoom },
    api: async (path, options) => {
      calls.push({ path, options });
      if (path === '/api/ui-session') return { csrfToken: 'fresh-token' };
      summaryStarted.resolve();
      if (holdSummary) await holdSummary.promise; // Deliberately ignores abort: ownership must still guard the result.
      return { projects: [{ projectId: 'project.test', name: 'Project', revision: 7 }] };
    },
    loadProject: async (id, options) => {
      fullReads.push({ id, options });
      projectStarted.resolve();
      if (holdProject) await holdProject.promise;
      if (options.signal?.aborted || (options.canApply && !options.canApply())) return false;
      mutations.push('project-applied'); return true;
    },
    updateMutationControls() {}, showToast() {}, renderAgentAccess() { mutations.push('agent-access-error'); },
  };
  runInNewContext(`${loadSource}\n${refreshSource}\nthis.run = refresh; this.cancel = cancelPassiveProjectRefresh; this.manualActive = () => manualProjectRefreshActive;`, context);
  return { context, state, calls, fullReads, mutations, summaryStarted, projectStarted };
}

test('Move cancellation during delayed summary prevents a new full load and stale selector writes', async () => {
  const summary = deferred(), h = harness({ holdSummary: summary });
  const pending = h.context.run({ passive: true, quiet: true, background: true });
  await h.summaryStarted.promise;
  assert.equal(h.calls.at(-1).path, '/api/projects');
  h.context.cancel(); h.state.roomMutationPending = true; summary.resolve(); await pending;
  assert.equal(h.calls.at(-1).options.signal.aborted, true);
  assert.equal(h.fullReads.length, 0); assert.deepEqual(h.mutations, []);
  assert.equal(h.state.agentAccess.state, 'OFF'); assert.equal(h.state.refreshing, false);
});

test('Move cancellation reaches an already running full read and prevents its late adoption', async () => {
  const project = deferred(), h = harness({ holdProject: project });
  const pending = h.context.run({ passive: true, quiet: true, background: true });
  await h.projectStarted.promise;
  assert.equal(h.fullReads.length, 1);
  const options = h.fullReads[0].options;
  assert.equal(options.canApply(), true);
  h.context.cancel(); h.state.roomMutationPending = true;
  assert.equal(options.signal.aborted, true); assert.equal(options.canApply(), false);
  project.resolve(); await pending;
  assert.deepEqual(h.mutations, ['selector']);
  assert.equal(h.state.agentAccess.state, 'OFF'); assert.equal(h.state.refreshing, false);
});

test('actual Refresh-button options preserve the manual request despite passive-rendering mode', async () => {
  const project = deferred(), h = harness({ holdProject: project });
  const pending = h.context.run({ passive: true });
  await h.projectStarted.promise;
  assert.equal(h.fullReads.length, 1);
  assert.equal(h.context.manualActive(), true);
  h.context.cancel(); project.resolve(); await pending;
  assert.equal(h.context.manualActive(), false);
  assert.equal(h.fullReads[0].options.signal, null);
  assert.deepEqual(h.mutations, ['selector', 'project-applied']);
  assert.equal(h.state.agentAccessCsrf, 'fresh-token');
  assert.match(source, /void refresh\(\{ passive: true \}\)/, 'Production Refresh button must use these exact tested options.');
  assert.match(source, /setInterval\(\(\) => refresh\(\{ quiet: true, passive: true, background: true \}\), 5000\)/);
});

test('unchanged project revision does not suppress independent policy/task reads', async () => {
  const h = harness(); await h.context.run({ passive: true, quiet: true, background: true });
  assert.equal(h.fullReads.length, 1); assert.equal(h.state.project.revision, 7);
  assert.deepEqual(h.mutations, ['selector', 'project-applied']);
  assert.equal(h.context.elements['connection-label'].textContent, 'Live');
});

test('new passive tick during a Move sends no reads, and Move cancels before sending its POST', async () => {
  const h = harness(); h.state.roomMutationPending = true;
  await h.context.run({ passive: true, quiet: true, background: true }); assert.equal(h.calls.length, 0);
  const move = source.slice(source.indexOf('async function executeRoomMutation('), source.indexOf('async function executeRoomCreation('));
  assert.ok(move.indexOf('cancelPassiveProjectRefresh()') >= 0);
  assert.ok(move.indexOf('cancelPassiveProjectRefresh()') < move.indexOf('setRoomMutationPending(true)'));
  const project = source.slice(source.indexOf('async function loadProject('), source.indexOf('async function requestAgentAccess('));
  assert.ok(project.match(/signal\?\.aborted \|\| \(canApply && !canApply\(\)\)/g)?.length >= 3,
    'The actual full reader must enforce the forwarded token before fetch, after fetch and before adoption.');
});

test('both manual and passive Refresh leave the shared unsaved Room draft untouched without reads', async () => {
  for (const options of [{ passive: true }, { passive: true, quiet: true, background: true }]) {
    const h = harness({ dirtyRoom: true }), before = structuredClone(h.state);
    await h.context.run(options);
    assert.deepEqual(h.calls, []); assert.deepEqual(h.fullReads, []); assert.deepEqual(h.mutations, []);
    assert.deepEqual(h.state, before); assert.equal(h.context.manualActive(), false);
  }
});
