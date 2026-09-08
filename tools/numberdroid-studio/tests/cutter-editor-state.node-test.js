import assert from 'node:assert/strict';
import test from 'node:test';
import { cutterGridInfo, cutterGridStops, cutterSnapCoordinate, cutterDragRectangle,
  cutterEditIssues, cutterHistoryPush, cutterHistoryStep, cutterDisplayName,
} from '../apps/studio-server/public/cutter-editor-state.js';

const source = { width: 1254, height: 1254 };
const grid = { width: 622, height: 622, x: 3, y: 3, gapX: 4, gapY: 4 };
const cut = (overrides = {}) => ({ rectangleId: 'cut.one', name: 'Calm floor', x: 100, y: 150,
  width: 300, height: 400, included: true, pivot: { x: 20, y: 30 },
  transparentPaddingPolicy: 'preserve_exact_rect', replacesSliceId: 'slice.previous', expectedSliceVersion: 2,
  ...overrides });
const bounds = (rectangle) => [rectangle.x, rectangle.y, rectangle.width, rectangle.height];
const drag = (mode, dx, dy, options = {}) => cutterDragRectangle(cut(), { x: 120, y: 170 },
  { x: 120 + dx, y: 170 + dy }, { mode, source, ...options });

function freeze(value) {
  if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); }
  return value;
}

test('full grid preserves exact accepted source margins/gaps and row-major crop geometry', () => {
  const before = structuredClone(grid);
  const result = cutterGridInfo(source, freeze(grid));
  assert.deepEqual(result, { valid: true, columns: 2, rows: 2, count: 4,
    cells: [{ x: 3, y: 3, width: 622, height: 622 }, { x: 629, y: 3, width: 622, height: 622 },
      { x: 3, y: 629, width: 622, height: 622 }, { x: 629, y: 629, width: 622, height: 622 }],
    unusedRight: 3, unusedBottom: 3 });
  assert.deepEqual(grid, before);
  assert.deepEqual(cutterGridStops(source, grid, 'x'), [0, 3, 625, 629, 1251, 1254]);
  assert.equal(cutterSnapCoordinate(626, source, grid, 'x'), 625);
  assert.equal(cutterSnapCoordinate(628, source, grid, 'x'), 629);
  assert.equal(cutterSnapCoordinate(627, source, grid, 'x'), 625, 'ties choose the lower source coordinate');
});

test('fine guide grids stay useful while generated cuts remain bounded', () => {
  const largeSource = { width: 4096, height: 4096 };
  const fineGrid = { x: 0, y: 0, width: 1, height: 1, gapX: 0, gapY: 0 };
  const result = cutterGridInfo(largeSource, fineGrid);
  assert.equal(result.valid, true); assert.equal(result.count, 16777216);
  assert.equal(result.rows, 4096); assert.equal(result.columns, 4096);
  assert.equal(result.cells.length, 65); assert.equal(cutterGridStops(largeSource, fineGrid, 'x').length, 4097);
  assert.equal(cutterGridInfo(largeSource, fineGrid, { maxCuts: 4 }).cells.length, 5);
  const remainder = cutterGridInfo({ width: 24, height: 22 }, { x: 2, y: 3, width: 7, height: 5, gapX: 2, gapY: 3 });
  assert.deepEqual([remainder.columns, remainder.rows, remainder.count, remainder.unusedRight, remainder.unusedBottom], [2, 2, 4, 6, 6]);
});

test('invalid and empty grids never make replacement rectangles or perform unsafe arithmetic', () => {
  for (const patch of [{ width: 0 }, { height: 1.5 }, { x: -1 }, { y: 1254 }, { gapX: NaN },
    { gapY: -1 }, { gapX: Number.MAX_SAFE_INTEGER }, { width: 1255 }]) {
    const candidate = { ...grid, ...patch };
    const result = cutterGridInfo(source, candidate);
    assert.equal(result.valid, false, JSON.stringify(patch)); assert.equal(result.cells.length, 0);
    assert.deepEqual(cutterGridStops(source, candidate, 'y'), []);
    assert.equal(cutterSnapCoordinate(4.3, source, candidate, 'y'), 4);
  }
  const empty = cutterGridInfo(source, { ...grid, x: 1200 });
  assert.equal(empty.valid, true); assert.equal(empty.count, 0); assert.deepEqual(empty.cells, []);
  assert.throws(() => cutterGridInfo(source, grid, { maxCuts: Infinity }), RangeError);
});

test('all eight handles keep their opposite boundaries and edges stay on one axis', () => {
  const expected = { n: [100, 173, 300, 377], ne: [100, 173, 317, 377], e: [100, 150, 317, 400],
    se: [100, 150, 317, 423], s: [100, 150, 300, 423], sw: [117, 150, 283, 423],
    w: [117, 150, 283, 400], nw: [117, 173, 283, 377] };
  for (const [mode, geometry] of Object.entries(expected)) assert.deepEqual(bounds(drag(mode, 17, 23)), geometry, mode);
  assert.deepEqual(bounds(drag('w', 2000, -2000)), [399, 150, 1, 400]);
  assert.deepEqual(bounds(drag('n', -2000, 2000)), [100, 549, 300, 1]);
  assert.deepEqual(bounds(drag('e', -2000, 2000)), [100, 150, 1, 400]);
  assert.deepEqual(bounds(drag('s', 2000, -2000)), [100, 150, 300, 1]);
  assert.deepEqual(bounds(drag('nw', -2000, -2000)), [0, 0, 400, 550]);
  assert.deepEqual(bounds(drag('se', 2000, 2000)), [100, 150, 1154, 1104]);
});

test('moves and resizes snap to cell starts or ends and Alt preserves pixel adjustments', () => {
  const smallGrid = { x: 3, y: 5, width: 20, height: 30, gapX: 4, gapY: 6 };
  assert.deepEqual(bounds(drag('move', 16, 14, { grid: smallGrid, snap: true })), [119, 149, 300, 400]);
  assert.deepEqual(bounds(drag('move', 16, 14, { grid: smallGrid, snap: true, altKey: true })), [116, 164, 300, 400]);
  assert.deepEqual(bounds(drag('e', 11, -99, { grid: smallGrid, snap: true })), [100, 150, 311, 400]);
  assert.deepEqual(bounds(drag('n', 999, 10, { grid: smallGrid, snap: true })), [100, 149, 300, 401]);
  assert.deepEqual(bounds(drag('n', 999, 10, { grid: smallGrid, snap: true, altKey: true })), [100, 160, 300, 390]);
  assert.deepEqual(bounds(drag('move', 9999, -9999)), [954, 0, 300, 400]);
});

test('draws work in both directions, keep their captured anchor and stay positive at source edges', () => {
  const options = { mode: 'draw', source };
  for (const [start, point, expected] of [
    [{ x: 10, y: 20 }, { x: 110, y: 220 }, [10, 20, 100, 200]],
    [{ x: 110, y: 220 }, { x: 10, y: 20 }, [10, 20, 100, 200]],
    [{ x: 10, y: 220 }, { x: 110, y: 20 }, [10, 20, 100, 200]],
    [{ x: 1254, y: 1254 }, { x: 1254, y: 1254 }, [1253, 1253, 1, 1]],
    [{ x: 0, y: 0 }, { x: -8, y: -50 }, [0, 0, 1, 1]],
    [{ x: 1254, y: 1254 }, { x: -8, y: -50 }, [0, 0, 1254, 1254]],
  ]) assert.deepEqual(bounds(cutterDragRectangle(cut(), start, point, options)), expected);
  const snapped = cutterDragRectangle(cut(), { x: 3, y: 3 }, { x: 626, y: 630 }, { ...options, grid, snap: true });
  assert.deepEqual(bounds(snapped), [3, 3, 622, 626]);
  const free = cutterDragRectangle(cut(), { x: 3, y: 3 }, { x: 626, y: 630 }, { ...options, grid, snap: true, altKey: true });
  assert.deepEqual(bounds(free), [3, 3, 623, 627]);
});

test('geometry preserves exact identities and nested metadata and never mutates malformed numeric drafts', () => {
  const original = freeze(cut());
  const changed = cutterDragRectangle(original, { x: 10, y: 10 }, { x: 15, y: 20 }, { source });
  assert.deepEqual(bounds(changed), [105, 160, 300, 400]);
  for (const field of ['rectangleId', 'name', 'included', 'pivot', 'transparentPaddingPolicy', 'replacesSliceId', 'expectedSliceVersion']) {
    assert.deepEqual(changed[field], original[field], field);
  }
  changed.pivot.x = 99; assert.equal(original.pivot.x, 20);
  const invalid = freeze(cut({ x: NaN, width: 0 }));
  assert.deepEqual(cutterDragRectangle(invalid, { x: 10, y: 10 }, { x: 15, y: 20 }, { source }), invalid);
  assert.deepEqual(cutterDragRectangle(original, { x: 10, y: 10 }, { x: Infinity, y: 20 }, { source }), original);
});

test('validation accepts touching edges, ignores excluded overlap and reports both included conflicting cuts', () => {
  const cuts = [cut({ x: 3, y: 3, width: 622, height: 622 }),
    cut({ rectangleId: 'cut.two', name: 'Service floor', x: 625, y: 3, width: 622, height: 622 })];
  assert.equal(cutterEditIssues(freeze(cuts), source).canPreview, true);
  const overlap = [cuts[0], { ...cuts[1], x: 624 }];
  const issues = cutterEditIssues(overlap, source);
  assert.equal(issues.canPreview, false);
  assert.deepEqual([...issues.invalidRectangleIds], ['cut.one', 'cut.two']);
  assert.match(issues.messages[0], /Calm floor and Service floor overlap/);
  assert.equal(cutterEditIssues([cuts[0], { ...cuts[1], x: 624, included: false }], source).canPreview, true);
});

test('validation leaves fractional, negative, oversized and missing drafts intact while blocking preview', () => {
  for (const patch of [{ x: -1 }, { y: 0.5 }, { width: NaN }, { height: 0 }, { width: 1254 },
    { pivot: { x: 300, y: 0 } }, { included: null }]) {
    const candidate = freeze(cut(patch)); const before = structuredClone(candidate);
    const issues = cutterEditIssues([candidate], source);
    assert.equal(issues.canPreview, false); assert(issues.invalidRectangleIds.has('cut.one'));
    assert.deepEqual(candidate, before);
  }
  assert.equal(cutterEditIssues([], source).canPreview, false);
  assert.equal(cutterEditIssues([cut({ included: false })], source).canPreview, false);
  const huge = cut({ x: 0, y: 0, width: 2048, height: 2048 });
  assert.match(cutterEditIssues([huge], { width: 4096, height: 4096 }).messages.join(' '), /16 MiB/);
  assert.match(cutterEditIssues([cut(), cut({ x: 500 })], source).messages.join(' '), /identity/);
});

test('Undo/Redo retains names, inclusion, remaps and replaced layouts without sharing mutable snapshots', () => {
  const original = [cut()];
  const renamed = [{ ...cut(), name: 'Quiet floor', included: false, replacesSliceId: null, expectedSliceVersion: null }];
  const replaced = [cut({ rectangleId: 'cut.grid.1', name: '', x: 3, y: 3, width: 622, height: 622 })];
  let history = cutterHistoryPush(undefined, original, renamed);
  history = cutterHistoryPush(history, renamed, replaced);
  const unchangedHistory = structuredClone(history);
  const undo = cutterHistoryStep(freeze(history), replaced, 'undo');
  assert.equal(undo.changed, true); assert.deepEqual(undo.rectangles, renamed);
  assert.deepEqual(history, unchangedHistory);
  const again = cutterHistoryStep(undo.history, undo.rectangles, 'undo');
  assert.deepEqual(again.rectangles, original);
  again.rectangles[0].pivot.x = 100; assert.equal(original[0].pivot.x, 20);
  const redo = cutterHistoryStep(undo.history, undo.rectangles, 'redo');
  assert.deepEqual(redo.rectangles, replaced);
  const branched = cutterHistoryPush(undo.history, renamed, [{ ...renamed[0], name: 'New direction' }]);
  assert.deepEqual(branched.future, []);
  assert.equal(cutterHistoryStep(branched, renamed, 'redo').changed, false);
});

test('history skips no-ops without destroying Redo and bounds old checkpoints', () => {
  const original = [cut()]; const changed = [cut({ x: 101 })];
  const pushed = cutterHistoryPush(undefined, original, changed);
  const undo = cutterHistoryStep(pushed, changed);
  const noop = cutterHistoryPush(undo.history, original, structuredClone(original));
  assert.deepEqual(noop, undo.history);
  let history;
  for (let index = 0; index < 6; index += 1) history = cutterHistoryPush(history, [cut({ x: index })], [cut({ x: index + 1 })], { limit: 3 });
  assert.deepEqual(history.past.map((items) => items[0].x), [3, 4, 5]);
  const invalidEdit = cutterHistoryPush(undefined, [cut({ width: NaN })], [cut({ width: null })]);
  assert.equal(invalidEdit.past.length, 1, 'invalid numeric drafts are not flattened by JSON serialization');
  assert.equal(cutterHistoryStep(undefined, original).changed, false);
});

test('display labels use human names with stable numbered fallbacks and never change identity', () => {
  const original = freeze(cut({ name: '  Calm floor  ' }));
  assert.equal(cutterDisplayName(original, 6), 'Calm floor');
  assert.equal(cutterDisplayName({ name: '  ' }, 6), 'Cut 7');
  assert.equal(cutterDisplayName({}, 0), 'Cut 1');
  assert.equal(original.name, '  Calm floor  '); assert.equal(original.rectangleId, 'cut.one');
});
