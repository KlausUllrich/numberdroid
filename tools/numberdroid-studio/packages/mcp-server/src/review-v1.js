import { StudioError } from '../../domain/src/errors.js';

export function validateReviewNegotiation(value, projectId) {
  const keys = ['schemaVersion', 'profile', 'projectId', 'storeSchemaVersion', 'sharedHead', 'toolCount', 'resourceTemplateCount'];
  if (!value || typeof value !== 'object' || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))
    || value.schemaVersion !== 1 || value.profile !== 'review-v1' || value.projectId !== projectId || value.storeSchemaVersion !== 18
    || value.sharedHead !== true || value.toolCount !== 27 || value.resourceTemplateCount !== 8) {
    throw new StudioError('REVIEW_NEGOTIATION_REQUIRED', 'Shared Review requires positive shared-head SQLite v18 gateway negotiation.');
  }
  return Object.freeze(structuredClone(value));
}

export function assertReviewProjectContent(value) {
  if (value?.snapshot?.reviewLibrary?.groups?.length) throw new StudioError('REVIEW_NEGOTIATION_REQUIRED', 'This project contains shared Review records. Select review-v1 to read the complete snapshot.');
  return value;
}
