import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteWorkspace } from '../packages/persistence/src/sqlite/sqlite-workspace.js';
import {
  WORKSPACE_WRITER_LOCK_SUFFIX,
  WorkspaceWriterLock,
} from '../packages/persistence/src/sqlite/workspace-writer-lock.js';
import { afterTestCleanup, nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';

async function temporaryWorkspace(context, prefix) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  afterTestCleanup(context, () => rm(root, { recursive: true, force: true }));
  const filename = join(root, 'studio.sqlite');
  return { root, filename, lockPath: `${filename}${WORKSPACE_WRITER_LOCK_SUFFIX}` };
}

function waitForLine(child, expected) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => finish(new Error(`child did not emit ${expected}`)), 5_000);
    const finish = (error) => {
      clearTimeout(timeout);
      child.stdout.off('data', onData);
      child.off('error', onError);
      child.off('exit', onExit);
      if (error) reject(error);
      else resolve();
    };
    const onData = (chunk) => {
      output += chunk;
      if (output.split(/\r?\n/u).includes(expected)) finish();
    };
    const onError = (error) => finish(error);
    const onExit = (code, signal) => finish(new Error(`child exited before lock signal (${code ?? signal})`));
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', onData);
    child.once('error', onError);
    child.once('exit', onExit);
  });
}

test('workspace writer lock is a persistent rollback-journal SQLite file with one exclusive owner', { timeout: 10_000 }, async (context) => {
  const { lockPath, filename } = await temporaryWorkspace(context, 'numberdroid-o2a-writer-lock-');
  let firstDatabase;
  const first = await WorkspaceWriterLock.acquire({
    filename,
    databaseFactory(path, options) {
      firstDatabase = nodeSqliteDatabaseFactory(path, options);
      return firstDatabase;
    },
  });
  afterTestCleanup(context, () => first.close());

  assert.equal(first.isHeld, true);
  assert.equal(firstDatabase.prepare('PRAGMA journal_mode').get().journal_mode, 'delete');
  assert.equal(Number(firstDatabase.prepare('PRAGMA synchronous').get().synchronous), 2);
  assert.deepEqual(
    { ...firstDatabase.prepare('SELECT * FROM lock_identity').get() },
    { singleton: 1, schema_version: 1, lock_kind: 'numberdroid-workspace-writer' },
  );
  await assert.rejects(
    WorkspaceWriterLock.acquire({ filename, databaseFactory: nodeSqliteDatabaseFactory }),
    (error) => error.code === 'SQLITE_WRITER_LOCKED',
  );

  firstDatabase.exec('ROLLBACK');
  assert.equal(first.isHeld, false, 'loss of the EXCLUSIVE transaction must immediately revoke writer status');
  const second = await WorkspaceWriterLock.acquire({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  afterTestCleanup(context, () => second.close());
  assert.equal(second.isHeld, true);
  first.close();
  assert.equal(second.isHeld, true, 'closing a former owner must not disturb the current OS-backed owner');
  second.close();

  assert.equal((await readFile(lockPath)).subarray(0, 16).toString('binary'), 'SQLite format 3\0');
  const reopened = await WorkspaceWriterLock.acquire({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  assert.equal(reopened.isHeld, true, 'the persistent file must not retain stale ownership after close');
  reopened.close();
});

test('legacy PID compatibility blocks live or malformed state and migrates only a proven exited owner', { timeout: 10_000 }, async (context) => {
  const { lockPath, filename } = await temporaryWorkspace(context, 'numberdroid-o2a-legacy-lock-');
  const openedAt = '2026-08-30T10:00:00.000Z';
  const liveRecord = JSON.stringify({ pid: process.pid, openedAt });
  await writeFile(lockPath, liveRecord, { flag: 'wx', mode: 0o600 });
  let databaseFactoryCalls = 0;
  const forbiddenFactory = () => {
    databaseFactoryCalls += 1;
    throw new Error('database factory must not run');
  };
  await assert.rejects(
    WorkspaceWriterLock.acquire({ filename, databaseFactory: forbiddenFactory }),
    (error) => error.code === 'SQLITE_WRITER_LOCKED',
  );
  assert.equal(databaseFactoryCalls, 0);
  assert.equal(await readFile(lockPath, 'utf8'), liveRecord);

  await rm(lockPath);
  const malformed = '{"pid":"not-a-pid"}';
  await writeFile(lockPath, malformed, { flag: 'wx', mode: 0o600 });
  await assert.rejects(
    WorkspaceWriterLock.acquire({ filename, databaseFactory: forbiddenFactory }),
    (error) => error.code === 'SQLITE_WRITER_LOCKED',
  );
  assert.equal(databaseFactoryCalls, 0);
  assert.equal(await readFile(lockPath, 'utf8'), malformed, 'ambiguous state must remain untouched');

  await rm(lockPath);
  const exitedProcess = spawn(process.execPath, ['-e', 'process.exit(0)'], { stdio: 'ignore' });
  const exitedPid = exitedProcess.pid;
  await once(exitedProcess, 'exit');
  const exitedRecord = JSON.stringify({ pid: exitedPid, openedAt });
  await writeFile(lockPath, exitedRecord, { flag: 'wx', mode: 0o600 });
  const migrated = await WorkspaceWriterLock.acquire({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  afterTestCleanup(context, () => migrated.close());
  assert.equal(migrated.isHeld, true);
  assert.equal((await readFile(lockPath)).subarray(0, 16).toString('binary'), 'SQLite format 3\0');
  migrated.close();

  const malformedSqlite = nodeSqliteDatabaseFactory(lockPath);
  malformedSqlite.exec(`
    DROP TABLE lock_identity;
    CREATE TABLE lock_identity (
      singleton INTEGER,
      schema_version INTEGER,
      lock_kind TEXT
    );
    INSERT INTO lock_identity VALUES (1, 1, 'numberdroid-workspace-writer');
  `);
  malformedSqlite.close();
  await assert.rejects(
    WorkspaceWriterLock.acquire({ filename, databaseFactory: nodeSqliteDatabaseFactory }),
    (error) => error.code === 'SQLITE_WRITER_LOCKED',
  );
  const unchangedMalformedSqlite = nodeSqliteDatabaseFactory(lockPath, { readonly: true });
  assert.equal(
    unchangedMalformedSqlite.prepare("SELECT sql FROM sqlite_schema WHERE name = 'lock_identity'").get().sql.includes('CHECK'),
    false,
  );
  unchangedMalformedSqlite.close();
});

test('workspace acquires the sidecar before database effects and closes database before lock', { timeout: 10_000 }, async (context) => {
  const { filename, lockPath } = await temporaryWorkspace(context, 'numberdroid-o2a-open-order-');
  const blocker = await WorkspaceWriterLock.acquire({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  afterTestCleanup(context, () => blocker.close());
  const attemptedPaths = [];
  await assert.rejects(
    SqliteWorkspace.open({
      filename,
      databaseFactory(path, options) {
        attemptedPaths.push(path);
        return nodeSqliteDatabaseFactory(path, options);
      },
    }),
    (error) => error.code === 'SQLITE_WRITER_LOCKED',
  );
  assert.deepEqual(attemptedPaths, [lockPath], 'the authoritative database must not open before lock ownership');
  await assert.rejects(access(filename), (error) => error.code === 'ENOENT');
  blocker.close();

  const closeOrder = [];
  const workspace = await SqliteWorkspace.open({
    filename,
    databaseFactory(path, options) {
      const database = nodeSqliteDatabaseFactory(path, options);
      const kind = path === lockPath ? 'lock' : 'workspace';
      return {
        exec: (...args) => database.exec(...args),
        prepare: (...args) => database.prepare(...args),
        close() {
          closeOrder.push(kind);
          database.close();
        },
        get isTransaction() { return database.isTransaction; },
      };
    },
  });
  assert.equal(workspace.isWriter, true);
  workspace.close();
  assert.deepEqual(closeOrder, ['workspace', 'lock']);
});

test('kernel releases a crashed process lock without deleting the persistent sidecar', { timeout: 15_000 }, async (context) => {
  const { filename } = await temporaryWorkspace(context, 'numberdroid-o2a-crash-lock-');
  const lockModuleUrl = new URL('../packages/persistence/src/sqlite/workspace-writer-lock.js', import.meta.url).href;
  const helperModuleUrl = new URL('./persistence-test-helpers.js', import.meta.url).href;
  const childScript = `
    import { WorkspaceWriterLock } from ${JSON.stringify(lockModuleUrl)};
    import { nodeSqliteDatabaseFactory } from ${JSON.stringify(helperModuleUrl)};
    await WorkspaceWriterLock.acquire({
      filename: ${JSON.stringify(filename)},
      databaseFactory: nodeSqliteDatabaseFactory,
    });
    process.stdout.write('LOCKED\\n');
    setInterval(() => {}, 1000);
  `;
  const child = spawn(process.execPath, ['--input-type=module', '-e', childScript], {
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  let exited = false;
  child.once('exit', () => { exited = true; });
  afterTestCleanup(context, async () => {
    if (!exited) {
      const exit = once(child, 'exit');
      child.kill('SIGKILL');
      await exit.catch(() => {});
    }
  });
  await waitForLine(child, 'LOCKED');
  await assert.rejects(
    WorkspaceWriterLock.acquire({ filename, databaseFactory: nodeSqliteDatabaseFactory }),
    (error) => error.code === 'SQLITE_WRITER_LOCKED',
  );

  const exit = once(child, 'exit');
  assert.equal(child.kill('SIGKILL'), true);
  await exit;
  exited = true;
  const recovered = await WorkspaceWriterLock.acquire({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  afterTestCleanup(context, () => recovered.close());
  assert.equal(recovered.isHeld, true);
  recovered.close();
});
