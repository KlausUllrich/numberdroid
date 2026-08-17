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

describe("TS-01 Transfer Apparatus production contract", () => {
  it("uses the approved 3x6 canvas and exact visual fit", () => {
    const metadata = NUMBERDROID_PROP_REGISTRY["transfer-core"];
    expect(metadata.footprintTiles).toEqual({ w: 3, h: 6 });
    expect(metadata.allowedRotations).toEqual([0]);
    expect(metadata.exactFit?.visualBoundsTiles).toEqual({
      x: 0.34375,
      y: 0.125,
      w: 2.3125,
      h: 5.75,
    });
    expect(NUMBERDROID_PROP_ART_REGISTRY["transfer-core"]).toMatchObject({
      asset: "assets/deck/transfer-apparatus.png",
      status: "candidate",
    });
  });

  it("keeps the Human bed and PICO Body Dock/exit physically open", () => {
    const parts = NUMBERDROID_PROP_COLLISION_PARTS["transfer-core"];
    expect(parts).toHaveLength(5);

    // Human receiving surface: player must be able to move into the center lane.
    expect(parts.some((part) => contains(part, 1.5, 1.4))).toBe(false);

    // Core receiver is real machinery and should remain solid.
    expect(parts.some((part) => contains(part, 1.5, 3.2))).toBe(true);

    // PICO staging slot and south drive-out lane must remain open.
    expect(parts.some((part) => contains(part, 1.5, 4.8))).toBe(false);
    expect(parts.some((part) => contains(part, 1.5, 5.7))).toBe(false);
  });

  it("still places the enlarged Hero deterministically in generated TS-01", () => {
    const semantic = compileLevelSpec(TS01_LEVEL_SPEC, NUMBERDROID_PROP_REGISTRY);
    const geometry = compileLevelGeometry(semantic);
    const navigation = compileLevelNavigation(geometry);
    const placement = compilePropPlacement(navigation);
    const core = placement.placements.find((entry) => entry.id === "transfer-core");

    expect(core).toBeDefined();
    expect(core?.role).toBe("hero");
    expect(core?.rect.w).toBe(3);
    expect(core?.rect.h).toBe(6);
    expect(core?.reasons).toContain("room-center hero focus");
  });
});
