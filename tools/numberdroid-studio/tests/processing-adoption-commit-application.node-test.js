import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PROCESSING_RESULT_ADOPTION_ATOMIC_STORE_KIND,
  ProcessingResultAdoptionCommitService,
  validateProcessingResultAdoptionAtomicStore,
  validateProcessingResultAdoptionTrustedContext,
} from '../packages/application/src/index.js';
import {
  PROCESSING_ADOPTION_PREFLIGHT_OPERATION_ID,
  PROCESSING_ADOPTION_PREFLIGHT_REQUEST_KIND,
  PROCESSING_RESULT_ADOPTION_AUTHORITY_BINDING_KIND,
  PROCESSING_RESULT_ADOPTION_COMMAND_KIND,
  PROCESSING_RESULT_ADOPTION_COMMAND_TYPE,
  PROCESSING_RESULT_ADOPTION_SCHEMA_VERSION,
  StudioError,
  canonicalRgbaPngByteSize,
  createExactPngCropProcessingRecipe,
  createPrimaryVisualAssetInputSelection,
  processingRecipeSha256,
  processingResultAdoptionSemanticSha256,
  projectCapabilityManifestSha256,
  validateProjectCapabilityManifest,
} from '../packages/domain/src/index.js';
import {
  PROCESSING_RESULT_ADOPTION_COMMIT_RESULT_KIND,
  canonicalProcessingResultAdoptionCommitResultJson,
} from '../packages/domain/src/processing-result-adoption-commit.js';
import { NUMBERDROID_PROJECT_CAPABILITY_MANIFEST } from '../packages/numberdroid-adapter/src/index.js';
import { proposeRegularGrid } from '../packages/preview/src/index.js';

const SOURCE_SHA256 = '67b87430b0c78b6bb9b3af5b3a8bc75c9156a38d75b433a1cbbef8fd7979c71e';
const OUTPUT_SHA256S = Object.freeze([
  'ef83efbee4b00ec49679f0409ba6f33423729b9d67946ba45f3ab119a91886f2',
  '3781086c30598cf8c07582f9b830e3343e0e1363f2e7c17d35a6678eeeb41c7e',
  '9d4c867156c590d372c9c7ef955596c919d717821b65ea992db0e7606cde2526',
  'a63dceb520a894a3e91e547d93e15d154873f04bb32e0ac8f8354ca7d2150318',
]);
const METADATA_SHA256 = '18e144f13ea11f46d728d2df21bfeaa6072c625c4ce86f82f81a2cff60f39a6e';
const FINDINGS_SHA256 = 'f5b9b042c26559ea618781d967b4a70fead33ba10d13c9b88dbf44b9886377ed';
const BINDING_SHA256 = '599501acee6acdb99f8ff338b68fe9655548ac23d401405c851d2cc5a44c8eb5';

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

function processingResultFixture(recipe) {
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
        artifactUri: `studio://artifacts/sha256/${OUTPUT_SHA256S[index]}`,
        sha256: OUTPUT_SHA256S[index],
        mediaType: 'image/png',
        byteSize: canonicalRgbaPngByteSize(rectangle.width, rectangle.height),
        width: rectangle.width,
        height: rectangle.height,
      })),
    }],
    findings: [],
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

function commandFixture() {
  const recipe = recipeFixture();
  const processingResult = processingResultFixture(recipe);
  const manifest = capabilityFixture();
  const request = {
    schemaVersion: 1,
    kind: PROCESSING_ADOPTION_PREFLIGHT_REQUEST_KIND,
    project: { projectId: 'project.family-hygiene', expectedRevision: 17 },
    processingRecipe: recipe,
    processingResult,
    assetInputSelection: createPrimaryVisualAssetInputSelection({
      processingResult,
      outputId: 'rect.family-hygiene.0.0',
      assetKind: 'surface',
    }),
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
      operation: 'create',
      assetId: 'asset.family-hygiene-floor',
      expectedAssetVersion: 0,
      expectedMetadataVersion: 0,
    },
  };
  return {
    schemaVersion: 1,
    kind: PROCESSING_RESULT_ADOPTION_COMMAND_KIND,
    commandId: 'command.adopt.1',
    idempotencyKey: 'idempotency.adopt.1',
    type: PROCESSING_RESULT_ADOPTION_COMMAND_TYPE,
    projectId: request.project.projectId,
    baseRevision: request.project.expectedRevision,
    expectedVersion: request.project.expectedRevision,
    payload: { preflightRequest: request, assetName: 'Family Hygiene Floor' },
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

function commitResultFixture(command, context, overrides = {}) {
  const request = command.payload.preflightRequest;
  const authorityBinding = {
    schemaVersion: PROCESSING_RESULT_ADOPTION_SCHEMA_VERSION,
    kind: PROCESSING_RESULT_ADOPTION_AUTHORITY_BINDING_KIND,
    projectId: command.projectId,
    revision: command.baseRevision,
    actorId: context.actor.id,
    taskId: context.taskId,
    grantId: context.grantId,
    branchId: context.branchId,
  };
  const result = {
    schemaVersion: 1,
    kind: PROCESSING_RESULT_ADOPTION_COMMIT_RESULT_KIND,
    status: 'COMMITTED',
    projectId: command.projectId,
    taskId: context.taskId,
    branchId: context.branchId,
    branchRevision: command.baseRevision + 1,
    committedAt: '2026-08-28T12:00:00.000Z',
    commandId: command.commandId,
    idempotencyKey: command.idempotencyKey,
    semanticFingerprint: processingResultAdoptionSemanticSha256(command, authorityBinding),
    operation: request.target.operation,
    asset: {
      assetId: request.target.assetId,
      assetVersion: request.target.expectedAssetVersion + 1,
      metadataVersion: 1,
      lifecycle: 'DRAFT',
      metadataFingerprint: METADATA_SHA256,
      findingsFingerprint: FINDINGS_SHA256,
      processingBindingFingerprint: BINDING_SHA256,
    },
    permanentReferences: [
      { role: 'recipe-input', digest: SOURCE_SHA256 },
      { role: 'selected-output', digest: OUTPUT_SHA256S[0] },
    ],
    commandBudgetCharge: 1,
  };
  return {
    ...result,
    ...overrides,
    asset: { ...result.asset, ...overrides.asset },
  };
}

function atomicStore(implementation) {
  return {
    schemaVersion: 1,
    kind: PROCESSING_RESULT_ADOPTION_ATOMIC_STORE_KIND,
    commitProcessingResultAdoption: implementation,
  };
}

async function expectStudioError(operation, code) {
  let observed;
  await assert.rejects(operation, (error) => {
    observed = error;
    return error instanceof StudioError && error.code === code;
  });
  return observed;
}

test('commit service forwards only closed command/context/signal and returns byte-identical replay results', async () => {
  const command = commandFixture();
  const context = contextFixture();
  const expected = commitResultFixture(command, context);
  const calls = [];
  const service = new ProcessingResultAdoptionCommitService({
    atomicStore: atomicStore((receivedCommand, receivedContext, options) => {
      calls.push({ receivedCommand, receivedContext, options });
      return structuredClone(expected);
    }),
  });

  const first = await service.commit(structuredClone(command), structuredClone(context));
  const second = await service.commit(structuredClone(command), structuredClone(context));

  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(Object.isFrozen(call.receivedCommand), true);
    assert.equal(Object.isFrozen(call.receivedContext), true);
    assert.equal(Object.isFrozen(call.options), true);
    assert.deepEqual(Object.keys(call.options), ['signal']);
    assert.equal(call.options.signal, undefined);
  }
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.hasOwn(first, 'replayed'), false);
  assert.equal(Object.hasOwn(second, 'replayed'), false);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(
    canonicalProcessingResultAdoptionCommitResultJson(first),
    canonicalProcessingResultAdoptionCommitResultJson(expected),
  );
});

test('commit service awaits native Promises carrying opaque runtime instrumentation symbols', async () => {
  const command = commandFixture();
  const context = contextFixture();
  const expected = commitResultFixture(command, context);
  const pending = Promise.resolve(structuredClone(expected));
  Object.defineProperty(pending, Symbol('async_id_symbol'), {
    configurable: true,
    value: 17,
  });
  const service = new ProcessingResultAdoptionCommitService({
    atomicStore: atomicStore(() => pending),
  });

  const result = await service.commit(command, context);

  assert.equal(
    canonicalProcessingResultAdoptionCommitResultJson(result),
    canonicalProcessingResultAdoptionCommitResultJson(expected),
  );
});

test('commit service accepts the original same-key result for a semantically identical retry command ID', async () => {
  const originalCommand = commandFixture();
  const retryCommand = structuredClone(originalCommand);
  retryCommand.commandId = 'command.adopt.retry';
  const context = contextFixture();
  const originalResult = commitResultFixture(originalCommand, context);
  const service = new ProcessingResultAdoptionCommitService({
    atomicStore: atomicStore(() => structuredClone(originalResult)),
  });

  const replay = await service.commit(retryCommand, context);

  assert.equal(replay.commandId, originalCommand.commandId);
  assert.equal(replay.idempotencyKey, retryCommand.idempotencyKey);
  assert.equal(
    canonicalProcessingResultAdoptionCommitResultJson(replay),
    canonicalProcessingResultAdoptionCommitResultJson(originalResult),
  );
});

test('commit seam rejects authority smuggling and extra plan/receipt/evidence before the atomic port', async () => {
  const command = commandFixture();
  const context = contextFixture();
  let calls = 0;
  const service = new ProcessingResultAdoptionCommitService({
    atomicStore: atomicStore(() => {
      calls += 1;
      return commitResultFixture(command, context);
    }),
  });

  for (const field of ['plan', 'receipt', 'evidence']) {
    await expectStudioError(
      () => service.commit(command, context, { [field]: Object.freeze({ forged: true }) }),
      'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID',
    );
    await expectStudioError(
      () => service.commit(command, { ...context, [field]: Object.freeze({ forged: true }) }),
      'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID',
    );
  }
  await expectStudioError(
    () => service.commit({ ...command, authority: { owner: true } }, context),
    'UNTRUSTED_AUTHORITY_FIELD',
  );
  assert.equal(calls, 0);
});

test('atomic port, trusted context, and signal validation reject adversarial graphs without traps', async () => {
  let traps = 0;
  const proxy = new Proxy({}, {
    get() { traps += 1; throw new Error('secret getter'); },
    getPrototypeOf() { traps += 1; throw new Error('secret prototype'); },
    ownKeys() { traps += 1; throw new Error('secret keys'); },
  });
  assert.throws(
    () => validateProcessingResultAdoptionAtomicStore(proxy),
    (error) => error.code === 'PROCESSING_RESULT_ADOPTION_COMMIT_PORT_INVALID',
  );
  assert.throws(
    () => validateProcessingResultAdoptionTrustedContext(proxy),
    (error) => error.code === 'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID',
  );
  assert.equal(traps, 0);

  let getterCalls = 0;
  const accessorPort = {
    schemaVersion: 1,
    kind: PROCESSING_RESULT_ADOPTION_ATOMIC_STORE_KIND,
    get commitProcessingResultAdoption() {
      getterCalls += 1;
      throw new Error('/private/atomic-store');
    },
  };
  assert.throws(
    () => validateProcessingResultAdoptionAtomicStore(accessorPort),
    (error) => error.code === 'PROCESSING_RESULT_ADOPTION_COMMIT_PORT_INVALID',
  );
  assert.equal(getterCalls, 0);

  let applyTraps = 0;
  const proxiedMethod = new Proxy(() => undefined, {
    apply() {
      applyTraps += 1;
      throw new Error('/private/proxied-method');
    },
  });
  assert.throws(
    () => validateProcessingResultAdoptionAtomicStore({
      schemaVersion: 1,
      kind: PROCESSING_RESULT_ADOPTION_ATOMIC_STORE_KIND,
      commitProcessingResultAdoption: proxiedMethod,
    }),
    (error) => error.code === 'PROCESSING_RESULT_ADOPTION_COMMIT_PORT_INVALID',
  );
  assert.equal(applyTraps, 0);

  const command = commandFixture();
  const context = contextFixture();
  const service = new ProcessingResultAdoptionCommitService({
    atomicStore: atomicStore(() => commitResultFixture(command, context)),
  });
  await expectStudioError(
    () => service.commit(command, context, { signal: proxy }),
    'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID',
  );
  assert.equal(traps, 0);
});

test('commit dependency failures and invalid responses are sanitized while stable UoW codes survive', async () => {
  const command = commandFixture();
  const context = contextFixture();
  const secret = '/workspace/private/project.sqlite token=grant-secret';
  const stableService = new ProcessingResultAdoptionCommitService({
    atomicStore: atomicStore(() => {
      throw new StudioError('REVISION_CONFLICT', secret, { cause: secret, path: secret });
    }),
  });
  const stable = await expectStudioError(
    () => stableService.commit(command, context),
    'REVISION_CONFLICT',
  );
  assert.equal(stable.message, 'The atomic processing-result adoption command was rejected.');
  assert.deepEqual(stable.details, {});
  assert.equal(Object.hasOwn(stable, 'cause'), false);
  assert.equal(JSON.stringify(stable).includes(secret), false);

  for (const code of [
    'TASK_EXPIRED',
    'GRANT_REVOKED',
    'BUDGET_EXCEEDED',
    'PROCESSING_ADOPTION_CAPABILITY_PIN_MISMATCH',
    'PROCESSING_ADOPTION_TARGET_VERSION_CONFLICT',
    'PROCESSING_RESULT_ADOPTION_REVALIDATION_BLOCKED',
    'ARTIFACT_CORRUPT',
  ]) {
    const rejectionService = new ProcessingResultAdoptionCommitService({
      atomicStore: atomicStore(() => {
        throw new StudioError(code, secret, { cause: secret, path: secret });
      }),
    });
    const rejection = await expectStudioError(
      () => rejectionService.commit(command, context),
      code,
    );
    assert.equal(rejection.message, 'The atomic processing-result adoption command was rejected.');
    assert.deepEqual(rejection.details, {});
  }

  const failedService = new ProcessingResultAdoptionCommitService({
    atomicStore: atomicStore(() => {
      throw Object.assign(new Error(secret), { cause: secret, path: secret });
    }),
  });
  const failed = await expectStudioError(
    () => failedService.commit(command, context),
    'PROCESSING_RESULT_ADOPTION_COMMIT_PORT_FAILED',
  );
  assert.equal(failed.message.includes(secret), false);
  assert.equal(JSON.stringify(failed.details).includes(secret), false);
  assert.equal(Object.hasOwn(failed, 'cause'), false);

  const corruptService = new ProcessingResultAdoptionCommitService({
    atomicStore: atomicStore(() => {
      throw new StudioError('CORRUPT_PROCESSING_RESULT_ADOPTION', secret, { path: secret });
    }),
  });
  await expectStudioError(
    () => corruptService.commit(command, context),
    'PROCESSING_RESULT_ADOPTION_COMMIT_PORT_FAILED',
  );

  const mismatchedService = new ProcessingResultAdoptionCommitService({
    atomicStore: atomicStore(() => commitResultFixture(command, context, {
      projectId: 'project.cross-scope',
    })),
  });
  const mismatched = await expectStudioError(
    () => mismatchedService.commit(command, context),
    'PROCESSING_RESULT_ADOPTION_COMMIT_PORT_RESPONSE_INVALID',
  );
  assert.equal(mismatched.message.includes('cross-scope'), false);

  let responseTraps = 0;
  const proxyResponseService = new ProcessingResultAdoptionCommitService({
    atomicStore: atomicStore(() => new Proxy({}, {
      get() { responseTraps += 1; throw new Error(secret); },
      getPrototypeOf() { responseTraps += 1; throw new Error(secret); },
      ownKeys() { responseTraps += 1; throw new Error(secret); },
    })),
  });
  await expectStudioError(
    () => proxyResponseService.commit(command, context),
    'PROCESSING_RESULT_ADOPTION_COMMIT_PORT_RESPONSE_INVALID',
  );
  assert.equal(responseTraps, 0);

  let promiseThenGetterCalls = 0;
  const accessorPromise = Promise.resolve(commitResultFixture(command, context));
  Object.defineProperty(accessorPromise, 'then', {
    configurable: true,
    get() {
      promiseThenGetterCalls += 1;
      throw new Error(secret);
    },
  });
  const accessorPromiseService = new ProcessingResultAdoptionCommitService({
    atomicStore: atomicStore(() => accessorPromise),
  });
  await expectStudioError(
    () => accessorPromiseService.commit(command, context),
    'PROCESSING_RESULT_ADOPTION_COMMIT_PORT_RESPONSE_INVALID',
  );
  assert.equal(promiseThenGetterCalls, 0);
});

test('commit failure sanitization never inspects thrown proxies or StudioError code accessors', async () => {
  const command = commandFixture();
  const context = contextFixture();
  const secret = '/workspace/private/raw-error.sqlite token=raw-secret';
  let proxyTraps = 0;
  const thrownProxy = new Proxy({}, {
    get() { proxyTraps += 1; throw new Error(secret); },
    getPrototypeOf() { proxyTraps += 1; throw new Error(secret); },
    getOwnPropertyDescriptor() { proxyTraps += 1; throw new Error(secret); },
    ownKeys() { proxyTraps += 1; throw new Error(secret); },
  });
  let codeGetterCalls = 0;
  const accessorError = new StudioError('REVISION_CONFLICT', secret, { path: secret });
  Object.defineProperty(accessorError, 'code', {
    configurable: true,
    get() {
      codeGetterCalls += 1;
      throw new Error(secret);
    },
  });

  for (const failure of [
    () => { throw thrownProxy; },
    () => Promise.reject(thrownProxy),
    () => { throw accessorError; },
    () => Promise.reject(accessorError),
  ]) {
    const service = new ProcessingResultAdoptionCommitService({
      atomicStore: atomicStore(failure),
    });
    const observed = await expectStudioError(
      () => service.commit(command, context),
      'PROCESSING_RESULT_ADOPTION_COMMIT_PORT_FAILED',
    );
    assert.equal(observed.message.includes(secret), false);
    assert.equal(JSON.stringify(observed.details).includes(secret), false);
  }
  assert.equal(proxyTraps, 0);
  assert.equal(codeGetterCalls, 0);
});

test('cancellation wins before dispatch and over a simultaneous dependency failure', async () => {
  const command = commandFixture();
  const context = contextFixture();
  let calls = 0;
  const beforeController = new AbortController();
  const beforeReason = new DOMException('cancelled before dispatch', 'AbortError');
  beforeController.abort(beforeReason);
  const beforeService = new ProcessingResultAdoptionCommitService({
    atomicStore: atomicStore(() => {
      calls += 1;
      return commitResultFixture(command, context);
    }),
  });
  await assert.rejects(
    () => beforeService.commit(command, context, { signal: beforeController.signal }),
    (error) => error === beforeReason,
  );
  assert.equal(calls, 0);

  const duringController = new AbortController();
  const duringReason = new DOMException('cancelled during dispatch', 'AbortError');
  const duringService = new ProcessingResultAdoptionCommitService({
    atomicStore: atomicStore(() => {
      calls += 1;
      duringController.abort(duringReason);
      throw new Error('/private/dependency/failure');
    }),
  });
  await assert.rejects(
    () => duringService.commit(command, context, { signal: duringController.signal }),
    (error) => error === duringReason,
  );
  assert.equal(calls, 1);
});
