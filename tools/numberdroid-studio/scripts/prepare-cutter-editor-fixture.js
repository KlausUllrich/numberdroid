import { readFile, lstat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStudioHttpServer } from '../apps/studio-server/src/server.js';

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const projectId = 'project.cutter-live-test';
const owner = { id: 'local.designer', kind: 'human', displayName: 'Local designer' };
const ownerContext = {
  actor: owner,
  taskId: null,
  grantId: null,
  branchId: 'branch.main',
};
const sourcePath = resolve(
  moduleDirectory,
  '../../../art-source/approved/area-01-transfer-ship/floor-treatment/source/family-hygiene-floor-2x2__source-approved__2026-08-21.png',
);
const expectedDigest = '67b87430b0c78b6bb9b3af5b3a8bc75c9156a38d75b433a1cbbef8fd7979c71e';
if (process.argv.length !== 3) throw new Error('Usage: prepare-cutter-editor-fixture.js NEW_DATA_DIRECTORY');
const dataDirectory = resolve(process.argv[2]);
try { await lstat(dataDirectory); throw new Error('Cutter fixture requires a new directory; existing data is preserved.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
let tick = 0;
const running = await startStudioHttpServer({
  dataDirectory,
  port: 0,
  clock: () => new Date(Date.UTC(2026, 7, 22, 9, 0, tick++)).toISOString(),
});

function command(type, revision, id, payload) {
  return {
    schemaVersion: 1,
    commandId: `visual.2b.${id}`,
    idempotencyKey: `visual.2b.${id}`,
    type,
    projectId,
    baseRevision: revision,
    expectedVersion: revision,
    dryRun: false,
    payload,
  };
}

try {
  if ((await running.studioService.listProjectsTrusted()).length !== 0) {
    throw new Error('Checkpoint 2B visual evidence requires a new data directory.');
  }
  await running.studioService.execute(command('project.create', 0, 'project-create', {
    name: 'Cutter test project',
    description: 'VT-019 · One approved test image, no saved cuts. Open Sources to start the Cutter walkthrough.',
    ownerId: owner.id,
  }), ownerContext);

  const artifact = await running.artifactStore.ingest(await readFile(sourcePath), {
    mediaType: 'image/png',
    expectedDigest,
    limits: { maxBytes: 16 * 1024 * 1024, maxWidth: 4096, maxHeight: 4096 },
  });
  running.sourceIntakeStore.stage(artifact, {
    projectId,
    intakeId: 'intake.family-hygiene-2b',
    idempotencyKey: 'visual.2b.intake.family-hygiene',
    origin: 'human_upload',
    createdRevision: 1,
    createdAt: '2026-08-22T09:00:01.000Z',
  });
  await running.studioService.execute(command('source.intake.commit', 1, 'source-commit', {
    intakeId: 'intake.family-hygiene-2b',
    sourceId: 'source.family-hygiene-approved',
    name: 'Family Hygiene floor 2×2',
    artifactUri: artifact.uri,
    mediaType: artifact.mediaType,
    byteSize: artifact.byteSize,
    width: artifact.width,
    height: artifact.height,
    provenance: {
      origin: 'human_upload',
      prompt: null,
      negativePrompt: null,
      seed: null,
      provider: null,
      model: null,
      modelVersion: null,
      generator: null,
      parameters: {},
      referenceArtifactUris: [],
      parentSourceIds: [],
    },
  }), ownerContext);
  await running.studioService.execute(command('source.review.propose', 2, 'source-propose', {
    sourceId: 'source.family-hygiene-approved',
    note: 'Approved fixture image reused for the VT-019 Cutter walkthrough.',
  }), ownerContext);
  await running.studioService.execute(command('source.review.decide', 3, 'source-approve', {
    sourceId: 'source.family-hygiene-approved',
    disposition: 'APPROVED',
    note: 'Approved source fixture.',
  }), ownerContext);

  process.stdout.write(`${JSON.stringify({ schemaVersion: 1, projectId, revision: 4, sourceId: 'source.family-hygiene-approved', sourceDigest: artifact.digest, atlasCount: 0, sliceCount: 0 })}\n`);
} finally {
  await new Promise((resolveClose, rejectClose) => running.server.close(error => error ? rejectClose(error) : resolveClose()));
}
