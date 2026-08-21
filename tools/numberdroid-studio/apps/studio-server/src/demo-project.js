import { StudioError } from '../../../packages/domain/src/index.js';

const DEMO_PROJECT_ID = 'numberdroid-studio-demo';
const OWNER = { id: 'local.designer', kind: 'human', displayName: 'Local designer' };
const AGENT = { id: 'atlas.agent', kind: 'agent', displayName: 'Atlas agent' };
const TASK_ID = 'demo.atlas-bootstrap';
const GRANT_ID = 'grant.demo-atlas';
const BRANCH_ID = 'branch.demo-atlas';
const OWNER_CONTEXT = { actor: OWNER, taskId: null, grantId: null, branchId: 'branch.main' };
const AGENT_CONTEXT = { actor: AGENT, taskId: TASK_ID, grantId: GRANT_ID, branchId: BRANCH_ID };

async function headOrNull(studio) {
  try {
    return await studio.readProjectTrusted(DEMO_PROJECT_ID);
  } catch (error) {
    if (error?.code === 'PROJECT_NOT_FOUND') {
      return null;
    }
    throw error;
  }
}

async function executeAtHead(studio, partial, executionContext = OWNER_CONTEXT) {
  const current = await headOrNull(studio);
  return studio.execute({
    ...partial,
    schemaVersion: 1,
    projectId: DEMO_PROJECT_ID,
    baseRevision: current?.revision ?? 0,
    expectedVersion: current?.revision ?? 0,
    dryRun: false,
  }, executionContext);
}

function atlasSourceRegistration() {
  return {
    commandId: 'demo.register-atlas',
    idempotencyKey: 'demo.register-atlas',
    type: 'source.register',
    payload: {
      sourceId: 'source.family-hygiene-atlas',
      name: 'Family Hygiene generated atlas',
      artifactUri: 'studio://numberdroid-studio-demo/artifacts/family-hygiene-atlas.png',
      mediaType: 'image/png',
      width: 1024,
      height: 1024,
      provenance: {
        prompt: 'Orthographic sci-fi hygiene room tile atlas, isolated cells, no labels.',
        seed: 742031,
        model: 'demo-generator',
        generator: 'agent-atlas-workflow',
      },
    },
  };
}

export async function ensureDemoProject(studio) {
  let current = await headOrNull(studio);
  if (!current) {
    await executeAtHead(studio, {
      commandId: 'demo.create',
      idempotencyKey: 'demo.create',
      type: 'project.create',
      payload: {
        name: 'Family Hygiene Studio Demo',
        description: 'A safe local project demonstrating human-visible agent work.',
        ownerId: OWNER.id,
      },
    });
    current = await headOrNull(studio);
  }

  if (!current.snapshot.grants.some((grant) => grant.id === GRANT_ID)) {
    await executeAtHead(studio, {
      commandId: 'demo.grant-atlas-agent',
      idempotencyKey: 'demo.grant-atlas-agent',
      type: 'grant.issue',
      payload: {
        grantId: GRANT_ID,
        agentId: AGENT.id,
        taskId: TASK_ID,
        branchId: BRANCH_ID,
        scopes: ['project.read', 'source.write', 'asset.write', 'project.status.write'],
        objectScopes: [{ kind: 'project', id: DEMO_PROJECT_ID }],
        budget: { maxCommands: 100, maxJobs: 10, maxArtifactBytes: 536870912, maxCostCents: 0 },
      },
    });
    current = await headOrNull(studio);
  }

  if (!current.snapshot.sources.some((source) => source.id === 'source.family-hygiene-atlas')) {
    await executeAtHead(studio, atlasSourceRegistration(), AGENT_CONTEXT);
    current = await headOrNull(studio);
  }

  if (!current.snapshot.assets.some((asset) => asset.id === 'tile.hygiene.floor.clean-a')) {
    await executeAtHead(studio, {
      commandId: 'demo.define-floor-tile',
      idempotencyKey: 'demo.define-floor-tile',
      type: 'asset.define',
      payload: {
        assetId: 'tile.hygiene.floor.clean-a',
        sourceId: 'source.family-hygiene-atlas',
        name: 'Clean hygiene floor A',
        kind: 'surface',
        region: { x: 0, y: 0, width: 128, height: 128 },
        properties: {
          role: 'floor',
          topology: 'fill',
          collision: 'none',
          family: 'family-hygiene',
        },
        status: 'in_review',
      },
    }, AGENT_CONTEXT);
    current = await headOrNull(studio);
  }

  if (current.snapshot.project.status === 'draft') {
    await executeAtHead(studio, {
      commandId: 'demo.request-review',
      idempotencyKey: 'demo.request-review',
      type: 'project.status.set',
      payload: { status: 'in_review', note: 'Generated source and first tile are ready for human review.' },
    }, AGENT_CONTEXT);
  }

  return studio.readProjectTrusted(DEMO_PROJECT_ID);
}

export async function runDemoAction(studio, action) {
  const current = await studio.readProjectTrusted(DEMO_PROJECT_ID);
  switch (action) {
    case 'idempotent-retry':
      return studio.execute({
        ...atlasSourceRegistration(),
        schemaVersion: 1,
        projectId: DEMO_PROJECT_ID,
        baseRevision: 2,
        expectedVersion: 2,
        dryRun: false,
      }, AGENT_CONTEXT);
    case 'stale-write': {
      const staleVersion = Math.max(0, current.revision - 1);
      return studio.execute({
        schemaVersion: 1,
        commandId: 'demo.control.stale-write',
        idempotencyKey: 'demo.control.stale-write',
        type: 'project.status.set',
        projectId: DEMO_PROJECT_ID,
        baseRevision: staleVersion,
        expectedVersion: staleVersion,
        dryRun: false,
        payload: { status: 'active', note: 'This control-lab command is intentionally stale.' },
      }, OWNER_CONTEXT);
    }
    case 'revoke-grant':
      return executeAtHead(studio, {
        commandId: 'demo.control.revoke-grant',
        idempotencyKey: 'demo.control.revoke-grant',
        type: 'grant.revoke',
        payload: { grantId: GRANT_ID, reason: 'Checkpoint 1A user-control demonstration.' },
      });
    case 'post-revoke-attempt':
      return executeAtHead(studio, {
        commandId: 'demo.control.post-revoke-attempt',
        idempotencyKey: 'demo.control.post-revoke-attempt',
        type: 'source.register',
        payload: {
          sourceId: 'source.should-be-denied',
          name: 'Denied source',
          artifactUri: 'studio://numberdroid-studio-demo/artifacts/denied.png',
          mediaType: 'image/png',
          provenance: { prompt: 'This write must never commit after revocation.', seed: 0 },
        },
      }, AGENT_CONTEXT);
    default:
      throw new StudioError('VALIDATION_ERROR', 'Unknown fixed demo action.', {
        action,
        allowed: ['idempotent-retry', 'stale-write', 'revoke-grant', 'post-revoke-attempt'],
      });
  }
}

export { DEMO_PROJECT_ID };
