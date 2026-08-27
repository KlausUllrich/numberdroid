import { createHash } from 'node:crypto';
import {
  ATLAS_PROCESSOR_ID,
  MAX_ATLAS_INPUT_BYTES,
  MAX_ATLAS_OUTPUT_BYTES,
  MAX_ATLAS_OUTPUT_PIXELS,
  MAX_ATLAS_RECTANGLES,
  MAX_ATLAS_SOURCE_DIMENSION,
  canonicalRgbaPngByteSize,
} from './atlas-definition.js';
import { invariant } from './errors.js';
import {
  EXACT_PNG_CROP_OPERATION_KIND,
  processingRecipeSha256,
  validateProcessingRecipe,
} from './processing-recipe.js';

export const PROCESSING_RESULT_SCHEMA_VERSION = 1;
export const PROCESSING_RESULT_KIND = 'studio.processing-result';
export const PROCESSING_RESULT_SEVERITIES = Object.freeze(['ERROR', 'WARNING', 'INFO']);
export const MAX_PROCESSING_RESULT_FINDINGS = 256;

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const NAMESPACED_ID_PATTERN = /^[a-z][a-z0-9_-]*(?:\.[a-z0-9][a-z0-9_-]*)+$/;
const CAS_URI_PATTERN = /^studio:\/\/artifacts\/sha256\/([a-f0-9]{64})$/;
const UNSAFE_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f\u200e\u200f\u2028-\u202e\u2066-\u2069]/;
const MACHINE_PATH_PATTERN = /(?:^|[\s([{'"])(?:[A-Za-z]:[\\/]|\\\\|\/\S|~[\\/]|\.{1,2}[\\/])|[A-Za-z][A-Za-z0-9+.-]*:\/\/\S/i;
const SEVERITY_ORDER = Object.freeze({ ERROR: 0, WARNING: 1, INFO: 2 });

function exactFields(value, allowed, label) {
  invariant(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    'PROCESSING_RESULT_INVALID',
    `${label} must be an object.`,
    { field: label },
  );
  for (const field of Reflect.ownKeys(value)) {
    invariant(
      typeof field === 'string' && allowed.includes(field),
      'PROCESSING_RESULT_FIELD_FORBIDDEN',
      `${label} contains a field that is not permitted.`,
      { field: label },
    );
  }
  return value;
}

function requireString(value, label, {
  min = 1,
  max = 2048,
  machinePathSafe = false,
} = {}) {
  invariant(
    typeof value === 'string'
      && value.length >= min
      && value.length <= max
      && value.trim() === value
      && !UNSAFE_TEXT_PATTERN.test(value),
    'PROCESSING_RESULT_INVALID',
    `${label} must be a bounded trimmed string without control characters.`,
    { field: label },
  );
  invariant(
    !machinePathSafe || !MACHINE_PATH_PATTERN.test(value),
    'PROCESSING_RESULT_INVALID',
    `${label} must not contain a machine-local path.`,
    { field: label },
  );
  return value;
}

function requireId(value, label) {
  const id = requireString(value, label, { max: 128 });
  invariant(
    ID_PATTERN.test(id),
    'PROCESSING_RESULT_INVALID',
    `${label} must be a safe stable Studio identifier.`,
    { field: label },
  );
  return id;
}

function requireNamespacedId(value, label) {
  const id = requireString(value, label, { max: 128 });
  invariant(
    NAMESPACED_ID_PATTERN.test(id),
    'PROCESSING_RESULT_INVALID',
    `${label} must be a lowercase dotted identifier.`,
    { field: label },
  );
  return id;
}

function requireHash(value, label) {
  invariant(
    typeof value === 'string' && HASH_PATTERN.test(value),
    'PROCESSING_RESULT_INVALID',
    `${label} must be a lowercase SHA-256 digest.`,
    { field: label },
  );
  return value;
}

function requireInteger(value, label, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  invariant(
    Number.isSafeInteger(value) && value >= min && value <= max,
    'PROCESSING_RESULT_INVALID',
    `${label} must be a safe integer from ${min} to ${max}.`,
    { field: label, min, max },
  );
  return value;
}

function requireArray(value, label, { min, max }) {
  invariant(
    Array.isArray(value) && value.length >= min && value.length <= max,
    'PROCESSING_RESULT_LIMIT',
    `${label} must contain between ${min} and ${max} entries.`,
    { field: label, min, max },
  );
  for (let index = 0; index < value.length; index += 1) {
    invariant(
      Object.hasOwn(value, index),
      'PROCESSING_RESULT_INVALID',
      `${label} must not contain sparse entries.`,
      { field: label },
    );
  }
  const arrayKeys = new Set(['length', ...value.map((_, index) => String(index))]);
  for (const field of Reflect.ownKeys(value)) {
    invariant(
      typeof field === 'string' && arrayKeys.has(field),
      'PROCESSING_RESULT_FIELD_FORBIDDEN',
      `${label} contains an array field that is not permitted.`,
      { field: label },
    );
  }
  return value;
}

function requireCanonicalArtifactUri(value, sha256, label) {
  const match = typeof value === 'string' ? CAS_URI_PATTERN.exec(value) : null;
  invariant(
    match?.[1] === sha256,
    'PROCESSING_RESULT_ARTIFACT_MISMATCH',
    `${label} must be the canonical Studio CAS URI for its digest.`,
    { field: label },
  );
  return value;
}

function normalizeInput(value, label) {
  const input = exactFields(value, [
    'inputId', 'artifactUri', 'sha256', 'mediaType', 'byteSize', 'width', 'height',
  ], label);
  const sha256 = requireHash(input.sha256, `${label}.sha256`);
  invariant(
    input.mediaType === 'image/png',
    'PROCESSING_RESULT_MEDIA_UNSUPPORTED',
    'Processing result schema v1 accepts image/png input only.',
    { field: `${label}.mediaType` },
  );
  return {
    inputId: requireId(input.inputId, `${label}.inputId`),
    artifactUri: requireCanonicalArtifactUri(input.artifactUri, sha256, `${label}.artifactUri`),
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
  const output = exactFields(value, [
    'outputId', 'artifactUri', 'sha256', 'mediaType', 'byteSize', 'width', 'height',
  ], label);
  const sha256 = requireHash(output.sha256, `${label}.sha256`);
  invariant(
    output.mediaType === 'image/png',
    'PROCESSING_RESULT_MEDIA_UNSUPPORTED',
    'The accepted exact PNG crop processor emits image/png only.',
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
    'PROCESSING_RESULT_ARTIFACT_MISMATCH',
    `${label}.byteSize must match the schema-v1 canonical PNG processor contract.`,
    { field: `${label}.byteSize` },
  );
  return {
    outputId: requireId(output.outputId, `${label}.outputId`),
    artifactUri: requireCanonicalArtifactUri(output.artifactUri, sha256, `${label}.artifactUri`),
    sha256,
    mediaType: 'image/png',
    byteSize,
    width,
    height,
  };
}

function normalizeOperation(value, label) {
  const operation = exactFields(value, [
    'operationId', 'kind', 'processorId', 'inputs', 'outputs',
  ], label);
  invariant(
    operation.kind === EXACT_PNG_CROP_OPERATION_KIND,
    'PROCESSING_RESULT_OPERATION_UNSUPPORTED',
    'Processing result schema v1 supports only the exact PNG crop operation.',
    { field: `${label}.kind` },
  );
  invariant(
    operation.processorId === ATLAS_PROCESSOR_ID,
    'PROCESSING_RESULT_PROCESSOR_UNSUPPORTED',
    'The exact PNG crop result requires the accepted versioned Studio processor.',
    { field: `${label}.processorId` },
  );
  const inputs = requireArray(operation.inputs, `${label}.inputs`, { min: 1, max: 1 })
    .map((input, index) => normalizeInput(input, `${label}.inputs[${index}]`));
  const outputs = requireArray(operation.outputs, `${label}.outputs`, {
    min: 1,
    max: MAX_ATLAS_RECTANGLES,
  }).map((output, index) => normalizeOutput(output, `${label}.outputs[${index}]`));
  const outputIds = new Set();
  const artifactsByDigest = new Map();
  let totalOutputPixels = 0;
  for (const artifact of [...inputs, ...outputs]) {
    const prior = artifactsByDigest.get(artifact.sha256);
    if (prior) {
      for (const field of ['artifactUri', 'mediaType', 'byteSize', 'width', 'height']) {
        invariant(
          artifact[field] === prior[field],
          'PROCESSING_RESULT_ARTIFACT_MISMATCH',
          `${label} artifact descriptors with the same digest must have identical metadata.`,
          { field: label },
        );
      }
    } else {
      artifactsByDigest.set(artifact.sha256, artifact);
    }
  }
  for (const output of outputs) {
    invariant(
      !outputIds.has(output.outputId),
      'PROCESSING_RESULT_DUPLICATE',
      `${label}.outputs must have unique output IDs.`,
      { field: `${label}.outputs` },
    );
    outputIds.add(output.outputId);
    const pixels = output.width * output.height;
    invariant(
      Number.isSafeInteger(pixels) && totalOutputPixels <= MAX_ATLAS_OUTPUT_PIXELS - pixels,
      'PROCESSING_RESULT_LIMIT',
      `${label}.outputs exceed the schema-v1 output-pixel budget.`,
      { field: `${label}.outputs`, maxOutputPixels: MAX_ATLAS_OUTPUT_PIXELS },
    );
    totalOutputPixels += pixels;
  }
  return {
    operationId: requireId(operation.operationId, `${label}.operationId`),
    kind: EXACT_PNG_CROP_OPERATION_KIND,
    processorId: ATLAS_PROCESSOR_ID,
    inputs,
    outputs,
  };
}

function compareStrings(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function normalizeFinding(value, label, knownObjectRefs) {
  const finding = exactFields(value, [
    'severity', 'ruleId', 'objectRef', 'explanation', 'remediation', 'validatorVersion',
  ], label);
  invariant(
    Object.hasOwn(SEVERITY_ORDER, finding.severity),
    'PROCESSING_RESULT_INVALID',
    `${label}.severity is unsupported.`,
    { field: `${label}.severity` },
  );
  const objectRef = requireString(finding.objectRef, `${label}.objectRef`, { max: 256 });
  invariant(
    knownObjectRefs.has(objectRef),
    'PROCESSING_RESULT_REFERENCE_UNKNOWN',
    `${label}.objectRef must name the result recipe, operation, input, or output.`,
    { field: `${label}.objectRef` },
  );
  return {
    severity: finding.severity,
    ruleId: requireNamespacedId(finding.ruleId, `${label}.ruleId`),
    objectRef,
    explanation: requireString(finding.explanation, `${label}.explanation`, {
      max: 2000,
      machinePathSafe: true,
    }),
    remediation: requireString(finding.remediation, `${label}.remediation`, {
      max: 2000,
      machinePathSafe: true,
    }),
    validatorVersion: requireId(finding.validatorVersion, `${label}.validatorVersion`),
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

function assertRecordMatches(actual, expected, fields, label) {
  for (const field of fields) {
    invariant(
      actual[field] === expected[field],
      'PROCESSING_RESULT_RECIPE_MISMATCH',
      `${label}.${field} does not match the pinned processing recipe.`,
      { field: `${label}.${field}` },
    );
  }
}

export function validateProcessingResult(value) {
  const result = exactFields(value, [
    'schemaVersion', 'kind', 'recipe', 'operations', 'findings',
  ], 'result');
  invariant(
    result.schemaVersion === PROCESSING_RESULT_SCHEMA_VERSION,
    'PROCESSING_RESULT_SCHEMA_UNSUPPORTED',
    'Unsupported processing result schema version.',
    { field: 'result.schemaVersion' },
  );
  invariant(
    result.kind === PROCESSING_RESULT_KIND,
    'PROCESSING_RESULT_INVALID',
    'Processing result kind is invalid.',
    { field: 'result.kind' },
  );
  const recipe = exactFields(result.recipe, ['id', 'version', 'fingerprint'], 'result.recipe');
  const normalizedRecipe = {
    id: requireId(recipe.id, 'result.recipe.id'),
    version: requireInteger(recipe.version, 'result.recipe.version', { min: 1 }),
    fingerprint: requireHash(recipe.fingerprint, 'result.recipe.fingerprint'),
  };
  const operations = requireArray(result.operations, 'result.operations', { min: 1, max: 1 })
    .map((operation, index) => normalizeOperation(operation, `result.operations[${index}]`));
  const operation = operations[0];
  const knownObjectRefs = new Set([
    `recipe:${normalizedRecipe.id}@${normalizedRecipe.version}`,
    `operation:${operation.operationId}`,
    ...operation.inputs.map((input) => `input:${input.inputId}`),
    ...operation.outputs.map((output) => `output:${output.outputId}`),
  ]);
  const findings = requireArray(result.findings, 'result.findings', {
    min: 0,
    max: MAX_PROCESSING_RESULT_FINDINGS,
  }).map((finding, index) => normalizeFinding(
    finding,
    `result.findings[${index}]`,
    knownObjectRefs,
  ));
  const findingIdentities = new Set();
  for (const finding of findings) {
    const identityFields = [finding.ruleId, finding.objectRef, finding.explanation];
    Object.setPrototypeOf(identityFields, null);
    const identity = JSON.stringify(identityFields);
    invariant(
      !findingIdentities.has(identity),
      'PROCESSING_RESULT_DUPLICATE',
      'result.findings must not contain duplicate findings.',
      { field: 'result.findings' },
    );
    findingIdentities.add(identity);
  }
  findings.sort((left, right) => (
    SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity]
      || compareStrings(left.ruleId, right.ruleId)
      || compareStrings(left.objectRef, right.objectRef)
      || compareStrings(left.explanation, right.explanation)
  ));
  return deepFreeze({
    schemaVersion: PROCESSING_RESULT_SCHEMA_VERSION,
    kind: PROCESSING_RESULT_KIND,
    recipe: normalizedRecipe,
    operations,
    findings,
  });
}

export function validateProcessingResultForRecipe(resultValue, recipeValue) {
  const result = validateProcessingResult(resultValue);
  const recipe = validateProcessingRecipe(recipeValue);
  assertRecordMatches(result.recipe, {
    id: recipe.recipeId,
    version: recipe.recipeVersion,
    fingerprint: processingRecipeSha256(recipe),
  }, ['id', 'version', 'fingerprint'], 'result.recipe');

  const operation = result.operations[0];
  const recipeOperation = recipe.operations[0];
  assertRecordMatches(operation, recipeOperation, [
    'operationId', 'kind', 'processorId',
  ], 'result.operations[0]');
  const input = operation.inputs[0];
  assertRecordMatches(input, recipe.inputs[0], [
    'inputId', 'artifactUri', 'sha256', 'mediaType', 'byteSize', 'width', 'height',
  ], 'result.operations[0].inputs[0]');

  const rectangles = recipeOperation.parameters.rectangles;
  invariant(
    operation.outputs.length === rectangles.length,
    'PROCESSING_RESULT_RECIPE_MISMATCH',
    'Result output count does not match the pinned processing recipe.',
    { field: 'result.operations[0].outputs' },
  );
  for (const [index, output] of operation.outputs.entries()) {
    const rectangle = rectangles[index];
    assertRecordMatches(output, {
      outputId: rectangle.outputId,
      mediaType: recipeOperation.outputMediaType,
      width: rectangle.width,
      height: rectangle.height,
    }, ['outputId', 'mediaType', 'width', 'height'], `result.operations[0].outputs[${index}]`);
  }
  return result;
}

export function canonicalProcessingResultJson(value) {
  return `${JSON.stringify(canonicalize(validateProcessingResult(value)), null, 2)}\n`;
}

export function processingResultSha256(value) {
  return createHash('sha256').update(canonicalProcessingResultJson(value)).digest('hex');
}
