import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, open, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { StudioError, invariant } from '../../../domain/src/errors.js';
import { ContentAddressedArtifactStore } from '../artifacts/content-addressed-artifact-store.js';
import { SqliteArtifactMetadataStore } from '../sqlite/sqlite-artifact-metadata-store.js';
import { SqliteProjectStore } from '../sqlite/sqlite-project-store.js';
import {
  openSqliteWorkspaceForInternalRecoveryTest,
  openSqliteWorkspaceForInternalVerification,
} from '../sqlite/sqlite-workspace.js';
import { verifyWorkspaceIntegrity } from '../integrity/workspace-integrity.js';
import { inspectWindowsFilesystem } from '../operations/windows-filesystem-proof.js';

const BACKUP_MANIFEST_FILENAME = 'workspace-manifest.json';
const BACKUP_DATABASE_FILENAME = 'studio.sqlite';
const BACKUP_ARTIFACT_DIRECTORY = 'artifacts';
const ARTIFACT_MANIFEST_FILENAME = 'manifest.json';
export const RESTORED_COPY_QUARANTINE_MARKER = '.numberdroid-restored-copy-quarantine.json';
const MAX_MANIFEST_BYTES = 1024 * 1024;
const MAX_WINDOWS_MISSING_DIRECTORY_COMPONENTS = 256;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const RESTORED_COPY_ID_PATTERN = /^[a-f0-9]{8}-[a-f0-9-]{8,55}$/;

function assertEffectFence(signal) {
  if (signal !== undefined) AbortSignal.prototype.throwIfAborted.call(signal);
}

function isPlainRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function assertExactKeys(value, keys, label) {
  invariant(isPlainRecord(value), 'BACKUP_SCHEMA_UNSUPPORTED', `${label} must be an object.`);
  invariant(
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()),
    'BACKUP_SCHEMA_UNSUPPORTED',
    `${label} contains unsupported fields.`,
  );
}

async function readBoundedJson(path, label) {
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const info = await handle.stat();
    invariant(
      info.isFile() && info.size > 0 && info.size <= MAX_MANIFEST_BYTES,
      'BACKUP_SCHEMA_UNSUPPORTED',
      `${label} exceeds its fixed size or file-type contract.`,
    );
    const source = await handle.readFile({ encoding: 'utf8' });
    return Object.freeze({
      value: JSON.parse(source),
      sha256: createHash('sha256').update(source).digest('hex'),
    });
  } catch (error) {
    if (error instanceof StudioError) throw error;
    throw new StudioError('BACKUP_SCHEMA_UNSUPPORTED', `${label} is not a supported JSON manifest.`);
  } finally {
    await handle?.close();
  }
}

async function fileHash(path) {
  const before = await lstat(path);
  invariant(
    before.isFile() && !before.isSymbolicLink(),
    'BACKUP_CONTENT_MISMATCH',
    'Backup content must be a regular no-follow file.',
  );
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const opened = await handle.stat();
    invariant(
      opened.isFile() && opened.dev === before.dev && opened.ino === before.ino,
      'BACKUP_CONTENT_MISMATCH',
      'Backup content changed while its no-follow handle was acquired.',
    );
    const hash = createHash('sha256');
    for await (const chunk of handle.createReadStream({ autoClose: false })) hash.update(chunk);
    const after = await lstat(path);
    invariant(
      after.isFile() && !after.isSymbolicLink() && after.dev === opened.dev && after.ino === opened.ino,
      'BACKUP_CONTENT_MISMATCH',
      'Backup content changed during verification.',
    );
    return hash.digest('hex');
  } finally {
    await handle?.close();
  }
}

function validateArtifactManifest(manifest) {
  assertExactKeys(manifest, ['schemaVersion', 'algorithm', 'entries'], 'Artifact manifest');
  invariant(
    manifest.schemaVersion === 1 && manifest.algorithm === 'sha256' && Array.isArray(manifest.entries),
    'BACKUP_SCHEMA_UNSUPPORTED',
    'Unsupported artifact manifest schema.',
  );
  let previous = null;
  for (const entry of manifest.entries) {
    assertExactKeys(entry, ['digest', 'byteSize'], 'Artifact manifest entry');
    invariant(
      SHA256_PATTERN.test(entry.digest) && Number.isSafeInteger(entry.byteSize) && entry.byteSize >= 0,
      'BACKUP_SCHEMA_UNSUPPORTED',
      'Artifact manifest entry is invalid.',
    );
    invariant(
      previous === null || previous < entry.digest,
      'BACKUP_SCHEMA_UNSUPPORTED',
      'Artifact manifest entries must be unique and sorted.',
    );
    previous = entry.digest;
  }
  return manifest;
}

function validateWorkspaceManifest(manifest) {
  assertExactKeys(manifest, ['schemaVersion', 'createdAt', 'database', 'artifacts', 'integrity'], 'Workspace manifest');
  invariant(
    manifest.schemaVersion === 1 && typeof manifest.createdAt === 'string' && Number.isFinite(Date.parse(manifest.createdAt)),
    'BACKUP_SCHEMA_UNSUPPORTED',
    'Unsupported workspace manifest schema.',
  );
  assertExactKeys(manifest.database, ['filename', 'sha256'], 'Workspace database manifest');
  invariant(
    manifest.database.filename === BACKUP_DATABASE_FILENAME && SHA256_PATTERN.test(manifest.database.sha256),
    'BACKUP_SCHEMA_UNSUPPORTED',
    'Workspace database manifest is invalid.',
  );
  validateArtifactManifest(manifest.artifacts);
  invariant(
    isPlainRecord(manifest.integrity) && manifest.integrity.ok === true,
    'BACKUP_SCHEMA_UNSUPPORTED',
    'Workspace integrity evidence is invalid.',
  );
  return manifest;
}

async function assertDirectory(path, label) {
  const info = await lstat(path).catch((error) => {
    if (error.code === 'ENOENT') throw new StudioError('BACKUP_CONTENT_MISMATCH', `${label} is missing.`);
    throw error;
  });
  invariant(
    info.isDirectory() && !info.isSymbolicLink(),
    'BACKUP_CONTENT_MISMATCH',
    `${label} must be a no-follow directory.`,
  );
}

async function listArtifactDigestsNoCreate(artifactRoot) {
  await assertDirectory(artifactRoot, 'Backup artifact root');
  const entries = (await readdir(artifactRoot, { withFileTypes: true }))
    .sort((left, right) => left.name.localeCompare(right.name));
  invariant(
    JSON.stringify(entries.map((entry) => entry.name))
      === JSON.stringify([ARTIFACT_MANIFEST_FILENAME, 'quarantine', 'sha256', 'staging'].sort()),
    'BACKUP_CONTENT_MISMATCH',
    'Backup artifact root contains missing or unexpected entries.',
  );
  for (const name of ['quarantine', 'sha256', 'staging']) {
    await assertDirectory(join(artifactRoot, name), `Backup artifact ${name}`);
  }
  invariant(
    (await readdir(join(artifactRoot, 'staging'))).length === 0
      && (await readdir(join(artifactRoot, 'quarantine'))).length === 0,
    'BACKUP_CONTENT_MISMATCH',
    'Backup artifact staging and quarantine directories must be empty.',
  );
  const manifestInfo = await lstat(join(artifactRoot, ARTIFACT_MANIFEST_FILENAME));
  invariant(
    manifestInfo.isFile() && !manifestInfo.isSymbolicLink(),
    'BACKUP_CONTENT_MISMATCH',
    'Backup artifact manifest must be a regular no-follow file.',
  );

  const digests = [];
  const live = join(artifactRoot, 'sha256');
  for (const first of await readdir(live, { withFileTypes: true })) {
    invariant(
      first.isDirectory() && !first.isSymbolicLink() && /^[a-f0-9]{2}$/.test(first.name),
      'BACKUP_CONTENT_MISMATCH',
      'Backup CAS contains an invalid first-level entry.',
    );
    for (const second of await readdir(join(live, first.name), { withFileTypes: true })) {
      invariant(
        second.isDirectory() && !second.isSymbolicLink() && /^[a-f0-9]{2}$/.test(second.name),
        'BACKUP_CONTENT_MISMATCH',
        'Backup CAS contains an invalid second-level entry.',
      );
      for (const entry of await readdir(join(live, first.name, second.name), { withFileTypes: true })) {
        invariant(
          entry.isFile() && !entry.isSymbolicLink() && SHA256_PATTERN.test(entry.name)
            && entry.name.startsWith(`${first.name}${second.name}`),
          'BACKUP_CONTENT_MISMATCH',
          'Backup CAS contains an invalid object entry.',
        );
        digests.push(entry.name);
      }
    }
  }
  return digests.sort();
}

function integrityFindingCount(integrity) {
  return Object.values(integrity)
    .filter((section) => section && Array.isArray(section.findings))
    .reduce((count, section) => count + section.findings.length, 0);
}

async function proveWindowsMutationDirectories(paths, {
  platform,
  spawnProcess,
  inspectDescendants = false,
  signal,
}) {
  if (platform !== 'win32') return Object.freeze([]);
  const proofs = [];
  for (const path of [...new Set(paths.map((entry) => resolve(entry)))]) {
    proofs.push(Object.freeze({
      path,
      inspectDescendants,
      identity: await inspectWindowsFilesystem(path, { inspectDescendants, spawnProcess, signal }),
    }));
  }
  return Object.freeze(proofs);
}

async function prepareWindowsMutationDirectory(path, {
  spawnProcess,
  inspectDescendants = false,
  signal,
}) {
  const target = resolve(path);
  const missing = [];
  let current = target;
  while (true) {
    assertEffectFence(signal);
    try {
      const info = await lstat(current);
      invariant(info.isDirectory() && !info.isSymbolicLink(),
        'BACKUP_PATH_UNSAFE', 'Windows mutation parent is not a no-follow directory.');
      break;
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      if (error instanceof StudioError) throw error;
      if (error.code !== 'ENOENT') {
        throw new StudioError('BACKUP_PATH_UNSAFE', 'Windows mutation parent could not be inspected safely.');
      }
      missing.push(current);
      invariant(missing.length <= MAX_WINDOWS_MISSING_DIRECTORY_COMPONENTS,
        'BACKUP_PATH_UNSAFE', 'Windows mutation parent exceeds its fixed component bound.');
      const parent = dirname(current);
      invariant(parent !== current,
        'BACKUP_PATH_UNSAFE', 'Windows mutation parent has no existing safe ancestor.');
      current = parent;
    }
  }

  let identity = await inspectWindowsFilesystem(current, { spawnProcess, signal });
  const pending = missing.reverse();
  for (let index = 0; index < pending.length; index += 1) {
    const next = pending[index];
    await inspectWindowsFilesystem(current, {
      expectedIdentity: identity,
      spawnProcess,
      signal,
    });
    assertEffectFence(signal);
    try {
      await mkdir(next, { recursive: false, mode: 0o700 });
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      throw new StudioError('BACKUP_PATH_UNSAFE', 'Windows mutation parent could not be created safely.');
    }
    await inspectWindowsFilesystem(current, {
      expectedIdentity: identity,
      spawnProcess,
      signal,
    });
    const nextIdentity = await inspectWindowsFilesystem(next, {
      inspectDescendants: inspectDescendants && index === pending.length - 1,
      spawnProcess,
      signal,
    });
    await inspectWindowsFilesystem(current, {
      expectedIdentity: identity,
      spawnProcess,
      signal,
    });
    current = next;
    identity = nextIdentity;
  }

  if (pending.length === 0 && inspectDescendants) {
    identity = await inspectWindowsFilesystem(current, {
      expectedIdentity: identity,
      inspectDescendants: true,
      spawnProcess,
      signal,
    });
  }
  return Object.freeze({ path: target, inspectDescendants, identity });
}

async function prepareWindowsMutationChild(path, parentProof, {
  spawnProcess,
  inspectDescendants = false,
  signal,
}) {
  const target = resolve(path);
  invariant(parentProof?.path === dirname(target),
    'BACKUP_PATH_UNSAFE', 'Windows mutation child is not beneath its pinned parent.');
  const revalidateParent = () => inspectWindowsFilesystem(parentProof.path, {
    expectedIdentity: parentProof.identity,
    inspectDescendants: parentProof.inspectDescendants,
    spawnProcess,
    signal,
  });

  await revalidateParent();
  assertEffectFence(signal);
  let exists = true;
  try {
    const info = await lstat(target);
    invariant(info.isDirectory() && !info.isSymbolicLink(),
      'BACKUP_PATH_UNSAFE', 'Windows mutation child is not a no-follow directory.');
  } catch (error) {
    if (signal?.aborted) throw signal.reason;
    if (error instanceof StudioError) throw error;
    if (error.code !== 'ENOENT') {
      throw new StudioError('BACKUP_PATH_UNSAFE', 'Windows mutation child could not be inspected safely.');
    }
    exists = false;
  }

  await revalidateParent();
  if (!exists) {
    assertEffectFence(signal);
    try {
      await mkdir(target, { recursive: false, mode: 0o700 });
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      throw new StudioError('BACKUP_PATH_UNSAFE', 'Windows mutation child could not be created safely.');
    }
    await revalidateParent();
  }
  const identity = await inspectWindowsFilesystem(target, {
    inspectDescendants,
    spawnProcess,
    signal,
  });
  await revalidateParent();
  return Object.freeze({ path: target, inspectDescendants, identity });
}

async function prepareWindowsMutationDirectories(paths, options) {
  if (options.platform !== 'win32') return Object.freeze([]);
  const proofs = [];
  for (const path of [...new Set(paths.map((entry) => resolve(entry)))]) {
    proofs.push(await prepareWindowsMutationDirectory(path, options));
  }
  return Object.freeze(proofs);
}

async function revalidateWindowsMutationDirectories(proofs, { platform, spawnProcess, signal }) {
  if (platform !== 'win32') return;
  for (const proof of proofs) {
    await inspectWindowsFilesystem(proof.path, {
      expectedIdentity: proof.identity,
      inspectDescendants: proof.inspectDescendants,
      spawnProcess,
      signal,
    });
  }
}

export async function createWorkspaceBackup({
  projectStore,
  artifactStore,
  destinationDirectory,
  clock = () => new Date().toISOString(),
  platform = process.platform,
  spawnProcess,
  signal,
}) {
  invariant(projectStore instanceof SqliteProjectStore, 'VALIDATION_ERROR', 'SqliteProjectStore is required.');
  invariant(artifactStore instanceof ContentAddressedArtifactStore, 'VALIDATION_ERROR', 'ContentAddressedArtifactStore is required.');
  invariant(['linux', 'win32'].includes(platform),
    'BACKUP_PATH_UNSAFE', 'Backup creation is unsupported on this platform.');
  return artifactStore.withSharedMaintenancePermit(async () => {
    const sourceIntegrity = await verifyWorkspaceIntegrity({ projectStore, artifactStore });
    invariant(sourceIntegrity.ok, 'BACKUP_SOURCE_INTEGRITY_FAILED', 'Live workspace failed semantic, CAS, or job integrity checks before backup.', {
      findingCount: integrityFindingCount(sourceIntegrity),
    });
    const destination = resolve(destinationDirectory);
    const parentProofs = await prepareWindowsMutationDirectories([dirname(destination)], {
      platform,
      spawnProcess,
      signal,
    });
    assertEffectFence(signal);
    if (platform !== 'win32') await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
    await revalidateWindowsMutationDirectories(parentProofs, { platform, spawnProcess, signal });
    assertEffectFence(signal);
    await mkdir(destination, { recursive: false, mode: 0o700 });
    const destinationProofs = await proveWindowsMutationDirectories([destination], {
      platform,
      spawnProcess,
      inspectDescendants: true,
      signal,
    });
    const revalidateDestination = async () => {
      await revalidateWindowsMutationDirectories(parentProofs, { platform, spawnProcess, signal });
      await revalidateWindowsMutationDirectories(destinationProofs, { platform, spawnProcess, signal });
    };
    const databasePath = join(destination, BACKUP_DATABASE_FILENAME);
    await revalidateDestination();
    await projectStore.backupTo(databasePath, { signal });
    const snapshotStore = await SqliteProjectStore.open({ filename: databasePath, mode: 'reader' });
    let artifactManifest;
    let snapshotIntegrity;
    try {
      const metadata = new SqliteArtifactMetadataStore({ workspace: snapshotStore.workspace });
      const referencedDigests = metadata.listReferencedDigests();
      const artifactDirectory = join(destination, BACKUP_ARTIFACT_DIRECTORY);
      await revalidateDestination();
      artifactManifest = await artifactStore.backupTo(artifactDirectory, referencedDigests, { signal });
      snapshotIntegrity = await verifyWorkspaceIntegrity({
        projectStore: snapshotStore,
        artifactStore: new ContentAddressedArtifactStore({ rootDirectory: artifactDirectory }),
      });
      invariant(snapshotIntegrity.ok, 'BACKUP_SNAPSHOT_INTEGRITY_FAILED', 'The immutable backup snapshot failed semantic, CAS, or job integrity checks.', {
        findingCount: integrityFindingCount(snapshotIntegrity),
      });
    } finally {
      snapshotStore.close();
    }
    const manifest = {
      schemaVersion: 1,
      createdAt: clock(),
      database: { filename: BACKUP_DATABASE_FILENAME, sha256: await fileHash(databasePath) },
      artifacts: artifactManifest,
      integrity: snapshotIntegrity,
    };
    await revalidateDestination();
    assertEffectFence(signal);
    await writeFile(join(destination, BACKUP_MANIFEST_FILENAME), `${JSON.stringify(manifest, null, 2)}\n`, {
      flag: 'wx',
      mode: 0o600,
    });
    return manifest;
  });
}

export async function verifyWorkspaceBackup(backupDirectory, {
  platform = process.platform,
  spawnProcess,
  signal,
} = {}) {
  invariant(['linux', 'win32'].includes(platform),
    'BACKUP_PATH_UNSAFE', 'Backup verification is unsupported on this platform.');
  const source = resolve(backupDirectory);
  if (platform === 'win32') {
    await inspectWindowsFilesystem(source, { inspectDescendants: true, spawnProcess, signal });
  }
  assertEffectFence(signal);
  await assertDirectory(source, 'Backup root');
  invariant(
    JSON.stringify((await readdir(source)).sort())
      === JSON.stringify([BACKUP_ARTIFACT_DIRECTORY, BACKUP_DATABASE_FILENAME, BACKUP_MANIFEST_FILENAME].sort()),
    'BACKUP_CONTENT_MISMATCH',
    'Backup root contains missing or unexpected entries.',
  );
  const manifestFile = await readBoundedJson(join(source, BACKUP_MANIFEST_FILENAME), 'Workspace manifest');
  const manifest = validateWorkspaceManifest(manifestFile.value);
  const databasePath = join(source, BACKUP_DATABASE_FILENAME);
  const databaseSha256 = await fileHash(databasePath);
  invariant(
    databaseSha256 === manifest.database.sha256,
    'BACKUP_CONTENT_MISMATCH',
    'Backup database differs from its manifest.',
  );
  const artifactRoot = join(source, BACKUP_ARTIFACT_DIRECTORY);
  const artifacts = new ContentAddressedArtifactStore({ rootDirectory: artifactRoot });
  const expectedDigests = manifest.artifacts.entries.map((entry) => entry.digest).sort();
  invariant(
    JSON.stringify(await listArtifactDigestsNoCreate(artifactRoot)) === JSON.stringify(expectedDigests),
    'BACKUP_CONTENT_MISMATCH',
    'Backup contains missing or unmanifested CAS objects.',
  );
  const storedArtifactManifest = validateArtifactManifest(
    (await readBoundedJson(join(artifactRoot, ARTIFACT_MANIFEST_FILENAME), 'Artifact manifest')).value,
  );
  invariant(
    JSON.stringify(storedArtifactManifest) === JSON.stringify(manifest.artifacts),
    'BACKUP_CONTENT_MISMATCH',
    'Workspace and artifact manifests disagree.',
  );
  const artifactManifest = await artifacts.createManifest(new Set(expectedDigests));
  invariant(
    JSON.stringify(artifactManifest) === JSON.stringify(manifest.artifacts),
    'BACKUP_CONTENT_MISMATCH',
    'Backup artifact set differs from its manifest.',
  );
  const snapshotStore = await SqliteProjectStore.open({
    filename: databasePath,
    mode: 'reader',
  });
  try {
    const snapshotIntegrity = await verifyWorkspaceIntegrity({ projectStore: snapshotStore, artifactStore: artifacts });
    invariant(snapshotIntegrity.ok, 'BACKUP_SNAPSHOT_INTEGRITY_FAILED', 'Backup failed semantic, CAS, or job integrity verification.', {
      findingCount: integrityFindingCount(snapshotIntegrity),
    });
  } finally {
    snapshotStore.close();
  }
  invariant(
    await fileHash(join(source, BACKUP_MANIFEST_FILENAME)) === manifestFile.sha256,
    'BACKUP_CONTENT_MISMATCH',
    'Backup manifest changed during verification.',
  );
  const databaseInfo = await lstat(databasePath);
  return {
    ok: true,
    manifest,
    manifestSha256: manifestFile.sha256,
    databaseSha256,
    itemCount: expectedDigests.length,
    byteCount: databaseInfo.size + manifest.artifacts.entries.reduce((total, entry) => total + entry.byteSize, 0),
  };
}

export async function restoreWorkspaceBackup({ backupDirectory, databaseDestination, artifactDestination }, options = {}) {
  const verified = await verifyWorkspaceBackup(backupDirectory, options);
  const platform = options.platform ?? process.platform;
  const spawnProcess = options.spawnProcess;
  const signal = options.signal;
  const databasePath = resolve(databaseDestination);
  const artifactPath = resolve(artifactDestination);
  const parentProofs = await prepareWindowsMutationDirectories([
    dirname(databasePath),
    dirname(artifactPath),
  ], { platform, spawnProcess, signal });
  assertEffectFence(signal);
  if (platform !== 'win32') await mkdir(dirname(databasePath), { recursive: true, mode: 0o700 });
  await revalidateWindowsMutationDirectories(parentProofs, { platform, spawnProcess, signal });
  assertEffectFence(signal);
  let artifactProofs;
  if (platform === 'win32') {
    const artifactParentProof = parentProofs.find((proof) => proof.path === dirname(artifactPath));
    artifactProofs = Object.freeze([await prepareWindowsMutationChild(artifactPath, artifactParentProof, {
      spawnProcess,
      inspectDescendants: true,
      signal,
    })]);
  } else {
    await mkdir(artifactPath, { recursive: true, mode: 0o700 });
    artifactProofs = Object.freeze([]);
  }
  await revalidateWindowsMutationDirectories(parentProofs, { platform, spawnProcess, signal });
  await revalidateWindowsMutationDirectories(artifactProofs, { platform, spawnProcess, signal });
  assertEffectFence(signal);
  await copyFile(
    join(resolve(backupDirectory), BACKUP_DATABASE_FILENAME),
    databasePath,
    constants.COPYFILE_EXCL,
  );
  const sourceArtifacts = new ContentAddressedArtifactStore({
    rootDirectory: join(resolve(backupDirectory), BACKUP_ARTIFACT_DIRECTORY),
  });
  await revalidateWindowsMutationDirectories(parentProofs, { platform, spawnProcess, signal });
  await revalidateWindowsMutationDirectories(artifactProofs, { platform, spawnProcess, signal });
  await sourceArtifacts.backupTo(
    artifactPath,
    new Set(verified.manifest.artifacts.entries.map((entry) => entry.digest)),
    { signal },
  );
  return verified;
}

export async function writeRestoredWorkspaceQuarantineMarker(copyDirectory, {
  copyId,
  backupId,
  manifestSha256,
}, { platform = process.platform, signal } = {}) {
  invariant(['linux', 'win32'].includes(platform),
    'BACKUP_PATH_UNSAFE', 'Restored-copy quarantine is unsupported on this platform.');
  invariant(RESTORED_COPY_ID_PATTERN.test(copyId) && RESTORED_COPY_ID_PATTERN.test(backupId),
    'BACKUP_PATH_UNSAFE', 'Restored-copy quarantine requires generated opaque identities.');
  invariant(SHA256_PATTERN.test(manifestSha256),
    'BACKUP_CONTENT_MISMATCH', 'Restored-copy quarantine requires a verified manifest identity.');
  const source = resolve(copyDirectory);
  await assertDirectory(source, 'Restored-copy root');
  const marker = Object.freeze({
    schemaVersion: 1,
    kind: 'numberdroid-restored-copy-quarantine',
    copyId,
    backupId,
    manifestSha256,
  });
  const markerPath = join(source, RESTORED_COPY_QUARANTINE_MARKER);
  let handle;
  try {
    assertEffectFence(signal);
    handle = await open(markerPath, 'wx', 0o600);
    assertEffectFence(signal);
    await handle.writeFile(`${JSON.stringify(marker)}\n`, 'utf8');
    assertEffectFence(signal);
    await handle.sync();
  } catch (error) {
    if (signal?.aborted) throw signal.reason;
    if (error instanceof StudioError) throw error;
    throw new StudioError('BACKUP_DURABILITY_FAILED', 'Restored-copy quarantine marker could not be written durably.');
  } finally {
    await handle?.close().catch(() => {});
  }
  if (platform !== 'win32') {
    let directoryHandle;
    try {
      directoryHandle = await open(source, constants.O_RDONLY);
      assertEffectFence(signal);
      await directoryHandle.sync();
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      throw new StudioError('BACKUP_DURABILITY_FAILED', 'Restored-copy quarantine directory could not be synced durably.');
    } finally {
      await directoryHandle?.close().catch(() => {});
    }
  }
  assertEffectFence(signal);
  const proof = await readBoundedJson(markerPath, 'Restored-copy quarantine marker');
  invariant(JSON.stringify(proof.value) === JSON.stringify(marker),
    'BACKUP_CONTENT_MISMATCH', 'Restored-copy quarantine marker failed its read-back proof.');
  return marker;
}

export async function verifyRestoredWorkspaceCopy({
  copyDirectory,
  expectedManifest,
  expectedManifestSha256,
  expectedBackupId,
  expectedCopyId,
  purpose,
  databaseFactory,
}, {
  platform = process.platform,
  spawnProcess,
  signal,
} = {}) {
  invariant(['VERIFY', 'RECOVERY_TEST'].includes(purpose),
    'OPERATION_STATE_CONFLICT', 'Restored-copy verification requires a fixed internal reader purpose.');
  invariant(SHA256_PATTERN.test(expectedManifestSha256),
    'BACKUP_CONTENT_MISMATCH', 'Restored-copy verification requires a manifest identity.');
  invariant(['linux', 'win32'].includes(platform),
    'BACKUP_PATH_UNSAFE', 'Restored-copy verification is unsupported on this platform.');
  const source = resolve(copyDirectory);
  if (platform === 'win32') {
    await inspectWindowsFilesystem(source, { inspectDescendants: true, spawnProcess, signal });
  }
  assertEffectFence(signal);
  const manifest = validateWorkspaceManifest(structuredClone(expectedManifest));
  await assertDirectory(source, 'Restored-copy root');
  invariant(
    JSON.stringify((await readdir(source)).sort())
      === JSON.stringify([BACKUP_ARTIFACT_DIRECTORY, BACKUP_DATABASE_FILENAME, RESTORED_COPY_QUARANTINE_MARKER].sort()),
    'BACKUP_CONTENT_MISMATCH',
    'Restored-copy root contains missing or unexpected entries.',
  );
  const markerFile = await readBoundedJson(join(source, RESTORED_COPY_QUARANTINE_MARKER), 'Restored-copy quarantine marker');
  assertExactKeys(markerFile.value, ['schemaVersion', 'kind', 'copyId', 'backupId', 'manifestSha256'], 'Restored-copy quarantine marker');
  invariant(
    markerFile.value.schemaVersion === 1
      && markerFile.value.kind === 'numberdroid-restored-copy-quarantine'
      && markerFile.value.copyId === expectedCopyId
      && markerFile.value.backupId === expectedBackupId
      && markerFile.value.manifestSha256 === expectedManifestSha256,
    'BACKUP_CONTENT_MISMATCH',
    'Restored-copy quarantine marker differs from its reserved identity.',
  );
  const databasePath = join(source, BACKUP_DATABASE_FILENAME);
  invariant(await fileHash(databasePath) === manifest.database.sha256,
    'BACKUP_CONTENT_MISMATCH', 'Restored database differs from its verified source manifest.');
  const artifactRoot = join(source, BACKUP_ARTIFACT_DIRECTORY);
  const expectedDigests = manifest.artifacts.entries.map((entry) => entry.digest);
  invariant(
    JSON.stringify(await listArtifactDigestsNoCreate(artifactRoot)) === JSON.stringify(expectedDigests),
    'BACKUP_CONTENT_MISMATCH',
    'Restored CAS differs from its verified source manifest.',
  );
  const storedArtifactManifest = validateArtifactManifest(
    (await readBoundedJson(join(artifactRoot, ARTIFACT_MANIFEST_FILENAME), 'Artifact manifest')).value,
  );
  invariant(JSON.stringify(storedArtifactManifest) === JSON.stringify(manifest.artifacts),
    'BACKUP_CONTENT_MISMATCH', 'Restored artifact manifest differs from its verified source.');
  const artifacts = new ContentAddressedArtifactStore({ rootDirectory: artifactRoot });
  invariant(
    JSON.stringify(await artifacts.createManifest(new Set(expectedDigests))) === JSON.stringify(manifest.artifacts),
    'BACKUP_CONTENT_MISMATCH',
    'Restored artifact bytes differ from their verified source manifest.',
  );

  const workspace = await (purpose === 'RECOVERY_TEST'
    ? openSqliteWorkspaceForInternalRecoveryTest({ filename: databasePath, ...(databaseFactory ? { databaseFactory } : {}) })
    : openSqliteWorkspaceForInternalVerification({ filename: databasePath, ...(databaseFactory ? { databaseFactory } : {}) }));
  const restoredStore = new SqliteProjectStore({ workspace });
  try {
    const integrity = await verifyWorkspaceIntegrity({ projectStore: restoredStore, artifactStore: artifacts });
    invariant(integrity.ok, 'BACKUP_SNAPSHOT_INTEGRITY_FAILED', 'Restored copy failed semantic, SQLite, or CAS verification.', {
      findingCount: integrityFindingCount(integrity),
    });
  } finally {
    restoredStore.close();
  }
  const databaseInfo = await lstat(databasePath);
  return Object.freeze({
    ok: true,
    manifestSha256: expectedManifestSha256,
    itemCount: expectedDigests.length,
    byteCount: databaseInfo.size + manifest.artifacts.entries.reduce((total, entry) => total + entry.byteSize, 0),
  });
}
