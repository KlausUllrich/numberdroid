import type { EncounterBehavior, FloorDefinition, Point, Rect } from "./types";

function pointInRect(point: Point, rect: Rect, inset = 0) {
  return point.x >= rect.x + inset
    && point.x <= rect.x + rect.w - inset
    && point.y >= rect.y + inset
    && point.y <= rect.y + rect.h - inset;
}

function normalizeDegrees(value: number) {
  let next = value % 360;
  if (next > 180) next -= 360;
  if (next < -180) next += 360;
  return next;
}

export function facingTowardPoint(from: Point, to: Point) {
  return Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI + 90;
}

export function withinViewCone(from: Point, facing: number, to: Point, viewAngle: number) {
  if (viewAngle >= 359.5) return true;
  const targetFacing = facingTowardPoint(from, to);
  return Math.abs(normalizeDegrees(targetFacing - facing)) <= viewAngle / 2;
}

export function lineOfSightClear(
  floor: FloorDefinition,
  openDoorIds: Set<string>,
  from: Point,
  to: Point,
  sampleStep = 14,
) {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (length < 1) return true;
  const steps = Math.max(2, Math.ceil(length / sampleStep));

  for (let index = 1; index < steps; index += 1) {
    const t = index / steps;
    const point = {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
    };

    if (!floor.walkable.some((rect) => pointInRect(point, rect))) return false;
    if (floor.obstacles.some((rect) => pointInRect(point, rect, -1))) return false;
    if (floor.doors.some((door) => !openDoorIds.has(door.id) && pointInRect(point, door, -2))) return false;
  }

  return true;
}

export function robotCanSeePoint(
  floor: FloorDefinition,
  openDoorIds: Set<string>,
  from: Point,
  facing: number,
  to: Point,
  behavior: EncounterBehavior,
) {
  if (Math.hypot(to.x - from.x, to.y - from.y) > behavior.detectionRadius) return false;
  if (!withinViewCone(from, facing, to, behavior.viewAngle)) return false;
  return lineOfSightClear(floor, openDoorIds, from, to);
}
