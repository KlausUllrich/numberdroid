import { StudioError, invariant } from '../../../domain/src/errors.js';

const CURRENT_HOST_BINDING_SELECT = `
  SELECT hb.*,
    g.project_id AS current_grant_project_id,
    g.grant_id AS current_grant_id,
    g.agent_id AS grant_agent_id,
    g.task_id AS grant_task_id,
    g.branch_id AS grant_branch_id,
    g.authorization_status AS grant_authorization_status,
    g.status AS grant_status,
    g.revoked_at AS grant_revoked_at,
    g.expires_at AS grant_expires_at
  FROM host_bindings hb
  LEFT JOIN grants g
    ON g.project_id = hb.project_id AND g.grant_id = hb.grant_id
`;

function expiredAt(value, now, label) {
  if (value === null) return false;
  const timestamp = Date.parse(value);
  invariant(Number.isFinite(timestamp), 'CORRUPT_HOST_BINDING', `${label} is not a valid timestamp.`);
  return timestamp <= Date.parse(now);
}

function grantClassification(row, now) {
  const legacy = row.grant_authorization_status === 'LEGACY_UNBOUND'
    || row.grant_status === 'LEGACY_UNBOUND';
  const revoked = row.grant_revoked_at !== null
    || row.grant_authorization_status === 'REVOKED'
    || row.grant_status === 'REVOKED';
  const expired = row.grant_authorization_status === 'EXPIRED'
    || row.grant_status === 'EXPIRED'
    || expiredAt(row.grant_expires_at, now, 'Grant expiry');
  const active = row.grant_authorization_status === 'ACTIVE'
    && row.grant_status === 'ACTIVE'
    && row.grant_revoked_at === null
    && !expired;
  return { active, expired, legacy, revoked };
}

export function readCurrentHostBindingByTokenDigest(database, digest) {
  return database.prepare(`${CURRENT_HOST_BINDING_SELECT} WHERE hb.token_digest = ?`).get(digest);
}

export function readCurrentHostBindingById(database, bindingId) {
  return database.prepare(`${CURRENT_HOST_BINDING_SELECT} WHERE hb.binding_id = ?`).get(bindingId);
}

export function currentHostBindingState(row, now) {
  const bindingExpired = expiredAt(row.expires_at, now, 'HostBinding expiry');
  const grant = grantClassification(row, now);
  return {
    bindingExpired,
    grantExpired: grant.expired,
    grantLegacy: grant.legacy,
    grantRevoked: grant.revoked
      || (!grant.active && !grant.expired && !grant.legacy),
  };
}

export function assertCurrentHostBinding(
  row,
  now,
  expected = null,
  { requireActiveGrant = true } = {},
) {
  if (!row) {
    throw new StudioError('HOST_BINDING_NOT_FOUND', 'The HostBinding is unknown or no longer available.');
  }
  if (expected !== null) {
    invariant(
      row.binding_id === expected.bindingId
        && row.project_id === expected.projectId
        && row.grant_id === expected.grantId
        && row.agent_id === expected.agentId
        && row.task_id === expected.taskId
        && row.branch_id === expected.branchId
        && row.issued_by === expected.issuedBy
        && row.issued_at === expected.issuedAt
        && row.expires_at === expected.expiresAt,
      'HOST_BINDING_GRANT_MISMATCH',
      'The current HostBinding no longer matches its trusted session coordinates.',
    );
  }
  invariant(row.revoked_at === null, 'HOST_BINDING_REVOKED', 'The HostBinding has been revoked.');
  invariant(!expiredAt(row.expires_at, now, 'HostBinding expiry'), 'HOST_BINDING_EXPIRED', 'The HostBinding has expired.');
  invariant(row.current_grant_id !== null, 'GRANT_NOT_FOUND', 'The HostBinding grant no longer exists.');
  invariant(
    row.current_grant_project_id === row.project_id
      && row.current_grant_id === row.grant_id
      && row.grant_agent_id === row.agent_id
      && row.grant_task_id === row.task_id
      && row.grant_branch_id === row.branch_id,
    'HOST_BINDING_GRANT_MISMATCH',
    'The HostBinding and its current grant coordinates disagree.',
  );
  if (!requireActiveGrant) return row;
  const grant = grantClassification(row, now);
  invariant(!grant.legacy, 'GRANT_REQUIRED', 'A legacy-unbound grant cannot authorize a HostBinding.');
  invariant(!grant.revoked, 'GRANT_REVOKED', 'The HostBinding grant has been revoked.');
  invariant(!grant.expired, 'GRANT_EXPIRED', 'The HostBinding grant has expired.');
  invariant(grant.active, 'GRANT_REVOKED', 'The HostBinding grant is not active.');
  return row;
}
