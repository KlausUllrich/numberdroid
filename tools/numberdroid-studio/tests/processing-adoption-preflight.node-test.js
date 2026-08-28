import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PROCESSING_ADOPTION_ARTIFACT_VERIFIER_KIND,
  PROCESSING_ADOPTION_ASSET_STATE_READER_KIND,
  ProcessingAdoptionPreflightService,
  implementedCommandTypes,
} from '../packages/application/src/index.js';
import {
  PROCESSING_ADOPTION_PREFLIGHT_OPERATION_ID,
  PROCESSING_ADOPTION_PREFLIGHT_RECEIPT_KIND,
  PROCESSING_ADOPTION_PREFLIGHT_REQUEST_KIND,
  StudioError,
  canonicalProcessingAdoptionPreflightReceiptJson,
  canonicalProcessingAdoptionPreflightRequestJson,
  canonicalRgbaPngByteSize,
  createExactPngCropProcessingRecipe,
  createPrimaryVisualAssetInputSelection,
  evaluateProcessingAdoptionArtifact,
  evaluateProcessingAdoptionAssetState,
  listCommandDefinitions,
  processingAdoptionPreflightReceiptSha256,
  processingAdoptionPreflightRequestSha256,
  processingRecipeSha256,
  projectCapabilityManifestSha256,
  validateProcessingAdoptionPreflightReceipt,
  validateProcessingAdoptionPreflightRequest,
  validateProjectCapabilityManifest,
} from '../packages/domain/src/index.js';
import {
  NUMBERDROID_PROJECT_CAPABILITY_MANIFEST,
} from '../packages/numberdroid-adapter/src/index.js';
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

function findingFixture(severity) {
  return {
    severity,
    ruleId: severity === 'ERROR'
      ? 'studio.processing.review_required'
      : 'studio.processing.review_recommended',
    objectRef: 'operation:operation.family-hygiene-crop',
    explanation: severity === 'ERROR'
      ? 'The fixture requires a later explicit review decision.'
      : 'The fixture should be reviewed before any later mutation.',
    remediation: 'Resolve this observation at the later owner-controlled adoption boundary.',
    validatorVersion: 'studio.processing-validator.v1',
  };
}

function resultFixture({ recipe = recipeFixture(), findings = [] } = {}) {
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

function processingCapabilityFixture() {
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
  manifest = processingCapabilityFixture(),
  findings = [],
  operation = 'create',
  expectedAssetVersion = operation === 'create' ? 0 : 3,
  expectedMetadataVersion = operation === 'create' ? 0 : 4,
} = {}) {
  const processingRecipe = recipeFixture();
  const processingResult = resultFixture({ recipe: processingRecipe, findings });
  const assetInputSelection = createPrimaryVisualAssetInputSelection({
    processingResult,
    outputId: 'rect.family-hygiene.0.0',
    assetKind: 'surface',
  });
  return {
    schemaVersion: 1,
    kind: PROCESSING_ADOPTION_PREFLIGHT_REQUEST_KIND,
    project: { projectId: 'project.family-hygiene', expectedRevision: 17 },
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

function assetStateFixture(request, overrides = {}) {
  const identityState = overrides.identityState ?? (
    request.target.operation === 'create' ? 'UNUSED' : 'V2_HEAD'
  );
  return {
    schemaVersion: 1,
    kind: 'studio.processing-adoption-asset-state',
    project: {
      projectId: request.project.projectId,
      observedRevision: request.project.expectedRevision,
      ...overrides.project,
    },
    assetId: request.target.assetId,
    identityState,
    head: identityState === 'V2_HEAD' ? {
      assetId: request.target.assetId,
      assetKind: request.assetInputSelection.assetKind,
      assetVersion: request.target.expectedAssetVersion,
      metadataVersion: request.target.expectedMetadataVersion,
      ...overrides.head,
    } : null,
    ...Object.fromEntries(Object.entries(overrides).filter(([key]) => !['project', 'head'].includes(key))),
  };
}

function descriptorFor(request, role) {
  return role === 'recipe-input'
    ? request.processingRecipe.inputs[0]
    : request.assetInputSelection.selectedOutput;
}

function artifactEvidenceFixture(request, role, overrides = {}) {
  const descriptor = descriptorFor(request, role);
  const status = overrides.status ?? 'VERIFIED';
  const metadataState = status === 'NOT_LIVE' ? 'QUARANTINED' : 'LIVE';
  const metadata = ['PROJECT_REFERENCE_MISSING', 'METADATA_MISSING'].includes(status)
    ? null
    : {
      artifactUri: descriptor.artifactUri,
      sha256: descriptor.sha256,
      mediaType: descriptor.mediaType,
      byteSize: descriptor.byteSize,
      width: descriptor.width,
      height: descriptor.height,
      state: metadataState,
      ...overrides.metadata,
    };
  const physical = status === 'VERIFIED' ? {
    sha256: descriptor.sha256,
    mediaType: descriptor.mediaType,
    byteSize: descriptor.byteSize,
    width: descriptor.width,
    height: descriptor.height,
    ...overrides.physical,
  } : null;
  return {
    schemaVersion: 1,
    kind: 'studio.processing-adoption-artifact-verification',
    project: {
      projectId: request.project.projectId,
      observedRevision: request.project.expectedRevision,
      ...overrides.project,
    },
    role,
    sha256: descriptor.sha256,
    status,
    metadata,
    physical,
    ...Object.fromEntries(Object.entries(overrides).filter(([key]) => ![
      'project', 'metadata', 'physical',
    ].includes(key))),
  };
}

function serviceFixture({
  manifest = processingCapabilityFixture(),
  request = requestFixture({ manifest }),
  assetEvidence = assetStateFixture(request),
  artifactEvidence = (selection) => artifactEvidenceFixture(request, selection.role),
  capabilityError = null,
  assetError = null,
  artifactError = null,
} = {}) {
  const calls = { capability: [], asset: [], artifacts: [] };
  const capabilityProvider = {
    async getProjectCapabilityManifest(selection) {
      calls.capability.push(selection);
      if (capabilityError) throw capabilityError;
      return manifest;
    },
  };
  const assetStateReader = {
    schemaVersion: 1,
    kind: PROCESSING_ADOPTION_ASSET_STATE_READER_KIND,
    async readAssetState(selection) {
      calls.asset.push(selection);
      if (assetError) throw assetError;
      return typeof assetEvidence === 'function' ? assetEvidence(selection) : assetEvidence;
    },
  };
  const artifactVerifier = {
    schemaVersion: 1,
    kind: PROCESSING_ADOPTION_ARTIFACT_VERIFIER_KIND,
    async verifyProjectArtifact(selection) {
      calls.artifacts.push(selection);
      if (artifactError) throw artifactError;
      return artifactEvidence(selection);
    },
  };
  return {
    calls,
    service: new ProcessingAdoptionPreflightService({
      capabilityProvider,
      assetStateReader,
      artifactVerifier,
    }),
  };
}

function expectStudioError(callback, code) {
  assert.throws(callback, (error) => error instanceof StudioError && error.code === code);
}

async function expectStudioRejection(promise, code) {
  await assert.rejects(promise, (error) => error instanceof StudioError && error.code === code);
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
  assert.ok(Object.isFrozen(value));
  for (const child of Object.values(value)) assertDeepFrozen(child, seen);
}

test('A1.3 produces a deterministic immutable non-authorizing closure receipt', async () => {
  const manifest = processingCapabilityFixture();
  const request = requestFixture({ manifest });
  const original = structuredClone(request);
  const assetEvidence = assetStateFixture(request);
  const artifactEvidenceByRole = new Map([
    ['recipe-input', artifactEvidenceFixture(request, 'recipe-input')],
    ['selected-output', artifactEvidenceFixture(request, 'selected-output')],
  ]);
  const { calls, service } = serviceFixture({
    manifest,
    request,
    assetEvidence,
    artifactEvidence: (selection) => artifactEvidenceByRole.get(selection.role),
  });
  const receipt = await service.preflight(request);
  const replay = await serviceFixture({ manifest, request: reverseObjectFields(request) })
    .service.preflight(reverseObjectFields(request));

  assert.deepEqual(request, original);
  assert.deepEqual(replay, receipt);
  assert.equal(
    canonicalProcessingAdoptionPreflightReceiptJson(replay),
    canonicalProcessingAdoptionPreflightReceiptJson(receipt),
  );
  assert.equal(receipt.schemaVersion, 1);
  assert.equal(receipt.kind, PROCESSING_ADOPTION_PREFLIGHT_RECEIPT_KIND);
  assert.equal(receipt.status, 'PREFLIGHT_PASSED');
  assert.equal(receipt.effect, 'READ_ONLY');
  assert.equal(receipt.authorization, 'NOT_GRANTED');
  assert.equal(receipt.assetMutation, 'NONE');
  assert.equal(receipt.revalidation, 'REQUIRED_AT_MUTATION');
  assert.equal(receipt.warningDisposition, 'NONE');
  assert.deepEqual(receipt.blockers, []);
  assert.deepEqual(receipt.unresolvedWarnings, []);
  assertDeepFrozen(receipt);
  assert.deepEqual(validateProcessingAdoptionPreflightReceipt(receipt), receipt);
  assert.ok(canonicalProcessingAdoptionPreflightRequestJson(request).endsWith('\n'));
  assert.ok(canonicalProcessingAdoptionPreflightReceiptJson(receipt).endsWith('\n'));
  assert.equal(
    processingAdoptionPreflightRequestSha256(request),
    'edbcc5deddec9a49eba30a8a42f315722c833c96504ec74e14944599379fd840',
  );
  assert.equal(
    processingAdoptionPreflightReceiptSha256(receipt),
    'fe6e897d4eec5a770fc6b79a25dd812d31f183de69a518f932c4926ca83b66fb',
  );
  assert.equal(receipt.requestFingerprint, processingAdoptionPreflightRequestSha256(request));
  assert.equal(calls.capability.length, 1);
  assert.equal(calls.asset.length, 1);
  assert.equal(calls.artifacts.length, 2);
  assert.deepEqual(Object.keys(calls.artifacts[0]), [
    'schemaVersion', 'projectId', 'revision', 'role', 'sha256',
  ]);
  assert.equal('artifactUri' in calls.artifacts[0], false);
  assert.equal('path' in calls.artifacts[0], false);
  assert.equal(JSON.stringify(receipt).includes('USER_APPROVED'), false);
  assert.equal(JSON.stringify(receipt).includes('grantId'), false);
  assert.equal(JSON.stringify(receipt).includes('destination'), false);

  const stableReceiptJson = canonicalProcessingAdoptionPreflightReceiptJson(receipt);
  request.target.assetId = 'asset.caller-mutated';
  assetEvidence.assetId = 'asset.port-mutated';
  artifactEvidenceByRole.get('selected-output').physical.width = 1;
  assert.equal(canonicalProcessingAdoptionPreflightReceiptJson(receipt), stableReceiptJson);

  assert.equal(listCommandDefinitions().length, 33);
  assert.equal(implementedCommandTypes().length, 33);
});

test('current Numberdroid capability profile v1 fails closed before asset or CAS reads', async () => {
  const manifest = NUMBERDROID_PROJECT_CAPABILITY_MANIFEST;
  const request = requestFixture({ manifest });
  const { calls, service } = serviceFixture({ manifest, request });
  const receipt = await service.preflight(request);

  assert.equal(receipt.status, 'PREFLIGHT_BLOCKED');
  assert.equal(receipt.capabilityCheck.status, 'UNSUPPORTED');
  assert.ok(receipt.blockers.some(({ code }) => code === 'PROCESSING_ADOPTION_CAPABILITY_UNSUPPORTED'));
  assert.equal(calls.capability.length, 1);
  assert.equal(calls.asset.length, 0);
  assert.equal(calls.artifacts.length, 0);
  assert.equal(
    projectCapabilityManifestSha256(manifest),
    '826a8b7942ccba97393f55efa356525529994ad34189446992a7dff58fe97049',
  );
});

test('ERROR findings block without reads while WARNING findings remain unresolved and non-authorizing', async () => {
  const errorRequest = requestFixture({ findings: [findingFixture('ERROR')] });
  const errorFixture = serviceFixture({ request: errorRequest });
  const blocked = await errorFixture.service.preflight(errorRequest);
  assert.equal(blocked.status, 'PREFLIGHT_BLOCKED');
  assert.ok(blocked.blockers.some(({ code }) => code === 'PROCESSING_RESULT_ERROR'));
  assert.deepEqual(errorFixture.calls, { capability: [], asset: [], artifacts: [] });

  const warningRequest = requestFixture({ findings: [findingFixture('WARNING')] });
  const warningFixture = serviceFixture({ request: warningRequest });
  const passed = await warningFixture.service.preflight(warningRequest);
  assert.equal(passed.status, 'PREFLIGHT_PASSED');
  assert.equal(passed.warningDisposition, 'UNRESOLVED');
  assert.equal(passed.unresolvedWarnings.length, 1);
  assert.equal(passed.unresolvedWarnings[0].severity, 'WARNING');
  assert.equal(passed.authorization, 'NOT_GRANTED');
});

test('create and update coordinates fail closed on identity, kind, versions, and revision drift', async () => {
  const createRequest = requestFixture();
  const createCheck = evaluateProcessingAdoptionAssetState(
    createRequest,
    assetStateFixture(createRequest),
  );
  assert.equal(createCheck.status, 'MATCHED');
  assert.equal(
    evaluateProcessingAdoptionAssetState(
      createRequest,
      assetStateFixture(createRequest, { identityState: 'LEGACY_OCCUPIED' }),
    ).status,
    'TARGET_OCCUPIED',
  );
  assert.equal(
    evaluateProcessingAdoptionAssetState(
      createRequest,
      assetStateFixture(createRequest, { identityState: 'AMBIGUOUS' }),
    ).status,
    'TARGET_AMBIGUOUS',
  );

  const updateRequest = requestFixture({ operation: 'update' });
  assert.equal(
    evaluateProcessingAdoptionAssetState(updateRequest, assetStateFixture(updateRequest)).status,
    'MATCHED',
  );
  assert.equal(
    evaluateProcessingAdoptionAssetState(
      updateRequest,
      assetStateFixture(updateRequest, { head: { assetVersion: 4 } }),
    ).status,
    'TARGET_VERSION_CONFLICT',
  );
  assert.equal(
    evaluateProcessingAdoptionAssetState(
      updateRequest,
      assetStateFixture(updateRequest, { head: { metadataVersion: 5 } }),
    ).status,
    'TARGET_VERSION_CONFLICT',
  );
  assert.equal(
    evaluateProcessingAdoptionAssetState(
      updateRequest,
      assetStateFixture(updateRequest, { head: { assetKind: 'prop' } }),
    ).status,
    'TARGET_KIND_MISMATCH',
  );
  assert.equal(
    evaluateProcessingAdoptionAssetState(
      updateRequest,
      assetStateFixture(updateRequest, { project: { observedRevision: 18 } }),
    ).status,
    'PROJECT_REVISION_STALE',
  );
  assert.equal(
    evaluateProcessingAdoptionAssetState(
      updateRequest,
      assetStateFixture(updateRequest, { identityState: 'UNUSED' }),
    ).status,
    'TARGET_NOT_FOUND',
  );
  assert.equal(
    evaluateProcessingAdoptionAssetState(
      updateRequest,
      assetStateFixture(updateRequest, { identityState: 'LEGACY_OCCUPIED' }),
    ).status,
    'TARGET_LEGACY_ONLY',
  );
  expectStudioError(
    () => evaluateProcessingAdoptionAssetState(
      updateRequest,
      assetStateFixture(updateRequest, { project: { projectId: 'project.other' } }),
    ),
    'PROCESSING_ADOPTION_PREFLIGHT_SCOPE_MISMATCH',
  );
  expectStudioError(
    () => evaluateProcessingAdoptionAssetState(
      updateRequest,
      assetStateFixture(updateRequest, { head: { assetId: 'asset.other' } }),
    ),
    'PROCESSING_ADOPTION_PREFLIGHT_SCOPE_MISMATCH',
  );
  expectStudioError(
    () => validateProcessingAdoptionPreflightRequest(requestFixture({
      operation: 'create',
      expectedAssetVersion: 1,
    })),
    'PROCESSING_ADOPTION_PREFLIGHT_TARGET_INVALID',
  );
  expectStudioError(
    () => validateProcessingAdoptionPreflightRequest(requestFixture({
      operation: 'create',
      expectedMetadataVersion: 1,
    })),
    'PROCESSING_ADOPTION_PREFLIGHT_TARGET_INVALID',
  );
});

test('project-scoped CAS evidence revalidates registered LIVE and physical descriptors independently', async () => {
  const request = requestFixture();
  for (const role of ['recipe-input', 'selected-output']) {
    assert.equal(
      evaluateProcessingAdoptionArtifact(
        request,
        role,
        artifactEvidenceFixture(request, role),
      ).status,
      'VERIFIED',
    );
  }
  for (const role of ['recipe-input', 'selected-output']) {
    for (const status of [
      'PROJECT_REFERENCE_MISSING',
      'METADATA_MISSING',
      'NOT_LIVE',
      'CONTENT_MISSING',
      'CONTENT_CORRUPT',
    ]) {
      const fixture = serviceFixture({
        request,
        artifactEvidence: (selection) => artifactEvidenceFixture(request, selection.role, {
          status: selection.role === role ? status : 'VERIFIED',
        }),
      });
      const receipt = await fixture.service.preflight(request);
      assert.equal(receipt.status, 'PREFLIGHT_BLOCKED');
      assert.equal(receipt.artifactChecks.find((check) => check.role === role).status, status);
    }
  }

  const physicalDrift = artifactEvidenceFixture(request, 'selected-output', {
    physical: { width: request.assetInputSelection.selectedOutput.width - 1 },
  });
  assert.equal(
    evaluateProcessingAdoptionArtifact(request, 'selected-output', physicalDrift).status,
    'DESCRIPTOR_MISMATCH',
  );
  const metadataDrift = artifactEvidenceFixture(request, 'selected-output', {
    metadata: { byteSize: request.assetInputSelection.selectedOutput.byteSize - 1 },
  });
  assert.equal(
    evaluateProcessingAdoptionArtifact(request, 'selected-output', metadataDrift).status,
    'DESCRIPTOR_MISMATCH',
  );
  const blockedMetadataDrift = artifactEvidenceFixture(request, 'selected-output', {
    status: 'CONTENT_CORRUPT',
    metadata: { width: request.assetInputSelection.selectedOutput.width - 1 },
  });
  assert.equal(
    evaluateProcessingAdoptionArtifact(request, 'selected-output', blockedMetadataDrift).status,
    'DESCRIPTOR_MISMATCH',
  );
  for (const role of ['recipe-input', 'selected-output']) {
    const descriptor = descriptorFor(request, role);
    for (const metadata of [
      { byteSize: descriptor.byteSize - 1 },
      { width: descriptor.width - 1 },
      { height: descriptor.height - 1 },
      {
        sha256: outputSha256s[2],
        artifactUri: `studio://artifacts/sha256/${outputSha256s[2]}`,
      },
    ]) {
      assert.equal(
        evaluateProcessingAdoptionArtifact(
          request,
          role,
          artifactEvidenceFixture(request, role, { metadata }),
        ).status,
        'DESCRIPTOR_MISMATCH',
      );
    }
    expectStudioError(
      () => evaluateProcessingAdoptionArtifact(
        request,
        role,
        artifactEvidenceFixture(request, role, {
          metadata: { artifactUri: `studio://artifacts/sha256/${outputSha256s[2]}` },
        }),
      ),
      'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
    );
    expectStudioError(
      () => evaluateProcessingAdoptionArtifact(
        request,
        role,
        artifactEvidenceFixture(request, role, { metadata: { mediaType: 'image/webp' } }),
      ),
      'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
    );
  }
  assert.equal(
    evaluateProcessingAdoptionArtifact(
      request,
      'selected-output',
      artifactEvidenceFixture(request, 'selected-output', { project: { observedRevision: 18 } }),
    ).status,
    'PROJECT_REVISION_STALE',
  );
  expectStudioError(
    () => evaluateProcessingAdoptionArtifact(
      request,
      'selected-output',
      artifactEvidenceFixture(request, 'selected-output', { project: { projectId: 'project.other' } }),
    ),
    'PROCESSING_ADOPTION_PREFLIGHT_SCOPE_MISMATCH',
  );
});

test('capability pin and exact processing operation reject drift without widening module support', async () => {
  const manifest = processingCapabilityFixture();
  const pinDrift = requestFixture({ manifest });
  pinDrift.capability.manifestFingerprint = '0'.repeat(64);
  const pinFixture = serviceFixture({ manifest, request: pinDrift });
  const pinReceipt = await pinFixture.service.preflight(pinDrift);
  assert.equal(pinReceipt.capabilityCheck.status, 'PIN_MISMATCH');
  assert.equal(pinFixture.calls.asset.length, 0);

  const unsupportedRaw = structuredClone(manifest);
  unsupportedRaw.operations.find(({ id }) => id === PROCESSING_ADOPTION_PREFLIGHT_OPERATION_ID)
    .outputFormatIds.push('studio.project-document');
  const unsupported = validateProjectCapabilityManifest(unsupportedRaw);
  const unsupportedRequest = requestFixture({ manifest: unsupported });
  const unsupportedFixture = serviceFixture({ manifest: unsupported, request: unsupportedRequest });
  const unsupportedReceipt = await unsupportedFixture.service.preflight(unsupportedRequest);
  assert.equal(unsupportedReceipt.capabilityCheck.status, 'UNSUPPORTED');
  assert.equal(unsupportedFixture.calls.asset.length, 0);

  const missingProfileFixture = serviceFixture({ manifest: null, request: requestFixture() });
  const missingProfileReceipt = await missingProfileFixture.service.preflight(requestFixture());
  assert.equal(missingProfileReceipt.capabilityCheck.status, 'PROFILE_NOT_FOUND');
  assert.ok(missingProfileReceipt.blockers.some(
    ({ code }) => code === 'PROCESSING_ADOPTION_CAPABILITY_PROFILE_NOT_FOUND',
  ));
  assert.equal(missingProfileFixture.calls.asset.length, 0);
  assert.equal(missingProfileFixture.calls.artifacts.length, 0);
});

test('standalone receipt validation re-closes every declared check and short-circuit stage', async () => {
  const request = requestFixture();
  const { service } = serviceFixture({ request });
  const receipt = await service.preflight(request);

  const capabilityForgery = structuredClone(receipt);
  capabilityForgery.capabilityCheck.observed.modules.find(({ id }) => id === 'studio.image-processing')
    .version = 'v0';
  expectStudioError(
    () => validateProcessingAdoptionPreflightReceipt(capabilityForgery),
    'PROCESSING_ADOPTION_PREFLIGHT_RECEIPT_MISMATCH',
  );
  for (const mutate of [
    (candidate) => { candidate.capabilityCheck.observed.manifestFingerprint = '0'.repeat(64); },
    (candidate) => { candidate.capabilityCheck.observed.operation.version = 2; },
  ]) {
    const forged = structuredClone(receipt);
    mutate(forged);
    expectStudioError(
      () => validateProcessingAdoptionPreflightReceipt(forged),
      'PROCESSING_ADOPTION_PREFLIGHT_RECEIPT_MISMATCH',
    );
  }

  const artifactForgery = structuredClone(receipt);
  artifactForgery.artifactChecks[1].observed.physical.width -= 1;
  expectStudioError(
    () => validateProcessingAdoptionPreflightReceipt(artifactForgery),
    'PROCESSING_ADOPTION_PREFLIGHT_RECEIPT_MISMATCH',
  );

  const illegalShortCircuit = structuredClone(receipt);
  illegalShortCircuit.artifactChecks[1] = {
    role: 'selected-output',
    status: 'NOT_CHECKED',
    observed: null,
  };
  expectStudioError(
    () => validateProcessingAdoptionPreflightReceipt(illegalShortCircuit),
    'PROCESSING_ADOPTION_PREFLIGHT_RECEIPT_MISMATCH',
  );

  const updateRequest = requestFixture({ operation: 'update' });
  const updateFixture = serviceFixture({ request: updateRequest });
  const updateReceipt = await updateFixture.service.preflight(updateRequest);
  const assetForgery = structuredClone(updateReceipt);
  assetForgery.assetStateCheck.observed.head.assetVersion += 1;
  expectStudioError(
    () => validateProcessingAdoptionPreflightReceipt(assetForgery),
    'PROCESSING_ADOPTION_PREFLIGHT_RECEIPT_MISMATCH',
  );
});

test('service closes Recipe to Result to Selection before any dependency read', async () => {
  const resultDrift = requestFixture();
  resultDrift.processingResult.recipe.fingerprint = '0'.repeat(64);
  const resultFixtureService = serviceFixture({ request: resultDrift });
  await expectStudioRejection(
    resultFixtureService.service.preflight(resultDrift),
    'PROCESSING_RESULT_RECIPE_MISMATCH',
  );
  assert.deepEqual(resultFixtureService.calls, { capability: [], asset: [], artifacts: [] });

  const selectionDrift = structuredClone(requestFixture());
  selectionDrift.assetInputSelection.recipe.id = 'recipe.other';
  const selectionFixtureService = serviceFixture({ request: selectionDrift });
  await expectStudioRejection(
    selectionFixtureService.service.preflight(selectionDrift),
    'ASSET_INPUT_SELECTION_RESULT_MISMATCH',
  );
  assert.deepEqual(selectionFixtureService.calls, { capability: [], asset: [], artifacts: [] });
});

test('malformed and adversarial input graphs fail without getters, proxy traps, or receipts', async () => {
  const inherited = Object.create({ kind: PROCESSING_ADOPTION_PREFLIGHT_REQUEST_KIND });
  Object.assign(inherited, requestFixture());
  delete inherited.kind;
  expectStudioError(
    () => validateProcessingAdoptionPreflightRequest(inherited),
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
  );

  let getterCalls = 0;
  const accessor = requestFixture();
  Object.defineProperty(accessor.project, 'projectId', {
    enumerable: true,
    get() {
      getterCalls += 1;
      return 'project.trapped';
    },
  });
  expectStudioError(
    () => validateProcessingAdoptionPreflightRequest(accessor),
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
  );
  assert.equal(getterCalls, 0);

  let proxyReads = 0;
  const proxied = requestFixture();
  proxied.target = new Proxy(proxied.target, {
    get(target, key, receiver) {
      proxyReads += 1;
      return Reflect.get(target, key, receiver);
    },
  });
  expectStudioError(
    () => validateProcessingAdoptionPreflightRequest(proxied),
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
  );
  assert.equal(proxyReads, 0);

  const sparse = requestFixture();
  sparse.processingResult.findings = new Array(1);
  expectStudioError(
    () => validateProcessingAdoptionPreflightRequest(sparse),
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
  );

  const hidden = requestFixture();
  Object.defineProperty(hidden.target, 'hidden', { value: true });
  expectStudioError(
    () => validateProcessingAdoptionPreflightRequest(hidden),
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
  );

  const symbolic = requestFixture();
  symbolic.target[Symbol('authority')] = true;
  expectStudioError(
    () => validateProcessingAdoptionPreflightRequest(symbolic),
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
  );

  const customPrototype = requestFixture();
  Object.setPrototypeOf(customPrototype.target, { operation: 'create' });
  expectStudioError(
    () => validateProcessingAdoptionPreflightRequest(customPrototype),
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
  );

  const cyclic = requestFixture();
  cyclic.target.cycle = cyclic.target;
  expectStudioError(
    () => validateProcessingAdoptionPreflightRequest(cyclic),
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
  );

  const revoked = requestFixture();
  const revocable = Proxy.revocable(revoked.target, {});
  revoked.target = revocable.proxy;
  revocable.revoke();
  expectStudioError(
    () => validateProcessingAdoptionPreflightRequest(revoked),
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
  );

  const arrayProperty = requestFixture();
  arrayProperty.processingResult.findings.extra = true;
  expectStudioError(
    () => validateProcessingAdoptionPreflightRequest(arrayProperty),
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
  );

  const tooDeep = requestFixture();
  tooDeep.extra = {};
  let cursor = tooDeep.extra;
  for (let index = 0; index < 50; index += 1) {
    cursor.next = {};
    cursor = cursor.next;
  }
  expectStudioError(
    () => validateProcessingAdoptionPreflightRequest(tooDeep),
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
  );

  const oversizedArray = requestFixture();
  oversizedArray.extra = new Array(4097).fill(null);
  expectStudioError(
    () => validateProcessingAdoptionPreflightRequest(oversizedArray),
    'PROCESSING_ADOPTION_PREFLIGHT_INVALID',
  );

  const pollutedRequest = requestFixture();
  const priorToJson = Object.getOwnPropertyDescriptor(Object.prototype, 'toJSON');
  let toJsonCalls = 0;
  try {
    Object.defineProperty(Object.prototype, 'toJSON', {
      configurable: true,
      value() {
        toJsonCalls += 1;
        return 'polluted';
      },
    });
    assert.match(processingAdoptionPreflightRequestSha256(pollutedRequest), /^[a-f0-9]{64}$/);
    const pollutedFixture = serviceFixture({ request: pollutedRequest });
    const pollutedReceipt = await pollutedFixture.service.preflight(pollutedRequest);
    assert.equal(pollutedReceipt.status, 'PREFLIGHT_PASSED');
    assert.match(processingAdoptionPreflightReceiptSha256(pollutedReceipt), /^[a-f0-9]{64}$/);
    assert.equal(toJsonCalls, 0);
  } finally {
    if (priorToJson) Object.defineProperty(Object.prototype, 'toJSON', priorToJson);
    else delete Object.prototype.toJSON;
  }
});

test('cancellation is preserved and read-port failures are sanitized without path or cause leakage', async () => {
  const request = requestFixture();
  const preAborted = new AbortController();
  preAborted.abort(new Error('caller cancelled'));
  const preFixture = serviceFixture({ request });
  await assert.rejects(
    preFixture.service.preflight(request, { signal: preAborted.signal }),
    (error) => error.message === 'caller cancelled',
  );
  assert.deepEqual(preFixture.calls, { capability: [], asset: [], artifacts: [] });

  const duringController = new AbortController();
  const duringReason = new Error('cancelled after capability read');
  const manifest = processingCapabilityFixture();
  const duringService = new ProcessingAdoptionPreflightService({
    capabilityProvider: {
      async getProjectCapabilityManifest() {
        duringController.abort(duringReason);
        return manifest;
      },
    },
    assetStateReader: {
      schemaVersion: 1,
      kind: PROCESSING_ADOPTION_ASSET_STATE_READER_KIND,
      async readAssetState() {
        assert.fail('asset state must not run after cancellation');
      },
    },
    artifactVerifier: {
      schemaVersion: 1,
      kind: PROCESSING_ADOPTION_ARTIFACT_VERIFIER_KIND,
      async verifyProjectArtifact() {
        assert.fail('artifact verification must not run after cancellation');
      },
    },
  });
  await assert.rejects(
    duringService.preflight(requestFixture({ manifest }), { signal: duringController.signal }),
    (error) => error === duringReason,
  );

  const afterAssetController = new AbortController();
  const afterAssetReason = new Error('cancelled after Asset read');
  let afterAssetArtifactCalls = 0;
  const afterAssetService = new ProcessingAdoptionPreflightService({
    capabilityProvider: { async getProjectCapabilityManifest() { return manifest; } },
    assetStateReader: {
      schemaVersion: 1,
      kind: PROCESSING_ADOPTION_ASSET_STATE_READER_KIND,
      async readAssetState() {
        afterAssetController.abort(afterAssetReason);
        return assetStateFixture(request);
      },
    },
    artifactVerifier: {
      schemaVersion: 1,
      kind: PROCESSING_ADOPTION_ARTIFACT_VERIFIER_KIND,
      async verifyProjectArtifact() {
        afterAssetArtifactCalls += 1;
        return artifactEvidenceFixture(request, 'recipe-input');
      },
    },
  });
  await assert.rejects(
    afterAssetService.preflight(request, { signal: afterAssetController.signal }),
    (error) => error === afterAssetReason,
  );
  assert.equal(afterAssetArtifactCalls, 0);

  const afterFirstArtifactController = new AbortController();
  const afterFirstArtifactReason = new Error('cancelled after first artifact read');
  let artifactCalls = 0;
  const afterFirstArtifactService = new ProcessingAdoptionPreflightService({
    capabilityProvider: { async getProjectCapabilityManifest() { return manifest; } },
    assetStateReader: {
      schemaVersion: 1,
      kind: PROCESSING_ADOPTION_ASSET_STATE_READER_KIND,
      async readAssetState() { return assetStateFixture(request); },
    },
    artifactVerifier: {
      schemaVersion: 1,
      kind: PROCESSING_ADOPTION_ARTIFACT_VERIFIER_KIND,
      async verifyProjectArtifact(selection) {
        artifactCalls += 1;
        if (artifactCalls === 1) afterFirstArtifactController.abort(afterFirstArtifactReason);
        return artifactEvidenceFixture(request, selection.role);
      },
    },
  });
  await assert.rejects(
    afterFirstArtifactService.preflight(request, { signal: afterFirstArtifactController.signal }),
    (error) => error === afterFirstArtifactReason,
  );
  assert.equal(artifactCalls, 1);

  for (const [port, options] of [
    ['capabilityProvider', { capabilityError: new Error('/private/capability/path') }],
    ['assetStateReader', { assetError: new Error('/private/asset/path') }],
    ['artifactVerifier', { artifactError: new Error('/private/cas/path') }],
  ]) {
    const fixture = serviceFixture({ request, ...options });
    await assert.rejects(
      fixture.service.preflight(request),
      (error) => error instanceof StudioError
        && error.code === 'PROCESSING_ADOPTION_PREFLIGHT_PORT_FAILED'
        && error.details.port === port
        && !JSON.stringify(error).includes('/private/'),
    );
  }

  const validAssetPort = {
    schemaVersion: 1,
    kind: PROCESSING_ADOPTION_ASSET_STATE_READER_KIND,
    async readAssetState() { return assetStateFixture(request); },
  };
  const validArtifactPort = {
    schemaVersion: 1,
    kind: PROCESSING_ADOPTION_ARTIFACT_VERIFIER_KIND,
    async verifyProjectArtifact(selection) {
      return artifactEvidenceFixture(request, selection.role);
    },
  };
  let capabilityGetterCalls = 0;
  const accessorProvider = {};
  Object.defineProperty(accessorProvider, 'getProjectCapabilityManifest', {
    enumerable: true,
    get() {
      capabilityGetterCalls += 1;
      return async () => manifest;
    },
  });
  assert.throws(
    () => new ProcessingAdoptionPreflightService({
      capabilityProvider: accessorProvider,
      assetStateReader: validAssetPort,
      artifactVerifier: validArtifactPort,
    }),
    (error) => error instanceof StudioError
      && error.code === 'PROCESSING_ADOPTION_PREFLIGHT_PORT_INVALID',
  );
  assert.equal(capabilityGetterCalls, 0);

  assert.throws(
    () => new ProcessingAdoptionPreflightService({
      capabilityProvider: { async getProjectCapabilityManifest() { return manifest; } },
      assetStateReader: { ...validAssetPort, writeAsset: () => {} },
      artifactVerifier: validArtifactPort,
    }),
    (error) => error instanceof StudioError
      && error.code === 'PROCESSING_ADOPTION_PREFLIGHT_PORT_INVALID',
  );

  const malformedAsset = serviceFixture({
    request,
    assetEvidence: { unsafe: '/private/asset/response' },
  });
  await assert.rejects(
    malformedAsset.service.preflight(request),
    (error) => error instanceof StudioError
      && error.code === 'PROCESSING_ADOPTION_PREFLIGHT_PORT_RESPONSE_INVALID'
      && error.details.port === 'assetStateReader'
      && !JSON.stringify(error).includes('/private/'),
  );

  const malformedCapability = serviceFixture({
    request,
    manifest: { profileId: '/private/capability/response' },
  });
  await assert.rejects(
    malformedCapability.service.preflight(request),
    (error) => error instanceof StudioError
      && error.code === 'PROCESSING_ADOPTION_PREFLIGHT_PORT_RESPONSE_INVALID'
      && error.details.port === 'capabilityProvider'
      && !JSON.stringify(error).includes('/private/'),
  );

  const malformedArtifact = serviceFixture({
    request,
    artifactEvidence: () => ({ unsafe: '/private/artifact/response' }),
  });
  await assert.rejects(
    malformedArtifact.service.preflight(request),
    (error) => error instanceof StudioError
      && error.code === 'PROCESSING_ADOPTION_PREFLIGHT_PORT_RESPONSE_INVALID'
      && error.details.port === 'artifactVerifier'
      && !JSON.stringify(error).includes('/private/'),
  );
});
