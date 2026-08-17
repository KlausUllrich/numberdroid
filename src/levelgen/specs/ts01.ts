import type { LevelSpec } from "../types";

const RANGE_1 = { min: 1, preferred: 1, max: 1 } as const;
const RANGE_2 = { min: 2, preferred: 2, max: 2 } as const;
const RANGE_3 = { min: 2, preferred: 3, max: 4 } as const;

export const TS01_LEVEL_SPEC: LevelSpec = {
  id: "ts01-transfer-hall",
  version: 1,
  seed: "TS01-GOLD-SLICE",
  ruleSetRefs: [
    "numberdroid/base",
    "numberdroid/level-design",
    "transfer-ship/base",
    "ts01/gold-slice",
  ],
  rules: {
    ensureReachability: true,
    singleSharedWall: true,
    doorsEmbeddedInWalls: true,
    defaultCorridorWidth: RANGE_3,
    defaultDoorClearance: { before: 1.25, after: 1.25 },
  },
  spaces: [
    {
      id: "family-living",
      kind: "room",
      archetype: "domestic-living",
      tags: ["family", "domestic", "living"],
      rationality: "domestic",
      size: {
        class: "medium",
        width: { min: 6, preferred: 7, max: 9 },
        height: { min: 5, preferred: 6, max: 8 },
      },
    },
    {
      id: "family-child",
      kind: "room",
      archetype: "child-room",
      tags: ["family", "domestic", "child"],
      rationality: "domestic",
      size: {
        class: "small",
        width: { min: 3, preferred: 4, max: 5 },
        height: { min: 3, preferred: 4, max: 5 },
      },
      relations: [{ targetId: "family-living", relation: "south_of", strength: "preferred" }],
    },
    {
      id: "family-hygiene",
      kind: "room",
      archetype: "hygiene-room",
      tags: ["family", "domestic", "hygiene"],
      rationality: "domestic",
      size: {
        class: "tiny",
        width: { min: 2, preferred: 2, max: 3 },
        height: { min: 2, preferred: 3, max: 4 },
      },
      relations: [{ targetId: "family-living", relation: "south_east_of", strength: "preferred" }],
    },
    {
      id: "main-hall",
      kind: "corridor",
      archetype: "public-hall",
      tags: ["circulation", "hall"],
      width: RANGE_3,
      length: { min: 6, preferred: 9, max: 13 },
      orientation: "vertical",
      relations: [{ targetId: "family-living", relation: "east_of", strength: "preferred" }],
    },
    {
      id: "transfer-room",
      kind: "room",
      archetype: "transfer-hero-room",
      tags: ["transfer", "hero", "ritual"],
      rationality: "ritual",
      size: {
        class: "hero",
        width: { min: 8, preferred: 10, max: 12 },
        // The approved 3×6 Hero plus one-tile Hero clearance needs eight
        // interior tiles vertically. Preserve width; grow only the dimension
        // proven necessary by production placement QA.
        height: { min: 8, preferred: 8, max: 9 },
      },
      relations: [{ targetId: "main-hall", relation: "south_of", strength: "required" }],
    },
    {
      id: "primus-allocation",
      kind: "room",
      archetype: "primus-allocation",
      tags: ["primus", "system", "allocation"],
      rationality: "system",
      size: {
        class: "large",
        width: { min: 7, preferred: 9, max: 11 },
        height: { min: 6, preferred: 8, max: 10 },
      },
      relations: [{ targetId: "main-hall", relation: "north_east_of", strength: "preferred" }],
    },
  ],
  connections: [
    {
      id: "living-to-child",
      from: "family-living",
      to: "family-child",
      kind: "standard-door",
      widthTiles: 1,
      preferredSide: "south",
    },
    {
      id: "living-to-hygiene",
      from: "family-living",
      to: "family-hygiene",
      kind: "standard-door",
      widthTiles: 1,
      preferredSide: "south",
    },
    {
      id: "living-to-hall",
      from: "family-living",
      to: "main-hall",
      kind: "opening",
      widthTiles: 2,
      preferredSide: "east",
    },
    {
      id: "hall-to-transfer",
      from: "main-hall",
      to: "transfer-room",
      kind: "opening",
      widthTiles: 2,
      preferredSide: "south",
    },
    {
      id: "hall-to-primus",
      from: "main-hall",
      to: "primus-allocation",
      kind: "controlled-door",
      widthTiles: 2,
      preferredSide: "east",
      clearanceTiles: { before: 1.5, after: 1.5 },
      lock: { mode: "access-key", keyId: "primus-access" },
    },
  ],
  props: [
    { id: "living-table", propId: "family-table", spaceId: "family-living", role: "furniture" },
    { id: "living-memory", propId: "family-memory-console", spaceId: "family-living", role: "support", preferredWall: "north" },
    { id: "living-coffee", propId: "coffee-machine", spaceId: "family-living", role: "support", preferredWall: "north" },
    { id: "living-plant", propId: "plant-round", spaceId: "family-living", role: "dressing", preferredWall: "south" },
    { id: "child-planter", propId: "planter-trough", spaceId: "family-child", role: "dressing", preferredWall: "west" },
    { id: "child-bed", propId: "child-bed", spaceId: "family-child", role: "furniture", preferredWall: "west" },
    { id: "child-toys", propId: "toy-storage", spaceId: "family-child", role: "furniture", near: ["child-bed"] },
    { id: "bathroom-toilet", propId: "toilet", spaceId: "family-hygiene", role: "furniture" },
    { id: "transfer-core", propId: "transfer-core", spaceId: "transfer-room", role: "hero" },
    { id: "transfer-hologram", propId: "transfer-hologram", spaceId: "transfer-room", role: "support", near: ["transfer-core"] },
    { id: "transfer-flow", propId: "flow-station", spaceId: "transfer-room", role: "support", near: ["transfer-core"] },
    { id: "primus-service", propId: "primus-service-bank", spaceId: "primus-allocation", role: "support", quantity: 2, preferredWall: "north" },
  ],
  routes: [
    {
      id: "primus-sentry-patrol",
      kind: "patrol",
      spaceIds: ["primus-allocation"],
      loop: true,
      tags: ["system", "patrol"],
    },
  ],
  encounters: [
    {
      id: "primus-magnetar-742",
      spaceId: "primus-allocation",
      enemyId: "magnetar",
      bodyId: "magnetar",
      behavior: "neutral",
      mode: "add-easy",
      mathLabel: "+ ZIEL 6",
      mathRole: "comfort",
      difficulty: "easy",
      avoidDoorClearance: true,
      tags: ["worker", "neutral"],
    },
    {
      id: "primus-sentry-4",
      spaceId: "primus-allocation",
      enemyId: "sentry",
      bodyId: "sentry",
      behavior: "patrol",
      patrolRouteId: "primus-sentry-patrol",
      mode: "add-easy",
      mathLabel: "+ ZIEL 6",
      mathRole: "comfort",
      difficulty: "easy",
      avoidDoorClearance: true,
      tags: ["guard", "patrol"],
    },
  ],
  stagedActors: [],
  pickups: [
    {
      id: "primus-access-card",
      kind: "access-key",
      keyId: "primus-access",
      spaceId: "family-living",
      label: "PRIMUS ACCESS",
    },
  ],
  zones: [
    {
      id: "transfer-intro-zone",
      spaceId: "transfer-room",
      anchor: { kind: "space-center" },
      sizeTiles: { w: 4, h: 3 },
      tags: ["story", "transfer", "first-view"],
    },
  ],
  triggers: [
    {
      id: "collect-primus-access",
      kind: "collect",
      sourceId: "primus-access-card",
      eventIds: ["grant-primus-access", "unlock-primus-door"],
      once: true,
    },
    {
      id: "enter-transfer-intro",
      kind: "enter-zone",
      sourceId: "transfer-intro-zone",
      eventIds: ["play-transfer-intro"],
      once: true,
    },
  ],
  events: [
    { id: "grant-primus-access", kind: "grant-key", keyId: "primus-access" },
    { id: "unlock-primus-door", kind: "unlock-door", doorId: "hall-to-primus" },
    { id: "play-transfer-intro", kind: "story-beat", beatId: "ts01.transfer-first-view", blocking: true },
  ],
  overrides: [],
};

// Retained as tiny reusable constants for tests/examples and future spec composition.
export const TS01_LEVEL_RANGES = { one: RANGE_1, two: RANGE_2, hall: RANGE_3 };
