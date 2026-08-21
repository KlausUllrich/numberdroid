import { access, lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { StudioError } from '../../../packages/domain/src/index.js';
import {
  ContentAddressedArtifactStore,
  createJsonSourceManifest,
  createWorkspaceBackup,
  migrateJsonToSqlite,
  restoreWorkspaceBackup,
  SqliteProjectStore,
  SqliteWorkspace,
  verifyWorkspaceIntegrity,
  verifyWorkspaceBackup,
} from '../../../packages/persistence/src/index.js';

const MIGRATION_INTENT_FILE = '.json-migration-intent.json';

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

async function withWorkspace(dataDirectory, operation, { databaseFactory } = {}) {
  const directory = resolve(dataDirectory);
  const projectStore = await SqliteProjectStore.open({
    filename: resolve(directory, 'studio.sqlite'),
    ...(databaseFactory ? { databaseFactory } : {}),
  });
  const artifactStore = new ContentAddressedArtifactStore({ rootDirectory: resolve(directory, 'artifacts') });
  await artifactStore.initialize();
  try {
    return await operation({ directory, projectStore, artifactStore });
  } finally {
    projectStore.close();
  }
}

async function prepareMigrationDestination({ sourceDirectory, destinationDirectory, migrationId, databaseFactory }) {
  const manifest = await createJsonSourceManifest(sourceDirectory);
  const intent = {
    schemaVersion: 1,
    kind: 'numberdroid-studio-json-migration',
    migrationId,
    sourceManifestHash: manifest.manifestHash,
  };
  let destinationExists = true;
  try {
    const info = await lstat(destinationDirectory);
    if (!info.isDirectory()) {
      throw new StudioError('MIGRATION_DESTINATION_INVALID', 'Migration destination exists but is not a directory.');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    destinationExists = false;
  }

  if (!destinationExists) {
    await mkdir(destinationDirectory, { recursive: false, mode: 0o700 });
    await writeFile(resolve(destinationDirectory, MIGRATION_INTENT_FILE), `${JSON.stringify(intent, null, 2)}\n`, {
      flag: 'wx',
      mode: 0o600,
    });
    return intent;
  }

  const intentPath = resolve(destinationDirectory, MIGRATION_INTENT_FILE);
  try {
    const existingIntent = JSON.parse(await readFile(intentPath, 'utf8'));
    if (existingIntent.kind !== intent.kind || existingIntent.migrationId !== migrationId
      || existingIntent.sourceManifestHash !== manifest.manifestHash) {
      throw new StudioError(
        'MIGRATION_DESTINATION_IDENTITY_MISMATCH',
        'Existing migration destination belongs to another migration or source manifest.',
      );
    }
    return existingIntent;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const databasePath = resolve(destinationDirectory, 'studio.sqlite');
  try {
    await access(databasePath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new StudioError(
        'MIGRATION_DESTINATION_IDENTITY_MISMATCH',
        'Existing destination has neither a migration intent nor a resumable SQLite migration run.',
      );
    }
    throw error;
  }
  const reader = await SqliteWorkspace.open({
    filename: databasePath,
    mode: 'reader',
    ...(databaseFactory ? { databaseFactory } : {}),
  });
  try {
    const hasRuns = reader.database.prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'migration_runs'",
    ).get();
    const run = hasRuns
      ? reader.database.prepare('SELECT migration_id, source_manifest_hash FROM migration_runs WHERE migration_id = ?').get(migrationId)
      : null;
    if (!run || run.source_manifest_hash !== manifest.manifestHash) {
      throw new StudioError(
        'MIGRATION_DESTINATION_IDENTITY_MISMATCH',
        'Existing destination has no matching resumable migration run.',
      );
    }
  } finally {
    reader.close();
  }
  await writeFile(intentPath, `${JSON.stringify(intent, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  return intent;
}

export async function runAdmin([command, ...args], { databaseFactory, emit = output } = {}) {
  if (!command || ['help', '--help', '-h'].includes(command)) {
    process.stdout.write(usage);
    return 0;
  }
  if (command === 'manifest-json' && args.length === 1) {
    emit(await createJsonSourceManifest(resolve(args[0])));
    return 0;
  }
  if (command === 'migrate-json' && args.length === 3) {
    const [sourceDirectory, destinationDirectory, migrationId] = args.map((value, index) => (
      index < 2 ? resolve(value) : value
    ));
    await prepareMigrationDestination({ sourceDirectory, destinationDirectory, migrationId, databaseFactory });
    const projectStore = await SqliteProjectStore.open({
      filename: resolve(destinationDirectory, 'studio.sqlite'),
      ...(databaseFactory ? { databaseFactory } : {}),
    });
    try {
      emit(await migrateJsonToSqlite({
        sourceDirectory, destinationDirectory, store: projectStore, migrationId,
      }));
    } finally {
      projectStore.close();
    }
    return 0;
  }
  if (command === 'integrity' && args.length === 1) {
    const result = await withWorkspace(
      args[0],
      ({ projectStore, artifactStore }) => verifyWorkspaceIntegrity({ projectStore, artifactStore }),
      { databaseFactory },
    );
    emit(result);
    return result.ok ? 0 : 2;
  }
  if (command === 'backup' && args.length === 2) {
    const destinationDirectory = resolve(args[1]);
    await assertAbsent(destinationDirectory, 'Backup destination');
    emit(await withWorkspace(args[0], ({ projectStore, artifactStore }) => createWorkspaceBackup({
      projectStore, artifactStore, destinationDirectory,
    }), { databaseFactory }));
    return 0;
  }
  if (command === 'verify-backup' && args.length === 1) {
    emit(await verifyWorkspaceBackup(resolve(args[0])));
    return 0;
  }
  if (command === 'restore' && args.length === 2) {
    const destination = resolve(args[1]);
    await assertAbsent(destination, 'Restore destination');
    emit(await restoreWorkspaceBackup({
      backupDirectory: resolve(args[0]),
      databaseDestination: resolve(destination, 'studio.sqlite'),
      artifactDestination: resolve(destination, 'artifacts'),
    }));
    return 0;
  }
  throw new Error(`Unknown command or arguments.\n\n${usage}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runAdmin(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  }).catch((error) => {
    process.stderr.write(`${JSON.stringify({
      schemaVersion: 1,
      error: { code: error.code ?? 'ADMIN_ERROR', message: error.message },
    })}\n`);
    process.exitCode = 1;
  });
}
