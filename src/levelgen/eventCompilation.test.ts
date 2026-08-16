import { describe, expect, it } from "vitest";
import { compileLevelSpec } from "./compiler";
import { compileLevelGeometry } from "./geometry";
import { compileLevelNavigationV031 } from "./navigationHardening";
import { compileOrientedPropPlacement } from "./orientedPlacement";
import { compileActorPlacement } from "./actorPlacement";
import { compileTriggerEvents } from "./eventCompilation";
import { NUMBERDROID_PROP_REGISTRY } from "./propRegistry";
import { TS01_LEVEL_SPEC } from "./specs/ts01";
import type { LevelSpec } from "./types";

function compile(spec: LevelSpec = TS01_LEVEL_SPEC) {
  const semantic = compileLevelSpec(spec, NUMBERDROID_PROP_REGISTRY);
  const geometry = compileLevelGeometry(semantic);
  const navigation = compileLevelNavigationV031(geometry);
  const props = compileOrientedPropPlacement(navigation);
  const actors = compileActorPlacement(props);
  return compileTriggerEvents(actors);
}

function cellKey(cell: { x: number; y: number }) {
  return `${cell.x},${cell.y}`;
}

describe("Level Compiler v0.5 trigger/event compilation", () => {
  it("compiles TS-01 pickup, trigger zone and ordered event programs", () => {
    const plan = compile();
    expect(plan.pickups).toHaveLength(1);
    expect(plan.pickups[0]).toMatchObject({ id: "primus-access-card", keyId: "primus-access", spaceId: "family-living" });

    const zone = plan.zones.find((entry) => entry.id === "transfer-intro-zone");
    expect(zone?.spaceId).toBe("transfer-room");
    expect(zone?.cells.length).toBeGreaterThan(0);
    expect(zone?.center.spaceId).toBe("transfer-room");

    const collect = plan.triggers.find((entry) => entry.id === "collect-primus-access");
    expect(collect).toMatchObject({ kind: "collect", once: true, delayMs: 0 });
    expect(collect?.eventIds).toEqual(["grant-primus-access", "unlock-primus-door"]);
    expect(plan.links.filter((link) => link.triggerId === "collect-primus-access").map((link) => [link.eventId, link.order])).toEqual([
      ["grant-primus-access", 0],
      ["unlock-primus-door", 1],
    ]);
  });

  it("places access pickups only on currently usable furnished cells", () => {
    const plan = compile();
    const pickup = plan.pickups[0];
    const blocked = new Set([
      ...plan.actors.props.occupiedCells.map(cellKey),
      ...plan.actors.props.reservations.map(cellKey),
      ...plan.actors.occupiedActorCells.map(cellKey),
      ...plan.actors.routes.flatMap((route) => route.cells.map(cellKey)),
      ...plan.actors.props.navigation.forbiddenCells
        .filter((cell) => cell.reasons.includes("door-clearance"))
        .map(cellKey),
    ]);
    expect(blocked.has(cellKey(pickup.cell))).toBe(false);
  });

  it("is deterministic across repeated compilation", () => {
    const a = compile();
    const b = compile();
    expect(a.pickups).toEqual(b.pickups);
    expect(a.zones).toEqual(b.zones);
    expect(a.triggers).toEqual(b.triggers);
    expect(a.links).toEqual(b.links);
  });

  it("compiles non-combat staged actor pass-by programs without fake encounter metadata", () => {
    const spec: LevelSpec = {
      ...TS01_LEVEL_SPEC,
      id: "bioark-passby-v05",
      stagedActors: [
        { id: "herd-animal-01", actorType: "bioark-large-herbivore", initiallyPresent: false, tags: ["fauna", "staged"] },
      ],
      routes: [
        ...(TS01_LEVEL_SPEC.routes ?? []),
        { id: "herd-window-pass", kind: "passby", spaceIds: ["main-hall"], loop: false },
      ],
      zones: [
        ...(TS01_LEVEL_SPEC.zones ?? []),
        { id: "herd-view-trigger-zone", spaceId: "main-hall", anchor: { kind: "space-center" }, sizeTiles: { w: 3, h: 3 } },
      ],
      triggers: [
        { id: "show-herd", kind: "enter-zone", sourceId: "herd-view-trigger-zone", eventIds: ["herd-crosses"], once: true },
      ],
      events: [
        { id: "herd-crosses", kind: "actor-passby", actorId: "herd-animal-01", routeId: "herd-window-pass", durationMs: 2600 },
      ],
    };
    const plan = compile(spec);
    expect(plan.stagedActors[0]).toMatchObject({ id: "herd-animal-01", actorType: "bioark-large-herbivore" });
    expect(plan.events[0]).toMatchObject({ kind: "actor-passby", targetIds: ["herd-animal-01", "herd-window-pass"] });
    expect(plan.triggers[0].source).toMatchObject({ kind: "zone", id: "herd-view-trigger-zone" });
  });

  it("warns about a non-once state trigger that writes its own observed flag", () => {
    const spec: LevelSpec = {
      ...TS01_LEVEL_SPEC,
      id: "state-loop-warning",
      triggers: [
        { id: "watch-alert", kind: "state-change", sourceId: "alert", eventIds: ["set-alert"] },
      ],
      events: [
        { id: "set-alert", kind: "set-flag", flag: "alert", value: true },
      ],
    };
    const plan = compile(spec);
    expect(plan.diagnostics.some((entry) => entry.code === "POTENTIAL_STATE_TRIGGER_LOOP" && entry.targetId === "watch-alert")).toBe(true);
  });
});
