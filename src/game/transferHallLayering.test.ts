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
    expect(familyTable).toMatchObject({
      image: "/assets/deck/family-table-props.png",
      tilewidth: 64,
      tileheight: 64,
      tilecount: 6,
      columns: 3,
    });
    expect([
      cell("FloorProps", 2, 4), cell("FloorProps", 3, 4), cell("FloorProps", 4, 4),
      cell("FloorProps", 2, 5), cell("FloorProps", 3, 5), cell("FloorProps", 4, 5),
    ]).toEqual([161, 162, 163, 164, 165, 166]);
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

  it("uses explicit T-junctions where divider meets outer walls", () => {
    expect(cell("Architecture", 12, 1)).toBe(90);
    expect(cell("Architecture", 12, 10)).toBe(91);
  });

  it("contains no scene-light marker in FloorFX", () => {
    expect((byName("FloorFX").data as number[]).includes(97)).toBe(false);
  });

  it("has a genuinely open two-tile doorway with no hidden collision", () => {
    expect(cell("Architecture", 12, 5)).toBe(0);
    expect(cell("Architecture", 12, 6)).toBe(0);
    expect(pointWalkable(12.5 * TILE, 5.5 * TILE, "transfer-hall", 18)).toBe(true);
    expect(pointWalkable(12.5 * TILE, 6.5 * TILE, "transfer-hall", 18)).toBe(true);
    expect(pointWalkable(12.5 * TILE, 4.5 * TILE, "transfer-hall", 18)).toBe(false);
    expect(pointWalkable(12.5 * TILE, 7.5 * TILE, "transfer-hall", 18)).toBe(false);
  });
});
