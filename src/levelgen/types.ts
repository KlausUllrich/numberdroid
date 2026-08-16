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

export type TileRange = {
  min: number;
  preferred: number;
  max: number;
};

export type SpaceSizeSpec = {
  class: SpaceSizeClass;
  width?: TileRange;
  height?: TileRange;
};

export type RelativeRelation =
  | "adjacent"
  | "north_of"
  | "south_of"
  | "east_of"
  | "west_of"
  | "north_east_of"
  | "north_west_of"
  | "south_east_of"
  | "south_west_of";

export type SpatialRelationSpec = {
  targetId: string;
  relation: RelativeRelation;
  strength?: ConstraintStrength;
};

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

export type DoorClearanceSpec = {
  before: number;
  after: number;
};

export type DoorLockSpec =
  | { mode: "none" }
  | { mode: "access-key"; keyId: string };

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

export type RouteSpec = {
  id: string;
  kind: "patrol" | "passby" | "scripted";
  spaceIds: string[];
  loop?: boolean;
  tags?: string[];
};

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

export type AccessPickupSpec = {
  id: string;
  kind: "access-key";
  keyId: string;
  spaceId: string;
  propId?: string;
  label?: string;
};

export type TriggerKind =
  | "enter-space"
  | "enter-zone"
  | "interact"
  | "collect"
  | "state-change"
  | "proximity"
  | "timer";

export type TriggerSpec = {
  id: string;
  kind: TriggerKind;
  sourceId: string;
  eventIds: string[];
  once?: boolean;
  delayMs?: number;
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

export type PlacementOverride = {
  targetId: string;
  lockGeometry?: boolean;
  lockPlacement?: boolean;
  offsetTiles?: { x: number; y: number };
  preferredSide?: CardinalDirection;
  preferredWall?: CardinalDirection;
  size?: Partial<SpaceSizeSpec>;
};

export type LevelRuleConfig = {
  ensureReachability: boolean;
  singleSharedWall: boolean;
  doorsEmbeddedInWalls: boolean;
  defaultCorridorWidth: TileRange;
  defaultDoorClearance: DoorClearanceSpec;
};

export type LevelSpec = {
  id: string;
  version: number;
  seed: LevelSeed;
  ruleSetRefs: string[];
  rules: LevelRuleConfig;
  spaces: LevelSpaceSpec[];
  connections: ConnectionSpec[];
  props: PropRequestSpec[];
  encounters: EncounterIntentSpec[];
  routes?: RouteSpec[];
  pickups?: AccessPickupSpec[];
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
  forbidDoorClearance?: boolean;
  forbidPrimaryPath?: boolean;
  forbidInFrontOfWallProp?: boolean;
  preferOppositeDoor?: boolean;
};

export type PropMetadata = {
  id: string;
  tags: string[];
  attachment: PropAttachment;
  footprintTiles: { w: number; h: number };
  placement: PropPlacementMetadata;
};

export type PropRegistry = Readonly<Record<string, PropMetadata>>;

export type CompileDiagnostic = {
  level: "info" | "warning";
  code: string;
  message: string;
  targetId?: string;
};

export type CompiledSemanticSpace = LevelSpaceSpec & {
  seed: number;
};

export type CompiledConnection = ConnectionSpec & {
  seed: number;
  widthTiles: number;
  clearanceTiles: DoorClearanceSpec;
  lock: DoorLockSpec;
};

export type CompiledPropRequest = PropRequestSpec & {
  seed: number;
  quantity: number;
  required: boolean;
  metadata: PropMetadata;
};

export type CompiledEncounterIntent = EncounterIntentSpec & {
  seed: number;
};

export type SemanticCompilePlan = {
  levelId: string;
  version: number;
  seed: number;
  ruleSetRefs: string[];
  rules: LevelRuleConfig;
  spaces: CompiledSemanticSpace[];
  connections: CompiledConnection[];
  props: CompiledPropRequest[];
  encounters: CompiledEncounterIntent[];
  routes: RouteSpec[];
  pickups: AccessPickupSpec[];
  triggers: TriggerSpec[];
  events: LevelEventSpec[];
  overrides: PlacementOverride[];
  diagnostics: CompileDiagnostic[];
};
