import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ROOM_PREVIEW_BLEND_MODE,
  ROOM_PREVIEW_PRESENTATION_NAMESPACE,
  ROOM_PREVIEW_PROJECTION,
  createRoomPreviewScene,
} from '../packages/preview/src/room-preview-scene.js';

const PROJECT_ID = 'project.room-preview';

function binding(digit = 'a', overrides = {}) {
  return {
    projectId: PROJECT_ID,
    digest: digit.repeat(64),
    mediaType: 'image/png',
    width: 128,
    height: 96,
    artifactUri: `studio://artifacts/sha256/${digit.repeat(64)}`,
    ...overrides,
  };
}

function asset(assetId, {
  assetVersion = 1,
  metadataVersion = 1,
  span = { width: 1, height: 1 },
  presentation,
  digit = 'a',
} = {}) {
  return {
    assetId,
    assetVersion,
    metadataVersion,
    name: assetId,
    kind: assetId.includes('floor') ? 'surface' : 'prop',
    lifecycle: 'FINAL',
    metadata: {
      spanTiles: span,
      extensions: presentation === undefined ? {} : {
        [ROOM_PREVIEW_PRESENTATION_NAMESPACE]: presentation,
      },
    },
    sliceBinding: binding(digit),
  };
}

function placement(placementId, assetId, {
  x = 0,
  y = 0,
  rotation = 0,
  assetVersion = 1,
  metadataVersion = 1,
  layer = 'SET_DRESSING',
} = {}) {
  return {
    placementId,
    assetId,
    assetVersion,
    metadataVersion,
    layer,
    anchor: { x, y },
    rotation,
  };
}

function room(placements, overrides = {}) {
  return {
    projectId: PROJECT_ID,
    roomVariantId: 'room.preview',
    version: 7,
    displayName: 'Portable preview room',
    contentFingerprint: '1'.repeat(64),
    width: 12,
    height: 10,
    origin: { x: 0, y: 0 },
    placements,
    voidCells: [{ x: 11, y: 9 }],
    blockedCells: [{ x: 2, y: 2 }],
    connectors: [{ connectorId: 'connector.west', side: 'west', offset: 3, width: 1, kind: 'standard-door' }],
    findings: [{
      findingId: 'finding.persisted',
      severity: 'ERROR',
      ruleId: 'studio.room.persisted',
      targetKind: 'roomVariant',
      targetId: 'room.preview',
      path: '/placements',
      explanation: 'Persisted exact room finding.',
      remediation: 'Edit the room through semantic commands.',
      validatorVersion: 'numberdroid-studio.room-validator.v1',
    }],
    ...overrides,
  };
}

function scene(roomValue, assets) {
  return createRoomPreviewScene({
    projectId: PROJECT_ID,
    projectRevision: 42,
    room: roomValue,
    assets,
  });
}

function assertDeepFrozen(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child, seen);
}

test('portable room scene pins exact source/artifact identity and keeps unclipped logical cells', () => {
  const outside = asset('asset.prop.outside', { span: { width: 2, height: 1 } });
  const roomValue = room([
    placement('placement.outside', outside.assetId, { x: 11, y: 9 }),
  ]);
  delete roomValue.projectId;
  const result = scene(roomValue, [outside]);

  assert.deepEqual(result.source, {
    projectId: PROJECT_ID,
    projectRevision: 42,
    roomVariantId: 'room.preview',
    roomVersion: 7,
    roomContentFingerprint: '1'.repeat(64),
  });
  assert.deepEqual(result.coordinateSpace, {
    unit: 'ROOM_CELL',
    axes: { x: 'EAST', y: 'SOUTH', z: 'UP' },
    origin: { x: 0, y: 0, z: 0 },
  });
  assert.equal(result.view.projection, ROOM_PREVIEW_PROJECTION);
  assert.equal(result.compositing.blendMode, ROOM_PREVIEW_BLEND_MODE);
  assert.deepEqual(result.entities[0].logicalFootprint, {
    x: 11,
    y: 9,
    z: 0,
    width: 2,
    height: 1,
    cells: [{ x: 11, y: 9 }, { x: 12, y: 9 }],
  });
  assert.deepEqual(result.entities[0].artifact, {
    digest: 'a'.repeat(64),
    mediaType: 'image/png',
    pixelSize: { width: 128, height: 96 },
  });
  assert.equal(Object.hasOwn(result.entities[0].artifact, 'artifactUri'), false);
  assert.equal(Object.hasOwn(result.entities[0].artifact, 'resourceUri'), false);
  assert.deepEqual(result.entities[0].visual.extent, { x: 11, y: 9, z: 0, width: 2, height: 1, depth: 0 });
  assert.deepEqual(result.visualExtent, { x: 0, y: 0, z: 0, width: 13, height: 10, depth: 0 });
  assert.deepEqual(result.room.voidCells, [{ x: 11, y: 9 }]);
  assert.equal(result.room.contentFingerprint, '1'.repeat(64));
  assert.deepEqual(result.room.findings.map(({ findingId }) => findingId), ['finding.persisted']);
  assert.deepEqual(result.findings, []);
  assertDeepFrozen(result);
  assert.throws(() => { result.entities[0].logicalFootprint.cells.push({ x: 13, y: 9 }); }, TypeError);
});

test('ground anchor, presentation geometry, elevation, overhang, alpha, and segments stay independent from logical occupancy', () => {
  const presentation = {
    schemaVersion: 1,
    groundAnchor: { x: 1, y: 3 },
    visualBounds: { x: -0.5, y: -1, width: 3, height: 4 },
    visualOffset: { x: 0.25, y: -0.5 },
    elevation: 2,
    segments: [
      { phase: 'FOREGROUND', sourceRect: { x: 0, y: 0.75, width: 1, height: 0.25 } },
      { phase: 'BACKGROUND', sourceRect: { x: 0, y: 0, width: 1, height: 0.25 } },
      { phase: 'BODY', sourceRect: { x: 0, y: 0.25, width: 1, height: 0.5 } },
    ],
  };
  const complex = asset('asset.prop.complex', { span: { width: 2, height: 3 }, presentation, digit: 'b' });
  const plain = asset('asset.prop.plain', { span: { width: 2, height: 3 }, digit: 'c' });
  const complexResult = scene(room([
    placement('placement.complex', complex.assetId, { x: 4, y: 4, rotation: 90 }),
  ]), [complex]);
  const plainResult = scene(room([
    placement('placement.complex', plain.assetId, { x: 4, y: 4, rotation: 90 }),
  ]), [plain]);
  const entity = complexResult.entities[0];

  assert.deepEqual(entity.logicalFootprint, plainResult.entities[0].logicalFootprint);
  assert.deepEqual(entity.logicalFootprint, {
    x: 4, y: 4, z: 0, width: 3, height: 2,
    cells: [
      { x: 4, y: 4 }, { x: 5, y: 4 }, { x: 6, y: 4 },
      { x: 4, y: 5 }, { x: 5, y: 5 }, { x: 6, y: 5 },
    ],
  });
  assert.deepEqual(entity.groundAnchor, { x: 4, y: 5, z: 0 });
  assert.deepEqual(entity.visual.bounds, { x: 4, y: 3.5, z: 0, width: 4, height: 3 });
  assert.deepEqual(entity.visual.offset, { x: 0.5, y: 0.25, z: 0 });
  assert.equal(entity.visual.elevation, 2);
  assert.deepEqual(entity.visual.extent, { x: 4.5, y: 3.75, z: 2, width: 4, height: 3, depth: 0 });
  assert.deepEqual(entity.visual.overhang, { left: 0, top: 0.25, right: 1.5, bottom: 0.75 });
  assert.deepEqual(entity.segments.map(({ segmentId, phase, elevation }) => ({ segmentId, phase, elevation })), [
    { segmentId: 'background', phase: 'BACKGROUND', elevation: 2 },
    { segmentId: 'body', phase: 'BODY', elevation: 2 },
    { segmentId: 'foreground', phase: 'FOREGROUND', elevation: 2 },
  ]);
  assert.ok(entity.segments.every((segment) => (
    segment.compositing.blendMode === 'SOURCE_OVER'
      && segment.compositing.sourceAlpha === 'PRESERVE'
  )));
  assert.deepEqual(complexResult.drawOrder.map(({ segmentId }) => segmentId), ['background', 'body', 'foreground']);
  assert.deepEqual(complexResult.visualExtent, { x: 0, y: 0, z: 0, width: 12, height: 10, depth: 2 });
});

test('draw order is deterministic with semantic layer first and ground anchor as primary in-layer depth', () => {
  const phases = {
    schemaVersion: 1,
    segments: [
      { phase: 'FOREGROUND', sourceRect: { x: 0, y: 0.5, width: 1, height: 0.5 } },
      { phase: 'BACKGROUND', sourceRect: { x: 0, y: 0, width: 1, height: 0.5 } },
    ],
  };
  const floor = asset('asset.floor', { digit: 'd' });
  const near = asset('asset.prop.near', { presentation: phases, digit: 'e' });
  const far = asset('asset.prop.far', { presentation: phases, digit: 'f' });
  const roomValue = room([
    placement('z.far', far.assetId, { x: 2, y: 6 }),
    placement('floor.last-id', floor.assetId, { x: 9, y: 8, layer: 'STRUCTURAL_SURFACE' }),
    placement('a.near', near.assetId, { x: 1, y: 1 }),
  ]);
  const first = scene(roomValue, [far, floor, near]);
  const second = scene(structuredClone(roomValue), new Map([
    ['untrusted-key-near', structuredClone(near)],
    ['untrusted-key-far', structuredClone(far)],
    ['untrusted-key-floor', structuredClone(floor)],
  ]));

  assert.deepEqual(first, second);
  assert.deepEqual(first.drawOrder.map(({ entityId, segmentId }) => `${entityId}:${segmentId}`), [
    'floor.last-id:body',
    'a.near:background',
    'a.near:foreground',
    'z.far:background',
    'z.far:foreground',
  ]);
  assert.ok(first.drawOrder[1].depth.groundY < first.drawOrder[3].depth.groundY);
});

test('quarter-turn transforms are deterministic for points, rectangles, vectors, and footprints', () => {
  const presentation = {
    schemaVersion: 1,
    groundAnchor: { x: 0, y: 0 },
    visualBounds: { x: 0, y: 0, width: 2, height: 1 },
    visualOffset: { x: 1, y: 0 },
  };
  const prop = asset('asset.prop.turns', { span: { width: 2, height: 3 }, presentation });
  const expected = new Map([
    [0, { footprint: [2, 3], ground: [5, 6], bounds: [5, 6, 2, 1], offset: [1, 0] }],
    [90, { footprint: [3, 2], ground: [8, 6], bounds: [7, 6, 1, 2], offset: [0, 1] }],
    [180, { footprint: [2, 3], ground: [7, 9], bounds: [5, 8, 2, 1], offset: [-1, 0] }],
    [270, { footprint: [3, 2], ground: [5, 8], bounds: [5, 6, 1, 2], offset: [0, -1] }],
  ]);
  for (const [rotation, oracle] of expected) {
    const result = scene(room([
      placement(`placement.turn.${rotation}`, prop.assetId, { x: 5, y: 6, rotation }),
    ]), [prop]);
    const entity = result.entities[0];
    assert.deepEqual([entity.logicalFootprint.width, entity.logicalFootprint.height], oracle.footprint);
    assert.deepEqual([entity.groundAnchor.x, entity.groundAnchor.y], oracle.ground);
    assert.deepEqual([
      entity.visual.bounds.x, entity.visual.bounds.y,
      entity.visual.bounds.width, entity.visual.bounds.height,
    ], oracle.bounds);
    assert.deepEqual([entity.visual.offset.x, entity.visual.offset.y], oracle.offset);
  }
});

test('malformed optional presentation emits a preview-only finding and falls back without changing gameplay geometry', () => {
  const malformedValues = [
    null,
    { schemaVersion: 2 },
    { schemaVersion: 1, visualBounds: { x: 0, y: 0, width: 0, height: 1 } },
    {
      schemaVersion: 1,
      segments: [
        { phase: 'BODY', sourceRect: { x: 0, y: 0, width: 1, height: 1 } },
        { phase: 'BODY', sourceRect: { x: 0, y: 0, width: 1, height: 1 } },
      ],
    },
    { schemaVersion: 1, authority: 'release' },
    { schemaVersion: 1, semantic: { collision: 'none' } },
    { schemaVersion: 1, runtime: { eligible: true } },
    { schemaVersion: 1, url: 'https://example.invalid/image.png' },
    { schemaVersion: 1, html: '<img>' },
    { schemaVersion: 1, css: 'position: fixed' },
    { schemaVersion: 1, executable: 'alert(1)' },
  ];
  const safe = asset('asset.prop.safe', { span: { width: 2, height: 1 } });
  const safeResult = scene(room([
    placement('placement.safe', safe.assetId, { x: 3, y: 4 }),
  ]), [safe]);
  for (const malformed of malformedValues) {
    const broken = asset('asset.prop.safe', { span: { width: 2, height: 1 }, presentation: malformed });
    const result = scene(room([
      placement('placement.safe', broken.assetId, { x: 3, y: 4 }),
    ]), [broken]);
    assert.deepEqual(result.entities, safeResult.entities);
    assert.deepEqual(result.drawOrder, safeResult.drawOrder);
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].scope, 'PREVIEW_ONLY');
    assert.equal(result.findings[0].ruleId, 'studio.preview.presentation.invalid');
    assert.match(result.findings[0].remediation, /gameplay semantics are unaffected/i);
  }
});

test('critical exact pins and artifacts fail closed instead of borrowing another asset version', () => {
  const exact = asset('asset.prop.versioned', { assetVersion: 2, metadataVersion: 3 });
  const pinned = room([
    placement('placement.versioned', exact.assetId, { assetVersion: 2, metadataVersion: 3 }),
  ]);
  assert.throws(
    () => scene(pinned, [asset(exact.assetId, { assetVersion: 2, metadataVersion: 4 })]),
    (error) => error.code === 'ROOM_PREVIEW_ASSET_VERSION_NOT_FOUND',
  );
  assert.throws(
    () => scene(pinned, [{ ...exact, sliceBinding: binding('A') }]),
    (error) => error.code === 'ROOM_PREVIEW_ARTIFACT_INVALID',
  );
  assert.throws(
    () => scene(pinned, [{ ...exact, sliceBinding: binding('a', { mediaType: 'image/svg+xml' }) }]),
    (error) => error.code === 'ROOM_PREVIEW_ARTIFACT_INVALID',
  );
  assert.throws(
    () => scene(pinned, [{ ...exact, sliceBinding: binding('a', { projectId: 'project.other' }) }]),
    (error) => error.code === 'ROOM_PREVIEW_ARTIFACT_PROJECT_MISMATCH',
  );
  assert.throws(
    () => createRoomPreviewScene({ projectId: 'project.other', projectRevision: 42, room: pinned, assets: [exact] }),
    (error) => error.code === 'ROOM_PREVIEW_PROJECT_MISMATCH',
  );
});
