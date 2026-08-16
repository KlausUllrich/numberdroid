import type { CompiledConnection, CompiledSemanticSpace, PlacementOverride, RelativeRelation, SemanticCompilePlan } from "./types";
import type {
  ConnectionGeometry,
  GeometryCompilePlan,
  GridRect,
  SpaceGeometry,
  WallOrientation,
  WallSegment,
} from "./geometryTypes";

const DEFAULT_ROOM_SIZE = {
  tiny: { w: 2, h: 3 },
  small: { w: 4, h: 4 },
  medium: { w: 7, h: 6 },
  large: { w: 9, h: 8 },
  hero: { w: 10, h: 6 },
} as const;

function opposite(side: "north" | "south" | "east" | "west") {
  if (side === "north") return "south" as const;
  if (side === "south") return "north" as const;
  if (side === "east") return "west" as const;
  return "east" as const;
}

function integerTile(value: number, context: string) {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${context} must resolve to a positive integer tile count; got ${value}.`);
  return value;
}

function preferredRangeValue(range: { preferred: number } | undefined, fallback: number, context: string) {
  return integerTile(range?.preferred ?? fallback, context);
}

function overrideFor(overrides: PlacementOverride[], targetId: string) {
  return overrides.find((entry) => entry.targetId === targetId);
}

function dimensions(space: CompiledSemanticSpace, overrides: PlacementOverride[]): { w: number; h: number } {
  const override = overrideFor(overrides, space.id);
  if (space.kind === "corridor") {
    const width = preferredRangeValue(space.width, 3, `Corridor ${space.id} width`);
    const length = preferredRangeValue(space.length, 8, `Corridor ${space.id} length`);
    const orientation = space.orientation === "horizontal" ? "horizontal" : "vertical";
    return orientation === "horizontal" ? { w: length, h: width } : { w: width, h: length };
  }

  const fallback = DEFAULT_ROOM_SIZE[space.size.class];
  const widthRange = override?.size?.width ?? space.size.width;
  const heightRange = override?.size?.height ?? space.size.height;
  return {
    w: preferredRangeValue(widthRange, fallback.w, `Room ${space.id} width`),
    h: preferredRangeValue(heightRange, fallback.h, `Room ${space.id} height`),
  };
}

function rectOverlap(a: GridRect, b: GridRect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function relationToParent(space: CompiledSemanticSpace, parentId: string): RelativeRelation | undefined {
  return space.relations?.find((relation) => relation.targetId === parentId)?.relation;
}

function sideFromRelation(relation: RelativeRelation | undefined) {
  if (!relation) return undefined;
  if (relation === "north_of" || relation === "north_east_of" || relation === "north_west_of") return "north" as const;
  if (relation === "south_of" || relation === "south_east_of" || relation === "south_west_of") return "south" as const;
  if (relation === "east_of") return "east" as const;
  if (relation === "west_of") return "west" as const;
  return undefined;
}

function connectionSide(connection: CompiledConnection, parentId: string, childId: string, relation: RelativeRelation | undefined) {
  if (connection.preferredSide) {
    if (connection.from === parentId && connection.to === childId) return connection.preferredSide;
    if (connection.to === parentId && connection.from === childId) return opposite(connection.preferredSide);
  }
  return sideFromRelation(relation) ?? "east";
}

function alignedCoordinate(parent: GridRect, childSize: { w: number; h: number }, side: "north" | "south" | "east" | "west", relation?: RelativeRelation) {
  if (side === "north" || side === "south") {
    if (relation === "north_west_of" || relation === "south_west_of") return parent.x;
    if (relation === "north_east_of" || relation === "south_east_of") return parent.x + parent.w - childSize.w;
    return parent.x + Math.floor((parent.w - childSize.w) / 2);
  }
  if (relation === "north_east_of" || relation === "north_west_of") return parent.y;
  if (relation === "south_east_of" || relation === "south_west_of") return parent.y + parent.h - childSize.h;
  return parent.y + Math.floor((parent.h - childSize.h) / 2);
}

function baseCandidate(parent: GridRect, childSize: { w: number; h: number }, side: "north" | "south" | "east" | "west", relation?: RelativeRelation): GridRect {
  if (side === "north") {
    return { x: alignedCoordinate(parent, childSize, side, relation), y: parent.y - childSize.h, ...childSize };
  }
  if (side === "south") {
    return { x: alignedCoordinate(parent, childSize, side, relation), y: parent.y + parent.h, ...childSize };
  }
  if (side === "west") {
    return { x: parent.x - childSize.w, y: alignedCoordinate(parent, childSize, side, relation), ...childSize };
  }
  return { x: parent.x + parent.w, y: alignedCoordinate(parent, childSize, side, relation), ...childSize };
}

function sharedLengthForSide(parent: GridRect, child: GridRect, side: "north" | "south" | "east" | "west") {
  if (side === "north" || side === "south") {
    return Math.max(0, Math.min(parent.x + parent.w, child.x + child.w) - Math.max(parent.x, child.x));
  }
  return Math.max(0, Math.min(parent.y + parent.h, child.y + child.h) - Math.max(parent.y, child.y));
}

function shifted(candidate: GridRect, side: "north" | "south" | "east" | "west", amount: number): GridRect {
  return side === "north" || side === "south"
    ? { ...candidate, x: candidate.x + amount }
    : { ...candidate, y: candidate.y + amount };
}

function shiftOrder(limit: number) {
  const result = [0];
  for (let value = 1; value <= limit; value += 1) result.push(-value, value);
  return result;
}

function placeChild(
  child: CompiledSemanticSpace,
  parent: SpaceGeometry,
  connection: CompiledConnection,
  existing: SpaceGeometry[],
  overrides: PlacementOverride[],
) {
  const childSize = dimensions(child, overrides);
  const relation = relationToParent(child, parent.id);
  const side = connectionSide(connection, parent.id, child.id, relation);
  const base = baseCandidate(parent.rect, childSize, side, relation);
  const requiredSharedLength = integerTile(connection.widthTiles, `Connection ${connection.id} width`);
  const limit = Math.max(parent.rect.w, parent.rect.h, childSize.w, childSize.h) + 24;

  for (const amount of shiftOrder(limit)) {
    const candidate = shifted(base, side, amount);
    if (sharedLengthForSide(parent.rect, candidate, side) < requiredSharedLength) continue;
    if (existing.some((placed) => placed.id !== parent.id && rectOverlap(candidate, placed.rect))) continue;
    return { rect: candidate, slide: amount };
  }

  throw new Error(`Geometry solver could not place ${child.id} beside ${parent.id} for connection ${connection.id}.`);
}

function normalizePlacements(spaces: SpaceGeometry[], margin = 1) {
  const minX = Math.min(...spaces.map((space) => space.rect.x));
  const minY = Math.min(...spaces.map((space) => space.rect.y));
  const dx = margin - minX;
  const dy = margin - minY;
  return spaces.map((space) => ({
    ...space,
    rect: { ...space.rect, x: space.rect.x + dx, y: space.rect.y + dy },
  }));
}

function applyOffsets(spaces: SpaceGeometry[], overrides: PlacementOverride[]) {
  return spaces.map((space) => {
    const offset = overrideFor(overrides, space.id)?.offsetTiles;
    if (!offset) return space;
    if (!Number.isInteger(offset.x) || !Number.isInteger(offset.y)) {
      throw new Error(`Geometry override ${space.id} offsetTiles must use integer tile offsets.`);
    }
    return { ...space, rect: { ...space.rect, x: space.rect.x + offset.x, y: space.rect.y + offset.y } };
  });
}

function validateNoOverlaps(spaces: SpaceGeometry[]) {
  for (let a = 0; a < spaces.length; a += 1) {
    for (let b = a + 1; b < spaces.length; b += 1) {
      if (rectOverlap(spaces[a].rect, spaces[b].rect)) {
        throw new Error(`Geometry spaces overlap: ${spaces[a].id} and ${spaces[b].id}.`);
      }
    }
  }
}

type SharedBoundary = {
  orientation: WallOrientation;
  boundary: number;
  start: number;
  length: number;
  fromSide: "north" | "south" | "east" | "west";
  toSide: "north" | "south" | "east" | "west";
};

function sharedBoundary(from: GridRect, to: GridRect): SharedBoundary | null {
  const yStart = Math.max(from.y, to.y);
  const yEnd = Math.min(from.y + from.h, to.y + to.h);
  if (from.x + from.w === to.x && yEnd > yStart) {
    return { orientation: "vertical", boundary: to.x, start: yStart, length: yEnd - yStart, fromSide: "east", toSide: "west" };
  }
  if (to.x + to.w === from.x && yEnd > yStart) {
    return { orientation: "vertical", boundary: from.x, start: yStart, length: yEnd - yStart, fromSide: "west", toSide: "east" };
  }

  const xStart = Math.max(from.x, to.x);
  const xEnd = Math.min(from.x + from.w, to.x + to.w);
  if (from.y + from.h === to.y && xEnd > xStart) {
    return { orientation: "horizontal", boundary: to.y, start: xStart, length: xEnd - xStart, fromSide: "south", toSide: "north" };
  }
  if (to.y + to.h === from.y && xEnd > xStart) {
    return { orientation: "horizontal", boundary: from.y, start: xStart, length: xEnd - xStart, fromSide: "north", toSide: "south" };
  }
  return null;
}

function clearanceRect(
  boundary: SharedBoundary,
  apertureStart: number,
  apertureLength: number,
  depth: number,
  side: "north" | "south" | "east" | "west",
): GridRect {
  if (boundary.orientation === "vertical") {
    return side === "east"
      ? { x: boundary.boundary - depth, y: apertureStart, w: depth, h: apertureLength }
      : { x: boundary.boundary, y: apertureStart, w: depth, h: apertureLength };
  }
  return side === "south"
    ? { x: apertureStart, y: boundary.boundary - depth, w: apertureLength, h: depth }
    : { x: apertureStart, y: boundary.boundary, w: apertureLength, h: depth };
}

function rectContains(container: GridRect, inner: GridRect) {
  const epsilon = 1e-9;
  return inner.x + epsilon >= container.x
    && inner.y + epsilon >= container.y
    && inner.x + inner.w <= container.x + container.w + epsilon
    && inner.y + inner.h <= container.y + container.h + epsilon;
}

function compileConnections(semantic: SemanticCompilePlan, spaces: SpaceGeometry[]) {
  const byId = new Map(spaces.map((space) => [space.id, space]));
  return semantic.connections.map((connection): ConnectionGeometry => {
    const from = byId.get(connection.from)!;
    const to = byId.get(connection.to)!;
    const boundary = sharedBoundary(from.rect, to.rect);
    if (!boundary) {
      throw new Error(`Connection ${connection.id} requires ${connection.from} and ${connection.to} to share a real boundary.`);
    }

    const apertureLength = integerTile(connection.widthTiles, `Connection ${connection.id} width`);
    if (apertureLength > boundary.length) {
      throw new Error(`Connection ${connection.id} width ${apertureLength} exceeds shared boundary length ${boundary.length}.`);
    }
    const apertureStart = boundary.start + Math.floor((boundary.length - apertureLength) / 2);

    let clearanceBefore: GridRect | null = null;
    let clearanceAfter: GridRect | null = null;
    if (connection.kind !== "opening") {
      clearanceBefore = clearanceRect(boundary, apertureStart, apertureLength, connection.clearanceTiles.before, boundary.fromSide);
      clearanceAfter = clearanceRect(boundary, apertureStart, apertureLength, connection.clearanceTiles.after, boundary.toSide);
      if (!rectContains(from.rect, clearanceBefore)) {
        throw new Error(`Connection ${connection.id} before-clearance does not fit inside ${connection.from}.`);
      }
      if (!rectContains(to.rect, clearanceAfter)) {
        throw new Error(`Connection ${connection.id} after-clearance does not fit inside ${connection.to}.`);
      }
    }

    return {
      id: connection.id,
      from: connection.from,
      to: connection.to,
      kind: connection.kind,
      wallOrientation: boundary.orientation,
      fromSide: boundary.fromSide,
      toSide: boundary.toSide,
      boundary: boundary.boundary,
      apertureStart,
      apertureLength,
      clearanceBefore,
      clearanceAfter,
    };
  });
}

type UnitEdge = {
  orientation: WallOrientation;
  x: number;
  y: number;
  owners: Set<string>;
};

function edgeKey(orientation: WallOrientation, x: number, y: number) {
  return `${orientation === "horizontal" ? "H" : "V"}:${x}:${y}`;
}

function addEdge(edges: Map<string, UnitEdge>, orientation: WallOrientation, x: number, y: number, owner: string) {
  const key = edgeKey(orientation, x, y);
  const existing = edges.get(key);
  if (existing) {
    existing.owners.add(owner);
    return;
  }
  edges.set(key, { orientation, x, y, owners: new Set([owner]) });
}

function buildWallUnits(spaces: SpaceGeometry[], connections: ConnectionGeometry[]) {
  const edges = new Map<string, UnitEdge>();
  for (const space of spaces) {
    const { x, y, w, h } = space.rect;
    for (let dx = 0; dx < w; dx += 1) {
      addEdge(edges, "horizontal", x + dx, y, space.id);
      addEdge(edges, "horizontal", x + dx, y + h, space.id);
    }
    for (let dy = 0; dy < h; dy += 1) {
      addEdge(edges, "vertical", x, y + dy, space.id);
      addEdge(edges, "vertical", x + w, y + dy, space.id);
    }
  }

  for (const connection of connections) {
    for (let offset = 0; offset < connection.apertureLength; offset += 1) {
      const key = connection.wallOrientation === "horizontal"
        ? edgeKey("horizontal", connection.apertureStart + offset, connection.boundary)
        : edgeKey("vertical", connection.boundary, connection.apertureStart + offset);
      if (!edges.delete(key)) throw new Error(`Connection ${connection.id} aperture does not intersect compiled wall geometry.`);
    }
  }
  return [...edges.values()];
}

function collapseWalls(units: UnitEdge[]): WallSegment[] {
  const groups = new Map<string, UnitEdge[]>();
  for (const unit of units) {
    const owners = [...unit.owners].sort();
    const fixed = unit.orientation === "horizontal" ? unit.y : unit.x;
    const key = `${unit.orientation}:${fixed}:${owners.join("+")}`;
    const group = groups.get(key) ?? [];
    group.push(unit);
    groups.set(key, group);
  }

  const segments: WallSegment[] = [];
  for (const group of groups.values()) {
    const orientation = group[0].orientation;
    const owners = [...group[0].owners].sort();
    group.sort((a, b) => orientation === "horizontal" ? a.x - b.x : a.y - b.y);
    let start = orientation === "horizontal" ? group[0].x : group[0].y;
    let previous = start;
    const fixed = orientation === "horizontal" ? group[0].y : group[0].x;

    const flush = (endExclusive: number) => {
      const length = endExclusive - start;
      const x = orientation === "horizontal" ? start : fixed;
      const y = orientation === "horizontal" ? fixed : start;
      segments.push({
        id: `wall:${orientation}:${x}:${y}:${length}:${owners.join("+")}`,
        orientation,
        x,
        y,
        length,
        ownerSpaceIds: owners,
        shared: owners.length > 1,
      });
    };

    for (let index = 1; index < group.length; index += 1) {
      const current = orientation === "horizontal" ? group[index].x : group[index].y;
      if (current !== previous + 1) {
        flush(previous + 1);
        start = current;
      }
      previous = current;
    }
    flush(previous + 1);
  }

  return segments.sort((a, b) => a.orientation.localeCompare(b.orientation) || a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
}

function boundsFor(spaces: SpaceGeometry[], margin = 1): GridRect {
  const maxX = Math.max(...spaces.map((space) => space.rect.x + space.rect.w));
  const maxY = Math.max(...spaces.map((space) => space.rect.y + space.rect.h));
  return { x: 0, y: 0, w: maxX + margin, h: maxY + margin };
}

export function compileLevelGeometry(semantic: SemanticCompilePlan): GeometryCompilePlan {
  if (!semantic.spaces.length) throw new Error(`Geometry compile requires at least one semantic space.`);

  const diagnostics = [...semantic.diagnostics];
  const root = semantic.spaces[0];
  const rootSize = dimensions(root, semantic.overrides);
  const placed = new Map<string, SpaceGeometry>([
    [root.id, { id: root.id, kind: root.kind, rect: { x: 0, y: 0, ...rootSize }, seed: root.seed }],
  ]);

  while (placed.size < semantic.spaces.length) {
    let progressed = false;
    for (const child of semantic.spaces) {
      if (placed.has(child.id)) continue;
      const connection = semantic.connections.find((candidate) => {
        if (candidate.from === child.id) return placed.has(candidate.to);
        if (candidate.to === child.id) return placed.has(candidate.from);
        return false;
      });
      if (!connection) continue;
      const parentId = connection.from === child.id ? connection.to : connection.from;
      const parent = placed.get(parentId)!;
      const result = placeChild(child, parent, connection, [...placed.values()], semantic.overrides);
      placed.set(child.id, { id: child.id, kind: child.kind, rect: result.rect, seed: child.seed });
      if (result.slide !== 0) {
        diagnostics.push({
          level: "info",
          code: "SPACE_SLID_FOR_COLLISION",
          targetId: child.id,
          message: `${child.id} slid ${result.slide} tile(s) along ${connection.id} to avoid overlap while preserving adjacency.`,
        });
      }
      progressed = true;
    }
    if (!progressed) {
      const remaining = semantic.spaces.filter((space) => !placed.has(space.id)).map((space) => space.id);
      throw new Error(`Geometry solver cannot attach remaining spaces: ${remaining.join(", ")}. v0.1 expects a connected tree-like placement graph.`);
    }
  }

  let spaces = normalizePlacements([...placed.values()]);
  spaces = applyOffsets(spaces, semantic.overrides);
  validateNoOverlaps(spaces);

  const connections = compileConnections(semantic, spaces);
  const walls = collapseWalls(buildWallUnits(spaces, connections));

  diagnostics.push({
    level: "info",
    code: "GEOMETRY_COMPILED",
    message: `Compiled ${spaces.length} spaces, ${connections.length} apertures and ${walls.length} shared/exterior wall segments.`,
  });

  return {
    semantic,
    spaces,
    connections,
    walls,
    bounds: boundsFor(spaces),
    diagnostics,
  };
}
