import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  ATLAS_PROCESSOR_ID,
  EXACT_PNG_CROP_OPERATION_KIND,
  MAX_PROCESSING_RESULT_FINDINGS,
  PROCESSING_RESULT_KIND,
  PROCESSING_RESULT_SCHEMA_VERSION,
  PROCESSING_RESULT_SEVERITIES,
  StudioError,
  canonicalProcessingResultJson,
  canonicalRgbaPngByteSize,
  createExactPngCropProcessingRecipe,
  processingRecipeSha256,
  processingResultSha256,
  validateProcessingResult,
  validateProcessingResultForRecipe,
} from '../packages/domain/src/index.js';
import {
  createExactPngCropProcessingResult,
  cropSupportedPng,
  projectExactPngCropProcessingRecipe,
  proposeRegularGrid,
} from '../packages/preview/src/index.js';

const sourceSha256 = '67b87430b0c78b6bb9b3af5b3a8bc75c9156a38d75b433a1cbbef8fd7979c71e';
const outputSha256s = Object.freeze([
  'ef83efbee4b00ec49679f0409ba6f33423729b9d67946ba45f3ab119a91886f2',
  '3781086c30598cf8c07582f9b830e3343e0e1363f2e7c17d35a6678eeeb41c7e',
  '9d4c867156c590d372c9c7ef955596c919d717821b65ea992db0e7606cde2526',
  'a63dceb520a894a3e91e547d93e15d154873f04bb32e0ac8f8354ca7d2150318',
]);

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

function findingsFixture() {
  return [
    {
      severity: 'INFO',
      ruleId: 'studio.processing.information',
      objectRef: 'output:rect.family-hygiene.0.0',
      explanation: 'The derived artifact retains exact source pixels.',
      remediation: 'Inspect the immutable output before semantic adoption.',
      validatorVersion: 'studio.processing-validator.v1',
    },
    {
      severity: 'ERROR',
      ruleId: 'studio.processing.review_required',
      objectRef: 'operation:operation.family-hygiene-crop',
      explanation: 'The fixture demonstrates blocking evidence without workflow authority.',
      remediation: 'Resolve the finding in a later explicit review workflow.',
      validatorVersion: 'studio.processing-validator.v1',
    },
  ];
}

function resultFixture({ findings = findingsFixture() } = {}) {
  const recipe = recipeFixture();
  const operation = recipe.operations[0];
  return {
    schemaVersion: PROCESSING_RESULT_SCHEMA_VERSION,
    kind: PROCESSING_RESULT_KIND,
    recipe: {
      id: recipe.recipeId,
      version: recipe.recipeVersion,
      fingerprint: processingRecipeSha256(recipe),
    },
    operations: [{
      operationId: operation.operationId,
      kind: operation.kind,
      processorId: operation.processorId,
      inputs: [structuredClone(recipe.inputs[0])],
      outputs: operation.parameters.rectangles.map((rectangle, index) => ({
        outputId: rectangle.outputId,
        artifactUri: `studio://artifacts/sha256/${outputSha256s[index]}`,
        sha256: outputSha256s[index],
        mediaType: 'image/png',
        byteSize: canonicalRgbaPngByteSize(rectangle.width, rectangle.height),
        width: rectangle.width,
        height: rectangle.height,
      })),
    }],
    findings,
  };
}

function rejectsResultWithCode(mutator, code) {
  const result = resultFixture();
  mutator(result);
  assert.throws(
    () => validateProcessingResult(result),
    (error) => error instanceof StudioError && error.code === code,
  );
}

function rejectsRecipeBindingWithCode(mutator, code = 'PROCESSING_RESULT_RECIPE_MISMATCH') {
  const result = resultFixture({ findings: [] });
  mutator(result);
  assert.throws(
    () => validateProcessingResultForRecipe(result, recipeFixture()),
    (error) => error instanceof StudioError && error.code === code,
  );
}

test('processing result v1 is deterministic, canonical, deeply immutable, and finding-order stable', () => {
  const reverseFields = (value) => Object.fromEntries(Object.entries(value).reverse());
  const reordered = reverseFields(resultFixture());
  reordered.recipe = reverseFields(reordered.recipe);
  reordered.operations[0] = reverseFields(reordered.operations[0]);
  reordered.operations[0].inputs[0] = reverseFields(reordered.operations[0].inputs[0]);
  reordered.operations[0].outputs = reordered.operations[0].outputs.map(reverseFields);
  reordered.findings.reverse();

  const normalized = validateProcessingResult(reordered);
  const expected = validateProcessingResult(resultFixture());
  assert.deepEqual(PROCESSING_RESULT_SEVERITIES, ['ERROR', 'WARNING', 'INFO']);
  assert.deepEqual(normalized, expected);
  assert.deepEqual(normalized.findings.map(({ severity }) => severity), ['ERROR', 'INFO']);
  assert.equal(canonicalProcessingResultJson(normalized), canonicalProcessingResultJson(expected));
  assert.equal(processingResultSha256(normalized), processingResultSha256(expected));
  assert.ok(canonicalProcessingResultJson(normalized).endsWith('\n'));
  assert.ok(Object.isFrozen(normalized));
  assert.ok(Object.isFrozen(normalized.recipe));
  assert.ok(Object.isFrozen(normalized.operations[0].outputs[0]));
  assert.ok(Object.isFrozen(normalized.findings[0]));
  assert.equal(canonicalProcessingResultJson(normalized).includes('"bytes"'), false);
  assert.equal(canonicalProcessingResultJson(normalized).includes('expectedDigest'), false);
});

test('processing result schema fails closed on unknown, sparse, unsupported, and incoherent evidence', () => {
  rejectsResultWithCode((result) => { result.schemaVersion = 2; }, 'PROCESSING_RESULT_SCHEMA_UNSUPPORTED');
  rejectsResultWithCode((result) => { result.schemaVersion = 0; }, 'PROCESSING_RESULT_SCHEMA_UNSUPPORTED');
  rejectsResultWithCode((result) => { result.schemaVersion = '1'; }, 'PROCESSING_RESULT_SCHEMA_UNSUPPORTED');
  rejectsResultWithCode((result) => { result.kind = 'studio.processing-result.v2'; }, 'PROCESSING_RESULT_INVALID');
  rejectsResultWithCode((result) => { result.unknown = true; }, 'PROCESSING_RESULT_FIELD_FORBIDDEN');
  rejectsResultWithCode((result) => { result.recipe.unknown = true; }, 'PROCESSING_RESULT_FIELD_FORBIDDEN');
  rejectsResultWithCode((result) => { result.operations[0].outputs[0].bytes = Buffer.alloc(1); }, 'PROCESSING_RESULT_FIELD_FORBIDDEN');
  rejectsResultWithCode((result) => {
    result.operations[0].kind = 'studio.image.resize';
  }, 'PROCESSING_RESULT_OPERATION_UNSUPPORTED');
  rejectsResultWithCode((result) => {
    result.operations[0].processorId = 'numberdroid-studio.exact-png-crop.v2';
  }, 'PROCESSING_RESULT_PROCESSOR_UNSUPPORTED');
  rejectsResultWithCode((result) => {
    result.operations[0].inputs[0].mediaType = 'image/webp';
  }, 'PROCESSING_RESULT_MEDIA_UNSUPPORTED');
  rejectsResultWithCode((result) => {
    result.operations[0].outputs[0].mediaType = 'image/webp';
  }, 'PROCESSING_RESULT_MEDIA_UNSUPPORTED');
  rejectsResultWithCode((result) => {
    result.operations[0].inputs[0].artifactUri = `studio://artifacts/sha256/${'0'.repeat(64)}`;
  }, 'PROCESSING_RESULT_ARTIFACT_MISMATCH');
  rejectsResultWithCode((result) => {
    result.operations[0].inputs[0].artifactUri = `https://example.invalid/${sourceSha256}`;
  }, 'PROCESSING_RESULT_ARTIFACT_MISMATCH');
  rejectsResultWithCode((result) => {
    result.operations[0].outputs[0].artifactUri = `studio://artifacts/sha256/${outputSha256s[0].toUpperCase()}`;
  }, 'PROCESSING_RESULT_ARTIFACT_MISMATCH');
  rejectsResultWithCode((result) => {
    result.operations[0].outputs[0].artifactUri += '?mutable=true';
  }, 'PROCESSING_RESULT_ARTIFACT_MISMATCH');
  rejectsResultWithCode((result) => {
    result.operations[0].outputs[0].byteSize -= 1;
  }, 'PROCESSING_RESULT_ARTIFACT_MISMATCH');
  rejectsResultWithCode((result) => {
    result.operations[0].outputs[1].outputId = result.operations[0].outputs[0].outputId;
  }, 'PROCESSING_RESULT_DUPLICATE');
  rejectsResultWithCode((result) => {
    const [first, second] = result.operations[0].outputs;
    second.sha256 = first.sha256;
    second.artifactUri = first.artifactUri;
    second.width -= 1;
    second.byteSize = canonicalRgbaPngByteSize(second.width, second.height);
  }, 'PROCESSING_RESULT_ARTIFACT_MISMATCH');
  rejectsResultWithCode((result) => {
    const input = result.operations[0].inputs[0];
    const output = result.operations[0].outputs[0];
    output.sha256 = input.sha256;
    output.artifactUri = input.artifactUri;
  }, 'PROCESSING_RESULT_ARTIFACT_MISMATCH');
  rejectsResultWithCode((result) => { result.operations = Array(1); }, 'PROCESSING_RESULT_INVALID');
  rejectsResultWithCode((result) => { result.operations[0].inputs = Array(1); }, 'PROCESSING_RESULT_INVALID');
  rejectsResultWithCode((result) => { result.operations[0].outputs = Array(1); }, 'PROCESSING_RESULT_INVALID');
  rejectsResultWithCode((result) => { result.findings = Array(1); }, 'PROCESSING_RESULT_INVALID');
  rejectsResultWithCode((result) => {
    result.operations[0].outputs.approval = 'USER_APPROVED';
  }, 'PROCESSING_RESULT_FIELD_FORBIDDEN');

  const overBudget = resultFixture({ findings: [] });
  const digest = outputSha256s[0];
  overBudget.operations[0].outputs = Array.from({ length: 64 }, (_, index) => ({
    outputId: `output.over-budget.${index}`,
    artifactUri: `studio://artifacts/sha256/${digest}`,
    sha256: digest,
    mediaType: 'image/png',
    byteSize: canonicalRgbaPngByteSize(1024, 1025),
    width: 1024,
    height: 1025,
  }));
  assert.throws(
    () => validateProcessingResult(overBudget),
    (error) => error instanceof StudioError && error.code === 'PROCESSING_RESULT_LIMIT',
  );
});

test('processing result findings are bounded, referential, path-safe, unique, and non-authoritative', () => {
  rejectsResultWithCode((result) => {
    result.findings[0].severity = 'APPROVED';
  }, 'PROCESSING_RESULT_INVALID');
  rejectsResultWithCode((result) => {
    result.findings[0].ruleId = 'Not Namespaced';
  }, 'PROCESSING_RESULT_INVALID');
  rejectsResultWithCode((result) => {
    result.findings[0].objectRef = 'output:unknown';
  }, 'PROCESSING_RESULT_REFERENCE_UNKNOWN');
  rejectsResultWithCode((result) => {
    result.findings[0].explanation = 'Leaked from C:\\Users\\designer\\private.png';
  }, 'PROCESSING_RESULT_INVALID');
  rejectsResultWithCode((result) => {
    result.findings[0].remediation = 'Inspect /workspace/private/secret.txt';
  }, 'PROCESSING_RESULT_INVALID');
  for (const unsafe of [
    '~/private/secret.txt',
    '../private/secret.txt',
    '/private/var/secret.txt',
    '/usr/local/private.txt',
    'file:///private/secret.txt',
    '\\\\server\\share\\secret.txt',
  ]) {
    rejectsResultWithCode((result) => {
      result.findings[0].remediation = `Inspect ${unsafe}`;
    }, 'PROCESSING_RESULT_INVALID');
  }
  rejectsResultWithCode((result) => {
    result.findings[0].explanation = 'Safe prefix \u202e deceptive suffix';
  }, 'PROCESSING_RESULT_INVALID');
  rejectsResultWithCode((result) => {
    result.findings.push(structuredClone(result.findings[0]));
  }, 'PROCESSING_RESULT_DUPLICATE');
  rejectsResultWithCode((result) => {
    result.findings = Array.from({ length: MAX_PROCESSING_RESULT_FINDINGS + 1 }, (_, index) => ({
      ...result.findings[0],
      explanation: `Bounded finding ${index}.`,
    }));
  }, 'PROCESSING_RESULT_LIMIT');

  const leaked = resultFixture();
  leaked.findings[0].explanation = 'Read /home/designer/secret-token.txt';
  let failure;
  try {
    validateProcessingResult(leaked);
  } catch (error) {
    failure = error;
  }
  assert.ok(failure instanceof StudioError);
  assert.equal(`${failure.message}\n${JSON.stringify(failure.details)}`.includes('secret-token'), false);
});

test('processing result cannot carry job, script, adoption, review, or repository authority', () => {
  rejectsResultWithCode((result) => { result.status = 'VERIFIED'; }, 'PROCESSING_RESULT_FIELD_FORBIDDEN');
  rejectsResultWithCode((result) => { result.jobId = 'job.hidden'; }, 'PROCESSING_RESULT_FIELD_FORBIDDEN');
  rejectsResultWithCode((result) => { result.actorId = 'actor.hidden'; }, 'PROCESSING_RESULT_FIELD_FORBIDDEN');
  rejectsResultWithCode((result) => { result.taskId = 'task.hidden'; }, 'PROCESSING_RESULT_FIELD_FORBIDDEN');
  rejectsResultWithCode((result) => { result.branchId = 'branch.hidden'; }, 'PROCESSING_RESULT_FIELD_FORBIDDEN');
  rejectsResultWithCode((result) => { result.grantId = 'grant.hidden'; }, 'PROCESSING_RESULT_FIELD_FORBIDDEN');
  rejectsResultWithCode((result) => { result.projectId = 'project.hidden'; }, 'PROCESSING_RESULT_FIELD_FORBIDDEN');
  rejectsResultWithCode((result) => { result.createdAt = '2026-08-27T00:00:00.000Z'; }, 'PROCESSING_RESULT_FIELD_FORBIDDEN');
  rejectsResultWithCode((result) => { result.approval = 'USER_APPROVED'; }, 'PROCESSING_RESULT_FIELD_FORBIDDEN');
  rejectsResultWithCode((result) => { result.destinationPath = '/tmp/output.png'; }, 'PROCESSING_RESULT_FIELD_FORBIDDEN');
  rejectsResultWithCode((result) => { result.materialize = true; }, 'PROCESSING_RESULT_FIELD_FORBIDDEN');
  rejectsResultWithCode((result) => { result.publish = true; }, 'PROCESSING_RESULT_FIELD_FORBIDDEN');
  rejectsResultWithCode((result) => { result.operations[0].script = 'crop --unsafe'; }, 'PROCESSING_RESULT_FIELD_FORBIDDEN');
  rejectsResultWithCode((result) => { result.operations[0].inputs[0].logicalPath = 'source.png'; }, 'PROCESSING_RESULT_FIELD_FORBIDDEN');
  rejectsResultWithCode((result) => { result.operations[0].outputs[0].assetId = 'asset.hidden'; }, 'PROCESSING_RESULT_FIELD_FORBIDDEN');
  rejectsResultWithCode((result) => { result.operations[0].outputs[0].sliceId = 'slice.hidden'; }, 'PROCESSING_RESULT_FIELD_FORBIDDEN');
  rejectsResultWithCode((result) => { result.operations[0].outputs[0].role = 'derived'; }, 'PROCESSING_RESULT_FIELD_FORBIDDEN');
  rejectsResultWithCode((result) => { result.operations[0].outputs[0].provenanceRef = 'recipe.hidden'; }, 'PROCESSING_RESULT_FIELD_FORBIDDEN');
  rejectsResultWithCode((result) => { result.operations[0].outputs[0].replacesSliceId = 'slice.prior'; }, 'PROCESSING_RESULT_FIELD_FORBIDDEN');
  rejectsResultWithCode((result) => { result.operations[0].outputs[0].expectedSliceVersion = 2; }, 'PROCESSING_RESULT_FIELD_FORBIDDEN');
  rejectsResultWithCode((result) => { result.findings[0].stack = 'private'; }, 'PROCESSING_RESULT_FIELD_FORBIDDEN');
  rejectsResultWithCode((result) => { result.findings[0].acceptedBy = 'owner'; }, 'PROCESSING_RESULT_FIELD_FORBIDDEN');
  rejectsResultWithCode((result) => { result.findings[0].disposition = 'ACCEPTED'; }, 'PROCESSING_RESULT_FIELD_FORBIDDEN');
  rejectsResultWithCode((result) => { result.findings[0].blockingOverride = true; }, 'PROCESSING_RESULT_FIELD_FORBIDDEN');
});

test('processing result binds recipe, processor, input, ordered outputs, and exact dimensions', () => {
  const result = validateProcessingResultForRecipe(resultFixture({ findings: [] }), recipeFixture());
  assert.equal(result.recipe.fingerprint, processingRecipeSha256(recipeFixture()));

  rejectsRecipeBindingWithCode((candidate) => { candidate.recipe.id = 'recipe.other'; });
  rejectsRecipeBindingWithCode((candidate) => { candidate.recipe.version = 2; });
  rejectsRecipeBindingWithCode((candidate) => { candidate.recipe.fingerprint = '0'.repeat(64); });
  rejectsRecipeBindingWithCode((candidate) => {
    candidate.operations[0].operationId = 'operation.other';
  });
  rejectsRecipeBindingWithCode((candidate) => {
    candidate.operations[0].inputs[0].inputId = 'input.other';
  });
  rejectsRecipeBindingWithCode((candidate) => {
    candidate.operations[0].inputs[0].byteSize -= 1;
  });
  rejectsRecipeBindingWithCode((candidate) => {
    const digest = '0'.repeat(64);
    candidate.operations[0].inputs[0].sha256 = digest;
    candidate.operations[0].inputs[0].artifactUri = `studio://artifacts/sha256/${digest}`;
  });
  rejectsRecipeBindingWithCode((candidate) => {
    candidate.operations[0].outputs.pop();
  });
  rejectsRecipeBindingWithCode((candidate) => {
    candidate.operations[0].outputs.reverse();
  });
  rejectsRecipeBindingWithCode((candidate) => {
    const output = candidate.operations[0].outputs[0];
    output.width -= 1;
    output.byteSize = canonicalRgbaPngByteSize(output.width, output.height);
  });
  rejectsRecipeBindingWithCode((candidate) => {
    const output = structuredClone(candidate.operations[0].outputs.at(-1));
    output.outputId = 'rect.family-hygiene.extra';
    candidate.operations[0].outputs.push(output);
  });
});

test('processing result permits content-addressed deduplication across distinct output IDs', () => {
  const candidate = resultFixture({ findings: [] });
  const first = candidate.operations[0].outputs[0];
  for (const output of candidate.operations[0].outputs.slice(1)) {
    output.sha256 = first.sha256;
    output.artifactUri = first.artifactUri;
  }
  const result = validateProcessingResultForRecipe(candidate, recipeFixture());
  assert.equal(new Set(result.operations[0].outputs.map(({ sha256 }) => sha256)).size, 1);
  assert.equal(new Set(result.operations[0].outputs.map(({ outputId }) => outputId)).size, 4);
});

test('real Family Hygiene source produces the pinned immutable ProcessingResult', async () => {
  const source = await readFile('../../art-source/approved/area-01-transfer-ship/floor-treatment/source/family-hygiene-floor-2x2__source-approved__2026-08-21.png');
  const recipe = recipeFixture();
  const projection = projectExactPngCropProcessingRecipe(recipe);
  const kernelResult = cropSupportedPng(source, projection.rectangles, {
    expectedSource: projection.source,
  });
  assert.equal(kernelResult.rectangleFingerprint, '41a48e0c7b695186bd59ea8dbcbe023bf22acee48b2a065d40b1b70b6da4a884');
  assert.equal(kernelResult.derivationFingerprint, '3073e797c167b708f534ec3cd9c38db755eb5eeca653475ff794529272c850b5');

  const result = createExactPngCropProcessingResult({ recipe, sourceBytes: source });
  assert.deepEqual(result, validateProcessingResultForRecipe(resultFixture({ findings: [] }), recipe));
  assert.deepEqual(result.operations[0].outputs.map((output) => [
    output.outputId,
    output.width,
    output.height,
    output.byteSize,
    output.sha256,
    output.artifactUri,
  ]), outputSha256s.map((digest, index) => [
    `rect.family-hygiene.${Math.floor(index / 2)}.${index % 2}`,
    622,
    622,
    1_548_341,
    digest,
    `studio://artifacts/sha256/${digest}`,
  ]));
  assert.equal(result.findings.length, 0);
  assert.equal(JSON.stringify(result).includes('bytes'), false);
  assert.equal(JSON.stringify(result).includes('rectangleFingerprint'), false);
  assert.equal(JSON.stringify(result).includes('derivationFingerprint'), false);
  assert.equal(
    processingResultSha256(result),
    '83e784f8e9303bb0832fe89d415cc05c93c56e2e9dd66b0ce04b6a1b79409378',
  );
});

test('trusted result builder rejects missing, changed, and non-recipe source bytes', async () => {
  const source = await readFile('../../art-source/approved/area-01-transfer-ship/floor-treatment/source/family-hygiene-floor-2x2__source-approved__2026-08-21.png');
  const recipe = recipeFixture();
  assert.throws(
    () => createExactPngCropProcessingResult({ recipe }),
    (error) => error instanceof StudioError && error.code === 'PROCESSING_RESULT_KERNEL_MISMATCH',
  );
  assert.throws(
    () => createExactPngCropProcessingResult({ recipe, sourceBytes: source, findings: [] }),
    (error) => error instanceof StudioError && error.code === 'PROCESSING_RESULT_KERNEL_MISMATCH',
  );
  const changed = Buffer.from(source);
  changed[changed.length - 1] ^= 1;
  assert.throws(
    () => createExactPngCropProcessingResult({ recipe, sourceBytes: changed }),
    (error) => error instanceof StudioError && error.code === 'ATLAS_SOURCE_MISMATCH',
  );
  const wrongRecipe = structuredClone(recipe);
  wrongRecipe.inputs[0].byteSize -= 1;
  assert.throws(
    () => createExactPngCropProcessingResult({ recipe: wrongRecipe, sourceBytes: source }),
    (error) => error instanceof StudioError && error.code === 'ATLAS_SOURCE_MISMATCH',
  );
  assert.equal(createHash('sha256').update(source).digest('hex'), sourceSha256);
});
