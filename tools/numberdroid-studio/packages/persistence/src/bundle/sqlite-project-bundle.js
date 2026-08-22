import { join } from 'node:path';
import { invariant } from '../../../domain/src/errors.js';
import { validateRoomArchetype, validateRoomVariant } from '../../../domain/src/room-definition.js';
import { fingerprint } from '../../../application/src/value-utils.js';
import { ContentAddressedArtifactStore } from '../artifacts/content-addressed-artifact-store.js';
import { verifyWorkspaceIntegrity } from '../integrity/workspace-integrity.js';
import { SqliteProjectStore } from '../sqlite/sqlite-project-store.js';
import {
  PROJECT_BUNDLE_LIMITS,
  createPortableProjectBundle,
  importPortableProjectBundle,
  verifyPortableProjectBundle,
} from './project-bundle.js';

const DIGEST = /^[a-f0-9]{64}$/;
const ARTIFACT_URI = /^studio:\/\/artifacts\/sha256\/([a-f0-9]{64})$/;

function parseJson(value, label) {
  try { return JSON.parse(value); } catch (error) {
    invariant(false, 'BUNDLE_SQLITE_CORRUPT', `${label} is not valid JSON.`, { cause: error.message });
  }
}

function digestFromUri(uri, label) {
  const match = ARTIFACT_URI.exec(uri ?? '');
  invariant(match, 'BUNDLE_SQLITE_CORRUPT', `${label} must be a canonical Studio artifact URI.`);
  return match[1];
}

function artifactUri(digest) {
  invariant(DIGEST.test(digest), 'BUNDLE_SCHEMA_INVALID', 'Artifact digest is invalid.', { digest });
  return `studio://artifacts/sha256/${digest}`;
}

function sorted(values, selector) {
  return [...values].sort((left, right) => selector(left).localeCompare(selector(right)));
}

function portableProvenance(provenance = {}) {
  const { referenceArtifactUris = [], ...semantic } = provenance;
  return {
    ...structuredClone(semantic),
    referenceArtifactDigests: [...new Set(referenceArtifactUris.map((uri, index) => (
      digestFromUri(uri, `source provenance reference ${index}`)
    )))].sort(),
  };
}

function restoredProvenance(provenance = {}) {
  const { referenceArtifactDigests = [], ...semantic } = provenance;
  return {
    ...structuredClone(semantic),
    referenceArtifactUris: referenceArtifactDigests.map(artifactUri),
  };
}

function portableSource(source) {
  return {
    sourceId: source.id,
    schemaVersion: source.schemaVersion ?? 1,
    name: source.name,
    artifactDigest: digestFromUri(source.artifactUri, `source ${source.id}`),
    mediaType: source.mediaType,
    byteSize: source.byteSize ?? null,
    width: source.width,
    height: source.height,
    provenance: portableProvenance(source.provenance),
    lifecycle: source.lifecycle ?? null,
    review: structuredClone(source.review ?? null),
    registeredAt: source.registeredAt,
    registeredBy: source.registeredBy,
  };
}

function restoredSource(source) {
  const restored = {
    schemaVersion: source.schemaVersion,
    id: source.sourceId,
    name: source.name,
    artifactUri: artifactUri(source.artifactDigest),
    mediaType: source.mediaType,
    width: source.width,
    height: source.height,
    provenance: restoredProvenance(source.provenance),
    registeredAt: source.registeredAt,
    registeredBy: source.registeredBy,
  };
  if (source.byteSize !== null) restored.byteSize = source.byteSize;
  if (source.lifecycle !== null) restored.lifecycle = source.lifecycle;
  if (source.review !== null) restored.review = structuredClone(source.review);
  return restored;
}

function portableSlice(slice) {
  return {
    schemaVersion: slice.schemaVersion ?? 1,
    sliceId: slice.sliceId,
    sliceVersion: slice.version,
    atlasId: slice.atlasId,
    sourceId: slice.sourceId,
    sourceDigest: slice.sourceDigest,
    definitionVersion: slice.definitionVersion,
    definitionFingerprint: slice.definitionFingerprint,
    rectangleId: slice.rectangleId,
    rectangle: { rectangleId: slice.rectangleId, ...structuredClone(slice.rectangle) },
    processorId: slice.processorId,
    artifactDigest: slice.digest,
    mediaType: slice.mediaType,
    byteSize: slice.byteSize,
    width: slice.width,
    height: slice.height,
    priorDigest: slice.priorDigest,
    committedAt: slice.committedAt,
    committedBy: slice.committedBy,
    jobId: slice.jobId,
  };
}

function restoredSlice(slice) {
  return {
    schemaVersion: slice.schemaVersion,
    sliceId: slice.sliceId,
    version: slice.sliceVersion,
    atlasId: slice.atlasId,
    sourceId: slice.sourceId,
    sourceDigest: slice.sourceDigest,
    definitionVersion: slice.definitionVersion,
    definitionFingerprint: slice.definitionFingerprint,
    rectangleId: slice.rectangleId,
    rectangle: { rectangleId: slice.rectangleId, ...structuredClone(slice.rectangle) },
    processorId: slice.processorId,
    digest: slice.artifactDigest,
    artifactUri: artifactUri(slice.artifactDigest),
    mediaType: slice.mediaType,
    byteSize: slice.byteSize,
    width: slice.width,
    height: slice.height,
    priorDigest: slice.priorDigest,
    committedAt: slice.committedAt,
    committedBy: slice.committedBy,
    jobId: slice.jobId,
  };
}

function portableAtlas(atlas) {
  return {
    atlasId: atlas.id,
    schemaVersion: atlas.schemaVersion ?? 1,
    name: atlas.name,
    sourceId: atlas.sourceId,
    sourceDigest: atlas.sourceDigest,
    sourceMediaType: atlas.sourceMediaType,
    sourceWidth: atlas.sourceWidth,
    sourceHeight: atlas.sourceHeight,
    processorId: atlas.processorId,
    definitionVersion: atlas.definitionVersion,
    definitionFingerprint: atlas.definitionFingerprint,
    rectangleFingerprint: atlas.rectangleFingerprint,
    rectangles: structuredClone(atlas.rectangles),
    slices: sorted((atlas.sliceHeads ?? []).map(portableSlice), (slice) => `${slice.sliceId}:${String(slice.sliceVersion).padStart(12, '0')}`),
    latestPreviewJobId: atlas.lastCommittedJobId ?? null,
    lastCommittedJobId: atlas.lastCommittedJobId ?? null,
    definedAt: atlas.definedAt,
    definedBy: atlas.definedBy,
    updatedAt: atlas.updatedAt,
    updatedBy: atlas.updatedBy,
  };
}

function restoredAtlas(atlas) {
  return {
    schemaVersion: atlas.schemaVersion,
    id: atlas.atlasId,
    name: atlas.name,
    sourceId: atlas.sourceId,
    sourceDigest: atlas.sourceDigest,
    sourceMediaType: atlas.sourceMediaType,
    sourceWidth: atlas.sourceWidth,
    sourceHeight: atlas.sourceHeight,
    processorId: atlas.processorId,
    definitionVersion: atlas.definitionVersion,
    definitionFingerprint: atlas.definitionFingerprint,
    rectangleFingerprint: atlas.rectangleFingerprint,
    rectangles: structuredClone(atlas.rectangles),
    sliceHeads: atlas.slices.map(restoredSlice),
    latestPreviewJobId: atlas.latestPreviewJobId,
    lastCommittedJobId: atlas.lastCommittedJobId,
    definedAt: atlas.definedAt,
    definedBy: atlas.definedBy,
    updatedAt: atlas.updatedAt,
    updatedBy: atlas.updatedBy,
  };
}

function portableLegacyAsset(asset) {
  return {
    assetId: asset.id,
    name: asset.name,
    sourceId: asset.sourceId,
    kind: asset.kind,
    region: structuredClone(asset.region),
    properties: structuredClone(asset.properties),
    status: asset.status,
    definedAt: asset.definedAt,
    definedBy: asset.definedBy,
  };
}

function restoredLegacyAsset(asset) {
  return { ...structuredClone(asset), id: asset.assetId, assetId: undefined };
}

function cleanUndefined(value) {
  if (Array.isArray(value)) return value.map(cleanUndefined);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .map(([key, child]) => [key, cleanUndefined(child)]));
  }
  return value;
}

function portableExactBinding(binding) {
  const { artifactUri: _artifactUri, digest, ...semantic } = binding;
  return { ...structuredClone(semantic), artifactDigest: digest };
}

function restoredExactBinding(binding) {
  const { artifactDigest, ...semantic } = binding;
  return { ...structuredClone(semantic), digest: artifactDigest, artifactUri: artifactUri(artifactDigest) };
}

function portableAsset(asset) {
  return {
    ...structuredClone(asset),
    sliceBinding: portableExactBinding(asset.sliceBinding),
  };
}

function restoredAsset(asset) {
  return {
    ...structuredClone(asset),
    sliceBinding: restoredExactBinding(asset.sliceBinding),
  };
}

function portableDiff(diff) {
  const value = structuredClone(diff);
  if (value.before?.sliceBinding) value.before.sliceBinding = portableExactBinding(value.before.sliceBinding);
  if (value.after?.sliceBinding) value.after.sliceBinding = portableExactBinding(value.after.sliceBinding);
  return value;
}

function restoredDiff(diff) {
  const value = structuredClone(diff);
  if (value.before?.sliceBinding) value.before.sliceBinding = restoredExactBinding(value.before.sliceBinding);
  if (value.after?.sliceBinding) value.after.sliceBinding = restoredExactBinding(value.after.sliceBinding);
  return value;
}

function portableProposalSnapshot(proposal) {
  return {
    proposalId: proposal.proposalId,
    proposalVersion: proposal.proposalVersion,
    fingerprint: proposal.fingerprint,
    items: proposal.items.map((item) => ({
      ...structuredClone(item),
      sliceBinding: portableExactBinding(item.sliceBinding),
      diff: portableDiff(item.diff),
    })),
    proposer: {
      actor: structuredClone(proposal.proposer.actor),
      taskId: proposal.proposer.taskId ?? null,
    },
    submittedAt: proposal.submittedAt,
    submittedRevision: proposal.submittedRevision,
    decidedAt: proposal.decidedAt,
    decidedBy: proposal.decidedBy,
    decisionRevision: proposal.decisionRevision,
    appliedAt: proposal.appliedAt,
    appliedBy: proposal.appliedBy,
    appliedRevision: proposal.appliedRevision,
  };
}

function restoredProposalSnapshot(proposal) {
  const { proposer, items: _items, ...semantic } = proposal.semantic;
  return {
    ...structuredClone(semantic),
    state: 'APPLIED',
    items: proposal.semantic.items.map((item) => ({
      ...structuredClone(item),
      sliceBinding: restoredExactBinding(item.sliceBinding),
      diff: restoredDiff(item.diff),
    })),
    proposer: {
      ...structuredClone(proposer),
      grantId: null,
      branchId: 'branch.bundle-import',
    },
  };
}

function portableRoomArchetype(archetype) {
  const { provenance: _provenance, ...portable } = structuredClone(archetype);
  return portable;
}

function restoredRoomArchetype(archetype) {
  return { ...structuredClone(archetype), provenance: 'bundle_import' };
}

function portableRoomVersion(version) {
  const { provenance: _provenance, ...portable } = structuredClone(version);
  return portable;
}

function restoredRoomVersion(version) {
  return { ...structuredClone(version), provenance: 'bundle_import' };
}

function portableRoomProposal(proposal) {
  return {
    ...structuredClone(proposal),
    proposer: {
      actor: structuredClone(proposal.proposer.actor),
      taskId: proposal.proposer.taskId ?? null,
    },
  };
}

function restoredRoomProposal(proposal) {
  return {
    ...structuredClone(proposal),
    proposer: {
      ...structuredClone(proposal.proposer),
      branchId: 'branch.bundle-import',
      grantId: null,
    },
  };
}

function portableRoomLibrary(snapshot) {
  const roomLibrary = snapshot.roomLibrary ?? { archetypes: [], variants: [], proposals: [] };
  return {
    archetypes: sorted(roomLibrary.archetypes.map(portableRoomArchetype), (value) => `${value.roomArchetypeId}:${String(value.version).padStart(12, '0')}`),
    variants: sorted(roomLibrary.variants.map((entry) => ({
      roomVariantId: entry.roomVariantId,
      headVersion: entry.headVersion,
      versions: [...entry.versions].sort((left, right) => left.version - right.version).map(portableRoomVersion),
    })), (value) => value.roomVariantId),
    proposals: sorted(roomLibrary.proposals.map(portableRoomProposal), (value) => value.proposalId),
  };
}

function restoredRoomLibrary(roomLibrary) {
  return {
    schemaVersion: 1,
    archetypes: roomLibrary.archetypes.map(restoredRoomArchetype),
    variants: roomLibrary.variants.map((entry) => ({
      roomVariantId: entry.roomVariantId,
      headVersion: entry.headVersion,
      versions: entry.versions.map(restoredRoomVersion),
    })),
    proposals: roomLibrary.proposals.map(restoredRoomProposal),
  };
}

function rowBinding(row) {
  return {
    sliceId: row.slice_id,
    sliceVersion: Number(row.slice_version),
    atlasId: row.atlas_id,
    sourceId: row.source_id,
    sourceDigest: row.source_digest,
    definitionVersion: Number(row.atlas_definition_version),
    definitionFingerprint: row.atlas_definition_fingerprint,
    rectangleId: row.rectangle_id,
    rectangle: parseJson(row.rectangle_json, 'asset_slice_bindings.rectangle_json'),
    processorId: row.processor_id,
    artifactDigest: row.artifact_digest,
    mediaType: row.media_type,
    byteSize: Number(row.byte_size),
    width: Number(row.width),
    height: Number(row.height),
    priorDigest: row.prior_digest,
    committedRevision: Number(row.committed_revision),
    boundRevision: Number(row.bound_revision),
    committedAt: row.committed_at,
    committedBy: row.committed_by,
    jobId: row.job_id,
  };
}

function derivedBinding(slice, headRevision) {
  const { rectangleId: _rectangleId, ...rectangle } = slice.rectangle;
  return {
    sliceId: slice.sliceId,
    sliceVersion: slice.version,
    atlasId: slice.atlasId,
    sourceId: slice.sourceId,
    sourceDigest: slice.sourceDigest,
    definitionVersion: slice.definitionVersion,
    definitionFingerprint: slice.definitionFingerprint,
    rectangleId: slice.rectangleId,
    rectangle,
    processorId: slice.processorId,
    artifactDigest: slice.digest,
    mediaType: slice.mediaType,
    byteSize: slice.byteSize,
    width: slice.width,
    height: slice.height,
    priorDigest: slice.priorDigest,
    committedRevision: headRevision,
    boundRevision: headRevision,
    committedAt: slice.committedAt,
    committedBy: slice.committedBy,
    jobId: slice.jobId,
  };
}

function portableFinding(row) {
  return {
    assetId: row.asset_id,
    assetVersion: Number(row.asset_version),
    findingOrder: Number(row.finding_order),
    finding: parseJson(row.finding_json, 'asset_version_findings.finding_json'),
  };
}

function portableActivity(revision) {
  const event = revision.event;
  if (['grant.issue', 'grant.revoke'].includes(event.commandType)) {
    return {
      eventId: `activity.bundle.${revision.number}`,
      revision: revision.number,
      occurredAt: event.occurredAt,
      actorKind: event.actor.kind,
      actorId: event.actor.id,
      taskId: null,
      type: 'bundle.import.authority_omitted',
      summary: 'Operational authority activity omitted.',
      changes: [],
    };
  }
  const sourceIntake = event.commandType === 'source.intake.commit';
  return {
    eventId: `activity.bundle.${revision.number}`,
    revision: revision.number,
    occurredAt: event.occurredAt,
    actorKind: event.actor.kind,
    actorId: event.actor.id,
    taskId: event.taskId ?? null,
    type: sourceIntake ? 'source.register' : event.commandType,
    summary: sourceIntake ? `Source ${event.changes[0]?.entityId ?? 'source'} registered.` : event.summary,
    changes: structuredClone(event.changes),
  };
}

function portableJob(row, eventRows = null) {
  const outputs = parseJson(row.output_json, 'jobs.output_json');
  const events = eventRows === null
    ? parseJson(row.events_json, 'bundle_import_applied_jobs.events_json')
    : eventRows.map((event) => ({
      sequence: Number(event.event_sequence),
      type: event.event_type,
      state: event.state,
      safePoint: event.safe_point,
      progress: { current: Number(event.progress_current), total: Number(event.progress_total) },
      details: parseJson(event.details_json, 'job_events.details_json'),
      occurredAt: event.occurred_at,
    }));
  return {
    jobId: row.job_id,
    kind: row.job_kind,
    state: 'APPLIED',
    inputRevision: Number(row.input_revision),
    appliedRevision: Number(row.applied_revision),
    atlasId: row.atlas_id,
    sourceId: row.source_id,
    inputFingerprint: row.input_fingerprint,
    processorId: parseJson(row.input_json, 'job input').processorId,
    outputArtifactBytes: outputs.reduce((sum, output) => sum + Number(output.byteSize), 0),
    input: parseJson(row.input_json, 'job input'),
    outputs,
    result: { outputs: structuredClone(outputs) },
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    events,
  };
}

function semanticArtifactDigests({ sources, atlases, bindings, proposals, jobHistory }) {
  const digests = new Set();
  const add = (digest) => { if (digest !== null && digest !== undefined) digests.add(digest); };
  for (const source of sources) {
    add(source.artifactDigest);
    for (const digest of source.provenance.referenceArtifactDigests) add(digest);
  }
  for (const atlas of atlases) {
    add(atlas.sourceDigest);
    for (const slice of atlas.slices) {
      add(slice.sourceDigest);
      add(slice.artifactDigest);
      add(slice.priorDigest);
    }
  }
  for (const binding of bindings) {
    add(binding.sourceDigest);
    add(binding.artifactDigest);
    add(binding.priorDigest);
  }
  for (const proposal of proposals) {
    for (const item of proposal.semantic.items) {
      add(item.sliceBinding.sourceDigest);
      add(item.sliceBinding.artifactDigest);
      add(item.sliceBinding.priorDigest);
      for (const side of [item.diff.before, item.diff.after]) {
        if (!side?.sliceBinding) continue;
        add(side.sliceBinding.sourceDigest);
        add(side.sliceBinding.artifactDigest);
        add(side.sliceBinding.priorDigest);
      }
    }
  }
  for (const job of jobHistory) {
    add(job.input.sourceDigest);
    for (const output of job.outputs) add(output.digest);
  }
  return [...digests].sort();
}

function requireUnique(values, selector, label) {
  const keys = values.map(selector);
  invariant(new Set(keys).size === keys.length, 'BUNDLE_SEMANTIC_INVALID', `${label} contains duplicate identities.`);
  invariant(keys.every((key, index) => index === 0 || keys[index - 1].localeCompare(key) <= 0), 'BUNDLE_NONCANONICAL', `${label} must be sorted.`);
}

function exactKeys(value, expected, label) {
  invariant(value !== null && typeof value === 'object' && !Array.isArray(value), 'BUNDLE_SCHEMA_INVALID', `${label} must be an object.`, { label });
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  invariant(
    actual.length === wanted.length && actual.every((key, index) => key === wanted[index]),
    'BUNDLE_SCHEMA_INVALID',
    `${label} contains missing or unknown fields.`,
    { label, expected: wanted, actual },
  );
}

const SOURCE_KEYS = ['sourceId', 'schemaVersion', 'name', 'artifactDigest', 'mediaType', 'byteSize', 'width', 'height', 'provenance', 'lifecycle', 'review', 'registeredAt', 'registeredBy'];
const PROVENANCE_V1_KEYS = ['prompt', 'seed', 'model', 'generator', 'referenceArtifactDigests'];
const PROVENANCE_V2_KEYS = ['origin', 'prompt', 'negativePrompt', 'seed', 'provider', 'model', 'modelVersion', 'generator', 'parameters', 'referenceArtifactDigests', 'parentSourceIds'];
const LIFECYCLE_KEYS = ['state', 'changedAt', 'changedBy'];
const REVIEW_KEYS = ['disposition', 'proposedAt', 'proposedBy', 'proposalNote', 'decidedAt', 'decidedBy', 'decisionNote'];
const ATLAS_KEYS = ['atlasId', 'schemaVersion', 'name', 'sourceId', 'sourceDigest', 'sourceMediaType', 'sourceWidth', 'sourceHeight', 'processorId', 'definitionVersion', 'definitionFingerprint', 'rectangleFingerprint', 'rectangles', 'slices', 'latestPreviewJobId', 'lastCommittedJobId', 'definedAt', 'definedBy', 'updatedAt', 'updatedBy'];
const RECTANGLE_KEYS = ['rectangleId', 'x', 'y', 'width', 'height', 'included', 'pivot', 'transparentPaddingPolicy', 'replacesSliceId', 'expectedSliceVersion'];
const BINDING_RECTANGLE_KEYS = RECTANGLE_KEYS.filter((key) => key !== 'rectangleId');
const SLICE_KEYS = ['schemaVersion', 'sliceId', 'sliceVersion', 'atlasId', 'sourceId', 'sourceDigest', 'definitionVersion', 'definitionFingerprint', 'rectangleId', 'rectangle', 'processorId', 'artifactDigest', 'mediaType', 'byteSize', 'width', 'height', 'priorDigest', 'committedAt', 'committedBy', 'jobId'];
const LEGACY_ASSET_KEYS = ['assetId', 'name', 'sourceId', 'kind', 'region', 'properties', 'status', 'definedAt', 'definedBy'];
const SLICE_BINDING_KEYS = ['sliceId', 'sliceVersion', 'atlasId', 'sourceId', 'sourceDigest', 'definitionVersion', 'definitionFingerprint', 'rectangleId', 'rectangle', 'processorId', 'artifactDigest', 'mediaType', 'byteSize', 'width', 'height', 'priorDigest', 'committedRevision', 'boundRevision', 'committedAt', 'committedBy', 'jobId'];
const EXACT_BINDING_KEYS = ['projectId', 'sliceId', 'sliceVersion', 'atlasId', 'sourceId', 'sourceDigest', 'definitionVersion', 'definitionFingerprint', 'rectangleId', 'rectangle', 'processorId', 'artifactDigest', 'mediaType', 'byteSize', 'width', 'height', 'priorDigest', 'committedRevision'];
const VERSION_KEYS = ['assetId', 'assetVersion', 'metadataVersion', 'previousAssetVersion', 'name', 'kind', 'lifecycle', 'sliceId', 'sliceVersion', 'metadata', 'metadataFingerprint', 'findingsFingerprint', 'acceptedWarningIds', 'createdRevision', 'createdAt', 'createdBy', 'proposalId', 'proposalItemId'];
const HEAD_KEYS = ['assetId', 'assetVersion', 'metadataVersion', 'name', 'kind', 'lifecycle', 'sliceId', 'sliceVersion', 'updatedRevision', 'tags', 'semantic'];
const ASSET_KEYS = ['assetId', 'assetVersion', 'metadataVersion', 'name', 'kind', 'lifecycle', 'metadata', 'metadataFingerprint', 'findings', 'sliceBinding', 'warningDispositions', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'proposal'];
const PROPOSAL_LINK_KEYS = ['proposalId', 'itemId', 'decisionRevision', 'appliedRevision'];
const FINDING_WRAPPER_KEYS = ['assetId', 'assetVersion', 'findingOrder', 'finding'];
const FINDING_KEYS = ['findingId', 'severity', 'ruleId', 'targetKind', 'targetId', 'path', 'explanation', 'remediation', 'validatorVersion'];
const PROPOSAL_KEYS = ['proposalId', 'status', 'semantic'];
const PROPOSAL_SEMANTIC_KEYS = ['proposalId', 'proposalVersion', 'fingerprint', 'items', 'proposer', 'submittedAt', 'submittedRevision', 'decidedAt', 'decidedBy', 'decisionRevision', 'appliedAt', 'appliedBy', 'appliedRevision'];
const PROPOSER_KEYS = ['actor', 'taskId'];
const ACTOR_KEYS = ['id', 'kind', 'displayName'];
const PROPOSAL_ITEM_KEYS = ['ordinal', 'itemId', 'operation', 'assetId', 'expectedAssetVersion', 'expectedMetadataVersion', 'sliceId', 'expectedSliceVersion', 'name', 'kind', 'metadata', 'sliceBinding', 'findings', 'metadataFingerprint', 'decision', 'diff'];
const DECISION_KEYS = ['disposition', 'reason', 'decidedAt', 'decidedBy', 'decisionRevision'];
const DIFF_KEYS = ['operation', 'before', 'after'];
const DIFF_BEFORE_KEYS = ['assetVersion', 'metadataVersion', 'name', 'kind', 'metadata', 'sliceBinding'];
const DIFF_AFTER_KEYS = ['name', 'kind', 'metadata', 'sliceBinding'];
const JOB_KEYS = ['jobId', 'kind', 'state', 'inputRevision', 'appliedRevision', 'atlasId', 'sourceId', 'inputFingerprint', 'processorId', 'outputArtifactBytes', 'input', 'outputs', 'result', 'createdAt', 'startedAt', 'finishedAt', 'events'];
const JOB_INPUT_KEYS = ['schemaVersion', 'kind', 'atlasId', 'atlasDefinitionVersion', 'atlasDefinitionFingerprint', 'processorId', 'sourceId', 'sourceDigest', 'sourceMediaType', 'sourceWidth', 'sourceHeight', 'rectangles'];
const OUTPUT_KEYS = ['rectangleId', 'digest', 'mediaType', 'byteSize', 'width', 'height'];
const JOB_RESULT_KEYS = ['outputs'];
const JOB_EVENT_KEYS = ['sequence', 'type', 'state', 'safePoint', 'progress', 'details', 'occurredAt'];
const PROGRESS_KEYS = ['current', 'total'];
const ACTIVITY_KEYS = ['eventId', 'revision', 'occurredAt', 'actorKind', 'actorId', 'taskId', 'type', 'summary', 'changes'];
const CHANGE_KEYS = ['entityType', 'entityId', 'operation'];
const METADATA_KEYS = ['role', 'tags', 'variantGroup', 'compatibilityGroups', 'spanTiles', 'anchor', 'attachment', 'rotationPolicy', 'placement', 'collision', 'navigation', 'runtimeEligible', 'connectors', 'continuityProfile', 'continuityTags', 'selectionPriority', 'visualWeight', 'extensions', 'pixelSize', 'pivot'];
const ROOM_ARCHETYPE_KEYS = ['projectId', 'roomArchetypeId', 'version', 'kind', 'displayName', 'tags', 'dimensionPolicy', 'structuralBands', 'orientation', 'connectorPolicy', 'allowedAssetKinds', 'allowedTags', 'requiredTags', 'rationality', 'governingRuleRefs', 'fingerprint', 'createdAt', 'createdBy', 'createdRevision'];
const ROOM_VARIANT_ENTRY_KEYS = ['roomVariantId', 'headVersion', 'versions'];
const ROOM_VERSION_KEYS = ['projectId', 'roomVariantId', 'version', 'roomArchetypeId', 'archetypeVersion', 'displayName', 'lifecycle', 'width', 'height', 'origin', 'intentTrace', 'connectors', 'placements', 'acceptedWarningFindingIds', 'parentVariantVersion', 'parentFinalVersion', 'findings', 'contentFingerprint', 'createdAt', 'createdBy', 'createdRevision', 'proposalId'];
const ROOM_INTENT_KEYS = ['layer', 'ruleId', 'summary', 'disposition'];
const ROOM_CONNECTOR_KEYS = ['connectorId', 'side', 'offset', 'width', 'kind', 'clearanceInside', 'clearanceOutside', 'required', 'tags', 'compatibilityProfile'];
const ROOM_PLACEMENT_KEYS = ['placementId', 'assetId', 'assetVersion', 'metadataVersion', 'layer', 'anchor', 'rotation', 'variantTag', 'proposalId', 'proposalItemId'];
const ROOM_PROPOSAL_KEYS = ['proposalId', 'proposalVersion', 'roomVariantId', 'expectedRoomVariantVersion', 'state', 'fingerprint', 'findings', 'items', 'proposer', 'submittedAt', 'submittedRevision', 'decidedAt', 'decidedBy', 'decisionRevision', 'appliedAt', 'appliedBy', 'appliedRevision', 'createdRoomVariantVersion'];
const ROOM_PROPOSAL_ITEM_KEYS = ['itemId', 'operation', 'placement', 'placementId', 'expectedAssetId', 'anchor', 'rotation', 'ordinal', 'diff', 'decision'];

function validateRectangleSchema(rectangle, label, { binding = false } = {}) {
  exactKeys(rectangle, binding ? BINDING_RECTANGLE_KEYS : RECTANGLE_KEYS, label);
  if (rectangle.pivot !== null) exactKeys(rectangle.pivot, ['x', 'y'], `${label}.pivot`);
}

function validateMetadataSchema(metadata, label) {
  exactKeys(metadata, METADATA_KEYS, label);
  if (metadata.spanTiles !== null) exactKeys(metadata.spanTiles, ['width', 'height'], `${label}.spanTiles`);
  if (metadata.anchor !== null) exactKeys(metadata.anchor, ['x', 'y'], `${label}.anchor`);
  exactKeys(metadata.placement, ['modes', 'wallSafe', 'tags', 'confirmation'], `${label}.placement`);
  if (metadata.collision !== null) {
    exactKeys(metadata.collision, ['mode', 'bounds', 'parts'], `${label}.collision`);
    if (metadata.collision.bounds !== null) exactKeys(metadata.collision.bounds, ['x', 'y', 'width', 'height'], `${label}.collision.bounds`);
    metadata.collision.parts.forEach((part, index) => exactKeys(part, ['x', 'y', 'width', 'height'], `${label}.collision.parts[${index}]`));
  }
  if (metadata.navigation !== null) exactKeys(metadata.navigation, ['effect', 'cost'], `${label}.navigation`);
  metadata.connectors.forEach((connector, index) => exactKeys(connector, ['edge', 'offset'], `${label}.connectors[${index}]`));
  exactKeys(metadata.pixelSize, ['width', 'height'], `${label}.pixelSize`);
  if (metadata.pivot !== null) exactKeys(metadata.pivot, ['x', 'y'], `${label}.pivot`);
  invariant(metadata.extensions !== null && typeof metadata.extensions === 'object' && !Array.isArray(metadata.extensions), 'BUNDLE_SCHEMA_INVALID', `${label}.extensions must be an object.`);
}

function validateExactBindingSchema(binding, label) {
  exactKeys(binding, EXACT_BINDING_KEYS, label);
  validateRectangleSchema(binding.rectangle, `${label}.rectangle`, { binding: true });
}

function validateFindingSchema(finding, label) {
  exactKeys(finding, FINDING_KEYS, label);
}

function validateProposalItemSchema(item, label) {
  exactKeys(item, PROPOSAL_ITEM_KEYS, label);
  validateMetadataSchema(item.metadata, `${label}.metadata`);
  validateExactBindingSchema(item.sliceBinding, `${label}.sliceBinding`);
  item.findings.forEach((finding, index) => validateFindingSchema(finding, `${label}.findings[${index}]`));
  exactKeys(item.decision, DECISION_KEYS, `${label}.decision`);
  exactKeys(item.diff, DIFF_KEYS, `${label}.diff`);
  if (item.diff.before !== null) {
    exactKeys(item.diff.before, DIFF_BEFORE_KEYS, `${label}.diff.before`);
    validateMetadataSchema(item.diff.before.metadata, `${label}.diff.before.metadata`);
    validateExactBindingSchema(item.diff.before.sliceBinding, `${label}.diff.before.sliceBinding`);
  }
  exactKeys(item.diff.after, DIFF_AFTER_KEYS, `${label}.diff.after`);
  validateMetadataSchema(item.diff.after.metadata, `${label}.diff.after.metadata`);
  validateExactBindingSchema(item.diff.after.sliceBinding, `${label}.diff.after.sliceBinding`);
}

function validateRoomPlacementSchema(placement, label) {
  exactKeys(placement, ROOM_PLACEMENT_KEYS, label);
  exactKeys(placement.anchor, ['x', 'y'], `${label}.anchor`);
}

function validateRoomLibrarySchemas(roomLibrary) {
  exactKeys(roomLibrary, ['archetypes', 'variants', 'proposals'], 'roomLibrary');
  roomLibrary.archetypes.forEach((archetype, index) => {
    const label = `roomLibrary.archetypes[${index}]`; exactKeys(archetype, ROOM_ARCHETYPE_KEYS, label);
    exactKeys(archetype.dimensionPolicy, ['width', 'height'], `${label}.dimensionPolicy`);
    exactKeys(archetype.dimensionPolicy.width, ['min', 'preferred', 'max'], `${label}.dimensionPolicy.width`);
    exactKeys(archetype.dimensionPolicy.height, ['min', 'preferred', 'max'], `${label}.dimensionPolicy.height`);
    exactKeys(archetype.structuralBands, ['left', 'right', 'top', 'bottom'], `${label}.structuralBands`);
    exactKeys(archetype.connectorPolicy, ['min', 'max', 'requiredSides'], `${label}.connectorPolicy`);
    archetype.governingRuleRefs.forEach((rule, ruleIndex) => exactKeys(rule, ['ruleId', 'summary'], `${label}.governingRuleRefs[${ruleIndex}]`));
  });
  roomLibrary.variants.forEach((entry, entryIndex) => {
    const entryLabel = `roomLibrary.variants[${entryIndex}]`; exactKeys(entry, ROOM_VARIANT_ENTRY_KEYS, entryLabel);
    entry.versions.forEach((version, versionIndex) => {
      const label = `${entryLabel}.versions[${versionIndex}]`; exactKeys(version, ROOM_VERSION_KEYS, label);
      exactKeys(version.origin, ['x', 'y'], `${label}.origin`);
      version.intentTrace.forEach((intent, intentIndex) => exactKeys(intent, ROOM_INTENT_KEYS, `${label}.intentTrace[${intentIndex}]`));
      version.connectors.forEach((connector, connectorIndex) => exactKeys(connector, ROOM_CONNECTOR_KEYS, `${label}.connectors[${connectorIndex}]`));
      version.placements.forEach((placement, placementIndex) => validateRoomPlacementSchema(placement, `${label}.placements[${placementIndex}]`));
      version.findings.forEach((finding, findingIndex) => validateFindingSchema(finding, `${label}.findings[${findingIndex}]`));
    });
  });
  roomLibrary.proposals.forEach((proposal, proposalIndex) => {
    const label = `roomLibrary.proposals[${proposalIndex}]`; exactKeys(proposal, ROOM_PROPOSAL_KEYS, label);
    exactKeys(proposal.proposer, PROPOSER_KEYS, `${label}.proposer`); exactKeys(proposal.proposer.actor, ACTOR_KEYS, `${label}.proposer.actor`);
    proposal.findings.forEach((finding, findingIndex) => validateFindingSchema(finding, `${label}.findings[${findingIndex}]`));
    proposal.items.forEach((item, itemIndex) => {
      const itemLabel = `${label}.items[${itemIndex}]`; exactKeys(item, ROOM_PROPOSAL_ITEM_KEYS, itemLabel);
      if (item.placement !== null) validateRoomPlacementSchema(item.placement, `${itemLabel}.placement`);
      if (item.anchor !== null) exactKeys(item.anchor, ['x', 'y'], `${itemLabel}.anchor`);
      exactKeys(item.diff, ['itemId', 'operation', 'before', 'after'], `${itemLabel}.diff`);
      if (item.diff.before !== null) validateRoomPlacementSchema(item.diff.before, `${itemLabel}.diff.before`);
      if (item.diff.after !== null) validateRoomPlacementSchema(item.diff.after, `${itemLabel}.diff.after`);
      if (item.decision !== null) exactKeys(item.decision, DECISION_KEYS, `${itemLabel}.decision`);
    });
  });
}

function validateNestedSchemas(project) {
  project.sources.forEach((source, index) => {
    const label = `sources[${index}]`;
    exactKeys(source, SOURCE_KEYS, label);
    exactKeys(source.provenance, source.schemaVersion === 2 ? PROVENANCE_V2_KEYS : PROVENANCE_V1_KEYS, `${label}.provenance`);
    if (source.lifecycle !== null) exactKeys(source.lifecycle, LIFECYCLE_KEYS, `${label}.lifecycle`);
    if (source.review !== null) exactKeys(source.review, REVIEW_KEYS, `${label}.review`);
  });
  project.atlases.forEach((atlas, atlasIndex) => {
    const label = `atlases[${atlasIndex}]`;
    exactKeys(atlas, ATLAS_KEYS, label);
    atlas.rectangles.forEach((rectangle, index) => validateRectangleSchema(rectangle, `${label}.rectangles[${index}]`));
    atlas.slices.forEach((slice, index) => {
      exactKeys(slice, SLICE_KEYS, `${label}.slices[${index}]`);
      validateRectangleSchema(slice.rectangle, `${label}.slices[${index}].rectangle`);
    });
  });
  project.legacyAssets.forEach((asset, index) => {
    exactKeys(asset, LEGACY_ASSET_KEYS, `legacyAssets[${index}]`);
    exactKeys(asset.region, ['x', 'y', 'width', 'height'], `legacyAssets[${index}].region`);
    invariant(asset.properties !== null && typeof asset.properties === 'object' && !Array.isArray(asset.properties), 'BUNDLE_SCHEMA_INVALID', `legacyAssets[${index}].properties must be an object.`);
  });
  project.assetLibrary.sliceBindings.forEach((binding, index) => {
    exactKeys(binding, SLICE_BINDING_KEYS, `assetLibrary.sliceBindings[${index}]`);
    validateRectangleSchema(binding.rectangle, `assetLibrary.sliceBindings[${index}].rectangle`, { binding: true });
  });
  project.assetLibrary.versions.forEach((version, index) => {
    exactKeys(version, VERSION_KEYS, `assetLibrary.versions[${index}]`);
    validateMetadataSchema(version.metadata, `assetLibrary.versions[${index}].metadata`);
  });
  project.assetLibrary.heads.forEach((head, index) => {
    const label = `assetLibrary.heads[${index}]`;
    exactKeys(head, HEAD_KEYS, label);
    const assetKeys = Object.hasOwn(head.semantic, 'lifecycleRevision') ? [...ASSET_KEYS, 'lifecycleRevision'] : ASSET_KEYS;
    exactKeys(head.semantic, assetKeys, `${label}.semantic`);
    validateMetadataSchema(head.semantic.metadata, `${label}.semantic.metadata`);
    head.semantic.findings.forEach((finding, findingIndex) => validateFindingSchema(finding, `${label}.semantic.findings[${findingIndex}]`));
    validateExactBindingSchema(head.semantic.sliceBinding, `${label}.semantic.sliceBinding`);
    exactKeys(head.semantic.proposal, PROPOSAL_LINK_KEYS, `${label}.semantic.proposal`);
  });
  project.assetLibrary.findings.forEach((wrapper, index) => {
    exactKeys(wrapper, FINDING_WRAPPER_KEYS, `assetLibrary.findings[${index}]`);
    validateFindingSchema(wrapper.finding, `assetLibrary.findings[${index}].finding`);
  });
  project.proposals.forEach((proposal, index) => {
    const label = `proposals[${index}]`;
    exactKeys(proposal, PROPOSAL_KEYS, label);
    exactKeys(proposal.semantic, PROPOSAL_SEMANTIC_KEYS, `${label}.semantic`);
    exactKeys(proposal.semantic.proposer, PROPOSER_KEYS, `${label}.semantic.proposer`);
    exactKeys(proposal.semantic.proposer.actor, ACTOR_KEYS, `${label}.semantic.proposer.actor`);
    proposal.semantic.items.forEach((item, itemIndex) => validateProposalItemSchema(item, `${label}.semantic.items[${itemIndex}]`));
  });
  project.appliedJobHistory.forEach((job, index) => {
    const label = `appliedJobHistory[${index}]`;
    exactKeys(job, JOB_KEYS, label);
    exactKeys(job.input, JOB_INPUT_KEYS, `${label}.input`);
    job.input.rectangles.forEach((rectangle, rectangleIndex) => validateRectangleSchema(rectangle, `${label}.input.rectangles[${rectangleIndex}]`));
    job.outputs.forEach((output, outputIndex) => exactKeys(output, OUTPUT_KEYS, `${label}.outputs[${outputIndex}]`));
    exactKeys(job.result, JOB_RESULT_KEYS, `${label}.result`);
    job.result.outputs.forEach((output, outputIndex) => exactKeys(output, OUTPUT_KEYS, `${label}.result.outputs[${outputIndex}]`));
    job.events.forEach((event, eventIndex) => {
      exactKeys(event, JOB_EVENT_KEYS, `${label}.events[${eventIndex}]`);
      exactKeys(event.progress, PROGRESS_KEYS, `${label}.events[${eventIndex}].progress`);
      invariant(event.details !== null && typeof event.details === 'object' && !Array.isArray(event.details), 'BUNDLE_SCHEMA_INVALID', `${label}.events[${eventIndex}].details must be an object.`);
    });
  });
  project.activity.forEach((activity, index) => {
    exactKeys(activity, ACTIVITY_KEYS, `activity[${index}]`);
    activity.changes.forEach((change, changeIndex) => exactKeys(change, CHANGE_KEYS, `activity[${index}].changes[${changeIndex}]`));
  });
  if (project.schemaVersion === 2) validateRoomLibrarySchemas(project.roomLibrary);
}

export function validateSqlitePortableProject(project) {
  validateNestedSchemas(project);
  requireUnique(project.sources, (source) => source.sourceId, 'sources');
  requireUnique(project.atlases, (atlas) => atlas.atlasId, 'atlases');
  requireUnique(project.legacyAssets, (asset) => asset.assetId, 'legacyAssets');
  requireUnique(project.assetLibrary.sliceBindings, (binding) => `${binding.sliceId}:${String(binding.sliceVersion).padStart(12, '0')}`, 'sliceBindings');
  requireUnique(project.assetLibrary.versions, (version) => `${version.assetId}:${String(version.assetVersion).padStart(12, '0')}`, 'asset versions');
  requireUnique(project.assetLibrary.heads, (head) => head.assetId, 'asset heads');
  requireUnique(project.proposals, (proposal) => proposal.proposalId, 'proposals');
  requireUnique(project.appliedJobHistory, (job) => job.jobId, 'applied job history');
  if (project.schemaVersion === 2) {
    requireUnique(project.roomLibrary.archetypes, (archetype) => `${archetype.roomArchetypeId}:${String(archetype.version).padStart(12, '0')}`, 'room archetypes');
    requireUnique(project.roomLibrary.variants, (entry) => entry.roomVariantId, 'room variants');
    requireUnique(project.roomLibrary.proposals, (proposal) => proposal.proposalId, 'room proposals');
  }
  const digests = new Set(project.artifactDigests);
  const sources = new Map(project.sources.map((source) => [source.sourceId, source]));
  const bindings = new Map(project.assetLibrary.sliceBindings.map((binding) => [`${binding.sliceId}:${binding.sliceVersion}`, binding]));
  for (const source of project.sources) {
    invariant(DIGEST.test(source.artifactDigest) && digests.has(source.artifactDigest), 'BUNDLE_CAS_CLOSURE_MISMATCH', 'A source artifact is outside the bundle closure.', { sourceId: source.sourceId });
    for (const digest of source.provenance.referenceArtifactDigests) invariant(digests.has(digest), 'BUNDLE_CAS_CLOSURE_MISMATCH', 'Source lineage is outside the bundle closure.');
  }
  for (const atlas of project.atlases) {
    invariant(sources.get(atlas.sourceId)?.artifactDigest === atlas.sourceDigest, 'BUNDLE_SEMANTIC_INVALID', 'Atlas source lineage is inconsistent.', { atlasId: atlas.atlasId });
    for (const slice of atlas.slices) {
      invariant(slice.atlasId === atlas.atlasId && slice.sourceId === atlas.sourceId && digests.has(slice.artifactDigest), 'BUNDLE_SEMANTIC_INVALID', 'Atlas slice lineage is inconsistent.', { sliceId: slice.sliceId });
      const binding = bindings.get(`${slice.sliceId}:${slice.sliceVersion}`);
      invariant(binding?.artifactDigest === slice.artifactDigest, 'BUNDLE_SEMANTIC_INVALID', 'A current atlas slice has no exact v9 binding.', { sliceId: slice.sliceId });
    }
  }
  const versionsByAsset = new Map();
  for (const version of project.assetLibrary.versions) {
    const binding = bindings.get(`${version.sliceId}:${version.sliceVersion}`);
    invariant(binding, 'BUNDLE_SEMANTIC_INVALID', 'An asset version has no exact slice binding.', { assetId: version.assetId });
    invariant(fingerprint({ kind: version.kind, metadata: version.metadata }) === version.metadataFingerprint, 'BUNDLE_SEMANTIC_INVALID', 'An asset metadata fingerprint is invalid.', { assetId: version.assetId, assetVersion: version.assetVersion });
    const values = versionsByAsset.get(version.assetId) ?? [];
    values.push(version);
    versionsByAsset.set(version.assetId, values);
  }
  for (const values of versionsByAsset.values()) {
    invariant(values.every((value, index) => value.assetVersion === index + 1), 'BUNDLE_SEMANTIC_INVALID', 'Asset versions must be consecutive.');
  }
  for (const head of project.assetLibrary.heads) {
    const latest = versionsByAsset.get(head.assetId)?.at(-1);
    invariant(latest && latest.assetVersion === head.assetVersion && latest.metadataVersion === head.metadataVersion, 'BUNDLE_SEMANTIC_INVALID', 'Asset head does not name its latest version.', { assetId: head.assetId });
  }
  for (const proposal of project.proposals) {
    invariant(proposal.status === 'APPLIED' && proposal.semantic.proposalVersion === 3, 'BUNDLE_NOT_QUIESCENT', 'Only applied v9 proposals can be exported.', { proposalId: proposal.proposalId });
    invariant(proposal.semantic.items.every((item) => item.decision !== null), 'BUNDLE_SEMANTIC_INVALID', 'Applied proposal has an undecided item.', { proposalId: proposal.proposalId });
  }
  for (const job of project.appliedJobHistory) {
    invariant(job.state === 'APPLIED' && fingerprint(job.input) === job.inputFingerprint, 'BUNDLE_SEMANTIC_INVALID', 'Applied job input fingerprint is invalid.', { jobId: job.jobId });
    invariant(job.outputs.every((output) => digests.has(output.digest)), 'BUNDLE_CAS_CLOSURE_MISMATCH', 'Applied job output is outside the bundle closure.', { jobId: job.jobId });
  }
  if (project.schemaVersion === 2) {
    const archetypes = new Map();
    for (const portable of project.roomLibrary.archetypes) {
      invariant(portable.projectId === project.projectHead.projectId, 'BUNDLE_SEMANTIC_INVALID', 'A room archetype belongs to another project.', { roomArchetypeId: portable.roomArchetypeId });
      const { fingerprint: expectedFingerprint, createdAt: _createdAt, createdBy: _createdBy, createdRevision: _createdRevision, ...value } = portable;
      const validated = validateRoomArchetype(value);
      invariant(validated.fingerprint === expectedFingerprint, 'BUNDLE_SEMANTIC_INVALID', 'A room archetype fingerprint is invalid.', { roomArchetypeId: portable.roomArchetypeId });
      archetypes.set(`${portable.roomArchetypeId}:${portable.version}`, validated);
    }
    const assetVersions = new Map(project.assetLibrary.versions.map((version) => [`${version.assetId}@${version.assetVersion}:${version.metadataVersion}`, {
      assetId: version.assetId, assetVersion: version.assetVersion, metadataVersion: version.metadataVersion,
      name: version.name, kind: version.kind, lifecycle: version.lifecycle, metadata: version.metadata,
    }]));
    for (const entry of project.roomLibrary.variants) {
      invariant(entry.versions.length >= 1 && entry.headVersion === entry.versions.at(-1).version, 'BUNDLE_SEMANTIC_INVALID', 'A room head must name its latest immutable version.', { roomVariantId: entry.roomVariantId });
      for (const [index, portable] of entry.versions.entries()) {
        invariant(portable.projectId === project.projectHead.projectId && portable.roomVariantId === entry.roomVariantId
          && portable.version === index + 1 && portable.parentVariantVersion === (index === 0 ? null : index),
        'BUNDLE_SEMANTIC_INVALID', 'Room versions must be consecutive with immediate-parent lineage.', { roomVariantId: entry.roomVariantId, version: portable.version });
        const archetype = archetypes.get(`${portable.roomArchetypeId}:${portable.archetypeVersion}`);
        invariant(archetype, 'BUNDLE_SEMANTIC_INVALID', 'A room version lost its exact archetype.', { roomVariantId: entry.roomVariantId, version: portable.version });
        const {
          findings, contentFingerprint, createdAt: _createdAt, createdBy: _createdBy,
          createdRevision: _createdRevision, proposalId: _proposalId, ...variant
        } = portable;
        const validated = validateRoomVariant({ variant, archetype, assets: assetVersions });
        invariant(validated.fingerprint === contentFingerprint && fingerprint(validated.findings) === fingerprint(findings),
          'BUNDLE_SEMANTIC_INVALID', 'A room version fingerprint or deterministic findings are invalid.', { roomVariantId: entry.roomVariantId, version: portable.version });
      }
    }
    for (const proposal of project.roomLibrary.proposals) {
      invariant(proposal.state === 'APPLIED' && proposal.proposalVersion === 3 && proposal.items.every((item) => item.decision !== null),
        'BUNDLE_NOT_QUIESCENT', 'Only fully decided and applied room proposals may enter a portable bundle.', { proposalId: proposal.proposalId });
      const proposalFingerprint = fingerprint({
        schemaVersion: 1,
        projectId: project.projectHead.projectId,
        proposalId: proposal.proposalId,
        roomVariantId: proposal.roomVariantId,
        expectedRoomVariantVersion: proposal.expectedRoomVariantVersion,
        items: proposal.items.map(({ decision: _decision, ...item }) => item),
        findings: proposal.findings,
      });
      invariant(proposal.fingerprint === proposalFingerprint, 'BUNDLE_SEMANTIC_INVALID', 'A room proposal fingerprint is invalid.', { proposalId: proposal.proposalId });
      const entry = project.roomLibrary.variants.find(({ roomVariantId }) => roomVariantId === proposal.roomVariantId);
      invariant(entry?.versions.some(({ version, proposalId }) => version === proposal.createdRoomVariantVersion && proposalId === proposal.proposalId),
        'BUNDLE_SEMANTIC_INVALID', 'An applied room proposal lost its created immutable room version.', { proposalId: proposal.proposalId });
    }
  }
  return structuredClone(project);
}

export function projectSqlitePortableDocument({ projectStore, projectId }) {
  invariant(projectStore instanceof SqliteProjectStore, 'VALIDATION_ERROR', 'SqliteProjectStore is required.');
  invariant(typeof projectId === 'string' && projectId.length > 0, 'VALIDATION_ERROR', 'projectId is required.');
  return projectStore.workspace.readTransaction((database) => {
    const row = database.prepare('SELECT * FROM projects WHERE project_id = ?').get(projectId);
    invariant(row, 'PROJECT_NOT_FOUND', 'The project does not exist.', { projectId });
    const snapshot = parseJson(row.head_snapshot_json, 'projects.head_snapshot_json');
    const headRevision = database.prepare(`
      SELECT revision_id, committed_at FROM revisions
      WHERE project_id = ? AND revision_number = ?
    `).get(projectId, row.head_revision);
    const liveJobs = database.prepare('SELECT * FROM jobs WHERE project_id = ? ORDER BY created_at, job_id').all(projectId);
    const active = liveJobs.filter((job) => ['QUEUED', 'RUNNING', 'SUCCEEDED'].includes(job.state));
    invariant(active.length === 0, 'BUNDLE_NOT_QUIESCENT', 'Portable export requires no queued, running, or unapplied succeeded jobs.', { jobIds: active.map((job) => job.job_id) });
    const proposalRows = database.prepare('SELECT * FROM asset_proposals WHERE project_id = ? ORDER BY proposal_id').all(projectId);
    const unsettled = proposalRows.filter((proposal) => proposal.status !== 'APPLIED');
    invariant(unsettled.length === 0, 'BUNDLE_NOT_QUIESCENT', 'Portable export requires every asset proposal to be applied.', { proposalIds: unsettled.map((proposal) => proposal.proposal_id) });
    const roomProposalRows = database.prepare('SELECT * FROM room_placement_proposals WHERE project_id = ? ORDER BY proposal_id').all(projectId);
    const unsettledRoomProposals = roomProposalRows.filter((proposal) => proposal.status !== 'APPLIED');
    invariant(unsettledRoomProposals.length === 0, 'BUNDLE_NOT_QUIESCENT', 'Portable export requires every room proposal to be applied.', { proposalIds: unsettledRoomProposals.map((proposal) => proposal.proposal_id) });

    const bindingRows = database.prepare(`SELECT * FROM asset_slice_bindings WHERE project_id = ? ORDER BY slice_id, slice_version`).all(projectId);
    const bindings = bindingRows.map(rowBinding);
    const bindingKeys = new Set(bindings.map((binding) => `${binding.sliceId}:${binding.sliceVersion}`));
    for (const atlas of snapshot.atlases ?? []) {
      for (const slice of atlas.sliceHeads ?? []) {
        const key = `${slice.sliceId}:${slice.version}`;
        if (!bindingKeys.has(key)) {
          bindings.push(derivedBinding(slice, Number(row.head_revision)));
          bindingKeys.add(key);
        }
      }
    }
    bindings.sort((left, right) => `${left.sliceId}:${String(left.sliceVersion).padStart(12, '0')}`.localeCompare(`${right.sliceId}:${String(right.sliceVersion).padStart(12, '0')}`));

    const versionRows = database.prepare(`SELECT * FROM asset_versions WHERE project_id = ? ORDER BY asset_id, asset_version`).all(projectId);
    const versions = versionRows.map((version) => ({
      assetId: version.asset_id,
      assetVersion: Number(version.asset_version),
      metadataVersion: Number(version.metadata_version),
      previousAssetVersion: version.previous_asset_version === null ? null : Number(version.previous_asset_version),
      name: version.name,
      kind: version.kind,
      lifecycle: version.lifecycle,
      sliceId: version.slice_id,
      sliceVersion: Number(version.slice_version),
      metadata: parseJson(version.metadata_json, 'asset_versions.metadata_json'),
      metadataFingerprint: version.metadata_fingerprint,
      findingsFingerprint: version.findings_fingerprint,
      acceptedWarningIds: parseJson(version.accepted_warning_ids_json, 'asset_versions.accepted_warning_ids_json'),
      createdRevision: Number(version.created_revision),
      createdAt: version.created_at,
      createdBy: version.created_by,
      proposalId: version.proposal_id,
      proposalItemId: version.proposal_item_id,
    }));
    const headRows = database.prepare('SELECT * FROM asset_heads WHERE project_id = ? ORDER BY asset_id').all(projectId);
    const tagRows = database.prepare('SELECT * FROM asset_head_tags WHERE project_id = ? ORDER BY asset_id, tag_order').all(projectId);
    const tags = new Map();
    for (const tag of tagRows) tags.set(tag.asset_id, [...(tags.get(tag.asset_id) ?? []), tag.tag]);
    const snapshotAssets = new Map((snapshot.assetLibrary?.assets ?? []).map((asset) => [asset.assetId, asset]));
    const heads = headRows.map((head) => ({
      assetId: head.asset_id,
      assetVersion: Number(head.asset_version),
      metadataVersion: Number(head.metadata_version),
      name: head.name,
      kind: head.kind,
      lifecycle: head.lifecycle,
      sliceId: head.slice_id,
      sliceVersion: Number(head.slice_version),
      updatedRevision: Number(head.updated_revision),
      tags: tags.get(head.asset_id) ?? [],
      semantic: portableAsset(snapshotAssets.get(head.asset_id)),
    }));
    const findings = database.prepare(`
      SELECT * FROM asset_version_findings WHERE project_id = ?
      ORDER BY asset_id, asset_version, finding_order
    `).all(projectId).map(portableFinding);
    const proposalSnapshots = new Map((snapshot.assetLibrary?.proposals ?? []).map((proposal) => [proposal.proposalId, proposal]));
    const proposals = proposalRows.map((proposal) => {
      const semantic = proposalSnapshots.get(proposal.proposal_id);
      invariant(semantic?.state === 'APPLIED', 'BUNDLE_SQLITE_CORRUPT', 'Proposal table and project head disagree.', { proposalId: proposal.proposal_id });
      return { proposalId: proposal.proposal_id, status: 'APPLIED', semantic: portableProposalSnapshot(semantic) };
    });

    const events = database.prepare(`SELECT * FROM job_events WHERE project_id = ? ORDER BY job_id, event_sequence`);
    const appliedJobs = liveJobs.filter((job) => job.state === 'APPLIED').map((job) => portableJob(job, events.all(projectId).filter((event) => event.job_id === job.job_id)));
    const importedJobs = database.prepare(`SELECT * FROM bundle_import_applied_jobs WHERE project_id = ? ORDER BY job_id`).all(projectId).map((job) => portableJob(job));
    const jobHistory = sorted([...appliedJobs, ...importedJobs], (job) => job.jobId);
    const revisions = database.prepare('SELECT revision_json FROM revisions WHERE project_id = ? ORDER BY revision_number').all(projectId)
      .map((revision) => parseJson(revision.revision_json, 'revisions.revision_json'));

    const portableSources = sorted((snapshot.sources ?? []).map(portableSource), (source) => source.sourceId);
    const portableAtlases = sorted((snapshot.atlases ?? []).map(portableAtlas), (atlas) => atlas.atlasId);
    const referencedDigests = semanticArtifactDigests({
      sources: portableSources,
      atlases: portableAtlases,
      bindings,
      proposals,
      jobHistory,
    });
    const artifacts = referencedDigests.map((digest) => {
      const artifact = database.prepare('SELECT * FROM artifacts WHERE digest = ?').get(digest);
      invariant(artifact?.state === 'LIVE', 'BUNDLE_SQLITE_CORRUPT', 'A semantic artifact is not LIVE.', { digest });
      return {
        digest,
        byteSize: Number(artifact.byte_size),
        mediaType: artifact.media_type,
        width: Number(artifact.width),
        height: Number(artifact.height),
      };
    });
    const roomLibrary = portableRoomLibrary(snapshot);
    const hasRoomSemantics = roomLibrary.archetypes.length > 0 || roomLibrary.variants.length > 0 || roomLibrary.proposals.length > 0;
    const project = cleanUndefined({
      schemaVersion: hasRoomSemantics ? 2 : 1,
      bundleKind: 'numberdroid-studio-project',
      projectHead: {
        projectId,
        formatVersion: Number(row.format_version),
        revision: Number(row.head_revision),
        revisionId: headRevision.revision_id,
        name: snapshot.project.name,
        description: snapshot.project.description,
        ownerId: snapshot.project.ownerId,
        status: snapshot.project.status,
        statusNote: snapshot.project.statusNote,
        createdAt: snapshot.project.createdAt,
        updatedAt: snapshot.project.updatedAt ?? headRevision.committed_at,
      },
      artifactDigests: referencedDigests,
      sources: portableSources,
      atlases: portableAtlases,
      legacyAssets: sorted((snapshot.assets ?? []).map(portableLegacyAsset), (asset) => asset.assetId),
      assetLibrary: { sliceBindings: bindings, versions, heads, findings },
      proposals,
      appliedJobHistory: jobHistory,
      activity: revisions.map(portableActivity),
      ...(hasRoomSemantics ? { roomLibrary } : {}),
    });
    validateSqlitePortableProject(project);
    return { project, artifacts };
  });
}

export async function createSqliteProjectBundle({
  destinationDirectory,
  projectStore,
  artifactStore,
  projectId,
  limits = PROJECT_BUNDLE_LIMITS,
}) {
  invariant(artifactStore instanceof ContentAddressedArtifactStore, 'VALIDATION_ERROR', 'ContentAddressedArtifactStore is required.');
  const { project, artifacts } = projectSqlitePortableDocument({ projectStore, projectId });
  const integrity = await verifyWorkspaceIntegrity({ projectStore, artifactStore });
  invariant(integrity.ok, 'BUNDLE_SOURCE_INTEGRITY_FAILED', 'The source workspace failed full integrity verification.', { integrity });
  return createPortableProjectBundle({
    destinationDirectory,
    project,
    artifacts,
    artifactStore,
    limits,
    semanticValidator: validateSqlitePortableProject,
  });
}

export async function verifySqliteProjectBundle(bundleDirectory, { limits = PROJECT_BUNDLE_LIMITS } = {}) {
  return verifyPortableProjectBundle(bundleDirectory, { limits, semanticValidator: validateSqlitePortableProject });
}

function importedSnapshot(project, revision = project.projectHead.revision) {
  const atlases = project.atlases.map(restoredAtlas);
  const bindingsByAtlas = new Map();
  for (const binding of project.assetLibrary.sliceBindings) {
    if (binding.committedRevision > revision) continue;
    const bySlice = bindingsByAtlas.get(binding.atlasId) ?? new Map();
    const prior = bySlice.get(binding.sliceId);
    if (!prior || prior.sliceVersion < binding.sliceVersion) bySlice.set(binding.sliceId, binding);
    bindingsByAtlas.set(binding.atlasId, bySlice);
  }
  for (const atlas of atlases) {
    atlas.sliceHeads = [...(bindingsByAtlas.get(atlas.id)?.values() ?? [])].map((binding) => restoredSlice({
      schemaVersion: 1,
      ...binding,
    }));
  }
  return {
    project: {
      id: project.projectHead.projectId,
      name: project.projectHead.name,
      description: project.projectHead.description,
      ownerId: project.projectHead.ownerId,
      status: project.projectHead.status,
      statusNote: project.projectHead.statusNote,
      createdAt: project.projectHead.createdAt,
      updatedAt: project.projectHead.updatedAt,
    },
    grants: [],
    sources: project.sources.map(restoredSource),
    assets: project.legacyAssets.map((asset) => cleanUndefined(restoredLegacyAsset(asset))),
    rooms: [],
    levels: [],
    atlases,
    assetLibrary: {
      schemaVersion: 1,
      assets: project.assetLibrary.heads.map((head) => restoredAsset(head.semantic)),
      proposals: project.proposals.map(restoredProposalSnapshot),
    },
    ...(project.schemaVersion === 2 ? { roomLibrary: restoredRoomLibrary(project.roomLibrary) } : {}),
  };
}

function syntheticRevision(project, snapshot, activity) {
  const commandId = `bundle-import.command.${activity.revision}`;
  const event = {
    id: activity.eventId,
    projectId: project.projectHead.projectId,
    revision: activity.revision,
    occurredAt: activity.occurredAt,
    actor: { kind: activity.actorKind, id: activity.actorId },
    taskId: activity.taskId,
    commandId,
    commandType: activity.type,
    status: 'committed',
    summary: activity.summary,
    changes: structuredClone(activity.changes),
  };
  return {
    id: activity.revision === project.projectHead.revision
      ? project.projectHead.revisionId
      : `bundle-import.revision.${activity.revision}`,
    number: activity.revision,
    parentRevision: Math.max(0, activity.revision - 1),
    committedAt: activity.occurredAt,
    command: {
      schemaVersion: 1,
      commandId,
      idempotencyKey: `bundle-import.idempotency.${activity.revision}`,
      type: activity.type,
      actor: { kind: activity.actorKind, id: activity.actorId },
      taskId: activity.taskId,
      grantId: null,
      fingerprint: fingerprint({ provenance: 'bundle_import', revision: activity.revision }),
    },
    snapshot: structuredClone(snapshot),
    result: { reconstructed: true },
    event,
  };
}

function insertFinding(database, table, identity, record) {
  const finding = record.finding;
  const prefix = table === 'asset_version_findings'
    ? [identity.projectId, identity.assetId, identity.assetVersion]
    : [identity.projectId, identity.proposalId, identity.itemId];
  database.prepare(`
    INSERT INTO ${table}(
      project_id, ${table === 'asset_version_findings' ? 'asset_id, asset_version' : 'proposal_id, item_id'},
      finding_id, finding_order, severity, rule_id, target_kind, target_id,
      path, explanation, remediation, validator_version, finding_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    ...prefix,
    finding.findingId,
    record.findingOrder,
    finding.severity,
    finding.ruleId,
    finding.targetKind,
    finding.targetId,
    finding.path,
    finding.explanation,
    finding.remediation,
    finding.validatorVersion,
    JSON.stringify(finding),
  );
}

function insertPortableRoomFinding(database, table, projectId, identity, finding, findingOrder) {
  if (table === 'room_variant_findings') {
    database.prepare(`
      INSERT INTO room_variant_findings(
        project_id, room_variant_id, variant_version, finding_id, finding_order,
        severity, rule_id, target_kind, target_id, path, explanation,
        remediation, validator_version, finding_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(projectId, identity.roomVariantId, identity.variantVersion, finding.findingId, findingOrder,
      finding.severity, finding.ruleId, finding.targetKind, finding.targetId, finding.path,
      finding.explanation, finding.remediation, finding.validatorVersion, JSON.stringify(finding));
    return;
  }
  database.prepare(`
    INSERT INTO room_placement_proposal_findings(
      project_id, proposal_id, finding_id, finding_order, severity, rule_id,
      target_kind, target_id, path, explanation, remediation, validator_version, finding_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(projectId, identity.proposalId, finding.findingId, findingOrder, finding.severity,
    finding.ruleId, finding.targetKind, finding.targetId, finding.path, finding.explanation,
    finding.remediation, finding.validatorVersion, JSON.stringify(finding));
}

function materializePortableRoomLibrary(database, project, safeRevision) {
  if (project.schemaVersion !== 2) return;
  const projectId = project.projectHead.projectId;
  for (const archetype of project.roomLibrary.archetypes) {
    const {
      fingerprint: _fingerprint, createdAt: _createdAt, createdBy: _createdBy,
      createdRevision: _createdRevision, ...value
    } = archetype;
    database.prepare(`
      INSERT INTO room_archetype_versions(
        project_id, room_archetype_id, archetype_version, kind, display_name,
        archetype_json, content_fingerprint, created_revision, created_at, created_by, provenance
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'bundle_import')
    `).run(projectId, archetype.roomArchetypeId, archetype.version, archetype.kind,
      archetype.displayName, JSON.stringify(value), archetype.fingerprint,
      safeRevision(archetype.createdRevision), archetype.createdAt, archetype.createdBy);
    for (const [ruleOrder, rule] of archetype.governingRuleRefs.entries()) database.prepare(`
      INSERT INTO room_archetype_governing_rules(
        project_id, room_archetype_id, archetype_version, rule_id, rule_order, summary
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(projectId, archetype.roomArchetypeId, archetype.version, rule.ruleId, ruleOrder, rule.summary);
  }
  for (const archetype of project.roomLibrary.archetypes) database.prepare(`
    INSERT INTO room_archetype_heads(
      project_id, room_archetype_id, archetype_version, kind, display_name, updated_revision
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(projectId, archetype.roomArchetypeId, archetype.version, archetype.kind,
    archetype.displayName, safeRevision(archetype.createdRevision));

  for (const proposal of project.roomLibrary.proposals) {
    database.prepare(`
      INSERT INTO room_placement_proposals(
        project_id, proposal_id, schema_version, room_variant_id,
        expected_room_variant_version, base_revision, created_revision, status,
        item_count, request_fingerprint, finding_fingerprint,
        proposer_actor_kind, proposer_actor_id, proposer_task_id,
        proposer_branch_id, proposer_grant_id, created_at, decided_revision, applied_revision
      ) VALUES (?, ?, 1, ?, ?, ?, ?, 'APPLIED', ?, ?, ?, 'bundle_import', ?, ?, 'branch.bundle-import', NULL, ?, ?, ?)
    `).run(projectId, proposal.proposalId, proposal.roomVariantId, proposal.expectedRoomVariantVersion,
      safeRevision(Math.max(1, proposal.submittedRevision - 1)), safeRevision(proposal.submittedRevision),
      proposal.items.length, proposal.fingerprint, fingerprint(proposal.findings),
      proposal.proposer.actor.id, proposal.proposer.taskId, proposal.submittedAt,
      safeRevision(proposal.decisionRevision), safeRevision(proposal.appliedRevision));
    for (const item of proposal.items) {
      database.prepare(`
        INSERT INTO room_placement_proposal_items(
          project_id, proposal_id, item_id, item_order, operation,
          placement_id, expected_asset_id, desired_json, diff_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(projectId, proposal.proposalId, item.itemId, item.ordinal, item.operation,
        item.operation === 'add' ? item.placement.placementId : item.placementId,
        item.expectedAssetId, JSON.stringify({ ...item, decision: null }), JSON.stringify(item.diff));
      database.prepare(`
        INSERT INTO room_placement_proposal_decisions(
          project_id, proposal_id, item_id, decision, rejection_reason,
          decision_revision, decided_at, decided_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(projectId, proposal.proposalId, item.itemId, item.decision.disposition,
        item.decision.disposition === 'REJECTED' ? item.decision.reason : null,
        safeRevision(item.decision.decisionRevision), item.decision.decidedAt, item.decision.decidedBy);
    }
    proposal.findings.forEach((finding, findingOrder) => insertPortableRoomFinding(
      database, 'room_placement_proposal_findings', projectId, { proposalId: proposal.proposalId }, finding, findingOrder,
    ));
  }

  for (const entry of project.roomLibrary.variants) {
    for (const room of entry.versions) {
      const {
        findings, contentFingerprint, createdAt: _createdAt, createdBy: _createdBy,
        createdRevision: _createdRevision, proposalId: _proposalId, ...value
      } = room;
      database.prepare(`
        INSERT INTO room_variant_versions(
          project_id, room_variant_id, variant_version, room_archetype_id,
          archetype_version, previous_variant_version, parent_final_version,
          display_name, lifecycle, width, height, variant_json,
          content_fingerprint, findings_fingerprint, created_revision, created_at,
          created_by, proposal_id, provenance
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'bundle_import')
      `).run(projectId, room.roomVariantId, room.version, room.roomArchetypeId,
        room.archetypeVersion, room.parentVariantVersion, room.parentFinalVersion,
        room.displayName, room.lifecycle, room.width, room.height, JSON.stringify(value),
        room.contentFingerprint, fingerprint(room.findings), safeRevision(room.createdRevision),
        room.createdAt, room.createdBy, room.proposalId);
      for (const [intentOrder, intent] of room.intentTrace.entries()) database.prepare(`
        INSERT INTO room_variant_intent(
          project_id, room_variant_id, variant_version, intent_order, layer, rule_id, summary, disposition
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(projectId, room.roomVariantId, room.version, intentOrder, intent.layer, intent.ruleId, intent.summary, intent.disposition);
      for (const [connectorOrder, connector] of room.connectors.entries()) database.prepare(`
        INSERT INTO room_variant_connectors(
          project_id, room_variant_id, variant_version, connector_id, connector_order,
          side, offset, aperture_width, clearance_inside, clearance_outside, connector_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(projectId, room.roomVariantId, room.version, connector.connectorId, connectorOrder,
        connector.side, connector.offset, connector.width, connector.clearanceInside,
        connector.clearanceOutside, JSON.stringify(connector));
      for (const [placementOrder, placement] of room.placements.entries()) database.prepare(`
        INSERT INTO room_variant_placements(
          project_id, room_variant_id, variant_version, placement_id, placement_order,
          asset_id, asset_version, metadata_version, layer, anchor_x, anchor_y, rotation, placement_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(projectId, room.roomVariantId, room.version, placement.placementId, placementOrder,
        placement.assetId, placement.assetVersion, placement.metadataVersion, placement.layer,
        placement.anchor.x, placement.anchor.y, placement.rotation, JSON.stringify(placement));
      room.findings.forEach((finding, findingOrder) => insertPortableRoomFinding(
        database, 'room_variant_findings', projectId,
        { roomVariantId: room.roomVariantId, variantVersion: room.version }, finding, findingOrder,
      ));
      room.acceptedWarningFindingIds.forEach((findingId, dispositionOrder) => database.prepare(`
        INSERT INTO room_variant_warning_dispositions(
          project_id, room_variant_id, variant_version, finding_id, disposition_order
        ) VALUES (?, ?, ?, ?, ?)
      `).run(projectId, room.roomVariantId, room.version, findingId, dispositionOrder));
    }
    const head = entry.versions.at(-1);
    database.prepare(`
      INSERT INTO room_variant_heads(
        project_id, room_variant_id, variant_version, room_archetype_id,
        archetype_version, display_name, lifecycle, width, height, updated_revision
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(projectId, head.roomVariantId, head.version, head.roomArchetypeId,
      head.archetypeVersion, head.displayName, head.lifecycle, head.width, head.height,
      safeRevision(head.createdRevision));
  }
  for (const proposal of project.roomLibrary.proposals) {
    const accepted = proposal.items.filter((item) => item.decision.disposition === 'ACCEPTED').length;
    database.prepare(`
      INSERT INTO room_placement_proposal_applications(
        project_id, proposal_id, room_variant_id, application_revision,
        created_room_variant_version, accepted_count, rejected_count, applied_at, applied_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(projectId, proposal.proposalId, proposal.roomVariantId,
      safeRevision(proposal.appliedRevision), proposal.createdRoomVariantVersion,
      accepted, proposal.items.length - accepted, proposal.appliedAt, proposal.appliedBy);
  }
}

async function materializeSqliteBundle({
  stagingDirectory,
  artifactDirectory,
  project,
  manifest,
  manifestDigest,
  projectDigest,
  artifacts,
  databaseFactory,
  faultInjector,
}) {
  validateSqlitePortableProject(project);
  const databasePath = join(stagingDirectory, 'studio.sqlite');
  const store = await SqliteProjectStore.open({ filename: databasePath, databaseFactory, faultInjector });
  const cas = new ContentAddressedArtifactStore({ rootDirectory: artifactDirectory });
  try {
    for (const artifact of artifacts) await cas.verify(artifact.digest);
    const snapshot = importedSnapshot(project);
    const revisions = project.activity.map((activity) => syntheticRevision(
      project,
      importedSnapshot(project, activity.revision),
      activity,
    ));
    invariant(revisions.length > 0 && revisions.at(-1).number === project.projectHead.revision, 'BUNDLE_SEMANTIC_INVALID', 'Activity must cover the exact project head revision.');
    const importId = `bundle-import.${manifestDigest.slice(0, 32)}`;
    store.workspace.transaction((database) => {
      database.prepare(`
        INSERT INTO projects(project_id, format_version, created_at, head_revision, head_snapshot_json, summary_json)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        project.projectHead.projectId,
        project.projectHead.formatVersion,
        project.projectHead.createdAt,
        project.projectHead.revision,
        JSON.stringify(snapshot),
        JSON.stringify({
          projectId: project.projectHead.projectId,
          revision: project.projectHead.revision,
          name: project.projectHead.name,
          status: project.projectHead.status,
          updatedAt: project.projectHead.updatedAt,
          sourceCount: project.sources.length,
          assetCount: project.legacyAssets.length,
        }),
      );
      const insertRevision = database.prepare(`
        INSERT INTO revisions(
          project_id, revision_number, revision_id, parent_revision, committed_at,
          command_id, idempotency_key, command_type, fingerprint, revision_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const revision of revisions) {
        insertRevision.run(
          project.projectHead.projectId, revision.number, revision.id, revision.parentRevision,
          revision.committedAt, revision.command.commandId, revision.command.idempotencyKey,
          revision.command.type, revision.command.fingerprint, JSON.stringify(revision),
        );
        database.prepare(`
          INSERT INTO revision_parents(project_id, revision_number, parent_revision) VALUES (?, ?, ?)
        `).run(project.projectHead.projectId, revision.number, revision.parentRevision);
        database.prepare(`
          INSERT INTO activity_events(event_id, project_id, revision_number, occurred_at, event_json)
          VALUES (?, ?, ?, ?, ?)
        `).run(revision.event.id, project.projectHead.projectId, revision.number, revision.event.occurredAt, JSON.stringify(revision.event));
      }
      database.prepare(`
        INSERT INTO projections(project_id, projection_type, entity_id, version, revision_number, projection_json, projection_hash)
        VALUES (?, 'project_head', ?, ?, ?, ?, ?)
      `).run(project.projectHead.projectId, project.projectHead.projectId, project.projectHead.revision, project.projectHead.revision, JSON.stringify(snapshot), fingerprint(snapshot));
      database.prepare(`
        INSERT INTO aggregate_versions(project_id, aggregate_type, aggregate_id, version, revision_number)
        VALUES (?, 'project', ?, ?, ?)
      `).run(project.projectHead.projectId, project.projectHead.projectId, project.projectHead.revision, project.projectHead.revision);

      for (const artifact of artifacts) {
        database.prepare(`
          INSERT INTO artifacts(digest, uri, media_type, byte_size, width, height, state, created_at, verified_at)
          VALUES (?, ?, ?, ?, ?, ?, 'LIVE', ?, ?)
        `).run(artifact.digest, artifactUri(artifact.digest), artifact.mediaType, artifact.byteSize, artifact.width, artifact.height, project.projectHead.updatedAt, project.projectHead.updatedAt);
      }
      const revisionSet = new Set(revisions.map((revision) => revision.number));
      const safeRevision = (candidate) => revisionSet.has(candidate) ? candidate : project.projectHead.revision;
      const insertReference = database.prepare(`
        INSERT OR IGNORE INTO artifact_references(project_id, owner_kind, owner_id, digest, created_revision)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const source of project.sources) {
        insertReference.run(project.projectHead.projectId, 'source', source.sourceId, source.artifactDigest, safeRevision(1));
        for (const digest of source.provenance.referenceArtifactDigests) insertReference.run(project.projectHead.projectId, 'source_lineage', source.sourceId, digest, safeRevision(1));
      }

      const insertBinding = database.prepare(`
        INSERT INTO asset_slice_bindings(
          project_id, slice_id, slice_version, atlas_id, source_id, source_digest,
          atlas_definition_version, atlas_definition_fingerprint, rectangle_id,
          rectangle_json, rect_x, rect_y, rect_width, rect_height, pivot_x, pivot_y,
          processor_id, artifact_digest, artifact_uri, media_type, byte_size, width,
          height, prior_digest, committed_revision, bound_revision, committed_at,
          committed_by, job_id, provenance
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'bundle_import')
      `);
      for (const binding of project.assetLibrary.sliceBindings) {
        insertBinding.run(
          project.projectHead.projectId, binding.sliceId, binding.sliceVersion, binding.atlasId,
          binding.sourceId, binding.sourceDigest, binding.definitionVersion, binding.definitionFingerprint,
          binding.rectangleId, JSON.stringify(binding.rectangle), binding.rectangle.x, binding.rectangle.y,
          binding.rectangle.width, binding.rectangle.height, binding.rectangle.pivot?.x ?? null,
          binding.rectangle.pivot?.y ?? null, binding.processorId, binding.artifactDigest,
          artifactUri(binding.artifactDigest), binding.mediaType, binding.byteSize, binding.width,
          binding.height, binding.priorDigest, safeRevision(binding.committedRevision),
          safeRevision(binding.boundRevision), binding.committedAt, binding.committedBy, binding.jobId,
        );
        insertReference.run(project.projectHead.projectId, 'atlas_slice', `${binding.sliceId}.v${binding.sliceVersion}`, binding.artifactDigest, safeRevision(binding.committedRevision));
      }

      for (const proposal of project.proposals) {
        const semantic = proposal.semantic;
        const proposer = semantic.proposer;
        database.prepare(`
          INSERT INTO asset_proposals(
            project_id, proposal_id, schema_version, base_revision, created_revision,
            status, item_count, request_fingerprint, proposer_actor_kind,
            proposer_actor_id, proposer_task_id, proposer_branch_id,
            proposer_grant_id, created_at, decided_revision, applied_revision
          ) VALUES (?, ?, 1, ?, ?, 'APPLIED', ?, ?, 'bundle_import', 'bundle.import',
            NULL, 'branch.bundle-import', NULL, ?, ?, ?)
        `).run(
          project.projectHead.projectId, proposal.proposalId,
          safeRevision(Math.max(1, semantic.submittedRevision - 1)), safeRevision(semantic.submittedRevision),
          semantic.items.length, semantic.fingerprint, semantic.submittedAt,
          safeRevision(semantic.decisionRevision), safeRevision(semantic.appliedRevision),
        );
        for (const item of semantic.items) {
          database.prepare(`
            INSERT INTO asset_proposal_items(
              project_id, proposal_id, item_id, item_order, operation, asset_id,
              expected_asset_version, expected_metadata_version, slice_id, slice_version,
              desired_name, desired_kind, desired_metadata_json,
              desired_metadata_fingerprint, diff_json, finding_fingerprint
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            project.projectHead.projectId, proposal.proposalId, item.itemId, item.ordinal,
            item.operation, item.assetId, item.expectedAssetVersion, item.expectedMetadataVersion,
            item.sliceId, item.expectedSliceVersion, item.name, item.kind, JSON.stringify(item.metadata),
            item.metadataFingerprint, JSON.stringify(restoredDiff(item.diff)), fingerprint(item.findings),
          );
          for (const [findingOrder, finding] of item.findings.entries()) insertFinding(database, 'asset_proposal_item_findings', {
            projectId: project.projectHead.projectId, proposalId: proposal.proposalId, itemId: item.itemId,
          }, { findingOrder, finding });
          database.prepare(`
            INSERT INTO asset_proposal_decisions(
              project_id, proposal_id, item_id, decision, rejection_reason,
              decision_revision, decided_at, decided_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            project.projectHead.projectId, proposal.proposalId, item.itemId,
            item.decision.disposition, item.decision.reason,
            safeRevision(item.decision.decisionRevision), item.decision.decidedAt, item.decision.decidedBy,
          );
        }
        const accepted = semantic.items.filter((item) => item.decision.disposition === 'ACCEPTED').length;
        database.prepare(`
          INSERT INTO asset_proposal_applications(
            project_id, proposal_id, application_revision, accepted_count,
            rejected_count, applied_at, applied_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          project.projectHead.projectId, proposal.proposalId, safeRevision(semantic.appliedRevision),
          accepted, semantic.items.length - accepted, semantic.appliedAt, semantic.appliedBy,
        );
      }

      const findingsByVersion = new Map();
      for (const finding of project.assetLibrary.findings) {
        const key = `${finding.assetId}:${finding.assetVersion}`;
        findingsByVersion.set(key, [...(findingsByVersion.get(key) ?? []), finding]);
      }
      for (const version of project.assetLibrary.versions) {
        database.prepare(`
          INSERT INTO asset_versions(
            project_id, asset_id, asset_version, metadata_version,
            previous_asset_version, name, kind, lifecycle, slice_id, slice_version,
            metadata_json, metadata_fingerprint, findings_fingerprint,
            accepted_warning_ids_json, created_revision, created_at, created_by,
            proposal_id, proposal_item_id, provenance
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'bundle_import')
        `).run(
          project.projectHead.projectId, version.assetId, version.assetVersion, version.metadataVersion,
          version.previousAssetVersion, version.name, version.kind, version.lifecycle, version.sliceId,
          version.sliceVersion, JSON.stringify(version.metadata), version.metadataFingerprint,
          version.findingsFingerprint, JSON.stringify(version.acceptedWarningIds), safeRevision(version.createdRevision),
          version.createdAt, version.createdBy, version.proposalId, version.proposalItemId,
        );
        const versionBinding = project.assetLibrary.sliceBindings.find((binding) => (
          binding.sliceId === version.sliceId && binding.sliceVersion === version.sliceVersion
        ));
        insertReference.run(project.projectHead.projectId, 'asset_version', `${version.assetId}.v${version.assetVersion}`, versionBinding.artifactDigest, safeRevision(version.createdRevision));
        for (const finding of findingsByVersion.get(`${version.assetId}:${version.assetVersion}`) ?? []) insertFinding(database, 'asset_version_findings', {
          projectId: project.projectHead.projectId, assetId: version.assetId, assetVersion: version.assetVersion,
        }, finding);
      }
      for (const head of project.assetLibrary.heads) {
        database.prepare(`
          INSERT INTO asset_heads(
            project_id, asset_id, asset_version, metadata_version, name, kind,
            lifecycle, slice_id, slice_version, updated_revision
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          project.projectHead.projectId, head.assetId, head.assetVersion, head.metadataVersion,
          head.name, head.kind, head.lifecycle, head.sliceId, head.sliceVersion,
          safeRevision(head.updatedRevision),
        );
        for (const [tagOrder, tag] of head.tags.entries()) database.prepare(`
          INSERT INTO asset_head_tags(project_id, asset_id, tag, tag_order) VALUES (?, ?, ?, ?)
        `).run(project.projectHead.projectId, head.assetId, tag, tagOrder);
      }

      materializePortableRoomLibrary(database, project, safeRevision);

      database.prepare(`
        INSERT INTO bundle_imports(
          project_id, import_id, schema_version, source_bundle_digest, manifest_digest,
          imported_revision, imported_at, provenance
        ) VALUES (?, ?, 1, ?, ?, ?, ?, 'bundle_import')
      `).run(project.projectHead.projectId, importId, projectDigest, manifestDigest, project.projectHead.revision, project.projectHead.updatedAt);
      for (const job of project.appliedJobHistory) {
        database.prepare(`
          INSERT INTO bundle_import_applied_jobs(
            project_id, import_id, job_id, job_kind, input_revision,
            applied_revision, atlas_id, source_id, input_fingerprint, processor_id,
            input_json, output_json, result_json, events_json, created_at,
            started_at, finished_at, provenance
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'bundle_import')
        `).run(
          project.projectHead.projectId, importId, job.jobId, job.kind,
          safeRevision(job.inputRevision), safeRevision(job.appliedRevision), job.atlasId,
          job.sourceId, job.inputFingerprint, job.processorId, JSON.stringify(job.input),
          JSON.stringify(job.outputs), JSON.stringify(job.result), JSON.stringify(job.events),
          job.createdAt, job.startedAt, job.finishedAt,
        );
        for (const output of job.outputs) insertReference.run(project.projectHead.projectId, 'bundle_import_job_output', job.jobId, output.digest, safeRevision(job.appliedRevision));
      }
    });
    faultInjector?.('after_bundle_materialize');
    const integrity = await verifyWorkspaceIntegrity({ projectStore: store, artifactStore: cas });
    invariant(integrity.ok, 'BUNDLE_IMPORT_INTEGRITY_FAILED', 'Imported workspace failed integrity verification.', { findings: integrity });
    store.close();
    return { databasePath, integrity };
  } catch (error) {
    store.close();
    throw error;
  }
}

export async function importSqliteProjectBundle({
  bundleDirectory,
  destinationDirectory,
  databaseFactory,
  faultInjector = null,
  limits = PROJECT_BUNDLE_LIMITS,
}) {
  return importPortableProjectBundle({
    bundleDirectory,
    destinationDirectory,
    limits,
    semanticValidator: validateSqlitePortableProject,
    materialize: (input) => materializeSqliteBundle({ ...input, databaseFactory, faultInjector }),
  });
}
