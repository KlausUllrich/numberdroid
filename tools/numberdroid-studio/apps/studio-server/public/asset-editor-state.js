import { normalizeAssetSpatial, spatialAliases, spatialFromLegacyAsset, spatialMetadataFindings } from '../../../packages/domain/src/asset-spatial-geometry.js';

const copy = value => structuredClone(value);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const positive = n => Number.isFinite(n) && n > 0;
export function assetEditorDefaultMetadata() {
  return { role: null, tags: [], variantGroup: null, compatibilityGroups: [], spanTiles: { width: 1, height: 1 }, anchor: { x: 0, y: 0 },
    attachment: 'ground', rotationPolicy: 'fixed', placement: { modes: ['manual'], wallSafe: false, tags: [], confirmation: 'confirmed' },
    collision: { mode: 'none', bounds: null, parts: [] }, navigation: { effect: 'passable', cost: null }, runtimeEligible: false,
    connectors: [], continuityProfile: null, continuityTags: [], selectionPriority: 0, visualWeight: 'medium', extensions: {} };
}
export function createAssetEditorState(initial) {
  const size = initial.pixelSize;
  if (!positive(size?.width) || !positive(size?.height)) throw new Error('The exact image dimensions are unavailable. Reopen the saved image.');
  const asset = initial.asset; const metadata = copy(asset?.metadata ?? assetEditorDefaultMetadata());
  const fallback = { schemaVersion: 1, coordinateSpace: 'image-pixels', unitsPerPixel: { x: 1 / Math.max(size.width, size.height), y: 1 / Math.max(size.width, size.height) },
    placementBounds: { x: 0, y: 0, width: size.width, height: size.height }, anchor: { x: size.width / 2, y: size.height / 2 }, blockingRegions: [] };
  let spatial = metadata.spatial ? copy(metadata.spatial) : fallback;
  let conversionError = null;
  if (asset && !metadata.spatial) { try { spatial = spatialFromLegacyAsset({ ...asset, sliceBinding: { ...asset.sliceBinding, width: size.width, height: size.height } }); } catch (error) { conversionError = error.message; } }
  const model = { name: asset?.name ?? initial.slice?.rectangle?.name ?? '', kind: asset?.kind ?? 'prop', metadata, spatial, geometryEnabled: !asset || Boolean(metadata.spatial) };
  return { instanceId: initial.instanceId ?? crypto.randomUUID(), context: copy({ projectId: initial.projectId, projectRevision: initial.projectRevision,
    assetId: asset?.assetId ?? initial.assetId ?? `asset.human.${crypto.randomUUID()}`, assetVersion: asset?.assetVersion ?? 0, metadataVersion: asset?.metadataVersion ?? 0,
    sliceId: initial.slice?.sliceId ?? asset?.sliceBinding?.sliceId, sliceVersion: initial.slice?.version ?? asset?.sliceBinding?.sliceVersion }),
    initial: copy(initial), model, conversionError, savedModel: copy(model), history: { past: [], future: [] }, polygonDraft: [], selectedRegionId: spatial.blockingRegions[0]?.regionId ?? null, selectedPoint: null,
    tool: 'select', panel: 'blocking', view: 'edit', viewGeneration: 0, zoom: 'fit', grid: { show: false, snap: false, step: 25 }, visibility: { image: true, bounds: true, anchor: true },
    gridOpen: false, error: null, conflict: null, save: { status: 'idle', intent: null }, gesture: null, fieldDrafts: {}, viewContexts: {} };
}
export function assetEditorSnapshot(state) { return copy({ model: state.model, polygonDraft: state.polygonDraft, selectedRegionId: state.selectedRegionId, selectedPoint: state.selectedPoint }); }
export function assetEditorRemember(state, before) {
  const after = assetEditorSnapshot(state); if (same(before, after)) return false;
  state.history.past.push(before); if (state.history.past.length > 50) state.history.past.shift(); state.history.future = []; state.error = null; return true;
}
export function assetEditorRestore(state, snapshot) { Object.assign(state, copy(snapshot)); state.fieldDrafts = {}; state.error = null; }
export function assetEditorUndo(state, redo = false) {
  const from = redo ? state.history.future : state.history.past; const to = redo ? state.history.past : state.history.future;
  if (!from.length) return false; to.push(assetEditorSnapshot(state)); assetEditorRestore(state, from.pop()); return true;
}
export function assetEditorDirty(state) { return !same(state.model, state.savedModel) || state.polygonDraft.length > 0 || Object.keys(state.fieldDrafts).length > 0; }
export function assetEditorInvalidNumericField(state) { return Object.entries(state.fieldDrafts).find(([, value]) => value.trim() === '' || !Number.isFinite(Number(value)))?.[0] ?? null; }
export function selectedAssetRegion(state) { return state.model.spatial.blockingRegions.find(r => r.regionId === state.selectedRegionId) ?? null; }
export function assetEditorIssues(state) {
  const messages = [];
  if (typeof state.model.name !== 'string' || !state.model.name.trim() || state.model.name.trim().length > 160) messages.push('Give the Asset a name of 1–160 characters.');
  if (state.polygonDraft.length) messages.push('Close the unfinished polygon, or press Escape to cancel its outline.');
  if (Object.values(state.fieldDrafts).some(value => value.trim() === '' || !Number.isFinite(Number(value)))) messages.push('Complete the numeric value before saving.');
  if (state.model.geometryEnabled) {
    try {
      const spatial = normalizeAssetSpatial(state.model.spatial);
      for (const finding of spatialMetadataFindings(spatial, { kind: state.model.kind, navigation: state.model.metadata.navigation, extensions: state.model.metadata.extensions })) messages.push(`${finding.explanation} ${finding.remediation}`);
    } catch (error) { messages.push(error.message); }
  }
  return messages;
}
export function buildAssetEditorSave(state, idempotencyKey) {
  const issues = assetEditorIssues(state); if (issues.length) throw new Error(issues.join(' '));
  const c = state.context; const metadata = copy(state.model.metadata);
  delete metadata.pixelSize; delete metadata.pivot;
  if (state.model.geometryEnabled) { metadata.spatial = normalizeAssetSpatial(state.model.spatial); Object.assign(metadata, spatialAliases(metadata.spatial)); }
  const payload = { expectedRevision: c.projectRevision, idempotencyKey, operation: c.assetVersion ? 'update' : 'create', expectedAssetVersion: c.assetVersion,
    expectedMetadataVersion: c.metadataVersion, name: state.model.name.trim(), kind: state.model.kind, metadata,
    image: c.assetVersion ? { mode: 'retain' } : { mode: 'saved-slice', sliceId: c.sliceId, expectedSliceVersion: c.sliceVersion } };
  return { projectId: c.projectId, assetId: c.assetId, payload, serialized: JSON.stringify(payload) };
}
export function assetEditorContextConflict(state, current) {
  if (current.projectId !== state.context.projectId) return 'The selected project changed. Return to this project before saving.';
  if (current.projectRevision !== state.context.projectRevision) return 'The project changed while you were editing. Recheck the saved version; your draft is retained.';
  if (state.context.assetVersion && (!current.asset || current.asset.assetVersion !== state.context.assetVersion || current.asset.metadataVersion !== state.context.metadataVersion)) return 'The Asset changed while you were editing. Recheck its saved version before saving your draft.';
  if (!state.context.assetVersion && (!current.slice || current.slice.sliceId !== state.context.sliceId || current.slice.version !== state.context.sliceVersion)) return 'The saved image cut changed or is unavailable. This draft will not switch image versions.';
  return null;
}
export function assetEditorBox(shape) { return { x: shape.x, y: shape.y, width: shape.width, height: shape.height }; }
export function assetEditorResizeBox(original, handle, dx, dy, equal = false) {
  let left = original.x, top = original.y, right = left + original.width, bottom = top + original.height;
  if (handle.includes('w')) left = Math.min(right - .1, original.x + dx);
  if (handle.includes('e')) right = Math.max(left + .1, original.x + original.width + dx);
  if (handle.includes('n')) top = Math.min(bottom - .1, original.y + dy);
  if (handle.includes('s')) bottom = Math.max(top + .1, original.y + original.height + dy);
  if (equal) {
    if (handle.length === 2) { const side = Math.max(right - left, bottom - top); left = handle.includes('w') ? original.x + original.width - side : original.x; top = handle.includes('n') ? original.y + original.height - side : original.y; right = left + side; bottom = top + side; }
    else if (handle === 'e' || handle === 'w') { const side = right - left; top = original.y + original.height / 2 - side / 2; bottom = top + side; }
    else { const side = bottom - top; left = original.x + original.width / 2 - side / 2; right = left + side; }
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}
export function assetEditorDrawBox(start, end, equal = false) {
  const dx = end.x - start.x, dy = end.y - start.y; let width = Math.max(.1, Math.abs(dx)), height = Math.max(.1, Math.abs(dy));
  if (equal) width = height = Math.max(width, height);
  return { x: dx < 0 ? start.x - width : start.x, y: dy < 0 ? start.y - height : start.y, width, height };
}
export function assetEditorNearestEdge(points, point) {
  let best = null;
  points.forEach((a, index) => { const b = points[(index + 1) % points.length], dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
    if (!length) return; const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length));
    const projected = { x: a.x + t * dx, y: a.y + t * dy }; const distance = Math.hypot(point.x - projected.x, point.y - projected.y);
    if (!best || distance < best.distance) best = { index, t, point: projected, distance };
  }); return best;
}
export function assetEditorSnap(point, grid, altKey = false) {
  const step = grid.snap && !altKey && positive(grid.step) ? grid.step : 1;
  return { x: Math.round(point.x / step) * step, y: Math.round(point.y / step) * step };
}
