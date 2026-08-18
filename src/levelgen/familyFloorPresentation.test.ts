import { describe, expect, it } from "vitest";
import { TS01_GENERATED_FLOOR, TS01_GENERATED_PLAN } from "./generatedTs01Preview";
import { familyFloorSprites } from "./familyFloorPresentation";

describe("TS-01 Family floor presentation", () => {
  it("covers every domestic room tile with a deterministic 1x1 Family material tile", () => {
    const geometry = TS01_GENERATED_PLAN.events.actors.props.navigation.geometry;
    const semanticSpaces = new Map(geometry.semantic.spaces.map((space) => [space.id, space]));
    const expectedCount = geometry.spaces
      .filter((space) => {
        const semantic = semanticSpaces.get(space.id);
        return space.kind === "room" && semantic?.kind === "room" && semantic.rationality === "domestic";
      })
      .reduce((sum, space) => sum + space.rect.w * space.rect.h, 0);

    const first = familyFloorSprites(TS01_GENERATED_PLAN);
    const second = familyFloorSprites(TS01_GENERATED_PLAN);

    expect(first).toEqual(second);
    expect(first).toHaveLength(expectedCount);
    expect(new Set(first.map((sprite) => sprite.asset)).size).toBeGreaterThan(1);
    for (const sprite of first) {
      expect(sprite.width).toBe(64);
      expect(sprite.height).toBe(64);
      expect(sprite.rotation).toBe(0);
      expect(sprite.asset).toMatch(/assets\/deck\/family-floor\/family-floor-0[0-8]\.png$/);
    }
  });

  it("renders Family material before Prop grounding shadows without changing the established layer stack", () => {
    expect(TS01_GENERATED_FLOOR.visual.kind).toBe("composite");
    if (TS01_GENERATED_FLOOR.visual.kind !== "composite") return;

    const floorFx = TS01_GENERATED_FLOOR.visual.layers.find((layer) => layer.id === "floor-fx");
    expect(floorFx?.kind).toBe("sprites");
    if (floorFx?.kind !== "sprites") return;

    const familySprites = floorFx.sprites.filter((sprite) => sprite.id.startsWith("family-floor:"));
    const firstShadow = floorFx.sprites.findIndex((sprite) => sprite.id.startsWith("shadow:"));
    const lastFamily = floorFx.sprites.reduce(
      (index, sprite, current) => (sprite.id.startsWith("family-floor:") ? current : index),
      -1,
    );

    expect(familySprites.length).toBeGreaterThan(0);
    expect(firstShadow).toBeGreaterThan(lastFamily);
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
