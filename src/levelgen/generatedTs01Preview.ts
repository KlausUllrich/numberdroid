import type { CompositeFloorVisualDefinition, FloorDefinition } from "../game/types";
import { compileRuntimeLevel } from "./emission";
import type { RuntimeEmissionPlan } from "./emissionTypes";
import { familyFloorSprites } from "./familyFloorPresentation";
import { mainHallFloorSprites } from "./mainHallFloorPresentation";
import { createPlayableCompilerPreview } from "./playablePreview";
import { compileAndValidatePropExactFits } from "./propExactFitPlan";
import { primusFloorSprites } from "./primusFloorPresentation";
import { NUMBERDROID_PROP_REGISTRY } from "./propRegistry";
import { TS01_LEVEL_SPEC } from "./specs/ts01";
import { transferFloorSprites } from "./transferFloorPresentation";
import { yellowCoreSprite } from "./transferFxPresentation";
import type { LevelSpec } from "./types";

export const TS01_PLAYABLE_SPEC: LevelSpec = {
  ...TS01_LEVEL_SPEC,
  runtime: {
    ...TS01_LEVEL_SPEC.runtime,
    tileSize: 64,
    wallCollisionPx: 10,
    wallVisualPx: 30,
    floorName: "TS-01 · GENERATED",
    subtitle: "LEVEL COMPILER · PLAYABLE PREVIEW V0.13.2",
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

/**
 * Gold Slice gate: precise envelopes may shift beyond their coarse tile anchors,
 * but only into room area that remains free after furnishing/use-space/door
 * constraints. Importing the generated Floor fails loudly if that invariant is
 * violated instead of shipping a visually overlapping composition.
 */
export const TS01_GENERATED_EXACT_FITS = compileAndValidatePropExactFits(TS01_GENERATED_PLAN);

function withTs01ArtExtensions(floor: FloorDefinition): FloorDefinition {
  if (floor.visual.kind !== "composite") return floor;

  // The accepted Floor remains the common ship base. Room-specific material
  // families are deterministic 1x1 overlays in the existing pre-Architecture
  // FloorFX pass, before Prop/Actor grounding shadows. They are presentation
  // only and do not alter compiler geometry, collision or navigation truth.
  const familyTiles = familyFloorSprites(TS01_GENERATED_PLAN);
  const hallTiles = mainHallFloorSprites(TS01_GENERATED_PLAN);
  const transferTiles = transferFloorSprites(TS01_GENERATED_PLAN);
  const primusTiles = primusFloorSprites(TS01_GENERATED_PLAN);
  const roomFloorTiles = [...familyTiles, ...hallTiles, ...transferTiles, ...primusTiles];
  const layers = floor.visual.layers.map((layer) => {
    if (layer.id !== "floor-fx" || layer.kind !== "sprites" || roomFloorTiles.length === 0) return layer;
    return { ...layer, sprites: [...roomFloorTiles, ...layer.sprites] };
  });

  const core = yellowCoreSprite(TS01_GENERATED_PLAN, TS01_GENERATED_EXACT_FITS);
  const visual: CompositeFloorVisualDefinition = {
    ...floor.visual,
    layers: core
      ? [
          ...layers,
          // Separate from the accepted Apparatus Prop so the Core can later move
          // between bodies without changing Prop collision or the source artwork.
          { id: "transfer-fx", kind: "sprites", sprites: [core] },
        ]
      : layers,
  };
  return { ...floor, visual };
}

/** Existing MetaGame-compatible floor plus presentation-only compiler overlays. */
export const TS01_GENERATED_FLOOR: FloorDefinition = withTs01ArtExtensions(createPlayableCompilerPreview(TS01_GENERATED_PLAN));

/** Friendly URL alias; the canonical generated FloorDefinition keeps the LevelSpec id. */
export const TS01_GENERATED_PREVIEW_ALIAS = "ts01-generated";
