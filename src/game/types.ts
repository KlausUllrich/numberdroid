export type BodyId = "pico" | "sentry" | "magnetar" | "kronos";
export type EnemyId = "sentry" | "magnetar" | "kronos";
export type MathMode = "add-easy" | "add-normal" | "add-hard" | "subtract";
export type Difficulty = "easy" | "medium" | "hard";
export type Operation = "add" | "subtract";
export type GameScreen = "deck" | "encounter" | "duel" | "transfer" | "destroyed";

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };

export type RobotBody = {
  id: BodyId;
  name: string;
  bodyClass: string;
  abilityId: "row-shift-right" | null;
  abilityLabel: string;
  sprite: string;
};

export type EncounterConfig = {
  encounterId: string;
  enemyId: EnemyId;
  name: string;
  x: number;
  y: number;
  mode: MathMode;
  mathLabel: string;
  difficulty: Difficulty;
  difficultyLabel: string;
  bodyId: BodyId;
  rewardLabel: string;
  retreat: Point;
  boss?: boolean;
  storyIntro?: string;
};

export type EnergyStationDefinition = Point & {
  id: string;
  energy: number;
  label: string;
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

export type FloorGoalDefinition = {
  kind: "defeat-encounter";
  encounterId: string;
  label: string;
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
  currentBody: BodyId;
  defeatedEncounterIds: string[];
  pilotIndex: number;
  playerCount: number;
  damageTaken: number;
};

export type BattleResult = {
  outcome: "win" | "loss";
  remainingMetaEnergy: number;
};
