import { invariant } from '../../domain/src/errors.js';
import { requireId, requireInteger, requireEnum } from '../../domain/src/validation.js';
import { exactReviewFields, normalizeReviewItems } from '../../domain/src/review-definition.js';
import { fingerprint } from './value-utils.js';

const libraries = { image: 'assetLibrary', animation: 'clipLibrary', assembly: 'assemblyLibrary' };
const commands = { image: 'asset.proposal.submit', animation: 'clip.proposal.submit', assembly: 'assembly.proposal.submit' };
export function normalizeLegacySource(value) {
  exactReviewFields(value, ['contentKind', 'proposalId', 'expectedProposalVersion'], 'Legacy Review source');
  return { contentKind: requireEnum(value.contentKind, 'contentKind', Object.keys(libraries)),
    proposalId: requireId(value.proposalId, 'proposalId'), expectedProposalVersion: requireInteger(value.expectedProposalVersion, 'expectedProposalVersion', { min: 1 }) };
}
export function legacyReviewId(projectId, source) {
  return `review.legacy.${fingerprint([projectId, source.contentKind, source.proposalId])}`;
}
export function adoptedLegacyReview(snapshot, source) {
  return snapshot.reviewLibrary?.groups.find(group => group.legacySource?.contentKind === source.contentKind && group.legacySource.proposalId === source.proposalId) ?? null;
}
export function assertLegacyProposalWritable(snapshot, contentKind, proposalId) {
  const group = adoptedLegacyReview(snapshot, { contentKind, proposalId });
  invariant(!group, 'LEGACY_PROPOSAL_ADOPTED', 'Continue this proposal through its current Review.', group ? { reviewId: group.reviewId, reviewVersion: group.reviewVersion } : undefined);
}
const proposalAt = (snapshot, source) => snapshot[libraries[source.contentKind]]?.proposals.find(proposal => proposal.proposalId === source.proposalId);

/** A read-only projection built from the exact original content, never current saved heads. */
export function projectLegacyReview(document, requestSource, { applyItem } = {}) {
  const source = normalizeLegacySource(requestSource), head = document.revisions.at(-1);
  assertLegacyProposalWritable(head.snapshot, source.contentKind, source.proposalId);
  const proposal = proposalAt(head.snapshot, source);
  invariant(proposal && proposal.proposalVersion === source.expectedProposalVersion, 'LEGACY_PROPOSAL_CONFLICT', 'Open the current proposal before deciding.', { ...source, actualProposalVersion: proposal?.proposalVersion });
  const status = proposal.state ?? proposal.status;
  invariant(source.contentKind === 'image' ? status === 'PENDING' : ['PENDING', 'CHANGES_REQUESTED'].includes(status),
    'LEGACY_REVIEW_UNSUPPORTED', 'This recorded decision remains in its original review and application history.', { status });
  const sourceRevision = [...document.revisions].reverse().find(revision => revision.command.type === commands[source.contentKind]
    && proposalAt(revision.snapshot, source)?.proposalVersion <= source.expectedProposalVersion
    && (revision.result?.proposalId === source.proposalId || revision.command.payload?.proposalId === source.proposalId));
  invariant(sourceRevision, 'LEGACY_REVIEW_HISTORY_MISSING', 'The exact proposal submission is unavailable.');
  const original = proposalAt(sourceRevision.snapshot, source), before = document.revisions.find(revision => revision.number === sourceRevision.number - 1);
  invariant(before, 'LEGACY_REVIEW_HISTORY_MISSING', 'The original proposal basis is unavailable.');
  const reviewId = legacyReviewId(document.projectId, source);
  invariant(!head.snapshot.reviewLibrary?.groups.some(group => group.reviewId === reviewId), 'LEGACY_REVIEW_ID_CONFLICT',
    'This legacy Review identity is already occupied; the original proposal remains unchanged.', { reviewId });
  const authoredItems = source.contentKind === 'image' ? original.items.map(item => ({ itemId: item.itemId, contentKind: 'image', dependsOn: [], payload: {
    assetId: item.assetId, operation: item.operation, expectedAssetVersion: item.expectedAssetVersion ?? 0,
    expectedMetadataVersion: item.expectedMetadataVersion ?? 0, name: item.name, kind: item.kind, metadata: structuredClone(Object.fromEntries(Object.entries(item.metadata).filter(([key]) => !['pixelSize', 'pivot'].includes(key)))),
    image: { mode: 'saved-slice', sliceId: item.sliceBinding.sliceId, expectedSliceVersion: item.sliceBinding.sliceVersion },
  } })) : [{ itemId: 'item.content', contentKind: source.contentKind, dependsOn: [], payload: structuredClone(original.content) }];
  invariant(!(original.items ?? [original.validated]).some(item => item.findings?.some(finding => finding.severity === 'ERROR')),
    'LEGACY_REVIEW_CONTENT_INVALID', 'Correct the technical findings and submit revised content before using this Review.');
  const items = normalizeReviewItems(authoredItems);
  let scratch = structuredClone(before.snapshot);
  const historicalDocument = { projectId: document.projectId, revisions: document.revisions.filter(revision => revision.number <= before.number) };
  const command = { type: 'review.accept', projectId: document.projectId, baseRevision: before.number,
    actor: { id: before.snapshot.project.ownerId, kind: 'human' }, taskId: null, payload: { reviewId, expectedReviewVersion: 0 } };
  for (const item of items) {
    const applied = applyItem({ item, command, snapshot: scratch, document: historicalDocument, now: sourceRevision.committedAt });
    invariant(applied?.record && !(applied.record.findings ?? []).some(finding => finding.severity === 'ERROR'), 'LEGACY_REVIEW_CONTENT_INVALID', 'The exact legacy proposal has technical findings.');
    item.proposedRecord = structuredClone(applied.record); scratch = applied.snapshot;
  }
  const proposer = source.contentKind === 'image' ? { actor: structuredClone(original.proposer.actor), taskId: original.proposer.taskId ?? null }
    : { actor: { id: original.proposerActorId, kind: original.proposerActorKind }, taskId: original.proposerTaskId ?? null };
  const versions = new Map();
  for (const revision of document.revisions) {
    const entry = proposalAt(revision.snapshot, source);
    if (entry && entry.proposalVersion <= source.expectedProposalVersion && !versions.has(entry.proposalVersion)) versions.set(entry.proposalVersion, {
      proposalVersion: entry.proposalVersion, revision: revision.number, status: entry.state ?? entry.status,
      createdAt: entry.createdAt ?? entry.submittedAt, updatedBy: entry.updatedBy ?? entry.proposer?.actor.id,
      feedback: structuredClone(entry.feedback ?? null), decision: structuredClone(entry.decision ?? null),
    });
  }
  // Agent resubmissions carry the previous feedback text, but do not author it.
  const feedbackVersion = [...versions.values()].reverse().find(entry => entry.status === 'CHANGES_REQUESTED'
    && entry.decision === 'REQUEST_CHANGES' && entry.feedback);
  return { schemaVersion: 1, reviewId, reviewVersion: 0, previousReviewVersion: null, contentVersion: 1,
    title: items.length === 1 ? items[0].payload.name : `${items.length} proposed Assets`, status,
    proposer, items, createdRevision: sourceRevision.number, createdAt: sourceRevision.committedAt, updatedBy: proposal.updatedBy ?? proposer.actor.id,
    feedback: feedbackVersion ? { summary: feedbackVersion.feedback, itemComments: [], reviewVersion: 0, contentVersion: 1,
      actorId: feedbackVersion.updatedBy, createdAt: feedbackVersion.createdAt, revision: feedbackVersion.revision } : null,
    decision: null, legacySource: source,
    legacyProvenance: { sourceRevision: sourceRevision.number, sourceFingerprint: fingerprint(original),
      viewedProposalRevision: document.revisions.find(revision => proposalAt(revision.snapshot, source)?.proposalVersion === source.expectedProposalVersion)?.number,
      viewedProposalFingerprint: fingerprint(proposal), history: [...versions.values()] },
  };
}
