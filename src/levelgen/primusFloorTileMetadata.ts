export type PrimusFloorSurfaceRole =
  | "macro"
  | "fringe"
  | "threshold"
  | "service-approach"
  | "maintenance";

export type PrimusMacroVariant = "a" | "b";

export type PrimusFloorSurfaceMetadata = {
  id: string;
  asset: string;
  role: PrimusFloorSurfaceRole;
  spanTiles: { w: number; h: number };
  runtimeEligible: boolean;
  wallSafe: boolean;
  rotationPolicy: "fixed" | "half-turn" | "quarter-turn";
  macroVariant?: PrimusMacroVariant;
  continuityProfile?: "primus-macro-2x2" | "primus-threshold" | "primus-service-zone" | "primus-maintenance-zone";
  placementTags?: string[];
  note?: string;
};

const surface = (entry: PrimusFloorSurfaceMetadata) => entry;

/**
 * Semantic surface catalog for PRIMUS Allocation.
 *
 * The important production correction after the first live pass is that a 2x2
 * macro is one authored 128x128 surface, not four independently shaded 64px
 * cards. Threshold/service semantics are likewise authored as whole multi-cell
 * overlays so their visual continuity cannot break at runtime tile boundaries.
 */
export const PRIMUS_FLOOR_TILE_METADATA: readonly PrimusFloorSurfaceMetadata[] = [
  surface({
    id: "macro-a",
    asset: "primus-macro-a.svg",
    role: "macro",
    spanTiles: { w: 2, h: 2 },
    runtimeEligible: true,
    wallSafe: true,
    rotationPolicy: "half-turn",
    macroVariant: "a",
    continuityProfile: "primus-macro-2x2",
  }),
  surface({
    id: "macro-b",
    asset: "primus-macro-b.svg",
    role: "macro",
    spanTiles: { w: 2, h: 2 },
    runtimeEligible: true,
    wallSafe: true,
    rotationPolicy: "half-turn",
    macroVariant: "b",
    continuityProfile: "primus-macro-2x2",
    note: "Rare material/service-history variation. Cyan is intentionally tiny and local.",
  }),
  surface({
    id: "fringe",
    asset: "primus-fringe.svg",
    role: "fringe",
    spanTiles: { w: 1, h: 1 },
    runtimeEligible: true,
    wallSafe: true,
    rotationPolicy: "fixed",
    note: "Calm full-bleed residual surface for odd room dimensions.",
  }),
  surface({
    id: "threshold-west",
    asset: "primus-threshold-west.svg",
    role: "threshold",
    spanTiles: { w: 1, h: 2 },
    runtimeEligible: true,
    wallSafe: true,
    rotationPolicy: "fixed",
    continuityProfile: "primus-threshold",
    placementTags: ["controlled-door", "west-boundary"],
    note: "One 1x2 authored surface; no cyan or conduit reaches the wall edge.",
  }),
  surface({
    id: "service-horizontal",
    asset: "primus-service-approach-horizontal.svg",
    role: "service-approach",
    spanTiles: { w: 2, h: 1 },
    runtimeEligible: true,
    wallSafe: false,
    rotationPolicy: "fixed",
    continuityProfile: "primus-service-zone",
    placementTags: ["primus-service-bank", "approach"],
  }),
  surface({
    id: "service-vertical",
    asset: "primus-service-approach-vertical.svg",
    role: "service-approach",
    spanTiles: { w: 1, h: 2 },
    runtimeEligible: true,
    wallSafe: false,
    rotationPolicy: "fixed",
    continuityProfile: "primus-service-zone",
    placementTags: ["primus-service-bank", "approach"],
  }),
  surface({
    id: "maintenance-horizontal",
    asset: "primus-maintenance-left.svg",
    role: "maintenance",
    spanTiles: { w: 2, h: 1 },
    runtimeEligible: false,
    wallSafe: false,
    rotationPolicy: "quarter-turn",
    continuityProfile: "primus-maintenance-zone",
    placementTags: ["maintenance"],
    note: "Reserved. Runtime remains disabled until a real Level maintenance zone exists.",
  }),
] as const;

export const PRIMUS_FLOOR_TILE_BY_ID = new Map(PRIMUS_FLOOR_TILE_METADATA.map((entry) => [entry.id, entry]));
