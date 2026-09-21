import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const app = await readFile(new URL('../apps/studio-server/public/app.js', import.meta.url), 'utf8');
class Element {
  constructor(tagName) { this.tagName = tagName; this.children = []; this.dataset = {}; this.attributes = {}; this.ownText = ''; }
  append(...children) { this.children.push(...children); }
  set textContent(value) { this.ownText = String(value); this.children = []; }
  get textContent() { return this.ownText + this.children.map((child) => typeof child === 'string' ? child : child.textContent).join(''); }
  setAttribute(key, value) { this.attributes[key] = value; }
}
const document = { createElement: (tag) => new Element(tag) };
const all = (root) => [root, ...root.children.filter((child) => child instanceof Element).flatMap(all)];
const functionSource = (name, next) => app.slice(app.indexOf(`function ${name}(`), app.indexOf(`function ${next}(`));

function assertTaskReturn(root) {
  const returns = all(root).filter((node) => node.dataset.taskControl === 'back-to-list');
  assert.equal(returns.length, 1, 'Each task page has one primary return.');
  const back = returns[0];
  assert.equal(root.children[0], back, 'Return precedes the heading in reading and keyboard order.');
  assert.equal(back.tagName, 'button'); assert.equal(back.type, 'button');
  assert.equal(back.textContent, 'Back to Agent tasks');
  assert.ok(back.className.split(/\s+/).includes('studio-back-button'));
  assert.ok(back.className.split(/\s+/).includes('secondary'));
  assert.equal(back.dataset.taskFocusKey, 'back-to-list');
  assert.equal(root.children[1].className, 'panel-heading');
}

test('task composer uses the shared named return above its heading without submitting a form', () => {
  const render = runInNewContext(`${functionSource('renderTaskComposer', 'renderTaskReview')}; renderTaskComposer`, { document });
  const root = render(); assertTaskReturn(root);
  assert.equal(all(root.children.find((node) => node.tagName === 'form')).filter((node) => node.dataset.taskControl === 'back-to-list').length, 0);
});

test('task detail puts its named shared return above the heading without changing task or review data', () => {
  const value = { task: { taskId: 'task.navigation', title: 'Navigation fixture', objective: 'Read only', agentId: 'fixture.agent', capabilities: [], budget: { maxCommands: 3 }, expiresAt: '2026-09-21T20:00:00Z' }, timeline: [] };
  const original = JSON.stringify(value);
  const render = runInNewContext(`${functionSource('renderTaskDetail', 'renderTasks')}; renderTaskDetail`, {
    document, state: { project: { projectId: 'fixture' } }, TASK_CAPABILITY_LABELS: {}, TASK_ACTION_LABELS: {}, TASK_EVENT_LABELS: {},
    taskStateBadge: () => new Element('span'),
    taskWorkflowPresentation: () => ({ state: 'MERGED', actor: 'You', next: 'Read history', consequence: 'No change' }),
    taskMayLoadProcessingAdoption: () => false,
    renderTaskReview: () => new Element('section'),
  });
  const root = render(value); assertTaskReturn(root);
  assert.equal(JSON.stringify(value), original);
  const actions = all(root).find((node) => node.className === 'task-detail-header-actions');
  assert.equal(actions.children.length, 1, 'The status area no longer hosts a competing Back button.');
});

test('Library return labels name the real parent while preserving contextual route state', () => {
  for (const [external, eventId, previous, expected] of [
    ['tasks', null, 'review', 'Back to Agent tasks'],
    ['sources', null, null, 'Back to Sources'],
    ['activity', 'event.one', null, 'Back to event'],
    ['activity', null, null, 'Back to Activity'],
    [null, null, 'review', 'Back to review'],
    [null, null, 'detail', 'Back to details'],
    [null, null, null, 'Back to Library'],
  ]) {
    const libraryUi = { route: { view: 'detail' }, returnStack: previous ? [{ view: previous }] : [] };
    const state = { activityUi: { eventId } }; const before = JSON.stringify({ libraryUi, state });
    const render = runInNewContext(`${functionSource('libraryBackButton', 'libraryNativeLifecycleControls')}\n${functionSource('libraryBackLabel', 'sharedReviewSupported')}; libraryBackButton`, {
      document, libraryUi, state, libraryRouteKey: () => 'exact-route',
      libraryExternalOrigins: new Map(external ? [['exact-route', { workspace: external }]] : []),
    });
    const button = render();
    assert.equal(button.textContent, expected); assert.equal(button.type, 'button');
    assert.equal(button.dataset.libraryAction, 'back');
    assert.ok(button.className.split(/\s+/).includes('studio-back-button'));
    assert.ok(button.className.split(/\s+/).includes('secondary'));
    assert.equal(JSON.stringify({ libraryUi, state }), before);
  }
});

test('editor return labels name the actual Sources or Library origin without mutating it', () => {
  for (const [workspace, cutterView, tab, libraryView, expected] of [
    ['sources', 'outputs', 'workbench', 'detail', 'Back to View Output'],
    ['sources', 'detail', 'workbench', 'detail', 'Back to output image'],
    ['sources', 'edit', 'workbench', 'detail', 'Back to Cut images'],
    ['sources', null, 'workbench', 'detail', 'Back to Image Workbench'],
    ['sources', null, 'images', 'detail', 'Back to Source Images'],
    ['assets', null, 'workbench', 'detail', 'Back to details'],
    ['assets', null, 'images', 'browse', 'Back to Library'],
  ]) {
    const state = { workspace, cutter: cutterView ? { view: cutterView } : null, sourcesUi: { tab } };
    const libraryUi = { route: { view: libraryView } }; const before = JSON.stringify({ state, libraryUi });
    const label = runInNewContext(`${functionSource('editorReturnLabel', 'libraryRestoreOrigin')}; editorReturnLabel`, { state, libraryUi });
    assert.equal(label(), expected);
    assert.equal(JSON.stringify({ state, libraryUi }), before);
  }
});
