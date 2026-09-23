import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { AgentTaskService, StudioService, AUTHORING_V2_SURFACE_NEGOTIATION_KIND } from '../packages/application/src/index.js';
import { AUTHORING_V2_COMMAND_FEATURES, AUTHORING_V2_FEATURE_ID, listCommandDefinitions } from '../packages/domain/src/index.js';
import { NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT, NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST } from '../packages/numberdroid-adapter/src/index.js';
import { buildOfficialMcpServer, createAgentToolCatalog, jsonSchemaToZod } from '../packages/mcp-server/src/index.js';
import { SqliteAgentTaskStore, SqliteProjectStore, TaskBranchProjectStore } from '../packages/persistence/src/index.js';
import { AGENT, OWNER_CONTEXT, command } from './test-helpers.js';
import { afterTestCleanup, nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';

const PROJECT_ID = 'project.surfaces';
const TOOL = 'studio_room_variant_surfaces_apply';
const contextProvider = async () => ({ projectId: PROJECT_ID });

function authoringV2() {
  const manifest = NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST;
  const fingerprint = NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT;
  return {
    projectId: PROJECT_ID, expectedProfileFingerprint: fingerprint,
    negotiation: {
      schemaVersion: 2, kind: AUTHORING_V2_SURFACE_NEGOTIATION_KIND, status: 'READY',
      featureId: AUTHORING_V2_FEATURE_ID, projectId: PROJECT_ID, branchRevision: 17, budgetState: 'AVAILABLE',
      profile: { profileId: manifest.profileId, profileVersion: manifest.profileVersion, fingerprint },
      commandFeatures: structuredClone(AUTHORING_V2_COMMAND_FEATURES),
    },
  };
}

function gateway() {
  const calls = [];
  return {
    calls, commandCatalog: listCommandDefinitions(),
    agentAttemptAuditReady: true, durableJobStoreReady: true,
    durableAssetStoreReady: true, durableRoomStoreReady: true, taskBranchReady: false,
    async execute(command, context, options) { calls.push(['execute', command, context, options]); return command; },
    async readProject(request) { return request; },
    async proposeAtlasGrid(request) { return request; },
    async readJob(request) { return request; },
    async cancelJob(request) { return request; },
    async retryJob(request) { return request; },
    async discardJob(request) { return request; },
    async queryAssets(request) { return request; },
    async queryRooms(request, context) { calls.push(['rooms', request, context]); return request; },
    async readTask(request) { return request; },
    async submitTaskForReview(request) { return request; },
    async readAuthoringV2Capabilities(request) { return request; },
    async adoptProcessingResult(request) { return request; },
  };
}

function options(overrides = {}) {
  return { contextProvider, authoringV2: authoringV2(), protocolFeatureSet: 'surfaces-v1', ...overrides };
}

function input() {
  return {
    schemaVersion: 1, commandId: 'cmd.surface', idempotencyKey: 'idem.surface',
    projectId: PROJECT_ID, baseRevision: 17, expectedVersion: 17, dryRun: true,
    payload: {
      roomVariantId: 'room.one', expectedRoomVariantVersion: 1, plannerVersion: 'surface-planner.v1',
      scopeCells: [{ x: 0, y: 0 }], policy: 'empty_only',
      pool: [{ assetId: 'asset.floor', assetVersion: 1, metadataVersion: 1 }],
      baseRotation: 0, randomRotation: false, seed: 'seed.one', placementIdPrefix: 'surface.paint',
      overlapKeepPlacementIds: [], planFingerprint: '0'.repeat(64),
    },
  };
}

test('Surface mapping is an exact explicit 32-tool extension; 19/30/31 remain unchanged and Undo absent', async () => {
  const service = gateway();
  const legacy = createAgentToolCatalog(service, { contextProvider });
  assert.equal(legacy.length, 19);
  service.taskBranchReady = true;
  const task = createAgentToolCatalog(service, { contextProvider });
  assert.equal(task.length, 30);
  const v2 = createAgentToolCatalog(service, options({ protocolFeatureSet: null }));
  assert.equal(v2.length, 31);
  const selected = createAgentToolCatalog(service, options());
  assert.equal(selected.length, 32);
  assert.deepEqual(selected.map(t => t.name).sort(), [...v2.map(t => t.name), TOOL].sort());
  for (const catalog of [legacy, task, v2, selected]) {
    assert.equal(catalog.some(t => t.name === 'studio_room_variant_surfaces_undo'), false);
  }
  for (const catalog of [legacy, task, v2]) assert.equal(catalog.some(t => t.name === TOOL), false);
  const definitions = await selected.find(t => t.name === 'studio_command_catalog_list').execute({ projectId: PROJECT_ID });
  assert.equal(definitions.commands.filter(d => d.mcpProfile === 'surfaces-v1').length, 1);
});

test('Surface selection fails closed without valid v2 negotiation or exact scoped Apply definition', () => {
  for (const protocolFeatureSet of ['', false, 'surfaces-v2', {}]) {
    assert.throws(() => createAgentToolCatalog(gateway(), options({ protocolFeatureSet })), { code: 'MCP_FEATURE_SET_UNSUPPORTED' });
  }
  assert.throws(() => createAgentToolCatalog(gateway(), options({ authoringV2: null })), { code: 'SURFACES_NEGOTIATION_REQUIRED' });
  const invalid = authoringV2();
  invalid.negotiation.status = 'DENIED';
  assert.throws(() => createAgentToolCatalog(gateway(), options({ authoringV2: invalid })));
  for (const change of [{ requiredScope: 'project.read' }, { requiresTaskBranch: false }, { requiresDurableRoomStore: false }, { ownerOnly: true }]) {
    const service = gateway();
    service.commandCatalog = service.commandCatalog.map(d => d.type === 'room.variant.surfaces.apply' ? { ...d, ...change } : d);
    assert.throws(() => createAgentToolCatalog(service, options()), { code: 'SURFACES_SURFACE_BASELINE_MISMATCH' });
  }
  const service = gateway();
  service.commandCatalog = [...service.commandCatalog, { ...service.commandCatalog.find(d => d.type === 'room.variant.surfaces.apply'), type: 'room.variant.surfaces.future', toolName: 'studio_surface_future' }];
  assert.equal(createAgentToolCatalog(service, options()).length, 32, 'The profile marker must not expose an unreviewed future operation.');
});

test('Surface schema fixes authority outside arguments and maps unchanged dryRun to the shared task command', async () => {
  const service = gateway();
  const tool = createAgentToolCatalog(service, options()).find(t => t.name === TOOL);
  const schema = jsonSchemaToZod(tool.inputSchema);
  assert.equal(schema.safeParse(input()).success, true);
  for (const field of ['actor', 'grantId', 'taskId', 'branchId', 'protocolFeatureSet']) {
    assert.equal(schema.safeParse({ ...input(), [field]: 'forged' }).success, false);
    assert.equal(schema.safeParse({ ...input(), payload: { ...input().payload, [field]: 'forged' } }).success, false);
  }
  const signal = new AbortController().signal;
  const result = await tool.execute(input(), { mcpReq: { signal } });
  assert.deepEqual(result, { ...input(), type: 'room.variant.surfaces.apply' });
  assert.deepEqual(service.calls.at(-1), ['execute', result, { projectId: PROJECT_ID }, { signal }]);
  await assert.rejects(tool.execute({ ...input(), projectId: 'project.other' }), { code: 'CONTEXT_PROJECT_MISMATCH' });
  assert.equal(service.calls.length, 1);
  const drifted = createAgentToolCatalog(service, options({ contextProvider: async () => ({ projectId: 'project.other' }) })).find(t => t.name === TOOL);
  await assert.rejects(drifted.execute({ ...input(), projectId: 'project.other' }), { code: 'CONTEXT_PROJECT_MISMATCH' });
  assert.equal(service.calls.length, 1);
  const withoutDryRun = input();
  delete withoutDryRun.dryRun;
  assert.equal((await tool.execute(withoutDryRun)).dryRun, false, 'Existing mutation-envelope default remains unchanged.');
});

test('Official Surface discovery adds one tool, reuses all six resources, and rejects caller authority', async context => {
  const service = gateway();
  const server = buildOfficialMcpServer({ studioGateway: service, ...options() });
  const client = new Client({ name: 'surface-mcp-contract', version: '1.0.0' });
  context.after(async () => { await client.close(); await server.close(); });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  assert.equal((await client.listTools()).tools.length, 32);
  assert.deepEqual((await client.listResourceTemplates()).resourceTemplates.map(t => t.uriTemplate).sort(), [
    'studio://projects/{projectId}', 'studio://projects/{projectId}/assets/{assetId}',
    'studio://projects/{projectId}/capabilities', 'studio://projects/{projectId}/jobs/{jobId}',
    'studio://projects/{projectId}/rooms/{roomVariantId}', 'studio://projects/{projectId}/task',
  ].sort());
  await client.readResource({ uri: `studio://projects/${PROJECT_ID}/rooms/room.one` });
  assert.equal(service.calls.at(-1)[0], 'rooms');
  assert.equal(service.calls.at(-1)[1].roomVariantId, 'room.one');
  assert.equal((await client.callTool({ name: TOOL, arguments: input() })).isError, undefined);
  const count = service.calls.length;
  assert.equal((await client.callTool({ name: TOOL, arguments: { ...input(), grantId: 'forged' } })).isError, true);
  assert.equal(service.calls.length, count);
});

test('Surface mapping reaches real task scope and branch checks without creating a revision or charge', async context => {
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-surfaces-mcp-'));
  afterTestCleanup(context, () => rm(directory, { recursive: true, force: true }));
  const store = await SqliteProjectStore.open({ filename: join(directory, 'studio.sqlite'), databaseFactory: nodeSqliteDatabaseFactory });
  afterTestCleanup(context, () => store.close());
  const clock = () => '2026-09-23T06:00:00.000Z';
  const studio = new StudioService({ store, clock, agentAttemptAuditReady: true });
  await studio.execute(command({ projectId: PROJECT_ID }), OWNER_CONTEXT);
  const taskStore = new SqliteAgentTaskStore({ workspace: store.workspace });
  const tasks = new AgentTaskService({ studioService: studio, projectStore: store, taskStore, clock,
    createBranchStore: ({ projectId, taskId }) => new TaskBranchProjectStore({ taskStore, projectId, taskId }),
  });
  const { task } = await tasks.createTask({ projectId: PROJECT_ID, task: {
    taskId: 'task.surface', branchId: 'branch.task.surface', agentId: AGENT.id,
    title: 'Surface authority fixture', objective: 'Prove an MCP feature selector does not confer room.edit.',
    capabilities: ['project.read'], objectScopes: [{ kind: 'project', id: PROJECT_ID }],
    budget: { maxCommands: 2, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 },
    expiresAt: '2026-09-24T06:00:00.000Z', autoAcceptPolicy: { enabled: false, allowedCommandTypes: [], maxChanges: 0 },
  } }, OWNER_CONTEXT);
  const trustedContext = { projectId: PROJECT_ID, actor: AGENT, taskId: task.taskId, branchId: task.branchId, grantId: task.grantId };
  const before = await tasks.readBranch(PROJECT_ID, task.taskId, trustedContext);
  const mainBefore = await studio.readProjectTrusted(PROJECT_ID);
  const makeTool = contextValue => createAgentToolCatalog(gateway(), options({ agentTaskService: tasks, contextProvider: async () => contextValue })).find(t => t.name === TOOL);
  for (const dryRun of [true, false]) {
    await assert.rejects(makeTool(trustedContext).execute({ ...input(), dryRun }), error => error.code === 'TASK_CAPABILITY_MISSING' && error.details.requiredScope === 'room.edit');
  }
  await assert.rejects(makeTool({ ...trustedContext, branchId: 'branch.main' }).execute(input()), { code: 'TASK_BRANCH_MISMATCH' });
  await assert.rejects(makeTool({ ...trustedContext, grantId: 'grant.foreign' }).execute(input()), { code: 'TASK_GRANT_MISMATCH' });
  await assert.rejects(makeTool({ ...trustedContext, actor: { ...AGENT, id: 'agent.other' } }).execute(input()), { code: 'TASK_ACTOR_MISMATCH' });
  assert.deepEqual(await tasks.readBranch(PROJECT_ID, task.taskId, trustedContext), before);
  assert.deepEqual(await studio.readProjectTrusted(PROJECT_ID), mainBefore);
  assert.equal(taskStore.listBranchRevisions(PROJECT_ID, task.taskId).length, 0);
});
