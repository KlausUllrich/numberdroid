import { deriveSubSeed, normalizeLevelSeed } from "./seed";
import { overrideFor } from "./overrides";
import type {
  AccessPickupSpec,
  CompiledConnection,
  CompiledEncounterIntent,
  CompiledPropRequest,
  CompileDiagnostic,
  ConnectionSpec,
  LevelEventSpec,
  LevelSpaceSpec,
  LevelSpec,
  PropRegistry,
  RouteSpec,
  SemanticCompilePlan,
  StagedActorSpec,
  TileRange,
  TriggerSpec,
  TriggerZoneSpec,
} from "./types";

const A4B_MAX_LOGIC_ENTRIES = 512;

function assertId(id: string, context: string) {
  if (!id.trim()) throw new Error(`${context} requires a non-empty id.`);
}

function assertSafeStateKey(id: string, context: string) {
  if (id === "__proto__" || id === "prototype" || id === "constructor") {
    throw new Error(`${context} cannot use unsafe record key ${id}.`);
  }
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
    ["staged actor", spec.stagedActors ?? []],
    ["route", spec.routes ?? []],
    ["pickup", spec.pickups ?? []],
    ["variable", spec.variables ?? []],
    ["text reference", spec.textReferences ?? []],
    ["trigger zone", spec.zones ?? []],
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

function validateStagedActors(stagedActors: StagedActorSpec[], spaceIds: Set<string>) {
  for (const actor of stagedActors) {
    if (!actor.actorType.trim()) throw new Error(`Staged actor ${actor.id} requires a non-empty actorType.`);
    if (actor.defaultSpaceId && !spaceIds.has(actor.defaultSpaceId)) {
      throw new Error(`Staged actor ${actor.id} references unknown default space ${actor.defaultSpaceId}.`);
    }
  }
}

function validateZones(
  zones: TriggerZoneSpec[],
  spaceIds: Set<string>,
  connectionIds: Set<string>,
  propRequestIds: Set<string>,
  actorIds: Set<string>,
  routeIds: Set<string>,
  pickupIds: Set<string>,
) {
  for (const zone of zones) {
    if (!spaceIds.has(zone.spaceId)) throw new Error(`Trigger zone ${zone.id} references unknown space ${zone.spaceId}.`);
    if (zone.sizeTiles) {
      if (!Number.isInteger(zone.sizeTiles.w) || !Number.isInteger(zone.sizeTiles.h) || zone.sizeTiles.w <= 0 || zone.sizeTiles.h <= 0) {
        throw new Error(`Trigger zone ${zone.id} sizeTiles must use positive integer width/height.`);
      }
    }
    const anchor = zone.anchor;
    if (anchor.kind === "connection" && !connectionIds.has(anchor.targetId)) {
      throw new Error(`Trigger zone ${zone.id} references unknown connection ${anchor.targetId}.`);
    }
    if (anchor.kind === "prop" && !propRequestIds.has(anchor.targetId)) {
      throw new Error(`Trigger zone ${zone.id} references unknown prop request ${anchor.targetId}.`);
    }
    if (anchor.kind === "actor" && !actorIds.has(anchor.targetId)) {
      throw new Error(`Trigger zone ${zone.id} references unknown actor ${anchor.targetId}.`);
    }
    if (anchor.kind === "route" && !routeIds.has(anchor.targetId)) {
      throw new Error(`Trigger zone ${zone.id} references unknown route ${anchor.targetId}.`);
    }
    if (anchor.kind === "pickup" && !pickupIds.has(anchor.targetId)) {
      throw new Error(`Trigger zone ${zone.id} references unknown pickup ${anchor.targetId}.`);
    }
  }
}

function validateEvents(
  events: LevelEventSpec[],
  connectionById: Map<string, CompiledConnection>,
  routeById: Map<string, RouteSpec>,
  spaceIds: Set<string>,
  actorIds: Set<string>,
  encounterById: Map<string, CompiledEncounterIntent>,
  pickupById: Map<string, AccessPickupSpec>,
  variableIds: Set<string>,
  textReferenceIds: Set<string>,
) {
  for (const event of events) {
    if (event.kind === "unlock-door" || event.kind === "lock-door") {
      const connection = connectionById.get(event.doorId);
      if (!connection) throw new Error(`Event ${event.id} references unknown door/connection ${event.doorId}.`);
      if (connection.kind === "opening") throw new Error(`Event ${event.id} cannot ${event.kind} opening ${event.doorId}.`);
    }
    if (event.kind === "grant-key" && !event.keyId.trim()) throw new Error(`Event ${event.id} requires a non-empty keyId.`);
    if (event.kind === "set-flag" && !event.flag.trim()) throw new Error(`Event ${event.id} requires a non-empty flag.`);
    if (event.kind === "set-flag") assertSafeStateKey(event.flag, `Event ${event.id} flag`);
    if (event.kind === "set-flag" && variableIds.has(event.flag)) {
      throw new Error(`Legacy set-flag Event ${event.id} cannot write declared Boolean variable ${event.flag}.`);
    }
    if (event.kind === "story-beat" && !event.beatId.trim()) throw new Error(`Event ${event.id} requires a non-empty beatId.`);

    if (event.kind === "drop-item") {
      const actor = encounterById.get(event.actorId);
      if (!actor) throw new Error(`Event ${event.id} references unknown encounter actor ${event.actorId}.`);
      const pickup = pickupById.get(event.pickupId);
      if (!pickup) throw new Error(`Event ${event.id} references unknown pickup ${event.pickupId}.`);
      if (pickup.initiallyPresent !== false) {
        throw new Error(`Event ${event.id} drop-item requires hidden pickup ${event.pickupId} with initiallyPresent false.`);
      }
      if (pickup.spaceId !== actor.spaceId) {
        throw new Error(`Event ${event.id} cannot drop pickup ${event.pickupId} outside actor ${event.actorId}'s space.`);
      }
    }
    if (event.kind === "set-variable") {
      if (!variableIds.has(event.variableId)) {
        throw new Error(`Event ${event.id} references unknown Boolean variable ${event.variableId}.`);
      }
      if (typeof (event as { value: unknown }).value !== "boolean") {
        throw new Error(`Event ${event.id} must assign a Boolean value to ${event.variableId}.`);
      }
    }
    if (event.kind === "show-text" && !textReferenceIds.has(event.textRefId)) {
      throw new Error(`Event ${event.id} references unknown visible text ${event.textRefId}.`);
    }

    if (event.kind === "spawn-actor") {
      if (!actorIds.has(event.actorId)) throw new Error(`Event ${event.id} references unknown actor ${event.actorId}.`);
      if (!spaceIds.has(event.spaceId)) throw new Error(`Event ${event.id} references unknown spawn space ${event.spaceId}.`);
    }
    if (event.kind === "despawn-actor" && !actorIds.has(event.actorId)) {
      throw new Error(`Event ${event.id} references unknown actor ${event.actorId}.`);
    }
    if (event.kind === "move-actor" || event.kind === "actor-passby") {
      if (!actorIds.has(event.actorId)) throw new Error(`Event ${event.id} references unknown actor ${event.actorId}.`);
      const route = routeById.get(event.routeId);
      if (!route) throw new Error(`Event ${event.id} references unknown route ${event.routeId}.`);
      if (event.kind === "actor-passby" && route.kind === "patrol") {
        throw new Error(`Event ${event.id} actor-passby requires a passby/scripted route, not patrol route ${event.routeId}.`);
      }
    }
    if (event.kind === "actor-passby" && event.durationMs !== undefined && event.durationMs <= 0) {
      throw new Error(`Event ${event.id} durationMs must be > 0 when provided.`);
    }
  }
}

function validateTriggers(
  triggers: TriggerSpec[],
  eventIds: Set<string>,
  sourceIds: Set<string>,
  spaceIds: Set<string>,
  zoneIds: Set<string>,
  pickupIds: Set<string>,
  encounterById: Map<string, CompiledEncounterIntent>,
  stateSourceIds: Set<string>,
) {
  for (const trigger of triggers) {
    if (!trigger.eventIds.length) throw new Error(`Trigger ${trigger.id} must reference at least one event.`);
    for (const eventId of trigger.eventIds) {
      if (!eventIds.has(eventId)) throw new Error(`Trigger ${trigger.id} references unknown event ${eventId}.`);
    }
    if (trigger.delayMs !== undefined && trigger.delayMs < 0) throw new Error(`Trigger ${trigger.id} delayMs cannot be negative.`);
    if (trigger.radiusTiles !== undefined && (!Number.isFinite(trigger.radiusTiles) || trigger.radiusTiles <= 0)) {
      throw new Error(`Trigger ${trigger.id} radiusTiles must be > 0.`);
    }
    if (!trigger.sourceId.trim()) throw new Error(`Trigger ${trigger.id} requires a non-empty sourceId.`);

    if (trigger.kind === "enter-space" && !spaceIds.has(trigger.sourceId)) {
      throw new Error(`Trigger ${trigger.id} references unknown space ${trigger.sourceId}.`);
    }
    if (trigger.kind === "enter-zone" && !zoneIds.has(trigger.sourceId)) {
      throw new Error(`Trigger ${trigger.id} references unknown trigger zone ${trigger.sourceId}.`);
    }
    if (trigger.kind === "collect" && !pickupIds.has(trigger.sourceId)) {
      throw new Error(`Trigger ${trigger.id} references unknown pickup ${trigger.sourceId}.`);
    }
    if (trigger.kind === "actor-defeated") {
      const actor = encounterById.get(trigger.sourceId);
      if (!actor) throw new Error(`Trigger ${trigger.id} references unknown encounter actor ${trigger.sourceId}.`);
      if (!actor.actorArchetype) {
        throw new Error(`Trigger ${trigger.id} requires actor ${trigger.sourceId} to declare an immutable actorArchetype pin.`);
      }
      if (actor.behavior !== "patrol" || !actor.patrolRouteId) {
        throw new Error(`Trigger ${trigger.id} requires actor ${trigger.sourceId} to follow a patrol route.`);
      }
      if (trigger.once !== true || (trigger.delayMs ?? 0) !== 0) {
        throw new Error(`Actor-defeated Trigger ${trigger.id} must be once-only with no delay.`);
      }
    }
    if (trigger.kind === "state-change" && !stateSourceIds.has(trigger.sourceId)) {
      throw new Error(`Trigger ${trigger.id} references unknown state source ${trigger.sourceId}.`);
    }
    if ((trigger.kind === "interact" || trigger.kind === "proximity") && !sourceIds.has(trigger.sourceId)) {
      throw new Error(`Trigger ${trigger.id} references unknown source ${trigger.sourceId}.`);
    }
  }
}

function validateA4bReferencePrograms(
  pickups: NonNullable<LevelSpec["pickups"]>,
  variables: NonNullable<LevelSpec["variables"]>,
  triggers: TriggerSpec[],
  events: LevelEventSpec[],
) {
  const ownersByEventId = new Map<string, TriggerSpec[]>();
  for (const trigger of triggers) {
    for (const eventId of trigger.eventIds) {
      const owners = ownersByEventId.get(eventId) ?? [];
      owners.push(trigger);
      ownersByEventId.set(eventId, owners);
    }
  }
  const pickupById = new Map(pickups.map((pickup) => [pickup.id, pickup]));
  const variableById = new Map(variables.map((variable) => [variable.id, variable]));
  const dropEvents = events.filter((event): event is Extract<LevelEventSpec, { kind: "drop-item" }> => event.kind === "drop-item");
  const droppedPickupIds = new Set<string>();
  for (const event of dropEvents) {
    if (droppedPickupIds.has(event.pickupId)) {
      throw new Error(`Pickup ${event.pickupId} cannot have more than one drop-item Event.`);
    }
    droppedPickupIds.add(event.pickupId);
    const owners = ownersByEventId.get(event.id) ?? [];
    if (owners.length !== 1) {
      throw new Error(`Drop-item Event ${event.id} must be referenced by exactly one Trigger.`);
    }
    const trigger = owners[0];
    if (trigger.kind !== "actor-defeated" || trigger.sourceId !== event.actorId) {
      throw new Error(`Drop-item Event ${event.id} must be owned by an actor-defeated Trigger for actor ${event.actorId}.`);
    }
    if (trigger.once !== true || (trigger.delayMs ?? 0) !== 0) {
      throw new Error(`Drop-item Trigger ${trigger.id} must be once-only with no delay.`);
    }
  }
  for (const pickup of pickups) {
    if (pickup.initiallyPresent === false && !droppedPickupIds.has(pickup.id)) {
      throw new Error(`Hidden pickup ${pickup.id} requires exactly one drop-item Event.`);
    }
  }

  const setterByVariableId = new Map<string, Extract<LevelEventSpec, { kind: "set-variable" }>>();
  for (const event of events) {
    if (event.kind !== "set-variable") continue;
    const owners = ownersByEventId.get(event.id) ?? [];
    if (owners.length !== 1) {
      throw new Error(`Set-variable Event ${event.id} must be referenced by exactly one Trigger.`);
    }
    const trigger = owners[0];
    const pickup = pickupById.get(trigger.sourceId);
    if (trigger.kind !== "collect" || !pickup || pickup.initiallyPresent !== false || !droppedPickupIds.has(pickup.id)) {
      throw new Error(`Set-variable Event ${event.id} must be owned by a collect Trigger for one dropped pickup.`);
    }
    if (trigger.once !== true || (trigger.delayMs ?? 0) !== 0) {
      throw new Error(`Set-variable Trigger ${trigger.id} must be once-only with no delay.`);
    }
    if (setterByVariableId.has(event.variableId)) {
      throw new Error(`Boolean variable ${event.variableId} cannot have more than one set-variable Event.`);
    }
    const variable = variableById.get(event.variableId)!;
    if (event.value === variable.initialValue) {
      throw new Error(`Set-variable Event ${event.id} must change Boolean variable ${event.variableId} from its initial value.`);
    }
    setterByVariableId.set(event.variableId, event);
  }

  for (const event of events) {
    if (event.kind !== "show-text") continue;
    const owners = ownersByEventId.get(event.id) ?? [];
    if (owners.length !== 1) {
      throw new Error(`Show-text Event ${event.id} must be referenced by exactly one Trigger.`);
    }
    const trigger = owners[0];
    if (trigger.kind !== "state-change" || !setterByVariableId.has(trigger.sourceId)) {
      throw new Error(`Show-text Event ${event.id} must be owned by a state-change Trigger for a collected Boolean variable.`);
    }
    if (trigger.once !== true || (trigger.delayMs ?? 0) !== 0) {
      throw new Error(`Show-text Trigger ${trigger.id} must be once-only with no delay.`);
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
  const connectionById = new Map(connections.map((connection) => [connection.id, connection]));
  const connectionIds = new Set(connectionById.keys());
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
  const routeById = new Map(routes.map((route) => [route.id, route]));
  const routeIds = new Set(routeById.keys());
  const encounters: CompiledEncounterIntent[] = spec.encounters.map((encounter) => {
    if (!spaceIds.has(encounter.spaceId)) throw new Error(`Encounter ${encounter.id} references unknown space ${encounter.spaceId}.`);
    if (encounter.actorArchetype) {
      assertId(encounter.actorArchetype.id, `Encounter ${encounter.id} actorArchetype`);
      if (!Number.isSafeInteger(encounter.actorArchetype.version) || encounter.actorArchetype.version <= 0) {
        throw new Error(`Encounter ${encounter.id} actorArchetype version must be a positive safe integer.`);
      }
    }
    if (encounter.behavior === "patrol" && !encounter.patrolRouteId) {
      throw new Error(`Patrol encounter ${encounter.id} requires patrolRouteId.`);
    }
    if (encounter.patrolRouteId && !routeIds.has(encounter.patrolRouteId)) {
      throw new Error(`Encounter ${encounter.id} references unknown patrol route ${encounter.patrolRouteId}.`);
    }
    const robotType = overrideFor(spec.overrides ?? [], encounter.id)?.robotType;
    if (robotType && robotType !== encounter.enemyId) {
      diagnostics.push({
        level: "info",
        code: "ENCOUNTER_ROBOT_TYPE_OVERRIDDEN",
        targetId: encounter.id,
        message: `${encounter.id} robot type changed from ${encounter.enemyId} to ${robotType} by semantic Override.`,
      });
    }
    return {
      ...encounter,
      enemyId: robotType ?? encounter.enemyId,
      bodyId: robotType ?? encounter.bodyId,
      seed: deriveSubSeed(spec.seed, `encounter/${encounter.id}`),
    };
  });

  const stagedActors = spec.stagedActors ?? [];
  validateStagedActors(stagedActors, spaceIds);
  const actorIds = new Set([...encounters.map((encounter) => encounter.id), ...stagedActors.map((actor) => actor.id)]);
  const encounterById = new Map(encounters.map((encounter) => [encounter.id, encounter]));

  const pickups = spec.pickups ?? [];
  for (const pickup of pickups) {
    if (!spaceIds.has(pickup.spaceId)) throw new Error(`Pickup ${pickup.id} references unknown space ${pickup.spaceId}.`);
    if (!pickup.keyId.trim()) throw new Error(`Pickup ${pickup.id} requires a non-empty keyId.`);
    if (pickup.initiallyPresent !== undefined && typeof pickup.initiallyPresent !== "boolean") {
      throw new Error(`Pickup ${pickup.id} initiallyPresent must be boolean when provided.`);
    }
  }
  const pickupIds = new Set(pickups.map((pickup) => pickup.id));
  const pickupById = new Map(pickups.map((pickup) => [pickup.id, pickup]));

  const variables = spec.variables ?? [];
  for (const variable of variables) {
    assertSafeStateKey(variable.id, `Variable ${variable.id}`);
    if (variable.type !== "boolean" || typeof variable.initialValue !== "boolean") {
      throw new Error(`Variable ${variable.id} must declare a Boolean type and initial value.`);
    }
  }
  const variableIds = new Set(variables.map((variable) => variable.id));

  const textReferences = spec.textReferences ?? [];
  for (const textReference of textReferences) {
    if (typeof textReference.text !== "string" || !textReference.text.trim() || textReference.text.length > 4_096) {
      throw new Error(`Visible text ${textReference.id} must contain 1 to 4096 non-whitespace characters.`);
    }
  }
  const textReferenceIds = new Set(textReferences.map((textReference) => textReference.id));

  const events = spec.events ?? [];
  const storyBeatIds = new Set(events
    .filter((event): event is Extract<LevelEventSpec, { kind: "story-beat" }> => event.kind === "story-beat")
    .map((event) => event.beatId));
  for (const textReference of textReferences) {
    if (storyBeatIds.has(textReference.id)) {
      throw new Error(`Visible text ${textReference.id} collides with an existing story-beat beatId.`);
    }
  }

  const hasA4bLogic = variables.length > 0
    || textReferences.length > 0
    || events.some((event) => event.kind === "drop-item" || event.kind === "set-variable" || event.kind === "show-text")
    || (spec.triggers ?? []).some((trigger) => trigger.kind === "actor-defeated");
  if (hasA4bLogic) {
    const boundedCollections: Array<[string, number]> = [
      ["variables", variables.length],
      ["text references", textReferences.length],
      ["events", events.length],
      ["triggers", (spec.triggers ?? []).length],
    ];
    for (const [kind, count] of boundedCollections) {
      if (count > A4B_MAX_LOGIC_ENTRIES) {
        throw new Error(`A4b LevelSpec supports at most ${A4B_MAX_LOGIC_ENTRIES} ${kind}; received ${count}.`);
      }
    }
  }

  const zones = spec.zones ?? [];
  const zoneIds = new Set(zones.map((zone) => zone.id));
  validateZones(
    zones,
    spaceIds,
    connectionIds,
    new Set(props.map((request) => request.id)),
    actorIds,
    routeIds,
    pickupIds,
  );

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

  const eventIds = new Set(events.map((event) => event.id));
  validateEvents(
    events,
    connectionById,
    routeById,
    spaceIds,
    actorIds,
    encounterById,
    pickupById,
    variableIds,
    textReferenceIds,
  );

  const triggerSourceIds = new Set([
    ...spaceIds,
    ...connectionIds,
    ...props.map((request) => request.id),
    ...actorIds,
    ...routeIds,
    ...pickupIds,
    ...zoneIds,
  ]);
  const triggers = spec.triggers ?? [];
  const legacyFlagIds = new Set(events
    .filter((event): event is Extract<LevelEventSpec, { kind: "set-flag" }> => event.kind === "set-flag")
    .map((event) => event.flag));
  validateTriggers(
    triggers,
    eventIds,
    triggerSourceIds,
    spaceIds,
    zoneIds,
    pickupIds,
    encounterById,
    new Set([...variableIds, ...legacyFlagIds]),
  );
  validateA4bReferencePrograms(pickups, variables, triggers, events);

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
    ...(spec.runtime ? { runtime: spec.runtime } : {}),
    spaces,
    connections,
    props,
    encounters,
    stagedActors,
    routes,
    pickups,
    variables,
    textReferences,
    zones,
    triggers,
    events,
    overrides: spec.overrides ?? [],
    diagnostics,
  };
}
