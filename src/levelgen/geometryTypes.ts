import type { CardinalDirection, CompileDiagnostic, SemanticCompilePlan } from "./types";

export type GridRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type SpaceGeometry = {
  id: string;
  kind: "room" | "corridor";
  rect: GridRect;
  seed: number;
};

export type WallOrientation = "horizontal" | "vertical";

export type ConnectionGeometry = {
  id: string;
  from: string;
  to: string;
  kind: "opening" | "standard-door" | "controlled-door";
  wallOrientation: WallOrientation;
  fromSide: CardinalDirection;
  toSide: CardinalDirection;
  boundary: number;
  apertureStart: number;
  apertureLength: number;
  clearanceBefore: GridRect | null;
  clearanceAfter: GridRect | null;
};

export type WallSegment = {
  id: string;
  orientation: WallOrientation;
  x: number;
  y: number;
  length: number;
  ownerSpaceIds: string[];
  shared: boolean;
};

export type GeometryCompilePlan = {
  semantic: SemanticCompilePlan;
  spaces: SpaceGeometry[];
  connections: ConnectionGeometry[];
  walls: WallSegment[];
  bounds: GridRect;
  diagnostics: CompileDiagnostic[];
};
