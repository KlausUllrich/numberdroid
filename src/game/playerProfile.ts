export type MathStartId = "small" | "to20" | "to100" | "multiply" | "mixed";
export type TacticalChallengeId = "explorer" | "standard" | "challenge";

export type PlayerProfile = {
  version: 1;
  id: string;
  name: string;
  mathStartId: MathStartId;
  tacticalChallengeId: TacticalChallengeId;
};

export type MathStartOption = {
  id: MathStartId;
  example: string;
  label: string;
  description: string;
};

export const MATH_START_OPTIONS: MathStartOption[] = [
  { id: "small", example: "4 + 3", label: "KLEINE ZAHLEN", description: "Plus und Minus mit kleinen Zahlen" },
  { id: "to20", example: "8 + 7", label: "BIS ETWA 20", description: "Plus und Minus bis ungefähr 20" },
  { id: "to100", example: "34 + 28", label: "GRÖSSERE ZAHLEN", description: "Plus und Minus mit größeren Zahlen" },
  { id: "multiply", example: "6 × 4", label: "EINMALEINS", description: "Malnehmen ist schon vertraut" },
  { id: "mixed", example: "24 ÷ 6", label: "MAL & GETEILT", description: "Malnehmen und Teilen sind vertraut" },
];

export const TACTICAL_CHALLENGES = [
  { id: "explorer" as const, label: "ENTDECKER", description: "Mehr Reaktionsraum und verzeihendere Gegner" },
  { id: "standard" as const, label: "STANDARD", description: "Die vorgesehene Mischung aus Jagd und Duell" },
  { id: "challenge" as const, label: "HERAUSFORDERUNG", description: "Hartnäckigere Gegner und weniger taktischer Spielraum" },
];

const PROFILE_KEY = "numberdroid-player-profile-v1";

export const DEFAULT_PLAYER_PROFILE: PlayerProfile = {
  version: 1,
  id: "player-1",
  name: "SPIELER 1",
  mathStartId: "small",
  tacticalChallengeId: "standard",
};

function validMathStart(value: unknown): value is MathStartId {
  return MATH_START_OPTIONS.some((entry) => entry.id === value);
}

function validTacticalChallenge(value: unknown): value is TacticalChallengeId {
  return TACTICAL_CHALLENGES.some((entry) => entry.id === value);
}

export function loadPlayerProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { ...DEFAULT_PLAYER_PROFILE };
    const candidate = JSON.parse(raw) as Partial<PlayerProfile>;
    return {
      version: 1,
      id: typeof candidate.id === "string" && candidate.id ? candidate.id : DEFAULT_PLAYER_PROFILE.id,
      name: typeof candidate.name === "string" && candidate.name.trim() ? candidate.name.trim().slice(0, 24) : DEFAULT_PLAYER_PROFILE.name,
      mathStartId: validMathStart(candidate.mathStartId) ? candidate.mathStartId : DEFAULT_PLAYER_PROFILE.mathStartId,
      tacticalChallengeId: validTacticalChallenge(candidate.tacticalChallengeId) ? candidate.tacticalChallengeId : DEFAULT_PLAYER_PROFILE.tacticalChallengeId,
    };
  } catch {
    return { ...DEFAULT_PLAYER_PROFILE };
  }
}

export function savePlayerProfile(profile: PlayerProfile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch { /* storage may be unavailable in private/sandboxed contexts */ }
}
