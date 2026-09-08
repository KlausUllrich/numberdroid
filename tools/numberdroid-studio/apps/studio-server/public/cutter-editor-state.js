// Browser-only editing helpers. Server commands remain the authoritative cutter validator.
const MAX_SOURCE_DIMENSION = 4096;
const MAX_CUTS = 64;
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
const MAX_OUTPUT_PIXELS = 64 * 1024 * 1024;
const RESIZE_MODES = new Set(['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']);
const clone = (value) => structuredClone(value);
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function sourceIsValid(source) {
  return source && ['width', 'height'].every((key) => Number.isSafeInteger(source[key])
    && source[key] > 0 && source[key] <= MAX_SOURCE_DIMENSION);
}

function gridIsValid(source, grid) {
  return sourceIsValid(source) && grid
    && ['width', 'height', 'x', 'y', 'gapX', 'gapY'].every((key) => Number.isSafeInteger(grid[key]))
    && grid.width > 0 && grid.width <= source.width
    && grid.height > 0 && grid.height <= source.height
    && grid.x >= 0 && grid.x < source.width && grid.y >= 0 && grid.y < source.height
    && grid.gapX >= 0 && grid.gapY >= 0
    && Number.isSafeInteger(grid.width + grid.gapX)
    && Number.isSafeInteger(grid.height + grid.gapY);
}

/** Full-cell count is exact; cells contains at most maxCuts + 1 entries. */
export function cutterGridInfo(source, grid, { maxCuts = MAX_CUTS } = {}) {
  if (!Number.isSafeInteger(maxCuts) || maxCuts < 1 || maxCuts > MAX_CUTS) {
    throw new RangeError('maxCuts must be an integer from 1 to 64.');
  }
  if (!gridIsValid(source, grid)) {
    return { valid: false, columns: 0, rows: 0, count: 0, cells: [], unusedRight: 0, unusedBottom: 0 };
  }
  const columns = Math.max(0, 1 + Math.floor((source.width - grid.x - grid.width) / (grid.width + grid.gapX)));
  const rows = Math.max(0, 1 + Math.floor((source.height - grid.y - grid.height) / (grid.height + grid.gapY)));
  const count = columns * rows;
  const cells = [];
  for (let index = 0; index < Math.min(count, maxCuts + 1); index += 1) {
    cells.push({ x: grid.x + (index % columns) * (grid.width + grid.gapX),
      y: grid.y + Math.floor(index / columns) * (grid.height + grid.gapY),
      width: grid.width, height: grid.height });
  }
  return { valid: true, columns, rows, count, cells,
    unusedRight: source.width - (columns ? grid.x + (columns - 1) * (grid.width + grid.gapX) + grid.width : grid.x),
    unusedBottom: source.height - (rows ? grid.y + (rows - 1) * (grid.height + grid.gapY) + grid.height : grid.y) };
}

/** Grid starts and ends both snap, so gaps are never mistaken for part of a cell. */
export function cutterGridStops(source, grid, axis) {
  if (!['x', 'y'].includes(axis)) throw new TypeError('Grid axis must be x or y.');
  if (!gridIsValid(source, grid)) return [];
  const dimension = axis === 'x' ? 'width' : 'height';
  const extent = source[dimension];
  const cell = grid[dimension];
  const stride = cell + grid[axis === 'x' ? 'gapX' : 'gapY'];
  const stops = new Set([0, extent]);
  for (let position = grid[axis]; position <= extent; position += stride) {
    stops.add(position);
    if (position + cell <= extent) stops.add(position + cell);
  }
  return [...stops].sort((left, right) => left - right);
}

export function cutterSnapCoordinate(value, source, grid, axis) {
  if (!['x', 'y'].includes(axis)) throw new TypeError('Grid axis must be x or y.');
  if (!Number.isFinite(value) || !sourceIsValid(source)) return value;
  const rounded = clamp(Math.round(value), 0, source[axis === 'x' ? 'width' : 'height']);
  const stops = cutterGridStops(source, grid, axis);
  if (!stops.length) return rounded;
  return stops.reduce((best, next) => Math.abs(next - rounded) < Math.abs(best - rounded) ? next : best, stops[0]);
}

function geometryIsValid(rectangle, source) {
  return rectangle && ['x', 'y', 'width', 'height'].every((key) => Number.isSafeInteger(rectangle[key]))
    && rectangle.x >= 0 && rectangle.y >= 0 && rectangle.width > 0 && rectangle.height > 0
    && rectangle.width <= source.width - rectangle.x && rectangle.height <= source.height - rectangle.y;
}

/**
 * start/point use source pixels under the caller's frozen inverse transform.
 * Draw start is the already captured (optionally snapped) anchor. The caller
 * snapshots grid/snap at pointerdown; Alt may bypass snapping on each move.
 * Invalid numeric drafts remain unchanged and are reported by cutterEditIssues.
 */
export function cutterDragRectangle(original, start, point, {
  mode = 'move', source, grid = null, snap = false, altKey = false,
} = {}) {
  const rectangle = clone(original);
  if (!original || typeof original !== 'object' || !sourceIsValid(source) || !start || !point
    || ![start.x, start.y, point.x, point.y].every(Number.isFinite)
    || (mode !== 'draw' && !geometryIsValid(original, source))) return rectangle;
  if (mode !== 'move' && mode !== 'draw' && !RESIZE_MODES.has(mode)) return rectangle;
  const adjusted = (value, axis) => snap && !altKey
    ? cutterSnapCoordinate(value, source, grid, axis) : Math.round(value);
  const dx = Math.round(point.x - start.x);
  const dy = Math.round(point.y - start.y);
  if (mode === 'move') {
    rectangle.x = clamp(adjusted(original.x + dx, 'x'), 0, source.width - original.width);
    rectangle.y = clamp(adjusted(original.y + dy, 'y'), 0, source.height - original.height);
  } else if (mode === 'draw') {
    const anchorX = clamp(Math.round(start.x), 0, source.width);
    const anchorY = clamp(Math.round(start.y), 0, source.height);
    const endX = clamp(adjusted(point.x, 'x'), 0, source.width);
    const endY = clamp(adjusted(point.y, 'y'), 0, source.height);
    rectangle.x = Math.min(source.width - 1, anchorX, endX);
    rectangle.y = Math.min(source.height - 1, anchorY, endY);
    rectangle.width = Math.max(1, Math.abs(endX - anchorX));
    rectangle.height = Math.max(1, Math.abs(endY - anchorY));
  } else {
    let left = original.x; let top = original.y;
    let right = original.x + original.width; let bottom = original.y + original.height;
    if (mode.includes('w')) left = clamp(adjusted(original.x + dx, 'x'), 0, right - 1);
    if (mode.includes('e')) right = clamp(adjusted(original.x + original.width + dx, 'x'), left + 1, source.width);
    if (mode.includes('n')) top = clamp(adjusted(original.y + dy, 'y'), 0, bottom - 1);
    if (mode.includes('s')) bottom = clamp(adjusted(original.y + original.height + dy, 'y'), top + 1, source.height);
    Object.assign(rectangle, { x: left, y: top, width: right - left, height: bottom - top });
  }
  return rectangle;
}

export function cutterDisplayName(rectangle, index = 0) {
  return typeof rectangle?.name === 'string' && rectangle.name.trim()
    ? rectangle.name.trim() : `Cut ${index + 1}`;
}

/** Advisory draft checks; this never repairs, normalizes or saves user input. */
export function cutterEditIssues(rectangles, source) {
  const messages = []; const invalidRectangleIds = new Set();
  const add = (message, ...items) => {
    messages.push(message);
    for (const rectangle of items) if (rectangle?.rectangleId) invalidRectangleIds.add(rectangle.rectangleId);
  };
  if (!sourceIsValid(source)) add('The source needs valid pixel dimensions before cuts can be edited.');
  if (!Array.isArray(rectangles) || rectangles.length === 0) {
    add('Keep at least one cut to preview its output.');
    return { messages, invalidRectangleIds, canPreview: false };
  }
  if (rectangles.length > MAX_CUTS) {
    add('Use at most 64 cuts. Remove unwanted cuts before previewing.');
    return { messages, invalidRectangleIds, canPreview: false };
  }
  if (!rectangles.some((rectangle) => rectangle?.included === true)) add('Keep at least one cut to preview its output.');
  const ids = new Map(); const validIncluded = []; let outputPixels = 0;
  for (const [index, rectangle] of rectangles.entries()) {
    const name = cutterDisplayName(rectangle, index);
    if (ids.has(rectangle?.rectangleId)) add(`${name} repeats another cut identity. Create a separate cut.`, ids.get(rectangle?.rectangleId), rectangle);
    else ids.set(rectangle?.rectangleId, rectangle);
    if (!sourceIsValid(source) || !geometryIsValid(rectangle, source)) {
      add(`${name} needs whole-pixel coordinates, a positive size and edges inside the source.`, rectangle);
      continue;
    }
    if (typeof rectangle.included !== 'boolean') add(`${name} needs an explicit choice to keep or exclude it.`, rectangle);
    if (rectangle.pivot != null && (!Number.isSafeInteger(rectangle.pivot.x) || !Number.isSafeInteger(rectangle.pivot.y)
      || rectangle.pivot.x < 0 || rectangle.pivot.y < 0 || rectangle.pivot.x >= rectangle.width || rectangle.pivot.y >= rectangle.height)) {
      add(`${name}'s pivot is outside the adjusted cut. Move the pivot or enlarge the cut.`, rectangle);
    }
    if (rectangle.included !== true) continue;
    const pixels = rectangle.width * rectangle.height;
    outputPixels += pixels;
    const rawBytes = (rectangle.width * 4 + 1) * rectangle.height;
    const outputBytes = 63 + rawBytes + Math.ceil(rawBytes / 65535) * 5;
    if (outputBytes > MAX_OUTPUT_BYTES) add(`${name} would exceed the 16 MiB output limit. Use a smaller cut.`, rectangle);
    for (const prior of validIncluded) {
      if (rectangle.x < prior.x + prior.width && prior.x < rectangle.x + rectangle.width
        && rectangle.y < prior.y + prior.height && prior.y < rectangle.y + rectangle.height) {
        add(`${cutterDisplayName(prior, rectangles.indexOf(prior))} and ${name} overlap. Adjust an edge or keep only one of them.`, prior, rectangle);
      }
    }
    validIncluded.push(rectangle);
  }
  if (outputPixels > MAX_OUTPUT_PIXELS) add('Included cuts exceed the 64 Mi pixel budget. Keep fewer or smaller cuts.');
  return { messages, invalidRectangleIds, canPreview: messages.length === 0 };
}

function sameValue(left, right) {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object'
    || Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length
    && keys.every((key) => Object.hasOwn(right, key) && sameValue(left[key], right[key]));
}

/** Full snapshots include names, inclusion, pivots and explicit replacement maps. */
export function cutterHistoryPush(history, before, after, { limit = 40 } = {}) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) throw new RangeError('History limit must be an integer from 1 to 1000.');
  const current = history ?? { past: [], future: [] };
  if (sameValue(before, after)) return clone(current);
  return { past: [...clone(current.past), clone(before)].slice(-limit), future: [] };
}

export function cutterHistoryStep(history, current, direction = 'undo') {
  if (!['undo', 'redo'].includes(direction)) throw new TypeError('History direction must be undo or redo.');
  const next = clone(history ?? { past: [], future: [] });
  const from = direction === 'undo' ? next.past : next.future;
  const to = direction === 'undo' ? next.future : next.past;
  if (!from.length) return { history: next, rectangles: clone(current), changed: false };
  const rectangles = from.pop();
  to.push(clone(current));
  return { history: next, rectangles, changed: true };
}
