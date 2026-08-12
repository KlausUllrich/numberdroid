import { describe, expect, it } from "vitest";
import { DECK_C3 } from "./floors";
import { resolveBehaviorPressure } from "./tacticalChallenge";

describe("tactical deck pressure", () => {
  const guard = DECK_C3.encounters.find((encounter) => encounter.encounterId === "c3-magnetar-coolant")!.behavior!;
  const neutral = DECK_C3.encounters.find((encounter) => encounter.encounterId === "c3-sentry-loader")!.behavior!;

  it("keeps STANDARD exactly at the authored behavior values", () => {
    expect(resolveBehaviorPressure(guard, "standard")).toBe(guard);
  });

  it("gives ENTDECKER a smaller/slower pursuit envelope", () => {
    const explorer = resolveBehaviorPressure(guard, "explorer");
    expect(explorer.detectionRadius).toBeLessThan(guard.detectionRadius);
    expect(explorer.chaseSpeed).toBeLessThan(guard.chaseSpeed);
    expect(explorer.chaseAcceleration).toBeLessThan(guard.chaseAcceleration);
    expect(explorer.loseRadius).toBeGreaterThan(explorer.detectionRadius);
  });

  it("makes HERAUSFORDERUNG more persistent without changing collision semantics", () => {
    const challenge = resolveBehaviorPressure(guard, "challenge");
    expect(challenge.detectionRadius).toBeGreaterThan(guard.detectionRadius);
    expect(challenge.loseRadius).toBeGreaterThan(guard.loseRadius);
    expect(challenge.chaseSpeed).toBeGreaterThan(guard.chaseSpeed);
    expect(challenge.chaseAcceleration).toBeGreaterThan(guard.chaseAcceleration);
  });

  it("does not turn neutral work into tactical pressure", () => {
    expect(resolveBehaviorPressure(neutral, "explorer")).toBe(neutral);
    expect(resolveBehaviorPressure(neutral, "challenge")).toBe(neutral);
  });
});
