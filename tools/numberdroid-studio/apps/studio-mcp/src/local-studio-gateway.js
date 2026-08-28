import { listCommandDefinitions } from '../../../packages/domain/src/index.js';
import { StudioError } from '../../../packages/domain/src/index.js';
import {
  validateAuthoringV2Capabilities,
  validateAuthoringV2SurfaceNegotiation,
  validateAuthoringV2SurfaceNegotiationRequest,
} from '../../../packages/application/src/index.js';

function privateLoopbackBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new StudioError(
      'STUDIO_SERVICE_URL_INVALID',
      'The local Studio service URL is invalid.',
    );
  }
  const hostname = url.hostname.toLowerCase();
  const ipv4 = hostname.split('.');
  const loopback = hostname === 'localhost'
    || hostname === '[::1]'
    || (ipv4.length === 4
      && ipv4.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
      && Number(ipv4[0]) === 127);
  if (
    url.protocol !== 'http:'
      || !loopback
      || url.username !== ''
      || url.password !== ''
  ) {
    throw new StudioError(
      'STUDIO_SERVICE_URL_INVALID',
      'The local Studio service URL must be an uncredentialed loopback HTTP origin.',
    );
  }
  return url;
}

function abortReason(signal) {
  return signal?.reason instanceof Error
    ? signal.reason
    : new DOMException('The operation was aborted.', 'AbortError');
}

function redactedRemoteDetails(value, bindingToken) {
  if (typeof value === 'string') {
    return bindingToken && value.includes(bindingToken) ? '[REDACTED]' : value;
  }
  if (Array.isArray(value)) return value.map((entry) => redactedRemoteDetails(entry, bindingToken));
  if (!value || typeof value !== 'object') return value;
  const sensitiveKeys = new Set([
    'authorization', 'bindingid', 'bindingtoken', 'cause', 'directory', 'endpoint',
    'filename', 'grantid', 'path', 'socket', 'token',
  ]);
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !sensitiveKeys.has(key.toLowerCase())
      && !/(?:secret|password|credential|privatekey|token)/i.test(key))
    .map(([key, entry]) => [key, redactedRemoteDetails(entry, bindingToken)]));
}

export class LocalStudioGateway {
  #baseUrl;
  #bindingTokenPromise;
  #agentAttemptAuditReady;
  #durableJobStoreReady;
  #durableAssetStoreReady;
  #durableRoomStoreReady;
  #taskBranchReady;

  #authoringV2Negotiation = null;

  constructor({
    baseUrl,
    bindingToken,
    bindingTokenProvider = null,
    agentAttemptAuditReady = false,
    durableJobStoreReady = false,
    durableAssetStoreReady = false,
    durableRoomStoreReady = false,
    taskBranchReady = false,
  }) {
    this.#baseUrl = privateLoopbackBaseUrl(baseUrl);
    if (!bindingToken && typeof bindingTokenProvider !== 'function') {
      throw new StudioError('HOST_BINDING_REQUIRED', 'A HostBinding token or private pairing provider is required.');
    }
    this.#bindingTokenPromise = bindingToken
      ? Promise.resolve(bindingToken)
      : Promise.resolve().then(bindingTokenProvider);
    this.#agentAttemptAuditReady = agentAttemptAuditReady === true;
    this.#durableJobStoreReady = durableJobStoreReady === true;
    this.#durableAssetStoreReady = durableAssetStoreReady === true;
    this.#durableRoomStoreReady = durableRoomStoreReady === true;
    this.#taskBranchReady = taskBranchReady === true;
  }

  get commandCatalog() {
    return listCommandDefinitions();
  }

  get agentAttemptAuditReady() {
    return this.#agentAttemptAuditReady;
  }

  get durableJobStoreReady() {
    return this.#durableJobStoreReady;
  }

  get durableAssetStoreReady() {
    return this.#durableAssetStoreReady;
  }

  get durableRoomStoreReady() {
    return this.#durableRoomStoreReady;
  }

  get taskBranchReady() { return this.#taskBranchReady; }

  async #bindingToken({ signal } = {}) {
    if (!signal) return this.#bindingTokenPromise;
    if (signal.aborted) throw abortReason(signal);
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        signal.removeEventListener('abort', onAbort);
        reject(abortReason(signal));
      };
      signal.addEventListener('abort', onAbort, { once: true });
      this.#bindingTokenPromise.then(
        (token) => {
          signal.removeEventListener('abort', onAbort);
          resolve(token);
        },
        (error) => {
          signal.removeEventListener('abort', onAbort);
          reject(error);
        },
      );
    });
  }

  async #request(path, value, { signal } = {}) {
    const bindingToken = await this.#bindingToken({ signal });
    if (typeof bindingToken !== 'string' || bindingToken.length === 0 || /[\u0000-\u0020\u007f]/.test(bindingToken)) {
      throw new StudioError('HOST_BINDING_INVALID', 'The private HostBinding credential is invalid.');
    }
    let response;
    try {
      response = await fetch(new URL(path, this.#baseUrl), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${bindingToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(value),
        redirect: 'error',
        signal,
      });
    } catch (error) {
      if (signal?.aborted || error?.name === 'AbortError') throw error;
      throw new StudioError(
        'STUDIO_SERVICE_UNAVAILABLE',
        'The local Studio service is unavailable.',
      );
    }
    let body;
    try {
      body = await response.json();
    } catch {
      throw new StudioError(
        'STUDIO_SERVICE_PROTOCOL_ERROR',
        'The local Studio service returned an invalid response.',
      );
    }
    if (!body || Array.isArray(body) || typeof body !== 'object') {
      throw new StudioError(
        'STUDIO_SERVICE_PROTOCOL_ERROR',
        'The local Studio service returned an invalid response.',
      );
    }
    if (!response.ok) {
      const code = typeof body.error?.code === 'string' && /^[A-Z][A-Z0-9_]*$/.test(body.error.code)
        ? body.error.code
        : 'STUDIO_SERVICE_ERROR';
      const internal = code === 'INTERNAL_ERROR';
      const remoteMessage = body.error?.message ?? 'Studio service request failed.';
      const message = internal
        ? 'Unexpected Studio error.'
        : typeof remoteMessage === 'string' && !remoteMessage.includes(bindingToken)
          ? remoteMessage
          : 'Studio service request failed.';
      throw new StudioError(
        code,
        message,
        internal ? {} : redactedRemoteDetails(body.error?.details ?? {}, bindingToken),
      );
    }
    return body;
  }

  async execute(commandDto, _opaqueHostContext, options = {}) {
    return this.#request('/internal/mcp/execute', { schemaVersion: 1, command: commandDto }, options);
  }

  async negotiateAuthoringV2(request, options = {}) {
    const validatedRequest = validateAuthoringV2SurfaceNegotiationRequest(request);
    const negotiation = validateAuthoringV2SurfaceNegotiation(
      await this.#request('/internal/mcp/authoring-v2/handshake', validatedRequest, options),
      {
        projectId: validatedRequest.projectId,
        expectedProfileFingerprint: validatedRequest.expectedProfileFingerprint,
      },
    );
    this.#authoringV2Negotiation = negotiation;
    return negotiation;
  }

  async readAuthoringV2Capabilities(request, _opaqueHostContext, options = {}) {
    if (this.#authoringV2Negotiation === null) {
      throw new StudioError(
        'AUTHORING_V2_NEGOTIATION_REQUIRED',
        'Authoring v2 requires a positive private service negotiation.',
      );
    }
    if (request?.projectId !== this.#authoringV2Negotiation.projectId) {
      throw new StudioError(
        'CONTEXT_PROJECT_MISMATCH',
        'The requested project does not match the negotiated Authoring-v2 project.',
      );
    }
    return validateAuthoringV2Capabilities(
      await this.#request('/internal/mcp/authoring-v2/capabilities', request, options),
      {
        projectId: this.#authoringV2Negotiation.projectId,
        expectedProfileFingerprint: this.#authoringV2Negotiation.profile.fingerprint,
      },
    );
  }

  async adoptProcessingResult(request, _opaqueHostContext, options = {}) {
    if (this.#authoringV2Negotiation === null) {
      throw new StudioError(
        'AUTHORING_V2_NEGOTIATION_REQUIRED',
        'Authoring v2 requires a positive private service negotiation.',
      );
    }
    if (request?.command?.projectId !== this.#authoringV2Negotiation.projectId) {
      throw new StudioError(
        'CONTEXT_PROJECT_MISMATCH',
        'The requested project does not match the negotiated Authoring-v2 project.',
      );
    }
    return this.#request('/internal/mcp/authoring-v2/processing-result-adopt', request, options);
  }

  async readProject({ projectId }, _opaqueHostContext, options = {}) {
    return this.#request('/internal/mcp/read-project', { schemaVersion: 1, projectId }, options);
  }


  async proposeAtlasGrid(request, _opaqueHostContext, options = {}) {
    return this.#request('/internal/mcp/atlas-grid-proposal', request, options);
  }

  async readJob(request, _opaqueHostContext, options = {}) {
    return this.#request('/internal/mcp/job-read', request, options);
  }

  async queryAssets(request, _opaqueHostContext, options = {}) {
    return this.#request('/internal/mcp/asset-query', request, options);
  }

  async queryRooms(request, _opaqueHostContext, options = {}) {
    return this.#request('/internal/mcp/room-query', request, options);
  }

  async readTask(request, _opaqueHostContext, options = {}) {
    return this.#request('/internal/mcp/task-read', request, options);
  }

  async submitTaskForReview(request, _opaqueHostContext, options = {}) {
    return this.#request('/internal/mcp/task-submit-review', request, options);
  }

  async cancelJob(request, _opaqueHostContext, options = {}) {
    return this.#request('/internal/mcp/job-cancel', request, options);
  }

  async retryJob(request, _opaqueHostContext, options = {}) {
    return this.#request('/internal/mcp/job-retry', request, options);
  }

  async discardJob(request, _opaqueHostContext, options = {}) {
    return this.#request('/internal/mcp/job-discard', request, options);
  }
}
