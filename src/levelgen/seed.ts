import type { LevelSeed } from "./types";

function fnv1a32(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function normalizeLevelSeed(seed: LevelSeed): number {
  if (typeof seed === "number") {
    if (!Number.isFinite(seed)) throw new Error("Level seed must be finite.");
    return Math.floor(seed) >>> 0;
  }
  const normalized = seed.trim();
  if (!normalized) throw new Error("Level seed string must not be empty.");
  return fnv1a32(normalized);
}

export function deriveSubSeed(seed: LevelSeed | number, semanticPath: string): number {
  const root = normalizeLevelSeed(seed);
  if (!semanticPath.trim()) throw new Error("Semantic seed path must not be empty.");
  return fnv1a32(`${root}:${semanticPath}`);
}

export function seededUnit(seed: number): number {
  let x = seed >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) / 0x100000000;
}
