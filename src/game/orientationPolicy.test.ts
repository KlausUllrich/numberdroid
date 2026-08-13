import { describe, expect, it } from "vitest";
import { requiresLandscape } from "./orientationPolicy";

describe("landscape gameplay policy", () => {
  it("blocks portrait on coarse-pointer/mobile layouts", () => {
    expect(requiresLandscape(412, 915, true)).toBe(true);
  });
  it("allows landscape on mobile", () => {
    expect(requiresLandscape(915, 412, true)).toBe(false);
  });
  it("does not force desktop portrait windows", () => {
    expect(requiresLandscape(700, 1000, false)).toBe(false);
  });
});
