import { publicAsset } from "../game/assets";
import type { FloorVisualSpriteDefinition } from "../game/types";
import type { RuntimeEmissionPlan } from "./emissionTypes";
import type { CardinalDirection, OrientationPreference } from "./types";

const BASE_VARIANTS = [0, 0, 1, 1, 2, 3] as const;
const STRAIGHT_HORIZONTAL = [6, 7, 8] as const;
const STRAIGHT_VERTICAL = [9, 10, 11] as const;
const JUNCTION_CROSS = 12;
const JUNCTION_T_CANONICAL = 13; // source arms: west + east + south (missing north)
const CORNER_CANONICAL = 17; // source arms: west + south
const THRESHOLD_CANONICAL = 21; // source boundary detail on south edge
const SERVICE_VARIANTS = [24, 25, 26, 27, 28, 29] as const;
const WEAR_VARIANTS = [34, 35] as const;

export const MAIN_HALL_TILE_CONTRACT = {
  tJunctionByMissingDirection: {
    north: { index: JUNCTION_T_CANONICAL, rotation: 0 },
    east: { index: JUNCTION_T_CANONICAL, rotation: 90 },
    south: { index: JUNCTION_T_CANONICAL, rotation: 180 },
    west: { index: JUNCTION_T_CANONICAL, rotation: 270 },
  },
  cornerByDirections: {
    "south+west": { index: CORNER_CANONICAL, rotation: 0 },
    "north+west": { index: CORNER_CANONICAL, rotation: 90 },
    "east+north": { index: CORNER_CANONICAL, rotation: 180 },
    "east+south": { index: CORNER_CANONICAL, rotation: 270 },
  },
  arrowByDirection: {
    north: { index: 30, rotation: 0 },
    east: { index: 31, rotation: 0 },
    south: { index: 32, rotation: 0 },
    west: { index: 33, rotation: 0 },
  },
} as const;

type Direction = CardinalDirection;
type Cell = { x: number; y: number };
type HallInfo = {
  id: string;
  rect: { x: number; y: number; w: number; h: number };
  orientation: Exclude<OrientationPreference, "any">;
};

const DIRECTIONS: Direction[] = ["north", "east", "south", "west"];

function stableHash(value: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function asset(index: number) {
  return publicAsset(`assets/deck/main-hall-floor/main-hall-floor-${String(index).padStart(2, "0")}.png`);
}

function key(cell: Cell) {
  return `${cell.x},${cell.y}`;
}

function opposite(direction: Direction): Direction {
  if (direction === "north") return "south";
  if (direction === "south") return "north";
  if (direction === "east") return "west";
  return "east";
}

function directionBetween(a: Cell, b: Cell): Direction {
  if (b.x === a.x && b.y === a.y - 1) return "north";
  if (b.x === a.x && b.y === a.y + 1) return "south";
  if (b.x === a.x + 1 && b.y === a.y) return "east";
  if (b.x === a.x - 1 && b.y === a.y) return "west";
  throw new Error(`Main Hall floor network received non-adjacent cells ${key(a)} -> ${key(b)}.`);
}

function addEdge(network: Map<string, Set<Direction>>, a: Cell, b: Cell) {
  const direction = directionBetween(a, b);
  const aSet = network.get(key(a)) ?? new Set<Direction>();
  const bSet = network.get(key(b)) ?? new Set<Direction>();
  aSet.add(direction);
  bSet.add(opposite(direction));
  network.set(key(a), aSet);
  network.set(key(b), bSet);
}

function connectLine(network: Map<string, Set<Direction>>, from: Cell, to: Cell) {
  let current = { ...from };
  while (current.x !== to.x) {
    const next = { x: current.x + Math.sign(to.x - current.x), y: current.y };
    addEdge(network, current, next);
    current = next;
  }
  while (current.y !== to.y) {
    const next = { x: current.x, y: current.y + Math.sign(to.y - current.y) };
    addEdge(network, current, next);
    current = next;
  }
}

function mainHall(plan: RuntimeEmissionPlan): HallInfo | null {
  const geometry = plan.events.actors.props.navigation.geometry;
  const semanticSpaces = new Map(geometry.semantic.spaces.map((space) => [space.id, space]));
  const space = geometry.spaces.find((entry) => {
    const semantic = semanticSpaces.get(entry.id);
    return entry.kind === "corridor"
      && semantic?.kind === "corridor"
      && ((semantic.tags ?? []).includes("hall") || semantic.archetype === "public-hall");
  });
  if (!space) return null;
  const semantic = semanticSpaces.get(space.id);
  if (!semantic || semantic.kind !== "corridor") return null;
  const preferred = semantic.orientation ?? "any";
  const orientation = preferred === "any"
    ? (space.rect.h >= space.rect.w ? "vertical" : "horizontal")
    : preferred;
  return { id: space.id, rect: space.rect, orientation };
}

function connectionSideForHall(
  connection: RuntimeEmissionPlan["events"]["actors"]["props"]["navigation"]["geometry"]["connections"][number],
  hallId: string,
): Direction | null {
  if (connection.from === hallId) return connection.fromSide;
  if (connection.to === hallId) return connection.toSide;
  return null;
}

function boundaryCellsForConnection(
  connection: RuntimeEmissionPlan["events"]["actors"]["props"]["navigation"]["geometry"]["connections"][number],
  hall: HallInfo,
): Array<{ cell: Cell; side: Direction }> {
  const side = connectionSideForHall(connection, hall.id);
  if (!side) return [];
  const cells: Array<{ cell: Cell; side: Direction }> = [];
  for (let i = 0; i < connection.apertureLength; i += 1) {
    if (side === "north" || side === "south") {
      cells.push({
        side,
        cell: {
          x: connection.apertureStart + i,
          y: side === "north" ? hall.rect.y : hall.rect.y + hall.rect.h - 1,
        },
      });
    } else {
      cells.push({
        side,
        cell: {
          x: side === "west" ? hall.rect.x : hall.rect.x + hall.rect.w - 1,
          y: connection.apertureStart + i,
        },
      });
    }
  }
  return cells;
}

function buildHallNetwork(plan: RuntimeEmissionPlan, hall: HallInfo) {
  const network = new Map<string, Set<Direction>>();
  const thresholds = new Map<string, Direction>();
  const geometry = plan.events.actors.props.navigation.geometry;

  if (hall.orientation === "vertical") {
    const spineX = hall.rect.x + Math.floor((hall.rect.w - 1) / 2);
    for (let y = hall.rect.y; y < hall.rect.y + hall.rect.h - 1; y += 1) {
      addEdge(network, { x: spineX, y }, { x: spineX, y: y + 1 });
    }
    for (const connection of geometry.connections) {
      for (const { cell, side } of boundaryCellsForConnection(connection, hall)) {
        thresholds.set(key(cell), side);
        connectLine(network, cell, { x: spineX, y: cell.y });
      }
    }
  } else {
    const spineY = hall.rect.y + Math.floor((hall.rect.h - 1) / 2);
    for (let x = hall.rect.x; x < hall.rect.x + hall.rect.w - 1; x += 1) {
      addEdge(network, { x, y: spineY }, { x: x + 1, y: spineY });
    }
    for (const connection of geometry.connections) {
      for (const { cell, side } of boundaryCellsForConnection(connection, hall)) {
        thresholds.set(key(cell), side);
        connectLine(network, cell, { x: cell.x, y: spineY });
      }
    }
  }

  return { network, thresholds };
}

function thresholdRotation(side: Direction) {
  if (side === "south") return 0;
  if (side === "west") return 90;
  if (side === "north") return 180;
  return 270;
}

function networkTile(directions: Set<Direction>, x: number, y: number) {
  const has = (direction: Direction) => directions.has(direction);
  const count = directions.size;

  if (count === 4) return { index: JUNCTION_CROSS, rotation: 0, role: "junction-cross" };
  if (count === 3) {
    const missing = DIRECTIONS.find((direction) => !has(direction));
    if (!missing) throw new Error("Main Hall T-junction could not resolve its missing direction.");
    const tile = MAIN_HALL_TILE_CONTRACT.tJunctionByMissingDirection[missing];
    return { ...tile, role: "junction-t" };
  }
  if (count === 2) {
    if (has("north") && has("south")) {
      const index = STRAIGHT_VERTICAL[stableHash(`main-hall-v:${x}:${y}`) % STRAIGHT_VERTICAL.length];
      return { index, rotation: 0, role: "straight" };
    }
    if (has("east") && has("west")) {
      const index = STRAIGHT_HORIZONTAL[stableHash(`main-hall-h:${x}:${y}`) % STRAIGHT_HORIZONTAL.length];
      return { index, rotation: 0, role: "straight" };
    }
    if (has("south") && has("west")) return { index: CORNER_CANONICAL, rotation: 0, role: "corner" };
    if (has("north") && has("west")) return { index: CORNER_CANONICAL, rotation: 90, role: "corner" };
    if (has("north") && has("east")) return { index: CORNER_CANONICAL, rotation: 180, role: "corner" };
    return { index: CORNER_CANONICAL, rotation: 270, role: "corner" };
  }
  if (count === 1) {
    const vertical = has("north") || has("south");
    const variants = vertical ? STRAIGHT_VERTICAL : STRAIGHT_HORIZONTAL;
    const index = variants[stableHash(`main-hall-end:${x}:${y}`) % variants.length];
    return { index, rotation: 0, role: "straight" };
  }
  return null;
}

function baseTile(spaceId: string, x: number, y: number) {
  const hash = stableHash(`${spaceId}:${x}:${y}`);
  if (hash % 37 === 0) {
    return { index: WEAR_VARIANTS[(hash >>> 8) % WEAR_VARIANTS.length], role: "wear" };
  }
  if (hash % 29 === 0) {
    return { index: SERVICE_VARIANTS[(hash >>> 10) % SERVICE_VARIANTS.length], role: "service" };
  }
  return { index: BASE_VARIANTS[hash % BASE_VARIANTS.length], role: "base" };
}

/**
 * Presentation-only Main Hall floor treatment for generated TS-01.
 *
 * The hall network is derived from actual corridor geometry and connections.
 * Longitudinal straight pieces establish circulation; T/cross/corner pieces are
 * chosen from network adjacency; every real opening/door gets a threshold. The
 * source arrow tiles remain reserved until route-signage semantics are authored.
 */
export function mainHallFloorSprites(plan: RuntimeEmissionPlan): FloorVisualSpriteDefinition[] {
  const hall = mainHall(plan);
  if (!hall) return [];

  const { network, thresholds } = buildHallNetwork(plan, hall);
  const bounds = plan.events.actors.props.navigation.bounds;
  const tileSize = plan.tileSize;
  const sprites: FloorVisualSpriteDefinition[] = [];

  for (let y = hall.rect.y; y < hall.rect.y + hall.rect.h; y += 1) {
    for (let x = hall.rect.x; x < hall.rect.x + hall.rect.w; x += 1) {
      const cell = { x, y };
      const thresholdSide = thresholds.get(key(cell));
      let tile: { index: number; rotation?: number; role: string };

      if (thresholdSide) {
        tile = {
          index: THRESHOLD_CANONICAL,
          rotation: thresholdRotation(thresholdSide),
          role: "threshold",
        };
      } else {
        tile = networkTile(network.get(key(cell)) ?? new Set<Direction>(), x, y) ?? baseTile(hall.id, x, y);
      }

      sprites.push({
        id: `main-hall-floor:${tile.role}:${hall.id}:${x}:${y}`,
        asset: asset(tile.index),
        x: (x - bounds.x) * tileSize,
        y: (y - bounds.y) * tileSize,
        width: tileSize,
        height: tileSize,
        rotation: tile.rotation ?? 0,
      });
    }
  }

  return sprites;
}
