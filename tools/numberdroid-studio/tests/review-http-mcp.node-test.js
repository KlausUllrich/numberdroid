import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { assemblyFixture, assemblyPayload, owner, projectId } from './assembly-test-helpers.js';
import { SqliteHostBindingStore, SqliteAgentAttemptStore } from '../packages/persistence/src/index.js';
import { LocalStudioGateway } from '../apps/studio-mcp/src/local-studio-gateway.js';
import { createAgentToolCatalog, buildOfficialMcpServer } from '../packages/mcp-server/src/index.js';

const reviewId = 'review.protocol';
const group = f => ({ reviewId, expectedReviewVersion: 0, title: 'Related fixture', items: [
  { itemId: 'item.image', contentKind: 'image', payload: f.payload(), dependsOn: [] },
  { itemId: 'item.assembly', contentKind: 'assembly', payload: assemblyPayload(), dependsOn: ['item.image'] },
] });

test('Shared Review owner HTTP authenticates writes, previews without mutation and replays exact acceptance', { timeout: 120000 }, async t => {
  const f = await assemblyFixture(t); const base = await f.http();
  const csrf = (await (await fetch(`${base}/api/ui-session`)).json()).csrfToken;
  const path = `${base}/api/projects/${projectId}/reviews`;
  const headers = { 'content-type': 'application/json', origin: base, 'sec-fetch-site': 'same-origin', 'x-numberdroid-studio-csrf': csrf };
  const envelope = async payload => ({ ...payload, expectedRevision: (await f.studio.readProjectTrusted(projectId)).revision, idempotencyKey: `http.${crypto.randomUUID()}` });
  const submit = await envelope(group(f));
  for (const altered of [{ ...headers, origin: 'https://foreign.invalid' }, { ...headers, 'x-numberdroid-studio-csrf': '' }]) {
    const response = await fetch(path, { method: 'POST', headers: altered, body: JSON.stringify(submit) }); assert.equal(response.status, 403); await response.arrayBuffer();
  }
  const inject = await fetch(path, { method: 'POST', headers, body: JSON.stringify({ ...submit, actor: owner.actor }) }); assert.equal(inject.status, 400); await inject.arrayBuffer();
  const response = await fetch(path, { method: 'POST', headers, body: JSON.stringify(submit) }); assert.equal(response.status, 200, await response.clone().text()); const receipt = await response.json();
  const exact = await (await fetch(`${path}/${reviewId}?reviewVersion=1`)).json(); assert.ok(exact.groups, JSON.stringify(exact)); assert.equal(exact.groups[0].reviewVersion, 1);
  const before = await f.studio.readProjectTrusted(projectId);
  const preview = await fetch(`${path}/${reviewId}/preview`, { method: 'POST', headers, body: JSON.stringify({ reviewVersion: 1, selectedItemIds: ['item.assembly'] }) }); assert.equal(preview.status, 200, await preview.clone().text()); assert.equal((await preview.json()).groups[0].eligibility.canAccept, false);
  assert.deepEqual(await f.studio.readProjectTrusted(projectId), before);
  const feedback = await envelope({ expectedReviewVersion: 1, summary: 'Keep the current direction.', itemComments: [], confirmed: true });
  const returned = await fetch(`${path}/${reviewId}/feedback`, { method: 'POST', headers, body: JSON.stringify(feedback) }); assert.equal(returned.status, 200, await returned.clone().text()); await returned.arrayBuffer();
  const accept = await envelope({ expectedReviewVersion: 2, selectedItemIds: ['item.image', 'item.assembly'], confirmed: true });
  const accepted = await fetch(`${path}/${reviewId}/accept`, { method: 'POST', headers, body: JSON.stringify(accept) }); assert.equal(accepted.status, 200, await accepted.clone().text()); const applied = await accepted.json();
  const repeat = await (await fetch(`${path}/${reviewId}/accept`, { method: 'POST', headers, body: JSON.stringify(accept) })).json(); assert.equal(repeat.replayed, true); assert.equal(repeat.revision, applied.revision);
  assert.equal(applied.revision, receipt.revision + 2);
  const historical = await (await fetch(`${path}/${reviewId}?reviewVersion=1`)).json(); assert.equal(historical.groups[0].status, 'PENDING');
  for (const method of ['GET', 'HEAD', 'PUT', 'DELETE']) { const value = await fetch(`${path}/${reviewId}/accept`, { method }); assert.equal(value.status, 405); await value.arrayBuffer(); }
});

test('Shared Review official MCP negotiates27/8, revises feedback and rechecks HostBinding before query/replay', { timeout: 120000 }, async t => {
  const f = await assemblyFixture(t);
  await f.execute('grant.issue', { grantId: 'grant.review', agentId: 'agent.review', taskId: 'task.review', branchId: 'branch.main', scopes: ['project.read', 'review.proposal.submit'], objectScopes: [{ kind: 'project', id: projectId }], budget: { maxCommands: 20, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 } });
  const hostBindingStore = new SqliteHostBindingStore({ workspace: f.store.workspace });
  const agentAttemptStore = new SqliteAgentAttemptStore({ workspace: f.store.workspace });
  const issued = hostBindingStore.issue({ projectId, grantId: 'grant.review', agentId: 'agent.review', taskId: 'task.review', branchId: 'branch.main', issuedBy: owner.actor.id });
  let taskBound = false;
  const base = await f.http({ hostBindingStore, agentAttemptStore, agentTaskService: { hasTask: () => taskBound } });
  const gateway = new LocalStudioGateway({ baseUrl: base, bindingToken: issued.token });
  const contextProvider = async () => ({ projectId });
  const unnegotiated = await fetch(`${base}/internal/mcp/review-query`, { method: 'POST', headers: { authorization: `Bearer ${issued.token}`, 'content-type': 'application/json' }, body: JSON.stringify({ schemaVersion: 1, projectId }) });
  assert.equal((await unnegotiated.json()).error.code, 'REVIEW_NEGOTIATION_REQUIRED');
  await assert.rejects(gateway.negotiateReviewV1({ schemaVersion: 1, projectId: 'foreign', profile: 'review-v1' }), { code: 'CONTEXT_PROJECT_MISMATCH' });
  const negotiation = await gateway.negotiateReviewV1({ schemaVersion: 1, projectId, profile: 'review-v1' }); assert.equal(negotiation.storeSchemaVersion, 18);
  const reviewV1 = { projectId, negotiation };
  const catalog = createAgentToolCatalog(gateway, { contextProvider, reviewV1 });
  const server = buildOfficialMcpServer({ studioGateway: gateway, contextProvider, reviewV1 });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair(); await server.connect(serverTransport);
  const client = new Client({ name: 'review-live-protocol', version: '1.0.0' }); await client.connect(clientTransport);
  try {
    assert.equal((await client.listTools()).tools.length, 27); assert.equal((await client.listResourceTemplates()).resourceTemplates.length, 8);
    const payload = group(f), command = await f.request('review.proposal.submit', payload); delete command.type;
    const submitted = await client.callTool({ name: 'studio_review_proposal_submit', arguments: command }); assert.notEqual(submitted.isError, true, JSON.stringify(submitted));
    const submitTool = catalog.find(tool => tool.name === 'studio_review_proposal_submit');
    assert.equal((await submitTool.execute(command)).replayed, true);
    const before = await f.studio.readProjectTrusted(projectId);
    await f.execute('review.feedback.save', { reviewId, expectedReviewVersion: 1, summary: 'Please revise the title.', itemComments: [], confirmed: true });
    const feedback = await gateway.queryReviews({ schemaVersion: 1, projectId, reviewId }); assert.equal(feedback.groups[0].status, 'CHANGES_REQUESTED');
    const revised = await f.request('review.proposal.submit', { ...payload, title: 'Revised fixture', expectedReviewVersion: 2 }); delete revised.type;
    const revisedResult = await client.callTool({ name: 'studio_review_proposal_submit', arguments: revised }); assert.notEqual(revisedResult.isError, true, JSON.stringify(revisedResult));
    const resource = await client.readResource({ uri: `studio://projects/${projectId}/reviews/${reviewId}/versions/2` }); assert.equal(JSON.parse(resource.contents[0].text).groups[0].status, 'CHANGES_REQUESTED');
    assert.equal((await f.studio.readProjectTrusted(projectId)).revision, before.revision + 2);
    taskBound = true; await assert.rejects(gateway.queryReviews({ schemaVersion: 1, projectId }), { code: 'REVIEW_TASK_BRANCH_UNSUPPORTED' });
    await assert.rejects(gateway.negotiateReviewV1({ schemaVersion: 1, projectId, profile: 'review-v1' }), { code: 'REVIEW_TASK_BRANCH_UNSUPPORTED' }); taskBound = false;
    hostBindingStore.revoke(issued.binding.bindingId, { revokedBy: owner.actor.id, reason: 'Test complete' });
    await assert.rejects(gateway.queryReviews({ schemaVersion: 1, projectId })); await assert.rejects(submitTool.execute(command));
  } finally { await client.close(); await server.close(); }
});
