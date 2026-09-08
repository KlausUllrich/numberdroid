// Interactive verification host, not a scripted authoring walkthrough.
// An independent agent chooses JSON-line tools/list, tools/call and
// resources/read requests. Only the coordinator uses host/restart or host/stop.
// Example: timeout 1200s node scripts/cutter-agent-session.js --timeout-seconds 1100
// Each line: {"id":"read-1","method":"tools/call","params":{"name":
// "studio_project_read","arguments":{"schemaVersion":1,"projectId":...}}}
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { createCutterAgentFixture } from './cutter-agent-fixture.js';

const studioRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const allowedTools = new Set([
  'studio_command_catalog_list', 'studio_project_read', 'studio_atlas_propose_grid',
  'studio_atlas_define_rects', 'studio_atlas_preview_slices', 'studio_job_read',
  'studio_atlas_commit_slices',
]);
const args = process.argv.slice(2);
let durationSeconds = 1200;
let retain = false;
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === '--retain') retain = true;
  else if (args[index] === '--timeout-seconds') durationSeconds = Number(args[++index]);
  else throw new Error('Only --retain and --timeout-seconds are supported.');
}
if (!Number.isInteger(durationSeconds) || durationSeconds < 10 || durationSeconds > 3600) {
  throw new Error('Timeout must be an integer from 10 through 3600 seconds.');
}

const emit = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);
const deadline = new Date(Date.now() + durationSeconds * 1000).toISOString();
let fixture = null;
let client = null;
let transport = null;
let closing = false;
let shutdownPromise = null;
let activeRequest = null;
let queue = Promise.resolve();
let sequence = 0;

async function deadlineCall(work, milliseconds, code) {
  let timer;
  try {
    return await Promise.race([
      work,
      new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error(code), { code })), milliseconds); }),
    ]);
  } finally { clearTimeout(timer); }
}

async function closeClient() {
  const previousClient = client;
  const previousTransport = transport;
  client = null;
  transport = null;
  const failures = [];
  try {
    if (previousClient) await deadlineCall(previousClient.close(), 10_000, 'MCP_CLOSE_TIMEOUT');
  } catch (error) { failures.push(error); }
  try {
    if (previousTransport) await deadlineCall(previousTransport.close(), 10_000, 'MCP_TRANSPORT_CLOSE_TIMEOUT');
  } catch (error) { failures.push(error); }
  if (failures.length) throw failures[0];
}

async function connectClient() {
  const running = fixture.running;
  const serviceUrl = `http://127.0.0.1:${running.address.port}/`;
  // Explicit environment allow-list prevents inherited Studio authority/profile
  // or configuration from changing this isolated test host.
  const env = Object.fromEntries(['PATH', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR']
    .filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]]));
  Object.assign(env, {
    NUMBERDROID_STUDIO_PROJECT_ID: fixture.projectId,
    NUMBERDROID_STUDIO_SERVICE_URL: serviceUrl,
    NUMBERDROID_STUDIO_PAIRING_ENDPOINT: running.pairingEndpoint,
    NUMBERDROID_STUDIO_HOST_LABEL: 'Synthetic cutter verification agent',
    NUMBERDROID_STUDIO_AGENT_AUDIT_READY: '1', NUMBERDROID_STUDIO_JOB_STORE_READY: '1',
    NUMBERDROID_STUDIO_ASSET_STORE_READY: '1', NUMBERDROID_STUDIO_ROOM_STORE_READY: '1',
  });
  transport = new StdioClientTransport({
    command: process.execPath, args: [resolve(studioRoot, 'apps/studio-mcp/src/main.js')],
    cwd: studioRoot, env, stderr: 'pipe',
  });
  client = new Client({ name: 'cutter-interactive-verifier', version: '1.0.0' }, {
    versionNegotiation: { mode: { pin: '2026-07-28' } },
  });
  await deadlineCall(client.connect(transport), 15_000, 'MCP_CONNECT_TIMEOUT');
  // Drain child diagnostics without echoing potentially private transport data.
  transport.stderr?.resume();
  const initialRead = client.readResource({ uri: `studio://projects/${fixture.projectId}` });
  // Attach immediately so a failed child cannot become an unhandled rejection
  // while the fixture host is resolving the pending pairing request.
  initialRead.catch(() => {});
  const pairingDeadline = Date.now() + 10_000;
  let pending;
  while (!(pending = running.pairingBroker.list(fixture.projectId)[0])) {
    if (Date.now() >= pairingDeadline) throw Object.assign(new Error('Pairing timed out.'), { code: 'MCP_PAIRING_TIMEOUT' });
    await new Promise((resolveWait) => setTimeout(resolveWait, 25));
  }
  const accessResponse = await fetch(`${serviceUrl}api/projects/${fixture.projectId}/agent-access`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!accessResponse.ok) throw new Error('Fixture host could not inspect pairing state.');
  const access = await accessResponse.json();
  const approval = await fetch(`${serviceUrl}api/projects/${fixture.projectId}/agent-access/bindings`, {
    method: 'POST', signal: AbortSignal.timeout(5000),
    headers: {
      'content-type': 'application/json', origin: serviceUrl.slice(0, -1),
      'sec-fetch-site': 'same-origin', 'x-numberdroid-studio-csrf': access.csrfToken,
    },
    body: JSON.stringify({ pendingHostId: pending.pendingHostId, confirm: true, idempotencyKey: `fixture.pair.${randomUUID()}` }),
  });
  // The private production pairing socket delivers the credential directly to
  // the SDK child. No token is returned by this bridge or written to a file.
  if (!approval.ok) throw new Error('Fixture host pairing approval failed.');
  await approval.arrayBuffer();
  await deadlineCall(initialRead, 10_000, 'MCP_INITIAL_READ_TIMEOUT');
}

function shutdown(reason) {
  if (shutdownPromise) return shutdownPromise;
  // Set this before any await: pending queue entries must never begin after a
  // deadline/signal, even when the active request is waiting on the MCP child.
  closing = true;
  clearTimeout(sessionTimer);
  process.stdin.pause();
  shutdownPromise = (async () => {
    const failures = [];
    try { await closeClient(); } catch (error) { failures.push(error); }
    // Closing the SDK cancels its pending requests; drain the one operation
    // already admitted, never the remaining request queue.
    try {
      if (activeRequest) await deadlineCall(activeRequest.catch(() => {}), 10_000, 'REQUEST_DRAIN_TIMEOUT');
    } catch (error) { failures.push(error); }
    const keepData = retain || failures.length > 0;
    // Always stop the service/workers/database even when client closure failed.
    // Unknown quiescence retains the exact owned directory for diagnosis.
    try {
      await deadlineCall(fixture?.close({ retain: keepData }) ?? Promise.resolve(), 15_000, 'HOST_CLOSE_TIMEOUT');
    } catch (error) { failures.push(error); }
    if (failures.length) {
      emit({ event: 'stop-failed', code: failures[0].code ?? 'HOST_CLOSE_FAILED', retainedDirectory: fixture?.directory });
      process.exitCode = 1;
    } else emit({ event: 'stopped', reason, retainedDirectory: keepData ? fixture?.directory : null });
  })();
  return shutdownPromise;
}

async function dispatch(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)
    || !['string', 'number'].includes(typeof request.id)
    || Object.keys(request).some((key) => !['id', 'method', 'params'].includes(key))) {
    throw Object.assign(new Error('Invalid bridge request.'), { code: 'BRIDGE_REQUEST_INVALID' });
  }
  if (request.method === 'host/stop') { await shutdown('host'); return { stopped: true }; }
  if (request.method === 'host/restart') {
    await closeClient();
    if (closing) return { restarted: false };
    await deadlineCall(fixture.restart(), 20_000, 'HOST_RESTART_TIMEOUT');
    if (closing) return { restarted: false };
    await connectClient();
    return { restarted: true, projectId: fixture.projectId };
  }
  if (request.method === 'tools/list') {
    const discovery = await client.listTools();
    return { ...discovery, tools: discovery.tools.filter(({ name }) => allowedTools.has(name)),
      bridgeRestriction: 'Seven cutter tools forwarded from the production MCP catalog.' };
  }
  if (request.method === 'tools/call') {
    if (!allowedTools.has(request.params?.name)) {
      throw Object.assign(new Error('Only cutter verification tools are available.'), { code: 'BRIDGE_TOOL_NOT_ALLOWED' });
    }
    const result = await client.callTool(request.params, undefined, { timeout: 20_000 });
    // Structured output is authoritative; omit the SDK's duplicate JSON text
    // rendering so interactive agents do not pay for the same result twice.
    if (result.structuredContent !== undefined) {
      return { ...(result.isError === undefined ? {} : { isError: result.isError }), structuredContent: result.structuredContent };
    }
    return result;
  }
  if (request.method === 'resources/read') {
    const uri = request.params?.uri;
    const prefix = `studio://projects/${fixture.projectId}`;
    if (uri !== prefix && !(typeof uri === 'string' && uri.startsWith(`${prefix}/jobs/`))) {
      throw Object.assign(new Error('Only fixture project and job resources are available.'), { code: 'BRIDGE_RESOURCE_NOT_ALLOWED' });
    }
    return client.readResource(request.params);
  }
  throw Object.assign(new Error('Unsupported bridge method.'), { code: 'BRIDGE_METHOD_NOT_ALLOWED' });
}

const sessionTimer = setTimeout(() => { void shutdown('deadline'); }, durationSeconds * 1000);
process.once('SIGINT', () => { void shutdown('SIGINT'); });
process.once('SIGTERM', () => { void shutdown('SIGTERM'); });

try {
  fixture = await deadlineCall(createCutterAgentFixture({ expiresAt: deadline }), 20_000, 'FIXTURE_START_TIMEOUT');
  await connectClient();
  emit({ event: 'ready', projectId: fixture.projectId, sourceId: fixture.sourceId,
    source: { width: 32, height: 32, rows: 2, columns: 2, cellWidth: 16, cellHeight: 16 },
    protocolVersion: client.getNegotiatedProtocolVersion(), deadline,
    fixtureDirectory: fixture.directory, scope: 'Shared-head synthetic source preparation only; no CP4 task review or production content.' });
  let buffer = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    if (closing) return;
    buffer += chunk;
    if (Buffer.byteLength(buffer) > 256 * 1024) {
      emit({ event: 'input-rejected', code: 'BRIDGE_INPUT_TOO_LARGE' });
      void shutdown('oversized-input');
      return;
    }
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (!line.trim()) continue;
      queue = queue.then(async () => {
        if (closing) return;
        let request;
        try {
          request = JSON.parse(line);
          // host/stop awaits shutdown itself, so it must not be its own drain.
          const operation = dispatch(request);
          if (request.method !== 'host/stop') activeRequest = operation;
          const result = await deadlineCall(operation, 45_000, 'BRIDGE_REQUEST_TIMEOUT');
          emit({ id: request.id, sequence: ++sequence, result });
        } catch (error) {
          emit({ id: request?.id ?? null, sequence: ++sequence, error: { code: error.code ?? 'BRIDGE_REQUEST_FAILED' } });
        } finally { activeRequest = null; }
      });
    }
  });
  process.stdin.once('end', () => { void shutdown('stdin-closed'); });
} catch (error) {
  emit({ event: 'startup-failed', code: error.code ?? 'FIXTURE_START_FAILED' });
  process.exitCode = 1;
  await shutdown('startup-failed');
}
