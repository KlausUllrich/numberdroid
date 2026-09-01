import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStudioHttpServer } from '../apps/studio-server/src/server.js';

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const dataDirectory = resolve(process.argv[2] ?? '.numberdroid-studio-checkpoint-4-5-visual');
const projectId = 'numberdroid-studio-checkpoint-2c';
const owner = { id: 'local.designer', kind: 'human', displayName: 'Local designer' };
const ownerContext = { actor: owner, taskId: null, grantId: null, branchId: 'branch.main' };
const propSourcePath = resolve(moduleDirectory, '../../../art-source/approved/area-01-transfer-ship/transfer-system/source/transfer-apparatus__approved-original__2026-08-17.png');
const propSourceDigest = '4adecec81c5e241a0952e0ed353836d6776f60960e9c8d1cf6e53727e402812c';
const running = await startStudioHttpServer({
  dataDirectory,
  port: 0,
  clock: () => '2026-08-24T12:00:00.000Z',
});

function command(type, revision, id, payload) {
  return {
    schemaVersion: 1,
    commandId: `visual.4-5.${id}`,
    idempotencyKey: `visual.4-5.${id}`,
    type,
    projectId,
    baseRevision: revision,
    expectedVersion: revision,
    dryRun: false,
    payload,
  };
}

function propMetadata() {
  return {
    role: 'system-apparatus', tags: ['transfer', 'apparatus', 'representative-prop'], variantGroup: null,
    compatibilityGroups: [], spanTiles: { width: 2, height: 3 }, anchor: { x: 0, y: 2 },
    attachment: 'ground', rotationPolicy: 'cardinal',
    placement: { modes: ['manual'], wallSafe: false, tags: ['transfer-system'], confirmation: 'confirmed' },
    collision: { mode: 'bounds', bounds: { x: 0, y: 0, width: 2, height: 3 }, parts: [] },
    navigation: { effect: 'blocked', cost: null }, runtimeEligible: true,
    connectors: [], continuityProfile: null, continuityTags: [], selectionPriority: 20,
    visualWeight: 'heavy', extensions: {},
  };
}

try {
  const initial = await running.studioService.readProjectTrusted(projectId);
  const roomEntry = initial.snapshot.roomLibrary?.variants.find(({ roomVariantId }) => roomVariantId === 'room.family-gathering');
  const hallEntry = initial.snapshot.roomLibrary?.variants.find(({ roomVariantId }) => roomVariantId === 'hall.service-east-west');
  if (initial.revision !== 26 || roomEntry?.headVersion !== 6 || hallEntry?.headVersion !== 1) {
    throw new Error('Checkpoint 4.5 visual preparation requires the accepted Checkpoint 3 revision-26 fixture.');
  }
  const artifact = await running.artifactStore.ingest(await readFile(propSourcePath), {
    mediaType: 'image/png', expectedDigest: propSourceDigest,
    limits: { maxBytes: 4 * 1024 * 1024, maxWidth: 4096, maxHeight: 4096 },
  });
  running.sourceIntakeStore.stage(artifact, {
    projectId, intakeId: 'intake.transfer-apparatus-cp45', idempotencyKey: 'visual.4-5.intake.transfer-apparatus',
    origin: 'human_upload', createdRevision: 26, createdAt: '2026-08-24T12:00:01.000Z',
  });
  await running.studioService.execute(command('source.intake.commit', 26, 'prop-source-commit', {
    intakeId: 'intake.transfer-apparatus-cp45', sourceId: 'source.transfer-apparatus-cp45',
    name: 'Approved Transfer Apparatus', artifactUri: artifact.uri, mediaType: artifact.mediaType,
    byteSize: artifact.byteSize, width: artifact.width, height: artifact.height,
    provenance: {
      origin: 'human_upload', prompt: null, negativePrompt: null, seed: null, provider: null, model: null,
      modelVersion: null, generator: null, parameters: {}, referenceArtifactUris: [], parentSourceIds: [],
    },
  }), ownerContext);
  await running.studioService.execute(command('source.review.propose', 27, 'prop-source-propose', {
    sourceId: 'source.transfer-apparatus-cp45', note: 'Existing approved repository prop for representative preview evidence.',
  }), ownerContext);
  await running.studioService.execute(command('source.review.decide', 28, 'prop-source-approve', {
    sourceId: 'source.transfer-apparatus-cp45', disposition: 'APPROVED', note: 'Approved repository source reused without generation.',
  }), ownerContext);
  const defined = await running.studioService.execute(command('atlas.define.rects', 29, 'prop-atlas-define', {
    atlasId: 'atlas.transfer-apparatus-cp45', sourceId: 'source.transfer-apparatus-cp45',
    name: 'Transfer Apparatus exact full-image slice', expectedAtlasVersion: 0,
    rectangles: [{
      rectangleId: 'rect.transfer-apparatus.full', x: 0, y: 0, width: 1086, height: 1448,
      included: true, pivot: null, transparentPaddingPolicy: 'preserve_exact_rect',
      replacesSliceId: null, expectedSliceVersion: null,
    }],
  }), ownerContext);
  const jobId = 'job.transfer-apparatus-cp45.preview';
  await running.studioService.execute(command('atlas.preview.slices', 30, 'prop-atlas-preview', {
    atlasId: 'atlas.transfer-apparatus-cp45', expectedAtlasVersion: defined.value.definitionVersion,
    expectedDefinitionFingerprint: defined.value.definitionFingerprint, jobId,
  }), ownerContext);
  await running.atlasPreviewWorker.kick();
  const succeeded = running.jobStore.get(projectId, jobId);
  if (succeeded.state !== 'SUCCEEDED' || succeeded.outputs.length !== 1) {
    throw new Error(`Representative prop preview job ended in ${succeeded.state}.`);
  }
  const committed = await running.studioService.execute(command('atlas.commit.slices', 31, 'prop-atlas-commit', {
    atlasId: 'atlas.transfer-apparatus-cp45', expectedAtlasVersion: defined.value.definitionVersion,
    expectedDefinitionFingerprint: defined.value.definitionFingerprint, jobId,
  }), ownerContext);
  const slice = committed.value.slices[0];
  await running.studioService.execute(command('asset.proposal.submit', 32, 'prop-proposal', {
    proposalId: 'proposal.transfer-apparatus-cp45', expectedRevision: 32,
    items: [{
      itemId: 'item.transfer-apparatus-cp45', operation: 'create', assetId: 'asset.transfer-apparatus-cp45',
      expectedAssetVersion: 0, expectedMetadataVersion: 0, sliceId: slice.sliceId,
      expectedSliceVersion: slice.version, name: 'Transfer Apparatus', kind: 'prop', metadata: propMetadata(),
    }],
  }), ownerContext);
  await running.studioService.execute(command('asset.proposal.decide', 33, 'prop-decision', {
    proposalId: 'proposal.transfer-apparatus-cp45', expectedProposalVersion: 1,
    decisions: [{ itemId: 'item.transfer-apparatus-cp45', disposition: 'ACCEPTED', reason: null }],
  }), ownerContext);
  await running.studioService.execute(command('asset.proposal.apply', 34, 'prop-apply', {
    proposalId: 'proposal.transfer-apparatus-cp45', expectedProposalVersion: 2,
  }), ownerContext);
  await running.studioService.execute(command('room.variant.shape.set', 35, 'room-shape', {
    roomVariantId: 'room.family-gathering', expectedRoomVariantVersion: 6,
    voidCells: [{ x: 0, y: 0 }, { x: 3, y: 2 }], blockedCells: [{ x: 1, y: 2 }],
  }), ownerContext);

  const final = await running.studioService.readProjectTrusted(projectId);
  const irregular = final.snapshot.roomLibrary.variants.find(({ roomVariantId }) => roomVariantId === 'room.family-gathering').versions.at(-1);
  const rectangle = final.snapshot.roomLibrary.variants.find(({ roomVariantId }) => roomVariantId === 'hall.service-east-west').versions.at(-1);
  const prop = final.snapshot.assetLibrary.assets.find(({ assetId }) => assetId === 'asset.transfer-apparatus-cp45');
  const persistedErrors = irregular.findings.filter(({ severity }) => severity === 'ERROR');
  if (final.revision !== 36 || irregular.version !== 7
      || irregular.voidCells.length !== 2 || irregular.blockedCells.length !== 1
      || persistedErrors.length !== 5
      || persistedErrors[0].targetKind !== 'roomVariant'
      || persistedErrors.filter(({ targetKind }) => targetKind === 'roomPlacement').length !== 4
      || (rectangle.voidCells?.length ?? 0) !== 0 || (rectangle.blockedCells?.length ?? 0) !== 0
      || prop?.kind !== 'prop' || prop.lifecycle !== 'DRAFT'
      || prop.metadata.spanTiles.width !== 2 || prop.metadata.spanTiles.height !== 3) {
    throw new Error('Checkpoint 4.5 fixture did not reach its exact irregular, rectangular, and prop-preview state.');
  }
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 1,
    projectId,
    revision: final.revision,
    activityCount: 37,
    irregularRoom: {
      roomVariantId: irregular.roomVariantId, version: irregular.version,
      voidCells: irregular.voidCells, blockedCells: irregular.blockedCells,
      persistedErrorCount: persistedErrors.length,
      persistedErrorFindingIds: persistedErrors.map(({ findingId }) => findingId),
    },
    rectangularRoom: { roomVariantId: rectangle.roomVariantId, version: rectangle.version, voidCells: rectangle.voidCells ?? [], blockedCells: rectangle.blockedCells ?? [] },
    prop: {
      assetId: prop.assetId, assetVersion: prop.assetVersion, metadataVersion: prop.metadataVersion,
      kind: prop.kind, sourceDigest: propSourceDigest, sliceDigest: slice.digest,
    },
  }, null, 2)}\n`);
} finally {
  await new Promise((resolveClose) => running.server.close(resolveClose));
}
