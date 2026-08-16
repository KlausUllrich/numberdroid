import type { CompileDiagnostic } from "./types";
import type { ConnectionGeometry, GeometryCompilePlan, GridRect, SpaceGeometry, WallSegment } from "./geometryTypes";
import type {
  ForbiddenCell,
  ForbiddenReason,
  GridCell,
  NavigationCell,
  NavigationCompilePlan,
  NavigationPortal,
  NavigationRoute,
  PortalCellPair,
  WallAttachmentSlot,
} from "./navigationTypes";

const NEIGHBOR_OFFSETS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
] as const;

function cellKey(cell: GridCell) {
  return `${cell.x},${cell.y}`;
}

function canonicalPairKey(a: GridCell, b: GridCell) {
  const first = cellKey(a);
  const second = cellKey(b);
  return first < second ? `${first}|${second}` : `${second}|${first}`;
}

function enumerateWalkableCells(geometry: GeometryCompilePlan) {
  const cells: NavigationCell[] = [];
  const seen = new Set<string>();
  for (const space of geometry.spaces) {
    for (let y = space.rect.y; y < space.rect.y + space.rect.h; y += 1) {
      for (let x = space.rect.x; x < space.rect.x + space.rect.w; x += 1) {
        const key = `${x},${y}`;
        if (seen.has(key)) throw new Error(`Navigation cell ${key} belongs to more than one compiled space.`);
        seen.add(key);
        cells.push({ x, y, spaceId: space.id });
      }
    }
  }
  return cells;
}

function portalPairForOffset(connection: ConnectionGeometry, offset: number, byCell: Map<string, NavigationCell>): PortalCellPair {
  let fromCoordinate: GridCell;
  let toCoordinate: GridCell;

  if (connection.wallOrientation === "vertical") {
    const y = connection.apertureStart + offset;
    if (connection.fromSide === "east") {
      fromCoordinate = { x: connection.boundary - 1, y };
      toCoordinate = { x: connection.boundary, y };
    } else if (connection.fromSide === "west") {
      fromCoordinate = { x: connection.boundary, y };
      toCoordinate = { x: connection.boundary - 1, y };
    } else {
      throw new Error(`Connection ${connection.id} has invalid vertical fromSide ${connection.fromSide}.`);
    }
  } else {
    const x = connection.apertureStart + offset;
    if (connection.fromSide === "south") {
      fromCoordinate = { x, y: connection.boundary - 1 };
      toCoordinate = { x, y: connection.boundary };
    } else if (connection.fromSide === "north") {
      fromCoordinate = { x, y: connection.boundary };
      toCoordinate = { x, y: connection.boundary - 1 };
    } else {
      throw new Error(`Connection ${connection.id} has invalid horizontal fromSide ${connection.fromSide}.`);
    }
  }

  const from = byCell.get(cellKey(fromCoordinate));
  const to = byCell.get(cellKey(toCoordinate));
  if (!from || from.spaceId !== connection.from) {
    throw new Error(`Connection ${connection.id} aperture does not resolve to a walkable cell inside ${connection.from}.`);
  }
  if (!to || to.spaceId !== connection.to) {
    throw new Error(`Connection ${connection.id} aperture does not resolve to a walkable cell inside ${connection.to}.`);
  }
  return { from, to };
}

function compilePortals(geometry: GeometryCompilePlan, byCell: Map<string, NavigationCell>): NavigationPortal[] {
  return geometry.connections.map((connection) => {
    const pairs = Array.from({ length: connection.apertureLength }, (_, offset) => portalPairForOffset(connection, offset, byCell));
    const centerPair = pairs[Math.floor((pairs.length - 1) / 2)];
    if (!centerPair) throw new Error(`Connection ${connection.id} has no portal cells.`);
    return {
      connectionId: connection.id,
      kind: connection.kind,
      pairs,
      centerPair,
    };
  });
}

function buildAdjacency(cells: NavigationCell[], portals: NavigationPortal[]) {
  const byCell = new Map(cells.map((cell) => [cellKey(cell), cell]));
  const portalLinks = new Set<string>();
  for (const portal of portals) {
    for (const pair of portal.pairs) portalLinks.add(canonicalPairKey(pair.from, pair.to));
  }

  const adjacency = new Map<string, string[]>();
  for (const cell of cells) {
    const key = cellKey(cell);
    const neighbors: string[] = [];
    for (const offset of NEIGHBOR_OFFSETS) {
      const coordinate = { x: cell.x + offset.x, y: cell.y + offset.y };
      const neighbor = byCell.get(cellKey(coordinate));
      if (!neighbor) continue;
      if (neighbor.spaceId === cell.spaceId || portalLinks.has(canonicalPairKey(cell, neighbor))) {
        neighbors.push(cellKey(neighbor));
      }
    }
    adjacency.set(key, neighbors);
  }
  return adjacency;
}

function centerCell(space: SpaceGeometry, byCell: Map<string, NavigationCell>) {
  const coordinate = {
    x: space.rect.x + Math.floor((space.rect.w - 1) / 2),
    y: space.rect.y + Math.floor((space.rect.h - 1) / 2),
  };
  const cell = byCell.get(cellKey(coordinate));
  if (!cell || cell.spaceId !== space.id) throw new Error(`Could not resolve center navigation cell for ${space.id}.`);
  return cell;
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

function compilePrimaryRoutes(
  geometry: GeometryCompilePlan,
  cells: NavigationCell[],
  byCell: Map<string, NavigationCell>,
  adjacency: Map<string, string[]>,
) {
  const rootSpace = geometry.spaces[0];
  if (!rootSpace) throw new Error("Navigation compiler requires at least one geometry space.");
  const root = centerCell(rootSpace, byCell);
  const routes: NavigationRoute[] = [];
  const primaryKeys = new Set<string>([cellKey(root)]);

  for (const targetSpace of geometry.spaces.slice(1)) {
    const target = centerCell(targetSpace, byCell);
    const path = shortestPath(adjacency, cellKey(root), cellKey(target));
    if (!path) throw new Error(`Navigation compiler cannot reach ${targetSpace.id} from ${rootSpace.id}.`);
    const routeCells = path.map((key) => byCell.get(key)!).filter(Boolean);
    routeCells.forEach((cell) => primaryKeys.add(cellKey(cell)));
    routes.push({
      id: `primary:${rootSpace.id}->${targetSpace.id}`,
      fromSpaceId: rootSpace.id,
      toSpaceId: targetSpace.id,
      cells: routeCells,
    });
  }

  const primaryPathCells = cells.filter((cell) => primaryKeys.has(cellKey(cell)));
  return { routes, primaryPathCells };
}

function rectIntersectsCell(rect: GridRect, cell: GridCell) {
  return cell.x < rect.x + rect.w
    && cell.x + 1 > rect.x
    && cell.y < rect.y + rect.h
    && cell.y + 1 > rect.y;
}

type MutableForbidden = NavigationCell & {
  reasons: Set<ForbiddenReason>;
  sourceIds: Set<string>;
};

function compileForbiddenCells(
  geometry: GeometryCompilePlan,
  cells: NavigationCell[],
  primaryPathCells: NavigationCell[],
) {
  const mutable = new Map<string, MutableForbidden>();
  const add = (cell: NavigationCell, reason: ForbiddenReason, sourceId: string) => {
    const key = cellKey(cell);
    const existing = mutable.get(key) ?? { ...cell, reasons: new Set<ForbiddenReason>(), sourceIds: new Set<string>() };
    existing.reasons.add(reason);
    existing.sourceIds.add(sourceId);
    mutable.set(key, existing);
  };

  for (const cell of primaryPathCells) add(cell, "primary-circulation", "primary-navigation");

  for (const connection of geometry.connections) {
    const beforeSpace = connection.from;
    const afterSpace = connection.to;
    if (connection.clearanceBefore) {
      for (const cell of cells) {
        if (cell.spaceId === beforeSpace && rectIntersectsCell(connection.clearanceBefore, cell)) {
          add(cell, "door-clearance", connection.id);
        }
      }
    }
    if (connection.clearanceAfter) {
      for (const cell of cells) {
        if (cell.spaceId === afterSpace && rectIntersectsCell(connection.clearanceAfter, cell)) {
          add(cell, "door-clearance", connection.id);
        }
      }
    }
  }

  return [...mutable.values()].map((entry): ForbiddenCell => ({
    x: entry.x,
    y: entry.y,
    spaceId: entry.spaceId,
    reasons: [...entry.reasons].sort(),
    sourceIds: [...entry.sourceIds].sort(),
  }));
}

function wallSlotForUnit(
  wall: WallSegment,
  offset: number,
  space: SpaceGeometry,
  byCell: Map<string, NavigationCell>,
  forbidden: Map<string, ForbiddenCell>,
): WallAttachmentSlot | null {
  let side: WallAttachmentSlot["side"];
  let coordinate: GridCell;

  if (wall.orientation === "horizontal") {
    const x = wall.x + offset;
    if (wall.y === space.rect.y) {
      side = "north";
      coordinate = { x, y: wall.y };
    } else if (wall.y === space.rect.y + space.rect.h) {
      side = "south";
      coordinate = { x, y: wall.y - 1 };
    } else {
      return null;
    }
  } else {
    const y = wall.y + offset;
    if (wall.x === space.rect.x) {
      side = "west";
      coordinate = { x: wall.x, y };
    } else if (wall.x === space.rect.x + space.rect.w) {
      side = "east";
      coordinate = { x: wall.x - 1, y };
    } else {
      return null;
    }
  }

  const cell = byCell.get(cellKey(coordinate));
  if (!cell || cell.spaceId !== space.id) return null;
  return {
    id: `${wall.id}:${space.id}:${offset}`,
    wallId: wall.id,
    spaceId: space.id,
    side,
    cell,
    blockedBy: forbidden.get(cellKey(cell))?.reasons ?? [],
  };
}

function compileWallAttachmentSlots(
  geometry: GeometryCompilePlan,
  byCell: Map<string, NavigationCell>,
  forbiddenCells: ForbiddenCell[],
) {
  const bySpace = new Map(geometry.spaces.map((space) => [space.id, space]));
  const forbidden = new Map(forbiddenCells.map((cell) => [cellKey(cell), cell]));
  const slots: WallAttachmentSlot[] = [];

  for (const wall of geometry.walls) {
    for (const ownerId of wall.ownerSpaceIds) {
      const space = bySpace.get(ownerId);
      if (!space) continue;
      for (let offset = 0; offset < wall.length; offset += 1) {
        const slot = wallSlotForUnit(wall, offset, space, byCell, forbidden);
        if (slot) slots.push(slot);
      }
    }
  }
  return slots;
}

function validateGlobalReachability(cells: NavigationCell[], adjacency: Map<string, string[]>) {
  const first = cells[0];
  if (!first) throw new Error("Navigation compiler requires at least one walkable cell.");
  const visited = new Set<string>([cellKey(first)]);
  const queue = [cellKey(first)];
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of adjacency.get(current) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push(next);
    }
  }
  if (visited.size !== cells.length) {
    throw new Error(`Generated navigation graph is disconnected: reached ${visited.size}/${cells.length} walkable cells.`);
  }
}

export function compileLevelNavigation(geometry: GeometryCompilePlan): NavigationCompilePlan {
  const walkableCells = enumerateWalkableCells(geometry);
  const byCell = new Map(walkableCells.map((cell) => [cellKey(cell), cell]));
  const portals = compilePortals(geometry, byCell);
  const adjacency = buildAdjacency(walkableCells, portals);
  validateGlobalReachability(walkableCells, adjacency);

  const { routes: primaryRoutes, primaryPathCells } = compilePrimaryRoutes(geometry, walkableCells, byCell, adjacency);
  const forbiddenCells = compileForbiddenCells(geometry, walkableCells, primaryPathCells);
  const wallAttachmentSlots = compileWallAttachmentSlots(geometry, byCell, forbiddenCells);

  const diagnostics: CompileDiagnostic[] = [
    ...geometry.diagnostics,
    {
      level: "info",
      code: "NAVIGATION_CONNECTED",
      message: `Generated navigation graph contains ${walkableCells.length} mutually reachable floor cells.`,
    },
    {
      level: "info",
      code: "FORBIDDEN_ZONES_COMPILED",
      message: `Reserved ${forbiddenCells.length} cells for primary circulation and/or door clearance before prop placement.`,
    },
    {
      level: "info",
      code: "WALL_SLOTS_COMPILED",
      message: `Compiled ${wallAttachmentSlots.length} wall-adjacent placement slots with blocked-state metadata.`,
    },
  ];

  return {
    geometry,
    walkableCells,
    portals,
    primaryRoutes,
    primaryPathCells,
    forbiddenCells,
    wallAttachmentSlots,
    bounds: geometry.bounds,
    diagnostics,
  };
}
