import { types as utilTypes } from 'node:util';
import {
  PROCESSING_ADOPTION_PREFLIGHT_ARTIFACT_ROLES,
  PROCESSING_RESULT_ADOPTION_COMMAND_TYPE,
  PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE,
  createProcessingAdoptionPreflightReceipt,
  createProcessingResultAdoptionPlan,
  evaluateProcessingAdoptionArtifact,
  evaluateProcessingAdoptionAssetState,
  evaluateProcessingAdoptionCapability,
  uncheckedProcessingAdoptionArtifacts,
  uncheckedProcessingAdoptionAssetState,
  uncheckedProcessingAdoptionCapability,
  processingResultAdoptionCommandSha256,
  processingResultAdoptionSemanticSha256,
  validateProcessingResultAdoptionCommand,
  validateProcessingAdoptionPreflightRequest,
  validateProjectCapabilityManifest,
} from '../../../domain/src/index.js';
import {
  createProcessingResultAdoptionAggregate,
  processingResultAdoptionCommitResultSha256,
  validateProcessingResultAdoptionAggregate,
} from '../../../domain/src/processing-result-adoption-commit.js';
import { StudioError, invariant } from '../../../domain/src/errors.js';
import {
  requireActor,
  requireId,
  requireInteger,
  requireIsoDate,
  requireRecord,
} from '../../../domain/src/validation.js';
import { fingerprint } from '../../../application/src/value-utils.js';
import { projectCapabilitySelection } from '../../../application/src/project-capability-provider.js';
import {
  PROCESSING_ADOPTION_TASK_AUTHORITY_EVIDENCE_KIND,
  PROCESSING_ADOPTION_TASK_AUTHORITY_READER_KIND,
  PROCESSING_ADOPTION_TASK_AUTHORITY_READER_SCHEMA_VERSION,
  PROCESSING_ADOPTION_TASK_BRANCH_PREFLIGHT_EVIDENCE_KIND,
  PROCESSING_ADOPTION_TASK_BRANCH_PREFLIGHT_READER_KIND,
  PROCESSING_ADOPTION_TASK_BRANCH_PREFLIGHT_READER_SCHEMA_VERSION,
} from '../../../application/src/processing-result-adoption.js';
import { ContentAddressedArtifactStore } from '../artifacts/content-addressed-artifact-store.js';
import { SqliteWorkspace } from './sqlite-workspace.js';

export const PROCESSING_RESULT_ADOPTION_ATOMIC_STORE_SCHEMA_VERSION = 1;
export const PROCESSING_RESULT_ADOPTION_ATOMIC_STORE_KIND = 'studio.processing-result-adoption-atomic-store';

function clone(value) {
  return structuredClone(value);
}

function durableRevisionFingerprint(revision) {
  const comparable = clone(revision);
  for (const grant of comparable?.snapshot?.grants ?? []) delete grant.authorizationStatus;
  return fingerprint(comparable);
}

function parseJson(value, label) {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new StudioError('CORRUPT_PROCESSING_RESULT_ADOPTION', `Invalid JSON stored in ${label}.`, {
      cause: error.message,
    });
  }
}

function exactContext(value) {
  let input;
  try {
    input = structuredClone(value);
  } catch {
    throw new StudioError('PROCESSING_RESULT_ADOPTION_COMMAND_INVALID', 'The trusted execution context is invalid.');
  }
  const context = requireRecord(input, 'trustedExecutionContext');
  const allowed = new Set(['actor', 'taskId', 'grantId', 'branchId', 'correlationId']);
  invariant(Object.keys(context).every((key) => allowed.has(key)), 'PROCESSING_RESULT_ADOPTION_COMMAND_INVALID', 'The trusted execution context contains unsupported fields.');
  const actor = requireActor(context.actor);
  invariant(actor.kind === 'agent', 'FORBIDDEN', 'Processing-result adoption is agent-task-only.');
  const branchId = requireId(context.branchId, 'trustedExecutionContext.branchId');
  invariant(branchId !== 'branch.main', 'TASK_BRANCH_REQUIRED', 'Processing-result adoption requires an isolated task branch.');
  return Object.freeze({
    actor,
    taskId: requireId(context.taskId, 'trustedExecutionContext.taskId'),
    grantId: requireId(context.grantId, 'trustedExecutionContext.grantId'),
    branchId,
    correlationId: context.correlationId === null || context.correlationId === undefined
      ? null
      : requireId(context.correlationId, 'trustedExecutionContext.correlationId'),
  });
}

function authorityBinding(command, context) {
  return Object.freeze({
    schemaVersion: 1,
    kind: 'studio.processing-result-adoption-authority-binding',
    projectId: command.projectId,
    revision: command.baseRevision,
    actorId: context.actor.id,
    taskId: context.taskId,
    grantId: context.grantId,
    branchId: context.branchId,
  });
}

function hasObjectScope(scopes, kind, id) {
  return Array.isArray(scopes) && scopes.some((scope) => scope?.kind === kind && scope?.id === id);
}

function assertCapabilitySupported(check) {
  const codes = {
    NOT_CHECKED: 'PROCESSING_ADOPTION_CAPABILITY_NOT_CHECKED',
    PROFILE_NOT_FOUND: 'PROCESSING_ADOPTION_CAPABILITY_PROFILE_NOT_FOUND',
    PIN_MISMATCH: 'PROCESSING_ADOPTION_CAPABILITY_PIN_MISMATCH',
    UNSUPPORTED: 'PROCESSING_ADOPTION_CAPABILITY_UNSUPPORTED',
  };
  invariant(check.status === 'SUPPORTED', codes[check.status] ?? 'PROCESSING_ADOPTION_CAPABILITY_UNSUPPORTED', 'The current project capability does not support processing-result adoption.');
}

function assertAssetMatched(check) {
  const codes = {
    NOT_CHECKED: 'PROCESSING_ADOPTION_ASSET_STATE_NOT_CHECKED',
    PROJECT_REVISION_STALE: 'PROCESSING_ADOPTION_PROJECT_REVISION_STALE',
    TARGET_OCCUPIED: 'PROCESSING_ADOPTION_TARGET_OCCUPIED',
    TARGET_NOT_FOUND: 'PROCESSING_ADOPTION_TARGET_NOT_FOUND',
    TARGET_LEGACY_ONLY: 'PROCESSING_ADOPTION_TARGET_LEGACY_ONLY',
    TARGET_KIND_MISMATCH: 'PROCESSING_ADOPTION_TARGET_KIND_MISMATCH',
    TARGET_VERSION_CONFLICT: 'PROCESSING_ADOPTION_TARGET_VERSION_CONFLICT',
    TARGET_AMBIGUOUS: 'PROCESSING_ADOPTION_TARGET_AMBIGUOUS',
  };
  invariant(check.status === 'MATCHED', codes[check.status] ?? 'PROCESSING_ADOPTION_TARGET_AMBIGUOUS', 'The current Asset identity or head does not match adoption.', { status: check.status });
}

async function withPngEvidence(store, digest, operation) {
  try {
    return await store.withVerifiedPngEvidence(digest, operation);
  } catch (error) {
    if (error?.code === 'ARTIFACT_MISSING') {
      throw new StudioError('PROCESSING_ADOPTION_ARTIFACT_CONTENT_MISSING', 'Processing artifact content is missing.', { digest });
    }
    if (['ARTIFACT_CORRUPT', 'ARTIFACT_DIMENSIONS_EXCEEDED', 'ARTIFACT_MALFORMED', 'ARTIFACT_MEDIA_MISMATCH'].includes(error?.code)) {
      throw new StudioError('PROCESSING_ADOPTION_ARTIFACT_CONTENT_CORRUPT', 'Processing artifact content is corrupt.', { digest });
    }
    throw error;
  }
}

function assertCommandBudget(subject, label) {
  invariant(
    Number.isInteger(subject?.budget?.maxCommands)
      && Number.isInteger(subject?.usage?.commands)
      && subject.usage.commands < subject.budget.maxCommands,
    'BUDGET_EXCEEDED',
    `${label} command budget is exhausted.`,
  );
}

function durableBranchCommandCharge(database, projectId, taskId) {
  const rows = database.prepare(`
    SELECT revision_json FROM task_branch_revisions
    WHERE project_id = ? AND task_id = ?
    ORDER BY branch_revision
  `).all(projectId, taskId);
  let total = 0;
  for (const row of rows) {
    const revision = parseJson(row.revision_json, 'task_branch_revisions.revision_json');
    const command = revision?.command;
    let charge = 1;
    if (['asset.proposal.submit', 'room.placement.proposal.submit'].includes(command?.type)) {
      invariant(
        Array.isArray(command?.payload?.items)
          && command.payload.items.length > 0
          && command.payload.items.length <= 64,
        'CORRUPT_PROCESSING_RESULT_ADOPTION',
        'A multi-item branch command has no rederivable command charge.',
      );
      charge = command.payload.items.length;
    }
    invariant(
      Number.isSafeInteger(charge) && charge >= 1 && total <= Number.MAX_SAFE_INTEGER - charge,
      'CORRUPT_PROCESSING_RESULT_ADOPTION',
      'Branch command usage cannot be rederived safely.',
    );
    total += charge;
  }
  return total;
}

function readAuthority(database, command, context, now) {
  const row = database.prepare(`
    SELECT * FROM agent_tasks WHERE project_id = ? AND task_id = ?
  `).get(command.projectId, context.taskId);
  invariant(row, 'TASK_NOT_FOUND', 'The bound agent task does not exist.');
  const task = parseJson(row.task_json, 'agent_tasks.task_json');
  const document = parseJson(row.head_document_json, 'agent_tasks.head_document_json');
  const head = document.revisions?.at(-1);
  invariant(
    task.projectId === command.projectId
      && task.taskId === context.taskId
      && task.state === row.state
      && task.expiresAt === row.expires_at
      && task.headRevision === Number(row.head_revision),
    'CORRUPT_PROCESSING_RESULT_ADOPTION',
    'The task row and its durable task projection disagree.',
  );
  invariant(
    document.projectId === command.projectId
      && head?.snapshot?.project?.id === command.projectId,
    'CORRUPT_PROCESSING_RESULT_ADOPTION',
    'The task branch document does not belong to the commanded project.',
  );
  invariant(row.state === 'ACTIVE', row.state === 'PAUSED' ? 'TASK_PAUSED' : 'TASK_NOT_EXECUTABLE', 'The bound agent task is not executable.', { state: row.state });
  invariant(Number(row.head_revision) === command.baseRevision && head?.number === command.baseRevision, 'REVISION_CONFLICT', 'The task branch changed after the command was prepared.', {
    expectedRevision: command.baseRevision,
    actualRevision: Number(row.head_revision),
  });
  const durableHeadRow = Number(row.head_revision) === Number(row.base_revision)
    ? database.prepare(`
      SELECT revision_json FROM revisions
      WHERE project_id = ? AND revision_number = ?
    `).get(command.projectId, Number(row.head_revision))
    : database.prepare(`
      SELECT revision_json FROM task_branch_revisions
      WHERE project_id = ? AND task_id = ? AND branch_revision = ?
    `).get(command.projectId, context.taskId, Number(row.head_revision));
  const durableHead = durableHeadRow
    ? parseJson(durableHeadRow.revision_json, 'durable head revision_json')
    : null;
  invariant(
    durableHead
      && durableRevisionFingerprint(durableHead) === durableRevisionFingerprint(head),
    'CORRUPT_PROCESSING_RESULT_ADOPTION',
    'The mutable task branch head disagrees with its durable revision ledger.',
  );
  invariant(row.branch_id === context.branchId && task.branchId === context.branchId, 'TASK_BRANCH_MISMATCH', 'The trusted branch does not match the task branch.');
  invariant(row.agent_id === context.actor.id && task.agentId === context.actor.id, 'TASK_ACTOR_MISMATCH', 'The trusted actor does not match the task agent.');
  invariant(row.grant_id === context.grantId && task.grantId === context.grantId, 'TASK_GRANT_MISMATCH', 'The trusted grant does not match the task authority.');
  invariant(Date.parse(requireIsoDate(row.expires_at, 'task.expiresAt')) > Date.parse(now), 'TASK_EXPIRED', 'The bound agent task has expired.');
  invariant(task.capabilities?.includes(PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE), 'TASK_CAPABILITY_MISSING', 'The task lacks the private processing-result adoption capability.');
  invariant(!task.autoAcceptPolicy?.allowedCommandTypes?.includes(PROCESSING_RESULT_ADOPTION_COMMAND_TYPE), 'AUTO_ACCEPT_FORBIDDEN', 'Processing-result adoption cannot be auto-accepted.');
  const assetId = command.payload.preflightRequest.target.assetId;
  invariant(hasObjectScope(task.objectScopes, 'project', command.projectId) && hasObjectScope(task.objectScopes, 'asset', assetId), 'OBJECT_SCOPE_DENIED', 'The task does not cover the project and target Asset.');
  assertCommandBudget(task, 'Task');

  const grant = head.snapshot?.grants?.find((candidate) => candidate.id === context.grantId);
  const grantRow = database.prepare(`
    SELECT * FROM grants WHERE project_id = ? AND grant_id = ?
  `).get(command.projectId, context.grantId);
  invariant(grant && grantRow, 'GRANT_NOT_FOUND', 'The bound task grant does not exist.');
  invariant(grantRow.authorization_status === 'ACTIVE' && grantRow.status === 'ACTIVE'
    && grant.status === 'ACTIVE' && grantRow.revoked_at === null && grant.revokedAt === null,
  grantRow.authorization_status === 'LEGACY_UNBOUND' ? 'GRANT_REQUIRED' : 'GRANT_REVOKED',
  'The bound task grant is not active.');
  invariant(grant.agentId === context.actor.id && grantRow.agent_id === context.actor.id, 'GRANT_ACTOR_MISMATCH', 'The grant belongs to another agent.');
  invariant(grant.taskId === context.taskId && grantRow.task_id === context.taskId, 'GRANT_TASK_MISMATCH', 'The grant belongs to another task.');
  invariant(grant.branchId === context.branchId && grantRow.branch_id === context.branchId, 'GRANT_BRANCH_MISMATCH', 'The grant belongs to another branch.');
  invariant(grant.scopes?.includes(PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE)
    && parseJson(grantRow.scopes_json, 'grants.scopes_json').includes(PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE),
  'GRANT_SCOPE_MISSING', 'The grant lacks the private processing-result adoption scope.');
  const rowScopes = parseJson(grantRow.object_scopes_json, 'grants.object_scopes_json');
  invariant(hasObjectScope(grant.objectScopes, 'project', command.projectId)
    && hasObjectScope(grant.objectScopes, 'asset', assetId)
    && hasObjectScope(rowScopes, 'project', command.projectId)
    && hasObjectScope(rowScopes, 'asset', assetId),
  'OBJECT_SCOPE_DENIED', 'The grant does not cover the project and target Asset.');
  invariant(grant.expiresAt === grantRow.expires_at, 'CORRUPT_PROCESSING_RESULT_ADOPTION', 'The branch grant expiry disagrees with its authority row.');
  const expiresAt = grant.expiresAt;
  invariant(expiresAt === null || Date.parse(requireIsoDate(expiresAt, 'grant.expiresAt')) > Date.parse(now), 'GRANT_EXPIRED', 'The bound task grant has expired.');
  const baseGrantBudget = parseJson(grantRow.budget_json, 'grants.budget_json');
  const baseGrantUsage = parseJson(grantRow.usage_json, 'grants.usage_json');
  invariant(
    fingerprint(task.budget) === fingerprint(grant.budget)
      && fingerprint(grant.budget) === fingerprint(baseGrantBudget),
    'CORRUPT_PROCESSING_RESULT_ADOPTION',
    'Task, branch-grant, and authority-row budgets disagree.',
  );
  assertCommandBudget(grant, 'Grant');
  invariant(
    task.usage?.commands === grant.usage?.commands,
    'CORRUPT_PROCESSING_RESULT_ADOPTION',
    'Task and branch-grant command usage disagree.',
  );
  const committedBranchCharge = durableBranchCommandCharge(database, command.projectId, context.taskId);
  invariant(
    Number.isInteger(baseGrantUsage?.commands)
      && task.usage.commands === baseGrantUsage.commands + committedBranchCharge,
    'CORRUPT_PROCESSING_RESULT_ADOPTION',
    'Branch command usage does not match the durable base grant plus rederived branch-ledger charge.',
  );
  return { row, task, document, head, grant };
}

function processingHeads(snapshot) {
  const projection = snapshot.processingResultAdoptionHeads ?? { schemaVersion: 1, assets: [] };
  invariant(
    projection?.schemaVersion === 1 && Array.isArray(projection.assets),
    'CORRUPT_PROCESSING_RESULT_ADOPTION',
    'Private processingResultAdoptionHeads must be a schema-v1 projection.',
  );
  return projection.assets;
}

function currentAsset(snapshot, assetId) {
  const legacy = snapshot.assets?.find((asset) => asset.id === assetId) ?? null;
  const privateHead = processingHeads(snapshot).find((asset) => asset.assetId === assetId) ?? null;
  const cp2c = snapshot.assetLibrary?.assets?.find((asset) => asset.assetId === assetId) ?? null;
  const v2 = privateHead ?? cp2c;
  const identityState = legacy && v2 ? 'AMBIGUOUS'
    : legacy ? 'LEGACY_OCCUPIED'
      : v2 ? 'V2_HEAD' : 'UNUSED';
  return { identityState, head: v2 };
}

function assetEvidence(command, snapshot) {
  const request = command.payload.preflightRequest;
  const observed = currentAsset(snapshot, request.target.assetId);
  return {
    schemaVersion: 1,
    kind: 'studio.processing-adoption-asset-state',
    project: { projectId: command.projectId, observedRevision: command.baseRevision },
    assetId: request.target.assetId,
    identityState: observed.identityState,
    head: observed.identityState === 'V2_HEAD' ? {
      assetId: observed.head.assetId,
      assetKind: observed.head.kind,
      assetVersion: observed.head.assetVersion,
      metadataVersion: observed.head.metadataVersion,
    } : null,
  };
}

function artifactDescriptor(command, role) {
  const request = command.payload.preflightRequest;
  return role === 'recipe-input'
    ? request.processingRecipe.inputs[0]
    : request.assetInputSelection.selectedOutput;
}

function hasProjectArtifactReference(database, projectId, digest) {
  return Boolean(database.prepare(`
    SELECT 1 FROM artifact_references WHERE project_id = ? AND digest = ?
    LIMIT 1
  `).get(projectId, digest));
}

function artifactEvidence(database, command, role, physical, verifiedAt) {
  const descriptor = artifactDescriptor(command, role);
  invariant(hasProjectArtifactReference(database, command.projectId, descriptor.sha256), 'PROCESSING_ADOPTION_ARTIFACT_PROJECT_REFERENCE_MISSING', 'The project no longer references a processing artifact.', { role, digest: descriptor.sha256 });
  const metadata = database.prepare(`
    SELECT * FROM artifacts WHERE digest = ?
  `).get(descriptor.sha256);
  invariant(metadata, 'PROCESSING_ADOPTION_ARTIFACT_METADATA_MISSING', 'Processing artifact metadata is not registered.', { role, digest: descriptor.sha256 });
  invariant(metadata.state === 'LIVE', 'PROCESSING_ADOPTION_ARTIFACT_NOT_LIVE', 'Processing artifact metadata is not LIVE.', { role, digest: descriptor.sha256, state: metadata.state });
  invariant(!database.prepare('SELECT 1 FROM cas_gc_marks WHERE digest = ?').get(descriptor.sha256), 'PROCESSING_ADOPTION_ARTIFACT_NOT_LIVE', 'Processing artifact is claimed for garbage collection.', { role, digest: descriptor.sha256 });
  const exact = metadata.uri === descriptor.artifactUri
    && metadata.media_type === descriptor.mediaType
    && Number(metadata.byte_size) === descriptor.byteSize
    && Number(metadata.width) === descriptor.width
    && Number(metadata.height) === descriptor.height
    && physical.sha256 === descriptor.sha256
    && physical.mediaType === descriptor.mediaType
    && physical.byteSize === descriptor.byteSize
    && physical.width === descriptor.width
    && physical.height === descriptor.height;
  invariant(exact, 'PROCESSING_ADOPTION_ARTIFACT_DESCRIPTOR_MISMATCH', 'Registered and physical artifact descriptors must match the command exactly.', { role, digest: descriptor.sha256 });
  const evidence = {
    schemaVersion: 1,
    kind: 'studio.processing-adoption-artifact-verification',
    project: { projectId: command.projectId, observedRevision: command.baseRevision },
    role,
    sha256: descriptor.sha256,
    status: 'VERIFIED',
    metadata: {
      artifactUri: metadata.uri,
      sha256: descriptor.sha256,
      mediaType: metadata.media_type,
      byteSize: Number(metadata.byte_size),
      width: Number(metadata.width),
      height: Number(metadata.height),
      state: metadata.state,
    },
    physical: clone(physical),
  };
  return {
    check: evaluateProcessingAdoptionArtifact(command.payload.preflightRequest, role, evidence),
    reference: {
      role,
      descriptor: {
        artifactUri: metadata.uri,
        sha256: descriptor.sha256,
        mediaType: metadata.media_type,
        byteSize: Number(metadata.byte_size),
        width: Number(metadata.width),
        height: Number(metadata.height),
      },
      metadata: clone(evidence.metadata),
      physical: clone(evidence.physical),
      verifiedAt,
    },
  };
}

function currentAssetForAggregate(command, snapshot) {
  const request = command.payload.preflightRequest;
  const target = request.target;
  const observed = currentAsset(snapshot, target.assetId);
  const current = observed.head;
  const create = target.operation === 'create';
  invariant(create ? observed.identityState === 'UNUSED' : observed.identityState === 'V2_HEAD',
    create ? 'PROCESSING_ADOPTION_TARGET_OCCUPIED' : 'PROCESSING_ADOPTION_TARGET_NOT_FOUND',
    'The current Asset identity cannot satisfy adoption.');
  if (create) return null;
  invariant(current.kind === request.assetInputSelection.assetKind, 'PROCESSING_ADOPTION_TARGET_KIND_MISMATCH', 'The Asset kind changed before adoption.');
  invariant(current.assetVersion === target.expectedAssetVersion
    && current.metadataVersion === target.expectedMetadataVersion,
  'PROCESSING_ADOPTION_TARGET_VERSION_CONFLICT', 'The Asset head changed before adoption.');
  return {
    assetId: current.assetId,
    name: current.name,
    kind: current.kind,
    assetVersion: current.assetVersion,
    metadataVersion: current.metadataVersion,
    metadata: clone(current.metadata),
    metadataFingerprint: current.metadataFingerprint,
    findings: clone(current.findings),
    binding: clone(current.processingBinding ?? current.sliceBinding),
  };
}

function replay(database, command, semanticFingerprint, { required = false } = {}) {
  const byCommandId = database.prepare(`
    SELECT * FROM task_branch_revisions
    WHERE project_id = ? AND task_id = ? AND command_id = ?
  `).get(command.projectId, semanticFingerprint.taskId, command.commandId);
  if (byCommandId) {
    invariant(
      byCommandId.idempotency_key === command.idempotencyKey
        && byCommandId.command_type === PROCESSING_RESULT_ADOPTION_COMMAND_TYPE,
      'COMMAND_ID_CONFLICT',
      'The command ID was already committed with another command or idempotency identity.',
    );
  }
  const byIdempotencyKey = database.prepare(`
    SELECT * FROM task_branch_revisions
    WHERE project_id = ? AND task_id = ? AND idempotency_key = ?
  `).get(command.projectId, semanticFingerprint.taskId, command.idempotencyKey);
  if (byIdempotencyKey) {
    invariant(
      byIdempotencyKey.command_type === PROCESSING_RESULT_ADOPTION_COMMAND_TYPE,
      'IDEMPOTENCY_CONFLICT',
      'The idempotency key belongs to another branch command type.',
    );
  }
  invariant(
    !byCommandId || !byIdempotencyKey
      || byCommandId.branch_revision === byIdempotencyKey.branch_revision,
    'CORRUPT_PROCESSING_RESULT_ADOPTION',
    'Command and idempotency identities resolve to different branch ledger rows.',
  );
  const row = byCommandId ?? byIdempotencyKey;
  if (!row) {
    invariant(!required, 'REVISION_CONFLICT', 'A concurrent adoption did not produce a replayable ledger row.');
    return null;
  }
  const adoption = database.prepare(`
    SELECT * FROM task_branch_processing_result_adoptions
    WHERE project_id = ? AND task_id = ? AND branch_revision = ?
  `).get(command.projectId, semanticFingerprint.taskId, row.branch_revision);
  invariant(adoption, 'CORRUPT_PROCESSING_RESULT_ADOPTION', 'A committed processing adoption lost its durable Aggregate.');
  invariant(
    adoption.command_id === row.command_id
      && adoption.idempotency_key === row.idempotency_key
      && adoption.branch_id === row.branch_id
      && adoption.committed_at === row.committed_at,
    'CORRUPT_PROCESSING_RESULT_ADOPTION',
    'The adoption ledger row disagrees with its branch revision coordinates.',
  );
  invariant(adoption.semantic_fingerprint === semanticFingerprint.value, 'IDEMPOTENCY_CONFLICT', 'The idempotency identity was already used for different adoption semantics.');
  const revision = parseJson(row.revision_json, 'task_branch_revisions.revision_json');
  invariant(
    revision.number === Number(row.branch_revision)
      && revision.id === row.revision_id
      && revision.committedAt === row.committed_at
      && revision.command?.commandId === row.command_id
      && revision.command?.idempotencyKey === row.idempotency_key
      && revision.command?.type === row.command_type,
    'CORRUPT_PROCESSING_RESULT_ADOPTION',
    'The immutable branch ledger columns disagree with revision_json.',
  );
  const aggregate = validateProcessingResultAdoptionAggregate(parseJson(
    adoption.record_json,
    'task_branch_processing_result_adoptions.record_json',
  ));
  const result = parseJson(adoption.result_json, 'task_branch_processing_result_adoptions.result_json');
  const resultFingerprint = processingResultAdoptionCommitResultSha256(result);
  const aggregatePlan = createProcessingResultAdoptionPlan(
    aggregate.command,
    aggregate.authorityBinding,
    aggregate.freshPreflightReceipt,
  );
  invariant(
    aggregate.project.projectId === command.projectId
      && aggregate.project.taskId === semanticFingerprint.taskId
      && aggregate.project.branchId === row.branch_id
      && aggregate.project.branchRevision === Number(row.branch_revision)
      && aggregate.command.commandId === row.command_id
      && aggregate.command.idempotencyKey === row.idempotency_key
      && aggregate.operation === adoption.operation
      && aggregate.asset.assetId === adoption.asset_id
      && aggregate.asset.kind === adoption.asset_kind
      && aggregate.asset.assetVersion === Number(adoption.asset_version)
      && aggregate.asset.metadataVersion === Number(adoption.metadata_version)
      && aggregate.commandFingerprint === adoption.command_fingerprint
      && aggregate.semanticFingerprint === semanticFingerprint.value
      && aggregate.semanticFingerprint === adoption.semantic_fingerprint
      && aggregatePlan.authority.bindingFingerprint === adoption.authority_binding_fingerprint
      && aggregate.freshPreflightReceiptFingerprint === adoption.preflight_receipt_fingerprint
      && aggregate.asset.processingBinding.fingerprint === adoption.processing_binding_fingerprint
      && aggregate.planFingerprint === adoption.plan_fingerprint
      && aggregate.asset.metadataFingerprint === adoption.metadata_fingerprint
      && aggregate.asset.findingsFingerprint === adoption.findings_fingerprint
      && aggregate.committedAt === row.committed_at
      && aggregate.committedBy === adoption.committed_by
      && revision.command?.fingerprint === adoption.command_fingerprint
      && processingResultAdoptionCommitResultSha256(aggregate.commitResult) === resultFingerprint
      && processingResultAdoptionCommitResultSha256(revision.result) === resultFingerprint
      && resultFingerprint === adoption.result_fingerprint,
    'CORRUPT_PROCESSING_RESULT_ADOPTION',
    'The durable Aggregate, branch revision, and commit result do not form one closed ledger record.',
  );
  return result;
}

function appendTimeline(database, projectId, taskId, event) {
  const row = database.prepare(`
    SELECT COALESCE(MAX(sequence), 0) AS sequence
    FROM task_timeline_events WHERE project_id = ? AND task_id = ?
  `).get(projectId, taskId);
  const sequence = Number(row.sequence) + 1;
  const value = { schemaVersion: 1, sequence, projectId, taskId, ...event };
  database.prepare(`
    INSERT INTO task_timeline_events(
      project_id, task_id, sequence, event_id, occurred_at, event_type, event_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(projectId, taskId, sequence, value.eventId, value.occurredAt, value.type, JSON.stringify(value));
}

function planningGrantState(grant, row) {
  const legacy = grant.status === 'LEGACY_UNBOUND'
    || row.status === 'LEGACY_UNBOUND'
    || row.authorization_status === 'LEGACY_UNBOUND';
  if (legacy) return { status: 'LEGACY_UNBOUND', revokedAt: row.revoked_at ?? grant.revokedAt };
  const active = grant.status === 'ACTIVE'
    && grant.revokedAt === null
    && row.status === 'ACTIVE'
    && row.authorization_status === 'ACTIVE'
    && row.revoked_at === null;
  return active
    ? { status: 'ACTIVE', revokedAt: null }
    : { status: 'REVOKED', revokedAt: row.revoked_at ?? grant.revokedAt };
}

function closedPlanningBranchHead(database, row, projectId, expectedRevision = null) {
  invariant(row, 'TASK_NOT_FOUND', 'The selected task branch does not exist.');
  const document = parseJson(row.head_document_json, 'agent_tasks.head_document_json');
  const head = document.revisions?.at(-1);
  invariant(
    document.projectId === projectId
      && head?.number === Number(row.head_revision)
      && head.snapshot?.project?.id === projectId,
    'CORRUPT_PROCESSING_RESULT_ADOPTION',
    'The task branch head does not close its project and revision identity.',
  );
  if (expectedRevision !== null) {
    invariant(
      Number(row.head_revision) === expectedRevision,
      'REVISION_CONFLICT',
      'The task branch changed during processing-result adoption planning.',
      { expectedRevision, actualRevision: Number(row.head_revision) },
    );
  }
  const durableHeadRow = Number(row.head_revision) === Number(row.base_revision)
    ? database.prepare(`
      SELECT revision_json FROM revisions
      WHERE project_id = ? AND revision_number = ?
    `).get(projectId, Number(row.head_revision))
    : database.prepare(`
      SELECT revision_json FROM task_branch_revisions
      WHERE project_id = ? AND task_id = ? AND branch_revision = ?
    `).get(projectId, row.task_id, Number(row.head_revision));
  const durableHead = durableHeadRow
    ? parseJson(durableHeadRow.revision_json, 'durable planning head revision_json')
    : null;
  invariant(
    durableHead && durableRevisionFingerprint(durableHead) === durableRevisionFingerprint(head),
    'CORRUPT_PROCESSING_RESULT_ADOPTION',
    'The task branch head disagrees with its immutable revision ledger.',
  );
  return { document, head };
}

function planningAuthorityEvidence(database, selection) {
  const projectId = requireId(selection?.projectId, 'selection.projectId');
  const taskId = requireId(selection?.taskId, 'selection.taskId');
  const branchId = requireId(selection?.branchId, 'selection.branchId');
  const revision = requireInteger(selection?.revision, 'selection.revision', { min: 1 });
  const row = database.prepare(`
    SELECT * FROM agent_tasks WHERE project_id = ? AND task_id = ?
  `).get(projectId, taskId);
  if (!row) {
    return {
      schemaVersion: 1,
      kind: PROCESSING_ADOPTION_TASK_AUTHORITY_EVIDENCE_KIND,
      projectId,
      branchId,
      branchRevision: revision,
      task: null,
      grant: null,
    };
  }
  const task = parseJson(row.task_json, 'agent_tasks.task_json');
  const { head } = closedPlanningBranchHead(database, row, projectId);
  invariant(
    task.projectId === projectId
      && task.taskId === taskId
      && task.branchId === row.branch_id
      && task.agentId === row.agent_id
      && task.grantId === row.grant_id
      && task.state === row.state
      && task.expiresAt === row.expires_at
      && task.headRevision === Number(row.head_revision)
      && head?.number === Number(row.head_revision),
    'CORRUPT_PROCESSING_RESULT_ADOPTION',
    'The task authority projection disagrees with its durable branch head.',
  );
  const grant = head.snapshot.grants?.find((candidate) => candidate.id === task.grantId) ?? null;
  const grantRow = grant ? database.prepare(`
    SELECT * FROM grants WHERE project_id = ? AND grant_id = ?
  `).get(projectId, grant.id) : null;
  if (grant !== null && grantRow !== null) {
    invariant(
      grant.agentId === grantRow.agent_id
      && grant.taskId === grantRow.task_id
      && grant.branchId === grantRow.branch_id
      && grant.expiresAt === grantRow.expires_at
      && fingerprint(grant.scopes) === fingerprint(parseJson(grantRow.scopes_json, 'grants.scopes_json'))
      && fingerprint(grant.objectScopes) === fingerprint(parseJson(grantRow.object_scopes_json, 'grants.object_scopes_json'))
      && fingerprint(task.budget) === fingerprint(grant.budget)
      && fingerprint(grant.budget) === fingerprint(parseJson(grantRow.budget_json, 'grants.budget_json')),
      'CORRUPT_PROCESSING_RESULT_ADOPTION',
      'The task branch grant disagrees with its durable authority row.',
    );
    const baseUsage = parseJson(grantRow.usage_json, 'grants.usage_json');
    const branchCharge = durableBranchCommandCharge(database, projectId, taskId);
    invariant(
      task.usage.commands === grant.usage.commands
        && grant.usage.commands === baseUsage.commands + branchCharge,
      'CORRUPT_PROCESSING_RESULT_ADOPTION',
      'The task authority usage disagrees with the immutable branch ledger.',
    );
  }
  const grantState = grant !== null && grantRow !== null
    ? planningGrantState(grant, grantRow)
    : null;
  return {
    schemaVersion: 1,
    kind: PROCESSING_ADOPTION_TASK_AUTHORITY_EVIDENCE_KIND,
    projectId,
    branchId: row.branch_id,
    branchRevision: Number(row.head_revision),
    task: {
      taskId: task.taskId,
      projectId: task.projectId,
      branchId: task.branchId,
      agentId: task.agentId,
      grantId: task.grantId,
      state: task.state,
      expiresAt: task.expiresAt,
      capabilities: clone(task.capabilities),
      objectScopes: clone(task.objectScopes),
      maxCommands: task.budget.maxCommands,
      usedCommands: task.usage.commands,
      autoAcceptCommandTypes: clone(task.autoAcceptPolicy.allowedCommandTypes),
    },
    grant: grant === null || grantRow === null ? null : {
      id: grant.id,
      projectId,
      branchId: grant.branchId,
      agentId: grant.agentId,
      taskId: grant.taskId,
      status: grantState.status,
      expiresAt: grant.expiresAt,
      revokedAt: grantState.revokedAt,
      scopes: clone(grant.scopes),
      objectScopes: clone(grant.objectScopes),
      maxCommands: grant.budget.maxCommands,
      usedCommands: grant.usage.commands,
    },
  };
}

function planningMetadata(row, state = row?.state) {
  if (!row) return null;
  return {
    artifactUri: row.uri,
    sha256: row.digest,
    mediaType: row.media_type,
    byteSize: Number(row.byte_size),
    width: Number(row.width),
    height: Number(row.height),
    state,
  };
}

function directStudioErrorCode(value) {
  if (value === null || typeof value !== 'object' || utilTypes.isProxy(value)) return null;
  try {
    if (Object.getPrototypeOf(value) !== StudioError.prototype) return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, 'code');
    return descriptor && Object.hasOwn(descriptor, 'value') && typeof descriptor.value === 'string'
      ? descriptor.value
      : null;
  } catch {
    return null;
  }
}

function planningArtifactStateEvidence({ database, request, role, observedRevision, physical = undefined }) {
  const descriptor = role === 'recipe-input'
    ? request.processingRecipe.inputs[0]
    : request.assetInputSelection.selectedOutput;
  const project = { projectId: request.project.projectId, observedRevision };
  const base = {
    schemaVersion: 1,
    kind: 'studio.processing-adoption-artifact-verification',
    project,
    role,
    sha256: descriptor.sha256,
  };
  if (!hasProjectArtifactReference(database, project.projectId, descriptor.sha256)) {
    return { ...base, status: 'PROJECT_REFERENCE_MISSING', metadata: null, physical: null };
  }
  const metadataRow = database.prepare('SELECT * FROM artifacts WHERE digest = ?').get(descriptor.sha256);
  if (!metadataRow) return { ...base, status: 'METADATA_MISSING', metadata: null, physical: null };
  const gcMarked = Boolean(database.prepare('SELECT 1 FROM cas_gc_marks WHERE digest = ?').get(descriptor.sha256));
  if (metadataRow.state !== 'LIVE' || gcMarked) {
    const state = gcMarked && metadataRow.state === 'LIVE' ? 'QUARANTINED' : metadataRow.state;
    return { ...base, status: 'NOT_LIVE', metadata: planningMetadata(metadataRow, state), physical: null };
  }
  if (physical === undefined) {
    return { ...base, status: 'PENDING_PHYSICAL', metadata: planningMetadata(metadataRow), physical: null };
  }
  return { ...base, status: 'VERIFIED', metadata: planningMetadata(metadataRow), physical };
}

async function planningArtifactEvidence({ database, artifactStore, request, role, observedRevision, signal }) {
  const current = planningArtifactStateEvidence({ database, request, role, observedRevision });
  if (current.status !== 'PENDING_PHYSICAL') return current;
  const descriptor = role === 'recipe-input'
    ? request.processingRecipe.inputs[0]
    : request.assetInputSelection.selectedOutput;
  signal?.throwIfAborted();
  try {
    const physical = await artifactStore.withVerifiedPngEvidence(
      descriptor.sha256,
      async (evidence) => clone(evidence),
    );
    signal?.throwIfAborted();
    return planningArtifactStateEvidence({ database, request, role, observedRevision, physical });
  } catch (error) {
    signal?.throwIfAborted();
    const refreshed = planningArtifactStateEvidence({ database, request, role, observedRevision });
    if (refreshed.status !== 'PENDING_PHYSICAL') return refreshed;
    const code = directStudioErrorCode(error);
    if (code === 'ARTIFACT_MISSING') {
      return { ...refreshed, status: 'CONTENT_MISSING', physical: null };
    }
    if (['ARTIFACT_CORRUPT', 'ARTIFACT_DIMENSIONS_EXCEEDED', 'ARTIFACT_MALFORMED', 'ARTIFACT_MEDIA_MISMATCH'].includes(code)) {
      return { ...refreshed, status: 'CONTENT_CORRUPT', physical: null };
    }
    throw error;
  }
}

async function planningPreflightEvidence({
  database, artifactStore, capabilityProvider, selection, signal,
}) {
  const request = validateProcessingAdoptionPreflightRequest(selection?.request);
  const projectId = requireId(selection?.projectId, 'selection.projectId');
  const branchId = requireId(selection?.branchId, 'selection.branchId');
  const revision = requireInteger(selection?.revision, 'selection.revision', { min: 1 });
  invariant(
    request.project.projectId === projectId && request.project.expectedRevision === revision,
    'PROCESSING_ADOPTION_PREFLIGHT_SCOPE_MISMATCH',
    'The task-branch preflight selection does not match its request.',
  );
  let row = database.prepare(`
    SELECT * FROM agent_tasks
    WHERE project_id = ? AND branch_id = ?
  `).get(projectId, branchId);
  const { head } = closedPlanningBranchHead(database, row, projectId, revision);
  let receipt;
  if (request.processingResult.findings.some(({ severity }) => severity === 'ERROR')) {
    receipt = createProcessingAdoptionPreflightReceipt(request, {
      capabilityCheck: uncheckedProcessingAdoptionCapability(),
      assetStateCheck: uncheckedProcessingAdoptionAssetState(),
      artifactChecks: uncheckedProcessingAdoptionArtifacts(),
    });
  } else {
    signal?.throwIfAborted();
    const manifest = await capabilityProvider.getProjectCapabilityManifest(
      projectCapabilitySelection({ projectId, revision }),
      Object.freeze({ signal }),
    );
    signal?.throwIfAborted();
    const capabilityCheck = evaluateProcessingAdoptionCapability(request, manifest);
    let assetStateCheck = uncheckedProcessingAdoptionAssetState();
    let artifactChecks = uncheckedProcessingAdoptionArtifacts();
    if (capabilityCheck.status === 'SUPPORTED') {
      assetStateCheck = evaluateProcessingAdoptionAssetState(request, assetEvidence({
        projectId,
        baseRevision: Number(row.head_revision),
        payload: { preflightRequest: request },
      }, head.snapshot));
      if (assetStateCheck.status === 'MATCHED') {
        const observations = [];
        for (const role of PROCESSING_ADOPTION_PREFLIGHT_ARTIFACT_ROLES) {
          const evidence = await planningArtifactEvidence({
            database,
            artifactStore,
            request,
            role,
            observedRevision: Number(row.head_revision),
            signal,
          });
          observations.push(evidence);
        }
        const finalObservations = observations.every(({ status }) => status === 'VERIFIED')
          ? observations.map((evidence) => planningArtifactStateEvidence({
            database,
            request,
            role: evidence.role,
            observedRevision: Number(row.head_revision),
            physical: evidence.physical,
          }))
          : observations;
        artifactChecks = finalObservations.map((evidence) => (
          evaluateProcessingAdoptionArtifact(request, evidence.role, evidence)
        ));
      }
    }
    row = database.prepare(`
      SELECT * FROM agent_tasks
      WHERE project_id = ? AND branch_id = ?
    `).get(projectId, branchId);
    closedPlanningBranchHead(database, row, projectId, revision);
    receipt = createProcessingAdoptionPreflightReceipt(request, {
      capabilityCheck,
      assetStateCheck,
      artifactChecks,
    });
  }
  return {
    schemaVersion: 1,
    kind: PROCESSING_ADOPTION_TASK_BRANCH_PREFLIGHT_EVIDENCE_KIND,
    projectId,
    branchId,
    revision,
    receipt,
  };
}

export class SqliteProcessingResultAdoptionStore {
  schemaVersion = PROCESSING_RESULT_ADOPTION_ATOMIC_STORE_SCHEMA_VERSION;

  kind = PROCESSING_RESULT_ADOPTION_ATOMIC_STORE_KIND;

  #workspace;

  #artifactStore;

  #capabilityProvider;

  #clock;

  constructor({ workspace, artifactStore, capabilityProvider, clock = () => new Date().toISOString() } = {}) {
    invariant(workspace instanceof SqliteWorkspace && workspace.isWriter, 'VALIDATION_ERROR', 'A writable SqliteWorkspace is required.');
    invariant(artifactStore instanceof ContentAddressedArtifactStore, 'VALIDATION_ERROR', 'ContentAddressedArtifactStore is required.');
    invariant(typeof capabilityProvider?.getProjectCapabilityManifest === 'function', 'PROJECT_CAPABILITY_PROVIDER_INVALID', 'A project capability provider is required.');
    invariant(typeof clock === 'function', 'VALIDATION_ERROR', 'A trusted clock is required.');
    this.#workspace = workspace;
    this.#artifactStore = artifactStore;
    this.#capabilityProvider = capabilityProvider;
    this.#clock = clock;
  }

  asAtomicStore() {
    const store = this;
    return Object.freeze({
      schemaVersion: PROCESSING_RESULT_ADOPTION_ATOMIC_STORE_SCHEMA_VERSION,
      kind: PROCESSING_RESULT_ADOPTION_ATOMIC_STORE_KIND,
      commitProcessingResultAdoption: (command, trustedContext, options) => (
        store.commitProcessingResultAdoption(command, trustedContext, options)
      ),
    });
  }

  asPlanningPorts() {
    const store = this;
    return Object.freeze({
      taskAuthorityReader: Object.freeze({
        schemaVersion: PROCESSING_ADOPTION_TASK_AUTHORITY_READER_SCHEMA_VERSION,
        kind: PROCESSING_ADOPTION_TASK_AUTHORITY_READER_KIND,
        readTaskAuthority: (selection, { signal } = {}) => {
          signal?.throwIfAborted();
          return planningAuthorityEvidence(store.#workspace.database, selection);
        },
      }),
      taskBranchPreflightReader: Object.freeze({
        schemaVersion: PROCESSING_ADOPTION_TASK_BRANCH_PREFLIGHT_READER_SCHEMA_VERSION,
        kind: PROCESSING_ADOPTION_TASK_BRANCH_PREFLIGHT_READER_KIND,
        preflightTaskBranch: (selection, { signal } = {}) => planningPreflightEvidence({
          database: store.#workspace.database,
          artifactStore: store.#artifactStore,
          capabilityProvider: store.#capabilityProvider,
          selection,
          signal,
        }),
      }),
    });
  }

  async commitProcessingResultAdoption(commandValue, trustedContextValue, { signal } = {}) {
    signal?.throwIfAborted();
    const command = validateProcessingResultAdoptionCommand(commandValue);
    const context = exactContext(trustedContextValue);
    const binding = authorityBinding(command, context);
    const semantic = { taskId: context.taskId, value: processingResultAdoptionSemanticSha256(command, binding) };
    const prior = replay(this.#workspace.database, command, semantic);
    if (prior) return clone(prior);

    const precheckNow = requireIsoDate(this.#clock(), 'clock');
    readAuthority(this.#workspace.database, command, context, precheckNow);
    signal?.throwIfAborted();
    const request = command.payload.preflightRequest;
    if (request.processingResult.findings.some((finding) => finding.severity === 'ERROR')) {
      throw new StudioError('PROCESSING_RESULT_ADOPTION_REVALIDATION_BLOCKED', 'A ProcessingResult ERROR blocks semantic adoption.');
    }
    let manifest;
    try {
      manifest = validateProjectCapabilityManifest(await this.#capabilityProvider.getProjectCapabilityManifest(
        projectCapabilitySelection({ projectId: command.projectId, revision: command.baseRevision }),
        Object.freeze({ signal }),
      ));
    } catch {
      signal?.throwIfAborted();
      throw new StudioError('PROCESSING_ADOPTION_ATOMIC_STORE_DEPENDENCY_FAILED', 'The trusted capability dependency failed.', { dependency: 'capabilityProvider' });
    }
    signal?.throwIfAborted();
    assertCapabilitySupported(evaluateProcessingAdoptionCapability(request, manifest));

    const inputDigest = artifactDescriptor(command, 'recipe-input').sha256;
    const outputDigest = artifactDescriptor(command, 'selected-output').sha256;
    return withPngEvidence(this.#artifactStore, inputDigest, async (inputPhysical) => {
      const commitWithPhysical = async (outputPhysical) => {
        signal?.throwIfAborted();
        const now = requireIsoDate(this.#clock(), 'clock');
        const result = this.#workspace.transaction((database) => {
          const concurrentReplay = replay(database, command, semantic);
          if (concurrentReplay) return concurrentReplay;
          const authority = readAuthority(database, command, context, now);
          const capabilityCheck = evaluateProcessingAdoptionCapability(request, manifest);
          assertCapabilitySupported(capabilityCheck);
          const stateCheck = evaluateProcessingAdoptionAssetState(request, assetEvidence(command, authority.head.snapshot));
          assertAssetMatched(stateCheck);
          const physicalByRole = new Map([
            ['recipe-input', inputPhysical],
            ['selected-output', outputPhysical],
          ]);
          const artifactValues = PROCESSING_ADOPTION_PREFLIGHT_ARTIFACT_ROLES.map((role) => (
            artifactEvidence(database, command, role, physicalByRole.get(role), now)
          ));
          const receipt = createProcessingAdoptionPreflightReceipt(request, {
            capabilityCheck,
            assetStateCheck: stateCheck,
            artifactChecks: artifactValues.map(({ check }) => check),
          });
          const plan = createProcessingResultAdoptionPlan(command, binding, receipt);
          const nextRevision = command.baseRevision + 1;
          const aggregate = createProcessingResultAdoptionAggregate(command, binding, receipt, {
            branchRevision: nextRevision,
            committedAt: now,
            committedBy: context.actor.id,
            currentAsset: currentAssetForAggregate(command, authority.head.snapshot),
          });
          const asset = aggregate.asset;
          const commitResult = aggregate.commitResult;
          invariant(
            aggregate.commandBudgetCharge === 1
              && commitResult.commandBudgetCharge === 1
              && aggregate.semanticFingerprint === semantic.value
              && aggregate.planFingerprint === plan.planFingerprint,
            'CORRUPT_PROCESSING_RESULT_ADOPTION',
            'The rederived adoption Aggregate does not close over its command, plan, or one-command charge.',
          );
          const previousUsage = authority.task.usage.commands;
          const snapshot = clone(authority.head.snapshot);
          snapshot.project.updatedAt = now;
          const heads = processingHeads(snapshot);
          const headIndex = heads.findIndex((candidate) => candidate.assetId === asset.assetId);
          if (headIndex >= 0) heads[headIndex] = clone(asset);
          else heads.push(clone(asset));
          heads.sort((left, right) => left.assetId.localeCompare(right.assetId));
          snapshot.processingResultAdoptionHeads = { schemaVersion: 1, assets: heads };
          const grantIndex = snapshot.grants.findIndex((candidate) => candidate.id === context.grantId);
          snapshot.grants[grantIndex] = {
            ...snapshot.grants[grantIndex],
            usage: {
              ...snapshot.grants[grantIndex].usage,
              commands: snapshot.grants[grantIndex].usage.commands + 1,
            },
          };
          invariant(
            snapshot.grants[grantIndex].usage.commands === previousUsage + 1,
            'CORRUPT_PROCESSING_RESULT_ADOPTION',
            'Processing-result adoption must charge the branch grant exactly once.',
          );
          const event = {
            id: `activity:${command.commandId}`,
            projectId: command.projectId,
            revision: nextRevision,
            occurredAt: now,
            actor: clone(context.actor),
            taskId: context.taskId,
            branchId: context.branchId,
            commandId: command.commandId,
            commandType: command.type,
            status: 'committed',
            summary: `Processing result adopted as DRAFT Asset ${asset.assetId} version ${asset.assetVersion}.`,
            changes: [{ entityType: 'asset_v2', entityId: asset.assetId, operation: request.target.operation === 'create' ? 'created' : 'versioned' }],
          };
          const revision = {
            id: `${context.branchId}:revision:${nextRevision}`,
            number: nextRevision,
            parentRevision: command.baseRevision,
            committedAt: now,
            command: {
              schemaVersion: command.schemaVersion,
              commandId: command.commandId,
              idempotencyKey: command.idempotencyKey,
              type: command.type,
              actor: clone(context.actor),
              taskId: context.taskId,
              grantId: context.grantId,
              branchId: context.branchId,
              payload: clone(command.payload),
              fingerprint: processingResultAdoptionCommandSha256(command),
            },
            snapshot,
            result: clone(commitResult),
            event,
          };
          database.prepare(`
            INSERT INTO task_branch_revisions(
              project_id, task_id, branch_id, branch_revision, revision_id, command_id,
              idempotency_key, command_type, committed_at, revision_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(command.projectId, context.taskId, context.branchId, nextRevision, revision.id,
            command.commandId, command.idempotencyKey, command.type, now, JSON.stringify(revision));
          this.#workspace.fault('after_processing_result_adoption_branch_revision');

          const references = artifactValues.map(({ reference }) => ({
            ...reference,
            evidenceFingerprint: fingerprint(reference),
          }));
          database.prepare(`
            INSERT INTO task_branch_processing_result_adoptions(
              project_id, task_id, branch_revision, branch_id, command_id, idempotency_key,
              operation, asset_id, asset_kind, asset_version, metadata_version,
              command_fingerprint, semantic_fingerprint, authority_binding_fingerprint,
              preflight_receipt_fingerprint, processing_binding_fingerprint, plan_fingerprint,
              metadata_fingerprint, findings_fingerprint, result_fingerprint,
              record_json, result_json, committed_at, committed_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            command.projectId, context.taskId, nextRevision, context.branchId,
            command.commandId, command.idempotencyKey, request.target.operation,
            asset.assetId, asset.kind, asset.assetVersion, asset.metadataVersion,
            aggregate.commandFingerprint, aggregate.semanticFingerprint, plan.authority.bindingFingerprint,
            aggregate.freshPreflightReceiptFingerprint, asset.processingBinding.fingerprint,
            plan.planFingerprint, asset.metadataFingerprint, asset.findingsFingerprint,
            processingResultAdoptionCommitResultSha256(commitResult), JSON.stringify(aggregate), JSON.stringify(commitResult), now,
            context.actor.id,
          );
          this.#workspace.fault('after_processing_result_adoption_aggregate');
          const insertReference = database.prepare(`
            INSERT INTO task_branch_processing_result_artifact_references(
              project_id, task_id, branch_revision, role, digest, artifact_uri, media_type,
              byte_size, width, height, verified_at, evidence_fingerprint, evidence_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const reference of references) {
            insertReference.run(
              command.projectId, context.taskId, nextRevision, reference.role,
              reference.descriptor.sha256, reference.descriptor.artifactUri,
              reference.descriptor.mediaType, reference.descriptor.byteSize,
              reference.descriptor.width, reference.descriptor.height,
              reference.verifiedAt, reference.evidenceFingerprint, JSON.stringify(reference),
            );
            this.#workspace.fault(`after_processing_result_adoption_reference_${reference.role}`);
          }
          invariant(references.length === 2, 'CORRUPT_PROCESSING_RESULT_ADOPTION', 'An adoption must persist exactly two artifact reference roles.');

          const nextDocument = { ...authority.document, revisions: [...authority.document.revisions, clone(revision)] };
          const nextTask = {
            ...authority.task,
            usage: {
              ...authority.task.usage,
              commands: authority.task.usage.commands + 1,
            },
            headRevision: nextRevision,
            updatedAt: now,
          };
          invariant(
            nextTask.usage.commands === previousUsage + 1
              && nextTask.usage.commands === snapshot.grants[grantIndex].usage.commands,
            'CORRUPT_PROCESSING_RESULT_ADOPTION',
            'Task and branch-grant command usage must advance together by exactly one.',
          );
          const updated = database.prepare(`
            UPDATE agent_tasks
            SET head_revision = ?, updated_at = ?, task_json = ?, head_document_json = ?
            WHERE project_id = ? AND task_id = ? AND head_revision = ? AND state = 'ACTIVE'
          `).run(nextRevision, now, JSON.stringify(nextTask), JSON.stringify(nextDocument),
            command.projectId, context.taskId, command.baseRevision);
          invariant(Number(updated.changes) === 1, 'REVISION_CONFLICT', 'Task branch compare-and-swap failed.');
          this.#workspace.fault('after_processing_result_adoption_head_and_usage');
          appendTimeline(database, command.projectId, context.taskId, {
            eventId: `task-event:${context.taskId}:revision:${nextRevision}`,
            occurredAt: now,
            type: 'BRANCH_COMMAND_COMMITTED',
            actorId: context.actor.id,
            state: 'ACTIVE',
            branchRevision: nextRevision,
            details: {
              commandId: command.commandId,
              commandType: command.type,
              summary: event.summary,
              changes: clone(event.changes),
            },
          });
          this.#workspace.fault('after_processing_result_adoption_activity');
          this.#workspace.fault('before_processing_result_adoption_commit');
          return commitResult;
        });
        this.#workspace.fault('after_processing_result_adoption_commit');
        return clone(result);
      };
      if (inputDigest === outputDigest) return commitWithPhysical(inputPhysical);
      return withPngEvidence(this.#artifactStore, outputDigest, commitWithPhysical);
    });
  }
}
