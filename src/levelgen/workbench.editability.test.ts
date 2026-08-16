import { describe, expect, it } from "vitest";
import { NUMBERDROID_PROP_REGISTRY } from "./propRegistry";
import { TS01_LEVEL_SPEC } from "./specs/ts01";
import {
  compileWorkbenchPlan,
  nudgeLockedGeometry,
  nudgeLockedProp,
  resizeLockedGeometry,
  tryCompileWorkbenchPlan,
} from "./workbench";

function valid(overrides: ReturnType<typeof nudgeLockedGeometry>) {
  return Boolean(tryCompileWorkbenchPlan(TS01_LEVEL_SPEC, NUMBERDROID_PROP_REGISTRY, overrides).plan);
}

describe("TS-01 Workbench editability matrix", () => {
  it("keeps at least one direct edit available on representative editable content", () => {
    const baseline = compileWorkbenchPlan(TS01_LEVEL_SPEC, NUMBERDROID_PROP_REGISTRY, TS01_LEVEL_SPEC.overrides ?? []);
    const matrix: Record<string, Record<string, boolean>> = {};

    for (const space of baseline.actors.props.navigation.geometry.spaces) {
      matrix[`space:${space.id}`] = {
        left: valid(nudgeLockedGeometry(baseline, [], space.id, -1, 0)),
        right: valid(nudgeLockedGeometry(baseline, [], space.id, 1, 0)),
        up: valid(nudgeLockedGeometry(baseline, [], space.id, 0, -1)),
        down: valid(nudgeLockedGeometry(baseline, [], space.id, 0, 1)),
        narrower: valid(resizeLockedGeometry(baseline, [], space.id, -1, 0)),
        wider: valid(resizeLockedGeometry(baseline, [], space.id, 1, 0)),
        shorter: valid(resizeLockedGeometry(baseline, [], space.id, 0, -1)),
        taller: valid(resizeLockedGeometry(baseline, [], space.id, 0, 1)),
      };
    }

    const requests = new Map(baseline.actors.props.navigation.geometry.semantic.props.map((entry) => [entry.id, entry]));
    for (const placement of baseline.actors.props.placements) {
      const request = requests.get(placement.requestId)!;
      if (request.quantity !== 1) continue;
      matrix[`prop:${placement.id}`] = {
        left: valid(nudgeLockedProp(baseline, [], placement.id, -1, 0)),
        right: valid(nudgeLockedProp(baseline, [], placement.id, 1, 0)),
        up: valid(nudgeLockedProp(baseline, [], placement.id, 0, -1)),
        down: valid(nudgeLockedProp(baseline, [], placement.id, 0, 1)),
      };
    }

    console.log(`WORKBENCH_EDITABILITY ${JSON.stringify(matrix)}`);

    expect(Object.values(matrix["space:transfer-room"]).some(Boolean)).toBe(true);
    expect(Object.values(matrix["prop:living-table"]).some(Boolean)).toBe(true);
  });
});
