export { compileLevelSpec } from "./compiler";
export { compileLevelGeometry } from "./geometry";
export { compileLevelNavigation } from "./navigation";
export { compileLevelNavigationV031 } from "./navigationHardening";
export type { DoorClearanceZone, HardenedNavigationCompilePlan } from "./navigationHardening";
export { compilePropPlacement } from "./placement";
export {
  compileOrientedPropPlacement,
  rotatedFootprint,
  rotationBackSide,
  wallSideRotation,
} from "./orientedPlacement";
export type { OrientedPropPlacementDecision, OrientedPropPlacementPlan } from "./orientedPlacement";
export { computePropExactFit, transformedPropBoundsPx, validatePropExactFitMetadata } from "./propExactFit";
export type { ExactFitPlacement, PixelRect, PropExactFitResult } from "./propExactFit";
export { compileActorPlacement } from "./actorPlacement";
export type * from "./actorPlacementTypes";
export { compileTriggerEvents } from "./eventCompilation";
export type * from "./eventCompilationTypes";
export { emitRuntimeLevel, compileRuntimeLevel } from "./emission";
export type * from "./emissionTypes";
export {
  artSpriteForPlacement,
  compilerCompositePreviewVisual,
  createPlayableCompilerPreview,
} from "./playablePreview";
export {
  TS01_GENERATED_FLOOR,
  TS01_GENERATED_PLAN,
  TS01_GENERATED_PREVIEW_ALIAS,
  TS01_PLAYABLE_SPEC,
} from "./generatedTs01Preview";
export { NUMBERDROID_PROP_REGISTRY } from "./propRegistry";
export { NUMBERDROID_PROP_ART_REGISTRY, propArtRegistration } from "./propArtRegistry";
export type { PropArtRegistration, PropArtRegistry, PropArtStatus } from "./propArtRegistry";
export { overrideFor, locallyVariedSeed, validatePlacementOverrides, withOverride } from "./overrides";
export {
  activeOverride,
  compileWorkbenchPlan,
  materializeGeometryLock,
  materializePropLock,
  nudgeLockedGeometry,
  nudgeLockedProp,
  overrideJson,
  regenerateSemanticTarget,
  resetOverride,
  resizeLockedGeometry,
  setPreferredSide,
  setPreferredWall,
  tryCompileWorkbenchPlan,
  unlockGeometry,
  unlockProp,
} from "./workbench";
export type { WorkbenchCompileResult, WorkbenchSelection } from "./workbench";
export { deriveSubSeed, normalizeLevelSeed, seededUnit } from "./seed";
export { TS01_LEVEL_SPEC } from "./specs/ts01";
export type * from "./types";
export type * from "./geometryTypes";
export type * from "./navigationTypes";
export type * from "./placementTypes";
