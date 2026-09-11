import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareAnimationEditorFixture } from '../scripts/prepare-animation-editor-fixture.js';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { assemblyFixture, owner, projectId } from './assembly-test-helpers.js';
import { clipPayload } from './clip-test-helpers.js';
import { SqliteHostBindingStore, SqliteAgentAttemptStore, SqliteJobStore, SqliteArtifactMetadataStore } from '../packages/persistence/src/index.js';
import { AtlasPreviewWorker } from '../apps/studio-server/src/atlas-preview-worker.js';
import { LocalStudioGateway } from '../apps/studio-mcp/src/local-studio-gateway.js';
import { createAgentToolCatalog, buildOfficialMcpServer } from '../packages/mcp-server/src/index.js';
import { applyClipCommand, queryClipDocument } from '../packages/application/src/clip-service.js';

async function drain(f) {
  const worker = new AtlasPreviewWorker({ jobStore: new SqliteJobStore({ workspace: f.store.workspace }), artifactStore: f.artifacts,
    artifactMetadataStore: new SqliteArtifactMetadataStore({ workspace: f.store.workspace }), workerId: 'worker.clip-http' });
  try { await worker.drain(); } finally { await worker.stop(); }
}
const get = (url, options = {}) => fetch(url, { signal: AbortSignal.timeout(8000), ...options });
async function jsonResponse(response, expected = 200) {
  const body = await response.json(); assert.equal(response.status, expected, JSON.stringify(body)); return body;
}

test('Clip owner HTTP retains exact versions through contextual cut revision and idempotent save', { timeout: 120000 }, async t => {
  const f = await assemblyFixture(t), base = await f.http();
  const csrf = (await (await get(`${base}/api/ui-session`)).json()).csrfToken;
  const headers = { 'content-type': 'application/json', origin: base, 'sec-fetch-site': 'same-origin', 'x-numberdroid-studio-csrf': csrf };
  const root = `${base}/api/projects/${projectId}`;
  const post = (path, body, override = {}) => get(`${root}${path}`, { method: 'POST', headers: { ...headers, ...override }, body: JSON.stringify(body) });
  const revision = async () => (await f.studio.readProjectTrusted(projectId)).revision;
  const payload = clipPayload(f.slice), { assetId, ...content } = payload;
  const body = { ...content, expectedRevision: await revision(), idempotencyKey: 'http.clip.save' };
  for (const method of ['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS']) {
    const response = await get(`${root}/clips/${assetId}/save`, { method }); assert.equal(response.status, 405); await response.arrayBuffer();
  }
  for (const override of [{ origin: 'https://foreign.invalid' }, { 'x-numberdroid-studio-csrf': '' }]) {
    const response = await post(`/clips/${assetId}/save`, body, override); assert.equal(response.status, 403); await response.arrayBuffer();
  }
  await jsonResponse(await post(`/clips/${assetId}/save`, { ...body, actor: owner.actor }), 400);
  const draft = { expectedRevision: await revision(), assetId, name: content.name, kind: content.kind, metadata: content.metadata, clip: content.clip };
  const resolved = await jsonResponse(await post('/clips/resolve-draft', draft));
  assert.equal(resolved.draft.frameBindings[0].sliceBinding.sliceVersion, 1); assert.equal(await revision(), draft.expectedRevision);
  const saved = await jsonResponse(await post(`/clips/${assetId}/save`, body));
  const replay = await jsonResponse(await post(`/clips/${assetId}/save`, body));
  assert.equal(replay.replayed, true); assert.equal(replay.revision, saved.revision);
  const exact = await jsonResponse(await get(`${root}/clips/${assetId}?assetVersion=1`));
  assert.equal(exact.assets[0].frameBindings[0].sliceBinding.sliceVersion, 1);
  const cut = await jsonResponse(await get(`${root}/slices/${f.slice.sliceId}/versions/1`));
  assert.equal(cut.binding.sliceVersion, 1); assert.equal(cut.currentHead.sliceVersion, 1);
  const prepareBody = { expectedRevision: await revision(), idempotencyKey: 'http.cut.prepare', sourceSliceVersion: 1,
    expectedSliceVersion: 1, expectedAtlasVersion: 1, jobId: 'job.http-cut', name: 'Trimmed frame', rectangle: { x: 1, y: 0, width: 15, height: 16 } };
  const prepared = await jsonResponse(await post(`/slices/${f.slice.sliceId}/revision-preview`, prepareBody));
  assert.equal(prepared.value.status, 'ACCEPTED'); await drain(f);
  const commitBody = { expectedRevision: await revision(), idempotencyKey: 'http.cut.commit', sliceId: f.slice.sliceId, expectedSliceVersion: 1, expectedAtlasVersion: 1 };
  const committed = await jsonResponse(await post('/slice-revisions/job.http-cut/commit', commitBody));
  assert.equal(committed.value.sliceBinding.sliceVersion, 2);
  const historical = await jsonResponse(await get(`${root}/slices/${f.slice.sliceId}/versions/1`));
  assert.equal(historical.binding.width, 16); assert.equal(historical.currentHead.sliceVersion, 2);
  const stillPinned = await jsonResponse(await get(`${root}/clips/${assetId}`));
  assert.equal(stillPinned.assets[0].frameBindings[0].sliceBinding.sliceVersion, 1);
  const changed = structuredClone(content); changed.clip.frames[0].slice.sliceVersion = 2; changed.clip.frames[0].offset.x = 1;
  await jsonResponse(await post(`/clips/${assetId}/save`, { ...changed, operation: 'update', expectedAssetVersion: 1, expectedMetadataVersion: 1,
    expectedRevision: await revision(), idempotencyKey: 'http.clip.update' }));
  const older = await jsonResponse(await get(`${root}/clips/${assetId}?assetVersion=1`));
  assert.equal(older.assets[0].frameBindings[0].sliceBinding.sliceVersion, 1);
  const newest = await jsonResponse(await get(`${root}/clips/${assetId}`));
  assert.equal(newest.assets[0].frameBindings[0].sliceBinding.sliceVersion, 2);
  assert.equal((await jsonResponse(await post('/slice-revisions/job.http-cut/commit', commitBody))).replayed, true);
  await jsonResponse(await get(`${root}/slices/${f.slice.sliceId}/versions/1?unexpected=1`), 400);
  await jsonResponse(await get(`${root}/clips/${assetId}?limit=1&limit=2`), 400);
});

test('Clip proposal HTTP records actionable feedback, requires owner confirmation and saves acceptance atomically', { timeout: 120000 }, async t => {
  const f = await assemblyFixture(t), base = await f.http();
  const csrf = (await (await get(`${base}/api/ui-session`)).json()).csrfToken;
  const headers = { 'content-type': 'application/json', origin: base, 'sec-fetch-site': 'same-origin', 'x-numberdroid-studio-csrf': csrf };
  const root = `${base}/api/projects/${projectId}`;
  let sequence = 0;
  const post = async (path, payload) => get(`${root}${path}`, { method: 'POST', headers, body: JSON.stringify({ ...payload,
    expectedRevision: (await f.studio.readProjectTrusted(projectId)).revision, idempotencyKey: `http.proposal.${++sequence}` }) });
  const proposed = { ...clipPayload(f.slice), proposalId: 'proposal.http-clip', expectedProposalVersion: 0 };
  await jsonResponse(await post('/clip-proposals', proposed));
  const incomplete = await post('/clip-proposals/proposal.http-clip/resolve', { expectedProposalVersion: 1, decision: 'REQUEST_CHANGES', confirmed: true });
  assert.equal(incomplete.status, 400); await incomplete.arrayBuffer();
  await jsonResponse(await post('/clip-proposals/proposal.http-clip/resolve', { expectedProposalVersion: 1, decision: 'REQUEST_CHANGES', feedback: 'Slow the final frame.', confirmed: true }));
  const feedback = await jsonResponse(await get(`${root}/clips?proposalId=proposal.http-clip`));
  assert.equal(feedback.proposals[0].feedback, 'Slow the final frame.');
  const revised = structuredClone(proposed); revised.expectedProposalVersion = 2; revised.clip.frames[0].durationMs = 400;
  await jsonResponse(await post('/clip-proposals', revised));
  const accepted = await jsonResponse(await post('/clip-proposals/proposal.http-clip/resolve', { expectedProposalVersion: 3, decision: 'ACCEPT', confirmed: true }));
  assert.equal(accepted.value.status, 'ACCEPTED'); assert.equal(accepted.value.assetVersion, 1);
  const read = await jsonResponse(await get(`${root}/clips/${proposed.assetId}`));
  assert.equal(read.assets[0].clip.frames[0].durationMs, 400);
});

test('Animation official SDK profile negotiates 25/7 and preserves exact correction, cut budgets and live authority', { timeout: 120000 }, async t => {
  const f = await assemblyFixture(t);
  const scopes = ['project.read', 'clip.proposal.submit', 'assembly.proposal.submit', 'slice.revision.prepare', 'slice.revision.commit'];
  await f.execute('grant.issue', { grantId: 'grant.animation', agentId: 'agent.animation', taskId: 'task.animation', branchId: 'branch.main', scopes,
    objectScopes: [{ kind: 'project', id: projectId }], budget: { maxCommands: 30, maxJobs: 1, maxArtifactBytes: 4096, maxCostCents: 0 } });
  const hostBindingStore = new SqliteHostBindingStore({ workspace: f.store.workspace });
  const agentAttemptStore = new SqliteAgentAttemptStore({ workspace: f.store.workspace });
  const issued = hostBindingStore.issue({ projectId, grantId: 'grant.animation', agentId: 'agent.animation', taskId: 'task.animation', branchId: 'branch.main', issuedBy: owner.actor.id });
  let taskBound = false;
  const base = await f.http({ hostBindingStore, agentAttemptStore, agentTaskService: { hasTask: () => taskBound } });
  const gateway = new LocalStudioGateway({ baseUrl: base, bindingToken: issued.token, agentAttemptAuditReady: true,
    durableJobStoreReady: true, durableAssetStoreReady: true, durableRoomStoreReady: true });
  const contextProvider = async () => ({ projectId });
  const defaultServer = buildOfficialMcpServer({ studioGateway: gateway, contextProvider });
  const [defaultClientTransport, defaultServerTransport] = InMemoryTransport.createLinkedPair(); await defaultServer.connect(defaultServerTransport);
  const defaultClient = new Client({ name: 'animation-default-check', version: '1.0.0' }); await defaultClient.connect(defaultClientTransport);
  try {
    assert.equal((await defaultClient.listTools()).tools.length, 19);
    assert.equal((await defaultClient.listResourceTemplates()).resourceTemplates.length, 4);
    const legacy = await defaultClient.readResource({ uri: `studio://projects/${projectId}` });
    assert.equal(JSON.parse(legacy.contents[0].text).snapshot.clipLibrary, undefined);
    await f.execute('clip.save', clipPayload(f.slice, { assetId: 'clip.default-profile' }));
    await assert.rejects(gateway.readProject({ projectId }), { code: 'ANIMATION_NEGOTIATION_REQUIRED' });
    const unsupportedResource = await defaultClient.readResource({ uri: `studio://projects/${projectId}` });
    assert.equal(JSON.parse(unsupportedResource.contents[0].text).error.code, 'ANIMATION_NEGOTIATION_REQUIRED');
    const unsupportedTool = await defaultClient.callTool({ name: 'studio_project_read', arguments: { schemaVersion: 1, projectId } });
    assert.equal(unsupportedTool.isError, true);
    assert.equal(unsupportedTool.structuredContent.error.code, 'ANIMATION_NEGOTIATION_REQUIRED');
  }
  finally { await defaultClient.close(); await defaultServer.close(); }
  await assert.rejects(gateway.queryClips({ schemaVersion: 1, projectId }), { code: 'ANIMATION_NEGOTIATION_REQUIRED' });
  await assert.rejects(gateway.negotiateAnimationV1({ schemaVersion: 1, projectId: 'project.foreign', profile: 'animation-v1' }), { code: 'CONTEXT_PROJECT_MISMATCH' });
  const negotiation = await gateway.negotiateAnimationV1({ schemaVersion: 1, projectId, profile: 'animation-v1' });
  assert.equal(negotiation.storeSchemaVersion, 18);
  const legacyFacade = createAgentToolCatalog(gateway, { contextProvider });
  await assert.rejects(legacyFacade.find(tool => tool.name === 'studio_project_read').execute({ schemaVersion: 1, projectId }),
    { code: 'ANIMATION_NEGOTIATION_REQUIRED' });
  for (const bad of [{ ...negotiation, storeSchemaVersion: 16 }, { ...negotiation, sharedHead: false }, { ...negotiation, toolCount: 24 }]) {
    assert.throws(() => createAgentToolCatalog(gateway, { contextProvider, animationV1: { projectId, negotiation: bad } }), { code: 'ANIMATION_NEGOTIATION_REQUIRED' });
  }
  const selected = { projectId, negotiation };
  const server = buildOfficialMcpServer({ studioGateway: gateway, contextProvider, animationV1: selected });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair(); await server.connect(serverTransport);
  const client = new Client({ name: 'animation-profile-contract', version: '1.0.0' }); await client.connect(clientTransport);
  const call = async (name, type, payload) => { const command = await f.request(type, payload); delete command.type;
    const result = await client.callTool({ name, arguments: command }); return { command, result }; };
  try {
    const list = (await client.listTools()).tools; assert.equal(list.length, 25); assert.equal((await client.listResourceTemplates()).resourceTemplates.length, 7);
    const projectResource = await client.readResource({ uri: `studio://projects/${projectId}` });
    assert.equal(JSON.parse(projectResource.contents[0].text).snapshot.clipLibrary.assets[0].assetId, 'clip.default-profile');
    assert.equal(list.some(tool => ['studio_clip_save', 'studio_clip_proposal_resolve'].includes(tool.name)), false);
    const proposal = { ...clipPayload(f.slice), proposalId: 'proposal.sdk-clip', expectedProposalVersion: 0 };
    const invalid = structuredClone(proposal); invalid.clip.frames[0].slice.sliceVersion = 99;
    const before = await f.studio.readProjectTrusted(projectId);
    const rejected = await call('studio_clip_proposal_submit', 'clip.proposal.submit', invalid);
    assert.equal(rejected.result.isError, true); assert.equal(rejected.result.structuredContent.error.code, 'CLIP_SLICE_NOT_FOUND');
    assert.equal((await f.studio.readProjectTrusted(projectId)).revision, before.revision);
    const submitted = await call('studio_clip_proposal_submit', 'clip.proposal.submit', proposal);
    assert.notEqual(submitted.result.isError, true, JSON.stringify(submitted.result));
    const replay = await client.callTool({ name: 'studio_clip_proposal_submit', arguments: submitted.command });
    assert.equal(replay.structuredContent.replayed, true);
    await f.execute('clip.proposal.resolve', { proposalId: proposal.proposalId, expectedProposalVersion: 1, decision: 'REQUEST_CHANGES', feedback: 'Use a longer frame hold.', confirmed: true });
    const feedback = await client.callTool({ name: 'studio_clip_query', arguments: { schemaVersion: 1, projectId, proposalId: proposal.proposalId } });
    assert.equal(feedback.structuredContent.proposals[0].feedback, 'Use a longer frame hold.');
    const corrected = structuredClone(proposal); corrected.expectedProposalVersion = 2; corrected.clip.frames[0].durationMs = 350;
    const revised = await call('studio_clip_proposal_submit', 'clip.proposal.submit', corrected); assert.notEqual(revised.result.isError, true);
    await f.execute('clip.proposal.resolve', { proposalId: proposal.proposalId, expectedProposalVersion: 3, decision: 'ACCEPT', confirmed: true });
    const clipResource = await client.readResource({ uri: `studio://projects/${projectId}/clips/${proposal.assetId}/versions/1` });
    assert.equal(JSON.parse(clipResource.contents[0].text).assets[0].clip.frames[0].durationMs, 350);
    const sliceResource = await client.readResource({ uri: `studio://projects/${projectId}/slices/${f.slice.sliceId}/versions/1` });
    assert.equal(JSON.parse(sliceResource.contents[0].text).binding.sliceVersion, 1);
    const cutPayload = { sliceId: f.slice.sliceId, sourceSliceVersion: 1, expectedSliceVersion: 1, expectedAtlasVersion: 1,
      jobId: 'job.sdk-cut', name: 'SDK cut', rectangle: { x: 1, y: 0, width: 15, height: 16 } };
    const cut = await call('studio_slice_revision_prepare', 'slice.revision.prepare', cutPayload); assert.notEqual(cut.result.isError, true, JSON.stringify(cut.result));
    await drain(f);
    const committed = await call('studio_slice_revision_commit', 'slice.revision.commit', { sliceId: f.slice.sliceId, expectedSliceVersion: 1, expectedAtlasVersion: 1, jobId: cutPayload.jobId });
    assert.notEqual(committed.result.isError, true, JSON.stringify(committed.result));
    const exhausted = await call('studio_slice_revision_prepare', 'slice.revision.prepare', { ...cutPayload, expectedSliceVersion: 2, expectedAtlasVersion: 2, jobId: 'job.sdk-exhausted', rectangle: { x: 2, y: 0, width: 14, height: 16 } });
    assert.equal(exhausted.result.structuredContent.error.code, 'BUDGET_EXCEEDED');
    const same = await call('studio_slice_revision_prepare', 'slice.revision.prepare', { ...cutPayload, expectedSliceVersion: 2, expectedAtlasVersion: 2, jobId: 'job.sdk-reuse' });
    assert.notEqual(same.result.isError, true); assert.equal(same.result.structuredContent.value.status, 'REUSED');
    const oldClip = await gateway.queryClips({ schemaVersion: 1, projectId, assetId: proposal.assetId });
    assert.equal(oldClip.assets[0].frameBindings[0].sliceBinding.sliceVersion, 1);
    taskBound = true;
    await assert.rejects(gateway.queryClips({ schemaVersion: 1, projectId }), { code: 'ANIMATION_TASK_BRANCH_UNSUPPORTED' });
    await assert.rejects(gateway.negotiateAnimationV1({ schemaVersion: 1, projectId, profile: 'animation-v1' }), { code: 'ANIMATION_TASK_BRANCH_UNSUPPORTED' });
    taskBound = false;
    hostBindingStore.revoke(issued.binding.bindingId, { revokedBy: owner.actor.id, reason: 'Test complete' });
    await assert.rejects(gateway.queryClips({ schemaVersion: 1, projectId }));
  } finally { await client.close(); await server.close(); }
});

test('Clip queries bound aggregate bytes and exact identity filters recover large Library reads', { timeout: 30000 }, async t => {
  const f = await assemblyFixture(t);
  const document = await f.store.loadProject(projectId);
  const head = document.revisions.at(-1);
  const snapshot = structuredClone(head.snapshot);
  const content = clipPayload(f.slice);
  content.clip.frames = Array.from({ length: 256 }, (_, index) => ({
    ...content.clip.frames[0], frameId: `frame.${index}.` + 'x'.repeat(116), name: 'n'.repeat(160),
  }));
  // Build query volume through the real content validator without a large SQLite fixture.
  for (let index = 0; index < 16; index += 1) {
    const payload = { ...content, assetId: `clip.large.${index}` };
    applyClipCommand({ type: 'clip.save', payload, baseRevision: head.number, actor: owner.actor, taskId: null }, snapshot, document, '2026-09-10T00:00:00.000Z');
    applyClipCommand({ type: 'clip.proposal.submit', payload: { ...payload, operation: 'update', expectedAssetVersion: 1,
      expectedMetadataVersion: 1, proposalId: `proposal.large.${index}`, expectedProposalVersion: 0 },
    baseRevision: head.number, actor: owner.actor, taskId: null }, snapshot, document, '2026-09-10T00:00:00.000Z');
  }
  document.revisions.push({ number: head.number + 1, snapshot });
  assert.throws(() => queryClipDocument({ schemaVersion: 1, projectId }, document), { code: 'CLIP_RESPONSE_TOO_LARGE' });
  const limited = queryClipDocument({ schemaVersion: 1, projectId, limit: 1 }, document);
  assert.equal(limited.assets.length, 1); assert.equal(limited.proposals.length, 1);
  assert.ok(Buffer.byteLength(JSON.stringify(limited)) < 4 * 1024 * 1024);
  const exactAsset = queryClipDocument({ schemaVersion: 1, projectId, assetId: 'clip.large.15' }, document);
  assert.deepEqual(exactAsset.assets.map(asset => asset.assetId), ['clip.large.15']);
  assert.deepEqual(exactAsset.proposals.map(proposal => proposal.proposalId), ['proposal.large.15']);
  const exactProposal = queryClipDocument({ schemaVersion: 1, projectId, proposalId: 'proposal.large.15' }, document);
  assert.deepEqual(exactProposal.assets.map(asset => asset.assetId), ['clip.large.15']);
  assert.deepEqual(exactProposal.proposals.map(proposal => proposal.proposalId), ['proposal.large.15']);
});


test('Animation fixture refuses existing directories before writing any project files', { timeout: 15000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'animation-existing-data-'));
  try {
    await writeFile(join(directory, 'sentinel.txt'), 'Saved work belongs to its owner.');
    await assert.rejects(prepareAnimationEditorFixture(directory), /requires an absent directory/);
    assert.deepEqual(await readdir(directory), ['sentinel.txt']);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
