import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const appUrl = new URL('../apps/studio-server/public/app.js', import.meta.url);
const stylesUrl = new URL('../apps/studio-server/public/styles.css', import.meta.url);

test('Checkpoint 3 exposes a coordinate-visible layered room and hallway designer', async () => {
  const app = await readFile(appUrl, 'utf8');
  const renderer = app.slice(app.indexOf('function currentRoomLibrary'), app.indexOf('function renderCollection'));
  assert.match(renderer, /New room archetype/);
  assert.match(renderer, /New room \/ hallway/);
  assert.match(renderer, /Origin 0,0/);
  assert.match(renderer, /\['fit', 'Fit'\], \['1', '100%'\], \['2', '200%'\]/);
  assert.match(renderer, /STRUCTURAL_SURFACE/);
  assert.match(renderer, /SET_DRESSING/);
  assert.match(renderer, /clearanceInside/);
  assert.match(renderer, /Cell \$\{x\}, \$\{y\}/);
  assert.match(renderer, /Structured placements/);
  assert.match(renderer, /A\$\{selected\.assetVersion\}\/M\$\{selected\.metadataVersion\}/);
  assert.match(renderer, /safeV2Preview\(asset\)/);
  assert.match(renderer, /Preview missing|safeV2Preview/);
});

test('Checkpoint 3 room controls use human-only routes with exact versions and explicit gates', async () => {
  const app = await readFile(appUrl, 'utf8');
  assert.match(app, /\/room-archetypes/);
  assert.match(app, /\/placements-add/);
  assert.match(app, /\/placements-move/);
  assert.match(app, /\/placements-remove/);
  assert.match(app, /expectedRoomVariantVersion: variant\.version/);
  assert.match(app, /assetVersion: asset\.assetVersion, metadataVersion: asset\.metadataVersion/);
  assert.match(app, /Resize requires explicit removal/);
  assert.match(app, /Validate this DRAFT as a new immutable version/);
  assert.match(app, /Finalize this VALIDATED room/);
  assert.match(app, /Fork this FINAL room into a new editable DRAFT version/);
  assert.match(app, /Record a complete \$\{decisions\.length\}-item owner decision/);
  assert.match(app, /Atomically apply exactly \$\{accepted\} accepted placement change/);
  assert.match(app, /function roomProposalDiffSummary/);
  assert.match(app, /Complete proposed-state findings/);
  assert.match(app, /proposal\.findings\.filter/);
  assert.match(app, /confirm: true/);
  assert.match(app, /roomOperationKey\(operation, target, projectId\)/);
});

test('Checkpoint 3 retains room selection, zoom, layers, dirty decisions, focus, and scroll across refresh', async () => {
  const app = await readFile(appUrl, 'utf8');
  const capture = app.slice(app.indexOf('function captureRoomDomState'), app.indexOf('function restoreRoomDomState'));
  const restore = app.slice(app.indexOf('function restoreRoomDomState'), app.indexOf('function sourcePreview'));
  assert.match(capture, /selectedRoomVariantId/);
  assert.match(capture, /selectedProposalId/);
  assert.match(capture, /scrollLeft/);
  assert.match(capture, /scrollTop/);
  assert.match(capture, /window\.scrollX/);
  assert.match(restore, /focus\(\{ preventScroll: true \}\)/);
  assert.match(restore, /setSelectionRange/);
  assert.match(restore, /window\.scrollTo/);
  assert.match(app, /selectedPaletteAssetId/);
  assert.match(app, /zoom: 'fit'/);
  assert.match(app, /layers: \{ STRUCTURAL_SURFACE: true, SET_DRESSING: true, CONNECTORS: true \}/);
  assert.match(app, /state\.roomUi\.dirty/);
  assert.match(app, /Your local draft was retained/);
});

test('Checkpoint 3 canvas and review surfaces remain bounded at 1440 and protected 1060 widths', async () => {
  const styles = await readFile(stylesUrl, 'utf8');
  assert.match(styles, /\.room-editor-shell \{[^}]*grid-template-columns: 92px minmax\(360px, 1fr\) minmax\(255px, \.72fr\)/);
  assert.match(styles, /\.room-canvas-scroll \{[^}]*overflow: auto/);
  assert.match(styles, /\.room-palette-list \{[^}]*overflow: auto/);
  assert.match(styles, /\.room-placement-list \{[^}]*overflow: auto/);
  assert.match(styles, /@media \(max-width: 1200px\)[\s\S]*\.room-editor-shell \{ grid-template-columns: 82px minmax\(300px, 1fr\)/);
  assert.match(styles, /@media \(max-width: 820px\)[\s\S]*\.room-editor-shell \{ grid-template-columns: 1fr/);
});

test('CP4.5 presents one persistent canvas, editor tools, truthful cell kinds, and complete shape saves', async () => {
  const app = await readFile(appUrl, 'utf8');
  const styles = await readFile(stylesUrl, 'utf8');
  assert.match(app, /const ROOM_EDITOR_TOOLS/);
  assert.match(app, /PAINT_ROOM.*PAINT_VOID.*PAINT_BLOCKED.*ENTRANCE.*SURFACE.*PROP/s);
  assert.match(app, /function renderRoomEditorDock/);
  assert.match(app, /shell\.append\(renderRoomToolbox\(variant\), renderRoomCanvas\(variant, snapshot\), renderRoomEditorDock/);
  assert.doesNotMatch(app, /ROOM_WORKFLOW_STEPS|renderRoomWorkflow|workflow-step/);
  assert.match(app, /cell\.dataset\.cellKind = kind/);
  assert.match(app, /kind === 'VOID' \? 'OUTSIDE' : kind === 'BLOCKED' \? 'BLOCKED' : 'FLOOR'/);
  assert.match(app, /Every cell has exactly one visible class/);
  assert.match(app, /total - draft\.voidCells\.length - draft\.blockedCells\.length/);
  assert.match(app, /cannot be both outside and blocked/);
  assert.match(app, /expectedRoomVariantVersion: variant\.version, voidCells: draft\.voidCells, blockedCells: draft\.blockedCells/);
  assert.match(app, /\/shape/);
  assert.match(app, /Save shape/);
  assert.match(app, /Save or discard shape changes before changing other room data/);
  assert.match(styles, /\.room-cell\[data-cell-kind="VOID"\][^{]*\{[^}]*repeating-linear-gradient/);
  assert.match(styles, /\.room-cell\[data-cell-kind="BLOCKED"\][^{]*\{[^}]*linear-gradient/);
  assert.match(styles, /\.room-board\[data-shape-editing="true"\] \.room-placement,[\s\S]*pointer-events: none/);
  assert.match(app, /selectedPaletteAssetId\) board\.dataset\.assetPlacementEditing = 'true'/);
  assert.match(styles, /\.room-board\[data-asset-placement-editing="true"\] \.room-placement,[\s\S]*pointer-events: none/);
  assert.match(styles, /\.asset-conflict\[hidden\] \{ display: none; \}/);
});

test('CP4.5 useful prop preview exposes footprint, anchor, rotation, collision, and readiness before placement', async () => {
  const app = await readFile(appUrl, 'utf8');
  const styles = await readFile(stylesUrl, 'utf8');
  const preview = app.slice(app.indexOf('function usefulAssetPreview'), app.indexOf('function renderAssetLibrary'));
  assert.match(preview, /spanTiles/);
  assert.match(preview, /anchor/);
  assert.match(preview, /metadata\.collision/);
  assert.match(preview, /metadata\.navigation/);
  assert.match(preview, /assetPreviewRotation/);
  assert.match(preview, /preview is unavailable/);
  assert.match(app, /use\.disabled = variant\.lifecycle !== 'DRAFT' \|\| preview\.dataset\.previewReady !== 'true'/);
  assert.match(app, /draft\.disposition === 'ACCEPTED'\) draft\.disposition = 'REJECTED'/);
  assert.match(app, /previewQuarterTurn/);
  assert.match(styles, /container-type: size/);
  assert.match(styles, /data-preview-quarter-turn="true"\] img \{ width: 100cqh; height: 100cqw/);
  assert.doesNotMatch(styles, /preview-rotation-scale/);
  assert.match(styles, /\.room-form\.intent \{[^}]*minmax\(0, 1fr\)[^}]*min-width: 0/);
});
