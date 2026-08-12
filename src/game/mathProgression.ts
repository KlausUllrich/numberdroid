import type { Difficulty, DuelMathConfig, EncounterConfig, MathRole } from "./types";
import type { MathStartId, TacticalChallengeId } from "./playerProfile";

const PROFILE_BASE_TARGET: Record<MathStartId, number> = {
  small: 6,
  to20: 8,
  to100: 10,
  multiply: 10,
  mixed: 10,
};

const PROFILE_DECK_GROWTH: Record<MathStartId, number> = {
  small: 1,
  to20: 1,
  to100: 2,
  multiply: 2,
  mixed: 3,
};

const ROLE_OFFSET: Record<MathRole, number> = {
  comfort: -2,
  core: 0,
  stretch: 2,
  specialist: 3,
  boss: 4,
};

function inferredMathRole(encounter: EncounterConfig): MathRole {
  if (encounter.mathRole) return encounter.mathRole;
  if (encounter.boss) return "boss";
  return encounter.difficulty === "easy" ? "comfort" : encounter.difficulty === "medium" ? "core" : "stretch";
}

function deckStage(deckOrder: number) {
  return Math.max(0, Math.min(4, Math.floor((Math.max(1, deckOrder) - 1) / 5)));
}

function integerPool(maxValue: number, lowRepeat: number) {
  const values = Array.from({ length: maxValue }, (_, index) => index + 1);
  const repeatedLow = Array.from({ length: Math.min(lowRepeat, maxValue) }, (_, index) => index + 1);
  return [...repeatedLow, ...values];
}

export function deriveMathConfig(encounter: EncounterConfig, mathStartId: MathStartId, deckOrder: number): DuelMathConfig {
  const role = inferredMathRole(encounter);
  const stage = deckStage(deckOrder);
  const targetBase = PROFILE_BASE_TARGET[mathStartId];
  const growth = PROFILE_DECK_GROWTH[mathStartId] * stage;
  const roleOffset = ROLE_OFFSET[role];

  if (encounter.mode === "subtract") {
    const target = Math.max(2, targetBase - 2 + growth + roleOffset);
    const maxValue = Math.max(target + 8, 12);
    return {
      label: `ZIEL ${target}`,
      short: `MINUS 1–${maxValue}`,
      operation: "subtract",
      symbol: "−",
      target,
      maxValue,
      pool: integerPool(maxValue, 6),
    };
  }

  const target = Math.max(6, targetBase + growth + roleOffset);
  const maxValue = Math.max(5, target - 1);
  return {
    label: `ZIEL ${target}`,
    short: `WERTE 1–${maxValue}`,
    operation: "add",
    symbol: "+",
    target,
    maxValue,
    pool: integerPool(maxValue, 6),
  };
}

export function encounterWithMathConfig(encounter: EncounterConfig, mathStartId: MathStartId, deckOrder: number): EncounterConfig {
  const mathConfig = deriveMathConfig(encounter, mathStartId, deckOrder);
  return {
    ...encounter,
    mathConfig,
    mathLabel: `${mathConfig.symbol} ZIEL ${mathConfig.target}`,
  };
}

const DIFFICULTY_ORDER: Difficulty[] = ["easy", "medium", "hard"];

export function resolveAiDifficulty(authored: Difficulty, tacticalChallengeId: TacticalChallengeId): Difficulty {
  const authoredIndex = DIFFICULTY_ORDER.indexOf(authored);
  const offset = tacticalChallengeId === "explorer" ? -1 : tacticalChallengeId === "challenge" ? 1 : 0;
  return DIFFICULTY_ORDER[Math.max(0, Math.min(DIFFICULTY_ORDER.length - 1, authoredIndex + offset))];
}

export function encounterWithProfileDifficulty(
  encounter: EncounterConfig,
  mathStartId: MathStartId,
  tacticalChallengeId: TacticalChallengeId,
  deckOrder: number,
): EncounterConfig {
  const mathAdjusted = encounterWithMathConfig(encounter, mathStartId, deckOrder);
  const difficulty = resolveAiDifficulty(encounter.difficulty, tacticalChallengeId);
  return {
    ...mathAdjusted,
    difficulty,
    difficultyLabel: difficulty === "easy" ? "LEICHT" : difficulty === "medium" ? "MITTEL" : "STARK",
  };
}
