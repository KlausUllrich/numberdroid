import { publicAsset } from "../game/assets";
import type { FloorVisualSpriteDefinition } from "../game/types";
import type { RuntimeEmissionPlan } from "./emissionTypes";
import {
  MAIN_HALL_FLOOR_TILE_METADATA,
  resolveMainHallNetworkTile,
  type QuarterRotation,
} from "./mainHallFloorTileMetadata";
import type { CardinalDirection, OrientationPreference } from "./types";

const BASE_TILES = MAIN_HALL_FLOOR_TILE_METADATA.filter((entry) => entry.role === "base" && entry.runtimeEligible);
const SERVICE_TILES = MAIN_HALL_FLOOR_TILE_METADATA.filter((entry) => entry.role === "service" && entry.runtimeEligible);
const WEAR_TILES = MAIN_HALL_FLOOR_TILE_METADATA.filter((entry) => entry.role === "wear" && entry.runtimeEligible);
const THRESHOLD_TILE_INDEX = (() => {
  const tile = MAIN_HALL_FLOOR_TILE_METADATA.find((entry) => entry.role === "threshold" && entry.runtimeEligible);
  if (!tile) throw new Error("Main Hall floor metadata is missing an eligible threshold tile.");
  return tile.index;
})();

export const MAIN_HALL_TILE_CONTRACT = {
  tJunctionByMissingDirection: {
    north: { index: 13, rotation: 0 },
    east: { index: 13, rotation: 90 },
    south: { index: 13, rotation: 180 },
    west: { index: 13, rotation: 270 },
  },
  cornerByDirections: {
    "south+west": { index: 17, rotation: 0 },
    "north+west": { index: 17, rotation: 90 },
    "east+north": { index: 17, rotation: 180 },
    "east+south": { index: 17, rotation: 270 },
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

function thresholdRotation(side: Direction): QuarterRotation {
  if (side === "south") return 0;
  if (side === "west") return 90;
  if (side === "north") return 180;
  return 270;
}

function networkTile(directions: Set<Direction>) {
  if (directions.size === 0) return null;
  const resolved = resolveMainHallNetworkTile([...directions]);
  if (!resolved) {
    throw new Error(`Main Hall metadata has no calibrated tile for route signature ${[...directions].sort().join("+")}.`);
  }
  return {
    index: resolved.tile.index,
    rotation: resolved.rotation,
    role: resolved.tile.role,
  };
}

function isWallAdjacent(hall: HallInfo, x: number, y: number) {
  return x === hall.rect.x
    || y === hall.rect.y
    || x === hall.rect.x + hall.rect.w - 1
    || y === hall.rect.y + hall.rect.h - 1;
}

function pickByHash<T>(values: readonly T[], hash: number, shift = 0) {
  if (values.length === 0) throw new Error("Main Hall floor metadata group unexpectedly empty.");
  return values[(hash >>> shift) % values.length];
}

function baseTile(hall: HallInfo, x: number, y: number) {
  const hash = stableHash(`${hall.id}:${x}:${y}`);
  const atWall = isWallAdjacent(hall, x, y);

  // Do not put isolated hatches/wear graphics directly beside walls. First live
  // QA showed that presentation-edge detail gets partially occluded by the wall
  // fascia and reads as broken linework. Wall-adjacent non-route cells therefore
  // stay calm base material; semantic thresholds own actual wall transitions.
  if (!atWall && hash % 37 === 0) {
    const tile = pickByHash(WEAR_TILES, hash, 8);
    return { index: tile.index, role: tile.role };
  }
  if (!atWall && hash % 29 === 0) {
    const tile = pickByHash(SERVICE_TILES, hash, 10);
    return { index: tile.index, role: tile.role };
  }
  const tile = pickByHash(BASE_TILES, hash);
  return { index: tile.index, role: tile.role };
}

/**
 * Presentation-only Main Hall floor treatment for generated TS-01.
 *
 * Route placement is metadata-driven: every automatically placed route tile has
 * an explicit connector signature / continuity profile. Raw atlas indices are
 * never randomized for line-bearing tiles. This keeps the Hall spine and branch
 * graphics continuous and makes source alternates opt-in after calibration.
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
      let tile: { index: number; rotation?: QuarterRotation; role: string };

      if (thresholdSide) {
        tile = {
          index: THRESHOLD_TILE_INDEX,
          rotation: thresholdRotation(thresholdSide),
          role: "threshold",
        };
      } else {
        tile = networkTile(network.get(key(cell)) ?? new Set<Direction>()) ?? baseTile(hall, x, y);
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
