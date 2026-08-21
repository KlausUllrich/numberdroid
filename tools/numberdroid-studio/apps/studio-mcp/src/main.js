import { LocalStudioGateway } from './local-studio-gateway.js';
import { serveOfficialMcpStdio } from '../../../packages/mcp-server/src/index.js';

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

const baseUrl = process.env.NUMBERDROID_STUDIO_SERVICE_URL ?? 'http://127.0.0.1:4317/';
const bindingToken = requiredEnvironment('NUMBERDROID_STUDIO_BINDING_TOKEN');
const projectId = requiredEnvironment('NUMBERDROID_STUDIO_PROJECT_ID');
const gateway = new LocalStudioGateway({ baseUrl, bindingToken });

serveOfficialMcpStdio({
  studioGateway: gateway,
  // The bridge knows only the project selected by its launcher and an opaque
  // bearer token. The local Studio service resolves actor/task/branch/grant
  // authority from the hashed HostBinding on every request.
  contextProvider: async () => ({ projectId }),
});
