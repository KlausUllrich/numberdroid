import assert from 'node:assert/strict';
import test from 'node:test';
import { StudioError } from '../packages/domain/src/errors.js';
import {
  BACKUP_OPERATION_PHASES,
  backupOperationRequestFingerprint,
  initialBackupOperationState,
  projectBackupOperationFailure,
  transitionBackupOperationState,
  validateBackupOperationRequest,
} from '../packages/domain/src/backup-operation.js';
import {
  BACKUP_OPERATION_COMMAND_STORE_KIND,
  BackupOperationService,
  LOCAL_WORKSPACE_OPERATOR_KIND,
  LOCAL_WORKSPACE_OPERATOR_SUBJECT,
  WORKSPACE_BACKUP_CAPABILITY,
} from '../packages/application/src/backup-operation-service.js';
import {
  BACKUP_OPERATION_PHASE_EXECUTOR_KIND,
  BACKUP_OPERATION_PHASE_OUTCOME_KIND,
  BACKUP_OPERATION_WORKER_STORE_KIND,
  BackupOperationWorker,
} from '../packages/application/src/backup-operation-worker.js';

const NOW = '2026-08-29T12:00:00.000Z';

function operatorContext(overrides = {}) {
  return {
    schemaVersion: 1,
    kind: LOCAL_WORKSPACE_OPERATOR_KIND,
    subject: LOCAL_WORKSPACE_OPERATOR_SUBJECT,
    capabilities: [WORKSPACE_BACKUP_CAPABILITY],
    ...overrides,
  };
}

function createRequest(overrides = {}) {
  return {
    schemaVersion: 1,
    kind: 'CREATE',
    destinationId: 'destination.backup.primary',
    idempotencyKey: 'idempotency.backup.create.1',
    ...overrides,
  };
}

function queuedProjection(reservation) {
  return {
    schemaVersion: 1,
    operationId: reservation.operationId,
    kind: reservation.kind,
    status: 'QUEUED',
    phase: 'RESERVED',
    progress: reservation.progress,
    destinationId: reservation.destinationId,
    destinationLabel: reservation.destinationId === null ? null : 'Primary local backups',
    backupId: reservation.createdBackupId ?? reservation.sourceBackupId,
    restoredCopyId: reservation.restoredCopyId,
    result: null,
    failure: null,
    createdAt: reservation.createdAt,
    startedAt: null,
    finishedAt: null,
    updatedAt: reservation.createdAt,
  };
}

function commandStore() {
  const byKey = new Map();
  let insertCount = 0;
  return {
    port: {
      schemaVersion: 1,
      kind: BACKUP_OPERATION_COMMAND_STORE_KIND,
      reserveOperation(reservation) {
        const previous = byKey.get(reservation.idempotencyKey);
        if (previous) {
          if (previous.fingerprint !== reservation.requestFingerprint) {
            throw new StudioError(
              'OPERATION_IDEMPOTENCY_CONFLICT',
              'internal message must not cross the application seam',
              { path: '/not/allowed' },
            );
          }
          return structuredClone(previous.projection);
        }
        const projection = queuedProjection(reservation);
        byKey.set(reservation.idempotencyKey, {
          fingerprint: reservation.requestFingerprint,
          projection,
        });
        insertCount += 1;
        return structuredClone(projection);
      },
      readOperation({ operationId }) {
        return [...byKey.values()].find(({ projection }) => projection.operationId === operationId)?.projection ?? null;
      },
    },
    get insertCount() { return insertCount; },
  };
}

function deterministicIds() {
  const counts = new Map();
  return (namespace) => {
    const count = (counts.get(namespace) ?? 0) + 1;
    counts.set(namespace, count);
    return `${namespace}.${count}`;
  };
}

function emptyEvidence(overrides = {}) {
  return {
    manifestIdentity: null,
    itemCount: null,
    byteCount: null,
    verifiedAt: null,
    recoveryTestedAt: null,
    backupHealth: null,
    restoredCopyLifecycle: null,
    cleanupConfirmed: null,
    ...overrides,
  };
}

function workerOperation(kind = 'CREATE') {
  const state = transitionBackupOperationState(initialBackupOperationState(kind), {
    status: 'RUNNING',
    phase: 'RESERVED',
  });
  return {
    schemaVersion: 1,
    operationId: `operation.${kind.toLowerCase()}`,
    kind,
    status: state.status,
    phase: state.phase,
    progress: state.progress,
    generation: 1,
    destinationId: ['CREATE', 'RESTORE_AS_COPY'].includes(kind) ? 'destination.primary' : null,
    sourceBackupId: kind === 'CREATE' ? null : 'backup.source',
    createdBackupId: kind === 'CREATE' ? 'backup.created' : null,
    restoredCopyId: kind === 'RESTORE_AS_COPY' ? 'copy.restored' : null,
  };
}

function workerStore(initial) {
  let current = structuredClone(initial);
  const commits = [];
  const failures = [];
  return {
    port: {
      schemaVersion: 1,
      kind: BACKUP_OPERATION_WORKER_STORE_KIND,
      leaseConfiguration: {
        schemaVersion: 1,
        ttlMs: 30_000,
        heartbeatIntervalMs: 10_000,
      },
      claimNextOperation() {
        const result = current;
        current = null;
        return structuredClone(result);
      },
      renewOperationLease() {},
      commitOperationPhase(transition) {
        commits.push(structuredClone(transition));
        current = {
          ...initial,
          status: transition.nextStatus,
          phase: transition.nextPhase,
          progress: transition.progress,
        };
        initial = structuredClone(current);
        return structuredClone(current);
      },
      failOperation(terminal) {
        failures.push(structuredClone(terminal));
        current = {
          ...initial,
          status: 'FAILED',
          phase: terminal.expectedPhase,
          progress: initial.progress,
        };
        initial = structuredClone(current);
        return structuredClone(current);
      },
    },
    commits,
    failures,
  };
}

test('O1 request contract accepts only four closed opaque-ID shapes and fingerprints semantic input', () => {
  const requests = [
    createRequest(),
    {
      schemaVersion: 1,
      kind: 'VERIFY',
      backupId: 'backup.verified.1',
      idempotencyKey: 'idempotency.backup.verify.1',
    },
    {
      schemaVersion: 1,
      kind: 'RECOVERY_TEST',
      backupId: 'backup.verified.1',
      idempotencyKey: 'idempotency.backup.recovery.1',
    },
    {
      schemaVersion: 1,
      kind: 'RESTORE_AS_COPY',
      backupId: 'backup.verified.1',
      destinationId: 'destination.restore.primary',
      idempotencyKey: 'idempotency.backup.restore.1',
    },
  ];
  for (const request of requests) assert.deepEqual(validateBackupOperationRequest(request), request);

  for (const forbidden of [
    { path: '/tmp/backup' },
    { delete: true },
    { activate: true },
    { remoteTarget: 'host.example' },
    { taskId: 'task.agent' },
  ]) {
    assert.throws(
      () => validateBackupOperationRequest({ ...createRequest(), ...forbidden }),
      (error) => error.code === 'VALIDATION_ERROR',
    );
  }
  assert.throws(
    () => validateBackupOperationRequest(createRequest({ destinationId: '../escape' })),
    (error) => error.code === 'VALIDATION_ERROR',
  );

  const reordered = {
    idempotencyKey: createRequest().idempotencyKey,
    destinationId: createRequest().destinationId,
    kind: 'CREATE',
    schemaVersion: 1,
  };
  assert.equal(
    backupOperationRequestFingerprint(createRequest()),
    backupOperationRequestFingerprint(reordered),
  );
  assert.notEqual(
    backupOperationRequestFingerprint(createRequest()),
    backupOperationRequestFingerprint(createRequest({ destinationId: 'destination.backup.secondary' })),
  );
  assert.equal(
    backupOperationRequestFingerprint(createRequest()),
    backupOperationRequestFingerprint(createRequest({ idempotencyKey: 'idempotency.backup.create.2' })),
  );
});

test('O1 state machine admits only claim, one-step phase advance, and phase-retaining failure', () => {
  for (const [kind, phases] of Object.entries(BACKUP_OPERATION_PHASES)) {
    let state = initialBackupOperationState(kind);
    assert.equal(state.status, 'QUEUED');
    state = transitionBackupOperationState(state, { status: 'RUNNING', phase: 'RESERVED' });
    for (const phase of phases.slice(1)) {
      state = transitionBackupOperationState(state, {
        status: phase === 'COMPLETED' ? 'SUCCEEDED' : 'RUNNING',
        phase,
      });
    }
    assert.equal(state.status, 'SUCCEEDED');
    assert.equal(state.progress.current, state.progress.total);
    assert.throws(
      () => transitionBackupOperationState(state, { status: 'RUNNING', phase: 'RESERVED' }),
      (error) => error.code === 'OPERATION_STATE_CONFLICT',
    );
  }

  const running = transitionBackupOperationState(initialBackupOperationState('CREATE'), {
    status: 'RUNNING',
    phase: 'RESERVED',
  });
  assert.throws(
    () => transitionBackupOperationState(running, { status: 'RUNNING', phase: 'DB_SNAPSHOTTED' }),
    (error) => error.code === 'OPERATION_STATE_CONFLICT',
  );
  assert.deepEqual(
    transitionBackupOperationState(running, { status: 'FAILED', phase: 'RESERVED' }),
    { ...running, status: 'FAILED' },
  );
  assert.deepEqual(
    transitionBackupOperationState(running, { status: 'INTERRUPTED', phase: 'RESERVED' }),
    { ...running, status: 'INTERRUPTED' },
  );
  assert.throws(
    () => transitionBackupOperationState(running, { status: 'FAILED', phase: 'COMPLETED' }),
    (error) => error.code === 'OPERATION_STATE_CONFLICT',
  );
});

test('O1 application service requires the dedicated human capability and replays without leaking internals', async () => {
  const store = commandStore();
  const service = new BackupOperationService({
    store: store.port,
    clock: () => NOW,
    idFactory: deterministicIds(),
  });

  await assert.rejects(
    service.requestOperation(createRequest(), null),
    (error) => error.code === 'WORKSPACE_OPERATOR_REQUIRED',
  );
  await assert.rejects(
    service.requestOperation(createRequest(), operatorContext({
      kind: 'AGENT',
      taskId: 'task.backup',
    })),
    (error) => error.code === 'WORKSPACE_OPERATOR_FORBIDDEN',
  );
  assert.equal(store.insertCount, 0);

  const first = await service.requestOperation(createRequest(), operatorContext());
  const replay = await service.requestOperation(createRequest(), operatorContext());
  assert.deepEqual(replay, first);
  assert.equal(store.insertCount, 1);
  assert.equal(first.status, 'QUEUED');
  assert.doesNotMatch(
    JSON.stringify(first),
    /idempotency|fingerprint|creatorSubject|lease|generation|stage|\/tmp\//i,
  );
  assert.deepEqual(
    await service.readOperation({ schemaVersion: 1, operationId: first.operationId }, operatorContext()),
    first,
  );
  await assert.rejects(
    service.requestOperation(
      createRequest({ destinationId: 'destination.backup.secondary' }),
      operatorContext(),
    ),
    (error) => error.code === 'OPERATION_IDEMPOTENCY_CONFLICT'
      && !JSON.stringify(error).includes('/not/allowed'),
  );
});

test('O1 serialized worker follows exact phases and sanitizes executor failures', async () => {
  const createStore = workerStore(workerOperation('CREATE'));
  const selections = [];
  const worker = new BackupOperationWorker({
    store: createStore.port,
    phaseExecutor: {
      schemaVersion: 1,
      kind: BACKUP_OPERATION_PHASE_EXECUTOR_KIND,
      executePhase(selection) {
        selections.push(structuredClone(selection));
        return {
          schemaVersion: 1,
          kind: BACKUP_OPERATION_PHASE_OUTCOME_KIND,
          outcome: 'COMPLETED',
          operationId: selection.operationId,
          generation: selection.generation,
          phase: selection.targetPhase,
          evidence: emptyEvidence(),
        };
      },
      releaseOperationResources() {},
    },
  });
  const succeeded = await worker.runNext({ workerId: 'worker.backup.1' });
  assert.equal(succeeded.status, 'SUCCEEDED');
  assert.deepEqual(
    selections.map(({ targetPhase }) => targetPhase),
    BACKUP_OPERATION_PHASES.CREATE.slice(1),
  );
  assert.doesNotMatch(
    JSON.stringify(selections),
    /path|idempotency|operator|task|grant|hostbinding|token|secret/i,
  );

  const verifyStore = workerStore(workerOperation('VERIFY'));
  const failedWorker = new BackupOperationWorker({
    store: verifyStore.port,
    phaseExecutor: {
      schemaVersion: 1,
      kind: BACKUP_OPERATION_PHASE_EXECUTOR_KIND,
      executePhase() {
        throw new Error('secret stack and /private/workspace/path');
      },
      releaseOperationResources() {},
    },
  });
  const failed = await failedWorker.runNext({ workerId: 'worker.backup.2' });
  assert.equal(failed.status, 'FAILED');
  assert.deepEqual(failed.failure, projectBackupOperationFailure(null, { kind: 'VERIFY' }));
  assert.equal(verifyStore.failures[0].backupHealthEffect, 'UNCHANGED');
  assert.doesNotMatch(JSON.stringify(failed), /secret|private|workspace\/path|stack/i);
});

test('O1 worker finally releases executor resources after commit failure and terminal abort', async () => {
  for (const scenario of ['commit-failure', 'abort']) {
    const operation = workerOperation('CREATE');
    const controller = new AbortController();
    let claimed = false;
    let commitCalls = 0;
    const released = [];
    const worker = new BackupOperationWorker({
      store: {
        schemaVersion: 1,
        kind: BACKUP_OPERATION_WORKER_STORE_KIND,
        leaseConfiguration: {
          schemaVersion: 1,
          ttlMs: 30_000,
          heartbeatIntervalMs: 10_000,
        },
        claimNextOperation() {
          if (claimed) return null;
          claimed = true;
          return structuredClone(operation);
        },
        renewOperationLease() {},
        commitOperationPhase() {
          commitCalls += 1;
          throw new StudioError(
            'OPERATIONS_UNAVAILABLE',
            'raw control failure /must/not/leak',
          );
        },
        failOperation() {
          throw new Error('failure commit is not expected in this seam');
        },
      },
      phaseExecutor: {
        schemaVersion: 1,
        kind: BACKUP_OPERATION_PHASE_EXECUTOR_KIND,
        executePhase(selection) {
          if (scenario === 'abort') controller.abort();
          return {
            schemaVersion: 1,
            kind: BACKUP_OPERATION_PHASE_OUTCOME_KIND,
            outcome: 'COMPLETED',
            operationId: selection.operationId,
            generation: selection.generation,
            phase: selection.targetPhase,
            evidence: emptyEvidence(),
          };
        },
        releaseOperationResources(selection) {
          released.push(structuredClone(selection));
        },
      },
    });

    await assert.rejects(
      worker.runNext({
        workerId: `worker.cleanup.${scenario}`,
        ...(scenario === 'abort' ? { signal: controller.signal } : {}),
      }),
      scenario === 'abort'
        ? (error) => error.name === 'AbortError'
        : (error) => error.code === 'OPERATIONS_UNAVAILABLE'
          && !error.message.includes('/must/not/leak'),
    );
    assert.deepEqual(released, [{
      schemaVersion: 1,
      operationId: operation.operationId,
    }]);
    assert.equal(commitCalls, scenario === 'commit-failure' ? 1 : 0);
  }
});

test('O1 worker preserves a primary lease failure over cleanup failure and sanitizes cleanup-only failure', async () => {
  function workerWithCleanupFailure({ failPhase }) {
    const operation = workerOperation('CREATE');
    operation.phase = 'PUBLISHED';
    operation.progress = {
      current: BACKUP_OPERATION_PHASES.CREATE.indexOf(operation.phase),
      total: BACKUP_OPERATION_PHASES.CREATE.length - 1,
    };
    const store = workerStore(operation);
    return new BackupOperationWorker({
      store: store.port,
      phaseExecutor: {
        schemaVersion: 1,
        kind: BACKUP_OPERATION_PHASE_EXECUTOR_KIND,
        executePhase(selection) {
          if (failPhase) {
            throw new StudioError('OPERATION_LEASE_LOST', 'primary lease failure');
          }
          return {
            schemaVersion: 1,
            kind: BACKUP_OPERATION_PHASE_OUTCOME_KIND,
            outcome: 'COMPLETED',
            operationId: selection.operationId,
            generation: selection.generation,
            phase: selection.targetPhase,
            evidence: emptyEvidence(),
          };
        },
        releaseOperationResources() {
          throw new Error('cleanup secret /must/not/leak');
        },
      },
    });
  }

  await assert.rejects(
    workerWithCleanupFailure({ failPhase: true }).runNext({ workerId: 'worker.cleanup.primary' }),
    (error) => error.code === 'OPERATION_LEASE_LOST',
  );
  await assert.rejects(
    workerWithCleanupFailure({ failPhase: false }).runNext({ workerId: 'worker.cleanup.only' }),
    (error) => error.code === 'OPERATIONS_UNAVAILABLE'
      && !error.message.includes('/must/not/leak'),
  );
});

test('O1 worker fences a blocked published effect after heartbeat loss and cleans up only after settlement', { timeout: 10_000 }, async () => {
  const operation = workerOperation('CREATE');
  operation.phase = 'DURABLY_CLOSED';
  operation.progress = {
    current: BACKUP_OPERATION_PHASES.CREATE.indexOf(operation.phase),
    total: BACKUP_OPERATION_PHASES.CREATE.length - 1,
  };
  const phaseRelease = (() => {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    return { promise, resolve };
  })();
  const thirdRenewal = (() => {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    return { promise, resolve };
  })();
  const fenceObserved = (() => {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    return { promise, resolve };
  })();
  let renewalCount = 0;
  let activeRenewals = 0;
  let maxActiveRenewals = 0;
  let phaseSettled = false;
  let publishCalled = false;
  let ledgerMutationCalled = false;
  const cleanups = [];
  const worker = new BackupOperationWorker({
    store: {
      schemaVersion: 1,
      kind: BACKUP_OPERATION_WORKER_STORE_KIND,
      leaseConfiguration: {
        schemaVersion: 1,
        ttlMs: 1000,
        heartbeatIntervalMs: 1,
      },
      claimNextOperation() { return structuredClone(operation); },
      async renewOperationLease() {
        activeRenewals += 1;
        maxActiveRenewals = Math.max(maxActiveRenewals, activeRenewals);
        await new Promise((resolve) => setTimeout(resolve, 2));
        activeRenewals -= 1;
        renewalCount += 1;
        if (renewalCount === 3) {
          thirdRenewal.resolve();
          throw new StudioError('OPERATION_LEASE_LOST', 'injected heartbeat failure');
        }
      },
      commitOperationPhase() {
        throw new Error('unexpected phase commit after heartbeat failure');
      },
      failOperation() { throw new Error('unexpected failure commit'); },
    },
    phaseExecutor: {
      schemaVersion: 1,
      kind: BACKUP_OPERATION_PHASE_EXECUTOR_KIND,
      async executePhase(selection, { signal }) {
        assert.equal(selection.targetPhase, 'PUBLISHED');
        signal.addEventListener('abort', fenceObserved.resolve, { once: true });
        await phaseRelease.promise;
        phaseSettled = true;
        AbortSignal.prototype.throwIfAborted.call(signal);
        publishCalled = true;
        ledgerMutationCalled = true;
        return {
          schemaVersion: 1,
          kind: BACKUP_OPERATION_PHASE_OUTCOME_KIND,
          outcome: 'COMPLETED',
          operationId: selection.operationId,
          generation: selection.generation,
          phase: selection.targetPhase,
          evidence: emptyEvidence(),
        };
      },
      releaseOperationResources(selection) {
        assert.equal(phaseSettled, true, 'cleanup must wait for actual phase settlement');
        cleanups.push(structuredClone(selection));
      },
    },
  });

  const run = worker.runNext({ workerId: 'worker.periodic-heartbeat' });
  await thirdRenewal.promise;
  await fenceObserved.promise;
  assert.equal(maxActiveRenewals, 1);
  assert.deepEqual(cleanups, []);
  phaseRelease.resolve();
  await assert.rejects(run, (error) => error.code === 'OPERATION_LEASE_LOST');
  assert.ok(renewalCount >= 3);
  assert.equal(maxActiveRenewals, 1);
  assert.equal(publishCalled, false);
  assert.equal(ledgerMutationCalled, false);
  assert.deepEqual(cleanups, [{ schemaVersion: 1, operationId: operation.operationId }]);
});
