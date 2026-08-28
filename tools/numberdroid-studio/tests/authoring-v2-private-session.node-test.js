import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  AUTHORING_V2_ADMISSION_EVIDENCE_KIND,
  AUTHORING_V2_ADMISSION_READER_KIND,
  AUTHORING_V2_ADMISSION_READER_SCHEMA_VERSION,
  AUTHORING_V2_CAPABILITIES_KIND,
  AUTHORING_V2_CAPABILITY_READER_KIND,
  AUTHORING_V2_CAPABILITY_READER_SCHEMA_VERSION,
  AUTHORING_V2_SURFACE_NEGOTIATION_KIND,
  AUTHORING_V2_SURFACE_NEGOTIATION_REQUEST_KIND,
  AgentTaskService,
  AuthoringV2AdmissionService,
  AuthoringV2ExecutionSession,
  FixedProjectCapabilityProvider,
  PROCESSING_ADOPTION_TASK_AUTHORITY_READER_KIND,
  PROCESSING_ADOPTION_TASK_AUTHORITY_READER_SCHEMA_VERSION,
  PROCESSING_ADOPTION_TASK_BRANCH_PREFLIGHT_READER_KIND,
  PROCESSING_ADOPTION_TASK_BRANCH_PREFLIGHT_READER_SCHEMA_VERSION,
  PROCESSING_RESULT_ADOPTION_ATOMIC_STORE_KIND,
  PROCESSING_RESULT_ADOPTION_ATOMIC_STORE_SCHEMA_VERSION,
  PROCESSING_RESULT_ADOPTION_HOST_BOUND_ATOMIC_STORE_KIND,
  ProcessingResultAdoptionPlanningService,
  StudioService,
  validateAuthoringV2AdmissionReader,
  validateAuthoringV2Capabilities,
  validateAuthoringV2SurfaceNegotiation,
  validateAuthoringV2SurfaceNegotiationRequest,
  validateProcessingResultAdoptionAtomicStore,
  validateProcessingResultAdoptionHostBoundAtomicStore,
} from '../packages/application/src/index.js';
import {
  AUTHORING_V2_COMMAND_FEATURES,
  AUTHORING_V2_FEATURE_ID,
  AUTHORING_V2_PROCESSING_RESULT_ADOPTION_TOOL,
  AUTHORING_V2_SCHEMA_VERSION,
  PROCESSING_ADOPTION_PREFLIGHT_OPERATION_ID,
  PROCESSING_ADOPTION_PREFLIGHT_REQUEST_KIND,
  PROCESSING_RESULT_ADOPTION_COMMAND_KIND,
  PROCESSING_RESULT_ADOPTION_COMMAND_TYPE,
  PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE,
  createExactPngCropProcessingRecipe,
  createPrimaryVisualAssetInputSelection,
  listAuthoringV2GrantScopes,
  processingRecipeSha256,
  projectCapabilityManifestSha256,
} from '../packages/domain/src/index.js';
import {
  NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT,
  NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST,
  NUMBERDROID_PROJECT_CAPABILITY_FINGERPRINT,
  NUMBERDROID_PROJECT_CAPABILITY_MANIFEST,
} from '../packages/numberdroid-adapter/src/index.js';
import { createAgentToolCatalog } from '../packages/mcp-server/src/index.js';
import {
  ContentAddressedArtifactStore,
  SqliteAgentTaskStore,
  SqliteArtifactMetadataStore,
  SqliteAuthoringV2AdmissionReader,
  SqliteHostBindingStore,
  SqliteProcessingResultAdoptionStore,
  SqliteProjectStore,
  TaskBranchProjectStore,
} from '../packages/persistence/src/index.js';
import { encodeCanonicalRgbaPng } from '../packages/preview/src/index.js';
import { startStudioHttpServer } from '../apps/studio-server/src/server.js';
import {
  AGENT,
  OWNER,
  OWNER_CONTEXT,
  PROJECT_ID,
  createProject,
} from './test-helpers.js';
import {
  afterTestCleanup,
  nodeSqliteDatabaseFactory,
} from './persistence-test-helpers.js';

const NOW = '2026-08-28T14:00:00.000Z';
const EXPIRES_AT = '2026-08-29T14:00:00.000Z';
const TASK_ID = 'task.authoring-v2.private';
const BRANCH_ID = 'branch.authoring-v2.private';
const ASSET_ID = 'asset.authoring-v2.private';

function fakeBinding() {
  return {
    schemaVersion: 1,
    bindingId: 'binding.authoring-v2.fake',
    projectId: PROJECT_ID,
    grantId: 'grant.authoring-v2.fake',
    actor: structuredClone(AGENT),
    taskId: TASK_ID,
    branchId: BRANCH_ID,
    issuedBy: OWNER.id,
    issuedAt: NOW,
    expiresAt: EXPIRES_AT,
    revokedAt: null,
    revokeReason: null,
    status: 'ACTIVE',
  };
}

function fakeSelection() {
  return {
    schemaVersion: AUTHORING_V2_SCHEMA_VERSION,
    featureId: AUTHORING_V2_FEATURE_ID,
    projectId: PROJECT_ID,
    actorId: AGENT.id,
    taskId: TASK_ID,
    grantId: 'grant.authoring-v2.fake',
    branchId: BRANCH_ID,
    expectedRevision: null,
    targetAssetId: null,
  };
}

function fakeAdmissionEvidence({
  taskMaxCommands = 1,
  taskUsedCommands = 0,
  grantMaxCommands = 1,
  grantUsedCommands = 0,
} = {}) {
  return {
    schemaVersion: AUTHORING_V2_ADMISSION_READER_SCHEMA_VERSION,
    kind: AUTHORING_V2_ADMISSION_EVIDENCE_KIND,
    featureId: AUTHORING_V2_FEATURE_ID,
    projectId: PROJECT_ID,
    actorId: AGENT.id,
    taskId: TASK_ID,
    grantId: 'grant.authoring-v2.fake',
    branchId: BRANCH_ID,
    branchRevision: 2,
    targetAssetId: null,
    taskMaxCommands,
    taskUsedCommands,
    grantMaxCommands,
    grantUsedCommands,
  };
}

function fakePlanningService() {
  return new ProcessingResultAdoptionPlanningService({
    taskAuthorityReader: {
      schemaVersion: PROCESSING_ADOPTION_TASK_AUTHORITY_READER_SCHEMA_VERSION,
      kind: PROCESSING_ADOPTION_TASK_AUTHORITY_READER_KIND,
      readTaskAuthority() { throw new Error('unused'); },
    },
    taskBranchPreflightReader: {
      schemaVersion: PROCESSING_ADOPTION_TASK_BRANCH_PREFLIGHT_READER_SCHEMA_VERSION,
      kind: PROCESSING_ADOPTION_TASK_BRANCH_PREFLIGHT_READER_KIND,
      preflightTaskBranch() { throw new Error('unused'); },
    },
    clock: () => NOW,
  });
}

function fakeAdmissionService({
  admissionImplementation,
  capabilityImplementation,
  expectedCapabilityManifest = NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST,
} = {}) {
  return new AuthoringV2AdmissionService({
    admissionReader: {
      schemaVersion: AUTHORING_V2_ADMISSION_READER_SCHEMA_VERSION,
      kind: AUTHORING_V2_ADMISSION_READER_KIND,
      readAuthoringV2Admission: admissionImplementation ?? (() => Promise.resolve(fakeAdmissionEvidence())),
    },
    capabilityReader: {
      schemaVersion: AUTHORING_V2_CAPABILITY_READER_SCHEMA_VERSION,
      kind: AUTHORING_V2_CAPABILITY_READER_KIND,
      readProjectCapabilityManifest: capabilityImplementation
        ?? (() => Promise.resolve(NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST)),
    },
    expectedCapabilityManifest,
  });
}

function fakeHostBoundPort(
  kind = PROCESSING_RESULT_ADOPTION_HOST_BOUND_ATOMIC_STORE_KIND,
  implementation = () => { throw new Error('unused'); },
) {
  return {
    schemaVersion: PROCESSING_RESULT_ADOPTION_ATOMIC_STORE_SCHEMA_VERSION,
    kind,
    commitProcessingResultAdoption: implementation,
  };
}

function fakeSession({
  admissionService = fakeAdmissionService(),
  hostBoundAtomicStore = fakeHostBoundPort(),
  correlationId,
} = {}) {
  return new AuthoringV2ExecutionSession({
    admissionService,
    planningService: fakePlanningService(),
    hostBoundAtomicStore,
    trustedBinding: fakeBinding(),
    ...(correlationId === undefined ? {} : { correlationId }),
  });
}

function surfaceNegotiationRequest(expectedProfileFingerprint = NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT) {
  return {
    schemaVersion: AUTHORING_V2_SCHEMA_VERSION,
    kind: AUTHORING_V2_SURFACE_NEGOTIATION_REQUEST_KIND,
    featureId: AUTHORING_V2_FEATURE_ID,
    projectId: PROJECT_ID,
    expectedProfileFingerprint,
  };
}

test('private admission/session construction is exact and host-bound ports cannot be confused with generic A1.5 ports', () => {
  let trapCalls = 0;
  const proxy = new Proxy({}, {
    get() { trapCalls += 1; throw new Error('trap'); },
    getOwnPropertyDescriptor() { trapCalls += 1; throw new Error('trap'); },
    getPrototypeOf() { trapCalls += 1; throw new Error('trap'); },
    ownKeys() { trapCalls += 1; throw new Error('trap'); },
  });
  assert.throws(
    () => validateAuthoringV2AdmissionReader(proxy),
    (error) => error.code === 'AUTHORING_V2_PORT_INVALID',
  );
  assert.equal(trapCalls, 0);

  const generic = fakeHostBoundPort(PROCESSING_RESULT_ADOPTION_ATOMIC_STORE_KIND);
  const hostBound = fakeHostBoundPort();
  assert.equal(validateProcessingResultAdoptionAtomicStore(generic).kind, PROCESSING_RESULT_ADOPTION_ATOMIC_STORE_KIND);
  assert.equal(validateProcessingResultAdoptionHostBoundAtomicStore(hostBound).kind, PROCESSING_RESULT_ADOPTION_HOST_BOUND_ATOMIC_STORE_KIND);
  assert.throws(
    () => validateProcessingResultAdoptionHostBoundAtomicStore(generic),
    (error) => error.code === 'PROCESSING_RESULT_ADOPTION_COMMIT_PORT_INVALID',
  );
  assert.throws(
    () => new AuthoringV2ExecutionSession({
      admissionService: fakeAdmissionService(),
      planningService: fakePlanningService(),
      hostBoundAtomicStore: generic,
      trustedBinding: fakeBinding(),
    }),
    (error) => error.code === 'PROCESSING_RESULT_ADOPTION_COMMIT_PORT_INVALID',
  );
  assert.throws(
    () => fakeAdmissionService({
      capabilityImplementation: () => Promise.resolve(NUMBERDROID_PROJECT_CAPABILITY_MANIFEST),
      expectedCapabilityManifest: NUMBERDROID_PROJECT_CAPABILITY_MANIFEST,
    }),
    (error) => error.code === 'AUTHORING_V2_PORT_INVALID',
  );
});

test('admission awaits only native Promises and never assimilates hostile thenables or response proxies', async () => {
  const evidencePromise = Promise.resolve(fakeAdmissionEvidence());
  Object.defineProperty(evidencePromise, Symbol('instrumentation'), { value: 'safe-runtime-metadata' });
  const admitted = await fakeAdmissionService({
    admissionImplementation: () => evidencePromise,
  }).admit(fakeSelection());
  assert.equal(admitted.evidence.branchRevision, 2);
  assert.equal(admitted.capabilityFingerprint, NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT);

  let getterCalls = 0;
  const thenable = {};
  Object.defineProperty(thenable, 'then', {
    enumerable: true,
    get() { getterCalls += 1; throw new Error('then getter'); },
  });
  await assert.rejects(
    fakeAdmissionService({ admissionImplementation: () => thenable }).admit(fakeSelection()),
    (error) => error.code === 'AUTHORING_V2_PORT_RESPONSE_INVALID',
  );
  assert.equal(getterCalls, 0);

  let trapCalls = 0;
  const responseProxy = new Proxy({}, {
    get() { trapCalls += 1; throw new Error('trap'); },
    getOwnPropertyDescriptor() { trapCalls += 1; throw new Error('trap'); },
    getPrototypeOf() { trapCalls += 1; throw new Error('trap'); },
    ownKeys() { trapCalls += 1; throw new Error('trap'); },
  });
  await assert.rejects(
    fakeAdmissionService({ admissionImplementation: () => responseProxy }).admit(fakeSelection()),
    (error) => error.code === 'AUTHORING_V2_PORT_RESPONSE_INVALID',
  );
  assert.equal(trapCalls, 0);
});

test('surface negotiation alone admits coherent exhausted budgets while command admission stays strict', async () => {
  const exhausted = fakeAdmissionEvidence({ taskUsedCommands: 1, grantUsedCommands: 1 });
  const service = fakeAdmissionService({
    admissionImplementation: () => Promise.resolve(exhausted),
  });
  await assert.rejects(
    service.admit(fakeSelection()),
    (error) => error.code === 'BUDGET_EXCEEDED',
  );
  const negotiated = await service.negotiateSurface(fakeSelection());
  assert.equal(negotiated.budgetState, 'REPLAY_ONLY');
  assert.equal(negotiated.evidence.taskUsedCommands, negotiated.evidence.taskMaxCommands);
  assert.equal(negotiated.evidence.grantUsedCommands, negotiated.evidence.grantMaxCommands);

  const incoherent = fakeAdmissionEvidence({ taskUsedCommands: 1, grantUsedCommands: 0 });
  await assert.rejects(
    fakeAdmissionService({
      admissionImplementation: () => Promise.resolve(incoherent),
    }).negotiateSurface(fakeSelection()),
    (error) => error.code === 'AUTHORING_V2_PORT_RESPONSE_INVALID',
  );
});

test('one-shot surface negotiation is exact, profile-pinned, redacted, and strictly validated', async () => {
  const request = surfaceNegotiationRequest();
  assert.deepEqual(validateAuthoringV2SurfaceNegotiationRequest(request), request);
  const session = fakeSession();
  const first = session.negotiateSurface(request);
  assert.throws(
    () => session.readCapabilities({
      schemaVersion: AUTHORING_V2_SCHEMA_VERSION,
      featureId: AUTHORING_V2_FEATURE_ID,
      projectId: PROJECT_ID,
    }),
    (error) => error.code === 'AUTHORING_V2_SESSION_CONSUMED',
  );
  const negotiation = await first;
  assert.deepEqual(Object.keys(negotiation), [
    'schemaVersion', 'kind', 'status', 'featureId', 'projectId', 'branchRevision',
    'budgetState', 'profile', 'commandFeatures',
  ]);
  assert.equal(negotiation.kind, AUTHORING_V2_SURFACE_NEGOTIATION_KIND);
  assert.equal(negotiation.status, 'READY');
  assert.equal(negotiation.budgetState, 'AVAILABLE');
  assert.deepEqual(Object.keys(negotiation.profile), ['profileId', 'profileVersion', 'fingerprint']);
  assert.equal(Object.hasOwn(negotiation.profile, 'manifest'), false);
  assert.deepEqual(negotiation.commandFeatures, AUTHORING_V2_COMMAND_FEATURES);
  assert.deepEqual(validateAuthoringV2SurfaceNegotiation(negotiation, {
    projectId: PROJECT_ID,
    expectedProfileFingerprint: NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT,
  }), negotiation);

  const exhaustedSession = fakeSession({
    admissionService: fakeAdmissionService({
      admissionImplementation: () => Promise.resolve(fakeAdmissionEvidence({
        taskUsedCommands: 1,
        grantUsedCommands: 1,
      })),
    }),
  });
  assert.equal(
    (await exhaustedSession.negotiateSurface(request)).budgetState,
    'REPLAY_ONLY',
  );

  await assert.rejects(
    fakeSession().negotiateSurface(surfaceNegotiationRequest('0'.repeat(64))),
    (error) => error.code === 'AUTHORING_V2_CAPABILITY_MISMATCH',
  );
  assert.throws(
    () => fakeSession().negotiateSurface({ ...request, callerAuthority: true }),
    (error) => error.code === 'AUTHORING_V2_REQUEST_INVALID',
  );
  assert.throws(
    () => validateAuthoringV2SurfaceNegotiationRequest({ ...request, projectId: '' }),
    (error) => error.code === 'AUTHORING_V2_REQUEST_INVALID',
  );

  const withManifest = structuredClone(negotiation);
  withManifest.profile.manifest = NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST;
  assert.throws(
    () => validateAuthoringV2SurfaceNegotiation(withManifest),
    (error) => error.code === 'AUTHORING_V2_RESPONSE_INVALID',
  );
  const modifiedRegistry = structuredClone(negotiation);
  modifiedRegistry.commandFeatures[0].ownerOnly = true;
  assert.throws(
    () => validateAuthoringV2SurfaceNegotiation(modifiedRegistry),
    (error) => error.code === 'AUTHORING_V2_RESPONSE_INVALID',
  );
  const malformedNegotiations = [
    { ...structuredClone(negotiation), projectId: '' },
    { ...structuredClone(negotiation), branchRevision: 0 },
    { ...structuredClone(negotiation), profile: { ...negotiation.profile, profileId: '' } },
    { ...structuredClone(negotiation), profile: { ...negotiation.profile, profileVersion: 0 } },
  ];
  for (const malformed of malformedNegotiations) {
    assert.throws(
      () => validateAuthoringV2SurfaceNegotiation(malformed),
      (error) => error.code === 'AUTHORING_V2_RESPONSE_INVALID',
    );
  }
});

test('one-shot consumption is synchronous and only an unmodified native AbortSignal is accepted', async () => {
  const request = {
    schemaVersion: AUTHORING_V2_SCHEMA_VERSION,
    featureId: AUTHORING_V2_FEATURE_ID,
    projectId: PROJECT_ID,
  };
  const session = fakeSession();
  const first = session.readCapabilities(request);
  assert.throws(
    () => session.readCapabilities(request),
    (error) => error.code === 'AUTHORING_V2_SESSION_CONSUMED',
  );
  assert.equal((await first).profile.fingerprint, NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT);

  const capabilities = await fakeSession().readCapabilities(request);
  assert.equal(capabilities.kind, AUTHORING_V2_CAPABILITIES_KIND);
  assert.deepEqual(validateAuthoringV2Capabilities(capabilities, {
    projectId: PROJECT_ID,
    expectedProfileFingerprint: NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT,
  }), capabilities);
  const malformedCapabilities = [
    { ...structuredClone(capabilities), projectId: '' },
    { ...structuredClone(capabilities), branchRevision: 0 },
    { ...structuredClone(capabilities), profile: { ...capabilities.profile, profileId: '' } },
    { ...structuredClone(capabilities), profile: { ...capabilities.profile, profileVersion: 0 } },
  ];
  for (const malformed of malformedCapabilities) {
    assert.throws(
      () => validateAuthoringV2Capabilities(malformed),
      (error) => error.code === 'AUTHORING_V2_RESPONSE_INVALID',
    );
  }

  const controller = new AbortController();
  Object.defineProperty(controller.signal, 'smuggled', { value: true });
  const modifiedSignalSession = fakeSession();
  assert.throws(
    () => modifiedSignalSession.readCapabilities(request, { signal: controller.signal }),
    (error) => error.code === 'AUTHORING_V2_REQUEST_INVALID',
  );
  assert.throws(
    () => modifiedSignalSession.readCapabilities(request),
    (error) => error.code === 'AUTHORING_V2_SESSION_CONSUMED',
  );

  const aborted = new AbortController();
  aborted.abort();
  await assert.rejects(fakeSession().readCapabilities(request, { signal: aborted.signal }), (error) => error.name === 'AbortError');
});

function descriptor(artifact) {
  return {
    artifactUri: artifact.uri,
    sha256: artifact.digest,
    mediaType: artifact.mediaType,
    byteSize: artifact.byteSize,
    width: artifact.width,
    height: artifact.height,
  };
}

function processingWarning() {
  return {
    severity: 'WARNING',
    ruleId: 'studio.processing.review_recommended',
    objectRef: 'output:rect.authoring-v2',
    explanation: 'The exact crop remains a DRAFT until explicit owner review.',
    remediation: 'Review the DRAFT Asset before any owner-controlled lifecycle transition.',
    validatorVersion: 'studio.processing-validator.v1',
  };
}

function adoptionCommand({
  inputArtifact,
  outputArtifact,
  baseRevision,
  commandId = 'command.authoring-v2.adopt',
  idempotencyKey = 'idempotency.authoring-v2.adopt',
  assetName = 'Authoring-v2 Draft Asset',
}) {
  const input = descriptor(inputArtifact);
  const output = descriptor(outputArtifact);
  const recipe = createExactPngCropProcessingRecipe({
    recipeId: 'recipe.authoring-v2.adopt',
    recipeVersion: 1,
    input: { inputId: 'input.source', ...input },
    operationId: 'operation.exact-crop',
    rectangles: [{
      rectangleId: 'rect.authoring-v2',
      x: 0,
      y: 0,
      width: output.width,
      height: output.height,
      included: true,
      pivot: null,
      transparentPaddingPolicy: 'preserve_exact_rect',
      replacesSliceId: null,
      expectedSliceVersion: null,
    }],
  });
  const operation = recipe.operations[0];
  const processingResult = {
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
      inputs: structuredClone(recipe.inputs),
      outputs: [{ outputId: 'rect.authoring-v2', ...output }],
    }],
    findings: [processingWarning()],
  };
  const selection = createPrimaryVisualAssetInputSelection({
    processingResult,
    outputId: 'rect.authoring-v2',
    assetKind: 'surface',
  });
  return {
    schemaVersion: 1,
    kind: PROCESSING_RESULT_ADOPTION_COMMAND_KIND,
    commandId,
    idempotencyKey,
    type: PROCESSING_RESULT_ADOPTION_COMMAND_TYPE,
    projectId: PROJECT_ID,
    baseRevision,
    expectedVersion: baseRevision,
    payload: {
      preflightRequest: {
        schemaVersion: 1,
        kind: PROCESSING_ADOPTION_PREFLIGHT_REQUEST_KIND,
        project: { projectId: PROJECT_ID, expectedRevision: baseRevision },
        processingRecipe: recipe,
        processingResult,
        assetInputSelection: selection,
        capability: {
          schemaVersion: NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST.schemaVersion,
          kind: NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST.kind,
          profileId: NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST.profileId,
          profileVersion: NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST.profileVersion,
          adapter: structuredClone(NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST.adapter),
          manifestFingerprint: NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT,
          operation: { id: PROCESSING_ADOPTION_PREFLIGHT_OPERATION_ID, version: 1 },
        },
        target: {
          operation: 'create',
          assetId: ASSET_ID,
          expectedAssetVersion: 0,
          expectedMetadataVersion: 0,
        },
      },
      assetName,
    },
  };
}

test('optional trusted server correlation is carried into the host-bound command context', async () => {
  const inputBytes = encodeCanonicalRgbaPng({
    width: 2,
    height: 1,
    rgba: Buffer.from([20, 40, 60, 255, 80, 100, 120, 255]),
  });
  const outputBytes = encodeCanonicalRgbaPng({
    width: 1,
    height: 1,
    rgba: Buffer.from([20, 40, 60, 255]),
  });
  const inputDigest = createHash('sha256').update(inputBytes).digest('hex');
  const outputDigest = createHash('sha256').update(outputBytes).digest('hex');
  const inputArtifact = {
    uri: `studio://artifacts/sha256/${inputDigest}`,
    digest: inputDigest,
    mediaType: 'image/png',
    byteSize: inputBytes.length,
    width: 2,
    height: 1,
  };
  const outputArtifact = {
    uri: `studio://artifacts/sha256/${outputDigest}`,
    digest: outputDigest,
    mediaType: 'image/png',
    byteSize: outputBytes.length,
    width: 1,
    height: 1,
  };
  let trustedContext = null;
  const hostBoundAtomicStore = fakeHostBoundPort(
    PROCESSING_RESULT_ADOPTION_HOST_BOUND_ATOMIC_STORE_KIND,
    (_command, contextValue) => {
      trustedContext = contextValue;
      throw new Error('Stop after observing the trusted context.');
    },
  );
  const command = adoptionCommand({ inputArtifact, outputArtifact, baseRevision: 2 });
  await assert.rejects(
    fakeSession({
      hostBoundAtomicStore,
      correlationId: 'correlation.authoring-v2.transport',
    }).executeProcessingResultAdoption(executionRequest(command, false)),
    (error) => error.code === 'PROCESSING_RESULT_ADOPTION_COMMIT_PORT_FAILED',
  );
  assert.equal(trustedContext.correlationId, 'correlation.authoring-v2.transport');
  assert.throws(
    () => fakeSession({ correlationId: '' }),
    (error) => error.code === 'VALIDATION_ERROR',
  );
});

class CountingCapabilityProvider extends FixedProjectCapabilityProvider {
  calls = 0;

  async getProjectCapabilityManifest(...args) {
    this.calls += 1;
    return super.getProjectCapabilityManifest(...args);
  }
}

class CountingArtifactStore extends ContentAddressedArtifactStore {
  evidenceCalls = 0;

  async withVerifiedPngEvidence(...args) {
    this.evidenceCalls += 1;
    return super.withVerifiedPngEvidence(...args);
  }
}

async function integrationFixture(context, { faultPoint = null } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-authoring-v2-private-'));
  const state = { store: null };
  const fault = { armed: false, point: faultPoint };
  afterTestCleanup(context, () => rm(directory, { recursive: true, force: true }));
  afterTestCleanup(context, () => state.store?.close());
  const openProjectStore = () => SqliteProjectStore.open({
    filename: join(directory, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
    faultInjector(point) {
      if (fault.armed && point === fault.point) throw new Error(`simulated fault: ${point}`);
    },
  });
  state.store = await openProjectStore();
  const grantScopes = listAuthoringV2GrantScopes();
  const setupProvider = new FixedProjectCapabilityProvider({
    manifest: NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST,
  });
  const studio = new StudioService({
    store: state.store,
    clock: () => NOW,
    capabilityProvider: setupProvider,
    grantScopes,
  });
  await createProject(studio);
  const taskStore = new SqliteAgentTaskStore({ workspace: state.store.workspace });
  const tasks = new AgentTaskService({
    studioService: studio,
    projectStore: state.store,
    taskStore,
    createBranchStore: ({ projectId, taskId }) => new TaskBranchProjectStore({ taskStore, projectId, taskId }),
    clock: () => NOW,
    capabilityProvider: setupProvider,
    grantScopes,
  });
  const created = await tasks.createTask({
    projectId: PROJECT_ID,
    task: {
      taskId: TASK_ID,
      branchId: BRANCH_ID,
      agentId: AGENT.id,
      title: 'Adopt one exact processing result',
      objective: 'Create one branch-local DRAFT Asset and stop for owner review.',
      capabilities: [PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE],
      objectScopes: [
        { kind: 'project', id: PROJECT_ID },
        { kind: 'asset', id: ASSET_ID },
      ],
      budget: { maxCommands: 1, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 },
      expiresAt: EXPIRES_AT,
      autoAcceptPolicy: { enabled: false, allowedCommandTypes: [], maxChanges: 0 },
    },
  }, OWNER_CONTEXT);
  const artifactRoot = join(directory, 'artifacts');
  const artifactStore = new ContentAddressedArtifactStore({ rootDirectory: artifactRoot });
  const inputArtifact = await artifactStore.ingest(encodeCanonicalRgbaPng({
    width: 2,
    height: 1,
    rgba: Buffer.from([20, 40, 60, 255, 80, 100, 120, 255]),
  }), { mediaType: 'image/png' });
  const outputArtifact = await artifactStore.ingest(encodeCanonicalRgbaPng({
    width: 1,
    height: 1,
    rgba: Buffer.from([20, 40, 60, 255]),
  }), { mediaType: 'image/png' });
  const metadata = new SqliteArtifactMetadataStore({ workspace: state.store.workspace });
  for (const [index, artifact] of [inputArtifact, outputArtifact].entries()) {
    metadata.registerAndReference(artifact, {
      projectId: PROJECT_ID,
      ownerKind: 'authoring_v2_fixture',
      ownerId: `artifact.${index + 1}`,
      createdRevision: created.task.baseRevision,
    }, { createdAt: NOW });
  }
  let provider;
  let hostBindingStore;
  let adoptionStore;
  let runtimeArtifactStore;

  function buildRuntimeParts() {
    provider = new CountingCapabilityProvider({
      manifest: NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST,
    });
    hostBindingStore = new SqliteHostBindingStore({ workspace: state.store.workspace, clock: () => NOW });
    runtimeArtifactStore = new CountingArtifactStore({ rootDirectory: artifactRoot });
    adoptionStore = new SqliteProcessingResultAdoptionStore({
      workspace: state.store.workspace,
      artifactStore: runtimeArtifactStore,
      capabilityProvider: provider,
      clock: () => NOW,
    });
  }
  buildRuntimeParts();
  const issued = hostBindingStore.issue({
    projectId: PROJECT_ID,
    grantId: created.task.grantId,
    agentId: AGENT.id,
    taskId: created.task.taskId,
    branchId: created.task.branchId,
    issuedBy: OWNER.id,
    expiresAt: EXPIRES_AT,
  });

  function newSession({ capabilityReader = null } = {}) {
    const binding = hostBindingStore.resolve(issued.token);
    const admissionReader = new SqliteAuthoringV2AdmissionReader({
      workspace: state.store.workspace,
      trustedBinding: binding,
      clock: () => NOW,
    });
    const reader = capabilityReader ?? {
      schemaVersion: AUTHORING_V2_CAPABILITY_READER_SCHEMA_VERSION,
      kind: AUTHORING_V2_CAPABILITY_READER_KIND,
      readProjectCapabilityManifest: (selection, options) => provider.getProjectCapabilityManifest(selection, options),
    };
    const admissionService = new AuthoringV2AdmissionService({
      admissionReader: admissionReader.asAdmissionReader(),
      capabilityReader: reader,
      expectedCapabilityManifest: NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST,
    });
    const planningService = new ProcessingResultAdoptionPlanningService({
      ...adoptionStore.asPlanningPorts(),
      clock: () => NOW,
    });
    return new AuthoringV2ExecutionSession({
      admissionService,
      planningService,
      hostBoundAtomicStore: adoptionStore.asHostBoundAtomicStore(binding),
      trustedBinding: binding,
    });
  }

  async function reopen() {
    state.store.close();
    state.store = await openProjectStore();
    buildRuntimeParts();
  }

  return {
    directory,
    state,
    created,
    issued,
    inputArtifact,
    outputArtifact,
    fault,
    get provider() { return provider; },
    get artifactStore() { return runtimeArtifactStore; },
    get hostBindingStore() { return hostBindingStore; },
    get adoptionStore() { return adoptionStore; },
    newSession,
    reopen,
  };
}

function executionRequest(command, dryRun) {
  return {
    schemaVersion: AUTHORING_V2_SCHEMA_VERSION,
    featureId: AUTHORING_V2_FEATURE_ID,
    toolName: AUTHORING_V2_PROCESSING_RESULT_ADOPTION_TOOL,
    dryRun,
    command,
  };
}

function semanticState(database) {
  const count = (table) => Number(database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count);
  const task = database.prepare(`SELECT head_revision, task_json FROM agent_tasks WHERE project_id = ? AND task_id = ?`).get(PROJECT_ID, TASK_ID);
  const grant = database.prepare(`SELECT usage_json FROM grants WHERE project_id = ? AND grant_id = ?`).get(PROJECT_ID, `grant.task.${TASK_ID}`);
  return {
    mainRevisions: count('revisions'),
    taskHeadRevision: Number(task.head_revision),
    taskJson: task.task_json,
    grantUsageJson: grant.usage_json,
    branchRevisions: count('task_branch_revisions'),
    adoptions: count('task_branch_processing_result_adoptions'),
    adoptionReferences: count('task_branch_processing_result_artifact_references'),
    timeline: count('task_timeline_events'),
    artifactReferences: count('artifact_references'),
    activities: count('activity_events'),
  };
}

function adoptionEffectState(database) {
  const state = semanticState(database);
  return {
    taskHeadRevision: state.taskHeadRevision,
    taskJson: state.taskJson,
    grantUsageJson: state.grantUsageJson,
    branchRevisions: state.branchRevisions,
    adoptions: state.adoptions,
    adoptionReferences: state.adoptionReferences,
    timeline: state.timeline,
    activities: state.activities,
  };
}

test('fresh SQLite HostBinding/Task/Grant/branch/profile admission yields only redacted v2 capabilities', async (context) => {
  const value = await integrationFixture(context);
  const capabilities = await value.newSession().readCapabilities({
    schemaVersion: AUTHORING_V2_SCHEMA_VERSION,
    featureId: AUTHORING_V2_FEATURE_ID,
    projectId: PROJECT_ID,
  });
  assert.equal(capabilities.schemaVersion, AUTHORING_V2_SCHEMA_VERSION);
  assert.equal(capabilities.featureId, AUTHORING_V2_FEATURE_ID);
  assert.equal(capabilities.branchRevision, value.created.task.baseRevision);
  assert.equal(capabilities.profile.profileVersion, 2);
  assert.equal(capabilities.profile.fingerprint, NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT);
  assert.equal(capabilities.commandFeatures.length, 1);
  assert.equal(capabilities.commandFeatures[0].commandType, PROCESSING_RESULT_ADOPTION_COMMAND_TYPE);
  assert.doesNotMatch(JSON.stringify(capabilities), /bindingId|binding\.authoring|grant\.task|host.?binding/i);
});

test('HostBinding revocation during the asynchronous profile read prevents positive admission without adoption effects', async (context) => {
  const value = await integrationFixture(context);
  const before = adoptionEffectState(value.state.store.workspace.database);
  let profileCalls = 0;
  const capabilityReader = {
    schemaVersion: AUTHORING_V2_CAPABILITY_READER_SCHEMA_VERSION,
    kind: AUTHORING_V2_CAPABILITY_READER_KIND,
    readProjectCapabilityManifest() {
      profileCalls += 1;
      value.hostBindingStore.revoke(value.issued.binding.bindingId, {
        revokedBy: OWNER.id,
        reason: 'Close the profile-read race.',
      });
      return Promise.resolve(NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST);
    },
  };
  await assert.rejects(
    value.newSession({ capabilityReader }).readCapabilities({
      schemaVersion: AUTHORING_V2_SCHEMA_VERSION,
      featureId: AUTHORING_V2_FEATURE_ID,
      projectId: PROJECT_ID,
    }),
    (error) => error.code === 'HOST_BINDING_REVOKED',
  );
  assert.equal(profileCalls, 1);
  assert.deepEqual(adoptionEffectState(value.state.store.workspace.database), before);
});

test('dryRun performs fresh full admission and real A1.4 planning without any semantic write, retention, or charge', async (context) => {
  const value = await integrationFixture(context);
  const command = adoptionCommand({
    inputArtifact: value.inputArtifact,
    outputArtifact: value.outputArtifact,
    baseRevision: value.created.task.baseRevision,
  });
  const before = semanticState(value.state.store.workspace.database);
  const result = await value.newSession().executeProcessingResultAdoption(executionRequest(command, true));
  assert.equal(result.status, 'READY');
  assert.equal(result.plan.status, 'READY_FOR_ATOMIC_UNIT_OF_WORK');
  assert.deepEqual(semanticState(value.state.store.workspace.database), before);
  assert.ok(value.provider.calls >= 3, 'profile admission plus A1.3 planning capability reads must run');
});

test('commit accepts only the distinct host-bound port and creates exactly one branch-local DRAFT adoption effect', async (context) => {
  const value = await integrationFixture(context);
  assert.equal(value.adoptionStore.asAtomicStore().kind, PROCESSING_RESULT_ADOPTION_ATOMIC_STORE_KIND);
  const binding = value.hostBindingStore.resolve(value.issued.token);
  assert.equal(
    value.adoptionStore.asHostBoundAtomicStore(binding).kind,
    PROCESSING_RESULT_ADOPTION_HOST_BOUND_ATOMIC_STORE_KIND,
  );
  const command = adoptionCommand({
    inputArtifact: value.inputArtifact,
    outputArtifact: value.outputArtifact,
    baseRevision: value.created.task.baseRevision,
  });
  const before = semanticState(value.state.store.workspace.database);
  const result = await value.newSession().executeProcessingResultAdoption(executionRequest(command, false));
  const after = semanticState(value.state.store.workspace.database);
  assert.equal(result.branchRevision, value.created.task.baseRevision + 1);
  assert.equal(result.asset.lifecycle, 'DRAFT');
  assert.equal(after.branchRevisions, before.branchRevisions + 1);
  assert.equal(after.adoptions, before.adoptions + 1);
  assert.equal(after.adoptionReferences, before.adoptionReferences + 2);
  assert.equal(after.timeline, before.timeline + 1);
  assert.equal(JSON.parse(after.taskJson).usage.commands, 1);
  assert.equal(JSON.parse(after.grantUsageJson).commands, 0, 'the main Grant row remains the base usage for branch-ledger rederivation');
});

test('maxCommands=1 preserves same-key replay and a new command-ID alias without profile, CAS, write, or second charge', async (context) => {
  const value = await integrationFixture(context);
  const command = adoptionCommand({
    inputArtifact: value.inputArtifact,
    outputArtifact: value.outputArtifact,
    baseRevision: value.created.task.baseRevision,
  });
  const committed = await value.newSession().executeProcessingResultAdoption(executionRequest(command, false));
  const callsAfterCommit = value.provider.calls;
  const stateAfterCommit = semanticState(value.state.store.workspace.database);
  const replayed = await value.newSession().executeProcessingResultAdoption(executionRequest(command, false));
  assert.deepEqual(replayed, committed);
  const alias = structuredClone(command);
  alias.commandId = 'command.authoring-v2.adopt.alias';
  const aliasReplay = await value.newSession().executeProcessingResultAdoption(executionRequest(alias, false));
  assert.deepEqual(aliasReplay, committed);
  assert.equal(value.provider.calls, callsAfterCommit);
  assert.deepEqual(semanticState(value.state.store.workspace.database), stateAfterCommit);

  const newCommand = adoptionCommand({
    inputArtifact: value.inputArtifact,
    outputArtifact: value.outputArtifact,
    baseRevision: value.created.task.baseRevision + 1,
    commandId: 'command.authoring-v2.new',
    idempotencyKey: 'idempotency.authoring-v2.new',
  });
  await assert.rejects(
    value.newSession().executeProcessingResultAdoption(executionRequest(newCommand, false)),
    (error) => error.code === 'BUDGET_EXCEEDED',
  );
  assert.deepEqual(semanticState(value.state.store.workspace.database), stateAfterCommit);
});

test('idempotency and command-ID conflicts retain A1.5 precedence and remain effect-free', async (context) => {
  const value = await integrationFixture(context);
  const command = adoptionCommand({
    inputArtifact: value.inputArtifact,
    outputArtifact: value.outputArtifact,
    baseRevision: value.created.task.baseRevision,
  });
  await value.newSession().executeProcessingResultAdoption(executionRequest(command, false));
  const afterCommit = semanticState(value.state.store.workspace.database);
  const providerCalls = value.provider.calls;

  const semanticConflict = structuredClone(command);
  semanticConflict.commandId = 'command.authoring-v2.semantic-conflict';
  semanticConflict.payload.assetName = 'Different semantic Asset name';
  await assert.rejects(
    value.newSession().executeProcessingResultAdoption(executionRequest(semanticConflict, false)),
    (error) => error.code === 'IDEMPOTENCY_CONFLICT',
  );

  const commandIdConflict = structuredClone(command);
  commandIdConflict.idempotencyKey = 'idempotency.authoring-v2.command-id-conflict';
  await assert.rejects(
    value.newSession().executeProcessingResultAdoption(executionRequest(commandIdConflict, false)),
    (error) => error.code === 'COMMAND_ID_CONFLICT',
  );
  assert.equal(value.provider.calls, providerCalls);
  assert.deepEqual(semanticState(value.state.store.workspace.database), afterCommit);
});

test('lost post-commit response is recovered after SQLite reopen by a fresh session at exhausted budget', async (context) => {
  const value = await integrationFixture(context, {
    faultPoint: 'after_processing_result_adoption_commit',
  });
  const command = adoptionCommand({
    inputArtifact: value.inputArtifact,
    outputArtifact: value.outputArtifact,
    baseRevision: value.created.task.baseRevision,
  });
  value.fault.armed = true;
  await assert.rejects(
    value.newSession().executeProcessingResultAdoption(executionRequest(command, false)),
    (error) => error.code === 'PROCESSING_RESULT_ADOPTION_COMMIT_PORT_FAILED',
  );
  value.fault.armed = false;
  const durable = semanticState(value.state.store.workspace.database);
  assert.equal(durable.adoptions, 1);
  assert.equal(durable.adoptionReferences, 2);
  assert.equal(JSON.parse(durable.taskJson).usage.commands, 1);
  assert.equal(value.provider.calls, 1);
  assert.equal(value.artifactStore.evidenceCalls, 2);
  await value.reopen();
  const alias = structuredClone(command);
  alias.commandId = 'command.authoring-v2.reopen-alias';
  const recovered = await value.newSession().executeProcessingResultAdoption(executionRequest(alias, false));
  assert.equal(recovered.commandId, command.commandId);
  assert.equal(recovered.branchRevision, value.created.task.baseRevision + 1);
  assert.deepEqual(semanticState(value.state.store.workspace.database), durable);
  assert.equal(value.provider.calls, 0, 'ledger-first reopen replay does not re-read the profile');
  assert.equal(value.artifactStore.evidenceCalls, 0, 'ledger-first reopen replay does not re-read CAS');
});

test('production startup keeps the private v2 runtime hidden, write-free, and absent from legacy HTTP/MCP/UI discovery', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-authoring-v2-server-'));
  afterTestCleanup(context, () => rm(directory, { recursive: true, force: true }));
  const running = await startStudioHttpServer({
    dataDirectory: directory,
    host: '127.0.0.1',
    port: 0,
    clock: () => NOW,
  });
  afterTestCleanup(context, () => new Promise((resolveClose, rejectClose) => {
    running.server.close((error) => (error ? rejectClose(error) : resolveClose()));
  }));
  assert.deepEqual(
    Object.keys(running).filter((key) => /authoring|capability|adoption|runtime|session/i.test(key)),
    [],
  );
  const origin = `http://127.0.0.1:${running.address.port}`;
  const catalogResponse = await fetch(`${origin}/api/catalog`);
  const catalog = await catalogResponse.json();
  assert.equal(catalog.commands.length, 33);
  assert.equal(catalog.commands.some(({ type }) => type === PROCESSING_RESULT_ADOPTION_COMMAND_TYPE), false);
  const absentRoute = await fetch(`${origin}/internal/authoring-v2/capabilities`);
  assert.equal(absentRoute.status, 404);

  const defaultTools = createAgentToolCatalog(running.studioService, {
    contextProvider: async () => ({ projectId: PROJECT_ID }),
  });
  assert.equal(defaultTools.length, 19);
  assert.equal(defaultTools.some(({ name }) => name === AUTHORING_V2_PROCESSING_RESULT_ADOPTION_TOOL), false);
  assert.equal(NUMBERDROID_PROJECT_CAPABILITY_FINGERPRINT, '826a8b7942ccba97393f55efa356525529994ad34189446992a7dff58fe97049');
  assert.equal(NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT, '5488df72b2e45c738735d90046cd3c4a7a560a99922936cfeb5a3e84c63fc106');

  const database = nodeSqliteDatabaseFactory(join(directory, 'studio.sqlite'), { readonly: true });
  afterTestCleanup(context, () => database.close());
  for (const table of [
    'projects', 'revisions', 'activity_events', 'agent_tasks', 'grants', 'host_bindings',
    'task_branch_revisions', 'task_branch_processing_result_adoptions',
    'task_branch_processing_result_artifact_references', 'agent_attempts', 'jobs',
  ]) {
    assert.equal(Number(database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count), 0, `${table} must remain empty at startup`);
  }
  const gatewaySource = await readFile(new URL('../apps/studio-mcp/src/local-studio-gateway.js', import.meta.url), 'utf8');
  const uiSource = await readFile(new URL('../apps/studio-server/public/app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(gatewaySource, /studio_processing_result_adopt|authoring-v2-capabilities/);
  assert.doesNotMatch(uiSource, /studio_processing_result_adopt|authoring-v2-capabilities/);
  assert.equal(projectCapabilityManifestSha256(NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST), NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT);
});
