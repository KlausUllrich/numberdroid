import { describe, expect, it } from "vitest";
import { lineOfSightClear, robotCanSeePoint, withinViewCone } from "./perception";
import type { EncounterBehavior, FloorDefinition } from "./types";

const baseFloor: FloorDefinition = {
  id: "test-floor",
  name: "TEST",
  subtitle: "",
  width: 400,
  height: 200,
  visual: { kind: "image", asset: "test.png" },
  start: { x: 40, y: 100, facing: 90, bodyId: "pico", metaEnergy: 0 },
  objectives: { default: "", afterEnergy: "" },
  walkable: [{ x: 0, y: 0, w: 400, h: 200 }],
  obstacles: [],
  rooms: [],
  doors: [],
  pickups: [],
  actions: [],
  energyStations: [],
  encounters: [],
};

const guardBehavior: EncounterBehavior = {
  kind: "guard",
  interceptRadius: 72,
  detectionRadius: 260,
  loseRadius: 430,
  patrolSpeed: 24,
  chaseSpeed: 150,
  chaseAcceleration: 150,
  forcedEngagement: false,
  patrolPath: [],
  viewAngle: 120,
  searchDurationMs: 900,
};

describe("line of sight", () => {
  it("sees across continuous open walkable space", () => {
    expect(lineOfSightClear(baseFloor, new Set(), { x: 100, y: 100 }, { x: 300, y: 100 })).toBe(true);
  });

  it("is blocked by authored opaque obstacles", () => {
    const floor = { ...baseFloor, obstacles: [{ x: 185, y: 60, w: 30, h: 80 }] };
    expect(lineOfSightClear(floor, new Set(), { x: 100, y: 100 }, { x: 300, y: 100 })).toBe(false);
  });

  it("is blocked by a closed door and restored by the same open door", () => {
    const floor: FloorDefinition = {
      ...baseFloor,
      doors: [{
        id: "test-door",
        x: 190,
        y: 60,
        w: 20,
        h: 80,
        orientation: "vertical",
        mode: "auto",
        size: "standard",
        openRadius: 118,
      }],
    };
    expect(lineOfSightClear(floor, new Set(), { x: 100, y: 100 }, { x: 300, y: 100 })).toBe(false);
    expect(lineOfSightClear(floor, new Set(["test-door"]), { x: 100, y: 100 }, { x: 300, y: 100 })).toBe(true);
  });

  it("does not see diagonally through non-walkable wall space", () => {
    const floor = {
      ...baseFloor,
      walkable: [
        { x: 0, y: 0, w: 170, h: 200 },
        { x: 230, y: 0, w: 170, h: 200 },
      ],
    };
    expect(lineOfSightClear(floor, new Set(), { x: 100, y: 100 }, { x: 300, y: 100 })).toBe(false);
  });
});

describe("view cone", () => {
  it("uses the same facing convention as the robot runtime", () => {
    expect(withinViewCone({ x: 100, y: 100 }, 90, { x: 200, y: 100 }, 120)).toBe(true);
    expect(withinViewCone({ x: 100, y: 100 }, 270, { x: 200, y: 100 }, 120)).toBe(false);
  });

  it("requires range, field of view and clear geometry together", () => {
    expect(robotCanSeePoint(baseFloor, new Set(), { x: 100, y: 100 }, 90, { x: 300, y: 100 }, guardBehavior)).toBe(true);
    expect(robotCanSeePoint(baseFloor, new Set(), { x: 100, y: 100 }, 270, { x: 300, y: 100 }, guardBehavior)).toBe(false);
    expect(robotCanSeePoint(baseFloor, new Set(), { x: 100, y: 100 }, 90, { x: 390, y: 100 }, guardBehavior)).toBe(false);
  });
});
