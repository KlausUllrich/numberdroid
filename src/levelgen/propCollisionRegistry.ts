import type { PropLocalBounds, PropMetadata } from "./types";

/**
 * Optional detailed physical collision for Props whose gameplay silhouette is
 * materially different from one rectangular AABB. Coordinates are authored in
 * the Prop's 0° local tile space and rotate with the Prop.
 *
 * This registry is spatial/gameplay metadata. It is deliberately separate from
 * the Prop Art Registry: PNG alpha or canvas dimensions never become collision
 * authority.
 */

const TRANSFER_COLLISION_CELLS_PER_TILE = 4;
const TRANSFER_COLLISION_CELL_SIZE = 1 / TRANSFER_COLLISION_CELLS_PER_TILE;

/**
 * Scripted 16×24 occupancy silhouette for the approved 4×6 Transfer Apparatus.
 *
 * `#` = physical apparatus, `.` = intentionally navigable whitespace.
 *
 * This is an authored gameplay mask rather than runtime PNG-alpha collision:
 * normal player movement (Human or Robot) cannot cross the actual machine body,
 * while the four transparent outer corner regions remain usable floor. Transfer
 * choreography can later override normal movement explicitly when a story action
 * places a Human/Core/Robot onto the machine.
 */
const TRANSFER_APPARATUS_COLLISION_MASK = [
  "................",
  ".......##.......",
  ".....######.....",
  ".....######.....",
  "....########....",
  "....########....",
  "....########....",
  "....########....",
  ".##############.",
  "################",
  "################",
  "################",
  "################",
  ".##############.",
  ".##############.",
  ".##############.",
  "....########....",
  "....########....",
  "....########....",
  "....########....",
  "......####......",
  "......####......",
  ".......##.......",
  "................",
] as const;

function scriptedCollisionFromMask(mask: readonly string[]): PropLocalBounds[] {
  const width = mask[0]?.length ?? 0;
  if (!width || mask.length !== 24 || width !== 16) {
    throw new Error("Transfer Apparatus collision mask must be exactly 16×24 quarter-tile cells.");
  }
  if (mask.some((row) => row.length !== width || /[^.#]/.test(row))) {
    throw new Error("Transfer Apparatus collision mask contains malformed rows.");
  }

  const rects: PropLocalBounds[] = [];
  let active = new Map<string, number>();

  for (let y = 0; y < mask.length; y += 1) {
    const row = mask[y];
    const spans: Array<{ start: number; end: number }> = [];
    let x = 0;
    while (x < row.length) {
      if (row[x] !== "#") {
        x += 1;
        continue;
      }
      const start = x;
      while (x < row.length && row[x] === "#") x += 1;
      spans.push({ start, end: x });
    }

    const next = new Map<string, number>();
    for (const span of spans) {
      const key = `${span.start}:${span.end}`;
      const existingIndex = active.get(key);
      if (existingIndex !== undefined) {
        rects[existingIndex].h += TRANSFER_COLLISION_CELL_SIZE;
        next.set(key, existingIndex);
        continue;
      }

      rects.push({
        x: span.start * TRANSFER_COLLISION_CELL_SIZE,
        y: y * TRANSFER_COLLISION_CELL_SIZE,
        w: (span.end - span.start) * TRANSFER_COLLISION_CELL_SIZE,
        h: TRANSFER_COLLISION_CELL_SIZE,
      });
      next.set(key, rects.length - 1);
    }
    active = next;
  }

  return rects;
}

const TRANSFER_APPARATUS_COLLISION = scriptedCollisionFromMask(TRANSFER_APPARATUS_COLLISION_MASK);

export const NUMBERDROID_PROP_COLLISION_PARTS: Readonly<Record<string, readonly PropLocalBounds[]>> = {
  // Family Table: central table plus four physically readable seating modules.
  // The gaps between the seats remain navigable instead of turning the complete
  // 3×2 visual envelope into one invisible rectangle.
  "family-table": [
    { x: 0.66, y: 0.56, w: 1.68, h: 0.88 },
    { x: 0.98, y: 0.08, w: 1.04, h: 0.42 },
    { x: 0.98, y: 1.50, w: 1.04, h: 0.42 },
    { x: 0.08, y: 0.68, w: 0.50, h: 0.64 },
    { x: 2.42, y: 0.68, w: 0.50, h: 0.64 },
  ],
  "transfer-core": TRANSFER_APPARATUS_COLLISION,
  // Hologram: block the actual pedestal footprint, not merely a tiny core.
  "transfer-hologram": [
    { x: 0.15, y: 0.15, w: 0.70, h: 0.70 },
  ],
};

function fullBounds(metadata: PropMetadata): PropLocalBounds {
  return { x: 0, y: 0, w: metadata.footprintTiles.w, h: metadata.footprintTiles.h };
}

/**
 * Resolve detailed collision. Existing single exactFit collision metadata stays
 * valid as the fallback contract for ordinary Props.
 */
export function propCollisionLocalBounds(metadata: PropMetadata): readonly PropLocalBounds[] {
  return NUMBERDROID_PROP_COLLISION_PARTS[metadata.id]
    ?? [metadata.exactFit?.collisionBoundsTiles ?? fullBounds(metadata)];
}
