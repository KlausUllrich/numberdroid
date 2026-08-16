import type { LevelSpec } from "../types";

const HALL_WIDTH = { min: 2, preferred: 3, max: 4 } as const;

/**
 * Small isolated compiler proof for scripted non-combat actors.
 * It deliberately stays separate from TS-01 so Bio-Ark behavior does not leak
 * into the Transfer Hall simply to demonstrate runtime capability.
 */
export const BIOARK_PASSBY_PROOF_SPEC: LevelSpec = {
  id: "bioark-passby-proof",
  version: 1,
  seed: "BIOARK-PASSBY-PROOF-01",
  ruleSetRefs: ["numberdroid/base", "numberdroid/level-design", "bioark/base", "proof/staged-actor-passby"],
  rules: {
    ensureReachability: true,
    singleSharedWall: true,
    doorsEmbeddedInWalls: true,
    defaultCorridorWidth: HALL_WIDTH,
    defaultDoorClearance: { before: 1.25, after: 1.25 },
  },
  runtime: {
    tileSize: 64,
    wallCollisionPx: 10,
    floorName: "BIO-ARK · PASS-BY PROOF",
    subtitle: "LEVEL COMPILER · STAGED ACTOR RUNTIME",
    objectiveDefault: "FAHRE ZUR MITTE · BEOBACHTE DEN BIO-ARK-AKTEUR",
    objectiveAfterEnergy: "FAHRE ZUR MITTE · BEOBACHTE DEN BIO-ARK-AKTEUR",
    start: {
      spaceId: "bioark-overlook",
      bodyId: "pico",
      facing: 90,
      metaEnergy: 0,
      preferredSide: "west",
    },
  },
  spaces: [
    {
      id: "bioark-overlook",
      kind: "room",
      archetype: "bioark-observation-clearing",
      tags: ["bioark", "natural", "observation", "fauna"],
      rationality: "neutral",
      size: {
        class: "large",
        width: { min: 12, preferred: 14, max: 16 },
        height: { min: 7, preferred: 8, max: 10 },
      },
    },
  ],
  connections: [],
  props: [],
  encounters: [],
  routes: [
    {
      id: "grazer-pass-route",
      kind: "passby",
      spaceIds: ["bioark-overlook"],
      loop: false,
      tags: ["fauna", "foreground-passby", "west-east"],
    },
  ],
  stagedActors: [
    {
      id: "bioark-grazer-01",
      actorType: "bioark-grazer",
      tags: ["fauna", "large", "non-combat", "ambient"],
      initiallyPresent: false,
      defaultSpaceId: "bioark-overlook",
    },
  ],
  zones: [
    {
      id: "grazer-view-zone",
      spaceId: "bioark-overlook",
      anchor: { kind: "space-center" },
      sizeTiles: { w: 4, h: 4 },
      tags: ["fauna", "view", "passby-trigger"],
    },
  ],
  triggers: [
    {
      id: "enter-grazer-view",
      kind: "enter-zone",
      sourceId: "grazer-view-zone",
      eventIds: ["run-grazer-passby"],
      once: true,
    },
  ],
  events: [
    {
      id: "run-grazer-passby",
      kind: "actor-passby",
      actorId: "bioark-grazer-01",
      routeId: "grazer-pass-route",
      durationMs: 5200,
    },
  ],
  overrides: [],
};
