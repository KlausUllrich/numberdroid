import { createHash } from 'node:crypto';

export const NUMBERDROID_ADAPTER_VERSION = 'numberdroid-studio.adapter.v1';
export const NUMBERDROID_CANDIDATE_VALIDATOR_VERSION = 'numberdroid-studio.candidate-validator.v1';

const HASH = /^[a-f0-9]{64}$/;
const CAS_URI = /^studio:\/\/artifacts\/sha256\/([a-f0-9]{64})$/;
const SEMANTIC_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const SIZE_CLASSES = new Set(['tiny', 'small', 'medium', 'large', 'hero']);
const ORIENTATIONS = new Set(['horizontal', 'vertical', 'any']);
const SEVERITY_ORDER = Object.freeze({ ERROR: 0, WARNING: 1, INFO: 2 });
const TRUSTED_EXPORT_SNAPSHOTS = new WeakSet();

export class NumberdroidAdapterError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'NumberdroidAdapterError';
    this.code = code;
    this.details = structuredClone(details);
  }
}

function fail(code, message, details = {}) {
  throw new NumberdroidAdapterError(code, message, details);
}

function assert(condition, code, message, details = {}) {
  if (!condition) fail(code, message, details);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function canonicalCandidateJson(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

export function candidateSha256(value) {
  const bytes = typeof value === 'string' || Buffer.isBuffer(value)
    ? value
    : canonicalCandidateJson(value);
  return createHash('sha256').update(bytes).digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function exactFields(value, fields, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'NUMBERDROID_ADAPTER_INPUT_INVALID', `${label} must be an object.`);
  for (const key of Object.keys(value)) {
    assert(fields.includes(key), 'NUMBERDROID_ADAPTER_FIELD_FORBIDDEN', `${label}.${key} is not permitted.`, { field: `${label}.${key}` });
  }
  return value;
}

function requireString(value, label, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  assert(typeof value === 'string' && value.trim() === value && value.length > 0, 'NUMBERDROID_ADAPTER_INPUT_INVALID', `${label} must be a non-empty trimmed string.`, { field: label });
  assert(!/[\u0000-\u001f\u007f]/.test(value), 'NUMBERDROID_ADAPTER_INPUT_INVALID', `${label} contains control characters.`, { field: label });
  return value;
}

function requireInteger(value, label, { min = Number.MIN_SAFE_INTEGER } = {}) {
  assert(Number.isSafeInteger(value) && value >= min, 'NUMBERDROID_ADAPTER_INPUT_INVALID', `${label} must be an integer >= ${min}.`, { field: label, value });
  return value;
}

function requireSemanticId(value, label) {
  const id = requireString(value, label);
  assert(SEMANTIC_ID.test(id), 'NUMBERDROID_ADAPTER_SEMANTIC_ID_INVALID', `${label} is not a safe stable semantic ID.`, { field: label, value: id });
  return id;
}

function normalizeLogicalPath(value, label, root) {
  const path = requireString(value, label);
  assert(!path.startsWith('/') && !path.startsWith('\\') && !/^[a-zA-Z]:/.test(path), 'NUMBERDROID_ADAPTER_PATH_UNSAFE', `${label} must be repository-relative.`, { field: label, path });
  assert(!path.includes('\\') && !path.includes('//'), 'NUMBERDROID_ADAPTER_PATH_UNSAFE', `${label} must use normalized forward slashes.`, { field: label, path });
  const segments = path.split('/');
  assert(segments.every((segment) => segment && segment !== '.' && segment !== '..'), 'NUMBERDROID_ADAPTER_PATH_UNSAFE', `${label} contains an unsafe path segment.`, { field: label, path });
  assert(path.startsWith(root), 'NUMBERDROID_ADAPTER_PATH_OUTSIDE_ROOT', `${label} must stay below ${root}.`, { field: label, path, root });
  assert(path.toLocaleLowerCase('en-US').endsWith('.png'), 'NUMBERDROID_ADAPTER_PATH_MEDIA_MISMATCH', `${label} must target a PNG file.`, { field: label, path });
  return path;
}

function stableFinding({ severity, ruleId, objectRef, explanation, remediation, validatorVersion = NUMBERDROID_CANDIDATE_VALIDATOR_VERSION }) {
  return {
    severity,
    ruleId,
    objectRef,
    explanation,
    remediation,
    validatorVersion,
  };
}

function sortFindings(findings) {
  return findings.sort((left, right) => (
    SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity]
      || left.ruleId.localeCompare(right.ruleId)
      || left.objectRef.localeCompare(right.objectRef)
      || left.explanation.localeCompare(right.explanation)
  ));
}

function canonicalDigestFromUri(uri, expectedDigest, label) {
  const match = CAS_URI.exec(uri ?? '');
  assert(match && match[1] === expectedDigest, 'NUMBERDROID_ADAPTER_CAS_INVALID', `${label} must be a digest-derived Studio CAS URI.`, { field: label, uri, expectedDigest });
  return match[1];
}

function exactRoomValue(room) {
  return {
    projectId: room.projectId,
    roomVariantId: room.roomVariantId,
    version: room.version,
    roomArchetypeId: room.roomArchetypeId,
    archetypeVersion: room.archetypeVersion,
    displayName: room.displayName,
    lifecycle: room.lifecycle,
    width: room.width,
    height: room.height,
    origin: structuredClone(room.origin),
    intentTrace: structuredClone(room.intentTrace),
    connectors: structuredClone(room.connectors),
    placements: structuredClone(room.placements),
    voidCells: structuredClone(room.voidCells ?? []),
    blockedCells: structuredClone(room.blockedCells ?? []),
    acceptedWarningFindingIds: structuredClone(room.acceptedWarningFindingIds ?? []),
    parentVariantVersion: room.parentVariantVersion ?? null,
    parentFinalVersion: room.parentFinalVersion ?? null,
    contentFingerprint: room.contentFingerprint,
  };
}

function exactArchetypeValue(archetype) {
  return {
    projectId: archetype.projectId,
    roomArchetypeId: archetype.roomArchetypeId,
    version: archetype.version,
    kind: archetype.kind,
    displayName: archetype.displayName,
    tags: structuredClone(archetype.tags),
    dimensionPolicy: structuredClone(archetype.dimensionPolicy),
    structuralBands: structuredClone(archetype.structuralBands),
    orientation: archetype.orientation,
    connectorPolicy: structuredClone(archetype.connectorPolicy),
    allowedAssetKinds: structuredClone(archetype.allowedAssetKinds),
    allowedTags: structuredClone(archetype.allowedTags),
    requiredTags: structuredClone(archetype.requiredTags),
    rationality: archetype.rationality,
    governingRuleRefs: structuredClone(archetype.governingRuleRefs),
  };
}

function exactAssetValue(asset) {
  return {
    assetId: asset.assetId,
    assetVersion: asset.assetVersion,
    metadataVersion: asset.metadataVersion,
    name: asset.name,
    kind: asset.kind,
    lifecycle: asset.lifecycle,
    metadata: structuredClone(asset.metadata),
    metadataFingerprint: asset.metadataFingerprint,
    sliceBinding: structuredClone(asset.sliceBinding),
  };
}

function exactSourceValue(source) {
  return {
    schemaVersion: source.schemaVersion,
    sourceId: source.id,
    intakeId: source.intakeId,
    name: source.name,
    artifactUri: source.artifactUri,
    mediaType: source.mediaType,
    byteSize: source.byteSize,
    width: source.width,
    height: source.height,
    provenance: structuredClone(source.provenance),
    lifecycle: source.lifecycle?.state ?? null,
    reviewDisposition: source.review?.disposition ?? null,
  };
}

function normalizeExportProfile(candidate, archetype) {
  const profile = exactFields(candidate, [
    'schemaVersion', 'levelId', 'seed', 'sizeClass', 'corridorOrientation',
    'floorName', 'subtitle', 'objectiveDefault', 'objectiveAfterEnergy',
  ], 'exportProfile');
  assert(profile.schemaVersion === 1, 'NUMBERDROID_ADAPTER_SCHEMA_UNSUPPORTED', 'Unsupported export profile schema version.');
  const levelId = requireSemanticId(profile.levelId, 'exportProfile.levelId');
  assert(typeof profile.seed === 'string' || Number.isFinite(profile.seed), 'NUMBERDROID_ADAPTER_INPUT_INVALID', 'exportProfile.seed must be a string or finite number.');
  assert(SIZE_CLASSES.has(profile.sizeClass), 'NUMBERDROID_ADAPTER_INPUT_INVALID', 'exportProfile.sizeClass is unsupported.', { value: profile.sizeClass });
  const corridorOrientation = profile.corridorOrientation ?? archetype.orientation ?? 'any';
  assert(ORIENTATIONS.has(corridorOrientation), 'NUMBERDROID_ADAPTER_INPUT_INVALID', 'exportProfile.corridorOrientation is unsupported.', { value: corridorOrientation });
  return {
    schemaVersion: 1,
    levelId,
    seed: profile.seed,
    sizeClass: profile.sizeClass,
    corridorOrientation,
    floorName: requireString(profile.floorName, 'exportProfile.floorName'),
    subtitle: profile.subtitle === null || profile.subtitle === undefined ? null : requireString(profile.subtitle, 'exportProfile.subtitle'),
    objectiveDefault: profile.objectiveDefault === null || profile.objectiveDefault === undefined ? null : requireString(profile.objectiveDefault, 'exportProfile.objectiveDefault'),
    objectiveAfterEnergy: profile.objectiveAfterEnergy === null || profile.objectiveAfterEnergy === undefined ? null : requireString(profile.objectiveAfterEnergy, 'exportProfile.objectiveAfterEnergy'),
  };
}

function normalizeAdapterBindings(candidate) {
  const bindings = exactFields(candidate, ['schemaVersion', 'assets'], 'adapterBindings');
  assert(bindings.schemaVersion === 1 && Array.isArray(bindings.assets), 'NUMBERDROID_ADAPTER_SCHEMA_UNSUPPORTED', 'Unsupported adapter binding schema.');
  const result = bindings.assets.map((raw, index) => {
    const value = exactFields(raw, [
      'assetId', 'assetVersion', 'metadataVersion', 'kind', 'propId',
      'floorMaterialId', 'runtimePath', 'sourceArtPath',
    ], `adapterBindings.assets[${index}]`);
    const kind = requireString(value.kind, `adapterBindings.assets[${index}].kind`);
    assert(kind === 'floor-material' || kind === 'prop', 'NUMBERDROID_ADAPTER_BINDING_INVALID', 'Adapter asset binding kind must be floor-material or prop.', { index, kind });
    const propId = value.propId === null || value.propId === undefined ? null : requireSemanticId(value.propId, `adapterBindings.assets[${index}].propId`);
    const floorMaterialId = value.floorMaterialId === null || value.floorMaterialId === undefined ? null : requireSemanticId(value.floorMaterialId, `adapterBindings.assets[${index}].floorMaterialId`);
    assert(kind === 'prop' ? propId !== null && floorMaterialId === null : propId === null && floorMaterialId !== null, 'NUMBERDROID_ADAPTER_BINDING_INVALID', 'Binding semantic target does not match its kind.', { index, kind });
    return {
      assetId: requireSemanticId(value.assetId, `adapterBindings.assets[${index}].assetId`),
      assetVersion: requireInteger(value.assetVersion, `adapterBindings.assets[${index}].assetVersion`, { min: 1 }),
      metadataVersion: requireInteger(value.metadataVersion, `adapterBindings.assets[${index}].metadataVersion`, { min: 1 }),
      kind,
      propId,
      floorMaterialId,
      runtimePath: normalizeLogicalPath(value.runtimePath, `adapterBindings.assets[${index}].runtimePath`, 'public/'),
      sourceArtPath: normalizeLogicalPath(value.sourceArtPath, `adapterBindings.assets[${index}].sourceArtPath`, 'art-source/approved/'),
    };
  }).sort((left, right) => (
    left.assetId.localeCompare(right.assetId)
      || left.assetVersion - right.assetVersion
      || left.metadataVersion - right.metadataVersion
  ));
  const coordinates = new Set();
  const paths = new Map();
  for (const binding of result) {
    const coordinate = `${binding.assetId}@${binding.assetVersion}:${binding.metadataVersion}`;
    assert(!coordinates.has(coordinate), 'NUMBERDROID_ADAPTER_BINDING_DUPLICATE', 'An exact asset coordinate has multiple adapter bindings.', { coordinate });
    coordinates.add(coordinate);
    for (const path of [binding.runtimePath, binding.sourceArtPath]) {
      const folded = path.toLocaleLowerCase('en-US');
      assert(!paths.has(folded), 'NUMBERDROID_ADAPTER_PATH_COLLISION', 'Adapter target paths collide, including case-folded filesystems.', { path, conflictsWith: paths.get(folded) });
      paths.set(folded, path);
    }
  }
  return result;
}

function normalizeArtifactVerifications(candidate) {
  const verifications = exactFields(candidate, ['schemaVersion', 'verifierVersion', 'artifacts'], 'artifactVerifications');
  assert(verifications.schemaVersion === 1 && Array.isArray(verifications.artifacts), 'NUMBERDROID_ADAPTER_SCHEMA_UNSUPPORTED', 'Unsupported artifact-verification schema.');
  const artifacts = verifications.artifacts.map((raw, index) => {
    const value = exactFields(raw, ['digest', 'byteSize', 'mediaType', 'width', 'height'], `artifactVerifications.artifacts[${index}]`);
    const digest = requireString(value.digest, `artifactVerifications.artifacts[${index}].digest`);
    assert(HASH.test(digest), 'NUMBERDROID_ADAPTER_ARTIFACT_VERIFICATION_INVALID', 'Verified artifact digest must be lowercase SHA-256.', { digest });
    const mediaType = requireString(value.mediaType, `artifactVerifications.artifacts[${index}].mediaType`);
    assert(mediaType === 'image/png', 'NUMBERDROID_ADAPTER_ARTIFACT_VERIFICATION_INVALID', 'Checkpoint 5 verifies PNG artifacts only.', { digest, mediaType });
    return {
      digest,
      byteSize: requireInteger(value.byteSize, `artifactVerifications.artifacts[${index}].byteSize`, { min: 1 }),
      mediaType,
      width: requireInteger(value.width, `artifactVerifications.artifacts[${index}].width`, { min: 1 }),
      height: requireInteger(value.height, `artifactVerifications.artifacts[${index}].height`, { min: 1 }),
    };
  }).sort((left, right) => left.digest.localeCompare(right.digest));
  assert(new Set(artifacts.map((entry) => entry.digest)).size === artifacts.length, 'NUMBERDROID_ADAPTER_ARTIFACT_VERIFICATION_INVALID', 'Artifact verification contains duplicate digests.');
  return {
    schemaVersion: 1,
    verifierVersion: requireString(verifications.verifierVersion, 'artifactVerifications.verifierVersion'),
    artifacts,
  };
}

function assetCoordinate(value) {
  return `${value.assetId}@${value.assetVersion}:${value.metadataVersion}`;
}

function findHistoricalAsset(document, placement) {
  for (const revision of [...document.revisions].reverse()) {
    const asset = revision.snapshot.assetLibrary?.assets?.find((candidate) => (
      candidate.assetId === placement.assetId
        && candidate.assetVersion === placement.assetVersion
        && candidate.metadataVersion === placement.metadataVersion
    ));
    if (asset) return asset;
  }
  return null;
}

function findHistoricalSource(document, sourceId) {
  for (const revision of [...document.revisions].reverse()) {
    const source = revision.snapshot.sources?.find((candidate) => candidate.id === sourceId);
    if (source) return source;
  }
  return null;
}

export function createNumberdroidExportSnapshot({
  projectDocument,
  roomVariantId,
  roomVariantVersion,
  adapterBindings,
  artifactVerifications,
  exportProfile,
  adapterVersion = NUMBERDROID_ADAPTER_VERSION,
}) {
  assert(projectDocument?.revisions?.length > 0, 'NUMBERDROID_ADAPTER_PROJECT_INVALID', 'A trusted project document with revisions is required.');
  const requestedRoomId = requireSemanticId(roomVariantId, 'roomVariantId');
  const requestedRoomVersion = requireInteger(roomVariantVersion, 'roomVariantVersion', { min: 1 });
  const normalizedAdapterVersion = requireString(adapterVersion, 'adapterVersion');
  const head = projectDocument.revisions.at(-1);
  const library = head.snapshot.roomLibrary ?? { archetypes: [], variants: [] };
  const roomEntry = library.variants.find((candidate) => candidate.roomVariantId === requestedRoomId);
  const room = roomEntry?.versions?.find((candidate) => candidate.version === requestedRoomVersion);
  assert(room, 'NUMBERDROID_ADAPTER_ROOM_VERSION_NOT_FOUND', 'The exact room version does not exist.', { roomVariantId: requestedRoomId, roomVariantVersion: requestedRoomVersion });
  assert(room.lifecycle === 'FINAL', 'NUMBERDROID_ADAPTER_ROOM_NOT_FINAL', 'Only an exact FINAL room version may enter an export snapshot.', { lifecycle: room.lifecycle });
  const archetype = library.archetypes.find((candidate) => (
    candidate.roomArchetypeId === room.roomArchetypeId && candidate.version === room.archetypeVersion
  ));
  assert(archetype, 'NUMBERDROID_ADAPTER_ARCHETYPE_VERSION_NOT_FOUND', 'The room exact archetype version does not exist.', { roomArchetypeId: room.roomArchetypeId, archetypeVersion: room.archetypeVersion });

  const bindings = normalizeAdapterBindings(adapterBindings);
  const verified = normalizeArtifactVerifications(artifactVerifications);
  const verifiedByDigest = new Map(verified.artifacts.map((entry) => [entry.digest, entry]));
  const usedArtifactDigests = new Set();
  const bindingByCoordinate = new Map(bindings.map((binding) => [assetCoordinate(binding), binding]));
  const resolved = new Map();
  for (const placement of room.placements) {
    const coordinate = assetCoordinate(placement);
    if (resolved.has(coordinate)) continue;
    const asset = findHistoricalAsset(projectDocument, placement);
    assert(asset, 'NUMBERDROID_ADAPTER_ASSET_VERSION_NOT_FOUND', 'A room placement exact asset/metadata version cannot be resolved.', { coordinate, placementId: placement.placementId });
    assert(asset.lifecycle === 'FINAL', 'NUMBERDROID_ADAPTER_ASSET_NOT_FINAL', 'Every exported asset version must be FINAL.', { coordinate, lifecycle: asset.lifecycle });
    assert(asset.metadata?.runtimeEligible === true, 'NUMBERDROID_ADAPTER_ASSET_RUNTIME_INELIGIBLE', 'Every exported asset version must be explicitly runtime-eligible.', { coordinate, runtimeEligible: asset.metadata?.runtimeEligible });
    const binding = bindingByCoordinate.get(coordinate);
    assert(binding, 'NUMBERDROID_ADAPTER_BINDING_MISSING', 'Every referenced exact asset version requires an adapter binding.', { coordinate });
    assert(asset.kind === 'surface' ? binding.kind === 'floor-material' : binding.kind === 'prop', 'NUMBERDROID_ADAPTER_BINDING_KIND_MISMATCH', 'Studio asset and Numberdroid binding kinds disagree.', { coordinate, studioKind: asset.kind, bindingKind: binding.kind });
    const slice = asset.sliceBinding;
    assert(HASH.test(slice?.digest ?? '') && HASH.test(slice?.sourceDigest ?? ''), 'NUMBERDROID_ADAPTER_SLICE_INVALID', 'The exact asset slice has invalid content digests.', { coordinate });
    canonicalDigestFromUri(slice.artifactUri, slice.digest, `asset ${coordinate} slice artifact`);
    const verifiedSlice = verifiedByDigest.get(slice.digest);
    assert(verifiedSlice?.byteSize === slice.byteSize
      && verifiedSlice?.mediaType === slice.mediaType
      && verifiedSlice?.width === slice.width
      && verifiedSlice?.height === slice.height, 'NUMBERDROID_ADAPTER_ARTIFACT_NOT_VERIFIED', 'The exact slice artifact lacks a matching decoded byte/dimension integrity verification.', { coordinate, digest: slice.digest });
    usedArtifactDigests.add(slice.digest);
    const source = findHistoricalSource(projectDocument, slice.sourceId);
    assert(source, 'NUMBERDROID_ADAPTER_SOURCE_NOT_FOUND', 'The exact asset source cannot be resolved.', { coordinate, sourceId: slice.sourceId });
    assert(source.schemaVersion === 2 && source.lifecycle?.state === 'APPROVED_SOURCE' && source.review?.disposition === 'USER_APPROVED', 'NUMBERDROID_ADAPTER_SOURCE_NOT_APPROVED', 'Source art must be an explicitly approved V2 source.', { sourceId: source.id });
    assert(source.mediaType === 'image/png', 'NUMBERDROID_ADAPTER_SOURCE_MEDIA_UNSUPPORTED', 'Checkpoint 5 candidate sources must be PNG.', { sourceId: source.id, mediaType: source.mediaType });
    canonicalDigestFromUri(source.artifactUri, slice.sourceDigest, `source ${source.id} artifact`);
    const verifiedSource = verifiedByDigest.get(slice.sourceDigest);
    assert(verifiedSource?.byteSize === source.byteSize
      && verifiedSource?.mediaType === source.mediaType
      && verifiedSource?.width === source.width
      && verifiedSource?.height === source.height, 'NUMBERDROID_ADAPTER_ARTIFACT_NOT_VERIFIED', 'The approved source artifact lacks a matching decoded byte/dimension integrity verification.', { sourceId: source.id, digest: slice.sourceDigest });
    usedArtifactDigests.add(slice.sourceDigest);
    resolved.set(coordinate, {
      asset: exactAssetValue(asset),
      source: exactSourceValue(source),
      binding: structuredClone(binding),
    });
  }

  const usedBindings = [...resolved.values()].map((entry) => entry.binding);
  const unusedBindings = bindings.filter((binding) => !resolved.has(assetCoordinate(binding)));
  assert(unusedBindings.length === 0, 'NUMBERDROID_ADAPTER_BINDING_UNUSED', 'Adapter bindings must describe exactly the exported asset closure.', { coordinates: unusedBindings.map(assetCoordinate) });
  const unusedVerifications = verified.artifacts.filter((entry) => !usedArtifactDigests.has(entry.digest));
  assert(unusedVerifications.length === 0 && usedArtifactDigests.size === verified.artifacts.length, 'NUMBERDROID_ADAPTER_ARTIFACT_VERIFICATION_UNUSED', 'Artifact verification must describe exactly the exported CAS closure.', { digests: unusedVerifications.map((entry) => entry.digest) });
  const profile = normalizeExportProfile(exportProfile, archetype);
  const core = {
    schemaVersion: 1,
    kind: 'numberdroid.studio.export-snapshot',
    adapterVersion: normalizedAdapterVersion,
    project: {
      projectId: projectDocument.projectId,
      revision: head.number,
    },
    room: exactRoomValue(room),
    archetype: exactArchetypeValue(archetype),
    assets: [...resolved.values()]
      .sort((left, right) => assetCoordinate(left.asset).localeCompare(assetCoordinate(right.asset)))
      .map((entry) => ({ asset: entry.asset, source: entry.source, binding: entry.binding })),
    adapterBindings: { schemaVersion: 1, assets: usedBindings.sort((left, right) => assetCoordinate(left).localeCompare(assetCoordinate(right))) },
    artifactVerifications: verified,
    exportProfile: profile,
  };
  const snapshotId = candidateSha256(core);
  const snapshot = deepFreeze({ ...core, snapshotId });
  TRUSTED_EXPORT_SNAPSHOTS.add(snapshot);
  return snapshot;
}

function exactRange(value) {
  return { min: value, preferred: value, max: value };
}

function placementRole(asset) {
  const role = asset.metadata?.role;
  if (['hero', 'support', 'furniture', 'dressing'].includes(role)) return role;
  return asset.kind === 'prop' ? 'furniture' : 'dressing';
}

function levelSpecFor(snapshot) {
  const { room, archetype, exportProfile: profile } = snapshot;
  const spaceId = `space.${room.roomVariantId}`;
  const runtime = {
    floorName: profile.floorName,
    ...(profile.subtitle === null ? {} : { subtitle: profile.subtitle }),
    ...(profile.objectiveDefault === null ? {} : { objectiveDefault: profile.objectiveDefault }),
    ...(profile.objectiveAfterEnergy === null ? {} : { objectiveAfterEnergy: profile.objectiveAfterEnergy }),
  };
  const space = archetype.kind === 'hallway'
    ? {
      id: spaceId,
      kind: 'corridor',
      archetype: archetype.roomArchetypeId,
      tags: [...archetype.tags].sort(),
      width: exactRange(profile.corridorOrientation === 'vertical' ? room.width : room.height),
      length: exactRange(profile.corridorOrientation === 'vertical' ? room.height : room.width),
      orientation: profile.corridorOrientation,
    }
    : {
      id: spaceId,
      kind: 'room',
      archetype: archetype.roomArchetypeId,
      tags: [...archetype.tags].sort(),
      rationality: archetype.rationality,
      size: {
        class: profile.sizeClass,
        width: exactRange(room.width),
        height: exactRange(room.height),
      },
    };
  const assetByCoordinate = new Map(snapshot.assets.map((entry) => [assetCoordinate(entry.asset), entry]));
  const propPlacements = room.placements
    .filter((placement) => placement.layer === 'SET_DRESSING')
    .sort((left, right) => left.placementId.localeCompare(right.placementId));
  const props = propPlacements.map((placement) => {
    const entry = assetByCoordinate.get(assetCoordinate(placement));
    return {
      id: `prop-placement.${placement.placementId}`,
      propId: entry.binding.propId,
      spaceId,
      role: placementRole(entry.asset),
      quantity: 1,
      required: true,
    };
  });
  const overrides = [{
    targetId: spaceId,
    lockGeometry: true,
    lockedGeometry: {
      offsetFromRootTiles: { x: room.origin.x, y: room.origin.y },
      sizeTiles: { w: room.width, h: room.height },
    },
  }, ...propPlacements.map((placement) => ({
    targetId: `prop-placement.${placement.placementId}`,
    lockPlacement: true,
    lockedPlacement: {
      offsetTiles: { x: placement.anchor.x - room.origin.x, y: placement.anchor.y - room.origin.y },
      rotation: placement.rotation,
      wallSide: null,
    },
  }))];
  return {
    id: profile.levelId,
    version: 1,
    seed: profile.seed,
    ruleSetRefs: ['numberdroid.studio.room-candidate.v1'],
    rules: {
      ensureReachability: true,
      singleSharedWall: true,
      doorsEmbeddedInWalls: true,
      defaultCorridorWidth: exactRange(2),
      defaultDoorClearance: { before: 1, after: 1 },
    },
    runtime,
    spaces: [space],
    connections: [],
    props,
    encounters: [],
    stagedActors: [],
    routes: [],
    pickups: [],
    zones: [],
    triggers: [],
    events: [],
    overrides,
  };
}

export function sanitizeNumberdroidDiagnostic(value) {
  const raw = value instanceof Error ? value.message : String(value);
  const firstLine = raw.split(/\r?\n/, 1)[0].slice(0, 1000);
  // Once an absolute/UNC path starts, its end is not reliably distinguishable
  // from prose when path segments contain spaces. Redact the remainder of the
  // line instead of risking a machine-local suffix leak.
  return firstLine.replace(/(?:[a-zA-Z]:[\\/]|\\\\|\/).*$/, '<machine-path>');
}

function adapterFindings(snapshot) {
  const findings = [];
  if (snapshot.room.voidCells.length > 0 || snapshot.room.blockedCells.length > 0) {
    findings.push(stableFinding({
      severity: 'ERROR',
      ruleId: 'numberdroid.adapter.room_shape_unsupported',
      objectRef: `roomVariant:${snapshot.room.roomVariantId}@${snapshot.room.version}`,
      explanation: 'The canonical Level Spec can lock only rectangular space geometry and cannot preserve Studio VOID/BLOCKED masks.',
      remediation: 'Extend and approve the canonical Level Spec/compiler shape contract before approving this candidate; do not flatten the masks.',
    }));
  }
  const floorBindings = new Map();
  const floorCoordinates = new Set();
  for (const placement of snapshot.room.placements.filter((entry) => entry.layer === 'STRUCTURAL_SURFACE')) {
    const coordinate = assetCoordinate(placement);
    const entry = snapshot.assets.find((candidate) => assetCoordinate(candidate.asset) === coordinate);
    floorBindings.set(entry.binding.floorMaterialId, entry.binding);
    floorCoordinates.add(coordinate);
  }
  if (floorBindings.size !== 1) {
    findings.push(stableFinding({
      severity: 'ERROR',
      ruleId: 'numberdroid.adapter.floor_material_ambiguous',
      objectRef: `roomVariant:${snapshot.room.roomVariantId}@${snapshot.room.version}`,
      explanation: `The candidate uses ${floorBindings.size} structural floor-material bindings, while the current Level Spec runtime profile names one floor presentation.`,
      remediation: 'Choose one exact floor-material binding for this candidate or extend the reviewed tileset mapping contract.',
    }));
  }
  if (floorCoordinates.size > 1) {
    findings.push(stableFinding({
      severity: 'ERROR',
      ruleId: 'numberdroid.adapter.floor_material_multiple_bindings',
      objectRef: `roomVariant:${snapshot.room.roomVariantId}@${snapshot.room.version}`,
      explanation: `The room uses ${floorCoordinates.size} exact structural surface bindings; sharing one floorMaterialId does not make their bytes or placement semantics equivalent.`,
      remediation: 'Define a reviewed tileset/macro mapping that preserves every structural surface binding before candidate approval.',
    }));
  }
  if (floorCoordinates.size > 0) {
    findings.push(stableFinding({
      severity: 'ERROR',
      ruleId: 'numberdroid.adapter.floor_runtime_mapping_unsupported',
      objectRef: `roomVariant:${snapshot.room.roomVariantId}@${snapshot.room.version}`,
      explanation: 'The current Level Spec runtime contract has a floor label but no canonical floor-material art/tileset binding, so copied surface PNGs would be orphaned from compiled runtime output.',
      remediation: 'Add and review a canonical floor-material registry/emission contract before approving this candidate.',
    }));
  }
  if (snapshot.room.connectors.length > 0) {
    findings.push(stableFinding({
      severity: 'INFO',
      ruleId: 'numberdroid.adapter.connectors_retained_for_level_graph',
      objectRef: `roomVariant:${snapshot.room.roomVariantId}@${snapshot.room.version}`,
      explanation: 'Studio entrances are preserved in studio-room.json but are not converted into invented external Level Spec spaces.',
      remediation: 'Map these entrance descriptors when a finalized level graph supplies the external spaces.',
    }));
  }
  if (snapshot.archetype.kind === 'hallway' && snapshot.exportProfile.corridorOrientation === 'any') {
    findings.push(stableFinding({
      severity: 'ERROR',
      ruleId: 'numberdroid.adapter.hallway_orientation_ambiguous',
      objectRef: `roomVariant:${snapshot.room.roomVariantId}@${snapshot.room.version}`,
      explanation: 'A hallway export requires a deliberate horizontal or vertical orientation; the canonical geometry path must not guess from an any-orientation profile.',
      remediation: 'Choose horizontal or vertical in the explicit export profile and rebuild the snapshot.',
    }));
  }
  for (const entry of snapshot.assets) {
    if (entry.asset.kind === 'item') {
      findings.push(stableFinding({
        severity: 'ERROR',
        ruleId: 'numberdroid.adapter.item_mapping_unsupported',
        objectRef: `asset:${assetCoordinate(entry.asset)}`,
        explanation: 'Studio item semantics do not yet have a reviewed lossless Level Spec mapping.',
        remediation: 'Define and approve the Numberdroid item mapping before approving this candidate; do not disguise an item as a Prop.',
      }));
    }
    const span = entry.asset.metadata?.spanTiles;
    const expectedWidth = span?.width * 64;
    const expectedHeight = span?.height * 64;
    if (!span || entry.asset.sliceBinding.width !== expectedWidth || entry.asset.sliceBinding.height !== expectedHeight) {
      findings.push(stableFinding({
        severity: 'ERROR',
        ruleId: 'numberdroid.adapter.direct_copy_dimensions_mismatch',
        objectRef: `asset:${assetCoordinate(entry.asset)}`,
        explanation: `The direct-copy slice is ${entry.asset.sliceBinding.width}x${entry.asset.sliceBinding.height}px, but explicit Studio metadata requires ${expectedWidth || '?'}x${expectedHeight || '?'}px at Numberdroid's 64px tile size.`,
        remediation: 'Provide a reviewed deterministic materializer with versioned options, or bind an exact-size runtime artifact; never resize implicitly.',
      }));
    }
  }
  return findings;
}

function compilerFindings(snapshot, spec, canonicalCompiler) {
  const findings = [];
  if (snapshot.room.voidCells.length > 0 || snapshot.room.blockedCells.length > 0) {
    return { findings, planHash: null, status: 'SKIPPED_UNSUPPORTED_SHAPE' };
  }
  if (!canonicalCompiler
    || typeof canonicalCompiler.compileLevelSpec !== 'function'
    || typeof canonicalCompiler.compileWorkbenchPlan !== 'function'
    || typeof canonicalCompiler.validatePlacementOverrides !== 'function'
    || !canonicalCompiler.propRegistry
    || !canonicalCompiler.propArtRegistry) {
    findings.push(stableFinding({
      severity: 'ERROR',
      ruleId: 'numberdroid.compiler.not_invoked',
      objectRef: `levelSpec:${spec.id}`,
      explanation: 'The candidate was not checked by the canonical Numberdroid compiler and registries.',
      remediation: 'Run candidate creation through the canonical compiler bridge before approval.',
      validatorVersion: canonicalCompiler?.compilerVersion ?? 'numberdroid-level-compiler.unavailable',
    }));
    return { findings, planHash: null, status: 'NOT_RUN' };
  }
  try {
    canonicalCompiler.validatePlacementOverrides(spec);
    const plan = canonicalCompiler.compileLevelSpec(spec, canonicalCompiler.propRegistry);
    const workbenchPlan = canonicalCompiler.compileWorkbenchPlan(spec, canonicalCompiler.propRegistry, spec.overrides ?? []);
    const geometry = workbenchPlan?.actors?.props?.navigation?.geometry;
    const compiledPlacements = workbenchPlan?.actors?.props?.placements;
    assert(geometry && Array.isArray(compiledPlacements), 'NUMBERDROID_ADAPTER_COMPILER_PLAN_INVALID', 'Canonical Workbench compiler returned an incomplete placement plan.');
    const entryByCoordinate = new Map(snapshot.assets.map((entry) => [assetCoordinate(entry.asset), entry]));
    for (const placement of snapshot.room.placements.filter((entry) => entry.layer === 'SET_DRESSING')) {
      const requestId = `prop-placement.${placement.placementId}`;
      const compiled = plan.props.find((request) => request.id === requestId);
      const entry = entryByCoordinate.get(assetCoordinate(placement));
      const registration = canonicalCompiler.propArtRegistry[entry.binding.propId];
      if (!registration) {
        findings.push(stableFinding({
          severity: 'ERROR',
          ruleId: 'numberdroid.adapter.prop_art_unregistered',
          objectRef: `roomPlacement:${placement.placementId}`,
          explanation: `Prop ${entry.binding.propId} has no canonical Prop Art Registry entry.`,
          remediation: 'Add and review the presentation-only Prop Art Registry binding before approving this candidate.',
          validatorVersion: canonicalCompiler.compilerVersion,
        }));
      } else if (`public/${registration.asset}` !== entry.binding.runtimePath) {
        findings.push(stableFinding({
          severity: 'ERROR',
          ruleId: 'numberdroid.adapter.prop_art_path_mismatch',
          objectRef: `roomPlacement:${placement.placementId}`,
          explanation: `Runtime target ${entry.binding.runtimePath} differs from canonical art registration public/${registration.asset}.`,
          remediation: 'Correct the exact-version adapter binding or deliberately review the canonical Prop Art Registry change.',
          validatorVersion: canonicalCompiler.compilerVersion,
        }));
      }
      if (registration?.status !== 'accepted') {
        findings.push(stableFinding({
          severity: 'ERROR',
          ruleId: 'numberdroid.adapter.prop_art_not_accepted',
          objectRef: `roomPlacement:${placement.placementId}`,
          explanation: `Canonical Prop art ${entry.binding.propId} is ${registration?.status ?? 'unregistered'}, not accepted.`,
          remediation: 'Complete the separate art review or bind an accepted canonical Prop presentation.',
          validatorVersion: canonicalCompiler.compilerVersion,
        }));
      }
      if (registration?.shadowAsset) {
        findings.push(stableFinding({
          severity: 'ERROR',
          ruleId: 'numberdroid.adapter.prop_shadow_mapping_unsupported',
          objectRef: `roomPlacement:${placement.placementId}`,
          explanation: `Canonical Prop ${entry.binding.propId} requires shadow asset ${registration.shadowAsset}, but the current snapshot binding closes over only the primary runtime art.`,
          remediation: 'Extend the exact-version adapter binding and manifest closure to preserve the canonical shadow dependency.',
          validatorVersion: canonicalCompiler.compilerVersion,
        }));
      }
      const studioSpan = entry.asset.metadata.spanTiles;
      const registrySpan = compiled?.metadata?.footprintTiles;
      if (!registrySpan || studioSpan.width !== registrySpan.w || studioSpan.height !== registrySpan.h) {
        findings.push(stableFinding({
          severity: 'ERROR',
          ruleId: 'numberdroid.adapter.prop_footprint_mismatch',
          objectRef: `roomPlacement:${placement.placementId}`,
          explanation: `Studio span ${studioSpan.width}x${studioSpan.height} differs from the canonical Prop Registry footprint ${registrySpan?.w ?? '?'}x${registrySpan?.h ?? '?'}.`,
          remediation: 'Align explicit Studio metadata and the canonical Prop Registry contract; do not infer dimensions from pixels.',
          validatorVersion: canonicalCompiler.compilerVersion,
        }));
      }
      if (!compiled?.metadata?.allowedRotations?.includes(placement.rotation)) {
        findings.push(stableFinding({
          severity: 'ERROR',
          ruleId: 'numberdroid.adapter.prop_rotation_unsupported',
          objectRef: `roomPlacement:${placement.placementId}`,
          explanation: `Studio rotation ${placement.rotation} is not allowed by canonical Prop ${entry.binding.propId}.`,
          remediation: 'Choose an allowed authored rotation or review the Prop Registry orientation contract.',
          validatorVersion: canonicalCompiler.compilerVersion,
        }));
      }
      if (compiled?.metadata?.exactFit || Object.keys(compiled?.metadata?.placement ?? {}).length > 0) {
        findings.push(stableFinding({
          severity: 'ERROR',
          ruleId: 'numberdroid.adapter.prop_exact_contract_unmapped',
          objectRef: `roomPlacement:${placement.placementId}`,
          explanation: 'The canonical Prop carries exact-fit or placement constraints that are not yet fingerprint-pinned by the Studio adapter binding.',
          remediation: 'Add reviewed registry/art fingerprints and lossless exact-fit, attachment, collision, and placement-constraint mapping before candidate approval.',
          validatorVersion: canonicalCompiler.compilerVersion,
        }));
      }
      const compiledPlacement = compiledPlacements.find((candidate) => candidate.requestId === requestId);
      const compiledSpace = geometry.spaces.find((candidate) => candidate.id === compiled?.spaceId);
      const expectedX = compiledSpace?.rect?.x + placement.anchor.x - snapshot.room.origin.x;
      const expectedY = compiledSpace?.rect?.y + placement.anchor.y - snapshot.room.origin.y;
      if (!compiledPlacement
        || compiledPlacement.rect.x !== expectedX
        || compiledPlacement.rect.y !== expectedY
        || compiledPlacement.rotation !== placement.rotation) {
        findings.push(stableFinding({
          severity: 'ERROR',
          ruleId: 'numberdroid.adapter.locked_placement_mismatch',
          objectRef: `roomPlacement:${placement.placementId}`,
          explanation: 'The full canonical Workbench compiler did not preserve the exact Studio prop offset and rotation.',
          remediation: 'Correct the locked-placement mapping or the conflicting geometry/navigation rule before candidate approval.',
          validatorVersion: canonicalCompiler.compilerVersion,
        }));
      }
    }
    for (const diagnostic of plan.diagnostics ?? []) {
      findings.push(stableFinding({
        severity: diagnostic.level === 'warning' ? 'WARNING' : 'INFO',
        ruleId: `numberdroid.compiler.${diagnostic.code.toLocaleLowerCase('en-US')}`,
        objectRef: diagnostic.targetId ? `semantic:${diagnostic.targetId}` : `levelSpec:${spec.id}`,
        explanation: sanitizeNumberdroidDiagnostic(diagnostic.message),
        remediation: 'Review the canonical compiler diagnostic before candidate approval.',
        validatorVersion: canonicalCompiler.compilerVersion,
      }));
    }
    return { findings, planHash: candidateSha256(workbenchPlan), status: 'SUCCEEDED' };
  } catch (error) {
    findings.push(stableFinding({
      severity: 'ERROR',
      ruleId: 'numberdroid.compiler.validation_failed',
      objectRef: `levelSpec:${spec.id}`,
      explanation: sanitizeNumberdroidDiagnostic(error),
      remediation: 'Correct the named Level Spec, binding, registry, or placement-override contract and rebuild the candidate.',
      validatorVersion: canonicalCompiler.compilerVersion,
    }));
    return { findings, planHash: null, status: 'FAILED' };
  }
}

function textFile(logicalPath, value) {
  const content = canonicalCandidateJson(value);
  return {
    logicalPath,
    mediaType: 'application/json',
    byteSize: Buffer.byteLength(content),
    sha256: candidateSha256(content),
    content,
  };
}

export function buildNumberdroidCandidate(snapshot, canonicalCompiler = null) {
  assert(TRUSTED_EXPORT_SNAPSHOTS.has(snapshot), 'NUMBERDROID_ADAPTER_SNAPSHOT_UNTRUSTED', 'Candidate creation requires the exact in-process immutable snapshot returned by createNumberdroidExportSnapshot; serialized or caller-constructed snapshots are not provenance authority.');
  assert(snapshot?.kind === 'numberdroid.studio.export-snapshot' && snapshot.snapshotId === candidateSha256((({ snapshotId: _ignored, ...rest }) => rest)(snapshot)), 'NUMBERDROID_ADAPTER_SNAPSHOT_TAMPERED', 'Export snapshot content does not match its immutable snapshot ID.');
  const spec = levelSpecFor(snapshot);
  const adapter = adapterFindings(snapshot);
  const compiler = compilerFindings(snapshot, spec, canonicalCompiler);
  const findings = sortFindings([...adapter, ...compiler.findings]);
  const base = `art-source/approved/studio-exports/${snapshot.exportProfile.levelId}/${snapshot.snapshotId}`;
  const textFiles = [
    textFile(`src/levelgen/specs/studio-candidates/${snapshot.exportProfile.levelId}.json`, spec),
    textFile(`${base}/studio-room.json`, snapshot.room),
    textFile(`${base}/provenance.json`, {
      schemaVersion: 1,
      snapshotId: snapshot.snapshotId,
      project: snapshot.project,
      room: { roomVariantId: snapshot.room.roomVariantId, version: snapshot.room.version, contentFingerprint: snapshot.room.contentFingerprint },
      archetype: { roomArchetypeId: snapshot.archetype.roomArchetypeId, version: snapshot.archetype.version },
      assets: snapshot.assets,
    }),
  ].sort((left, right) => left.logicalPath.localeCompare(right.logicalPath));
  const artifacts = snapshot.assets.flatMap((entry) => ([
    {
      logicalPath: entry.binding.runtimePath,
      role: 'runtime',
      mediaType: entry.asset.sliceBinding.mediaType,
      byteSize: entry.asset.sliceBinding.byteSize,
      sha256: entry.asset.sliceBinding.digest,
      sourceArtifactUri: entry.asset.sliceBinding.artifactUri,
      provenanceRef: assetCoordinate(entry.asset),
    },
    {
      logicalPath: entry.binding.sourceArtPath,
      role: 'source-art',
      mediaType: entry.source.mediaType,
      byteSize: entry.source.byteSize,
      sha256: entry.asset.sliceBinding.sourceDigest,
      sourceArtifactUri: entry.source.artifactUri,
      provenanceRef: entry.source.sourceId,
    },
  ])).sort((left, right) => left.logicalPath.localeCompare(right.logicalPath));
  const allPaths = [...textFiles.map((file) => file.logicalPath), ...artifacts.map((file) => file.logicalPath)];
  const foldedPaths = new Set(allPaths.map((path) => path.toLocaleLowerCase('en-US')));
  assert(foldedPaths.size === allPaths.length, 'NUMBERDROID_ADAPTER_PATH_COLLISION', 'Generated candidate paths collide with adapter artifact targets.');
  const blocked = findings.some((finding) => finding.severity === 'ERROR');
  const manifest = {
    schemaVersion: 1,
    kind: 'numberdroid.studio.export-candidate-manifest',
    snapshotId: snapshot.snapshotId,
    adapterVersion: snapshot.adapterVersion,
    levelId: snapshot.exportProfile.levelId,
    status: blocked ? 'BLOCKED' : 'VERIFIED',
    stages: {
      candidate: blocked ? 'BLOCKED' : 'VERIFIED',
      materialize: 'NOT_AUTHORIZED',
      commit: 'NOT_AUTHORIZED',
      publish: 'NOT_AUTHORIZED',
    },
    compiler: {
      version: canonicalCompiler?.compilerVersion ?? 'numberdroid-level-compiler.unavailable',
      status: compiler.status,
      planHash: compiler.planHash,
    },
    files: [
      ...textFiles.map(({ content: _content, ...file }) => ({ ...file, role: 'candidate-text' })),
      ...artifacts,
    ].sort((left, right) => left.logicalPath.localeCompare(right.logicalPath)),
    findings,
  };
  const manifestJson = canonicalCandidateJson(manifest);
  const manifestHash = candidateSha256(manifestJson);
  return deepFreeze({
    schemaVersion: 1,
    kind: 'numberdroid.studio.export-candidate',
    snapshotId: snapshot.snapshotId,
    candidateHash: manifestHash,
    status: manifest.status,
    levelSpec: spec,
    textFiles,
    artifacts,
    findings,
    manifest,
    manifestJson,
    manifestHash,
  });
}
