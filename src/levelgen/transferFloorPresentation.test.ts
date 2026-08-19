import { describe, expect, it } from "vitest";
import { TS01_GENERATED_FLOOR, TS01_GENERATED_PLAN } from "./generatedTs01Preview";
import { transferFloorSprites } from "./transferFloorPresentation";

describe("TS-01 Transfer floor presentation", () => {
  it("covers the Transfer room exactly once with the approved 6x6 tile family", () => {
    const geometry = TS01_GENERATED_PLAN.events.actors.props.navigation.geometry;
    const room = geometry.spaces.find((space) => space.id === "transfer-room");
    expect(room).toBeDefined();
    if (!room) return;

    const first = transferFloorSprites(TS01_GENERATED_PLAN);
    const second = transferFloorSprites(TS01_GENERATED_PLAN);
    expect(first).toEqual(second);
    expect(first).toHaveLength(room.rect.w * room.rect.h);
    expect(new Set(first.map((sprite) => `${sprite.x},${sprite.y}`)).size).toBe(first.length);

    for (const sprite of first) {
      expect(sprite.width).toBe(64);
      expect(sprite.height).toBe(64);
      expect([0, 90, 180, 270]).toContain(sprite.rotation ?? 0);
      expect(sprite.asset).toMatch(/assets\/deck\/transfer-floor\/transfer-floor-(?:0[0-9]|[12][0-9]|3[0-5])\.png$/);
    }
  });

  it("builds the 6x8 Hero installation envelope around the accepted 4x6 Apparatus", () => {
    const hero = TS01_GENERATED_PLAN.events.actors.props.placements.find((placement) => placement.id === "transfer-core");
    expect(hero?.rect.w).toBe(4);
    expect(hero?.rect.h).toBe(6);

    const sprites = transferFloorSprites(TS01_GENERATED_PLAN);
    const corners = sprites.filter((sprite) => sprite.id.startsWith("transfer-floor:anchor-corner:"));
    const edges = sprites.filter((sprite) => sprite.id.startsWith("transfer-floor:anchor-edge:"));
    const interior = sprites.filter((sprite) => sprite.id.startsWith("transfer-floor:anchor-interior:"));
    const threshold = sprites.filter((sprite) => sprite.id.startsWith("transfer-floor:threshold:"));
    const outside = sprites.filter((sprite) => (
      sprite.id.startsWith("transfer-floor:base:") || sprite.id.startsWith("transfer-floor:service:")
    ));

    expect(corners).toHaveLength(4);
    expect(interior).toHaveLength(24);
    expect(threshold).toHaveLength(2);
    expect(edges).toHaveLength(18);
    expect(corners.length + edges.length + interior.length + threshold.length).toBe(48);
    expect(outside).toHaveLength(32);

    expect(new Set(corners.map((sprite) => sprite.asset)).size).toBe(1);
    expect(new Set(edges.map((sprite) => sprite.asset)).size).toBe(1);
    for (const sprite of corners) expect(sprite.asset).toMatch(/transfer-floor-12\.png$/);
    for (const sprite of edges) expect(sprite.asset).toMatch(/transfer-floor-08\.png$/);
    expect(new Set(interior.map((sprite) => sprite.asset)).size).toBeGreaterThan(1);
    for (const sprite of interior) expect(sprite.asset).toMatch(/transfer-floor-1[4-7]\.png$/);
    for (const sprite of threshold) expect(sprite.asset).toMatch(/transfer-floor-06\.png$/);
  });

  it("renders Transfer material before existing grounding shadows without changing layer ownership", () => {
    expect(TS01_GENERATED_FLOOR.visual.kind).toBe("composite");
    if (TS01_GENERATED_FLOOR.visual.kind !== "composite") return;

    const floorFx = TS01_GENERATED_FLOOR.visual.layers.find((layer) => layer.id === "floor-fx");
    expect(floorFx?.kind).toBe("sprites");
    if (floorFx?.kind !== "sprites") return;

    const transferSprites = floorFx.sprites.filter((sprite) => sprite.id.startsWith("transfer-floor:"));
    const firstShadow = floorFx.sprites.findIndex((sprite) => sprite.id.startsWith("shadow:"));
    const lastTransfer = floorFx.sprites.reduce(
      (index, sprite, current) => (sprite.id.startsWith("transfer-floor:") ? current : index),
      -1,
    );

    expect(transferSprites).toHaveLength(80);
    expect(firstShadow).toBeGreaterThan(lastTransfer);
    expect(TS01_GENERATED_FLOOR.visual.layers.map((layer) => layer.id)).toEqual([
      "ground",
      "floor-fx",
      "architecture",
      "wall-prop-blockouts",
      "wall-props",
      "floor-prop-blockouts",
      "floor-props",
      "transfer-fx",
    ]);
  });
});
