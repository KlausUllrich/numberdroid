import { describe, expect, it } from "vitest";
import { directionClassForFacing, directionIndexForFacing } from "./robotDirection";

describe("8-direction robot facing", () => {
  it("maps authored facing to the nearest 45 degree frame", () => {
    expect(directionIndexForFacing(0)).toBe(0);
    expect(directionIndexForFacing(45)).toBe(1);
    expect(directionIndexForFacing(90)).toBe(2);
    expect(directionIndexForFacing(180)).toBe(4);
    expect(directionIndexForFacing(270)).toBe(6);
  });

  it("wraps negative and near-360 values", () => {
    expect(directionIndexForFacing(-90)).toBe(6);
    expect(directionIndexForFacing(359)).toBe(0);
    expect(directionClassForFacing(225)).toBe("dir-5");
  });
});
