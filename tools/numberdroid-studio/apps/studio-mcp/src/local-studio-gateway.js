import { listCommandDefinitions } from '../../../packages/domain/src/index.js';
import { StudioError } from '../../../packages/domain/src/index.js';

export class LocalStudioGateway {
  #baseUrl;
  #bindingToken;

  constructor({ baseUrl, bindingToken }) {
    this.#baseUrl = new URL(baseUrl);
    this.#bindingToken = bindingToken;
  }

  get commandCatalog() {
    return listCommandDefinitions();
  }

  async #request(path, value) {
    const response = await fetch(new URL(path, this.#baseUrl), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.#bindingToken}`,
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
