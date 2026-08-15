import { describe, expect, it } from "vitest";
import { TRANSFER_HALL_MAP } from "./maps/transferHall";
import { pointWalkable } from "./save";

const TILE = 64;
const tileLayers = TRANSFER_HALL_MAP.layers.filter((layer): layer is any => layer.type === "tilelayer");
const byName = (name: string) => tileLayers.find((layer) => layer.name === name)!;
const cell = (name: string, col: number, row: number) => byName(name).data[row * 20 + col] as number;

describe("Transfer Hall Slice 0.3 layer contract", () => {
  it("uses the binding tile-layer order", () => {
    expect(tileLayers.map((layer) => layer.name)).toEqual(["Ground", "FloorFX", "Architecture", "WallProps", "FloorProps"]);
  });

  it("keeps props out of the floor tileset", () => {
    for (const name of ["WallProps", "FloorProps"]) {
      const gids = (byName(name).data as number[]).filter(Boolean);
      expect(gids.length).toBeGreaterThan(0);
      expect(gids.every((gid) => gid >= 129)).toBe(true);
    }
  });

  it("routes the Family Table through its dedicated 3x2 candidate tileset", () => {
    const familyTable = TRANSFER_HALL_MAP.tilesets.find((tileset) => tileset.firstgid === 161);
    expect(familyTable).toMatchObject({ image: "/assets/deck/family-table-props.png", tilewidth: 64, tileheight: 64, tilecount: 6, columns: 3 });
    expect([
      cell("FloorProps", 2, 4), cell("FloorProps", 3, 4), cell("FloorProps", 4, 4),
      cell("FloorProps", 2, 5), cell("FloorProps", 3, 5), cell("FloorProps", 4, 5),
    ]).toEqual([161, 162, 163, 164, 165, 166]);
  });

  it("routes the Family Table grounding shadow through a dedicated 3x2 FloorFX tileset", () => {
    const familyShadow = TRANSFER_HALL_MAP.tilesets.find((tileset) => tileset.firstgid === 167);
    expect(familyShadow).toMatchObject({ image: "/assets/deck/family-table-shadow.png", tilewidth: 64, tileheight: 64, tilecount: 6, columns: 3 });
    expect([
      cell("FloorFX", 2, 4), cell("FloorFX", 3, 4), cell("FloorFX", 4, 4),
      cell("FloorFX", 2, 5), cell("FloorFX", 3, 5), cell("FloorFX", 4, 5),
    ]).toEqual([167, 168, 169, 170, 171, 172]);
  });

  it("routes the Family Memory Console through a dedicated 2x1 WallProps tileset", () => {
    const familyConsole = TRANSFER_HALL_MAP.tilesets.find((tileset) => tileset.firstgid === 173);
    expect(familyConsole).toMatchObject({ image: "/assets/deck/family-memory-console.png", tilewidth: 64, tileheight: 64, tilecount: 2, columns: 2 });
    expect([cell("WallProps", 3, 1), cell("WallProps", 4, 1)]).toEqual([173, 174]);
  });

  it("routes the Family Memory Console grounding shadow through a dedicated 2x1 FloorFX tileset", () => {
    const familyConsoleShadow = TRANSFER_HALL_MAP.tilesets.find((tileset) => tileset.firstgid === 175);
    expect(familyConsoleShadow).toMatchObject({ image: "/assets/deck/family-memory-console-shadow.png", tilewidth: 64, tileheight: 64, tilecount: 2, columns: 2 });
    expect([cell("FloorFX", 3, 1), cell("FloorFX", 4, 1)]).toEqual([175, 176]);
  });

  it("moves the Family Memory Console collision inward with the visual placement", () => {
    const obstacleLayer = TRANSFER_HALL_MAP.layers.find((layer): layer is any => layer.type === "objectgroup" && layer.name === "Obstacles")!;
    const familyConsoleObstacle = obstacleLayer.objects.find((object: any) => object.name === "family-display-protrusion");
    expect(familyConsoleObstacle).toBeTruthy();
    expect(familyConsoleObstacle.x).toBeCloseTo(3.25 * TILE, 5);
    expect(familyConsoleObstacle.y).toBeCloseTo(1.408125 * TILE, 5);
    expect(familyConsoleObstacle.width).toBeCloseTo(1.50 * TILE, 5);
    expect(familyConsoleObstacle.height).toBeCloseTo(0.56 * TILE, 5);
  });

  it("routes Family Props Batch 2 through dedicated tilesets and shadows", () => {
    expect(TRANSFER_HALL_MAP.tilesets.find((tileset) => tileset.firstgid === 177)).toMatchObject({ image: "/assets/deck/family-coffee-machine.png", tilecount: 2, columns: 1 });
    expect(TRANSFER_HALL_MAP.tilesets.find((tileset) => tileset.firstgid === 179)).toMatchObject({ image: "/assets/deck/family-coffee-machine-shadow.png", tilecount: 2, columns: 1 });
    expect(TRANSFER_HALL_MAP.tilesets.find((tileset) => tileset.firstgid === 181)).toMatchObject({ image: "/assets/deck/family-planter-trough.png", tilecount: 2, columns: 1 });
    expect(TRANSFER_HALL_MAP.tilesets.find((tileset) => tileset.firstgid === 183)).toMatchObject({ image: "/assets/deck/family-planter-trough-shadow.png", tilecount: 2, columns: 1 });
    expect(TRANSFER_HALL_MAP.tilesets.find((tileset) => tileset.firstgid === 185)).toMatchObject({ image: "/assets/deck/family-round-plant.png", tilecount: 1, columns: 1 });
    expect(TRANSFER_HALL_MAP.tilesets.find((tileset) => tileset.firstgid === 186)).toMatchObject({ image: "/assets/deck/family-round-plant-shadow.png", tilecount: 1, columns: 1 });
    expect(TRANSFER_HALL_MAP.tilesets.find((tileset) => tileset.firstgid === 187)).toMatchObject({ image: "/assets/deck/family-hologram-pedestal.png", tilecount: 1, columns: 1 });
    expect(TRANSFER_HALL_MAP.tilesets.find((tileset) => tileset.firstgid === 188)).toMatchObject({ image: "/assets/deck/family-hologram-pedestal-shadow.png", tilecount: 1, columns: 1 });
  });

  it("keeps the coffee machine at the upper wall with its access side facing into the room", () => {
    expect([cell("WallProps", 5, 1), cell("WallProps", 5, 2)]).toEqual([177, 178]);
    expect([cell("FloorFX", 5, 1), cell("FloorFX", 5, 2)]).toEqual([179, 180]);
  });

  it("anchors both plants to Family edge clusters and pulls the hologram beside Transfer", () => {
    expect([cell("FloorProps", 2, 8), cell("FloorProps", 2, 9)]).toEqual([181, 182]);
    expect([cell("FloorFX", 2, 8), cell("FloorFX", 2, 9)]).toEqual([183, 184]);
    expect(cell("FloorProps", 6, 9)).toBe(185);
    expect(cell("FloorFX", 6, 9)).toBe(186);
    expect(cell("FloorProps", 11, 4)).toBe(187);
    expect(cell("FloorFX", 11, 4)).toBe(188);
  });

  it("keeps Batch 2 collision footprints aligned with Composition Preview v2", () => {
    const obstacleLayer = TRANSFER_HALL_MAP.layers.find((layer): layer is any => layer.type === "objectgroup" && layer.name === "Obstacles")!;
    const byObstacleName = (name: string) => obstacleLayer.objects.find((object: any) => object.name === name);
    expect(byObstacleName("family-planter-trough-solid")?.y).toBeCloseTo(8.55 * TILE, 5);
    expect(byObstacleName("family-round-plant-solid")?.x).toBeCloseTo(6.20 * TILE, 5);
    expect(byObstacleName("family-round-plant-solid")?.y).toBeCloseTo(9.28 * TILE, 5);
    expect(byObstacleName("family-hologram-solid")?.x).toBeCloseTo(11.18 * TILE, 5);
    expect(byObstacleName("family-hologram-solid")?.y).toBeCloseTo(4.22 * TILE, 5);
  });

  it("uses a soft Family to Transfer boundary with no unsupported wall stubs", () => {
    const obstacleLayer = TRANSFER_HALL_MAP.layers.find((layer): layer is any => layer.type === "objectgroup" && layer.name === "Obstacles")!;
    const names = obstacleLayer.objects.map((object: any) => object.name);
    expect(names).not.toContain("family-return-north");
    expect(names).not.toContain("family-return-south");
    expect(cell("Architecture", 6, 1)).toBe(81);
    expect(cell("Architecture", 6, 10)).toBe(82);
    for (let row = 2; row <= 9; row += 1) expect(cell("Architecture", 6, row)).toBe(0);
    expect(pointWalkable(6.5 * TILE, 2.5 * TILE, "transfer-hall", 18)).toBe(true);
    expect(pointWalkable(6.5 * TILE, 6.0 * TILE, "transfer-hall", 18)).toBe(true);
    expect(pointWalkable(6.5 * TILE, 9.0 * TILE, "transfer-hall", 18)).toBe(true);
  });

  it("routes composition blockouts through wall-backed functional clusters", () => {
    const blockout = TRANSFER_HALL_MAP.tilesets.find((tileset) => tileset.firstgid === 189);
    expect(blockout).toMatchObject({ image: "/assets/deck/ts01-gold-slice-blockout-props.svg", tilewidth: 64, tileheight: 64, tilecount: 12, columns: 4 });

    expect([cell("WallProps", 3, 10), cell("WallProps", 4, 10)]).toEqual([189, 190]);
    expect([cell("WallProps", 5, 10), cell("WallProps", 6, 10)]).toEqual([193, 194]);
    expect(cell("FloorProps", 3, 9)).toBe(196);
    expect(cell("FloorProps", 5, 9)).toBe(195);

    expect([cell("WallProps", 9, 1), cell("WallProps", 10, 1)]).toEqual([191, 192]);
    expect([cell("WallProps", 9, 10), cell("WallProps", 10, 10)]).toEqual([197, 198]);

    expect(cell("WallProps", 13, 1)).toBe(199);
    expect([cell("WallProps", 15, 10), cell("WallProps", 16, 10)]).toEqual([197, 198]);
  });

  it("has a complete outer-wall marker on every perimeter cell", () => {
    for (let col = 1; col <= 18; col += 1) {
      expect(cell("Architecture", col, 1)).not.toBe(0);
      expect(cell("Architecture", col, 10)).not.toBe(0);
    }
    for (let row = 1; row <= 10; row += 1) {
      expect(cell("Architecture", 1, row)).not.toBe(0);
      expect(cell("Architecture", 18, row)).not.toBe(0);
    }
  });

  it("uses explicit T-junctions where the functional PRIMUS divider meets outer walls", () => {
    expect(cell("Architecture", 12, 1)).toBe(90);
    expect(cell("Architecture", 12, 10)).toBe(91);
  });

  it("contains no scene-light marker in FloorFX", () => {
    expect((byName("FloorFX").data as number[]).includes(97)).toBe(false);
  });

  it("has a genuinely open two-tile PRIMUS doorway with no hidden collision", () => {
    expect(cell("Architecture", 12, 5)).toBe(0);
    expect(cell("Architecture", 12, 6)).toBe(0);
    expect(pointWalkable(12.5 * TILE, 5.5 * TILE, "transfer-hall", 18)).toBe(true);
    expect(pointWalkable(12.5 * TILE, 6.5 * TILE, "transfer-hall", 18)).toBe(true);
    expect(pointWalkable(12.5 * TILE, 4.5 * TILE, "transfer-hall", 18)).toBe(false);
    expect(pointWalkable(12.5 * TILE, 7.5 * TILE, "transfer-hall", 18)).toBe(false);
  });
});
