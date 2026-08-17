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
  // Transfer Apparatus: same physical structure as the approved 3×6 candidate,
  // uniformly scaled to half world size and centered inside the new 2×3 canvas.
  // Human receiving lane and PICO dock/drive-out remain open.
  "transfer-core": [
    { x: 0.475, y: 0.15, w: 0.275, h: 1.15 },
    { x: 1.25, y: 0.15, w: 0.275, h: 1.15 },
    { x: 0.475, y: 1.275, w: 1.05, h: 0.725 },
    { x: 0.50, y: 2.025, w: 0.275, h: 0.775 },
    { x: 1.225, y: 2.025, w: 0.275, h: 0.775 },
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
