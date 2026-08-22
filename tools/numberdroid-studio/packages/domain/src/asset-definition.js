import { createHash } from 'node:crypto';
import { invariant } from './errors.js';
import { requireEnum, requireId, requireInteger, requireRecord, requireString } from './validation.js';

export const ASSET_VALIDATOR_VERSION = 'numberdroid-studio.asset-validator.v1';
export const MAX_ASSET_PROPOSAL_ITEMS = 64;
export const ASSET_KINDS = Object.freeze(['surface', 'prop', 'item']);
export const ASSET_LIFECYCLES = Object.freeze(['DRAFT', 'METADATA_COMPLETE', 'VALIDATED', 'FINAL']);

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const ARTIFACT_URI_PATTERN = /^studio:\/\/artifacts\/sha256\/(?:[a-f0-9]{2}\/)*([a-f0-9]{64})$/;
const EXTENSION_NAMESPACE_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/;
const SECRET_KEY_PATTERN = /(?:secret|token|password|credential|authority|grant|host.?binding|idempotency|lease|private.?key|access.?key)/i;
const PATH_KEY_PATTERN = /(?:^|_)(?:path|directory|filename|filepath)(?:$|_)/i;
const URI_KEY_PATTERN = /(?:^|_)(?:uri|url|href|callback|endpoint)(?:$|_)/i;
const MACHINE_PATH_PATTERN = /^(?:\/|\\|[A-Za-z]:[\\/])|(?:^|[\\/])\.\.(?:[\\/]|$)/;
const URI_VALUE_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//;
const METADATA_FIELDS = Object.freeze([
  'role', 'tags', 'variantGroup', 'compatibilityGroups', 'spanTiles', 'anchor',
  'attachment', 'rotationPolicy', 'placement', 'collision', 'navigation',
  'runtimeEligible', 'connectors', 'continuityProfile', 'continuityTags',
  'selectionPriority', 'visualWeight', 'extensions',
]);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(canonicalize(value));
}

function stableHash(value) {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function exactFields(value, allowed, label) {
  const record = requireRecord(value, label);
  for (const field of Object.keys(record)) {
    invariant(allowed.includes(field), 'VALIDATION_ERROR', `${label}.${field} is not permitted.`, {
      field: `${label}.${field}`,
    });
  }
  return record;
}

function nullableString(value, label, { max = 128 } = {}) {
  return value === null || value === undefined ? null : requireString(value, label, { max });
}

function nullableBoolean(value, label) {
  invariant(value === null || value === undefined || typeof value === 'boolean', 'VALIDATION_ERROR', `${label} must be boolean or null.`, { field: label });
  return value ?? null;
}

function finiteNumber(value, label, { min, max }) {
  invariant(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max, 'VALIDATION_ERROR', `${label} must be a finite number from ${min} to ${max}.`, { field: label, min, max });
  return value;
}

function boundedStrings(value, label, { maxItems = 32, maxLength = 64 } = {}) {
  invariant(Array.isArray(value) && value.length <= maxItems, 'VALIDATION_ERROR', `${label} must contain at most ${maxItems} values.`, { field: label, maxItems });
  const seen = new Set();
  return value.map((candidate, index) => {
    const normalized = requireString(candidate, `${label}[${index}]`, { max: maxLength });
    invariant(!seen.has(normalized), 'VALIDATION_ERROR', `${label} must not contain duplicates.`, { field: label, value: normalized });
    seen.add(normalized);
    return normalized;
  });
}

function normalizeSpan(value, label = 'metadata.spanTiles') {
  if (value === null || value === undefined) return null;
  const record = exactFields(value, ['width', 'height'], label);
  return {
    width: requireInteger(record.width, `${label}.width`, { min: 1, max: 64 }),
    height: requireInteger(record.height, `${label}.height`, { min: 1, max: 64 }),
  };
}

function normalizeAnchor(value, spanTiles) {
  if (value === null || value === undefined) return null;
  const record = exactFields(value, ['x', 'y'], 'metadata.anchor');
  const anchor = {
    x: requireInteger(record.x, 'metadata.anchor.x', { min: 0, max: 63 }),
    y: requireInteger(record.y, 'metadata.anchor.y', { min: 0, max: 63 }),
  };
  if (spanTiles) {
    invariant(anchor.x < spanTiles.width && anchor.y < spanTiles.height, 'ASSET_ANCHOR_OUT_OF_BOUNDS', 'The anchor must lie inside spanTiles.', { anchor, spanTiles });
  }
  return anchor;
}

function normalizePlacement(value) {
  const record = exactFields(value ?? {}, ['modes', 'wallSafe', 'tags', 'confirmation'], 'metadata.placement');
  const modes = boundedStrings(record.modes ?? [], 'metadata.placement.modes', { maxItems: 8, maxLength: 32 });
  for (const mode of modes) requireEnum(mode, 'metadata.placement.modes[]', ['manual', 'automatic', 'perimeter', 'threshold', 'overlay']);
  return {
    modes,
    wallSafe: nullableBoolean(record.wallSafe, 'metadata.placement.wallSafe'),
    tags: boundedStrings(record.tags ?? [], 'metadata.placement.tags', { maxItems: 32, maxLength: 64 }),
    confirmation: requireEnum(record.confirmation ?? 'missing', 'metadata.placement.confirmation', ['missing', 'proposed', 'confirmed']),
  };
}

function normalizeRect(value, label, { max = 64 } = {}) {
  const record = exactFields(value, ['x', 'y', 'width', 'height'], label);
  return {
    x: finiteNumber(record.x, `${label}.x`, { min: 0, max }),
    y: finiteNumber(record.y, `${label}.y`, { min: 0, max }),
    width: finiteNumber(record.width, `${label}.width`, { min: Number.EPSILON, max }),
    height: finiteNumber(record.height, `${label}.height`, { min: Number.EPSILON, max }),
  };
}

function normalizeCollision(value) {
  if (value === null || value === undefined) return null;
  const record = exactFields(value, ['mode', 'bounds', 'parts'], 'metadata.collision');
  const mode = requireEnum(record.mode, 'metadata.collision.mode', ['none', 'bounds', 'parts']);
  const bounds = record.bounds === null || record.bounds === undefined
    ? null
    : normalizeRect(record.bounds, 'metadata.collision.bounds');
  invariant(Array.isArray(record.parts) && record.parts.length <= 16, 'VALIDATION_ERROR', 'metadata.collision.parts must contain at most 16 rectangles.', { field: 'metadata.collision.parts' });
  const parts = record.parts.map((part, index) => normalizeRect(part, `metadata.collision.parts[${index}]`));
  invariant(mode !== 'none' || (bounds === null && parts.length === 0), 'VALIDATION_ERROR', 'Collision mode none cannot carry geometry.', { field: 'metadata.collision' });
  invariant(mode !== 'bounds' || (bounds !== null && parts.length === 0), 'VALIDATION_ERROR', 'Collision mode bounds requires exactly one bounds rectangle.', { field: 'metadata.collision' });
  invariant(mode !== 'parts' || (bounds === null && parts.length > 0), 'VALIDATION_ERROR', 'Collision mode parts requires one or more parts.', { field: 'metadata.collision' });
  return { mode, bounds, parts };
}

function normalizeNavigation(value) {
  if (value === null || value === undefined) return null;
  const record = exactFields(value, ['effect', 'cost'], 'metadata.navigation');
  const effect = requireEnum(record.effect, 'metadata.navigation.effect', ['passable', 'blocked', 'cost']);
  const cost = record.cost === null || record.cost === undefined
    ? null
    : finiteNumber(record.cost, 'metadata.navigation.cost', { min: 1, max: 100 });
  invariant(effect === 'cost' ? cost !== null : cost === null, 'VALIDATION_ERROR', 'Navigation cost is required only for cost navigation.', { field: 'metadata.navigation.cost' });
  return { effect, cost };
}

function normalizeConnectors(value) {
  invariant(Array.isArray(value) && value.length <= 4, 'VALIDATION_ERROR', 'metadata.connectors must contain at most four entries.', { field: 'metadata.connectors' });
  const edges = new Set();
  return value.map((candidate, index) => {
    const record = exactFields(candidate, ['edge', 'offset'], `metadata.connectors[${index}]`);
    const edge = requireEnum(record.edge, `metadata.connectors[${index}].edge`, ['north', 'east', 'south', 'west']);
    invariant(!edges.has(edge), 'ASSET_CONNECTOR_DUPLICATE', 'A cardinal connector edge may appear only once.', { edge });
    edges.add(edge);
    return {
      edge,
      offset: finiteNumber(record.offset, `metadata.connectors[${index}].offset`, { min: 0, max: 1 }),
    };
  });
}

function normalizeExtensionValue(value, path, state, depth) {
  invariant(depth <= 5, 'ASSET_EXTENSION_INVALID', 'Asset extension nesting exceeds five levels.', { path });
  state.nodes += 1;
  invariant(state.nodes <= 256, 'ASSET_EXTENSION_INVALID', 'Asset extensions exceed 256 total values.', { path });
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    invariant(Number.isFinite(value), 'ASSET_EXTENSION_INVALID', 'Asset extension numbers must be finite.', { path });
    return value;
  }
  if (typeof value === 'string') {
    invariant(value.length <= 1024, 'ASSET_EXTENSION_INVALID', 'Asset extension strings may contain at most 1,024 characters.', { path });
    invariant(!MACHINE_PATH_PATTERN.test(value), 'ASSET_EXTENSION_INVALID', 'Machine paths and traversal are not permitted in extensions.', { path });
    invariant(!URI_VALUE_PATTERN.test(value), 'ASSET_EXTENSION_INVALID', 'URI-shaped values are not permitted in extensions.', { path });
    return value;
  }
  if (Array.isArray(value)) {
    invariant(value.length <= 64, 'ASSET_EXTENSION_INVALID', 'Asset extension arrays may contain at most 64 entries.', { path });
    return value.map((candidate, index) => normalizeExtensionValue(candidate, `${path}/${index}`, state, depth + 1));
  }
  invariant(value && typeof value === 'object', 'ASSET_EXTENSION_INVALID', 'Unsupported asset extension value.', { path });
  const keys = Object.keys(value);
  invariant(keys.length <= 64, 'ASSET_EXTENSION_INVALID', 'Asset extension objects may contain at most 64 keys.', { path });
  return Object.fromEntries(keys.sort().map((key) => {
    invariant(key.length > 0 && key.length <= 64, 'ASSET_EXTENSION_INVALID', 'Asset extension keys must contain 1 to 64 characters.', { path });
    invariant(!SECRET_KEY_PATTERN.test(key), 'ASSET_EXTENSION_INVALID', 'Secret or authority fields are not permitted in extensions.', { path: `${path}/${key}` });
    invariant(!PATH_KEY_PATTERN.test(key) && !/path$/i.test(key), 'ASSET_EXTENSION_INVALID', 'Machine path fields are not permitted in extensions.', { path: `${path}/${key}` });
    invariant(!URI_KEY_PATTERN.test(key) && !/(?:uri|url)$/i.test(key), 'ASSET_EXTENSION_INVALID', 'URI fields are not permitted in extensions.', { path: `${path}/${key}` });
    return [key, normalizeExtensionValue(value[key], `${path}/${key}`, state, depth + 1)];
  }));
}

function normalizeExtensions(value) {
  const record = requireRecord(value ?? {}, 'metadata.extensions');
  const keys = Object.keys(record);
  invariant(keys.length <= 32, 'ASSET_EXTENSION_INVALID', 'At most 32 extension namespaces are permitted.');
  const state = { nodes: 0 };
  return Object.fromEntries(keys.sort().map((namespace) => {
    invariant(EXTENSION_NAMESPACE_PATTERN.test(namespace), 'ASSET_EXTENSION_INVALID', 'Extension keys must be lowercase dotted namespaces.', { namespace });
    invariant(!SECRET_KEY_PATTERN.test(namespace), 'ASSET_EXTENSION_INVALID', 'Secret or authority namespaces are not permitted.', { namespace });
    return [namespace, normalizeExtensionValue(record[namespace], `/extensions/${namespace}`, state, 1)];
  }));
}

function normalizeMetadata(metadata, kind) {
  requireEnum(kind, 'kind', ASSET_KINDS);
  const record = exactFields(metadata, METADATA_FIELDS, 'metadata');
  const spanTiles = normalizeSpan(record.spanTiles);
  const normalized = {
    role: nullableString(record.role, 'metadata.role', { max: 64 }),
    tags: boundedStrings(record.tags ?? [], 'metadata.tags'),
    variantGroup: nullableString(record.variantGroup, 'metadata.variantGroup'),
    compatibilityGroups: boundedStrings(record.compatibilityGroups ?? [], 'metadata.compatibilityGroups', { maxItems: 16, maxLength: 128 }),
    spanTiles,
    anchor: normalizeAnchor(record.anchor, spanTiles),
    attachment: record.attachment === null || record.attachment === undefined
      ? null
      : requireEnum(record.attachment, 'metadata.attachment', ['ground', 'wall', 'ceiling', 'free']),
    rotationPolicy: record.rotationPolicy === null || record.rotationPolicy === undefined
      ? null
      : requireEnum(record.rotationPolicy, 'metadata.rotationPolicy', ['fixed', 'cardinal']),
    placement: normalizePlacement(record.placement),
    collision: normalizeCollision(record.collision),
    navigation: normalizeNavigation(record.navigation),
    runtimeEligible: nullableBoolean(record.runtimeEligible, 'metadata.runtimeEligible'),
    connectors: normalizeConnectors(record.connectors ?? []),
    continuityProfile: nullableString(record.continuityProfile, 'metadata.continuityProfile'),
    continuityTags: boundedStrings(record.continuityTags ?? [], 'metadata.continuityTags'),
    selectionPriority: requireInteger(record.selectionPriority ?? 0, 'metadata.selectionPriority', { min: -1000, max: 1000 }),
    visualWeight: record.visualWeight === null || record.visualWeight === undefined
      ? null
      : requireEnum(record.visualWeight, 'metadata.visualWeight', ['light', 'medium', 'heavy']),
    extensions: normalizeExtensions(record.extensions),
  };
  if (kind === 'surface' && normalized.attachment !== null) {
    invariant(normalized.attachment === 'ground', 'VALIDATION_ERROR', 'Surface assets must attach to ground.', { field: 'metadata.attachment' });
  }
  return normalized;
}

function finding({ severity = 'ERROR', ruleId, targetKind = 'asset', targetId, path, explanation, remediation }) {
  return Object.freeze({
    findingId: stableHash({ validatorVersion: ASSET_VALIDATOR_VERSION, ruleId, targetKind, targetId, path }),
    severity,
    ruleId,
    targetKind,
    targetId,
    path,
    explanation,
    remediation,
    validatorVersion: ASSET_VALIDATOR_VERSION,
  });
}

function metadataFindings(metadata, kind, assetId) {
  const findings = [];
  const add = (ruleId, path, explanation, remediation, severity = 'ERROR') => findings.push(finding({ severity, ruleId, targetId: assetId, path, explanation, remediation }));
  if (metadata.collision === null) add('studio.asset.collision.required', '/collision', 'Collision behavior has not been authored.', 'Choose none, bounds, or bounded collision parts.');
  if (metadata.navigation === null) add('studio.asset.navigation.required', '/navigation', 'Navigation behavior has not been authored.', 'Choose passable, blocked, or a bounded navigation cost.');
  if (metadata.placement.confirmation === 'missing') add('studio.asset.placement.confirmation_required', '/placement/confirmation', 'Placement semantics are not confirmed or proposed.', 'Record an explicit proposed or confirmed placement disposition.');
  if (metadata.role === null) add('studio.asset.role.required', '/role', 'The semantic role is missing.', 'Author a category-specific role.');
  if (metadata.runtimeEligible === null) add('studio.asset.runtime_eligibility.required', '/runtimeEligible', 'Runtime eligibility has not been decided.', 'Explicitly choose true or false; do not infer from pixels.');
  if (metadata.spanTiles === null) add('studio.asset.span.required', '/spanTiles', 'The tile span is missing.', 'Author a positive integer tile footprint.');
  if (metadata.visualWeight === null) add('studio.asset.visual_weight.required', '/visualWeight', 'Visual weight has not been authored.', 'Choose light, medium, or heavy.');
  if (metadata.placement.wallSafe === null) add('studio.asset.wall_safety.required', '/placement/wallSafe', 'Boundary suitability has not been authored.', 'Explicitly choose whether this asset is wall-safe.');
  if (metadata.connectors.length > 0 && metadata.continuityProfile === null) add('studio.asset.connectors.profile_required', '/continuityProfile', 'Connectors require a continuity profile.', 'Author a bounded continuity family for connector compatibility.');
  if (metadata.collision && metadata.spanTiles) {
    const rectangles = metadata.collision.mode === 'bounds'
      ? [['/collision/bounds', metadata.collision.bounds]]
      : metadata.collision.parts.map((part, index) => [`/collision/parts/${index}`, part]);
    for (const [path, rectangle] of rectangles) {
      if (rectangle.x + rectangle.width > metadata.spanTiles.width || rectangle.y + rectangle.height > metadata.spanTiles.height) {
        add('studio.asset.collision.out_of_bounds', path, 'Collision geometry exceeds the authored tile span.', 'Contain every collision rectangle within spanTiles.');
      }
    }
  }
  if (kind !== 'surface' && metadata.connectors.length > 0) {
    add('studio.asset.connectors.kind_unusual', '/connectors', 'Connectors on a nonsurface asset require explicit review.', 'Confirm the adapter contract before runtime use.', 'WARNING');
  }
  return findings.sort((left, right) => left.ruleId.localeCompare(right.ruleId) || left.path.localeCompare(right.path));
}

export function validateExactSliceBinding(candidate) {
  const record = exactFields(candidate, [
    'projectId', 'sliceId', 'sliceVersion', 'atlasId', 'sourceId', 'sourceDigest',
    'definitionVersion', 'definitionFingerprint', 'rectangleId', 'rectangle',
    'processorId', 'digest', 'artifactUri', 'mediaType', 'byteSize', 'width',
    'height', 'priorDigest', 'committedRevision',
  ], 'sliceBinding');
  const rectangle = exactFields(record.rectangle, [
    'x', 'y', 'width', 'height', 'included', 'pivot', 'transparentPaddingPolicy',
    'replacesSliceId', 'expectedSliceVersion',
  ], 'sliceBinding.rectangle');
  const width = requireInteger(record.width, 'sliceBinding.width', { min: 1, max: 65535 });
  const height = requireInteger(record.height, 'sliceBinding.height', { min: 1, max: 65535 });
  const digest = requireString(record.digest, 'sliceBinding.digest', { min: 64, max: 64 });
  invariant(HASH_PATTERN.test(digest), 'ASSET_SLICE_BINDING_INVALID', 'Slice digest must be lowercase SHA-256.', { field: 'sliceBinding.digest' });
  const artifactUri = requireString(record.artifactUri, 'sliceBinding.artifactUri', { max: 2048 });
  const uriMatch = ARTIFACT_URI_PATTERN.exec(artifactUri);
  invariant(uriMatch?.[1] === digest, 'ASSET_SLICE_BINDING_INVALID', 'Artifact URI must be a digest-derived Studio CAS URI.', { field: 'sliceBinding.artifactUri' });
  const normalizedRectangle = {
    x: requireInteger(rectangle.x, 'sliceBinding.rectangle.x', { min: 0 }),
    y: requireInteger(rectangle.y, 'sliceBinding.rectangle.y', { min: 0 }),
    width: requireInteger(rectangle.width, 'sliceBinding.rectangle.width', { min: 1 }),
    height: requireInteger(rectangle.height, 'sliceBinding.rectangle.height', { min: 1 }),
    included: rectangle.included,
    pivot: rectangle.pivot === null ? null : (() => {
      const pivot = exactFields(rectangle.pivot, ['x', 'y'], 'sliceBinding.rectangle.pivot');
      return {
        x: requireInteger(pivot.x, 'sliceBinding.rectangle.pivot.x', { min: 0, max: width - 1 }),
        y: requireInteger(pivot.y, 'sliceBinding.rectangle.pivot.y', { min: 0, max: height - 1 }),
      };
    })(),
    transparentPaddingPolicy: requireString(rectangle.transparentPaddingPolicy, 'sliceBinding.rectangle.transparentPaddingPolicy', { max: 64 }),
    replacesSliceId: rectangle.replacesSliceId === null ? null : requireId(rectangle.replacesSliceId, 'sliceBinding.rectangle.replacesSliceId'),
    expectedSliceVersion: rectangle.expectedSliceVersion === null ? null : requireInteger(rectangle.expectedSliceVersion, 'sliceBinding.rectangle.expectedSliceVersion', { min: 1 }),
  };
  invariant(rectangle.included === true, 'ASSET_SLICE_BINDING_INVALID', 'Only an included committed rectangle can back an asset.', { field: 'sliceBinding.rectangle.included' });
  invariant(normalizedRectangle.width === width && normalizedRectangle.height === height, 'ASSET_SLICE_BINDING_INVALID', 'Slice dimensions must match the exact committed rectangle.', { width, height, rectangle: normalizedRectangle });
  const sourceDigest = requireString(record.sourceDigest, 'sliceBinding.sourceDigest', { min: 64, max: 64 });
  const definitionFingerprint = requireString(record.definitionFingerprint, 'sliceBinding.definitionFingerprint', { min: 64, max: 64 });
  invariant(HASH_PATTERN.test(sourceDigest) && HASH_PATTERN.test(definitionFingerprint), 'ASSET_SLICE_BINDING_INVALID', 'Source digest and definition fingerprint must be lowercase SHA-256.');
  invariant(record.priorDigest === null || HASH_PATTERN.test(record.priorDigest), 'ASSET_SLICE_BINDING_INVALID', 'Prior digest must be null or lowercase SHA-256.');
  invariant(record.mediaType === 'image/png', 'ASSET_SLICE_BINDING_INVALID', 'Checkpoint 2C slice bindings require image/png.', { field: 'sliceBinding.mediaType' });
  return Object.freeze({
    projectId: requireId(record.projectId, 'sliceBinding.projectId'),
    sliceId: requireId(record.sliceId, 'sliceBinding.sliceId'),
    sliceVersion: requireInteger(record.sliceVersion, 'sliceBinding.sliceVersion', { min: 1 }),
    atlasId: requireId(record.atlasId, 'sliceBinding.atlasId'),
    sourceId: requireId(record.sourceId, 'sliceBinding.sourceId'),
    sourceDigest,
    definitionVersion: requireInteger(record.definitionVersion, 'sliceBinding.definitionVersion', { min: 1 }),
    definitionFingerprint,
    rectangleId: requireId(record.rectangleId, 'sliceBinding.rectangleId'),
    rectangle: normalizedRectangle,
    processorId: requireId(record.processorId, 'sliceBinding.processorId'),
    digest,
    artifactUri,
    mediaType: record.mediaType,
    byteSize: requireInteger(record.byteSize, 'sliceBinding.byteSize', { min: 1, max: 128 * 1024 * 1024 }),
    width,
    height,
    priorDigest: record.priorDigest,
    committedRevision: requireInteger(record.committedRevision, 'sliceBinding.committedRevision', { min: 1 }),
  });
}

export function validateAssetMetadata({ assetId, kind, metadata, sliceBinding }) {
  const normalizedAssetId = requireId(assetId, 'assetId');
  const normalizedKind = requireEnum(kind, 'kind', ASSET_KINDS);
  const binding = validateExactSliceBinding(sliceBinding);
  const authored = normalizeMetadata(metadata, normalizedKind);
  const normalized = Object.freeze({
    ...authored,
    pixelSize: { width: binding.width, height: binding.height },
    pivot: binding.rectangle.pivot,
  });
  const findings = metadataFindings(normalized, normalizedKind, normalizedAssetId);
  return Object.freeze({
    metadata: normalized,
    findings,
    // metadataVersion tracks only the typed semantic document. Exact imagery
    // lineage has its own immutable slice binding and still participates in
    // proposal/content fingerprints, but changing imagery alone must not
    // manufacture a metadata revision.
    fingerprint: stableHash({ kind: normalizedKind, metadata: normalized }),
  });
}

function surfaceFinding(ruleId, path, explanation, remediation) {
  return finding({ ruleId, targetKind: 'surfaceDomain', targetId: 'surface-domain', path, explanation, remediation });
}

function integerRect(value, label, { positiveSize = true } = {}) {
  const record = exactFields(value, ['x', 'y', 'width', 'height'], label);
  return {
    x: requireInteger(record.x, `${label}.x`),
    y: requireInteger(record.y, `${label}.y`),
    width: requireInteger(record.width, `${label}.width`, { min: positiveSize ? 1 : 0 }),
    height: requireInteger(record.height, `${label}.height`, { min: positiveSize ? 1 : 0 }),
  };
}

function overlaps(left, right) {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}

export function validateSurfaceTilingDomain({ room, structuralBands, spanTiles, placements }) {
  const normalizedRoom = integerRect(room, 'room');
  const bands = exactFields(structuralBands, ['left', 'right', 'top', 'bottom'], 'structuralBands');
  const normalizedBands = Object.fromEntries(['left', 'right', 'top', 'bottom'].map((side) => [
    side,
    requireInteger(bands[side], `structuralBands.${side}`, { min: 0 }),
  ]));
  const span = normalizeSpan(spanTiles, 'spanTiles');
  invariant(span !== null, 'VALIDATION_ERROR', 'spanTiles is required.', { field: 'spanTiles' });
  invariant(Array.isArray(placements) && placements.length <= 16384, 'VALIDATION_ERROR', 'placements must be a bounded array.', { field: 'placements' });
  const usableDomain = {
    x: normalizedRoom.x + normalizedBands.left,
    y: normalizedRoom.y + normalizedBands.top,
    width: normalizedRoom.width - normalizedBands.left - normalizedBands.right,
    height: normalizedRoom.height - normalizedBands.top - normalizedBands.bottom,
  };
  const findings = [];
  if (usableDomain.width <= 0 || usableDomain.height <= 0) {
    findings.push(surfaceFinding('studio.asset.surface.no_usable_domain', '/structuralBands', 'Structural bands leave no positive tiling domain.', 'Adjust the room or an explicitly flexible structural band.'));
    return Object.freeze({ room: normalizedRoom, structuralBands: normalizedBands, spanTiles: span, usableDomain, expectedPlacements: 0, placements: [], findings });
  }
  if (usableDomain.width % span.width !== 0) findings.push(surfaceFinding('studio.asset.surface.width_not_divisible', '/spanTiles/width', 'Usable width is not divisible by the macro width.', 'Adjust room geometry, a flexible structural band, or author a semantic fringe surface.'));
  if (usableDomain.height % span.height !== 0) findings.push(surfaceFinding('studio.asset.surface.height_not_divisible', '/spanTiles/height', 'Usable height is not divisible by the macro height.', 'Adjust room geometry, a flexible structural band, or author a semantic fringe surface.'));
  const expectedPlacements = usableDomain.width % span.width === 0 && usableDomain.height % span.height === 0
    ? (usableDomain.width / span.width) * (usableDomain.height / span.height)
    : 0;
  const normalizedPlacements = placements.map((placement, index) => integerRect(placement, `placements[${index}]`));
  for (const [index, placement] of normalizedPlacements.entries()) {
    const path = `/placements/${index}`;
    const contained = placement.x >= usableDomain.x && placement.y >= usableDomain.y
      && placement.x + placement.width <= usableDomain.x + usableDomain.width
      && placement.y + placement.height <= usableDomain.y + usableDomain.height;
    if (!contained || placement.width !== span.width || placement.height !== span.height) findings.push(surfaceFinding('studio.asset.surface.macro_out_of_domain', path, 'A macro is clipped, partial, or outside the usable domain.', 'Place only complete macros wholly inside the usable domain.'));
    if ((placement.x - usableDomain.x) % span.width !== 0 || (placement.y - usableDomain.y) % span.height !== 0) findings.push(surfaceFinding('studio.asset.surface.macro_misaligned', path, 'A macro is not aligned to the usable-domain origin.', 'Align placement to room origin plus structural bands.'));
    for (let prior = 0; prior < index; prior += 1) {
      if (overlaps(normalizedPlacements[prior], placement)) {
        findings.push(surfaceFinding('studio.asset.surface.macro_overlap', path, 'Macro placements overlap.', 'Use one nonoverlapping macro per usable-domain cell.'));
        break;
      }
    }
  }
  if (expectedPlacements > 0 && normalizedPlacements.length !== expectedPlacements) findings.push(surfaceFinding('studio.asset.surface.coverage_incomplete', '/placements', 'Macro placements do not cover the usable domain exactly.', 'Provide exactly one complete macro for every aligned usable-domain cell.'));
  return Object.freeze({ room: normalizedRoom, structuralBands: normalizedBands, spanTiles: span, usableDomain, expectedPlacements, placements: normalizedPlacements, findings });
}

export function evaluateAssetLifecycle({ current, target, findings, acceptedWarningFindingIds = [] }) {
  requireEnum(current, 'current', ASSET_LIFECYCLES);
  requireEnum(target, 'target', ASSET_LIFECYCLES);
  invariant(Array.isArray(findings), 'VALIDATION_ERROR', 'findings must be an array.', { field: 'findings' });
  const acceptedWarnings = new Set(boundedStrings(acceptedWarningFindingIds, 'acceptedWarningFindingIds', { maxItems: 1024, maxLength: 128 }));
  const targetIndex = ASSET_LIFECYCLES.indexOf(target);
  const currentIndex = ASSET_LIFECYCLES.indexOf(current);
  if (targetIndex >= ASSET_LIFECYCLES.indexOf('VALIDATED')) {
    const blocking = findings.filter(({ severity }) => severity === 'ERROR');
    invariant(blocking.length === 0, 'ASSET_LIFECYCLE_BLOCKED', 'Blocking findings prevent asset validation.', { findingIds: blocking.map(({ findingId }) => findingId) });
  }
  if (target === 'FINAL') {
    const undispositioned = findings.filter(({ severity, findingId }) => severity === 'WARNING' && !acceptedWarnings.has(findingId));
    invariant(undispositioned.length === 0, 'ASSET_WARNING_UNDISPOSITIONED', 'Every warning requires explicit owner disposition before finalization.', { findingIds: undispositioned.map(({ findingId }) => findingId) });
  }
  invariant(targetIndex >= currentIndex && targetIndex <= currentIndex + 1, 'ASSET_LIFECYCLE_TRANSITION_INVALID', 'Asset lifecycle may advance by at most one state and cannot move backward.', { current, target });
  return target;
}

export function validateAssetProposal(candidate) {
  const record = exactFields(candidate, ['projectId', 'proposalId', 'expectedRevision', 'items'], 'proposal');
  invariant(Array.isArray(record.items) && record.items.length >= 1 && record.items.length <= MAX_ASSET_PROPOSAL_ITEMS, 'ASSET_PROPOSAL_LIMIT', `Asset proposals require 1 to ${MAX_ASSET_PROPOSAL_ITEMS} items.`, { maxItems: MAX_ASSET_PROPOSAL_ITEMS });
  const itemIds = new Set();
  const assetIds = new Set();
  const items = record.items.map((candidateItem, index) => {
    const item = exactFields(candidateItem, [
      'itemId', 'operation', 'assetId', 'expectedAssetVersion', 'expectedMetadataVersion',
      'sliceId', 'expectedSliceVersion', 'name', 'kind', 'metadata',
    ], `proposal.items[${index}]`);
    const itemId = requireId(item.itemId, `proposal.items[${index}].itemId`);
    const assetId = requireId(item.assetId, `proposal.items[${index}].assetId`);
    invariant(!itemIds.has(itemId), 'ASSET_PROPOSAL_DUPLICATE_ITEM', 'Proposal item IDs must be unique.', { itemId });
    invariant(!assetIds.has(assetId), 'ASSET_PROPOSAL_DUPLICATE_ASSET', 'A proposal may address an asset only once.', { assetId });
    itemIds.add(itemId);
    assetIds.add(assetId);
    const operation = requireEnum(item.operation, `proposal.items[${index}].operation`, ['create', 'update']);
    const expectedAssetVersion = requireInteger(item.expectedAssetVersion, `proposal.items[${index}].expectedAssetVersion`, { min: 0 });
    const expectedMetadataVersion = requireInteger(item.expectedMetadataVersion, `proposal.items[${index}].expectedMetadataVersion`, { min: 0 });
    invariant(operation !== 'create' || (expectedAssetVersion === 0 && expectedMetadataVersion === 0), 'ASSET_PROPOSAL_VERSION_INVALID', 'Create items must expect absent asset and metadata versions.', { itemId });
    invariant(operation !== 'update' || (expectedAssetVersion >= 1 && expectedMetadataVersion >= 1), 'ASSET_PROPOSAL_VERSION_INVALID', 'Update items require positive expected asset and metadata versions.', { itemId });
    const kind = requireEnum(item.kind, `proposal.items[${index}].kind`, ASSET_KINDS);
    return {
      ordinal: index,
      itemId,
      operation,
      assetId,
      expectedAssetVersion,
      expectedMetadataVersion,
      sliceId: requireId(item.sliceId, `proposal.items[${index}].sliceId`),
      expectedSliceVersion: requireInteger(item.expectedSliceVersion, `proposal.items[${index}].expectedSliceVersion`, { min: 1 }),
      name: requireString(item.name, `proposal.items[${index}].name`, { max: 160 }),
      kind,
      metadata: normalizeMetadata(item.metadata, kind),
    };
  });
  const normalized = {
    projectId: requireId(record.projectId, 'proposal.projectId'),
    proposalId: requireId(record.proposalId, 'proposal.proposalId'),
    expectedRevision: requireInteger(record.expectedRevision, 'proposal.expectedRevision', { min: 1 }),
    items,
  };
  invariant(Buffer.byteLength(stableJson(normalized), 'utf8') <= 1024 * 1024, 'ASSET_PROPOSAL_BYTES_LIMIT', 'The canonical proposal exceeds 1 MiB.');
  return Object.freeze({ ...normalized, commandCharge: items.length, fingerprint: stableHash(normalized) });
}
