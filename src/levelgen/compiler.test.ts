import { describe, expect, it } from "vitest";
import { compileLevelSpec } from "./compiler";
import { NUMBERDROID_PROP_REGISTRY } from "./propRegistry";
import { deriveSubSeed } from "./seed";
import { TS01_LEVEL_SPEC } from "./specs/ts01";
import type { LevelSpec } from "./types";

function compile(spec: LevelSpec = TS01_LEVEL_SPEC) {
  return compileLevelSpec(spec, NUMBERDROID_PROP_REGISTRY);
}

describe("Level Compiler v0 semantic contract", () => {
  it("compiles TS-01 as a connected semantic space graph with explicit hall width", () => {
    const plan = compile();
    expect(plan.levelId).toBe("ts01-transfer-hall");
    expect(plan.spaces.map((space) => space.id)).toEqual([
      "family-living",
      "family-child",
      "family-hygiene",
      "main-hall",
      "transfer-room",
      "primus-allocation",
    ]);
    const hall = plan.spaces.find((space) => space.id === "main-hall");
    expect(hall?.kind).toBe("corridor");
    if (hall?.kind === "corridor") {
      expect(hall.width).toEqual({ min: 2, preferred: 3, max: 4 });
    }
  });

  it("derives stable independent sub-seeds from semantic paths", () => {
    const planA = compile();
    const planB = compile();
    expect(planA.seed).toBe(planB.seed);
    expect(planA.spaces.map((space) => space.seed)).toEqual(planB.spaces.map((space) => space.seed));
    expect(deriveSubSeed(TS01_LEVEL_SPEC.seed, "space/family-child")).not.toBe(
      deriveSubSeed(TS01_LEVEL_SPEC.seed, "space/transfer-room"),
    );
  });

  it("normalizes door clearance and preserves the controlled PRIMUS threshold", () => {
    const plan = compile();
    const primusDoor = plan.connections.find((connection) => connection.id === "hall-to-primus");
    expect(primusDoor).toMatchObject({
      kind: "controlled-door",
      widthTiles: 2,
      clearanceTiles: { before: 1.5, after: 1.5 },
      lock: { mode: "none" },
    });
    const childDoor = plan.connections.find((connection) => connection.id === "living-to-child");
    expect(childDoor?.clearanceTiles).toEqual({ before: 1.25, after: 1.25 });
  });

  it("attaches semantic prop metadata needed by placement rules", () => {
    const plan = compile();
    const plant = plan.props.find((request) => request.id === "living-plant");
    expect(plant?.metadata.tags).toContain("plant");
    expect(plant?.metadata.placement).toMatchObject({
      preferWallAdjacent: true,
      forbidDoorClearance: true,
      forbidInFrontOfWallProp: true,
    });
    const toilet = plan.props.find((request) => request.id === "bathroom-toilet");
    expect(toilet?.metadata.placement.preferOppositeDoor).toBe(true);
  });

  it("carries enemy placement intent and validates patrol-route references", () => {
    const plan = compile();
    expect(plan.encounters.find((encounter) => encounter.id === "primus-magnetar-742")).toMatchObject({
      spaceId: "primus-allocation",
      behavior: "neutral",
      avoidDoorClearance: true,
    });
    expect(plan.encounters.find((encounter) => encounter.id === "primus-sentry-4")).toMatchObject({
      behavior: "patrol",
      patrolRouteId: "primus-sentry-patrol",
    });
  });

  it("supports locked doors, access cards and trigger/event wiring without runtime implementation yet", () => {
    const spec: LevelSpec = {
      ...TS01_LEVEL_SPEC,
      id: "locked-door-example",
      connections: TS01_LEVEL_SPEC.connections.map((connection) =>
        connection.id === "hall-to-primus"
          ? { ...connection, lock: { mode: "access-key" as const, keyId: "primus-blue" } }
          : connection,
      ),
      pickups: [
        { id: "blue-card", kind: "access-key", keyId: "primus-blue", spaceId: "family-living", label: "BLUE" },
      ],
      events: [
        { id: "unlock-primus", kind: "unlock-door", doorId: "hall-to-primus" },
      ],
      triggers: [
        { id: "blue-card-trigger", kind: "collect", sourceId: "blue-card", eventIds: ["unlock-primus"], once: true },
      ],
    };
    const plan = compile(spec);
    expect(plan.connections.find((connection) => connection.id === "hall-to-primus")?.lock).toEqual({
      mode: "access-key",
      keyId: "primus-blue",
    });
    expect(plan.triggers[0]?.eventIds).toEqual(["unlock-primus"]);
    expect(plan.diagnostics.some((diagnostic) => diagnostic.code === "KEY_SOURCE_NOT_YET_AUTHORED")).toBe(false);
  });

  it("supports future pass-by staging events through named semantic routes", () => {
    const spec: LevelSpec = {
      ...TS01_LEVEL_SPEC,
      id: "passby-example",
      routes: [
        ...(TS01_LEVEL_SPEC.routes ?? []),
        { id: "bioark-visible-pass", kind: "passby", spaceIds: ["main-hall"], loop: false },
      ],
      events: [
        { id: "animal-crosses", kind: "actor-passby", actorId: "bioark-large-animal", routeId: "bioark-visible-pass", durationMs: 2400 },
      ],
      triggers: [
        { id: "animal-glimpse-trigger", kind: "enter-zone", sourceId: "future-ridge-view-zone", eventIds: ["animal-crosses"], once: true },
      ],
    };
    const plan = compile(spec);
    expect(plan.events[0]).toMatchObject({ kind: "actor-passby", routeId: "bioark-visible-pass" });
  });

  it("rejects disconnected spaces before geometry generation", () => {
    const spec: LevelSpec = {
      ...TS01_LEVEL_SPEC,
      id: "disconnected-example",
      spaces: [
        ...TS01_LEVEL_SPEC.spaces,
        {
          id: "orphan-room",
          kind: "room",
          archetype: "test",
          size: { class: "small" },
        },
      ],
    };
    expect(() => compile(spec)).toThrow(/unreachable semantic spaces: orphan-room/);
  });

  it("rejects a prop that violates required room tags", () => {
    const spec: LevelSpec = {
      ...TS01_LEVEL_SPEC,
      id: "bad-toilet-example",
      props: TS01_LEVEL_SPEC.props.map((request) =>
        request.id === "bathroom-toilet" ? { ...request, spaceId: "family-living" } : request,
      ),
    };
    expect(() => compile(spec)).toThrow(/requires space tags hygiene/);
  });
});
