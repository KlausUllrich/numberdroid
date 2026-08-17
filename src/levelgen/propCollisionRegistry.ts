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
  // Transfer Apparatus v2: same approved Hero silhouette, doubled from the 2×3
  // QA candidate to a 4×6 world presentation. Multipart collision is scaled with
  // it: Human intake remains open, the broad transfer platform is solid, and the
  // PICO Body Dock + south exit remain navigable.
  "transfer-core": [
    { x: 0.40, y: 0.40, w: 0.80, h: 1.44 },
    { x: 2.80, y: 0.40, w: 0.80, h: 1.44 },
    { x: 0.16, y: 1.84, w: 3.68, h: 2.20 },
    { x: 0.68, y: 4.04, w: 0.72, h: 1.32 },
    { x: 2.60, y: 4.04, w: 0.72, h: 1.32 },
  ],
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
