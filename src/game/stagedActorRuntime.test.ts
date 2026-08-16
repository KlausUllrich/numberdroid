import { describe, expect, it } from "vitest";
import { createFloorState } from "./save";
import {
  advanceFloorScript,
  completeStagedActorPassby,
  setStagedActorsPaused,
} from "./scriptRuntime";
import { stagedActorPose } from "./stagedActorRuntime";
import type { FloorDefinition, FloorStagedActorDefinition } from "./types";
import type { StagedActorPresentation } from "./stagedActorCatalog";

const presentation: StagedActorPresentation = {
  actorType: "test-creature",
  label: "TEST CREATURE",
  kind: "creature",
  widthPx: 100,
  heightPx: 60,
  speedPxPerSecond: 100,
};

function floor(): FloorDefinition {
  return {
    id: "staged-actor-test",
    name: "STAGED ACTOR TEST",
    subtitle: "TEST",
    width: 256,
    height: 128,
    visual: { kind: "image", asset: "" },
    start: { x: 32, y: 32, facing: 0, bodyId: "pico", metaEnergy: 0 },
    objectives: { default: "TEST", afterEnergy: "TEST" },
    walkable: [{ x: 0, y: 0, w: 256, h: 128 }],
    obstacles: [],
    rooms: [{ id: "room-a", label: "ROOM A", x: 0, y: 0, w: 256, h: 128 }],
    doors: [],
    pickups: [],
    actions: [],
    energyStations: [],
    encounters: [],
    script: {
      tileSize: 64,
      routes: [{ id: "pass", kind: "passby", loop: false, points: [{ x: 20, y: 64 }, { x: 220, y: 64 }] }],
      stagedActors: [{ id: "creature", actorType: "test-creature", initiallyPresent: false, defaultSpaceId: "room-a" }],
      triggers: [{ id: "start", kind: "interact", sourceKind: "prop", sourceId: "start-source", sourceCells: [], eventIds: ["pass-event"], once: true, delayMs: 0 }],
      events: [{ id: "pass-event", kind: "actor-passby", actorId: "creature", routeId: "pass", durationMs: 2000 }],
    },
  };
}

const actor: FloorStagedActorDefinition = {
  id: "creature",
  actorType: "test-creature",
  initiallyPresent: false,
  defaultSpaceId: "room-a",
};

describe("staged actor runtime", () => {
  it("derives pass-by pose from persisted start time without storing frame coordinates", () => {
    const testFloor = floor();
    const state = { present: true, mode: "passby" as const, routeId: "pass", durationMs: 2000, startedAtMs: 1000 };
    const halfway = stagedActorPose(testFloor, actor, state, presentation, 2000);
    expect(halfway?.x).toBeCloseTo(120, 4);
    expect(halfway?.y).toBeCloseTo(64, 4);
    expect(halfway?.progress).toBeCloseTo(0.5, 4);
    expect(halfway?.complete).toBe(false);

    const done = stagedActorPose(testFloor, actor, state, presentation, 3200);
    expect(done?.x).toBeCloseTo(220, 4);
    expect(done?.complete).toBe(true);
  });

  it("records event start time, freezes route clocks during pause, and resumes without jumping", () => {
    const testFloor = floor();
    const initial = createFloorState(testFloor, 1);
    const started = advanceFloorScript(testFloor, initial, initial, { interactionSourceId: "start-source", nowMs: 1000 }).state;
    expect(started.scriptState.stagedActors.creature).toMatchObject({
      present: true,
      mode: "passby",
      routeId: "pass",
      durationMs: 2000,
      startedAtMs: 1000,
    });

    const paused = setStagedActorsPaused(started, true, 1400);
    expect(paused.scriptState.stagedActors.creature.pausedAtMs).toBe(1400);
    const frozenPose = stagedActorPose(testFloor, actor, paused.scriptState.stagedActors.creature, presentation, 1900);
    expect(frozenPose?.progress).toBeCloseTo(0.2, 4);

    const resumed = setStagedActorsPaused(paused, false, 1900);
    expect(resumed.scriptState.stagedActors.creature.startedAtMs).toBe(1500);
    expect(resumed.scriptState.stagedActors.creature.pausedAtMs).toBeUndefined();
    const resumedPose = stagedActorPose(testFloor, actor, resumed.scriptState.stagedActors.creature, presentation, 1900);
    expect(resumedPose?.progress).toBeCloseTo(0.2, 4);
  });

  it("persists completion of a one-shot pass-by as actor absence", () => {
    const testFloor = floor();
    const initial = createFloorState(testFloor, 1);
    const started = advanceFloorScript(testFloor, initial, initial, { interactionSourceId: "start-source", nowMs: 1000 }).state;
    const complete = completeStagedActorPassby(started, "creature");
    expect(complete.scriptState.stagedActors.creature).toMatchObject({ present: false, mode: "idle" });
    expect(complete.scriptState.stagedActors.creature.routeId).toBeUndefined();
    expect(complete.scriptState.stagedActors.creature.startedAtMs).toBeUndefined();
  });
});
