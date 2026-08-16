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
  /** Axis-aligned runtime collision after cardinal rotation. */
  collisionBoundsPx: PixelRect;
  /** Envelope chosen to touch the selected wall surface. */
  placementEnvelopePx: PixelRect;
};

function fullBounds(metadata: PropMetadata): PropLocalBounds {
  return { x: 0, y: 0, w: metadata.footprintTiles.w, h: metadata.footprintTiles.h };
}

function resolvedVisualBounds(metadata: PropMetadata) {
  return metadata.exactFit?.visualBoundsTiles ?? fullBounds(metadata);
}

function resolvedCollisionBounds(metadata: PropMetadata) {
  return metadata.exactFit?.collisionBoundsTiles ?? fullBounds(metadata);
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

function keepCollisionInsideRoom(
  collision: PixelRect,
  offset: { x: number; y: number },
  side: CardinalDirection,
  collisionFace: number,
) {
  const shifted = translate(collision, offset);
  if (side === "north" && shifted.y < collisionFace) return { ...offset, y: offset.y + collisionFace - shifted.y };
  if (side === "south" && shifted.y + shifted.h > collisionFace) return { ...offset, y: offset.y - (shifted.y + shifted.h - collisionFace) };
  if (side === "west" && shifted.x < collisionFace) return { ...offset, x: offset.x + collisionFace - shifted.x };
  if (side === "east" && shifted.x + shifted.w > collisionFace) return { ...offset, x: offset.x - (shifted.x + shifted.w - collisionFace) };
  return offset;
}

/**
 * Exact fit is deliberately a post-solve precision layer. The tile footprint
 * remains the conservative compiler/reservation envelope, while this function
 * resolves sub-tile wall surface alignment and the actual runtime collision.
 */
export function computePropExactFit(
  placement: ExactFitPlacement,
  metadata: PropMetadata,
  spaceRect: { x: number; y: number; w: number; h: number },
  tileSize: number,
  wallCollisionPx: number,
  wallVisualPx: number,
): PropExactFitResult {
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
  const visual = transformedPropBoundsPx(placement, metadata, resolvedVisualBounds(metadata), tileSize);
  const collision = transformedPropBoundsPx(placement, metadata, resolvedCollisionBounds(metadata), tileSize);
  const envelope = transformedPropBoundsPx(placement, metadata, resolvedEnvelope(metadata), tileSize);

  let offset = { x: 0, y: 0 };
  const fit: PropExactFitMetadata | undefined = metadata.exactFit;
  const side = placement.wallSide ?? undefined;
  if (fit && side) {
    const boundaryThickness = (fit.wallBoundary ?? "visual") === "collision" ? wallCollisionPx : wallVisualPx;
    offset = alignOffset(envelope, side, wallFacePx(side, spaceRect, tileSize, boundaryThickness));
    // A visual envelope may be intentionally larger/smaller than collision, but
    // the physical collider may never overlap the wall collision core.
    offset = keepCollisionInsideRoom(
      collision,
      offset,
      side,
      wallFacePx(side, spaceRect, tileSize, wallCollisionPx),
    );
  }

  return {
    offsetPx: offset,
    spriteRectPx: translate(baseSprite, offset),
    visualBoundsPx: translate(visual, offset),
    collisionBoundsPx: translate(collision, offset),
    placementEnvelopePx: translate(envelope, offset),
  };
}
