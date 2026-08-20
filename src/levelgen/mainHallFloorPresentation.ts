import { publicAsset } from "../game/assets";
import type { FloorVisualSpriteDefinition } from "../game/types";
import type { RuntimeEmissionPlan } from "./emissionTypes";
import {
  MAIN_HALL_FLOOR_TILE_METADATA,
  resolveMainHallNetworkTile,
  type QuarterRotation,
} from "./mainHallFloorTileMetadata";
import {
  MAIN_HALL_FLOOR_VISUAL_POLICY,
  shouldBranchMainHallSpine,
  type MainHallFloorConnectionClass,
} from "./mainHallFloorVisualPolicy";
import type { CardinalDirection, OrientationPreference } from "./types";

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
type GeometryConnection = RuntimeEmissionPlan["events"]["actors"]["props"]["navigation"]["geometry"]["connections"][number];

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

function removeEdge(network: Map<string, Set<Direction>>, a: Cell, b: Cell) {
  const direction = directionBetween(a, b);
  network.get(key(a))?.delete(direction);
  network.get(key(b))?.delete(opposite(direction));
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

function connectionSideForHall(connection: GeometryConnection, hallId: string): Direction | null {
  if (connection.from === hallId) return connection.fromSide;
  if (connection.to === hallId) return connection.toSide;
  return null;
}

function otherSpaceId(connection: GeometryConnection, hallId: string) {
  if (connection.from === hallId) return connection.to;
  if (connection.to === hallId) return connection.from;
  return null;
}

function connectionClass(plan: RuntimeEmissionPlan, connection: GeometryConnection, hallId: string): MainHallFloorConnectionClass | null {
  const otherId = otherSpaceId(connection, hallId);
  if (!otherId) return null;
  const semantic = plan.events.actors.props.navigation.geometry.semantic.spaces.find((space) => space.id === otherId);
  if (!semantic) return null;
  return semantic.kind === "corridor" ? "corridor" : "room";
}

function boundaryCellsForConnection(connection: GeometryConnection, hall: HallInfo): Array<{ cell: Cell; side: Direction }> {
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

function representativeBoundaryCell(cells: Array<{ cell: Cell; side: Direction }>) {
  if (cells.length === 0) return null;
  return cells[Math.floor((cells.length - 1) / 2)];
}

function buildHallNetwork(plan: RuntimeEmissionPlan, hall: HallInfo) {
  const network = new Map<string, Set<Direction>>();
  const thresholds = new Map<string, Direction>();
  const geometry = plan.events.actors.props.navigation.geometry;

  const spineX = hall.rect.x + Math.floor((hall.rect.w - 1) / 2);
  const spineY = hall.rect.y + Math.floor((hall.rect.h - 1) / 2);

  if (hall.orientation === "vertical") {
    for (let y = hall.rect.y; y < hall.rect.y + hall.rect.h - 1; y += 1) {
      addEdge(network, { x: spineX, y }, { x: spineX, y: y + 1 });
    }
  } else {
    for (let x = hall.rect.x; x < hall.rect.x + hall.rect.w - 1; x += 1) {
      addEdge(network, { x, y: spineY }, { x: x + 1, y: spineY });
    }
  }

  for (const connection of geometry.connections) {
    const cells = boundaryCellsForConnection(connection, hall);
    if (cells.length === 0) continue;
    for (const { cell, side } of cells) thresholds.set(key(cell), side);

    const classification = connectionClass(plan, connection, hall.id);
    if (!classification || !shouldBranchMainHallSpine(classification)) {
      // A room door is not a circulation-line junction. Keep the spine calm and
      // straight. If a north/south room threshold intersects the spine, break
      // the final route edge so the preceding route tile becomes a deliberate
      // terminal rather than disappearing abruptly under the threshold tile.
      if (classification === "room" && hall.orientation === "vertical") {
        for (const { cell, side } of cells) {
          if (cell.x !== spineX) continue;
          if (side === "north" && cell.y + 1 < hall.rect.y + hall.rect.h) {
            removeEdge(network, cell, { x: cell.x, y: cell.y + 1 });
          }
          if (side === "south" && cell.y - 1 >= hall.rect.y) {
            removeEdge(network, cell, { x: cell.x, y: cell.y - 1 });
          }
        }
      }
      if (classification === "room" && hall.orientation === "horizontal") {
        for (const { cell, side } of cells) {
          if (cell.y !== spineY) continue;
          if (side === "west" && cell.x + 1 < hall.rect.x + hall.rect.w) {
            removeEdge(network, cell, { x: cell.x + 1, y: cell.y });
          }
          if (side === "east" && cell.x - 1 >= hall.rect.x) {
            removeEdge(network, cell, { x: cell.x - 1, y: cell.y });
          }
        }
      }
      continue;
    }

    // Only true corridor-to-corridor topology branches the traffic line. Use one
    // representative aperture cell, never one branch per aperture tile.
    const representative = representativeBoundaryCell(cells);
    if (!representative) continue;
    if (hall.orientation === "vertical") {
      connectLine(network, representative.cell, { x: spineX, y: representative.cell.y });
    } else {
      connectLine(network, representative.cell, { x: representative.cell.x, y: spineY });
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

function baseTile() {
  // Live QA showed that even semantically valid service/wear variants made the
  // narrow TS-01 Hall read as patchwork. Main Hall v1 therefore uses one calm
  // full-bleed base face. Wear/service detail returns later as authored FloorFX,
  // not random Ground variation.
  return { index: MAIN_HALL_FLOOR_VISUAL_POLICY.baseTileIndex, role: "base" };
}

/**
 * Presentation-only Main Hall floor treatment for generated TS-01.
 *
 * The current Hall is intentionally simple: one continuous circulation spine,
 * calm base material, and real thresholds. Room doors do not create route-line
 * branches. Junction art is reserved for actual corridor topology changes.
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
        tile = networkTile(network.get(key(cell)) ?? new Set<Direction>()) ?? baseTile();
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
