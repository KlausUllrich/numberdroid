import { describe, expect, it } from "vitest";
import { createFloorState } from "./save";
import {
  advanceFloorScript,
  dismissActiveStoryBeat,
  nextScheduledScriptDeadline,
  storyBeatIsBlocking,
} from "./scriptRuntime";
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
        { id: "timer-once", kind: "timer", sourceKind: "timer", sourceId: "boot-delay", sourceCells: [], eventIds: ["timer-flag"], once: true, delayMs: 300 },
        { id: "timer-repeat", kind: "timer", sourceKind: "timer", sourceId: "pulse", sourceCells: [], eventIds: ["pulse-flag"], once: false, delayMs: 400 },
      ],
      events: [
        { id: "grant-key", kind: "grant-key", keyId: "key-a" },
        { id: "unlock-door", kind: "unlock-door", doorId: "door-a" },
        { id: "set-arrived", kind: "set-flag", flag: "arrived", value: true },
        { id: "timer-flag", kind: "set-flag", flag: "timer-fired", value: true },
        { id: "pulse-flag", kind: "set-flag", flag: "pulse-fired", value: true },
        { id: "story", kind: "story-beat", beatId: "test.story", blocking: true },
      ],
    },
  };
}

function onlyTriggers(...ids: string[]) {
  const testFloor = floor();
  if (testFloor.script) testFloor.script.triggers = testFloor.script.triggers.filter((trigger) => ids.includes(trigger.id));
  return testFloor;
}

describe("v0.8.1 floor script runtime", () => {
  it("executes ordered collect events and persists once-fired trigger state", () => {
    const testFloor = onlyTriggers("collect-card");
    const before = createFloorState(testFloor, 1);
    const candidate = { ...before, collectedPickupIds: ["card-a"] };
    const result = advanceFloorScript(testFloor, before, candidate, { nowMs: 1000 });
    expect(result.firedTriggerIds).toContain("collect-card");
    expect(result.state.accessKeyIds).toContain("key-a");
    expect(result.state.scriptState.doorStates["door-a"]).toBe("unlocked");
    expect(result.state.scriptState.firedTriggerIds).toContain("collect-card");

    const repeated = advanceFloorScript(testFloor, result.state, result.state, { nowMs: 1100 });
    expect(repeated.firedTriggerIds).not.toContain("collect-card");
  });

  it("fires zone entry, cascades state-change triggers and blocks on a Story Beat", () => {
    const testFloor = onlyTriggers("enter-beat", "arrived-chain");
    const before = createFloorState(testFloor, 1);
    const candidate = { ...before, x: 96 };
    const result = advanceFloorScript(testFloor, before, candidate, { nowMs: 1000 });
    expect(result.firedTriggerIds).toEqual(expect.arrayContaining(["enter-beat", "arrived-chain"]));
    expect(result.state.scriptState.flags.arrived).toBe(true);
    expect(result.state.scriptState.activeStoryBeatId).toBe("test.story");
    expect(storyBeatIsBlocking(testFloor, "test.story")).toBe(true);

    const dismissed = dismissActiveStoryBeat(result.state);
    expect(dismissed.scriptState.activeStoryBeatId).toBeNull();
  });

  it("persists an absolute delayed edge deadline and fires it once when due", () => {
    const testFloor = onlyTriggers("delayed");
    const before = createFloorState(testFloor, 1);
    const entered = { ...before, x: 160 };
    const scheduled = advanceFloorScript(testFloor, before, entered, { nowMs: 1000 });

    expect(scheduled.firedTriggerIds).not.toContain("delayed");
    expect(scheduled.state.scriptState.scheduledTriggers.delayed).toEqual({ scheduledAtMs: 1000, dueAtMs: 1500 });
    expect(nextScheduledScriptDeadline(scheduled.state)).toBe(1500);

    const early = advanceFloorScript(testFloor, scheduled.state, scheduled.state, { nowMs: 1499 });
    expect(early.firedTriggerIds).not.toContain("delayed");
    expect(early.state.scriptState.scheduledTriggers.delayed?.dueAtMs).toBe(1500);

    const due = advanceFloorScript(testFloor, early.state, early.state, { nowMs: 1500 });
    expect(due.firedTriggerIds).toContain("delayed");
    expect(due.state.scriptState.firedTriggerIds).toContain("delayed");
    expect(due.state.scriptState.scheduledTriggers.delayed).toBeUndefined();
    expect(due.state.scriptState.activeStoryBeatId).toBe("test.story");
  });

  it("keeps a scheduled deadline unchanged through a save-like JSON round trip", () => {
    const testFloor = onlyTriggers("delayed");
    const before = createFloorState(testFloor, 1);
    const scheduled = advanceFloorScript(testFloor, before, { ...before, x: 160 }, { nowMs: 5000 });
    const restored = JSON.parse(JSON.stringify(scheduled.state)) as typeof scheduled.state;

    expect(restored.scriptState.scheduledTriggers.delayed.dueAtMs).toBe(5500);
    const resumed = advanceFloorScript(testFloor, restored, restored, { nowMs: 5600 });
    expect(resumed.firedTriggerIds).toEqual(["delayed"]);
    expect(resumed.state.scriptState.scheduledTriggers.delayed).toBeUndefined();
  });

  it("automatically schedules and fires a one-shot timer Trigger", () => {
    const testFloor = onlyTriggers("timer-once");
    const before = createFloorState(testFloor, 1);
    const initialized = advanceFloorScript(testFloor, before, before, { nowMs: 2000 });
    expect(initialized.state.scriptState.scheduledTriggers["timer-once"]).toEqual({ scheduledAtMs: 2000, dueAtMs: 2300 });

    const due = advanceFloorScript(testFloor, initialized.state, initialized.state, { nowMs: 2300 });
    expect(due.firedTriggerIds).toEqual(["timer-once"]);
    expect(due.state.scriptState.flags["timer-fired"]).toBe(true);
    expect(due.state.scriptState.firedTriggerIds).toContain("timer-once");
    expect(nextScheduledScriptDeadline(due.state)).toBeNull();
  });

  it("reschedules recurring timers from the actual firing time without catch-up bursts", () => {
    const testFloor = onlyTriggers("timer-repeat");
    const before = createFloorState(testFloor, 1);
    const initialized = advanceFloorScript(testFloor, before, before, { nowMs: 1000 });
    expect(initialized.state.scriptState.scheduledTriggers["timer-repeat"].dueAtMs).toBe(1400);

    // Simulate a suspended/backgrounded app resuming well after the deadline.
    const resumed = advanceFloorScript(testFloor, initialized.state, initialized.state, { nowMs: 3000 });
    expect(resumed.firedTriggerIds).toEqual(["timer-repeat"]);
    expect(resumed.state.scriptState.flags["pulse-fired"]).toBe(true);
    expect(resumed.state.scriptState.scheduledTriggers["timer-repeat"]).toEqual({ scheduledAtMs: 3000, dueAtMs: 3400 });
  });
});
