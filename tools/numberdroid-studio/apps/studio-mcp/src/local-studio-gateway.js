import { listCommandDefinitions } from '../../../packages/domain/src/index.js';
import { StudioError } from '../../../packages/domain/src/index.js';

function redactedRemoteDetails(value) {
  if (Array.isArray(value)) return value.map(redactedRemoteDetails);
  if (!value || typeof value !== 'object') return value;
  const sensitiveKeys = new Set([
    'authorization', 'bindingId', 'bindingToken', 'cause', 'directory', 'endpoint',
    'filename', 'grantId', 'path', 'socket', 'token',
  ]);
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !sensitiveKeys.has(key)
      && !/(?:secret|password|credential|privatekey)/i.test(key))
    .map(([key, entry]) => [key, redactedRemoteDetails(entry)]));
}

export class LocalStudioGateway {
  #baseUrl;
  #bindingTokenPromise;
  #agentAttemptAuditReady;
  #durableJobStoreReady;
  #durableAssetStoreReady;
  #durableRoomStoreReady;
  #taskBranchReady;

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
    this.#baseUrl = new URL(baseUrl);
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

  async #request(path, value, { signal } = {}) {
    const bindingToken = await this.#bindingTokenPromise;
    let response;
    try {
      response = await fetch(new URL(path, this.#baseUrl), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${bindingToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(value),
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
      throw new StudioError(
        code,
        internal ? 'Unexpected Studio error.' : (body.error?.message ?? 'Studio service request failed.'),
        internal ? {} : redactedRemoteDetails(body.error?.details ?? {}),
      );
    }
    return body;
  }

  async execute(commandDto, _opaqueHostContext, options = {}) {
    return this.#request('/internal/mcp/execute', { schemaVersion: 1, command: commandDto }, options);
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
