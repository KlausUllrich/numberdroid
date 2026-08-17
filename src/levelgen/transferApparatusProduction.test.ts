import { describe, expect, it } from "vitest";
import { compileLevelSpec } from "./compiler";
import { compileLevelGeometry } from "./geometry";
import { compileLevelNavigation } from "./navigation";
import { compilePropPlacement } from "./placement";
import { NUMBERDROID_PROP_ART_REGISTRY } from "./propArtRegistry";
import { NUMBERDROID_PROP_COLLISION_PARTS } from "./propCollisionRegistry";
import { NUMBERDROID_PROP_REGISTRY } from "./propRegistry";
import { TS01_LEVEL_SPEC } from "./specs/ts01";

function contains(rect: { x: number; y: number; w: number; h: number }, x: number, y: number) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function blocked(parts: readonly { x: number; y: number; w: number; h: number }[], x: number, y: number) {
  return parts.some((part) => contains(part, x, y));
}

describe("TS-01 Transfer Apparatus production contract", () => {
  it("uses the approved Hero redesign on the doubled 4x6 canvas with a separate FloorFX shadow", () => {
    const metadata = NUMBERDROID_PROP_REGISTRY["transfer-core"];
    expect(metadata.footprintTiles).toEqual({ w: 4, h: 6 });
    expect(metadata.allowedRotations).toEqual([0]);
    expect(metadata.exactFit?.visualBoundsTiles).toEqual({
      x: 0.125,
      y: 0.453125,
      w: 3.75,
      h: 5.09375,
    });
    expect(NUMBERDROID_PROP_ART_REGISTRY["transfer-core"]).toMatchObject({
      asset: "assets/deck/transfer-apparatus.png",
      shadowAsset: "assets/deck/transfer-apparatus-shadow.png",
      status: "candidate",
    });
  });

  it("blocks normal movement across the apparatus while leaving all four outer whitespace corners navigable", () => {
    const parts = NUMBERDROID_PROP_COLLISION_PARTS["transfer-core"];
    expect(parts).toHaveLength(9);

    // Normal Human/Robot movement must not cross any of the machine's main body:
    // intake, upper body, central transfer platform, lower body and dock nose.
    for (const point of [
      [2.0, 0.375],
      [2.0, 1.0],
      [2.0, 2.75],
      [2.0, 4.5],
      [2.0, 5.375],
    ] as const) {
      expect(blocked(parts, point[0], point[1])).toBe(true);
    }

    // The approved silhouette has transparent floor in all four outer corners;
    // the old broad AABB incorrectly prevented the player from using this space.
    for (const point of [
      [0.5, 0.75],  // LO / upper-left whitespace
      [3.5, 0.75],  // RO / upper-right whitespace
      [3.5, 5.25],  // RU / lower-right whitespace
      [0.5, 5.25],  // LU / lower-left whitespace
    ] as const) {
      expect(blocked(parts, point[0], point[1])).toBe(false);
    }
  });

  it("still places the enlarged Hero deterministically in generated TS-01", () => {
    const semantic = compileLevelSpec(TS01_LEVEL_SPEC, NUMBERDROID_PROP_REGISTRY);
    const geometry = compileLevelGeometry(semantic);
    const navigation = compileLevelNavigation(geometry);
    const placement = compilePropPlacement(navigation);
    const core = placement.placements.find((entry) => entry.id === "transfer-core");

    expect(core).toBeDefined();
    expect(core?.role).toBe("hero");
    expect(core?.rect.w).toBe(4);
    expect(core?.rect.h).toBe(6);
    expect(core?.reasons).toContain("room-center hero focus");
  });
});
