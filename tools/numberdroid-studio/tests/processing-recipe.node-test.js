import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  ATLAS_PROCESSOR_ID,
  EXACT_PNG_CROP_OPERATION_KIND,
  MAX_ATLAS_INPUT_BYTES,
  MAX_ATLAS_SOURCE_DIMENSION,
  PROCESSING_RECIPE_KIND,
  PROCESSING_RECIPE_OPERATION_KINDS,
  StudioError,
  canonicalProcessingRecipeJson,
  createExactPngCropProcessingRecipe,
  processingRecipeSha256,
  validateProcessingRecipe,
} from '../packages/domain/src/index.js';
import {
  cropSupportedPng,
  projectExactPngCropProcessingRecipe,
  proposeRegularGrid,
} from '../packages/preview/src/index.js';

const sourceSha256 = '67b87430b0c78b6bb9b3af5b3a8bc75c9156a38d75b433a1cbbef8fd7979c71e';

function familyHygieneRectangles() {
  return proposeRegularGrid({
    sourceWidth: 1254,
    sourceHeight: 1254,
    rows: 2,
    columns: 2,
    margins: { top: 3, right: 3, bottom: 3, left: 3 },
    gapX: 4,
    gapY: 4,
    rectangleIdPrefix: 'rect.family-hygiene',
  }).rectangles;
}

function recipeFixture() {
  return createExactPngCropProcessingRecipe({
    recipeId: 'recipe.family-hygiene-floor.exact-crop',
    recipeVersion: 1,
    input: {
      inputId: 'input.family-hygiene-source',
      artifactUri: `studio://artifacts/sha256/${sourceSha256}`,
      sha256: sourceSha256,
      mediaType: 'image/png',
      byteSize: 2_720_519,
      width: 1254,
      height: 1254,
    },
    operationId: 'operation.family-hygiene-crop',
    rectangles: familyHygieneRectangles(),
  });
}

function rejectsWithCode(mutator, code) {
  const recipe = structuredClone(recipeFixture());
  mutator(recipe);
  assert.throws(
    () => validateProcessingRecipe(recipe),
    (error) => error instanceof StudioError && error.code === code,
  );
}

test('processing recipe v1 is deterministic, canonical, deeply immutable, and exact-crop only', () => {
  const recipe = recipeFixture();
  const reverseFields = (value) => Object.fromEntries(Object.entries(value).reverse());
  const reordered = reverseFields(structuredClone(recipe));
  reordered.inputs[0] = reverseFields(reordered.inputs[0]);
  reordered.operations[0] = reverseFields(reordered.operations[0]);
  reordered.operations[0].parameters = reverseFields(reordered.operations[0].parameters);
  reordered.operations[0].parameters.rectangles = reordered.operations[0].parameters.rectangles
    .map(reverseFields);
  const normalized = validateProcessingRecipe(reordered);

  assert.deepEqual(PROCESSING_RECIPE_OPERATION_KINDS, [EXACT_PNG_CROP_OPERATION_KIND]);
  assert.equal(recipe.kind, PROCESSING_RECIPE_KIND);
  assert.equal(recipe.operations[0].processorId, ATLAS_PROCESSOR_ID);
  assert.deepEqual(normalized, recipe);
  assert.ok(Object.isFrozen(recipe));
  assert.ok(Object.isFrozen(recipe.inputs));
  assert.ok(Object.isFrozen(recipe.operations[0].parameters.rectangles[0]));
  assert.ok(canonicalProcessingRecipeJson(recipe).endsWith('\n'));
  assert.equal(processingRecipeSha256(recipe), processingRecipeSha256(normalized));
  assert.equal(
    processingRecipeSha256(recipe),
    'ca939dfd972a0aef6f70016fca20e6d45108e05795c4c705489a3b7decd63c46',
  );
  const reversedOutputs = structuredClone(recipe);
  reversedOutputs.operations[0].parameters.rectangles.reverse();
  assert.notEqual(processingRecipeSha256(reversedOutputs), processingRecipeSha256(recipe));

  assert.deepEqual(Object.keys(recipe.operations[0].parameters.rectangles[0]), [
    'outputId',
    'x',
    'y',
    'width',
    'height',
    'transparentPaddingPolicy',
  ]);
  assert.ok(!Object.hasOwn(recipe.operations[0].parameters.rectangles[0], 'pivot'));
  assert.ok(!Object.hasOwn(recipe.operations[0].parameters.rectangles[0], 'replacesSliceId'));
});

test('processing recipe rejects unknown schema, operation, processor, media, fields, and references', () => {
  rejectsWithCode((recipe) => { recipe.schemaVersion = 2; }, 'PROCESSING_RECIPE_SCHEMA_UNSUPPORTED');
  rejectsWithCode((recipe) => { recipe.kind = 'studio.processing-recipe.v2'; }, 'PROCESSING_RECIPE_INVALID');
  rejectsWithCode((recipe) => { recipe.unknown = true; }, 'PROCESSING_RECIPE_FIELD_FORBIDDEN');
  rejectsWithCode((recipe) => { recipe.inputs[0].unknown = true; }, 'PROCESSING_RECIPE_FIELD_FORBIDDEN');
  rejectsWithCode((recipe) => { recipe.operations[0].kind = 'studio.image.resize'; }, 'PROCESSING_RECIPE_OPERATION_UNSUPPORTED');
  rejectsWithCode((recipe) => { recipe.operations[0].processorId = 'numberdroid-studio.exact-png-crop.v2'; }, 'PROCESSING_RECIPE_PROCESSOR_UNSUPPORTED');
  rejectsWithCode((recipe) => { recipe.inputs[0].mediaType = 'image/webp'; }, 'PROCESSING_RECIPE_MEDIA_UNSUPPORTED');
  rejectsWithCode((recipe) => { recipe.operations[0].outputMediaType = 'image/webp'; }, 'PROCESSING_RECIPE_MEDIA_UNSUPPORTED');
  rejectsWithCode((recipe) => { recipe.operations[0].inputId = 'input.missing'; }, 'PROCESSING_RECIPE_REFERENCE_UNKNOWN');
  rejectsWithCode((recipe) => {
    recipe.operations[0].parameters.rectangles[0].transparentPaddingPolicy = 'trim-alpha';
  }, 'PROCESSING_RECIPE_PARAMETER_UNSUPPORTED');
});

test('processing recipe keeps source, graph, and exact-crop work inside audited bounds', () => {
  rejectsWithCode((recipe) => { recipe.inputs.push(structuredClone(recipe.inputs[0])); }, 'PROCESSING_RECIPE_LIMIT');
  rejectsWithCode((recipe) => { recipe.operations.push(structuredClone(recipe.operations[0])); }, 'PROCESSING_RECIPE_LIMIT');
  rejectsWithCode((recipe) => { recipe.inputs[0].artifactUri = `studio://artifacts/sha256/${'0'.repeat(64)}`; }, 'PROCESSING_RECIPE_INVALID');
  rejectsWithCode((recipe) => { recipe.inputs[0].byteSize = MAX_ATLAS_INPUT_BYTES + 1; }, 'PROCESSING_RECIPE_INVALID');
  rejectsWithCode((recipe) => { recipe.inputs[0].width = MAX_ATLAS_SOURCE_DIMENSION + 1; }, 'PROCESSING_RECIPE_INVALID');
  rejectsWithCode((recipe) => {
    recipe.operations[0].parameters.rectangles[0].x = recipe.inputs[0].width;
  }, 'ATLAS_RECT_OUT_OF_BOUNDS');
  rejectsWithCode((recipe) => {
    recipe.operations[0].parameters.rectangles.push(structuredClone(recipe.operations[0].parameters.rectangles[0]));
  }, 'PROCESSING_RECIPE_DUPLICATE');
  rejectsWithCode((recipe) => {
    recipe.operations[0].parameters.rectangles[1] = {
      ...recipe.operations[0].parameters.rectangles[0],
      outputId: 'rect.distinct-id',
    };
  }, 'ATLAS_RECT_DUPLICATE');
  rejectsWithCode((recipe) => {
    recipe.operations[0].parameters.rectangles[1] = {
      ...recipe.operations[0].parameters.rectangles[0],
      outputId: 'rect.overlap',
      x: recipe.operations[0].parameters.rectangles[0].x + 1,
    };
  }, 'ATLAS_RECT_OVERLAP');
  rejectsWithCode((recipe) => {
    recipe.operations[0].parameters.rectangles = Array.from({ length: 65 }, (_, index) => ({
      outputId: `rect.limit.${index}`,
      x: index,
      y: 0,
      width: 1,
      height: 1,
      transparentPaddingPolicy: 'preserve_exact_rect',
    }));
  }, 'PROCESSING_RECIPE_LIMIT');
});

test('processing recipe is transformation evidence and cannot carry execution or owner authority', () => {
  rejectsWithCode((recipe) => { recipe.approval = 'USER_APPROVED'; }, 'PROCESSING_RECIPE_FIELD_FORBIDDEN');
  rejectsWithCode((recipe) => { recipe.destinationPath = '/tmp/output.png'; }, 'PROCESSING_RECIPE_FIELD_FORBIDDEN');
  rejectsWithCode((recipe) => { recipe.materialize = true; }, 'PROCESSING_RECIPE_FIELD_FORBIDDEN');
  rejectsWithCode((recipe) => { recipe.publish = true; }, 'PROCESSING_RECIPE_FIELD_FORBIDDEN');
  rejectsWithCode((recipe) => { recipe.operations[0].editorHistory = []; }, 'PROCESSING_RECIPE_FIELD_FORBIDDEN');
  rejectsWithCode((recipe) => { recipe.operations[0].parameters.script = 'crop --unsafe'; }, 'PROCESSING_RECIPE_FIELD_FORBIDDEN');
});

test('AtlasDefinition compatibility strips semantic remap and pivot authority from pixel intent', () => {
  const rectangles = structuredClone(familyHygieneRectangles());
  rectangles[0].pivot = { x: 10, y: 20 };
  rectangles[0].replacesSliceId = 'slice.prior';
  rectangles[0].expectedSliceVersion = 3;
  rectangles[3].included = false;
  const recipe = createExactPngCropProcessingRecipe({
    recipeId: 'recipe.compatibility',
    recipeVersion: 1,
    input: recipeFixture().inputs[0],
    operationId: 'operation.compatibility',
    rectangles,
  });

  assert.deepEqual(
    recipe.operations[0].parameters.rectangles.map(({ outputId }) => outputId),
    ['rect.family-hygiene.0.0', 'rect.family-hygiene.0.1', 'rect.family-hygiene.1.0'],
  );
  for (const rectangle of recipe.operations[0].parameters.rectangles) {
    assert.ok(!Object.hasOwn(rectangle, 'pivot'));
    assert.ok(!Object.hasOwn(rectangle, 'replacesSliceId'));
    assert.ok(!Object.hasOwn(rectangle, 'expectedSliceVersion'));
    assert.ok(!Object.hasOwn(rectangle, 'included'));
  }
});

test('real Family Hygiene recipe projects to the accepted processor without changing output bytes', async () => {
  const source = await readFile('../../art-source/approved/area-01-transfer-ship/floor-treatment/source/family-hygiene-floor-2x2__source-approved__2026-08-21.png');
  assert.equal(source.length, 2_720_519);
  assert.equal(createHash('sha256').update(source).digest('hex'), sourceSha256);

  const recipe = recipeFixture();
  const projection = projectExactPngCropProcessingRecipe(recipe);
  assert.ok(Object.isFrozen(projection));
  assert.ok(Object.isFrozen(projection.source));
  assert.ok(Object.isFrozen(projection.rectangles[0]));
  assert.equal(projection.recipeFingerprint, processingRecipeSha256(recipe));
  assert.deepEqual(projection.rectangles, familyHygieneRectangles());
  assert.throws(
    () => cropSupportedPng(source, projection.rectangles, {
      expectedSource: { ...projection.source, byteSize: projection.source.byteSize - 1 },
    }),
    (error) => error instanceof StudioError && error.code === 'ATLAS_SOURCE_MISMATCH',
  );

  const direct = cropSupportedPng(source, familyHygieneRectangles(), {
    expectedSource: {
      digest: sourceSha256,
      mediaType: 'image/png',
      width: 1254,
      height: 1254,
    },
  });
  const throughRecipe = cropSupportedPng(source, projection.rectangles, {
    expectedSource: projection.source,
  });
  assert.deepEqual(throughRecipe.outputs.map((output) => output.bytes), direct.outputs.map((output) => output.bytes));
  assert.deepEqual(throughRecipe.outputs.map((output) => [
    output.rectangleId,
    output.width,
    output.height,
    output.byteSize,
    output.digest,
  ]), [
    ['rect.family-hygiene.0.0', 622, 622, 1_548_341, 'ef83efbee4b00ec49679f0409ba6f33423729b9d67946ba45f3ab119a91886f2'],
    ['rect.family-hygiene.0.1', 622, 622, 1_548_341, '3781086c30598cf8c07582f9b830e3343e0e1363f2e7c17d35a6678eeeb41c7e'],
    ['rect.family-hygiene.1.0', 622, 622, 1_548_341, '9d4c867156c590d372c9c7ef955596c919d717821b65ea992db0e7606cde2526'],
    ['rect.family-hygiene.1.1', 622, 622, 1_548_341, 'a63dceb520a894a3e91e547d93e15d154873f04bb32e0ac8f8354ca7d2150318'],
  ]);
});
