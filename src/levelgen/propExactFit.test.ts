import { describe, expect, it } from "vitest";
import { computePropExactFit, transformedPropBoundsPx, validatePropExactFitMetadata } from "./propExactFit";
import type { PropMetadata } from "./types";

const TILE = 64;
const WALL_COLLISION = 10;
const WALL_VISUAL = 30;
const ROOM = { x: 0, y: 0, w: 8, h: 6 };

function prop(overrides: Partial<PropMetadata> = {}): PropMetadata {
  return {
    id: "test-prop",
    tags: [],
    attachment: "floor",
    allowedRotations: [0, 90, 180, 270],
    footprintTiles: { w: 2, h: 1 },
    placement: {},
    ...overrides,
  };
}

describe("Level Compiler v0.13.1 exact Prop fit", () => {
  it("aligns a visual envelope to the visible wall face without changing its conservative tile footprint", () => {
    const metadata = prop({
      exactFit: {
        visualBoundsTiles: { x: 0.12, y: 0.12, w: 1.76, h: 0.76 },
        collisionBoundsTiles: { x: 0.2, y: 0.2, w: 1.6, h: 0.55 },
        placementEnvelope: "visual",
        wallBoundary: "visual",
      },
    });
    const placement = { rect: { x: 1, y: 0, w: 2, h: 1 }, rotation: 0 as const, wallSide: "north" as const };
    const fit = computePropExactFit(placement, metadata, ROOM, TILE, WALL_COLLISION, WALL_VISUAL);

    expect(fit.offsetPx.y).toBeCloseTo(WALL_VISUAL / 2 - 0.12 * TILE);
    expect(fit.placementEnvelopePx.y).toBeCloseTo(WALL_VISUAL / 2);
    expect(fit.collisionBoundsPx.y).toBeGreaterThanOrEqual(WALL_COLLISION / 2);
    expect(fit.placementEnvelopePx.y + fit.placementEnvelopePx.h).toBeLessThanOrEqual(TILE + 1e-6);
  });

  it("can fit a small glowing Prop by collision rather than by its visual outline", () => {
    const metadata = prop({
      footprintTiles: { w: 1, h: 1 },
      exactFit: {
        visualBoundsTiles: { x: 0.08, y: 0.08, w: 0.84, h: 0.84 },
        collisionBoundsTiles: { x: 0.22, y: 0.22, w: 0.56, h: 0.56 },
        placementEnvelope: "collision",
        wallBoundary: "collision",
      },
    });
    const placement = { rect: { x: 0, y: 0, w: 1, h: 1 }, rotation: 0 as const, wallSide: "north" as const };
    const fit = computePropExactFit(placement, metadata, ROOM, TILE, WALL_COLLISION, WALL_VISUAL);

    expect(fit.collisionBoundsPx.y).toBeCloseTo(WALL_COLLISION / 2);
    expect(fit.placementEnvelopePx.y).toBeCloseTo(WALL_COLLISION / 2);
    // Visual glow/canvas is deliberately allowed closer to/under the visible fascia.
    expect(fit.visualBoundsPx.y).toBeLessThan(WALL_VISUAL / 2);
    expect(fit.collisionBoundsPx.w).toBeCloseTo(0.56 * TILE);
  });

  it("rotates non-square local physical bounds with the Prop", () => {
    const metadata = prop({
      exactFit: {
        collisionBoundsTiles: { x: 0.2, y: 0.1, w: 1.5, h: 0.6 },
      },
    });
    const placement = { rect: { x: 2, y: 2, w: 1, h: 2 }, rotation: 90 as const, wallSide: null };
    const rotated = transformedPropBoundsPx(placement, metadata, metadata.exactFit!.collisionBoundsTiles!, TILE);
    expect(rotated.w).toBeCloseTo(0.6 * TILE);
    expect(rotated.h).toBeCloseTo(1.5 * TILE);
  });

  it("rejects malformed physical envelopes outside the authored footprint", () => {
    const metadata = prop({
      exactFit: { collisionBoundsTiles: { x: 1.8, y: 0, w: 0.4, h: 1 } },
    });
    expect(() => validatePropExactFitMetadata(metadata)).toThrow(/contained by the authored/i);
  });
});
