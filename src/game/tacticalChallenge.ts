import type { TacticalChallengeId } from "./playerProfile";
import type { EncounterBehavior } from "./types";

type PressureMultipliers = {
  detection: number;
  leash: number;
  chaseSpeed: number;
  chaseAcceleration: number;
};

const PRESSURE: Record<TacticalChallengeId, PressureMultipliers> = {
  explorer: {
    detection: 0.88,
    leash: 0.95,
    chaseSpeed: 0.88,
    chaseAcceleration: 0.78,
  },
  standard: {
    detection: 1,
    leash: 1,
    chaseSpeed: 1,
    chaseAcceleration: 1,
  },
  challenge: {
    detection: 1.12,
    leash: 1.08,
    chaseSpeed: 1.08,
    chaseAcceleration: 1.12,
  },
};

export function resolveBehaviorPressure(
  behavior: EncounterBehavior,
  tacticalChallengeId: TacticalChallengeId,
): EncounterBehavior {
  if (behavior.kind === "neutral" || behavior.kind === "patrol") return behavior;

  const pressure = PRESSURE[tacticalChallengeId];
  if (tacticalChallengeId === "standard") return behavior;

  const detectionRadius = Math.max(72, Math.round(behavior.detectionRadius * pressure.detection));
  const loseRadius = Math.max(
    detectionRadius + 32,
    Math.round(behavior.loseRadius * pressure.leash),
  );

  return {
    ...behavior,
    detectionRadius,
    loseRadius,
    chaseSpeed: Math.max(40, Math.round(behavior.chaseSpeed * pressure.chaseSpeed)),
    chaseAcceleration: Math.max(20, Math.round(behavior.chaseAcceleration * pressure.chaseAcceleration)),
  };
}
