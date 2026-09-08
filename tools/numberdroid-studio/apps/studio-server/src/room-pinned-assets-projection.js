import { ASSET_KINDS, ASSET_LIFECYCLES, StudioError, validateAssetMetadata, validateExactSliceBinding } from '../../../packages/domain/src/index.js';
import { requireEnum, requireId, requireInteger, requireString } from '../../../packages/domain/src/validation.js';
import { createRoomPreviewScene } from '../../../packages/preview/src/room-preview-scene.js';

function assert(condition, message) {
  if (!condition) throw new StudioError('ROOM_PINNED_ASSETS_INVALID', message);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

export function roomPinnedAssetsHttpProjection(source, expected) {
  assert(source?.schemaVersion === 1 && source.projectId === expected.projectId
    && source.projectRevision === expected.projectRevision
    && source.room?.roomVariantId === expected.roomVariantId && source.room.version === expected.roomVersion,
  'The pinned Asset source does not match the requested Room context.');
  // Reuse the existing same-project, exact-version, geometry and artifact checks.
  createRoomPreviewScene(source);
  const key = (entry) => `${entry.assetId}@${entry.assetVersion}:${entry.metadataVersion}`;
  const used = new Set(source.room.placements.map(key));
  assert(Array.isArray(source.assets) && source.assets.length === used.size && source.assets.length <= 256,
    'The projection must contain exactly the bounded set of placed Asset versions.');
  const seen = new Set();
  const assets = source.assets.map((asset) => {
    const identity = key(asset);
    assert(used.has(identity) && !seen.has(identity), 'An unused or duplicate Asset version cannot enter this projection.');
    seen.add(identity);
    assert(asset.projectId === undefined || asset.projectId === expected.projectId, 'The Asset belongs to another project.');
    const assetId = requireId(asset.assetId, 'asset.assetId');
    const assetVersion = requireInteger(asset.assetVersion, 'asset.assetVersion', { min: 1 });
    const metadataVersion = requireInteger(asset.metadataVersion, 'asset.metadataVersion', { min: 1 });
    const name = requireString(asset.name, 'asset.name', { max: 160 });
    const kind = requireEnum(asset.kind, 'asset.kind', ASSET_KINDS);
    const lifecycle = requireEnum(asset.lifecycle, 'asset.lifecycle', ASSET_LIFECYCLES);
    const sliceBinding = validateExactSliceBinding(asset.sliceBinding);
    assert(sliceBinding.projectId === expected.projectId, 'The image binding belongs to another project.');
    const authored = structuredClone(asset.metadata);
    delete authored.pixelSize; delete authored.pivot;
    const validated = validateAssetMetadata({ assetId, kind, metadata: authored, sliceBinding });
    assert(JSON.stringify(canonical(validated.metadata)) === JSON.stringify(canonical(asset.metadata)),
      'The saved Asset metadata does not match its exact image facts.');
    return {
      assetId, assetVersion, metadataVersion, name, kind, lifecycle,
      metadata: structuredClone(validated.metadata), sliceBinding: structuredClone(sliceBinding),
      findings: structuredClone(validated.findings),
      preview: { schemaVersion: 1, state: 'READY',
        resourceUri: `/api/projects/${encodeURIComponent(expected.projectId)}/artifacts/sha256/${sliceBinding.digest}`,
        alt: `${name} preview` },
    };
  }).sort((left, right) => key(left).localeCompare(key(right)));
  return { schemaVersion: 1, kind: 'room-pinned-assets',
    projectId: expected.projectId, projectRevision: expected.projectRevision,
    roomVariantId: expected.roomVariantId, roomVersion: expected.roomVersion, assets };
}
