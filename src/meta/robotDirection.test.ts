import { describe, expect, it } from "vitest";
import { directionClassForFacing, directionIndexForFacing } from "./robotDirection";

describe("8-direction robot facing", () => {
  it("maps all eight authored 45-degree headings to distinct frames", () => {
    const headings = [0, 45, 90, 135, 180, 225, 270, 315];
    const indices = headings.map(directionIndexForFacing);
    expect(indices).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(new Set(indices).size).toBe(8);
    expect(headings.map(directionClassForFacing)).toEqual([
      "dir-0", "dir-1", "dir-2", "dir-3", "dir-4", "dir-5", "dir-6", "dir-7",
    ]);
  });

  it("wraps negative and near-360 values", () => {
    expect(directionIndexForFacing(-90)).toBe(6);
    expect(directionIndexForFacing(359)).toBe(0);
    expect(directionClassForFacing(225)).toBe("dir-5");
  });
});
