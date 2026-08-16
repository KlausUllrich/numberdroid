import type { FloorDefinition } from "../game/types";
import type { TiledMapJson } from "../game/tiled";
import type { CompileDiagnostic } from "./types";
import type { EventCompilationPlan } from "./eventCompilationTypes";

export type RuntimeEmissionPlan = {
  events: EventCompilationPlan;
  tileSize: number;
  wallCollisionPx: number;
  /** Visible fascia thickness used by exact Prop surface fitting. */
  wallVisualPx: number;
  tiledMap: TiledMapJson;
  /** Round-trip through the existing Tiled importer; this is the current gameplay runtime boundary. */
  runtimeFloor: FloorDefinition;
  objectLayerCounts: Record<string, number>;
  diagnostics: CompileDiagnostic[];
};
