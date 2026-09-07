// Browser-only form state. The existing server owns metadata and slice binding.
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const CONTEXT_FIELDS = ['projectId', 'projectRevision', 'sliceId', 'sliceVersion', 'proposalId', 'itemId', 'assetId', 'idempotencyKey'];

function fail(message) { throw new Error(message); }

function contextValue(value, { updating = false } = {}) {
  const fields = updating ? [...CONTEXT_FIELDS, 'assetVersion', 'metadataVersion'] : CONTEXT_FIELDS;
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).some((key) => !fields.includes(key))) fail('The saved slice context is invalid. Reopen its Asset form.');
  const context = {};
  for (const field of fields) {
    const candidate = value[field];
    if (['projectRevision', 'sliceVersion', 'assetVersion', 'metadataVersion'].includes(field)) {
      if (!Number.isSafeInteger(candidate) || candidate < 1) fail(`${field} must identify an exact saved version.`);
    } else if (typeof candidate !== 'string' || !ID.test(candidate)) fail(`${field} must be a valid stable identifier.`);
    context[field] = candidate;
  }
  return Object.freeze(context);
}

function text(value, label, max) {
  if (typeof value !== 'string') fail(`${label} is required.`);
  const result = value.trim();
  if (!result || result.length > max || /[\u0000-\u001f\u007f]/.test(result)) fail(`${label} must contain 1–${max} readable characters.`);
  return result;
}

function integer(value, label, min, max) {
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) fail(`${label} must be a whole number from ${min} to ${max}.`);
  const result = Number(value.trim());
  if (!Number.isSafeInteger(result) || result < min || result > max) fail(`${label} must be a whole number from ${min} to ${max}.`);
  return result;
}

function choice(value, label, allowed) {
  if (!allowed.includes(value)) fail(`Choose ${label}.`);
  return value;
}

function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

export function createAssetAuthoringDraft(context) {
  return {
    context: contextValue(context),
    values: {
      name: '', kind: 'prop', role: '', width: '1', height: '1', anchorX: '0', anchorY: '0',
      attachment: 'ground', rotationPolicy: 'fixed', wallSafe: 'false', movement: 'blocked',
      visualWeight: 'medium', runtimeEligible: 'false',
    },
  };
}

export function assetMetadataEditingEligibility(asset) {
  const reject = (reason) => ({ eligible: false, reason });
  const binding = asset?.sliceBinding; const metadata = asset?.metadata;
  if (!asset || !ID.test(asset.assetId ?? '') || !['surface', 'prop', 'item'].includes(asset.kind)
      || !Number.isSafeInteger(asset.assetVersion) || asset.assetVersion < 1
      || !Number.isSafeInteger(asset.metadataVersion) || asset.metadataVersion < 1
      || !ID.test(binding?.sliceId ?? '') || !Number.isSafeInteger(binding?.sliceVersion) || binding.sliceVersion < 1
      || binding?.mediaType !== 'image/png' || !ID.test(binding?.sourceId ?? '') || !ID.test(binding?.atlasId ?? '')) {
    return reject('This editor requires a versioned Asset with an exact saved image slice. Legacy and processing-result Assets use their own workflows.');
  }
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return reject('The saved metadata is unavailable.');
  const span = metadata.spanTiles; const anchor = metadata.anchor;
  if (!span || !Number.isInteger(span.width) || !Number.isInteger(span.height)
      || span.width < 1 || span.width > 64 || span.height < 1 || span.height > 64
      || !anchor || !Number.isInteger(anchor.x) || !Number.isInteger(anchor.y)
      || anchor.x < 0 || anchor.y < 0 || anchor.x >= span.width || anchor.y >= span.height) {
    return reject('This manual editor requires a saved footprint and reference cell.');
  }
  if (!Array.isArray(metadata.placement?.modes) || metadata.placement.modes.length !== 1 || metadata.placement.modes[0] !== 'manual') {
    return reject('This editor preserves manual-placement Assets only. Other placement profiles are not simplified automatically.');
  }
  const collision = metadata.collision; const navigation = metadata.navigation;
  const walkThrough = collision?.mode === 'none' && collision.bounds === null
    && Array.isArray(collision.parts) && collision.parts.length === 0
    && navigation?.effect === 'passable' && navigation.cost === null;
  const blocker = collision?.mode === 'bounds' && collision.bounds?.x === 0 && collision.bounds?.y === 0
    && collision.bounds.width === span.width && collision.bounds.height === span.height
    && Array.isArray(collision.parts) && collision.parts.length === 0
    && navigation?.effect === 'blocked' && navigation.cost === null;
  if (!walkThrough && !blocker) return reject('Custom collision or movement costs need their own editor. These settings will not be flattened into a simple blocker.');
  return { eligible: true, reason: null };
}

export function createAssetMetadataDraft({ projectId, projectRevision, asset, proposalId, itemId, idempotencyKey }) {
  const eligibility = assetMetadataEditingEligibility(asset);
  if (!eligibility.eligible) fail(eligibility.reason);
  const baselineAsset = freeze(structuredClone(asset)); const metadata = baselineAsset.metadata;
  const context = contextValue({ projectId, projectRevision, proposalId, itemId, idempotencyKey,
    assetId: asset.assetId, sliceId: asset.sliceBinding.sliceId, sliceVersion: asset.sliceBinding.sliceVersion,
    assetVersion: asset.assetVersion, metadataVersion: asset.metadataVersion }, { updating: true });
  const string = (value) => value === null || value === undefined ? '' : String(value);
  return { mode: 'update', context, baselineAsset, values: {
    name: string(asset.name), kind: asset.kind, role: string(metadata.role),
    width: string(metadata.spanTiles.width), height: string(metadata.spanTiles.height),
    anchorX: string(metadata.anchor.x), anchorY: string(metadata.anchor.y), attachment: string(metadata.attachment),
    rotationPolicy: string(metadata.rotationPolicy), wallSafe: string(metadata.placement.wallSafe),
    movement: metadata.navigation.effect, visualWeight: string(metadata.visualWeight), runtimeEligible: string(metadata.runtimeEligible),
  } };
}

export function buildAssetAuthoringRequest(draft) {
  if (draft?.mode !== undefined && !['create', 'update'].includes(draft.mode)) fail('The Asset proposal mode is invalid.');
  const updating = draft?.mode === 'update';
  const context = contextValue(draft?.context, { updating });
  const values = draft?.values;
  if (!values || typeof values !== 'object' || Array.isArray(values)) fail('Asset form values are missing.');
  const name = text(values.name, 'Asset name', 160);
  const role = text(values.role, 'Asset role', 64);
  const kind = choice(values.kind, 'an Asset kind', ['surface', 'prop', 'item']);
  if (updating && (draft.baselineAsset?.assetId !== context.assetId || draft.baselineAsset?.kind !== kind
      || draft.baselineAsset.assetVersion !== context.assetVersion || draft.baselineAsset.metadataVersion !== context.metadataVersion
      || draft.baselineAsset.sliceBinding?.sliceId !== context.sliceId || draft.baselineAsset.sliceBinding?.sliceVersion !== context.sliceVersion)) {
    fail('The saved Asset identity, kind or image changed. Reopen its metadata editor.');
  }
  if (updating && !assetMetadataEditingEligibility(draft.baselineAsset).eligible) fail('The original metadata profile is no longer supported by this editor.');
  const width = integer(values.width, 'Footprint width', 1, 64);
  const height = integer(values.height, 'Footprint height', 1, 64);
  const anchor = { x: integer(values.anchorX, 'Anchor X', 0, width - 1), y: integer(values.anchorY, 'Anchor Y', 0, height - 1) };
  const attachment = choice(values.attachment, 'an attachment', ['ground', 'wall', 'ceiling', 'free']);
  if (kind === 'surface' && attachment !== 'ground') fail('Surface Assets must attach to the ground.');
  const rotationPolicy = choice(values.rotationPolicy, 'a rotation policy', ['fixed', 'cardinal']);
  const wallSafe = choice(values.wallSafe, 'boundary suitability', ['true', 'false']) === 'true';
  if (attachment === 'wall' && !wallSafe) fail('Wall-attached Assets must be allowed to touch a room boundary. Choose “May touch a boundary” or another attachment.');
  const movement = choice(values.movement, 'movement behavior', ['passable', 'blocked']);
  const visualWeight = choice(values.visualWeight, 'visual weight', ['light', 'medium', 'heavy']);
  const runtimeEligible = choice(values.runtimeEligible, 'runtime eligibility', ['true', 'false']) === 'true';
  let metadata = {
    role, tags: [], variantGroup: null, compatibilityGroups: [], spanTiles: { width, height }, anchor,
    attachment, rotationPolicy, placement: { modes: ['manual'], wallSafe, tags: [], confirmation: 'proposed' },
    collision: movement === 'passable' ? { mode: 'none', bounds: null, parts: [] }
      : { mode: 'bounds', bounds: { x: 0, y: 0, width, height }, parts: [] },
    navigation: { effect: movement, cost: null }, runtimeEligible,
    connectors: [], continuityProfile: null, continuityTags: [], selectionPriority: 0, visualWeight, extensions: {},
  };
  if (updating) {
    const preserved = structuredClone(draft.baselineAsset.metadata);
    delete preserved.pixelSize; delete preserved.pivot;
    for (const field of ['role', 'spanTiles', 'anchor', 'attachment', 'rotationPolicy', 'collision', 'navigation', 'runtimeEligible', 'visualWeight']) {
      preserved[field] = metadata[field];
    }
    preserved.placement = { ...preserved.placement, wallSafe };
    metadata = preserved;
  }
  return freeze({
    expectedRevision: context.projectRevision,
    idempotencyKey: context.idempotencyKey,
    proposalId: context.proposalId,
    items: [{ itemId: context.itemId, operation: updating ? 'update' : 'create', assetId: context.assetId,
      expectedAssetVersion: updating ? context.assetVersion : 0, expectedMetadataVersion: updating ? context.metadataVersion : 0, sliceId: context.sliceId,
      expectedSliceVersion: context.sliceVersion, name, kind, metadata }],
  });
}

export function assetAuthoringConflict(draft, current) {
  let context;
  try { context = contextValue(draft?.context, { updating: draft?.mode === 'update' }); } catch (error) { return error.message; }
  if (current?.projectId !== context.projectId) return 'The active project changed. Return to the original project before submitting this Asset proposal.';
  if (current.projectRevision !== context.projectRevision) return 'The project changed since this Asset form opened. Reload the saved slice before preparing a new proposal.';
  const matches = Array.isArray(current.slices) ? current.slices.filter((slice) => slice?.sliceId === context.sliceId) : [];
  if (matches.length !== 1 || matches[0].version !== context.sliceVersion) return 'The saved slice changed or is unavailable. Reload it; this form will not substitute another image version.';
  if (draft?.mode === 'update') {
    const assets = Array.isArray(current.assets) ? current.assets.filter((asset) => asset?.assetId === context.assetId) : [];
    const asset = assets[0];
    if (assets.length !== 1 || asset.assetVersion !== context.assetVersion || asset.metadataVersion !== context.metadataVersion
        || asset.kind !== draft.baselineAsset.kind || asset.sliceBinding?.sliceId !== context.sliceId
        || asset.sliceBinding?.sliceVersion !== context.sliceVersion) {
      return 'The saved Asset changed or is unavailable. Deliberately reload its current metadata before preparing a revision.';
    }
  }
  return null;
}
