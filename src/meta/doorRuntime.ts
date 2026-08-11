import type { DoorDefinition, FloorDefinition, MetaState, Rect } from "../game/types";

export const DOOR_CLOSE_HYSTERESIS = 42;

function inRect(x: number, y: number, rect: Rect, margin = 0) {
  return x >= rect.x - margin && x <= rect.x + rect.w + margin && y >= rect.y - margin && y <= rect.y + rect.h + margin;
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

export function hasDoorAccess(
  floor: FloorDefinition,
  state: Pick<MetaState, "collectedPickupIds">,
  door: DoorDefinition,
) {
  if (door.mode === "auto") return true;
  if (!door.keyId) return false;
  return floor.pickups.some(
    (pickup) => pickup.keyId === door.keyId && state.collectedPickupIds.includes(pickup.id),
  );
}

export function nextAutomaticDoorIds(
  floor: FloorDefinition,
  state: Pick<MetaState, "x" | "y" | "collectedPickupIds">,
  currentlyOpen: ReadonlySet<string>,
): Set<string> {
  const next = new Set<string>();
  for (const door of floor.doors) {
    if (!hasDoorAccess(floor, state, door)) continue;
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
) {
  return floor.doors.some((door) => !openDoorIds.has(door.id) && inRect(x, y, collisionRectForDoor(door), 24));
}
