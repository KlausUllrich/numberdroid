import type { CSSProperties } from "react";
import type { Difficulty, MathMode, Operation } from "../game/types";

export type Side = "team" | "enemy";
export type Turn = "human" | "enemy";
export type Phase = "pick" | "animating" | "finished";
export type ResolutionStage = "pulse" | "dissolve" | "fall" | "settle" | "error" | null;
export type Tile = { id: number; value: number };
export type Grid = Tile[][];
export type Pick = { row: number; col: number };
export type AdjustMode = -1 | 1 | null;
export type PulseState = { id: number; side: Side; power: number; instant: boolean };
export type GridEffect = { row: number; direction: "left" | "right" } | null;
export type EventPopup = {
  kind: "mistake" | "win" | "loss";
  eyebrow: string;
  title: string;
  equation?: string;
  detail: string;
};
export type MotionStyle = CSSProperties & { "--fall-y"?: string; "--row-shift-x"?: string };

export type ModeConfig = {
  label: string;
  short: string;
  operation: Operation;
  symbol: "+" | "−";
  target: number;
  maxValue: number;
  pool: number[];
};

export const ROWS = 6;
export const COLS = 5;
export const WIN_CORES = 11;
export const TOTAL_CORES = 12;
let nextTileId = 1;
let nextPulseId = 1;

export function makePulseId() { return nextPulseId++; }

export const MODE_INFO: Record<MathMode, ModeConfig> = {
  "add-easy": {
    label: "ZIEL 6", short: "WERTE 1–5", operation: "add", symbol: "+", target: 6, maxValue: 5,
    pool: [1, 2, 2, 3, 3, 4, 4, 5],
  },
  "add-normal": {
    label: "ZIEL 8", short: "WERTE 1–7", operation: "add", symbol: "+", target: 8, maxValue: 7,
    pool: [1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 7],
  },
  "add-hard": {
    label: "ZIEL 10", short: "WERTE 1–9", operation: "add", symbol: "+", target: 10, maxValue: 9,
    pool: [1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 7, 8, 9],
  },
  subtract: {
    label: "ZIEL 8", short: "MINUS 1–20", operation: "subtract", symbol: "−", target: 8, maxValue: 20,
    pool: [1, 2, 2, 3, 3, 4, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  },
};

export const DIFFICULTY_INFO: Record<Difficulty, { label: string; detail: string }> = {
  easy: { label: "LEICHT", detail: "meist 2er · passt öfter" },
  medium: { label: "MITTEL", detail: "oft 2er · manchmal 3er" },
  hard: { label: "STARK", detail: "meist 2–3 · selten 4er" },
};

function randomValue(mode: MathMode) {
  const pool = MODE_INFO[mode].pool;
  return pool[Math.floor(Math.random() * pool.length)];
}

function tile(value: number): Tile { return { id: nextTileId++, value }; }
function newTile(mode: MathMode) { return tile(randomValue(mode)); }

function adjacent(a: Pick, b: Pick) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

export function pathExpression(path: Pick[], grid: Grid, mode: MathMode) {
  return path.map((pick) => grid[pick.row][pick.col].value).join(` ${MODE_INFO[mode].symbol} `);
}

export function pathResult(path: Pick[], grid: Grid, mode: MathMode) {
  if (!path.length) return 0;
  const values = path.map((pick) => grid[pick.row][pick.col].value);
  if (MODE_INFO[mode].operation === "add") return values.reduce((sum, value) => sum + value, 0);
  return values.slice(1).reduce((result, value) => result - value, values[0]);
}

export function rewardForLength(length: number) {
  if (length >= 5) return { power: TOTAL_CORES, charge: 5, instant: true };
  if (length === 4) return { power: 4, charge: 4, instant: false };
  if (length === 3) return { power: 2, charge: 2, instant: false };
  if (length === 2) return { power: 1, charge: 1, instant: false };
  return { power: 0, charge: 0, instant: false };
}

export function canAppend(path: Pick[], next: Pick) {
  if (!path.length) return true;
  if (!adjacent(path[path.length - 1], next)) return false;
  return !path.some((pick) => pick.row === next.row && pick.col === next.col);
}

export function findCombinations(grid: Grid, mode: MathMode) {
  const config = MODE_INFO[mode];
  const results: Pick[][] = [];
  const seen = new Set<string>();
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;

  function explore(path: Pick[]) {
    const result = pathResult(path, grid, mode);
    if (result === config.target && path.length >= 2) {
      const forward = path.map(({ row, col }) => `${row}:${col}`).join("|");
      const reverse = [...path].reverse().map(({ row, col }) => `${row}:${col}`).join("|");
      const key = config.operation === "add" && reverse < forward ? reverse : forward;
      if (!seen.has(key)) { seen.add(key); results.push(path); }
      return;
    }
    if (path.length >= 8) return;
    if (config.operation === "add" && result >= config.target) return;
    if (config.operation === "subtract" && result <= config.target) return;
    const last = path[path.length - 1];
    for (const [rowDelta, colDelta] of directions) {
      const next = { row: last.row + rowDelta, col: last.col + colDelta };
      if (next.row < 0 || next.row >= ROWS || next.col < 0 || next.col >= COLS) continue;
      if (canAppend(path, next)) explore([...path, next]);
    }
  }

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) explore([{ row, col }]);
  }
  return results.sort((a, b) => b.length - a.length);
}

function forceSimpleCombination(grid: Grid, mode: MathMode) {
  const next = grid.map((row) => [...row]);
  const config = MODE_INFO[mode];
  if (config.operation === "add") {
    const first = Math.min(config.maxValue, Math.max(1, config.target - 2));
    next[0][0] = tile(first);
    next[0][1] = tile(config.target - first);
  } else {
    next[0][0] = tile(Math.min(config.maxValue, config.target + 4));
    next[0][1] = tile(4);
  }
  return next;
}

export function freshGrid(mode: MathMode, seed?: number): Grid {
  const config = MODE_INFO[mode];
  let seededState = seed ?? 0;
  const nextValue = seed === undefined
    ? () => randomValue(mode)
    : () => {
        seededState = (seededState * 1664525 + 1013904223) >>> 0;
        return config.pool[seededState % config.pool.length];
      };
  let grid = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => tile(nextValue())));
  if (findCombinations(grid, mode).length === 0) grid = forceSimpleCombination(grid, mode);
  return grid;
}

export function shiftRow(grid: Grid, row: number, direction: "left" | "right") {
  const next = grid.map((line) => [...line]);
  if (direction === "left") next[row] = [...next[row].slice(1), next[row][0]];
  else next[row] = [next[row][COLS - 1], ...next[row].slice(0, COLS - 1)];
  return next;
}

function collapseGrid(grid: Grid, picks: Pick[], mode: MathMode) {
  const removed = new Set(picks.map(({ row, col }) => `${row}:${col}`));
  const fallRows: Record<number, number> = {};
  const columns = Array.from({ length: COLS }, (_, col) => {
    const survivors = grid.map((row, rowIndex) => ({ row: rowIndex, value: row[col] }))
      .filter((entry) => !removed.has(`${entry.row}:${col}`));
    const missing = ROWS - survivors.length;
    const arrivals = Array.from({ length: missing }, () => ({ row: -1, value: newTile(mode) }));
    const column = [...arrivals, ...survivors];
    column.forEach((entry, finalRow) => {
      fallRows[entry.value.id] = entry.row < 0 ? finalRow + 1 : Math.max(0, finalRow - entry.row);
    });
    return column.map((entry) => entry.value);
  });
  let next = Array.from({ length: ROWS }, (_, row) => Array.from({ length: COLS }, (_, col) => columns[col][row]));
  if (findCombinations(next, mode).length === 0) next = forceSimpleCombination(next, mode);
  return { grid: next, fallRows };
}

export function resolveGrid(grid: Grid, path: Pick[], mode: MathMode) {
  const collapsed = collapseGrid(grid, path, mode);
  return { collapsed: collapsed.grid, grid: collapsed.grid, fallRows: collapsed.fallRows };
}

export function chooseAiPath(paths: Pick[][], difficulty: Difficulty): Pick[] {
  if (!paths.length) return [];
  const profiles = {
    easy: { pass: 0.3, weights: { 2: 0.84, 3: 0.15, 4: 0.01, 5: 0 } },
    medium: { pass: 0.14, weights: { 2: 0.7, 3: 0.26, 4: 0.038, 5: 0.002 } },
    hard: { pass: 0.04, weights: { 2: 0.5, 3: 0.36, 4: 0.13, 5: 0.01 } },
  } as const;
  const profile = profiles[difficulty];
  if (Math.random() < profile.pass) return [];
  let roll = Math.random();
  const chosenLength = ([2, 3, 4, 5] as const).find((length) => {
    roll -= profile.weights[length];
    return roll <= 0;
  });
  if (!chosenLength) return [];
  const choices = paths.filter((path) => path.length === chosenLength);
  return choices[Math.floor(Math.random() * choices.length)] ?? [];
}

export function changedCoreRange(before: number, after: number) {
  return Array.from({ length: Math.abs(after - before) }, (_, offset) => Math.min(before, after) + offset);
}
