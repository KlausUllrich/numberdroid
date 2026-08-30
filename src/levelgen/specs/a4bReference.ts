import type { LevelSpec } from "../types";

/**
 * Production-shaped A4b proof: one routed Encounter activates one dormant key,
 * whose collection flips one declared Boolean and exposes one bounded text ref.
 * It deliberately contains no generic conditions or unrelated script features.
 */
export const A4B_REFERENCE_LEVEL_SPEC: LevelSpec = {
  id: "a4b-key-reference",
  version: 2,
  seed: "A4B-KEY-REFERENCE-V1",
  ruleSetRefs: ["numberdroid/base", "studio/a4b-key-reference"],
  rules: {
    ensureReachability: true,
    singleSharedWall: true,
    doorsEmbeddedInWalls: true,
    defaultCorridorWidth: { min: 2, preferred: 3, max: 4 },
    defaultDoorClearance: { before: 1, after: 1 },
  },
  runtime: {
    floorName: "A4B REFERENCE",
    subtitle: "ACTOR · KEY · STATE · TEXT",
    objectiveDefault: "BESIEGE DEN WÄCHTER",
    objectiveAfterEnergy: "NIMM DEN SCHLÜSSEL",
    start: { spaceId: "guard-room", bodyId: "pico", facing: 90, metaEnergy: 0 },
  },
  spaces: [{
    id: "guard-room",
    kind: "room",
    archetype: "system-guard-room",
    rationality: "system",
    size: { class: "medium" },
  }],
  connections: [],
  props: [],
  encounters: [{
    id: "guard-actor",
    spaceId: "guard-room",
    actorArchetype: { id: "numberdroid.sentry.guard", version: 1 },
    enemyId: "sentry",
    bodyId: "sentry",
    behavior: "patrol",
    mode: "add-normal",
    mathLabel: "PLUS · NORMAL",
    mathRole: "core",
    difficulty: "medium",
    patrolRouteId: "guard-route",
    avoidDoorClearance: true,
  }],
  routes: [{ id: "guard-route", kind: "patrol", spaceIds: ["guard-room"], loop: true }],
  pickups: [{
    id: "guard-key",
    kind: "access-key",
    keyId: "guard-access",
    spaceId: "guard-room",
    initiallyPresent: false,
    label: "WÄCHTER-ZUGANG",
  }],
  variables: [{ id: "state.guard-key-collected", type: "boolean", initialValue: false }],
  textReferences: [{
    id: "text.guard-key-collected",
    text: "<SYSTEM> WÄCHTER-ZUGANG GESICHERT",
  }],
  triggers: [
    {
      id: "trigger.guard-defeated",
      kind: "actor-defeated",
      sourceId: "guard-actor",
      eventIds: ["action.drop-guard-key"],
      once: true,
      delayMs: 0,
    },
    {
      id: "trigger.guard-key-collected",
      kind: "collect",
      sourceId: "guard-key",
      eventIds: ["action.set-guard-key-state"],
      once: true,
      delayMs: 0,
    },
    {
      id: "trigger.guard-key-state",
      kind: "state-change",
      sourceId: "state.guard-key-collected",
      eventIds: ["action.show-guard-key-text"],
      once: true,
      delayMs: 0,
    },
  ],
  events: [
    { id: "action.drop-guard-key", kind: "drop-item", actorId: "guard-actor", pickupId: "guard-key" },
    { id: "action.set-guard-key-state", kind: "set-variable", variableId: "state.guard-key-collected", value: true },
    { id: "action.show-guard-key-text", kind: "show-text", textRefId: "text.guard-key-collected" },
  ],
  overrides: [],
};
