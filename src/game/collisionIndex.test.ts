import { describe, expect, it } from "vitest";
import { robotCollisionRadius } from "./catalog";
import { pointWalkable } from "./save";
import type { FloorDefinition, Rect } from "./types";
import { TS01_GENERATED_FLOOR } from "../levelgen/generatedTs01Preview";

function inRect(x: number, y: number, rect: Rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function circleIntersectsRect(x: number, y: number, radius: number, rect: Rect) {
  const nearestX = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const nearestY = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  const dx = x - nearestX;
  const dy = y - nearestY;
  return dx * dx + dy * dy < radius * radius;
}

function bruteWalkable(floor: FloorDefinition, x: number, y: number, radius: number) {
  const samples = 16;
  for (let i = 0; i < samples; i += 1) {
    const angle = i / samples * Math.PI * 2;
    const sx = x + Math.cos(angle) * radius;
    const sy = y + Math.sin(angle) * radius;
    if (!floor.walkable.some((rect) => inRect(sx, sy, rect))) return false;
  }
  if (!floor.walkable.some((rect) => inRect(x, y, rect))) return false;
  return !floor.obstacles.some((rect) => circleIntersectsRect(x, y, radius, rect));
}

describe("Floor collision spatial index", () => {
  it("preserves brute-force collision semantics across the generated TS-01", () => {
    const floor = TS01_GENERATED_FLOOR;
    const radius = robotCollisionRadius("standard");
    for (let y = 16; y < floor.height; y += 47) {
      for (let x = 16; x < floor.width; x += 53) {
        expect(pointWalkable(x, y, floor.id, radius)).toBe(bruteWalkable(floor, x, y, radius));
      }
    }
  });
});
