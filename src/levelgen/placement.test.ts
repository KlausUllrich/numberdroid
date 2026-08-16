import { describe, expect, it } from "vitest";
import { compileLevelSpec } from "./compiler";
import { compileLevelGeometry } from "./geometry";
import { compileLevelNavigation } from "./navigation";
import { compilePropPlacement } from "./placement";
import { NUMBERDROID_PROP_REGISTRY } from "./propRegistry";
import { TS01_LEVEL_SPEC } from "./specs/ts01";
import type { LevelSpec } from "./types";

function compile(spec: LevelSpec = TS01_LEVEL_SPEC) {
  const semantic = compileLevelSpec(spec, NUMBERDROID_PROP_REGISTRY);
  const geometry = compileLevelGeometry(semantic);
  const navigation = compileLevelNavigation(geometry);
  return compilePropPlacement(navigation);
}

function key(x: number, y: number) {
  return `${x},${y}`;
}

describe("Level Compiler v0.3 prop placement", () => {
  it("places every required TS-01 prop instance deterministically", () => {
    const a = compile();
    const b = compile();
    const expected = TS01_LEVEL_SPEC.props.reduce((sum, request) => sum + (request.quantity ?? 1), 0);
    expect(a.placements).toHaveLength(expected);
    expect(a.placements.map((entry) => [entry.id, entry.rect, entry.wallSide])).toEqual(
      b.placements.map((entry) => [entry.id, entry.rect, entry.wallSide]),
    );
  });

  it("keeps wall props on real compiled walls and honors authored wall preference when valid", () => {
    const plan = compile();
    expect(plan.placements.find((entry) => entry.id === "living-memory")?.wallSide).toBe("north");
    expect(plan.placements.find((entry) => entry.id === "living-coffee")?.wallSide).toBe("north");
    expect(plan.placements.filter((entry) => entry.requestId === "primus-service")).toHaveLength(2);
    expect(plan.placements.filter((entry) => entry.requestId === "primus-service").every((entry) => entry.wallSide === "north")).toBe(true);
  });

  it("places the bathroom toilet on the wall opposite its door", () => {
    const plan = compile();
    const toilet = plan.placements.find((entry) => entry.id === "bathroom-toilet");
    expect(toilet?.wallSide).toBe("south");
    expect(toilet?.reasons).toContain("opposite door");
  });

  it("keeps ordinary prop footprints off door clearance and the primary circulation skeleton", () => {
    const plan = compile();
    const forbidden = new Map(plan.navigation.forbiddenCells.map((cell) => [key(cell.x, cell.y), cell.reasons]));
    for (const placement of plan.placements) {
      for (const cell of placement.footprintCells) {
        expect(forbidden.get(key(cell.x, cell.y)) ?? []).not.toContain("door-clearance");
        if (placement.role !== "hero") expect(forbidden.get(key(cell.x, cell.y)) ?? []).not.toContain("primary-circulation");
      }
    }
  });

  it("reserves use-space in front of wall furniture so later plants cannot occupy it", () => {
    const plan = compile();
    const approach = new Set(plan.reservations.filter((entry) => entry.kind === "approach").map((entry) => key(entry.x, entry.y)));
    expect(approach.size).toBeGreaterThan(0);
    for (const plant of plan.placements.filter((entry) => entry.tags.includes("plant"))) {
      for (const cell of plant.footprintCells) expect(approach.has(key(cell.x, cell.y))).toBe(false);
    }
  });

  it("uses hero hierarchy and proximity relationships for the Transfer cluster", () => {
    const plan = compile();
    const core = plan.placements.find((entry) => entry.id === "transfer-core")!;
    const hologram = plan.placements.find((entry) => entry.id === "transfer-hologram")!;
    const flow = plan.placements.find((entry) => entry.id === "transfer-flow")!;
    expect(core.role).toBe("hero");
    expect(core.reasons).toContain("room-center hero focus");
    const distance = (a: typeof core, b: typeof core) => {
      const ac = { x: a.rect.x + a.rect.w / 2, y: a.rect.y + a.rect.h / 2 };
      const bc = { x: b.rect.x + b.rect.w / 2, y: b.rect.y + b.rect.h / 2 };
      return Math.abs(ac.x - bc.x) + Math.abs(ac.y - bc.y);
    };
    expect(distance(core, hologram)).toBeLessThanOrEqual(5);
    expect(distance(core, flow)).toBeLessThanOrEqual(6);
  });

  it("never overlaps prop footprints or reserved approach/hero-clearance cells", () => {
    const plan = compile();
    const occupied = new Set<string>();
    for (const placement of plan.placements) {
      for (const cell of placement.footprintCells) {
        const cellKey = key(cell.x, cell.y);
        expect(occupied.has(cellKey)).toBe(false);
        occupied.add(cellKey);
      }
    }
    for (const reservation of plan.reservations) expect(occupied.has(key(reservation.x, reservation.y))).toBe(false);
  });

  it("fails loudly when a required prop cannot fit instead of silently dropping it", () => {
    const spec: LevelSpec = {
      ...TS01_LEVEL_SPEC,
      id: "impossible-required-prop",
      props: [
        ...TS01_LEVEL_SPEC.props,
        { id: "impossible-table", propId: "family-table", spaceId: "family-hygiene", role: "furniture" },
      ],
    };
    expect(() => compile(spec)).toThrow(/Required prop impossible-table could not be placed/);
  });
});
