import type { FloorDefinition } from "../game/types";
import { compileRuntimeLevel } from "./emission";
import type { RuntimeEmissionPlan } from "./emissionTypes";
import { createPlayableCompilerPreview } from "./playablePreview";
import { NUMBERDROID_PROP_REGISTRY } from "./propRegistry";
import { TS01_LEVEL_SPEC } from "./specs/ts01";
import type { LevelSpec } from "./types";

export const TS01_PLAYABLE_SPEC: LevelSpec = {
  ...TS01_LEVEL_SPEC,
  runtime: {
    ...TS01_LEVEL_SPEC.runtime,
    tileSize: 64,
    wallCollisionPx: 10,
    floorName: "TS-01 · GENERATED",
    subtitle: "LEVEL COMPILER · PLAYABLE PREVIEW V0.7",
    objectiveDefault: "ERKUNDE DEN VOM COMPILER ERZEUGTEN LEVEL · FINDE PRIMUS ACCESS",
    objectiveAfterEnergy: "ERKUNDE DEN VOM COMPILER ERZEUGTEN LEVEL",
    start: {
      spaceId: "family-living",
      bodyId: "pico",
      facing: 90,
      metaEnergy: 0,
      preferredSide: "west",
    },
  },
};

/** Complete compiler output retained for Workbench/runtime QA. */
export const TS01_GENERATED_PLAN: RuntimeEmissionPlan = compileRuntimeLevel(TS01_PLAYABLE_SPEC, NUMBERDROID_PROP_REGISTRY);

/** Existing MetaGame-compatible floor plus presentation-only compiler blockout overlays. */
export const TS01_GENERATED_FLOOR: FloorDefinition = createPlayableCompilerPreview(TS01_GENERATED_PLAN);

/** Friendly URL alias; the canonical generated FloorDefinition keeps the LevelSpec id. */
export const TS01_GENERATED_PREVIEW_ALIAS = "ts01-generated";
