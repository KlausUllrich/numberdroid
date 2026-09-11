import { invariant } from '../../domain/src/errors.js';
import { requireId, requireInteger, requireString } from '../../domain/src/validation.js';
import { exactReviewFields, normalizeReviewItems, normalizeReviewFeedback, reviewIds, reviewTopologicalItems, assertReviewReferenceDependencies } from '../../domain/src/review-definition.js';
import { fingerprint } from './value-utils.js';

const libraries = { image: 'assetLibrary', animation: 'clipLibrary', assembly: 'assemblyLibrary' };
const open = group => ['PENDING', 'CHANGES_REQUESTED'].includes(group.status);
const remaining = group => group.items.filter(item => item.status === 'PENDING').map(item => item.itemId);
const headRecord = (snapshot, item) => snapshot[libraries[item.contentKind]]?.assets.find(record => record.assetId === item.payload.assetId) ?? null;
function exactRecord(document, item, target) {
  if (!target || target.assetVersion === 0) return null;
  for (const revision of document.revisions) {
    const record = revision.snapshot[libraries[item.contentKind]]?.assets.find(candidate => candidate.assetId === target.assetId && candidate.assetVersion === target.assetVersion && candidate.metadataVersion === target.metadataVersion);
    if (record) return structuredClone(record);
  }
  return null;
}
const pin = (item, record) => ({ itemId: item.itemId, contentKind: item.contentKind, assetId: record.assetId, assetVersion: record.assetVersion, metadataVersion: record.metadataVersion });
const semanticRecord = record => Object.fromEntries(['assetId', 'assetVersion', 'metadataVersion', 'name', 'kind', 'metadata', 'metadataFingerprint', 'findings', 'sliceBinding', 'clip', 'assembly'].filter(key => Object.hasOwn(record, key)).map(key => [key, record[key]]));
function groupHead(snapshot, reviewId, expected) {
  const group = snapshot.reviewLibrary?.groups.find(entry => entry.reviewId === reviewId);
  invariant(group && group.reviewVersion === expected, 'REVIEW_VERSION_CONFLICT', 'Open the latest Review version before saving this decision.', { reviewId, expectedReviewVersion: expected, actualReviewVersion: group?.reviewVersion });
  return group;
}
function validateCandidate(item, command, snapshot, document, now, applyItem) {
  invariant(typeof applyItem === 'function', 'REVIEW_ADAPTER_REQUIRED', 'Review requires its typed content validator.');
  if (item.payload.operation === 'create') {
    const assetId = item.payload.assetId;
    invariant(!(snapshot.assets ?? []).some(record => (record.id ?? record.assetId) === assetId), 'REVIEW_TARGET_EXISTS', 'A legacy Asset already uses this identity.', { itemId: item.itemId, assetId });
    for (const [kind, library] of Object.entries(libraries)) if (kind !== item.contentKind) invariant(!(snapshot[library]?.assets ?? []).some(record => record.assetId === assetId), 'REVIEW_TARGET_EXISTS', 'Another content kind already uses this Asset identity.', { itemId: item.itemId, assetId });
  }
  const applied = applyItem({ item, command, snapshot, document, now });
  invariant(applied?.record && applied?.snapshot, 'REVIEW_ADAPTER_INVALID', 'The typed content validator returned no candidate.');
  const errors = (applied.record.findings ?? []).filter(finding => finding.severity === 'ERROR');
  invariant(errors.length === 0, 'REVIEW_CONTENT_INVALID', 'Correct technical findings before requesting owner review.', { itemId: item.itemId, findings: errors });
  invariant(applied.record.assetId === item.payload.assetId, 'REVIEW_ADAPTER_INVALID', 'The typed candidate target differs from its Review item.');
  return applied;
}
function selectionItems(group, requested) {
  const ids = reviewIds(requested, 'selectedItemIds', { min: 1 });
  const selected = new Set(ids), byId = new Map(group.items.map(item => [item.itemId, item]));
  for (const itemId of ids) invariant(byId.get(itemId)?.status === 'PENDING', 'REVIEW_SELECTION_INVALID', 'Select only remaining Review items.', { itemId });
  const ordered = reviewTopologicalItems(group.items);
  for (const item of ordered.filter(item => selected.has(item.itemId))) {
    for (const dependency of item.dependsOn) invariant(byId.get(dependency).status === 'ACCEPTED' || selected.has(dependency), 'REVIEW_DEPENDENCY_REQUIRED', 'Include the pending dependency before accepting this item.', { itemId: item.itemId, dependency });
  }
  return ordered.filter(item => selected.has(item.itemId));
}
function decision(group, command, now, action, selectedItemIds = [], accepted = []) {
  return { action, selectedItemIds, accepted, remainingItemIds: remaining(group), reviewVersion: group.reviewVersion,
    revision: command.baseRevision + 1, actorId: command.actor.id, createdAt: now };
}
export function applyReviewCommand(command, next, document, now, { applyItem } = {}) {
  const payload = command.payload, submit = command.type === 'review.proposal.submit';
  const allowed = {
    'review.proposal.submit': ['reviewId', 'expectedReviewVersion', 'title', 'items'],
    'review.feedback.save': ['reviewId', 'expectedReviewVersion', 'summary', 'itemComments', 'confirmed'],
    'review.accept': ['reviewId', 'expectedReviewVersion', 'selectedItemIds', 'confirmed'],
    'review.discard': ['reviewId', 'expectedReviewVersion', 'confirmed'],
  };
  invariant(allowed[command.type], 'COMMAND_UNSUPPORTED', 'Unknown Review command.');
  exactReviewFields(payload, allowed[command.type]);
  const reviewId = requireId(payload.reviewId, 'reviewId');
  const expected = requireInteger(payload.expectedReviewVersion, 'expectedReviewVersion', { min: submit ? 0 : 1 });
  const prior = expected === 0 ? null : groupHead(next, reviewId, expected);
  if (!submit) {
    invariant(command.actor.kind === 'human' && command.actor.id === next.project.ownerId && payload.confirmed === true, 'FORBIDDEN', 'Only the owner may confirm a Review decision.');
    invariant(open(prior), 'REVIEW_CLOSED', 'Completed Review decisions are immutable.');
  }
  const versionFields = { reviewVersion: expected + 1, previousReviewVersion: prior?.reviewVersion ?? null, createdRevision: command.baseRevision + 1, createdAt: now, updatedBy: command.actor.id };
  let group, accepted = [];
  if (submit) {
    invariant(!next.reviewLibrary?.groups.some(entry => entry.reviewId === reviewId) || prior, 'REVIEW_EXISTS', 'This Review ID already exists.');
    if (prior) {
      invariant(prior.status === 'CHANGES_REQUESTED', 'REVIEW_REVISION_NOT_REQUESTED', 'Revise only the exact changes-requested Review.');
      invariant(prior.proposer.actor.id === command.actor.id && prior.proposer.actor.kind === command.actor.kind && prior.proposer.taskId === command.taskId, 'FORBIDDEN', 'Only the original proposer and task may revise this Review.');
    }
    const supplied = normalizeReviewItems(payload.items);
    let items = supplied;
    if (prior) {
      const requested = new Map(supplied.map(item => [item.itemId, item]));
      invariant(supplied.length === remaining(prior).length && supplied.every(item => prior.items.some(old => old.status === 'PENDING' && old.itemId === item.itemId && old.contentKind === item.contentKind && old.payload.assetId === item.payload.assetId)), 'REVIEW_ACCEPTED_IMMUTABLE', 'Revise all remaining stable items; accepted items and target identities cannot be rewritten.');
      items = prior.items.map(old => old.status === 'ACCEPTED' ? structuredClone(old) : requested.get(old.itemId));
    }
    let scratch = structuredClone(next);
    for (const item of reviewTopologicalItems(items)) {
      if (item.status === 'ACCEPTED') continue;
      const applied = validateCandidate(item, command, scratch, document, now, applyItem);
      scratch = applied.snapshot; item.proposedRecord = structuredClone(applied.record);
    }
    assertReviewReferenceDependencies(items);
    group = { schemaVersion: 1, reviewId, ...versionFields, contentVersion: (prior?.contentVersion ?? 0) + 1,
      title: requireString(payload.title, 'title', { max: 160 }), status: 'PENDING',
      proposer: prior?.proposer ?? { actor: structuredClone(command.actor), taskId: command.taskId ?? null },
      items, feedback: prior?.feedback ? structuredClone(prior.feedback) : null, decision: prior?.decision ? structuredClone(prior.decision) : null };
  } else {
    group = { ...structuredClone(prior), ...versionFields };
    if (command.type === 'review.feedback.save') {
      group.feedback = { ...normalizeReviewFeedback(payload, new Set(remaining(group))), reviewVersion: group.reviewVersion, contentVersion: group.contentVersion,
        actorId: command.actor.id, createdAt: now, revision: command.baseRevision + 1 };
      group.status = 'CHANGES_REQUESTED';
      group.decision = decision(group, command, now, 'REQUEST_CHANGES');
    } else if (command.type === 'review.accept') {
      // A private candidate snapshot keeps this pure even when a later item fails.
      let scratch = structuredClone(next);
      const selected = selectionItems(group, payload.selectedItemIds);
      for (const item of selected) {
        const applied = validateCandidate(item, command, scratch, document, now, applyItem);
        invariant(fingerprint(semanticRecord(applied.record)) === fingerprint(semanticRecord(item.proposedRecord)), 'REVIEW_CONTENT_CHANGED', 'The proposed content no longer resolves to the exact reviewed version.', { itemId: item.itemId });
        scratch = applied.snapshot;
        const origin = { reviewId, reviewVersion: group.reviewVersion, itemId: item.itemId };
        applied.record.review = origin; applied.record.proposal = null;
        const saved = headRecord(scratch, item);
        invariant(saved && saved.assetVersion === applied.record.assetVersion && saved.metadataVersion === applied.record.metadataVersion, 'REVIEW_ADAPTER_INVALID', 'The typed saved candidate does not match its result.');
        saved.review = structuredClone(origin); saved.proposal = null;
        item.status = 'ACCEPTED';
        const receipt = pin(item, applied.record); accepted.push(receipt);
        item.accepted = { assetId: receipt.assetId, assetVersion: receipt.assetVersion, metadataVersion: receipt.metadataVersion, revision: command.baseRevision + 1, reviewVersion: group.reviewVersion };
      }
      next = scratch;
      if (!remaining(group).length) group.status = 'ACCEPTED';
      group.decision = decision(group, command, now, 'ACCEPT', selected.map(item => item.itemId), accepted);
    } else {
      for (const item of group.items) if (item.status === 'PENDING') item.status = 'DISCARDED';
      group.status = 'DISCARDED'; group.decision = decision(group, command, now, 'DISCARD');
    }
  }
  const library = next.reviewLibrary ??= { schemaVersion: 1, groups: [] };
  const index = library.groups.findIndex(entry => entry.reviewId === reviewId);
  if (index < 0) library.groups.push(group); else library.groups[index] = group;
  const result = { reviewId, reviewVersion: group.reviewVersion, contentVersion: group.contentVersion, status: group.status, accepted, remainingItemIds: remaining(group) };
  return { snapshot: next, result, summary: `${group.title}: ${submit ? 'submitted for review' : command.type === 'review.feedback.save' ? 'changes requested' : command.type === 'review.accept' ? `${accepted.length} change(s) accepted` : 'remaining changes discarded'}.`,
    changes: [{ entityType: 'review', entityId: reviewId, operation: command.type.split('.').at(-1) }, ...accepted.map(receipt => ({ entityType: receipt.contentKind === 'image' ? 'asset_v2' : receipt.contentKind === 'animation' ? 'clip' : 'assembly', entityId: receipt.assetId, operation: receipt.assetVersion === 1 ? 'created' : 'versioned' }))] };
}

function reviewHistory(document, reviewId) {
  const versions = new Map();
  for (const revision of document.revisions) {
    const group = revision.snapshot.reviewLibrary?.groups.find(entry => entry.reviewId === reviewId);
    if (group && !versions.has(group.reviewVersion)) versions.set(group.reviewVersion, group);
  }
  return [...versions.values()];
}
const conflict = error => ({ code: error?.code ?? 'REVIEW_PREVIEW_UNAVAILABLE', message: error?.message ?? 'The exact preview is unavailable.', ...(error?.details ? { details: structuredClone(error.details) } : {}) });
export function queryReviewDocument(request, document, { applyItem, resolveItem } = {}) {
  exactReviewFields(request, ['schemaVersion', 'projectId', 'reviewId', 'reviewVersion', 'limit', 'includeHistory', 'selectedItemIds', 'expectedRevision', 'selection'], 'Review query');
  invariant(request.schemaVersion === 1, 'SCHEMA_VERSION_UNSUPPORTED', 'Review queries require schemaVersion 1.');
  invariant(requireId(request.projectId, 'projectId') === document.projectId, 'REVIEW_PROJECT_MISMATCH', 'The Review query belongs to another project.');
  const head = document.revisions.at(-1);
  if (request.expectedRevision !== undefined) invariant(request.expectedRevision === head.number, 'REVISION_CONFLICT', 'Recheck the current project revision.');
  const limit = request.limit === undefined ? 25 : requireInteger(request.limit, 'limit', { min: 1, max: 100 });
  if (request.includeHistory !== undefined) invariant(typeof request.includeHistory === 'boolean', 'VALIDATION_ERROR', 'includeHistory must be boolean.');
  const reviewId = request.reviewId === undefined ? null : requireId(request.reviewId, 'reviewId');
  invariant(request.reviewVersion === undefined || reviewId, 'VALIDATION_ERROR', 'Exact historical reads require a Review ID.');
  if (request.reviewVersion !== undefined) requireInteger(request.reviewVersion, 'reviewVersion', { min: 1 });
  if (request.selectedItemIds !== undefined) { invariant(reviewId, 'VALIDATION_ERROR', 'Selection preview requires a Review ID.'); reviewIds(request.selectedItemIds, 'selectedItemIds'); }
  if (request.selection !== undefined) {
    exactReviewFields(request.selection, ['stateId', 'variantId'], 'Review preview selection');
    for (const key of Object.keys(request.selection)) requireId(request.selection[key], key);
  }
  let heads = head.snapshot.reviewLibrary?.groups ?? [];
  if (reviewId) { heads = heads.filter(group => group.reviewId === reviewId); invariant(heads.length === 1, 'REVIEW_NOT_FOUND', 'The requested Review does not exist.'); }
  let responseBytes = 0;
  const groups = heads.slice(0, limit).map(latest => {
    const history = reviewHistory(document, latest.reviewId);
    const original = request.reviewVersion === undefined ? latest : history.find(group => group.reviewVersion === request.reviewVersion);
    invariant(original, 'REVIEW_NOT_FOUND', 'The requested immutable Review version does not exist.');
    const group = structuredClone(original), isLatest = group.reviewVersion === latest.reviewVersion;
    const prospectiveAssets = group.items.map(item => item.proposedRecord).filter(Boolean);
    const items = group.items.map(item => {
      const currentTarget = structuredClone(headRecord(head.snapshot, item));
      const current = exactRecord(document, item, { assetId: item.payload.assetId, assetVersion: item.payload.expectedAssetVersion, metadataVersion: item.payload.expectedMetadataVersion });
      const acceptedRecord = exactRecord(document, item, item.accepted);
      const proposed = structuredClone(item.proposedRecord), conflicts = [];
      if (item.status === 'PENDING') {
        const expected = item.payload;
        if (expected.operation === 'create' ? Boolean(currentTarget) : !currentTarget || currentTarget.assetVersion !== expected.expectedAssetVersion || currentTarget.metadataVersion !== expected.expectedMetadataVersion) conflicts.push({ code: 'REVIEW_TARGET_CHANGED', message: 'The saved target changed after this proposal was prepared.' });
      }
      let resolvedCurrent = null, resolvedProposed = null;
      if (resolveItem) {
        if (current) try { resolvedCurrent = resolveItem({ item, record: current, document, prospectiveAssets: [], selection: request.selection }); } catch (error) { conflicts.push(conflict(error)); }
        if (proposed) try { resolvedProposed = resolveItem({ item, record: proposed, document, prospectiveAssets, selection: request.selection }); } catch (error) { conflicts.push(conflict(error)); }
      }
      return { ...item, current, currentTarget, proposed, acceptedRecord, proposedIsSaved: false, conflicts, ...(resolveItem ? { resolvedCurrent, resolvedProposed } : {}) };
    });
    const selectedItemIds = request.selectedItemIds ?? remaining(group), findings = [];
    if (!isLatest) findings.push({ code: 'REVIEW_VERSION_CONFLICT', message: 'Review the latest proposal before deciding or submitting feedback.' });
    if (!open(group)) findings.push({ code: 'REVIEW_CLOSED', message: 'This Review is complete.' });
    try {
      const selected = selectionItems(group, selectedItemIds);
      let scratch = structuredClone(head.snapshot);
      for (const item of selected) {
        if (applyItem) {
          const command = { type: 'review.accept', actor: { kind: 'human', id: head.snapshot.project.ownerId }, projectId: document.projectId, baseRevision: head.number, taskId: null, payload: { reviewId: group.reviewId, expectedReviewVersion: group.reviewVersion } };
          const applied = validateCandidate(item, command, scratch, document, head.committedAt, applyItem);
          invariant(fingerprint(semanticRecord(applied.record)) === fingerprint(semanticRecord(item.proposedRecord)), 'REVIEW_CONTENT_CHANGED', 'The candidate no longer matches its reviewed content.', { itemId: item.itemId });
          scratch = applied.snapshot;
        }
        findings.push(...items.find(entry => entry.itemId === item.itemId).conflicts);
      }
    } catch (error) { findings.push(conflict(error)); }
    const value = { ...group, items, isLatest, latestReviewVersion: latest.reviewVersion,
      nextActor: !open(group) ? null : group.status === 'CHANGES_REQUESTED' ? structuredClone(group.proposer.actor) : { kind: 'human', id: head.snapshot.project.ownerId },
      eligibility: { selectedItemIds, canAccept: findings.length === 0, findings },
      ...(request.includeHistory ? { history: history.slice(-limit).map(version => ({ reviewVersion: version.reviewVersion, contentVersion: version.contentVersion, status: version.status, createdRevision: version.createdRevision, createdAt: version.createdAt, updatedBy: version.updatedBy, feedback: structuredClone(version.feedback), decision: structuredClone(version.decision) })) } : {}) };
    responseBytes += Buffer.byteLength(JSON.stringify(value));
    invariant(responseBytes <= 16 * 1024 * 1024, 'REVIEW_RESPONSE_TOO_LARGE', 'Query one Review or fewer history entries to stay within the 16 MiB response bound.');
    return value;
  });
  const response = { schemaVersion: 1, projectId: document.projectId, revision: head.number, groups };
  invariant(Buffer.byteLength(JSON.stringify(response)) <= 16 * 1024 * 1024, 'REVIEW_RESPONSE_TOO_LARGE', 'Query one Review or fewer history entries to stay within the 16 MiB response bound.');
  return response;
}
