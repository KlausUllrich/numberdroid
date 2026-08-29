export function unavailableProcessingAdoptionProjection(projectId, taskId) {
  return { schemaVersion: 1, projectId, taskId, availability: 'UNAVAILABLE', adoptions: [] };
}

export function processingAdoptionSelectionOwned(owner, current) {
  return Number.isSafeInteger(owner?.generation)
    && Number.isSafeInteger(current?.generation)
    && owner.generation === current.generation
    && owner.projectId === current.projectId
    && owner.taskId === current.taskId;
}

function validGuidance(item, { correction = false } = {}) {
  return item && typeof item === 'object'
    && (!correction || typeof item.label === 'string')
    && typeof item.explanation === 'string'
    && typeof item.remediation === 'string';
}

function isCanonicalInstant(value) {
  if (typeof value !== 'string') return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

export function processingAdoptionPreviewPath(adoption, projectId, taskId) {
  const preview = adoption?.asset?.preview;
  if (!Number.isSafeInteger(adoption?.branchRevision) || adoption.branchRevision < 2
      || !preview || preview.state !== 'READY' || preview.mediaType !== 'image/png'
      || !Number.isSafeInteger(preview.width) || preview.width < 1
      || !Number.isSafeInteger(preview.height) || preview.height < 1) return null;
  const expected = `/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`
    + `/processing-result-adoptions/${adoption.branchRevision}/selected-output`;
  return preview.resourceUri === expected ? expected : null;
}

export function normalizeProcessingAdoptionProjection(value, projectId, taskId) {
  const unavailable = unavailableProcessingAdoptionProjection(projectId, taskId);
  if (!value || typeof value !== 'object'
      || value.schemaVersion !== 1
      || value.projectId !== projectId
      || value.taskId !== taskId
      || value.availability !== 'AVAILABLE'
      || !Array.isArray(value.adoptions)) return unavailable;
  let previousRevision = 1;
  for (const adoption of value.adoptions) {
    const asset = adoption?.asset;
    const preview = asset?.preview;
    const quality = adoption?.quality;
    const validPreview = preview && ['READY', 'UNAVAILABLE'].includes(preview.state)
      && preview.mediaType === 'image/png'
      && Number.isSafeInteger(preview.width) && preview.width > 0
      && Number.isSafeInteger(preview.height) && preview.height > 0
      && typeof preview.alt === 'string' && preview.alt.trim().length > 0
      && (preview.state === 'READY'
        ? processingAdoptionPreviewPath(adoption, projectId, taskId) !== null
        : preview.resourceUri === null);
    if (!adoption || typeof adoption !== 'object'
        || !Number.isSafeInteger(adoption.branchRevision) || adoption.branchRevision <= previousRevision
        || !isCanonicalInstant(adoption.committedAt)
        || !['create', 'update'].includes(adoption.operation)
        || adoption.displayState !== 'WAITING_FOR_YOUR_REVIEW'
        || !asset || typeof asset.assetId !== 'string' || typeof asset.name !== 'string'
        || typeof asset.kind !== 'string' || asset.lifecycle !== 'DRAFT'
        || !Number.isSafeInteger(asset.assetVersion) || asset.assetVersion < 1
        || !Number.isSafeInteger(asset.metadataVersion) || asset.metadataVersion < 1
        || !asset.pixelSize || asset.pixelSize.width !== preview?.width || asset.pixelSize.height !== preview?.height
        || !validPreview
        || !quality || typeof quality.correctionRequired !== 'boolean'
        || !Array.isArray(quality.correctionItems) || !Array.isArray(quality.unresolvedWarnings)
        || quality.correctionRequired !== (quality.correctionItems.length > 0)
        || !quality.correctionItems.every((item) => validGuidance(item, { correction: true }))
        || !quality.unresolvedWarnings.every((item) => validGuidance(item))) return unavailable;
    previousRevision = adoption.branchRevision;
  }
  return value;
}

function relevantAttempts(activity, projectId, taskId, { after = null } = {}) {
  if (!Array.isArray(activity)) return [];
  return activity
    .filter((event) => event?.projectId === projectId
      && event.taskId === taskId
      && event.commandType === 'asset.processing-result.adopt'
      && ['denied', 'failed'].includes(event.status)
      && typeof event.id === 'string' && event.id.length > 0
      && event.actor?.kind === 'agent'
      && isCanonicalInstant(event.occurredAt)
      && (after === null || event.occurredAt > after))
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt)
      || String(left.id).localeCompare(String(right.id)));
}

export function processingAdoptionPresentation({
  projection,
  activity = [],
  projectId,
  taskId,
  previewLoadFailed = false,
}) {
  if (projection?.availability !== 'AVAILABLE' || !Array.isArray(projection.adoptions)) {
    return { state: 'PROJECTION_UNAVAILABLE', adoption: null, attempt: null, laterAttempt: null, substates: [] };
  }
  if (projection.adoptions.length > 0) {
    const adoption = projection.adoptions.at(-1);
    const substates = [];
    if (adoption.quality.correctionRequired) substates.push('CORRECTION_REQUIRED');
    if (adoption.quality.unresolvedWarnings.length) substates.push('WARNINGS_UNRESOLVED');
    if (adoption.asset.preview.state !== 'READY' || previewLoadFailed) substates.push('PREVIEW_UNAVAILABLE');
    return {
      state: 'WAITING_FOR_YOUR_REVIEW',
      adoption,
      attempt: null,
      laterAttempt: relevantAttempts(activity, projectId, taskId, { after: adoption.committedAt }).at(-1) ?? null,
      substates,
    };
  }
  const attempt = relevantAttempts(activity, projectId, taskId).at(-1) ?? null;
  return {
    state: attempt ? `ATTEMPT_${attempt.status.toUpperCase()}` : 'NO_DRAFT',
    adoption: null,
    attempt,
    laterAttempt: null,
    substates: [],
  };
}
