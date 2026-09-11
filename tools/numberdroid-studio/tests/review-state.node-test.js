import test from 'node:test';
import assert from 'node:assert/strict';
import { createReviewUiState, reviewPresentation, reviewStaleness, beginReviewFeedback, cancelReviewFeedback, adoptReviewGroup, reuseReviewDraft, createReviewIntent } from '../apps/studio-server/public/review-state.js';

const group = (extra = {}) => ({ reviewId: 'review.demo', reviewVersion: 1, contentVersion: 1, status: 'PENDING',
  items: [{ itemId: 'item.leaf', status: 'PENDING' }, { itemId: 'item.assembly', status: 'PENDING' }],
  selectionOutcome: { state: 'READY', items: [] }, eligibility: { selectedItemIds: ['item.leaf', 'item.assembly'], canAccept: true, findings: [] }, isLatest: true, latestReviewVersion: 1, ...extra });
const state = extra => createReviewUiState({ projectId: 'project.demo', projectRevision: 7, canMutate: true, group: group(extra) });
const context = { projectId: 'project.demo', projectRevision: 7 };

test('feedback editing is separate from saved feedback and blocks acceptance until saved or cancelled', () => {
  const s = state({ status: 'CHANGES_REQUESTED', feedback: { summary: 'Earlier instructions', itemComments: [{ itemId: 'item.leaf', text: 'Earlier item note' }] } });
  assert.equal(reviewPresentation(s, context).canAccept, true);
  beginReviewFeedback(s); s.feedback.draftSummary = '  Unsent revision  ';
  assert.equal(s.group.feedback.summary, 'Earlier instructions');
  assert.equal(reviewPresentation(s, context).canAccept, false);
  const intent = createReviewIntent(s, 'feedback', context, 'retry.exact');
  assert.equal(intent.body.summary, 'Unsent revision');
  assert.equal(s.feedback.draftSummary, '  Unsent revision  ');
  cancelReviewFeedback(s);
  assert.equal(s.group.feedback.summary, 'Earlier instructions');
  assert.equal(reviewPresentation(s, context).canAccept, true);
});

test('content and feedback changes are distinct, require explicit adoption, and retain older raw drafts', () => {
  const s = state(); beginReviewFeedback(s); s.feedback.draftSummary = '  Older raw draft\n'; s.feedback.draftItemComments = { 'item.leaf': 'Leaf note', 'item.assembly': 'Assembly note' };
  s.latest = group({ reviewVersion: 2, contentVersion: 1 });
  assert.equal(reviewStaleness(s), 'review');
  s.latest = group({ reviewVersion: 3, contentVersion: 2 });
  assert.equal(reviewStaleness(s), 'content');
  assert.equal(reviewPresentation(s, context).canFeedback, false);
  assert.equal(s.group.reviewVersion, 1);
  adoptReviewGroup(s, group({ reviewVersion: 3, contentVersion: 2, items: [{ itemId: 'item.leaf', status: 'ACCEPTED' }, { itemId: 'item.assembly', status: 'PENDING' }] }), 9, { retainDraft: true });
  assert.equal(s.feedback.editing, false);
  assert.equal(s.feedback.olderDraft.summary, '  Older raw draft\n');
  reuseReviewDraft(s);
  assert.equal(s.feedback.draftSummary, '  Older raw draft\n');
  assert.deepEqual(s.feedback.draftItemComments, { 'item.assembly': 'Assembly note' });
});

test('server eligibility is required independently of a resolvable preview or local selection', () => {
  const s = state({ selectionOutcome: { state: 'READY', items: [] }, eligibility: { canAccept: false, findings: [{ code: 'REVIEW_DEPENDENCY_REQUIRED', message: 'Include its dependency.' }] } });
  assert.equal(reviewPresentation(s, context).canAccept, false);
  assert.throws(() => createReviewIntent(s, 'accept', context, 'key.1'), /dependency/);
  beginReviewFeedback(s); s.feedback.draftSummary = 'Please refresh the dependency.';
  assert.equal(reviewPresentation(s, context).canFeedback, true);
});

test('read-only, other-project, stale-revision, closed and unknown outcomes cannot create a new write', () => {
  for (const mutate of [s => { s.readOnly = true; }, s => { s.phase = 'uncertain'; }, s => { s.group.status = 'ACCEPTED'; }, s => { s.projectRevision = 6; }, s => { s.projectId = 'project.other'; }]) {
    const s = state(); mutate(s);
    assert.equal(reviewPresentation(s, context).canAccept, false);
    assert.throws(() => createReviewIntent(s, 'accept', context, 'key.1'));
  }
});

test('first owner decision carries exact legacy provenance without inventing a persisted Review version', () => {
  const legacySource = { contentKind: 'animation', proposalId: 'proposal.clip', expectedProposalVersion: 3 };
  const s = state({ reviewVersion: 0, latestReviewVersion: 0, isLegacyProjection: true, legacySource });
  const intent = createReviewIntent(s, 'accept', context, 'key.legacy');
  assert.equal(intent.body.expectedReviewVersion, 0);
  assert.deepEqual(intent.body.legacySource, legacySource);
  assert.equal(s.group.reviewVersion, 0);
  assert.equal(intent.serialized, JSON.stringify(intent.body));
});
