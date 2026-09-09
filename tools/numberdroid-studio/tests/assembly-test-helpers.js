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

export const projectId = 'project.owner-save';
export const owner = { actor: { id: 'owner.fixture', kind: 'human', displayName: 'Fixture owner' }, taskId: null, grantId: null, branchId: 'branch.main' };
const metadata = { role: 'machine', tags: ['test'], variantGroup: null, compatibilityGroups: [], spanTiles: { width: 1, height: 1 },
  anchor: { x: 0, y: 0 }, attachment: 'ground', rotationPolicy: 'cardinal', placement: { modes: ['manual'], wallSafe: true, tags: [], confirmation: 'confirmed' },
  collision: { mode: 'none', bounds: null, parts: [] }, navigation: { effect: 'passable', cost: null }, runtimeEligible: false,
  connectors: [], continuityProfile: null, continuityTags: [], selectionPriority: 0, visualWeight: 'medium', extensions: { 'fixture.hidden': { preserved: true } } };

export async function assemblyFixture(context) {
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
    async http(options = {}) { server = createStudioHttpServer({ studioService: studio, artifactStore: artifacts, ...options });
      await new Promise(done => server.listen(0, '127.0.0.1', done)); return `http://127.0.0.1:${server.address().port}`; },
  };
}


export function assemblyPayload(overrides = {}) {
  return { assetId: 'assembly.fixture', operation: 'create', expectedAssetVersion: 0, expectedMetadataVersion: 0,
    name: 'Assembled fixture', kind: 'prop', metadata: { role: 'machine', tags: ['fixture'] },
    assembly: { schemaVersion: 1, coordinateSpace: 'assembly-pixels', unitsPerPixel: 1 / 64,
      placementBounds: { x: -64, y: -64, width: 128, height: 128 }, anchor: { x: 0, y: 0 },
      states: [{ stateId: 'idle', name: 'Idle' }], variants: [{ variantId: 'default', name: 'Default' }], defaultStateId: 'idle', defaultVariantId: 'default',
      components: [{ componentId: 'body', name: 'Body', asset: { assetId: 'asset.fixture', assetVersion: 1, metadataVersion: 1 }, position: { x: 0, y: 0 }, rotationDegrees: 0, scale: 1, stateIds: null, variantOverrides: [] }],
      blocking: { mode: 'components', regions: [] } }, ...overrides };
}
