import { createHash } from 'node:crypto';
import { StudioError, invariant } from '../../../domain/src/errors.js';
import {
  verifyRestoredWorkspaceCopy,
  verifyWorkspaceBackup,
} from '../backup/workspace-backup.js';

const RECONCILER_WORKER_ID = 'studio.backup-reconciler.v1';
const RECONCILER_LEASE_MS = 30_000;

function canonicalNow(clock) {
  const now = clock();
  invariant(typeof now === 'string' && new Date(now).toISOString() === now,
    'OPERATIONS_UNAVAILABLE', 'The reconciliation clock must return a canonical ISO date-time.');
  return now;
}

function leaseExpiry(now) {
  return new Date(Date.parse(now) + RECONCILER_LEASE_MS).toISOString();
}

function stageId(operationId) {
  return `stage.${operationId}`;
}

function identityMatches(filesystem, identity, expectedSha256) {
  return typeof expectedSha256 === 'string'
    && filesystem.identitySha256(identity) === expectedSha256;
}

function sourceHealthEffect(error) {
  return error?.details?.healthEffect === 'MISSING' ? 'MISSING' : 'SUSPECT';
}

function markStageInert(ledger, operationId, now) {
  const stage = ledger.getStageForOperation(operationId);
  if (stage !== null && stage.disposition === 'ACTIVE') {
    ledger.recordStageEvidence({ stageId: stage.stageId, disposition: 'INERT', now });
  }
}

function interrupt(ledger, operation, generation, now) {
  markStageInert(ledger, operation.operationId, now);
  return ledger.interruptOperation({
    operationId: operation.operationId,
    expectedGeneration: generation,
    now,
  });
}

async function verifyRegisteredSource({
  ledger, filesystem, backupId, requireVerified, verificationOptions,
}) {
  const backup = ledger.getBackupForWorker(backupId);
  invariant(backup, 'OPERATION_NOT_FOUND', 'The source backup is not registered.');
  if (requireVerified) {
    invariant(backup.health === 'VERIFIED',
      'OPERATION_STATE_CONFLICT', 'The source backup is not currently verified.');
  }
  const coordinate = await filesystem.resolveBackup({
    backupId: backup.backupId,
    destinationId: backup.destinationId,
  });
  invariant(identityMatches(filesystem, coordinate.identity, backup.finalIdentitySha256),
    'BACKUP_CONTENT_MISMATCH', 'The source backup filesystem identity changed.');
  const verified = await verifyWorkspaceBackup(coordinate.finalPath, verificationOptions);
  const revalidatedCoordinate = await filesystem.resolveBackup({
    backupId: backup.backupId,
    destinationId: backup.destinationId,
  });
  invariant(identityMatches(filesystem, revalidatedCoordinate.identity, backup.finalIdentitySha256),
    'BACKUP_CONTENT_MISMATCH', 'The source backup filesystem identity changed during verification.');
  invariant(backup.manifestSha256 === null || backup.manifestSha256 === verified.manifestSha256,
    'BACKUP_CONTENT_MISMATCH', 'The source backup manifest identity changed.');
  return { backup, coordinate: revalidatedCoordinate, verified };
}

function recordVerifiedHealth({ ledger, source, filesystem, verifiedAt }) {
  return ledger.recordBackupHealth({
    backupId: source.backup.backupId,
    health: 'VERIFIED',
    finalIdentitySha256: filesystem.identitySha256(source.coordinate.identity),
    manifestSha256: source.verified.manifestSha256,
    databaseSha256: source.verified.databaseSha256,
    artifactCount: source.verified.itemCount,
    byteCount: source.verified.byteCount,
    verifiedAt,
  });
}

function markSourceFailure(ledger, operation, error) {
  if (operation.backupId === null) return;
  ledger.recordBackupHealth({
    backupId: operation.backupId,
    health: sourceHealthEffect(error),
  });
}

async function reconcileVerify({ ledger, filesystem, operation, clock, verificationOptions }) {
  let generation = operation.lease.generation;
  try {
    const source = await verifyRegisteredSource({
      ledger,
      filesystem,
      backupId: operation.backupId,
      requireVerified: false,
      verificationOptions,
    });
    const now = canonicalNow(clock);
    const reclaimed = ledger.reclaimForReconciliation({
      operationId: operation.operationId,
      workerId: RECONCILER_WORKER_ID,
      expectedGeneration: generation,
      leaseExpiresAt: leaseExpiry(now),
      now,
    });
    generation = reclaimed.lease.generation;
    let phase = reclaimed.phase;
    if (phase === 'RESERVED') {
      phase = ledger.advanceOperation({
        operationId: operation.operationId,
        workerId: RECONCILER_WORKER_ID,
        expectedGeneration: generation,
        phase: 'BACKUP_RESOLVED',
        now,
      }).phase;
    }
    if (phase === 'BACKUP_RESOLVED') {
      phase = ledger.advanceOperation({
        operationId: operation.operationId,
        workerId: RECONCILER_WORKER_ID,
        expectedGeneration: generation,
        phase: 'CONTENT_VERIFIED',
        now,
      }).phase;
    }
    invariant(phase === 'CONTENT_VERIFIED',
      'OPERATION_STATE_CONFLICT', 'The verify operation cannot be reconciled from its recorded phase.');
    recordVerifiedHealth({ ledger, source, filesystem, verifiedAt: now });
    ledger.succeedOperation({
      operationId: operation.operationId,
      workerId: RECONCILER_WORKER_ID,
      expectedGeneration: generation,
      manifestSha256: source.verified.manifestSha256,
      artifactCount: source.verified.itemCount,
      byteCount: source.verified.byteCount,
      verifiedAt: now,
      now,
    });
    return 'SUCCEEDED';
  } catch (error) {
    try { markSourceFailure(ledger, operation, error); } catch {}
    interrupt(ledger, operation, generation, canonicalNow(clock));
    return 'INTERRUPTED';
  }
}

function assertPublishedStage({ stage, operation, published, filesystem }) {
  invariant(stage !== null && stage.operationId === operation.operationId,
    'OPERATION_INTERRUPTED', 'Published reconciliation requires its exact ledger stage.');
  invariant(stage.rootKey === operation.destinationId
      && stage.rootIdentitySha256 === published.root.rootKey
      && stage.filesystemIdentitySha256 === published.root.filesystemKey,
  'BACKUP_PATH_UNSAFE', 'Published output root evidence changed.');
  const expectedIdentity = stage.finalIdentitySha256 ?? stage.stageIdentitySha256;
  invariant(identityMatches(filesystem, published.identity, expectedIdentity),
    'BACKUP_CONTENT_MISMATCH', 'Published output identity differs from its reserved stage.');
}

function reclaimPublished({ ledger, operation, clock }) {
  const now = canonicalNow(clock);
  const reclaimed = ledger.reclaimForReconciliation({
    operationId: operation.operationId,
    workerId: RECONCILER_WORKER_ID,
    expectedGeneration: operation.lease.generation,
    leaseExpiresAt: leaseExpiry(now),
    now,
  });
  if (reclaimed.phase === 'DURABLY_CLOSED') {
    ledger.advanceOperation({
      operationId: operation.operationId,
      workerId: RECONCILER_WORKER_ID,
      expectedGeneration: reclaimed.lease.generation,
      phase: 'PUBLISHED',
      now,
    });
  } else {
    invariant(reclaimed.phase === 'PUBLISHED',
      'OPERATION_STATE_CONFLICT', 'Only a durable or published output can be reconciled.');
  }
  return { generation: reclaimed.lease.generation, now };
}

async function reconcileCreatePublication({
  ledger, filesystem, operation, clock, verificationOptions,
}) {
  let generation = operation.lease.generation;
  try {
    invariant(['DURABLY_CLOSED', 'PUBLISHED'].includes(operation.phase),
      'OPERATION_INTERRUPTED', 'Create cannot be resumed from this recorded phase.');
    const stage = ledger.getStageForOperation(operation.operationId);
    let published = await filesystem.resolvePublished({
      kind: 'CREATE',
      destinationId: operation.destinationId,
      operationId: operation.operationId,
      outputId: operation.outputId,
    });
    assertPublishedStage({ stage, operation, published, filesystem });
    const verified = await verifyWorkspaceBackup(published.finalPath, verificationOptions);
    published = await filesystem.resolvePublished({
      kind: 'CREATE',
      destinationId: operation.destinationId,
      operationId: operation.operationId,
      outputId: operation.outputId,
    });
    assertPublishedStage({ stage, operation, published, filesystem });
    const claim = reclaimPublished({ ledger, operation, clock });
    generation = claim.generation;
    const finalIdentitySha256 = filesystem.identitySha256(published.identity);
    ledger.recordStageEvidence({
      stageId: stage.stageId,
      finalIdentitySha256,
      disposition: 'INERT',
      now: claim.now,
    });
    const prior = ledger.getBackupForWorker(operation.outputId);
    const verifiedAt = prior?.lastVerifiedAt ?? claim.now;
    if (prior === null) {
      ledger.registerBackup({
        backupId: operation.outputId,
        destinationId: operation.destinationId,
        rootKey: operation.destinationId,
        provenance: 'CREATED',
        health: 'VERIFIED',
        finalIdentitySha256,
        manifestSha256: verified.manifestSha256,
        databaseSha256: verified.databaseSha256,
        artifactCount: verified.itemCount,
        byteCount: verified.byteCount,
        createdOperationId: operation.operationId,
        createdAt: verified.manifest.createdAt,
        registeredAt: claim.now,
        lastVerifiedAt: verifiedAt,
      });
    } else {
      invariant(prior.createdOperationId === operation.operationId
          && prior.health === 'VERIFIED'
          && prior.finalIdentitySha256 === finalIdentitySha256
          && prior.manifestSha256 === verified.manifestSha256
          && prior.databaseSha256 === verified.databaseSha256
          && prior.artifactCount === verified.itemCount
          && prior.byteCount === verified.byteCount,
      'OPERATION_STATE_CONFLICT', 'Existing backup registration differs from reconciliation evidence.');
    }
    ledger.succeedOperation({
      operationId: operation.operationId,
      workerId: RECONCILER_WORKER_ID,
      expectedGeneration: generation,
      manifestSha256: verified.manifestSha256,
      artifactCount: verified.itemCount,
      byteCount: verified.byteCount,
      verifiedAt,
      now: claim.now,
    });
    return 'SUCCEEDED';
  } catch {
    interrupt(ledger, operation, generation, canonicalNow(clock));
    return 'INTERRUPTED';
  }
}

async function reconcileRestorePublication({
  ledger, filesystem, operation, clock, databaseFactory, verificationOptions,
}) {
  let generation = operation.lease.generation;
  let sourceVerified = false;
  try {
    invariant(['DURABLY_CLOSED', 'PUBLISHED'].includes(operation.phase),
      'OPERATION_INTERRUPTED', 'Restore cannot be resumed from this recorded phase.');
    const source = await verifyRegisteredSource({
      ledger,
      filesystem,
      backupId: operation.backupId,
      requireVerified: true,
      verificationOptions,
    });
    sourceVerified = true;
    const stage = ledger.getStageForOperation(operation.operationId);
    let published = await filesystem.resolvePublished({
      kind: 'RESTORE_AS_COPY',
      destinationId: operation.destinationId,
      operationId: operation.operationId,
      outputId: operation.outputId,
    });
    assertPublishedStage({ stage, operation, published, filesystem });
    const verified = await verifyRestoredWorkspaceCopy({
      copyDirectory: published.finalPath,
      expectedManifest: source.verified.manifest,
      expectedManifestSha256: source.verified.manifestSha256,
      expectedBackupId: operation.backupId,
      expectedCopyId: operation.outputId,
      purpose: 'VERIFY',
      ...(databaseFactory ? { databaseFactory } : {}),
    }, verificationOptions);
    published = await filesystem.resolvePublished({
      kind: 'RESTORE_AS_COPY',
      destinationId: operation.destinationId,
      operationId: operation.operationId,
      outputId: operation.outputId,
    });
    assertPublishedStage({ stage, operation, published, filesystem });
    const claim = reclaimPublished({ ledger, operation, clock });
    generation = claim.generation;
    const finalIdentitySha256 = filesystem.identitySha256(published.identity);
    ledger.recordStageEvidence({
      stageId: stage.stageId,
      finalIdentitySha256,
      disposition: 'INERT',
      now: claim.now,
    });
    const prior = ledger.getRestoredCopyForWorker(operation.outputId);
    const verifiedAt = prior?.verifiedAt ?? claim.now;
    if (prior === null) {
      ledger.registerRestoredCopy({
        copyId: operation.outputId,
        sourceBackupId: operation.backupId,
        destinationId: operation.destinationId,
        rootKey: operation.destinationId,
        finalIdentitySha256,
        manifestSha256: verified.manifestSha256,
        artifactCount: verified.itemCount,
        byteCount: verified.byteCount,
        createdOperationId: operation.operationId,
        verifiedAt,
      });
    } else {
      invariant(prior.createdOperationId === operation.operationId
          && prior.sourceBackupId === operation.backupId
          && prior.lifecycle === 'QUARANTINED_VERIFIED'
          && prior.finalIdentitySha256 === finalIdentitySha256
          && prior.manifestSha256 === verified.manifestSha256
          && prior.artifactCount === verified.itemCount
          && prior.byteCount === verified.byteCount,
      'OPERATION_STATE_CONFLICT', 'Existing restored-copy record differs from reconciliation evidence.');
    }
    ledger.succeedOperation({
      operationId: operation.operationId,
      workerId: RECONCILER_WORKER_ID,
      expectedGeneration: generation,
      manifestSha256: verified.manifestSha256,
      artifactCount: verified.itemCount,
      byteCount: verified.byteCount,
      verifiedAt,
      now: claim.now,
    });
    return 'SUCCEEDED';
  } catch (error) {
    if (!sourceVerified) {
      try { markSourceFailure(ledger, operation, error); } catch {}
    }
    interrupt(ledger, operation, generation, canonicalNow(clock));
    return 'INTERRUPTED';
  }
}

async function interruptRecoveryTest({ ledger, filesystem, operation, clock }) {
  const now = canonicalNow(clock);
  const stage = ledger.getStageForOperation(operation.operationId);
  if (stage?.stageIdentitySha256) {
    try {
      const coordinate = await filesystem.resolveRecoveryTest({ operationId: operation.operationId });
      if (identityMatches(filesystem, coordinate.identity, stage.stageIdentitySha256)) {
        await filesystem.cleanupRecoveryTest(coordinate, coordinate.identity);
      }
    } catch (error) {
      if (!(error instanceof StudioError)) throw error;
    }
  }
  interrupt(ledger, operation, operation.lease.generation, now);
  return 'INTERRUPTED';
}

function orphanStageId(discovery) {
  const digest = createHash('sha256')
    .update(`${discovery.rootKey}\0${discovery.basename}`)
    .digest('hex');
  return `orphan.${digest}`;
}

async function reconcileDiscoveries({ ledger, filesystem, clock, verificationOptions }) {
  const discoveries = await filesystem.discoverOperationEntries();
  const stages = ledger.listStages();
  const knownStages = new Set(stages.map((stage) => `${stage.rootKey}\0${stage.stageBasename}`));
  const reservedFinals = new Set(stages
    .filter((stage) => stage.finalBasename !== null)
    .map((stage) => `${stage.rootKey}\0${stage.finalBasename}`));
  let orphaned = 0;
  let discovered = 0;
  let rejectedFinals = 0;
  for (const entry of discoveries) {
    const key = `${entry.rootKey}\0${entry.basename}`;
    if (entry.role === 'STAGE' && !knownStages.has(key)) {
      const finalBasename = entry.kind === 'BACKUP'
        ? `backup-${entry.opaqueId}`
        : entry.kind === 'RESTORE_COPY'
          ? `workspace-copy-${entry.opaqueId}`
          : null;
      const registered = ledger.registerOrphanedStage({
        stageId: orphanStageId(entry),
        kind: entry.kind,
        rootKey: entry.rootKey,
        destinationId: entry.destinationId,
        stageBasename: entry.basename,
        finalBasename,
        rootIdentitySha256: entry.rootIdentitySha256,
        filesystemIdentitySha256: entry.filesystemIdentitySha256,
        now: canonicalNow(clock),
      });
      ledger.recordStageEvidence({
        stageId: registered.stageId,
        stageIdentitySha256: filesystem.identitySha256(entry.identity),
        disposition: 'ORPHANED',
        now: canonicalNow(clock),
      });
      orphaned += 1;
    } else if (entry.role === 'FINAL' && entry.kind === 'BACKUP'
        && !reservedFinals.has(key) && ledger.getBackup(entry.opaqueId) === null) {
      let verified;
      let revalidated;
      try {
        verified = await verifyWorkspaceBackup(entry.path, verificationOptions);
        revalidated = await filesystem.resolveBackup({
          backupId: entry.opaqueId,
          destinationId: entry.destinationId,
        });
        invariant(
          revalidated.finalPath === entry.path
            && revalidated.root.rootKey === entry.rootIdentitySha256
            && revalidated.root.filesystemKey === entry.filesystemIdentitySha256,
          'BACKUP_PATH_UNSAFE',
          'Discovered backup root identity changed during verification.',
        );
        invariant(
          filesystem.identitySha256(revalidated.identity)
            === filesystem.identitySha256(entry.identity),
          'BACKUP_CONTENT_MISMATCH',
          'Discovered backup identity changed during verification.',
        );
      } catch {
        rejectedFinals += 1;
        continue;
      }
      const now = canonicalNow(clock);
      ledger.registerBackup({
        backupId: entry.opaqueId,
        destinationId: entry.destinationId,
        rootKey: entry.destinationId,
        provenance: 'DISCOVERED',
        health: 'VERIFIED',
        finalIdentitySha256: filesystem.identitySha256(revalidated.identity),
        manifestSha256: verified.manifestSha256,
        databaseSha256: verified.databaseSha256,
        artifactCount: verified.itemCount,
        byteCount: verified.byteCount,
        createdAt: verified.manifest.createdAt,
        registeredAt: now,
        lastVerifiedAt: now,
      });
      discovered += 1;
    }
  }
  return { orphaned, discovered, rejectedFinals };
}

export async function reconcileBackupOperations({
  ledger,
  filesystem,
  clock = () => new Date().toISOString(),
  databaseFactory,
  platform = process.platform,
  spawnProcess,
}) {
  invariant(ledger && filesystem && typeof clock === 'function',
    'OPERATIONS_UNAVAILABLE', 'Backup reconciliation dependencies are required.');
  invariant(['linux', 'win32'].includes(platform),
    'OPERATIONS_UNAVAILABLE', 'Backup reconciliation platform is unsupported.');
  const verificationOptions = Object.freeze({
    platform,
    ...(spawnProcess ? { spawnProcess } : {}),
  });
  const summary = { queued: 0, succeeded: 0, interrupted: 0 };
  for (const operation of ledger.listOperationsForReconciliation()) {
    if (operation.status === 'QUEUED') {
      summary.queued += 1;
      continue;
    }
    let result;
    if (operation.kind === 'VERIFY') {
      result = await reconcileVerify({
        ledger, filesystem, operation, clock, verificationOptions,
      });
    } else if (operation.kind === 'CREATE') {
      result = await reconcileCreatePublication({
        ledger, filesystem, operation, clock, verificationOptions,
      });
    } else if (operation.kind === 'RESTORE_AS_COPY') {
      result = await reconcileRestorePublication({
        ledger, filesystem, operation, clock, databaseFactory, verificationOptions,
      });
    } else {
      result = await interruptRecoveryTest({ ledger, filesystem, operation, clock });
    }
    summary[result === 'SUCCEEDED' ? 'succeeded' : 'interrupted'] += 1;
  }
  const discoveries = await reconcileDiscoveries({
    ledger, filesystem, clock, verificationOptions,
  });
  return Object.freeze({ ...summary, ...discoveries });
}
