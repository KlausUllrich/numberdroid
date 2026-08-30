import type {
  FloorDefinition,
  FloorScriptDefinition,
  FloorScriptEventDefinition,
  FloorScriptRouteDefinition,
  FloorScriptTriggerDefinition,
} from "../game/types";
import type { RuntimeEmissionPlan } from "./emissionTypes";
import type { LevelEventSpec } from "./types";

function runtimeEvent(event: LevelEventSpec): FloorScriptEventDefinition {
  switch (event.kind) {
    case "set-flag": return { id: event.id, kind: event.kind, flag: event.flag, value: event.value };
    case "set-variable": return { id: event.id, kind: event.kind, variableId: event.variableId, value: event.value };
    case "drop-item": return { id: event.id, kind: event.kind, actorId: event.actorId, pickupId: event.pickupId };
    case "show-text": return { id: event.id, kind: event.kind, textRefId: event.textRefId };
    case "grant-key": return { id: event.id, kind: event.kind, keyId: event.keyId };
    case "unlock-door": return { id: event.id, kind: event.kind, doorId: event.doorId };
    case "lock-door": return { id: event.id, kind: event.kind, doorId: event.doorId };
    case "spawn-actor": return { id: event.id, kind: event.kind, actorId: event.actorId, spaceId: event.spaceId };
    case "despawn-actor": return { id: event.id, kind: event.kind, actorId: event.actorId };
    case "move-actor": return { id: event.id, kind: event.kind, actorId: event.actorId, routeId: event.routeId };
    case "actor-passby": return { id: event.id, kind: event.kind, actorId: event.actorId, routeId: event.routeId, durationMs: event.durationMs };
    case "story-beat": return { id: event.id, kind: event.kind, beatId: event.beatId, blocking: event.blocking };
  }
}

export function runtimeScriptFromPlan(plan: RuntimeEmissionPlan): FloorScriptDefinition {
  const bounds = plan.events.actors.props.navigation.bounds;
  const tileSize = plan.tileSize;
  const shiftCell = (cell: { x: number; y: number }) => ({ x: cell.x - bounds.x, y: cell.y - bounds.y });
  const worldPoint = (cell: { x: number; y: number }) => ({
    x: (cell.x - bounds.x + 0.5) * tileSize,
    y: (cell.y - bounds.y + 0.5) * tileSize,
  });

  const triggers: FloorScriptTriggerDefinition[] = plan.events.triggers.map((trigger) => {
    if (trigger.kind === "timer" && trigger.delayMs <= 0) {
      throw new Error(`Runtime timer trigger ${trigger.id} requires delayMs > 0.`);
    }
    return {
      id: trigger.id,
      kind: trigger.kind,
      sourceKind: trigger.source.kind,
      sourceId: trigger.source.id,
      sourceCells: trigger.source.cells.map(shiftCell),
      eventIds: [...trigger.eventIds],
      once: trigger.once,
      delayMs: trigger.delayMs,
      radiusTiles: trigger.radiusTiles,
    };
  });

  const events = plan.events.events.map((entry) => runtimeEvent(entry.event));
  const routes: FloorScriptRouteDefinition[] = plan.events.actors.routes.map((route) => ({
    id: route.id,
    kind: route.kind,
    loop: route.loop,
    points: route.cells.map(worldPoint),
  }));

  return {
    tileSize,
    variables: plan.events.actors.props.navigation.geometry.semantic.variables.map((variable) => ({ ...variable })),
    textReferences: plan.events.actors.props.navigation.geometry.semantic.textReferences.map((reference) => ({ ...reference })),
    triggers,
    events,
    routes,
    stagedActors: plan.events.stagedActors.map((actor) => ({
      id: actor.id,
      actorType: actor.actorType,
      initiallyPresent: Boolean(actor.initiallyPresent),
      defaultSpaceId: actor.defaultSpaceId,
    })),
  };
}

/**
 * v0.8 keeps the physical FloorDefinition produced by the v0.6 Tiled round-trip,
 * then attaches the adjacent typed script contract compiled from the same plan.
 * This avoids a second gameplay map while compiler-only Tiled layers remain the
 * lossless interchange/debug representation.
 */
export function floorWithCompiledScript(plan: RuntimeEmissionPlan, floor: FloorDefinition = plan.runtimeFloor): FloorDefinition {
  return { ...floor, script: runtimeScriptFromPlan(plan) };
}
