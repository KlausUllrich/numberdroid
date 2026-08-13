import { describe, expect, it } from "vitest";
import { TRANSFER_HALL_MAP } from "./maps/transferHall";
import { pointWalkable } from "./save";

const TILE = 64;
const tileLayers = TRANSFER_HALL_MAP.layers.filter((layer): layer is any => layer.type === "tilelayer");
const byName = (name: string) => tileLayers.find((layer) => layer.name === name)!;
const cell = (name: string, col: number, row: number) => byName(name).data[row * 20 + col] as number;

describe("Transfer Hall Slice 0.2 layer contract", () => {
  it("uses the binding render-layer order", () => {
    expect(tileLayers.map((layer) => layer.name)).toEqual(["Ground", "FloorFX", "Architecture", "WallProps", "FloorProps"]);
  });

  it("keeps props out of the floor tileset", () => {
    for (const name of ["WallProps", "FloorProps"]) {
      const gids = (byName(name).data as number[]).filter(Boolean);
      expect(gids.length).toBeGreaterThan(0);
      expect(gids.every((gid) => gid >= 129)).toBe(true);
    }
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

  it("uses one continuous Transfer-light marker instead of a sliced 3x3 glow", () => {
    for (let row = 4; row <= 6; row += 1) {
      for (let col = 8; col <= 10; col += 1) {
        expect(cell("FloorFX", col, row)).toBe(col === 9 && row === 5 ? 97 : 0);
      }
    }
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
