import { afterEach, describe, expect, it, vi } from "vitest";
import { getPreviewFloorId } from "./floors";

afterEach(() => vi.unstubAllGlobals());

describe("preview floor routing", () => {
  it("resolves the direct Transfer Hall preview explicitly", () => {
    vi.stubGlobal("window", { location: { search: "?floor=transfer-hall" } });
    expect(getPreviewFloorId()).toBe("transfer-hall");
  });

  it("does not activate preview routing on a normal launch", () => {
    vi.stubGlobal("window", { location: { search: "" } });
    expect(getPreviewFloorId()).toBeNull();
  });
});
