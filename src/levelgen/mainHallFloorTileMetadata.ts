import type { CardinalDirection } from "./types";

export type MainHallFloorTileRole =
  | "base"
  | "service"
  | "straight"
  | "junction-cross"
  | "junction-t"
  | "corner"
  | "threshold"
  | "terminal"
  | "arrow"
  | "wear";

export type MainHallFloorTileMetadata = {
  index: number;
  role: MainHallFloorTileRole;
  /** Source-space route connectors before runtime rotation. */
  connectors: CardinalDirection[];
  /** Route graphics may only join tiles with the same continuity profile. */
  continuityProfile?: "hall-traffic-wide";
  /** Higher wins when multiple source tiles satisfy the same semantic request. */
  selectionPriority?: number;
  /** Source tile is approved for automatic runtime placement. */
  runtimeEligible: boolean;
  /** Safe to use directly beside a solid Hall wall when not a threshold. */
  wallSafe: boolean;
  arrowDirection?: CardinalDirection;
  /** Human-readable production note; kept with the asset instead of in placement code. */
  note?: string;
};

const tile = (
  index: number,
  role: MainHallFloorTileRole,
  options: Omit<MainHallFloorTileMetadata, "index" | "role">,
): MainHallFloorTileMetadata => ({ index, role, ...options });

/**
 * Source-authored metadata for every cell in the approved 6x6 Main Hall atlas.
 *
 * This is deliberately explicit. Generated imagery is not a semantic tileset:
 * visually similar cells can have different edge geometry, continuity or wall
 * suitability. Placement code must consume this catalog rather than choose raw
 * atlas indices randomly.
 */
export const MAIN_HALL_FLOOR_TILE_METADATA: readonly MainHallFloorTileMetadata[] = [
  tile(0, "base", { connectors: [], runtimeEligible: true, wallSafe: true, selectionPriority: 100 }),
  tile(1, "base", { connectors: [], runtimeEligible: true, wallSafe: true, selectionPriority: 90 }),
  tile(2, "base", { connectors: [], runtimeEligible: true, wallSafe: true, selectionPriority: 80 }),
  tile(3, "base", { connectors: [], runtimeEligible: true, wallSafe: true, selectionPriority: 70 }),
  tile(4, "service", { connectors: [], runtimeEligible: true, wallSafe: false, selectionPriority: 40 }),
  tile(5, "service", { connectors: [], runtimeEligible: true, wallSafe: false, selectionPriority: 40 }),

  tile(6, "straight", { connectors: ["east", "west"], continuityProfile: "hall-traffic-wide", runtimeEligible: true, wallSafe: false, selectionPriority: 40 }),
  tile(7, "straight", { connectors: ["east", "west"], continuityProfile: "hall-traffic-wide", runtimeEligible: true, wallSafe: false, selectionPriority: 100, note: "Primary horizontal Hall traffic segment." }),
  tile(8, "straight", { connectors: ["east", "west"], continuityProfile: "hall-traffic-wide", runtimeEligible: true, wallSafe: false, selectionPriority: 30 }),
  tile(9, "straight", { connectors: ["north", "south"], continuityProfile: "hall-traffic-wide", runtimeEligible: true, wallSafe: false, selectionPriority: 40 }),
  tile(10, "straight", { connectors: ["north", "south"], continuityProfile: "hall-traffic-wide", runtimeEligible: true, wallSafe: false, selectionPriority: 100, note: "Primary vertical Hall traffic segment." }),
  tile(11, "straight", { connectors: ["north", "south"], continuityProfile: "hall-traffic-wide", runtimeEligible: true, wallSafe: false, selectionPriority: 30 }),

  tile(12, "junction-cross", { connectors: ["north", "east", "south", "west"], continuityProfile: "hall-traffic-wide", runtimeEligible: true, wallSafe: false, selectionPriority: 100 }),
  tile(13, "junction-t", { connectors: ["east", "south", "west"], continuityProfile: "hall-traffic-wide", runtimeEligible: true, wallSafe: false, selectionPriority: 100, note: "Canonical T: missing north. Rotate for all four runtime orientations." }),
  tile(14, "junction-t", { connectors: [], continuityProfile: "hall-traffic-wide", runtimeEligible: false, wallSafe: false, note: "Generated alternate has uncalibrated edge-port offsets; quarantined." }),
  tile(15, "junction-t", { connectors: [], continuityProfile: "hall-traffic-wide", runtimeEligible: false, wallSafe: false, note: "Generated alternate has uncalibrated edge-port offsets; quarantined." }),
  tile(16, "junction-t", { connectors: [], continuityProfile: "hall-traffic-wide", runtimeEligible: false, wallSafe: false, note: "Generated alternate has uncalibrated edge-port offsets; quarantined." }),

  tile(17, "corner", { connectors: ["south", "west"], continuityProfile: "hall-traffic-wide", runtimeEligible: true, wallSafe: false, selectionPriority: 100, note: "Canonical corner. Rotate for all four runtime orientations." }),
  tile(18, "corner", { connectors: [], continuityProfile: "hall-traffic-wide", runtimeEligible: false, wallSafe: false, note: "Generated alternate retained as source reference; not auto-placed." }),
  tile(19, "corner", { connectors: [], continuityProfile: "hall-traffic-wide", runtimeEligible: false, wallSafe: false, note: "Generated alternate retained as source reference; not auto-placed." }),
  tile(20, "corner", { connectors: [], continuityProfile: "hall-traffic-wide", runtimeEligible: false, wallSafe: false, note: "Generated alternate retained as source reference; not auto-placed." }),

  tile(21, "threshold", { connectors: [], runtimeEligible: true, wallSafe: true, selectionPriority: 100, note: "Canonical threshold, authored on south edge; rotate to connection side." }),
  tile(22, "threshold", { connectors: [], runtimeEligible: false, wallSafe: true, note: "Alternate threshold reserved until calibrated." }),
  tile(23, "terminal", { connectors: ["south"], continuityProfile: "hall-traffic-wide", runtimeEligible: true, wallSafe: true, selectionPriority: 100, note: "Canonical route end: traffic enters from south and terminates before north wall." }),

  tile(24, "service", { connectors: [], runtimeEligible: true, wallSafe: false, selectionPriority: 30 }),
  tile(25, "service", { connectors: [], runtimeEligible: true, wallSafe: false, selectionPriority: 30 }),
  tile(26, "service", { connectors: [], runtimeEligible: true, wallSafe: false, selectionPriority: 30 }),
  tile(27, "service", { connectors: [], runtimeEligible: true, wallSafe: false, selectionPriority: 30 }),
  tile(28, "service", { connectors: [], runtimeEligible: true, wallSafe: false, selectionPriority: 30 }),
  tile(29, "service", { connectors: [], runtimeEligible: true, wallSafe: false, selectionPriority: 30 }),

  tile(30, "arrow", { connectors: [], runtimeEligible: false, wallSafe: true, arrowDirection: "north", note: "Reserved for authored route/signage semantics." }),
  tile(31, "arrow", { connectors: [], runtimeEligible: false, wallSafe: true, arrowDirection: "east", note: "Reserved for authored route/signage semantics." }),
  tile(32, "arrow", { connectors: [], runtimeEligible: false, wallSafe: true, arrowDirection: "south", note: "Reserved for authored route/signage semantics." }),
  tile(33, "arrow", { connectors: [], runtimeEligible: false, wallSafe: true, arrowDirection: "west", note: "Reserved for authored route/signage semantics." }),
  tile(34, "wear", { connectors: [], runtimeEligible: true, wallSafe: true, selectionPriority: 30 }),
  tile(35, "wear", { connectors: [], runtimeEligible: true, wallSafe: true, selectionPriority: 20 }),
] as const;

export const MAIN_HALL_TILE_BY_INDEX = new Map(MAIN_HALL_FLOOR_TILE_METADATA.map((entry) => [entry.index, entry]));

const ROTATIONS = [0, 90, 180, 270] as const;
export type QuarterRotation = typeof ROTATIONS[number];

export function rotateDirection(direction: CardinalDirection, rotation: QuarterRotation): CardinalDirection {
  const order: CardinalDirection[] = ["north", "east", "south", "west"];
  const index = order.indexOf(direction);
  return order[(index + rotation / 90) % 4];
}

export function rotatedConnectors(tileMetadata: MainHallFloorTileMetadata, rotation: QuarterRotation) {
  return tileMetadata.connectors.map((direction) => rotateDirection(direction, rotation));
}

function directionKey(directions: readonly CardinalDirection[]) {
  return [...directions].sort().join("+");
}

/** Resolve one exact semantic route signature to a calibrated atlas cell + rotation. */
export function resolveMainHallNetworkTile(required: readonly CardinalDirection[]) {
  const requiredKey = directionKey(required);
  const candidates: Array<{ tile: MainHallFloorTileMetadata; rotation: QuarterRotation }> = [];

  for (const tileMetadata of MAIN_HALL_FLOOR_TILE_METADATA) {
    if (!tileMetadata.runtimeEligible || !tileMetadata.continuityProfile || tileMetadata.connectors.length === 0) continue;
    for (const rotation of ROTATIONS) {
      if (directionKey(rotatedConnectors(tileMetadata, rotation)) === requiredKey) {
        candidates.push({ tile: tileMetadata, rotation });
      }
    }
  }

  candidates.sort((a, b) => {
    const priority = (b.tile.selectionPriority ?? 0) - (a.tile.selectionPriority ?? 0);
    if (priority !== 0) return priority;
    // Prefer source-native orientation over a rotated duplicate when both exist.
    if (a.rotation !== b.rotation) return a.rotation - b.rotation;
    return a.tile.index - b.tile.index;
  });

  return candidates[0] ?? null;
}
