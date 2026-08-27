import { createHash } from 'node:crypto';
import {
  ATLAS_PROCESSOR_ID,
  MAX_ATLAS_INPUT_BYTES,
  MAX_ATLAS_RECTANGLES,
  MAX_ATLAS_SOURCE_DIMENSION,
  TRANSPARENT_PADDING_POLICY,
  validateAtlasRectangles,
} from './atlas-definition.js';
import { invariant } from './errors.js';

export const PROCESSING_RECIPE_SCHEMA_VERSION = 1;
export const PROCESSING_RECIPE_KIND = 'studio.processing-recipe';
export const EXACT_PNG_CROP_OPERATION_KIND = 'studio.image.exact-png-crop';
export const PROCESSING_RECIPE_OPERATION_KINDS = Object.freeze([
  EXACT_PNG_CROP_OPERATION_KIND,
]);

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const CAS_URI_PATTERN = /^studio:\/\/artifacts\/sha256\/([a-f0-9]{64})$/;

function exactFields(value, allowed, label) {
  invariant(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    'PROCESSING_RECIPE_INVALID',
    `${label} must be an object.`,
    { field: label },
  );
  for (const field of Reflect.ownKeys(value)) {
    invariant(
      typeof field === 'string' && allowed.includes(field),
      'PROCESSING_RECIPE_FIELD_FORBIDDEN',
      `${label} contains a field that is not permitted.`,
      { field: label },
    );
  }
  return value;
}

function requireId(value, label) {
  invariant(
    typeof value === 'string' && ID_PATTERN.test(value),
    'PROCESSING_RECIPE_INVALID',
    `${label} must be a safe stable Studio identifier.`,
    { field: label, value },
  );
  return value;
}

function requireInteger(value, label, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  invariant(
    Number.isSafeInteger(value) && value >= min && value <= max,
    'PROCESSING_RECIPE_INVALID',
    `${label} must be a safe integer from ${min} to ${max}.`,
    { field: label, value, min, max },
  );
  return value;
}

function requireArray(value, label, { min, max }) {
  invariant(
    Array.isArray(value) && value.length >= min && value.length <= max,
    'PROCESSING_RECIPE_LIMIT',
    `${label} must contain between ${min} and ${max} entries.`,
    { field: label, min, max },
  );
  for (let index = 0; index < value.length; index += 1) {
    invariant(
      Object.hasOwn(value, index),
      'PROCESSING_RECIPE_INVALID',
      `${label} must not contain sparse entries.`,
      { field: label },
    );
  }
  const arrayKeys = new Set(['length', ...value.map((_, index) => String(index))]);
  for (const field of Reflect.ownKeys(value)) {
    invariant(
      typeof field === 'string' && arrayKeys.has(field),
      'PROCESSING_RECIPE_FIELD_FORBIDDEN',
      `${label} contains an array field that is not permitted.`,
      { field: label },
    );
  }
  return value;
}

function normalizeInput(value, label) {
  const input = exactFields(value, [
    'inputId', 'artifactUri', 'sha256', 'mediaType', 'byteSize', 'width', 'height',
  ], label);
  const sha256 = (() => {
    invariant(
      typeof input.sha256 === 'string' && HASH_PATTERN.test(input.sha256),
      'PROCESSING_RECIPE_INVALID',
      `${label}.sha256 must be a lowercase SHA-256 digest.`,
      { field: `${label}.sha256` },
    );
    return input.sha256;
  })();
  const artifactMatch = typeof input.artifactUri === 'string'
    ? CAS_URI_PATTERN.exec(input.artifactUri)
    : null;
  invariant(
    artifactMatch?.[1] === sha256,
    'PROCESSING_RECIPE_INVALID',
    `${label}.artifactUri must be the canonical Studio CAS URI for its digest.`,
    { field: `${label}.artifactUri`, sha256 },
  );
  invariant(
    input.mediaType === 'image/png',
    'PROCESSING_RECIPE_MEDIA_UNSUPPORTED',
    'Processing recipe schema v1 accepts image/png input only.',
    { field: `${label}.mediaType`, value: input.mediaType },
  );
  return {
    inputId: requireId(input.inputId, `${label}.inputId`),
    artifactUri: input.artifactUri,
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

function normalizeExactCropOperation(value, label, input) {
  const operation = exactFields(value, [
    'operationId', 'kind', 'processorId', 'inputId', 'outputMediaType', 'parameters',
  ], label);
  invariant(
    operation.kind === EXACT_PNG_CROP_OPERATION_KIND,
    'PROCESSING_RECIPE_OPERATION_UNSUPPORTED',
    'Processing recipe schema v1 supports only the exact PNG crop operation.',
    { field: `${label}.kind`, value: operation.kind },
  );
  invariant(
    operation.processorId === ATLAS_PROCESSOR_ID,
    'PROCESSING_RECIPE_PROCESSOR_UNSUPPORTED',
    'The exact PNG crop operation requires the accepted versioned Studio processor.',
    { field: `${label}.processorId`, value: operation.processorId },
  );
  invariant(
    operation.outputMediaType === 'image/png',
    'PROCESSING_RECIPE_MEDIA_UNSUPPORTED',
    'The accepted exact PNG crop processor emits image/png only.',
    { field: `${label}.outputMediaType`, value: operation.outputMediaType },
  );
  const inputId = requireId(operation.inputId, `${label}.inputId`);
  invariant(
    inputId === input.inputId,
    'PROCESSING_RECIPE_REFERENCE_UNKNOWN',
    `${label}.inputId must reference the recipe input.`,
    { field: `${label}.inputId`, inputId },
  );
  const parameters = exactFields(operation.parameters, ['rectangles'], `${label}.parameters`);
  const outputIds = new Set();
  const rectangles = requireArray(parameters.rectangles, `${label}.parameters.rectangles`, {
    min: 1,
    max: MAX_ATLAS_RECTANGLES,
  }).map((value, index) => {
    const rectangleLabel = `${label}.parameters.rectangles[${index}]`;
    const rectangle = exactFields(value, [
      'outputId', 'x', 'y', 'width', 'height', 'transparentPaddingPolicy',
    ], rectangleLabel);
    const outputId = requireId(rectangle.outputId, `${rectangleLabel}.outputId`);
    invariant(
      !outputIds.has(outputId),
      'PROCESSING_RECIPE_DUPLICATE',
      'Exact crop output IDs must be unique.',
      { field: `${rectangleLabel}.outputId`, outputId },
    );
    outputIds.add(outputId);
    invariant(
      rectangle.transparentPaddingPolicy === TRANSPARENT_PADDING_POLICY,
      'PROCESSING_RECIPE_PARAMETER_UNSUPPORTED',
      `The exact PNG crop operation supports only ${TRANSPARENT_PADDING_POLICY}.`,
      { field: `${rectangleLabel}.transparentPaddingPolicy`, value: rectangle.transparentPaddingPolicy },
    );
    return {
      outputId,
      x: requireInteger(rectangle.x, `${rectangleLabel}.x`),
      y: requireInteger(rectangle.y, `${rectangleLabel}.y`),
      width: requireInteger(rectangle.width, `${rectangleLabel}.width`, { min: 1 }),
      height: requireInteger(rectangle.height, `${rectangleLabel}.height`, { min: 1 }),
      transparentPaddingPolicy: TRANSPARENT_PADDING_POLICY,
    };
  });

  const validated = validateAtlasRectangles(rectangles.map((rectangle) => ({
    rectangleId: rectangle.outputId,
    x: rectangle.x,
    y: rectangle.y,
    width: rectangle.width,
    height: rectangle.height,
    included: true,
    pivot: null,
    transparentPaddingPolicy: rectangle.transparentPaddingPolicy,
    replacesSliceId: null,
    expectedSliceVersion: null,
  })), {
    sourceWidth: input.width,
    sourceHeight: input.height,
  });

  return {
    operationId: requireId(operation.operationId, `${label}.operationId`),
    kind: EXACT_PNG_CROP_OPERATION_KIND,
    processorId: ATLAS_PROCESSOR_ID,
    inputId,
    outputMediaType: 'image/png',
    parameters: {
      rectangles: validated.rectangles.map((rectangle) => ({
        outputId: rectangle.rectangleId,
        x: rectangle.x,
        y: rectangle.y,
        width: rectangle.width,
        height: rectangle.height,
        transparentPaddingPolicy: rectangle.transparentPaddingPolicy,
      })),
    },
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

export function validateProcessingRecipe(value) {
  const recipe = exactFields(value, [
    'schemaVersion', 'kind', 'recipeId', 'recipeVersion', 'inputs', 'operations',
  ], 'recipe');
  invariant(
    recipe.schemaVersion === PROCESSING_RECIPE_SCHEMA_VERSION,
    'PROCESSING_RECIPE_SCHEMA_UNSUPPORTED',
    'Unsupported processing recipe schema version.',
    { value: recipe.schemaVersion },
  );
  invariant(
    recipe.kind === PROCESSING_RECIPE_KIND,
    'PROCESSING_RECIPE_INVALID',
    'Processing recipe kind is invalid.',
    { value: recipe.kind },
  );
  const inputs = requireArray(recipe.inputs, 'recipe.inputs', { min: 1, max: 1 })
    .map((input, index) => normalizeInput(input, `recipe.inputs[${index}]`));
  const operations = requireArray(recipe.operations, 'recipe.operations', { min: 1, max: 1 })
    .map((operation, index) => normalizeExactCropOperation(
      operation,
      `recipe.operations[${index}]`,
      inputs[0],
    ));
  return deepFreeze({
    schemaVersion: PROCESSING_RECIPE_SCHEMA_VERSION,
    kind: PROCESSING_RECIPE_KIND,
    recipeId: requireId(recipe.recipeId, 'recipe.recipeId'),
    recipeVersion: requireInteger(recipe.recipeVersion, 'recipe.recipeVersion', { min: 1 }),
    inputs,
    operations,
  });
}

export function createExactPngCropProcessingRecipe(value) {
  const definition = exactFields(value, [
    'recipeId', 'recipeVersion', 'input', 'operationId', 'rectangles',
  ], 'definition');
  const input = normalizeInput(definition.input, 'definition.input');
  const atlas = validateAtlasRectangles(definition.rectangles, {
    sourceWidth: input.width,
    sourceHeight: input.height,
  });
  return validateProcessingRecipe({
    schemaVersion: PROCESSING_RECIPE_SCHEMA_VERSION,
    kind: PROCESSING_RECIPE_KIND,
    recipeId: definition.recipeId,
    recipeVersion: definition.recipeVersion,
    inputs: [input],
    operations: [{
      operationId: definition.operationId,
      kind: EXACT_PNG_CROP_OPERATION_KIND,
      processorId: ATLAS_PROCESSOR_ID,
      inputId: input.inputId,
      outputMediaType: 'image/png',
      parameters: {
        rectangles: atlas.rectangles
          .filter((rectangle) => rectangle.included)
          .map((rectangle) => ({
            outputId: rectangle.rectangleId,
            x: rectangle.x,
            y: rectangle.y,
            width: rectangle.width,
            height: rectangle.height,
            transparentPaddingPolicy: rectangle.transparentPaddingPolicy,
          })),
      },
    }],
  });
}

export function canonicalProcessingRecipeJson(value) {
  return `${JSON.stringify(canonicalize(validateProcessingRecipe(value)), null, 2)}\n`;
}

export function processingRecipeSha256(value) {
  return createHash('sha256').update(canonicalProcessingRecipeJson(value)).digest('hex');
}
