import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteHostBindingStore, SqliteProjectStore } from '../packages/persistence/src/index.js';
import { createStudioHttpServer, startStudioHttpServer } from '../apps/studio-server/src/server.js';
import { createHumanAgentAccessController } from '../apps/studio-server/src/human-agent-access.js';
import {
  defaultMcpPairingEndpoint, McpPairingBroker, startMcpPairingSocket,
} from '../apps/studio-server/src/mcp-pairing-broker.js';
import { pairWithStudio } from '../apps/studio-mcp/src/pairing-client.js';
import {
  AGENT, OWNER, OWNER_CONTEXT, PROJECT_ID, command,
  createHarness, createProject, issueGrant,
} from './test-helpers.js';
import { afterTestCleanup, nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';

async function fixture(context) {
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-host-binding-'));
  afterTestCleanup(context, () => rm(directory, { recursive: true, force: true }));
  const store = await SqliteProjectStore.open({
    filename: join(directory, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  afterTestCleanup(context, () => store.close());
  const { studio } = createHarness(store);
  await createProject(studio);
  await issueGrant(studio, { scopes: ['project.read', 'source.write', 'asset.write', 'project.status.write'] });
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
  afterTestCleanup(context, () => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

async function listenWithPairing(context, directory, studioService, hostBindingStore) {
  const pairingBroker = new McpPairingBroker();
  const pairingEndpoint = defaultMcpPairingEndpoint(directory);
  const pairing = await startMcpPairingSocket({ broker: pairingBroker, endpoint: pairingEndpoint });
  afterTestCleanup(context, () => pairing.close());
  const server = createStudioHttpServer({
    studioService, hostBindingStore, pairingBroker, pairingEndpoint: pairing.endpoint,
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  afterTestCleanup(context, () => new Promise((resolve) => server.close(resolve)));
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    pairingBroker,
    pairingEndpoint: pairing.endpoint,
  };
}

function post(base, path, token, body) {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('started Studio shares its injected clock with HostBinding expiry checks', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-host-binding-clock-'));
  afterTestCleanup(context, () => rm(directory, { recursive: true, force: true }));
  const now = '2026-08-22T11:00:00.000Z';
  const running = await startStudioHttpServer({
    dataDirectory: directory,
    port: 0,
    clock: () => now,
  });
  afterTestCleanup(context, () => new Promise((resolve) => running.server.close(resolve)));
  await createProject(running.studioService);
  await issueGrant(running.studioService);

  const { binding } = running.hostBindingStore.issue({
    projectId: PROJECT_ID,
    grantId: 'grant.atlas',
    agentId: AGENT.id,
    taskId: 'task.atlas',
    branchId: 'branch.task.atlas',
    issuedBy: OWNER.id,
    expiresAt: '2026-08-22T11:00:01.000Z',
  });

  assert.equal(binding.issuedAt, now);
  assert.equal(binding.status, 'ACTIVE');
});

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

test('HostBinding resolution closes current Grant status, expiry, and coordinates', async (context) => {
  const cases = [
    {
      name: 'revoked grant',
      code: 'GRANT_REVOKED',
      visibleStatus: 'REVOKED',
      update: `
        UPDATE grants
        SET authorization_status = 'REVOKED', status = 'REVOKED',
          revoked_at = '2026-08-21T12:00:09.000Z'
        WHERE project_id = ? AND grant_id = ?
      `,
    },
    {
      name: 'legacy-unbound grant',
      code: 'GRANT_REQUIRED',
      visibleStatus: 'REVOKED',
      update: `
        UPDATE grants
        SET authorization_status = 'LEGACY_UNBOUND', status = 'LEGACY_UNBOUND'
        WHERE project_id = ? AND grant_id = ?
      `,
    },
    {
      name: 'expired grant',
      code: 'GRANT_EXPIRED',
      visibleStatus: 'EXPIRED',
      update: `
        UPDATE grants
        SET authorization_status = 'ACTIVE', status = 'ACTIVE',
          expires_at = '2026-08-21T12:00:09.000Z'
        WHERE project_id = ? AND grant_id = ?
      `,
    },
    {
      name: 'grant status drift',
      code: 'GRANT_REVOKED',
      visibleStatus: 'REVOKED',
      update: `
        UPDATE grants
        SET status = 'REVOKED'
        WHERE project_id = ? AND grant_id = ?
      `,
    },
    {
      name: 'grant coordinate drift',
      code: 'HOST_BINDING_GRANT_MISMATCH',
      visibleStatus: null,
      update: `
        UPDATE grants
        SET agent_id = 'agent.drifted'
        WHERE project_id = ? AND grant_id = ?
      `,
    },
  ];
  for (const candidate of cases) {
    await context.test(candidate.name, async (subtest) => {
      const { store, bindingStore } = await fixture(subtest);
      const issued = bindingStore.issue({
        projectId: PROJECT_ID,
        grantId: 'grant.atlas',
        agentId: AGENT.id,
        taskId: 'task.atlas',
        branchId: 'branch.task.atlas',
        issuedBy: OWNER.id,
      });
      store.workspace.database.prepare(candidate.update).run(PROJECT_ID, 'grant.atlas');
      assert.throws(
        () => bindingStore.resolve(issued.token),
        (error) => error.code === candidate.code,
      );
      if (candidate.visibleStatus !== null) {
        assert.equal(bindingStore.listForProject(PROJECT_ID)[0].status, candidate.visibleStatus);
        const attemptSubject = bindingStore.resolveAttemptSubject(issued.token);
        assert.equal(attemptSubject.kind, 'studio.host-binding-attempt-subject');
        assert.equal(attemptSubject.authorization, 'NOT_GRANTED');
        assert.equal(attemptSubject.projectId, PROJECT_ID);
      } else {
        assert.throws(
          () => bindingStore.resolveAttemptSubject(issued.token),
          (error) => error.code === candidate.code,
        );
      }
    });
  }
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

  const source = command({
    commandId: 'cmd.host.status',
    idempotencyKey: 'idem.host.status',
    type: 'project.status.set',
    expectedVersion: 2,
    payload: { status: 'active', note: 'HostBinding execution proof' },
  });
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
    body: JSON.stringify({
      mode: 'read_only', confirmBroaderAccess: true, idempotencyKey: 'binding.narrow.read-only',
    }),
  });
  assert.equal(narrowedResponse.status, 200);
  const narrowed = await narrowedResponse.json();
  assert.equal(narrowed.effectivePolicy.mode, 'read_only');
  assert.equal(narrowed.hostBindings[0].status, 'REVOKED');
  assert.throws(() => bindingStore.resolve(issued.token), (error) => error.code === 'HOST_BINDING_REVOKED');
  const staleBindingRead = await post(base, '/internal/mcp/read-project', issued.token, {
    schemaVersion: 1,
    projectId: PROJECT_ID,
  });
  assert.equal(staleBindingRead.status, 403);
  assert.equal((await staleBindingRead.json()).error.code, 'HOST_BINDING_REVOKED');

  const narrowedProject = await studio.readProjectTrusted(PROJECT_ID);
  const narrowedGrant = narrowedProject.snapshot.grants.find((grant) => !grant.revokedAt);
  const freshBinding = bindingStore.issue({
    projectId: PROJECT_ID,
    grantId: narrowedGrant.id,
    agentId: narrowedGrant.agentId,
    taskId: narrowedGrant.taskId,
    branchId: narrowedGrant.branchId,
    issuedBy: OWNER.id,
    expiresAt: narrowedGrant.expiresAt,
  });
  const freshToken = freshBinding.token;
  const reboundRead = await post(base, '/internal/mcp/read-project', freshToken, {
    schemaVersion: 1,
    projectId: PROJECT_ID,
  });
  assert.equal(reboundRead.status, 200);
  assert.equal((await reboundRead.json()).revision, 5);
  const deniedWrite = await post(base, '/internal/mcp/execute', freshToken, {
    schemaVersion: 1,
    command: command({
      commandId: 'cmd.denied.after-narrow',
      idempotencyKey: 'idem.denied.after-narrow',
      type: 'project.status.set',
      expectedVersion: 5,
      payload: { status: 'paused' },
    }),
  });
  assert.equal(deniedWrite.status, 403);
  assert.equal((await deniedWrite.json()).error.code, 'GRANT_SCOPE_MISSING');

  const current = await studio.readProjectTrusted(PROJECT_ID);
  const activeGrant = current.snapshot.grants.find((grant) => !grant.revokedAt);
  await studio.execute(command({
    commandId: 'cmd.revoke.after-binding',
    idempotencyKey: 'idem.revoke.after-binding',
    type: 'grant.revoke',
    expectedVersion: 5,
    payload: { grantId: activeGrant.id, reason: 'test immediate revocation' },
  }), OWNER_CONTEXT);
  const denied = await post(base, '/internal/mcp/read-project', freshToken, {
    schemaVersion: 1,
    projectId: PROJECT_ID,
  });
  assert.equal(denied.status, 403);
  const deniedBody = await denied.json();
  assert.equal(deniedBody.error.code, 'GRANT_REVOKED');
  assert.doesNotMatch(JSON.stringify(deniedBody), /grant\.|binding\./);

  bindingStore.revoke(freshBinding.binding.bindingId, { revokedBy: OWNER.id, reason: 'host stopped' });
  assert.throws(() => bindingStore.resolve(freshToken), (error) => error.code === 'HOST_BINDING_REVOKED');
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

test('human UI authorizes a private pending MCP host without receiving its credential', async (context) => {
  const { directory, studio, bindingStore } = await fixture(context);
  const { base, pairingBroker, pairingEndpoint } = await listenWithPairing(context, directory, studio, bindingStore);
  const access = await fetch(`${base}/api/projects/${PROJECT_ID}/agent-access`).then((response) => response.json());
  const headers = {
    'content-type': 'application/json',
    origin: base,
    'sec-fetch-site': 'same-origin',
    'x-numberdroid-studio-csrf': access.csrfToken,
  };

  assert.equal(access.hostBindingSupport, 'AVAILABLE');
  assert.equal(access.mcpLauncherConfig.mcpServers.numberdroidStudio.env.NUMBERDROID_STUDIO_PAIRING_ENDPOINT, pairingEndpoint);
  assert.equal(access.mcpLauncherConfig.mcpServers.numberdroidStudio.env.NUMBERDROID_STUDIO_BINDING_TOKEN, undefined);
  assert.doesNotMatch(JSON.stringify(access), /NUMBERDROID_STUDIO_BINDING_TOKEN/);

  const pairedToken = pairWithStudio({ endpoint: pairingEndpoint, projectId: PROJECT_ID, label: 'Contract host' });
  for (let attempt = 0; attempt < 50 && pairingBroker.list(PROJECT_ID).length === 0; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  const pending = pairingBroker.list(PROJECT_ID)[0];
  assert.equal(pending.label, 'Contract host');
  assert.match(pending.verificationCode, /^\d{6}$/);

  const approve = () => fetch(`${base}/api/projects/${PROJECT_ID}/agent-access/bindings`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      pendingHostId: pending.pendingHostId,
      confirm: true,
      idempotencyKey: 'binding.approve.contract-host',
    }),
  });
  const approvalResponses = await Promise.all([approve(), approve()]);
  assert.deepEqual(approvalResponses.map((response) => response.status), [201, 201]);
  const approvals = await Promise.all(approvalResponses.map((response) => response.json()));
  assert.deepEqual(approvals.map(({ idempotentReplay }) => idempotentReplay).sort(), [false, true]);
  const issued = approvals.find(({ idempotentReplay }) => !idempotentReplay);
  assert.equal(issued.binding.grantId, undefined);
  assert.equal(issued.binding.projectId, PROJECT_ID);
  assert.equal(issued.binding.status, 'ACTIVE');
  assert.equal(issued.token, undefined);
  assert.equal(issued.mcpConfig, undefined);
  assert.doesNotMatch(JSON.stringify(issued), /NUMBERDROID_STUDIO_BINDING_TOKEN|grant\.atlas/);
  const token = await pairedToken;
  assert.match(token, /^[A-Za-z0-9_-]{40,}$/);

  const visible = await fetch(`${base}/api/projects/${PROJECT_ID}/agent-access`).then((response) => response.json());
  assert.equal(visible.hostBindingSupport, 'AVAILABLE');
  assert.equal(visible.hostBindings.length, 1);
  assert.equal(visible.hostBindings[0].grantId, undefined);
  assert.doesNotMatch(JSON.stringify(visible), new RegExp(token));

  const read = await post(base, '/internal/mcp/read-project', token, {
    schemaVersion: 1, projectId: PROJECT_ID,
  });
  assert.equal(read.status, 200);

  const revoke = await fetch(
    `${base}/api/projects/${PROJECT_ID}/agent-access/bindings/${encodeURIComponent(issued.binding.bindingId)}/revoke`,
    { method: 'POST', headers, body: JSON.stringify({ idempotencyKey: 'binding.revoke.contract-host' }) },
  );
  assert.equal(revoke.status, 200);
  assert.equal((await revoke.json()).bindingId, issued.binding.bindingId);
  assert.throws(() => bindingStore.resolve(token), (error) => error.code === 'HOST_BINDING_REVOKED');
  assert.throws(
    () => bindingStore.resolveAttemptSubject(token),
    (error) => error.code === 'HOST_BINDING_REVOKED',
  );

  const revokeReplay = await fetch(
    `${base}/api/projects/${PROJECT_ID}/agent-access/bindings/${encodeURIComponent(issued.binding.bindingId)}/revoke`,
    { method: 'POST', headers, body: JSON.stringify({ idempotencyKey: 'binding.revoke.contract-host' }) },
  ).then((response) => response.json());
  assert.equal(revokeReplay.idempotentReplay, true);

  const revokedVisible = await fetch(`${base}/api/projects/${PROJECT_ID}/agent-access`).then((response) => response.json());
  assert.equal(revokedVisible.hostBindings[0].status, 'REVOKED');
  assert.equal(revokedVisible.hostBindings[0].grantId, undefined);
});

test('turning Agent access off permanently revokes bindings so later re-enable cannot resurrect them', async (context) => {
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
  const access = await fetch(`${base}/api/projects/${PROJECT_ID}/agent-access`).then((response) => response.json());
  const headers = {
    'content-type': 'application/json',
    origin: base,
    'sec-fetch-site': 'same-origin',
    'x-numberdroid-studio-csrf': access.csrfToken,
  };
  const change = (body) => fetch(`${base}/api/projects/${PROJECT_ID}/agent-access`, {
    method: 'POST', headers, body: JSON.stringify(body),
  });

  const off = await change({ mode: 'off', idempotencyKey: 'binding.off' });
  assert.equal(off.status, 200);
  assert.equal((await off.json()).hostBindings[0].status, 'REVOKED');
  assert.throws(() => bindingStore.resolve(issued.token), (error) => error.code === 'HOST_BINDING_REVOKED');

  const on = await change({
    mode: 'read_only', confirmBroaderAccess: true, idempotencyKey: 'binding.on-again',
  });
  assert.equal(on.status, 200);
  assert.equal((await on.json()).effectivePolicy.mode, 'read_only');
  assert.throws(() => bindingStore.resolve(issued.token), (error) => error.code === 'HOST_BINDING_REVOKED');
});

test('Header Agent access idempotency survives controller restart and rejects key reuse before mutation', async (context) => {
  const { studio, bindingStore } = await fixture(context);
  const first = createHumanAgentAccessController({ studioService: studio, hostBindingStore: bindingStore });
  const changed = await first.change(PROJECT_ID, {
    mode: 'read_only', idempotencyKey: 'durable.header.read-only',
  });
  assert.equal(changed.changed, true);
  assert.equal(changed.idempotentReplay, false);
  const afterChange = await studio.readProjectTrusted(PROJECT_ID);

  const restarted = createHumanAgentAccessController({ studioService: studio, hostBindingStore: bindingStore });
  const replay = await restarted.change(PROJECT_ID, {
    mode: 'read_only', idempotencyKey: 'durable.header.read-only',
  });
  assert.equal(replay.changed, true);
  assert.equal(replay.idempotentReplay, true);
  assert.deepEqual(await studio.readProjectTrusted(PROJECT_ID), afterChange);

  await assert.rejects(
    restarted.change(PROJECT_ID, {
      mode: 'execute_scoped', confirmBroaderAccess: true, idempotencyKey: 'durable.header.read-only',
    }),
    (error) => error.code === 'IDEMPOTENCY_CONFLICT',
  );
  assert.deepEqual(await studio.readProjectTrusted(PROJECT_ID), afterChange);
});

test('Off revokes every active grant instead of falling back to an older grant', async (context) => {
  const { studio, bindingStore } = await fixture(context);
  await studio.execute(command({
    commandId: 'cmd.grant.second-active',
    idempotencyKey: 'idem.grant.second-active',
    type: 'grant.issue',
    expectedVersion: 2,
    payload: {
      grantId: 'grant.second-active',
      agentId: AGENT.id,
      taskId: 'task.second-active',
      branchId: 'branch.second-active',
      scopes: ['project.read'],
      objectScopes: [{ kind: 'project', id: PROJECT_ID }],
      budget: { maxCommands: 10, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 },
    },
  }), OWNER_CONTEXT);
  const controller = createHumanAgentAccessController({ studioService: studio, hostBindingStore: bindingStore });
  const result = await controller.change(PROJECT_ID, { mode: 'off', idempotencyKey: 'off.all-active' });
  assert.equal(result.effectivePolicy.mode, 'off');
  const project = await studio.readProjectTrusted(PROJECT_ID);
  assert.equal(project.snapshot.grants.filter((grant) => !grant.revokedAt).length, 0);
});

test('scope additions require confirmation even when the coarse policy label is unchanged', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-capability-diff-'));
  afterTestCleanup(context, () => rm(directory, { recursive: true, force: true }));
  const store = await SqliteProjectStore.open({
    filename: join(directory, 'studio.sqlite'), databaseFactory: nodeSqliteDatabaseFactory,
  });
  afterTestCleanup(context, () => store.close());
  const { studio } = createHarness(store);
  await createProject(studio);
  await issueGrant(studio, { scopes: ['project.read', 'project.status.write'] });
  const bindingStore = new SqliteHostBindingStore({ workspace: store.workspace });
  const controller = createHumanAgentAccessController({ studioService: studio, hostBindingStore: bindingStore });
  await assert.rejects(
    controller.change(PROJECT_ID, { mode: 'execute_scoped', idempotencyKey: 'execute.add-capabilities' }),
    (error) => error.code === 'BROADER_ACCESS_CONFIRMATION_REQUIRED'
      && error.details.scopes.includes('source.write') && error.details.scopes.includes('asset.write'),
  );
  assert.equal((await studio.readProjectTrusted(PROJECT_ID)).revision, 2);
});

test('failed pairing delivery revokes the ghost binding and abandons its operation', async (context) => {
  const { studio, store, bindingStore } = await fixture(context);
  const vanishedBroker = {
    get() { return { pendingHostId: 'pending-host.vanished' }; },
    approve() { throw Object.assign(new Error('host disconnected'), { code: 'HOST_PAIRING_NOT_FOUND' }); },
    list() { return []; },
  };
  const controller = createHumanAgentAccessController({
    studioService: studio, hostBindingStore: bindingStore, pairingBroker: vanishedBroker,
  });
  await assert.rejects(controller.createBinding(PROJECT_ID, {
    pendingHostId: 'pending-host.vanished',
    confirm: true,
    idempotencyKey: 'pairing.vanished',
  }), (error) => error.code === 'HOST_PAIRING_NOT_FOUND');
  assert.equal(bindingStore.listForProject(PROJECT_ID).filter((binding) => binding.status === 'ACTIVE').length, 0);
  assert.equal(store.workspace.database.prepare(
    "SELECT count(*) AS count FROM human_agent_access_operations WHERE idempotency_key LIKE 'binding-approve.%'",
  ).get().count, 0);
});

test('pairing shutdown closes a waiting host without waiting for the socket TTL', async () => {
  const broker = new McpPairingBroker();
  const pairing = await startMcpPairingSocket({ broker, endpoint: 'tcp://127.0.0.1:0' });
  const waiting = pairWithStudio({ endpoint: pairing.endpoint, projectId: PROJECT_ID, label: 'Shutdown host' });
  for (let attempt = 0; attempt < 50 && broker.list(PROJECT_ID).length === 0; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(broker.list(PROJECT_ID).length, 1);
  await pairing.close();
  await assert.rejects(waiting);
});
