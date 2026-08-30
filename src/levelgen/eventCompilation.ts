import { deriveSubSeed, seededUnit } from "./seed";
import type {
  LevelEventSpec,
  TriggerSpec,
  TriggerZoneSpec,
} from "./types";
import type { GridCell, NavigationCell } from "./navigationTypes";
import type { ActorPlacementPlan, ActorRouteGeometry } from "./actorPlacementTypes";
import type {
  CompiledEventDecision,
  CompiledTriggerProgram,
  EventCompilationPlan,
  PickupPlacementDecision,
  ResolvedTriggerSource,
  TriggerEventLink,
  TriggerZoneGeometry,
} from "./eventCompilationTypes";

function cellKey(cell: GridCell) {
  return `${cell.x},${cell.y}`;
}

function manhattan(a: GridCell, b: GridCell) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function nearestCell(cells: NavigationCell[], target: GridCell) {
  return [...cells].sort((a, b) => manhattan(a, target) - manhattan(b, target) || a.y - b.y || a.x - b.x)[0];
}

function propOccupiedKeys(plan: ActorPlacementPlan) {
  return new Set(plan.props.occupiedCells.map(cellKey));
}

function pickupBlockedKeys(plan: ActorPlacementPlan) {
  const blocked = propOccupiedKeys(plan);
  for (const reservation of plan.props.reservations) blocked.add(cellKey(reservation));
  for (const actor of plan.actors) blocked.add(cellKey(actor.cell));
  for (const route of plan.routes) for (const cell of route.cells) blocked.add(cellKey(cell));
  for (const forbidden of plan.props.navigation.forbiddenCells) {
    if (forbidden.reasons.includes("door-clearance")) blocked.add(cellKey(forbidden));
  }
  return blocked;
}

function placePickups(plan: ActorPlacementPlan): PickupPlacementDecision[] {
  const semantic = plan.props.navigation.geometry.semantic;
  const navigation = plan.props.navigation;
  const blocked = pickupBlockedKeys(plan);
  const placed = new Set<string>();
  const primary = new Set(navigation.primaryPathCells.map(cellKey));
  const spaceById = new Map(navigation.geometry.spaces.map((space) => [space.id, space]));
  const result: PickupPlacementDecision[] = [];

  for (const pickup of semantic.pickups) {
    const space = spaceById.get(pickup.spaceId);
    if (!space) throw new Error(`Pickup ${pickup.id} cannot resolve geometry space ${pickup.spaceId}.`);
    const center = {
      x: space.rect.x + Math.floor((space.rect.w - 1) / 2),
      y: space.rect.y + Math.floor((space.rect.h - 1) / 2),
    };
    const candidates = navigation.walkableCells
      .filter((cell) => cell.spaceId === pickup.spaceId && !blocked.has(cellKey(cell)) && !placed.has(cellKey(cell)))
      .map((cell) => {
        const reasons: string[] = [];
        let score = Math.max(0, 35 - manhattan(cell, center) * 5);
        if (score) reasons.push("visible room position");
        if (primary.has(cellKey(cell))) {
          score += 32;
          reasons.push("on primary circulation");
        }
        score += seededUnit(deriveSubSeed(semantic.seed, `pickup/${pickup.id}/${cell.x},${cell.y}`)) * 0.01;
        return { cell, score, reasons };
      })
      .sort((a, b) => b.score - a.score || a.cell.y - b.cell.y || a.cell.x - b.cell.x);

    const chosen = candidates[0];
    if (!chosen) throw new Error(`Pickup ${pickup.id} has no valid free placement in ${pickup.spaceId}.`);
    placed.add(cellKey(chosen.cell));
    result.push({
      id: pickup.id,
      keyId: pickup.keyId,
      spaceId: pickup.spaceId,
      cell: chosen.cell,
      label: pickup.label,
      initiallyPresent: pickup.initiallyPresent ?? true,
      score: chosen.score,
      reasons: chosen.reasons.length ? chosen.reasons : ["best deterministic free cell"],
      candidateCount: candidates.length,
    });
  }
  return result;
}

function routeAnchor(route: ActorRouteGeometry, position: "start" | "middle" | "end" | undefined, spaceId: string) {
  const cells = route.cells.filter((cell) => cell.spaceId === spaceId);
  if (!cells.length) throw new Error(`Trigger zone route anchor ${route.id} does not cross ${spaceId}.`);
  if (position === "end") return cells[cells.length - 1];
  if (position === "middle") return cells[Math.floor((cells.length - 1) / 2)];
  return cells[0];
}

function resolveZoneAnchor(
  zone: TriggerZoneSpec,
  plan: ActorPlacementPlan,
  pickups: PickupPlacementDecision[],
): GridCell {
  const navigation = plan.props.navigation;
  const space = navigation.geometry.spaces.find((entry) => entry.id === zone.spaceId);
  if (!space) throw new Error(`Trigger zone ${zone.id} cannot resolve geometry space ${zone.spaceId}.`);

  const anchor = zone.anchor;
  if (anchor.kind === "space-center") {
    return {
      x: space.rect.x + Math.floor((space.rect.w - 1) / 2),
      y: space.rect.y + Math.floor((space.rect.h - 1) / 2),
    };
  }

  if (anchor.kind === "connection") {
    const portal = navigation.portals.find((entry) => entry.connectionId === anchor.targetId);
    if (!portal) throw new Error(`Trigger zone ${zone.id} cannot resolve connection portal ${anchor.targetId}.`);
    const candidates = [portal.centerPair.from, portal.centerPair.to].filter((cell) => cell.spaceId === zone.spaceId);
    if (!candidates.length) throw new Error(`Trigger zone ${zone.id} connection ${anchor.targetId} does not touch ${zone.spaceId}.`);
    return candidates[0];
  }

  if (anchor.kind === "prop") {
    const placement = plan.props.placements.find((entry) => entry.id === anchor.targetId || entry.requestId === anchor.targetId);
    if (!placement) throw new Error(`Trigger zone ${zone.id} cannot resolve placed prop ${anchor.targetId}.`);
    if (placement.spaceId !== zone.spaceId) throw new Error(`Trigger zone ${zone.id} prop ${anchor.targetId} is not inside ${zone.spaceId}.`);
    return {
      x: placement.rect.x + Math.floor((placement.rect.w - 1) / 2),
      y: placement.rect.y + Math.floor((placement.rect.h - 1) / 2),
    };
  }

  if (anchor.kind === "actor") {
    const actor = plan.actors.find((entry) => entry.id === anchor.targetId);
    if (!actor) throw new Error(`Trigger zone ${zone.id} actor ${anchor.targetId} has no compiled home position.`);
    if (actor.spaceId !== zone.spaceId) throw new Error(`Trigger zone ${zone.id} actor ${anchor.targetId} is not inside ${zone.spaceId}.`);
    return actor.cell;
  }

  if (anchor.kind === "route") {
    const route = plan.routes.find((entry) => entry.id === anchor.targetId);
    if (!route) throw new Error(`Trigger zone ${zone.id} cannot resolve route ${anchor.targetId}.`);
    return routeAnchor(route, anchor.position, zone.spaceId);
  }

  const pickup = pickups.find((entry) => entry.id === anchor.targetId);
  if (!pickup) throw new Error(`Trigger zone ${zone.id} cannot resolve pickup ${anchor.targetId}.`);
  if (pickup.spaceId !== zone.spaceId) throw new Error(`Trigger zone ${zone.id} pickup ${anchor.targetId} is not inside ${zone.spaceId}.`);
  return pickup.cell;
}

function compileZones(plan: ActorPlacementPlan, pickups: PickupPlacementDecision[]): TriggerZoneGeometry[] {
  const semantic = plan.props.navigation.geometry.semantic;
  const navigation = plan.props.navigation;
  const occupied = propOccupiedKeys(plan);

  return semantic.zones.map((zone) => {
    const anchor = resolveZoneAnchor(zone, plan, pickups);
    const size = zone.sizeTiles ?? { w: 3, h: 3 };
    const x = anchor.x - Math.floor((size.w - 1) / 2);
    const y = anchor.y - Math.floor((size.h - 1) / 2);
    const cells = navigation.walkableCells.filter((cell) =>
      cell.spaceId === zone.spaceId
      && !occupied.has(cellKey(cell))
      && cell.x >= x && cell.x < x + size.w
      && cell.y >= y && cell.y < y + size.h,
    );
    if (!cells.length) throw new Error(`Trigger zone ${zone.id} resolves to no player-usable cells in ${zone.spaceId}.`);
    const center = nearestCell(cells, anchor);
    return {
      id: zone.id,
      spaceId: zone.spaceId,
      cells,
      center,
      anchorKind: zone.anchor.kind,
      anchorTargetId: "targetId" in zone.anchor ? zone.anchor.targetId : undefined,
      tags: [...(zone.tags ?? [])],
    };
  });
}

function spaceSource(plan: ActorPlacementPlan, spaceId: string): ResolvedTriggerSource {
  const navigation = plan.props.navigation;
  const cells = navigation.walkableCells.filter((cell) => cell.spaceId === spaceId);
  const space = navigation.geometry.spaces.find((entry) => entry.id === spaceId);
  if (!space || !cells.length) throw new Error(`Trigger source space ${spaceId} has no compiled cells.`);
  const point = nearestCell(cells, {
    x: space.rect.x + Math.floor((space.rect.w - 1) / 2),
    y: space.rect.y + Math.floor((space.rect.h - 1) / 2),
  });
  return { kind: "space", id: spaceId, spaceId, point, cells, resolvedIds: [spaceId] };
}

function resolveEntitySource(
  sourceId: string,
  plan: ActorPlacementPlan,
  pickups: PickupPlacementDecision[],
  zones: TriggerZoneGeometry[],
): ResolvedTriggerSource {
  const zone = zones.find((entry) => entry.id === sourceId);
  if (zone) return { kind: "zone", id: zone.id, spaceId: zone.spaceId, point: zone.center, cells: zone.cells, resolvedIds: [zone.id] };

  const pickup = pickups.find((entry) => entry.id === sourceId);
  if (pickup) return { kind: "pickup", id: pickup.id, spaceId: pickup.spaceId, point: pickup.cell, cells: [pickup.cell], resolvedIds: [pickup.id] };

  const propMatches = plan.props.placements.filter((entry) => entry.id === sourceId || entry.requestId === sourceId);
  if (propMatches.length) {
    const cells = propMatches.flatMap((entry) => entry.approachCells.length ? entry.approachCells : entry.footprintCells);
    const point = cells[0] ?? propMatches[0].footprintCells[0];
    return {
      kind: "prop",
      id: sourceId,
      spaceId: propMatches[0].spaceId,
      point,
      cells,
      resolvedIds: propMatches.map((entry) => entry.id),
    };
  }

  const actor = plan.actors.find((entry) => entry.id === sourceId);
  if (actor) return { kind: "actor", id: actor.id, spaceId: actor.spaceId, point: actor.cell, cells: [actor.cell], resolvedIds: [actor.id] };

  const staged = plan.props.navigation.geometry.semantic.stagedActors.find((entry) => entry.id === sourceId);
  if (staged) return { kind: "actor", id: staged.id, spaceId: staged.defaultSpaceId, cells: [], resolvedIds: [staged.id] };

  const route = plan.routes.find((entry) => entry.id === sourceId);
  if (route) {
    const point = route.cells[Math.floor((route.cells.length - 1) / 2)];
    return { kind: "route", id: route.id, spaceId: point?.spaceId, point, cells: route.cells, resolvedIds: [route.id] };
  }

  const portal = plan.props.navigation.portals.find((entry) => entry.connectionId === sourceId);
  if (portal) {
    const point = portal.centerPair.from;
    const cells = portal.pairs.flatMap((pair) => [pair.from, pair.to]);
    return { kind: "connection", id: sourceId, spaceId: point.spaceId, point, cells, resolvedIds: [sourceId] };
  }

  if (plan.props.navigation.geometry.spaces.some((entry) => entry.id === sourceId)) return spaceSource(plan, sourceId);
  throw new Error(`Cannot resolve trigger source ${sourceId} after actor placement.`);
}

function expandProximitySource(source: ResolvedTriggerSource, radius: number, plan: ActorPlacementPlan): ResolvedTriggerSource {
  if (!source.point || !source.spaceId) return source;
  const cells = plan.props.navigation.walkableCells.filter((cell) =>
    cell.spaceId === source.spaceId
    && Math.abs(cell.x - source.point!.x) <= radius
    && Math.abs(cell.y - source.point!.y) <= radius,
  );
  return { ...source, cells };
}

function compileTrigger(
  trigger: TriggerSpec,
  plan: ActorPlacementPlan,
  pickups: PickupPlacementDecision[],
  zones: TriggerZoneGeometry[],
): CompiledTriggerProgram {
  let source: ResolvedTriggerSource;
  if (trigger.kind === "enter-space") {
    source = spaceSource(plan, trigger.sourceId);
  } else if (trigger.kind === "enter-zone") {
    const zone = zones.find((entry) => entry.id === trigger.sourceId);
    if (!zone) throw new Error(`Trigger ${trigger.id} cannot resolve zone ${trigger.sourceId}.`);
    source = { kind: "zone", id: zone.id, spaceId: zone.spaceId, point: zone.center, cells: zone.cells, resolvedIds: [zone.id] };
  } else if (trigger.kind === "collect") {
    const pickup = pickups.find((entry) => entry.id === trigger.sourceId);
    if (!pickup) throw new Error(`Trigger ${trigger.id} cannot resolve pickup ${trigger.sourceId}.`);
    source = { kind: "pickup", id: pickup.id, spaceId: pickup.spaceId, point: pickup.cell, cells: [pickup.cell], resolvedIds: [pickup.id] };
  } else if (trigger.kind === "state-change") {
    const sourceKind = plan.props.navigation.geometry.semantic.variables.some((entry) => entry.id === trigger.sourceId)
      ? "variable"
      : "flag";
    source = { kind: sourceKind, id: trigger.sourceId, cells: [], resolvedIds: [trigger.sourceId] };
  } else if (trigger.kind === "timer") {
    source = { kind: "timer", id: trigger.sourceId, cells: [], resolvedIds: [trigger.sourceId] };
  } else {
    source = resolveEntitySource(trigger.sourceId, plan, pickups, zones);
    if (trigger.kind === "proximity") source = expandProximitySource(source, trigger.radiusTiles ?? 2, plan);
  }

  return {
    id: trigger.id,
    kind: trigger.kind,
    source,
    eventIds: [...trigger.eventIds],
    once: trigger.once ?? false,
    delayMs: trigger.delayMs ?? 0,
    radiusTiles: trigger.kind === "proximity" ? trigger.radiusTiles ?? 2 : undefined,
  };
}

function eventTargets(event: LevelEventSpec): string[] {
  if (event.kind === "set-flag") return [`flag:${event.flag}`];
  if (event.kind === "set-variable") return [`variable:${event.variableId}`];
  if (event.kind === "drop-item") return [event.actorId, event.pickupId];
  if (event.kind === "show-text") return [`text:${event.textRefId}`];
  if (event.kind === "grant-key") return [`key:${event.keyId}`];
  if (event.kind === "unlock-door" || event.kind === "lock-door") return [event.doorId];
  if (event.kind === "spawn-actor") return [event.actorId, event.spaceId];
  if (event.kind === "despawn-actor") return [event.actorId];
  if (event.kind === "move-actor" || event.kind === "actor-passby") return [event.actorId, event.routeId];
  return [`beat:${event.beatId}`];
}

function compileEvents(events: LevelEventSpec[]): CompiledEventDecision[] {
  return events.map((event) => ({ id: event.id, kind: event.kind, event, targetIds: eventTargets(event) }));
}

function compileLinks(triggers: CompiledTriggerProgram[]): TriggerEventLink[] {
  return triggers.flatMap((trigger) => trigger.eventIds.map((eventId, order) => ({
    id: `${trigger.id}->${eventId}:${order}`,
    triggerId: trigger.id,
    eventId,
    order,
  })));
}

export function compileTriggerEvents(actors: ActorPlacementPlan): EventCompilationPlan {
  const semantic = actors.props.navigation.geometry.semantic;
  const pickups = placePickups(actors);
  const zones = compileZones(actors, pickups);
  const triggers = semantic.triggers.map((trigger) => compileTrigger(trigger, actors, pickups, zones));
  const events = compileEvents(semantic.events);
  const links = compileLinks(triggers);
  const diagnostics = [...actors.diagnostics];

  const linkedEventIds = new Set(links.map((link) => link.eventId));
  for (const event of events) {
    if (!linkedEventIds.has(event.id)) {
      diagnostics.push({
        level: "warning",
        code: "UNREFERENCED_LEVEL_EVENT",
        targetId: event.id,
        message: `Event ${event.id} is compiled but no LevelSpec trigger currently invokes it.`,
      });
    }
  }

  for (const trigger of triggers) {
    if (trigger.kind !== "state-change" || trigger.once) continue;
    const loops = trigger.eventIds
      .map((id) => semantic.events.find((event) => event.id === id))
      .filter((event) => (event?.kind === "set-flag" && event.flag === trigger.source.id)
        || (event?.kind === "set-variable" && event.variableId === trigger.source.id));
    if (loops.length) {
      diagnostics.push({
        level: "warning",
        code: "POTENTIAL_STATE_TRIGGER_LOOP",
        targetId: trigger.id,
        message: `State trigger ${trigger.id} writes its own observed state ${trigger.source.id}; make it once-only or ensure runtime edge semantics prevent a loop.`,
      });
    }
  }

  diagnostics.push({
    level: "info",
    code: "TRIGGER_EVENT_COMPILATION_COMPLETE",
    message: `Compiled ${pickups.length} pickup source(s), ${zones.length} trigger zone(s), ${triggers.length} trigger program(s) and ${events.length} event(s).`,
  });

  return {
    actors,
    pickups,
    zones,
    stagedActors: [...semantic.stagedActors],
    triggers,
    events,
    links,
    diagnostics,
  };
}
