import test from 'node:test';
import assert from 'node:assert/strict';
import {
  access, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StudioService } from '../packages/application/src/index.js';
import { BackupOperationWorker } from '../packages/application/src/backup-operation-worker.js';
import { StudioError } from '../packages/domain/src/errors.js';
import {
  ContentAddressedArtifactStore,
  SqliteProjectStore,
  createWorkspaceBackup,
  verifyWorkspaceBackup,
} from '../packages/persistence/src/index.js';
import {
  BackupOperationPhaseExecutor,
  OperationEvidenceVault,
} from '../packages/persistence/src/operations/backup-operation-phase-executor.js';
import { reconcileBackupOperations } from '../packages/persistence/src/operations/backup-operation-reconciler.js';
import { OperationsFilesystem } from '../packages/persistence/src/operations/safe-filesystem.js';
import { OperationsLedger } from '../packages/persistence/src/operations/operations-ledger.js';
import { OperationsStoreAdapter } from '../packages/persistence/src/operations/operations-store-adapter.js';
import { createHarness, createProject } from './test-helpers.js';
import { afterTestCleanup, nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';
import { validateOperationsConfiguration } from '../packages/persistence/src/operations/operations-config.js';

async function createEmptyBackup(context) {
  const root = await mkdtemp(join(tmpdir(), 'numberdroid-backup-primitives-'));
  afterTestCleanup(context, () => rm(root, { recursive: true, force: true }));
  const store = await SqliteProjectStore.open({
    filename: join(root, 'live', 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  afterTestCleanup(context, () => store.close());
  await createProject(createHarness(store).studio);
  const artifacts = new ContentAddressedArtifactStore({ rootDirectory: join(root, 'live', 'artifacts') });
  const backup = join(root, 'backup');
  await createWorkspaceBackup({ projectStore: store, artifactStore: artifacts, destinationDirectory: backup });
  return { root, store, backup };
}

test('canonical backup verification rejects manifest path substitution and unexpected content', async (context) => {
  const { backup } = await createEmptyBackup(context);
  const manifestPath = join(backup, 'workspace-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.database.filename = '../live/studio.sqlite';
  await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);
  await assert.rejects(
    verifyWorkspaceBackup(backup),
    (error) => error.code === 'BACKUP_SCHEMA_UNSUPPORTED',
  );

  manifest.database.filename = 'studio.sqlite';
  await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);
  await writeFile(join(backup, 'unexpected.txt'), 'not part of the backup');
  await assert.rejects(
    verifyWorkspaceBackup(backup),
    (error) => error.code === 'BACKUP_CONTENT_MISMATCH',
  );
});

test('canonical verification does not create missing CAS layout while failing', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'numberdroid-backup-no-repair-'));
  afterTestCleanup(context, () => rm(root, { recursive: true, force: true }));
  const backup = join(root, 'backup');
  await mkdir(backup, { mode: 0o700 });
  await writeFile(join(backup, 'studio.sqlite'), 'not sqlite', { mode: 0o600 });
  await writeFile(join(backup, 'workspace-manifest.json'), `${JSON.stringify({
    schemaVersion: 1,
    createdAt: '2026-08-29T00:00:00.000Z',
    database: { filename: 'studio.sqlite', sha256: '0'.repeat(64) },
    artifacts: { schemaVersion: 1, algorithm: 'sha256', entries: [] },
    integrity: { ok: true },
  })}\n`, { mode: 0o600 });
  await assert.rejects(
    verifyWorkspaceBackup(backup),
    (error) => error.code === 'BACKUP_CONTENT_MISMATCH',
  );
  await assert.rejects(access(join(backup, 'artifacts')));
});

test('phase executor records only completed effects and a killed worker cannot claim the next phase', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'numberdroid-backup-phase-effects-'));
  afterTestCleanup(context, () => rm(root, { recursive: true, force: true }));
  const liveRoot = join(root, 'live');
  const controlRoot = join(root, 'control');
  const backupRoot = join(root, 'backups');
  const restoreRoot = join(root, 'restores');
  await Promise.all([controlRoot, backupRoot, restoreRoot]
    .map((path) => mkdir(path, { mode: 0o700 })));
  const store = await SqliteProjectStore.open({
    filename: join(liveRoot, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  afterTestCleanup(context, () => store.close());
  await createProject(createHarness(store).studio);
  const artifacts = new ContentAddressedArtifactStore({
    rootDirectory: join(liveRoot, 'artifacts'),
  });
  const ledger = await OperationsLedger.open({ controlRoot });
  afterTestCleanup(context, () => ledger.close());
  const validatedConfiguration = await validateOperationsConfiguration({
    schemaVersion: 1,
    controlRoot,
    backupDestinations: [{ destinationId: 'backup.local', label: 'Backups', root: backupRoot }],
    restoreDestinations: [{ destinationId: 'restore.local', label: 'Restores', root: restoreRoot }],
  }, { liveWorkspaceRoot: liveRoot });
  const filesystem = await OperationsFilesystem.create({ configuration: validatedConfiguration });

  const ids = Object.freeze({
    createOperation: '10000000-0000-4000-8000-000000000001',
    backup: '20000000-0000-4000-8000-000000000002',
    restoreOperation: '30000000-0000-4000-8000-000000000003',
    restoredCopy: '40000000-0000-4000-8000-000000000004',
    verifyOperation: '50000000-0000-4000-8000-000000000005',
    reverifyOperation: '60000000-0000-4000-8000-000000000006',
    recoveryOperation: '70000000-0000-4000-8000-000000000007',
    killedOperation: '80000000-0000-4000-8000-000000000008',
    killedBackup: '90000000-0000-4000-8000-000000000009',
    prepublishRestoreOperation: 'a0000000-0000-4000-8000-00000000000a',
    prepublishRestoredCopy: 'b0000000-0000-4000-8000-00000000000b',
    swappedRootOperation: 'c0000000-0000-4000-8000-00000000000c',
    swappedRootBackup: 'd0000000-0000-4000-8000-00000000000d',
    windowsProofOperation: 'e0000000-0000-4000-8000-00000000000e',
  });
  let fingerprintDigit = 0;
  function reserve({ operationId, kind, destinationId = null, backupId = null, outputId = null }) {
    fingerprintDigit += 1;
    return ledger.reserveOperation({
      operationId,
      kind,
      idempotencyKey: `phase.effect.${fingerprintDigit}`,
      requestFingerprint: String(fingerprintDigit).repeat(64),
      creatorSubject: 'local.workspace-operator',
      destinationId,
      backupId,
      outputId,
      now: '2026-08-29T14:00:00.000Z',
    });
  }
  function worker({
    faultInjector = null,
    databaseFactory = nodeSqliteDatabaseFactory,
    platform = 'linux',
    spawnProcess,
  } = {}) {
    const evidenceVault = new OperationEvidenceVault();
    const executor = new BackupOperationPhaseExecutor({
      ledger,
      filesystem,
      projectStore: store,
      artifactStore: artifacts,
      evidenceVault,
      clock: () => '2026-08-29T14:00:00.000Z',
      databaseFactory,
      platform,
      ...(spawnProcess ? { spawnProcess } : {}),
      faultInjector,
    });
    const adapter = new OperationsStoreAdapter({
      ledger,
      filesystem,
      evidenceVault,
      clock: () => '2026-08-29T14:00:00.000Z',
    });
    return new BackupOperationWorker({
      store: adapter.asWorkerStore(),
      phaseExecutor: executor.asPhaseExecutor(),
    });
  }

  const createStage = join(backupRoot, `.numberdroid-backup-stage-${ids.createOperation}`);
  const restoreStage = join(restoreRoot, `.numberdroid-restore-stage-${ids.restoreOperation}`);
  const observed = [];
  const observer = async ({ point }) => {
    if (point === 'create.db_snapshotted') {
      observed.push([point, (await readdir(createStage)).sort()]);
    } else if (point === 'create.cas_copied' || point === 'create.manifest_written') {
      observed.push([point, (await readdir(createStage)).sort()]);
    } else if (point === 'restore.copy_bytes_staged'
        || point === 'restore.copy_verified'
        || point === 'restore.quarantine_written') {
      observed.push([point, (await readdir(restoreStage)).sort()]);
    }
  };
  reserve({
    operationId: ids.createOperation,
    kind: 'CREATE',
    destinationId: 'backup.local',
    outputId: ids.backup,
  });
  assert.equal((await worker({ faultInjector: observer }).runNext({
    workerId: 'worker.phase.create',
  })).status, 'SUCCEEDED');
  reserve({
    operationId: ids.restoreOperation,
    kind: 'RESTORE_AS_COPY',
    destinationId: 'restore.local',
    backupId: ids.backup,
    outputId: ids.restoredCopy,
  });
  assert.equal((await worker({ faultInjector: observer }).runNext({
    workerId: 'worker.phase.restore',
  })).status, 'SUCCEEDED');
  assert.deepEqual(observed, [
    ['create.db_snapshotted', ['studio.sqlite']],
    ['create.cas_copied', ['artifacts', 'studio.sqlite']],
    ['create.manifest_written', ['artifacts', 'studio.sqlite', 'workspace-manifest.json']],
    ['restore.copy_bytes_staged', ['artifacts', 'studio.sqlite']],
    ['restore.copy_verified', ['artifacts', 'studio.sqlite']],
    ['restore.quarantine_written', [
      '.numberdroid-restored-copy-quarantine.json', 'artifacts', 'studio.sqlite',
    ]],
  ]);

  const publishedBackup = join(backupRoot, `backup-${ids.backup}`);
  await writeFile(join(publishedBackup, 'unexpected'), 'corrupt after resolution target');
  reserve({ operationId: ids.verifyOperation, kind: 'VERIFY', backupId: ids.backup });
  const failedVerify = await worker().runNext({ workerId: 'worker.phase.verify' });
  assert.equal(failedVerify.status, 'FAILED');
  assert.equal(ledger.getOperation(ids.verifyOperation).phase, 'BACKUP_RESOLVED');
  await rm(join(publishedBackup, 'unexpected'));
  reserve({ operationId: ids.reverifyOperation, kind: 'VERIFY', backupId: ids.backup });
  assert.equal((await worker().runNext({ workerId: 'worker.phase.reverify' })).status, 'SUCCEEDED');

  let recoveryDatabaseOpen = 0;
  const recoveryDatabaseFactory = (...args) => {
    recoveryDatabaseOpen += 1;
    if (recoveryDatabaseOpen === 2) throw new Error('injected parity-open failure');
    return nodeSqliteDatabaseFactory(...args);
  };
  const recoveryStage = join(
    controlRoot, 'recovery-tests', `.numberdroid-recovery-stage-${ids.recoveryOperation}`,
  );
  const recoveryEffects = [];
  reserve({ operationId: ids.recoveryOperation, kind: 'RECOVERY_TEST', backupId: ids.backup });
  const failedRecovery = await worker({
    databaseFactory: recoveryDatabaseFactory,
    faultInjector: async ({ point }) => {
      if (point === 'recovery.copy_bytes_staged' || point === 'recovery.quarantine_written') {
        recoveryEffects.push([point, (await readdir(recoveryStage)).sort()]);
      }
    },
  }).runNext({ workerId: 'worker.phase.recovery' });
  assert.equal(failedRecovery.status, 'FAILED');
  assert.equal(ledger.getOperation(ids.recoveryOperation).phase, 'READ_ONLY_OPENED');
  assert.equal(recoveryDatabaseOpen, 2);
  assert.deepEqual(recoveryEffects, [
    ['recovery.copy_bytes_staged', ['artifacts', 'studio.sqlite']],
    ['recovery.quarantine_written', [
      '.numberdroid-restored-copy-quarantine.json', 'artifacts', 'studio.sqlite',
    ]],
  ]);

  let prepublishDatabaseOpen = 0;
  reserve({
    operationId: ids.prepublishRestoreOperation,
    kind: 'RESTORE_AS_COPY',
    destinationId: 'restore.local',
    backupId: ids.backup,
    outputId: ids.prepublishRestoredCopy,
  });
  const failedPrepublishVerify = await worker({
    databaseFactory: () => {
      prepublishDatabaseOpen += 1;
      throw new Error('injected pre-publication SQLite verification failure');
    },
  }).runNext({ workerId: 'worker.phase.prepublish-verify' });
  assert.equal(failedPrepublishVerify.status, 'FAILED');
  assert.equal(ledger.getOperation(ids.prepublishRestoreOperation).phase, 'QUARANTINE_WRITTEN');
  assert.equal(prepublishDatabaseOpen, 1);
  await assert.rejects(access(join(
    restoreRoot, `workspace-copy-${ids.prepublishRestoredCopy}`,
  )));

  const retiredBackupRoot = `${backupRoot}-retired`;
  reserve({
    operationId: ids.swappedRootOperation,
    kind: 'CREATE',
    destinationId: 'backup.local',
    outputId: ids.swappedRootBackup,
  });
  const failedRootSwap = await worker({
    faultInjector: async ({ point }) => {
      if (point === 'create.db_snapshotted') {
        await rename(backupRoot, retiredBackupRoot);
        await mkdir(backupRoot, { mode: 0o700 });
      }
    },
  }).runNext({ workerId: 'worker.phase.root-swap' });
  assert.equal(failedRootSwap.status, 'FAILED');
  assert.equal(failedRootSwap.failure.code, 'BACKUP_PATH_UNSAFE');
  assert.equal(ledger.getOperation(ids.swappedRootOperation).phase, 'DB_SNAPSHOTTED');
  assert.deepEqual(await readdir(join(
    retiredBackupRoot, `.numberdroid-backup-stage-${ids.swappedRootOperation}`,
  )), ['studio.sqlite']);
  await rm(backupRoot, { recursive: true });
  await rename(retiredBackupRoot, backupRoot);

  let windowsProofAttempts = 0;
  reserve({ operationId: ids.windowsProofOperation, kind: 'VERIFY', backupId: ids.backup });
  const failedWindowsProof = await worker({
    platform: 'win32',
    spawnProcess: () => {
      windowsProofAttempts += 1;
      throw new Error('injected Windows proof helper failure');
    },
  }).runNext({ workerId: 'worker.phase.windows-proof' });
  assert.equal(failedWindowsProof.status, 'FAILED');
  assert.equal(failedWindowsProof.failure.code, 'BACKUP_PATH_UNSAFE');
  assert.equal(ledger.getOperation(ids.windowsProofOperation).phase, 'BACKUP_RESOLVED');
  assert.equal(windowsProofAttempts, 1);

  const killedStage = join(backupRoot, `.numberdroid-backup-stage-${ids.killedOperation}`);
  reserve({
    operationId: ids.killedOperation,
    kind: 'CREATE',
    destinationId: 'backup.local',
    outputId: ids.killedBackup,
  });
  await assert.rejects(
    worker({
      faultInjector: ({ point }) => {
        if (point === 'create.db_snapshotted') {
          throw new StudioError('OPERATION_LEASE_LOST', 'Injected worker death.');
        }
      },
    }).runNext({ workerId: 'worker.phase.killed' }),
    (error) => error.code === 'OPERATION_LEASE_LOST',
  );
  assert.deepEqual(await readdir(killedStage), ['studio.sqlite']);
  assert.equal(ledger.getOperation(ids.killedOperation).status, 'RUNNING');
  assert.equal(ledger.getOperation(ids.killedOperation).phase, 'SOURCE_VERIFIED');
  const reconciled = await reconcileBackupOperations({
    ledger,
    filesystem,
    clock: () => '2026-08-29T14:00:00.000Z',
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  assert.equal(reconciled.interrupted, 1);
  assert.equal(ledger.getOperation(ids.killedOperation).status, 'INTERRUPTED');
  assert.equal(ledger.getOperation(ids.killedOperation).phase, 'SOURCE_VERIFIED');
});
