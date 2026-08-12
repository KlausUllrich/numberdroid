import type {
  BodyId,
  Difficulty,
  DoorDefinition,
  EncounterBehaviorKind,
  EncounterConfig,
  EnergyStationDefinition,
  EnemyId,
  FloorActionDefinition,
  FloorDefinition,
  MathMode,
  PickupDefinition,
  Point,
  Rect,
  RobotDeckSize,
  RoomDefinition,
  TileLayerDefinition,
  TileMapVisualDefinition,
  TilesetDefinition,
} from "./types";

type TiledProperty = {
  name: string;
  type?: string;
  value: unknown;
};

type TiledTileLayer = {
  id: number;
  name: string;
  type: "tilelayer";
  width: number;
  height: number;
  data: number[] | string;
  opacity?: number;
  visible?: boolean;
};

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

type TiledOtherLayer = {
  id: number;
  name: string;
  type: string;
};

type TiledLayer = TiledTileLayer | TiledObjectLayer | TiledOtherLayer;

type TiledTileset = {
  firstgid: number;
  source?: string;
  image?: string;
  tilewidth?: number;
  tileheight?: number;
  tilecount?: number;
  columns?: number;
  margin?: number;
  spacing?: number;
};

export type TiledMapJson = {
  orientation: string;
  infinite?: boolean;
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
  tilesets: TiledTileset[];
  properties?: TiledProperty[];
};

type TiledVisualOptions = {
  resolveAsset?: (path: string) => string;
};

const ENEMY_IDS: EnemyId[] = ["sentry", "magnetar", "kronos"];
const BODY_IDS: BodyId[] = ["pico", "sentry", "magnetar", "kronos"];
const MATH_MODES: MathMode[] = ["add-easy", "add-normal", "add-hard", "subtract"];
const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const ENCOUNTER_BEHAVIORS: EncounterBehaviorKind[] = ["neutral", "guard", "patrol", "aggressive"];
const DOOR_ORIENTATIONS: DoorDefinition["orientation"][] = ["vertical", "horizontal"];
const DOOR_MODES: DoorDefinition["mode"][] = ["auto", "locked"];
const DOOR_SIZES: DoorDefinition["size"][] = ["standard", "large"];
const ROBOT_DECK_SIZES: RobotDeckSize[] = ["standard", "large"];

function isTileLayer(layer: TiledLayer): layer is TiledTileLayer {
  return layer.type === "tilelayer";
}

function isObjectLayer(layer: TiledLayer): layer is TiledObjectLayer {
  return layer.type === "objectgroup" && Array.isArray((layer as TiledObjectLayer).objects);
}

function property(properties: TiledProperty[] | undefined, name: string): unknown {
  return properties?.find((entry) => entry.name === name)?.value;
}

function requiredString(properties: TiledProperty[] | undefined, name: string, context: string): string {
  const value = property(properties, name);
  if (typeof value !== "string" || !value.trim()) throw new Error(`${context} requires string property ${name}.`);
  return value;
}

function optionalString(properties: TiledProperty[] | undefined, name: string, fallback: string): string {
  const value = property(properties, name);
  return typeof value === "string" && value.trim() ? value : fallback;
}

function optionalStringValue(properties: TiledProperty[] | undefined, name: string): string | undefined {
  const value = property(properties, name);
  return typeof value === "string" && value.trim() ? value : undefined;
}

function optionalNumber(properties: TiledProperty[] | undefined, name: string, fallback: number): number {
  const value = property(properties, name);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function optionalBoolean(properties: TiledProperty[] | undefined, name: string, fallback = false): boolean {
  const value = property(properties, name);
  return typeof value === "boolean" ? value : fallback;
}

function requiredEnum<T extends string>(
  properties: TiledProperty[] | undefined,
  name: string,
  allowed: readonly T[],
  context: string,
): T {
  const value = requiredString(properties, name, context);
  if (!allowed.includes(value as T)) throw new Error(`${context} has invalid ${name}: ${value}.`);
  return value as T;
}

function optionalEnum<T extends string>(
  properties: TiledProperty[] | undefined,
  name: string,
  allowed: readonly T[],
  fallback: T,
  context: string,
): T {
  const value = optionalString(properties, name, fallback);
  if (!allowed.includes(value as T)) throw new Error(`${context} has invalid ${name}: ${value}.`);
  return value as T;
}

function optionalPointPath(properties: TiledProperty[] | undefined, name: string, context: string): Point[] {
  const value = property(properties, name);
  if (value === undefined || value === null || value === "") return [];
  if (typeof value !== "string") throw new Error(`${context} property ${name} must be a string of x,y pairs.`);
  return value.split(";").filter(Boolean).map((entry, index) => {
    const [xText, yText] = entry.split(",");
    const x = Number(xText);
    const y = Number(yText);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`${context} has invalid ${name} point ${index + 1}: ${entry}.`);
    }
    return { x, y };
  });
}

function objectLayer(map: TiledMapJson, name: string): TiledObjectLayer | null {
  const normalized = name.toLowerCase();
  return map.layers.find((layer): layer is TiledObjectLayer => isObjectLayer(layer) && layer.name.toLowerCase() === normalized) ?? null;
}

function objectRect(object: TiledObject, context: string): Rect {
  const width = object.width ?? 0;
  const height = object.height ?? 0;
  if (width <= 0 || height <= 0) throw new Error(`${context} must be a rectangle with width and height.`);
  return { x: object.x, y: object.y, w: width, h: height };
}

export function visualFromTiledMap(map: TiledMapJson, options: TiledVisualOptions = {}): TileMapVisualDefinition {
  if (map.orientation !== "orthogonal") {
    throw new Error(`Numberdroid supports orthogonal Tiled maps only; got ${map.orientation}.`);
  }
  if (map.infinite) {
    throw new Error("Numberdroid VS2 currently expects a finite Tiled map export.");
  }

  const resolveAsset = options.resolveAsset ?? ((path: string) => path);
  const tilesets: TilesetDefinition[] = map.tilesets.map((tileset) => {
    if (tileset.source) {
      throw new Error(`External Tiled tileset ${tileset.source} must be embedded before export.`);
    }
    if (!tileset.image || !tileset.tilewidth || !tileset.tileheight || !tileset.columns || !tileset.tilecount) {
      throw new Error("Tiled tilesets must include image, tile dimensions, columns and tilecount.");
    }
    return {
      firstGid: tileset.firstgid,
      asset: resolveAsset(tileset.image),
      tileWidth: tileset.tilewidth,
      tileHeight: tileset.tileheight,
      columns: tileset.columns,
      tileCount: tileset.tilecount,
      margin: tileset.margin ?? 0,
      spacing: tileset.spacing ?? 0,
    };
  });

  const layers: TileLayerDefinition[] = map.layers.filter(isTileLayer).map((layer) => {
    if (!Array.isArray(layer.data)) {
      throw new Error(`Tile layer ${layer.name} must use an uncompressed JSON array.`);
    }
    if (layer.data.length !== layer.width * layer.height) {
      throw new Error(`Tile layer ${layer.name} has ${layer.data.length} cells; expected ${layer.width * layer.height}.`);
    }
    return {
      id: String(layer.id),
      name: layer.name,
      width: layer.width,
      height: layer.height,
      data: layer.data,
      opacity: layer.opacity ?? 1,
      visible: layer.visible ?? true,
    };
  });

  return {
    kind: "tilemap",
    columns: map.width,
    rows: map.height,
    tileWidth: map.tilewidth,
    tileHeight: map.tileheight,
    tilesets,
    layers,
  };
}

function parseStations(map: TiledMapJson): EnergyStationDefinition[] {
  const layer = objectLayer(map, "EnergyStations");
  if (!layer) return [];
  return layer.objects.map((object) => {
    const energy = Math.max(1, Math.floor(optionalNumber(object.properties, "energy", 1)));
    return {
      id: object.name?.trim() || `station-${object.id}`,
      x: object.x,
      y: object.y,
      energy,
      label: optionalString(object.properties, "label", `ENERGIE ⚡ +${energy}`),
    };
  });
}

function parsePickups(map: TiledMapJson): PickupDefinition[] {
  const layer = objectLayer(map, "Pickups");
  if (!layer) return [];
  return layer.objects.map((object) => {
    const context = `Pickup ${object.name || object.id}`;
    return {
      id: object.name?.trim() || `pickup-${object.id}`,
      kind: "access-key",
      keyId: requiredString(object.properties, "keyId", context),
      label: optionalString(object.properties, "label", "ZUGANGSKARTE"),
      x: object.x,
      y: object.y,
    };
  });
}

function parseRooms(map: TiledMapJson): RoomDefinition[] {
  const layer = objectLayer(map, "Rooms");
  if (!layer) return [];
  return layer.objects.map((object) => {
    const context = `Room ${object.name || object.id}`;
    return {
      id: object.name?.trim() || `room-${object.id}`,
      ...objectRect(object, context),
      label: optionalString(object.properties, "label", object.name?.trim() || "SCHIFFSSEKTION"),
      subtitle: optionalStringValue(object.properties, "subtitle"),
    };
  });
}

function parseActions(map: TiledMapJson): FloorActionDefinition[] {
  const layer = objectLayer(map, "Actions");
  if (!layer) return [];
  return layer.objects.map((object) => {
    const context = `Action ${object.name || object.id}`;
    return {
      id: object.name?.trim() || `action-${object.id}`,
      kind: "deck-console",
      x: object.x,
      y: object.y,
      label: optionalString(object.properties, "label", "HAUPTKONSOLE"),
      prompt: requiredString(object.properties, "prompt", context),
      completionLabel: requiredString(object.properties, "completionLabel", context),
      requiresEncounterId: optionalStringValue(object.properties, "requiresEncounterId"),
    };
  });
}

function parseDoors(map: TiledMapJson): DoorDefinition[] {
  const layer = objectLayer(map, "Doors");
  if (!layer) return [];
  return layer.objects.map((object) => {
    const context = `Door ${object.name || object.id}`;
    const rect = objectRect(object, context);
    const mode = optionalEnum(object.properties, "mode", DOOR_MODES, "auto", context);
    const keyId = optionalStringValue(object.properties, "keyId");
    if (mode === "locked" && !keyId) throw new Error(`${context} requires keyId when mode is locked.`);
    return {
      id: object.name?.trim() || `door-${object.id}`,
      ...rect,
      orientation: requiredEnum(object.properties, "orientation", DOOR_ORIENTATIONS, context),
      mode,
      size: optionalEnum(object.properties, "size", DOOR_SIZES, "standard", context),
      openRadius: Math.max(72, optionalNumber(object.properties, "openRadius", 118)),
      keyId,
      label: optionalStringValue(object.properties, "label"),
    };
  });
}

function parseEncounters(map: TiledMapJson): EncounterConfig[] {
  const layer = objectLayer(map, "Encounters");
  if (!layer) return [];
  return layer.objects.map((object) => {
    const context = `Encounter ${object.name || object.id}`;
    const enemyId = requiredEnum(object.properties, "enemyId", ENEMY_IDS, context);
    const bodyId = requiredEnum(object.properties, "bodyId", BODY_IDS, context);
    const mode = requiredEnum(object.properties, "mode", MATH_MODES, context);
    const difficulty = requiredEnum(object.properties, "difficulty", DIFFICULTIES, context);
    const name = object.name?.trim() || requiredString(object.properties, "name", context);
    const accessKeyId = optionalStringValue(object.properties, "accessKeyId");
    const behaviorValue = optionalStringValue(object.properties, "behavior");
    const behaviorKind = behaviorValue
      ? (ENCOUNTER_BEHAVIORS.includes(behaviorValue as EncounterBehaviorKind) ? behaviorValue as EncounterBehaviorKind : null)
      : null;
    if (behaviorValue && !behaviorKind) throw new Error(`${context} has invalid behavior: ${behaviorValue}.`);

    const interceptRadius = Math.max(72, optionalNumber(object.properties, "interceptRadius", 104));
    const detectionRadius = Math.max(interceptRadius, optionalNumber(object.properties, "detectionRadius", behaviorKind === "aggressive" ? 250 : interceptRadius));
    const loseRadius = Math.max(detectionRadius + 32, optionalNumber(object.properties, "loseRadius", detectionRadius + 120));
    const patrolPath = optionalPointPath(object.properties, "patrolPath", context);
    if (behaviorKind === "patrol" && patrolPath.length < 2) {
      throw new Error(`${context} patrol behavior requires at least two patrolPath points.`);
    }

    return {
      encounterId: optionalString(object.properties, "encounterId", `encounter-${object.id}`),
      enemyId,
      name,
      x: object.x,
      y: object.y,
      mode,
      mathLabel: requiredString(object.properties, "mathLabel", context),
      difficulty,
      difficultyLabel: optionalString(
        object.properties,
        "difficultyLabel",
        difficulty === "easy" ? "LEICHT" : difficulty === "medium" ? "MITTEL" : "STARK",
      ),
      bodyId,
      rewardLabel: optionalString(object.properties, "rewardLabel", `SIEG → ${name} ÜBERNEHMEN`),
      retreat: {
        x: optionalNumber(object.properties, "retreatX", object.x),
        y: optionalNumber(object.properties, "retreatY", object.y),
      },
      boss: optionalBoolean(object.properties, "boss"),
      storyIntro: optionalStringValue(object.properties, "storyIntro"),
      deckSize: optionalEnum(object.properties, "deckSize", ROBOT_DECK_SIZES, "standard", context),
      accessKey: accessKeyId ? {
        keyId: accessKeyId,
        label: optionalString(object.properties, "accessKeyLabel", "ZUGANGSKARTE"),
      } : undefined,
      duelLayers: Math.max(1, Math.floor(optionalNumber(object.properties, "duelLayers", 1))),
      behavior: behaviorKind ? {
        kind: behaviorKind,
        interceptRadius,
        detectionRadius,
        loseRadius,
        patrolSpeed: Math.max(24, optionalNumber(object.properties, "patrolSpeed", behaviorKind === "patrol" ? 72 : behaviorKind === "neutral" ? 54 : 24)),
        chaseSpeed: Math.max(40, optionalNumber(object.properties, "chaseSpeed", 128)),
        chaseAcceleration: Math.max(20, optionalNumber(
          object.properties,
          "chaseAcceleration",
          behaviorKind === "guard" ? 160 : behaviorKind === "aggressive" ? 220 : 120,
        )),
        forcedEngagement: behaviorKind === "neutral" ? false : optionalBoolean(object.properties, "forcedEngagement", false),
        patrolPath,
      } : undefined,
    };
  });
}

export function floorFromTiledMap(map: TiledMapJson, options: TiledVisualOptions = {}): FloorDefinition {
  const startLayer = objectLayer(map, "Start");
  const startObject = startLayer?.objects[0];
  if (!startObject) throw new Error("Tiled floor requires one object in layer Start.");

  const walkableLayer = objectLayer(map, "Walkable");
  if (!walkableLayer?.objects.length) throw new Error("Tiled floor requires at least one rectangle in layer Walkable.");
  const obstaclesLayer = objectLayer(map, "Obstacles");

  const floorId = requiredString(map.properties, "floorId", "Tiled map");
  const encounters = parseEncounters(map);
  const actions = parseActions(map);
  const goalEncounterId = optionalStringValue(map.properties, "goalEncounterId");
  const goalActionId = optionalStringValue(map.properties, "goalActionId");
  if (goalEncounterId && !encounters.some((encounter) => encounter.encounterId === goalEncounterId)) {
    throw new Error(`Tiled floor ${floorId} references unknown goal encounter ${goalEncounterId}.`);
  }
  if (goalActionId && !actions.some((action) => action.id === goalActionId)) {
    throw new Error(`Tiled floor ${floorId} references unknown goal action ${goalActionId}.`);
  }

  return {
    id: floorId,
    name: requiredString(map.properties, "floorName", `Floor ${floorId}`),
    subtitle: optionalString(map.properties, "subtitle", "VERTICAL SLICE 2"),
    width: map.width * map.tilewidth,
    height: map.height * map.tileheight,
    visual: visualFromTiledMap(map, options),
    start: {
      x: startObject.x,
      y: startObject.y,
      facing: optionalNumber(startObject.properties, "facing", 0),
      bodyId: requiredEnum(startObject.properties, "bodyId", BODY_IDS, "Start object"),
      metaEnergy: Math.max(0, Math.floor(optionalNumber(startObject.properties, "metaEnergy", 0))),
    },
    objectives: {
      default: requiredString(map.properties, "objectiveDefault", `Floor ${floorId}`),
      afterEnergy: requiredString(map.properties, "objectiveAfterEnergy", `Floor ${floorId}`),
    },
    goal: goalActionId ? {
      kind: "complete-action",
      actionId: goalActionId,
      label: requiredString(map.properties, "goalLabel", `Floor ${floorId} goal`),
      readyLabel: requiredString(map.properties, "goalReadyLabel", `Floor ${floorId} goal ready`),
      completedLabel: requiredString(map.properties, "goalCompletedLabel", `Floor ${floorId} goal complete`),
    } : goalEncounterId ? {
      kind: "defeat-encounter",
      encounterId: goalEncounterId,
      label: requiredString(map.properties, "goalLabel", `Floor ${floorId} goal`),
      completedLabel: requiredString(map.properties, "goalCompletedLabel", `Floor ${floorId} goal`),
    } : undefined,
    walkable: walkableLayer.objects.map((object) => objectRect(object, `Walkable ${object.id}`)),
    obstacles: obstaclesLayer?.objects.map((object) => objectRect(object, `Obstacle ${object.id}`)) ?? [],
    rooms: parseRooms(map),
    doors: parseDoors(map),
    pickups: parsePickups(map),
    actions,
    energyStations: parseStations(map),
    encounters,
  };
}
