export type PropArtStatus = "accepted" | "candidate";

export type PropArtRegistration = {
  propId: string;
  /** Public asset path relative to Vite BASE_URL. */
  asset: string;
  /** Optional grounding shadow rendered in FloorFX before Architecture. */
  shadowAsset?: string;
  /** Art review state only. Never changes placement/collision semantics. */
  status: PropArtStatus;
};

export type PropArtRegistry = Readonly<Record<string, PropArtRegistration>>;

/**
 * Presentation-only registry for compiler-emitted Prop art.
 *
 * Physical footprint / allowed rotations / placement rules deliberately remain
 * in propRegistry.ts. Keeping art registration separate prevents an Artist
 * change from silently mutating gameplay geometry.
 */
export const NUMBERDROID_PROP_ART_REGISTRY: PropArtRegistry = {
  "family-table": {
    propId: "family-table",
    asset: "assets/deck/family-table-props.png",
    shadowAsset: "assets/deck/family-table-shadow.png",
    status: "accepted",
  },
  "family-memory-console": {
    propId: "family-memory-console",
    asset: "assets/deck/family-memory-console.png",
    shadowAsset: "assets/deck/family-memory-console-shadow.png",
    status: "accepted",
  },
  "coffee-machine": {
    propId: "coffee-machine",
    asset: "assets/deck/family-coffee-machine.png",
    shadowAsset: "assets/deck/family-coffee-machine-shadow.png",
    status: "candidate",
  },
  "planter-trough": {
    propId: "planter-trough",
    asset: "assets/deck/family-planter-trough.png",
    shadowAsset: "assets/deck/family-planter-trough-shadow.png",
    status: "candidate",
  },
  "plant-round": {
    propId: "plant-round",
    asset: "assets/deck/family-round-plant.png",
    shadowAsset: "assets/deck/family-round-plant-shadow.png",
    status: "candidate",
  },
  "transfer-hologram": {
    propId: "transfer-hologram",
    asset: "assets/deck/family-hologram-pedestal.png",
    shadowAsset: "assets/deck/family-hologram-pedestal-shadow.png",
    status: "candidate",
  },
  "transfer-core": {
    propId: "transfer-core",
    asset: "assets/deck/transfer-apparatus.png",
    shadowAsset: "assets/deck/transfer-apparatus-shadow.png",
    status: "accepted",
  },
  "flow-station": {
    propId: "flow-station",
    asset: "assets/deck/flow-regulator.png",
    status: "candidate",
  },
};

export function propArtRegistration(propId: string) {
  return NUMBERDROID_PROP_ART_REGISTRY[propId] ?? null;
}
