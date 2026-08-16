import { describe, expect, it } from "vitest";
import { compileLevelSpec } from "./compiler";
import { compileLevelGeometry } from "./geometry";
import { compileLevelNavigationV031 } from "./navigationHardening";
import { compileOrientedPropPlacement } from "./orientedPlacement";
import { NUMBERDROID_PROP_REGISTRY } from "./propRegistry";
import { TS01_LEVEL_SPEC } from "./specs/ts01";
import type { LevelSpec, PropRegistry } from "./types";

function compile(spec: LevelSpec = TS01_LEVEL_SPEC, registry: PropRegistry = NUMBERDROID_PROP_REGISTRY) {
  const semantic = compileLevelSpec(spec, registry);
  const geometry = compileLevelGeometry(semantic);
  const navigation = compileLevelNavigationV031(geometry);
  return compileOrientedPropPlacement(navigation);
}

describe("Level Compiler v0.3.1 clearance + orientation hardening", () => {
  it("widens every real door clearance to twice the aperture width along the wall axis", () => {
    const plan = compile();
    const navigation = plan.navigation as ReturnType<typeof compileLevelNavigationV031>;
    const childDoor = navigation.geometry.connections.find((entry) => entry.id === "living-to-child");
    const primusDoor = navigation.geometry.connections.find((entry) => entry.id === "hall-to-primus");

    expect(childDoor?.apertureLength).toBe(1);
    expect(childDoor?.wallOrientation).toBe("horizontal");
    expect(childDoor?.clearanceBefore?.w).toBe(2);
    expect(childDoor?.clearanceAfter?.w).toBe(2);

    expect(primusDoor?.apertureLength).toBe(2);
    expect(primusDoor?.wallOrientation).toBe("vertical");
    expect(primusDoor?.clearanceBefore?.h).toBe(4);
    expect(primusDoor?.clearanceAfter?.h).toBe(4);
  });

  it("resolves every placed prop to one of its explicitly allowed cardinal rotations", () => {
    const plan = compile();
    const requestById = new Map(plan.navigation.geometry.semantic.props.map((request) => [request.id, request]));
    for (const placement of plan.placements) {
      const request = requestById.get(placement.requestId);
      expect(request).toBeTruthy();
      expect(request!.metadata.allowedRotations).toContain(placement.rotation);
    }
  });

  it("uses the wall-side convention 0=north, 90=east, 180=south, 270=west", () => {
    const plan = compile();
    const memory = plan.placements.find((entry) => entry.id === "living-memory");
    const coffee = plan.placements.find((entry) => entry.id === "living-coffee");
    expect(memory).toMatchObject({ wallSide: "north", rotation: 0 });
    expect(coffee).toMatchObject({ wallSide: "north", rotation: 0 });
  });

  it("rejects a perspective-sensitive wall prop when its solved wall requires a forbidden rotation", () => {
    const memory = NUMBERDROID_PROP_REGISTRY["family-memory-console"];
    const incompatibleRegistry: PropRegistry = {
      ...NUMBERDROID_PROP_REGISTRY,
      "family-memory-console": { ...memory, allowedRotations: [180] },
    };
    expect(() => compile(TS01_LEVEL_SPEC, incompatibleRegistry)).toThrow(/requires 0°.*allows only 180°/);
  });
});
