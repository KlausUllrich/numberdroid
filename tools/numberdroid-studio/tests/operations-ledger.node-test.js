import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CONTROL_SCHEMA_V1_CHECKSUM,
  OperationsLedger,
} from '../packages/persistence/src/operations/operations-ledger.js';
import {
  OPERATIONS_LOCK_FILENAME,
  OperationsLock,
} from '../packages/persistence/src/operations/operations-lock.js';
import { createBetterSqliteDatabase } from '../packages/persistence/src/sqlite/sqlite-driver.js';
import { afterTestCleanup } from './persistence-test-helpers.js';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);
const HASH_D = 'd'.repeat(64);
const HASH_E = 'e'.repeat(64);
const T0 = '2026-08-29T10:00:00.000Z';

async function controlRoot(context, prefix) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  afterTestCleanup(context, () => rm(root, { recursive: true, force: true }));
  return root;
}

function advanceAll(ledger, operation, workerId, phases, startSecond = 1) {
  let current = operation;
  for (const [index, phase] of phases.entries()) {
    current = ledger.advanceOperation({
      operationId: operation.operationId,
      workerId,
      expectedGeneration: operation.lease.generation,
      phase,
      now: new Date(Date.parse(T0) + (startSecond + index) * 1000).toISOString(),
    });
  }
  return current;
}

test('operations lock is a persistent rollback-journal SQLite file with one process-lifetime exclusive owner', async (context) => {
  const root = await controlRoot(context, 'numberdroid-operations-lock-');
  let firstDatabase;
  const first = await OperationsLock.acquire({
    controlRoot: root,
    databaseFactory(filename, options) {
      firstDatabase = createBetterSqliteDatabase(filename, options);
      return firstDatabase;
    },
  });
  afterTestCleanup(context, () => first.close());
  assert.equal(first.isHeld, true);
  await assert.rejects(
    OperationsLock.acquire({ controlRoot: root, busyTimeoutMs: 0 }),
    (error) => error.code === 'OPERATIONS_UNAVAILABLE' && !error.message.includes(root),
  );
  firstDatabase.exec('ROLLBACK');
  assert.equal(first.isHeld, false, 'the lock must fail closed as soon as its exclusive transaction is gone');

  const second = await OperationsLock.acquire({ controlRoot: root });
  afterTestCleanup(context, () => second.close());
  assert.equal(second.isHeld, true, 'a real second connection proves the first no longer owns the OS lock');
  first.close();
  assert.equal(first.isHeld, false);
  await assert.rejects(
    OperationsLock.acquire({ controlRoot: root, busyTimeoutMs: 0 }),
    (error) => error.code === 'OPERATIONS_UNAVAILABLE',
  );
  second.close();

  const inspection = createBetterSqliteDatabase(join(root, OPERATIONS_LOCK_FILENAME), { readonly: true });
  try {
    assert.equal(String(inspection.pragma('journal_mode', { simple: true })).toLowerCase(), 'delete');
    assert.deepEqual(inspection.prepare('SELECT * FROM lock_identity').all(), [{ singleton: 1, schema_version: 1 }]);
    assert.equal(
      inspection.prepare("SELECT count(*) AS count FROM sqlite_master WHERE name LIKE '%pid%' OR sql LIKE '%pid%'").get().count,
      0,
    );
  } finally {
    inspection.close();
  }
});

test('external control ledger v1 is checksummed, idempotent, fenced, append-only, and exposes only safe projections', async (context) => {
  const root = await controlRoot(context, 'numberdroid-operations-ledger-');
  let ledgerDatabase;
  const ledger = await OperationsLedger.open({
    controlRoot: root,
    databaseFactory(filename, options) {
      ledgerDatabase = createBetterSqliteDatabase(filename, options);
      return ledgerDatabase;
    },
  });
  afterTestCleanup(context, () => ledger.close());

  const inspection = createBetterSqliteDatabase(join(root, 'operations.sqlite'));
  afterTestCleanup(context, () => inspection.close());
  assert.equal(String(ledgerDatabase.pragma('journal_mode', { simple: true })).toLowerCase(), 'wal');
  assert.equal(Number(ledgerDatabase.pragma('foreign_keys', { simple: true })), 1);
  assert.equal(Number(ledgerDatabase.pragma('synchronous', { simple: true })), 2);
  assert.equal(Number(inspection.pragma('user_version', { simple: true })), 1);
  assert.deepEqual(
    inspection.prepare('SELECT version, name, checksum FROM control_schema_migrations').get(),
    { version: 1, name: 'operations_control_v1', checksum: CONTROL_SCHEMA_V1_CHECKSUM },
  );
  assert.deepEqual(
    inspection.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({ name }) => name),
    ['backups', 'control_schema_migrations', 'operation_events', 'operations', 'restored_copies', 'staged_outputs'],
  );

  const request = {
    operationId: 'op-create-001',
    kind: 'CREATE',
    idempotencyKey: 'idem.create.001',
    requestFingerprint: HASH_A,
    creatorSubject: 'operator.session.001',
    destinationId: 'destination.backup.local',
    outputId: 'backup-001',
    now: T0,
  };
  const created = ledger.reserveOperation(request);
  assert.equal(created.replayed, false);
  assert.equal(created.status, 'QUEUED');
  assert.equal(created.phase, 'RESERVED');
  assert.equal(ledger.reserveOperation({ ...request, operationId: 'ignored-replay-id' }).replayed, true);
  assert.equal(ledger.reserveOperation({
    ...request,
    operationId: 'ignored-replay-id-2',
    outputId: 'ignored-generated-output-id',
  }).outputId, request.outputId);
  assert.throws(
    () => ledger.reserveOperation({ ...request, operationId: 'ignored-conflict-id', requestFingerprint: HASH_B }),
    (error) => error.code === 'OPERATION_IDEMPOTENCY_CONFLICT',
  );
  assert.deepEqual(Object.keys(ledger.getOperation('op-create-001')), [
    'schemaVersion', 'operationId', 'kind', 'status', 'phase', 'progress',
    'destinationId', 'backupId', 'outputId', 'result', 'failure', 'createdAt',
    'startedAt', 'updatedAt', 'finishedAt',
  ]);
  const safeJson = JSON.stringify(ledger.getOperation('op-create-001'));
  assert.doesNotMatch(safeJson, /idem\.create|operator\.session|requestFingerprint|lease|operations\.sqlite/);
  assert.equal(safeJson.includes(root), false);

  const claimed = ledger.claimNext({
    workerId: 'worker.operations.001',
    now: '2026-08-29T10:00:01.000Z',
    leaseExpiresAt: '2026-08-29T10:01:01.000Z',
  });
  assert.equal(claimed.lease.generation, 1);
  assert.throws(
    () => ledger.advanceOperation({
      operationId: claimed.operationId,
      workerId: 'worker.operations.001',
      expectedGeneration: 0,
      phase: 'SOURCE_VERIFIED',
      now: '2026-08-29T10:00:02.000Z',
    }),
    (error) => error.code === 'OPERATION_LEASE_LOST',
  );
  ledger.reserveStage({
    stageId: 'stage.create.001',
    operationId: claimed.operationId,
    kind: 'BACKUP',
    rootKey: 'destination.backup.local',
    rootIdentitySha256: HASH_B,
    filesystemIdentitySha256: HASH_C,
    now: '2026-08-29T10:00:02.000Z',
  });
  const published = advanceAll(ledger, claimed, 'worker.operations.001', [
    'SOURCE_VERIFIED', 'DB_SNAPSHOTTED', 'CAS_COPIED', 'MANIFEST_WRITTEN',
    'SNAPSHOT_VERIFIED', 'DURABLY_CLOSED', 'PUBLISHED',
  ], 2);
  assert.equal(published.phase, 'PUBLISHED');
  ledger.recordStageEvidence({
    stageId: 'stage.create.001',
    stageIdentitySha256: HASH_D,
    finalIdentitySha256: HASH_E,
    disposition: 'INERT',
    now: '2026-08-29T10:00:10.000Z',
  });
  const backup = ledger.registerBackup({
    backupId: 'backup-001',
    destinationId: 'destination.backup.local',
    rootKey: 'destination.backup.local',
    provenance: 'CREATED',
    health: 'VERIFIED',
    finalIdentitySha256: HASH_E,
    manifestSha256: HASH_A,
    databaseSha256: HASH_B,
    artifactCount: 3,
    byteCount: 4096,
    createdOperationId: 'op-create-001',
    createdAt: T0,
    registeredAt: '2026-08-29T10:00:10.000Z',
    lastVerifiedAt: '2026-08-29T10:00:10.000Z',
  });
  assert.equal(backup.health, 'VERIFIED');
  const succeeded = ledger.succeedOperation({
    operationId: claimed.operationId,
    workerId: 'worker.operations.001',
    expectedGeneration: 1,
    manifestSha256: HASH_A,
    artifactCount: 3,
    byteCount: 4096,
    verifiedAt: '2026-08-29T10:00:10.000Z',
    now: '2026-08-29T10:00:11.000Z',
  });
  assert.equal(succeeded.status, 'SUCCEEDED');
  assert.equal(succeeded.phase, 'COMPLETED');
  assert.deepEqual(ledger.listOperationEvents(claimed.operationId).map(({ code }) => code), [
    'RESERVED', 'CLAIMED',
    'PHASE_ADVANCED', 'PHASE_ADVANCED', 'PHASE_ADVANCED', 'PHASE_ADVANCED',
    'PHASE_ADVANCED', 'PHASE_ADVANCED', 'PHASE_ADVANCED', 'SUCCEEDED',
  ]);
  assert.throws(
    () => inspection.prepare("UPDATE operation_events SET event_code = 'FAILED' WHERE operation_id = ? AND sequence = 1").run(claimed.operationId),
    /append-only/,
  );
  assert.throws(
    () => inspection.prepare('DELETE FROM operation_events WHERE operation_id = ? AND sequence = 1').run(claimed.operationId),
    /append-only/,
  );

  assert.equal(ledger.recordBackupHealth({ backupId: 'backup-001', health: 'SUSPECT' }).health, 'SUSPECT');
  assert.equal(ledger.recordBackupHealth({
    backupId: 'backup-001',
    health: 'VERIFIED',
    finalIdentitySha256: HASH_E,
    manifestSha256: HASH_A,
    databaseSha256: HASH_B,
    artifactCount: 3,
    byteCount: 4096,
    verifiedAt: '2026-08-29T10:05:00.000Z',
  }).health, 'VERIFIED');
  assert.equal(ledger.recordRecoveryTestPassed({
    backupId: 'backup-001',
    testedAt: '2026-08-29T10:06:00.000Z',
  }).lastRecoveryTestedAt, '2026-08-29T10:06:00.000Z');
});

test('ledger supports exact restore lifecycle and restart-only reconciliation fencing without activation authority', async (context) => {
  const root = await controlRoot(context, 'numberdroid-operations-reconcile-');
  const ledger = await OperationsLedger.open({ controlRoot: root });
  afterTestCleanup(context, () => ledger.close());
  ledger.registerBackup({
    backupId: 'source-001',
    destinationId: 'destination.backup.local',
    rootKey: 'destination.backup.local',
    provenance: 'DISCOVERED',
    health: 'VERIFIED',
    finalIdentitySha256: HASH_A,
    manifestSha256: HASH_B,
    databaseSha256: HASH_C,
    artifactCount: 2,
    byteCount: 2048,
    createdAt: T0,
    registeredAt: T0,
    lastVerifiedAt: T0,
  });
  ledger.reserveOperation({
    operationId: 'op-restore-001',
    kind: 'RESTORE_AS_COPY',
    idempotencyKey: 'idem.restore.001',
    requestFingerprint: HASH_D,
    creatorSubject: 'operator.session.002',
    destinationId: 'destination.restore.local',
    backupId: 'source-001',
    outputId: 'copy-001',
    now: T0,
  });
  const firstClaim = ledger.claimNext({
    workerId: 'worker.before-crash',
    now: '2026-08-29T10:00:01.000Z',
    leaseExpiresAt: '2026-08-29T10:00:31.000Z',
  });
  const reclaimed = ledger.reclaimForReconciliation({
    operationId: firstClaim.operationId,
    workerId: 'worker.after-restart',
    expectedGeneration: 1,
    now: '2026-08-29T10:01:00.000Z',
    leaseExpiresAt: '2026-08-29T10:01:30.000Z',
  });
  assert.equal(reclaimed.lease.generation, 2);
  assert.throws(
    () => ledger.advanceOperation({
      operationId: reclaimed.operationId,
      workerId: 'worker.before-crash',
      expectedGeneration: 1,
      phase: 'BACKUP_VERIFIED',
      now: '2026-08-29T10:01:01.000Z',
    }),
    (error) => error.code === 'OPERATION_LEASE_LOST',
  );
  ledger.reserveStage({
    stageId: 'stage.restore.001',
    operationId: reclaimed.operationId,
    kind: 'RESTORE_COPY',
    rootKey: 'destination.restore.local',
    rootIdentitySha256: HASH_D,
    filesystemIdentitySha256: HASH_E,
    now: '2026-08-29T10:01:01.000Z',
  });
  advanceAll(ledger, reclaimed, 'worker.after-restart', [
    'BACKUP_VERIFIED', 'COPY_STAGED', 'COPY_VERIFIED', 'QUARANTINE_WRITTEN',
    'DURABLY_CLOSED', 'PUBLISHED',
  ], 62);
  const copy = ledger.registerRestoredCopy({
    copyId: 'copy-001',
    sourceBackupId: 'source-001',
    destinationId: 'destination.restore.local',
    rootKey: 'destination.restore.local',
    finalIdentitySha256: HASH_A,
    manifestSha256: HASH_B,
    artifactCount: 2,
    byteCount: 2048,
    createdOperationId: 'op-restore-001',
    verifiedAt: '2026-08-29T10:02:00.000Z',
  });
  assert.deepEqual(copy, {
    schemaVersion: 1,
    copyId: 'copy-001',
    sourceBackupId: 'source-001',
    destinationId: 'destination.restore.local',
    lifecycle: 'QUARANTINED_VERIFIED',
    manifestSha256: HASH_B,
    artifactCount: 2,
    byteCount: 2048,
    verifiedAt: '2026-08-29T10:02:00.000Z',
  });
  const complete = ledger.succeedOperation({
    operationId: 'op-restore-001',
    workerId: 'worker.after-restart',
    expectedGeneration: 2,
    manifestSha256: HASH_B,
    artifactCount: 2,
    byteCount: 2048,
    verifiedAt: '2026-08-29T10:02:00.000Z',
    now: '2026-08-29T10:02:01.000Z',
  });
  assert.equal(complete.status, 'SUCCEEDED');
  assert.equal(Object.hasOwn(copy, 'activate'), false);
  assert.equal(Object.hasOwn(copy, 'path'), false);

  ledger.reserveOperation({
    operationId: 'op-verify-001',
    kind: 'VERIFY',
    idempotencyKey: 'idem.verify.001',
    requestFingerprint: HASH_A,
    creatorSubject: 'operator.session.002',
    backupId: 'source-001',
    now: '2026-08-29T10:03:00.000Z',
  });
  const verify = ledger.claimNext({
    workerId: 'worker.verify',
    now: '2026-08-29T10:03:01.000Z',
    leaseExpiresAt: '2026-08-29T10:03:31.000Z',
  });
  advanceAll(ledger, verify, 'worker.verify', ['BACKUP_RESOLVED', 'CONTENT_VERIFIED'], 182);
  ledger.recordBackupHealth({
    backupId: 'source-001',
    health: 'VERIFIED',
    finalIdentitySha256: HASH_A,
    manifestSha256: HASH_B,
    databaseSha256: HASH_C,
    artifactCount: 2,
    byteCount: 2048,
    verifiedAt: '2026-08-29T10:03:04.000Z',
  });
  assert.equal(ledger.succeedOperation({
    operationId: verify.operationId,
    workerId: 'worker.verify',
    expectedGeneration: verify.lease.generation,
    manifestSha256: HASH_B,
    artifactCount: 2,
    byteCount: 2048,
    verifiedAt: '2026-08-29T10:03:04.000Z',
    now: '2026-08-29T10:03:05.000Z',
  }).status, 'SUCCEEDED');

  ledger.reserveOperation({
    operationId: 'op-recovery-001',
    kind: 'RECOVERY_TEST',
    idempotencyKey: 'idem.recovery.001',
    requestFingerprint: HASH_C,
    creatorSubject: 'operator.session.002',
    backupId: 'source-001',
    now: '2026-08-29T10:04:00.000Z',
  });
  const recovery = ledger.claimNext({
    workerId: 'worker.recovery',
    now: '2026-08-29T10:04:01.000Z',
    leaseExpiresAt: '2026-08-29T10:04:31.000Z',
  });
  ledger.reserveStage({
    stageId: 'stage.recovery.001',
    operationId: recovery.operationId,
    kind: 'RECOVERY_TEST',
    rootKey: 'control.recovery-tests',
    rootIdentitySha256: HASH_D,
    filesystemIdentitySha256: HASH_E,
    now: '2026-08-29T10:04:02.000Z',
  });
  advanceAll(ledger, recovery, 'worker.recovery', [
    'BACKUP_VERIFIED', 'COPY_STAGED', 'COPY_VERIFIED', 'READ_ONLY_OPENED',
    'PARITY_VERIFIED', 'TEST_COPY_CLEANED',
  ], 242);
  ledger.recordRecoveryTestPassed({
    backupId: 'source-001',
    testedAt: '2026-08-29T10:04:09.000Z',
  });
  assert.equal(ledger.succeedOperation({
    operationId: recovery.operationId,
    workerId: 'worker.recovery',
    expectedGeneration: recovery.lease.generation,
    manifestSha256: HASH_B,
    artifactCount: 2,
    byteCount: 2048,
    verifiedAt: '2026-08-29T10:04:09.000Z',
    now: '2026-08-29T10:04:10.000Z',
  }).status, 'SUCCEEDED');

  ledger.reserveOperation({
    operationId: 'op-verify-interrupted',
    kind: 'VERIFY',
    idempotencyKey: 'idem.verify.interrupted',
    requestFingerprint: HASH_E,
    creatorSubject: 'operator.session.002',
    backupId: 'source-001',
    now: '2026-08-29T10:05:00.000Z',
  });
  const verifyClaim = ledger.claimNext({
    workerId: 'worker.interrupted',
    now: '2026-08-29T10:05:01.000Z',
    leaseExpiresAt: '2026-08-29T10:05:31.000Z',
  });
  const interrupted = ledger.interruptOperation({
    operationId: verifyClaim.operationId,
    expectedGeneration: verifyClaim.lease.generation,
    now: '2026-08-29T10:06:00.000Z',
  });
  assert.equal(interrupted.status, 'INTERRUPTED');
  assert.deepEqual(interrupted.failure, {
    code: 'OPERATION_INTERRUPTED',
    message: 'The interrupted operation could not be resumed safely.',
  });
  assert.equal(JSON.stringify(interrupted).includes(root), false);
});
