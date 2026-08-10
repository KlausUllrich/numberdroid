import { BODIES, ENCOUNTER_IDS, MAX_META_ENERGY, STARTING_HP } from "./catalog";
import { CURRENT_FLOOR } from "./floors";
import type { EnemyId, MetaState } from "./types";

const META_KEY_V2 = "numberdroid-meta-v2";
const LEGACY_META_KEY = "zahlenkern-meta-v1";
const LEGACY_DUEL_KEY = "zahlenkern-save-v6";

export const DEFAULT_META: MetaState = {
  version: 2,
  x: CURRENT_FLOOR.start.x,
  y: CURRENT_FLOOR.start.y,
  facing: CURRENT_FLOOR.start.facing,
  metaEnergy: CURRENT_FLOOR.start.metaEnergy,
  stationUsed: false,
  currentBody: CURRENT_FLOOR.start.bodyId,
  defeated: [],
  pilotIndex: 0,
  playerCount: 2,
  damageTaken: 0,
};

function inRect(x: number, y: number, r: { x: number; y: number; w: number; h: number }, margin = 0) {
  return x >= r.x + margin && x <= r.x + r.w - margin && y >= r.y + margin && y <= r.y + r.h - margin;
}

export function pointWalkable(x: number, y: number) {
  const onFloor = CURRENT_FLOOR.walkable.some((rect) => inRect(x, y, rect, 24));
  const blocked = CURRENT_FLOOR.obstacles.some((rect) => inRect(x, y, rect, -24));
  return onFloor && !blocked;
}

function sanitize(candidate: Partial<MetaState>): MetaState {
  const state: MetaState = { ...DEFAULT_META, ...candidate, version: 2 };
  if (!Number.isFinite(state.x) || !Number.isFinite(state.y) || !pointWalkable(state.x, state.y)) {
    state.x = DEFAULT_META.x;
    state.y = DEFAULT_META.y;
    state.facing = DEFAULT_META.facing;
  }
  if (!Number.isFinite(state.facing)) state.facing = 0;
  state.metaEnergy = Math.max(0, Math.min(MAX_META_ENERGY, Number.isFinite(state.metaEnergy) ? state.metaEnergy : 0));
  if (!BODIES[state.currentBody]) state.currentBody = CURRENT_FLOOR.start.bodyId;
  state.defeated = Array.isArray(state.defeated)
    ? state.defeated.filter((id): id is EnemyId => ENCOUNTER_IDS.includes(id as EnemyId))
    : [];
  state.playerCount = Math.max(1, Math.min(4, Number.isFinite(state.playerCount) ? state.playerCount : 2));
  state.pilotIndex = Math.max(0, Number.isFinite(state.pilotIndex) ? state.pilotIndex : 0) % state.playerCount;
  state.damageTaken = Math.max(0, Math.min(STARTING_HP, Number.isFinite(state.damageTaken) ? state.damageTaken : 0));
  return state;
}

export function restartFloorState(previous: MetaState): MetaState {
  return {
    ...DEFAULT_META,
    playerCount: previous.playerCount,
  };
}

export function loadMetaState(): MetaState {
  try {
    const raw = localStorage.getItem(META_KEY_V2);
    if (raw) return sanitize(JSON.parse(raw));
  } catch { /* ignore damaged v2 data */ }

  // One-way migration from the DOM-bridge prototype.
  try {
    const raw = localStorage.getItem(LEGACY_META_KEY);
    if (raw) {
      const old = JSON.parse(raw) as Partial<MetaState> & { pendingBattle?: unknown };
      const migrated = sanitize({
        x: old.x,
        y: old.y,
        facing: old.facing,
        metaEnergy: old.metaEnergy,
        stationUsed: old.stationUsed,
        currentBody: old.currentBody,
        defeated: old.defeated,
        pilotIndex: old.pilotIndex,
        playerCount: old.playerCount,
        damageTaken: 0,
      });
      saveMetaState(migrated);
      return migrated;
    }
  } catch { /* ignore damaged legacy meta data */ }

  try {
    const duel = JSON.parse(localStorage.getItem(LEGACY_DUEL_KEY) || "null") as { playerCount?: number } | null;
    if (duel?.playerCount) return sanitize({ playerCount: duel.playerCount });
  } catch { /* ignore damaged legacy duel data */ }

  return { ...DEFAULT_META };
}

export function saveMetaState(state: MetaState) {
  try {
    localStorage.setItem(META_KEY_V2, JSON.stringify(state));
  } catch { /* storage may be unavailable in private/sandboxed contexts */ }
}
