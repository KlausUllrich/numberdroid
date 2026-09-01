export const ROOM_PREVIEW_UI_STATES = Object.freeze([
  'CLOSED',
  'LOADING',
  'READY',
  'DEGRADED',
  'ERROR',
]);

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const LAYER_ORDER = Object.freeze({ STRUCTURAL_SURFACE: 0, SET_DRESSING: 1 });
const SEGMENT_ORDER = Object.freeze({ BACKGROUND: 0, BODY: 1, FOREGROUND: 2 });
const ERROR_PRESENTATION = Object.freeze({
  PREVIEW_BINDING_MISMATCH: 'The exact room changed before the Studio preview finished loading.',
  PREVIEW_SCENE_INVALID: 'The exact Studio preview scene could not be read safely.',
  PREVIEW_UNAVAILABLE: 'The exact Studio preview is unavailable.',
});

function fail(message) {
  throw new TypeError(message);
}

function record(value, field) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${field} must be an object.`);
  }
  return value;
}

function exactFields(value, fields, field) {
  const source = record(value, field);
  for (const key of Object.keys(source)) {
    if (!fields.includes(key)) fail(`${field}.${key} is not permitted.`);
  }
  return source;
}

function opaqueId(value, field) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    fail(`${field} must be a bounded opaque identifier.`);
  }
  return value;
}

function positiveInteger(value, field) {
  if (!Number.isSafeInteger(value) || value < 1) fail(`${field} must be a positive safe integer.`);
  return value;
}

function boundedPositiveInteger(value, field, max) {
  const normalized = positiveInteger(value, field);
  if (normalized > max) fail(`${field} exceeds its supported bound.`);
  return normalized;
}

function finiteNumber(value, field, { min = -4096, max = 4096 } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    fail(`${field} must be a bounded finite number.`);
  }
  return Object.is(value, -0) ? 0 : value;
}

function positiveNumber(value, field, { max = 4096 } = {}) {
  return finiteNumber(value, field, { min: Number.MIN_VALUE, max });
}

function digest(value, field = 'digest') {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    fail(`${field} must be a lowercase SHA-256 digest.`);
  }
  return value;
}

function freeze(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) freeze(child, seen);
  return Object.freeze(value);
}

function immutableClone(value) {
  return freeze(structuredClone(value));
}

function normalizedBinding(value) {
  const source = exactFields(value, [
    'projectId',
    'projectRevision',
    'roomVariantId',
    'roomVersion',
  ], 'binding');
  return {
    projectId: opaqueId(source.projectId, 'binding.projectId'),
    projectRevision: positiveInteger(source.projectRevision, 'binding.projectRevision'),
    roomVariantId: opaqueId(source.roomVariantId, 'binding.roomVariantId'),
    roomVersion: positiveInteger(source.roomVersion, 'binding.roomVersion'),
  };
}

function bindingCoordinates(value) {
  return {
    projectId: value.projectId,
    projectRevision: value.projectRevision,
    roomVariantId: value.roomVariantId,
    roomVersion: value.roomVersion,
  };
}

export function roomPreviewBindingKey(value) {
  const binding = normalizedBinding(value);
  return JSON.stringify([
    binding.projectId,
    binding.projectRevision,
    binding.roomVariantId,
    binding.roomVersion,
  ]);
}

export function roomPreviewScenePath(value) {
  const binding = normalizedBinding(value);
  return `/api/projects/${encodeURIComponent(binding.projectId)}`
    + `/revisions/${binding.projectRevision}`
    + `/room-variants/${encodeURIComponent(binding.roomVariantId)}`
    + `/versions/${binding.roomVersion}/preview-scene`;
}

export function createRoomPreviewBinding(value) {
  const binding = normalizedBinding(value);
  return freeze({
    ...binding,
    key: roomPreviewBindingKey(binding),
    path: roomPreviewScenePath(binding),
  });
}

function normalizedResourceArtifact(value) {
  const source = exactFields(value, [
    'digest',
    'mediaType',
    'pixelSize',
    'resourceUri',
  ], 'resource');
  if (source.mediaType !== 'image/png') fail('resource.mediaType must be image/png.');
  const pixelSize = exactFields(source.pixelSize, ['width', 'height'], 'resource.pixelSize');
  return {
    digest: digest(source.digest, 'resource.digest'),
    mediaType: source.mediaType,
    pixelSize: {
      width: boundedPositiveInteger(pixelSize.width, 'resource.pixelSize.width', 65535),
      height: boundedPositiveInteger(pixelSize.height, 'resource.pixelSize.height', 65535),
    },
    resourceUri: source.resourceUri,
  };
}

export function roomPreviewArtifactPath(projectId, artifact) {
  const exactProjectId = opaqueId(projectId, 'projectId');
  const resource = normalizedResourceArtifact(artifact);
  return `/api/projects/${encodeURIComponent(exactProjectId)}/artifacts/sha256/${resource.digest}`;
}

export function validateRoomPreviewResource(value, projectId) {
  const resource = normalizedResourceArtifact(value);
  const resourcePath = roomPreviewArtifactPath(projectId, resource);
  if (resource.resourceUri !== undefined && resource.resourceUri !== resourcePath) {
    fail('resource.resourceUri must be the exact queryless same-origin digest path.');
  }
  return freeze({
    digest: resource.digest,
    mediaType: resource.mediaType,
    pixelSize: resource.pixelSize,
    resourcePath,
  });
}

function extent(value, field) {
  const source = record(value, field);
  const x = finiteNumber(source.x, `${field}.x`);
  const y = finiteNumber(source.y, `${field}.y`);
  const width = positiveNumber(source.width, `${field}.width`);
  const height = positiveNumber(source.height, `${field}.height`);
  return { x, y, width, height };
}

function extent3d(value, field) {
  const source = exactFields(value, ['x', 'y', 'z', 'width', 'height', 'depth'], field);
  return {
    ...extent(source, field),
    z: finiteNumber(source.z, `${field}.z`),
    depth: finiteNumber(source.depth, `${field}.depth`, { min: 0, max: 4096 }),
  };
}

export function roomPreviewSceneExtent(scene) {
  const source = record(scene, 'scene');
  const room = record(source.room, 'scene.room');
  const roomBounds = extent(room.bounds, 'scene.room.bounds');
  if (!Array.isArray(source.entities)) fail('scene.entities must be an array.');
  const extents = [{ ...roomBounds, z: 0, depth: 0 }];
  for (const [entityIndex, entity] of source.entities.entries()) {
    const visual = record(record(entity, `scene.entities[${entityIndex}]`).visual, `scene.entities[${entityIndex}].visual`);
    extents.push(extent3d(visual.extent, `scene.entities[${entityIndex}].visual.extent`));
  }
  const left = Math.min(...extents.map((entry) => entry.x));
  const top = Math.min(...extents.map((entry) => entry.y));
  const right = Math.max(...extents.map((entry) => entry.x + entry.width));
  const bottom = Math.max(...extents.map((entry) => entry.y + entry.height));
  const near = Math.min(...extents.map((entry) => entry.z));
  const far = Math.max(...extents.map((entry) => entry.z + entry.depth));
  const canonical = { x: left, y: top, z: near, width: right - left, height: bottom - top, depth: far - near };
  if (source.visualExtent !== undefined) {
    const projected = extent3d(source.visualExtent, 'scene.visualExtent');
    for (const key of ['x', 'y', 'z', 'width', 'height', 'depth']) {
      if (projected[key] !== canonical[key]) fail('scene.visualExtent does not match the exact room and entity extents.');
    }
  }
  return freeze(canonical);
}

export function mapRoomPreviewViewport(scene, {
  width,
  height,
  padding = 0.5,
} = {}) {
  const viewportWidth = positiveNumber(width, 'viewport.width', { max: 16384 });
  const viewportHeight = positiveNumber(height, 'viewport.height', { max: 16384 });
  const exactPadding = finiteNumber(padding, 'viewport.padding', { min: 0, max: 16 });
  const sceneExtent = roomPreviewSceneExtent(scene);
  const viewBox = {
    x: sceneExtent.x - exactPadding,
    y: sceneExtent.y - exactPadding,
    width: sceneExtent.width + exactPadding * 2,
    height: sceneExtent.height + exactPadding * 2,
  };
  const scale = Math.min(viewportWidth / viewBox.width, viewportHeight / viewBox.height);
  const paintedWidth = viewBox.width * scale;
  const paintedHeight = viewBox.height * scale;
  const letterboxX = (viewportWidth - paintedWidth) / 2;
  const letterboxY = (viewportHeight - paintedHeight) / 2;
  return freeze({
    sceneExtent,
    viewBox,
    viewport: { width: viewportWidth, height: viewportHeight },
    scale,
    translate: {
      x: letterboxX - viewBox.x * scale,
      y: letterboxY - viewBox.y * scale,
    },
    letterbox: { x: letterboxX, y: letterboxY },
  });
}

function drawOrderEntry(entity, entityIndex, segment, segmentIndex) {
  const entityId = opaqueId(entity.entityId, `scene.entities[${entityIndex}].entityId`);
  const source = record(entity.source, `scene.entities[${entityIndex}].source`);
  if (!Object.hasOwn(LAYER_ORDER, source.layer)) {
    fail(`scene.entities[${entityIndex}].source.layer is not supported.`);
  }
  const groundAnchor = record(entity.groundAnchor, `scene.entities[${entityIndex}].groundAnchor`);
  const segmentId = opaqueId(segment.segmentId, `scene.entities[${entityIndex}].segments[${segmentIndex}].segmentId`);
  if (!Object.hasOwn(SEGMENT_ORDER, segment.phase)) {
    fail(`scene.entities[${entityIndex}].segments[${segmentIndex}].phase is not supported.`);
  }
  const visualExtent = record(segment.visualExtent, `scene.entities[${entityIndex}].segments[${segmentIndex}].visualExtent`);
  return {
    entityId,
    segmentId,
    depth: {
      layer: source.layer,
      groundY: finiteNumber(groundAnchor.y, `scene.entities[${entityIndex}].groundAnchor.y`),
      groundX: finiteNumber(groundAnchor.x, `scene.entities[${entityIndex}].groundAnchor.x`),
      phase: segment.phase,
      elevation: finiteNumber(visualExtent.z, `scene.entities[${entityIndex}].segments[${segmentIndex}].visualExtent.z`),
    },
  };
}

function compareDrawOrder(left, right) {
  return LAYER_ORDER[left.depth.layer] - LAYER_ORDER[right.depth.layer]
    || left.depth.groundY - right.depth.groundY
    || left.depth.groundX - right.depth.groundX
    || SEGMENT_ORDER[left.depth.phase] - SEGMENT_ORDER[right.depth.phase]
    || left.depth.elevation - right.depth.elevation
    || left.entityId.localeCompare(right.entityId)
    || left.segmentId.localeCompare(right.segmentId);
}

export function normalizeRoomPreviewDrawOrder(scene) {
  const source = record(scene, 'scene');
  if (!Array.isArray(source.entities)) fail('scene.entities must be an array.');
  const keys = new Set();
  const normalized = source.entities.flatMap((candidate, entityIndex) => {
    const entity = record(candidate, `scene.entities[${entityIndex}]`);
    if (!Array.isArray(entity.segments) || entity.segments.length < 1 || entity.segments.length > 3) {
      fail(`scene.entities[${entityIndex}].segments must contain one to three entries.`);
    }
    const phases = new Set();
    return entity.segments.map((candidateSegment, segmentIndex) => {
      const segment = record(candidateSegment, `scene.entities[${entityIndex}].segments[${segmentIndex}]`);
      if (phases.has(segment.phase)) fail(`scene.entities[${entityIndex}].segments phases must be unique.`);
      phases.add(segment.phase);
      const entry = drawOrderEntry(entity, entityIndex, segment, segmentIndex);
      const key = `${entry.entityId}\u0000${entry.segmentId}`;
      if (keys.has(key)) fail('scene entity/segment draw identities must be unique.');
      keys.add(key);
      return entry;
    });
  }).sort(compareDrawOrder);
  return immutableClone(normalized);
}

export function validateRoomPreviewDrawOrder(scene) {
  const source = record(scene, 'scene');
  if (!Array.isArray(source.drawOrder)) fail('scene.drawOrder must be an array.');
  const expected = normalizeRoomPreviewDrawOrder(source);
  if (source.drawOrder.length !== expected.length) fail('scene.drawOrder is incomplete.');
  for (let index = 0; index < expected.length; index += 1) {
    const actual = exactFields(source.drawOrder[index], ['entityId', 'segmentId', 'depth'], `scene.drawOrder[${index}]`);
    const depth = exactFields(actual.depth, [
      'layer', 'groundY', 'groundX', 'phase', 'elevation',
    ], `scene.drawOrder[${index}].depth`);
    const canonical = expected[index];
    if (actual.entityId !== canonical.entityId
        || actual.segmentId !== canonical.segmentId
        || depth.layer !== canonical.depth.layer
        || depth.groundY !== canonical.depth.groundY
        || depth.groundX !== canonical.depth.groundX
        || depth.phase !== canonical.depth.phase
        || depth.elevation !== canonical.depth.elevation) {
      fail('scene.drawOrder does not match the canonical scene geometry.');
    }
  }
  return expected;
}

export function assertRoomPreviewSceneBinding(scene, bindingValue) {
  const binding = normalizedBinding(bindingValue);
  const sceneRecord = record(scene, 'scene');
  if (sceneRecord.schemaVersion !== 1 || sceneRecord.kind !== 'studio.room-preview-scene') {
    fail(ERROR_PRESENTATION.PREVIEW_SCENE_INVALID);
  }
  const source = exactFields(sceneRecord.source, [
    'projectId', 'projectRevision', 'roomVariantId', 'roomVersion', 'roomContentFingerprint',
  ], 'scene.source');
  const contentFingerprint = digest(source.roomContentFingerprint, 'scene.source.roomContentFingerprint');
  if (source.projectId !== binding.projectId
      || source.projectRevision !== binding.projectRevision
      || source.roomVariantId !== binding.roomVariantId
      || source.roomVersion !== binding.roomVersion) {
    fail(ERROR_PRESENTATION.PREVIEW_BINDING_MISMATCH);
  }
  if (record(sceneRecord.room, 'scene.room').contentFingerprint !== contentFingerprint) {
    fail('scene room fingerprint does not match its exact source binding.');
  }
  return createRoomPreviewBinding(binding);
}

function emptyUiState() {
  return freeze({
    status: 'CLOSED',
    binding: null,
    bindingKey: null,
    requestId: null,
    scene: null,
    failedResourceDigests: Object.freeze([]),
    error: null,
  });
}

export function createRoomPreviewUiState() {
  return emptyUiState();
}

function stateRecord(value) {
  const source = record(value, 'state');
  if (!ROOM_PREVIEW_UI_STATES.includes(source.status)) fail('state.status is invalid.');
  return source;
}

function requestId(value) {
  return positiveInteger(value, 'event.requestId');
}

function ownsEvent(state, event) {
  return event.bindingKey === state.bindingKey && event.requestId === state.requestId;
}

function loadingState(bindingValue, exactRequestId) {
  const binding = createRoomPreviewBinding(bindingValue);
  return freeze({
    status: 'LOADING',
    binding,
    bindingKey: binding.key,
    requestId: requestId(exactRequestId),
    scene: null,
    failedResourceDigests: Object.freeze([]),
    error: null,
  });
}

function fixedError(code) {
  const safeCode = Object.hasOwn(ERROR_PRESENTATION, code) ? code : 'PREVIEW_UNAVAILABLE';
  return freeze({ code: safeCode, message: ERROR_PRESENTATION[safeCode] });
}

export function transitionRoomPreviewUiState(current, eventValue) {
  const state = stateRecord(current);
  const event = record(eventValue, 'event');
  if (event.type === 'CLOSE') return emptyUiState();
  if (event.type === 'OPEN') return loadingState(event.binding, event.requestId);
  if (event.type === 'RETRY') {
    if (!['ERROR', 'DEGRADED'].includes(state.status) || state.binding === null) {
      fail(`RETRY is not valid while the preview is ${state.status}.`);
    }
    return loadingState(bindingCoordinates(state.binding), event.requestId);
  }
  if (!['SCENE_READY', 'LOAD_FAILED', 'RESOURCE_FAILED', 'RESOURCE_RECOVERED'].includes(event.type)) {
    fail('event.type is invalid.');
  }
  if (!ownsEvent(state, event)) return state;
  if (event.type === 'SCENE_READY') {
    if (state.status !== 'LOADING') fail(`SCENE_READY is not valid while the preview is ${state.status}.`);
    assertRoomPreviewSceneBinding(event.scene, bindingCoordinates(state.binding));
    validateRoomPreviewDrawOrder(event.scene);
    roomPreviewSceneExtent(event.scene);
    for (const entity of event.scene.entities) {
      for (const segment of entity.segments) {
        validateRoomPreviewResource(segment.artifact, state.binding.projectId);
      }
    }
    return freeze({
      ...state,
      status: 'READY',
      scene: immutableClone(event.scene),
      failedResourceDigests: Object.freeze([]),
      error: null,
    });
  }
  if (event.type === 'LOAD_FAILED') {
    if (state.status !== 'LOADING') fail(`LOAD_FAILED is not valid while the preview is ${state.status}.`);
    return freeze({
      ...state,
      status: 'ERROR',
      scene: null,
      failedResourceDigests: Object.freeze([]),
      error: fixedError(event.code),
    });
  }
  if (!['READY', 'DEGRADED'].includes(state.status) || state.scene === null) {
    fail(`${event.type} is not valid while the preview is ${state.status}.`);
  }
  const failedDigest = digest(event.digest, 'event.digest');
  const sceneDigests = new Set(state.scene.entities.flatMap((entity) => (
    entity.segments.map((segment) => segment.artifact.digest)
  )));
  if (!sceneDigests.has(failedDigest)) fail('event.digest is not part of the exact preview scene.');
  const failed = new Set(state.failedResourceDigests);
  if (event.type === 'RESOURCE_FAILED') failed.add(failedDigest);
  else failed.delete(failedDigest);
  return freeze({
    ...state,
    status: failed.size === 0 ? 'READY' : 'DEGRADED',
    failedResourceDigests: Object.freeze([...failed].sort()),
  });
}
