import { STARTING_HP } from "./catalog";
import type { FloorDefinition, MetaState } from "./types";

export function retreatAfterDuelLoss(previous: MetaState, floor: FloorDefinition): MetaState {
  return {
    ...previous,
    x: floor.start.x,
    y: floor.start.y,
    facing: floor.start.facing,
    damageTaken: Math.min(STARTING_HP, previous.damageTaken + 1),
  };
}
