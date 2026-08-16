import { describe, expect, it } from "vitest";
import { compileRuntimeLevel } from "./emission";
import { NUMBERDROID_PROP_REGISTRY } from "./propRegistry";
import { TS01_LEVEL_SPEC } from "./specs/ts01";
import type { LevelSpec } from "./types";

function compile(spec: LevelSpec = TS01_LEVEL_SPEC) {
  return compileRuntimeLevel(spec, NUMBERDROID_PROP_REGISTRY);
}

function objectLayer(plan: ReturnType<typeof compile>, name: string) {
  const layer = plan.tiledMap.layers.find((entry) => entry.name === name);
  expect(layer?.type).toBe("objectgroup");
  if (!layer || layer.type !== "objectgroup" || !("objects" in layer)) throw new Error(`Missing object layer ${name}`);
  return layer;
}

function pointInsideRect(point: { x: number; y: number }, rect: { x: number; y: number; w: number; h: number }) {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

describe("Level Compiler v0.6 runtime / Tiled emission", () => {
  it("emits a Tiled map that round-trips through the existing FloorDefinition importer", () => {
    const plan = compile();
    expect(plan.runtimeFloor.id).toBe(TS01_LEVEL_SPEC.id);
    expect(plan.runtimeFloor.visual.kind).toBe("tilemap");
    expect(plan.runtimeFloor.width).toBe(plan.tiledMap.width * plan.tileSize);
    expect(plan.runtimeFloor.height).toBe(plan.tiledMap.height * plan.tileSize);
    expect(plan.runtimeFloor.walkable.length).toBe(plan.events.actors.props.navigation.geometry.spaces.length);
  });

  it("emits wall + Prop collision, real doors, pickups and runtime encounters", () => {
    const plan = compile();
    expect(plan.runtimeFloor.obstacles.length).toBeGreaterThan(plan.events.actors.props.placements.length);
    expect(plan.runtimeFloor.doors).toHaveLength(3);
    expect(plan.runtimeFloor.pickups).toHaveLength(1);
    expect(plan.runtimeFloor.encounters).toHaveLength(2);

    const primusDoor = plan.runtimeFloor.doors.find((door) => door.id === "hall-to-primus");
    expect(primusDoor).toMatchObject({ mode: "locked", keyId: "primus-access", orientation: "vertical", size: "large" });

    const sentry = plan.runtimeFloor.encounters.find((entry) => entry.encounterId === "primus-sentry-4");
    expect(sentry?.behavior?.kind).toBe("patrol");
    expect(sentry?.behavior?.patrolPath.length).toBeGreaterThanOrEqual(2);
  });

  it("preserves compiler-only semantic layers in the emitted Tiled representation", () => {
    const plan = compile();
    expect(objectLayer(plan, "CompilerProps").objects).toHaveLength(plan.events.actors.props.placements.length);
    expect(objectLayer(plan, "ActorRoutes").objects).toHaveLength(plan.events.actors.routes.length);
    expect(objectLayer(plan, "TriggerZones").objects).toHaveLength(plan.events.zones.length);
    expect(objectLayer(plan, "Triggers").objects).toHaveLength(plan.events.triggers.length);
    expect(objectLayer(plan, "Events").objects).toHaveLength(plan.events.events.length);
    expect(objectLayer(plan, "TriggerEventLinks").objects).toHaveLength(plan.events.links.length);
  });

  it("preserves Prop rotations and ordered Trigger→Event links in Tiled authoring data", () => {
    const plan = compile();
    const propObjects = objectLayer(plan, "CompilerProps").objects;
    const memory = propObjects.find((entry) => entry.name === "living-memory");
    const rotation = memory?.properties?.find((entry) => entry.name === "rotation")?.value;
    expect(rotation).toBe(0);

    const links = objectLayer(plan, "TriggerEventLinks").objects.filter((entry) =>
      entry.properties?.some((property) => property.name === "triggerId" && property.value === "collect-primus-access"),
    );
    expect(links.map((entry) => entry.properties?.find((property) => property.name === "eventId")?.value)).toEqual([
      "grant-primus-access",
      "unlock-primus-door",
    ]);
    expect(links.map((entry) => entry.properties?.find((property) => property.name === "order")?.value)).toEqual([0, 1]);
  });

  it("selects a valid free runtime start without authored raw coordinates", () => {
    const spec: LevelSpec = {
      ...TS01_LEVEL_SPEC,
      runtime: {
        floorName: "TS-01 GENERATED",
        subtitle: "RUNTIME EMISSION QA",
        objectiveDefault: "TEST GENERATED FLOOR",
        objectiveAfterEnergy: "TEST GENERATED FLOOR",
        start: { spaceId: "family-living", bodyId: "pico", facing: 90, metaEnergy: 0, preferredSide: "south" },
      },
    };
    const plan = compile(spec);
    expect(plan.runtimeFloor.name).toBe("TS-01 GENERATED");
    expect(plan.runtimeFloor.start).toMatchObject({ bodyId: "pico", facing: 90, metaEnergy: 0 });
    expect(plan.runtimeFloor.obstacles.some((rect) => pointInsideRect(plan.runtimeFloor.start, rect))).toBe(false);
  });

  it("is deterministic for the same LevelSpec and seed", () => {
    const a = compile();
    const b = compile();
    expect(a.tiledMap).toEqual(b.tiledMap);
    expect(a.runtimeFloor).toEqual(b.runtimeFloor);
    expect(a.objectLayerCounts).toEqual(b.objectLayerCounts);
  });
});
