import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { invariant } from '../../../domain/src/errors.js';
import { ContentAddressedArtifactStore } from '../artifacts/content-addressed-artifact-store.js';
import { SqliteArtifactMetadataStore } from '../sqlite/sqlite-artifact-metadata-store.js';
import { SqliteProjectStore } from '../sqlite/sqlite-project-store.js';
import { verifyWorkspaceIntegrity } from '../integrity/workspace-integrity.js';

async function fileHash(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

export async function createWorkspaceBackup({ projectStore, artifactStore, destinationDirectory, clock = () => new Date().toISOString() }) {
  invariant(projectStore instanceof SqliteProjectStore, 'VALIDATION_ERROR', 'SqliteProjectStore is required.');
  invariant(artifactStore instanceof ContentAddressedArtifactStore, 'VALIDATION_ERROR', 'ContentAddressedArtifactStore is required.');
  const sourceIntegrity = await verifyWorkspaceIntegrity({ projectStore, artifactStore });
  invariant(sourceIntegrity.ok, 'BACKUP_SOURCE_INTEGRITY_FAILED', 'Live workspace failed semantic, CAS, or job integrity checks before backup.', {
    findingCount: [sourceIntegrity.artifacts, sourceIntegrity.sourceIntakes, sourceIntegrity.agentAttempts, sourceIntegrity.jobs]
      .reduce((count, section) => count + section.findings.length, 0),
  });
  const destination = resolve(destinationDirectory);
  await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
  await mkdir(destination, { recursive: false, mode: 0o700 });
  const databasePath = join(destination, 'studio.sqlite');
  await projectStore.backupTo(databasePath);
  const snapshotStore = await SqliteProjectStore.open({ filename: databasePath, mode: 'reader' });
  let artifactManifest;
  let snapshotIntegrity;
  try {
    const metadata = new SqliteArtifactMetadataStore({ workspace: snapshotStore.workspace });
    const referencedDigests = metadata.listReferencedDigests();
    const artifactDirectory = join(destination, 'artifacts');
    artifactManifest = await artifactStore.backupTo(artifactDirectory, referencedDigests);
    snapshotIntegrity = await verifyWorkspaceIntegrity({
      projectStore: snapshotStore,
      artifactStore: new ContentAddressedArtifactStore({ rootDirectory: artifactDirectory }),
    });
    invariant(snapshotIntegrity.ok, 'BACKUP_SNAPSHOT_INTEGRITY_FAILED', 'The immutable backup snapshot failed semantic, CAS, or job integrity checks.', {
      findingCount: [snapshotIntegrity.artifacts, snapshotIntegrity.sourceIntakes, snapshotIntegrity.agentAttempts, snapshotIntegrity.jobs]
        .reduce((count, section) => count + section.findings.length, 0),
    });
  } finally {
    snapshotStore.close();
  }
  const manifest = {
    schemaVersion: 1,
    createdAt: clock(),
    database: { filename: 'studio.sqlite', sha256: await fileHash(databasePath) },
    artifacts: artifactManifest,
    integrity: snapshotIntegrity,
  };
  await writeFile(join(destination, 'workspace-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, {
    flag: 'wx',
    mode: 0o600,
  });
  return manifest;
}

export async function verifyWorkspaceBackup(backupDirectory) {
  const source = resolve(backupDirectory);
  const manifest = JSON.parse(await readFile(join(source, 'workspace-manifest.json'), 'utf8'));
  invariant(manifest.schemaVersion === 1, 'BACKUP_SCHEMA_UNSUPPORTED', 'Unsupported backup manifest version.');
  invariant(
    await fileHash(join(source, manifest.database.filename)) === manifest.database.sha256,
    'BACKUP_DATABASE_DIGEST_MISMATCH',
    'Backup database differs from its manifest.',
  );
  const artifacts = new ContentAddressedArtifactStore({ rootDirectory: join(source, 'artifacts') });
  const expectedDigests = manifest.artifacts.entries.map((entry) => entry.digest).sort();
  invariant(
    JSON.stringify(await artifacts.listLiveDigests()) === JSON.stringify(expectedDigests),
    'BACKUP_ARTIFACT_SET_MISMATCH',
    'Backup contains missing or unmanifested CAS objects.',
  );
  const artifactManifest = await artifacts.createManifest(new Set(expectedDigests));
  invariant(
    JSON.stringify(artifactManifest) === JSON.stringify(manifest.artifacts),
    'BACKUP_ARTIFACT_MANIFEST_MISMATCH',
    'Backup artifact set differs from its manifest.',
  );
  const snapshotStore = await SqliteProjectStore.open({
    filename: join(source, manifest.database.filename),
    mode: 'reader',
  });
  try {
    const snapshotIntegrity = await verifyWorkspaceIntegrity({ projectStore: snapshotStore, artifactStore: artifacts });
    invariant(snapshotIntegrity.ok, 'BACKUP_SNAPSHOT_INTEGRITY_FAILED', 'Backup failed semantic, CAS, or job integrity verification.', {
      findingCount: [snapshotIntegrity.artifacts, snapshotIntegrity.sourceIntakes, snapshotIntegrity.agentAttempts, snapshotIntegrity.jobs]
        .reduce((count, section) => count + section.findings.length, 0),
    });
  } finally {
    snapshotStore.close();
  }
  return { ok: true, manifest };
}

export async function restoreWorkspaceBackup({ backupDirectory, databaseDestination, artifactDestination }) {
  const verified = await verifyWorkspaceBackup(backupDirectory);
  await mkdir(dirname(resolve(databaseDestination)), { recursive: true, mode: 0o700 });
  await mkdir(resolve(artifactDestination), { recursive: true, mode: 0o700 });
  await copyFile(
    join(resolve(backupDirectory), verified.manifest.database.filename),
    resolve(databaseDestination),
    constants.COPYFILE_EXCL,
  );
  const sourceArtifacts = new ContentAddressedArtifactStore({ rootDirectory: join(resolve(backupDirectory), 'artifacts') });
  await sourceArtifacts.backupTo(
    resolve(artifactDestination),
    new Set(verified.manifest.artifacts.entries.map((entry) => entry.digest)),
  );
  return verified;
}
