import { describe, expect, it } from "vitest";
import { robotCollisionRadius } from "../game/catalog";
import { getFloor } from "../game/floors";
import { pointWalkable } from "../game/save";
import {
  TS01_GENERATED_FLOOR,
  TS01_GENERATED_PLAN,
  TS01_GENERATED_PREVIEW_ALIAS,
} from "./generatedTs01Preview";

describe("Level Compiler v0.7 playable generated preview", () => {
  it("registers the compiler floor under both its canonical id and friendly preview alias", () => {
    expect(getFloor(TS01_GENERATED_FLOOR.id)).toBe(TS01_GENERATED_FLOOR);
    expect(getFloor(TS01_GENERATED_PREVIEW_ALIAS)).toBe(TS01_GENERATED_FLOOR);
    expect(TS01_GENERATED_FLOOR.name).toBe("TS-01 · GENERATED");
  });

  it("starts PICO on a genuinely walkable generated position", () => {
    const floor = TS01_GENERATED_FLOOR;
    expect(pointWalkable(floor.start.x, floor.start.y, floor.id, robotCollisionRadius("standard"))).toBe(true);
  });

  it("keeps the generated PRIMUS access loop in the existing runtime contract", () => {
    const door = TS01_GENERATED_FLOOR.doors.find((entry) => entry.id === "hall-to-primus");
    const pickup = TS01_GENERATED_FLOOR.pickups.find((entry) => entry.id === "primus-access-card");
    expect(door).toMatchObject({ mode: "locked", keyId: "primus-access" });
    expect(pickup).toMatchObject({ keyId: "primus-access", label: "PRIMUS ACCESS" });
  });

  it("leaves real door apertures walkable before DoorLayer collision is applied", () => {
    const floor = TS01_GENERATED_FLOOR;
    for (const door of floor.doors) {
      const x = door.x + door.w / 2;
      const y = door.y + door.h / 2;
      expect(pointWalkable(x, y, floor.id, robotCollisionRadius("standard"))).toBe(true);
    }
  });

  it("round-trips generated encounter behavior and patrol geometry into MetaGame-compatible data", () => {
    const sentry = TS01_GENERATED_FLOOR.encounters.find((entry) => entry.encounterId === "primus-sentry-4");
    const magnetar = TS01_GENERATED_FLOOR.encounters.find((entry) => entry.encounterId === "primus-magnetar-742");
    expect(sentry?.behavior?.kind).toBe("patrol");
    expect(sentry?.behavior?.patrolPath.length).toBeGreaterThan(1);
    expect(magnetar?.behavior?.kind).toBe("neutral");
  });

  it("adds presentation-only visible wall and prop overlays without mutating compiler collision output", () => {
    const floor = TS01_GENERATED_FLOOR;
    expect(floor.visual.kind).toBe("tilemap");
    if (floor.visual.kind !== "tilemap") return;
    expect(floor.visual.layers.map((layer) => layer.name)).toEqual(expect.arrayContaining([
      "Ground",
      "CompilerPreviewWalls",
      "CompilerPreviewProps",
    ]));
    expect(floor.visual.tilesets.some((tileset) => tileset.firstGid === 1000)).toBe(true);
    expect(floor.obstacles.length).toBe(TS01_GENERATED_PLAN.runtimeFloor.obstacles.length);
  });
});
