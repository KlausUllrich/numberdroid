import type { PlacementOverride } from "./types";

export type WorkbenchHistory = {
  past: PlacementOverride[][];
  present: PlacementOverride[];
  future: PlacementOverride[][];
};

function clone(overrides: PlacementOverride[]) {
  return overrides.map((entry) => ({
    ...entry,
    lockedGeometry: entry.lockedGeometry
      ? {
          offsetFromRootTiles: { ...entry.lockedGeometry.offsetFromRootTiles },
          sizeTiles: { ...entry.lockedGeometry.sizeTiles },
        }
      : undefined,
    lockedPlacement: entry.lockedPlacement
      ? {
          ...entry.lockedPlacement,
          offsetTiles: { ...entry.lockedPlacement.offsetTiles },
        }
      : undefined,
    offsetTiles: entry.offsetTiles ? { ...entry.offsetTiles } : undefined,
    size: entry.size ? { ...entry.size } : undefined,
  }));
}

export function createWorkbenchHistory(overrides: PlacementOverride[] = []): WorkbenchHistory {
  return { past: [], present: clone(overrides), future: [] };
}

export function commitWorkbenchHistory(history: WorkbenchHistory, next: PlacementOverride[]): WorkbenchHistory {
  if (JSON.stringify(history.present) === JSON.stringify(next)) return history;
  return {
    past: [...history.past, clone(history.present)],
    present: clone(next),
    future: [],
  };
}

export function undoWorkbenchHistory(history: WorkbenchHistory): WorkbenchHistory {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    present: clone(previous),
    future: [clone(history.present), ...history.future],
  };
}

export function redoWorkbenchHistory(history: WorkbenchHistory): WorkbenchHistory {
  const next = history.future[0];
  if (!next) return history;
  return {
    past: [...history.past, clone(history.present)],
    present: clone(next),
    future: history.future.slice(1),
  };
}
