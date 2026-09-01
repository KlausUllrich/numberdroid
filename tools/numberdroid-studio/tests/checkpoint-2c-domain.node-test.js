import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ASSET_LIFECYCLES,
  ASSET_VALIDATOR_VERSION,
  MAX_ASSET_PROPOSAL_ITEMS,
  evaluateAssetLifecycle,
  validateAssetMetadata,
  validateAssetProposal,
  validateExactSliceBinding,
  validateSurfaceTilingDomain,
} from '../packages/domain/src/index.js';

const projectId = 'project.family-hygiene';
const sliceBinding = {
  projectId,
  sliceId: 'slice.family.0.0',
  sliceVersion: 1,
  atlasId: 'atlas.family.2b',
  sourceId: 'source.family.2b',
  sourceDigest: '67b87430b0c78b6bb9b3af5b3a8bc75c9156a38d75b433a1cbbef8fd7979c71e',
  definitionVersion: 1,
  definitionFingerprint: 'ff8ba1f46507e2925b3ca850be6fab082743d0877db816238044597445921617',
  rectangleId: 'rect.family.0.0',
  rectangle: {
    x: 3,
    y: 3,
    width: 622,
    height: 622,
    included: true,
    pivot: null,
    transparentPaddingPolicy: 'preserve_exact_rect',
    replacesSliceId: null,
    expectedSliceVersion: null,
  },
  processorId: 'numberdroid-studio.exact-png-crop.v1',
  digest: 'ef83efbee4b00ec49679f0409ba6f33423729b9d67946ba45f3ab119a91886f2',
  artifactUri: 'studio://artifacts/sha256/ef/83/ef83efbee4b00ec49679f0409ba6f33423729b9d67946ba45f3ab119a91886f2',
  mediaType: 'image/png',
  byteSize: 1548341,
  width: 622,
  height: 622,
  priorDigest: null,
  committedRevision: 7,
};

function familySurface(overrides = {}) {
  return {
    role: 'base',
    tags: ['family', 'hygiene'],
    variantGroup: null,
    compatibilityGroups: ['family-hygiene-floor'],
    spanTiles: { width: 1, height: 1 },
    anchor: { x: 0, y: 0 },
    attachment: 'ground',
    rotationPolicy: 'fixed',
    placement: {
      modes: ['manual'],
      wallSafe: true,
      tags: ['calm-base'],
      confirmation: 'confirmed',
    },
    collision: { mode: 'none', bounds: null, parts: [] },
    navigation: { effect: 'passable', cost: null },
    runtimeEligible: false,
    connectors: [],
    continuityProfile: null,
    continuityTags: [],
    selectionPriority: 0,
    visualWeight: 'medium',
    extensions: {},
    ...overrides,
  };
}

test('exact slice bindings are normalized without weakening immutable imagery coordinates', () => {
  const normalized = validateExactSliceBinding(sliceBinding);
  assert.deepEqual(normalized, sliceBinding);
  assert.throws(() => validateExactSliceBinding({ ...sliceBinding, width: 621 }), (error) => (
    error.code === 'ASSET_SLICE_BINDING_INVALID'
  ));
  assert.throws(() => validateExactSliceBinding({ ...sliceBinding, extra: true }), (error) => (
    error.code === 'VALIDATION_ERROR'
  ));
  assert.throws(() => validateExactSliceBinding({
    ...sliceBinding,
    artifactUri: 'file:///tmp/caller-controlled.png',
  }), (error) => error.code === 'ASSET_SLICE_BINDING_INVALID');
});

test('typed surface metadata preserves explicit Family Hygiene semantics and copied pixel facts', () => {
  const result = validateAssetMetadata({
    assetId: 'asset.family.0.0',
    kind: 'surface',
    metadata: familySurface(),
    sliceBinding,
  });
  assert.deepEqual(result.findings, []);
  assert.equal(result.metadata.pixelSize.width, 622);
  assert.equal(result.metadata.pixelSize.height, 622);
  assert.equal(result.metadata.pivot, null);
  assert.equal(result.metadata.runtimeEligible, false);
  assert.equal(result.metadata.navigation.effect, 'passable');
  assert.match(result.fingerprint, /^[a-f0-9]{64}$/);
});

test('typed metadata fingerprint is independent of exact imagery identity', () => {
  const first = validateAssetMetadata({
    assetId: 'asset.family.0.0', kind: 'surface', metadata: familySurface(), sliceBinding,
  });
  const replacementDigest = '3781086c30598cf8c07582f9b830e3343e0e1363f2e7c17d35a6678eeeb41c7e';
  const replacement = validateAssetMetadata({
    assetId: 'asset.family.0.0',
    kind: 'surface',
    metadata: familySurface(),
    sliceBinding: {
      ...sliceBinding,
      sliceId: 'slice.family.0.1',
      rectangleId: 'rect.family.0.1',
      rectangle: { ...sliceBinding.rectangle, x: 629 },
      digest: replacementDigest,
      artifactUri: `studio://artifacts/sha256/37/81/${replacementDigest}`,
    },
  });
  assert.equal(replacement.fingerprint, first.fingerprint);

  const semanticChange = validateAssetMetadata({
    assetId: 'asset.family.0.0',
    kind: 'surface',
    metadata: familySurface({ selectionPriority: 1 }),
    sliceBinding,
  });
  assert.notEqual(semanticChange.fingerprint, first.fingerprint);
});

test('missing author decisions become stable ordered findings rather than invented values', () => {
  const draft = familySurface({
    role: null,
    spanTiles: null,
    placement: {
      modes: [], wallSafe: null, tags: [], confirmation: 'missing',
    },
    collision: null,
    navigation: null,
    runtimeEligible: null,
    visualWeight: null,
  });
  const first = validateAssetMetadata({
    assetId: 'asset.family.draft', kind: 'surface', metadata: draft, sliceBinding,
  });
  const second = validateAssetMetadata({
    assetId: 'asset.family.draft', kind: 'surface', metadata: draft, sliceBinding,
  });
  assert.deepEqual(first.findings, second.findings);
  assert.deepEqual(first.findings.map(({ ruleId, path }) => [ruleId, path]), [
    ['studio.asset.collision.required', '/collision'],
    ['studio.asset.navigation.required', '/navigation'],
    ['studio.asset.placement.confirmation_required', '/placement/confirmation'],
    ['studio.asset.role.required', '/role'],
    ['studio.asset.runtime_eligibility.required', '/runtimeEligible'],
    ['studio.asset.span.required', '/spanTiles'],
    ['studio.asset.visual_weight.required', '/visualWeight'],
    ['studio.asset.wall_safety.required', '/placement/wallSafe'],
  ]);
  assert.ok(first.findings.every((finding) => (
    finding.findingId.match(/^[a-f0-9]{64}$/)
    && finding.validatorVersion === ASSET_VALIDATOR_VERSION
    && finding.targetId === 'asset.family.draft'
  )));
});

test('unknown fields and unsafe or unbounded extensions fail closed', () => {
  assert.throws(() => validateAssetMetadata({
    assetId: 'asset.unknown', kind: 'surface', metadata: familySurface({ pixelsKnowTopology: true }), sliceBinding,
  }), (error) => error.code === 'VALIDATION_ERROR' && error.details.field === 'metadata.pixelsKnowTopology');

  for (const extensions of [
    { numberdroid: { token: 'secret' } },
    { 'numberdroid.adapter': { sourcePath: '/tmp/source.png' } },
    { 'numberdroid.adapter': { callback: 'https://example.invalid' } },
    { unnamespaced: { safe: true } },
    { 'numberdroid.adapter': { one: { two: { three: { four: { five: true } } } } } },
  ]) {
    assert.throws(() => validateAssetMetadata({
      assetId: 'asset.extension', kind: 'surface', metadata: familySurface({ extensions }), sliceBinding,
    }), (error) => error.code === 'ASSET_EXTENSION_INVALID');
  }
});

test('connectors require unique cardinal edges and an explicit continuity profile', () => {
  const missingProfile = validateAssetMetadata({
    assetId: 'asset.connector',
    kind: 'surface',
    metadata: familySurface({
      connectors: [{ edge: 'north', offset: 0.5 }],
      continuityProfile: null,
    }),
    sliceBinding,
  });
  assert.deepEqual(missingProfile.findings.map(({ ruleId }) => ruleId), [
    'studio.asset.connectors.profile_required',
  ]);
  assert.throws(() => validateAssetMetadata({
    assetId: 'asset.connector.duplicate',
    kind: 'surface',
    metadata: familySurface({
      connectors: [{ edge: 'north', offset: 0.5 }, { edge: 'north', offset: 0.25 }],
      continuityProfile: 'family-line',
    }),
    sliceBinding,
  }), (error) => error.code === 'ASSET_CONNECTOR_DUPLICATE');
});

test('collision bounds and parts stay inside the authored tile span', () => {
  const result = validateAssetMetadata({
    assetId: 'asset.collision.outside',
    kind: 'prop',
    metadata: familySurface({
      role: 'service',
      attachment: 'ground',
      collision: {
        mode: 'parts',
        bounds: null,
        parts: [{ x: 0, y: 0, width: 2, height: 1 }],
      },
    }),
    sliceBinding,
  });
  assert.deepEqual(result.findings.map(({ ruleId, path }) => [ruleId, path]), [
    ['studio.asset.collision.out_of_bounds', '/collision/parts/0'],
  ]);
});

test('surface tiling subtracts structural bands and uses the usable-domain origin', () => {
  const result = validateSurfaceTilingDomain({
    room: { x: 10, y: 20, width: 10, height: 8 },
    structuralBands: { left: 1, right: 1, top: 1, bottom: 1 },
    spanTiles: { width: 2, height: 2 },
    placements: Array.from({ length: 12 }, (_, index) => ({
      x: 11 + (index % 4) * 2,
      y: 21 + Math.floor(index / 4) * 2,
      width: 2,
      height: 2,
    })),
  });
  assert.deepEqual(result.usableDomain, { x: 11, y: 21, width: 8, height: 6 });
  assert.equal(result.expectedPlacements, 12);
  assert.deepEqual(result.findings, []);
});

test('surface tiling rejects nondivisible spans, clipped fragments, and overlap', () => {
  const nondivisible = validateSurfaceTilingDomain({
    room: { x: 0, y: 0, width: 9, height: 8 },
    structuralBands: { left: 1, right: 1, top: 1, bottom: 1 },
    spanTiles: { width: 2, height: 2 },
    placements: [],
  });
  assert.ok(nondivisible.findings.some(({ ruleId }) => ruleId === 'studio.asset.surface.width_not_divisible'));

  const clipped = validateSurfaceTilingDomain({
    room: { x: 0, y: 0, width: 6, height: 6 },
    structuralBands: { left: 1, right: 1, top: 1, bottom: 1 },
    spanTiles: { width: 2, height: 2 },
    placements: [
      { x: 0, y: 1, width: 2, height: 2 },
      { x: 1, y: 1, width: 2, height: 2 },
    ],
  });
  assert.deepEqual(clipped.findings.map(({ ruleId }) => ruleId), [
    'studio.asset.surface.macro_out_of_domain',
    'studio.asset.surface.macro_misaligned',
    'studio.asset.surface.macro_overlap',
    'studio.asset.surface.coverage_incomplete',
  ]);
});

test('lifecycle gates block validation errors and require explicit warning disposition before FINAL', () => {
  const blocking = [{ findingId: 'error-1', severity: 'ERROR' }];
  assert.throws(() => evaluateAssetLifecycle({
    current: 'DRAFT', target: 'VALIDATED', findings: blocking, acceptedWarningFindingIds: [],
  }), (error) => error.code === 'ASSET_LIFECYCLE_BLOCKED');

  const warning = [{ findingId: 'warning-1', severity: 'WARNING' }];
  assert.equal(evaluateAssetLifecycle({
    current: 'METADATA_COMPLETE', target: 'VALIDATED', findings: warning, acceptedWarningFindingIds: [],
  }), 'VALIDATED');
  assert.throws(() => evaluateAssetLifecycle({
    current: 'VALIDATED', target: 'FINAL', findings: warning, acceptedWarningFindingIds: [],
  }), (error) => error.code === 'ASSET_WARNING_UNDISPOSITIONED');
  assert.equal(evaluateAssetLifecycle({
    current: 'VALIDATED', target: 'FINAL', findings: warning, acceptedWarningFindingIds: ['warning-1'],
  }), 'FINAL');
  assert.deepEqual(ASSET_LIFECYCLES, ['DRAFT', 'METADATA_COMPLETE', 'VALIDATED', 'FINAL']);
});

test('bounded proposals have ordered unique coordinates and deterministic fingerprints', () => {
  const proposal = {
    projectId,
    proposalId: 'proposal.family',
    expectedRevision: 7,
    items: [0, 1, 2, 3].map((ordinal) => ({
      itemId: `item.family.${ordinal}`,
      operation: 'create',
      assetId: `asset.family.${ordinal}`,
      expectedAssetVersion: 0,
      expectedMetadataVersion: 0,
      sliceId: `slice.family.${ordinal}`,
      expectedSliceVersion: 1,
      name: `Family Hygiene ${ordinal + 1}`,
      kind: 'surface',
      metadata: familySurface(),
    })),
  };
  const first = validateAssetProposal(proposal);
  const second = validateAssetProposal(structuredClone(proposal));
  assert.equal(first.fingerprint, second.fingerprint);
  assert.equal(first.items.length, 4);
  assert.equal(first.commandCharge, 4);
  assert.equal(MAX_ASSET_PROPOSAL_ITEMS, 64);

  assert.throws(() => validateAssetProposal({
    ...proposal,
    items: [...proposal.items, { ...proposal.items[0], itemId: 'item.duplicate' }],
  }), (error) => error.code === 'ASSET_PROPOSAL_DUPLICATE_ASSET');
  assert.throws(() => validateAssetProposal({
    ...proposal,
    items: Array.from({ length: 65 }, (_, index) => ({
      ...proposal.items[0], itemId: `item.${index}`, assetId: `asset.${index}`,
    })),
  }), (error) => error.code === 'ASSET_PROPOSAL_LIMIT');
});
