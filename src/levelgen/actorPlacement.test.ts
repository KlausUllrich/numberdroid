import { describe, expect, it } from "vitest";
import { compileLevelSpec } from "./compiler";
import { compileLevelGeometry } from "./geometry";
import { compileLevelNavigationV031 } from "./navigationHardening";
import { compileOrientedPropPlacement } from "./orientedPlacement";
import { compileActorPlacement } from "./actorPlacement";
import { NUMBERDROID_PROP_REGISTRY } from "./propRegistry";
import { TS01_LEVEL_SPEC } from "./specs/ts01";

function cellKey(cell: { x: number; y: number }) {
  return `${cell.x},${cell.y}`;
}

function compile() {
  const semantic = compileLevelSpec(TS01_LEVEL_SPEC, NUMBERDROID_PROP_REGISTRY);
  const geometry = compileLevelGeometry(semantic);
  const navigation = compileLevelNavigationV031(geometry);
  const props = compileOrientedPropPlacement(navigation);
  return compileActorPlacement(props);
}

function distanceToWall(cell: { x: number; y: number }, rect: { x: number; y: number; w: number; h: number }) {
  return Math.min(
    cell.x - rect.x,
    rect.x + rect.w - 1 - cell.x,
    cell.y - rect.y,
    rect.y + rect.h - 1 - cell.y,
  );
}

describe("Level Compiler v0.13.2 actor placement", () => {
  it("places the authored TS-01 actors inside PRIMUS", () => {
    const plan = compile();
    expect(plan.actors.map((actor) => actor.id).sort()).toEqual(["primus-magnetar-742", "primus-sentry-4"]);
    expect(plan.actors.every((actor) => actor.spaceId === "primus-allocation")).toBe(true);
  });

  it("never places actors on props, prop use-space or widened door clearance", () => {
    const plan = compile();
    const propCells = new Set(plan.props.occupiedCells.map(cellKey));
    const reserved = new Set(plan.props.reservations.map(cellKey));
    const doorClearance = new Set(
      plan.props.navigation.forbiddenCells
        .filter((cell) => cell.reasons.includes("door-clearance"))
        .map(cellKey),
    );
    for (const actor of plan.actors) {
      expect(propCells.has(cellKey(actor.cell))).toBe(false);
      expect(reserved.has(cellKey(actor.cell))).toBe(false);
      expect(doorClearance.has(cellKey(actor.cell))).toBe(false);
    }
  });

  it("compiles the PRIMUS patrol through actual remaining free cells and puts the patrol actor on it", () => {
    const plan = compile();
    const route = plan.routes.find((entry) => entry.id === "primus-sentry-patrol");
    const sentry = plan.actors.find((entry) => entry.id === "primus-sentry-4");
    expect(route).toBeTruthy();
    expect(route?.loop).toBe(true);
    expect(route?.cells.length).toBeGreaterThan(4);
    expect(route?.cells.every((cell) => cell.spaceId === "primus-allocation")).toBe(true);
    expect(route?.cells.some((cell) => cellKey(cell) === cellKey(sentry!.cell))).toBe(true);

    const blocked = new Set([
      ...plan.props.occupiedCells.map(cellKey),
      ...plan.props.reservations.map(cellKey),
      ...plan.props.navigation.forbiddenCells.filter((cell) => cell.reasons.includes("door-clearance")).map(cellKey),
    ]);
    expect(route?.cells.some((cell) => blocked.has(cellKey(cell)))).toBe(false);
    for (let index = 1; index < (route?.cells.length ?? 0); index += 1) {
      const a = route!.cells[index - 1];
      const b = route!.cells[index];
      expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBeLessThanOrEqual(1);
    }
  });

  it("keeps the large single-room PRIMUS patrol one full tile away from the room edge", () => {
    const plan = compile();
    const route = plan.routes.find((entry) => entry.id === "primus-sentry-patrol")!;
    const primus = plan.props.navigation.geometry.spaces.find((entry) => entry.id === "primus-allocation")!;
    expect(route.cells.length).toBeGreaterThan(4);
    expect(route.cells.every((cell) => distanceToWall(cell, primus.rect) >= 1)).toBe(true);

    const sentry = plan.actors.find((entry) => entry.id === "primus-sentry-4")!;
    expect(distanceToWall(sentry.cell, primus.rect)).toBeGreaterThanOrEqual(1);
  });

  it("keeps the neutral worker out of the reserved patrol route", () => {
    const plan = compile();
    const route = plan.routes.find((entry) => entry.id === "primus-sentry-patrol")!;
    const routeCells = new Set(route.cells.map(cellKey));
    const worker = plan.actors.find((entry) => entry.id === "primus-magnetar-742")!;
    expect(routeCells.has(cellKey(worker.cell))).toBe(false);
  });

  it("is deterministic for the same LevelSpec seed", () => {
    const a = compile();
    const b = compile();
    expect(a.actors.map((actor) => [actor.id, actor.cell.x, actor.cell.y, actor.facing])).toEqual(
      b.actors.map((actor) => [actor.id, actor.cell.x, actor.cell.y, actor.facing]),
    );
    expect(a.routes.map((route) => route.cells.map(cellKey))).toEqual(b.routes.map((route) => route.cells.map(cellKey)));
  });
});
