import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { StudioService } from '../packages/application/src/index.js';
import { StudioError } from '../packages/domain/src/errors.js';
import {
  LOCAL_WORKSPACE_OPERATOR_KIND,
  LOCAL_WORKSPACE_OPERATOR_SUBJECT,
  WORKSPACE_BACKUP_CAPABILITY,
} from '../packages/application/src/backup-operation-service.js';
import { ContentAddressedArtifactStore } from '../packages/persistence/src/artifacts/content-addressed-artifact-store.js';
import { BackupOperationsRuntime } from '../packages/persistence/src/operations/backup-operations-runtime.js';
import { OperationsStoreAdapter } from '../packages/persistence/src/operations/operations-store-adapter.js';
import { SqliteArtifactMetadataStore } from '../packages/persistence/src/sqlite/sqlite-artifact-metadata-store.js';
import { SqliteProjectStore } from '../packages/persistence/src/sqlite/sqlite-project-store.js';
import { PROJECT_ID, createHarness, createProject } from './test-helpers.js';
import { afterTestCleanup, nodeSqliteDatabaseFactory, pngHeader } from './persistence-test-helpers.js';

const NOW = '2026-08-29T14:00:00.000Z';

function unavailableWindowsHelper() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = new EventEmitter();
  child.stdin.end = () => {
    queueMicrotask(() => child.emit('error', new Error('injected helper failure')));
  };
  child.kill = () => {};
  return child;
}

function operatorContext() {
  return {
    schemaVersion: 1,
    kind: LOCAL_WORKSPACE_OPERATOR_KIND,
    subject: LOCAL_WORKSPACE_OPERATOR_SUBJECT,
    capabilities: [WORKSPACE_BACKUP_CAPABILITY],
  };
}

async function hashTree(root) {
  const files = [];
  async function visit(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) await visit(child);
      else if (entry.isFile()) files.push(child);
    }
  }
  await visit(root);
  files.sort();
  const hash = createHash('sha256');
  for (const filename of files) {
    hash.update(relative(root, filename));
    hash.update('\0');
    hash.update(await readFile(filename));
    hash.update('\0');
  }
  return hash.digest('hex');
}

async function runToSuccess(runtime, request) {
  const accepted = await runtime.requestOperation(request, operatorContext());
  assert.equal(accepted.status, 'QUEUED');
  const workerResult = await runtime.runNext();
  assert.equal(workerResult.operationId, accepted.operationId);
  assert.equal(workerResult.status, 'SUCCEEDED');
  return runtime.readOperation({ schemaVersion: 1, operationId: accepted.operationId }, operatorContext());
}

test('O1a runtime completes create, verify, recovery test, and restore-as-copy without active mutation', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'numberdroid-o1a-runtime-'));
  afterTestCleanup(context, () => rm(root, { recursive: true, force: true }));
  const liveRoot = join(root, 'live');
  const controlRoot = join(root, 'control');
  const backupRoot = join(root, 'backups');
  const secondBackupRoot = join(root, 'backups-secondary');
  const restoreRoot = join(root, 'restored-copies');
  await Promise.all([controlRoot, backupRoot, secondBackupRoot, restoreRoot]
    .map((path) => mkdir(path, { mode: 0o700 })));

  const liveStore = await SqliteProjectStore.open({
    filename: join(liveRoot, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  afterTestCleanup(context, () => liveStore.close());
  const { studio } = createHarness(liveStore);
  await createProject(studio);
  const artifacts = new ContentAddressedArtifactStore({ rootDirectory: join(liveRoot, 'artifacts') });
  const artifact = await artifacts.ingest(pngHeader({ width: 48, height: 32, tail: 'o1a-runtime' }), {
    mediaType: 'image/png',
  });
  new SqliteArtifactMetadataStore({ workspace: liveStore.workspace }).registerAndReference(artifact, {
    projectId: PROJECT_ID,
    ownerKind: 'source',
    ownerId: 'source.o1a.runtime',
    createdRevision: 1,
  });

  const runtime = await BackupOperationsRuntime.open({
    configuration: {
      schemaVersion: 1,
      controlRoot,
      backupDestinations: [
        {
          destinationId: 'backup.local',
          label: 'Local backup disk',
          root: backupRoot,
        },
        {
          destinationId: 'backup.secondary',
          label: 'Secondary backup disk',
          root: secondBackupRoot,
        },
      ],
      restoreDestinations: [{
        destinationId: 'restore.local',
        label: 'Restored working copies',
        root: restoreRoot,
      }],
    },
    liveWorkspaceRoot: liveRoot,
    projectStore: liveStore,
    artifactStore: artifacts,
    clock: () => NOW,
    workspaceDatabaseFactory: nodeSqliteDatabaseFactory,
  });
  afterTestCleanup(context, () => runtime.close());

  assert.deepEqual(runtime.reconciliationSummary, {
    queued: 0,
    succeeded: 0,
    interrupted: 0,
    orphaned: 0,
    discovered: 0,
    rejectedFinals: 0,
  });
  assert.deepEqual(runtime.listDestinations('CREATE', operatorContext()), [
    { destinationId: 'backup.local', label: 'Local backup disk' },
    { destinationId: 'backup.secondary', label: 'Secondary backup disk' },
  ]);

  const created = await runToSuccess(runtime, {
    schemaVersion: 1,
    kind: 'CREATE',
    destinationId: 'backup.local',
    idempotencyKey: 'o1a.create.001',
  });
  assert.equal(created.result.backupHealth, 'VERIFIED');
  assert.equal(created.result.itemCount, 1);
  const backupId = created.backupId;
  const replay = await runtime.requestOperation({
    schemaVersion: 1,
    kind: 'CREATE',
    destinationId: 'backup.local',
    idempotencyKey: 'o1a.create.001',
  }, operatorContext());
  assert.equal(replay.operationId, created.operationId);
  assert.equal(replay.backupId, backupId);
  await assert.rejects(
    runtime.requestOperation({
      schemaVersion: 1,
      kind: 'CREATE',
      destinationId: 'backup.secondary',
      idempotencyKey: 'o1a.create.001',
    }, operatorContext()),
    (error) => error.code === 'OPERATION_IDEMPOTENCY_CONFLICT',
  );

  const verified = await runToSuccess(runtime, {
    schemaVersion: 1,
    kind: 'VERIFY',
    backupId,
    idempotencyKey: 'o1a.verify.001',
  });
  assert.equal(verified.result.backupHealth, 'VERIFIED');
  const liveBeforeRecovery = await hashTree(liveRoot);

  const recovery = await runToSuccess(runtime, {
    schemaVersion: 1,
    kind: 'RECOVERY_TEST',
    backupId,
    idempotencyKey: 'o1a.recovery.001',
  });
  assert.equal(recovery.result.recoveryTestedAt, NOW);
  assert.equal(await hashTree(liveRoot), liveBeforeRecovery);
  assert.deepEqual(await readdir(join(controlRoot, 'recovery-tests')), []);

  const restored = await runToSuccess(runtime, {
    schemaVersion: 1,
    kind: 'RESTORE_AS_COPY',
    backupId,
    destinationId: 'restore.local',
    idempotencyKey: 'o1a.restore.001',
  });
  assert.equal(restored.result.restoredCopyLifecycle, 'QUARANTINED_VERIFIED');
  assert.equal(await hashTree(liveRoot), liveBeforeRecovery);
  const restoredDatabase = join(restoreRoot, `workspace-copy-${restored.restoredCopyId}`, 'studio.sqlite');
  await assert.rejects(
    SqliteProjectStore.open({ filename: restoredDatabase, databaseFactory: nodeSqliteDatabaseFactory }),
    (error) => error.code === 'RESTORED_COPY_QUARANTINED',
  );

  const backups = runtime.listBackups(operatorContext());
  assert.equal(backups.length, 1);
  assert.equal(backups[0].backupId, backupId);
  assert.equal(backups[0].health, 'VERIFIED');
  assert.equal(backups[0].lastRecoveryTestedAt, NOW);
  assert.doesNotMatch(JSON.stringify({ created, verified, recovery, restored, backups }), /\/tmp\/|operations\.sqlite|workspace-manifest\.json/);

  const trusted = await new StudioService({ store: liveStore }).readProjectTrusted(PROJECT_ID);
  assert.equal(trusted.projectId, PROJECT_ID);
});

test('O1a verification health and destination conflicts fail closed without widening authority', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'numberdroid-o1a-failures-'));
  afterTestCleanup(context, () => rm(root, { recursive: true, force: true }));
  const liveRoot = join(root, 'live');
  const controlRoot = join(root, 'control');
  const backupRoot = join(root, 'backups');
  const restoreRoot = join(root, 'restored-copies');
  await Promise.all([controlRoot, backupRoot, restoreRoot].map((path) => mkdir(path, { mode: 0o700 })));
  const liveStore = await SqliteProjectStore.open({
    filename: join(liveRoot, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  afterTestCleanup(context, () => liveStore.close());
  await createProject(createHarness(liveStore).studio);
  const artifacts = new ContentAddressedArtifactStore({ rootDirectory: join(liveRoot, 'artifacts') });
  const runtime = await BackupOperationsRuntime.open({
    configuration: {
      schemaVersion: 1,
      controlRoot,
      backupDestinations: [{ destinationId: 'backup.local', label: 'Backups', root: backupRoot }],
      restoreDestinations: [{ destinationId: 'restore.local', label: 'Restored copies', root: restoreRoot }],
    },
    liveWorkspaceRoot: liveRoot,
    projectStore: liveStore,
    artifactStore: artifacts,
    clock: () => NOW,
    workspaceDatabaseFactory: nodeSqliteDatabaseFactory,
  });
  afterTestCleanup(context, () => runtime.close());
  const created = await runToSuccess(runtime, {
    schemaVersion: 1,
    kind: 'CREATE',
    destinationId: 'backup.local',
    idempotencyKey: 'o1a.failure.create',
  });
  const backupDirectory = join(backupRoot, `backup-${created.backupId}`);
  const manifestPath = join(backupDirectory, 'workspace-manifest.json');
  const originalManifest = await readFile(manifestPath);
  await writeFile(manifestPath, Buffer.concat([originalManifest, Buffer.from('tamper')]));

  const suspectRequest = await runtime.requestOperation({
    schemaVersion: 1,
    kind: 'VERIFY',
    backupId: created.backupId,
    idempotencyKey: 'o1a.failure.suspect',
  }, operatorContext());
  const suspectResult = await runtime.runNext();
  assert.equal(suspectResult.status, 'FAILED');
  assert.equal(runtime.listBackups(operatorContext())[0].health, 'SUSPECT');
  await assert.rejects(
    runtime.requestOperation({
      schemaVersion: 1,
      kind: 'RESTORE_AS_COPY',
      backupId: created.backupId,
      destinationId: 'restore.local',
      idempotencyKey: 'o1a.failure.blocked-restore',
    }, operatorContext()),
    (error) => error.code === 'OPERATION_STATE_CONFLICT',
  );
  assert.equal((await runtime.readOperation({
    schemaVersion: 1,
    operationId: suspectRequest.operationId,
  }, operatorContext())).failure.code, 'BACKUP_SCHEMA_UNSUPPORTED');

  await writeFile(manifestPath, originalManifest);
  await runToSuccess(runtime, {
    schemaVersion: 1,
    kind: 'VERIFY',
    backupId: created.backupId,
    idempotencyKey: 'o1a.failure.reverify',
  });
  assert.equal(runtime.listBackups(operatorContext())[0].health, 'VERIFIED');

  const heldDirectory = join(backupRoot, `held-${created.backupId}`);
  await rename(backupDirectory, heldDirectory);
  const missing = await runtime.requestOperation({
    schemaVersion: 1,
    kind: 'VERIFY',
    backupId: created.backupId,
    idempotencyKey: 'o1a.failure.missing',
  }, operatorContext());
  assert.equal((await runtime.runNext()).status, 'FAILED');
  assert.equal(runtime.listBackups(operatorContext())[0].health, 'MISSING');
  assert.equal((await runtime.readOperation({
    schemaVersion: 1,
    operationId: missing.operationId,
  }, operatorContext())).failure.code, 'BACKUP_CONTENT_MISMATCH');
  await rename(heldDirectory, backupDirectory);
  await runToSuccess(runtime, {
    schemaVersion: 1,
    kind: 'VERIFY',
    backupId: created.backupId,
    idempotencyKey: 'o1a.failure.reappeared',
  });

  const liveBeforeConflict = await hashTree(liveRoot);
  const restore = await runtime.requestOperation({
    schemaVersion: 1,
    kind: 'RESTORE_AS_COPY',
    backupId: created.backupId,
    destinationId: 'restore.local',
    idempotencyKey: 'o1a.failure.destination-conflict',
  }, operatorContext());
  await mkdir(join(restoreRoot, `workspace-copy-${restore.restoredCopyId}`), { mode: 0o700 });
  const conflict = await runtime.runNext();
  assert.equal(conflict.status, 'FAILED');
  assert.equal(conflict.failure.code, 'BACKUP_DESTINATION_CONFLICT');
  assert.equal(runtime.listBackups(operatorContext())[0].health, 'VERIFIED');
  assert.equal(await hashTree(liveRoot), liveBeforeConflict);

  const publicMethods = Object.getOwnPropertyNames(BackupOperationsRuntime.prototype);
  assert.equal(publicMethods.some((name) => /delete|activate|remote|mcp/i.test(name)), false);
});

test('O1a runtime binds validated live identity to the actual SQLite writer and exact CAS root before control mutation', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'numberdroid-o1a-root-binding-'));
  afterTestCleanup(context, () => rm(root, { recursive: true, force: true }));
  const actualLiveRoot = join(root, 'actual-live');
  const declaredLiveRoot = join(root, 'declared-live');
  const foreignCasRoot = join(root, 'foreign-cas');
  const controlRoot = join(root, 'control');
  const backupRoot = join(root, 'backups');
  const restoreRoot = join(root, 'restores');
  await Promise.all([
    declaredLiveRoot, foreignCasRoot, controlRoot, backupRoot, restoreRoot,
  ].map((path) => mkdir(path, { mode: 0o700 })));
  const projectStore = await SqliteProjectStore.open({
    filename: join(actualLiveRoot, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  afterTestCleanup(context, () => projectStore.close());
  const configuration = {
    schemaVersion: 1,
    controlRoot,
    backupDestinations: [{ destinationId: 'backup.local', label: 'Backups', root: backupRoot }],
    restoreDestinations: [{ destinationId: 'restore.local', label: 'Restores', root: restoreRoot }],
  };

  await assert.rejects(
    BackupOperationsRuntime.open({
      configuration,
      liveWorkspaceRoot: declaredLiveRoot,
      projectStore,
      artifactStore: new ContentAddressedArtifactStore({
        rootDirectory: join(actualLiveRoot, 'artifacts'),
      }),
      workspaceDatabaseFactory: nodeSqliteDatabaseFactory,
    }),
    (error) => error.code === 'BACKUP_PATH_UNSAFE',
  );
  assert.deepEqual(await readdir(controlRoot), []);

  await assert.rejects(
    BackupOperationsRuntime.open({
      configuration,
      liveWorkspaceRoot: actualLiveRoot,
      projectStore,
      artifactStore: new ContentAddressedArtifactStore({ rootDirectory: foreignCasRoot }),
      workspaceDatabaseFactory: nodeSqliteDatabaseFactory,
    }),
    (error) => error.code === 'BACKUP_PATH_UNSAFE',
  );
  assert.deepEqual(await readdir(controlRoot), []);

  await assert.rejects(
    BackupOperationsRuntime.open({
      configuration,
      liveWorkspaceRoot: actualLiveRoot,
      projectStore: {
        workspace: { filename: join(actualLiveRoot, 'studio.sqlite'), isWriter: true },
      },
      artifactStore: { rootDirectory: join(actualLiveRoot, 'artifacts') },
      workspaceDatabaseFactory: nodeSqliteDatabaseFactory,
    }),
    (error) => error.code === 'OPERATIONS_UNAVAILABLE',
  );
  assert.deepEqual(await readdir(controlRoot), []);
});

test('O1a runtime proves Windows roots before creating either control database', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'numberdroid-o1a-win-root-order-'));
  afterTestCleanup(context, () => rm(root, { recursive: true, force: true }));
  const liveRoot = join(root, 'live');
  const controlRoot = join(root, 'control');
  const backupRoot = join(root, 'backups');
  const restoreRoot = join(root, 'restores');
  await Promise.all([controlRoot, backupRoot, restoreRoot]
    .map((path) => mkdir(path, { mode: 0o700 })));
  const projectStore = await SqliteProjectStore.open({
    filename: join(liveRoot, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  afterTestCleanup(context, () => projectStore.close());
  const artifactStore = new ContentAddressedArtifactStore({
    rootDirectory: join(liveRoot, 'artifacts'),
  });

  await assert.rejects(
    BackupOperationsRuntime.open({
      configuration: {
        schemaVersion: 1,
        controlRoot,
        backupDestinations: [{ destinationId: 'backup.local', label: 'Backups', root: backupRoot }],
        restoreDestinations: [{ destinationId: 'restore.local', label: 'Restores', root: restoreRoot }],
      },
      liveWorkspaceRoot: liveRoot,
      projectStore,
      artifactStore,
      workspaceDatabaseFactory: nodeSqliteDatabaseFactory,
      platform: 'win32',
      spawnProcess: unavailableWindowsHelper,
    }),
    (error) => error.code === 'BACKUP_PATH_UNSAFE',
  );
  assert.deepEqual(await readdir(controlRoot), []);
});

test('O1a runtime permanently closes intake after expired lease or fatal worker/control failure', async (context) => {
  let now = '2026-08-29T18:00:00.000Z';
  let expiredLeaseVisible = false;
  let serviceCalls = 0;
  let ledgerClosed = false;
  let lockClosed = false;
  const ledger = {
    listOperationsForReconciliation() {
      return expiredLeaseVisible ? [{
        status: 'RUNNING',
        lease: { expiresAt: '2026-08-29T18:00:01.000Z' },
      }] : [];
    },
    listBackups() { return []; },
    close() { ledgerClosed = true; },
  };
  const runtime = new BackupOperationsRuntime({
    service: {
      requestOperation() { serviceCalls += 1; return { accepted: true }; },
      readOperation() { return { status: 'QUEUED' }; },
    },
    worker: { runNext() { return null; } },
    ledger,
    filesystem: { listDestinations() { return []; } },
    lock: { isHeld: true, close() { lockClosed = true; } },
    workerId: 'worker.runtime.test',
    clock: () => now,
    reconciliationSummary: {},
  });
  context.after(() => runtime.close());

  assert.deepEqual(await runtime.requestOperation({}, {}), { accepted: true });
  expiredLeaseVisible = true;
  now = '2026-08-29T18:00:01.000Z';
  await assert.rejects(
    runtime.requestOperation({}, {}),
    (error) => error.code === 'OPERATION_LEASE_LOST',
  );
  expiredLeaseVisible = false;
  await assert.rejects(
    runtime.requestOperation({}, {}),
    (error) => error.code === 'OPERATIONS_UNAVAILABLE',
  );
  assert.equal(serviceCalls, 1);
  await runtime.close();
  assert.equal(ledgerClosed, true);
  assert.equal(lockClosed, true);

  let fatalServiceCalls = 0;
  const fatalRuntime = new BackupOperationsRuntime({
    service: {
      requestOperation() { fatalServiceCalls += 1; return { accepted: true }; },
      readOperation() { return null; },
    },
    worker: {
      async runNext() {
        throw new StudioError('OPERATIONS_UNAVAILABLE', 'raw control path /must/not/leak');
      },
    },
    ledger: {
      listOperationsForReconciliation() { return []; },
      listBackups() { return []; },
      close() {},
    },
    filesystem: { listDestinations() { return []; } },
    lock: { isHeld: true, close() {} },
    workerId: 'worker.runtime.fatal',
    clock: () => NOW,
    reconciliationSummary: {},
  });
  context.after(() => fatalRuntime.close());
  await assert.rejects(
    fatalRuntime.runNext(),
    (error) => error.code === 'OPERATIONS_UNAVAILABLE' && !error.message.includes('/must/not/leak'),
  );
  await assert.rejects(
    fatalRuntime.requestOperation({}, {}),
    (error) => error.code === 'OPERATIONS_UNAVAILABLE',
  );
  assert.equal(fatalServiceCalls, 0);
});

test('O1a worker adapter never banks, revives, or replaces an expired live-process lease', () => {
  let now = '2026-08-29T19:00:00.000Z';
  let claimCalls = 0;
  let renewalCalls = 0;
  const ledger = {
    claimNext({ workerId, leaseExpiresAt }) {
      claimCalls += 1;
      return {
        schemaVersion: 1,
        operationId: '11111111-1111-4111-8111-111111111111',
        kind: 'CREATE',
        status: 'RUNNING',
        phase: 'RESERVED',
        progress: { current: 0, total: 8 },
        destinationId: 'backup.local',
        backupId: null,
        outputId: '22222222-2222-4222-8222-222222222222',
        result: null,
        failure: null,
        createdAt: now,
        startedAt: now,
        updatedAt: now,
        finishedAt: null,
        requestFingerprint: 'a'.repeat(64),
        creatorSubject: 'local.workspace-operator',
        lease: { owner: workerId, generation: 1, expiresAt: leaseExpiresAt },
      };
    },
    getOperationForWorker() { return { phase: 'RESERVED' }; },
    renewLease() { renewalCalls += 1; },
  };
  const adapter = new OperationsStoreAdapter({
    ledger,
    filesystem: {},
    evidenceVault: {},
    clock: () => now,
    leaseConfiguration: {
      schemaVersion: 1,
      ttlMs: 1000,
      heartbeatIntervalMs: 250,
    },
  });
  const workerStore = adapter.asWorkerStore();
  const claimed = workerStore.claimNextOperation({ workerId: 'worker.expiry.test' });
  workerStore.renewOperationLease({
    operationId: claimed.operationId,
    generation: claimed.generation,
    phase: claimed.phase,
  });
  workerStore.renewOperationLease({
    operationId: claimed.operationId,
    generation: claimed.generation,
    phase: claimed.phase,
  });
  assert.equal(renewalCalls, 0, 'a fixed clock must not bank future lease duration');
  now = '2026-08-29T19:00:01.000Z';

  assert.throws(
    () => workerStore.renewOperationLease({
      operationId: claimed.operationId,
      generation: claimed.generation,
      phase: claimed.phase,
    }),
    (error) => error.code === 'OPERATION_LEASE_LOST',
  );
  assert.throws(
    () => workerStore.claimNextOperation({ workerId: 'worker.expiry.replacement' }),
    (error) => error.code === 'OPERATION_LEASE_LOST',
  );
  assert.equal(claimCalls, 1);
  assert.equal(renewalCalls, 0);
});

test('O1a worker adapter rejects a lost process lock at the next heartbeat boundary', () => {
  let controlHeld = true;
  let renewalCalls = 0;
  const ledger = {
    claimNext({ workerId, leaseExpiresAt, now }) {
      return {
        schemaVersion: 1,
        operationId: '33333333-3333-4333-8333-333333333333',
        kind: 'VERIFY',
        status: 'RUNNING',
        phase: 'RESERVED',
        progress: { current: 0, total: 3 },
        destinationId: null,
        backupId: '44444444-4444-4444-8444-444444444444',
        outputId: null,
        result: null,
        failure: null,
        createdAt: now,
        startedAt: now,
        updatedAt: now,
        finishedAt: null,
        requestFingerprint: 'b'.repeat(64),
        creatorSubject: 'local.workspace-operator',
        lease: { owner: workerId, generation: 1, expiresAt: leaseExpiresAt },
      };
    },
    getOperationForWorker() { return { phase: 'RESERVED' }; },
    renewLease() { renewalCalls += 1; },
  };
  const adapter = new OperationsStoreAdapter({
    ledger,
    filesystem: {},
    evidenceVault: {},
    clock: () => '2026-08-29T20:00:00.000Z',
    leaseConfiguration: {
      schemaVersion: 1,
      ttlMs: 1000,
      heartbeatIntervalMs: 250,
    },
    assertControlAvailable() {
      if (!controlHeld) {
        throw new StudioError('OPERATIONS_UNAVAILABLE', 'injected lost process lock');
      }
    },
  });
  const workerStore = adapter.asWorkerStore();
  const claimed = workerStore.claimNextOperation({ workerId: 'worker.lock-loss.test' });
  controlHeld = false;
  assert.throws(
    () => workerStore.renewOperationLease({
      operationId: claimed.operationId,
      generation: claimed.generation,
      phase: claimed.phase,
    }),
    (error) => error.code === 'OPERATIONS_UNAVAILABLE',
  );
  assert.equal(renewalCalls, 0);
});
