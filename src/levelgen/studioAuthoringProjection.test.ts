import { describe, expect, it } from "vitest";
// @ts-expect-error A4a intentionally verifies the JavaScript-only Studio adapter boundary.
import * as numberdroidAdapter from "../../tools/numberdroid-studio/packages/numberdroid-adapter/src/index.js";
// @ts-expect-error A4b verifies the JavaScript-only Studio application kernel boundary.
import { validateLevelAuthoringKernel } from "../../tools/numberdroid-studio/packages/application/src/index.js";
// @ts-expect-error The Node-only authority hash helper stays outside the browser TypeScript graph.
import { numberdroidLevelCompilerVersion } from "../../tools/numberdroid-studio/tests/helpers/numberdroid-level-compiler-authority.js";
import { compileLevelSpec } from "./compiler";
import { validatePlacementOverrides } from "./overrides";
import { NUMBERDROID_PROP_REGISTRY } from "./propRegistry";
import { BIOARK_PASSBY_PROOF_SPEC } from "./specs/bioArkPassbyProof";
import { A4B_REFERENCE_LEVEL_SPEC } from "./specs/a4bReference";
import { TS01_LEVEL_SPEC } from "./specs/ts01";
import type { LevelSpec } from "./types";

const {
  NUMBERDROID_A4B_PROJECT_CAPABILITY_FINGERPRINT,
  NUMBERDROID_A4B_PROJECT_CAPABILITY_MANIFEST,
  NUMBERDROID_PROJECT_CAPABILITY_FINGERPRINT,
  createNumberdroidLevelAuthoringProjection,
  validateNumberdroidLevelAuthoringProjection,
} = numberdroidAdapter;

const COMPILER_VERSION = "numberdroid-level-compiler.sha256:8d2350ae75c7c167d3eb11e92892fdc40b8301cc487a86840c2d460f30ee1cab";
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
    plan: "e110ab584b63efc35aace4b242c1d88d708a6506d8c9b808c300316619edf80a",
    requirements: "a3df3bd0300a18ce4892f1baeb812f4fdb345f081689006483bdab8221077da9",
    level: "593ddaf28067d78289127b3eee5e63d52d94f883aa17e4b75afdd2c210b7aa42",
    logic: "ac6dcab9775188ee0416577c8e2af1df1c1d4cbe2c2273ffbab6f0f3c84777d9",
    projection: "1708a95dd90b0902214d0c5068736ccdb0d5edcded09bfec2d4e569bb0096000",
  },
  bioark: {
    source: "c518203d3436b42de0c87fff4f48663edaa3c7fa23c05bf14f279b376a9c6f32",
    plan: "dc85bc6e3b918447e01d1980ba8192b324291f03d426c05d7a8930436b5b7f65",
    requirements: "3a713d8d23d4d534989815d6c4bdde9d4e1ce67cc557843185470c9d8b51493b",
    level: "fed30380f21dddf6be3b69291f73abe1eb9ea38da38b7a2713e1f70d6ca6caf7",
    logic: "5669efe5ce33880209292bcf7977ba0fcca6acdcf5b3ede022632bc333045cc7",
    projection: "233ddb98aaef73e50881e248554f43c40cc9e9e9db76f3aa62b0fb6f0492d1c9",
  },
  flag: {
    source: "3da9fcd9f093f17a08ba28cf72cdcc33e52b203ff73feae4d317fe05ebe58918",
    plan: "c31f59b92ee9dd18c944eab6a13e078e34352322a17162b3a674e83a58cafe6c",
    requirements: "704365cef198da692679d62b0370908f9face64c35b2e82bcee925c7e6972d65",
    level: "20e0459f765adacb5e5eae3215c8e63f3f43c12b0d12944643342f4093f29f17",
    logic: "fdb6f0b08b3d0479a3b5da06daf0e2f8d616c0ecb8cbd3cd403147abd0dc28aa",
    projection: "1348ba28c8aeada958522cc9f16b2dc1224733b2f94b6662d4b28481583b3e3d",
  },
  a4b: {
    source: "6acf09035b8c75b56f0557745a973b25bbf4e758294e6a226a06571e0a07f77c",
    plan: "21f9e5c1fe5f584176c7429244359ba2693ed0197b26841b43b556481d7b0c6b",
    requirements: "1147acfa7d8fc9bfc11560a533c6994e4b3310acc94f9b5be35e20f6842139f3",
    level: "48eb179b01f778cf3e261d84d0e9e70dde33026ad3cc45284067801dee4b2182",
    logic: "932b5663eab84f7f7aca37b3a1e7d9a00f65f4fcc16f39928ba712508059d46c",
    projection: "f85502ac6395da1f611a9efc82f287dbe5a19da1eacf70d6f30e9730e9f437af",
  },
});

function project(spec: LevelSpec) {
  return createNumberdroidLevelAuthoringProjection({ levelSpec: spec, compiler });
}

function expectHashes(projection: ReturnType<typeof project>, expected: (typeof HASHES)[keyof typeof HASHES]) {
  expect({
    source: projection.source.sha256,
    plan: projection.compiler.sha256,
    requirements: projection.a3a.requirementSetFingerprint,
    level: projection.a3a.levelGraphFingerprint,
    logic: projection.a3a.logicGraphFingerprint,
    projection: projection.fingerprint,
  }).toEqual(expected);
}

describe("A4a Numberdroid level-authoring projection", () => {
  it("pins the exact current Numberdroid compiler authority", () => {
    expect(compiler.compilerVersion).toBe(COMPILER_VERSION);
  });

  it("projects and pins the real TS-01 gold-slice closure against the additive A4b profile", () => {
    const projection = project(TS01_LEVEL_SPEC);
    expectHashes(projection, HASHES.ts01);
    expect(projection.source.levelSpec.spaces).toHaveLength(TS01_LEVEL_SPEC.spaces.length);
    expect(projection.compiler.semanticPlan.props).toHaveLength(TS01_LEVEL_SPEC.props.length);
    expect(projection.a3a.levelGraph.spaces).toHaveLength(TS01_LEVEL_SPEC.spaces.length);
    expect(projection.a3a.levelGraph.connections).toHaveLength(TS01_LEVEL_SPEC.connections.length);
    expect(projection.a3a.levelGraph.placements).toEqual([]);
    expect(projection.a3a.levelGraph.actors).toEqual([]);
    expect(projection.a3a.logicGraph.actions).toEqual([]);
    expect(projection.capabilityDelta.status).toBe("ADVERTISED");
    expect(projection.capabilityDelta.baseline.fingerprint).toBe(NUMBERDROID_PROJECT_CAPABILITY_FINGERPRINT);
    expect(projection.capabilityDelta.target.fingerprint).toBe(NUMBERDROID_A4B_PROJECT_CAPABILITY_FINGERPRINT);
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

  it("projects the real A4b fixture into one closed Actor-to-text A3a graph and advertised profile", () => {
    const projection = project(A4B_REFERENCE_LEVEL_SPEC);
    expectHashes(projection, HASHES.a4b);
    expect(projection.a3a.levelGraph.actors).toEqual([
      expect.objectContaining({
        actorId: "guard-actor",
        archetype: { archetypeId: "numberdroid.sentry.guard", version: 1 },
        routeId: "guard-route",
      }),
    ]);
    expect(projection.a3a.levelGraph.pickups).toEqual([
      expect.objectContaining({ pickupId: "guard-key", itemId: "guard-access" }),
    ]);
    expect(projection.a3a.logicGraph.variables).toEqual([
      expect.objectContaining({ variableId: "state.guard-key-collected", type: "boolean", initialValue: false }),
    ]);
    expect(projection.a3a.logicGraph.textReferences).toEqual([
      expect.objectContaining({ textRefId: "text.guard-key-collected" }),
    ]);
    expect(projection.a3a.logicGraph.conditions).toEqual([]);
    expect(projection.a3a.logicGraph.triggers.map((trigger: { kind: string }) => trigger.kind).sort()).toEqual([
      "actor-defeated",
      "collect",
      "state-change",
    ]);
    expect(projection.a3a.logicGraph.actions.map((action: { kind: string }) => action.kind).sort()).toEqual([
      "drop-item",
      "set-variable",
      "show-text",
    ]);
    expect(projection.source.levelSpec.textReferences[0].text).toBe("<SYSTEM> WÄCHTER-ZUGANG GESICHERT");
    expect(projection.gaps.map((gap: { gapId: string }) => gap.gapId)).toEqual([
      "numberdroid.requirement-trace.not-authored",
    ]);
    expect(projection.capabilityDelta).toMatchObject({
      status: "ADVERTISED",
      baseline: { fingerprint: NUMBERDROID_PROJECT_CAPABILITY_FINGERPRINT },
      target: { profileVersion: 3, fingerprint: NUMBERDROID_A4B_PROJECT_CAPABILITY_FINGERPRINT },
    });

    const validation = validateLevelAuthoringKernel({
      requirementSet: projection.a3a.requirementSet,
      levelGraph: projection.a3a.levelGraph,
      logicGraph: projection.a3a.logicGraph,
      capabilityManifest: NUMBERDROID_A4B_PROJECT_CAPABILITY_MANIFEST,
    });
    expect(validation.status).toBe("VALID");
    expect(validation.findings.length).toBeGreaterThan(0);
    expect(validation.findings.every((finding: { severity: string; ruleId: string }) =>
      finding.severity === "WARNING" && finding.ruleId === "LEVEL_AUTHORING_TRACE_MISSING")).toBe(true);
    expect(validateNumberdroidLevelAuthoringProjection(structuredClone(projection), compiler)).toEqual(projection);
  });
});
