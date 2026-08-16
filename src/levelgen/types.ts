import type {
  BodyId,
  Difficulty,
  EncounterBehaviorKind,
  EnemyId,
  MathMode,
  MathRole,
} from "../game/types";

export type LevelSeed = string | number;
export type ConstraintStrength = "required" | "preferred";
export type CardinalDirection = "north" | "south" | "east" | "west";
export type OrientationPreference = "horizontal" | "vertical" | "any";
export type SpaceSizeClass = "tiny" | "small" | "medium" | "large" | "hero";
export type RoomRationality = "domestic" | "neutral" | "ritual" | "system";
export type PropRotation = 0 | 90 | 180 | 270;

export type TileRange = { min: number; preferred: number; max: number };
export type SpaceSizeSpec = { class: SpaceSizeClass; width?: TileRange; height?: TileRange };

export type RelativeRelation =
  | "adjacent" | "north_of" | "south_of" | "east_of" | "west_of"
  | "north_east_of" | "north_west_of" | "south_east_of" | "south_west_of";

export type SpatialRelationSpec = { targetId: string; relation: RelativeRelation; strength?: ConstraintStrength };

export type RoomSpaceSpec = {
  id: string;
  kind: "room";
  archetype: string;
  tags?: string[];
  rationality?: RoomRationality;
  size: SpaceSizeSpec;
  relations?: SpatialRelationSpec[];
};

export type CorridorSpaceSpec = {
  id: string;
  kind: "corridor";
  archetype?: string;
  tags?: string[];
  width: TileRange;
  length?: TileRange;
  orientation?: OrientationPreference;
  relations?: SpatialRelationSpec[];
};

export type LevelSpaceSpec = RoomSpaceSpec | CorridorSpaceSpec;
export type DoorClearanceSpec = { before: number; after: number };
export type DoorLockSpec = { mode: "none" } | { mode: "access-key"; keyId: string };
export type ConnectionKind = "opening" | "standard-door" | "controlled-door";

export type ConnectionSpec = {
  id: string;
  from: string;
  to: string;
  kind: ConnectionKind;
  widthTiles?: number;
  preferredSide?: CardinalDirection;
  clearanceTiles?: DoorClearanceSpec;
  lock?: DoorLockSpec;
};

export type PropPlacementRole = "hero" | "support" | "furniture" | "dressing";
export type PropRequestSpec = {
  id: string;
  propId: string;
  spaceId: string;
  role?: PropPlacementRole;
  quantity?: number;
  required?: boolean;
  near?: string[];
  preferredWall?: CardinalDirection;
};

export type RouteKind = "patrol" | "passby" | "scripted";
export type RouteSpec = { id: string; kind: RouteKind; spaceIds: string[]; loop?: boolean; tags?: string[] };

export type EncounterIntentSpec = {
  id: string;
  spaceId: string;
  enemyId: EnemyId;
  bodyId: BodyId;
  behavior: EncounterBehaviorKind;
  mode: MathMode;
  mathLabel: string;
  mathRole?: MathRole;
  difficulty: Difficulty;
  boss?: boolean;
  tags?: string[];
  preferredWall?: CardinalDirection;
  avoidDoorClearance?: boolean;
  patrolRouteId?: string;
};

/**
 * A non-encounter actor that may be spawned/moved only by scripted events.
 * This is intentionally separate from EncounterIntentSpec so a Bio-Ark animal,
 * maintenance vehicle, crowd extra, etc. does not need fake combat metadata.
 */
export type StagedActorSpec = {
  id: string;
  actorType: string;
  tags?: string[];
  initiallyPresent?: boolean;
  defaultSpaceId?: string;
};

export type AccessPickupSpec = {
  id: string;
  kind: "access-key";
  keyId: string;
  spaceId: string;
  propId?: string;
  label?: string;
};

export type TriggerZoneAnchor =
  | { kind: "space-center" }
  | { kind: "connection"; targetId: string }
  | { kind: "prop"; targetId: string }
  | { kind: "actor"; targetId: string }
  | { kind: "route"; targetId: string; position?: "start" | "middle" | "end" }
  | { kind: "pickup"; targetId: string };

/**
 * Semantic trigger region. Geometry is derived after Props/Actors exist; no raw
 * map coordinate is persisted in the authored LevelSpec.
 */
export type TriggerZoneSpec = {
  id: string;
  spaceId: string;
  anchor: TriggerZoneAnchor;
  sizeTiles?: { w: number; h: number };
  tags?: string[];
};

export type TriggerKind = "enter-space" | "enter-zone" | "interact" | "collect" | "state-change" | "proximity" | "timer";
export type TriggerSpec = {
  id: string;
  kind: TriggerKind;
  sourceId: string;
  eventIds: string[];
  once?: boolean;
  delayMs?: number;
  /** Used by proximity triggers; defaults to two tiles in v0.5. */
  radiusTiles?: number;
};

export type LevelEventSpec =
  | { id: string; kind: "set-flag"; flag: string; value: boolean | number | string }
  | { id: string; kind: "grant-key"; keyId: string }
  | { id: string; kind: "unlock-door"; doorId: string }
  | { id: string; kind: "lock-door"; doorId: string }
  | { id: string; kind: "spawn-actor"; actorId: string; spaceId: string }
  | { id: string; kind: "despawn-actor"; actorId: string }
  | { id: string; kind: "move-actor"; actorId: string; routeId: string }
  | { id: string; kind: "actor-passby"; actorId: string; routeId: string; durationMs?: number }
  | { id: string; kind: "story-beat"; beatId: string; blocking?: boolean };

/**
 * A Workbench geometry lock is stored relative to the semantic root Space, not
 * in runtime pixels. Normalizing the exported Floor therefore cannot move the
 * locked Space relative to the rest of the authored topology.
 */
export type LockedGeometryOverride = {
  offsetFromRootTiles: { x: number; y: number };
  sizeTiles: { w: number; h: number };
};

/**
 * A Prop placement lock is stored relative to its containing semantic Space.
 * This allows the Space itself to move while preserving the deliberate local
 * art-director placement.
 */
export type LockedPropPlacementOverride = {
  offsetTiles: { x: number; y: number };
  rotation: PropRotation;
  wallSide?: CardinalDirection | null;
};

export type PlacementOverride = {
  targetId: string;
  /** Locks a Space to lockedGeometry during topology search. */
  lockGeometry?: boolean;
  lockedGeometry?: LockedGeometryOverride;
  /** Locks a Prop request/instance to lockedPlacement during placement solve. */
  lockPlacement?: boolean;
  lockedPlacement?: LockedPropPlacementOverride;
  /** Explicit post-solve Space offset retained for simple/manual nudges. */
  offsetTiles?: { x: number; y: number };
  /** Connection-side preference override. */
  preferredSide?: CardinalDirection;
  /** Prop wall preference override. */
  preferredWall?: CardinalDirection;
  /** Explicit room size override. */
  size?: Partial<SpaceSizeSpec>;
  /** Local deterministic variation. Incrementing this never changes unrelated semantic seeds. */
  seedSalt?: number;
};

export type LevelRuleConfig = {
  ensureReachability: boolean;
  singleSharedWall: boolean;
  doorsEmbeddedInWalls: boolean;
  defaultCorridorWidth: TileRange;
  defaultDoorClearance: DoorClearanceSpec;
};

/** Runtime-facing metadata is deliberately small. Spatial content still comes from semantic compilation. */
export type LevelRuntimeSpec = {
  /** Runtime/Tiled tile size. Numberdroid currently uses 64 px. */
  tileSize?: number;
  /** Collision-core thickness for emitted wall obstacles. */
  wallCollisionPx?: number;
  floorName?: string;
  subtitle?: string;
  objectiveDefault?: string;
  objectiveAfterEnergy?: string;
  start?: {
    /** Start is resolved to a valid free cell in this semantic Space. */
    spaceId?: string;
    bodyId?: BodyId;
    facing?: number;
    metaEnergy?: number;
    preferredSide?: CardinalDirection;
  };
};

export type LevelSpec = {
  id: string;
  version: number;
  seed: LevelSeed;
  ruleSetRefs: string[];
  rules: LevelRuleConfig;
  /** Presentation/start metadata for runtime emission; never raw authored map coordinates. */
  runtime?: LevelRuntimeSpec;
  spaces: LevelSpaceSpec[];
  connections: ConnectionSpec[];
  props: PropRequestSpec[];
  encounters: EncounterIntentSpec[];
  stagedActors?: StagedActorSpec[];
  routes?: RouteSpec[];
  pickups?: AccessPickupSpec[];
  zones?: TriggerZoneSpec[];
  triggers?: TriggerSpec[];
  events?: LevelEventSpec[];
  overrides?: PlacementOverride[];
};

export type PropAttachment = "floor" | "wall" | "either";

export type PropPlacementMetadata = {
  requiredSpaceTags?: string[];
  preferWallAdjacent?: boolean;
  preferCorner?: boolean;
  preferNearTags?: string[];
  preferRoomCenter?: boolean;
  forbidDoorClearance?: boolean;
  forbidPrimaryPath?: boolean;
  forbidInFrontOfWallProp?: boolean;
  preferOppositeDoor?: boolean;
  /** Reserve unobstructed use-space immediately in front of a wall-attached prop. */
  approachDepthTiles?: number;
  /** Reserve a non-furnishable ring around important floor props / hero machinery. */
  clearanceAroundTiles?: number;
};

export type PropMetadata = {
  id: string;
  tags: string[];
  attachment: PropAttachment;
  /** Authored raster/SVG orientation. 0° means north-wall-backed / front-access from south for wall props. */
  allowedRotations: PropRotation[];
  footprintTiles: { w: number; h: number };
  placement: PropPlacementMetadata;
};

export type PropRegistry = Readonly<Record<string, PropMetadata>>;
export type CompileDiagnostic = { level: "info" | "warning"; code: string; message: string; targetId?: string };
export type CompiledSemanticSpace = LevelSpaceSpec & { seed: number };
export type CompiledConnection = ConnectionSpec & { seed: number; widthTiles: number; clearanceTiles: DoorClearanceSpec; lock: DoorLockSpec };
export type CompiledPropRequest = PropRequestSpec & { seed: number; quantity: number; required: boolean; metadata: PropMetadata };
export type CompiledEncounterIntent = EncounterIntentSpec & { seed: number };

export type SemanticCompilePlan = {
  levelId: string;
  version: number;
  seed: number;
  ruleSetRefs: string[];
  rules: LevelRuleConfig;
  runtime?: LevelRuntimeSpec;
  spaces: CompiledSemanticSpace[];
  connections: CompiledConnection[];
  props: CompiledPropRequest[];
  encounters: CompiledEncounterIntent[];
  stagedActors: StagedActorSpec[];
  routes: RouteSpec[];
  pickups: AccessPickupSpec[];
  zones: TriggerZoneSpec[];
  triggers: TriggerSpec[];
  events: LevelEventSpec[];
  overrides: PlacementOverride[];
  diagnostics: CompileDiagnostic[];
};