/** Owner UI projection from exact immutable revisions. Original events are unchanged. */
const copy = value => structuredClone(value);
const quote = value => value ? `“${value}”` : 'the content';
const names = items => { const values = (items ?? []).map(item => item.name ?? item.payload?.name).filter(Boolean); return values.length > 1 ? `${values[0]} + ${values.length - 1} more` : values[0] ?? null; };
const actorLabel = actor => actor?.displayName || (actor?.kind === 'agent' ? 'Studio agent' : actor?.kind === 'human' ? 'Designer' : 'Studio');

export function presentActivityEvent(event, revision = null, previousRevision = null) {
  const snapshot = revision?.snapshot ?? {}, result = revision?.result ?? {}, type = event.commandType ?? revision?.command?.type ?? '';
  const presentation = { title: event.summary || 'Project activity', summary: '', actorLabel: actorLabel(event.actor),
    inspect: { type: 'event', eventId: event.id }, technical: { command: type, commandId: event.commandId, revision: event.revision, taskId: event.taskId ?? null } };
  if (type.startsWith('review.')) {
    const group = snapshot.reviewLibrary?.groups.find(group => group.reviewId === result.reviewId);
    if (group) {
      const action = group.decision?.action;
      const previous = previousRevision?.snapshot.reviewLibrary?.groups.find(value => value.reviewId === group.reviewId);
      const feedbackEdited = type === 'review.feedback.save' && previous?.feedback && previous.contentVersion === group.contentVersion;
      const verb = type === 'review.proposal.submit' ? (group.contentVersion > 1 ? 'Revised changes for' : 'Changes ready for')
        : type === 'review.feedback.save' ? (feedbackEdited ? 'Feedback updated for' : 'Changes requested for') : type === 'review.accept' ? 'Accepted changes for' : 'Discarded remaining changes for';
      presentation.title = `${verb} ${quote(group.title)}`;
      presentation.summary = type === 'review.feedback.save' ? 'Feedback saved for the next author round.'
        : type === 'review.accept' ? `${result.accepted?.length ?? 0} changes saved. ${result.remainingItemIds?.length ?? 0} remain in this review.`
          : type === 'review.discard' ? 'Remaining proposed work was closed. Previously accepted assets were kept.'
            : 'The proposed content is ready for your decision; saved assets are unchanged.';
      presentation.outcome = ({ PENDING:'Needs review', CHANGES_REQUESTED:group.proposer.actor.kind === 'agent' ? 'Awaiting agent' : 'Awaiting author', ACCEPTED:'Accepted', DISCARDED:'Discarded' })[group.status];
      presentation.inspect = { type: 'review', reviewId: group.reviewId, reviewVersion: group.reviewVersion };
      if (group.feedback && type === 'review.feedback.save') presentation.feedback = { summary: group.feedback.summary,
        itemComments: group.feedback.itemComments.map(comment => ({ name: group.items.find(item => item.itemId === comment.itemId)?.payload.name ?? 'Review item', comment: comment.text })) };
      presentation.technical.reviewId = group.reviewId; presentation.technical.reviewVersion = group.reviewVersion;
      presentation.technical.contentVersion = group.contentVersion; presentation.technical.action = action;
      return presentation;
    }
  }
  const native = snapshot.assetLibrary?.assets.find(asset => asset.assetId === result.assetId);
  const clip = snapshot.clipLibrary?.assets.find(asset => asset.assetId === result.assetId);
  const assembly = snapshot.assemblyLibrary?.assets.find(asset => asset.assetId === result.assetId);
  const record = native ?? clip ?? assembly;
  if (['asset.save', 'clip.save', 'assembly.save'].includes(type) && record) {
    presentation.title = `Saved ${type === 'clip.save' ? 'Animation ' : type === 'assembly.save' ? 'Assembly ' : ''}${quote(record.name)}`;
    presentation.summary = `Saved version ${record.assetVersion}. Earlier saved versions remain available.`;
    presentation.technical.assetId = record.assetId; presentation.technical.assetVersion = record.assetVersion;
    presentation.technical.metadataVersion = record.metadataVersion; return presentation;
  }
  const contentKind = type.startsWith('clip.') ? 'animation' : type.startsWith('assembly.') ? 'assembly' : type.startsWith('asset.proposal.') ? 'image' : null;
  if (contentKind && type.includes('proposal.')) {
    const library = contentKind === 'image' ? snapshot.assetLibrary : contentKind === 'animation' ? snapshot.clipLibrary : snapshot.assemblyLibrary;
    const proposal = library?.proposals.find(proposal => proposal.proposalId === result.proposalId);
    if (proposal) {
      const status = proposal.status ?? proposal.state, name = contentKind === 'image' ? names(proposal.items) : proposal.content?.name;
      const verbs = { PENDING: 'Changes ready for', CHANGES_REQUESTED: 'Changes requested for', ACCEPTED: 'Accepted changes for', DISCARDED: 'Discarded proposal for', DECIDED: 'Recorded a review decision for', APPLIED: 'Applied the review for' };
      presentation.title = `${verbs[status] ?? 'Reviewed'} ${quote(name)}`;
      presentation.summary = status === 'DECIDED' ? 'The decision is saved; accepted changes still need to be added.'
        : status === 'CHANGES_REQUESTED' ? 'Feedback saved for the author.'
          : status === 'PENDING' ? 'Proposed changes are ready for review.' : 'The recorded outcome remains available in history.';
      presentation.outcome = ({ PENDING:'Needs review', CHANGES_REQUESTED:'Awaiting author', ACCEPTED:'Accepted', DISCARDED:'Discarded', DECIDED:'Decision saved', APPLIED:'Applied' })[status] ?? status;
      if (typeof proposal.feedback === 'string' && proposal.feedback) presentation.feedback = { summary: proposal.feedback, itemComments: [] };
      presentation.technical.proposalId = proposal.proposalId; presentation.technical.proposalVersion = proposal.proposalVersion;
      return presentation;
    }
  }
  if (type === 'grant.issue' || type === 'grant.revoke') {
    presentation.title = type === 'grant.issue' ? 'Agent access granted' : 'Agent access revoked';
    presentation.summary = type === 'grant.issue' ? 'Scoped permission was recorded. This does not start an agent.' : 'The previous permission no longer allows new work.'; return presentation;
  }
  if (type.startsWith('atlas.')) {
    const id = result.atlasId ?? event.changes?.find(change => change.entityType === 'atlas')?.entityId;
    const atlas = snapshot.atlases?.find(atlas => (atlas.atlasId ?? atlas.id) === id);
    if (atlas) {
      presentation.title = type === 'atlas.commit.slices' ? `Saved cuts from ${quote(atlas.name)}` : type === 'atlas.define.rects' ? `Saved the cut layout for ${quote(atlas.name)}` : `Prepared cuts for ${quote(atlas.name)}`;
      presentation.summary = type === 'atlas.commit.slices' ? 'The saved cuts are available for reusable content.' : 'Original source pixels remain unchanged.'; return presentation;
    }
  }
  if (event.actor?.kind === 'agent' && ['FAILED', 'DENIED', 'failed', 'denied'].includes(event.status)) {
    const kind = type.startsWith('clip.') ? 'Animation' : type.startsWith('assembly.') ? 'Assembly' : type.startsWith('review.') ? 'Review' : 'content';
    presentation.title = `Agent could not submit ${kind} changes`; presentation.severity = 'warning'; presentation.outcome = /denied/i.test(event.status) ? 'Not allowed' : 'Needs correction';
    const code = event.errorCode ?? event.error?.code;
    presentation.summary = /SLICE.*NOT_FOUND|SLICE.*CONFLICT/.test(code ?? '') ? 'A saved cut reference needs correction.' : /VERSION|REVISION|CONFLICT/.test(code ?? '') ? 'The agent needs to check the current version before trying again.' : 'The operation was not confirmed. Its recorded diagnostic is available below.';
    presentation.technical.errorCode = code; presentation.technical.recordedSummary = event.summary;
  }
  return presentation;
}

export function presentActivity(document, { afterRevision = 0 } = {}) {
  return document.revisions.filter(revision => revision.number > afterRevision).map(revision => ({ ...copy(revision.event), presentation: presentActivityEvent(revision.event, revision, document.revisions.find(prior => prior.number === revision.number - 1)) }));
}
