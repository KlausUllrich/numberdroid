import { lstat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { startStudioHttpServer } from '../apps/studio-server/src/server.js';
import { encodeCanonicalRgbaPng } from '../packages/preview/src/index.js';
import { spatialAliases } from '../packages/domain/src/asset-spatial-geometry.js';

export const ASSEMBLY_FIXTURE_PROJECT = 'project.assembly-editor';
export const ASSEMBLY_FIXTURE_ASSET = 'assembly.coffee-station';
const owner = { actor: { id: 'local.designer', kind: 'human', displayName: 'Local designer' }, taskId: null, grantId: null, branchId: 'branch.main' };
const cuts = [
  { id: 'graphite', name: 'Graphite body', x: 0, y: 0, width: 64, height: 96, color: [72, 91, 87] },
  { id: 'copper', name: 'Copper body', x: 64, y: 0, width: 64, height: 96, color: [168, 105, 67] },
  { id: 'display', name: 'Status display', x: 128, y: 0, width: 32, height: 16, color: [133, 215, 152] },
  { id: 'cup', name: 'Cup appearance', x: 160, y: 0, width: 40, height: 40, color: [227, 220, 187] },
];
function syntheticSheet() {
  const width = 200, height = 96, rgba = Buffer.alloc(width * height * 4);
  for (const cut of cuts) for (let y = 3; y < cut.height - 3; y += 1) for (let x = 3; x < cut.width - 3; x += 1) {
    const i = ((cut.y + y) * width + cut.x + x) * 4, edge = x < 6 || y < 6 || x >= cut.width - 6 || y >= cut.height - 6;
    rgba[i] = Math.max(0, cut.color[0] - (edge ? 25 : 0)); rgba[i + 1] = Math.max(0, cut.color[1] - (edge ? 25 : 0)); rgba[i + 2] = Math.max(0, cut.color[2] - (edge ? 25 : 0)); rgba[i + 3] = 255;
  }
  return encodeCanonicalRgbaPng({ width, height, rgba });
}
function metadata(cut) {
  const blocking = cut.id === 'graphite' || cut.id === 'copper';
  const spatial = { schemaVersion: 1, coordinateSpace: 'image-pixels', unitsPerPixel: { x: 1 / 64, y: 1 / 64 },
    placementBounds: { x: 0, y: 0, width: cut.width, height: cut.height }, anchor: { x: cut.width / 2, y: cut.height - 6 },
    blockingRegions: blocking ? [{ regionId: 'body', name: 'Machine body', shape: { kind: 'rectangle', x: 6, y: 6, width: cut.width - 12, height: cut.height - 12 } }] : [] };
  return { role: blocking ? 'machine' : 'appearance', tags: ['synthetic-fixture'], variantGroup: null, compatibilityGroups: [], ...spatialAliases(spatial), spatial,
    attachment: 'ground', rotationPolicy: 'cardinal', placement: { modes: ['manual'], wallSafe: true, tags: [], confirmation: 'confirmed' },
    navigation: { effect: blocking ? 'blocked' : 'passable', cost: null }, runtimeEligible: false, connectors: [], continuityProfile: null,
    continuityTags: [], selectionPriority: 0, visualWeight: 'medium', extensions: {} };
}
export async function prepareAssemblyEditorFixture(directory) {
  const dataDirectory = resolve(directory); try { await lstat(dataDirectory); throw new Error('Assembly fixture requires an absent directory. Existing work is preserved.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  let tick = 0, sequence = 0;
  const running = await startStudioHttpServer({ dataDirectory, host: '127.0.0.1', port: 0, storeMode: 'sqlite', pairingEnabled: false, operationsConfigurationFilename: null,
    clock: () => new Date(Date.UTC(2026, 8, 9, 12, 0, tick++)).toISOString() });
  const execute = async (type, payload) => {
    const revision = type === 'project.create' ? 0 : (await running.studioService.readProjectTrusted(ASSEMBLY_FIXTURE_PROJECT)).revision;
    const id = `fixture.assembly.${++sequence}`;
    return running.studioService.execute({ schemaVersion: 1, commandId: id, idempotencyKey: id, type, projectId: ASSEMBLY_FIXTURE_PROJECT, baseRevision: revision, expectedVersion: revision, payload }, owner);
  };
  try {
    if ((await running.studioService.listProjectsTrusted()).length) throw new Error('Assembly fixture refuses a workspace containing saved projects.');
    await execute('project.create', { name: 'Assembly editor — synthetic test', description: 'Fresh deterministic technical fixture. This is not production artwork or user acceptance.', ownerId: owner.actor.id });
    const artifact = await running.artifactStore.ingest(syntheticSheet(), { mediaType: 'image/png' });
    running.sourceIntakeStore.stage(artifact, { projectId: ASSEMBLY_FIXTURE_PROJECT, intakeId: 'intake.assembly', idempotencyKey: 'intake.assembly', origin: 'human_upload', createdRevision: 1 });
    await execute('source.intake.commit', { intakeId: 'intake.assembly', sourceId: 'source.assembly-sheet', name: 'Synthetic Assembly components', artifactUri: artifact.uri,
      mediaType: artifact.mediaType, byteSize: artifact.byteSize, width: artifact.width, height: artifact.height,
      provenance: { origin: 'human_upload', prompt: null, negativePrompt: null, seed: null, provider: null, model: null, modelVersion: null, generator: null, parameters: {}, referenceArtifactUris: [], parentSourceIds: [] } });
    await execute('source.review.propose', { sourceId: 'source.assembly-sheet', note: 'Synthetic fixture only.' });
    await execute('source.review.decide', { sourceId: 'source.assembly-sheet', disposition: 'APPROVED', note: 'Synthetic fixture only.' });
    const defined = await execute('atlas.define.rects', { atlasId: 'atlas.assembly-components', sourceId: 'source.assembly-sheet', name: 'Assembly components', expectedAtlasVersion: 0,
      rectangles: cuts.map(cut => ({ rectangleId: `rect.${cut.id}`, name: cut.name, x: cut.x, y: cut.y, width: cut.width, height: cut.height, included: true, pivot: null, transparentPaddingPolicy: 'preserve_exact_rect', replacesSliceId: null, expectedSliceVersion: null })) });
    const selection = { atlasId: 'atlas.assembly-components', expectedAtlasVersion: 1, expectedDefinitionFingerprint: defined.value.definitionFingerprint, jobId: 'job.assembly-cuts' };
    await execute('atlas.preview.slices', selection); await running.atlasPreviewWorker.drain(); const committed = await execute('atlas.commit.slices', selection);
    for (const cut of cuts) {
      const slice = committed.value.slices.find(slice => slice.rectangleId === `rect.${cut.id}`);
      if (!slice) throw new Error(`Committed ${cut.id} slice is missing.`);
      await execute('asset.save', { assetId: `asset.assembly-${cut.id}`, operation: 'create', expectedAssetVersion: 0, expectedMetadataVersion: 0, name: cut.name, kind: 'prop', metadata: metadata(cut), image: { mode: 'saved-slice', sliceId: slice.sliceId, expectedSliceVersion: slice.version } });
    }
    const leafAssets = (await running.studioService.readProjectTrusted(ASSEMBLY_FIXTURE_PROJECT)).snapshot.assetLibrary.assets;
    const pin = id => { const asset = leafAssets.find(asset => asset.assetId === `asset.assembly-${id}`); return { assetId: asset.assetId, assetVersion: asset.assetVersion, metadataVersion: asset.metadataVersion }; };
    const component = (id, position, stateIds = null) => ({ componentId: `component.${id}`, name: cuts.find(cut => cut.id === id).name, asset: pin(id), position, rotationDegrees: 0, scale: 1, stateIds, variantOverrides: [] });
    const body = component('graphite', { x: 0, y: 0 }); body.variantOverrides = [{ variantId: 'variant.copper', asset: pin('copper') }];
    const assembly = { schemaVersion: 1, coordinateSpace: 'assembly-pixels', unitsPerPixel: 1 / 64, placementBounds: { x: -192, y: -192, width: 384, height: 384 }, anchor: { x: 0, y: 0 },
      states: [{ stateId: 'state.idle', name: 'Idle' }, { stateId: 'state.ready', name: 'Coffee ready' }], variants: [{ variantId: 'variant.graphite', name: 'Graphite' }, { variantId: 'variant.copper', name: 'Copper' }], defaultStateId: 'state.idle', defaultVariantId: 'variant.graphite',
      components: [component('display', { x: 0, y: -60 }), component('cup', { x: 80, y: 0 }, ['state.ready']), body], blocking: { mode: 'components', regions: [] } };
    await execute('assembly.save', { assetId: ASSEMBLY_FIXTURE_ASSET, operation: 'create', expectedAssetVersion: 0, expectedMetadataVersion: 0, name: 'Coffee station', kind: 'prop', metadata: { role: 'coffee-machine', tags: ['synthetic-fixture'] }, assembly });
    const graphite = leafAssets.find(asset => asset.assetId === pin('graphite').assetId);
    await execute('asset.save', { assetId: graphite.assetId, operation: 'update', expectedAssetVersion: graphite.assetVersion, expectedMetadataVersion: graphite.metadataVersion,
      name: 'Graphite body — newer Library head', kind: 'prop', metadata: metadata(cuts[0]), image: { mode: 'retain' } });
    const project = await running.studioService.readProjectTrusted(ASSEMBLY_FIXTURE_PROJECT);
    const result = { schemaVersion: 1, projectId: ASSEMBLY_FIXTURE_PROJECT, assetId: ASSEMBLY_FIXTURE_ASSET, revision: project.revision,
      sourceDigest: artifact.digest, nativeAssets: leafAssets.map(asset => ({ assetId: asset.assetId, assetVersion: asset.assetVersion, metadataVersion: asset.metadataVersion, digest: asset.sliceBinding.digest })), oldComponentPinPreserved: true };
    await writeFile(resolve(dataDirectory, 'assembly-fixture.json'), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' }); return result;
  } finally { await new Promise((done, reject) => running.server.close(error => error ? reject(error) : done())); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length !== 3) throw new Error('Usage: prepare-assembly-editor-fixture.js NEW_DATA_DIRECTORY');
  process.stdout.write(`${JSON.stringify(await prepareAssemblyEditorFixture(process.argv[2]))}\n`);
}
