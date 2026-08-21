import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, SdkErrorCode } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import {
  ContentAddressedArtifactStore, SqliteArtifactMetadataStore, SqliteHostBindingStore, SqliteProjectStore,
} from '../packages/persistence/src/index.js';
import { createStudioHttpServer } from '../apps/studio-server/src/server.js';
import {
  defaultMcpPairingEndpoint, McpPairingBroker, startMcpPairingSocket,
} from '../apps/studio-server/src/mcp-pairing-broker.js';
import {
  AGENT, OWNER, OWNER_CONTEXT, PROJECT_ID, command, createHarness, createProject, issueGrant,
} from './test-helpers.js';
import { nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';

const studioRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

async function mcpFixture(context) {
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-official-mcp-'));
  const store = await SqliteProjectStore.open({
    filename: join(directory, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  const { studio } = createHarness(store);
  await createProject(studio);
  await issueGrant(studio, { scopes: ['project.read', 'source.write', 'asset.write', 'project.status.write'] });
  const artifactStore = new ContentAddressedArtifactStore({ rootDirectory: join(directory, 'artifacts') });
  const artifact = await artifactStore.ingest(ONE_PIXEL_PNG, { mediaType: 'image/png' });
  const artifactMetadataStore = new SqliteArtifactMetadataStore({ workspace: store.workspace });
  artifactMetadataStore.registerAndReference(artifact, {
    projectId: PROJECT_ID,
    ownerKind: 'upload',
    ownerId: 'upload.official-mcp-fixture',
    createdRevision: 2,
  });
  const bindings = new SqliteHostBindingStore({
    workspace: store.workspace,
    clock: () => '2026-08-21T12:00:10.000Z',
  });
  const issued = bindings.issue({
    projectId: PROJECT_ID,
    grantId: 'grant.atlas',
    agentId: AGENT.id,
    taskId: 'task.atlas',
    branchId: 'branch.task.atlas',
    issuedBy: OWNER.id,
  });
  const pairingBroker = new McpPairingBroker();
  const pairing = await startMcpPairingSocket({
    broker: pairingBroker,
    endpoint: defaultMcpPairingEndpoint(directory),
  });
  const server = createStudioHttpServer({
    studioService: studio,
    hostBindingStore: bindings,
    pairingBroker,
    pairingEndpoint: pairing.endpoint,
    artifactStore,
    artifactMetadataStore,
  });
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  context.after(async () => {
    await new Promise((resolveClose) => server.close(resolveClose));
    await pairing.close();
    store.close();
    await rm(directory, { recursive: true, force: true });
  });
  return {
    studio,
    store,
    token: issued.token,
    pairingBroker,
    pairingEndpoint: pairing.endpoint,
    artifact,
    serviceUrl: `http://127.0.0.1:${server.address().port}/`,
  };
}

function childTransport({ token, serviceUrl, pairingEndpoint }) {
  const env = { ...process.env };
  delete env.NUMBERDROID_STUDIO_BINDING_TOKEN;
  delete env.NUMBERDROID_STUDIO_PAIRING_ENDPOINT;
  Object.assign(env, {
    NUMBERDROID_STUDIO_PROJECT_ID: PROJECT_ID,
    NUMBERDROID_STUDIO_SERVICE_URL: serviceUrl,
    ...(token
      ? { NUMBERDROID_STUDIO_BINDING_TOKEN: token }
      : { NUMBERDROID_STUDIO_PAIRING_ENDPOINT: pairingEndpoint }),
  });
  return new StdioClientTransport({
    command: process.execPath,
    args: [resolve(studioRoot, 'apps/studio-mcp/src/main.js')],
    cwd: studioRoot,
    env,
    stderr: 'pipe',
  });
}

test('official stdio MCP pins 2026-07-28 and preserves HostBinding authority', async (context) => {
  const fixture = await mcpFixture(context);
  const client = new Client(
    { name: 'numberdroid-studio-contract-test', version: '1.0.0' },
    { versionNegotiation: { mode: { pin: '2026-07-28' } } },
  );
  const transport = childTransport({ ...fixture, token: null });
  context.after(() => client.close().catch(() => {}));
  await client.connect(transport);
  assert.equal(client.getProtocolEra(), 'modern');
  assert.equal(client.getNegotiatedProtocolVersion(), '2026-07-28');

  const { tools } = await client.listTools();
  const names = tools.map(({ name }) => name);
  assert.ok(names.includes('studio_project_read'));
  assert.ok(names.includes('studio_source_register'));
  assert.ok(!names.includes('studio_grant_issue'));
  assert.ok(!names.includes('studio_grant_revoke'));
  const sourceTool = tools.find(({ name }) => name === 'studio_source_register');
  assert.equal(sourceTool.inputSchema.properties.actor, undefined);
  assert.equal(sourceTool.inputSchema.properties.grantId, undefined);
  assert.equal(sourceTool.inputSchema.additionalProperties, false);

  const resourceRequest = client.readResource({ uri: `studio://projects/${PROJECT_ID}` });
  for (let attempt = 0; attempt < 50 && fixture.pairingBroker.list(PROJECT_ID).length === 0; attempt += 1) {
    await new Promise((resolveWait) => setTimeout(resolveWait, 10));
  }
  const pendingHost = fixture.pairingBroker.list(PROJECT_ID)[0];
  assert.ok(pendingHost);
  const access = await fetch(`${fixture.serviceUrl}api/projects/${PROJECT_ID}/agent-access`).then((response) => response.json());
  const approvalResponse = await fetch(`${fixture.serviceUrl}api/projects/${PROJECT_ID}/agent-access/bindings`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: fixture.serviceUrl.slice(0, -1),
      'sec-fetch-site': 'same-origin',
      'x-numberdroid-studio-csrf': access.csrfToken,
    },
    body: JSON.stringify({
      pendingHostId: pendingHost.pendingHostId,
      confirm: true,
      idempotencyKey: 'official-mcp.pairing.approve',
    }),
  });
  assert.equal(approvalResponse.status, 201);
  const approval = await approvalResponse.json();
  assert.doesNotMatch(JSON.stringify(approval), /NUMBERDROID_STUDIO_BINDING_TOKEN|grant\.atlas|token/);
  const resource = await resourceRequest;
  const project = JSON.parse(resource.contents[0].text);
  assert.equal(project.revision, 2);
  assert.equal(project.snapshot.grants, undefined);
  assert.doesNotMatch(JSON.stringify(project), /grant\.atlas|binding\./);

  const malformed = await client.callTool({
    name: 'studio_source_register',
    arguments: {
      schemaVersion: 1,
      commandId: 'cmd.mcp.malformed',
      idempotencyKey: 'idem.mcp.malformed',
      projectId: PROJECT_ID,
      baseRevision: 2,
      expectedVersion: 2,
      payload: {
        name: 'Missing source id',
        artifactUri: fixture.artifact.uri,
        mediaType: 'image/png',
        provenance: { prompt: 'Schema validation must reject this input.' },
      },
    },
  });
  assert.equal(malformed.isError, true);
  assert.match(malformed.content[0].text, /^Input validation error:/);
  assert.equal(malformed.structuredContent, undefined);
  assert.equal((await fixture.studio.readProjectTrusted(PROJECT_ID)).revision, 2);

  const promptBoundary = await client.callTool({
    name: 'studio_source_register',
    arguments: {
      schemaVersion: 1,
      commandId: 'cmd.mcp.prompt-boundary',
      idempotencyKey: 'idem.mcp.prompt-boundary',
      projectId: PROJECT_ID,
      baseRevision: 2,
      expectedVersion: 2,
      payload: {
        sourceId: 'source.mcp-prompt-boundary',
        name: 'Prompt boundary source',
        artifactUri: fixture.artifact.uri,
        mediaType: 'image/png',
        width: 1,
        height: 1,
        provenance: { prompt: 'p'.repeat(20_001) },
      },
    },
  });
  assert.equal(promptBoundary.isError, true);
  assert.match(promptBoundary.content[0].text, /^Input validation error:/);
  assert.equal((await fixture.studio.readProjectTrusted(PROJECT_ID)).revision, 2);

  const oversizedSentinel = `oversized-seed-${'x'.repeat(1_100_000)}`;
  const oversized = await client.callTool({
    name: 'studio_source_register',
    arguments: {
      schemaVersion: 1,
      commandId: 'cmd.mcp.oversized',
      idempotencyKey: 'idem.mcp.oversized',
      projectId: PROJECT_ID,
      baseRevision: 2,
      expectedVersion: 2,
      payload: {
        sourceId: 'source.mcp-oversized',
        name: 'Oversized source',
        artifactUri: fixture.artifact.uri,
        mediaType: 'image/png',
        width: 1,
        height: 1,
        provenance: { prompt: 'Payload limit contract', seed: oversizedSentinel },
      },
    },
  });
  assert.equal(oversized.isError, true);
  assert.equal(oversized.structuredContent.error.code, 'BODY_TOO_LARGE');
  assert.match(oversized.content[0].text, /BODY_TOO_LARGE/);
  assert.doesNotMatch(JSON.stringify(oversized), /oversized-seed-xxxxxxxx/);
  assert.equal((await fixture.studio.readProjectTrusted(PROJECT_ID)).revision, 2);

  const mutation = await client.callTool({
    name: 'studio_source_register',
    arguments: {
      schemaVersion: 1,
      commandId: 'cmd.mcp.source',
      idempotencyKey: 'idem.mcp.source',
      projectId: PROJECT_ID,
      baseRevision: 2,
      expectedVersion: 2,
      dryRun: false,
      payload: {
        sourceId: 'source.mcp-atlas',
        name: 'MCP atlas',
        artifactUri: fixture.artifact.uri,
        mediaType: 'image/png',
        width: 1,
        height: 1,
        provenance: { prompt: 'Agent-authored atlas registration', seed: 742 },
      },
    },
  });
  assert.equal(mutation.isError, undefined, JSON.stringify(mutation));
  assert.equal(mutation.structuredContent.revision, 3);
  assert.equal(mutation.structuredContent.event.actor.id, AGENT.id);
  assert.doesNotMatch(JSON.stringify(mutation), /grant\.atlas|binding\./);
  assert.equal(fixture.store.workspace.database.prepare(`
    SELECT count(*) AS count FROM artifact_references
    WHERE project_id = ? AND owner_kind = 'source' AND owner_id = ? AND digest = ?
  `).get(PROJECT_ID, 'source.mcp-atlas', fixture.artifact.digest).count, 1);

  const spoof = await client.callTool({
    name: 'studio_source_register',
    arguments: {
      schemaVersion: 1,
      commandId: 'cmd.mcp.spoof',
      idempotencyKey: 'idem.mcp.spoof',
      projectId: PROJECT_ID,
      baseRevision: 3,
      expectedVersion: 3,
      payload: {
        sourceId: 'source.spoof',
        name: 'Spoof',
        artifactUri: 'studio://artifacts/sha256/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        mediaType: 'image/png',
        provenance: { prompt: 'Must be rejected' },
      },
      actor: { id: OWNER.id, kind: 'human' },
      grantId: 'grant.forged',
    },
  });
  assert.equal(spoof.isError, true);
  assert.equal((await fixture.studio.readProjectTrusted(PROJECT_ID)).revision, 3);

  await fixture.studio.execute(command({
    commandId: 'cmd.mcp.revoke',
    idempotencyKey: 'idem.mcp.revoke',
    type: 'grant.revoke',
    expectedVersion: 3,
    payload: { grantId: 'grant.atlas', reason: 'MCP revocation contract test' },
  }), OWNER_CONTEXT);
  const denied = await client.callTool({
    name: 'studio_project_status_set',
    arguments: {
      schemaVersion: 1,
      commandId: 'cmd.mcp.after-revoke',
      idempotencyKey: 'idem.mcp.after-revoke',
      projectId: PROJECT_ID,
      baseRevision: 4,
      expectedVersion: 4,
      dryRun: false,
      payload: { status: 'active' },
    },
  });
  assert.equal(denied.isError, true);
  assert.match(denied.content[0].text, /GRANT_REVOKED/);
  assert.doesNotMatch(JSON.stringify(denied), /grant\.atlas|binding\./);
  assert.equal((await fixture.studio.readProjectTrusted(PROJECT_ID)).revision, 4);

  await client.close();
});

test('official stdio MCP propagates cancellation to the local Studio request', async (context) => {
  let requestStartedResolve;
  let requestClosedResolve;
  const requestStarted = new Promise((resolveStarted) => { requestStartedResolve = resolveStarted; });
  const requestClosed = new Promise((resolveClosed) => { requestClosedResolve = resolveClosed; });
  let requestCount = 0;
  const slowService = createServer((request, response) => {
    requestCount += 1;
    if (requestCount === 1) {
      requestStartedResolve();
      response.once('close', requestClosedResolve);
      return;
    }
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({
      schemaVersion: 1,
      projectId: PROJECT_ID,
      revision: 7,
      snapshot: { project: { id: PROJECT_ID, name: 'Recovered after cancellation' } },
    }));
  });
  await new Promise((resolveListen, reject) => {
    slowService.once('error', reject);
    slowService.listen(0, '127.0.0.1', resolveListen);
  });
  context.after(() => {
    slowService.closeAllConnections();
    return new Promise((resolveClose) => slowService.close(resolveClose));
  });

  const client = new Client(
    { name: 'numberdroid-studio-cancellation-test', version: '1.0.0' },
    { versionNegotiation: { mode: { pin: '2026-07-28' } } },
  );
  context.after(() => client.close().catch(() => {}));
  await client.connect(childTransport({
    token: 'c'.repeat(43),
    serviceUrl: `http://127.0.0.1:${slowService.address().port}/`,
  }));

  const controller = new AbortController();
  const pending = client.callTool({
    name: 'studio_project_read',
    arguments: { schemaVersion: 1, projectId: PROJECT_ID },
  }, { signal: controller.signal });
  await requestStarted;
  controller.abort();
  await assert.rejects(pending, (error) => error?.code === SdkErrorCode.RequestTimeout);
  await Promise.race([
    requestClosed,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Cancelled Studio request remained open.')), 2_000)),
  ]);
  const recovered = await client.callTool({
    name: 'studio_project_read',
    arguments: { schemaVersion: 1, projectId: PROJECT_ID },
  });
  assert.equal(recovered.isError, undefined, JSON.stringify(recovered));
  assert.equal(recovered.structuredContent.revision, 7);
  await client.close();
});

test('official stdio MCP redacts malformed frame diagnostics', async (context) => {
  const fixture = await mcpFixture(context);
  const sentinel = 'PRIVATE_MALFORMED_FRAME_SENTINEL';
  const child = spawn(process.execPath, [resolve(studioRoot, 'apps/studio-mcp/src/main.js')], {
    cwd: studioRoot,
    env: {
      ...process.env,
      NUMBERDROID_STUDIO_PROJECT_ID: PROJECT_ID,
      NUMBERDROID_STUDIO_SERVICE_URL: fixture.serviceUrl,
      NUMBERDROID_STUDIO_BINDING_TOKEN: fixture.token,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  context.after(() => {
    child.kill('SIGKILL');
  });
  child.stdin.write(`{"jsonrpc":"2.0","sentinel":"${sentinel}"}\n`);
  await Promise.race([
    new Promise((resolveDiagnostic) => {
      const inspect = () => {
        if (stderr.includes('MCP_TRANSPORT_ERROR')) resolveDiagnostic();
      };
      child.stderr.on('data', inspect);
      inspect();
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Malformed frame produced no generic diagnostic.')), 2_000)),
  ]);
  assert.doesNotMatch(stdout, new RegExp(sentinel));
  assert.doesNotMatch(stderr, new RegExp(sentinel));
  assert.equal((await fixture.studio.readProjectTrusted(PROJECT_ID)).revision, 2);
});

test('official stdio MCP returns a structured, redacted service-unavailable error', async (context) => {
  const unavailable = createServer();
  await new Promise((resolveListen, reject) => {
    unavailable.once('error', reject);
    unavailable.listen(0, '127.0.0.1', resolveListen);
  });
  const port = unavailable.address().port;
  await new Promise((resolveClose) => unavailable.close(resolveClose));

  const token = 's'.repeat(43);
  const client = new Client(
    { name: 'numberdroid-studio-service-failure-test', version: '1.0.0' },
    { versionNegotiation: { mode: { pin: '2026-07-28' } } },
  );
  context.after(() => client.close().catch(() => {}));
  await client.connect(childTransport({
    token,
    serviceUrl: `http://127.0.0.1:${port}/`,
  }));
  const denied = await client.callTool({
    name: 'studio_project_read',
    arguments: { schemaVersion: 1, projectId: PROJECT_ID },
  });
  assert.equal(denied.isError, true);
  assert.equal(denied.structuredContent.error.code, 'STUDIO_SERVICE_UNAVAILABLE');
  assert.doesNotMatch(JSON.stringify(denied), new RegExp(token));

  let responseMode = 'malformed';
  const recoveredService = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    if (responseMode === 'malformed') {
      response.end('private-malformed-response');
      return;
    }
    response.end(JSON.stringify({
      schemaVersion: 1,
      projectId: PROJECT_ID,
      revision: 8,
      snapshot: { project: { id: PROJECT_ID, name: 'Recovered service' } },
    }));
  });
  await new Promise((resolveListen, reject) => {
    recoveredService.once('error', reject);
    recoveredService.listen(port, '127.0.0.1', resolveListen);
  });
  context.after(() => new Promise((resolveClose) => recoveredService.close(resolveClose)));
  const malformed = await client.callTool({
    name: 'studio_project_read',
    arguments: { schemaVersion: 1, projectId: PROJECT_ID },
  });
  assert.equal(malformed.isError, true);
  assert.equal(malformed.structuredContent.error.code, 'STUDIO_SERVICE_PROTOCOL_ERROR');
  assert.doesNotMatch(JSON.stringify(malformed), /private-malformed-response/);
  responseMode = 'valid';
  const recovered = await client.callTool({
    name: 'studio_project_read',
    arguments: { schemaVersion: 1, projectId: PROJECT_ID },
  });
  assert.equal(recovered.isError, undefined, JSON.stringify(recovered));
  assert.equal(recovered.structuredContent.revision, 8);
  await client.close();
});

test('official stdio MCP rejects an unbound bearer without leaking it', async (context) => {
  const fixture = await mcpFixture(context);
  const fakeToken = 'x'.repeat(43);
  const client = new Client(
    { name: 'numberdroid-studio-unbound-test', version: '1.0.0' },
    { versionNegotiation: { mode: { pin: '2026-07-28' } } },
  );
  context.after(() => client.close().catch(() => {}));
  await client.connect(childTransport({ ...fixture, token: fakeToken }));
  const denied = await client.callTool({
    name: 'studio_project_read',
    arguments: { schemaVersion: 1, projectId: PROJECT_ID },
  });
  assert.equal(denied.isError, true);
  assert.match(denied.content[0].text, /HOST_BINDING_NOT_FOUND/);
  assert.doesNotMatch(JSON.stringify(denied), new RegExp(fakeToken));
  await client.close();
});
