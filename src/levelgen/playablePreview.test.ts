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
import { computePropExactFit } from "./propExactFit";
import {
  COMPILER_PREVIEW_FASCIA_PX,
  artSpriteForPlacement,
  compilerCompositePreviewVisual,
  compilerPlayablePreviewSvg,
} from "./playablePreview";

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

  it("uses ordered composite presentation without changing runtime collision", () => {
    const floor = TS01_GENERATED_FLOOR;
    expect(floor.visual.kind).toBe("composite");
    if (floor.visual.kind !== "composite") return;
    expect(floor.visual.layers.map((layer) => layer.id)).toEqual([
      "ground",
      "floor-fx",
      "architecture",
      "wall-prop-blockouts",
      "wall-props",
      "floor-prop-blockouts",
      "floor-props",
      "transfer-fx",
    ]);
    expect(floor.obstacles.length).toBe(TS01_GENERATED_PLAN.runtimeFloor.obstacles.length);
  });

  it("maps registered production art and keeps unmapped Props as blockouts", () => {
    const visual = compilerCompositePreviewVisual(TS01_GENERATED_PLAN);
    const wallProps = visual.layers.find((layer) => layer.id === "wall-props");
    const floorProps = visual.layers.find((layer) => layer.id === "floor-props");
    const floorFx = visual.layers.find((layer) => layer.id === "floor-fx");
    const fallbackFloor = visual.layers.find((layer) => layer.id === "floor-prop-blockouts");

    expect(wallProps?.kind).toBe("sprites");
    expect(floorProps?.kind).toBe("sprites");
    expect(floorFx?.kind).toBe("sprites");
    expect(fallbackFloor?.kind).toBe("image");
    if (wallProps?.kind !== "sprites" || floorProps?.kind !== "sprites" || floorFx?.kind !== "sprites") return;

    expect(wallProps.sprites.find((sprite) => sprite.id === "living-memory")?.asset).toContain("assets/deck/family-memory-console.png");
    expect(wallProps.sprites.find((sprite) => sprite.id === "living-coffee")?.asset).toContain("assets/deck/family-coffee-machine.png");
    expect(floorProps.sprites.find((sprite) => sprite.id === "living-table")?.asset).toContain("assets/deck/family-table-props.png");
    expect(floorProps.sprites.find((sprite) => sprite.id === "living-plant")?.asset).toContain("assets/deck/family-round-plant.png");
    expect(floorFx.sprites.find((sprite) => sprite.id === "shadow:living-table")?.asset).toContain("assets/deck/family-table-shadow.png");
  });

  it("keeps authored source dimensions while applying Exact Fit correction to rotated art", () => {
    const placement = TS01_GENERATED_PLAN.events.actors.props.placements.find((entry) => entry.id === "living-memory")!;
    const geometry = TS01_GENERATED_PLAN.events.actors.props.navigation.geometry;
    const request = geometry.semantic.props.find((entry) => entry.id === placement.requestId)!;
    const space = geometry.spaces.find((entry) => entry.id === placement.spaceId)!;
    const bounds = TS01_GENERATED_PLAN.events.actors.props.navigation.bounds;
    const physicalCenter = {
      x: placement.rect.x + placement.rect.w / 2,
      y: placement.rect.y + placement.rect.h / 2,
    };
    const rotatedPlacement = {
      ...placement,
      rotation: 90 as const,
      rect: { x: physicalCenter.x - 0.5, y: physicalCenter.y - 1, w: 1, h: 2 },
    };
    const fit = computePropExactFit(
      rotatedPlacement,
      request.metadata,
      space.rect,
      TS01_GENERATED_PLAN.tileSize,
      TS01_GENERATED_PLAN.wallCollisionPx,
      TS01_GENERATED_PLAN.wallVisualPx,
    );
    const sprite = artSpriteForPlacement(TS01_GENERATED_PLAN, rotatedPlacement, "assets/test.png");
    expect(sprite.width).toBe(128);
    expect(sprite.height).toBe(64);
    expect(sprite.rotation).toBe(90);

    const anchorCenterX = (rotatedPlacement.rect.x - bounds.x + rotatedPlacement.rect.w / 2) * TS01_GENERATED_PLAN.tileSize;
    const anchorCenterY = (rotatedPlacement.rect.y - bounds.y + rotatedPlacement.rect.h / 2) * TS01_GENERATED_PLAN.tileSize;
    expect(sprite.x + sprite.width / 2).toBeCloseTo(anchorCenterX + fit.offsetPx.x);
    expect(sprite.y + sprite.height / 2).toBeCloseTo(anchorCenterY + fit.offsetPx.y);
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
