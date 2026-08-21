import { describe, expect, it } from "vitest";
import { TS01_GENERATED_FLOOR, TS01_GENERATED_PLAN } from "./generatedTs01Preview";
import { familyFloorSprites } from "./familyFloorPresentation";
import { familyHygieneFloorSprites } from "./familyHygieneFloorPresentation";
import { FAMILY_HYGIENE_FLOOR_TILE_METADATA } from "./familyHygieneFloorTileMetadata";

describe("TS-01 Family Hygiene floor presentation", () => {
  function hygieneRoom() {
    return TS01_GENERATED_PLAN.events.actors.props.navigation.geometry.spaces.find(
      (space) => space.id === "family-hygiene" && space.kind === "room",
    );
  }

  it("covers the exact 2x3 room once with a calm deterministic 1x1 layout", () => {
    const room = hygieneRoom();
    expect(room).toBeDefined();
    if (!room) return;
    expect(room.rect).toMatchObject({ w: 2, h: 3 });

    const first = familyHygieneFloorSprites(TS01_GENERATED_PLAN);
    const second = familyHygieneFloorSprites(TS01_GENERATED_PLAN);
    expect(first).toEqual(second);
    expect(first).toHaveLength(6);
    expect(new Set(first.map((sprite) => `${sprite.x},${sprite.y}`)).size).toBe(6);

    for (const sprite of first) {
      expect(sprite.width).toBe(64);
      expect(sprite.height).toBe(64);
      expect(sprite.rotation).toBe(0);
      expect(sprite.asset).toMatch(/assets\/deck\/family-hygiene-floor\/family-hygiene-floor-0[0-3]\.png$/);
    }

    const assetCounts = new Map<string, number>();
    for (const sprite of first) assetCounts.set(sprite.asset, (assetCounts.get(sprite.asset) ?? 0) + 1);
    expect(assetCounts.get(first[0].asset)).toBe(4);
    expect([...assetCounts.values()].sort((a, b) => b - a)).toEqual([4, 1, 1]);
  });

  it("keeps explicit approved metadata for all four source cells", () => {
    expect(FAMILY_HYGIENE_FLOOR_TILE_METADATA).toHaveLength(4);
    expect(new Set(FAMILY_HYGIENE_FLOOR_TILE_METADATA.map((entry) => entry.id)).size).toBe(4);
    expect(new Set(FAMILY_HYGIENE_FLOOR_TILE_METADATA.map((entry) => entry.index))).toEqual(new Set([0, 1, 2, 3]));
    for (const entry of FAMILY_HYGIENE_FLOOR_TILE_METADATA) {
      expect(entry.spanTiles).toEqual({ w: 1, h: 1 });
      expect(entry.continuityProfile).toBe("family-hygiene-calm-v1");
      expect(entry.runtimeEligible).toBe(true);
      expect(entry.wallSafe).toBe(true);
      expect(entry.rotationPolicy).toBe("invariant");
      expect(entry.connectors).toEqual([]);
    }
  });

  it("removes Hygiene from the generic Family overlay so no room cell is double-rendered", () => {
    const generic = familyFloorSprites(TS01_GENERATED_PLAN);
    expect(generic.some((sprite) => sprite.id.startsWith("family-floor:family-hygiene:"))).toBe(false);

    const hygiene = familyHygieneFloorSprites(TS01_GENERATED_PLAN);
    const genericPositions = new Set(generic.map((sprite) => `${sprite.x},${sprite.y}`));
    for (const sprite of hygiene) expect(genericPositions.has(`${sprite.x},${sprite.y}`)).toBe(false);
  });

  it("renders Hygiene Ground before existing grounding shadows without changing layer ownership", () => {
    expect(TS01_GENERATED_FLOOR.visual.kind).toBe("composite");
    if (TS01_GENERATED_FLOOR.visual.kind !== "composite") return;
    const floorFx = TS01_GENERATED_FLOOR.visual.layers.find((layer) => layer.id === "floor-fx");
    expect(floorFx?.kind).toBe("sprites");
    if (floorFx?.kind !== "sprites") return;

    const hygiene = floorFx.sprites.filter((sprite) => sprite.id.startsWith("family-hygiene-floor:"));
    const firstShadow = floorFx.sprites.findIndex((sprite) => sprite.id.startsWith("shadow:"));
    const lastHygiene = floorFx.sprites.reduce(
      (index, sprite, current) => (sprite.id.startsWith("family-hygiene-floor:") ? current : index),
      -1,
    );
    expect(hygiene).toHaveLength(6);
    expect(firstShadow).toBeGreaterThan(lastHygiene);
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
