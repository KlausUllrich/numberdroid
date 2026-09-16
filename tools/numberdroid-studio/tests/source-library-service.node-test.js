import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StudioService, SourceLibraryService } from '../packages/application/src/index.js';
import { ContentAddressedArtifactStore, SqliteProjectStore, SqliteSourceIntakeStore, SqliteArtifactMetadataStore,
  SqliteJobStore, SourceLibraryOperationStore, verifyWorkspaceIntegrity } from '../packages/persistence/src/index.js';
import { encodeCanonicalRgbaPng } from '../packages/preview/src/index.js';
import { AtlasPreviewWorker } from '../apps/studio-server/src/atlas-preview-worker.js';
import { nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';

const projectId = 'project.source-library';
const owner = { actor: { id: 'owner.fixture', kind: 'human', displayName: 'Fixture owner' }, taskId: null, grantId: null, branchId: 'branch.main' };
const metadata = { role: 'machine', tags: ['test'], variantGroup: null, compatibilityGroups: [], spanTiles: { width: 1, height: 1 },
  anchor: { x: 0, y: 0 }, attachment: 'ground', rotationPolicy: 'cardinal', placement: { modes: ['manual'], wallSafe: true, tags: [], confirmation: 'proposed' },
  collision: { mode: 'none', bounds: null, parts: [] }, navigation: { effect: 'passable', cost: null }, runtimeEligible: false,
  connectors: [], continuityProfile: null, continuityTags: [], selectionPriority: 0, visualWeight: 'medium', extensions: { 'fixture.hidden': { preserved: true } } };
function create(assetId, name = assetId) { return { operation: 'create', assetId, name, kind: 'prop', metadata: structuredClone(metadata) }; }

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'studio-source-library-'));
  const artifacts = new ContentAddressedArtifactStore({ rootDirectory: join(root, 'artifacts') });
  let store, jobs, studio, worker, service, operationStore, sequence = 0, faultPoint = null;
  const open = async () => {
    store = await SqliteProjectStore.open({ filename: join(root, 'studio.sqlite'), databaseFactory: nodeSqliteDatabaseFactory,
      faultInjector(point) { if (point === faultPoint) throw new Error(`injected ${point}`); } });
    jobs = new SqliteJobStore({ workspace: store.workspace }); operationStore = new SourceLibraryOperationStore({ workspace: store.workspace });
    studio = new StudioService({ store, jobStore: jobs, agentAttemptAuditReady: true });
    service = new SourceLibraryService({ projectStore: store, jobStore: jobs, operationStore });
    worker = new AtlasPreviewWorker({ jobStore: jobs, artifactStore: artifacts,
      artifactMetadataStore: new SqliteArtifactMetadataStore({ workspace: store.workspace }), workerId: 'worker.source-library' });
  };
  const close = async () => { await worker?.stop(); store?.close(); store = null; };
  t.after(async () => { await close(); await rm(root, { recursive: true, force: true }); });
  await open();
  const execute = async (type, payload) => {
    const revision = type === 'project.create' ? 0 : (await studio.readProjectTrusted(projectId)).revision;
    return studio.execute({ schemaVersion: 1, commandId: `cmd.fixture.${++sequence}`, idempotencyKey: `idem.fixture.${sequence}`,
      type, projectId, baseRevision: revision, expectedVersion: revision, payload }, owner);
  };
  await execute('project.create', { name: 'Source to Library fixture', description: 'Synthetic technical fixture only', ownerId: owner.actor.id });
  const source = async (sourceId = 'source.fixture', fill = 255) => {
    const artifact = await artifacts.ingest(encodeCanonicalRgbaPng({ width: 24, height: 8, rgba: Buffer.alloc(24 * 8 * 4, fill) }), { mediaType: 'image/png' });
    const intakeId = `intake.${++sequence}`;
    new SqliteSourceIntakeStore({ workspace: store.workspace }).stage(artifact, { projectId, intakeId, idempotencyKey: intakeId, origin: 'human_upload',
      createdRevision: (await studio.readProjectTrusted(projectId)).revision });
    await execute('source.intake.commit', { intakeId, sourceId, name: sourceId, artifactUri: artifact.uri, mediaType: artifact.mediaType,
      byteSize: artifact.byteSize, width: artifact.width, height: artifact.height,
      provenance: { origin: 'human_upload', prompt: null, negativePrompt: null, seed: null, provider: null, model: null, modelVersion: null,
        generator: null, parameters: {}, referenceArtifactUris: [], parentSourceIds: [] } });
    await execute('source.review.propose', { sourceId, note: 'Fixture only' });
    await execute('source.review.decide', { sourceId, disposition: 'APPROVED', note: 'Fixture only' });
  };
  await source();
  const define = async (atlasId = 'atlas.fixture', sourceId = 'source.fixture', expectedAtlasVersion = 0) => execute('atlas.define.rects', {
    atlasId, sourceId, name: 'Three named cuts', expectedAtlasVersion,
    rectangles: [0, 1, 2].map(i => ({ rectangleId: `rect.${i}`, name: `Named cut ${i}`, x: i * 8, y: 0, width: 8, height: 8, included: true,
      pivot: null, transparentPaddingPolicy: 'preserve_exact_rect', replacesSliceId: null, expectedSliceVersion: null })) });
  await define();
  const preview = async (atlasId = 'atlas.fixture') => {
    const atlas = (await studio.readProjectTrusted(projectId)).snapshot.atlases.find(value => value.id === atlasId);
    const jobId = `job.fixture.${++sequence}`;
    await execute('atlas.preview.slices', { atlasId, expectedAtlasVersion: atlas.definitionVersion, expectedDefinitionFingerprint: atlas.definitionFingerprint, jobId });
    await worker.drain(); assert.equal(jobs.get(projectId, jobId).state, 'SUCCEEDED'); return jobId;
  };
  const request = async ({ atlasId = 'atlas.fixture', jobId, items, key = `save.${++sequence}` } = {}) => {
    const bootstrap = await service.bootstrap({ projectId, atlasId }, owner);
    return { projectId, atlasId, expectedRevision: bootstrap.revision, expectedAtlasVersion: bootstrap.expectedAtlasVersion,
      expectedAtlasFingerprint: bootstrap.expectedAtlasFingerprint,
      input: jobId ? { mode: 'generated', jobId } : bootstrap.savedInput,
      items: items ?? [0, 1, 2].map(i => ({ rectangleId: `rect.${i}`, destination: create(`asset.${i}`) })), idempotencyKey: key };
  };
  return { root, artifacts, source, define, execute, preview, request,
    get service() { return service; }, get store() { return store; }, get jobs() { return jobs; }, get studio() { return studio; }, get operations() { return operationStore; },
    fault(value) { faultPoint = value; }, async restart() { await close(); await open(); } };
}

test('one owner batch commits generated cuts and Library destinations atomically, replays and survives restart', { timeout: 60_000 }, async t => {
  const f = await fixture(t), jobId = await f.preview(), request = await f.request({ jobId });
  const { idempotencyKey: _key, ...planInput } = request;
  const before = await f.studio.readProjectTrusted(projectId), plan = await f.service.plan(planInput, owner);
  assert.equal(plan.canSave, true); assert.deepEqual(plan.summary, { created: 3, updated: 0, unchanged: 0, skipped: 0 });
  assert.deepEqual(await f.studio.readProjectTrusted(projectId), before); assert.equal(f.jobs.get(projectId, jobId).state, 'SUCCEEDED');
  const saved = await f.service.save(request, owner);
  assert.equal(saved.status, 'SAVED'); assert.equal(saved.revision, before.revision + 4);
  assert.equal(f.jobs.get(projectId, jobId).state, 'APPLIED'); assert.equal(saved.items[0].sliceBinding.rectangle.name, 'Named cut 0');
  assert.equal(saved.items[0].lifecycle, 'DRAFT');
  const replay = await f.service.save(request, owner); assert.deepEqual(replay, { ...saved, replayed: true });
  await f.restart(); assert.deepEqual(await f.service.save(request, owner), replay);
  const unchanged = await f.service.save(await f.request(), owner);
  assert.equal(unchanged.status, 'UNCHANGED'); assert.equal(unchanged.revision, saved.revision);
  assert.deepEqual(unchanged.summary, { created: 0, updated: 0, unchanged: 3, skipped: 0 });
  const integrity = await verifyWorkspaceIntegrity({ projectStore: f.store, artifactStore: f.artifacts });
  assert.equal(integrity.ok, true, JSON.stringify(integrity));
});

test('mixed update/add/skip from a new immutable original preserves old bindings and hidden metadata', { timeout: 60_000 }, async t => {
  const f = await fixture(t);
  const first = await f.service.save(await f.request({ jobId: await f.preview() }), owner), old = first.items[0].sliceBinding;
  await f.source('source.updated', 128); await f.define('atlas.updated', 'source.updated');
  const items = [{ rectangleId: 'rect.0', destination: { operation: 'update', assetId: 'asset.0', expectedAssetVersion: 1, expectedMetadataVersion: 1 } },
    { rectangleId: 'rect.1', destination: create('asset.added', 'New image') }, { rectangleId: 'rect.2', destination: { operation: 'skip' } }];
  const saved = await f.service.save(await f.request({ atlasId: 'atlas.updated', jobId: await f.preview('atlas.updated'), items }), owner);
  assert.deepEqual(saved.summary, { created: 1, updated: 1, unchanged: 0, skipped: 1 });
  assert.equal(saved.items[0].assetVersion, 2); assert.equal(saved.items[0].name, 'asset.0');
  assert.equal(saved.items[0].sliceBinding.sourceId, 'source.updated'); assert.notDeepEqual(saved.items[0].sliceBinding, old);
  const head = await f.studio.readProjectTrusted(projectId);
  assert.deepEqual(head.snapshot.assetLibrary.assets.find(asset => asset.assetId === 'asset.0').metadata.extensions, metadata.extensions);
  assert.equal(head.snapshot.sources.length, 2); assert.equal(head.snapshot.atlases.length, 2);
  const original = f.store.workspace.database.prepare('SELECT slice_id, slice_version FROM asset_versions WHERE project_id = ? AND asset_id = ? AND asset_version = 1').get(projectId, 'asset.0');
  assert.equal(original.slice_id, old.sliceId); assert.equal(Number(original.slice_version), old.sliceVersion);
  assert.equal((await verifyWorkspaceIntegrity({ projectStore: f.store, artifactStore: f.artifacts })).ok, true);
});

test('receipt and Nth asset persistence faults roll back the whole cut/Library/job batch', { timeout: 60_000 }, async t => {
  const f = await fixture(t), jobId = await f.preview(), request = await f.request({ jobId });
  const before = await f.studio.readProjectTrusted(projectId);
  for (const point of ['after_asset_version_insert', 'after_asset_version_reference_insert', 'after_source_library_operation_receipt', 'before_transaction_commit']) {
    f.fault(point); await assert.rejects(f.service.save(request, owner), /injected/); f.fault(null);
    assert.deepEqual(await f.studio.readProjectTrusted(projectId), before); assert.equal(f.jobs.get(projectId, jobId).state, 'SUCCEEDED');
    assert.equal(f.operations.get(projectId, request.idempotencyKey), null);
    assert.equal(Number(f.store.workspace.database.prepare('SELECT count(*) AS n FROM asset_versions').get().n), 0);
  }
  assert.equal((await f.service.save(request, owner)).summary.created, 3);
});

test('unchanged regenerated output requires explicit durable discard instead of ENTITY_EXISTS or fake apply', { timeout: 60_000 }, async t => {
  const f = await fixture(t); await f.service.save(await f.request({ jobId: await f.preview() }), owner);
  const jobId = await f.preview(), request = await f.request({ jobId });
  const { idempotencyKey: _key, ...input } = request;
  const plan = await f.service.plan(input, owner);
  assert.equal(plan.canSave, false); assert.equal(plan.code, 'REDUNDANT_OUTPUTS_DISCARD_REQUIRED'); assert.equal(plan.details.discardJobId, jobId);
  await assert.rejects(f.service.save(request, owner), { code: 'REDUNDANT_OUTPUTS_DISCARD_REQUIRED' });
  assert.equal(f.jobs.get(projectId, jobId).state, 'SUCCEEDED');
  f.jobs.discard(projectId, jobId, { operationIdempotencyKey: 'discard.redundant.fixture' });
  const saved = await f.service.save(await f.request(), owner);
  assert.equal(saved.status, 'UNCHANGED'); assert.equal(f.jobs.get(projectId, jobId).state, 'DISCARDED');
});

test('owner-only strict DTO, duplicate targets, version conflicts and changed replay fail closed', { timeout: 60_000 }, async t => {
  const f = await fixture(t), request = await f.request({ jobId: await f.preview() });
  for (const context of [{ ...owner, actor: { ...owner.actor, id: 'foreign' } }, { ...owner, actor: { ...owner.actor, kind: 'agent' } }, { ...owner, taskId: 'task.forged' }]) {
    await assert.rejects(f.service.save(request, context), { code: 'FORBIDDEN' });
  }
  await assert.rejects(f.service.save({ ...request, actor: owner.actor }, owner), { code: 'VALIDATION_ERROR' });
  const duplicate = structuredClone(request); duplicate.items[1].destination.assetId = duplicate.items[0].destination.assetId;
  await assert.rejects(f.service.save(duplicate, owner), { code: 'SOURCE_LIBRARY_DUPLICATE_TARGET' });
  await assert.rejects(f.service.save({ ...request, expectedRevision: 1 }, owner), { code: 'REVISION_CONFLICT' });
  await f.service.save(request, owner);
  const altered = structuredClone(request); altered.items[0].destination.name = 'Other intent';
  await assert.rejects(f.service.save(altered, owner), { code: 'IDEMPOTENCY_CONFLICT' });
  const next = await f.request(); next.items[0].destination = { operation: 'update', assetId: 'asset.0', expectedAssetVersion: 9, expectedMetadataVersion: 1 };
  await assert.rejects(f.service.save(next, owner), { code: 'ENTITY_VERSION_CONFLICT' });
});
