import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteHostBindingStore, SqliteProjectStore } from '../packages/persistence/src/index.js';
import { createStudioHttpServer } from '../apps/studio-server/src/server.js';
import {
  AGENT, OWNER, OWNER_CONTEXT, PROJECT_ID, agentSourceCommand, command,
  createHarness, createProject, issueGrant,
} from './test-helpers.js';
import { nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';

async function fixture(context) {
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-host-binding-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const store = await SqliteProjectStore.open({
    filename: join(directory, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  context.after(() => store.close());
  const { studio } = createHarness(store);
  await createProject(studio);
  await issueGrant(studio);
  const bindingStore = new SqliteHostBindingStore({
    workspace: store.workspace,
    clock: () => '2026-08-21T12:00:10.000Z',
  });
  return { directory, store, studio, bindingStore };
}

async function listen(context, studioService, hostBindingStore) {
  const server = createStudioHttpServer({ studioService, hostBindingStore });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

function post(base, path, token, body) {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('HostBindings persist only a digest and resolve exact grant authority', async (context) => {
  const { store, bindingStore } = await fixture(context);
  const issued = bindingStore.issue({
    projectId: PROJECT_ID,
    grantId: 'grant.atlas',
    agentId: AGENT.id,
    taskId: 'task.atlas',
    branchId: 'branch.task.atlas',
    issuedBy: OWNER.id,
  });
  assert.match(issued.token, /^[A-Za-z0-9_-]{40,}$/);
  assert.equal(issued.binding.status, 'ACTIVE');
  const row = store.workspace.database.prepare('SELECT * FROM host_bindings').get();
  assert.match(row.token_digest, /^[a-f0-9]{64}$/);
  assert.notEqual(row.token_digest, issued.token);
  assert.doesNotMatch(JSON.stringify(row), new RegExp(issued.token));

  const resolved = bindingStore.resolve(issued.token);
  assert.equal(resolved.projectId, PROJECT_ID);
  assert.equal(resolved.grantId, 'grant.atlas');
  assert.deepEqual(resolved.actor, { id: AGENT.id, kind: 'agent', displayName: null });
  assert.equal(resolved.taskId, 'task.atlas');
  assert.equal(resolved.branchId, 'branch.task.atlas');
  await assert.rejects(
    Promise.resolve().then(() => bindingStore.resolve('x'.repeat(43))),
    (error) => error.code === 'HOST_BINDING_NOT_FOUND',
  );

  const visible = bindingStore.listForProject(PROJECT_ID);
  assert.equal(visible.length, 1);
  assert.equal(visible[0].grantId, undefined);
  assert.doesNotMatch(JSON.stringify(visible), /grant\.atlas|token/);
});

test('private loopback bridge resolves HostBinding per call and revocation blocks the next call', async (context) => {
  const { studio, bindingStore } = await fixture(context);
  const issued = bindingStore.issue({
    projectId: PROJECT_ID,
    grantId: 'grant.atlas',
    agentId: AGENT.id,
    taskId: 'task.atlas',
    branchId: 'branch.task.atlas',
    issuedBy: OWNER.id,
  });
  const base = await listen(context, studio, bindingStore);

  const readResponse = await post(base, '/internal/mcp/read-project', issued.token, {
    schemaVersion: 1,
    projectId: PROJECT_ID,
  });
  assert.equal(readResponse.status, 200);
  const read = await readResponse.json();
  assert.equal(read.revision, 2);
  assert.equal(read.snapshot.grants, undefined);
  assert.doesNotMatch(JSON.stringify(read), /grant\.atlas|binding\./);

  const source = agentSourceCommand();
  const executeResponse = await post(base, '/internal/mcp/execute', issued.token, {
    schemaVersion: 1,
    command: source,
  });
  assert.equal(executeResponse.status, 200);
  const executed = await executeResponse.json();
  assert.equal(executed.revision, 3);
  assert.equal(executed.event.actor.id, AGENT.id);
  assert.equal(executed.event.taskId, 'task.atlas');
  assert.doesNotMatch(JSON.stringify(executed), /grant\.atlas|binding\./);

  const crossProject = await post(base, '/internal/mcp/read-project', issued.token, {
    schemaVersion: 1,
    projectId: 'project.other',
  });
  assert.equal(crossProject.status, 403);
  assert.equal((await crossProject.json()).error.code, 'CONTEXT_PROJECT_MISMATCH');

  const access = await fetch(`${base}/api/projects/${PROJECT_ID}/agent-access`).then((response) => response.json());
  const narrowedResponse = await fetch(`${base}/api/projects/${PROJECT_ID}/agent-access`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: base,
      'sec-fetch-site': 'same-origin',
      'x-numberdroid-studio-csrf': access.csrfToken,
    },
    body: JSON.stringify({ mode: 'read_only', idempotencyKey: 'binding.narrow.read-only' }),
  });
  assert.equal(narrowedResponse.status, 200);
  assert.equal((await narrowedResponse.json()).effectivePolicy.mode, 'read_only');
  const rebound = bindingStore.resolve(issued.token);
  assert.notEqual(rebound.grantId, 'grant.atlas');
  const reboundRead = await post(base, '/internal/mcp/read-project', issued.token, {
    schemaVersion: 1,
    projectId: PROJECT_ID,
  });
  assert.equal(reboundRead.status, 200);
  assert.equal((await reboundRead.json()).revision, 5);
  const deniedWrite = await post(base, '/internal/mcp/execute', issued.token, {
    schemaVersion: 1,
    command: agentSourceCommand({
      commandId: 'cmd.denied.after-narrow',
      idempotencyKey: 'idem.denied.after-narrow',
      expectedVersion: 5,
    }),
  });
  assert.equal(deniedWrite.status, 403);
  assert.equal((await deniedWrite.json()).error.code, 'GRANT_SCOPE_MISSING');

  await studio.execute(command({
    commandId: 'cmd.revoke.after-binding',
    idempotencyKey: 'idem.revoke.after-binding',
    type: 'grant.revoke',
    expectedVersion: 5,
    payload: { grantId: rebound.grantId, reason: 'test immediate revocation' },
  }), OWNER_CONTEXT);
  const denied = await post(base, '/internal/mcp/read-project', issued.token, {
    schemaVersion: 1,
    projectId: PROJECT_ID,
  });
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).error.code, 'GRANT_REVOKED');

  bindingStore.revoke(issued.binding.bindingId, { revokedBy: OWNER.id, reason: 'host stopped' });
  assert.throws(() => bindingStore.resolve(issued.token), (error) => error.code === 'HOST_BINDING_REVOKED');
});

test('HostBinding issue refuses mismatched, legacy, or inactive grant coordinates', async (context) => {
  const { bindingStore } = await fixture(context);
  assert.throws(() => bindingStore.issue({
    projectId: PROJECT_ID,
    grantId: 'grant.atlas',
    agentId: 'agent.forged',
    taskId: 'task.atlas',
    branchId: 'branch.task.atlas',
    issuedBy: OWNER.id,
  }), (error) => error.code === 'HOST_BINDING_GRANT_MISMATCH');
});
