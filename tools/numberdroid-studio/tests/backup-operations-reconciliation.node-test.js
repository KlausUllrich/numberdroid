import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cp, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  LOCAL_WORKSPACE_OPERATOR_KIND,
  LOCAL_WORKSPACE_OPERATOR_SUBJECT,
  WORKSPACE_BACKUP_CAPABILITY,
} from '../packages/application/src/backup-operation-service.js';
import { backupOperationRequestFingerprint } from '../packages/domain/src/backup-operation.js';
import { ContentAddressedArtifactStore } from '../packages/persistence/src/artifacts/content-addressed-artifact-store.js';
import { createWorkspaceBackup } from '../packages/persistence/src/backup/workspace-backup.js';
import { reconcileBackupOperations } from '../packages/persistence/src/operations/backup-operation-reconciler.js';
import { BackupOperationsRuntime } from '../packages/persistence/src/operations/backup-operations-runtime.js';
import { validateOperationsConfiguration } from '../packages/persistence/src/operations/operations-config.js';
import { OperationsFilesystem } from '../packages/persistence/src/operations/safe-filesystem.js';
import { OperationsLedger } from '../packages/persistence/src/operations/operations-ledger.js';
import { OperationsLock } from '../packages/persistence/src/operations/operations-lock.js';
import { SqliteProjectStore } from '../packages/persistence/src/sqlite/sqlite-project-store.js';
import { createHarness, createProject } from './test-helpers.js';
import { afterTestCleanup, nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';

const NOW = '2026-08-29T15:00:00.000Z';
const WORKER_ID = 'test.crashed-worker';

test('injected Win32 reconciliation uses the fixed descendant proof before discovery', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'numberdroid-o1a-reconcile-win-proof-'));
  afterTestCleanup(context, () => rm(root, { recursive: true, force: true }));
  const store = await SqliteProjectStore.open({
    filename: join(root, 'live', 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  afterTestCleanup(context, () => store.close());
  await createProject(createHarness(store).studio);
  const artifacts = new ContentAddressedArtifactStore({
    rootDirectory: join(root, 'live', 'artifacts'),
  });
  const backup = join(root, 'candidate');
  await createWorkspaceBackup({
    projectStore: store,
    artifactStore: artifacts,
    destinationDirectory: backup,
    clock: () => NOW,
  });
  let helperAttempts = 0;
  let registered = false;
  const summary = await reconcileBackupOperations({
    ledger: {
      listOperationsForReconciliation: () => [],
      listStages: () => [],
      getBackup: () => null,
      registerBackup: () => { registered = true; },
    },
    filesystem: {
      discoverOperationEntries: async () => [Object.freeze({
        kind: 'BACKUP',
        role: 'FINAL',
        opaqueId: '11111111-1111-4111-8111-111111111111',
        destinationId: 'backup.win32',
        rootKey: 'backup.win32',
        identity: Object.freeze({}),
        path: backup,
      })],
      identitySha256: () => '0'.repeat(64),
    },
    clock: () => NOW,
    platform: 'win32',
    spawnProcess: () => {
      helperAttempts += 1;
      throw new Error('injected fixed-helper failure');
    },
  });
  assert.deepEqual(summary, {
    queued: 0,
    succeeded: 0,
    interrupted: 0,
    orphaned: 0,
    discovered: 0,
    rejectedFinals: 1,
  });
  assert.equal(helperAttempts, 1);
  assert.equal(registered, false);
});

test('discovery revalidates root and final identity after canonical verification', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'numberdroid-o1a-discovery-revalidate-'));
  afterTestCleanup(context, () => rm(root, { recursive: true, force: true }));
  const store = await SqliteProjectStore.open({
    filename: join(root, 'live', 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  afterTestCleanup(context, () => store.close());
  await createProject(createHarness(store).studio);
  const artifacts = new ContentAddressedArtifactStore({
    rootDirectory: join(root, 'live', 'artifacts'),
  });
  const backup = join(root, 'candidate');
  await createWorkspaceBackup({
    projectStore: store,
    artifactStore: artifacts,
    destinationDirectory: backup,
    clock: () => NOW,
  });

  const backupId = '11111111-1111-4111-8111-111111111111';
  const originalIdentity = 'a'.repeat(64);
  for (const changedEvidence of ['root', 'final']) {
    let registered = false;
    let resolveCalls = 0;
    const summary = await reconcileBackupOperations({
      ledger: {
        listOperationsForReconciliation: () => [],
        listStages: () => [],
        getBackup: () => null,
        registerBackup: () => { registered = true; },
      },
      filesystem: {
        discoverOperationEntries: async () => [Object.freeze({
          kind: 'BACKUP',
          role: 'FINAL',
          opaqueId: backupId,
          basename: `backup-${backupId}`,
          destinationId: 'backup.local',
          rootKey: 'backup.local',
          rootIdentitySha256: 'root.identity',
          filesystemIdentitySha256: 'filesystem.identity',
          identity: Object.freeze({ sha256: originalIdentity }),
          path: backup,
        })],
        async resolveBackup() {
          resolveCalls += 1;
          return Object.freeze({
            backupId,
            destinationId: 'backup.local',
            finalPath: backup,
            root: Object.freeze({
              rootKey: changedEvidence === 'root' ? 'changed.root' : 'root.identity',
              filesystemKey: 'filesystem.identity',
            }),
            identity: Object.freeze({
              sha256: changedEvidence === 'final' ? 'b'.repeat(64) : originalIdentity,
            }),
          });
        },
        identitySha256: (identity) => identity.sha256,
      },
      clock: () => NOW,
      platform: 'linux',
    });
    assert.equal(resolveCalls, 1, `${changedEvidence} evidence must be resolved again after verification`);
    assert.equal(registered, false, `${changedEvidence} identity drift must block discovery registration`);
    assert.equal(summary.discovered, 0);
    assert.equal(summary.rejectedFinals, 1);
  }
});

function operatorContext() {
  return {
    schemaVersion: 1,
    kind: LOCAL_WORKSPACE_OPERATOR_KIND,
    subject: LOCAL_WORKSPACE_OPERATOR_SUBJECT,
    capabilities: [WORKSPACE_BACKUP_CAPABILITY],
  };
}

async function runCreate(runtime, destinationId, idempotencyKey) {
  const accepted = await runtime.requestOperation({
    schemaVersion: 1,
    kind: 'CREATE',
    destinationId,
    idempotencyKey,
  }, operatorContext());
  assert.equal((await runtime.runNext()).status, 'SUCCEEDED');
  return runtime.readOperation({ schemaVersion: 1, operationId: accepted.operationId }, operatorContext());
}

function advance(ledger, operationId, generation, phase) {
  return ledger.advanceOperation({
    operationId,
    workerId: WORKER_ID,
    expectedGeneration: generation,
    phase,
    now: NOW,
  });
}

test('restart reconciliation completes only an identity-proved publication and classifies unknown outputs', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'numberdroid-o1a-reconcile-'));
  afterTestCleanup(context, () => rm(root, { recursive: true, force: true }));
  const liveRoot = join(root, 'live');
  const controlRoot = join(root, 'control');
  const backupRoot = join(root, 'backups');
  const discoveryRoot = join(root, 'discovery');
  const restoreRoot = join(root, 'restore');
  await Promise.all([controlRoot, backupRoot, discoveryRoot, restoreRoot]
    .map((path) => mkdir(path, { mode: 0o700 })));
  const configuration = {
    schemaVersion: 1,
    controlRoot,
    backupDestinations: [
      { destinationId: 'backup.primary', label: 'Primary backups', root: backupRoot },
      { destinationId: 'backup.discovery', label: 'Discovery backups', root: discoveryRoot },
    ],
    restoreDestinations: [
      { destinationId: 'restore.local', label: 'Restored copies', root: restoreRoot },
    ],
  };

  const liveStore = await SqliteProjectStore.open({
    filename: join(liveRoot, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  afterTestCleanup(context, () => liveStore.close());
  await createProject(createHarness(liveStore).studio);
  const artifacts = new ContentAddressedArtifactStore({ rootDirectory: join(liveRoot, 'artifacts') });
  let runtime = await BackupOperationsRuntime.open({
    configuration,
    liveWorkspaceRoot: liveRoot,
    projectStore: liveStore,
    artifactStore: artifacts,
    clock: () => NOW,
    workspaceDatabaseFactory: nodeSqliteDatabaseFactory,
  });
  afterTestCleanup(context, () => runtime?.close());
  const baseline = await runCreate(runtime, 'backup.primary', 'reconcile.baseline');
  await runtime.close();

  const validated = await validateOperationsConfiguration(configuration, { liveWorkspaceRoot: liveRoot });
  const operationId = randomUUID();
  const backupId = randomUUID();
  const interruptedCreateId = randomUUID();
  const interruptedCreateBackupId = randomUUID();
  const interruptedRecoveryId = randomUUID();
  const lock = await OperationsLock.acquire({ controlRoot });
  const ledger = await OperationsLedger.open({ controlRoot });
  try {
    const filesystem = await OperationsFilesystem.create({ configuration: validated });
    const request = {
      schemaVersion: 1,
      kind: 'CREATE',
      destinationId: 'backup.primary',
      idempotencyKey: 'reconcile.crashed-create',
    };
    ledger.reserveOperation({
      operationId,
      kind: 'CREATE',
      idempotencyKey: request.idempotencyKey,
      requestFingerprint: backupOperationRequestFingerprint(request),
      creatorSubject: LOCAL_WORKSPACE_OPERATOR_SUBJECT,
      destinationId: request.destinationId,
      outputId: backupId,
      now: NOW,
    });
    const claimed = ledger.claimNext({
      workerId: WORKER_ID,
      leaseExpiresAt: '2026-08-29T15:01:00.000Z',
      now: NOW,
    });
    const allocated = await filesystem.allocatePublished({
      kind: 'CREATE',
      destinationId: request.destinationId,
      operationId,
      outputId: backupId,
    });
    ledger.reserveStage({
      stageId: `stage.${operationId}`,
      operationId,
      kind: 'BACKUP',
      rootKey: request.destinationId,
      rootIdentitySha256: allocated.root.rootKey,
      filesystemIdentitySha256: allocated.root.filesystemKey,
      now: NOW,
    });
    advance(ledger, operationId, claimed.lease.generation, 'SOURCE_VERIFIED');
    await createWorkspaceBackup({
      projectStore: liveStore,
      artifactStore: artifacts,
      destinationDirectory: allocated.stagePath,
      clock: () => NOW,
    });
    const stageIdentity = await filesystem.inspectOperationDirectory(allocated.stagePath);
    ledger.recordStageEvidence({
      stageId: `stage.${operationId}`,
      stageIdentitySha256: filesystem.identitySha256(stageIdentity),
      now: NOW,
    });
    for (const phase of [
      'DB_SNAPSHOTTED', 'CAS_COPIED', 'MANIFEST_WRITTEN',
      'SNAPSHOT_VERIFIED',
    ]) advance(ledger, operationId, claimed.lease.generation, phase);
    await filesystem.durableStage(allocated.stagePath);
    advance(ledger, operationId, claimed.lease.generation, 'DURABLY_CLOSED');
    await filesystem.publish(allocated);

    const interruptedCreateRequest = {
      schemaVersion: 1,
      kind: 'CREATE',
      destinationId: 'backup.primary',
      idempotencyKey: 'reconcile.interrupted-create',
    };
    ledger.reserveOperation({
      operationId: interruptedCreateId,
      kind: 'CREATE',
      idempotencyKey: interruptedCreateRequest.idempotencyKey,
      requestFingerprint: backupOperationRequestFingerprint(interruptedCreateRequest),
      creatorSubject: LOCAL_WORKSPACE_OPERATOR_SUBJECT,
      destinationId: interruptedCreateRequest.destinationId,
      outputId: interruptedCreateBackupId,
      now: NOW,
    });
    const interruptedCreateClaim = ledger.claimNext({
      workerId: WORKER_ID,
      leaseExpiresAt: '2026-08-29T15:01:00.000Z',
      now: NOW,
    });
    assert.equal(interruptedCreateClaim.operationId, interruptedCreateId);
    const interruptedCreateStage = await filesystem.allocatePublished({
      kind: 'CREATE',
      destinationId: 'backup.primary',
      operationId: interruptedCreateId,
      outputId: interruptedCreateBackupId,
    });
    ledger.reserveStage({
      stageId: `stage.${interruptedCreateId}`,
      operationId: interruptedCreateId,
      kind: 'BACKUP',
      rootKey: 'backup.primary',
      rootIdentitySha256: interruptedCreateStage.root.rootKey,
      filesystemIdentitySha256: interruptedCreateStage.root.filesystemKey,
      now: NOW,
    });
    await mkdir(interruptedCreateStage.stagePath, { mode: 0o700 });
    const interruptedStageIdentity = await filesystem.inspectOperationDirectory(interruptedCreateStage.stagePath);
    ledger.recordStageEvidence({
      stageId: `stage.${interruptedCreateId}`,
      stageIdentitySha256: filesystem.identitySha256(interruptedStageIdentity),
      now: NOW,
    });
    advance(ledger, interruptedCreateId, interruptedCreateClaim.lease.generation, 'SOURCE_VERIFIED');

    const recoveryRequest = {
      schemaVersion: 1,
      kind: 'RECOVERY_TEST',
      backupId: baseline.backupId,
      idempotencyKey: 'reconcile.interrupted-recovery',
    };
    ledger.reserveOperation({
      operationId: interruptedRecoveryId,
      kind: 'RECOVERY_TEST',
      idempotencyKey: recoveryRequest.idempotencyKey,
      requestFingerprint: backupOperationRequestFingerprint(recoveryRequest),
      creatorSubject: LOCAL_WORKSPACE_OPERATOR_SUBJECT,
      backupId: baseline.backupId,
      now: NOW,
    });
    const recoveryClaim = ledger.claimNext({
      workerId: WORKER_ID,
      leaseExpiresAt: '2026-08-29T15:01:00.000Z',
      now: NOW,
    });
    assert.equal(recoveryClaim.operationId, interruptedRecoveryId);
    advance(ledger, interruptedRecoveryId, recoveryClaim.lease.generation, 'BACKUP_VERIFIED');
    const recoveryStage = await filesystem.recoveryTestCoordinate({ operationId: interruptedRecoveryId });
    ledger.reserveStage({
      stageId: `stage.${interruptedRecoveryId}`,
      operationId: interruptedRecoveryId,
      kind: 'RECOVERY_TEST',
      rootKey: 'control.recovery-tests',
      rootIdentitySha256: recoveryStage.root.rootKey,
      filesystemIdentitySha256: recoveryStage.root.filesystemKey,
      now: NOW,
    });
    await mkdir(recoveryStage.path, { mode: 0o700 });
    const recoveryIdentity = await filesystem.inspectOperationDirectory(recoveryStage.path);
    ledger.recordStageEvidence({
      stageId: `stage.${interruptedRecoveryId}`,
      stageIdentitySha256: filesystem.identitySha256(recoveryIdentity),
      now: NOW,
    });
    advance(ledger, interruptedRecoveryId, recoveryClaim.lease.generation, 'COPY_STAGED');
  } finally {
    ledger.close();
    lock.close();
  }

  const discoveredId = randomUUID();
  await cp(
    join(backupRoot, `backup-${baseline.backupId}`),
    join(discoveryRoot, `backup-${discoveredId}`),
    { recursive: true, errorOnExist: true, force: false },
  );
  const orphanId = randomUUID();
  const orphanPath = join(discoveryRoot, `.numberdroid-backup-stage-${orphanId}`);
  await mkdir(orphanPath, { mode: 0o700 });
  const rejectedId = randomUUID();
  await mkdir(join(discoveryRoot, `backup-${rejectedId}`), { mode: 0o700 });

  runtime = await BackupOperationsRuntime.open({
    configuration,
    liveWorkspaceRoot: liveRoot,
    projectStore: liveStore,
    artifactStore: artifacts,
    clock: () => NOW,
    workspaceDatabaseFactory: nodeSqliteDatabaseFactory,
  });
  assert.deepEqual(runtime.reconciliationSummary, {
    queued: 0,
    succeeded: 1,
    interrupted: 2,
    orphaned: 1,
    discovered: 1,
    rejectedFinals: 1,
  });
  const reconciled = await runtime.readOperation({ schemaVersion: 1, operationId }, operatorContext());
  assert.equal(reconciled.status, 'SUCCEEDED');
  assert.equal(reconciled.backupId, backupId);
  const interruptedCreate = await runtime.readOperation({
    schemaVersion: 1,
    operationId: interruptedCreateId,
  }, operatorContext());
  assert.equal(interruptedCreate.status, 'INTERRUPTED');
  const interruptedRecovery = await runtime.readOperation({
    schemaVersion: 1,
    operationId: interruptedRecoveryId,
  }, operatorContext());
  assert.equal(interruptedRecovery.status, 'INTERRUPTED');
  await assert.rejects(
    readdir(join(controlRoot, 'recovery-tests', `.numberdroid-recovery-stage-${interruptedRecoveryId}`)),
    (error) => error.code === 'ENOENT',
  );
  const backups = runtime.listBackups(operatorContext());
  assert.equal(backups.length, 3);
  assert.equal(backups.find((backup) => backup.backupId === backupId).provenance, 'CREATED');
  assert.equal(backups.find((backup) => backup.backupId === discoveredId).provenance, 'DISCOVERED');
  assert.equal(backups.some((backup) => backup.backupId === rejectedId), false);
  await assert.doesNotReject(mkdir(orphanPath, { recursive: true }));

  await runtime.close();
  runtime = await BackupOperationsRuntime.open({
    configuration,
    liveWorkspaceRoot: liveRoot,
    projectStore: liveStore,
    artifactStore: artifacts,
    clock: () => NOW,
    workspaceDatabaseFactory: nodeSqliteDatabaseFactory,
  });
  assert.deepEqual(runtime.reconciliationSummary, {
    queued: 0,
    succeeded: 0,
    interrupted: 0,
    orphaned: 0,
    discovered: 0,
    rejectedFinals: 1,
  });
});
