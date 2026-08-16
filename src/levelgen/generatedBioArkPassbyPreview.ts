import type { FloorDefinition } from "../game/types";
import { compileRuntimeLevel } from "./emission";
import type { RuntimeEmissionPlan } from "./emissionTypes";
import { createPlayableCompilerPreview } from "./playablePreview";
import { NUMBERDROID_PROP_REGISTRY } from "./propRegistry";
import { BIOARK_PASSBY_PROOF_SPEC } from "./specs/bioArkPassbyProof";

export const BIOARK_PASSBY_GENERATED_PLAN: RuntimeEmissionPlan = compileRuntimeLevel(
  BIOARK_PASSBY_PROOF_SPEC,
  NUMBERDROID_PROP_REGISTRY,
);

export const BIOARK_PASSBY_GENERATED_FLOOR: FloorDefinition = createPlayableCompilerPreview(
  BIOARK_PASSBY_GENERATED_PLAN,
);

export const BIOARK_PASSBY_PREVIEW_ALIAS = "bioark-passby";
