import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { listCommandDefinitions } from '../packages/domain/src/index.js';
import { buildOfficialMcpServer, createAgentToolCatalog } from '../packages/mcp-server/src/index.js';

function gateway() {
  const calls = [];
  return {
    calls,
    commandCatalog: listCommandDefinitions(),
    agentAttemptAuditReady: true,
    durableJobStoreReady: true,
    durableAssetStoreReady: true,
    durableRoomStoreReady: true,
    taskBranchReady: true,
    async execute(command) { calls.push(['execute', command]); return { schemaVersion: 1, branchRevision: command.baseRevision + 1 }; },
    async readProject({ projectId }) { return { schemaVersion: 1, projectId }; },
    async proposeAtlasGrid(request) { return request; },
    async readJob(request) { return request; },
    async cancelJob(request) { return request; },
    async retryJob(request) { return request; },
    async discardJob(request) { return request; },
    async queryAssets(request) { return request; },
    async queryRooms(request) { return request; },
    async readTask(request) { calls.push(['task-read', request]); return { schemaVersion: 1, task: { taskId: 'task.bound' } }; },
    async submitTaskForReview(request) { calls.push(['task-submit', request]); return { schemaVersion: 1, review: { reviewId: request.reviewId } }; },
  };
}

test('Checkpoint 4 MCP exposes the complete branch-safe room path and bound task controls', async () => {
  const studioGateway = gateway();
  const tools = createAgentToolCatalog(studioGateway, {
    contextProvider: async () => ({ projectId: 'project.one' }),
  });
  assert.equal(tools.length, 30);
  const names = new Set(tools.map(({ name }) => name));
  for (const name of [
    'studio_room_archetype_create', 'studio_room_variant_create',
    'studio_room_variant_intent_set', 'studio_room_variant_resize',
    'studio_room_variant_connectors_set', 'studio_room_variant_placements_add',
    'studio_room_variant_placements_move', 'studio_room_variant_placements_remove',
    'studio_room_variant_validate', 'studio_task_read', 'studio_task_submit_for_review',
  ]) assert.ok(names.has(name), `${name} must be exposed on a task-bound MCP host.`);
  for (const name of [
    'studio_room_variant_finalize', 'studio_room_variant_warning_disposition_set',
    'studio_asset_lifecycle_set', 'studio_grant_issue', 'studio_grant_revoke',
    'studio_task_merge_revert',
  ]) assert.ok(!names.has(name), `${name} must remain human-only.`);

  const resize = tools.find(({ name }) => name === 'studio_room_variant_resize');
  await resize.execute({
    schemaVersion: 1,
    commandId: 'cmd.resize',
    idempotencyKey: 'idem.resize',
    projectId: 'project.one',
    baseRevision: 7,
    expectedVersion: 7,
    payload: {
      roomVariantId: 'room.one', expectedRoomVariantVersion: 1,
      width: 8, height: 8, removePlacementIds: [], removeConnectorIds: [],
    },
  }, {});
  assert.equal(studioGateway.calls[0][0], 'execute');
  assert.equal(studioGateway.calls[0][1].type, 'room.variant.resize');

  const read = tools.find(({ name }) => name === 'studio_task_read');
  const task = await read.execute({ schemaVersion: 1, projectId: 'project.one' }, {});
  assert.equal(task.task.taskId, 'task.bound');
  const submit = tools.find(({ name }) => name === 'studio_task_submit_for_review');
  const review = await submit.execute({ schemaVersion: 1, projectId: 'project.one', reviewId: 'review.one' }, {});
  assert.equal(review.review.reviewId, 'review.one');
});

test('Checkpoint 3 MCP surface stays unchanged when no task branch is bound', () => {
  const studioGateway = gateway();
  studioGateway.taskBranchReady = false;
  const tools = createAgentToolCatalog(studioGateway, { contextProvider: async () => ({ projectId: 'project.one' }) });
  assert.equal(tools.length, 19);
  assert.ok(!tools.some(({ name }) => name.startsWith('studio_task_')));
  assert.ok(!tools.some(({ name }) => name === 'studio_room_variant_resize'));
});

test('Checkpoint 4 official discovery adds one bound task resource and keeps task identity out of its URI', async (context) => {
  const studioGateway = gateway();
  const server = buildOfficialMcpServer({
    studioGateway,
    contextProvider: async () => ({ projectId: 'project.one' }),
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'checkpoint-4-contract', version: '1.0.0' });
  await client.connect(clientTransport);
  context.after(async () => { await client.close(); await server.close(); });
  assert.equal((await client.listTools()).tools.length, 30);
  assert.deepEqual((await client.listResourceTemplates()).resourceTemplates.map(({ uriTemplate }) => uriTemplate).sort(), [
    'studio://projects/{projectId}',
    'studio://projects/{projectId}/assets/{assetId}',
    'studio://projects/{projectId}/jobs/{jobId}',
    'studio://projects/{projectId}/rooms/{roomVariantId}',
    'studio://projects/{projectId}/task',
  ]);
  const resource = await client.readResource({ uri: 'studio://projects/project.one/task' });
  const value = JSON.parse(resource.contents[0].text);
  assert.equal(value.task.taskId, 'task.bound');
  assert.deepEqual(studioGateway.calls.at(-1), ['task-read', { schemaVersion: 1, projectId: 'project.one' }]);
});
