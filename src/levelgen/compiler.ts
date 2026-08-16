import { deriveSubSeed, normalizeLevelSeed } from "./seed";
import type {
  CompiledConnection,
  CompiledEncounterIntent,
  CompiledPropRequest,
  CompileDiagnostic,
  ConnectionSpec,
  LevelEventSpec,
  LevelSpaceSpec,
  LevelSpec,
  PropRegistry,
  SemanticCompilePlan,
  TileRange,
  TriggerSpec,
} from "./types";

function assertId(id: string, context: string) {
  if (!id.trim()) throw new Error(`${context} requires a non-empty id.`);
}

function validateRange(range: TileRange, context: string) {
  if (![range.min, range.preferred, range.max].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error(`${context} requires positive finite min/preferred/max values.`);
  }
  if (range.min > range.preferred || range.preferred > range.max) {
    throw new Error(`${context} must satisfy min <= preferred <= max.`);
  }
}

function validateSpace(space: LevelSpaceSpec, spaceIds: Set<string>) {
  assertId(space.id, "Space");
  if (space.kind === "corridor") {
    validateRange(space.width, `Corridor ${space.id} width`);
    if (space.length) validateRange(space.length, `Corridor ${space.id} length`);
  } else {
    if (space.size.width) validateRange(space.size.width, `Room ${space.id} width`);
    if (space.size.height) validateRange(space.size.height, `Room ${space.id} height`);
  }
  for (const relation of space.relations ?? []) {
    if (!spaceIds.has(relation.targetId)) {
      throw new Error(`Space ${space.id} references unknown relation target ${relation.targetId}.`);
    }
    if (relation.targetId === space.id) {
      throw new Error(`Space ${space.id} cannot have a spatial relation to itself.`);
    }
  }
}

function collectIds(spec: LevelSpec): Set<string> {
  const seen = new Set<string>();
  const collections: Array<[string, { id: string }[]]> = [
    ["space", spec.spaces],
    ["connection", spec.connections],
    ["prop request", spec.props],
    ["encounter", spec.encounters],
    ["route", spec.routes ?? []],
    ["pickup", spec.pickups ?? []],
    ["trigger", spec.triggers ?? []],
    ["event", spec.events ?? []],
  ];
  for (const [kind, entries] of collections) {
    for (const entry of entries) {
      assertId(entry.id, kind);
      if (seen.has(entry.id)) throw new Error(`Duplicate semantic id: ${entry.id}.`);
      seen.add(entry.id);
    }
  }
  return seen;
}

function validateReachability(spec: LevelSpec, spaceIds: Set<string>) {
  if (!spec.rules.ensureReachability || spec.spaces.length <= 1) return;
  const adjacency = new Map<string, Set<string>>();
  for (const id of spaceIds) adjacency.set(id, new Set());
  for (const connection of spec.connections) {
    adjacency.get(connection.from)?.add(connection.to);
    adjacency.get(connection.to)?.add(connection.from);
  }
  const start = spec.spaces[0]?.id;
  if (!start) return;
  const visited = new Set<string>([start]);
  const queue = [start];
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of adjacency.get(current) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push(next);
    }
  }
  const unreachable = [...spaceIds].filter((id) => !visited.has(id));
  if (unreachable.length) {
    throw new Error(`Level ${spec.id} contains unreachable semantic spaces: ${unreachable.join(", ")}.`);
  }
}

function compileConnection(spec: LevelSpec, connection: ConnectionSpec, spaceIds: Set<string>): CompiledConnection {
  if (!spaceIds.has(connection.from) || !spaceIds.has(connection.to)) {
    throw new Error(`Connection ${connection.id} references unknown spaces ${connection.from} -> ${connection.to}.`);
  }
  if (connection.from === connection.to) throw new Error(`Connection ${connection.id} cannot connect a space to itself.`);

  const widthTiles = connection.widthTiles ?? (connection.kind === "standard-door" ? 1 : 2);
  if (!Number.isFinite(widthTiles) || widthTiles <= 0) throw new Error(`Connection ${connection.id} requires widthTiles > 0.`);

  const lock = connection.lock ?? { mode: "none" as const };
  if (connection.kind === "opening" && lock.mode !== "none") {
    throw new Error(`Opening ${connection.id} cannot carry a door lock.`);
  }
  if (lock.mode === "access-key" && !lock.keyId.trim()) {
    throw new Error(`Connection ${connection.id} has an empty access key id.`);
  }

  const clearanceTiles = connection.kind === "opening"
    ? { before: 0, after: 0 }
    : connection.clearanceTiles ?? spec.rules.defaultDoorClearance;
  if (clearanceTiles.before < 0 || clearanceTiles.after < 0) {
    throw new Error(`Connection ${connection.id} door clearance cannot be negative.`);
  }

  return {
    ...connection,
    seed: deriveSubSeed(spec.seed, `connection/${connection.id}`),
    widthTiles,
    clearanceTiles,
    lock,
  };
}

function validateRoutes(spec: LevelSpec, spaceIds: Set<string>) {
  for (const route of spec.routes ?? []) {
    if (!route.spaceIds.length) throw new Error(`Route ${route.id} requires at least one semantic space.`);
    for (const spaceId of route.spaceIds) {
      if (!spaceIds.has(spaceId)) throw new Error(`Route ${route.id} references unknown space ${spaceId}.`);
    }
  }
}

function validateEvents(events: LevelEventSpec[], connectionIds: Set<string>, routeIds: Set<string>, spaceIds: Set<string>) {
  for (const event of events) {
    if ((event.kind === "unlock-door" || event.kind === "lock-door") && !connectionIds.has(event.doorId)) {
      throw new Error(`Event ${event.id} references unknown door/connection ${event.doorId}.`);
    }
    if (event.kind === "spawn-actor" && !spaceIds.has(event.spaceId)) {
      throw new Error(`Event ${event.id} references unknown spawn space ${event.spaceId}.`);
    }
    if ((event.kind === "move-actor" || event.kind === "actor-passby") && !routeIds.has(event.routeId)) {
      throw new Error(`Event ${event.id} references unknown route ${event.routeId}.`);
    }
  }
}

function validateTriggers(
  triggers: TriggerSpec[],
  eventIds: Set<string>,
  allIds: Set<string>,
  spaceIds: Set<string>,
  pickupIds: Set<string>,
  diagnostics: CompileDiagnostic[],
) {
  for (const trigger of triggers) {
    if (!trigger.eventIds.length) throw new Error(`Trigger ${trigger.id} must reference at least one event.`);
    for (const eventId of trigger.eventIds) {
      if (!eventIds.has(eventId)) throw new Error(`Trigger ${trigger.id} references unknown event ${eventId}.`);
    }
    if (trigger.delayMs !== undefined && trigger.delayMs < 0) throw new Error(`Trigger ${trigger.id} delayMs cannot be negative.`);

    if (trigger.kind === "enter-space" && !spaceIds.has(trigger.sourceId)) {
      throw new Error(`Trigger ${trigger.id} references unknown space ${trigger.sourceId}.`);
    }
    if (trigger.kind === "collect" && !pickupIds.has(trigger.sourceId)) {
      throw new Error(`Trigger ${trigger.id} references unknown pickup ${trigger.sourceId}.`);
    }
    if ((trigger.kind === "interact" || trigger.kind === "proximity") && !allIds.has(trigger.sourceId)) {
      diagnostics.push({
        level: "warning",
        code: "UNRESOLVED_TRIGGER_SOURCE",
        targetId: trigger.id,
        message: `Trigger ${trigger.id} source ${trigger.sourceId} is reserved for a later runtime/zone registry.`,
      });
    }
  }
}

export function compileLevelSpec(spec: LevelSpec, propRegistry: PropRegistry): SemanticCompilePlan {
  assertId(spec.id, "LevelSpec");
  if (!Number.isInteger(spec.version) || spec.version <= 0) throw new Error("LevelSpec version must be a positive integer.");
  validateRange(spec.rules.defaultCorridorWidth, "Default corridor width");
  if (spec.rules.defaultDoorClearance.before < 0 || spec.rules.defaultDoorClearance.after < 0) {
    throw new Error("Default door clearance cannot be negative.");
  }
  if (!spec.spaces.length) throw new Error(`Level ${spec.id} requires at least one semantic space.`);

  const allIds = collectIds(spec);
  const spaceIds = new Set(spec.spaces.map((space) => space.id));
  for (const space of spec.spaces) validateSpace(space, spaceIds);
  validateRoutes(spec, spaceIds);

  const diagnostics: CompileDiagnostic[] = [];
  const spaces = spec.spaces.map((space) => ({
    ...space,
    seed: deriveSubSeed(spec.seed, `space/${space.id}`),
  }));

  const connections = spec.connections.map((connection) => compileConnection(spec, connection, spaceIds));
  const connectionIds = new Set(connections.map((connection) => connection.id));
  validateReachability(spec, spaceIds);

  const props: CompiledPropRequest[] = spec.props.map((request) => {
    if (!spaceIds.has(request.spaceId)) throw new Error(`Prop request ${request.id} references unknown space ${request.spaceId}.`);
    const metadata = propRegistry[request.propId];
    if (!metadata) throw new Error(`Prop request ${request.id} references unregistered prop ${request.propId}.`);
    const quantity = request.quantity ?? 1;
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error(`Prop request ${request.id} quantity must be a positive integer.`);
    for (const nearId of request.near ?? []) {
      if (!allIds.has(nearId)) throw new Error(`Prop request ${request.id} references unknown near target ${nearId}.`);
    }
    const space = spec.spaces.find((candidate) => candidate.id === request.spaceId)!;
    const missingTags = (metadata.placement.requiredSpaceTags ?? []).filter((tag) => !(space.tags ?? []).includes(tag));
    if (missingTags.length) {
      throw new Error(`Prop ${request.propId} requires space tags ${missingTags.join(", ")} in ${request.spaceId}.`);
    }
    return {
      ...request,
      seed: deriveSubSeed(spec.seed, `prop/${request.id}`),
      quantity,
      required: request.required ?? true,
      metadata,
    };
  });

  const routes = spec.routes ?? [];
  const routeIds = new Set(routes.map((route) => route.id));
  const encounters: CompiledEncounterIntent[] = spec.encounters.map((encounter) => {
    if (!spaceIds.has(encounter.spaceId)) throw new Error(`Encounter ${encounter.id} references unknown space ${encounter.spaceId}.`);
    if (encounter.behavior === "patrol" && !encounter.patrolRouteId) {
      throw new Error(`Patrol encounter ${encounter.id} requires patrolRouteId.`);
    }
    if (encounter.patrolRouteId && !routeIds.has(encounter.patrolRouteId)) {
      throw new Error(`Encounter ${encounter.id} references unknown patrol route ${encounter.patrolRouteId}.`);
    }
    return {
      ...encounter,
      seed: deriveSubSeed(spec.seed, `encounter/${encounter.id}`),
    };
  });

  const pickups = spec.pickups ?? [];
  for (const pickup of pickups) {
    if (!spaceIds.has(pickup.spaceId)) throw new Error(`Pickup ${pickup.id} references unknown space ${pickup.spaceId}.`);
    if (!pickup.keyId.trim()) throw new Error(`Pickup ${pickup.id} requires a non-empty keyId.`);
  }

  const keySources = new Set([
    ...pickups.map((pickup) => pickup.keyId),
    ...(spec.events ?? []).filter((event): event is Extract<LevelEventSpec, { kind: "grant-key" }> => event.kind === "grant-key").map((event) => event.keyId),
  ]);
  for (const connection of connections) {
    if (connection.lock.mode === "access-key" && !keySources.has(connection.lock.keyId)) {
      diagnostics.push({
        level: "warning",
        code: "KEY_SOURCE_NOT_YET_AUTHORED",
        targetId: connection.id,
        message: `Locked door ${connection.id} uses key ${connection.lock.keyId} but no pickup/grant event currently provides it.`,
      });
    }
  }

  const events = spec.events ?? [];
  const eventIds = new Set(events.map((event) => event.id));
  validateEvents(events, connectionIds, routeIds, spaceIds);

  const triggers = spec.triggers ?? [];
  validateTriggers(triggers, eventIds, allIds, spaceIds, new Set(pickups.map((pickup) => pickup.id)), diagnostics);

  for (const override of spec.overrides ?? []) {
    if (!allIds.has(override.targetId)) throw new Error(`Override references unknown semantic id ${override.targetId}.`);
  }

  if (spec.rules.singleSharedWall) {
    diagnostics.push({
      level: "info",
      code: "SHARED_WALL_POLICY",
      message: "Geometry stage must derive one shared wall graph from space boundaries; rooms must not emit duplicate walls.",
    });
  }
  if (spec.rules.doorsEmbeddedInWalls) {
    diagnostics.push({
      level: "info",
      code: "DOOR_EMBED_POLICY",
      message: "Door geometry must be compiled as apertures in wall segments with reserved clearance on both sides.",
    });
  }

  return {
    levelId: spec.id,
    version: spec.version,
    seed: normalizeLevelSeed(spec.seed),
    ruleSetRefs: [...spec.ruleSetRefs],
    rules: spec.rules,
    spaces,
    connections,
    props,
    encounters,
    routes,
    pickups,
    triggers,
    events,
    overrides: spec.overrides ?? [],
    diagnostics,
  };
}
