import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { SqliteHostBindingStore, SqliteProjectStore } from '../packages/persistence/src/index.js';
import { createStudioHttpServer } from '../apps/studio-server/src/server.js';
import {
  AGENT, OWNER, OWNER_CONTEXT, PROJECT_ID, command, createHarness, createProject, issueGrant,
} from './test-helpers.js';
import { nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';

const studioRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function mcpFixture(context) {
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-official-mcp-'));
  const store = await SqliteProjectStore.open({
    filename: join(directory, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  const { studio } = createHarness(store);
  await createProject(studio);
  await issueGrant(studio);
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
  const server = createStudioHttpServer({ studioService: studio, hostBindingStore: bindings });
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  context.after(async () => {
    await new Promise((resolveClose) => server.close(resolveClose));
    store.close();
    await rm(directory, { recursive: true, force: true });
  });
  return {
    studio,
    token: issued.token,
    serviceUrl: `http://127.0.0.1:${server.address().port}/`,
  };
}

function childTransport({ token, serviceUrl }) {
  return new StdioClientTransport({
    command: process.execPath,
    args: [resolve(studioRoot, 'apps/studio-mcp/src/main.js')],
    cwd: studioRoot,
    env: {
      ...process.env,
      NUMBERDROID_STUDIO_BINDING_TOKEN: token,
      NUMBERDROID_STUDIO_PROJECT_ID: PROJECT_ID,
      NUMBERDROID_STUDIO_SERVICE_URL: serviceUrl,
    },
    stderr: 'pipe',
  });
}

test('official stdio MCP pins 2026-07-28 and preserves HostBinding authority', async (context) => {
  const fixture = await mcpFixture(context);
  const client = new Client(
    { name: 'numberdroid-studio-contract-test', version: '1.0.0' },
    { versionNegotiation: { mode: { pin: '2026-07-28' } } },
  );
  const transport = childTransport(fixture);
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

  const resource = await client.readResource({ uri: `studio://projects/${PROJECT_ID}` });
  const project = JSON.parse(resource.contents[0].text);
  assert.equal(project.revision, 2);
  assert.equal(project.snapshot.grants, undefined);
  assert.doesNotMatch(JSON.stringify(project), /grant\.atlas|binding\./);

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
        artifactUri: 'studio://artifacts/sha256/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        mediaType: 'image/png',
        width: 1024,
        height: 1024,
        provenance: { prompt: 'Agent-authored atlas registration', seed: 742 },
      },
    },
  });
  assert.equal(mutation.isError, undefined, JSON.stringify(mutation));
  assert.equal(mutation.structuredContent.revision, 3);
  assert.equal(mutation.structuredContent.event.actor.id, AGENT.id);
  assert.doesNotMatch(JSON.stringify(mutation), /grant\.atlas|binding\./);

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
  assert.equal((await fixture.studio.readProjectTrusted(PROJECT_ID)).revision, 4);

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
