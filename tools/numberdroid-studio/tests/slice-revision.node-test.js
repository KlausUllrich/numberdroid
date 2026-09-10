import test from 'node:test';
import assert from 'node:assert/strict';
import { assemblyFixture, projectId, owner } from './assembly-test-helpers.js';
import { SqliteJobStore, SqliteArtifactMetadataStore, verifyWorkspaceIntegrity } from '../packages/persistence/src/index.js';
import { AtlasPreviewWorker } from '../apps/studio-server/src/atlas-preview-worker.js';
import { resolveHistoricalSliceBinding } from '../packages/application/src/exact-cut-history.js';
import { validateSliceRevisionJobInput } from '../packages/application/src/slice-revision-service.js';

async function drain(f) {
  const worker = new AtlasPreviewWorker({ jobStore: new SqliteJobStore({ workspace: f.store.workspace }), artifactStore: f.artifacts,
    artifactMetadataStore: new SqliteArtifactMetadataStore({ workspace: f.store.workspace }), workerId: 'worker.cut-revision' });
  try { return await worker.drain(); } finally { await worker.stop(); }
}
async function setup(t) {
  const f = await assemblyFixture(t);
  const rectangles = [
    { rectangleId: 'rect.fixture', name: 'Left cut', x: 0, y: 0, width: 8, height: 16, included: true, pivot: null, transparentPaddingPolicy: 'preserve_exact_rect', replacesSliceId: f.slice.sliceId, expectedSliceVersion: 1 },
    { rectangleId: 'rect.other', name: 'Other cut', x: 8, y: 0, width: 8, height: 16, included: true, pivot: null, transparentPaddingPolicy: 'preserve_exact_rect', replacesSliceId: null, expectedSliceVersion: null },
  ];
  const def = await f.execute('atlas.define.rects', { atlasId: 'atlas.fixture', sourceId: 'source.fixture', name: 'Two cuts', expectedAtlasVersion: 1, rectangles });
  const input = { atlasId: 'atlas.fixture', expectedAtlasVersion: 2, expectedDefinitionFingerprint: def.value.definitionFingerprint, jobId: 'job.second' };
  await f.execute('atlas.preview.slices', input); await drain(f); await f.execute('atlas.commit.slices', input);
  const payload = { sliceId: f.slice.sliceId, sourceSliceVersion: 2, expectedSliceVersion: 2, expectedAtlasVersion: 2,
    jobId: 'job.revision', name: 'Trimmed left', rectangle: { x: 1, y: 0, width: 7, height: 16 } };
  return { f, payload };
}
const atlas = project => project.snapshot.atlases[0];

test('one-cut prepare and commit preserve unrelated definitions and pins; exact replay and restart remain truthful', async t => {
  const { f, payload } = await setup(t);
  const before = await f.studio.readProjectTrusted(projectId);
  assert.equal(f.store.schemaVersion, 17);
  const req = await f.request('slice.revision.prepare', payload);
  const prepared = await f.studio.execute(req, owner);
  assert.equal(prepared.value.status, 'ACCEPTED');
  assert.deepEqual(atlas(await f.studio.readProjectTrusted(projectId)), atlas(before));
  assert.equal(prepared.value.job.input.schemaVersion, 2);
  assert.equal(prepared.value.job.input.rectangles.length, 1);
  assert.equal((await f.studio.execute(req, owner)).replayed, true);
  await drain(f);
  const jobs = new SqliteJobStore({ workspace: f.store.workspace });
  assert.equal(jobs.get(projectId, payload.jobId).state, 'SUCCEEDED');
  const commit = await f.request('slice.revision.commit', { sliceId: payload.sliceId, expectedSliceVersion: 2, expectedAtlasVersion: 2, jobId: payload.jobId });
  const saved = await f.studio.execute(commit, owner);
  assert.equal(saved.value.sliceBinding.sliceVersion, 3);
  const after = await f.studio.readProjectTrusted(projectId);
  assert.deepEqual(atlas(after).rectangles[1], atlas(before).rectangles[1]);
  assert.deepEqual(atlas(after).sliceHeads[1], atlas(before).sliceHeads[1]);
  assert.equal(atlas(after).latestPreviewJobId, atlas(before).latestPreviewJobId);
  assert.equal(atlas(after).definitionVersion, 3);
  assert.equal((await f.studio.execute(commit, owner)).replayed, true);
  const document = await f.store.loadProject(projectId);
  assert.equal(resolveHistoricalSliceBinding(document, projectId, payload.sliceId, 1).width, 16);
  assert.equal(resolveHistoricalSliceBinding(document, projectId, payload.sliceId, 2).width, 8);
  assert.equal(resolveHistoricalSliceBinding(document, projectId, payload.sliceId, 3).width, 7);
  await f.restart();
  assert.deepEqual(atlas(await f.studio.readProjectTrusted(projectId)), atlas(after));
  const integrity = await verifyWorkspaceIntegrity({ projectStore: f.store, artifactStore: f.artifacts });
  assert.equal(integrity.ok, true, JSON.stringify(integrity));
});

test('matching historical cut reuse has no job or pixel mutation and preserves exact old version', async t => {
  const { f, payload } = await setup(t);
  const before = await f.studio.readProjectTrusted(projectId);
  const jobsBefore = f.store.workspace.database.prepare('SELECT count(*) AS n FROM jobs').get().n;
  const request = await f.request('slice.revision.prepare', { ...payload, sourceSliceVersion: 1, name: 'Cut 1', rectangle: { x: 0, y: 0, width: 16, height: 16 } });
  const receipt = await f.studio.execute(request, owner);
  assert.equal(receipt.value.status, 'REUSED'); assert.equal(receipt.value.sliceBinding.sliceVersion, 1); assert.equal(receipt.value.jobId, null);
  assert.deepEqual(atlas(await f.studio.readProjectTrusted(projectId)), atlas(before));
  assert.equal(f.store.workspace.database.prepare('SELECT count(*) AS n FROM jobs').get().n, jobsBefore);
  assert.equal((await f.studio.execute(request, owner)).replayed, true);
});

test('cut transaction faults roll back job application, cut binding, references and project revision', async t => {
  const { f, payload } = await setup(t);
  await f.execute('slice.revision.prepare', payload); await drain(f);
  const request = await f.request('slice.revision.commit', { sliceId: payload.sliceId, expectedSliceVersion: 2, expectedAtlasVersion: 2, jobId: payload.jobId });
  const before = await f.studio.readProjectTrusted(projectId);
  f.fault('after_atlas_preview_job_apply');
  await assert.rejects(f.studio.execute(request, owner), /injected/);
  assert.deepEqual(await f.studio.readProjectTrusted(projectId), before);
  assert.equal(new SqliteJobStore({ workspace: f.store.workspace }).get(projectId, payload.jobId).state, 'SUCCEEDED');
  assert.equal(f.store.workspace.database.prepare('SELECT count(*) AS n FROM asset_slice_bindings WHERE slice_version=3').get().n, 0);
  f.fault(null); await f.studio.execute(request, owner);
  assert.equal(new SqliteJobStore({ workspace: f.store.workspace }).get(projectId, payload.jobId).state, 'APPLIED');
});

test('ordinary pending preview, changed atlas and unsupported input cannot redirect one-cut jobs', async t => {
  const { f, payload } = await setup(t);
  const before = await f.studio.readProjectTrusted(projectId);
  const ordinary = { atlasId: 'atlas.fixture', expectedAtlasVersion: 2, expectedDefinitionFingerprint: atlas(before).definitionFingerprint, jobId: 'job.pending.ordinary' };
  await f.execute('atlas.preview.slices', ordinary);
  await assert.rejects(f.execute('slice.revision.prepare', payload), error => error.code === 'JOB_STATE_CONFLICT');
  await drain(f);
  new SqliteJobStore({ workspace: f.store.workspace }).discard(projectId, ordinary.jobId, { operationIdempotencyKey: 'discard.ordinary' });
  const prepared = await f.execute('slice.revision.prepare', payload);
  const invalid = structuredClone(prepared.value.job.input); invalid.revision.proposedDefinition.rectangles[1].name = 'Unexpected overwrite';
  assert.throws(() => validateSliceRevisionJobInput(invalid), error => error.code === 'JOB_INPUT_MISMATCH');
  await drain(f);
  const head = atlas(await f.studio.readProjectTrusted(projectId));
  await f.execute('atlas.define.rects', { atlasId: head.id, sourceId: head.sourceId, name: head.name, expectedAtlasVersion: head.definitionVersion,
    rectangles: head.rectangles.map(rect => ({ ...rect, replacesSliceId: null, expectedSliceVersion: null })) });
  await assert.rejects(f.execute('slice.revision.commit', { sliceId: payload.sliceId, expectedSliceVersion: 2, expectedAtlasVersion: 3, jobId: payload.jobId }), error => error.code === 'ENTITY_VERSION_CONFLICT');
});


test('agent cut grants charge only actual jobs and cannot cross creator authority or survive revocation', async t => {
  const { f, payload } = await setup(t);
  const agent = { actor: { id: 'agent.cut', kind: 'agent', displayName: 'Cut agent' }, taskId: 'task.cut', grantId: 'grant.cut', branchId: 'branch.main' };
  await f.execute('grant.issue', { grantId: agent.grantId, agentId: agent.actor.id, taskId: agent.taskId, branchId: agent.branchId,
    scopes: ['project.read', 'slice.revision.prepare', 'slice.revision.commit'], objectScopes: [{ kind: 'project', id: projectId }],
    budget: { maxCommands: 20, maxJobs: 1, maxArtifactBytes: 10000 }, expiresAt: null });
  const reused = await f.execute('slice.revision.prepare', { ...payload, sourceSliceVersion: 1, name: 'Cut 1', rectangle: { x: 0, y: 0, width: 16, height: 16 } }, agent);
  assert.equal(reused.value.status, 'REUSED');
  let grant = (await f.studio.readProjectTrusted(projectId)).snapshot.grants[0];
  assert.equal(grant.usage.jobs, 0); assert.equal(grant.usage.artifactBytes, 0);
  const request = await f.request('slice.revision.prepare', payload);
  await f.studio.execute(request, agent);
  grant = (await f.studio.readProjectTrusted(projectId)).snapshot.grants[0];
  assert.equal(grant.usage.jobs, 1); assert.equal(grant.usage.commands, 2);
  await f.studio.execute(request, agent);
  assert.deepEqual((await f.studio.readProjectTrusted(projectId)).snapshot.grants[0].usage, grant.usage);
  await drain(f);
  assert.equal(new SqliteJobStore({ workspace: f.store.workspace }).get(projectId, payload.jobId).state, 'SUCCEEDED');
  const other = { actor: { id: 'agent.other', kind: 'agent', displayName: 'Other agent' }, taskId: 'task.other', grantId: 'grant.other', branchId: 'branch.main' };
  await f.execute('grant.issue', { grantId: other.grantId, agentId: other.actor.id, taskId: other.taskId, branchId: other.branchId,
    scopes: ['slice.revision.commit'], objectScopes: [{ kind: 'project', id: projectId }], budget: { maxCommands: 20, maxJobs: 0, maxArtifactBytes: 0 }, expiresAt: null });
  const commit = { sliceId: payload.sliceId, expectedSliceVersion: 2, expectedAtlasVersion: 2, jobId: payload.jobId };
  await assert.rejects(f.execute('slice.revision.commit', commit, other), error => error.code === 'JOB_AUTHORITY_MISMATCH');
  await f.execute('grant.revoke', { grantId: agent.grantId, reason: 'Stop this test grant' });
  await assert.rejects(f.execute('slice.revision.commit', commit, agent), error => error.code === 'GRANT_REVOKED');
  await f.execute('slice.revision.commit', commit);
  const integrity = await verifyWorkspaceIntegrity({ projectStore: f.store, artifactStore: f.artifacts });
  assert.equal(integrity.ok, true, JSON.stringify(integrity));
});

test('cut command provenance and preserved unrelated rectangles are integrity checked independently of mutable JSON type', async t => {
  const { f, payload } = await setup(t);
  const prepared = await f.execute('slice.revision.prepare', payload);
  const db = f.store.workspace.database;
  const original = db.prepare('SELECT revision_json FROM revisions WHERE project_id=? AND revision_number=?').get(projectId, prepared.revision).revision_json;
  const corrupted = JSON.parse(original); corrupted.command.type = 'task.create';
  db.prepare('UPDATE revisions SET revision_json=? WHERE project_id=? AND revision_number=?').run(JSON.stringify(corrupted), projectId, prepared.revision);
  const integrity = await verifyWorkspaceIntegrity({ projectStore: f.store, artifactStore: f.artifacts });
  assert.equal(integrity.ok, false); assert.equal(integrity.sliceRevisions.ok, false);
  assert.ok(integrity.sliceRevisions.findings.some(finding => finding.code === 'SLICE_REVISION_COMMAND_MISMATCH'));
});


test('queued cut jobs survive restart, cancellation and idempotent retry without touching the atlas', async t => {
  const { f, payload } = await setup(t);
  const before = atlas(await f.studio.readProjectTrusted(projectId));
  const prepared = await f.execute('slice.revision.prepare', payload);
  await f.restart();
  let jobs = new SqliteJobStore({ workspace: f.store.workspace });
  assert.equal(jobs.get(projectId, payload.jobId).state, 'QUEUED');
  jobs.requestCancel(projectId, payload.jobId, { operationIdempotencyKey: 'cancel.cut' });
  assert.equal(jobs.get(projectId, payload.jobId).state, 'CANCELLED');
  const options = { expectedAttempt: 1, operationIdempotencyKey: 'retry.cut' };
  jobs.retry(projectId, payload.jobId, options);
  assert.equal(jobs.retry(projectId, payload.jobId, options).replayed, true);
  await f.restart(); jobs = new SqliteJobStore({ workspace: f.store.workspace });
  await drain(f);
  const job = jobs.get(projectId, payload.jobId);
  assert.equal(job.state, 'SUCCEEDED'); assert.equal(job.attempt, 2);
  assert.equal(job.outputArtifactBytes, prepared.value.job.outputArtifactBytes);
  assert.deepEqual(atlas(await f.studio.readProjectTrusted(projectId)), before);
  await f.execute('slice.revision.commit', { sliceId: payload.sliceId, expectedSliceVersion: 2, expectedAtlasVersion: 2, jobId: payload.jobId });
  const integrity = await verifyWorkspaceIntegrity({ projectStore: f.store, artifactStore: f.artifacts });
  assert.equal(integrity.ok, true, JSON.stringify(integrity));
});

test('invalid crop and exhausted job budget do not save revisions', async t => {
  const { f, payload } = await setup(t);
  const before = await f.studio.readProjectTrusted(projectId);
  await assert.rejects(f.execute('slice.revision.prepare', { ...payload, rectangle: { x: 1, y: 0, width: 100, height: 16 } }), error => error.code === 'ATLAS_RECT_OUT_OF_BOUNDS');
  assert.deepEqual(await f.studio.readProjectTrusted(projectId), before);
  const agent = { actor: { id: 'agent.zero', kind: 'agent', displayName: 'No job agent' }, taskId: 'task.zero', grantId: 'grant.zero', branchId: 'branch.main' };
  await f.execute('grant.issue', { grantId: agent.grantId, agentId: agent.actor.id, taskId: agent.taskId, branchId: agent.branchId,
    scopes: ['slice.revision.prepare'], objectScopes: [{ kind: 'project', id: projectId }], budget: { maxCommands: 10, maxJobs: 0, maxArtifactBytes: 0 }, expiresAt: null });
  const granted = await f.studio.readProjectTrusted(projectId);
  await assert.rejects(f.execute('slice.revision.prepare', payload, agent), error => error.code === 'BUDGET_EXCEEDED');
  assert.deepEqual(await f.studio.readProjectTrusted(projectId), granted);
  const reuse = await f.execute('slice.revision.prepare', { ...payload, name: 'Left cut', rectangle: { x: 0, y: 0, width: 8, height: 16 } }, agent);
  assert.equal(reuse.value.status, 'REUSED');
  const grant = (await f.studio.readProjectTrusted(projectId)).snapshot.grants[0];
  assert.deepEqual(grant.usage, { commands: 1, jobs: 0, artifactBytes: 0, costCents: 0 });
});
