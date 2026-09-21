import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const app = await readFile(new URL('../apps/studio-server/public/app.js', import.meta.url), 'utf8');
const renderSource = app.slice(app.indexOf('function renderTaskReview('), app.indexOf('function renderTaskList('));

class Element {
  constructor(tagName) { this.tagName = tagName; this.dataset = {}; this.children = []; this.attributes = {}; this.ownText = ''; }
  append(...children) { this.children.push(...children); }
  set textContent(value) { this.ownText = String(value); this.children = []; }
  get textContent() { return this.ownText + this.children.map((child) => typeof child === 'string' ? child : child.textContent).join(''); }
  setAttribute(name, value) { this.attributes[name] = value; }
}

function all(root, predicate) {
  return [root, ...root.children.filter((child) => child instanceof Element).flatMap((child) => all(child, () => true))].filter(predicate);
}

function entry({ taskState = 'IN_REVIEW', reviewState = 'OPEN', disposition = 'PENDING', origin = 'HUMAN_ROOT', reverted = false, candidate = false } = {}) {
  return {
    task: { state: taskState, authority: { origin } }, reverted,
    review: {
      reviewId: 'review.one', reviewVersion: 3, state: reviewState,
      baseRevision: 2, branchHeadRevision: 4, comparedMainRevision: 2, mergeId: 'merge.one',
      ...(candidate ? { kind: 'studio.level-candidate-review' } : {}), conflicts: [],
      items: [{
        changeId: 'branch.one:revision:3', ordinal: 1, branchRevision: 3,
        commandType: 'room.archetype.create', summary: 'room archetype archetype.original created.',
        changes: [{ entityType: 'room_archetype', entityId: 'archetype.original', operation: 'created' }],
        disposition, reason: 'Recorded comment',
      }],
    },
  };
}

function render(value) {
  const context = {
    document: { createElement: (tagName) => new Element(tagName) },
    state: { project: { snapshot: { project: { ownerId: 'local.designer' }, roomArchetypes: [{ id: 'archetype.original', name: 'TODAY’S RENAMED TEMPLATE' }] } } },
    taskEffectiveState: ({ task }) => task.state,
    taskWasReverted: (item) => item.reverted,
    taskMergeBlockedReason: () => null,
    TASK_ACTION_LABELS: { reject: 'End task without adding changes' },
  };
  return runInNewContext(`${renderSource}; renderTaskReview`, context)(value);
}

test('editable review explains room-template proposals without inventing a historical name', () => {
  const value = entry(); const before = JSON.stringify(value); const view = render(value);
  assert.match(view.textContent, /Add room template: archetype.original/);
  assert.match(view.textContent, /reusable starting point for new rooms, not a finished room/);
  assert.match(view.textContent, /Accept selects this task proposal; completing the task adds it/);
  assert.doesNotMatch(view.textContent, /TODAY’S RENAMED TEMPLATE|room archetype archetype.original created/);
  const selects = all(view, (node) => node.tagName === 'select');
  assert.equal(selects.length, 1); assert.equal(selects[0].value, 'PENDING'); assert.notEqual(selects[0].disabled, true);
  assert.deepEqual(selects[0].children.map(({ textContent }) => textContent), ['Pending', 'Accept', 'Reject', 'Request changes']);
  assert.equal(all(view, (node) => node.dataset.taskReviewReason).length, 1);
  assert.equal(JSON.stringify(value), before);
});

for (const [taskState, reviewState, disposition, label] of [
  ['MERGED', 'MERGED', 'USER_ACCEPTED', 'Accepted'],
  ['MERGED', 'MERGED', 'USER_REJECTED', 'Rejected'],
  ['ACTIVE', 'SUPERSEDED', 'CHANGES_REQUESTED', 'Changes requested'],
  ['EXPIRED', 'OPEN', 'PENDING', 'Not reviewed'],
  ['REJECTED', 'REJECTED', 'USER_REJECTED', 'Rejected'],
]) test(`locked ${taskState}/${disposition} is a saved badge, not a disabled dropdown`, () => {
  const value = entry({ taskState, reviewState, disposition }); const before = JSON.stringify(value);
  const view = render(value);
  assert.equal(all(view, (node) => node.tagName === 'select').length, 0);
  assert.equal(all(view, (node) => node.tagName === 'textarea').length, 0);
  const badges = all(view, (node) => node.dataset.disposition === disposition);
  assert.equal(badges.length, 1); assert.equal(badges[0].textContent, label);
  assert.match(view.textContent, /Recorded comment/);
  assert.equal(JSON.stringify(value), before);
});

test('undo keeps the accepted historical badge and removes only the undo action', () => {
  const before = render(entry({ taskState: 'MERGED', reviewState: 'MERGED', disposition: 'USER_ACCEPTED' }));
  const after = render(entry({ taskState: 'MERGED', reviewState: 'MERGED', disposition: 'USER_ACCEPTED', reverted: true }));
  assert.equal(all(before, (node) => node.dataset.taskControl === 'revert').length, 1);
  assert.equal(all(after, (node) => node.dataset.taskControl === 'revert').length, 0);
  assert.match(after.textContent, /Changes undone/);
  assert.equal(all(after, (node) => node.dataset.disposition === 'USER_ACCEPTED')[0].textContent, 'Accepted');
});

test('policy acceptance is non-editable even within an editable review', () => {
  const view = render(entry({ disposition: 'AUTO_ACCEPTED_BY_POLICY' }));
  assert.equal(all(view, (node) => node.tagName === 'select').length, 0);
  assert.equal(all(view, (node) => node.dataset.taskReviewReason).length, 0);
  assert.match(view.textContent, /Accepted automatically under your task settings/);
});

test('Candidate and derived-child reviews gain no decision or merge controls', () => {
  for (const options of [{ candidate: true }, { origin: 'TRUSTED_SERVICE_CHILD' }]) {
    const view = render(entry(options));
    assert.equal(all(view, (node) => node.tagName === 'select').length, 0);
    assert.equal(all(view, (node) => ['decide', 'merge'].includes(node.dataset.taskControl)).length, 0);
    if (options.candidate) assert.match(view.textContent, /Pending · read-only/);
  }
});

test('unrecognized review commands keep their recorded summary rather than guessing', () => {
  const value = entry(); value.review.items[0].commandType = 'source.register';
  value.review.items[0].summary = 'Recorded source change';
  assert.match(render(value).textContent, /Recorded source change/);
  assert.doesNotMatch(render(value).textContent, /Add room template/);
});

test('conflicting template proposals explain that recording a decision cannot add them', () => {
  const value = entry();
  value.review.conflicts = [{ entityType: 'room_archetype', entityId: 'archetype.original', code: 'SEMANTIC_CONFLICT' }];
  const view = render(value);
  assert.match(view.textContent, /this conflicting result cannot be added/);
  assert.doesNotMatch(view.textContent, /completing the task adds it/);
  assert.equal(all(view, (node) => node.dataset.taskControl === 'merge').length, 0);
});
