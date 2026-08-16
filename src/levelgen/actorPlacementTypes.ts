import type { CompileDiagnostic, EncounterBehaviorKind } from "./types";
import type { NavigationCell } from "./navigationTypes";
import type { OrientedPropPlacementPlan } from "./orientedPlacement";

export type ActorRouteGeometry = {
  id: string;
  kind: "patrol" | "passby" | "scripted";
  cells: NavigationCell[];
  loop: boolean;
};

export type ActorPlacementDecision = {
  id: string;
  spaceId: string;
  behavior: EncounterBehaviorKind;
  cell: NavigationCell;
  facing: number;
  patrolRouteId?: string;
  score: number;
  reasons: string[];
  candidateCount: number;
  rejectedCounts: Record<string, number>;
};

export type ActorPlacementPlan = {
  props: OrientedPropPlacementPlan;
  routes: ActorRouteGeometry[];
  actors: ActorPlacementDecision[];
  occupiedActorCells: NavigationCell[];
  diagnostics: CompileDiagnostic[];
};
