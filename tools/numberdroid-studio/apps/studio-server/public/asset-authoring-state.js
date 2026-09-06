// Browser-only form state. The existing server owns metadata and slice binding.
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const CONTEXT_FIELDS = ['projectId', 'projectRevision', 'sliceId', 'sliceVersion', 'proposalId', 'itemId', 'assetId', 'idempotencyKey'];

function fail(message) { throw new Error(message); }

function contextValue(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).some((key) => !CONTEXT_FIELDS.includes(key))) fail('The saved slice context is invalid. Reopen its Asset form.');
  const context = {};
  for (const field of CONTEXT_FIELDS) {
    const candidate = value[field];
    if (['projectRevision', 'sliceVersion'].includes(field)) {
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

export function buildAssetAuthoringRequest(draft) {
  const context = contextValue(draft?.context);
  const values = draft?.values;
  if (!values || typeof values !== 'object' || Array.isArray(values)) fail('Asset form values are missing.');
  const name = text(values.name, 'Asset name', 160);
  const role = text(values.role, 'Asset role', 64);
  const kind = choice(values.kind, 'an Asset kind', ['surface', 'prop', 'item']);
  const width = integer(values.width, 'Footprint width', 1, 64);
  const height = integer(values.height, 'Footprint height', 1, 64);
  const anchor = { x: integer(values.anchorX, 'Anchor X', 0, width - 1), y: integer(values.anchorY, 'Anchor Y', 0, height - 1) };
  const attachment = choice(values.attachment, 'an attachment', ['ground', 'wall', 'ceiling', 'free']);
  if (kind === 'surface' && attachment !== 'ground') fail('Surface Assets must attach to the ground.');
  const rotationPolicy = choice(values.rotationPolicy, 'a rotation policy', ['fixed', 'cardinal']);
  const wallSafe = choice(values.wallSafe, 'boundary suitability', ['true', 'false']) === 'true';
  const movement = choice(values.movement, 'movement behavior', ['passable', 'blocked']);
  const visualWeight = choice(values.visualWeight, 'visual weight', ['light', 'medium', 'heavy']);
  const runtimeEligible = choice(values.runtimeEligible, 'runtime eligibility', ['true', 'false']) === 'true';
  const metadata = {
    role, tags: [], variantGroup: null, compatibilityGroups: [], spanTiles: { width, height }, anchor,
    attachment, rotationPolicy, placement: { modes: ['manual'], wallSafe, tags: [], confirmation: 'proposed' },
    collision: movement === 'passable' ? { mode: 'none', bounds: null, parts: [] }
      : { mode: 'bounds', bounds: { x: 0, y: 0, width, height }, parts: [] },
    navigation: { effect: movement, cost: null }, runtimeEligible,
    connectors: [], continuityProfile: null, continuityTags: [], selectionPriority: 0, visualWeight, extensions: {},
  };
  return freeze({
    expectedRevision: context.projectRevision,
    idempotencyKey: context.idempotencyKey,
    proposalId: context.proposalId,
    items: [{ itemId: context.itemId, operation: 'create', assetId: context.assetId,
      expectedAssetVersion: 0, expectedMetadataVersion: 0, sliceId: context.sliceId,
      expectedSliceVersion: context.sliceVersion, name, kind, metadata }],
  });
}

export function assetAuthoringConflict(draft, current) {
  let context;
  try { context = contextValue(draft?.context); } catch (error) { return error.message; }
  if (current?.projectId !== context.projectId) return 'The active project changed. Return to the original project before submitting this Asset proposal.';
  if (current.projectRevision !== context.projectRevision) return 'The project changed since this Asset form opened. Reload the saved slice before preparing a new proposal.';
  const matches = Array.isArray(current.slices) ? current.slices.filter((slice) => slice?.sliceId === context.sliceId) : [];
  if (matches.length !== 1 || matches[0].version !== context.sliceVersion) return 'The saved slice changed or is unavailable. Reload it; this form will not substitute another image version.';
  return null;
}
