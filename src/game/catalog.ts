import type { MathMode, RobotBody } from "./types";

export const PLAYER_NAMES = ["Finn", "Klaus", "Ines", "Gast"] as const;
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

export const MODE_TO_TARGET: Record<MathMode, number> = {
  "add-easy": 6,
  "add-normal": 8,
  "add-hard": 10,
  subtract: 8,
};
