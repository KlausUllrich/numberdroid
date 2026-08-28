import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PROCESSING_ADOPTION_PREFLIGHT_ARTIFACT_ROLES,
  PROCESSING_ADOPTION_PREFLIGHT_OPERATION_ID,
  PROCESSING_ADOPTION_PREFLIGHT_REQUEST_KIND,
  PROCESSING_RESULT_ADOPTION_AGGREGATE_KIND,
  PROCESSING_RESULT_ADOPTION_COMMAND_KIND,
  PROCESSING_RESULT_ADOPTION_COMMAND_TYPE,
  PROCESSING_RESULT_ADOPTION_COMMIT_RESULT_KIND,
  StudioError,
  canonicalProcessingResultAdoptionAggregateJson,
  canonicalProcessingResultAdoptionCommitResultJson,
  canonicalRgbaPngByteSize,
  createExactPngCropProcessingRecipe,
  createPrimaryVisualAssetInputSelection,
  createProcessingAdoptionPreflightReceipt,
  createProcessingResultAdoptionAggregate,
  createProcessingResultAdoptionCommitResult,
  createProcessingResultAdoptionPlan,
  evaluateProcessingAdoptionArtifact,
  evaluateProcessingAdoptionAssetState,
  evaluateProcessingAdoptionCapability,
  processingResultAdoptionAggregateSha256,
  processingResultAdoptionCommitResultSha256,
  processingResultSha256,
  processingRecipeSha256,
  projectCapabilityManifestSha256,
  validateAssetMetadata,
  validateProcessingResultAdoptionAggregate,
  validateProcessingResultAdoptionCommitResult,
  validateProcessingResultAssetBinding,
  validateProjectCapabilityManifest,
} from '../packages/domain/src/index.js';
import {
  NUMBERDROID_PROJECT_CAPABILITY_MANIFEST,
} from '../packages/numberdroid-adapter/src/index.js';
import { proposeRegularGrid } from '../packages/preview/src/index.js';

const NOW = '2026-08-28T12:00:00.000Z';
const SOURCE_SHA256 = '67b87430b0c78b6bb9b3af5b3a8bc75c9156a38d75b433a1cbbef8fd7979c71e';
const OUTPUT_SHA256S = Object.freeze([
  'ef83efbee4b00ec49679f0409ba6f33423729b9d67946ba45f3ab119a91886f2',
  '3781086c30598cf8c07582f9b830e3343e0e1363f2e7c17d35a6678eeeb41c7e',
  '9d4c867156c590d372c9c7ef955596c919d717821b65ea992db0e7606cde2526',
  'a63dceb520a894a3e91e547d93e15d154873f04bb32e0ac8f8354ca7d2150318',
]);
const REPLACEMENT_OUTPUT_SHA256S = Object.freeze([
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  ...OUTPUT_SHA256S.slice(1),
]);

function recipeFixture({ recipeVersion = 1 } = {}) {
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
    recipeVersion,
    input: {
      inputId: 'input.family-hygiene-source',
      artifactUri: `studio://artifacts/sha256/${SOURCE_SHA256}`,
      sha256: SOURCE_SHA256,
      mediaType: 'image/png',
      byteSize: 2_720_519,
      width: 1254,
      height: 1254,
    },
    operationId: 'operation.family-hygiene-crop',
    rectangles,
  });
}

function processingFinding(severity = 'WARNING') {
  return {
    severity,
    ruleId: severity === 'WARNING'
      ? 'studio.processing.review_recommended'
      : 'studio.processing.review_required',
    objectRef: 'operation:operation.family-hygiene-crop',
    explanation: 'The exact output requires an explicit later review.',
    remediation: 'Review this observation at the owner-controlled lifecycle boundary.',
    validatorVersion: 'studio.processing-validator.v1',
  };
}

function resultFixture({
  recipe = recipeFixture(),
  outputSha256s = OUTPUT_SHA256S,
  findings = [],
} = {}) {
  const operation = recipe.operations[0];
  return {
    schemaVersion: 1,
    kind: 'studio.processing-result',
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

function capabilityFixture() {
  const manifest = structuredClone(NUMBERDROID_PROJECT_CAPABILITY_MANIFEST);
  manifest.profileId = 'fixture.processing-profile';
  manifest.profileVersion = 2;
  manifest.adapter = { id: 'fixture', version: 'v2' };
  manifest.modules.push({ id: 'studio.image-processing', version: 'v1' });
  manifest.outputFormats.push(
    { id: 'studio.asset-input-selection', version: 1, mediaType: 'application/json' },
    { id: 'studio.processing-adoption-preflight-receipt', version: 1, mediaType: 'application/json' },
    { id: 'studio.processing-recipe', version: 1, mediaType: 'application/json' },
    { id: 'studio.processing-result', version: 1, mediaType: 'application/json' },
  );
  manifest.operations.push({
    id: PROCESSING_ADOPTION_PREFLIGHT_OPERATION_ID,
    kind: 'validate',
    version: 1,
    moduleIds: ['studio.asset', 'studio.image-processing'],
    inputFormatIds: [
      'studio.asset-input-selection',
      'studio.processing-recipe',
      'studio.processing-result',
    ],
    outputFormatIds: ['studio.processing-adoption-preflight-receipt'],
  });
  return validateProjectCapabilityManifest(manifest);
}

function requestFixture({
  operation = 'create',
  expectedRevision = 17,
  expectedAssetVersion = operation === 'create' ? 0 : 1,
  expectedMetadataVersion = operation === 'create' ? 0 : 1,
  outputSha256s = OUTPUT_SHA256S,
  findings = [],
  manifest = capabilityFixture(),
} = {}) {
  const processingRecipe = recipeFixture();
  const processingResult = resultFixture({ recipe: processingRecipe, outputSha256s, findings });
  const assetInputSelection = createPrimaryVisualAssetInputSelection({
    processingResult,
    outputId: 'rect.family-hygiene.0.0',
    assetKind: 'surface',
  });
  return {
    schemaVersion: 1,
    kind: PROCESSING_ADOPTION_PREFLIGHT_REQUEST_KIND,
    project: { projectId: 'project.family-hygiene', expectedRevision },
    processingRecipe,
    processingResult,
    assetInputSelection,
    capability: {
      schemaVersion: manifest.schemaVersion,
      kind: manifest.kind,
      profileId: manifest.profileId,
      profileVersion: manifest.profileVersion,
      adapter: { ...manifest.adapter },
      manifestFingerprint: projectCapabilityManifestSha256(manifest),
      operation: { id: PROCESSING_ADOPTION_PREFLIGHT_OPERATION_ID, version: 1 },
    },
    target: {
      operation,
      assetId: 'asset.family-hygiene-floor',
      expectedAssetVersion,
      expectedMetadataVersion,
    },
  };
}

function commandFixture({
  request = requestFixture(),
  commandId = 'command.adopt.1',
  idempotencyKey = 'idempotency.adopt.1',
} = {}) {
  return {
    schemaVersion: 1,
    kind: PROCESSING_RESULT_ADOPTION_COMMAND_KIND,
    commandId,
    idempotencyKey,
    type: PROCESSING_RESULT_ADOPTION_COMMAND_TYPE,
    projectId: request.project.projectId,
    baseRevision: request.project.expectedRevision,
    expectedVersion: request.project.expectedRevision,
    payload: {
      preflightRequest: request,
      assetName: request.target.operation === 'create' ? 'Family Hygiene Floor' : null,
    },
  };
}

function authorityBinding(command) {
  return {
    schemaVersion: 1,
    kind: 'studio.processing-result-adoption-authority-binding',
    projectId: command.projectId,
    revision: command.baseRevision,
    actorId: 'agent.processing.1',
    taskId: 'task.processing.1',
    grantId: 'grant.processing.1',
    branchId: 'branch.task-processing-1',
  };
}

function assetStateEvidence(request) {
  const update = request.target.operation === 'update';
  return {
    schemaVersion: 1,
    kind: 'studio.processing-adoption-asset-state',
    project: {
      projectId: request.project.projectId,
      observedRevision: request.project.expectedRevision,
    },
    assetId: request.target.assetId,
    identityState: update ? 'V2_HEAD' : 'UNUSED',
    head: update ? {
      assetId: request.target.assetId,
      assetKind: request.assetInputSelection.assetKind,
      assetVersion: request.target.expectedAssetVersion,
      metadataVersion: request.target.expectedMetadataVersion,
    } : null,
  };
}

function artifactEvidence(request, role) {
  const descriptor = role === 'recipe-input'
    ? request.processingRecipe.inputs[0]
    : request.assetInputSelection.selectedOutput;
  const metadata = {
    artifactUri: descriptor.artifactUri,
    sha256: descriptor.sha256,
    mediaType: descriptor.mediaType,
    byteSize: descriptor.byteSize,
    width: descriptor.width,
    height: descriptor.height,
    state: 'LIVE',
  };
  return {
    schemaVersion: 1,
    kind: 'studio.processing-adoption-artifact-verification',
    project: {
      projectId: request.project.projectId,
      observedRevision: request.project.expectedRevision,
    },
    role,
    sha256: descriptor.sha256,
    status: 'VERIFIED',
    metadata,
    physical: {
      sha256: descriptor.sha256,
      mediaType: descriptor.mediaType,
      byteSize: descriptor.byteSize,
      width: descriptor.width,
      height: descriptor.height,
    },
  };
}

function receiptFixture(request, manifest = capabilityFixture()) {
  return createProcessingAdoptionPreflightReceipt(request, {
    capabilityCheck: evaluateProcessingAdoptionCapability(request, manifest),
    assetStateCheck: evaluateProcessingAdoptionAssetState(request, assetStateEvidence(request)),
    artifactChecks: PROCESSING_ADOPTION_PREFLIGHT_ARTIFACT_ROLES.map((role) => (
      evaluateProcessingAdoptionArtifact(request, role, artifactEvidence(request, role))
    )),
  });
}

function optionsFixture(command, currentAsset = null) {
  return {
    branchRevision: command.baseRevision + 1,
    committedAt: NOW,
    committedBy: 'agent.processing.1',
    currentAsset,
  };
}

function authoredMetadata(metadata) {
  const copy = structuredClone(metadata);
  delete copy.pixelSize;
  delete copy.pivot;
  return copy;
}

function currentAssetFromAggregate(aggregate) {
  return {
    assetId: aggregate.asset.assetId,
    name: aggregate.asset.name,
    kind: aggregate.asset.kind,
    assetVersion: aggregate.asset.assetVersion,
    metadataVersion: aggregate.asset.metadataVersion,
    metadata: aggregate.asset.metadata,
    metadataFingerprint: aggregate.asset.metadataFingerprint,
    findings: aggregate.asset.findings,
    binding: aggregate.asset.processingBinding,
  };
}

function sliceBindingFixture({ width, height, pivot }) {
  return {
    projectId: 'project.family-hygiene',
    sliceId: 'slice.family-hygiene-floor',
    sliceVersion: 7,
    atlasId: 'atlas.family-hygiene',
    sourceId: 'source.family-hygiene',
    sourceDigest: SOURCE_SHA256,
    definitionVersion: 3,
    definitionFingerprint: SOURCE_SHA256,
    rectangleId: 'rectangle.family-hygiene-floor',
    rectangle: {
      x: 0,
      y: 0,
      width,
      height,
      included: true,
      pivot,
      transparentPaddingPolicy: 'preserve_exact_rect',
      replacesSliceId: null,
      expectedSliceVersion: null,
    },
    processorId: 'numberdroid-studio.exact-png-crop.v1',
    digest: OUTPUT_SHA256S[0],
    artifactUri: `studio://artifacts/sha256/${OUTPUT_SHA256S[0]}`,
    mediaType: 'image/png',
    byteSize: canonicalRgbaPngByteSize(width, height),
    width,
    height,
    priorDigest: null,
    committedRevision: 16,
  };
}

function reverseObjectFields(value) {
  if (Array.isArray(value)) return value.map(reverseObjectFields);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).reverse().map(([key, child]) => [key, reverseObjectFields(child)]),
    );
  }
  return value;
}

function assertDeepFrozen(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child, seen);
}

function expectStudioError(callback, code) {
  assert.throws(callback, (error) => error instanceof StudioError && error.code === code);
}

test('A1.5 create Aggregate closes fresh evidence, result lineage, DRAFT projection, and replay-stable result', () => {
  const request = requestFixture({ findings: [processingFinding()] });
  const command = commandFixture({ request });
  const binding = authorityBinding(command);
  const receipt = receiptFixture(request);
  const plan = createProcessingResultAdoptionPlan(command, binding, receipt);
  const aggregate = createProcessingResultAdoptionAggregate(
    command,
    binding,
    receipt,
    optionsFixture(command),
  );
  const reordered = validateProcessingResultAdoptionAggregate(reverseObjectFields(aggregate));

  assert.equal(aggregate.kind, PROCESSING_RESULT_ADOPTION_AGGREGATE_KIND);
  assert.match(aggregate.aggregateFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(aggregate.planFingerprint, plan.planFingerprint);
  assert.deepEqual(aggregate.command, command);
  assert.deepEqual(aggregate.authorityBinding, binding);
  assert.deepEqual(aggregate.freshPreflightReceipt, receipt);
  assert.deepEqual(aggregate.originalProcessingResult, request.processingResult);
  assert.equal(
    aggregate.originalProcessingResultFingerprint,
    processingResultSha256(request.processingResult),
  );
  assert.equal(aggregate.operation, 'create');
  assert.equal(aggregate.previousAsset, null);
  assert.equal(aggregate.asset.assetVersion, 1);
  assert.equal(aggregate.asset.metadataVersion, 1);
  assert.equal(aggregate.asset.previousAssetVersion, null);
  assert.equal(aggregate.asset.previousMetadataVersion, null);
  assert.equal(aggregate.asset.lifecycle, 'DRAFT');
  assert.equal(aggregate.asset.findings.length, 8);
  assert.ok(aggregate.asset.findings.every(({ severity }) => severity === 'ERROR'));
  assert.deepEqual(aggregate.asset.warningDispositions, []);
  assert.equal(aggregate.asset.processingBinding.kind, 'studio.processing-result-asset-binding');
  assert.equal(aggregate.asset.processingBinding.pivot, null);
  assert.deepEqual(aggregate.unresolvedProcessingWarnings, receipt.unresolvedWarnings);
  assert.deepEqual(aggregate.permanentReferences.map(({ role }) => role), [
    'recipe-input',
    'selected-output',
  ]);
  assert.deepEqual(reordered, aggregate);
  assert.equal(
    processingResultAdoptionAggregateSha256(reordered),
    processingResultAdoptionAggregateSha256(aggregate),
  );
  assert.equal(
    canonicalProcessingResultAdoptionAggregateJson(reordered),
    canonicalProcessingResultAdoptionAggregateJson(aggregate),
  );

  const result = createProcessingResultAdoptionCommitResult(aggregate);
  const replay = validateProcessingResultAdoptionCommitResult(JSON.parse(
    canonicalProcessingResultAdoptionCommitResultJson(result),
  ));
  assert.equal(result.kind, PROCESSING_RESULT_ADOPTION_COMMIT_RESULT_KIND);
  assert.equal(result.status, 'COMMITTED');
  assert.equal(result.committedAt, NOW);
  assert.equal(Object.hasOwn(result, 'replayed'), false);
  assert.deepEqual(replay, result);
  assert.equal(
    canonicalProcessingResultAdoptionCommitResultJson(replay),
    canonicalProcessingResultAdoptionCommitResultJson(result),
  );
  assert.equal(
    processingResultAdoptionCommitResultSha256(replay),
    processingResultAdoptionCommitResultSha256(result),
  );
  assert.equal(
    aggregate.aggregateFingerprint,
    '830e7e387347e527efc31062a7801c6cbbac1f13f72cc8616da0f256116b9dac',
  );
  assert.equal(
    processingResultAdoptionAggregateSha256(aggregate),
    '253e9fe8cbc8d0aa6c2c0ee847c424e94c2bbfbe44a40c4e991242c127eb66b5',
  );
  assert.equal(
    processingResultAdoptionCommitResultSha256(result),
    '0da632143b8adaec8e7100cf55d0abbf0a57b7ece1d36d8d605de3ec5cc920f4',
  );
  assertDeepFrozen(aggregate);
  assertDeepFrozen(result);
});

test('update preserves authored metadata and M for equal visual facts while versioning imagery N+1', () => {
  const createRequest = requestFixture();
  const createCommand = commandFixture({ request: createRequest });
  const created = createProcessingResultAdoptionAggregate(
    createCommand,
    authorityBinding(createCommand),
    receiptFixture(createRequest),
    optionsFixture(createCommand),
  );
  const currentAsset = currentAssetFromAggregate(created);
  const updateRequest = requestFixture({
    operation: 'update',
    outputSha256s: REPLACEMENT_OUTPUT_SHA256S,
  });
  const updateCommand = commandFixture({
    request: updateRequest,
    commandId: 'command.adopt.2',
    idempotencyKey: 'idempotency.adopt.2',
  });
  const aggregate = createProcessingResultAdoptionAggregate(
    updateCommand,
    authorityBinding(updateCommand),
    receiptFixture(updateRequest),
    optionsFixture(updateCommand, currentAsset),
  );

  assert.equal(aggregate.operation, 'update');
  assert.equal(aggregate.asset.assetVersion, 2);
  assert.equal(aggregate.asset.metadataVersion, 1);
  assert.equal(aggregate.asset.previousAssetVersion, 1);
  assert.equal(aggregate.asset.previousMetadataVersion, 1);
  assert.equal(aggregate.asset.name, 'Family Hygiene Floor');
  assert.equal(aggregate.asset.metadataFingerprint, currentAsset.metadataFingerprint);
  assert.deepEqual(
    authoredMetadata(aggregate.asset.metadata),
    authoredMetadata(currentAsset.metadata),
  );
  assert.notEqual(
    aggregate.asset.processingBinding.fingerprint,
    currentAsset.binding.fingerprint,
  );
  assert.deepEqual(aggregate.asset.warningDispositions, []);
  assert.equal(aggregate.asset.lifecycle, 'DRAFT');
  assertDeepFrozen(aggregate.previousAsset);
  assertDeepFrozen(aggregate.asset);
});

test('update accepts exact-slice lineage and increments M when the derived pivot changes', () => {
  const request = requestFixture({
    operation: 'update',
    expectedAssetVersion: 7,
    expectedMetadataVersion: 4,
  });
  const selectedOutput = request.assetInputSelection.selectedOutput;
  const sliceBinding = sliceBindingFixture({
    width: selectedOutput.width,
    height: selectedOutput.height,
    pivot: { x: 3, y: 4 },
  });
  const initialDraft = createProcessingResultAdoptionPlan(
    commandFixture(),
    authorityBinding(commandFixture()),
    receiptFixture(requestFixture()),
  ).target.initialMetadata;
  const validation = validateAssetMetadata({
    assetId: request.target.assetId,
    kind: request.assetInputSelection.assetKind,
    metadata: authoredMetadata(initialDraft),
    sliceBinding,
  });
  const currentAsset = {
    assetId: request.target.assetId,
    name: 'Existing Family Hygiene Floor',
    kind: request.assetInputSelection.assetKind,
    assetVersion: 7,
    metadataVersion: 4,
    metadata: validation.metadata,
    metadataFingerprint: validation.fingerprint,
    findings: validation.findings,
    binding: sliceBinding,
  };
  const command = commandFixture({
    request,
    commandId: 'command.adopt.slice-update',
    idempotencyKey: 'idempotency.adopt.slice-update',
  });
  const aggregate = createProcessingResultAdoptionAggregate(
    command,
    authorityBinding(command),
    receiptFixture(request),
    optionsFixture(command, currentAsset),
  );

  assert.equal(aggregate.previousAsset.binding.sliceId, sliceBinding.sliceId);
  assert.equal(aggregate.previousAsset.metadata.pivot.x, 3);
  assert.equal(aggregate.asset.assetVersion, 8);
  assert.equal(aggregate.asset.metadataVersion, 5);
  assert.equal(aggregate.asset.metadata.pivot, null);
  assert.notEqual(aggregate.asset.metadataFingerprint, currentAsset.metadataFingerprint);
  assert.equal(aggregate.asset.processingBinding.kind, 'studio.processing-result-asset-binding');
  assert.equal(Object.hasOwn(aggregate.asset, 'sliceBinding'), false);
});

test('Aggregate and CommitResult are strict fail-closed snapshots with no replay authority field', () => {
  const request = requestFixture();
  const command = commandFixture({ request });
  const aggregate = createProcessingResultAdoptionAggregate(
    command,
    authorityBinding(command),
    receiptFixture(request),
    optionsFixture(command),
  );

  const changedPlan = structuredClone(aggregate);
  changedPlan.planFingerprint = 'b'.repeat(64);
  expectStudioError(
    () => validateProcessingResultAdoptionAggregate(changedPlan),
    'PROCESSING_RESULT_ADOPTION_AGGREGATE_MISMATCH',
  );

  const changedResult = structuredClone(aggregate);
  changedResult.originalProcessingResultFingerprint = 'c'.repeat(64);
  expectStudioError(
    () => validateProcessingResultAdoptionAggregate(changedResult),
    'PROCESSING_RESULT_ADOPTION_AGGREGATE_MISMATCH',
  );

  const changedBinding = structuredClone(aggregate.asset.processingBinding);
  changedBinding.selectedOutput.sha256 = 'd'.repeat(64);
  changedBinding.selectedOutput.artifactUri = `studio://artifacts/sha256/${'d'.repeat(64)}`;
  expectStudioError(
    () => validateProcessingResultAssetBinding(changedBinding),
    'PROCESSING_RESULT_ASSET_BINDING_INVALID',
  );

  const replayClaim = { ...aggregate.commitResult, replayed: false };
  expectStudioError(
    () => validateProcessingResultAdoptionCommitResult(replayClaim),
    'PROCESSING_RESULT_ADOPTION_COMMIT_RESULT_INVALID',
  );

  let getterCalls = 0;
  const options = optionsFixture(command);
  Object.defineProperty(options, 'committedAt', {
    enumerable: true,
    get() {
      getterCalls += 1;
      return NOW;
    },
  });
  expectStudioError(
    () => createProcessingResultAdoptionAggregate(
      command,
      authorityBinding(command),
      receiptFixture(request),
      options,
    ),
    'PROCESSING_RESULT_ADOPTION_AGGREGATE_INVALID',
  );
  assert.equal(getterCalls, 0);

  let proxyTraps = 0;
  const proxy = new Proxy(optionsFixture(command), {
    ownKeys() {
      proxyTraps += 1;
      return [];
    },
  });
  expectStudioError(
    () => createProcessingResultAdoptionAggregate(
      command,
      authorityBinding(command),
      receiptFixture(request),
      proxy,
    ),
    'PROCESSING_RESULT_ADOPTION_AGGREGATE_INVALID',
  );
  assert.equal(proxyTraps, 0);
});

test('coordinates, current head, and incrementable version boundaries remain closed', () => {
  const createRequest = requestFixture();
  const createCommand = commandFixture({ request: createRequest });
  const created = createProcessingResultAdoptionAggregate(
    createCommand,
    authorityBinding(createCommand),
    receiptFixture(createRequest),
    optionsFixture(createCommand),
  );
  const updateRequest = requestFixture({ operation: 'update' });
  const updateCommand = commandFixture({ request: updateRequest });
  const current = currentAssetFromAggregate(created);

  expectStudioError(
    () => createProcessingResultAdoptionAggregate(
      updateCommand,
      authorityBinding(updateCommand),
      receiptFixture(updateRequest),
      { ...optionsFixture(updateCommand, current), branchRevision: 19 },
    ),
    'PROCESSING_RESULT_ADOPTION_AGGREGATE_INVALID',
  );

  expectStudioError(
    () => createProcessingResultAdoptionAggregate(
      updateCommand,
      authorityBinding(updateCommand),
      receiptFixture(updateRequest),
      optionsFixture(updateCommand, { ...current, assetVersion: 2 }),
    ),
    'PROCESSING_RESULT_ADOPTION_CURRENT_ASSET_CONFLICT',
  );

  expectStudioError(
    () => createProcessingResultAdoptionAggregate(
      updateCommand,
      authorityBinding(updateCommand),
      receiptFixture(updateRequest),
      optionsFixture(updateCommand, { ...current, metadataFingerprint: 'e'.repeat(64) }),
    ),
    'PROCESSING_RESULT_ADOPTION_CURRENT_ASSET_INVALID',
  );

  const maximumIncrementable = Number.MAX_SAFE_INTEGER - 1;
  const boundaryRequest = requestFixture({
    operation: 'update',
    expectedRevision: maximumIncrementable,
    expectedAssetVersion: maximumIncrementable,
    expectedMetadataVersion: maximumIncrementable,
  });
  const selectedOutput = boundaryRequest.assetInputSelection.selectedOutput;
  const sliceBinding = sliceBindingFixture({
    width: selectedOutput.width,
    height: selectedOutput.height,
    pivot: { x: 1, y: 1 },
  });
  const validation = validateAssetMetadata({
    assetId: boundaryRequest.target.assetId,
    kind: boundaryRequest.assetInputSelection.assetKind,
    metadata: authoredMetadata(created.asset.metadata),
    sliceBinding,
  });
  const boundaryCurrent = {
    assetId: boundaryRequest.target.assetId,
    name: created.asset.name,
    kind: boundaryRequest.assetInputSelection.assetKind,
    assetVersion: maximumIncrementable,
    metadataVersion: maximumIncrementable,
    metadata: validation.metadata,
    metadataFingerprint: validation.fingerprint,
    findings: validation.findings,
    binding: sliceBinding,
  };
  const boundaryCommand = commandFixture({
    request: boundaryRequest,
    commandId: 'command.adopt.boundary',
    idempotencyKey: 'idempotency.adopt.boundary',
  });
  const boundary = createProcessingResultAdoptionAggregate(
    boundaryCommand,
    authorityBinding(boundaryCommand),
    receiptFixture(boundaryRequest),
    optionsFixture(boundaryCommand, boundaryCurrent),
  );
  assert.equal(boundary.project.branchRevision, Number.MAX_SAFE_INTEGER);
  assert.equal(boundary.asset.assetVersion, Number.MAX_SAFE_INTEGER);
  assert.equal(boundary.asset.metadataVersion, Number.MAX_SAFE_INTEGER);
});
