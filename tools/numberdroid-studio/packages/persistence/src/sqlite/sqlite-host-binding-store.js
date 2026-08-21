import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { StudioError, invariant } from '../../../domain/src/errors.js';
import { requireId, requireIsoDate } from '../../../domain/src/validation.js';
import { SqliteWorkspace } from './sqlite-workspace.js';

function tokenDigest(token) {
  invariant(typeof token === 'string' && token.length >= 32 && token.length <= 512, 'HOST_BINDING_REQUIRED', 'A valid opaque HostBinding token is required.');
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function bindingProjection(row, now) {
  const expired = row.expires_at !== null && Date.parse(row.expires_at) <= Date.parse(now);
  return {
    schemaVersion: 1,
    bindingId: row.binding_id,
    projectId: row.project_id,
    grantId: row.grant_id,
    actor: { id: row.agent_id, kind: 'agent', displayName: null },
    taskId: row.task_id,
    branchId: row.branch_id,
    issuedBy: row.issued_by,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    revokeReason: row.revoke_reason,
    status: row.revoked_at ? 'REVOKED' : expired ? 'EXPIRED' : 'ACTIVE',
  };
}

export class SqliteHostBindingStore {
  #workspace;
  #clock;

  constructor({ workspace, clock = () => new Date().toISOString() }) {
    invariant(workspace instanceof SqliteWorkspace, 'VALIDATION_ERROR', 'SqliteWorkspace is required.');
    invariant(typeof clock === 'function', 'VALIDATION_ERROR', 'HostBinding clock must be a function.');
    this.#workspace = workspace;
    this.#clock = clock;
  }

  issue({ projectId, grantId, agentId, taskId, branchId, issuedBy, expiresAt = null }) {
    const issuedAt = requireIsoDate(this.#clock(), 'clock');
    const record = {
      bindingId: `binding.${randomUUID()}`,
      projectId: requireId(projectId, 'projectId'),
      grantId: requireId(grantId, 'grantId'),
      agentId: requireId(agentId, 'agentId'),
      taskId: requireId(taskId, 'taskId'),
      branchId: requireId(branchId, 'branchId'),
      issuedBy: requireId(issuedBy, 'issuedBy'),
      issuedAt,
      expiresAt: expiresAt === null ? null : requireIsoDate(expiresAt, 'expiresAt'),
    };
    if (record.expiresAt) {
      invariant(Date.parse(record.expiresAt) > Date.parse(issuedAt), 'VALIDATION_ERROR', 'HostBinding expiry must be in the future.');
    }
    const token = randomBytes(32).toString('base64url');
    const digest = tokenDigest(token);
    this.#workspace.transaction((database) => {
      const grant = database.prepare(`
        SELECT agent_id, task_id, branch_id, authorization_status, status, expires_at, revoked_at
        FROM grants WHERE project_id = ? AND grant_id = ?
      `).get(record.projectId, record.grantId);
      invariant(grant, 'GRANT_NOT_FOUND', 'A HostBinding requires an existing grant.', {
        projectId: record.projectId,
        grantId: record.grantId,
      });
      invariant(
        grant.authorization_status === 'ACTIVE' && grant.status === 'ACTIVE' && grant.revoked_at === null,
        'GRANT_NOT_ACTIVE',
        'Only an active, non-legacy grant can be bound to an MCP host.',
        { grantId: record.grantId, authorizationStatus: grant.authorization_status, status: grant.status },
      );
      invariant(
        grant.agent_id === record.agentId && grant.task_id === record.taskId && grant.branch_id === record.branchId,
        'HOST_BINDING_GRANT_MISMATCH',
        'HostBinding actor, task, and branch must exactly match its grant.',
      );
      invariant(!grant.expires_at || Date.parse(grant.expires_at) > Date.parse(issuedAt), 'GRANT_EXPIRED', 'An expired grant cannot be host-bound.');
      invariant(
        !record.expiresAt || !grant.expires_at || Date.parse(record.expiresAt) <= Date.parse(grant.expires_at),
        'HOST_BINDING_EXPIRY_EXCEEDS_GRANT',
        'HostBinding expiry cannot exceed grant expiry.',
      );
      database.prepare(`
        INSERT INTO host_bindings(
          binding_id, token_digest, project_id, grant_id, agent_id, task_id,
          branch_id, issued_by, issued_at, expires_at, revoked_at, revoke_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
      `).run(
        record.bindingId, digest, record.projectId, record.grantId, record.agentId,
        record.taskId, record.branchId, record.issuedBy, record.issuedAt, record.expiresAt,
      );
    });
    return {
      schemaVersion: 1,
      token,
      binding: {
        ...record,
        actor: { id: record.agentId, kind: 'agent', displayName: null },
        status: 'ACTIVE',
      },
    };
  }

  resolve(token) {
    const now = requireIsoDate(this.#clock(), 'clock');
    const row = this.#workspace.database.prepare('SELECT * FROM host_bindings WHERE token_digest = ?')
      .get(tokenDigest(token));
    if (!row) throw new StudioError('HOST_BINDING_NOT_FOUND', 'The HostBinding is unknown or no longer available.');
    const binding = bindingProjection(row, now);
    invariant(binding.status !== 'REVOKED', 'HOST_BINDING_REVOKED', 'The HostBinding has been revoked.', {
      bindingId: binding.bindingId,
    });
    invariant(binding.status !== 'EXPIRED', 'HOST_BINDING_EXPIRED', 'The HostBinding has expired.', {
      bindingId: binding.bindingId,
      expiresAt: binding.expiresAt,
    });
    return binding;
  }

  revoke(bindingId, { revokedBy, reason = null } = {}) {
    const id = requireId(bindingId, 'bindingId');
    requireId(revokedBy, 'revokedBy');
    const now = requireIsoDate(this.#clock(), 'clock');
    return this.#workspace.transaction((database) => {
      const updated = database.prepare(`
        UPDATE host_bindings
        SET revoked_at = ?, revoke_reason = ?
        WHERE binding_id = ? AND revoked_at IS NULL
      `).run(now, reason, id);
      invariant(Number(updated.changes) === 1, 'HOST_BINDING_NOT_ACTIVE', 'The HostBinding does not exist or is already revoked.', {
        bindingId: id,
      });
      return { schemaVersion: 1, bindingId: id, revokedAt: now };
    });
  }

  rebindGrant({ projectId, fromGrantId, toGrantId, reboundBy }) {
    const project = requireId(projectId, 'projectId');
    const from = requireId(fromGrantId, 'fromGrantId');
    const to = requireId(toGrantId, 'toGrantId');
    requireId(reboundBy, 'reboundBy');
    invariant(from !== to, 'VALIDATION_ERROR', 'HostBinding grant rotation requires a different target grant.');
    return this.#workspace.transaction((database) => {
      const grants = database.prepare(`
        SELECT grant_id, agent_id, task_id, branch_id, authorization_status, status, revoked_at
        FROM grants WHERE project_id = ? AND grant_id IN (?, ?)
      `).all(project, from, to);
      const prior = grants.find((grant) => grant.grant_id === from);
      const target = grants.find((grant) => grant.grant_id === to);
      invariant(prior && target, 'GRANT_NOT_FOUND', 'HostBinding rotation requires both the prior and target grants.');
      invariant(
        target.authorization_status === 'ACTIVE' && target.status === 'ACTIVE' && target.revoked_at === null,
        'GRANT_NOT_ACTIVE',
        'HostBinding rotation target must be an active, non-legacy grant.',
      );
      invariant(
        prior.agent_id === target.agent_id && prior.task_id === target.task_id && prior.branch_id === target.branch_id,
        'HOST_BINDING_GRANT_MISMATCH',
        'HostBinding rotation cannot change its agent, task, or branch.',
      );
      const updated = database.prepare(`
        UPDATE host_bindings SET grant_id = ?
        WHERE project_id = ? AND grant_id = ? AND revoked_at IS NULL
      `).run(to, project, from);
      return { schemaVersion: 1, projectId: project, reboundBindings: Number(updated.changes) };
    });
  }

  alignBindingsToGrant({ projectId, toGrantId, reboundBy }) {
    const project = requireId(projectId, 'projectId');
    const to = requireId(toGrantId, 'toGrantId');
    requireId(reboundBy, 'reboundBy');
    return this.#workspace.transaction((database) => {
      const target = database.prepare(`
        SELECT grant_id, agent_id, task_id, branch_id, authorization_status, status, revoked_at
        FROM grants WHERE project_id = ? AND grant_id = ?
      `).get(project, to);
      invariant(target, 'GRANT_NOT_FOUND', 'HostBinding alignment requires the target grant.');
      invariant(
        target.authorization_status === 'ACTIVE' && target.status === 'ACTIVE' && target.revoked_at === null,
        'GRANT_NOT_ACTIVE',
        'HostBinding alignment target must be an active, non-legacy grant.',
      );
      const updated = database.prepare(`
        UPDATE host_bindings SET grant_id = ?
        WHERE project_id = ? AND agent_id = ? AND task_id = ? AND branch_id = ?
          AND grant_id <> ? AND revoked_at IS NULL
      `).run(to, project, target.agent_id, target.task_id, target.branch_id, to);
      return { schemaVersion: 1, projectId: project, reboundBindings: Number(updated.changes) };
    });
  }

  listForProject(projectId) {
    const id = requireId(projectId, 'projectId');
    const now = requireIsoDate(this.#clock(), 'clock');
    return this.#workspace.database.prepare(`
      SELECT * FROM host_bindings WHERE project_id = ? ORDER BY issued_at, binding_id
    `).all(id).map((row) => {
      const binding = bindingProjection(row, now);
      const { grantId: _secretGrantId, ...redacted } = binding;
      return redacted;
    });
  }
}
