import { publicAsset } from "../game/assets";
import type { FloorDefinition, TileLayerDefinition, TileMapVisualDefinition, TilesetDefinition } from "../game/types";
import type { RuntimeEmissionPlan } from "./emissionTypes";

const PREVIEW_FIRST_GID = 1000;
const PREVIEW_TILE_COUNT = 19;
const PREVIEW_TILESET_ASSET = "assets/levelgen/compiler-preview-overlays.svg";

// Wall mask bits. The preview renders each canonical wall segment exactly once
// on one adjacent walkable cell, so shared walls do not become visually doubled.
const WALL_N = 1;
const WALL_E = 2;
const WALL_S = 4;
const WALL_W = 8;

function cellKey(x: number, y: number) {
  return `${x},${y}`;
}

function indexFor(x: number, y: number, bounds: { x: number; y: number; w: number; h: number }) {
  const col = x - bounds.x;
  const row = y - bounds.y;
  if (col < 0 || col >= bounds.w || row < 0 || row >= bounds.h) return -1;
  return row * bounds.w + col;
}

function buildWallPreviewLayer(plan: RuntimeEmissionPlan): TileLayerDefinition {
  const navigation = plan.events.actors.props.navigation;
  const bounds = navigation.bounds;
  const cells = new Map(navigation.walkableCells.map((cell) => [cellKey(cell.x, cell.y), cell]));
  const masks = new Map<string, number>();

  const addMask = (x: number, y: number, bit: number) => {
    const key = cellKey(x, y);
    masks.set(key, (masks.get(key) ?? 0) | bit);
  };

  for (const wall of navigation.geometry.walls) {
    for (let offset = 0; offset < wall.length; offset += 1) {
      if (wall.orientation === "horizontal") {
        const x = wall.x + offset;
        const above = cells.get(cellKey(x, wall.y - 1));
        const below = cells.get(cellKey(x, wall.y));
        if (above) addMask(above.x, above.y, WALL_S);
        else if (below) addMask(below.x, below.y, WALL_N);
      } else {
        const y = wall.y + offset;
        const left = cells.get(cellKey(wall.x - 1, y));
        const right = cells.get(cellKey(wall.x, y));
        if (left) addMask(left.x, left.y, WALL_E);
        else if (right) addMask(right.x, right.y, WALL_W);
      }
    }
  }

  const data = Array.from({ length: bounds.w * bounds.h }, () => 0);
  for (const [key, mask] of masks) {
    const [xText, yText] = key.split(",");
    const index = indexFor(Number(xText), Number(yText), bounds);
    if (index >= 0 && mask > 0) data[index] = PREVIEW_FIRST_GID + mask - 1;
  }

  return {
    id: "compiler-preview-walls",
    name: "CompilerPreviewWalls",
    width: bounds.w,
    height: bounds.h,
    data,
    opacity: 1,
    visible: true,
  };
}

function buildPropPreviewLayer(plan: RuntimeEmissionPlan): TileLayerDefinition {
  const props = plan.events.actors.props;
  const bounds = props.navigation.bounds;
  const data = Array.from({ length: bounds.w * bounds.h }, () => 0);
  const roleGid = {
    hero: PREVIEW_FIRST_GID + 15,
    support: PREVIEW_FIRST_GID + 16,
    furniture: PREVIEW_FIRST_GID + 17,
    dressing: PREVIEW_FIRST_GID + 18,
  } as const;

  for (const placement of props.placements) {
    for (const cell of placement.footprintCells) {
      const index = indexFor(cell.x, cell.y, bounds);
      if (index >= 0) data[index] = roleGid[placement.role];
    }
  }

  return {
    id: "compiler-preview-props",
    name: "CompilerPreviewProps",
    width: bounds.w,
    height: bounds.h,
    data,
    opacity: 1,
    visible: true,
  };
}

/**
 * Adds presentation-only blockout overlays to an emitted runtime Floor.
 * Collision, doors, encounters and pickups remain exactly those produced by
 * v0.6; this function only makes the generated geometry readable while driving it.
 */
export function createPlayableCompilerPreview(plan: RuntimeEmissionPlan): FloorDefinition {
  const floor = plan.runtimeFloor;
  if (floor.visual.kind !== "tilemap") return floor;
  if (plan.tileSize !== 64) {
    throw new Error(`Compiler playable preview currently requires 64 px tiles; got ${plan.tileSize}.`);
  }

  const baseVisual = floor.visual;
  const resolvedBaseTilesets: TilesetDefinition[] = baseVisual.tilesets.map((tileset) => ({
    ...tileset,
    asset: publicAsset(tileset.asset),
  }));
  const previewTileset: TilesetDefinition = {
    firstGid: PREVIEW_FIRST_GID,
    asset: publicAsset(PREVIEW_TILESET_ASSET),
    tileWidth: 64,
    tileHeight: 64,
    columns: PREVIEW_TILE_COUNT,
    tileCount: PREVIEW_TILE_COUNT,
    margin: 0,
    spacing: 0,
  };
  const visual: TileMapVisualDefinition = {
    ...baseVisual,
    tilesets: [...resolvedBaseTilesets, previewTileset],
    layers: [
      ...baseVisual.layers,
      buildWallPreviewLayer(plan),
      buildPropPreviewLayer(plan),
    ],
  };

  return { ...floor, visual };
}
