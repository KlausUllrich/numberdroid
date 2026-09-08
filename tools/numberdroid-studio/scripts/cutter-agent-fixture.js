// Test-only host provisioning. This module is never exposed as an agent tool.
// The synthetic owner below approves only generated fixture pixels, not content
// belonging to a person or any accepted Numberdroid production asset.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startStudioHttpServer } from '../apps/studio-server/src/server.js';
import { encodeCanonicalRgbaPng } from '../packages/preview/src/index.js';

export const CUTTER_FIXTURE_PROJECT = 'project.cutter-agent-verification';
const SOURCE_ID = 'source.cutter-synthetic-quadrants';
const OWNER = { id: 'fixture.cutter-owner', kind: 'human', displayName: 'Synthetic fixture owner' };
const OWNER_CONTEXT = { actor: OWNER, taskId: null, grantId: null, branchId: 'branch.main' };

function fixtureCommand(type, revision, suffix, payload) {
  return {
    schemaVersion: 1, commandId: `fixture.cutter.${suffix}`,
    idempotencyKey: `fixture.cutter.${suffix}`, type,
    projectId: CUTTER_FIXTURE_PROJECT, baseRevision: revision,
    expectedVersion: revision, dryRun: false, payload,
  };
}

function syntheticSource() {
  const width = 32;
  const height = 32;
  const rgba = Buffer.alloc(width * height * 4);
  const colors = [[230, 50, 50], [50, 190, 80], [55, 95, 230], [230, 195, 45]];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = colors[(y >= 16 ? 2 : 0) + (x >= 16 ? 1 : 0)];
      rgba.set([r, g, b, 255], (y * width + x) * 4);
    }
  }
  return encodeCanonicalRgbaPng({ width, height, rgba });
}

async function seed(running, expiresAt) {
  const execute = (type, revision, suffix, payload) => running.studioService.execute(
    fixtureCommand(type, revision, suffix, payload), OWNER_CONTEXT,
  );
  await execute('project.create', 0, 'project', {
    name: 'Cutter · synthetic agent verification',
    description: 'Disposable source preparation proof. No production content or owner acceptance.',
    ownerId: OWNER.id,
  });
  const artifact = await running.artifactStore.ingest(syntheticSource(), { mediaType: 'image/png' });
  running.sourceIntakeStore.stage(artifact, {
    projectId: CUTTER_FIXTURE_PROJECT, intakeId: 'intake.cutter-synthetic',
    idempotencyKey: 'fixture.cutter.intake', origin: 'human_upload', createdRevision: 1,
  });
  await execute('source.intake.commit', 1, 'source', {
    intakeId: 'intake.cutter-synthetic', sourceId: SOURCE_ID,
    name: 'Synthetic four-color 2×2 source', artifactUri: artifact.uri,
    mediaType: artifact.mediaType, byteSize: artifact.byteSize,
    width: artifact.width, height: artifact.height,
    provenance: {
      origin: 'human_upload', prompt: null, negativePrompt: null, seed: null,
      provider: null, model: null, modelVersion: null, generator: null,
      parameters: {}, referenceArtifactUris: [], parentSourceIds: [],
    },
  });
  await execute('source.review.propose', 2, 'source-propose', {
    sourceId: SOURCE_ID, note: 'Test host generated these fixture pixels.',
  });
  await execute('source.review.decide', 3, 'source-approve', {
    sourceId: SOURCE_ID, disposition: 'APPROVED',
    note: 'Synthetic fixture setup only; not user content acceptance.',
  });
  await execute('grant.issue', 4, 'grant', {
    grantId: 'grant.cutter-fixture', agentId: 'agent.cutter-verifier',
    taskId: 'task.cutter-verification', branchId: 'branch.cutter-fixture',
    scopes: ['project.read', 'atlas.write'],
    objectScopes: [{ kind: 'project', id: CUTTER_FIXTURE_PROJECT }],
    budget: { maxCommands: 30, maxJobs: 4, maxArtifactBytes: 1024 * 1024, maxCostCents: 0 },
    expiresAt,
  });
}

export async function createCutterAgentFixture({ expiresAt }) {
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-cutter-agent-'));
  let running = null;
  let closed = false;
  const start = () => startStudioHttpServer({
    dataDirectory: directory, host: '127.0.0.1', port: 0,
    storeMode: 'sqlite', operationsConfigurationFilename: null,
  });
  const stop = async () => {
    if (!running) return;
    const previous = running;
    running = null;
    // Production close drains jobs, private transports and database writers.
    await new Promise((resolveClose, rejectClose) => previous.server.close(
      (error) => (error ? rejectClose(error) : resolveClose()),
    ));
  };
  try {
    running = await start();
    await seed(running, expiresAt);
  } catch (error) {
    await stop();
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  return {
    get running() { return running; },
    directory,
    projectId: CUTTER_FIXTURE_PROJECT,
    sourceId: SOURCE_ID,
    async restart() {
      if (closed) throw new Error('Fixture is closed.');
      await stop();
      running = await start();
    },
    async close({ retain = false } = {}) {
      if (closed) return;
      closed = true;
      await stop();
      if (!retain) await rm(directory, { recursive: true, force: true });
    },
  };
}
