import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  AUTHORING_V2_SURFACE_NEGOTIATION_REQUEST_KIND,
  AgentTaskService,
  FixedProjectCapabilityProvider,
  StudioService,
} from '../packages/application/src/index.js';
import {
  AUTHORING_V2_FEATURE_ID,
  AUTHORING_V2_PROCESSING_RESULT_ADOPTION_TOOL,
  AUTHORING_V2_SCHEMA_VERSION,
  PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE,
  listAuthoringV2GrantScopes,
} from '../packages/domain/src/index.js';
import {
  NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT,
  NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST,
} from '../packages/numberdroid-adapter/src/index.js';
import {
  SqliteAgentTaskStore,
  SqliteProjectStore,
  TaskBranchProjectStore,
} from '../packages/persistence/src/index.js';
import {
  createStudioHttpServer,
  startStudioHttpServer,
} from '../apps/studio-server/src/server.js';
import {
  AGENT,
  OWNER,
  OWNER_CONTEXT,
  PROJECT_ID,
  command,
  createHarness,
  createProject,
} from './test-helpers.js';
import { nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';

const NOW = '2026-08-28T16:00:00.000Z';
const EXPIRES_AT = '2026-08-29T16:00:00.000Z';
const TASK_ID = 'task.authoring-v2.transport';
const BRANCH_ID = 'branch.authoring-v2.transport';
const ASSET_ID = 'asset.authoring-v2.transport';

async function listen(context, server) {
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  context.after(() => new Promise((resolveClose, rejectClose) => {
    server.close((error) => (error ? rejectClose(error) : resolveClose()));
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

async function post(baseUrl, path, token, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return { response, body: await response.json() };
}

function handshakeRequest(overrides = {}) {
  return {
    schemaVersion: AUTHORING_V2_SCHEMA_VERSION,
    kind: AUTHORING_V2_SURFACE_NEGOTIATION_REQUEST_KIND,
    featureId: AUTHORING_V2_FEATURE_ID,
    projectId: PROJECT_ID,
    expectedProfileFingerprint: NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT,
    ...overrides,
  };
}

function capabilitiesRequest(overrides = {}) {
  return {
    schemaVersion: AUTHORING_V2_SCHEMA_VERSION,
    featureId: AUTHORING_V2_FEATURE_ID,
    projectId: PROJECT_ID,
    ...overrides,
  };
}

async function transportFixture(context, {
  authoringV2CapabilityProvider = null,
  exhaustBudget = false,
} = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-authoring-v2-transport-'));
  const seedStore = await SqliteProjectStore.open({
    filename: join(directory, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  const grantScopes = listAuthoringV2GrantScopes();
  const capabilityProvider = new FixedProjectCapabilityProvider({
    manifest: NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST,
  });
  const seedStudio = new StudioService({
    store: seedStore,
    clock: () => NOW,
    capabilityProvider,
    grantScopes,
  });
  await createProject(seedStudio);
  const taskStore = new SqliteAgentTaskStore({ workspace: seedStore.workspace });
  const seedTasks = new AgentTaskService({
    studioService: seedStudio,
    projectStore: seedStore,
    taskStore,
    createBranchStore: ({ projectId, taskId }) => new TaskBranchProjectStore({
      taskStore,
      projectId,
      taskId,
    }),
    clock: () => NOW,
    capabilityProvider,
    grantScopes,
  });
  const created = await seedTasks.createTask({
    projectId: PROJECT_ID,
    task: {
      taskId: TASK_ID,
      branchId: BRANCH_ID,
      agentId: AGENT.id,
      title: 'Negotiate the private Authoring-v2 transport',
      objective: 'Expose one exact branch-local processing-result adoption operation.',
      capabilities: [
        PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE,
        ...(exhaustBudget ? ['project.status.write'] : []),
      ],
      objectScopes: [
        { kind: 'project', id: PROJECT_ID },
        { kind: 'asset', id: ASSET_ID },
      ],
      budget: { maxCommands: 1, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 },
      expiresAt: EXPIRES_AT,
      autoAcceptPolicy: { enabled: false, allowedCommandTypes: [], maxChanges: 0 },
    },
  }, OWNER_CONTEXT);
  if (exhaustBudget) {
    await seedTasks.execute(command({
      commandId: 'cmd.authoring-v2.transport.exhaust',
      idempotencyKey: 'idem.authoring-v2.transport.exhaust',
      type: 'project.status.set',
      expectedVersion: created.task.baseRevision,
      payload: { status: 'paused' },
    }), {
      actor: AGENT,
      taskId: created.task.taskId,
      grantId: created.task.grantId,
      branchId: created.task.branchId,
      correlationId: 'transport.seed.exhaust',
    });
  }
  seedStore.close();
  const running = await startStudioHttpServer({
    dataDirectory: directory,
    host: '127.0.0.1',
    port: 0,
    clock: () => NOW,
    authoringV2CapabilityProvider,
  });
  context.after(async () => {
    await new Promise((resolveClose, rejectClose) => {
      running.server.close((error) => (error ? rejectClose(error) : resolveClose()));
    });
    await rm(directory, { recursive: true, force: true });
  });
  const issued = running.hostBindingStore.issue({
    projectId: PROJECT_ID,
    grantId: created.task.grantId,
    agentId: AGENT.id,
    taskId: created.task.taskId,
    branchId: created.task.branchId,
    issuedBy: OWNER.id,
    expiresAt: EXPIRES_AT,
  });
  return {
    running,
    created,
    token: issued.token,
    baseUrl: `http://127.0.0.1:${running.address.port}`,
  };
}

test('a directly constructed HTTP server has no Authoring-v2 runtime backdoor', async (context) => {
  const { studio } = createHarness();
  const baseUrl = await listen(context, createStudioHttpServer({ studioService: studio }));
  const result = await post(
    baseUrl,
    '/internal/mcp/authoring-v2/handshake',
    'not-a-binding',
    handshakeRequest(),
  );
  assert.equal(result.response.status, 503);
  assert.equal(result.body.error.code, 'AUTHORING_V2_TRANSPORT_UNAVAILABLE');
  assert.doesNotMatch(JSON.stringify(result.body), /runtime|weakmap|sqlite|bindingToken/i);
});

test('private v2 routes require a positive exact handshake and audit only attributable failures', async (context) => {
  const value = await transportFixture(context);
  assert.deepEqual(
    Object.keys(value.running).filter((key) => /authoring|capability|adoption|runtime|session/i.test(key)),
    [],
  );

  const handshake = await post(
    value.baseUrl,
    '/internal/mcp/authoring-v2/handshake',
    value.token,
    handshakeRequest(),
  );
  assert.equal(handshake.response.status, 200);
  assert.equal(handshake.body.status, 'READY');
  assert.equal(handshake.body.budgetState, 'AVAILABLE');
  assert.equal(handshake.body.profile.fingerprint, NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT);
  assert.equal(handshake.body.commandFeatures.length, 1);
  assert.doesNotMatch(JSON.stringify(handshake.body), /bindingId|grantId|taskId|branchId|token/i);

  const capabilities = await post(
    value.baseUrl,
    '/internal/mcp/authoring-v2/capabilities',
    value.token,
    capabilitiesRequest(),
  );
  assert.equal(capabilities.response.status, 200);
  assert.equal(capabilities.body.profile.fingerprint, NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT);
  assert.equal(capabilities.body.profile.manifest.profileVersion, 2);
  assert.equal(value.running.agentAttemptStore.listForProject(PROJECT_ID).length, 0);

  const unattributable = await post(
    value.baseUrl,
    '/internal/mcp/authoring-v2/handshake',
    'x'.repeat(43),
    handshakeRequest(),
  );
  assert.equal(unattributable.response.status, 403);
  assert.equal(unattributable.body.error.code, 'HOST_BINDING_NOT_FOUND');
  assert.equal(value.running.agentAttemptStore.listForProject(PROJECT_ID).length, 0);

  const oversizedHandshake = await post(
    value.baseUrl,
    '/internal/mcp/authoring-v2/handshake',
    value.token,
    handshakeRequest({ padding: 'x'.repeat(1024) }),
  );
  assert.equal(oversizedHandshake.response.status, 400);
  assert.equal(oversizedHandshake.body.error.code, 'BODY_TOO_LARGE');

  const smuggledCapabilities = await post(
    value.baseUrl,
    '/internal/mcp/authoring-v2/capabilities',
    value.token,
    capabilitiesRequest({ grantId: value.created.task.grantId }),
  );
  assert.equal(smuggledCapabilities.response.status, 400);
  assert.equal(smuggledCapabilities.body.error.code, 'AUTHORING_V2_REQUEST_INVALID');

  const smuggledAdoption = await post(
    value.baseUrl,
    '/internal/mcp/authoring-v2/processing-result-adopt',
    value.token,
    {
      schemaVersion: AUTHORING_V2_SCHEMA_VERSION,
      featureId: AUTHORING_V2_FEATURE_ID,
      toolName: AUTHORING_V2_PROCESSING_RESULT_ADOPTION_TOOL,
      dryRun: true,
      command: {},
      actor: AGENT,
    },
  );
  assert.equal(smuggledAdoption.response.status, 400);
  assert.equal(smuggledAdoption.body.error.code, 'AUTHORING_V2_REQUEST_INVALID');

  const beforeRevoke = await value.running.studioService.readProjectTrusted(PROJECT_ID);
  await value.running.studioService.execute(command({
    commandId: 'cmd.authoring-v2.transport.revoke',
    idempotencyKey: 'idem.authoring-v2.transport.revoke',
    type: 'grant.revoke',
    expectedVersion: beforeRevoke.revision,
    payload: {
      grantId: value.created.task.grantId,
      reason: 'Prove strict resolution rather than attempt-subject authorization.',
    },
  }), OWNER_CONTEXT);
  const revoked = await post(
    value.baseUrl,
    '/internal/mcp/authoring-v2/handshake',
    value.token,
    handshakeRequest(),
  );
  assert.equal(revoked.response.status, 403);
  assert.equal(revoked.body.error.code, 'GRANT_REVOKED');
  assert.doesNotMatch(JSON.stringify(revoked.body), /grant\.task|binding\.|token/i);

  const attempts = value.running.agentAttemptStore.listForProject(PROJECT_ID);
  assert.deepEqual(attempts.map(({ status }) => status), ['FAILED', 'FAILED', 'FAILED', 'DENIED']);
  assert.deepEqual(attempts.map(({ commandType }) => commandType), [
    'authoring-v2.surface.negotiate',
    'authoring-v2.capabilities.read',
    'asset.processing-result.adopt',
    'authoring-v2.surface.negotiate',
  ]);
  assert.equal(attempts.some(({ status }) => status === 'AUTHORIZED'), false);
  assert.doesNotMatch(JSON.stringify(attempts), /grantId|bindingId|token|authorization/i);
});

test('positive handshake reports coherent exhausted authority as replay-only', async (context) => {
  const value = await transportFixture(context, { exhaustBudget: true });
  const handshake = await post(
    value.baseUrl,
    '/internal/mcp/authoring-v2/handshake',
    value.token,
    handshakeRequest(),
  );
  assert.equal(handshake.response.status, 200);
  assert.equal(handshake.body.status, 'READY');
  assert.equal(handshake.body.budgetState, 'REPLAY_ONLY');
  assert.equal(handshake.body.branchRevision, value.created.task.baseRevision + 1);

  const capabilities = await post(
    value.baseUrl,
    '/internal/mcp/authoring-v2/capabilities',
    value.token,
    capabilitiesRequest(),
  );
  assert.equal(capabilities.response.status, 403);
  assert.equal(capabilities.body.error.code, 'BUDGET_EXCEEDED');
  assert.deepEqual(
    value.running.agentAttemptStore.listForProject(PROJECT_ID).map(({ status }) => status),
    ['DENIED'],
  );
});

test('server shutdown drains an in-flight private Authoring-v2 operation before closing SQLite', async (context) => {
  let releaseRead;
  const readGate = new Promise((resolveRead) => { releaseRead = resolveRead; });
  let markEntered;
  const entered = new Promise((resolveEntered) => { markEntered = resolveEntered; });
  class DelayedCapabilityProvider extends FixedProjectCapabilityProvider {
    async getProjectCapabilityManifest(...args) {
      markEntered();
      await readGate;
      return super.getProjectCapabilityManifest(...args);
    }
  }
  const value = await transportFixture(context, {
    authoringV2CapabilityProvider: new DelayedCapabilityProvider({
      manifest: NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST,
    }),
  });
  context.after(() => releaseRead());

  const pendingHandshake = post(
    value.baseUrl,
    '/internal/mcp/authoring-v2/handshake',
    value.token,
    handshakeRequest(),
  );
  let timeoutId;
  try {
    await Promise.race([
      entered,
      new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('Authoring-v2 operation did not enter the capability read.')),
          2000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
  let closed = false;
  const closing = new Promise((resolveClose, rejectClose) => {
    value.running.server.close((error) => (error ? rejectClose(error) : resolveClose()));
  }).then(() => { closed = true; });
  await new Promise((resolveTurn) => setImmediate(resolveTurn));
  assert.equal(closed, false);
  assert.equal((await value.running.studioService.readProjectTrusted(PROJECT_ID)).revision, 2);

  releaseRead();
  const handshake = await pendingHandshake;
  assert.equal(handshake.response.status, 200);
  assert.equal(handshake.body.status, 'READY');
  await closing;
  assert.equal(closed, true);
  await assert.rejects(value.running.studioService.readProjectTrusted(PROJECT_ID));
});
