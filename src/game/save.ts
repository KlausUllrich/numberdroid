import { BODIES, MAX_META_ENERGY, STARTING_HP } from "./catalog";
import { CURRENT_FLOOR, getFloor } from "./floors";
import type { BodyId, EnemyId, FloorDefinition, MetaState } from "./types";

const META_KEY_V3 = "numberdroid-meta-v3";
const META_KEY_V2 = "numberdroid-meta-v2";
const LEGACY_META_KEY = "zahlenkern-meta-v1";
const LEGACY_DUEL_KEY = "zahlenkern-save-v6";

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

export function createFloorState(floor: FloorDefinition, playerCount = 2): MetaState {
  return {
    version: 3,
    floorId: floor.id,
    x: floor.start.x,
    y: floor.start.y,
    facing: floor.start.facing,
    metaEnergy: floor.start.metaEnergy,
    usedStationIds: [],
    currentBody: floor.start.bodyId,
    defeatedEncounterIds: [],
    pilotIndex: 0,
    playerCount,
    damageTaken: 0,
  };
}

export const DEFAULT_META: MetaState = createFloorState(CURRENT_FLOOR);

function inRect(x: number, y: number, r: { x: number; y: number; w: number; h: number }, margin = 0) {
  return x >= r.x + margin && x <= r.x + r.w - margin && y >= r.y + margin && y <= r.y + r.h - margin;
}

export function pointWalkable(x: number, y: number, floorId = CURRENT_FLOOR.id) {
  const floor = getFloor(floorId);
  const onFloor = floor.walkable.some((rect) => inRect(x, y, rect, 24));
  const blocked = floor.obstacles.some((rect) => inRect(x, y, rect, -24));
  return onFloor && !blocked;
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

function sanitize(candidate: Partial<MetaState>): MetaState {
  const floor = getFloor(typeof candidate.floorId === "string" ? candidate.floorId : CURRENT_FLOOR.id);
  const defaults = createFloorState(floor);
  const state: MetaState = { ...defaults, ...candidate, version: 3, floorId: floor.id };

  if (!Number.isFinite(state.x) || !Number.isFinite(state.y) || !pointWalkable(state.x, state.y, floor.id)) {
    state.x = defaults.x;
    state.y = defaults.y;
    state.facing = defaults.facing;
  }
  if (!Number.isFinite(state.facing)) state.facing = defaults.facing;
  state.metaEnergy = Math.max(0, Math.min(MAX_META_ENERGY, Number.isFinite(state.metaEnergy) ? state.metaEnergy : defaults.metaEnergy));
  if (!BODIES[state.currentBody]) state.currentBody = defaults.currentBody;

  const validStationIds = new Set(floor.energyStations.map((station) => station.id));
  state.usedStationIds = Array.isArray(state.usedStationIds)
    ? [...new Set(state.usedStationIds.filter((id) => typeof id === "string" && validStationIds.has(id)))]
    : [];

  const validEncounterIds = new Set(floor.encounters.map((encounter) => encounter.encounterId));
  state.defeatedEncounterIds = Array.isArray(state.defeatedEncounterIds)
    ? [...new Set(state.defeatedEncounterIds.filter((id) => typeof id === "string" && validEncounterIds.has(id)))]
    : [];

  // On a floor with exactly one matching body encounter, owning that non-start body
  // proves that encounter was already defeated. Floors with duplicate bodies keep
  // explicit encounter-instance state only and do not infer which copy was defeated.
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
    currentBody: old.currentBody,
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
      // Keep the old v2 value as a migration fallback until v3 has had wider runtime validation.
      return migrated;
    }
  } catch { /* ignore damaged v2 data */ }

  // One-way migration from the DOM-bridge prototype.
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

  return { ...DEFAULT_META, usedStationIds: [], defeatedEncounterIds: [] };
}

export function saveMetaState(state: MetaState) {
  try {
    localStorage.setItem(META_KEY_V3, JSON.stringify(state));
  } catch { /* storage may be unavailable in private/sandboxed contexts */ }
}
