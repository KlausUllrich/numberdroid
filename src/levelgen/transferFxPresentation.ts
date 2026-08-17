import { publicAsset } from "../game/assets";
import type { FloorVisualSpriteDefinition } from "../game/types";
import type { RuntimeEmissionPlan } from "./emissionTypes";
import type { CompiledPropExactFit } from "./propExactFitPlan";

export const YELLOW_CORE_RUNTIME_CANDIDATE = {
  asset: "assets/deck/yellow-core.png",
  widthPx: 96,
  heightPx: 96,
  status: "candidate" as const,
};

/**
 * Presentation-only Yellow Core placement for the current Transfer System.
 *
 * The Core is deliberately not a Prop: it has no collision or placement
 * footprint of its own because later story choreography must be able to move it
 * from the Apparatus into robot bodies. For the current static QA state it is
 * centered on the accepted Transfer Apparatus canvas as its resting location.
 */
export function yellowCoreSprite(
  plan: RuntimeEmissionPlan,
  exactFits: readonly CompiledPropExactFit[],
): FloorVisualSpriteDefinition | null {
  const apparatus = exactFits.find((entry) => entry.placementId === "transfer-core");
  if (!apparatus) return null;

  const bounds = plan.events.actors.props.navigation.bounds;
  const originX = bounds.x * plan.tileSize;
  const originY = bounds.y * plan.tileSize;
  const canvas = apparatus.fit.spriteRectPx;
  const centerX = canvas.x - originX + canvas.w / 2;
  const centerY = canvas.y - originY + canvas.h / 2;

  return {
    id: "yellow-core",
    asset: publicAsset(YELLOW_CORE_RUNTIME_CANDIDATE.asset),
    x: centerX - YELLOW_CORE_RUNTIME_CANDIDATE.widthPx / 2,
    y: centerY - YELLOW_CORE_RUNTIME_CANDIDATE.heightPx / 2,
    width: YELLOW_CORE_RUNTIME_CANDIDATE.widthPx,
    height: YELLOW_CORE_RUNTIME_CANDIDATE.heightPx,
  };
}
