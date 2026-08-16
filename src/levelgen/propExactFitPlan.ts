import type { RuntimeEmissionPlan } from "./emissionTypes";
import { computePropExactFit, type PixelRect, type PropExactFitResult } from "./propExactFit";

export type CompiledPropExactFit = {
  placementId: string;
  requestId: string;
  spaceId: string;
  fit: PropExactFitResult;
};

function intersects(a: PixelRect, b: PixelRect) {
  const epsilon = 1e-7;
  return a.x < b.x + b.w - epsilon
    && a.x + a.w > b.x + epsilon
    && a.y < b.y + b.h - epsilon
    && a.y + a.h > b.y + epsilon;
}

function cellRect(cell: { x: number; y: number }, tileSize: number): PixelRect {
  return { x: cell.x * tileSize, y: cell.y * tileSize, w: tileSize, h: tileSize };
}

/**
 * Compile and validate the final true-space geometry of every Prop.
 *
 * Integer footprints remain deterministic solver anchors. A translated exact
 * envelope may cross its own anchor boundary, but it may not steal room that
 * the compiler already reserved for another Prop/use-space or Door Clearance.
 * This is the missing bridge between coarse tile solving and precise production
 * geometry; it remains entirely declarative and does not inspect PNG alpha/DOM.
 */
export function compileAndValidatePropExactFits(plan: RuntimeEmissionPlan): CompiledPropExactFit[] {
  const props = plan.events.actors.props;
  const geometry = props.navigation.geometry;
  const requestById = new Map(geometry.semantic.props.map((entry) => [entry.id, entry]));
  const spaceById = new Map(geometry.spaces.map((entry) => [entry.id, entry]));

  const compiled = props.placements.map((placement): CompiledPropExactFit => {
    const request = requestById.get(placement.requestId);
    const space = spaceById.get(placement.spaceId);
    if (!request) throw new Error(`Exact Fit plan cannot resolve Prop request ${placement.requestId}.`);
    if (!space) throw new Error(`Exact Fit plan cannot resolve Space ${placement.spaceId}.`);
    return {
      placementId: placement.id,
      requestId: placement.requestId,
      spaceId: placement.spaceId,
      fit: computePropExactFit(
        placement,
        request.metadata,
        space.rect,
        plan.tileSize,
        plan.wallCollisionPx,
        plan.wallVisualPx,
      ),
    };
  });

  // Exact placement envelopes are the composition-space truth for pairwise Prop
  // separation. Touching is allowed; positive-area overlap is not.
  for (let i = 0; i < compiled.length; i += 1) {
    for (let j = i + 1; j < compiled.length; j += 1) {
      const a = compiled[i];
      const b = compiled[j];
      if (a.spaceId !== b.spaceId) continue;
      if (intersects(a.fit.placementEnvelopePx, b.fit.placementEnvelopePx)) {
        throw new Error(`Exact Fit overlap: Prop ${a.placementId} intersects Prop ${b.placementId} after sub-tile fitting.`);
      }
    }
  }

  // A translated object may not consume another Prop's authored interaction /
  // hero breathing room. Its own reservations are intentionally ignored.
  for (const entry of compiled) {
    for (const reservation of props.reservations) {
      if (reservation.ownerPlacementId === entry.placementId) continue;
      if (reservation.spaceId !== entry.spaceId) continue;
      if (intersects(entry.fit.placementEnvelopePx, cellRect(reservation, plan.tileSize))) {
        throw new Error(`Exact Fit reservation conflict: Prop ${entry.placementId} enters ${reservation.kind} reserved by ${reservation.ownerPlacementId}.`);
      }
    }
  }

  // Door clearance remains a hard authoring constraint after sub-tile movement.
  const doorCells = props.navigation.forbiddenCells.filter((cell) => cell.reasons.includes("door-clearance"));
  for (const entry of compiled) {
    for (const cell of doorCells) {
      if (cell.spaceId !== entry.spaceId) continue;
      if (intersects(entry.fit.placementEnvelopePx, cellRect(cell, plan.tileSize))) {
        throw new Error(`Exact Fit door-clearance conflict: Prop ${entry.placementId} enters reserved Door Clearance at ${cell.x},${cell.y}.`);
      }
    }
  }

  return compiled;
}
