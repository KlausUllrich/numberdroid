import { assertReviewProjectContent } from './review-v1.js';
import { StudioError } from '../../domain/src/errors.js';
export function validateAnimationNegotiation(value, projectId) {
  const keys = ['schemaVersion', 'profile', 'projectId', 'storeSchemaVersion', 'sharedHead', 'toolCount', 'resourceTemplateCount'];
  if (!value || typeof value !== 'object' || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value,key))
    || value.schemaVersion !== 1 || value.profile !== 'animation-v1' || value.projectId !== projectId || ![17, 18].includes(value.storeSchemaVersion)
    || value.sharedHead !== true || value.toolCount !== 25 || value.resourceTemplateCount !== 7) {
    throw new StudioError('ANIMATION_NEGOTIATION_REQUIRED', 'Animation profile requires positive shared-head SQLite v17/v18 gateway negotiation.');
  }
  return Object.freeze(structuredClone(value));
}


export function assertLegacyProjectContent(value) {
  assertReviewProjectContent(value);
  const snapshot = value?.snapshot;
  if ((snapshot?.clipLibrary?.assets?.length ?? 0) || (snapshot?.clipLibrary?.proposals?.length ?? 0)
    || snapshot?.assemblyLibrary?.assets?.some(asset => asset.assembly?.schemaVersion === 2)
    || snapshot?.assemblyLibrary?.proposals?.some(proposal => proposal.content?.assembly?.schemaVersion === 2)) {
    throw new StudioError('ANIMATION_NEGOTIATION_REQUIRED', 'This project contains Animation content. Select the animation-v1 profile to read its complete snapshot.');
  }
  return value;
}
