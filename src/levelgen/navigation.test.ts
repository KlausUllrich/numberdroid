import { describe, expect, it } from "vitest";
import { compileLevelSpec } from "./compiler";
import { compileLevelGeometry } from "./geometry";
import { compileLevelNavigation } from "./navigation";
import { NUMBERDROID_PROP_REGISTRY } from "./propRegistry";
import { TS01_LEVEL_SPEC } from "./specs/ts01";

function compileNavigation() {
  const semantic = compileLevelSpec(TS01_LEVEL_SPEC, NUMBERDROID_PROP_REGISTRY);
  const geometry = compileLevelGeometry(semantic);
  return compileLevelNavigation(geometry);
}

describe("Level Compiler v0.2 navigation contract", () => {
  it("builds one globally connected walkable-cell graph", () => {
    const plan = compileNavigation();
    expect(plan.walkableCells.length).toBeGreaterThan(100);
    expect(plan.diagnostics.some((entry) => entry.code === "NAVIGATION_CONNECTED")).toBe(true);
    expect(plan.primaryRoutes).toHaveLength(plan.geometry.spaces.length - 1);
    expect(plan.primaryRoutes.every((route) => route.cells.length > 0)).toBe(true);
  });

  it("preserves the authored three-tile main-hall width in generated walkability", () => {
    const plan = compileNavigation();
    const hall = plan.geometry.spaces.find((space) => space.id === "main-hall")!;
    expect(hall.kind).toBe("corridor");
    expect(hall.rect.w).toBe(3);
    const hallCells = plan.walkableCells.filter((cell) => cell.spaceId === "main-hall");
    const xs = new Set(hallCells.map((cell) => cell.x));
    expect(xs.size).toBe(3);
  });

  it("compiles every aperture into explicit cross-space portal-cell pairs", () => {
    const plan = compileNavigation();
    expect(plan.portals).toHaveLength(plan.geometry.connections.length);
    const primus = plan.portals.find((portal) => portal.connectionId === "hall-to-primus")!;
    expect(primus.kind).toBe("controlled-door");
    expect(primus.pairs).toHaveLength(2);
    expect(primus.pairs.every((pair) => pair.from.spaceId === "main-hall" && pair.to.spaceId === "primus-allocation")).toBe(true);
  });

  it("reserves door-clearance cells on both sides of controlled thresholds", () => {
    const plan = compileNavigation();
    const primusClearance = plan.forbiddenCells.filter(
      (cell) => cell.reasons.includes("door-clearance") && cell.sourceIds.includes("hall-to-primus"),
    );
    expect(primusClearance.some((cell) => cell.spaceId === "main-hall")).toBe(true);
    expect(primusClearance.some((cell) => cell.spaceId === "primus-allocation")).toBe(true);
  });

  it("reserves a primary circulation skeleton from the root space to every generated space", () => {
    const plan = compileNavigation();
    const coveredSpaces = new Set(plan.primaryPathCells.map((cell) => cell.spaceId));
    for (const space of plan.geometry.spaces) expect(coveredSpaces.has(space.id)).toBe(true);
    expect(plan.forbiddenCells.some((cell) => cell.reasons.includes("primary-circulation"))).toBe(true);
  });

  it("does not offer a wall attachment slot through a compiled doorway aperture", () => {
    const plan = compileNavigation();
    const portal = plan.portals.find((entry) => entry.connectionId === "living-to-child")!;
    const fromCell = portal.centerPair.from;
    const apertureSlot = plan.wallAttachmentSlots.find(
      (slot) => slot.spaceId === "family-living"
        && slot.side === "south"
        && slot.cell.x === fromCell.x
        && slot.cell.y === fromCell.y,
    );
    expect(apertureSlot).toBeUndefined();
  });

  it("marks wall slots with circulation/clearance blocking instead of discarding the wall topology", () => {
    const plan = compileNavigation();
    const livingSlots = plan.wallAttachmentSlots.filter((slot) => slot.spaceId === "family-living");
    expect(livingSlots.length).toBeGreaterThan(0);
    expect(livingSlots.some((slot) => slot.blockedBy.length === 0)).toBe(true);
    expect(plan.wallAttachmentSlots.some((slot) => slot.blockedBy.includes("primary-circulation"))).toBe(true);
  });

  it("is deterministic for the same semantic seed and geometry", () => {
    const a = compileNavigation();
    const b = compileNavigation();
    expect(a.primaryPathCells).toEqual(b.primaryPathCells);
    expect(a.forbiddenCells).toEqual(b.forbiddenCells);
    expect(a.wallAttachmentSlots).toEqual(b.wallAttachmentSlots);
  });
});
