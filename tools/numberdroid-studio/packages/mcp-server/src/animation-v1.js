import { StudioError } from '../../domain/src/errors.js';
export function validateAnimationNegotiation(value, projectId) {
  const keys = ['schemaVersion', 'profile', 'projectId', 'storeSchemaVersion', 'sharedHead', 'toolCount', 'resourceTemplateCount'];
  if (!value || typeof value !== 'object' || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value,key))
    || value.schemaVersion !== 1 || value.profile !== 'animation-v1' || value.projectId !== projectId || value.storeSchemaVersion !== 17
    || value.sharedHead !== true || value.toolCount !== 25 || value.resourceTemplateCount !== 7) {
    throw new StudioError('ANIMATION_NEGOTIATION_REQUIRED', 'Animation profile requires positive shared-head SQLite v17 gateway negotiation.');
  }
  return Object.freeze(structuredClone(value));
}
