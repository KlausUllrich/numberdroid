import { readFile } from 'node:fs/promises';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { StudioService } from '../../../packages/application/src/index.js';
import { StudioError, asStudioError } from '../../../packages/domain/src/index.js';
import {
  ContentAddressedArtifactStore,
  JsonProjectStore,
  SqliteAgentAttemptStore,
  SqliteArtifactMetadataStore,
  SqliteHostBindingStore,
  SqliteProjectStore,
  SqliteSourceIntakeStore,
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
const SECURITY_RESPONSE_HEADERS = {
  'cross-origin-resource-policy': 'same-origin',
  'referrer-policy': 'no-referrer',
};
const SOURCE_INTAKE_LIMITS = {
  maxBytes: 16 * 1024 * 1024,
  maxWidth: 4096,
  maxHeight: 4096,
};

function sendJson(response, status, value) {
  const body = `${JSON.stringify(value)}\n`;
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...SECURITY_RESPONSE_HEADERS,
  });
  response.end(body);
}

function errorStatus(error) {
  if (['PROJECT_NOT_FOUND', 'ARTIFACT_NOT_FOUND', 'HOST_PAIRING_NOT_FOUND'].includes(error.code)) return 404;
  if (['PROJECT_EXISTS', 'REVISION_CONFLICT', 'IDEMPOTENCY_CONFLICT', 'COMMAND_ID_CONFLICT', 'ENTITY_EXISTS', 'ENTITY_STATE_CONFLICT', 'BROADER_ACCESS_CONFIRMATION_REQUIRED', 'AGENT_TARGET_REQUIRED', 'HOST_PAIRING_CONFIRMATION_REQUIRED', 'DRAFT_BRANCH_NOT_AVAILABLE_1B', 'ARTIFACT_NOT_LIVE', 'SOURCE_INTAKE_ALREADY_CLAIMED', 'SOURCE_INTAKE_ARTIFACT_MISMATCH', 'SOURCE_INTAKE_ORIGIN_MISMATCH', 'SOURCE_INTAKE_REFERENCE_MISSING'].includes(error.code)) return 409;
  if (error.code.startsWith('GRANT_') || error.code.startsWith('HOST_BINDING_') || ['FORBIDDEN', 'CONTEXT_PROJECT_MISMATCH', 'OBJECT_SCOPE_DENIED', 'BUDGET_EXCEEDED', 'UNTRUSTED_AGENT_CONTEXT', 'UI_ORIGIN_REQUIRED', 'UI_ORIGIN_FORBIDDEN', 'CSRF_INVALID'].includes(error.code)) return 403;
  if (error.code === 'ARTIFACT_TOO_LARGE') return 413;
  if (['ARTIFACT_DIGEST_MISMATCH', 'ARTIFACT_METADATA_CONFLICT'].includes(error.code)) return 409;
  if (['VALIDATION_ERROR', 'INVALID_JSON', 'BODY_TOO_LARGE', 'CONTENT_TYPE_REQUIRED', 'UNKNOWN_AGENT_ACCESS_MODE', 'UNKNOWN_COMMAND', 'SCHEMA_VERSION_UNSUPPORTED', 'VERSION_INVARIANT_VIOLATION', 'EMBEDDED_ARTIFACT_FORBIDDEN', 'ARTIFACT_UNSUPPORTED_MEDIA', 'ARTIFACT_MEDIA_MISMATCH', 'ARTIFACT_MALFORMED', 'ARTIFACT_DIMENSIONS_EXCEEDED', 'ARTIFACT_INVALID_DIGEST', 'ARTIFACT_URI_REQUIRED', 'PROVENANCE_PARAMETER_FORBIDDEN'].includes(error.code)) return 400;
  if (error.code === 'SOURCE_INTAKE_NOT_FOUND') return 404;
  if (['ARTIFACT_STORE_DISABLED', 'SOURCE_INTAKE_STORE_DISABLED', 'AGENT_ATTEMPT_LEDGER_REQUIRED'].includes(error.code)) return 503;
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
    ...SECURITY_RESPONSE_HEADERS,
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

function sourceIntakeRoute(pathname) {
  const match = /^\/api\/projects\/([^/]+)\/source-intakes(?:\/([^/]+)\/abandon)?$/.exec(pathname);
  return match ? {
    projectId: decodeURIComponent(match[1]),
    intakeId: match[2] ? decodeURIComponent(match[2]) : null,
  } : null;
}

function sourceMutationRoute(pathname) {
  const collection = /^\/api\/projects\/([^/]+)\/sources$/.exec(pathname);
  if (collection) return { projectId: decodeURIComponent(collection[1]), sourceId: null, resource: 'collection' };
  const review = /^\/api\/projects\/([^/]+)\/sources\/([^/]+)\/review$/.exec(pathname);
  return review ? {
    projectId: decodeURIComponent(review[1]),
    sourceId: decodeURIComponent(review[2]),
    resource: 'review',
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
  if (!['source.register', 'source.intake.commit'].includes(command.type)) return null;
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
    || (command.type === 'source.intake.commit' && artifact.byteSize !== command.payload.byteSize)
    || artifact.width !== command.payload.width || artifact.height !== command.payload.height) {
    throw new StudioError('ARTIFACT_METADATA_CONFLICT', 'Source media type and dimensions must match verified CAS metadata.', {
      expectedMediaType: artifact.mediaType,
      expectedByteSize: artifact.byteSize,
      expectedWidth: artifact.width,
      expectedHeight: artifact.height,
    });
  }
  return digest;
}

const ATTEMPT_DENIAL_CODES = new Set([
  'FORBIDDEN', 'GRANT_REQUIRED', 'GRANT_NOT_FOUND', 'GRANT_REVOKED', 'GRANT_ACTOR_MISMATCH',
  'GRANT_TASK_MISMATCH', 'GRANT_BRANCH_MISMATCH', 'GRANT_EXPIRED', 'GRANT_SCOPE_MISSING',
  'OBJECT_SCOPE_DENIED', 'BUDGET_EXCEEDED', 'CONTEXT_PROJECT_MISMATCH',
  'DRAFT_BRANCH_NOT_AVAILABLE_1B', 'ARTIFACT_NOT_LIVE', 'ARTIFACT_URI_REQUIRED',
]);

function safeAttemptId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value) ? value : null;
}

function attemptActivity(attempt) {
  return {
    id: `activity:${attempt.attemptId}`,
    projectId: attempt.projectId,
    revision: attempt.observedRevision,
    occurredAt: attempt.occurredAt,
    actor: attempt.actor,
    taskId: attempt.taskId,
    commandId: attempt.commandId,
    commandType: attempt.commandType ?? 'unknown',
    status: attempt.status.toLowerCase(),
    summary: `Agent command ${attempt.status.toLowerCase()}: ${attempt.errorCode}.`,
    changes: [],
  };
}

function humanOwnerContext(projectView) {
  return {
    actor: { id: projectView.snapshot.project.ownerId, kind: 'human', displayName: 'Local designer' },
    taskId: null,
    grantId: null,
    branchId: 'branch.main',
    correlationId: `ui.${randomUUID()}`,
  };
}

function humanCommandId(projectId, idempotencyKey, type) {
  const suffix = createHash('sha256').update(`${projectId}\0${idempotencyKey}\0${type}`, 'utf8').digest('hex').slice(0, 32);
  return `cmd.ui.${suffix}`;
}

function assertExactKeys(body, allowed, label) {
  if (!body || Array.isArray(body) || typeof body !== 'object') {
    throw new StudioError('VALIDATION_ERROR', `${label} must be an object.`);
  }
  if (Object.keys(body).some((key) => !allowed.has(key))) {
    throw new StudioError('VALIDATION_ERROR', `${label} contains an unsupported field.`);
  }
}

function humanCommandDto(projectId, body, type, payload) {
  if (!safeAttemptId(body.idempotencyKey)) {
    throw new StudioError('VALIDATION_ERROR', 'A valid idempotencyKey is required.');
  }
  if (!Number.isInteger(body.expectedRevision) || body.expectedRevision < 1) {
    throw new StudioError('VALIDATION_ERROR', 'A valid expectedRevision is required.');
  }
  return {
    schemaVersion: 1,
    commandId: humanCommandId(projectId, body.idempotencyKey, type),
    idempotencyKey: body.idempotencyKey,
    type,
    projectId,
    baseRevision: body.expectedRevision,
    expectedVersion: body.expectedRevision,
    dryRun: false,
    payload,
  };
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
          NUMBERDROID_STUDIO_AGENT_AUDIT_READY: '1',
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
  sourceIntakeStore = null,
  agentAttemptStore = null,
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
        const executionContext = bindingExecutionContext(binding);
        const projectView = await studioService.readProjectTrusted(binding.projectId);
        const attemptId = `attempt.${randomUUID()}`;
        let definition = null;
        let commandId = null;
        let result;
        try {
          const body = await readJsonBody(request, { maxBytes: 1024 * 1024 });
          if (!body || Array.isArray(body) || typeof body !== 'object' || body.schemaVersion !== 1
            || !body.command || Object.keys(body).some((key) => !['schemaVersion', 'command'].includes(key))) {
            throw new StudioError('VALIDATION_ERROR', 'The MCP execution bridge requires schemaVersion 1 and a command DTO.');
          }
          definition = studioService.commandCatalog.find((candidate) => candidate.type === body.command.type);
          commandId = safeAttemptId(body.command.commandId);
          if (body.command.projectId !== binding.projectId) {
            throw new StudioError('CONTEXT_PROJECT_MISMATCH', 'The requested project is outside this HostBinding.', {
              requestedProjectId: body.command.projectId,
              contextProjectId: binding.projectId,
            });
          }
          if (definition?.requiresDurableAgentLedger && agentAttemptStore?.isLive !== true) {
            throw new StudioError('AGENT_ATTEMPT_LEDGER_REQUIRED', 'This agent mutation is disabled until a durable attempt ledger is available.');
          }
          await assertExecutableBindingPolicy(studioService, binding);
          validateMcpSourceArtifact(body.command, artifactMetadataStore);
          result = await studioService.execute(
            body.command,
            executionContext,
            { signal: requestAbort.signal },
          );
        } catch (rawError) {
          const error = asStudioError(rawError);
          if (agentAttemptStore?.isLive === true) {
            agentAttemptStore.recordFailure({
              attemptId,
              projectId: binding.projectId,
              correlationId: executionContext.correlationId,
              actorId: binding.actor.id,
              taskId: safeAttemptId(binding.taskId),
              branchId: binding.branchId,
              commandId,
              commandType: definition?.type ?? 'unknown',
              targetKind: 'project',
              targetId: binding.projectId,
              observedRevision: projectView.revision,
              status: ATTEMPT_DENIAL_CODES.has(error.code) ? 'DENIED' : 'FAILED',
              errorCode: error.code,
              details: redactInternalDetails(error.details),
            });
          }
          throw error;
        }
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
      const sourceIntake = sourceIntakeRoute(url.pathname);
      if (request.method === 'POST' && sourceIntake && sourceIntake.intakeId === null) {
        assertHumanUiMutation(request, humanUiCsrfToken);
        if (!artifactStore || !sourceIntakeStore) {
          throw new StudioError('SOURCE_INTAKE_STORE_DISABLED', 'Source intake requires the SQLite content-addressed store.');
        }
        const idempotencyKey = request.headers['x-numberdroid-idempotency-key'];
        if (!safeAttemptId(idempotencyKey)) {
          throw new StudioError('VALIDATION_ERROR', 'A valid x-numberdroid-idempotency-key header is required.');
        }
        const origin = request.headers['x-numberdroid-source-origin'] ?? 'human_upload';
        if (!['human_upload', 'imported_generation'].includes(origin)) {
          throw new StudioError('VALIDATION_ERROR', 'Invalid x-numberdroid-source-origin header.');
        }
        const projectView = await studioService.readProjectTrusted(sourceIntake.projectId);
        const mediaType = String(request.headers['content-type'] ?? '').split(';', 1)[0].trim().toLowerCase();
        const expectedDigest = request.headers['x-numberdroid-expected-sha256'] ?? null;
        const declaredLength = Number(request.headers['content-length'] ?? 0);
        if (Number.isFinite(declaredLength) && declaredLength > SOURCE_INTAKE_LIMITS.maxBytes) {
          throw new StudioError('ARTIFACT_TOO_LARGE', 'Source intake exceeds the synchronous byte limit.', { maxBytes: SOURCE_INTAKE_LIMITS.maxBytes });
        }
        const ingested = await artifactStore.ingest(request, {
          mediaType,
          expectedDigest,
          limits: SOURCE_INTAKE_LIMITS,
        });
        const intake = sourceIntakeStore.stage(ingested, {
          projectId: sourceIntake.projectId,
          intakeId: `intake.${randomUUID()}`,
          idempotencyKey,
          origin,
          createdRevision: projectView.revision,
        });
        sendJson(response, intake.replayed ? 200 : 201, {
          schemaVersion: 1,
          projectId: sourceIntake.projectId,
          intakeId: intake.intakeId,
          state: intake.state,
          origin: intake.origin,
          replayed: intake.replayed,
          artifact: {
            ...intake.intake.artifact,
            resourceUri: `/api/projects/${encodeURIComponent(sourceIntake.projectId)}/artifacts/sha256/${intake.digest}`,
            deduplicated: ingested.deduplicated,
          },
        });
        return;
      }
      if (request.method === 'GET' && sourceIntake && sourceIntake.intakeId === null) {
        await studioService.readProjectTrusted(sourceIntake.projectId);
        if (!sourceIntakeStore) throw new StudioError('SOURCE_INTAKE_STORE_DISABLED', 'Source intake requires SQLite.');
        sendJson(response, 200, {
          schemaVersion: 1,
          projectId: sourceIntake.projectId,
          intakes: sourceIntakeStore.list(sourceIntake.projectId).map(({ idempotencyKey: _idempotencyKey, ...intake }) => intake),
        });
        return;
      }
      if (request.method === 'POST' && sourceIntake?.intakeId) {
        assertHumanUiMutation(request, humanUiCsrfToken);
        if (!sourceIntakeStore) throw new StudioError('SOURCE_INTAKE_STORE_DISABLED', 'Source intake requires SQLite.');
        const body = await readJsonBody(request, { maxBytes: 1024 });
        assertExactKeys(body, new Set(['idempotencyKey']), 'Source intake abandon request');
        const projectView = await studioService.readProjectTrusted(sourceIntake.projectId);
        const abandoned = sourceIntakeStore.abandon(sourceIntake.projectId, sourceIntake.intakeId, {
          idempotencyKey: body.idempotencyKey,
          abandonedBy: projectView.snapshot.project.ownerId,
        });
        const { idempotencyKey: _uploadKey, intake: _intake, ...safeAbandoned } = abandoned;
        sendJson(response, 200, { schemaVersion: 1, ...safeAbandoned });
        return;
      }
      const sourceMutation = sourceMutationRoute(url.pathname);
      if (request.method === 'POST' && sourceMutation?.resource === 'collection') {
        assertHumanUiMutation(request, humanUiCsrfToken);
        const body = await readJsonBody(request, { maxBytes: 128 * 1024 });
        assertExactKeys(body, new Set([
          'expectedRevision', 'idempotencyKey', 'intakeId', 'sourceId', 'name', 'artifactUri',
          'mediaType', 'byteSize', 'width', 'height', 'provenance',
        ]), 'Source commit request');
        const projectView = await studioService.readProjectTrusted(sourceMutation.projectId);
        const command = humanCommandDto(sourceMutation.projectId, body, 'source.intake.commit', {
          intakeId: body.intakeId,
          sourceId: body.sourceId,
          name: body.name,
          artifactUri: body.artifactUri,
          mediaType: body.mediaType,
          byteSize: body.byteSize,
          width: body.width,
          height: body.height,
          provenance: body.provenance,
        });
        sendJson(response, 200, await studioService.execute(command, humanOwnerContext(projectView), { signal: requestAbort.signal }));
        return;
      }
      if (request.method === 'POST' && sourceMutation?.resource === 'review') {
        assertHumanUiMutation(request, humanUiCsrfToken);
        const body = await readJsonBody(request, { maxBytes: 8192 });
        assertExactKeys(body, new Set([
          'expectedRevision', 'idempotencyKey', 'action', 'disposition', 'note', 'confirm',
        ]), 'Source review request');
        if (!['propose', 'decide'].includes(body.action)) {
          throw new StudioError('VALIDATION_ERROR', 'Source review action must be propose or decide.');
        }
        if (body.action === 'decide' && body.confirm !== true) {
          throw new StudioError('FORBIDDEN', 'A source review decision requires explicit human confirmation.');
        }
        if (body.action === 'decide' && body.disposition === 'REJECTED'
          && (typeof body.note !== 'string' || !body.note.trim())) {
          throw new StudioError('VALIDATION_ERROR', 'A rejection note is required.');
        }
        const projectView = await studioService.readProjectTrusted(sourceMutation.projectId);
        const type = body.action === 'propose' ? 'source.review.propose' : 'source.review.decide';
        const payload = body.action === 'propose'
          ? { sourceId: sourceMutation.sourceId, note: body.note ?? null }
          : { sourceId: sourceMutation.sourceId, disposition: body.disposition, note: body.note ?? null };
        const command = humanCommandDto(sourceMutation.projectId, body, type, payload);
        sendJson(response, 200, await studioService.execute(command, humanOwnerContext(projectView), { signal: requestAbort.signal }));
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
          ...SECURITY_RESPONSE_HEADERS,
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
        const committedEvents = await studioService.listActivityTrusted(project.projectId, { afterRevision });
        const attemptEvents = (agentAttemptStore?.listForProject(project.projectId, { afterRevision }) ?? [])
          .map(attemptActivity);
        sendJson(response, 200, {
          schemaVersion: 1,
          projectId: project.projectId,
          events: [...committedEvents, ...attemptEvents].sort((left, right) => (
            left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id)
          )),
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
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', ...SECURITY_RESPONSE_HEADERS });
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
  clock = () => new Date().toISOString(),
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
  const studioService = new StudioService({ store, clock, agentAttemptAuditReady: storeMode === 'sqlite' });
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
  const sourceIntakeStore = storeMode === 'sqlite'
    ? new SqliteSourceIntakeStore({ workspace: store.workspace })
    : null;
  const agentAttemptStore = storeMode === 'sqlite'
    ? new SqliteAgentAttemptStore({ workspace: store.workspace })
    : null;
  const server = createStudioHttpServer({
    studioService,
    hostBindingStore,
    pairingBroker,
    pairingEndpoint,
    artifactStore,
    artifactMetadataStore,
    sourceIntakeStore,
    agentAttemptStore,
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
    sourceIntakeStore,
    agentAttemptStore,
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
