import { publicAsset } from "../game/assets";
import type { FloorVisualSpriteDefinition } from "../game/types";
import type { RuntimeEmissionPlan } from "./emissionTypes";

const FAMILY_TILE_COUNT = 9;

function stableHash(value: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function familyTileAsset(index: number) {
  return publicAsset(`assets/deck/family-floor/family-floor-${String(index).padStart(2, "0")}.png`);
}

/**
 * Presentation-only deterministic pseudo-random Family floor assignment.
 *
 * Spatial semantics stay in the LevelSpec/solver. The hash is deliberately
 * coordinate-stable so rebuilding the same generated floor never reshuffles
 * the visible material under Props, screenshots or QA.
 */
export function familyFloorSprites(plan: RuntimeEmissionPlan): FloorVisualSpriteDefinition[] {
  const geometry = plan.events.actors.props.navigation.geometry;
  const semanticSpaces = new Map(geometry.semantic.spaces.map((space) => [space.id, space]));
  const bounds = plan.events.actors.props.navigation.bounds;
  const tileSize = plan.tileSize;
  const sprites: FloorVisualSpriteDefinition[] = [];

  for (const space of geometry.spaces) {
    const semantic = semanticSpaces.get(space.id);
    if (space.kind !== "room" || semantic?.kind !== "room" || semantic.rationality !== "domestic") continue;

    for (let y = space.rect.y; y < space.rect.y + space.rect.h; y += 1) {
      for (let x = space.rect.x; x < space.rect.x + space.rect.w; x += 1) {
        const tileIndex = stableHash(`${space.id}:${x}:${y}`) % FAMILY_TILE_COUNT;
        sprites.push({
          id: `family-floor:${space.id}:${x}:${y}`,
          asset: familyTileAsset(tileIndex),
          x: (x - bounds.x) * tileSize,
          y: (y - bounds.y) * tileSize,
          width: tileSize,
          height: tileSize,
          rotation: 0,
        });
      }
    }
  }

  return sprites;
}
