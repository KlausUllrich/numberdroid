import { LocalStudioGateway } from './local-studio-gateway.js';
import { serveOfficialMcpStdio } from '../../../packages/mcp-server/src/index.js';
import { pairWithStudio } from './pairing-client.js';

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

const baseUrl = process.env.NUMBERDROID_STUDIO_SERVICE_URL ?? 'http://127.0.0.1:4317/';
const projectId = requiredEnvironment('NUMBERDROID_STUDIO_PROJECT_ID');
const bindingToken = process.env.NUMBERDROID_STUDIO_BINDING_TOKEN ?? null;
const gateway = new LocalStudioGateway({
  baseUrl,
  bindingToken,
  bindingTokenProvider: bindingToken ? null : () => pairWithStudio({
    endpoint: requiredEnvironment('NUMBERDROID_STUDIO_PAIRING_ENDPOINT'),
    projectId,
    label: process.env.NUMBERDROID_STUDIO_HOST_LABEL ?? 'Local MCP host',
  }),
  agentAttemptAuditReady: process.env.NUMBERDROID_STUDIO_AGENT_AUDIT_READY === '1',
});

serveOfficialMcpStdio({
  studioGateway: gateway,
  // The bridge knows only the project selected by its launcher and an opaque
  // bearer token. The local Studio service resolves actor/task/branch/grant
  // authority from the hashed HostBinding on every request.
  contextProvider: async () => ({ projectId }),
});
