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
