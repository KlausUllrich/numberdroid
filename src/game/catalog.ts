import type { EncounterConfig, EnemyId, MathMode, Rect, RobotBody } from "./types";

export const PLAYER_NAMES = ["Finn", "Klaus", "Ines", "Gast"] as const;
export const WORLD_W = 1600;
export const WORLD_H = 1000;
export const PLAYER_RADIUS = 24;
export const MAX_META_ENERGY = 3;
export const STARTING_HP = 3;

export const BODIES: Record<RobotBody["id"], RobotBody> = {
  pico: {
    id: "pico",
    name: "PICO-3",
    bodyClass: "BASIS",
    abilityId: null,
    abilityLabel: "KEINE KÖRPERFÄHIGKEIT",
    sprite: "/assets/robots/pico.png",
  },
  sentry: {
    id: "sentry",
    name: "SENTRY-4",
    bodyClass: "SCOUT",
    abilityId: null,
    abilityLabel: "KEINE KÖRPERFÄHIGKEIT",
    sprite: "/assets/robots/sentry.png",
  },
  magnetar: {
    id: "magnetar",
    name: "MAGNETAR 742",
    bodyClass: "UTILITY",
    abilityId: "row-shift-right",
    abilityLabel: "REIHENSCHUB →",
    sprite: "/assets/robots/magnetar.png",
  },
  kronos: {
    id: "kronos",
    name: "KRONOS-9",
    bodyClass: "SCHWER",
    abilityId: null,
    abilityLabel: "FÄHIGKEIT NOCH NICHT FESTGELEGT",
    sprite: "/assets/robots/kronos.png",
  },
};

export const ENCOUNTERS: Record<EnemyId, EncounterConfig> = {
  sentry: {
    enemyId: "sentry",
    name: "SENTRY-4",
    x: 270,
    y: 555,
    mode: "add-easy",
    mathLabel: "+ ZIEL 6",
    difficulty: "easy",
    difficultyLabel: "LEICHT",
    bodyId: "sentry",
    rewardLabel: "SIEG → SENTRY-4 ÜBERNEHMEN",
    retreat: { x: 650, y: 520 },
  },
  magnetar: {
    enemyId: "magnetar",
    name: "MAGNETAR 742",
    x: 1330,
    y: 555,
    mode: "add-normal",
    mathLabel: "+ ZIEL 8",
    difficulty: "medium",
    difficultyLabel: "MITTEL",
    bodyId: "magnetar",
    rewardLabel: "SIEG → MAGNETAR 742 + REIHENSCHUB →",
    retreat: { x: 950, y: 520 },
  },
  kronos: {
    enemyId: "kronos",
    name: "KRONOS-9",
    x: 800,
    y: 210,
    mode: "add-hard",
    mathLabel: "+ ZIEL 10",
    difficulty: "hard",
    difficultyLabel: "STARK",
    bodyId: "kronos",
    rewardLabel: "SIEG → KRONOS-9 ÜBERNEHMEN",
    retreat: { x: 800, y: 455 },
  },
};

export const ENCOUNTER_IDS = Object.keys(ENCOUNTERS) as EnemyId[];

export const WALKABLE: Rect[] = [
  { x: 630, y: 650, w: 340, h: 300 },
  { x: 430, y: 390, w: 740, h: 330 },
  { x: 120, y: 470, w: 420, h: 170 },
  { x: 1060, y: 470, w: 420, h: 170 },
  { x: 690, y: 110, w: 220, h: 340 },
];

export const OBSTACLES: Rect[] = [
  { x: 455, y: 565, w: 140, h: 150 },
  { x: 885, y: 575, w: 150, h: 135 },
  { x: 1020, y: 570, w: 125, h: 130 },
];

export const STATION = { x: 800, y: 585 } as const;

export const MODE_TO_TARGET: Record<MathMode, number> = {
  "add-easy": 6,
  "add-normal": 8,
  "add-hard": 10,
  subtract: 8,
};
