export const BACKUP_CANDIDATE_STATUS = 'implemented candidate — not user accepted';

const BACKUP_HEALTH = new Set(['UNVERIFIED', 'VERIFIED', 'SUSPECT', 'MISSING']);
const OPERATION_KINDS = new Set(['CREATE', 'VERIFY', 'RECOVERY_TEST', 'RESTORE_AS_COPY']);
const OPERATION_STATUSES = new Set(['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'INTERRUPTED']);
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const OPERATION_PHASES = Object.freeze({
  CREATE: Object.freeze(['RESERVED', 'SOURCE_VERIFIED', 'DB_SNAPSHOTTED', 'CAS_COPIED', 'MANIFEST_WRITTEN', 'SNAPSHOT_VERIFIED', 'DURABLY_CLOSED', 'PUBLISHED', 'COMPLETED']),
  VERIFY: Object.freeze(['RESERVED', 'BACKUP_RESOLVED', 'CONTENT_VERIFIED', 'COMPLETED']),
  RECOVERY_TEST: Object.freeze(['RESERVED', 'BACKUP_VERIFIED', 'COPY_STAGED', 'COPY_VERIFIED', 'READ_ONLY_OPENED', 'PARITY_VERIFIED', 'TEST_COPY_CLEANED', 'COMPLETED']),
  RESTORE_AS_COPY: Object.freeze(['RESERVED', 'BACKUP_VERIFIED', 'COPY_STAGED', 'COPY_VERIFIED', 'QUARANTINE_WRITTEN', 'DURABLY_CLOSED', 'PUBLISHED', 'COMPLETED']),
});
const FAILURE_MESSAGES = Object.freeze({
  WORKSPACE_OPERATOR_REQUIRED: 'A local workspace-operator session is required.',
  WORKSPACE_OPERATOR_FORBIDDEN: 'The local session cannot manage workspace backups.',
  OPERATIONS_UNAVAILABLE: 'Backup operations are unavailable.',
  OPERATION_NOT_FOUND: 'The requested backup operation or record was not found.',
  OPERATION_IDEMPOTENCY_CONFLICT: 'The idempotency key was already used for different input.',
  OPERATION_STATE_CONFLICT: 'The backup operation cannot transition from its current state.',
  OPERATION_LEASE_LOST: 'The backup worker no longer owns this operation.',
  BACKUP_DESTINATION_UNKNOWN: 'The configured backup destination is unavailable.',
  BACKUP_PATH_UNSAFE: 'The configured backup location failed its safety checks.',
  BACKUP_DESTINATION_CONFLICT: 'The reserved backup output already exists.',
  BACKUP_SOURCE_INTEGRITY_FAILED: 'The current workspace did not pass the backup integrity check.',
  BACKUP_SNAPSHOT_FAILED: 'A complete backup snapshot could not be created.',
  BACKUP_SNAPSHOT_INTEGRITY_FAILED: 'The new backup snapshot did not pass verification.',
  BACKUP_SCHEMA_UNSUPPORTED: 'The backup format cannot be verified by this Studio version.',
  BACKUP_CONTENT_MISMATCH: 'The backup content differs from its verified evidence.',
  BACKUP_DURABILITY_FAILED: 'Durable backup completion could not be proved.',
  BACKUP_PUBLISH_FAILED: 'The verified backup output could not be published safely.',
  RECOVERY_TEST_FAILED: 'The read-only recovery test did not complete successfully.',
  RESTORE_COPY_FAILED: 'A verified restored copy could not be created safely.',
  RESTORED_COPY_QUARANTINED: 'The restored copy is quarantined and cannot be opened normally.',
  OPERATION_INTERRUPTED: 'The interrupted backup operation could not be resumed safely.',
});

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function text(value, fallback = null) {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function opaqueId(value) {
  return typeof value === 'string' && ID_PATTERN.test(value) ? value : null;
}

function nullableOpaqueId(value) {
  return value === null ? null : opaqueId(value);
}

function safeLabel(value) {
  return typeof value === 'string' && value.trim() === value
    && value.length >= 1 && value.length <= 80 && !/[\u0000-\u001f\u007f]/.test(value)
    ? value : null;
}

function timestamp(value) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return null;
  try { return new Date(value).toISOString() === value ? value : null; } catch { return null; }
}

function count(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function destination(value) {
  const source = record(value);
  const destinationId = opaqueId(source.destinationId);
  const label = safeLabel(source.label);
  return destinationId && label ? Object.freeze({ destinationId, label }) : null;
}

function operation(value) {
  const source = record(value);
  if (source.schemaVersion !== 1 || !opaqueId(source.operationId) || !OPERATION_KINDS.has(source.kind)
    || !OPERATION_STATUSES.has(source.status)) return null;
  const phases = OPERATION_PHASES[source.kind];
  const phaseIndex = phases.indexOf(source.phase);
  const progress = record(source.progress);
  if (phaseIndex < 0 || progress.current !== phaseIndex || progress.total !== phases.length - 1) return null;
  if ((source.status === 'QUEUED' && source.phase !== 'RESERVED')
    || (source.status === 'SUCCEEDED' && source.phase !== 'COMPLETED')
    || (source.phase === 'COMPLETED' && source.status !== 'SUCCEEDED')
    || (['FAILED', 'INTERRUPTED'].includes(source.status) && source.phase === 'COMPLETED')) return null;
  const createdAt = timestamp(source.createdAt);
  const updatedAt = timestamp(source.updatedAt);
  const startedAt = source.startedAt === null ? null : timestamp(source.startedAt);
  const finishedAt = source.finishedAt === null ? null : timestamp(source.finishedAt);
  const terminal = ['SUCCEEDED', 'FAILED', 'INTERRUPTED'].includes(source.status);
  if (!createdAt || !updatedAt
    || (source.status === 'QUEUED' ? startedAt !== null : startedAt === null)
    || (terminal ? finishedAt === null : finishedAt !== null)) return null;

  const result = source.result === null ? null : record(source.result);
  const failure = source.failure === null ? null : record(source.failure);
  const safeResult = result === null ? null : {
    manifestIdentity: typeof result.manifestIdentity === 'string'
      && SHA256_PATTERN.test(result.manifestIdentity) ? result.manifestIdentity : null,
    itemCount: count(result.itemCount),
    byteCount: count(result.byteCount),
    verifiedAt: result.verifiedAt === null ? null : timestamp(result.verifiedAt),
    recoveryTestedAt: result.recoveryTestedAt === null ? null : timestamp(result.recoveryTestedAt),
    backupHealth: BACKUP_HEALTH.has(result.backupHealth) ? result.backupHealth : null,
    restoredCopyLifecycle: result.restoredCopyLifecycle === 'QUARANTINED_VERIFIED'
      ? result.restoredCopyLifecycle : null,
  };
  const safeFailure = failure === null || FAILURE_MESSAGES[failure.code] !== failure.message
    ? null : { code: failure.code, message: failure.message };
  if (source.failure !== null && safeFailure === null) return null;
  if (['QUEUED', 'RUNNING'].includes(source.status) && (safeResult !== null || safeFailure !== null)) return null;
  if (['FAILED', 'INTERRUPTED'].includes(source.status) && (safeResult !== null || safeFailure === null)) return null;
  if (!['FAILED', 'INTERRUPTED'].includes(source.status) && safeFailure !== null) return null;
  if (source.status === 'INTERRUPTED' && safeFailure.code !== 'OPERATION_INTERRUPTED') return null;
  if (source.status === 'SUCCEEDED' && (safeResult === null
    || safeResult.manifestIdentity === null || safeResult.itemCount === null
    || safeResult.byteCount === null || safeResult.verifiedAt === null)) return null;
  if (source.status === 'SUCCEEDED' && source.kind === 'RECOVERY_TEST'
    && (safeResult.backupHealth !== 'VERIFIED' || safeResult.recoveryTestedAt === null)) return null;
  if (source.status === 'SUCCEEDED' && ['CREATE', 'VERIFY'].includes(source.kind)
    && safeResult.backupHealth !== 'VERIFIED') return null;
  if (source.status === 'SUCCEEDED' && source.kind === 'RESTORE_AS_COPY'
    && safeResult.restoredCopyLifecycle !== 'QUARANTINED_VERIFIED') return null;

  const operationId = opaqueId(source.operationId);
  const destinationId = nullableOpaqueId(source.destinationId);
  const destinationLabel = source.destinationLabel === null ? null : safeLabel(source.destinationLabel);
  const backupId = nullableOpaqueId(source.backupId);
  const restoredCopyId = nullableOpaqueId(source.restoredCopyId);
  if ((source.destinationId !== null && destinationId === null)
    || (source.destinationLabel !== null && destinationLabel === null)
    || (source.backupId !== null && backupId === null)
    || (source.restoredCopyId !== null && restoredCopyId === null)) return null;
  if ((source.kind === 'CREATE' && (!destinationId || !destinationLabel || !backupId || restoredCopyId))
    || (['VERIFY', 'RECOVERY_TEST'].includes(source.kind)
      && (!backupId || destinationId || destinationLabel || restoredCopyId))
    || (source.kind === 'RESTORE_AS_COPY'
      && (!backupId || !destinationId || !destinationLabel || !restoredCopyId))) return null;
  return Object.freeze({
    schemaVersion: 1,
    operationId,
    kind: source.kind,
    status: source.status,
    phase: source.phase,
    progress: Object.freeze({ current: phaseIndex, total: phases.length - 1 }),
    destinationId,
    destinationLabel,
    backupId,
    restoredCopyId,
    result: safeResult === null ? null : Object.freeze(safeResult),
    failure: safeFailure === null ? null : Object.freeze(safeFailure),
    createdAt,
    startedAt,
    finishedAt,
    updatedAt,
  });
}

function backup(value, labels) {
  const source = record(value);
  const backupId = opaqueId(source.backupId);
  const destinationId = opaqueId(source.destinationId);
  const destinationLabel = safeLabel(source.destinationLabel)
    ?? safeLabel(labels.get(destinationId));
  const manifestIdentity = source.manifestIdentity === null ? null
    : typeof source.manifestIdentity === 'string' && SHA256_PATTERN.test(source.manifestIdentity)
      ? source.manifestIdentity : undefined;
  const itemCount = source.itemCount === null ? null : count(source.itemCount);
  const byteCount = source.byteCount === null ? null : count(source.byteCount);
  const createdAt = source.createdAt === null ? null : timestamp(source.createdAt);
  const registeredAt = timestamp(source.registeredAt);
  const lastVerifiedAt = source.lastVerifiedAt === null ? null : timestamp(source.lastVerifiedAt);
  const lastRecoveryTestedAt = source.lastRecoveryTestedAt === null
    ? null : timestamp(source.lastRecoveryTestedAt);
  if (source.schemaVersion !== 1 || !backupId || !destinationId || !destinationLabel
    || !BACKUP_HEALTH.has(source.health)
    || !['CREATED', 'DISCOVERED'].includes(source.provenance)
    || manifestIdentity === undefined || itemCount === null && source.itemCount !== null
    || byteCount === null && source.byteCount !== null
    || createdAt === null && source.createdAt !== null || !registeredAt
    || (source.lastVerifiedAt !== null && lastVerifiedAt === null)
    || (source.lastRecoveryTestedAt !== null && lastRecoveryTestedAt === null)
    || (source.health === 'VERIFIED'
      && (manifestIdentity === null || itemCount === null || byteCount === null
        || createdAt === null || lastVerifiedAt === null))) return null;
  return Object.freeze({
    schemaVersion: 1,
    backupId,
    destinationId,
    destinationLabel,
    provenance: source.provenance,
    health: source.health,
    manifestIdentity,
    itemCount,
    byteCount,
    createdAt,
    registeredAt,
    lastVerifiedAt,
    lastRecoveryTestedAt,
  });
}

export function unavailableBackupOverview(state = 'OPERATIONS_UNAVAILABLE') {
  return Object.freeze({
    schemaVersion: 1,
    state: state === 'OPERATOR_LOCKED' ? 'OPERATOR_LOCKED' : 'OPERATIONS_UNAVAILABLE',
    candidateStatus: BACKUP_CANDIDATE_STATUS,
    backupDestinations: Object.freeze([]),
    restoreDestinations: Object.freeze([]),
    operations: Object.freeze([]),
    backupWindow: Object.freeze({ limit: 100, truncated: false }),
    backups: Object.freeze([]),
  });
}

export function normalizeBackupOverview(value) {
  const source = record(value);
  if (source.schemaVersion !== 1 || source.candidateStatus !== BACKUP_CANDIDATE_STATUS
    || !Array.isArray(source.backupDestinations) || !Array.isArray(source.restoreDestinations)
    || !Array.isArray(source.operations) || !Array.isArray(source.backups)) {
    return unavailableBackupOverview();
  }
  const backupWindow = record(source.backupWindow);
  if (backupWindow.limit !== 100 || typeof backupWindow.truncated !== 'boolean') {
    return unavailableBackupOverview();
  }
  if (!['READY', 'NO_BACKUPS'].includes(source.state)) return unavailableBackupOverview();
  const backupDestinations = source.backupDestinations.map(destination);
  const restoreDestinations = source.restoreDestinations.map(destination);
  if (backupDestinations.includes(null) || restoreDestinations.includes(null)) return unavailableBackupOverview();
  const labels = new Map(backupDestinations.map((entry) => [entry.destinationId, entry.label]));
  const operations = source.operations.map(operation);
  const backups = source.backups.map((entry) => backup(entry, labels));
  if (source.operations.length > 100 || source.backups.length > backupWindow.limit
    || (backupWindow.truncated && source.backups.length !== backupWindow.limit)
    || operations.includes(null) || backups.includes(null)
    || new Set(backupDestinations.map(({ destinationId }) => destinationId)).size !== backupDestinations.length
    || new Set(restoreDestinations.map(({ destinationId }) => destinationId)).size !== restoreDestinations.length
    || new Set(operations.map(({ operationId }) => operationId)).size !== operations.length
    || new Set(backups.map(({ backupId }) => backupId)).size !== backups.length
    || (source.state === 'NO_BACKUPS') !== (backups.length === 0)) return unavailableBackupOverview();
  return Object.freeze({
    schemaVersion: 1,
    state: backups.length === 0 ? 'NO_BACKUPS' : 'READY',
    candidateStatus: BACKUP_CANDIDATE_STATUS,
    backupDestinations: Object.freeze(backupDestinations),
    restoreDestinations: Object.freeze(restoreDestinations),
    operations: Object.freeze(operations),
    backupWindow: Object.freeze({ limit: 100, truncated: backupWindow.truncated }),
    backups: Object.freeze(backups),
  });
}

export function normalizeAcceptedBackupOperation(value, expectedKind) {
  const source = record(value);
  if (source.schemaVersion !== 1 || source.candidateStatus !== BACKUP_CANDIDATE_STATUS
    || !OPERATION_KINDS.has(expectedKind)) return null;
  const accepted = operation(source.operation);
  return accepted?.kind === expectedKind ? accepted : null;
}

export function currentBackupOperation(overview) {
  const operations = overview?.operations ?? [];
  return operations.find(({ status }) => status === 'RUNNING')
    ?? operations.filter(({ status }) => status === 'QUEUED').at(-1)
    ?? operations[0]
    ?? null;
}

const RUNNING_PHASE_COPY = Object.freeze({
  CREATE: Object.freeze({
    RESERVED: 'Checking current work',
    SOURCE_VERIFIED: 'Creating a consistent snapshot',
    DB_SNAPSHOTTED: 'Copying protected files',
    CAS_COPIED: 'Writing the backup manifest',
    MANIFEST_WRITTEN: 'Verifying the backup',
    SNAPSHOT_VERIFIED: 'Closing the backup durably',
    DURABLY_CLOSED: 'Publishing the verified backup',
    PUBLISHED: 'Recording verified completion',
  }),
  VERIFY: Object.freeze({
    RESERVED: 'Locating the selected backup',
    BACKUP_RESOLVED: 'Verifying the backup',
    CONTENT_VERIFIED: 'Recording verified completion',
  }),
  RECOVERY_TEST: Object.freeze({
    RESERVED: 'Verifying the selected backup',
    BACKUP_VERIFIED: 'Creating an isolated recovery copy',
    COPY_STAGED: 'Verifying the recovery copy',
    COPY_VERIFIED: 'Opening the copy read-only',
    READ_ONLY_OPENED: 'Comparing recovered work',
    PARITY_VERIFIED: 'Removing the temporary test copy',
    TEST_COPY_CLEANED: 'Recording the recovery result',
  }),
  RESTORE_AS_COPY: Object.freeze({
    RESERVED: 'Verifying the selected backup',
    BACKUP_VERIFIED: 'Creating a new working copy',
    COPY_STAGED: 'Verifying the restored copy',
    COPY_VERIFIED: 'Protecting the restored copy',
    QUARANTINE_WRITTEN: 'Closing the restored copy durably',
    DURABLY_CLOSED: 'Publishing the restored copy',
    PUBLISHED: 'Recording the inactive restored copy',
  }),
});

export function backupOperationPresentation(value) {
  if (!value) return null;
  if (value.status === 'QUEUED') return Object.freeze({
    tone: 'pending',
    title: 'Backup request saved. Waiting to start.',
    consequence: 'Navigation or disconnect does not cancel this durable request.',
  });
  if (value.status === 'RUNNING') return Object.freeze({
    tone: 'running',
    title: RUNNING_PHASE_COPY[value.kind]?.[value.phase] ?? 'Completing the backup action',
    consequence: `Step ${value.progress.current + 1} of ${value.progress.total}. The active workspace remains authoritative.`,
  });
  if (value.status === 'FAILED') return Object.freeze({
    tone: 'problem',
    title: 'Backup action did not complete.',
    consequence: 'Your active work and earlier backups were not changed.',
  });
  if (value.status === 'INTERRUPTED') return Object.freeze({
    tone: 'problem',
    title: 'The interrupted action could not be resumed safely.',
    consequence: 'Its incomplete stage remains unusable; no cleanup control is exposed here.',
  });
  if (value.kind === 'RECOVERY_TEST') return Object.freeze({
    tone: 'healthy',
    title: 'Recovery test passed.',
    consequence: 'This backup can be restored as a new copy.',
  });
  if (value.kind === 'RESTORE_AS_COPY') return Object.freeze({
    tone: 'healthy',
    title: 'Restored copy is ready for inspection.',
    consequence: 'It is not active. This candidate provides no activation control.',
  });
  return Object.freeze({
    tone: 'healthy',
    title: 'Backup complete and verified.',
    consequence: 'The verified backup remains separate from the active workspace.',
  });
}

export function backupHealthPresentation(value) {
  if (value.health === 'VERIFIED') return Object.freeze({
    tone: 'healthy', label: 'Verified',
    title: value.lastRecoveryTestedAt ? 'Recovery test passed.' : 'Backup complete and verified.',
    consequence: value.lastRecoveryTestedAt
      ? 'This backup can be restored as a new copy.'
      : 'You can verify it again, test recovery, or restore an inactive copy.',
  });
  if (value.health === 'SUSPECT' || value.health === 'MISSING') return Object.freeze({
    tone: 'problem', label: value.health === 'MISSING' ? 'Missing' : 'Needs attention',
    title: 'This backup needs attention. Do not use it for recovery.',
    consequence: 'Verify again to re-check the exact backup. Recovery and restore remain disabled.',
  });
  return Object.freeze({
    tone: 'pending', label: 'Verification required',
    title: 'This backup has not been verified yet.',
    consequence: 'Verify it before recovery testing or restore-as-copy.',
  });
}

export function backupAllowedActions(value) {
  const verified = value?.health === 'VERIFIED';
  return Object.freeze({
    verify: Boolean(value),
    recoveryTest: verified,
    restoreAsCopy: verified,
  });
}
