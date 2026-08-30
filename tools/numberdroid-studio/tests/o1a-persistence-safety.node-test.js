import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as publicPersistence from '../packages/persistence/src/index.js';
import {
  ContentAddressedArtifactStore,
  SqliteArtifactMetadataStore,
  SqliteProjectStore,
} from '../packages/persistence/src/index.js';
import {
  SqliteWorkspace,
  openSqliteWorkspaceForInternalRecoveryTest,
  openSqliteWorkspaceForInternalVerification,
} from '../packages/persistence/src/sqlite/sqlite-workspace.js';
import { StudioError } from '../packages/domain/src/errors.js';
import { BackupOperationPhaseExecutor } from '../packages/persistence/src/operations/backup-operation-phase-executor.js';
import { afterTestCleanup, nodeSqliteDatabaseFactory, pngHeader } from './persistence-test-helpers.js';
import { PROJECT_ID, createHarness, createProject } from './test-helpers.js';

function deferred() {
  let resolvePromise;
  const promise = new Promise((resolve) => { resolvePromise = resolve; });
  return { promise, resolve: resolvePromise };
}

function nextTurn() {
  return new Promise((resolve) => setImmediate(resolve));
}

test('CAS maintenance uses one fair root-scoped shared/exclusive barrier across store instances', { timeout: 10_000 }, async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'numberdroid-o1a-cas-barrier-'));
  afterTestCleanup(context, () => rm(root, { recursive: true, force: true }));
  const canonicalParent = join(root, 'canonical');
  const aliasParent = join(root, 'alias');
  await mkdir(canonicalParent);
  await symlink(canonicalParent, aliasParent, process.platform === 'win32' ? 'junction' : 'dir');
  const storeA = new ContentAddressedArtifactStore({ rootDirectory: join(canonicalParent, 'artifacts') });
  const storeB = new ContentAddressedArtifactStore({ rootDirectory: join(aliasParent, 'artifacts') });
  const artifact = await storeA.ingest(pngHeader({ width: 24, height: 24, tail: 'o1a-barrier' }), {
    mediaType: 'image/png',
  });

  const firstSharedEntered = deferred();
  const releaseFirstShared = deferred();
  const heldShared = storeA.withSharedMaintenancePermit(async () => {
    firstSharedEntered.resolve();
    await releaseFirstShared.promise;
  });
  await firstSharedEntered.promise;

  let concurrentSharedEntered = false;
  await storeB.withSharedMaintenancePermit(async () => {
    concurrentSharedEntered = true;
  });
  assert.equal(concurrentSharedEntered, true, 'shared permits should overlap on one root');

  let collectionSettled = false;
  const collection = storeB.collectGarbage({
    readReferencedDigests: () => new Set(),
    now: new Date('2099-01-01T00:00:00.000Z'),
    markRetentionMs: 0,
    sweepRetentionMs: 24 * 60 * 60 * 1000,
  }).then((value) => {
    collectionSettled = true;
    return value;
  });
  let laterSharedEntered = false;
  const laterShared = storeA.withSharedMaintenancePermit(async () => {
    laterSharedEntered = true;
    assert.deepEqual(await storeA.listLiveDigests(), [], 'later shared work must run after the queued exclusive mark');
  });
  await nextTurn();
  assert.equal(collectionSettled, false, 'exclusive collection must wait for the active shared permit');
  assert.equal(laterSharedEntered, false, 'a queued exclusive permit must block later shared work fairly');

  releaseFirstShared.resolve();
  await heldShared;
  const firstCollection = await collection;
  await laterShared;
  assert.deepEqual(firstCollection.marked.map((entry) => entry.digest), [artifact.digest]);
  assert.deepEqual(firstCollection.swept, []);

  const sweepSharedEntered = deferred();
  const releaseSweepShared = deferred();
  const sweepShared = storeA.withSharedMaintenancePermit(async () => {
    sweepSharedEntered.resolve();
    await releaseSweepShared.promise;
  });
  await sweepSharedEntered.promise;
  let sweepSettled = false;
  const sweep = storeB.collectGarbage({
    readReferencedDigests: () => new Set(),
    now: new Date('2099-01-02T00:00:00.000Z'),
    markRetentionMs: 0,
    sweepRetentionMs: 24 * 60 * 60 * 1000,
  }).then((value) => {
    sweepSettled = true;
    return value;
  });
  await nextTurn();
  assert.equal(sweepSettled, false, 'quarantine sweep must also acquire the root-exclusive permit');
  releaseSweepShared.resolve();
  await sweepShared;
  assert.deepEqual((await sweep).swept, [artifact.digest]);

  await assert.rejects(
    storeA.withSharedMaintenancePermit(async () => { throw new Error('shared callback fault'); }),
    /shared callback fault/,
  );
  await assert.rejects(
    storeA.collectGarbage({
      readReferencedDigests: () => null,
      markRetentionMs: 0,
      sweepRetentionMs: 0,
    }),
    (error) => error.code === 'VALIDATION_ERROR',
  );
  await storeB.withSharedMaintenancePermit(async () => {});
});

test('CAS garbage collection acquires exclusive access before its fresh SQLite reference read', { timeout: 10_000 }, async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'numberdroid-o1a-cas-reference-race-'));
  afterTestCleanup(context, () => rm(root, { recursive: true, force: true }));
  const projectStore = await SqliteProjectStore.open({
    filename: join(root, 'live', 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  afterTestCleanup(context, () => projectStore.close());
  const { studio } = createHarness(projectStore);
  await createProject(studio);
  const storeA = new ContentAddressedArtifactStore({ rootDirectory: join(root, 'live', 'artifacts') });
  const storeB = new ContentAddressedArtifactStore({ rootDirectory: join(root, 'live', 'artifacts', '.') });
  const artifact = await storeA.ingest(pngHeader({ tail: 'fresh-reference-race' }), { mediaType: 'image/png' });
  const metadata = new SqliteArtifactMetadataStore({ workspace: projectStore.workspace });
  metadata.register(artifact);

  const sharedEntered = deferred();
  const releaseShared = deferred();
  const heldShared = storeA.withSharedMaintenancePermit(async () => {
    sharedEntered.resolve();
    await releaseShared.promise;
  });
  await sharedEntered.promise;
  let referenceReads = 0;
  const collection = storeB.collectGarbage({
    readReferencedDigests: () => {
      referenceReads += 1;
      return metadata.listReferencedDigests();
    },
    now: new Date('2099-02-01T00:00:00.000Z'),
    markRetentionMs: 0,
    sweepRetentionMs: 24 * 60 * 60 * 1000,
  });
  await nextTurn();
  assert.equal(referenceReads, 0, 'SQLite references must not be read before the exclusive permit is acquired');

  metadata.addReference({
    projectId: PROJECT_ID,
    ownerKind: 'source',
    ownerId: 'source.gc-race',
    digest: artifact.digest,
    createdRevision: 1,
  });
  releaseShared.resolve();
  await heldShared;
  const result = await collection;
  assert.equal(referenceReads, 1);
  assert.equal(result.referencedCount, 1);
  assert.deepEqual(result.marked, []);
  assert.deepEqual(result.swept, []);
  assert.equal((await storeA.verify(artifact.digest)).digest, artifact.digest);
});

test('Create abort retains its shared CAS permit until active phase I/O has ended', { timeout: 10_000 }, async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'numberdroid-o1a-cas-abort-'));
  afterTestCleanup(context, () => rm(root, { recursive: true, force: true }));
  const projectStore = await SqliteProjectStore.open({
    filename: join(root, 'live', 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  afterTestCleanup(context, () => projectStore.close());
  await createProject(createHarness(projectStore).studio);
  const artifactStore = new ContentAddressedArtifactStore({
    rootDirectory: join(root, 'live', 'artifacts'),
  });
  const peer = new ContentAddressedArtifactStore({
    rootDirectory: join(root, 'live', 'artifacts', '.'),
  });
  const phaseIoEntered = deferred();
  const finishPhaseIo = deferred();
  const executor = new BackupOperationPhaseExecutor({
    ledger: { reserveStage() {} },
    filesystem: {
      allocatePublished() {
        return {
          root: { rootKey: 'a'.repeat(64), filesystemKey: 'b'.repeat(64) },
          stagePath: join(root, 'backup-stage'),
          finalPath: join(root, 'backup-final'),
        };
      },
    },
    projectStore,
    artifactStore,
    faultInjector({ point }) {
      if (point !== 'create.source_verified') return undefined;
      phaseIoEntered.resolve();
      return finishPhaseIo.promise;
    },
  });
  const controller = new AbortController();
  const selection = {
    schemaVersion: 1,
    operationId: 'operation.abort-permit',
    kind: 'CREATE',
    generation: 1,
    completedPhase: 'RESERVED',
    targetPhase: 'SOURCE_VERIFIED',
    destinationId: 'backup.local',
    sourceBackupId: null,
    createdBackupId: 'backup.abort-permit',
    restoredCopyId: null,
  };
  const phase = executor.executePhase(selection, {
    signal: controller.signal,
    heartbeat() {
      controller.signal.throwIfAborted();
    },
  });
  await phaseIoEntered.promise;
  controller.abort();

  let referenceReads = 0;
  const collection = peer.collectGarbage({
    readReferencedDigests() {
      referenceReads += 1;
      return new Set();
    },
    now: new Date('2099-04-01T00:00:00.000Z'),
    markRetentionMs: 0,
    sweepRetentionMs: 0,
  });
  await nextTurn();
  assert.equal(referenceReads, 0, 'abort must not release the permit under active phase I/O');

  finishPhaseIo.resolve();
  assert.equal((await phase).outcome, 'FAILED');
  await collection;
  assert.equal(referenceReads, 1);
});

test('CAS backup fence stops before the next object and never writes a manifest', { timeout: 10_000 }, async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'numberdroid-o1a-cas-fence-'));
  afterTestCleanup(context, () => rm(root, { recursive: true, force: true }));
  const source = new ContentAddressedArtifactStore({ rootDirectory: join(root, 'source') });
  const first = await source.ingest(
    pngHeader({ width: 24, height: 24, tail: 'o1a-fence-first' }),
    { mediaType: 'image/png' },
  );
  const second = await source.ingest(
    pngHeader({ width: 24, height: 24, tail: 'o1a-fence-second' }),
    { mediaType: 'image/png' },
  );
  const destination = join(root, 'destination');
  const controller = new AbortController();
  const fenceError = new Error('injected CAS backup fence');
  const verify = source.verify.bind(source);
  let sourceVerifyCount = 0;
  source.verify = async (digest) => {
    const result = await verify(digest);
    sourceVerifyCount += 1;
    if (sourceVerifyCount === 2) controller.abort(fenceError);
    return result;
  };

  await assert.rejects(
    source.backupTo(
      destination,
      new Set([first.digest, second.digest]),
      { signal: controller.signal },
    ),
    (error) => error === fenceError,
  );

  await access(join(
    destination,
    'sha256',
    first.digest.slice(0, 2),
    first.digest.slice(2, 4),
    first.digest,
  ));
  await assert.rejects(
    access(join(
      destination,
      'sha256',
      second.digest.slice(0, 2),
      second.digest.slice(2, 4),
      second.digest,
    )),
    (error) => error.code === 'ENOENT',
  );
  await assert.rejects(
    access(join(destination, 'manifest.json')),
    (error) => error.code === 'ENOENT',
  );
});

test('Create renews immediately after synchronous SQLite snapshot before ledger evidence', { timeout: 10_000 }, async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'numberdroid-o1a-sqlite-fence-'));
  afterTestCleanup(context, () => rm(root, { recursive: true, force: true }));
  const liveRoot = join(root, 'live');
  const backupRoot = join(root, 'backups');
  await Promise.all([liveRoot, backupRoot].map((path) => mkdir(path, { mode: 0o700 })));
  const projectStore = await SqliteProjectStore.open({
    filename: join(liveRoot, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  afterTestCleanup(context, () => projectStore.close());
  await createProject(createHarness(projectStore).studio);
  const artifactStore = new ContentAddressedArtifactStore({
    rootDirectory: join(liveRoot, 'artifacts'),
  });
  const operationId = '51515151-5151-4515-8515-515151515151';
  const backupId = '62626262-6262-4626-8626-626262626262';
  const allocated = {
    kind: 'CREATE',
    destinationId: 'backup.local',
    operationId,
    outputId: backupId,
    root: { rootKey: 'a'.repeat(64), filesystemKey: 'b'.repeat(64) },
    stagePath: join(backupRoot, `.numberdroid-backup-stage-${operationId}`),
    finalPath: join(backupRoot, `backup-${backupId}`),
  };
  let stageEvidenceWrites = 0;
  const executor = new BackupOperationPhaseExecutor({
    ledger: {
      reserveStage() {},
      recordStageEvidence() { stageEvidenceWrites += 1; },
    },
    filesystem: {
      allocatePublished() { return allocated; },
      inspectOperationDirectory() {
        throw new Error('stage inspection must not run after the post-snapshot lease failure');
      },
    },
    projectStore,
    artifactStore,
  });
  const baseSelection = {
    schemaVersion: 1,
    operationId,
    kind: 'CREATE',
    generation: 1,
    destinationId: 'backup.local',
    sourceBackupId: null,
    createdBackupId: backupId,
    restoredCopyId: null,
  };
  const signal = new AbortController().signal;
  assert.equal((await executor.executePhase({
    ...baseSelection,
    completedPhase: 'RESERVED',
    targetPhase: 'SOURCE_VERIFIED',
  }, { signal, heartbeat() {} })).outcome, 'COMPLETED');

  const backupTo = projectStore.backupTo.bind(projectStore);
  projectStore.backupTo = async (...args) => {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
    return backupTo(...args);
  };
  let heartbeatCalls = 0;
  await assert.rejects(
    executor.executePhase({
      ...baseSelection,
      completedPhase: 'SOURCE_VERIFIED',
      targetPhase: 'DB_SNAPSHOTTED',
    }, {
      signal,
      heartbeat() {
        heartbeatCalls += 1;
        if (heartbeatCalls === 3) {
          throw new StudioError('OPERATION_LEASE_LOST', 'injected overdue snapshot lease');
        }
      },
    }),
    (error) => error.code === 'OPERATION_LEASE_LOST',
  );
  assert.equal(heartbeatCalls, 3, 'snapshot must renew immediately after the blocking SQLite call');
  assert.equal(stageEvidenceWrites, 0);
});

test('CAS garbage collection syncs both rename parents and each unlink parent before release', { timeout: 10_000 }, async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'numberdroid-o1a-cas-durability-'));
  afterTestCleanup(context, () => rm(root, { recursive: true, force: true }));
  const points = [];
  let armedFault = 'after_cas_gc_mark_quarantine_sync';
  const store = new ContentAddressedArtifactStore({
    rootDirectory: join(root, 'artifacts'),
    maintenanceFaultInjector(point) {
      points.push(point);
      if (point === armedFault) throw new Error(`simulated ${point}`);
    },
  });
  const peer = new ContentAddressedArtifactStore({ rootDirectory: join(root, 'artifacts', '.') });
  const artifact = await store.ingest(pngHeader({ tail: 'gc-durability' }), { mediaType: 'image/png' });

  await assert.rejects(
    store.collectGarbage({
      readReferencedDigests: () => new Set(),
      now: new Date('2099-03-01T00:00:00.000Z'),
      markRetentionMs: 0,
      sweepRetentionMs: 24 * 60 * 60 * 1000,
    }),
    /after_cas_gc_mark_quarantine_sync/,
  );
  assert.deepEqual(points, [
    'after_cas_gc_mark_source_leaf_sync',
    'after_cas_gc_mark_quarantine_sync',
  ]);
  await peer.withSharedMaintenancePermit(async () => {});

  armedFault = null;
  const result = await store.collectGarbage({
    readReferencedDigests: () => new Set(),
    now: new Date('2099-03-02T00:00:00.000Z'),
    markRetentionMs: 0,
    sweepRetentionMs: 24 * 60 * 60 * 1000,
  });
  assert.deepEqual(result.swept, [artifact.digest]);
  assert.equal(points.at(-1), 'after_cas_gc_sweep_unlink_parent_sync');
});

test('restored-copy quarantine blocks every public open before database, lock, or migration access', { timeout: 10_000 }, async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'numberdroid-o1a-quarantine-'));
  afterTestCleanup(context, () => rm(root, { recursive: true, force: true }));
  const dataRoot = join(root, 'restored-copy');
  const filename = join(dataRoot, 'studio.sqlite');
  const marker = join(dataRoot, '.numberdroid-restored-copy-quarantine.json');
  const lock = `${filename}.writer.lock`;

  const initialWriter = await SqliteWorkspace.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  initialWriter.close();
  await writeFile(marker, '{"schemaVersion":1}\n', { flag: 'wx', mode: 0o600 });

  let databaseFactoryCalls = 0;
  const forbiddenFactory = () => {
    databaseFactoryCalls += 1;
    throw new Error('database factory must not run for a quarantined public open');
  };
  await assert.rejects(
    SqliteWorkspace.open({ filename, databaseFactory: forbiddenFactory }),
    (error) => error.code === 'RESTORED_COPY_QUARANTINED',
  );
  await assert.rejects(
    SqliteWorkspace.open({ filename, mode: 'reader', purpose: 'VERIFY', databaseFactory: forbiddenFactory }),
    (error) => error.code === 'RESTORED_COPY_QUARANTINED',
  );
  await assert.rejects(
    SqliteProjectStore.open({ filename, mode: 'reader', databaseFactory: forbiddenFactory }),
    (error) => error.code === 'RESTORED_COPY_QUARANTINED',
  );
  assert.equal(databaseFactoryCalls, 0, 'quarantine must be checked before SQLite open or migration');
  await access(lock);

  assert.equal('openSqliteWorkspaceForInternalVerification' in publicPersistence, false);
  assert.equal('openSqliteWorkspaceForInternalRecoveryTest' in publicPersistence, false);
  const verificationReader = await openSqliteWorkspaceForInternalVerification({
    filename,
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  afterTestCleanup(context, () => verificationReader.close());
  assert.equal(verificationReader.isWriter, false);
  assert.equal(verificationReader.integrityCheck().ok, true);
  verificationReader.close();
  const recoveryReader = await openSqliteWorkspaceForInternalRecoveryTest({
    filename,
    mode: 'writer',
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  afterTestCleanup(context, () => recoveryReader.close());
  assert.equal(recoveryReader.isWriter, false);
  assert.equal(recoveryReader.integrityCheck().ok, true);
  recoveryReader.close();
  await access(lock);
});
