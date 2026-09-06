import { readFile } from 'node:fs/promises';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  AgentTaskService,
  DerivedChildTaskService,
  AuthoringV2AdmissionService,
  AuthoringV2ExecutionSession,
  FixedProjectCapabilityProvider,
  ProcessingResultAdoptionReadService,
  ProcessingResultAdoptionPlanningService,
  StudioService,
} from '../../../packages/application/src/index.js';
import { StudioError, asStudioError } from '../../../packages/domain/src/index.js';
import {
  NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST,
  NUMBERDROID_PROJECT_CAPABILITY_MANIFEST,
} from '../../../packages/numberdroid-adapter/src/index.js';
import { createRoomPreviewScene } from '../../../packages/preview/src/room-preview-scene.js';
import {
  ContentAddressedArtifactStore,
  JsonProjectStore,
  SqliteAgentAttemptStore,
  SqliteAgentTaskStore,
  SqliteDerivedChildTaskStore,
  SqliteAuthoringV2AdmissionReader,
  SqliteArtifactMetadataStore,
  SqliteHostBindingStore,
  SqliteJobStore,
  SqliteProjectStore,
  SqliteProcessingResultAdoptionReader,
  SqliteProcessingResultAdoptionStore,
  SqliteSourceIntakeStore,
  TaskBranchProjectStore,
  assertWorkspaceNotQuarantined,
} from '../../../packages/persistence/src/index.js';
import { BackupOperationsRuntime } from '../../../packages/persistence/src/operations/backup-operations-runtime.js';
import {
  readOperationsConfigurationFile,
  validateOperationsConfiguration,
} from '../../../packages/persistence/src/operations/operations-config.js';
import { ensureDemoProject, runDemoAction } from './demo-project.js';
import { BackupOperationsController } from './backup-operations-controller.js';
import { createHumanAgentAccessController } from './human-agent-access.js';
import { jobHttpProjection, projectHttpProjection } from './http-projections.js';
import { AtlasPreviewWorker } from './atlas-preview-worker.js';
import {
  defaultMcpPairingEndpoint,
  McpPairingBroker,
  startMcpPairingSocket,
} from './mcp-pairing-broker.js';
import {
  generateWorkspaceOperatorBootstrapSecret,
  writeWorkspaceOperatorBootstrapSecret,
} from './workspace-operator-session.js';

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const publicDirectory = resolve(moduleDirectory, '../public');
const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/a1-7-state.js', ['a1-7-state.js', 'text/javascript; charset=utf-8']],
  ['/o1b-backups-state.js', ['o1b-backups-state.js', 'text/javascript; charset=utf-8']],
  ['/remote-ui-mode.js', ['remote-ui-mode.js', 'text/javascript; charset=utf-8']],
  ['/room-preview-state.js', ['room-preview-state.js', 'text/javascript; charset=utf-8']],
  ['/asset-authoring-state.js', ['asset-authoring-state.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml']],
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
const privateAuthoringV2RuntimeByServer = new WeakMap();

function createPrivateAuthoringV2Runtime({
  workspace,
  artifactStore,
  hostBindingStore,
  capabilityProvider,
  clock,
}) {
  const adoptionStore = new SqliteProcessingResultAdoptionStore({
    workspace,
    artifactStore,
    capabilityProvider,
    clock,
  });
  const capabilityReader = Object.freeze({
    schemaVersion: 1,
    kind: 'studio.authoring-v2-capability-reader',
    readProjectCapabilityManifest: (selection, options) => (
      capabilityProvider.getProjectCapabilityManifest(selection, options)
    ),
  });
  let state = 'OPEN';
  let activeOperations = 0;
  let drainedResolve = null;
  let closePromise = null;

  function assertOpen() {
    if (state !== 'OPEN') {
      throw new StudioError('AUTHORING_V2_RUNTIME_CLOSED', 'The private Authoring-v2 runtime is closing or closed.');
    }
  }

  function finishOperation() {
    activeOperations -= 1;
    if (activeOperations === 0 && drainedResolve !== null) {
      const resolveDrain = drainedResolve;
      drainedResolve = null;
      resolveDrain();
    }
  }

  function track(operation) {
    assertOpen();
    activeOperations += 1;
    let pending;
    try {
      pending = operation();
    } catch (error) {
      finishOperation();
      throw error;
    }
    return Promise.prototype.finally.call(pending, finishOperation);
  }

  function openSession(token, { correlationId = null } = {}) {
    assertOpen();
    const binding = hostBindingStore.resolve(token);
    const admissionReader = new SqliteAuthoringV2AdmissionReader({
      workspace,
      trustedBinding: binding,
      clock,
    });
    const admissionService = new AuthoringV2AdmissionService({
      admissionReader: admissionReader.asAdmissionReader(),
      capabilityReader,
      expectedCapabilityManifest: NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST,
    });
    const planningService = new ProcessingResultAdoptionPlanningService({
      ...adoptionStore.asPlanningPorts(),
      clock,
    });
    const session = new AuthoringV2ExecutionSession({
      admissionService,
      planningService,
      hostBoundAtomicStore: adoptionStore.asHostBoundAtomicStore(binding),
      trustedBinding: binding,
      correlationId,
    });
    return Object.freeze({
      negotiateSurface: (request, options) => track(() => session.negotiateSurface(request, options)),
      readCapabilities: (request, options) => track(() => session.readCapabilities(request, options)),
      executeProcessingResultAdoption: (request, options) => track(
        () => session.executeProcessingResultAdoption(request, options),
      ),
    });
  }

  function close() {
    if (closePromise !== null) return closePromise;
    state = 'CLOSING';
    closePromise = activeOperations === 0
      ? Promise.resolve()
      : new Promise((resolveDrain) => { drainedResolve = resolveDrain; });
    closePromise = closePromise.then(() => { state = 'CLOSED'; });
    return closePromise;
  }

  return Object.freeze({ openSession, close });
}

function sendJson(response, status, value, headers = {}) {
  const body = `${JSON.stringify(value)}\n`;
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...SECURITY_RESPONSE_HEADERS,
    ...headers,
  });
  response.end(body);
}

function errorStatus(error, pathname = '') {
  if (error.code === 'REVIEW_VERSION_CONFLICT') return 409;
  if (pathname.startsWith('/api/backups')) {
    if (error.code === 'WORKSPACE_OPERATOR_REQUIRED') return 401;
    if (['WORKSPACE_OPERATOR_FORBIDDEN', 'UI_ORIGIN_REQUIRED', 'UI_ORIGIN_FORBIDDEN', 'CSRF_INVALID'].includes(error.code)) return 403;
    if (error.code === 'OPERATION_NOT_FOUND') return 404;
    if (['OPERATION_IDEMPOTENCY_CONFLICT', 'OPERATION_STATE_CONFLICT', 'BACKUP_DESTINATION_CONFLICT'].includes(error.code)) return 409;
    if (error.code === 'OPERATIONS_UNAVAILABLE') return 503;
    if (['VALIDATION_ERROR', 'CONTENT_TYPE_REQUIRED', 'INVALID_JSON', 'BODY_TOO_LARGE', 'BACKUP_DESTINATION_UNKNOWN'].includes(error.code)) return 400;
    return 500;
  }
  if (pathname.startsWith('/internal/mcp/authoring-v2/')) {
    if (['AUTHORING_V2_REQUEST_INVALID', 'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID', 'PROCESSING_RESULT_ADOPTION_COMMAND_SCHEMA_UNSUPPORTED', 'PROCESSING_RESULT_ADOPTION_COMMAND_SCOPE_MISMATCH'].includes(error.code)) return 400;
    if (['AUTHORING_V2_SESSION_CONSUMED', 'AUTHORING_V2_CAPABILITY_MISMATCH', 'AUTHORING_V2_ADMISSION_DRIFT', 'PROCESSING_RESULT_ADOPTION_REVALIDATION_BLOCKED', 'PROCESSING_RESULT_ADOPTION_CURRENT_ASSET_CONFLICT'].includes(error.code)) return 409;
    if (['AUTHORING_V2_TRANSPORT_UNAVAILABLE', 'AUTHORING_V2_RUNTIME_CLOSED'].includes(error.code)) return 503;
    if (error.code === 'TASK_NOT_FOUND') return 404;
    if (['AUTO_ACCEPT_FORBIDDEN', 'TASK_ACTOR_MISMATCH', 'TASK_BRANCH_MISMATCH', 'TASK_BRANCH_REQUIRED', 'TASK_CAPABILITY_MISSING', 'TASK_EXPIRED', 'TASK_GRANT_MISMATCH', 'TASK_NOT_EXECUTABLE', 'TASK_PAUSED'].includes(error.code)) return 403;
  }
  if (pathname.includes('/processing-result-adoptions')
    && ['TASK_NOT_FOUND', 'PROCESSING_RESULT_ADOPTION_NOT_FOUND'].includes(error.code)) return 404;
  if (['PROJECT_NOT_FOUND', 'ARTIFACT_NOT_FOUND', 'HOST_PAIRING_NOT_FOUND', 'JOB_NOT_FOUND', 'ASSET_NOT_FOUND', 'ASSET_PROPOSAL_NOT_FOUND', 'ASSET_SLICE_NOT_FOUND', 'ROOM_ARCHETYPE_NOT_FOUND', 'ROOM_VARIANT_NOT_FOUND', 'ROOM_ASSET_VERSION_NOT_FOUND', 'ROOM_PROPOSAL_NOT_FOUND', 'ROOM_PLACEMENT_NOT_FOUND', 'ROOM_CONNECTOR_NOT_FOUND'].includes(error.code)) return 404;
  if (['PROJECT_EXISTS', 'REVISION_CONFLICT', 'IDEMPOTENCY_CONFLICT', 'COMMAND_ID_CONFLICT', 'ENTITY_EXISTS', 'ENTITY_STATE_CONFLICT', 'ENTITY_VERSION_CONFLICT', 'BROADER_ACCESS_CONFIRMATION_REQUIRED', 'AGENT_TARGET_REQUIRED', 'HOST_PAIRING_CONFIRMATION_REQUIRED', 'DRAFT_BRANCH_NOT_AVAILABLE_1B', 'ARTIFACT_NOT_LIVE', 'SOURCE_INTAKE_ALREADY_CLAIMED', 'SOURCE_INTAKE_ARTIFACT_MISMATCH', 'SOURCE_INTAKE_ORIGIN_MISMATCH', 'SOURCE_INTAKE_REFERENCE_MISSING', 'JOB_STATE_CONFLICT', 'JOB_ATTEMPT_CONFLICT', 'JOB_ATTEMPT_LIMIT', 'JOB_INPUT_MISMATCH', 'JOB_OUTPUT_MISMATCH', 'ASSET_LIFECYCLE_BLOCKED', 'ASSET_LIFECYCLE_TRANSITION_INVALID', 'ASSET_PROPOSAL_DECISION_DUPLICATE', 'ASSET_PROPOSAL_DECISION_INCOMPLETE', 'ASSET_PROPOSAL_DUPLICATE_ASSET', 'ASSET_PROPOSAL_DUPLICATE_ITEM', 'ASSET_PROPOSAL_VERSION_INVALID', 'ASSET_SLICE_STALE', 'ASSET_WARNING_NOT_FOUND', 'ASSET_WARNING_UNDISPOSITIONED', 'ROOM_EDIT_REQUIRES_DRAFT', 'ROOM_LIFECYCLE_BLOCKED', 'ROOM_LIFECYCLE_TRANSITION_INVALID', 'ROOM_PROPOSAL_UNRESOLVED', 'ROOM_PROPOSAL_STATE_CONFLICT', 'ROOM_PROPOSAL_DECISION_INCOMPLETE', 'ROOM_PROPOSAL_DECISION_DUPLICATE', 'ROOM_WARNING_NOT_FOUND', 'ROOM_WARNING_UNDISPOSITIONED', 'ROOM_RESIZE_CLIPS_CONTENT', 'ROOM_VERSION_CONFLICT'].includes(error.code)) return 409;
  if (error.code.startsWith('GRANT_') || error.code.startsWith('HOST_BINDING_') || ['FORBIDDEN', 'CONTEXT_PROJECT_MISMATCH', 'OBJECT_SCOPE_DENIED', 'BUDGET_EXCEEDED', 'JOB_AUTHORITY_MISMATCH', 'UNTRUSTED_AGENT_CONTEXT', 'UI_ORIGIN_REQUIRED', 'UI_ORIGIN_FORBIDDEN', 'CSRF_INVALID'].includes(error.code)) return 403;
  if (error.code === 'ARTIFACT_TOO_LARGE') return 413;
  if (['ARTIFACT_DIGEST_MISMATCH', 'ARTIFACT_METADATA_CONFLICT'].includes(error.code)) return 409;
  if (['VALIDATION_ERROR', 'INVALID_JSON', 'BODY_TOO_LARGE', 'CONTENT_TYPE_REQUIRED', 'UNKNOWN_AGENT_ACCESS_MODE', 'UNKNOWN_COMMAND', 'SCHEMA_VERSION_UNSUPPORTED', 'VERSION_INVARIANT_VIOLATION', 'EMBEDDED_ARTIFACT_FORBIDDEN', 'ARTIFACT_UNSUPPORTED_MEDIA', 'ARTIFACT_MEDIA_MISMATCH', 'ARTIFACT_MALFORMED', 'ARTIFACT_DIMENSIONS_EXCEEDED', 'ARTIFACT_INVALID_DIGEST', 'ARTIFACT_URI_REQUIRED', 'PROVENANCE_PARAMETER_FORBIDDEN', 'ATLAS_RECT_INVALID', 'ATLAS_RECT_LIMIT', 'ATLAS_RECT_DUPLICATE', 'ATLAS_RECT_DUPLICATE_ID', 'ATLAS_RECT_OVERLAP', 'ATLAS_RECT_OUT_OF_BOUNDS', 'ATLAS_REMAP_INVALID', 'ATLAS_REMAP_NOT_ONE_TO_ONE', 'ATLAS_PADDING_POLICY_UNSUPPORTED', 'ATLAS_GRID_INVALID', 'ATLAS_OUTPUT_LIMIT', 'ATLAS_OUTPUT_BYTES_LIMIT', 'ATLAS_PNG_UNSUPPORTED', 'ATLAS_SOURCE_REQUIRED', 'ATLAS_SOURCE_MISMATCH', 'ASSET_ANCHOR_OUT_OF_BOUNDS', 'ASSET_CONNECTOR_DUPLICATE', 'ASSET_EXTENSION_INVALID', 'ASSET_PROPOSAL_BYTES_LIMIT', 'ASSET_PROPOSAL_INVALID', 'ASSET_PROPOSAL_LIMIT', 'ASSET_PROPOSAL_REJECTION_REASON_REQUIRED', 'ASSET_SLICE_BINDING_INVALID', 'ROOM_PROPOSAL_INVALID', 'ROOM_PROPOSAL_LIMIT', 'ROOM_PROPOSAL_REJECTION_REASON_REQUIRED', 'ROOM_CONNECTOR_OUT_OF_BOUNDS', 'ROOM_CELL_LIMIT', 'ROOM_DIMENSION_POLICY_INVALID', 'ROOM_CONNECTOR_POLICY_INVALID', 'ROOM_TAG_POLICY_INVALID', 'PROCESSING_RESULT_ADOPTION_READ_REQUEST_INVALID'].includes(error.code)) return 400;
  if (error.code === 'SOURCE_INTAKE_NOT_FOUND') return 404;
  if (['ARTIFACT_STORE_DISABLED', 'SOURCE_INTAKE_STORE_DISABLED', 'AGENT_ATTEMPT_LEDGER_REQUIRED', 'JOB_STORE_DISABLED', 'ASSET_STORE_DISABLED', 'ROOM_STORE_DISABLED', 'PROCESSING_RESULT_ADOPTION_READ_UNAVAILABLE', 'PROCESSING_RESULT_ADOPTION_PREVIEW_UNAVAILABLE'].includes(error.code)) return 503;
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

function bindingExecutionContext(binding, correlationId = `mcp.${randomUUID()}`) {
  return {
    actor: binding.actor,
    taskId: binding.taskId,
    grantId: binding.grantId,
    branchId: binding.branchId,
    correlationId,
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

function taskRoute(pathname) {
  const collection = /^\/api\/projects\/([^/]+)\/tasks$/.exec(pathname);
  if (collection) return { projectId: decodeURIComponent(collection[1]), taskId: null, action: 'collection' };
  const review = /^\/api\/projects\/([^/]+)\/tasks\/([^/]+)\/reviews\/([^/]+)\/(decide|merge)$/.exec(pathname);
  if (review) return {
    projectId: decodeURIComponent(review[1]), taskId: decodeURIComponent(review[2]),
    reviewId: decodeURIComponent(review[3]), action: review[4],
  };
  const action = /^\/api\/projects\/([^/]+)\/tasks\/([^/]+)\/(pause|resume|cancel|reject|submit-review)$/.exec(pathname);
  if (action) return {
    projectId: decodeURIComponent(action[1]), taskId: decodeURIComponent(action[2]), action: action[3],
  };
  const item = /^\/api\/projects\/([^/]+)\/tasks\/([^/]+)$/.exec(pathname);
  return item ? { projectId: decodeURIComponent(item[1]), taskId: decodeURIComponent(item[2]), action: 'read' } : null;
}

function processingResultAdoptionRoute(pathname) {
  const preview = /^\/api\/projects\/([^/]+)\/tasks\/([^/]+)\/processing-result-adoptions\/([1-9][0-9]*)\/selected-output$/.exec(pathname);
  if (preview) {
    const revisionText = preview[3];
    const branchRevision = Number(revisionText);
    if (!Number.isSafeInteger(branchRevision) || branchRevision < 2 || String(branchRevision) !== revisionText) return null;
    return {
      projectId: decodeURIComponent(preview[1]),
      taskId: decodeURIComponent(preview[2]),
      branchRevision,
      action: 'selected-output',
    };
  }
  const collection = /^\/api\/projects\/([^/]+)\/tasks\/([^/]+)\/processing-result-adoptions$/.exec(pathname);
  return collection ? {
    projectId: decodeURIComponent(collection[1]),
    taskId: decodeURIComponent(collection[2]),
    branchRevision: null,
    action: 'collection',
  } : null;
}

function taskMergeRoute(pathname) {
  const match = /^\/api\/projects\/([^/]+)\/task-merges\/([^/]+)\/revert$/.exec(pathname);
  return match ? { projectId: decodeURIComponent(match[1]), mergeId: decodeURIComponent(match[2]) } : null;
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

function atlasRoute(pathname) {
  const proposal = /^\/api\/projects\/([^/]+)\/atlases\/grid-proposal$/.exec(pathname);
  if (proposal) return { projectId: decodeURIComponent(proposal[1]), atlasId: null, action: 'grid-proposal' };
  const mutation = /^\/api\/projects\/([^/]+)\/atlases\/([^/]+)\/(definition|preview|commit)$/.exec(pathname);
  return mutation ? {
    projectId: decodeURIComponent(mutation[1]),
    atlasId: decodeURIComponent(mutation[2]),
    action: mutation[3],
  } : null;
}

function jobRoute(pathname) {
  const match = /^\/api\/projects\/([^/]+)\/jobs\/([^/]+)(?:\/(cancel|retry|discard))?$/.exec(pathname);
  return match ? {
    projectId: decodeURIComponent(match[1]),
    jobId: decodeURIComponent(match[2]),
    action: match[3] ?? 'read',
  } : null;
}

function assetRoute(pathname) {
  const lifecycle = /^\/api\/projects\/([^/]+)\/assets\/([^/]+)\/lifecycle$/.exec(pathname);
  if (lifecycle) return {
    projectId: decodeURIComponent(lifecycle[1]),
    assetId: decodeURIComponent(lifecycle[2]),
    action: 'lifecycle',
  };
  const item = /^\/api\/projects\/([^/]+)\/assets\/([^/]+)$/.exec(pathname);
  if (item) return {
    projectId: decodeURIComponent(item[1]),
    assetId: decodeURIComponent(item[2]),
    action: 'read',
  };
  const collection = /^\/api\/projects\/([^/]+)\/assets$/.exec(pathname);
  return collection ? {
    projectId: decodeURIComponent(collection[1]),
    assetId: null,
    action: 'read',
  } : null;
}

function assetProposalRoute(pathname) {
  const action = /^\/api\/projects\/([^/]+)\/asset-proposals\/([^/]+)\/(decision|apply)$/.exec(pathname);
  if (action) return {
    projectId: decodeURIComponent(action[1]),
    proposalId: decodeURIComponent(action[2]),
    action: action[3],
  };
  const collection = /^\/api\/projects\/([^/]+)\/asset-proposals$/.exec(pathname);
  return collection ? {
    projectId: decodeURIComponent(collection[1]),
    proposalId: null,
    action: 'submit',
  } : null;
}

function roomRoute(pathname) {
  const commandMatch = /^\/api\/projects\/([^/]+)\/rooms\/([^/]+)\/(intent|shape|resize|connectors|placements-add|placements-move|placements-remove|warning-dispositions|validate|finalize|fork)$/.exec(pathname);
  if (commandMatch) return {
    projectId: decodeURIComponent(commandMatch[1]),
    roomVariantId: decodeURIComponent(commandMatch[2]),
    action: commandMatch[3],
  };
  const item = /^\/api\/projects\/([^/]+)\/rooms\/([^/]+)$/.exec(pathname);
  if (item) return { projectId: decodeURIComponent(item[1]), roomVariantId: decodeURIComponent(item[2]), action: 'read' };
  const collection = /^\/api\/projects\/([^/]+)\/rooms$/.exec(pathname);
  return collection ? { projectId: decodeURIComponent(collection[1]), roomVariantId: null, action: 'collection' } : null;
}

function roomPreviewSceneRoute(pathname) {
  const match = /^\/api\/projects\/([^/]+)\/revisions\/([1-9][0-9]*)\/room-variants\/([^/]+)\/versions\/([1-9][0-9]*)\/preview-scene$/.exec(pathname);
  if (!match) return null;
  const projectRevision = Number(match[2]);
  const roomVersion = Number(match[4]);
  if (!Number.isSafeInteger(projectRevision) || !Number.isSafeInteger(roomVersion)) return null;
  return {
    projectId: decodeURIComponent(match[1]),
    projectRevision,
    roomVariantId: decodeURIComponent(match[3]),
    roomVersion,
  };
}

function roomArchetypeRoute(pathname) {
  const collection = /^\/api\/projects\/([^/]+)\/room-archetypes$/.exec(pathname);
  return collection ? { projectId: decodeURIComponent(collection[1]) } : null;
}

function roomProposalRoute(pathname) {
  const action = /^\/api\/projects\/([^/]+)\/room-proposals\/([^/]+)\/(decision|apply)$/.exec(pathname);
  if (action) return { projectId: decodeURIComponent(action[1]), proposalId: decodeURIComponent(action[2]), action: action[3] };
  const collection = /^\/api\/projects\/([^/]+)\/room-proposals$/.exec(pathname);
  return collection ? { projectId: decodeURIComponent(collection[1]), proposalId: null, action: 'submit' } : null;
}

function roomQueryDto(url, route) {
  const allowed = new Set(['roomArchetypeId', 'proposalId', 'kinds', 'lifecycles', 'includeVersions', 'includeProposals', 'limit']);
  for (const key of url.searchParams.keys()) {
    if (!allowed.has(key)) throw new StudioError('VALIDATION_ERROR', `Room query contains an unsupported field: ${key}.`, { field: key });
  }
  const singular = (key) => {
    const values = url.searchParams.getAll(key);
    if (values.length > 1) throw new StudioError('VALIDATION_ERROR', `Room query field ${key} may appear only once.`, { field: key });
    return values[0];
  };
  const dto = { schemaVersion: 1, projectId: route.projectId, ...(route.roomVariantId ? { roomVariantId: route.roomVariantId } : {}) };
  for (const key of ['roomArchetypeId', 'proposalId']) {
    const value = singular(key);
    if (value !== undefined) dto[key] = value;
  }
  for (const key of ['kinds', 'lifecycles']) {
    const values = url.searchParams.getAll(key);
    if (values.length > 0) dto[key] = values;
  }
  for (const key of ['includeVersions', 'includeProposals']) {
    const value = singular(key);
    if (value !== undefined) {
      if (!['true', 'false'].includes(value)) throw new StudioError('VALIDATION_ERROR', `${key} must be true or false.`, { field: key });
      dto[key] = value === 'true';
    }
  }
  const limit = singular('limit');
  if (limit !== undefined) {
    if (!/^[1-9][0-9]*$/.test(limit)) throw new StudioError('VALIDATION_ERROR', 'limit must be a positive integer.', { field: 'limit' });
    dto.limit = Number(limit);
  }
  return dto;
}

function assetQueryDto(url, route) {
  const allowed = new Set([
    'proposalId', 'text', 'kinds', 'lifecycles', 'tags', 'findingSeverities',
    'includeProposals', 'limit',
  ]);
  for (const key of url.searchParams.keys()) {
    if (!allowed.has(key)) {
      throw new StudioError('VALIDATION_ERROR', `Asset query contains an unsupported field: ${key}.`, { field: key });
    }
  }
  const singular = (key) => {
    const values = url.searchParams.getAll(key);
    if (values.length > 1) {
      throw new StudioError('VALIDATION_ERROR', `Asset query field ${key} may appear only once.`, { field: key });
    }
    return values[0];
  };
  const request = {
    schemaVersion: 1,
    projectId: route.projectId,
    ...(route.assetId ? { assetId: route.assetId } : {}),
  };
  for (const key of ['proposalId', 'text']) {
    const value = singular(key);
    if (value !== undefined) request[key] = value;
  }
  for (const key of ['kinds', 'lifecycles', 'tags', 'findingSeverities']) {
    const values = url.searchParams.getAll(key);
    if (values.length > 0) request[key] = values;
  }
  const includeProposals = singular('includeProposals');
  if (includeProposals !== undefined) {
    if (!['true', 'false'].includes(includeProposals)) {
      throw new StudioError('VALIDATION_ERROR', 'includeProposals must be true or false.', { field: 'includeProposals' });
    }
    request.includeProposals = includeProposals === 'true';
  }
  const limit = singular('limit');
  if (limit !== undefined) {
    if (!/^[1-9][0-9]*$/.test(limit)) {
      throw new StudioError('VALIDATION_ERROR', 'limit must be a positive integer.', { field: 'limit' });
    }
    request.limit = Number(limit);
  }
  return request;
}

function assetBindingPreview(projectId, binding, alt) {
  const digest = typeof binding?.digest === 'string' && /^[a-f0-9]{64}$/.test(binding.digest)
    ? binding.digest
    : null;
  const ready = digest !== null && ['image/png', 'image/webp'].includes(binding?.mediaType);
  return {
    schemaVersion: 1,
    state: ready ? 'READY' : (binding?.mediaType ? 'UNSUPPORTED' : 'MISSING'),
    resourceUri: ready
      ? `/api/projects/${encodeURIComponent(projectId)}/artifacts/sha256/${digest}`
      : null,
    alt,
  };
}

function roomPreviewSceneHttpProjection(scene) {
  const projected = structuredClone(scene);
  const prefix = `/api/projects/${encodeURIComponent(projected.source.projectId)}/artifacts/sha256/`;
  const projectArtifact = (artifact) => ({
    ...artifact,
    resourceUri: `${prefix}${artifact.digest}`,
  });
  for (const entity of projected.entities) {
    entity.artifact = projectArtifact(entity.artifact);
    entity.segments = entity.segments.map((segment) => ({
      ...segment,
      artifact: projectArtifact(segment.artifact),
    }));
  }
  return projected;
}

function assetQueryHttpProjection(view) {
  const projected = structuredClone(view);
  projected.assets = projected.assets.map((asset) => ({
    ...asset,
    preview: assetBindingPreview(view.projectId, asset.sliceBinding, `${asset.name} preview`),
  }));
  projected.proposals = projected.proposals.map((proposal) => ({
    ...proposal,
    items: proposal.items.map((item) => ({
      ...item,
      preview: assetBindingPreview(view.projectId, item.sliceBinding, `${item.name} proposal preview`),
    })),
  }));
  return projected;
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

function assertHumanUiRead(request) {
  const remoteAddress = request.socket.remoteAddress ?? '';
  const loopbackRemote = remoteAddress === '127.0.0.1'
    || remoteAddress === '::1'
    || remoteAddress === '::ffff:127.0.0.1';
  const hostUrl = loopbackOrigin(`http://${request.headers.host ?? ''}`);
  if (!loopbackRemote || !hostUrl) {
    throw new StudioError('UI_ORIGIN_FORBIDDEN', 'Human backup reads are available only on direct loopback.');
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
    .filter(([key]) => !sensitiveKeys.has(key)
      && !/(?:secret|password|credential|privatekey)/i.test(key))
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
  'HOST_BINDING_NOT_FOUND', 'HOST_BINDING_REVOKED', 'HOST_BINDING_EXPIRED',
  'HOST_BINDING_GRANT_MISMATCH',
  'OBJECT_SCOPE_DENIED', 'BUDGET_EXCEEDED', 'CONTEXT_PROJECT_MISMATCH',
  'JOB_AUTHORITY_MISMATCH',
  'DRAFT_BRANCH_NOT_AVAILABLE_1B', 'ARTIFACT_NOT_LIVE', 'ARTIFACT_URI_REQUIRED',
]);

const AUTHORING_V2_ATTEMPT_DENIAL_CODES = new Set([
  ...ATTEMPT_DENIAL_CODES,
  'AUTHORING_V2_ADMISSION_DRIFT',
  'AUTO_ACCEPT_FORBIDDEN', 'TASK_ACTOR_MISMATCH', 'TASK_BRANCH_MISMATCH',
  'TASK_BRANCH_REQUIRED', 'TASK_CAPABILITY_MISSING', 'TASK_EXPIRED',
  'TASK_GRANT_MISMATCH', 'TASK_NOT_EXECUTABLE', 'TASK_NOT_FOUND', 'TASK_PAUSED',
]);

const AUTHORING_V2_MCP_ROUTES = new Map([
  ['/internal/mcp/authoring-v2/handshake', Object.freeze({
    operation: 'negotiateSurface',
    commandType: 'authoring-v2.surface.negotiate',
    maxBytes: 1024,
  })],
  ['/internal/mcp/authoring-v2/capabilities', Object.freeze({
    operation: 'readCapabilities',
    commandType: 'authoring-v2.capabilities.read',
    maxBytes: 1024,
  })],
  ['/internal/mcp/authoring-v2/processing-result-adopt', Object.freeze({
    operation: 'executeProcessingResultAdoption',
    commandType: 'asset.processing-result.adopt',
    maxBytes: 1024 * 1024,
  })],
]);

function assertAuthoringV2TransportReady({
  runtime,
  studioService,
  hostBindingStore,
  agentAttemptStore,
  jobStore,
  agentTaskService,
}) {
  const ready = runtime !== null
    && runtime !== undefined
    && typeof runtime.openSession === 'function'
    && hostBindingStore !== null
    && typeof hostBindingStore.resolve === 'function'
    && typeof hostBindingStore.resolveAttemptSubject === 'function'
    && agentAttemptStore?.isLive === true
    && studioService.agentAttemptAuditReady === true
    && jobStore?.isLive === true
    && studioService.durableJobStoreReady === true
    && studioService.durableAssetStoreReady === true
    && studioService.durableRoomStoreReady === true
    && agentTaskService !== null
    && typeof agentTaskService.hasTask === 'function';
  if (!ready) {
    throw new StudioError(
      'AUTHORING_V2_TRANSPORT_UNAVAILABLE',
      'Authoring v2 requires the complete local durable Studio stack.',
    );
  }
}

function safeAttemptId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value) ? value : null;
}

function attemptActivity(attempt) {
  const summary = attempt.status === 'AUTHORIZED'
    ? 'Agent command authorized.'
    : `Agent command ${attempt.status.toLowerCase()}: ${attempt.errorCode}.`;
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
    summary,
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

async function assertExecutableBindingPolicy(studioService, binding, agentTaskService = null) {
  if (agentTaskService?.hasTask(binding.projectId, binding.taskId, binding.branchId)) return;
  const projectView = await studioService.readProjectTrusted(binding.projectId);
  const grant = projectView.snapshot.grants.find((candidate) => candidate.id === binding.grantId);
  const scopes = new Set(grant?.scopes ?? []);
  if (!scopes.has('project.status.write') && (scopes.has('source.write') || scopes.has('asset.write'))) {
    throw new StudioError('DRAFT_BRANCH_NOT_AVAILABLE_1B', 'This legacy draft binding cannot mutate the shared project head. Rotate it to a supported 1B policy.');
  }
}

function mcpLauncherProjection(
  request, projectId, pairingBroker, pairingEndpoint,
  durableAssetStoreReady, durableRoomStoreReady, taskBranchReady = false,
) {
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
          NUMBERDROID_STUDIO_JOB_STORE_READY: '1',
          NUMBERDROID_STUDIO_ASSET_STORE_READY: durableAssetStoreReady === true ? '1' : '0',
          NUMBERDROID_STUDIO_ROOM_STORE_READY: durableRoomStoreReady === true ? '1' : '0',
          NUMBERDROID_STUDIO_TASK_BRANCH_READY: taskBranchReady === true ? '1' : '0',
        },
      },
    },
  };
}

export function createStudioHttpServer({
  studioService,
  agentTaskService = null,
  processingResultAdoptionReadService = null,
  hostBindingStore = null,
  pairingBroker = null,
  pairingEndpoint = null,
  artifactStore = null,
  artifactMetadataStore = null,
  sourceIntakeStore = null,
  agentAttemptStore = null,
  jobStore = null,
  atlasPreviewWorker = null,
  backupOperationsController = null,
}) {
  if (!studioService) throw new TypeError('studioService is required.');
  const humanUiCsrfToken = randomBytes(32).toString('base64url');
  const humanAgentAccess = createHumanAgentAccessController({
    studioService, hostBindingStore, pairingBroker, agentTaskService,
  });

  const server = createServer(async (request, response) => {
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
      if (backupOperationsController !== null
        && request.method === 'POST'
        && url.pathname === '/api/backups/operator-session') {
        assertHumanUiMutation(request, humanUiCsrfToken);
        const body = await readJsonBody(request, { maxBytes: 1024 });
        assertExactKeys(body, new Set(['schemaVersion', 'bootstrapSecret']), 'Backup operator bootstrap');
        if (body.schemaVersion !== 1 || typeof body.bootstrapSecret !== 'string') {
          throw new StudioError('VALIDATION_ERROR', 'The backup operator bootstrap is invalid.');
        }
        const secret = body.bootstrapSecret;
        body.bootstrapSecret = null;
        const unlocked = backupOperationsController.unlock(secret);
        sendJson(response, 200, unlocked.projection, { 'set-cookie': unlocked.cookie });
        return;
      }
      if (backupOperationsController !== null
        && request.method === 'GET'
        && url.pathname === '/api/backups') {
        assertHumanUiRead(request);
        sendJson(response, 200, await backupOperationsController.overview(request.headers.cookie));
        return;
      }
      const backupOperationRead = backupOperationsController !== null && request.method === 'GET'
        ? /^\/api\/backups\/operations\/([^/]+)$/.exec(url.pathname)
        : null;
      if (backupOperationRead) {
        assertHumanUiRead(request);
        sendJson(response, 200, await backupOperationsController.readOperation(
          decodeURIComponent(backupOperationRead[1]),
          request.headers.cookie,
        ));
        return;
      }
      if (backupOperationsController !== null
        && request.method === 'POST'
        && url.pathname === '/api/backups/operations') {
        assertHumanUiMutation(request, humanUiCsrfToken);
        const body = await readJsonBody(request, { maxBytes: 2048 });
        const accepted = await backupOperationsController.request(
          body,
          request.headers.cookie,
        );
        sendJson(response, 202, accepted);
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/projects') {
        sendJson(response, 200, { schemaVersion: 1, projects: await studioService.listProjectsTrusted() });
        return;
      }
      const authoringV2Route = request.method === 'POST'
        ? AUTHORING_V2_MCP_ROUTES.get(url.pathname)
        : null;
      if (authoringV2Route) {
        assertLoopbackServiceRequest(request);
        const runtime = privateAuthoringV2RuntimeByServer.get(server);
        assertAuthoringV2TransportReady({
          runtime,
          studioService,
          hostBindingStore,
          agentAttemptStore,
          jobStore,
          agentTaskService,
        });
        const token = bearerToken(request);
        let attemptSubject = null;
        let attemptContext = null;
        let projectView = null;
        let commandId = null;
        let result;
        try {
          attemptSubject = hostBindingStore.resolveAttemptSubject(token);
          attemptContext = bindingExecutionContext(attemptSubject);
          projectView = await studioService.readProjectTrusted(attemptSubject.projectId);
          const body = await readJsonBody(request, { maxBytes: authoringV2Route.maxBytes });
          if (authoringV2Route.operation === 'executeProcessingResultAdoption') {
            commandId = safeAttemptId(body?.command?.commandId);
          }
          const session = runtime.openSession(token, {
            correlationId: attemptContext.correlationId,
          });
          result = await session[authoringV2Route.operation](body, {
            signal: requestAbort.signal,
          });
        } catch (rawError) {
          const error = asStudioError(rawError);
          if (attemptSubject !== null && attemptContext !== null && projectView !== null) {
            agentAttemptStore.recordFailure({
              attemptId: `attempt.${randomUUID()}`,
              projectId: attemptSubject.projectId,
              correlationId: attemptContext.correlationId,
              actorId: attemptSubject.actor.id,
              taskId: safeAttemptId(attemptSubject.taskId),
              branchId: attemptSubject.branchId,
              commandId,
              commandType: authoringV2Route.commandType,
              targetKind: 'project',
              targetId: attemptSubject.projectId,
              observedRevision: projectView.revision,
              status: AUTHORING_V2_ATTEMPT_DENIAL_CODES.has(error.code) ? 'DENIED' : 'FAILED',
              errorCode: error.code,
              details: redactInternalDetails(error.details),
            });
          }
          throw error;
        }
        sendJson(response, 200, result);
        return;
      }
      if (request.method === 'POST' && url.pathname === '/internal/mcp/execute') {
        assertLoopbackServiceRequest(request);
        if (!hostBindingStore) throw new StudioError('HOST_BINDING_DISABLED', 'This Studio service has no HostBinding store.');
        const token = bearerToken(request);
        const attemptSubject = agentAttemptStore?.isLive === true
          && typeof hostBindingStore.resolveAttemptSubject === 'function'
          ? hostBindingStore.resolveAttemptSubject(token)
          : hostBindingStore.resolve(token);
        const attemptContext = bindingExecutionContext(attemptSubject);
        const projectView = await studioService.readProjectTrusted(attemptSubject.projectId);
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
          const liveBinding = hostBindingStore.resolve(token);
          const liveContext = bindingExecutionContext(liveBinding, attemptContext.correlationId);
          if (body.command.projectId !== liveBinding.projectId) {
            throw new StudioError('CONTEXT_PROJECT_MISMATCH', 'The requested project is outside this HostBinding.', {
              requestedProjectId: body.command.projectId,
              contextProjectId: liveBinding.projectId,
            });
          }
          if (definition?.requiresDurableAgentLedger && agentAttemptStore?.isLive !== true) {
            throw new StudioError('AGENT_ATTEMPT_LEDGER_REQUIRED', 'This agent mutation is disabled until a durable attempt ledger is available.');
          }
          await assertExecutableBindingPolicy(studioService, liveBinding, agentTaskService);
          validateMcpSourceArtifact(body.command, artifactMetadataStore);
          const taskBound = agentTaskService?.hasTask(
            liveBinding.projectId, liveBinding.taskId, liveBinding.branchId,
          ) === true;
          result = await (taskBound ? agentTaskService : studioService).execute(
            body.command,
            liveContext,
            { signal: requestAbort.signal },
          );
          if (definition?.type === 'atlas.preview.slices') atlasPreviewWorker?.kick();
        } catch (rawError) {
          const error = asStudioError(rawError);
          if (agentAttemptStore?.isLive === true) {
            agentAttemptStore.recordFailure({
              attemptId,
              projectId: attemptSubject.projectId,
              correlationId: attemptContext.correlationId,
              actorId: attemptSubject.actor.id,
              taskId: safeAttemptId(attemptSubject.taskId),
              branchId: attemptSubject.branchId,
              commandId,
              commandType: definition?.type ?? 'unknown',
              targetKind: 'project',
              targetId: attemptSubject.projectId,
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
        const taskBound = agentTaskService?.hasTask(binding.projectId, binding.taskId, binding.branchId) === true;
        sendJson(response, 200, await (taskBound ? agentTaskService : studioService).readProject(
          { projectId: body.projectId },
          bindingExecutionContext(binding),
          { signal: requestAbort.signal },
        ));
        return;
      }
      if (request.method === 'POST' && ['/internal/mcp/task-read', '/internal/mcp/task-submit-review'].includes(url.pathname)) {
        assertLoopbackServiceRequest(request);
        if (!hostBindingStore || !agentTaskService) {
          throw new StudioError('AGENT_TASK_STORE_DISABLED', 'Bound task MCP operations require the SQLite task store.');
        }
        const binding = hostBindingStore.resolve(bearerToken(request));
        const context = bindingExecutionContext(binding);
        if (!agentTaskService.hasTask(binding.projectId, binding.taskId, binding.branchId)) {
          throw new StudioError('TASK_NOT_FOUND', 'The HostBinding is not attached to a live task branch.');
        }
        const body = await readJsonBody(request, { maxBytes: 8192 });
        const submit = url.pathname === '/internal/mcp/task-submit-review';
        assertExactKeys(body, new Set(['schemaVersion', 'projectId', ...(submit ? ['reviewId'] : [])]), 'Bound task MCP request');
        if (body.schemaVersion !== 1 || body.projectId !== binding.projectId) {
          throw new StudioError('CONTEXT_PROJECT_MISMATCH', 'The requested project is outside this HostBinding.');
        }
        const result = submit
          ? await agentTaskService.submitOwnReview(body.projectId, body.reviewId, context)
          : agentTaskService.readTaskForAgent(body.projectId, context);
        sendJson(response, 200, result);
        return;
      }
      if (request.method === 'POST' && [
        '/internal/mcp/atlas-grid-proposal',
        '/internal/mcp/job-read',
        '/internal/mcp/job-cancel',
        '/internal/mcp/job-retry',
        '/internal/mcp/job-discard',
        '/internal/mcp/asset-query',
        '/internal/mcp/room-query',
      ].includes(url.pathname)) {
        assertLoopbackServiceRequest(request);
        if (!hostBindingStore) throw new StudioError('HOST_BINDING_DISABLED', 'This Studio service has no HostBinding store.');
        const token = bearerToken(request);
        const attemptSubject = agentAttemptStore?.isLive === true
          && typeof hostBindingStore.resolveAttemptSubject === 'function'
          ? hostBindingStore.resolveAttemptSubject(token)
          : hostBindingStore.resolve(token);
        const attemptContext = bindingExecutionContext(attemptSubject);
        const projectView = await studioService.readProjectTrusted(attemptSubject.projectId);
        const attemptId = `attempt.${randomUUID()}`;
        const definition = {
          '/internal/mcp/atlas-grid-proposal': { operation: 'proposeAtlasGrid', commandType: 'atlas.propose.grid', atomicAudit: false, auditAuthorized: false },
          '/internal/mcp/job-read': { operation: 'readJob', commandType: 'job.read', atomicAudit: false, auditAuthorized: false },
          '/internal/mcp/job-cancel': { operation: 'cancelJob', commandType: 'job.cancel', atomicAudit: true },
          '/internal/mcp/job-retry': { operation: 'retryJob', commandType: 'job.retry', atomicAudit: true },
          '/internal/mcp/job-discard': { operation: 'discardJob', commandType: 'job.discard', atomicAudit: true },
          '/internal/mcp/asset-query': { operation: 'queryAssets', commandType: 'asset.query', atomicAudit: false, auditAuthorized: false },
          '/internal/mcp/room-query': { operation: 'queryRooms', commandType: 'room.query', atomicAudit: false, auditAuthorized: false },
        }[url.pathname];
        const attempt = {
          attemptId,
          projectId: attemptSubject.projectId,
          correlationId: attemptContext.correlationId,
          actorId: attemptSubject.actor.id,
          taskId: safeAttemptId(attemptSubject.taskId),
          branchId: attemptSubject.branchId,
          commandId: null,
          commandType: definition.commandType,
          targetKind: 'project',
          targetId: attemptSubject.projectId,
          observedRevision: projectView.revision,
        };
        let result;
        try {
          if (agentAttemptStore?.isLive !== true) {
            throw new StudioError('AGENT_ATTEMPT_LEDGER_REQUIRED', 'Specialized MCP operations require a durable attempt ledger.');
          }
          const body = await readJsonBody(request, { maxBytes: 128 * 1024 });
          const safeJobId = definition.commandType.startsWith('job.') ? safeAttemptId(body?.jobId) : null;
          if (safeJobId) {
            attempt.targetKind = 'job';
            attempt.targetId = safeJobId;
          }
          const liveBinding = hostBindingStore.resolve(token);
          const liveContext = bindingExecutionContext(liveBinding, attemptContext.correlationId);
          if (body?.projectId !== liveBinding.projectId) {
            throw new StudioError('CONTEXT_PROJECT_MISMATCH', 'The requested project is outside this HostBinding.', {
              requestedProjectId: body?.projectId,
              contextProjectId: liveBinding.projectId,
            });
          }
          await assertExecutableBindingPolicy(studioService, liveBinding, agentTaskService);
          const taskBound = agentTaskService?.hasTask(
            liveBinding.projectId, liveBinding.taskId, liveBinding.branchId,
          ) === true;
          const targetService = taskBound && ['proposeAtlasGrid', 'queryAssets', 'queryRooms'].includes(definition.operation)
            ? agentTaskService
            : studioService;
          const authorizedAttempt = {
            ...attempt,
            projectId: liveBinding.projectId,
            correlationId: liveContext.correlationId,
            actorId: liveBinding.actor.id,
            taskId: safeAttemptId(liveBinding.taskId),
            branchId: liveBinding.branchId,
            targetId: attempt.targetKind === 'project' ? liveBinding.projectId : attempt.targetId,
          };
          result = await targetService[definition.operation](body, liveContext, {
            signal: requestAbort.signal,
            ...(definition.atomicAudit ? { authorizedAttempt } : {}),
          });
          if (definition.commandType.startsWith('job.')) result = jobHttpProjection(result);
          if (definition.operation === 'retryJob') atlasPreviewWorker?.kick();
        } catch (rawError) {
          const error = asStudioError(rawError);
          if (agentAttemptStore?.isLive === true) {
            agentAttemptStore.recordFailure({
              ...attempt,
              status: ATTEMPT_DENIAL_CODES.has(error.code) ? 'DENIED' : 'FAILED',
              errorCode: error.code,
              details: redactInternalDetails(error.details),
            });
          }
          throw error;
        }
        if (definition.auditAuthorized) {
          agentAttemptStore.recordAuthorized({
            ...attempt,
            details: typeof result?.state === 'string' ? { state: result.state } : {},
          });
        }
        sendJson(response, 200, result);
        return;
      }
      const processingAdoptionRead = processingResultAdoptionRoute(url.pathname);
      if (processingAdoptionRead) {
        if (request.method !== 'GET') {
          response.setHeader('allow', 'GET');
          sendJson(response, 405, {
            schemaVersion: 1,
            error: { code: 'METHOD_NOT_ALLOWED' },
          });
          return;
        }
        if (url.search !== '') {
          throw new StudioError(
            'PROCESSING_RESULT_ADOPTION_READ_REQUEST_INVALID',
            'Processing-result adoption reads do not accept query parameters.',
          );
        }
        if (!processingResultAdoptionReadService) {
          throw new StudioError(
            'PROCESSING_RESULT_ADOPTION_READ_UNAVAILABLE',
            'Processed asset details are unavailable for this task.',
          );
        }
        await studioService.readProjectTrusted(processingAdoptionRead.projectId);
        if (agentTaskService) {
          agentTaskService.readTask(
            processingAdoptionRead.projectId,
            processingAdoptionRead.taskId,
          );
        }
        if (processingAdoptionRead.action === 'collection') {
          sendJson(response, 200, await processingResultAdoptionReadService.readTaskAdoptions({
            schemaVersion: 1,
            projectId: processingAdoptionRead.projectId,
            taskId: processingAdoptionRead.taskId,
          }, { signal: requestAbort.signal }));
          return;
        }
        await processingResultAdoptionReadService.withSelectedOutput({
          schemaVersion: 1,
          projectId: processingAdoptionRead.projectId,
          taskId: processingAdoptionRead.taskId,
          branchRevision: processingAdoptionRead.branchRevision,
        }, async ({ mediaType, byteSize, readable }) => {
          response.writeHead(200, {
            'content-type': mediaType,
            'content-length': byteSize,
            'cache-control': 'private, max-age=31536000, immutable',
            'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
            'x-content-type-options': 'nosniff',
            ...SECURITY_RESPONSE_HEADERS,
          });
          await pipeline(readable, response, { signal: requestAbort.signal });
        }, { signal: requestAbort.signal });
        return;
      }
      const taskRequest = taskRoute(url.pathname);
      if (taskRequest && !agentTaskService) {
        throw new StudioError('AGENT_TASK_STORE_DISABLED', 'Checkpoint 4 task branches require the SQLite Studio store.');
      }
      if (request.method === 'GET' && taskRequest?.action === 'collection') {
        await studioService.readProjectTrusted(taskRequest.projectId);
        sendJson(response, 200, agentTaskService.listTasks(taskRequest.projectId));
        return;
      }
      if (request.method === 'GET' && taskRequest?.action === 'read') {
        await studioService.readProjectTrusted(taskRequest.projectId);
        sendJson(response, 200, agentTaskService.readTask(taskRequest.projectId, taskRequest.taskId));
        return;
      }
      if (request.method === 'POST' && taskRequest?.action === 'collection') {
        assertHumanUiMutation(request, humanUiCsrfToken);
        const body = await readJsonBody(request, { maxBytes: 256 * 1024 });
        assertExactKeys(body, new Set(['task']), 'Agent task creation');
        const projectView = await studioService.readProjectTrusted(taskRequest.projectId);
        sendJson(response, 201, await agentTaskService.createTask({
          projectId: taskRequest.projectId,
          task: body.task,
        }, humanOwnerContext(projectView)));
        return;
      }
      if (request.method === 'POST' && taskRequest && ['pause', 'resume', 'cancel', 'reject'].includes(taskRequest.action)) {
        assertHumanUiMutation(request, humanUiCsrfToken);
        const body = await readJsonBody(request, { maxBytes: 8192 });
        assertExactKeys(body, new Set(['reason']), `Agent task ${taskRequest.action}`);
        const projectView = await studioService.readProjectTrusted(taskRequest.projectId);
        sendJson(response, 200, await agentTaskService.control(
          taskRequest.projectId,
          taskRequest.taskId,
          taskRequest.action,
          { actorId: projectView.snapshot.project.ownerId, reason: body.reason ?? null },
        ));
        return;
      }
      if (request.method === 'POST' && taskRequest?.action === 'submit-review') {
        assertHumanUiMutation(request, humanUiCsrfToken);
        const body = await readJsonBody(request, { maxBytes: 8192 });
        assertExactKeys(body, new Set(['reviewId']), 'Agent task review submission');
        const projectView = await studioService.readProjectTrusted(taskRequest.projectId);
        sendJson(response, 200, await agentTaskService.submitReview(taskRequest.projectId, taskRequest.taskId, {
          reviewId: body.reviewId,
          actorId: projectView.snapshot.project.ownerId,
        }));
        return;
      }
      if (request.method === 'POST' && taskRequest?.action === 'decide') {
        assertHumanUiMutation(request, humanUiCsrfToken);
        const body = await readJsonBody(request, { maxBytes: 256 * 1024 });
        assertExactKeys(body, new Set(['decisions', 'confirm', 'expectedReviewVersion', 'feedbackSummary']), 'Agent task review decision');
        if (body.confirm !== true) throw new StudioError('FORBIDDEN', 'Task review decisions require explicit human confirmation.');
        const projectView = await studioService.readProjectTrusted(taskRequest.projectId);
        sendJson(response, 200, await agentTaskService.decideReview(
          taskRequest.projectId,
          taskRequest.taskId,
          taskRequest.reviewId,
          body.decisions,
          { actorId: projectView.snapshot.project.ownerId, expectedReviewVersion: body.expectedReviewVersion, feedbackSummary: body.feedbackSummary },
        ));
        return;
      }
      if (request.method === 'POST' && taskRequest?.action === 'merge') {
        assertHumanUiMutation(request, humanUiCsrfToken);
        const body = await readJsonBody(request, { maxBytes: 8192 });
        assertExactKeys(body, new Set(['mergeId', 'confirm']), 'Agent task merge');
        if (body.confirm !== true) throw new StudioError('FORBIDDEN', 'Task merge requires explicit human confirmation.');
        const projectView = await studioService.readProjectTrusted(taskRequest.projectId);
        sendJson(response, 200, await agentTaskService.mergeReview(
          taskRequest.projectId,
          taskRequest.taskId,
          taskRequest.reviewId,
          { mergeId: body.mergeId, actorId: projectView.snapshot.project.ownerId },
        ));
        return;
      }
      const taskMergeRequest = taskMergeRoute(url.pathname);
      if (taskMergeRequest && !agentTaskService) {
        throw new StudioError('AGENT_TASK_STORE_DISABLED', 'Checkpoint 4 task merges require the SQLite Studio store.');
      }
      if (request.method === 'POST' && taskMergeRequest) {
        assertHumanUiMutation(request, humanUiCsrfToken);
        const body = await readJsonBody(request, { maxBytes: 8192 });
        assertExactKeys(body, new Set(['revertId', 'confirm']), 'Agent task merge revert');
        if (body.confirm !== true) throw new StudioError('FORBIDDEN', 'Task merge revert requires explicit human confirmation.');
        const projectView = await studioService.readProjectTrusted(taskMergeRequest.projectId);
        sendJson(response, 200, await agentTaskService.revertMerge(
          taskMergeRequest.projectId,
          taskMergeRequest.mergeId,
          { revertId: body.revertId, actorId: projectView.snapshot.project.ownerId },
        ));
        return;
      }

      const assetRequest = assetRoute(url.pathname);
      if (request.method === 'GET' && assetRequest?.action === 'read') {
        const projectView = await studioService.readProjectTrusted(assetRequest.projectId);
        const result = await studioService.queryAssets(
          assetQueryDto(url, assetRequest),
          humanOwnerContext(projectView),
          { signal: requestAbort.signal },
        );
        sendJson(response, 200, assetQueryHttpProjection(result));
        return;
      }
      if (request.method === 'POST' && assetRequest?.action === 'lifecycle') {
        assertHumanUiMutation(request, humanUiCsrfToken);
        const body = await readJsonBody(request, { maxBytes: 128 * 1024 });
        assertExactKeys(body, new Set([
          'expectedRevision', 'idempotencyKey', 'expectedAssetVersion', 'expectedMetadataVersion',
          'targetLifecycle', 'acceptedWarningFindingIds', 'confirm',
        ]), 'Asset lifecycle request');
        if (body.confirm !== true) {
          throw new StudioError('FORBIDDEN', 'An asset lifecycle promotion requires explicit human confirmation.');
        }
        const projectView = await studioService.readProjectTrusted(assetRequest.projectId);
        const command = humanCommandDto(assetRequest.projectId, body, 'asset.lifecycle.set', {
          assetId: assetRequest.assetId,
          expectedAssetVersion: body.expectedAssetVersion,
          expectedMetadataVersion: body.expectedMetadataVersion,
          targetLifecycle: body.targetLifecycle,
          acceptedWarningFindingIds: body.acceptedWarningFindingIds,
        });
        sendJson(response, 200, await studioService.execute(
          command,
          humanOwnerContext(projectView),
          { signal: requestAbort.signal },
        ));
        return;
      }
      const assetProposalRequest = assetProposalRoute(url.pathname);
      if (request.method === 'POST' && assetProposalRequest) {
        assertHumanUiMutation(request, humanUiCsrfToken);
        const body = await readJsonBody(request, { maxBytes: 1024 * 1024 });
        const projectView = await studioService.readProjectTrusted(assetProposalRequest.projectId);
        let command;
        if (assetProposalRequest.action === 'submit') {
          assertExactKeys(body, new Set([
            'expectedRevision', 'idempotencyKey', 'proposalId', 'items',
          ]), 'Asset proposal submission');
          command = humanCommandDto(assetProposalRequest.projectId, body, 'asset.proposal.submit', {
            proposalId: body.proposalId,
            expectedRevision: body.expectedRevision,
            items: body.items,
          });
        } else if (assetProposalRequest.action === 'decision') {
          assertExactKeys(body, new Set([
            'expectedRevision', 'idempotencyKey', 'expectedProposalVersion', 'decisions', 'confirm',
          ]), 'Asset proposal decision');
          if (body.confirm !== true) {
            throw new StudioError('FORBIDDEN', 'An asset proposal decision requires explicit human confirmation.');
          }
          command = humanCommandDto(assetProposalRequest.projectId, body, 'asset.proposal.decide', {
            proposalId: assetProposalRequest.proposalId,
            expectedProposalVersion: body.expectedProposalVersion,
            decisions: body.decisions,
          });
        } else {
          assertExactKeys(body, new Set([
            'expectedRevision', 'idempotencyKey', 'expectedProposalVersion', 'confirm',
          ]), 'Asset proposal apply');
          if (body.confirm !== true) {
            throw new StudioError('FORBIDDEN', 'Applying an asset proposal requires explicit human confirmation.');
          }
          command = humanCommandDto(assetProposalRequest.projectId, body, 'asset.proposal.apply', {
            proposalId: assetProposalRequest.proposalId,
            expectedProposalVersion: body.expectedProposalVersion,
          });
        }
        sendJson(response, 200, await studioService.execute(
          command,
          humanOwnerContext(projectView),
          { signal: requestAbort.signal },
        ));
        return;
      }
      const roomArchetypeRequest = roomArchetypeRoute(url.pathname);
      if (request.method === 'POST' && roomArchetypeRequest) {
        assertHumanUiMutation(request, humanUiCsrfToken);
        const body = await readJsonBody(request, { maxBytes: 256 * 1024 });
        assertExactKeys(body, new Set([
          'expectedRevision', 'idempotencyKey', 'roomArchetypeId', 'kind', 'displayName',
          'tags', 'dimensionPolicy', 'structuralBands', 'orientation', 'connectorPolicy',
          'allowedAssetKinds', 'allowedTags', 'requiredTags', 'rationality', 'governingRuleRefs',
        ]), 'Room archetype creation');
        const { expectedRevision: _expectedRevision, idempotencyKey: _idempotencyKey, ...payload } = body;
        const projectView = await studioService.readProjectTrusted(roomArchetypeRequest.projectId);
        sendJson(response, 200, await studioService.execute(
          humanCommandDto(roomArchetypeRequest.projectId, body, 'room.archetype.create', payload),
          humanOwnerContext(projectView),
          { signal: requestAbort.signal },
        ));
        return;
      }
      const roomPreviewSceneRequest = roomPreviewSceneRoute(url.pathname);
      if (roomPreviewSceneRequest) {
        if (request.method !== 'GET') {
          response.setHeader('allow', 'GET');
          sendJson(response, 405, {
            schemaVersion: 1,
            error: { code: 'METHOD_NOT_ALLOWED' },
          });
          return;
        }
        if (url.search !== '') {
          throw new StudioError('VALIDATION_ERROR', 'Room preview scene reads do not accept query parameters.');
        }
        const projectView = await studioService.readProjectTrusted(roomPreviewSceneRequest.projectId);
        const source = await studioService.queryRoomPreviewSource({
          schemaVersion: 1,
          ...roomPreviewSceneRequest,
        }, humanOwnerContext(projectView), { signal: requestAbort.signal });
        sendJson(response, 200, roomPreviewSceneHttpProjection(createRoomPreviewScene(source)));
        return;
      }
      const roomRequest = roomRoute(url.pathname);
      if (request.method === 'GET' && roomRequest && ['read', 'collection'].includes(roomRequest.action)) {
        const projectView = await studioService.readProjectTrusted(roomRequest.projectId);
        sendJson(response, 200, await studioService.queryRooms(
          roomQueryDto(url, roomRequest),
          humanOwnerContext(projectView),
          { signal: requestAbort.signal },
        ));
        return;
      }
      if (request.method === 'POST' && roomRequest?.action === 'collection') {
        assertHumanUiMutation(request, humanUiCsrfToken);
        const body = await readJsonBody(request, { maxBytes: 1024 * 1024 });
        assertExactKeys(body, new Set([
          'expectedRevision', 'idempotencyKey', 'roomVariantId', 'roomArchetypeId',
          'archetypeVersion', 'displayName', 'width', 'height', 'intentTrace',
          'connectors', 'placements',
        ]), 'Room variant creation');
        const { expectedRevision: _expectedRevision, idempotencyKey: _idempotencyKey, ...payload } = body;
        const projectView = await studioService.readProjectTrusted(roomRequest.projectId);
        sendJson(response, 200, await studioService.execute(
          humanCommandDto(roomRequest.projectId, body, 'room.variant.create', payload),
          humanOwnerContext(projectView),
          { signal: requestAbort.signal },
        ));
        return;
      }
      if (request.method === 'POST' && roomRequest && !['read', 'collection'].includes(roomRequest.action)) {
        assertHumanUiMutation(request, humanUiCsrfToken);
        const body = await readJsonBody(request, { maxBytes: 1024 * 1024 });
        const actionContract = {
          intent: { type: 'room.variant.intent.set', keys: ['expectedRevision', 'idempotencyKey', 'expectedRoomVariantVersion', 'intentTrace'] },
          shape: { type: 'room.variant.shape.set', keys: ['expectedRevision', 'idempotencyKey', 'expectedRoomVariantVersion', 'voidCells', 'blockedCells'] },
          resize: { type: 'room.variant.resize', keys: ['expectedRevision', 'idempotencyKey', 'expectedRoomVariantVersion', 'width', 'height', 'removePlacementIds', 'removeConnectorIds'] },
          connectors: { type: 'room.variant.connectors.set', keys: ['expectedRevision', 'idempotencyKey', 'expectedRoomVariantVersion', 'connectors'] },
          'placements-add': { type: 'room.variant.placements.add', keys: ['expectedRevision', 'idempotencyKey', 'expectedRoomVariantVersion', 'placements'] },
          'placements-move': { type: 'room.variant.placements.move', keys: ['expectedRevision', 'idempotencyKey', 'expectedRoomVariantVersion', 'moves'] },
          'placements-remove': { type: 'room.variant.placements.remove', keys: ['expectedRevision', 'idempotencyKey', 'expectedRoomVariantVersion', 'placements'] },
          'warning-dispositions': { type: 'room.variant.warning.disposition.set', keys: ['expectedRevision', 'idempotencyKey', 'expectedRoomVariantVersion', 'acceptedWarningFindingIds'] },
          validate: { type: 'room.variant.validate', keys: ['expectedRevision', 'idempotencyKey', 'expectedRoomVariantVersion', 'confirm'], confirm: true },
          finalize: { type: 'room.variant.finalize', keys: ['expectedRevision', 'idempotencyKey', 'expectedRoomVariantVersion', 'confirm'], confirm: true },
          fork: { type: 'room.variant.fork', keys: ['expectedRevision', 'idempotencyKey', 'expectedRoomVariantVersion', 'confirm'], confirm: true },
        }[roomRequest.action];
        assertExactKeys(body, new Set(actionContract.keys), `Room ${roomRequest.action} request`);
        if (actionContract.confirm && body.confirm !== true) throw new StudioError('FORBIDDEN', `Room ${roomRequest.action} requires explicit human confirmation.`);
        const payload = { roomVariantId: roomRequest.roomVariantId, expectedRoomVariantVersion: body.expectedRoomVariantVersion };
        for (const key of actionContract.keys) {
          if (!['expectedRevision', 'idempotencyKey', 'expectedRoomVariantVersion', 'confirm'].includes(key)) payload[key] = body[key];
        }
        const projectView = await studioService.readProjectTrusted(roomRequest.projectId);
        sendJson(response, 200, await studioService.execute(
          humanCommandDto(roomRequest.projectId, body, actionContract.type, payload),
          humanOwnerContext(projectView),
          { signal: requestAbort.signal },
        ));
        return;
      }
      const roomProposalRequest = roomProposalRoute(url.pathname);
      if (request.method === 'POST' && roomProposalRequest) {
        assertHumanUiMutation(request, humanUiCsrfToken);
        const body = await readJsonBody(request, { maxBytes: 1024 * 1024 });
        const projectView = await studioService.readProjectTrusted(roomProposalRequest.projectId);
        let commandValue;
        if (roomProposalRequest.action === 'submit') {
          assertExactKeys(body, new Set(['expectedRevision', 'idempotencyKey', 'proposalId', 'roomVariantId', 'expectedRoomVariantVersion', 'items']), 'Room proposal submission');
          commandValue = humanCommandDto(roomProposalRequest.projectId, body, 'room.placement.proposal.submit', {
            proposalId: body.proposalId, roomVariantId: body.roomVariantId,
            expectedRoomVariantVersion: body.expectedRoomVariantVersion, items: body.items,
          });
        } else if (roomProposalRequest.action === 'decision') {
          assertExactKeys(body, new Set(['expectedRevision', 'idempotencyKey', 'expectedProposalVersion', 'decisions', 'confirm']), 'Room proposal decision');
          if (body.confirm !== true) throw new StudioError('FORBIDDEN', 'A room proposal decision requires explicit human confirmation.');
          commandValue = humanCommandDto(roomProposalRequest.projectId, body, 'room.placement.proposal.decide', {
            proposalId: roomProposalRequest.proposalId, expectedProposalVersion: body.expectedProposalVersion, decisions: body.decisions,
          });
        } else {
          assertExactKeys(body, new Set(['expectedRevision', 'idempotencyKey', 'expectedProposalVersion', 'confirm']), 'Room proposal apply');
          if (body.confirm !== true) throw new StudioError('FORBIDDEN', 'Applying a room proposal requires explicit human confirmation.');
          commandValue = humanCommandDto(roomProposalRequest.projectId, body, 'room.placement.proposal.apply', {
            proposalId: roomProposalRequest.proposalId, expectedProposalVersion: body.expectedProposalVersion,
          });
        }
        sendJson(response, 200, await studioService.execute(commandValue, humanOwnerContext(projectView), { signal: requestAbort.signal }));
        return;
      }
      const atlasRequest = atlasRoute(url.pathname);
      if (request.method === 'POST' && atlasRequest) {
        assertHumanUiMutation(request, humanUiCsrfToken);
        const body = await readJsonBody(request, { maxBytes: 1024 * 1024 });
        const projectView = await studioService.readProjectTrusted(atlasRequest.projectId);
        const context = humanOwnerContext(projectView);
        if (atlasRequest.action === 'grid-proposal') {
          assertExactKeys(body, new Set([
            'expectedRevision', 'sourceId', 'rows', 'columns', 'margins', 'gapX', 'gapY', 'rectangleIdPrefix',
          ]), 'Atlas grid proposal');
          sendJson(response, 200, await studioService.proposeAtlasGrid({
            schemaVersion: 1,
            projectId: atlasRequest.projectId,
            ...body,
          }, context, { signal: requestAbort.signal }));
          return;
        }
        if (atlasRequest.action === 'definition') {
          assertExactKeys(body, new Set([
            'expectedRevision', 'idempotencyKey', 'sourceId', 'name', 'expectedAtlasVersion', 'rectangles',
          ]), 'Atlas definition request');
          const command = humanCommandDto(atlasRequest.projectId, body, 'atlas.define.rects', {
            atlasId: atlasRequest.atlasId,
            sourceId: body.sourceId,
            name: body.name,
            expectedAtlasVersion: body.expectedAtlasVersion,
            rectangles: body.rectangles,
          });
          sendJson(response, 200, await studioService.execute(command, context, { signal: requestAbort.signal }));
          return;
        }
        assertExactKeys(body, new Set([
          'expectedRevision', 'idempotencyKey', 'expectedAtlasVersion', 'expectedDefinitionFingerprint', 'jobId',
        ]), `Atlas ${atlasRequest.action} request`);
        const type = atlasRequest.action === 'preview' ? 'atlas.preview.slices' : 'atlas.commit.slices';
        const command = humanCommandDto(atlasRequest.projectId, body, type, {
          atlasId: atlasRequest.atlasId,
          expectedAtlasVersion: body.expectedAtlasVersion,
          expectedDefinitionFingerprint: body.expectedDefinitionFingerprint,
          jobId: body.jobId,
        });
        const result = await studioService.execute(command, context, { signal: requestAbort.signal });
        if (atlasRequest.action === 'preview') atlasPreviewWorker?.kick();
        sendJson(response, 200, result);
        return;
      }
      const jobRequest = jobRoute(url.pathname);
      if (request.method === 'GET' && jobRequest?.action === 'read') {
        const projectView = await studioService.readProjectTrusted(jobRequest.projectId);
        sendJson(response, 200, jobHttpProjection(await studioService.readJob({
          schemaVersion: 1,
          projectId: jobRequest.projectId,
          jobId: jobRequest.jobId,
        }, humanOwnerContext(projectView), { signal: requestAbort.signal })));
        return;
      }
      if (request.method === 'POST' && jobRequest && ['cancel', 'retry', 'discard'].includes(jobRequest.action)) {
        assertHumanUiMutation(request, humanUiCsrfToken);
        const body = await readJsonBody(request, { maxBytes: 4096 });
        assertExactKeys(body, new Set([
          'operationIdempotencyKey', ...(jobRequest.action === 'retry' ? ['expectedAttempt'] : []),
        ]), `Job ${jobRequest.action} request`);
        const projectView = await studioService.readProjectTrusted(jobRequest.projectId);
        const method = jobRequest.action === 'retry'
          ? 'retryJob'
          : (jobRequest.action === 'discard' ? 'discardJob' : 'cancelJob');
        const result = await studioService[method]({
          schemaVersion: 1,
          projectId: jobRequest.projectId,
          jobId: jobRequest.jobId,
          ...body,
        }, humanOwnerContext(projectView), { signal: requestAbort.signal });
        if (jobRequest.action === 'retry') atlasPreviewWorker?.kick();
        sendJson(response, 200, result);
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
            studioService.durableAssetStoreReady, studioService.durableRoomStoreReady,
            agentTaskService?.listTasks(project.projectId).tasks.some(({ state }) => (
              ['ACTIVE', 'PAUSED', 'IN_REVIEW', 'CHANGES_REQUESTED'].includes(state)
            )) === true,
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
      if (response.headersSent) {
        if (!response.destroyed) response.destroy(rawError);
        return;
      }
      const error = asStudioError(rawError);
      const projected = url.pathname.startsWith('/api/backups')
        ? { code: error.code, message: error.message }
        : url.pathname.startsWith('/internal/mcp/')
        ? internalMcpErrorProjection(error)
        : url.pathname.includes('/processing-result-adoptions')
          ? { code: error.code, message: error.message }
          : { code: error.code, message: error.message, details: error.details };
      sendJson(response, errorStatus(error, url.pathname), {
        schemaVersion: 1,
        error: projected,
      });
    }
  });
  return server;
}

export async function startStudioHttpServer({
  dataDirectory = resolve(process.env.NUMBERDROID_STUDIO_DATA ?? '.numberdroid-studio'),
  host = process.env.NUMBERDROID_STUDIO_HOST ?? '127.0.0.1',
  port = Number(process.env.NUMBERDROID_STUDIO_PORT ?? 4317),
  storeMode = process.env.NUMBERDROID_STUDIO_STORE ?? 'sqlite',
  clock = () => new Date().toISOString(),
  authoringV2CapabilityProvider = null,
  agentTaskGrantScopes = undefined,
  pairingEnabled = true,
  operationsConfigurationFilename = process.env.NUMBERDROID_STUDIO_OPERATIONS_CONFIG ?? null,
  operationsConfigurationValue = null,
  operationsStartupPolicy = 'optional',
  operationsBootstrapSecret = null,
  operationsBootstrapWriter = writeWorkspaceOperatorBootstrapSecret,
  operationsSessionClock = Date.now,
} = {}) {
  if (!['sqlite', 'json'].includes(storeMode)) throw new TypeError('storeMode must be sqlite or json.');
  if (typeof pairingEnabled !== 'boolean') throw new TypeError('pairingEnabled must be a boolean.');
  if (!['optional', 'required'].includes(operationsStartupPolicy)) {
    throw new TypeError('operationsStartupPolicy must be optional or required.');
  }
  if (operationsConfigurationFilename !== null && operationsConfigurationValue !== null) {
    throw new TypeError('Provide operations configuration by filename or value, not both.');
  }
  // Trusted programmatic composition only. The private admission service still
  // pins every positive response to the exact Numberdroid Authoring-v2 manifest.
  if (authoringV2CapabilityProvider !== null
    && typeof authoringV2CapabilityProvider?.getProjectCapabilityManifest !== 'function') {
    throw new TypeError('authoringV2CapabilityProvider must expose getProjectCapabilityManifest().');
  }
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new StudioError(
      'LOOPBACK_HOST_REQUIRED',
      'Checkpoint 1B is a local single-user service and may listen only on loopback.',
      { host },
    );
  }
  const resolvedDataDirectory = resolve(dataDirectory);
  let operationsConfiguration = null;
  if (operationsStartupPolicy === 'required'
    && (storeMode !== 'sqlite'
      || (operationsConfigurationFilename === null && operationsConfigurationValue === null))) {
    throw new StudioError(
      'OPERATIONS_UNAVAILABLE',
      'This Studio composition requires a valid SQLite operations control plane.',
    );
  }
  if (storeMode === 'sqlite') {
    assertWorkspaceNotQuarantined(resolvedDataDirectory);
    if (operationsConfigurationFilename !== null || operationsConfigurationValue !== null) {
      operationsConfiguration = operationsConfigurationValue
        ?? await readOperationsConfigurationFile(operationsConfigurationFilename);
      await validateOperationsConfiguration(operationsConfiguration, {
        liveWorkspaceRoot: resolvedDataDirectory,
      });
    }
  }
  const store = storeMode === 'sqlite'
    ? await SqliteProjectStore.open({ filename: resolve(resolvedDataDirectory, 'studio.sqlite') })
    : new JsonProjectStore({ directory: dataDirectory });
  let backupOperationsController = null;
  let pairing = null;
  let privateAuthoringV2Runtime = null;
  let atlasPreviewWorker = null;
  let server = null;
  let closeComposedHttpServer = null;
  try {
  const jobStore = storeMode === 'sqlite'
    ? new SqliteJobStore({ workspace: store.workspace })
    : null;
  const capabilityProvider = new FixedProjectCapabilityProvider({
    manifest: NUMBERDROID_PROJECT_CAPABILITY_MANIFEST,
  });
  const studioService = new StudioService({
    store,
    clock,
    agentAttemptAuditReady: storeMode === 'sqlite',
    jobStore,
    capabilityProvider,
    grantScopes: agentTaskGrantScopes,
  });
  const hostBindingStore = storeMode === 'sqlite'
    ? new SqliteHostBindingStore({ workspace: store.workspace, clock })
    : null;
  const pairingBroker = storeMode === 'sqlite' && pairingEnabled ? new McpPairingBroker() : null;
  const requestedPairingEndpoint = pairingBroker ? defaultMcpPairingEndpoint(dataDirectory) : null;
  const artifactStore = storeMode === 'sqlite'
    ? new ContentAddressedArtifactStore({ rootDirectory: resolve(resolvedDataDirectory, 'artifacts') })
    : null;
  await artifactStore?.initialize();
  if (operationsConfiguration !== null) {
    let backupOperationsRuntime = null;
    try {
      backupOperationsRuntime = await BackupOperationsRuntime.open({
        configuration: operationsConfiguration,
        liveWorkspaceRoot: resolvedDataDirectory,
        projectStore: store,
        artifactStore,
        clock,
      });
      const bootstrapSecret = operationsBootstrapSecret
        ?? generateWorkspaceOperatorBootstrapSecret();
      if (operationsBootstrapSecret === null) {
        await operationsBootstrapWriter(bootstrapSecret);
      }
      backupOperationsController = new BackupOperationsController({
        runtime: backupOperationsRuntime,
        bootstrapSecret,
        clock: operationsSessionClock,
      });
    } catch (error) {
      await backupOperationsRuntime?.close().catch(() => {});
      backupOperationsController = null;
      if (operationsStartupPolicy === 'required') throw error;
    }
  }
  pairing = pairingBroker
    ? await startMcpPairingSocket({ broker: pairingBroker, endpoint: requestedPairingEndpoint })
    : null;
  const pairingServer = pairing?.server ?? null;
  const pairingEndpoint = pairing?.endpoint ?? null;
  const privateAuthoringV2CapabilityProvider = storeMode === 'sqlite'
    ? (authoringV2CapabilityProvider ?? new FixedProjectCapabilityProvider({
      manifest: NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST,
    }))
    : null;
  privateAuthoringV2Runtime = storeMode === 'sqlite'
    ? createPrivateAuthoringV2Runtime({
      workspace: store.workspace,
      artifactStore,
      hostBindingStore,
      capabilityProvider: privateAuthoringV2CapabilityProvider,
      clock,
    })
    : null;
  const artifactMetadataStore = storeMode === 'sqlite'
    ? new SqliteArtifactMetadataStore({ workspace: store.workspace })
    : null;
  const processingResultAdoptionReadService = storeMode === 'sqlite'
    ? new ProcessingResultAdoptionReadService({
      reader: new SqliteProcessingResultAdoptionReader({
        workspace: store.workspace,
        artifactStore,
      }).asReader(),
    })
    : null;
  const sourceIntakeStore = storeMode === 'sqlite'
    ? new SqliteSourceIntakeStore({ workspace: store.workspace })
    : null;
  const agentAttemptStore = storeMode === 'sqlite'
    ? new SqliteAgentAttemptStore({ workspace: store.workspace })
    : null;
  const agentTaskStore = storeMode === 'sqlite'
    ? new SqliteAgentTaskStore({ workspace: store.workspace })
    : null;
  const derivedChildTaskService = storeMode === 'sqlite'
    ? new DerivedChildTaskService({
      store: new SqliteDerivedChildTaskStore({ workspace: store.workspace }),
      clock,
    })
    : null;
  const agentTaskService = storeMode === 'sqlite'
    ? new AgentTaskService({
      studioService,
      projectStore: store,
      taskStore: agentTaskStore,
      createBranchStore: ({ projectId, taskId }) => new TaskBranchProjectStore({
        taskStore: agentTaskStore,
        projectId,
        taskId,
      }),
      clock,
      capabilityProvider,
      grantScopes: agentTaskGrantScopes,
      derivedChildService: derivedChildTaskService,
    })
    : null;
  atlasPreviewWorker = storeMode === 'sqlite'
    ? new AtlasPreviewWorker({ jobStore, artifactStore, artifactMetadataStore, clock })
    : null;
  server = createStudioHttpServer({
    studioService,
    agentTaskService,
    processingResultAdoptionReadService,
    hostBindingStore,
    pairingBroker,
    pairingEndpoint,
    artifactStore,
    artifactMetadataStore,
    sourceIntakeStore,
    agentAttemptStore,
    jobStore,
    atlasPreviewWorker,
    backupOperationsController,
  });
  if (privateAuthoringV2Runtime !== null) {
    privateAuthoringV2RuntimeByServer.set(server, privateAuthoringV2Runtime);
  }
  const closeHttpServer = server.close.bind(server);
  closeComposedHttpServer = closeHttpServer;
  let shutdownPromise = null;
  server.close = (callback) => {
    if (!shutdownPromise) {
      shutdownPromise = Promise.allSettled([
        Promise.resolve().then(() => atlasPreviewWorker?.stop()),
        Promise.resolve().then(() => privateAuthoringV2Runtime?.close()),
        Promise.resolve().then(() => backupOperationsController?.close()),
        new Promise((resolveClose, rejectClose) => {
          closeHttpServer((error) => (error ? rejectClose(error) : resolveClose()));
        }),
        Promise.resolve().then(() => pairing?.close()),
      ]).then((results) => {
        privateAuthoringV2RuntimeByServer.delete(server);
        let storeFailure = null;
        try { if (typeof store.close === 'function') store.close(); } catch (error) { storeFailure = error; }
        const stopFailure = results.find(({ status }) => status === 'rejected');
        if (stopFailure) throw stopFailure.reason;
        if (storeFailure) throw storeFailure;
      });
    }
    if (typeof callback === 'function') {
      shutdownPromise.then(() => callback()).catch((error) => callback(error));
    }
    return server;
  };
  await new Promise((resolveListen, reject) => {
    const rejectListen = (error) => reject(error);
    server.once('error', rejectListen);
    server.listen(port, host, () => {
      server.off('error', rejectListen);
      resolveListen();
    });
  });
  backupOperationsController?.start();
  atlasPreviewWorker?.start();
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
    agentTaskStore,
    agentTaskService,
    jobStore,
    atlasPreviewWorker,
    address: server.address(),
    dataDirectory,
    storeMode,
  };
  } catch (error) {
    const httpStopped = server?.listening && closeComposedHttpServer
      ? new Promise((resolveClose) => closeComposedHttpServer(() => resolveClose()))
      : Promise.resolve();
    await Promise.allSettled([
      atlasPreviewWorker?.stop() ?? Promise.resolve(),
      privateAuthoringV2Runtime?.close() ?? Promise.resolve(),
      backupOperationsController?.close() ?? Promise.resolve(),
      pairing?.close() ?? Promise.resolve(),
      httpStopped,
    ]);
    if (server !== null) privateAuthoringV2RuntimeByServer.delete(server);
    try { if (typeof store.close === 'function') store.close(); } catch {}
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const running = await startStudioHttpServer();
  const address = running.address;
  process.stdout.write(`Numberdroid Studio: http://${address.address}:${address.port}\n`);
  process.stdout.write(`Storage mode: ${running.storeMode}\n`);
  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    running.server.close((error) => {
      if (error) {
        process.stderr.write('Numberdroid Studio shutdown failed.\n');
        process.exitCode = 1;
      }
      if (process.connected) {
        process.send?.({ type: 'numberdroid-studio-launcher-stopped', schemaVersion: 1, ok: !error }, () => {
          if (process.connected) process.disconnect();
        });
      }
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  // Private parent-child IPC only; no HTTP, browser, MCP, or operator surface.
  if (process.send) {
    process.on('message', (message) => {
      if (message?.type === 'numberdroid-studio-launcher-stop' && message.schemaVersion === 1
          && Object.keys(message).length === 2) shutdown();
    });
    process.once('disconnect', shutdown);
  }
}
