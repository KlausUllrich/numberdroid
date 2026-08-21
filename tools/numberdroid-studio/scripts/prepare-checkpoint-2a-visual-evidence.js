import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStudioHttpServer } from '../apps/studio-server/src/server.js';

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const projectId = 'numberdroid-studio-checkpoint-2a';
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
const dataDirectory = resolve(process.argv[2] ?? '.numberdroid-studio-checkpoint-2a-visual');
let tick = 0;
const running = await startStudioHttpServer({
  dataDirectory,
  port: 0,
  clock: () => new Date(Date.UTC(2026, 7, 21, 16, 0, tick++)).toISOString(),
});

function command(type, revision, id, payload) {
  return {
    schemaVersion: 1,
    commandId: `visual.${id}`,
    idempotencyKey: `visual.${id}`,
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
    throw new Error('Checkpoint 2A visual evidence requires a new data directory.');
  }
  await running.studioService.execute(command('project.create', 0, 'project-create', {
    name: 'Checkpoint 2A · Family Hygiene source review',
    description: 'Deterministic source-intake, approval, recovery, and audit evidence.',
    ownerId: owner.id,
  }), ownerContext);

  const bytes = await readFile(sourcePath);
  const artifact = await running.artifactStore.ingest(bytes, {
    mediaType: 'image/png',
    expectedDigest,
    limits: { maxBytes: 16 * 1024 * 1024, maxWidth: 4096, maxHeight: 4096 },
  });
  running.sourceIntakeStore.stage(artifact, {
    projectId,
    intakeId: 'intake.family-hygiene-approved',
    idempotencyKey: 'visual.intake.family-hygiene-approved',
    origin: 'human_upload',
    createdRevision: 1,
    createdAt: '2026-08-21T16:00:01.000Z',
  });
  await running.studioService.execute(command('source.intake.commit', 1, 'source-commit', {
    intakeId: 'intake.family-hygiene-approved',
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
    note: 'Prepared for Checkpoint 2A visual inspection.',
  }), ownerContext);
  await running.studioService.execute(command('source.review.decide', 3, 'source-approve', {
    sourceId: 'source.family-hygiene-approved',
    disposition: 'APPROVED',
    note: 'Approved source fixture.',
  }), ownerContext);
  running.sourceIntakeStore.stage(artifact, {
    projectId,
    intakeId: 'intake.family-hygiene-recovery',
    idempotencyKey: 'visual.intake.family-hygiene-recovery',
    origin: 'human_upload',
    createdRevision: 4,
    createdAt: '2026-08-21T16:00:05.000Z',
  });
  running.agentAttemptStore.recordFailure({
    attemptId: 'attempt.checkpoint-2a-denied',
    projectId,
    correlationId: 'mcp.checkpoint-2a-denied',
    actorId: 'atlas.agent',
    taskId: 'task.checkpoint-2a',
    branchId: 'branch.checkpoint-2a',
    commandId: 'cmd.checkpoint-2a-denied',
    commandType: 'source.review.propose',
    targetId: projectId,
    observedRevision: 4,
    status: 'DENIED',
    errorCode: 'GRANT_SCOPE_MISSING',
    details: { requiredScope: 'source.review.propose', ignored: 'audit-sentinel-secret' },
    occurredAt: '2026-08-21T16:00:06.000Z',
  });

  const finalProject = await running.studioService.readProjectTrusted(projectId);
  const intakes = running.sourceIntakeStore.list(projectId);
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 1,
    projectId,
    revision: finalProject.revision,
    activityCount: 5,
    source: {
      sourceId: finalProject.snapshot.sources[0].id,
      lifecycle: finalProject.snapshot.sources[0].lifecycle.state,
      review: finalProject.snapshot.sources[0].review.disposition,
      digest: artifact.digest,
      byteSize: artifact.byteSize,
      width: artifact.width,
      height: artifact.height,
    },
    intakes: intakes.map(({ intakeId, state }) => ({ intakeId, state })),
    agentAttemptCount: running.agentAttemptStore.listForProject(projectId).length,
  }, null, 2)}\n`);
} finally {
  await new Promise((resolveClose) => running.server.close(resolveClose));
}
