import { describe, expect, it } from "vitest";
import { computePropExactFit, transformedPropBoundsPx, validatePropExactFitMetadata } from "./propExactFit";
import { NUMBERDROID_PROP_REGISTRY } from "./propRegistry";
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

describe("Level Compiler v0.13.2 exact Prop fit", () => {
  it("moves a visual envelope only as far as needed to leave visible wall fascia", () => {
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
    expect(fit.visualBoundsPx.y).toBeCloseTo(WALL_VISUAL / 2);
    expect(fit.collisionBoundsPx.y).toBeGreaterThanOrEqual(WALL_COLLISION / 2);
  });

  it("does not snap an already-safe collision-fit Prop outward toward the wall", () => {
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

    expect(fit.offsetPx).toEqual({ x: 0, y: 0 });
    expect(fit.collisionBoundsPx.y).toBeCloseTo(0.22 * TILE);
    expect(fit.visualBoundsPx.y).toBeLessThan(WALL_VISUAL / 2);
  });

  it("protects both visible wall faces for a real corner Prop", () => {
    const metadata = prop({
      footprintTiles: { w: 1, h: 1 },
      exactFit: {
        visualBoundsTiles: { x: 0.08, y: 0.08, w: 0.84, h: 0.84 },
        collisionBoundsTiles: { x: 0.2, y: 0.2, w: 0.6, h: 0.6 },
        placementEnvelope: "visual",
        wallBoundary: "visual",
      },
    });
    const placement = { rect: { x: 0, y: 5, w: 1, h: 1 }, rotation: 0 as const, wallSide: "west" as const };
    const fit = computePropExactFit(placement, metadata, ROOM, TILE, WALL_COLLISION, WALL_VISUAL);

    expect(fit.touchedWalls).toEqual(expect.arrayContaining(["south", "west"]));
    expect(fit.visualBoundsPx.x).toBeGreaterThanOrEqual(WALL_VISUAL / 2 - 1e-6);
    expect(fit.visualBoundsPx.y + fit.visualBoundsPx.h).toBeLessThanOrEqual(ROOM.h * TILE - WALL_VISUAL / 2 + 1e-6);
  });

  it("keeps the Family Table physical silhouette multipart instead of one giant rectangle", () => {
    const metadata = NUMBERDROID_PROP_REGISTRY["family-table"];
    const placement = { rect: { x: 2, y: 2, w: 3, h: 2 }, rotation: 0 as const, wallSide: null };
    const fit = computePropExactFit(placement, metadata, ROOM, TILE, WALL_COLLISION, WALL_VISUAL);
    expect(fit.collisionPartsPx).toHaveLength(5);
    expect(fit.collisionPartsPx.every((part) => part.w < fit.collisionBoundsPx.w || part.h < fit.collisionBoundsPx.h)).toBe(true);
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
