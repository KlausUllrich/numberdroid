import { createHash } from 'node:crypto';
import { invariant } from './errors.js';
import { requireEnum, requireId, requireInteger, requireRecord, requireString } from './validation.js';

export const ROOM_VALIDATOR_VERSION = 'numberdroid-studio.room-validator.v2';
export const ROOM_KINDS = Object.freeze(['room', 'hallway']);
export const ROOM_LIFECYCLES = Object.freeze(['DRAFT', 'VALIDATED', 'FINAL']);
export const ROOM_LAYERS = Object.freeze(['STRUCTURAL_SURFACE', 'SET_DRESSING']);
export const ROOM_ROTATIONS = Object.freeze([0, 90, 180, 270]);
export const MAX_ROOM_ARCHETYPES = 128;
export const MAX_ROOM_VARIANTS = 512;
export const MAX_ROOM_AXIS_CELLS = 64;
export const MAX_ROOM_CELLS = 4096;
export const MAX_ROOM_CONNECTORS = 32;
export const MAX_ROOM_PLACEMENTS = 256;
export const MAX_ROOM_PROPOSAL_ITEMS = 64;
export const MAX_ROOM_INTENT_REFS = 32;

const SEVERITY_ORDER = Object.freeze({ ERROR: 0, WARNING: 1, INFO: 2 });
const SIDES = Object.freeze(['north', 'east', 'south', 'west']);
const CONNECTOR_KINDS = Object.freeze(['opening', 'standard-door', 'controlled-door']);
const RATIONALITIES = Object.freeze(['domestic', 'neutral', 'ritual', 'system']);
const INTENT_LAYERS = Object.freeze(['game_design', 'level_design', 'room_design']);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function stableHash(value) {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
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

function boundedStrings(value, label, { maxItems = 32, maxLength = 128 } = {}) {
  invariant(Array.isArray(value) && value.length <= maxItems, 'VALIDATION_ERROR', `${label} must contain at most ${maxItems} entries.`, { field: label, maxItems });
  const seen = new Set();
  return value.map((candidate, index) => {
    const normalized = requireString(candidate, `${label}[${index}]`, { max: maxLength });
    invariant(!seen.has(normalized), 'VALIDATION_ERROR', `${label} must not contain duplicates.`, { field: label, value: normalized });
    seen.add(normalized);
    return normalized;
  });
}

function normalizeBands(value, label = 'structuralBands') {
  const record = exactFields(value ?? {}, ['left', 'right', 'top', 'bottom'], label);
  return {
    left: requireInteger(record.left ?? 0, `${label}.left`, { min: 0, max: 63 }),
    right: requireInteger(record.right ?? 0, `${label}.right`, { min: 0, max: 63 }),
    top: requireInteger(record.top ?? 0, `${label}.top`, { min: 0, max: 63 }),
    bottom: requireInteger(record.bottom ?? 0, `${label}.bottom`, { min: 0, max: 63 }),
  };
}

function normalizeRange(value, label, preferredDefault) {
  const record = exactFields(value ?? {}, ['min', 'preferred', 'max'], label);
  const range = {
    min: requireInteger(record.min ?? 3, `${label}.min`, { min: 3, max: MAX_ROOM_AXIS_CELLS }),
    preferred: requireInteger(record.preferred ?? preferredDefault, `${label}.preferred`, { min: 3, max: MAX_ROOM_AXIS_CELLS }),
    max: requireInteger(record.max ?? MAX_ROOM_AXIS_CELLS, `${label}.max`, { min: 3, max: MAX_ROOM_AXIS_CELLS }),
  };
  invariant(range.min <= range.preferred && range.preferred <= range.max, 'ROOM_DIMENSION_POLICY_INVALID', `${label} must satisfy min <= preferred <= max.`, { field: label, range });
  return range;
}

function normalizeGoverningRuleRefs(value) {
  invariant(Array.isArray(value) && value.length <= MAX_ROOM_INTENT_REFS, 'VALIDATION_ERROR', `governingRuleRefs must contain at most ${MAX_ROOM_INTENT_REFS} entries.`, { field: 'governingRuleRefs' });
  const seen = new Set();
  return value.map((candidate, index) => {
    const record = exactFields(candidate, ['ruleId', 'summary'], `governingRuleRefs[${index}]`);
    const ruleId = requireId(record.ruleId, `governingRuleRefs[${index}].ruleId`);
    invariant(!seen.has(ruleId), 'ROOM_RULE_DUPLICATE', 'Governing rule IDs must be unique.', { ruleId });
    seen.add(ruleId);
    return { ruleId, summary: requireString(record.summary, `governingRuleRefs[${index}].summary`, { max: 256 }) };
  });
}

export function roomArchetypeDefaults(kind) {
  requireEnum(kind, 'kind', ROOM_KINDS);
  return Object.freeze(kind === 'room'
    ? {
        width: { min: 3, preferred: 10, max: 64 },
        height: { min: 3, preferred: 8, max: 64 },
        structuralBands: { left: 0, right: 0, top: 0, bottom: 0 },
        orientation: 'any',
        connectorPolicy: { min: 1, max: 32, requiredSides: [] },
      }
    : {
        width: { min: 3, preferred: 12, max: 64 },
        height: { min: 3, preferred: 3, max: 64 },
        structuralBands: { left: 0, right: 0, top: 0, bottom: 0 },
        orientation: 'horizontal',
        connectorPolicy: { min: 2, max: 32, requiredSides: ['east', 'west'] },
      });
}

export function validateRoomArchetype(candidate) {
  const record = exactFields(candidate, [
    'projectId', 'roomArchetypeId', 'version', 'kind', 'displayName', 'tags',
    'dimensionPolicy', 'structuralBands', 'orientation', 'connectorPolicy',
    'allowedAssetKinds', 'allowedTags', 'requiredTags', 'rationality', 'governingRuleRefs',
  ], 'roomArchetype');
  const kind = requireEnum(record.kind, 'roomArchetype.kind', ROOM_KINDS);
  const defaults = roomArchetypeDefaults(kind);
  const dimensions = exactFields(record.dimensionPolicy ?? {}, ['width', 'height'], 'roomArchetype.dimensionPolicy');
  const connectorPolicyRecord = exactFields(record.connectorPolicy ?? {}, ['min', 'max', 'requiredSides'], 'roomArchetype.connectorPolicy');
  const connectorPolicy = {
    min: requireInteger(connectorPolicyRecord.min ?? defaults.connectorPolicy.min, 'roomArchetype.connectorPolicy.min', { min: 0, max: MAX_ROOM_CONNECTORS }),
    max: requireInteger(connectorPolicyRecord.max ?? defaults.connectorPolicy.max, 'roomArchetype.connectorPolicy.max', { min: 0, max: MAX_ROOM_CONNECTORS }),
    requiredSides: boundedStrings(connectorPolicyRecord.requiredSides ?? defaults.connectorPolicy.requiredSides, 'roomArchetype.connectorPolicy.requiredSides', { maxItems: 4, maxLength: 8 }),
  };
  invariant(connectorPolicy.min <= connectorPolicy.max, 'ROOM_CONNECTOR_POLICY_INVALID', 'Connector policy min cannot exceed max.', { connectorPolicy });
  for (const side of connectorPolicy.requiredSides) requireEnum(side, 'roomArchetype.connectorPolicy.requiredSides[]', SIDES);
  const allowedAssetKinds = boundedStrings(record.allowedAssetKinds ?? ['surface', 'prop', 'item'], 'roomArchetype.allowedAssetKinds', { maxItems: 3, maxLength: 16 });
  for (const assetKind of allowedAssetKinds) requireEnum(assetKind, 'roomArchetype.allowedAssetKinds[]', ['surface', 'prop', 'item']);
  const normalized = {
    projectId: requireId(record.projectId, 'roomArchetype.projectId'),
    roomArchetypeId: requireId(record.roomArchetypeId, 'roomArchetype.roomArchetypeId'),
    version: requireInteger(record.version, 'roomArchetype.version', { min: 1 }),
    kind,
    displayName: requireString(record.displayName, 'roomArchetype.displayName', { max: 160 }),
    tags: boundedStrings(record.tags ?? [], 'roomArchetype.tags', { maxLength: 64 }),
    dimensionPolicy: {
      width: normalizeRange(dimensions.width, 'roomArchetype.dimensionPolicy.width', defaults.width.preferred),
      height: normalizeRange(dimensions.height, 'roomArchetype.dimensionPolicy.height', defaults.height.preferred),
    },
    structuralBands: normalizeBands(record.structuralBands ?? defaults.structuralBands, 'roomArchetype.structuralBands'),
    orientation: requireEnum(record.orientation ?? defaults.orientation, 'roomArchetype.orientation', ['horizontal', 'vertical', 'any']),
    connectorPolicy,
    allowedAssetKinds,
    allowedTags: boundedStrings(record.allowedTags ?? [], 'roomArchetype.allowedTags', { maxLength: 64 }),
    requiredTags: boundedStrings(record.requiredTags ?? [], 'roomArchetype.requiredTags', { maxLength: 64 }),
    rationality: requireEnum(record.rationality ?? 'neutral', 'roomArchetype.rationality', RATIONALITIES),
    governingRuleRefs: normalizeGoverningRuleRefs(record.governingRuleRefs ?? []),
  };
  for (const requiredTag of normalized.requiredTags) {
    invariant(normalized.allowedTags.length === 0 || normalized.allowedTags.includes(requiredTag), 'ROOM_TAG_POLICY_INVALID', 'Every required tag must also be allowed when allowedTags is nonempty.', { requiredTag });
  }
  return Object.freeze({ ...normalized, fingerprint: stableHash(normalized) });
}

function normalizeIntentTrace(value) {
  invariant(Array.isArray(value) && value.length <= MAX_ROOM_INTENT_REFS, 'VALIDATION_ERROR', `intentTrace must contain at most ${MAX_ROOM_INTENT_REFS} entries.`, { field: 'intentTrace' });
  const seen = new Set();
  return value.map((candidate, index) => {
    const record = exactFields(candidate, ['layer', 'ruleId', 'summary', 'disposition'], `intentTrace[${index}]`);
    const layer = requireEnum(record.layer, `intentTrace[${index}].layer`, INTENT_LAYERS);
    const ruleId = requireId(record.ruleId, `intentTrace[${index}].ruleId`);
    const key = `${layer}:${ruleId}`;
    invariant(!seen.has(key), 'ROOM_INTENT_DUPLICATE', 'Intent trace coordinates must be unique.', { layer, ruleId });
    seen.add(key);
    return {
      layer,
      ruleId,
      summary: requireString(record.summary, `intentTrace[${index}].summary`, { max: 256 }),
      disposition: requireEnum(record.disposition, `intentTrace[${index}].disposition`, ['governing', 'proposed']),
    };
  });
}

function normalizeConnector(value, index, width, height) {
  const label = `connectors[${index}]`;
  const record = exactFields(value, [
    'connectorId', 'side', 'offset', 'width', 'kind', 'clearanceInside',
    'clearanceOutside', 'required', 'tags', 'compatibilityProfile',
  ], label);
  const side = requireEnum(record.side, `${label}.side`, SIDES);
  const edgeLength = side === 'north' || side === 'south' ? width : height;
  const connectorWidth = requireInteger(record.width, `${label}.width`, { min: 1, max: edgeLength });
  const offset = requireInteger(record.offset, `${label}.offset`, { min: 0, max: edgeLength - 1 });
  invariant(offset + connectorWidth <= edgeLength, 'ROOM_CONNECTOR_OUT_OF_BOUNDS', 'Connector aperture must lie wholly on its selected edge.', { connectorId: record.connectorId, side, offset, width: connectorWidth, edgeLength });
  return {
    connectorId: requireId(record.connectorId, `${label}.connectorId`),
    side,
    offset,
    width: connectorWidth,
    kind: requireEnum(record.kind, `${label}.kind`, CONNECTOR_KINDS),
    clearanceInside: requireInteger(record.clearanceInside ?? 1, `${label}.clearanceInside`, { min: 0, max: 16 }),
    clearanceOutside: requireInteger(record.clearanceOutside ?? 1, `${label}.clearanceOutside`, { min: 0, max: 16 }),
    required: record.required === undefined ? true : (() => {
      invariant(typeof record.required === 'boolean', 'VALIDATION_ERROR', `${label}.required must be boolean.`, { field: `${label}.required` });
      return record.required;
    })(),
    tags: boundedStrings(record.tags ?? [], `${label}.tags`, { maxLength: 64 }),
    compatibilityProfile: record.compatibilityProfile === null || record.compatibilityProfile === undefined
      ? null
      : requireString(record.compatibilityProfile, `${label}.compatibilityProfile`, { max: 128 }),
  };
}

function normalizePlacement(value, index, label = `placements[${index}]`) {
  const record = exactFields(value, [
    'placementId', 'assetId', 'assetVersion', 'metadataVersion', 'layer', 'anchor',
    'rotation', 'variantTag', 'proposalId', 'proposalItemId',
  ], label);
  const anchor = exactFields(record.anchor, ['x', 'y'], `${label}.anchor`);
  return {
    placementId: requireId(record.placementId, `${label}.placementId`),
    assetId: requireId(record.assetId, `${label}.assetId`),
    assetVersion: requireInteger(record.assetVersion, `${label}.assetVersion`, { min: 1 }),
    metadataVersion: requireInteger(record.metadataVersion, `${label}.metadataVersion`, { min: 1 }),
    layer: requireEnum(record.layer, `${label}.layer`, ROOM_LAYERS),
    anchor: {
      x: requireInteger(anchor.x, `${label}.anchor.x`, { min: 0, max: MAX_ROOM_AXIS_CELLS - 1 }),
      y: requireInteger(anchor.y, `${label}.anchor.y`, { min: 0, max: MAX_ROOM_AXIS_CELLS - 1 }),
    },
    rotation: requireEnum(record.rotation, `${label}.rotation`, ROOM_ROTATIONS),
    variantTag: record.variantTag === null || record.variantTag === undefined
      ? null
      : requireString(record.variantTag, `${label}.variantTag`, { max: 128 }),
    proposalId: record.proposalId === null || record.proposalId === undefined
      ? null
      : requireId(record.proposalId, `${label}.proposalId`),
    proposalItemId: record.proposalItemId === null || record.proposalItemId === undefined
      ? null
      : requireId(record.proposalItemId, `${label}.proposalItemId`),
  };
}

function normalizeRoomCells(value, label, width, height) {
  invariant(Array.isArray(value) && value.length <= MAX_ROOM_CELLS, 'ROOM_SHAPE_CELL_LIMIT', `${label} must contain at most ${MAX_ROOM_CELLS} cells.`, {
    field: label,
    maxCells: MAX_ROOM_CELLS,
  });
  const seen = new Set();
  const cells = value.map((candidate, index) => {
    const record = exactFields(candidate, ['x', 'y'], `${label}[${index}]`);
    const cell = {
      x: requireInteger(record.x, `${label}[${index}].x`, { min: 0, max: width - 1 }),
      y: requireInteger(record.y, `${label}[${index}].y`, { min: 0, max: height - 1 }),
    };
    const key = `${cell.x},${cell.y}`;
    invariant(!seen.has(key), 'ROOM_SHAPE_CELL_DUPLICATE', `${label} must not contain duplicate coordinates.`, { field: label, cell });
    seen.add(key);
    return cell;
  });
  return cells.sort((left, right) => left.y - right.y || left.x - right.x);
}

function cellKeys(cells) {
  return new Set(cells.map(({ x, y }) => `${x},${y}`));
}

function cellsInRect(rect) {
  const cells = [];
  for (let y = Math.floor(rect.y); y < Math.ceil(rect.y + rect.height); y += 1) {
    for (let x = Math.floor(rect.x); x < Math.ceil(rect.x + rect.width); x += 1) cells.push({ x, y, key: `${x},${y}` });
  }
  return cells;
}

function envelopeTouchesRoomBoundary(envelope, width, height, voidCellKeys) {
  if (envelope.x === 0 || envelope.y === 0 || envelope.x + envelope.width === width || envelope.y + envelope.height === height) return true;
  for (const { x, y } of cellsInRect(envelope)) {
    if ([`${x + 1},${y}`, `${x - 1},${y}`, `${x},${y + 1}`, `${x},${y - 1}`].some((key) => voidCellKeys.has(key))) return true;
  }
  return false;
}

function roomFinding({ severity = 'ERROR', ruleId, targetKind = 'roomVariant', targetId, path, explanation, remediation }) {
  return Object.freeze({
    findingId: stableHash({ validatorVersion: ROOM_VALIDATOR_VERSION, ruleId, targetKind, targetId, path }),
    severity,
    ruleId,
    targetKind,
    targetId,
    path,
    explanation,
    remediation,
    validatorVersion: ROOM_VALIDATOR_VERSION,
  });
}

function findingSorter(left, right) {
  return (SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity])
    || left.ruleId.localeCompare(right.ruleId)
    || left.targetId.localeCompare(right.targetId)
    || left.path.localeCompare(right.path);
}

function rectIntersects(left, right) {
  return left.x < right.x + right.width && left.x + left.width > right.x
    && left.y < right.y + right.height && left.y + left.height > right.y;
}

function rotatedSpan(span, rotation) {
  return rotation === 90 || rotation === 270
    ? { width: span.height, height: span.width }
    : { width: span.width, height: span.height };
}

function rotatedLocalRect(rect, span, rotation) {
  if (rotation === 0) return { ...rect };
  if (rotation === 90) return { x: span.height - (rect.y + rect.height), y: rect.x, width: rect.height, height: rect.width };
  if (rotation === 180) return { x: span.width - (rect.x + rect.width), y: span.height - (rect.y + rect.height), width: rect.width, height: rect.height };
  return { x: rect.y, y: span.width - (rect.x + rect.width), width: rect.height, height: rect.width };
}

function connectorInsideRect(connector, width, height) {
  const depth = connector.clearanceInside;
  if (connector.side === 'north') return { x: connector.offset, y: 0, width: connector.width, height: depth };
  if (connector.side === 'south') return { x: connector.offset, y: height - depth, width: connector.width, height: depth };
  if (connector.side === 'west') return { x: 0, y: connector.offset, width: depth, height: connector.width };
  return { x: width - depth, y: connector.offset, width: depth, height: connector.width };
}

function normalizeAssetMap(assets) {
  if (assets instanceof Map) return assets;
  const record = requireRecord(assets ?? {}, 'assets');
  return new Map(Object.entries(record));
}

export function validateRoomVariant({ variant, archetype, assets, unresolvedProposalIds = [] }) {
  const normalizedArchetype = archetype?.fingerprint ? archetype : validateRoomArchetype(archetype);
  const record = exactFields(variant, [
    'projectId', 'roomVariantId', 'version', 'roomArchetypeId', 'archetypeVersion',
    'displayName', 'lifecycle', 'width', 'height', 'origin', 'intentTrace', 'connectors',
    'placements', 'voidCells', 'blockedCells', 'acceptedWarningFindingIds',
    'parentVariantVersion', 'parentFinalVersion',
  ], 'roomVariant');
  const width = requireInteger(record.width, 'roomVariant.width', { min: 3, max: MAX_ROOM_AXIS_CELLS });
  const height = requireInteger(record.height, 'roomVariant.height', { min: 3, max: MAX_ROOM_AXIS_CELLS });
  invariant(width * height <= MAX_ROOM_CELLS, 'ROOM_CELL_LIMIT', `A room variant may contain at most ${MAX_ROOM_CELLS} cells.`, { width, height, maxCells: MAX_ROOM_CELLS });
  const originRecord = exactFields(record.origin ?? { x: 0, y: 0 }, ['x', 'y'], 'roomVariant.origin');
  const origin = {
    x: requireInteger(originRecord.x, 'roomVariant.origin.x', { min: 0, max: 0 }),
    y: requireInteger(originRecord.y, 'roomVariant.origin.y', { min: 0, max: 0 }),
  };
  invariant(record.projectId === normalizedArchetype.projectId, 'ROOM_ARCHETYPE_PROJECT_MISMATCH', 'Room variant and archetype must belong to the same project.');
  invariant(record.roomArchetypeId === normalizedArchetype.roomArchetypeId && record.archetypeVersion === normalizedArchetype.version, 'ROOM_ARCHETYPE_VERSION_CONFLICT', 'Room variant must pin the exact archetype version.', {
    expectedArchetypeId: normalizedArchetype.roomArchetypeId,
    expectedArchetypeVersion: normalizedArchetype.version,
  });
  invariant(width >= normalizedArchetype.dimensionPolicy.width.min && width <= normalizedArchetype.dimensionPolicy.width.max, 'ROOM_DIMENSIONS_OUT_OF_POLICY', 'Room width is outside archetype policy.', { width, policy: normalizedArchetype.dimensionPolicy.width });
  invariant(height >= normalizedArchetype.dimensionPolicy.height.min && height <= normalizedArchetype.dimensionPolicy.height.max, 'ROOM_DIMENSIONS_OUT_OF_POLICY', 'Room height is outside archetype policy.', { height, policy: normalizedArchetype.dimensionPolicy.height });
  const intentTrace = normalizeIntentTrace(record.intentTrace ?? []);
  invariant(Array.isArray(record.connectors) && record.connectors.length <= MAX_ROOM_CONNECTORS, 'ROOM_CONNECTOR_LIMIT', `A room variant may contain at most ${MAX_ROOM_CONNECTORS} connectors.`);
  const connectors = record.connectors.map((connector, index) => normalizeConnector(connector, index, width, height));
  invariant(Array.isArray(record.placements) && record.placements.length <= MAX_ROOM_PLACEMENTS, 'ROOM_PLACEMENT_LIMIT', `A room variant may contain at most ${MAX_ROOM_PLACEMENTS} placements.`);
  const placements = record.placements.map(normalizePlacement);
  const voidCells = normalizeRoomCells(record.voidCells ?? [], 'roomVariant.voidCells', width, height);
  const blockedCells = normalizeRoomCells(record.blockedCells ?? [], 'roomVariant.blockedCells', width, height);
  const voidCellKeys = cellKeys(voidCells);
  const explicitBlockedCellKeys = cellKeys(blockedCells);
  for (const cell of blockedCells) {
    invariant(!voidCellKeys.has(`${cell.x},${cell.y}`), 'ROOM_SHAPE_CELL_CONFLICT', 'VOID and BLOCKED cells must be disjoint.', { cell });
  }
  const roomCellKeys = new Set();
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const key = `${x},${y}`;
    if (!voidCellKeys.has(key)) roomCellKeys.add(key);
  }
  invariant(roomCellKeys.size > 0, 'ROOM_SHAPE_EMPTY', 'A room shape must contain at least one non-VOID cell.');
  const connectedRoomCells = new Set([roomCellKeys.values().next().value]);
  const pendingRoomCells = [...connectedRoomCells];
  while (pendingRoomCells.length) {
    const [x, y] = pendingRoomCells.shift().split(',').map(Number);
    for (const key of [`${x + 1},${y}`, `${x - 1},${y}`, `${x},${y + 1}`, `${x},${y - 1}`]) {
      if (roomCellKeys.has(key) && !connectedRoomCells.has(key)) {
        connectedRoomCells.add(key);
        pendingRoomCells.push(key);
      }
    }
  }
  invariant(connectedRoomCells.size === roomCellKeys.size, 'ROOM_SHAPE_DISCONNECTED', 'Non-VOID room cells must form one four-neighbour component.', {
    roomCells: roomCellKeys.size,
    connectedCells: connectedRoomCells.size,
  });
  const normalized = {
    projectId: requireId(record.projectId, 'roomVariant.projectId'),
    roomVariantId: requireId(record.roomVariantId, 'roomVariant.roomVariantId'),
    version: requireInteger(record.version, 'roomVariant.version', { min: 1 }),
    roomArchetypeId: requireId(record.roomArchetypeId, 'roomVariant.roomArchetypeId'),
    archetypeVersion: requireInteger(record.archetypeVersion, 'roomVariant.archetypeVersion', { min: 1 }),
    displayName: requireString(record.displayName, 'roomVariant.displayName', { max: 160 }),
    lifecycle: requireEnum(record.lifecycle, 'roomVariant.lifecycle', ROOM_LIFECYCLES),
    width,
    height,
    origin,
    intentTrace,
    connectors,
    placements,
    voidCells,
    blockedCells,
    acceptedWarningFindingIds: boundedStrings(record.acceptedWarningFindingIds ?? [], 'roomVariant.acceptedWarningFindingIds', { maxItems: 128, maxLength: 64 }),
    parentVariantVersion: record.parentVariantVersion === null || record.parentVariantVersion === undefined ? null : requireInteger(record.parentVariantVersion, 'roomVariant.parentVariantVersion', { min: 1 }),
    parentFinalVersion: record.parentFinalVersion === null || record.parentFinalVersion === undefined ? null : requireInteger(record.parentFinalVersion, 'roomVariant.parentFinalVersion', { min: 1 }),
  };

  const findings = [];
  const add = (ruleId, path, explanation, remediation, severity = 'ERROR', targetId = normalized.roomVariantId, targetKind = 'roomVariant') => findings.push(roomFinding({ severity, ruleId, targetId, targetKind, path, explanation, remediation }));
  const seenConnectorIds = new Set();
  for (const [index, connector] of connectors.entries()) {
    if (seenConnectorIds.has(connector.connectorId)) add('studio.room.connector.duplicate', `/connectors/${index}/connectorId`, 'Connector IDs must be unique within a room variant.', 'Choose a stable unique connector ID.', 'ERROR', connector.connectorId, 'roomConnector');
    seenConnectorIds.add(connector.connectorId);
    const aperture = connectorInsideRect({ ...connector, clearanceInside: Math.max(1, connector.clearanceInside) }, width, height);
    const unavailable = cellsInRect(aperture).filter(({ key }) => voidCellKeys.has(key) || explicitBlockedCellKeys.has(key));
    if (unavailable.length) add('studio.room.connector.shape_blocked', `/connectors/${index}`, 'The connector aperture or inside approach crosses an outside or blocked cell.', 'Move the connector or restore ordinary room cells for its complete approach.', 'ERROR', connector.connectorId, 'roomConnector');
    for (const [priorIndex, prior] of connectors.slice(0, index).entries()) {
      if (prior.side === connector.side && prior.offset < connector.offset + connector.width && prior.offset + prior.width > connector.offset) {
        add('studio.room.connector.overlap', `/connectors/${index}`, 'Two connector apertures overlap on the same room edge.', `Move ${connector.connectorId} or ${prior.connectorId}.`, 'ERROR', connector.connectorId, 'roomConnector');
      }
      void priorIndex;
    }
  }
  if (connectors.length < normalizedArchetype.connectorPolicy.min) add('studio.room.connector.minimum', '/connectors', 'The archetype requires more connectors.', `Author at least ${normalizedArchetype.connectorPolicy.min} connectors.`);
  if (connectors.length > normalizedArchetype.connectorPolicy.max) add('studio.room.connector.maximum', '/connectors', 'The archetype permits fewer connectors.', `Keep at most ${normalizedArchetype.connectorPolicy.max} connectors.`);
  for (const side of normalizedArchetype.connectorPolicy.requiredSides) {
    if (!connectors.some((connector) => connector.side === side)) add('studio.room.connector.required_side', '/connectors', `The archetype requires a connector on the ${side} edge.`, `Add a nonoverlapping ${side} connector.`);
  }
  if (normalizedArchetype.kind === 'hallway') {
    const validEnds = normalizedArchetype.orientation === 'vertical' ? ['north', 'south'] : ['east', 'west'];
    if (!validEnds.every((side) => connectors.some((connector) => connector.side === side))) add('studio.room.hallway.end_connectors', '/connectors', 'A hallway requires connectors at both primary-orientation ends.', `Add ${validEnds.join(' and ')} connectors.`);
  }

  for (const layer of INTENT_LAYERS) {
    if (!intentTrace.some((entry) => entry.layer === layer)) add('studio.room.intent.layer_required', '/intentTrace', `Intent trace is missing ${layer}.`, `Cite or propose one ${layer} rule.`);
  }
  for (const [index, intent] of intentTrace.entries()) {
    if (intent.disposition === 'proposed') add('studio.room.intent.proposed', `/intentTrace/${index}/disposition`, 'A room intent rule remains proposed rather than governing.', 'Review and explicitly disposition this warning before finalization.', 'WARNING', intent.ruleId, 'roomIntent');
  }
  for (const requiredTag of normalizedArchetype.requiredTags) {
    if (!normalizedArchetype.tags.includes(requiredTag)) add('studio.room.archetype.required_tag', '/roomArchetype/tags', `Required archetype tag ${requiredTag} is absent.`, 'Update the archetype before validating this variant.');
  }
  for (const proposalId of boundedStrings(unresolvedProposalIds, 'unresolvedProposalIds', { maxItems: 128, maxLength: 128 })) {
    add('studio.room.proposal.unresolved', '/proposals', 'A placement proposal is still pending owner decision or application.', 'Decide and apply/reject the proposal before finalization.', 'ERROR', proposalId, 'roomProposal');
  }

  const assetMap = normalizeAssetMap(assets);
  const seenPlacementIds = new Set();
  const resolved = [];
  const structuralBands = normalizedArchetype.structuralBands;
  const usable = {
    x: structuralBands.left,
    y: structuralBands.top,
    width: width - structuralBands.left - structuralBands.right,
    height: height - structuralBands.top - structuralBands.bottom,
  };
  if (usable.width <= 0 || usable.height <= 0) add('studio.room.surface.no_usable_domain', '/structuralBands', 'Structural bands leave no positive surface domain.', 'Adjust dimensions or structural bands.');
  const surfaceCoverage = new Map();

  for (const [index, placement] of placements.entries()) {
    const path = `/placements/${index}`;
    if (seenPlacementIds.has(placement.placementId)) add('studio.room.placement.duplicate', `${path}/placementId`, 'Placement IDs must be unique.', 'Choose a stable unique placement ID.', 'ERROR', placement.placementId, 'roomPlacement');
    seenPlacementIds.add(placement.placementId);
    const asset = assetMap.get(`${placement.assetId}@${placement.assetVersion}:${placement.metadataVersion}`)
      ?? assetMap.get(placement.assetId);
    if (!asset) {
      add('studio.room.placement.asset_missing', `${path}/assetId`, 'The referenced V2 asset does not exist.', 'Select an existing V2 asset.', 'ERROR', placement.placementId, 'roomPlacement');
      continue;
    }
    if (asset.assetVersion !== placement.assetVersion || asset.metadataVersion !== placement.metadataVersion) {
      add('studio.room.placement.asset_version_mismatch', path, 'The placement does not pin the resolved asset and metadata versions.', 'Replan against the exact current asset version.', 'ERROR', placement.placementId, 'roomPlacement');
    }
    if (!normalizedArchetype.allowedAssetKinds.includes(asset.kind)) add('studio.room.placement.kind_forbidden', `${path}/assetId`, 'The archetype does not allow this asset kind.', 'Select an allowed asset kind or revise the archetype.', 'ERROR', placement.placementId, 'roomPlacement');
    const expectedLayer = asset.kind === 'surface' ? 'STRUCTURAL_SURFACE' : 'SET_DRESSING';
    if (placement.layer !== expectedLayer) add('studio.room.placement.layer_mismatch', `${path}/layer`, `${asset.kind} assets belong on ${expectedLayer}.`, `Move this placement to ${expectedLayer}.`, 'ERROR', placement.placementId, 'roomPlacement');
    const span = asset.metadata?.spanTiles;
    if (!span) {
      add('studio.room.placement.span_missing', `${path}/assetId`, 'The asset has no authored tile span.', 'Complete the asset metadata before room placement.', 'ERROR', placement.placementId, 'roomPlacement');
      continue;
    }
    if (asset.metadata.rotationPolicy === 'fixed' && placement.rotation !== 0) add('studio.room.placement.rotation_forbidden', `${path}/rotation`, 'A fixed-orientation asset cannot be rotated.', 'Use rotation 0 or author a cardinal rotation policy.', 'ERROR', placement.placementId, 'roomPlacement');
    const footprint = rotatedSpan(span, placement.rotation);
    const envelope = { x: placement.anchor.x, y: placement.anchor.y, width: footprint.width, height: footprint.height };
    const inRoom = envelope.x >= 0 && envelope.y >= 0 && envelope.x + envelope.width <= width && envelope.y + envelope.height <= height;
    if (!inRoom) add('studio.room.placement.out_of_bounds', `${path}/anchor`, 'The rotated footprint exceeds room bounds.', 'Move the placement wholly inside the room.', 'ERROR', placement.placementId, 'roomPlacement');
    const envelopeCells = inRoom ? cellsInRect(envelope) : [];
    const crossesVoid = envelopeCells.some(({ key }) => voidCellKeys.has(key));
    const crossesBlocked = envelopeCells.some(({ key }) => explicitBlockedCellKeys.has(key));
    if (crossesVoid) add('studio.room.placement.void_overlap', `${path}/anchor`, 'The placement footprint crosses cells outside the room.', 'Move the complete footprint onto room cells.', 'ERROR', placement.placementId, 'roomPlacement');
    if (placement.layer === 'SET_DRESSING' && crossesBlocked) add('studio.room.placement.blocked_overlap', `${path}/anchor`, 'Set dressing cannot occupy an in-room blocked cell.', 'Move the prop or item onto an ordinary room cell.', 'ERROR', placement.placementId, 'roomPlacement');
    const touchesWall = envelopeTouchesRoomBoundary(envelope, width, height, voidCellKeys);
    if (asset.metadata.attachment === 'wall' && !touchesWall) add('studio.room.placement.wall_attachment_required', path, 'This asset requires wall attachment.', 'Place its footprint against a room boundary.', 'ERROR', placement.placementId, 'roomPlacement');
    if (touchesWall && asset.metadata.placement?.wallSafe === false) add('studio.room.placement.wall_unsafe', path, 'This asset is explicitly not safe at a room boundary.', 'Move it away from the wall or author corrected metadata.', 'ERROR', placement.placementId, 'roomPlacement');
    if (asset.lifecycle !== 'FINAL') add('studio.room.placement.asset_not_final', `${path}/assetId`, 'The pinned asset version is not FINAL.', 'Review and explicitly disposition this warning or finalize the asset.', 'WARNING', placement.placementId, 'roomPlacement');
    if (asset.metadata.runtimeEligible === false) add('studio.room.placement.runtime_ineligible', `${path}/assetId`, 'The asset is explicitly not runtime-eligible.', 'Retain as a Studio-only choice or revise the asset before Numberdroid export.', 'INFO', placement.placementId, 'roomPlacement');
    const placementTags = new Set(asset.metadata.tags ?? []);
    for (const requiredTag of normalizedArchetype.requiredTags) {
      if (!placementTags.has(requiredTag)) add('studio.room.placement.required_tag_missing', `${path}/assetId`, `The asset lacks required tag ${requiredTag}.`, 'Choose a compatible asset or revise the archetype tag policy.', 'ERROR', placement.placementId, 'roomPlacement');
    }
    const collisionRects = [];
    const collision = asset.metadata.collision;
    const collisionSources = collision?.mode === 'bounds' ? [collision.bounds] : collision?.mode === 'parts' ? collision.parts : [];
    for (const source of collisionSources.filter(Boolean)) {
      const rotated = rotatedLocalRect(source, span, placement.rotation);
      collisionRects.push({ x: envelope.x + rotated.x, y: envelope.y + rotated.y, width: rotated.width, height: rotated.height });
    }
    if (asset.metadata.navigation?.effect === 'blocked' && collisionRects.length === 0) collisionRects.push(envelope);
    const resolvedPlacement = { placement, asset, footprint, envelope, collisionRects };
    resolved.push(resolvedPlacement);

    if (asset.kind === 'surface' && inRoom && usable.width > 0 && usable.height > 0) {
      const insideUsable = envelope.x >= usable.x && envelope.y >= usable.y
        && envelope.x + envelope.width <= usable.x + usable.width
        && envelope.y + envelope.height <= usable.y + usable.height
        && !crossesVoid;
      if (!insideUsable) add('studio.room.surface.macro_out_of_domain', path, 'A structural surface macro is clipped, partial, or inside an excluded band.', 'Place complete macros wholly inside the usable domain.', 'ERROR', placement.placementId, 'roomPlacement');
      if ((envelope.x - usable.x) % footprint.width !== 0 || (envelope.y - usable.y) % footprint.height !== 0) add('studio.room.surface.macro_misaligned', path, 'A structural surface macro is not aligned to the usable-domain origin.', 'Align from room origin plus structural bands.', 'ERROR', placement.placementId, 'roomPlacement');
      if (insideUsable) {
        for (let y = envelope.y; y < envelope.y + envelope.height; y += 1) {
          for (let x = envelope.x; x < envelope.x + envelope.width; x += 1) {
            const key = `${x},${y}`;
            if (!voidCellKeys.has(key)) surfaceCoverage.set(key, (surfaceCoverage.get(key) ?? 0) + 1);
          }
        }
      }
    }
  }

  for (const [index, current] of resolved.entries()) {
    for (const prior of resolved.slice(0, index)) {
      if (current.placement.layer === 'SET_DRESSING' && prior.placement.layer === 'SET_DRESSING' && rectIntersects(current.envelope, prior.envelope)) add('studio.room.placement.overlap', `/placements/${index}`, 'Set-dressing placement envelopes overlap.', `Move ${current.placement.placementId} or ${prior.placement.placementId}.`, 'ERROR', current.placement.placementId, 'roomPlacement');
      if (current.collisionRects.some((left) => prior.collisionRects.some((right) => rectIntersects(left, right)))) add('studio.room.collision.overlap', `/placements/${index}`, 'Physical collision geometry overlaps another placement.', `Move ${current.placement.placementId} or ${prior.placement.placementId}.`, 'ERROR', current.placement.placementId, 'roomPlacement');
    }
    for (const connector of connectors) {
      const clearance = connectorInsideRect(connector, width, height);
      if (current.collisionRects.some((rect) => rectIntersects(rect, clearance))) add('studio.room.connector.clearance_blocked', `/placements/${index}`, `Placement blocks the inside clearance of connector ${connector.connectorId}.`, 'Move the blocking placement away from the connector approach.', 'ERROR', current.placement.placementId, 'roomPlacement');
    }
  }

  if (usable.width > 0 && usable.height > 0) {
    let missing = 0;
    let overlap = 0;
    for (let y = usable.y; y < usable.y + usable.height; y += 1) {
      for (let x = usable.x; x < usable.x + usable.width; x += 1) {
        if (voidCellKeys.has(`${x},${y}`)) continue;
        const count = surfaceCoverage.get(`${x},${y}`) ?? 0;
        if (count === 0) missing += 1;
        if (count > 1) overlap += 1;
      }
    }
    if (missing > 0) add('studio.room.surface.coverage_incomplete', '/placements', 'Structural surfaces do not cover the complete usable domain.', `Cover the remaining ${missing} usable cells with complete macros.`);
    if (overlap > 0) add('studio.room.surface.coverage_overlap', '/placements', 'Structural surface macros overlap.', `Remove overlap from ${overlap} usable cells.`);
  }

  const navigationBlockedCells = new Set(explicitBlockedCellKeys);
  for (const entry of resolved) {
    for (const rect of entry.collisionRects) {
      for (let y = Math.floor(rect.y); y < Math.ceil(rect.y + rect.height); y += 1) {
        for (let x = Math.floor(rect.x); x < Math.ceil(rect.x + rect.width); x += 1) {
          if (x >= 0 && y >= 0 && x < width && y < height) navigationBlockedCells.add(`${x},${y}`);
        }
      }
    }
  }
  const connectorCells = connectors.flatMap((connector) => {
    const rect = connectorInsideRect({ ...connector, clearanceInside: Math.max(1, connector.clearanceInside) }, width, height);
    const cells = [];
    for (let y = rect.y; y < rect.y + rect.height; y += 1) for (let x = rect.x; x < rect.x + rect.width; x += 1) cells.push(`${x},${y}`);
    return cells.filter((cell) => !navigationBlockedCells.has(cell) && !voidCellKeys.has(cell));
  });
  if (connectors.length > 0 && connectorCells.length === 0) add('studio.room.navigation.connector_unreachable', '/connectors', 'No connector has a passable inside access cell.', 'Clear at least one inside approach cell for every required connector.');
  if (connectorCells.length > 0) {
    const visited = new Set([connectorCells[0]]);
    const queue = [connectorCells[0]];
    while (queue.length) {
      const [x, y] = queue.shift().split(',').map(Number);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        const key = `${nx},${ny}`;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height || voidCellKeys.has(key) || navigationBlockedCells.has(key) || visited.has(key)) continue;
        visited.add(key);
        queue.push(key);
      }
    }
    if (connectorCells.some((cell) => !visited.has(cell))) add('studio.room.navigation.connectors_disconnected', '/connectors', 'Required connector approaches are not mutually reachable.', 'Move blocking placements to restore a passable route.');
  }

  findings.sort(findingSorter);
  return Object.freeze({
    variant: Object.freeze(normalized),
    findings: Object.freeze(findings),
    fingerprint: stableHash({ variant: normalized, findings }),
  });
}

export function evaluateRoomLifecycle({ current, target, findings, acceptedWarningFindingIds = [] }) {
  requireEnum(current, 'current', ROOM_LIFECYCLES);
  requireEnum(target, 'target', ROOM_LIFECYCLES);
  const allowed = current === 'DRAFT' ? ['DRAFT', 'VALIDATED'] : current === 'VALIDATED' ? ['VALIDATED', 'FINAL', 'DRAFT'] : ['FINAL'];
  invariant(allowed.includes(target), 'ROOM_LIFECYCLE_TRANSITION_INVALID', `Room lifecycle cannot move from ${current} to ${target}.`, { current, target });
  if (target === 'VALIDATED' || target === 'FINAL') {
    const blocking = findings.filter(({ severity }) => severity === 'ERROR');
    invariant(blocking.length === 0, 'ROOM_LIFECYCLE_BLOCKED', 'Blocking room findings prevent validation or finalization.', { findingIds: blocking.map(({ findingId }) => findingId) });
  }
  if (target === 'FINAL') {
    const accepted = new Set(acceptedWarningFindingIds);
    const undispositioned = findings.filter(({ severity, findingId }) => severity === 'WARNING' && !accepted.has(findingId));
    invariant(undispositioned.length === 0, 'ROOM_WARNING_UNDISPOSITIONED', 'Every room warning requires explicit owner disposition before finalization.', { findingIds: undispositioned.map(({ findingId }) => findingId) });
  }
  return target;
}

export function forkFinalRoomVariant({ finalVariant, nextVersion }) {
  invariant(finalVariant?.lifecycle === 'FINAL', 'ROOM_FORK_REQUIRES_FINAL', 'Only a FINAL room variant can start a new draft lineage.');
  const version = requireInteger(nextVersion, 'nextVersion', { min: finalVariant.version + 1 });
  invariant(version === finalVariant.version + 1, 'ROOM_FORK_VERSION_INVALID', 'A room fork must create the next immutable variant version.', { currentVersion: finalVariant.version, nextVersion: version });
  const draft = {
    ...structuredClone(finalVariant),
    version,
    lifecycle: 'DRAFT',
    acceptedWarningFindingIds: [],
    parentVariantVersion: finalVariant.version,
    parentFinalVersion: finalVariant.version,
  };
  delete draft.findings;
  return Object.freeze(draft);
}

function normalizeProposalPlacement(value, label) {
  const placement = normalizePlacement(value, 0, label);
  return Object.fromEntries(Object.entries(placement).map(([key, val]) => [key, val]));
}

export function validateRoomPlacementProposal(candidate) {
  const record = exactFields(candidate, [
    'projectId', 'proposalId', 'roomVariantId', 'expectedRoomVariantVersion', 'items',
  ], 'roomPlacementProposal');
  invariant(Array.isArray(record.items) && record.items.length > 0 && record.items.length <= MAX_ROOM_PROPOSAL_ITEMS, 'ROOM_PROPOSAL_LIMIT', `A room placement proposal must contain 1 to ${MAX_ROOM_PROPOSAL_ITEMS} items.`, { maxItems: MAX_ROOM_PROPOSAL_ITEMS });
  const itemIds = new Set();
  const placementIds = new Set();
  const items = record.items.map((candidateItem, index) => {
    const label = `roomPlacementProposal.items[${index}]`;
    const item = exactFields(candidateItem, ['itemId', 'operation', 'placement', 'placementId', 'expectedAssetId', 'anchor', 'rotation'], label);
    const itemId = requireId(item.itemId, `${label}.itemId`);
    invariant(!itemIds.has(itemId), 'ROOM_PROPOSAL_DUPLICATE_ITEM', 'Room proposal item IDs must be unique.', { itemId });
    itemIds.add(itemId);
    const operation = requireEnum(item.operation, `${label}.operation`, ['add', 'move', 'remove']);
    if (operation === 'add') {
      invariant(item.placement !== null && item.placement !== undefined && item.placementId === null && item.expectedAssetId === null && item.anchor === null && item.rotation === null, 'ROOM_PROPOSAL_ITEM_INVALID', 'Add items must carry only one complete placement.', { itemId });
      const placement = normalizeProposalPlacement(item.placement, `${label}.placement`);
      invariant(!placementIds.has(placement.placementId), 'ROOM_PROPOSAL_DUPLICATE_PLACEMENT', 'A proposal may target a placement only once.', { placementId: placement.placementId });
      placementIds.add(placement.placementId);
      return { itemId, operation, placement, placementId: null, expectedAssetId: null, anchor: null, rotation: null };
    }
    invariant(item.placement === null, 'ROOM_PROPOSAL_ITEM_INVALID', `${operation} items cannot carry a new placement object.`, { itemId });
    const placementId = requireId(item.placementId, `${label}.placementId`);
    invariant(!placementIds.has(placementId), 'ROOM_PROPOSAL_DUPLICATE_PLACEMENT', 'A proposal may target a placement only once.', { placementId });
    placementIds.add(placementId);
    const expectedAssetId = requireId(item.expectedAssetId, `${label}.expectedAssetId`);
    if (operation === 'remove') {
      invariant(item.anchor === null && item.rotation === null, 'ROOM_PROPOSAL_ITEM_INVALID', 'Remove items cannot carry transform fields.', { itemId });
      return { itemId, operation, placement: null, placementId, expectedAssetId, anchor: null, rotation: null };
    }
    const anchorRecord = exactFields(item.anchor, ['x', 'y'], `${label}.anchor`);
    return {
      itemId,
      operation,
      placement: null,
      placementId,
      expectedAssetId,
      anchor: {
        x: requireInteger(anchorRecord.x, `${label}.anchor.x`, { min: 0, max: MAX_ROOM_AXIS_CELLS - 1 }),
        y: requireInteger(anchorRecord.y, `${label}.anchor.y`, { min: 0, max: MAX_ROOM_AXIS_CELLS - 1 }),
      },
      rotation: requireEnum(item.rotation, `${label}.rotation`, ROOM_ROTATIONS),
    };
  });
  const normalized = {
    projectId: requireId(record.projectId, 'roomPlacementProposal.projectId'),
    proposalId: requireId(record.proposalId, 'roomPlacementProposal.proposalId'),
    roomVariantId: requireId(record.roomVariantId, 'roomPlacementProposal.roomVariantId'),
    expectedRoomVariantVersion: requireInteger(record.expectedRoomVariantVersion, 'roomPlacementProposal.expectedRoomVariantVersion', { min: 1 }),
    items,
  };
  return Object.freeze({
    ...normalized,
    commandCharge: items.length,
    fingerprint: stableHash(normalized),
  });
}
