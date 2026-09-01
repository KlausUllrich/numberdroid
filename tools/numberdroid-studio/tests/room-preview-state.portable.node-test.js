// Portable contract coverage for the DOM-free browser helper.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  assertRoomPreviewSceneBinding,
  createRoomPreviewBinding,
  createRoomPreviewUiState,
  mapRoomPreviewViewport,
  roomPreviewArtifactPath,
  roomPreviewBindingKey,
  roomPreviewSceneExtent,
  roomPreviewScenePath,
  roomPreviewTopDownDrawOrder,
  transitionRoomPreviewUiState,
  validateRoomPreviewResource,
} from '../apps/studio-server/public/room-preview-state.js';

const DIGEST_A = 'a'.repeat(64);
const DIGEST_B = 'b'.repeat(64);
const ROOM_FINGERPRINT = 'c'.repeat(64);
const BINDING = Object.freeze({
  projectId: 'project.preview',
  projectRevision: 17,
  roomVariantId: 'room.preview',
  roomVersion: 4,
});

function artifact(digest = DIGEST_A) {
  return { digest, mediaType: 'image/png', pixelSize: { width: 64, height: 96 } };
}

function segment({ segmentId = 'body', phase = 'BODY', digest = DIGEST_A, z = 0 } = {}) {
  return {
    segmentId,
    phase,
    visualExtent: { x: -1, y: -2, z, width: 3, height: 4 },
    artifact: artifact(digest),
  };
}

function entity({
  entityId,
  layer = 'SET_DRESSING',
  groundX,
  groundY,
  segments = [segment()],
  visualExtent = { x: -1, y: -2, z: 0, width: 3, height: 4, depth: 0 },
}) {
  return {
    entityId,
    source: { layer },
    groundAnchor: { x: groundX, y: groundY },
    visual: { extent: visualExtent },
    segments,
  };
}

function scene() {
  const entities = [
    entity({ entityId: 'placement.back', groundX: 2, groundY: 3, segments: [
      segment({ segmentId: 'foreground', phase: 'FOREGROUND', z: 1 }),
      segment({ segmentId: 'background', phase: 'BACKGROUND', z: -1 }),
      segment({ segmentId: 'body', phase: 'BODY' }),
    ] }),
    entity({
      entityId: 'placement.surface',
      layer: 'STRUCTURAL_SURFACE',
      groundX: 8,
      groundY: 9,
      segments: [segment({ digest: DIGEST_B })],
      visualExtent: { x: 0, y: 0, z: 0, width: 10, height: 6, depth: 0 },
    }),
    entity({ entityId: 'placement.front', groundX: 1, groundY: 5 }),
  ];
  const value = {
    schemaVersion: 1,
    kind: 'studio.room-preview-scene',
    source: { ...BINDING, roomContentFingerprint: ROOM_FINGERPRINT },
    visualExtent: { x: -1, y: -2, z: 0, width: 11, height: 8, depth: 0 },
    room: {
      contentFingerprint: ROOM_FINGERPRINT,
      bounds: { x: 0, y: 0, z: 0, width: 10, height: 6 },
    },
    entities,
  };
  return value;
}

test('room preview binding produces one exact queryless key and route', { timeout: 5_000 }, () => {
  const binding = createRoomPreviewBinding(BINDING);
  assert.equal(binding.key, roomPreviewBindingKey(BINDING));
  assert.equal(binding.path, '/api/projects/project.preview/revisions/17/room-variants/room.preview/versions/4/preview-scene');
  assert.equal(binding.path, roomPreviewScenePath(BINDING));
  assert.equal(binding.path.includes('?'), false);
  assert.equal(binding.path.includes('#'), false);
  assert.equal(Object.isFrozen(binding), true);
  assert.throws(() => roomPreviewScenePath({ ...BINDING, projectRevision: 0 }), /positive safe integer/);
  assert.throws(() => roomPreviewScenePath({ ...BINDING, roomVariantId: '../room' }), /opaque identifier/);
  assert.throws(() => roomPreviewScenePath({ ...BINDING, unexpected: true }), /not permitted/);
});

test('preview resources are canonical same-origin digest paths, never metadata URLs', { timeout: 5_000 }, () => {
  const expected = `/api/projects/${BINDING.projectId}/artifacts/sha256/${DIGEST_A}`;
  assert.equal(roomPreviewArtifactPath(BINDING.projectId, artifact()), expected);
  assert.deepEqual(validateRoomPreviewResource(artifact(), BINDING.projectId), {
    ...artifact(),
    resourcePath: expected,
  });
  assert.equal(validateRoomPreviewResource({ ...artifact(), resourceUri: expected }, BINDING.projectId).resourcePath, expected);
  for (const resourceUri of [
    `https://example.test${expected}`,
    `${expected}?download=1`,
    `${expected}#image`,
    `/api/projects/project.other/artifacts/sha256/${DIGEST_A}`,
    `/api/projects/${BINDING.projectId}/artifacts/sha256/${DIGEST_B}`,
  ]) {
    assert.throws(
      () => validateRoomPreviewResource({ ...artifact(), resourceUri }, BINDING.projectId),
      /exact queryless same-origin digest path/,
    );
  }
  assert.throws(() => validateRoomPreviewResource({ ...artifact(), digest: DIGEST_A.toUpperCase() }, BINDING.projectId), /lowercase SHA-256/);
  assert.throws(() => validateRoomPreviewResource({ ...artifact(), mediaType: 'image/svg+xml' }, BINDING.projectId), /image\/png/);
  assert.throws(() => validateRoomPreviewResource({ ...artifact(), href: 'https://example.test' }, BINDING.projectId), /not permitted/);
});

test('viewport mapping contains room and visual overhang without changing scene geometry', { timeout: 5_000 }, () => {
  const value = scene();
  assert.deepEqual(roomPreviewSceneExtent(value), { x: -1, y: -2, z: 0, width: 11, height: 8, depth: 0 });
  const mapped = mapRoomPreviewViewport(value, { width: 1060, height: 900, padding: 0.5 });
  assert.deepEqual(mapped.sceneExtent, { x: -1, y: -2, z: 0, width: 11, height: 8, depth: 0 });
  assert.deepEqual(mapped.viewBox, { x: -1.5, y: -2.5, width: 12, height: 9 });
  assert.equal(mapped.scale, 88.33333333333333);
  assert.equal(mapped.letterbox.x, 0);
  assert.equal(mapped.letterbox.y, 52.5);
  assert.equal(mapped.translate.x, 132.5);
  assert.equal(mapped.translate.y, 273.3333333333333);
  assert.equal(Object.isFrozen(mapped.viewBox), true);
  assert.deepEqual(value.room.bounds, { x: 0, y: 0, z: 0, width: 10, height: 6 });
  const staleExtent = structuredClone(value);
  staleExtent.visualExtent.width = 12;
  assert.throws(() => roomPreviewSceneExtent(staleExtent), /does not match/);
  assert.throws(() => mapRoomPreviewViewport(value, { width: 0, height: 900 }), /bounded finite number/);
});

test('top-down renderer orders global phases around anchor-sorted bodies without mutating the portable scene', { timeout: 5_000 }, () => {
  const value = scene();
  const order = roomPreviewTopDownDrawOrder(value);
  assert.deepEqual(order.map(({ entityId, segmentId }) => [entityId, segmentId]), [
    ['placement.surface', 'body'],
    ['placement.back', 'background'],
    ['placement.back', 'body'],
    ['placement.front', 'body'],
    ['placement.back', 'foreground'],
  ]);
  assert.equal(Object.hasOwn(value, 'drawOrder'), false);
  assert.equal(Object.hasOwn(value, 'view'), false);
  assert.equal(Object.isFrozen(order), true);
  const duplicate = structuredClone(value);
  duplicate.entities[0].segments[1].segmentId = 'foreground';
  assert.throws(() => roomPreviewTopDownDrawOrder(duplicate), /draw identities must be unique/);
});

test('UI transitions are immutable, exact-request owned, and fail closed', { timeout: 5_000 }, () => {
  const closed = createRoomPreviewUiState();
  const loading = transitionRoomPreviewUiState(closed, { type: 'OPEN', binding: BINDING, requestId: 1 });
  assert.equal(loading.status, 'LOADING');
  assert.equal(Object.isFrozen(loading.binding), true);
  assert.throws(() => transitionRoomPreviewUiState(closed, {
    type: 'OPEN', binding: createRoomPreviewBinding(BINDING), requestId: 2,
  }), /binding\.key is not permitted/);
  const enrichedBinding = createRoomPreviewBinding(BINDING);
  assert.throws(() => assertRoomPreviewSceneBinding(scene(), enrichedBinding), /binding\.key is not permitted/);
  assert.doesNotThrow(() => assertRoomPreviewSceneBinding(scene(), {
    projectId: enrichedBinding.projectId,
    projectRevision: enrichedBinding.projectRevision,
    roomVariantId: enrichedBinding.roomVariantId,
    roomVersion: enrichedBinding.roomVersion,
  }));

  const staleScene = transitionRoomPreviewUiState(loading, {
    type: 'SCENE_READY', bindingKey: loading.bindingKey, requestId: 2, scene: scene(),
  });
  assert.equal(staleScene, loading);
  const wrongBindingScene = scene();
  wrongBindingScene.source.roomVersion = 5;
  assert.throws(() => transitionRoomPreviewUiState(loading, {
    type: 'SCENE_READY', bindingKey: loading.bindingKey, requestId: 1, scene: wrongBindingScene,
  }), /exact room changed/);
  const wrongFingerprintScene = scene();
  wrongFingerprintScene.source.roomContentFingerprint = DIGEST_B;
  assert.throws(() => assertRoomPreviewSceneBinding(wrongFingerprintScene, BINDING), /fingerprint does not match/);
  const wrongKindScene = scene();
  wrongKindScene.kind = 'studio.numberdroid-runtime-preview';
  assert.throws(() => assertRoomPreviewSceneBinding(wrongKindScene, BINDING), /could not be read safely/);

  const wrongResourceScene = scene();
  wrongResourceScene.entities[0].segments[0].artifact.digest = 'not-a-digest';
  assert.throws(() => transitionRoomPreviewUiState(loading, {
    type: 'SCENE_READY', bindingKey: loading.bindingKey, requestId: 1, scene: wrongResourceScene,
  }), /lowercase SHA-256/);

  for (const rendererPolicy of [
    { view: { projection: 'ORTHOGRAPHIC_TOP_DOWN' } },
    { drawOrder: roomPreviewTopDownDrawOrder(scene()) },
  ]) {
    const policyScene = Object.assign(scene(), rendererPolicy);
    assert.throws(() => transitionRoomPreviewUiState(loading, {
      type: 'SCENE_READY', bindingKey: loading.bindingKey, requestId: 1, scene: policyScene,
    }), /must not embed a renderer projection or final draw order/);
  }

  const ready = transitionRoomPreviewUiState(loading, {
    type: 'SCENE_READY', bindingKey: loading.bindingKey, requestId: 1, scene: scene(),
  });
  assert.equal(ready.status, 'READY');
  assert.equal(Object.isFrozen(ready.scene.entities[0]), true);
  const degraded = transitionRoomPreviewUiState(ready, {
    type: 'RESOURCE_FAILED', bindingKey: ready.bindingKey, requestId: 1, digest: DIGEST_A,
  });
  assert.equal(degraded.status, 'DEGRADED');
  assert.deepEqual(degraded.failedResourceDigests, [DIGEST_A]);
  const recovered = transitionRoomPreviewUiState(degraded, {
    type: 'RESOURCE_RECOVERED', bindingKey: degraded.bindingKey, requestId: 1, digest: DIGEST_A,
  });
  assert.equal(recovered.status, 'READY');

  for (const digest of [DIGEST_A, 'd'.repeat(64)]) {
    const staleResource = transitionRoomPreviewUiState(ready, {
      type: 'RESOURCE_FAILED', bindingKey: `${ready.bindingKey}:stale`, requestId: 99, digest,
    });
    assert.equal(staleResource, ready);
  }

  const retrying = transitionRoomPreviewUiState(degraded, { type: 'RETRY', requestId: 3 });
  assert.equal(retrying.status, 'LOADING');
  assert.equal(retrying.bindingKey, degraded.bindingKey);
  const failed = transitionRoomPreviewUiState(retrying, {
    type: 'LOAD_FAILED', bindingKey: retrying.bindingKey, requestId: 3, code: '<unsafe metadata>',
  });
  assert.deepEqual(failed.error, {
    code: 'PREVIEW_UNAVAILABLE',
    message: 'The exact Studio preview is unavailable.',
  });
  assert.equal(transitionRoomPreviewUiState(failed, { type: 'CLOSE' }).status, 'CLOSED');
  assert.throws(() => transitionRoomPreviewUiState(closed, { type: 'RETRY', requestId: 4 }), /not valid/);
});

test('browser helper is DOM-free and contains no metadata-controlled HTML, CSS or engine bridge', { timeout: 5_000 }, async () => {
  const source = await readFile(new URL('../apps/studio-server/public/room-preview-state.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bdocument\b|\bwindow\b|innerHTML|outerHTML|insertAdjacentHTML|className|cssText|EngineBridge/);
  assert.doesNotMatch(source, /resource\.(href|src|style|className)/);
  assert.match(source, /resource\.resourceUri !== resourcePath/);
  assert.match(source, /\/preview-scene`/);
});
