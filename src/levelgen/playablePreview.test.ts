import { describe, expect, it } from "vitest";
import { robotCollisionRadius } from "../game/catalog";
import { getFloor } from "../game/floors";
import { pointWalkable } from "../game/save";
import {
  TS01_GENERATED_FLOOR,
  TS01_GENERATED_PLAN,
  TS01_GENERATED_PREVIEW_ALIAS,
} from "./generatedTs01Preview";
import { COMPILER_PREVIEW_FASCIA_PX, compilerPlayablePreviewSvg } from "./playablePreview";

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

  it("renders the complete compiler QA world as one static image while preserving runtime collision", () => {
    const floor = TS01_GENERATED_FLOOR;
    expect(floor.visual.kind).toBe("image");
    if (floor.visual.kind !== "image") return;
    expect(floor.visual.asset.startsWith("data:image/svg+xml")).toBe(true);
    expect(floor.obstacles.length).toBe(TS01_GENERATED_PLAN.runtimeFloor.obstacles.length);
  });

  it("uses the accepted visible wall fascia and emits each canonical wall only once", () => {
    expect(COMPILER_PREVIEW_FASCIA_PX).toBe(30);
    const svg = compilerPlayablePreviewSvg(TS01_GENERATED_PLAN);
    for (const wall of TS01_GENERATED_PLAN.events.actors.props.navigation.geometry.walls) {
      expect(svg.split(`data-wall-id=\"${wall.id}\"`).length - 1).toBe(1);
    }
  });
});
