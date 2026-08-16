import { robotCollisionRadius } from "../game/catalog";
import type { DoorDefinition, FloorDefinition, MetaState, Rect } from "../game/types";

export const DOOR_CLOSE_HYSTERESIS = 42;

type DoorAccessState = Pick<MetaState, "accessKeyIds"> & {
  scriptState?: Pick<MetaState["scriptState"], "doorStates">;
};

function circleIntersectsRect(x: number, y: number, radius: number, rect: Rect) {
  const nearestX = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const nearestY = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  const dx = x - nearestX;
  const dy = y - nearestY;
  return dx * dx + dy * dy < radius * radius;
}

function doorCenter(door: DoorDefinition) {
  return { x: door.x + door.w / 2, y: door.y + door.h / 2 };
}

export function collisionRectForDoor(door: DoorDefinition): Rect {
  const slab = door.size === "large" ? 16 : 12;
  if (door.orientation === "vertical") {
    return { x: door.x + (door.w - slab) / 2, y: door.y, w: slab, h: door.h };
  }
  return { x: door.x, y: door.y + (door.h - slab) / 2, w: door.w, h: slab };
}

export function hasDoorAccess(state: DoorAccessState, door: DoorDefinition) {
  const scripted = state.scriptState?.doorStates[door.id];
  if (scripted === "unlocked") return true;
  if (scripted === "locked") return false;
  if (door.mode === "auto") return true;
  return Boolean(door.keyId && state.accessKeyIds.includes(door.keyId));
}

export function nextAutomaticDoorIds(
  floor: FloorDefinition,
  state: Pick<MetaState, "x" | "y" | "accessKeyIds"> & { scriptState?: Pick<MetaState["scriptState"], "doorStates"> },
  currentlyOpen: ReadonlySet<string>,
): Set<string> {
  const next = new Set<string>();
  for (const door of floor.doors) {
    if (!hasDoorAccess(state, door)) continue;
    const center = doorCenter(door);
    const radius = door.openRadius + (currentlyOpen.has(door.id) ? DOOR_CLOSE_HYSTERESIS : 0);
    if (Math.hypot(state.x - center.x, state.y - center.y) <= radius) next.add(door.id);
  }
  return next;
}

export function sameDoorSet(a: ReadonlySet<string>, b: ReadonlySet<string>) {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

export function blockedByClosedDoor(
  floor: FloorDefinition,
  openDoorIds: ReadonlySet<string>,
  x: number,
  y: number,
  collisionRadius = robotCollisionRadius("standard"),
) {
  return floor.doors.some(
    (door) => !openDoorIds.has(door.id) && circleIntersectsRect(x, y, collisionRadius, collisionRectForDoor(door)),
  );
}
