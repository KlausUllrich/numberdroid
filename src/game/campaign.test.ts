import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_DECKS,
  FIRST_CAMPAIGN_DECK_ID,
  getCampaignDeck,
  getNextCampaignDeck,
} from "./campaign";
import { DECK_C3, DECK_VS2 } from "./floors";
import {
  DEFAULT_PLAYER_PROFILE,
  DEFAULT_PROFILE_COLLECTION,
  activePlayerProfile,
  collectionWithActiveProfile,
  collectionWithNewProfile,
  collectionWithUpdatedProfile,
  createPlayerProfile,
  profileWithCompletedDeck,
  profileWithStartedDeck,
} from "./playerProfile";

describe("campaign catalog", () => {
  it("keeps the current planning target at 25 count-agnostic deck entries", () => {
    expect(CAMPAIGN_DECKS).toHaveLength(25);
    expect(CAMPAIGN_DECKS.map((deck) => deck.order)).toEqual(Array.from({ length: 25 }, (_, index) => index + 1));
  });

  it("progresses from B2 to the C3 proof deck", () => {
    const first = getCampaignDeck(FIRST_CAMPAIGN_DECK_ID);
    const next = getNextCampaignDeck(first.id);
    expect(first.floorId).toBe("deck-vs2");
    expect(next?.id).toBe("campaign-c3");
    expect(next?.floorId).toBe("deck-c3");
  });
});

describe("player profile progression", () => {
  it("starts B2 without changing math or tactical preferences", () => {
    const profile = {
      ...DEFAULT_PLAYER_PROFILE,
      mathStartId: "to20" as const,
      tacticalChallengeId: "challenge" as const,
    };
    const started = profileWithStartedDeck(profile, "campaign-b2");
    expect(started.currentCampaignDeckId).toBe("campaign-b2");
    expect(started.mathStartId).toBe("to20");
    expect(started.tacticalChallengeId).toBe("challenge");
  });

  it("completing B2 unlocks C3 without rewriting profile difficulty axes", () => {
    const profile = {
      ...DEFAULT_PLAYER_PROFILE,
      mathStartId: "small" as const,
      tacticalChallengeId: "explorer" as const,
    };
    const completed = profileWithCompletedDeck(profile, "campaign-b2", "campaign-c3");
    expect(completed.completedDeckIds).toContain("campaign-b2");
    expect(completed.unlockedDeckIds).toContain("campaign-c3");
    expect(completed.mathStartId).toBe("small");
    expect(completed.tacticalChallengeId).toBe("explorer");
  });
});

describe("family profile onboarding and isolation", () => {
  it("allows a true first install to have no visible fake player profile", () => {
    expect(DEFAULT_PROFILE_COLLECTION.profiles).toEqual([]);
    expect(DEFAULT_PROFILE_COLLECTION.activeProfileId).toBe("");
  });

  it("uses child and adult onboarding defaults without changing campaign access", () => {
    const child = createPlayerProfile("child-1", "FINN", "child");
    const adult = createPlayerProfile("adult-1", "KLAUS", "adult");

    expect(child.audience).toBe("child");
    expect(child.mathStartId).toBe("small");
    expect(adult.audience).toBe("adult");
    expect(adult.mathStartId).toBe("to100");
    expect(child.unlockedDeckIds).toEqual([FIRST_CAMPAIGN_DECK_ID]);
    expect(adult.unlockedDeckIds).toEqual([FIRST_CAMPAIGN_DECK_ID]);
  });

  it("creates a second player at B2 without inheriting the first player's progress", () => {
    const firstCompleted = profileWithCompletedDeck(DEFAULT_PLAYER_PROFILE, "campaign-b2", "campaign-c3");
    const collection = collectionWithUpdatedProfile(DEFAULT_PROFILE_COLLECTION, firstCompleted);
    const second = createPlayerProfile("player-2", "SPIELER 2");
    const withSecond = collectionWithNewProfile(collection, second);

    expect(activePlayerProfile(withSecond).id).toBe("player-2");
    expect(activePlayerProfile(withSecond).unlockedDeckIds).toEqual(["campaign-b2"]);
    expect(activePlayerProfile(withSecond).completedDeckIds).toEqual([]);

    const first = withSecond.profiles.find((profile) => profile.id === "player-1")!;
    expect(first.completedDeckIds).toContain("campaign-b2");
    expect(first.unlockedDeckIds).toContain("campaign-c3");
  });

  it("switching the active child does not modify either child's math settings", () => {
    const first = { ...DEFAULT_PLAYER_PROFILE, mathStartId: "small" as const };
    const second = { ...createPlayerProfile("player-2", "SPIELER 2"), mathStartId: "to100" as const };
    let collection = collectionWithUpdatedProfile(DEFAULT_PROFILE_COLLECTION, first);
    collection = collectionWithNewProfile(collection, second);
    collection = collectionWithActiveProfile(collection, first.id);

    expect(activePlayerProfile(collection).mathStartId).toBe("small");
    expect(collection.profiles.find((profile) => profile.id === "player-2")?.mathStartId).toBe("to100");
  });
});

describe("authored robot math roles", () => {
  it("gives legacy B2 encounters a compatible math role through Tiled parsing", () => {
    expect(DECK_VS2.encounters.length).toBeGreaterThan(5);
    expect(DECK_VS2.encounters.every((encounter) => Boolean(encounter.mathRole))).toBe(true);
  });

  it("allows C3 tactical behavior and mathematical role to differ", () => {
    const specialist = DECK_C3.encounters.find((encounter) => encounter.encounterId === "c3-magnetar-balancer");
    expect(specialist?.behavior?.kind).toBe("neutral");
    expect(specialist?.mathRole).toBe("specialist");

    const comfort = DECK_C3.encounters.find((encounter) => encounter.encounterId === "c3-sentry-loader");
    expect(comfort?.behavior?.kind).toBe("neutral");
    expect(comfort?.mathRole).toBe("comfort");
  });
});
