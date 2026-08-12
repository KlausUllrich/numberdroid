import { describe, expect, it } from "vitest";
import type { DuelMathConfig } from "../game/types";
import { findCombinations, freshGrid, pathResult } from "./duelEngine";

const ADD_14: DuelMathConfig = {
  label: "ZIEL 14",
  short: "WERTE 1–13",
  operation: "add",
  symbol: "+",
  target: 14,
  maxValue: 13,
  pool: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
};

const SUBTRACT_12: DuelMathConfig = {
  label: "ZIEL 12",
  short: "MINUS 1–24",
  operation: "subtract",
  symbol: "−",
  target: 12,
  maxValue: 24,
  pool: Array.from({ length: 24 }, (_, index) => index + 1),
};

describe("dynamic duel math envelopes", () => {
  it("creates a solvable addition grid outside the legacy target presets", () => {
    const grid = freshGrid(ADD_14, 12345);
    const paths = findCombinations(grid, ADD_14);
    expect(paths.length).toBeGreaterThan(0);
    expect(pathResult(paths[0], grid, ADD_14)).toBe(14);
    expect(Math.max(...grid.flat().map((tile) => tile.value))).toBeLessThanOrEqual(13);
  });

  it("creates a solvable subtraction grid from a concrete envelope", () => {
    const grid = freshGrid(SUBTRACT_12, 54321);
    const paths = findCombinations(grid, SUBTRACT_12);
    expect(paths.length).toBeGreaterThan(0);
    expect(pathResult(paths[0], grid, SUBTRACT_12)).toBe(12);
  });
});
