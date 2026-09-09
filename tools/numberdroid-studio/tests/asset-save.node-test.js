import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StudioService } from '../packages/application/src/index.js';
import { COMMAND_DEFINITIONS, KNOWN_GRANT_SCOPES } from '../packages/domain/src/command-catalog.js';
import { createAgentToolCatalog, jsonSchemaToZod } from '../packages/mcp-server/src/index.js';
import { ASSET_SPATIAL_SCHEMA, spatialAliases } from '../packages/domain/src/asset-spatial-geometry.js';
import { encodeCanonicalRgbaPng } from '../packages/preview/src/index.js';
import { ContentAddressedArtifactStore, SqliteProjectStore, SqliteSourceIntakeStore, SqliteArtifactMetadataStore,
  SqliteJobStore, createSqliteProjectBundle, importSqliteProjectBundle, projectSqlitePortableDocument,
  validateSqlitePortableProject, verifyWorkspaceIntegrity } from '../packages/persistence/src/index.js';
import { AtlasPreviewWorker } from '../apps/studio-server/src/atlas-preview-worker.js';
import { createStudioHttpServer } from '../apps/studio-server/src/server.js';
import { nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';

const projectId = 'project.owner-save';
const owner = { actor: { id: 'owner.fixture', kind: 'human', displayName: 'Fixture owner' }, taskId: null, grantId: null, branchId: 'branch.main' };
const metadata = { role: 'machine', tags: ['test'], variantGroup: null, compatibilityGroups: [], spanTiles: { width: 1, height: 1 },
  anchor: { x: 0, y: 0 }, attachment: 'ground', rotationPolicy: 'cardinal', placement: { modes: ['manual'], wallSafe: true, tags: [], confirmation: 'confirmed' },
  collision: { mode: 'none', bounds: null, parts: [] }, navigation: { effect: 'passable', cost: null }, runtimeEligible: false,
  connectors: [], continuityProfile: null, continuityTags: [], selectionPriority: 0, visualWeight: 'medium', extensions: { 'fixture.hidden': { preserved: true } } };

async function fixture(context) {
  const root = await mkdtemp(join(tmpdir(), 'studio-owner-save-'));
  const artifacts = new ContentAddressedArtifactStore({ rootDirectory: join(root, 'artifacts') });
  let store, studio, worker, jobs, server;
  let failPoint = null, sequence = 0;
  const open = async () => {
    store = await SqliteProjectStore.open({ filename: join(root, 'studio.sqlite'), databaseFactory: nodeSqliteDatabaseFactory,
      faultInjector(point) { if (point === failPoint) throw new Error(`injected ${point}`); } });
    jobs = new SqliteJobStore({ workspace: store.workspace });
    studio = new StudioService({ store, jobStore: jobs, agentAttemptAuditReady: true });
    worker = new AtlasPreviewWorker({ jobStore: jobs, artifactStore: artifacts,
      artifactMetadataStore: new SqliteArtifactMetadataStore({ workspace: store.workspace }), workerId: 'worker.owner-save' });
  };
  const close = async () => { await worker?.stop(); if (server) { await new Promise((done, reject) => server.close(e => e ? reject(e) : done())); server = null; } store?.close(); store = null; };
  context.after(async () => { await close(); await rm(root, { recursive: true, force: true }); });
  await open();
  const request = async (type, payload) => {
    const revision = type === 'project.create' ? 0 : (await studio.readProjectTrusted(projectId)).revision;
    return { schemaVersion: 1, commandId: `cmd.save.${++sequence}`, idempotencyKey: `idem.save.${sequence}`, type, projectId, baseRevision: revision, expectedVersion: revision, payload };
  };
  const execute = async (type, payload, actor = owner) => studio.execute(await request(type, payload), actor);
  await execute('project.create', { name: 'Owner Save fixture', description: 'Synthetic technical proof', ownerId: owner.actor.id });
  const artifact = await artifacts.ingest(encodeCanonicalRgbaPng({ width: 16, height: 16, rgba: Buffer.alloc(16 * 16 * 4, 255) }), { mediaType: 'image/png' });
  new SqliteSourceIntakeStore({ workspace: store.workspace }).stage(artifact, { projectId, intakeId: 'intake.fixture', idempotencyKey: 'intake.fixture', origin: 'human_upload', createdRevision: 1 });
  await execute('source.intake.commit', { intakeId: 'intake.fixture', sourceId: 'source.fixture', name: 'Synthetic pixels',
    artifactUri: artifact.uri, mediaType: artifact.mediaType, byteSize: artifact.byteSize, width: artifact.width, height: artifact.height,
    provenance: { origin: 'human_upload', prompt: null, negativePrompt: null, seed: null, provider: null, model: null, modelVersion: null, generator: null, parameters: {}, referenceArtifactUris: [], parentSourceIds: [] } });
  await execute('source.review.propose', { sourceId: 'source.fixture', note: 'Synthetic fixture only.' });
  await execute('source.review.decide', { sourceId: 'source.fixture', disposition: 'APPROVED', note: 'Synthetic fixture only.' });
  let definitionVersion = 0;
  const cut = async (prior = null) => {
    const defined = await execute('atlas.define.rects', { atlasId: 'atlas.fixture', sourceId: 'source.fixture', name: 'Fixture cuts', expectedAtlasVersion: definitionVersion,
      rectangles: [{ rectangleId: 'rect.fixture', name: `Cut ${definitionVersion + 1}`, x: 0, y: 0, width: 16, height: 16, included: true, pivot: null,
        transparentPaddingPolicy: 'preserve_exact_rect', replacesSliceId: prior?.sliceId ?? null, expectedSliceVersion: prior?.version ?? null }] });
    definitionVersion += 1;
    const input = { atlasId: 'atlas.fixture', expectedAtlasVersion: definitionVersion, expectedDefinitionFingerprint: defined.value.definitionFingerprint, jobId: `job.fixture.${definitionVersion}` };
    await execute('atlas.preview.slices', input); await worker.drain();
    return (await execute('atlas.commit.slices', input)).value.slices[0];
  };
  const slice = await cut();
  const payload = (extra = {}) => ({ assetId: 'asset.fixture', operation: 'create', expectedAssetVersion: 0, expectedMetadataVersion: 0,
    name: 'Fixture machine', kind: 'prop', metadata: structuredClone(metadata), image: { mode: 'saved-slice', sliceId: slice.sliceId, expectedSliceVersion: 1 }, ...extra });
  return { root, artifacts, cut, payload, execute, request, slice,
    get studio() { return studio; }, get store() { return store; },
    fault(value) { failPoint = value; },
    async restart() { await close(); await open(); },
    async http() { server = createStudioHttpServer({ studioService: studio, artifactStore: artifacts });
      await new Promise(done => server.listen(0, '127.0.0.1', done)); return `http://127.0.0.1:${server.address().port}`; },
  };
}

test('owner Save versions atomically, retains exact recut imagery, replays and survives bundle/restart', { timeout: 120_000 }, async context => {
  const f = await fixture(context);
  const legacy = projectSqlitePortableDocument({ projectStore: f.store, projectId }).project;
  assert.equal(legacy.schemaVersion, 1);
  const first = await f.execute('asset.save', f.payload());
  assert.deepEqual(first.value, { assetId: 'asset.fixture', assetVersion: 1, metadataVersion: 1, lifecycle: 'DRAFT' });
  const old = (await f.studio.readProjectTrusted(projectId)).snapshot.assetLibrary.assets[0];
  assert.equal(old.proposal, null);
  await f.cut(f.slice);
  const update = f.payload({ operation: 'update', expectedAssetVersion: 1, expectedMetadataVersion: 1, name: 'Renamed machine', image: { mode: 'retain' } });
  const request = await f.request('asset.save', update);
  const saved = await f.studio.execute(request, owner);
  const replay = await f.studio.execute({ ...request, commandId: `${request.commandId}.retry` }, owner);
  assert.equal(replay.replayed, true); assert.equal(replay.revision, saved.revision); assert.deepEqual(replay.value, saved.value);
  const current = (await f.studio.readProjectTrusted(projectId)).snapshot.assetLibrary.assets[0];
  assert.equal(current.assetVersion, 2); assert.equal(current.metadataVersion, 1); assert.deepEqual(current.sliceBinding, old.sliceBinding);
  assert.deepEqual(current.metadata.extensions, metadata.extensions);
  await assert.rejects(f.execute('asset.save', update), { code: 'ENTITY_VERSION_CONFLICT' });
  await assert.rejects(f.execute('asset.save', { ...update, expectedAssetVersion: 2, image: { mode: 'saved-slice', sliceId: f.slice.sliceId, expectedSliceVersion: 1 } }), { code: 'ENTITY_VERSION_CONFLICT' });
  const integrity = await verifyWorkspaceIntegrity({ projectStore: f.store, artifactStore: f.artifacts });
  assert.equal(integrity.ok, true, JSON.stringify(integrity));
  const portable = projectSqlitePortableDocument({ projectStore: f.store, projectId }).project;
  assert.equal(portable.schemaVersion, 4);
  for (const schemaVersion of [1, 2, 3]) assert.throws(() => validateSqlitePortableProject({ ...structuredClone(portable), schemaVersion }));
  const bundleDirectory = join(f.root, 'bundle');
  await createSqliteProjectBundle({ destinationDirectory: bundleDirectory, projectStore: f.store, artifactStore: f.artifacts, projectId });
  const importedDirectory = join(f.root, 'imported');
  await importSqliteProjectBundle({ bundleDirectory, destinationDirectory: importedDirectory, databaseFactory: nodeSqliteDatabaseFactory });
  const imported = await SqliteProjectStore.open({ filename: join(importedDirectory, 'studio.sqlite'), databaseFactory: nodeSqliteDatabaseFactory });
  try {
    const second = join(f.root, 'bundle-again');
    await createSqliteProjectBundle({ destinationDirectory: second, projectStore: imported, artifactStore: new ContentAddressedArtifactStore({ rootDirectory: join(importedDirectory, 'artifacts') }), projectId });
    for (const name of ['project.json', 'manifest.json']) assert.deepEqual(await readFile(join(second, name)), await readFile(join(bundleDirectory, name)));
  } finally { imported.close(); }
  const replaced = await f.execute('asset.save', f.payload({ operation: 'update', expectedAssetVersion: 2,
    expectedMetadataVersion: 1, image: { mode: 'saved-slice', sliceId: f.slice.sliceId, expectedSliceVersion: 2 } }));
  assert.equal(replaced.value.assetVersion, 3); assert.equal(replaced.value.metadataVersion, 1);
  const replacement = (await f.studio.readProjectTrusted(projectId)).snapshot.assetLibrary.assets[0];
  assert.equal(replacement.sliceBinding.sliceVersion, 2);
  assert.equal(Number(f.store.workspace.database.prepare('SELECT slice_version FROM asset_versions WHERE project_id = ? AND asset_id = ? AND asset_version = 1').get(projectId, 'asset.fixture').slice_version), 1);
  await f.restart();
  assert.deepEqual((await f.studio.readProjectTrusted(projectId)).snapshot.assetLibrary.assets[0], replacement);
});

test('owner Save rejects foreign/agent authority, exact payload abuse and transaction faults', { timeout: 120_000 }, async context => {
  const f = await fixture(context);
  assert.equal(COMMAND_DEFINITIONS.length, 37); assert.equal(KNOWN_GRANT_SCOPES.length, 31);
  const tools = createAgentToolCatalog(f.studio, { contextProvider: async () => ({ ...owner, projectId }) });
  assert.equal(tools.length, 19); assert.equal(tools.some(t => t.name === 'studio_asset_save'), false);
  for (const actor of [{ ...owner, actor: { ...owner.actor, id: 'other.human' } }, { ...owner, actor: { id: 'agent.fixture', kind: 'agent' } }]) {
    await assert.rejects(f.execute('asset.save', f.payload(), actor), { code: 'FORBIDDEN' });
  }
  for (const payload of [f.payload({ proposalId: 'forged' }), f.payload({ image: { mode: 'retain' } }), f.payload({ image: { mode: 'saved-slice', sliceId: f.slice.sliceId, expectedSliceVersion: 1, digest: 'a'.repeat(64) } })]) {
    await assert.rejects(f.execute('asset.save', payload));
  }
  const before = await f.studio.readProjectTrusted(projectId);
  for (const point of ['after_asset_version_insert', 'after_asset_version_reference_insert', 'after_asset_head_tags_update', 'before_transaction_commit']) {
    f.fault(point); await assert.rejects(f.execute('asset.save', f.payload()), /injected/); f.fault(null);
    assert.deepEqual(await f.studio.readProjectTrusted(projectId), before);
    assert.equal(Number(f.store.workspace.database.prepare('SELECT count(*) AS n FROM asset_versions').get().n), 0);
  }
  await f.execute('asset.save', f.payload());
  assert.equal((await verifyWorkspaceIntegrity({ projectStore: f.store, artifactStore: f.artifacts })).ok, true);
});

test('owner Save HTTP is local-CSRF POST only and rejects authority fields', { timeout: 120_000 }, async context => {
  const f = await fixture(context); const base = await f.http();
  const csrf = (await (await fetch(`${base}/api/ui-session`)).json()).csrfToken;
  const { assetId: _assetId, ...payload } = f.payload();
  const body = { ...payload, expectedRevision: (await f.studio.readProjectTrusted(projectId)).revision, idempotencyKey: 'http.owner.save' };
  const path = `${base}/api/projects/${projectId}/assets/asset.fixture/save`;
  const headers = { 'content-type': 'application/json', origin: base, 'sec-fetch-site': 'same-origin', 'x-numberdroid-studio-csrf': csrf };
  for (const method of ['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS']) { const r = await fetch(path, { method }); assert.equal(r.status, 405); await r.arrayBuffer(); }
  for (const altered of [{ ...headers, origin: 'https://evil.invalid' }, { ...headers, 'x-numberdroid-studio-csrf': '' }]) {
    const r = await fetch(path, { method: 'POST', headers: altered, body: JSON.stringify(body) }); assert.equal(r.status, 403); await r.arrayBuffer();
  }
  const forged = await fetch(path, { method: 'POST', headers, body: JSON.stringify({ ...body, actor: owner.actor }) }); assert.equal(forged.status, 400); await forged.arrayBuffer();
  const saved = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body) }); assert.equal(saved.status, 200, await saved.clone().text());
  const receipt = await saved.json(); const replay = await (await fetch(path, { method: 'POST', headers, body: JSON.stringify(body) })).json();
  assert.equal(replay.replayed, true); assert.equal(replay.revision, receipt.revision);
});

function spatialMetadata() {
  const spatial = { schemaVersion: 1, coordinateSpace: 'image-pixels', unitsPerPixel: { x: 1 / 16, y: 1 / 16 },
    placementBounds: { x: 0, y: 0, width: 16, height: 16 }, anchor: { x: 8, y: 15 }, blockingRegions: [
      { regionId: 'oval', name: 'Oval body', shape: { kind: 'oval', x: 2, y: 2, width: 12, height: 12 } },
      { regionId: 'polygon', name: 'Concave bracket', shape: { kind: 'polygon', points: [{ x: 1, y: 1 }, { x: 5, y: 1 }, { x: 5, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 5 }, { x: 1, y: 5 }] } },
    ] };
  return { ...structuredClone(metadata), ...spatialAliases(spatial), spatial, navigation: { effect: 'blocked', cost: null } };
}

test('spatial command schema is strict and matches owner Save, exact binding and v4 roundtrip', { timeout: 120_000 }, async context => {
  const value = spatialMetadata(); const schema = jsonSchemaToZod(ASSET_SPATIAL_SCHEMA);
  assert.deepEqual(schema.parse(value.spatial), value.spatial);
  for (const change of [s => { s.schemaVersion = 2; }, s => { s.blockingRegions[0].shape.width = 0; },
    s => { s.blockingRegions[0].shape.kind = 'capsule'; }, s => { s.blockingRegions[0].shape.grant = 'forged'; },
    s => { s.blockingRegions[1].shape.points.push({ x: 1, y: 1, z: 2 }); }]) {
    const invalid = structuredClone(value.spatial); change(invalid); assert.throws(() => schema.parse(invalid));
  }
  const f = await fixture(context);
  await f.execute('asset.save', f.payload());
  await f.execute('asset.save', f.payload({ operation: 'update', expectedAssetVersion: 1, expectedMetadataVersion: 1, image: { mode: 'retain' }, metadata: value }));
  const saved = (await f.studio.readProjectTrusted(projectId)).snapshot.assetLibrary.assets[0];
  assert.equal(saved.assetVersion, 2); assert.equal(saved.metadataVersion, 2);
  assert.deepEqual(saved.metadata.spatial, value.spatial);
  assert.equal((await verifyWorkspaceIntegrity({ projectStore: f.store, artifactStore: f.artifacts })).ok, true);
  const portable = projectSqlitePortableDocument({ projectStore: f.store, projectId }).project;
  assert.equal(portable.schemaVersion, 4);
  const forged = structuredClone(portable); forged.assetLibrary.heads[0].semantic.sliceBinding.rectangle.name = 'forged image name';
  assert.throws(() => validateSqlitePortableProject(forged), /binding differs/);
  const inconsistent = structuredClone(portable); inconsistent.assetLibrary.versions[1].metadata.spatial.unitsPerPixel.x = 2;
  assert.throws(() => validateSqlitePortableProject(inconsistent));
  const directory = join(f.root, 'spatial-bundle');
  await createSqliteProjectBundle({ destinationDirectory: directory, projectStore: f.store, artifactStore: f.artifacts, projectId });
  const importedDirectory = join(f.root, 'spatial-import');
  await importSqliteProjectBundle({ bundleDirectory: directory, destinationDirectory: importedDirectory, databaseFactory: nodeSqliteDatabaseFactory });
  const imported = await SqliteProjectStore.open({ filename: join(importedDirectory, 'studio.sqlite'), databaseFactory: nodeSqliteDatabaseFactory });
  try {
    const again = join(f.root, 'spatial-again');
    await createSqliteProjectBundle({ destinationDirectory: again, projectStore: imported,
      artifactStore: new ContentAddressedArtifactStore({ rootDirectory: join(importedDirectory, 'artifacts') }), projectId });
    for (const name of ['project.json', 'manifest.json']) assert.deepEqual(await readFile(join(again, name)), await readFile(join(directory, name)));
    const db = imported.workspace.database;
    const original = db.prepare('SELECT head_snapshot_json FROM projects WHERE project_id = ?').get(projectId).head_snapshot_json;
    const storeSnapshot = value => db.prepare('UPDATE projects SET head_snapshot_json = ? WHERE project_id = ?').run(value, projectId);
    const artifacts = new ContentAddressedArtifactStore({ rootDirectory: join(importedDirectory, 'artifacts') });
    for (const corrupt of [head => { head.proposal = { proposalId: 'forged' }; }, head => { head.sliceBinding.rectangle.name = 'forged'; }, head => { head.findings = [{ findingId: 'forged', severity: 'ERROR' }]; }, head => { head.warningDispositions = ['forged']; }, head => { head.metadataFingerprint = 'f'.repeat(64); }, head => { head.updatedBy = 'forged'; }]) {
      const document = JSON.parse(original); corrupt(document.assetLibrary.assets[0]); storeSnapshot(JSON.stringify(document));
      const integrity = await verifyWorkspaceIntegrity({ projectStore: imported, artifactStore: artifacts });
      assert.equal(integrity.ok, false);
      assert.ok(integrity.assets.findings.some(f => f.code === 'ASSET_LIBRARY_SNAPSHOT_MISMATCH'), JSON.stringify(integrity.assets));
      storeSnapshot(original);
    }
    assert.equal((await verifyWorkspaceIntegrity({ projectStore: imported, artifactStore: artifacts })).ok, true);
  } finally { imported.close(); }
});

test('native owner-save integrity rejects forged owner, prior versions, retained binding and resulting snapshot', { timeout: 120_000 }, async context => {
  const f = await fixture(context);
  await f.execute('asset.save', f.payload());
  await f.cut(f.slice);
  const saved = await f.execute('asset.save', f.payload({ operation: 'update', expectedAssetVersion: 1,
    expectedMetadataVersion: 1, name: 'Retained machine', image: { mode: 'retain' } }));
  const db = f.store.workspace.database;
  const original = db.prepare('SELECT revision_json FROM revisions WHERE project_id = ? AND revision_number = ?').get(projectId, saved.revision).revision_json;
  const write = value => db.prepare('UPDATE revisions SET revision_json = ? WHERE project_id = ? AND revision_number = ?').run(value, projectId, saved.revision);
  const corruptions = [
    revision => { revision.command.actor.id = 'foreign.owner'; },
    revision => { revision.command.actor.kind = 'agent'; },
    revision => { revision.command.payload.expectedAssetVersion = 0; },
    revision => { revision.command.payload.expectedMetadataVersion = 0; },
    revision => { revision.command.payload.image = { mode: 'saved-slice', sliceId: f.slice.sliceId, expectedSliceVersion: 1 }; },
    revision => { revision.snapshot.assetLibrary.assets[0].sliceBinding.rectangle.name = 'foreign cut name'; },
    revision => { revision.snapshot.assetLibrary.assets[0].proposal = { proposalId: 'forged' }; },
    revision => { revision.snapshot.assetLibrary.assets[0].metadata.tags = ['forged']; },
    revision => { revision.command.payload.metadata.tags = ['forged']; },
    revision => { revision.result.assetVersion = 99; },
    revision => { revision.result.metadataVersion = 99; },
    revision => { revision.result.lifecycle = 'FINAL'; },
    revision => { revision.snapshot.assetLibrary.assets[0].lifecycle = 'FINAL'; },
  ];
  for (const corrupt of corruptions) {
    const revision = JSON.parse(original); corrupt(revision); write(JSON.stringify(revision));
    const result = await verifyWorkspaceIntegrity({ projectStore: f.store, artifactStore: f.artifacts });
    assert.equal(result.ok, false);
    assert.ok(result.assets.findings.some(finding => finding.code === 'ASSET_OWNER_SAVE_PROVENANCE_INVALID'), JSON.stringify(result.assets));
    write(original);
  }
  assert.equal((await verifyWorkspaceIntegrity({ projectStore: f.store, artifactStore: f.artifacts })).ok, true);
});
