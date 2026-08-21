import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { StudioService } from '../../../packages/application/src/index.js';
import { StudioError, asStudioError } from '../../../packages/domain/src/index.js';
import {
  ContentAddressedArtifactStore,
  JsonProjectStore,
  SqliteArtifactMetadataStore,
  SqliteHostBindingStore,
  SqliteProjectStore,
} from '../../../packages/persistence/src/index.js';
import { ensureDemoProject, runDemoAction } from './demo-project.js';
import { createHumanAgentAccessController } from './human-agent-access.js';
import { projectHttpProjection } from './http-projections.js';
import {
  defaultMcpPairingEndpoint,
  McpPairingBroker,
  startMcpPairingSocket,
} from './mcp-pairing-broker.js';

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const publicDirectory = resolve(moduleDirectory, '../public');
const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
]);

function sendJson(response, status, value) {
  const body = `${JSON.stringify(value)}\n`;
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(body);
}

function errorStatus(error) {
  if (['PROJECT_NOT_FOUND', 'ARTIFACT_NOT_FOUND', 'HOST_PAIRING_NOT_FOUND'].includes(error.code)) return 404;
  if (['PROJECT_EXISTS', 'REVISION_CONFLICT', 'IDEMPOTENCY_CONFLICT', 'COMMAND_ID_CONFLICT', 'ENTITY_EXISTS', 'ENTITY_STATE_CONFLICT', 'BROADER_ACCESS_CONFIRMATION_REQUIRED', 'AGENT_TARGET_REQUIRED', 'HOST_PAIRING_CONFIRMATION_REQUIRED', 'DRAFT_BRANCH_NOT_AVAILABLE_1B', 'ARTIFACT_NOT_LIVE'].includes(error.code)) return 409;
  if (error.code.startsWith('GRANT_') || error.code.startsWith('HOST_BINDING_') || ['FORBIDDEN', 'CONTEXT_PROJECT_MISMATCH', 'OBJECT_SCOPE_DENIED', 'BUDGET_EXCEEDED', 'UNTRUSTED_AGENT_CONTEXT', 'UI_ORIGIN_REQUIRED', 'UI_ORIGIN_FORBIDDEN', 'CSRF_INVALID'].includes(error.code)) return 403;
  if (error.code === 'ARTIFACT_TOO_LARGE') return 413;
  if (['ARTIFACT_DIGEST_MISMATCH', 'ARTIFACT_METADATA_CONFLICT'].includes(error.code)) return 409;
  if (['VALIDATION_ERROR', 'INVALID_JSON', 'BODY_TOO_LARGE', 'CONTENT_TYPE_REQUIRED', 'UNKNOWN_AGENT_ACCESS_MODE', 'UNKNOWN_COMMAND', 'SCHEMA_VERSION_UNSUPPORTED', 'VERSION_INVARIANT_VIOLATION', 'EMBEDDED_ARTIFACT_FORBIDDEN', 'ARTIFACT_UNSUPPORTED_MEDIA', 'ARTIFACT_MEDIA_MISMATCH', 'ARTIFACT_DIMENSIONS_EXCEEDED', 'ARTIFACT_INVALID_DIGEST', 'ARTIFACT_URI_REQUIRED'].includes(error.code)) return 400;
  if (error.code === 'ARTIFACT_STORE_DISABLED') return 503;
  return 500;
}

function assertLoopbackServiceRequest(request) {
  const hostUrl = loopbackOrigin(`http://${request.headers.host ?? ''}`);
  const remoteAddress = request.socket.remoteAddress ?? '';
  const loopbackRemote = remoteAddress === '127.0.0.1' || remoteAddress === '::1' || remoteAddress === '::ffff:127.0.0.1';
  if (!hostUrl || !loopbackRemote) {
    throw new StudioError('HOST_BINDING_CHANNEL_FORBIDDEN', 'The private MCP bridge is available only over loopback.');
  }
}

function bearerToken(request) {
  const authorization = request.headers.authorization;
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
    throw new StudioError('HOST_BINDING_REQUIRED', 'The private MCP bridge requires a HostBinding bearer token.');
  }
  return authorization.slice('Bearer '.length);
}

function bindingExecutionContext(binding) {
  return {
    actor: binding.actor,
    taskId: binding.taskId,
    grantId: binding.grantId,
    branchId: binding.branchId,
    correlationId: `mcp.${randomUUID()}`,
  };
}

async function serveStatic(pathname, response) {
  const [file, mediaType] = staticFiles.get(pathname);
  const body = await readFile(resolve(publicDirectory, file));
  response.writeHead(200, {
    'content-type': mediaType,
    'content-length': body.length,
    'cache-control': 'no-cache',
    'content-security-policy': "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'",
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
  });
  response.end(body);
}

function projectRoute(pathname) {
  const match = /^\/api\/projects\/([^/]+)(?:\/(activity|agent-access))?$/.exec(pathname);
  return match ? { projectId: decodeURIComponent(match[1]), resource: match[2] ?? 'snapshot' } : null;
}

function artifactRoute(pathname) {
  const match = /^\/api\/projects\/([^/]+)\/artifacts(?:\/sha256\/([a-f0-9]{64}))?$/.exec(pathname);
  return match ? { projectId: decodeURIComponent(match[1]), digest: match[2] ?? null } : null;
}

function agentBindingRoute(pathname) {
  const match = /^\/api\/projects\/([^/]+)\/agent-access\/bindings(?:\/([^/]+)\/revoke)?$/.exec(pathname);
  return match ? {
    projectId: decodeURIComponent(match[1]),
    bindingId: match[2] ? decodeURIComponent(match[2]) : null,
  } : null;
}

async function readJsonBody(request, { maxBytes = 4096 } = {}) {
  const contentType = request.headers['content-type'] ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new StudioError('CONTENT_TYPE_REQUIRED', 'This endpoint requires application/json.');
  }
  const declaredLength = Number(request.headers['content-length'] ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new StudioError('BODY_TOO_LARGE', 'The request body is too large.', { maxBytes });
  }
  const chunks = [];
  let byteLength = 0;
  for await (const chunk of request) {
    byteLength += chunk.length;
    if (byteLength > maxBytes) throw new StudioError('BODY_TOO_LARGE', 'The request body is too large.', { maxBytes });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new StudioError('INVALID_JSON', 'The request body is not valid JSON.');
  }
}

function loopbackOrigin(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:') return null;
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

function tokenMatches(actual, expected) {
  if (typeof actual !== 'string') return false;
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function assertHumanUiMutation(request, csrfToken) {
  const remoteAddress = request.socket.remoteAddress ?? '';
  const loopbackRemote = remoteAddress === '127.0.0.1' || remoteAddress === '::1' || remoteAddress === '::ffff:127.0.0.1';
  if (!loopbackRemote) {
    throw new StudioError('UI_ORIGIN_FORBIDDEN', 'Human UI mutations are available only from the local loopback session.');
  }
  const hostUrl = loopbackOrigin(`http://${request.headers.host ?? ''}`);
  const originUrl = loopbackOrigin(request.headers.origin ?? '');
  if (!originUrl) throw new StudioError('UI_ORIGIN_REQUIRED', 'A loopback same-origin browser request is required.');
  if (!hostUrl || originUrl.host !== hostUrl.host) {
    throw new StudioError('UI_ORIGIN_FORBIDDEN', 'The request Origin does not match this loopback Studio service.');
  }
  if (request.headers['sec-fetch-site'] && request.headers['sec-fetch-site'] !== 'same-origin') {
    throw new StudioError('UI_ORIGIN_FORBIDDEN', 'Cross-site UI requests are not allowed.');
  }
  if (!tokenMatches(request.headers['x-numberdroid-studio-csrf'], csrfToken)) {
    throw new StudioError('CSRF_INVALID', 'The human UI request is missing its current CSRF token.');
  }
}

function redactInternalDetails(value) {
  if (Array.isArray(value)) return value.map(redactInternalDetails);
  if (!value || typeof value !== 'object') return value;
  const sensitiveKeys = new Set([
    'authorization', 'bindingId', 'bindingToken', 'cause', 'directory', 'endpoint',
    'filename', 'grantId', 'path', 'socket', 'token',
  ]);
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !sensitiveKeys.has(key))
    .map(([key, entry]) => [key, redactInternalDetails(entry)]));
}

function internalMcpErrorProjection(error) {
  if (error.code === 'INTERNAL_ERROR') {
    return { code: 'INTERNAL_ERROR', message: 'Unexpected Studio error.', details: {} };
  }
  return {
    code: error.code,
    message: error.message,
    details: redactInternalDetails(error.details),
  };
}

function validateMcpSourceArtifact(command, artifactMetadataStore) {
  if (command.type !== 'source.register') return null;
  if (!artifactMetadataStore) {
    throw new StudioError('ARTIFACT_STORE_DISABLED', 'MCP source registration requires the SQLite artifact store.');
  }
  const match = /^studio:\/\/artifacts\/sha256\/([a-f0-9]{64})$/.exec(command.payload?.artifactUri ?? '');
  if (!match) {
    throw new StudioError('ARTIFACT_URI_REQUIRED', 'MCP source registration requires a canonical Studio CAS URI.');
  }
  const digest = match[1];
  const artifact = artifactMetadataStore.getArtifact(digest);
  if (!artifact || artifact.state !== 'LIVE' || !artifactMetadataStore.hasProjectReference(command.projectId, digest)) {
    throw new StudioError('ARTIFACT_NOT_LIVE', 'The source artifact must be uploaded, live, and referenced by this project before agent registration.');
  }
  if (artifact.mediaType !== command.payload.mediaType
    || artifact.width !== command.payload.width || artifact.height !== command.payload.height) {
    throw new StudioError('ARTIFACT_METADATA_CONFLICT', 'Source media type and dimensions must match verified CAS metadata.', {
      expectedMediaType: artifact.mediaType,
      expectedWidth: artifact.width,
      expectedHeight: artifact.height,
    });
  }
  return digest;
}

async function assertExecutableBindingPolicy(studioService, binding) {
  const projectView = await studioService.readProjectTrusted(binding.projectId);
  const grant = projectView.snapshot.grants.find((candidate) => candidate.id === binding.grantId);
  const scopes = new Set(grant?.scopes ?? []);
  if (!scopes.has('project.status.write') && (scopes.has('source.write') || scopes.has('asset.write'))) {
    throw new StudioError('DRAFT_BRANCH_NOT_AVAILABLE_1B', 'This legacy draft binding cannot mutate the shared project head. Rotate it to a supported 1B policy.');
  }
}

function mcpLauncherProjection(request, projectId, pairingBroker, pairingEndpoint) {
  const origin = loopbackOrigin(`http://${request.headers.host ?? ''}`);
  const remoteAddress = request.socket.remoteAddress ?? '';
  const loopbackRemote = remoteAddress === '127.0.0.1' || remoteAddress === '::1' || remoteAddress === '::ffff:127.0.0.1';
  if (!pairingBroker || !origin || !loopbackRemote) return null;
  return {
    mcpServers: {
      numberdroidStudio: {
        command: process.execPath,
        args: [resolve(moduleDirectory, '../../studio-mcp/src/main.js')],
        env: {
          NUMBERDROID_STUDIO_SERVICE_URL: `${origin.origin}/`,
          NUMBERDROID_STUDIO_PROJECT_ID: projectId,
          NUMBERDROID_STUDIO_PAIRING_ENDPOINT: pairingEndpoint,
        },
      },
    },
  };
}

export function createStudioHttpServer({
  studioService,
  hostBindingStore = null,
  pairingBroker = null,
  pairingEndpoint = null,
  artifactStore = null,
  artifactMetadataStore = null,
}) {
  if (!studioService) throw new TypeError('studioService is required.');
  const humanUiCsrfToken = randomBytes(32).toString('base64url');
  const humanAgentAccess = createHumanAgentAccessController({ studioService, hostBindingStore, pairingBroker });

  return createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    const requestAbort = new AbortController();
    const abortIfUnfinished = () => {
      if (!response.writableEnded) requestAbort.abort();
    };
    request.once('aborted', abortIfUnfinished);
    response.once('close', abortIfUnfinished);
    try {
      if (request.method === 'GET' && staticFiles.has(url.pathname)) {
        await serveStatic(url.pathname, response);
        return;
      }
      if (request.method === 'GET' && url.pathname === '/health') {
        sendJson(response, 200, { schemaVersion: 1, status: 'ok', service: 'numberdroid-studio' });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/catalog') {
        sendJson(response, 200, { schemaVersion: 1, commands: studioService.commandCatalog });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/ui-session') {
        sendJson(response, 200, { schemaVersion: 1, csrfToken: humanUiCsrfToken });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/projects') {
        sendJson(response, 200, { schemaVersion: 1, projects: await studioService.listProjectsTrusted() });
        return;
      }
      if (request.method === 'POST' && url.pathname === '/internal/mcp/execute') {
        assertLoopbackServiceRequest(request);
        if (!hostBindingStore) throw new StudioError('HOST_BINDING_DISABLED', 'This Studio service has no HostBinding store.');
        const binding = hostBindingStore.resolve(bearerToken(request));
        const body = await readJsonBody(request, { maxBytes: 1024 * 1024 });
        if (!body || Array.isArray(body) || typeof body !== 'object' || body.schemaVersion !== 1
          || !body.command || Object.keys(body).some((key) => !['schemaVersion', 'command'].includes(key))) {
          throw new StudioError('VALIDATION_ERROR', 'The MCP execution bridge requires schemaVersion 1 and a command DTO.');
        }
        if (body.command.projectId !== binding.projectId) {
          throw new StudioError('CONTEXT_PROJECT_MISMATCH', 'The requested project is outside this HostBinding.', {
            requestedProjectId: body.command.projectId,
            contextProjectId: binding.projectId,
          });
        }
        await assertExecutableBindingPolicy(studioService, binding);
        const sourceDigest = validateMcpSourceArtifact(body.command, artifactMetadataStore);
        const result = await studioService.execute(
          body.command,
          bindingExecutionContext(binding),
          { signal: requestAbort.signal },
        );
        sendJson(response, 200, result);
        return;
      }
      if (request.method === 'POST' && url.pathname === '/internal/mcp/read-project') {
        assertLoopbackServiceRequest(request);
        if (!hostBindingStore) throw new StudioError('HOST_BINDING_DISABLED', 'This Studio service has no HostBinding store.');
        const binding = hostBindingStore.resolve(bearerToken(request));
        const body = await readJsonBody(request, { maxBytes: 4096 });
        if (!body || Array.isArray(body) || typeof body !== 'object' || body.schemaVersion !== 1
          || typeof body.projectId !== 'string' || Object.keys(body).some((key) => !['schemaVersion', 'projectId'].includes(key))) {
          throw new StudioError('VALIDATION_ERROR', 'The MCP read bridge requires schemaVersion 1 and projectId.');
        }
        if (body.projectId !== binding.projectId) {
          throw new StudioError('CONTEXT_PROJECT_MISMATCH', 'The requested project is outside this HostBinding.', {
            requestedProjectId: body.projectId,
            contextProjectId: binding.projectId,
          });
        }
        sendJson(response, 200, await studioService.readProject(
          { projectId: body.projectId },
          bindingExecutionContext(binding),
          { signal: requestAbort.signal },
        ));
        return;
      }
      const artifact = artifactRoute(url.pathname);
      if (request.method === 'POST' && artifact && artifact.digest === null) {
        assertHumanUiMutation(request, humanUiCsrfToken);
        if (!artifactStore || !artifactMetadataStore) {
          throw new StudioError('ARTIFACT_STORE_DISABLED', 'This Studio service has no content-addressed artifact store.');
        }
        const projectView = await studioService.readProjectTrusted(artifact.projectId);
        const mediaType = String(request.headers['content-type'] ?? '').split(';', 1)[0].trim().toLowerCase();
        const expectedDigest = request.headers['x-numberdroid-expected-sha256'] ?? null;
        const ingested = await artifactStore.ingest(request, { mediaType, expectedDigest });
        const ownerId = `upload.${randomUUID()}`;
        artifactMetadataStore.registerAndReference(ingested, {
          projectId: artifact.projectId,
          ownerKind: 'upload',
          ownerId,
          createdRevision: projectView.revision,
        });
        sendJson(response, 201, {
          schemaVersion: 1,
          projectId: artifact.projectId,
          ownerId,
          artifact: {
            digest: ingested.digest,
            uri: ingested.uri,
            mediaType: ingested.mediaType,
            byteSize: ingested.byteSize,
            width: ingested.width,
            height: ingested.height,
            resourceUri: `/api/projects/${encodeURIComponent(artifact.projectId)}/artifacts/sha256/${ingested.digest}`,
            deduplicated: ingested.deduplicated,
          },
        });
        return;
      }
      if (request.method === 'GET' && artifact?.digest) {
        if (!artifactStore || !artifactMetadataStore) {
          throw new StudioError('ARTIFACT_STORE_DISABLED', 'This Studio service has no content-addressed artifact store.');
        }
        await studioService.readProjectTrusted(artifact.projectId);
        if (!artifactMetadataStore.hasProjectReference(artifact.projectId, artifact.digest)) {
          throw new StudioError('ARTIFACT_NOT_FOUND', 'The project has no reference to this artifact.');
        }
        const metadata = artifactMetadataStore.getArtifact(artifact.digest);
        if (!metadata || metadata.state !== 'LIVE') {
          throw new StudioError('ARTIFACT_NOT_LIVE', 'The artifact is not available for preview.');
        }
        const stream = await artifactStore.createReadStream(artifact.digest);
        response.writeHead(200, {
          'content-type': metadata.mediaType,
          'content-length': metadata.byteSize,
          'cache-control': 'private, max-age=31536000, immutable',
          'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
          'x-content-type-options': 'nosniff',
        });
        stream.on('error', (error) => response.destroy(error));
        stream.pipe(response);
        return;
      }
      const agentBinding = agentBindingRoute(url.pathname);
      if (request.method === 'POST' && agentBinding && agentBinding.bindingId === null) {
        assertHumanUiMutation(request, humanUiCsrfToken);
        const body = await readJsonBody(request, { maxBytes: 1024 });
        const issued = await humanAgentAccess.createBinding(agentBinding.projectId, body);
        sendJson(response, 201, {
          schemaVersion: 1,
          ...issued,
        });
        return;
      }
      if (request.method === 'POST' && agentBinding?.bindingId) {
        assertHumanUiMutation(request, humanUiCsrfToken);
        const body = await readJsonBody(request, { maxBytes: 512 });
        sendJson(response, 200, {
          schemaVersion: 1,
          ...(await humanAgentAccess.revokeBinding(agentBinding.projectId, agentBinding.bindingId, body)),
        });
        return;
      }
      const project = projectRoute(url.pathname);
      if (request.method === 'GET' && project?.resource === 'snapshot') {
        sendJson(response, 200, projectHttpProjection(await studioService.readProjectTrusted(project.projectId)));
        return;
      }
      if (request.method === 'GET' && project?.resource === 'activity') {
        const afterRevision = Number(url.searchParams.get('afterRevision') ?? 0);
        sendJson(response, 200, {
          schemaVersion: 1,
          projectId: project.projectId,
          events: await studioService.listActivityTrusted(project.projectId, { afterRevision }),
        });
        return;
      }
      if (request.method === 'GET' && project?.resource === 'agent-access') {
        sendJson(response, 200, {
          schemaVersion: 1,
          effectivePolicy: await humanAgentAccess.read(project.projectId),
          hostBindingSupport: hostBindingStore && pairingBroker ? 'AVAILABLE' : 'SQLITE_REQUIRED',
          hostBindings: await humanAgentAccess.listBindings(project.projectId),
          pendingHosts: await humanAgentAccess.listPendingHosts(project.projectId),
          mcpLauncherConfig: mcpLauncherProjection(
            request, project.projectId, pairingBroker, pairingEndpoint,
          ),
          csrfToken: humanUiCsrfToken,
        });
        return;
      }
      if (request.method === 'POST' && project?.resource === 'agent-access') {
        assertHumanUiMutation(request, humanUiCsrfToken);
        const body = await readJsonBody(request);
        const result = await humanAgentAccess.change(project.projectId, body);
        sendJson(response, 200, {
          schemaVersion: 1,
          ...result,
          hostBindingSupport: hostBindingStore && pairingBroker ? 'AVAILABLE' : 'SQLITE_REQUIRED',
          hostBindings: await humanAgentAccess.listBindings(project.projectId),
          pendingHosts: await humanAgentAccess.listPendingHosts(project.projectId),
          csrfToken: humanUiCsrfToken,
        });
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/demo') {
        assertHumanUiMutation(request, humanUiCsrfToken);
        sendJson(response, 200, await ensureDemoProject(studioService));
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/demo/action') {
        assertHumanUiMutation(request, humanUiCsrfToken);
        sendJson(response, 200, await runDemoAction(studioService, url.searchParams.get('action')));
        return;
      }
      if (url.pathname.startsWith('/api/')) {
        sendJson(response, ['GET', 'POST'].includes(request.method) ? 404 : 405, {
          schemaVersion: 1,
          error: { code: request.method === 'GET' || request.method === 'POST' ? 'NOT_FOUND' : 'METHOD_NOT_ALLOWED' },
        });
        return;
      }
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found\n');
    } catch (rawError) {
      if (requestAbort.signal.aborted && response.destroyed) return;
      const error = asStudioError(rawError);
      const projected = url.pathname.startsWith('/internal/mcp/')
        ? internalMcpErrorProjection(error)
        : { code: error.code, message: error.message, details: error.details };
      sendJson(response, errorStatus(error), {
        schemaVersion: 1,
        error: projected,
      });
    }
  });
}

export async function startStudioHttpServer({
  dataDirectory = resolve(process.env.NUMBERDROID_STUDIO_DATA ?? '.numberdroid-studio'),
  host = process.env.NUMBERDROID_STUDIO_HOST ?? '127.0.0.1',
  port = Number(process.env.NUMBERDROID_STUDIO_PORT ?? 4317),
  storeMode = process.env.NUMBERDROID_STUDIO_STORE ?? 'sqlite',
} = {}) {
  if (!['sqlite', 'json'].includes(storeMode)) throw new TypeError('storeMode must be sqlite or json.');
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new StudioError(
      'LOOPBACK_HOST_REQUIRED',
      'Checkpoint 1B is a local single-user service and may listen only on loopback.',
      { host },
    );
  }
  const store = storeMode === 'sqlite'
    ? await SqliteProjectStore.open({ filename: resolve(dataDirectory, 'studio.sqlite') })
    : new JsonProjectStore({ directory: dataDirectory });
  const studioService = new StudioService({ store });
  const hostBindingStore = storeMode === 'sqlite'
    ? new SqliteHostBindingStore({ workspace: store.workspace })
    : null;
  const pairingBroker = storeMode === 'sqlite' ? new McpPairingBroker() : null;
  const requestedPairingEndpoint = pairingBroker ? defaultMcpPairingEndpoint(dataDirectory) : null;
  const pairing = pairingBroker
    ? await startMcpPairingSocket({ broker: pairingBroker, endpoint: requestedPairingEndpoint })
    : null;
  const pairingServer = pairing?.server ?? null;
  const pairingEndpoint = pairing?.endpoint ?? null;
  const artifactStore = storeMode === 'sqlite'
    ? new ContentAddressedArtifactStore({ rootDirectory: resolve(dataDirectory, 'artifacts') })
    : null;
  await artifactStore?.initialize();
  const artifactMetadataStore = storeMode === 'sqlite'
    ? new SqliteArtifactMetadataStore({ workspace: store.workspace })
    : null;
  const server = createStudioHttpServer({
    studioService,
    hostBindingStore,
    pairingBroker,
    pairingEndpoint,
    artifactStore,
    artifactMetadataStore,
  });
  if (typeof store.close === 'function') server.once('close', () => store.close());
  if (pairing) server.once('close', () => pairing.close().catch(() => {}));
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolveListen);
  });
  return {
    server,
    studioService,
    hostBindingStore,
    pairingBroker,
    pairingEndpoint,
    artifactStore,
    artifactMetadataStore,
    address: server.address(),
    dataDirectory,
    storeMode,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const running = await startStudioHttpServer();
  const address = running.address;
  process.stdout.write(`Numberdroid Studio: http://${address.address}:${address.port}\n`);
  process.stdout.write(`Project data: ${running.dataDirectory}\n`);
}
