import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import {
  AUTHORING_V2_CAPABILITIES_KIND,
  AUTHORING_V2_SURFACE_NEGOTIATION_KIND,
} from '../packages/application/src/index.js';
import {
  AUTHORING_V2_COMMAND_FEATURES,
  AUTHORING_V2_FEATURE_ID,
  AUTHORING_V2_PROCESSING_RESULT_ADOPTION_TOOL,
  PROCESSING_ADOPTION_PREFLIGHT_OPERATION_ID,
  canonicalRgbaPngByteSize,
  createPrimaryVisualAssetInputSelection,
  listCommandDefinitions,
  processingRecipeSha256,
} from '../packages/domain/src/index.js';
import {
  NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT,
  NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST,
} from '../packages/numberdroid-adapter/src/index.js';
import {
  buildOfficialMcpServer,
  createAgentToolCatalog,
  jsonSchemaToZod,
} from '../packages/mcp-server/src/index.js';

const PROJECT_ID = 'project.authoring-v2';
const PROFILE_FINGERPRINT = NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT;

function validToolInput() {
  const inputSha256 = '1'.repeat(64);
  const outputSha256 = '2'.repeat(64);
  const inputArtifact = {
    inputId: 'input.one',
    artifactUri: `studio://artifacts/sha256/${inputSha256}`,
    sha256: inputSha256,
    mediaType: 'image/png',
    byteSize: 100,
    width: 1,
    height: 1,
  };
  const recipe = {
    schemaVersion: 1,
    kind: 'studio.processing-recipe',
    recipeId: 'recipe.one',
    recipeVersion: 1,
    inputs: [inputArtifact],
    operations: [{
      operationId: 'operation.one',
      kind: 'studio.image.exact-png-crop',
      processorId: 'numberdroid-studio.exact-png-crop.v1',
      inputId: 'input.one',
      outputMediaType: 'image/png',
      parameters: {
        rectangles: [{
          outputId: 'output.one',
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          transparentPaddingPolicy: 'preserve_exact_rect',
        }],
      },
    }],
  };
  const processingResult = {
    schemaVersion: 1,
    kind: 'studio.processing-result',
    recipe: { id: 'recipe.one', version: 1, fingerprint: processingRecipeSha256(recipe) },
    operations: [{
      operationId: 'operation.one',
      kind: 'studio.image.exact-png-crop',
      processorId: 'numberdroid-studio.exact-png-crop.v1',
      inputs: [structuredClone(inputArtifact)],
      outputs: [{
        outputId: 'output.one',
        artifactUri: `studio://artifacts/sha256/${outputSha256}`,
        sha256: outputSha256,
        mediaType: 'image/png',
        byteSize: canonicalRgbaPngByteSize(1, 1),
        width: 1,
        height: 1,
      }],
    }],
    findings: [{
      severity: 'WARNING',
      ruleId: 'studio.processing.review_required',
      objectRef: 'operation:operation.one',
      explanation: 'Review the exact output before later owner decisions.',
      remediation: 'Inspect the immutable pixels and metadata.',
      validatorVersion: 'validator.one',
    }],
  };
  const assetInputSelection = createPrimaryVisualAssetInputSelection({
    processingResult,
    outputId: 'output.one',
    assetKind: 'surface',
  });
  const manifest = NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST;
  return {
    schemaVersion: 2,
    commandId: 'command.adopt.1',
    idempotencyKey: 'idempotency.adopt.1',
    projectId: PROJECT_ID,
    baseRevision: 17,
    expectedVersion: 17,
    dryRun: true,
    payload: {
      preflightRequest: {
        schemaVersion: 1,
        kind: 'studio.processing-adoption-preflight-request',
        project: { projectId: PROJECT_ID, expectedRevision: 17 },
        processingRecipe: recipe,
        processingResult,
        assetInputSelection,
        capability: {
          schemaVersion: 1,
          kind: 'studio.project-capability-manifest',
          profileId: manifest.profileId,
          profileVersion: manifest.profileVersion,
          adapter: structuredClone(manifest.adapter),
          manifestFingerprint: PROFILE_FINGERPRINT,
          operation: { id: PROCESSING_ADOPTION_PREFLIGHT_OPERATION_ID, version: 1 },
        },
        target: {
          operation: 'create',
          assetId: 'asset.one',
          expectedAssetVersion: 0,
          expectedMetadataVersion: 0,
        },
      },
      assetName: 'Exact Output',
    },
  };
}

function negotiation(overrides = {}) {
  const manifest = NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST;
  return {
    schemaVersion: 2,
    kind: AUTHORING_V2_SURFACE_NEGOTIATION_KIND,
    status: 'READY',
    featureId: AUTHORING_V2_FEATURE_ID,
    projectId: PROJECT_ID,
    branchRevision: 17,
    budgetState: 'AVAILABLE',
    profile: {
      profileId: manifest.profileId,
      profileVersion: manifest.profileVersion,
      fingerprint: PROFILE_FINGERPRINT,
    },
    commandFeatures: structuredClone(AUTHORING_V2_COMMAND_FEATURES),
    ...overrides,
  };
}

function capabilities() {
  const manifest = structuredClone(NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST);
  return {
    schemaVersion: 2,
    kind: AUTHORING_V2_CAPABILITIES_KIND,
    featureId: AUTHORING_V2_FEATURE_ID,
    projectId: PROJECT_ID,
    branchRevision: 17,
    profile: {
      profileId: manifest.profileId,
      profileVersion: manifest.profileVersion,
      fingerprint: PROFILE_FINGERPRINT,
      manifest,
    },
    commandFeatures: structuredClone(AUTHORING_V2_COMMAND_FEATURES),
  };
}

function authoringV2Config(negotiationValue = negotiation()) {
  return {
    negotiation: negotiationValue,
    projectId: PROJECT_ID,
    expectedProfileFingerprint: PROFILE_FINGERPRINT,
  };
}

function gateway() {
  const calls = [];
  return {
    calls,
    commandCatalog: listCommandDefinitions(),
    agentAttemptAuditReady: true,
    durableJobStoreReady: true,
    durableAssetStoreReady: true,
    durableRoomStoreReady: true,
    taskBranchReady: false,
    async execute(command) { calls.push(['execute', command]); return command; },
    async readProject({ projectId }) { return { schemaVersion: 1, projectId }; },
    async proposeAtlasGrid(request) { return request; },
    async readJob(request) { return request; },
    async cancelJob(request) { return request; },
    async retryJob(request) { return request; },
    async discardJob(request) { return request; },
    async queryAssets(request) { return request; },
    async queryRooms(request) { return request; },
    async readTask(request) { return { schemaVersion: 1, task: { taskId: 'task.authoring-v2' }, request }; },
    async submitTaskForReview(request) { return request; },
    async readAuthoringV2Capabilities(request, opaqueHostContext, options) {
      calls.push(['authoring-v2-capabilities', request, opaqueHostContext, options]);
      return capabilities();
    },
    async adoptProcessingResult(request, opaqueHostContext, options) {
      calls.push(['authoring-v2-adopt', request, opaqueHostContext, options]);
      return { schemaVersion: 1, status: request.dryRun ? 'DRY_RUN' : 'COMMITTED' };
    },
  };
}

const contextProvider = async () => ({ projectId: PROJECT_ID });

test('Authoring v2 is absent by default and a positive exact negotiation selects only 31/6', async () => {
  const studioGateway = gateway();
  const legacy = createAgentToolCatalog(studioGateway, { contextProvider });
  assert.equal(legacy.length, 19);
  assert.ok(!legacy.some(({ name }) => name === AUTHORING_V2_PROCESSING_RESULT_ADOPTION_TOOL));

  const matchingTaskGateway = gateway();
  matchingTaskGateway.taskBranchReady = true;
  const matchingTask = createAgentToolCatalog(matchingTaskGateway, { contextProvider });
  assert.equal(matchingTask.length, 30);

  const selected = createAgentToolCatalog(studioGateway, {
    contextProvider,
    authoringV2: authoringV2Config(),
  });
  assert.equal(selected.length, 31);
  assert.equal(new Set(selected.map(({ name }) => name)).size, 31);
  assert.deepEqual(
    selected.map(({ name }) => name).sort(),
    [...matchingTask.map(({ name }) => name), AUTHORING_V2_PROCESSING_RESULT_ADOPTION_TOOL].sort(),
  );
  const tool = selected.find(({ name }) => name === AUTHORING_V2_PROCESSING_RESULT_ADOPTION_TOOL);
  assert.ok(tool);
  assert.deepEqual(tool.inputSchema.required, [
    'schemaVersion', 'commandId', 'idempotencyKey', 'projectId',
    'baseRevision', 'expectedVersion', 'dryRun', 'payload',
  ]);
  assert.deepEqual(tool.inputSchema.properties.schemaVersion.enum, [2]);
  assert.equal(tool.inputSchema.properties.payload.additionalProperties, false);

  const input = validToolInput();
  assert.equal(jsonSchemaToZod(tool.inputSchema).safeParse(input).success, true);
  await tool.execute(input, {});
  const [callName, mapped, opaqueHostContext, options] = studioGateway.calls.at(-1);
  assert.equal(callName, 'authoring-v2-adopt');
  assert.deepEqual(mapped, {
    schemaVersion: 2,
    featureId: AUTHORING_V2_FEATURE_ID,
    toolName: AUTHORING_V2_PROCESSING_RESULT_ADOPTION_TOOL,
    dryRun: true,
    command: {
      schemaVersion: 1,
      kind: 'studio.processing-result-adoption-command',
      commandId: 'command.adopt.1',
      idempotencyKey: 'idempotency.adopt.1',
      type: 'asset.processing-result.adopt',
      projectId: PROJECT_ID,
      baseRevision: 17,
      expectedVersion: 17,
      payload: input.payload,
    },
  });
  assert.deepEqual(opaqueHostContext, { projectId: PROJECT_ID });
  assert.deepEqual(options, { signal: undefined });
});

test('Authoring v2 fails closed instead of falling back when negotiation or the 30-tool baseline differs', () => {
  const badFingerprint = negotiation({
    profile: {
      ...negotiation().profile,
      fingerprint: '0'.repeat(64),
    },
  });
  assert.throws(
    () => createAgentToolCatalog(gateway(), {
      contextProvider,
      authoringV2: authoringV2Config(badFingerprint),
    }),
    (error) => error.code === 'AUTHORING_V2_RESPONSE_INVALID',
  );

  const incomplete = gateway();
  incomplete.commandCatalog = incomplete.commandCatalog.filter(
    ({ toolName }) => toolName !== 'studio_room_variant_resize',
  );
  assert.throws(
    () => createAgentToolCatalog(incomplete, {
      contextProvider,
      authoringV2: authoringV2Config(),
    }),
    (error) => error.code === 'AUTHORING_V2_SURFACE_BASELINE_MISMATCH'
      && error.details.actualToolCount === 29,
  );
});

test('official Authoring v2 discovery is static 31/6 and capabilities repeat project authority', async (context) => {
  const legacyGateway = gateway();
  legacyGateway.taskBranchReady = true;
  const legacyServer = buildOfficialMcpServer({
    studioGateway: legacyGateway,
    contextProvider,
  });
  const [legacyClientTransport, legacyServerTransport] = InMemoryTransport.createLinkedPair();
  await legacyServer.connect(legacyServerTransport);
  const legacyClient = new Client({ name: 'matching-task-contract', version: '1.0.0' });
  await legacyClient.connect(legacyClientTransport);
  context.after(async () => { await legacyClient.close(); await legacyServer.close(); });

  const studioGateway = gateway();
  const server = buildOfficialMcpServer({
    studioGateway,
    contextProvider,
    authoringV2: authoringV2Config(),
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'authoring-v2-contract', version: '1.0.0' });
  await client.connect(clientTransport);
  context.after(async () => { await client.close(); await server.close(); });

  const tools = (await client.listTools()).tools;
  const legacyTools = (await legacyClient.listTools()).tools;
  assert.equal(legacyTools.length, 30);
  assert.equal(tools.length, 31);
  assert.equal(tools.filter(({ name }) => name === AUTHORING_V2_PROCESSING_RESULT_ADOPTION_TOOL).length, 1);
  assert.deepEqual(
    tools.map(({ name }) => name).sort(),
    [...legacyTools.map(({ name }) => name), AUTHORING_V2_PROCESSING_RESULT_ADOPTION_TOOL].sort(),
  );
  assert.ok(tools.find(({ name }) => name === AUTHORING_V2_PROCESSING_RESULT_ADOPTION_TOOL)
    .inputSchema.required.includes('dryRun'));

  const legacyTemplates = (await legacyClient.listResourceTemplates()).resourceTemplates
    .map(({ uriTemplate }) => uriTemplate).sort();
  const templates = (await client.listResourceTemplates()).resourceTemplates
    .map(({ uriTemplate }) => uriTemplate).sort();
  assert.deepEqual(legacyTemplates, [
    'studio://projects/{projectId}',
    'studio://projects/{projectId}/assets/{assetId}',
    'studio://projects/{projectId}/jobs/{jobId}',
    'studio://projects/{projectId}/rooms/{roomVariantId}',
    'studio://projects/{projectId}/task',
  ]);
  assert.deepEqual(templates, [
    ...legacyTemplates,
    'studio://projects/{projectId}/capabilities',
  ].sort());

  const resource = await client.readResource({
    uri: `studio://projects/${PROJECT_ID}/capabilities`,
  });
  const value = JSON.parse(resource.contents[0].text);
  assert.equal(value.kind, AUTHORING_V2_CAPABILITIES_KIND);
  assert.equal(value.profile.fingerprint, PROFILE_FINGERPRINT);
  assert.deepEqual(studioGateway.calls.at(-1).slice(0, 3), [
    'authoring-v2-capabilities',
    { schemaVersion: 2, featureId: AUTHORING_V2_FEATURE_ID, projectId: PROJECT_ID },
    { projectId: PROJECT_ID },
  ]);
});

test('schema adapter enforces maximum, maxItems, and semantic uniqueItems', () => {
  const schema = jsonSchemaToZod({
    type: 'object',
    additionalProperties: false,
    required: ['count', 'items'],
    properties: {
      count: { type: 'integer', minimum: 1, maximum: 2 },
      items: {
        type: 'array', minItems: 1, maxItems: 2, uniqueItems: true,
        items: {
          type: 'object', additionalProperties: false, required: ['a', 'b'],
          properties: { a: { type: 'integer' }, b: { type: 'integer' } },
        },
      },
    },
  });
  assert.equal(schema.safeParse({ count: 2, items: [{ a: 1, b: 2 }] }).success, true);
  assert.equal(schema.safeParse({ count: 3, items: [{ a: 1, b: 2 }] }).success, false);
  assert.equal(schema.safeParse({ count: 1, items: [{ a: 1, b: 2 }, { a: 2, b: 3 }, { a: 3, b: 4 }] }).success, false);
  assert.equal(schema.safeParse({ count: 1, items: [{ a: 1, b: 2 }, { b: 2, a: 1 }] }).success, false);
});
