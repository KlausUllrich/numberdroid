import { describe, expect, it } from "vitest";
import { compileLevelSpec } from "./compiler";
import { compileLevelGeometry } from "./geometry";
import { NUMBERDROID_PROP_REGISTRY } from "./propRegistry";
import { TS01_LEVEL_SPEC } from "./specs/ts01";
import type { LevelSpec } from "./types";

const RANGE_4 = { min: 4, preferred: 4, max: 4 } as const;

function room(id: string, width = RANGE_4, height = RANGE_4) {
  return {
    id,
    kind: "room" as const,
    archetype: "topology-test",
    size: { class: "small" as const, width, height },
  };
}

function spec(overrides: Partial<LevelSpec>): LevelSpec {
  return {
    id: "topology-test",
    version: 1,
    seed: "TOPOLOGY-TEST",
    ruleSetRefs: ["test/topology"],
    rules: {
      ensureReachability: true,
      singleSharedWall: true,
      doorsEmbeddedInWalls: true,
      defaultCorridorWidth: { min: 2, preferred: 3, max: 4 },
      defaultDoorClearance: { before: 1, after: 1 },
    },
    spaces: [room("a"), room("b")],
    connections: [{ id: "a-b", from: "a", to: "b", kind: "opening", widthTiles: 2, preferredSide: "east" }],
    props: [],
    encounters: [],
    stagedActors: [],
    routes: [],
    pickups: [],
    zones: [],
    triggers: [],
    events: [],
    overrides: [],
    ...overrides,
  };
}

function compile(input: LevelSpec) {
  return compileLevelGeometry(compileLevelSpec(input, NUMBERDROID_PROP_REGISTRY));
}

describe("Level Compiler v0.11 cyclic / multi-constraint topology", () => {
  it("preserves the established TS-01 tree-compatible geometry without invoking topology search", () => {
    const result = compile(TS01_LEVEL_SPEC);
    expect(result.spaces.find((space) => space.id === "family-living")?.rect).toEqual({ x: 1, y: 3, w: 7, h: 6 });
    expect(result.spaces.find((space) => space.id === "primus-allocation")?.rect).toEqual({ x: 11, y: 1, w: 9, h: 8 });
    expect(result.diagnostics.some((entry) => entry.code === "TREE_COMPATIBLE_TOPOLOGY_PRESERVED")).toBe(true);
    expect(result.diagnostics.some((entry) => entry.code === "MULTI_CONSTRAINT_FALLBACK_USED")).toBe(false);
  });

  it("closes a cyclic three-space graph and may vary a TileRange when preferred dimensions cannot satisfy every aperture", () => {
    const input = spec({
      id: "triangle-cycle",
      spaces: [
        room("a"),
        room("b"),
        room("c", { min: 6, preferred: 6, max: 8 }, RANGE_4),
      ],
      connections: [
        { id: "a-b", from: "a", to: "b", kind: "opening", widthTiles: 2, preferredSide: "east" },
        { id: "b-c", from: "b", to: "c", kind: "opening", widthTiles: 4, preferredSide: "south" },
        { id: "a-c", from: "a", to: "c", kind: "opening", widthTiles: 3, preferredSide: "south" },
      ],
    });
    const result = compile(input);
    const c = result.spaces.find((space) => space.id === "c")!;

    expect(result.connections).toHaveLength(3);
    expect(c.rect.w).toBe(7);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "MULTI_CONSTRAINT_FALLBACK_USED" }),
      expect.objectContaining({ code: "MULTI_CONSTRAINT_TOPOLOGY_SOLVED" }),
      expect.objectContaining({ code: "SPACE_SIZE_ADJUSTED_FOR_CONSTRAINTS", targetId: "c" }),
    ]));
  });

  it("treats required spatial relations as hard constraints even when they conflict with a connection preferredSide", () => {
    const input = spec({
      id: "required-relation-overrides-preference",
      spaces: [
        room("a"),
        { ...room("b"), relations: [{ targetId: "a", relation: "west_of", strength: "required" }] },
      ],
    });
    const result = compile(input);
    const a = result.spaces.find((space) => space.id === "a")!.rect;
    const b = result.spaces.find((space) => space.id === "b")!.rect;

    expect(b.x + b.w).toBe(a.x);
    expect(result.diagnostics.some((entry) => entry.code === "MULTI_CONSTRAINT_FALLBACK_USED")).toBe(true);
  });

  it("fails loudly when required spatial constraints are mutually impossible", () => {
    const input = spec({
      id: "impossible-required-relations",
      spaces: [
        room("a"),
        {
          ...room("b"),
          relations: [
            { targetId: "a", relation: "east_of", strength: "required" },
            { targetId: "a", relation: "west_of", strength: "required" },
          ],
        },
      ],
    });

    expect(() => compile(input)).toThrow(/Multi-constraint topology solver found no valid arrangement/);
  });
});
