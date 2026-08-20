import { publicAsset } from "../game/assets";
import type { FloorVisualSpriteDefinition } from "../game/types";
import type { RuntimeEmissionPlan } from "./emissionTypes";
import { PRIMUS_FLOOR_TILE_BY_ID, type PrimusMacroVariant } from "./primusFloorTileMetadata";

type Cell = { x: number; y: number };
type RoomInfo = { id: string; rect: { x: number; y: number; w: number; h: number } };
type GeometryConnection = RuntimeEmissionPlan["events"]["actors"]["props"]["navigation"]["geometry"]["connections"][number];

function key(cell: Cell) {
  return `${cell.x},${cell.y}`;
}

function surfaceAsset(surfaceId: string) {
  const metadata = PRIMUS_FLOOR_TILE_BY_ID.get(surfaceId);
  if (!metadata || !metadata.runtimeEligible) {
    throw new Error(`PRIMUS floor requested unavailable surface metadata: ${surfaceId}`);
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

function macroVariant(blockX: number, blockY: number): PrimusMacroVariant {
  return ((blockX * 3 + blockY * 5) % 5 === 0) ? "b" : "a";
}

function assertMacroDomainFits(room: RoomInfo) {
  const interiorWidth = room.rect.w - 2;
  const interiorHeight = room.rect.h - 2;
  if (interiorWidth <= 0 || interiorHeight <= 0 || interiorWidth % 2 !== 0 || interiorHeight % 2 !== 0) {
    throw new Error(
      `PRIMUS 2x2 macro domain must fit exactly inside the one-tile calm perimeter; room is ${room.rect.w}x${room.rect.h}, interior is ${interiorWidth}x${interiorHeight}.`,
    );
  }
}

function baseSurfaceSprites(plan: RuntimeEmissionPlan, room: RoomInfo): FloorVisualSpriteDefinition[] {
  assertMacroDomainFits(room);
  const bounds = plan.events.actors.props.navigation.bounds;
  const tileSize = plan.tileSize;
  const sprites: FloorVisualSpriteDefinition[] = [];
  const interiorWidth = room.rect.w - 2;
  const interiorHeight = room.rect.h - 2;

  // The calm perimeter is a real layout band, not an overlay that may hide half
  // of a macro. Macro origin is therefore shifted one tile inward on both axes.
  for (let localY = 1; localY < 1 + interiorHeight; localY += 2) {
    for (let localX = 1; localX < 1 + interiorWidth; localX += 2) {
      const blockX = (localX - 1) / 2;
      const blockY = (localY - 1) / 2;
      const variant = macroVariant(blockX, blockY);
      const x = room.rect.x + localX;
      const y = room.rect.y + localY;
      const rotation = ((blockX + blockY * 2) % 2 === 0) ? 0 : 180;
      sprites.push({
        id: `primus-floor:macro:${variant}:${room.id}:${x}:${y}`,
        asset: surfaceAsset(`macro-${variant}`),
        x: (x - bounds.x) * tileSize,
        y: (y - bounds.y) * tileSize,
        width: tileSize * 2,
        height: tileSize * 2,
        rotation,
      });
    }
  }

  return sprites;
}

/**
 * Calm wall band requested by live QA.
 *
 * The perimeter is now part of the macro-layout contract rather than a cover-up:
 * macros start one tile inward and never extend beneath this band. Real threshold
 * and service semantics are rendered afterwards and may deliberately replace the
 * calm material where an actual opening/function exists.
 */
function wallFringeSprites(plan: RuntimeEmissionPlan, room: RoomInfo): FloorVisualSpriteDefinition[] {
  const bounds = plan.events.actors.props.navigation.bounds;
  const tileSize = plan.tileSize;
  const sprites: FloorVisualSpriteDefinition[] = [];
  const right = room.rect.x + room.rect.w - 1;
  const bottom = room.rect.y + room.rect.h - 1;

  for (let y = room.rect.y; y <= bottom; y += 1) {
    for (let x = room.rect.x; x <= right; x += 1) {
      if (x !== room.rect.x && x !== right && y !== room.rect.y && y !== bottom) continue;
      sprites.push({
        id: `primus-floor:wall-fringe:${room.id}:${x}:${y}`,
        asset: surfaceAsset("fringe"),
        x: (x - bounds.x) * tileSize,
        y: (y - bounds.y) * tileSize,
        width: tileSize,
        height: tileSize,
        rotation: 0,
      });
    }
  }

  return sprites;
}

function controlledThresholdSprite(plan: RuntimeEmissionPlan, room: RoomInfo): FloorVisualSpriteDefinition[] {
  const geometry = plan.events.actors.props.navigation.geometry;
  const semanticSpaces = new Map(geometry.semantic.spaces.map((space) => [space.id, space]));
  const connection = geometry.connections.find((candidate) => {
    if (candidate.from !== room.id && candidate.to !== room.id) return false;
    const otherId = candidate.from === room.id ? candidate.to : candidate.from;
    return semanticSpaces.get(otherId)?.kind === "corridor";
  });
  if (!connection) return [];

  const side = roomConnectionSide(connection, room.id);
  const cells = boundaryCellsForConnection(connection, room);
  if (cells.length !== 2 || side !== "west") {
    throw new Error(`PRIMUS floor v2 expects one 2-cell west threshold, got ${cells.length} cells on ${side ?? "none"}.`);
  }
  const [upper, lower] = [...cells].sort((a, b) => a.y - b.y || a.x - b.x);
  if (upper.x !== lower.x || lower.y !== upper.y + 1) {
    throw new Error("PRIMUS west threshold cells must be one contiguous vertical pair.");
  }

  const bounds = plan.events.actors.props.navigation.bounds;
  const tileSize = plan.tileSize;
  return [{
    id: `primus-floor:threshold:${room.id}:${upper.x}:${upper.y}`,
    asset: surfaceAsset("threshold-west"),
    x: (upper.x - bounds.x) * tileSize,
    y: (upper.y - bounds.y) * tileSize,
    width: tileSize,
    height: tileSize * 2,
    rotation: 0,
  }];
}

function serviceApproachSprites(plan: RuntimeEmissionPlan, room: RoomInfo): FloorVisualSpriteDefinition[] {
  const bounds = plan.events.actors.props.navigation.bounds;
  const tileSize = plan.tileSize;
  const result: FloorVisualSpriteDefinition[] = [];
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
    if (sameRow) {
      const [left, rightCell] = [...cells].sort((a, b) => a.x - b.x);
      if (rightCell.x !== left.x + 1) throw new Error(`PRIMUS service-bank ${placement.id} horizontal approach is not contiguous.`);
      result.push({
        id: `primus-floor:service-approach:${placement.id}`,
        asset: surfaceAsset("service-horizontal"),
        x: (left.x - bounds.x) * tileSize,
        y: (left.y - bounds.y) * tileSize,
        width: tileSize * 2,
        height: tileSize,
        rotation: 0,
      });
    } else if (sameColumn) {
      const [top, bottomCell] = [...cells].sort((a, b) => a.y - b.y);
      if (bottomCell.y !== top.y + 1) throw new Error(`PRIMUS service-bank ${placement.id} vertical approach is not contiguous.`);
      result.push({
        id: `primus-floor:service-approach:${placement.id}`,
        asset: surfaceAsset("service-vertical"),
        x: (top.x - bounds.x) * tileSize,
        y: (top.y - bounds.y) * tileSize,
        width: tileSize,
        height: tileSize * 2,
        rotation: 0,
      });
    } else {
      throw new Error(`PRIMUS service-bank ${placement.id} approach cells are not a contiguous pair.`);
    }
  }

  return result;
}

/**
 * Deterministic PRIMUS floor treatment.
 *
 * Material and topology have separate authority:
 * - a one-tile calm perimeter is excluded from the 2x2 macro tiling domain;
 * - the remaining interior must divide exactly into complete 2x2 macros;
 * - real Level semantics add a single multi-cell threshold and service overlays;
 * - no structural band is allowed to hide or clip a partial macro panel.
 */
export function primusFloorSprites(plan: RuntimeEmissionPlan): FloorVisualSpriteDefinition[] {
  const room = primusRoom(plan);
  if (!room) return [];
  return [
    ...baseSurfaceSprites(plan, room),
    ...wallFringeSprites(plan, room),
    ...controlledThresholdSprite(plan, room),
    ...serviceApproachSprites(plan, room),
  ];
}
