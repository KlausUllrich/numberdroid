import { describe, expect, it } from "vitest";
import { floorGoalCompleted } from "./campaign";
import { DECK_C3, DECK_VS2 } from "./floors";
import { createFloorState } from "./save";

describe("campaign floor goals", () => {
  it("does not finish B2 before the authored control action", () => {
    const meta = createFloorState(DECK_VS2);
    expect(floorGoalCompleted(meta, DECK_VS2)).toBe(false);
  });

  it("finishes B2 only after its authored goal action is complete", () => {
    const meta = createFloorState(DECK_VS2);
    const goal = DECK_VS2.goal;
    expect(goal?.kind).toBe("complete-action");
    if (!goal || goal.kind !== "complete-action") throw new Error("B2 goal changed unexpectedly");
    expect(floorGoalCompleted({ ...meta, completedActionIds: [goal.actionId] }, DECK_VS2)).toBe(true);
  });

  it("finishes C3 only after its own control action, independent from B2 state", () => {
    const meta = createFloorState(DECK_C3);
    const goal = DECK_C3.goal;
    expect(goal?.kind).toBe("complete-action");
    if (!goal || goal.kind !== "complete-action") throw new Error("C3 goal changed unexpectedly");
    expect(floorGoalCompleted(meta, DECK_C3)).toBe(false);
    expect(floorGoalCompleted({ ...meta, completedActionIds: [goal.actionId] }, DECK_C3)).toBe(true);
  });
});
