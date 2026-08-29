import { randomUUID } from 'node:crypto';
import { lstat, realpath } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { backupOperationFailure } from '../../../domain/src/backup-operation.js';
import { StudioError, invariant } from '../../../domain/src/errors.js';
import {
  BackupOperationService,
  validateLocalWorkspaceOperatorContext,
} from '../../../application/src/backup-operation-service.js';
import { BackupOperationWorker } from '../../../application/src/backup-operation-worker.js';
import { ContentAddressedArtifactStore } from '../artifacts/content-addressed-artifact-store.js';
import { SqliteProjectStore } from '../sqlite/sqlite-project-store.js';
import { BackupOperationPhaseExecutor, OperationEvidenceVault } from './backup-operation-phase-executor.js';
import { reconcileBackupOperations } from './backup-operation-reconciler.js';
import { validateOperationsConfiguration } from './operations-config.js';
import { OperationsFilesystem } from './safe-filesystem.js';
import { OperationsLedger } from './operations-ledger.js';
import { OperationsLock } from './operations-lock.js';
import {
  DEFAULT_OPERATIONS_LEASE_CONFIGURATION,
  OperationsStoreAdapter,
} from './operations-store-adapter.js';

function errorCode(error) {
  if (error === null || typeof error !== 'object') return null;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(error, 'code');
    return descriptor && Object.hasOwn(descriptor, 'value') && typeof descriptor.value === 'string'
      ? descriptor.value
      : null;
  } catch {
    return null;
  }
}

function normalizedCoordinate(path, platform) {
  const normalized = resolve(path).replaceAll('\\', '/').replace(/\/+$/, '');
  return platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function sameCoordinate(left, right, platform) {
  return normalizedCoordinate(left, platform) === normalizedCoordinate(right, platform);
}

async function directoryProof(path, label) {
  try {
    const entry = await lstat(path);
    invariant(entry.isDirectory() && !entry.isSymbolicLink(),
      'BACKUP_PATH_UNSAFE', `${label} must be a no-follow directory.`);
    const canonical = await realpath(path);
    const canonicalEntry = await lstat(canonical);
    invariant(canonicalEntry.isDirectory() && !canonicalEntry.isSymbolicLink(),
      'BACKUP_PATH_UNSAFE', `${label} must resolve to a no-follow directory.`);
    return Object.freeze({
      path: canonical,
      device: String(canonicalEntry.dev),
      inode: String(canonicalEntry.ino),
    });
  } catch (error) {
    if (error instanceof StudioError) throw error;
    throw new StudioError('BACKUP_PATH_UNSAFE', `${label} could not be bound safely.`);
  }
}

async function bindLiveStores({ configuration, projectStore, artifactStore, platform }) {
  invariant(projectStore instanceof SqliteProjectStore && projectStore.workspace.isWriter,
    'OPERATIONS_UNAVAILABLE', 'The authoritative live SQLite writer store is required.');
  invariant(artifactStore instanceof ContentAddressedArtifactStore,
    'OPERATIONS_UNAVAILABLE', 'The authoritative live content-addressed artifact store is required.');

  const projectRoot = await directoryProof(dirname(projectStore.workspace.filename), 'Live SQLite workspace root');
  invariant(
    sameCoordinate(projectRoot.path, configuration.workspaceRoot, platform)
      && projectRoot.device === configuration.workspaceIdentity.device
      && projectRoot.inode === configuration.workspaceIdentity.inode,
    'BACKUP_PATH_UNSAFE',
    'The live SQLite store is not bound to the validated workspace root.',
  );

  const expectedArtifactRoot = resolve(configuration.workspaceRoot, 'artifacts');
  invariant(
    sameCoordinate(artifactStore.rootDirectory, expectedArtifactRoot, platform),
    'BACKUP_PATH_UNSAFE',
    'The live CAS store is not rooted at the validated workspace artifact coordinate.',
  );
  try {
    await lstat(artifactStore.rootDirectory);
  } catch (error) {
    if (errorCode(error) !== 'ENOENT') {
      throw new StudioError('BACKUP_PATH_UNSAFE', 'The live CAS root could not be inspected safely.');
    }
    try {
      await artifactStore.initialize();
    } catch {
      throw new StudioError('BACKUP_PATH_UNSAFE', 'The live CAS root could not be bound safely.');
    }
  }
  const artifactRoot = await directoryProof(artifactStore.rootDirectory, 'Live CAS root');
  invariant(
    sameCoordinate(artifactRoot.path, expectedArtifactRoot, platform)
      && sameCoordinate(dirname(artifactRoot.path), projectRoot.path, platform),
    'BACKUP_PATH_UNSAFE',
    'The live CAS store is not an exact child of the validated workspace root.',
  );
}

export class BackupOperationsRuntime {
  #service;
  #worker;
  #ledger;
  #filesystem;
  #lock;
  #workerId;
  #activeRun = null;
  #accepting = true;
  #closed = false;
  #clock;
  #reconciliationSummary;

  static async open({
    configuration,
    liveWorkspaceRoot,
    projectStore,
    artifactStore,
    clock = () => new Date().toISOString(),
    idFactory = () => randomUUID(),
    workerId = `studio.backup-worker.${randomUUID()}`,
    workspaceDatabaseFactory,
    controlDatabaseFactory,
    platform = process.platform,
    spawnProcess,
    leaseConfiguration = DEFAULT_OPERATIONS_LEASE_CONFIGURATION,
  }) {
    invariant(projectStore && artifactStore,
      'OPERATIONS_UNAVAILABLE', 'The live SQLite project and artifact stores are required.');
    const validated = await validateOperationsConfiguration(configuration, {
      liveWorkspaceRoot,
      platform,
    });
    await bindLiveStores({
      configuration: validated,
      projectStore,
      artifactStore,
      platform,
    });
    let lock;
    let ledger;
    try {
      // All configured roots, including the Windows no-reparse proof, must be
      // established before either fixed control database can be created.
      const filesystem = await OperationsFilesystem.create({
        configuration: validated,
        platform,
        ...(spawnProcess ? { spawnProcess } : {}),
      });
      lock = await OperationsLock.acquire({
        controlRoot: validated.controlRoot,
        ...(controlDatabaseFactory ? { databaseFactory: controlDatabaseFactory } : {}),
      });
      ledger = await OperationsLedger.open({
        controlRoot: validated.controlRoot,
        ...(controlDatabaseFactory ? { databaseFactory: controlDatabaseFactory } : {}),
      });
      const reconciliationSummary = await reconcileBackupOperations({
        ledger,
        filesystem,
        clock,
        platform,
        ...(spawnProcess ? { spawnProcess } : {}),
        ...(workspaceDatabaseFactory ? { databaseFactory: workspaceDatabaseFactory } : {}),
      });
      const evidenceVault = new OperationEvidenceVault();
      const executor = new BackupOperationPhaseExecutor({
        ledger,
        filesystem,
        projectStore,
        artifactStore,
        evidenceVault,
        clock,
        platform,
        ...(spawnProcess ? { spawnProcess } : {}),
        ...(workspaceDatabaseFactory ? { databaseFactory: workspaceDatabaseFactory } : {}),
      });
      const adapter = new OperationsStoreAdapter({
        ledger,
        filesystem,
        evidenceVault,
        clock,
        leaseConfiguration,
        assertControlAvailable: () => invariant(lock.isHeld,
          'OPERATIONS_UNAVAILABLE', 'The operations control lock is unavailable.'),
      });
      const service = new BackupOperationService({
        store: adapter.asCommandStore(),
        clock,
        idFactory,
      });
      const worker = new BackupOperationWorker({
        store: adapter.asWorkerStore(),
        phaseExecutor: executor.asPhaseExecutor(),
      });
      return new BackupOperationsRuntime({
        service,
        worker,
        ledger,
        filesystem,
        lock,
        workerId,
        clock,
        reconciliationSummary,
      });
    } catch (error) {
      ledger?.close();
      lock?.close();
      throw error;
    }
  }

  constructor({
    service,
    worker,
    ledger,
    filesystem,
    lock,
    workerId,
    clock = () => new Date().toISOString(),
    reconciliationSummary,
  }) {
    this.#service = service;
    this.#worker = worker;
    this.#ledger = ledger;
    this.#filesystem = filesystem;
    this.#lock = lock;
    this.#workerId = workerId;
    this.#clock = clock;
    this.#reconciliationSummary = reconciliationSummary;
  }

  get reconciliationSummary() {
    return this.#reconciliationSummary;
  }

  #assertAccepting() {
    invariant(this.#accepting && !this.#closed,
      'OPERATIONS_UNAVAILABLE', 'Backup operation intake is closed.');
    try {
      invariant(this.#lock.isHeld !== false,
        'OPERATIONS_UNAVAILABLE', 'The operations control lock is unavailable.');
      const now = this.#clock();
      invariant(typeof now === 'string' && new Date(now).toISOString() === now,
        'OPERATIONS_UNAVAILABLE', 'The operations runtime clock is unavailable.');
      const active = this.#ledger.listOperationsForReconciliation();
      invariant(Array.isArray(active),
        'OPERATIONS_UNAVAILABLE', 'The operations control ledger is unavailable.');
      const running = active.filter((operation) => operation.status === 'RUNNING');
      for (const operation of running) {
        invariant(
          operation.lease !== null
            && typeof operation.lease?.expiresAt === 'string'
            && new Date(operation.lease.expiresAt).toISOString() === operation.lease.expiresAt,
          'OPERATIONS_UNAVAILABLE',
          'A running operation has invalid lease state.',
        );
      }
      const expired = running.find((operation) => (
        Date.parse(operation.lease.expiresAt) <= Date.parse(now)
      ));
      if (expired) throw backupOperationFailure('OPERATION_LEASE_LOST');
    } catch (error) {
      this.#accepting = false;
      if (errorCode(error) === 'OPERATION_LEASE_LOST') {
        throw backupOperationFailure('OPERATION_LEASE_LOST');
      }
      throw backupOperationFailure('OPERATIONS_UNAVAILABLE');
    }
  }

  async requestOperation(request, context) {
    this.#assertAccepting();
    try {
      return await this.#service.requestOperation(request, context);
    } catch (error) {
      const code = errorCode(error);
      if (![
        'VALIDATION_ERROR',
        'WORKSPACE_OPERATOR_REQUIRED',
        'WORKSPACE_OPERATOR_FORBIDDEN',
        'OPERATION_NOT_FOUND',
        'OPERATION_IDEMPOTENCY_CONFLICT',
        'OPERATION_STATE_CONFLICT',
        'BACKUP_DESTINATION_UNKNOWN',
      ].includes(code)) {
        this.#accepting = false;
        throw backupOperationFailure('OPERATIONS_UNAVAILABLE');
      }
      throw error;
    }
  }

  async readOperation(selection, context) {
    this.#assertAccepting();
    try {
      return await this.#service.readOperation(selection, context);
    } catch (error) {
      const code = errorCode(error);
      if (![
        'WORKSPACE_OPERATOR_REQUIRED',
        'WORKSPACE_OPERATOR_FORBIDDEN',
        'OPERATION_NOT_FOUND',
      ].includes(code)) {
        this.#accepting = false;
        throw backupOperationFailure('OPERATIONS_UNAVAILABLE');
      }
      throw error;
    }
  }

  listBackups(context) {
    this.#assertAccepting();
    try {
      validateLocalWorkspaceOperatorContext(context);
      return Object.freeze(this.#ledger.listBackups());
    } catch (error) {
      if (!['WORKSPACE_OPERATOR_REQUIRED', 'WORKSPACE_OPERATOR_FORBIDDEN'].includes(errorCode(error))) {
        this.#accepting = false;
        throw backupOperationFailure('OPERATIONS_UNAVAILABLE');
      }
      throw error;
    }
  }

  listDestinations(kind, context) {
    this.#assertAccepting();
    try {
      validateLocalWorkspaceOperatorContext(context);
      return this.#filesystem.listDestinations(kind);
    } catch (error) {
      if (![
        'WORKSPACE_OPERATOR_REQUIRED',
        'WORKSPACE_OPERATOR_FORBIDDEN',
        'OPERATION_STATE_CONFLICT',
      ].includes(errorCode(error))) {
        this.#accepting = false;
        throw backupOperationFailure('OPERATIONS_UNAVAILABLE');
      }
      throw error;
    }
  }

  async runNext({ signal } = {}) {
    this.#assertAccepting();
    invariant(this.#activeRun === null,
      'OPERATION_STATE_CONFLICT', 'The serialized backup worker is already running.');
    const active = Promise.resolve().then(() => this.#worker.runNext({
      workerId: this.#workerId,
      ...(signal ? { signal } : {}),
    }));
    this.#activeRun = active;
    try {
      return await active;
    } catch (error) {
      this.#accepting = false;
      const code = errorCode(error);
      if (['OPERATION_LEASE_LOST', 'OPERATION_STATE_CONFLICT'].includes(code)) {
        throw backupOperationFailure(code);
      }
      throw backupOperationFailure('OPERATIONS_UNAVAILABLE');
    } finally {
      if (this.#activeRun === active) this.#activeRun = null;
    }
  }

  async close() {
    if (this.#closed) return;
    this.#accepting = false;
    try {
      await this.#activeRun;
    } finally {
      this.#closed = true;
      this.#ledger.close();
      this.#lock.close();
    }
  }
}
