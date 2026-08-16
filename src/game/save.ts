import { BODIES, MAX_META_ENERGY, STARTING_HP, robotCollisionRadius } from "./catalog";
import { CURRENT_FLOOR, getFloor } from "./floors";
import type { BodyId, EnemyId, FloorDefinition, MetaState, Rect, RobotDeckSize } from "./types";

const META_KEY_V3 = "numberdroid-meta-v3";
const META_KEY_V2 = "numberdroid-meta-v2";
const PROFILE_META_PREFIX = "numberdroid-meta-v3-profile:";
const LEGACY_META_KEY = "zahlenkern-meta-v1";
const LEGACY_DUEL_KEY = "zahlenkern-save-v6";
const COLLISION_BUCKET_PX = 128;

type MetaStateV2 = {
  version?: 2;
  x?: number;
  y?: number;
  facing?: number;
  metaEnergy?: number;
  stationUsed?: boolean;
  currentBody?: BodyId;
  defeated?: EnemyId[];
  pilotIndex?: number;
  playerCount?: number;
  damageTaken?: number;
};

type CollisionIndex = Map<string, Rect[]>;
const collisionIndexByFloor = new WeakMap<FloorDefinition, CollisionIndex>();

export function createFloorState(floor: FloorDefinition, playerCount = 2): MetaState {
  return {
    version: 3,
    floorId: floor.id,
    x: floor.start.x,
    y: floor.start.y,
    facing: floor.start.facing,
    metaEnergy: floor.start.metaEnergy,
    usedStationIds: [],
    collectedPickupIds: [],
    accessKeyIds: [],
    completedActionIds: [],
    currentBody: floor.start.bodyId,
    currentDeckSize: "standard",
    defeatedEncounterIds: [],
    pilotIndex: 0,
    playerCount,
    damageTaken: 0,
  };
}

export const DEFAULT_META: MetaState = createFloorState(CURRENT_FLOOR);

function inRect(x: number, y: number, rect: Rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function circleIntersectsRect(x: number, y: number, radius: number, rect: Rect) {
  const nearestX = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const nearestY = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  const dx = x - nearestX;
  const dy = y - nearestY;
  return dx * dx + dy * dy < radius * radius;
}

function bucketKey(x: number, y: number) {
  return `${x},${y}`;
}

function collisionIndex(floor: FloorDefinition) {
  const cached = collisionIndexByFloor.get(floor);
  if (cached) return cached;

  const index: CollisionIndex = new Map();
  for (const rect of floor.obstacles) {
    const minX = Math.floor(rect.x / COLLISION_BUCKET_PX);
    const maxX = Math.floor((rect.x + rect.w) / COLLISION_BUCKET_PX);
    const minY = Math.floor(rect.y / COLLISION_BUCKET_PX);
    const maxY = Math.floor((rect.y + rect.h) / COLLISION_BUCKET_PX);
    for (let by = minY; by <= maxY; by += 1) {
      for (let bx = minX; bx <= maxX; bx += 1) {
        const key = bucketKey(bx, by);
        const bucket = index.get(key) ?? [];
        bucket.push(rect);
        index.set(key, bucket);
      }
    }
  }
  collisionIndexByFloor.set(floor, index);
  return index;
}

function nearbyObstacles(floor: FloorDefinition, x: number, y: number, radius: number) {
  if (floor.obstacles.length <= 12) return floor.obstacles;
  const index = collisionIndex(floor);
  const minX = Math.floor((x - radius) / COLLISION_BUCKET_PX);
  const maxX = Math.floor((x + radius) / COLLISION_BUCKET_PX);
  const minY = Math.floor((y - radius) / COLLISION_BUCKET_PX);
  const maxY = Math.floor((y + radius) / COLLISION_BUCKET_PX);
  const unique = new Set<Rect>();
  for (let by = minY; by <= maxY; by += 1) {
    for (let bx = minX; bx <= maxX; bx += 1) {
      for (const rect of index.get(bucketKey(bx, by)) ?? []) unique.add(rect);
    }
  }
  return unique;
}

function footprintInsideWalkable(floor: FloorDefinition, x: number, y: number, radius: number) {
  const samples = 16;
  for (let i = 0; i < samples; i += 1) {
    const angle = i / samples * Math.PI * 2;
    const sx = x + Math.cos(angle) * radius;
    const sy = y + Math.sin(angle) * radius;
    if (!floor.walkable.some((rect) => inRect(sx, sy, rect))) return false;
  }
  return floor.walkable.some((rect) => inRect(x, y, rect));
}

export function pointWalkable(
  x: number,
  y: number,
  floorId = CURRENT_FLOOR.id,
  collisionRadius = robotCollisionRadius("standard"),
) {
  const floor = getFloor(floorId);
  const onFloor = footprintInsideWalkable(floor, x, y, collisionRadius);
  if (!onFloor) return false;
  const blocked = Array.from(nearbyObstacles(floor, x, y, collisionRadius))
    .some((rect) => circleIntersectsRect(x, y, collisionRadius, rect));
  return !blocked;
}

function inferDefeatedEncounterFromOwnedBody(state: MetaState, floor: FloorDefinition) {
  if (state.currentBody === floor.start.bodyId) return;
  const matchingEncounters = floor.encounters.filter((encounter) => encounter.bodyId === state.currentBody);
  if (matchingEncounters.length !== 1) return;
  const encounterId = matchingEncounters[0].encounterId;
  if (!state.defeatedEncounterIds.includes(encounterId)) {
    state.defeatedEncounterIds = [...state.defeatedEncounterIds, encounterId];
  }
}

function validDeckSize(value: unknown): value is RobotDeckSize {
  return value === "standard" || value === "large";
}

function sanitize(candidate: Partial<MetaState>): MetaState {
  const floor = getFloor(typeof candidate.floorId === "string" ? candidate.floorId : CURRENT_FLOOR.id);
  const defaults = createFloorState(floor);
  const state: MetaState = { ...defaults, ...candidate, version: 3, floorId: floor.id };

  if (!BODIES[state.currentBody]) state.currentBody = defaults.currentBody;
  if (!validDeckSize(state.currentDeckSize)) state.currentDeckSize = defaults.currentDeckSize;

  const radius = robotCollisionRadius(state.currentDeckSize);
  if (!Number.isFinite(state.x) || !Number.isFinite(state.y) || !pointWalkable(state.x, state.y, floor.id, radius)) {
    state.x = defaults.x;
    state.y = defaults.y;
    state.facing = defaults.facing;
    state.currentDeckSize = defaults.currentDeckSize;
  }
  if (!Number.isFinite(state.facing)) state.facing = defaults.facing;
  state.metaEnergy = Math.max(0, Math.min(MAX_META_ENERGY, Number.isFinite(state.metaEnergy) ? state.metaEnergy : defaults.metaEnergy));

  const validStationIds = new Set(floor.energyStations.map((station) => station.id));
  state.usedStationIds = Array.isArray(state.usedStationIds)
    ? [...new Set(state.usedStationIds.filter((id) => typeof id === "string" && validStationIds.has(id)))]
    : [];

  const validPickupIds = new Set(floor.pickups.map((pickup) => pickup.id));
  state.collectedPickupIds = Array.isArray(state.collectedPickupIds)
    ? [...new Set(state.collectedPickupIds.filter((id) => typeof id === "string" && validPickupIds.has(id)))]
    : [];

  const validAccessKeyIds = new Set<string>();
  floor.doors.forEach((door) => { if (door.keyId) validAccessKeyIds.add(door.keyId); });
  floor.pickups.forEach((pickup) => validAccessKeyIds.add(pickup.keyId));
  floor.encounters.forEach((encounter) => { if (encounter.accessKey) validAccessKeyIds.add(encounter.accessKey.keyId); });
  state.accessKeyIds = Array.isArray(state.accessKeyIds)
    ? [...new Set(state.accessKeyIds.filter((id) => typeof id === "string" && validAccessKeyIds.has(id)))]
    : [];

  for (const pickupId of state.collectedPickupIds) {
    const pickup = floor.pickups.find((entry) => entry.id === pickupId);
    if (pickup && !state.accessKeyIds.includes(pickup.keyId)) state.accessKeyIds.push(pickup.keyId);
  }

  const validActionIds = new Set(floor.actions.map((action) => action.id));
  state.completedActionIds = Array.isArray(state.completedActionIds)
    ? [...new Set(state.completedActionIds.filter((id) => typeof id === "string" && validActionIds.has(id)))]
    : [];

  const validEncounterIds = new Set(floor.encounters.map((encounter) => encounter.encounterId));
  state.defeatedEncounterIds = Array.isArray(state.defeatedEncounterIds)
    ? [...new Set(state.defeatedEncounterIds.filter((id) => typeof id === "string" && validEncounterIds.has(id)))]
    : [];

  inferDefeatedEncounterFromOwnedBody(state, floor);

  state.playerCount = Math.max(1, Math.min(4, Number.isFinite(state.playerCount) ? state.playerCount : defaults.playerCount));
  state.pilotIndex = Math.max(0, Number.isFinite(state.pilotIndex) ? state.pilotIndex : 0) % state.playerCount;
  state.damageTaken = Math.max(0, Math.min(STARTING_HP, Number.isFinite(state.damageTaken) ? state.damageTaken : 0));
  return state;
}

function migrateV2(old: MetaStateV2): MetaState {
  const floor = CURRENT_FLOOR;
  const defeatedEnemyIds = Array.isArray(old.defeated) ? old.defeated : [];
  return sanitize({
    floorId: floor.id,
    x: old.x,
    y: old.y,
    facing: old.facing,
    metaEnergy: old.metaEnergy,
    usedStationIds: old.stationUsed ? floor.energyStations.slice(0, 1).map((station) => station.id) : [],
    collectedPickupIds: [],
    accessKeyIds: [],
    completedActionIds: [],
    currentBody: old.currentBody,
    currentDeckSize: "standard",
    defeatedEncounterIds: floor.encounters
      .filter((encounter) => defeatedEnemyIds.includes(encounter.enemyId))
      .map((encounter) => encounter.encounterId),
    pilotIndex: old.pilotIndex,
    playerCount: old.playerCount,
    damageTaken: old.damageTaken,
  });
}

export function restartFloorState(previous: MetaState): MetaState {
  return createFloorState(getFloor(previous.floorId), previous.playerCount);
}

export function loadMetaState(): MetaState {
  try {
    const raw = localStorage.getItem(META_KEY_V3);
    if (raw) return sanitize(JSON.parse(raw));
  } catch { /* ignore damaged v3 data */ }

  try {
    const raw = localStorage.getItem(META_KEY_V2);
    if (raw) {
      const migrated = migrateV2(JSON.parse(raw) as MetaStateV2);
      saveMetaState(migrated);
      return migrated;
    }
  } catch { /* ignore damaged v2 data */ }

  try {
    const raw = localStorage.getItem(LEGACY_META_KEY);
    if (raw) {
      const old = JSON.parse(raw) as MetaStateV2 & { pendingBattle?: unknown };
      const migrated = migrateV2({ ...old, damageTaken: 0 });
      saveMetaState(migrated);
      return migrated;
    }
  } catch { /* ignore damaged legacy meta data */ }

  try {
    const duel = JSON.parse(localStorage.getItem(LEGACY_DUEL_KEY) || "null") as { playerCount?: number } | null;
    if (duel?.playerCount) return sanitize({ playerCount: duel.playerCount });
  } catch { /* ignore damaged legacy duel data */ }

  return {
    ...DEFAULT_META,
    usedStationIds: [],
    collectedPickupIds: [],
    accessKeyIds: [],
    completedActionIds: [],
    defeatedEncounterIds: [],
  };
}

export function saveMetaState(state: MetaState) {
  try {
    localStorage.setItem(META_KEY_V3, JSON.stringify(state));
  } catch { /* storage may be unavailable in private/sandboxed contexts */ }
}

function profileMetaKey(profileId: string) {
  return `${PROFILE_META_PREFIX}${profileId}`;
}

export function loadProfileMetaState(profileId: string, migrateLegacy = false): MetaState | null {
  try {
    const raw = localStorage.getItem(profileMetaKey(profileId));
    if (raw) return sanitize(JSON.parse(raw));
  } catch { /* ignore damaged profile run */ }

  if (!migrateLegacy) return null;
  const legacy = loadMetaState();
  saveProfileMetaState(profileId, legacy);
  return legacy;
}

export function saveProfileMetaState(profileId: string, state: MetaState) {
  try {
    localStorage.setItem(profileMetaKey(profileId), JSON.stringify(sanitize(state)));
  } catch { /* storage may be unavailable in private/sandboxed contexts */ }
}

export function clearProfileMetaState(profileId: string) {
  try {
    localStorage.removeItem(profileMetaKey(profileId));
  } catch { /* storage may be unavailable in private/sandboxed contexts */ }
}
