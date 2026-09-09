import { createAssemblyEditorState, assemblyEditorSnapshot, assemblyEditorRemember, assemblyEditorRestore, assemblyEditorUndo, assemblyEditorDirty,
  assemblyEditorPins, assemblyEditorIssues, assemblyEditorResolve, assemblyEditorInvalidNumericField, selectedAssemblyComponent, assemblyEditorPreviewPin,
  buildAssemblyEditorSave, assemblyEditorContextConflict, assemblyEditorAddComponent, assemblyEditorPin, assemblyEditorMoveOrder, assemblyEditorRemoveComponent, assemblyEditorRemoveChoice } from './assembly-editor-state.js';
import { assemblyAssetKey, snapshotAssemblyBlocking } from '../../../packages/domain/src/assembly-geometry.js';
import { createAssemblyEditorView, updateAssemblyEditorView, syncAssemblyEditorCanvas } from './assembly-editor-view.js';
import { assemblySceneFrame } from './assembly-artwork-view.js';

const copy = value => structuredClone(value);
export function createAssemblyEditorController({ initial, host }) {
  const state = createAssemblyEditorState(initial), element = createAssemblyEditorView(state), listeners = new AbortController();
  let disposed = false, rendering = false, requestController = null, requestGeneration = 0, resolveController = null, resolveGeneration = 0, fieldBefore = null;
  const context = () => host.getContext(state.context);
  const locked = () => disposed || state.embeddedOpen || ['saving', 'uncertain', 'checking'].includes(state.save.status);
  const nativeAssets = () => host.getNativeAssets?.() ?? [];
  const captureView = () => ({ focus: document.activeElement?.closest?.('[data-assembly-focus-key]')?.dataset.assemblyFocusKey ?? null,
    page: { x: window.scrollX, y: window.scrollY }, scroll: Object.fromEntries([...element.querySelectorAll('[data-assembly-scroll]')].map(n => [n.dataset.assemblyScroll, { x: n.scrollLeft, y: n.scrollTop }])) });
  function restoreView(saved) {
    if (!saved) return; const generation = state.viewGeneration, view = state.view;
    requestAnimationFrame(() => {
      if (disposed || !element.isConnected || state.embeddedOpen || state.viewGeneration !== generation || state.view !== view || context()?.projectId !== state.context.projectId) return;
      for (const n of element.querySelectorAll('[data-assembly-scroll]')) { const p = saved.scroll?.[n.dataset.assemblyScroll]; if (p) { n.scrollLeft = p.x; n.scrollTop = p.y; } }
      [...element.querySelectorAll('[data-assembly-focus-key]')].find(n => n.dataset.assemblyFocusKey === saved.focus)?.focus({ preventScroll: true });
      window.scrollTo(saved.page?.x ?? window.scrollX, saved.page?.y ?? window.scrollY);
    });
  }
  function render({ inspector = true, preserve = true } = {}) {
    if (disposed || rendering || state.embeddedOpen) return; const saved = preserve && inspector ? captureView() : null;
    rendering = true;
    try {
      const issues = assemblyEditorIssues(state, { geometry: false });
      if (state.resolution.error) issues.push(state.resolution.error);
      for (const f of state.scene?.findings ?? []) if (f.severity === 'ERROR') issues.push(f.explanation ? `${f.explanation} ${f.remediation ?? ''}` : f.message ?? f.code);
      updateAssemblyEditorView(element, state, { inspector, nativeAssets: nativeAssets(), issues });
    } finally { rendering = false; }
    if (saved) restoreView(saved);
  }
  function resolveLocal() {
    try { assemblyEditorResolve(state); state.resolution.error = null; if (state.resolution.status !== 'loading') state.resolution.status = 'ready'; }
    catch (error) { state.resolution.error = error.message; }
  }
  async function resolveReferences() {
    const pins = assemblyEditorPins(state.model.assembly), available = new Set(state.assets.map(assemblyAssetKey));
    if (pins.every(pin => available.has(assemblyAssetKey(pin)))) { resolveLocal(); render(); return; }
    if (!host.resolveDraft) { state.resolution = { status: 'unavailable', error: 'The exact saved component versions are unavailable. Reopen this Assembly when the connection returns.' }; render(); return; }
    resolveController?.abort(); const controller = new AbortController(), generation = ++resolveGeneration; resolveController = controller;
    const pinSignature = JSON.stringify(pins), projectId = state.context.projectId; state.resolution = { status: 'loading', error: null }; render({ inspector: false });
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await host.resolveDraft({ assembly: copy(state.model.assembly), pins }, { signal: controller.signal });
      if (disposed || generation !== resolveGeneration || context()?.projectId !== projectId || JSON.stringify(assemblyEditorPins(state.model.assembly)) !== pinSignature) return;
      const assets = Array.isArray(response) ? response : response.assets;
      if (!Array.isArray(assets)) throw new Error('The component response did not contain exact saved Assets.');
      const byPin = new Map(state.assets.map(a => [assemblyAssetKey(a), a])); for (const asset of assets) byPin.set(assemblyAssetKey(asset), copy(asset)); state.assets = [...byPin.values()];
      if (!pins.every(pin => byPin.has(assemblyAssetKey(pin)))) throw new Error('An exact component version is unavailable. The Assembly will not substitute its latest Library version.');
      state.resolution = { status: 'ready', error: null }; resolveLocal();
    } catch (error) { if (!disposed && generation === resolveGeneration) state.resolution = { status: 'unavailable', error: error.message || 'Exact component versions could not be loaded.' }; }
    finally { clearTimeout(timer); if (resolveController === controller) resolveController = null; if (!disposed && generation === resolveGeneration) render(); }
  }
  const remember = before => { assemblyEditorRemember(state, before); resolveLocal(); };
  function reconcileContext(current = context()) { if (disposed) return; state.conflict = assemblyEditorContextConflict(state, current); if (!state.gesture && !state.embeddedOpen) render({ inspector: false }); }
  function requireNumeric() {
    const key = assemblyEditorInvalidNumericField(state); if (!key) return true;
    state.error = 'Complete this numeric value before changing the selected component, panel or tool. Your entered value is retained.'; render({ inspector: false });
    [...element.querySelectorAll('[data-assembly-field]')].find(n => `${n.dataset.assemblyField}:${n.dataset.row ?? ''}` === key)?.focus({ preventScroll: true }); return false;
  }
  function setView(view) {
    if (locked() || state.gesture || !requireNumeric()) return;
    state.viewContexts[state.view] = captureView(); state.view = view; state.viewGeneration += 1; state.gridOpen = false; state.pickerOpen = false;
    render({ preserve: false }); restoreView(state.viewContexts[view] ?? { focus: view === 'edit' ? 'canvas' : 'return-source:', page: { x: window.scrollX, y: window.scrollY }, scroll: {} });
  }
  function point(event, gesture = state.gesture) {
    const canvas = element.querySelector('[data-assembly-canvas]'), inverse = gesture?.inverse ?? canvas.getScreenCTM()?.inverse(); if (!inverse) return null;
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(inverse);
  }
  function cancelGesture() {
    const gesture = state.gesture; if (!gesture) return false; state.gesture = null; assemblyEditorRestore(state, gesture.before);
    if (gesture.canvas.hasPointerCapture?.(gesture.pointerId)) gesture.canvas.releasePointerCapture(gesture.pointerId); resolveLocal(); render(); host.onGestureSettled?.(); return true;
  }
  function pointerDown(event) {
    const canvas = event.target.closest('[data-assembly-canvas]'), node = event.target.closest('[data-assembly-component]');
    if (!canvas || event.button !== 0 || state.view !== 'edit' || locked() || state.gesture) return;
    if (!requireNumeric()) { event.preventDefault(); return; }
    if (!node) return; const c = state.model.assembly.components.find(c => c.componentId === node.dataset.assemblyComponent); if (!c) return;
    const start = point(event); if (!start) return; event.preventDefault(); canvas.focus({ preventScroll: true });
    state.selectedComponentId = c.componentId; state.panel = 'component'; state.error = null;
    state.gesture = { before: assemblyEditorSnapshot(state), original: copy(c.position), componentId: c.componentId, start, inverse: canvas.getScreenCTM().inverse(), scale: state.scale, grid: copy(state.grid), canvas, pointerId: event.pointerId };
    canvas.setPointerCapture(event.pointerId); render();
  }
  function pointerMove(event) {
    const g = state.gesture; if (!g || event.pointerId !== g.pointerId || locked()) return; const p = point(event, g); if (!p) return; event.preventDefault();
    const c = state.model.assembly.components.find(c => c.componentId === g.componentId); if (!c) { cancelGesture(); return; }
    let x = g.original.x + p.x - g.start.x, y = g.original.y + p.y - g.start.y;
    if (g.grid.snap && !event.altKey && g.grid.step > 0) { x = Math.round(x / g.grid.step) * g.grid.step; y = Math.round(y / g.grid.step) * g.grid.step; }
    c.position = { x, y }; resolveLocal(); render({ inspector: false }); syncFields();
  }
  function pointerEnd(event) {
    const g = state.gesture; if (!g || event.pointerId !== g.pointerId) return;
    if (event.type !== 'pointerup') { cancelGesture(); return; }
    state.gesture = null; if (g.canvas.hasPointerCapture?.(g.pointerId)) g.canvas.releasePointerCapture(g.pointerId); remember(g.before); render(); host.onGestureSettled?.();
  }
  function fieldTarget(key, row = '') {
    const a = state.model.assembly, c = selectedAssemblyComponent(state), [group, prop] = key.split('.');
    if (['name', 'kind'].includes(key)) return [state.model, key];
    if (key === 'role' || key === 'tags') return [state.model.metadata, key];
    if (key === 'unitsPerPixel') return [a, key];
    if (group === 'bounds') return [a.placementBounds, prop]; if (group === 'anchor') return [a.anchor, prop];
    if (group === 'position') return [c?.position, prop]; if (group === 'component') return [c, prop];
    if (['rotationDegrees', 'scale'].includes(key)) return [c, key]; if (group === 'grid') return [state.grid, prop];
    if (key === 'state-name') return [a.states.find(s => s.stateId === row), 'name']; if (key === 'variant-name') return [a.variants.find(v => v.variantId === row), 'name'];
    return [null, null];
  }
  function syncFields() {
    for (const n of element.querySelectorAll('[data-assembly-field]')) { const key = n.dataset.assemblyField, row = n.dataset.row ?? '';
      if (n === document.activeElement || state.fieldDrafts[`${key}:${row}`] !== undefined) continue;
      const [object, prop] = fieldTarget(key, row); if (object) n.value = String(prop === 'tags' ? object[prop].join(', ') : object[prop] ?? ''); }
  }
  function changeBlocking(mode) {
    const a = state.model.assembly; if (mode === a.blocking.mode) return;
    const before = assemblyEditorSnapshot(state);
    if (mode === 'custom' && !state.customInitialized) { resolveLocal(); if (state.resolution.error) throw new Error(state.resolution.error);
      a.blocking.regions = snapshotAssemblyBlocking(state.scene?.regions ?? []); state.customInitialized = true; }
    a.blocking.mode = mode; remember(before); render();
  }
  function input(event) {
    if (rendering || locked() || state.gesture) return;
    if (event.target.matches('[data-assembly-zoom]')) { state.zoom = String(Number(event.target.value) / 100); syncAssemblyEditorCanvas(element, state); return; }
    if (event.target.matches('[data-assembly-picker-search]')) { state.pickerSearch = event.target.value; render(); return; }
    const n = event.target.closest('[data-assembly-field]'); if (!n) return; const key = n.dataset.assemblyField, row = n.dataset.row ?? '';
    if (key.startsWith('preview.') || key === 'blocking-mode') return;
    fieldBefore ??= assemblyEditorSnapshot(state); const [object, prop] = fieldTarget(key, row); if (!object) return;
    if (n.type === 'number') { state.fieldDrafts[`${key}:${row}`] = n.value; if (!n.value.trim() || !Number.isFinite(Number(n.value))) { render({ inspector: false }); return; } }
    object[prop] = n.type === 'number' ? Number(n.value) : key === 'tags' ? n.value.split(',').map(v => v.trim()).filter(Boolean) : key === 'role' ? n.value.trim() || null : n.value;
    state.error = null; resolveLocal(); render({ inspector: false });
  }
  function change(event) {
    if (rendering || locked() || state.gesture) return;
    const n = event.target.closest('[data-assembly-field]');
    if (n) {
      const key = n.dataset.assemblyField, row = n.dataset.row ?? '';
      if (key.startsWith('preview.')) { if (!requireNumeric()) { n.value = state.preview[key.split('.')[1]]; return; } state.preview[key.split('.')[1]] = n.value; fieldBefore = null; resolveLocal(); render(); return; }
      if (key === 'blocking-mode') { if (!requireNumeric()) return; try { changeBlocking(n.value); } catch (error) { state.error = error.message; render(); } return; }
      input(event); if (n.type !== 'number' || (n.value.trim() && Number.isFinite(Number(n.value)))) delete state.fieldDrafts[`${key}:${row}`];
      if (fieldBefore && !key.startsWith('grid.')) remember(fieldBefore); fieldBefore = null; render({ inspector: !Object.keys(state.fieldDrafts).length }); return;
    }
    const option = event.target.closest('[data-assembly-option]'); if (!option || !requireNumeric()) return; const key = option.dataset.assemblyOption, c = selectedAssemblyComponent(state);
    if (key.startsWith('grid.')) { state.grid[key.split('.')[1]] = option.checked; render({ inspector: false }); return; }
    if (!c) return; const before = assemblyEditorSnapshot(state);
    if (key === 'all-states') c.stateIds = option.checked ? null : state.model.assembly.states.map(s => s.stateId);
    if (key === 'state-membership') { c.stateIds ??= state.model.assembly.states.map(s => s.stateId); c.stateIds = option.checked ? [...new Set([...c.stateIds, option.dataset.value])] : c.stateIds.filter(id => id !== option.dataset.value); }
    remember(before); render();
  }
  async function editCustomGeometry() {
    if (!host.editCustomGeometry) throw new Error('Custom geometry editing is unavailable in this context.');
    if (state.model.assembly.blocking.mode !== 'custom') changeBlocking('custom');
    const before = assemblyEditorSnapshot(state), captured = captureView(), generation = ++state.viewGeneration;
    state.viewContexts.edit = captured; state.embeddedOpen = true;
    const draft = { assembly: copy(state.model.assembly), regions: copy(state.model.assembly.blocking.regions), session: copy(state.customDraft?.session ?? null), issues: copy(state.customDraft?.issues ?? []) };
    try {
      const result = await host.editCustomGeometry({ draft, artwork: copy(state.scene), title: `${state.model.name || 'New Assembly'} / Custom blocking` });
      if (disposed || state.viewGeneration !== generation || context()?.projectId !== state.context.projectId) return;
      if (result) {
        state.customDraft = { session: copy(result.session ?? null), issues: copy(result.issues ?? []) };
        if (Array.isArray(result.regions)) state.model.assembly.blocking.regions = copy(result.regions);
        if (result.assembly) for (const key of ['placementBounds', 'anchor', 'unitsPerPixel']) if (result.assembly[key] !== undefined) state.model.assembly[key] = copy(result.assembly[key]);
        remember(before);
      }
    } finally { if (!disposed) { state.embeddedOpen = false; render({ preserve: false }); restoreView(captured); host.onGestureSettled?.(); } }
  }
  function knownReceipt(receipt, intent) {
    return receipt?.projectId === intent.projectId && receipt.revision === intent.payload.expectedRevision + 1 && receipt.value?.assetId === intent.assetId
      && receipt.value.assetVersion === intent.payload.expectedAssetVersion + 1 && Number.isSafeInteger(receipt.value.metadataVersion) && receipt.value.metadataVersion > 0;
  }
  async function save(retry = false) {
    if (disposed || state.embeddedOpen || state.gesture || ['saving', 'checking'].includes(state.save.status)) return;
    if (!retry) { state.conflict = assemblyEditorContextConflict(state, context()); if (state.conflict) { render(); return; }
      try { state.save.intent = buildAssemblyEditorSave(state, `assembly.save.${crypto.randomUUID()}`); } catch (error) { state.error = error.message; render(); return; } }
    const intent = state.save.intent; if (!intent) return;
    const uncertain = state.save.status === 'uncertain', generation = ++requestGeneration, controller = new AbortController(); requestController = controller;
    const timer = setTimeout(() => controller.abort(), 15_000); state.save.status = 'saving'; state.error = null; host.setMutationPending(true); render();
    try {
      const receipt = await host.saveAssembly(intent, { signal: controller.signal });
      if (disposed || generation !== requestGeneration) return; if (!knownReceipt(receipt, intent)) throw new Error('The save receipt did not identify this exact Assembly request.');
      state.context.projectRevision = receipt.revision; state.context.assetVersion = receipt.value.assetVersion; state.context.metadataVersion = receipt.value.metadataVersion;
      state.model.assembly = copy(intent.payload.assembly); state.savedModel = copy(state.model); state.history = { past: [], future: [] }; state.save = { status: 'idle', intent: null }; state.conflict = null;
      try { await host.onSaved(receipt); } catch { state.error = 'Your Assembly was saved. The project display could not refresh; reconnect to refresh it.'; }
      host.announce?.('Assembly saved as a new draft version. Its component references remain exact.');
    } catch (error) {
      if (disposed || generation !== requestGeneration) return;
      const rejected = !uncertain && Number.isInteger(error.status) && error.status >= 400 && error.status < 500 && error.status !== 408;
      state.save.status = rejected ? 'idle' : 'uncertain';
      if (rejected) { state.save.intent = null; state.conflict = assemblyEditorContextConflict(state, context()) || (error.status === 409 ? 'The project or Assembly changed. Recheck its saved version; your draft is retained.' : null); state.error = `${error.message} Your draft is retained.`; }
      else state.error = 'The save outcome is not confirmed. Your exact request is retained. Check the saved outcome or retry that same Save.';
    } finally { clearTimeout(timer); if (requestController === controller) requestController = null; host.setMutationPending(false); if (!disposed) render(); }
  }
  async function checkOutcome(recheck = false) {
    if (disposed || state.embeddedOpen || ['saving', 'checking'].includes(state.save.status) || (recheck && locked())) return;
    const intent = state.save.intent; if (!recheck && !intent) return;
    const controller = new AbortController(), generation = ++requestGeneration; requestController = controller; const timer = setTimeout(() => controller.abort(), 8_000);
    const prior = state.save.status; state.save.status = 'checking'; host.setMutationPending(true); render();
    try {
      await host.readSavedOutcome(intent ?? { projectId: state.context.projectId, assetId: state.context.assetId, payload: null }, { signal: controller.signal });
      if (disposed || generation !== requestGeneration) return;
      if (recheck) { const current = context(); if (current.projectId !== state.context.projectId) throw new Error('Return to the original project before rechecking.');
        if (state.context.assetVersion && (!current.asset || current.asset.assetVersion !== state.context.assetVersion || current.asset.metadataVersion !== state.context.metadataVersion)) throw new Error('The Assembly itself changed. Your draft remains available; inspect its current saved version before replacing it.');
        state.context.projectRevision = current.projectRevision; state.conflict = null; state.error = null;
      } else state.error = 'The project was refreshed. Retry the exact Save to obtain its confirmed receipt; matching visible content alone cannot confirm delivery.';
    } catch (error) { if (!disposed && generation === requestGeneration) state.error = error.message; }
    finally { clearTimeout(timer); if (requestController === controller) requestController = null; host.setMutationPending(false); if (!disposed && generation === requestGeneration) { state.save.status = prior; render(); } }
  }
  function requestLeave() {
    if (locked()) { host.announce?.('Finish the open geometry editor or resolve the pending Save before leaving.'); return false; }
    if (state.gesture) cancelGesture();
    return !assemblyEditorDirty(state) || host.confirmDiscard('Discard these unsaved Assembly edits? Saved component Assets and Assembly versions stay unchanged.');
  }
  async function click(event) {
    const target = event.target.closest('[data-assembly-action]'); if (!target || target.disabled) return; const action = target.dataset.assemblyAction, value = target.dataset.value;
    if (action === 'retry') { await save(true); return; } if (action === 'check-outcome') { await checkOutcome(); return; } if (action === 'recheck') { await checkOutcome(true); return; }
    if (action === 'back') { if (requestLeave()) host.onBack(); return; } if (locked() || state.gesture || !requireNumeric()) return;
    try {
      if (action === 'save') { await save(); return; } if (action === 'custom-geometry') { await editCustomGeometry(); return; }
      if (action === 'return-source') { setView('edit'); return; }
      if (action === 'source') { const c = selectedAssemblyComponent(state), pin = c && assemblyEditorPreviewPin(c, state.preview.variantId), asset = pin && state.assets.find(a => assemblyAssetKey(a) === assemblyAssetKey(pin));
        if (!asset) throw new Error('The exact component source is unavailable. Its current Library head will not be substituted.'); state.source = { asset: copy(asset), componentId: c.componentId }; setView('source'); return; }
      if (action === 'panel') { state.panel = value; render(); return; }
      if (action === 'component') { state.selectedComponentId = value; render(); return; }
      if (action === 'eye') { state.hidden = state.hidden.includes(value) ? state.hidden.filter(id => id !== value) : [...state.hidden, value]; render(); return; }
      if (action === 'grid' || action === 'close-grid') { state.gridOpen = action === 'grid' ? !state.gridOpen : false; render({ inspector: false }); return; }
      if (action === 'zoom') { state.zoom = value; if (value === 'fit') state.frame = assemblySceneFrame(state.scene, state.model.assembly); syncAssemblyEditorCanvas(element, state); return; }
      if (action === 'select-tool') { element.querySelector('[data-assembly-canvas]').focus({ preventScroll: true }); return; }
      if (['add', 'replace-base', 'variant-asset'].includes(action)) { state.pickerOpen = true; state.pickerPurpose = action === 'variant-asset' ? `variant:${value}` : action; state.pickerSearch = ''; state.gridOpen = false; render(); element.querySelector('[data-assembly-picker-search]')?.focus({ preventScroll: true }); return; }
      if (action === 'close-picker') { state.pickerOpen = false; render({ inspector: false }); return; }
      if (action === 'undo' || action === 'redo') { assemblyEditorUndo(state, action === 'redo'); resolveLocal(); render(); void resolveReferences(); return; }
      const before = assemblyEditorSnapshot(state), c = selectedAssemblyComponent(state), a = state.model.assembly;
      if (action === 'pick-asset') { const asset = nativeAssets().find(asset => assemblyAssetKey(asset) === value); if (!asset) throw new Error('That Library version changed. Reopen the picker and choose the intended exact version.');
        if (state.pickerPurpose === 'add') assemblyEditorAddComponent(state, asset);
        else if (c) { if (!state.assets.some(item => assemblyAssetKey(item) === value)) state.assets.push(copy(asset));
          if (state.pickerPurpose === 'replace-base') c.asset = assemblyEditorPin(asset);
          else { const variantId = state.pickerPurpose.slice('variant:'.length); c.variantOverrides = c.variantOverrides.filter(v => v.variantId !== variantId); c.variantOverrides.push({ variantId, asset: assemblyEditorPin(asset) }); } }
        state.pickerOpen = false; state.panel = 'component';
      } else if (action === 'rotate' && c) c.rotationDegrees = (c.rotationDegrees + 90) % 360;
      else if (action === 'forward') assemblyEditorMoveOrder(state, -1);
      else if (action === 'backward') assemblyEditorMoveOrder(state, 1);
      else if (action === 'remove') assemblyEditorRemoveComponent(state);
      else if (action === 'clear-variant' && c) c.variantOverrides = c.variantOverrides.filter(v => v.variantId !== value);
      else if (action === 'add-state' && a.states.length < 16) a.states.push({ stateId: `state.${crypto.randomUUID()}`, name: `State ${a.states.length + 1}` });
      else if (action === 'add-variant' && a.variants.length < 16) a.variants.push({ variantId: `variant.${crypto.randomUUID()}`, name: `Variant ${a.variants.length + 1}` });
      else if (action === 'remove-state' || action === 'remove-variant') assemblyEditorRemoveChoice(state, action === 'remove-state' ? 'state' : 'variant', value);
      else if (action === 'default-state') a.defaultStateId = value;
      else if (action === 'default-variant') a.defaultVariantId = value;
      remember(before); render(); if (action === 'pick-asset') void resolveReferences();
    } catch (error) { state.error = error.message; render(); }
  }
  function key(event) {
    if (locked()) return;
    if (event.key === 'Escape') { if (cancelGesture()) { event.preventDefault(); return; } if (state.pickerOpen || state.gridOpen) { state.pickerOpen = false; state.gridOpen = false; render(); event.preventDefault(); return; } }
    if (state.gesture || state.view !== 'edit' || event.target.matches('input,textarea,select') || !requireNumeric()) return;
    if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) { event.preventDefault(); assemblyEditorUndo(state, event.shiftKey || event.key.toLowerCase() === 'y'); resolveLocal(); render(); return; }
    if (!event.target.closest('[data-assembly-canvas]')) return; const c = selectedAssemblyComponent(state); if (!c) return;
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!delta && !['Delete', 'Backspace', 'r', 'R'].includes(event.key)) return; event.preventDefault(); const before = assemblyEditorSnapshot(state);
    if (delta) { const step = event.shiftKey ? 10 : 1; c.position.x += delta[0] * step; c.position.y += delta[1] * step; }
    else if (event.key.toLowerCase() === 'r') c.rotationDegrees = (c.rotationDegrees + 90) % 360; else assemblyEditorRemoveComponent(state); remember(before); render();
  }
  const on = (node, name, fn) => node.addEventListener(name, fn, { signal: listeners.signal });
  on(element, 'click', event => { void click(event); }); on(element, 'input', input); on(element, 'change', change);
  on(element, 'focusin', event => { if (event.target.matches('[data-assembly-field]')) fieldBefore = assemblyEditorSnapshot(state); });
  on(element, 'pointerdown', pointerDown); on(element, 'pointermove', pointerMove); for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) on(element, name, pointerEnd); on(element, 'keydown', key);
  on(window, 'beforeunload', event => { if (assemblyEditorDirty(state) || state.save.intent) { event.preventDefault(); event.returnValue = ''; } });
  const observer = new ResizeObserver(() => { if (!disposed && !state.gesture && !state.embeddedOpen && element.isConnected && state.view === 'edit') syncAssemblyEditorCanvas(element, state); });
  observer.observe(element.querySelector('[data-assembly-scroll="canvas"]'));
  resolveLocal();
  return { element,
    afterMount() { if (disposed) return; render({ preserve: false }); restoreView(state.viewContexts[state.view]); void resolveReferences(); },
    reconcileContext, requestLeave,
    dispose() { disposed = true; requestGeneration += 1; resolveGeneration += 1; requestController?.abort(); resolveController?.abort();
      if (state.gesture) { const g = state.gesture; state.gesture = null; if (g.canvas.hasPointerCapture?.(g.pointerId)) g.canvas.releasePointerCapture(g.pointerId); } listeners.abort(); observer.disconnect(); },
    getState() { return copy({ ...state, gesture: state.gesture ? { pointerId: state.gesture.pointerId, scale: state.gesture.scale, componentId: state.gesture.componentId } : null }); },
  };
}
