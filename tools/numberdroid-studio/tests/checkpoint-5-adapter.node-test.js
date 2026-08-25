import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  NumberdroidAdapterError,
  buildNumberdroidCandidate,
  createNumberdroidExportSnapshot,
  sanitizeNumberdroidDiagnostic,
} from '../packages/numberdroid-adapter/src/index.js';

function buildWithCompiler(snapshot, overrides = {}) {
  return buildNumberdroidCandidate(snapshot, {
    compilerVersion: 'numberdroid-level-compiler.test-double.v1',
    validatePlacementOverrides(spec) {
      for (const override of spec.overrides ?? []) {
        if ((override.lockGeometry === true) !== Boolean(override.lockedGeometry)) throw new Error(`Invalid geometry lock ${override.targetId}.`);
        if ((override.lockPlacement === true) !== Boolean(override.lockedPlacement)) throw new Error(`Invalid placement lock ${override.targetId}.`);
      }
    },
    compileLevelSpec(spec, propRegistry) {
      const props = spec.props.map((request) => {
        const resolved = propRegistry[request.propId];
        if (!resolved) throw new Error(`Prop request ${request.id} references unregistered prop ${request.propId}.`);
        return { ...request, metadata: resolved };
      });
      return { levelId: spec.id, version: spec.version, props, diagnostics: [] };
    },
    compileWorkbenchPlan(spec, propRegistry) {
      const spaceOverride = spec.overrides.find((entry) => entry.lockGeometry === true);
      const space = spec.spaces.find((entry) => entry.id === spaceOverride.targetId);
      const spaceRect = {
        x: spaceOverride.lockedGeometry.offsetFromRootTiles.x,
        y: spaceOverride.lockedGeometry.offsetFromRootTiles.y,
        w: spaceOverride.lockedGeometry.sizeTiles.w,
        h: spaceOverride.lockedGeometry.sizeTiles.h,
      };
      const placements = spec.props.map((request) => {
        const lock = spec.overrides.find((entry) => entry.targetId === request.id).lockedPlacement;
        const footprint = propRegistry[request.propId].footprintTiles;
        return {
          id: `${request.id}.0`, requestId: request.id, spaceId: space.id,
          rect: { x: spaceRect.x + lock.offsetTiles.x, y: spaceRect.y + lock.offsetTiles.y, w: footprint.w, h: footprint.h },
          rotation: lock.rotation,
        };
      });
      return {
        actors: {
          props: {
            navigation: { geometry: { spaces: [{ ...space, rect: spaceRect }] } },
            placements,
          },
        },
      };
    },
    propRegistry: {
      'family-table': {
        id: 'family-table', footprintTiles: { w: 3, h: 2 }, allowedRotations: [0],
      },
    },
    propArtRegistry: {
      'family-table': { propId: 'family-table', asset: 'assets/deck/family-table-props.png', status: 'accepted' },
    },
    ...overrides,
  });
}

const hashes = Object.freeze({
  floorSlice: '1'.repeat(64),
  floorSource: '2'.repeat(64),
  tableSlice: '3'.repeat(64),
  tableSource: '4'.repeat(64),
});

function source(sourceId, digest, width, height, timestamp = '2026-08-25T08:00:00.000Z') {
  return {
    schemaVersion: 2,
    id: sourceId,
    intakeId: `intake.${sourceId}`,
    name: sourceId,
    artifactUri: `studio://artifacts/sha256/${digest}`,
    mediaType: 'image/png',
    byteSize: width * height,
    width,
    height,
    provenance: {
      origin: 'human_upload', prompt: null, negativePrompt: null, seed: null,
      provider: null, model: null, modelVersion: null, generator: null,
      parameters: {}, referenceArtifactUris: [], parentSourceIds: [],
    },
    lifecycle: { state: 'APPROVED_SOURCE', changedAt: timestamp, changedBy: 'designer.one' },
    review: { disposition: 'USER_APPROVED', decidedAt: timestamp, decidedBy: 'designer.one' },
    registeredAt: timestamp,
    registeredBy: 'designer.one',
  };
}

function sliceBinding({ assetId, sourceId, digest, sourceDigest, width, height }) {
  return {
    projectId: 'project.export',
    sliceId: `slice.${assetId}`,
    sliceVersion: 1,
    atlasId: `atlas.${assetId}`,
    sourceId,
    sourceDigest,
    definitionVersion: 1,
    definitionFingerprint: '5'.repeat(64),
    rectangleId: `rect.${assetId}`,
    rectangle: {
      x: 0, y: 0, width, height, included: true, pivot: null,
      transparentPaddingPolicy: 'preserve', replacesSliceId: null, expectedSliceVersion: null,
    },
    processorId: 'studio.slice.v1',
    digest,
    artifactUri: `studio://artifacts/sha256/${digest}`,
    mediaType: 'image/png',
    byteSize: width * height,
    width,
    height,
    priorDigest: null,
    committedRevision: 3,
  };
}

function metadata({ role, span }) {
  return {
    role,
    tags: ['family', 'domestic'],
    variantGroup: null,
    compatibilityGroups: [],
    spanTiles: span,
    anchor: { x: 0, y: 0 },
    attachment: 'ground',
    rotationPolicy: role === 'base' ? 'fixed' : 'cardinal',
    placement: { modes: ['manual'], wallSafe: true, tags: [], confirmation: 'confirmed' },
    collision: role === 'base'
      ? { mode: 'none', bounds: null, parts: [] }
      : { mode: 'bounds', bounds: { x: 0, y: 0, width: span.width, height: span.height }, parts: [] },
    navigation: { effect: role === 'base' ? 'passable' : 'blocked', cost: null },
    runtimeEligible: true,
    connectors: [],
    continuityProfile: null,
    continuityTags: [],
    selectionPriority: 0,
    visualWeight: 'medium',
    extensions: {},
  };
}

function asset({ assetId, kind, role, span, sourceId, digest, sourceDigest }) {
  const width = span.width * 64;
  const height = span.height * 64;
  return {
    assetId,
    assetVersion: 1,
    metadataVersion: 1,
    name: assetId,
    kind,
    lifecycle: 'FINAL',
    metadata: metadata({ role, span }),
    metadataFingerprint: '6'.repeat(64),
    findings: [],
    sliceBinding: sliceBinding({ assetId, sourceId, digest, sourceDigest, width, height }),
    warningDispositions: [],
    createdAt: '2026-08-25T08:00:00.000Z',
    createdBy: 'designer.one',
    updatedAt: '2026-08-25T08:00:00.000Z',
    updatedBy: 'designer.one',
    proposal: null,
  };
}

function placement({ placementId, assetId, layer, x, y }) {
  return {
    placementId,
    assetId,
    assetVersion: 1,
    metadataVersion: 1,
    layer,
    anchor: { x, y },
    rotation: 0,
    variantTag: null,
    proposalId: null,
    proposalItemId: null,
  };
}

function floorPlacements(width, height) {
  const values = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      values.push(placement({ placementId: `floor.${x}.${y}`, assetId: 'asset.floor', layer: 'STRUCTURAL_SURFACE', x, y }));
    }
  }
  return values;
}

function fixture({ timestamp = '2026-08-25T08:00:00.000Z', roomLifecycle = 'FINAL', masks = false } = {}) {
  const floor = asset({
    assetId: 'asset.floor', kind: 'surface', role: 'base', span: { width: 1, height: 1 },
    sourceId: 'source.floor', digest: hashes.floorSlice, sourceDigest: hashes.floorSource,
  });
  const table = asset({
    assetId: 'asset.table', kind: 'prop', role: 'furniture', span: { width: 3, height: 2 },
    sourceId: 'source.table', digest: hashes.tableSlice, sourceDigest: hashes.tableSource,
  });
  floor.createdAt = timestamp;
  table.createdAt = timestamp;
  const room = {
    projectId: 'project.export',
    roomVariantId: 'room.family-table',
    version: 4,
    roomArchetypeId: 'archetype.domestic',
    archetypeVersion: 1,
    displayName: 'Family Table Room',
    lifecycle: roomLifecycle,
    width: 6,
    height: 4,
    origin: { x: 0, y: 0 },
    intentTrace: [
      { layer: 'game_design', ruleId: 'gd.function-first', summary: 'Function before form.', disposition: 'governing' },
      { layer: 'level_design', ruleId: 'ld.distinct', summary: 'Rooms remain distinct.', disposition: 'governing' },
      { layer: 'room_design', ruleId: 'rd.domestic', summary: 'Supports domestic use.', disposition: 'governing' },
    ],
    connectors: [{
      connectorId: 'connector.west', side: 'west', offset: 1, width: 1,
      kind: 'standard-door', clearanceInside: 1, clearanceOutside: 1,
      required: true, tags: [], compatibilityProfile: 'door.standard',
    }],
    placements: [
      ...floorPlacements(6, 4),
      placement({ placementId: 'table.primary', assetId: 'asset.table', layer: 'SET_DRESSING', x: 2, y: 1 }),
    ],
    voidCells: masks ? [{ x: 5, y: 3 }] : [],
    blockedCells: masks ? [{ x: 0, y: 3 }] : [],
    acceptedWarningFindingIds: [],
    parentVariantVersion: 3,
    parentFinalVersion: null,
    contentFingerprint: '7'.repeat(64),
    findings: [],
    createdAt: timestamp,
    createdBy: 'designer.one',
  };
  const archetype = {
    projectId: 'project.export', roomArchetypeId: 'archetype.domestic', version: 1,
    kind: 'room', displayName: 'Domestic', tags: ['domestic', 'family'],
    dimensionPolicy: { width: { min: 3, preferred: 6, max: 64 }, height: { min: 3, preferred: 4, max: 64 } },
    structuralBands: { left: 0, right: 0, top: 0, bottom: 0 }, orientation: 'any',
    connectorPolicy: { min: 1, max: 8, requiredSides: [] },
    allowedAssetKinds: ['surface', 'prop', 'item'], allowedTags: [], requiredTags: [],
    rationality: 'domestic', governingRuleRefs: [{ ruleId: 'gd.function-first', summary: 'Function before form.' }],
  };
  const snapshot = {
    project: { id: 'project.export', name: 'Export Fixture', ownerId: 'designer.one' },
    sources: [
      source('source.floor', hashes.floorSource, 512, 512, timestamp),
      source('source.table', hashes.tableSource, 1024, 1024, timestamp),
    ],
    assetLibrary: { schemaVersion: 1, assets: [floor, table], proposals: [] },
    roomLibrary: {
      schemaVersion: 1,
      archetypes: [archetype],
      variants: [{ roomVariantId: room.roomVariantId, headVersion: room.version, versions: [room] }],
      proposals: [],
    },
  };
  return {
    projectDocument: {
      projectId: 'project.export',
      formatVersion: 3,
      revisions: [{ number: 12, snapshot }],
    },
    roomVariantId: room.roomVariantId,
    roomVariantVersion: room.version,
    adapterBindings: {
      schemaVersion: 1,
      assets: [
        {
          assetId: 'asset.table', assetVersion: 1, metadataVersion: 1,
          kind: 'prop', propId: 'family-table', floorMaterialId: null,
          runtimePath: 'public/assets/deck/family-table-props.png',
          sourceArtPath: 'art-source/approved/area-01-transfer-ship/family/table.png',
        },
        {
          assetId: 'asset.floor', assetVersion: 1, metadataVersion: 1,
          kind: 'floor-material', propId: null, floorMaterialId: 'family-floor',
          runtimePath: 'public/assets/deck/family-floor.png',
          sourceArtPath: 'art-source/approved/area-01-transfer-ship/family/floor.png',
        },
      ],
    },
    artifactVerifications: {
      schemaVersion: 1,
      verifierVersion: 'numberdroid-studio.cas-integrity.test.v1',
      artifacts: [
        { digest: hashes.floorSlice, byteSize: 64 * 64, mediaType: 'image/png', width: 64, height: 64 },
        { digest: hashes.floorSource, byteSize: 512 * 512, mediaType: 'image/png', width: 512, height: 512 },
        { digest: hashes.tableSlice, byteSize: 192 * 128, mediaType: 'image/png', width: 192, height: 128 },
        { digest: hashes.tableSource, byteSize: 1024 * 1024, mediaType: 'image/png', width: 1024, height: 1024 },
      ],
    },
    exportProfile: {
      schemaVersion: 1,
      levelId: 'studio.family-table',
      seed: 'studio-family-table-v4',
      sizeClass: 'small',
      corridorOrientation: 'any',
      floorName: 'FAMILY TABLE',
      subtitle: 'STUDIO CANDIDATE',
      objectiveDefault: null,
      objectiveAfterEnergy: null,
    },
  };
}

export const checkpoint5GoldenFixture = fixture;
export const buildCheckpoint5TestCandidate = buildWithCompiler;

test('immutable snapshot and compiler-validated candidate match the deterministic golden manifest', async () => {
  const input = fixture();
  const firstSnapshot = createNumberdroidExportSnapshot(input);
  const reordered = fixture({ timestamp: '2099-01-01T00:00:00.000Z' });
  reordered.adapterBindings.assets.reverse();
  const secondSnapshot = createNumberdroidExportSnapshot(reordered);
  assert.deepEqual(secondSnapshot, firstSnapshot);
  assert.equal(Object.isFrozen(firstSnapshot), true);

  const first = buildWithCompiler(firstSnapshot);
  const second = buildWithCompiler(secondSnapshot);
  assert.equal(first.status, 'BLOCKED');
  assert.equal(first.manifestHash, second.manifestHash);
  assert.equal(first.manifestJson, second.manifestJson);
  assert.equal(first.manifest.compiler.version, 'numberdroid-level-compiler.test-double.v1');
  assert.deepEqual(first.manifest.stages, {
    candidate: 'BLOCKED', materialize: 'NOT_AUTHORIZED', commit: 'NOT_AUTHORIZED', publish: 'NOT_AUTHORIZED',
  });
  assert.deepEqual(first.levelSpec.overrides[0].lockedGeometry, {
    offsetFromRootTiles: { x: 0, y: 0 }, sizeTiles: { w: 6, h: 4 },
  });
  assert.deepEqual(first.levelSpec.overrides[1].lockedPlacement, {
    offsetTiles: { x: 2, y: 1 }, rotation: 0, wallSide: null,
  });
  assert.equal(first.artifacts.some((entry) => entry.sha256 === hashes.tableSlice && entry.role === 'runtime'), true);
  assert.equal(first.artifacts.some((entry) => entry.sha256 === hashes.tableSource && entry.role === 'source-art'), true);
  assert.equal(JSON.stringify(first).includes('base64'), false);
  const golden = JSON.parse(await readFile(new URL('../fixtures/checkpoint-5/final-rectangular-room/golden-manifest.json', import.meta.url), 'utf8'));
  assert.deepEqual({
    schemaVersion: golden.schemaVersion,
    fixture: golden.fixture,
    compilerAuthority: first.manifest.compiler.version,
    snapshotId: first.snapshotId,
    manifestHash: first.manifestHash,
    status: first.status,
    files: first.manifest.files.map(({ logicalPath, sha256, role }) => ({ logicalPath, sha256, role })),
    findings: first.findings.map(({ severity, ruleId }) => ({ severity, ruleId })),
    stages: first.manifest.stages,
  }, golden);
});

test('snapshot fails closed on non-FINAL versions, missing pins, forbidden authority fields, and unsafe paths', () => {
  const draft = fixture({ roomLifecycle: 'DRAFT' });
  assert.throws(() => createNumberdroidExportSnapshot(draft), (error) => error.code === 'NUMBERDROID_ADAPTER_ROOM_NOT_FINAL');

  const missing = fixture();
  missing.projectDocument.revisions[0].snapshot.assetLibrary.assets.pop();
  assert.throws(() => createNumberdroidExportSnapshot(missing), (error) => error.code === 'NUMBERDROID_ADAPTER_ASSET_VERSION_NOT_FOUND');

  const unverified = fixture();
  unverified.artifactVerifications.artifacts.pop();
  assert.throws(() => createNumberdroidExportSnapshot(unverified), (error) => error.code === 'NUMBERDROID_ADAPTER_ARTIFACT_NOT_VERIFIED');

  const wrongDimensions = fixture();
  wrongDimensions.artifactVerifications.artifacts.find((entry) => entry.digest === hashes.tableSlice).width = 191;
  assert.throws(() => createNumberdroidExportSnapshot(wrongDimensions), (error) => error.code === 'NUMBERDROID_ADAPTER_ARTIFACT_NOT_VERIFIED');

  const authority = fixture();
  authority.exportProfile.publish = true;
  assert.throws(() => createNumberdroidExportSnapshot(authority), (error) => error.code === 'NUMBERDROID_ADAPTER_FIELD_FORBIDDEN');

  const traversal = fixture();
  traversal.adapterBindings.assets[0].runtimePath = 'public/../secrets.png';
  assert.throws(() => createNumberdroidExportSnapshot(traversal), (error) => error.code === 'NUMBERDROID_ADAPTER_PATH_UNSAFE');

  const collision = fixture();
  collision.adapterBindings.assets[0].runtimePath = 'public/assets/deck/FAMILY-FLOOR.png';
  assert.throws(() => createNumberdroidExportSnapshot(collision), (error) => error.code === 'NUMBERDROID_ADAPTER_PATH_COLLISION');
});

test('irregular room masks remain reviewable, block approval, and skip misleading rectangular compiler approval', () => {
  const snapshot = createNumberdroidExportSnapshot(fixture({ masks: true }));
  const candidate = buildWithCompiler(snapshot);
  assert.equal(candidate.status, 'BLOCKED');
  assert.equal(candidate.manifest.compiler.status, 'SKIPPED_UNSUPPORTED_SHAPE');
  assert.equal(candidate.findings.some((finding) => finding.ruleId === 'numberdroid.adapter.room_shape_unsupported'), true);
  const roomFile = candidate.textFiles.find((entry) => entry.logicalPath.endsWith('/studio-room.json'));
  assert.match(roomFile.content, /"voidCells"/);
  assert.match(roomFile.content, /"blockedCells"/);
  assert.equal(candidate.manifest.stages.materialize, 'NOT_AUTHORIZED');
});

test('compiler failures are sanitized and a corrected exact binding restores successful compilation', () => {
  const brokenInput = fixture();
  brokenInput.adapterBindings.assets[0].propId = 'not-registered';
  const broken = buildWithCompiler(createNumberdroidExportSnapshot(brokenInput));
  assert.equal(broken.status, 'BLOCKED');
  const finding = broken.findings.find((entry) => entry.ruleId === 'numberdroid.compiler.validation_failed');
  assert.match(finding.explanation, /unregistered prop not-registered/);
  assert.equal(finding.explanation.includes(process.cwd()), false);
  assert.equal(Object.hasOwn(finding, 'stack'), false);

  const fixed = buildWithCompiler(createNumberdroidExportSnapshot(fixture()));
  assert.equal(fixed.manifest.compiler.status, 'SUCCEEDED');
  assert.equal(fixed.status, 'BLOCKED');
  assert.notEqual(fixed.snapshotId, broken.snapshotId);
  assert.notEqual(fixed.manifestHash, broken.manifestHash);
});

test('pure candidate construction without the canonical bridge remains blocked and grants no later-stage authority', () => {
  const candidate = buildNumberdroidCandidate(createNumberdroidExportSnapshot(fixture()));
  assert.equal(candidate.status, 'BLOCKED');
  assert.equal(candidate.findings.some((finding) => finding.ruleId === 'numberdroid.compiler.not_invoked'), true);
  assert.deepEqual(candidate.manifest.stages, {
    candidate: 'BLOCKED', materialize: 'NOT_AUTHORIZED', commit: 'NOT_AUTHORIZED', publish: 'NOT_AUTHORIZED',
  });
  for (const forbidden of ['destinationPath', 'repoPath', 'branch', 'token', 'commitSha', 'publishGrant']) {
    assert.equal(JSON.stringify(candidate).includes(`"${forbidden}"`), false);
  }
  assert.equal(candidate.artifacts.every((entry) => entry.sourceArtifactUri.startsWith('studio://artifacts/sha256/')), true);
});

test('two exact surface bindings cannot hide behind one floor material ID', () => {
  const input = fixture();
  const projection = input.projectDocument.revisions[0].snapshot;
  const alternateSlice = '8'.repeat(64);
  const alternateSource = '9'.repeat(64);
  const alternate = structuredClone(projection.assetLibrary.assets.find((entry) => entry.assetId === 'asset.floor'));
  alternate.assetId = 'asset.floor.alt';
  alternate.name = 'alternate floor';
  alternate.sliceBinding.sliceId = 'slice.asset.floor.alt';
  alternate.sliceBinding.sourceId = 'source.floor.alt';
  alternate.sliceBinding.sourceDigest = alternateSource;
  alternate.sliceBinding.digest = alternateSlice;
  alternate.sliceBinding.artifactUri = `studio://artifacts/sha256/${alternateSlice}`;
  projection.assetLibrary.assets.push(alternate);
  projection.sources.push(source('source.floor.alt', alternateSource, 512, 512));
  const floorPlacement = projection.roomLibrary.variants[0].versions[0].placements.find((entry) => entry.layer === 'STRUCTURAL_SURFACE');
  floorPlacement.assetId = alternate.assetId;
  input.adapterBindings.assets.push({
    assetId: alternate.assetId, assetVersion: 1, metadataVersion: 1,
    kind: 'floor-material', propId: null, floorMaterialId: 'family-floor',
    runtimePath: 'public/assets/deck/family-floor-alt.png',
    sourceArtPath: 'art-source/approved/area-01-transfer-ship/family/floor-alt.png',
  });
  input.artifactVerifications.artifacts.push(
    { digest: alternateSlice, byteSize: 64 * 64, mediaType: 'image/png', width: 64, height: 64 },
    { digest: alternateSource, byteSize: 512 * 512, mediaType: 'image/png', width: 512, height: 512 },
  );
  const candidate = buildWithCompiler(createNumberdroidExportSnapshot(input));
  assert.equal(candidate.findings.some((finding) => finding.ruleId === 'numberdroid.adapter.floor_material_multiple_bindings'), true);
  assert.equal(candidate.status, 'BLOCKED');
});

test('candidate art, shadow, and exact-fit registry dependencies block incomplete Prop fidelity', () => {
  const snapshot = createNumberdroidExportSnapshot(fixture());
  const candidate = buildWithCompiler(snapshot, {
    propRegistry: {
      'family-table': {
        id: 'family-table', footprintTiles: { w: 3, h: 2 }, allowedRotations: [0],
        attachment: 'floor', placement: { forbidDoorClearance: true },
        exactFit: { placementEnvelope: 'visual', wallBoundary: 'visual' },
      },
    },
    propArtRegistry: {
      'family-table': {
        propId: 'family-table', asset: 'assets/deck/family-table-props.png',
        shadowAsset: 'assets/deck/family-table-shadow.png', status: 'candidate',
      },
    },
  });
  const rules = new Set(candidate.findings.map((finding) => finding.ruleId));
  assert.equal(rules.has('numberdroid.adapter.prop_art_not_accepted'), true);
  assert.equal(rules.has('numberdroid.adapter.prop_shadow_mapping_unsupported'), true);
  assert.equal(rules.has('numberdroid.adapter.prop_exact_contract_unmapped'), true);
  assert.equal(candidate.status, 'BLOCKED');
});

test('serialized or caller-constructed snapshots cannot become provenance authority', () => {
  const snapshot = createNumberdroidExportSnapshot(fixture());
  const serialized = structuredClone(snapshot);
  assert.equal(serialized.snapshotId, snapshot.snapshotId);
  assert.throws(() => buildWithCompiler(serialized), (error) => error.code === 'NUMBERDROID_ADAPTER_SNAPSHOT_UNTRUSTED');
});

test('diagnostic sanitization removes short Unix, Windows, and UNC machine paths', () => {
  assert.equal(sanitizeNumberdroidDiagnostic('Failure at /tmp/a.ts:1:2'), 'Failure at <machine-path>');
  assert.equal(sanitizeNumberdroidDiagnostic('Failure at C:\\work\\a.ts:1'), 'Failure at <machine-path>');
  assert.equal(sanitizeNumberdroidDiagnostic('Failure at \\\\server\\share\\a.ts:4'), 'Failure at <machine-path>');
  assert.equal(sanitizeNumberdroidDiagnostic('Failure at /Users/Jane Doe/repo/a.ts:1:2'), 'Failure at <machine-path>');
  assert.equal(sanitizeNumberdroidDiagnostic('Failure at C:\\Users\\Jane Doe\\repo\\a.ts:1:2'), 'Failure at <machine-path>');
  assert.equal(sanitizeNumberdroidDiagnostic('Failure at \\\\server\\shared folder\\a.ts:4'), 'Failure at <machine-path>');
});

test('adapter errors expose stable codes without implementation authority', () => {
  const error = new NumberdroidAdapterError('EXAMPLE', 'example', { field: 'x' });
  assert.equal(error.code, 'EXAMPLE');
  assert.deepEqual(error.details, { field: 'x' });
});
