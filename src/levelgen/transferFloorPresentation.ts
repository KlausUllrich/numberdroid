import { publicAsset } from "../game/assets";
import type { FloorVisualSpriteDefinition } from "../game/types";
import type { RuntimeEmissionPlan } from "./emissionTypes";

const BASE_VARIANTS = [0, 0, 0, 0, 1, 1, 2, 3] as const;
const SERVICE_VARIANTS = [30, 31, 32] as const;
const ANCHOR_EDGE = 8;
const ANCHOR_CORNER = 12;
const ANCHOR_INTERIORS = [14, 15, 16, 17] as const;
const THRESHOLD_HORIZONTAL = 6;

function stableHash(value: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function asset(index: number) {
  return publicAsset(`assets/deck/transfer-floor/transfer-floor-${String(index).padStart(2, "0")}.png`);
}

function cellKey(x: number, y: number) {
  return `${x},${y}`;
}

function contains(rect: { x: number; y: number; w: number; h: number }, x: number, y: number) {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h;
}

function intersection(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w);
  const y1 = Math.min(a.y + a.h, b.y + b.h);
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function transferSpace(plan: RuntimeEmissionPlan) {
  const geometry = plan.events.actors.props.navigation.geometry;
  const semanticSpaces = new Map(geometry.semantic.spaces.map((space) => [space.id, space]));
  return geometry.spaces.find((space) => {
    const semantic = semanticSpaces.get(space.id);
    return space.kind === "room"
      && semantic?.kind === "room"
      && semantic.rationality === "ritual"
      && semantic.tags.includes("transfer");
  }) ?? null;
}

function thresholdCells(plan: RuntimeEmissionPlan, space: { id: string; rect: { x: number; y: number; w: number; h: number } }) {
  const geometry = plan.events.actors.props.navigation.geometry;
  const connection = geometry.connections.find((entry) => (
    (entry.from === space.id || entry.to === space.id) && entry.kind === "opening"
  ));
  const result = new Map<string, number>();
  if (!connection) return result;

  const side = connection.from === space.id ? connection.fromSide : connection.toSide;
  for (let i = 0; i < connection.apertureLength; i += 1) {
    if (side === "north" || side === "south") {
      const x = connection.apertureStart + i;
      const y = side === "north" ? space.rect.y : space.rect.y + space.rect.h - 1;
      result.set(cellKey(x, y), 0);
    } else {
      const x = side === "west" ? space.rect.x : space.rect.x + space.rect.w - 1;
      const y = connection.apertureStart + i;
      result.set(cellKey(x, y), 90);
    }
  }
  return result;
}

function anchorTile(
  anchor: { x: number; y: number; w: number; h: number },
  x: number,
  y: number,
): { index: number; rotation: number; role: string } {
  const left = x === anchor.x;
  const right = x === anchor.x + anchor.w - 1;
  const top = y === anchor.y;
  const bottom = y === anchor.y + anchor.h - 1;

  if (top && left) return { index: ANCHOR_CORNER, rotation: 0, role: "anchor-corner" };
  if (top && right) return { index: ANCHOR_CORNER, rotation: 90, role: "anchor-corner" };
  if (bottom && right) return { index: ANCHOR_CORNER, rotation: 180, role: "anchor-corner" };
  if (bottom && left) return { index: ANCHOR_CORNER, rotation: 270, role: "anchor-corner" };
  if (top) return { index: ANCHOR_EDGE, rotation: 0, role: "anchor-edge" };
  if (right) return { index: ANCHOR_EDGE, rotation: 90, role: "anchor-edge" };
  if (bottom) return { index: ANCHOR_EDGE, rotation: 180, role: "anchor-edge" };
  if (left) return { index: ANCHOR_EDGE, rotation: 270, role: "anchor-edge" };

  const index = ANCHOR_INTERIORS[stableHash(`transfer-anchor:${x}:${y}`) % ANCHOR_INTERIORS.length];
  return { index, rotation: 0, role: "anchor-interior" };
}

function baseTile(spaceId: string, x: number, y: number) {
  const hash = stableHash(`${spaceId}:${x}:${y}`);
  // Service panels are deliberately rare and only occur outside the Hero anchor.
  if (hash % 31 === 0) {
    return { index: SERVICE_VARIANTS[(hash >>> 8) % SERVICE_VARIANTS.length], role: "service" };
  }
  return { index: BASE_VARIANTS[hash % BASE_VARIANTS.length], role: "base" };
}

/**
 * Presentation-only Transfer-room floor treatment for generated TS-01.
 *
 * The approved 6x6 source atlas is materialized into 36 independent 64px tiles.
 * This function intentionally uses only semantically justified subsets now:
 * calm base variation, the 1-tile Hero installation envelope, the actual room
 * threshold and rare service panels. Direction arrows / registration / heavier
 * wear remain available in the atlas but are not scattered without authored
 * route/use semantics.
 */
export function transferFloorSprites(plan: RuntimeEmissionPlan): FloorVisualSpriteDefinition[] {
  const space = transferSpace(plan);
  if (!space) return [];

  const props = plan.events.actors.props;
  const hero = props.placements.find((placement) => placement.spaceId === space.id && placement.role === "hero");
  if (!hero) return [];

  const desiredAnchor = {
    x: hero.rect.x - 1,
    y: hero.rect.y - 1,
    w: hero.rect.w + 2,
    h: hero.rect.h + 2,
  };
  const anchor = intersection(desiredAnchor, space.rect);
  if (!anchor) return [];

  const thresholds = thresholdCells(plan, space);
  const bounds = props.navigation.bounds;
  const tileSize = plan.tileSize;
  const sprites: FloorVisualSpriteDefinition[] = [];

  for (let y = space.rect.y; y < space.rect.y + space.rect.h; y += 1) {
    for (let x = space.rect.x; x < space.rect.x + space.rect.w; x += 1) {
      const thresholdRotation = thresholds.get(cellKey(x, y));
      let index: number;
      let rotation = 0;
      let role: string;

      if (thresholdRotation !== undefined) {
        index = THRESHOLD_HORIZONTAL;
        rotation = thresholdRotation;
        role = "threshold";
      } else if (contains(anchor, x, y)) {
        const tile = anchorTile(anchor, x, y);
        index = tile.index;
        rotation = tile.rotation;
        role = tile.role;
      } else {
        const tile = baseTile(space.id, x, y);
        index = tile.index;
        role = tile.role;
      }

      sprites.push({
        id: `transfer-floor:${role}:${space.id}:${x}:${y}`,
        asset: asset(index),
        x: (x - bounds.x) * tileSize,
        y: (y - bounds.y) * tileSize,
        width: tileSize,
        height: tileSize,
        rotation,
      });
    }
  }

  return sprites;
}
