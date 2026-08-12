import { describe, expect, it } from "vitest";
import { STARTING_HP } from "./catalog";
import { DECK_VS2 } from "./floors";
import { createFloorState } from "./save";
import { retreatAfterDuelLoss } from "./duelLoss";

describe("duel loss retreat", () => {
  it("returns the active body to level start while preserving deck progress", () => {
    const previous = {
      ...createFloorState(DECK_VS2, 2),
      x: DECK_VS2.start.x + 600,
      y: DECK_VS2.start.y + 300,
      facing: 1.7,
      metaEnergy: 2,
      usedStationIds: ["used-station"],
      collectedPickupIds: ["collected-pickup"],
      accessKeyIds: ["earned-key"],
      completedActionIds: ["completed-action"],
      currentBody: "magnetar" as const,
      currentDeckSize: "large" as const,
      defeatedEncounterIds: ["defeated-robot"],
      damageTaken: 1,
    };

    const next = retreatAfterDuelLoss(previous, DECK_VS2);

    expect(next.x).toBe(DECK_VS2.start.x);
    expect(next.y).toBe(DECK_VS2.start.y);
    expect(next.facing).toBe(DECK_VS2.start.facing);
    expect(next.damageTaken).toBe(2);
    expect(next.currentBody).toBe("magnetar");
    expect(next.currentDeckSize).toBe("large");
    expect(next.metaEnergy).toBe(2);
    expect(next.usedStationIds).toEqual(previous.usedStationIds);
    expect(next.collectedPickupIds).toEqual(previous.collectedPickupIds);
    expect(next.accessKeyIds).toEqual(previous.accessKeyIds);
    expect(next.completedActionIds).toEqual(previous.completedActionIds);
    expect(next.defeatedEncounterIds).toEqual(previous.defeatedEncounterIds);
  });

  it("never increases damage beyond the mission HP limit", () => {
    const previous = {
      ...createFloorState(DECK_VS2),
      damageTaken: STARTING_HP,
    };

    expect(retreatAfterDuelLoss(previous, DECK_VS2).damageTaken).toBe(STARTING_HP);
  });
});
