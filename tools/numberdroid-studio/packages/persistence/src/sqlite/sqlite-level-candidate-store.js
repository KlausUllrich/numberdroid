import { createHash } from 'node:crypto';
import {
  LEVEL_CANDIDATE_CREATE_COMMAND_TYPE,
  LEVEL_CANDIDATE_CREATE_REQUIRED_SCOPE,
  transitionAgentTask,
  validateTaskCandidateSubmission,
} from '../../../domain/src/index.js';
import { StudioError, invariant } from '../../../domain/src/errors.js';
import { requireIsoDate } from '../../../domain/src/validation.js';
import { fingerprint } from '../../../application/src/value-utils.js';
import { SqliteWorkspace } from './sqlite-workspace.js';

export const SQLITE_LEVEL_CANDIDATE_STORE_SCHEMA_VERSION = 1;
export const SQLITE_LEVEL_CANDIDATE_STORE_KIND = 'studio.sqlite-level-candidate-store';
export const LEVEL_CANDIDATE_REVIEW_KIND = 'studio.level-candidate-review';
export const LEVEL_CANDIDATE_RESULT_KIND = 'studio.level-candidate-submit-result';

const SOURCE_KIND = 'numberdroid.a4c-level-candidate-source';

function clone(value) { return structuredClone(value); }
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }

function parseJson(value, label) {
  try { return JSON.parse(value); } catch (error) {
    throw new StudioError('CORRUPT_LEVEL_CANDIDATE', `Invalid JSON stored in ${label}.`, { cause: error.message });
  }
}

function exactHash(value, label) {
  invariant(typeof value === 'string' && /^[a-f0-9]{64}$/.test(value),
    'LEVEL_CANDIDATE_STORE_INVALID', `${label} must be a lowercase SHA-256 digest.`);
  return value;
}

function exactObject(value, fields, label) {
  invariant(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === fields.length
    && Object.keys(value).every((field) => fields.includes(field)),
  'LEVEL_CANDIDATE_SOURCE_INVALID', `${label} does not have the exact approved shape.`);
  return value;
}

function hasProjectScope(scopes, projectId) {
  return Array.isArray(scopes) && scopes.some(({ kind, id }) => kind === 'project' && id === projectId);
}

function taskRow(database, projectId, taskId) {
  return database.prepare('SELECT * FROM agent_tasks WHERE project_id = ? AND task_id = ?').get(projectId, taskId);
}

function nextTimelineSequence(database, projectId, taskId) {
  return Number(database.prepare(`
    SELECT COALESCE(MAX(sequence), 0) AS sequence
    FROM task_timeline_events WHERE project_id = ? AND task_id = ?
  `).get(projectId, taskId).sequence) + 1;
}

function appendTimeline(database, projectId, taskId, event) {
  const sequence = nextTimelineSequence(database, projectId, taskId);
  const value = { schemaVersion: 1, sequence, projectId, taskId, ...clone(event) };
  database.prepare(`
    INSERT INTO task_timeline_events(
      project_id, task_id, sequence, event_id, occurred_at, event_type, event_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(projectId, taskId, sequence, value.eventId, value.occurredAt, value.type, JSON.stringify(value));
  return value;
}

function withFingerprint(value) {
  return Object.freeze({ ...clone(value), fingerprint: fingerprint(value) });
}

function fingerprintCore(value) {
  const core = clone(value);
  delete core.fingerprint;
  return fingerprint(core);
}

function taskBoundKeyHash(identity) {
  return sha256(`${identity.taskId}\0${identity.idempotencyKeyHash}`);
}

function assertIdentityIds(identity, reviewId = null) {
  exactHash(identity.idempotencyKeyHash, 'identity.idempotencyKeyHash');
  exactHash(identity.requestFingerprint, 'identity.requestFingerprint');
  const keyHash = taskBoundKeyHash(identity);
  invariant(identity.submissionId === `candidate:${keyHash}`,
    'LEVEL_CANDIDATE_SUBMISSION_ID_CONFLICT', 'The Candidate submission ID is not bound to its task and idempotency identity.');
  if (reviewId !== null) {
    invariant(reviewId === `review:${keyHash}`,
      'LEVEL_CANDIDATE_REVIEW_ID_CONFLICT', 'The Candidate review ID is not bound to its task and idempotency identity.');
  }
  return keyHash;
}

function validateSource(rawSource, configuredBinding) {
  const source = exactObject(clone(rawSource), [
    'schemaVersion', 'kind', 'sourceId', 'sourceVersion', 'logicalPath',
    'mediaType', 'byteSize', 'sha256', 'content',
  ], 'source');
  invariant(source.schemaVersion === 1
    && source.kind === SOURCE_KIND
    && typeof source.sourceId === 'string' && source.sourceId.length > 0
    && Number.isSafeInteger(source.sourceVersion) && source.sourceVersion >= 1
    && typeof source.logicalPath === 'string' && source.logicalPath.length > 0
    && source.mediaType === 'application/json'
    && typeof source.content === 'string'
    && source.byteSize === Buffer.byteLength(source.content)
    && source.sha256 === sha256(source.content),
  'LEVEL_CANDIDATE_SOURCE_INVALID', 'The Level Candidate source bytes and descriptor do not close.');
  const composer = configuredBinding?.composer;
  invariant(source.sourceId === composer?.sourceId
    && source.sourceVersion === composer?.sourceVersion
    && source.sha256 === composer?.sourceSha256
    && Array.isArray(composer?.outputPaths)
    && composer.outputPaths.includes(source.logicalPath),
  'LEVEL_CANDIDATE_CONFIG_MISMATCH', 'The Level Candidate source does not match the configured immutable source binding.');
  return Object.freeze(source);
}

function branchCommandCharge(revision) {
  const command = revision?.command;
  invariant(command && typeof command.type === 'string', 'CORRUPT_LEVEL_CANDIDATE', 'A branch revision has no command.');
  if (!['asset.proposal.submit', 'room.placement.proposal.submit'].includes(command.type)) return 1;
  invariant(Array.isArray(command.payload?.items)
    && command.payload.items.length >= 1 && command.payload.items.length <= 64,
  'CORRUPT_LEVEL_CANDIDATE', 'A multi-item branch command has no rederivable charge.');
  return command.payload.items.length;
}

function durableBranchCharge(database, projectId, taskId) {
  const rows = database.prepare(`
    SELECT revision_json FROM task_branch_revisions
    WHERE project_id = ? AND task_id = ? ORDER BY branch_revision
  `).all(projectId, taskId);
  let total = 0;
  for (const row of rows) {
    const charge = branchCommandCharge(parseJson(row.revision_json, 'task_branch_revisions.revision_json'));
    invariant(total <= Number.MAX_SAFE_INTEGER - charge, 'CORRUPT_LEVEL_CANDIDATE', 'Branch command charge overflowed.');
    total += charge;
  }
  return total;
}

function closedHead(database, row) {
  const task = parseJson(row.task_json, 'agent_tasks.task_json');
  const document = parseJson(row.head_document_json, 'agent_tasks.head_document_json');
  const head = document.revisions?.at(-1);
  invariant(task.projectId === row.project_id
    && task.taskId === row.task_id
    && task.branchId === row.branch_id
    && task.agentId === row.agent_id
    && task.grantId === row.grant_id
    && task.baseRevision === Number(row.base_revision)
    && task.headRevision === Number(row.head_revision)
    && task.state === row.state
    && task.expiresAt === row.expires_at
    && document.projectId === row.project_id
    && head?.number === Number(row.head_revision)
    && head?.snapshot?.project?.id === row.project_id,
  'CORRUPT_LEVEL_CANDIDATE', 'Task, task row, and branch head document disagree.');
  if (Number(row.head_revision) > Number(row.base_revision)) {
    const durable = database.prepare(`
      SELECT revision_json FROM task_branch_revisions
      WHERE project_id = ? AND task_id = ? AND branch_revision = ?
    `).get(row.project_id, row.task_id, Number(row.head_revision));
    invariant(durable, 'CORRUPT_LEVEL_CANDIDATE', 'The current task head is absent from the immutable branch ledger.');
    invariant(fingerprint(parseJson(durable.revision_json, 'task_branch_revisions.revision_json')) === fingerprint(head),
      'CORRUPT_LEVEL_CANDIDATE', 'The mutable task head differs from its immutable branch revision.');
  }
  return { task, document, head };
}

function authorityBinding({ identity, task, grant, baseRevision, branchHeadRevision }) {
  return withFingerprint({
    schemaVersion: 1,
    kind: 'studio.level-candidate-authority-binding',
    projectId: identity.projectId,
    taskId: identity.taskId,
    actorId: identity.actorId,
    grantId: identity.grantId,
    branchId: identity.branchId,
    baseRevision,
    branchHeadRevision,
    scope: LEVEL_CANDIDATE_CREATE_REQUIRED_SCOPE,
    taskCapabilities: clone(task.capabilities),
    taskObjectScopes: clone(task.objectScopes),
    taskBudget: clone(task.budget),
    taskUsage: clone(task.usage),
    grantScopes: clone(grant.scopes),
    grantObjectScopes: clone(grant.objectScopes),
    grantBudget: clone(grant.budget),
    grantUsage: clone(grant.usage),
  });
}

function readFreshAuthority(database, identity, {
  expectedBaseRevision, expectedBranchHeadRevision, now, requireCommandCapacity = false,
}) {
  const timestamp = requireIsoDate(now, 'now');
  const row = taskRow(database, identity.projectId, identity.taskId);
  invariant(row, 'TASK_NOT_FOUND', 'The bound Level Candidate task does not exist.');
  const { task, document, head } = closedHead(database, row);
  invariant(row.state === 'ACTIVE', row.state === 'PAUSED' ? 'TASK_PAUSED' : 'TASK_NOT_EXECUTABLE',
    'The bound Level Candidate task is not executable.', { state: row.state });
  invariant(Date.parse(row.expires_at) > Date.parse(timestamp), 'TASK_EXPIRED', 'The bound Level Candidate task has expired.');
  invariant(row.branch_id !== 'branch.main', 'LEVEL_CANDIDATE_MAIN_FORBIDDEN', 'Level Candidate authority may not target main.');
  invariant(row.project_id === identity.projectId
    && row.task_id === identity.taskId
    && row.branch_id === identity.branchId
    && row.agent_id === identity.actorId
    && row.grant_id === identity.grantId,
  'LEVEL_CANDIDATE_CONTEXT_MISMATCH', 'Trusted actor/task/grant/branch coordinates do not match the task.');
  invariant(Number(row.base_revision) === expectedBaseRevision
    && Number(row.head_revision) === expectedBranchHeadRevision
    && expectedBranchHeadRevision >= expectedBaseRevision,
  'REVISION_CONFLICT', 'The Level Candidate branch coordinates are stale.', {
    expectedBaseRevision, expectedBranchHeadRevision,
    actualBaseRevision: Number(row.base_revision), actualBranchHeadRevision: Number(row.head_revision),
  });
  invariant(task.capabilities.includes(LEVEL_CANDIDATE_CREATE_REQUIRED_SCOPE),
    'TASK_CAPABILITY_MISSING', 'The task lacks private Level Candidate authority.');
  invariant(!task.autoAcceptPolicy?.allowedCommandTypes?.includes(LEVEL_CANDIDATE_CREATE_COMMAND_TYPE),
    'AUTO_ACCEPT_FORBIDDEN', 'Level Candidate creation cannot be auto-accepted.');
  invariant(hasProjectScope(task.objectScopes, identity.projectId), 'OBJECT_SCOPE_DENIED', 'The task does not cover its project.');

  const grant = head.snapshot?.grants?.find(({ id }) => id === identity.grantId);
  const grantRow = database.prepare('SELECT * FROM grants WHERE project_id = ? AND grant_id = ?')
    .get(identity.projectId, identity.grantId);
  invariant(grant && grantRow, 'GRANT_NOT_FOUND', 'The bound Level Candidate grant does not exist.');
  invariant(grant.status === 'ACTIVE' && grant.revokedAt === null
    && grantRow.status === 'ACTIVE' && grantRow.authorization_status === 'ACTIVE' && grantRow.revoked_at === null,
  'GRANT_REVOKED', 'The bound Level Candidate grant is not active.');
  invariant(grant.agentId === identity.actorId && grantRow.agent_id === identity.actorId,
    'GRANT_ACTOR_MISMATCH', 'The Level Candidate grant belongs to another actor.');
  invariant(grant.taskId === identity.taskId && grantRow.task_id === identity.taskId,
    'GRANT_TASK_MISMATCH', 'The Level Candidate grant belongs to another task.');
  invariant(grant.branchId === identity.branchId && grantRow.branch_id === identity.branchId,
    'GRANT_BRANCH_MISMATCH', 'The Level Candidate grant belongs to another branch.');
  const rowScopes = parseJson(grantRow.scopes_json, 'grants.scopes_json');
  const rowObjectScopes = parseJson(grantRow.object_scopes_json, 'grants.object_scopes_json');
  const rowBudget = parseJson(grantRow.budget_json, 'grants.budget_json');
  const rowUsage = parseJson(grantRow.usage_json, 'grants.usage_json');
  invariant(fingerprint(task.capabilities) === fingerprint(grant.scopes)
    && fingerprint(grant.scopes) === fingerprint(rowScopes)
    && rowScopes.includes(LEVEL_CANDIDATE_CREATE_REQUIRED_SCOPE),
  'GRANT_SCOPE_MISSING', 'Task and grant scopes do not preserve private Level Candidate authority exactly.');
  invariant(fingerprint(task.objectScopes) === fingerprint(grant.objectScopes)
    && fingerprint(grant.objectScopes) === fingerprint(rowObjectScopes)
    && hasProjectScope(rowObjectScopes, identity.projectId),
  'OBJECT_SCOPE_DENIED', 'Task and grant object scopes do not preserve the project boundary exactly.');
  invariant(fingerprint(task.budget) === fingerprint(grant.budget)
    && fingerprint(grant.budget) === fingerprint(rowBudget),
  'CORRUPT_LEVEL_CANDIDATE', 'Task and grant budgets disagree.');
  const branchCharge = durableBranchCharge(database, identity.projectId, identity.taskId);
  const expectedUsage = { ...rowUsage, commands: rowUsage.commands + branchCharge };
  invariant(Number.isSafeInteger(rowUsage.commands)
    && fingerprint(task.usage) === fingerprint(grant.usage)
    && fingerprint(grant.usage) === fingerprint(expectedUsage),
  'CORRUPT_LEVEL_CANDIDATE', 'Task and branch-grant usage do not match the authority row plus rederived branch charge.');
  if (requireCommandCapacity) {
    invariant(task.usage.commands < task.budget.maxCommands,
      'BUDGET_EXCEEDED', 'The Level Candidate task command budget is exhausted.');
  }
  invariant(grant.expiresAt === grantRow.expires_at, 'CORRUPT_LEVEL_CANDIDATE', 'Branch and authority-row grant expiry disagree.');
  invariant(grant.expiresAt === null || Date.parse(requireIsoDate(grant.expiresAt, 'grant.expiresAt')) > Date.parse(timestamp),
    'GRANT_EXPIRED', 'The bound Level Candidate grant has expired.');
  return {
    row, task, document, head, grant,
    baseRevision: Number(row.base_revision),
    branchHeadRevision: Number(row.head_revision),
    authorityBinding: authorityBinding({
      identity, task, grant,
      baseRevision: Number(row.base_revision), branchHeadRevision: Number(row.head_revision),
    }),
  };
}

function sourceCommand(identity, source) {
  const keyHash = assertIdentityIds(identity);
  const core = {
    schemaVersion: 1,
    commandId: `level-candidate-source:${keyHash}`,
    idempotencyKey: `level-candidate-source:${identity.idempotencyKeyHash}`,
    type: LEVEL_CANDIDATE_CREATE_COMMAND_TYPE,
    actor: { id: identity.actorId, kind: 'agent' },
    taskId: identity.taskId,
    grantId: identity.grantId,
    branchId: identity.branchId,
    payload: {
      schemaVersion: 1,
      kind: 'studio.level-candidate-source-command',
      submissionId: identity.submissionId,
      requestFingerprint: identity.requestFingerprint,
      source: clone(source),
    },
  };
  return { ...core, fingerprint: fingerprint(core) };
}

function sourceResult(identity, source, { parentRevision, branchRevision }) {
  return withFingerprint({
    schemaVersion: 1,
    kind: 'studio.level-candidate-source-commit-result',
    projectId: identity.projectId,
    taskId: identity.taskId,
    branchId: identity.branchId,
    submissionId: identity.submissionId,
    sourceParentRevision: parentRevision,
    branchHeadRevision: branchRevision,
    sourceFingerprint: fingerprint(source),
    sourceSha256: source.sha256,
    commandBudgetCharge: 1,
  });
}

function sourceRevisionRows(database, identity) {
  return database.prepare(`
    SELECT * FROM task_branch_revisions
    WHERE project_id = ? AND task_id = ? AND command_type = ? ORDER BY branch_revision
  `).all(identity.projectId, identity.taskId, LEVEL_CANDIDATE_CREATE_COMMAND_TYPE);
}

function replaySource(database, identity, source, configuredBinding) {
  const rows = sourceRevisionRows(database, identity);
  if (rows.length === 0) return null;
  invariant(rows.length === 1, 'CORRUPT_LEVEL_CANDIDATE', 'A task has more than one immutable Level Candidate source revision.');
  const row = rows[0];
  const revision = parseJson(row.revision_json, 'task_branch_revisions.revision_json');
  const expectedCommand = sourceCommand(identity, source);
  const expectedResult = sourceResult(identity, source, {
    parentRevision: revision.parentRevision, branchRevision: revision.number,
  });
  invariant(row.project_id === identity.projectId
    && row.task_id === identity.taskId && row.branch_id === identity.branchId
    && row.command_id === expectedCommand.commandId && row.idempotency_key === expectedCommand.idempotencyKey
    && row.command_type === LEVEL_CANDIDATE_CREATE_COMMAND_TYPE
    && Number(row.branch_revision) === revision.number && revision.parentRevision + 1 === revision.number
    && fingerprint(revision.command) === fingerprint(expectedCommand)
    && fingerprint(revision.result) === fingerprint(expectedResult)
    && revision.snapshot?.project?.id === identity.projectId
    && revision.event?.projectId === identity.projectId && revision.event?.taskId === identity.taskId
    && revision.event?.branchId === identity.branchId && revision.event?.commandId === expectedCommand.commandId
    && revision.event?.commandType === LEVEL_CANDIDATE_CREATE_COMMAND_TYPE && revision.event?.status === 'committed'
    && fingerprint(revision.command.payload.source) === fingerprint(validateSource(source, configuredBinding)),
  'IDEMPOTENCY_CONFLICT', 'The immutable Level Candidate source revision belongs to different source or request semantics.');
  const task = taskRow(database, identity.projectId, identity.taskId);
  invariant(task && Number(task.head_revision) === revision.number,
    'REVISION_CONFLICT', 'The Level Candidate source is no longer the exact task head.');
  return {
    schemaVersion: 1,
    baseRevision: Number(task.base_revision),
    sourceParentRevision: revision.parentRevision,
    branchHeadRevision: revision.number,
    sourceFingerprint: fingerprint(source),
    replayed: true,
  };
}

function candidateRows(database, identity) {
  const bySubmission = database.prepare(`
    SELECT * FROM task_level_candidate_submissions WHERE project_id = ? AND submission_id = ?
  `).get(identity.projectId, identity.submissionId);
  const byKey = database.prepare(`
    SELECT * FROM task_level_candidate_submissions
    WHERE project_id = ? AND task_id = ? AND idempotency_key_hash = ?
  `).get(identity.projectId, identity.taskId, identity.idempotencyKeyHash);
  invariant(!bySubmission || !byKey
    || (bySubmission.task_id === byKey.task_id && bySubmission.submission_id === byKey.submission_id),
  'CORRUPT_LEVEL_CANDIDATE', 'Submission and idempotency identities resolve to different Candidate rows.');
  return bySubmission ?? byKey ?? null;
}

function candidateResult(identity, authority, submission, reviewId) {
  return withFingerprint({
    schemaVersion: 1,
    kind: LEVEL_CANDIDATE_RESULT_KIND,
    status: 'WAITING_FOR_HUMAN_REVIEW',
    message: 'Waiting for your review',
    projectId: identity.projectId,
    taskId: identity.taskId,
    branchId: identity.branchId,
    baseRevision: authority.baseRevision,
    branchHeadRevision: authority.branchHeadRevision,
    submissionId: submission.submissionId,
    submissionFingerprint: submission.fingerprint,
    candidateFingerprint: submission.candidate.candidateFingerprint,
    reviewId,
    authority: clone(submission.authority),
  });
}

function candidateReview(identity, authority, submission, reviewId, mainRevision, timestamp) {
  return {
    schemaVersion: 1,
    kind: LEVEL_CANDIDATE_REVIEW_KIND,
    reviewId,
    reviewVersion: 1,
    projectId: identity.projectId,
    taskId: identity.taskId,
    branchId: identity.branchId,
    baseRevision: authority.baseRevision,
    branchHeadRevision: authority.branchHeadRevision,
    comparedMainRevision: mainRevision,
    state: 'OPEN',
    items: [{
      changeId: `candidate-change:${submission.submissionId}`,
      ordinal: 1,
      branchRevision: authority.branchHeadRevision,
      commandType: LEVEL_CANDIDATE_CREATE_COMMAND_TYPE,
      summary: submission.diff.changes[0].summary,
      changes: clone(submission.diff.changes),
      disposition: 'PENDING',
      reason: null,
      decidedAt: null,
      decidedBy: null,
    }],
    conflicts: [],
    candidateSubmissionId: submission.submissionId,
    candidateEvidence: {
      submissionFingerprint: submission.fingerprint,
      candidateFingerprint: submission.candidate.candidateFingerprint,
      previewFingerprint: submission.preview.fingerprint,
      diffFingerprint: submission.diff.fingerprint,
      findingCount: submission.candidate.candidateManifest.findings.length,
      outputCount: submission.candidate.outputs.length,
    },
    createdAt: timestamp,
    createdBy: identity.actorId,
  };
}

function candidateTimeline(identity, authority, submission, reviewId, timestamp) {
  return {
    eventId: `task-event:${identity.taskId}:candidate:${submission.submissionId}`,
    occurredAt: timestamp,
    type: 'REVIEW_SUBMITTED',
    actorId: identity.actorId,
    state: 'IN_REVIEW',
    branchRevision: authority.branchHeadRevision,
    details: {
      reviewId,
      submissionId: submission.submissionId,
      itemCount: 1,
      conflictCount: 0,
      candidateFingerprint: submission.candidate.candidateFingerprint,
    },
  };
}

function assertConfiguredClosure(submission, configuredBinding) {
  const composer = configuredBinding.composer;
  invariant(submission.projectionFingerprint === composer.projectionFingerprint
    && submission.candidate.candidateManifest.snapshot.snapshotId === composer.projectionFingerprint
    && submission.candidate.candidateManifest.capabilityProfile.profileId === composer.profileId
    && submission.candidate.candidateManifest.capabilityProfile.profileVersion === composer.profileVersion
    && submission.candidate.candidateManifest.capabilityProfile.fingerprint === configuredBinding.capabilityManifestFingerprint
    && submission.candidate.candidateManifest.adapter.id === composer.adapterId
    && submission.candidate.candidateManifest.adapter.version === composer.adapterVersion
    && submission.candidate.candidateManifest.compiler.version === composer.compilerVersion
    && submission.candidate.candidateManifest.compiler.evidenceHash === composer.planSha256,
  'LEVEL_CANDIDATE_CONFIG_MISMATCH', 'The Candidate does not match the configured source/profile/compiler binding.');
  const byPath = new Map(submission.candidate.outputs.map((output) => [output.logicalPath, output]));
  invariant(composer.outputPaths.length === submission.candidate.outputs.length
    && composer.outputPaths.every((path) => byPath.has(path))
    && submission.candidate.outputs.some(({ role, sha256: digest }) => role === 'level-source' && digest === composer.sourceSha256)
    && submission.candidate.outputs.some(({ role, sha256: digest }) => role === 'compiled-plan' && digest === composer.planSha256),
  'LEVEL_CANDIDATE_OUTPUT_MISMATCH', 'The Candidate output bytes do not preserve the configured source and plan.');
  invariant(submission.compilerPins.some(({ id, version, evidenceHash }) => id === 'numberdroid.level-compiler'
    && version === composer.compilerVersion && evidenceHash === composer.planSha256),
  'LEVEL_CANDIDATE_COMPILER_MISMATCH', 'The Candidate compiler pin is not the configured compiler closure.');
  invariant(submission.engineBridgeReceipt.bridge.id === configuredBinding.engineBridge.id
    && submission.engineBridgeReceipt.bridge.version === configuredBinding.engineBridge.version,
  'LEVEL_CANDIDATE_BRIDGE_MISMATCH', 'The Candidate receipt belongs to another configured EngineBridge.');
}

function assertSourceSubmissionClosure(database, identity, submission, configuredBinding) {
  const rows = sourceRevisionRows(database, identity);
  invariant(rows.length === 1 && Number(rows[0].branch_revision) === submission.branchHeadRevision,
    'LEVEL_CANDIDATE_SOURCE_MISMATCH', 'The Candidate does not target its one immutable source revision.');
  const revision = parseJson(rows[0].revision_json, 'task_branch_revisions.revision_json');
  const source = validateSource(revision.command?.payload?.source, configuredBinding);
  replaySource(database, identity, source, configuredBinding);
  const output = submission.candidate.outputs.find(({ role }) => role === 'level-source');
  invariant(output
    && output.logicalPath === source.logicalPath && output.mediaType === source.mediaType
    && output.byteSize === source.byteSize && output.sha256 === source.sha256 && output.content === source.content,
  'LEVEL_CANDIDATE_SOURCE_MISMATCH', 'The Candidate source output differs from the exact immutable branch source bytes.');
  return source;
}

export function validateStoredLevelCandidateRow(database, row, {
  identity: expectedIdentity = null, configuredBinding: expectedConfiguredBinding = null,
} = {}) {
  const configuredBinding = parseJson(row.configured_binding_json, 'task_level_candidate_submissions.configured_binding_json');
  if (expectedConfiguredBinding) {
    invariant(fingerprint(configuredBinding) === fingerprint(expectedConfiguredBinding),
      'LEVEL_CANDIDATE_CONFIG_MISMATCH', 'The persisted Candidate was built under another configured binding.');
  }
  const submission = validateTaskCandidateSubmission(parseJson(row.submission_json, 'task_level_candidate_submissions.submission_json'));
  const aggregate = parseJson(row.aggregate_json, 'task_level_candidate_submissions.aggregate_json');
  const result = parseJson(row.result_json, 'task_level_candidate_submissions.result_json');
  const identity = aggregate.identity;
  if (expectedIdentity) {
    invariant(fingerprint(identity) === fingerprint(expectedIdentity),
      'LEVEL_CANDIDATE_REPLAY_CONTEXT_MISMATCH', 'The persisted Candidate belongs to another trusted authority context.');
  }
  assertIdentityIds(identity, row.review_id);
  invariant(row.project_id === identity.projectId && row.task_id === identity.taskId
    && row.branch_id === identity.branchId && row.actor_id === identity.actorId && row.grant_id === identity.grantId
    && row.submission_id === identity.submissionId && row.idempotency_key_hash === identity.idempotencyKeyHash
    && row.request_fingerprint === identity.requestFingerprint
    && submission.projectId === row.project_id && submission.taskId === row.task_id
    && submission.branchId === row.branch_id && submission.baseRevision === Number(row.base_revision)
    && submission.branchHeadRevision === Number(row.branch_head_revision)
    && submission.submissionId === row.submission_id && submission.idempotencyKeyHash === row.idempotency_key_hash
    && submission.fingerprint === row.submission_fingerprint
    && submission.projectionFingerprint === row.projection_fingerprint
    && submission.candidate.candidateFingerprint === row.candidate_fingerprint,
  'CORRUPT_LEVEL_CANDIDATE', 'Candidate columns, identity, and submission disagree.');
  assertConfiguredClosure(submission, configuredBinding);
  assertSourceSubmissionClosure(database, identity, submission, configuredBinding);
  const task = taskRow(database, row.project_id, row.task_id);
  invariant(task && ['IN_REVIEW', 'REJECTED', 'CANCELLED'].includes(task.state),
    'CORRUPT_LEVEL_CANDIDATE', 'A persisted Candidate has no closed review-state task.');
  const { task: taskProjection, head } = closedHead(database, task);
  const grant = head.snapshot.grants.find(({ id }) => id === identity.grantId);
  invariant(grant, 'CORRUPT_LEVEL_CANDIDATE', 'The Candidate authority grant is absent from its immutable source head.');
  const authority = {
    baseRevision: Number(row.base_revision),
    branchHeadRevision: Number(row.branch_head_revision),
    authorityBinding: authorityBinding({
      identity, task: taskProjection, grant,
      baseRevision: Number(row.base_revision), branchHeadRevision: Number(row.branch_head_revision),
    }),
  };
  const expectedResult = candidateResult(identity, authority, submission, row.review_id);
  invariant(fingerprint(result) === fingerprint(expectedResult)
    && aggregate.requestFingerprint === row.request_fingerprint
    && aggregate.authorityBindingFingerprint === row.authority_binding_fingerprint
    && fingerprint(aggregate.authorityBinding) === fingerprint(authority.authorityBinding)
    && aggregate.authorityBinding.fingerprint === row.authority_binding_fingerprint
    && fingerprint(aggregate.configuredBinding) === fingerprint(configuredBinding)
    && aggregate.submissionFingerprint === submission.fingerprint
    && aggregate.resultFingerprint === result.fingerprint
    && aggregate.reviewId === row.review_id && aggregate.submittedAt === row.submitted_at
    && Number.isSafeInteger(aggregate.comparedMainRevision)
    && aggregate.fingerprint === fingerprintCore(aggregate) && result.fingerprint === fingerprintCore(result),
  'CORRUPT_LEVEL_CANDIDATE', 'The persisted Candidate Aggregate or result fingerprint does not close.');

  const reviewRows = database.prepare(`
    SELECT * FROM task_reviews WHERE project_id = ? AND task_id = ? AND review_id = ? ORDER BY review_version
  `).all(row.project_id, row.task_id, row.review_id);
  invariant(reviewRows.length === 1, 'CORRUPT_LEVEL_CANDIDATE', 'The Candidate must have exactly one immutable review version.');
  const review = parseJson(reviewRows[0].review_json, 'task_reviews.review_json');
  const expectedReview = candidateReview(identity, authority, submission, row.review_id,
    aggregate.comparedMainRevision, row.submitted_at);
  invariant(reviewRows[0].state === 'OPEN' && Number(reviewRows[0].review_version) === 1
    && reviewRows[0].created_at === row.submitted_at && fingerprint(review) === fingerprint(expectedReview),
  'CORRUPT_LEVEL_CANDIDATE', 'The Candidate review is not the exact fingerprint-derived PENDING review.');

  const timelineCore = candidateTimeline(identity, authority, submission, row.review_id, row.submitted_at);
  const timelineRows = database.prepare(`
    SELECT * FROM task_timeline_events WHERE project_id = ? AND task_id = ? AND event_id = ?
  `).all(row.project_id, row.task_id, timelineCore.eventId);
  invariant(timelineRows.length === 1, 'CORRUPT_LEVEL_CANDIDATE', 'The Candidate must have exactly one REVIEW_SUBMITTED event.');
  const timeline = parseJson(timelineRows[0].event_json, 'task_timeline_events.event_json');
  const expectedTimeline = {
    schemaVersion: 1, sequence: Number(timelineRows[0].sequence),
    projectId: row.project_id, taskId: row.task_id, ...timelineCore,
  };
  invariant(timelineRows[0].occurred_at === row.submitted_at
    && timelineRows[0].event_type === 'REVIEW_SUBMITTED'
    && fingerprint(timeline) === fingerprint(expectedTimeline)
    && !database.prepare('SELECT 1 FROM task_merges WHERE project_id = ? AND task_id = ?').get(row.project_id, row.task_id),
  'CORRUPT_LEVEL_CANDIDATE', 'The Candidate timeline or no-merge boundary does not close.');
  return { schemaVersion: 1, result: clone(result), submission: clone(submission) };
}

function replayFromRow(database, row, identity, expectedConfiguredBinding) {
  invariant(row.project_id === identity.projectId && row.task_id === identity.taskId
    && row.branch_id === identity.branchId && row.actor_id === identity.actorId && row.grant_id === identity.grantId,
  'LEVEL_CANDIDATE_REPLAY_CONTEXT_MISMATCH', 'The persisted Candidate belongs to another trusted authority context.');
  invariant(row.submission_id === identity.submissionId,
    'LEVEL_CANDIDATE_SUBMISSION_ID_CONFLICT', 'The Candidate submission ID was used with another idempotency identity.');
  invariant(row.idempotency_key_hash === identity.idempotencyKeyHash
    && row.request_fingerprint === identity.requestFingerprint,
  'IDEMPOTENCY_CONFLICT', 'The idempotency identity was used for different Level Candidate semantics.');
  return validateStoredLevelCandidateRow(database, row, { identity, configuredBinding: expectedConfiguredBinding });
}

function appendSourceInTransaction(database, workspace, {
  identity, expectedBaseRevision, expectedBranchHeadRevision, source, timestamp,
}) {
  invariant(expectedBranchHeadRevision === expectedBaseRevision,
    'LEVEL_CANDIDATE_BRANCH_NOT_EMPTY', 'Level Candidate creation requires an otherwise empty isolated task branch.');
  const authority = readFreshAuthority(database, identity, {
    expectedBaseRevision, expectedBranchHeadRevision, now: timestamp, requireCommandCapacity: true,
  });
  invariant(authority.branchHeadRevision === authority.baseRevision
    && durableBranchCharge(database, identity.projectId, identity.taskId) === 0,
  'LEVEL_CANDIDATE_BRANCH_NOT_EMPTY', 'Level Candidate creation requires an otherwise empty isolated task branch.');
  const command = sourceCommand(identity, source);
  const nextRevision = authority.branchHeadRevision + 1;
  const snapshot = clone(authority.head.snapshot);
  snapshot.project.updatedAt = timestamp;
  const grantIndex = snapshot.grants.findIndex(({ id }) => id === identity.grantId);
  invariant(grantIndex >= 0, 'GRANT_NOT_FOUND', 'The source head lost its bound grant.');
  snapshot.grants[grantIndex] = {
    ...snapshot.grants[grantIndex],
    usage: { ...snapshot.grants[grantIndex].usage, commands: snapshot.grants[grantIndex].usage.commands + 1 },
  };
  const commitResult = sourceResult(identity, source, {
    parentRevision: authority.branchHeadRevision, branchRevision: nextRevision,
  });
  const event = {
    id: `activity:${command.commandId}`,
    projectId: identity.projectId,
    revision: nextRevision,
    occurredAt: timestamp,
    actor: { id: identity.actorId, kind: 'agent' },
    taskId: identity.taskId,
    branchId: identity.branchId,
    commandId: command.commandId,
    commandType: command.type,
    status: 'committed',
    summary: `Immutable LevelSpec-derived Candidate source ${source.sourceId}@${source.sourceVersion} created.`,
    changes: [{ entityType: 'level_candidate_source', entityId: source.sourceId, operation: 'ADD' }],
  };
  const revision = {
    id: `${identity.branchId}:revision:${nextRevision}`,
    number: nextRevision,
    parentRevision: authority.branchHeadRevision,
    committedAt: timestamp,
    command,
    snapshot,
    result: commitResult,
    event,
  };
  database.prepare(`
    INSERT INTO task_branch_revisions(
      project_id, task_id, branch_id, branch_revision, revision_id, command_id,
      idempotency_key, command_type, committed_at, revision_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(identity.projectId, identity.taskId, identity.branchId, nextRevision, revision.id,
    command.commandId, command.idempotencyKey, command.type, timestamp, JSON.stringify(revision));
  workspace.fault('after_level_candidate_source_revision');
  const nextDocument = { ...authority.document, revisions: [...authority.document.revisions, clone(revision)] };
  const nextTask = {
    ...authority.task,
    usage: { ...authority.task.usage, commands: authority.task.usage.commands + 1 },
    headRevision: nextRevision,
    updatedAt: timestamp,
  };
  invariant(nextTask.usage.commands === snapshot.grants[grantIndex].usage.commands,
    'CORRUPT_LEVEL_CANDIDATE', 'Source commit must charge task and branch grant exactly once.');
  const updated = database.prepare(`
    UPDATE agent_tasks SET head_revision = ?, updated_at = ?, task_json = ?, head_document_json = ?
    WHERE project_id = ? AND task_id = ? AND head_revision = ? AND state = 'ACTIVE'
  `).run(nextRevision, timestamp, JSON.stringify(nextTask), JSON.stringify(nextDocument),
    identity.projectId, identity.taskId, authority.branchHeadRevision);
  invariant(Number(updated.changes) === 1, 'REVISION_CONFLICT', 'Level Candidate source compare-and-swap failed.');
  workspace.fault('after_level_candidate_source_task');
  appendTimeline(database, identity.projectId, identity.taskId, {
    eventId: `task-event:${identity.taskId}:revision:${nextRevision}`,
    occurredAt: timestamp,
    type: 'BRANCH_COMMAND_COMMITTED',
    actorId: identity.actorId,
    state: 'ACTIVE',
    branchRevision: nextRevision,
    details: {
      commandId: command.commandId, commandType: command.type,
      summary: event.summary, changes: clone(event.changes),
    },
  });
  workspace.fault('after_level_candidate_source_timeline');
  workspace.fault('before_level_candidate_source_commit');
  return readFreshAuthority(database, identity, {
    expectedBaseRevision,
    expectedBranchHeadRevision: nextRevision,
    now: timestamp,
    requireCommandCapacity: false,
  });
}

export class SqliteLevelCandidateStore {
  #workspace;
  #configuredBinding;

  constructor({ workspace, configuredBinding }) {
    invariant(workspace instanceof SqliteWorkspace, 'LEVEL_CANDIDATE_STORE_INVALID', 'SqliteWorkspace is required.');
    invariant(configuredBinding && typeof configuredBinding === 'object', 'LEVEL_CANDIDATE_STORE_INVALID', 'Configured Candidate binding is required.');
    this.#workspace = workspace;
    this.#configuredBinding = clone(configuredBinding);
  }

  get isLive() { return this.#workspace.isWriter; }

  lookupReplay(identity) {
    assertIdentityIds(identity);
    const row = candidateRows(this.#workspace.database, identity);
    return row ? replayFromRow(this.#workspace.database, row, identity, this.#configuredBinding) : null;
  }

  authorizeCreate({ identity, expectedBaseRevision, expectedBranchHeadRevision, now }) {
    assertIdentityIds(identity);
    invariant(expectedBranchHeadRevision === expectedBaseRevision,
      'LEVEL_CANDIDATE_BRANCH_NOT_EMPTY', 'Level Candidate creation requires an otherwise empty isolated task branch.');
    invariant(!this.#workspace.database.prepare(`
      SELECT submission_id FROM task_level_candidate_submissions WHERE project_id = ? AND task_id = ?
    `).get(identity.projectId, identity.taskId),
    'LEVEL_CANDIDATE_ALREADY_SUBMITTED', 'The task already has its one immutable Level Candidate.');
    const authority = readFreshAuthority(this.#workspace.database, identity, {
      expectedBaseRevision,
      expectedBranchHeadRevision,
      now,
      requireCommandCapacity: true,
    });
    invariant(authority.branchHeadRevision === authority.baseRevision
      && durableBranchCharge(this.#workspace.database, identity.projectId, identity.taskId) === 0,
    'LEVEL_CANDIDATE_BRANCH_NOT_EMPTY', 'Level Candidate creation requires an otherwise empty isolated task branch.');
    return Object.freeze({
      schemaVersion: 1,
      baseRevision: authority.baseRevision,
      branchHeadRevision: authority.branchHeadRevision,
    });
  }

  submitCandidate({
    identity, expectedBaseRevision, expectedBranchHeadRevision, reviewId,
    source: rawSource, submission: rawSubmission, configuredBinding, now,
  }) {
    assertIdentityIds(identity, reviewId);
    invariant(fingerprint(configuredBinding) === fingerprint(this.#configuredBinding),
      'LEVEL_CANDIDATE_CONFIG_MISMATCH', 'Application and store Candidate bindings differ.');
    const source = validateSource(rawSource, this.#configuredBinding);
    const submission = validateTaskCandidateSubmission(rawSubmission);
    invariant(submission.submissionId === identity.submissionId
      && submission.idempotencyKeyHash === identity.idempotencyKeyHash
      && submission.projectId === identity.projectId && submission.taskId === identity.taskId
      && submission.branchId === identity.branchId && submission.baseRevision === expectedBaseRevision
      && submission.branchHeadRevision === expectedBranchHeadRevision + 1,
    'LEVEL_CANDIDATE_BINDING_MISMATCH', 'Submission and trusted request coordinates differ.');
    assertConfiguredClosure(submission, this.#configuredBinding);
    const timestamp = requireIsoDate(now, 'now');
    const result = this.#workspace.transaction((database) => {
      const replay = candidateRows(database, identity);
      if (replay) return { ...replayFromRow(database, replay, identity, this.#configuredBinding), replayed: true };
      invariant(!database.prepare(`
        SELECT submission_id FROM task_level_candidate_submissions WHERE project_id = ? AND task_id = ?
      `).get(identity.projectId, identity.taskId),
      'LEVEL_CANDIDATE_ALREADY_SUBMITTED', 'The task already has its one immutable Level Candidate.');
      const authority = appendSourceInTransaction(database, this.#workspace, {
        identity, expectedBaseRevision, expectedBranchHeadRevision, source, timestamp,
      });
      invariant(authority.branchHeadRevision === expectedBranchHeadRevision + 1,
        'LEVEL_CANDIDATE_HEAD_MISMATCH', 'The immutable source did not become the exact Candidate branch head.');
      assertSourceSubmissionClosure(database, identity, submission, this.#configuredBinding);
      invariant(submission.candidate.candidateManifest.project.revision === authority.branchHeadRevision,
        'LEVEL_CANDIDATE_HEAD_MISMATCH', 'Candidate manifest revision is not the exact current branch head.');
      const mainRevision = Number(database.prepare('SELECT head_revision FROM projects WHERE project_id = ?')
        .get(identity.projectId)?.head_revision);
      invariant(Number.isSafeInteger(mainRevision), 'PROJECT_NOT_FOUND', 'The Candidate project does not exist.');
      const persistedResult = candidateResult(identity, authority, submission, reviewId);
      const aggregate = withFingerprint({
        schemaVersion: 1,
        kind: 'studio.level-candidate-submission-aggregate',
        identity: clone(identity),
        requestFingerprint: identity.requestFingerprint,
        authorityBinding: clone(authority.authorityBinding),
        authorityBindingFingerprint: authority.authorityBinding.fingerprint,
        configuredBinding: clone(this.#configuredBinding),
        submissionFingerprint: submission.fingerprint,
        resultFingerprint: persistedResult.fingerprint,
        reviewId,
        comparedMainRevision: mainRevision,
        submittedAt: timestamp,
      });
      database.prepare(`
        INSERT INTO task_level_candidate_submissions(
          project_id, task_id, submission_id, branch_id, base_revision, branch_head_revision,
          actor_id, grant_id, idempotency_key_hash, request_fingerprint,
          authority_binding_fingerprint, submission_fingerprint, projection_fingerprint,
          candidate_fingerprint, review_id, submitted_at, configured_binding_json,
          aggregate_json, submission_json, result_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        identity.projectId, identity.taskId, submission.submissionId, identity.branchId,
        authority.baseRevision, authority.branchHeadRevision, identity.actorId, identity.grantId,
        identity.idempotencyKeyHash, identity.requestFingerprint, authority.authorityBinding.fingerprint,
        submission.fingerprint, submission.projectionFingerprint, submission.candidate.candidateFingerprint,
        reviewId, timestamp, JSON.stringify(this.#configuredBinding), JSON.stringify(aggregate),
        JSON.stringify(submission), JSON.stringify(persistedResult),
      );
      this.#workspace.fault('after_level_candidate_insert');
      const review = candidateReview(identity, authority, submission, reviewId, mainRevision, timestamp);
      database.prepare(`
        INSERT INTO task_reviews(project_id, task_id, review_id, review_version, state, created_at, review_json)
        VALUES (?, ?, ?, 1, 'OPEN', ?, ?)
      `).run(identity.projectId, identity.taskId, reviewId, timestamp, JSON.stringify(review));
      this.#workspace.fault('after_level_candidate_review');
      const submittedTask = transitionAgentTask(authority.task, 'submit', {
        now: timestamp, reason: 'Immutable Level Candidate submitted for human review.',
      });
      const updated = database.prepare(`
        UPDATE agent_tasks SET state = 'IN_REVIEW', updated_at = ?, task_json = ?
        WHERE project_id = ? AND task_id = ? AND state = 'ACTIVE' AND head_revision = ?
      `).run(timestamp, JSON.stringify(submittedTask), identity.projectId, identity.taskId, authority.branchHeadRevision);
      invariant(Number(updated.changes) === 1, 'REVISION_CONFLICT', 'Level Candidate task transition compare-and-swap failed.');
      this.#workspace.fault('after_level_candidate_task_transition');
      appendTimeline(database, identity.projectId, identity.taskId,
        candidateTimeline(identity, authority, submission, reviewId, timestamp));
      this.#workspace.fault('after_level_candidate_timeline');
      this.#workspace.fault('before_level_candidate_commit');
      return { schemaVersion: 1, result: clone(persistedResult), submission: clone(submission), replayed: false };
    });
    this.#workspace.fault('after_level_candidate_commit');
    return result;
  }
}
