import { describe, expect, it } from "vitest";
import { TS01_GENERATED_FLOOR, TS01_GENERATED_PLAN } from "./generatedTs01Preview";
import { MAIN_HALL_TILE_CONTRACT, mainHallFloorSprites } from "./mainHallFloorPresentation";

describe("TS-01 Main Hall floor presentation", () => {
  it("covers every Main Hall corridor cell exactly once with the approved 6x6 tile family", () => {
    const geometry = TS01_GENERATED_PLAN.events.actors.props.navigation.geometry;
    const hall = geometry.spaces.find((space) => space.id === "main-hall");
    expect(hall).toBeDefined();
    if (!hall) return;

    const first = mainHallFloorSprites(TS01_GENERATED_PLAN);
    const second = mainHallFloorSprites(TS01_GENERATED_PLAN);
    expect(first).toEqual(second);
    expect(first).toHaveLength(hall.rect.w * hall.rect.h);
    expect(new Set(first.map((sprite) => `${sprite.x},${sprite.y}`)).size).toBe(first.length);

    for (const sprite of first) {
      expect(sprite.width).toBe(64);
      expect(sprite.height).toBe(64);
      expect([0, 90, 180, 270]).toContain(sprite.rotation ?? 0);
      expect(sprite.asset).toMatch(/assets\/deck\/main-hall-floor\/main-hall-floor-(?:0[0-9]|[12][0-9]|3[0-5])\.png$/);
    }
  });

  it("keeps a complete four-direction T-junction contract through canonical rotation", () => {
    const variants = MAIN_HALL_TILE_CONTRACT.tJunctionByMissingDirection;
    expect(Object.keys(variants).sort()).toEqual(["east", "north", "south", "west"]);
    expect(new Set(Object.values(variants).map((variant) => variant.index))).toEqual(new Set([13]));
    expect(Object.values(variants).map((variant) => variant.rotation).sort((a, b) => a - b)).toEqual([0, 90, 180, 270]);
  });

  it("uses real Hall connections for thresholds and keeps navigation arrows reserved", () => {
    const geometry = TS01_GENERATED_PLAN.events.actors.props.navigation.geometry;
    const hall = geometry.spaces.find((space) => space.id === "main-hall");
    expect(hall).toBeDefined();
    if (!hall) return;

    const relevantConnections = geometry.connections.filter((connection) => connection.from === hall.id || connection.to === hall.id);
    const expectedThresholdCells = new Set<string>();
    for (const connection of relevantConnections) {
      const side = connection.from === hall.id ? connection.fromSide : connection.toSide;
      for (let i = 0; i < connection.apertureLength; i += 1) {
        if (side === "north" || side === "south") {
          const x = connection.apertureStart + i;
          const y = side === "north" ? hall.rect.y : hall.rect.y + hall.rect.h - 1;
          expectedThresholdCells.add(`${x},${y}`);
        } else {
          const x = side === "west" ? hall.rect.x : hall.rect.x + hall.rect.w - 1;
          const y = connection.apertureStart + i;
          expectedThresholdCells.add(`${x},${y}`);
        }
      }
    }

    const sprites = mainHallFloorSprites(TS01_GENERATED_PLAN);
    const thresholds = sprites.filter((sprite) => sprite.id.startsWith("main-hall-floor:threshold:"));
    expect(thresholds).toHaveLength(expectedThresholdCells.size);
    expect(sprites.some((sprite) => sprite.id.startsWith("main-hall-floor:junction-t:"))).toBe(true);
    expect(sprites.some((sprite) => sprite.id.startsWith("main-hall-floor:straight:"))).toBe(true);

    // Atlas arrows 30-33 exist for future authored signage but are not scattered
    // through TS-01 until route/sign semantics explicitly request them.
    for (const sprite of sprites) {
      expect(sprite.asset).not.toMatch(/main-hall-floor-3[0-3]\.png$/);
    }
  });

  it("renders Main Hall material before existing grounding shadows without changing layer ownership", () => {
    expect(TS01_GENERATED_FLOOR.visual.kind).toBe("composite");
    if (TS01_GENERATED_FLOOR.visual.kind !== "composite") return;

    const floorFx = TS01_GENERATED_FLOOR.visual.layers.find((layer) => layer.id === "floor-fx");
    expect(floorFx?.kind).toBe("sprites");
    if (floorFx?.kind !== "sprites") return;

    const hallSprites = floorFx.sprites.filter((sprite) => sprite.id.startsWith("main-hall-floor:"));
    const firstShadow = floorFx.sprites.findIndex((sprite) => sprite.id.startsWith("shadow:"));
    const lastHall = floorFx.sprites.reduce(
      (index, sprite, current) => (sprite.id.startsWith("main-hall-floor:") ? current : index),
      -1,
    );

    expect(hallSprites.length).toBeGreaterThan(0);
    expect(firstShadow).toBeGreaterThan(lastHall);
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
