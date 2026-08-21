import { StudioService } from '../packages/application/src/index.js';
import { InMemoryProjectStore } from '../packages/persistence/src/index.js';

export const OWNER = { id: 'designer.one', kind: 'human', displayName: 'Designer One' };
export const AGENT = { id: 'atlas.agent', kind: 'agent', displayName: 'Atlas Agent' };
export const PROJECT_ID = 'project.family-hygiene';

export function createHarness(store = new InMemoryProjectStore()) {
  let tick = 0;
  const clock = () => new Date(Date.UTC(2026, 7, 21, 12, 0, tick++)).toISOString();
  return { store, studio: new StudioService({ store, clock }) };
}

export function command(overrides = {}) {
  const version = overrides.expectedVersion ?? overrides.baseRevision ?? 0;
  return {
    schemaVersion: 1,
    commandId: 'cmd.default',
    idempotencyKey: 'idem.default',
    type: 'project.create',
    projectId: PROJECT_ID,
    baseRevision: version,
    expectedVersion: version,
    dryRun: false,
    actor: OWNER,
    payload: { name: 'Family Hygiene', ownerId: OWNER.id },
    ...overrides,
  };
}

export async function createProject(studio) {
  return studio.execute(command({ commandId: 'cmd.create', idempotencyKey: 'idem.create' }));
}

export async function issueGrant(studio, { scopes = ['project.read', 'source.write', 'asset.write'], expectedVersion = 1 } = {}) {
  return studio.execute(command({
    commandId: 'cmd.grant',
    idempotencyKey: 'idem.grant',
    type: 'grant.issue',
    expectedVersion,
    taskId: null,
    payload: { grantId: 'grant.atlas', agentId: AGENT.id, taskId: 'task.atlas', scopes },
  }));
}

export function agentSourceCommand(overrides = {}) {
  return command({
    commandId: 'cmd.source',
    idempotencyKey: 'idem.source',
    type: 'source.register',
    expectedVersion: 2,
    actor: AGENT,
    taskId: 'task.atlas',
    grantId: 'grant.atlas',
    payload: {
      sourceId: 'source.atlas',
      name: 'Generated atlas',
      artifactUri: 'studio://project.family-hygiene/artifacts/source.atlas.png',
      mediaType: 'image/png',
      width: 1024,
      height: 1024,
      provenance: { prompt: 'Orthographic sci-fi hygiene room atlas.', seed: 742 },
    },
    ...overrides,
  });
}
