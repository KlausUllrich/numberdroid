import { describe, expect, it } from "vitest";
import { pointWalkable } from "./save";
const TILE = 64;
describe("Transfer Hall traversal contract", () => {
  it("keeps the allocation threshold collision-free on both sides", () => {
    const y=6*TILE;
    expect(pointWalkable(11.45*TILE,y,"transfer-hall",18)).toBe(true);
    expect(pointWalkable(12.5*TILE,y,"transfer-hall",18)).toBe(true);
    expect(pointWalkable(13.55*TILE,y,"transfer-hall",18)).toBe(true);
  });
  it("keeps floor pads driveable", () => {
    expect(pointWalkable(10*TILE,8*TILE,"transfer-hall",18)).toBe(true);
    expect(pointWalkable(14.2*TILE,6.5*TILE,"transfer-hall",18)).toBe(true);
  });
  it("blocks only the solid Transfer Cradle core", () => {
    expect(pointWalkable(9.5*TILE,5.5*TILE,"transfer-hall",18)).toBe(false);
  });
});
