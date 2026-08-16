import { deriveSubSeed, seededUnit } from "./seed";
import type { CardinalDirection, CompiledEncounterIntent, RouteSpec } from "./types";
import type { GridCell, NavigationCell, NavigationPortal } from "./navigationTypes";
import type { OrientedPropPlacementPlan } from "./orientedPlacement";
import type { ActorPlacementDecision, ActorPlacementPlan, ActorRouteGeometry } from "./actorPlacementTypes";

const NEIGHBORS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
] as const;

function cellKey(cell: GridCell) {
  return `${cell.x},${cell.y}`;
}

function canonicalPairKey(a: GridCell, b: GridCell) {
  const ak = cellKey(a);
  const bk = cellKey(b);
  return ak < bk ? `${ak}|${bk}` : `${bk}|${ak}`;
}

function manhattan(a: GridCell, b: GridCell) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function freeCellKeys(props: OrientedPropPlacementPlan) {
  const blocked = new Set<string>();
  for (const cell of props.occupiedCells) blocked.add(cellKey(cell));
  for (const reservation of props.reservations) blocked.add(cellKey(reservation));
  for (const cell of props.navigation.forbiddenCells) {
    if (cell.reasons.includes("door-clearance")) blocked.add(cellKey(cell));
  }
  return new Set(props.navigation.walkableCells.filter((cell) => !blocked.has(cellKey(cell))).map(cellKey));
}

function portalLinks(portals: NavigationPortal[]) {
  const links = new Set<string>();
  for (const portal of portals) {
    for (const pair of portal.pairs) links.add(canonicalPairKey(pair.from, pair.to));
  }
  return links;
}

function buildAdjacency(
  cells: NavigationCell[],
  allowedKeys: Set<string>,
  portals: NavigationPortal[],
) {
  const byKey = new Map(cells.map((cell) => [cellKey(cell), cell]));
  const links = portalLinks(portals);
  const adjacency = new Map<string, string[]>();

  for (const cell of cells) {
    const key = cellKey(cell);
    if (!allowedKeys.has(key)) continue;
    const neighbors: string[] = [];
    for (const delta of NEIGHBORS) {
      const other = byKey.get(`${cell.x + delta.x},${cell.y + delta.y}`);
      if (!other) continue;
      const otherKey = cellKey(other);
      if (!allowedKeys.has(otherKey)) continue;
      if (other.spaceId === cell.spaceId || links.has(canonicalPairKey(cell, other))) neighbors.push(otherKey);
    }
    adjacency.set(key, neighbors);
  }
  return { adjacency, byKey };
}

function shortestPath(adjacency: Map<string, string[]>, start: string, goal: string) {
  if (start === goal) return [start];
  const queue = [start];
  const previous = new Map<string, string | null>([[start, null]]);
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of adjacency.get(current) ?? []) {
      if (previous.has(next)) continue;
      previous.set(next, current);
      if (next === goal) {
        const path: string[] = [];
        let cursor: string | null = goal;
        while (cursor) {
          path.push(cursor);
          cursor = previous.get(cursor) ?? null;
        }
        return path.reverse();
      }
      queue.push(next);
    }
  }
  return null;
}

function nearestToCenter(cells: NavigationCell[], rect: { x: number; y: number; w: number; h: number }) {
  const center = { x: rect.x + (rect.w - 1) / 2, y: rect.y + (rect.h - 1) / 2 };
  return [...cells].sort((a, b) => {
    const ad = Math.abs(a.x - center.x) + Math.abs(a.y - center.y);
    const bd = Math.abs(b.x - center.x) + Math.abs(b.y - center.y);
    return ad - bd || a.y - b.y || a.x - b.x;
  })[0];
}

function extremeAnchors(cells: NavigationCell[]) {
  if (!cells.length) return [];
  const selectors = [
    (cell: NavigationCell) => cell.x + cell.y,
    (cell: NavigationCell) => -cell.x + cell.y,
    (cell: NavigationCell) => -cell.x - cell.y,
    (cell: NavigationCell) => cell.x - cell.y,
  ];
  const result: NavigationCell[] = [];
  for (const value of selectors) {
    const chosen = [...cells].sort((a, b) => value(a) - value(b) || a.y - b.y || a.x - b.x)[0];
    if (chosen && !result.some((entry) => cellKey(entry) === cellKey(chosen))) result.push(chosen);
  }
  return result;
}

function appendPath(target: NavigationCell[], path: NavigationCell[]) {
  for (const cell of path) {
    if (target.length && cellKey(target[target.length - 1]) === cellKey(cell)) continue;
    target.push(cell);
  }
}

function compileRoute(
  route: RouteSpec,
  props: OrientedPropPlacementPlan,
  freeKeys: Set<string>,
): ActorRouteGeometry {
  const navigation = props.navigation;
  const spaceIds = new Set(route.spaceIds);
  const allowedKeys = new Set(
    navigation.walkableCells
      .filter((cell) => spaceIds.has(cell.spaceId) && freeKeys.has(cellKey(cell)))
      .map(cellKey),
  );
  if (!allowedKeys.size) throw new Error(`Actor route ${route.id} has no free navigation cells.`);

  const { adjacency, byKey } = buildAdjacency(navigation.walkableCells, allowedKeys, navigation.portals);
  const spaceById = new Map(navigation.geometry.spaces.map((space) => [space.id, space]));
  let anchors: NavigationCell[] = [];

  if (route.spaceIds.length === 1) {
    const candidates = navigation.walkableCells.filter((cell) => cell.spaceId === route.spaceIds[0] && allowedKeys.has(cellKey(cell)));
    if (route.kind === "patrol") {
      anchors = extremeAnchors(candidates);
      if (anchors.length < 2 && candidates.length > 1) anchors = [candidates[0], candidates[candidates.length - 1]];
    } else {
      const space = spaceById.get(route.spaceIds[0]);
      if (!space) throw new Error(`Actor route ${route.id} references missing geometry space ${route.spaceIds[0]}.`);
      const horizontal = space.rect.w >= space.rect.h;
      const sorted = [...candidates].sort((a, b) => horizontal ? a.x - b.x || a.y - b.y : a.y - b.y || a.x - b.x);
      anchors = sorted.length > 1 ? [sorted[0], sorted[sorted.length - 1]] : sorted;
    }
  } else {
    for (const spaceId of route.spaceIds) {
      const space = spaceById.get(spaceId);
      if (!space) throw new Error(`Actor route ${route.id} references missing geometry space ${spaceId}.`);
      const candidates = navigation.walkableCells.filter((cell) => cell.spaceId === spaceId && allowedKeys.has(cellKey(cell)));
      const anchor = nearestToCenter(candidates, space.rect);
      if (!anchor) throw new Error(`Actor route ${route.id} cannot find a free anchor in ${spaceId}.`);
      anchors.push(anchor);
    }
  }

  if (!anchors.length) throw new Error(`Actor route ${route.id} cannot derive route anchors.`);
  if (anchors.length === 1) return { id: route.id, kind: route.kind, cells: anchors, loop: false };

  const cells: NavigationCell[] = [];
  const segmentCount = route.loop ? anchors.length : anchors.length - 1;
  for (let index = 0; index < segmentCount; index += 1) {
    const from = anchors[index];
    const to = anchors[(index + 1) % anchors.length];
    const pathKeys = shortestPath(adjacency, cellKey(from), cellKey(to));
    if (!pathKeys) throw new Error(`Actor route ${route.id} cannot connect authored anchors ${cellKey(from)} -> ${cellKey(to)}.`);
    appendPath(cells, pathKeys.map((key) => byKey.get(key)!).filter(Boolean));
  }

  return { id: route.id, kind: route.kind, cells, loop: Boolean(route.loop) };
}

function distanceToWall(cell: NavigationCell, rect: { x: number; y: number; w: number; h: number }) {
  return Math.min(
    cell.x - rect.x,
    rect.x + rect.w - 1 - cell.x,
    cell.y - rect.y,
    rect.y + rect.h - 1 - cell.y,
  );
}

function preferredWallDistance(cell: NavigationCell, rect: { x: number; y: number; w: number; h: number }, side: CardinalDirection) {
  if (side === "north") return cell.y - rect.y;
  if (side === "south") return rect.y + rect.h - 1 - cell.y;
  if (side === "west") return cell.x - rect.x;
  return rect.x + rect.w - 1 - cell.x;
}

function portalCellsForSpace(props: OrientedPropPlacementPlan, spaceId: string) {
  return props.navigation.portals.flatMap((portal) => portal.pairs.flatMap((pair) => [pair.from, pair.to]))
    .filter((cell) => cell.spaceId === spaceId);
}

function facingToward(from: GridCell, to: GridCell) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 0 : 180;
  return dy >= 0 ? 90 : 270;
}

function actorFacing(
  encounter: CompiledEncounterIntent,
  cell: NavigationCell,
  route: ActorRouteGeometry | undefined,
  spaceRect: { x: number; y: number; w: number; h: number },
) {
  if (route && route.cells.length > 1) {
    const index = route.cells.findIndex((entry) => cellKey(entry) === cellKey(cell));
    const next = route.cells[(index + 1) % route.cells.length];
    if (next) return facingToward(cell, next);
  }
  const center = { x: spaceRect.x + (spaceRect.w - 1) / 2, y: spaceRect.y + (spaceRect.h - 1) / 2 };
  return facingToward(cell, center);
}

function actorScore(
  encounter: CompiledEncounterIntent,
  cell: NavigationCell,
  spaceRect: { x: number; y: number; w: number; h: number },
  props: OrientedPropPlacementPlan,
  route: ActorRouteGeometry | undefined,
) {
  const reasons: string[] = [];
  let score = 0;
  const wallDistance = distanceToWall(cell, spaceRect);
  const center = { x: spaceRect.x + Math.floor((spaceRect.w - 1) / 2), y: spaceRect.y + Math.floor((spaceRect.h - 1) / 2) };
  const centerDistance = manhattan(cell, center);
  const portals = portalCellsForSpace(props, encounter.spaceId);
  const portalDistance = portals.length ? Math.min(...portals.map((portal) => manhattan(cell, portal))) : 999;
  const primary = props.navigation.primaryPathCells.some((entry) => cellKey(entry) === cellKey(cell));

  if (encounter.preferredWall) {
    const distance = preferredWallDistance(cell, spaceRect, encounter.preferredWall);
    const value = Math.max(0, 45 - distance * 12);
    score += value;
    if (value) reasons.push(`preferred wall ${encounter.preferredWall}`);
  }

  if (encounter.behavior === "neutral") {
    const edgeValue = Math.max(0, 26 - wallDistance * 10);
    score += edgeValue;
    if (edgeValue) reasons.push("neutral work edge");
    if (primary) score -= 14;
  } else if (encounter.behavior === "guard") {
    const doorValue = Math.max(0, 60 - portalDistance * 10);
    score += doorValue;
    if (doorValue) reasons.push("guards threshold approach");
  } else if (encounter.behavior === "patrol") {
    if (route?.cells.some((entry) => cellKey(entry) === cellKey(cell))) {
      score += 80;
      reasons.push(`on patrol route ${route.id}`);
      const routeIndex = route.cells.findIndex((entry) => cellKey(entry) === cellKey(cell));
      score += Math.max(0, 20 - routeIndex * 0.5);
    }
  } else {
    const centerValue = Math.max(0, 42 - centerDistance * 7);
    score += centerValue;
    if (centerValue) reasons.push("aggressive open-room pressure");
    if (primary) score += 8;
  }

  score += seededUnit(deriveSubSeed(encounter.seed, `actor-candidate/${cell.x},${cell.y}`)) * 0.01;
  return { score, reasons };
}

export function compileActorPlacement(props: OrientedPropPlacementPlan): ActorPlacementPlan {
  const semantic = props.navigation.geometry.semantic;
  const freeKeys = freeCellKeys(props);
  const routes = semantic.routes.map((route) => compileRoute(route, props, freeKeys));
  const routeById = new Map(routes.map((route) => [route.id, route]));
  const allRouteCells = new Set(routes.flatMap((route) => route.cells.map(cellKey)));
  const actorOccupied = new Set<string>();
  const actors: ActorPlacementDecision[] = [];
  const diagnostics = [...props.diagnostics];
  const spaceById = new Map(props.navigation.geometry.spaces.map((space) => [space.id, space]));

  const encounters = [...semantic.encounters].sort((a, b) => {
    const ap = a.behavior === "patrol" ? 0 : 1;
    const bp = b.behavior === "patrol" ? 0 : 1;
    return ap - bp || a.id.localeCompare(b.id);
  });

  for (const encounter of encounters) {
    const space = spaceById.get(encounter.spaceId);
    if (!space) throw new Error(`Actor ${encounter.id} references missing geometry space ${encounter.spaceId}.`);
    const route = encounter.patrolRouteId ? routeById.get(encounter.patrolRouteId) : undefined;
    if (encounter.behavior === "patrol" && !route) throw new Error(`Patrol actor ${encounter.id} requires compiled route ${encounter.patrolRouteId}.`);

    const rejectedCounts: Record<string, number> = {};
    const reject = (reason: string) => { rejectedCounts[reason] = (rejectedCounts[reason] ?? 0) + 1; };
    const candidates: Array<{ cell: NavigationCell; score: number; reasons: string[] }> = [];

    for (const cell of props.navigation.walkableCells) {
      if (cell.spaceId !== encounter.spaceId) continue;
      const key = cellKey(cell);
      if (!freeKeys.has(key)) { reject("furnishing-or-clearance"); continue; }
      if (actorOccupied.has(key)) { reject("actor-occupied"); continue; }
      if (encounter.behavior === "patrol") {
        if (!route?.cells.some((entry) => cellKey(entry) === key)) { reject("off-patrol-route"); continue; }
      } else if (allRouteCells.has(key)) {
        reject("reserved-actor-route");
        continue;
      }
      const scored = actorScore(encounter, cell, space.rect, props, route);
      candidates.push({ cell, ...scored });
    }

    candidates.sort((a, b) => b.score - a.score || a.cell.y - b.cell.y || a.cell.x - b.cell.x);
    const chosen = candidates[0];
    if (!chosen) {
      const summary = Object.entries(rejectedCounts).sort((a, b) => b[1] - a[1]).map(([reason, count]) => `${reason}:${count}`).join(", ") || "no free cells";
      throw new Error(`Actor ${encounter.id} could not be placed in ${encounter.spaceId} (${summary}).`);
    }

    actorOccupied.add(cellKey(chosen.cell));
    actors.push({
      id: encounter.id,
      spaceId: encounter.spaceId,
      behavior: encounter.behavior,
      cell: chosen.cell,
      facing: actorFacing(encounter, chosen.cell, route, space.rect),
      patrolRouteId: encounter.patrolRouteId,
      score: chosen.score,
      reasons: chosen.reasons.length ? chosen.reasons : ["best valid deterministic actor cell"],
      candidateCount: candidates.length,
      rejectedCounts,
    });
  }

  const occupiedActorCells = props.navigation.walkableCells.filter((cell) => actorOccupied.has(cellKey(cell)));
  diagnostics.push({
    level: "info",
    code: "ACTOR_PLACEMENT_COMPLETE",
    message: `Placed ${actors.length} actor(s) and compiled ${routes.length} authored actor route(s).`,
  });

  return { props, routes, actors, occupiedActorCells, diagnostics };
}
