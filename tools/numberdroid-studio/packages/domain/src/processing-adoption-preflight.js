import { createHash } from 'node:crypto';
import { types as utilTypes } from 'node:util';
import {
  assetInputSelectionSha256,
  validateAssetInputSelectionForProcessingResult,
} from './asset-input-selection.js';
import { invariant } from './errors.js';
import {
  processingRecipeSha256,
  validateProcessingRecipe,
} from './processing-recipe.js';
import {
  processingResultSha256,
  validateProcessingResultForRecipe,
} from './processing-result.js';
import {
  PROJECT_CAPABILITY_MANIFEST_KIND,
  PROJECT_CAPABILITY_MANIFEST_SCHEMA_VERSION,
  validateProjectCapabilityManifest,
} from './project-capability-manifest.js';

export const PROCESSING_ADOPTION_PREFLIGHT_SCHEMA_VERSION = 1;
export const PROCESSING_ADOPTION_PREFLIGHT_REQUEST_KIND = 'studio.processing-adoption-preflight-request';
export const PROCESSING_ADOPTION_PREFLIGHT_RECEIPT_KIND = 'studio.processing-adoption-preflight-receipt';
export const PROCESSING_ADOPTION_PREFLIGHT_OPERATION_ID = 'studio.asset.processing-result-adoption-preflight';
export const PROCESSING_ADOPTION_PREFLIGHT_OPERATION_VERSION = 1;
export const PROCESSING_ADOPTION_PREFLIGHT_ARTIFACT_ROLES = Object.freeze([
  'recipe-input',
  'selected-output',
]);

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const TOKEN_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;
const NAMESPACED_ID_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+$/;
const STABLE_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@+-]{0,255}$/;
const MEDIA_TYPE_PATTERN = /^[a-z][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/;
const CAS_URI_PATTERN = /^studio:\/\/artifacts\/sha256\/([a-f0-9]{64})$/;
const BLOCKER_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,127}$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

const REQUIRED_MODULES = Object.freeze([
  Object.freeze({ id: 'studio.asset', version: 'v2' }),
  Object.freeze({ id: 'studio.image-processing', version: 'v1' }),
]);
const REQUIRED_INPUT_FORMATS = Object.freeze([
  Object.freeze({ id: 'studio.asset-input-selection', version: 1, mediaType: 'application/json' }),
  Object.freeze({ id: 'studio.processing-recipe', version: 1, mediaType: 'application/json' }),
  Object.freeze({ id: 'studio.processing-result', version: 1, mediaType: 'application/json' }),
]);
const REQUIRED_OUTPUT_FORMATS = Object.freeze([
  Object.freeze({ id: 'studio.processing-adoption-preflight-receipt', version: 1, mediaType: 'application/json' }),
]);
const ASSET_IDENTITY_STATES = Object.freeze([
  'UNUSED',
  'LEGACY_OCCUPIED',
  'V2_HEAD',
  'AMBIGUOUS',
]);
const ASSET_CHECK_STATUSES = Object.freeze([
  'NOT_CHECKED',
  'MATCHED',
  'PROJECT_REVISION_STALE',
  'TARGET_OCCUPIED',
  'TARGET_NOT_FOUND',
  'TARGET_LEGACY_ONLY',
  'TARGET_KIND_MISMATCH',
  'TARGET_VERSION_CONFLICT',
  'TARGET_AMBIGUOUS',
]);
const ARTIFACT_EVIDENCE_STATUSES = Object.freeze([
  'VERIFIED',
  'PROJECT_REFERENCE_MISSING',
  'METADATA_MISSING',
  'NOT_LIVE',
  'CONTENT_MISSING',
  'CONTENT_CORRUPT',
]);
const ARTIFACT_CHECK_STATUSES = Object.freeze([
  'NOT_CHECKED',
  'VERIFIED',
  'PROJECT_REVISION_STALE',
  'PROJECT_REFERENCE_MISSING',
  'METADATA_MISSING',
  'NOT_LIVE',
  'CONTENT_MISSING',
  'CONTENT_CORRUPT',
  'DESCRIPTOR_MISMATCH',
]);

function failInvalid(message, field, code = 'PROCESSING_ADOPTION_PREFLIGHT_INVALID') {
  invariant(false, code, message, { field });
}

/**
 * Copies untrusted values without invoking getters, proxy traps, inherited
 * toJSON hooks, setters, or custom prototypes. Validation happens only after
 * this complete graph snapshot succeeds.
 */
function snapshotPlainData(value, label, state = { ancestors: new WeakSet(), nodes: 0 }, depth = 0) {
  state.nodes += 1;
  invariant(
    state.nodes <= 20_000 && depth <= 48,
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
    `${label} exceeds the bounded plain-data graph accepted by preflight v1.`,
    { field: label },
  );
  if (value === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof value)) return value;
  invariant(
    typeof value === 'object' && !utilTypes.isProxy(value),
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
    `${label} must be plain inspectable data.`,
    { field: label },
  );
  invariant(
    !state.ancestors.has(value),
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
    `${label} must not contain cycles.`,
    { field: label },
  );
  state.ancestors.add(value);

  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    failInvalid(`${label} must be inspectable plain data.`, label);
  }

  if (Array.isArray(value)) {
    invariant(
      prototype === Array.prototype,
      'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
      `${label} must be a plain array.`,
      { field: label },
    );
    let lengthDescriptor;
    try {
      lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    } catch {
      failInvalid(`${label} must expose an inspectable array length.`, label);
    }
    const length = lengthDescriptor?.value;
    invariant(
      Number.isSafeInteger(length) && length >= 0 && length <= 4096,
      'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
      `${label} must be a bounded dense array.`,
      { field: label },
    );
    const allowed = new Set(['length', ...Array.from({ length }, (_, index) => String(index))]);
    for (const key of keys) {
      invariant(
        typeof key === 'string' && allowed.has(key),
        'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
        `${label} contains a forbidden array field.`,
        { field: label },
      );
    }
    const result = new Array(length);
    for (let index = 0; index < length; index += 1) {
      let descriptor;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      } catch {
        failInvalid(`${label}[${index}] must be an inspectable own data field.`, `${label}[${index}]`);
      }
      invariant(
        descriptor && Object.hasOwn(descriptor, 'value') && descriptor.enumerable === true,
        'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
        `${label} must not contain sparse or accessor entries.`,
        { field: label },
      );
      Object.defineProperty(result, String(index), {
        configurable: true,
        enumerable: true,
        writable: true,
        value: snapshotPlainData(descriptor.value, `${label}[${index}]`, state, depth + 1),
      });
    }
    state.ancestors.delete(value);
    return result;
  }

  invariant(
    prototype === Object.prototype || prototype === null,
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
    `${label} must be a plain object.`,
    { field: label },
  );
  const result = Object.create(null);
  for (const key of keys) {
    invariant(
      typeof key === 'string',
      'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
      `${label} must not contain symbol fields.`,
      { field: label },
    );
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      failInvalid(`${label}.${key} must be an inspectable own data field.`, `${label}.${key}`);
    }
    invariant(
      descriptor && Object.hasOwn(descriptor, 'value') && descriptor.enumerable === true,
      'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
      `${label}.${key} must be an enumerable own data field.`,
      { field: `${label}.${key}` },
    );
    result[key] = snapshotPlainData(descriptor.value, `${label}.${key}`, state, depth + 1);
  }
  state.ancestors.delete(value);
  return result;
}

function exactRecord(value, allowed, label) {
  invariant(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
    `${label} must be an object.`,
    { field: label },
  );
  for (const field of Object.keys(value)) {
    invariant(
      allowed.includes(field),
      'PROCESSING_ADOPTION_PREFLIGHT_FIELD_FORBIDDEN',
      `${label}.${field} is not permitted by preflight v1.`,
      { field: `${label}.${field}` },
    );
  }
  return value;
}

function exactArray(value, length, label) {
  invariant(
    Array.isArray(value) && value.length === length,
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
    `${label} must contain exactly ${length} entries.`,
    { field: label },
  );
  return value;
}

function requireId(value, label) {
  invariant(
    typeof value === 'string' && ID_PATTERN.test(value),
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
    `${label} must be a safe stable Studio identifier.`,
    { field: label },
  );
  return value;
}

function requireToken(value, label) {
  invariant(
    typeof value === 'string' && TOKEN_PATTERN.test(value),
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
    `${label} must be a lowercase capability token.`,
    { field: label },
  );
  return value;
}

function requireNamespacedId(value, label) {
  invariant(
    typeof value === 'string' && NAMESPACED_ID_PATTERN.test(value),
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
    `${label} must be a lowercase dotted identifier.`,
    { field: label },
  );
  return value;
}

function requireVersion(value, label) {
  invariant(
    typeof value === 'string' && STABLE_VERSION_PATTERN.test(value),
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
    `${label} must be a portable stable version reference.`,
    { field: label },
  );
  return value;
}

function requireInteger(value, label, { min = 0 } = {}) {
  invariant(
    Number.isSafeInteger(value) && value >= min,
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
    `${label} must be a safe integer no smaller than ${min}.`,
    { field: label },
  );
  return value;
}

function requireHash(value, label) {
  invariant(
    typeof value === 'string' && HASH_PATTERN.test(value),
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
    `${label} must be a lowercase SHA-256 digest.`,
    { field: label },
  );
  return value;
}

function requireEnum(value, allowed, label) {
  invariant(
    allowed.includes(value),
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
    `${label} has an unsupported value.`,
    { field: label },
  );
  return value;
}

function requireBoundedText(value, label) {
  invariant(
    typeof value === 'string'
      && value.length >= 1
      && value.length <= 512
      && value.trim() === value
      && !CONTROL_CHARACTER_PATTERN.test(value),
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
    `${label} must be bounded stable text.`,
    { field: label },
  );
  return value;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    const array = value.map(canonicalize);
    Object.setPrototypeOf(array, null);
    return array;
  }
  if (value && typeof value === 'object') {
    const record = Object.create(null);
    for (const key of Object.keys(value).sort()) record[key] = canonicalize(value[key]);
    return record;
  }
  return value;
}

function canonicalJson(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

function sha256Json(value) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function normalizeCapabilityPin(value) {
  const pin = exactRecord(value, [
    'schemaVersion', 'kind', 'profileId', 'profileVersion', 'adapter',
    'manifestFingerprint', 'operation',
  ], 'request.capability');
  invariant(
    pin.schemaVersion === PROJECT_CAPABILITY_MANIFEST_SCHEMA_VERSION,
    'PROCESSING_ADOPTION_PREFLIGHT_SCHEMA_UNSUPPORTED',
    'Preflight v1 pins project capability manifest schema v1.',
    { field: 'request.capability.schemaVersion' },
  );
  invariant(
    pin.kind === PROJECT_CAPABILITY_MANIFEST_KIND,
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
    'The pinned project capability manifest kind is invalid.',
    { field: 'request.capability.kind' },
  );
  const adapter = exactRecord(pin.adapter, ['id', 'version'], 'request.capability.adapter');
  const operation = exactRecord(pin.operation, ['id', 'version'], 'request.capability.operation');
  invariant(
    operation.id === PROCESSING_ADOPTION_PREFLIGHT_OPERATION_ID
      && operation.version === PROCESSING_ADOPTION_PREFLIGHT_OPERATION_VERSION,
    'PROCESSING_ADOPTION_PREFLIGHT_CAPABILITY_INVALID',
    'The request must pin the exact processing-result adoption preflight operation v1.',
    { field: 'request.capability.operation' },
  );
  return {
    schemaVersion: PROJECT_CAPABILITY_MANIFEST_SCHEMA_VERSION,
    kind: PROJECT_CAPABILITY_MANIFEST_KIND,
    profileId: requireNamespacedId(pin.profileId, 'request.capability.profileId'),
    profileVersion: requireInteger(pin.profileVersion, 'request.capability.profileVersion', { min: 1 }),
    adapter: {
      id: requireToken(adapter.id, 'request.capability.adapter.id'),
      version: requireVersion(adapter.version, 'request.capability.adapter.version'),
    },
    manifestFingerprint: requireHash(
      pin.manifestFingerprint,
      'request.capability.manifestFingerprint',
    ),
    operation: {
      id: PROCESSING_ADOPTION_PREFLIGHT_OPERATION_ID,
      version: PROCESSING_ADOPTION_PREFLIGHT_OPERATION_VERSION,
    },
  };
}

function normalizeTarget(value) {
  const target = exactRecord(value, [
    'operation', 'assetId', 'expectedAssetVersion', 'expectedMetadataVersion',
  ], 'request.target');
  const operation = requireEnum(target.operation, ['create', 'update'], 'request.target.operation');
  const minimumVersion = operation === 'create' ? 0 : 1;
  const expectedAssetVersion = requireInteger(
    target.expectedAssetVersion,
    'request.target.expectedAssetVersion',
    { min: minimumVersion },
  );
  const expectedMetadataVersion = requireInteger(
    target.expectedMetadataVersion,
    'request.target.expectedMetadataVersion',
    { min: minimumVersion },
  );
  invariant(
    operation !== 'create' || (expectedAssetVersion === 0 && expectedMetadataVersion === 0),
    'PROCESSING_ADOPTION_PREFLIGHT_TARGET_INVALID',
    'Create preflight requires expected asset and metadata versions 0/0.',
    { field: 'request.target' },
  );
  return {
    operation,
    assetId: requireId(target.assetId, 'request.target.assetId'),
    expectedAssetVersion,
    expectedMetadataVersion,
  };
}

export function validateProcessingAdoptionPreflightRequest(value) {
  const request = exactRecord(snapshotPlainData(value, 'request'), [
    'schemaVersion', 'kind', 'project', 'processingRecipe', 'processingResult',
    'assetInputSelection', 'capability', 'target',
  ], 'request');
  invariant(
    request.schemaVersion === PROCESSING_ADOPTION_PREFLIGHT_SCHEMA_VERSION,
    'PROCESSING_ADOPTION_PREFLIGHT_SCHEMA_UNSUPPORTED',
    'Unsupported processing adoption preflight request schema version.',
    { field: 'request.schemaVersion' },
  );
  invariant(
    request.kind === PROCESSING_ADOPTION_PREFLIGHT_REQUEST_KIND,
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
    'Processing adoption preflight request kind is invalid.',
    { field: 'request.kind' },
  );
  const project = exactRecord(request.project, ['projectId', 'expectedRevision'], 'request.project');
  const processingRecipe = validateProcessingRecipe(request.processingRecipe);
  const processingResult = validateProcessingResultForRecipe(request.processingResult, processingRecipe);
  const assetInputSelection = validateAssetInputSelectionForProcessingResult(
    request.assetInputSelection,
    processingResult,
  );
  return deepFreeze({
    schemaVersion: PROCESSING_ADOPTION_PREFLIGHT_SCHEMA_VERSION,
    kind: PROCESSING_ADOPTION_PREFLIGHT_REQUEST_KIND,
    project: {
      projectId: requireId(project.projectId, 'request.project.projectId'),
      expectedRevision: requireInteger(
        project.expectedRevision,
        'request.project.expectedRevision',
        { min: 1 },
      ),
    },
    processingRecipe,
    processingResult,
    assetInputSelection,
    capability: normalizeCapabilityPin(request.capability),
    target: normalizeTarget(request.target),
  });
}

export function canonicalProcessingAdoptionPreflightRequestJson(value) {
  return canonicalJson(validateProcessingAdoptionPreflightRequest(value));
}

export function processingAdoptionPreflightRequestSha256(value) {
  return createHash('sha256')
    .update(canonicalProcessingAdoptionPreflightRequestJson(value))
    .digest('hex');
}

function sameIds(actual, expected) {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function capabilityObservation(manifest) {
  const operation = manifest.operations.find(({ id }) => id === PROCESSING_ADOPTION_PREFLIGHT_OPERATION_ID);
  return {
    schemaVersion: manifest.schemaVersion,
    kind: manifest.kind,
    profileId: manifest.profileId,
    profileVersion: manifest.profileVersion,
    adapter: { ...manifest.adapter },
    manifestFingerprint: sha256Json(manifest),
    assetKinds: [...manifest.assetKinds],
    modules: manifest.modules.map((entry) => ({ ...entry })),
    outputFormats: manifest.outputFormats.map((entry) => ({ ...entry })),
    operation: operation ? {
      id: operation.id,
      kind: operation.kind,
      version: operation.version,
      moduleIds: [...operation.moduleIds],
      inputFormatIds: [...operation.inputFormatIds],
      outputFormatIds: [...operation.outputFormatIds],
    } : null,
  };
}

function normalizeCapabilityCheck(value) {
  const check = exactRecord(value, ['status', 'observed'], 'capabilityCheck');
  const status = requireEnum(
    check.status,
    ['NOT_CHECKED', 'PROFILE_NOT_FOUND', 'PIN_MISMATCH', 'UNSUPPORTED', 'SUPPORTED'],
    'capabilityCheck.status',
  );
  if (['NOT_CHECKED', 'PROFILE_NOT_FOUND'].includes(status)) {
    invariant(check.observed === null, 'PROCESSING_ADOPTION_PREFLIGHT_INVALID', 'An unobserved capability state has no manifest observation.', { field: 'capabilityCheck.observed' });
    return deepFreeze({ status, observed: null });
  }
  const observed = exactRecord(check.observed, [
    'schemaVersion', 'kind', 'profileId', 'profileVersion', 'adapter',
    'manifestFingerprint', 'assetKinds', 'modules', 'outputFormats', 'operation',
  ], 'capabilityCheck.observed');
  const adapter = exactRecord(observed.adapter, ['id', 'version'], 'capabilityCheck.observed.adapter');
  const normalizeSortedUnique = (value, label, normalizer, max) => {
    invariant(
      Array.isArray(value) && value.length <= max,
      'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
      `${label} must be a bounded array.`,
      { field: label },
    );
    const entries = value.map((entry, index) => normalizer(entry, `${label}[${index}]`));
    const identities = entries.map((entry) => (typeof entry === 'string' ? entry : entry.id));
    invariant(
      new Set(identities).size === identities.length
        && identities.every((id, index) => index === 0 || identities[index - 1].localeCompare(id) < 0),
      'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
      `${label} must contain sorted unique identities.`,
      { field: label },
    );
    return entries;
  };
  const assetKinds = normalizeSortedUnique(
    observed.assetKinds,
    'capabilityCheck.observed.assetKinds',
    (entry, label) => requireToken(entry, label),
    64,
  );
  const modules = normalizeSortedUnique(
    observed.modules,
    'capabilityCheck.observed.modules',
    (entry, label) => {
      const module = exactRecord(entry, ['id', 'version'], label);
      return {
        id: requireNamespacedId(module.id, `${label}.id`),
        version: requireVersion(module.version, `${label}.version`),
      };
    },
    64,
  );
  const outputFormats = normalizeSortedUnique(
    observed.outputFormats,
    'capabilityCheck.observed.outputFormats',
    (entry, label) => {
      const format = exactRecord(entry, ['id', 'version', 'mediaType'], label);
      invariant(
        typeof format.mediaType === 'string' && MEDIA_TYPE_PATTERN.test(format.mediaType),
        'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
        `${label}.mediaType must be a normalized media type.`,
        { field: `${label}.mediaType` },
      );
      return {
        id: requireNamespacedId(format.id, `${label}.id`),
        version: requireInteger(format.version, `${label}.version`),
        mediaType: format.mediaType,
      };
    },
    64,
  );
  let operation = null;
  if (observed.operation !== null) {
    const candidate = exactRecord(observed.operation, [
      'id', 'kind', 'version', 'moduleIds', 'inputFormatIds', 'outputFormatIds',
    ], 'capabilityCheck.observed.operation');
    const normalizeIdList = (value, label) => {
      invariant(
        Array.isArray(value) && value.length <= 32,
        'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
        `${label} must be a bounded array.`,
        { field: label },
      );
      const ids = value.map((id, index) => requireNamespacedId(id, `${label}[${index}]`));
      invariant(
        new Set(ids).size === ids.length
          && ids.every((id, index) => index === 0 || ids[index - 1].localeCompare(id) < 0),
        'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
        `${label} must contain sorted unique identifiers.`,
        { field: label },
      );
      return ids;
    };
    operation = {
      id: requireNamespacedId(candidate.id, 'capabilityCheck.observed.operation.id'),
      kind: requireEnum(candidate.kind, ['snapshot', 'validate', 'compile', 'candidate'], 'capabilityCheck.observed.operation.kind'),
      version: requireInteger(candidate.version, 'capabilityCheck.observed.operation.version', { min: 1 }),
      moduleIds: normalizeIdList(candidate.moduleIds, 'capabilityCheck.observed.operation.moduleIds'),
      inputFormatIds: normalizeIdList(candidate.inputFormatIds, 'capabilityCheck.observed.operation.inputFormatIds'),
      outputFormatIds: normalizeIdList(candidate.outputFormatIds, 'capabilityCheck.observed.operation.outputFormatIds'),
    };
  }
  return deepFreeze({
    status,
    observed: {
      schemaVersion: requireInteger(observed.schemaVersion, 'capabilityCheck.observed.schemaVersion', { min: 1 }),
      kind: requireNamespacedId(observed.kind, 'capabilityCheck.observed.kind'),
      profileId: requireNamespacedId(observed.profileId, 'capabilityCheck.observed.profileId'),
      profileVersion: requireInteger(observed.profileVersion, 'capabilityCheck.observed.profileVersion', { min: 1 }),
      adapter: {
        id: requireToken(adapter.id, 'capabilityCheck.observed.adapter.id'),
        version: requireVersion(adapter.version, 'capabilityCheck.observed.adapter.version'),
      },
      manifestFingerprint: requireHash(observed.manifestFingerprint, 'capabilityCheck.observed.manifestFingerprint'),
      assetKinds,
      modules,
      outputFormats,
      operation,
    },
  });
}

function capabilityStatusForObservation(request, observed) {
  const pin = request.capability;
  const pinMatches = pin.schemaVersion === observed.schemaVersion
    && pin.kind === observed.kind
    && pin.profileId === observed.profileId
    && pin.profileVersion === observed.profileVersion
    && pin.adapter.id === observed.adapter.id
    && pin.adapter.version === observed.adapter.version
    && pin.manifestFingerprint === observed.manifestFingerprint;
  if (!pinMatches) return 'PIN_MISMATCH';

  const supported = observed.assetKinds.includes(request.assetInputSelection.assetKind)
    && supportsProcessingAdoptionCapability(observed);
  return supported ? 'SUPPORTED' : 'UNSUPPORTED';
}

function supportsProcessingAdoptionCapability(observed) {
  const moduleVersions = new Map(observed.modules.map((entry) => [entry.id, entry.version]));
  const formatContracts = new Map(observed.outputFormats.map((entry) => [entry.id, entry]));
  const formatsMatch = (required) => required.every(({ id, version, mediaType }) => {
    const format = formatContracts.get(id);
    return format?.version === version && format.mediaType === mediaType;
  });
  const operation = observed.operation;
  return operation?.id === PROCESSING_ADOPTION_PREFLIGHT_OPERATION_ID
    && operation.kind === 'validate'
    && operation.version === PROCESSING_ADOPTION_PREFLIGHT_OPERATION_VERSION
    && REQUIRED_MODULES.every(({ id, version }) => moduleVersions.get(id) === version)
    && formatsMatch(REQUIRED_INPUT_FORMATS)
    && formatsMatch(REQUIRED_OUTPUT_FORMATS)
    && sameIds(operation.moduleIds, REQUIRED_MODULES.map(({ id }) => id).sort())
    && sameIds(operation.inputFormatIds, REQUIRED_INPUT_FORMATS.map(({ id }) => id).sort())
    && sameIds(operation.outputFormatIds, REQUIRED_OUTPUT_FORMATS.map(({ id }) => id).sort());
}

export function validateProcessingAdoptionCapabilityManifest(value) {
  const manifest = validateProjectCapabilityManifest(snapshotPlainData(value, 'manifest'));
  invariant(
    supportsProcessingAdoptionCapability(capabilityObservation(manifest)),
    'PROCESSING_ADOPTION_CAPABILITY_UNSUPPORTED',
    'The project capability manifest does not support processing-result adoption.',
  );
  return manifest;
}

export function evaluateProcessingAdoptionCapability(requestValue, manifestValue) {
  const request = validateProcessingAdoptionPreflightRequest(requestValue);
  if (manifestValue === null) {
    return normalizeCapabilityCheck({ status: 'PROFILE_NOT_FOUND', observed: null });
  }
  const manifest = validateProjectCapabilityManifest(snapshotPlainData(manifestValue, 'manifest'));
  const observed = capabilityObservation(manifest);
  return normalizeCapabilityCheck({
    status: capabilityStatusForObservation(request, observed),
    observed,
  });
}

export function uncheckedProcessingAdoptionCapability() {
  return normalizeCapabilityCheck({ status: 'NOT_CHECKED', observed: null });
}

function normalizeAssetHead(value) {
  const head = exactRecord(value, [
    'assetId', 'assetKind', 'assetVersion', 'metadataVersion',
  ], 'assetState.head');
  return {
    assetId: requireId(head.assetId, 'assetState.head.assetId'),
    assetKind: requireToken(head.assetKind, 'assetState.head.assetKind'),
    assetVersion: requireInteger(head.assetVersion, 'assetState.head.assetVersion', { min: 1 }),
    metadataVersion: requireInteger(head.metadataVersion, 'assetState.head.metadataVersion', { min: 1 }),
  };
}

function normalizeAssetStateEvidence(value) {
  const evidence = exactRecord(snapshotPlainData(value, 'assetState'), [
    'schemaVersion', 'kind', 'project', 'assetId', 'identityState', 'head',
  ], 'assetState');
  invariant(
    evidence.schemaVersion === PROCESSING_ADOPTION_PREFLIGHT_SCHEMA_VERSION
      && evidence.kind === 'studio.processing-adoption-asset-state',
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
    'Asset-state evidence has an unsupported schema or kind.',
    { field: 'assetState' },
  );
  const project = exactRecord(evidence.project, ['projectId', 'observedRevision'], 'assetState.project');
  const identityState = requireEnum(evidence.identityState, ASSET_IDENTITY_STATES, 'assetState.identityState');
  const assetId = requireId(evidence.assetId, 'assetState.assetId');
  const head = evidence.head === null ? null : normalizeAssetHead(evidence.head);
  invariant(
    (identityState === 'V2_HEAD') === (head !== null),
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
    'Only V2_HEAD asset-state evidence carries an exact head.',
    { field: 'assetState.head' },
  );
  invariant(
    head === null || head.assetId === assetId,
    'PROCESSING_ADOPTION_PREFLIGHT_SCOPE_MISMATCH',
    'The observed V2 Asset head must identify the selected Asset.',
    { field: 'assetState.head.assetId' },
  );
  return deepFreeze({
    schemaVersion: PROCESSING_ADOPTION_PREFLIGHT_SCHEMA_VERSION,
    kind: 'studio.processing-adoption-asset-state',
    project: {
      projectId: requireId(project.projectId, 'assetState.project.projectId'),
      observedRevision: requireInteger(project.observedRevision, 'assetState.project.observedRevision', { min: 1 }),
    },
    assetId,
    identityState,
    head,
  });
}

function normalizeAssetCheck(value) {
  const check = exactRecord(value, ['status', 'observed'], 'assetStateCheck');
  const status = requireEnum(check.status, ASSET_CHECK_STATUSES, 'assetStateCheck.status');
  if (status === 'NOT_CHECKED') {
    invariant(check.observed === null, 'PROCESSING_ADOPTION_PREFLIGHT_INVALID', 'Unchecked asset state has no observation.', { field: 'assetStateCheck.observed' });
    return deepFreeze({ status, observed: null });
  }
  return deepFreeze({ status, observed: normalizeAssetStateEvidence(check.observed) });
}

export function evaluateProcessingAdoptionAssetState(requestValue, evidenceValue) {
  const request = validateProcessingAdoptionPreflightRequest(requestValue);
  const observed = normalizeAssetStateEvidence(evidenceValue);
  invariant(
    observed.project.projectId === request.project.projectId
      && observed.assetId === request.target.assetId,
    'PROCESSING_ADOPTION_PREFLIGHT_SCOPE_MISMATCH',
    'Asset-state evidence is outside the requested project or asset scope.',
  );
  if (observed.project.observedRevision !== request.project.expectedRevision) {
    return normalizeAssetCheck({ status: 'PROJECT_REVISION_STALE', observed });
  }
  const { operation } = request.target;
  if (observed.identityState === 'AMBIGUOUS') return normalizeAssetCheck({ status: 'TARGET_AMBIGUOUS', observed });
  if (operation === 'create') {
    return normalizeAssetCheck({
      status: observed.identityState === 'UNUSED' ? 'MATCHED' : 'TARGET_OCCUPIED',
      observed,
    });
  }
  if (observed.identityState === 'UNUSED') return normalizeAssetCheck({ status: 'TARGET_NOT_FOUND', observed });
  if (observed.identityState === 'LEGACY_OCCUPIED') return normalizeAssetCheck({ status: 'TARGET_LEGACY_ONLY', observed });
  if (observed.head.assetKind !== request.assetInputSelection.assetKind) {
    return normalizeAssetCheck({ status: 'TARGET_KIND_MISMATCH', observed });
  }
  if (observed.head.assetVersion !== request.target.expectedAssetVersion
    || observed.head.metadataVersion !== request.target.expectedMetadataVersion) {
    return normalizeAssetCheck({ status: 'TARGET_VERSION_CONFLICT', observed });
  }
  return normalizeAssetCheck({ status: 'MATCHED', observed });
}

export function uncheckedProcessingAdoptionAssetState() {
  return normalizeAssetCheck({ status: 'NOT_CHECKED', observed: null });
}

function normalizeArtifactDescriptor(value, label, { metadata }) {
  const fields = metadata
    ? ['artifactUri', 'sha256', 'mediaType', 'byteSize', 'width', 'height', 'state']
    : ['sha256', 'mediaType', 'byteSize', 'width', 'height'];
  const descriptor = exactRecord(value, fields, label);
  const sha256 = requireHash(descriptor.sha256, `${label}.sha256`);
  const normalized = {
    ...(metadata ? {
      artifactUri: (() => {
        const match = typeof descriptor.artifactUri === 'string'
          ? CAS_URI_PATTERN.exec(descriptor.artifactUri)
          : null;
        invariant(
          match?.[1] === sha256,
          'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
          `${label}.artifactUri must be the canonical CAS URI for its digest.`,
          { field: `${label}.artifactUri` },
        );
        return descriptor.artifactUri;
      })(),
    } : {}),
    sha256,
    mediaType: (() => {
      invariant(descriptor.mediaType === 'image/png', 'PROCESSING_ADOPTION_PREFLIGHT_INVALID', `${label}.mediaType must be image/png.`, { field: `${label}.mediaType` });
      return 'image/png';
    })(),
    byteSize: requireInteger(descriptor.byteSize, `${label}.byteSize`, { min: 1 }),
    width: requireInteger(descriptor.width, `${label}.width`, { min: 1 }),
    height: requireInteger(descriptor.height, `${label}.height`, { min: 1 }),
    ...(metadata ? {
      state: requireEnum(descriptor.state, ['LIVE', 'MISSING', 'CORRUPT', 'QUARANTINED'], `${label}.state`),
    } : {}),
  };
  return normalized;
}

function normalizeArtifactEvidence(value) {
  const evidence = exactRecord(snapshotPlainData(value, 'artifactVerification'), [
    'schemaVersion', 'kind', 'project', 'role', 'sha256', 'status', 'metadata', 'physical',
  ], 'artifactVerification');
  invariant(
    evidence.schemaVersion === PROCESSING_ADOPTION_PREFLIGHT_SCHEMA_VERSION
      && evidence.kind === 'studio.processing-adoption-artifact-verification',
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
    'Artifact verification evidence has an unsupported schema or kind.',
    { field: 'artifactVerification' },
  );
  const project = exactRecord(evidence.project, ['projectId', 'observedRevision'], 'artifactVerification.project');
  const status = requireEnum(evidence.status, ARTIFACT_EVIDENCE_STATUSES, 'artifactVerification.status');
  const metadata = evidence.metadata === null
    ? null
    : normalizeArtifactDescriptor(evidence.metadata, 'artifactVerification.metadata', { metadata: true });
  const physical = evidence.physical === null
    ? null
    : normalizeArtifactDescriptor(evidence.physical, 'artifactVerification.physical', { metadata: false });
  invariant(
    (status === 'VERIFIED') === (metadata !== null && physical !== null),
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
    'Only VERIFIED artifact evidence carries both metadata and physical descriptors.',
    { field: 'artifactVerification' },
  );
  invariant(
    !['PROJECT_REFERENCE_MISSING', 'METADATA_MISSING'].includes(status)
      || (metadata === null && physical === null),
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
    'Missing project reference or metadata evidence must not expose descriptors.',
    { field: 'artifactVerification' },
  );
  invariant(
    !['NOT_LIVE', 'CONTENT_MISSING', 'CONTENT_CORRUPT'].includes(status)
      || (metadata !== null && physical === null),
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
    'Non-live or unavailable content evidence requires metadata and no physical descriptor.',
    { field: 'artifactVerification' },
  );
  invariant(
    status !== 'NOT_LIVE' || metadata.state !== 'LIVE',
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
    'NOT_LIVE evidence must report a non-LIVE metadata state.',
    { field: 'artifactVerification.metadata.state' },
  );
  invariant(
    !['VERIFIED', 'CONTENT_MISSING', 'CONTENT_CORRUPT'].includes(status) || metadata.state === 'LIVE',
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
    'Verified or physically unavailable content must have LIVE registered metadata.',
    { field: 'artifactVerification.metadata.state' },
  );
  return deepFreeze({
    schemaVersion: PROCESSING_ADOPTION_PREFLIGHT_SCHEMA_VERSION,
    kind: 'studio.processing-adoption-artifact-verification',
    project: {
      projectId: requireId(project.projectId, 'artifactVerification.project.projectId'),
      observedRevision: requireInteger(project.observedRevision, 'artifactVerification.project.observedRevision', { min: 1 }),
    },
    role: requireEnum(evidence.role, PROCESSING_ADOPTION_PREFLIGHT_ARTIFACT_ROLES, 'artifactVerification.role'),
    sha256: requireHash(evidence.sha256, 'artifactVerification.sha256'),
    status,
    metadata,
    physical,
  });
}

function normalizeArtifactCheck(value) {
  const check = exactRecord(value, ['role', 'status', 'observed'], 'artifactCheck');
  const role = requireEnum(check.role, PROCESSING_ADOPTION_PREFLIGHT_ARTIFACT_ROLES, 'artifactCheck.role');
  const status = requireEnum(check.status, ARTIFACT_CHECK_STATUSES, 'artifactCheck.status');
  if (status === 'NOT_CHECKED') {
    invariant(check.observed === null, 'PROCESSING_ADOPTION_PREFLIGHT_INVALID', 'An unchecked artifact has no observation.', { field: 'artifactCheck.observed' });
    return deepFreeze({ role, status, observed: null });
  }
  const observed = normalizeArtifactEvidence(check.observed);
  invariant(observed.role === role, 'PROCESSING_ADOPTION_PREFLIGHT_INVALID', 'Artifact check role does not match its observation.', { field: 'artifactCheck.role' });
  return deepFreeze({ role, status, observed });
}

function artifactDescriptorFor(request, role) {
  return role === 'recipe-input'
    ? request.processingRecipe.inputs[0]
    : request.assetInputSelection.selectedOutput;
}

function descriptorMatches(expected, actual, fields) {
  return fields.every((field) => expected[field] === actual[field]);
}

export function evaluateProcessingAdoptionArtifact(requestValue, roleValue, evidenceValue) {
  const request = validateProcessingAdoptionPreflightRequest(requestValue);
  const role = requireEnum(roleValue, PROCESSING_ADOPTION_PREFLIGHT_ARTIFACT_ROLES, 'role');
  const observed = normalizeArtifactEvidence(evidenceValue);
  const expected = artifactDescriptorFor(request, role);
  invariant(
    observed.project.projectId === request.project.projectId
      && observed.role === role
      && observed.sha256 === expected.sha256,
    'PROCESSING_ADOPTION_PREFLIGHT_SCOPE_MISMATCH',
    'Artifact evidence is outside the requested project, role, or digest scope.',
  );
  if (observed.project.observedRevision !== request.project.expectedRevision) {
    return normalizeArtifactCheck({ role, status: 'PROJECT_REVISION_STALE', observed });
  }
  const metadataFields = ['artifactUri', 'sha256', 'mediaType', 'byteSize', 'width', 'height'];
  const physicalFields = ['sha256', 'mediaType', 'byteSize', 'width', 'height'];
  if (observed.metadata !== null
    && !descriptorMatches(expected, observed.metadata, metadataFields)) {
    return normalizeArtifactCheck({ role, status: 'DESCRIPTOR_MISMATCH', observed });
  }
  if (observed.status !== 'VERIFIED') {
    return normalizeArtifactCheck({ role, status: observed.status, observed });
  }
  const matches = observed.metadata.state === 'LIVE'
    && descriptorMatches(expected, observed.metadata, metadataFields)
    && descriptorMatches(expected, observed.physical, physicalFields)
    && descriptorMatches(observed.metadata, observed.physical, physicalFields);
  return normalizeArtifactCheck({
    role,
    status: matches ? 'VERIFIED' : 'DESCRIPTOR_MISMATCH',
    observed,
  });
}

export function uncheckedProcessingAdoptionArtifacts() {
  return deepFreeze(PROCESSING_ADOPTION_PREFLIGHT_ARTIFACT_ROLES.map((role) => normalizeArtifactCheck({
    role,
    status: 'NOT_CHECKED',
    observed: null,
  })));
}

function blocker(code, subject) {
  invariant(BLOCKER_CODE_PATTERN.test(code), 'PROCESSING_ADOPTION_PREFLIGHT_INVALID', 'Blocker code is invalid.', { field: 'blocker.code' });
  return { code, subject: requireBoundedText(subject, 'blocker.subject') };
}

function deriveBlockers(request, capabilityCheck, assetStateCheck, artifactChecks) {
  const blockers = request.processingResult.findings
    .filter(({ severity }) => severity === 'ERROR')
    .map((finding) => blocker(
      'PROCESSING_RESULT_ERROR',
      `${finding.ruleId}|${finding.objectRef}`,
    ));
  const capabilityCodes = {
    NOT_CHECKED: 'PROCESSING_ADOPTION_CAPABILITY_NOT_CHECKED',
    PROFILE_NOT_FOUND: 'PROCESSING_ADOPTION_CAPABILITY_PROFILE_NOT_FOUND',
    PIN_MISMATCH: 'PROCESSING_ADOPTION_CAPABILITY_PIN_MISMATCH',
    UNSUPPORTED: 'PROCESSING_ADOPTION_CAPABILITY_UNSUPPORTED',
  };
  if (capabilityCheck.status !== 'SUPPORTED') {
    blockers.push(blocker(capabilityCodes[capabilityCheck.status], request.capability.operation.id));
  }
  const assetCodes = {
    NOT_CHECKED: 'PROCESSING_ADOPTION_ASSET_STATE_NOT_CHECKED',
    PROJECT_REVISION_STALE: 'PROCESSING_ADOPTION_PROJECT_REVISION_STALE',
    TARGET_OCCUPIED: 'PROCESSING_ADOPTION_TARGET_OCCUPIED',
    TARGET_NOT_FOUND: 'PROCESSING_ADOPTION_TARGET_NOT_FOUND',
    TARGET_LEGACY_ONLY: 'PROCESSING_ADOPTION_TARGET_LEGACY_ONLY',
    TARGET_KIND_MISMATCH: 'PROCESSING_ADOPTION_TARGET_KIND_MISMATCH',
    TARGET_VERSION_CONFLICT: 'PROCESSING_ADOPTION_TARGET_VERSION_CONFLICT',
    TARGET_AMBIGUOUS: 'PROCESSING_ADOPTION_TARGET_AMBIGUOUS',
  };
  if (assetStateCheck.status !== 'MATCHED') {
    blockers.push(blocker(assetCodes[assetStateCheck.status], request.target.assetId));
  }
  for (const check of artifactChecks) {
    if (check.status !== 'VERIFIED') {
      blockers.push(blocker(
        `PROCESSING_ADOPTION_ARTIFACT_${check.status}`,
        check.role,
      ));
    }
  }
  blockers.sort((left, right) => left.code.localeCompare(right.code) || left.subject.localeCompare(right.subject));
  return blockers;
}

function normalizeReceiptChecks(request, value) {
  const checks = exactRecord(snapshotPlainData(value, 'checks'), [
    'capabilityCheck', 'assetStateCheck', 'artifactChecks',
  ], 'checks');
  const normalizedCapability = normalizeCapabilityCheck(checks.capabilityCheck);
  const normalizedAsset = normalizeAssetCheck(checks.assetStateCheck);
  const normalizedArtifacts = exactArray(
    checks.artifactChecks,
    PROCESSING_ADOPTION_PREFLIGHT_ARTIFACT_ROLES.length,
    'artifactChecks',
  ).map(normalizeArtifactCheck);
  invariant(
    normalizedArtifacts.every((check, index) => check.role === PROCESSING_ADOPTION_PREFLIGHT_ARTIFACT_ROLES[index]),
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
    'Artifact checks must use the fixed preflight role order.',
    { field: 'artifactChecks' },
  );

  const mismatch = (condition, message, field) => invariant(
    condition,
    'PROCESSING_ADOPTION_PREFLIGHT_RECEIPT_MISMATCH',
    message,
    { field },
  );
  if (normalizedCapability.observed !== null) {
    mismatch(
      normalizedCapability.status === capabilityStatusForObservation(request, normalizedCapability.observed),
      'Capability check status does not follow from its closed observation.',
      'capabilityCheck.status',
    );
  }
  if (normalizedAsset.observed !== null) {
    mismatch(
      normalizedAsset.status
        === evaluateProcessingAdoptionAssetState(request, normalizedAsset.observed).status,
      'Asset-state check status does not follow from its closed observation.',
      'assetStateCheck.status',
    );
  }
  for (const check of normalizedArtifacts) {
    if (check.observed !== null) {
      mismatch(
        check.status === evaluateProcessingAdoptionArtifact(request, check.role, check.observed).status,
        'Artifact check status does not follow from its closed observation.',
        `artifactChecks.${check.role}.status`,
      );
    }
  }

  const hasErrors = request.processingResult.findings.some(({ severity }) => severity === 'ERROR');
  if (hasErrors) {
    mismatch(
      normalizedCapability.status === 'NOT_CHECKED'
        && normalizedAsset.status === 'NOT_CHECKED'
        && normalizedArtifacts.every(({ status }) => status === 'NOT_CHECKED'),
      'ERROR findings require deterministic short-circuit before every read port.',
      'checks',
    );
  } else {
    mismatch(
      normalizedCapability.status !== 'NOT_CHECKED',
      'A finding-free preflight must evaluate its capability pin.',
      'capabilityCheck.status',
    );
    if (normalizedCapability.status !== 'SUPPORTED') {
      mismatch(
        normalizedAsset.status === 'NOT_CHECKED'
          && normalizedArtifacts.every(({ status }) => status === 'NOT_CHECKED'),
        'Unsupported capability requires deterministic short-circuit before Asset and CAS reads.',
        'checks',
      );
    } else {
      mismatch(
        normalizedAsset.status !== 'NOT_CHECKED',
        'Supported capability must be followed by an Asset-state observation.',
        'assetStateCheck.status',
      );
      if (normalizedAsset.status !== 'MATCHED') {
        mismatch(
          normalizedArtifacts.every(({ status }) => status === 'NOT_CHECKED'),
          'A blocked Asset state requires deterministic short-circuit before CAS reads.',
          'artifactChecks',
        );
      } else {
        mismatch(
          normalizedArtifacts.every(({ status }) => status !== 'NOT_CHECKED'),
          'A matched Asset state requires both fixed artifact observations.',
          'artifactChecks',
        );
      }
    }
  }
  return {
    capabilityCheck: normalizedCapability,
    assetStateCheck: normalizedAsset,
    artifactChecks: normalizedArtifacts,
  };
}

export function createProcessingAdoptionPreflightReceipt(requestValue, checksValue) {
  const request = validateProcessingAdoptionPreflightRequest(requestValue);
  const checks = normalizeReceiptChecks(request, checksValue);
  const blockers = deriveBlockers(request, checks.capabilityCheck, checks.assetStateCheck, checks.artifactChecks);
  const unresolvedWarnings = request.processingResult.findings
    .filter(({ severity }) => severity === 'WARNING')
    .map((finding) => ({ ...finding }));
  return deepFreeze({
    schemaVersion: PROCESSING_ADOPTION_PREFLIGHT_SCHEMA_VERSION,
    kind: PROCESSING_ADOPTION_PREFLIGHT_RECEIPT_KIND,
    status: blockers.length === 0 ? 'PREFLIGHT_PASSED' : 'PREFLIGHT_BLOCKED',
    effect: 'READ_ONLY',
    authorization: 'NOT_GRANTED',
    assetMutation: 'NONE',
    warningDisposition: unresolvedWarnings.length === 0 ? 'NONE' : 'UNRESOLVED',
    revalidation: 'REQUIRED_AT_MUTATION',
    requestFingerprint: processingAdoptionPreflightRequestSha256(request),
    request,
    closure: {
      recipeFingerprint: processingRecipeSha256(request.processingRecipe),
      processingResultFingerprint: processingResultSha256(request.processingResult),
      assetInputSelectionFingerprint: assetInputSelectionSha256(request.assetInputSelection),
    },
    capabilityCheck: checks.capabilityCheck,
    assetStateCheck: checks.assetStateCheck,
    artifactChecks: checks.artifactChecks,
    unresolvedWarnings,
    blockers,
  });
}

export function validateProcessingAdoptionPreflightReceipt(value) {
  const receipt = exactRecord(snapshotPlainData(value, 'receipt'), [
    'schemaVersion', 'kind', 'status', 'effect', 'authorization', 'assetMutation',
    'warningDisposition', 'revalidation', 'requestFingerprint', 'request', 'closure',
    'capabilityCheck', 'assetStateCheck', 'artifactChecks', 'unresolvedWarnings', 'blockers',
  ], 'receipt');
  invariant(
    receipt.schemaVersion === PROCESSING_ADOPTION_PREFLIGHT_SCHEMA_VERSION
      && receipt.kind === PROCESSING_ADOPTION_PREFLIGHT_RECEIPT_KIND,
    'PROCESSING_ADOPTION_PREFLIGHT_SCHEMA_UNSUPPORTED',
    'Unsupported processing adoption preflight receipt schema or kind.',
    { field: 'receipt' },
  );
  invariant(
    receipt.effect === 'READ_ONLY'
      && receipt.authorization === 'NOT_GRANTED'
      && receipt.assetMutation === 'NONE'
      && receipt.revalidation === 'REQUIRED_AT_MUTATION',
    'PROCESSING_ADOPTION_PREFLIGHT_AUTHORITY_FORBIDDEN',
    'A preflight receipt is read-only, non-authorizing, and requires later revalidation.',
    { field: 'receipt' },
  );
  const expected = createProcessingAdoptionPreflightReceipt(receipt.request, {
    capabilityCheck: receipt.capabilityCheck,
    assetStateCheck: receipt.assetStateCheck,
    artifactChecks: receipt.artifactChecks,
  });
  invariant(
    canonicalJson(receipt) === canonicalJson(expected),
    'PROCESSING_ADOPTION_PREFLIGHT_RECEIPT_MISMATCH',
    'The preflight receipt does not match its closed request and observations.',
  );
  return expected;
}

export function canonicalProcessingAdoptionPreflightReceiptJson(value) {
  return canonicalJson(validateProcessingAdoptionPreflightReceipt(value));
}

export function processingAdoptionPreflightReceiptSha256(value) {
  return createHash('sha256')
    .update(canonicalProcessingAdoptionPreflightReceiptJson(value))
    .digest('hex');
}
