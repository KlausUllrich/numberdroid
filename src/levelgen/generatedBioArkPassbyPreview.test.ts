import { describe, expect, it } from "vitest";
import { getFloor } from "../game/floors";
import {
  BIOARK_PASSBY_GENERATED_FLOOR,
  BIOARK_PASSBY_GENERATED_PLAN,
  BIOARK_PASSBY_PREVIEW_ALIAS,
} from "./generatedBioArkPassbyPreview";

describe("Bio-Ark staged actor pass-by proof", () => {
  it("registers a separate playable compiler proof floor", () => {
    expect(getFloor(BIOARK_PASSBY_PREVIEW_ALIAS)).toBe(BIOARK_PASSBY_GENERATED_FLOOR);
    expect(BIOARK_PASSBY_GENERATED_FLOOR.name).toBe("BIO-ARK · PASS-BY PROOF");
  });

  it("carries one compiled non-combat actor and pass-by route into the runtime script contract", () => {
    const script = BIOARK_PASSBY_GENERATED_FLOOR.script;
    expect(script?.stagedActors).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "bioark-grazer-01", actorType: "bioark-grazer", initiallyPresent: false }),
    ]));
    expect(script?.routes.find((route) => route.id === "grazer-pass-route")?.points.length).toBeGreaterThan(1);
    expect(script?.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "run-grazer-passby",
        kind: "actor-passby",
        actorId: "bioark-grazer-01",
        routeId: "grazer-pass-route",
        durationMs: 5200,
      }),
    ]));
  });

  it("starts outside the view trigger so the authored enter-zone edge is testable by driving", () => {
    const floor = BIOARK_PASSBY_GENERATED_FLOOR;
    const trigger = floor.script?.triggers.find((entry) => entry.id === "enter-grazer-view");
    const tileSize = floor.script?.tileSize ?? 64;
    const startCell = { x: Math.floor(floor.start.x / tileSize), y: Math.floor(floor.start.y / tileSize) };
    expect(trigger?.sourceCells.some((cell) => cell.x === startCell.x && cell.y === startCell.y)).toBe(false);
  });

  it("keeps the proof entirely compiler-generated", () => {
    expect(BIOARK_PASSBY_GENERATED_PLAN.runtimeFloor.id).toBe("bioark-passby-proof");
    expect(BIOARK_PASSBY_GENERATED_PLAN.events.stagedActors.map((actor) => actor.id)).toContain("bioark-grazer-01");
  });
});
