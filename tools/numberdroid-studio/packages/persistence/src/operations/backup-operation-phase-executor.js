import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, open, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { StudioError, invariant } from '../../../domain/src/errors.js';
import {
  BACKUP_OPERATION_PHASE_EXECUTOR_KIND,
  BACKUP_OPERATION_PHASE_OUTCOME_KIND,
} from '../../../application/src/backup-operation-worker.js';
import { ContentAddressedArtifactStore } from '../artifacts/content-addressed-artifact-store.js';
import { verifyRestoredWorkspaceCopy, verifyWorkspaceBackup } from '../backup/workspace-backup.js';
import { verifyWorkspaceIntegrity } from '../integrity/workspace-integrity.js';
import { SqliteArtifactMetadataStore } from '../sqlite/sqlite-artifact-metadata-store.js';
import { SqliteProjectStore } from '../sqlite/sqlite-project-store.js';
import {
  openSqliteWorkspaceForInternalRecoveryTest,
  openSqliteWorkspaceForInternalVerification,
} from '../sqlite/sqlite-workspace.js';

const BACKUP_DATABASE_FILENAME = 'studio.sqlite';
const BACKUP_ARTIFACT_DIRECTORY = 'artifacts';
const BACKUP_MANIFEST_FILENAME = 'workspace-manifest.json';
const ARTIFACT_MANIFEST_FILENAME = 'manifest.json';
const RESTORED_COPY_QUARANTINE_MARKER = '.numberdroid-restored-copy-quarantine.json';
const MAX_MANIFEST_BYTES = 1024 * 1024;

function deferred() {
  let resolvePromise;
  const promise = new Promise((resolve) => { resolvePromise = resolve; });
  return Object.freeze({ promise, resolve: resolvePromise });
}

function assertEffectFence(signal) {
  if (signal !== undefined) AbortSignal.prototype.throwIfAborted.call(signal);
}

async function fileHash(path) {
  const before = await lstat(path);
  invariant(before.isFile() && !before.isSymbolicLink(),
    'BACKUP_CONTENT_MISMATCH', 'Operation content must be a regular no-follow file.');
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const opened = await handle.stat();
    invariant(opened.isFile() && opened.dev === before.dev && opened.ino === before.ino,
      'BACKUP_CONTENT_MISMATCH', 'Operation content changed while its no-follow handle was acquired.');
    const hash = createHash('sha256');
    for await (const chunk of handle.createReadStream({ autoClose: false })) hash.update(chunk);
    const after = await lstat(path);
    invariant(after.isFile() && !after.isSymbolicLink()
        && after.dev === opened.dev && after.ino === opened.ino,
    'BACKUP_CONTENT_MISMATCH', 'Operation content changed during verification.');
    return hash.digest('hex');
  } finally {
    await handle?.close();
  }
}

async function assertDirectory(path, label) {
  const info = await lstat(path).catch((error) => {
    if (error.code === 'ENOENT') throw new StudioError('BACKUP_CONTENT_MISMATCH', `${label} is missing.`);
    throw error;
  });
  invariant(info.isDirectory() && !info.isSymbolicLink(),
    'BACKUP_CONTENT_MISMATCH', `${label} must be a no-follow directory.`);
}

async function readBoundedJson(path, label) {
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const info = await handle.stat();
    invariant(info.isFile() && info.size > 0 && info.size <= MAX_MANIFEST_BYTES,
      'BACKUP_CONTENT_MISMATCH', `${label} exceeds its fixed size or file-type contract.`);
    return JSON.parse(await handle.readFile({ encoding: 'utf8' }));
  } catch (error) {
    if (error instanceof StudioError) throw error;
    throw new StudioError('BACKUP_CONTENT_MISMATCH', `${label} is not valid JSON.`);
  } finally {
    await handle?.close();
  }
}

async function listArtifactDigestsNoCreate(artifactRoot) {
  await assertDirectory(artifactRoot, 'Restored artifact root');
  const entries = (await readdir(artifactRoot, { withFileTypes: true }))
    .sort((left, right) => left.name.localeCompare(right.name));
  invariant(JSON.stringify(entries.map((entry) => entry.name))
      === JSON.stringify([ARTIFACT_MANIFEST_FILENAME, 'quarantine', 'sha256', 'staging'].sort()),
  'BACKUP_CONTENT_MISMATCH', 'Restored artifact root contains missing or unexpected entries.');
  for (const name of ['quarantine', 'sha256', 'staging']) {
    await assertDirectory(join(artifactRoot, name), `Restored artifact ${name}`);
  }
  invariant((await readdir(join(artifactRoot, 'staging'))).length === 0
      && (await readdir(join(artifactRoot, 'quarantine'))).length === 0,
  'BACKUP_CONTENT_MISMATCH', 'Restored artifact staging and quarantine directories must be empty.');
  const digests = [];
  for (const first of await readdir(join(artifactRoot, 'sha256'), { withFileTypes: true })) {
    invariant(first.isDirectory() && !first.isSymbolicLink() && /^[a-f0-9]{2}$/.test(first.name),
      'BACKUP_CONTENT_MISMATCH', 'Restored CAS contains an invalid first-level entry.');
    for (const second of await readdir(join(artifactRoot, 'sha256', first.name), { withFileTypes: true })) {
      invariant(second.isDirectory() && !second.isSymbolicLink() && /^[a-f0-9]{2}$/.test(second.name),
        'BACKUP_CONTENT_MISMATCH', 'Restored CAS contains an invalid second-level entry.');
      for (const entry of await readdir(join(artifactRoot, 'sha256', first.name, second.name), { withFileTypes: true })) {
        invariant(entry.isFile() && !entry.isSymbolicLink() && /^[a-f0-9]{64}$/.test(entry.name)
            && entry.name.startsWith(`${first.name}${second.name}`),
        'BACKUP_CONTENT_MISMATCH', 'Restored CAS contains an invalid object entry.');
        digests.push(entry.name);
      }
    }
  }
  return digests.sort();
}

async function verifyCopiedBytes({ copyDirectory, verifiedSource, markerExpected }) {
  await assertDirectory(copyDirectory, 'Restored-copy root');
  const expectedRootEntries = [BACKUP_ARTIFACT_DIRECTORY, BACKUP_DATABASE_FILENAME];
  if (markerExpected) expectedRootEntries.push(RESTORED_COPY_QUARANTINE_MARKER);
  invariant(JSON.stringify((await readdir(copyDirectory)).sort())
      === JSON.stringify(expectedRootEntries.sort()),
  'BACKUP_CONTENT_MISMATCH', 'Restored-copy root contains missing or unexpected entries.');
  const manifest = verifiedSource.manifest;
  const databasePath = join(copyDirectory, BACKUP_DATABASE_FILENAME);
  invariant(await fileHash(databasePath) === manifest.database.sha256,
    'BACKUP_CONTENT_MISMATCH', 'Restored database differs from its verified source manifest.');
  const artifactRoot = join(copyDirectory, BACKUP_ARTIFACT_DIRECTORY);
  const expectedDigests = manifest.artifacts.entries.map((entry) => entry.digest).sort();
  invariant(JSON.stringify(await listArtifactDigestsNoCreate(artifactRoot))
      === JSON.stringify(expectedDigests),
  'BACKUP_CONTENT_MISMATCH', 'Restored CAS differs from its verified source manifest.');
  invariant(JSON.stringify(await readBoundedJson(
    join(artifactRoot, ARTIFACT_MANIFEST_FILENAME), 'Restored artifact manifest',
  )) === JSON.stringify(manifest.artifacts),
  'BACKUP_CONTENT_MISMATCH', 'Restored artifact manifest differs from its verified source.');
  const artifacts = new ContentAddressedArtifactStore({ rootDirectory: artifactRoot });
  invariant(JSON.stringify(await artifacts.createManifest(new Set(expectedDigests)))
      === JSON.stringify(manifest.artifacts),
  'BACKUP_CONTENT_MISMATCH', 'Restored artifact bytes differ from their verified source manifest.');
  const databaseInfo = await lstat(databasePath);
  return Object.freeze({
    ok: true,
    manifestSha256: verifiedSource.manifestSha256,
    itemCount: expectedDigests.length,
    byteCount: databaseInfo.size
      + manifest.artifacts.entries.reduce((total, entry) => total + entry.byteSize, 0),
  });
}

const FAILURE_CODES = new Set([
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
]);

const FALLBACK_FAILURE = Object.freeze({
  CREATE: 'BACKUP_SNAPSHOT_FAILED',
  VERIFY: 'BACKUP_CONTENT_MISMATCH',
  RECOVERY_TEST: 'RECOVERY_TEST_FAILED',
  RESTORE_AS_COPY: 'RESTORE_COPY_FAILED',
});

function emptyEvidence(overrides = {}) {
  return Object.freeze({
    manifestIdentity: null,
    itemCount: null,
    byteCount: null,
    verifiedAt: null,
    recoveryTestedAt: null,
    backupHealth: null,
    restoredCopyLifecycle: null,
    cleanupConfirmed: null,
    ...overrides,
  });
}

function complete(selection, evidence = emptyEvidence()) {
  return Object.freeze({
    schemaVersion: 1,
    kind: BACKUP_OPERATION_PHASE_OUTCOME_KIND,
    outcome: 'COMPLETED',
    operationId: selection.operationId,
    generation: selection.generation,
    phase: selection.targetPhase,
    evidence,
  });
}

function failure(selection, error, context) {
  const rawCode = error instanceof StudioError ? error.code : error?.code;
  const failureCode = FAILURE_CODES.has(rawCode) ? rawCode : FALLBACK_FAILURE[selection.kind];
  let backupHealthEffect = 'UNCHANGED';
  if (selection.kind !== 'CREATE' && context.sourceVerified !== true) {
    backupHealthEffect = error?.details?.healthEffect === 'MISSING' ? 'MISSING' : 'SUSPECT';
  }
  return Object.freeze({
    schemaVersion: 1,
    kind: BACKUP_OPERATION_PHASE_OUTCOME_KIND,
    outcome: 'FAILED',
    operationId: selection.operationId,
    generation: selection.generation,
    phase: selection.targetPhase,
    failureCode,
    backupHealthEffect,
  });
}

function verifiedEvidence(verified, now, overrides = {}) {
  return emptyEvidence({
    manifestIdentity: verified.manifestSha256,
    itemCount: verified.itemCount,
    byteCount: verified.byteCount,
    verifiedAt: now,
    backupHealth: 'VERIFIED',
    ...overrides,
  });
}

export class OperationEvidenceVault {
  #records = new Map();

  merge(operationId, evidence) {
    const record = Object.freeze({ ...(this.#records.get(operationId) ?? {}), ...evidence });
    this.#records.set(operationId, record);
    return record;
  }

  get(operationId) {
    return this.#records.get(operationId) ?? null;
  }

  clear(operationId) {
    this.#records.delete(operationId);
  }
}

export class BackupOperationPhaseExecutor {
  #ledger;
  #filesystem;
  #projectStore;
  #artifactStore;
  #clock;
  #databaseFactory;
  #platform;
  #spawnProcess;
  #contexts = new Map();
  #vault;
  #faultInjector;

  constructor({
    ledger,
    filesystem,
    projectStore,
    artifactStore,
    evidenceVault = new OperationEvidenceVault(),
    clock = () => new Date().toISOString(),
    databaseFactory,
    platform = process.platform,
    spawnProcess,
    faultInjector = null,
  }) {
    invariant(ledger && filesystem && projectStore && artifactStore,
      'OPERATIONS_UNAVAILABLE', 'Backup phase executor dependencies are required.');
    invariant(['linux', 'win32'].includes(platform),
      'OPERATIONS_UNAVAILABLE', 'Backup phase executor platform is unsupported.');
    invariant(faultInjector === null || typeof faultInjector === 'function',
      'OPERATIONS_UNAVAILABLE', 'Backup phase fault injector must be a function.');
    this.#ledger = ledger;
    this.#filesystem = filesystem;
    this.#projectStore = projectStore;
    this.#artifactStore = artifactStore;
    this.#vault = evidenceVault;
    this.#clock = clock;
    this.#databaseFactory = databaseFactory;
    this.#platform = platform;
    this.#spawnProcess = spawnProcess;
    this.#faultInjector = faultInjector;
  }

  get evidenceVault() { return this.#vault; }

  asPhaseExecutor() {
    return Object.freeze({
      schemaVersion: 1,
      kind: BACKUP_OPERATION_PHASE_EXECUTOR_KIND,
      executePhase: (selection, options) => this.executePhase(selection, options),
      releaseOperationResources: (selection) => this.releaseOperationResources(selection),
    });
  }

  #context(operationId) {
    let context = this.#contexts.get(operationId);
    if (!context) {
      context = {};
      this.#contexts.set(operationId, context);
    }
    return context;
  }

  async #fault(selection, point) {
    if (this.#faultInjector !== null) {
      await this.#faultInjector(Object.freeze({
        operationId: selection.operationId,
        kind: selection.kind,
        phase: selection.targetPhase,
        point,
      }));
    }
  }

  #verificationOptions(signal) {
    return {
      platform: this.#platform,
      ...(this.#spawnProcess ? { spawnProcess: this.#spawnProcess } : {}),
      ...(signal ? { signal } : {}),
    };
  }

  async #acquireCreateMaintenance(context) {
    invariant(!context.maintenance,
      'OPERATION_STATE_CONFLICT', 'Create maintenance permit is already active.');
    const acquired = deferred();
    const release = deferred();
    const maintenance = {
      acquired,
      release,
      completion: null,
      error: null,
      released: false,
      releasePromise: null,
    };
    context.maintenance = maintenance;
    maintenance.completion = this.#artifactStore.withSharedMaintenancePermit(async () => {
      acquired.resolve();
      await release.promise;
    }).catch((error) => {
      maintenance.error = error;
      acquired.resolve();
    });
    await acquired.promise;
    if (maintenance.error) {
      delete context.maintenance;
      throw maintenance.error;
    }
  }

  async #releaseCreateMaintenance(context) {
    const maintenance = context.maintenance;
    if (!maintenance) return;
    if (!maintenance.releasePromise) {
      maintenance.releasePromise = (async () => {
        if (!maintenance.released) {
          maintenance.released = true;
          maintenance.release.resolve();
        }
        await maintenance.completion;
        if (context.maintenance === maintenance) delete context.maintenance;
        if (maintenance.error) throw maintenance.error;
      })();
    }
    await maintenance.releasePromise;
  }

  async releaseOperationResources(selection) {
    invariant(
      selection
        && selection.schemaVersion === 1
        && typeof selection.operationId === 'string'
        && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(selection.operationId),
      'OPERATIONS_UNAVAILABLE',
      'Executor resource cleanup requires one bounded operation identity.',
    );
    const context = this.#contexts.get(selection.operationId);
    try {
      if (context) await this.#releaseCreateMaintenance(context);
    } finally {
      this.#contexts.delete(selection.operationId);
      this.#vault.clear(selection.operationId);
    }
  }

  async #resolveSource(selection, context, { requireVerified, signal }) {
    const backup = this.#ledger.getBackupForWorker(selection.sourceBackupId);
    invariant(backup, 'OPERATION_NOT_FOUND', 'The source backup is not registered.');
    if (requireVerified) {
      invariant(backup.health === 'VERIFIED',
        'OPERATION_STATE_CONFLICT', 'Recovery requires a verified source backup.');
    }
    const coordinate = await this.#filesystem.resolveBackup({
      backupId: backup.backupId,
      destinationId: backup.destinationId,
    }, { signal });
    invariant(
      this.#filesystem.identitySha256(coordinate.identity) === backup.finalIdentitySha256,
      'BACKUP_CONTENT_MISMATCH',
      'The source backup filesystem identity changed.',
    );
    context.backup = backup;
    context.source = coordinate;
    context.sourceVerified = false;
    return coordinate;
  }

  async #verifyResolvedSource(selection, context, { requireVerified, signal }) {
    if (!context.source) await this.#resolveSource(selection, context, { requireVerified, signal });
    const verified = await verifyWorkspaceBackup(
      context.source.finalPath, this.#verificationOptions(signal),
    );
    const revalidatedCoordinate = await this.#filesystem.resolveBackup({
      backupId: context.backup.backupId,
      destinationId: context.backup.destinationId,
    }, { signal });
    invariant(
      this.#filesystem.identitySha256(revalidatedCoordinate.identity) === context.backup.finalIdentitySha256,
      'BACKUP_CONTENT_MISMATCH',
      'The source backup filesystem identity changed during verification.',
    );
    invariant(context.backup.manifestSha256 === verified.manifestSha256,
      'BACKUP_CONTENT_MISMATCH', 'The source backup manifest identity changed.');
    context.source = revalidatedCoordinate;
    context.verified = verified;
    context.sourceVerified = true;
    this.#vault.merge(selection.operationId, {
      manifestSha256: verified.manifestSha256,
      databaseSha256: verified.databaseSha256,
      itemCount: verified.itemCount,
      byteCount: verified.byteCount,
      createdAt: verified.manifest.createdAt,
      sourceBackupId: context.backup.backupId,
      finalIdentitySha256: this.#filesystem.identitySha256(revalidatedCoordinate.identity),
      verifiedAt: this.#clock(),
    });
    return verified;
  }

  async #resolveAndVerifySource(selection, context, { requireVerified, signal }) {
    await this.#resolveSource(selection, context, { requireVerified, signal });
    return this.#verifyResolvedSource(selection, context, { requireVerified, signal });
  }

  async #reclassifyCopyFailure(selection, context, copyError, signal) {
    context.sourceVerified = false;
    try {
      await this.#resolveAndVerifySource(selection, context, { requireVerified: true, signal });
    } catch (sourceError) {
      throw sourceError;
    }
    throw copyError;
  }

  async #verifyRestored(selection, context, path, purpose, signal) {
    const verified = await verifyRestoredWorkspaceCopy({
      copyDirectory: path,
      expectedManifest: context.verified.manifest,
      expectedManifestSha256: context.verified.manifestSha256,
      expectedBackupId: selection.sourceBackupId,
      expectedCopyId: selection.kind === 'RECOVERY_TEST' ? selection.operationId : selection.restoredCopyId,
      purpose,
      ...(this.#databaseFactory ? { databaseFactory: this.#databaseFactory } : {}),
    }, this.#verificationOptions(signal));
    const now = this.#clock();
    this.#vault.merge(selection.operationId, {
      manifestSha256: verified.manifestSha256,
      databaseSha256: context.verified.databaseSha256,
      itemCount: verified.itemCount,
      byteCount: verified.byteCount,
      verifiedAt: now,
    });
    return { verified, now };
  }

  async #writeCreateManifest(context, signal) {
    const databasePath = join(context.allocated.stagePath, BACKUP_DATABASE_FILENAME);
    const snapshotStore = await SqliteProjectStore.open({
      filename: databasePath,
      mode: 'reader',
      ...(this.#databaseFactory ? { databaseFactory: this.#databaseFactory } : {}),
    });
    let integrity;
    try {
      integrity = await verifyWorkspaceIntegrity({
        projectStore: snapshotStore,
        artifactStore: new ContentAddressedArtifactStore({
          rootDirectory: join(context.allocated.stagePath, BACKUP_ARTIFACT_DIRECTORY),
        }),
      });
      invariant(integrity.ok,
        'BACKUP_SNAPSHOT_INTEGRITY_FAILED', 'The immutable backup snapshot failed integrity checks.');
    } finally {
      snapshotStore.close();
    }
    context.manifest = Object.freeze({
      schemaVersion: 1,
      createdAt: this.#clock(),
      database: Object.freeze({
        filename: BACKUP_DATABASE_FILENAME,
        sha256: await fileHash(databasePath),
      }),
      artifacts: context.artifactManifest,
      integrity,
    });
    assertEffectFence(signal);
    await writeFile(
      join(context.allocated.stagePath, BACKUP_MANIFEST_FILENAME),
      `${JSON.stringify(context.manifest, null, 2)}\n`,
      { flag: 'wx', mode: 0o600 },
    );
  }

  async #executeCreate(selection, context, heartbeat, signal) {
    if (selection.targetPhase === 'SOURCE_VERIFIED') {
      context.allocated = await this.#filesystem.allocatePublished({
        kind: 'CREATE',
        destinationId: selection.destinationId,
        operationId: selection.operationId,
        outputId: selection.createdBackupId,
      }, { signal });
      assertEffectFence(signal);
      this.#ledger.reserveStage({
        stageId: `stage.${selection.operationId}`,
        operationId: selection.operationId,
        kind: 'BACKUP',
        rootKey: selection.destinationId,
        rootIdentitySha256: context.allocated.root.rootKey,
        filesystemIdentitySha256: context.allocated.root.filesystemKey,
      });
      await this.#acquireCreateMaintenance(context);
      const integrity = await verifyWorkspaceIntegrity({
        projectStore: this.#projectStore,
        artifactStore: this.#artifactStore,
      });
      invariant(integrity.ok, 'BACKUP_SOURCE_INTEGRITY_FAILED', 'Live workspace integrity failed.');
      await this.#fault(selection, 'create.source_verified');
      return emptyEvidence();
    }
    invariant(context.allocated, 'OPERATION_INTERRUPTED', 'Create stage context is unavailable.');
    if (['DB_SNAPSHOTTED', 'CAS_COPIED', 'MANIFEST_WRITTEN', 'SNAPSHOT_VERIFIED']
      .includes(selection.targetPhase)) {
      invariant(context.maintenance,
        'OPERATION_INTERRUPTED', 'Create maintenance context is unavailable.');
    }
    if (selection.targetPhase === 'DB_SNAPSHOTTED') {
      await heartbeat();
      const reallocated = await this.#filesystem.allocatePublished({
        kind: 'CREATE',
        destinationId: selection.destinationId,
        operationId: selection.operationId,
        outputId: selection.createdBackupId,
      }, { signal });
      invariant(reallocated.root.rootKey === context.allocated.root.rootKey
          && reallocated.root.filesystemKey === context.allocated.root.filesystemKey
          && reallocated.stagePath === context.allocated.stagePath
          && reallocated.finalPath === context.allocated.finalPath,
      'BACKUP_PATH_UNSAFE', 'Reserved create-stage coordinate changed before snapshot.');
      context.allocated = reallocated;
      assertEffectFence(signal);
      await mkdir(context.allocated.stagePath, { recursive: false, mode: 0o700 });
      assertEffectFence(signal);
      await this.#projectStore.backupTo(
        join(context.allocated.stagePath, BACKUP_DATABASE_FILENAME),
        { signal },
      );
      await heartbeat();
      context.stageIdentity = await this.#filesystem.inspectOperationDirectory(
        context.allocated.stagePath,
        { signal },
      );
      assertEffectFence(signal);
      this.#ledger.recordStageEvidence({
        stageId: `stage.${selection.operationId}`,
        stageIdentitySha256: this.#filesystem.identitySha256(context.stageIdentity),
      });
      await this.#fault(selection, 'create.db_snapshotted');
      return emptyEvidence();
    }
    if (selection.targetPhase === 'CAS_COPIED') {
      await heartbeat();
      context.stageIdentity = await this.#filesystem.revalidateOperationStage(
        context.allocated, context.stageIdentity,
        { signal },
      );
      const snapshotStore = await SqliteProjectStore.open({
        filename: join(context.allocated.stagePath, BACKUP_DATABASE_FILENAME),
        mode: 'reader',
        ...(this.#databaseFactory ? { databaseFactory: this.#databaseFactory } : {}),
      });
      try {
        const metadata = new SqliteArtifactMetadataStore({ workspace: snapshotStore.workspace });
        const referencedDigests = new Set(metadata.listReferencedDigests());
        assertEffectFence(signal);
        context.artifactManifest = await this.#artifactStore.backupTo(
          join(context.allocated.stagePath, BACKUP_ARTIFACT_DIRECTORY),
          referencedDigests,
          { signal },
        );
      } finally {
        snapshotStore.close();
      }
      await this.#fault(selection, 'create.cas_copied');
      return emptyEvidence();
    }
    invariant(context.artifactManifest,
      'OPERATION_INTERRUPTED', 'Create artifact-closure evidence is unavailable.');
    if (selection.targetPhase === 'MANIFEST_WRITTEN') {
      context.stageIdentity = await this.#filesystem.revalidateOperationStage(
        context.allocated, context.stageIdentity,
        { signal },
      );
      await this.#writeCreateManifest(context, signal);
      await this.#fault(selection, 'create.manifest_written');
      return emptyEvidence();
    }
    if (selection.targetPhase === 'SNAPSHOT_VERIFIED') {
      context.stageIdentity = await this.#filesystem.revalidateOperationStage(
        context.allocated, context.stageIdentity,
        { signal },
      );
      context.verified = await verifyWorkspaceBackup(
        context.allocated.stagePath, this.#verificationOptions(signal),
      );
      assertEffectFence(signal);
      const now = this.#clock();
      this.#vault.merge(selection.operationId, {
        manifestSha256: context.verified.manifestSha256,
        databaseSha256: context.verified.databaseSha256,
        itemCount: context.verified.itemCount,
        byteCount: context.verified.byteCount,
        createdAt: context.verified.manifest.createdAt,
        verifiedAt: now,
        destinationId: selection.destinationId,
        backupId: selection.createdBackupId,
      });
      await this.#fault(selection, 'create.snapshot_verified');
      await this.#releaseCreateMaintenance(context);
      return verifiedEvidence(context.verified, now);
    }
    invariant(context.verified, 'OPERATION_INTERRUPTED', 'Create verification evidence is unavailable.');
    if (selection.targetPhase === 'DURABLY_CLOSED') {
      context.stageIdentity = await this.#filesystem.revalidateOperationStage(
        context.allocated, context.stageIdentity,
        { signal },
      );
      assertEffectFence(signal);
      await this.#filesystem.durableStage(context.allocated.stagePath, { signal });
      await this.#fault(selection, 'create.durably_closed');
      return verifiedEvidence(
        context.verified,
        this.#vault.get(selection.operationId)?.verifiedAt ?? this.#clock(),
      );
    }
    if (selection.targetPhase === 'PUBLISHED') {
      await heartbeat();
      assertEffectFence(signal);
      const published = await this.#filesystem.publish(context.allocated, { signal });
      assertEffectFence(signal);
      context.published = published;
      context.verified = await verifyWorkspaceBackup(
        context.allocated.finalPath, this.#verificationOptions(signal),
      );
      const revalidated = await this.#filesystem.resolvePublished({
        kind: 'CREATE',
        destinationId: selection.destinationId,
        operationId: selection.operationId,
        outputId: selection.createdBackupId,
      }, { signal });
      const finalIdentitySha256 = this.#filesystem.identitySha256(revalidated.identity);
      invariant(finalIdentitySha256 === this.#filesystem.identitySha256(published.identity),
        'BACKUP_CONTENT_MISMATCH', 'Published backup identity changed during final verification.');
      assertEffectFence(signal);
      this.#ledger.recordStageEvidence({
        stageId: `stage.${selection.operationId}`,
        finalIdentitySha256,
        disposition: 'INERT',
      });
      const now = this.#clock();
      this.#vault.merge(selection.operationId, { finalIdentitySha256, verifiedAt: now });
      await this.#fault(selection, 'create.published');
      return verifiedEvidence(context.verified, now);
    }
    return verifiedEvidence(context.verified, this.#vault.get(selection.operationId)?.verifiedAt ?? this.#clock());
  }

  async #executeVerify(selection, context, signal) {
    if (selection.targetPhase === 'BACKUP_RESOLVED') {
      await this.#resolveSource(selection, context, { requireVerified: false, signal });
      await this.#fault(selection, 'verify.backup_resolved');
      return emptyEvidence();
    }
    if (selection.targetPhase === 'CONTENT_VERIFIED') {
      const verified = await this.#verifyResolvedSource(
        selection,
        context,
        { requireVerified: false, signal },
      );
      await this.#fault(selection, 'verify.content_verified');
      return verifiedEvidence(verified, this.#clock());
    }
    invariant(context.verified, 'OPERATION_INTERRUPTED', 'Verify evidence is unavailable.');
    return verifiedEvidence(context.verified, this.#vault.get(selection.operationId).verifiedAt);
  }

  async #stageRestoredCopy(selection, context, recoveryTest, heartbeat, signal) {
    await heartbeat();
    const sourceCoordinate = await this.#filesystem.resolveBackup({
      backupId: context.backup.backupId,
      destinationId: context.backup.destinationId,
    }, { signal });
    invariant(this.#filesystem.identitySha256(sourceCoordinate.identity)
        === context.backup.finalIdentitySha256,
    'BACKUP_CONTENT_MISMATCH', 'The source backup filesystem identity changed before copy.');
    context.source = sourceCoordinate;
    const coordinate = recoveryTest
      ? await this.#filesystem.recoveryTestCoordinate(
        { operationId: selection.operationId },
        { signal },
      )
      : await this.#filesystem.allocatePublished({
        kind: 'RESTORE_AS_COPY',
        destinationId: selection.destinationId,
        operationId: selection.operationId,
        outputId: selection.restoredCopyId,
      }, { signal });
    context.copy = coordinate;
    assertEffectFence(signal);
    this.#ledger.reserveStage({
      stageId: `stage.${selection.operationId}`,
      operationId: selection.operationId,
      kind: recoveryTest ? 'RECOVERY_TEST' : 'RESTORE_COPY',
      rootKey: recoveryTest ? 'control.recovery-tests' : selection.destinationId,
      rootIdentitySha256: coordinate.root.rootKey,
      filesystemIdentitySha256: coordinate.root.filesystemKey,
    });
    const copyRoot = recoveryTest ? coordinate.path : coordinate.stagePath;
    assertEffectFence(signal);
    await mkdir(copyRoot, { recursive: false, mode: 0o700 });
    context.copyIdentity = await this.#filesystem.inspectOperationDirectory(copyRoot, { signal });
    assertEffectFence(signal);
    this.#ledger.recordStageEvidence({
      stageId: `stage.${selection.operationId}`,
      stageIdentitySha256: this.#filesystem.identitySha256(context.copyIdentity),
    });
    const sourceArtifacts = new ContentAddressedArtifactStore({
      rootDirectory: join(context.source.finalPath, BACKUP_ARTIFACT_DIRECTORY),
    });
    const referencedDigests = new Set(
      context.verified.manifest.artifacts.entries.map((entry) => entry.digest),
    );
    try {
      context.copyIdentity = await this.#filesystem.revalidateOperationStage(
        context.copy, context.copyIdentity,
        { signal },
      );
      assertEffectFence(signal);
      await copyFile(
        join(context.source.finalPath, BACKUP_DATABASE_FILENAME),
        join(copyRoot, BACKUP_DATABASE_FILENAME),
        constants.COPYFILE_EXCL,
      );
      context.copyIdentity = await this.#filesystem.revalidateOperationStage(
        context.copy, context.copyIdentity,
        { signal },
      );
      assertEffectFence(signal);
      await sourceArtifacts.backupTo(
        join(copyRoot, BACKUP_ARTIFACT_DIRECTORY),
        referencedDigests,
        { signal },
      );
    } catch (error) {
      await this.#reclassifyCopyFailure(selection, context, error, signal);
    }
    await this.#fault(selection, recoveryTest
      ? 'recovery.copy_bytes_staged' : 'restore.copy_bytes_staged');
    if (recoveryTest) {
      context.copyIdentity = await this.#filesystem.revalidateOperationStage(
        context.copy, context.copyIdentity,
        { signal },
      );
      assertEffectFence(signal);
      await this.#filesystem.writeQuarantineMarker(copyRoot, {
        copyId: selection.operationId,
        backupId: selection.sourceBackupId,
        manifestSha256: context.verified.manifestSha256,
      }, { signal });
      await this.#fault(selection, 'recovery.quarantine_written');
    }
    return copyRoot;
  }

  async #openRestoredReadOnly(path, purpose) {
    const workspace = await (purpose === 'RECOVERY_TEST'
      ? openSqliteWorkspaceForInternalRecoveryTest({
        filename: join(path, BACKUP_DATABASE_FILENAME),
        ...(this.#databaseFactory ? { databaseFactory: this.#databaseFactory } : {}),
      })
      : openSqliteWorkspaceForInternalVerification({
        filename: join(path, BACKUP_DATABASE_FILENAME),
        ...(this.#databaseFactory ? { databaseFactory: this.#databaseFactory } : {}),
      }));
    workspace.close();
  }

  async #executeRecoveryTest(selection, context, heartbeat, signal) {
    if (selection.targetPhase === 'BACKUP_VERIFIED') {
      const verified = await this.#resolveAndVerifySource(
        selection, context, { requireVerified: true, signal },
      );
      await this.#fault(selection, 'recovery.backup_verified');
      return verifiedEvidence(verified, this.#clock());
    }
    invariant(context.sourceVerified, 'OPERATION_INTERRUPTED', 'Recovery source evidence is unavailable.');
    if (selection.targetPhase === 'COPY_STAGED') {
      await this.#stageRestoredCopy(selection, context, true, heartbeat, signal);
      return verifiedEvidence(context.verified, this.#clock());
    }
    invariant(context.copy, 'OPERATION_INTERRUPTED', 'Recovery-test copy context is unavailable.');
    if (selection.targetPhase === 'COPY_VERIFIED') {
      context.copyIdentity = await this.#filesystem.revalidateOperationStage(
        context.copy, context.copyIdentity,
        { signal },
      );
      let verified;
      try {
        verified = await verifyCopiedBytes({
          copyDirectory: context.copy.path,
          verifiedSource: context.verified,
          markerExpected: true,
        });
      } catch (error) {
        await this.#reclassifyCopyFailure(selection, context, error, signal);
      }
      await this.#fault(selection, 'recovery.copy_verified');
      return verifiedEvidence(verified, this.#clock());
    }
    if (selection.targetPhase === 'READ_ONLY_OPENED') {
      context.copyIdentity = await this.#filesystem.revalidateOperationStage(
        context.copy, context.copyIdentity,
        { signal },
      );
      await this.#openRestoredReadOnly(context.copy.path, 'RECOVERY_TEST');
      await this.#fault(selection, 'recovery.read_only_opened');
      return verifiedEvidence(context.verified, this.#clock());
    }
    if (selection.targetPhase === 'PARITY_VERIFIED') {
      context.copyIdentity = await this.#filesystem.revalidateOperationStage(
        context.copy, context.copyIdentity,
        { signal },
      );
      const { verified, now } = await this.#verifyRestored(
        selection,
        context,
        context.copy.path,
        'RECOVERY_TEST',
        signal,
      );
      this.#vault.merge(selection.operationId, { recoveryTestedAt: now });
      await this.#fault(selection, 'recovery.parity_verified');
      return verifiedEvidence(verified, now, { recoveryTestedAt: now });
    }
    if (selection.targetPhase === 'TEST_COPY_CLEANED') {
      await heartbeat();
      assertEffectFence(signal);
      await this.#filesystem.cleanupRecoveryTest(
        context.copy,
        context.copyIdentity,
        { signal },
      );
      const now = this.#clock();
      this.#vault.merge(selection.operationId, { verifiedAt: now, recoveryTestedAt: now, cleanupConfirmed: true });
      await this.#fault(selection, 'recovery.test_copy_cleaned');
      return verifiedEvidence(context.verified, now, { recoveryTestedAt: now, cleanupConfirmed: true });
    }
    const evidence = this.#vault.get(selection.operationId);
    return verifiedEvidence(context.verified, evidence.recoveryTestedAt ?? evidence.verifiedAt, {
      recoveryTestedAt: evidence.recoveryTestedAt,
      cleanupConfirmed: evidence.cleanupConfirmed === true,
    });
  }

  async #executeRestore(selection, context, heartbeat, signal) {
    if (selection.targetPhase === 'BACKUP_VERIFIED') {
      const verified = await this.#resolveAndVerifySource(
        selection, context, { requireVerified: true, signal },
      );
      await this.#fault(selection, 'restore.backup_verified');
      return verifiedEvidence(verified, this.#clock());
    }
    invariant(context.sourceVerified, 'OPERATION_INTERRUPTED', 'Restore source evidence is unavailable.');
    if (selection.targetPhase === 'COPY_STAGED') {
      await this.#stageRestoredCopy(selection, context, false, heartbeat, signal);
      return verifiedEvidence(context.verified, this.#clock());
    }
    invariant(context.copy, 'OPERATION_INTERRUPTED', 'Restore-copy context is unavailable.');
    if (selection.targetPhase === 'COPY_VERIFIED') {
      context.copyIdentity = await this.#filesystem.revalidateOperationStage(
        context.copy, context.copyIdentity,
        { signal },
      );
      let verified;
      try {
        verified = await verifyCopiedBytes({
          copyDirectory: context.copy.stagePath,
          verifiedSource: context.verified,
          markerExpected: false,
        });
      } catch (error) {
        await this.#reclassifyCopyFailure(selection, context, error, signal);
      }
      await this.#fault(selection, 'restore.copy_verified');
      return verifiedEvidence(verified, this.#clock());
    }
    if (selection.targetPhase === 'QUARANTINE_WRITTEN') {
      context.copyIdentity = await this.#filesystem.revalidateOperationStage(
        context.copy, context.copyIdentity,
        { signal },
      );
      assertEffectFence(signal);
      await this.#filesystem.writeQuarantineMarker(context.copy.stagePath, {
        copyId: selection.restoredCopyId,
        backupId: selection.sourceBackupId,
        manifestSha256: context.verified.manifestSha256,
      }, { signal });
      await this.#fault(selection, 'restore.quarantine_written');
      return verifiedEvidence(context.verified, this.#clock());
    }
    if (selection.targetPhase === 'DURABLY_CLOSED') {
      context.copyIdentity = await this.#filesystem.revalidateOperationStage(
        context.copy, context.copyIdentity,
        { signal },
      );
      assertEffectFence(signal);
      await this.#filesystem.durableStage(context.copy.stagePath, { signal });
      context.copyIdentity = await this.#filesystem.revalidateOperationStage(
        context.copy, context.copyIdentity,
        { signal },
      );
      const { verified, now } = await this.#verifyRestored(
        selection, context, context.copy.stagePath, 'VERIFY', signal,
      );
      await this.#fault(selection, 'restore.durably_closed');
      return verifiedEvidence(verified, now);
    }
    if (selection.targetPhase === 'PUBLISHED') {
      await heartbeat();
      assertEffectFence(signal);
      const published = await this.#filesystem.publish(context.copy, { signal });
      assertEffectFence(signal);
      context.published = published;
      const { verified, now } = await this.#verifyRestored(
        selection,
        context,
        context.copy.finalPath,
        'VERIFY',
        signal,
      );
      const revalidated = await this.#filesystem.resolvePublished({
        kind: 'RESTORE_AS_COPY',
        destinationId: selection.destinationId,
        operationId: selection.operationId,
        outputId: selection.restoredCopyId,
      }, { signal });
      const finalIdentitySha256 = this.#filesystem.identitySha256(revalidated.identity);
      invariant(finalIdentitySha256 === this.#filesystem.identitySha256(published.identity),
        'BACKUP_CONTENT_MISMATCH', 'Published restored-copy identity changed during final verification.');
      assertEffectFence(signal);
      this.#ledger.recordStageEvidence({
        stageId: `stage.${selection.operationId}`,
        finalIdentitySha256,
        disposition: 'INERT',
      });
      this.#vault.merge(selection.operationId, {
        finalIdentitySha256,
        restoredCopyLifecycle: 'QUARANTINED_VERIFIED',
        verifiedAt: now,
      });
      await this.#fault(selection, 'restore.published');
      return verifiedEvidence(verified, now, { restoredCopyLifecycle: 'QUARANTINED_VERIFIED' });
    }
    const evidence = this.#vault.get(selection.operationId);
    return verifiedEvidence(context.verified, evidence.verifiedAt, {
      restoredCopyLifecycle: 'QUARANTINED_VERIFIED',
    });
  }

  async executePhase(selection, { heartbeat, signal }) {
    const context = this.#context(selection.operationId);
    try {
      await heartbeat();
      let evidence;
      if (selection.kind === 'CREATE') {
        evidence = await this.#executeCreate(selection, context, heartbeat, signal);
      }
      else if (selection.kind === 'VERIFY') evidence = await this.#executeVerify(selection, context, signal);
      else if (selection.kind === 'RECOVERY_TEST') {
        evidence = await this.#executeRecoveryTest(selection, context, heartbeat, signal);
      }
      else evidence = await this.#executeRestore(selection, context, heartbeat, signal);
      await heartbeat();
      if (selection.targetPhase === 'COMPLETED') {
        await this.#releaseCreateMaintenance(context);
        this.#contexts.delete(selection.operationId);
      }
      return complete(selection, evidence);
    } catch (error) {
      await this.#releaseCreateMaintenance(context).catch(() => {});
      this.#contexts.delete(selection.operationId);
      if (error instanceof StudioError
          && ['OPERATION_LEASE_LOST', 'OPERATION_STATE_CONFLICT', 'OPERATIONS_UNAVAILABLE'].includes(error.code)) {
        throw error;
      }
      return failure(selection, error, context);
    }
  }
}
