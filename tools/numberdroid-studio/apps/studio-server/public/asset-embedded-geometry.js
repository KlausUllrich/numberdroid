import { normalizeAssemblyRegions, assemblyShapeContained, assemblyShapeBounds, ASSEMBLY_IDENTITY_MATRIX } from '../../../packages/domain/src/assembly-geometry.js';
import { normalizeAssetSpatial } from '../../../packages/domain/src/asset-spatial-geometry.js';

export const isEmbeddedGeometry = state => state.initial?.mode === 'assembly-geometry';
export function resumeEmbeddedGeometry(state, initial, retained) {
  if (retained.context?.projectId !== initial.projectId || retained.context?.assetId !== initial.assetId) throw new Error('The retained geometry belongs to another Assembly.');
  const current = initial.geometry.spatial;
  const changes = [];
  for (const property of ['placementBounds', 'anchor', 'unitsPerPixel']) {
    for (const [axis, value] of Object.entries(current[property])) {
      if (retained.model.spatial[property][axis] !== value) changes.push({ property, axis, value });
    }
  }
  Object.assign(state, structuredClone(retained), { initial: structuredClone({ ...initial, pixelSize: initial.planeSize }), gesture: null });
  // The parent may change its placement settings between visits. Rebase those
  // exact fields throughout retained Undo/Redo so old geometry history cannot
  // undo a later parent edit. Region edits, unfinished input and view stay local.
  for (const model of [state.model, state.savedModel, ...state.history.past.map(entry => entry.model), ...state.history.future.map(entry => entry.model)]) {
    for (const { property, axis, value } of changes) model.spatial[property][axis] = value;
  }
  state.model.name = initial.title;
  state.context.projectRevision = initial.projectRevision;
  return state;
}
export const embeddedRegion = (state, region) => ({ ...region, transform: state.model.regionTransforms?.[region.regionId] ?? [...ASSEMBLY_IDENTITY_MATRIX] });
export function embeddedRegions(state) { return state.model.spatial.blockingRegions.map(region => embeddedRegion(state, region)); }
export function embeddedGeometryIssues(state) {
  const messages = [];
  if (state.polygonDraft.length) messages.push('An unfinished polygon is retained. Close it or cancel its outline before saving the Assembly.');
  if (Object.values(state.fieldDrafts).some(value => value.trim() === '' || !Number.isFinite(Number(value)))) messages.push('Complete the retained numeric value before saving the Assembly.');
  try {
    const spatial = state.model.spatial;
    normalizeAssetSpatial({ ...spatial, blockingRegions: [] });
    if (spatial.unitsPerPixel.x !== spatial.unitsPerPixel.y) messages.push('Assembly scale uses the same project units per pixel on both axes.');
    for (const region of normalizeAssemblyRegions(embeddedRegions(state))) {
      if (!assemblyShapeContained(region, spatial.placementBounds)) messages.push(`Blocking region “${region.name}” exceeds the Assembly placement bounds. Enlarge the bounds or adjust the region.`);
    }
  } catch (error) { messages.push(error.message); }
  return messages;
}
export function embeddedGeometryResult(state) {
  return { regions: structuredClone(embeddedRegions(state)), session: structuredClone(state), issues: embeddedGeometryIssues(state),
    assembly: { placementBounds: structuredClone(state.model.spatial.placementBounds), anchor: structuredClone(state.model.spatial.anchor), unitsPerPixel: state.model.spatial.unitsPerPixel.x } };
}
export function embeddedFramePoints(state) {
  const points = [];
  const image = state.initial.artworkScene?.visualBounds;
  if (image) points.push({ x: image.x, y: image.y }, { x: image.x + image.width, y: image.y + image.height });
  for (const region of embeddedRegions(state)) {
    try { const bounds = assemblyShapeBounds(region); points.push({ x: bounds.x, y: bounds.y }, { x: bounds.x + bounds.width, y: bounds.y + bounds.height }); } catch {}
  }
  return points;
}
