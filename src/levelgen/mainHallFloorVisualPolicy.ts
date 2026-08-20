import type { CardinalDirection } from "./types";

/**
 * Main Hall floor policy distilled from live visual QA.
 *
 * The Hall's route language is a circulation spine, not a wiring diagram. Room
 * doors are material transitions only. T/cross/corner graphics are reserved for
 * true corridor-to-corridor topology changes, where the circulation path itself
 * branches. A room threshold must not create a visual route terminal immediately
 * before the doorway; the circulation spine remains continuous through it.
 */
export const MAIN_HALL_FLOOR_VISUAL_POLICY = {
  baseTileIndex: 0,
  sourceFrameInsetPx: 24,
  roomConnectionsBranchSpine: false,
  corridorConnectionsBranchSpine: true,
  roomConnectionThresholds: true,
  roomThresholdKeepsSpineContinuous: true,
  reserveDecorativeServiceAndWear: true,
  routeContinuityProfile: "hall-traffic-wide",
} as const;

export type MainHallFloorConnectionClass = "room" | "corridor";

export function shouldBranchMainHallSpine(connectionClass: MainHallFloorConnectionClass) {
  return connectionClass === "corridor"
    ? MAIN_HALL_FLOOR_VISUAL_POLICY.corridorConnectionsBranchSpine
    : MAIN_HALL_FLOOR_VISUAL_POLICY.roomConnectionsBranchSpine;
}

export function inwardDirection(side: CardinalDirection): CardinalDirection {
  if (side === "north") return "south";
  if (side === "south") return "north";
  if (side === "east") return "west";
  return "east";
}
