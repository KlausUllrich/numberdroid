import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const app = await readFile(new URL('../apps/studio-server/public/app.js', import.meta.url), 'utf8');
const source = app.slice(app.indexOf('function syncCurrentProjectPicker('), app.indexOf('async function requestAgentAccess('));
function project(revision, name = 'Current project') {
  return { projectId: 'project.current', revision, snapshot: { project: { name }, sources: [] } };
}
function deferred() { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; }
function harness() {
  const summaries = [{ projectId: 'project.current', name: 'Current project', revision: 1 }, { projectId: 'project.other', name: 'Other project', revision: 2 }];
  let writes = 0; let label = 'Current project · r1';
  const currentOption = { value: 'project.current', get textContent() { return label; }, set textContent(value) { label = value; writes += 1; } };
  const otherOption = { value: 'project.other', textContent: 'Other project · r2' };
  const select = { value: 'project.current', options: [currentOption, otherOption], replaceChildren() { throw new Error('Picker options were replaced.'); } };
  const document = { activeElement: select };
  const state = { project: project(1), projects: summaries, workspace: 'rooms', uiMode: 'local', cutter: null, taskUi: { view: 'list', selectedTaskId: null } };
  const queued = []; const requests = []; let header = 'Revision 1';
  const load = runInNewContext(`let taskSelectionGeneration = 0; ${source}; loadProject;`, {
    state, document, elements: { 'project-select': select, 'workspace-content': { dataset: { renderedProjectId: 'project.current', renderedWorkspace: 'rooms' } } },
    cancelTaskAdoptionLoad() {}, mayAbandonAssetAuthoring: () => true,
    workspaceRenderFingerprint: () => String(state.project.revision),
    reconcileAssetUi() {}, reconcileRoomUi() {}, reconcileTaskUiAfterRefresh() {},
    processingAdoptionSelectionOwned: () => false, hasLiveTaskComposer: () => false,
    renderProject() { header = `Revision ${state.project.revision}`; },
    api(path) {
      requests.push(path);
      if (path === '/api/projects/project.current') return queued.shift();
      if (path.endsWith('/activity')) return Promise.resolve({ events: [] });
      if (path.endsWith('/agent-access')) return Promise.resolve({ effectivePolicy: {}, csrfToken: 'fixture' });
      if (path.endsWith('/source-intakes')) return Promise.resolve({ intakes: [] });
      if (path.endsWith('/tasks')) return Promise.resolve({ tasks: [] });
      throw new Error(`Unexpected request: ${path}`);
    },
  });
  return { state, summaries, select, document, currentOption, otherOption, requests,
    load(value, options = {}) { queued.push(Promise.resolve(value)); return load('project.current', options); },
    header: () => header, writes: () => writes };
}

test('accepted project detail immediately updates matching picker name/revision without changing selection, options or focus', async () => {
  const fixture = harness(); const options = fixture.select.options;
  assert.equal(await fixture.load(project(4, 'Updated name')), true);
  assert.equal(fixture.currentOption.textContent, 'Updated name · r4');
  assert.equal(fixture.header(), 'Revision 4');
  assert.deepEqual(fixture.summaries[0], { projectId: 'project.current', name: 'Updated name', revision: 4 });
  assert.equal(fixture.select.options, options); assert.equal(options[0], fixture.currentOption); assert.equal(options[1], fixture.otherOption);
  assert.equal(fixture.otherOption.textContent, 'Other project · r2');
  assert.equal(fixture.select.value, 'project.current'); assert.equal(fixture.document.activeElement, fixture.select);
  assert.equal(fixture.requests.length, 5, 'Updating the picker must not add a network request.');
  const writes = fixture.writes();
  assert.equal(await fixture.load(project(4, 'Updated name'), { preserveWorkspaceIfUnchanged: true }), true);
  assert.equal(fixture.writes(), writes, 'Unchanged accepted detail must not rewrite the option.');
  assert.equal(fixture.document.activeElement, fixture.select);
});

test('aborted detail cannot update the current project or picker after its response arrives', async () => {
  const fixture = harness(); const pending = deferred(); const controller = new AbortController();
  const load = fixture.load(pending.promise, { signal: controller.signal });
  controller.abort(); pending.resolve(project(4));
  assert.equal(await load, false);
  assert.equal(fixture.currentOption.textContent, 'Current project · r1');
  assert.equal(fixture.header(), 'Revision 1'); assert.equal(fixture.writes(), 0);
  assert.equal(fixture.summaries[0].revision, 1);
});

test('superseded and no-longer-selected detail responses cannot relabel the accepted project', async () => {
  const fixture = harness(); const older = deferred();
  const oldLoad = fixture.load(older.promise);
  assert.equal(await fixture.load(project(4)), true);
  older.resolve(project(2)); assert.equal(await oldLoad, false);
  assert.equal(fixture.currentOption.textContent, 'Current project · r4'); assert.equal(fixture.header(), 'Revision 4');
  const pending = deferred(); const movedLoad = fixture.load(pending.promise);
  fixture.select.value = 'project.other'; pending.resolve(project(5));
  assert.equal(await movedLoad, false);
  assert.equal(fixture.currentOption.textContent, 'Current project · r4');
  assert.equal(fixture.otherOption.textContent, 'Other project · r2');
  assert.equal(fixture.select.value, 'project.other');
});
