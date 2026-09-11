import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { COMMAND_DEFINITIONS } from '../packages/domain/src/command-catalog.js';
import { createAgentToolCatalog, buildOfficialMcpServer } from '../packages/mcp-server/src/index.js';
import { validateReviewNegotiation } from '../packages/mcp-server/src/review-v1.js';
import { validateAnimationNegotiation } from '../packages/mcp-server/src/animation-v1.js';
import { validateAssemblyNegotiation } from '../packages/mcp-server/src/assembly-v1.js';
import { LocalStudioGateway } from '../apps/studio-mcp/src/local-studio-gateway.js';
import { handleReviewHttp } from '../apps/studio-server/src/review-http.js';

const projectId = 'project.review-protocol';
const negotiation = { schemaVersion: 1, profile: 'review-v1', projectId, storeSchemaVersion: 18, sharedHead: true, toolCount: 27, resourceTemplateCount: 8 };
const selected = { projectId, negotiation };
const contextProvider = async () => ({ projectId });
function facade() {
  const calls = [];
  const service = { commandCatalog: COMMAND_DEFINITIONS,
    durableReviewStoreReady: true, durableClipStoreReady: true, durableAssemblyStoreReady: true, durableRoomStoreReady: true, durableAssetStoreReady: true, durableJobStoreReady: true, agentAttemptAuditReady: true,
    queryReviews: async (request, context, options) => { calls.push({ request, context, options }); return { schemaVersion: 1, projectId, revision: 9, groups: [{ reviewId: request.reviewId ?? 'review.fixture', reviewVersion: request.reviewVersion ?? 2 }] }; },
    readProject: async () => ({ snapshot: { reviewLibrary: { schemaVersion: 1, groups: [{ reviewId: 'review.fixture' }] } } }),
  };
  return { service, calls };
}

test('Review negotiation requires exact known18 profile and preserves older catalogs', { timeout: 10000 }, () => {
  assert.deepEqual(validateReviewNegotiation(negotiation, projectId), negotiation);
  for (const patch of [{ storeSchemaVersion: 17 }, { storeSchemaVersion: 19 }, { sharedHead: false }, { toolCount: 26 }, { resourceTemplateCount: 7 }, { profile: 'animation-v1' }, { extra: true }]) assert.throws(() => validateReviewNegotiation({ ...negotiation, ...patch }, projectId), { code: 'REVIEW_NEGOTIATION_REQUIRED' });
  const { service } = facade();
  assert.equal(createAgentToolCatalog(service, { contextProvider }).length, 19);
  for (const version of [16, 17, 18]) {
    const value = { ...negotiation, profile: 'assembly-v1', toolCount: 21, resourceTemplateCount: 5, storeSchemaVersion: version };
    validateAssemblyNegotiation(value, projectId);
    assert.equal(createAgentToolCatalog(service, { contextProvider, assemblyV1: { projectId, negotiation: value } }).length, 21);
  }
  for (const version of [17, 18]) {
    const value = { ...negotiation, profile: 'animation-v1', toolCount: 25, resourceTemplateCount: 7, storeSchemaVersion: version };
    validateAnimationNegotiation(value, projectId);
    assert.equal(createAgentToolCatalog(service, { contextProvider, animationV1: { projectId, negotiation: value } }).length, 25);
  }
  assert.throws(() => validateAnimationNegotiation({ ...negotiation, profile: 'animation-v1', toolCount: 25, resourceTemplateCount: 7, storeSchemaVersion: 19 }, projectId), { code: 'ANIMATION_NEGOTIATION_REQUIRED' });
  assert.throws(() => createAgentToolCatalog({ ...service, durableReviewStoreReady: false }, { contextProvider, reviewV1: selected }), { code: 'REVIEW_NEGOTIATION_REQUIRED' });
});

test('Review official SDK exposes27/8, validates bounded query and reads exact historical identity', { timeout: 15000 }, async () => {
  const { service, calls } = facade();
  const server = buildOfficialMcpServer({ studioGateway: service, contextProvider, reviewV1: selected });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair(); await server.connect(serverTransport);
  const client = new Client({ name: 'review-protocol', version: '1.0.0' }); await client.connect(clientTransport);
  try {
    const tools = (await client.listTools()).tools;
    assert.equal(tools.length, 27); assert.equal((await client.listResourceTemplates()).resourceTemplates.length, 8);
    assert.equal(tools.some(tool => ['studio_review_accept', 'studio_review_feedback_save', 'studio_review_discard'].includes(tool.name)), false);
    assert.ok(tools.some(tool => tool.name === 'studio_review_proposal_submit'));
    const uri = `studio://projects/${projectId}/reviews/review.fixture/versions/1`;
    const response = await client.readResource({ uri });
    assert.equal(JSON.parse(response.contents[0].text).groups[0].reviewVersion, 1);
    assert.equal(calls[0].request.reviewVersion, 1); assert.equal(calls[0].request.reviewId, 'review.fixture');
    const foreign = await client.readResource({ uri: 'studio://projects/foreign/reviews/review.fixture/versions/1' });
    assert.equal(JSON.parse(foreign.contents[0].text).error.code, 'CONTEXT_PROJECT_MISMATCH');
    const bad = await client.callTool({ name: 'studio_review_query', arguments: { schemaVersion: 1, projectId, actor: 'intruder' } }); assert.equal(bad.isError, true); assert.equal(calls.length, 1);
    const large = await client.callTool({ name: 'studio_review_query', arguments: { schemaVersion: 1, projectId, selectedItemIds: Array.from({ length: 65 }, (_, i) => `item.${i}`) } }); assert.equal(large.isError, true); assert.equal(calls.length, 1);
  } finally { await client.close(); await server.close(); }
});

test('Nonreview project reads fail closed while isolated typed legacy catalogs stay available', { timeout: 10000 }, async () => {
  const { service } = facade();
  const animationV1 = { projectId, negotiation: { ...negotiation, profile: 'animation-v1', toolCount: 25, resourceTemplateCount: 7 } };
  for (const options of [{}, { animationV1 }]) {
    const tool = createAgentToolCatalog(service, { contextProvider, ...options }).find(t => t.name === 'studio_project_read');
    await assert.rejects(tool.execute({ schemaVersion: 1, projectId }), { code: 'REVIEW_NEGOTIATION_REQUIRED' });
  }
  const gateway = new LocalStudioGateway({ baseUrl: 'http://127.0.0.1:1', bindingToken: 'untransmitted-fixture-token' });
  await assert.rejects(gateway.queryReviews({ schemaVersion: 1, projectId }), { code: 'REVIEW_NEGOTIATION_REQUIRED' });
  await assert.rejects(gateway.execute({ type: 'review.proposal.submit', projectId }), { code: 'REVIEW_NEGOTIATION_REQUIRED' });
});

test('Review HTTP uses exact owner actions, bounded preview read and rejects authority injection', { timeout: 10000 }, async () => {
  const calls = [], mutations = []; let body = {}, code, value, bodyLimit, asserted = 0;
  const deps = { response: { setHeader() {} }, studioService: { durableReviewStoreReady: true, readProjectTrusted: async () => ({ snapshot: { project: { ownerId: 'owner' } } }), queryReviews: async request => { calls.push(request); return request; }, execute: async command => { mutations.push(command); return command; } },
    humanUiCsrfToken: 'test-csrf', signal: AbortSignal.timeout(5000), assertHumanUiMutation: () => { asserted++; }, readJsonBody: async (_request, { maxBytes }) => { bodyLimit = maxBytes; return body; },
    assertExactKeys: (object, keys) => { if (Object.keys(object).some(key => !keys.has(key))) throw Object.assign(new Error('unknown field'), { code: 'VALIDATION_ERROR' }); },
    humanOwnerContext: () => ({ actor: { id: 'owner', kind: 'human' } }), humanCommandDto: (id, envelope, type, payload) => ({ projectId: id, type, payload, baseRevision: envelope.expectedRevision }), sendJson: (_response, status, result) => { code = status; value = result; } };
  const run = (method, path) => handleReviewHttp({ ...deps, request: { method }, url: new URL(`http://127.0.0.1/api/projects/${projectId}/reviews${path}`) });
  await run('GET', '/review.fixture?reviewVersion=2&includeHistory=true'); assert.equal(code, 200); assert.equal(calls[0].reviewVersion, 2); assert.equal(calls[0].includeHistory, true); assert.equal(asserted, 0);
  await assert.rejects(run('GET', '/review.fixture?reviewVersion=2&reviewVersion=3'), { code: 'VALIDATION_ERROR' });
  await assert.rejects(run('GET', '/review.fixture?includeHistory=perhaps'), { code: 'VALIDATION_ERROR' });
  body = { reviewVersion: 2, selectedItemIds: ['item.one'], selection: { stateId: 'ready' } }; await run('POST', '/review.fixture/preview'); assert.equal(asserted, 1); assert.equal(bodyLimit, 16384); assert.equal(mutations.length, 0); assert.deepEqual(value.selectedItemIds, ['item.one']);
  body = { expectedRevision: 9, idempotencyKey: 'feedback.one', expectedReviewVersion: 2, summary: 'Smaller', itemComments: [], confirmed: true };
  await run('POST', '/review.fixture/feedback'); assert.equal(mutations[0].type, 'review.feedback.save'); assert.equal(mutations[0].payload.reviewId, 'review.fixture');
  body.actor = 'intruder'; await assert.rejects(run('POST', '/review.fixture/feedback'), { code: 'VALIDATION_ERROR' }); assert.equal(mutations.length, 1);
  await run('DELETE', '/review.fixture'); assert.equal(code, 405);
});
