import { listCommandDefinitions } from '../../../packages/domain/src/index.js';
import { StudioError } from '../../../packages/domain/src/index.js';

export class LocalStudioGateway {
  #baseUrl;
  #bindingTokenPromise;

  constructor({ baseUrl, bindingToken, bindingTokenProvider = null }) {
    this.#baseUrl = new URL(baseUrl);
    if (!bindingToken && typeof bindingTokenProvider !== 'function') {
      throw new StudioError('HOST_BINDING_REQUIRED', 'A HostBinding token or private pairing provider is required.');
    }
    this.#bindingTokenPromise = bindingToken
      ? Promise.resolve(bindingToken)
      : Promise.resolve().then(bindingTokenProvider);
  }

  get commandCatalog() {
    return listCommandDefinitions();
  }

  async #request(path, value) {
    const bindingToken = await this.#bindingTokenPromise;
    const response = await fetch(new URL(path, this.#baseUrl), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${bindingToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(value),
    });
    const body = await response.json();
    if (!response.ok) {
      throw new StudioError(body.error?.code ?? 'STUDIO_SERVICE_ERROR', body.error?.message ?? 'Studio service request failed.', body.error?.details);
    }
    return body;
  }

  async execute(commandDto, _opaqueHostContext) {
    return this.#request('/internal/mcp/execute', { schemaVersion: 1, command: commandDto });
  }

  async readProject({ projectId }, _opaqueHostContext) {
    return this.#request('/internal/mcp/read-project', { schemaVersion: 1, projectId });
  }
}
