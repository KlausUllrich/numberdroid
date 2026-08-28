import { createHash } from 'node:crypto';
import { types as utilTypes } from 'node:util';
import {
  ASSET_KINDS,
  validateAssetMetadataForVisualFacts,
  validateExactSliceBinding,
} from './asset-definition.js';
import {
  ASSET_INPUT_SELECTION_KIND,
  ASSET_INPUT_SELECTION_SCHEMA_VERSION,
  PRIMARY_VISUAL_ASSET_INPUT_ROLE,
} from './asset-input-selection.js';
import { invariant } from './errors.js';
import {
  processingAdoptionPreflightReceiptSha256,
  validateProcessingAdoptionPreflightReceipt,
} from './processing-adoption-preflight.js';
import {
  PROCESSING_RESULT_ADOPTION_REFERENCE_ROLES,
  PROCESSING_RESULT_ADOPTION_SCHEMA_VERSION,
  PROCESSING_RESULT_ASSET_BINDING_KIND,
  createProcessingResultAdoptionPlan,
  createProcessingResultAssetBinding,
  processingResultAdoptionCommandSha256,
  processingResultAdoptionSemanticSha256,
  validateProcessingResultAdoptionAuthorityBinding,
  validateProcessingResultAdoptionCommand,
} from './processing-result-adoption.js';
import {
  PROCESSING_RESULT_KIND,
  PROCESSING_RESULT_SCHEMA_VERSION,
  processingResultSha256,
} from './processing-result.js';

export const PROCESSING_RESULT_ADOPTION_AGGREGATE_SCHEMA_VERSION = 1;
export const PROCESSING_RESULT_ADOPTION_AGGREGATE_KIND = 'studio.processing-result-adoption-aggregate';
export const PROCESSING_RESULT_ADOPTION_COMMIT_RESULT_SCHEMA_VERSION = 1;
export const PROCESSING_RESULT_ADOPTION_COMMIT_RESULT_KIND = 'studio.processing-result-adoption-commit-result';

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const CAS_URI_PATTERN = /^studio:\/\/artifacts\/sha256\/([a-f0-9]{64})$/;
const MAX_INCREMENTABLE_VERSION = Number.MAX_SAFE_INTEGER - 1;
const AUTHORED_METADATA_FIELDS = Object.freeze([
  'role', 'tags', 'variantGroup', 'compatibilityGroups', 'spanTiles', 'anchor',
  'attachment', 'rotationPolicy', 'placement', 'collision', 'navigation',
  'runtimeEligible', 'connectors', 'continuityProfile', 'continuityTags',
  'selectionPriority', 'visualWeight', 'extensions',
]);
const STORED_METADATA_FIELDS = Object.freeze([
  ...AUTHORED_METADATA_FIELDS,
  'pixelSize',
  'pivot',
]);

function fail(code, message, field, details = {}) {
  invariant(false, code, message, { field, ...details });
}

function snapshotPlainData(
  value,
  label,
  code,
  state = { ancestors: new WeakSet(), nodes: 0 },
  depth = 0,
) {
  state.nodes += 1;
  invariant(
    state.nodes <= 30_000 && depth <= 48,
    code,
    `${label} exceeds the bounded plain-data graph accepted by adoption persistence v1.`,
    { field: label },
  );
  if (value === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof value)) return value;
  invariant(
    typeof value === 'object' && !utilTypes.isProxy(value),
    code,
    `${label} must be plain inspectable data.`,
    { field: label },
  );
  invariant(!state.ancestors.has(value), code, `${label} must not contain cycles.`, { field: label });
  state.ancestors.add(value);

  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    fail(code, `${label} must be inspectable plain data.`, label);
  }

  if (Array.isArray(value)) {
    invariant(prototype === Array.prototype, code, `${label} must be a plain array.`, { field: label });
    let length;
    try {
      length = Object.getOwnPropertyDescriptor(value, 'length')?.value;
    } catch {
      fail(code, `${label} must expose an inspectable array length.`, label);
    }
    invariant(
      Number.isSafeInteger(length) && length >= 0 && length <= 4096,
      code,
      `${label} must be a bounded dense array.`,
      { field: label },
    );
    const allowed = new Set(['length', ...Array.from({ length }, (_, index) => String(index))]);
    invariant(
      keys.every((key) => typeof key === 'string' && allowed.has(key)),
      code,
      `${label} contains a forbidden array field.`,
      { field: label },
    );
    const result = new Array(length);
    for (let index = 0; index < length; index += 1) {
      let descriptor;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      } catch {
        fail(code, `${label}[${index}] must be inspectable.`, `${label}[${index}]`);
      }
      invariant(
        descriptor && Object.hasOwn(descriptor, 'value') && descriptor.enumerable === true,
        code,
        `${label} must not contain sparse or accessor entries.`,
        { field: label },
      );
      Object.defineProperty(result, String(index), {
        configurable: true,
        enumerable: true,
        writable: true,
        value: snapshotPlainData(descriptor.value, `${label}[${index}]`, code, state, depth + 1),
      });
    }
    state.ancestors.delete(value);
    return result;
  }

  invariant(
    prototype === Object.prototype || prototype === null,
    code,
    `${label} must be a plain object.`,
    { field: label },
  );
  const result = Object.create(null);
  for (const key of keys) {
    invariant(typeof key === 'string', code, `${label} must not contain symbols.`, { field: label });
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      fail(code, `${label}.${key} must be inspectable.`, `${label}.${key}`);
    }
    invariant(
      descriptor && Object.hasOwn(descriptor, 'value') && descriptor.enumerable === true,
      code,
      `${label}.${key} must be an enumerable own data field.`,
      { field: `${label}.${key}` },
    );
    result[key] = snapshotPlainData(descriptor.value, `${label}.${key}`, code, state, depth + 1);
  }
  state.ancestors.delete(value);
  return result;
}

function exactRecord(value, allowed, label, code) {
  invariant(value !== null && typeof value === 'object' && !Array.isArray(value), code, `${label} must be an object.`, { field: label });
  for (const field of Object.keys(value)) {
    invariant(allowed.includes(field), code, `${label}.${field} is not permitted by adoption persistence v1.`, { field: `${label}.${field}` });
  }
  invariant(
    allowed.every((field) => Object.hasOwn(value, field)),
    code,
    `${label} must contain every required adoption persistence v1 field.`,
    { field: label },
  );
  return value;
}

function requireId(value, label, code) {
  invariant(typeof value === 'string' && ID_PATTERN.test(value), code, `${label} must be a safe stable Studio identifier.`, { field: label });
  return value;
}

function requireHash(value, label, code) {
  invariant(typeof value === 'string' && HASH_PATTERN.test(value), code, `${label} must be a lowercase SHA-256 digest.`, { field: label });
  return value;
}

function requireInteger(value, label, code, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  invariant(Number.isSafeInteger(value) && value >= min && value <= max, code, `${label} must be a safe integer from ${min} to ${max}.`, { field: label });
  return value;
}

function requireName(value, label, code) {
  invariant(
    typeof value === 'string'
      && value.trim() === value
      && value.length >= 1
      && value.length <= 160
      && !CONTROL_CHARACTER_PATTERN.test(value),
    code,
    `${label} must be a bounded trimmed display name.`,
    { field: label },
  );
  return value;
}

function requireIsoDate(value, label, code) {
  invariant(
    typeof value === 'string'
      && value.trim() === value
      && value.length >= 1
      && value.length <= 64
      && !Number.isNaN(Date.parse(value)),
    code,
    `${label} must be an ISO date-time.`,
    { field: label },
  );
  return value;
}

function requireEnum(value, allowed, label, code) {
  invariant(allowed.includes(value), code, `${label} has an unsupported value.`, { field: label });
  return value;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object') return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.isFrozen(value) ? value : Object.freeze(value);
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

function sameCanonical(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function normalizeArtifactDescriptor(value, label, code) {
  const descriptor = exactRecord(value, [
    'artifactUri', 'sha256', 'mediaType', 'byteSize', 'width', 'height',
  ], label, code);
  const sha256 = requireHash(descriptor.sha256, `${label}.sha256`, code);
  const match = typeof descriptor.artifactUri === 'string'
    ? CAS_URI_PATTERN.exec(descriptor.artifactUri)
    : null;
  invariant(match?.[1] === sha256, code, `${label}.artifactUri must be the canonical CAS URI for its digest.`, { field: `${label}.artifactUri` });
  invariant(descriptor.mediaType === 'image/png', code, `${label}.mediaType must be image/png.`, { field: `${label}.mediaType` });
  return {
    artifactUri: descriptor.artifactUri,
    sha256,
    mediaType: 'image/png',
    byteSize: requireInteger(descriptor.byteSize, `${label}.byteSize`, code, { min: 1, max: 128 * 1024 * 1024 }),
    width: requireInteger(descriptor.width, `${label}.width`, code, { min: 1, max: 65535 }),
    height: requireInteger(descriptor.height, `${label}.height`, code, { min: 1, max: 65535 }),
  };
}

/**
 * Validates the self-contained processing lineage value persisted by A1.5.
 * It is deliberately separate from CP2C ExactSliceBinding validation.
 */
export function validateProcessingResultAssetBinding(value) {
  const code = 'PROCESSING_RESULT_ASSET_BINDING_INVALID';
  const binding = exactRecord(snapshotPlainData(value, 'processingBinding', code), [
    'schemaVersion', 'kind', 'projectId', 'assetId', 'assetKind', 'inputRole',
    'recipe', 'processingResult', 'assetInputSelection', 'operation',
    'recipeInput', 'selectedOutput', 'pixelSize', 'pivot', 'fingerprint',
  ], 'processingBinding', code);
  invariant(
    binding.schemaVersion === PROCESSING_RESULT_ADOPTION_SCHEMA_VERSION
      && binding.kind === PROCESSING_RESULT_ASSET_BINDING_KIND,
    code,
    'Unsupported processing-result Asset binding schema or kind.',
    { field: 'processingBinding' },
  );
  const recipe = exactRecord(binding.recipe, ['id', 'version', 'fingerprint'], 'processingBinding.recipe', code);
  const processingResult = exactRecord(binding.processingResult, ['schemaVersion', 'kind', 'fingerprint'], 'processingBinding.processingResult', code);
  const assetInputSelection = exactRecord(binding.assetInputSelection, ['schemaVersion', 'kind', 'fingerprint'], 'processingBinding.assetInputSelection', code);
  const operation = exactRecord(binding.operation, ['operationId', 'kind', 'processorId'], 'processingBinding.operation', code);
  const pixelSize = exactRecord(binding.pixelSize, ['width', 'height'], 'processingBinding.pixelSize', code);
  const recipeInput = normalizeArtifactDescriptor(binding.recipeInput, 'processingBinding.recipeInput', code);
  const selectedOutput = normalizeArtifactDescriptor(binding.selectedOutput, 'processingBinding.selectedOutput', code);
  const normalizedPixelSize = {
    width: requireInteger(pixelSize.width, 'processingBinding.pixelSize.width', code, { min: 1, max: 65535 }),
    height: requireInteger(pixelSize.height, 'processingBinding.pixelSize.height', code, { min: 1, max: 65535 }),
  };
  invariant(
    normalizedPixelSize.width === selectedOutput.width
      && normalizedPixelSize.height === selectedOutput.height,
    code,
    'Processing binding pixelSize must match the selected output.',
    { field: 'processingBinding.pixelSize' },
  );
  invariant(binding.pivot === null, code, 'Processing-result adoption v1 requires a null pivot.', { field: 'processingBinding.pivot' });
  invariant(
    processingResult.schemaVersion === PROCESSING_RESULT_SCHEMA_VERSION
      && processingResult.kind === PROCESSING_RESULT_KIND,
    code,
    'Processing binding pins an unsupported ProcessingResult contract.',
    { field: 'processingBinding.processingResult' },
  );
  invariant(
    assetInputSelection.schemaVersion === ASSET_INPUT_SELECTION_SCHEMA_VERSION
      && assetInputSelection.kind === ASSET_INPUT_SELECTION_KIND,
    code,
    'Processing binding pins an unsupported AssetInputSelection contract.',
    { field: 'processingBinding.assetInputSelection' },
  );
  const body = {
    schemaVersion: PROCESSING_RESULT_ADOPTION_SCHEMA_VERSION,
    kind: PROCESSING_RESULT_ASSET_BINDING_KIND,
    projectId: requireId(binding.projectId, 'processingBinding.projectId', code),
    assetId: requireId(binding.assetId, 'processingBinding.assetId', code),
    assetKind: requireEnum(binding.assetKind, ASSET_KINDS, 'processingBinding.assetKind', code),
    inputRole: requireEnum(binding.inputRole, [PRIMARY_VISUAL_ASSET_INPUT_ROLE], 'processingBinding.inputRole', code),
    recipe: {
      id: requireId(recipe.id, 'processingBinding.recipe.id', code),
      version: requireInteger(recipe.version, 'processingBinding.recipe.version', code, { min: 1 }),
      fingerprint: requireHash(recipe.fingerprint, 'processingBinding.recipe.fingerprint', code),
    },
    processingResult: {
      schemaVersion: PROCESSING_RESULT_SCHEMA_VERSION,
      kind: PROCESSING_RESULT_KIND,
      fingerprint: requireHash(processingResult.fingerprint, 'processingBinding.processingResult.fingerprint', code),
    },
    assetInputSelection: {
      schemaVersion: ASSET_INPUT_SELECTION_SCHEMA_VERSION,
      kind: ASSET_INPUT_SELECTION_KIND,
      fingerprint: requireHash(assetInputSelection.fingerprint, 'processingBinding.assetInputSelection.fingerprint', code),
    },
    operation: {
      operationId: requireId(operation.operationId, 'processingBinding.operation.operationId', code),
      kind: requireId(operation.kind, 'processingBinding.operation.kind', code),
      processorId: requireId(operation.processorId, 'processingBinding.operation.processorId', code),
    },
    recipeInput,
    selectedOutput,
    pixelSize: normalizedPixelSize,
    pivot: null,
  };
  invariant(
    requireHash(binding.fingerprint, 'processingBinding.fingerprint', code) === sha256Json(body),
    code,
    'Processing binding fingerprint does not match its canonical content.',
    { field: 'processingBinding.fingerprint' },
  );
  return deepFreeze({ ...body, fingerprint: sha256Json(body) });
}

function authoredMetadataFromStored(value, code) {
  const metadata = exactRecord(value, STORED_METADATA_FIELDS, 'currentAsset.metadata', code);
  return Object.fromEntries(AUTHORED_METADATA_FIELDS.map((field) => [field, metadata[field]]));
}

function currentBindingVisualFacts(binding) {
  if (binding.kind === PROCESSING_RESULT_ASSET_BINDING_KIND) {
    return { pixelSize: binding.pixelSize, pivot: binding.pivot };
  }
  return {
    pixelSize: { width: binding.width, height: binding.height },
    pivot: binding.rectangle.pivot,
  };
}

function normalizeCurrentAsset(value, command) {
  if (value === null) return null;
  const code = 'PROCESSING_RESULT_ADOPTION_CURRENT_ASSET_INVALID';
  const current = exactRecord(value, [
    'assetId', 'name', 'kind', 'assetVersion', 'metadataVersion', 'metadata',
    'metadataFingerprint', 'findings', 'binding',
  ], 'currentAsset', code);
  const binding = current.binding?.kind === PROCESSING_RESULT_ASSET_BINDING_KIND
    ? validateProcessingResultAssetBinding(current.binding)
    : validateExactSliceBinding(current.binding);
  const target = command.payload.preflightRequest.target;
  const kind = requireEnum(current.kind, ASSET_KINDS, 'currentAsset.kind', code);
  const assetId = requireId(current.assetId, 'currentAsset.assetId', code);
  invariant(
    assetId === target.assetId
      && kind === command.payload.preflightRequest.assetInputSelection.assetKind,
    code,
    'Current Asset identity or kind does not match the adoption target.',
    { field: 'currentAsset' },
  );
  invariant(binding.projectId === command.projectId, code, 'Current Asset binding belongs to another project.', { field: 'currentAsset.binding.projectId' });
  if (binding.kind === PROCESSING_RESULT_ASSET_BINDING_KIND) {
    invariant(
      binding.assetId === assetId && binding.assetKind === kind,
      code,
      'Current processing binding belongs to another Asset.',
      { field: 'currentAsset.binding' },
    );
  }
  const authored = authoredMetadataFromStored(current.metadata, code);
  const facts = currentBindingVisualFacts(binding);
  const validation = validateAssetMetadataForVisualFacts({
    assetId,
    kind,
    metadata: authored,
    pixelSize: facts.pixelSize,
    pivot: facts.pivot,
  });
  invariant(
    sameCanonical(current.metadata, validation.metadata),
    code,
    'Current Asset metadata does not match its validated authored and visual facts.',
    { field: 'currentAsset.metadata' },
  );
  invariant(
    current.metadataFingerprint === validation.fingerprint,
    code,
    'Current Asset metadata fingerprint is stale or corrupt.',
    { field: 'currentAsset.metadataFingerprint' },
  );
  invariant(
    sameCanonical(current.findings, validation.findings),
    code,
    'Current Asset findings are stale or corrupt.',
    { field: 'currentAsset.findings' },
  );
  return deepFreeze({
    assetId,
    name: requireName(current.name, 'currentAsset.name', code),
    kind,
    assetVersion: requireInteger(current.assetVersion, 'currentAsset.assetVersion', code, { min: 1, max: MAX_INCREMENTABLE_VERSION }),
    metadataVersion: requireInteger(current.metadataVersion, 'currentAsset.metadataVersion', code, { min: 1, max: MAX_INCREMENTABLE_VERSION }),
    metadata: validation.metadata,
    metadataFingerprint: validation.fingerprint,
    findings: validation.findings,
    binding,
  });
}

function normalizeOptions(value, command, authorityBinding) {
  const code = 'PROCESSING_RESULT_ADOPTION_AGGREGATE_INVALID';
  const options = exactRecord(snapshotPlainData(value, 'options', code), [
    'branchRevision', 'committedAt', 'committedBy', 'currentAsset',
  ], 'options', code);
  const branchRevision = requireInteger(options.branchRevision, 'options.branchRevision', code, { min: 2 });
  invariant(
    branchRevision === command.baseRevision + 1,
    code,
    'The committed branch revision must immediately follow the command base revision.',
    { field: 'options.branchRevision' },
  );
  const committedBy = requireId(options.committedBy, 'options.committedBy', code);
  invariant(
    committedBy === authorityBinding.actorId,
    code,
    'The committing actor must match the trusted authority binding.',
    { field: 'options.committedBy' },
  );
  const currentAsset = normalizeCurrentAsset(options.currentAsset, command);
  const operation = command.payload.preflightRequest.target.operation;
  invariant(
    (operation === 'create' && currentAsset === null)
      || (operation === 'update' && currentAsset !== null),
    code,
    'Create requires currentAsset null and update requires one exact current Asset.',
    { field: 'options.currentAsset' },
  );
  return deepFreeze({
    branchRevision,
    committedAt: requireIsoDate(options.committedAt, 'options.committedAt', code),
    committedBy,
    currentAsset,
  });
}

function normalizeCommitResult(value) {
  const code = 'PROCESSING_RESULT_ADOPTION_COMMIT_RESULT_INVALID';
  const result = exactRecord(snapshotPlainData(value, 'commitResult', code), [
    'schemaVersion', 'kind', 'status', 'projectId', 'taskId', 'branchId',
    'branchRevision', 'commandId', 'idempotencyKey', 'semanticFingerprint',
    'operation', 'asset', 'permanentReferences', 'commandBudgetCharge',
    'committedAt',
  ], 'commitResult', code);
  invariant(
    result.schemaVersion === PROCESSING_RESULT_ADOPTION_COMMIT_RESULT_SCHEMA_VERSION
      && result.kind === PROCESSING_RESULT_ADOPTION_COMMIT_RESULT_KIND
      && result.status === 'COMMITTED',
    code,
    'Unsupported processing-result adoption commit result.',
    { field: 'commitResult' },
  );
  const asset = exactRecord(result.asset, [
    'assetId', 'assetVersion', 'metadataVersion', 'lifecycle',
    'metadataFingerprint', 'findingsFingerprint', 'processingBindingFingerprint',
  ], 'commitResult.asset', code);
  invariant(asset.lifecycle === 'DRAFT', code, 'Processing-result adoption can commit only a DRAFT Asset.', { field: 'commitResult.asset.lifecycle' });
  invariant(
    Array.isArray(result.permanentReferences)
      && result.permanentReferences.length === PROCESSING_RESULT_ADOPTION_REFERENCE_ROLES.length,
    code,
    'Commit result must contain both fixed permanent reference roles.',
    { field: 'commitResult.permanentReferences' },
  );
  const permanentReferences = result.permanentReferences.map((value, index) => {
    const reference = exactRecord(value, ['role', 'digest'], `commitResult.permanentReferences[${index}]`, code);
    invariant(
      reference.role === PROCESSING_RESULT_ADOPTION_REFERENCE_ROLES[index],
      code,
      'Commit result permanent references must use the fixed role order.',
      { field: `commitResult.permanentReferences[${index}].role` },
    );
    return {
      role: reference.role,
      digest: requireHash(reference.digest, `commitResult.permanentReferences[${index}].digest`, code),
    };
  });
  invariant(result.commandBudgetCharge === 1, code, 'Processing-result adoption charges exactly one command.', { field: 'commitResult.commandBudgetCharge' });
  return deepFreeze({
    schemaVersion: PROCESSING_RESULT_ADOPTION_COMMIT_RESULT_SCHEMA_VERSION,
    kind: PROCESSING_RESULT_ADOPTION_COMMIT_RESULT_KIND,
    status: 'COMMITTED',
    projectId: requireId(result.projectId, 'commitResult.projectId', code),
    taskId: requireId(result.taskId, 'commitResult.taskId', code),
    branchId: requireId(result.branchId, 'commitResult.branchId', code),
    branchRevision: requireInteger(result.branchRevision, 'commitResult.branchRevision', code, { min: 2 }),
    commandId: requireId(result.commandId, 'commitResult.commandId', code),
    idempotencyKey: requireId(result.idempotencyKey, 'commitResult.idempotencyKey', code),
    semanticFingerprint: requireHash(result.semanticFingerprint, 'commitResult.semanticFingerprint', code),
    operation: requireEnum(result.operation, ['create', 'update'], 'commitResult.operation', code),
    asset: {
      assetId: requireId(asset.assetId, 'commitResult.asset.assetId', code),
      assetVersion: requireInteger(asset.assetVersion, 'commitResult.asset.assetVersion', code, { min: 1 }),
      metadataVersion: requireInteger(asset.metadataVersion, 'commitResult.asset.metadataVersion', code, { min: 1 }),
      lifecycle: 'DRAFT',
      metadataFingerprint: requireHash(asset.metadataFingerprint, 'commitResult.asset.metadataFingerprint', code),
      findingsFingerprint: requireHash(asset.findingsFingerprint, 'commitResult.asset.findingsFingerprint', code),
      processingBindingFingerprint: requireHash(asset.processingBindingFingerprint, 'commitResult.asset.processingBindingFingerprint', code),
    },
    permanentReferences,
    commandBudgetCharge: 1,
    committedAt: requireIsoDate(result.committedAt, 'commitResult.committedAt', code),
  });
}

function commitResultFor({
  command,
  authorityBinding,
  branchRevision,
  semanticFingerprint,
  operation,
  asset,
  references,
  committedAt,
}) {
  return normalizeCommitResult({
    schemaVersion: PROCESSING_RESULT_ADOPTION_COMMIT_RESULT_SCHEMA_VERSION,
    kind: PROCESSING_RESULT_ADOPTION_COMMIT_RESULT_KIND,
    status: 'COMMITTED',
    projectId: command.projectId,
    taskId: authorityBinding.taskId,
    branchId: authorityBinding.branchId,
    branchRevision,
    commandId: command.commandId,
    idempotencyKey: command.idempotencyKey,
    semanticFingerprint,
    operation,
    asset: {
      assetId: asset.assetId,
      assetVersion: asset.assetVersion,
      metadataVersion: asset.metadataVersion,
      lifecycle: asset.lifecycle,
      metadataFingerprint: asset.metadataFingerprint,
      findingsFingerprint: asset.findingsFingerprint,
      processingBindingFingerprint: asset.processingBinding.fingerprint,
    },
    permanentReferences: references.map(({ role, descriptor }) => ({ role, digest: descriptor.sha256 })),
    commandBudgetCharge: 1,
    committedAt,
  });
}

export function createProcessingResultAdoptionAggregate(
  commandValue,
  authorityBindingValue,
  freshPreflightReceiptValue,
  optionsValue,
) {
  const command = validateProcessingResultAdoptionCommand(commandValue);
  const authorityBinding = validateProcessingResultAdoptionAuthorityBinding(authorityBindingValue);
  const freshPreflightReceipt = validateProcessingAdoptionPreflightReceipt(freshPreflightReceiptValue);
  const plan = createProcessingResultAdoptionPlan(command, authorityBinding, freshPreflightReceipt);
  const options = normalizeOptions(optionsValue, command, authorityBinding);
  const target = command.payload.preflightRequest.target;
  const operation = target.operation;
  const currentAsset = options.currentAsset;
  if (currentAsset) {
    invariant(
      currentAsset.assetVersion === target.expectedAssetVersion
        && currentAsset.metadataVersion === target.expectedMetadataVersion,
      'PROCESSING_RESULT_ADOPTION_CURRENT_ASSET_CONFLICT',
      'Current Asset versions do not match the command target coordinates.',
      {
        expectedAssetVersion: target.expectedAssetVersion,
        actualAssetVersion: currentAsset.assetVersion,
        expectedMetadataVersion: target.expectedMetadataVersion,
        actualMetadataVersion: currentAsset.metadataVersion,
      },
    );
  }
  const processingBinding = validateProcessingResultAssetBinding(createProcessingResultAssetBinding(command));
  const metadataValidation = operation === 'create'
    ? {
      metadata: plan.target.initialMetadata,
      fingerprint: plan.target.initialMetadataFingerprint,
      findings: plan.target.initialMetadataFindings,
    }
    : validateAssetMetadataForVisualFacts({
      assetId: target.assetId,
      kind: currentAsset.kind,
      metadata: authoredMetadataFromStored(currentAsset.metadata, 'PROCESSING_RESULT_ADOPTION_CURRENT_ASSET_INVALID'),
      pixelSize: processingBinding.pixelSize,
      pivot: processingBinding.pivot,
    });
  const assetVersion = target.expectedAssetVersion + 1;
  const metadataVersion = operation === 'create'
    ? 1
    : currentAsset.metadataVersion + (currentAsset.metadataFingerprint === metadataValidation.fingerprint ? 0 : 1);
  const findingsFingerprint = sha256Json(metadataValidation.findings);
  const asset = deepFreeze({
    assetId: target.assetId,
    assetVersion,
    metadataVersion,
    previousAssetVersion: currentAsset?.assetVersion ?? null,
    previousMetadataVersion: currentAsset?.metadataVersion ?? null,
    name: operation === 'create' ? command.payload.assetName : currentAsset.name,
    kind: command.payload.preflightRequest.assetInputSelection.assetKind,
    lifecycle: 'DRAFT',
    metadata: metadataValidation.metadata,
    metadataFingerprint: metadataValidation.fingerprint,
    findings: metadataValidation.findings,
    findingsFingerprint,
    warningDispositions: [],
    processingBinding,
  });
  const references = deepFreeze([
    { role: 'recipe-input', descriptor: processingBinding.recipeInput },
    { role: 'selected-output', descriptor: processingBinding.selectedOutput },
  ]);
  const commandFingerprint = processingResultAdoptionCommandSha256(command);
  const semanticFingerprint = processingResultAdoptionSemanticSha256(command, authorityBinding);
  const commitResult = commitResultFor({
    command,
    authorityBinding,
    branchRevision: options.branchRevision,
    semanticFingerprint,
    operation,
    asset,
    references,
    committedAt: options.committedAt,
  });
  const originalProcessingResult = command.payload.preflightRequest.processingResult;
  const body = {
    schemaVersion: PROCESSING_RESULT_ADOPTION_AGGREGATE_SCHEMA_VERSION,
    kind: PROCESSING_RESULT_ADOPTION_AGGREGATE_KIND,
    project: {
      projectId: command.projectId,
      taskId: authorityBinding.taskId,
      branchId: authorityBinding.branchId,
      parentRevision: command.baseRevision,
      branchRevision: options.branchRevision,
    },
    operation,
    command,
    commandFingerprint,
    semanticFingerprint,
    authorityBinding,
    freshPreflightReceipt,
    freshPreflightReceiptFingerprint: processingAdoptionPreflightReceiptSha256(freshPreflightReceipt),
    planFingerprint: plan.planFingerprint,
    originalProcessingResult,
    originalProcessingResultFingerprint: processingResultSha256(originalProcessingResult),
    previousAsset: currentAsset,
    asset,
    permanentReferences: references,
    unresolvedProcessingWarnings: freshPreflightReceipt.unresolvedWarnings,
    commandBudgetCharge: 1,
    committedAt: options.committedAt,
    committedBy: options.committedBy,
    commitResult,
  };
  return deepFreeze({ ...body, aggregateFingerprint: sha256Json(body) });
}

export function validateProcessingResultAdoptionAggregate(value) {
  const code = 'PROCESSING_RESULT_ADOPTION_AGGREGATE_INVALID';
  const aggregate = exactRecord(snapshotPlainData(value, 'aggregate', code), [
    'schemaVersion', 'kind', 'project', 'operation', 'command',
    'commandFingerprint', 'semanticFingerprint', 'authorityBinding',
    'freshPreflightReceipt', 'freshPreflightReceiptFingerprint', 'planFingerprint',
    'originalProcessingResult', 'originalProcessingResultFingerprint',
    'previousAsset', 'asset', 'permanentReferences',
    'unresolvedProcessingWarnings', 'commandBudgetCharge', 'committedAt',
    'committedBy', 'commitResult', 'aggregateFingerprint',
  ], 'aggregate', code);
  invariant(
    aggregate.schemaVersion === PROCESSING_RESULT_ADOPTION_AGGREGATE_SCHEMA_VERSION
      && aggregate.kind === PROCESSING_RESULT_ADOPTION_AGGREGATE_KIND,
    code,
    'Unsupported processing-result adoption Aggregate schema or kind.',
    { field: 'aggregate' },
  );
  const project = exactRecord(aggregate.project, [
    'projectId', 'taskId', 'branchId', 'parentRevision', 'branchRevision',
  ], 'aggregate.project', code);
  const rebuilt = createProcessingResultAdoptionAggregate(
    aggregate.command,
    aggregate.authorityBinding,
    aggregate.freshPreflightReceipt,
    {
      branchRevision: project.branchRevision,
      committedAt: aggregate.committedAt,
      committedBy: aggregate.committedBy,
      currentAsset: aggregate.previousAsset,
    },
  );
  invariant(
    sameCanonical(aggregate, rebuilt),
    'PROCESSING_RESULT_ADOPTION_AGGREGATE_MISMATCH',
    'The persisted processing-result adoption Aggregate does not match its closed command, evidence, plan, Asset, or result.',
  );
  return rebuilt;
}

export function canonicalProcessingResultAdoptionAggregateJson(value) {
  return canonicalJson(validateProcessingResultAdoptionAggregate(value));
}

export function processingResultAdoptionAggregateSha256(value) {
  return createHash('sha256')
    .update(canonicalProcessingResultAdoptionAggregateJson(value))
    .digest('hex');
}

export function createProcessingResultAdoptionCommitResult(aggregateValue) {
  return validateProcessingResultAdoptionAggregate(aggregateValue).commitResult;
}

export function validateProcessingResultAdoptionCommitResult(value) {
  return normalizeCommitResult(value);
}

export function canonicalProcessingResultAdoptionCommitResultJson(value) {
  return canonicalJson(validateProcessingResultAdoptionCommitResult(value));
}

export function processingResultAdoptionCommitResultSha256(value) {
  return createHash('sha256')
    .update(canonicalProcessingResultAdoptionCommitResultJson(value))
    .digest('hex');
}
