import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const appUrl = new URL('../apps/studio-server/public/app.js', import.meta.url);
const stylesUrl = new URL('../apps/studio-server/public/styles.css', import.meta.url);

test('Checkpoint 3 exposes a coordinate-visible layered room and hallway designer', async () => {
  const app = await readFile(appUrl, 'utf8');
  const renderer = app.slice(app.indexOf('function currentRoomLibrary'), app.indexOf('function renderCollection'));
  assert.match(renderer, /New room template/);
  assert.match(renderer, /New room \/ hallway/);
  assert.match(renderer, /Origin 0,0/);
  assert.match(renderer, /slider\.min = '100'; slider\.max = '1000'; slider\.step = '25'/);
  assert.match(renderer, /roomControl\('Fit', 'zoom'/);
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
  assert.match(app, /assetVersion: intent\.assetVersion, metadataVersion: intent\.metadataVersion/);
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
  assert.match(app, /zoomPercent: 100/);
  assert.match(app, /layers: \{ STRUCTURAL_SURFACE: true, SET_DRESSING: true, CONNECTORS: true \}/);
  assert.match(app, /state\.roomUi\.dirty/);
  assert.match(app, /Your local draft was retained/);
});

test('Saved room errors are visible before deep detail and finding navigation keeps exact identity', async () => {
  const app = await readFile(appUrl, 'utf8');
  const styles = await readFile(stylesUrl, 'utf8');
  const evidence = await readFile(new URL('../scripts/capture-studio-browser-evidence.js', import.meta.url), 'utf8');
  assert.match(app, /function exactRoomHead/);
  assert.match(app, /versions\?\.find\(\(\{ version \}\) => version === entry\.headVersion\)/);
  assert.match(app, /function roomHeadFindingProjection/);
  assert.match(app, /head\.findings\.filter\(\(\{ severity \}\) => severity === 'ERROR'\)/);
  assert.match(app, /Saved room errors/);
  assert.match(app, /saved error\$\{projection\.errors\.length === 1/);
  assert.match(app, /validation remains blocked until a new saved version resolves them/);
  assert.match(app, /Saved room status unavailable — needs attention/);
  assert.match(app, /Studio will not present this room as clear/);
  const rooms = app.slice(app.indexOf('function renderRooms'), app.indexOf('const TASK_STATE_LABELS'));
  assert.match(rooms, /const variant = exactRoomHead\(selectedEntry\)/);
  assert.match(rooms, /No fallback version is opened as current/);
  assert.match(rooms, /Studio will not open a fallback room version as current/);
  assert.doesNotMatch(rooms, /const \{ entry: selectedEntry, variant \} = currentRoomVariant/);
  assert.match(app, /function roomFindingFocusKey/);
  assert.match(app, /room-finding:\$\{roomVariantId\}:\$\{roomVersion\}:\$\{findingId\}/);
  assert.match(app, /focus\.dataset\.findingId = finding\.findingId/);
  assert.match(app, /dock\.dataset\.roomScroll = 'dock'/);
  assert.match(app, /guidance\.textContent = `These findings belong to exact saved room v\$\{variant\.version\}/);
  assert.match(app, /remediation\.textContent = `Next: \$\{finding\.remediation\}`/);
  assert.match(app, /finding\.targetKind === 'roomVariant' \? 'Room-wide issue'/);
  assert.match(app, /ROOM_FINDING_STALE/);
  assert.match(app, /state\.roomUi\.selectedConnectorId = null; state\.roomUi\.selectedFinding = null; clearRoomPaletteAsset\(\)/);
  assert.match(app, /\.room-findings \[data-selected="true"\]/);
  assert.match(styles, /\.room-findings \.asset-findings li \{[^}]*font-size: 11px;[^}]*line-height: 1\.45/);
  assert.match(styles, /\.room-error-attention \{[^}]*border-left: 5px solid/);
  assert.match(evidence, /open\.focus\(\); open\.click\(\)/);
  assert.match(evidence, /overviewOpenEvidence\.panel === 'check'/);
  assert.match(evidence, /setup\.before\.findings > 0/);
  assert.match(evidence, /setup\.dockScrollable === true/);
  assert.match(evidence, /pointerSelection\.during\.selectedFindingCount === 0/);
  assert.match(evidence, /Input\.dispatchKeyEvent'[\s\S]*key: 'Escape'/);
  assert.match(evidence, /roomDirectManipulationState\(\)\?\.gestureActive/);
  assert.doesNotMatch(evidence, /roomPlacementInteractionState/);
  const findingNavigation = evidence.slice(evidence.indexOf('const findingsSetup'), evidence.indexOf('const directSetup'));
  assert.equal(findingNavigation.match(/type: 'keyDown', key: 'Enter'/g)?.length, 2);
  assert.equal(findingNavigation.match(/type: 'keyUp', key: 'Enter'/g)?.length, 2);
  assert.equal(findingNavigation.match(/text: '\\r', unmodifiedText: '\\r'/g)?.length, 2);
  assert.doesNotMatch(findingNavigation, /type: 'rawKeyDown', key: 'Enter'/);
  assert.match(findingNavigation, /isTrusted === true && detail === 0/);
  assert.doesNotMatch(findingNavigation, /(?:targetButtons\[[^\]]+\]|first|secondButton)\??\.click\(\)/);
});

test('Checkpoint 3 canvas and review surfaces remain bounded at 1440 and protected 1060 widths', async () => {
  const styles = await readFile(stylesUrl, 'utf8');
  assert.match(styles, /\.room-editor-shell \{[^}]*grid-template-columns: 92px minmax\(360px, 1fr\) minmax\(255px, \.72fr\)/);
  assert.match(styles, /\.room-canvas-scroll \{[^}]*overflow: auto/);
  assert.match(styles, /\.room-canvas-scroll\[data-panning="true"\]/);
  assert.match(styles, /calc\(var\(--room-cell\) \* \.16\)/);
  assert.match(styles, /\.room-palette-list \{[^}]*overflow: auto/);
  assert.match(styles, /\.room-placement-list \{[^}]*overflow: auto/);
  assert.match(styles, /@media \(max-width: 1200px\)[\s\S]*\.room-editor-shell \{ grid-template-columns: 82px minmax\(300px, 1fr\)/);
  assert.match(styles, /@media \(max-width: 820px\)[\s\S]*\.room-editor-shell \{ grid-template-columns: 1fr/);
});

test('Checkpoint 3 canvas supports bounded manual zoom and non-mutating middle-button panning', async () => {
  const app = await readFile(appUrl, 'utf8');
  assert.match(app, /event\.button !== 1/);
  assert.match(app, /setPointerCapture/);
  assert.match(app, /scrollLeft = pan\.startLeft/);
  assert.match(app, /scrollTop = pan\.startTop/);
  assert.match(app, /pointerup', finishRoomCanvasPan/);
  assert.match(app, /pointercancel', finishRoomCanvasPan/);
  assert.match(app, /lostpointercapture', finishRoomCanvasPan/);
  assert.match(app, /Math\.round\(38 \* state\.roomUi\.zoomPercent \/ 100\)/);
  assert.match(app, /availableWidth \/ width, availableHeight \/ height/);
  assert.match(app, /const declaredMaxHeight = parseFloat\(computed\.maxHeight\)/);
  assert.match(app, /computed\.boxSizing === 'border-box' \? verticalBorder \+ verticalPadding : 0/);
  assert.match(app, /Math\.min\(380, Math\.floor/);
  assert.doesNotMatch(app, /Math\.min\(scroll\.clientHeight, window\.innerHeight \* \.68\)/);
  assert.match(app, /requestAnimationFrame\(applyRoomCanvasFit\)/);
});

test('Room direct manipulation remains transient, revision-pinned, cancellable, and accessible', async () => {
  const app = await readFile(appUrl, 'utf8');
  const styles = await readFile(stylesUrl, 'utf8');
  const gestureStart = app.indexOf('function roomCellFromPointer');
  const gestureEnd = app.indexOf("elements['workspace-content'].addEventListener('click', async (event) =>", gestureStart);
  assert.ok(gestureStart >= 0 && gestureEnd > gestureStart, 'The Room gesture source block must be present.');
  const gesture = app.slice(gestureStart, gestureEnd);
  assert.match(app, /function roomPlacementGhostModel/);
  assert.match(app, /The exact version-pinned asset is unavailable/);
  assert.match(app, /rotated logical footprint exceeds the room bounds/);
  assert.match(app, /crosses an outside-room cell/);
  assert.match(app, /cannot occupy a blocked room cell/);
  assert.match(app, /logical footprint overlaps placement/);
  assert.match(app, /Authored collision geometry overlaps placement/);
  assert.match(app, /Server validation remains authoritative/);
  assert.match(app, /\u2713 placement ghost|✓ placement ghost/);
  assert.match(app, /blocked placement ghost/);
  assert.match(gesture, /roomManipulationContext\(variant, placement\)/);
  assert.match(gesture, /roomManipulationContextMatches\(gesture, variant, placement\)/);
  assert.match(gesture, /setPointerCapture/);
  assert.match(gesture, /pointercancel/);
  assert.match(gesture, /lostpointercapture/);
  assert.match(gesture, /Direct manipulation cancelled\. No room command was sent/);
  assert.match(gesture, /suppressCanvasClick = true/);
  assert.match(gesture, /await moveRoomPlacement\(placement, gesture\.anchor, gesture\.rotation, gesture\)/);
  assert.match(gesture, /event\.button !== 0/);
  assert.match(app, /event\.key === 'Delete' \|\| event\.key === 'Backspace'/);
  assert.match(app, /ArrowLeft: \[-1, 0\].*ArrowRight: \[1, 0\]/s);
  assert.match(app, /event\.key === 'r' \|\| event\.key === 'R'/);
  assert.match(app, /const activeGesture = state\.roomUi\.placementGesture/);
  assert.match(app, /activeGesture\.rotation =/);
  assert.match(app, /placementShortcutSurface/);
  assert.match(app, /event\.preventDefault\(\); await moveRoomPlacement/);
  assert.match(app, /function clearPendingRoomPlacementAdd/);
  assert.match(app, /samePendingIntent/);
  assert.match(app, /advancedAuthorityContext/);
  assert.match(app, /project\.revision > pendingAdd\.projectRevision/);
  assert.match(app, /variant\.version > pendingAdd\.roomVersion/);
  assert.match(app, /authoritative reload confirmed the original placement/);
  assert.match(app, /not yet confirmed/);
  assert.match(app, /gesture\.outsideBoard/);
  assert.match(app, /x: geometry\.left, y: geometry\.top/);
  assert.match(styles, /\.room-placement-ghost\[data-allowed="false"\]/);
  assert.match(styles, /repeating-linear-gradient/);
  assert.match(styles, /\.room-placement \{[^}]*cursor: grab;[^}]*touch-action: none/);
});

test('CP4.5 presents one persistent canvas, editor tools, truthful cell kinds, and complete shape saves', async () => {
  const app = await readFile(appUrl, 'utf8');
  const styles = await readFile(stylesUrl, 'utf8');
  assert.match(app, /const ROOM_EDITOR_TOOLS/);
  assert.match(app, /PAINT_ROOM.*PAINT_VOID.*PAINT_BLOCKED.*ENTRANCE.*SURFACE.*PROP.*CLEAR/s);
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
  assert.match(app, /const previewReady = control\.querySelector\('\.asset-preview\.ready'\)\?\.dataset\.previewState === 'READY'/);
  assert.match(app, /armRoomPaletteAsset\(asset\)/);
  assert.match(app, /Ready to place · choose one or more free room cells/);
  assert.doesNotMatch(app, /Use in room|use-preview-asset/);
  assert.match(app, /draft\.disposition === 'ACCEPTED'\) draft\.disposition = 'REJECTED'/);
  assert.match(app, /--preview-unrotated-width/);
  assert.match(app, /--preview-unrotated-height/);
  assert.match(styles, /position: absolute; top: 50%; left: 50%/);
  assert.match(styles, /translate\(-50%, -50%\) rotate/);
  assert.doesNotMatch(styles, /preview-rotation-scale/);
  assert.match(styles, /\.room-form\.intent \{[^}]*minmax\(0, 1fr\)[^}]*min-width: 0/);
});

test('Room repair keeps an exact persistent brush, clear tool, resize guidance, and visible rotation', async () => {
  const app = await readFile(appUrl, 'utf8');
  const styles = await readFile(stylesUrl, 'utf8');
  const evidence = await readFile(new URL('../scripts/capture-studio-browser-evidence.js', import.meta.url), 'utf8');
  const addStart = app.indexOf('async function addRoomPlacement');
  const add = app.slice(addStart, app.indexOf("elements['workspace-content'].addEventListener('input'", addStart));
  assert.ok(add.indexOf('state.roomUi.shapeDraft?.dirty') < add.indexOf('state.roomUi.pendingPlacementAdd = intent'));
  assert.match(add, /state\.roomUi\.selectedPlacementId = null/);
  assert.doesNotMatch(add, /clearRoomPaletteAsset\(\)|placementRotation = 0/);
  assert.match(app, /selectedPaletteAssetPin/);
  assert.match(app, /asset\.assetVersion === pin\.assetVersion && asset\.metadataVersion === pin\.metadataVersion/);
  assert.match(app, /state\.roomUi\.activeTool === 'SELECT' && state\.roomUi\.selectedPlacementId/);
  assert.match(app, /activeTool === 'CLEAR'.*await removeRoomPlacement\(placement\)/s);
  assert.match(app, /addEventListener\('pointerout'.*selectedPaletteAssetId.*placementGesture.*pendingPlacementAdd.*relatedTarget instanceof Node.*board\.contains\(event\.relatedTarget\).*placementHover = null.*updateRoomPlacementGhostDom\(\)/s);
  assert.match(app, /Room size and intent/);
  assert.match(app, /Save or discard the room-shape changes before resizing/);
  assert.match(app, /function roomPlacementVisual/);
  assert.match(app, /--room-placement-visual-rotation/);
  assert.match(styles, /\.room-placement > \.room-placement-visual \{[^}]*rotate\(var\(--room-placement-visual-rotation\)\)/);
  assert.match(styles, /\.prop-preview-stage \{[^}]*min-height: 0/);
  assert.match(styles, /\.room-canvas-scroll \{[^}]*overflow: auto;[^}]*scrollbar-gutter: stable/);
  assert.match(evidence, /persistentBrush/);
  assert.match(evidence, /surfaceResize/);
  assert.match(evidence, /layer === 'STRUCTURAL_SURFACE'/);
  assert.match(evidence, /attempted\?\.join\(','\) === 'placement-select,connector-select'/);
  assert.match(evidence, /previewFailure\.placementRotation === 0/);
  assert.match(evidence, /dirtyGuard\.state\?\.pendingPlacementAdd === null/);
  assert.match(evidence, /placementVisualRotations\.every/);
  assert.match(evidence, /new Set\(checkpoint45DirectManipulation\.placementVisualRotations/);
  assert.match(evidence, /clearTool\?\.activeTool === 'CLEAR'/);
  assert.match(evidence, /pan\.fit\?\.cell === checkpoint45DirectManipulation\.pan\.fit\?\.expected/);
  assert.match(evidence, /pan\.fit\.boardContained === true/);
  assert.match(evidence, /scrollbarStability\.after\.overflowY === true/);
  assert.match(evidence, /afterDrag\.scrollRange\.x > 0/);
  assert.match(evidence, /placementPreview\.stageAspect - 1\.5/);
});


function roomTestElement(tag = 'div') {
  return { tag, dataset: {}, children: [], append(...children) { this.children.push(...children); } };
}
const roomTestNodes = (node) => [node, ...(node.children ?? []).filter((child) => typeof child === 'object').flatMap(roomTestNodes)];

async function roomCreationHarness({ failure = false, omitCreatedHead = false, roomUi = {} } = {}) {
  const app = await readFile(appUrl, 'utf8');
  const fragment = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));
  const head = { roomVariantId: 'room.first', roomArchetypeId: 'template.one', archetypeVersion: 1,
    displayName: 'First room', width: 8, height: 6, version: 1, lifecycle: 'DRAFT', placements: [], connectors: [], findings: [] };
  const library = { archetypes: [{ roomArchetypeId: 'template.one', version: 1, kind: 'room', displayName: 'Template' }],
    variants: [{ roomVariantId: 'room.first', headVersion: 1, versions: [head] }], proposals: [] };
  const state = { project: { projectId: 'project.test', revision: 3, snapshot: { roomLibrary: library } }, agentAccessCsrf: 'csrf',
    roomMutationPending: false, roomUi: { view: 'editor', selectedRoomVariantId: 'room.first', selectedPlacementId: 'placement.old',
      selectedConnectorId: 'connector.old', activeTool: 'PROP', zoom: '200', layers: { SET_DRESSING: false }, ...roomUi } };
  const observations = []; const requests = []; const messages = [];
  const createStart = app.indexOf("  const form = event.target.closest('[data-room-form]');");
  const createBody = app.slice(createStart, app.indexOf('  if (!variant) return;', createStart));
  const resizeStart = app.indexOf("  if (form.dataset.roomForm === 'resize') {");
  const resizeBody = app.slice(resizeStart, app.indexOf("  if (form.dataset.roomForm === 'connector')", resizeStart));
  const sandbox = { state, elements: { 'workspace-content': { querySelector: () => null } }, document: { createElement: roomTestElement, createDocumentFragment: roomTestElement },
    currentRoomLibrary: () => library, roomHead: (entry) => entry?.versions.find(({ version }) => version === entry.headVersion),
    exactRoomHead: (entry) => entry?.versions.find(({ version }) => version === entry.headVersion) ?? null,
    roomHeadFindingProjection: () => ({ errors: [] }), findingSummary: () => 'No findings',
    roomStatusPill: roomTestElement, renderRoomErrorAttention: () => null, renderRoomViewSwitch: roomTestElement,
    renderRoomToolOptions: roomTestElement, renderRoomToolbox: roomTestElement, renderRoomEditorDock: roomTestElement,
    renderRoomCanvas: (variant) => ({ tag: 'canvas', dataset: { roomId: variant.roomVariantId }, width: variant.width, height: variant.height }),
    applyRoomShapeDraftLock() {}, cancelRoomPreviewLoad() {}, clearRoomPaletteAsset() { state.roomUi.selectedPaletteAssetId = null; },
    clearPendingRoomPlacementAdd() { state.roomUi.pendingPlacementAdd = null; },
    stableUiId: (prefix, name) => `${prefix}.${name.toLowerCase()}`, roomOperationKey: () => 'request.test', clearRoomOperationKey() {},
    setRoomMutationPending(value) { state.roomMutationPending = value; }, showToast(value) { messages.push(value); },
    FormData: class { constructor(form) { this.values = form.values; } get(name) { return this.values[name]; } },
    window: { confirm: () => true },
    async api(path, { body }) {
      requests.push({ path, body: JSON.parse(body) }); if (failure) throw new Error('Creation failed');
      const request = JSON.parse(body);
      if (path.endsWith('/resize')) {
        const id = path.split('/').at(-2); const entry = library.variants.find((candidate) => candidate.roomVariantId === id);
        const next = { ...entry.versions.at(-1), version: entry.headVersion + 1, width: request.width, height: request.height };
        entry.versions.push(next); entry.headVersion = next.version;
      } else if (!omitCreatedHead) library.variants.push({ roomVariantId: request.roomVariantId, headVersion: 1,
        versions: [{ ...head, roomVariantId: request.roomVariantId, displayName: request.displayName, width: request.width, height: request.height }] });
      state.project.revision += 1; return { projectId: state.project.projectId, revision: state.project.revision };
    },
    async loadProject() { sandbox.renderWorkspace(); return true; },
  };
  const setup = [fragment('function currentRoomVariant(', 'const ROOM_EDITOR_TOOLS'),
    fragment('function roomCreationBlockedReason(', 'function renderRoomCreation'),
    fragment('function resetRoomUiProjectContext(', 'function reconcileRoomUi'),
    fragment('async function executeRoomMutation(', 'function roomManipulationContext'),
    fragment('function renderRooms(', 'const TASK_STATE_LABELS')].join('\n');
  const api = runInNewContext(`${setup}
({ create: async function(event) { ${createBody} },
    resize: async function(width, height) { const form = { dataset: { roomForm: 'resize' } }; const data = { get: (key) => ({ width, height })[key] };
      const { variant } = currentRoomVariant(); const basePath = '/api/projects/project.test/rooms/' + variant.roomVariantId; ${resizeBody} },
    render: () => renderRooms(state.project.snapshot), selected: () => currentRoomVariant().variant });`, sandbox);
  sandbox.renderWorkspace = () => {
    const nodes = roomTestNodes(api.render());
    observations.push({ header: nodes.find(({ tag }) => tag === 'h2')?.textContent,
      selector: nodes.find(({ dataset }) => dataset.roomVariantSelect)?.value,
      canvas: nodes.find(({ tag }) => tag === 'canvas') });
  };
  const create = (kind = 'variant') => api.create({ preventDefault() {}, target: { closest: () => ({ dataset: { roomForm: kind },
    values: { roomArchetypeId: 'template.one', displayName: 'Second', width: '11', height: '7', kind: 'room' } }) } });
  return { state, library, observations, requests, messages, create, resize: api.resize, selected: api.selected };
}

test('second Room creation synchronizes visible header/canvas and immediate edit without changing Room one', async () => {
  const fixture = await roomCreationHarness(); const first = JSON.stringify(fixture.library.variants[0]);
  await fixture.create();
  const rendered = fixture.observations.at(-1);
  assert.equal(rendered.header, 'Second'); assert.equal(rendered.selector, 'room.second');
  assert.equal(rendered.canvas.dataset.roomId, 'room.second'); assert.deepEqual([rendered.canvas.width, rendered.canvas.height], [11, 7]);
  assert.equal(fixture.selected().roomVariantId, 'room.second');
  assert.equal(fixture.state.roomUi.selectedPlacementId, null); assert.equal(fixture.state.roomUi.selectedConnectorId, null);
  assert.equal(fixture.state.roomUi.activeTool, 'SELECT'); assert.equal(fixture.state.roomUi.zoom, 'fit');
  assert.equal(fixture.state.roomUi.domState, null);
  await fixture.resize(12, 7);
  assert(fixture.requests.at(-1).path.endsWith('/rooms/room.second/resize'));
  assert.deepEqual([fixture.selected().width, fixture.selected().height], [12, 7]);
  assert.equal(JSON.stringify(fixture.library.variants[0]), first);
});

test('failed or unavailable created Room head preserves previous selection and interaction context', async () => {
  for (const options of [{ failure: true }, { omitCreatedHead: true }]) {
    const fixture = await roomCreationHarness(options); const before = JSON.stringify(fixture.state.roomUi);
    await fixture.create(); assert.equal(JSON.stringify(fixture.state.roomUi), before);
    assert.equal(fixture.observations.at(-1).selector, 'room.first'); assert.equal(fixture.selected().roomVariantId, 'room.first');
  }
});

test('Room and template creation preserve unsaved and unresolved prior work without sending a command', async () => {
  for (const roomUi of [{ shapeDraft: { dirty: true } }, { dirty: true }, { pendingPlacementAdd: { placementId: 'pending' } },
    { placementGesture: { captured: true } }, { canvasPan: { pointerId: 1 } }]) {
    for (const kind of ['variant', 'archetype']) {
      const fixture = await roomCreationHarness({ roomUi }); const before = JSON.stringify(fixture.state.roomUi);
      await fixture.create(kind); assert.equal(fixture.requests.length, 0); assert.equal(JSON.stringify(fixture.state.roomUi), before);
      assert.equal(fixture.messages.length, 1);
    }
  }
});

test('empty Rooms open the next creation form while existing Room controls remain compact', async () => {
  const app = await readFile(appUrl, 'utf8');
  const source = app.slice(app.indexOf('function roomField('), app.indexOf('function renderRoomPalette('));
  const render = runInNewContext(`${source}; renderRoomCreation;`, { state: { roomUi: {} }, document: { createElement: roomTestElement } });
  const template = { roomArchetypeId: 'template.one', version: 1, displayName: 'Template', kind: 'room', dimensionPolicy: { width: { preferred: 8 }, height: { preferred: 6 } } };
  for (const [archetypes, variants, expected] of [[[], [], [true, false]], [[template], [], [false, true]], [[template], [{}], [false, false]]]) {
    const nodes = roomTestNodes(render({ archetypes, variants }));
    assert.deepEqual(nodes.filter(({ tag }) => tag === 'details').map(({ open }) => open), expected);
    assert(nodes.some(({ textContent }) => textContent === 'New room template'));
    assert(nodes.some(({ textContent }) => textContent === 'Create room'));
  }
});


test('successful creation lands focus on the exact new Room identity without moving focus on failure', async () => {
  const app = await readFile(appUrl, 'utf8');
  const source = app.slice(app.indexOf('function openCreatedRoom('), app.indexOf('function renderRoomCreation('));
  function scenario({ headAvailable = true, selectorMatches = true } = {}) {
    const calls = []; const state = { project: { projectId: 'project.one' }, roomUi: { selectedRoomVariantId: 'room.old' } };
    const selector = { value: selectorMatches ? 'room.new' : 'room.old',
      focus(options) { calls.push(['focus', options.preventScroll]); },
      closest(name) { assert.equal(name, '.room-header'); return { scrollIntoView(options) { calls.push(['land', options.block, options.inline]); } }; } };
    const open = runInNewContext(`${source}; openCreatedRoom;`, { state,
      currentRoomLibrary: () => ({ variants: [{ roomVariantId: 'room.new' }] }), exactRoomHead: () => headAvailable ? {} : null,
      resetRoomUiProjectContext() { state.roomUi = {}; calls.push(['reset']); },
      renderWorkspace() { calls.push(['render', state.roomUi.selectedRoomVariantId]); }, showToast() {},
      elements: { 'workspace-content': { querySelector(query) { assert.equal(query, '[data-room-variant-select]'); return selector; } } },
    });
    return { result: open('project.one', 'room.new'), calls, state };
  }
  const success = scenario(); assert.equal(success.result, true);
  assert.deepEqual(success.calls, [['reset'], ['render', 'room.new'], ['focus', true], ['land', 'center', 'nearest']]);
  const failed = scenario({ headAvailable: false }); assert.equal(failed.result, false); assert.deepEqual(failed.calls, []);
  assert.equal(failed.state.roomUi.selectedRoomVariantId, 'room.old');
  const mismatch = scenario({ selectorMatches: false }); assert(!mismatch.calls.some(([action]) => ['focus', 'land'].includes(action)));
});
