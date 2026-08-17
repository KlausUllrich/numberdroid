import type { PropRegistry } from "./types";

export const NUMBERDROID_PROP_REGISTRY: PropRegistry = {
  "family-table": {
    id: "family-table", tags: ["family", "furniture", "table", "social-anchor"], attachment: "floor", allowedRotations: [0], footprintTiles: { w: 3, h: 2 },
    placement: { forbidDoorClearance: true, forbidPrimaryPath: true },
    // Recipe-derived runtime content is 186×120 at offset (3,5) in a 192×128 canvas.
    // Physical seating/table collision is multipart in propCollisionRegistry.ts.
    exactFit: {
      visualBoundsTiles: { x: 0.046875, y: 0.078125, w: 2.90625, h: 1.875 },
      placementEnvelope: "visual",
      wallBoundary: "visual",
    },
  },
  "family-memory-console": {
    id: "family-memory-console", tags: ["family", "wall-prop", "memory", "personal"], attachment: "wall", allowedRotations: [0], footprintTiles: { w: 2, h: 1 },
    placement: { forbidDoorClearance: true, forbidPrimaryPath: true, approachDepthTiles: 1 },
    // Accepted source deliberately carries top-canvas breathing room. Protect the
    // visible console body rather than the complete transparent 2×1 canvas.
    exactFit: {
      visualBoundsTiles: { x: 0.04, y: 0.30, w: 1.92, h: 0.64 },
      collisionBoundsTiles: { x: 0.25, y: 0.32, w: 1.50, h: 0.56 },
      placementEnvelope: "visual",
      wallBoundary: "visual",
    },
  },
  "coffee-machine": {
    id: "coffee-machine", tags: ["family", "wall-prop", "service", "coffee"], attachment: "wall", allowedRotations: [0], footprintTiles: { w: 1, h: 2 },
    placement: { forbidDoorClearance: true, forbidPrimaryPath: true, approachDepthTiles: 1 },
    exactFit: {
      visualBoundsTiles: { x: 0.08, y: 0.18, w: 0.84, h: 1.72 },
      collisionBoundsTiles: { x: 0.18, y: 0.52, w: 0.64, h: 0.82 },
      placementEnvelope: "visual",
      wallBoundary: "visual",
    },
  },
  "plant-round": {
    id: "plant-round", tags: ["family", "plant", "decorative"], attachment: "floor", allowedRotations: [0, 90, 180, 270], footprintTiles: { w: 1, h: 1 },
    placement: { preferWallAdjacent: true, preferCorner: true, preferNearTags: ["family", "furniture"], forbidDoorClearance: true, forbidPrimaryPath: true, forbidInFrontOfWallProp: true },
    exactFit: {
      visualBoundsTiles: { x: 0.08, y: 0.08, w: 0.84, h: 0.84 },
      collisionBoundsTiles: { x: 0.20, y: 0.28, w: 0.60, h: 0.55 },
      placementEnvelope: "visual",
      wallBoundary: "visual",
    },
  },
  "planter-trough": {
    id: "planter-trough", tags: ["family", "plant", "planter", "decorative"], attachment: "floor", allowedRotations: [0, 180], footprintTiles: { w: 1, h: 2 },
    placement: { preferWallAdjacent: true, preferNearTags: ["family", "furniture"], forbidDoorClearance: true, forbidPrimaryPath: true, forbidInFrontOfWallProp: true },
    exactFit: {
      visualBoundsTiles: { x: 0.08, y: 0.08, w: 0.84, h: 1.84 },
      collisionBoundsTiles: { x: 0.18, y: 0.55, w: 0.64, h: 0.90 },
      // Leaves must respect the visible wall fascia, but Door/use-space is governed by the physical planter body.
      placementEnvelope: "collision",
      wallBoundary: "visual",
    },
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
    id: "transfer-core", tags: ["transfer", "hero", "machine", "core"], attachment: "floor", allowedRotations: [0], footprintTiles: { w: 3, h: 6 },
    placement: { preferRoomCenter: true, forbidDoorClearance: true, forbidPrimaryPath: true, clearanceAroundTiles: 1 },
    // Approved source normalized to a 192×384 (3×6 tile) transparent canvas.
    // The meaningful visible body is 146×364 px at offset (23,10).
    // Physical collision is multipart so the lower PICO dock / drive-out lane remains open.
    exactFit: {
      visualBoundsTiles: { x: 0.359375, y: 0.15625, w: 2.28125, h: 5.6875 },
      placementEnvelope: "visual",
      wallBoundary: "visual",
    },
  },
  "transfer-hologram": {
    id: "transfer-hologram", tags: ["transfer", "control", "hologram", "support"], attachment: "floor", allowedRotations: [0, 90, 180, 270], footprintTiles: { w: 1, h: 1 },
    placement: { preferNearTags: ["transfer", "hero", "core"], forbidDoorClearance: true, forbidPrimaryPath: true },
    // Glow may overhang the physical pedestal. The base is deliberately larger
    // than v0.13.1 so the player cannot drive across the visible object.
    exactFit: {
      visualBoundsTiles: { x: 0.08, y: 0.08, w: 0.84, h: 0.84 },
      collisionBoundsTiles: { x: 0.15, y: 0.15, w: 0.70, h: 0.70 },
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
