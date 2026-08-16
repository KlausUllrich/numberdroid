import type { CardinalDirection, CompileDiagnostic, PropPlacementRole } from "./types";
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
  footprintCells: GridCell[];
  score: number;
  reasons: string[];
};
