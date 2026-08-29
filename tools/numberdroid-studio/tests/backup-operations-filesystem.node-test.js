import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { access, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import {
  verifyRestoredWorkspaceCopy,
  verifyWorkspaceBackup,
} from '../packages/persistence/src/backup/workspace-backup.js';
import { OperationsFilesystem, QUARANTINE_MARKER } from '../packages/persistence/src/operations/safe-filesystem.js';
import { validateOperationsConfiguration } from '../packages/persistence/src/operations/operations-config.js';
import {
  inspectWindowsFilesystem,
  publishWindowsFilesystem,
} from '../packages/persistence/src/operations/windows-filesystem-proof.js';
import { afterTestCleanup } from './persistence-test-helpers.js';

async function fixture(context, platform = 'linux') {
  const parent = await mkdtemp(join(tmpdir(), 'numberdroid-operations-fs-'));
  afterTestCleanup(context, () => rm(parent, { recursive: true, force: true }));
  const roots = Object.fromEntries(['live', 'control', 'backup', 'restore'].map((name) => [name, join(parent, name)]));
  await Promise.all(Object.values(roots).map((root) => mkdir(root, { mode: 0o700 })));
  const configuration = await validateOperationsConfiguration({
    schemaVersion: 1,
    controlRoot: roots.control,
    backupDestinations: [{ destinationId: 'backup.primary', label: 'Protected disk', root: roots.backup }],
    restoreDestinations: [{ destinationId: 'restore.review', label: 'Review copies', root: roots.restore }],
  }, { liveWorkspaceRoot: roots.live, platform });
  return { parent, roots, configuration };
}

function windowsProof(path) {
  return {
    code: 'OK',
    filesystem: 'NTFS',
    caseSensitive: false,
    volumeSerial: '0123456789ABCDEF',
    fileId: createHash('sha256').update(path).digest('hex').slice(0, 32).toUpperCase(),
    reparseTag: null,
  };
}

function injectedWindowsHelper(onRequest) {
  return (_command, _args, _options) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => {};
    let input = '';
    child.stdin = new Writable({
      write(chunk, _encoding, callback) {
        input += chunk.toString('utf8');
        callback();
      },
      final(callback) {
        try {
          const payload = JSON.parse(input);
          const output = onRequest(payload);
          queueMicrotask(() => {
            child.stdout.end(`${JSON.stringify(output)}\n`, () => child.emit('close', 0));
          });
          callback();
        } catch (error) {
          callback(error);
          queueMicrotask(() => child.emit('error', error));
        }
      },
    });
    return child;
  };
}

test('operations configuration rejects overlapping and linked roots before mutation', async (context) => {
  const { roots } = await fixture(context);
  await assert.rejects(
    validateOperationsConfiguration({
      schemaVersion: 1,
      controlRoot: roots.control,
      backupDestinations: [{ destinationId: 'backup.primary', label: 'Protected disk', root: roots.backup }],
      restoreDestinations: [{ destinationId: 'restore.review', label: 'Review copies', root: join(roots.backup, 'nested') }],
    }, { liveWorkspaceRoot: roots.live, platform: 'linux' }),
    (error) => error.code === 'BACKUP_PATH_UNSAFE',
  );

  if (process.platform !== 'win32') {
    const linked = join(roots.control, '..', 'linked-backup');
    await symlink(roots.backup, linked, 'dir');
    await assert.rejects(
      validateOperationsConfiguration({
        schemaVersion: 1,
        controlRoot: roots.control,
        backupDestinations: [{ destinationId: 'backup.primary', label: 'Protected disk', root: linked }],
        restoreDestinations: [{ destinationId: 'restore.review', label: 'Review copies', root: roots.restore }],
      }, { liveWorkspaceRoot: roots.live, platform: 'linux' }),
      (error) => error.code === 'BACKUP_PATH_UNSAFE',
    );
  }
});

test('Windows proof receives original root coordinates including the live workspace', async (context) => {
  const { roots } = await fixture(context);
  const linkedBackup = join(roots.backup, '..', 'linked-backup-root');
  await symlink(roots.backup, linkedBackup, process.platform === 'win32' ? 'junction' : 'dir');
  const configuration = await validateOperationsConfiguration({
    schemaVersion: 1,
    controlRoot: roots.control,
    backupDestinations: [{ destinationId: 'backup.primary', label: 'Protected disk', root: linkedBackup }],
    restoreDestinations: [{ destinationId: 'restore.review', label: 'Review copies', root: roots.restore }],
  }, { liveWorkspaceRoot: roots.live, platform: 'win32' });
  assert.equal(configuration.workspaceInspectionPath, roots.live);
  assert.equal(configuration.backupDestinations[0].inspectionPath, linkedBackup);

  const requests = [];
  const spawnProcess = injectedWindowsHelper((payload) => {
    requests.push(payload);
    return payload.path === linkedBackup ? { code: 'BACKUP_PATH_UNSAFE' } : windowsProof(payload.path);
  });
  await assert.rejects(
    OperationsFilesystem.create({ configuration, platform: 'win32', spawnProcess }),
    (error) => error.code === 'BACKUP_PATH_UNSAFE',
  );
  assert.equal(requests[0].path, roots.live);
  assert.equal(requests.some((request) => request.path === linkedBackup), true);
  await assert.rejects(access(join(roots.control, 'recovery-tests')));
});

test('Linux operation filesystem durably publishes once and never overwrites a final', async (context) => {
  const { configuration } = await fixture(context);
  const filesystem = await OperationsFilesystem.create({ configuration, platform: 'linux' });
  const operationId = '11111111-1111-4111-8111-111111111111';
  const backupId = '22222222-2222-4222-8222-222222222222';
  const allocated = await filesystem.allocatePublished({
    kind: 'CREATE', destinationId: 'backup.primary', operationId, outputId: backupId,
  });
  await mkdir(join(allocated.stagePath, 'nested'), { recursive: true, mode: 0o700 });
  await writeFile(join(allocated.stagePath, 'nested', 'evidence.bin'), 'verified bytes', { mode: 0o600 });
  const stageIdentity = await filesystem.inspectOperationDirectory(allocated.stagePath);
  assert.deepEqual(await filesystem.revalidateOperationStage(allocated, stageIdentity), stageIdentity);
  await assert.rejects(
    filesystem.revalidateOperationStage(allocated, { ...stageIdentity, inode: `${stageIdentity.inode}-swapped` }),
    (error) => error.code === 'BACKUP_PATH_UNSAFE',
  );
  const published = await filesystem.publish(allocated);
  assert.match(published.rootKey, /^[a-f0-9]{64}$/);
  assert.equal(await readFile(join(allocated.finalPath, 'nested', 'evidence.bin'), 'utf8'), 'verified bytes');
  await assert.rejects(access(allocated.stagePath));
  await assert.rejects(
    filesystem.allocatePublished({
      kind: 'CREATE', destinationId: 'backup.primary', operationId, outputId: backupId,
    }),
    (error) => error.code === 'BACKUP_DESTINATION_CONFLICT',
  );
});

test('publish fence after durable staging leaves the exact stage unpublished', async (context) => {
  const { configuration } = await fixture(context);
  const filesystem = await OperationsFilesystem.create({ configuration, platform: 'linux' });
  const allocated = await filesystem.allocatePublished({
    kind: 'CREATE',
    destinationId: 'backup.primary',
    operationId: '12121212-1212-4212-8212-121212121212',
    outputId: '34343434-3434-4434-8434-343434343434',
  });
  await mkdir(allocated.stagePath, { mode: 0o700 });
  await writeFile(join(allocated.stagePath, 'evidence.bin'), 'durable but fenced', { mode: 0o600 });
  const controller = new AbortController();
  const fenceError = new Error('injected publish fence');
  const durableStage = filesystem.durableStage.bind(filesystem);
  filesystem.durableStage = async (...args) => {
    await durableStage(...args);
    controller.abort(fenceError);
  };

  await assert.rejects(
    filesystem.publish(allocated, { signal: controller.signal }),
    (error) => error === fenceError,
  );
  assert.equal(
    await readFile(join(allocated.stagePath, 'evidence.bin'), 'utf8'),
    'durable but fenced',
  );
  await assert.rejects(access(allocated.finalPath), (error) => error.code === 'ENOENT');
});

test('Windows publish helper is fenced and fully settles before rejection', async () => {
  let child;
  let killed = false;
  const spawnProcess = () => {
    child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => { killed = true; };
    child.stdin = new Writable({
      write(_chunk, _encoding, callback) { callback(); },
    });
    return child;
  };
  const controller = new AbortController();
  const fenceError = new Error('injected Windows publish fence');
  let settled = false;
  const publication = publishWindowsFilesystem({
    rootPath: 'C:\\backup',
    stagePath: 'C:\\backup\\stage',
    finalPath: 'C:\\backup\\final',
    expectedRootVolumeSerial: '0'.repeat(16),
    expectedRootFileId: '1'.repeat(32),
    expectedStageVolumeSerial: '0'.repeat(16),
    expectedStageFileId: '2'.repeat(32),
  }, { spawnProcess, signal: controller.signal });
  publication.then(
    () => { settled = true; },
    () => { settled = true; },
  );
  controller.abort(fenceError);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(killed, true);
  assert.equal(settled, false, 'helper rejection must wait for child settlement');
  child.emit('close', 1);
  await assert.rejects(publication, (error) => error === fenceError);
  assert.equal(settled, true);
});

test('Windows inspect fence remains pending when kill throws until child settlement', async () => {
  let child;
  let killCalls = 0;
  const spawnProcess = () => {
    child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => {
      killCalls += 1;
      throw new Error('injected kill failure');
    };
    child.stdin = new Writable({
      write(_chunk, _encoding, callback) { callback(); },
    });
    return child;
  };
  const controller = new AbortController();
  const fenceError = new Error('injected Windows inspect fence');
  let settled = false;
  const inspection = inspectWindowsFilesystem('C:\\backup', {
    inspectDescendants: true,
    spawnProcess,
    signal: controller.signal,
  });
  inspection.then(
    () => { settled = true; },
    () => { settled = true; },
  );
  controller.abort(fenceError);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(killCalls, 1);
  assert.equal(settled, false, 'kill failure must not release resources before child settlement');
  child.emit('close', 1);
  await assert.rejects(inspection, (error) => error === fenceError);
  assert.equal(settled, true);
});

test('Windows inspect fence ignores a post-spawn kill error until child settlement', async () => {
  let child;
  const spawnProcess = () => {
    child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => { child.emit('error', new Error('injected asynchronous kill failure')); };
    child.stdin = new Writable({
      write(_chunk, _encoding, callback) { callback(); },
    });
    return child;
  };
  const controller = new AbortController();
  const fenceError = new Error('injected Windows inspect fence');
  let settled = false;
  const inspection = inspectWindowsFilesystem('C:\\backup', {
    inspectDescendants: true,
    spawnProcess,
    signal: controller.signal,
  });
  inspection.then(
    () => { settled = true; },
    () => { settled = true; },
  );
  child.emit('spawn');
  controller.abort(fenceError);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(settled, false, 'kill error must not release resources before child settlement');
  child.emit('close', 1);
  await assert.rejects(inspection, (error) => error === fenceError);
  assert.equal(settled, true);
});

test('recovery cleanup is identity-bound and marker is durable before any open', async (context) => {
  const { configuration } = await fixture(context);
  const filesystem = await OperationsFilesystem.create({ configuration, platform: 'linux' });
  const operationId = '33333333-3333-4333-8333-333333333333';
  const copyId = '44444444-4444-4444-8444-444444444444';
  const backupId = '55555555-5555-4555-8555-555555555555';
  const coordinate = await filesystem.recoveryTestCoordinate({ operationId });
  await mkdir(coordinate.path, { mode: 0o700 });
  const marker = await filesystem.writeQuarantineMarker(coordinate.path, {
    copyId,
    backupId,
    manifestSha256: 'a'.repeat(64),
  });
  assert.equal(marker.copyId, copyId);
  assert.equal(JSON.parse(await readFile(join(coordinate.path, QUARANTINE_MARKER), 'utf8')).backupId, backupId);
  const identity = await filesystem.inspectOperationDirectory(coordinate.path);
  assert.deepEqual(await filesystem.revalidateOperationStage(coordinate, identity), identity);
  await assert.rejects(
    filesystem.cleanupRecoveryTest(coordinate, { ...identity, inode: `${identity.inode}-swapped` }),
    (error) => error.code === 'BACKUP_PATH_UNSAFE',
  );
  await filesystem.cleanupRecoveryTest(coordinate, identity);
  await assert.rejects(access(coordinate.path));
});

test('recovery-test root identity is pinned for allocate, resolve, and cleanup', async (context) => {
  const scenarios = ['allocate', 'resolve', 'cleanup'];
  for (const [index, scenario] of scenarios.entries()) {
    const { configuration } = await fixture(context);
    const filesystem = await OperationsFilesystem.create({ configuration, platform: 'linux' });
    const operationId = `8888888${index}-8888-4888-8888-888888888888`;
    let coordinateValue = null;
    let identity = null;
    if (scenario !== 'allocate') {
      coordinateValue = await filesystem.recoveryTestCoordinate({ operationId });
      await mkdir(coordinateValue.path, { mode: 0o700 });
      identity = await filesystem.inspectOperationDirectory(coordinateValue.path);
    }

    const recoveryRoot = filesystem.controlPaths().recoveryTests;
    await rename(recoveryRoot, `${recoveryRoot}-retired`);
    await mkdir(recoveryRoot, { mode: 0o700 });

    const action = scenario === 'allocate'
      ? () => filesystem.recoveryTestCoordinate({ operationId })
      : scenario === 'resolve'
        ? () => filesystem.resolveRecoveryTest({ operationId })
        : () => filesystem.cleanupRecoveryTest(coordinateValue, identity);
    await assert.rejects(action, (error) => error.code === 'BACKUP_PATH_UNSAFE');
  }
});

test('injected Windows descendant proof fails closed before sync', async (context) => {
  const { configuration } = await fixture(context);
  const requests = [];
  let rejectDescendants = false;
  let driftIdentity = false;
  const spawnProcess = injectedWindowsHelper((payload) => {
    requests.push(payload);
    if (rejectDescendants && payload.inspectDescendants === true) return { code: 'BACKUP_PATH_UNSAFE' };
    const proof = windowsProof(payload.path);
    return driftIdentity && payload.expectedFileId
      ? { ...proof, fileId: 'F'.repeat(32) }
      : proof;
  });
  const filesystem = await OperationsFilesystem.create({ configuration, platform: 'win32', spawnProcess });
  const allocated = await filesystem.allocatePublished({
    kind: 'CREATE',
    destinationId: 'backup.primary',
    operationId: '99999999-9999-4999-8999-999999999999',
    outputId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  });
  await mkdir(allocated.stagePath, { mode: 0o700 });
  await writeFile(join(allocated.stagePath, 'evidence.bin'), 'untrusted descendant', { mode: 0o600 });

  const stageIdentity = await filesystem.inspectOperationDirectory(allocated.stagePath);
  assert.deepEqual(await filesystem.revalidateOperationStage(allocated, stageIdentity), stageIdentity);
  driftIdentity = true;
  await assert.rejects(
    filesystem.revalidateOperationStage(allocated, stageIdentity),
    (error) => error.code === 'BACKUP_PATH_UNSAFE',
  );
  driftIdentity = false;

  rejectDescendants = true;
  await assert.rejects(
    filesystem.durableStage(allocated.stagePath),
    (error) => error.code === 'BACKUP_PATH_UNSAFE',
  );
  assert.equal(requests.at(-1).inspectDescendants, true);
  assert.deepEqual(Object.keys(requests.at(-1)).sort(), ['inspectDescendants', 'path']);
});

test('injected Windows descendant proof blocks direct backup and restored-copy verification', async (context) => {
  const { roots } = await fixture(context);
  const requests = [];
  const spawnProcess = injectedWindowsHelper((payload) => {
    requests.push(payload);
    return { code: 'BACKUP_PATH_UNSAFE' };
  });

  await assert.rejects(
    verifyWorkspaceBackup(roots.backup, { platform: 'win32', spawnProcess }),
    (error) => error.code === 'BACKUP_PATH_UNSAFE',
  );

  let databaseOpened = false;
  await assert.rejects(
    verifyRestoredWorkspaceCopy({
      copyDirectory: roots.restore,
      expectedManifest: {
        schemaVersion: 1,
        createdAt: '2026-08-29T00:00:00.000Z',
        database: { filename: 'studio.sqlite', sha256: '0'.repeat(64) },
        artifacts: { schemaVersion: 1, algorithm: 'sha256', entries: [] },
        integrity: { ok: true },
      },
      expectedManifestSha256: '1'.repeat(64),
      expectedBackupId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      expectedCopyId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      purpose: 'VERIFY',
      databaseFactory: () => {
        databaseOpened = true;
        throw new Error('must not open');
      },
    }, { platform: 'win32', spawnProcess }),
    (error) => error.code === 'BACKUP_PATH_UNSAFE',
  );

  assert.equal(databaseOpened, false);
  assert.equal(requests.length, 2);
  for (const request of requests) {
    assert.equal(request.inspectDescendants, true);
    assert.deepEqual(Object.keys(request).sort(), ['inspectDescendants', 'path']);
  }
});

test('Windows helpers prove NTFS identities and publish with write-through no-overwrite semantics', {
  skip: process.platform !== 'win32',
  timeout: 30_000,
}, async (context) => {
  const { configuration } = await fixture(context, 'win32');
  const filesystem = await OperationsFilesystem.create({ configuration, platform: 'win32' });
  const allocated = await filesystem.allocatePublished({
    kind: 'CREATE',
    destinationId: 'backup.primary',
    operationId: '66666666-6666-4666-8666-666666666666',
    outputId: '77777777-7777-4777-8777-777777777777',
  });
  await mkdir(allocated.stagePath, { mode: 0o700 });
  await writeFile(join(allocated.stagePath, 'evidence.bin'), 'windows proof', { mode: 0o600 });
  await filesystem.publish(allocated);
  assert.equal(await readFile(join(allocated.finalPath, 'evidence.bin'), 'utf8'), 'windows proof');
  await assert.rejects(
    filesystem.allocatePublished({
      kind: 'CREATE',
      destinationId: 'backup.primary',
      operationId: '66666666-6666-4666-8666-666666666666',
      outputId: '77777777-7777-4777-8777-777777777777',
    }),
    (error) => error.code === 'BACKUP_DESTINATION_CONFLICT',
  );
});

test('Windows original configured junction is rejected before control-root mutation', {
  skip: process.platform !== 'win32',
  timeout: 30_000,
}, async (context) => {
  const { roots } = await fixture(context, 'win32');
  const linkedBackup = join(roots.backup, '..', 'configured-backup-junction');
  await symlink(roots.backup, linkedBackup, 'junction');
  const configuration = await validateOperationsConfiguration({
    schemaVersion: 1,
    controlRoot: roots.control,
    backupDestinations: [{ destinationId: 'backup.primary', label: 'Protected disk', root: linkedBackup }],
    restoreDestinations: [{ destinationId: 'restore.review', label: 'Review copies', root: roots.restore }],
  }, { liveWorkspaceRoot: roots.live, platform: 'win32' });
  await assert.rejects(
    OperationsFilesystem.create({ configuration, platform: 'win32' }),
    (error) => error.code === 'BACKUP_PATH_UNSAFE',
  );
  await assert.rejects(access(join(roots.control, 'recovery-tests')));
});

test('Windows descendant scan rejects junctions before sync', {
  skip: process.platform !== 'win32',
  timeout: 30_000,
}, async (context) => {
  const { parent, configuration } = await fixture(context, 'win32');
  const filesystem = await OperationsFilesystem.create({ configuration, platform: 'win32' });
  const allocated = await filesystem.allocatePublished({
    kind: 'CREATE',
    destinationId: 'backup.primary',
    operationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    outputId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  });
  await mkdir(allocated.stagePath, { mode: 0o700 });
  const junctionTarget = join(parent, 'junction-target');
  await mkdir(junctionTarget, { mode: 0o700 });
  await symlink(junctionTarget, join(allocated.stagePath, 'injected-junction'), 'junction');
  await assert.rejects(
    verifyWorkspaceBackup(allocated.stagePath, { platform: 'win32' }),
    (error) => error.code === 'BACKUP_PATH_UNSAFE',
  );
  await assert.rejects(
    filesystem.durableStage(allocated.stagePath),
    (error) => error.code === 'BACKUP_PATH_UNSAFE',
  );
});
