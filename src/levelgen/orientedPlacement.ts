import { compilePropPlacement } from "./placement";
import { deriveSubSeed, seededUnit } from "./seed";
import type { CardinalDirection, PropRotation } from "./types";
import type { HardenedNavigationCompilePlan } from "./navigationHardening";
import type { PropPlacementDecision, PropPlacementPlan } from "./placementTypes";

export type OrientedPropPlacementDecision = PropPlacementDecision & {
  rotation: PropRotation;
};

export type OrientedPropPlacementPlan = Omit<PropPlacementPlan, "placements" | "navigation"> & {
  navigation: HardenedNavigationCompilePlan;
  placements: OrientedPropPlacementDecision[];
};

export function wallSideRotation(side: CardinalDirection): PropRotation {
  if (side === "north") return 0;
  if (side === "east") return 90;
  if (side === "south") return 180;
  return 270;
}

function chooseFloorRotation(
  allowed: PropRotation[],
  footprint: { w: number; h: number },
  seed: number,
  placementId: string,
): PropRotation {
  // v0.3 placement currently enumerates the authored footprint orientation.
  // 90°/270° are therefore safe without a new footprint solve only for square assets.
  const compatible = footprint.w === footprint.h
    ? allowed
    : allowed.filter((rotation) => rotation === 0 || rotation === 180);
  if (!compatible.length) {
    throw new Error(`Prop ${placementId} has no allowed rotation compatible with its current solved footprint.`);
  }
  const unit = seededUnit(deriveSubSeed(seed, `rotation/${placementId}`));
  return compatible[Math.min(compatible.length - 1, Math.floor(unit * compatible.length))];
}

export function compileOrientedPropPlacement(navigation: HardenedNavigationCompilePlan): OrientedPropPlacementPlan {
  const base = compilePropPlacement(navigation);
  const requests = new Map(base.navigation.geometry.semantic.props.map((request) => [request.id, request]));

  const placements = base.placements.map((placement): OrientedPropPlacementDecision => {
    const request = requests.get(placement.requestId);
    if (!request) throw new Error(`Placement ${placement.id} cannot resolve semantic prop request ${placement.requestId}.`);
    const allowed = request.metadata.allowedRotations;
    if (!allowed.length) throw new Error(`Prop ${request.propId} must declare at least one allowed rotation.`);

    let rotation: PropRotation;
    if (request.metadata.attachment === "wall") {
      if (!placement.wallSide) throw new Error(`Wall prop ${placement.id} has no solved wall side.`);
      rotation = wallSideRotation(placement.wallSide);
      if (!allowed.includes(rotation)) {
        throw new Error(
          `Prop ${placement.id} was solved on ${placement.wallSide} wall, requiring ${rotation}°, but ${request.propId} allows only ${allowed.join("/")}°.`
        );
      }
    } else {
      rotation = chooseFloorRotation(allowed, request.metadata.footprintTiles, request.seed, placement.id);
    }

    return {
      ...placement,
      rotation,
      reasons: [...placement.reasons, `rotation ${rotation}° allowed`],
    };
  });

  return {
    ...base,
    navigation,
    placements,
    diagnostics: [
      ...base.diagnostics,
      {
        level: "info",
        code: "PROP_ROTATIONS_RESOLVED",
        message: `Resolved allowed 4-direction rotations for ${placements.length} placed prop instance(s).`,
      },
    ],
  };
}
