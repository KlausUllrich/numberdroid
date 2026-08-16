import { compilePropPlacement, rotatedFootprint, rotationBackSide, wallSideRotation } from "./placement";
import type { HardenedNavigationCompilePlan } from "./navigationHardening";
import type { PropPlacementDecision, PropPlacementPlan } from "./placementTypes";

/**
 * Rotation is now solved inside candidate placement because it changes the
 * physical footprint and use-space. This type remains as the stable downstream
 * contract used by actor/event/emission stages.
 */
export type OrientedPropPlacementDecision = PropPlacementDecision;

export type OrientedPropPlacementPlan = Omit<PropPlacementPlan, "navigation"> & {
  navigation: HardenedNavigationCompilePlan;
  placements: OrientedPropPlacementDecision[];
};

export { rotatedFootprint, rotationBackSide, wallSideRotation };

export function compileOrientedPropPlacement(navigation: HardenedNavigationCompilePlan): OrientedPropPlacementPlan {
  const base = compilePropPlacement(navigation);
  return {
    ...base,
    navigation,
    diagnostics: [
      ...base.diagnostics,
      {
        level: "info",
        code: "PROP_ROTATIONS_RESOLVED",
        message: `Resolved allowed rotations together with geometry for ${base.placements.length} placed prop instance(s).`,
      },
    ],
  };
}
