import type { CardinalDirection, CompileDiagnostic, PropPlacementRole, PropRotation } from "./types";
import type { GridRect } from "./geometryTypes";
import type { GridCell, NavigationCell, NavigationCompilePlan } from "./navigationTypes";

export type PlacementReservationKind = "approach" | "hero-clearance";

export type PlacementReservation = NavigationCell & {
  kind: PlacementReservationKind;
  ownerPlacementId: string;
};

export type PropPlacementDecision = {
  id: string;
  requestId: string;
  instanceIndex: number;
  propId: string;
  spaceId: string;
  role: PropPlacementRole;
  tags: string[];
  /** Cardinal art rotation selected while solving geometry, not after placement. */
  rotation: PropRotation;
  /** Physical occupied footprint after applying rotation. */
  rect: GridRect;
  wallSide: CardinalDirection | null;
  footprintCells: NavigationCell[];
  approachCells: NavigationCell[];
  clearanceCells: NavigationCell[];
  score: number;
  reasons: string[];
  candidateCount: number;
  rejectedCounts: Record<string, number>;
};

export type PropPlacementPlan = {
  navigation: NavigationCompilePlan;
  placements: PropPlacementDecision[];
  occupiedCells: NavigationCell[];
  reservations: PlacementReservation[];
  diagnostics: CompileDiagnostic[];
};

export type PlacementCandidatePreview = {
  rect: GridRect;
  wallSide: CardinalDirection | null;
  rotation: PropRotation;
  footprintCells: GridCell[];
  score: number;
  reasons: string[];
};
