import { AUTHORING_V2_PRIVATE_GRANT_SCOPES } from './authoring-v2-registry.js';
import { KNOWN_GRANT_SCOPES } from './command-catalog.js';

export const LEVEL_CANDIDATE_CREATE_COMMAND_TYPE = 'level.candidate.create';
export const LEVEL_CANDIDATE_CREATE_REQUIRED_SCOPE = 'level.candidate.create';

export const A4C_PRIVATE_GRANT_SCOPES = Object.freeze([
  ...AUTHORING_V2_PRIVATE_GRANT_SCOPES,
  LEVEL_CANDIDATE_CREATE_REQUIRED_SCOPE,
  'task.child.derive',
].sort());

export function listA4cGrantScopes() {
  return structuredClone([...KNOWN_GRANT_SCOPES, ...A4C_PRIVATE_GRANT_SCOPES]);
}
