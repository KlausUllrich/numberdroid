import { invariant } from '../../domain/src/errors.js';
import { requireId, requireInteger, requireRecord, requireString } from '../../domain/src/validation.js';
import { validateAtlasRectangles, canonicalRgbaPngByteSize, ATLAS_PROCESSOR_ID } from '../../domain/src/atlas-definition.js';
import { validateExactSliceBinding } from '../../domain/src/asset-definition.js';
import { fingerprint } from './value-utils.js';
import { resolveHistoricalSliceBinding } from './exact-cut-history.js';

const commonFields = ['sliceId', 'expectedSliceVersion', 'expectedAtlasVersion', 'jobId'];
function exact(value, fields, label) {
  requireRecord(value, label);
  invariant(Object.keys(value).every(key => fields.includes(key)) && fields.every(key => Object.hasOwn(value, key)),
    'VALIDATION_ERROR', `${label} requires exactly its supported fields.`);
}
function current(snapshot, payload) {
  const matches = (snapshot.atlases ?? []).flatMap(atlas => (atlas.sliceHeads ?? []).filter(slice => slice.sliceId === payload.sliceId).map(slice => ({ atlas, slice })));
  invariant(matches.length === 1, 'SLICE_REVISION_TARGET_MISSING', 'The saved cut must have exactly one current atlas head.', { sliceId: payload.sliceId });
  const { atlas, slice } = matches[0];
  invariant(slice.version === payload.expectedSliceVersion && atlas.definitionVersion === payload.expectedAtlasVersion,
    'ENTITY_VERSION_CONFLICT', 'The cut or its atlas changed. Recheck current versions before revising.', { expectedSliceVersion: payload.expectedSliceVersion,
      actualSliceVersion: slice.version, expectedAtlasVersion: payload.expectedAtlasVersion, actualAtlasVersion: atlas.definitionVersion });
  const source = snapshot.sources.find(candidate => candidate.id === atlas.sourceId);
  invariant(source?.schemaVersion === 2 && source.lifecycle?.state === 'APPROVED_SOURCE' && source.review?.disposition === 'USER_APPROVED',
    'ATLAS_SOURCE_NOT_APPROVED', 'Cut revision requires the original approved source.');
  invariant(source.mediaType === 'image/png' && source.artifactUri === `studio://artifacts/sha256/${atlas.sourceDigest}`
    && source.width === atlas.sourceWidth && source.height === atlas.sourceHeight && atlas.processorId === ATLAS_PROCESSOR_ID,
    'SLICE_REVISION_SOURCE_CHANGED', 'The approved source or deterministic processor changed.');
  return { atlas, slice, source };
}
function assertOrdinaryJob(atlas, job) {
  invariant(!atlas.latestPreviewJobId || (job?.jobId === atlas.latestPreviewJobId && ['APPLIED', 'DISCARDED'].includes(job.state)),
    'JOB_STATE_CONFLICT', 'Apply or discard the ordinary atlas preview before revising this cut.');
}
function definition(atlas) {
  return { definitionVersion: atlas.definitionVersion, definitionFingerprint: atlas.definitionFingerprint,
    rectangleFingerprint: atlas.rectangleFingerprint, rectangles: structuredClone(atlas.rectangles) };
}
function imageMeaning(binding, rectangle = binding.rectangle) {
  return { sourceId: binding.sourceId, sourceDigest: binding.sourceDigest, processorId: binding.processorId,
    x: rectangle.x, y: rectangle.y, width: rectangle.width, height: rectangle.height,
    name: rectangle.name ?? null, pivot: rectangle.pivot, transparentPaddingPolicy: rectangle.transparentPaddingPolicy };
}
export function matchingSliceRevision(document, sourceBinding, rectangle, cutoff) {
  const target = fingerprint(imageMeaning(sourceBinding, rectangle)), seen = new Set();
  for (const revision of document.revisions) {
    if (revision.number > cutoff) continue;
    for (const atlas of revision.snapshot.atlases ?? []) for (const slice of atlas.sliceHeads ?? []) {
      if (slice.sliceId !== sourceBinding.sliceId || seen.has(slice.version)) continue;
      seen.add(slice.version);
      const binding = resolveHistoricalSliceBinding(document, document.projectId, slice.sliceId, slice.version, cutoff);
      if (fingerprint(imageMeaning(binding)) === target) return binding;
    }
  }
  return null;
}
function proposedChange(payload, document, atlas, slice, cutoff) {
  const sourceBinding = resolveHistoricalSliceBinding(document, document.projectId, payload.sliceId, payload.sourceSliceVersion, cutoff);
  invariant(sourceBinding.atlasId === atlas.id && sourceBinding.sourceId === atlas.sourceId && sourceBinding.sourceDigest === atlas.sourceDigest
    && sourceBinding.processorId === atlas.processorId, 'SLICE_REVISION_SOURCE_CHANGED', 'The historical cut belongs to another source or processor.');
  exact(payload.rectangle, ['x', 'y', 'width', 'height'], 'Cut rectangle');
  const rectangle = { rectangleId: slice.rectangleId, ...payload.rectangle, included: true,
    pivot: structuredClone(sourceBinding.rectangle.pivot), transparentPaddingPolicy: sourceBinding.rectangle.transparentPaddingPolicy,
    replacesSliceId: slice.sliceId, expectedSliceVersion: slice.version, name: requireString(payload.name, 'name', { max: 160 }) };
  // Validate the single intended output before considering reuse. Never silently discard pivots/padding.
  const normalized = validateAtlasRectangles([rectangle], { sourceWidth: atlas.sourceWidth, sourceHeight: atlas.sourceHeight }).rectangles[0];
  const reused = matchingSliceRevision(document, sourceBinding, normalized, cutoff);
  if (reused) return { sourceBinding, rectangle: normalized, reused };
  const rectangles = structuredClone(atlas.rectangles);
  const index = rectangles.findIndex(candidate => candidate.rectangleId === slice.rectangleId);
  if (index < 0) rectangles.push(normalized); else rectangles[index] = normalized;
  // Validate the preserved full definition, including overlaps and bounded cut counts.
  const validated = validateAtlasRectangles(rectangles, { sourceWidth: atlas.sourceWidth, sourceHeight: atlas.sourceHeight });
  const proposedDefinition = { definitionVersion: atlas.definitionVersion + 1,
    definitionFingerprint: fingerprint({ schemaVersion: 1, processorId: atlas.processorId, sourceId: atlas.sourceId,
      sourceDigest: atlas.sourceDigest, sourceWidth: atlas.sourceWidth, sourceHeight: atlas.sourceHeight, rectangles: validated.rectangles }),
    rectangleFingerprint: validated.fingerprint, rectangles: validated.rectangles };
  return { sourceBinding, rectangle: normalized, reused: null, proposedDefinition };
}
export function validateSliceRevisionJobInput(input) {
  exact(input, ['schemaVersion', 'kind', 'operation', 'atlasId', 'atlasDefinitionVersion', 'atlasDefinitionFingerprint', 'processorId',
    'sourceId', 'sourceDigest', 'sourceMediaType', 'sourceWidth', 'sourceHeight', 'rectangles', 'revision'], 'Cut job input');
  invariant(input.schemaVersion === 2 && input.kind === 'ATLAS_PREVIEW' && input.operation === 'slice.revision'
    && input.processorId === ATLAS_PROCESSOR_ID && input.sourceMediaType === 'image/png', 'JOB_INPUT_MISMATCH', 'Unsupported cut-revision job input.');
  exact(input.revision, ['sourceSliceVersion', 'sliceId', 'expectedSliceVersion', 'sourceBinding', 'originalDefinition', 'proposedDefinition'], 'Cut job revision');
  const r = input.revision;
  requireId(r.sliceId, 'sliceId'); requireInteger(r.sourceSliceVersion, 'sourceSliceVersion', { min: 1 }); requireInteger(r.expectedSliceVersion, 'expectedSliceVersion', { min: 1 });
  requireId(input.atlasId, 'atlasId'); requireId(input.sourceId, 'sourceId');
  requireInteger(input.atlasDefinitionVersion, 'atlasDefinitionVersion', { min: 1 });
  const binding = validateExactSliceBinding(r.sourceBinding);
  invariant(binding.sliceId === r.sliceId && binding.sliceVersion === r.sourceSliceVersion && binding.atlasId === input.atlasId
    && binding.sourceId === input.sourceId && binding.sourceDigest === input.sourceDigest && binding.processorId === input.processorId,
    'JOB_INPUT_MISMATCH', 'Cut source binding differs from job source.');
  invariant(Array.isArray(input.rectangles) && input.rectangles.length === 1, 'JOB_INPUT_MISMATCH', 'A cut revision must process exactly one rectangle.');
  const one = validateAtlasRectangles(input.rectangles, { sourceWidth: input.sourceWidth, sourceHeight: input.sourceHeight }).rectangles[0];
  invariant(fingerprint([one]) === fingerprint(input.rectangles) && one.replacesSliceId === r.sliceId && one.expectedSliceVersion === r.expectedSliceVersion,
    'JOB_INPUT_MISMATCH', 'Cut job rectangle is not its exact canonical replacement.');
  invariant(fingerprint(one.pivot) === fingerprint(binding.rectangle.pivot) && one.transparentPaddingPolicy === binding.rectangle.transparentPaddingPolicy,
    'JOB_INPUT_MISMATCH', 'Cut revision must retain the pinned pivot and padding policy.');
  for (const def of [r.originalDefinition, r.proposedDefinition]) {
    exact(def, ['definitionVersion', 'definitionFingerprint', 'rectangleFingerprint', 'rectangles'], 'Cut atlas definition');
    const validated = validateAtlasRectangles(def.rectangles, { sourceWidth: input.sourceWidth, sourceHeight: input.sourceHeight });
    invariant(validated.fingerprint === def.rectangleFingerprint && fingerprint(validated.rectangles) === fingerprint(def.rectangles)
      && fingerprint({ schemaVersion: 1, processorId: input.processorId, sourceId: input.sourceId, sourceDigest: input.sourceDigest,
        sourceWidth: input.sourceWidth, sourceHeight: input.sourceHeight, rectangles: def.rectangles }) === def.definitionFingerprint,
      'JOB_INPUT_MISMATCH', 'Cut job atlas definition fingerprints differ.');
  }
  invariant(r.originalDefinition.definitionVersion === input.atlasDefinitionVersion && r.originalDefinition.definitionFingerprint === input.atlasDefinitionFingerprint
    && r.proposedDefinition.definitionVersion === input.atlasDefinitionVersion + 1, 'JOB_INPUT_MISMATCH', 'Cut definition versions are not consecutive.');
  const expected = structuredClone(r.originalDefinition.rectangles), at = expected.findIndex(rect => rect.rectangleId === one.rectangleId);
  if (at < 0) expected.push(one); else expected[at] = one;
  invariant(fingerprint(expected) === fingerprint(r.proposedDefinition.rectangles), 'JOB_INPUT_MISMATCH', 'Cut revision changes unrelated atlas rectangles.');
  invariant(new TextEncoder().encode(JSON.stringify(input)).length <= 256 * 1024, 'JOB_INPUT_MISMATCH', 'Cut revision input exceeds its byte limit.');
  return input;
}
export function applySliceRevisionCommand(command, next, document, now, { atlasJob = null, priorAtlasJob = null } = {}) {
  const payload = command.payload, prepare = command.type === 'slice.revision.prepare';
  invariant(prepare || command.type === 'slice.revision.commit', 'UNKNOWN_COMMAND', 'Unknown cut revision command.');
  exact(payload, prepare ? [...commonFields, 'sourceSliceVersion', 'name', 'rectangle'] : commonFields, 'Cut revision request');
  for (const key of ['sliceId', 'jobId']) requireId(payload[key], key);
  for (const key of ['expectedSliceVersion', 'expectedAtlasVersion']) requireInteger(payload[key], key, { min: 1 });
  const { atlas, slice } = current(next, payload);
  const targetBinding = resolveHistoricalSliceBinding(document, command.projectId, payload.sliceId, payload.expectedSliceVersion, command.baseRevision);
  invariant(targetBinding.digest === slice.digest && targetBinding.sourceDigest === slice.sourceDigest && targetBinding.definitionFingerprint === slice.definitionFingerprint
    && targetBinding.rectangleId === slice.rectangleId && targetBinding.width === slice.width && targetBinding.height === slice.height,
    'SLICE_REVISION_HISTORY_INVALID', 'The current cut head differs from its exact committed lineage.');
  assertOrdinaryJob(atlas, priorAtlasJob);
  if (prepare) {
    requireInteger(payload.sourceSliceVersion, 'sourceSliceVersion', { min: 1 });
    const change = proposedChange(payload, document, atlas, slice, command.baseRevision);
    if (change.reused) return { snapshot: next, result: { status: 'REUSED', sliceBinding: change.reused, jobId: null },
      summary: 'Matching saved cut revision reused; no image processing was needed.', changes: [] };
    const input = validateSliceRevisionJobInput({ schemaVersion: 2, kind: 'ATLAS_PREVIEW', operation: 'slice.revision',
      atlasId: atlas.id, atlasDefinitionVersion: atlas.definitionVersion, atlasDefinitionFingerprint: atlas.definitionFingerprint,
      processorId: atlas.processorId, sourceId: atlas.sourceId, sourceDigest: atlas.sourceDigest, sourceMediaType: atlas.sourceMediaType,
      sourceWidth: atlas.sourceWidth, sourceHeight: atlas.sourceHeight, rectangles: [change.rectangle],
      revision: { sourceSliceVersion: payload.sourceSliceVersion, sliceId: slice.sliceId, expectedSliceVersion: slice.version,
        sourceBinding: change.sourceBinding, originalDefinition: definition(atlas), proposedDefinition: change.proposedDefinition } });
    const outputArtifactBytes = canonicalRgbaPngByteSize(change.rectangle.width, change.rectangle.height);
    if (command.actor.kind === 'agent') {
      const grant = next.grants.find(candidate => candidate.id === command.grantId);
      invariant(grant && grant.usage.jobs + 1 <= grant.budget.maxJobs && grant.usage.artifactBytes + outputArtifactBytes <= grant.budget.maxArtifactBytes,
        'BUDGET_EXCEEDED', 'The cut revision exceeds the grant job or output byte budget.');
      grant.usage.jobs += 1; grant.usage.artifactBytes += outputArtifactBytes;
    }
    const job = { jobId: payload.jobId, projectId: command.projectId, kind: 'ATLAS_PREVIEW', idempotencyKey: command.idempotencyKey,
      inputFingerprint: fingerprint(input), input, outputArtifactBytes, createdAt: now, createdBy: command.actor.id, requestedRevision: command.baseRevision + 1 };
    return { snapshot: next, result: { status: 'ACCEPTED', jobId: job.jobId, jobResource: `studio://projects/${command.projectId}/jobs/${job.jobId}`,
      inputRevisionId: `revision:${command.baseRevision + 1}`, job }, summary: 'One revised cut queued; the saved atlas and Animation remain unchanged.',
      changes: [{ entityType: 'job', entityId: job.jobId, operation: 'queued' }] };
  }
  invariant(atlasJob?.projectId === command.projectId && atlasJob.jobId === payload.jobId && atlasJob.state === 'SUCCEEDED' && atlasJob.appliedRevision === null,
    'JOB_STATE_CONFLICT', 'Commit requires the exact succeeded, unapplied cut-revision job.');
  const input = validateSliceRevisionJobInput(atlasJob.input), r = input.revision;
  invariant(fingerprint(input) === atlasJob.inputFingerprint && input.atlasId === atlas.id && input.atlasDefinitionVersion === atlas.definitionVersion
    && input.atlasDefinitionFingerprint === atlas.definitionFingerprint && r.sliceId === slice.sliceId && r.expectedSliceVersion === slice.version
    && input.sourceDigest === atlas.sourceDigest, 'ENTITY_VERSION_CONFLICT', 'The atlas, source or saved cut changed after this revision was prepared.');
  const owner = command.actor.kind === 'human' && command.actor.id === next.project.ownerId;
  invariant(owner || (command.actor.kind === 'agent' && atlasJob.creator?.actor?.kind === 'agent' && atlasJob.creator.actor.id === command.actor.id
    && atlasJob.creator.taskId === command.taskId && atlasJob.creator.branchId === command.branchId && atlasJob.creator.grantId === command.grantId),
    'JOB_AUTHORITY_MISMATCH', 'Only the originating agent and grant, or project owner, may commit this cut.');
  const sourceBinding = resolveHistoricalSliceBinding(document, command.projectId, r.sliceId, r.sourceSliceVersion, command.baseRevision);
  invariant(fingerprint(sourceBinding) === fingerprint(r.sourceBinding), 'SLICE_REVISION_SOURCE_CHANGED', 'The exact historical cut lineage changed.');
  const rectangle = input.rectangles[0], output = atlasJob.outputs?.[0];
  invariant(atlasJob.outputs?.length === 1 && output?.rectangleId === rectangle.rectangleId && output.mediaType === 'image/png'
    && output.width === rectangle.width && output.height === rectangle.height && output.byteSize === canonicalRgbaPngByteSize(rectangle.width, rectangle.height)
    && /^[a-f0-9]{64}$/.test(output.digest), 'JOB_OUTPUT_MISMATCH', 'The succeeded cut output does not match the exact requested rectangle.');
  const def = r.proposedDefinition;
  const saved = { schemaVersion: 1, sliceId: slice.sliceId, version: slice.version + 1, atlasId: atlas.id, sourceId: atlas.sourceId,
    sourceDigest: atlas.sourceDigest, definitionVersion: def.definitionVersion, definitionFingerprint: def.definitionFingerprint,
    rectangleId: rectangle.rectangleId, rectangle: structuredClone(rectangle), processorId: atlas.processorId, digest: output.digest,
    artifactUri: `studio://artifacts/sha256/${output.digest}`, mediaType: output.mediaType, byteSize: output.byteSize, width: output.width, height: output.height,
    priorDigest: slice.digest, committedAt: now, committedBy: command.actor.id, jobId: atlasJob.jobId };
  const index = next.atlases.findIndex(candidate => candidate.id === atlas.id);
  next.atlases[index] = { ...atlas, ...structuredClone(def), sliceHeads: atlas.sliceHeads.map(candidate => candidate.sliceId === saved.sliceId ? saved : candidate),
    lastCommittedJobId: atlasJob.jobId, updatedAt: now, updatedBy: command.actor.id };
  const { rectangleId: _id, ...exactRectangle } = rectangle;
  const sliceBinding = validateExactSliceBinding({ projectId: command.projectId, sliceId: saved.sliceId, sliceVersion: saved.version, atlasId: saved.atlasId,
    sourceId: saved.sourceId, sourceDigest: saved.sourceDigest, definitionVersion: saved.definitionVersion, definitionFingerprint: saved.definitionFingerprint,
    rectangleId: saved.rectangleId, rectangle: exactRectangle, processorId: saved.processorId, digest: saved.digest, artifactUri: saved.artifactUri,
    mediaType: saved.mediaType, byteSize: saved.byteSize, width: saved.width, height: saved.height, priorDigest: saved.priorDigest, committedRevision: command.baseRevision + 1 });
  return { snapshot: next, result: { status: 'COMMITTED', atlasId: atlas.id, jobId: atlasJob.jobId, sliceBinding,
    slices: [{ sliceId: saved.sliceId, version: saved.version, rectangleId: saved.rectangleId, name: rectangle.name,
      artifactUri: saved.artifactUri, digest: saved.digest, mediaType: saved.mediaType, byteSize: saved.byteSize, width: saved.width, height: saved.height }] },
    summary: 'Revised cut saved; other cuts and saved Animation references remain unchanged.',
    changes: [{ entityType: 'atlas_slice', entityId: saved.sliceId, operation: 'replaced' }] };
}
