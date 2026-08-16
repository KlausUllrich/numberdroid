import { describe, expect, it } from "vitest";
import { NUMBERDROID_PROP_REGISTRY } from "./propRegistry";
import { TS01_LEVEL_SPEC } from "./specs/ts01";
import {
  compileWorkbenchPlan,
  materializeGeometryLock,
  materializePropLock,
  nudgeLockedGeometry,
  overrideJson,
  regenerateSemanticTarget,
  tryCompileWorkbenchPlan,
} from "./workbench";

function compile(overrides = TS01_LEVEL_SPEC.overrides ?? []) {
  return compileWorkbenchPlan(TS01_LEVEL_SPEC, NUMBERDROID_PROP_REGISTRY, overrides);
}

describe("Level Compiler v0.12 semantic Workbench model", () => {
  it("materializes a Space geometry lock relative to the semantic root and recompiles identically", () => {
    const baseline = compile();
    const geometry = baseline.actors.props.navigation.geometry;
    const root = geometry.spaces[0];
    const transfer = geometry.spaces.find((entry) => entry.id === "transfer-room")!;
    const overrides = materializeGeometryLock(baseline, [], transfer.id);
    const lock = overrides[0];

    expect(lock).toEqual(expect.objectContaining({
      targetId: "transfer-room",
      lockGeometry: true,
      lockedGeometry: {
        offsetFromRootTiles: { x: transfer.rect.x - root.rect.x, y: transfer.rect.y - root.rect.y },
        sizeTiles: { w: transfer.rect.w, h: transfer.rect.h },
      },
    }));

    const locked = compile(overrides);
    expect(locked.actors.props.navigation.geometry.spaces.find((entry) => entry.id === "transfer-room")?.rect).toEqual(transfer.rect);
    expect(locked.diagnostics.some((entry) => entry.code === "GEOMETRY_LOCK_ACTIVE" && entry.targetId === "transfer-room")).toBe(true);
  });

  it("rejects an impossible locked Space move without mutating the last valid override set", () => {
    const baseline = compile();
    const overrides = nudgeLockedGeometry(baseline, [], "transfer-room", 50, 0);
    const attempted = tryCompileWorkbenchPlan(TS01_LEVEL_SPEC, NUMBERDROID_PROP_REGISTRY, overrides);
    expect(attempted.plan).toBeNull();
    expect(attempted.error).toMatch(/could not be solved|requires .* share a real boundary/i);
  });

  it("materializes a singleton Prop lock relative to its containing Space and round-trips the exact placement", () => {
    const baseline = compile();
    const placement = baseline.actors.props.placements.find((entry) => entry.id === "living-memory")!;
    const overrides = materializePropLock(baseline, [], placement.id);
    const lock = overrides[0];

    expect(lock.targetId).toBe("living-memory");
    expect(lock.lockPlacement).toBe(true);
    expect(lock.lockedPlacement?.rotation).toBe(placement.rotation);

    const locked = compile(overrides);
    const after = locked.actors.props.placements.find((entry) => entry.id === placement.id)!;
    expect(after.rect).toEqual(placement.rect);
    expect(after.rotation).toBe(placement.rotation);
    expect(after.wallSide).toBe(placement.wallSide);
    expect(locked.diagnostics.some((entry) => entry.code === "PROP_PLACEMENT_LOCK_APPLIED" && entry.targetId === "living-memory")).toBe(true);
  });

  it("keeps regeneration local in the declarative override data", () => {
    const overrides = regenerateSemanticTarget([], "living-plant");
    expect(overrides).toEqual([{ targetId: "living-plant", seedSalt: 1 }]);
    expect(regenerateSemanticTarget(overrides, "living-plant")).toEqual([{ targetId: "living-plant", seedSalt: 2 }]);
    expect(JSON.parse(overrideJson(overrides))).toEqual(overrides);
  });
});
