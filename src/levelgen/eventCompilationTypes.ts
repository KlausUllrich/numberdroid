import type {
  CompileDiagnostic,
  LevelEventSpec,
  StagedActorSpec,
  TriggerKind,
} from "./types";
import type { NavigationCell } from "./navigationTypes";
import type { ActorPlacementPlan } from "./actorPlacementTypes";

export type PickupPlacementDecision = {
  id: string;
  keyId: string;
  spaceId: string;
  initiallyPresent: boolean;
  cell: NavigationCell;
  label?: string;
  score: number;
  reasons: string[];
  candidateCount: number;
};

export type TriggerZoneGeometry = {
  id: string;
  spaceId: string;
  cells: NavigationCell[];
  center: NavigationCell;
  anchorKind: "space-center" | "connection" | "prop" | "actor" | "route" | "pickup";
  anchorTargetId?: string;
  tags: string[];
};

export type ResolvedTriggerSourceKind =
  | "space"
  | "zone"
  | "prop"
  | "actor"
  | "pickup"
  | "connection"
  | "route"
  | "flag"
  | "variable"
  | "timer";

export type ResolvedTriggerSource = {
  kind: ResolvedTriggerSourceKind;
  id: string;
  spaceId?: string;
  point?: NavigationCell;
  cells: NavigationCell[];
  resolvedIds: string[];
};

export type CompiledTriggerProgram = {
  id: string;
  kind: TriggerKind;
  source: ResolvedTriggerSource;
  eventIds: string[];
  once: boolean;
  delayMs: number;
  radiusTiles?: number;
};

export type CompiledEventDecision = {
  id: string;
  kind: LevelEventSpec["kind"];
  event: LevelEventSpec;
  targetIds: string[];
};

export type TriggerEventLink = {
  id: string;
  triggerId: string;
  eventId: string;
  order: number;
};

export type EventCompilationPlan = {
  actors: ActorPlacementPlan;
  pickups: PickupPlacementDecision[];
  zones: TriggerZoneGeometry[];
  stagedActors: StagedActorSpec[];
  triggers: CompiledTriggerProgram[];
  events: CompiledEventDecision[];
  links: TriggerEventLink[];
  diagnostics: CompileDiagnostic[];
};
