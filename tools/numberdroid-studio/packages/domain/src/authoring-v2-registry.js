import {
  PROCESSING_ADOPTION_PREFLIGHT_OPERATION_ID,
  PROCESSING_ADOPTION_PREFLIGHT_OPERATION_VERSION,
  validateProcessingAdoptionCapabilityManifest,
} from './processing-adoption-preflight.js';
import {
  PROCESSING_RESULT_ADOPTION_COMMAND_TYPE,
  PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE,
} from './processing-result-adoption.js';
import { KNOWN_GRANT_SCOPES } from './command-catalog.js';
import { invariant } from './errors.js';

export const AUTHORING_V2_SCHEMA_VERSION = 2;
export const AUTHORING_V2_FEATURE_ID = 'studio.authoring-v2';
export const AUTHORING_V2_PROCESSING_RESULT_ADOPTION_TOOL = 'studio_processing_result_adopt';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const processingResultAdoptionFeature = {
  schemaVersion: 1,
  kind: 'studio.authoring-v2-command-feature',
  commandType: PROCESSING_RESULT_ADOPTION_COMMAND_TYPE,
  toolName: AUTHORING_V2_PROCESSING_RESULT_ADOPTION_TOOL,
  description: 'Dry-run or atomically adopt one exact processing result as a branch-local DRAFT Asset.',
  requiredScope: PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE,
  ownerOnly: false,
  requiresTaskBranch: true,
  requiresProcessingResultAdoptionStore: true,
  requiredObjectScopes: ['project', 'asset'],
  autoAcceptAllowed: false,
  capabilityOperation: {
    operationId: PROCESSING_ADOPTION_PREFLIGHT_OPERATION_ID,
    operationVersion: PROCESSING_ADOPTION_PREFLIGHT_OPERATION_VERSION,
  },
};

export const AUTHORING_V2_COMMAND_FEATURES = deepFreeze([
  processingResultAdoptionFeature,
]);

export const AUTHORING_V2_PRIVATE_GRANT_SCOPES = deepFreeze([
  PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE,
]);

export function validateAuthoringV2CapabilityManifest(value) {
  const manifest = validateProcessingAdoptionCapabilityManifest(value);
  invariant(
    manifest.profileVersion === 2,
    'AUTHORING_V2_CAPABILITY_MANIFEST_INVALID',
    'Authoring v2 requires an exact profile-v2 processing-adoption capability manifest.',
  );
  return manifest;
}

export function listAuthoringV2GrantScopes() {
  return structuredClone([...KNOWN_GRANT_SCOPES, ...AUTHORING_V2_PRIVATE_GRANT_SCOPES]);
}
