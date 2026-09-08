const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const positive = (value) => Number.isSafeInteger(value) && value > 0;
const fail = () => { throw new Error('The exact saved Room Asset data is unavailable or does not match this Room.'); };
export function roomAssetPinKey(asset) {
  if (!ID.test(asset?.assetId ?? '') || !positive(asset.assetVersion) || !positive(asset.metadataVersion)) fail();
  return `${asset.assetId}:${asset.assetVersion}:${asset.metadataVersion}`;
}
export function roomPinnedAssetsContext(projectId, projectRevision, variant) {
  if (!ID.test(projectId ?? '') || !positive(projectRevision) || !ID.test(variant?.roomVariantId ?? '') || !positive(variant.version)) fail();
  return Object.freeze({ projectId, projectRevision, roomVariantId: variant.roomVariantId, roomVersion: variant.version });
}
export function roomPinnedAssetsKey(context) {
  return JSON.stringify([context.projectId, context.projectRevision, context.roomVariantId, context.roomVersion]);
}
export function roomPinnedAssetsPath(context) {
  return `/api/projects/${encodeURIComponent(context.projectId)}/revisions/${context.projectRevision}/room-variants/${encodeURIComponent(context.roomVariantId)}/versions/${context.roomVersion}/pinned-assets`;
}
export function normalizeRoomPinnedAssets(value, context, placements) {
  if (!value || value.schemaVersion !== 1 || value.kind !== 'room-pinned-assets'
      || Object.keys(value).some((key) => !['schemaVersion', 'kind', 'projectId', 'projectRevision', 'roomVariantId', 'roomVersion', 'assets'].includes(key))
      || ['projectId', 'projectRevision', 'roomVariantId', 'roomVersion'].some((key) => value[key] !== context[key]) || !Array.isArray(value.assets)) fail();
  const expected = new Set(placements.map(roomAssetPinKey)); const seen = new Set();
  if (value.assets.length !== expected.size) fail();
  const assets = value.assets.map((asset) => {
    const key = roomAssetPinKey(asset); const span = asset.metadata?.spanTiles; const binding = asset.sliceBinding;
    if (Object.keys(asset).some((field) => !['assetId', 'assetVersion', 'metadataVersion', 'name', 'kind', 'lifecycle', 'metadata', 'sliceBinding', 'preview', 'findings'].includes(field))
        || !expected.has(key) || seen.has(key) || !['surface', 'prop', 'item'].includes(asset.kind)
        || typeof asset.name !== 'string' || !asset.name.trim() || asset.name.length > 160
        || !['DRAFT', 'METADATA_COMPLETE', 'VALIDATED', 'FINAL'].includes(asset.lifecycle)
        || !positive(span?.width) || !positive(span?.height) || span.width > 64 || span.height > 64
        || binding?.projectId !== context.projectId || !/^[a-f0-9]{64}$/.test(binding.digest ?? '')
        || !Array.isArray(asset.findings)
        || asset.preview?.schemaVersion !== 1 || asset.preview.state !== 'READY'
        || asset.preview.resourceUri !== `/api/projects/${encodeURIComponent(context.projectId)}/artifacts/sha256/${binding.digest}`) fail();
    seen.add(key); return structuredClone(asset);
  });
  return Object.freeze(assets);
}
