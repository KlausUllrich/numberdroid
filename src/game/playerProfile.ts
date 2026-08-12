import { FIRST_CAMPAIGN_DECK_ID } from "./campaign";

export type MathStartId = "small" | "to20" | "to100" | "multiply" | "mixed";
export type TacticalChallengeId = "explorer" | "standard" | "challenge";
export type PlayerAudience = "child" | "adult";

export type PlayerProfile = {
  version: 3;
  id: string;
  name: string;
  audience: PlayerAudience;
  mathStartId: MathStartId;
  tacticalChallengeId: TacticalChallengeId;
  unlockedDeckIds: string[];
  completedDeckIds: string[];
  currentCampaignDeckId: string | null;
};

export type PlayerProfileCollection = {
  version: 1;
  activeProfileId: string;
  profiles: PlayerProfile[];
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

const PROFILE_COLLECTION_KEY = "numberdroid-player-profiles-v1";
const PROFILE_KEY_V2 = "numberdroid-player-profile-v2";
const PROFILE_KEY_V1 = "numberdroid-player-profile-v1";

export const DEFAULT_PLAYER_PROFILE: PlayerProfile = {
  version: 3,
  id: "player-1",
  name: "SPIELER 1",
  audience: "adult",
  mathStartId: "small",
  tacticalChallengeId: "standard",
  unlockedDeckIds: [FIRST_CAMPAIGN_DECK_ID],
  completedDeckIds: [],
  currentCampaignDeckId: null,
};

export const DEFAULT_PROFILE_COLLECTION: PlayerProfileCollection = {
  version: 1,
  activeProfileId: "",
  profiles: [],
};

function validMathStart(value: unknown): value is MathStartId {
  return MATH_START_OPTIONS.some((entry) => entry.id === value);
}

function validTacticalChallenge(value: unknown): value is TacticalChallengeId {
  return TACTICAL_CHALLENGES.some((entry) => entry.id === value);
}

function validAudience(value: unknown): value is PlayerAudience {
  return value === "child" || value === "adult";
}

function cleanStringIds(value: unknown) {
  return Array.isArray(value) ? [...new Set(value.filter((entry): entry is string => typeof entry === "string" && Boolean(entry)))] : [];
}

function sanitizeProfile(candidate: Partial<PlayerProfile>, fallbackId = DEFAULT_PLAYER_PROFILE.id): PlayerProfile {
  const unlockedDeckIds = cleanStringIds(candidate.unlockedDeckIds);
  if (!unlockedDeckIds.includes(FIRST_CAMPAIGN_DECK_ID)) unlockedDeckIds.unshift(FIRST_CAMPAIGN_DECK_ID);
  return {
    version: 3,
    id: typeof candidate.id === "string" && candidate.id ? candidate.id : fallbackId,
    name: typeof candidate.name === "string" && candidate.name.trim() ? candidate.name.trim().slice(0, 24) : DEFAULT_PLAYER_PROFILE.name,
    audience: validAudience(candidate.audience) ? candidate.audience : "adult",
    mathStartId: validMathStart(candidate.mathStartId) ? candidate.mathStartId : DEFAULT_PLAYER_PROFILE.mathStartId,
    tacticalChallengeId: validTacticalChallenge(candidate.tacticalChallengeId) ? candidate.tacticalChallengeId : DEFAULT_PLAYER_PROFILE.tacticalChallengeId,
    unlockedDeckIds,
    completedDeckIds: cleanStringIds(candidate.completedDeckIds),
    currentCampaignDeckId: typeof candidate.currentCampaignDeckId === "string" ? candidate.currentCampaignDeckId : null,
  };
}

function legacySingleProfile(): PlayerProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY_V2);
    if (raw) return sanitizeProfile(JSON.parse(raw) as Partial<PlayerProfile>);
  } catch { /* ignore damaged v2 profile */ }

  try {
    const raw = localStorage.getItem(PROFILE_KEY_V1);
    if (raw) return sanitizeProfile(JSON.parse(raw) as Partial<PlayerProfile>);
  } catch { /* ignore damaged v1 profile */ }

  return null;
}

function sanitizeCollection(candidate: Partial<PlayerProfileCollection>): PlayerProfileCollection {
  const sourceProfiles = Array.isArray(candidate.profiles) ? candidate.profiles : [];
  const profiles = sourceProfiles
    .filter((entry): entry is PlayerProfile => Boolean(entry && typeof entry === "object"))
    .map((entry, index) => sanitizeProfile(entry, `player-${index + 1}`));

  const uniqueProfiles = profiles.filter((profile, index) => profiles.findIndex((entry) => entry.id === profile.id) === index);
  const requestedActiveId = typeof candidate.activeProfileId === "string" ? candidate.activeProfileId : "";
  const activeProfileId = uniqueProfiles.some((profile) => profile.id === requestedActiveId)
    ? requestedActiveId
    : uniqueProfiles[0]?.id ?? "";

  return { version: 1, activeProfileId, profiles: uniqueProfiles };
}

export function loadPlayerProfiles(): PlayerProfileCollection {
  try {
    const raw = localStorage.getItem(PROFILE_COLLECTION_KEY);
    if (raw) return sanitizeCollection(JSON.parse(raw) as Partial<PlayerProfileCollection>);
  } catch { /* ignore damaged collection */ }

  const legacy = legacySingleProfile();
  const migrated = legacy
    ? { version: 1 as const, activeProfileId: legacy.id, profiles: [legacy] }
    : sanitizeCollection(DEFAULT_PROFILE_COLLECTION);
  savePlayerProfiles(migrated);
  return migrated;
}

export function savePlayerProfiles(collection: PlayerProfileCollection) {
  try {
    localStorage.setItem(PROFILE_COLLECTION_KEY, JSON.stringify(sanitizeCollection(collection)));
  } catch { /* storage may be unavailable in private/sandboxed contexts */ }
}

export function activePlayerProfile(collection: PlayerProfileCollection): PlayerProfile {
  return collection.profiles.find((profile) => profile.id === collection.activeProfileId)
    ?? collection.profiles[0]
    ?? DEFAULT_PLAYER_PROFILE;
}

export function collectionWithUpdatedProfile(collection: PlayerProfileCollection, profile: PlayerProfile): PlayerProfileCollection {
  const exists = collection.profiles.some((entry) => entry.id === profile.id);
  return sanitizeCollection({
    ...collection,
    activeProfileId: collection.activeProfileId || profile.id,
    profiles: exists
      ? collection.profiles.map((entry) => entry.id === profile.id ? profile : entry)
      : [...collection.profiles, profile],
  });
}

export function collectionWithActiveProfile(collection: PlayerProfileCollection, profileId: string): PlayerProfileCollection {
  if (!collection.profiles.some((profile) => profile.id === profileId)) return collection;
  return { ...collection, activeProfileId: profileId };
}

export function createPlayerProfile(
  id: string,
  name: string,
  audience: PlayerAudience = "child",
  mathStartId: MathStartId = audience === "adult" ? "to100" : "small",
): PlayerProfile {
  return sanitizeProfile({
    ...DEFAULT_PLAYER_PROFILE,
    id,
    name,
    audience,
    mathStartId,
    unlockedDeckIds: [FIRST_CAMPAIGN_DECK_ID],
    completedDeckIds: [],
    currentCampaignDeckId: null,
  }, id);
}

export function collectionWithNewProfile(collection: PlayerProfileCollection, profile: PlayerProfile): PlayerProfileCollection {
  const next = collectionWithUpdatedProfile(collection, profile);
  return { ...next, activeProfileId: profile.id };
}

// Compatibility wrappers for code/tests that need only the currently active profile.
export function loadPlayerProfile(): PlayerProfile {
  return activePlayerProfile(loadPlayerProfiles());
}

export function savePlayerProfile(profile: PlayerProfile) {
  const collection = loadPlayerProfiles();
  savePlayerProfiles(collectionWithUpdatedProfile(collection, profile));
}

export function profileWithStartedDeck(profile: PlayerProfile, deckId: string): PlayerProfile {
  return { ...profile, currentCampaignDeckId: deckId };
}

export function profileWithAbandonedDeck(profile: PlayerProfile): PlayerProfile {
  return { ...profile, currentCampaignDeckId: null };
}

export function profileWithCompletedDeck(profile: PlayerProfile, deckId: string, nextDeckId?: string): PlayerProfile {
  const completedDeckIds = profile.completedDeckIds.includes(deckId)
    ? profile.completedDeckIds
    : [...profile.completedDeckIds, deckId];
  const unlockedDeckIds = nextDeckId && !profile.unlockedDeckIds.includes(nextDeckId)
    ? [...profile.unlockedDeckIds, nextDeckId]
    : profile.unlockedDeckIds;
  return {
    ...profile,
    completedDeckIds,
    unlockedDeckIds,
    currentCampaignDeckId: null,
  };
}
