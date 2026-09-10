import { invariant } from '../../../domain/src/errors.js';
import { applySliceRevisionCommand, validateSliceRevisionJobInput } from '../../../application/src/slice-revision-service.js';
import { fingerprint } from '../../../application/src/value-utils.js';

export function isSliceRevisionCommand(type) { return ['slice.revision.prepare', 'slice.revision.commit'].includes(type); }
function job(database, projectId, jobId, replay = false) {
  if (!jobId) return null;
  const row = database.prepare('SELECT * FROM jobs WHERE project_id = ? AND job_id = ?').get(projectId, jobId);
  if (!row) {
    const imported = database.prepare('SELECT * FROM bundle_import_applied_jobs WHERE project_id = ? AND job_id = ?').get(projectId, jobId);
    return imported ? { jobId, state: 'APPLIED' } : null;
  }
  return { projectId, jobId, state: replay && row.state === 'APPLIED' ? 'SUCCEEDED' : row.state,
    appliedRevision: replay && row.state === 'APPLIED' ? null : row.applied_revision,
    input: JSON.parse(row.input_json), inputFingerprint: row.input_fingerprint, outputs: row.output_json ? JSON.parse(row.output_json) : null,
    creator: { actor: { id: row.creator_actor_id, kind: row.creator_actor_kind }, taskId: row.creator_task_id, branchId: row.creator_branch_id, grantId: row.creator_grant_id } };
}
export function validateSliceRevision(database, projectId, revision, { integrity = false } = {}) {
  if (!isSliceRevisionCommand(revision.command.type)) return;
  const document = { projectId, revisions: database.prepare('SELECT revision_json FROM revisions WHERE project_id = ? AND revision_number <= ? ORDER BY revision_number')
    .all(projectId, revision.parentRevision).map(row => JSON.parse(row.revision_json)) };
  const prior = document.revisions.at(-1)?.snapshot;
  invariant(prior, 'SLICE_REVISION_HISTORY_INVALID', 'Cut revision has no parent snapshot.');
  const command = { ...revision.command, projectId, baseRevision: revision.parentRevision, branchId: revision.command.actor.kind === 'agent'
    ? prior.grants.find(grant => grant.id === revision.command.grantId)?.branchId : 'branch.main' };
  const next = structuredClone(prior); next.project.updatedAt = revision.committedAt;
  if (revision.command.actor.kind === 'agent') {
    const grant = next.grants.find(candidate => candidate.id === revision.command.grantId);
    invariant(grant, 'INVALID_GRANT_PROJECTION', 'Cut revision grant is missing.');
    invariant(grant.agentId === revision.command.actor.id && grant.taskId === revision.command.taskId && grant.branchId === command.branchId
      && grant.scopes.includes(revision.command.type) && grant.revokedAt === null
      && (!grant.expiresAt || Date.parse(grant.expiresAt) > Date.parse(revision.committedAt))
      && grant.objectScopes.some(scope => scope.kind === 'project' && scope.id === projectId), 'FORBIDDEN', 'Cut revision authority does not match its originating grant.');
    grant.usage.commands += 1;
    invariant(grant.usage.commands <= grant.budget.maxCommands, 'INVALID_GRANT_PROJECTION', 'Cut revision command budget exceeded.');
  } else invariant(revision.command.actor.kind === 'human' && revision.command.actor.id === prior.project.ownerId, 'FORBIDDEN', 'Cut revision owner does not match.');
  const atlas = prior.atlases?.find(candidate => candidate.sliceHeads.some(slice => slice.sliceId === revision.command.payload.sliceId));
  const atlasJob = revision.command.type === 'slice.revision.commit' ? job(database, projectId, revision.command.payload.jobId, integrity) : null;
  const applied = applySliceRevisionCommand(command, next, document, revision.committedAt,
    { atlasJob, priorAtlasJob: job(database, projectId, atlas?.latestPreviewJobId) });
  const semantic = value => { const result = structuredClone(value); for (const grant of result.grants) delete grant.authorizationStatus; return result; };
  invariant(fingerprint(semantic(applied.snapshot)) === fingerprint(semantic(revision.snapshot)) && fingerprint(applied.result) === fingerprint(revision.result),
    'SLICE_REVISION_HISTORY_INVALID', 'Cut revision differs from its deterministic semantic command.');
  if (applied.result.job) validateSliceRevisionJobInput(applied.result.job.input);
}

export function inspectSliceRevisionIntegrity(database) {
  const findings = []; let count = 0;
  for (const row of database.prepare('SELECT project_id, revision_number, command_type, revision_json FROM revisions ORDER BY project_id, revision_number').all()) {
    let revision;
    try { revision = JSON.parse(row.revision_json); } catch { continue; }
    if (!isSliceRevisionCommand(row.command_type) && !isSliceRevisionCommand(revision?.command?.type)) continue;
    count += 1;
    try {
      invariant(row.command_type === revision.command.type, 'SLICE_REVISION_COMMAND_MISMATCH', 'Cut revision SQL and JSON command types differ.');
      const imported = revision.command.commandId === `bundle-import.command.${row.revision_number}`
        && revision.command.fingerprint === fingerprint({ provenance: 'bundle_import', revision: row.revision_number });
      if (imported) {
        invariant(database.prepare('SELECT 1 FROM bundle_imports WHERE project_id=? AND imported_revision>=?').get(row.project_id, row.revision_number),
          'SLICE_REVISION_IMPORT_INVALID', 'Imported cut history lacks its reserved non-authorizing bundle provenance.');
        continue;
      }
      validateSliceRevision(database, row.project_id, revision, { integrity: true });
    } catch (error) { findings.push({ projectId: row.project_id, revision: row.revision_number, code: error.code ?? 'SLICE_REVISION_INVALID', message: error.message }); }
  }
  return { ok: findings.length === 0, revisionCount: count, findings };
}
