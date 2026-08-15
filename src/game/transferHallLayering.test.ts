import { describe, expect, it } from "vitest";
import { TRANSFER_HALL_MAP } from "./maps/transferHall";

const TILE = 64;
const COLUMNS = TRANSFER_HALL_MAP.width;
const tileLayers = TRANSFER_HALL_MAP.layers.filter((layer): layer is any => layer.type === "tilelayer");
const byName = (name: string) => tileLayers.find((layer) => layer.name === name)!;
const cell = (name: string, col: number, row: number) => byName(name).data[row * COLUMNS + col] as number;

describe("TS-01 Layout v3 layer/topology contract", () => {
  it("uses the binding visual-layer order on the expanded composition canvas", () => {
    expect(TRANSFER_HALL_MAP.width).toBe(25);
    expect(TRANSFER_HALL_MAP.height).toBe(20);
    expect(tileLayers.map((layer) => layer.name)).toEqual(["Ground", "FloorFX", "Architecture", "WallProps", "FloorProps"]);
  });

  it("uses an irregular footprint instead of filling the rectangular map bounds", () => {
    expect(cell("Ground", 2, 2)).not.toBe(0);   // living
    expect(cell("Ground", 16, 4)).not.toBe(0); // PRIMUS
    expect(cell("Ground", 12, 16)).not.toBe(0); // Transfer
    expect(cell("Ground", 11, 1)).toBe(0);     // gap above hall
    expect(cell("Ground", 22, 16)).toBe(0);    // void east of Transfer
    expect(cell("Ground", 4, 16)).toBe(0);     // void south of domestic cluster
  });

  it("keeps accepted Family assets and their shadows in the living room", () => {
    expect([
      cell("FloorProps", 2, 3), cell("FloorProps", 3, 3), cell("FloorProps", 4, 3),
      cell("FloorProps", 2, 4), cell("FloorProps", 3, 4), cell("FloorProps", 4, 4),
    ]).toEqual([161, 162, 163, 164, 165, 166]);
    expect([
      cell("FloorFX", 2, 3), cell("FloorFX", 3, 3), cell("FloorFX", 4, 3),
      cell("FloorFX", 2, 4), cell("FloorFX", 3, 4), cell("FloorFX", 4, 4),
    ]).toEqual([167, 168, 169, 170, 171, 172]);
    expect([cell("WallProps", 2, 1), cell("WallProps", 3, 1)]).toEqual([173, 174]);
    expect([cell("FloorFX", 2, 1), cell("FloorFX", 3, 1)]).toEqual([175, 176]);
    expect([cell("WallProps", 5, 1), cell("WallProps", 5, 2)]).toEqual([177, 178]);
    expect([cell("FloorFX", 5, 1), cell("FloorFX", 5, 2)]).toEqual([179, 180]);
  });

  it("places plants as edge/corner objects without covering wall furniture", () => {
    expect([cell("FloorProps", 1, 9), cell("FloorProps", 1, 10)]).toEqual([181, 182]);
    expect([cell("FloorFX", 1, 9), cell("FloorFX", 1, 10)]).toEqual([183, 184]);
    expect(cell("FloorProps", 7, 6)).toBe(185);
    expect(cell("FloorFX", 7, 6)).toBe(186);
    expect(cell("WallProps", 1, 9)).toBe(0);
    expect(cell("WallProps", 7, 6)).toBe(0);
  });

  it("adds explicit child-room and hygiene blockouts without pretending they are final art", () => {
    const domestic = TRANSFER_HALL_MAP.tilesets.find((tileset) => tileset.firstgid === 201);
    expect(domestic).toMatchObject({
      image: "/assets/deck/ts01-domestic-blockout-props.svg",
      tilewidth: 64,
      tileheight: 64,
      tilecount: 4,
      columns: 4,
    });
    expect([cell("FloorProps", 2, 10), cell("FloorProps", 3, 10)]).toEqual([201, 202]);
    expect(cell("FloorProps", 7, 9)).toBe(203);
    expect(cell("FloorProps", 4, 11)).toBe(204);
  });

  it("uses real room openings rather than decorative wall stubs", () => {
    // Living → Hall
    expect(cell("Architecture", 8, 4)).toBe(0);
    expect(cell("Architecture", 8, 5)).toBe(0);
    expect(cell("Architecture", 9, 4)).toBe(0);
    expect(cell("Architecture", 9, 5)).toBe(0);
    // Living → child / hygiene
    expect(cell("Architecture", 2, 7)).toBe(0);
    expect(cell("Architecture", 3, 7)).toBe(0);
    expect(cell("Architecture", 2, 8)).toBe(0);
    expect(cell("Architecture", 3, 8)).toBe(0);
    expect(cell("Architecture", 6, 7)).toBe(0);
    expect(cell("Architecture", 7, 7)).toBe(0);
    expect(cell("Architecture", 6, 8)).toBe(0);
    expect(cell("Architecture", 7, 8)).toBe(0);
  });

  it("keeps the PRIMUS controlled threshold visually clear on both sides", () => {
    for (const row of [4, 5]) {
      expect(cell("Architecture", 13, row)).toBe(0);
      expect(cell("Architecture", 14, row)).toBe(0);
      expect(cell("WallProps", 12, row)).toBe(0);
      expect(cell("WallProps", 13, row)).toBe(0);
      expect(cell("WallProps", 14, row)).toBe(0);
      expect(cell("WallProps", 15, row)).toBe(0);
      expect(cell("FloorProps", 12, row)).toBe(0);
      expect(cell("FloorProps", 13, row)).toBe(0);
      expect(cell("FloorProps", 14, row)).toBe(0);
      expect(cell("FloorProps", 15, row)).toBe(0);
    }
  });

  it("moves the hologram into the Transfer room while keeping the Hall entrance clear", () => {
    expect(cell("FloorProps", 10, 16)).toBe(187);
    expect(cell("FloorFX", 10, 16)).toBe(188);
    expect(cell("Architecture", 10, 13)).toBe(0);
    expect(cell("Architecture", 11, 13)).toBe(0);
    expect(cell("Architecture", 10, 14)).toBe(0);
    expect(cell("Architecture", 11, 14)).toBe(0);
    expect(cell("FloorProps", 10, 14)).toBe(0);
    expect(cell("FloorProps", 11, 14)).toBe(0);
  });

  it("keeps Transfer support clustered in the destination room", () => {
    expect([cell("WallProps", 15, 14), cell("WallProps", 16, 14)]).toEqual([191, 192]);
    expect([cell("WallProps", 11, 19), cell("WallProps", 12, 19)]).toEqual([197, 198]);
    expect([
      cell("FloorProps", 11, 15), cell("FloorProps", 12, 15), cell("FloorProps", 13, 15),
      cell("FloorProps", 11, 16), cell("FloorProps", 12, 16), cell("FloorProps", 13, 16),
      cell("FloorProps", 11, 17), cell("FloorProps", 12, 17), cell("FloorProps", 13, 17),
    ]).toEqual([141, 142, 143, 144, 145, 146, 147, 148, 149]);
    expect([
      cell("FloorProps", 14, 16), cell("FloorProps", 15, 16),
      cell("FloorProps", 14, 17), cell("FloorProps", 15, 17),
    ]).toEqual([150, 151, 152, 153]);
  });

  it("uses aligned PRIMUS wall density while keeping the center available", () => {
    expect(cell("WallProps", 15, 1)).toBe(199);
    expect([cell("WallProps", 17, 1), cell("WallProps", 18, 1)]).toEqual([131, 132]);
    expect([cell("WallProps", 20, 1), cell("WallProps", 21, 1)]).toEqual([133, 134]);
    expect([cell("WallProps", 18, 9), cell("WallProps", 19, 9)]).toEqual([197, 198]);
    expect(cell("FloorProps", 18, 5)).toBe(0);
    expect(cell("FloorProps", 20, 6)).toBe(0);
  });

  it("keeps candidate collisions aligned with Layout v3 placement", () => {
    const obstacleLayer = TRANSFER_HALL_MAP.layers.find((layer): layer is any => layer.type === "objectgroup" && layer.name === "Obstacles")!;
    const byObstacleName = (name: string) => obstacleLayer.objects.find((object: any) => object.name === name);
    expect(byObstacleName("family-display-protrusion")?.x).toBeCloseTo(2.25 * TILE, 5);
    expect(byObstacleName("family-planter-trough-solid")?.x).toBeCloseTo(1.18 * TILE, 5);
    expect(byObstacleName("family-planter-trough-solid")?.y).toBeCloseTo(9.55 * TILE, 5);
    expect(byObstacleName("family-round-plant-solid")?.x).toBeCloseTo(7.20 * TILE, 5);
    expect(byObstacleName("family-hologram-solid")?.x).toBeCloseTo(10.18 * TILE, 5);
    expect(byObstacleName("family-hologram-solid")?.y).toBeCloseTo(16.22 * TILE, 5);
  });

  it("contains no scene illumination tile in FloorFX", () => {
    expect((byName("FloorFX").data as number[]).includes(97)).toBe(false);
  });
});
