import { describe, expect, it } from "vitest";
import { pointWalkable } from "./save";

const TILE = 64;

describe("Transfer Hall Slice 0 traversal contract", () => {
  it("keeps the allocation doorway clear on approach, threshold and exit", () => {
    const y = 6 * TILE;
    expect(pointWalkable(11.45*TILE,y,"transfer-hall",18)).toBe(true);
    expect(pointWalkable(12.5*TILE,y,"transfer-hall",18)).toBe(true);
    expect(pointWalkable(13.55*TILE,y,"transfer-hall",18)).toBe(true);
  });

  it("makes the divider physically thin instead of a full tile slab", () => {
    const y = 3 * TILE;
    expect(pointWalkable(12.20*TILE,y,"transfer-hall",8)).toBe(true);
    expect(pointWalkable(12.50*TILE,y,"transfer-hall",8)).toBe(false);
    expect(pointWalkable(12.80*TILE,y,"transfer-hall",8)).toBe(true);
  });

  it("keeps intentional floor pads driveable", () => {
    expect(pointWalkable(10*TILE,8*TILE,"transfer-hall",18)).toBe(true);
    expect(pointWalkable(14.4*TILE,6.8*TILE,"transfer-hall",18)).toBe(true);
  });

  it("blocks only the solid Transfer Cradle core", () => {
    expect(pointWalkable(9.5*TILE,5.5*TILE,"transfer-hall",18)).toBe(false);
    expect(pointWalkable(8.30*TILE,5.5*TILE,"transfer-hall",12)).toBe(true);
  });
});
