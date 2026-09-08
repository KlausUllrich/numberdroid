import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StudioService } from '../packages/application/src/index.js';
import { validateAtlasRectangles } from '../packages/domain/src/atlas-definition.js';
import { validateExactSliceBinding } from '../packages/domain/src/asset-definition.js';
import { createAgentToolCatalog, jsonSchemaToZod } from '../packages/mcp-server/src/index.js';
import {
  ContentAddressedArtifactStore, SqliteArtifactMetadataStore, SqliteJobStore,
  SqliteProjectStore, SqliteSourceIntakeStore, createSqliteProjectBundle,
  importSqliteProjectBundle, projectSqlitePortableDocument,
  validateSqlitePortableProject, verifyWorkspaceIntegrity,
} from '../packages/persistence/src/index.js';
import { AtlasPreviewWorker } from '../apps/studio-server/src/atlas-preview-worker.js';
import { OWNER_CONTEXT, AGENT_CONTEXT, PROJECT_ID, command, createProject, issueGrant } from './test-helpers.js';
import { nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';

const studioRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = resolve(studioRoot, '../../art-source/approved/area-01-transfer-ship/floor-treatment/source/family-hygiene-floor-2x2__source-approved__2026-08-21.png');
const rectangle = {
  rectangleId: 'rect.names', x: 3, y: 3, width: 8, height: 8, included: true,
  pivot: null, transparentPaddingPolicy: 'preserve_exact_rect',
  replacesSliceId: null, expectedSliceVersion: null,
};
const dimensions = { sourceWidth: 1254, sourceHeight: 1254 };

test('optional cut names retain legacy fingerprints and stable rectangle identities', () => {
  const legacy = validateAtlasRectangles([rectangle], dimensions);
  assert.deepEqual(legacy.rectangles, [rectangle]);
  assert.equal(legacy.fingerprint, '2348afe6e4bad3560cc43c6feed646e7027a6d0ef904fcbcaf6de57a2bc06555');
  const named = validateAtlasRectangles([{ ...rectangle, name: '  Calm tile  ' }], dimensions);
  assert.equal(named.rectangles[0].name, 'Calm tile');
  assert.equal(named.rectangles[0].rectangleId, rectangle.rectangleId);
  assert.notEqual(named.fingerprint, legacy.fingerprint);
  const renamed = validateAtlasRectangles([{ ...rectangle, name: 'Sterile tile' }], dimensions);
  assert.notEqual(renamed.fingerprint, named.fingerprint);
  for (const name of ['', '   ', null, 7, 'x'.repeat(161)]) {
    assert.throws(() => validateAtlasRectangles([{ ...rectangle, name }], dimensions), { code: 'VALIDATION_ERROR' });
  }
  assert.equal(validateAtlasRectangles([{ ...rectangle, name: 'x'.repeat(160) }], dimensions).rectangles[0].name.length, 160);
});

async function fixture(context) {
  const root = await mkdtemp(join(tmpdir(), 'numberdroid-cutter-names-'));
  const filename = join(root, 'studio.sqlite');
  let store;
  let worker;
  context.after(async () => {
    await worker?.stop();
    store?.close();
    await rm(root, { recursive: true, force: true });
  });
  const artifacts = new ContentAddressedArtifactStore({ rootDirectory: join(root, 'artifacts') });
  let jobs;
  let studio;
  let sequence = 0;
  let tick = 0;
  async function open() {
    store = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
    jobs = new SqliteJobStore({ workspace: store.workspace });
    studio = new StudioService({ store, jobStore: jobs, agentAttemptAuditReady: true,
      clock: () => new Date(Date.UTC(2026, 8, 8, 0, 0, tick++)).toISOString() });
    worker = new AtlasPreviewWorker({ jobStore: jobs, artifactStore: artifacts,
      artifactMetadataStore: new SqliteArtifactMetadataStore({ workspace: store.workspace }),
      workerId: 'worker.cutter.names' });
  }
  async function execute(type, payload, actor = OWNER_CONTEXT) {
    const head = await studio.readProjectTrusted(PROJECT_ID);
    const request = command({ type, payload, expectedVersion: head.revision,
      commandId: `cmd.names.${++sequence}`, idempotencyKey: `idem.names.${sequence}` });
    return { request, result: await studio.execute(request, actor) };
  }
  await open();
  await createProject(studio);
  const artifact = await artifacts.ingest(await readFile(sourcePath), { mediaType: 'image/png' });
  new SqliteSourceIntakeStore({ workspace: store.workspace }).stage(artifact, {
    projectId: PROJECT_ID, intakeId: 'intake.names', idempotencyKey: 'upload.names',
    origin: 'human_upload', createdRevision: 1,
  });
  await execute('source.intake.commit', {
    intakeId: 'intake.names', sourceId: 'source.names', name: 'Named cut source',
    artifactUri: artifact.uri, mediaType: artifact.mediaType, byteSize: artifact.byteSize,
    width: artifact.width, height: artifact.height,
    provenance: { origin: 'human_upload', prompt: null, negativePrompt: null, seed: null,
      provider: null, model: null, modelVersion: null, generator: null, parameters: {},
      referenceArtifactUris: [], parentSourceIds: [] },
  });
  await execute('source.review.propose', { sourceId: 'source.names', note: 'Fixture source.' });
  await execute('source.review.decide', { sourceId: 'source.names', disposition: 'APPROVED', note: 'Approved fixture.' });
  return {
    root, artifacts, execute, get store() { return store; }, get studio() { return studio; },
    get jobs() { return jobs; }, get worker() { return worker; },
    async restart() { await worker.stop(); store.close(); store = null; await open(); },
  };
}

async function cut(fixture, cutRectangle, expectedAtlasVersion) {
  const defined = await fixture.execute('atlas.define.rects', {
    atlasId: 'atlas.names', sourceId: 'source.names', name: 'Named cuts',
    expectedAtlasVersion, rectangles: [cutRectangle],
  });
  const common = { atlasId: 'atlas.names', expectedAtlasVersion: expectedAtlasVersion + 1,
    expectedDefinitionFingerprint: defined.result.value.definitionFingerprint,
    jobId: `job.names.${expectedAtlasVersion + 1}` };
  await fixture.execute('atlas.preview.slices', common);
  assert.equal(fixture.jobs.get(PROJECT_ID, common.jobId).input.rectangles[0].name, cutRectangle.name);
  assert.equal(await fixture.worker.drain(), 1);
  assert.equal(fixture.jobs.get(PROJECT_ID, common.jobId).state, 'SUCCEEDED');
  const committed = await fixture.execute('atlas.commit.slices', common);
  const replay = await fixture.studio.execute({ ...committed.request, commandId: `${committed.request.commandId}.replay` }, OWNER_CONTEXT);
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.value, committed.result.value);
  return committed.result.value.slices[0];
}

const metadata = {
  role: 'floor', tags: ['names'], variantGroup: null, compatibilityGroups: [],
  spanTiles: { width: 1, height: 1 }, anchor: { x: 0, y: 0 }, attachment: 'ground',
  rotationPolicy: 'fixed', placement: { modes: ['manual'], wallSafe: true, tags: [], confirmation: 'confirmed' },
  collision: { mode: 'none', bounds: null, parts: [] }, navigation: { effect: 'passable', cost: null },
  runtimeEligible: false, connectors: [], continuityProfile: null, continuityTags: [],
  selectionPriority: 0, visualWeight: 'medium', extensions: {},
};

test('named cuts survive commit, explicit rename recut, pinned Asset, restart and portable bundle', async (context) => {
  const value = await fixture(context);
  const first = await cut(value, { ...rectangle, name: 'Calm tile' }, 0);
  assert.equal(first.name, 'Calm tile');
  await value.execute('asset.proposal.submit', {
    proposalId: 'proposal.names', expectedRevision: (await value.studio.readProjectTrusted(PROJECT_ID)).revision,
    items: [{ itemId: 'item.names', operation: 'create', assetId: 'asset.names',
      expectedAssetVersion: 0, expectedMetadataVersion: 0, sliceId: first.sliceId,
      expectedSliceVersion: 1, name: 'Named reusable tile', kind: 'surface', metadata }],
  });
  await value.execute('asset.proposal.decide', { proposalId: 'proposal.names', expectedProposalVersion: 1,
    decisions: [{ itemId: 'item.names', disposition: 'ACCEPTED', reason: null }] });
  await value.execute('asset.proposal.apply', { proposalId: 'proposal.names', expectedProposalVersion: 2 });
  const query = () => value.studio.queryAssets({ schemaVersion: 1, projectId: PROJECT_ID, assetId: 'asset.names' }, OWNER_CONTEXT);
  const pinned = (await query()).assets[0].sliceBinding;
  assert.equal(pinned.rectangle.name, 'Calm tile');
  assert.deepEqual(validateExactSliceBinding(pinned), pinned);
  for (const name of ['', ' ', null, false, 'x'.repeat(161)]) {
    assert.throws(() => validateExactSliceBinding({ ...pinned, rectangle: { ...pinned.rectangle, name } }), { code: 'VALIDATION_ERROR' });
  }
  const second = await cut(value, { ...rectangle, name: 'Renamed tile', replacesSliceId: first.sliceId, expectedSliceVersion: 1 }, 1);
  assert.equal(second.sliceId, first.sliceId);
  assert.equal(second.version, 2);
  assert.equal(second.digest, first.digest);
  assert.equal(second.name, 'Renamed tile');
  assert.deepEqual((await query()).assets[0].sliceBinding, pinned);
  const revision = (await value.studio.readProjectTrusted(PROJECT_ID)).revision;
  await value.restart();
  const restarted = await value.studio.readProjectTrusted(PROJECT_ID);
  assert.equal(restarted.revision, revision);
  assert.equal(restarted.snapshot.atlases[0].rectangles[0].name, 'Renamed tile');
  assert.equal(restarted.snapshot.atlases[0].sliceHeads[0].rectangle.name, 'Renamed tile');
  assert.equal(value.jobs.get(PROJECT_ID, 'job.names.1').input.rectangles[0].name, 'Calm tile');
  assert.deepEqual((await query()).assets[0].sliceBinding, pinned);
  assert.equal((await verifyWorkspaceIntegrity({ projectStore: value.store, artifactStore: value.artifacts })).ok, true);

  const { project: portable } = projectSqlitePortableDocument({ projectStore: value.store, projectId: PROJECT_ID });
  for (const name of ['', ' padded ', null, 'x'.repeat(161)]) {
    const invalid = structuredClone(portable);
    invalid.atlases[0].rectangles[0].name = name;
    assert.throws(() => validateSqlitePortableProject(invalid), { code: 'BUNDLE_SCHEMA_INVALID' });
  }
  const bundleDirectory = join(value.root, 'bundle');
  await createSqliteProjectBundle({ destinationDirectory: bundleDirectory,
    projectStore: value.store, artifactStore: value.artifacts, projectId: PROJECT_ID });
  const destinationDirectory = join(value.root, 'imported');
  assert.equal((await importSqliteProjectBundle({ bundleDirectory, destinationDirectory, databaseFactory: nodeSqliteDatabaseFactory })).ok, true);
  const imported = await SqliteProjectStore.open({ filename: join(destinationDirectory, 'studio.sqlite'), databaseFactory: nodeSqliteDatabaseFactory });
  try {
    const importedStudio = new StudioService({ store: imported, jobStore: new SqliteJobStore({ workspace: imported.workspace }), agentAttemptAuditReady: true });
    const importedHead = await importedStudio.readProjectTrusted(PROJECT_ID);
    assert.equal(importedHead.snapshot.atlases[0].rectangles[0].name, 'Renamed tile');
    assert.equal(importedHead.snapshot.atlases[0].sliceHeads[0].rectangle.name, 'Renamed tile');
    const importedAsset = await importedStudio.queryAssets({ schemaVersion: 1, projectId: PROJECT_ID, assetId: 'asset.names' }, OWNER_CONTEXT);
    assert.deepEqual(importedAsset.assets[0].sliceBinding, pinned);
    assert.equal((await verifyWorkspaceIntegrity({ projectStore: imported,
      artifactStore: new ContentAddressedArtifactStore({ rootDirectory: join(destinationDirectory, 'artifacts') }) })).ok, true);
    const secondBundle = join(value.root, 'bundle-again');
    await createSqliteProjectBundle({ destinationDirectory: secondBundle, projectStore: imported,
      artifactStore: new ContentAddressedArtifactStore({ rootDirectory: join(destinationDirectory, 'artifacts') }),
      projectId: PROJECT_ID });
    assert.deepEqual(await readFile(join(secondBundle, 'project.json')), await readFile(join(bundleDirectory, 'project.json')));
    assert.deepEqual(await readFile(join(secondBundle, 'manifest.json')), await readFile(join(bundleDirectory, 'manifest.json')));
  } finally { imported.close(); }
});

test('MCP cut schema accepts optional names without adding tools or widening authority', async (context) => {
  const value = await fixture(context);
  await issueGrant(value.studio, { expectedVersion: 4, scopes: ['project.read', 'atlas.write'] });
  const tools = createAgentToolCatalog(value.studio, { contextProvider: async () => ({ ...AGENT_CONTEXT, projectId: PROJECT_ID }) });
  assert.equal(tools.length, 19);
  const define = tools.find((tool) => tool.name === 'studio_atlas_define_rects');
  const schema = jsonSchemaToZod(define.inputSchema);
  const input = command({ type: 'atlas.define.rects', expectedVersion: 5,
    commandId: 'cmd.names.mcp', idempotencyKey: 'idem.names.mcp',
    payload: { atlasId: 'atlas.names', sourceId: 'source.names', name: 'MCP cuts',
      expectedAtlasVersion: 0, rectangles: [{ ...rectangle, name: 'Agent named tile' }] } });
  delete input.type;
  assert.deepEqual(schema.parse(input), input);
  const legacy = structuredClone(input);
  delete legacy.payload.rectangles[0].name;
  assert.deepEqual(schema.parse(legacy), legacy);
  for (const name of ['', null, 7, 'x'.repeat(161)]) {
    const invalid = structuredClone(input); invalid.payload.rectangles[0].name = name;
    assert.throws(() => schema.parse(invalid));
  }
  const defined = await define.execute(input);
  assert.equal(defined.value.definitionVersion, 1);
  const read = await value.studio.readProject({ projectId: PROJECT_ID }, AGENT_CONTEXT);
  assert.equal(read.snapshot.atlases[0].rectangles[0].name, 'Agent named tile');
});
