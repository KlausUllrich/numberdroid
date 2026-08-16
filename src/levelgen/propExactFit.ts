import { propCollisionLocalBounds } from "./propCollisionRegistry";
import type {
  CardinalDirection,
  PropExactFitMetadata,
  PropLocalBounds,
  PropMetadata,
  PropRotation,
} from "./types";

export type PixelRect = { x: number; y: number; w: number; h: number };

export type ExactFitPlacement = {
  rect: { x: number; y: number; w: number; h: number };
  rotation: PropRotation;
  wallSide?: CardinalDirection | null;
};

export type PropExactFitResult = {
  /** Sub-tile translation applied equally to sprite, shadow and runtime collision. */
  offsetPx: { x: number; y: number };
  /** Unrotated authored sprite canvas; runtime rotation still happens around its center. */
  spriteRectPx: PixelRect;
  /** Axis-aligned world bounds of the authored visual envelope after cardinal rotation. */
  visualBoundsPx: PixelRect;
  /** AABB covering every detailed runtime collision part. */
  collisionBoundsPx: PixelRect;
  /** Detailed physical collision parts. These preserve gaps in non-rectangular Props. */
  collisionPartsPx: PixelRect[];
  /** Envelope chosen to touch the selected wall surface. */
  placementEnvelopePx: PixelRect;
  /** Every room boundary physically touched by the conservative solved footprint. */
  touchedWalls: CardinalDirection[];
};

const CARDINALS: CardinalDirection[] = ["north", "east", "south", "west"];

function fullBounds(metadata: PropMetadata): PropLocalBounds {
  return { x: 0, y: 0, w: metadata.footprintTiles.w, h: metadata.footprintTiles.h };
}

function unionLocalBounds(parts: readonly PropLocalBounds[]): PropLocalBounds {
  const minX = Math.min(...parts.map((part) => part.x));
  const minY = Math.min(...parts.map((part) => part.y));
  const maxX = Math.max(...parts.map((part) => part.x + part.w));
  const maxY = Math.max(...parts.map((part) => part.y + part.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function resolvedVisualBounds(metadata: PropMetadata) {
  return metadata.exactFit?.visualBoundsTiles ?? fullBounds(metadata);
}

function resolvedCollisionBounds(metadata: PropMetadata) {
  return unionLocalBounds(propCollisionLocalBounds(metadata));
}

function resolvedEnvelope(metadata: PropMetadata) {
  const fit = metadata.exactFit;
  if (!fit) return fullBounds(metadata);
  const source = fit.placementEnvelope ?? "visual";
  if (source === "collision") return resolvedCollisionBounds(metadata);
  if (source === "custom") {
    if (!fit.customEnvelopeTiles) throw new Error(`Prop ${metadata.id} exactFit custom placement envelope requires customEnvelopeTiles.`);
    return fit.customEnvelopeTiles;
  }
  return resolvedVisualBounds(metadata);
}

function validBounds(bounds: PropLocalBounds, footprint: { w: number; h: number }) {
  const epsilon = 1e-9;
  return [bounds.x, bounds.y, bounds.w, bounds.h].every(Number.isFinite)
    && bounds.x >= 0
    && bounds.y >= 0
    && bounds.w > 0
    && bounds.h > 0
    && bounds.x + bounds.w <= footprint.w + epsilon
    && bounds.y + bounds.h <= footprint.h + epsilon;
}

export function validatePropExactFitMetadata(metadata: PropMetadata) {
  const fit = metadata.exactFit;
  const entries: Array<[string, PropLocalBounds | undefined]> = [
    ["visualBoundsTiles", fit?.visualBoundsTiles],
    ["collisionBoundsTiles", fit?.collisionBoundsTiles],
    ["customEnvelopeTiles", fit?.customEnvelopeTiles],
  ];
  for (const [name, bounds] of entries) {
    if (bounds && !validBounds(bounds, metadata.footprintTiles)) {
      throw new Error(`Prop ${metadata.id} exactFit ${name} must be positive finite bounds contained by the authored ${metadata.footprintTiles.w}×${metadata.footprintTiles.h} footprint.`);
    }
  }
  for (const [index, bounds] of propCollisionLocalBounds(metadata).entries()) {
    if (!validBounds(bounds, metadata.footprintTiles)) {
      throw new Error(`Prop ${metadata.id} collision part ${index} must be positive finite bounds contained by the authored ${metadata.footprintTiles.w}×${metadata.footprintTiles.h} footprint.`);
    }
  }
  if (fit?.placementEnvelope === "custom" && !fit.customEnvelopeTiles) {
    throw new Error(`Prop ${metadata.id} exactFit placementEnvelope=custom requires customEnvelopeTiles.`);
  }
}

function rotatePoint(x: number, y: number, rotation: PropRotation) {
  if (rotation === 0) return { x, y };
  if (rotation === 90) return { x: -y, y: x };
  if (rotation === 180) return { x: -x, y: -y };
  return { x: y, y: -x };
}

/**
 * Converts a 0° local bounds rectangle, authored in tile units inside the
 * source sprite canvas, into world-pixel AABB around the solved placement.
 */
export function transformedPropBoundsPx(
  placement: ExactFitPlacement,
  metadata: PropMetadata,
  localBounds: PropLocalBounds,
  tileSize: number,
): PixelRect {
  const authoredWidth = metadata.footprintTiles.w * tileSize;
  const authoredHeight = metadata.footprintTiles.h * tileSize;
  const sourceCenter = { x: authoredWidth / 2, y: authoredHeight / 2 };
  const worldCenter = {
    x: (placement.rect.x + placement.rect.w / 2) * tileSize,
    y: (placement.rect.y + placement.rect.h / 2) * tileSize,
  };
  const x0 = localBounds.x * tileSize;
  const y0 = localBounds.y * tileSize;
  const x1 = (localBounds.x + localBounds.w) * tileSize;
  const y1 = (localBounds.y + localBounds.h) * tileSize;
  const points = [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ].map((point) => {
    const rotated = rotatePoint(point.x - sourceCenter.x, point.y - sourceCenter.y, placement.rotation);
    return { x: worldCenter.x + rotated.x, y: worldCenter.y + rotated.y };
  });
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function translate(rect: PixelRect, offset: { x: number; y: number }): PixelRect {
  return { ...rect, x: rect.x + offset.x, y: rect.y + offset.y };
}

function unionPixelRects(parts: readonly PixelRect[]): PixelRect {
  const minX = Math.min(...parts.map((part) => part.x));
  const minY = Math.min(...parts.map((part) => part.y));
  const maxX = Math.max(...parts.map((part) => part.x + part.w));
  const maxY = Math.max(...parts.map((part) => part.y + part.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function contains(container: PixelRect, inner: PixelRect) {
  const epsilon = 1e-7;
  return inner.x + epsilon >= container.x
    && inner.y + epsilon >= container.y
    && inner.x + inner.w <= container.x + container.w + epsilon
    && inner.y + inner.h <= container.y + container.h + epsilon;
}

function touchesWall(
  placement: ExactFitPlacement,
  spaceRect: { x: number; y: number; w: number; h: number },
  side: CardinalDirection,
) {
  const epsilon = 1e-9;
  if (side === "north") return Math.abs(placement.rect.y - spaceRect.y) <= epsilon;
  if (side === "south") return Math.abs(placement.rect.y + placement.rect.h - (spaceRect.y + spaceRect.h)) <= epsilon;
  if (side === "west") return Math.abs(placement.rect.x - spaceRect.x) <= epsilon;
  return Math.abs(placement.rect.x + placement.rect.w - (spaceRect.x + spaceRect.w)) <= epsilon;
}

function wallFacePx(
  side: CardinalDirection,
  spaceRect: { x: number; y: number; w: number; h: number },
  tileSize: number,
  thicknessPx: number,
) {
  if (side === "north") return spaceRect.y * tileSize + thicknessPx / 2;
  if (side === "south") return (spaceRect.y + spaceRect.h) * tileSize - thicknessPx / 2;
  if (side === "west") return spaceRect.x * tileSize + thicknessPx / 2;
  return (spaceRect.x + spaceRect.w) * tileSize - thicknessPx / 2;
}

function alignOffset(rect: PixelRect, side: CardinalDirection, face: number) {
  if (side === "north") return { x: 0, y: face - rect.y };
  if (side === "south") return { x: 0, y: face - (rect.y + rect.h) };
  if (side === "west") return { x: face - rect.x, y: 0 };
  return { x: face - (rect.x + rect.w), y: 0 };
}

type OffsetRange = { minX: number; maxX: number; minY: number; maxY: number };

function unconstrainedRange(): OffsetRange {
  return { minX: -Infinity, maxX: Infinity, minY: -Infinity, maxY: Infinity };
}

function constrainContained(range: OffsetRange, container: PixelRect, inner: PixelRect) {
  range.minX = Math.max(range.minX, container.x - inner.x);
  range.maxX = Math.min(range.maxX, container.x + container.w - (inner.x + inner.w));
  range.minY = Math.max(range.minY, container.y - inner.y);
  range.maxY = Math.min(range.maxY, container.y + container.h - (inner.y + inner.h));
}

function constrainInsideFace(range: OffsetRange, rect: PixelRect, side: CardinalDirection, face: number) {
  if (side === "north") range.minY = Math.max(range.minY, face - rect.y);
  else if (side === "south") range.maxY = Math.min(range.maxY, face - (rect.y + rect.h));
  else if (side === "west") range.minX = Math.max(range.minX, face - rect.x);
  else range.maxX = Math.min(range.maxX, face - (rect.x + rect.w));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function resolveOffset(range: OffsetRange, preferred: { x: number; y: number }, propId: string) {
  const epsilon = 1e-7;
  if (range.minX > range.maxX + epsilon || range.minY > range.maxY + epsilon) {
    throw new Error(`Prop ${propId} exact-fit wall constraints cannot fit inside its conservative tile reservation.`);
  }
  return {
    x: clamp(preferred.x, range.minX, range.maxX),
    y: clamp(preferred.y, range.minY, range.maxY),
  };
}

/**
 * Exact Fit is a post-solve precision layer. The tile footprint remains the
 * conservative compiler/reservation envelope. Exact Fit may move the authored
 * canvas and physical collider within that reservation, but may not occupy a
 * neighboring tile.
 *
 * Gold Slice hardening:
 * - all actually touched room boundaries participate, not just one wallSide;
 * - visual-boundary Props keep their visible envelope outside visible fascia;
 * - every collision part stays outside the wall collision core;
 * - a preference/stale wallSide that is not physically touched is ignored.
 */
export function computePropExactFit(
  placement: ExactFitPlacement,
  metadata: PropMetadata,
  spaceRect: { x: number; y: number; w: number; h: number },
  tileSize: number,
  wallCollisionPx: number,
  wallVisualPx: number,
): PropExactFitResult {
  validatePropExactFitMetadata(metadata);
  const authoredWidth = metadata.footprintTiles.w * tileSize;
  const authoredHeight = metadata.footprintTiles.h * tileSize;
  const worldCenter = {
    x: (placement.rect.x + placement.rect.w / 2) * tileSize,
    y: (placement.rect.y + placement.rect.h / 2) * tileSize,
  };
  const baseSprite: PixelRect = {
    x: worldCenter.x - authoredWidth / 2,
    y: worldCenter.y - authoredHeight / 2,
    w: authoredWidth,
    h: authoredHeight,
  };
  const physicalRect: PixelRect = {
    x: placement.rect.x * tileSize,
    y: placement.rect.y * tileSize,
    w: placement.rect.w * tileSize,
    h: placement.rect.h * tileSize,
  };
  const visual = transformedPropBoundsPx(placement, metadata, resolvedVisualBounds(metadata), tileSize);
  const collisionParts = propCollisionLocalBounds(metadata)
    .map((part) => transformedPropBoundsPx(placement, metadata, part, tileSize));
  const collision = unionPixelRects(collisionParts);
  const envelope = transformedPropBoundsPx(placement, metadata, resolvedEnvelope(metadata), tileSize);
  const touchedWalls = CARDINALS.filter((side) => touchesWall(placement, spaceRect, side));

  const fit: PropExactFitMetadata | undefined = metadata.exactFit;
  let preferredOffset = { x: 0, y: 0 };
  if (fit && touchedWalls.length) {
    const primarySide = placement.wallSide && touchedWalls.includes(placement.wallSide)
      ? placement.wallSide
      : touchedWalls[0];
    const boundaryThickness = (fit.wallBoundary ?? "visual") === "collision" ? wallCollisionPx : wallVisualPx;
    preferredOffset = alignOffset(
      envelope,
      primarySide,
      wallFacePx(primarySide, spaceRect, tileSize, boundaryThickness),
    );
  }

  const range = unconstrainedRange();
  // Placement envelope and every collision island must remain inside the tile
  // reservation so precise fitting never steals space from a neighboring Prop.
  constrainContained(range, physicalRect, envelope);
  for (const part of collisionParts) constrainContained(range, physicalRect, part);

  if (fit) {
    for (const side of touchedWalls) {
      // Physical collision can never enter the 10 px collision wall core.
      const collisionFace = wallFacePx(side, spaceRect, tileSize, wallCollisionPx);
      for (const part of collisionParts) constrainInsideFace(range, part, side, collisionFace);

      // Props authored against visible fascia keep their visible silhouette out
      // of the accepted 30 px wall body on every touched side, including corners.
      if ((fit.wallBoundary ?? "visual") === "visual") {
        constrainInsideFace(range, visual, side, wallFacePx(side, spaceRect, tileSize, wallVisualPx));
      }
    }
  }

  const offset = resolveOffset(range, preferredOffset, metadata.id);
  const finalVisual = translate(visual, offset);
  const finalCollisionParts = collisionParts.map((part) => translate(part, offset));
  const finalCollision = unionPixelRects(finalCollisionParts);
  const finalEnvelope = translate(envelope, offset);

  if (!contains(physicalRect, finalEnvelope)) {
    throw new Error(`Prop ${metadata.id} exact-fit placement envelope leaves its solved tile footprint; adjust visual/collision/custom bounds instead of expanding into unrelated tiles.`);
  }
  for (const part of finalCollisionParts) {
    if (!contains(physicalRect, part)) {
      throw new Error(`Prop ${metadata.id} exact-fit collision leaves its solved tile footprint; collision metadata must remain inside the conservative tile reservation.`);
    }
  }

  return {
    offsetPx: offset,
    spriteRectPx: translate(baseSprite, offset),
    visualBoundsPx: finalVisual,
    collisionBoundsPx: finalCollision,
    collisionPartsPx: finalCollisionParts,
    placementEnvelopePx: finalEnvelope,
    touchedWalls,
  };
}
