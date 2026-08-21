import { publicAsset } from "../game/assets";
import type { FloorVisualSpriteDefinition } from "../game/types";
import type { RuntimeEmissionPlan } from "./emissionTypes";
import { FAMILY_HYGIENE_FLOOR_TILE_BY_ID } from "./familyHygieneFloorTileMetadata";

const ROOM_ID = "family-hygiene";
const EXPECTED_ROOM_SIZE = { w: 2, h: 3 } as const;

// Row-major 2x3 composition. One base owns four cells; only two compatible
// secondaries appear, separated by a full calm row so the tiny room never reads
// as a checkerboard or random candidate sampler.
const HYGIENE_LAYOUT = [
  "hygiene-base-a", "hygiene-base-b",
  "hygiene-base-a", "hygiene-base-a",
  "hygiene-fine-a", "hygiene-base-a",
] as const;

function tileAsset(tileId: typeof HYGIENE_LAYOUT[number]) {
  const metadata = FAMILY_HYGIENE_FLOOR_TILE_BY_ID.get(tileId);
  if (!metadata || !metadata.runtimeEligible) {
    throw new Error(`Family Hygiene floor requested unavailable tile metadata: ${tileId}`);
  }
  return publicAsset(`assets/deck/family-hygiene-floor/${metadata.asset}`);
}

/** Deterministic 1x1 Ground material treatment for the TS-01 Family Hygiene room. */
export function familyHygieneFloorSprites(plan: RuntimeEmissionPlan): FloorVisualSpriteDefinition[] {
  const geometry = plan.events.actors.props.navigation.geometry;
  const room = geometry.spaces.find((space) => space.id === ROOM_ID && space.kind === "room");
  if (!room) return [];
  if (room.rect.w !== EXPECTED_ROOM_SIZE.w || room.rect.h !== EXPECTED_ROOM_SIZE.h) {
    throw new Error(
      `Family Hygiene floor v1 expects a ${EXPECTED_ROOM_SIZE.w}x${EXPECTED_ROOM_SIZE.h} room, got ${room.rect.w}x${room.rect.h}.`,
    );
  }

  const bounds = geometry.bounds;
  const tileSize = plan.tileSize;
  return HYGIENE_LAYOUT.map((tileId, index) => {
    const localX = index % EXPECTED_ROOM_SIZE.w;
    const localY = Math.floor(index / EXPECTED_ROOM_SIZE.w);
    const x = room.rect.x + localX;
    const y = room.rect.y + localY;
    return {
      id: `family-hygiene-floor:${tileId}:${room.id}:${x}:${y}`,
      asset: tileAsset(tileId),
      x: (x - bounds.x) * tileSize,
      y: (y - bounds.y) * tileSize,
      width: tileSize,
      height: tileSize,
      rotation: 0,
    };
  });
}
