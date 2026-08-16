import type { PropRegistry } from "./types";

export const NUMBERDROID_PROP_REGISTRY: PropRegistry = {
  "family-table": {
    id: "family-table", tags: ["family", "furniture", "table", "social-anchor"], attachment: "floor", allowedRotations: [0], footprintTiles: { w: 3, h: 2 },
    placement: { forbidDoorClearance: true, forbidPrimaryPath: true },
    // Large furniture uses its complete visible/canvas outline when it touches a wall.
    exactFit: { placementEnvelope: "visual", wallBoundary: "visual" },
  },
  "family-memory-console": {
    id: "family-memory-console", tags: ["family", "wall-prop", "memory", "personal"], attachment: "wall", allowedRotations: [0], footprintTiles: { w: 2, h: 1 },
    placement: { forbidDoorClearance: true, forbidPrimaryPath: true, approachDepthTiles: 1 },
    exactFit: { placementEnvelope: "visual", wallBoundary: "visual" },
  },
  "coffee-machine": {
    id: "coffee-machine", tags: ["family", "wall-prop", "service", "coffee"], attachment: "wall", allowedRotations: [0], footprintTiles: { w: 1, h: 2 },
    placement: { forbidDoorClearance: true, forbidPrimaryPath: true, approachDepthTiles: 1 },
    exactFit: { placementEnvelope: "visual", wallBoundary: "visual" },
  },
  "plant-round": {
    id: "plant-round", tags: ["family", "plant", "decorative"], attachment: "floor", allowedRotations: [0, 90, 180, 270], footprintTiles: { w: 1, h: 1 },
    placement: { preferWallAdjacent: true, preferCorner: true, preferNearTags: ["family", "furniture"], forbidDoorClearance: true, forbidPrimaryPath: true, forbidInFrontOfWallProp: true },
    exactFit: { placementEnvelope: "visual", wallBoundary: "visual" },
  },
  "planter-trough": {
    id: "planter-trough", tags: ["family", "plant", "planter", "decorative"], attachment: "floor", allowedRotations: [0, 180], footprintTiles: { w: 1, h: 2 },
    placement: { preferWallAdjacent: true, preferNearTags: ["family", "furniture"], forbidDoorClearance: true, forbidPrimaryPath: true, forbidInFrontOfWallProp: true },
    exactFit: { placementEnvelope: "visual", wallBoundary: "visual" },
  },
  "child-bed": {
    id: "child-bed", tags: ["family", "child", "bed", "furniture"], attachment: "floor", allowedRotations: [0, 90, 180, 270], footprintTiles: { w: 2, h: 1 },
    placement: { preferWallAdjacent: true, forbidDoorClearance: true, forbidPrimaryPath: true },
  },
  "toy-storage": {
    id: "toy-storage", tags: ["family", "child", "storage", "furniture"], attachment: "floor", allowedRotations: [0, 90, 180, 270], footprintTiles: { w: 1, h: 1 },
    placement: { preferWallAdjacent: true, forbidDoorClearance: true, forbidPrimaryPath: true },
  },
  toilet: {
    id: "toilet", tags: ["family", "hygiene", "bathroom-fixture"], attachment: "floor", allowedRotations: [0, 90, 180, 270], footprintTiles: { w: 1, h: 1 },
    placement: { requiredSpaceTags: ["hygiene"], preferWallAdjacent: true, preferOppositeDoor: true, forbidDoorClearance: true, forbidPrimaryPath: true },
  },
  "transfer-core": {
    id: "transfer-core", tags: ["transfer", "hero", "machine", "core"], attachment: "floor", allowedRotations: [0], footprintTiles: { w: 3, h: 3 },
    placement: { preferRoomCenter: true, forbidDoorClearance: true, forbidPrimaryPath: true, clearanceAroundTiles: 1 },
  },
  "transfer-hologram": {
    id: "transfer-hologram", tags: ["transfer", "control", "hologram", "support"], attachment: "floor", allowedRotations: [0, 90, 180, 270], footprintTiles: { w: 1, h: 1 },
    placement: { preferNearTags: ["transfer", "hero", "core"], forbidDoorClearance: true, forbidPrimaryPath: true },
    // The hologram image may glow/overhang; the physical pedestal is the useful fit envelope.
    exactFit: {
      collisionBoundsTiles: { x: 0.22, y: 0.22, w: 0.56, h: 0.56 },
      placementEnvelope: "collision",
      wallBoundary: "collision",
    },
  },
  "flow-station": {
    id: "flow-station", tags: ["transfer", "flow", "support", "machine"], attachment: "floor", allowedRotations: [0], footprintTiles: { w: 2, h: 2 },
    placement: { preferNearTags: ["transfer", "hero"], forbidDoorClearance: true, forbidPrimaryPath: true },
  },
  "primus-service-bank": {
    id: "primus-service-bank", tags: ["primus", "wall-prop", "service", "system"], attachment: "wall", allowedRotations: [0, 90, 180, 270], footprintTiles: { w: 2, h: 1 },
    placement: { forbidDoorClearance: true, forbidPrimaryPath: true, approachDepthTiles: 1 },
  },
};
