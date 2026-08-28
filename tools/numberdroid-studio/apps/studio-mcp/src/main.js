import { LocalStudioGateway } from './local-studio-gateway.js';
import { serveOfficialMcpStdio } from '../../../packages/mcp-server/src/index.js';
import {
  NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT,
} from '../../../packages/numberdroid-adapter/src/index.js';
import { pairWithStudio } from './pairing-client.js';

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function selectedMcpProfile() {
  const value = process.env.NUMBERDROID_STUDIO_MCP_PROFILE;
  if (value === undefined) return null;
  if (value !== 'authoring-v2') {
    throw new Error('NUMBERDROID_STUDIO_MCP_PROFILE is unsupported.');
  }
  return value;
}

async function run() {
  const mcpProfile = selectedMcpProfile();
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
    durableJobStoreReady: process.env.NUMBERDROID_STUDIO_JOB_STORE_READY === '1',
    durableAssetStoreReady: process.env.NUMBERDROID_STUDIO_ASSET_STORE_READY === '1',
    durableRoomStoreReady: process.env.NUMBERDROID_STUDIO_ROOM_STORE_READY === '1',
    taskBranchReady: process.env.NUMBERDROID_STUDIO_TASK_BRANCH_READY === '1',
  });

  const authoringV2 = mcpProfile === 'authoring-v2'
    ? Object.freeze({
      negotiation: await gateway.negotiateAuthoringV2({
        schemaVersion: 2,
        kind: 'studio.authoring-v2-surface-negotiation-request',
        featureId: 'studio.authoring-v2',
        projectId,
        expectedProfileFingerprint: NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT,
      }),
      projectId,
      expectedProfileFingerprint: NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT,
    })
    : null;

  return serveOfficialMcpStdio({
    studioGateway: gateway,
    // The bridge knows only the project selected by its launcher and an opaque
    // bearer token. The local Studio service resolves actor/task/branch/grant
    // authority from the hashed HostBinding on every request.
    contextProvider: async () => ({ projectId }),
    ...(authoringV2 === null ? {} : { authoringV2 }),
  });
}

run().catch(() => {
  process.stderr.write('[numberdroid-studio] MCP_STARTUP_FAILED\n');
  process.exitCode = 1;
});
