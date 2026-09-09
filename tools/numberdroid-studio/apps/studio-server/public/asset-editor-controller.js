import { isEmbeddedGeometry, embeddedGeometryResult } from './asset-embedded-geometry.js';
import { inverseAssemblyPoint } from '../../../packages/domain/src/assembly-geometry.js';
import { updateAssemblyArtwork } from './assembly-artwork-view.js';
import { createAssetEditorState, assetEditorSnapshot, assetEditorRemember, assetEditorRestore, assetEditorUndo, assetEditorDirty, assetEditorIssues, assetEditorInvalidNumericField,
  selectedAssetRegion, buildAssetEditorSave, assetEditorContextConflict, assetEditorResizeBox, assetEditorDrawBox, assetEditorNearestEdge, assetEditorSnap } from './asset-editor-state.js';
import { createAssetEditorView, updateAssetEditorView, syncAssetEditorCanvas, assetEditorFrame } from './asset-editor-view.js';

const clone = value => structuredClone(value);
export function createAssetEditorController({ initial, host, resumeState = null }) {
  const state = createAssetEditorState(initial);
  if (resumeState && isEmbeddedGeometry(state)) {
    if (resumeState.context?.projectId !== initial.projectId || resumeState.context?.assetId !== initial.assetId) throw new Error('The retained geometry belongs to another Assembly.');
    Object.assign(state, clone(resumeState), { initial: { ...clone(initial), pixelSize: clone(initial.planeSize) }, gesture: null });
    state.model.name = initial.title;
  }
  const regionLimit = isEmbeddedGeometry(state) ? 512 : 16;
  const element = createAssetEditorView(state); const listeners = new AbortController();
  let rendering = false;
  let disposed = false, requestController = null, pendingGeneration = 0, fieldBefore = null, deferred = false;
  const currentContext = () => host.getContext(state.context);
  const locked = () => disposed || ['saving', 'uncertain', 'checking'].includes(state.save.status);
  const focusKey = () => document.activeElement?.closest?.('[data-asset-editor-focus-key]')?.dataset.assetEditorFocusKey ?? null;
  const captureView = () => ({ focus: focusKey(), page: { x: window.scrollX, y: window.scrollY }, scroll: Object.fromEntries([...element.querySelectorAll('[data-asset-editor-scroll]')].map(n => [n.dataset.assetEditorScroll, { x: n.scrollLeft, y: n.scrollTop }])) });
  const restoreView = saved => { if (!saved) return; const view = state.view, generation = state.viewGeneration; requestAnimationFrame(() => {
    if (disposed || !element.isConnected || state.view !== view || state.viewGeneration !== generation || currentContext()?.projectId !== state.context.projectId) return;
    for (const n of element.querySelectorAll('[data-asset-editor-scroll]')) { const p = saved.scroll[n.dataset.assetEditorScroll]; if (p) { n.scrollLeft = p.x; n.scrollTop = p.y; } }
    [...element.querySelectorAll('[data-asset-editor-focus-key]')].find(n => n.dataset.assetEditorFocusKey === saved.focus)?.focus({ preventScroll: true }); window.scrollTo(saved.page.x, saved.page.y);
  }); };
  function render({ inspector = true, preserve = true } = {}) {
    if (disposed || rendering) return; const saved = preserve ? captureView() : null;
    rendering = true;
    try { updateAssetEditorView(element, state, { inspector }); }
    finally { rendering = false; }
    if (preserve && inspector) restoreView(saved);
  }
  function reconcileContext(context = currentContext()) {
    if (disposed) return; state.conflict = assetEditorContextConflict(state, context);
    if (state.gesture) { deferred = true; return; }
    render({ inspector: false });
  }
  const remember = before => { assetEditorRemember(state, before); state.error = null; };
  function setView(view) {
    if (locked() || state.gesture || state.view === view) return;
    if (view === 'preview' && (state.polygonDraft.length || assetEditorIssues(state).some(s => !s.startsWith('Give the Asset')))) { state.error = 'Correct the geometry and close its outline before Preview.'; render({ inspector: false }); return; }
    state.viewContexts[state.view] = captureView(); state.view = view; state.viewGeneration += 1; state.gridOpen = false;
    render({ preserve: false }); restoreView(state.viewContexts[view] ?? { focus: view === 'edit' ? 'canvas' : 'view:edit', page: { x: window.scrollX, y: window.scrollY }, scroll: {} });
  }
  function point(event, gesture = state.gesture) {
    const canvas = element.querySelector('[data-asset-editor-canvas]'); const matrix = gesture?.inverse ?? canvas.getScreenCTM()?.inverse();
    if (!matrix) return null; const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix); const snapped = assetEditorSnap(p, gesture?.grid ?? state.grid, event.altKey); return gesture?.regionTransform ? inverseAssemblyPoint(snapped, gesture.regionTransform) : snapped;
  }
  function cancelGesture() {
    const gesture = state.gesture; if (!gesture) return false;
    state.gesture = null; assetEditorRestore(state, gesture.before);
    if (gesture.canvas.hasPointerCapture?.(gesture.pointerId)) gesture.canvas.releasePointerCapture(gesture.pointerId);
    deferred = false; render(); host.onGestureSettled?.(); return true;
  }
  function finishPolygon() {
    if (locked() || !state.model.geometryEnabled) return;
    if (state.polygonDraft.length < 3) { state.error = 'A polygon needs at least three points. Add another point before closing.'; render({ inspector: false }); return; }
    if (state.model.spatial.blockingRegions.length >= regionLimit) { state.error = `Use at most ${regionLimit} blocking regions.`; render({ inspector: false }); return; }
    const before = assetEditorSnapshot(state); const region = { regionId: `region.${crypto.randomUUID()}`, name: `Region ${state.model.spatial.blockingRegions.length + 1}`, shape: { kind: 'polygon', points: clone(state.polygonDraft) } };
    state.model.spatial.blockingRegions.push(region); state.selectedRegionId = region.regionId; state.selectedPoint = 0; state.polygonDraft = []; state.cursor = null; state.tool = 'select'; remember(before); render();
  }
  function requireCompleteNumericDraft() {
    const path = assetEditorInvalidNumericField(state); if (!path) return true;
    state.error = 'Complete this numeric value before changing the selected shape, point, panel or tool. Your entered value is retained.';
    render({ inspector: false });
    [...element.querySelectorAll('[data-asset-editor-field]')].find(field => field.dataset.assetEditorField === path)?.focus({ preventScroll: true });
    return false;
  }
  function remove(whole = false) {
    if (locked() || !state.model.geometryEnabled) return; const r = selectedAssetRegion(state); if (!r) return; const before = assetEditorSnapshot(state);
    if (!whole && r.shape.kind === 'polygon' && state.selectedPoint === null) { state.error = 'Select a polygon point to remove it. Use Remove whole region to delete the polygon.'; render({ inspector: false }); return; }
    if (!whole && r.shape.kind === 'polygon' && state.selectedPoint !== null) {
      if (r.shape.points.length <= 3) { state.error = 'A polygon needs three points. Use Remove whole region to delete it.'; render({ inspector: false }); return; }
      r.shape.points.splice(state.selectedPoint, 1); state.selectedPoint = Math.min(state.selectedPoint, r.shape.points.length - 1);
    } else { state.model.spatial.blockingRegions = state.model.spatial.blockingRegions.filter(q => q.regionId !== r.regionId); state.selectedRegionId = state.model.spatial.blockingRegions[0]?.regionId ?? null; state.selectedPoint = null; }
    remember(before); render();
  }
  function pointerDown(event) {
    const canvas = event.target.closest('[data-asset-editor-canvas]'); if (!canvas || event.button !== 0 || locked() || state.view !== 'edit' || state.gesture) return;
    if (!requireCompleteNumericDraft()) { event.preventDefault(); return; }
    const p = point(event); if (!p) return; event.preventDefault(); canvas.focus({ preventScroll: true }); state.error = null;
    const before = assetEditorSnapshot(state);
    if (state.tool === 'polygon' && state.model.geometryEnabled) {
      if (state.polygonDraft.length >= 3 && Math.hypot(p.x - state.polygonDraft[0].x, p.y - state.polygonDraft[0].y) * state.scale < 12) { finishPolygon(); return; }
      if (state.polygonDraft.length >= 64) { state.error = 'Use at most 64 points per polygon.'; render({ inspector: false }); return; }
      if (!state.polygonDraft.length || p.x !== state.polygonDraft.at(-1).x || p.y !== state.polygonDraft.at(-1).y) state.polygonDraft.push(p);
      state.cursor = p; remember(before); render({ inspector: false }); return;
    }
    if (state.tool === 'insert' && state.model.geometryEnabled) {
      const region = selectedAssetRegion(state); const matrix = state.model.regionTransforms?.[region?.regionId]; const editPoint = matrix ? inverseAssemblyPoint(p, matrix) : p; const edge = region?.shape.kind === 'polygon' ? assetEditorNearestEdge(region.shape.points, editPoint) : null;
      if (!edge || edge.distance * state.scale > 15 || edge.t <= .001 || edge.t >= .999) { state.error = 'Click along an edge of the selected polygon, away from its endpoints.'; render({ inspector: false }); return; }
      if (region.shape.points.length >= 64) { state.error = 'Use at most 64 points per polygon.'; render({ inspector: false }); return; }
      region.shape.points.splice(edge.index + 1, 0, edge.point); state.selectedPoint = edge.index + 1; state.tool = 'select'; remember(before); render(); return;
    }
    let mode = 'move', original;
    if (['rectangle', 'oval'].includes(state.tool) && state.model.geometryEnabled) {
      if (state.model.spatial.blockingRegions.length >= regionLimit) { state.error = `Use at most ${regionLimit} blocking regions.`; render({ inspector: false }); return; }
      const region = { regionId: `region.${crypto.randomUUID()}`, name: `Region ${state.model.spatial.blockingRegions.length + 1}`, shape: { kind: state.tool, x: p.x, y: p.y, width: .1, height: .1 } };
      state.model.spatial.blockingRegions.push(region); state.selectedRegionId = region.regionId; state.selectedPoint = null; original = clone(region.shape); mode = 'draw';
    } else if ((state.tool === 'anchor' || event.target.closest('[data-asset-editor-anchor]')) && state.model.geometryEnabled) { original = clone(state.model.spatial.anchor); mode = 'anchor'; state.panel = 'placement'; }
    else {
      const node = event.target.closest('[data-asset-editor-region]'); if (!node) { state.selectedPoint = null; render(); return; }
      state.selectedRegionId = node.dataset.assetEditorRegion; state.selectedPoint = node.hasAttribute('data-asset-editor-point') ? Number(node.dataset.assetEditorPoint) : null; state.panel = 'blocking';
      if (!state.model.geometryEnabled) { render(); return; }
      original = clone(selectedAssetRegion(state).shape); mode = state.selectedPoint !== null ? 'point' : node.dataset.assetEditorHandle ?? 'move';
    }
    const regionTransform = !['draw', 'anchor'].includes(mode) ? state.model.regionTransforms?.[state.selectedRegionId] ?? null : null;
    state.gesture = { before, original, mode, pointIndex: state.selectedPoint, start: regionTransform ? inverseAssemblyPoint(p, regionTransform) : p, regionTransform, inverse: canvas.getScreenCTM().inverse(), scale: state.scale, grid: clone(state.grid), canvas, pointerId: event.pointerId, lastPointer: null };
    canvas.setPointerCapture(event.pointerId); render({ inspector: true });
  }
  function pointerMove(event) {
    const gesture = state.gesture;
    if (!gesture) { if (state.tool === 'polygon' && event.target.closest('[data-asset-editor-canvas]')) { state.cursor = point(event); syncAssetEditorCanvas(element, state); } return; }
    if (event.pointerId !== gesture.pointerId || locked()) return; event.preventDefault();
    gesture.lastPointer = { clientX: event.clientX, clientY: event.clientY, pointerId: event.pointerId, altKey: event.altKey, shiftKey: event.shiftKey };
    const p = point(event, gesture); if (!p) return; const dx = p.x - gesture.start.x, dy = p.y - gesture.start.y; const region = selectedAssetRegion(state); const original = gesture.original;
    if (gesture.mode === 'anchor') state.model.spatial.anchor = p;
    else if (!region) { cancelGesture(); return; }
    else if (gesture.mode === 'point') region.shape.points[gesture.pointIndex] = p;
    else if (gesture.mode === 'draw') Object.assign(region.shape, assetEditorDrawBox(gesture.start, p, event.shiftKey));
    else if (gesture.mode === 'move') {
      const origin = original.kind === 'polygon' ? original.points[0] : original;
      const moved = gesture.grid.snap && !event.altKey && !gesture.regionTransform ? assetEditorSnap({ x: origin.x + dx, y: origin.y + dy }, gesture.grid) : { x: origin.x + dx, y: origin.y + dy };
      if (original.kind === 'polygon') region.shape.points = original.points.map(q => ({ x: q.x + moved.x - origin.x, y: q.y + moved.y - origin.y })); else Object.assign(region.shape, moved);
    } else {
      let resizeX = dx, resizeY = dy;
      if (gesture.grid.snap && !event.altKey && !gesture.regionTransform) {
        const edgeX = gesture.mode.includes('w') ? original.x : original.x + original.width, edgeY = gesture.mode.includes('n') ? original.y : original.y + original.height;
        const snapped = assetEditorSnap({ x: edgeX + dx, y: edgeY + dy }, gesture.grid);
        if (gesture.mode.includes('w') || gesture.mode.includes('e')) resizeX = snapped.x - edgeX;
        if (gesture.mode.includes('n') || gesture.mode.includes('s')) resizeY = snapped.y - edgeY;
      }
      Object.assign(region.shape, assetEditorResizeBox(original, gesture.mode, resizeX, resizeY, event.shiftKey));
    }
    render({ inspector: false }); syncNumericFields();
  }
  function pointerEnd(event) {
    const gesture = state.gesture; if (!gesture || event.pointerId !== gesture.pointerId) return;
    if (event.type === 'pointercancel' || event.type === 'lostpointercapture') { cancelGesture(); return; }
    state.gesture = null; if (gesture.canvas.hasPointerCapture(event.pointerId)) gesture.canvas.releasePointerCapture(event.pointerId);
    remember(gesture.before); state.tool = 'select'; deferred = false; render(); host.onGestureSettled?.();
  }
  function fieldObject(path) {
    const [scope, ...keys] = path.split('.'); const region = selectedAssetRegion(state);
    if (scope === 'name' || scope === 'kind') return [state.model, scope];
    if (scope === 'region') return keys[0] === 'name' ? [region, 'name'] : [region?.shape, keys[0]];
    if (scope === 'point') return [region?.shape?.points?.[state.selectedPoint], keys[0]];
    if (scope === 'placement') return [state.model.spatial.placementBounds, keys[0]];
    if (scope === 'anchor') return [state.model.spatial.anchor, keys[0]];
    if (scope === 'scale') return [state.model.spatial.unitsPerPixel, keys[0]];
    if (scope === 'grid') return [state.grid, keys[0]];
    if (scope === 'metadata') { let object = state.model.metadata; for (const key of keys.slice(0, -1)) object = object[key]; return [object, keys.at(-1)]; }
    return [null, null];
  }
  function syncNumericFields() {
    for (const field of element.querySelectorAll('[data-asset-editor-field]')) {
      if (field === document.activeElement || state.fieldDrafts[field.dataset.assetEditorField] !== undefined) continue;
      const path = field.dataset.assetEditorField; const [object, key] = fieldObject(path); if (object && key) field.value = String(object[key] ?? '');
      if (path.startsWith('oval.')) { const r = selectedAssetRegion(state)?.shape; if (r) field.value = String(path.endsWith('cx') ? r.x + r.width / 2 : r.y + r.height / 2); }
    }
  }
  function inputField(event) {
    if (rendering || locked() || state.gesture) return;
    const range = event.target.closest('[data-asset-editor-zoom]'); if (range) { state.zoom = String(Number(range.value) / 100); syncAssetEditorCanvas(element, state); return; }
    const field = event.target.closest('[data-asset-editor-field]'); if (!field) return; const path = field.dataset.assetEditorField;
    if (!fieldBefore) fieldBefore = assetEditorSnapshot(state);
    const [object, key] = fieldObject(path); const numeric = field.type === 'number';
    if (numeric) { state.fieldDrafts[path] = field.value; if (!field.value.trim() || !Number.isFinite(Number(field.value))) { render({ inspector: false }); return; } }
    if (path.startsWith('oval.')) { const shape = selectedAssetRegion(state)?.shape; if (shape) { if (path.endsWith('cx')) shape.x = Number(field.value) - shape.width / 2; else shape.y = Number(field.value) - shape.height / 2; } }
    else if (object) { const old = object[key]; object[key] = numeric ? Number(field.value) : typeof old === 'boolean' ? field.value === 'true' : path === 'metadata.role' ? field.value || null : field.value; }
    if (isEmbeddedGeometry(state) && path === 'scale.x') state.model.spatial.unitsPerPixel.y = state.model.spatial.unitsPerPixel.x;
    if (path === 'metadata.navigation.effect') state.model.metadata.navigation.cost = field.value === 'cost' ? state.model.metadata.navigation.cost ?? 1 : null;
    state.error = null; render({ inspector: false });
  }
  function changedField(event) {
    // Removing a focused number control may dispatch its native change again.
    // The outer handler already committed that value; do not rebuild recursively.
    if (rendering || locked() || state.gesture) return; const field = event.target.closest('[data-asset-editor-field]');
    if (field) { inputField(event); const path = field.dataset.assetEditorField; if (field.type !== 'number' || (field.value.trim() && Number.isFinite(Number(field.value)))) delete state.fieldDrafts[path];
      if (fieldBefore && !path.startsWith('grid.')) remember(fieldBefore); fieldBefore = null;
      render({ inspector: !Object.keys(state.fieldDrafts).length }); return; }
    const option = event.target.closest('[data-asset-editor-option]'); if (option) { const [scope, key] = option.dataset.assetEditorOption.split('.'); state[scope][key] = option.checked; render({ inspector: false }); }
  }
  function knownReceipt(receipt, intent) {
    return receipt?.projectId === intent.projectId && receipt.revision === intent.payload.expectedRevision + 1 && receipt.value?.assetId === intent.assetId
      && receipt.value.assetVersion === intent.payload.expectedAssetVersion + 1 && Number.isSafeInteger(receipt.value.metadataVersion) && receipt.value.metadataVersion > 0;
  }
  async function save(retry = false) {
    if (disposed || ['saving', 'checking'].includes(state.save.status) || state.gesture) return;
    if (!retry) { state.conflict = assetEditorContextConflict(state, currentContext()); if (state.conflict) { render(); return; }
      try { state.save.intent = buildAssetEditorSave(state, `asset.save.${crypto.randomUUID()}`); } catch (error) { state.error = error.message; render(); return; } }
    const intent = state.save.intent; if (!intent) return;
    const wasUncertain = state.save.status === 'uncertain'; state.save.status = 'saving'; state.error = null; const generation = ++pendingGeneration;
    const controller = new AbortController(); requestController = controller; const timer = setTimeout(() => controller.abort(), 15_000); host.setMutationPending(true); render();
    try {
      const receipt = await host.saveAsset(intent, { signal: controller.signal });
      if (disposed || generation !== pendingGeneration) return;
      if (!knownReceipt(receipt, intent)) throw new Error('The save receipt did not identify this exact request.');
      state.context.projectRevision = receipt.revision; state.context.assetVersion = receipt.value.assetVersion; state.context.metadataVersion = receipt.value.metadataVersion;
      state.model.metadata = clone(intent.payload.metadata); state.savedModel = clone(state.model); state.save = { status: 'idle', intent: null }; state.conflict = null; state.history = { past: [], future: [] };
      try { await host.onSaved(receipt); } catch { state.error = 'The Asset was saved, but the project display could not refresh. Your saved receipt is confirmed; refresh the project when the connection returns.'; }
      host.announce?.('Asset saved as a new draft version. Existing Room placements keep their prior versions.');
    } catch (error) {
      if (disposed || generation !== pendingGeneration) return;
      const rejected = !wasUncertain && Number.isInteger(error.status) && error.status >= 400 && error.status < 500 && error.status !== 408;
      state.save.status = rejected ? 'idle' : 'uncertain';
      if (rejected) { state.save.intent = null; state.conflict = assetEditorContextConflict(state, currentContext()) || (error.status === 409 ? 'The saved project or Asset changed. Recheck its saved version before retrying this draft.' : null); state.error = `${error.message} Your draft is retained.`; }
      else state.error = 'The save outcome is not confirmed. Your exact request is retained. Check the saved outcome or retry that same save.';
    } finally { clearTimeout(timer); if (requestController === controller) requestController = null; host.setMutationPending(false); if (!disposed) render(); }
  }
  async function checkOutcome() {
    if (state.save.status !== 'uncertain' || !state.save.intent) return; const intent = state.save.intent; state.save.status = 'checking'; render();
    const controller = new AbortController(); requestController = controller; const generation = ++pendingGeneration; const timer = setTimeout(() => controller.abort(), 8_000); host.setMutationPending(true);
    try { await host.readSavedOutcome(intent, { signal: controller.signal }); if (!disposed && generation === pendingGeneration) state.error = 'The project was refreshed. Retry the exact save to obtain its confirmed receipt; matching visible content alone cannot confirm delivery.'; }
    catch { if (!disposed && generation === pendingGeneration) state.error = 'The saved outcome could not be checked. Retry the exact retained save when the connection returns.'; }
    finally { clearTimeout(timer); if (requestController === controller) requestController = null; if (!disposed && generation === pendingGeneration) state.save.status = 'uncertain'; host.setMutationPending(false); if (!disposed) render(); }
  }
  async function recheck() {
    if (locked()) return; const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8_000); requestController = controller;
    try {
      await host.readSavedOutcome({ projectId: state.context.projectId, assetId: state.context.assetId, payload: null }, { signal: controller.signal }); if (disposed) return;
      const current = currentContext(); if (current.projectId !== state.context.projectId) throw new Error('Return to the original project before rechecking this draft.');
      if (state.context.assetVersion && (current.asset?.assetVersion !== state.context.assetVersion || current.asset?.metadataVersion !== state.context.metadataVersion)) throw new Error('The Asset itself changed. Your draft remains available; inspect the current saved Asset before replacing this draft.');
      if (!state.context.assetVersion && (current.slice?.sliceId !== state.context.sliceId || current.slice?.version !== state.context.sliceVersion)) throw new Error('The image cut changed. This draft retains its original image; reopen the intended saved cut to create another Asset.');
      state.context.projectRevision = current.projectRevision; state.conflict = null; state.error = null;
    } catch (error) { state.error = error.message; }
    finally { clearTimeout(timer); if (requestController === controller) requestController = null; if (!disposed) render(); }
  }
  function requestLeave() {
    if (locked()) { host.announce?.('Resolve the pending save by checking or retrying it before leaving.'); return false; }
    if (assetEditorDirty(state) && !host.confirmDiscard('Discard these unsaved Asset edits? Saved images and Asset versions stay unchanged.')) return false;
    return true;
  }
  async function click(event) {
    const target = event.target.closest('[data-asset-editor-action]'); if (!target || target.disabled) return; const action = target.dataset.assetEditorAction, value = target.dataset.value;
    if (action === 'retry') { await save(true); return; } if (action === 'check-outcome') { await checkOutcome(); return; } if (action === 'recheck') { await recheck(); return; }
    if (action === 'back') {
      if (isEmbeddedGeometry(state)) {
        if (state.gesture) cancelGesture();
        state.embeddedViewContext = { ...captureView(), focus: state.lastGeometryFocus ?? focusKey() };
        host.onEmbeddedReturn(embeddedGeometryResult(state));
      } else if (await requestLeave()) host.onBack();
      return;
    }
    if (locked() || state.gesture) return;
    if (!requireCompleteNumericDraft()) return;
    if (action === 'save') { if (!isEmbeddedGeometry(state)) await save(); return; }
    if (action === 'view') { setView(value); return; }
    if (action === 'panel') { state.panel = value; render(); return; }
    if (action === 'region') { state.selectedRegionId = value; state.selectedPoint = null; state.tool = 'select'; render(); return; }
    if (action === 'point') { state.selectedPoint = Number(value); render(); return; }
    if (action === 'enable-geometry') { if (state.conversionError) { state.error = state.conversionError; render({ inspector: false }); return; } const before = assetEditorSnapshot(state); state.model.geometryEnabled = true; remember(before); render(); return; }
    if (action === 'resolve-presentation') { const before = assetEditorSnapshot(state); delete state.model.metadata.extensions['studio.preview.presentation']; remember(before); render(); return; }
    if (action === 'remove-region') { remove(true); return; }
    if (action === 'finish-polygon') { finishPolygon(); return; }
    if (action === 'close-grid') { state.gridOpen = false; render({ inspector: false }); element.querySelector('[data-asset-editor-tool="grid"]').focus({ preventScroll: true }); return; }
    if (action === 'zoom') { state.zoom = value; if (value === 'fit') state.frame = assetEditorFrame(state); syncAssetEditorCanvas(element, state); return; }
    if (action === 'tool') {
      if (value === 'grid') { state.gridOpen = !state.gridOpen; render({ inspector: false }); if (state.gridOpen) element.querySelector('[data-asset-editor-option="grid.show"]')?.focus({ preventScroll: true }); return; }
      if (value === 'undo' || value === 'redo') { assetEditorUndo(state, value === 'redo'); render(); return; }
      if (value === 'remove') { remove(); return; }
      if (state.polygonDraft.length) { state.error = 'Close this polygon, or press Escape to cancel it before changing tools.'; render({ inspector: false }); return; }
      state.tool = value; state.error = null; render({ inspector: false }); element.querySelector('[data-asset-editor-canvas]').focus({ preventScroll: true });
    }
  }
  function key(event) {
    if (locked()) return;
    if (['Shift', 'Alt'].includes(event.key) && state.gesture?.lastPointer) { pointerMove({ ...state.gesture.lastPointer, altKey: event.altKey, shiftKey: event.shiftKey, preventDefault() {} }); return; }
    if (event.key === 'Escape') { if (cancelGesture()) { event.preventDefault(); return; } if (state.gridOpen) { if (!requireCompleteNumericDraft()) { event.preventDefault(); return; } state.gridOpen = false; render({ inspector: false }); element.querySelector('[data-asset-editor-tool="grid"]').focus({ preventScroll: true }); return; }
      if (state.polygonDraft.length) { const before = assetEditorSnapshot(state); state.polygonDraft = []; state.cursor = null; state.tool = 'select'; remember(before); render(); event.preventDefault(); return; } }
    if (state.gesture || state.view === 'preview' || event.type === 'keyup' || event.target.matches('input,textarea,select')) return;
    if (!requireCompleteNumericDraft()) { event.preventDefault(); return; }
    if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) { event.preventDefault(); assetEditorUndo(state, event.shiftKey || event.key.toLowerCase() === 'y'); render(); return; }
    if (!event.target.closest('[data-asset-editor-canvas]') || !state.model.geometryEnabled) return;
    if (event.key === 'Enter' && state.polygonDraft.length) { event.preventDefault(); finishPolygon(); return; }
    if (['Delete', 'Backspace'].includes(event.key)) { event.preventDefault(); remove(); return; }
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]; if (!delta) return;
    const region = selectedAssetRegion(state); if (!region) return; event.preventDefault(); const before = assetEditorSnapshot(state); const step = event.shiftKey ? 10 : 1; let dx = delta[0] * step, dy = delta[1] * step;
    const matrix = state.model.regionTransforms?.[region.regionId];
    if (matrix) { const zero = inverseAssemblyPoint({ x: 0, y: 0 }, matrix), shifted = inverseAssemblyPoint({ x: dx, y: dy }, matrix); dx = shifted.x - zero.x; dy = shifted.y - zero.y; }
    if (region.shape.kind === 'polygon') { const points = state.selectedPoint === null ? region.shape.points : [region.shape.points[state.selectedPoint]]; for (const p of points) { p.x += dx; p.y += dy; } }
    else { region.shape.x += dx; region.shape.y += dy; } remember(before); render();
  }
  const on = (target, type, fn) => target.addEventListener(type, fn, { signal: listeners.signal });
  on(element, 'click', event => { void click(event); }); on(element, 'input', inputField); on(element, 'change', changedField);
  on(element, 'focusin', event => { if (event.target.matches('[data-asset-editor-field]')) fieldBefore = assetEditorSnapshot(state); if (event.target.matches('[data-asset-editor-field],[data-asset-editor-canvas]')) state.lastGeometryFocus = focusKey(); });
  on(element, 'pointerdown', pointerDown); on(element, 'pointermove', pointerMove); for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) on(element, type, pointerEnd);
  on(element, 'keydown', key); on(element, 'keyup', key);
  on(window, 'beforeunload', event => { if (assetEditorDirty(state) || state.save.intent) { event.preventDefault(); event.returnValue = ''; } });
  const observer = new ResizeObserver(() => { if (state.gesture) deferred = true; else if (!disposed && element.isConnected && state.view === 'edit') syncAssetEditorCanvas(element, state); });
  observer.observe(element.querySelector('[data-asset-editor-scroll="canvas"]'));
  return { element, afterMount() { if (!disposed) { render({ preserve: false }); if (isEmbeddedGeometry(state)) restoreView(state.embeddedViewContext); } }, reconcileContext, requestLeave,
    updateEmbeddedArtwork(scene, title = state.model.name) { if (!isEmbeddedGeometry(state)) return; state.initial.artworkScene = clone(scene); state.model.name = title; updateAssemblyArtwork(element.querySelector('[data-asset-editor-artwork]'), scene, { projectId: state.context.projectId }); if (!state.gesture) render({ inspector: false }); },
    dispose() { disposed = true; pendingGeneration += 1; requestController?.abort(); if (state.gesture) { const g = state.gesture; state.gesture = null; if (g.canvas.hasPointerCapture?.(g.pointerId)) g.canvas.releasePointerCapture(g.pointerId); } listeners.abort(); observer.disconnect(); },
    getState() { return clone({ ...state, gesture: state.gesture ? { mode: state.gesture.mode, scale: state.gesture.scale, pointerId: state.gesture.pointerId } : null }); } };
}
