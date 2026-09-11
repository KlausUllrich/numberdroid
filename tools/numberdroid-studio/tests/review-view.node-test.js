import assert from 'node:assert/strict';
import test from 'node:test';
import { renderReviewView, reviewPreviewRecord, reviewStatusLabel } from '../apps/studio-server/public/review-view.js';
import { renderActivityRows } from '../apps/studio-server/public/activity-view.js';

class Element {
  constructor(tag) { this.tagName = tag; this.dataset = {}; this.children = []; this.attributes = {}; this.style = {}; this.listeners = {}; this.classList = { add: name => { this.className += ` ${name}`; }, toggle() {} }; }
  append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } }
  prepend(...nodes) { for (const node of nodes.reverse()) { node.parentNode = this; this.children.unshift(node); } }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key]; }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  matches(selector) { return selector === this.tagName; }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
}
function harness(t) { const prior = globalThis.document; globalThis.document = { createElement: tag => new Element(tag), createElementNS: (_, tag) => new Element(tag) }; t.after(() => { globalThis.document = prior; }); }
const all = node => [node, ...node.children.flatMap(all)];
const find = (node, key, value) => all(node).find(child => child.dataset[key] === value);
const strings = node => all(node).map(child => child.textContent ?? '').join('\n');
const binding = { projectId: 'project.review', sliceId: 'slice.cut', sliceVersion: 1, digest: 'a'.repeat(64), width: 32, height: 96, mediaType: 'image/png' };
function source() {
  const record = { assetId: 'asset.light', assetVersion: 1, metadataVersion: 1, name: 'Ready <light>', kind: 'prop', sliceBinding: binding };
  const item = { itemId: 'item.light', contentKind: 'image', payload: { operation: 'create', name: record.name }, proposed: record, resolvedProposed: record, current: null, resolvedCurrent: null, dependsOn: [], status: 'PENDING' };
  const group = { reviewId: 'review.station', reviewVersion: 2, contentVersion: 1, title: 'Station changes', proposer: { actor: { id: 'agent.artist', kind: 'agent' } }, status: 'CHANGES_REQUESTED', nextActor: { kind: 'agent' }, items: [item], feedback: { summary: 'A smaller light.', reviewVersion: 2, itemComments: [] }, selectionOutcome: { state: 'READY', selectedItemIds: [item.itemId], items: [{ itemId: item.itemId, selected: true, record, resolved: record }] } };
  return { group, projectId: 'project.review', projectRevision: 7, selectedItemIds: [item.itemId], activeItemId: item.itemId, side: 'proposed', selection: {}, feedback: { editing: false, draftSummary: '', draftItemComments: {} }, phase: 'idle', canMutate: true };
}
const gates = { canAccept: true, canEditFeedback: true, canFeedback: true, canDiscard: true, canInspect: true, locked: false };

test('Selected result never substitutes the full prospective creation when it is unselected or unresolved', () => {
  const state = source(), item = state.group.items[0];
  assert.equal(reviewPreviewRecord(state).record, item.resolvedProposed);
  state.selectedItemIds = []; state.group.selectionOutcome = { state: 'READY', selectedItemIds: [], items: [{ itemId: item.itemId, selected: false, record: null, resolved: null }] };
  assert.equal(reviewPreviewRecord(state).record, null); assert.match(reviewPreviewRecord(state).message, /contributes nothing/);
  state.group.selectionOutcome.state = 'UNAVAILABLE'; assert.equal(reviewPreviewRecord(state).record, null);
  assert.equal(reviewPreviewRecord(state, 'current').record, null);
});

test('A late selection preview cannot display the previously selected result', () => {
  const state = source(); state.selectedItemIds = [];
  assert.equal(reviewPreviewRecord(state).record, null); assert.match(reviewPreviewRecord(state).message, /Checking/);
});

test('Next actor distinguishes owner feedback for agent and human proposers', () => {
  const state = source(); assert.equal(reviewStatusLabel(state.group), 'Awaiting agent');
  state.group.proposer.actor.kind = 'human'; state.group.nextActor.kind = 'human'; assert.equal(reviewStatusLabel(state.group), 'Changes requested');
});

test('Saved feedback stays visible, editing and reconsidered acceptance remain separate', t => {
  harness(t); const state = source(), actions = []; const element = renderReviewView({ state, view: gates, onAction: action => actions.push(action) });
  assert.match(strings(element), /A smaller light/); assert.equal(find(element, 'reviewAction', 'accept').disabled, false);
  find(element, 'reviewAction', 'edit-feedback').listeners.click(); assert.deepEqual(actions, ['edit-feedback']);
  assert.equal(all(element).some(node => Object.hasOwn(node, 'innerHTML')), false);
});

test('A feedback draft has per-item inputs and exact Details detours without any accept button', t => {
  harness(t); const state = source(), inputs = [], details = []; state.feedback.editing = true; state.feedback.draftSummary = 'New unsent words'; state.feedback.draftItemComments['item.light'] = 'Keep its shape.';
  const element = renderReviewView({ state, view: { ...gates, canAccept: false }, onInput: (...args) => inputs.push(args), onDetails: value => details.push(value) });
  assert.equal(find(element, 'reviewAction', 'accept'), undefined); assert.equal(find(element, 'reviewInput', 'summary').value, 'New unsent words');
  const comment = find(element, 'reviewItemComment', 'item.light'); assert.equal(comment.value, 'Keep its shape.'); comment.value = 'Move it left.'; comment.listeners.input(); assert.deepEqual(inputs, [['comment', 'Move it left.', 'item.light']]);
  find(element, 'reviewFocus', 'preview-details:proposed').listeners.click(); assert.deepEqual(details, [{ itemId: 'item.light', side: 'proposed' }]);
  assert.ok(find(element, 'reviewDisclosure', 'comment:item.light')); assert.ok(find(element, 'reviewScroll', 'panel'));
});

test('Read-only historical feedback exposes no mutable decision controls', t => {
  harness(t); const state = source(); state.readOnly = true;
  const element = renderReviewView({ state, view: { ...gates, canAccept: false, canEditFeedback: false, canDiscard: false } });
  for (const action of ['accept', 'request-changes', 'edit-feedback', 'discard']) assert.equal(find(element, 'reviewAction', action), undefined);
  assert.match(strings(element), /read-only/); assert.match(strings(element), /A smaller light/);
});

test('Newer content has an explicit action and the old draft cannot masquerade as saved feedback', t => {
  harness(t); const state = source(); state.feedback.olderDraft = { summary: 'Old <draft>', itemComments: {}, contentVersion: 1, reviewVersion: 2 };
  const element = renderReviewView({ state, view: { ...gates, stale: 'content', canAdoptLatest: true, canAccept: false, canEditFeedback: false } });
  assert.match(find(element, 'reviewAction', 'review-latest').textContent, /latest version/); assert.equal(find(element, 'reviewAction', 'accept').disabled, true);
  assert.equal(find(element, 'reviewAction', 'copy-older-draft').disabled, true); assert.match(strings(element), /Not sent/); assert.match(strings(element), /Old <draft>/);
});

test('Activity uses exact historical names, sorted rows, safe text and distinct current-review links', t => {
  harness(t); const calls = [], events = [
    { id: 'old', revision: 3, occurredAt: '2026-09-11T10:00:00Z', summary: 'old raw', presentation: { title: 'Changes requested for Old name', summary: 'Nothing accepted.', actorLabel: 'You', feedback: { summary: '<img src=x>', itemComments: [{ name: 'Old component', comment: 'Keep it.' }] }, inspect: { type: 'review', reviewId: 'review.one', reviewVersion: 2 }, currentReview: { reviewId: 'review.one', reviewVersion: 4 } } },
    { id: 'new', revision: 4, occurredAt: '2026-09-11T11:00:00Z', summary: 'Agent command failed: CUT_NOT_FOUND', commandType: 'review.proposal.submit', actor: { id: 'agent.artist' } },
  ];
  const root = renderActivityRows({ events, onInspect: (...args) => calls.push(args) });
  assert.equal(root.children[0].dataset.activityEvent, 'new'); assert.match(strings(root), /Old name/); assert.match(strings(root), /<img src=x>/); assert.equal(root.querySelectorAll('img').length, 0);
  find(root, 'activityInspect', 'old').listeners.click(); find(root, 'activityCurrentReview', 'review.one').listeners.click(); assert.deepEqual(calls, [[events[0], { current: false }], [events[0], { current: true }]]);
  assert.equal(root.children.length, 2); assert.equal(find(root, 'activityInspect', 'new'), undefined);
});

test('Animation playback uses exact frame occurrences and retains elapsed time across view replacement', t => {
  harness(t); const oldRaf = globalThis.requestAnimationFrame, oldCancel = globalThis.cancelAnimationFrame;
  const frames = new Map(); let sequence = 0;
  globalThis.requestAnimationFrame = callback => { frames.set(++sequence, callback); return sequence; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  t.after(() => { globalThis.requestAnimationFrame = oldRaf; globalThis.cancelAnimationFrame = oldCancel; });
  const state = source(), record = { ...state.group.items[0].proposed, contentKind:'animation', clip: { fps:10, playbackMode:'loop', canvas:{width:32,height:96}, frames:[
    {frameId:'frame.one',name:'First',slice:{sliceId:'slice.cut',sliceVersion:1},offset:{x:0,y:0},durationMs:100},
    {frameId:'frame.two',name:'Second',slice:{sliceId:'slice.cut',sliceVersion:1},offset:{x:2,y:3},durationMs:200},
  ] }, frameBindings:[{frameId:'frame.one',sliceBinding:binding},{frameId:'frame.two',sliceBinding:binding}] };
  Object.assign(state.group.items[0],{contentKind:'animation',proposed:record,resolvedProposed:record}); Object.assign(state.group.selectionOutcome.items[0],{record,resolved:record});
  const root = renderReviewView({state,view:gates}); root.isConnected=true; find(root,'reviewPlay','').listeners.click();
  const tick = time => { const callbacks=[...frames.values()];frames.clear();callbacks.forEach(callback=>callback(time)); };
  tick(1000);tick(1150); assert.equal(find(root,'reviewFrame','frame.two').tagName,'svg');
  root.dispose(); assert.equal(frames.size,0);
  const next = renderReviewView({state,view:gates}); next.isConnected=true;
  assert.equal(find(next,'reviewFrame','frame.two').tagName,'svg'); assert.equal(find(next,'reviewPlay','').textContent,'Pause preview');
  next.dispose(); assert.equal(frames.size,0);
});
