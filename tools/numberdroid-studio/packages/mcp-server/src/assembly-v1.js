import { StudioError } from '../../domain/src/errors.js';

export function validateAssemblyNegotiation(value, projectId) {
  const keys = ['schemaVersion', 'profile', 'projectId', 'storeSchemaVersion', 'sharedHead', 'toolCount', 'resourceTemplateCount'];
  if (!value || typeof value !== 'object' || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))
    || value.schemaVersion !== 1 || value.profile !== 'assembly-v1' || value.projectId !== projectId
    || ![16, 17, 18].includes(value.storeSchemaVersion) || value.sharedHead !== true || value.toolCount !== 21 || value.resourceTemplateCount !== 5) {
    throw new StudioError('ASSEMBLY_NEGOTIATION_REQUIRED', 'Assembly profile requires positive shared-head compatible SQLite v16/v17/v18 gateway negotiation.');
  }
  return Object.freeze(structuredClone(value));
}
