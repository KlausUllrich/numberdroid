import { describe, expect, it } from "vitest";
import { compileLevelSpec } from "./compiler";
import { compileLevelGeometry } from "./geometry";
import { NUMBERDROID_PROP_REGISTRY } from "./propRegistry";
import { TS01_LEVEL_SPEC } from "./specs/ts01";

function geometry() {
  return compileLevelGeometry(compileLevelSpec(TS01_LEVEL_SPEC, NUMBERDROID_PROP_REGISTRY));
}

describe("Level Compiler v0.1 geometry + shared wall contract", () => {
  it("turns the TS-01 semantic graph into deterministic non-overlapping preferred-size geometry", () => {
    const result = geometry();
    const rect = (id: string) => result.spaces.find((space) => space.id === id)?.rect;

    expect(rect("family-living")).toEqual({ x: 1, y: 3, w: 7, h: 6 });
    expect(rect("family-child")).toEqual({ x: 2, y: 9, w: 4, h: 4 });
    expect(rect("family-hygiene")).toEqual({ x: 6, y: 9, w: 2, h: 3 });
    expect(rect("main-hall")).toEqual({ x: 8, y: 1, w: 3, h: 9 });
    expect(rect("transfer-room")).toEqual({ x: 8, y: 10, w: 10, h: 8 });
    expect(rect("primus-allocation")).toEqual({ x: 11, y: 1, w: 9, h: 8 });
    expect(result.bounds).toEqual({ x: 0, y: 0, w: 21, h: 19 });
  });

  it("respects the explicit preferred corridor width and preserves all authored adjacencies", () => {
    const result = geometry();
    const hall = result.spaces.find((space) => space.id === "main-hall")!;
    expect(hall.rect.w).toBe(3);

    const connection = (id: string) => result.connections.find((entry) => entry.id === id)!;
    expect(connection("living-to-hall")).toMatchObject({ wallOrientation: "vertical", boundary: 8, apertureLength: 2 });
    expect(connection("hall-to-transfer")).toMatchObject({ wallOrientation: "horizontal", boundary: 10, apertureLength: 2 });
    expect(connection("hall-to-primus")).toMatchObject({ wallOrientation: "vertical", boundary: 11, apertureLength: 2 });
  });

  it("slides a large destination room along its connection instead of overlapping the domestic pockets", () => {
    const result = geometry();
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "SPACE_SLID_FOR_COLLISION", targetId: "transfer-room" }),
    ]));
    const transfer = result.spaces.find((space) => space.id === "transfer-room")!.rect;
    const child = result.spaces.find((space) => space.id === "family-child")!.rect;
    const hygiene = result.spaces.find((space) => space.id === "family-hygiene")!.rect;
    const overlaps = (a: typeof transfer, b: typeof transfer) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    expect(overlaps(transfer, child)).toBe(false);
    expect(overlaps(transfer, hygiene)).toBe(false);
  });

  it("compiles doors/openings as real apertures in shared boundaries with clearance on both sides", () => {
    const result = geometry();
    const primusDoor = result.connections.find((entry) => entry.id === "hall-to-primus")!;
    expect(primusDoor).toMatchObject({
      fromSide: "east",
      toSide: "west",
      boundary: 11,
      apertureStart: 4,
      apertureLength: 2,
      clearanceBefore: { x: 9.5, y: 4, w: 1.5, h: 2 },
      clearanceAfter: { x: 11, y: 4, w: 1.5, h: 2 },
    });

    const childDoor = result.connections.find((entry) => entry.id === "living-to-child")!;
    expect(childDoor.clearanceBefore).toEqual({ x: 3, y: 7.75, w: 1, h: 1.25 });
    expect(childDoor.clearanceAfter).toEqual({ x: 3, y: 9, w: 1, h: 1.25 });
  });

  it("derives one shared wall graph instead of letting adjacent rooms emit duplicate walls", () => {
    const result = geometry();
    const ids = result.walls.map((wall) => wall.id);
    expect(new Set(ids).size).toBe(ids.length);

    const childHygiene = result.walls.filter((wall) =>
      wall.ownerSpaceIds.length === 2
      && wall.ownerSpaceIds.includes("family-child")
      && wall.ownerSpaceIds.includes("family-hygiene"),
    );
    expect(childHygiene).toHaveLength(1);
    expect(childHygiene[0]).toMatchObject({ orientation: "vertical", x: 6, y: 9, length: 3, shared: true });
  });

  it("removes aperture units from the wall graph rather than drawing a wall behind a door", () => {
    const result = geometry();
    const primusDoor = result.connections.find((entry) => entry.id === "hall-to-primus")!;
    const crossesDoor = result.walls.some((wall) => {
      if (wall.orientation !== "vertical" || wall.x !== primusDoor.boundary) return false;
      const wallStart = wall.y;
      const wallEnd = wall.y + wall.length;
      const doorStart = primusDoor.apertureStart;
      const doorEnd = doorStart + primusDoor.apertureLength;
      return wallStart < doorEnd && wallEnd > doorStart;
    });
    expect(crossesDoor).toBe(false);
  });

  it("is stable across repeated geometry compiles", () => {
    expect(geometry()).toEqual(geometry());
  });
});
