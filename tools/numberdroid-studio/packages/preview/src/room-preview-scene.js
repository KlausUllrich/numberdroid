export const ROOM_PREVIEW_SCENE_SCHEMA_VERSION = 1;
export const ROOM_PREVIEW_SCENE_KIND = 'studio.room-preview-scene';
export const ROOM_PREVIEW_PRESENTATION_NAMESPACE = 'studio.preview.presentation';
export const ROOM_PREVIEW_PRESENTATION_SCHEMA_VERSION = 1;
export const ROOM_PREVIEW_BLEND_MODE = 'SOURCE_OVER';
export const ROOM_PREVIEW_SEGMENT_PHASES = Object.freeze(['BACKGROUND', 'BODY', 'FOREGROUND']);

const PHASE_ORDER = Object.freeze(Object.fromEntries(
  ROOM_PREVIEW_SEGMENT_PHASES.map((phase, index) => [phase, index]),
));
const LAYER_ORDER = Object.freeze({ STRUCTURAL_SURFACE: 0, SET_DRESSING: 1 });
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const MAX_COORDINATE = 256;

function canonicalNumber(value) {
  return value === 0 ? 0 : value;
}

function sceneError(code, message, details = {}) {
  const error = new Error(message);
  error.name = 'RoomPreviewSceneError';
  error.code = code;
  error.details = details;
  return error;
}

function assert(condition, code, message, details) {
  if (!condition) throw sceneError(code, message, details);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertRecord(value, field) {
  assert(isRecord(value), 'ROOM_PREVIEW_INPUT_INVALID', `${field} must be an object.`, { field });
  return value;
}

function assertExactFields(value, allowed, field) {
  assert(isRecord(value), 'ROOM_PREVIEW_PRESENTATION_INVALID', `${field} must be an object.`, { field });
  const record = value;
  for (const key of Reflect.ownKeys(record)) {
    assert(typeof key === 'string' && allowed.includes(key), 'ROOM_PREVIEW_PRESENTATION_INVALID', `${field} contains a field outside the inert presentation contract.`, {
      field: typeof key === 'string' ? `${field}.${key}` : field,
    });
  }
  return record;
}

function requiredString(value, field) {
  assert(typeof value === 'string' && value.length > 0 && value.length <= 256, 'ROOM_PREVIEW_INPUT_INVALID', `${field} must be a nonempty bounded string.`, { field });
  return value;
}

function boundedString(value, field, max = 2048) {
  assert(typeof value === 'string' && value.length > 0 && value.length <= max, 'ROOM_PREVIEW_INPUT_INVALID', `${field} must be a nonempty bounded string.`, { field });
  return value;
}

function requiredInteger(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  assert(Number.isSafeInteger(value) && value >= min && value <= max, 'ROOM_PREVIEW_INPUT_INVALID', `${field} must be a safe integer from ${min} to ${max}.`, { field });
  return value;
}

function presentationNumber(value, field, { min = -MAX_COORDINATE, max = MAX_COORDINATE, positive = false } = {}) {
  assert(
    typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max && (!positive || value > 0),
    'ROOM_PREVIEW_PRESENTATION_INVALID',
    `${field} must be a bounded finite${positive ? ' positive' : ''} number.`,
    { field, min, max },
  );
  return canonicalNumber(value);
}

function presentationPoint(value, field) {
  const record = assertExactFields(value, ['x', 'y'], field);
  return {
    x: presentationNumber(record.x, `${field}.x`),
    y: presentationNumber(record.y, `${field}.y`),
  };
}

function presentationRect(value, field) {
  const record = assertExactFields(value, ['x', 'y', 'width', 'height'], field);
  return {
    x: presentationNumber(record.x, `${field}.x`),
    y: presentationNumber(record.y, `${field}.y`),
    width: presentationNumber(record.width, `${field}.width`, { min: 0, max: MAX_COORDINATE * 2, positive: true }),
    height: presentationNumber(record.height, `${field}.height`, { min: 0, max: MAX_COORDINATE * 2, positive: true }),
  };
}

function sourceRect(value, field) {
  const rect = presentationRect(value, field);
  assert(
    rect.x >= 0 && rect.y >= 0 && rect.width <= 1 && rect.height <= 1
      && rect.x + rect.width <= 1 && rect.y + rect.height <= 1,
    'ROOM_PREVIEW_PRESENTATION_INVALID',
    `${field} must lie wholly within normalized source coordinates 0..1.`,
    { field },
  );
  return rect;
}

function defaultPresentation(span, groundAnchor) {
  return {
    groundAnchor,
    visualBounds: { x: 0, y: 0, width: span.width, height: span.height },
    visualOffset: { x: 0, y: 0 },
    elevation: 0,
    segments: [{
      segmentId: 'body',
      phase: 'BODY',
      sourceRect: { x: 0, y: 0, width: 1, height: 1 },
      visualBounds: { x: 0, y: 0, width: span.width, height: span.height },
      visualOffset: { x: 0, y: 0 },
      elevation: 0,
    }],
  };
}

function normalizePresentation(value, span, defaultGroundAnchor) {
  const fallback = defaultPresentation(span, defaultGroundAnchor);
  if (value === undefined) {
    return { presentation: fallback, invalid: false, usesDefaultGroundAnchor: true };
  }
  try {
    const record = assertExactFields(value, [
      'schemaVersion', 'groundAnchor', 'visualBounds', 'visualOffset', 'elevation', 'segments',
    ], `metadata.extensions.${ROOM_PREVIEW_PRESENTATION_NAMESPACE}`);
    assert(
      record.schemaVersion === ROOM_PREVIEW_PRESENTATION_SCHEMA_VERSION,
      'ROOM_PREVIEW_PRESENTATION_INVALID',
      `metadata.extensions.${ROOM_PREVIEW_PRESENTATION_NAMESPACE}.schemaVersion must be ${ROOM_PREVIEW_PRESENTATION_SCHEMA_VERSION}.`,
      { field: `metadata.extensions.${ROOM_PREVIEW_PRESENTATION_NAMESPACE}.schemaVersion` },
    );
    const groundAnchor = record.groundAnchor === undefined
      ? fallback.groundAnchor
      : presentationPoint(record.groundAnchor, `metadata.extensions.${ROOM_PREVIEW_PRESENTATION_NAMESPACE}.groundAnchor`);
    const visualBounds = record.visualBounds === undefined
      ? fallback.visualBounds
      : presentationRect(record.visualBounds, `metadata.extensions.${ROOM_PREVIEW_PRESENTATION_NAMESPACE}.visualBounds`);
    const visualOffset = record.visualOffset === undefined
      ? fallback.visualOffset
      : presentationPoint(record.visualOffset, `metadata.extensions.${ROOM_PREVIEW_PRESENTATION_NAMESPACE}.visualOffset`);
    const elevation = record.elevation === undefined
      ? fallback.elevation
      : presentationNumber(record.elevation, `metadata.extensions.${ROOM_PREVIEW_PRESENTATION_NAMESPACE}.elevation`);
    let segments = fallback.segments.map((segment) => ({
      ...segment,
      visualBounds,
      visualOffset,
      elevation,
    }));
    if (record.segments !== undefined) {
      assert(
        Array.isArray(record.segments) && record.segments.length >= 1 && record.segments.length <= 3,
        'ROOM_PREVIEW_PRESENTATION_INVALID',
        `metadata.extensions.${ROOM_PREVIEW_PRESENTATION_NAMESPACE}.segments must contain one to three entries.`,
        { field: `metadata.extensions.${ROOM_PREVIEW_PRESENTATION_NAMESPACE}.segments` },
      );
      for (let index = 0; index < record.segments.length; index += 1) {
        assert(Object.hasOwn(record.segments, index), 'ROOM_PREVIEW_PRESENTATION_INVALID', 'Presentation segments must not contain sparse entries.', {
          field: `metadata.extensions.${ROOM_PREVIEW_PRESENTATION_NAMESPACE}.segments[${index}]`,
        });
      }
      const phases = new Set();
      segments = record.segments.map((candidate, index) => {
        const field = `metadata.extensions.${ROOM_PREVIEW_PRESENTATION_NAMESPACE}.segments[${index}]`;
        const segment = assertExactFields(candidate, [
          'phase', 'sourceRect', 'visualBounds', 'visualOffset', 'elevation',
        ], field);
        assert(
          ROOM_PREVIEW_SEGMENT_PHASES.includes(segment.phase) && !phases.has(segment.phase),
          'ROOM_PREVIEW_PRESENTATION_INVALID',
          `${field}.phase must be a unique BACKGROUND, BODY, or FOREGROUND phase.`,
          { field: `${field}.phase` },
        );
        phases.add(segment.phase);
        return {
          segmentId: segment.phase.toLowerCase(),
          phase: segment.phase,
          sourceRect: sourceRect(segment.sourceRect, `${field}.sourceRect`),
          visualBounds: segment.visualBounds === undefined
            ? visualBounds
            : presentationRect(segment.visualBounds, `${field}.visualBounds`),
          visualOffset: segment.visualOffset === undefined
            ? visualOffset
            : presentationPoint(segment.visualOffset, `${field}.visualOffset`),
          elevation: segment.elevation === undefined
            ? elevation
            : presentationNumber(segment.elevation, `${field}.elevation`),
        };
      }).sort((left, right) => PHASE_ORDER[left.phase] - PHASE_ORDER[right.phase]);
    }
    return {
      presentation: { groundAnchor, visualBounds, visualOffset, elevation, segments },
      invalid: false,
      usesDefaultGroundAnchor: record.groundAnchor === undefined,
    };
  } catch {
    return { presentation: fallback, invalid: true, usesDefaultGroundAnchor: true };
  }
}

function authoredGroundAnchor(value, span) {
  const inferred = { x: span.width / 2, y: span.height };
  if (value === null || value === undefined) return { groundAnchor: inferred, inferred: true };
  try {
    const anchor = assertExactFields(value, ['x', 'y'], 'metadata.anchor');
    const x = requiredInteger(anchor.x, 'metadata.anchor.x', { min: 0, max: span.width - 1 });
    const y = requiredInteger(anchor.y, 'metadata.anchor.y', { min: 0, max: span.height - 1 });
    return { groundAnchor: { x: x + 0.5, y: y + 0.5 }, inferred: false };
  } catch {
    return { groundAnchor: inferred, inferred: true };
  }
}

function rotatedSpan(span, rotation) {
  return rotation === 90 || rotation === 270
    ? { width: span.height, height: span.width }
    : { width: span.width, height: span.height };
}

function rotatedPoint(point, span, rotation) {
  if (rotation === 0) return { ...point };
  if (rotation === 90) return { x: span.height - point.y, y: point.x };
  if (rotation === 180) return { x: span.width - point.x, y: span.height - point.y };
  return { x: point.y, y: span.width - point.x };
}

function rotatedVector(vector, rotation) {
  let rotated;
  if (rotation === 0) rotated = { ...vector };
  else if (rotation === 90) rotated = { x: -vector.y, y: vector.x };
  else if (rotation === 180) rotated = { x: -vector.x, y: -vector.y };
  else rotated = { x: vector.y, y: -vector.x };
  return { x: canonicalNumber(rotated.x), y: canonicalNumber(rotated.y) };
}

function rotatedRect(rect, span, rotation) {
  if (rotation === 0) return { ...rect };
  if (rotation === 90) return {
    x: span.height - (rect.y + rect.height), y: rect.x, width: rect.height, height: rect.width,
  };
  if (rotation === 180) return {
    x: span.width - (rect.x + rect.width), y: span.height - (rect.y + rect.height), width: rect.width, height: rect.height,
  };
  return {
    x: rect.y, y: span.width - (rect.x + rect.width), width: rect.height, height: rect.width,
  };
}

function worldPoint(point, placementAnchor) {
  return {
    x: placementAnchor.x + point.x,
    y: placementAnchor.y + point.y,
  };
}

function worldRect(rect, placementAnchor) {
  return {
    x: placementAnchor.x + rect.x,
    y: placementAnchor.y + rect.y,
    width: rect.width,
    height: rect.height,
  };
}

function extentFor(bounds, offset, elevation) {
  return {
    x: bounds.x + offset.x,
    y: bounds.y + offset.y,
    z: elevation,
    width: bounds.width,
    height: bounds.height,
  };
}

function unionExtents(extents) {
  const left = Math.min(...extents.map((extent) => extent.x));
  const top = Math.min(...extents.map((extent) => extent.y));
  const right = Math.max(...extents.map((extent) => extent.x + extent.width));
  const bottom = Math.max(...extents.map((extent) => extent.y + extent.height));
  const near = Math.min(...extents.map((extent) => extent.z));
  const far = Math.max(...extents.map((extent) => extent.z));
  return { x: left, y: top, z: near, width: right - left, height: bottom - top, depth: far - near };
}

function overhangFor(logicalFootprint, visualExtent) {
  return {
    left: Math.max(0, logicalFootprint.x - visualExtent.x),
    top: Math.max(0, logicalFootprint.y - visualExtent.y),
    right: Math.max(0, visualExtent.x + visualExtent.width - (logicalFootprint.x + logicalFootprint.width)),
    bottom: Math.max(0, visualExtent.y + visualExtent.height - (logicalFootprint.y + logicalFootprint.height)),
  };
}

function footprintCells(footprint) {
  const cells = [];
  for (let y = footprint.y; y < footprint.y + footprint.height; y += 1) {
    for (let x = footprint.x; x < footprint.x + footprint.width; x += 1) cells.push({ x, y });
  }
  return cells;
}

function exactArtifact(asset, projectId) {
  const binding = assertRecord(asset.sliceBinding, `assets.${asset.assetId}.sliceBinding`);
  assert(
    binding.projectId === projectId,
    'ROOM_PREVIEW_ARTIFACT_PROJECT_MISMATCH',
    'The exact preview artifact binding must belong to the projected project.',
    { projectId, bindingProjectId: binding.projectId, assetId: asset.assetId },
  );
  assert(
    typeof binding.digest === 'string' && HASH_PATTERN.test(binding.digest),
    'ROOM_PREVIEW_ARTIFACT_INVALID',
    'Preview assets require an exact lowercase SHA-256 artifact digest.',
    { assetId: asset.assetId },
  );
  assert(
    binding.mediaType === 'image/png',
    'ROOM_PREVIEW_ARTIFACT_INVALID',
    'Preview assets require an approved image/png artifact.',
    { assetId: asset.assetId },
  );
  return {
    digest: binding.digest,
    mediaType: binding.mediaType,
    pixelSize: {
      width: requiredInteger(binding.width, `assets.${asset.assetId}.sliceBinding.width`, { min: 1, max: 65535 }),
      height: requiredInteger(binding.height, `assets.${asset.assetId}.sliceBinding.height`, { min: 1, max: 65535 }),
    },
  };
}

function assetVersions(assets) {
  const values = assets instanceof Map ? [...assets.values()] : assets;
  assert(Array.isArray(values), 'ROOM_PREVIEW_INPUT_INVALID', 'assets must be an array or Map of exact asset versions.', { field: 'assets' });
  const versions = new Map();
  for (const [index, asset] of values.entries()) {
    assertRecord(asset, `assets[${index}]`);
    const assetId = requiredString(asset.assetId, `assets[${index}].assetId`);
    const assetVersion = requiredInteger(asset.assetVersion, `assets[${index}].assetVersion`, { min: 1 });
    const metadataVersion = requiredInteger(asset.metadataVersion, `assets[${index}].metadataVersion`, { min: 1 });
    const key = `${assetId}@${assetVersion}:${metadataVersion}`;
    assert(!versions.has(key), 'ROOM_PREVIEW_ASSET_DUPLICATE', 'assets must not contain duplicate exact versions.', { key });
    versions.set(key, asset);
  }
  return versions;
}

function previewFinding(placementId, placementIndex) {
  return {
    findingId: `studio.preview.presentation.invalid:${placementId}`,
    severity: 'WARNING',
    scope: 'PREVIEW_ONLY',
    ruleId: 'studio.preview.presentation.invalid',
    targetKind: 'roomPlacement',
    targetId: placementId,
    path: `/placements/${placementIndex}/asset/metadata/extensions/${ROOM_PREVIEW_PRESENTATION_NAMESPACE}`,
    explanation: 'Optional Studio preview presentation metadata is malformed; the portable scene uses safe visual defaults.',
    remediation: 'Repair or remove the optional Studio preview presentation extension. Room gameplay semantics are unaffected.',
    validatorVersion: 'numberdroid-studio.room-preview-scene.v1',
  };
}

function inferredAnchorFinding(placementId, placementIndex) {
  return {
    findingId: `studio.preview.ground-anchor.inferred:${placementId}`,
    severity: 'WARNING',
    scope: 'PREVIEW_ONLY',
    ruleId: 'studio.preview.ground-anchor.inferred',
    targetKind: 'roomPlacement',
    targetId: placementId,
    path: `/placements/${placementIndex}/asset/metadata/anchor`,
    explanation: 'The exact asset has no usable authored anchor; Studio Preview inferred bottom-center ground contact.',
    remediation: 'Author a bounded asset anchor or an explicit Studio preview ground anchor. Room gameplay semantics are unchanged.',
    validatorVersion: 'numberdroid-studio.room-preview-scene.v1',
  };
}

function entityFor(placement, placementIndex, asset, projectId) {
  const span = assertRecord(asset.metadata?.spanTiles, `assets.${asset.assetId}.metadata.spanTiles`);
  const sourceSpan = {
    width: requiredInteger(span.width, `assets.${asset.assetId}.metadata.spanTiles.width`, { min: 1, max: 64 }),
    height: requiredInteger(span.height, `assets.${asset.assetId}.metadata.spanTiles.height`, { min: 1, max: 64 }),
  };
  const rotation = requiredInteger(placement.rotation, `room.placements[${placementIndex}].rotation`, { min: 0, max: 270 });
  assert([0, 90, 180, 270].includes(rotation), 'ROOM_PREVIEW_INPUT_INVALID', 'Placement rotation must be a cardinal quarter turn.', { placementIndex, rotation });
  const placementAnchor = assertRecord(placement.anchor, `room.placements[${placementIndex}].anchor`);
  const anchor = {
    x: requiredInteger(placementAnchor.x, `room.placements[${placementIndex}].anchor.x`, { max: 63 }),
    y: requiredInteger(placementAnchor.y, `room.placements[${placementIndex}].anchor.y`, { max: 63 }),
  };
  const footprintSize = rotatedSpan(sourceSpan, rotation);
  assert(Object.hasOwn(LAYER_ORDER, placement.layer), 'ROOM_PREVIEW_INPUT_INVALID', 'Placement layer is outside the portable room scene contract.', {
    placementIndex,
    layer: placement.layer,
  });
  const logicalFootprint = {
    x: anchor.x,
    y: anchor.y,
    z: 0,
    width: footprintSize.width,
    height: footprintSize.height,
  };
  logicalFootprint.cells = footprintCells(logicalFootprint);

  let extension;
  try {
    extension = asset.metadata?.extensions?.[ROOM_PREVIEW_PRESENTATION_NAMESPACE];
  } catch {
    extension = null;
  }
  const authoredAnchor = authoredGroundAnchor(asset.metadata?.anchor, sourceSpan);
  const normalized = normalizePresentation(extension, sourceSpan, authoredAnchor.groundAnchor);
  const presentation = normalized.presentation;
  const rotatedGroundAnchor = rotatedPoint(presentation.groundAnchor, sourceSpan, rotation);
  const groundAnchor = { ...worldPoint(rotatedGroundAnchor, anchor), z: 0 };
  const artifact = exactArtifact(asset, projectId);
  const segments = presentation.segments.map((segment) => {
    const bounds = worldRect(rotatedRect(segment.visualBounds, sourceSpan, rotation), anchor);
    const offset = { ...rotatedVector(segment.visualOffset, rotation), z: 0 };
    return {
      segmentId: segment.segmentId,
      phase: segment.phase,
      sourceRect: { ...segment.sourceRect },
      visualBounds: { ...bounds, z: 0 },
      visualOffset: offset,
      elevation: segment.elevation,
      visualExtent: extentFor(bounds, offset, segment.elevation),
      artifact,
      compositing: { blendMode: ROOM_PREVIEW_BLEND_MODE, sourceAlpha: 'PRESERVE' },
    };
  });
  const baseBounds = worldRect(rotatedRect(presentation.visualBounds, sourceSpan, rotation), anchor);
  const baseOffset = { ...rotatedVector(presentation.visualOffset, rotation), z: 0 };
  const visualExtent = unionExtents(segments.map((segment) => segment.visualExtent));
  return {
    entity: {
      entityId: requiredString(placement.placementId, `room.placements[${placementIndex}].placementId`),
      source: {
        placementId: placement.placementId,
        assetId: asset.assetId,
        assetVersion: asset.assetVersion,
        metadataVersion: asset.metadataVersion,
        layer: placement.layer,
        rotation,
      },
      logicalFootprint,
      groundAnchor,
      visual: {
        bounds: { ...baseBounds, z: 0 },
        offset: baseOffset,
        elevation: presentation.elevation,
        extent: visualExtent,
        overhang: overhangFor(logicalFootprint, visualExtent),
      },
      artifact,
      segments,
    },
    findings: [
      ...(normalized.invalid ? [previewFinding(placement.placementId, placementIndex)] : []),
      ...(authoredAnchor.inferred && normalized.usesDefaultGroundAnchor
        ? [inferredAnchorFinding(placement.placementId, placementIndex)] : []),
    ],
  };
}

function cell(value, field, width, height) {
  const record = assertRecord(value, field);
  return {
    x: requiredInteger(record.x, `${field}.x`, { max: width - 1 }),
    y: requiredInteger(record.y, `${field}.y`, { max: height - 1 }),
  };
}

function compareCells(left, right) {
  return left.y - right.y || left.x - right.x;
}

function persistedFinding(value, index) {
  const field = `room.findings[${index}]`;
  const finding = assertRecord(value, field);
  assert(['ERROR', 'WARNING', 'INFO'].includes(finding.severity), 'ROOM_PREVIEW_INPUT_INVALID', `${field}.severity is invalid.`, { field: `${field}.severity` });
  return {
    findingId: requiredString(finding.findingId, `${field}.findingId`),
    severity: finding.severity,
    ruleId: requiredString(finding.ruleId, `${field}.ruleId`),
    targetKind: requiredString(finding.targetKind, `${field}.targetKind`),
    targetId: requiredString(finding.targetId, `${field}.targetId`),
    path: boundedString(finding.path, `${field}.path`),
    explanation: boundedString(finding.explanation, `${field}.explanation`),
    remediation: boundedString(finding.remediation, `${field}.remediation`),
    validatorVersion: requiredString(finding.validatorVersion, `${field}.validatorVersion`),
  };
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

/**
 * Projects one exact Studio project/room snapshot into a renderer-neutral,
 * read-only scene. Presentation extensions affect only this projection; the
 * room's logical footprint remains the sole occupancy/navigation geometry.
 */
export function createRoomPreviewScene({ projectId, projectRevision, room, assets }) {
  const exactProjectId = requiredString(projectId, 'projectId');
  const revision = requiredInteger(projectRevision, 'projectRevision', { min: 1 });
  const exactRoom = assertRecord(room, 'room');
  if (exactRoom.projectId !== undefined) {
    assert(exactRoom.projectId === exactProjectId, 'ROOM_PREVIEW_PROJECT_MISMATCH', 'The room must belong to the exact projected project.', {
      projectId: exactProjectId,
      roomProjectId: exactRoom.projectId,
    });
  }
  const roomVariantId = requiredString(exactRoom.roomVariantId, 'room.roomVariantId');
  const roomVersion = requiredInteger(exactRoom.version, 'room.version', { min: 1 });
  const contentFingerprint = boundedString(exactRoom.contentFingerprint, 'room.contentFingerprint', 64);
  assert(HASH_PATTERN.test(contentFingerprint), 'ROOM_PREVIEW_INPUT_INVALID', 'room.contentFingerprint must be lowercase SHA-256.', { field: 'room.contentFingerprint' });
  const width = requiredInteger(exactRoom.width, 'room.width', { min: 1, max: 64 });
  const height = requiredInteger(exactRoom.height, 'room.height', { min: 1, max: 64 });
  const originRecord = assertRecord(exactRoom.origin ?? { x: 0, y: 0 }, 'room.origin');
  const origin = {
    x: requiredInteger(originRecord.x, 'room.origin.x', { max: 0 }),
    y: requiredInteger(originRecord.y, 'room.origin.y', { max: 0 }),
    z: 0,
  };
  assert(Array.isArray(exactRoom.placements) && exactRoom.placements.length <= 256, 'ROOM_PREVIEW_INPUT_INVALID', 'room.placements must be a bounded array.', { field: 'room.placements' });
  const versions = assetVersions(assets);
  const entities = [];
  const findings = [];
  const placementIds = new Set();
  for (const [index, placement] of exactRoom.placements.entries()) {
    assertRecord(placement, `room.placements[${index}]`);
    const placementId = requiredString(placement.placementId, `room.placements[${index}].placementId`);
    assert(!placementIds.has(placementId), 'ROOM_PREVIEW_PLACEMENT_DUPLICATE', 'Room preview placement IDs must be unique.', { placementId });
    placementIds.add(placementId);
    const assetId = requiredString(placement.assetId, `room.placements[${index}].assetId`);
    const assetVersion = requiredInteger(placement.assetVersion, `room.placements[${index}].assetVersion`, { min: 1 });
    const metadataVersion = requiredInteger(placement.metadataVersion, `room.placements[${index}].metadataVersion`, { min: 1 });
    const key = `${assetId}@${assetVersion}:${metadataVersion}`;
    const asset = versions.get(key);
    assert(asset, 'ROOM_PREVIEW_ASSET_VERSION_NOT_FOUND', 'The exact asset version pinned by a room placement is unavailable.', {
      placementId, assetId, assetVersion, metadataVersion,
    });
    const projected = entityFor(placement, index, asset, exactProjectId);
    entities.push(projected.entity);
    findings.push(...projected.findings);
  }
  entities.sort((left, right) => left.entityId.localeCompare(right.entityId));
  findings.sort((left, right) => left.targetId.localeCompare(right.targetId) || left.path.localeCompare(right.path));
  const voidCells = (exactRoom.voidCells ?? []).map((candidate, index) => cell(candidate, `room.voidCells[${index}]`, width, height)).sort(compareCells);
  const blockedCells = (exactRoom.blockedCells ?? []).map((candidate, index) => cell(candidate, `room.blockedCells[${index}]`, width, height)).sort(compareCells);
  assert(Array.isArray(exactRoom.findings), 'ROOM_PREVIEW_INPUT_INVALID', 'room.findings must be the persisted exact finding array.', { field: 'room.findings' });
  const roomFindings = exactRoom.findings.map(persistedFinding);
  const connectors = Array.isArray(exactRoom.connectors)
    ? exactRoom.connectors.map((connector, index) => ({
        connectorId: requiredString(connector.connectorId, `room.connectors[${index}].connectorId`),
        side: connector.side,
        offset: connector.offset,
        width: connector.width,
        kind: connector.kind,
      })).sort((left, right) => left.connectorId.localeCompare(right.connectorId))
    : [];
  const visualExtent = unionExtents([
    { x: 0, y: 0, z: 0, width, height },
    ...entities.map((entity) => entity.visual.extent),
  ]);
  return deepFreeze({
    schemaVersion: ROOM_PREVIEW_SCENE_SCHEMA_VERSION,
    kind: ROOM_PREVIEW_SCENE_KIND,
    source: {
      projectId: exactProjectId,
      projectRevision: revision,
      roomVariantId,
      roomVersion,
      roomContentFingerprint: contentFingerprint,
    },
    coordinateSpace: {
      unit: 'ROOM_CELL',
      axes: { x: 'EAST', y: 'SOUTH', z: 'UP' },
      origin,
    },
    compositing: { blendMode: ROOM_PREVIEW_BLEND_MODE, sourceAlpha: 'PRESERVE' },
    visualExtent,
    room: {
      displayName: requiredString(exactRoom.displayName, 'room.displayName'),
      contentFingerprint,
      bounds: { x: 0, y: 0, z: 0, width, height },
      voidCells,
      blockedCells,
      connectors,
      findings: roomFindings,
    },
    entities,
    findings,
  });
}
