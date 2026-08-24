import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_ROOM_AXIS_CELLS,
  MAX_ROOM_PROPOSAL_ITEMS,
  ROOM_VALIDATOR_VERSION,
  evaluateRoomLifecycle,
  forkFinalRoomVariant,
  roomArchetypeDefaults,
  validateRoomArchetype,
  validateRoomPlacementProposal,
  validateRoomVariant,
} from '../packages/domain/src/index.js';

const projectId = 'project.checkpoint-3';

function archetype(overrides = {}) {
  return {
    projectId,
    roomArchetypeId: 'archetype.domestic-room',
    version: 1,
    kind: 'room',
    displayName: 'Domestic room',
    tags: ['domestic'],
    dimensionPolicy: {
      width: { min: 3, preferred: 10, max: 64 },
      height: { min: 3, preferred: 8, max: 64 },
    },
    structuralBands: { left: 0, right: 0, top: 0, bottom: 0 },
    orientation: 'any',
    connectorPolicy: { min: 1, max: 8, requiredSides: [] },
    allowedAssetKinds: ['surface', 'prop', 'item'],
    allowedTags: [],
    requiredTags: [],
    rationality: 'domestic',
    governingRuleRefs: [
      { ruleId: 'gd.function-first', summary: 'Function before form.' },
    ],
    ...overrides,
  };
}

function intentTrace() {
  return [
    { layer: 'game_design', ruleId: 'gd.function-first', summary: 'Function before form.', disposition: 'governing' },
    { layer: 'level_design', ruleId: 'ld.room-corridor-distinct', summary: 'Room and corridor remain distinct.', disposition: 'governing' },
    { layer: 'room_design', ruleId: 'rd.domestic-use', summary: 'Supports legible domestic use.', disposition: 'governing' },
  ];
}

function connector(overrides = {}) {
  return {
    connectorId: 'connector.west',
    side: 'west',
    offset: 3,
    width: 1,
    kind: 'standard-door',
    clearanceInside: 1,
    clearanceOutside: 1,
    required: true,
    tags: ['domestic'],
    compatibilityProfile: 'door.standard',
    ...overrides,
  };
}

function placement({ placementId, assetId, x, y, layer = 'STRUCTURAL_SURFACE', rotation = 0 }) {
  return {
    placementId,
    assetId,
    assetVersion: 1,
    metadataVersion: 1,
    layer,
    anchor: { x, y },
    rotation,
    variantTag: null,
    proposalId: null,
    proposalItemId: null,
  };
}

function metadata({ kind = 'surface', span = { width: 1, height: 1 }, collision = { mode: 'none', bounds: null, parts: [] }, overrides = {} } = {}) {
  return {
    role: kind === 'surface' ? 'base' : 'furniture',
    tags: ['domestic'],
    variantGroup: null,
    compatibilityGroups: [],
    spanTiles: span,
    anchor: { x: 0, y: 0 },
    attachment: 'ground',
    rotationPolicy: kind === 'surface' ? 'fixed' : 'cardinal',
    placement: { modes: ['manual'], wallSafe: true, tags: [], confirmation: 'confirmed' },
    collision,
    navigation: { effect: collision.mode === 'none' ? 'passable' : 'blocked', cost: null },
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

function asset(assetId, { kind = 'surface', span, collision, lifecycle = 'FINAL', overrides } = {}) {
  return {
    assetId,
    assetVersion: 1,
    metadataVersion: 1,
    kind,
    lifecycle,
    metadata: metadata({ kind, span, collision, overrides }),
  };
}

function surfacePlacements(width, height, prefix = 'floor') {
  const placements = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      placements.push(placement({ placementId: `${prefix}.${x}.${y}`, assetId: 'asset.floor', x, y }));
    }
  }
  return placements;
}

function variant(overrides = {}) {
  return {
    projectId,
    roomVariantId: 'room.family-table',
    version: 1,
    roomArchetypeId: 'archetype.domestic-room',
    archetypeVersion: 1,
    displayName: 'Family Table Room',
    lifecycle: 'DRAFT',
    width: 10,
    height: 8,
    origin: { x: 0, y: 0 },
    intentTrace: intentTrace(),
    connectors: [connector()],
    placements: surfacePlacements(10, 8),
    acceptedWarningFindingIds: [],
    parentVariantVersion: null,
    parentFinalVersion: null,
    ...overrides,
  };
}

test('provisional room and hallway defaults are explicit and bounded', () => {
  assert.deepEqual(roomArchetypeDefaults('room'), {
    width: { min: 3, preferred: 10, max: 64 },
    height: { min: 3, preferred: 8, max: 64 },
    structuralBands: { left: 0, right: 0, top: 0, bottom: 0 },
    orientation: 'any',
    connectorPolicy: { min: 1, max: 32, requiredSides: [] },
  });
  assert.equal(roomArchetypeDefaults('hallway').width.preferred, 12);
  assert.equal(roomArchetypeDefaults('hallway').height.preferred, 3);
  assert.deepEqual(roomArchetypeDefaults('hallway').connectorPolicy.requiredSides, ['east', 'west']);
  assert.equal(MAX_ROOM_AXIS_CELLS, 64);
});

test('archetypes fail closed on unknown fields, invalid ranges, and tag-policy contradictions', () => {
  assert.match(validateRoomArchetype(archetype()).fingerprint, /^[a-f0-9]{64}$/);
  assert.throws(() => validateRoomArchetype(archetype({ pixelsDefineUse: true })), (error) => error.code === 'VALIDATION_ERROR');
  assert.throws(() => validateRoomArchetype(archetype({
    dimensionPolicy: { width: { min: 12, preferred: 10, max: 64 }, height: { min: 3, preferred: 8, max: 64 } },
  })), (error) => error.code === 'ROOM_DIMENSION_POLICY_INVALID');
  assert.throws(() => validateRoomArchetype(archetype({ allowedTags: ['ritual'], requiredTags: ['domestic'] })), (error) => error.code === 'ROOM_TAG_POLICY_INVALID');
});

test('a fully covered room validates deterministically without embedding findings in its strict value', () => {
  const assets = new Map([['asset.floor', asset('asset.floor')]]);
  const first = validateRoomVariant({ variant: variant(), archetype: archetype(), assets });
  const second = validateRoomVariant({ variant: structuredClone(first.variant), archetype: archetype(), assets });
  assert.deepEqual(first.findings, second.findings);
  assert.equal(first.fingerprint, second.fingerprint);
  assert.deepEqual(first.findings.map(({ ruleId }) => ruleId), [
    'studio.room.placement.runtime_ineligible',
    ...Array.from({ length: 79 }, () => 'studio.room.placement.runtime_ineligible'),
  ]);
  assert.equal(Object.hasOwn(first.variant, 'findings'), false);
  assert.ok(first.findings.every((finding) => finding.validatorVersion === ROOM_VALIDATOR_VERSION));
});

test('intent gaps and proposed intent are deterministic review findings', () => {
  const result = validateRoomVariant({
    variant: variant({ intentTrace: [{ layer: 'game_design', ruleId: 'gd.function-first', summary: 'Function before form.', disposition: 'proposed' }] }),
    archetype: archetype(),
    assets: { 'asset.floor': asset('asset.floor', { lifecycle: 'FINAL', overrides: { runtimeEligible: true } }) },
  });
  assert.deepEqual(result.findings.map(({ ruleId }) => ruleId).filter((ruleId) => ruleId.startsWith('studio.room.intent')), [
    'studio.room.intent.layer_required',
    'studio.room.intent.layer_required',
    'studio.room.intent.proposed',
  ]);
});

test('connector apertures reject edge overflow and report overlap and hallway end requirements', () => {
  assert.throws(() => validateRoomVariant({
    variant: variant({ connectors: [connector({ side: 'north', offset: 9, width: 2 })] }),
    archetype: archetype(),
    assets: { 'asset.floor': asset('asset.floor') },
  }), (error) => error.code === 'ROOM_CONNECTOR_OUT_OF_BOUNDS');

  const overlapping = validateRoomVariant({
    variant: variant({ connectors: [connector(), connector({ connectorId: 'connector.west.2', offset: 3, width: 2 })] }),
    archetype: archetype(),
    assets: { 'asset.floor': asset('asset.floor') },
  });
  assert.ok(overlapping.findings.some(({ ruleId }) => ruleId === 'studio.room.connector.overlap'));

  const hallwayArchetype = archetype({
    roomArchetypeId: 'archetype.hallway',
    kind: 'hallway',
    displayName: 'Hallway',
    dimensionPolicy: { width: { min: 3, preferred: 12, max: 64 }, height: { min: 3, preferred: 3, max: 64 } },
    orientation: 'horizontal',
    connectorPolicy: { min: 2, max: 8, requiredSides: ['east', 'west'] },
  });
  const hallway = variant({
    roomVariantId: 'room.hallway', roomArchetypeId: 'archetype.hallway', width: 12, height: 3,
    connectors: [connector({ offset: 1 })], placements: surfacePlacements(12, 3),
  });
  const result = validateRoomVariant({ variant: hallway, archetype: hallwayArchetype, assets: { 'asset.floor': asset('asset.floor') } });
  assert.ok(result.findings.some(({ ruleId }) => ruleId === 'studio.room.hallway.end_connectors'));
  assert.ok(result.findings.some(({ ruleId }) => ruleId === 'studio.room.connector.required_side'));
});

test('rotated footprints, wall policy, bounds, collisions, and connector clearance use authored metadata', () => {
  const props = {
    'asset.floor': asset('asset.floor', { overrides: { runtimeEligible: true } }),
    'asset.table': asset('asset.table', {
      kind: 'prop', span: { width: 2, height: 1 }, collision: { mode: 'bounds', bounds: { x: 0, y: 0, width: 2, height: 1 }, parts: [] },
    }),
    'asset.fixed': asset('asset.fixed', { kind: 'prop', span: { width: 1, height: 2 }, overrides: { rotationPolicy: 'fixed', placement: { modes: ['manual'], wallSafe: false, tags: [], confirmation: 'confirmed' } } }),
  };
  const result = validateRoomVariant({
    variant: variant({ placements: [
      ...surfacePlacements(10, 8),
      placement({ placementId: 'prop.table.1', assetId: 'asset.table', x: 0, y: 3, layer: 'SET_DRESSING', rotation: 90 }),
      placement({ placementId: 'prop.table.2', assetId: 'asset.table', x: 0, y: 4, layer: 'SET_DRESSING', rotation: 0 }),
      placement({ placementId: 'prop.fixed', assetId: 'asset.fixed', x: 9, y: 7, layer: 'SET_DRESSING', rotation: 90 }),
    ] }),
    archetype: archetype(),
    assets: props,
  });
  const rules = new Set(result.findings.map(({ ruleId }) => ruleId));
  assert.equal(rules.has('studio.room.connector.clearance_blocked'), true);
  assert.equal(rules.has('studio.room.placement.overlap'), true);
  assert.equal(rules.has('studio.room.collision.overlap'), true);
  assert.equal(rules.has('studio.room.placement.rotation_forbidden'), true);
  assert.equal(rules.has('studio.room.placement.out_of_bounds'), true);
  assert.equal(rules.has('studio.room.placement.wall_unsafe'), true);
});

test('structural bands exclude cells before complete macro coverage is evaluated', () => {
  const bandedArchetype = archetype({ structuralBands: { left: 1, right: 1, top: 1, bottom: 1 } });
  const macro = asset('asset.macro', { span: { width: 2, height: 2 }, overrides: { runtimeEligible: true } });
  const placements = [];
  for (let y = 1; y < 7; y += 2) {
    for (let x = 1; x < 9; x += 2) placements.push(placement({ placementId: `macro.${x}.${y}`, assetId: 'asset.macro', x, y }));
  }
  const exact = validateRoomVariant({ variant: variant({ placements }), archetype: bandedArchetype, assets: { 'asset.macro': macro } });
  assert.equal(exact.findings.some(({ ruleId }) => ruleId.startsWith('studio.room.surface.')), false);

  const broken = validateRoomVariant({
    variant: variant({ placements: [...placements.slice(1), placement({ placementId: 'macro.clipped', assetId: 'asset.macro', x: 0, y: 1 })] }),
    archetype: bandedArchetype,
    assets: { 'asset.macro': macro },
  });
  const rules = broken.findings.map(({ ruleId }) => ruleId);
  assert.ok(rules.includes('studio.room.surface.macro_out_of_domain'));
  assert.ok(rules.includes('studio.room.surface.macro_misaligned'));
  assert.ok(rules.includes('studio.room.surface.coverage_incomplete'));
});

test('lifecycle blocks errors, requires warning disposition, and final values fork into a new draft', () => {
  assert.throws(() => evaluateRoomLifecycle({ current: 'DRAFT', target: 'VALIDATED', findings: [{ findingId: 'error', severity: 'ERROR' }] }), (error) => error.code === 'ROOM_LIFECYCLE_BLOCKED');
  assert.equal(evaluateRoomLifecycle({ current: 'DRAFT', target: 'VALIDATED', findings: [{ findingId: 'warn', severity: 'WARNING' }] }), 'VALIDATED');
  assert.throws(() => evaluateRoomLifecycle({ current: 'VALIDATED', target: 'FINAL', findings: [{ findingId: 'warn', severity: 'WARNING' }] }), (error) => error.code === 'ROOM_WARNING_UNDISPOSITIONED');
  assert.equal(evaluateRoomLifecycle({ current: 'VALIDATED', target: 'FINAL', findings: [{ findingId: 'warn', severity: 'WARNING' }], acceptedWarningFindingIds: ['warn'] }), 'FINAL');

  const finalVariant = variant({ version: 4, lifecycle: 'FINAL', acceptedWarningFindingIds: ['warn'] });
  const draft = forkFinalRoomVariant({ finalVariant, nextVersion: 5 });
  assert.equal(finalVariant.lifecycle, 'FINAL');
  assert.equal(draft.lifecycle, 'DRAFT');
  assert.equal(draft.version, 5);
  assert.equal(draft.parentVariantVersion, 4);
  assert.equal(draft.parentFinalVersion, 4);
  assert.deepEqual(draft.acceptedWarningFindingIds, []);
});

test('room placement proposals are bounded, strictly shaped, and deterministic', () => {
  const proposal = {
    projectId,
    proposalId: 'proposal.room.set-dressing',
    roomVariantId: 'room.family-table',
    expectedRoomVariantVersion: 1,
    items: [{
      itemId: 'item.add.table',
      operation: 'add',
      placement: placement({ placementId: 'prop.table', assetId: 'asset.table', x: 4, y: 3, layer: 'SET_DRESSING' }),
      placementId: null,
      expectedAssetId: null,
      anchor: null,
      rotation: null,
    }],
  };
  const first = validateRoomPlacementProposal(proposal);
  const second = validateRoomPlacementProposal(structuredClone(proposal));
  assert.equal(first.fingerprint, second.fingerprint);
  assert.equal(first.commandCharge, 1);
  assert.equal(MAX_ROOM_PROPOSAL_ITEMS, 64);
  assert.throws(() => validateRoomPlacementProposal({ ...proposal, escape: '/tmp' }), (error) => error.code === 'VALIDATION_ERROR');
  assert.throws(() => validateRoomPlacementProposal({
    ...proposal,
    items: [proposal.items[0], { ...proposal.items[0], itemId: 'item.duplicate' }],
  }), (error) => error.code === 'ROOM_PROPOSAL_DUPLICATE_PLACEMENT');
});
