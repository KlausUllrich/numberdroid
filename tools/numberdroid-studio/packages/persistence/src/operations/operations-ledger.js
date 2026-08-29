import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { StudioError, invariant } from '../../../domain/src/errors.js';
import { createBetterSqliteDatabase } from '../sqlite/sqlite-driver.js';

const LEDGER_FILENAME = 'operations.sqlite';
const CONTROL_SCHEMA_VERSION = 1;
const CONTROL_MIGRATION_NAME = 'operations_control_v1';
const CONTROL_SCHEMA_V1_CHECKSUM = '37976bda3bbd6e76216c10aa73ae82e98d3b192956c06a3fd24b54cd739f78c0';

export const OPERATION_STATUSES = Object.freeze([
  'QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'INTERRUPTED',
]);

export const OPERATION_PHASES = Object.freeze({
  CREATE: Object.freeze([
    'RESERVED', 'SOURCE_VERIFIED', 'DB_SNAPSHOTTED', 'CAS_COPIED',
    'MANIFEST_WRITTEN', 'SNAPSHOT_VERIFIED', 'DURABLY_CLOSED', 'PUBLISHED',
    'COMPLETED',
  ]),
  VERIFY: Object.freeze([
    'RESERVED', 'BACKUP_RESOLVED', 'CONTENT_VERIFIED', 'COMPLETED',
  ]),
  RECOVERY_TEST: Object.freeze([
    'RESERVED', 'BACKUP_VERIFIED', 'COPY_STAGED', 'COPY_VERIFIED',
    'READ_ONLY_OPENED', 'PARITY_VERIFIED', 'TEST_COPY_CLEANED', 'COMPLETED',
  ]),
  RESTORE_AS_COPY: Object.freeze([
    'RESERVED', 'BACKUP_VERIFIED', 'COPY_STAGED', 'COPY_VERIFIED',
    'QUARANTINE_WRITTEN', 'DURABLY_CLOSED', 'PUBLISHED', 'COMPLETED',
  ]),
});

export const BACKUP_HEALTH_STATES = Object.freeze([
  'UNVERIFIED', 'VERIFIED', 'SUSPECT', 'MISSING',
]);

const OPERATION_KINDS = Object.freeze(Object.keys(OPERATION_PHASES));
const STAGE_KINDS = Object.freeze(['BACKUP', 'RESTORE_COPY', 'RECOVERY_TEST']);
const STAGE_DISPOSITIONS = Object.freeze(['ACTIVE', 'INERT', 'ORPHANED']);
const FAILURE_CODES = new Set([
  'WORKSPACE_OPERATOR_REQUIRED',
  'WORKSPACE_OPERATOR_FORBIDDEN',
  'OPERATIONS_UNAVAILABLE',
  'OPERATION_NOT_FOUND',
  'OPERATION_IDEMPOTENCY_CONFLICT',
  'OPERATION_STATE_CONFLICT',
  'OPERATION_LEASE_LOST',
  'BACKUP_DESTINATION_UNKNOWN',
  'BACKUP_PATH_UNSAFE',
  'BACKUP_DESTINATION_CONFLICT',
  'BACKUP_SOURCE_INTEGRITY_FAILED',
  'BACKUP_SNAPSHOT_FAILED',
  'BACKUP_SNAPSHOT_INTEGRITY_FAILED',
  'BACKUP_SCHEMA_UNSUPPORTED',
  'BACKUP_CONTENT_MISMATCH',
  'BACKUP_DURABILITY_FAILED',
  'BACKUP_PUBLISH_FAILED',
  'RECOVERY_TEST_FAILED',
  'RESTORE_COPY_FAILED',
  'RESTORED_COPY_QUARANTINED',
  'OPERATION_INTERRUPTED',
]);

const OPAQUE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const FILENAME_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const FAILURE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,99}$/;

const FAILURE_MESSAGES = Object.freeze({
  WORKSPACE_OPERATOR_REQUIRED: 'A local workspace-operator session is required.',
  WORKSPACE_OPERATOR_FORBIDDEN: 'This session cannot manage backups.',
  OPERATIONS_UNAVAILABLE: 'Backup operations are unavailable.',
  OPERATION_NOT_FOUND: 'The requested backup operation was not found.',
  OPERATION_IDEMPOTENCY_CONFLICT: 'The idempotency key was reused for a different request.',
  OPERATION_STATE_CONFLICT: 'The backup operation is not in the required state.',
  OPERATION_LEASE_LOST: 'The backup worker no longer owns this operation.',
  BACKUP_DESTINATION_UNKNOWN: 'The configured backup destination is unavailable.',
  BACKUP_PATH_UNSAFE: 'The configured backup destination failed its safety check.',
  BACKUP_DESTINATION_CONFLICT: 'The reserved backup output already exists.',
  BACKUP_SOURCE_INTEGRITY_FAILED: 'The active workspace did not pass its integrity check.',
  BACKUP_SNAPSHOT_FAILED: 'The backup snapshot could not be created.',
  BACKUP_SNAPSHOT_INTEGRITY_FAILED: 'The new backup did not pass its integrity check.',
  BACKUP_SCHEMA_UNSUPPORTED: 'This backup schema is not supported.',
  BACKUP_CONTENT_MISMATCH: 'The backup differs from its verified contents.',
  BACKUP_DURABILITY_FAILED: 'Durable backup publication could not be proved.',
  BACKUP_PUBLISH_FAILED: 'The verified backup could not be published.',
  RECOVERY_TEST_FAILED: 'The recovery test did not complete.',
  RESTORE_COPY_FAILED: 'A restored copy could not be created safely.',
  RESTORED_COPY_QUARANTINED: 'The restored copy is quarantined and cannot be opened normally.',
  OPERATION_INTERRUPTED: 'The interrupted operation could not be resumed safely.',
});

const CONTROL_SCHEMA_V1_SQL = `
CREATE TABLE operations (
  operation_id TEXT PRIMARY KEY CHECK (length(operation_id) BETWEEN 1 AND 96),
  kind TEXT NOT NULL CHECK (kind IN ('CREATE', 'VERIFY', 'RECOVERY_TEST', 'RESTORE_AS_COPY')),
  idempotency_key TEXT NOT NULL UNIQUE CHECK (length(idempotency_key) BETWEEN 1 AND 128),
  request_fingerprint TEXT NOT NULL CHECK (length(request_fingerprint) = 64 AND request_fingerprint = lower(request_fingerprint) AND request_fingerprint NOT GLOB '*[^0-9a-f]*'),
  creator_subject TEXT NOT NULL CHECK (length(creator_subject) BETWEEN 1 AND 128),
  destination_id TEXT CHECK (destination_id IS NULL OR length(destination_id) BETWEEN 1 AND 128),
  source_backup_id TEXT CHECK (source_backup_id IS NULL OR length(source_backup_id) BETWEEN 1 AND 96),
  output_id TEXT UNIQUE CHECK (output_id IS NULL OR length(output_id) BETWEEN 1 AND 96),
  status TEXT NOT NULL CHECK (status IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'INTERRUPTED')),
  phase TEXT NOT NULL,
  progress_current INTEGER NOT NULL CHECK (progress_current >= 0),
  progress_total INTEGER NOT NULL CHECK (progress_total >= 1 AND progress_current <= progress_total),
  lease_owner TEXT CHECK (lease_owner IS NULL OR length(lease_owner) BETWEEN 1 AND 128),
  lease_generation INTEGER NOT NULL DEFAULT 0 CHECK (lease_generation >= 0),
  lease_expires_at TEXT,
  failure_code TEXT CHECK (failure_code IS NULL OR length(failure_code) BETWEEN 1 AND 100),
  result_manifest_sha256 TEXT CHECK (result_manifest_sha256 IS NULL OR (length(result_manifest_sha256) = 64 AND result_manifest_sha256 NOT GLOB '*[^0-9a-f]*')),
  result_artifact_count INTEGER CHECK (result_artifact_count IS NULL OR result_artifact_count >= 0),
  result_byte_count INTEGER CHECK (result_byte_count IS NULL OR result_byte_count >= 0),
  result_verified_at TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  updated_at TEXT NOT NULL,
  finished_at TEXT,
  FOREIGN KEY (source_backup_id) REFERENCES backups(backup_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CHECK (
    (kind = 'CREATE' AND destination_id IS NOT NULL AND source_backup_id IS NULL AND output_id IS NOT NULL)
    OR (kind IN ('VERIFY', 'RECOVERY_TEST') AND destination_id IS NULL AND source_backup_id IS NOT NULL AND output_id IS NULL)
    OR (kind = 'RESTORE_AS_COPY' AND destination_id IS NOT NULL AND source_backup_id IS NOT NULL AND output_id IS NOT NULL)
  ),
  CHECK (
    (kind = 'CREATE' AND phase IN ('RESERVED', 'SOURCE_VERIFIED', 'DB_SNAPSHOTTED', 'CAS_COPIED', 'MANIFEST_WRITTEN', 'SNAPSHOT_VERIFIED', 'DURABLY_CLOSED', 'PUBLISHED', 'COMPLETED'))
    OR (kind = 'VERIFY' AND phase IN ('RESERVED', 'BACKUP_RESOLVED', 'CONTENT_VERIFIED', 'COMPLETED'))
    OR (kind = 'RECOVERY_TEST' AND phase IN ('RESERVED', 'BACKUP_VERIFIED', 'COPY_STAGED', 'COPY_VERIFIED', 'READ_ONLY_OPENED', 'PARITY_VERIFIED', 'TEST_COPY_CLEANED', 'COMPLETED'))
    OR (kind = 'RESTORE_AS_COPY' AND phase IN ('RESERVED', 'BACKUP_VERIFIED', 'COPY_STAGED', 'COPY_VERIFIED', 'QUARANTINE_WRITTEN', 'DURABLY_CLOSED', 'PUBLISHED', 'COMPLETED'))
  ),
  CHECK ((status = 'SUCCEEDED') = (phase = 'COMPLETED')),
  CHECK ((status = 'RUNNING') = (lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL)),
  CHECK ((status IN ('SUCCEEDED', 'FAILED', 'INTERRUPTED')) = (finished_at IS NOT NULL)),
  CHECK ((status IN ('FAILED', 'INTERRUPTED')) = (failure_code IS NOT NULL))
) STRICT;

CREATE TABLE operation_events (
  operation_id TEXT NOT NULL,
  sequence INTEGER NOT NULL CHECK (sequence >= 1),
  event_code TEXT NOT NULL CHECK (event_code IN ('RESERVED', 'CLAIMED', 'RECONCILED_CLAIM', 'PHASE_ADVANCED', 'LEASE_RENEWED', 'SUCCEEDED', 'FAILED', 'INTERRUPTED')),
  status TEXT NOT NULL CHECK (status IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'INTERRUPTED')),
  phase TEXT NOT NULL,
  progress_current INTEGER NOT NULL CHECK (progress_current >= 0),
  progress_total INTEGER NOT NULL CHECK (progress_total >= 1 AND progress_current <= progress_total),
  lease_generation INTEGER NOT NULL CHECK (lease_generation >= 0),
  failure_code TEXT CHECK (failure_code IS NULL OR length(failure_code) BETWEEN 1 AND 100),
  occurred_at TEXT NOT NULL,
  PRIMARY KEY (operation_id, sequence),
  FOREIGN KEY (operation_id) REFERENCES operations(operation_id) ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TABLE staged_outputs (
  stage_id TEXT PRIMARY KEY CHECK (length(stage_id) BETWEEN 1 AND 128),
  operation_id TEXT UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('BACKUP', 'RESTORE_COPY', 'RECOVERY_TEST')),
  root_key TEXT NOT NULL CHECK (length(root_key) BETWEEN 1 AND 128),
  destination_id TEXT CHECK (destination_id IS NULL OR length(destination_id) BETWEEN 1 AND 128),
  stage_basename TEXT NOT NULL CHECK (length(stage_basename) BETWEEN 1 AND 160 AND instr(stage_basename, '/') = 0 AND instr(stage_basename, char(92)) = 0),
  final_basename TEXT CHECK (final_basename IS NULL OR (length(final_basename) BETWEEN 1 AND 160 AND instr(final_basename, '/') = 0 AND instr(final_basename, char(92)) = 0)),
  root_identity_sha256 TEXT NOT NULL CHECK (length(root_identity_sha256) = 64 AND root_identity_sha256 NOT GLOB '*[^0-9a-f]*'),
  filesystem_identity_sha256 TEXT NOT NULL CHECK (length(filesystem_identity_sha256) = 64 AND filesystem_identity_sha256 NOT GLOB '*[^0-9a-f]*'),
  stage_identity_sha256 TEXT CHECK (stage_identity_sha256 IS NULL OR (length(stage_identity_sha256) = 64 AND stage_identity_sha256 NOT GLOB '*[^0-9a-f]*')),
  final_identity_sha256 TEXT CHECK (final_identity_sha256 IS NULL OR (length(final_identity_sha256) = 64 AND final_identity_sha256 NOT GLOB '*[^0-9a-f]*')),
  disposition TEXT NOT NULL CHECK (disposition IN ('ACTIVE', 'INERT', 'ORPHANED')),
  updated_at TEXT NOT NULL,
  FOREIGN KEY (operation_id) REFERENCES operations(operation_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  UNIQUE (root_key, stage_basename),
  UNIQUE (root_key, final_basename),
  CHECK (
    (kind = 'BACKUP' AND destination_id IS NOT NULL AND root_key = destination_id AND final_basename IS NOT NULL)
    OR (kind = 'RESTORE_COPY' AND destination_id IS NOT NULL AND root_key = destination_id AND final_basename IS NOT NULL)
    OR (kind = 'RECOVERY_TEST' AND destination_id IS NULL AND root_key = 'control.recovery-tests' AND final_basename IS NULL)
  ),
  CHECK (disposition = 'ORPHANED' OR operation_id IS NOT NULL)
) STRICT;

CREATE TABLE backups (
  backup_id TEXT PRIMARY KEY CHECK (length(backup_id) BETWEEN 1 AND 96),
  destination_id TEXT NOT NULL CHECK (length(destination_id) BETWEEN 1 AND 128),
  root_key TEXT NOT NULL CHECK (length(root_key) BETWEEN 1 AND 128),
  final_basename TEXT NOT NULL CHECK (length(final_basename) BETWEEN 1 AND 160 AND instr(final_basename, '/') = 0 AND instr(final_basename, char(92)) = 0),
  final_identity_sha256 TEXT CHECK (final_identity_sha256 IS NULL OR (length(final_identity_sha256) = 64 AND final_identity_sha256 NOT GLOB '*[^0-9a-f]*')),
  provenance TEXT NOT NULL CHECK (provenance IN ('CREATED', 'DISCOVERED')),
  health TEXT NOT NULL CHECK (health IN ('UNVERIFIED', 'VERIFIED', 'SUSPECT', 'MISSING')),
  manifest_sha256 TEXT CHECK (manifest_sha256 IS NULL OR (length(manifest_sha256) = 64 AND manifest_sha256 NOT GLOB '*[^0-9a-f]*')),
  database_sha256 TEXT CHECK (database_sha256 IS NULL OR (length(database_sha256) = 64 AND database_sha256 NOT GLOB '*[^0-9a-f]*')),
  artifact_count INTEGER CHECK (artifact_count IS NULL OR artifact_count >= 0),
  byte_count INTEGER CHECK (byte_count IS NULL OR byte_count >= 0),
  created_operation_id TEXT UNIQUE,
  created_at TEXT,
  registered_at TEXT NOT NULL,
  last_verified_at TEXT,
  last_recovery_tested_at TEXT,
  FOREIGN KEY (created_operation_id) REFERENCES operations(operation_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  UNIQUE (root_key, final_basename),
  CHECK (root_key = destination_id),
  CHECK ((health = 'VERIFIED') <= (manifest_sha256 IS NOT NULL AND database_sha256 IS NOT NULL AND final_identity_sha256 IS NOT NULL)),
  CHECK ((provenance = 'CREATED') = (created_operation_id IS NOT NULL))
) STRICT;

CREATE TABLE restored_copies (
  copy_id TEXT PRIMARY KEY CHECK (length(copy_id) BETWEEN 1 AND 96),
  source_backup_id TEXT NOT NULL,
  destination_id TEXT NOT NULL CHECK (length(destination_id) BETWEEN 1 AND 128),
  root_key TEXT NOT NULL CHECK (length(root_key) BETWEEN 1 AND 128),
  final_basename TEXT NOT NULL CHECK (length(final_basename) BETWEEN 1 AND 160 AND instr(final_basename, '/') = 0 AND instr(final_basename, char(92)) = 0),
  final_identity_sha256 TEXT NOT NULL CHECK (length(final_identity_sha256) = 64 AND final_identity_sha256 NOT GLOB '*[^0-9a-f]*'),
  lifecycle TEXT NOT NULL CHECK (lifecycle = 'QUARANTINED_VERIFIED'),
  manifest_sha256 TEXT NOT NULL CHECK (length(manifest_sha256) = 64 AND manifest_sha256 NOT GLOB '*[^0-9a-f]*'),
  artifact_count INTEGER NOT NULL CHECK (artifact_count >= 0),
  byte_count INTEGER NOT NULL CHECK (byte_count >= 0),
  created_operation_id TEXT NOT NULL UNIQUE,
  verified_at TEXT NOT NULL,
  FOREIGN KEY (source_backup_id) REFERENCES backups(backup_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (created_operation_id) REFERENCES operations(operation_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  UNIQUE (root_key, final_basename),
  CHECK (root_key = destination_id)
) STRICT;

CREATE TRIGGER operations_immutable_coordinates
BEFORE UPDATE ON operations
WHEN OLD.operation_id IS NOT NEW.operation_id
  OR OLD.kind IS NOT NEW.kind
  OR OLD.idempotency_key IS NOT NEW.idempotency_key
  OR OLD.request_fingerprint IS NOT NEW.request_fingerprint
  OR OLD.creator_subject IS NOT NEW.creator_subject
  OR OLD.destination_id IS NOT NEW.destination_id
  OR OLD.source_backup_id IS NOT NEW.source_backup_id
  OR OLD.output_id IS NOT NEW.output_id
  OR OLD.created_at IS NOT NEW.created_at
BEGIN
  SELECT RAISE(ABORT, 'operation immutable coordinates changed');
END;

CREATE TRIGGER operation_events_no_update
BEFORE UPDATE ON operation_events BEGIN
  SELECT RAISE(ABORT, 'operation events are append-only');
END;

CREATE TRIGGER operation_events_no_delete
BEFORE DELETE ON operation_events BEGIN
  SELECT RAISE(ABORT, 'operation events are append-only');
END;

CREATE TRIGGER staged_outputs_immutable_coordinates
BEFORE UPDATE ON staged_outputs
WHEN OLD.stage_id IS NOT NEW.stage_id
  OR OLD.operation_id IS NOT NEW.operation_id
  OR OLD.kind IS NOT NEW.kind
  OR OLD.root_key IS NOT NEW.root_key
  OR OLD.destination_id IS NOT NEW.destination_id
  OR OLD.stage_basename IS NOT NEW.stage_basename
  OR OLD.final_basename IS NOT NEW.final_basename
  OR OLD.root_identity_sha256 IS NOT NEW.root_identity_sha256
  OR OLD.filesystem_identity_sha256 IS NOT NEW.filesystem_identity_sha256
BEGIN
  SELECT RAISE(ABORT, 'stage immutable coordinates changed');
END;

CREATE TRIGGER backups_immutable_coordinates
BEFORE UPDATE ON backups
WHEN OLD.backup_id IS NOT NEW.backup_id
  OR OLD.destination_id IS NOT NEW.destination_id
  OR OLD.root_key IS NOT NEW.root_key
  OR OLD.final_basename IS NOT NEW.final_basename
  OR OLD.provenance IS NOT NEW.provenance
  OR OLD.created_operation_id IS NOT NEW.created_operation_id
  OR OLD.created_at IS NOT NEW.created_at
  OR OLD.registered_at IS NOT NEW.registered_at
BEGIN
  SELECT RAISE(ABORT, 'backup immutable coordinates changed');
END;

CREATE TRIGGER restored_copies_no_update
BEFORE UPDATE ON restored_copies BEGIN
  SELECT RAISE(ABORT, 'restored copies are immutable');
END;
`;

function migrationChecksum(sql) {
  return createHash('sha256').update(sql.replaceAll('\r\n', '\n')).digest('hex');
}

function requireOpaqueId(value, field) {
  invariant(typeof value === 'string' && OPAQUE_ID_PATTERN.test(value), 'VALIDATION_ERROR', `${field} must be an opaque ID.`);
  return value;
}

function requireFilenameId(value, field) {
  invariant(typeof value === 'string' && FILENAME_ID_PATTERN.test(value), 'VALIDATION_ERROR', `${field} must be a filename-safe opaque ID.`);
  return value;
}

function requireOptionalOpaqueId(value, field) {
  return value === null || value === undefined ? null : requireOpaqueId(value, field);
}

function requireSha256(value, field, { optional = false } = {}) {
  if (optional && (value === null || value === undefined)) return null;
  invariant(typeof value === 'string' && SHA256_PATTERN.test(value), 'VALIDATION_ERROR', `${field} must be lowercase SHA-256 hex.`);
  return value;
}

function requireTimestamp(value, field, { optional = false } = {}) {
  if (optional && (value === null || value === undefined)) return null;
  invariant(
    typeof value === 'string' && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value,
    'VALIDATION_ERROR',
    `${field} must be a canonical ISO date-time.`,
  );
  return value;
}

function requireCount(value, field, { optional = false } = {}) {
  if (optional && (value === null || value === undefined)) return null;
  invariant(Number.isSafeInteger(value) && value >= 0, 'VALIDATION_ERROR', `${field} must be a non-negative safe integer.`);
  return value;
}

function requireFailureCode(value) {
  invariant(typeof value === 'string' && FAILURE_CODE_PATTERN.test(value) && FAILURE_CODES.has(value), 'VALIDATION_ERROR', 'failureCode is not an allowlisted O1 failure code.');
  return value;
}

function transaction(database, operation) {
  database.exec('BEGIN IMMEDIATE');
  try {
    const result = operation();
    database.exec('COMMIT');
    return result;
  } catch (error) {
    try { database.exec('ROLLBACK'); } catch {}
    throw error;
  }
}

function phaseTotal(kind) {
  return OPERATION_PHASES[kind].length - 1;
}

function operationProjection(row) {
  if (!row) return null;
  const result = row.result_manifest_sha256 === null
    && row.result_artifact_count === null
    && row.result_byte_count === null
    && row.result_verified_at === null
    ? null
    : {
      manifestSha256: row.result_manifest_sha256,
      artifactCount: row.result_artifact_count === null ? null : Number(row.result_artifact_count),
      byteCount: row.result_byte_count === null ? null : Number(row.result_byte_count),
      verifiedAt: row.result_verified_at,
    };
  return {
    schemaVersion: 1,
    operationId: row.operation_id,
    kind: row.kind,
    status: row.status,
    phase: row.phase,
    progress: { current: Number(row.progress_current), total: Number(row.progress_total) },
    destinationId: row.destination_id,
    backupId: row.source_backup_id,
    outputId: row.output_id,
    result,
    failure: row.failure_code === null ? null : {
      code: row.failure_code,
      message: FAILURE_MESSAGES[row.failure_code] ?? 'The backup operation failed safely.',
    },
    createdAt: row.created_at,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    finishedAt: row.finished_at,
  };
}

function workerProjection(row) {
  if (!row) return null;
  return {
    ...operationProjection(row),
    requestFingerprint: row.request_fingerprint,
    creatorSubject: row.creator_subject,
    lease: row.lease_owner === null ? null : {
      owner: row.lease_owner,
      generation: Number(row.lease_generation),
      expiresAt: row.lease_expires_at,
    },
  };
}

function backupProjection(row) {
  if (!row) return null;
  return {
    schemaVersion: 1,
    backupId: row.backup_id,
    destinationId: row.destination_id,
    provenance: row.provenance,
    health: row.health,
    manifestSha256: row.manifest_sha256,
    databaseSha256: row.database_sha256,
    artifactCount: row.artifact_count === null ? null : Number(row.artifact_count),
    byteCount: row.byte_count === null ? null : Number(row.byte_count),
    createdAt: row.created_at,
    registeredAt: row.registered_at,
    lastVerifiedAt: row.last_verified_at,
    lastRecoveryTestedAt: row.last_recovery_tested_at,
  };
}

function restoredCopyProjection(row) {
  if (!row) return null;
  return {
    schemaVersion: 1,
    copyId: row.copy_id,
    sourceBackupId: row.source_backup_id,
    destinationId: row.destination_id,
    lifecycle: row.lifecycle,
    manifestSha256: row.manifest_sha256,
    artifactCount: Number(row.artifact_count),
    byteCount: Number(row.byte_count),
    verifiedAt: row.verified_at,
  };
}

function stageRecord(row) {
  if (!row) return null;
  return {
    schemaVersion: 1,
    stageId: row.stage_id,
    operationId: row.operation_id,
    kind: row.kind,
    rootKey: row.root_key,
    destinationId: row.destination_id,
    stageBasename: row.stage_basename,
    finalBasename: row.final_basename,
    rootIdentitySha256: row.root_identity_sha256,
    filesystemIdentitySha256: row.filesystem_identity_sha256,
    stageIdentitySha256: row.stage_identity_sha256,
    finalIdentitySha256: row.final_identity_sha256,
    disposition: row.disposition,
    updatedAt: row.updated_at,
  };
}

function backupWorkerRecord(row) {
  if (!row) return null;
  return {
    ...backupProjection(row),
    rootKey: row.root_key,
    finalBasename: row.final_basename,
    finalIdentitySha256: row.final_identity_sha256,
    createdOperationId: row.created_operation_id,
  };
}

function restoredCopyWorkerRecord(row) {
  if (!row) return null;
  return {
    ...restoredCopyProjection(row),
    rootKey: row.root_key,
    finalBasename: row.final_basename,
    finalIdentitySha256: row.final_identity_sha256,
    createdOperationId: row.created_operation_id,
  };
}

function nextEventSequence(database, operationId) {
  return Number(database.prepare(`
    SELECT coalesce(max(sequence), 0) + 1 AS next_sequence
    FROM operation_events WHERE operation_id = ?
  `).get(operationId).next_sequence);
}

function insertEvent(database, row, eventCode, occurredAt) {
  database.prepare(`
    INSERT INTO operation_events(
      operation_id, sequence, event_code, status, phase, progress_current,
      progress_total, lease_generation, failure_code, occurred_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    row.operation_id,
    nextEventSequence(database, row.operation_id),
    eventCode,
    row.status,
    row.phase,
    row.progress_current,
    row.progress_total,
    row.lease_generation,
    row.failure_code,
    occurredAt,
  );
}

function operationRow(database, operationId) {
  return database.prepare('SELECT * FROM operations WHERE operation_id = ?').get(operationId) ?? null;
}

function assertClaim(row, { workerId, expectedGeneration }) {
  invariant(row, 'OPERATION_NOT_FOUND', 'The backup operation does not exist.');
  invariant(
    row.status === 'RUNNING'
      && row.lease_owner === workerId
      && Number(row.lease_generation) === expectedGeneration,
    'OPERATION_LEASE_LOST',
    'The worker no longer owns this backup operation.',
  );
}

function operationCoordinates(request) {
  const kind = request.kind;
  invariant(OPERATION_KINDS.includes(kind), 'VALIDATION_ERROR', 'Unsupported backup operation kind.');
  const destinationId = requireOptionalOpaqueId(request.destinationId, 'destinationId');
  const sourceBackupId = request.backupId === null || request.backupId === undefined
    ? null
    : requireFilenameId(request.backupId, 'backupId');
  const outputId = request.outputId === null || request.outputId === undefined
    ? null
    : requireFilenameId(request.outputId, 'outputId');
  if (kind === 'CREATE') {
    invariant(destinationId !== null && sourceBackupId === null && outputId !== null, 'VALIDATION_ERROR', 'CREATE requires destinationId and outputId only.');
  } else if (['VERIFY', 'RECOVERY_TEST'].includes(kind)) {
    invariant(destinationId === null && sourceBackupId !== null && outputId === null, 'VALIDATION_ERROR', `${kind} requires backupId only.`);
  } else {
    invariant(destinationId !== null && sourceBackupId !== null && outputId !== null, 'VALIDATION_ERROR', 'RESTORE_AS_COPY requires backupId, destinationId, and outputId.');
  }
  return { kind, destinationId, sourceBackupId, outputId };
}

function sameCoordinates(row, coordinates) {
  return row.kind === coordinates.kind
    && row.destination_id === coordinates.destinationId
    && row.source_backup_id === coordinates.sourceBackupId;
}

function expectedStageCoordinates(operation, kind) {
  if (kind === 'BACKUP') {
    invariant(operation.kind === 'CREATE', 'OPERATION_STATE_CONFLICT', 'Only CREATE can own a backup stage.');
    return {
      destinationId: operation.destination_id,
      stageBasename: `.numberdroid-backup-stage-${operation.operation_id}`,
      finalBasename: `backup-${operation.output_id}`,
    };
  }
  if (kind === 'RESTORE_COPY') {
    invariant(operation.kind === 'RESTORE_AS_COPY', 'OPERATION_STATE_CONFLICT', 'Only RESTORE_AS_COPY can own a restore stage.');
    return {
      destinationId: operation.destination_id,
      stageBasename: `.numberdroid-restore-stage-${operation.operation_id}`,
      finalBasename: `workspace-copy-${operation.output_id}`,
    };
  }
  invariant(operation.kind === 'RECOVERY_TEST', 'OPERATION_STATE_CONFLICT', 'Only RECOVERY_TEST can own a recovery stage.');
  return {
    destinationId: null,
    stageBasename: `.numberdroid-recovery-stage-${operation.operation_id}`,
    finalBasename: null,
  };
}

function validateMigration(database) {
  const actualChecksum = migrationChecksum(CONTROL_SCHEMA_V1_SQL);
  invariant(actualChecksum === CONTROL_SCHEMA_V1_CHECKSUM, 'MIGRATION_CHECKSUM_MISMATCH', 'Control schema v1 differs from its fixed checksum.', {
    expected: CONTROL_SCHEMA_V1_CHECKSUM,
    actual: actualChecksum,
  });
  database.exec(`
    CREATE TABLE IF NOT EXISTS control_schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL
    ) STRICT
  `);
  const userVersion = Number(database.pragma('user_version', { simple: true }));
  invariant(userVersion <= CONTROL_SCHEMA_VERSION, 'DATABASE_SCHEMA_TOO_NEW', 'Operations control schema is newer than this Studio build.');
  const applied = database.prepare('SELECT version, name, checksum FROM control_schema_migrations ORDER BY version').all();
  for (const row of applied) {
    invariant(Number(row.version) === 1 && row.name === CONTROL_MIGRATION_NAME, 'UNKNOWN_APPLIED_MIGRATION', 'The operations ledger contains an unknown migration.');
    invariant(row.checksum === CONTROL_SCHEMA_V1_CHECKSUM, 'MIGRATION_CHECKSUM_MISMATCH', 'Applied operations migration checksum differs.');
  }
  if (userVersion === 0) {
    invariant(applied.length === 0, 'MIGRATION_CHECKSUM_MISMATCH', 'The operations migration ledger is inconsistent.');
    database.exec('BEGIN EXCLUSIVE');
    try {
      database.exec(CONTROL_SCHEMA_V1_SQL);
      database.prepare(`
        INSERT INTO control_schema_migrations(version, name, checksum, applied_at)
        VALUES (1, ?, ?, ?)
      `).run(CONTROL_MIGRATION_NAME, CONTROL_SCHEMA_V1_CHECKSUM, new Date().toISOString());
      database.pragma('user_version = 1');
      database.exec('COMMIT');
    } catch (error) {
      try { database.exec('ROLLBACK'); } catch {}
      throw error;
    }
  } else {
    invariant(applied.length === 1, 'MIGRATION_CHECKSUM_MISMATCH', 'The operations migration record is missing.');
  }
  invariant(database.pragma('foreign_key_check').length === 0, 'OPERATIONS_UNAVAILABLE', 'The operations ledger has broken references.');
}

export class OperationsLedger {
  #database;
  #closed = false;

  static async open({
    controlRoot,
    databaseFactory = createBetterSqliteDatabase,
    busyTimeoutMs = 5000,
  }) {
    invariant(typeof controlRoot === 'string' && controlRoot.length > 0, 'VALIDATION_ERROR', 'controlRoot is required.');
    invariant(Number.isSafeInteger(busyTimeoutMs) && busyTimeoutMs >= 0, 'VALIDATION_ERROR', 'busyTimeoutMs must be a non-negative integer.');
    const filename = join(resolve(controlRoot), LEDGER_FILENAME);
    let database;
    try {
      database = databaseFactory(filename, { timeout: busyTimeoutMs });
      database.exec(`PRAGMA busy_timeout = ${busyTimeoutMs}`);
      database.pragma('foreign_keys = ON');
      const journalMode = String(database.pragma('journal_mode = WAL', { simple: true })).toLowerCase();
      invariant(journalMode === 'wal', 'OPERATIONS_UNAVAILABLE', 'The operations ledger requires SQLite WAL mode.');
      database.pragma('synchronous = FULL');
      validateMigration(database);
      return new OperationsLedger(database);
    } catch (error) {
      try { database?.close(); } catch {}
      if (error instanceof StudioError) throw error;
      throw new StudioError('OPERATIONS_UNAVAILABLE', 'The operations ledger could not be opened.');
    }
  }

  constructor(database) {
    invariant(database && typeof database.prepare === 'function', 'VALIDATION_ERROR', 'SQLite operations database is required.');
    this.#database = database;
  }

  reserveOperation({
    operationId,
    kind,
    idempotencyKey,
    requestFingerprint,
    creatorSubject,
    destinationId = null,
    backupId = null,
    outputId = null,
    now = new Date().toISOString(),
  }) {
    const safeOperationId = requireFilenameId(operationId, 'operationId');
    const safeIdempotencyKey = requireOpaqueId(idempotencyKey, 'idempotencyKey');
    const safeFingerprint = requireSha256(requestFingerprint, 'requestFingerprint');
    const safeCreator = requireOpaqueId(creatorSubject, 'creatorSubject');
    const safeNow = requireTimestamp(now, 'now');
    const coordinates = operationCoordinates({ kind, destinationId, backupId, outputId });
    return transaction(this.#database, () => {
      const prior = this.#database.prepare('SELECT * FROM operations WHERE idempotency_key = ?').get(safeIdempotencyKey);
      if (prior) {
        invariant(
          prior.request_fingerprint === safeFingerprint && sameCoordinates(prior, coordinates),
          'OPERATION_IDEMPOTENCY_CONFLICT',
          'The idempotency key was reused for a different operation.',
        );
        return { ...operationProjection(prior), replayed: true };
      }
      const collidingId = operationRow(this.#database, safeOperationId);
      invariant(!collidingId, 'OPERATION_IDEMPOTENCY_CONFLICT', 'The operation ID is already reserved.');
      if (coordinates.sourceBackupId !== null) {
        const backup = this.#database.prepare('SELECT health FROM backups WHERE backup_id = ?').get(coordinates.sourceBackupId);
        invariant(backup, 'OPERATION_NOT_FOUND', 'The source backup does not exist.');
        if (['RECOVERY_TEST', 'RESTORE_AS_COPY'].includes(kind)) {
          invariant(backup.health === 'VERIFIED', 'OPERATION_STATE_CONFLICT', 'Recovery requires a currently verified backup.');
        }
      }
      this.#database.prepare(`
        INSERT INTO operations(
          operation_id, kind, idempotency_key, request_fingerprint,
          creator_subject, destination_id, source_backup_id, output_id,
          status, phase, progress_current, progress_total, lease_generation,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'QUEUED', 'RESERVED', 0, ?, 0, ?, ?)
      `).run(
        safeOperationId,
        coordinates.kind,
        safeIdempotencyKey,
        safeFingerprint,
        safeCreator,
        coordinates.destinationId,
        coordinates.sourceBackupId,
        coordinates.outputId,
        phaseTotal(coordinates.kind),
        safeNow,
        safeNow,
      );
      const created = operationRow(this.#database, safeOperationId);
      insertEvent(this.#database, created, 'RESERVED', safeNow);
      return { ...operationProjection(created), replayed: false };
    });
  }

  getOperation(operationId) {
    return operationProjection(operationRow(this.#database, requireFilenameId(operationId, 'operationId')));
  }

  getOperationForWorker(operationId) {
    return workerProjection(operationRow(this.#database, requireFilenameId(operationId, 'operationId')));
  }

  listOperations({ limit = 100 } = {}) {
    invariant(Number.isSafeInteger(limit) && limit >= 1 && limit <= 500, 'VALIDATION_ERROR', 'limit must be between 1 and 500.');
    return this.#database.prepare('SELECT * FROM operations ORDER BY created_at DESC, operation_id DESC LIMIT ?')
      .all(limit).map(operationProjection);
  }

  listOperationsForReconciliation() {
    return this.#database.prepare(`
      SELECT * FROM operations WHERE status IN ('QUEUED', 'RUNNING')
      ORDER BY created_at, operation_id
    `).all().map(workerProjection);
  }

  listOperationEvents(operationId) {
    const safeId = requireFilenameId(operationId, 'operationId');
    return this.#database.prepare(`
      SELECT sequence, event_code, status, phase, progress_current,
        progress_total, lease_generation, failure_code, occurred_at
      FROM operation_events WHERE operation_id = ? ORDER BY sequence
    `).all(safeId).map((row) => ({
      schemaVersion: 1,
      sequence: Number(row.sequence),
      code: row.event_code,
      status: row.status,
      phase: row.phase,
      progress: { current: Number(row.progress_current), total: Number(row.progress_total) },
      failureCode: row.failure_code,
      occurredAt: row.occurred_at,
    }));
  }

  claimNext({ workerId, leaseExpiresAt, now = new Date().toISOString() }) {
    const safeWorkerId = requireOpaqueId(workerId, 'workerId');
    const safeNow = requireTimestamp(now, 'now');
    const safeExpiry = requireTimestamp(leaseExpiresAt, 'leaseExpiresAt');
    invariant(Date.parse(safeExpiry) > Date.parse(safeNow), 'VALIDATION_ERROR', 'leaseExpiresAt must be after now.');
    return transaction(this.#database, () => {
      const queued = this.#database.prepare(`
        SELECT * FROM operations WHERE status = 'QUEUED'
        ORDER BY created_at, operation_id LIMIT 1
      `).get();
      if (!queued) return null;
      const changed = this.#database.prepare(`
        UPDATE operations SET
          status = 'RUNNING', lease_owner = ?, lease_generation = lease_generation + 1,
          lease_expires_at = ?, started_at = coalesce(started_at, ?), updated_at = ?
        WHERE operation_id = ? AND status = 'QUEUED'
      `).run(safeWorkerId, safeExpiry, safeNow, safeNow, queued.operation_id);
      invariant(Number(changed.changes) === 1, 'OPERATION_STATE_CONFLICT', 'The operation claim lost its serialized state.');
      const claimed = operationRow(this.#database, queued.operation_id);
      insertEvent(this.#database, claimed, 'CLAIMED', safeNow);
      return workerProjection(claimed);
    });
  }

  reclaimForReconciliation({
    operationId,
    workerId,
    expectedGeneration,
    leaseExpiresAt,
    now = new Date().toISOString(),
  }) {
    const safeId = requireFilenameId(operationId, 'operationId');
    const safeWorkerId = requireOpaqueId(workerId, 'workerId');
    requireCount(expectedGeneration, 'expectedGeneration');
    const safeNow = requireTimestamp(now, 'now');
    const safeExpiry = requireTimestamp(leaseExpiresAt, 'leaseExpiresAt');
    invariant(Date.parse(safeExpiry) > Date.parse(safeNow), 'VALIDATION_ERROR', 'leaseExpiresAt must be after now.');
    return transaction(this.#database, () => {
      const current = operationRow(this.#database, safeId);
      invariant(current, 'OPERATION_NOT_FOUND', 'The backup operation does not exist.');
      invariant(current.status === 'RUNNING' && Number(current.lease_generation) === expectedGeneration, 'OPERATION_STATE_CONFLICT', 'The operation is not reclaimable from this fencing generation.');
      this.#database.prepare(`
        UPDATE operations SET lease_owner = ?, lease_generation = lease_generation + 1,
          lease_expires_at = ?, updated_at = ? WHERE operation_id = ?
      `).run(safeWorkerId, safeExpiry, safeNow, safeId);
      const reclaimed = operationRow(this.#database, safeId);
      insertEvent(this.#database, reclaimed, 'RECONCILED_CLAIM', safeNow);
      return workerProjection(reclaimed);
    });
  }

  renewLease({ operationId, workerId, expectedGeneration, leaseExpiresAt, now = new Date().toISOString() }) {
    const safeId = requireFilenameId(operationId, 'operationId');
    const safeWorkerId = requireOpaqueId(workerId, 'workerId');
    requireCount(expectedGeneration, 'expectedGeneration');
    const safeNow = requireTimestamp(now, 'now');
    const safeExpiry = requireTimestamp(leaseExpiresAt, 'leaseExpiresAt');
    invariant(Date.parse(safeExpiry) > Date.parse(safeNow), 'VALIDATION_ERROR', 'leaseExpiresAt must be after now.');
    return transaction(this.#database, () => {
      const current = operationRow(this.#database, safeId);
      assertClaim(current, { workerId: safeWorkerId, expectedGeneration });
      invariant(
        Date.parse(safeExpiry) > Date.parse(current.lease_expires_at),
        'OPERATION_STATE_CONFLICT',
        'A lease renewal must extend the current lease.',
      );
      this.#database.prepare(`
        UPDATE operations SET lease_expires_at = ?, updated_at = ? WHERE operation_id = ?
      `).run(safeExpiry, safeNow, safeId);
      const renewed = operationRow(this.#database, safeId);
      insertEvent(this.#database, renewed, 'LEASE_RENEWED', safeNow);
      return workerProjection(renewed);
    });
  }

  advanceOperation({ operationId, workerId, expectedGeneration, phase, now = new Date().toISOString() }) {
    const safeId = requireFilenameId(operationId, 'operationId');
    const safeWorkerId = requireOpaqueId(workerId, 'workerId');
    requireCount(expectedGeneration, 'expectedGeneration');
    const safeNow = requireTimestamp(now, 'now');
    return transaction(this.#database, () => {
      const current = operationRow(this.#database, safeId);
      assertClaim(current, { workerId: safeWorkerId, expectedGeneration });
      const phases = OPERATION_PHASES[current.kind];
      const currentIndex = phases.indexOf(current.phase);
      invariant(phase === phases[currentIndex + 1] && phase !== 'COMPLETED', 'OPERATION_STATE_CONFLICT', 'Operation phases must advance exactly once in order.');
      this.#database.prepare(`
        UPDATE operations SET phase = ?, progress_current = ?, updated_at = ?
        WHERE operation_id = ?
      `).run(phase, currentIndex + 1, safeNow, safeId);
      const advanced = operationRow(this.#database, safeId);
      insertEvent(this.#database, advanced, 'PHASE_ADVANCED', safeNow);
      return workerProjection(advanced);
    });
  }

  succeedOperation({
    operationId,
    workerId,
    expectedGeneration,
    manifestSha256 = null,
    artifactCount = null,
    byteCount = null,
    verifiedAt = null,
    now = new Date().toISOString(),
  }) {
    const safeId = requireFilenameId(operationId, 'operationId');
    const safeWorkerId = requireOpaqueId(workerId, 'workerId');
    requireCount(expectedGeneration, 'expectedGeneration');
    const safeManifest = requireSha256(manifestSha256, 'manifestSha256', { optional: true });
    const safeArtifactCount = requireCount(artifactCount, 'artifactCount', { optional: true });
    const safeByteCount = requireCount(byteCount, 'byteCount', { optional: true });
    const safeVerifiedAt = requireTimestamp(verifiedAt, 'verifiedAt', { optional: true });
    const safeNow = requireTimestamp(now, 'now');
    invariant(
      safeManifest !== null && safeArtifactCount !== null
        && safeByteCount !== null && safeVerifiedAt !== null,
      'VALIDATION_ERROR',
      'Successful operations require complete bounded verification evidence.',
    );
    return transaction(this.#database, () => {
      const current = operationRow(this.#database, safeId);
      assertClaim(current, { workerId: safeWorkerId, expectedGeneration });
      const phases = OPERATION_PHASES[current.kind];
      invariant(current.phase === phases.at(-2), 'OPERATION_STATE_CONFLICT', 'The operation has not reached its final verified phase.');
      if (current.kind === 'CREATE') {
        const backup = this.#database.prepare(`
          SELECT health, manifest_sha256, artifact_count, byte_count, last_verified_at
          FROM backups WHERE created_operation_id = ? AND backup_id = ?
        `).get(safeId, current.output_id);
        invariant(
          backup?.health === 'VERIFIED'
            && backup.manifest_sha256 === safeManifest
            && Number(backup.artifact_count) === safeArtifactCount
            && Number(backup.byte_count) === safeByteCount
            && backup.last_verified_at === safeVerifiedAt,
          'OPERATION_STATE_CONFLICT',
          'CREATE cannot succeed before its exact published backup is registered and verified.',
        );
      } else if (current.kind === 'VERIFY') {
        const backup = this.#database.prepare(`
          SELECT health, manifest_sha256, artifact_count, byte_count, last_verified_at
          FROM backups WHERE backup_id = ?
        `).get(current.source_backup_id);
        invariant(
          backup?.health === 'VERIFIED'
            && backup.manifest_sha256 === safeManifest
            && Number(backup.artifact_count) === safeArtifactCount
            && Number(backup.byte_count) === safeByteCount
            && backup.last_verified_at === safeVerifiedAt,
          'OPERATION_STATE_CONFLICT',
          'VERIFY cannot succeed before exact backup health evidence is recorded.',
        );
      } else if (current.kind === 'RECOVERY_TEST') {
        const backup = this.#database.prepare(`
          SELECT health, manifest_sha256, artifact_count, byte_count,
            last_recovery_tested_at
          FROM backups WHERE backup_id = ?
        `).get(current.source_backup_id);
        invariant(
          backup?.health === 'VERIFIED'
            && backup.manifest_sha256 === safeManifest
            && Number(backup.artifact_count) === safeArtifactCount
            && Number(backup.byte_count) === safeByteCount
            && backup.last_recovery_tested_at === safeVerifiedAt,
          'OPERATION_STATE_CONFLICT',
          'RECOVERY_TEST cannot succeed before exact parity and cleanup evidence is recorded.',
        );
      } else {
        const copy = this.#database.prepare(`
          SELECT manifest_sha256, artifact_count, byte_count, verified_at
          FROM restored_copies WHERE created_operation_id = ? AND copy_id = ?
        `).get(safeId, current.output_id);
        invariant(
          copy?.manifest_sha256 === safeManifest
            && Number(copy.artifact_count) === safeArtifactCount
            && Number(copy.byte_count) === safeByteCount
            && copy.verified_at === safeVerifiedAt,
          'OPERATION_STATE_CONFLICT',
          'RESTORE_AS_COPY cannot succeed before its exact quarantined copy is registered.',
        );
      }
      this.#database.prepare(`
        UPDATE operations SET status = 'SUCCEEDED', phase = 'COMPLETED',
          progress_current = progress_total, lease_owner = NULL,
          lease_expires_at = NULL, result_manifest_sha256 = ?,
          result_artifact_count = ?, result_byte_count = ?, result_verified_at = ?,
          updated_at = ?, finished_at = ? WHERE operation_id = ?
      `).run(
        safeManifest, safeArtifactCount, safeByteCount, safeVerifiedAt,
        safeNow, safeNow, safeId,
      );
      const succeeded = operationRow(this.#database, safeId);
      insertEvent(this.#database, succeeded, 'SUCCEEDED', safeNow);
      return operationProjection(succeeded);
    });
  }

  failOperation({
    operationId,
    workerId = null,
    expectedGeneration = null,
    failureCode,
    now = new Date().toISOString(),
  }) {
    const safeId = requireFilenameId(operationId, 'operationId');
    const safeCode = requireFailureCode(failureCode);
    const safeNow = requireTimestamp(now, 'now');
    const safeWorkerId = workerId === null ? null : requireOpaqueId(workerId, 'workerId');
    if (safeWorkerId !== null) requireCount(expectedGeneration, 'expectedGeneration');
    return transaction(this.#database, () => {
      const current = operationRow(this.#database, safeId);
      invariant(current, 'OPERATION_NOT_FOUND', 'The backup operation does not exist.');
      invariant(['QUEUED', 'RUNNING'].includes(current.status), 'OPERATION_STATE_CONFLICT', 'Only a nonterminal operation can fail.');
      if (current.status === 'RUNNING') {
        invariant(safeWorkerId !== null, 'OPERATION_LEASE_LOST', 'A running operation requires its worker claim.');
        assertClaim(current, { workerId: safeWorkerId, expectedGeneration });
      }
      this.#database.prepare(`
        UPDATE operations SET status = 'FAILED', lease_owner = NULL,
          lease_expires_at = NULL, failure_code = ?, updated_at = ?, finished_at = ?
        WHERE operation_id = ?
      `).run(safeCode, safeNow, safeNow, safeId);
      const failed = operationRow(this.#database, safeId);
      insertEvent(this.#database, failed, 'FAILED', safeNow);
      return operationProjection(failed);
    });
  }

  interruptOperation({ operationId, expectedGeneration, now = new Date().toISOString() }) {
    const safeId = requireFilenameId(operationId, 'operationId');
    requireCount(expectedGeneration, 'expectedGeneration');
    const safeNow = requireTimestamp(now, 'now');
    return transaction(this.#database, () => {
      const current = operationRow(this.#database, safeId);
      invariant(current, 'OPERATION_NOT_FOUND', 'The backup operation does not exist.');
      invariant(current.status === 'RUNNING' && Number(current.lease_generation) === expectedGeneration, 'OPERATION_STATE_CONFLICT', 'The running operation fencing generation changed.');
      this.#database.prepare(`
        UPDATE operations SET status = 'INTERRUPTED', lease_owner = NULL,
          lease_generation = lease_generation + 1, lease_expires_at = NULL,
          failure_code = 'OPERATION_INTERRUPTED', updated_at = ?, finished_at = ?
        WHERE operation_id = ?
      `).run(safeNow, safeNow, safeId);
      const interrupted = operationRow(this.#database, safeId);
      insertEvent(this.#database, interrupted, 'INTERRUPTED', safeNow);
      return operationProjection(interrupted);
    });
  }

  reserveStage({
    stageId,
    operationId,
    kind,
    rootKey,
    rootIdentitySha256,
    filesystemIdentitySha256,
    now = new Date().toISOString(),
  }) {
    const safeStageId = requireOpaqueId(stageId, 'stageId');
    const safeOperationId = requireFilenameId(operationId, 'operationId');
    invariant(STAGE_KINDS.includes(kind), 'VALIDATION_ERROR', 'Unsupported stage kind.');
    const safeRootKey = requireOpaqueId(rootKey, 'rootKey');
    const safeRootIdentity = requireSha256(rootIdentitySha256, 'rootIdentitySha256');
    const safeFilesystemIdentity = requireSha256(filesystemIdentitySha256, 'filesystemIdentitySha256');
    const safeNow = requireTimestamp(now, 'now');
    return transaction(this.#database, () => {
      const operation = operationRow(this.#database, safeOperationId);
      invariant(operation, 'OPERATION_NOT_FOUND', 'The owning operation does not exist.');
      const expected = expectedStageCoordinates(operation, kind);
      if (kind === 'RECOVERY_TEST') {
        invariant(safeRootKey === 'control.recovery-tests', 'BACKUP_PATH_UNSAFE', 'Recovery stages require the fixed recovery root.');
      } else {
        invariant(safeRootKey === expected.destinationId, 'BACKUP_PATH_UNSAFE', 'The stage root does not match its configured destination.');
      }
      const prior = this.#database.prepare(`
        SELECT * FROM staged_outputs
        WHERE stage_id = ? OR operation_id = ? OR (
          root_key = ? AND (stage_basename = ? OR (? IS NOT NULL AND final_basename = ?))
        ) LIMIT 1
      `).get(
        safeStageId, safeOperationId, safeRootKey, expected.stageBasename,
        expected.finalBasename, expected.finalBasename,
      );
      if (prior) {
        invariant(
          prior.stage_id === safeStageId
            && prior.operation_id === safeOperationId
            && prior.kind === kind
            && prior.root_key === safeRootKey
            && prior.destination_id === expected.destinationId
            && prior.stage_basename === expected.stageBasename
            && prior.final_basename === expected.finalBasename
            && prior.root_identity_sha256 === safeRootIdentity
            && prior.filesystem_identity_sha256 === safeFilesystemIdentity,
          'BACKUP_DESTINATION_CONFLICT',
          'The stage reservation conflicts with existing output identity.',
        );
        return stageRecord(prior);
      }
      this.#database.prepare(`
        INSERT INTO staged_outputs(
          stage_id, operation_id, kind, root_key, destination_id,
          stage_basename, final_basename, root_identity_sha256,
          filesystem_identity_sha256, disposition, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
      `).run(
        safeStageId, safeOperationId, kind, safeRootKey, expected.destinationId,
        expected.stageBasename, expected.finalBasename, safeRootIdentity,
        safeFilesystemIdentity, safeNow,
      );
      return stageRecord(this.#database.prepare('SELECT * FROM staged_outputs WHERE stage_id = ?').get(safeStageId));
    });
  }

  getStageForOperation(operationId) {
    const safeId = requireFilenameId(operationId, 'operationId');
    return stageRecord(this.#database.prepare(
      'SELECT * FROM staged_outputs WHERE operation_id = ?',
    ).get(safeId));
  }

  listStages({ disposition = null } = {}) {
    if (disposition !== null) {
      invariant(STAGE_DISPOSITIONS.includes(disposition), 'VALIDATION_ERROR', 'Unsupported stage disposition.');
      return this.#database.prepare(`
        SELECT * FROM staged_outputs WHERE disposition = ? ORDER BY updated_at, stage_id
      `).all(disposition).map(stageRecord);
    }
    return this.#database.prepare('SELECT * FROM staged_outputs ORDER BY updated_at, stage_id')
      .all().map(stageRecord);
  }

  registerOrphanedStage({
    stageId,
    kind,
    rootKey,
    destinationId = null,
    stageBasename,
    finalBasename = null,
    rootIdentitySha256,
    filesystemIdentitySha256,
    now = new Date().toISOString(),
  }) {
    const safeStageId = requireOpaqueId(stageId, 'stageId');
    invariant(STAGE_KINDS.includes(kind), 'VALIDATION_ERROR', 'Unsupported stage kind.');
    const safeRootKey = requireOpaqueId(rootKey, 'rootKey');
    const safeDestination = requireOptionalOpaqueId(destinationId, 'destinationId');
    invariant(typeof stageBasename === 'string' && /^\.numberdroid-(?:backup|restore|recovery)-stage-[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/.test(stageBasename), 'VALIDATION_ERROR', 'stageBasename is not a service-generated stage name.');
    if (kind === 'RECOVERY_TEST') {
      invariant(
        safeRootKey === 'control.recovery-tests'
          && safeDestination === null
          && finalBasename === null
          && stageBasename.startsWith('.numberdroid-recovery-stage-'),
        'VALIDATION_ERROR',
        'Recovery orphan coordinates are invalid.',
      );
    } else if (kind === 'BACKUP') {
      invariant(
        safeDestination !== null
          && safeRootKey === safeDestination
          && stageBasename.startsWith('.numberdroid-backup-stage-')
          && typeof finalBasename === 'string'
          && /^backup-[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/.test(finalBasename),
        'VALIDATION_ERROR',
        'Backup orphan coordinates are invalid.',
      );
    } else {
      invariant(
        safeDestination !== null
          && safeRootKey === safeDestination
          && stageBasename.startsWith('.numberdroid-restore-stage-')
          && typeof finalBasename === 'string'
          && /^workspace-copy-[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/.test(finalBasename),
        'VALIDATION_ERROR',
        'Restore orphan coordinates are invalid.',
      );
    }
    const safeRootIdentity = requireSha256(rootIdentitySha256, 'rootIdentitySha256');
    const safeFilesystemIdentity = requireSha256(filesystemIdentitySha256, 'filesystemIdentitySha256');
    const safeNow = requireTimestamp(now, 'now');
    const prior = this.#database.prepare(`
      SELECT * FROM staged_outputs
      WHERE stage_id = ? OR (
        root_key = ? AND (stage_basename = ? OR (? IS NOT NULL AND final_basename = ?))
      ) LIMIT 1
    `).get(safeStageId, safeRootKey, stageBasename, finalBasename, finalBasename);
    if (prior) {
      invariant(
        prior.stage_id === safeStageId
          && prior.operation_id === null
          && prior.kind === kind
          && prior.root_key === safeRootKey
          && prior.destination_id === safeDestination
          && prior.stage_basename === stageBasename
          && prior.final_basename === finalBasename
          && prior.root_identity_sha256 === safeRootIdentity
          && prior.filesystem_identity_sha256 === safeFilesystemIdentity
          && prior.disposition === 'ORPHANED',
        'BACKUP_DESTINATION_CONFLICT',
        'The orphaned stage conflicts with existing output identity.',
      );
      return stageRecord(prior);
    }
    this.#database.prepare(`
      INSERT INTO staged_outputs(
        stage_id, operation_id, kind, root_key, destination_id,
        stage_basename, final_basename, root_identity_sha256,
        filesystem_identity_sha256, disposition, updated_at
      ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, 'ORPHANED', ?)
    `).run(
      safeStageId, kind, safeRootKey, safeDestination, stageBasename,
      finalBasename, safeRootIdentity, safeFilesystemIdentity, safeNow,
    );
    return stageRecord(this.#database.prepare('SELECT * FROM staged_outputs WHERE stage_id = ?').get(safeStageId));
  }

  recordStageEvidence({
    stageId,
    stageIdentitySha256 = null,
    finalIdentitySha256 = null,
    disposition = 'ACTIVE',
    now = new Date().toISOString(),
  }) {
    const safeStageId = requireOpaqueId(stageId, 'stageId');
    invariant(STAGE_DISPOSITIONS.includes(disposition), 'VALIDATION_ERROR', 'Unsupported stage disposition.');
    const safeStageIdentity = requireSha256(stageIdentitySha256, 'stageIdentitySha256', { optional: true });
    const safeFinalIdentity = requireSha256(finalIdentitySha256, 'finalIdentitySha256', { optional: true });
    const safeNow = requireTimestamp(now, 'now');
    const current = this.#database.prepare('SELECT * FROM staged_outputs WHERE stage_id = ?').get(safeStageId);
    invariant(current, 'OPERATION_NOT_FOUND', 'The staged output does not exist.');
    invariant(current.disposition === 'ACTIVE' || current.disposition === disposition, 'OPERATION_STATE_CONFLICT', 'An inert or orphaned stage cannot become active.');
    invariant(current.operation_id !== null || disposition === 'ORPHANED', 'OPERATION_STATE_CONFLICT', 'An unmatched stage must remain orphaned.');
    this.#database.prepare(`
      UPDATE staged_outputs SET stage_identity_sha256 = coalesce(?, stage_identity_sha256),
        final_identity_sha256 = coalesce(?, final_identity_sha256),
        disposition = ?, updated_at = ? WHERE stage_id = ?
    `).run(safeStageIdentity, safeFinalIdentity, disposition, safeNow, safeStageId);
    return stageRecord(this.#database.prepare('SELECT * FROM staged_outputs WHERE stage_id = ?').get(safeStageId));
  }

  registerBackup({
    backupId,
    destinationId,
    rootKey,
    provenance,
    health,
    finalIdentitySha256 = null,
    manifestSha256 = null,
    databaseSha256 = null,
    artifactCount = null,
    byteCount = null,
    createdOperationId = null,
    createdAt = null,
    registeredAt = new Date().toISOString(),
    lastVerifiedAt = null,
  }) {
    const safeBackupId = requireFilenameId(backupId, 'backupId');
    const safeDestination = requireOpaqueId(destinationId, 'destinationId');
    const safeRootKey = requireOpaqueId(rootKey, 'rootKey');
    invariant(['CREATED', 'DISCOVERED'].includes(provenance), 'VALIDATION_ERROR', 'Unsupported backup provenance.');
    invariant(BACKUP_HEALTH_STATES.includes(health), 'VALIDATION_ERROR', 'Unsupported backup health.');
    const safeFinalIdentity = requireSha256(finalIdentitySha256, 'finalIdentitySha256', { optional: true });
    const safeManifest = requireSha256(manifestSha256, 'manifestSha256', { optional: true });
    const safeDatabase = requireSha256(databaseSha256, 'databaseSha256', { optional: true });
    const safeArtifactCount = requireCount(artifactCount, 'artifactCount', { optional: true });
    const safeByteCount = requireCount(byteCount, 'byteCount', { optional: true });
    const safeOperationId = createdOperationId === null ? null : requireFilenameId(createdOperationId, 'createdOperationId');
    const safeCreatedAt = requireTimestamp(createdAt, 'createdAt', { optional: true });
    const safeRegisteredAt = requireTimestamp(registeredAt, 'registeredAt');
    const safeLastVerified = requireTimestamp(lastVerifiedAt, 'lastVerifiedAt', { optional: true });
    invariant(safeRootKey === safeDestination, 'VALIDATION_ERROR', 'Backup rootKey must equal its opaque destinationId.');
    invariant((provenance === 'CREATED') === (safeOperationId !== null), 'VALIDATION_ERROR', 'CREATED backups require exactly one creating operation.');
    invariant(['UNVERIFIED', 'VERIFIED'].includes(health), 'VALIDATION_ERROR', 'A newly registered backup must be unverified or verified.');
    invariant(safeCreatedAt !== null, 'VALIDATION_ERROR', 'A registered backup requires its manifest creation time.');
    invariant(provenance !== 'DISCOVERED' || health === 'VERIFIED', 'VALIDATION_ERROR', 'A discovered backup must pass canonical verification before registration.');
    if (health === 'VERIFIED') {
      invariant(safeFinalIdentity && safeManifest && safeDatabase && safeLastVerified, 'VALIDATION_ERROR', 'VERIFIED backups require complete verification evidence.');
    }
    return transaction(this.#database, () => {
      const prior = this.#database.prepare(`
        SELECT * FROM backups WHERE backup_id = ? OR (root_key = ? AND final_basename = ?)
          OR (? IS NOT NULL AND created_operation_id = ?) LIMIT 1
      `).get(
        safeBackupId, safeRootKey, `backup-${safeBackupId}`,
        safeOperationId, safeOperationId,
      );
      if (prior) {
        invariant(
          prior.backup_id === safeBackupId
            && prior.destination_id === safeDestination
            && prior.root_key === safeRootKey
            && prior.final_basename === `backup-${safeBackupId}`
            && prior.final_identity_sha256 === safeFinalIdentity
            && prior.provenance === provenance
            && prior.health === health
            && prior.manifest_sha256 === safeManifest
            && prior.database_sha256 === safeDatabase
            && prior.artifact_count === safeArtifactCount
            && prior.byte_count === safeByteCount
            && prior.created_operation_id === safeOperationId
            && prior.created_at === safeCreatedAt
            && prior.registered_at === safeRegisteredAt
            && prior.last_verified_at === safeLastVerified,
          'BACKUP_DESTINATION_CONFLICT',
          'The backup registration conflicts with existing output identity.',
        );
        return backupProjection(prior);
      }
      if (safeOperationId !== null) {
        const operation = operationRow(this.#database, safeOperationId);
        invariant(
          operation?.kind === 'CREATE'
            && operation.status === 'RUNNING'
            && operation.phase === 'PUBLISHED'
            && operation.output_id === safeBackupId
            && operation.destination_id === safeDestination,
          'OPERATION_STATE_CONFLICT',
          'The creating operation has not published this backup.',
        );
      }
      this.#database.prepare(`
        INSERT INTO backups(
          backup_id, destination_id, root_key, final_basename,
          final_identity_sha256, provenance, health, manifest_sha256,
          database_sha256, artifact_count, byte_count, created_operation_id,
          created_at, registered_at, last_verified_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        safeBackupId, safeDestination, safeRootKey, `backup-${safeBackupId}`,
        safeFinalIdentity, provenance, health, safeManifest, safeDatabase,
        safeArtifactCount, safeByteCount, safeOperationId, safeCreatedAt,
        safeRegisteredAt, safeLastVerified,
      );
      return backupProjection(this.#database.prepare('SELECT * FROM backups WHERE backup_id = ?').get(safeBackupId));
    });
  }

  getBackup(backupId) {
    const safeId = requireFilenameId(backupId, 'backupId');
    return backupProjection(this.#database.prepare('SELECT * FROM backups WHERE backup_id = ?').get(safeId));
  }

  getBackupForWorker(backupId) {
    const safeId = requireFilenameId(backupId, 'backupId');
    return backupWorkerRecord(this.#database.prepare('SELECT * FROM backups WHERE backup_id = ?').get(safeId));
  }

  listBackups() {
    return this.#database.prepare('SELECT * FROM backups ORDER BY registered_at DESC, backup_id DESC')
      .all().map(backupProjection);
  }

  recordBackupHealth({
    backupId,
    health,
    finalIdentitySha256 = null,
    manifestSha256 = null,
    databaseSha256 = null,
    artifactCount = null,
    byteCount = null,
    verifiedAt = null,
  }) {
    const safeId = requireFilenameId(backupId, 'backupId');
    invariant(['VERIFIED', 'SUSPECT', 'MISSING'].includes(health), 'VALIDATION_ERROR', 'Unsupported backup health transition.');
    const safeFinalIdentity = requireSha256(finalIdentitySha256, 'finalIdentitySha256', { optional: true });
    const safeManifest = requireSha256(manifestSha256, 'manifestSha256', { optional: true });
    const safeDatabase = requireSha256(databaseSha256, 'databaseSha256', { optional: true });
    const safeArtifactCount = requireCount(artifactCount, 'artifactCount', { optional: true });
    const safeByteCount = requireCount(byteCount, 'byteCount', { optional: true });
    const safeVerifiedAt = requireTimestamp(verifiedAt, 'verifiedAt', { optional: true });
    if (health === 'VERIFIED') {
      invariant(safeFinalIdentity && safeManifest && safeDatabase && safeVerifiedAt, 'VALIDATION_ERROR', 'VERIFIED health requires exact evidence.');
    } else {
      invariant(
        safeFinalIdentity === null && safeManifest === null && safeDatabase === null
          && safeArtifactCount === null && safeByteCount === null && safeVerifiedAt === null,
        'VALIDATION_ERROR',
        'Failure health transitions cannot replace verification evidence.',
      );
    }
    return transaction(this.#database, () => {
      const current = this.#database.prepare('SELECT * FROM backups WHERE backup_id = ?').get(safeId);
      invariant(current, 'OPERATION_NOT_FOUND', 'The backup does not exist.');
      if (health === 'VERIFIED') {
        invariant(current.manifest_sha256 === null || current.manifest_sha256 === safeManifest, 'BACKUP_CONTENT_MISMATCH', 'Verification does not match the reserved backup identity.');
        this.#database.prepare(`
          UPDATE backups SET health = 'VERIFIED', final_identity_sha256 = ?,
            manifest_sha256 = ?, database_sha256 = ?, artifact_count = ?,
            byte_count = ?, last_verified_at = ? WHERE backup_id = ?
        `).run(
          safeFinalIdentity, safeManifest, safeDatabase, safeArtifactCount,
          safeByteCount, safeVerifiedAt, safeId,
        );
      } else {
        this.#database.prepare('UPDATE backups SET health = ? WHERE backup_id = ?').run(health, safeId);
      }
      return backupProjection(this.#database.prepare('SELECT * FROM backups WHERE backup_id = ?').get(safeId));
    });
  }

  recordRecoveryTestPassed({ backupId, testedAt = new Date().toISOString() }) {
    const safeId = requireFilenameId(backupId, 'backupId');
    const safeTestedAt = requireTimestamp(testedAt, 'testedAt');
    const changed = this.#database.prepare(`
      UPDATE backups SET last_recovery_tested_at = ?
      WHERE backup_id = ? AND health = 'VERIFIED'
    `).run(safeTestedAt, safeId);
    invariant(Number(changed.changes) === 1, 'OPERATION_STATE_CONFLICT', 'Recovery testing requires a currently verified backup.');
    return this.getBackup(safeId);
  }

  registerRestoredCopy({
    copyId,
    sourceBackupId,
    destinationId,
    rootKey,
    finalIdentitySha256,
    manifestSha256,
    artifactCount,
    byteCount,
    createdOperationId,
    verifiedAt = new Date().toISOString(),
  }) {
    const safeCopyId = requireFilenameId(copyId, 'copyId');
    const safeBackupId = requireFilenameId(sourceBackupId, 'sourceBackupId');
    const safeDestination = requireOpaqueId(destinationId, 'destinationId');
    const safeRootKey = requireOpaqueId(rootKey, 'rootKey');
    const safeFinalIdentity = requireSha256(finalIdentitySha256, 'finalIdentitySha256');
    const safeManifest = requireSha256(manifestSha256, 'manifestSha256');
    const safeArtifactCount = requireCount(artifactCount, 'artifactCount');
    const safeByteCount = requireCount(byteCount, 'byteCount');
    const safeOperationId = requireFilenameId(createdOperationId, 'createdOperationId');
    const safeVerifiedAt = requireTimestamp(verifiedAt, 'verifiedAt');
    invariant(safeRootKey === safeDestination, 'VALIDATION_ERROR', 'Restored-copy rootKey must equal its opaque destinationId.');
    return transaction(this.#database, () => {
      const backup = this.#database.prepare('SELECT health, manifest_sha256 FROM backups WHERE backup_id = ?').get(safeBackupId);
      invariant(
        backup?.health === 'VERIFIED' && backup.manifest_sha256 === safeManifest,
        'OPERATION_STATE_CONFLICT',
        'A restored copy requires the exact currently verified source backup.',
      );
      const operation = operationRow(this.#database, safeOperationId);
      invariant(
        operation?.kind === 'RESTORE_AS_COPY'
          && operation.status === 'RUNNING'
          && operation.phase === 'PUBLISHED'
          && operation.source_backup_id === safeBackupId
          && operation.destination_id === safeDestination
          && operation.output_id === safeCopyId,
        'OPERATION_STATE_CONFLICT',
        'The restore operation does not match this copy.',
      );
      const prior = this.#database.prepare(`
        SELECT * FROM restored_copies WHERE copy_id = ?
          OR (root_key = ? AND final_basename = ?)
          OR created_operation_id = ? LIMIT 1
      `).get(safeCopyId, safeRootKey, `workspace-copy-${safeCopyId}`, safeOperationId);
      if (prior) {
        invariant(
          prior.copy_id === safeCopyId
            && prior.source_backup_id === safeBackupId
            && prior.destination_id === safeDestination
            && prior.root_key === safeRootKey
            && prior.final_basename === `workspace-copy-${safeCopyId}`
            && prior.final_identity_sha256 === safeFinalIdentity
            && prior.lifecycle === 'QUARANTINED_VERIFIED'
            && prior.manifest_sha256 === safeManifest
            && prior.artifact_count === safeArtifactCount
            && prior.byte_count === safeByteCount
            && prior.created_operation_id === safeOperationId
            && prior.verified_at === safeVerifiedAt,
          'BACKUP_DESTINATION_CONFLICT',
          'The restored-copy registration conflicts with existing output identity.',
        );
        return restoredCopyProjection(prior);
      }
      this.#database.prepare(`
        INSERT INTO restored_copies(
          copy_id, source_backup_id, destination_id, root_key, final_basename,
          final_identity_sha256, lifecycle, manifest_sha256, artifact_count,
          byte_count, created_operation_id, verified_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'QUARANTINED_VERIFIED', ?, ?, ?, ?, ?)
      `).run(
        safeCopyId, safeBackupId, safeDestination, safeRootKey,
        `workspace-copy-${safeCopyId}`, safeFinalIdentity, safeManifest,
        safeArtifactCount, safeByteCount, safeOperationId, safeVerifiedAt,
      );
      return restoredCopyProjection(this.#database.prepare('SELECT * FROM restored_copies WHERE copy_id = ?').get(safeCopyId));
    });
  }

  getRestoredCopy(copyId) {
    const safeId = requireFilenameId(copyId, 'copyId');
    return restoredCopyProjection(this.#database.prepare('SELECT * FROM restored_copies WHERE copy_id = ?').get(safeId));
  }

  getRestoredCopyForWorker(copyId) {
    const safeId = requireFilenameId(copyId, 'copyId');
    return restoredCopyWorkerRecord(this.#database.prepare('SELECT * FROM restored_copies WHERE copy_id = ?').get(safeId));
  }

  close() {
    if (this.#closed) return;
    this.#closed = true;
    this.#database.close();
  }
}

export {
  CONTROL_SCHEMA_V1_CHECKSUM,
  CONTROL_SCHEMA_VERSION,
  LEDGER_FILENAME as OPERATIONS_LEDGER_FILENAME,
};
