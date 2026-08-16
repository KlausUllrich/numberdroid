import type { CompileDiagnostic } from "./types";
import type { GeometryCompilePlan, GridRect } from "./geometryTypes";

export type GridCell = {
  x: number;
  y: number;
};

export type NavigationCell = GridCell & {
  spaceId: string;
};

export type PortalCellPair = {
  from: NavigationCell;
  to: NavigationCell;
};

export type NavigationPortal = {
  connectionId: string;
  kind: "opening" | "standard-door" | "controlled-door";
  pairs: PortalCellPair[];
  centerPair: PortalCellPair;
};

export type NavigationRoute = {
  id: string;
  fromSpaceId: string;
  toSpaceId: string;
  cells: NavigationCell[];
};

export type ForbiddenReason = "door-clearance" | "primary-circulation";

export type ForbiddenCell = NavigationCell & {
  reasons: ForbiddenReason[];
  sourceIds: string[];
};

export type WallAttachmentSlot = {
  id: string;
  wallId: string;
  spaceId: string;
  side: "north" | "south" | "east" | "west";
  cell: NavigationCell;
  blockedBy: ForbiddenReason[];
};

export type NavigationCompilePlan = {
  geometry: GeometryCompilePlan;
  walkableCells: NavigationCell[];
  portals: NavigationPortal[];
  primaryRoutes: NavigationRoute[];
  primaryPathCells: NavigationCell[];
  forbiddenCells: ForbiddenCell[];
  wallAttachmentSlots: WallAttachmentSlot[];
  bounds: GridRect;
  diagnostics: CompileDiagnostic[];
};
