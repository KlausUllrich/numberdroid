// @ts-expect-error A4c intentionally composes the JavaScript-only Studio adapter boundary.
import { createNumberdroidA4cCandidateComposer, NUMBERDROID_A4B_PROJECT_CAPABILITY_MANIFEST } from "../../tools/numberdroid-studio/packages/numberdroid-adapter/src/index.js";
// @ts-expect-error A4c intentionally composes the JavaScript-only Studio application boundary.
import { LevelCandidateApplicationService } from "../../tools/numberdroid-studio/packages/application/src/index.js";
// @ts-expect-error A4c intentionally composes the JavaScript-only Studio persistence boundary.
import { SqliteLevelCandidateStore } from "../../tools/numberdroid-studio/packages/persistence/src/index.js";
import { compileLevelSpec } from "../levelgen/compiler";
import { validatePlacementOverrides } from "../levelgen/overrides";
import { NUMBERDROID_PROP_REGISTRY } from "../levelgen/propRegistry";
import { A4B_REFERENCE_LEVEL_SPEC } from "../levelgen/specs/a4bReference";
import type { LevelSpec } from "../levelgen/types";

export const NUMBERDROID_A4C_COMPILER_PIN = "numberdroid-level-compiler.sha256:01b144303ff217054f01c0dcd85acc3d442a02c1727ad9b01291dcc5c2559ce1";

export const NUMBERDROID_A4C_CANDIDATE_COMPOSER = createNumberdroidA4cCandidateComposer({
  levelSpec: A4B_REFERENCE_LEVEL_SPEC,
  compiler: Object.freeze({
    compilerVersion: NUMBERDROID_A4C_COMPILER_PIN,
    validatePlacementOverrides,
    compileLevelSpec(spec: LevelSpec) {
      return compileLevelSpec(spec, NUMBERDROID_PROP_REGISTRY);
    },
  }),
});

export const NUMBERDROID_A4C_ENGINE_BRIDGE = Object.freeze({
  schemaVersion: 1,
  kind: "studio.engine-bridge",
  mode: "VALIDATE_ONLY",
  direction: "CANDIDATE_TO_ENGINE",
  bridge: {
    id: "numberdroid.level-candidate-validator",
    version: "numberdroid.a4c-bridge.v1",
  },
  validateCandidate(selection: {
    candidateFingerprint: string;
    candidateManifest: {
      status: string;
      capabilityProfile: { profileVersion: number; fingerprint: string };
      compiler: { version: string; status: string };
      artifacts: unknown[];
      stages: { materialize: string; commit: string; publish: string };
    };
  }) {
    const manifest = selection.candidateManifest;
    if (manifest.status !== "VERIFIED"
      || manifest.capabilityProfile.profileVersion !== 3
      || manifest.capabilityProfile.fingerprint !== "6079209041cb71a3e7c8b36ea41796c2e38ea6ef828bf78829e8f0dc4ea3f074"
      || manifest.compiler.version !== NUMBERDROID_A4C_COMPILER_PIN
      || manifest.compiler.status !== "SUCCEEDED"
      || manifest.artifacts.length !== 0
      || manifest.stages.materialize !== "NOT_AUTHORIZED"
      || manifest.stages.commit !== "NOT_AUTHORIZED"
      || manifest.stages.publish !== "NOT_AUTHORIZED") {
      throw new Error("The candidate is outside the exact Numberdroid A4c validation closure.");
    }
    return {
      schemaVersion: 1,
      kind: "studio.engine-bridge.validation-receipt",
      status: "VALIDATED",
      bridge: this.bridge,
      candidateFingerprint: selection.candidateFingerprint,
      evidenceHash: selection.candidateFingerprint,
    };
  },
});

export function createNumberdroidA4cCandidateApplication({
  workspace,
  clock = () => new Date().toISOString(),
}: {
  workspace: unknown;
  clock?: () => string;
}) {
  const configuredBinding = {
    composer: NUMBERDROID_A4C_CANDIDATE_COMPOSER.binding,
    capabilityManifestFingerprint: NUMBERDROID_A4C_CANDIDATE_COMPOSER.binding.profileFingerprint,
    engineBridge: NUMBERDROID_A4C_ENGINE_BRIDGE.bridge,
  };
  const store = new SqliteLevelCandidateStore({ workspace, configuredBinding });
  return new LevelCandidateApplicationService({
    candidateComposer: NUMBERDROID_A4C_CANDIDATE_COMPOSER,
    capabilityManifest: NUMBERDROID_A4B_PROJECT_CAPABILITY_MANIFEST,
    engineBridge: NUMBERDROID_A4C_ENGINE_BRIDGE,
    store,
    clock,
  });
}
