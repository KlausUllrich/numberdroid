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
};

export type EnergyStationDefinition = Point & {
  id: string;
  energy: number;
  label: string;
};

export type FloorDefinition = {
  id: string;
  name: string;
  subtitle: string;
  width: number;
  height: number;
  backgroundAsset: string;
  start: Point & {
    facing: number;
    bodyId: BodyId;
    metaEnergy: number;
  };
  objectives: {
    default: string;
    afterEnergy: string;
  };
  walkable: Rect[];
  obstacles: Rect[];
  energyStations: EnergyStationDefinition[];
  encounters: EncounterConfig[];
};

export type MetaState = {
  version: 2;
  x: number;
  y: number;
  facing: number;
  metaEnergy: number;
  stationUsed: boolean;
  currentBody: BodyId;
  defeated: EnemyId[];
  pilotIndex: number;
  playerCount: number;
  damageTaken: number;
};

export type BattleResult = {
  outcome: "win" | "loss";
  remainingMetaEnergy: number;
};
