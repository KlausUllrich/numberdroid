import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const app = await readFile(new URL('../apps/studio-server/public/app.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../apps/studio-server/public/styles.css', import.meta.url), 'utf8');

test('Room instructions name the cell tools and distinguish draft edits from saved state', () => {
  const source = app.slice(app.indexOf('function roomCanvasHintText'), app.indexOf('function roomControl'));
  const hint = (activeTool, lifecycle = 'DRAFT') => runInNewContext(`(${source})({ lifecycle: '${lifecycle}' }, null)`, { state: { roomUi: { activeTool } } });
  assert.match(hint('SELECT'), /choose Room floor, Outside room or Blocked in room on the left, then click the cell/);
  for (const tool of ['PAINT_ROOM', 'PAINT_VOID', 'PAINT_BLOCKED']) {
    assert.match(hint(tool), /Save changes keeps all Room edits; Discard changes restores the saved Room/);
    assert.match(hint(tool), /Enter\/Space/);
    assert.match(hint(tool), /Artwork is dimmed.*not removed/);
  }
  assert.match(hint('SELECT', 'FINAL'), /read-only/);
  assert.doesNotMatch(hint('SELECT', 'FINAL'), /then click the cell/);
});

test('Room labels occupy separate edges and leave continuous multi-cell images unobscured by default', () => {
  assert.match(css, /\.room-placement > \.room-placement-label \{[^}]*bottom: 0[^}]*font: 11px[^}]*opacity: 0/);
  assert.match(css, /\.room-connector-label \{[^}]*top: 0[^}]*font: 11px[^}]*opacity: 0/);
  for (const kind of ['placement', 'connector']) {
    const labelRule = css.match(new RegExp(`\\.room-${kind}-label \\{([^}]+)`))?.[1];
    assert.match(labelRule, /max-height: max\(0px, calc\(var\(--room-cell\) \* \.5 - 5px\)\)/);
    assert.match(labelRule, /padding: 0 4px/);
    assert.match(css, new RegExp(`\\.room-${kind}:focus-visible > \\.room-${kind}-label`));
    assert.match(css, new RegExp(`\\.room-${kind}\\[data-selected="true"\\] > \\.room-${kind}-label`));
  }
  const canvas = app.slice(app.indexOf('function renderRoomCanvas'), app.indexOf('function renderRoomLayers'));
  const placement = app.slice(app.indexOf('function renderRoomPlacement('), app.indexOf('function renderRoomCanvas'));
  assert.match(canvas, /renderRoomPlacement\(placement, snapshot\)/);
  assert.match(placement, /placed\.style\.width = `calc\(\$\{span\.width\}/);
  assert.match(placement, /placed\.style\.height = `calc\(\$\{span\.height\}/);
  assert.equal(placement.match(/placed\.append\(roomPlacementVisual/g)?.length, 1);
  assert.match(placement, /placed\.setAttribute\('aria-label'/);
  assert.match(canvas, /clearance\.setAttribute\('aria-label'/);
  assert.match(css, /scrollbar-gutter: stable/);
});

test('Room Inspector distinguishes footprint, modern image overhang and legacy Preview-only presentation', () => {
  const inspector = app.slice(app.indexOf('function renderRoomInspector'), app.indexOf('function roomCellsText'));
  assert.match(inspector, /roomAssetSpan\(asset, selected\.rotation\)/);
  assert.match(inspector, /one placement, not a separate copy in each cell/);
  assert.match(inspector, /if \(asset\?\.metadata\?\.spatial\)/);
  assert.match(inspector, /else if \(asset\?\.metadata\?\.extensions\?\.\['studio\.preview\.presentation'\]\)/);
  assert.match(inspector, /may look larger there without occupying more cells/);
});

test('Room save/discard and dock controls retain readable action sizing without weakening draft guards', () => {
  const options = app.slice(app.indexOf('function renderRoomToolOptions'), app.indexOf('function renderRoomDockNavigation'));
  assert.match(options, /save\.disabled = !moveState\.dirty \|\| moveState\.locked \|\| variant\.lifecycle !== 'DRAFT'/);
  assert.match(options, /reset\.disabled = !moveState\.dirty \|\| moveState\.locked/);
  assert.match(options, /actions\.append\(save, reset\)/);
  assert.match(options, /save\.classList\.remove\('secondary'\)/);
  const actionRule = css.match(/\.room-tool-actions button \{([^}]+)\}/)?.[1];
  assert.match(actionRule, /min-height: 4[0-9]px/);
  assert.match(actionRule, /font-size: 1[4-9]px/);
  assert.doesNotMatch(css, /\.room-dock-navigation button \{[^}]*font-size: [789]px/);
  const dockRule = css.match(/\.room-dock-navigation button \{([^}]+)\}/)?.[1];
  assert.match(dockRule, /min-height: 4[0-9]px/);
  assert.match(dockRule, /font-size: 1[4-9]px/);
  assert.match(dockRule, /white-space: normal/);
  assert.match(dockRule, /border-radius: 0/);
  const ordinaryDockActions = css.match(/\.room-move-controls button, \.room-lifecycle-actions button \{([^}]+)\}/)?.[1];
  assert.match(ordinaryDockActions, /min-height: 4[0-9]px/);
  assert.match(ordinaryDockActions, /font-size: 1[4-9]px/);
});
