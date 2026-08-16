import { describe, expect, it } from "vitest";
import { createFloorState } from "./save";
import { advanceFloorScript, dismissActiveStoryBeat, storyBeatIsBlocking } from "./scriptRuntime";
import type { FloorDefinition } from "./types";

function floor(): FloorDefinition {
  return {
    id: "script-test",
    name: "SCRIPT TEST",
    subtitle: "TEST",
    width: 192,
    height: 64,
    visual: { kind: "image", asset: "" },
    start: { x: 32, y: 32, facing: 0, bodyId: "pico", metaEnergy: 0 },
    objectives: { default: "TEST", afterEnergy: "TEST" },
    walkable: [{ x: 0, y: 0, w: 192, h: 64 }],
    obstacles: [],
    rooms: [],
    doors: [{ id: "door-a", x: 120, y: 0, w: 12, h: 64, orientation: "vertical", mode: "locked", size: "standard", openRadius: 118, keyId: "key-a" }],
    pickups: [{ id: "card-a", kind: "access-key", keyId: "key-a", label: "CARD A", x: 32, y: 32 }],
    actions: [],
    energyStations: [],
    encounters: [],
    script: {
      tileSize: 64,
      routes: [],
      stagedActors: [],
      triggers: [
        { id: "collect-card", kind: "collect", sourceKind: "pickup", sourceId: "card-a", sourceCells: [{ x: 0, y: 0 }], eventIds: ["grant-key", "unlock-door"], once: true, delayMs: 0 },
        { id: "enter-beat", kind: "enter-zone", sourceKind: "zone", sourceId: "beat-zone", sourceCells: [{ x: 1, y: 0 }], eventIds: ["set-arrived", "story"], once: true, delayMs: 0 },
        { id: "arrived-chain", kind: "state-change", sourceKind: "flag", sourceId: "arrived", sourceCells: [], eventIds: ["unlock-door"], once: true, delayMs: 0 },
        { id: "delayed", kind: "enter-zone", sourceKind: "zone", sourceId: "late-zone", sourceCells: [{ x: 2, y: 0 }], eventIds: ["story"], once: true, delayMs: 500 },
      ],
      events: [
        { id: "grant-key", kind: "grant-key", keyId: "key-a" },
        { id: "unlock-door", kind: "unlock-door", doorId: "door-a" },
        { id: "set-arrived", kind: "set-flag", flag: "arrived", value: true },
        { id: "story", kind: "story-beat", beatId: "test.story", blocking: true },
      ],
    },
  };
}

describe("v0.8 floor script runtime", () => {
  it("executes ordered collect events and persists once-fired trigger state", () => {
    const testFloor = floor();
    const before = createFloorState(testFloor, 1);
    const candidate = { ...before, collectedPickupIds: ["card-a"] };
    const result = advanceFloorScript(testFloor, before, candidate);
    expect(result.firedTriggerIds).toContain("collect-card");
    expect(result.state.accessKeyIds).toContain("key-a");
    expect(result.state.scriptState.doorStates["door-a"]).toBe("unlocked");
    expect(result.state.scriptState.firedTriggerIds).toContain("collect-card");

    const repeated = advanceFloorScript(testFloor, result.state, result.state);
    expect(repeated.firedTriggerIds).not.toContain("collect-card");
  });

  it("fires zone entry, cascades state-change triggers and blocks on a Story Beat", () => {
    const testFloor = floor();
    const before = createFloorState(testFloor, 1);
    const candidate = { ...before, x: 96 };
    const result = advanceFloorScript(testFloor, before, candidate);
    expect(result.firedTriggerIds).toEqual(expect.arrayContaining(["enter-beat", "arrived-chain"]));
    expect(result.state.scriptState.flags.arrived).toBe(true);
    expect(result.state.scriptState.activeStoryBeatId).toBe("test.story");
    expect(storyBeatIsBlocking(testFloor, "test.story")).toBe(true);

    const dismissed = dismissActiveStoryBeat(result.state);
    expect(dismissed.scriptState.activeStoryBeatId).toBeNull();
  });

  it("does not silently execute authored delays before scheduling support exists", () => {
    const testFloor = floor();
    const before = createFloorState(testFloor, 1);
    const candidate = { ...before, x: 160 };
    const result = advanceFloorScript(testFloor, before, candidate);
    expect(result.firedTriggerIds).not.toContain("delayed");
  });
});
