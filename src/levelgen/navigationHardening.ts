import { compileLevelNavigation } from "./navigation";
import type { GeometryCompilePlan, GridRect } from "./geometryTypes";
import type { ForbiddenCell, NavigationCompilePlan, NavigationCell } from "./navigationTypes";

export type DoorClearanceZone = {
  /** Stable authoring/debug identifier for this room-side clearance region. */
  id: string;
  connectionId: string;
  spaceId: string;
  /** Which semantic side of the authored connection this clearance belongs to. */
  side: "before" | "after";
  rect: GridRect;
};

export type HardenedNavigationCompilePlan = NavigationCompilePlan & {
  doorClearanceZones: DoorClearanceZone[];
};

function cellKey(cell: { x: number; y: number }) {
  return `${cell.x},${cell.y}`;
}

function rectIntersectsCell(rect: GridRect, cell: { x: number; y: number }) {
  return cell.x < rect.x + rect.w
    && cell.x + 1 > rect.x
    && cell.y < rect.y + rect.h
    && cell.y + 1 > rect.y;
}

/**
 * Door clearance is twice the aperture width along the wall axis:
 * one half-door-width of extra lateral breathing room on each side.
 * Depth into each connected room remains authored by before/after.
 */
function widenClearance(rect: GridRect, wallOrientation: "horizontal" | "vertical", apertureLength: number): GridRect {
  const lateral = apertureLength / 2;
  return wallOrientation === "vertical"
    ? { x: rect.x, y: rect.y - lateral, w: rect.w, h: rect.h + apertureLength }
    : { x: rect.x - lateral, y: rect.y, w: rect.w + apertureLength, h: rect.h };
}

function mergeForbidden(
  cells: NavigationCell[],
  current: ForbiddenCell[],
  zones: DoorClearanceZone[],
): ForbiddenCell[] {
  const merged = new Map<string, ForbiddenCell>();
  for (const entry of current) {
    merged.set(cellKey(entry), {
      ...entry,
      reasons: [...entry.reasons],
      sourceIds: [...entry.sourceIds],
    });
  }

  for (const zone of zones) {
    for (const cell of cells) {
      if (cell.spaceId !== zone.spaceId || !rectIntersectsCell(zone.rect, cell)) continue;
      const key = cellKey(cell);
      const entry = merged.get(key) ?? { ...cell, reasons: [], sourceIds: [] };
      if (!entry.reasons.includes("door-clearance")) entry.reasons.push("door-clearance");
      if (!entry.sourceIds.includes(zone.connectionId)) entry.sourceIds.push(zone.connectionId);
      entry.reasons.sort();
      entry.sourceIds.sort();
      merged.set(key, entry);
    }
  }

  return [...merged.values()];
}

export function compileLevelNavigationV031(geometry: GeometryCompilePlan): HardenedNavigationCompilePlan {
  const base = compileLevelNavigation(geometry);
  const zones: DoorClearanceZone[] = [];

  const connections = base.geometry.connections.map((connection) => {
    if (connection.kind === "opening") return connection;

    const clearanceBefore = connection.clearanceBefore
      ? widenClearance(connection.clearanceBefore, connection.wallOrientation, connection.apertureLength)
      : null;
    const clearanceAfter = connection.clearanceAfter
      ? widenClearance(connection.clearanceAfter, connection.wallOrientation, connection.apertureLength)
      : null;

    if (clearanceBefore) {
      zones.push({
        id: `door-clearance:${connection.id}:before`,
        connectionId: connection.id,
        spaceId: connection.from,
        side: "before",
        rect: clearanceBefore,
      });
    }
    if (clearanceAfter) {
      zones.push({
        id: `door-clearance:${connection.id}:after`,
        connectionId: connection.id,
        spaceId: connection.to,
        side: "after",
        rect: clearanceAfter,
      });
    }

    return { ...connection, clearanceBefore, clearanceAfter };
  });

  const hardenedGeometry = { ...base.geometry, connections };
  const forbiddenCells = mergeForbidden(base.walkableCells, base.forbiddenCells, zones);
  const forbiddenByCell = new Map(forbiddenCells.map((cell) => [cellKey(cell), cell]));
  const wallAttachmentSlots = base.wallAttachmentSlots.map((slot) => {
    const entry = forbiddenByCell.get(cellKey(slot.cell));
    const blockedBy = [...new Set([...(slot.blockedBy ?? []), ...(entry?.reasons ?? [])])].sort();
    return { ...slot, blockedBy };
  });

  return {
    ...base,
    geometry: hardenedGeometry,
    forbiddenCells,
    wallAttachmentSlots,
    doorClearanceZones: zones,
    diagnostics: [
      ...base.diagnostics,
      {
        level: "info",
        code: "DOOR_CLEARANCE_LATERAL_2X",
        message: "Door clearance spans 2× aperture width along the wall axis (half a door width added on each side).",
      },
    ],
  };
}
