import { describe, expect, it } from "vitest";
import { pointWalkable } from "./save";

const TILE = 64;

describe("TS-01 Layout v3 traversal contract", () => {
  it("connects the living room to the main hall through a broad domestic opening", () => {
    const y = 4.7 * TILE;
    expect(pointWalkable(7.4 * TILE, y, "transfer-hall", 18)).toBe(true);
    expect(pointWalkable(8.5 * TILE, y, "transfer-hall", 18)).toBe(true);
    expect(pointWalkable(9.5 * TILE, y, "transfer-hall", 18)).toBe(true);
  });

  it("connects the living room to the child and hygiene pockets", () => {
    expect(pointWalkable(3.0 * TILE, 6.5 * TILE, "transfer-hall", 14)).toBe(true);
    expect(pointWalkable(3.0 * TILE, 7.5 * TILE, "transfer-hall", 14)).toBe(true);
    expect(pointWalkable(3.0 * TILE, 8.5 * TILE, "transfer-hall", 14)).toBe(true);

    expect(pointWalkable(7.5 * TILE, 6.5 * TILE, "transfer-hall", 12)).toBe(true);
    expect(pointWalkable(7.5 * TILE, 7.5 * TILE, "transfer-hall", 12)).toBe(true);
    expect(pointWalkable(7.5 * TILE, 8.6 * TILE, "transfer-hall", 12)).toBe(true);
  });

  it("connects the hall to both the controlled PRIMUS room and the south Transfer room", () => {
    const primusY = 4.7 * TILE;
    expect(pointWalkable(12.5 * TILE, primusY, "transfer-hall", 18)).toBe(true);
    expect(pointWalkable(13.5 * TILE, primusY, "transfer-hall", 18)).toBe(true);
    expect(pointWalkable(14.5 * TILE, primusY, "transfer-hall", 18)).toBe(true);

    const transferX = 10.7 * TILE;
    expect(pointWalkable(transferX, 12.4 * TILE, "transfer-hall", 18)).toBe(true);
    expect(pointWalkable(transferX, 13.5 * TILE, "transfer-hall", 18)).toBe(true);
    expect(pointWalkable(transferX, 14.6 * TILE, "transfer-hall", 18)).toBe(true);
  });

  it("keeps void outside the irregular floor plan non-walkable", () => {
    expect(pointWalkable(11 * TILE, 1.5 * TILE, "transfer-hall", 12)).toBe(false);
    expect(pointWalkable(4 * TILE, 16 * TILE, "transfer-hall", 12)).toBe(false);
    expect(pointWalkable(22 * TILE, 16 * TILE, "transfer-hall", 12)).toBe(false);
  });

  it("blocks the Transfer Cradle core while preserving circulation around it", () => {
    expect(pointWalkable(12.5 * TILE, 16.5 * TILE, "transfer-hall", 18)).toBe(false);
    expect(pointWalkable(9.3 * TILE, 16.5 * TILE, "transfer-hall", 12)).toBe(true);
    expect(pointWalkable(16.4 * TILE, 16.5 * TILE, "transfer-hall", 12)).toBe(true);
  });
});
