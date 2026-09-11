const copy = value => structuredClone(value);
export const reviewIsOpen = group => Boolean(group && ['PENDING', 'CHANGES_REQUESTED'].includes(group.status));
export const reviewPendingIds = group => (group?.items ?? []).filter(item => item.status === 'PENDING').map(item => item.itemId);
const commentsMap = comments => Object.fromEntries((comments ?? []).map(comment => [comment.itemId, comment.text]));

export function createReviewUiState(context) {
  const group = context.group ? copy(context.group) : null;
  return {
    projectId: context.projectId, projectRevision: context.projectRevision, reviewId: context.reviewId ?? group?.reviewId ?? null,
    requestedReviewVersion: context.reviewVersion, legacySource: copy(context.legacySource ?? null),
    group, latest: null, selectedItemIds: reviewPendingIds(group), activeItemId: group?.items[0]?.itemId ?? null,
    side: 'proposed', selection: {}, highlight: true, phase: 'idle', load: group ? 'ready' : 'idle', error: null, receipt: null, intent: null,
    readOnly: context.readOnly === true, canMutate: context.canMutate === true,
    feedback: { editing: false, draftSummary: '', draftItemComments: {}, olderDraft: null },
  };
}

export function reviewStaleness(state) {
  if (!state.group) return null;
  const latestVersion = Math.max(state.group.latestReviewVersion ?? state.group.reviewVersion, state.latest?.reviewVersion ?? 0);
  if (latestVersion <= state.group.reviewVersion) return null;
  return state.latest && state.latest.contentVersion !== state.group.contentVersion ? 'content' : 'review';
}

export function reviewFeedbackErrors(state) {
  const errors = [];
  if (!state.feedback.draftSummary.trim()) errors.push('Write a feedback summary before requesting changes.');
  if (state.feedback.draftSummary.length > 4000) errors.push('Keep the feedback summary within 4,000 characters.');
  const pending = new Set(reviewPendingIds(state.group));
  for (const [itemId, text] of Object.entries(state.feedback.draftItemComments)) {
    if (text.trim() && !pending.has(itemId)) errors.push('Comments can cover only remaining changes.');
    if (text.length > 2000) errors.push('Keep each item comment within 2,000 characters.');
  }
  return errors;
}

export function reviewPresentation(state, current = {}) {
  const stale = reviewStaleness(state), locked = ['saving', 'uncertain'].includes(state.phase), selectionLoading = state.load !== 'ready';
  const sameProject = current.projectId === undefined || current.projectId === state.projectId;
  const sameRevision = current.projectRevision === undefined || current.projectRevision === state.projectRevision;
  const writable = state.canMutate && !state.readOnly && sameProject && sameRevision && !locked && !selectionLoading && !stale && reviewIsOpen(state.group);
  const feedbackErrors = reviewFeedbackErrors(state);
  const canAccept = writable && !state.feedback.editing && state.selectedItemIds.length > 0 && state.group?.eligibility?.canAccept === true && state.group?.selectionOutcome?.state === 'READY'
    && state.selectedItemIds.length === state.group.eligibility.selectedItemIds?.length
    && state.selectedItemIds.every(id => state.group.eligibility.selectedItemIds.includes(id));
  let message = state.error;
  if (!message && locked) message = state.phase === 'uncertain' ? 'The outcome is unconfirmed. Retry the retained exact request to recover its receipt.' : 'Saving your decision…';
  if (!message && !sameProject) message = 'Return to the original project to continue this review.';
  if (!message && stale) message = stale === 'content' ? 'The agent submitted newer content. Review the latest version before deciding.' : 'Feedback or the decision changed. Review the latest saved version before deciding.';
  if (!message && !sameRevision) message = 'The project changed. Recheck before deciding; your draft is retained.';
  if (!message && state.readOnly) message = 'This recorded Review version is read-only.';
  if (!message && selectionLoading) message = 'Checking the exact selection and saved target versions…';
  if (!message && state.feedback.editing) message = 'Save or cancel your feedback edit before accepting changes.';
  if (!message && state.group?.eligibility?.findings?.length) message = state.group.eligibility.findings.map(finding => finding.message).join(' ');
  if (!message && state.group?.status === 'CHANGES_REQUESTED') message = state.group.nextActor?.kind === 'agent' ? 'Feedback is saved. The agent can read it on its next work round; no agent has been started.' : 'Feedback is saved for the proposer. No background work has been started.';
  return { canAccept, canFeedback: writable && state.feedback.editing && feedbackErrors.length === 0,
    canEditFeedback: writable && !state.feedback.editing, canDiscard: writable && !state.feedback.editing,
    canInspect: sameProject && !locked && Boolean(state.group), canAdoptLatest: !state.readOnly && !locked && Boolean(stale),
    locked, stale, selectionLoading, message: message ?? '', feedbackErrors };
}

export function beginReviewFeedback(state) {
  state.feedback.editing = true;
  state.feedback.draftSummary = state.group?.feedback?.summary ?? '';
  state.feedback.draftItemComments = commentsMap(state.group?.feedback?.itemComments);
  const pending = new Set(reviewPendingIds(state.group));
  state.feedback.draftItemComments = Object.fromEntries(Object.entries(state.feedback.draftItemComments).filter(([id]) => pending.has(id)));
}
export function cancelReviewFeedback(state) {
  state.feedback.editing = false; state.feedback.draftSummary = ''; state.feedback.draftItemComments = {};
}
export function retainReviewDraft(state) {
  if (state.feedback.editing && (state.feedback.draftSummary || Object.values(state.feedback.draftItemComments).some(Boolean))) {
    state.feedback.olderDraft = { summary: state.feedback.draftSummary, itemComments: copy(state.feedback.draftItemComments),
      reviewVersion: state.group.reviewVersion, contentVersion: state.group.contentVersion };
  }
  cancelReviewFeedback(state);
}
export function reuseReviewDraft(state) {
  const old = state.feedback.olderDraft;
  if (!old) return;
  const pending = new Set(reviewPendingIds(state.group));
  state.feedback.editing = true; state.feedback.draftSummary = old.summary;
  state.feedback.draftItemComments = Object.fromEntries(Object.entries(old.itemComments).filter(([id]) => pending.has(id)));
}
export function adoptReviewGroup(state, group, revision, { preserveSelection = true, retainDraft = false } = {}) {
  if (retainDraft) retainReviewDraft(state);
  const oldSelection = state.selectedItemIds, pending = reviewPendingIds(group);
  state.group = copy(group); state.reviewId = group.reviewId; state.projectRevision = revision;
  state.selectedItemIds = preserveSelection ? pending.filter(id => oldSelection.includes(id)) : pending;
  if (!group.items.some(item => item.itemId === state.activeItemId)) state.activeItemId = group.items[0]?.itemId ?? null;
  state.requestedReviewVersion = group.reviewVersion; state.load = 'ready'; state.error = null;
  if (group.reviewVersion > 0) state.legacySource = null;
  if (state.latest?.reviewVersion <= group.reviewVersion) state.latest = null;
}

export function createReviewIntent(state, action, current, idempotencyKey) {
  const view = reviewPresentation(state, current);
  const allowed = action === 'feedback' ? view.canFeedback : action === 'accept' ? view.canAccept : action === 'discard' ? view.canDiscard : false;
  if (!allowed) throw new Error(view.message || (action === 'feedback' ? view.feedbackErrors[0] : 'This decision is not currently available.'));
  const body = { expectedRevision: state.projectRevision, idempotencyKey, expectedReviewVersion: state.group.reviewVersion,
    ...(state.group.reviewVersion === 0 ? { legacySource: copy(state.group.legacySource ?? state.legacySource) } : {}),
    ...(action === 'feedback' ? { summary: state.feedback.draftSummary.trim(), itemComments: Object.entries(state.feedback.draftItemComments).filter(([, text]) => text.trim()).map(([itemId, text]) => ({ itemId, text: text.trim() })) } : {}),
    ...(action === 'accept' ? { selectedItemIds: [...state.selectedItemIds] } : {}), confirmed: true };
  if (state.group.reviewVersion === 0 && !body.legacySource) throw new Error('The exact original proposal is required before saving this decision.');
  return { projectId: state.projectId, reviewId: state.group.reviewId, contentVersion: state.group.contentVersion, action, body,
    acceptedPins: action === 'accept' ? state.group.items.filter(item => state.selectedItemIds.includes(item.itemId)).map(item => {
      const record = item.proposed ?? item.proposedRecord;
      return { itemId: item.itemId, assetId: record?.assetId, assetVersion: record?.assetVersion, metadataVersion: record?.metadataVersion };
    }) : [], serialized: JSON.stringify(body) };
}
