import { describe, expect, it } from "vitest";
import { robotCollisionRadius } from "../game/catalog";
import { getFloor } from "../game/floors";
import { createFloorState, pointWalkable } from "../game/save";
import { advanceFloorScript } from "../game/scriptRuntime";
import {
  TS01_GENERATED_FLOOR,
  TS01_GENERATED_PLAN,
  TS01_GENERATED_PREVIEW_ALIAS,
} from "./generatedTs01Preview";
import { COMPILER_PREVIEW_FASCIA_PX, compilerPlayablePreviewSvg } from "./playablePreview";

describe("Level Compiler playable generated preview", () => {
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

  it("attaches the compiled TS-01 trigger graph to the playable Floor", () => {
    const script = TS01_GENERATED_FLOOR.script;
    expect(script?.triggers.map((trigger) => trigger.id)).toEqual(expect.arrayContaining([
      "collect-primus-access",
      "enter-transfer-intro",
    ]));
    expect(script?.events.map((event) => event.id)).toEqual(expect.arrayContaining([
      "grant-primus-access",
      "unlock-primus-door",
      "play-transfer-intro",
    ]));
  });

  it("executes the real generated PRIMUS access trigger exactly once", () => {
    const floor = TS01_GENERATED_FLOOR;
    const before = createFloorState(floor, 1);
    const candidate = { ...before, collectedPickupIds: ["primus-access-card"] };
    const result = advanceFloorScript(floor, before, candidate);
    expect(result.firedTriggerIds).toContain("collect-primus-access");
    expect(result.state.accessKeyIds).toContain("primus-access");
    expect(result.state.scriptState.doorStates["hall-to-primus"]).toBe("unlocked");
    expect(result.state.scriptState.firedTriggerIds).toContain("collect-primus-access");
  });

  it("opens the real generated Transfer Story Beat when crossing its trigger zone", () => {
    const floor = TS01_GENERATED_FLOOR;
    const trigger = floor.script?.triggers.find((entry) => entry.id === "enter-transfer-intro");
    expect(trigger?.sourceCells.length).toBeGreaterThan(0);
    if (!trigger?.sourceCells.length || !floor.script) return;
    const target = trigger.sourceCells[0];
    const inside = {
      x: (target.x + 0.5) * floor.script.tileSize,
      y: (target.y + 0.5) * floor.script.tileSize,
    };
    const before = createFloorState(floor, 1);
    const candidate = { ...before, ...inside };
    const result = advanceFloorScript(floor, before, candidate);
    expect(result.firedTriggerIds).toContain("enter-transfer-intro");
    expect(result.state.scriptState.activeStoryBeatId).toBe("ts01.transfer-first-view");
  });
});
