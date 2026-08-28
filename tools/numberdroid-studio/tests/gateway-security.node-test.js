import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStudioHttpServer } from '../apps/studio-server/src/server.js';
import { LocalStudioGateway } from '../apps/studio-mcp/src/local-studio-gateway.js';
import { pairWithStudio } from '../apps/studio-mcp/src/pairing-client.js';
import { AUTHORING_V2_COMMAND_FEATURES } from '../packages/domain/src/index.js';
import {
  NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT,
  NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST,
} from '../packages/numberdroid-adapter/src/index.js';

const AUTHORING_V2_PROJECT_ID = 'project.authoring-v2-gateway';
const MCP_MAIN_PATH = fileURLToPath(new URL('../apps/studio-mcp/src/main.js', import.meta.url));

function authoringV2Negotiation(projectId = AUTHORING_V2_PROJECT_ID) {
  return {
    schemaVersion: 2,
    kind: 'studio.authoring-v2-surface-negotiation',
    status: 'READY',
    featureId: 'studio.authoring-v2',
    projectId,
    branchRevision: 17,
    budgetState: 'AVAILABLE',
    profile: {
      profileId: NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST.profileId,
      profileVersion: 2,
      fingerprint: NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT,
    },
    commandFeatures: AUTHORING_V2_COMMAND_FEATURES,
  };
}

function authoringV2Capabilities(projectId = AUTHORING_V2_PROJECT_ID) {
  return {
    schemaVersion: 2,
    kind: 'studio.authoring-v2-capabilities',
    featureId: 'studio.authoring-v2',
    projectId,
    branchRevision: 17,
    profile: {
      profileId: NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST.profileId,
      profileVersion: 2,
      fingerprint: NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT,
      manifest: NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST,
    },
    commandFeatures: AUTHORING_V2_COMMAND_FEATURES,
  };
}

async function listen(context, server) {
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  context.after(() => new Promise((resolveClose) => server.close(resolveClose)));
  return `http://127.0.0.1:${server.address().port}/`;
}

async function runMcpMain(environment) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [MCP_MAIN_PATH], {
      env: { ...process.env, ...environment },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      rejectRun(new Error('MCP child did not fail closed within five seconds.'));
    }, 5_000);
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      rejectRun(error);
    });
    child.once('close', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolveRun({ code, signal, stdout, stderr });
    });
  });
}

test('private MCP service and gateway redact internal details at both boundaries', async (context) => {
  const sentinel = '/private/numberdroid-secret.sqlite';
  const token = 't'.repeat(43);
  const studioServer = createStudioHttpServer({
    studioService: {
      commandCatalog: [],
      async readProject() { throw new Error(`sqlite failed at ${sentinel}`); },
    },
    hostBindingStore: {
      resolve() {
        return {
          projectId: 'project.redaction',
          grantId: 'grant.secret',
          actor: { id: 'agent.redaction', kind: 'agent' },
          taskId: 'task.redaction',
          branchId: 'branch.redaction',
        };
      },
    },
  });
  const serviceUrl = await listen(context, studioServer);
  const direct = await fetch(new URL('/internal/mcp/read-project', serviceUrl), {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ schemaVersion: 1, projectId: 'project.redaction' }),
  });
  const directBody = await direct.json();
  assert.equal(direct.status, 500);
  assert.deepEqual(directBody.error, {
    code: 'INTERNAL_ERROR',
    message: 'Unexpected Studio error.',
    details: {},
  });
  assert.doesNotMatch(JSON.stringify(directBody), new RegExp(sentinel));

  const gateway = new LocalStudioGateway({ baseUrl: serviceUrl, bindingToken: token });
  await assert.rejects(
    gateway.readProject({ projectId: 'project.redaction' }),
    (error) => error.code === 'INTERNAL_ERROR'
      && error.message === 'Unexpected Studio error.'
      && JSON.stringify(error.details) === '{}'
      && !JSON.stringify(error).includes(sentinel),
  );
});

test('gateway normalizes malformed service responses without echoing bytes', async (context) => {
  const sentinel = 'private-response-fragment';
  const malformed = createServer((_request, response) => {
    response.writeHead(500, { 'content-type': 'application/json' });
    response.end(`not-json-${sentinel}`);
  });
  const gateway = new LocalStudioGateway({
    baseUrl: await listen(context, malformed),
    bindingToken: 'm'.repeat(43),
  });
  await assert.rejects(
    gateway.readProject({ projectId: 'project.redaction' }),
    (error) => error.code === 'STUDIO_SERVICE_PROTOCOL_ERROR'
      && !error.message.includes(sentinel)
      && !JSON.stringify(error.details).includes(sentinel),
  );
});

test('gateway removes a reflected HostBinding token from private service errors', async (context) => {
  const token = 'e'.repeat(43);
  const reflecting = createServer((_request, response) => {
    response.writeHead(403, { 'content-type': 'application/json' });
    response.end(JSON.stringify({
      schemaVersion: 1,
      error: {
        code: 'NOT_AUTHORIZED',
        message: `credential ${token}`,
        details: {
          Token: token,
          nested: { diagnostic: `reflected ${token}`, safe: 'retained' },
        },
      },
    }));
  });
  const gateway = new LocalStudioGateway({
    baseUrl: await listen(context, reflecting),
    bindingToken: token,
  });
  await assert.rejects(
    gateway.readProject({ projectId: 'project.reflection' }),
    (error) => error.code === 'NOT_AUTHORIZED'
      && error.message === 'Studio service request failed.'
      && error.details.nested.diagnostic === '[REDACTED]'
      && error.details.nested.safe === 'retained'
      && !JSON.stringify(error).includes(token),
  );
});

test('gateway accepts only private loopback HTTP service URLs', () => {
  const token = 'l'.repeat(43);
  for (const baseUrl of [
    'https://127.0.0.1:4317/',
    'http://192.0.2.20:4317/',
    'http://studio.example.invalid:4317/',
    `http://host:${token}@127.0.0.1:4317/`,
  ]) {
    assert.throws(
      () => new LocalStudioGateway({ baseUrl, bindingToken: token }),
      (error) => error.code === 'STUDIO_SERVICE_URL_INVALID'
        && !error.message.includes(baseUrl)
        && !JSON.stringify(error.details).includes(token),
    );
  }
  assert.doesNotThrow(() => new LocalStudioGateway({
    baseUrl: 'http://localhost:4317/',
    bindingToken: token,
  }));
  assert.doesNotThrow(() => new LocalStudioGateway({
    baseUrl: 'http://[::1]:4317/',
    bindingToken: token,
  }));
});

test('gateway rejects HTTP redirects without forwarding the HostBinding credential', async (context) => {
  const token = 'r'.repeat(43);
  let redirectedRequests = 0;
  const redirectTarget = createServer((_request, response) => {
    redirectedRequests += 1;
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ schemaVersion: 1 }));
  });
  const redirectTargetUrl = await listen(context, redirectTarget);
  const redirector = createServer((_request, response) => {
    response.writeHead(307, { location: new URL('/capture', redirectTargetUrl) });
    response.end();
  });
  const gateway = new LocalStudioGateway({
    baseUrl: await listen(context, redirector),
    bindingToken: token,
  });
  await assert.rejects(
    gateway.readProject({ projectId: 'project.redirect' }),
    (error) => error.code === 'STUDIO_SERVICE_UNAVAILABLE'
      && !JSON.stringify(error).includes(token)
      && !JSON.stringify(error).includes(redirectTargetUrl),
  );
  assert.equal(redirectedRequests, 0);
});

test('gateway cancellation interrupts a pending private pairing token wait', async () => {
  const controller = new AbortController();
  const gateway = new LocalStudioGateway({
    baseUrl: 'http://127.0.0.1:4317/',
    bindingTokenProvider: () => new Promise(() => {}),
  });
  const pending = gateway.readProject(
    { projectId: 'project.cancelled-pairing' },
    null,
    { signal: controller.signal },
  );
  controller.abort();
  await assert.rejects(pending, (error) => error?.name === 'AbortError');
});

test('Authoring-v2 gateway is handshake-gated and forwards only its three narrow DTOs', async (context) => {
  const token = 'v'.repeat(43);
  const observed = [];
  const bridge = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    observed.push({
      method: request.method,
      path: request.url,
      authorization: request.headers.authorization,
      body,
    });
    const result = request.url === '/internal/mcp/authoring-v2/handshake'
      ? authoringV2Negotiation()
      : request.url === '/internal/mcp/authoring-v2/capabilities'
        ? authoringV2Capabilities()
        : { schemaVersion: 2, kind: 'studio.authoring-v2-adoption-test-result' };
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(result));
  });
  const gateway = new LocalStudioGateway({
    baseUrl: await listen(context, bridge),
    bindingToken: token,
  });
  const capabilitiesRequest = {
    schemaVersion: 2,
    featureId: 'studio.authoring-v2',
    projectId: AUTHORING_V2_PROJECT_ID,
  };
  await assert.rejects(
    gateway.readAuthoringV2Capabilities(capabilitiesRequest),
    (error) => error.code === 'AUTHORING_V2_NEGOTIATION_REQUIRED',
  );
  await assert.rejects(
    gateway.adoptProcessingResult({ schemaVersion: 2 }),
    (error) => error.code === 'AUTHORING_V2_NEGOTIATION_REQUIRED',
  );
  assert.equal(observed.length, 0);

  const negotiationRequest = {
    schemaVersion: 2,
    kind: 'studio.authoring-v2-surface-negotiation-request',
    featureId: 'studio.authoring-v2',
    projectId: AUTHORING_V2_PROJECT_ID,
    expectedProfileFingerprint: NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT,
  };
  const negotiation = await gateway.negotiateAuthoringV2(negotiationRequest);
  assert.equal(Object.isFrozen(negotiation), true);
  assert.equal(Object.isFrozen(negotiation.profile), true);

  const capabilities = await gateway.readAuthoringV2Capabilities(
    capabilitiesRequest,
    { actor: { id: 'forged.actor', kind: 'agent' }, grantId: 'forged.grant' },
  );
  assert.equal(Object.isFrozen(capabilities), true);
  assert.equal(Object.isFrozen(capabilities.profile.manifest), true);

  await assert.rejects(
    gateway.adoptProcessingResult({
      schemaVersion: 2,
      featureId: 'studio.authoring-v2',
      toolName: 'studio_processing_result_adopt',
      dryRun: true,
      command: { projectId: 'project.other' },
    }),
    (error) => error.code === 'CONTEXT_PROJECT_MISMATCH',
  );
  assert.equal(observed.length, 2);

  const adoptionRequest = {
    schemaVersion: 2,
    featureId: 'studio.authoring-v2',
    toolName: 'studio_processing_result_adopt',
    dryRun: true,
    command: { projectId: AUTHORING_V2_PROJECT_ID },
  };
  const adoption = await gateway.adoptProcessingResult(
    adoptionRequest,
    { actor: { id: 'forged.actor', kind: 'agent' }, taskId: 'forged.task' },
  );
  assert.equal(adoption.kind, 'studio.authoring-v2-adoption-test-result');
  assert.deepEqual(observed, [
    {
      method: 'POST',
      path: '/internal/mcp/authoring-v2/handshake',
      authorization: `Bearer ${token}`,
      body: negotiationRequest,
    },
    {
      method: 'POST',
      path: '/internal/mcp/authoring-v2/capabilities',
      authorization: `Bearer ${token}`,
      body: capabilitiesRequest,
    },
    {
      method: 'POST',
      path: '/internal/mcp/authoring-v2/processing-result-adopt',
      authorization: `Bearer ${token}`,
      body: adoptionRequest,
    },
  ]);
});

test('Authoring-v2 negotiation fails closed on a valid response for another project', async (context) => {
  const token = 'x'.repeat(43);
  const bridge = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(authoringV2Negotiation('project.other')));
  });
  const gateway = new LocalStudioGateway({
    baseUrl: await listen(context, bridge),
    bindingToken: token,
  });
  await assert.rejects(
    gateway.negotiateAuthoringV2({
      schemaVersion: 2,
      kind: 'studio.authoring-v2-surface-negotiation-request',
      featureId: 'studio.authoring-v2',
      projectId: AUTHORING_V2_PROJECT_ID,
      expectedProfileFingerprint: NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT,
    }),
    (error) => error.code === 'AUTHORING_V2_RESPONSE_INVALID'
      && !JSON.stringify(error).includes(token),
  );
  await assert.rejects(
    gateway.readAuthoringV2Capabilities({
      schemaVersion: 2,
      featureId: 'studio.authoring-v2',
      projectId: AUTHORING_V2_PROJECT_ID,
    }),
    (error) => error.code === 'AUTHORING_V2_NEGOTIATION_REQUIRED',
  );
});

test('MCP launcher rejects every set non-v2 profile without protocol output or stack details', async () => {
  const token = 'p'.repeat(43);
  for (const profile of ['', 'legacy', ' authoring-v2']) {
    const result = await runMcpMain({
      NUMBERDROID_STUDIO_MCP_PROFILE: profile,
      NUMBERDROID_STUDIO_PROJECT_ID: AUTHORING_V2_PROJECT_ID,
      NUMBERDROID_STUDIO_BINDING_TOKEN: token,
    });
    assert.equal(result.code, 1);
    assert.equal(result.signal, null);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, '[numberdroid-studio] MCP_STARTUP_FAILED\n');
    assert.doesNotMatch(result.stderr, /main\.js|file:|Error:|authoring-v2/);
  }
});

test('negative Authoring-v2 handshake exits without MCP fallback or remote details', async (context) => {
  const token = 'n'.repeat(43);
  const sentinel = '/private/authoring-v2.sqlite';
  let requests = 0;
  const bridge = createServer((_request, response) => {
    requests += 1;
    response.writeHead(403, { 'content-type': 'application/json' });
    response.end(JSON.stringify({
      schemaVersion: 1,
      error: {
        code: 'NOT_AUTHORIZED',
        message: `denied at ${sentinel}`,
        details: { path: sentinel, token },
      },
    }));
  });
  const result = await runMcpMain({
    NUMBERDROID_STUDIO_MCP_PROFILE: 'authoring-v2',
    NUMBERDROID_STUDIO_PROJECT_ID: AUTHORING_V2_PROJECT_ID,
    NUMBERDROID_STUDIO_BINDING_TOKEN: token,
    NUMBERDROID_STUDIO_SERVICE_URL: await listen(context, bridge),
  });
  assert.equal(requests, 1);
  assert.equal(result.code, 1);
  assert.equal(result.signal, null);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '[numberdroid-studio] MCP_STARTUP_FAILED\n');
  assert.doesNotMatch(result.stderr, new RegExp(`${token}|${sentinel}|main\\.js|file:|Error:`));
});

test('job observation uses only the private read bridge and never forwards opaque host authority', async (context) => {
  const token = 'j'.repeat(43);
  let observed = null;
  const bridge = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    observed = {
      method: request.method,
      path: request.url,
      authorization: request.headers.authorization,
      body: JSON.parse(Buffer.concat(chunks).toString('utf8')),
    };
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({
      schemaVersion: 1,
      projectId: 'project.job-observation',
      job: { jobId: 'job.preview.1', state: 'QUEUED' },
    }));
  });
  const gateway = new LocalStudioGateway({
    baseUrl: await listen(context, bridge),
    bindingToken: token,
    agentAttemptAuditReady: true,
    durableJobStoreReady: true,
  });
  const result = await gateway.readJob({
    schemaVersion: 1,
    projectId: 'project.job-observation',
    jobId: 'job.preview.1',
  }, {
    actor: { id: 'forged.actor', kind: 'agent' },
    grantId: 'forged.grant',
  });
  assert.equal(result.job.state, 'QUEUED');
  assert.deepEqual(observed, {
    method: 'POST',
    path: '/internal/mcp/job-read',
    authorization: `Bearer ${token}`,
    body: {
      schemaVersion: 1,
      projectId: 'project.job-observation',
      jobId: 'job.preview.1',
    },
  });
});

test('pairing connection failures use a stable code without exposing the endpoint', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-pairing-unavailable-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const endpoint = join(directory, 'private-pairing.sock');
  await assert.rejects(
    pairWithStudio({ endpoint, projectId: 'project.redaction' }),
    (error) => error.code === 'HOST_PAIRING_UNAVAILABLE'
      && !error.message.includes(endpoint)
      && !JSON.stringify(error.details).includes(endpoint),
  );
});
