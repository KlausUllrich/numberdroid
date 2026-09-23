export const ROOM_SURFACE_PLANNER_VERSION = 'numberdroid-studio.room-surface-plan.v1';

const ROTATIONS = Object.freeze([0, 90, 180, 270]);
const POLICIES = Object.freeze(['emptyOnly', 'replace']);
const MAX_CELLS = 4096;
const MAX_POOL = 256;
const MAX_PLACEMENTS = 256;

function fail(code, message, details = {}) {
  const error = new Error(message);
  error.name = 'RoomSurfacePlanError';
  error.code = code;
  error.details = Object.freeze(structuredClone(details));
  throw error;
}

function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('ROOM_SURFACE_PLAN_INVALID', `${label} must be an object.`, { field: label });
  return value;
}

function integer(value, label, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail('ROOM_SURFACE_PLAN_INVALID', `${label} must be an integer from ${min} to ${max}.`, { field: label, min, max });
  return value;
}

function id(value, label) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)) fail('ROOM_SURFACE_PLAN_INVALID', `${label} must be a stable identifier.`, { field: label });
  return value;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  return value;
}

export function canonicalRoomSurfacePlanJson(value) {
  return JSON.stringify(canonicalize(value));
}

// Portable synchronous fingerprint. It is an idempotency comparison token, not
// a security digest; the server binds authority and revision independently.
function portableFingerprint(value) {
  const text = canonicalRoomSurfacePlanJson(value);
  const seeds = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35, 0x27d4eb2f, 0x165667b1, 0xd3a2646c, 0xfd7046c5];
  return seeds.map(seed => {
    let hash = seed >>> 0;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  }).join('');
}

function compareCell(left, right) {
  return left.y - right.y || left.x - right.x;
}

function cellKey(cell) {
  return `${cell.x},${cell.y}`;
}

function rotatedSpan(span, rotation) {
  return rotation === 90 || rotation === 270
    ? { width: span.height, height: span.width }
    : { width: span.width, height: span.height };
}

function footprintCells(anchor, span) {
  const cells = [];
  for (let y = anchor.y; y < anchor.y + span.height; y += 1) {
    for (let x = anchor.x; x < anchor.x + span.width; x += 1) cells.push({ x, y });
  }
  return cells;
}

function exactPin(value, label) {
  const pin = record(value, label);
  return {
    assetId: id(pin.assetId, `${label}.assetId`),
    assetVersion: integer(pin.assetVersion, `${label}.assetVersion`, 1, Number.MAX_SAFE_INTEGER),
    metadataVersion: integer(pin.metadataVersion, `${label}.metadataVersion`, 1, Number.MAX_SAFE_INTEGER),
  };
}

function pinKey(pin) {
  return `${pin.assetId}@${pin.assetVersion}:${pin.metadataVersion}`;
}

function normalizeRotation(value, label = 'baseRotation') {
  if (!ROTATIONS.includes(value)) fail('ROOM_SURFACE_PLAN_INVALID', `${label} must be 0, 90, 180 or 270.`, { field: label, allowed: ROTATIONS });
  return value;
}

function normalizeSpan(asset) {
  const span = asset?.metadata?.spanTiles;
  if (!Number.isSafeInteger(span?.width) || span.width < 1 || span.width > 64
      || !Number.isSafeInteger(span?.height) || span.height < 1 || span.height > 64) return null;
  return { width: span.width, height: span.height };
}

function connectorSignature(connectors) {
  if (!Array.isArray(connectors)) return null;
  return canonicalRoomSurfacePlanJson(connectors);
}

export function surfacePlanAssetEligibility(asset, { baseRotation = 0, randomRotation = false } = {}) {
  const reasons = [];
  const rotation = ROTATIONS.includes(baseRotation) ? baseRotation : null;
  const span = normalizeSpan(asset);
  if (!asset || typeof asset !== 'object') reasons.push('asset_missing');
  if (asset?.kind !== 'surface') reasons.push('not_surface');
  if (!span) reasons.push('span_missing');
  const rotationPolicy = asset?.metadata?.rotationPolicy;
  if (!['fixed', 'cardinal'].includes(rotationPolicy)) reasons.push('rotation_policy_missing');
  if (rotation === null || (rotationPolicy === 'fixed' && rotation !== 0)) reasons.push('rotation_forbidden');
  if (randomRotation && rotationPolicy !== 'cardinal') reasons.push('random_rotation_forbidden');
  const orientations = reasons.length || !span ? [] : (randomRotation
    ? ROTATIONS.filter(candidate => {
        const candidateSpan = rotatedSpan(span, candidate);
        const baseSpan = rotatedSpan(span, rotation);
        return candidateSpan.width === baseSpan.width && candidateSpan.height === baseSpan.height;
      })
    : [rotation]);
  const metadata = asset?.metadata ?? {};
  const semanticKey = canonicalRoomSurfacePlanJson({
    role: metadata.role ?? null,
    continuityProfile: metadata.continuityProfile ?? null,
    continuityTags: [...(Array.isArray(metadata.continuityTags) ? metadata.continuityTags : [])].sort(),
    connectors: connectorSignature(metadata.connectors ?? []),
  });
  return Object.freeze({ eligible: reasons.length === 0, reasons: Object.freeze(reasons), span, orientations: Object.freeze(orientations), semanticKey });
}

function normalizeAssets(assets) {
  if (!Array.isArray(assets) || assets.length > MAX_PLACEMENTS + MAX_POOL) fail('ROOM_SURFACE_PLAN_INVALID', 'assets must contain only the bounded exact Room and pool pins.', { field: 'assets', maxItems: MAX_PLACEMENTS + MAX_POOL });
  const result = new Map();
  for (const [index, asset] of assets.entries()) {
    const pin = exactPin(asset, `assets[${index}]`);
    const key = pinKey(pin);
    if (result.has(key)) fail('ROOM_SURFACE_PLAN_INVALID', 'assets must not repeat an exact pin.', { pin });
    result.set(key, asset);
  }
  return result;
}

function normalizeRoom(room, archetype) {
  const value = record(room, 'room');
  const policy = record(archetype, 'archetype');
  const width = integer(value.width, 'room.width', 1, 64);
  const height = integer(value.height, 'room.height', 1, 64);
  if (width * height > MAX_CELLS) fail('ROOM_SURFACE_PLAN_INVALID', 'The Room exceeds the Surface planner cell limit.', { width, height, maxCells: MAX_CELLS });
  if (!Array.isArray(value.placements) || value.placements.length > MAX_PLACEMENTS) fail('ROOM_SURFACE_PLAN_INVALID', 'room.placements must contain at most 256 entries.', { field: 'room.placements' });
  const bands = policy.structuralBands ?? {};
  const structuralBands = {
    left: integer(bands.left ?? 0, 'archetype.structuralBands.left', 0, 63),
    right: integer(bands.right ?? 0, 'archetype.structuralBands.right', 0, 63),
    top: integer(bands.top ?? 0, 'archetype.structuralBands.top', 0, 63),
    bottom: integer(bands.bottom ?? 0, 'archetype.structuralBands.bottom', 0, 63),
  };
  const usable = { x: structuralBands.left, y: structuralBands.top,
    width: width - structuralBands.left - structuralBands.right,
    height: height - structuralBands.top - structuralBands.bottom };
  if (usable.width < 1 || usable.height < 1) fail('ROOM_SURFACE_SCOPE_INVALID', 'Structural bands leave no usable Surface domain.', { structuralBands, width, height });
  const voidKeys = new Set((value.voidCells ?? []).map(cell => cellKey(cell)));
  return { value, width, height, structuralBands, usable, voidKeys };
}

function normalizeScope(scopeCells, normalizedRoom) {
  if (!Array.isArray(scopeCells) || scopeCells.length < 1 || scopeCells.length > MAX_CELLS) fail('ROOM_SURFACE_SCOPE_INVALID', 'scopeCells must contain 1 to 4096 cells.', { field: 'scopeCells' });
  const seen = new Set();
  const cells = scopeCells.map((candidate, index) => {
    const cell = record(candidate, `scopeCells[${index}]`);
    const normalized = { x: integer(cell.x, `scopeCells[${index}].x`, 0, normalizedRoom.width - 1), y: integer(cell.y, `scopeCells[${index}].y`, 0, normalizedRoom.height - 1) };
    const key = cellKey(normalized);
    if (seen.has(key)) fail('ROOM_SURFACE_SCOPE_INVALID', 'scopeCells must not contain duplicates.', { cell: normalized });
    seen.add(key);
    return normalized;
  }).sort(compareCell);
  const unusable = cells.filter(cell => cell.x < normalizedRoom.usable.x || cell.y < normalizedRoom.usable.y
    || cell.x >= normalizedRoom.usable.x + normalizedRoom.usable.width
    || cell.y >= normalizedRoom.usable.y + normalizedRoom.usable.height
    || normalizedRoom.voidKeys.has(cellKey(cell)));
  if (unusable.length) fail('ROOM_SURFACE_SCOPE_INVALID', 'Surface scope may contain only non-VOID cells inside the usable domain.', { cells: unusable });
  return { cells, keys: seen };
}

function placementAsset(placement, assets, label) {
  const pin = exactPin(placement, label);
  const asset = assets.get(pinKey(pin));
  if (!asset) fail('ROOM_SURFACE_ASSET_NOT_FOUND', 'An exact historical Surface asset required by the Room is unavailable.', { ...pin, placementId: placement.placementId });
  return asset;
}

function normalizeExistingSurfacePlacements(room, assets) {
  return room.placements.filter(({ layer }) => layer === 'STRUCTURAL_SURFACE').map((placement, index) => {
    const asset = placementAsset(placement, assets, `room.placements[${index}]`);
    const rotation = normalizeRotation(placement.rotation, `room.placements[${index}].rotation`);
    const span = normalizeSpan(asset);
    if (!span) fail('ROOM_SURFACE_ASSET_INELIGIBLE', 'An existing Surface has no complete authored footprint.', { placementId: placement.placementId });
    const footprint = rotatedSpan(span, rotation);
    const anchor = record(placement.anchor, `room.placements[${index}].anchor`);
    const normalizedAnchor = { x: integer(anchor.x, `room.placements[${index}].anchor.x`, 0, 63), y: integer(anchor.y, `room.placements[${index}].anchor.y`, 0, 63) };
    return { placement, asset, footprint, cells: footprintCells(normalizedAnchor, footprint) };
  });
}

function occupancyOf(placements) {
  const occupancy = new Map();
  for (const resolved of placements) for (const cell of resolved.cells) {
    const key = cellKey(cell);
    const entries = occupancy.get(key) ?? [];
    entries.push(resolved);
    occupancy.set(key, entries);
  }
  return occupancy;
}

export function findRoomSurfaceOverlaps({ room, assets }) {
  const resolved = normalizeExistingSurfacePlacements(record(room, 'room'), normalizeAssets(assets));
  return [...occupancyOf(resolved).entries()].filter(([, entries]) => entries.length > 1).map(([key, entries]) => {
    const [x, y] = key.split(',').map(Number);
    return { cell: { x, y }, placementIds: entries.map(({ placement }) => placement.placementId).sort() };
  }).sort((left, right) => compareCell(left.cell, right.cell));
}

function normalizePool(pool, assets, options) {
  if (!Array.isArray(pool) || pool.length > MAX_POOL) fail('ROOM_SURFACE_PLAN_INVALID', 'pool must contain at most 256 exact Asset pins.', { field: 'pool' });
  const seen = new Set();
  const candidates = pool.map((candidate, index) => {
    const pin = exactPin(candidate, `pool[${index}]`);
    const key = pinKey(pin);
    if (seen.has(key)) fail('ROOM_SURFACE_PLAN_INVALID', 'pool must not repeat an exact Asset pin.', { pin });
    seen.add(key);
    const asset = assets.get(key);
    if (!asset) fail('ROOM_SURFACE_ASSET_NOT_FOUND', 'A selected exact Surface Asset version is unavailable.', { ...pin });
    const eligibility = surfacePlanAssetEligibility(asset, options);
    if (!eligibility.eligible) fail('ROOM_SURFACE_ASSET_INELIGIBLE', 'A selected Asset cannot be used by this Surface plan.', { ...pin, reasons: eligibility.reasons });
    return { pin, asset, eligibility };
  }).sort((left, right) => pinKey(left.pin).localeCompare(pinKey(right.pin)));
  if (candidates.length > 1) {
    const first = candidates[0].eligibility;
    const incompatible = candidates.filter(candidate => candidate.eligibility.semanticKey !== first.semanticKey
      || candidate.eligibility.orientations.some(rotation => {
        const span = rotatedSpan(candidate.eligibility.span, rotation);
        const expected = rotatedSpan(first.span, first.orientations[0]);
        return span.width !== expected.width || span.height !== expected.height;
      }));
    if (incompatible.length) fail('ROOM_SURFACE_POOL_INCOMPATIBLE', 'Mixed Surface pools require one semantic continuity family and one rotated footprint class.', { pins: incompatible.map(({ pin }) => pin) });
    if ((candidates[0].asset.metadata.connectors ?? []).length) fail('ROOM_SURFACE_POOL_INCOMPATIBLE', 'Directional connector Surfaces cannot be randomly mixed.', { pins: candidates.map(({ pin }) => pin) });
  }
  if (options.randomRotation && candidates.some(({ asset }) => (asset.metadata.connectors ?? []).length)) {
    fail('ROOM_SURFACE_POOL_INCOMPATIBLE', 'Directional connector Surfaces cannot use random rotation.', { pins: candidates.map(({ pin }) => pin) });
  }
  return candidates;
}

function seededIndex(seed, key, bound) {
  const text = `${seed}\u0000${key}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul((hash ^ text.charCodeAt(index)) >>> 0, 0x01000193) >>> 0;
  return bound === 0 ? 0 : hash % bound;
}

function removalRef(resolved) {
  const { placement } = resolved;
  return { placementId: placement.placementId, assetId: placement.assetId,
    assetVersion: placement.assetVersion, metadataVersion: placement.metadataVersion };
}

function samePlacement(existing, addition) {
  const placement = existing.placement;
  return placement.assetId === addition.assetId && placement.assetVersion === addition.assetVersion
    && placement.metadataVersion === addition.metadataVersion && placement.rotation === addition.rotation
    && placement.anchor.x === addition.anchor.x && placement.anchor.y === addition.anchor.y;
}

export function planRoomSurfaces({
  room, archetype, assets, plannerVersion = ROOM_SURFACE_PLANNER_VERSION,
  scopeCells, policy = 'emptyOnly', pool = [], baseRotation = 0,
  randomRotation = false, seed = '', placementIdPrefix = 'surface.plan',
  overlapKeepPlacementIds = [],
}) {
  if (plannerVersion !== ROOM_SURFACE_PLANNER_VERSION) fail('ROOM_SURFACE_PLAN_VERSION_UNSUPPORTED', 'The Surface planner version is unsupported.', { plannerVersion, supported: ROOM_SURFACE_PLANNER_VERSION });
  if (!POLICIES.includes(policy)) fail('ROOM_SURFACE_PLAN_INVALID', 'policy must be emptyOnly or replace.', { field: 'policy', allowed: POLICIES });
  if (typeof randomRotation !== 'boolean') fail('ROOM_SURFACE_PLAN_INVALID', 'randomRotation must be boolean.', { field: 'randomRotation' });
  const rotation = normalizeRotation(baseRotation);
  const normalizedSeed = typeof seed === 'string' || Number.isSafeInteger(seed) ? String(seed) : fail('ROOM_SURFACE_PLAN_INVALID', 'seed must be a string or safe integer.', { field: 'seed' });
  const prefix = id(placementIdPrefix, 'placementIdPrefix');
  const assetMap = normalizeAssets(assets);
  const normalizedRoom = normalizeRoom(room, archetype);
  const scope = normalizeScope(scopeCells, normalizedRoom);
  const candidates = normalizePool(pool, assetMap, { baseRotation: rotation, randomRotation });
  if (!Array.isArray(overlapKeepPlacementIds)) fail('ROOM_SURFACE_PLAN_INVALID', 'overlapKeepPlacementIds must be an array.', { field: 'overlapKeepPlacementIds' });
  const keepIds = new Set(overlapKeepPlacementIds.map((value, index) => id(value, `overlapKeepPlacementIds[${index}]`)));
  if (keepIds.size !== overlapKeepPlacementIds.length) fail('ROOM_SURFACE_PLAN_INVALID', 'overlapKeepPlacementIds must not contain duplicates.', { field: 'overlapKeepPlacementIds' });

  const existing = normalizeExistingSurfacePlacements(normalizedRoom.value, assetMap);
  const existingById = new Map(existing.map(entry => [entry.placement.placementId, entry]));
  const occupancy = occupancyOf(existing);
  const touchedOverlaps = [...occupancy.entries()].filter(([key, entries]) => scope.keys.has(key) && entries.length > 1);
  if (candidates.length === 0 && touchedOverlaps.length === 0) {
    fail('ROOM_SURFACE_PLAN_INVALID', 'An empty pool is allowed only for explicit overlap repair.', { field: 'pool' });
  }
  const removalIds = new Set();
  for (const [key, entries] of touchedOverlaps) {
    const selected = entries.filter(entry => keepIds.has(entry.placement.placementId));
    if (selected.length !== 1) {
      const [x, y] = key.split(',').map(Number);
      fail(selected.length === 0 ? 'ROOM_SURFACE_OVERLAP_REQUIRES_KEEP' : 'ROOM_SURFACE_OVERLAP_KEEP_INVALID',
        'Choose exactly one existing Surface to keep for every touched overlap.',
        { cell: { x, y }, placementIds: entries.map(entry => entry.placement.placementId).sort() });
    }
    for (const entry of entries) if (entry !== selected[0]) removalIds.add(entry.placement.placementId);
  }
  for (const keepId of keepIds) {
    if (!existingById.has(keepId) || !touchedOverlaps.some(([, entries]) => entries.some(entry => entry.placement.placementId === keepId))) {
      fail('ROOM_SURFACE_OVERLAP_KEEP_INVALID', 'Every keep ID must identify a Surface in a touched overlap.', { placementId: keepId });
    }
  }
  for (const placementId of removalIds) {
    const outside = existingById.get(placementId).cells.filter(cell => !scope.keys.has(cellKey(cell)));
    if (outside.length) fail('ROOM_SURFACE_PARTIAL_REPLACEMENT', 'Overlap repair cannot remove only part of a Surface footprint.', { placementId, outsideScopeCells: outside.sort(compareCell) });
  }

  const removals = new Map([...removalIds].map(placementId => [placementId, existingById.get(placementId)]));
  const effectiveExisting = existing.filter(entry => !removalIds.has(entry.placement.placementId));
  const effectiveOccupancy = occupancyOf(effectiveExisting);
  const additions = [];
  const noOpCells = new Set();
  const retainedCells = new Set();
  const replacedCells = new Set();
  const filledCells = new Set();
  for (const entry of removals.values()) for (const cell of entry.cells) replacedCells.add(cellKey(cell));

  if (candidates.length) {
    const footprint = rotatedSpan(candidates[0].eligibility.span, candidates[0].eligibility.orientations[0]);
    const anchors = scope.cells.filter(cell => (cell.x - normalizedRoom.usable.x) % footprint.width === 0
      && (cell.y - normalizedRoom.usable.y) % footprint.height === 0);
    const covered = new Set();
    for (const anchor of anchors) {
      const cells = footprintCells(anchor, footprint);
      if (cells.some(cell => !scope.keys.has(cellKey(cell)))) continue;
      for (const cell of cells) covered.add(cellKey(cell));
      const candidate = candidates[seededIndex(normalizedSeed, `asset:${cellKey(anchor)}`, candidates.length)];
      const orientations = candidate.eligibility.orientations;
      const selectedRotation = orientations[seededIndex(normalizedSeed, `rotation:${cellKey(anchor)}:${pinKey(candidate.pin)}`, orientations.length)];
      const selectedSpan = rotatedSpan(candidate.eligibility.span, selectedRotation);
      if (selectedSpan.width !== footprint.width || selectedSpan.height !== footprint.height) fail('ROOM_SURFACE_POOL_INCOMPATIBLE', 'The selected rotation changed the planned footprint class.', { pin: candidate.pin, selectedRotation });
      const atBoundary = anchor.x === normalizedRoom.usable.x || anchor.y === normalizedRoom.usable.y
        || anchor.x + footprint.width === normalizedRoom.usable.x + normalizedRoom.usable.width
        || anchor.y + footprint.height === normalizedRoom.usable.y + normalizedRoom.usable.height;
      if (atBoundary && candidate.asset.metadata.placement?.wallSafe !== true) fail('ROOM_SURFACE_ASSET_INELIGIBLE', 'A selected Surface is not authored as safe at this usable-domain boundary.', { ...candidate.pin, anchor });
      const occupying = new Map();
      for (const cell of cells) for (const entry of effectiveOccupancy.get(cellKey(cell)) ?? []) occupying.set(entry.placement.placementId, entry);
      if (policy === 'emptyOnly' && occupying.size) {
        const occupiedKeys = new Set([...occupying.values()].flatMap(entry => entry.cells.map(cellKey)));
        const unfilled = cells.filter(cell => !occupiedKeys.has(cellKey(cell)));
        if (unfilled.length) fail('ROOM_SURFACE_SCOPE_NOT_TILEABLE', 'A complete Surface footprint cannot fill only the empty part beside an existing Surface.', { footprint, anchor, cells: unfilled });
        for (const cell of cells) retainedCells.add(cellKey(cell));
        continue;
      }
      const addition = { placementId: `${prefix}.${anchor.y}.${anchor.x}`, ...candidate.pin,
        layer: 'STRUCTURAL_SURFACE', anchor: { ...anchor }, rotation: selectedRotation,
        variantTag: null, proposalId: null, proposalItemId: null };
      if (occupying.size === 1 && samePlacement([...occupying.values()][0], addition)) {
        for (const cell of cells) noOpCells.add(cellKey(cell));
        continue;
      }
      for (const entry of occupying.values()) {
        const outside = entry.cells.filter(cell => !scope.keys.has(cellKey(cell)));
        if (outside.length) fail('ROOM_SURFACE_PARTIAL_REPLACEMENT', 'Replacement cannot remove only part of an existing Surface footprint.', { placementId: entry.placement.placementId, outsideScopeCells: outside.sort(compareCell) });
        removals.set(entry.placement.placementId, entry);
        for (const cell of entry.cells) replacedCells.add(cellKey(cell));
      }
      additions.push(addition);
      for (const cell of cells) (occupying.size ? replacedCells : filledCells).add(cellKey(cell));
    }
    const uncovered = scope.cells.filter(cell => !covered.has(cellKey(cell)));
    if (uncovered.length) fail('ROOM_SURFACE_SCOPE_NOT_TILEABLE', 'The selected scope cannot be covered by complete aligned Surface footprints.', { footprint, usableOrigin: { x: normalizedRoom.usable.x, y: normalizedRoom.usable.y }, cells: uncovered });
  }

  const removedIds = new Set(removals.keys());
  const finalPlacementIds = new Set(normalizedRoom.value.placements.filter(placement => !removedIds.has(placement.placementId)).map(placement => placement.placementId));
  for (const addition of additions) {
    if (finalPlacementIds.has(addition.placementId)) fail('ROOM_SURFACE_PLACEMENT_ID_CONFLICT', 'A deterministic Surface placement ID already exists.', { placementId: addition.placementId });
    finalPlacementIds.add(addition.placementId);
  }
  const finalCount = normalizedRoom.value.placements.length - removals.size + additions.length;
  if (finalCount > MAX_PLACEMENTS) fail('ROOM_SURFACE_CAPACITY_EXCEEDED', 'The Surface plan would exceed the Room placement limit.', { currentCount: normalizedRoom.value.placements.length, removals: removals.size, additions: additions.length, finalCount, maxPlacements: MAX_PLACEMENTS });

  const unaffected = existing.filter(entry => !removedIds.has(entry.placement.placementId));
  const planned = additions.map(placement => ({ placement, cells: footprintCells(placement.anchor, rotatedSpan(assetMap.get(pinKey(placement)).metadata.spanTiles, placement.rotation)) }));
  const finalOccupancy = occupancyOf([...unaffected, ...planned]);
  for (const [key, entries] of finalOccupancy) {
    if (entries.length > 1 && scope.keys.has(key)) {
      const [x, y] = key.split(',').map(Number);
      fail('ROOM_SURFACE_OPERATION_OVERLAP', 'The Surface plan would leave or create an overlap in its scope.', { cell: { x, y }, placementIds: entries.map(entry => entry.placement.placementId).sort() });
    }
  }

  const removalList = [...removals.values()].sort((left, right) => left.placement.placementId.localeCompare(right.placement.placementId)).map(removalRef);
  additions.sort((left, right) => compareCell(left.anchor, right.anchor) || left.placementId.localeCompare(right.placementId));
  const affectedKeys = new Set([...filledCells, ...replacedCells]);
  for (const entry of removals.values()) for (const cell of entry.cells) affectedKeys.add(cellKey(cell));
  const affectedCells = [...affectedKeys].map(key => {
    const [x, y] = key.split(',').map(Number); return { x, y };
  }).sort(compareCell);
  const core = {
    plannerVersion: ROOM_SURFACE_PLANNER_VERSION,
    roomVariantId: id(normalizedRoom.value.roomVariantId, 'room.roomVariantId'),
    roomVersion: integer(normalizedRoom.value.version, 'room.version', 1, Number.MAX_SAFE_INTEGER),
    seed: normalizedSeed,
    policy,
    scopeCells: scope.cells,
    affectedCells,
    counts: {
      emptyCellsFilled: filledCells.size,
      existingCellsReplaced: replacedCells.size,
      existingCellsRetained: retainedCells.size,
      noOpCells: noOpCells.size,
      removals: removalList.length,
      additions: additions.length,
      finalPlacements: finalCount,
    },
    removals: removalList,
    additions,
    noOp: removalList.length === 0 && additions.length === 0,
  };
  return Object.freeze({ ...core, fingerprint: portableFingerprint(core) });
}
