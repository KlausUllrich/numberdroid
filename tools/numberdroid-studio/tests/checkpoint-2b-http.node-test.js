import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { startStudioHttpServer } from '../apps/studio-server/src/server.js';

const studioRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = resolve(studioRoot, '../../art-source/approved/area-01-transfer-ship/floor-treatment/source/family-hygiene-floor-2x2__source-approved__2026-08-21.png');
const projectId = 'project.checkpoint-2b.http';
const sourceId = 'source.checkpoint-2b.http';
const atlasId = 'atlas.checkpoint-2b.http';
const sourceDigest = '67b87430b0c78b6bb9b3af5b3a8bc75c9156a38d75b433a1cbbef8fd7979c71e';
const owner = { id: 'designer.http', kind: 'human', displayName: 'HTTP Designer' };
const ownerContext = { actor: owner, taskId: null, grantId: null, branchId: 'branch.main' };

function command(type, revision, suffix, payload) {
  return {
    schemaVersion: 1,
    commandId: `cmd.http.2b.${suffix}`,
    idempotencyKey: `idem.http.2b.${suffix}`,
    type,
    projectId,
    baseRevision: revision,
    expectedVersion: revision,
    dryRun: false,
    payload,
  };
}

function requestHeaders(base, csrfToken) {
  return {
    'content-type': 'application/json',
    origin: base,
    'sec-fetch-site': 'same-origin',
    'x-numberdroid-studio-csrf': csrfToken,
  };
}

async function jsonRequest(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  return { response, body };
}

test('human HTTP cutter routes enforce CSRF and carry an approved source through committed slice delivery', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-2b-http-'));
  const running = await startStudioHttpServer({ dataDirectory: directory, port: 0 });
  context.after(async () => {
    await new Promise((resolveClose) => running.server.close(resolveClose));
    await rm(directory, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${running.address.port}`;
  await running.studioService.execute(command('project.create', 0, 'create', {
    name: 'Checkpoint 2B HTTP', ownerId: owner.id,
  }), ownerContext);
  const source = await running.artifactStore.ingest(await readFile(sourcePath), {
    mediaType: 'image/png', expectedDigest: sourceDigest,
  });
  running.sourceIntakeStore.stage(source, {
    projectId,
    intakeId: 'intake.checkpoint-2b.http',
    idempotencyKey: 'intake.checkpoint-2b.http',
    origin: 'human_upload',
    createdRevision: 1,
  });
  await running.studioService.execute(command('source.intake.commit', 1, 'source', {
    intakeId: 'intake.checkpoint-2b.http', sourceId, name: 'Approved HTTP source',
    artifactUri: source.uri, mediaType: source.mediaType, byteSize: source.byteSize,
    width: source.width, height: source.height,
    provenance: {
      origin: 'human_upload', prompt: null, negativePrompt: null, seed: null,
      provider: null, model: null, modelVersion: null, generator: null,
      parameters: {}, referenceArtifactUris: [], parentSourceIds: [],
    },
  }), ownerContext);
  await running.studioService.execute(command('source.review.propose', 2, 'propose', {
    sourceId, note: 'HTTP route test.',
  }), ownerContext);
  await running.studioService.execute(command('source.review.decide', 3, 'approve', {
    sourceId, disposition: 'APPROVED', note: 'Approved for exact crop.',
  }), ownerContext);

  const session = await fetch(`${base}/api/ui-session`).then((response) => response.json());
  const headers = requestHeaders(base, session.csrfToken);
  const gridBody = {
    expectedRevision: 4,
    sourceId,
    rows: 2,
    columns: 2,
    margins: { top: 3, right: 3, bottom: 3, left: 3 },
    gapX: 4,
    gapY: 4,
    rectangleIdPrefix: 'rect.http.family',
  };
  const blindGrid = await jsonRequest(`${base}/api/projects/${projectId}/atlases/grid-proposal`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(gridBody),
  });
  assert.equal(blindGrid.response.status, 403);
  assert.equal(blindGrid.body.error.code, 'UI_ORIGIN_REQUIRED');

  const grid = await jsonRequest(`${base}/api/projects/${projectId}/atlases/grid-proposal`, {
    method: 'POST', headers, body: JSON.stringify(gridBody),
  });
  assert.equal(grid.response.status, 200);
  assert.deepEqual(grid.body.proposal.rectangles.map(({ x, y, width, height }) => [x, y, width, height]), [
    [3, 3, 622, 622], [629, 3, 622, 622], [3, 629, 622, 622], [629, 629, 622, 622],
  ]);

  const definitionBody = {
    expectedRevision: 4,
    idempotencyKey: 'http.2b.define',
    sourceId,
    name: 'HTTP exact cuts',
    expectedAtlasVersion: 0,
    rectangles: grid.body.proposal.rectangles,
  };
  const defined = await jsonRequest(`${base}/api/projects/${projectId}/atlases/${atlasId}/definition`, {
    method: 'POST', headers, body: JSON.stringify(definitionBody),
  });
  assert.equal(defined.response.status, 200);
  assert.equal(defined.body.revision, 5);
  assert.equal(defined.body.value.definitionVersion, 1);
  const definedReplay = await jsonRequest(`${base}/api/projects/${projectId}/atlases/${atlasId}/definition`, {
    method: 'POST', headers, body: JSON.stringify(definitionBody),
  });
  assert.equal(definedReplay.response.status, 200);
  assert.equal(definedReplay.body.replayed, true);
  assert.equal(definedReplay.body.revision, 5);

  const previewBody = {
    expectedRevision: 5,
    idempotencyKey: 'http.2b.preview',
    expectedAtlasVersion: 1,
    expectedDefinitionFingerprint: defined.body.value.definitionFingerprint,
    jobId: 'job.http.2b.preview',
  };
  const preview = await jsonRequest(`${base}/api/projects/${projectId}/atlases/${atlasId}/preview`, {
    method: 'POST', headers, body: JSON.stringify(previewBody),
  });
  assert.equal(preview.response.status, 200);
  assert.equal(preview.body.revision, 6);
  assert.equal(preview.body.value.status, 'ACCEPTED');
  const previewReplay = await jsonRequest(`${base}/api/projects/${projectId}/atlases/${atlasId}/preview`, {
    method: 'POST', headers, body: JSON.stringify(previewBody),
  });
  assert.equal(previewReplay.response.status, 200);
  assert.equal(previewReplay.body.replayed, true);
  assert.equal(previewReplay.body.revision, 6);

  let job;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const observed = await jsonRequest(`${base}/api/projects/${projectId}/jobs/${previewBody.jobId}`, { method: 'GET' });
    assert.equal(observed.response.status, 200);
    job = observed.body.job;
    if (!['QUEUED', 'RUNNING'].includes(job.state)) break;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 20));
  }
  assert.equal(job.state, 'SUCCEEDED');
  assert.equal(job.outputs.length, 4);
  assert.equal(job.outputs[0].preview.state, 'READY');
  assert.equal(job.outputs[0].preview.resourceUri, `/api/projects/${projectId}/artifacts/sha256/${job.outputs[0].digest}`);
  assert.doesNotMatch(JSON.stringify(job.outputs[0].preview), /file:|\/workspace|base64/);

  const commitBody = {
    expectedRevision: 6,
    idempotencyKey: 'http.2b.commit',
    expectedAtlasVersion: 1,
    expectedDefinitionFingerprint: defined.body.value.definitionFingerprint,
    jobId: previewBody.jobId,
  };
  const committed = await jsonRequest(`${base}/api/projects/${projectId}/atlases/${atlasId}/commit`, {
    method: 'POST', headers, body: JSON.stringify(commitBody),
  });
  assert.equal(committed.response.status, 200);
  assert.equal(committed.body.revision, 7);
  assert.equal(committed.body.value.slices.length, 4);
  const commitReplay = await jsonRequest(`${base}/api/projects/${projectId}/atlases/${atlasId}/commit`, {
    method: 'POST', headers, body: JSON.stringify(commitBody),
  });
  assert.equal(commitReplay.response.status, 200);
  assert.equal(commitReplay.body.replayed, true);
  assert.equal(commitReplay.body.revision, 7);
  const applied = await fetch(`${base}/api/projects/${projectId}/jobs/${previewBody.jobId}`).then((response) => response.json());
  assert.equal(applied.job.state, 'APPLIED');
  assert.deepEqual(applied.events.map(({ sequence, type }) => [sequence, type]), [
    [1, 'QUEUED'], [2, 'RUNNING'], [3, 'PROGRESS'], [4, 'PROGRESS'],
    [5, 'PROGRESS'], [6, 'PROGRESS'], [7, 'SUCCEEDED'], [8, 'APPLIED'],
  ]);
  assert.doesNotMatch(JSON.stringify(applied.events),
    /"operationIdempotencyKey"|"grantId"|"lease"|"workerId"|"token"|\/workspace|file:/i);
  const discardApplied = await jsonRequest(`${base}/api/projects/${projectId}/jobs/${previewBody.jobId}/discard`, {
    method: 'POST', headers, body: JSON.stringify({ operationIdempotencyKey: 'http.2b.discard.applied' }),
  });
  assert.equal(discardApplied.response.status, 409);
  assert.equal(discardApplied.body.error.code, 'JOB_STATE_CONFLICT');

  const first = committed.body.value.slices[0];
  const delivered = await fetch(`${base}/api/projects/${projectId}/artifacts/sha256/${first.digest}`);
  assert.equal(delivered.status, 200);
  assert.equal(delivered.headers.get('content-type'), 'image/png');
  assert.equal(delivered.headers.get('cache-control'), 'private, max-age=31536000, immutable');
  const deliveredBytes = Buffer.from(await delivered.arrayBuffer());
  assert.equal(deliveredBytes.length, 1_548_341);
  assert.equal(createHash('sha256').update(deliveredBytes).digest('hex'), first.digest);

  const previewDelivered = await fetch(`${base}${job.outputs[0].preview.resourceUri}`);
  assert.equal(previewDelivered.status, 200);
  assert.equal(createHash('sha256').update(Buffer.from(await previewDelivered.arrayBuffer())).digest('hex'), job.outputs[0].digest);

  const otherProjectId = 'project.other-checkpoint-2b-http';
  await running.studioService.execute({
    ...command('project.create', 0, 'other-project', {
      name: 'Other Checkpoint 2B project', ownerId: owner.id,
    }),
    projectId: otherProjectId,
  }, ownerContext);
  const crossProjectPreview = await fetch(`${base}/api/projects/${otherProjectId}/artifacts/sha256/${job.outputs[0].digest}`);
  assert.equal(crossProjectPreview.status, 404);
  assert.equal((await crossProjectPreview.json()).error.code, 'ARTIFACT_NOT_FOUND');

  const wrongProject = await fetch(`${base}/api/projects/project.other/jobs/${previewBody.jobId}`);
  assert.equal(wrongProject.status, 404);
  assert.equal((await wrongProject.json()).error.code, 'PROJECT_NOT_FOUND');
  const stale = await jsonRequest(`${base}/api/projects/${projectId}/atlases/${atlasId}/definition`, {
    method: 'POST', headers, body: JSON.stringify({ ...definitionBody, idempotencyKey: 'http.2b.stale' }),
  });
  assert.equal(stale.response.status, 409);
  assert.equal(stale.body.error.code, 'REVISION_CONFLICT');
});
