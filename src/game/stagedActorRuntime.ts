import type {
  FloorDefinition,
  FloorScriptRouteDefinition,
  FloorStagedActorDefinition,
  Point,
  ScriptedActorRunState,
} from "./types";
import type { StagedActorPresentation } from "./stagedActorCatalog";

export type StagedActorPose = Point & {
  facing: number;
  complete: boolean;
  progress: number;
};

function distance(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function routeLength(route: FloorScriptRouteDefinition) {
  let total = 0;
  for (let index = 1; index < route.points.length; index += 1) total += distance(route.points[index - 1], route.points[index]);
  if (route.loop && route.points.length > 1) total += distance(route.points[route.points.length - 1], route.points[0]);
  return total;
}

function routeSegments(route: FloorScriptRouteDefinition) {
  const segments: Array<{ from: Point; to: Point; length: number }> = [];
  for (let index = 1; index < route.points.length; index += 1) {
    const from = route.points[index - 1];
    const to = route.points[index];
    segments.push({ from, to, length: distance(from, to) });
  }
  if (route.loop && route.points.length > 1) {
    const from = route.points[route.points.length - 1];
    const to = route.points[0];
    segments.push({ from, to, length: distance(from, to) });
  }
  return segments;
}

function pointAlongRoute(route: FloorScriptRouteDefinition, travelDistance: number) {
  const segments = routeSegments(route);
  if (!segments.length) {
    const point = route.points[0] ?? { x: 0, y: 0 };
    return { ...point, facing: 0 };
  }

  let remaining = Math.max(0, travelDistance);
  for (const segment of segments) {
    if (remaining <= segment.length || segment === segments[segments.length - 1]) {
      const t = segment.length > 0 ? Math.min(1, remaining / segment.length) : 0;
      return {
        x: segment.from.x + (segment.to.x - segment.from.x) * t,
        y: segment.from.y + (segment.to.y - segment.from.y) * t,
        facing: Math.atan2(segment.to.y - segment.from.y, segment.to.x - segment.from.x) * 180 / Math.PI + 90,
      };
    }
    remaining -= segment.length;
  }

  const last = segments[segments.length - 1];
  return {
    x: last.to.x,
    y: last.to.y,
    facing: Math.atan2(last.to.y - last.from.y, last.to.x - last.from.x) * 180 / Math.PI + 90,
  };
}

function spaceCenter(floor: FloorDefinition, spaceId: string | undefined) {
  if (!spaceId) return null;
  const room = floor.rooms.find((entry) => entry.id === spaceId);
  if (!room) return null;
  return { x: room.x + room.w / 2, y: room.y + room.h / 2 };
}

/**
 * Derives a staged Actor pose from persistent semantic run state.
 * No per-frame coordinates are stored in MetaState.
 */
export function stagedActorPose(
  floor: FloorDefinition,
  actor: FloorStagedActorDefinition,
  state: ScriptedActorRunState,
  presentation: StagedActorPresentation,
  nowMs = Date.now(),
): StagedActorPose | null {
  if (!state.present) return null;

  if (state.mode === "idle" || !state.routeId) {
    const center = spaceCenter(floor, state.spaceId ?? actor.defaultSpaceId);
    if (!center) return null;
    return { ...center, facing: 0, complete: false, progress: 0 };
  }

  const route = floor.script?.routes.find((entry) => entry.id === state.routeId);
  if (!route || !route.points.length) return null;

  const total = routeLength(route);
  if (total <= 0) {
    const first = route.points[0];
    return { ...first, facing: 0, complete: state.mode === "passby", progress: 1 };
  }

  const startedAtMs = Number.isFinite(state.startedAtMs) ? Number(state.startedAtMs) : nowMs;
  const activeNowMs = Number.isFinite(state.pausedAtMs) ? Number(state.pausedAtMs) : nowMs;
  const elapsedMs = Math.max(0, activeNowMs - startedAtMs);

  if (state.mode === "passby") {
    const durationMs = state.durationMs && state.durationMs > 0
      ? state.durationMs
      : total / Math.max(1, presentation.speedPxPerSecond) * 1000;
    const progress = Math.min(1, elapsedMs / Math.max(1, durationMs));
    const point = pointAlongRoute(route, total * progress);
    return { ...point, complete: progress >= 1, progress };
  }

  const travel = elapsedMs / 1000 * Math.max(1, presentation.speedPxPerSecond);
  if (route.loop) {
    const wrapped = total > 0 ? travel % total : 0;
    const point = pointAlongRoute(route, wrapped);
    return { ...point, complete: false, progress: wrapped / total };
  }

  const clamped = Math.min(total, travel);
  const point = pointAlongRoute(route, clamped);
  return { ...point, complete: clamped >= total, progress: clamped / total };
}
