import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStudioHttpServer } from '../apps/studio-server/src/server.js';

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const projectId = 'numberdroid-studio-checkpoint-2b';
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
const expectedOutputDigests = [
  'ef83efbee4b00ec49679f0409ba6f33423729b9d67946ba45f3ab119a91886f2',
  '3781086c30598cf8c07582f9b830e3343e0e1363f2e7c17d35a6678eeeb41c7e',
  '9d4c867156c590d372c9c7ef955596c919d717821b65ea992db0e7606cde2526',
  'a63dceb520a894a3e91e547d93e15d154873f04bb32e0ac8f8354ca7d2150318',
];
const rectangles = [
  ['rect.family.0.0', 3, 3],
  ['rect.family.0.1', 629, 3],
  ['rect.family.1.0', 3, 629],
  ['rect.family.1.1', 629, 629],
].map(([rectangleId, x, y]) => ({
  rectangleId,
  x,
  y,
  width: 622,
  height: 622,
  included: true,
  pivot: null,
  transparentPaddingPolicy: 'preserve_exact_rect',
  replacesSliceId: null,
  expectedSliceVersion: null,
}));
const dataDirectory = resolve(process.argv[2] ?? '.numberdroid-studio-checkpoint-2b-visual');
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
    name: 'Checkpoint 2B · Family Hygiene atlas cutter',
    description: 'Approved source-resolution rectangles, deterministic durable previews, and committed stable slice heads.',
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
    note: 'Prepared for Checkpoint 2B source-resolution cutting.',
  }), ownerContext);
  await running.studioService.execute(command('source.review.decide', 3, 'source-approve', {
    sourceId: 'source.family-hygiene-approved',
    disposition: 'APPROVED',
    note: 'Approved source fixture.',
  }), ownerContext);

  const defined = await running.studioService.execute(command('atlas.define.rects', 4, 'atlas-define', {
    atlasId: 'atlas.family-hygiene-2b',
    sourceId: 'source.family-hygiene-approved',
    name: 'Family Hygiene exact 2×2 cuts',
    expectedAtlasVersion: 0,
    rectangles,
  }), ownerContext);
  const jobId = 'job.family-hygiene-2b.preview';
  await running.studioService.execute(command('atlas.preview.slices', 5, 'atlas-preview', {
    atlasId: 'atlas.family-hygiene-2b',
    expectedAtlasVersion: defined.value.definitionVersion,
    expectedDefinitionFingerprint: defined.value.definitionFingerprint,
    jobId,
  }), ownerContext);
  await running.atlasPreviewWorker.kick();
  const succeeded = running.jobStore.get(projectId, jobId);
  if (succeeded.state !== 'SUCCEEDED') throw new Error(`Visual preview job ended in ${succeeded.state}.`);
  if (JSON.stringify(succeeded.outputs.map(({ digest }) => digest)) !== JSON.stringify(expectedOutputDigests)) {
    throw new Error('Visual preview output digests differ from the Checkpoint 2B pins.');
  }
  const committed = await running.studioService.execute(command('atlas.commit.slices', 6, 'atlas-commit', {
    atlasId: 'atlas.family-hygiene-2b',
    expectedAtlasVersion: defined.value.definitionVersion,
    expectedDefinitionFingerprint: defined.value.definitionFingerprint,
    jobId,
  }), ownerContext);

  const finalProject = await running.studioService.readProjectTrusted(projectId);
  const finalJob = running.jobStore.get(projectId, jobId);
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 1,
    projectId,
    revision: finalProject.revision,
    activityCount: 7,
    sourceDigest: artifact.digest,
    atlasId: committed.value.atlasId,
    definitionVersion: defined.value.definitionVersion,
    jobId,
    jobState: finalJob.state,
    sliceCount: committed.value.slices.length,
    outputs: finalJob.outputs.map(({ rectangleId, digest, byteSize, width, height }) => ({
      rectangleId, digest, byteSize, width, height,
    })),
  }, null, 2)}\n`);
} finally {
  await new Promise((resolveClose) => running.server.close(resolveClose));
}
