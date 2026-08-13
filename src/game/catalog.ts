import type { BodyId, MathMode, RobotBody, RobotDeckSize } from "./types";
import { publicAsset } from "./assets";
import { PICO_GOLD_DIRECTIONAL } from "./generated/picoGoldDirectional";

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
    roleLabel: "WARTUNGSDROIDE",
    roleDescription: "Kompakter Allzweckkörper. Gut kontrollierbar, aber ohne besondere Kampffunktion.",
    abilityId: null,
    abilityLabel: "KEINE KÖRPERFÄHIGKEIT",
    abilityDescription: "PICO besitzt noch keine aktive Manipulationsfähigkeit für das Zahlenfeld.",
    drive: { label: "AUSGEWOGEN", maxSpeed: 205, acceleration: 900, deceleration: 1250, turnSpeed: 720 },
    sprite: publicAsset("assets/robots/pico.png"),
    directionalSprite: PICO_GOLD_DIRECTIONAL,
  },
  sentry: {
    id: "sentry",
    name: "SENTRY-4",
    bodyClass: "SCOUT",
    roleLabel: "SICHERHEITS-SCOUT",
    roleDescription: "Leichter Wach- und Aufklärungsdroide. Schnell, sehr wendig und häufig Träger von Zugangsrechten.",
    abilityId: null,
    abilityLabel: "KEINE AKTIVE FELDFÄHIGKEIT",
    abilityDescription: "Sein Vorteil liegt bisher im schnellen Deck-Fahrwerk und in seiner Security-Rolle.",
    drive: { label: "SCHNELL · WENDIG", maxSpeed: 250, acceleration: 1200, deceleration: 1450, turnSpeed: 920 },
    sprite: publicAsset("assets/robots/sentry.png"),
    directionalSprite: publicAsset("assets/robots/directional-sentry.png"),
  },
  magnetar: {
    id: "magnetar",
    name: "MAGNETAR 742",
    bodyClass: "UTILITY",
    roleLabel: "FELDMANIPULATOR",
    roleDescription: "Technischer Spezialkörper für Reaktor- und Gittersysteme. Solide Bewegung, starke Zahlenfeld-Kontrolle.",
    abilityId: "row-shift-right",
    abilityLabel: "REIHENSCHUB →",
    abilityDescription: "Einmal pro Duell darf eine gewählte Zahlenreihe um ein Feld nach rechts verschoben werden.",
    drive: { label: "STABIL · MITTEL", maxSpeed: 195, acceleration: 760, deceleration: 980, turnSpeed: 560 },
    sprite: publicAsset("assets/robots/magnetar.png"),
    directionalSprite: publicAsset("assets/robots/directional-magnetar.png"),
  },
  kronos: {
    id: "kronos",
    name: "KRONOS-9",
    bodyClass: "SCHWER",
    roleLabel: "SCHWERER KAMPFDROIDE",
    roleDescription: "Massiver Sicherheits- und Kommandokörper. Langsam, träge und für schwere Bereiche des Schiffs gebaut.",
    abilityId: null,
    abilityLabel: "FÄHIGKEIT NOCH NICHT FESTGELEGT",
    abilityDescription: "KRONOS soll später eine besonders starke Körperfähigkeit erhalten; die konkrete Mechanik ist noch offen.",
    drive: { label: "LANGSAM · MASSIV", maxSpeed: 165, acceleration: 520, deceleration: 680, turnSpeed: 360 },
    sprite: publicAsset("assets/robots/kronos.png"),
    directionalSprite: publicAsset("assets/robots/directional-kronos.png"),
  },
};

export function robotDriveProfile(bodyId: BodyId, size: RobotDeckSize) {
  const base = BODIES[bodyId].drive;
  if (size === "standard") return base;
  return {
    ...base,
    label: `${base.label} · SCHWERKÖRPER`,
    maxSpeed: Math.round(base.maxSpeed * 0.75),
    acceleration: Math.round(base.acceleration * 0.65),
    deceleration: Math.round(base.deceleration * 0.65),
    turnSpeed: Math.round(base.turnSpeed * 0.55),
  };
}

export const MODE_TO_TARGET: Record<MathMode, number> = {
  "add-easy": 6,
  "add-normal": 8,
  "add-hard": 10,
  subtract: 8,
};