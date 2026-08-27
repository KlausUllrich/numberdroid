import { createHash } from 'node:crypto';
import { isDeepStrictEqual, types as utilTypes } from 'node:util';
import {
  ATLAS_PROCESSOR_ID,
  MAX_ATLAS_INPUT_BYTES,
  MAX_ATLAS_OUTPUT_BYTES,
  MAX_ATLAS_SOURCE_DIMENSION,
  canonicalRgbaPngByteSize,
} from './atlas-definition.js';
import { invariant } from './errors.js';
import { EXACT_PNG_CROP_OPERATION_KIND } from './processing-recipe.js';
import {
  PROCESSING_RESULT_KIND,
  PROCESSING_RESULT_SCHEMA_VERSION,
  processingResultSha256,
  validateProcessingResult,
} from './processing-result.js';

export const ASSET_INPUT_SELECTION_SCHEMA_VERSION = 1;
export const ASSET_INPUT_SELECTION_KIND = 'studio.asset-input-selection';
export const PRIMARY_VISUAL_ASSET_INPUT_ROLE = 'primary-visual';
export const ASSET_INPUT_SELECTION_ASSET_KINDS = Object.freeze([
  'surface',
  'prop',
  'item',
]);

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const CAS_URI_PATTERN = /^studio:\/\/artifacts\/sha256\/([a-f0-9]{64})$/;

function invalidShape(message, field) {
  invariant(false, 'ASSET_INPUT_SELECTION_INVALID', message, { field });
}

function exactRecord(value, fields, label) {
  invariant(
    value !== null
      && typeof value === 'object'
      && !utilTypes.isProxy(value)
      && !Array.isArray(value),
    'ASSET_INPUT_SELECTION_INVALID',
    `${label} must be an object.`,
    { field: label },
  );

  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    invalidShape(`${label} must be an inspectable plain object.`, label);
  }
  invariant(
    prototype === Object.prototype || prototype === null,
    'ASSET_INPUT_SELECTION_INVALID',
    `${label} must be a plain object.`,
    { field: label },
  );
  for (const key of keys) {
    invariant(
      typeof key === 'string' && fields.includes(key),
      'ASSET_INPUT_SELECTION_FIELD_FORBIDDEN',
      `${label} contains a field that is not permitted.`,
      { field: label },
    );
  }

  const snapshot = Object.create(null);
  for (const field of fields) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, field);
    } catch {
      invalidShape(`${label}.${field} must be an inspectable own data field.`, `${label}.${field}`);
    }
    invariant(
      descriptor
        && Object.hasOwn(descriptor, 'value')
        && descriptor.enumerable === true,
      'ASSET_INPUT_SELECTION_INVALID',
      `${label}.${field} must be an enumerable own data field.`,
      { field: `${label}.${field}` },
    );
    snapshot[field] = descriptor.value;
  }
  return snapshot;
}

function exactArray(value, length, label) {
  invariant(
    value !== null
      && typeof value === 'object'
      && !utilTypes.isProxy(value)
      && Array.isArray(value),
    'ASSET_INPUT_SELECTION_INVALID',
    `${label} must be an array.`,
    { field: label },
  );

  let prototype;
  let keys;
  let lengthDescriptor;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
    lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
  } catch {
    invalidShape(`${label} must be an inspectable plain array.`, label);
  }
  invariant(
    prototype === Array.prototype,
    'ASSET_INPUT_SELECTION_INVALID',
    `${label} must be a plain array.`,
    { field: label },
  );
  invariant(
    lengthDescriptor
      && Object.hasOwn(lengthDescriptor, 'value')
      && lengthDescriptor.value === length,
    'ASSET_INPUT_SELECTION_INVALID',
    `${label} must contain exactly ${length} entry.`,
    { field: label },
  );
  const allowedKeys = new Set(['length', ...Array.from({ length }, (_, index) => String(index))]);
  for (const key of keys) {
    invariant(
      typeof key === 'string' && allowedKeys.has(key),
      'ASSET_INPUT_SELECTION_FIELD_FORBIDDEN',
      `${label} contains an array field that is not permitted.`,
      { field: label },
    );
  }

  return Array.from({ length }, (_, index) => {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    } catch {
      invalidShape(`${label}[${index}] must be an inspectable own data field.`, `${label}[${index}]`);
    }
    invariant(
      descriptor
        && Object.hasOwn(descriptor, 'value')
        && descriptor.enumerable === true,
      'ASSET_INPUT_SELECTION_INVALID',
      `${label} must not contain sparse or accessor entries.`,
      { field: label },
    );
    return descriptor.value;
  });
}

function requireId(value, label) {
  invariant(
    typeof value === 'string' && ID_PATTERN.test(value),
    'ASSET_INPUT_SELECTION_INVALID',
    `${label} must be a safe stable Studio identifier.`,
    { field: label },
  );
  return value;
}

function requireHash(value, label) {
  invariant(
    typeof value === 'string' && HASH_PATTERN.test(value),
    'ASSET_INPUT_SELECTION_INVALID',
    `${label} must be a lowercase SHA-256 digest.`,
    { field: label },
  );
  return value;
}

function requireInteger(value, label, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  invariant(
    Number.isSafeInteger(value) && value >= min && value <= max,
    'ASSET_INPUT_SELECTION_INVALID',
    `${label} must be a safe integer from ${min} to ${max}.`,
    { field: label, min, max },
  );
  return value;
}

function requireArtifactUri(value, sha256, label) {
  const match = typeof value === 'string' ? CAS_URI_PATTERN.exec(value) : null;
  invariant(
    match?.[1] === sha256,
    'ASSET_INPUT_SELECTION_ARTIFACT_MISMATCH',
    `${label} must be the canonical Studio CAS URI for its digest.`,
    { field: label },
  );
  return value;
}

function normalizeInput(value, label) {
  const input = exactRecord(value, [
    'inputId', 'artifactUri', 'sha256', 'mediaType', 'byteSize', 'width', 'height',
  ], label);
  const sha256 = requireHash(input.sha256, `${label}.sha256`);
  invariant(
    input.mediaType === 'image/png',
    'ASSET_INPUT_SELECTION_MEDIA_UNSUPPORTED',
    'Asset input selection schema v1 accepts image/png input only.',
    { field: `${label}.mediaType` },
  );
  return {
    inputId: requireId(input.inputId, `${label}.inputId`),
    artifactUri: requireArtifactUri(input.artifactUri, sha256, `${label}.artifactUri`),
    sha256,
    mediaType: 'image/png',
    byteSize: requireInteger(input.byteSize, `${label}.byteSize`, {
      min: 33,
      max: MAX_ATLAS_INPUT_BYTES,
    }),
    width: requireInteger(input.width, `${label}.width`, {
      min: 1,
      max: MAX_ATLAS_SOURCE_DIMENSION,
    }),
    height: requireInteger(input.height, `${label}.height`, {
      min: 1,
      max: MAX_ATLAS_SOURCE_DIMENSION,
    }),
  };
}

function normalizeOutput(value, label) {
  const output = exactRecord(value, [
    'outputId', 'artifactUri', 'sha256', 'mediaType', 'byteSize', 'width', 'height',
  ], label);
  const sha256 = requireHash(output.sha256, `${label}.sha256`);
  invariant(
    output.mediaType === 'image/png',
    'ASSET_INPUT_SELECTION_MEDIA_UNSUPPORTED',
    'Asset input selection schema v1 accepts image/png output only.',
    { field: `${label}.mediaType` },
  );
  const width = requireInteger(output.width, `${label}.width`, {
    min: 1,
    max: MAX_ATLAS_SOURCE_DIMENSION,
  });
  const height = requireInteger(output.height, `${label}.height`, {
    min: 1,
    max: MAX_ATLAS_SOURCE_DIMENSION,
  });
  const byteSize = requireInteger(output.byteSize, `${label}.byteSize`, {
    min: 33,
    max: MAX_ATLAS_OUTPUT_BYTES,
  });
  invariant(
    byteSize === canonicalRgbaPngByteSize(width, height),
    'ASSET_INPUT_SELECTION_ARTIFACT_MISMATCH',
    `${label}.byteSize must match the schema-v1 canonical PNG processor contract.`,
    { field: `${label}.byteSize` },
  );
  return {
    outputId: requireId(output.outputId, `${label}.outputId`),
    artifactUri: requireArtifactUri(output.artifactUri, sha256, `${label}.artifactUri`),
    sha256,
    mediaType: 'image/png',
    byteSize,
    width,
    height,
  };
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

function assertArtifactMetadataConsistent(artifacts) {
  const byDigest = new Map();
  for (const artifact of artifacts) {
    const prior = byDigest.get(artifact.sha256);
    if (!prior) {
      byDigest.set(artifact.sha256, artifact);
      continue;
    }
    for (const field of ['artifactUri', 'mediaType', 'byteSize', 'width', 'height']) {
      invariant(
        artifact[field] === prior[field],
        'ASSET_INPUT_SELECTION_ARTIFACT_MISMATCH',
        'Artifact descriptors with the same digest must have identical metadata.',
        { field },
      );
    }
  }
}

export function validateAssetInputSelection(value) {
  const selection = exactRecord(value, [
    'schemaVersion',
    'kind',
    'assetKind',
    'inputRole',
    'processingResult',
    'recipe',
    'operation',
    'inputs',
    'selectedOutput',
  ], 'selection');
  invariant(
    selection.schemaVersion === ASSET_INPUT_SELECTION_SCHEMA_VERSION,
    'ASSET_INPUT_SELECTION_SCHEMA_UNSUPPORTED',
    'Unsupported asset input selection schema version.',
    { field: 'selection.schemaVersion' },
  );
  invariant(
    selection.kind === ASSET_INPUT_SELECTION_KIND,
    'ASSET_INPUT_SELECTION_INVALID',
    'Asset input selection kind is invalid.',
    { field: 'selection.kind' },
  );
  invariant(
    ASSET_INPUT_SELECTION_ASSET_KINDS.includes(selection.assetKind),
    'ASSET_INPUT_SELECTION_INVALID',
    'Asset input selection schema v1 requires an explicit supported asset kind.',
    { field: 'selection.assetKind' },
  );
  invariant(
    selection.inputRole === PRIMARY_VISUAL_ASSET_INPUT_ROLE,
    'ASSET_INPUT_SELECTION_INVALID',
    'Asset input selection schema v1 supports only the primary-visual input role.',
    { field: 'selection.inputRole' },
  );

  const resultPin = exactRecord(selection.processingResult, [
    'schemaVersion', 'kind', 'fingerprint',
  ], 'selection.processingResult');
  invariant(
    resultPin.schemaVersion === PROCESSING_RESULT_SCHEMA_VERSION,
    'ASSET_INPUT_SELECTION_INVALID',
    'The selection must pin processing result schema v1.',
    { field: 'selection.processingResult.schemaVersion' },
  );
  invariant(
    resultPin.kind === PROCESSING_RESULT_KIND,
    'ASSET_INPUT_SELECTION_INVALID',
    'The selection must pin a ProcessingResult.',
    { field: 'selection.processingResult.kind' },
  );

  const recipe = exactRecord(selection.recipe, [
    'id', 'version', 'fingerprint',
  ], 'selection.recipe');
  const operation = exactRecord(selection.operation, [
    'operationId', 'kind', 'processorId',
  ], 'selection.operation');
  invariant(
    operation.kind === EXACT_PNG_CROP_OPERATION_KIND,
    'ASSET_INPUT_SELECTION_OPERATION_UNSUPPORTED',
    'Asset input selection schema v1 supports only exact PNG crop results.',
    { field: 'selection.operation.kind' },
  );
  invariant(
    operation.processorId === ATLAS_PROCESSOR_ID,
    'ASSET_INPUT_SELECTION_PROCESSOR_UNSUPPORTED',
    'Asset input selection schema v1 requires the accepted exact crop processor.',
    { field: 'selection.operation.processorId' },
  );

  const inputs = exactArray(selection.inputs, 1, 'selection.inputs')
    .map((input, index) => normalizeInput(input, `selection.inputs[${index}]`));
  const selectedOutput = normalizeOutput(selection.selectedOutput, 'selection.selectedOutput');
  assertArtifactMetadataConsistent([...inputs, selectedOutput]);

  return deepFreeze({
    schemaVersion: ASSET_INPUT_SELECTION_SCHEMA_VERSION,
    kind: ASSET_INPUT_SELECTION_KIND,
    assetKind: selection.assetKind,
    inputRole: PRIMARY_VISUAL_ASSET_INPUT_ROLE,
    processingResult: {
      schemaVersion: PROCESSING_RESULT_SCHEMA_VERSION,
      kind: PROCESSING_RESULT_KIND,
      fingerprint: requireHash(
        resultPin.fingerprint,
        'selection.processingResult.fingerprint',
      ),
    },
    recipe: {
      id: requireId(recipe.id, 'selection.recipe.id'),
      version: requireInteger(recipe.version, 'selection.recipe.version', { min: 1 }),
      fingerprint: requireHash(recipe.fingerprint, 'selection.recipe.fingerprint'),
    },
    operation: {
      operationId: requireId(operation.operationId, 'selection.operation.operationId'),
      kind: EXACT_PNG_CROP_OPERATION_KIND,
      processorId: ATLAS_PROCESSOR_ID,
    },
    inputs,
    selectedOutput,
  });
}

function selectionFromResult(result, outputId, assetKind, unknownReferenceCode) {
  const operation = result.operations[0];
  const output = operation.outputs.find((candidate) => candidate.outputId === outputId);
  invariant(
    output,
    unknownReferenceCode,
    'The selected output ID must reference the pinned ProcessingResult.',
    { field: 'outputId' },
  );
  return validateAssetInputSelection({
    schemaVersion: ASSET_INPUT_SELECTION_SCHEMA_VERSION,
    kind: ASSET_INPUT_SELECTION_KIND,
    assetKind,
    inputRole: PRIMARY_VISUAL_ASSET_INPUT_ROLE,
    processingResult: {
      schemaVersion: result.schemaVersion,
      kind: result.kind,
      fingerprint: processingResultSha256(result),
    },
    recipe: {
      id: result.recipe.id,
      version: result.recipe.version,
      fingerprint: result.recipe.fingerprint,
    },
    operation: {
      operationId: operation.operationId,
      kind: operation.kind,
      processorId: operation.processorId,
    },
    inputs: operation.inputs.map((input) => ({ ...input })),
    selectedOutput: { ...output },
  });
}

export function createPrimaryVisualAssetInputSelection(value) {
  const definition = exactRecord(value, [
    'processingResult', 'outputId', 'assetKind',
  ], 'definition');
  const result = validateProcessingResult(definition.processingResult);
  const outputId = requireId(definition.outputId, 'definition.outputId');
  return selectionFromResult(
    result,
    outputId,
    definition.assetKind,
    'ASSET_INPUT_SELECTION_REFERENCE_UNKNOWN',
  );
}

export function validateAssetInputSelectionForProcessingResult(selectionValue, resultValue) {
  const selection = validateAssetInputSelection(selectionValue);
  const result = validateProcessingResult(resultValue);
  const expected = selectionFromResult(
    result,
    selection.selectedOutput.outputId,
    selection.assetKind,
    'ASSET_INPUT_SELECTION_RESULT_MISMATCH',
  );
  invariant(
    isDeepStrictEqual(selection, expected),
    'ASSET_INPUT_SELECTION_RESULT_MISMATCH',
    'Asset input selection provenance does not match the pinned ProcessingResult.',
    { field: 'selection' },
  );
  return selection;
}

export function canonicalAssetInputSelectionJson(value) {
  return `${JSON.stringify(canonicalize(validateAssetInputSelection(value)), null, 2)}\n`;
}

export function assetInputSelectionSha256(value) {
  return createHash('sha256').update(canonicalAssetInputSelectionJson(value)).digest('hex');
}
