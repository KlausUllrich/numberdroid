import { COMMAND_DEFINITIONS, KNOWN_GRANT_SCOPES, getCommandDefinition, listCommandDefinitions } from '../../domain/src/command-catalog.js';
import {
  ATLAS_PROCESSOR_ID,
  canonicalRgbaPngByteSize,
  proposeRegularGrid,
  validateAtlasRectangles,
} from '../../domain/src/atlas-definition.js';
import {
  evaluateAssetLifecycle,
  validateAssetMetadata,
  validateAssetProposal,
  validateExactSliceBinding,
} from '../../domain/src/asset-definition.js';
import {
  evaluateRoomLifecycle,
  forkFinalRoomVariant,
  validateRoomArchetype,
  validateRoomPlacementProposal,
  validateRoomVariant,
} from '../../domain/src/room-definition.js';
import { StudioError, invariant } from '../../domain/src/errors.js';
import { headRevision } from './project-store.js';
import {
  optionalString,
  requireActor,
  requireArtifactUri,
  requireEnum,
  requireId,
  requireInteger,
  requireIsoDate,
  requireRecord,
  requireString,
} from '../../domain/src/validation.js';
import { deepClone, deepFreeze, fingerprint } from './value-utils.js';

const PROJECT_STATUSES = ['draft', 'active', 'paused', 'in_review', 'archived'];
const SOURCE_MEDIA_TYPES = ['image/png', 'image/webp'];
const ASSET_KINDS = ['surface', 'prop', 'item'];
const ASSET_STATUSES = ['draft', 'in_review'];
const SOURCE_ORIGINS = ['human_upload', 'imported_generation'];
const SOURCE_REVIEW_DECISIONS = ['APPROVED', 'REJECTED'];
const CANONICAL_ARTIFACT_URI = /^studio:\/\/artifacts\/sha256\/[a-f0-9]{64}$/;

const AUTHORITY_FIELDS = ['actor', 'taskId', 'grantId', 'branchId', 'bindingToken', 'issuerActorId'];

function validateExecutionContext(raw) {
  const context = requireRecord(raw, 'trustedExecutionContext');
  const actor = requireActor(context.actor);
  return {
    actor,
    taskId: context.taskId === undefined || context.taskId === null ? null : requireId(context.taskId, 'trustedExecutionContext.taskId'),
    grantId: context.grantId === undefined || context.grantId === null ? null : requireId(context.grantId, 'trustedExecutionContext.grantId'),
    branchId: context.branchId === undefined || context.branchId === null ? null : requireId(context.branchId, 'trustedExecutionContext.branchId'),
    correlationId: context.correlationId === undefined || context.correlationId === null
      ? null
      : requireId(context.correlationId, 'trustedExecutionContext.correlationId'),
  };
}

function validateEnvelope(raw, rawExecutionContext) {
  const envelope = requireRecord(raw, 'command');
  for (const field of AUTHORITY_FIELDS) {
    invariant(!Object.hasOwn(envelope, field), 'UNTRUSTED_AUTHORITY_FIELD', `Command DTO must not contain authority field: ${field}.`, {
      field,
    });
  }
  const executionContext = validateExecutionContext(rawExecutionContext);
  const schemaVersion = requireInteger(envelope.schemaVersion, 'schemaVersion', { min: 1 });
  const type = requireString(envelope.type, 'type', { max: 100 });
  const dryRun = envelope.dryRun === undefined ? false : envelope.dryRun;
  const baseRevision = requireInteger(envelope.baseRevision, 'baseRevision', { min: 0 });
  const expectedVersion = requireInteger(envelope.expectedVersion, 'expectedVersion', { min: 0 });
  invariant(getCommandDefinition(type), 'UNKNOWN_COMMAND', `Unknown Studio command: ${type}.`, { type });
  invariant(schemaVersion === 1, 'SCHEMA_VERSION_UNSUPPORTED', 'Unsupported Studio command schema version.', {
    schemaVersion,
    supported: [1],
  });
  invariant(typeof dryRun === 'boolean', 'VALIDATION_ERROR', 'dryRun must be a boolean.', { field: 'dryRun' });
  invariant(
    baseRevision === expectedVersion,
    'VERSION_INVARIANT_VIOLATION',
    'Checkpoint 1A requires expectedVersion to equal the project baseRevision.',
    { baseRevision, expectedVersion },
  );
  const payload = requireRecord(envelope.payload ?? {}, 'payload');
  assertNoEmbeddedDataUris(payload);
  return {
    schemaVersion,
    commandId: requireId(envelope.commandId, 'commandId'),
    idempotencyKey: requireId(envelope.idempotencyKey, 'idempotencyKey'),
    type,
    projectId: requireId(envelope.projectId, 'projectId'),
    baseRevision,
    expectedVersion,
    dryRun,
    ...executionContext,
    payload,
  };
}

function assertNoEmbeddedDataUris(value, path = 'payload') {
  if (typeof value === 'string') {
    invariant(!value.trimStart().startsWith('data:'), 'EMBEDDED_ARTIFACT_FORBIDDEN', 'Payloads must use artifact URIs, not embedded data URIs.', {
      field: path,
    });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertNoEmbeddedDataUris(child, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) assertNoEmbeddedDataUris(child, `${path}.${key}`);
  }
}

function assertExactFields(record, allowed, label) {
  for (const key of Object.keys(record)) {
    invariant(allowed.has(key), 'VALIDATION_ERROR', `${label} contains an unsupported field: ${key}.`, { field: key });
  }
}

function commandFingerprint(command) {
  return fingerprint({
    schemaVersion: command.schemaVersion,
    type: command.type,
    projectId: command.projectId,
    baseRevision: command.baseRevision,
    expectedVersion: command.expectedVersion,
    actor: command.actor,
    taskId: command.taskId,
    grantId: command.grantId,
    branchId: command.branchId,
    payload: command.payload,
  });
}

function findCommandRevision(document, commandId) {
  return document.revisions.find((revision) => revision.command.commandId === commandId) ?? null;
}

function findIdempotentRevision(document, key) {
  return document.revisions.find((revision) => revision.command.idempotencyKey === key) ?? null;
}

function replayResult(revision) {
  return deepFreeze({
    schemaVersion: 1,
    projectId: revision.event.projectId,
    revision: revision.number,
    value: deepClone(revision.result),
    event: deepClone(revision.event),
    replayed: true,
  });
}

function committedResult(revision) {
  return deepFreeze({
    schemaVersion: 1,
    projectId: revision.event.projectId,
    revision: revision.number,
    value: deepClone(revision.result),
    event: deepClone(revision.event),
    replayed: false,
  });
}

function proposalResult(revision, definition) {
  const value = {
    schemaVersion: 1,
    projectId: revision.event.projectId,
    revision: revision.parentRevision,
    value: deepClone(revision.result),
    event: null,
    replayed: false,
    dryRun: true,
    proposal: {
      commandType: revision.command.type,
      baseRevision: revision.parentRevision,
      expectedVersion: revision.parentRevision,
      wouldCreateRevision: revision.number,
      summary: revision.event.summary,
      changes: deepClone(revision.event.changes),
      findings: [],
      requiredCapabilities: definition.requiredScope ? [definition.requiredScope] : [],
    },
  };
  if (revision.command.type === 'asset.proposal.submit') {
    const proposal = revision.snapshot.assetLibrary?.proposals?.find((candidate) => candidate.proposalId === revision.result.proposalId);
    value.proposal.assetProposal = proposal ? {
      proposalId: proposal.proposalId,
      proposalVersion: proposal.proposalVersion,
      fingerprint: proposal.fingerprint,
      items: proposal.items.map((item) => ({
        ordinal: item.ordinal,
        itemId: item.itemId,
        assetId: item.assetId,
        operation: item.operation,
        diff: deepClone(item.diff),
        findings: deepClone(item.findings),
      })),
    } : null;
    value.proposal.findings = proposal?.items.flatMap((item) => deepClone(item.findings)) ?? [];
  }
  if (revision.command.type === 'room.placement.proposal.submit') {
    const proposal = revision.snapshot.roomLibrary?.proposals?.find((candidate) => candidate.proposalId === revision.result.proposalId);
    value.proposal.roomPlacementProposal = proposal ? {
      proposalId: proposal.proposalId,
      proposalVersion: proposal.proposalVersion,
      roomVariantId: proposal.roomVariantId,
      expectedRoomVariantVersion: proposal.expectedRoomVariantVersion,
      fingerprint: proposal.fingerprint,
      items: proposal.items.map((item) => ({
        ordinal: item.ordinal,
        itemId: item.itemId,
        operation: item.operation,
        diff: deepClone(item.diff),
      })),
    } : null;
    value.proposal.findings = proposal?.findings ? deepClone(proposal.findings) : [];
  }
  return deepFreeze(value);
}

function redactAgentOnlySourceLocations(snapshot) {
  const redacted = deepClone(snapshot);
  redacted.sources = redacted.sources.map((source) => (
    /^studio:\/\/artifacts\/sha256\/[a-f0-9]{64}$/.test(source.artifactUri)
      ? source
      : { ...source, artifactUri: null, artifactAvailability: 'LEGACY_EXTERNAL_LOCATION_REDACTED' }
  ));
  for (const proposal of redacted.assetLibrary?.proposals ?? []) {
    if (proposal.proposer) {
      delete proposal.proposer.grantId;
      delete proposal.proposer.branchId;
    }
  }
  for (const proposal of redacted.roomLibrary?.proposals ?? []) {
    if (proposal.proposer) {
      delete proposal.proposer.grantId;
      delete proposal.proposer.branchId;
    }
  }
  return redacted;
}

function assertReplayMatches(revision, incomingFingerprint) {
  invariant(
    revision.command.fingerprint === incomingFingerprint,
    'IDEMPOTENCY_CONFLICT',
    'The idempotency key was already used for a different command.',
    {
      idempotencyKey: revision.command.idempotencyKey,
      originalCommandId: revision.command.commandId,
      originalRevision: revision.number,
    },
  );
}

function previewOutputArtifactBytes(snapshot, atlasId) {
  const atlas = snapshot.atlases?.find((candidate) => candidate.id === atlasId);
  invariant(atlas && Array.isArray(atlas.rectangles), 'ENTITY_NOT_FOUND', 'The atlas definition does not exist.', { atlasId });
  let total = 0;
  for (const rectangle of atlas.rectangles.filter((candidate) => candidate.included)) {
    const byteSize = canonicalRgbaPngByteSize(rectangle.width, rectangle.height);
    invariant(total <= Number.MAX_SAFE_INTEGER - byteSize, 'ATLAS_OUTPUT_LIMIT', 'Atlas preview byte accounting overflowed.');
    total += byteSize;
  }
  invariant(total > 0, 'ATLAS_RECT_INVALID', 'Atlas preview requires at least one included rectangle.');
  return total;
}

function commandBudgetCharge(command) {
  if (!['asset.proposal.submit', 'room.placement.proposal.submit'].includes(command.type)) return 1;
  invariant(
    Array.isArray(command.payload?.items)
      && command.payload.items.length >= 1
      && command.payload.items.length <= 64,
    command.type === 'asset.proposal.submit' ? 'ASSET_PROPOSAL_LIMIT' : 'ROOM_PROPOSAL_LIMIT',
    'Proposals require 1 to 64 items.',
  );
  return command.payload.items.length;
}

function assertAuthorized(command, snapshot, definition, now) {
  if (command.actor.kind === 'human' && command.actor.id === snapshot.project.ownerId) {
    return;
  }

  invariant(!definition.ownerOnly, 'FORBIDDEN', 'Only the project owner may run this command.', {
    commandType: command.type,
  });
  invariant(command.actor.kind === 'agent', 'FORBIDDEN', 'This command requires the project owner or a granted agent.');
  invariant(command.taskId && command.grantId, 'GRANT_REQUIRED', 'Agent commands require taskId and grantId.', {
    commandType: command.type,
  });

  const grant = snapshot.grants.find((candidate) => candidate.id === command.grantId);
  invariant(grant, 'GRANT_NOT_FOUND', 'The requested grant does not exist.', { grantId: command.grantId });
  invariant(grant.revokedAt === null, 'GRANT_REVOKED', 'The requested grant has been revoked.', {
    grantId: grant.id,
  });
  invariant(grant.agentId === command.actor.id, 'GRANT_ACTOR_MISMATCH', 'The grant belongs to another agent.', {
    grantId: grant.id,
  });
  invariant(grant.taskId === command.taskId, 'GRANT_TASK_MISMATCH', 'The grant belongs to another task.', {
    grantId: grant.id,
  });
  invariant(grant.branchId === command.branchId, 'GRANT_BRANCH_MISMATCH', 'The grant belongs to another branch.', {
    expectedBranchId: grant.branchId,
  });
  invariant(!grant.expiresAt || Date.parse(grant.expiresAt) > Date.parse(now), 'GRANT_EXPIRED', 'The grant has expired.', {
    grantId: grant.id,
    expiresAt: grant.expiresAt,
  });
  invariant(grant.scopes.includes(definition.requiredScope), 'GRANT_SCOPE_MISSING', 'The grant lacks the required scope.', {
    grantId: grant.id,
    requiredScope: definition.requiredScope,
  });
  invariant(
    grant.objectScopes.some((scope) => scope.kind === 'project' && scope.id === command.projectId),
    'OBJECT_SCOPE_DENIED',
    'The grant does not cover this project object scope.',
  );
  const commandCharge = commandBudgetCharge(command);
  invariant(grant.usage.commands + commandCharge <= grant.budget.maxCommands, 'BUDGET_EXCEEDED', 'The command would exceed the grant command budget.', {
    consumed: grant.usage.commands,
    requested: commandCharge,
    limit: grant.budget.maxCommands,
  });
  if (command.type === 'source.intake.commit') {
    const byteSize = requireInteger(command.payload?.byteSize, 'payload.byteSize', { min: 1 });
    invariant(
      grant.usage.artifactBytes + byteSize <= grant.budget.maxArtifactBytes,
      'BUDGET_EXCEEDED',
      'The source intake would exceed the grant artifact byte budget.',
      { consumed: grant.usage.artifactBytes, requested: byteSize, limit: grant.budget.maxArtifactBytes },
    );
  }
  if (command.type === 'atlas.preview.slices') {
    const outputArtifactBytes = previewOutputArtifactBytes(snapshot, command.payload?.atlasId);
    invariant(grant.usage.jobs < grant.budget.maxJobs, 'BUDGET_EXCEEDED', 'The grant job budget is exhausted.', {
      consumed: grant.usage.jobs,
      limit: grant.budget.maxJobs,
    });
    invariant(
      grant.usage.artifactBytes + outputArtifactBytes <= grant.budget.maxArtifactBytes,
      'BUDGET_EXCEEDED',
      'The deterministic preview outputs would exceed the grant artifact byte budget.',
      { consumed: grant.usage.artifactBytes, requested: outputArtifactBytes, limit: grant.budget.maxArtifactBytes },
    );
  }
}

function validateScopes(value) {
  invariant(Array.isArray(value) && value.length > 0, 'VALIDATION_ERROR', 'scopes must be a non-empty array.');
  const scopes = [...new Set(value.map((scope, index) => requireString(scope, `scopes[${index}]`, { max: 100 })))];
  for (const scope of scopes) {
    invariant(KNOWN_GRANT_SCOPES.includes(scope), 'VALIDATION_ERROR', `Unknown grant scope: ${scope}.`, { scope });
  }
  return scopes.sort();
}

function validateObjectScopes(value) {
  invariant(Array.isArray(value) && value.length > 0, 'VALIDATION_ERROR', 'objectScopes must be a non-empty array.');
  return value.map((candidate, index) => {
    const scope = requireRecord(candidate, `payload.objectScopes[${index}]`);
    return {
      kind: requireString(scope.kind, `payload.objectScopes[${index}].kind`, { max: 100 }),
      id: requireId(scope.id, `payload.objectScopes[${index}].id`),
    };
  });
}

function validateBudget(value) {
  const budget = requireRecord(value, 'payload.budget');
  return {
    maxCommands: requireInteger(budget.maxCommands, 'payload.budget.maxCommands', { min: 1 }),
    maxJobs: requireInteger(budget.maxJobs, 'payload.budget.maxJobs', { min: 0 }),
    maxArtifactBytes: requireInteger(budget.maxArtifactBytes, 'payload.budget.maxArtifactBytes', { min: 0 }),
    maxCostCents: budget.maxCostCents === undefined
      ? 0
      : requireInteger(budget.maxCostCents, 'payload.budget.maxCostCents', { min: 0 }),
  };
}

function nullableString(value, field, { max = 500 } = {}) {
  return value === null ? null : requireString(value, field, { max });
}

const PROVENANCE_SECRET_KEY = /(?:api.?key|auth(?:orization)?|cookie|credential|password|private.?key|secret|token)/i;
const PROVENANCE_LOCATION_VALUE = /^(?:[A-Za-z][A-Za-z0-9+.-]*:|[\\/]|[A-Za-z]:[\\/])|(?:^|[\\/])\.\.(?:[\\/]|$)/;

function validateProvenanceParameters(value) {
  let nodes = 0;
  function visit(candidate, field, depth) {
    nodes += 1;
    invariant(nodes <= 200 && depth <= 5, 'VALIDATION_ERROR', 'payload.provenance.parameters exceeds its structural bounds.');
    if (candidate === null || typeof candidate === 'boolean') return candidate;
    if (typeof candidate === 'number') {
      invariant(Number.isFinite(candidate), 'VALIDATION_ERROR', `${field} must be finite.`);
      return candidate;
    }
    if (typeof candidate === 'string') {
      invariant(candidate.length <= 2000, 'VALIDATION_ERROR', `${field} is too long.`);
      invariant(!PROVENANCE_LOCATION_VALUE.test(candidate), 'PROVENANCE_PARAMETER_FORBIDDEN', 'Provenance parameters cannot contain paths or URIs.', { field });
      return candidate;
    }
    if (Array.isArray(candidate)) {
      invariant(candidate.length <= 50, 'VALIDATION_ERROR', `${field} has too many entries.`);
      return candidate.map((entry, index) => visit(entry, `${field}[${index}]`, depth + 1));
    }
    const record = requireRecord(candidate, field);
    const entries = Object.entries(record);
    invariant(entries.length <= 50, 'VALIDATION_ERROR', `${field} has too many fields.`);
    return Object.fromEntries(entries.map(([key, entry]) => {
      invariant(key.length > 0 && key.length <= 100, 'VALIDATION_ERROR', `${field} has an invalid parameter name.`);
      invariant(!PROVENANCE_SECRET_KEY.test(key), 'PROVENANCE_PARAMETER_FORBIDDEN', 'Provenance parameters cannot contain secret-bearing fields.', { field: `${field}.${key}` });
      return [key, visit(entry, `${field}.${key}`, depth + 1)];
    }));
  }
  const result = visit(requireRecord(value, 'payload.provenance.parameters'), 'payload.provenance.parameters', 0);
  invariant(Buffer.byteLength(JSON.stringify(result), 'utf8') <= 16 * 1024, 'VALIDATION_ERROR', 'payload.provenance.parameters is too large.');
  return result;
}

function validateProvenanceV2(value) {
  const provenance = requireRecord(value, 'payload.provenance');
  invariant(Array.isArray(provenance.referenceArtifactUris), 'VALIDATION_ERROR', 'payload.provenance.referenceArtifactUris must be an array.');
  invariant(provenance.referenceArtifactUris.length <= 100, 'VALIDATION_ERROR', 'payload.provenance.referenceArtifactUris has too many entries.');
  const referenceArtifactUris = provenance.referenceArtifactUris.map((uri, index) => {
    const canonical = requireArtifactUri(uri, `payload.provenance.referenceArtifactUris[${index}]`);
    invariant(CANONICAL_ARTIFACT_URI.test(canonical), 'ARTIFACT_URI_REQUIRED', 'V2 provenance references require canonical Studio CAS URIs.', {
      field: `payload.provenance.referenceArtifactUris[${index}]`,
    });
    return canonical;
  });
  invariant(Array.isArray(provenance.parentSourceIds), 'VALIDATION_ERROR', 'payload.provenance.parentSourceIds must be an array.');
  invariant(provenance.parentSourceIds.length <= 100, 'VALIDATION_ERROR', 'payload.provenance.parentSourceIds has too many entries.');
  const parentSourceIds = provenance.parentSourceIds.map((sourceId, index) => (
    requireId(sourceId, `payload.provenance.parentSourceIds[${index}]`)
  ));
  invariant(new Set(parentSourceIds).size === parentSourceIds.length, 'VALIDATION_ERROR', 'payload.provenance.parentSourceIds must be unique.');
  const seed = provenance.seed;
  invariant(
    typeof seed === 'string' || typeof seed === 'number' && Number.isFinite(seed) || seed === null,
    'VALIDATION_ERROR',
    'payload.provenance.seed must be a string, finite number, or null.',
  );
  const result = {
    origin: requireEnum(provenance.origin, 'payload.provenance.origin', SOURCE_ORIGINS),
    prompt: nullableString(provenance.prompt, 'payload.provenance.prompt', { max: 20000 }),
    negativePrompt: nullableString(provenance.negativePrompt, 'payload.provenance.negativePrompt', { max: 20000 }),
    seed,
    provider: nullableString(provenance.provider, 'payload.provenance.provider'),
    model: nullableString(provenance.model, 'payload.provenance.model'),
    modelVersion: nullableString(provenance.modelVersion, 'payload.provenance.modelVersion'),
    generator: nullableString(provenance.generator, 'payload.provenance.generator'),
    parameters: validateProvenanceParameters(provenance.parameters),
    referenceArtifactUris,
    parentSourceIds,
  };
  if (result.origin === 'human_upload') {
    invariant(
      result.prompt === null && result.negativePrompt === null && result.seed === null
        && result.provider === null && result.model === null && result.modelVersion === null
        && result.generator === null && Object.keys(result.parameters).length === 0,
      'VALIDATION_ERROR',
      'human_upload provenance cannot include generation metadata.',
    );
  } else {
    invariant(result.prompt && result.provider && result.model, 'VALIDATION_ERROR', 'imported_generation provenance requires prompt, provider, and model.');
  }
  return result;
}

function sourceReview(source) {
  return source.review ?? {
    disposition: 'PENDING',
    proposedAt: null,
    proposedBy: null,
    proposalNote: null,
    decidedAt: null,
    decidedBy: null,
    decisionNote: null,
  };
}

function approvedPngSource(snapshot, sourceId) {
  const source = snapshot.sources.find((candidate) => candidate.id === sourceId);
  invariant(source, 'ENTITY_NOT_FOUND', 'The atlas source does not exist.', { sourceId });
  invariant(
    source.schemaVersion === 2
      && source.lifecycle?.state === 'APPROVED_SOURCE'
      && source.review?.disposition === 'USER_APPROVED',
    'ATLAS_SOURCE_NOT_APPROVED',
    'Atlas cutting requires an explicitly user-approved V2 source.',
    { sourceId, lifecycle: source.lifecycle?.state, disposition: source.review?.disposition },
  );
  invariant(source.mediaType === 'image/png', 'ATLAS_PNG_UNSUPPORTED', 'Checkpoint 2B cuts approved PNG sources only.', {
    sourceId,
    mediaType: source.mediaType,
  });
  const digest = CANONICAL_ARTIFACT_URI.exec(source.artifactUri)?.[0]?.slice('studio://artifacts/sha256/'.length);
  invariant(digest && /^[a-f0-9]{64}$/.test(digest), 'ARTIFACT_URI_REQUIRED', 'Atlas source must use a canonical Studio CAS URI.', { sourceId });
  return { source, digest };
}

function assertAtlasHead(atlas, payload) {
  invariant(atlas, 'ENTITY_NOT_FOUND', 'The atlas definition does not exist.', { atlasId: payload.atlasId });
  invariant(
    atlas.definitionVersion === payload.expectedAtlasVersion,
    'ENTITY_VERSION_CONFLICT',
    'The atlas definition changed after this operation was prepared.',
    { atlasId: atlas.id, expectedVersion: payload.expectedAtlasVersion, actualVersion: atlas.definitionVersion },
  );
  invariant(
    atlas.definitionFingerprint === payload.expectedDefinitionFingerprint,
    'ENTITY_VERSION_CONFLICT',
    'The atlas definition fingerprint changed after this operation was prepared.',
    { atlasId: atlas.id },
  );
}

function externalJobProjection(job) {
  const projected = deepClone(job);
  delete projected.idempotencyKey;
  delete projected.lease;
  if (projected.creator) delete projected.creator.grantId;
  if (Array.isArray(projected.outputs)) {
    const ready = ['SUCCEEDED', 'APPLIED'].includes(projected.state);
    projected.outputs = projected.outputs.map((output) => ({
      ...output,
      preview: {
        schemaVersion: 1,
        state: ready ? 'READY' : 'MISSING',
        resourceUri: ready
          ? `/api/projects/${encodeURIComponent(projected.projectId)}/artifacts/sha256/${output.digest}`
          : null,
        alt: `Atlas preview ${output.rectangleId}`,
      },
    }));
  }
  return projected;
}

function externalJobEventProjection(event) {
  return {
    schemaVersion: 1,
    sequence: event.sequence,
    attempt: event.attempt,
    type: event.type,
    state: event.state,
    safePoint: event.safePoint,
    progress: deepClone(event.progress),
    details: deepClone(event.details),
    occurredAt: event.occurredAt,
  };
}

function assertJobOriginAuthority(job, executionContext, snapshot) {
  if (executionContext.actor.kind === 'human' && executionContext.actor.id === snapshot.project.ownerId) return;
  invariant(
    executionContext.actor.kind === 'agent'
      && job.creator?.actor?.kind === 'agent'
      && job.creator.actor.id === executionContext.actor.id
      && job.creator.taskId === executionContext.taskId
      && job.creator.branchId === executionContext.branchId
      && job.creator.grantId === executionContext.grantId,
    'JOB_AUTHORITY_MISMATCH',
    'This job belongs to another task or HostBinding.',
  );
}

function currentSlice(snapshot, sliceId) {
  const matches = [];
  for (const atlas of snapshot.atlases ?? []) {
    for (const slice of atlas.sliceHeads ?? []) {
      if (slice.sliceId === sliceId) matches.push({ atlas, slice });
    }
  }
  invariant(matches.length > 0, 'ASSET_SLICE_NOT_FOUND', 'The requested committed slice head does not exist.', { sliceId });
  invariant(matches.length === 1, 'ASSET_SLICE_AMBIGUOUS', 'A slice identity appears under multiple atlas heads.', { sliceId });
  return matches[0];
}

function resolveExactSliceBinding(document, projectId, sliceId, expectedSliceVersion) {
  const head = headRevision(document);
  const { slice } = currentSlice(head.snapshot, sliceId);
  invariant(slice.version === expectedSliceVersion, 'ENTITY_VERSION_CONFLICT', 'The committed slice changed after the asset proposal was prepared.', {
    sliceId,
    expectedVersion: expectedSliceVersion,
    actualVersion: slice.version,
  });
  const committedRevision = document.revisions.find((revision) => {
    try {
      const candidate = currentSlice(revision.snapshot, sliceId).slice;
      return candidate.version === slice.version && candidate.digest === slice.digest;
    } catch (error) {
      if (['ASSET_SLICE_NOT_FOUND', 'ASSET_SLICE_AMBIGUOUS'].includes(error?.code)) return false;
      throw error;
    }
  })?.number;
  invariant(committedRevision, 'ASSET_SLICE_HISTORY_MISSING', 'The exact slice version has no semantic revision lineage.', { sliceId, expectedSliceVersion });
  const {
    rectangleId: _rectangleId,
    ...rectangle
  } = slice.rectangle;
  return validateExactSliceBinding({
    projectId,
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
    digest: slice.digest,
    artifactUri: slice.artifactUri,
    mediaType: slice.mediaType,
    byteSize: slice.byteSize,
    width: slice.width,
    height: slice.height,
    priorDigest: slice.priorDigest,
    committedRevision,
  });
}

function prepareAssetProposal(command, document) {
  invariant(command.payload.expectedRevision === command.baseRevision, 'REVISION_CONFLICT', 'The proposal expectedRevision must equal the command base revision.', {
    expectedRevision: command.payload.expectedRevision,
    baseRevision: command.baseRevision,
  });
  const normalized = validateAssetProposal({
    projectId: command.projectId,
    proposalId: command.payload.proposalId,
    expectedRevision: command.payload.expectedRevision,
    items: command.payload.items,
  });
  const items = normalized.items.map((item) => {
    const sliceBinding = resolveExactSliceBinding(document, command.projectId, item.sliceId, item.expectedSliceVersion);
    const validated = validateAssetMetadata({
      assetId: item.assetId,
      kind: item.kind,
      metadata: item.metadata,
      sliceBinding,
    });
    return {
      ...item,
      metadata: validated.metadata,
      sliceBinding,
      findings: validated.findings,
      metadataFingerprint: validated.fingerprint,
      decision: null,
    };
  });
  const proposalFingerprint = fingerprint({
    schemaVersion: 1,
    projectId: normalized.projectId,
    proposalId: normalized.proposalId,
    expectedRevision: normalized.expectedRevision,
    items: items.map(({ decision: _decision, ...item }) => item),
  });
  return { ...normalized, items, fingerprint: proposalFingerprint };
}

function assetLibrary(snapshot) {
  snapshot.assetLibrary ??= { schemaVersion: 1, assets: [], proposals: [] };
  return snapshot.assetLibrary;
}

function proposalHead(library, proposalId) {
  const index = library.proposals.findIndex((proposal) => proposal.proposalId === proposalId);
  invariant(index >= 0, 'ASSET_PROPOSAL_NOT_FOUND', 'The asset proposal does not exist.', { proposalId });
  return { index, proposal: library.proposals[index] };
}

function assertCurrentProposalSlice(snapshot, item) {
  const { slice } = currentSlice(snapshot, item.sliceBinding.sliceId);
  invariant(
    slice.version === item.sliceBinding.sliceVersion && slice.digest === item.sliceBinding.digest,
    'ASSET_SLICE_STALE',
    'A committed slice changed after proposal submission.',
    {
      sliceId: item.sliceBinding.sliceId,
      expectedVersion: item.sliceBinding.sliceVersion,
      actualVersion: slice.version,
    },
  );
}

function roomLibrary(snapshot) {
  snapshot.roomLibrary ??= { schemaVersion: 1, archetypes: [], variants: [], proposals: [] };
  return snapshot.roomLibrary;
}

function roomArchetypeValue(archetype) {
  return {
    projectId: archetype.projectId,
    roomArchetypeId: archetype.roomArchetypeId,
    version: archetype.version,
    kind: archetype.kind,
    displayName: archetype.displayName,
    tags: deepClone(archetype.tags),
    dimensionPolicy: deepClone(archetype.dimensionPolicy),
    structuralBands: deepClone(archetype.structuralBands),
    orientation: archetype.orientation,
    connectorPolicy: deepClone(archetype.connectorPolicy),
    allowedAssetKinds: deepClone(archetype.allowedAssetKinds),
    allowedTags: deepClone(archetype.allowedTags),
    requiredTags: deepClone(archetype.requiredTags),
    rationality: archetype.rationality,
    governingRuleRefs: deepClone(archetype.governingRuleRefs),
  };
}

function roomVariantValue(variant) {
  return {
    projectId: variant.projectId,
    roomVariantId: variant.roomVariantId,
    version: variant.version,
    roomArchetypeId: variant.roomArchetypeId,
    archetypeVersion: variant.archetypeVersion,
    displayName: variant.displayName,
    lifecycle: variant.lifecycle,
    width: variant.width,
    height: variant.height,
    origin: deepClone(variant.origin),
    intentTrace: deepClone(variant.intentTrace),
    connectors: deepClone(variant.connectors),
    placements: deepClone(variant.placements),
    acceptedWarningFindingIds: deepClone(variant.acceptedWarningFindingIds),
    parentVariantVersion: variant.parentVariantVersion,
    parentFinalVersion: variant.parentFinalVersion,
  };
}

function roomArchetypeHead(library, roomArchetypeId, version = null) {
  const archetype = library.archetypes.find((candidate) => (
    candidate.roomArchetypeId === roomArchetypeId && (version === null || candidate.version === version)
  ));
  invariant(archetype, 'ROOM_ARCHETYPE_NOT_FOUND', 'The room archetype version does not exist.', { roomArchetypeId, version });
  return archetype;
}

function roomVariantHead(library, roomVariantId) {
  const entry = library.variants.find((candidate) => candidate.roomVariantId === roomVariantId);
  invariant(entry, 'ROOM_VARIANT_NOT_FOUND', 'The room variant does not exist.', { roomVariantId });
  const variant = entry.versions.find((candidate) => candidate.version === entry.headVersion);
  invariant(variant, 'ROOM_VARIANT_HEAD_MISSING', 'The room variant head has no matching immutable version.', { roomVariantId, headVersion: entry.headVersion });
  return { entry, variant };
}

function roomProposalHead(library, proposalId) {
  const index = library.proposals.findIndex((proposal) => proposal.proposalId === proposalId);
  invariant(index >= 0, 'ROOM_PROPOSAL_NOT_FOUND', 'The room placement proposal does not exist.', { proposalId });
  return { index, proposal: library.proposals[index] };
}

function assertRoomVersion(current, expectedRoomVariantVersion) {
  const expected = requireInteger(expectedRoomVariantVersion, 'payload.expectedRoomVariantVersion', { min: 1 });
  invariant(current.version === expected, 'ENTITY_VERSION_CONFLICT', 'The room variant changed after the command was prepared.', {
    roomVariantId: current.roomVariantId,
    expectedVersion: expected,
    actualVersion: current.version,
  });
}

function assertRoomDraft(current) {
  invariant(current.lifecycle === 'DRAFT', 'ROOM_EDIT_REQUIRES_DRAFT', 'Room content edits require a DRAFT head. Fork a FINAL room before editing.', {
    roomVariantId: current.roomVariantId,
    lifecycle: current.lifecycle,
  });
}

function activeRoomProposalIds(library, roomVariantId, roomVariantVersion) {
  return library.proposals
    .filter((proposal) => proposal.roomVariantId === roomVariantId
      && proposal.expectedRoomVariantVersion === roomVariantVersion
      && ['PENDING', 'DECIDED'].includes(proposal.state))
    .map((proposal) => proposal.proposalId)
    .sort();
}

function assertNoActiveRoomProposal(library, current) {
  const proposalIds = activeRoomProposalIds(library, current.roomVariantId, current.version);
  invariant(proposalIds.length === 0, 'ROOM_PROPOSAL_UNRESOLVED', 'Resolve and apply or reject the active room proposal before changing this room version.', {
    roomVariantId: current.roomVariantId,
    proposalIds,
  });
}

function exactRoomAssetVersions(document, placements) {
  const assets = new Map();
  for (const placement of placements) {
    const key = `${placement.assetId}:${placement.assetVersion}:${placement.metadataVersion}`;
    const coordinate = `${placement.assetId}@${placement.assetVersion}:${placement.metadataVersion}`;
    if (assets.has(coordinate)) continue;
    let resolved = null;
    for (const revision of [...document.revisions].reverse()) {
      const candidate = revision.snapshot.assetLibrary?.assets?.find((asset) => (
        asset.assetId === placement.assetId
          && asset.assetVersion === placement.assetVersion
          && asset.metadataVersion === placement.metadataVersion
      ));
      if (candidate) { resolved = candidate; break; }
    }
    invariant(resolved, 'ROOM_ASSET_VERSION_NOT_FOUND', 'A placement must pin an existing exact V2 asset and metadata version.', {
      assetId: placement.assetId,
      assetVersion: placement.assetVersion,
      metadataVersion: placement.metadataVersion,
      coordinate: key,
    });
    assets.set(coordinate, resolved);
  }
  return assets;
}

function validatedRoomVersion({ candidate, archetype, document, findingsUnresolvedProposalIds = [], now, actorId, createdRevision, proposalId = null }) {
  const validated = validateRoomVariant({
    variant: candidate,
    archetype: roomArchetypeValue(archetype),
    assets: exactRoomAssetVersions(document, candidate.placements),
    unresolvedProposalIds: findingsUnresolvedProposalIds,
  });
  return {
    ...validated.variant,
    findings: deepClone(validated.findings),
    contentFingerprint: validated.fingerprint,
    createdAt: now,
    createdBy: actorId,
    createdRevision,
    proposalId,
    provenance: 'native_revision',
  };
}

function appendRoomVersion(entry, version) {
  invariant(version.version === entry.headVersion + 1, 'ROOM_VERSION_CONFLICT', 'Room versions must be consecutive.');
  entry.versions.push(version);
  entry.headVersion = version.version;
  return version;
}

function applyRoomPlacementItems(placements, items, { proposalId = null } = {}) {
  const next = deepClone(placements);
  const diffs = [];
  for (const item of items) {
    if (item.operation === 'add') {
      invariant(!next.some((placement) => placement.placementId === item.placement.placementId), 'ENTITY_EXISTS', 'The placement ID already exists.', { placementId: item.placement.placementId });
      const after = {
        ...deepClone(item.placement),
        proposalId: proposalId ?? item.placement.proposalId,
        proposalItemId: proposalId ? item.itemId : item.placement.proposalItemId,
      };
      next.push(after);
      diffs.push({ itemId: item.itemId, operation: 'add', before: null, after: deepClone(after) });
      continue;
    }
    const index = next.findIndex((placement) => placement.placementId === item.placementId);
    invariant(index >= 0, 'ROOM_PLACEMENT_NOT_FOUND', 'The targeted room placement does not exist.', { placementId: item.placementId });
    const before = deepClone(next[index]);
    invariant(before.assetId === item.expectedAssetId, 'ENTITY_VERSION_CONFLICT', 'The targeted placement now references another asset.', {
      placementId: item.placementId, expectedAssetId: item.expectedAssetId, actualAssetId: before.assetId,
    });
    if (item.operation === 'remove') {
      next.splice(index, 1);
      diffs.push({ itemId: item.itemId, operation: 'remove', before, after: null });
      continue;
    }
    const after = {
      ...before,
      anchor: deepClone(item.anchor),
      rotation: item.rotation,
      proposalId: proposalId ?? before.proposalId,
      proposalItemId: proposalId ? item.itemId : before.proposalItemId,
    };
    next[index] = after;
    diffs.push({ itemId: item.itemId, operation: 'move', before, after: deepClone(after) });
  }
  return { placements: next, diffs };
}

function prepareRoomPlacementProposal(command, document) {
  const normalized = validateRoomPlacementProposal({
    projectId: command.projectId,
    proposalId: command.payload.proposalId,
    roomVariantId: command.payload.roomVariantId,
    expectedRoomVariantVersion: command.payload.expectedRoomVariantVersion,
    items: command.payload.items,
  });
  const library = document.revisions.at(-1).snapshot.roomLibrary ?? { archetypes: [], variants: [], proposals: [] };
  const { variant } = roomVariantHead(library, normalized.roomVariantId);
  assertRoomVersion(variant, normalized.expectedRoomVariantVersion);
  assertRoomDraft(variant);
  invariant(activeRoomProposalIds(library, variant.roomVariantId, variant.version).length === 0, 'ROOM_PROPOSAL_UNRESOLVED', 'Only one active placement proposal may target a room version.', { roomVariantId: variant.roomVariantId });
  for (const item of normalized.items) {
    if (item.operation === 'add') {
      invariant(item.placement.proposalId === null && item.placement.proposalItemId === null, 'UNTRUSTED_AUTHORITY_FIELD', 'Proposal provenance is assigned by Studio, not supplied by the caller.');
    }
  }
  const { placements, diffs } = applyRoomPlacementItems(variant.placements, normalized.items);
  const archetype = roomArchetypeHead(library, variant.roomArchetypeId, variant.archetypeVersion);
  const validated = validateRoomVariant({
    variant: { ...roomVariantValue(variant), placements },
    archetype: roomArchetypeValue(archetype),
    assets: exactRoomAssetVersions(document, placements),
  });
  const items = normalized.items.map((item, index) => ({ ...deepClone(item), ordinal: index, diff: diffs[index], decision: null }));
  const proposalFingerprint = fingerprint({
    schemaVersion: 1,
    projectId: normalized.projectId,
    proposalId: normalized.proposalId,
    roomVariantId: normalized.roomVariantId,
    expectedRoomVariantVersion: normalized.expectedRoomVariantVersion,
    items: items.map(({ decision: _decision, ...item }) => item),
    findings: validated.findings,
  });
  return { ...normalized, items, findings: deepClone(validated.findings), fingerprint: proposalFingerprint };
}

function applyCommand(command, snapshot, now, {
  atlasJob = null,
  priorAtlasJob = null,
  preparedAssetProposal = null,
  preparedRoomProposal = null,
  projectDocument = null,
} = {}) {
  const payload = command.payload;
  const next = deepClone(snapshot);
  next.project.updatedAt = now;
  if (command.actor.kind === 'agent') {
    const grantIndex = next.grants.findIndex((grant) => grant.id === command.grantId);
    next.grants[grantIndex] = {
      ...next.grants[grantIndex],
      usage: {
        ...next.grants[grantIndex].usage,
        commands: next.grants[grantIndex].usage.commands + commandBudgetCharge(command),
      },
    };
  }

  switch (command.type) {
    case 'grant.issue': {
      const grantId = requireId(payload.grantId, 'payload.grantId');
      invariant(!next.grants.some((grant) => grant.id === grantId), 'ENTITY_EXISTS', 'The grant ID already exists.', {
        grantId,
      });
      const taskId = requireId(payload.taskId, 'payload.taskId');
      invariant(command.taskId === null || command.taskId === taskId, 'VALIDATION_ERROR', 'Envelope taskId and grant taskId differ.');
      const grant = {
        id: grantId,
        agentId: requireId(payload.agentId, 'payload.agentId'),
        taskId,
        branchId: requireId(payload.branchId, 'payload.branchId'),
        scopes: validateScopes(payload.scopes),
        objectScopes: validateObjectScopes(payload.objectScopes),
        budget: validateBudget(payload.budget),
        usage: { commands: 0, jobs: 0, artifactBytes: 0, costCents: 0 },
        expiresAt: payload.expiresAt ? requireIsoDate(payload.expiresAt, 'payload.expiresAt') : null,
        issuedAt: now,
        issuedBy: command.actor.id,
        revokedAt: null,
        revokeReason: null,
        status: 'ACTIVE',
      };
      next.grants.push(grant);
      return {
        snapshot: next,
        result: { grantId },
        summary: `Grant ${grantId} issued to ${grant.agentId} for task ${taskId}.`,
        changes: [{ entityType: 'grant', entityId: grantId, operation: 'created' }],
      };
    }
    case 'grant.revoke': {
      const grantId = requireId(payload.grantId, 'payload.grantId');
      const index = next.grants.findIndex((grant) => grant.id === grantId);
      invariant(index >= 0, 'ENTITY_NOT_FOUND', 'The grant does not exist.', { grantId });
      invariant(next.grants[index].revokedAt === null, 'ENTITY_STATE_CONFLICT', 'The grant is already revoked.', {
        grantId,
      });
      next.grants[index] = {
        ...next.grants[index],
        revokedAt: now,
        revokeReason: optionalString(payload.reason, 'payload.reason', { max: 500 }),
        status: 'REVOKED',
      };
      return {
        snapshot: next,
        result: { grantId },
        summary: `Grant ${grantId} revoked.`,
        changes: [{ entityType: 'grant', entityId: grantId, operation: 'revoked' }],
      };
    }
    case 'project.status.set': {
      const status = requireEnum(payload.status, 'payload.status', PROJECT_STATUSES);
      next.project.status = status;
      next.project.statusNote = optionalString(payload.note, 'payload.note', { max: 1000 });
      return {
        snapshot: next,
        result: { status },
        summary: `Project status changed to ${status}.`,
        changes: [{ entityType: 'project', entityId: command.projectId, operation: 'status_changed' }],
      };
    }
    case 'source.register': {
      const sourceId = requireId(payload.sourceId, 'payload.sourceId');
      invariant(!next.sources.some((source) => source.id === sourceId), 'ENTITY_EXISTS', 'The source ID already exists.', {
        sourceId,
      });
      const provenance = requireRecord(payload.provenance, 'payload.provenance');
      const source = {
        id: sourceId,
        name: requireString(payload.name, 'payload.name', { max: 160 }),
        artifactUri: requireArtifactUri(payload.artifactUri, 'payload.artifactUri'),
        mediaType: requireEnum(payload.mediaType, 'payload.mediaType', SOURCE_MEDIA_TYPES),
        width: payload.width === undefined ? null : requireInteger(payload.width, 'payload.width', { min: 1 }),
        height: payload.height === undefined ? null : requireInteger(payload.height, 'payload.height', { min: 1 }),
        provenance: {
          prompt: requireString(provenance.prompt, 'payload.provenance.prompt', { max: 20000 }),
          seed: provenance.seed ?? null,
          model: optionalString(provenance.model, 'payload.provenance.model', { max: 200 }),
          generator: optionalString(provenance.generator, 'payload.provenance.generator', { max: 200 }),
        },
        registeredAt: now,
        registeredBy: command.actor.id,
      };
      invariant(
        typeof source.provenance.seed === 'string' || typeof source.provenance.seed === 'number' || source.provenance.seed === null,
        'VALIDATION_ERROR',
        'payload.provenance.seed must be a string, number, or null.',
      );
      next.sources.push(source);
      return {
        snapshot: next,
        result: { sourceId },
        summary: `Source ${sourceId} registered with reproducible provenance.`,
        changes: [{ entityType: 'source', entityId: sourceId, operation: 'created' }],
      };
    }
    case 'source.intake.commit': {
      const intakeId = requireId(payload.intakeId, 'payload.intakeId');
      const sourceId = requireId(payload.sourceId, 'payload.sourceId');
      invariant(!next.sources.some((source) => source.id === sourceId), 'ENTITY_EXISTS', 'The source ID already exists.', {
        sourceId,
      });
      const artifactUri = requireArtifactUri(payload.artifactUri, 'payload.artifactUri');
      invariant(CANONICAL_ARTIFACT_URI.test(artifactUri), 'ARTIFACT_URI_REQUIRED', 'V2 source intake requires a canonical Studio CAS URI.');
      const provenance = validateProvenanceV2(payload.provenance);
      for (const parentSourceId of provenance.parentSourceIds) {
        invariant(next.sources.some((source) => source.id === parentSourceId), 'ENTITY_NOT_FOUND', 'A provenance parent source does not exist.', {
          parentSourceId,
        });
      }
      const source = {
        schemaVersion: 2,
        id: sourceId,
        intakeId,
        name: requireString(payload.name, 'payload.name', { max: 160 }),
        artifactUri,
        mediaType: requireEnum(payload.mediaType, 'payload.mediaType', SOURCE_MEDIA_TYPES),
        byteSize: requireInteger(payload.byteSize, 'payload.byteSize', { min: 1 }),
        width: requireInteger(payload.width, 'payload.width', { min: 1 }),
        height: requireInteger(payload.height, 'payload.height', { min: 1 }),
        provenance,
        lifecycle: {
          state: provenance.origin === 'human_upload' ? 'IMPORTED' : 'GENERATED',
          changedAt: now,
          changedBy: command.actor.id,
        },
        review: sourceReview({}),
        registeredAt: now,
        registeredBy: command.actor.id,
      };
      if (command.actor.kind === 'agent') {
        const grantIndex = next.grants.findIndex((grant) => grant.id === command.grantId);
        next.grants[grantIndex] = {
          ...next.grants[grantIndex],
          usage: {
            ...next.grants[grantIndex].usage,
            artifactBytes: next.grants[grantIndex].usage.artifactBytes + source.byteSize,
          },
        };
      }
      next.sources.push(source);
      return {
        snapshot: next,
        result: { sourceId, intakeId },
        summary: `Source intake ${intakeId} committed as ${sourceId}.`,
        changes: [{ entityType: 'source', entityId: sourceId, operation: 'created' }],
      };
    }
    case 'source.review.propose': {
      const sourceId = requireId(payload.sourceId, 'payload.sourceId');
      const index = next.sources.findIndex((source) => source.id === sourceId);
      invariant(index >= 0, 'ENTITY_NOT_FOUND', 'The source does not exist.', { sourceId });
      invariant(next.sources[index].schemaVersion === 2, 'ENTITY_STATE_CONFLICT', 'Legacy sources must be re-imported through V2 intake before review.', {
        sourceId,
      });
      const current = sourceReview(next.sources[index]);
      invariant(
        ['IMPORTED', 'GENERATED'].includes(next.sources[index].lifecycle?.state) && current.disposition === 'PENDING',
        'ENTITY_STATE_CONFLICT',
        'Only a newly imported or generated V2 source can be proposed for review.',
        { sourceId, lifecycle: next.sources[index].lifecycle?.state, disposition: current.disposition },
      );
      next.sources[index] = {
        ...next.sources[index],
        lifecycle: {
          state: 'REVIEWED',
          changedAt: now,
          changedBy: command.actor.id,
        },
        review: {
          ...current,
          proposedAt: now,
          proposedBy: command.actor.id,
          proposalNote: payload.note === undefined ? null : nullableString(payload.note, 'payload.note', { max: 2000 }),
          decidedAt: null,
          decidedBy: null,
          decisionNote: null,
        },
      };
      return {
        snapshot: next,
        result: { sourceId, lifecycle: 'REVIEWED', reviewDisposition: 'PENDING' },
        summary: `Source ${sourceId} proposed for human review.`,
        changes: [{ entityType: 'source', entityId: sourceId, operation: 'review_proposed' }],
      };
    }
    case 'source.review.decide': {
      const sourceId = requireId(payload.sourceId, 'payload.sourceId');
      const index = next.sources.findIndex((source) => source.id === sourceId);
      invariant(index >= 0, 'ENTITY_NOT_FOUND', 'The source does not exist.', { sourceId });
      invariant(next.sources[index].schemaVersion === 2, 'ENTITY_STATE_CONFLICT', 'Legacy sources must be re-imported through V2 intake before review.', {
        sourceId,
      });
      const current = sourceReview(next.sources[index]);
      invariant(
        next.sources[index].lifecycle?.state === 'REVIEWED'
          && current.disposition === 'PENDING' && current.proposedAt !== null,
        'ENTITY_STATE_CONFLICT',
        'Only a proposed V2 source can receive a review decision.',
        {
        sourceId,
        lifecycle: next.sources[index].lifecycle?.state,
        disposition: current.disposition,
        },
      );
      const decision = requireEnum(payload.disposition, 'payload.disposition', SOURCE_REVIEW_DECISIONS);
      const decisionNote = payload.note === undefined ? null : nullableString(payload.note, 'payload.note', { max: 2000 });
      invariant(decision !== 'REJECTED' || decisionNote?.trim(), 'VALIDATION_ERROR', 'A rejection note is required.');
      const lifecycleState = decision === 'APPROVED' ? 'APPROVED_SOURCE' : 'REJECTED';
      const reviewDisposition = decision === 'APPROVED' ? 'USER_APPROVED' : 'USER_REJECTED';
      next.sources[index] = {
        ...next.sources[index],
        lifecycle: {
          state: lifecycleState,
          changedAt: now,
          changedBy: command.actor.id,
        },
        review: {
          ...current,
          disposition: reviewDisposition,
          decidedAt: now,
          decidedBy: command.actor.id,
          decisionNote,
        },
      };
      return {
        snapshot: next,
        result: { sourceId, lifecycle: lifecycleState, reviewDisposition },
        summary: `Source ${sourceId} review decision: ${reviewDisposition}.`,
        changes: [{ entityType: 'source', entityId: sourceId, operation: decision === 'APPROVED' ? 'approved' : 'rejected' }],
      };
    }
    case 'atlas.define.rects': {
      const atlasId = requireId(payload.atlasId, 'payload.atlasId');
      const sourceId = requireId(payload.sourceId, 'payload.sourceId');
      const { source, digest: sourceDigest } = approvedPngSource(next, sourceId);
      next.atlases ??= [];
      const existingIndex = next.atlases.findIndex((candidate) => candidate.id === atlasId);
      const existing = existingIndex >= 0 ? next.atlases[existingIndex] : null;
      if (existing?.latestPreviewJobId) {
        invariant(priorAtlasJob && ['APPLIED', 'DISCARDED'].includes(priorAtlasJob.state), 'JOB_STATE_CONFLICT', 'Discard or apply the current atlas preview before redefining rectangles.', {
          state: priorAtlasJob?.state ?? 'MISSING',
        });
      }
      const expectedAtlasVersion = requireInteger(payload.expectedAtlasVersion, 'payload.expectedAtlasVersion', { min: 0 });
      invariant(
        expectedAtlasVersion === (existing?.definitionVersion ?? 0),
        'ENTITY_VERSION_CONFLICT',
        'The atlas definition changed after these rectangles were prepared.',
        { atlasId, expectedVersion: expectedAtlasVersion, actualVersion: existing?.definitionVersion ?? 0 },
      );
      invariant(!existing || existing.sourceId === sourceId, 'ENTITY_STATE_CONFLICT', 'An atlas identity cannot be retargeted to another source.', {
        atlasId,
        existingSourceId: existing?.sourceId,
        requestedSourceId: sourceId,
      });
      const validated = validateAtlasRectangles(payload.rectangles, {
        sourceWidth: source.width,
        sourceHeight: source.height,
      });
      for (const rectangle of validated.rectangles.filter((candidate) => candidate.replacesSliceId !== null)) {
        const prior = existing?.sliceHeads.find((slice) => slice.sliceId === rectangle.replacesSliceId);
        invariant(prior, 'ATLAS_REMAP_TARGET_NOT_FOUND', 'A replacement mapping names no slice head in this atlas.', {
          atlasId,
          rectangleId: rectangle.rectangleId,
          replacesSliceId: rectangle.replacesSliceId,
        });
        invariant(prior.version === rectangle.expectedSliceVersion, 'ENTITY_VERSION_CONFLICT', 'A replacement slice head changed after the recut was prepared.', {
          sliceId: prior.sliceId,
          expectedVersion: rectangle.expectedSliceVersion,
          actualVersion: prior.version,
        });
      }
      const definitionVersion = (existing?.definitionVersion ?? 0) + 1;
      const definitionFingerprint = fingerprint({
        schemaVersion: 1,
        processorId: ATLAS_PROCESSOR_ID,
        sourceId,
        sourceDigest,
        sourceWidth: source.width,
        sourceHeight: source.height,
        rectangles: validated.rectangles,
      });
      const atlas = {
        schemaVersion: 1,
        id: atlasId,
        name: requireString(payload.name, 'payload.name', { max: 160 }),
        sourceId,
        sourceDigest,
        sourceMediaType: source.mediaType,
        sourceWidth: source.width,
        sourceHeight: source.height,
        processorId: ATLAS_PROCESSOR_ID,
        definitionVersion,
        definitionFingerprint,
        rectangleFingerprint: validated.fingerprint,
        rectangles: validated.rectangles,
        sliceHeads: existing?.sliceHeads ?? [],
        latestPreviewJobId: null,
        definedAt: existing?.definedAt ?? now,
        definedBy: existing?.definedBy ?? command.actor.id,
        updatedAt: now,
        updatedBy: command.actor.id,
      };
      if (existingIndex >= 0) next.atlases[existingIndex] = atlas;
      else next.atlases.push(atlas);
      return {
        snapshot: next,
        result: {
          atlasId,
          definitionVersion,
          definitionFingerprint,
          rectangleFingerprint: validated.fingerprint,
          includedCount: validated.includedCount,
        },
        summary: `Atlas ${atlasId} definition ${definitionVersion} recorded from approved source ${sourceId}.`,
        changes: [{ entityType: 'atlas', entityId: atlasId, operation: existing ? 'definition_revised' : 'created' }],
      };
    }
    case 'atlas.preview.slices': {
      const atlasId = requireId(payload.atlasId, 'payload.atlasId');
      const jobId = requireId(payload.jobId, 'payload.jobId');
      next.atlases ??= [];
      const atlasIndex = next.atlases.findIndex((candidate) => candidate.id === atlasId);
      const atlas = next.atlases[atlasIndex];
      assertAtlasHead(atlas, payload);
      if (atlas.latestPreviewJobId) {
        invariant(priorAtlasJob && ['APPLIED', 'DISCARDED'].includes(priorAtlasJob.state), 'JOB_STATE_CONFLICT', 'Discard or apply the current atlas preview before starting another.', {
          state: priorAtlasJob?.state ?? 'MISSING',
        });
      }
      approvedPngSource(next, atlas.sourceId);
      const outputArtifactBytes = previewOutputArtifactBytes(next, atlasId);
      if (command.actor.kind === 'agent') {
        const grantIndex = next.grants.findIndex((grant) => grant.id === command.grantId);
        next.grants[grantIndex] = {
          ...next.grants[grantIndex],
          usage: {
            ...next.grants[grantIndex].usage,
            jobs: next.grants[grantIndex].usage.jobs + 1,
            artifactBytes: next.grants[grantIndex].usage.artifactBytes + outputArtifactBytes,
          },
        };
      }
      next.atlases[atlasIndex] = { ...atlas, latestPreviewJobId: jobId, updatedAt: now, updatedBy: command.actor.id };
      const jobInput = {
        schemaVersion: 1,
        kind: 'ATLAS_PREVIEW',
        atlasId,
        atlasDefinitionVersion: atlas.definitionVersion,
        atlasDefinitionFingerprint: atlas.definitionFingerprint,
        processorId: atlas.processorId,
        sourceId: atlas.sourceId,
        sourceDigest: atlas.sourceDigest,
        sourceMediaType: atlas.sourceMediaType,
        sourceWidth: atlas.sourceWidth,
        sourceHeight: atlas.sourceHeight,
        rectangles: atlas.rectangles,
      };
      const job = {
        jobId,
        projectId: command.projectId,
        kind: 'ATLAS_PREVIEW',
        idempotencyKey: command.idempotencyKey,
        inputFingerprint: fingerprint(jobInput),
        input: jobInput,
        outputArtifactBytes,
        createdAt: now,
        createdBy: command.actor.id,
        requestedRevision: command.baseRevision + 1,
      };
      return {
        snapshot: next,
        result: {
          status: 'ACCEPTED',
          jobId,
          jobResource: `studio://projects/${command.projectId}/jobs/${jobId}`,
          inputRevisionId: `revision:${command.baseRevision + 1}`,
          job,
        },
        summary: `Atlas ${atlasId} deterministic slice preview queued as ${jobId}.`,
        changes: [{ entityType: 'job', entityId: jobId, operation: 'queued' }],
      };
    }
    case 'atlas.commit.slices': {
      const atlasId = requireId(payload.atlasId, 'payload.atlasId');
      const jobId = requireId(payload.jobId, 'payload.jobId');
      next.atlases ??= [];
      const atlasIndex = next.atlases.findIndex((candidate) => candidate.id === atlasId);
      const atlas = next.atlases[atlasIndex];
      assertAtlasHead(atlas, payload);
      invariant(atlasJob?.projectId === command.projectId && atlasJob.jobId === jobId, 'JOB_NOT_FOUND', 'The preview job does not exist in this project.', { jobId });
      invariant(atlasJob.state === 'SUCCEEDED' && atlasJob.appliedRevision === null, 'JOB_STATE_CONFLICT', 'Only an unapplied succeeded preview job can be committed.', {
        jobId,
        state: atlasJob.state,
        appliedRevision: atlasJob.appliedRevision,
      });
      invariant(
        atlasJob.input?.atlasId === atlasId
          && atlasJob.input?.atlasDefinitionVersion === atlas.definitionVersion
          && atlasJob.input?.atlasDefinitionFingerprint === atlas.definitionFingerprint
          && atlasJob.input?.sourceDigest === atlas.sourceDigest,
        'JOB_INPUT_MISMATCH',
        'The preview job was not produced from the current atlas definition and approved source.',
        { jobId, atlasId },
      );
      const outputByRectangle = new Map((atlasJob.outputs ?? []).map((output) => [output.rectangleId, output]));
      const included = atlas.rectangles.filter((rectangle) => rectangle.included);
      invariant(outputByRectangle.size === included.length, 'JOB_OUTPUT_MISMATCH', 'Preview job outputs do not match the included rectangle count.', { jobId });
      const headById = new Map(atlas.sliceHeads.map((slice) => [slice.sliceId, slice]));
      const committed = [];
      for (const rectangle of included) {
        const output = outputByRectangle.get(rectangle.rectangleId);
        invariant(
          output && output.mediaType === 'image/png'
            && output.width === rectangle.width && output.height === rectangle.height
            && output.byteSize === canonicalRgbaPngByteSize(rectangle.width, rectangle.height)
            && typeof output.digest === 'string' && /^[a-f0-9]{64}$/.test(output.digest),
          'JOB_OUTPUT_MISMATCH',
          'A preview output does not match its exact rectangle.',
          { jobId, rectangleId: rectangle.rectangleId },
        );
        let sliceId;
        let version;
        let priorDigest = null;
        if (rectangle.replacesSliceId !== null) {
          const prior = headById.get(rectangle.replacesSliceId);
          invariant(prior && prior.version === rectangle.expectedSliceVersion, 'ENTITY_VERSION_CONFLICT', 'A mapped slice head changed before commit.', { sliceId: rectangle.replacesSliceId });
          sliceId = prior.sliceId;
          version = prior.version + 1;
          priorDigest = prior.digest;
        } else {
          sliceId = `slice.${fingerprint({ atlasId, definitionVersion: atlas.definitionVersion, rectangleId: rectangle.rectangleId }).slice(0, 32)}`;
          invariant(!headById.has(sliceId), 'ENTITY_EXISTS', 'The derived slice identity already exists; use an explicit replacement mapping.', { sliceId });
          version = 1;
        }
        const slice = {
          schemaVersion: 1,
          sliceId,
          version,
          atlasId,
          sourceId: atlas.sourceId,
          sourceDigest: atlas.sourceDigest,
          definitionVersion: atlas.definitionVersion,
          definitionFingerprint: atlas.definitionFingerprint,
          rectangleId: rectangle.rectangleId,
          rectangle: deepClone(rectangle),
          processorId: atlas.processorId,
          digest: output.digest,
          artifactUri: `studio://artifacts/sha256/${output.digest}`,
          mediaType: 'image/png',
          byteSize: output.byteSize,
          width: output.width,
          height: output.height,
          priorDigest,
          committedAt: now,
          committedBy: command.actor.id,
          jobId,
        };
        headById.set(sliceId, slice);
        committed.push(slice);
      }
      next.atlases[atlasIndex] = {
        ...atlas,
        sliceHeads: [...headById.values()],
        latestPreviewJobId: jobId,
        lastCommittedJobId: jobId,
        updatedAt: now,
        updatedBy: command.actor.id,
      };
      return {
        snapshot: next,
        result: {
          atlasId,
          jobId,
          slices: committed.map((slice) => ({
            sliceId: slice.sliceId,
            version: slice.version,
            rectangleId: slice.rectangleId,
            artifactUri: slice.artifactUri,
            digest: slice.digest,
            mediaType: slice.mediaType,
            byteSize: slice.byteSize,
            width: slice.width,
            height: slice.height,
          })),
        },
        summary: `${committed.length} deterministic slices committed from atlas ${atlasId}.`,
        changes: committed.map((slice) => ({ entityType: 'atlas_slice', entityId: slice.sliceId, operation: slice.version === 1 ? 'created' : 'replaced' })),
      };
    }
    case 'asset.define': {
      const assetId = requireId(payload.assetId, 'payload.assetId');
      invariant(!next.assets.some((asset) => asset.id === assetId), 'ENTITY_EXISTS', 'The asset ID already exists.', {
        assetId,
      });
      const sourceId = requireId(payload.sourceId, 'payload.sourceId');
      invariant(next.sources.some((source) => source.id === sourceId), 'ENTITY_NOT_FOUND', 'The source does not exist.', {
        sourceId,
      });
      const region = requireRecord(payload.region, 'payload.region');
      const asset = {
        id: assetId,
        sourceId,
        name: requireString(payload.name, 'payload.name', { max: 160 }),
        kind: requireEnum(payload.kind, 'payload.kind', ASSET_KINDS),
        region: {
          x: requireInteger(region.x, 'payload.region.x', { min: 0 }),
          y: requireInteger(region.y, 'payload.region.y', { min: 0 }),
          width: requireInteger(region.width, 'payload.region.width', { min: 1 }),
          height: requireInteger(region.height, 'payload.region.height', { min: 1 }),
        },
        properties: payload.properties === undefined ? {} : deepClone(requireRecord(payload.properties, 'payload.properties')),
        status: payload.status === undefined ? 'draft' : requireEnum(payload.status, 'payload.status', ASSET_STATUSES),
        definedAt: now,
        definedBy: command.actor.id,
      };
      next.assets.push(asset);
      return {
        snapshot: next,
        result: { assetId },
        summary: `${asset.kind} asset ${assetId} defined from source ${sourceId}.`,
        changes: [{ entityType: 'asset', entityId: assetId, operation: 'created' }],
      };
    }
    case 'asset.proposal.submit': {
      invariant(preparedAssetProposal, 'ASSET_PROPOSAL_INVALID', 'A prepared exact-lineage proposal is required.');
      const library = assetLibrary(next);
      const proposalId = preparedAssetProposal.proposalId;
      invariant(!library.proposals.some((proposal) => proposal.proposalId === proposalId), 'ENTITY_EXISTS', 'The proposal ID already exists.', { proposalId });
      const items = preparedAssetProposal.items.map((item) => {
        const existingAsset = library.assets.find((asset) => asset.assetId === item.assetId);
        invariant(!next.assets.some((asset) => asset.id === item.assetId), 'ENTITY_EXISTS', 'A legacy asset already uses this identity.', { assetId: item.assetId });
        if (item.operation === 'create') {
          invariant(!existingAsset, 'ENTITY_EXISTS', 'The V2 asset already exists.', { assetId: item.assetId });
        } else {
          invariant(existingAsset, 'ENTITY_NOT_FOUND', 'The V2 asset to update does not exist.', { assetId: item.assetId });
          invariant(
            existingAsset.assetVersion === item.expectedAssetVersion
              && existingAsset.metadataVersion === item.expectedMetadataVersion,
            'ENTITY_VERSION_CONFLICT',
            'The V2 asset changed after the update was prepared.',
            {
              assetId: item.assetId,
              expectedAssetVersion: item.expectedAssetVersion,
              actualAssetVersion: existingAsset.assetVersion,
              expectedMetadataVersion: item.expectedMetadataVersion,
              actualMetadataVersion: existingAsset.metadataVersion,
            },
          );
        }
        return {
          ...item,
          diff: {
            operation: item.operation,
            before: existingAsset ? {
              assetVersion: existingAsset.assetVersion,
              metadataVersion: existingAsset.metadataVersion,
              name: existingAsset.name,
              kind: existingAsset.kind,
              metadata: deepClone(existingAsset.metadata),
              sliceBinding: deepClone(existingAsset.sliceBinding),
            } : null,
            after: {
              name: item.name,
              kind: item.kind,
              metadata: deepClone(item.metadata),
              sliceBinding: deepClone(item.sliceBinding),
            },
          },
        };
      });
      const proposal = {
        proposalId,
        proposalVersion: 1,
        state: 'PENDING',
        fingerprint: preparedAssetProposal.fingerprint,
        items: deepClone(items),
        proposer: {
          actor: deepClone(command.actor),
          taskId: command.taskId,
          grantId: command.grantId,
          branchId: command.branchId,
        },
        submittedAt: now,
        submittedRevision: command.baseRevision + 1,
        decidedAt: null,
        decidedBy: null,
        decisionRevision: null,
        appliedAt: null,
        appliedBy: null,
        appliedRevision: null,
      };
      library.proposals.push(proposal);
      return {
        snapshot: next,
        result: {
          proposalId,
          proposalVersion: 1,
          state: 'PENDING',
          fingerprint: proposal.fingerprint,
          itemCount: proposal.items.length,
        },
        summary: `${proposal.items.length} V2 asset proposal item(s) submitted as ${proposalId}.`,
        changes: [{ entityType: 'asset_proposal', entityId: proposalId, operation: 'submitted' }],
      };
    }
    case 'asset.proposal.decide': {
      const library = assetLibrary(next);
      const proposalId = requireId(payload.proposalId, 'payload.proposalId');
      const { index, proposal } = proposalHead(library, proposalId);
      invariant(proposal.state === 'PENDING', 'ENTITY_STATE_CONFLICT', 'Only a pending asset proposal can be decided.', { proposalId, state: proposal.state });
      const expectedProposalVersion = requireInteger(payload.expectedProposalVersion, 'payload.expectedProposalVersion', { min: 1 });
      invariant(proposal.proposalVersion === expectedProposalVersion, 'ENTITY_VERSION_CONFLICT', 'The proposal changed after the decision was prepared.', {
        proposalId, expectedVersion: expectedProposalVersion, actualVersion: proposal.proposalVersion,
      });
      invariant(Array.isArray(payload.decisions) && payload.decisions.length === proposal.items.length, 'ASSET_PROPOSAL_DECISION_INCOMPLETE', 'The owner decision must cover every proposal item exactly once.', { proposalId });
      const decisions = new Map();
      for (const [decisionIndex, candidate] of payload.decisions.entries()) {
        const decision = requireRecord(candidate, `payload.decisions[${decisionIndex}]`);
        assertExactFields(decision, new Set(['itemId', 'disposition', 'reason']), `payload.decisions[${decisionIndex}]`);
        invariant(Object.hasOwn(decision, 'reason'), 'VALIDATION_ERROR', 'Every decision requires an explicit reason field, which may be null for acceptance.');
        const itemId = requireId(decision.itemId, `payload.decisions[${decisionIndex}].itemId`);
        invariant(!decisions.has(itemId), 'ASSET_PROPOSAL_DECISION_DUPLICATE', 'A proposal item may be decided only once.', { itemId });
        const disposition = requireEnum(decision.disposition, `payload.decisions[${decisionIndex}].disposition`, ['ACCEPTED', 'REJECTED']);
        const reason = decision.reason === null ? null : requireString(decision.reason, `payload.decisions[${decisionIndex}].reason`, { max: 2000 });
        invariant(disposition !== 'REJECTED' || reason !== null, 'ASSET_PROPOSAL_REJECTION_REASON_REQUIRED', 'A rejected proposal item requires a nonblank reason.', { itemId });
        invariant(disposition !== 'ACCEPTED' || reason === null, 'VALIDATION_ERROR', 'Accepted proposal items use a null reason.', { itemId });
        decisions.set(itemId, { disposition, reason });
      }
      const items = proposal.items.map((item) => {
        const decision = decisions.get(item.itemId);
        invariant(decision, 'ASSET_PROPOSAL_DECISION_INCOMPLETE', 'The owner decision omitted a proposal item.', { itemId: item.itemId });
        return {
          ...item,
          decision: {
            ...decision,
            decidedAt: now,
            decidedBy: command.actor.id,
            decisionRevision: command.baseRevision + 1,
          },
        };
      });
      const acceptedCount = items.filter((item) => item.decision.disposition === 'ACCEPTED').length;
      const rejectedCount = items.length - acceptedCount;
      library.proposals[index] = {
        ...proposal,
        proposalVersion: 2,
        state: 'DECIDED',
        items,
        decidedAt: now,
        decidedBy: command.actor.id,
        decisionRevision: command.baseRevision + 1,
      };
      return {
        snapshot: next,
        result: { proposalId, proposalVersion: 2, state: 'DECIDED', acceptedCount, rejectedCount },
        summary: `Proposal ${proposalId} decided: ${acceptedCount} accepted, ${rejectedCount} rejected.`,
        changes: [{ entityType: 'asset_proposal', entityId: proposalId, operation: 'decided' }],
      };
    }
    case 'asset.proposal.apply': {
      const library = assetLibrary(next);
      const proposalId = requireId(payload.proposalId, 'payload.proposalId');
      const { index, proposal } = proposalHead(library, proposalId);
      invariant(proposal.state === 'DECIDED', 'ENTITY_STATE_CONFLICT', 'Only a decided asset proposal can be applied.', { proposalId, state: proposal.state });
      const expectedProposalVersion = requireInteger(payload.expectedProposalVersion, 'payload.expectedProposalVersion', { min: 2 });
      invariant(proposal.proposalVersion === expectedProposalVersion, 'ENTITY_VERSION_CONFLICT', 'The proposal changed after apply was prepared.', {
        proposalId, expectedVersion: expectedProposalVersion, actualVersion: proposal.proposalVersion,
      });
      const accepted = proposal.items.filter((item) => item.decision?.disposition === 'ACCEPTED');
      const rejected = proposal.items.filter((item) => item.decision?.disposition === 'REJECTED');
      const preparedAssets = [];
      for (const item of accepted) {
        assertCurrentProposalSlice(next, item);
        const currentIndex = library.assets.findIndex((asset) => asset.assetId === item.assetId);
        const current = currentIndex >= 0 ? library.assets[currentIndex] : null;
        if (item.operation === 'create') {
          invariant(!current, 'ENTITY_EXISTS', 'The proposed asset identity is no longer absent.', { assetId: item.assetId });
        } else {
          invariant(current, 'ENTITY_NOT_FOUND', 'The proposed asset update target no longer exists.', { assetId: item.assetId });
          invariant(
            current.assetVersion === item.expectedAssetVersion
              && current.metadataVersion === item.expectedMetadataVersion,
            'ENTITY_VERSION_CONFLICT',
            'The asset changed after proposal submission.',
            { assetId: item.assetId },
          );
        }
        const assetVersion = (current?.assetVersion ?? 0) + 1;
        const metadataVersion = current === null
          ? 1
          : current.metadataFingerprint === item.metadataFingerprint
            ? current.metadataVersion
            : current.metadataVersion + 1;
        preparedAssets.push({
          currentIndex,
          asset: {
            assetId: item.assetId,
            assetVersion,
            metadataVersion,
            name: item.name,
            kind: item.kind,
            lifecycle: 'DRAFT',
            metadata: deepClone(item.metadata),
            metadataFingerprint: item.metadataFingerprint,
            findings: deepClone(item.findings),
            sliceBinding: deepClone(item.sliceBinding),
            warningDispositions: [],
            createdAt: current?.createdAt ?? now,
            createdBy: current?.createdBy ?? command.actor.id,
            updatedAt: now,
            updatedBy: command.actor.id,
            proposal: {
              proposalId,
              itemId: item.itemId,
              decisionRevision: proposal.decisionRevision,
              appliedRevision: command.baseRevision + 1,
            },
          },
        });
      }
      for (const { currentIndex, asset } of preparedAssets) {
        if (currentIndex >= 0) library.assets[currentIndex] = asset;
        else library.assets.push(asset);
      }
      library.proposals[index] = {
        ...proposal,
        proposalVersion: 3,
        state: 'APPLIED',
        appliedAt: now,
        appliedBy: command.actor.id,
        appliedRevision: command.baseRevision + 1,
      };
      const appliedAssetIds = preparedAssets.map(({ asset }) => asset.assetId);
      const rejectedItemIds = rejected.map((item) => item.itemId);
      return {
        snapshot: next,
        result: { proposalId, proposalVersion: 3, state: 'APPLIED', appliedAssetIds, rejectedItemIds },
        summary: `Proposal ${proposalId} applied ${appliedAssetIds.length} accepted asset(s); ${rejectedItemIds.length} rejected item(s) remain inspectable.`,
        changes: [
          ...preparedAssets.map(({ asset }) => ({ entityType: 'asset_v2', entityId: asset.assetId, operation: asset.assetVersion === 1 ? 'created' : 'versioned' })),
          { entityType: 'asset_proposal', entityId: proposalId, operation: 'applied' },
        ],
      };
    }
    case 'asset.lifecycle.set': {
      const library = assetLibrary(next);
      const assetId = requireId(payload.assetId, 'payload.assetId');
      const index = library.assets.findIndex((asset) => asset.assetId === assetId);
      invariant(index >= 0, 'ENTITY_NOT_FOUND', 'The V2 asset does not exist.', { assetId });
      const current = library.assets[index];
      const expectedAssetVersion = requireInteger(payload.expectedAssetVersion, 'payload.expectedAssetVersion', { min: 1 });
      const expectedMetadataVersion = requireInteger(payload.expectedMetadataVersion, 'payload.expectedMetadataVersion', { min: 1 });
      invariant(current.assetVersion === expectedAssetVersion && current.metadataVersion === expectedMetadataVersion, 'ENTITY_VERSION_CONFLICT', 'The asset changed after lifecycle promotion was prepared.', {
        assetId,
        expectedAssetVersion,
        actualAssetVersion: current.assetVersion,
        expectedMetadataVersion,
        actualMetadataVersion: current.metadataVersion,
      });
      invariant(Array.isArray(payload.acceptedWarningFindingIds), 'VALIDATION_ERROR', 'payload.acceptedWarningFindingIds must be an array.');
      const warningIds = new Set(current.findings.filter((finding) => finding.severity === 'WARNING').map((finding) => finding.findingId));
      for (const findingId of payload.acceptedWarningFindingIds) {
        requireString(findingId, 'payload.acceptedWarningFindingIds[]', { max: 128 });
        invariant(warningIds.has(findingId), 'ASSET_WARNING_NOT_FOUND', 'Only a current warning finding may be dispositioned.', { assetId, findingId });
      }
      if (payload.targetLifecycle === 'METADATA_COMPLETE') {
        invariant(!current.findings.some((finding) => finding.severity === 'ERROR'), 'ASSET_LIFECYCLE_BLOCKED', 'Blocking findings prevent metadata completion.', {
          assetId,
          findingIds: current.findings.filter((finding) => finding.severity === 'ERROR').map((finding) => finding.findingId),
        });
      }
      const lifecycle = evaluateAssetLifecycle({
        current: current.lifecycle,
        target: payload.targetLifecycle,
        findings: current.findings,
        acceptedWarningFindingIds: payload.acceptedWarningFindingIds,
      });
      const warningDispositions = [...new Set([...current.warningDispositions, ...payload.acceptedWarningFindingIds])].sort();
      const asset = {
        ...current,
        assetVersion: current.assetVersion + 1,
        lifecycle,
        warningDispositions,
        updatedAt: now,
        updatedBy: command.actor.id,
        lifecycleRevision: command.baseRevision + 1,
      };
      library.assets[index] = asset;
      return {
        snapshot: next,
        result: { assetId, assetVersion: asset.assetVersion, metadataVersion: asset.metadataVersion, lifecycle },
        summary: `V2 asset ${assetId} promoted to ${lifecycle}.`,
        changes: [{ entityType: 'asset_v2', entityId: assetId, operation: 'lifecycle_promoted' }],
      };
    }
    case 'room.archetype.create': {
      assertExactFields(payload, new Set([
        'roomArchetypeId', 'kind', 'displayName', 'tags', 'dimensionPolicy',
        'structuralBands', 'orientation', 'connectorPolicy', 'allowedAssetKinds',
        'allowedTags', 'requiredTags', 'rationality', 'governingRuleRefs',
      ]), 'payload');
      const library = roomLibrary(next);
      invariant(library.archetypes.length < 128, 'ROOM_ARCHETYPE_LIMIT', 'A project may contain at most 128 room archetypes.');
      const roomArchetypeId = requireId(payload.roomArchetypeId, 'payload.roomArchetypeId');
      invariant(!library.archetypes.some((candidate) => candidate.roomArchetypeId === roomArchetypeId), 'ENTITY_EXISTS', 'The room archetype ID already exists.', { roomArchetypeId });
      const validated = validateRoomArchetype({ projectId: command.projectId, version: 1, ...deepClone(payload) });
      const archetype = {
        ...validated,
        createdAt: now,
        createdBy: command.actor.id,
        createdRevision: command.baseRevision + 1,
        provenance: 'native_revision',
      };
      library.archetypes.push(archetype);
      return {
        snapshot: next,
        result: { roomArchetypeId, archetypeVersion: 1, kind: archetype.kind, fingerprint: archetype.fingerprint },
        summary: `${archetype.kind} archetype ${roomArchetypeId} created.`,
        changes: [{ entityType: 'room_archetype', entityId: roomArchetypeId, operation: 'created' }],
      };
    }
    case 'room.variant.create': {
      assertExactFields(payload, new Set([
        'roomVariantId', 'roomArchetypeId', 'archetypeVersion', 'displayName',
        'width', 'height', 'intentTrace', 'connectors', 'placements',
      ]), 'payload');
      invariant(projectDocument, 'ROOM_STORE_DISABLED', 'Room authoring requires the authoritative project document.');
      const library = roomLibrary(next);
      invariant(library.variants.length < 512, 'ROOM_VARIANT_LIMIT', 'A project may contain at most 512 room variants.');
      const roomVariantId = requireId(payload.roomVariantId, 'payload.roomVariantId');
      invariant(!library.variants.some((candidate) => candidate.roomVariantId === roomVariantId), 'ENTITY_EXISTS', 'The room variant ID already exists.', { roomVariantId });
      const archetype = roomArchetypeHead(library, requireId(payload.roomArchetypeId, 'payload.roomArchetypeId'), requireInteger(payload.archetypeVersion, 'payload.archetypeVersion', { min: 1 }));
      for (const placement of payload.placements ?? []) {
        invariant(placement?.proposalId === null && placement?.proposalItemId === null, 'UNTRUSTED_AUTHORITY_FIELD', 'Direct room placement provenance is assigned by Studio and must be null.');
      }
      const candidate = {
        projectId: command.projectId,
        roomVariantId,
        version: 1,
        roomArchetypeId: archetype.roomArchetypeId,
        archetypeVersion: archetype.version,
        displayName: payload.displayName,
        lifecycle: 'DRAFT',
        width: payload.width,
        height: payload.height,
        origin: { x: 0, y: 0 },
        intentTrace: deepClone(payload.intentTrace),
        connectors: deepClone(payload.connectors),
        placements: deepClone(payload.placements),
        acceptedWarningFindingIds: [],
        parentVariantVersion: null,
        parentFinalVersion: null,
      };
      const version = validatedRoomVersion({
        candidate, archetype, document: projectDocument, now, actorId: command.actor.id,
        createdRevision: command.baseRevision + 1,
      });
      library.variants.push({ roomVariantId, headVersion: 1, versions: [version] });
      return {
        snapshot: next,
        result: { roomVariantId, roomVariantVersion: 1, lifecycle: 'DRAFT', findingCount: version.findings.length, contentFingerprint: version.contentFingerprint },
        summary: `DRAFT room variant ${roomVariantId} created.`,
        changes: [{ entityType: 'room_variant', entityId: roomVariantId, operation: 'created' }],
      };
    }
    case 'room.variant.intent.set':
    case 'room.variant.resize':
    case 'room.variant.connectors.set':
    case 'room.variant.placements.add':
    case 'room.variant.placements.move':
    case 'room.variant.placements.remove': {
      invariant(projectDocument, 'ROOM_STORE_DISABLED', 'Room authoring requires the authoritative project document.');
      const fieldsByType = {
        'room.variant.intent.set': ['roomVariantId', 'expectedRoomVariantVersion', 'intentTrace'],
        'room.variant.resize': ['roomVariantId', 'expectedRoomVariantVersion', 'width', 'height', 'removePlacementIds', 'removeConnectorIds'],
        'room.variant.connectors.set': ['roomVariantId', 'expectedRoomVariantVersion', 'connectors'],
        'room.variant.placements.add': ['roomVariantId', 'expectedRoomVariantVersion', 'placements'],
        'room.variant.placements.move': ['roomVariantId', 'expectedRoomVariantVersion', 'moves'],
        'room.variant.placements.remove': ['roomVariantId', 'expectedRoomVariantVersion', 'placements'],
      };
      assertExactFields(payload, new Set(fieldsByType[command.type]), 'payload');
      const library = roomLibrary(next);
      const { entry, variant: current } = roomVariantHead(library, requireId(payload.roomVariantId, 'payload.roomVariantId'));
      assertRoomVersion(current, payload.expectedRoomVariantVersion);
      assertRoomDraft(current);
      assertNoActiveRoomProposal(library, current);
      const candidate = {
        ...roomVariantValue(current),
        version: current.version + 1,
        parentVariantVersion: current.version,
        acceptedWarningFindingIds: [],
      };
      if (command.type === 'room.variant.intent.set') {
        candidate.intentTrace = deepClone(payload.intentTrace);
      } else if (command.type === 'room.variant.connectors.set') {
        candidate.connectors = deepClone(payload.connectors);
      } else if (command.type === 'room.variant.resize') {
        invariant(Array.isArray(payload.removePlacementIds) && Array.isArray(payload.removeConnectorIds), 'VALIDATION_ERROR', 'Resize requires explicit removal lists.');
        const removePlacementIds = new Set(payload.removePlacementIds.map((value) => requireId(value, 'payload.removePlacementIds[]')));
        const removeConnectorIds = new Set(payload.removeConnectorIds.map((value) => requireId(value, 'payload.removeConnectorIds[]')));
        invariant(removePlacementIds.size === payload.removePlacementIds.length && removeConnectorIds.size === payload.removeConnectorIds.length, 'VALIDATION_ERROR', 'Resize removal IDs must be unique.');
        for (const id of removePlacementIds) invariant(current.placements.some((placement) => placement.placementId === id), 'ROOM_PLACEMENT_NOT_FOUND', 'A resize removal placement does not exist.', { placementId: id });
        for (const id of removeConnectorIds) invariant(current.connectors.some((connectorValue) => connectorValue.connectorId === id), 'ROOM_CONNECTOR_NOT_FOUND', 'A resize removal connector does not exist.', { connectorId: id });
        candidate.width = payload.width;
        candidate.height = payload.height;
        candidate.placements = current.placements.filter((placement) => !removePlacementIds.has(placement.placementId));
        candidate.connectors = current.connectors.filter((connectorValue) => !removeConnectorIds.has(connectorValue.connectorId));
      } else if (command.type === 'room.variant.placements.add') {
        invariant(Array.isArray(payload.placements) && payload.placements.length >= 1 && payload.placements.length <= 64, 'ROOM_PLACEMENT_LIMIT', 'Add requires 1 to 64 placements.');
        for (const placement of payload.placements) {
          invariant(placement?.proposalId === null && placement?.proposalItemId === null, 'UNTRUSTED_AUTHORITY_FIELD', 'Direct room placement provenance must be null.');
        }
        candidate.placements = [...current.placements, ...deepClone(payload.placements)];
      } else if (command.type === 'room.variant.placements.move') {
        invariant(Array.isArray(payload.moves) && payload.moves.length >= 1 && payload.moves.length <= 64, 'ROOM_PLACEMENT_LIMIT', 'Move requires 1 to 64 placements.');
        const seen = new Set();
        candidate.placements = deepClone(current.placements);
        for (const [moveIndex, rawMove] of payload.moves.entries()) {
          const move = requireRecord(rawMove, `payload.moves[${moveIndex}]`);
          assertExactFields(move, new Set(['placementId', 'expectedAssetId', 'anchor', 'rotation']), `payload.moves[${moveIndex}]`);
          const placementId = requireId(move.placementId, `payload.moves[${moveIndex}].placementId`);
          invariant(!seen.has(placementId), 'ROOM_PLACEMENT_DUPLICATE', 'A move command may target each placement only once.', { placementId });
          seen.add(placementId);
          const placementIndex = candidate.placements.findIndex((placement) => placement.placementId === placementId);
          invariant(placementIndex >= 0, 'ROOM_PLACEMENT_NOT_FOUND', 'The moved placement does not exist.', { placementId });
          invariant(candidate.placements[placementIndex].assetId === requireId(move.expectedAssetId, `payload.moves[${moveIndex}].expectedAssetId`), 'ENTITY_VERSION_CONFLICT', 'The moved placement now references another asset.', { placementId });
          const anchor = requireRecord(move.anchor, `payload.moves[${moveIndex}].anchor`);
          assertExactFields(anchor, new Set(['x', 'y']), `payload.moves[${moveIndex}].anchor`);
          candidate.placements[placementIndex] = {
            ...candidate.placements[placementIndex],
            anchor: {
              x: requireInteger(anchor.x, `payload.moves[${moveIndex}].anchor.x`, { min: 0, max: 63 }),
              y: requireInteger(anchor.y, `payload.moves[${moveIndex}].anchor.y`, { min: 0, max: 63 }),
            },
            rotation: requireEnum(move.rotation, `payload.moves[${moveIndex}].rotation`, [0, 90, 180, 270]),
          };
        }
      } else {
        invariant(Array.isArray(payload.placements) && payload.placements.length >= 1 && payload.placements.length <= 64, 'ROOM_PLACEMENT_LIMIT', 'Remove requires 1 to 64 placements.');
        const removeIds = new Set();
        for (const [removeIndex, rawRemoval] of payload.placements.entries()) {
          const removal = requireRecord(rawRemoval, `payload.placements[${removeIndex}]`);
          assertExactFields(removal, new Set(['placementId', 'expectedAssetId']), `payload.placements[${removeIndex}]`);
          const placementId = requireId(removal.placementId, `payload.placements[${removeIndex}].placementId`);
          invariant(!removeIds.has(placementId), 'ROOM_PLACEMENT_DUPLICATE', 'A remove command may target each placement only once.', { placementId });
          const currentPlacement = current.placements.find((placement) => placement.placementId === placementId);
          invariant(currentPlacement, 'ROOM_PLACEMENT_NOT_FOUND', 'The removed placement does not exist.', { placementId });
          invariant(currentPlacement.assetId === requireId(removal.expectedAssetId, `payload.placements[${removeIndex}].expectedAssetId`), 'ENTITY_VERSION_CONFLICT', 'The removed placement now references another asset.', { placementId });
          removeIds.add(placementId);
        }
        candidate.placements = current.placements.filter((placement) => !removeIds.has(placement.placementId));
      }
      const archetype = roomArchetypeHead(library, current.roomArchetypeId, current.archetypeVersion);
      const version = validatedRoomVersion({
        candidate, archetype, document: projectDocument, now, actorId: command.actor.id,
        createdRevision: command.baseRevision + 1,
      });
      if (command.type === 'room.variant.resize') {
        const clipped = version.findings.filter((finding) => finding.ruleId === 'studio.room.placement.out_of_bounds');
        invariant(clipped.length === 0, 'ROOM_RESIZE_CLIPS_CONTENT', 'Resize would clip placements not listed for explicit removal.', { findingIds: clipped.map((finding) => finding.findingId) });
      }
      appendRoomVersion(entry, version);
      return {
        snapshot: next,
        result: { roomVariantId: current.roomVariantId, roomVariantVersion: version.version, lifecycle: version.lifecycle, findingCount: version.findings.length, contentFingerprint: version.contentFingerprint },
        summary: `Room variant ${current.roomVariantId} version ${version.version} created by ${command.type}.`,
        changes: [{ entityType: 'room_variant', entityId: current.roomVariantId, operation: 'versioned' }],
      };
    }
    case 'room.placement.proposal.submit': {
      invariant(preparedRoomProposal, 'ROOM_PROPOSAL_INVALID', 'A prepared room placement proposal is required.');
      const library = roomLibrary(next);
      invariant(!library.proposals.some((proposal) => proposal.proposalId === preparedRoomProposal.proposalId), 'ENTITY_EXISTS', 'The room proposal ID already exists.', { proposalId: preparedRoomProposal.proposalId });
      const proposal = {
        proposalId: preparedRoomProposal.proposalId,
        proposalVersion: 1,
        roomVariantId: preparedRoomProposal.roomVariantId,
        expectedRoomVariantVersion: preparedRoomProposal.expectedRoomVariantVersion,
        state: 'PENDING',
        fingerprint: preparedRoomProposal.fingerprint,
        findings: deepClone(preparedRoomProposal.findings),
        items: deepClone(preparedRoomProposal.items),
        proposer: { actor: deepClone(command.actor), taskId: command.taskId, grantId: command.grantId, branchId: command.branchId },
        submittedAt: now,
        submittedRevision: command.baseRevision + 1,
        decidedAt: null,
        decidedBy: null,
        decisionRevision: null,
        appliedAt: null,
        appliedBy: null,
        appliedRevision: null,
        createdRoomVariantVersion: null,
      };
      library.proposals.push(proposal);
      return {
        snapshot: next,
        result: { proposalId: proposal.proposalId, proposalVersion: 1, state: 'PENDING', roomVariantId: proposal.roomVariantId, itemCount: proposal.items.length, fingerprint: proposal.fingerprint },
        summary: `${proposal.items.length} room placement proposal item(s) submitted as ${proposal.proposalId}.`,
        changes: [{ entityType: 'room_placement_proposal', entityId: proposal.proposalId, operation: 'submitted' }],
      };
    }
    case 'room.placement.proposal.decide': {
      assertExactFields(payload, new Set(['proposalId', 'expectedProposalVersion', 'decisions']), 'payload');
      const library = roomLibrary(next);
      const proposalId = requireId(payload.proposalId, 'payload.proposalId');
      const { index, proposal } = roomProposalHead(library, proposalId);
      invariant(proposal.state === 'PENDING', 'ENTITY_STATE_CONFLICT', 'Only a pending room proposal can be decided.', { proposalId, state: proposal.state });
      const expectedProposalVersion = requireInteger(payload.expectedProposalVersion, 'payload.expectedProposalVersion', { min: 1 });
      invariant(proposal.proposalVersion === expectedProposalVersion, 'ENTITY_VERSION_CONFLICT', 'The room proposal changed after decision preparation.', { proposalId, expectedProposalVersion, actualVersion: proposal.proposalVersion });
      invariant(Array.isArray(payload.decisions) && payload.decisions.length === proposal.items.length, 'ROOM_PROPOSAL_DECISION_INCOMPLETE', 'The owner decision must cover every room proposal item exactly once.', { proposalId });
      const decisions = new Map();
      for (const [decisionIndex, candidate] of payload.decisions.entries()) {
        const decision = requireRecord(candidate, `payload.decisions[${decisionIndex}]`);
        assertExactFields(decision, new Set(['itemId', 'disposition', 'reason']), `payload.decisions[${decisionIndex}]`);
        invariant(Object.hasOwn(decision, 'reason'), 'VALIDATION_ERROR', 'Every decision requires an explicit reason field.');
        const itemId = requireId(decision.itemId, `payload.decisions[${decisionIndex}].itemId`);
        invariant(!decisions.has(itemId), 'ROOM_PROPOSAL_DECISION_DUPLICATE', 'A room proposal item may be decided only once.', { itemId });
        const disposition = requireEnum(decision.disposition, `payload.decisions[${decisionIndex}].disposition`, ['ACCEPTED', 'REJECTED']);
        const reason = decision.reason === null ? null : requireString(decision.reason, `payload.decisions[${decisionIndex}].reason`, { max: 2000 });
        invariant(disposition !== 'REJECTED' || reason !== null, 'ROOM_PROPOSAL_REJECTION_REASON_REQUIRED', 'Rejected room proposal items require a reason.', { itemId });
        invariant(disposition !== 'ACCEPTED' || reason === null, 'VALIDATION_ERROR', 'Accepted room proposal items use a null reason.', { itemId });
        decisions.set(itemId, { disposition, reason });
      }
      const items = proposal.items.map((item) => {
        const decision = decisions.get(item.itemId);
        invariant(decision, 'ROOM_PROPOSAL_DECISION_INCOMPLETE', 'The owner decision omitted a room proposal item.', { itemId: item.itemId });
        return { ...item, decision: { ...decision, decidedAt: now, decidedBy: command.actor.id, decisionRevision: command.baseRevision + 1 } };
      });
      const acceptedCount = items.filter((item) => item.decision.disposition === 'ACCEPTED').length;
      library.proposals[index] = {
        ...proposal, proposalVersion: 2, state: 'DECIDED', items,
        decidedAt: now, decidedBy: command.actor.id, decisionRevision: command.baseRevision + 1,
      };
      return {
        snapshot: next,
        result: { proposalId, proposalVersion: 2, state: 'DECIDED', acceptedCount, rejectedCount: items.length - acceptedCount },
        summary: `Room proposal ${proposalId} decided: ${acceptedCount} accepted, ${items.length - acceptedCount} rejected.`,
        changes: [{ entityType: 'room_placement_proposal', entityId: proposalId, operation: 'decided' }],
      };
    }
    case 'room.placement.proposal.apply': {
      assertExactFields(payload, new Set(['proposalId', 'expectedProposalVersion']), 'payload');
      invariant(projectDocument, 'ROOM_STORE_DISABLED', 'Room authoring requires the authoritative project document.');
      const library = roomLibrary(next);
      const proposalId = requireId(payload.proposalId, 'payload.proposalId');
      const { index, proposal } = roomProposalHead(library, proposalId);
      invariant(proposal.state === 'DECIDED', 'ENTITY_STATE_CONFLICT', 'Only a decided room proposal can be applied.', { proposalId, state: proposal.state });
      const expectedProposalVersion = requireInteger(payload.expectedProposalVersion, 'payload.expectedProposalVersion', { min: 2 });
      invariant(proposal.proposalVersion === expectedProposalVersion, 'ENTITY_VERSION_CONFLICT', 'The room proposal changed after apply preparation.', { proposalId, expectedProposalVersion, actualVersion: proposal.proposalVersion });
      const { entry, variant: current } = roomVariantHead(library, proposal.roomVariantId);
      assertRoomVersion(current, proposal.expectedRoomVariantVersion);
      assertRoomDraft(current);
      const accepted = proposal.items.filter((item) => item.decision?.disposition === 'ACCEPTED');
      const rejected = proposal.items.filter((item) => item.decision?.disposition === 'REJECTED');
      invariant(accepted.length + rejected.length === proposal.items.length, 'ROOM_PROPOSAL_DECISION_INCOMPLETE', 'Every proposal item must have a terminal owner decision.');
      const applied = applyRoomPlacementItems(current.placements, accepted, { proposalId });
      const candidate = {
        ...roomVariantValue(current),
        version: current.version + 1,
        placements: applied.placements,
        acceptedWarningFindingIds: [],
        parentVariantVersion: current.version,
      };
      const archetype = roomArchetypeHead(library, current.roomArchetypeId, current.archetypeVersion);
      const version = validatedRoomVersion({
        candidate, archetype, document: projectDocument, now, actorId: command.actor.id,
        createdRevision: command.baseRevision + 1, proposalId,
      });
      appendRoomVersion(entry, version);
      library.proposals[index] = {
        ...proposal,
        proposalVersion: 3,
        state: 'APPLIED',
        appliedAt: now,
        appliedBy: command.actor.id,
        appliedRevision: command.baseRevision + 1,
        createdRoomVariantVersion: version.version,
      };
      return {
        snapshot: next,
        result: { proposalId, proposalVersion: 3, state: 'APPLIED', roomVariantId: current.roomVariantId, roomVariantVersion: version.version, appliedItemIds: accepted.map((item) => item.itemId), rejectedItemIds: rejected.map((item) => item.itemId) },
        summary: `Room proposal ${proposalId} applied ${accepted.length} accepted item(s); ${rejected.length} rejected item(s) remain inspectable.`,
        changes: [
          { entityType: 'room_variant', entityId: current.roomVariantId, operation: 'versioned' },
          { entityType: 'room_placement_proposal', entityId: proposalId, operation: 'applied' },
        ],
      };
    }
    case 'room.variant.warning.disposition.set':
    case 'room.variant.validate':
    case 'room.variant.finalize':
    case 'room.variant.fork': {
      invariant(projectDocument, 'ROOM_STORE_DISABLED', 'Room authoring requires the authoritative project document.');
      const allowed = command.type === 'room.variant.warning.disposition.set'
        ? ['roomVariantId', 'expectedRoomVariantVersion', 'acceptedWarningFindingIds']
        : ['roomVariantId', 'expectedRoomVariantVersion'];
      assertExactFields(payload, new Set(allowed), 'payload');
      const library = roomLibrary(next);
      const { entry, variant: current } = roomVariantHead(library, requireId(payload.roomVariantId, 'payload.roomVariantId'));
      assertRoomVersion(current, payload.expectedRoomVariantVersion);
      assertNoActiveRoomProposal(library, current);
      const archetype = roomArchetypeHead(library, current.roomArchetypeId, current.archetypeVersion);
      let candidate;
      if (command.type === 'room.variant.fork') {
        candidate = forkFinalRoomVariant({ finalVariant: roomVariantValue(current), nextVersion: current.version + 1 });
      } else {
        candidate = {
          ...roomVariantValue(current),
          version: current.version + 1,
          parentVariantVersion: current.version,
        };
        if (command.type === 'room.variant.warning.disposition.set') {
          invariant(['DRAFT', 'VALIDATED'].includes(current.lifecycle), 'ROOM_LIFECYCLE_TRANSITION_INVALID', 'Warnings may be dispositioned only on DRAFT or VALIDATED rooms.');
          invariant(Array.isArray(payload.acceptedWarningFindingIds), 'VALIDATION_ERROR', 'acceptedWarningFindingIds must be an array.');
          const currentWarnings = new Set(current.findings.filter((finding) => finding.severity === 'WARNING').map((finding) => finding.findingId));
          const accepted = payload.acceptedWarningFindingIds.map((idValue) => requireString(idValue, 'payload.acceptedWarningFindingIds[]', { max: 128 }));
          invariant(new Set(accepted).size === accepted.length && accepted.every((findingId) => currentWarnings.has(findingId)), 'ROOM_WARNING_NOT_FOUND', 'Only unique current warning findings may be dispositioned.');
          candidate.acceptedWarningFindingIds = [...accepted].sort();
        } else if (command.type === 'room.variant.validate') {
          invariant(current.lifecycle === 'DRAFT', 'ROOM_LIFECYCLE_TRANSITION_INVALID', 'Only a DRAFT room can be validated.');
          candidate.lifecycle = 'VALIDATED';
        } else {
          invariant(current.lifecycle === 'VALIDATED', 'ROOM_LIFECYCLE_TRANSITION_INVALID', 'Only a VALIDATED room can be finalized.');
          candidate.lifecycle = 'FINAL';
        }
      }
      const version = validatedRoomVersion({
        candidate, archetype, document: projectDocument, now, actorId: command.actor.id,
        createdRevision: command.baseRevision + 1,
      });
      if (command.type === 'room.variant.validate') {
        evaluateRoomLifecycle({ current: 'DRAFT', target: 'VALIDATED', findings: version.findings, acceptedWarningFindingIds: version.acceptedWarningFindingIds });
      } else if (command.type === 'room.variant.finalize') {
        evaluateRoomLifecycle({ current: 'VALIDATED', target: 'FINAL', findings: version.findings, acceptedWarningFindingIds: version.acceptedWarningFindingIds });
      }
      appendRoomVersion(entry, version);
      const operation = command.type.split('.').at(-1);
      return {
        snapshot: next,
        result: { roomVariantId: current.roomVariantId, roomVariantVersion: version.version, lifecycle: version.lifecycle, contentFingerprint: version.contentFingerprint },
        summary: `Room variant ${current.roomVariantId} ${operation} created immutable version ${version.version}.`,
        changes: [{ entityType: 'room_variant', entityId: current.roomVariantId, operation }],
      };
    }
    default:
      throw new StudioError('UNKNOWN_COMMAND', `Unknown Studio command: ${command.type}.`);
  }
}

function createRevision({ command, number, now, commandHash, snapshot, result, summary, changes }) {
  const event = {
    id: `activity:${command.commandId}`,
    projectId: command.projectId,
    revision: number,
    occurredAt: now,
    actor: deepClone(command.actor),
    taskId: command.taskId,
    commandId: command.commandId,
    commandType: command.type,
    status: 'committed',
    summary,
    changes: deepClone(changes),
  };
  return deepFreeze({
    id: `revision:${number}`,
    number,
    parentRevision: number - 1,
    committedAt: now,
    command: {
      schemaVersion: command.schemaVersion,
      commandId: command.commandId,
      idempotencyKey: command.idempotencyKey,
      type: command.type,
      actor: deepClone(command.actor),
      taskId: command.taskId,
      grantId: command.grantId,
      fingerprint: commandHash,
    },
    snapshot: deepClone(snapshot),
    result: deepClone(result),
    event,
  });
}

function createProjectRevision(command, now, commandHash) {
  invariant(command.actor.kind === 'human', 'FORBIDDEN', 'A human owner must create the project.');
  invariant(command.actor.id === command.payload.ownerId, 'FORBIDDEN', 'The creating actor must be the project owner.');
  invariant(command.baseRevision === 0, 'REVISION_CONFLICT', 'A new project must use baseRevision 0.');
  const name = requireString(command.payload.name, 'payload.name', { max: 160 });
  const snapshot = {
    project: {
      id: command.projectId,
      name,
      description: optionalString(command.payload.description, 'payload.description', { max: 2000 }),
      ownerId: requireId(command.payload.ownerId, 'payload.ownerId'),
      status: 'draft',
      statusNote: null,
      createdAt: now,
      updatedAt: now,
    },
    grants: [],
    sources: [],
    assets: [],
    rooms: [],
    levels: [],
  };
  return createRevision({
    command,
    number: 1,
    now,
    commandHash,
    snapshot,
    result: { projectId: command.projectId },
    summary: `Project ${name} created.`,
    changes: [{ entityType: 'project', entityId: command.projectId, operation: 'created' }],
  });
}

export class StudioService {
  #store;
  #clock;
  #agentAttemptAuditReady;
  #jobStore;

  constructor({ store, clock = () => new Date().toISOString(), agentAttemptAuditReady = false, jobStore = null }) {
    invariant(store, 'VALIDATION_ERROR', 'A ProjectStore is required.');
    this.#store = store;
    this.#clock = clock;
    this.#agentAttemptAuditReady = agentAttemptAuditReady === true;
    this.#jobStore = jobStore;
  }

  get commandCatalog() {
    return listCommandDefinitions();
  }

  get agentAttemptAuditReady() {
    return this.#agentAttemptAuditReady;
  }

  get durableJobStoreReady() {
    return this.#jobStore?.isLive === true && this.#store.supportsAtomicAtlasJobs === true;
  }

  get durableAssetStoreReady() {
    return this.#store.supportsAtomicAssetLibrary === true;
  }

  get durableRoomStoreReady() {
    return this.#store.supportsAtomicRoomDesigner === true;
  }

  async execute(rawCommand, trustedExecutionContext, { signal } = {}) {
    signal?.throwIfAborted();
    const command = validateEnvelope(rawCommand, trustedExecutionContext);
    const definition = getCommandDefinition(command.type);
    const commandHash = commandFingerprint(command);
    const existing = await this.#store.loadProject(command.projectId);
    signal?.throwIfAborted();

    if (existing) {
      if (!command.dryRun) {
        const prior = findIdempotentRevision(existing, command.idempotencyKey);
        if (prior) {
          assertReplayMatches(prior, commandHash);
          return replayResult(prior);
        }
      }
      const duplicateCommand = findCommandRevision(existing, command.commandId);
      invariant(!duplicateCommand, 'COMMAND_ID_CONFLICT', 'The command ID was already committed.', {
        commandId: command.commandId,
        originalRevision: duplicateCommand?.number,
      });
    }

    const now = this.#clock();
    requireIsoDate(now, 'clock');

    if (command.type === 'project.create') {
      invariant(!existing, 'PROJECT_EXISTS', 'The project already exists.', { projectId: command.projectId });
      const revision = createProjectRevision(command, now, commandHash);
      if (command.dryRun) {
        return proposalResult(revision, definition);
      }
      try {
        signal?.throwIfAborted();
        await this.#store.createProject({
          formatVersion: 1,
          projectId: command.projectId,
          createdAt: now,
          revisions: [revision],
        });
        return committedResult(revision);
      } catch (error) {
        return this.#replayAfterConcurrentCommit(error, command, commandHash);
      }
    }

    invariant(existing, 'PROJECT_NOT_FOUND', 'The project does not exist.', { projectId: command.projectId });
    if (command.type === 'source.intake.commit') {
      invariant(
        this.#store.supportsAtomicSourceIntakeClaims === true,
        'SOURCE_INTAKE_STORE_DISABLED',
        'V2 source intake commits require the authoritative SQLite intake store.',
      );
    }
    if (definition.requiresDurableJobStore) {
      invariant(
        this.durableJobStoreReady,
        'JOB_STORE_DISABLED',
        'Atlas preview and commit require the authoritative SQLite job store.',
      );
    }
    if (definition.requiresDurableAssetStore) {
      invariant(
        this.durableAssetStoreReady,
        'ASSET_STORE_DISABLED',
        'V2 asset proposals, decisions, apply, and lifecycle require the authoritative SQLite v9 store.',
      );
    }
    if (definition.requiresDurableRoomStore) {
      invariant(
        this.durableRoomStoreReady,
        'ROOM_STORE_DISABLED',
        'Room and hallway authoring requires the authoritative SQLite v10 store.',
      );
    }
    const head = headRevision(existing);
    invariant(command.baseRevision === head.number, 'REVISION_CONFLICT', 'The project changed after the command was prepared.', {
      projectId: command.projectId,
      expectedRevision: command.baseRevision,
      actualRevision: head.number,
    });
    assertAuthorized(command, head.snapshot, definition, now);
    const atlasJob = command.type === 'atlas.commit.slices'
      ? this.#jobStore.get(command.projectId, requireId(command.payload.jobId, 'payload.jobId'))
      : null;
    const priorAtlas = ['atlas.define.rects', 'atlas.preview.slices'].includes(command.type)
      ? head.snapshot.atlases?.find((candidate) => candidate.id === command.payload.atlasId)
      : null;
    const priorAtlasJob = priorAtlas?.latestPreviewJobId
      ? this.#jobStore.get(command.projectId, priorAtlas.latestPreviewJobId)
      : null;
    const preparedAssetProposal = command.type === 'asset.proposal.submit'
      ? prepareAssetProposal(command, existing)
      : null;
    const preparedRoomProposal = command.type === 'room.placement.proposal.submit'
      ? prepareRoomPlacementProposal(command, existing)
      : null;
    const applied = applyCommand(command, head.snapshot, now, {
      atlasJob,
      priorAtlasJob,
      preparedAssetProposal,
      preparedRoomProposal,
      projectDocument: existing,
    });
    const revision = createRevision({
      command,
      number: head.number + 1,
      now,
      commandHash,
      ...applied,
    });
    if (command.dryRun) {
      return proposalResult(revision, definition);
    }

    try {
      // Last cancellable safe point: once the atomic store call starts, a
      // retry with the same idempotency key resolves any unknown outcome.
      signal?.throwIfAborted();
      await this.#store.appendRevision(command.projectId, command.baseRevision, revision);
      return committedResult(revision);
    } catch (error) {
      return this.#replayAfterConcurrentCommit(error, command, commandHash);
    }
  }

  async #replayAfterConcurrentCommit(error, command, commandHash) {
    if (!['PROJECT_EXISTS', 'REVISION_CONFLICT'].includes(error?.code)) {
      throw error;
    }
    const latest = await this.#store.loadProject(command.projectId);
    const prior = latest && findIdempotentRevision(latest, command.idempotencyKey);
    if (!prior) {
      const duplicateCommand = latest && findCommandRevision(latest, command.commandId);
      if (duplicateCommand) {
        throw new StudioError('COMMAND_ID_CONFLICT', 'The command ID was concurrently committed with another idempotency key.', {
          commandId: command.commandId,
          originalRevision: duplicateCommand.number,
        });
      }
      throw error;
    }
    assertReplayMatches(prior, commandHash);
    return replayResult(prior);
  }

  async proposeAtlasGrid(rawRequest, trustedExecutionContext, { signal } = {}) {
    signal?.throwIfAborted();
    const request = requireRecord(rawRequest, 'request');
    assertExactFields(request, new Set([
      'schemaVersion', 'projectId', 'expectedRevision', 'sourceId', 'rows', 'columns',
      'margins', 'gapX', 'gapY', 'rectangleIdPrefix',
    ]), 'Atlas grid proposal request');
    for (const field of AUTHORITY_FIELDS) {
      invariant(!Object.hasOwn(request, field), 'UNTRUSTED_AUTHORITY_FIELD', `Atlas grid proposal must not contain authority field: ${field}.`, { field });
    }
    invariant(request.schemaVersion === 1, 'SCHEMA_VERSION_UNSUPPORTED', 'Unsupported atlas proposal schema version.');
    const projectId = requireId(request.projectId, 'projectId');
    const executionContext = validateExecutionContext(trustedExecutionContext);
    const document = await this.#store.loadProject(projectId);
    signal?.throwIfAborted();
    invariant(document, 'PROJECT_NOT_FOUND', 'The project does not exist.', { projectId });
    const head = headRevision(document);
    const expectedRevision = requireInteger(request.expectedRevision, 'expectedRevision', { min: 1 });
    invariant(head.number === expectedRevision, 'REVISION_CONFLICT', 'The project changed after the grid proposal was prepared.', {
      projectId,
      expectedRevision,
      actualRevision: head.number,
    });
    assertAuthorized(
      { ...executionContext, projectId, type: 'project.read' },
      head.snapshot,
      { ownerOnly: false, requiredScope: 'project.read' },
      this.#clock(),
    );
    const sourceId = requireId(request.sourceId, 'sourceId');
    const { source, digest } = approvedPngSource(head.snapshot, sourceId);
    const proposal = proposeRegularGrid({
      sourceWidth: source.width,
      sourceHeight: source.height,
      rows: request.rows,
      columns: request.columns,
      margins: request.margins,
      gapX: request.gapX,
      gapY: request.gapY,
      rectangleIdPrefix: request.rectangleIdPrefix ?? `rect.${sourceId}`,
    });
    return deepFreeze({
      schemaVersion: 1,
      projectId,
      revision: head.number,
      source: {
        sourceId,
        digest,
        mediaType: source.mediaType,
        width: source.width,
        height: source.height,
        approvalDisposition: source.review.disposition,
      },
      proposal: deepClone(proposal),
    });
  }

  async readJob(rawRequest, trustedExecutionContext, { signal } = {}) {
    const { request, job } = await this.#authorizedJobRequest(rawRequest, trustedExecutionContext, {
      signal,
      allowedFields: new Set(['schemaVersion', 'projectId', 'jobId']),
      requiredScope: 'project.read',
    });
    return deepFreeze({
      schemaVersion: 1,
      projectId: request.projectId,
      job: externalJobProjection(job),
      events: this.#jobStore.listEvents(request.projectId, request.jobId).map(externalJobEventProjection),
    });
  }

  async cancelJob(rawRequest, trustedExecutionContext, { signal, authorizedAttempt = null } = {}) {
    const { request } = await this.#authorizedJobRequest(rawRequest, trustedExecutionContext, {
      signal,
      allowedFields: new Set(['schemaVersion', 'projectId', 'jobId', 'operationIdempotencyKey']),
      requiredScope: 'atlas.write',
    });
    const operationIdempotencyKey = requireId(request.operationIdempotencyKey, 'operationIdempotencyKey');
    signal?.throwIfAborted();
    const job = this.#jobStore.requestCancel(request.projectId, request.jobId, {
      operationIdempotencyKey,
      now: this.#clock(),
      authorizedAttempt,
    });
    return deepFreeze({
      schemaVersion: 1,
      projectId: request.projectId,
      job: externalJobProjection(job),
      events: this.#jobStore.listEvents(request.projectId, request.jobId).map(externalJobEventProjection),
    });
  }

  async retryJob(rawRequest, trustedExecutionContext, { signal, authorizedAttempt = null } = {}) {
    const { request } = await this.#authorizedJobRequest(rawRequest, trustedExecutionContext, {
      signal,
      allowedFields: new Set(['schemaVersion', 'projectId', 'jobId', 'expectedAttempt', 'operationIdempotencyKey']),
      requiredScope: 'atlas.write',
    });
    const expectedAttempt = requireInteger(request.expectedAttempt, 'expectedAttempt', { min: 1 });
    const operationIdempotencyKey = requireId(request.operationIdempotencyKey, 'operationIdempotencyKey');
    signal?.throwIfAborted();
    const job = this.#jobStore.retry(request.projectId, request.jobId, {
      expectedAttempt,
      operationIdempotencyKey,
      now: this.#clock(),
      authorizedAttempt,
    });
    return deepFreeze({
      schemaVersion: 1,
      projectId: request.projectId,
      job: externalJobProjection(job),
      events: this.#jobStore.listEvents(request.projectId, request.jobId).map(externalJobEventProjection),
    });
  }

  async discardJob(rawRequest, trustedExecutionContext, { signal, authorizedAttempt = null } = {}) {
    const { request } = await this.#authorizedJobRequest(rawRequest, trustedExecutionContext, {
      signal,
      allowedFields: new Set(['schemaVersion', 'projectId', 'jobId', 'operationIdempotencyKey']),
      requiredScope: 'atlas.write',
    });
    const operationIdempotencyKey = requireId(request.operationIdempotencyKey, 'operationIdempotencyKey');
    signal?.throwIfAborted();
    const job = this.#jobStore.discard(request.projectId, request.jobId, {
      operationIdempotencyKey,
      now: this.#clock(),
      authorizedAttempt,
    });
    return deepFreeze({
      schemaVersion: 1,
      projectId: request.projectId,
      job: externalJobProjection(job),
      events: this.#jobStore.listEvents(request.projectId, request.jobId).map(externalJobEventProjection),
    });
  }

  async #authorizedJobRequest(rawRequest, trustedExecutionContext, {
    signal,
    allowedFields,
    requiredScope,
  }) {
    signal?.throwIfAborted();
    invariant(this.durableJobStoreReady, 'JOB_STORE_DISABLED', 'Durable jobs require the authoritative SQLite job store.');
    const request = requireRecord(rawRequest, 'request');
    assertExactFields(request, allowedFields, 'Job request');
    for (const field of AUTHORITY_FIELDS) {
      invariant(!Object.hasOwn(request, field), 'UNTRUSTED_AUTHORITY_FIELD', `Job request must not contain authority field: ${field}.`, { field });
    }
    invariant(request.schemaVersion === 1, 'SCHEMA_VERSION_UNSUPPORTED', 'Unsupported job request schema version.');
    const normalizedRequest = {
      ...request,
      projectId: requireId(request.projectId, 'projectId'),
      jobId: requireId(request.jobId, 'jobId'),
    };
    const executionContext = validateExecutionContext(trustedExecutionContext);
    const document = await this.#store.loadProject(normalizedRequest.projectId);
    signal?.throwIfAborted();
    invariant(document, 'PROJECT_NOT_FOUND', 'The project does not exist.', { projectId: normalizedRequest.projectId });
    const head = headRevision(document);
    assertAuthorized(
      { ...executionContext, projectId: normalizedRequest.projectId, type: requiredScope === 'project.read' ? 'project.read' : 'job.operation' },
      head.snapshot,
      { ownerOnly: false, requiredScope },
      this.#clock(),
    );
    const job = this.#jobStore.get(normalizedRequest.projectId, normalizedRequest.jobId);
    invariant(job, 'JOB_NOT_FOUND', 'The job does not exist.', { projectId: normalizedRequest.projectId, jobId: normalizedRequest.jobId });
    assertJobOriginAuthority(job, executionContext, head.snapshot);
    return { request: normalizedRequest, job, head };
  }

  async readProjectTrusted(projectId) {
    requireId(projectId, 'projectId');
    const document = await this.#store.loadProject(projectId);
    invariant(document, 'PROJECT_NOT_FOUND', 'The project does not exist.', { projectId });
    const head = headRevision(document);
    return deepFreeze({
      schemaVersion: 1,
      projectId,
      revision: head.number,
      snapshot: deepClone(head.snapshot),
    });
  }

  async readProject(request, trustedExecutionContext, { signal } = {}) {
    signal?.throwIfAborted();
    const input = requireRecord(request, 'request');
    for (const field of AUTHORITY_FIELDS) {
      invariant(!Object.hasOwn(input, field), 'UNTRUSTED_AUTHORITY_FIELD', `Read request must not contain authority field: ${field}.`, {
        field,
      });
    }
    const projectId = requireId(input.projectId, 'projectId');
    const { actor, taskId, grantId, branchId } = validateExecutionContext(trustedExecutionContext);
    const document = await this.#store.loadProject(projectId);
    signal?.throwIfAborted();
    invariant(document, 'PROJECT_NOT_FOUND', 'The project does not exist.', { projectId });
    const head = headRevision(document);
    assertAuthorized(
      { actor, taskId, grantId, branchId, projectId, type: 'project.read' },
      head.snapshot,
      { ownerOnly: false, requiredScope: 'project.read' },
      this.#clock(),
    );
    if (actor.kind === 'agent') {
      const effectiveGrant = head.snapshot.grants.find((grant) => grant.id === grantId);
      const { grants: _secretGrants, ...redactedSnapshot } = redactAgentOnlySourceLocations(head.snapshot);
      return deepFreeze({
        schemaVersion: 1,
        projectId,
        revision: head.number,
        snapshot: redactedSnapshot,
        effectivePolicy: {
          taskId: effectiveGrant.taskId,
          branchId: effectiveGrant.branchId,
          scopes: [...effectiveGrant.scopes],
          objectScopes: deepClone(effectiveGrant.objectScopes),
          budget: deepClone(effectiveGrant.budget),
          usage: deepClone(effectiveGrant.usage),
          status: 'active',
          expiresAt: effectiveGrant.expiresAt,
        },
      });
    }
    return deepFreeze({ schemaVersion: 1, projectId, revision: head.number, snapshot: deepClone(head.snapshot) });
  }

  async queryAssets(rawRequest, trustedExecutionContext, { signal } = {}) {
    signal?.throwIfAborted();
    invariant(this.durableAssetStoreReady, 'ASSET_STORE_DISABLED', 'V2 asset queries require the authoritative SQLite v9 store.');
    const request = requireRecord(rawRequest, 'request');
    assertExactFields(request, new Set([
      'schemaVersion', 'projectId', 'assetId', 'proposalId', 'text', 'kinds',
      'lifecycles', 'tags', 'findingSeverities', 'includeProposals', 'limit',
    ]), 'Asset query');
    for (const field of AUTHORITY_FIELDS) {
      invariant(!Object.hasOwn(request, field), 'UNTRUSTED_AUTHORITY_FIELD', `Asset query must not contain authority field: ${field}.`, { field });
    }
    invariant(request.schemaVersion === 1, 'SCHEMA_VERSION_UNSUPPORTED', 'Unsupported asset query schema version.');
    const projectId = requireId(request.projectId, 'projectId');
    const executionContext = validateExecutionContext(trustedExecutionContext);
    const document = await this.#store.loadProject(projectId);
    signal?.throwIfAborted();
    invariant(document, 'PROJECT_NOT_FOUND', 'The project does not exist.', { projectId });
    const head = headRevision(document);
    assertAuthorized(
      { ...executionContext, projectId, type: 'project.read', payload: {} },
      head.snapshot,
      { ownerOnly: false, requiredScope: 'project.read' },
      this.#clock(),
    );
    const normalizeFilter = (value, field, allowed = null) => {
      if (value === undefined) return [];
      invariant(Array.isArray(value) && value.length <= 32, 'VALIDATION_ERROR', `${field} must contain at most 32 unique strings.`, { field });
      const normalized = value.map((entry, index) => requireString(entry, `${field}[${index}]`, { max: 128 }));
      invariant(new Set(normalized).size === normalized.length, 'VALIDATION_ERROR', `${field} must be unique.`, { field });
      if (allowed) normalized.forEach((entry) => requireEnum(entry, `${field}[]`, allowed));
      return normalized;
    };
    const assetId = request.assetId === undefined ? null : requireId(request.assetId, 'assetId');
    const proposalId = request.proposalId === undefined ? null : requireId(request.proposalId, 'proposalId');
    const text = request.text === undefined ? null : requireString(request.text, 'text', { max: 160 }).toLocaleLowerCase('en-US');
    const kinds = normalizeFilter(request.kinds, 'kinds', ASSET_KINDS);
    const lifecycles = normalizeFilter(request.lifecycles, 'lifecycles', ['DRAFT', 'METADATA_COMPLETE', 'VALIDATED', 'FINAL']);
    const tags = normalizeFilter(request.tags, 'tags');
    const findingSeverities = normalizeFilter(request.findingSeverities, 'findingSeverities', ['ERROR', 'WARNING', 'INFO']);
    const includeProposals = request.includeProposals === undefined ? proposalId !== null : request.includeProposals;
    invariant(typeof includeProposals === 'boolean', 'VALIDATION_ERROR', 'includeProposals must be boolean.', { field: 'includeProposals' });
    const limit = request.limit === undefined ? 100 : requireInteger(request.limit, 'limit', { min: 1, max: 100 });
    const library = head.snapshot.assetLibrary ?? { assets: [], proposals: [] };
    const assets = library.assets
      .filter((asset) => assetId === null || asset.assetId === assetId)
      .filter((asset) => proposalId === null || asset.proposal?.proposalId === proposalId)
      .filter((asset) => kinds.length === 0 || kinds.includes(asset.kind))
      .filter((asset) => lifecycles.length === 0 || lifecycles.includes(asset.lifecycle))
      .filter((asset) => tags.every((tag) => asset.metadata.tags.includes(tag)))
      .filter((asset) => findingSeverities.length === 0 || asset.findings.some((finding) => findingSeverities.includes(finding.severity)))
      .filter((asset) => text === null || [asset.assetId, asset.name, ...asset.metadata.tags].some((value) => value.toLocaleLowerCase('en-US').includes(text)))
      .sort((left, right) => left.name.localeCompare(right.name) || left.assetId.localeCompare(right.assetId))
      .slice(0, limit)
      .map(deepClone);
    invariant(assetId === null || assets.length === 1, 'ASSET_NOT_FOUND', 'The V2 asset does not exist in this project.', {
      projectId,
      assetId,
    });
    const proposals = includeProposals
      ? library.proposals
        .filter((proposal) => proposalId === null || proposal.proposalId === proposalId)
        .sort((left, right) => left.submittedRevision - right.submittedRevision || left.proposalId.localeCompare(right.proposalId))
        .slice(0, limit)
        .map(deepClone)
      : [];
    const visibleProposals = executionContext.actor.kind === 'agent'
      ? redactAgentOnlySourceLocations({ sources: [], assetLibrary: { proposals } }).assetLibrary.proposals
      : proposals;
    return deepFreeze({
      schemaVersion: 1,
      projectId,
      revision: head.number,
      filters: { assetId, proposalId, text, kinds, lifecycles, tags, findingSeverities },
      assets,
      proposals: visibleProposals,
    });
  }

  async queryRooms(rawRequest, trustedExecutionContext, { signal } = {}) {
    signal?.throwIfAborted();
    invariant(this.durableRoomStoreReady, 'ROOM_STORE_DISABLED', 'Room queries require the authoritative SQLite v10 store.');
    const request = requireRecord(rawRequest, 'request');
    assertExactFields(request, new Set([
      'schemaVersion', 'projectId', 'roomVariantId', 'roomArchetypeId', 'proposalId',
      'kinds', 'lifecycles', 'includeVersions', 'includeProposals', 'limit',
    ]), 'Room query');
    for (const field of AUTHORITY_FIELDS) {
      invariant(!Object.hasOwn(request, field), 'UNTRUSTED_AUTHORITY_FIELD', `Room query must not contain authority field: ${field}.`, { field });
    }
    invariant(request.schemaVersion === 1, 'SCHEMA_VERSION_UNSUPPORTED', 'Unsupported room query schema version.');
    const projectId = requireId(request.projectId, 'projectId');
    const executionContext = validateExecutionContext(trustedExecutionContext);
    const document = await this.#store.loadProject(projectId);
    signal?.throwIfAborted();
    invariant(document, 'PROJECT_NOT_FOUND', 'The project does not exist.', { projectId });
    const head = headRevision(document);
    assertAuthorized(
      { ...executionContext, projectId, type: 'project.read', payload: {} },
      head.snapshot,
      { ownerOnly: false, requiredScope: 'project.read' },
      this.#clock(),
    );
    const roomVariantId = request.roomVariantId === undefined ? null : requireId(request.roomVariantId, 'roomVariantId');
    const roomArchetypeId = request.roomArchetypeId === undefined ? null : requireId(request.roomArchetypeId, 'roomArchetypeId');
    const proposalId = request.proposalId === undefined ? null : requireId(request.proposalId, 'proposalId');
    const normalizeEnums = (value, field, allowed) => {
      if (value === undefined) return [];
      invariant(Array.isArray(value) && value.length <= allowed.length, 'VALIDATION_ERROR', `${field} is outside its bound.`, { field });
      const normalized = value.map((entry) => requireEnum(entry, `${field}[]`, allowed));
      invariant(new Set(normalized).size === normalized.length, 'VALIDATION_ERROR', `${field} values must be unique.`, { field });
      return normalized;
    };
    const kinds = normalizeEnums(request.kinds, 'kinds', ['room', 'hallway']);
    const lifecycles = normalizeEnums(request.lifecycles, 'lifecycles', ['DRAFT', 'VALIDATED', 'FINAL']);
    const includeVersions = request.includeVersions === undefined ? roomVariantId !== null : request.includeVersions;
    const includeProposals = request.includeProposals === undefined ? proposalId !== null : request.includeProposals;
    invariant(typeof includeVersions === 'boolean' && typeof includeProposals === 'boolean', 'VALIDATION_ERROR', 'Room include flags must be boolean.');
    const limit = request.limit === undefined ? 100 : requireInteger(request.limit, 'limit', { min: 1, max: 100 });
    const library = head.snapshot.roomLibrary ?? { archetypes: [], variants: [], proposals: [] };
    const archetypeById = new Map(library.archetypes.map((archetype) => [archetype.roomArchetypeId, archetype]));
    const variants = library.variants
      .map((entry) => {
        const current = entry.versions.find((version) => version.version === entry.headVersion);
        return { entry, current, archetype: archetypeById.get(current?.roomArchetypeId) };
      })
      .filter(({ current }) => current)
      .filter(({ current }) => roomVariantId === null || current.roomVariantId === roomVariantId)
      .filter(({ current }) => roomArchetypeId === null || current.roomArchetypeId === roomArchetypeId)
      .filter(({ archetype }) => kinds.length === 0 || kinds.includes(archetype?.kind))
      .filter(({ current }) => lifecycles.length === 0 || lifecycles.includes(current.lifecycle))
      .sort((left, right) => left.current.displayName.localeCompare(right.current.displayName) || left.current.roomVariantId.localeCompare(right.current.roomVariantId))
      .slice(0, limit)
      .map(({ entry, current, archetype }) => ({
        roomVariantId: entry.roomVariantId,
        headVersion: entry.headVersion,
        archetype: deepClone(archetype),
        current: deepClone(current),
        versions: includeVersions ? deepClone(entry.versions) : undefined,
      }));
    invariant(roomVariantId === null || variants.length === 1, 'ROOM_VARIANT_NOT_FOUND', 'The room variant does not exist in this project.', { projectId, roomVariantId });
    const proposals = includeProposals
      ? library.proposals
        .filter((proposal) => proposalId === null || proposal.proposalId === proposalId)
        .filter((proposal) => roomVariantId === null || proposal.roomVariantId === roomVariantId)
        .sort((left, right) => left.submittedRevision - right.submittedRevision || left.proposalId.localeCompare(right.proposalId))
        .slice(0, limit)
        .map(deepClone)
      : [];
    const visibleProposals = executionContext.actor.kind === 'agent'
      ? redactAgentOnlySourceLocations({ sources: [], roomLibrary: { proposals } }).roomLibrary.proposals
      : proposals;
    return deepFreeze({
      schemaVersion: 1,
      projectId,
      revision: head.number,
      filters: { roomVariantId, roomArchetypeId, proposalId, kinds, lifecycles },
      archetypes: roomVariantId === null
        ? library.archetypes.filter((archetype) => roomArchetypeId === null || archetype.roomArchetypeId === roomArchetypeId).map(deepClone)
        : [],
      variants,
      proposals: visibleProposals,
    });
  }

  async listActivityTrusted(projectId, { afterRevision = 0 } = {}) {
    requireId(projectId, 'projectId');
    requireInteger(afterRevision, 'afterRevision', { min: 0 });
    const document = await this.#store.loadProject(projectId);
    invariant(document, 'PROJECT_NOT_FOUND', 'The project does not exist.', { projectId });
    return deepFreeze(
      document.revisions
        .filter((revision) => revision.number > afterRevision)
        .map((revision) => deepClone(revision.event)),
    );
  }

  async listProjectsTrusted() {
    return deepFreeze(await this.#store.listProjects());
  }
}

export function implementedCommandTypes() {
  return COMMAND_DEFINITIONS.map((definition) => definition.type);
}
