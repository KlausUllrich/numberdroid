import test from 'node:test';
import assert from 'node:assert/strict';
import { createReviewController, captureReviewContext, restoreReviewContext } from '../apps/studio-server/public/review-controller.js';

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const group = (version = 1, extra = {}) => ({ reviewId: 'review.demo', reviewVersion: version, contentVersion: 1, status: 'PENDING', isLatest: true, latestReviewVersion: version,
  items: [{ itemId: 'item.one', status: 'PENDING', contentKind: 'image', payload: { assetId: 'asset.one' }, current: null, proposed: { assetId: 'asset.one', name: 'One', assetVersion: 1, metadataVersion: 1 }, resolvedProposed: { assetId: 'asset.one', name: 'One' } }],
  eligibility: { selectedItemIds: ['item.one'], canAccept: true, findings: [] }, selectionOutcome: { state: 'READY', selectedItemIds: ['item.one'], items: [] }, ...extra });
const node = () => ({ dataset: {}, ownerDocument: { activeElement: null }, isConnected: false, contains: () => false, querySelectorAll: () => [], replaceChildren() {}, dispose() {} });
function setup(options = {}) {
  let current = { projectId: 'project.demo', projectRevision: 7 }, callbacks, readCalls = [], postCalls = [], announces = [];
  const initialGroup = options.group ?? group();
  const controller = createReviewController({ context: { ...current, canMutate: true, group: initialGroup, ...options.context }, createElement: node,
    renderView: props => { callbacks = props; return node(); }, host: {
      context: () => current, read: async (request, control) => { readCalls.push(structuredClone(request)); return options.read ? options.read(request, control) : { projectId: 'project.demo', revision: current.projectRevision, groups: [group(request.reviewVersion ?? 1)] }; },
      post: async (...args) => { postCalls.push(args); return options.post?.(...args); },
      onSaved: async receipt => { current = { ...current, projectRevision: receipt.revision }; await options.onSaved?.(receipt); },
      onDetails: options.onDetails, announce: message => announces.push(message), setMutationPending: options.setMutationPending,
    } });
  return { controller, state: controller.getState(), callbacks: () => callbacks, readCalls, postCalls, announces,
    setCurrent(value) { current = { ...current, ...value }; controller.reconcileContext(); } };
}

function accepted(version = 2) { return group(version, { status: 'ACCEPTED', items: group().items.map(item => ({ ...item, status: 'ACCEPTED' })), eligibility: { selectedItemIds: [], canAccept: false, findings: [] }, selectionOutcome: { state: 'READY', selectedItemIds: [], items: [] } }); }
const receipt = { projectId: 'project.demo', revision: 8, value: { reviewId: 'review.demo', reviewVersion: 2, contentVersion: 1, status: 'ACCEPTED', accepted: [{ itemId: 'item.one', assetId: 'asset.one', assetVersion: 1, metadataVersion: 1 }], remainingItemIds: [] } };

test('unknown acceptance retains exact serialized intent across refresh and completed external state', async () => {
  let attempts = 0;
  const h = setup({ post: async () => { if (++attempts === 1) throw new TypeError('Connection lost after commit'); return receipt; },
    read: async () => ({ projectId: 'project.demo', revision: 8, groups: [accepted()] }) });
  await h.controller.dispatch('accept');
  const savedIntent = structuredClone(h.state.intent);
  assert.equal(h.state.phase, 'uncertain'); assert.equal(h.controller.requestLeave(), false); assert.equal(h.controller.dispose(), false);
  h.setCurrent({ projectRevision: 8, latestGroup: accepted() });
  await h.controller.dispatch('check');
  assert.equal(h.state.group.reviewVersion, 1); assert.deepEqual(h.state.intent, savedIntent);
  await h.controller.dispatch('discard'); assert.equal(h.postCalls.length, 1);
  await h.controller.dispatch('retry');
  assert.equal(h.postCalls.length, 2);
  assert.equal(h.postCalls[1][1].serialized, h.postCalls[0][1].serialized);
  assert.deepEqual(h.postCalls[1][1].body, h.postCalls[0][1].body);
  assert.equal(h.state.intent, null); assert.equal(h.state.group.status, 'ACCEPTED'); assert.equal(h.controller.requestLeave(), true);
  h.controller.dispose();
});

test('an invalid receipt and a later rejected retry remain uncertain rather than authorizing another write', async () => {
  let attempts = 0;
  const h = setup({ post: async () => { if (++attempts === 1) return { ...receipt, revision: 99 }; throw Object.assign(new Error('Not found during reconnect'), { status: 404 }); } });
  await h.controller.dispatch('accept'); const serialized = h.state.intent.serialized;
  await h.controller.dispatch('retry');
  assert.equal(h.state.phase, 'uncertain'); assert.equal(h.state.intent.serialized, serialized); assert.equal(h.controller.requestLeave(), false);
});

test('a definite first-request rejection releases its intent while preserving raw feedback', async () => {
  const h = setup({ post: async () => { throw Object.assign(new Error('Review changed'), { status: 409 }); } });
  await h.controller.dispatch('request-changes'); h.callbacks().onInput('summary', '  Please adjust this\n');
  await h.controller.dispatch('save-feedback');
  assert.equal(h.state.phase, 'idle'); assert.equal(h.state.intent, null); assert.equal(h.state.feedback.draftSummary, '  Please adjust this\n');
  assert.equal(h.state.group.reviewVersion, 1); h.controller.dispose();
});

test('selection preview uses only the last completed read and does not mutate the project', async () => {
  const first = deferred(), second = deferred(); let calls = 0;
  const h = setup({ read: () => (++calls === 1 ? first : second).promise });
  const p1 = h.callbacks().onSelection('item.one', false);
  const p2 = h.callbacks().onSelection('item.one', true);
  second.resolve({ projectId: 'project.demo', revision: 7, groups: [group()] }); await p2;
  first.resolve({ projectId: 'project.demo', revision: 7, groups: [group(1, { eligibility: { selectedItemIds: [], canAccept: false, findings: [] } })] }); await p1;
  assert.deepEqual(h.state.selectedItemIds, ['item.one']); assert.equal(h.state.group.eligibility.canAccept, true); assert.equal(h.postCalls.length, 0);
  h.controller.dispose();
});

test('late reads cannot replace a newer project context', async () => {
  const pending = deferred(); const h = setup({ read: () => pending.promise });
  const reading = h.controller.dispatch('recheck'); h.setCurrent({ projectId: 'project.other' });
  pending.resolve({ projectId: 'project.demo', revision: 10, groups: [group(4)] }); await reading;
  assert.equal(h.state.group.reviewVersion, 1); assert.equal(h.state.projectRevision, 7); assert.equal(h.postCalls.length, 0); h.controller.dispose();
});

test('new content is pinned until explicit adoption and older drafts need explicit reuse', async () => {
  const newer = group(3, { contentVersion: 2 });
  const h = setup({ read: async () => ({ projectId: 'project.demo', revision: 9, groups: [newer] }) });
  await h.controller.dispatch('request-changes'); h.callbacks().onInput('summary', 'Old content draft');
  h.setCurrent({ projectRevision: 9, latestGroup: newer });
  assert.equal(h.callbacks().view.stale, 'content'); assert.equal(h.state.group.reviewVersion, 1);
  await h.controller.dispatch('accept'); assert.equal(h.postCalls.length, 0);
  await h.controller.dispatch('review-latest');
  assert.equal(h.state.group.reviewVersion, 3); assert.equal(h.state.feedback.editing, false); assert.equal(h.state.feedback.olderDraft.summary, 'Old content draft');
  await h.controller.dispatch('copy-older-draft'); assert.equal(h.state.feedback.editing, true); assert.equal(h.state.feedback.draftSummary, 'Old content draft'); h.controller.dispose();
});

test('feedback-only version changes are not labelled new content and are adopted explicitly', async () => {
  const newer = group(2, { status: 'CHANGES_REQUESTED', feedback: { summary: 'Saved elsewhere', itemComments: [] } });
  const h = setup({ read: async () => ({ projectId: 'project.demo', revision: 8, groups: [newer] }) });
  h.setCurrent({ projectRevision: 8, latestGroup: newer });
  assert.equal(h.callbacks().view.stale, 'review'); assert.equal(h.state.group.reviewVersion, 1);
  await h.controller.dispatch('review-latest');
  assert.equal(h.state.group.feedback.summary, 'Saved elsewhere'); assert.equal(h.callbacks().view.canAccept, true); h.controller.dispose();
});

test('read-only exact details remain inspectable, while drafts and decisions cannot be authored', async () => {
  let detail; const h = setup({ context: { readOnly: true }, onDetails: payload => { detail = payload; } });
  h.callbacks().onDetails({ itemId: 'item.one', side: 'proposed' });
  assert.equal(detail.reviewVersion, 1); assert.equal(detail.record.name, 'One'); assert.equal(detail.readOnly, true);
  await h.controller.dispatch('request-changes'); await h.controller.dispatch('accept'); await h.controller.dispatch('discard');
  assert.equal(h.state.feedback.editing, false); assert.equal(h.postCalls.length, 0); h.controller.dispose();
});

test('Details detour keeps raw draft, selection and presentation in the same controller', async () => {
  let detail; const h = setup({ onDetails: payload => { detail = payload; } });
  await h.controller.dispatch('request-changes'); h.callbacks().onInput('summary', '  Raw retained\n');
  await h.controller.dispatch('side', 'current');
  h.callbacks().onDetails({ itemId: 'item.one', side: 'proposed' });
  h.controller.afterMount();
  assert.equal(h.state.feedback.draftSummary, '  Raw retained\n'); assert.equal(h.state.side, 'current');
  assert.deepEqual(h.state.selectedItemIds, ['item.one']); assert.equal(detail.itemId, 'item.one'); h.controller.dispose();
});

test('return restores disclosure geometry before panel scroll and focus without moving the page to the control', () => {
  const operations = [], disclosure = { dataset: { reviewDisclosure: 'feedback' }, get open() { return true; }, set open(value) { operations.push(['open', value]); } };
  const panel = { dataset: { reviewScroll: 'items' }, get scrollTop() { return 212; }, get scrollLeft() { return 0; }, set scrollTop(value) { operations.push(['scroll', value]); }, set scrollLeft(value) {} };
  const focus = { dataset: { reviewFocus: 'summary' }, selectionStart: 2, selectionEnd: 5, selectionDirection: 'forward', focus(options) { operations.push(['focus', options]); }, setSelectionRange(...args) { operations.push(['selection', ...args]); } };
  const element = { isConnected: true, ownerDocument: { activeElement: focus }, contains: value => value === focus,
    querySelectorAll: selector => selector.includes('disclosure') ? [disclosure] : selector.includes('scroll') ? [panel] : [focus] };
  const snapshot = captureReviewContext(element); restoreReviewContext(element, snapshot);
  assert.deepEqual(operations.slice(0, 2), [['open', true], ['scroll', 212]]);
  assert.deepEqual(operations[2], ['focus', { preventScroll: true }]); assert.deepEqual(operations[3], ['selection', 2, 5, 'forward']);
});

test('controller uses durable service feedback revisions and partially accepted dependencies through completion', { timeout: 120000 }, async context => {
  const { assemblyFixture, assemblyPayload, owner, projectId } = await import('./assembly-test-helpers.js');
  const { verifyWorkspaceIntegrity } = await import('../packages/persistence/src/index.js');
  const f = await assemblyFixture(context);
  await f.execute('review.proposal.submit', { reviewId: 'review.controller', expectedReviewVersion: 0, title: 'Machine and its body', items: [
    { itemId: 'assembly', contentKind: 'assembly', payload: assemblyPayload(), dependsOn: ['image'] },
    { itemId: 'image', contentKind: 'image', payload: f.payload(), dependsOn: [] },
  ] });
  let current = { projectId, projectRevision: (await f.studio.readProjectTrusted(projectId)).revision }, callbacks;
  const start = await f.studio.queryReviews({ schemaVersion: 1, projectId, reviewId: 'review.controller', includeHistory: true }, owner);
  const controller = createReviewController({ context: { ...current, group: start.groups[0], canMutate: true }, createElement: node,
    renderView: props => { callbacks = props; return node(); }, host: {
      context: () => current,
      read: request => f.studio.queryReviews(request, owner),
      post: async (action, { body, serialized }) => {
        assert.equal(serialized, JSON.stringify(body));
        const { expectedRevision, idempotencyKey, ...payload } = body;
        return f.studio.execute({ schemaVersion: 1, commandId: idempotencyKey, idempotencyKey,
          type: { feedback: 'review.feedback.save', accept: 'review.accept', discard: 'review.discard' }[action],
          projectId, baseRevision: expectedRevision, expectedVersion: expectedRevision, payload: { ...payload, reviewId: 'review.controller' } }, owner);
      },
      onSaved: async () => { current = { projectId, projectRevision: (await f.studio.readProjectTrusted(projectId)).revision }; },
    } });
  context.after(() => controller.dispose());
  await controller.dispatch('request-changes'); callbacks.onInput('summary', 'Make the body calmer.');
  assert.equal(await controller.dispatch('save-feedback'), true);
  assert.equal(controller.getState().group.status, 'CHANGES_REQUESTED');
  assert.equal(controller.getState().group.reviewVersion, 2);
  await controller.dispatch('edit-feedback'); callbacks.onInput('summary', 'Actually this is useful already.');
  assert.equal(await controller.dispatch('save-feedback'), true);
  assert.equal(controller.getState().group.reviewVersion, 3);
  await callbacks.onSelection('assembly', false);
  assert.equal(callbacks.view.canAccept, true);
  assert.equal(await controller.dispatch('accept'), true);
  for (let i = 0; i < 20 && controller.getState().load !== 'ready'; i += 1) await new Promise(resolve => setImmediate(resolve));
  assert.equal(controller.getState().group.reviewVersion, 4);
  assert.deepEqual(controller.getState().selectedItemIds, []);
  const leaf = (await f.studio.readProjectTrusted(projectId)).snapshot.assetLibrary.assets[0];
  await callbacks.onSelection('assembly', true);
  assert.equal(callbacks.view.canAccept, true);
  assert.equal(await controller.dispatch('accept'), true);
  assert.equal(controller.getState().group.status, 'ACCEPTED');
  assert.equal(controller.getState().group.reviewVersion, 5);
  const final = await f.studio.readProjectTrusted(projectId);
  assert.deepEqual(final.snapshot.assetLibrary.assets[0], leaf);
  assert.equal(final.revision, start.revision + 4);
  const old = await f.studio.queryReviews({ schemaVersion: 1, projectId, reviewId: 'review.controller', reviewVersion: 2 }, owner);
  assert.equal(old.groups[0].feedback.summary, 'Make the body calmer.');
  assert.equal((await verifyWorkspaceIntegrity({ projectStore: f.store, artifactStore: f.artifacts })).ok, true);
});

test('returning to the project restarts an aborted read rather than leaving a permanent loading screen', async () => {
  const first = deferred(); let calls = 0;
  const h = setup({ read: async () => ++calls === 1 ? first.promise : { projectId: 'project.demo', revision: 7, groups: [group()] } });
  const old = h.controller.dispatch('recheck');
  h.setCurrent({ projectId: 'project.other' }); assert.equal(h.state.load, 'idle');
  h.setCurrent({ projectId: 'project.demo' });
  for (let i = 0; i < 20 && h.state.load !== 'ready'; i += 1) await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.state.load, 'ready'); assert.equal(calls, 2);
  first.resolve({ projectId: 'project.demo', revision: 99, groups: [group(99)] }); await old;
  assert.equal(h.state.group.reviewVersion, 1); h.controller.dispose();
});

test('a receipt with different accepted output pins is not mistaken for confirmation', async () => {
  const h = setup({ post: async () => ({ ...receipt, value: { ...receipt.value, accepted: [{ ...receipt.value.accepted[0], assetVersion: 2 }] } }) });
  await h.controller.dispatch('accept');
  assert.equal(h.state.phase, 'uncertain'); assert.ok(h.state.intent); assert.equal(h.state.group.reviewVersion, 1);
});

test('cached detached Review navigation checks preserve the Details origin focus, disclosures and panel scroll', () => {
  let callbacks, panel, disclosure, focus, restoredFocus = null, restoredSelection = null;
  const document = { activeElement: null };
  const element = { dataset: {}, ownerDocument: document, isConnected: false, replaceChildren() {},
    contains: value => value === focus,
    querySelectorAll: selector => selector.includes('disclosure') ? [disclosure] : selector.includes('scroll') ? [panel] : [focus] };
  const controller = createReviewController({ context: { projectId: 'project.demo', projectRevision: 7, group: group(), canMutate: true }, createElement: () => element,
    renderView: props => {
      callbacks = props;
      panel = { dataset: { reviewScroll: 'panel' }, scrollTop: 0, scrollLeft: 0 };
      disclosure = { dataset: { reviewDisclosure: 'comment:item.one' }, open: false };
      focus = { dataset: { reviewFocus: 'preview-details:proposed' }, selectionStart: 2, selectionEnd: 6, selectionDirection: 'forward',
        focus() { restoredFocus = this; document.activeElement = this; }, setSelectionRange(...args) { restoredSelection = args; } };
      return node();
    }, host: { context: () => ({ projectId: 'project.demo', projectRevision: 7 }),
      onDetails() { element.isConnected = false; document.activeElement = null; panel.scrollTop = 0; disclosure.open = false; } } });
  element.isConnected = true; controller.afterMount();
  panel.scrollTop = 217; panel.scrollLeft = 12; disclosure.open = true; document.activeElement = focus;
  callbacks.onDetails({ itemId: 'item.one', side: 'proposed' });
  // The Library host asks all cached controllers whether navigation may proceed.
  assert.equal(controller.requestLeave(), true);
  controller.reconcileContext();
  assert.equal(controller.requestLeave(), true);
  element.isConnected = true; controller.afterMount();
  assert.equal(disclosure.open, true); assert.equal(panel.scrollTop, 217); assert.equal(panel.scrollLeft, 12);
  assert.equal(restoredFocus, focus); assert.deepEqual(restoredSelection, [2, 6, 'forward']);
  controller.dispose();
});

test('a failed historical initial read can retry without dropping its exact Review version', async () => {
  let calls = 0;
  const h = setup({ context: { group: null, reviewId: 'review.demo', reviewVersion: 2, readOnly: true },
    read: async request => { if (++calls === 1) throw new TypeError('Temporary read failure'); return { projectId: 'project.demo', revision: 10, groups: [group(request.reviewVersion ?? 4)] }; } });
  await h.controller.dispatch('recheck');
  assert.equal(h.state.group, null); assert.equal(h.state.load, 'unavailable');
  await h.controller.dispatch('recheck');
  assert.equal(h.state.group.reviewVersion, 2); assert.equal(h.state.readOnly, true);
  await h.controller.dispatch('recheck');
  assert.deepEqual(h.readCalls.map(request => request.reviewVersion), [2, 2, 2]);
  assert.equal(h.postCalls.length, 0); h.controller.dispose();
});

test('a newer original proposal requires explicit adoption and retains an older draft until the read succeeds', async () => {
  const source = { contentKind: 'animation', proposalId: 'proposal.legacy', expectedProposalVersion: 1 };
  const latestSource = { ...source, expectedProposalVersion: 2 };
  const original = group(0, { legacySource: source, isLegacyProjection: true });
  let failLatest = true;
  const h = setup({ group: original, read: async request => {
    if (request.legacySource.expectedProposalVersion === 1) throw Object.assign(new Error('The original proposal changed.'), { status: 409 });
    if (failLatest) { failLatest = false; throw new TypeError('Temporary read failure'); }
    return { projectId: 'project.demo', revision: 8, groups: [group(0, { legacySource: latestSource, isLegacyProjection: true, title: 'New original proposal' })] };
  } });
  await h.controller.dispatch('request-changes'); h.callbacks().onInput('summary', '  Feedback for the old proposal\n');
  h.setCurrent({ projectRevision: 8, latestLegacySource: latestSource });
  assert.equal(h.callbacks().view.stale, 'legacy'); assert.equal(h.callbacks().view.canAdoptLatest, true);
  assert.equal(h.state.legacySource.expectedProposalVersion, 1);
  await h.controller.dispatch('recheck');
  assert.equal(h.readCalls[0].legacySource.expectedProposalVersion, 1);
  assert.equal(h.state.group.reviewVersion, 0); assert.equal(h.state.legacySource.expectedProposalVersion, 1);
  await h.controller.dispatch('review-latest');
  assert.equal(h.state.legacySource.expectedProposalVersion, 1);
  assert.equal(h.state.feedback.draftSummary, '  Feedback for the old proposal\n'); assert.equal(h.state.feedback.olderDraft, null);
  await h.controller.dispatch('review-latest');
  assert.equal(h.state.legacySource.expectedProposalVersion, 2); assert.equal(h.state.group.title, 'New original proposal');
  assert.equal(h.state.feedback.editing, false); assert.equal(h.state.feedback.draftSummary, '');
  assert.equal(h.state.feedback.olderDraft.summary, '  Feedback for the old proposal\n');
  assert.equal(h.state.feedback.olderDraft.legacySource.expectedProposalVersion, 1);
  assert.equal(h.callbacks().view.stale, null); assert.equal(h.postCalls.length, 0);
  await h.controller.dispatch('copy-older-draft'); assert.equal(h.state.feedback.draftSummary, '  Feedback for the old proposal\n');
  h.controller.dispose();
});

test('a legacy source changed before the first successful read can be adopted explicitly without fabricating an old group', async () => {
  const source = { contentKind: 'image', proposalId: 'proposal.initial', expectedProposalVersion: 1 }, latestSource = { ...source, expectedProposalVersion: 3 };
  const h = setup({ context: { group: null, legacySource: source }, read: async request => {
    if (request.legacySource.expectedProposalVersion !== 3) throw Object.assign(new Error('Original proposal version conflict.'), { status: 409 });
    return { projectId: 'project.demo', revision: 9, groups: [group(0, { legacySource: latestSource, isLegacyProjection: true })] };
  } });
  await h.controller.dispatch('recheck'); assert.equal(h.state.group, null);
  h.setCurrent({ projectRevision: 9, latestLegacySource: latestSource });
  assert.equal(h.callbacks().view.stale, 'legacy'); assert.equal(h.callbacks().view.canAdoptLatest, true);
  await h.controller.dispatch('review-latest');
  assert.equal(h.state.group.reviewVersion, 0); assert.equal(h.state.legacySource.expectedProposalVersion, 3);
  assert.equal(h.state.feedback.olderDraft, null); assert.equal(h.postCalls.length, 0); h.controller.dispose();
});

test('external shared adoption reads the authoritative Review explicitly and preserves the old draft until success', async () => {
  const source = { contentKind: 'animation', proposalId: 'proposal.converted', expectedProposalVersion: 2 };
  const adopted = group(1, { legacySource: source, status: 'CHANGES_REQUESTED', feedback: { summary: 'Saved elsewhere', itemComments: [] } });
  let failShared = true;
  const h = setup({ group: group(0, { legacySource: source, isLegacyProjection: true }), read: async request => {
    if (request.legacySource) throw Object.assign(new Error('Continue through the adopted Review.'), { code: 'LEGACY_PROPOSAL_ADOPTED', status: 409 });
    if (failShared) { failShared = false; throw new TypeError('Temporary shared read failure'); }
    return { projectId: 'project.demo', revision: 8, groups: [adopted] };
  } });
  await h.controller.dispatch('request-changes'); h.callbacks().onInput('summary', '  Original legacy draft\n');
  h.setCurrent({ projectRevision: 8, latestGroup: adopted });
  assert.equal(h.callbacks().view.canAdoptLatest, true);
  await h.controller.dispatch('review-latest');
  assert.equal(h.readCalls[0].reviewId, adopted.reviewId); assert.equal(h.readCalls[0].reviewVersion, 1); assert.equal(Object.hasOwn(h.readCalls[0], 'legacySource'), false);
  assert.equal(h.state.group.reviewVersion, 0); assert.deepEqual(h.state.legacySource, source);
  assert.equal(h.state.feedback.draftSummary, '  Original legacy draft\n'); assert.equal(h.state.feedback.olderDraft, null);
  await h.controller.dispatch('review-latest');
  assert.equal(h.state.group.reviewVersion, 1); assert.equal(h.state.legacySource, null);
  assert.equal(h.state.feedback.editing, false); assert.equal(h.state.feedback.olderDraft.summary, '  Original legacy draft\n');
  assert.deepEqual(h.state.feedback.olderDraft.legacySource, source); assert.equal(h.postCalls.length, 0); h.controller.dispose();
});

test('an initial failed legacy read matches external adoption by immutable source identity before its Review ID is known', async () => {
  const source = { contentKind: 'image', proposalId: 'proposal.newly-adopted', expectedProposalVersion: 1 };
  const adopted = group(1, { reviewId: 'review.authoritative-adoption', legacySource: source });
  let failShared = true;
  const h = setup({ context: { group: null, legacySource: source }, read: async request => {
    if (request.legacySource) throw Object.assign(new Error('Continue through its adopted Review.'), { code: 'LEGACY_PROPOSAL_ADOPTED', status: 409 });
    if (failShared) { failShared = false; throw new TypeError('Temporary failure'); }
    return { projectId: 'project.demo', revision: 9, groups: [adopted] };
  } });
  await h.controller.dispatch('recheck'); assert.equal(h.state.reviewId, null); assert.equal(h.state.group, null);
  h.setCurrent({ projectRevision: 9, latestGroup: { ...adopted, legacySource: { ...source, proposalId: 'proposal.unrelated' } } });
  assert.equal(h.callbacks().view.canAdoptLatest, false);
  h.setCurrent({ latestGroup: adopted }); assert.equal(h.callbacks().view.canAdoptLatest, true);
  await h.controller.dispatch('review-latest');
  assert.equal(h.state.group, null); assert.equal(h.state.reviewId, null); assert.deepEqual(h.state.legacySource, source);
  await h.controller.dispatch('review-latest');
  assert.equal(h.state.reviewId, adopted.reviewId); assert.equal(h.state.group.reviewVersion, 1); assert.equal(h.state.legacySource, null);
  assert.equal(h.state.feedback.olderDraft, null); assert.equal(h.postCalls.length, 0);
  assert.ok(h.readCalls.filter(request => request.reviewId).every(request => request.reviewId === adopted.reviewId && request.reviewVersion === 1 && !request.legacySource));
  h.controller.dispose();
});
