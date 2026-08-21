import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { StudioService } from '../packages/application/src/index.js';
import { canonicalRgbaPngByteSize } from '../packages/domain/src/index.js';
import {
  ContentAddressedArtifactStore,
  createWorkspaceBackup,
  restoreWorkspaceBackup,
  SqliteArtifactMetadataStore,
  SqliteJobStore,
  SqliteProjectStore,
  SqliteSourceIntakeStore,
  verifyWorkspaceIntegrity,
  verifyWorkspaceBackup,
} from '../packages/persistence/src/index.js';
import { AtlasPreviewWorker } from '../apps/studio-server/src/atlas-preview-worker.js';
import { AGENT_CONTEXT, OWNER_CONTEXT, PROJECT_ID, command, createProject, issueGrant } from './test-helpers.js';
import { nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';

const studioRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = resolve(studioRoot, '../../art-source/approved/area-01-transfer-ship/floor-treatment/source/family-hygiene-floor-2x2__source-approved__2026-08-21.png');
const sourceDigest = '67b87430b0c78b6bb9b3af5b3a8bc75c9156a38d75b433a1cbbef8fd7979c71e';
const rectangles = [
  ['rect.family.0.0', 3, 3],
  ['rect.family.0.1', 629, 3],
  ['rect.family.1.0', 3, 629],
  ['rect.family.1.1', 629, 629],
].map(([rectangleId, x, y]) => ({
  rectangleId, x, y, width: 622, height: 622, included: true, pivot: null,
  transparentPaddingPolicy: 'preserve_exact_rect', replacesSliceId: null, expectedSliceVersion: null,
}));

function ownerCommand(type, expectedVersion, payload, suffix) {
  return command({
    commandId: `cmd.2b.${suffix}`,
    idempotencyKey: `idem.2b.${suffix}`,
    type,
    expectedVersion,
    payload,
  });
}

async function approvedFixture(context, { faultInjector = null } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-checkpoint-2b-'));
  let projectStore = await SqliteProjectStore.open({
    filename: join(directory, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
    faultInjector,
  });
  context.after(async () => {
    projectStore?.close();
    await rm(directory, { recursive: true, force: true });
  });
  const cas = new ContentAddressedArtifactStore({ rootDirectory: join(directory, 'artifacts') });
  const sourceBytes = await readFile(sourcePath);
  const sourceArtifact = await cas.ingest(sourceBytes, { mediaType: 'image/png', expectedDigest: sourceDigest });
  const jobs = new SqliteJobStore({ workspace: projectStore.workspace });
  const studio = new StudioService({ store: projectStore, jobStore: jobs, agentAttemptAuditReady: true });
  await createProject(studio);
  const intakes = new SqliteSourceIntakeStore({ workspace: projectStore.workspace });
  intakes.stage(sourceArtifact, {
    projectId: PROJECT_ID,
    intakeId: 'intake.family.2b',
    idempotencyKey: 'intake-upload.family.2b',
    origin: 'human_upload',
    createdRevision: 1,
  });
  await studio.execute(ownerCommand('source.intake.commit', 1, {
    intakeId: 'intake.family.2b',
    sourceId: 'source.family.2b',
    name: 'Family Hygiene 2×2 approved source',
    artifactUri: sourceArtifact.uri,
    mediaType: 'image/png',
    byteSize: sourceArtifact.byteSize,
    width: sourceArtifact.width,
    height: sourceArtifact.height,
    provenance: {
      origin: 'human_upload', prompt: null, negativePrompt: null, seed: null,
      provider: null, model: null, modelVersion: null, generator: null,
      parameters: {}, referenceArtifactUris: [], parentSourceIds: [],
    },
  }, 'source'), OWNER_CONTEXT);
  await studio.execute(ownerCommand('source.review.propose', 2, {
    sourceId: 'source.family.2b', note: 'Real cutter fixture.',
  }, 'propose'), OWNER_CONTEXT);
  await studio.execute(ownerCommand('source.review.decide', 3, {
    sourceId: 'source.family.2b', disposition: 'APPROVED', note: 'Approved for deterministic crop verification.',
  }, 'approve'), OWNER_CONTEXT);
  return {
    directory, cas, sourceArtifact, get projectStore() { return projectStore; },
    set projectStore(value) { projectStore = value; }, jobs, studio,
  };
}

test('approved Family source cuts into four deterministic durable slices, commits once, and survives restart', async (context) => {
  const fixture = await approvedFixture(context);
  const proposal = await fixture.studio.proposeAtlasGrid({
    schemaVersion: 1,
    projectId: PROJECT_ID,
    expectedRevision: 4,
    sourceId: 'source.family.2b',
    rows: 2,
    columns: 2,
    margins: { top: 3, right: 3, bottom: 3, left: 3 },
    gapX: 4,
    gapY: 4,
    rectangleIdPrefix: 'rect.family',
  }, OWNER_CONTEXT);
  assert.deepEqual(proposal.proposal.rectangles, rectangles);

  const defined = await fixture.studio.execute(ownerCommand('atlas.define.rects', 4, {
    atlasId: 'atlas.family.2b', sourceId: 'source.family.2b', name: 'Family Hygiene cuts',
    expectedAtlasVersion: 0, rectangles,
  }, 'define'), OWNER_CONTEXT);
  assert.equal(defined.value.definitionVersion, 1);
  const previewCommand = ownerCommand('atlas.preview.slices', 5, {
    atlasId: 'atlas.family.2b',
    expectedAtlasVersion: 1,
    expectedDefinitionFingerprint: defined.value.definitionFingerprint,
    jobId: 'job.family.2b.preview.1',
  }, 'preview');
  const preview = await fixture.studio.execute(previewCommand, OWNER_CONTEXT);
  assert.equal(preview.value.status, 'ACCEPTED');
  assert.equal(preview.value.jobResource, `studio://projects/${PROJECT_ID}/jobs/job.family.2b.preview.1`);
  assert.equal(fixture.jobs.get(PROJECT_ID, 'job.family.2b.preview.1').state, 'QUEUED');
  assert.equal(fixture.projectStore.workspace.database.prepare('SELECT count(*) AS count FROM jobs').get().count, 1);

  const metadata = new SqliteArtifactMetadataStore({ workspace: fixture.projectStore.workspace });
  const worker = new AtlasPreviewWorker({
    jobStore: fixture.jobs,
    artifactStore: fixture.cas,
    artifactMetadataStore: metadata,
    workerId: 'worker.test.2b',
  });
  assert.equal(await worker.drain(), 1);
  const succeeded = fixture.jobs.get(PROJECT_ID, 'job.family.2b.preview.1');
  assert.equal(succeeded.state, 'SUCCEEDED');
  assert.deepEqual(succeeded.outputs.map((output) => [output.rectangleId, output.byteSize, output.digest]), [
    ['rect.family.0.0', 1548341, 'ef83efbee4b00ec49679f0409ba6f33423729b9d67946ba45f3ab119a91886f2'],
    ['rect.family.0.1', 1548341, '3781086c30598cf8c07582f9b830e3343e0e1363f2e7c17d35a6678eeeb41c7e'],
    ['rect.family.1.0', 1548341, '9d4c867156c590d372c9c7ef955596c919d717821b65ea992db0e7606cde2526'],
    ['rect.family.1.1', 1548341, 'a63dceb520a894a3e91e547d93e15d154873f04bb32e0ac8f8354ca7d2150318'],
  ]);
  assert.equal(fixture.projectStore.workspace.database.prepare(`
    SELECT count(*) AS count FROM artifact_references
    WHERE project_id = ? AND owner_kind = 'job_output' AND owner_id = ?
  `).get(PROJECT_ID, succeeded.jobId).count, 4);

  const commitCommand = ownerCommand('atlas.commit.slices', 6, {
    atlasId: 'atlas.family.2b',
    expectedAtlasVersion: 1,
    expectedDefinitionFingerprint: defined.value.definitionFingerprint,
    jobId: succeeded.jobId,
  }, 'commit');
  const committed = await fixture.studio.execute(commitCommand, OWNER_CONTEXT);
  assert.equal(committed.revision, 7);
  assert.equal(committed.value.slices.length, 4);
  assert.equal(fixture.jobs.get(PROJECT_ID, succeeded.jobId).state, 'APPLIED');
  assert.equal(fixture.projectStore.workspace.database.prepare(`
    SELECT count(*) AS count FROM artifact_references WHERE project_id = ? AND owner_kind = 'job_output'
  `).get(PROJECT_ID).count, 0);
  assert.equal(fixture.projectStore.workspace.database.prepare(`
    SELECT count(*) AS count FROM artifact_references WHERE project_id = ? AND owner_kind = 'atlas_slice'
  `).get(PROJECT_ID).count, 4);
  const replay = await fixture.studio.execute({ ...commitCommand, commandId: 'cmd.2b.commit.replay' }, OWNER_CONTEXT);
  assert.equal(replay.replayed, true);
  assert.equal(replay.revision, 7);

  const firstSlice = committed.value.slices[0];
  const mappedRectangles = rectangles.map((rectangle, index) => ({
    ...rectangle,
    included: index === 0,
    replacesSliceId: index === 0 ? firstSlice.sliceId : null,
    expectedSliceVersion: index === 0 ? 1 : null,
  }));
  const mappedDefinition = await fixture.studio.execute(ownerCommand('atlas.define.rects', 7, {
    atlasId: 'atlas.family.2b', sourceId: 'source.family.2b', name: 'Family Hygiene mapped recut',
    expectedAtlasVersion: 1, rectangles: mappedRectangles,
  }, 'mapped.define'), OWNER_CONTEXT);
  await fixture.studio.execute(ownerCommand('atlas.preview.slices', 8, {
    atlasId: 'atlas.family.2b', expectedAtlasVersion: 2,
    expectedDefinitionFingerprint: mappedDefinition.value.definitionFingerprint,
    jobId: 'job.family.2b.preview.mapped',
  }, 'mapped.preview'), OWNER_CONTEXT);
  assert.equal(await worker.drain(), 1);
  const mappedCommit = await fixture.studio.execute(ownerCommand('atlas.commit.slices', 9, {
    atlasId: 'atlas.family.2b', expectedAtlasVersion: 2,
    expectedDefinitionFingerprint: mappedDefinition.value.definitionFingerprint,
    jobId: 'job.family.2b.preview.mapped',
  }, 'mapped.commit'), OWNER_CONTEXT);
  assert.equal(mappedCommit.value.slices[0].sliceId, firstSlice.sliceId);
  assert.equal(mappedCommit.value.slices[0].version, 2);

  const unmappedDefinition = await fixture.studio.execute(ownerCommand('atlas.define.rects', 10, {
    atlasId: 'atlas.family.2b', sourceId: 'source.family.2b', name: 'Family Hygiene new-identity recut',
    expectedAtlasVersion: 2,
    rectangles: rectangles.map((rectangle, index) => ({ ...rectangle, included: index === 0 })),
  }, 'unmapped.define'), OWNER_CONTEXT);
  await fixture.studio.execute(ownerCommand('atlas.preview.slices', 11, {
    atlasId: 'atlas.family.2b', expectedAtlasVersion: 3,
    expectedDefinitionFingerprint: unmappedDefinition.value.definitionFingerprint,
    jobId: 'job.family.2b.preview.unmapped',
  }, 'unmapped.preview'), OWNER_CONTEXT);
  assert.equal(await worker.drain(), 1);
  const unmappedCommit = await fixture.studio.execute(ownerCommand('atlas.commit.slices', 12, {
    atlasId: 'atlas.family.2b', expectedAtlasVersion: 3,
    expectedDefinitionFingerprint: unmappedDefinition.value.definitionFingerprint,
    jobId: 'job.family.2b.preview.unmapped',
  }, 'unmapped.commit'), OWNER_CONTEXT);
  assert.notEqual(unmappedCommit.value.slices[0].sliceId, firstSlice.sliceId);
  assert.equal(unmappedCommit.value.slices[0].version, 1);

  fixture.projectStore.close();
  fixture.projectStore = await SqliteProjectStore.open({
    filename: join(fixture.directory, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  const restartedJobs = new SqliteJobStore({ workspace: fixture.projectStore.workspace });
  const restartedStudio = new StudioService({
    store: fixture.projectStore,
    jobStore: restartedJobs,
    agentAttemptAuditReady: true,
  });
  const restarted = await restartedStudio.readProjectTrusted(PROJECT_ID);
  assert.equal(restarted.revision, 13);
  assert.equal(restarted.snapshot.atlases[0].sliceHeads.length, 5);
  assert.equal(restarted.snapshot.atlases[0].sliceHeads.find((slice) => slice.sliceId === firstSlice.sliceId).version, 2);
  assert.equal(restartedJobs.get(PROJECT_ID, succeeded.jobId).state, 'APPLIED');
  const integrity = await verifyWorkspaceIntegrity({ projectStore: fixture.projectStore, artifactStore: fixture.cas });
  assert.equal(integrity.ok, true, JSON.stringify(integrity.jobs.findings));
  assert.equal(integrity.jobs.count, 3);

  const backupDirectory = join(fixture.directory, 'backup-2b');
  await createWorkspaceBackup({
    projectStore: fixture.projectStore,
    artifactStore: fixture.cas,
    destinationDirectory: backupDirectory,
  });
  fixture.projectStore.close();
  const restoredDatabase = join(fixture.directory, 'restored', 'studio.sqlite');
  const restoredArtifactsPath = join(fixture.directory, 'restored', 'artifacts');
  await restoreWorkspaceBackup({
    backupDirectory,
    databaseDestination: restoredDatabase,
    artifactDestination: restoredArtifactsPath,
  });
  fixture.projectStore = await SqliteProjectStore.open({
    filename: restoredDatabase,
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  const restoredJobs = new SqliteJobStore({ workspace: fixture.projectStore.workspace });
  assert.equal(restoredJobs.get(PROJECT_ID, succeeded.jobId).state, 'APPLIED');
  const restoredArtifacts = new ContentAddressedArtifactStore({ rootDirectory: restoredArtifactsPath });
  for (const output of succeeded.outputs) assert.equal((await restoredArtifacts.verify(output.digest)).byteSize, output.byteSize);
});

test('preview job creation rolls back with its semantic revision', async (context) => {
  let armed = false;
  const fixture = await approvedFixture(context, {
    faultInjector(point) {
      if (armed && point === 'after_atlas_preview_job_create') throw new Error('2b job atomic fault');
    },
  });
  const defined = await fixture.studio.execute(ownerCommand('atlas.define.rects', 4, {
    atlasId: 'atlas.family.2b', sourceId: 'source.family.2b', name: 'Family Hygiene cuts',
    expectedAtlasVersion: 0, rectangles,
  }, 'atomic.define'), OWNER_CONTEXT);
  armed = true;
  await assert.rejects(fixture.studio.execute(ownerCommand('atlas.preview.slices', 5, {
    atlasId: 'atlas.family.2b', expectedAtlasVersion: 1,
    expectedDefinitionFingerprint: defined.value.definitionFingerprint,
    jobId: 'job.family.2b.atomic',
  }, 'atomic.preview'), OWNER_CONTEXT), /2b job atomic fault/);
  assert.equal((await fixture.studio.readProjectTrusted(PROJECT_ID)).revision, 5);
  assert.equal(fixture.projectStore.workspace.database.prepare('SELECT count(*) AS count FROM jobs').get().count, 0);
});

test('agent preview reserves exact deterministic output bytes once and rejects artifact-budget overrun', async (context) => {
  const expectedBytes = rectangles.reduce((total, rectangle) => total + canonicalRgbaPngByteSize(rectangle.width, rectangle.height), 0);
  const fixture = await approvedFixture(context);
  await issueGrant(fixture.studio, {
    scopes: ['project.read', 'atlas.write', 'project.status.write'],
    expectedVersion: 4,
    budget: { maxCommands: 10, maxJobs: 2, maxArtifactBytes: expectedBytes, maxCostCents: 0 },
  });
  const defined = await fixture.studio.execute(ownerCommand('atlas.define.rects', 5, {
    atlasId: 'atlas.agent-budget', sourceId: 'source.family.2b', name: 'Agent budget atlas',
    expectedAtlasVersion: 0, rectangles,
  }, 'agent-budget.define'), AGENT_CONTEXT);
  const previewCommand = ownerCommand('atlas.preview.slices', 6, {
    atlasId: 'atlas.agent-budget', expectedAtlasVersion: 1,
    expectedDefinitionFingerprint: defined.value.definitionFingerprint,
    jobId: 'job.agent-budget.preview',
  }, 'agent-budget.preview');
  const preview = await fixture.studio.execute(previewCommand, AGENT_CONTEXT);
  assert.equal(preview.value.job.outputArtifactBytes, expectedBytes);
  let grant = (await fixture.studio.readProjectTrusted(PROJECT_ID)).snapshot.grants.find((candidate) => candidate.id === 'grant.atlas');
  assert.equal(grant.usage.jobs, 1);
  assert.equal(grant.usage.artifactBytes, expectedBytes);
  assert.equal((await fixture.studio.execute({ ...previewCommand, commandId: 'cmd.2b.agent-budget.replay' }, AGENT_CONTEXT)).replayed, true);
  grant = (await fixture.studio.readProjectTrusted(PROJECT_ID)).snapshot.grants.find((candidate) => candidate.id === 'grant.atlas');
  assert.equal(grant.usage.jobs, 1);
  assert.equal(grant.usage.artifactBytes, expectedBytes);

  const overrun = await approvedFixture(context);
  await issueGrant(overrun.studio, {
    scopes: ['project.read', 'atlas.write', 'project.status.write'], expectedVersion: 4,
    budget: { maxCommands: 10, maxJobs: 2, maxArtifactBytes: expectedBytes - 1, maxCostCents: 0 },
  });
  const overrunDefined = await overrun.studio.execute(ownerCommand('atlas.define.rects', 5, {
    atlasId: 'atlas.agent-overrun', sourceId: 'source.family.2b', name: 'Agent overrun atlas',
    expectedAtlasVersion: 0, rectangles,
  }, 'agent-overrun.define'), AGENT_CONTEXT);
  await assert.rejects(overrun.studio.execute(ownerCommand('atlas.preview.slices', 6, {
    atlasId: 'atlas.agent-overrun', expectedAtlasVersion: 1,
    expectedDefinitionFingerprint: overrunDefined.value.definitionFingerprint,
    jobId: 'job.agent-overrun.preview',
  }, 'agent-overrun.preview'), AGENT_CONTEXT), (error) => error.code === 'BUDGET_EXCEEDED');
  assert.equal((await overrun.studio.readProjectTrusted(PROJECT_ID)).revision, 6);
  assert.equal(overrun.projectStore.workspace.database.prepare('SELECT count(*) AS count FROM jobs').get().count, 0);
});

test('slice promotion, APPLIED state, and semantic revision roll back together', async (context) => {
  let armed = false;
  const fixture = await approvedFixture(context, {
    faultInjector(point) {
      if (armed && point === 'after_atlas_preview_job_apply') throw new Error('2b apply atomic fault');
    },
  });
  const defined = await fixture.studio.execute(ownerCommand('atlas.define.rects', 4, {
    atlasId: 'atlas.family.2b', sourceId: 'source.family.2b', name: 'Family Hygiene cuts',
    expectedAtlasVersion: 0, rectangles,
  }, 'apply-atomic.define'), OWNER_CONTEXT);
  const jobId = 'job.family.2b.apply-atomic';
  await fixture.studio.execute(ownerCommand('atlas.preview.slices', 5, {
    atlasId: 'atlas.family.2b', expectedAtlasVersion: 1,
    expectedDefinitionFingerprint: defined.value.definitionFingerprint,
    jobId,
  }, 'apply-atomic.preview'), OWNER_CONTEXT);
  const worker = new AtlasPreviewWorker({
    jobStore: fixture.jobs,
    artifactStore: fixture.cas,
    artifactMetadataStore: new SqliteArtifactMetadataStore({ workspace: fixture.projectStore.workspace }),
    workerId: 'worker.test.2b.apply-atomic',
  });
  assert.equal(await worker.drain(), 1);
  assert.equal(fixture.jobs.get(PROJECT_ID, jobId).state, 'SUCCEEDED');

  const commit = ownerCommand('atlas.commit.slices', 6, {
    atlasId: 'atlas.family.2b', expectedAtlasVersion: 1,
    expectedDefinitionFingerprint: defined.value.definitionFingerprint,
    jobId,
  }, 'apply-atomic.commit');
  armed = true;
  await assert.rejects(fixture.studio.execute(commit, OWNER_CONTEXT), /2b apply atomic fault/);
  assert.equal((await fixture.studio.readProjectTrusted(PROJECT_ID)).revision, 6);
  assert.equal(fixture.jobs.get(PROJECT_ID, jobId).state, 'SUCCEEDED');
  assert.equal(fixture.projectStore.workspace.database.prepare(`
    SELECT count(*) AS count FROM artifact_references
    WHERE project_id = ? AND owner_kind = 'job_output' AND owner_id = ?
  `).get(PROJECT_ID, jobId).count, 4);
  assert.equal(fixture.projectStore.workspace.database.prepare(`
    SELECT count(*) AS count FROM artifact_references
    WHERE project_id = ? AND owner_kind = 'atlas_slice'
  `).get(PROJECT_ID).count, 0);

  armed = false;
  const applied = await fixture.studio.execute(commit, OWNER_CONTEXT);
  assert.equal(applied.revision, 7);
  assert.equal(fixture.jobs.get(PROJECT_ID, jobId).state, 'APPLIED');
  assert.equal(fixture.projectStore.workspace.database.prepare(`
    SELECT count(*) AS count FROM artifact_references
    WHERE project_id = ? AND owner_kind = 'job_output'
  `).get(PROJECT_ID).count, 0);
  assert.equal(fixture.projectStore.workspace.database.prepare(`
    SELECT count(*) AS count FROM artifact_references
    WHERE project_id = ? AND owner_kind = 'atlas_slice'
  `).get(PROJECT_ID).count, 4);
});

test('cancel, retry, and discard remain observable while released previews pass integrity and backup restore', async (context) => {
  const fixture = await approvedFixture(context);
  const defined = await fixture.studio.execute(ownerCommand('atlas.define.rects', 4, {
    atlasId: 'atlas.discard.2b', sourceId: 'source.family.2b', name: 'Discard lifecycle atlas',
    expectedAtlasVersion: 0, rectangles,
  }, 'discard.define'), OWNER_CONTEXT);
  await fixture.studio.execute(ownerCommand('atlas.preview.slices', 5, {
    atlasId: 'atlas.discard.2b', expectedAtlasVersion: 1,
    expectedDefinitionFingerprint: defined.value.definitionFingerprint,
    jobId: 'job.discard.cancelled',
  }, 'discard.cancelled.preview'), OWNER_CONTEXT);
  const cancelled = await fixture.studio.cancelJob({
    schemaVersion: 1, projectId: PROJECT_ID, jobId: 'job.discard.cancelled',
    operationIdempotencyKey: 'job.discard.cancelled.cancel.1',
  }, OWNER_CONTEXT);
  assert.equal(cancelled.job.state, 'CANCELLED');
  const retried = await fixture.studio.retryJob({
    schemaVersion: 1, projectId: PROJECT_ID, jobId: 'job.discard.cancelled', expectedAttempt: 1,
    operationIdempotencyKey: 'job.discard.cancelled.retry.1',
  }, OWNER_CONTEXT);
  assert.equal(retried.job.state, 'QUEUED');
  await fixture.studio.cancelJob({
    schemaVersion: 1, projectId: PROJECT_ID, jobId: 'job.discard.cancelled',
    operationIdempotencyKey: 'job.discard.cancelled.cancel.2',
  }, OWNER_CONTEXT);
  const discardedCancelled = await fixture.studio.discardJob({
    schemaVersion: 1, projectId: PROJECT_ID, jobId: 'job.discard.cancelled',
    operationIdempotencyKey: 'job.discard.cancelled.discard',
  }, OWNER_CONTEXT);
  assert.equal(discardedCancelled.job.state, 'DISCARDED');
  assert.deepEqual(discardedCancelled.events.map((event) => event.type), [
    'QUEUED', 'CANCELLED', 'RETRIED', 'CANCELLED', 'DISCARDED',
  ]);
  assert.ok(discardedCancelled.events.every((event) => !Object.hasOwn(event, 'operationIdempotencyKey')));
  assert.doesNotMatch(JSON.stringify(discardedCancelled), /job\.discard\.cancelled\.(?:cancel|retry|discard)|lease_owner|grantId/);

  await fixture.studio.execute(ownerCommand('atlas.preview.slices', 6, {
    atlasId: 'atlas.discard.2b', expectedAtlasVersion: 1,
    expectedDefinitionFingerprint: defined.value.definitionFingerprint,
    jobId: 'job.discard.succeeded',
  }, 'discard.succeeded.preview'), OWNER_CONTEXT);
  const worker = new AtlasPreviewWorker({
    jobStore: fixture.jobs,
    artifactStore: fixture.cas,
    artifactMetadataStore: new SqliteArtifactMetadataStore({ workspace: fixture.projectStore.workspace }),
    workerId: 'worker.test.2b.discard',
  });
  assert.equal(await worker.drain(), 1);
  const succeeded = fixture.jobs.get(PROJECT_ID, 'job.discard.succeeded');
  assert.equal(succeeded.state, 'SUCCEEDED');
  assert.equal(succeeded.outputs.length, 4);
  const discarded = await fixture.studio.discardJob({
    schemaVersion: 1, projectId: PROJECT_ID, jobId: succeeded.jobId,
    operationIdempotencyKey: 'job.discard.succeeded.discard',
  }, OWNER_CONTEXT);
  assert.equal(discarded.job.state, 'DISCARDED');
  assert.equal(discarded.job.outputs.length, 4);
  assert.ok(discarded.job.outputs.every((output) => output.preview.state === 'MISSING'));
  assert.equal(fixture.projectStore.workspace.database.prepare(`
    SELECT count(*) AS count FROM artifact_references
    WHERE project_id = ? AND owner_kind = 'job_output'
  `).get(PROJECT_ID).count, 0);
  assert.equal((await verifyWorkspaceIntegrity({ projectStore: fixture.projectStore, artifactStore: fixture.cas })).ok, true);

  const backupDirectory = join(fixture.directory, 'backup-discarded-2b');
  await createWorkspaceBackup({
    projectStore: fixture.projectStore, artifactStore: fixture.cas, destinationDirectory: backupDirectory,
  });
  assert.equal((await verifyWorkspaceBackup(backupDirectory)).ok, true);
  const restoredDatabase = join(fixture.directory, 'restored-discarded', 'studio.sqlite');
  const restoredArtifactsPath = join(fixture.directory, 'restored-discarded', 'artifacts');
  await restoreWorkspaceBackup({
    backupDirectory, databaseDestination: restoredDatabase, artifactDestination: restoredArtifactsPath,
  });
  const restoredStore = await SqliteProjectStore.open({ filename: restoredDatabase, databaseFactory: nodeSqliteDatabaseFactory });
  try {
    const restoredJobs = new SqliteJobStore({ workspace: restoredStore.workspace });
    const restoredDiscarded = restoredJobs.get(PROJECT_ID, succeeded.jobId);
    assert.equal(restoredDiscarded.state, 'DISCARDED');
    assert.equal(restoredDiscarded.outputs.length, 4);
    assert.equal((await verifyWorkspaceIntegrity({
      projectStore: restoredStore,
      artifactStore: new ContentAddressedArtifactStore({ rootDirectory: restoredArtifactsPath }),
    })).ok, true);
  } finally {
    restoredStore.close();
  }
});

test('backup copies references from its SQLite snapshot across a concurrent preview discard', async (context) => {
  const fixture = await approvedFixture(context);
  const defined = await fixture.studio.execute(ownerCommand('atlas.define.rects', 4, {
    atlasId: 'atlas.backup-race.2b', sourceId: 'source.family.2b', name: 'Backup race atlas',
    expectedAtlasVersion: 0, rectangles,
  }, 'backup-race.define'), OWNER_CONTEXT);
  await fixture.studio.execute(ownerCommand('atlas.preview.slices', 5, {
    atlasId: 'atlas.backup-race.2b', expectedAtlasVersion: 1,
    expectedDefinitionFingerprint: defined.value.definitionFingerprint,
    jobId: 'job.backup-race.succeeded',
  }, 'backup-race.preview'), OWNER_CONTEXT);
  const worker = new AtlasPreviewWorker({
    jobStore: fixture.jobs,
    artifactStore: fixture.cas,
    artifactMetadataStore: new SqliteArtifactMetadataStore({ workspace: fixture.projectStore.workspace }),
    workerId: 'worker.test.2b.backup-race',
  });
  assert.equal(await worker.drain(), 1);
  const originalBackupTo = fixture.projectStore.backupTo.bind(fixture.projectStore);
  fixture.projectStore.backupTo = async (destination) => {
    const snapshot = await originalBackupTo(destination);
    await fixture.studio.discardJob({
      schemaVersion: 1, projectId: PROJECT_ID, jobId: 'job.backup-race.succeeded',
      operationIdempotencyKey: 'job.backup-race.discard-after-snapshot',
    }, OWNER_CONTEXT);
    return snapshot;
  };
  const backupDirectory = join(fixture.directory, 'backup-race-2b');
  await createWorkspaceBackup({
    projectStore: fixture.projectStore, artifactStore: fixture.cas, destinationDirectory: backupDirectory,
  });
  assert.equal(fixture.jobs.get(PROJECT_ID, 'job.backup-race.succeeded').state, 'DISCARDED');
  assert.equal((await verifyWorkspaceBackup(backupDirectory)).ok, true);

  const restoredDatabase = join(fixture.directory, 'restored-backup-race', 'studio.sqlite');
  const restoredArtifactsPath = join(fixture.directory, 'restored-backup-race', 'artifacts');
  await restoreWorkspaceBackup({
    backupDirectory, databaseDestination: restoredDatabase, artifactDestination: restoredArtifactsPath,
  });
  const restoredStore = await SqliteProjectStore.open({ filename: restoredDatabase, databaseFactory: nodeSqliteDatabaseFactory });
  try {
    const restoredJobs = new SqliteJobStore({ workspace: restoredStore.workspace });
    assert.equal(restoredJobs.get(PROJECT_ID, 'job.backup-race.succeeded').state, 'SUCCEEDED');
    assert.equal((await verifyWorkspaceIntegrity({
      projectStore: restoredStore,
      artifactStore: new ContentAddressedArtifactStore({ rootDirectory: restoredArtifactsPath }),
    })).ok, true);
  } finally {
    restoredStore.close();
  }
});

test('slice commit rejects tampered durable output and LIVE artifact metadata without partial promotion', async (context) => {
  const fixture = await approvedFixture(context);
  const defined = await fixture.studio.execute(ownerCommand('atlas.define.rects', 4, {
    atlasId: 'atlas.tamper.2b', sourceId: 'source.family.2b', name: 'Tamper boundary atlas',
    expectedAtlasVersion: 0, rectangles,
  }, 'tamper.define'), OWNER_CONTEXT);
  const jobId = 'job.tamper.succeeded';
  await fixture.studio.execute(ownerCommand('atlas.preview.slices', 5, {
    atlasId: 'atlas.tamper.2b', expectedAtlasVersion: 1,
    expectedDefinitionFingerprint: defined.value.definitionFingerprint, jobId,
  }, 'tamper.preview'), OWNER_CONTEXT);
  const worker = new AtlasPreviewWorker({
    jobStore: fixture.jobs,
    artifactStore: fixture.cas,
    artifactMetadataStore: new SqliteArtifactMetadataStore({ workspace: fixture.projectStore.workspace }),
    workerId: 'worker.test.2b.tamper',
  });
  assert.equal(await worker.drain(), 1);
  const original = fixture.jobs.get(PROJECT_ID, jobId);
  const commit = ownerCommand('atlas.commit.slices', 6, {
    atlasId: 'atlas.tamper.2b', expectedAtlasVersion: 1,
    expectedDefinitionFingerprint: defined.value.definitionFingerprint, jobId,
  }, 'tamper.commit');

  const tamperedOutputs = structuredClone(original.outputs);
  tamperedOutputs[0].byteSize -= 1;
  fixture.projectStore.workspace.database.prepare(`
    UPDATE jobs SET output_json = ? WHERE project_id = ? AND job_id = ?
  `).run(JSON.stringify(tamperedOutputs), PROJECT_ID, jobId);
  await assert.rejects(fixture.studio.execute(commit, OWNER_CONTEXT), (error) => error.code === 'JOB_OUTPUT_MISMATCH');
  assert.equal((await fixture.studio.readProjectTrusted(PROJECT_ID)).revision, 6);
  assert.equal(fixture.jobs.get(PROJECT_ID, jobId).state, 'SUCCEEDED');
  fixture.projectStore.workspace.database.prepare(`
    UPDATE jobs SET output_json = ? WHERE project_id = ? AND job_id = ?
  `).run(JSON.stringify(original.outputs), PROJECT_ID, jobId);

  const integrityTamperCases = [
    {
      label: 'renamed-rectangle',
      outputs: original.outputs.map((output, index) => (
        index === 0 ? { ...output, rectangleId: 'rect.tampered.rename' } : output
      )),
      outputArtifactBytes: original.outputArtifactBytes,
    },
    {
      label: 'changed-dimension',
      outputs: original.outputs.map((output, index) => (
        index === 0 ? { ...output, width: output.width + 1 } : output
      )),
      outputArtifactBytes: original.outputArtifactBytes,
    },
    {
      label: 'changed-reserved-total',
      outputs: original.outputs,
      outputArtifactBytes: original.outputArtifactBytes - 1,
    },
  ];
  for (const tamper of integrityTamperCases) {
    fixture.projectStore.workspace.database.prepare(`
      UPDATE jobs SET output_json = ?, output_artifact_bytes = ?
      WHERE project_id = ? AND job_id = ?
    `).run(JSON.stringify(tamper.outputs), tamper.outputArtifactBytes, PROJECT_ID, jobId);
    const integrity = await verifyWorkspaceIntegrity({ projectStore: fixture.projectStore, artifactStore: fixture.cas });
    assert.equal(integrity.ok, false, tamper.label);
    assert.ok(integrity.jobs.findings.some((finding) => finding.code === 'JOB_OUTPUT_SEMANTIC_MISMATCH'), tamper.label);
    await assert.rejects(createWorkspaceBackup({
      projectStore: fixture.projectStore,
      artifactStore: fixture.cas,
      destinationDirectory: join(fixture.directory, `backup-reject-${tamper.label}`),
    }), (error) => error.code === 'BACKUP_SOURCE_INTEGRITY_FAILED');
  }
  fixture.projectStore.workspace.database.prepare(`
    UPDATE jobs SET output_json = ?, output_artifact_bytes = ?
    WHERE project_id = ? AND job_id = ?
  `).run(JSON.stringify(original.outputs), original.outputArtifactBytes, PROJECT_ID, jobId);

  fixture.projectStore.workspace.database.prepare(`
    UPDATE artifacts SET byte_size = byte_size - 1 WHERE digest = ?
  `).run(original.outputs[0].digest);
  await assert.rejects(fixture.studio.execute(commit, OWNER_CONTEXT), (error) => error.code === 'ARTIFACT_NOT_LIVE');
  assert.equal((await fixture.studio.readProjectTrusted(PROJECT_ID)).revision, 6);
  assert.equal(fixture.jobs.get(PROJECT_ID, jobId).state, 'SUCCEEDED');
  assert.equal(fixture.projectStore.workspace.database.prepare(`
    SELECT count(*) AS count FROM artifact_references
    WHERE project_id = ? AND owner_kind = 'atlas_slice'
  `).get(PROJECT_ID).count, 0);
  assert.equal(fixture.projectStore.workspace.database.prepare(`
    SELECT count(*) AS count FROM artifact_references
    WHERE project_id = ? AND owner_kind = 'job_output' AND owner_id = ?
  `).get(PROJECT_ID, jobId).count, 4);
  fixture.projectStore.workspace.database.prepare(`
    UPDATE artifacts SET byte_size = ? WHERE digest = ?
  `).run(original.outputs[0].byteSize, original.outputs[0].digest);
  assert.equal((await verifyWorkspaceIntegrity({ projectStore: fixture.projectStore, artifactStore: fixture.cas })).ok, true);
});

test('worker stop awaits its in-flight crop and persists only sanitized unexpected failures', async (context) => {
  const fixture = await approvedFixture(context);
  const defined = await fixture.studio.execute(ownerCommand('atlas.define.rects', 4, {
    atlasId: 'atlas.shutdown.2b', sourceId: 'source.family.2b', name: 'Shutdown boundary atlas',
    expectedAtlasVersion: 0, rectangles,
  }, 'shutdown.define'), OWNER_CONTEXT);
  const jobId = 'job.shutdown.in-flight';
  await fixture.studio.execute(ownerCommand('atlas.preview.slices', 5, {
    atlasId: 'atlas.shutdown.2b', expectedAtlasVersion: 1,
    expectedDefinitionFingerprint: defined.value.definitionFingerprint, jobId,
  }, 'shutdown.preview'), OWNER_CONTEXT);
  let releaseRead;
  let announceRead;
  const readStarted = new Promise((resolveStarted) => { announceRead = resolveStarted; });
  const readReleased = new Promise((resolveReleased) => { releaseRead = resolveReleased; });
  const delayedArtifactStore = {
    async createReadStream(digest) {
      announceRead();
      await readReleased;
      return fixture.cas.createReadStream(digest);
    },
    ingest: fixture.cas.ingest.bind(fixture.cas),
  };
  const worker = new AtlasPreviewWorker({
    jobStore: fixture.jobs,
    artifactStore: delayedArtifactStore,
    artifactMetadataStore: new SqliteArtifactMetadataStore({ workspace: fixture.projectStore.workspace }),
    workerId: 'worker.test.2b.shutdown',
  });
  const running = worker.kick();
  await readStarted;
  let stopped = false;
  const stopping = worker.stop().then(() => { stopped = true; });
  await Promise.resolve();
  assert.equal(stopped, false);
  assert.equal(fixture.jobs.get(PROJECT_ID, jobId).state, 'RUNNING');
  releaseRead();
  await Promise.all([running, stopping]);
  assert.equal(stopped, true);
  assert.equal(fixture.jobs.get(PROJECT_ID, jobId).state, 'SUCCEEDED');

  await fixture.studio.discardJob({
    schemaVersion: 1, projectId: PROJECT_ID, jobId,
    operationIdempotencyKey: 'job.shutdown.discard',
  }, OWNER_CONTEXT);
  await fixture.studio.execute(ownerCommand('atlas.preview.slices', 6, {
    atlasId: 'atlas.shutdown.2b', expectedAtlasVersion: 1,
    expectedDefinitionFingerprint: defined.value.definitionFingerprint,
    jobId: 'job.shutdown.sanitized-failure',
  }, 'shutdown.failure.preview'), OWNER_CONTEXT);
  const sentinel = '/private/cas/root/credential-token';
  const failingWorker = new AtlasPreviewWorker({
    jobStore: fixture.jobs,
    artifactStore: {
      async createReadStream() { throw new Error(sentinel); },
      ingest: fixture.cas.ingest.bind(fixture.cas),
    },
    artifactMetadataStore: new SqliteArtifactMetadataStore({ workspace: fixture.projectStore.workspace }),
    workerId: 'worker.test.2b.failure',
  });
  assert.equal(await failingWorker.drain(), 1);
  const failed = fixture.jobs.get(PROJECT_ID, 'job.shutdown.sanitized-failure');
  assert.equal(failed.state, 'FAILED');
  assert.deepEqual(failed.error, { code: 'ATLAS_PREVIEW_FAILED', message: 'Atlas preview processing failed.' });
  assert.doesNotMatch(JSON.stringify({ job: failed, events: fixture.jobs.listEvents(PROJECT_ID, failed.jobId) }), new RegExp(sentinel));
});
