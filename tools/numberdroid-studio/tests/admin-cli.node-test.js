import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { promisify } from 'node:util';
import { access, mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { StudioService } from '../packages/application/src/index.js';
import {
  ContentAddressedArtifactStore,
  JsonProjectStore,
  SqliteArtifactMetadataStore,
  SqliteProjectStore,
  migrateJsonToSqlite,
} from '../packages/persistence/src/index.js';
import { runAdmin } from '../apps/studio-admin/src/main.js';
import { OWNER, OWNER_CONTEXT, PROJECT_ID, createHarness, createProject } from './test-helpers.js';
import { nodeSqliteDatabaseFactory, pngHeader } from './persistence-test-helpers.js';

const execute = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('administration CLI documents non-overwriting migration, backup, bundle, verification, and restore commands', async () => {
  const { stdout, stderr } = await execute(process.execPath, ['apps/studio-admin/src/main.js', '--help'], { cwd: root });
  assert.equal(stderr, '');
  assert.match(stdout, /Stop the Studio writer/);
  assert.match(stdout, /manifest-json/);
  assert.match(stdout, /migrate-json/);
  assert.match(stdout, /integrity/);
  assert.match(stdout, /verify-backup/);
  assert.match(stdout, /restore/);
  assert.match(stdout, /bundle-export/);
  assert.match(stdout, /bundle-verify/);
  assert.match(stdout, /bundle-import/);
});

async function temporaryDirectory(context, prefix) {
  const directory = await mkdtemp(resolve(tmpdir(), prefix));
  context.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

async function createJsonProject(directory, projectId, suffix) {
  let tick = 0;
  const studio = new StudioService({
    store: new JsonProjectStore({ directory }),
    clock: () => new Date(Date.UTC(2026, 7, 21, 14, 0, tick++)).toISOString(),
  });
  await studio.execute({
    schemaVersion: 1,
    commandId: `cmd.${suffix}.create`,
    idempotencyKey: `idem.${suffix}.create`,
    type: 'project.create',
    projectId,
    baseRevision: 0,
    expectedVersion: 0,
    dryRun: false,
    payload: { name: `Migration ${suffix}`, ownerId: OWNER.id },
  }, OWNER_CONTEXT);
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
  return () => {
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
          const output = onRequest(JSON.parse(input));
          queueMicrotask(() => child.stdout.end(`${JSON.stringify(output)}\n`, () => child.emit('close', 0)));
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

test('admin integrity verifies SQLite and every referenced CAS digest/size and returns exit 2 on findings', async (context) => {
  const rootDirectory = await temporaryDirectory(context, 'numberdroid-admin-integrity-');
  const dataDirectory = resolve(rootDirectory, 'data');
  let projectStore = await SqliteProjectStore.open({
    filename: resolve(dataDirectory, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  const { studio } = createHarness(projectStore);
  await createProject(studio);
  const artifactStore = new ContentAddressedArtifactStore({ rootDirectory: resolve(dataDirectory, 'artifacts') });
  const artifactBytes = pngHeader({ width: 96, height: 64, tail: 'admin-integrity' });
  const artifact = await artifactStore.ingest(artifactBytes, {
    mediaType: 'image/png',
  });
  new SqliteArtifactMetadataStore({ workspace: projectStore.workspace }).registerAndReference(artifact, {
    projectId: PROJECT_ID,
    ownerKind: 'source',
    ownerId: 'source.integrity',
    createdRevision: 1,
  });
  const artifactPath = (await artifactStore.verify(artifact.digest)).path;
  projectStore.close();

  const outputs = [];
  assert.equal(await runAdmin(['integrity', dataDirectory], {
    databaseFactory: nodeSqliteDatabaseFactory,
    emit: (value) => outputs.push(value),
  }), 0);
  assert.equal(outputs.at(-1).ok, true);
  assert.deepEqual(outputs.at(-1).artifacts, {
    ok: true,
    referencedCount: 1,
    verifiedCount: 1,
    findings: [],
  });

  projectStore = await SqliteProjectStore.open({
    filename: resolve(dataDirectory, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  projectStore.workspace.database.prepare('UPDATE artifacts SET byte_size = byte_size + 1 WHERE digest = ?').run(artifact.digest);
  projectStore.close();
  assert.equal(await runAdmin(['integrity', dataDirectory], {
    databaseFactory: nodeSqliteDatabaseFactory,
    emit: (value) => outputs.push(value),
  }), 2);
  assert.equal(outputs.at(-1).artifacts.findings[0].code, 'ARTIFACT_SIZE_MISMATCH');

  projectStore = await SqliteProjectStore.open({
    filename: resolve(dataDirectory, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  projectStore.workspace.database.prepare('UPDATE artifacts SET byte_size = byte_size - 1 WHERE digest = ?').run(artifact.digest);
  projectStore.close();
  await writeFile(artifactPath, Buffer.alloc(artifactBytes.length, 1));
  assert.equal(await runAdmin(['integrity', dataDirectory], {
    databaseFactory: nodeSqliteDatabaseFactory,
    emit: (value) => outputs.push(value),
  }), 2);
  assert.equal(outputs.at(-1).artifacts.findings[0].code, 'ARTIFACT_CORRUPT');

  await unlink(artifactPath);
  assert.equal(await runAdmin(['integrity', dataDirectory], {
    databaseFactory: nodeSqliteDatabaseFactory,
    emit: (value) => outputs.push(value),
  }), 2);
  assert.equal(outputs.at(-1).artifacts.findings[0].code, 'ARTIFACT_MISSING');
});

test('admin restore writes and verifies quarantine before any normal workspace open', async (context) => {
  const rootDirectory = await temporaryDirectory(context, 'numberdroid-admin-quarantine-');
  const dataDirectory = resolve(rootDirectory, 'data');
  const backupDirectory = resolve(rootDirectory, 'backup');
  const restoredDirectory = resolve(rootDirectory, 'restored');
  const projectStore = await SqliteProjectStore.open({
    filename: resolve(dataDirectory, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  await createProject(createHarness(projectStore).studio);
  projectStore.close();

  assert.equal(await runAdmin(['backup', dataDirectory, backupDirectory], {
    databaseFactory: nodeSqliteDatabaseFactory,
    emit: () => {},
  }), 0);
  const outputs = [];
  assert.equal(await runAdmin(['restore', backupDirectory, restoredDirectory], {
    databaseFactory: nodeSqliteDatabaseFactory,
    emit: (value) => outputs.push(value),
  }), 0);
  assert.equal(outputs[0].lifecycle, 'QUARANTINED_VERIFIED');
  assert.equal(outputs[0].ok, true);
  const marker = JSON.parse(await readFile(
    resolve(restoredDirectory, '.numberdroid-restored-copy-quarantine.json'),
    'utf8',
  ));
  assert.deepEqual(marker, {
    schemaVersion: 1,
    kind: 'numberdroid-restored-copy-quarantine',
    copyId: outputs[0].copyId,
    backupId: outputs[0].backupId,
    manifestSha256: outputs[0].manifestSha256,
  });
  assert.match(marker.copyId, /^[a-f0-9-]{36}$/);
  assert.match(marker.backupId, /^[a-f0-9-]{36}$/);
  await assert.rejects(
    SqliteProjectStore.open({
      filename: resolve(restoredDirectory, 'studio.sqlite'),
      databaseFactory: nodeSqliteDatabaseFactory,
    }),
    (error) => error.code === 'RESTORED_COPY_QUARANTINED',
  );
  await assert.rejects(
    runAdmin(['integrity', restoredDirectory], { databaseFactory: nodeSqliteDatabaseFactory }),
    (error) => error.code === 'RESTORED_COPY_QUARANTINED',
  );
});

test('admin Windows destination proof fails closed before backup or restore mutation', async (context) => {
  const rootDirectory = await temporaryDirectory(context, 'numberdroid-admin-windows-proof-');
  const dataDirectory = resolve(rootDirectory, 'data');
  const backupDirectory = resolve(rootDirectory, 'backup');
  const rejectedBackupDirectory = resolve(rootDirectory, 'rejected-backup');
  const rejectedRestoreDirectory = resolve(rootDirectory, 'rejected-restore');
  const projectStore = await SqliteProjectStore.open({
    filename: resolve(dataDirectory, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  await createProject(createHarness(projectStore).studio);
  projectStore.close();

  const backupRequests = [];
  await assert.rejects(
    runAdmin(['backup', dataDirectory, rejectedBackupDirectory], {
      databaseFactory: nodeSqliteDatabaseFactory,
      emit: () => {},
      platform: 'win32',
      spawnProcess: injectedWindowsHelper((payload) => {
        backupRequests.push(payload);
        return { code: 'BACKUP_PATH_UNSAFE' };
      }),
    }),
    (error) => error.code === 'BACKUP_PATH_UNSAFE',
  );
  await assert.rejects(access(rejectedBackupDirectory));
  assert.equal(backupRequests[0].path, rootDirectory);

  await runAdmin(['backup', dataDirectory, backupDirectory], {
    databaseFactory: nodeSqliteDatabaseFactory,
    emit: () => {},
  });
  const restoreRequests = [];
  await assert.rejects(
    runAdmin(['restore', backupDirectory, rejectedRestoreDirectory], {
      databaseFactory: nodeSqliteDatabaseFactory,
      emit: () => {},
      platform: 'win32',
      spawnProcess: injectedWindowsHelper((payload) => {
        restoreRequests.push(payload);
        return payload.path === backupDirectory
          ? windowsProof(payload.path)
          : { code: 'BACKUP_PATH_UNSAFE' };
      }),
    }),
    (error) => error.code === 'BACKUP_PATH_UNSAFE',
  );
  await assert.rejects(access(rejectedRestoreDirectory));
  assert.deepEqual(restoreRequests.map(({ path }) => path), [backupDirectory, rootDirectory]);
});

test('admin Windows junction destinations are rejected before mutation', {
  skip: process.platform !== 'win32',
  timeout: 30_000,
}, async (context) => {
  const rootDirectory = await temporaryDirectory(context, 'numberdroid-admin-windows-junction-');
  const dataDirectory = resolve(rootDirectory, 'data');
  const backupDirectory = resolve(rootDirectory, 'safe-backup');
  const targetDirectory = resolve(rootDirectory, 'junction-target');
  const junctionDirectory = resolve(rootDirectory, 'junction');
  await mkdir(targetDirectory, { mode: 0o700 });
  await symlink(targetDirectory, junctionDirectory, 'junction');
  const projectStore = await SqliteProjectStore.open({
    filename: resolve(dataDirectory, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  await createProject(createHarness(projectStore).studio);
  projectStore.close();
  await runAdmin(['backup', dataDirectory, backupDirectory], {
    databaseFactory: nodeSqliteDatabaseFactory,
    emit: () => {},
  });

  for (const [command, source, basename] of [
    ['backup', dataDirectory, 'escaped-backup'],
    ['restore', backupDirectory, 'escaped-restore'],
  ]) {
    await assert.rejects(
      runAdmin([command, source, resolve(junctionDirectory, basename)], {
        databaseFactory: nodeSqliteDatabaseFactory,
        emit: () => {},
      }),
      (error) => error.code === 'BACKUP_PATH_UNSAFE',
    );
    await assert.rejects(access(resolve(targetDirectory, basename)));
  }
});

test('admin migrate-json resumes a matching partial store and rejects foreign destinations without mutation', async (context) => {
  const rootDirectory = await temporaryDirectory(context, 'numberdroid-admin-migrate-');
  const sourceDirectory = resolve(rootDirectory, 'source');
  const destinationDirectory = resolve(rootDirectory, 'partial-destination');
  await createJsonProject(sourceDirectory, 'project.migrate.alpha', 'alpha');
  await createJsonProject(sourceDirectory, 'project.migrate.beta', 'beta');

  let partialStore = await SqliteProjectStore.open({
    filename: resolve(destinationDirectory, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  await assert.rejects(migrateJsonToSqlite({
    sourceDirectory,
    destinationDirectory,
    store: partialStore,
    migrationId: 'admin-resume-1',
    faultInjector(point) {
      if (point === 'after_project_1') throw new Error('simulated hard stop');
    },
  }), /simulated hard stop/);
  partialStore.close();

  const outputs = [];
  assert.equal(await runAdmin([
    'migrate-json', sourceDirectory, destinationDirectory, 'admin-resume-1',
  ], {
    databaseFactory: nodeSqliteDatabaseFactory,
    emit: (value) => outputs.push(value),
  }), 0);
  assert.equal(outputs[0].status, 'VERIFIED');
  assert.deepEqual(outputs[0].projects.map(({ projectId }) => projectId), [
    'project.migrate.alpha',
    'project.migrate.beta',
  ]);
  partialStore = await SqliteProjectStore.open({
    filename: resolve(destinationDirectory, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  assert.equal(partialStore.workspace.database.prepare('SELECT count(*) AS count FROM projects').get().count, 2);
  assert.equal(partialStore.workspace.database.prepare('SELECT status FROM migration_runs').get().status, 'VERIFIED');
  partialStore.close();

  const foreignDirectory = resolve(rootDirectory, 'foreign-store');
  const foreignStore = await SqliteProjectStore.open({
    filename: resolve(foreignDirectory, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  const foreignHarness = createHarness(foreignStore);
  await createProject(foreignHarness.studio);
  foreignStore.close();
  await assert.rejects(runAdmin([
    'migrate-json', sourceDirectory, foreignDirectory, 'admin-resume-1',
  ], {
    databaseFactory: nodeSqliteDatabaseFactory,
    emit: () => {},
  }), (error) => error.code === 'MIGRATION_DESTINATION_IDENTITY_MISMATCH');
  const reopenedForeign = await SqliteProjectStore.open({
    filename: resolve(foreignDirectory, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  assert.equal(reopenedForeign.workspace.database.prepare('SELECT count(*) AS count FROM projects').get().count, 1);
  assert.equal(reopenedForeign.workspace.database.prepare('SELECT count(*) AS count FROM migration_runs').get().count, 0);
  reopenedForeign.close();
});
