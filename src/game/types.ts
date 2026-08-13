export type BodyId = "pico" | "sentry" | "magnetar" | "kronos";
export type EnemyId = "sentry" | "magnetar" | "kronos";
export type MathMode = "add-easy" | "add-normal" | "add-hard" | "subtract";
export type MathRole = "comfort" | "core" | "stretch" | "specialist" | "boss";
export type Difficulty = "easy" | "medium" | "hard";
export type Operation = "add" | "subtract";
export type GameScreen = "deck" | "encounter" | "duel" | "transfer" | "destroyed";
export type RobotDeckSize = "standard" | "large";
export type EncounterBehaviorKind = "neutral" | "guard" | "patrol" | "aggressive";

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };

export type DuelMathConfig = {
  label: string;
  short: string;
  operation: Operation;
  symbol: "+" | "−";
  target: number;
  maxValue: number;
  pool: number[];
};

export type RobotDriveProfile = {
  label: string;
  maxSpeed: number;
  acceleration: number;
  deceleration: number;
  turnSpeed: number;
};

export type RobotBody = {
  id: BodyId;
  name: string;
  bodyClass: string;
  roleLabel: string;
  roleDescription: string;
  abilityId: "row-shift-right" | null;
  abilityLabel: string;
  abilityDescription: string;
  drive: RobotDriveProfile;
  sprite: string;
  directionalSprite: string;
};

export type EncounterAccessKey = {
  keyId: string;
  label: string;
};

export type EncounterBehavior = {
  kind: EncounterBehaviorKind;
  interceptRadius: number;
  detectionRadius: number;
  loseRadius: number;
  patrolSpeed: number;
  chaseSpeed: number;
  chaseAcceleration: number;
  forcedEngagement: boolean;
  patrolPath: Point[];
  viewAngle: number;
  searchDurationMs: number;
};

export type EncounterConfig = {
  encounterId: string;
  enemyId: EnemyId;
  name: string;
  x: number;
  y: number;
  facing?: number;
  mode: MathMode;
  mathLabel: string;
  mathRole?: MathRole;
  mathConfig?: DuelMathConfig;
  difficulty: Difficulty;
  difficultyLabel: string;
  bodyId: BodyId;
  rewardLabel: string;
  retreat: Point;
  boss?: boolean;
  storyIntro?: string;
  deckSize?: RobotDeckSize;
  accessKey?: EncounterAccessKey;
  duelLayers?: number;
  behavior?: EncounterBehavior;
};

export type EnergyStationDefinition = Point & {
  id: string;
  energy: number;
  label: string;
};

export type PickupDefinition = Point & {
  id: string;
  kind: "access-key";
  keyId: string;
  label: string;
};

export type DoorDefinition = Rect & {
  id: string;
  orientation: "vertical" | "horizontal";
  mode: "auto" | "locked";
  size: "standard" | "large";
  openRadius: number;
  keyId?: string;
  label?: string;
};

export type RoomDefinition = Rect & {
  id: string;
  label: string;
  subtitle?: string;
};

export type FloorActionDefinition = Point & {
  id: string;
  kind: "deck-console";
  label: string;
  prompt: string;
  completionLabel: string;
  requiresEncounterId?: string;
};

export type ImageFloorVisualDefinition = {
  kind: "image";
  asset: string;
};

export type TilesetDefinition = {
  firstGid: number;
  asset: string;
  tileWidth: number;
  tileHeight: number;
  columns: number;
  tileCount: number;
  margin: number;
  spacing: number;
};

export type TileLayerDefinition = {
  id: string;
  name: string;
  width: number;
  height: number;
  data: number[];
  opacity?: number;
  visible?: boolean;
};

export type TileMapVisualDefinition = {
  kind: "tilemap";
  columns: number;
  rows: number;
  tileWidth: number;
  tileHeight: number;
  tilesets: TilesetDefinition[];
  layers: TileLayerDefinition[];
};

export type FloorVisualDefinition = ImageFloorVisualDefinition | TileMapVisualDefinition;

export type FloorGoalDefinition =
  | {
      kind: "defeat-encounter";
      encounterId: string;
      label: string;
      completedLabel: string;
    }
  | {
      kind: "complete-action";
      actionId: string;
      label: string;
      readyLabel: string;
      completedLabel: string;
    };

export type FloorDefinition = {
  id: string;
  name: string;
  subtitle: string;
  width: number;
  height: number;
  visual: FloorVisualDefinition;
  start: Point & {
    facing: number;
    bodyId: BodyId;
    metaEnergy: number;
  };
  objectives: {
    default: string;
    afterEnergy: string;
  };
  goal?: FloorGoalDefinition;
  walkable: Rect[];
  obstacles: Rect[];
  rooms: RoomDefinition[];
  doors: DoorDefinition[];
  pickups: PickupDefinition[];
  actions: FloorActionDefinition[];
  energyStations: EnergyStationDefinition[];
  encounters: EncounterConfig[];
};

export type MetaState = {
  version: 3;
  floorId: string;
  x: number;
  y: number;
  facing: number;
  metaEnergy: number;
  usedStationIds: string[];
  collectedPickupIds: string[];
  accessKeyIds: string[];
  completedActionIds: string[];
  currentBody: BodyId;
  currentDeckSize: RobotDeckSize;
  defeatedEncounterIds: string[];
  pilotIndex: number;
  playerCount: number;
  damageTaken: number;
};

export type BattleResult = {
  outcome: "win" | "loss";
  remainingMetaEnergy: number;
};