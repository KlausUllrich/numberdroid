import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { StudioError, invariant } from '../../../domain/src/errors.js';
import { requireId, requireIsoDate } from '../../../domain/src/validation.js';
import { SqliteWorkspace } from './sqlite-workspace.js';

function tokenDigest(token) {
  invariant(typeof token === 'string' && token.length >= 32 && token.length <= 512, 'HOST_BINDING_REQUIRED', 'A valid opaque HostBinding token is required.');
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function bindingProjection(row, now) {
  const bindingExpired = row.expires_at !== null && Date.parse(row.expires_at) <= Date.parse(now);
  const grantExpired = row.grant_authorization_status === 'EXPIRED'
    || (row.grant_expires_at !== undefined && row.grant_expires_at !== null
      && Date.parse(row.grant_expires_at) <= Date.parse(now));
  const grantRevoked = (row.grant_revoked_at !== undefined && row.grant_revoked_at !== null)
    || ['REVOKED', 'LEGACY_UNBOUND'].includes(row.grant_authorization_status);
  const revokedAt = row.revoked_at ?? (grantRevoked ? row.grant_revoked_at : null);
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
    revokedAt,
    revokeReason: row.revoke_reason,
    status: row.revoked_at || grantRevoked
      ? 'REVOKED'
      : bindingExpired || grantExpired ? 'EXPIRED' : 'ACTIVE',
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

  beginAgentAccessOperation({ projectId, idempotencyKey, fingerprint }) {
    const project = requireId(projectId, 'projectId');
    const key = requireId(idempotencyKey, 'idempotencyKey');
    invariant(typeof fingerprint === 'string' && fingerprint.length > 0, 'VALIDATION_ERROR', 'Agent access fingerprint is required.');
    const now = requireIsoDate(this.#clock(), 'clock');
    return this.#workspace.transaction((database) => {
      const existing = database.prepare(`
        SELECT request_fingerprint, status, result_json
        FROM human_agent_access_operations
        WHERE project_id = ? AND idempotency_key = ?
      `).get(project, key);
      if (existing) {
        invariant(
          existing.request_fingerprint === fingerprint,
          'IDEMPOTENCY_CONFLICT',
          'The Agent access idempotency key was reused for another request.',
        );
        return {
          schemaVersion: 1,
          status: existing.status,
          result: existing.result_json ? JSON.parse(existing.result_json) : null,
        };
      }
      database.prepare(`
        INSERT INTO human_agent_access_operations(
          project_id, idempotency_key, request_fingerprint, status,
          result_json, started_at, completed_at
        ) VALUES (?, ?, ?, 'IN_PROGRESS', NULL, ?, NULL)
      `).run(project, key, fingerprint, now);
      return { schemaVersion: 1, status: 'STARTED', result: null };
    });
  }

  completeAgentAccessOperation({ projectId, idempotencyKey, fingerprint, result }) {
    const project = requireId(projectId, 'projectId');
    const key = requireId(idempotencyKey, 'idempotencyKey');
    invariant(typeof fingerprint === 'string' && fingerprint.length > 0, 'VALIDATION_ERROR', 'Agent access fingerprint is required.');
    const now = requireIsoDate(this.#clock(), 'clock');
    return this.#workspace.transaction((database) => {
      const operation = database.prepare(`
        SELECT request_fingerprint, status, result_json
        FROM human_agent_access_operations
        WHERE project_id = ? AND idempotency_key = ?
      `).get(project, key);
      invariant(operation, 'IDEMPOTENCY_OPERATION_NOT_FOUND', 'The Agent access operation was not started.');
      invariant(operation.request_fingerprint === fingerprint, 'IDEMPOTENCY_CONFLICT', 'The Agent access request fingerprint changed.');
      if (operation.status === 'COMPLETED') return JSON.parse(operation.result_json);
      database.prepare(`
        UPDATE human_agent_access_operations
        SET status = 'COMPLETED', result_json = ?, completed_at = ?
        WHERE project_id = ? AND idempotency_key = ?
      `).run(JSON.stringify(result), now, project, key);
      return structuredClone(result);
    });
  }

  abandonAgentAccessOperation({ projectId, idempotencyKey, fingerprint }) {
    const project = requireId(projectId, 'projectId');
    const key = requireId(idempotencyKey, 'idempotencyKey');
    invariant(typeof fingerprint === 'string' && fingerprint.length > 0, 'VALIDATION_ERROR', 'Agent access fingerprint is required.');
    return this.#workspace.transaction((database) => {
      const removed = database.prepare(`
        DELETE FROM human_agent_access_operations
        WHERE project_id = ? AND idempotency_key = ?
          AND request_fingerprint = ? AND status = 'IN_PROGRESS'
      `).run(project, key, fingerprint);
      return { schemaVersion: 1, abandoned: Number(removed.changes) === 1 };
    });
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

  revokeActiveForProject(projectId, { revokedBy, reason = null } = {}) {
    const project = requireId(projectId, 'projectId');
    requireId(revokedBy, 'revokedBy');
    const now = requireIsoDate(this.#clock(), 'clock');
    return this.#workspace.transaction((database) => {
      const updated = database.prepare(`
        UPDATE host_bindings
        SET revoked_at = ?, revoke_reason = ?
        WHERE project_id = ? AND revoked_at IS NULL
      `).run(now, reason, project);
      return {
        schemaVersion: 1,
        projectId: project,
        revokedAt: now,
        revokedBindings: Number(updated.changes),
      };
    });
  }

  listForProject(projectId) {
    const id = requireId(projectId, 'projectId');
    const now = requireIsoDate(this.#clock(), 'clock');
    return this.#workspace.database.prepare(`
      SELECT hb.*,
        g.authorization_status AS grant_authorization_status,
        g.status AS grant_status,
        g.revoked_at AS grant_revoked_at,
        g.expires_at AS grant_expires_at
      FROM host_bindings hb
      JOIN grants g ON g.project_id = hb.project_id AND g.grant_id = hb.grant_id
      WHERE hb.project_id = ?
      ORDER BY hb.issued_at, hb.binding_id
    `).all(id).map((row) => {
      const binding = bindingProjection(row, now);
      const { grantId: _secretGrantId, ...redacted } = binding;
      return redacted;
    });
  }
}
