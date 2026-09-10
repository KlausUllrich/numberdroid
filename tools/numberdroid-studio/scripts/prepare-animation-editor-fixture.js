import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { startStudioHttpServer } from '../apps/studio-server/src/server.js';
import { encodeCanonicalRgbaPng } from '../packages/preview/src/index.js';
import { spatialAliases } from '../packages/domain/src/asset-spatial-geometry.js';

export const ANIMATION_FIXTURE_PROJECT = 'project.animation-editor';
export const ANIMATION_FIXTURE_CLIP = 'clip.brewing-display';
export const ANIMATION_FIXTURE_ASSEMBLY = 'assembly.animated-coffee-station';
export const ANIMATION_FIXTURE_CLIP_PROPOSAL = 'proposal.animation-longer-hold';
export const ANIMATION_FIXTURE_ASSEMBLY_PROPOSAL = 'proposal.animation-raised-display';
const owner = { actor: { id: 'local.designer', kind: 'human', displayName: 'Local designer' }, taskId: null, grantId: null, branchId: 'branch.main' };
const cuts = [
  { id: 'graphite', name: 'Graphite machine', x: 0, y: 0, width: 64, height: 96, kind: 'body', color: [71, 94, 88] },
  { id: 'copper', name: 'Copper machine', x: 64, y: 0, width: 64, height: 96, kind: 'body', color: [172, 111, 68] },
  ...Array.from({ length: 4 }, (_, index) => ({ id: `brewing-${index + 1}`, name: `Brewing ${index + 1}`, x: 128 + index * 32, y: 0, width: 32, height: 20, kind: 'frame', index })),
  { id: 'idle', name: 'Display idle', x: 128, y: 24, width: 32, height: 20, kind: 'still', color: [117, 173, 136] },
  { id: 'ready', name: 'Display ready', x: 160, y: 24, width: 32, height: 20, kind: 'still', color: [227, 190, 94] },
  { id: 'cup', name: 'Ready cup', x: 192, y: 24, width: 24, height: 32, kind: 'cup', color: [229, 220, 180] },
];
function syntheticSheet() {
  const width = 256, height = 104, rgba = Buffer.alloc(width * height * 4);
  const rect = (cut, x, y, w, h, color) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const at = ((cut.y + yy) * width + cut.x + xx) * 4;
      rgba[at] = color[0]; rgba[at + 1] = color[1]; rgba[at + 2] = color[2]; rgba[at + 3] = 255;
    }
  };
  for (const cut of cuts) {
    if (cut.kind === 'body') {
      rect(cut, 3, 3, 58, 88, [32, 49, 45]); rect(cut, 6, 6, 52, 82, cut.color);
      rect(cut, 10, 12, 44, 29, [20, 34, 29]); rect(cut, 27, 48, 10, 18, [35, 42, 37]);
      rect(cut, 10, 79, 44, 6, [31, 44, 38]); rect(cut, 8, 91, 9, 3, [20, 28, 24]); rect(cut, 47, 91, 9, 3, [20, 28, 24]);
    } else if (cut.kind === 'frame') {
      rect(cut, 2, 2, 28, 16, [13, 31, 23]);
      for (let i = 0; i <= cut.index; i++) rect(cut, 5 + i * 6, 5, 4, 10, [107 + i * 25, 210, 130]);
    } else if (cut.kind === 'still') {
      rect(cut, 2, 2, 28, 16, [13, 31, 23]); rect(cut, 7, 7, 18, 6, cut.color);
    } else {
      rect(cut, 3, 8, 16, 19, cut.color); rect(cut, 18, 11, 4, 9, cut.color); rect(cut, 5, 9, 12, 3, [100, 67, 38]);
    }
  }
  return encodeCanonicalRgbaPng({ width, height, rgba });
}
function nativeMetadata(cut) {
  const blocked = cut.kind === 'body';
  const spatial = { schemaVersion: 1, coordinateSpace: 'image-pixels', unitsPerPixel: { x: 1 / 64, y: 1 / 64 },
    placementBounds: { x: 0, y: 0, width: cut.width, height: cut.height }, anchor: { x: cut.width / 2, y: blocked ? 90 : cut.kind === 'cup' ? 27 : 10 },
    blockingRegions: blocked ? [{ regionId: 'body', name: 'Machine body', shape: { kind: 'rectangle', x: 6, y: 6, width: 52, height: 82 } }] : [] };
  return { role: blocked ? 'machine' : 'appearance', tags: ['synthetic-animation-fixture'], variantGroup: null, compatibilityGroups: [], ...spatialAliases(spatial), spatial,
    attachment: 'ground', rotationPolicy: 'cardinal', placement: { modes: ['manual'], wallSafe: true, tags: [], confirmation: 'confirmed' },
    navigation: { effect: blocked ? 'blocked' : 'passable', cost: null }, runtimeEligible: false, connectors: [], continuityProfile: null,
    continuityTags: [], selectionPriority: 0, visualWeight: 'medium', extensions: {} };
}
export async function prepareAnimationEditorFixture(directory) {
  const dataDirectory = resolve(directory);
  try { await mkdir(dataDirectory, { recursive: false }); }
  catch (error) { if (error.code === 'EEXIST') throw new Error('Animation fixture requires an absent directory. Existing work is preserved.'); throw error; }
  let tick = 0, sequence = 0;
  const running = await startStudioHttpServer({ dataDirectory, host: '127.0.0.1', port: 0, storeMode: 'sqlite', pairingEnabled: false, operationsConfigurationFilename: null,
    clock: () => new Date(Date.UTC(2026, 8, 10, 12, 0, tick++)).toISOString() });
  const execute = async (type, payload) => {
    const revision = type === 'project.create' ? 0 : (await running.studioService.readProjectTrusted(ANIMATION_FIXTURE_PROJECT)).revision;
    const id = `fixture.animation.${++sequence}`;
    return running.studioService.execute({ schemaVersion: 1, commandId: id, idempotencyKey: id, type, projectId: ANIMATION_FIXTURE_PROJECT, baseRevision: revision, expectedVersion: revision, payload }, owner);
  };
  try {
    if ((await running.studioService.listProjectsTrusted()).length) throw new Error('Animation fixture refuses a workspace containing saved projects.');
    await execute('project.create', { name: 'Animation editor — synthetic test', description: 'Fresh deterministic PNG cuts and animation proof. This is not production artwork or user acceptance.', ownerId: owner.actor.id });
    const artifact = await running.artifactStore.ingest(syntheticSheet(), { mediaType: 'image/png' });
    running.sourceIntakeStore.stage(artifact, { projectId: ANIMATION_FIXTURE_PROJECT, intakeId: 'intake.animation', idempotencyKey: 'intake.animation', origin: 'human_upload', createdRevision: 1 });
    await execute('source.intake.commit', { intakeId: 'intake.animation', sourceId: 'source.animation-sheet', name: 'Synthetic animation components', artifactUri: artifact.uri,
      mediaType: artifact.mediaType, byteSize: artifact.byteSize, width: artifact.width, height: artifact.height,
      provenance: { origin: 'human_upload', prompt: null, negativePrompt: null, seed: null, provider: null, model: null, modelVersion: null, generator: null, parameters: {}, referenceArtifactUris: [], parentSourceIds: [] } });
    await execute('source.review.propose', { sourceId: 'source.animation-sheet', note: 'Synthetic fixture only.' });
    await execute('source.review.decide', { sourceId: 'source.animation-sheet', disposition: 'APPROVED', note: 'Synthetic fixture only.' });
    const defined = await execute('atlas.define.rects', { atlasId: 'atlas.animation-components', sourceId: 'source.animation-sheet', name: 'Animation components', expectedAtlasVersion: 0,
      rectangles: cuts.map(cut => ({ rectangleId: `rect.${cut.id}`, name: cut.name, x: cut.x, y: cut.y, width: cut.width, height: cut.height, included: true, pivot: null, transparentPaddingPolicy: 'preserve_exact_rect', replacesSliceId: null, expectedSliceVersion: null })) });
    const job = { atlasId: 'atlas.animation-components', expectedAtlasVersion: 1, expectedDefinitionFingerprint: defined.value.definitionFingerprint, jobId: 'job.animation-cuts' };
    await execute('atlas.preview.slices', job);
    await running.atlasPreviewWorker.kick(); await running.atlasPreviewWorker.kick();
    const committed = await execute('atlas.commit.slices', job);
    const slice = id => { const value = committed.value.slices.find(value => value.rectangleId === `rect.${id}`); if (!value) throw new Error(`Missing saved cut ${id}.`); return value; };
    for (const cut of cuts.filter(cut => cut.kind !== 'frame')) {
      const image = slice(cut.id);
      await execute('asset.save', { assetId: `asset.animation-${cut.id}`, operation: 'create', expectedAssetVersion: 0, expectedMetadataVersion: 0, name: cut.name, kind: 'prop',
        metadata: nativeMetadata(cut), image: { mode: 'saved-slice', sliceId: image.sliceId, expectedSliceVersion: image.version } });
    }
    const clip = { schemaVersion: 1, coordinateSpace: 'clip-pixels', unitsPerPixel: 1 / 64, fps: 6, playbackMode: 'pingpong', canvas: { width: 32, height: 20 }, anchor: { x: 16, y: 10 },
      frames: cuts.filter(cut => cut.kind === 'frame').map((cut, index) => ({ frameId: `frame.brewing-${index + 1}`, name: cut.name,
        slice: { sliceId: slice(cut.id).sliceId, sliceVersion: 1 }, durationMs: index === 1 ? 320 : null, offset: { x: 0, y: 0 } })) };
    const clipPayload = { assetId: ANIMATION_FIXTURE_CLIP, operation: 'create', expectedAssetVersion: 0, expectedMetadataVersion: 0,
      name: 'Brewing display', kind: 'prop', metadata: { role: 'status-display', tags: ['synthetic-animation-fixture'] }, clip };
    await execute('clip.save', clipPayload);
    const image = id => ({ kind: 'image', asset: { assetId: `asset.animation-${id}`, assetVersion: 1, metadataVersion: 1 } });
    const component = (id, name, content, position) => ({ componentId: `component.${id}`, name, content, position, rotationDegrees: 0, scale: 1, stateIds: null, stateOverrides: [], variantOverrides: [] });
    const body = component('body', 'Machine body', image('graphite'), { x: 0, y: 0 }); body.variantOverrides = [{ variantId: 'variant.copper', content: image('copper') }];
    const display = component('display', 'Status display', image('idle'), { x: 0, y: -64 });
    display.stateOverrides = [{ stateId: 'state.brewing', content: { kind: 'animation', asset: { assetId: ANIMATION_FIXTURE_CLIP, assetVersion: 1, metadataVersion: 1 } } }, { stateId: 'state.ready', content: image('ready') }];
    const cup = component('cup', 'Ready cup', image('cup'), { x: 0, y: -6 }); cup.stateIds = ['state.ready'];
    const assembly = { schemaVersion: 2, coordinateSpace: 'assembly-pixels', unitsPerPixel: 1 / 64,
      placementBounds: { x: -40, y: -96, width: 80, height: 112 }, anchor: { x: 0, y: 0 },
      states: [{ stateId: 'state.idle', name: 'Idle' }, { stateId: 'state.brewing', name: 'Brewing' }, { stateId: 'state.ready', name: 'Coffee ready' }],
      variants: [{ variantId: 'variant.graphite', name: 'Graphite' }, { variantId: 'variant.copper', name: 'Copper' }], defaultStateId: 'state.idle', defaultVariantId: 'variant.graphite',
      components: [cup, display, body], blocking: { mode: 'components', regions: [] } };
    const assemblyPayload = { assetId: ANIMATION_FIXTURE_ASSEMBLY, operation: 'create', expectedAssetVersion: 0, expectedMetadataVersion: 0,
      name: 'Animated coffee station', kind: 'prop', metadata: { role: 'coffee-machine', tags: ['synthetic-animation-fixture'] }, assembly };
    await execute('assembly.save', assemblyPayload);
    const proposedClip = structuredClone(clip); proposedClip.frames[2].durationMs = 750;
    await execute('clip.proposal.submit', { ...clipPayload, operation: 'update', expectedAssetVersion: 1, expectedMetadataVersion: 1,
      proposalId: ANIMATION_FIXTURE_CLIP_PROPOSAL, expectedProposalVersion: 0, clip: proposedClip });
    const proposedAssembly = structuredClone(assembly); proposedAssembly.components[1].position.y -= 4;
    await execute('assembly.proposal.submit', { ...assemblyPayload, operation: 'update', expectedAssetVersion: 1, expectedMetadataVersion: 1,
      proposalId: ANIMATION_FIXTURE_ASSEMBLY_PROPOSAL, expectedProposalVersion: 0, assembly: proposedAssembly });
    const project = await running.studioService.readProjectTrusted(ANIMATION_FIXTURE_PROJECT);
    const result = { schemaVersion: 1, projectId: ANIMATION_FIXTURE_PROJECT, clipId: ANIMATION_FIXTURE_CLIP, assemblyId: ANIMATION_FIXTURE_ASSEMBLY,
      clipProposalId: ANIMATION_FIXTURE_CLIP_PROPOSAL, assemblyProposalId: ANIMATION_FIXTURE_ASSEMBLY_PROPOSAL, revision: project.revision, sourceDigest: artifact.digest,
      savedCuts: committed.value.slices.map(({ sliceId, version, rectangleId, name, digest, width, height }) => ({ sliceId, version, rectangleId, name, digest, width, height })),
      clipPin: { assetId: ANIMATION_FIXTURE_CLIP, assetVersion: 1, metadataVersion: 1 }, defaultPlayback: 'pingpong', fixtureOnly: true };
    await writeFile(resolve(dataDirectory, 'animation-fixture.json'), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
    return result;
  } finally { await new Promise((done, reject) => running.server.close(error => error ? reject(error) : done())); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length !== 3) throw new Error('Usage: prepare-animation-editor-fixture.js NEW_DATA_DIRECTORY');
  process.stdout.write(`${JSON.stringify(await prepareAnimationEditorFixture(process.argv[2]))}\n`);
}
