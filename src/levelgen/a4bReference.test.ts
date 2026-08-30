import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
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

    const restored = sanitizeMetaStateForFloor(JSON.parse(JSON.stringify(collected.state)), floor);
    expect(restored.collectedPickupIds).toEqual(["guard-key"]);
    expect(restored.accessKeyIds).toEqual(["guard-access"]);
    expect(restored.scriptState.flags["state.guard-key-collected"]).toBe(true);
    expect(restored.scriptState.firedTriggerIds).toEqual([
      "trigger.guard-defeated",
      "trigger.guard-key-collected",
      "trigger.guard-key-state",
    ]);
    expect(restored.scriptState.activeStoryBeatId).toBe("text.guard-key-collected");

    const repeated = advanceFloorScript(floor, collected.state, collected.state, { nowMs: 1_200 });
    expect(repeated.firedTriggerIds).toEqual([]);
  });

  it("renders HTML-shaped authored text only as an escaped React text node", () => {
    const floor = structuredClone(compileFloor());
    const hostileText = '<img src=x onerror="globalThis.pwned=true">';
    floor.script!.textReferences![0].text = hostileText;
    const markup = renderToStaticMarkup(createElement("strong", null,
      storyBeatDisplayText(floor, "text.guard-key-collected")));
    expect(markup).toContain("&lt;img src=x onerror=&quot;globalThis.pwned=true&quot;&gt;");
    expect(markup).not.toContain("<img");
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
    });
    Object.defineProperty(rawFlags, "__proto__", { value: true, enumerable: true });
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
    expect(Object.hasOwn(manipulated.scriptState.flags, "__proto__")).toBe(false);

    const downstreamOnly = sanitizeMetaStateForFloor({
      ...initial,
      scriptState: {
        ...initial.scriptState,
        flags: { "state.guard-key-collected": true },
        firedTriggerIds: ["trigger.guard-key-collected", "trigger.guard-key-state"],
        storyBeatQueue: ["text.guard-key-collected"],
        activeStoryBeatId: "text.guard-key-collected",
      },
    }, floor);
    expect(downstreamOnly.scriptState.flags).toEqual({ "state.guard-key-collected": false });
    expect(downstreamOnly.scriptState.firedTriggerIds).toEqual([]);
    expect(downstreamOnly.scriptState.storyBeatQueue).toEqual([]);
    expect(downstreamOnly.scriptState.activeStoryBeatId).toBeNull();

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
        spec.encounters.push({
          ...structuredClone(spec.encounters[0]),
          id: "other-actor",
          actorArchetype: { id: "numberdroid.sentry.other", version: 1 },
        });
        const event = spec.events![0];
        if (event.kind === "drop-item") event.actorId = "other-actor";
      }), /must be owned by an actor-defeated Trigger for actor other-actor/],
      ["static pickup", mutate((spec) => { spec.pickups![0].initiallyPresent = true; }), /requires hidden pickup/],
      ["duplicate drop producer", mutate((spec) => {
        spec.events!.push({ id: "action.drop-again", kind: "drop-item", actorId: "guard-actor", pickupId: "guard-key" });
        spec.triggers!.push({ id: "trigger.drop-again", kind: "actor-defeated", sourceId: "guard-actor", eventIds: ["action.drop-again"], once: true, delayMs: 0 });
      }), /more than one drop-item Event/],
      ["non-once defeat", mutate((spec) => { spec.triggers![0].once = false; }), /must be once-only/],
      ["delayed defeat", mutate((spec) => { spec.triggers![0].delayMs = 1; }), /must be once-only with no delay/],
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
      ["set-variable without collect ownership", mutate((spec) => {
        spec.triggers![1].eventIds = ["action.show-guard-key-text"];
        spec.triggers![2].eventIds = ["action.set-guard-key-state"];
      }), /must be owned by a collect Trigger/],
      ["unknown text", mutate((spec) => {
        const event = spec.events![2];
        if (event.kind === "show-text") event.textRefId = "text.unknown";
      }), /unknown visible text/],
      ["empty text", mutate((spec) => { spec.textReferences![0].text = "   "; }), /1 to 4096/],
      ["oversized text", mutate((spec) => { spec.textReferences![0].text = "x".repeat(4_097); }), /1 to 4096/],
      ["show-text without state ownership", mutate((spec) => {
        spec.triggers![2].kind = "collect";
        spec.triggers![2].sourceId = "guard-key";
      }), /must be owned by a state-change Trigger/],
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

  it("pins 512/513 for every remaining advertised A4b collection limit", () => {
    const visibleText = structuredClone(A4B_REFERENCE_LEVEL_SPEC);
    visibleText.textReferences![0].text = "x".repeat(4_096);
    expect(() => compileSemantic(visibleText)).not.toThrow();
    visibleText.textReferences![0].text += "x";
    expect(() => compileSemantic(visibleText)).toThrow(/1 to 4096/);

    const texts = structuredClone(A4B_REFERENCE_LEVEL_SPEC);
    texts.textReferences = Array.from({ length: 512 }, (_, index) => ({
      id: `text.limit-${index}`,
      text: `bounded text ${index}`,
    }));
    const showText = texts.events![2];
    if (showText.kind === "show-text") showText.textRefId = texts.textReferences[0].id;
    expect(() => compileSemantic(texts)).not.toThrow();
    texts.textReferences.push({ id: "text.limit-512", text: "overflow" });
    expect(() => compileSemantic(texts)).toThrow(/at most 512 text references/);

    const events = structuredClone(A4B_REFERENCE_LEVEL_SPEC);
    for (let index = events.events!.length; index < 512; index += 1) {
      events.events!.push({ id: `action.limit-${index}`, kind: "set-flag", flag: `legacy.limit-${index}`, value: true });
    }
    expect(() => compileSemantic(events)).not.toThrow();
    events.events!.push({ id: "action.limit-512", kind: "set-flag", flag: "legacy.limit-512", value: true });
    expect(() => compileSemantic(events)).toThrow(/at most 512 events/);

    const triggers = structuredClone(A4B_REFERENCE_LEVEL_SPEC);
    triggers.events!.push({ id: "action.trigger-limit", kind: "set-flag", flag: "legacy.trigger-limit", value: true });
    for (let index = triggers.triggers!.length; index < 512; index += 1) {
      triggers.triggers!.push({
        id: `trigger.limit-${index}`,
        kind: "state-change",
        sourceId: "legacy.trigger-limit",
        eventIds: ["action.trigger-limit"],
        once: true,
      });
    }
    expect(() => compileSemantic(triggers)).not.toThrow();
    triggers.triggers!.push({
      id: "trigger.limit-512",
      kind: "state-change",
      sourceId: "legacy.trigger-limit",
      eventIds: ["action.trigger-limit"],
      once: true,
    });
    expect(() => compileSemantic(triggers)).toThrow(/at most 512 triggers/);
  });
});
