import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PROCESSING_ADOPTION_ARTIFACT_VERIFIER_KIND,
  PROCESSING_ADOPTION_ASSET_STATE_READER_KIND,
  PROCESSING_ADOPTION_TASK_AUTHORITY_EVIDENCE_KIND,
  PROCESSING_ADOPTION_TASK_AUTHORITY_READER_KIND,
  PROCESSING_ADOPTION_TASK_BRANCH_PREFLIGHT_EVIDENCE_KIND,
  PROCESSING_ADOPTION_TASK_BRANCH_PREFLIGHT_READER_KIND,
  ProcessingAdoptionPreflightService,
  ProcessingResultAdoptionPlanningService,
  implementedCommandTypes,
} from '../packages/application/src/index.js';
import {
  KNOWN_GRANT_SCOPES,
  PROCESSING_ADOPTION_PREFLIGHT_OPERATION_ID,
  PROCESSING_ADOPTION_PREFLIGHT_REQUEST_KIND,
  PROCESSING_RESULT_ADOPTION_COMMAND_KIND,
  PROCESSING_RESULT_ADOPTION_COMMAND_TYPE,
  PROCESSING_RESULT_ADOPTION_PLANNING_RESULT_KIND,
  PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE,
  StudioError,
  canonicalProcessingResultAdoptionCommandJson,
  canonicalRgbaPngByteSize,
  createExactPngCropProcessingRecipe,
  createPrimaryVisualAssetInputSelection,
  listCommandDefinitions,
  processingResultAdoptionCommandSha256,
  processingResultAdoptionSemanticSha256,
  processingRecipeSha256,
  projectCapabilityManifestSha256,
  validateAssetMetadata,
  validateAssetMetadataForVisualFacts,
  validateProcessingResultAdoptionAuthorityBinding,
  validateProcessingResultAdoptionCommand,
  validateProjectCapabilityManifest,
} from '../packages/domain/src/index.js';
import {
  NUMBERDROID_PROJECT_CAPABILITY_MANIFEST,
} from '../packages/numberdroid-adapter/src/index.js';
import { proposeRegularGrid } from '../packages/preview/src/index.js';

const NOW = '2026-08-28T12:00:00.000Z';
const FUTURE = '2026-08-29T12:00:00.000Z';
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

function commandFixture({ request = requestFixture(), commandId = 'command.adopt.1', idempotencyKey = 'idempotency.adopt.1' } = {}) {
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

function sliceBindingFixture({ width = 32, height = 48, pivot = { x: 3, y: 4 } } = {}) {
  return {
    projectId: 'project.family-hygiene',
    sliceId: 'slice.metadata-regression',
    sliceVersion: 1,
    atlasId: 'atlas.metadata-regression',
    sourceId: 'source.metadata-regression',
    sourceDigest: sourceSha256,
    definitionVersion: 1,
    definitionFingerprint: sourceSha256,
    rectangleId: 'rectangle.metadata-regression',
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
    digest: outputSha256s[0],
    artifactUri: `studio://artifacts/sha256/${outputSha256s[0]}`,
    mediaType: 'image/png',
    byteSize: canonicalRgbaPngByteSize(width, height),
    width,
    height,
    priorDigest: null,
    committedRevision: 1,
  };
}

function contextFixture(overrides = {}) {
  return {
    actor: { id: 'agent.processing.1', kind: 'agent', displayName: 'Processing Agent' },
    taskId: 'task.processing.1',
    grantId: 'grant.processing.1',
    branchId: 'branch.task-processing-1',
    correlationId: 'correlation.processing.1',
    ...overrides,
  };
}

function authorityEvidenceFixture(command, context, overrides = {}) {
  const task = {
    taskId: context.taskId,
    projectId: command.projectId,
    branchId: context.branchId,
    agentId: context.actor.id,
    grantId: context.grantId,
    state: 'ACTIVE',
    expiresAt: FUTURE,
    capabilities: [PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE],
    objectScopes: [
      { kind: 'project', id: command.projectId },
      { kind: 'asset', id: command.payload.preflightRequest.target.assetId },
    ],
    maxCommands: 1,
    usedCommands: 0,
    autoAcceptCommandTypes: [],
    ...overrides.task,
  };
  const grant = {
    id: context.grantId,
    projectId: command.projectId,
    branchId: context.branchId,
    agentId: context.actor.id,
    taskId: context.taskId,
    status: 'ACTIVE',
    expiresAt: FUTURE,
    revokedAt: null,
    scopes: [PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE],
    objectScopes: [
      { kind: 'project', id: command.projectId },
      { kind: 'asset', id: command.payload.preflightRequest.target.assetId },
    ],
    maxCommands: 1,
    usedCommands: 0,
    ...overrides.grant,
  };
  return {
    schemaVersion: 1,
    kind: PROCESSING_ADOPTION_TASK_AUTHORITY_EVIDENCE_KIND,
    projectId: command.projectId,
    branchId: context.branchId,
    branchRevision: command.baseRevision,
    task: overrides.task === null ? null : task,
    grant: overrides.grant === null ? null : grant,
    ...Object.fromEntries(Object.entries(overrides).filter(([key]) => !['task', 'grant'].includes(key))),
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
    ...Object.fromEntries(
      Object.entries(overrides).filter(([key]) => !['project', 'head'].includes(key)),
    ),
  };
}

function artifactEvidenceFixture(request, role, overrides = {}) {
  const descriptor = role === 'recipe-input'
    ? request.processingRecipe.inputs[0]
    : request.assetInputSelection.selectedOutput;
  const status = overrides.status ?? 'VERIFIED';
  const metadata = ['PROJECT_REFERENCE_MISSING', 'METADATA_MISSING'].includes(status)
    ? null
    : {
      artifactUri: descriptor.artifactUri,
      sha256: descriptor.sha256,
      mediaType: descriptor.mediaType,
      byteSize: descriptor.byteSize,
      width: descriptor.width,
      height: descriptor.height,
      state: status === 'NOT_LIVE' ? 'QUARANTINED' : 'LIVE',
      ...overrides.metadata,
    };
  const physical = status === 'VERIFIED'
    ? {
      sha256: descriptor.sha256,
      mediaType: descriptor.mediaType,
      byteSize: descriptor.byteSize,
      width: descriptor.width,
      height: descriptor.height,
      ...overrides.physical,
    }
    : null;
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
    ...Object.fromEntries(
      Object.entries(overrides).filter(([key]) => ![
        'project', 'metadata', 'physical', 'status',
      ].includes(key)),
    ),
  };
}

async function freshReceipt(
  request,
  manifest = processingCapabilityFixture(),
  {
    assetEvidence = assetStateFixture(request),
    artifactEvidence = (selection) => artifactEvidenceFixture(request, selection.role),
  } = {},
) {
  const service = new ProcessingAdoptionPreflightService({
    capabilityProvider: {
      async getProjectCapabilityManifest() {
        return manifest;
      },
    },
    assetStateReader: {
      schemaVersion: 1,
      kind: PROCESSING_ADOPTION_ASSET_STATE_READER_KIND,
      async readAssetState() {
        return assetEvidence;
      },
    },
    artifactVerifier: {
      schemaVersion: 1,
      kind: PROCESSING_ADOPTION_ARTIFACT_VERIFIER_KIND,
      async verifyProjectArtifact(selection) {
        return artifactEvidence(selection);
      },
    },
  });
  return service.preflight(request);
}

async function planningFixture({
  request = requestFixture(),
  command = commandFixture({ request }),
  context = contextFixture(),
  authorityEvidence = authorityEvidenceFixture(command, context),
  receipt,
  authorityImplementation,
  preflightImplementation,
  clock = () => NOW,
} = {}) {
  const selectedReceipt = receipt ?? await freshReceipt(request, request.capability.profileId === NUMBERDROID_PROJECT_CAPABILITY_MANIFEST.profileId
    ? NUMBERDROID_PROJECT_CAPABILITY_MANIFEST
    : processingCapabilityFixture());
  const calls = { order: [], authority: [], preflight: [] };
  const taskAuthorityReader = {
    schemaVersion: 1,
    kind: PROCESSING_ADOPTION_TASK_AUTHORITY_READER_KIND,
    async readTaskAuthority(selection, options) {
      calls.order.push('authority');
      calls.authority.push({ selection, options });
      return authorityImplementation
        ? authorityImplementation(selection, options)
        : authorityEvidence;
    },
  };
  const taskBranchPreflightReader = {
    schemaVersion: 1,
    kind: PROCESSING_ADOPTION_TASK_BRANCH_PREFLIGHT_READER_KIND,
    async preflightTaskBranch(selection, options) {
      calls.order.push('preflight');
      calls.preflight.push({ selection, options });
      return preflightImplementation
        ? preflightImplementation(selection, options)
        : {
          schemaVersion: 1,
          kind: PROCESSING_ADOPTION_TASK_BRANCH_PREFLIGHT_EVIDENCE_KIND,
          projectId: selection.projectId,
          branchId: selection.branchId,
          revision: selection.revision,
          receipt: selectedReceipt,
        };
    },
  };
  return {
    calls,
    command,
    context,
    authorityEvidence,
    receipt: selectedReceipt,
    service: new ProcessingResultAdoptionPlanningService({
      taskAuthorityReader,
      taskBranchPreflightReader,
      clock,
    }),
  };
}

function expectStudioError(callback, code) {
  assert.throws(callback, (error) => error instanceof StudioError && error.code === code);
}

async function expectStudioRejection(promise, code) {
  await assert.rejects(promise, (error) => error instanceof StudioError && error.code === code);
}

function assertDeepFrozen(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  assert.ok(Object.isFrozen(value));
  for (const child of Object.values(value)) assertDeepFrozen(child, seen);
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

test('A1.4 deterministically plans create without granting authority, committing, or registering a command', async () => {
  const fixture = await planningFixture();
  const original = structuredClone(fixture.command);
  const result = await fixture.service.prepare(fixture.command, fixture.context);
  const replay = await fixture.service.prepare(reverseObjectFields(fixture.command), reverseObjectFields(fixture.context));

  assert.deepEqual(fixture.command, original);
  assert.deepEqual(replay, result);
  assert.equal(result.kind, PROCESSING_RESULT_ADOPTION_PLANNING_RESULT_KIND);
  assert.equal(result.status, 'READY');
  assert.equal(result.effect, 'NONE');
  assert.equal(result.authorization, 'NOT_GRANTED');
  assert.equal(result.persistence, 'NOT_PERFORMED');
  assert.equal(result.commitState, 'NOT_ATTEMPTED');
  assert.equal(result.idempotencyState, 'NOT_CHECKED');
  assert.equal(result.replayState, 'NOT_PERFORMED');
  assert.equal(result.revalidation, 'REQUIRED_IN_ATOMIC_UNIT_OF_WORK');
  assert.equal(result.commandFingerprint, 'fcecd066ab4b886271947d4198d1b872fbd2b91f0af0f731a8369ba79dc61e40');
  assert.equal(result.semanticFingerprint, '80d1ea00d417e2c83227293226da89338f86bb92ee9e0095e132d6c4de30f0cd');
  assert.equal(result.plan.status, 'READY_FOR_ATOMIC_UNIT_OF_WORK');
  assert.equal(result.plan.effect, 'NONE');
  assert.equal(result.plan.authority.requiredScope, PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE);
  assert.equal(result.plan.authority.autoAcceptAllowed, false);
  assert.equal(result.plan.authority.commandBudgetCharge, 1);
  assert.equal(result.plan.idempotencyState, 'NOT_CHECKED');
  assert.equal(result.plan.replayState, 'NOT_PERFORMED');
  assert.deepEqual(result.plan.idempotencyPolicy, {
    state: 'NOT_CHECKED',
    replay: 'NOT_PERFORMED',
    keyScope: 'TASK_BRANCH',
    sameKeySameSemanticFingerprint: 'RETURN_ORIGINAL_RESULT',
    sameKeyDifferentSemanticFingerprint: 'FAIL_IDEMPOTENCY_CONFLICT',
    sameCommandIdDifferentKey: 'FAIL_COMMAND_ID_CONFLICT',
    enforcement: 'REQUIRED_IN_ATOMIC_UNIT_OF_WORK',
  });
  assert.deepEqual(result.plan.atomicUnitPolicy, {
    state: 'NOT_ATTEMPTED',
    boundary: 'ALL_LISTED_EFFECTS_OR_NONE',
    partialCommit: 'FORBIDDEN',
    unknownOutcomeRecovery: 'RETRY_SAME_IDEMPOTENCY_KEY',
  });
  assert.equal(result.plan.target.operation, 'create');
  assert.equal(result.plan.target.lifecyclePolicy, 'INITIALIZE_DRAFT');
  assert.equal(result.plan.target.lifecycle, 'DRAFT');
  assert.equal(result.plan.target.assetName, 'Family Hygiene Floor');
  assert.equal(result.plan.target.namePolicy, 'SET_EXPLICIT_CREATE_NAME');
  assert.equal(result.plan.target.metadataPolicy, 'INITIALIZE_EXPLICIT_EMPTY_DRAFT_V1');
  assert.equal(result.plan.target.predictedAssetVersion, 1);
  assert.equal(result.plan.target.predictedMetadataVersion, 1);
  assert.deepEqual(result.plan.target.initialMetadata.tags, []);
  assert.deepEqual(result.plan.target.initialMetadata.connectors, []);
  assert.deepEqual(result.plan.target.initialMetadata.pixelSize, result.plan.processingBinding.pixelSize);
  assert.equal(result.plan.target.initialMetadata.pivot, null);
  assert.match(result.plan.target.initialMetadataFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(result.plan.target.initialMetadataFindings.length, 8);
  assert.ok(result.plan.target.initialMetadataFindings.every(({ severity }) => severity === 'ERROR'));
  assert.deepEqual(result.plan.target.currentMetadata, null);
  assert.deepEqual(result.plan.target.currentMetadataFingerprint, null);
  assert.deepEqual(result.plan.target.currentMetadataFindings, null);
  assert.deepEqual(result.plan.target.warningDispositions, []);
  assert.equal(result.plan.processingBinding.pivot, null);
  assert.equal(result.plan.processingBinding.fingerprint, '8f0e0230b8a1aba25dfc9b62d13e6d9290bbd8f2973b5494cc2e66b8df899d5b');
  assert.equal(result.plan.freshPreflightReceiptFingerprint, 'fe6e897d4eec5a770fc6b79a25dd812d31f183de69a518f932c4926ca83b66fb');
  assert.equal(result.plan.planFingerprint, 'd206798f78bac57ef47741cdc7b71b6deeb93e0702b8cb110549ffb9e4273d9b');
  assert.deepEqual(result.plan.permanentReferenceRoles, ['recipe-input', 'selected-output']);
  assert.ok(result.plan.revalidationRequirements.includes('TASK_BRANCH_HEAD'));
  assert.ok(result.plan.revalidationRequirements.includes('ASSET_METADATA_FINGERPRINT'));
  assert.ok(result.plan.revalidationRequirements.includes('ASSET_VALIDATION_FINDINGS'));
  assert.ok(result.plan.revalidationRequirements.includes('ASSET_WARNING_DISPOSITION_STATE'));
  assert.ok(result.plan.revalidationRequirements.includes('IDEMPOTENCY_AND_COMMAND_LEDGER'));
  assert.ok(result.plan.atomicEffects.includes('ASSET_METADATA'));
  assert.ok(result.plan.atomicEffects.includes('ASSET_VALIDATION_FINDINGS'));
  assert.ok(result.plan.atomicEffects.includes('ASSET_WARNING_DISPOSITION_RESET'));
  assert.ok(result.plan.atomicEffects.includes('COMMAND_BUDGET_CHARGE'));
  assert.equal(JSON.stringify(result).includes('grant.processing.1'), false);
  assert.equal(JSON.stringify(result).includes('USER_APPROVED'), false);
  assert.equal(JSON.stringify(result).includes('COMMITTED'), false);
  assert.equal(JSON.stringify(result).includes('REPLAYED'), false);
  assertDeepFrozen(result);
  assert.deepEqual(fixture.calls.order, ['authority', 'preflight', 'authority', 'preflight']);
  assert.equal(fixture.calls.authority.length, 2);
  assert.equal(fixture.calls.preflight.length, 2);
  assert.equal(Object.isFrozen(fixture.calls.authority[0].selection), true);
  assert.equal(Object.isFrozen(fixture.calls.preflight[0].selection), true);
  assert.equal(listCommandDefinitions().length, 33);
  assert.equal(implementedCommandTypes().length, 33);
  assert.equal(listCommandDefinitions().some(({ type }) => type === PROCESSING_RESULT_ADOPTION_COMMAND_TYPE), false);
  assert.equal(KNOWN_GRANT_SCOPES.includes(PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE), false);
});

test('A1.4 update preserves authored metadata and leaves the derived-fact version outcome conditional', async () => {
  const request = requestFixture({ operation: 'update' });
  const fixture = await planningFixture({ request, command: commandFixture({ request }) });
  const result = await fixture.service.prepare(fixture.command, fixture.context);

  assert.equal(result.status, 'READY');
  assert.equal(result.plan.target.operation, 'update');
  assert.equal(result.plan.target.lifecyclePolicy, 'RESET_NEW_VERSION_TO_DRAFT');
  assert.equal(result.plan.target.lifecycle, 'DRAFT');
  assert.equal(result.plan.target.namePolicy, 'PRESERVE_CURRENT');
  assert.equal(result.plan.target.assetName, null);
  assert.equal(result.plan.target.metadataPolicy, 'PRESERVE_AUTHORED_REVALIDATE_DERIVED_VISUAL_FACTS');
  assert.equal(result.plan.target.metadataValidation, 'REQUIRED_IN_ATOMIC_UNIT_OF_WORK');
  assert.equal(result.plan.target.initialMetadata, null);
  assert.equal(result.plan.target.initialMetadataFingerprint, null);
  assert.equal(result.plan.target.initialMetadataFindings, null);
  assert.equal(result.plan.target.currentMetadata, null);
  assert.equal(result.plan.target.currentMetadataFingerprint, null);
  assert.equal(result.plan.target.currentMetadataFindings, null);
  assert.deepEqual(result.plan.target.warningDispositions, []);
  assert.equal(result.plan.target.expectedAssetVersion, 3);
  assert.equal(result.plan.target.predictedAssetVersion, 4);
  assert.equal(result.plan.target.expectedMetadataVersion, 4);
  assert.equal(result.plan.target.predictedMetadataVersion, null);
  assert.equal(
    result.plan.target.metadataVersionPolicy,
    'PRESERVE_IF_REVALIDATED_FINGERPRINT_UNCHANGED_ELSE_INCREMENT',
  );
  assert.deepEqual(result.plan.target.conditionalMetadataVersions, {
    ifFingerprintUnchanged: 4,
    ifFingerprintChanged: 5,
  });
  assert.deepEqual(result.plan.target.metadataVisualFacts, {
    pixelSize: result.plan.processingBinding.pixelSize,
    pivot: result.plan.processingBinding.pivot,
  });
  assert.equal(result.plan.planFingerprint, 'b1537be4f73c282d4edb87a0a0192ee6fd38ce75f0c14b1388f2a401d39a205c');
  assert.equal(result.plan.processingBinding.assetId, request.target.assetId);
  assert.equal(result.plan.processingBinding.selectedOutput.sha256, request.assetInputSelection.selectedOutput.sha256);
});

test('processing visual facts reuse CP2C metadata semantics and change the fingerprint for new dimensions and pivot', async () => {
  const fixture = await planningFixture();
  const result = await fixture.service.prepare(fixture.command, fixture.context);
  const authoredMetadata = Object.fromEntries(
    Object.entries(result.plan.target.initialMetadata)
      .filter(([key]) => !['pixelSize', 'pivot'].includes(key)),
  );
  const currentSliceBinding = sliceBindingFixture();
  const currentViaSlice = validateAssetMetadata({
    assetId: fixture.command.payload.preflightRequest.target.assetId,
    kind: fixture.command.payload.preflightRequest.assetInputSelection.assetKind,
    metadata: authoredMetadata,
    sliceBinding: currentSliceBinding,
  });
  const currentViaVisualFacts = validateAssetMetadataForVisualFacts({
    assetId: fixture.command.payload.preflightRequest.target.assetId,
    kind: fixture.command.payload.preflightRequest.assetInputSelection.assetKind,
    metadata: authoredMetadata,
    pixelSize: { width: currentSliceBinding.width, height: currentSliceBinding.height },
    pivot: currentSliceBinding.rectangle.pivot,
  });
  const proposedViaVisualFacts = validateAssetMetadataForVisualFacts({
    assetId: fixture.command.payload.preflightRequest.target.assetId,
    kind: fixture.command.payload.preflightRequest.assetInputSelection.assetKind,
    metadata: authoredMetadata,
    pixelSize: result.plan.processingBinding.pixelSize,
    pivot: result.plan.processingBinding.pivot,
  });

  assert.deepEqual(currentViaVisualFacts, currentViaSlice);
  assert.deepEqual(currentViaVisualFacts.metadata.pixelSize, { width: 32, height: 48 });
  assert.deepEqual(currentViaVisualFacts.metadata.pivot, { x: 3, y: 4 });
  assert.deepEqual(proposedViaVisualFacts.metadata.pixelSize, result.plan.processingBinding.pixelSize);
  assert.equal(proposedViaVisualFacts.metadata.pivot, null);
  assert.notEqual(proposedViaVisualFacts.fingerprint, currentViaVisualFacts.fingerprint);
  assert.deepEqual(
    Object.fromEntries(Object.entries(proposedViaVisualFacts.metadata).filter(([key]) => !['pixelSize', 'pivot'].includes(key))),
    Object.fromEntries(Object.entries(currentViaVisualFacts.metadata).filter(([key]) => !['pixelSize', 'pivot'].includes(key))),
  );
});

test('blocked capability or ERROR result cannot produce a plan while WARNING remains unresolved', async () => {
  const currentRequest = requestFixture({ manifest: NUMBERDROID_PROJECT_CAPABILITY_MANIFEST });
  const currentCommand = commandFixture({ request: currentRequest });
  const currentFixture = await planningFixture({ request: currentRequest, command: currentCommand });
  const unsupported = await currentFixture.service.prepare(currentCommand, currentFixture.context);
  assert.equal(unsupported.status, 'BLOCKED');
  assert.equal(unsupported.plan, null);
  assert.equal(unsupported.freshPreflightReceipt.capabilityCheck.status, 'UNSUPPORTED');
  assert.equal(unsupported.authorization, 'NOT_GRANTED');

  const errorRequest = requestFixture({ findings: [findingFixture('ERROR')] });
  const errorCommand = commandFixture({ request: errorRequest });
  const errorFixture = await planningFixture({ request: errorRequest, command: errorCommand });
  const blocked = await errorFixture.service.prepare(errorCommand, errorFixture.context);
  assert.equal(blocked.status, 'BLOCKED');
  assert.equal(blocked.plan, null);
  assert.ok(blocked.freshPreflightReceipt.blockers.some(({ code }) => code === 'PROCESSING_RESULT_ERROR'));

  const warningRequest = requestFixture({ findings: [findingFixture('WARNING')] });
  const warningCommand = commandFixture({ request: warningRequest });
  const warningFixture = await planningFixture({ request: warningRequest, command: warningCommand });
  const warning = await warningFixture.service.prepare(warningCommand, warningFixture.context);
  assert.equal(warning.status, 'READY');
  assert.equal(warning.plan.warningDisposition, 'UNRESOLVED');
  assert.equal(warning.plan.unresolvedWarnings.length, 1);
  assert.equal(warning.plan.unresolvedWarnings[0].severity, 'WARNING');
  assert.equal(warning.authorization, 'NOT_GRANTED');

  const driftRequest = requestFixture({ operation: 'update' });
  const driftCommand = commandFixture({ request: driftRequest });
  const driftCases = [
    {
      expectedStatus: 'TARGET_VERSION_CONFLICT',
      receipt: await freshReceipt(driftRequest, processingCapabilityFixture(), {
        assetEvidence: assetStateFixture(driftRequest, {
          head: { assetVersion: driftRequest.target.expectedAssetVersion + 1 },
        }),
      }),
      check: 'assetStateCheck',
    },
    {
      expectedStatus: 'TARGET_VERSION_CONFLICT',
      receipt: await freshReceipt(driftRequest, processingCapabilityFixture(), {
        assetEvidence: assetStateFixture(driftRequest, {
          head: { metadataVersion: driftRequest.target.expectedMetadataVersion + 1 },
        }),
      }),
      check: 'assetStateCheck',
    },
    {
      expectedStatus: 'CONTENT_CORRUPT',
      receipt: await freshReceipt(driftRequest, processingCapabilityFixture(), {
        artifactEvidence: (selection) => artifactEvidenceFixture(
          driftRequest,
          selection.role,
          { status: selection.role === 'selected-output' ? 'CONTENT_CORRUPT' : 'VERIFIED' },
        ),
      }),
      check: 'artifactChecks',
    },
  ];
  for (const candidate of driftCases) {
    const driftFixture = await planningFixture({
      request: driftRequest,
      command: driftCommand,
      receipt: candidate.receipt,
    });
    const drift = await driftFixture.service.prepare(driftCommand, driftFixture.context);
    assert.equal(drift.status, 'BLOCKED');
    assert.equal(drift.plan, null);
    if (candidate.check === 'assetStateCheck') {
      assert.equal(drift.freshPreflightReceipt.assetStateCheck.status, candidate.expectedStatus);
    } else {
      assert.ok(drift.freshPreflightReceipt.artifactChecks.some(
        ({ status }) => status === candidate.expectedStatus,
      ));
    }
  }
});

test('command and semantic fingerprints freeze the later idempotency replay and collision policy', async () => {
  const fixture = await planningFixture();
  const command = fixture.command;
  const binding = {
    schemaVersion: 1,
    kind: 'studio.processing-result-adoption-authority-binding',
    projectId: command.projectId,
    revision: command.baseRevision,
    actorId: fixture.context.actor.id,
    taskId: fixture.context.taskId,
    grantId: fixture.context.grantId,
    branchId: fixture.context.branchId,
  };
  const sameKeySameSemantics = commandFixture({
    request: command.payload.preflightRequest,
    commandId: 'command.adopt.2',
    idempotencyKey: command.idempotencyKey,
  });
  const sameKeyDifferentSemantics = structuredClone(sameKeySameSemantics);
  sameKeyDifferentSemantics.payload.assetName = 'Different Draft Name';
  const planResult = await fixture.service.prepare(command, fixture.context);

  assert.equal(
    canonicalProcessingResultAdoptionCommandJson(command),
    canonicalProcessingResultAdoptionCommandJson(reverseObjectFields(command)),
  );
  assert.equal(processingResultAdoptionCommandSha256(command), processingResultAdoptionCommandSha256(reverseObjectFields(command)));
  assert.notEqual(processingResultAdoptionCommandSha256(command), processingResultAdoptionCommandSha256(sameKeySameSemantics));
  assert.equal(
    processingResultAdoptionSemanticSha256(command, binding),
    processingResultAdoptionSemanticSha256(sameKeySameSemantics, binding),
  );
  assert.notEqual(
    processingResultAdoptionSemanticSha256(command, binding),
    processingResultAdoptionSemanticSha256(sameKeyDifferentSemantics, binding),
  );
  assert.equal(planResult.plan.idempotencyPolicy.sameKeySameSemanticFingerprint, 'RETURN_ORIGINAL_RESULT');
  assert.equal(planResult.plan.idempotencyPolicy.sameKeyDifferentSemanticFingerprint, 'FAIL_IDEMPOTENCY_CONFLICT');
  assert.equal(planResult.plan.idempotencyPolicy.sameCommandIdDifferentKey, 'FAIL_COMMAND_ID_CONFLICT');
  assert.equal(planResult.plan.idempotencyPolicy.enforcement, 'REQUIRED_IN_ATOMIC_UNIT_OF_WORK');
  assert.equal(planResult.idempotencyState, 'NOT_CHECKED');
  assert.equal(planResult.replayState, 'NOT_PERFORMED');
  assert.deepEqual(fixture.calls.order, ['authority', 'preflight']);
  assert.ok(canonicalProcessingResultAdoptionCommandJson(command).endsWith('\n'));
});

test('command graph rejects unknown authority, accessors, proxies, symbols, hidden fields, prototypes, cycles, and sparse arrays', () => {
  const unknown = commandFixture();
  unknown.unknown = true;
  expectStudioError(() => validateProcessingResultAdoptionCommand(unknown), 'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID');

  const smuggled = commandFixture();
  smuggled.payload.grantId = 'grant.attacker';
  expectStudioError(() => validateProcessingResultAdoptionCommand(smuggled), 'UNTRUSTED_AUTHORITY_FIELD');

  let getterCalls = 0;
  const accessor = commandFixture();
  Object.defineProperty(accessor.payload, 'assetName', {
    enumerable: true,
    get() {
      getterCalls += 1;
      return 'Trapped';
    },
  });
  expectStudioError(() => validateProcessingResultAdoptionCommand(accessor), 'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID');
  assert.equal(getterCalls, 0);

  let proxyTraps = 0;
  const proxied = new Proxy(commandFixture(), {
    ownKeys() {
      proxyTraps += 1;
      return [];
    },
  });
  expectStudioError(() => validateProcessingResultAdoptionCommand(proxied), 'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID');
  assert.equal(proxyTraps, 0);

  const symbol = commandFixture();
  symbol[Symbol('authority')] = 'forbidden';
  expectStudioError(() => validateProcessingResultAdoptionCommand(symbol), 'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID');

  const hidden = commandFixture();
  Object.defineProperty(hidden, 'hidden', { enumerable: false, value: true });
  expectStudioError(() => validateProcessingResultAdoptionCommand(hidden), 'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID');

  const inherited = Object.create({ grantId: 'grant.inherited' });
  Object.assign(inherited, commandFixture());
  expectStudioError(() => validateProcessingResultAdoptionCommand(inherited), 'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID');

  const cyclic = commandFixture();
  cyclic.payload.cycle = cyclic;
  expectStudioError(() => validateProcessingResultAdoptionCommand(cyclic), 'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID');

  const sparse = commandFixture();
  sparse.payload.preflightRequest.processingResult.operations = new Array(1);
  expectStudioError(() => validateProcessingResultAdoptionCommand(sparse), 'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID');

  const deep = commandFixture();
  let cursor = deep;
  for (let index = 0; index < 50; index += 1) {
    cursor.extra = {};
    cursor = cursor.extra;
  }
  expectStudioError(() => validateProcessingResultAdoptionCommand(deep), 'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID');
});

test('command closes project, revision, target operation, and create/update naming policy', () => {
  const projectDrift = commandFixture();
  projectDrift.projectId = 'project.other';
  expectStudioError(() => validateProcessingResultAdoptionCommand(projectDrift), 'PROCESSING_RESULT_ADOPTION_COMMAND_SCOPE_MISMATCH');

  const revisionDrift = commandFixture();
  revisionDrift.baseRevision = 18;
  expectStudioError(() => validateProcessingResultAdoptionCommand(revisionDrift), 'PROCESSING_RESULT_ADOPTION_COMMAND_SCOPE_MISMATCH');

  const expectedVersionDrift = commandFixture();
  expectedVersionDrift.expectedVersion = 18;
  expectStudioError(() => validateProcessingResultAdoptionCommand(expectedVersionDrift), 'PROCESSING_RESULT_ADOPTION_COMMAND_SCOPE_MISMATCH');

  const unnamedCreate = commandFixture();
  unnamedCreate.payload.assetName = null;
  expectStudioError(() => validateProcessingResultAdoptionCommand(unnamedCreate), 'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID');

  const updateRequest = requestFixture({ operation: 'update' });
  const renamedUpdate = commandFixture({ request: updateRequest });
  renamedUpdate.payload.assetName = 'Unauthorized Rename';
  expectStudioError(() => validateProcessingResultAdoptionCommand(renamedUpdate), 'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID');
});

test('all revisions and versions that can be incremented stop before MAX_SAFE_INTEGER', () => {
  const maximum = Number.MAX_SAFE_INTEGER;
  const maximumIncrementable = maximum - 1;

  const revisionOverflowRequest = requestFixture();
  revisionOverflowRequest.project.expectedRevision = maximum;
  expectStudioError(
    () => validateProcessingResultAdoptionCommand(commandFixture({ request: revisionOverflowRequest })),
    'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID',
  );

  const assetOverflowRequest = requestFixture({
    operation: 'update',
    expectedAssetVersion: maximum,
    expectedMetadataVersion: 4,
  });
  expectStudioError(
    () => validateProcessingResultAdoptionCommand(commandFixture({ request: assetOverflowRequest })),
    'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID',
  );

  const metadataOverflowRequest = requestFixture({
    operation: 'update',
    expectedAssetVersion: 3,
    expectedMetadataVersion: maximum,
  });
  expectStudioError(
    () => validateProcessingResultAdoptionCommand(commandFixture({ request: metadataOverflowRequest })),
    'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID',
  );

  const maximumIncrementableRequest = requestFixture({
    operation: 'update',
    expectedAssetVersion: maximumIncrementable,
    expectedMetadataVersion: maximumIncrementable,
  });
  maximumIncrementableRequest.project.expectedRevision = maximumIncrementable;
  assert.doesNotThrow(() => validateProcessingResultAdoptionCommand(commandFixture({ request: maximumIncrementableRequest })));

  const authorityBinding = {
    schemaVersion: 1,
    kind: 'studio.processing-result-adoption-authority-binding',
    projectId: 'project.family-hygiene',
    revision: maximumIncrementable,
    actorId: 'agent.processing.1',
    taskId: 'task.processing.1',
    grantId: 'grant.processing.1',
    branchId: 'branch.task-processing-1',
  };
  assert.doesNotThrow(() => validateProcessingResultAdoptionAuthorityBinding(authorityBinding));
  expectStudioError(
    () => validateProcessingResultAdoptionAuthorityBinding({ ...authorityBinding, revision: maximum }),
    'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID',
  );
});

test('agent, ACTIVE task, exact grant, non-main branch, scopes, expiry, and budgets are all mandatory before preflight', async () => {
  const cases = [
    { code: 'PROCESSING_RESULT_ADOPTION_COMMAND_SCOPE_MISMATCH', authority: { projectId: 'project.other' } },
    { code: 'TASK_NOT_FOUND', authority: { task: null } },
    { code: 'TASK_PAUSED', authority: { task: { state: 'PAUSED' } } },
    { code: 'TASK_NOT_EXECUTABLE', authority: { task: { state: 'IN_REVIEW' } } },
    { code: 'TASK_EXPIRED', authority: { task: { expiresAt: NOW } } },
    { code: 'TASK_CONTEXT_MISMATCH', authority: { task: { projectId: 'project.other' } } },
    { code: 'TASK_CONTEXT_MISMATCH', authority: { task: { taskId: 'task.other' } } },
    { code: 'TASK_BRANCH_MISMATCH', authority: { task: { branchId: 'branch.other' } } },
    { code: 'TASK_ACTOR_MISMATCH', authority: { task: { agentId: 'agent.other' } } },
    { code: 'TASK_GRANT_MISMATCH', authority: { task: { grantId: 'grant.other' } } },
    { code: 'TASK_CAPABILITY_MISSING', authority: { task: { capabilities: ['asset.read'] } } },
    { code: 'OBJECT_SCOPE_DENIED', authority: { task: { objectScopes: [{ kind: 'asset', id: 'asset.family-hygiene-floor' }] } } },
    { code: 'OBJECT_SCOPE_DENIED', authority: { task: { objectScopes: [{ kind: 'project', id: 'project.family-hygiene' }] } } },
    { code: 'BUDGET_EXCEEDED', authority: { task: { maxCommands: 1, usedCommands: 1 } } },
    { code: 'AUTO_ACCEPT_FORBIDDEN', authority: { task: { autoAcceptCommandTypes: [PROCESSING_RESULT_ADOPTION_COMMAND_TYPE] } } },
    { code: 'GRANT_NOT_FOUND', authority: { grant: null } },
    { code: 'GRANT_REVOKED', authority: { grant: { status: 'REVOKED', revokedAt: NOW } } },
    { code: 'GRANT_REVOKED', authority: { grant: { status: 'ACTIVE', revokedAt: NOW } } },
    { code: 'GRANT_REQUIRED', authority: { grant: { status: 'LEGACY_UNBOUND' } } },
    { code: 'GRANT_EXPIRED', authority: { grant: { expiresAt: NOW } } },
    { code: 'OBJECT_SCOPE_DENIED', authority: { grant: { projectId: 'project.other' } } },
    { code: 'GRANT_ACTOR_MISMATCH', authority: { grant: { agentId: 'agent.other' } } },
    { code: 'GRANT_TASK_MISMATCH', authority: { grant: { taskId: 'task.other' } } },
    { code: 'GRANT_BRANCH_MISMATCH', authority: { grant: { branchId: 'branch.other' } } },
    { code: 'TASK_GRANT_MISMATCH', authority: { grant: { id: 'grant.other' } } },
    { code: 'GRANT_SCOPE_MISSING', authority: { grant: { scopes: ['asset.read'] } } },
    { code: 'OBJECT_SCOPE_DENIED', authority: { grant: { objectScopes: [{ kind: 'asset', id: 'asset.family-hygiene-floor' }] } } },
    { code: 'OBJECT_SCOPE_DENIED', authority: { grant: { objectScopes: [{ kind: 'project', id: 'project.family-hygiene' }] } } },
    { code: 'BUDGET_EXCEEDED', authority: { grant: { maxCommands: 1, usedCommands: 1 } } },
    { code: 'REVISION_CONFLICT', authority: { branchRevision: 18 } },
  ];

  for (const candidate of cases) {
    const request = requestFixture();
    const command = commandFixture({ request });
    const context = contextFixture();
    const authorityEvidence = authorityEvidenceFixture(command, context, candidate.authority);
    const fixture = await planningFixture({ request, command, context, authorityEvidence });
    await expectStudioRejection(fixture.service.prepare(command, context), candidate.code);
    assert.deepEqual(fixture.calls.order, ['authority'], candidate.code);
    assert.equal(fixture.calls.preflight.length, 0, candidate.code);
  }

  const humanFixture = await planningFixture();
  const humanContext = contextFixture({ actor: { id: 'user.owner', kind: 'human', displayName: 'Owner' } });
  await expectStudioRejection(humanFixture.service.prepare(humanFixture.command, humanContext), 'FORBIDDEN');
  assert.deepEqual(humanFixture.calls.order, []);

  const mainFixture = await planningFixture();
  await expectStudioRejection(mainFixture.service.prepare(mainFixture.command, contextFixture({ branchId: 'branch.main' })), 'TASK_BRANCH_REQUIRED');
  assert.deepEqual(mainFixture.calls.order, []);
});

test('trusted context and read-port evidence are exact, sanitized, and branch-bound', async () => {
  const extraActorFixture = await planningFixture();
  const extraActor = contextFixture();
  extraActor.actor.authorization = 'attacker';
  await expectStudioRejection(extraActorFixture.service.prepare(extraActorFixture.command, extraActor), 'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID');
  assert.deepEqual(extraActorFixture.calls.order, []);

  const wrongBranchFixture = await planningFixture();
  wrongBranchFixture.authorityEvidence.branchId = 'branch.other';
  await expectStudioRejection(wrongBranchFixture.service.prepare(wrongBranchFixture.command, wrongBranchFixture.context), 'TASK_BRANCH_MISMATCH');
  assert.deepEqual(wrongBranchFixture.calls.order, ['authority']);

  const staleRequest = requestFixture({ operation: 'update' });
  const staleReceipt = await freshReceipt(staleRequest);
  const staleFixture = await planningFixture({ receipt: staleReceipt });
  await expectStudioRejection(staleFixture.service.prepare(staleFixture.command, staleFixture.context), 'PROCESSING_ADOPTION_PORT_RESPONSE_INVALID');

  const invalidResponseFixture = await planningFixture({
    authorityImplementation() {
      return { ...authorityEvidenceFixture(commandFixture(), contextFixture()), secretPath: '/tmp/secret' };
    },
  });
  await assert.rejects(
    invalidResponseFixture.service.prepare(invalidResponseFixture.command, invalidResponseFixture.context),
    (error) => {
      assert.equal(error.code, 'PROCESSING_ADOPTION_PORT_RESPONSE_INVALID');
      assert.equal(error.message.includes('/tmp/secret'), false);
      assert.equal(JSON.stringify(error.details).includes('/tmp/secret'), false);
      return true;
    },
  );

  const failingPortFixture = await planningFixture({
    authorityImplementation() {
      throw new Error('secret grant grant.processing.1 at /tmp/authority.db');
    },
  });
  await assert.rejects(
    failingPortFixture.service.prepare(failingPortFixture.command, failingPortFixture.context),
    (error) => {
      assert.equal(error.code, 'PROCESSING_ADOPTION_PORT_FAILED');
      assert.equal(error.message.includes('secret'), false);
      assert.deepEqual(error.details, { port: 'taskAuthorityReader' });
      assert.equal('cause' in error, false);
      return true;
    },
  );

  const preflightCoordinateCases = [
    ['projectId', 'project.other'],
    ['branchId', 'branch.other'],
    ['revision', 18],
  ];
  for (const [field, value] of preflightCoordinateCases) {
    let coordinateFixture;
    coordinateFixture = await planningFixture({
      preflightImplementation(selection) {
        return {
          schemaVersion: 1,
          kind: PROCESSING_ADOPTION_TASK_BRANCH_PREFLIGHT_EVIDENCE_KIND,
          projectId: selection.projectId,
          branchId: selection.branchId,
          revision: selection.revision,
          receipt: coordinateFixture.receipt,
          [field]: value,
        };
      },
    });
    await expectStudioRejection(
      coordinateFixture.service.prepare(coordinateFixture.command, coordinateFixture.context),
      'PROCESSING_ADOPTION_PORT_RESPONSE_INVALID',
    );
    assert.deepEqual(coordinateFixture.calls.order, ['authority', 'preflight']);
  }

  const failingPreflightFixture = await planningFixture({
    preflightImplementation() {
      throw new Error('secret token at /tmp/preflight.db');
    },
  });
  await assert.rejects(
    failingPreflightFixture.service.prepare(
      failingPreflightFixture.command,
      failingPreflightFixture.context,
    ),
    (error) => {
      assert.equal(error.code, 'PROCESSING_ADOPTION_PORT_FAILED');
      assert.equal(error.message.includes('secret'), false);
      assert.deepEqual(error.details, { port: 'taskBranchPreflightReader' });
      assert.equal('cause' in error, false);
      return true;
    },
  );

  const failingClockFixture = await planningFixture({
    clock() {
      throw new Error('secret token at /tmp/clock');
    },
  });
  await assert.rejects(
    failingClockFixture.service.prepare(failingClockFixture.command, failingClockFixture.context),
    (error) => {
      assert.equal(error.code, 'PROCESSING_ADOPTION_PORT_FAILED');
      assert.deepEqual(error.details, { port: 'clock' });
      assert.equal(error.message.includes('secret'), false);
      assert.equal('cause' in error, false);
      return true;
    },
  );
  assert.deepEqual(failingClockFixture.calls.order, ['authority']);

  const invalidClockFixture = await planningFixture({ clock: () => '/tmp/secret-clock' });
  await assert.rejects(
    invalidClockFixture.service.prepare(invalidClockFixture.command, invalidClockFixture.context),
    (error) => {
      assert.equal(error.code, 'PROCESSING_ADOPTION_PORT_RESPONSE_INVALID');
      assert.deepEqual(error.details, { port: 'clock' });
      assert.equal(error.message.includes('/tmp/secret-clock'), false);
      return true;
    },
  );
  assert.deepEqual(invalidClockFixture.calls.order, ['authority']);
});

test('ports, constructor options, prepare options, and responses reject proxies and accessors without invoking traps', async () => {
  const fixture = await planningFixture();
  const validAuthorityPort = {
    schemaVersion: 1,
    kind: PROCESSING_ADOPTION_TASK_AUTHORITY_READER_KIND,
    async readTaskAuthority() {
      return fixture.authorityEvidence;
    },
  };
  const validPreflightPort = {
    schemaVersion: 1,
    kind: PROCESSING_ADOPTION_TASK_BRANCH_PREFLIGHT_READER_KIND,
    async preflightTaskBranch(selection) {
      return {
        schemaVersion: 1,
        kind: PROCESSING_ADOPTION_TASK_BRANCH_PREFLIGHT_EVIDENCE_KIND,
        projectId: selection.projectId,
        branchId: selection.branchId,
        revision: selection.revision,
        receipt: fixture.receipt,
      };
    },
  };

  expectStudioError(
    () => new ProcessingResultAdoptionPlanningService({
      taskAuthorityReader: { ...validAuthorityPort, writeTaskAuthority() {} },
      taskBranchPreflightReader: validPreflightPort,
    }),
    'PROCESSING_ADOPTION_PORT_INVALID',
  );

  let optionGetterCalls = 0;
  const options = { taskBranchPreflightReader: validPreflightPort };
  Object.defineProperty(options, 'taskAuthorityReader', {
    enumerable: true,
    get() {
      optionGetterCalls += 1;
      return validAuthorityPort;
    },
  });
  expectStudioError(() => new ProcessingResultAdoptionPlanningService(options), 'PROCESSING_ADOPTION_PORT_INVALID');
  assert.equal(optionGetterCalls, 0);

  let proxyTraps = 0;
  const proxiedOptions = new Proxy({
    taskAuthorityReader: validAuthorityPort,
    taskBranchPreflightReader: validPreflightPort,
  }, {
    ownKeys() {
      proxyTraps += 1;
      return [];
    },
  });
  expectStudioError(() => new ProcessingResultAdoptionPlanningService(proxiedOptions), 'PROCESSING_ADOPTION_PORT_INVALID');
  assert.equal(proxyTraps, 0);

  let prepareGetterCalls = 0;
  const prepareOptions = {};
  Object.defineProperty(prepareOptions, 'signal', {
    enumerable: true,
    get() {
      prepareGetterCalls += 1;
      return null;
    },
  });
  await expectStudioRejection(fixture.service.prepare(fixture.command, fixture.context, prepareOptions), 'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID');
  assert.equal(prepareGetterCalls, 0);

  let responseGetterCalls = 0;
  const response = authorityEvidenceFixture(fixture.command, fixture.context);
  Object.defineProperty(response, 'projectId', {
    enumerable: true,
    get() {
      responseGetterCalls += 1;
      return fixture.command.projectId;
    },
  });
  const responseFixture = await planningFixture({ authorityEvidence: response });
  await expectStudioRejection(responseFixture.service.prepare(responseFixture.command, responseFixture.context), 'PROCESSING_ADOPTION_PORT_RESPONSE_INVALID');
  assert.equal(responseGetterCalls, 0);

  const malformedPreflightFixture = await planningFixture({
    preflightImplementation() {
      return { unsafe: '/tmp/secret-preflight-response' };
    },
  });
  await assert.rejects(
    malformedPreflightFixture.service.prepare(
      malformedPreflightFixture.command,
      malformedPreflightFixture.context,
    ),
    (error) => {
      assert.equal(error.code, 'PROCESSING_ADOPTION_PORT_RESPONSE_INVALID');
      assert.deepEqual(error.details, { port: 'taskBranchPreflightReader' });
      assert.equal(error.message.includes('/tmp/secret-preflight-response'), false);
      return true;
    },
  );

  let preflightGetterCalls = 0;
  let accessorPreflightFixture;
  accessorPreflightFixture = await planningFixture({
    preflightImplementation(selection) {
      const candidate = {
        schemaVersion: 1,
        kind: PROCESSING_ADOPTION_TASK_BRANCH_PREFLIGHT_EVIDENCE_KIND,
        projectId: selection.projectId,
        branchId: selection.branchId,
        revision: selection.revision,
        receipt: accessorPreflightFixture.receipt,
      };
      Object.defineProperty(candidate, 'projectId', {
        enumerable: true,
        get() {
          preflightGetterCalls += 1;
          return selection.projectId;
        },
      });
      return candidate;
    },
  });
  await expectStudioRejection(
    accessorPreflightFixture.service.prepare(
      accessorPreflightFixture.command,
      accessorPreflightFixture.context,
    ),
    'PROCESSING_ADOPTION_PORT_RESPONSE_INVALID',
  );
  assert.equal(preflightGetterCalls, 0);

  let preflightProxyTraps = 0;
  const proxiedPreflightFixture = await planningFixture({
    preflightImplementation() {
      return new Proxy({}, {
        ownKeys() {
          preflightProxyTraps += 1;
          return [];
        },
      });
    },
  });
  await expectStudioRejection(
    proxiedPreflightFixture.service.prepare(
      proxiedPreflightFixture.command,
      proxiedPreflightFixture.context,
    ),
    'PROCESSING_ADOPTION_PORT_RESPONSE_INVALID',
  );
  assert.equal(preflightProxyTraps, 0);
});

test('abort is honored before authority, after authority, and after preflight without a plan', async () => {
  const beforeFixture = await planningFixture();
  const before = new AbortController();
  before.abort(new Error('stop-before'));
  await assert.rejects(beforeFixture.service.prepare(beforeFixture.command, beforeFixture.context, { signal: before.signal }), /stop-before/);
  assert.deepEqual(beforeFixture.calls.order, []);

  const afterAuthority = new AbortController();
  const authorityFixture = await planningFixture({
    authorityImplementation() {
      afterAuthority.abort(new Error('stop-after-authority'));
      return authorityFixture.authorityEvidence;
    },
  });
  await assert.rejects(authorityFixture.service.prepare(authorityFixture.command, authorityFixture.context, { signal: afterAuthority.signal }), /stop-after-authority/);
  assert.deepEqual(authorityFixture.calls.order, ['authority']);

  const afterPreflight = new AbortController();
  let preflightEvidence;
  const preflightFixture = await planningFixture({
    preflightImplementation(selection) {
      afterPreflight.abort(new Error('stop-after-preflight'));
      return {
        ...preflightEvidence,
        projectId: selection.projectId,
        branchId: selection.branchId,
        revision: selection.revision,
      };
    },
  });
  preflightEvidence = {
    schemaVersion: 1,
    kind: PROCESSING_ADOPTION_TASK_BRANCH_PREFLIGHT_EVIDENCE_KIND,
    receipt: preflightFixture.receipt,
  };
  await assert.rejects(preflightFixture.service.prepare(preflightFixture.command, preflightFixture.context, { signal: afterPreflight.signal }), /stop-after-preflight/);
  assert.deepEqual(preflightFixture.calls.order, ['authority', 'preflight']);

  const faultPriority = new AbortController();
  const faultReason = new Error('stop-before-port-fault');
  const faultPriorityFixture = await planningFixture({
    preflightImplementation() {
      faultPriority.abort(faultReason);
      throw new Error('secret failure at /tmp/preflight');
    },
  });
  await assert.rejects(
    faultPriorityFixture.service.prepare(
      faultPriorityFixture.command,
      faultPriorityFixture.context,
      { signal: faultPriority.signal },
    ),
    (error) => error === faultReason,
  );
  assert.deepEqual(faultPriorityFixture.calls.order, ['authority', 'preflight']);
});

test('results defensively detach from caller and port objects and require fresh reads on every prepare', async () => {
  const request = requestFixture();
  const fixture = await planningFixture({
    request,
    command: commandFixture({ request }),
    receipt: structuredClone(await freshReceipt(request)),
  });
  const result = await fixture.service.prepare(fixture.command, fixture.context);
  const stable = JSON.stringify(result);
  fixture.command.payload.assetName = 'Caller Mutation';
  fixture.authorityEvidence.task.agentId = 'agent.mutated';
  fixture.receipt.blockers.push({ code: 'MUTATED', message: 'late' });
  assert.equal(JSON.stringify(result), stable);

  const freshCommand = commandFixture();
  const freshContext = contextFixture();
  const freshAuthority = authorityEvidenceFixture(freshCommand, freshContext);
  const fresh = await planningFixture({ command: freshCommand, context: freshContext, authorityEvidence: freshAuthority });
  await fresh.service.prepare(fresh.command, fresh.context);
  await fresh.service.prepare(fresh.command, fresh.context);
  assert.deepEqual(fresh.calls.order, ['authority', 'preflight', 'authority', 'preflight']);
});
