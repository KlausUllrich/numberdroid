import { floorFromTiledMap, type TiledMapJson } from "../game/tiled";
import type { EncounterBehaviorKind } from "../game/types";
import { compileLevelSpec } from "./compiler";
import { compileLevelGeometry } from "./geometry";
import { compileLevelNavigationV031 } from "./navigationHardening";
import { compileOrientedPropPlacement } from "./orientedPlacement";
import { compileActorPlacement } from "./actorPlacement";
import { compileTriggerEvents } from "./eventCompilation";
import type { GridCell, NavigationCell } from "./navigationTypes";
import type { EventCompilationPlan } from "./eventCompilationTypes";
import type { RuntimeEmissionPlan } from "./emissionTypes";
import type {
  CardinalDirection,
  CompiledEncounterIntent,
  LevelRuntimeSpec,
  LevelSpec,
  PropRegistry,
} from "./types";

const DEFAULT_TILE_SIZE = 64;
const DEFAULT_WALL_COLLISION_PX = 10;
const BLOCKOUT_TILESET = "/assets/levelgen/compiler-blockout-tiles.svg";

type TiledProperty = { name: string; type?: string; value: unknown };
type TiledObject = {
  id: number;
  name?: string;
  class?: string;
  type?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  properties?: TiledProperty[];
};

type TiledObjectLayer = {
  id: number;
  name: string;
  type: "objectgroup";
  objects: TiledObject[];
};

function prop(name: string, value: unknown, type: string = typeof value): TiledProperty {
  return { name, type, value };
}

function friendly(id: string) {
  return id.replace(/#/g, " ").replace(/[-_.]+/g, " ").trim().toUpperCase();
}

function cellKey(cell: GridCell) {
  return `${cell.x},${cell.y}`;
}

function difficultyLabel(difficulty: CompiledEncounterIntent["difficulty"]) {
  return difficulty === "easy" ? "LEICHT" : difficulty === "medium" ? "MITTEL" : "STARK";
}

function behaviorDefaults(kind: EncounterBehaviorKind) {
  if (kind === "neutral") {
    return { interceptRadius: 88, detectionRadius: 88, loseRadius: 208, patrolSpeed: 54, chaseSpeed: 112, chaseAcceleration: 120, viewAngle: 360, searchDurationMs: 0 };
  }
  if (kind === "guard") {
    return { interceptRadius: 88, detectionRadius: 220, loseRadius: 340, patrolSpeed: 40, chaseSpeed: 128, chaseAcceleration: 160, viewAngle: 150, searchDurationMs: 900 };
  }
  if (kind === "patrol") {
    return { interceptRadius: 80, detectionRadius: 210, loseRadius: 330, patrolSpeed: 64, chaseSpeed: 128, chaseAcceleration: 150, viewAngle: 150, searchDurationMs: 700 };
  }
  return { interceptRadius: 88, detectionRadius: 260, loseRadius: 390, patrolSpeed: 48, chaseSpeed: 140, chaseAcceleration: 220, viewAngle: 170, searchDurationMs: 1300 };
}

function normalizedRuntime(runtime: LevelRuntimeSpec | undefined, semantic: EventCompilationPlan["actors"]["props"]["navigation"]["geometry"]["semantic"]) {
  const tileSize = runtime?.tileSize ?? DEFAULT_TILE_SIZE;
  if (!Number.isInteger(tileSize) || tileSize <= 0) throw new Error(`Runtime emission tileSize must be a positive integer; got ${tileSize}.`);

  const wallCollisionPx = runtime?.wallCollisionPx ?? DEFAULT_WALL_COLLISION_PX;
  if (!Number.isFinite(wallCollisionPx) || wallCollisionPx <= 0 || wallCollisionPx >= tileSize) {
    throw new Error(`Runtime emission wallCollisionPx must be > 0 and < tileSize; got ${wallCollisionPx}.`);
  }

  const startSpaceId = runtime?.start?.spaceId ?? semantic.spaces[0]?.id;
  if (!startSpaceId || !semantic.spaces.some((space) => space.id === startSpaceId)) {
    throw new Error(`Runtime emission start space ${startSpaceId ?? "<missing>"} does not exist.`);
  }
  const facing = runtime?.start?.facing ?? 0;
  if (!Number.isFinite(facing)) throw new Error("Runtime emission start facing must be finite.");
  const metaEnergy = runtime?.start?.metaEnergy ?? 0;
  if (!Number.isFinite(metaEnergy) || metaEnergy < 0) throw new Error("Runtime emission start metaEnergy must be >= 0.");

  return {
    tileSize,
    wallCollisionPx,
    floorName: runtime?.floorName ?? friendly(semantic.levelId),
    subtitle: runtime?.subtitle ?? "GENERATED LEVEL · COMPILER V0.6",
    objectiveDefault: runtime?.objectiveDefault ?? "ERKUNDE DEN GENERIERTEN LEVEL",
    objectiveAfterEnergy: runtime?.objectiveAfterEnergy ?? runtime?.objectiveDefault ?? "ERKUNDE DEN GENERIERTEN LEVEL",
    start: {
      spaceId: startSpaceId,
      bodyId: runtime?.start?.bodyId ?? "pico" as const,
      facing,
      metaEnergy: Math.floor(metaEnergy),
      preferredSide: runtime?.start?.preferredSide,
    },
  };
}

function preferredSideDistance(cell: NavigationCell, rect: { x: number; y: number; w: number; h: number }, side: CardinalDirection) {
  if (side === "north") return cell.y - rect.y;
  if (side === "south") return rect.y + rect.h - 1 - cell.y;
  if (side === "west") return cell.x - rect.x;
  return rect.x + rect.w - 1 - cell.x;
}

function selectStartCell(plan: EventCompilationPlan, runtime: ReturnType<typeof normalizedRuntime>) {
  const navigation = plan.actors.props.navigation;
  const space = navigation.geometry.spaces.find((entry) => entry.id === runtime.start.spaceId);
  if (!space) throw new Error(`Runtime start space ${runtime.start.spaceId} has no compiled geometry.`);

  const blocked = new Set<string>();
  for (const cell of plan.actors.props.occupiedCells) blocked.add(cellKey(cell));
  for (const cell of plan.actors.props.reservations) blocked.add(cellKey(cell));
  for (const actor of plan.actors.actors) blocked.add(cellKey(actor.cell));
  for (const pickup of plan.pickups) blocked.add(cellKey(pickup.cell));
  for (const route of plan.actors.routes) for (const cell of route.cells) blocked.add(cellKey(cell));
  for (const forbidden of navigation.forbiddenCells) {
    if (forbidden.reasons.includes("door-clearance")) blocked.add(cellKey(forbidden));
  }

  const primary = new Set(navigation.primaryPathCells.map(cellKey));
  const center = { x: space.rect.x + (space.rect.w - 1) / 2, y: space.rect.y + (space.rect.h - 1) / 2 };
  const candidates = navigation.walkableCells
    .filter((cell) => cell.spaceId === runtime.start.spaceId && !blocked.has(cellKey(cell)))
    .map((cell) => {
      const centerDistance = Math.abs(cell.x - center.x) + Math.abs(cell.y - center.y);
      let score = Math.max(0, 40 - centerDistance * 4);
      if (primary.has(cellKey(cell))) score += 16;
      if (runtime.start.preferredSide) {
        score += Math.max(0, 45 - preferredSideDistance(cell, space.rect, runtime.start.preferredSide) * 12);
      }
      return { cell, score };
    })
    .sort((a, b) => b.score - a.score || a.cell.y - b.cell.y || a.cell.x - b.cell.x);

  if (!candidates[0]) throw new Error(`Runtime emission cannot find a free start cell in ${runtime.start.spaceId}.`);
  return candidates[0].cell;
}

export function emitRuntimeLevel(events: EventCompilationPlan, runtimeOverride?: LevelRuntimeSpec): RuntimeEmissionPlan {
  const actors = events.actors;
  const props = actors.props;
  const navigation = props.navigation;
  const geometry = navigation.geometry;
  const semantic = geometry.semantic;
  const bounds = navigation.bounds;
  const runtime = normalizedRuntime(runtimeOverride, semantic);
  const tileSize = runtime.tileSize;
  const wallCollisionPx = runtime.wallCollisionPx;
  const columns = bounds.w;
  const rows = bounds.h;
  const shiftX = (x: number) => x - bounds.x;
  const shiftY = (y: number) => y - bounds.y;
  const pxX = (x: number) => shiftX(x) * tileSize;
  const pxY = (y: number) => shiftY(y) * tileSize;
  const cellCenter = (cell: GridCell) => ({ x: (shiftX(cell.x) + 0.5) * tileSize, y: (shiftY(cell.y) + 0.5) * tileSize });
  const pathText = (cells: GridCell[]) => cells.map((cell) => {
    const point = cellCenter(cell);
    return `${point.x},${point.y}`;
  }).join(";");

  let nextObjectId = 1;
  let nextLayerId = 1;
  const object = (data: Omit<TiledObject, "id">): TiledObject => ({ id: nextObjectId++, ...data });
  const objectLayer = (name: string, objects: TiledObject[]): TiledObjectLayer => ({ id: nextLayerId++, name, type: "objectgroup", objects });

  const ground = Array.from({ length: columns * rows }, () => 0);
  const semanticSpaceById = new Map(semantic.spaces.map((space) => [space.id, space]));
  const gidForSpace = (spaceId: string, kind: "room" | "corridor") => {
    if (kind === "corridor") return 2;
    const space = semanticSpaceById.get(spaceId);
    if (space?.kind === "room" && space.rationality === "domestic") return 1;
    if (space?.kind === "room" && space.rationality === "ritual") return 3;
    if (space?.kind === "room" && space.rationality === "system") return 4;
    return 2;
  };
  for (const space of geometry.spaces) {
    const gid = gidForSpace(space.id, space.kind);
    for (let y = space.rect.y; y < space.rect.y + space.rect.h; y += 1) {
      for (let x = space.rect.x; x < space.rect.x + space.rect.w; x += 1) {
        const col = shiftX(x);
        const row = shiftY(y);
        if (col >= 0 && col < columns && row >= 0 && row < rows) ground[row * columns + col] = gid;
      }
    }
  }

  const startCell = selectStartCell(events, runtime);
  const startPoint = cellCenter(startCell);

  const walkableObjects = geometry.spaces.map((space) => object({
    name: space.id,
    x: pxX(space.rect.x),
    y: pxY(space.rect.y),
    width: space.rect.w * tileSize,
    height: space.rect.h * tileSize,
  }));

  const wallObstacleObjects = geometry.walls.map((wall) => {
    if (wall.orientation === "horizontal") {
      return object({
        name: wall.id,
        x: pxX(wall.x),
        y: pxY(wall.y) - wallCollisionPx / 2,
        width: wall.length * tileSize,
        height: wallCollisionPx,
        properties: [prop("kind", "wall", "string"), prop("shared", wall.shared, "bool")],
      });
    }
    return object({
      name: wall.id,
      x: pxX(wall.x) - wallCollisionPx / 2,
      y: pxY(wall.y),
      width: wallCollisionPx,
      height: wall.length * tileSize,
      properties: [prop("kind", "wall", "string"), prop("shared", wall.shared, "bool")],
    });
  });

  const propObstacleObjects = props.placements.map((placement) => object({
    name: `prop-solid:${placement.id}`,
    x: pxX(placement.rect.x),
    y: pxY(placement.rect.y),
    width: placement.rect.w * tileSize,
    height: placement.rect.h * tileSize,
    properties: [prop("kind", "prop", "string"), prop("propId", placement.propId, "string")],
  }));

  const roomObjects = geometry.spaces.map((space) => {
    const semanticSpace = semanticSpaceById.get(space.id);
    return object({
      name: space.id,
      x: pxX(space.rect.x),
      y: pxY(space.rect.y),
      width: space.rect.w * tileSize,
      height: space.rect.h * tileSize,
      properties: [
        prop("label", friendly(space.id), "string"),
        prop("subtitle", semanticSpace?.kind === "room" ? semanticSpace.archetype : semanticSpace?.archetype ?? "CIRCULATION", "string"),
      ],
    });
  });

  const semanticConnectionById = new Map(semantic.connections.map((connection) => [connection.id, connection]));
  const doorObjects = geometry.connections.filter((connection) => connection.kind !== "opening").map((connection) => {
    const semanticConnection = semanticConnectionById.get(connection.id);
    if (!semanticConnection) throw new Error(`Emitter cannot resolve semantic connection ${connection.id}.`);
    const vertical = connection.wallOrientation === "vertical";
    const rect = vertical
      ? {
          x: pxX(connection.boundary) - wallCollisionPx / 2,
          y: pxY(connection.apertureStart),
          width: wallCollisionPx,
          height: connection.apertureLength * tileSize,
        }
      : {
          x: pxX(connection.apertureStart),
          y: pxY(connection.boundary) - wallCollisionPx / 2,
          width: connection.apertureLength * tileSize,
          height: wallCollisionPx,
        };
    const locked = semanticConnection.lock.mode === "access-key";
    const properties: TiledProperty[] = [
      prop("orientation", connection.wallOrientation, "string"),
      prop("mode", locked ? "locked" : "auto", "string"),
      prop("size", connection.apertureLength >= 2 ? "large" : "standard", "string"),
      prop("openRadius", Math.max(118, connection.apertureLength * tileSize * 0.9), "float"),
      prop("label", friendly(connection.id), "string"),
    ];
    if (semanticConnection.lock.mode === "access-key") {
      properties.push(prop("keyId", semanticConnection.lock.keyId, "string"));
    }
    return object({ name: connection.id, ...rect, properties });
  });

  const routeById = new Map(actors.routes.map((route) => [route.id, route]));
  const encounterById = new Map(semantic.encounters.map((encounter) => [encounter.id, encounter]));
  const encounterObjects = actors.actors.map((actor) => {
    const encounter = encounterById.get(actor.id);
    if (!encounter) throw new Error(`Emitter cannot resolve encounter intent ${actor.id}.`);
    const position = cellCenter(actor.cell);
    const route = actor.patrolRouteId ? routeById.get(actor.patrolRouteId) : undefined;
    const defaults = behaviorDefaults(encounter.behavior);
    const properties: TiledProperty[] = [
      prop("encounterId", encounter.id, "string"),
      prop("enemyId", encounter.enemyId, "string"),
      prop("bodyId", encounter.bodyId, "string"),
      prop("mode", encounter.mode, "string"),
      prop("mathLabel", encounter.mathLabel, "string"),
      prop("difficulty", encounter.difficulty, "string"),
      prop("difficultyLabel", difficultyLabel(encounter.difficulty), "string"),
      prop("rewardLabel", `SIEG → ${friendly(encounter.id)} ÜBERNEHMEN`, "string"),
      prop("retreatX", position.x, "float"),
      prop("retreatY", position.y, "float"),
      prop("boss", Boolean(encounter.boss), "bool"),
      prop("behavior", encounter.behavior, "string"),
      prop("facing", actor.facing, "float"),
      prop("interceptRadius", defaults.interceptRadius, "float"),
      prop("detectionRadius", defaults.detectionRadius, "float"),
      prop("loseRadius", defaults.loseRadius, "float"),
      prop("patrolSpeed", defaults.patrolSpeed, "float"),
      prop("chaseSpeed", defaults.chaseSpeed, "float"),
      prop("chaseAcceleration", defaults.chaseAcceleration, "float"),
      prop("forcedEngagement", false, "bool"),
      prop("viewAngle", defaults.viewAngle, "float"),
      prop("searchDurationMs", defaults.searchDurationMs, "int"),
    ];
    if (encounter.mathRole) properties.push(prop("mathRole", encounter.mathRole, "string"));
    if (route && route.cells.length >= 2) properties.push(prop("patrolPath", pathText(route.cells), "string"));
    return object({ name: friendly(encounter.id), x: position.x, y: position.y, properties });
  });

  const pickupObjects = events.pickups.map((pickup) => {
    const position = cellCenter(pickup.cell);
    return object({
      name: pickup.id,
      x: position.x,
      y: position.y,
      properties: [
        prop("keyId", pickup.keyId, "string"),
        prop("label", pickup.label ?? friendly(pickup.id), "string"),
      ],
    });
  });

  const compilerPropObjects = props.placements.map((placement) => object({
    name: placement.id,
    x: pxX(placement.rect.x),
    y: pxY(placement.rect.y),
    width: placement.rect.w * tileSize,
    height: placement.rect.h * tileSize,
    properties: [
      prop("propId", placement.propId, "string"),
      prop("spaceId", placement.spaceId, "string"),
      prop("role", placement.role, "string"),
      prop("rotation", placement.rotation, "int"),
      prop("wallSide", placement.wallSide ?? "", "string"),
      prop("tags", placement.tags.join(";"), "string"),
    ],
  }));

  const routeObjects = actors.routes.map((route) => {
    const first = route.cells[0];
    const point = first ? cellCenter(first) : { x: 0, y: 0 };
    return object({
      name: route.id,
      x: point.x,
      y: point.y,
      properties: [
        prop("kind", route.kind, "string"),
        prop("loop", route.loop, "bool"),
        prop("path", pathText(route.cells), "string"),
        prop("spaceIds", [...new Set(route.cells.map((cell) => cell.spaceId))].join(";"), "string"),
      ],
    });
  });

  const zoneObjects = events.zones.map((zone) => {
    const minX = Math.min(...zone.cells.map((cell) => cell.x));
    const minY = Math.min(...zone.cells.map((cell) => cell.y));
    const maxX = Math.max(...zone.cells.map((cell) => cell.x));
    const maxY = Math.max(...zone.cells.map((cell) => cell.y));
    const center = cellCenter(zone.center);
    return object({
      name: zone.id,
      x: pxX(minX),
      y: pxY(minY),
      width: (maxX - minX + 1) * tileSize,
      height: (maxY - minY + 1) * tileSize,
      properties: [
        prop("spaceId", zone.spaceId, "string"),
        prop("anchorKind", zone.anchorKind, "string"),
        prop("anchorTargetId", zone.anchorTargetId ?? "", "string"),
        prop("centerX", center.x, "float"),
        prop("centerY", center.y, "float"),
        prop("cells", zone.cells.map((cell) => `${shiftX(cell.x)},${shiftY(cell.y)}`).join(";"), "string"),
        prop("tags", zone.tags.join(";"), "string"),
      ],
    });
  });

  const triggerObjects = events.triggers.map((trigger) => {
    const point = trigger.source.point ? cellCenter(trigger.source.point) : { x: 0, y: 0 };
    const properties: TiledProperty[] = [
      prop("kind", trigger.kind, "string"),
      prop("sourceKind", trigger.source.kind, "string"),
      prop("sourceId", trigger.source.id, "string"),
      prop("resolvedIds", trigger.source.resolvedIds.join(";"), "string"),
      prop("eventIds", trigger.eventIds.join(";"), "string"),
      prop("once", trigger.once, "bool"),
      prop("delayMs", trigger.delayMs, "int"),
      prop("sourceCells", trigger.source.cells.map((cell) => `${shiftX(cell.x)},${shiftY(cell.y)}`).join(";"), "string"),
    ];
    if (trigger.source.spaceId) properties.push(prop("spaceId", trigger.source.spaceId, "string"));
    if (trigger.radiusTiles !== undefined) properties.push(prop("radiusTiles", trigger.radiusTiles, "float"));
    return object({ name: trigger.id, x: point.x, y: point.y, properties });
  });

  const eventObjects = events.events.map((event) => object({
    name: event.id,
    x: 0,
    y: 0,
    properties: [
      prop("kind", event.kind, "string"),
      prop("targetIds", event.targetIds.join(";"), "string"),
      prop("eventJson", JSON.stringify(event.event), "string"),
    ],
  }));

  const linkObjects = events.links.map((link) => object({
    name: link.id,
    x: 0,
    y: 0,
    properties: [
      prop("triggerId", link.triggerId, "string"),
      prop("eventId", link.eventId, "string"),
      prop("order", link.order, "int"),
    ],
  }));

  const stagedActorObjects = events.stagedActors.map((actor) => object({
    name: actor.id,
    x: 0,
    y: 0,
    properties: [
      prop("actorType", actor.actorType, "string"),
      prop("initiallyPresent", Boolean(actor.initiallyPresent), "bool"),
      prop("defaultSpaceId", actor.defaultSpaceId ?? "", "string"),
      prop("tags", (actor.tags ?? []).join(";"), "string"),
    ],
  }));

  const layers: TiledMapJson["layers"] = [
    { id: nextLayerId++, name: "Ground", type: "tilelayer", width: columns, height: rows, data: ground, opacity: 1, visible: true },
    objectLayer("Start", [object({
      name: "player-start",
      x: startPoint.x,
      y: startPoint.y,
      properties: [
        prop("bodyId", runtime.start.bodyId, "string"),
        prop("facing", runtime.start.facing, "float"),
        prop("metaEnergy", runtime.start.metaEnergy, "int"),
        prop("spaceId", runtime.start.spaceId, "string"),
      ],
    })]),
    objectLayer("Walkable", walkableObjects),
    objectLayer("Obstacles", [...wallObstacleObjects, ...propObstacleObjects]),
    objectLayer("Rooms", roomObjects),
    objectLayer("Doors", doorObjects),
    objectLayer("EnergyStations", []),
    objectLayer("Encounters", encounterObjects),
    objectLayer("Pickups", pickupObjects),
    objectLayer("Actions", []),
    objectLayer("CompilerProps", compilerPropObjects),
    objectLayer("ActorRoutes", routeObjects),
    objectLayer("TriggerZones", zoneObjects),
    objectLayer("Triggers", triggerObjects),
    objectLayer("Events", eventObjects),
    objectLayer("TriggerEventLinks", linkObjects),
    objectLayer("StagedActors", stagedActorObjects),
  ];

  const tiledMap: TiledMapJson = {
    orientation: "orthogonal",
    infinite: false,
    width: columns,
    height: rows,
    tilewidth: tileSize,
    tileheight: tileSize,
    properties: [
      prop("floorId", semantic.levelId, "string"),
      prop("floorName", runtime.floorName, "string"),
      prop("subtitle", runtime.subtitle, "string"),
      prop("objectiveDefault", runtime.objectiveDefault, "string"),
      prop("objectiveAfterEnergy", runtime.objectiveAfterEnergy, "string"),
      prop("levelgenStage", "v0.6-runtime-emission", "string"),
      prop("levelSpecVersion", semantic.version, "int"),
      prop("levelSeed", semantic.seed, "int"),
    ],
    tilesets: [
      {
        firstgid: 1,
        image: BLOCKOUT_TILESET,
        tilewidth: tileSize,
        tileheight: tileSize,
        tilecount: 4,
        columns: 4,
        margin: 0,
        spacing: 0,
      },
    ],
    layers,
  };

  // Critical v0.6 contract: generated Tiled data must be consumable by the existing runtime importer.
  const runtimeFloor = floorFromTiledMap(tiledMap);
  const objectLayerCounts = Object.fromEntries(
    layers.filter((layer): layer is TiledObjectLayer => layer.type === "objectgroup" && "objects" in layer)
      .map((layer) => [layer.name, layer.objects.length]),
  );
  const diagnostics = [
    ...events.diagnostics,
    {
      level: "info" as const,
      code: "RUNTIME_TILED_EMISSION_COMPLETE",
      message: `Emitted ${columns}×${rows} runtime map with ${objectLayerCounts.Obstacles ?? 0} obstacle(s), ${objectLayerCounts.Doors ?? 0} door(s), ${objectLayerCounts.CompilerProps ?? 0} prop(s), ${objectLayerCounts.Encounters ?? 0} encounter actor(s), ${objectLayerCounts.Triggers ?? 0} trigger(s) and ${objectLayerCounts.Events ?? 0} event(s).`,
    },
  ];

  return { events, tileSize, wallCollisionPx, tiledMap, runtimeFloor, objectLayerCounts, diagnostics };
}

/** One-call compiler entry point for the complete v0.6 authoring pipeline. */
export function compileRuntimeLevel(spec: LevelSpec, propRegistry: PropRegistry): RuntimeEmissionPlan {
  const semantic = compileLevelSpec(spec, propRegistry);
  const geometry = compileLevelGeometry(semantic);
  const navigation = compileLevelNavigationV031(geometry);
  const props = compileOrientedPropPlacement(navigation);
  const actors = compileActorPlacement(props);
  const events = compileTriggerEvents(actors);
  return emitRuntimeLevel(events, spec.runtime);
}
