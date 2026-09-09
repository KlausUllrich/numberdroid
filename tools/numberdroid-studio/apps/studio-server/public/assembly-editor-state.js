import { normalizeAssemblyDeclaration, resolveAssemblyScene, validateAssemblyGeometry, assemblyAssetKey } from '../../../packages/domain/src/assembly-geometry.js';

const copy = value => structuredClone(value);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const assemblyEditorPin = asset => ({ assetId: asset.assetId, assetVersion: asset.assetVersion, metadataVersion: asset.metadataVersion });
export function assemblyEditorDefaultDeclaration() {
  return { schemaVersion: 1, coordinateSpace: 'assembly-pixels', unitsPerPixel: 1 / 64,
    placementBounds: { x: -128, y: -128, width: 256, height: 256 }, anchor: { x: 0, y: 0 },
    states: [{ stateId: 'state.idle', name: 'Idle' }], variants: [{ variantId: 'variant.default', name: 'Default' }],
    defaultStateId: 'state.idle', defaultVariantId: 'variant.default', components: [], blocking: { mode: 'components', regions: [] } };
}
export function createAssemblyEditorState(initial) {
  const asset = initial.asset;
  const model = { name: asset?.name ?? '', kind: asset?.kind ?? 'prop', metadata: copy(asset?.metadata ?? { role: null, tags: [] }), assembly: copy(asset?.assembly ?? assemblyEditorDefaultDeclaration()) };
  return { instanceId: initial.instanceId ?? crypto.randomUUID(), context: { projectId: initial.projectId, projectRevision: initial.projectRevision,
    assetId: asset?.assetId ?? initial.assetId ?? `assembly.${crypto.randomUUID()}`, assetVersion: asset?.assetVersion ?? 0, metadataVersion: asset?.metadataVersion ?? 0 },
    model, savedModel: copy(model), assets: copy(initial.assets ?? []), scene: null, selectedComponentId: model.assembly.components[0]?.componentId ?? null,
    preview: { stateId: model.assembly.defaultStateId, variantId: model.assembly.defaultVariantId }, hidden: [], view: 'edit', panel: 'component',
    zoom: 'fit', scale: 1, frame: null, grid: { show: true, snap: false, step: 16 }, gridOpen: false, pickerOpen: false, pickerSearch: '', pickerPurpose: 'add',
    history: { past: [], future: [] }, fieldDrafts: {}, customDraft: null, customInitialized: model.assembly.blocking.mode === 'custom' || model.assembly.blocking.regions.length > 0,
    save: { status: 'idle', intent: null }, resolution: { status: 'idle', error: null }, error: null, conflict: null, gesture: null, viewContexts: {}, viewGeneration: 0, source: null };
}
export function assemblyEditorSnapshot(state) {
  return copy({ model: state.model, customDraft: state.customDraft, customInitialized: state.customInitialized, selectedComponentId: state.selectedComponentId });
}
export function assemblyEditorRemember(state, before) {
  if (equal(before, assemblyEditorSnapshot(state))) return false;
  state.history.past.push(before); if (state.history.past.length > 50) state.history.past.shift(); state.history.future = []; state.error = null; return true;
}
export function assemblyEditorRestore(state, snapshot) {
  Object.assign(state, copy(snapshot)); state.fieldDrafts = {}; state.error = null;
  if (!state.model.assembly.states.some(s => s.stateId === state.preview.stateId)) state.preview.stateId = state.model.assembly.defaultStateId;
  if (!state.model.assembly.variants.some(v => v.variantId === state.preview.variantId)) state.preview.variantId = state.model.assembly.defaultVariantId;
}
export function assemblyEditorUndo(state, redo = false) {
  const from = redo ? state.history.future : state.history.past, to = redo ? state.history.past : state.history.future;
  if (!from.length) return false; to.push(assemblyEditorSnapshot(state)); assemblyEditorRestore(state, from.pop()); return true;
}
export function assemblyEditorDirty(state) {
  return !equal(state.model, state.savedModel) || Object.keys(state.fieldDrafts).length > 0 || Boolean(state.customDraft?.issues?.length)
    || Boolean(state.customDraft?.session?.polygonDraft?.length) || Boolean(Object.keys(state.customDraft?.session?.fieldDrafts ?? {}).length);
}
export function selectedAssemblyComponent(state) { return state.model.assembly.components.find(c => c.componentId === state.selectedComponentId) ?? null; }
export function assemblyEditorPins(assembly) {
  const pins = new Map(); for (const c of assembly.components) for (const pin of [c.asset, ...c.variantOverrides.map(v => v.asset)]) pins.set(assemblyAssetKey(pin), copy(pin)); return [...pins.values()];
}
export function assemblyEditorPreviewPin(component, variantId) { return component.variantOverrides.find(v => v.variantId === variantId)?.asset ?? component.asset; }
export function assemblyEditorInvalidNumericField(state) { return Object.entries(state.fieldDrafts).find(([, v]) => v.trim() === '' || !Number.isFinite(Number(v)))?.[0] ?? null; }
export function assemblyEditorIssues(state, { geometry = true } = {}) {
  const issues = [];
  if (!state.model.name.trim() || state.model.name.trim().length > 160) issues.push('Give the Assembly a name of 1–160 characters.');
  if (!['surface', 'prop', 'item'].includes(state.model.kind)) issues.push('Choose Surface, Prop or Item.');
  if (state.model.metadata.role !== null && (typeof state.model.metadata.role !== 'string' || !state.model.metadata.role.trim() || state.model.metadata.role.length > 64)) issues.push('Use a descriptive role of at most 64 characters, or leave it empty.');
  if (!Array.isArray(state.model.metadata.tags) || state.model.metadata.tags.length > 32 || state.model.metadata.tags.some(tag => typeof tag !== 'string' || !tag.trim() || tag.length > 64) || new Set(state.model.metadata.tags).size !== state.model.metadata.tags.length) issues.push('Use at most 32 distinct tags, each 1–64 characters.');
  if (assemblyEditorInvalidNumericField(state)) issues.push('Complete the numeric value before saving.');
  const custom = state.customDraft;
  if (custom?.session?.polygonDraft?.length) issues.push('Close the unfinished polygon in custom blocking before saving.');
  if (Object.keys(custom?.session?.fieldDrafts ?? {}).length) issues.push('Complete the numeric values in custom blocking before saving.');
  if (custom?.issues?.length) issues.push(...custom.issues);
  try {
    const assembly = normalizeAssemblyDeclaration(state.model.assembly);
    if (geometry) {
      const result = validateAssemblyGeometry({ assembly, assets: assemblyEditorClosure(state), projectId: state.context.projectId });
      for (const f of result.findings ?? []) if (f.severity === 'ERROR') issues.push(f.explanation ? `${f.explanation} ${f.remediation ?? ''}`.trim() : f.message ?? String(f.code));
    }
  } catch (error) { issues.push(error.message); }
  return [...new Set(issues)];
}
export function assemblyEditorResolve(state) {
  if (!state.model.assembly.components.length) { state.scene = null; return null; }
  state.scene = resolveAssemblyScene({ assembly: state.model.assembly, assets: assemblyEditorClosure(state), projectId: state.context.projectId, selection: state.preview }); return state.scene;
}
function assemblyEditorClosure(state) { const keys = new Set(assemblyEditorPins(state.model.assembly).map(assemblyAssetKey)); return state.assets.filter(asset => keys.has(assemblyAssetKey(asset))); }
export function buildAssemblyEditorSave(state, idempotencyKey) {
  const issues = assemblyEditorIssues(state); if (issues.length) throw new Error(issues.join(' '));
  const c = state.context;
  const payload = { expectedRevision: c.projectRevision, idempotencyKey, operation: c.assetVersion ? 'update' : 'create', expectedAssetVersion: c.assetVersion,
    expectedMetadataVersion: c.metadataVersion, name: state.model.name.trim(), kind: state.model.kind, metadata: copy(state.model.metadata), assembly: normalizeAssemblyDeclaration(state.model.assembly) };
  return { projectId: c.projectId, assetId: c.assetId, payload, serialized: JSON.stringify(payload) };
}
export function assemblyEditorContextConflict(state, context) {
  if (context?.projectId !== state.context.projectId) return 'The selected project changed. Return to this project before saving.';
  if (context.projectRevision !== state.context.projectRevision) return 'The project changed while you were editing. Recheck the saved version; your Assembly draft is retained.';
  if (state.context.assetVersion && (!context.asset || context.asset.assetVersion !== state.context.assetVersion || context.asset.metadataVersion !== state.context.metadataVersion)) return 'The Assembly changed while you were editing. Your draft is retained; inspect its current saved version.';
  return null;
}
export function assemblyEditorAddComponent(state, asset, componentId = `component.${crypto.randomUUID()}`) {
  if (state.model.assembly.components.length >= 32) throw new Error('Use at most 32 components.');
  if (asset?.sliceBinding?.mediaType !== 'image/png' || !/^[a-f0-9]{64}$/.test(asset.sliceBinding.digest ?? '') || asset.assembly) throw new Error('Choose a saved PNG-backed Asset. Nested Assemblies are not supported.');
  const component = { componentId, name: asset.name, asset: assemblyEditorPin(asset), position: copy(state.model.assembly.anchor), rotationDegrees: 0, scale: 1, stateIds: null, variantOverrides: [] };
  state.model.assembly.components.unshift(component); state.selectedComponentId = componentId;
  const key = assemblyAssetKey(asset); if (!state.assets.some(a => assemblyAssetKey(a) === key)) state.assets.push(copy(asset)); return component;
}
export function assemblyEditorMoveOrder(state, offset) {
  const components = state.model.assembly.components, from = components.findIndex(c => c.componentId === state.selectedComponentId);
  const to = Math.min(components.length - 1, Math.max(0, from + offset)); if (from < 0 || from === to) return false;
  components.splice(to, 0, components.splice(from, 1)[0]); return true;
}
export function assemblyEditorRemoveComponent(state) {
  const components = state.model.assembly.components, index = components.findIndex(c => c.componentId === state.selectedComponentId); if (index < 0) return false;
  components.splice(index, 1); state.selectedComponentId = components[Math.min(index, components.length - 1)]?.componentId ?? null; return true;
}
export function assemblyEditorRemoveChoice(state, kind, id) {
  const a = state.model.assembly, isState = kind === 'state', list = isState ? a.states : a.variants, key = isState ? 'stateId' : 'variantId';
  if (list.length <= 1) throw new Error(`Keep at least one ${kind}.`);
  const index = list.findIndex(item => item[key] === id); if (index < 0) return;
  list.splice(index, 1);
  for (const c of a.components) if (isState && c.stateIds !== null) c.stateIds = c.stateIds.filter(value => value !== id); else if (!isState) c.variantOverrides = c.variantOverrides.filter(value => value.variantId !== id);
  const defaultKey = isState ? 'defaultStateId' : 'defaultVariantId'; if (a[defaultKey] === id) a[defaultKey] = list[0][key];
  if (state.preview[key] === id) state.preview[key] = a[defaultKey];
}
