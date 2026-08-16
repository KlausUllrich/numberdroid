import type { PropRegistry } from "./types";

export const NUMBERDROID_PROP_REGISTRY: PropRegistry = {
  "family-table": {
    id: "family-table",
    tags: ["family", "furniture", "table", "social-anchor"],
    attachment: "floor",
    footprintTiles: { w: 3, h: 2 },
    placement: {
      forbidDoorClearance: true,
      forbidPrimaryPath: true,
    },
  },
  "family-memory-console": {
    id: "family-memory-console",
    tags: ["family", "wall-prop", "memory", "personal"],
    attachment: "wall",
    footprintTiles: { w: 2, h: 1 },
    placement: {
      forbidDoorClearance: true,
    },
  },
  "coffee-machine": {
    id: "coffee-machine",
    tags: ["family", "wall-prop", "service", "coffee"],
    attachment: "wall",
    footprintTiles: { w: 1, h: 2 },
    placement: {
      forbidDoorClearance: true,
    },
  },
  "plant-round": {
    id: "plant-round",
    tags: ["family", "plant", "decorative"],
    attachment: "floor",
    footprintTiles: { w: 1, h: 1 },
    placement: {
      preferWallAdjacent: true,
      preferCorner: true,
      preferNearTags: ["family", "furniture"],
      forbidDoorClearance: true,
      forbidPrimaryPath: true,
      forbidInFrontOfWallProp: true,
    },
  },
  "planter-trough": {
    id: "planter-trough",
    tags: ["family", "plant", "planter", "decorative"],
    attachment: "floor",
    footprintTiles: { w: 1, h: 2 },
    placement: {
      preferWallAdjacent: true,
      preferNearTags: ["family", "furniture"],
      forbidDoorClearance: true,
      forbidPrimaryPath: true,
      forbidInFrontOfWallProp: true,
    },
  },
  "child-bed": {
    id: "child-bed",
    tags: ["family", "child", "bed", "furniture"],
    attachment: "floor",
    footprintTiles: { w: 2, h: 1 },
    placement: {
      preferWallAdjacent: true,
      forbidDoorClearance: true,
      forbidPrimaryPath: true,
    },
  },
  "toy-storage": {
    id: "toy-storage",
    tags: ["family", "child", "storage", "furniture"],
    attachment: "floor",
    footprintTiles: { w: 1, h: 1 },
    placement: {
      preferWallAdjacent: true,
      forbidDoorClearance: true,
      forbidPrimaryPath: true,
    },
  },
  toilet: {
    id: "toilet",
    tags: ["family", "hygiene", "bathroom-fixture"],
    attachment: "floor",
    footprintTiles: { w: 1, h: 1 },
    placement: {
      requiredSpaceTags: ["hygiene"],
      preferWallAdjacent: true,
      preferOppositeDoor: true,
      forbidDoorClearance: true,
      forbidPrimaryPath: true,
    },
  },
  "transfer-core": {
    id: "transfer-core",
    tags: ["transfer", "hero", "machine", "core"],
    attachment: "floor",
    footprintTiles: { w: 3, h: 3 },
    placement: {
      forbidDoorClearance: true,
      forbidPrimaryPath: true,
    },
  },
  "transfer-hologram": {
    id: "transfer-hologram",
    tags: ["transfer", "control", "hologram", "support"],
    attachment: "floor",
    footprintTiles: { w: 1, h: 1 },
    placement: {
      preferNearTags: ["transfer", "hero", "core"],
      forbidDoorClearance: true,
      forbidPrimaryPath: true,
    },
  },
  "flow-station": {
    id: "flow-station",
    tags: ["transfer", "flow", "support", "machine"],
    attachment: "floor",
    footprintTiles: { w: 2, h: 2 },
    placement: {
      preferNearTags: ["transfer", "hero"],
      forbidDoorClearance: true,
      forbidPrimaryPath: true,
    },
  },
  "primus-service-bank": {
    id: "primus-service-bank",
    tags: ["primus", "wall-prop", "service", "system"],
    attachment: "wall",
    footprintTiles: { w: 2, h: 1 },
    placement: {
      forbidDoorClearance: true,
    },
  },
};
