import { invariant } from './errors.js';
import { requireId, requireInteger, requireRecord, requireString, requireEnum } from './validation.js';
import { assemblyContentSlots, assemblyAssetKey } from './assembly-geometry.js';

export const REVIEW_MAX_ITEMS = 64;
export function exactReviewFields(value, fields, label = 'Review request') {
  requireRecord(value, label);
  invariant(new TextEncoder().encode(JSON.stringify(value)).length <= 1024 * 1024, 'REVIEW_TOO_LARGE', 'Review requests are limited to 1 MiB.');
  for (const field of Object.keys(value)) invariant(fields.includes(field), 'VALIDATION_ERROR', `${label} contains unsupported field ${field}.`, { field });
}
export function reviewIds(value, label, { min = 0 } = {}) {
  invariant(Array.isArray(value) && value.length >= min && value.length <= REVIEW_MAX_ITEMS, 'VALIDATION_ERROR', `${label} requires ${min} to 64 item IDs.`);
  const ids = value.map(id => requireId(id, label));
  invariant(new Set(ids).size === ids.length, 'REVIEW_DUPLICATE_ITEM', `${label} must contain unique item IDs.`);
  return ids;
}
export function normalizeReviewItems(items) {
  invariant(Array.isArray(items) && items.length >= 1 && items.length <= REVIEW_MAX_ITEMS, 'REVIEW_ITEM_LIMIT', 'A Review requires 1 to 64 remaining items.');
  const normalized = items.map(item => {
    exactReviewFields(item, ['itemId', 'contentKind', 'payload', 'dependsOn'], 'Review item');
    requireRecord(item.payload, 'Review item payload');
    requireId(item.payload.assetId, 'assetId');
    requireEnum(item.payload.operation, 'operation', ['create', 'update']);
    requireInteger(item.payload.expectedAssetVersion, 'expectedAssetVersion', { min: 0 });
    requireInteger(item.payload.expectedMetadataVersion, 'expectedMetadataVersion', { min: 0 });
    return { itemId: requireId(item.itemId, 'itemId'), contentKind: requireEnum(item.contentKind, 'contentKind', ['image', 'animation', 'assembly']),
      payload: structuredClone(item.payload), dependsOn: reviewIds(item.dependsOn, 'dependsOn'), status: 'PENDING', proposedRecord: null, accepted: null };
  });
  invariant(new Set(normalized.map(item => item.itemId)).size === normalized.length, 'REVIEW_DUPLICATE_ITEM', 'Review item IDs must be unique.');
  invariant(new Set(normalized.map(item => item.payload.assetId)).size === normalized.length, 'REVIEW_DUPLICATE_TARGET', 'Each Review item must have a different target Asset.');
  return normalized;
}
export function reviewTopologicalItems(items) {
  const byId = new Map(items.map(item => [item.itemId, item])), visited = new Set(), visiting = new Set(), result = [];
  invariant(byId.size === items.length && items.length <= REVIEW_MAX_ITEMS, 'REVIEW_DUPLICATE_ITEM', 'Review items must be unique and bounded.');
  const visit = item => {
    invariant(!visiting.has(item.itemId), 'REVIEW_DEPENDENCY_CYCLE', 'Review dependencies contain a cycle.', { itemId: item.itemId });
    if (visited.has(item.itemId)) return;
    visiting.add(item.itemId);
    for (const dependency of item.dependsOn) {
      invariant(byId.has(dependency), 'REVIEW_DEPENDENCY_MISSING', 'A dependency does not belong to this Review.', { itemId: item.itemId, dependency });
      visit(byId.get(dependency));
    }
    visiting.delete(item.itemId); visited.add(item.itemId); result.push(item);
  };
  for (const item of items) visit(item);
  return result;
}
export function assertReviewReferenceDependencies(items) {
  const producers = new Map(items.filter(item => item.proposedRecord).map(item => [assemblyAssetKey(item.proposedRecord), item]));
  for (const item of items) {
    if (item.contentKind !== 'assembly') continue;
    for (const slot of assemblyContentSlots(item.proposedRecord.assembly)) {
      if (slot.content.kind === 'none') continue;
      const dependency = producers.get(assemblyAssetKey(slot.content.asset));
      if (!dependency) continue;
      invariant(dependency.contentKind === slot.content.kind, 'REVIEW_DEPENDENCY_KIND', 'A component reference has the wrong content kind.');
      invariant(item.dependsOn.includes(dependency.itemId), 'REVIEW_DEPENDENCY_UNDECLARED', 'Declare the Review item that produces this exact component version.', { itemId: item.itemId, dependency: dependency.itemId });
    }
  }
}
export function normalizeReviewFeedback(payload, pendingIds) {
  const summary = requireString(payload.summary, 'summary', { max: 4000 });
  invariant(Array.isArray(payload.itemComments) && payload.itemComments.length <= REVIEW_MAX_ITEMS, 'VALIDATION_ERROR', 'Item comments must be a bounded array.');
  const seen = new Set();
  const itemComments = payload.itemComments.map(comment => {
    exactReviewFields(comment, ['itemId', 'text'], 'Item comment');
    const itemId = requireId(comment.itemId, 'itemId');
    invariant(pendingIds.has(itemId) && !seen.has(itemId), 'REVIEW_FEEDBACK_ITEM', 'Feedback must name each remaining item at most once.', { itemId });
    seen.add(itemId); return { itemId, text: requireString(comment.text, 'text', { max: 2000 }) };
  });
  return { summary, itemComments };
}
