import { describe, expect, it } from "vitest";
// @ts-expect-error A4a intentionally verifies the JavaScript-only Studio adapter boundary.
import {
  NUMBERDROID_PROJECT_CAPABILITY_FINGERPRINT,
  createNumberdroidLevelAuthoringProjection,
  validateNumberdroidLevelAuthoringProjection,
} from "../../tools/numberdroid-studio/packages/numberdroid-adapter/src/index.js";
// @ts-expect-error The Node-only authority hash helper stays outside the browser TypeScript graph.
import { numberdroidLevelCompilerVersion } from "../../tools/numberdroid-studio/tests/helpers/numberdroid-level-compiler-authority.js";
import { compileLevelSpec } from "./compiler";
import { validatePlacementOverrides } from "./overrides";
import { NUMBERDROID_PROP_REGISTRY } from "./propRegistry";
import { BIOARK_PASSBY_PROOF_SPEC } from "./specs/bioArkPassbyProof";
import { TS01_LEVEL_SPEC } from "./specs/ts01";
import type { LevelSpec } from "./types";

const COMPILER_VERSION = "numberdroid-level-compiler.sha256:a1e3a0983ad0777759a2619b7c7053a0c520d336033bc59872d908489290ce40";
const compiler = Object.freeze({
  compilerVersion: numberdroidLevelCompilerVersion(new URL("../../", import.meta.url)),
  validatePlacementOverrides,
  compileLevelSpec(spec: LevelSpec) {
    return compileLevelSpec(spec, NUMBERDROID_PROP_REGISTRY);
  },
});

const FLAG_LEVEL_SPEC: LevelSpec = {
  id: "a4a-flag-proof",
  version: 1,
  seed: "A4A-FLAG-PROOF",
  ruleSetRefs: ["numberdroid/base", "proof/a4a-flag"],
  rules: {
    ensureReachability: false,
    singleSharedWall: true,
    doorsEmbeddedInWalls: true,
    defaultCorridorWidth: { min: 1, preferred: 2, max: 3 },
    defaultDoorClearance: { before: 1, after: 1 },
  },
  spaces: [{ id: "flag-room", kind: "room", archetype: "proof-room", size: { class: "small" } }],
  connections: [],
  props: [],
  encounters: [],
  triggers: [{ id: "flag-trigger", kind: "state-change", sourceId: "flag.ready", eventIds: ["set-ready"], once: true }],
  events: [{ id: "set-ready", kind: "set-flag", flag: "flag.ready", value: true }],
  overrides: [],
};

const HASHES = Object.freeze({
  ts01: {
    source: "cd2a3e0b6fb7f71090155a0b037af81cbfc4916107ac07a84b59e7be7a1a3f97",
    plan: "ce72378232b9b089bf619a6f848aa4e39f817b8263706e622883e34b9063bf9e",
    requirements: "a3df3bd0300a18ce4892f1baeb812f4fdb345f081689006483bdab8221077da9",
    level: "593ddaf28067d78289127b3eee5e63d52d94f883aa17e4b75afdd2c210b7aa42",
    logic: "ac6dcab9775188ee0416577c8e2af1df1c1d4cbe2c2273ffbab6f0f3c84777d9",
    projection: "ce94e0433d1700c475df2059cc6b13dc4a1ab302e6cdafafe964287dd5a68bb1",
  },
  bioark: {
    source: "c518203d3436b42de0c87fff4f48663edaa3c7fa23c05bf14f279b376a9c6f32",
    plan: "898008b6a7ab729810bf3c3dc7b2330ed28e6b7b666159638f3917edaacf8660",
    requirements: "3a713d8d23d4d534989815d6c4bdde9d4e1ce67cc557843185470c9d8b51493b",
    level: "fed30380f21dddf6be3b69291f73abe1eb9ea38da38b7a2713e1f70d6ca6caf7",
    logic: "5669efe5ce33880209292bcf7977ba0fcca6acdcf5b3ede022632bc333045cc7",
    projection: "33d810c4acc5d1f64f4395822898b0fd6a72d5d7f4e4b94f5a47f076623acbe8",
  },
  flag: {
    source: "3da9fcd9f093f17a08ba28cf72cdcc33e52b203ff73feae4d317fe05ebe58918",
    plan: "e39e819e4a6e0a488da38cc40a3da3e894b9a8e9b5804f6e3da117b2e6327d97",
    requirements: "704365cef198da692679d62b0370908f9face64c35b2e82bcee925c7e6972d65",
    level: "20e0459f765adacb5e5eae3215c8e63f3f43c12b0d12944643342f4093f29f17",
    logic: "fdb6f0b08b3d0479a3b5da06daf0e2f8d616c0ecb8cbd3cd403147abd0dc28aa",
    projection: "3da1b2ff87f0ec4103351b7dea134cd73027276cc6abe1e1c1f0dd4e84f739a4",
  },
});

function project(spec: LevelSpec) {
  return createNumberdroidLevelAuthoringProjection({ levelSpec: spec, compiler });
}

function expectHashes(projection: ReturnType<typeof project>, expected: (typeof HASHES)[keyof typeof HASHES]) {
  expect(projection.source.sha256).toBe(expected.source);
  expect(projection.compiler.sha256).toBe(expected.plan);
  expect(projection.a3a.requirementSetFingerprint).toBe(expected.requirements);
  expect(projection.a3a.levelGraphFingerprint).toBe(expected.level);
  expect(projection.a3a.logicGraphFingerprint).toBe(expected.logic);
  expect(projection.fingerprint).toBe(expected.projection);
}

describe("A4a Numberdroid level-authoring projection", () => {
  it("pins the exact current Numberdroid compiler authority", () => {
    expect(compiler.compilerVersion).toBe(COMPILER_VERSION);
  });

  it("projects and pins the real TS-01 gold-slice closure without capability activation", () => {
    const projection = project(TS01_LEVEL_SPEC);
    expectHashes(projection, HASHES.ts01);
    expect(projection.source.levelSpec.spaces).toHaveLength(TS01_LEVEL_SPEC.spaces.length);
    expect(projection.compiler.semanticPlan.props).toHaveLength(TS01_LEVEL_SPEC.props.length);
    expect(projection.a3a.levelGraph.spaces).toHaveLength(TS01_LEVEL_SPEC.spaces.length);
    expect(projection.a3a.levelGraph.connections).toHaveLength(TS01_LEVEL_SPEC.connections.length);
    expect(projection.a3a.levelGraph.placements).toEqual([]);
    expect(projection.a3a.levelGraph.actors).toEqual([]);
    expect(projection.a3a.logicGraph.actions).toEqual([]);
    expect(projection.capabilityDelta.status).toBe("NOT_ADVERTISED");
    expect(projection.capabilityDelta.baseline.fingerprint).toBe(NUMBERDROID_PROJECT_CAPABILITY_FINGERPRINT);
    expect(NUMBERDROID_PROJECT_CAPABILITY_FINGERPRINT).toBe("826a8b7942ccba97393f55efa356525529994ad34189446992a7dff58fe97049");
  });

  it("pins the real Bio-Ark runtime, staged-actor, route, zone, and pass-by closure", () => {
    const projection = project(BIOARK_PASSBY_PROOF_SPEC);
    expectHashes(projection, HASHES.bioark);
    expect(projection.source.levelSpec.runtime).toEqual(BIOARK_PASSBY_PROOF_SPEC.runtime);
    expect(projection.compiler.semanticPlan.runtime).toEqual(BIOARK_PASSBY_PROOF_SPEC.runtime);
    expect(projection.compiler.semanticPlan.stagedActors).toEqual(BIOARK_PASSBY_PROOF_SPEC.stagedActors);
    expect(projection.compiler.semanticPlan.events).toEqual(BIOARK_PASSBY_PROOF_SPEC.events);
    expect(projection.a3a.levelGraph.routes.map((route: { routeId: string }) => route.routeId)).toEqual(["grazer-pass-route"]);
    expect(projection.gaps.map((gap: { gapId: string }) => gap.gapId)).toContain("numberdroid.staged-actors.archetype-version-missing");
  });

  it("retains set-flag exactly while reporting the missing typed declaration", () => {
    const projection = project(FLAG_LEVEL_SPEC);
    expectHashes(projection, HASHES.flag);
    expect(projection.compiler.semanticPlan.events).toEqual(FLAG_LEVEL_SPEC.events);
    expect(projection.a3a.logicGraph.variables).toEqual([]);
    expect(projection.gaps.map((gap: { gapId: string }) => gap.gapId)).toContain("numberdroid.flags.declaration-type-initial-value-missing");
  });

  it("keeps graph identity stable across content edits while changing fingerprints", () => {
    const baseline = project(TS01_LEVEL_SPEC);
    const editedSpec = structuredClone(TS01_LEVEL_SPEC);
    editedSpec.seed = "TS01-A4A-IDENTITY-EDIT";
    const edited = project(editedSpec);
    expect(edited.a3a.requirementSet.requirementSetId).toBe(baseline.a3a.requirementSet.requirementSetId);
    expect(edited.a3a.levelGraph.levelGraphId).toBe(baseline.a3a.levelGraph.levelGraphId);
    expect(edited.a3a.logicGraph.logicGraphId).toBe(baseline.a3a.logicGraph.logicGraphId);
    expect(edited.source.sha256).not.toBe(baseline.source.sha256);
    expect(edited.fingerprint).not.toBe(baseline.fingerprint);
  });

  it("round-trips a serialized projection through the hostile validator", () => {
    const projection = project(TS01_LEVEL_SPEC);
    const serialized = structuredClone(projection);
    expect(validateNumberdroidLevelAuthoringProjection(serialized, compiler)).toEqual(projection);
  });
});
