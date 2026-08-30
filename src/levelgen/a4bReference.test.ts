import { describe, expect, it } from "vitest";
import { createFloorState, sanitizeMetaStateForFloor } from "../game/save";
import {
  advanceFloorScript,
  floorPickupIsAvailable,
  storyBeatDisplayText,
  storyBeatIsBlocking,
} from "../game/scriptRuntime";
import { compileLevelSpec } from "./compiler";
import { compileRuntimeLevel } from "./emission";
import { NUMBERDROID_PROP_REGISTRY } from "./propRegistry";
import { floorWithCompiledScript } from "./runtimeScriptContract";
import { A4B_REFERENCE_LEVEL_SPEC } from "./specs/a4bReference";
import type { LevelSpec } from "./types";

function compileSemantic(spec: LevelSpec = A4B_REFERENCE_LEVEL_SPEC) {
  return compileLevelSpec(spec, NUMBERDROID_PROP_REGISTRY);
}

function compileFloor() {
  return floorWithCompiledScript(compileRuntimeLevel(A4B_REFERENCE_LEVEL_SPEC, NUMBERDROID_PROP_REGISTRY));
}

function mutate(mutator: (spec: LevelSpec) => void) {
  const spec = structuredClone(A4B_REFERENCE_LEVEL_SPEC);
  mutator(spec);
  return () => compileSemantic(spec);
}

describe("A4b actor-defeated key reference", () => {
  it("compiles one lossless typed program through semantic, Tiled and runtime contracts", () => {
    const plan = compileRuntimeLevel(A4B_REFERENCE_LEVEL_SPEC, NUMBERDROID_PROP_REGISTRY);
    const semantic = plan.events.actors.props.navigation.geometry.semantic;
    const floor = floorWithCompiledScript(plan);

    expect(semantic.variables).toEqual(A4B_REFERENCE_LEVEL_SPEC.variables);
    expect(semantic.textReferences).toEqual(A4B_REFERENCE_LEVEL_SPEC.textReferences);
    expect(plan.events.pickups).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "guard-key", initiallyPresent: false }),
    ]));
    expect(plan.events.triggers.find((trigger) => trigger.id === "trigger.guard-defeated")?.source).toMatchObject({
      kind: "actor",
      id: "guard-actor",
    });
    expect(plan.events.triggers.find((trigger) => trigger.id === "trigger.guard-key-state")?.source).toMatchObject({
      kind: "variable",
      id: "state.guard-key-collected",
    });
    expect(floor.pickups[0]).toMatchObject({ id: "guard-key", initiallyPresent: false });
    expect(floor.script?.variables).toEqual(A4B_REFERENCE_LEVEL_SPEC.variables);
    expect(floor.script?.textReferences).toEqual(A4B_REFERENCE_LEVEL_SPEC.textReferences);
    expect(floor.script?.events.map((event) => event.kind)).toEqual(["drop-item", "set-variable", "show-text"]);
  });

  it("runs defeat → drop → pickup → Boolean → exact visible text without granting the key on drop", () => {
    const floor = compileFloor();
    const initial = createFloorState(floor, 1);
    expect(initial.scriptState.flags["state.guard-key-collected"]).toBe(false);
    expect(floorPickupIsAvailable(floor, initial, "guard-key")).toBe(false);

    const defeatedCandidate = { ...initial, defeatedEncounterIds: ["guard-actor"] };
    const dropped = advanceFloorScript(floor, initial, defeatedCandidate, { nowMs: 1_000 });
    expect(dropped.firedTriggerIds).toEqual(["trigger.guard-defeated"]);
    expect(floorPickupIsAvailable(floor, dropped.state, "guard-key")).toBe(true);
    expect(dropped.state.accessKeyIds).toEqual([]);

    const collectedCandidate = {
      ...dropped.state,
      collectedPickupIds: ["guard-key"],
      accessKeyIds: ["guard-access"],
    };
    const collected = advanceFloorScript(floor, dropped.state, collectedCandidate, { nowMs: 1_100 });
    expect(collected.firedTriggerIds).toEqual(["trigger.guard-key-collected", "trigger.guard-key-state"]);
    expect(collected.state.scriptState.flags["state.guard-key-collected"]).toBe(true);
    expect(collected.state.scriptState.activeStoryBeatId).toBe("text.guard-key-collected");
    expect(storyBeatIsBlocking(floor, "text.guard-key-collected")).toBe(true);
    expect(storyBeatDisplayText(floor, "text.guard-key-collected")).toBe("<SYSTEM> WÄCHTER-ZUGANG GESICHERT");

    const repeated = advanceFloorScript(floor, collected.state, collected.state, { nowMs: 1_200 });
    expect(repeated.firedTriggerIds).toEqual([]);
  });

  it("isolates the duel return to the defeat edge instead of firing unrelated movement triggers", () => {
    const floor = structuredClone(compileFloor());
    const initial = createFloorState(floor, 1);
    const tileSize = floor.script!.tileSize;
    const transferCandidate = { ...initial, defeatedEncounterIds: ["guard-actor"] };
    floor.script!.events.push({ id: "action.unrelated-enter", kind: "set-flag", flag: "legacy.unrelated", value: true });
    floor.script!.triggers.push({
      id: "trigger.unrelated-enter",
      kind: "enter-space",
      sourceKind: "space",
      sourceId: "guard-room",
      sourceCells: [{ x: Math.floor(initial.x / tileSize), y: Math.floor(initial.y / tileSize) }],
      eventIds: ["action.unrelated-enter"],
      once: true,
      delayMs: 0,
    });

    const preTransferPosition = { ...initial, x: initial.x + tileSize * 10 };
    expect(advanceFloorScript(floor, preTransferPosition, transferCandidate).firedTriggerIds).toContain("trigger.unrelated-enter");

    const defeatPrevious = { ...transferCandidate, defeatedEncounterIds: initial.defeatedEncounterIds };
    const isolated = advanceFloorScript(floor, defeatPrevious, transferCandidate);
    expect(isolated.firedTriggerIds).toEqual(["trigger.guard-defeated"]);
    expect(isolated.state.scriptState.flags["legacy.unrelated"]).toBeUndefined();
  });

  it("does not fire on defeat loss and fail-closes manipulated or ill-typed save state", () => {
    const floor = compileFloor();
    const initial = createFloorState(floor, 1);
    expect(advanceFloorScript(floor, initial, initial, { nowMs: 2_000 }).firedTriggerIds).toEqual([]);

    const rawFlags = Object.assign(Object.create(null), {
      "state.guard-key-collected": "true",
      unknown: true,
      __proto__: true,
    });
    const manipulated = sanitizeMetaStateForFloor({
      ...initial,
      collectedPickupIds: ["guard-key"],
      accessKeyIds: ["guard-access"],
      scriptState: {
        ...initial.scriptState,
        flags: rawFlags,
        firedTriggerIds: ["trigger.guard-defeated"],
      },
    }, floor);
    expect(manipulated.collectedPickupIds).toEqual([]);
    expect(manipulated.accessKeyIds).toEqual([]);
    expect(manipulated.scriptState.firedTriggerIds).toEqual([]);
    expect(manipulated.scriptState.flags).toEqual({ "state.guard-key-collected": false });

    const defeated = advanceFloorScript(floor, initial, { ...initial, defeatedEncounterIds: ["guard-actor"] }).state;
    const restored = sanitizeMetaStateForFloor(JSON.parse(JSON.stringify(defeated)), floor);
    expect(restored.scriptState.firedTriggerIds).toContain("trigger.guard-defeated");
    expect(floorPickupIsAvailable(floor, restored, "guard-key")).toBe(true);
  });

  it("rejects broken actor, drop, Boolean and text contracts before geometry", () => {
    const cases: Array<[string, () => unknown, RegExp]> = [
      ["missing archetype", mutate((spec) => { delete spec.encounters[0].actorArchetype; }), /immutable actorArchetype pin/],
      ["staged actor", mutate((spec) => {
        spec.stagedActors = [{ id: "staged-guard", actorType: "guard" }];
        spec.triggers![0].sourceId = "staged-guard";
      }), /unknown encounter actor staged-guard/],
      ["missing route", mutate((spec) => { delete spec.encounters[0].patrolRouteId; }), /requires patrolRouteId/],
      ["wrong drop actor", mutate((spec) => {
        const event = spec.events![0];
        if (event.kind === "drop-item") event.actorId = "other-actor";
      }), /unknown encounter actor other-actor/],
      ["static pickup", mutate((spec) => { spec.pickups![0].initiallyPresent = true; }), /requires hidden pickup/],
      ["duplicate drop producer", mutate((spec) => {
        spec.events!.push({ id: "action.drop-again", kind: "drop-item", actorId: "guard-actor", pickupId: "guard-key" });
        spec.triggers!.push({ id: "trigger.drop-again", kind: "actor-defeated", sourceId: "guard-actor", eventIds: ["action.drop-again"], once: true, delayMs: 0 });
      }), /more than one drop-item Event/],
      ["non-once defeat", mutate((spec) => { spec.triggers![0].once = false; }), /must be once-only/],
      ["unknown variable", mutate((spec) => {
        const event = spec.events![1];
        if (event.kind === "set-variable") event.variableId = "state.unknown";
      }), /unknown Boolean variable/],
      ["non-Boolean assignment", mutate((spec) => {
        const event = spec.events![1];
        if (event.kind === "set-variable") (event as { value: unknown }).value = "true";
      }), /must assign a Boolean value/],
      ["legacy typed-variable write", mutate((spec) => {
        spec.events!.push({ id: "action.legacy-write", kind: "set-flag", flag: "state.guard-key-collected", value: "bad" });
      }), /cannot write declared Boolean variable/],
      ["unknown text", mutate((spec) => {
        const event = spec.events![2];
        if (event.kind === "show-text") event.textRefId = "text.unknown";
      }), /unknown visible text/],
      ["empty text", mutate((spec) => { spec.textReferences![0].text = "   "; }), /1 to 4096/],
      ["story id collision", mutate((spec) => {
        spec.events!.push({ id: "action.story", kind: "story-beat", beatId: "text.guard-key-collected", blocking: true });
      }), /collides with an existing story-beat/],
    ];
    for (const [label, action, expected] of cases) {
      expect(action, label).toThrow(expected);
    }
  });

  it("admits 512 declared Boolean variables and rejects 513", () => {
    const bounded = structuredClone(A4B_REFERENCE_LEVEL_SPEC);
    bounded.variables = Array.from({ length: 512 }, (_, index) => ({
      id: `state.limit-${index}`,
      type: "boolean" as const,
      initialValue: false,
    }));
    const setEvent = bounded.events![1];
    const stateTrigger = bounded.triggers![2];
    if (setEvent.kind === "set-variable") setEvent.variableId = bounded.variables[0].id;
    stateTrigger.sourceId = bounded.variables[0].id;
    expect(() => compileSemantic(bounded)).not.toThrow();

    bounded.variables.push({ id: "state.limit-512", type: "boolean", initialValue: false });
    expect(() => compileSemantic(bounded)).toThrow(/at most 512 variables/);
  });
});
