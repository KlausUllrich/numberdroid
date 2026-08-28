import { createHash } from 'node:crypto';
import { types as utilTypes } from 'node:util';
import {
  assetInputSelectionSha256,
} from './asset-input-selection.js';
import { validateAssetMetadataForVisualFacts } from './asset-definition.js';
import { invariant } from './errors.js';
import {
  processingAdoptionPreflightReceiptSha256,
  processingAdoptionPreflightRequestSha256,
  validateProcessingAdoptionPreflightReceipt,
  validateProcessingAdoptionPreflightRequest,
} from './processing-adoption-preflight.js';
import { processingRecipeSha256 } from './processing-recipe.js';
import { processingResultSha256 } from './processing-result.js';

export const PROCESSING_RESULT_ADOPTION_SCHEMA_VERSION = 1;
export const PROCESSING_RESULT_ADOPTION_COMMAND_KIND = 'studio.processing-result-adoption-command';
export const PROCESSING_RESULT_ADOPTION_COMMAND_TYPE = 'asset.processing-result.adopt';
export const PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE = 'asset.processing-result.adopt';
export const PROCESSING_RESULT_ASSET_BINDING_KIND = 'studio.processing-result-asset-binding';
export const PROCESSING_RESULT_ADOPTION_AUTHORITY_BINDING_KIND = 'studio.processing-result-adoption-authority-binding';
export const PROCESSING_RESULT_ADOPTION_PLAN_KIND = 'studio.processing-result-adoption-plan';
export const PROCESSING_RESULT_ADOPTION_PLANNING_RESULT_KIND = 'studio.processing-result-adoption-planning-result';

export const PROCESSING_RESULT_ADOPTION_REFERENCE_ROLES = Object.freeze([
  'recipe-input',
  'selected-output',
]);

export const PROCESSING_RESULT_ADOPTION_REVALIDATION_REQUIREMENTS = Object.freeze([
  'TASK_AND_GRANT_AUTHORITY',
  'TASK_BRANCH_HEAD',
  'PROJECT_CAPABILITY',
  'ASSET_IDENTITY_AND_HEAD',
  'ASSET_AUTHORED_METADATA',
  'ASSET_DERIVED_VISUAL_FACTS',
  'ASSET_METADATA_FINGERPRINT',
  'ASSET_VALIDATION_FINDINGS',
  'ASSET_WARNING_DISPOSITION_STATE',
  'RECIPE_INPUT_PROJECT_REFERENCE',
  'RECIPE_INPUT_LIVE_METADATA',
  'RECIPE_INPUT_PHYSICAL_DESCRIPTOR',
  'SELECTED_OUTPUT_PROJECT_REFERENCE',
  'SELECTED_OUTPUT_LIVE_METADATA',
  'SELECTED_OUTPUT_PHYSICAL_DESCRIPTOR',
  'IDEMPOTENCY_AND_COMMAND_LEDGER',
]);

export const PROCESSING_RESULT_ADOPTION_ATOMIC_EFFECTS = Object.freeze([
  'TASK_BRANCH_REVISION',
  'DRAFT_ASSET_VERSION',
  'ASSET_METADATA',
  'ASSET_VALIDATION_FINDINGS',
  'ASSET_WARNING_DISPOSITION_RESET',
  'PROCESSING_RESULT_LINEAGE',
  'PERMANENT_ARTIFACT_REFERENCES',
  'ACTIVITY',
  'IDEMPOTENCY_RESULT',
  'COMMAND_BUDGET_CHARGE',
]);

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const AUTHORITY_FIELD_PATTERN = /^(?:actor|taskId|grantId|branchId|bindingToken|bindingId|issuer|issuerActorId|authority|authorization)$/i;
const MAX_INCREMENTABLE_VERSION = Number.MAX_SAFE_INTEGER - 1;

function failInvalid(message, field, code = 'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID') {
  invariant(false, code, message, { field });
}

/**
 * Snapshot the complete untrusted graph before accepted nested validators run.
 * No getter, proxy trap, inherited hook, setter, or custom prototype is used.
 */
function snapshotPlainData(value, label, state = { ancestors: new WeakSet(), nodes: 0 }, depth = 0) {
  state.nodes += 1;
  invariant(
    state.nodes <= 20_000 && depth <= 48,
    'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID',
    `${label} exceeds the bounded plain-data graph accepted by adoption v1.`,
    { field: label },
  );
  if (value === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof value)) return value;
  invariant(
    typeof value === 'object' && !utilTypes.isProxy(value),
    'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID',
    `${label} must be plain inspectable data.`,
    { field: label },
  );
  invariant(
    !state.ancestors.has(value),
    'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID',
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
      'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID',
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
      'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID',
      `${label} must be a bounded dense array.`,
      { field: label },
    );
    const allowed = new Set(['length', ...Array.from({ length }, (_, index) => String(index))]);
    for (const key of keys) {
      invariant(
        typeof key === 'string' && allowed.has(key),
        'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID',
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
        failInvalid(`${label}[${index}] must be inspectable.`, `${label}[${index}]`);
      }
      invariant(
        descriptor && Object.hasOwn(descriptor, 'value') && descriptor.enumerable === true,
        'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID',
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
    'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID',
    `${label} must be a plain object.`,
    { field: label },
  );
  const result = Object.create(null);
  for (const key of keys) {
    invariant(
      typeof key === 'string',
      'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID',
      `${label} must not contain symbol fields.`,
      { field: label },
    );
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      failInvalid(`${label}.${key} must be inspectable.`, `${label}.${key}`);
    }
    invariant(
      descriptor && Object.hasOwn(descriptor, 'value') && descriptor.enumerable === true,
      'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID',
      `${label}.${key} must be an enumerable own data field.`,
      { field: `${label}.${key}` },
    );
    result[key] = snapshotPlainData(descriptor.value, `${label}.${key}`, state, depth + 1);
  }
  state.ancestors.delete(value);
  return result;
}

function exactRecord(value, allowed, label, code = 'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID') {
  invariant(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    code,
    `${label} must be an object.`,
    { field: label },
  );
  for (const field of Object.keys(value)) {
    invariant(
      allowed.includes(field),
      AUTHORITY_FIELD_PATTERN.test(field)
        ? 'UNTRUSTED_AUTHORITY_FIELD'
        : 'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID',
      `${label}.${field} is not permitted by adoption v1.`,
      { field: `${label}.${field}` },
    );
  }
  return value;
}

function requireId(value, label, code = 'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID') {
  invariant(
    typeof value === 'string' && ID_PATTERN.test(value),
    code,
    `${label} must be a safe stable Studio identifier.`,
    { field: label },
  );
  return value;
}

function requireInteger(value, label, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  invariant(
    Number.isSafeInteger(value) && value >= min && value <= max,
    'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID',
    `${label} must be a safe integer from ${min} to ${max}.`,
    { field: label },
  );
  return value;
}

function requireName(value, label) {
  invariant(
    typeof value === 'string'
      && value.trim() === value
      && value.length >= 1
      && value.length <= 160
      && !CONTROL_CHARACTER_PATTERN.test(value),
    'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID',
    `${label} must be a bounded trimmed display name.`,
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

function cloneArtifactDescriptor(value) {
  return {
    artifactUri: value.artifactUri,
    sha256: value.sha256,
    mediaType: value.mediaType,
    byteSize: value.byteSize,
    width: value.width,
    height: value.height,
  };
}

export function validateProcessingResultAdoptionCommand(value) {
  const command = exactRecord(snapshotPlainData(value, 'command'), [
    'schemaVersion', 'kind', 'commandId', 'idempotencyKey', 'type',
    'projectId', 'baseRevision', 'expectedVersion', 'payload',
  ], 'command');
  invariant(
    command.schemaVersion === PROCESSING_RESULT_ADOPTION_SCHEMA_VERSION,
    'PROCESSING_RESULT_ADOPTION_COMMAND_SCHEMA_UNSUPPORTED',
    'Unsupported processing-result adoption command schema version.',
    { field: 'command.schemaVersion' },
  );
  invariant(
    command.kind === PROCESSING_RESULT_ADOPTION_COMMAND_KIND
      && command.type === PROCESSING_RESULT_ADOPTION_COMMAND_TYPE,
    'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID',
    'Processing-result adoption command kind or type is invalid.',
    { field: 'command.kind' },
  );
  const payload = exactRecord(command.payload, ['preflightRequest', 'assetName'], 'command.payload');
  const preflightRequest = validateProcessingAdoptionPreflightRequest(payload.preflightRequest);
  const projectId = requireId(command.projectId, 'command.projectId');
  const baseRevision = requireInteger(command.baseRevision, 'command.baseRevision', { min: 1, max: MAX_INCREMENTABLE_VERSION });
  const expectedVersion = requireInteger(command.expectedVersion, 'command.expectedVersion', { min: 1, max: MAX_INCREMENTABLE_VERSION });
  requireInteger(
    preflightRequest.target.expectedAssetVersion,
    'command.payload.preflightRequest.target.expectedAssetVersion',
    { max: MAX_INCREMENTABLE_VERSION },
  );
  requireInteger(
    preflightRequest.target.expectedMetadataVersion,
    'command.payload.preflightRequest.target.expectedMetadataVersion',
    { max: MAX_INCREMENTABLE_VERSION },
  );
  invariant(
    projectId === preflightRequest.project.projectId,
    'PROCESSING_RESULT_ADOPTION_COMMAND_SCOPE_MISMATCH',
    'Command and preflight project IDs must match.',
    { field: 'command.projectId' },
  );
  invariant(
    baseRevision === expectedVersion
      && baseRevision === preflightRequest.project.expectedRevision,
    'PROCESSING_RESULT_ADOPTION_COMMAND_SCOPE_MISMATCH',
    'Command, expected, and preflight revisions must be identical.',
    { field: 'command.baseRevision' },
  );
  const assetName = preflightRequest.target.operation === 'create'
    ? requireName(payload.assetName, 'command.payload.assetName')
    : (() => {
      invariant(
        payload.assetName === null,
        'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID',
        'Update adoption preserves the current Asset name and requires assetName null.',
        { field: 'command.payload.assetName' },
      );
      return null;
    })();
  return deepFreeze({
    schemaVersion: PROCESSING_RESULT_ADOPTION_SCHEMA_VERSION,
    kind: PROCESSING_RESULT_ADOPTION_COMMAND_KIND,
    commandId: requireId(command.commandId, 'command.commandId'),
    idempotencyKey: requireId(command.idempotencyKey, 'command.idempotencyKey'),
    type: PROCESSING_RESULT_ADOPTION_COMMAND_TYPE,
    projectId,
    baseRevision,
    expectedVersion,
    payload: { preflightRequest, assetName },
  });
}

export function canonicalProcessingResultAdoptionCommandJson(value) {
  return canonicalJson(validateProcessingResultAdoptionCommand(value));
}

export function processingResultAdoptionCommandSha256(value) {
  return createHash('sha256')
    .update(canonicalProcessingResultAdoptionCommandJson(value))
    .digest('hex');
}

export function validateProcessingResultAdoptionAuthorityBinding(value) {
  const binding = exactRecord(snapshotPlainData(value, 'authorityBinding'), [
    'schemaVersion', 'kind', 'projectId', 'revision', 'actorId', 'taskId',
    'grantId', 'branchId',
  ], 'authorityBinding');
  invariant(
    binding.schemaVersion === PROCESSING_RESULT_ADOPTION_SCHEMA_VERSION
      && binding.kind === PROCESSING_RESULT_ADOPTION_AUTHORITY_BINDING_KIND,
    'PROCESSING_RESULT_ADOPTION_COMMAND_SCHEMA_UNSUPPORTED',
    'Unsupported processing-result adoption authority binding.',
    { field: 'authorityBinding' },
  );
  const branchId = requireId(binding.branchId, 'authorityBinding.branchId');
  invariant(
    branchId !== 'branch.main',
    'TASK_BRANCH_REQUIRED',
    'Processing-result adoption planning requires an isolated task branch.',
  );
  return deepFreeze({
    schemaVersion: PROCESSING_RESULT_ADOPTION_SCHEMA_VERSION,
    kind: PROCESSING_RESULT_ADOPTION_AUTHORITY_BINDING_KIND,
    projectId: requireId(binding.projectId, 'authorityBinding.projectId'),
    revision: requireInteger(binding.revision, 'authorityBinding.revision', { min: 1, max: MAX_INCREMENTABLE_VERSION }),
    actorId: requireId(binding.actorId, 'authorityBinding.actorId'),
    taskId: requireId(binding.taskId, 'authorityBinding.taskId'),
    grantId: requireId(binding.grantId, 'authorityBinding.grantId'),
    branchId,
  });
}

export function processingResultAdoptionSemanticSha256(commandValue, authorityBindingValue) {
  const command = validateProcessingResultAdoptionCommand(commandValue);
  const authorityBinding = validateProcessingResultAdoptionAuthorityBinding(authorityBindingValue);
  invariant(
    authorityBinding.projectId === command.projectId
      && authorityBinding.revision === command.baseRevision,
    'PROCESSING_RESULT_ADOPTION_COMMAND_SCOPE_MISMATCH',
    'The trusted task authority binding must match the command project and branch revision.',
    { field: 'authorityBinding' },
  );
  return sha256Json({
    schemaVersion: command.schemaVersion,
    type: command.type,
    projectId: command.projectId,
    baseRevision: command.baseRevision,
    expectedVersion: command.expectedVersion,
    payload: command.payload,
    authorityBinding,
  });
}

export function createProcessingResultAssetBinding(commandValue) {
  const command = validateProcessingResultAdoptionCommand(commandValue);
  const request = command.payload.preflightRequest;
  const recipe = request.processingRecipe;
  const result = request.processingResult;
  const selection = request.assetInputSelection;
  const operation = result.operations[0];
  const binding = {
    schemaVersion: PROCESSING_RESULT_ADOPTION_SCHEMA_VERSION,
    kind: PROCESSING_RESULT_ASSET_BINDING_KIND,
    projectId: command.projectId,
    assetId: request.target.assetId,
    assetKind: selection.assetKind,
    inputRole: selection.inputRole,
    recipe: {
      id: recipe.recipeId,
      version: recipe.recipeVersion,
      fingerprint: processingRecipeSha256(recipe),
    },
    processingResult: {
      schemaVersion: result.schemaVersion,
      kind: result.kind,
      fingerprint: processingResultSha256(result),
    },
    assetInputSelection: {
      schemaVersion: selection.schemaVersion,
      kind: selection.kind,
      fingerprint: assetInputSelectionSha256(selection),
    },
    operation: {
      operationId: operation.operationId,
      kind: operation.kind,
      processorId: operation.processorId,
    },
    recipeInput: cloneArtifactDescriptor(recipe.inputs[0]),
    selectedOutput: cloneArtifactDescriptor(selection.selectedOutput),
    pixelSize: {
      width: selection.selectedOutput.width,
      height: selection.selectedOutput.height,
    },
    pivot: null,
  };
  return deepFreeze({ ...binding, fingerprint: sha256Json(binding) });
}

function emptyDraftAuthoredMetadata() {
  return {
    role: null,
    tags: [],
    variantGroup: null,
    compatibilityGroups: [],
    spanTiles: null,
    anchor: null,
    attachment: null,
    rotationPolicy: null,
    placement: {
      modes: [],
      wallSafe: null,
      tags: [],
      confirmation: 'missing',
    },
    collision: null,
    navigation: null,
    runtimeEligible: null,
    connectors: [],
    continuityProfile: null,
    continuityTags: [],
    selectionPriority: 0,
    visualWeight: null,
    extensions: {},
  };
}

export function createProcessingResultAdoptionPlan(
  commandValue,
  authorityBindingValue,
  freshPreflightReceiptValue,
) {
  const command = validateProcessingResultAdoptionCommand(commandValue);
  const authorityBinding = validateProcessingResultAdoptionAuthorityBinding(authorityBindingValue);
  const receipt = validateProcessingAdoptionPreflightReceipt(freshPreflightReceiptValue);
  invariant(
    receipt.requestFingerprint === processingAdoptionPreflightRequestSha256(command.payload.preflightRequest),
    'PROCESSING_RESULT_ADOPTION_REVALIDATION_BLOCKED',
    'The fresh preflight receipt must close the exact command request.',
    { field: 'freshPreflightReceipt' },
  );
  invariant(
    receipt.status === 'PREFLIGHT_PASSED',
    'PROCESSING_RESULT_ADOPTION_REVALIDATION_BLOCKED',
    'A blocked preflight cannot produce an adoption plan.',
    { blockers: receipt.blockers.map(({ code }) => code) },
  );
  invariant(
    authorityBinding.projectId === command.projectId
      && authorityBinding.revision === command.baseRevision,
    'PROCESSING_RESULT_ADOPTION_COMMAND_SCOPE_MISMATCH',
    'The authority binding must match the command project and task-branch revision.',
    { field: 'authorityBinding' },
  );
  const target = command.payload.preflightRequest.target;
  const binding = createProcessingResultAssetBinding(command);
  const create = target.operation === 'create';
  const initialMetadataValidation = create
    ? validateAssetMetadataForVisualFacts({
      assetId: target.assetId,
      kind: command.payload.preflightRequest.assetInputSelection.assetKind,
      metadata: emptyDraftAuthoredMetadata(),
      pixelSize: binding.pixelSize,
      pivot: binding.pivot,
    })
    : null;
  const body = {
    schemaVersion: PROCESSING_RESULT_ADOPTION_SCHEMA_VERSION,
    kind: PROCESSING_RESULT_ADOPTION_PLAN_KIND,
    status: 'READY_FOR_ATOMIC_UNIT_OF_WORK',
    effect: 'NONE',
    authorization: 'NOT_GRANTED',
    persistence: 'NOT_PERFORMED',
    commitState: 'NOT_ATTEMPTED',
    idempotencyState: 'NOT_CHECKED',
    replayState: 'NOT_PERFORMED',
    revalidation: 'REQUIRED_IN_ATOMIC_UNIT_OF_WORK',
    commandFingerprint: processingResultAdoptionCommandSha256(command),
    semanticFingerprint: processingResultAdoptionSemanticSha256(command, authorityBinding),
    authority: {
      actorId: authorityBinding.actorId,
      taskId: authorityBinding.taskId,
      branchId: authorityBinding.branchId,
      bindingFingerprint: sha256Json(authorityBinding),
      requiredScope: PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE,
      requiredObjectScopes: [
        { kind: 'asset', id: target.assetId },
        { kind: 'project', id: command.projectId },
      ],
      requiresTaskBranch: true,
      ownerOnly: false,
      autoAcceptAllowed: false,
      commandBudgetCharge: 1,
    },
    idempotencyPolicy: {
      state: 'NOT_CHECKED',
      replay: 'NOT_PERFORMED',
      keyScope: 'TASK_BRANCH',
      sameKeySameSemanticFingerprint: 'RETURN_ORIGINAL_RESULT',
      sameKeyDifferentSemanticFingerprint: 'FAIL_IDEMPOTENCY_CONFLICT',
      sameCommandIdDifferentKey: 'FAIL_COMMAND_ID_CONFLICT',
      enforcement: 'REQUIRED_IN_ATOMIC_UNIT_OF_WORK',
    },
    atomicUnitPolicy: {
      state: 'NOT_ATTEMPTED',
      boundary: 'ALL_LISTED_EFFECTS_OR_NONE',
      partialCommit: 'FORBIDDEN',
      unknownOutcomeRecovery: 'RETRY_SAME_IDEMPOTENCY_KEY',
    },
    project: {
      projectId: command.projectId,
      branchId: authorityBinding.branchId,
      expectedRevision: command.baseRevision,
    },
    target: {
      operation: target.operation,
      assetId: target.assetId,
      assetKind: command.payload.preflightRequest.assetInputSelection.assetKind,
      expectedAssetVersion: target.expectedAssetVersion,
      expectedMetadataVersion: target.expectedMetadataVersion,
      predictedAssetVersion: target.expectedAssetVersion + 1,
      predictedMetadataVersion: create ? 1 : null,
      metadataVersionPolicy: create
        ? 'INITIALIZE_ONE'
        : 'PRESERVE_IF_REVALIDATED_FINGERPRINT_UNCHANGED_ELSE_INCREMENT',
      conditionalMetadataVersions: create ? null : {
        ifFingerprintUnchanged: target.expectedMetadataVersion,
        ifFingerprintChanged: target.expectedMetadataVersion + 1,
      },
      lifecyclePolicy: create ? 'INITIALIZE_DRAFT' : 'RESET_NEW_VERSION_TO_DRAFT',
      lifecycle: 'DRAFT',
      namePolicy: create ? 'SET_EXPLICIT_CREATE_NAME' : 'PRESERVE_CURRENT',
      assetName: create ? command.payload.assetName : null,
      metadataPolicy: create
        ? 'INITIALIZE_EXPLICIT_EMPTY_DRAFT_V1'
        : 'PRESERVE_AUTHORED_REVALIDATE_DERIVED_VISUAL_FACTS',
      metadataValidation: 'REQUIRED_IN_ATOMIC_UNIT_OF_WORK',
      metadataVisualFacts: {
        pixelSize: { ...binding.pixelSize },
        pivot: binding.pivot,
      },
      // Re-root the trusted normalized document so the plan's recursive freeze
      // also reaches the nested arrays and records below the validator's
      // intentionally shallow frozen return value.
      initialMetadata: initialMetadataValidation
        ? { ...initialMetadataValidation.metadata }
        : null,
      initialMetadataFingerprint: initialMetadataValidation?.fingerprint ?? null,
      initialMetadataFindings: initialMetadataValidation?.findings ?? null,
      currentMetadata: null,
      currentMetadataFingerprint: null,
      currentMetadataFindings: null,
      warningDispositions: [],
    },
    processingBinding: binding,
    freshPreflightReceiptFingerprint: processingAdoptionPreflightReceiptSha256(receipt),
    warningDisposition: receipt.unresolvedWarnings.length === 0 ? 'NONE' : 'UNRESOLVED',
    unresolvedWarnings: receipt.unresolvedWarnings.map((warning) => ({ ...warning })),
    changeKey: `asset_v2:${target.assetId}`,
    permanentReferenceRoles: [...PROCESSING_RESULT_ADOPTION_REFERENCE_ROLES],
    revalidationRequirements: [...PROCESSING_RESULT_ADOPTION_REVALIDATION_REQUIREMENTS],
    atomicEffects: [...PROCESSING_RESULT_ADOPTION_ATOMIC_EFFECTS],
  };
  return deepFreeze({ ...body, planFingerprint: sha256Json(body) });
}

export function createProcessingResultAdoptionPlanningResult(
  commandValue,
  authorityBindingValue,
  freshPreflightReceiptValue,
) {
  const command = validateProcessingResultAdoptionCommand(commandValue);
  const authorityBinding = validateProcessingResultAdoptionAuthorityBinding(authorityBindingValue);
  const receipt = validateProcessingAdoptionPreflightReceipt(freshPreflightReceiptValue);
  invariant(
    receipt.requestFingerprint === processingAdoptionPreflightRequestSha256(command.payload.preflightRequest),
    'PROCESSING_RESULT_ADOPTION_REVALIDATION_BLOCKED',
    'The fresh preflight receipt must close the exact command request.',
    { field: 'freshPreflightReceipt' },
  );
  const plan = receipt.status === 'PREFLIGHT_PASSED'
    ? createProcessingResultAdoptionPlan(command, authorityBinding, receipt)
    : null;
  return deepFreeze({
    schemaVersion: PROCESSING_RESULT_ADOPTION_SCHEMA_VERSION,
    kind: PROCESSING_RESULT_ADOPTION_PLANNING_RESULT_KIND,
    status: plan ? 'READY' : 'BLOCKED',
    effect: 'NONE',
    authorization: 'NOT_GRANTED',
    persistence: 'NOT_PERFORMED',
    commitState: 'NOT_ATTEMPTED',
    idempotencyState: 'NOT_CHECKED',
    replayState: 'NOT_PERFORMED',
    revalidation: 'REQUIRED_IN_ATOMIC_UNIT_OF_WORK',
    commandFingerprint: processingResultAdoptionCommandSha256(command),
    semanticFingerprint: processingResultAdoptionSemanticSha256(command, authorityBinding),
    freshPreflightReceipt: receipt,
    plan,
  });
}
