import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  ContentAddressedArtifactStore,
  createJsonSourceManifest,
  createWorkspaceBackup,
  migrateJsonToSqlite,
  restoreWorkspaceBackup,
  SqliteProjectStore,
  verifyWorkspaceBackup,
} from '../../../packages/persistence/src/index.js';

const usage = `Numberdroid Studio administration

Stop the Studio writer before running these commands.

  studio-admin manifest-json <json-directory>
  studio-admin migrate-json <json-directory> <new-data-directory> <migration-id>
  studio-admin integrity <data-directory>
  studio-admin backup <data-directory> <new-backup-directory>
  studio-admin verify-backup <backup-directory>
  studio-admin restore <backup-directory> <new-data-directory>
`;

function output(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function assertAbsent(path, label) {
  try {
    await access(path);
    throw new Error(`${label} already exists; Studio administration never overwrites it: ${path}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function withWorkspace(dataDirectory, operation) {
  const directory = resolve(dataDirectory);
  const projectStore = await SqliteProjectStore.open({ filename: resolve(directory, 'studio.sqlite') });
  const artifactStore = new ContentAddressedArtifactStore({ rootDirectory: resolve(directory, 'artifacts') });
  await artifactStore.initialize();
  try {
    return await operation({ directory, projectStore, artifactStore });
  } finally {
    projectStore.close();
  }
}

async function run([command, ...args]) {
  if (!command || ['help', '--help', '-h'].includes(command)) {
    process.stdout.write(usage);
    return;
  }
  if (command === 'manifest-json' && args.length === 1) {
    output(await createJsonSourceManifest(resolve(args[0])));
    return;
  }
  if (command === 'migrate-json' && args.length === 3) {
    const [sourceDirectory, destinationDirectory, migrationId] = args.map((value, index) => (
      index < 2 ? resolve(value) : value
    ));
    await assertAbsent(destinationDirectory, 'Migration destination');
    const projectStore = await SqliteProjectStore.open({ filename: resolve(destinationDirectory, 'studio.sqlite') });
    try {
      output(await migrateJsonToSqlite({
        sourceDirectory, destinationDirectory, store: projectStore, migrationId,
      }));
    } finally {
      projectStore.close();
    }
    return;
  }
  if (command === 'integrity' && args.length === 1) {
    const result = await withWorkspace(args[0], ({ projectStore }) => projectStore.integrityCheck());
    output(result);
    if (!result.ok) process.exitCode = 2;
    return;
  }
  if (command === 'backup' && args.length === 2) {
    const destinationDirectory = resolve(args[1]);
    await assertAbsent(destinationDirectory, 'Backup destination');
    output(await withWorkspace(args[0], ({ projectStore, artifactStore }) => createWorkspaceBackup({
      projectStore, artifactStore, destinationDirectory,
    })));
    return;
  }
  if (command === 'verify-backup' && args.length === 1) {
    output(await verifyWorkspaceBackup(resolve(args[0])));
    return;
  }
  if (command === 'restore' && args.length === 2) {
    const destination = resolve(args[1]);
    await assertAbsent(destination, 'Restore destination');
    output(await restoreWorkspaceBackup({
      backupDirectory: resolve(args[0]),
      databaseDestination: resolve(destination, 'studio.sqlite'),
      artifactDestination: resolve(destination, 'artifacts'),
    }));
    return;
  }
  throw new Error(`Unknown command or arguments.\n\n${usage}`);
}

run(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`${JSON.stringify({
    schemaVersion: 1,
    error: { code: error.code ?? 'ADMIN_ERROR', message: error.message },
  })}\n`);
  process.exitCode = 1;
});
