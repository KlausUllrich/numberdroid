import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ASSET_INPUT_SELECTION_ASSET_KINDS,
  ASSET_INPUT_SELECTION_KIND,
  ASSET_INPUT_SELECTION_SCHEMA_VERSION,
  PRIMARY_VISUAL_ASSET_INPUT_ROLE,
  PROCESSING_RESULT_KIND,
  PROCESSING_RESULT_SCHEMA_VERSION,
  StudioError,
  assetInputSelectionSha256,
  canonicalAssetInputSelectionJson,
  canonicalRgbaPngByteSize,
  createExactPngCropProcessingRecipe,
  createPrimaryVisualAssetInputSelection,
  processingRecipeSha256,
  processingResultSha256,
  validateAssetInputSelection,
  validateAssetInputSelectionForProcessingResult,
  validateProcessingResult,
} from '../packages/domain/src/index.js';
import { proposeRegularGrid } from '../packages/preview/src/index.js';

const sourceSha256 = '67b87430b0c78b6bb9b3af5b3a8bc75c9156a38d75b433a1cbbef8fd7979c71e';
const outputSha256s = Object.freeze([
  'ef83efbee4b00ec49679f0409ba6f33423729b9d67946ba45f3ab119a91886f2',
  '3781086c30598cf8c07582f9b830e3343e0e1363f2e7c17d35a6678eeeb41c7e',
  '9d4c867156c590d372c9c7ef955596c919d717821b65ea992db0e7606cde2526',
  'a63dceb520a894a3e91e547d93e15d154873f04bb32e0ac8f8354ca7d2150318',
]);

function recipeFixture() {
  const rectangles = proposeRegularGrid({
    sourceWidth: 1254,
    sourceHeight: 1254,
    rows: 2,
    columns: 2,
    margins: { top: 3, right: 3, bottom: 3, left: 3 },
    gapX: 4,
    gapY: 4,
    rectangleIdPrefix: 'rect.family-hygiene',
  }).rectangles;
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
    rectangles,
  });
}

function errorFinding() {
  return {
    severity: 'ERROR',
    ruleId: 'studio.processing.review_required',
    objectRef: 'operation:operation.family-hygiene-crop',
    explanation: 'The fixture requires a later explicit review decision.',
    remediation: 'Resolve the finding before any later semantic adoption.',
    validatorVersion: 'studio.processing-validator.v1',
  };
}

function resultFixture({ findings = [] } = {}) {
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

function selectionFixture({
  result = resultFixture(),
  outputId = 'rect.family-hygiene.0.0',
  assetKind = 'surface',
} = {}) {
  return createPrimaryVisualAssetInputSelection({
    processingResult: result,
    outputId,
    assetKind,
  });
}

function expectStudioError(callback, code) {
  assert.throws(
    callback,
    (error) => error instanceof StudioError && error.code === code,
  );
}

function rejectStandalone(mutator, code) {
  const candidate = structuredClone(selectionFixture());
  mutator(candidate);
  expectStudioError(() => validateAssetInputSelection(candidate), code);
}

function rejectBinding(mutator) {
  const result = resultFixture();
  const candidate = structuredClone(selectionFixture({ result }));
  mutator(candidate, result);
  validateAssetInputSelection(candidate);
  expectStudioError(
    () => validateAssetInputSelectionForProcessingResult(candidate, result),
    'ASSET_INPUT_SELECTION_RESULT_MISMATCH',
  );
}

test('asset input selection v1 is deterministic, canonical, deeply immutable, and explicit', () => {
  const reverseFields = (value) => Object.fromEntries(Object.entries(value).reverse());
  const expected = selectionFixture();
  const candidate = structuredClone(expected);
  const reordered = reverseFields(candidate);
  reordered.processingResult = reverseFields(reordered.processingResult);
  reordered.recipe = reverseFields(reordered.recipe);
  reordered.operation = reverseFields(reordered.operation);
  reordered.inputs = reordered.inputs.map(reverseFields);
  reordered.selectedOutput = reverseFields(reordered.selectedOutput);

  const normalized = validateAssetInputSelection(reordered);
  assert.deepEqual(ASSET_INPUT_SELECTION_ASSET_KINDS, ['surface', 'prop', 'item']);
  assert.equal(ASSET_INPUT_SELECTION_SCHEMA_VERSION, 1);
  assert.equal(ASSET_INPUT_SELECTION_KIND, 'studio.asset-input-selection');
  assert.equal(PRIMARY_VISUAL_ASSET_INPUT_ROLE, 'primary-visual');
  assert.deepEqual(normalized, expected);
  assert.equal(normalized.assetKind, 'surface');
  assert.equal(normalized.inputRole, 'primary-visual');
  assert.equal(normalized.processingResult.kind, PROCESSING_RESULT_KIND);
  assert.equal(normalized.processingResult.schemaVersion, PROCESSING_RESULT_SCHEMA_VERSION);
  assert.equal(normalized.processingResult.fingerprint, processingResultSha256(resultFixture()));
  assert.equal(
    normalized.processingResult.fingerprint,
    '83e784f8e9303bb0832fe89d415cc05c93c56e2e9dd66b0ce04b6a1b79409378',
  );
  assert.equal(canonicalAssetInputSelectionJson(normalized), canonicalAssetInputSelectionJson(expected));
  assert.ok(canonicalAssetInputSelectionJson(normalized).endsWith('\n'));
  assert.equal(
    assetInputSelectionSha256(normalized),
    'd32d2c38315fe8cf2a2c8a7463e83c4815cd1e9156587041cf8cb563c0526ce0',
  );
  assert.notEqual(
    assetInputSelectionSha256(selectionFixture({ assetKind: 'prop' })),
    assetInputSelectionSha256(normalized),
  );
  assert.notEqual(
    assetInputSelectionSha256(selectionFixture({ outputId: 'rect.family-hygiene.0.1' })),
    assetInputSelectionSha256(normalized),
  );
  assert.ok(Object.isFrozen(normalized));
  assert.ok(Object.isFrozen(normalized.processingResult));
  assert.ok(Object.isFrozen(normalized.recipe));
  assert.ok(Object.isFrozen(normalized.operation));
  assert.ok(Object.isFrozen(normalized.inputs));
  assert.ok(Object.isFrozen(normalized.inputs[0]));
  assert.ok(Object.isFrozen(normalized.selectedOutput));
  assert.equal(canonicalAssetInputSelectionJson(normalized).includes('"findings"'), false);
  assert.equal(canonicalAssetInputSelectionJson(normalized).includes('"approval"'), false);
  assert.equal(canonicalAssetInputSelectionJson(normalized).includes('"assetId"'), false);

  const priorToJson = Object.getOwnPropertyDescriptor(Object.prototype, 'toJSON');
  const pollutionRecipe = recipeFixture();
  const pollutionResult = resultFixture();
  const pollutionFindingResult = resultFixture({ findings: [errorFinding()] });
  const findingResultFingerprint = processingResultSha256(pollutionFindingResult);
  const findingSelectionFingerprint = assetInputSelectionSha256(selectionFixture({
    result: pollutionFindingResult,
  }));
  let toJsonCalls = 0;
  try {
    Object.defineProperty(Object.prototype, 'toJSON', {
      configurable: true,
      value() {
        toJsonCalls += 1;
        return 'polluted';
      },
    });
    const pollutedSelection = selectionFixture({ result: pollutionResult });
    assert.equal(toJsonCalls, 0);
    assert.equal(
      processingRecipeSha256(pollutionRecipe),
      'ca939dfd972a0aef6f70016fca20e6d45108e05795c4c705489a3b7decd63c46',
    );
    assert.equal(toJsonCalls, 0);
    assert.equal(
      processingResultSha256(pollutionResult),
      '83e784f8e9303bb0832fe89d415cc05c93c56e2e9dd66b0ce04b6a1b79409378',
    );
    assert.equal(toJsonCalls, 0);
    assert.equal(
      assetInputSelectionSha256(pollutedSelection),
      'd32d2c38315fe8cf2a2c8a7463e83c4815cd1e9156587041cf8cb563c0526ce0',
    );
    assert.equal(toJsonCalls, 0);
    assert.equal(processingResultSha256(pollutionFindingResult), findingResultFingerprint);
    assert.equal(
      assetInputSelectionSha256(selectionFixture({ result: pollutionFindingResult })),
      findingSelectionFingerprint,
    );
    assert.equal(toJsonCalls, 0);
    const tampered = structuredClone(pollutedSelection);
    assert.equal(toJsonCalls, 0);
    tampered.recipe.id = 'recipe.tampered';
    validateAssetInputSelection(tampered);
    assert.equal(toJsonCalls, 0);
    expectStudioError(
      () => validateAssetInputSelectionForProcessingResult(tampered, pollutionResult),
      'ASSET_INPUT_SELECTION_RESULT_MISMATCH',
    );
    assert.equal(toJsonCalls, 0);
  } finally {
    if (priorToJson) {
      Object.defineProperty(Object.prototype, 'toJSON', priorToJson);
    } else {
      delete Object.prototype.toJSON;
    }
  }
});

test('builder requires caller-explicit asset kind and selects exactly one existing output', () => {
  const result = resultFixture();
  for (const assetKind of ASSET_INPUT_SELECTION_ASSET_KINDS) {
    assert.equal(selectionFixture({ result, assetKind }).assetKind, assetKind);
  }
  for (const output of result.operations[0].outputs) {
    assert.equal(
      selectionFixture({ result, outputId: output.outputId }).selectedOutput.outputId,
      output.outputId,
    );
  }
  for (const assetKind of [undefined, null, 'Surface', 'actor', 'surface_tile']) {
    expectStudioError(
      () => createPrimaryVisualAssetInputSelection({
        processingResult: result,
        outputId: 'rect.family-hygiene.0.0',
        assetKind,
      }),
      'ASSET_INPUT_SELECTION_INVALID',
    );
  }
  expectStudioError(
    () => createPrimaryVisualAssetInputSelection({
      processingResult: result,
      outputId: 'output.unknown',
      assetKind: 'surface',
    }),
    'ASSET_INPUT_SELECTION_REFERENCE_UNKNOWN',
  );
  expectStudioError(
    () => createPrimaryVisualAssetInputSelection({
      processingResult: result,
      outputId: 'rect.family-hygiene.0.0',
      assetKind: 'surface',
      approval: 'USER_APPROVED',
    }),
    'ASSET_INPUT_SELECTION_FIELD_FORBIDDEN',
  );

  const inherited = Object.create({ assetKind: 'surface' });
  inherited.processingResult = result;
  inherited.outputId = 'rect.family-hygiene.0.0';
  expectStudioError(
    () => createPrimaryVisualAssetInputSelection(inherited),
    'ASSET_INPUT_SELECTION_INVALID',
  );

  let getterCalls = 0;
  const accessor = {
    processingResult: result,
    outputId: 'rect.family-hygiene.0.0',
  };
  Object.defineProperty(accessor, 'assetKind', {
    enumerable: true,
    get() {
      getterCalls += 1;
      return 'surface';
    },
  });
  expectStudioError(
    () => createPrimaryVisualAssetInputSelection(accessor),
    'ASSET_INPUT_SELECTION_INVALID',
  );
  assert.equal(getterCalls, 0);

  const pollutedCandidate = structuredClone(selectionFixture());
  const priorAssetKind = Object.getOwnPropertyDescriptor(Object.prototype, 'assetKind');
  let setterCalls = 0;
  try {
    Object.defineProperty(Object.prototype, 'assetKind', {
      configurable: true,
      get() {
        return 'prop';
      },
      set() {
        setterCalls += 1;
      },
    });
    assert.equal(validateAssetInputSelection(pollutedCandidate).assetKind, 'surface');
    assert.equal(setterCalls, 0);
  } finally {
    if (priorAssetKind) {
      Object.defineProperty(Object.prototype, 'assetKind', priorAssetKind);
    } else {
      delete Object.prototype.assetKind;
    }
  }

  let proxyTrapCalls = 0;
  const proxyHandler = {
    getPrototypeOf() {
      proxyTrapCalls += 1;
      return Object.prototype;
    },
    ownKeys() {
      proxyTrapCalls += 1;
      return [];
    },
    getOwnPropertyDescriptor() {
      proxyTrapCalls += 1;
      return undefined;
    },
  };
  expectStudioError(
    () => validateAssetInputSelection(new Proxy(structuredClone(selectionFixture()), proxyHandler)),
    'ASSET_INPUT_SELECTION_INVALID',
  );
  const proxiedArrayCandidate = structuredClone(selectionFixture());
  proxiedArrayCandidate.inputs = new Proxy(proxiedArrayCandidate.inputs, proxyHandler);
  expectStudioError(
    () => validateAssetInputSelection(proxiedArrayCandidate),
    'ASSET_INPUT_SELECTION_INVALID',
  );
  const revoked = Proxy.revocable(structuredClone(selectionFixture()), {});
  revoked.revoke();
  expectStudioError(
    () => validateAssetInputSelection(revoked.proxy),
    'ASSET_INPUT_SELECTION_INVALID',
  );
  assert.equal(proxyTrapCalls, 0);

  const mutableResult = resultFixture();
  const selection = selectionFixture({ result: mutableResult });
  const before = canonicalAssetInputSelectionJson(selection);
  mutableResult.operations[0].outputs[0].outputId = 'output.changed-after-build';
  mutableResult.operations[0].inputs[0].width = 1;
  assert.equal(canonicalAssetInputSelectionJson(selection), before);
});

test('ERROR findings are fingerprint-bound evidence and never an adoption gate', () => {
  const resultWithError = resultFixture({ findings: [errorFinding()] });
  const selection = selectionFixture({ result: resultWithError });
  assert.deepEqual(
    validateAssetInputSelectionForProcessingResult(selection, resultWithError),
    selection,
  );
  assert.equal(canonicalAssetInputSelectionJson(selection).includes('review_required'), false);
  assert.notEqual(
    selection.processingResult.fingerprint,
    processingResultSha256(resultFixture()),
  );
  expectStudioError(
    () => validateAssetInputSelectionForProcessingResult(selection, resultFixture()),
    'ASSET_INPUT_SELECTION_RESULT_MISMATCH',
  );
});

test('standalone selection fails closed on fields, arrays, roles, media, and artifacts', () => {
  rejectStandalone((value) => { value.schemaVersion = 0; }, 'ASSET_INPUT_SELECTION_SCHEMA_UNSUPPORTED');
  rejectStandalone((value) => { value.schemaVersion = 2; }, 'ASSET_INPUT_SELECTION_SCHEMA_UNSUPPORTED');
  rejectStandalone((value) => { value.schemaVersion = '1'; }, 'ASSET_INPUT_SELECTION_SCHEMA_UNSUPPORTED');
  rejectStandalone((value) => { value.kind = 'studio.asset-input-selection.v2'; }, 'ASSET_INPUT_SELECTION_INVALID');
  rejectStandalone((value) => { value.unknown = true; }, 'ASSET_INPUT_SELECTION_FIELD_FORBIDDEN');
  rejectStandalone((value) => { value.recipe.unknown = true; }, 'ASSET_INPUT_SELECTION_FIELD_FORBIDDEN');
  rejectStandalone((value) => {
    value[Symbol('hidden-authority')] = true;
  }, 'ASSET_INPUT_SELECTION_FIELD_FORBIDDEN');
  rejectStandalone((value) => {
    Object.defineProperty(value, 'hiddenAuthority', { value: true });
  }, 'ASSET_INPUT_SELECTION_FIELD_FORBIDDEN');
  rejectStandalone((value) => { value.inputs = []; }, 'ASSET_INPUT_SELECTION_INVALID');
  rejectStandalone((value) => { value.inputs.push(structuredClone(value.inputs[0])); }, 'ASSET_INPUT_SELECTION_INVALID');
  rejectStandalone((value) => { value.inputs = Array(1); }, 'ASSET_INPUT_SELECTION_INVALID');
  rejectStandalone((value) => { value.inputs.approval = 'USER_APPROVED'; }, 'ASSET_INPUT_SELECTION_FIELD_FORBIDDEN');
  rejectStandalone((value) => { value.inputRole = 'primary_visual'; }, 'ASSET_INPUT_SELECTION_INVALID');
  rejectStandalone((value) => { value.selectedOutput.sha256 = value.selectedOutput.sha256.toUpperCase(); }, 'ASSET_INPUT_SELECTION_INVALID');
  rejectStandalone((value) => {
    value.selectedOutput.artifactUri = `studio://artifacts/sha256/${'0'.repeat(64)}`;
  }, 'ASSET_INPUT_SELECTION_ARTIFACT_MISMATCH');
  rejectStandalone((value) => {
    value.selectedOutput.artifactUri = `https://example.invalid/${value.selectedOutput.sha256}`;
  }, 'ASSET_INPUT_SELECTION_ARTIFACT_MISMATCH');
  rejectStandalone((value) => { value.selectedOutput.mediaType = 'image/webp'; }, 'ASSET_INPUT_SELECTION_MEDIA_UNSUPPORTED');
  rejectStandalone((value) => { value.selectedOutput.byteSize -= 1; }, 'ASSET_INPUT_SELECTION_ARTIFACT_MISMATCH');
  rejectStandalone((value) => { value.selectedOutput.width = Number.MAX_SAFE_INTEGER; }, 'ASSET_INPUT_SELECTION_INVALID');
  rejectStandalone((value) => {
    value.inputs[0].sha256 = value.selectedOutput.sha256;
    value.inputs[0].artifactUri = value.selectedOutput.artifactUri;
  }, 'ASSET_INPUT_SELECTION_ARTIFACT_MISMATCH');

  const inheritedRequired = structuredClone(selectionFixture());
  const output = inheritedRequired.selectedOutput;
  delete inheritedRequired.selectedOutput;
  Object.setPrototypeOf(inheritedRequired, { selectedOutput: output });
  expectStudioError(
    () => validateAssetInputSelection(inheritedRequired),
    'ASSET_INPUT_SELECTION_INVALID',
  );

  const accessorRequired = structuredClone(selectionFixture());
  const assetKind = accessorRequired.assetKind;
  delete accessorRequired.assetKind;
  let getterCalls = 0;
  Object.defineProperty(accessorRequired, 'assetKind', {
    enumerable: true,
    get() {
      getterCalls += 1;
      return assetKind;
    },
  });
  expectStudioError(
    () => validateAssetInputSelection(accessorRequired),
    'ASSET_INPUT_SELECTION_INVALID',
  );
  assert.equal(getterCalls, 0);
});

test('selection cannot carry asset, workflow, storage, or publication authority', () => {
  for (const field of [
    'selectionId',
    'projectId',
    'revision',
    'assetId',
    'assetVersion',
    'displayName',
    'metadata',
    'status',
    'lifecycle',
    'approval',
    'actorId',
    'createdAt',
    'jobId',
    'taskId',
    'branchId',
    'grantId',
    'destinationPath',
    'materialize',
    'publish',
  ]) {
    rejectStandalone((value) => { value[field] = true; }, 'ASSET_INPUT_SELECTION_FIELD_FORBIDDEN');
  }
  rejectStandalone((value) => { value.processingResult.casStatus = 'LIVE'; }, 'ASSET_INPUT_SELECTION_FIELD_FORBIDDEN');
  rejectStandalone((value) => { value.processingResult.attestation = 'trusted'; }, 'ASSET_INPUT_SELECTION_FIELD_FORBIDDEN');
  rejectStandalone((value) => { value.recipe.command = 'adopt'; }, 'ASSET_INPUT_SELECTION_FIELD_FORBIDDEN');
  rejectStandalone((value) => { value.operation.script = 'crop --unsafe'; }, 'ASSET_INPUT_SELECTION_FIELD_FORBIDDEN');
  rejectStandalone((value) => { value.inputs[0].logicalPath = 'source.png'; }, 'ASSET_INPUT_SELECTION_FIELD_FORBIDDEN');
  rejectStandalone((value) => { value.selectedOutput.pivot = { x: 0, y: 0 }; }, 'ASSET_INPUT_SELECTION_FIELD_FORBIDDEN');
  rejectStandalone((value) => { value.selectedOutput.replacesSliceId = 'slice.prior'; }, 'ASSET_INPUT_SELECTION_FIELD_FORBIDDEN');
});

test('relational validation closes every ProcessingResult provenance pin', () => {
  rejectBinding((value) => { value.processingResult.fingerprint = '0'.repeat(64); });
  rejectBinding((value) => { value.recipe.id = 'recipe.other'; });
  rejectBinding((value) => { value.recipe.version = 2; });
  rejectBinding((value) => { value.recipe.fingerprint = '0'.repeat(64); });
  rejectBinding((value) => { value.operation.operationId = 'operation.other'; });
  rejectBinding((value) => { value.inputs[0].inputId = 'input.other'; });
  rejectBinding((value) => { value.inputs[0].byteSize -= 1; });
  rejectBinding((value) => {
    value.inputs[0].sha256 = '0'.repeat(64);
    value.inputs[0].artifactUri = `studio://artifacts/sha256/${'0'.repeat(64)}`;
  });
  rejectBinding((value, result) => {
    value.selectedOutput.outputId = result.operations[0].outputs[1].outputId;
  });
  rejectBinding((value) => {
    value.selectedOutput.sha256 = '0'.repeat(64);
    value.selectedOutput.artifactUri = `studio://artifacts/sha256/${'0'.repeat(64)}`;
  });
  rejectBinding((value) => {
    value.selectedOutput.width -= 1;
    value.selectedOutput.byteSize = canonicalRgbaPngByteSize(
      value.selectedOutput.width,
      value.selectedOutput.height,
    );
  });

  const result = resultFixture();
  const firstSelection = selectionFixture({ result });
  const secondSelection = structuredClone(firstSelection);
  secondSelection.selectedOutput = structuredClone(result.operations[0].outputs[1]);
  assert.deepEqual(
    validateAssetInputSelectionForProcessingResult(secondSelection, result),
    validateAssetInputSelection(secondSelection),
  );

  const reorderedResult = resultFixture();
  reorderedResult.operations[0].outputs.reverse();
  validateProcessingResult(reorderedResult);
  expectStudioError(
    () => validateAssetInputSelectionForProcessingResult(firstSelection, reorderedResult),
    'ASSET_INPUT_SELECTION_RESULT_MISMATCH',
  );

  const changedFindings = resultFixture({ findings: [errorFinding()] });
  expectStudioError(
    () => validateAssetInputSelectionForProcessingResult(firstSelection, changedFindings),
    'ASSET_INPUT_SELECTION_RESULT_MISMATCH',
  );
});

test('distinct output identities survive content-addressed deduplication', () => {
  const result = resultFixture();
  const first = result.operations[0].outputs[0];
  for (const output of result.operations[0].outputs.slice(1)) {
    output.sha256 = first.sha256;
    output.artifactUri = first.artifactUri;
  }
  validateProcessingResult(result);
  const firstSelection = selectionFixture({ result, outputId: first.outputId });
  const secondSelection = selectionFixture({
    result,
    outputId: result.operations[0].outputs[1].outputId,
  });
  validateAssetInputSelectionForProcessingResult(firstSelection, result);
  validateAssetInputSelectionForProcessingResult(secondSelection, result);
  assert.equal(firstSelection.selectedOutput.sha256, secondSelection.selectedOutput.sha256);
  assert.notEqual(firstSelection.selectedOutput.outputId, secondSelection.selectedOutput.outputId);
  assert.notEqual(
    assetInputSelectionSha256(firstSelection),
    assetInputSelectionSha256(secondSelection),
  );
});
