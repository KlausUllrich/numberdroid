import { describe, expect, it } from "vitest";
import { compileLevelSpec } from "./compiler";
import { compileLevelGeometry } from "./geometry";
import { compileLevelNavigationV031 } from "./navigationHardening";
import { compileOrientedPropPlacement } from "./orientedPlacement";
import { NUMBERDROID_PROP_REGISTRY } from "./propRegistry";
import { TS01_LEVEL_SPEC } from "./specs/ts01";
import type { LevelSpec, PropRegistry } from "./types";

function strippedSpec(props: LevelSpec["props"]): LevelSpec {
  return {
    ...TS01_LEVEL_SPEC,
    id: `rotation-test-${props[0]?.id ?? "empty"}`,
    props,
    encounters: [],
    routes: [],
    stagedActors: [],
    pickups: [],
    zones: [],
    triggers: [],
    events: [],
  };
}

function compile(spec: LevelSpec, registry: PropRegistry) {
  const semantic = compileLevelSpec(spec, registry);
  const geometry = compileLevelGeometry(semantic);
  const navigation = compileLevelNavigationV031(geometry);
  return compileOrientedPropPlacement(navigation);
}

describe("Level Compiler rotated non-square footprints", () => {
  it("physically swaps a 2×1 floor footprint when only 90° art is allowed", () => {
    const childBed = NUMBERDROID_PROP_REGISTRY["child-bed"];
    const registry: PropRegistry = {
      "child-bed": { ...childBed, allowedRotations: [90] },
    };
    const plan = compile(
      strippedSpec([{ id: "rotated-bed", propId: "child-bed", spaceId: "family-child", role: "furniture" }]),
      registry,
    );
    const bed = plan.placements[0];
    expect(bed.rotation).toBe(90);
    expect(bed.rect).toMatchObject({ w: 1, h: 2 });
    expect(bed.footprintCells).toHaveLength(2);
    expect(bed.reasons).toContain("footprint 1×2");
  });

  it("does not consider wall sides whose required art rotation is unavailable", () => {
    const service = NUMBERDROID_PROP_REGISTRY["primus-service-bank"];
    const registry: PropRegistry = {
      "primus-service-bank": { ...service, allowedRotations: [90] },
    };
    const plan = compile(
      strippedSpec([{
        id: "east-only-service",
        propId: "primus-service-bank",
        spaceId: "primus-allocation",
        role: "support",
        preferredWall: "north",
      }]),
      registry,
    );
    const placement = plan.placements[0];
    expect(placement.wallSide).toBe("east");
    expect(placement.rotation).toBe(90);
    expect(placement.rect).toMatchObject({ w: 1, h: 2 });
  });

  it("rotates directional floor-prop use-space together with the footprint", () => {
    const registry: PropRegistry = {
      "service-cart": {
        id: "service-cart",
        tags: ["test", "service"],
        attachment: "floor",
        allowedRotations: [90],
        footprintTiles: { w: 2, h: 1 },
        placement: {
          approachDepthTiles: 1,
          forbidDoorClearance: true,
          forbidPrimaryPath: true,
        },
      },
    };
    const plan = compile(
      strippedSpec([{ id: "service-cart", propId: "service-cart", spaceId: "family-child", role: "furniture" }]),
      registry,
    );
    const cart = plan.placements[0];
    expect(cart.rotation).toBe(90);
    expect(cart.rect).toMatchObject({ w: 1, h: 2 });
    expect(cart.approachCells).toHaveLength(2);
    // 90° means the prop back faces east, so use/access space lies directly west.
    expect(cart.approachCells.every((cell) => cell.x === cart.rect.x - 1)).toBe(true);
    expect(cart.approachCells.map((cell) => cell.y).sort()).toEqual([cart.rect.y, cart.rect.y + 1]);
  });

  it("keeps the full TS-01 placement deterministic with rotation included in the solve", () => {
    const a = compile(TS01_LEVEL_SPEC, NUMBERDROID_PROP_REGISTRY);
    const b = compile(TS01_LEVEL_SPEC, NUMBERDROID_PROP_REGISTRY);
    expect(a.placements.map((entry) => [entry.id, entry.rotation, entry.rect, entry.wallSide])).toEqual(
      b.placements.map((entry) => [entry.id, entry.rotation, entry.rect, entry.wallSide]),
    );
  });
});
