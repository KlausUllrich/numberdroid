import { describe, expect, it } from "vitest";
import { TS01_GENERATED_FLOOR, TS01_GENERATED_PLAN } from "./generatedTs01Preview";
import { MAIN_HALL_TILE_CONTRACT, mainHallFloorSprites } from "./mainHallFloorPresentation";
import { MAIN_HALL_FLOOR_TILE_METADATA, resolveMainHallNetworkTile } from "./mainHallFloorTileMetadata";
import { MAIN_HALL_FLOOR_VISUAL_POLICY, shouldBranchMainHallSpine } from "./mainHallFloorVisualPolicy";

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

  it("stores explicit metadata for all 36 source cells and quarantines uncalibrated generated alternates", () => {
    expect(MAIN_HALL_FLOOR_TILE_METADATA).toHaveLength(36);
    expect(new Set(MAIN_HALL_FLOOR_TILE_METADATA.map((entry) => entry.index))).toEqual(new Set(Array.from({ length: 36 }, (_, index) => index)));

    for (const index of [14, 15, 16, 18, 19, 20, 22, 30, 31, 32, 33]) {
      expect(MAIN_HALL_FLOOR_TILE_METADATA[index].runtimeEligible).toBe(false);
    }
  });

  it("keeps a complete four-direction T-junction contract for future true corridor branches", () => {
    const variants = MAIN_HALL_TILE_CONTRACT.tJunctionByMissingDirection;
    expect(Object.keys(variants).sort()).toEqual(["east", "north", "south", "west"]);
    expect(new Set(Object.values(variants).map((variant) => variant.index))).toEqual(new Set([13]));
    expect(Object.values(variants).map((variant) => variant.rotation).sort((a, b) => a - b)).toEqual([0, 90, 180, 270]);

    expect(resolveMainHallNetworkTile(["east", "south", "west"])).toMatchObject({ tile: { index: 13 }, rotation: 0 });
    expect(resolveMainHallNetworkTile(["north", "south", "west"])).toMatchObject({ tile: { index: 13 }, rotation: 90 });
    expect(resolveMainHallNetworkTile(["east", "north", "west"])).toMatchObject({ tile: { index: 13 }, rotation: 180 });
    expect(resolveMainHallNetworkTile(["east", "north", "south"])).toMatchObject({ tile: { index: 13 }, rotation: 270 });
  });

  it("uses one calibrated continuity family for the circulation spine", () => {
    expect(resolveMainHallNetworkTile(["east", "west"])).toMatchObject({ tile: { index: 7 }, rotation: 0 });
    expect(resolveMainHallNetworkTile(["north", "south"])).toMatchObject({ tile: { index: 10 }, rotation: 0 });
    expect(resolveMainHallNetworkTile(["south"])).toMatchObject({ tile: { index: 23 }, rotation: 0 });
    expect(resolveMainHallNetworkTile(["north"])).toMatchObject({ tile: { index: 23 }, rotation: 180 });

    const sprites = mainHallFloorSprites(TS01_GENERATED_PLAN);
    for (const sprite of sprites.filter((entry) => entry.id.startsWith("main-hall-floor:straight:"))) {
      expect(sprite.asset).toMatch(/main-hall-floor-(?:07|10)\.png$/);
    }
  });

  it("treats room doors as thresholds, not traffic junctions or false route terminals", () => {
    expect(shouldBranchMainHallSpine("room")).toBe(false);
    expect(shouldBranchMainHallSpine("corridor")).toBe(true);

    const sprites = mainHallFloorSprites(TS01_GENERATED_PLAN);
    // TS-01 connects Main Hall only to rooms (Living, Transfer, PRIMUS), so the
    // current slice should read as one continuous straight Hall rather than a
    // wiring graph or a route that visibly stops before Transfer.
    expect(sprites.some((sprite) => sprite.id.startsWith("main-hall-floor:junction-t:"))).toBe(false);
    expect(sprites.some((sprite) => sprite.id.startsWith("main-hall-floor:junction-cross:"))).toBe(false);
    expect(sprites.some((sprite) => sprite.id.startsWith("main-hall-floor:corner:"))).toBe(false);
    expect(sprites.some((sprite) => sprite.id.startsWith("main-hall-floor:straight:"))).toBe(true);
    expect(sprites.some((sprite) => sprite.id.startsWith("main-hall-floor:terminal:"))).toBe(false);
  });

  it("keeps the Hall spine straight immediately before the Transfer threshold", () => {
    const geometry = TS01_GENERATED_PLAN.events.actors.props.navigation.geometry;
    const hall = geometry.spaces.find((space) => space.id === "main-hall");
    const transferConnection = geometry.connections.find((connection) => (
      connection.id === "hall-to-transfer" && (connection.from === "main-hall" || connection.to === "main-hall")
    ));
    expect(hall).toBeDefined();
    expect(transferConnection).toBeDefined();
    if (!hall || !transferConnection) return;

    const side = transferConnection.from === hall.id ? transferConnection.fromSide : transferConnection.toSide;
    expect(side).toBe("south");

    const spineX = hall.rect.x + Math.floor((hall.rect.w - 1) / 2);
    const predecessorY = hall.rect.y + hall.rect.h - 2;
    const bounds = geometry.bounds;
    const sprite = mainHallFloorSprites(TS01_GENERATED_PLAN).find((entry) => (
      entry.x === (spineX - bounds.x) * 64 && entry.y === (predecessorY - bounds.y) * 64
    ));

    expect(sprite).toBeDefined();
    expect(sprite?.id).toContain("main-hall-floor:straight:");
    expect(sprite?.asset).toMatch(/main-hall-floor-10\.png$/);
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

    for (const sprite of sprites) {
      expect(sprite.asset).not.toMatch(/main-hall-floor-3[0-3]\.png$/);
    }
  });

  it("keeps all non-route, non-threshold cells on one calm base material", () => {
    expect(MAIN_HALL_FLOOR_VISUAL_POLICY.baseTileIndex).toBe(0);
    expect(MAIN_HALL_FLOOR_VISUAL_POLICY.reserveDecorativeServiceAndWear).toBe(true);

    const sprites = mainHallFloorSprites(TS01_GENERATED_PLAN);
    const baseSprites = sprites.filter((sprite) => sprite.id.startsWith("main-hall-floor:base:"));
    expect(baseSprites.length).toBeGreaterThan(0);
    for (const sprite of baseSprites) expect(sprite.asset).toMatch(/main-hall-floor-00\.png$/);
    expect(sprites.some((sprite) => sprite.id.startsWith("main-hall-floor:service:"))).toBe(false);
    expect(sprites.some((sprite) => sprite.id.startsWith("main-hall-floor:wear:"))).toBe(false);
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
