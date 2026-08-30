import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer as createNodeHttpServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StudioService } from '../packages/application/src/index.js';
import { InMemoryProjectStore } from '../packages/persistence/src/index.js';
import { BackupOperationsController } from '../apps/studio-server/src/backup-operations-controller.js';
import { createStudioHttpServer, startStudioHttpServer } from '../apps/studio-server/src/server.js';

const NOW = '2026-08-30T12:00:00.000Z';
const bootstrapSecret = Buffer.alloc(24, 0x71).toString('base64url');

function queuedOperation(request, index) {
  return {
    schemaVersion: 1,
    operationId: `operation.http.${index}`,
    kind: request.kind,
    status: 'QUEUED',
    phase: 'RESERVED',
    progress: {
      current: 0,
      total: { CREATE: 8, VERIFY: 3, RECOVERY_TEST: 7, RESTORE_AS_COPY: 8 }[request.kind],
    },
    destinationId: request.destinationId ?? null,
    destinationLabel: request.destinationId === 'restore.local' ? 'Restored copies'
      : request.destinationId === 'backup.local' ? 'Local backups' : null,
    backupId: request.backupId ?? `backup.http.${index}`,
    restoredCopyId: request.kind === 'RESTORE_AS_COPY' ? `restored-copy.http.${index}` : null,
    result: null,
    failure: null,
    createdAt: NOW,
    startedAt: null,
    finishedAt: null,
    updatedAt: NOW,
  };
}

function runtimeHarness() {
  const operations = [];
  const requests = [];
  let closed = false;
  return {
    runtime: {
      async requestOperation(request) {
        requests.push(structuredClone(request));
        const operation = queuedOperation(request, operations.length + 1);
        operations.unshift(operation);
        return operation;
      },
      async readOperation({ operationId }) {
        return operations.find((entry) => entry.operationId === operationId) ?? null;
      },
      async listRecentOperations() { return structuredClone(operations); },
      listBackups() {
        return [{
          schemaVersion: 1,
          backupId: 'backup.http.existing',
          destinationId: 'backup.local',
          provenance: 'CREATED',
          health: 'VERIFIED',
          manifestSha256: 'a'.repeat(64),
          databaseSha256: 'b'.repeat(64),
          artifactCount: 2,
          byteCount: 512,
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
      async runNext() { return null; },
      async close() { closed = true; },
    },
    requests,
    get closed() { return closed; },
  };
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return `http://127.0.0.1:${server.address().port}`;
}

async function closeServer(server) {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

test('O1b human HTTP seam unlocks once, redacts metadata, and accepts only four exact operations', { timeout: 10_000 }, async (context) => {
  const harness = runtimeHarness();
  const controller = new BackupOperationsController({
    runtime: harness.runtime,
    bootstrapSecret,
    clock: () => 0,
    randomSource: (size) => Buffer.alloc(size, 0x72),
  });
  controller.start();
  const server = createStudioHttpServer({
    studioService: new StudioService({ store: new InMemoryProjectStore() }),
    backupOperationsController: controller,
  });
  const base = await listen(server);
  context.after(async () => {
    await closeServer(server);
    await controller.close();
  });

  let response = await fetch(`${base}/api/backups`);
  assert.equal(response.status, 401);
  let body = await response.json();
  assert.deepEqual(Object.keys(body.error).sort(), ['code', 'message']);
  assert.equal(body.error.code, 'WORKSPACE_OPERATOR_REQUIRED');
  assert.doesNotMatch(JSON.stringify(body), /backup\.http|backup\.local|databaseSha256|details/);

  const csrf = (await fetch(`${base}/api/ui-session`).then((value) => value.json())).csrfToken;
  response = await fetch(`${base}/api/backups/operator-session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-numberdroid-studio-csrf': csrf },
    body: JSON.stringify({ schemaVersion: 1, bootstrapSecret }),
  });
  assert.equal(response.status, 403);

  const mutationHeaders = {
    'content-type': 'application/json',
    origin: base,
    'sec-fetch-site': 'same-origin',
    'x-numberdroid-studio-csrf': csrf,
  };
  response = await fetch(`${base}/api/backups/operator-session`, {
    method: 'POST',
    headers: mutationHeaders,
    body: JSON.stringify({ schemaVersion: 1, bootstrapSecret, path: '/forbidden' }),
  });
  assert.equal(response.status, 400);
  assert.doesNotMatch(await response.text(), new RegExp(bootstrapSecret));

  const wrongSecret = Buffer.alloc(24, 0x73).toString('base64url');
  response = await fetch(`${base}/api/backups/operator-session`, {
    method: 'POST',
    headers: mutationHeaders,
    body: JSON.stringify({ schemaVersion: 1, bootstrapSecret: wrongSecret }),
  });
  assert.equal(response.status, 403);
  assert.doesNotMatch(await response.text(), new RegExp(wrongSecret));

  response = await fetch(`${base}/api/backups/operator-session`, {
    method: 'POST',
    headers: mutationHeaders,
    body: JSON.stringify({ schemaVersion: 1, bootstrapSecret }),
  });
  assert.equal(response.status, 200);
  body = await response.json();
  assert.deepEqual(body, {
    schemaVersion: 1,
    state: 'READY',
    candidateStatus: 'implemented candidate — not user accepted',
  });
  const setCookie = response.headers.get('set-cookie');
  assert.match(setCookie, /^numberdroid_backup_operator=[A-Za-z0-9_-]{43}; HttpOnly; SameSite=Strict; Path=\/api\/backups$/);
  assert.doesNotMatch(JSON.stringify(body), /numberdroid_backup_operator|[A-Za-z0-9_-]{43}/);
  const cookie = setCookie.split(';', 1)[0];

  response = await fetch(`${base}/api/backups`, { headers: { cookie } });
  assert.equal(response.status, 200);
  body = await response.json();
  assert.equal(body.backups[0].manifestIdentity, 'a'.repeat(64));
  assert.equal(body.backups[0].destinationLabel, 'Local backups');
  assert.doesNotMatch(JSON.stringify(body), /databaseSha256|controlRoot|\/forbidden|details/);

  const operationBodies = [
    { schemaVersion: 1, kind: 'CREATE', destinationId: 'backup.local', idempotencyKey: 'http.create.1' },
    { schemaVersion: 1, kind: 'VERIFY', backupId: 'backup.http.existing', idempotencyKey: 'http.verify.1' },
    { schemaVersion: 1, kind: 'RECOVERY_TEST', backupId: 'backup.http.existing', idempotencyKey: 'http.recovery.1' },
    { schemaVersion: 1, kind: 'RESTORE_AS_COPY', backupId: 'backup.http.existing', destinationId: 'restore.local', idempotencyKey: 'http.restore.1' },
  ];
  for (const request of operationBodies) {
    response = await fetch(`${base}/api/backups/operations`, {
      method: 'POST',
      headers: { ...mutationHeaders, cookie },
      body: JSON.stringify(request),
    });
    assert.equal(response.status, 202);
    body = await response.json();
    assert.equal(body.operation.status, 'QUEUED');
    assert.equal(body.operation.kind, request.kind);
  }
  assert.deepEqual(harness.requests, operationBodies);

  response = await fetch(`${base}/api/backups/operations`, {
    method: 'POST',
    headers: { ...mutationHeaders, cookie },
    body: JSON.stringify({ ...operationBodies[0], delete: true }),
  });
  assert.equal(response.status, 400);
  assert.equal(harness.requests.length, 4);

  response = await fetch(`${base}/api/backups/operations/operation.http.1`, {
    headers: { cookie },
  });
  assert.equal(response.status, 200);
  body = await response.json();
  assert.equal(body.operation.operationId, 'operation.http.1');
  assert.equal(body.candidateStatus, 'implemented candidate — not user accepted');

  response = await fetch(`${base}/api/backups`, {
    headers: { cookie: `${cookie}; ${cookie}`, forwarded: 'for=127.0.0.1' },
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'OPERATIONS_UNAVAILABLE');
});

test('O1b JSON mode ignores operations configuration and registers no backup route', { timeout: 10_000 }, async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'numberdroid-o1b-json-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const running = await startStudioHttpServer({
    dataDirectory: root,
    storeMode: 'json',
    port: 0,
    operationsConfigurationFilename: join(root, 'must-not-be-read.json'),
    operationsBootstrapWriter: async () => { throw new Error('must not be called'); },
  });
  context.after(() => closeServer(running.server));
  const base = `http://127.0.0.1:${running.address.port}`;
  const response = await fetch(`${base}/api/backups`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    schemaVersion: 1,
    error: { code: 'NOT_FOUND' },
  });
});

test('O1b rejected listener startup releases workspace, pairing, and external operations locks', { timeout: 30_000 }, async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'numberdroid-o1b-startup-cleanup-'));
  const dataRoot = join(root, 'live');
  const controlRoot = join(root, 'control');
  const backupRoot = join(root, 'backups');
  const restoreRoot = join(root, 'restored-copies');
  await Promise.all([dataRoot, controlRoot, backupRoot, restoreRoot]
    .map((path) => mkdir(path, { mode: 0o700 })));
  const configurationFilename = join(root, 'operations.json');
  await writeFile(configurationFilename, JSON.stringify({
    schemaVersion: 1,
    controlRoot,
    backupDestinations: [{ destinationId: 'backup.local', label: 'Local backups', root: backupRoot }],
    restoreDestinations: [{ destinationId: 'restore.local', label: 'Restored copies', root: restoreRoot }],
  }), { mode: 0o600 });
  const blocker = createNodeHttpServer((_request, response) => response.end());
  await listen(blocker);
  let running = null;
  context.after(async () => {
    if (blocker.listening) await closeServer(blocker);
    if (running !== null) await closeServer(running.server);
    await rm(root, { recursive: true, force: true });
  });

  await assert.rejects(startStudioHttpServer({
    dataDirectory: dataRoot,
    port: blocker.address().port,
    operationsConfigurationFilename: configurationFilename,
    operationsBootstrapSecret: bootstrapSecret,
  }), (error) => error.code === 'EADDRINUSE');
  await closeServer(blocker);

  running = await startStudioHttpServer({
    dataDirectory: dataRoot,
    port: 0,
    operationsConfigurationFilename: configurationFilename,
    operationsBootstrapSecret: bootstrapSecret,
  });
  const response = await fetch(`http://127.0.0.1:${running.address.port}/api/backups`);
  assert.equal(response.status, 401);
});

async function unlockRunningServer(running, secret) {
  const base = `http://127.0.0.1:${running.address.port}`;
  const csrf = (await fetch(`${base}/api/ui-session`).then((response) => response.json())).csrfToken;
  const response = await fetch(`${base}/api/backups/operator-session`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: base,
      'sec-fetch-site': 'same-origin',
      'x-numberdroid-studio-csrf': csrf,
    },
    body: JSON.stringify({ schemaVersion: 1, bootstrapSecret: secret }),
  });
  assert.equal(response.status, 200);
  return { base, csrf, cookie: response.headers.get('set-cookie').split(';', 1)[0] };
}

async function waitForTerminalOperation(base, cookie, operationId) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const response = await fetch(`${base}/api/backups/operations/${operationId}`, {
      headers: { cookie },
    });
    assert.equal(response.status, 200);
    const operation = (await response.json()).operation;
    if (['SUCCEEDED', 'FAILED', 'INTERRUPTED'].includes(operation.status)) return operation;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Operation ${operationId} did not become terminal.`);
}

test('O1b configured SQLite HTTP composition completes all four actions and reloads external-ledger state', { timeout: 30_000 }, async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'numberdroid-o1b-live-http-'));
  const dataRoot = join(root, 'live');
  const controlRoot = join(root, 'control');
  const backupRoot = join(root, 'backups');
  const restoreRoot = join(root, 'restored-copies');
  await Promise.all([dataRoot, controlRoot, backupRoot, restoreRoot]
    .map((path) => mkdir(path, { mode: 0o700 })));
  const configurationFilename = join(root, 'operations.json');
  await writeFile(configurationFilename, JSON.stringify({
    schemaVersion: 1,
    controlRoot,
    backupDestinations: [{
      destinationId: 'backup.local',
      label: 'Local backups',
      root: backupRoot,
    }],
    restoreDestinations: [{
      destinationId: 'restore.local',
      label: 'Restored copies',
      root: restoreRoot,
    }],
  }), { mode: 0o600 });
  let running = null;
  context.after(async () => {
    if (running !== null) await closeServer(running.server);
    await rm(root, { recursive: true, force: true });
  });

  running = await startStudioHttpServer({
    dataDirectory: dataRoot,
    port: 0,
    operationsConfigurationFilename: configurationFilename,
    operationsBootstrapSecret: bootstrapSecret,
  });
  let session = await unlockRunningServer(running, bootstrapSecret);
  await fetch(`${session.base}/api/demo`, {
    method: 'POST',
    headers: {
      origin: session.base,
      'sec-fetch-site': 'same-origin',
      'x-numberdroid-studio-csrf': session.csrf,
    },
  }).then((response) => assert.equal(response.status, 200));

  const requests = [
    { schemaVersion: 1, kind: 'CREATE', destinationId: 'backup.local', idempotencyKey: 'sqlite.http.create' },
  ];
  const accepted = [];
  const send = async (request) => {
    const response = await fetch(`${session.base}/api/backups/operations`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: session.base,
        'sec-fetch-site': 'same-origin',
        'x-numberdroid-studio-csrf': session.csrf,
        cookie: session.cookie,
      },
      body: JSON.stringify(request),
    });
    assert.equal(response.status, 202);
    const operation = (await response.json()).operation;
    accepted.push(operation);
    const terminal = await waitForTerminalOperation(session.base, session.cookie, operation.operationId);
    assert.equal(terminal.status, 'SUCCEEDED', `${request.kind} must complete through the real pump`);
    return terminal;
  };
  const created = await send(requests[0]);
  const backupId = created.backupId;
  const replayResponse = await fetch(`${session.base}/api/backups/operations`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: session.base,
      'sec-fetch-site': 'same-origin',
      'x-numberdroid-studio-csrf': session.csrf,
      cookie: session.cookie,
    },
    body: JSON.stringify(requests[0]),
  });
  assert.equal(replayResponse.status, 202);
  const replayedCreate = (await replayResponse.json()).operation;
  assert.equal(replayedCreate.operationId, created.operationId);
  assert.equal(replayedCreate.status, 'SUCCEEDED');
  requests.push(
    { schemaVersion: 1, kind: 'VERIFY', backupId, idempotencyKey: 'sqlite.http.verify' },
    { schemaVersion: 1, kind: 'RECOVERY_TEST', backupId, idempotencyKey: 'sqlite.http.recovery' },
    { schemaVersion: 1, kind: 'RESTORE_AS_COPY', backupId, destinationId: 'restore.local', idempotencyKey: 'sqlite.http.restore' },
  );
  for (const request of requests.slice(1)) await send(request);

  let overviewResponse = await fetch(`${session.base}/api/backups`, {
    headers: { cookie: session.cookie },
  });
  assert.equal(overviewResponse.status, 200);
  let overview = await overviewResponse.json();
  assert.equal(overview.backups.length, 1);
  assert.equal(overview.operations.length, 4);
  assert.equal(overview.backups[0].lastRecoveryTestedAt !== null, true);
  assert.equal(overview.operations[0].kind, 'RESTORE_AS_COPY');
  assert.equal(overview.operations[0].result.restoredCopyLifecycle, 'QUARANTINED_VERIFIED');
  assert.doesNotMatch(JSON.stringify(overview), new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.deepEqual((await readdir(restoreRoot)).filter((name) => name.startsWith('workspace-copy-')).length, 1);

  await closeServer(running.server);
  running = null;
  const secondSecret = Buffer.alloc(24, 0x74).toString('base64url');
  running = await startStudioHttpServer({
    dataDirectory: dataRoot,
    port: 0,
    operationsConfigurationFilename: configurationFilename,
    operationsBootstrapSecret: secondSecret,
  });
  session = await unlockRunningServer(running, secondSecret);
  overviewResponse = await fetch(`${session.base}/api/backups`, { headers: { cookie: session.cookie } });
  assert.equal(overviewResponse.status, 200);
  overview = await overviewResponse.json();
  assert.equal(overview.backups[0].backupId, backupId);
  assert.deepEqual(overview.operations.map(({ operationId }) => operationId),
    accepted.map(({ operationId }) => operationId).reverse());
});
