import { invariant } from '../../../domain/src/errors.js';
import {
  BACKUP_OPERATION_COMMAND_STORE_KIND,
  BACKUP_OPERATION_QUERY_STORE_KIND,
} from '../../../application/src/backup-operation-service.js';
import {
  BACKUP_OPERATION_WORKER_STORE_KIND,
} from '../../../application/src/backup-operation-worker.js';

function safeResult(operation) {
  if (operation.result === null) return null;
  return Object.freeze({
    manifestIdentity: operation.result.manifestSha256,
    itemCount: operation.result.artifactCount,
    byteCount: operation.result.byteCount,
    verifiedAt: operation.result.verifiedAt,
    recoveryTestedAt: operation.kind === 'RECOVERY_TEST' ? operation.result.verifiedAt : null,
    backupHealth: operation.kind === 'RESTORE_AS_COPY' ? null : 'VERIFIED',
    restoredCopyLifecycle: operation.kind === 'RESTORE_AS_COPY' ? 'QUARANTINED_VERIFIED' : null,
  });
}

export const DEFAULT_OPERATIONS_LEASE_CONFIGURATION = Object.freeze({
  schemaVersion: 1,
  ttlMs: 30_000,
  heartbeatIntervalMs: 10_000,
});

function validatedLeaseConfiguration(value) {
  invariant(
    value
      && Object.getPrototypeOf(value) === Object.prototype
      && JSON.stringify(Object.keys(value).sort())
        === JSON.stringify(['heartbeatIntervalMs', 'schemaVersion', 'ttlMs'].sort())
      && value.schemaVersion === 1
      && Number.isSafeInteger(value.ttlMs)
      && value.ttlMs >= 1000
      && value.ttlMs <= 300_000
      && Number.isSafeInteger(value.heartbeatIntervalMs)
      && value.heartbeatIntervalMs >= 1
      && value.heartbeatIntervalMs < value.ttlMs,
    'OPERATIONS_UNAVAILABLE',
    'Operations lease configuration is outside its fixed bounds.',
  );
  return Object.freeze({
    schemaVersion: 1,
    ttlMs: value.ttlMs,
    heartbeatIntervalMs: value.heartbeatIntervalMs,
  });
}

export class OperationsStoreAdapter {
  #ledger;
  #filesystem;
  #vault;
  #clock;
  #leaseConfiguration;
  #assertControlAvailable;
  #claims = new Map();

  constructor({
    ledger,
    filesystem,
    evidenceVault,
    clock = () => new Date().toISOString(),
    leaseConfiguration = DEFAULT_OPERATIONS_LEASE_CONFIGURATION,
    assertControlAvailable = () => {},
  }) {
    invariant(ledger && filesystem && evidenceVault, 'OPERATIONS_UNAVAILABLE', 'Operations store dependencies are required.');
    invariant(typeof assertControlAvailable === 'function',
      'OPERATIONS_UNAVAILABLE', 'The operations control guard is required.');
    this.#ledger = ledger;
    this.#filesystem = filesystem;
    this.#vault = evidenceVault;
    this.#clock = clock;
    this.#leaseConfiguration = validatedLeaseConfiguration(leaseConfiguration);
    this.#assertControlAvailable = assertControlAvailable;
  }

  #guardControl() {
    this.#assertControlAvailable();
  }

  #destinationLabel(operation) {
    if (operation.destinationId === null) return null;
    return this.#filesystem.destinationLabel(operation.kind, operation.destinationId);
  }

  #project(operation) {
    return Object.freeze({
      schemaVersion: 1,
      operationId: operation.operationId,
      kind: operation.kind,
      status: operation.status,
      phase: operation.phase,
      progress: operation.progress,
      destinationId: operation.destinationId,
      destinationLabel: this.#destinationLabel(operation),
      backupId: operation.kind === 'CREATE' ? operation.outputId : operation.backupId,
      restoredCopyId: operation.kind === 'RESTORE_AS_COPY' ? operation.outputId : null,
      result: safeResult(operation),
      failure: operation.failure,
      createdAt: operation.createdAt,
      startedAt: operation.startedAt,
      finishedAt: operation.finishedAt,
      updatedAt: operation.updatedAt,
    });
  }

  #worker(operation, generation) {
    return Object.freeze({
      schemaVersion: 1,
      operationId: operation.operationId,
      kind: operation.kind,
      status: operation.status,
      phase: operation.phase,
      progress: operation.progress,
      generation,
      destinationId: operation.destinationId,
      sourceBackupId: operation.backupId,
      createdBackupId: operation.kind === 'CREATE' ? operation.outputId : null,
      restoredCopyId: operation.kind === 'RESTORE_AS_COPY' ? operation.outputId : null,
    });
  }

  #now() {
    const now = this.#clock();
    invariant(typeof now === 'string' && new Date(now).toISOString() === now,
      'OPERATIONS_UNAVAILABLE', 'Operations clock must return a canonical ISO date-time.');
    return now;
  }

  #leaseExpiry(now) {
    return new Date(Date.parse(now) + this.#leaseConfiguration.ttlMs).toISOString();
  }

  #assertLeaseLive(claim, now) {
    invariant(
      claim && Date.parse(claim.leaseExpiresAt) > Date.parse(now),
      'OPERATION_LEASE_LOST',
      'The live worker lease expired; operations intake must stop.',
    );
  }

  asCommandStore() {
    return Object.freeze({
      schemaVersion: 1,
      kind: BACKUP_OPERATION_COMMAND_STORE_KIND,
      reserveOperation: (reservation) => this.reserveOperation(reservation),
      readOperation: (selection) => this.readOperation(selection),
    });
  }

  asQueryStore() {
    return Object.freeze({
      schemaVersion: 1,
      kind: BACKUP_OPERATION_QUERY_STORE_KIND,
      listRecentOperations: () => this.listRecentOperations(),
    });
  }

  asWorkerStore() {
    return Object.freeze({
      schemaVersion: 1,
      kind: BACKUP_OPERATION_WORKER_STORE_KIND,
      leaseConfiguration: this.#leaseConfiguration,
      claimNextOperation: (claim) => this.claimNextOperation(claim),
      renewOperationLease: (renewal) => this.renewOperationLease(renewal),
      commitOperationPhase: (transition) => this.commitOperationPhase(transition),
      failOperation: (terminal) => this.failOperation(terminal),
    });
  }

  reserveOperation(reservation) {
    this.#guardControl();
    if (reservation.destinationId !== null) {
      this.#filesystem.destinationLabel(reservation.kind, reservation.destinationId);
    }
    const operation = this.#ledger.reserveOperation({
      operationId: reservation.operationId,
      kind: reservation.kind,
      idempotencyKey: reservation.idempotencyKey,
      requestFingerprint: reservation.requestFingerprint,
      creatorSubject: reservation.creatorSubject,
      destinationId: reservation.destinationId,
      backupId: reservation.sourceBackupId,
      outputId: reservation.createdBackupId ?? reservation.restoredCopyId,
      now: reservation.createdAt,
    });
    this.#guardControl();
    return this.#project(operation);
  }

  readOperation({ operationId }) {
    this.#guardControl();
    const operation = this.#ledger.getOperation(operationId);
    invariant(operation, 'OPERATION_NOT_FOUND', 'The backup operation does not exist.');
    this.#guardControl();
    return this.#project(operation);
  }

  listRecentOperations() {
    this.#guardControl();
    const operations = this.#ledger.listOperationsForOverview({ limit: 100 }).map((operation) => (
      this.#project(operation)
    ));
    this.#guardControl();
    return Object.freeze(operations);
  }

  claimNextOperation({ workerId }) {
    this.#guardControl();
    const now = this.#now();
    for (const claim of this.#claims.values()) this.#assertLeaseLive(claim, now);
    const leaseExpiresAt = this.#leaseExpiry(now);
    const operation = this.#ledger.claimNext({ workerId, leaseExpiresAt, now });
    if (operation === null) {
      this.#guardControl();
      return null;
    }
    const generation = operation.lease.generation;
    this.#claims.set(operation.operationId, { workerId, generation, leaseExpiresAt });
    this.#guardControl();
    return this.#worker(operation, generation);
  }

  renewOperationLease({ operationId, generation, phase }) {
    this.#guardControl();
    const claim = this.#claims.get(operationId);
    invariant(claim && claim.generation === generation, 'OPERATION_LEASE_LOST', 'The worker claim is no longer active.');
    const current = this.#ledger.getOperationForWorker(operationId);
    invariant(current?.phase === phase, 'OPERATION_STATE_CONFLICT', 'The operation phase changed before lease renewal.');
    const now = this.#now();
    this.#assertLeaseLive(claim, now);
    const leaseExpiresAt = this.#leaseExpiry(now);
    const expiryOrder = Date.parse(leaseExpiresAt) - Date.parse(claim.leaseExpiresAt);
    invariant(expiryOrder >= 0,
      'OPERATIONS_UNAVAILABLE', 'The operations clock moved backwards during lease renewal.');
    if (expiryOrder === 0) {
      this.#guardControl();
      return;
    }
    this.#ledger.renewLease({
      operationId,
      workerId: claim.workerId,
      expectedGeneration: generation,
      leaseExpiresAt,
      now,
    });
    claim.leaseExpiresAt = leaseExpiresAt;
    this.#guardControl();
  }

  #assertFinalEvidence(transition, operation) {
    const evidence = this.#vault.get(operation.operationId);
    invariant(evidence
        && evidence.manifestSha256 === transition.evidence.manifestIdentity
        && evidence.itemCount === transition.evidence.itemCount
        && evidence.byteCount === transition.evidence.byteCount
        && evidence.verifiedAt === transition.evidence.verifiedAt
        && (operation.kind !== 'RECOVERY_TEST'
          || (evidence.recoveryTestedAt === transition.evidence.recoveryTestedAt
            && evidence.cleanupConfirmed === true
            && transition.evidence.cleanupConfirmed === true))
        && (operation.kind !== 'RESTORE_AS_COPY'
          || (evidence.restoredCopyLifecycle === 'QUARANTINED_VERIFIED'
            && transition.evidence.restoredCopyLifecycle === 'QUARANTINED_VERIFIED')),
    'OPERATION_STATE_CONFLICT', 'Terminal operation evidence does not match its filesystem proof.');
    invariant(typeof evidence.databaseSha256 === 'string' && typeof evidence.verifiedAt === 'string',
      'OPERATION_STATE_CONFLICT', 'Terminal operation evidence is incomplete.');
    return evidence;
  }

  #markStageInert(operationId, now) {
    const stage = this.#ledger.getStageForOperation(operationId);
    if (stage?.disposition === 'ACTIVE') {
      this.#ledger.recordStageEvidence({ stageId: stage.stageId, disposition: 'INERT', now });
    }
  }

  #registerTerminalEvidence(operation, evidence, now) {
    this.#markStageInert(operation.operationId, now);
    if (operation.kind === 'CREATE') {
      this.#ledger.registerBackup({
        backupId: operation.outputId,
        destinationId: operation.destinationId,
        rootKey: operation.destinationId,
        provenance: 'CREATED',
        health: 'VERIFIED',
        finalIdentitySha256: evidence.finalIdentitySha256,
        manifestSha256: evidence.manifestSha256,
        databaseSha256: evidence.databaseSha256,
        artifactCount: evidence.itemCount,
        byteCount: evidence.byteCount,
        createdOperationId: operation.operationId,
        createdAt: evidence.createdAt,
        registeredAt: evidence.verifiedAt,
        lastVerifiedAt: evidence.verifiedAt,
      });
    } else if (operation.kind === 'VERIFY') {
      this.#ledger.recordBackupHealth({
        backupId: operation.backupId,
        health: 'VERIFIED',
        finalIdentitySha256: evidence.finalIdentitySha256,
        manifestSha256: evidence.manifestSha256,
        databaseSha256: evidence.databaseSha256,
        artifactCount: evidence.itemCount,
        byteCount: evidence.byteCount,
        verifiedAt: evidence.verifiedAt,
      });
    } else if (operation.kind === 'RECOVERY_TEST') {
      invariant(evidence.cleanupConfirmed === true && typeof evidence.recoveryTestedAt === 'string',
        'OPERATION_STATE_CONFLICT', 'Recovery success requires parity and cleanup evidence.');
      this.#ledger.recordRecoveryTestPassed({
        backupId: operation.backupId,
        testedAt: evidence.recoveryTestedAt,
      });
    } else {
      this.#ledger.registerRestoredCopy({
        copyId: operation.outputId,
        sourceBackupId: operation.backupId,
        destinationId: operation.destinationId,
        rootKey: operation.destinationId,
        finalIdentitySha256: evidence.finalIdentitySha256,
        manifestSha256: evidence.manifestSha256,
        artifactCount: evidence.itemCount,
        byteCount: evidence.byteCount,
        createdOperationId: operation.operationId,
        verifiedAt: evidence.verifiedAt,
      });
    }
  }

  commitOperationPhase(transition) {
    this.#guardControl();
    const claim = this.#claims.get(transition.operationId);
    invariant(claim && claim.generation === transition.generation,
      'OPERATION_LEASE_LOST', 'The worker claim is no longer active.');
    const current = this.#ledger.getOperationForWorker(transition.operationId);
    invariant(current?.status === transition.expectedStatus && current.phase === transition.expectedPhase,
      'OPERATION_STATE_CONFLICT', 'The operation changed before its phase commit.');
    const now = this.#now();
    this.#assertLeaseLive(claim, now);
    if (transition.nextStatus !== 'SUCCEEDED') {
      const advanced = this.#ledger.advanceOperation({
        operationId: transition.operationId,
        workerId: claim.workerId,
        expectedGeneration: transition.generation,
        phase: transition.nextPhase,
        now,
      });
      this.#guardControl();
      return this.#worker(advanced, transition.generation);
    }

    const evidence = this.#assertFinalEvidence(transition, current);
    this.#registerTerminalEvidence(current, evidence, now);
    const succeeded = this.#ledger.succeedOperation({
      operationId: transition.operationId,
      workerId: claim.workerId,
      expectedGeneration: transition.generation,
      manifestSha256: evidence.manifestSha256,
      artifactCount: evidence.itemCount,
      byteCount: evidence.byteCount,
      verifiedAt: current.kind === 'RECOVERY_TEST' ? evidence.recoveryTestedAt : evidence.verifiedAt,
      now,
    });
    this.#claims.delete(transition.operationId);
    this.#vault.clear(transition.operationId);
    this.#guardControl();
    return this.#worker(succeeded, transition.generation);
  }

  failOperation(terminal) {
    this.#guardControl();
    const claim = this.#claims.get(terminal.operationId);
    invariant(claim && claim.generation === terminal.generation,
      'OPERATION_LEASE_LOST', 'The worker claim is no longer active.');
    const current = this.#ledger.getOperationForWorker(terminal.operationId);
    invariant(current?.phase === terminal.expectedPhase && current.status === terminal.expectedStatus,
      'OPERATION_STATE_CONFLICT', 'The operation changed before failure commit.');
    const now = this.#now();
    this.#assertLeaseLive(claim, now);
    this.#markStageInert(current.operationId, now);
    if (terminal.backupHealthEffect !== 'UNCHANGED' && current.backupId !== null) {
      this.#ledger.recordBackupHealth({
        backupId: current.backupId,
        health: terminal.backupHealthEffect,
      });
    }
    const failed = this.#ledger.failOperation({
      operationId: terminal.operationId,
      workerId: claim.workerId,
      expectedGeneration: terminal.generation,
      failureCode: terminal.failure.code,
      now,
    });
    this.#claims.delete(terminal.operationId);
    this.#vault.clear(terminal.operationId);
    this.#guardControl();
    return this.#worker(failed, terminal.generation);
  }
}
