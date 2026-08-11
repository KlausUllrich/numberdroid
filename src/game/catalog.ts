import type { MathMode, RobotBody, RobotDeckSize } from "./types";

export const PLAYER_NAMES = ["Finn", "Klaus", "Ines", "Gast"] as const;
export const MAX_META_ENERGY = 3;
export const STARTING_HP = 3;

export const ROBOT_DECK_METRICS: Record<RobotDeckSize, { spriteSize: number; collisionRadius: number }> = {
  standard: { spriteSize: 52, collisionRadius: 18 },
  large: { spriteSize: 96, collisionRadius: 38 },
};

export function robotCollisionRadius(size: RobotDeckSize) {
  return ROBOT_DECK_METRICS[size].collisionRadius;
}

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

export const MODE_TO_TARGET: Record<MathMode, number> = {
  "add-easy": 6,
  "add-normal": 8,
  "add-hard": 10,
  subtract: 8,
};
