import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { LocalStudioGateway } from '../apps/studio-mcp/src/local-studio-gateway.js';
import { createStudioHttpServer } from '../apps/studio-server/src/server.js';
import { listCommandDefinitions, StudioError } from '../packages/domain/src/index.js';
import { buildOfficialMcpServer, createAgentToolCatalog } from '../packages/mcp-server/src/index.js';

const PROJECT_ID = 'project.family-hygiene';
const ASSET_ID = 'asset.family.1';
const DIGEST = 'e'.repeat(64);

const ACCEPTED_TOOL_NAMES = [
  'studio_asset_define',
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
  'studio_source_intake_commit',
  'studio_source_register',
  'studio_source_review_propose',
];

function gatewayFixture({ durableAssetStoreReady, durableRoomStoreReady = false }) {
  const queries = [];
  return {
    queries,
    commandCatalog: listCommandDefinitions(),
    agentAttemptAuditReady: true,
    durableJobStoreReady: true,
    durableAssetStoreReady,
    durableRoomStoreReady,
    async execute(command) { return { schemaVersion: 1, projectId: command.projectId, revision: 2 }; },
    async readProject({ projectId }) { return { schemaVersion: 1, projectId, revision: 1, snapshot: {} }; },
    async proposeAtlasGrid() { return {}; },
    async readJob(request) { return { schemaVersion: 1, projectId: request.projectId, job: { jobId: request.jobId } }; },
    async cancelJob() { return {}; },
    async retryJob() { return {}; },
    async discardJob() { return {}; },
    async queryAssets(request) {
      queries.push(structuredClone(request));
      if (request.assetId && request.assetId !== ASSET_ID) {
        throw new StudioError('ASSET_NOT_FOUND', 'The V2 asset does not exist.', { assetId: request.assetId });
      }
      return {
        schemaVersion: 1,
        projectId: request.projectId,
        revision: 9,
        filters: { assetId: request.assetId ?? null },
        assets: request.assetId === ASSET_ID ? [{ assetId: ASSET_ID, name: 'Family Hygiene 1' }] : [],
        proposals: [],
      };
    },
    async queryRooms(request) {
      queries.push(structuredClone(request));
      if (request.roomVariantId && request.roomVariantId !== 'room.family-table') {
        throw new StudioError('ROOM_VARIANT_NOT_FOUND', 'The room variant does not exist.', { roomVariantId: request.roomVariantId });
      }
      return {
        schemaVersion: 1,
        projectId: request.projectId,
        revision: 10,
        filters: { roomVariantId: request.roomVariantId ?? null },
        archetypes: [],
        variants: request.roomVariantId === 'room.family-table' ? [{ roomVariantId: 'room.family-table', headVersion: 1 }] : [],
        proposals: [],
      };
    },
  };
}

async function mcpClient(context, gateway) {
  const server = buildOfficialMcpServer({
    studioGateway: gateway,
    contextProvider: async () => ({ projectId: PROJECT_ID }),
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'checkpoint-2c-contract', version: '1.0.0' });
  await client.connect(clientTransport);
  context.after(async () => {
    await client.close();
    await server.close();
  });
  return client;
}

test('pre-v9 MCP discovery stays exactly at the accepted 15 tools and two templates', async (context) => {
  const gateway = gatewayFixture({ durableAssetStoreReady: false });
  const catalog = createAgentToolCatalog(gateway, { contextProvider: async () => ({ projectId: PROJECT_ID }) });
  assert.deepEqual(catalog.map(({ name }) => name).sort(), ACCEPTED_TOOL_NAMES);

  const client = await mcpClient(context, gateway);
  assert.deepEqual((await client.listTools()).tools.map(({ name }) => name).sort(), ACCEPTED_TOOL_NAMES);
  assert.deepEqual((await client.listResourceTemplates()).resourceTemplates.map(({ uriTemplate }) => uriTemplate).sort(), [
    'studio://projects/{projectId}',
    'studio://projects/{projectId}/jobs/{jobId}',
  ]);
});

test('v9 MCP discovery is exactly 17 tools and three templates with owner controls absent', async (context) => {
  const gateway = gatewayFixture({ durableAssetStoreReady: true });
  const client = await mcpClient(context, gateway);
  const tools = (await client.listTools()).tools;
  assert.deepEqual(tools.map(({ name }) => name).sort(), [
    ...ACCEPTED_TOOL_NAMES,
    'studio_asset_proposal_submit',
    'studio_asset_query',
  ].sort());
  assert.ok(!tools.some(({ name }) => [
    'studio_asset_proposal_decide',
    'studio_asset_proposal_apply',
    'studio_asset_lifecycle_set',
  ].includes(name)));
  const query = tools.find(({ name }) => name === 'studio_asset_query');
  assert.equal(query.inputSchema.additionalProperties, false);
  assert.deepEqual(query.inputSchema.required, ['schemaVersion', 'projectId']);
  assert.equal(query.annotations.readOnlyHint, true);

  assert.deepEqual((await client.listResourceTemplates()).resourceTemplates.map(({ uriTemplate }) => uriTemplate).sort(), [
    'studio://projects/{projectId}',
    'studio://projects/{projectId}/assets/{assetId}',
    'studio://projects/{projectId}/jobs/{jobId}',
  ]);
  const resource = await client.readResource({ uri: `studio://projects/${PROJECT_ID}/assets/${ASSET_ID}` });
  const value = JSON.parse(resource.contents[0].text);
  assert.equal(value.assets[0].assetId, ASSET_ID);
  assert.deepEqual(gateway.queries, [{
    schemaVersion: 1,
    projectId: PROJECT_ID,
    assetId: ASSET_ID,
    includeProposals: false,
    limit: 1,
  }]);
  const missing = await client.readResource({ uri: `studio://projects/${PROJECT_ID}/assets/asset.missing` });
  const missingValue = JSON.parse(missing.contents[0].text);
  assert.deepEqual(missingValue, {
    schemaVersion: 1,
    status: 'ERROR',
    error: {
      code: 'ASSET_NOT_FOUND',
      message: 'The V2 asset does not exist.',
      details: { assetId: 'asset.missing' },
    },
  });
});

test('v10 MCP discovery is exactly 19 tools and four templates with placement-only agent mutation', async (context) => {
  const gateway = gatewayFixture({ durableAssetStoreReady: true, durableRoomStoreReady: true });
  const client = await mcpClient(context, gateway);
  const tools = (await client.listTools()).tools;
  assert.deepEqual(tools.map(({ name }) => name).sort(), [
    ...ACCEPTED_TOOL_NAMES,
    'studio_asset_proposal_submit',
    'studio_asset_query',
    'studio_room_placement_proposal_submit',
    'studio_room_query',
  ].sort());
  assert.ok(!tools.some(({ name }) => [
    'studio_room_archetype_create',
    'studio_room_variant_create',
    'studio_room_variant_connectors_set',
    'studio_room_variant_placements_add',
    'studio_room_placement_proposal_decide',
    'studio_room_placement_proposal_apply',
    'studio_room_variant_validate',
    'studio_room_variant_finalize',
    'studio_room_variant_fork',
  ].includes(name)));
  const query = tools.find(({ name }) => name === 'studio_room_query');
  assert.equal(query.annotations.readOnlyHint, true);
  const submit = tools.find(({ name }) => name === 'studio_room_placement_proposal_submit');
  assert.equal(submit.annotations.readOnlyHint, false);
  assert.equal(submit.inputSchema.properties.payload.additionalProperties, false);
  assert.deepEqual((await client.listResourceTemplates()).resourceTemplates.map(({ uriTemplate }) => uriTemplate).sort(), [
    'studio://projects/{projectId}',
    'studio://projects/{projectId}/assets/{assetId}',
    'studio://projects/{projectId}/jobs/{jobId}',
    'studio://projects/{projectId}/rooms/{roomVariantId}',
  ]);
  const resource = await client.readResource({ uri: `studio://projects/${PROJECT_ID}/rooms/room.family-table` });
  const value = JSON.parse(resource.contents[0].text);
  assert.equal(value.variants[0].roomVariantId, 'room.family-table');
  assert.deepEqual(gateway.queries.at(-1), {
    schemaVersion: 1,
    projectId: PROJECT_ID,
    roomVariantId: 'room.family-table',
    includeVersions: true,
    includeProposals: true,
    limit: 1,
  });
});

async function listen(context, server) {
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  context.after(() => new Promise((resolveClose) => server.close(resolveClose)));
  return `http://127.0.0.1:${server.address().port}`;
}

function httpStudioFixture() {
  const commands = [];
  const queries = [];
  return {
    commands,
    queries,
    commandCatalog: listCommandDefinitions(),
    durableAssetStoreReady: true,
    durableRoomStoreReady: true,
    async readProjectTrusted(projectId) {
      return {
        schemaVersion: 1,
        projectId,
        revision: 8,
        snapshot: { project: { ownerId: 'owner.family' }, grants: [], sources: [], assets: [] },
      };
    },
    async queryAssets(request, context) {
      queries.push({ request: structuredClone(request), actor: structuredClone(context.actor) });
      if (request.assetId && request.assetId !== ASSET_ID) {
        throw new StudioError('ASSET_NOT_FOUND', 'The V2 asset does not exist.', { assetId: request.assetId });
      }
      return {
        schemaVersion: 1,
        projectId: request.projectId,
        revision: 8,
        filters: {},
        assets: [{
          assetId: ASSET_ID,
          name: 'Family Hygiene 1',
          sliceBinding: { digest: DIGEST, mediaType: 'image/png' },
        }],
        proposals: [{
          proposalId: 'proposal.family',
          items: [{
            itemId: 'item.family.1',
            name: 'Family Hygiene 1',
            sliceBinding: { digest: DIGEST, mediaType: 'image/png' },
          }],
        }],
      };
    },
    async queryRooms(request, context) {
      queries.push({ request: structuredClone(request), actor: structuredClone(context.actor) });
      return {
        schemaVersion: 1, projectId: request.projectId, revision: 8, filters: {}, archetypes: [],
        variants: [{ roomVariantId: 'room.family-table', headVersion: 1, current: { roomVariantId: 'room.family-table', placements: [] } }],
        proposals: [],
      };
    },
    async execute(command, context) {
      commands.push({ command: structuredClone(command), actor: structuredClone(context.actor) });
      return {
        schemaVersion: 1,
        projectId: command.projectId,
        revision: command.expectedVersion + 1,
        value: { type: command.type },
        event: { type: command.type },
        replayed: false,
      };
    },
  };
}

async function csrfHeaders(baseUrl) {
  const session = await fetch(`${baseUrl}/api/ui-session`).then((response) => response.json());
  return {
    'content-type': 'application/json',
    origin: baseUrl,
    'sec-fetch-site': 'same-origin',
    'x-numberdroid-studio-csrf': session.csrfToken,
  };
}

test('human asset query is exact-key bounded and projects only project-scoped CAS previews', async (context) => {
  const studio = httpStudioFixture();
  const baseUrl = await listen(context, createStudioHttpServer({ studioService: studio }));
  const response = await fetch(`${baseUrl}/api/projects/${PROJECT_ID}/assets/${ASSET_ID}?tags=family&tags=hygiene&includeProposals=true&limit=4`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(studio.queries[0], {
    request: {
      schemaVersion: 1,
      projectId: PROJECT_ID,
      assetId: ASSET_ID,
      tags: ['family', 'hygiene'],
      includeProposals: true,
      limit: 4,
    },
    actor: { id: 'owner.family', kind: 'human', displayName: 'Local designer' },
  });
  assert.equal(body.assets[0].preview.resourceUri, `/api/projects/${PROJECT_ID}/artifacts/sha256/${DIGEST}`);
  assert.equal(body.proposals[0].items[0].preview.resourceUri, `/api/projects/${PROJECT_ID}/artifacts/sha256/${DIGEST}`);

  const invalid = await fetch(`${baseUrl}/api/projects/${PROJECT_ID}/assets?grantId=forged`);
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error.code, 'VALIDATION_ERROR');
  const missing = await fetch(`${baseUrl}/api/projects/${PROJECT_ID}/assets/asset.missing`);
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error.code, 'ASSET_NOT_FOUND');
});

test('human asset mutations require same-origin CSRF, exact bodies, and explicit owner confirmation', async (context) => {
  const studio = httpStudioFixture();
  const baseUrl = await listen(context, createStudioHttpServer({ studioService: studio }));
  const headers = await csrfHeaders(baseUrl);
  const submitBody = {
    expectedRevision: 8,
    idempotencyKey: 'idem.asset.submit',
    proposalId: 'proposal.family',
    items: [{ itemId: 'item.family.1' }],
  };
  const noCsrf = await fetch(`${baseUrl}/api/projects/${PROJECT_ID}/asset-proposals`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(submitBody),
  });
  assert.equal(noCsrf.status, 403);
  assert.equal((await noCsrf.json()).error.code, 'UI_ORIGIN_REQUIRED');

  const cases = [
    [`/api/projects/${PROJECT_ID}/asset-proposals`, submitBody, 'asset.proposal.submit'],
    [`/api/projects/${PROJECT_ID}/asset-proposals/proposal.family/decision`, {
      expectedRevision: 9,
      idempotencyKey: 'idem.asset.decision',
      expectedProposalVersion: 1,
      decisions: [{ itemId: 'item.family.1', disposition: 'ACCEPTED', reason: null }],
      confirm: true,
    }, 'asset.proposal.decide'],
    [`/api/projects/${PROJECT_ID}/asset-proposals/proposal.family/apply`, {
      expectedRevision: 10,
      idempotencyKey: 'idem.asset.apply',
      expectedProposalVersion: 2,
      confirm: true,
    }, 'asset.proposal.apply'],
    [`/api/projects/${PROJECT_ID}/assets/${ASSET_ID}/lifecycle`, {
      expectedRevision: 11,
      idempotencyKey: 'idem.asset.lifecycle',
      expectedAssetVersion: 1,
      expectedMetadataVersion: 1,
      targetLifecycle: 'METADATA_COMPLETE',
      acceptedWarningFindingIds: [],
      confirm: true,
    }, 'asset.lifecycle.set'],
  ];
  for (const [path, body, expectedType] of cases) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST', headers, body: JSON.stringify(body),
    });
    assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
    assert.equal((await response.json()).value.type, expectedType);
  }
  assert.deepEqual(studio.commands.map(({ command }) => command.type), cases.map(([, , type]) => type));
  assert.ok(studio.commands.every(({ actor }) => actor.id === 'owner.family' && actor.kind === 'human'));
  assert.deepEqual(studio.commands[0].command.payload, {
    proposalId: 'proposal.family',
    expectedRevision: 8,
    items: [{ itemId: 'item.family.1' }],
  });

  const unconfirmed = await fetch(`${baseUrl}/api/projects/${PROJECT_ID}/asset-proposals/proposal.family/apply`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      expectedRevision: 12,
      idempotencyKey: 'idem.asset.apply.unconfirmed',
      expectedProposalVersion: 2,
      confirm: false,
    }),
  });
  assert.equal(unconfirmed.status, 403);
  assert.equal((await unconfirmed.json()).error.code, 'FORBIDDEN');

  const extraField = await fetch(`${baseUrl}/api/projects/${PROJECT_ID}/assets/${ASSET_ID}/lifecycle`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...cases[3][1], grantId: 'forged.grant' }),
  });
  assert.equal(extraField.status, 400);
  assert.equal((await extraField.json()).error.code, 'VALIDATION_ERROR');
});

test('human room routes are exact-key, CSRF-bound, and keep lifecycle/proposal decisions explicit', async (context) => {
  const studio = httpStudioFixture();
  const baseUrl = await listen(context, createStudioHttpServer({ studioService: studio }));
  const headers = await csrfHeaders(baseUrl);
  const query = await fetch(`${baseUrl}/api/projects/${PROJECT_ID}/rooms/room.family-table?includeVersions=true&includeProposals=true`);
  assert.equal(query.status, 200);
  assert.equal((await query.json()).variants[0].roomVariantId, 'room.family-table');
  assert.deepEqual(studio.queries.at(-1).request, {
    schemaVersion: 1, projectId: PROJECT_ID, roomVariantId: 'room.family-table',
    includeVersions: true, includeProposals: true,
  });

  const archetypeBody = {
    expectedRevision: 8, idempotencyKey: 'idem.room.archetype', roomArchetypeId: 'archetype.family',
    kind: 'room', displayName: 'Family room', tags: [], dimensionPolicy: {}, structuralBands: {},
    orientation: 'any', connectorPolicy: {}, allowedAssetKinds: [], allowedTags: [], requiredTags: [],
    rationality: 'domestic', governingRuleRefs: [],
  };
  const cases = [
    [`/api/projects/${PROJECT_ID}/room-archetypes`, archetypeBody, 'room.archetype.create'],
    [`/api/projects/${PROJECT_ID}/rooms`, {
      expectedRevision: 9, idempotencyKey: 'idem.room.create', roomVariantId: 'room.family-table',
      roomArchetypeId: 'archetype.family', archetypeVersion: 1, displayName: 'Family Table Room',
      width: 10, height: 8, intentTrace: [], connectors: [], placements: [],
    }, 'room.variant.create'],
    [`/api/projects/${PROJECT_ID}/rooms/room.family-table/connectors`, {
      expectedRevision: 10, idempotencyKey: 'idem.room.connectors', expectedRoomVariantVersion: 1, connectors: [],
    }, 'room.variant.connectors.set'],
    [`/api/projects/${PROJECT_ID}/room-proposals/proposal.room/decision`, {
      expectedRevision: 11, idempotencyKey: 'idem.room.decision', expectedProposalVersion: 1,
      decisions: [{ itemId: 'item.table', disposition: 'REJECTED', reason: 'Blocks the door.' }], confirm: true,
    }, 'room.placement.proposal.decide'],
    [`/api/projects/${PROJECT_ID}/rooms/room.family-table/finalize`, {
      expectedRevision: 12, idempotencyKey: 'idem.room.finalize', expectedRoomVariantVersion: 2, confirm: true,
    }, 'room.variant.finalize'],
  ];
  for (const [path, body, type] of cases) {
    const response = await fetch(`${baseUrl}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
    assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
    assert.equal((await response.json()).value.type, type);
  }
  assert.deepEqual(studio.commands.slice(-cases.length).map(({ command }) => command.type), cases.map(([, , type]) => type));
  const forged = await fetch(`${baseUrl}/api/projects/${PROJECT_ID}/rooms/room.family-table/validate`, {
    method: 'POST', headers,
    body: JSON.stringify({ expectedRevision: 13, idempotencyKey: 'idem.room.forged', expectedRoomVariantVersion: 2, confirm: true, grantId: 'forged' }),
  });
  assert.equal(forged.status, 400);
  const unconfirmed = await fetch(`${baseUrl}/api/projects/${PROJECT_ID}/rooms/room.family-table/finalize`, {
    method: 'POST', headers,
    body: JSON.stringify({ expectedRevision: 13, idempotencyKey: 'idem.room.unconfirmed', expectedRoomVariantVersion: 2, confirm: false }),
  });
  assert.equal(unconfirmed.status, 403);
});

test('private asset query bridge resolves HostBinding authority and rejects cross-project requests', async (context) => {
  const observed = [];
  const studioService = {
    commandCatalog: listCommandDefinitions(),
    durableAssetStoreReady: true,
    async readProjectTrusted(projectId) {
      return {
        schemaVersion: 1,
        projectId,
        revision: 9,
        snapshot: { project: { ownerId: 'owner.family' }, grants: [] },
      };
    },
    async queryAssets(request, executionContext) {
      observed.push({ request: structuredClone(request), executionContext: structuredClone(executionContext) });
      return { schemaVersion: 1, projectId: request.projectId, revision: 9, filters: {}, assets: [], proposals: [] };
    },
  };
  const server = createStudioHttpServer({
    studioService,
    hostBindingStore: {
      resolve() {
        return {
          projectId: PROJECT_ID,
          grantId: 'grant.family.secret',
          actor: { id: 'agent.family', kind: 'agent' },
          taskId: 'task.family',
          branchId: 'branch.family',
        };
      },
    },
    agentAttemptStore: { isLive: true, recordFailure() {} },
  });
  const baseUrl = await listen(context, server);
  const gateway = new LocalStudioGateway({
    baseUrl,
    bindingToken: 'b'.repeat(43),
    agentAttemptAuditReady: true,
    durableJobStoreReady: true,
    durableAssetStoreReady: true,
  });
  const result = await gateway.queryAssets({
    schemaVersion: 1,
    projectId: PROJECT_ID,
    assetId: ASSET_ID,
  }, {
    actor: { id: 'forged.agent', kind: 'agent' },
    grantId: 'forged.grant',
  });
  assert.equal(result.projectId, PROJECT_ID);
  assert.deepEqual(observed, [{
    request: { schemaVersion: 1, projectId: PROJECT_ID, assetId: ASSET_ID },
    executionContext: {
      actor: { id: 'agent.family', kind: 'agent' },
      taskId: 'task.family',
      grantId: 'grant.family.secret',
      branchId: 'branch.family',
      correlationId: observed[0].executionContext.correlationId,
    },
  }]);
  assert.match(observed[0].executionContext.correlationId, /^mcp\./);

  await assert.rejects(
    gateway.queryAssets({ schemaVersion: 1, projectId: 'project.outside' }),
    (error) => error.code === 'CONTEXT_PROJECT_MISMATCH'
      && !JSON.stringify(error).includes('grant.family.secret'),
  );
  assert.equal(observed.length, 1);
});
