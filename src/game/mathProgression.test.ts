import { describe, expect, it } from "vitest";
import { DECK_C3 } from "./floors";
import { deriveMathConfig, encounterWithProfileDifficulty, resolveAiDifficulty } from "./mathProgression";

describe("math progression resolver", () => {
  const comfort = DECK_C3.encounters.find((encounter) => encounter.encounterId === "c3-sentry-loader")!;
  const specialist = DECK_C3.encounters.find((encounter) => encounter.encounterId === "c3-magnetar-balancer")!;

  it("keeps comfort arithmetic useful for strong profiles on early decks", () => {
    const config = deriveMathConfig(comfort, "mixed", 1);
    expect(config.operation).toBe("add");
    expect(config.target).toBe(8);
  });

  it("makes a specialist harder than a comfort bot for the same profile and deck", () => {
    const comfortConfig = deriveMathConfig(comfort, "to20", 2);
    const specialistConfig = deriveMathConfig(specialist, "to20", 2);
    expect(specialistConfig.target).toBeGreaterThan(comfortConfig.target);
  });

  it("fans later decks out more strongly for higher starting profiles", () => {
    const earlySmall = deriveMathConfig(specialist, "small", 2);
    const lateSmall = deriveMathConfig(specialist, "small", 22);
    const earlyAdvanced = deriveMathConfig(specialist, "mixed", 2);
    const lateAdvanced = deriveMathConfig(specialist, "mixed", 22);

    expect(lateSmall.target - earlySmall.target).toBe(4);
    expect(lateAdvanced.target - earlyAdvanced.target).toBe(12);
  });

  it("never changes the authored arithmetic operation", () => {
    const subtraction = { ...specialist, mode: "subtract" as const };
    const config = deriveMathConfig(subtraction, "mixed", 22);
    expect(config.operation).toBe("subtract");
    expect(config.symbol).toBe("−");
  });
});

describe("tactical challenge remains separate", () => {
  it("shifts AI competence without changing authored math-role resolution", () => {
    expect(resolveAiDifficulty("medium", "explorer")).toBe("easy");
    expect(resolveAiDifficulty("medium", "standard")).toBe("medium");
    expect(resolveAiDifficulty("medium", "challenge")).toBe("hard");

    const base = DECK_C3.encounters.find((encounter) => encounter.encounterId === "c3-magnetar-coolant")!;
    const explorer = encounterWithProfileDifficulty(base, "to20", "explorer", 2);
    const challenge = encounterWithProfileDifficulty(base, "to20", "challenge", 2);
    expect(explorer.mathConfig?.target).toBe(challenge.mathConfig?.target);
    expect(explorer.difficulty).toBe("easy");
    expect(challenge.difficulty).toBe("hard");
  });
});
