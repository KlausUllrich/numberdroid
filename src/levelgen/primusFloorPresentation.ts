import { publicAsset } from "../game/assets";
import type { FloorVisualSpriteDefinition } from "../game/types";
import type { RuntimeEmissionPlan } from "./emissionTypes";
import {
  PRIMUS_FLOOR_TILE_BY_ID,
  primusMacroTileId,
  type PrimusMacroPhase,
  type PrimusMacroVariant,
} from "./primusFloorTileMetadata";

type Cell = { x: number; y: number };
type RoomInfo = { id: string; rect: { x: number; y: number; w: number; h: number } };
type SpriteChoice = { tileId: string; rotation?: number; role: string };
type GeometryConnection = RuntimeEmissionPlan["events"]["actors"]["props"]["navigation"]["geometry"]["connections"][number];

function key(cell: Cell) {
  return `${cell.x},${cell.y}`;
}

function tileAsset(tileId: string) {
  const metadata = PRIMUS_FLOOR_TILE_BY_ID.get(tileId);
  if (!metadata || !metadata.runtimeEligible) {
    throw new Error(`PRIMUS floor requested unavailable tile metadata: ${tileId}`);
  }
  return publicAsset(`assets/deck/primus-floor/${metadata.asset}`);
}

function primusRoom(plan: RuntimeEmissionPlan): RoomInfo | null {
  const geometry = plan.events.actors.props.navigation.geometry;
  const semanticSpaces = new Map(geometry.semantic.spaces.map((space) => [space.id, space]));
  const room = geometry.spaces.find((space) => {
    const semantic = semanticSpaces.get(space.id);
    return space.kind === "room"
      && semantic?.kind === "room"
      && (semantic.archetype === "primus-allocation" || semantic.rationality === "system");
  });
  return room ? { id: room.id, rect: room.rect } : null;
}

function roomConnectionSide(connection: GeometryConnection, roomId: string) {
  if (connection.from === roomId) return connection.fromSide;
  if (connection.to === roomId) return connection.toSide;
  return null;
}

function boundaryCellsForConnection(connection: GeometryConnection, room: RoomInfo): Cell[] {
  const side = roomConnectionSide(connection, room.id);
  if (!side) return [];
  const cells: Cell[] = [];
  for (let i = 0; i < connection.apertureLength; i += 1) {
    if (side === "north" || side === "south") {
      cells.push({
        x: connection.apertureStart + i,
        y: side === "north" ? room.rect.y : room.rect.y + room.rect.h - 1,
      });
    } else {
      cells.push({
        x: side === "west" ? room.rect.x : room.rect.x + room.rect.w - 1,
        y: connection.apertureStart + i,
      });
    }
  }
  return cells;
}

function controlledThresholdOverrides(plan: RuntimeEmissionPlan, room: RoomInfo) {
  const geometry = plan.events.actors.props.navigation.geometry;
  const semanticSpaces = new Map(geometry.semantic.spaces.map((space) => [space.id, space]));
  const overrides = new Map<string, SpriteChoice>();

  const connection = geometry.connections.find((candidate) => {
    if (candidate.from !== room.id && candidate.to !== room.id) return false;
    const otherId = candidate.from === room.id ? candidate.to : candidate.from;
    return semanticSpaces.get(otherId)?.kind === "corridor";
  });
  if (!connection) return overrides;

  const side = roomConnectionSide(connection, room.id);
  const cells = boundaryCellsForConnection(connection, room);
  if (cells.length !== 2) {
    throw new Error(`PRIMUS floor v1 expects a 2-cell controlled threshold, got ${cells.length}.`);
  }
  if (side !== "west") {
    throw new Error(`PRIMUS floor v1 has calibrated threshold art only for west-side access, got ${side ?? "none"}.`);
  }

  const [upper, lower] = [...cells].sort((a, b) => a.y - b.y || a.x - b.x);
  overrides.set(key(upper), { tileId: "threshold-west-upper", role: "threshold" });
  overrides.set(key(lower), { tileId: "threshold-west-lower", role: "threshold" });
  return overrides;
}

function serviceApproachOverrides(plan: RuntimeEmissionPlan, room: RoomInfo) {
  const overrides = new Map<string, SpriteChoice>();
  const placements = plan.events.actors.props.placements.filter((placement) => (
    placement.spaceId === room.id && placement.propId === "primus-service-bank"
  ));

  for (const placement of placements) {
    const cells = placement.approachCells.filter((cell) => (
      cell.x >= room.rect.x && cell.x < room.rect.x + room.rect.w
      && cell.y >= room.rect.y && cell.y < room.rect.y + room.rect.h
    ));
    if (cells.length !== 2) {
      throw new Error(`PRIMUS service-bank ${placement.id} expects exactly 2 approach cells, got ${cells.length}.`);
    }

    const sameRow = cells[0].y === cells[1].y;
    const sameColumn = cells[0].x === cells[1].x;
    if (!sameRow && !sameColumn) {
      throw new Error(`PRIMUS service-bank ${placement.id} approach cells are not a contiguous pair.`);
    }

    if (sameRow) {
      const [left, right] = [...cells].sort((a, b) => a.x - b.x);
      overrides.set(key(left), { tileId: "service-left", role: "service-approach" });
      overrides.set(key(right), { tileId: "service-right", role: "service-approach" });
    } else {
      const [top, bottom] = [...cells].sort((a, b) => a.y - b.y);
      // Canonical left/right pair rotated clockwise: left becomes top, right bottom.
      overrides.set(key(top), { tileId: "service-left", rotation: 90, role: "service-approach" });
      overrides.set(key(bottom), { tileId: "service-right", rotation: 90, role: "service-approach" });
    }
  }

  return overrides;
}

function macroChoice(room: RoomInfo, x: number, y: number): SpriteChoice {
  const localX = x - room.rect.x;
  const localY = y - room.rect.y;

  // Preserve complete 2x2 macro panels. An odd residual row/column becomes one
  // calm full-bleed strip rather than exposing a half-panel frame.
  if ((room.rect.w % 2 === 1 && localX === room.rect.w - 1)
    || (room.rect.h % 2 === 1 && localY === room.rect.h - 1)) {
    return { tileId: "calm", role: "calm" };
  }

  const phase: PrimusMacroPhase = localY % 2 === 0
    ? (localX % 2 === 0 ? "nw" : "ne")
    : (localX % 2 === 0 ? "sw" : "se");
  const blockX = Math.floor(localX / 2);
  const blockY = Math.floor(localY / 2);
  // Variation is selected once per complete 2x2 macro panel, never per 64px cell.
  const variant: PrimusMacroVariant = ((blockX * 3 + blockY * 5) % 7 === 0) ? "b" : "a";
  return { tileId: primusMacroTileId(variant, phase), role: "macro" };
}

/**
 * Deterministic M4 PRIMUS floor treatment.
 *
 * The generated atlas explorations remain visual references only. Runtime geometry
 * is constructed from explicit semantic metadata: complete 2x2 macro panels,
 * the real controlled-door threshold and the actual service-bank approach cells.
 * No arbitrary work-slot text, random conduit tiles or decorative route graphics
 * are inferred from pixels.
 */
export function primusFloorSprites(plan: RuntimeEmissionPlan): FloorVisualSpriteDefinition[] {
  const room = primusRoom(plan);
  if (!room) return [];

  const threshold = controlledThresholdOverrides(plan, room);
  const service = serviceApproachOverrides(plan, room);
  const bounds = plan.events.actors.props.navigation.bounds;
  const tileSize = plan.tileSize;
  const sprites: FloorVisualSpriteDefinition[] = [];

  for (let y = room.rect.y; y < room.rect.y + room.rect.h; y += 1) {
    for (let x = room.rect.x; x < room.rect.x + room.rect.w; x += 1) {
      const cellKey = key({ x, y });
      // Boundary transition owns the cell; service semantics own interior approach
      // cells; the remaining surface is the calm systematic macro material.
      const choice = threshold.get(cellKey) ?? service.get(cellKey) ?? macroChoice(room, x, y);
      sprites.push({
        id: `primus-floor:${choice.role}:${room.id}:${x}:${y}`,
        asset: tileAsset(choice.tileId),
        x: (x - bounds.x) * tileSize,
        y: (y - bounds.y) * tileSize,
        width: tileSize,
        height: tileSize,
        rotation: choice.rotation ?? 0,
      });
    }
  }

  return sprites;
}
