export type PrimusFloorTileRole =
  | "macro"
  | "calm"
  | "threshold"
  | "service-approach"
  | "maintenance";

export type PrimusMacroVariant = "a" | "b";
export type PrimusMacroPhase = "nw" | "ne" | "sw" | "se";
export type PrimusPairSegment = "start" | "end";

export type PrimusFloorTileMetadata = {
  id: string;
  asset: string;
  role: PrimusFloorTileRole;
  runtimeEligible: boolean;
  wallSafe: boolean;
  rotationPolicy: "fixed" | "quarter-turn";
  macroVariant?: PrimusMacroVariant;
  macroPhase?: PrimusMacroPhase;
  continuityProfile?: "primus-macro-2x2" | "primus-threshold-pair" | "primus-service-pair" | "primus-maintenance-pair";
  pairSegment?: PrimusPairSegment;
  placementTags?: string[];
  note?: string;
};

const tile = (entry: PrimusFloorTileMetadata) => entry;

export const PRIMUS_FLOOR_TILE_METADATA: readonly PrimusFloorTileMetadata[] = [
  tile({ id: "macro-a-nw", asset: "primus-base-a-nw.svg", role: "macro", runtimeEligible: true, wallSafe: true, rotationPolicy: "fixed", macroVariant: "a", macroPhase: "nw", continuityProfile: "primus-macro-2x2" }),
  tile({ id: "macro-a-ne", asset: "primus-base-a-ne.svg", role: "macro", runtimeEligible: true, wallSafe: true, rotationPolicy: "fixed", macroVariant: "a", macroPhase: "ne", continuityProfile: "primus-macro-2x2" }),
  tile({ id: "macro-a-sw", asset: "primus-base-a-sw.svg", role: "macro", runtimeEligible: true, wallSafe: true, rotationPolicy: "fixed", macroVariant: "a", macroPhase: "sw", continuityProfile: "primus-macro-2x2" }),
  tile({ id: "macro-a-se", asset: "primus-base-a-se.svg", role: "macro", runtimeEligible: true, wallSafe: true, rotationPolicy: "fixed", macroVariant: "a", macroPhase: "se", continuityProfile: "primus-macro-2x2" }),

  tile({ id: "macro-b-nw", asset: "primus-base-b-nw.svg", role: "macro", runtimeEligible: true, wallSafe: true, rotationPolicy: "fixed", macroVariant: "b", macroPhase: "nw", continuityProfile: "primus-macro-2x2" }),
  tile({ id: "macro-b-ne", asset: "primus-base-b-ne.svg", role: "macro", runtimeEligible: true, wallSafe: true, rotationPolicy: "fixed", macroVariant: "b", macroPhase: "ne", continuityProfile: "primus-macro-2x2" }),
  tile({ id: "macro-b-sw", asset: "primus-base-b-sw.svg", role: "macro", runtimeEligible: true, wallSafe: true, rotationPolicy: "fixed", macroVariant: "b", macroPhase: "sw", continuityProfile: "primus-macro-2x2" }),
  tile({ id: "macro-b-se", asset: "primus-base-b-se.svg", role: "macro", runtimeEligible: true, wallSafe: true, rotationPolicy: "fixed", macroVariant: "b", macroPhase: "se", continuityProfile: "primus-macro-2x2" }),

  tile({ id: "calm", asset: "primus-base-calm.svg", role: "calm", runtimeEligible: true, wallSafe: true, rotationPolicy: "fixed", note: "Full-bleed fallback for odd room fringes and calm residual cells." }),

  tile({ id: "threshold-west-upper", asset: "primus-threshold-west-upper.svg", role: "threshold", runtimeEligible: true, wallSafe: true, rotationPolicy: "fixed", continuityProfile: "primus-threshold-pair", pairSegment: "start", placementTags: ["controlled-door", "west-boundary"], note: "TS-01 canonical controlled threshold upper segment. Connects only to the lower segment." }),
  tile({ id: "threshold-west-lower", asset: "primus-threshold-west-lower.svg", role: "threshold", runtimeEligible: true, wallSafe: true, rotationPolicy: "fixed", continuityProfile: "primus-threshold-pair", pairSegment: "end", placementTags: ["controlled-door", "west-boundary"], note: "TS-01 canonical controlled threshold lower segment. Connects only to the upper segment." }),

  tile({ id: "service-left", asset: "primus-service-approach-left.svg", role: "service-approach", runtimeEligible: true, wallSafe: false, rotationPolicy: "quarter-turn", continuityProfile: "primus-service-pair", pairSegment: "start", placementTags: ["primus-service-bank", "approach"], note: "Left member of a semantic 2-cell service-bank approach pair. Rotate 90° for vertical pairs." }),
  tile({ id: "service-right", asset: "primus-service-approach-right.svg", role: "service-approach", runtimeEligible: true, wallSafe: false, rotationPolicy: "quarter-turn", continuityProfile: "primus-service-pair", pairSegment: "end", placementTags: ["primus-service-bank", "approach"], note: "Right member of a semantic 2-cell service-bank approach pair. Rotate 90° for vertical pairs." }),

  tile({ id: "maintenance-left", asset: "primus-maintenance-left.svg", role: "maintenance", runtimeEligible: false, wallSafe: false, rotationPolicy: "quarter-turn", continuityProfile: "primus-maintenance-pair", pairSegment: "start", placementTags: ["maintenance"], note: "Reserved until a real maintenance zone exists in Level semantics." }),
  tile({ id: "maintenance-right", asset: "primus-maintenance-right.svg", role: "maintenance", runtimeEligible: false, wallSafe: false, rotationPolicy: "quarter-turn", continuityProfile: "primus-maintenance-pair", pairSegment: "end", placementTags: ["maintenance"], note: "Reserved until a real maintenance zone exists in Level semantics." }),
] as const;

export const PRIMUS_FLOOR_TILE_BY_ID = new Map(PRIMUS_FLOOR_TILE_METADATA.map((entry) => [entry.id, entry]));

export function primusMacroTileId(variant: PrimusMacroVariant, phase: PrimusMacroPhase) {
  return `macro-${variant}-${phase}`;
}
