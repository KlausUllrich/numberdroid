import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BACKUP_OPERATION_QUERY_STORE_KIND,
  BackupOperationQueryService,
  LOCAL_WORKSPACE_OPERATOR_KIND,
  LOCAL_WORKSPACE_OPERATOR_SUBJECT,
  WORKSPACE_BACKUP_CAPABILITY,
} from '../packages/application/src/backup-operation-service.js';
import { BackupOperationsController } from '../apps/studio-server/src/backup-operations-controller.js';

const NOW = '2026-08-30T12:00:00.000Z';
const bootstrapSecret = Buffer.alloc(24, 0x51).toString('base64url');

function operatorContext() {
  return {
    schemaVersion: 1,
    kind: LOCAL_WORKSPACE_OPERATOR_KIND,
    subject: LOCAL_WORKSPACE_OPERATOR_SUBJECT,
    capabilities: [WORKSPACE_BACKUP_CAPABILITY],
  };
}

function operation(overrides = {}) {
  return {
    schemaVersion: 1,
    operationId: 'operation.o1b.1',
    kind: 'CREATE',
    status: 'QUEUED',
    phase: 'RESERVED',
    progress: { current: 0, total: 8 },
    destinationId: 'backup.local',
    destinationLabel: 'Local backups',
    backupId: 'backup.o1b.1',
    restoredCopyId: null,
    result: null,
    failure: null,
    createdAt: NOW,
    startedAt: null,
    finishedAt: null,
    updatedAt: NOW,
    ...overrides,
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((settle) => { resolve = settle; });
  return { promise, resolve };
}

async function eventually(assertion) {
  const deadline = Date.now() + 1_000;
  while (Date.now() < deadline) {
    try { return assertion(); } catch {}
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  return assertion();
}

test('O1b additive query service requires workspace-operator authority and bounds public records', { timeout: 5_000 }, async () => {
  const service = new BackupOperationQueryService({
    store: {
      schemaVersion: 1,
      kind: BACKUP_OPERATION_QUERY_STORE_KIND,
      listRecentOperations: () => [operation()],
    },
  });
  await assert.rejects(service.listRecentOperations(null), { code: 'WORKSPACE_OPERATOR_REQUIRED' });
  await assert.rejects(service.listRecentOperations({ ...operatorContext(), capabilities: [] }), {
    code: 'WORKSPACE_OPERATOR_FORBIDDEN',
  });
  assert.deepEqual(await service.listRecentOperations(operatorContext()), [operation()]);
});

test('O1b controller redacts backup records and its wake latch cannot strand an accepted request', { timeout: 5_000 }, async () => {
  const firstClaim = deferred();
  const queue = [];
  const recent = [];
  let runCalls = 0;
  let closed = false;
  const runtime = {
    async requestOperation(request) {
      const queued = operation({
        operationId: `operation.o1b.${recent.length + 1}`,
        kind: request.kind,
        destinationId: request.destinationId ?? null,
        destinationLabel: request.destinationId ? 'Local backups' : null,
        backupId: request.backupId ?? 'backup.o1b.1',
      });
      recent.unshift(queued);
      queue.push(queued);
      return queued;
    },
    async readOperation({ operationId }) {
      return recent.find((entry) => entry.operationId === operationId) ?? null;
    },
    async listRecentOperations() { return structuredClone(recent); },
    listBackups() {
      return [{
        schemaVersion: 1,
        backupId: 'backup.o1b.1',
        destinationId: 'backup.local',
        provenance: 'CREATED',
        health: 'VERIFIED',
        manifestSha256: 'a'.repeat(64),
        databaseSha256: 'b'.repeat(64),
        artifactCount: 3,
        byteCount: 2048,
        createdAt: NOW,
        registeredAt: NOW,
        lastVerifiedAt: NOW,
        lastRecoveryTestedAt: null,
      }];
    },
    listDestinations(kind) {
      return kind === 'CREATE'
        ? [{ destinationId: 'backup.local', label: 'Local backups' }]
        : [{ destinationId: 'restore.local', label: 'Restored copies' }];
    },
    async runNext() {
      runCalls += 1;
      if (runCalls === 1) return firstClaim.promise;
      const queued = queue.shift() ?? null;
      if (queued === null) return null;
      Object.assign(recent.find((entry) => entry.operationId === queued.operationId), {
        status: 'SUCCEEDED',
        phase: 'COMPLETED',
        progress: { current: 8, total: 8 },
        startedAt: NOW,
        finishedAt: NOW,
      });
      return queued;
    },
    async close() { closed = true; },
  };
  const controller = new BackupOperationsController({
    runtime,
    bootstrapSecret,
    clock: () => 0,
    randomSource: (size) => Buffer.alloc(size, 0x61),
  });
  controller.start();
  const unlocked = controller.unlock(bootstrapSecret);
  const cookie = unlocked.cookie.split(';', 1)[0];
  const accepted = await controller.request({
    schemaVersion: 1,
    kind: 'CREATE',
    destinationId: 'backup.local',
    idempotencyKey: 'o1b.create.1',
  }, cookie);
  assert.equal(accepted.operation.status, 'QUEUED');
  firstClaim.resolve(null);
  await eventually(() => assert.equal(recent[0].status, 'SUCCEEDED'));
  assert.ok(runCalls >= 3, 'the wake arriving during an empty claim must trigger another drain pass');

  const overview = await controller.overview(cookie);
  assert.equal(overview.candidateStatus, 'implemented candidate — not user accepted');
  assert.equal(overview.backups[0].destinationLabel, 'Local backups');
  assert.equal(overview.backups[0].manifestIdentity, 'a'.repeat(64));
  assert.equal(Object.hasOwn(overview.backups[0], 'databaseSha256'), false);
  assert.doesNotMatch(JSON.stringify(overview), /databaseSha256|\/tmp\/|controlRoot/);
  await assert.rejects(controller.overview(), { code: 'OPERATIONS_UNAVAILABLE' });
  await controller.close();
  assert.equal(closed, true);
});

test('O1b worker restarts when acceptance lands after drain settlement but before finalization', { timeout: 5_000 }, async () => {
  const firstClaim = deferred();
  const acceptedResult = deferred();
  const accepted = operation({ operationId: 'operation.o1b.finalizer-gap' });
  let queued = false;
  let runCalls = 0;
  const runtime = {
    requestOperation() {
      queued = true;
      return acceptedResult.promise;
    },
    async readOperation() { return null; },
    async listRecentOperations() { return []; },
    listBackups() { return []; },
    listDestinations(kind) {
      return kind === 'CREATE'
        ? [{ destinationId: 'backup.local', label: 'Local backups' }]
        : [{ destinationId: 'restore.local', label: 'Restored copies' }];
    },
    runNext() {
      runCalls += 1;
      if (runCalls === 1) return firstClaim.promise;
      if (queued) {
        queued = false;
        return Promise.resolve(accepted);
      }
      return Promise.resolve(null);
    },
    async close() {},
  };
  const controller = new BackupOperationsController({
    runtime,
    bootstrapSecret,
    clock: () => 0,
    randomSource: (size) => Buffer.alloc(size, 0x63),
  });
  controller.start();
  const cookie = controller.unlock(bootstrapSecret).cookie.split(';', 1)[0];
  const request = controller.request({
    schemaVersion: 1,
    kind: 'CREATE',
    destinationId: 'backup.local',
    idempotencyKey: 'o1b.create.finalizer-gap',
  }, cookie);
  firstClaim.resolve(null);
  acceptedResult.resolve(accepted);
  await request;
  await new Promise((resolveImmediate) => setImmediate(resolveImmediate));
  assert.equal(queued, false, 'accepted work must not remain queued across the drain finalizer gap');
  assert.ok(runCalls >= 3, 'the finalizer must schedule a fresh drain and its empty follow-up claim');
  await controller.close();
});

test('O1b overview bounds the growing backup registry and reports the visible window honestly', { timeout: 5_000 }, async () => {
  let requestedLimit = null;
  const runtime = {
    async requestOperation() { throw new Error('unused'); },
    async readOperation() { return null; },
    async listRecentOperations() { return []; },
    listBackups(_context, options) {
      requestedLimit = options.limit;
      return Array.from({ length: 101 }, (_, index) => ({
        schemaVersion: 1,
        backupId: `backup.bound.${String(index).padStart(3, '0')}`,
        destinationId: 'backup.local',
        provenance: 'CREATED',
        health: 'VERIFIED',
        manifestSha256: 'a'.repeat(64),
        databaseSha256: 'b'.repeat(64),
        artifactCount: 1,
        byteCount: 1,
        createdAt: NOW,
        registeredAt: NOW,
        lastVerifiedAt: NOW,
        lastRecoveryTestedAt: null,
      }));
    },
    listDestinations(kind) {
      return kind === 'CREATE'
        ? [{ destinationId: 'backup.local', label: 'Local backups' }]
        : [{ destinationId: 'restore.local', label: 'Restored copies' }];
    },
    async runNext() { return null; },
    async close() {},
  };
  const controller = new BackupOperationsController({
    runtime,
    bootstrapSecret,
    clock: () => 0,
    randomSource: (size) => Buffer.alloc(size, 0x62),
  });
  controller.start();
  const cookie = controller.unlock(bootstrapSecret).cookie.split(';', 1)[0];
  const overview = await controller.overview(cookie);
  assert.equal(requestedLimit, 101);
  assert.equal(overview.backups.length, 100);
  assert.deepEqual(overview.backupWindow, { limit: 100, truncated: true });
  await controller.close();
});
