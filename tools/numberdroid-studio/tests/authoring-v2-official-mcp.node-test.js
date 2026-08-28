import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import {
  AUTHORING_V2_CAPABILITIES_KIND,
  AgentTaskService,
  FixedProjectCapabilityProvider,
  StudioService,
} from '../packages/application/src/index.js';
import {
  AUTHORING_V2_FEATURE_ID,
  AUTHORING_V2_PROCESSING_RESULT_ADOPTION_TOOL,
  AUTHORING_V2_SCHEMA_VERSION,
  PROCESSING_ADOPTION_PREFLIGHT_OPERATION_ID,
  PROCESSING_ADOPTION_PREFLIGHT_REQUEST_KIND,
  PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE,
  createExactPngCropProcessingRecipe,
  createPrimaryVisualAssetInputSelection,
  listAuthoringV2GrantScopes,
  processingRecipeSha256,
} from '../packages/domain/src/index.js';
import {
  NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT,
  NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST,
} from '../packages/numberdroid-adapter/src/index.js';
import {
  ContentAddressedArtifactStore,
  SqliteAgentTaskStore,
  SqliteArtifactMetadataStore,
  SqliteHostBindingStore,
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
  command,
  createProject,
} from './test-helpers.js';
import {
  afterTestCleanup,
  nodeSqliteDatabaseFactory,
} from './persistence-test-helpers.js';

const studioRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NOW = '2026-08-28T18:00:00.000Z';
const EXPIRES_AT = '2026-08-29T18:00:00.000Z';
const TASK_ID = 'task.authoring-v2.official-mcp';
const BRANCH_ID = 'branch.authoring-v2.official-mcp';
const ASSET_ID = 'asset.authoring-v2.official-mcp';
const CAPABILITIES_URI_TEMPLATE = 'studio://projects/{projectId}/capabilities';

const MATCHING_TASK_TOOL_NAMES = Object.freeze([
  'studio_asset_define',
  'studio_asset_proposal_submit',
  'studio_asset_query',
  'studio_atlas_commit_slices',
  'studio_atlas_define_rects',
  'studio_atlas_preview_slices',
  'studio_atlas_propose_grid',
  'studio_command_catalog_list',
  'studio_job_cancel',
  'studio_job_discard',
  'studio_job_read',
  'studio_job_retry',
  'studio_project_read',
  'studio_project_status_set',
  'studio_room_archetype_create',
  'studio_room_placement_proposal_submit',
  'studio_room_query',
  'studio_room_variant_connectors_set',
  'studio_room_variant_create',
  'studio_room_variant_intent_set',
  'studio_room_variant_placements_add',
  'studio_room_variant_placements_move',
  'studio_room_variant_placements_remove',
  'studio_room_variant_resize',
  'studio_room_variant_validate',
  'studio_source_intake_commit',
  'studio_source_register',
  'studio_source_review_propose',
  'studio_task_read',
  'studio_task_submit_for_review',
]);

const MATCHING_TASK_RESOURCE_TEMPLATES = Object.freeze([
  'studio://projects/{projectId}',
  'studio://projects/{projectId}/assets/{assetId}',
  'studio://projects/{projectId}/jobs/{jobId}',
  'studio://projects/{projectId}/rooms/{roomVariantId}',
  'studio://projects/{projectId}/task',
]);

function closeRunning(running) {
  if (running === null) return Promise.resolve();
  return new Promise((resolveClose, rejectClose) => {
    running.server.close((error) => (error ? rejectClose(error) : resolveClose()));
  });
}

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

function adoptionCommand({
  inputArtifact,
  outputArtifact,
  baseRevision,
  commandId = 'command.authoring-v2.official-mcp.adopt',
  idempotencyKey = 'idempotency.authoring-v2.official-mcp.adopt',
}) {
  const input = descriptor(inputArtifact);
  const output = descriptor(outputArtifact);
  const recipe = createExactPngCropProcessingRecipe({
    recipeId: 'recipe.authoring-v2.official-mcp',
    recipeVersion: 1,
    input: { inputId: 'input.source', ...input },
    operationId: 'operation.exact-crop',
    rectangles: [{
      rectangleId: 'rect.authoring-v2.official-mcp',
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
      outputs: [{ outputId: 'rect.authoring-v2.official-mcp', ...output }],
    }],
    findings: [{
      severity: 'WARNING',
      ruleId: 'studio.processing.review-recommended',
      objectRef: 'output:rect.authoring-v2.official-mcp',
      explanation: 'The exact crop remains a DRAFT until explicit owner review.',
      remediation: 'Review the DRAFT Asset before an owner-controlled lifecycle transition.',
      validatorVersion: 'studio.processing-validator.v1',
    }],
  };
  const selection = createPrimaryVisualAssetInputSelection({
    processingResult,
    outputId: 'rect.authoring-v2.official-mcp',
    assetKind: 'surface',
  });
  return {
    schemaVersion: 1,
    commandId,
    idempotencyKey,
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
      assetName: 'Authoring-v2 Official MCP Draft',
    },
  };
}

function toolArguments(command, dryRun) {
  return {
    schemaVersion: AUTHORING_V2_SCHEMA_VERSION,
    commandId: command.commandId,
    idempotencyKey: command.idempotencyKey,
    projectId: command.projectId,
    baseRevision: command.baseRevision,
    expectedVersion: command.expectedVersion,
    dryRun,
    payload: structuredClone(command.payload),
  };
}

function persistedState(filename) {
  const database = nodeSqliteDatabaseFactory(filename, { readonly: true });
  try {
    const count = (table) => Number(database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count);
    const task = database.prepare(`
      SELECT head_revision, task_json
      FROM agent_tasks
      WHERE project_id = ? AND task_id = ?
    `).get(PROJECT_ID, TASK_ID);
    return {
      mainRevisions: count('revisions'),
      taskHeadRevision: Number(task.head_revision),
      taskCommands: JSON.parse(task.task_json).usage.commands,
      branchRevisions: count('task_branch_revisions'),
      adoptions: count('task_branch_processing_result_adoptions'),
      adoptionReferences: count('task_branch_processing_result_artifact_references'),
      timeline: count('task_timeline_events'),
      activities: count('activity_events'),
    };
  } finally {
    database.close();
  }
}

function mcpChildEnvironment({ serviceUrl, token }) {
  const env = { ...process.env };
  for (const name of [
    'NUMBERDROID_STUDIO_PAIRING_ENDPOINT',
    'NUMBERDROID_STUDIO_AGENT_AUDIT_READY',
    'NUMBERDROID_STUDIO_JOB_STORE_READY',
    'NUMBERDROID_STUDIO_ASSET_STORE_READY',
    'NUMBERDROID_STUDIO_ROOM_STORE_READY',
    'NUMBERDROID_STUDIO_TASK_BRANCH_READY',
  ]) delete env[name];
  Object.assign(env, {
    NUMBERDROID_STUDIO_BINDING_TOKEN: token,
    NUMBERDROID_STUDIO_MCP_PROFILE: 'authoring-v2',
    NUMBERDROID_STUDIO_PROJECT_ID: PROJECT_ID,
    NUMBERDROID_STUDIO_SERVICE_URL: serviceUrl,
  });
  return env;
}

function childTransport({ serviceUrl, token }) {
  return new StdioClientTransport({
    command: process.execPath,
    args: [resolve(studioRoot, 'apps/studio-mcp/src/main.js')],
    cwd: studioRoot,
    env: mcpChildEnvironment({ serviceUrl, token }),
    stderr: 'pipe',
  });
}

async function connectOfficialMcp(serviceUrl, token) {
  const client = new Client(
    { name: 'numberdroid-authoring-v2-official-e2e', version: '1.0.0' },
    { versionNegotiation: { mode: { pin: '2026-07-28' } } },
  );
  await client.connect(childTransport({ serviceUrl, token }));
  assert.equal(client.getProtocolEra(), 'modern');
  assert.equal(client.getNegotiatedProtocolVersion(), '2026-07-28');
  return client;
}

async function handshake(serviceUrl, token) {
  const response = await fetch(`${serviceUrl}internal/mcp/authoring-v2/handshake`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      schemaVersion: AUTHORING_V2_SCHEMA_VERSION,
      kind: 'studio.authoring-v2-surface-negotiation-request',
      featureId: AUTHORING_V2_FEATURE_ID,
      projectId: PROJECT_ID,
      expectedProfileFingerprint: NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT,
    }),
  });
  return { status: response.status, body: await response.json() };
}

async function provision(directory) {
  const filename = join(directory, 'studio.sqlite');
  const store = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  try {
    const capabilityProvider = new FixedProjectCapabilityProvider({
      manifest: NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST,
    });
    const grantScopes = listAuthoringV2GrantScopes();
    const studio = new StudioService({
      store,
      clock: () => NOW,
      capabilityProvider,
      grantScopes,
    });
    await createProject(studio);
    const taskStore = new SqliteAgentTaskStore({ workspace: store.workspace });
    const tasks = new AgentTaskService({
      studioService: studio,
      projectStore: store,
      taskStore,
      createBranchStore: ({ projectId, taskId }) => new TaskBranchProjectStore({
        taskStore,
        projectId,
        taskId,
      }),
      clock: () => NOW,
      capabilityProvider,
      grantScopes,
    });
    const created = await tasks.createTask({
      projectId: PROJECT_ID,
      task: {
        taskId: TASK_ID,
        branchId: BRANCH_ID,
        agentId: AGENT.id,
        title: 'Adopt one exact processing result through official MCP',
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

    const artifactStore = new ContentAddressedArtifactStore({ rootDirectory: join(directory, 'artifacts') });
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
    const metadata = new SqliteArtifactMetadataStore({ workspace: store.workspace });
    for (const [index, artifact] of [inputArtifact, outputArtifact].entries()) {
      metadata.registerAndReference(artifact, {
        projectId: PROJECT_ID,
        ownerKind: 'authoring_v2_official_mcp_fixture',
        ownerId: `artifact.${index + 1}`,
        createdRevision: created.task.baseRevision,
      }, { createdAt: NOW });
    }
    const bindings = new SqliteHostBindingStore({ workspace: store.workspace, clock: () => NOW });
    const issued = bindings.issue({
      projectId: PROJECT_ID,
      grantId: created.task.grantId,
      agentId: AGENT.id,
      taskId: created.task.taskId,
      branchId: created.task.branchId,
      issuedBy: OWNER.id,
      expiresAt: EXPIRES_AT,
    });
    return {
      filename,
      token: issued.token,
      baseRevision: created.task.baseRevision,
      inputArtifact,
      outputArtifact,
    };
  } finally {
    store.close();
  }
}

test('official Authoring-v2 MCP keeps exact 31/6 discovery and ledger-first replay across a full restart', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-authoring-v2-official-mcp-'));
  const lifecycle = { running: null, client: null };
  afterTestCleanup(context, () => rm(directory, { recursive: true, force: true }));
  afterTestCleanup(context, () => closeRunning(lifecycle.running));
  afterTestCleanup(context, () => lifecycle.client?.close().catch(() => {}));

  const fixture = await provision(directory);
  lifecycle.running = await startStudioHttpServer({
    dataDirectory: directory,
    host: '127.0.0.1',
    port: 0,
    clock: () => NOW,
  });
  let serviceUrl = `http://127.0.0.1:${lifecycle.running.address.port}/`;
  lifecycle.client = await connectOfficialMcp(serviceUrl, fixture.token);

  const tools = (await lifecycle.client.listTools()).tools;
  const toolNames = tools.map(({ name }) => name).sort();
  assert.equal(toolNames.length, 31);
  assert.equal(toolNames.filter((name) => name === AUTHORING_V2_PROCESSING_RESULT_ADOPTION_TOOL).length, 1);
  assert.deepEqual(
    toolNames.filter((name) => name !== AUTHORING_V2_PROCESSING_RESULT_ADOPTION_TOOL),
    MATCHING_TASK_TOOL_NAMES,
  );
  const adoptionTool = tools.find(({ name }) => name === AUTHORING_V2_PROCESSING_RESULT_ADOPTION_TOOL);
  assert.deepEqual(adoptionTool.inputSchema.required, [
    'schemaVersion', 'commandId', 'idempotencyKey', 'projectId',
    'baseRevision', 'expectedVersion', 'dryRun', 'payload',
  ]);

  const templates = (await lifecycle.client.listResourceTemplates()).resourceTemplates
    .map(({ uriTemplate }) => uriTemplate).sort();
  assert.equal(templates.length, 6);
  assert.equal(templates.filter((value) => value === CAPABILITIES_URI_TEMPLATE).length, 1);
  assert.deepEqual(
    templates.filter((value) => value !== CAPABILITIES_URI_TEMPLATE),
    MATCHING_TASK_RESOURCE_TEMPLATES,
  );

  const capabilityResource = await lifecycle.client.readResource({
    uri: `studio://projects/${PROJECT_ID}/capabilities`,
  });
  const capabilities = JSON.parse(capabilityResource.contents[0].text);
  assert.equal(capabilities.kind, AUTHORING_V2_CAPABILITIES_KIND);
  assert.equal(capabilities.projectId, PROJECT_ID);
  assert.equal(capabilities.branchRevision, fixture.baseRevision);
  assert.equal(capabilities.profile.fingerprint, NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT);
  assert.deepEqual(capabilities.profile.manifest, NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST);
  assert.doesNotMatch(JSON.stringify(capabilities), /bindingId|grant\.task|task\.authoring|branch\.authoring|token/i);

  const command = adoptionCommand({
    inputArtifact: fixture.inputArtifact,
    outputArtifact: fixture.outputArtifact,
    baseRevision: fixture.baseRevision,
  });
  const before = persistedState(fixture.filename);
  const dryRun = await lifecycle.client.callTool({
    name: AUTHORING_V2_PROCESSING_RESULT_ADOPTION_TOOL,
    arguments: toolArguments(command, true),
  });
  assert.equal(dryRun.isError, undefined, JSON.stringify(dryRun));
  assert.equal(dryRun.structuredContent.status, 'READY');
  assert.equal(dryRun.structuredContent.plan.status, 'READY_FOR_ATOMIC_UNIT_OF_WORK');
  assert.deepEqual(persistedState(fixture.filename), before);

  const commit = await lifecycle.client.callTool({
    name: AUTHORING_V2_PROCESSING_RESULT_ADOPTION_TOOL,
    arguments: toolArguments(command, false),
  });
  assert.equal(commit.isError, undefined, JSON.stringify(commit));
  assert.equal(commit.structuredContent.asset.lifecycle, 'DRAFT');
  assert.equal(commit.structuredContent.branchRevision, fixture.baseRevision + 1);
  const committedState = persistedState(fixture.filename);
  assert.deepEqual(committedState, {
    ...before,
    taskHeadRevision: before.taskHeadRevision + 1,
    taskCommands: before.taskCommands + 1,
    branchRevisions: before.branchRevisions + 1,
    adoptions: before.adoptions + 1,
    adoptionReferences: before.adoptionReferences + 2,
    timeline: before.timeline + 1,
    activities: before.activities,
  });

  await lifecycle.client.close();
  lifecycle.client = null;
  await closeRunning(lifecycle.running);
  lifecycle.running = null;

  lifecycle.running = await startStudioHttpServer({
    dataDirectory: directory,
    host: '127.0.0.1',
    port: 0,
    clock: () => NOW,
  });
  serviceUrl = `http://127.0.0.1:${lifecycle.running.address.port}/`;
  const replayOnlyHandshake = await handshake(serviceUrl, fixture.token);
  assert.equal(replayOnlyHandshake.status, 200);
  assert.equal(replayOnlyHandshake.body.status, 'READY');
  assert.equal(replayOnlyHandshake.body.budgetState, 'REPLAY_ONLY');
  assert.equal(
    replayOnlyHandshake.body.profile.fingerprint,
    NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT,
  );

  lifecycle.client = await connectOfficialMcp(serviceUrl, fixture.token);
  assert.equal((await lifecycle.client.listTools()).tools.length, 31);
  assert.equal((await lifecycle.client.listResourceTemplates()).resourceTemplates.length, 6);

  const exhaustedCapabilityResource = await lifecycle.client.readResource({
    uri: `studio://projects/${PROJECT_ID}/capabilities`,
  });
  const exhaustedCapabilities = JSON.parse(exhaustedCapabilityResource.contents[0].text);
  assert.equal(exhaustedCapabilities.status, 'ERROR');
  assert.equal(exhaustedCapabilities.error.code, 'BUDGET_EXCEEDED');

  const alias = structuredClone(command);
  alias.commandId = 'command.authoring-v2.official-mcp.replay-alias';
  const replay = await lifecycle.client.callTool({
    name: AUTHORING_V2_PROCESSING_RESULT_ADOPTION_TOOL,
    arguments: toolArguments(alias, false),
  });
  assert.equal(replay.isError, undefined, JSON.stringify(replay));
  assert.deepEqual(replay.structuredContent, commit.structuredContent);
  assert.deepEqual(persistedState(fixture.filename), committedState);

  const newSemanticCommand = structuredClone(command);
  newSemanticCommand.commandId = 'command.authoring-v2.official-mcp.new-semantic';
  newSemanticCommand.idempotencyKey = 'idempotency.authoring-v2.official-mcp.new-semantic';
  newSemanticCommand.baseRevision = fixture.baseRevision + 1;
  newSemanticCommand.expectedVersion = fixture.baseRevision + 1;
  newSemanticCommand.payload.preflightRequest.project.expectedRevision = fixture.baseRevision + 1;
  const blocked = await lifecycle.client.callTool({
    name: AUTHORING_V2_PROCESSING_RESULT_ADOPTION_TOOL,
    arguments: toolArguments(newSemanticCommand, false),
  });
  assert.equal(blocked.isError, true);
  assert.equal(blocked.structuredContent.error.code, 'BUDGET_EXCEEDED');
  assert.deepEqual(persistedState(fixture.filename), committedState);
});

test('revocation keeps running discovery static while every fresh operation and child startup fail closed', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-authoring-v2-official-revocation-'));
  const lifecycle = { running: null, client: null, rejectedChild: null };
  afterTestCleanup(context, () => rm(directory, { recursive: true, force: true }));
  afterTestCleanup(context, () => closeRunning(lifecycle.running));
  afterTestCleanup(context, () => lifecycle.client?.close().catch(() => {}));
  afterTestCleanup(context, () => {
    if (lifecycle.rejectedChild?.exitCode === null) lifecycle.rejectedChild.kill('SIGTERM');
  });

  const fixture = await provision(directory);
  lifecycle.running = await startStudioHttpServer({
    dataDirectory: directory,
    host: '127.0.0.1',
    port: 0,
    clock: () => NOW,
  });
  const serviceUrl = `http://127.0.0.1:${lifecycle.running.address.port}/`;
  lifecycle.client = await connectOfficialMcp(serviceUrl, fixture.token);

  const initialToolNames = (await lifecycle.client.listTools()).tools.map(({ name }) => name).sort();
  assert.deepEqual(initialToolNames, [
    ...MATCHING_TASK_TOOL_NAMES,
    AUTHORING_V2_PROCESSING_RESULT_ADOPTION_TOOL,
  ].sort());
  const initialTemplates = (await lifecycle.client.listResourceTemplates()).resourceTemplates
    .map(({ uriTemplate }) => uriTemplate).sort();
  assert.deepEqual(initialTemplates, [
    ...MATCHING_TASK_RESOURCE_TEMPLATES,
    CAPABILITIES_URI_TEMPLATE,
  ].sort());

  const project = await lifecycle.running.studioService.readProjectTrusted(PROJECT_ID);
  await lifecycle.running.studioService.execute(command({
    commandId: 'command.authoring-v2.official-mcp.revoke-grant',
    idempotencyKey: 'idempotency.authoring-v2.official-mcp.revoke-grant',
    type: 'grant.revoke',
    expectedVersion: project.revision,
    payload: {
      grantId: `grant.task.${TASK_ID}`,
      reason: 'Prove fresh denial without changing the negotiated MCP discovery surface.',
    },
  }), OWNER_CONTEXT);

  assert.deepEqual(
    (await lifecycle.client.listTools()).tools.map(({ name }) => name).sort(),
    initialToolNames,
  );
  assert.deepEqual(
    (await lifecycle.client.listResourceTemplates()).resourceTemplates
      .map(({ uriTemplate }) => uriTemplate).sort(),
    initialTemplates,
  );

  const deniedCapabilityResource = await lifecycle.client.readResource({
    uri: `studio://projects/${PROJECT_ID}/capabilities`,
  });
  const deniedCapabilities = JSON.parse(deniedCapabilityResource.contents[0].text);
  assert.equal(deniedCapabilities.status, 'ERROR');
  assert.equal(deniedCapabilities.error.code, 'GRANT_REVOKED');

  const deniedCommand = adoptionCommand({
    inputArtifact: fixture.inputArtifact,
    outputArtifact: fixture.outputArtifact,
    baseRevision: fixture.baseRevision,
  });
  const deniedAdoption = await lifecycle.client.callTool({
    name: AUTHORING_V2_PROCESSING_RESULT_ADOPTION_TOOL,
    arguments: toolArguments(deniedCommand, true),
  });
  assert.equal(deniedAdoption.isError, true);
  assert.equal(deniedAdoption.structuredContent.error.code, 'GRANT_REVOKED');
  assert.equal(persistedState(fixture.filename).adoptions, 0);

  assert.deepEqual(
    lifecycle.running.agentAttemptStore.listForProject(PROJECT_ID).map(({ commandType, status }) => ({
      commandType,
      status,
    })),
    [
      { commandType: 'authoring-v2.capabilities.read', status: 'DENIED' },
      { commandType: 'asset.processing-result.adopt', status: 'DENIED' },
    ],
  );

  const stdout = [];
  const stderr = [];
  lifecycle.rejectedChild = spawn(
    process.execPath,
    [resolve(studioRoot, 'apps/studio-mcp/src/main.js')],
    {
      cwd: studioRoot,
      env: mcpChildEnvironment({ serviceUrl, token: fixture.token }),
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
  lifecycle.rejectedChild.stdout.on('data', (chunk) => stdout.push(chunk));
  lifecycle.rejectedChild.stderr.on('data', (chunk) => stderr.push(chunk));
  lifecycle.rejectedChild.stdin.write(`${JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2026-07-28',
      capabilities: {},
      clientInfo: { name: 'revoked-authoring-v2-probe', version: '1.0.0' },
    },
  })}\n`);
  lifecycle.rejectedChild.stdin.end();
  const exit = await new Promise((resolveExit, rejectExit) => {
    const timeout = setTimeout(() => {
      lifecycle.rejectedChild.kill('SIGTERM');
      rejectExit(new Error('Revoked Authoring-v2 MCP child did not fail closed during startup.'));
    }, 5_000);
    lifecycle.rejectedChild.once('error', (error) => {
      clearTimeout(timeout);
      rejectExit(error);
    });
    lifecycle.rejectedChild.once('exit', (code, signal) => {
      clearTimeout(timeout);
      resolveExit({ code, signal });
    });
  });
  const stdoutText = Buffer.concat(stdout).toString('utf8');
  const stderrText = Buffer.concat(stderr).toString('utf8');
  assert.notEqual(exit.code, 0, `revoked child unexpectedly served MCP: ${stderrText}`);
  assert.equal(exit.signal, null);
  assert.equal(stdoutText, '', 'startup denial must not emit an MCP fallback or non-protocol stdout');
  assert.match(stderrText, /MCP_STARTUP_FAILED|GRANT_REVOKED|AUTHORING_V2/);
  assert.doesNotMatch(
    stderrText,
    new RegExp([
      fixture.token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'grant\\.task',
      'binding\\.',
      'task\\.authoring',
      'branch\\.authoring',
      'file://',
      '/workspace/',
      '\\bat \\w',
    ].join('|'), 'i'),
  );

  const attempts = lifecycle.running.agentAttemptStore.listForProject(PROJECT_ID);
  assert.deepEqual(attempts.map(({ commandType, status }) => ({ commandType, status })), [
    { commandType: 'authoring-v2.capabilities.read', status: 'DENIED' },
    { commandType: 'asset.processing-result.adopt', status: 'DENIED' },
    { commandType: 'authoring-v2.surface.negotiate', status: 'DENIED' },
  ]);
});
