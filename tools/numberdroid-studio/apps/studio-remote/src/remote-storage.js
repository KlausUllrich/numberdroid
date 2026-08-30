import { lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { readOperationsConfigurationFile, validateOperationsConfiguration } from '../../../packages/persistence/src/operations/operations-config.js';
import { REMOTE_MOUNT_MARKER_FILENAME } from './remote-config.js';

function identityMatches(left, right) {
  return String(left.dev) === String(right.device) && String(left.ino) === String(right.inode);
}

function snapshotMatches(left, right) {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.size === right.size
    && left.mtimeMs === right.mtimeMs
    && left.ctimeMs === right.ctimeMs;
}

async function assertPinnedMounts(remoteConfiguration) {
  for (const mount of remoteConfiguration.mounts) {
    const root = await lstat(mount.root).catch(() => { throw configurationError(); });
    if (!root.isDirectory() || root.isSymbolicLink() || !identityMatches(root, mount.identity)
      || (process.platform !== 'win32' && (root.mode & 0o077) !== 0)) {
      throw configurationError();
    }
    const marker = await lstat(join(mount.root, REMOTE_MOUNT_MARKER_FILENAME))
      .catch(() => { throw configurationError(); });
    if (!marker.isFile() || marker.isSymbolicLink()
      || !identityMatches(marker, mount.marker.identity)
      || (process.platform !== 'win32' && (marker.mode & 0o7777) !== 0o600)) {
      throw configurationError();
    }
  }
}

function rootMatchesMount(root, mount) {
  return root === mount.root
    && root !== ''
    && mount.identity?.device !== undefined
    && mount.identity?.inode !== undefined;
}

function configurationError() {
  const error = new Error('Remote persistent storage configuration is invalid.');
  error.name = 'RemoteStorageError';
  error.code = 'REMOTE_STORAGE_INVALID';
  return error;
}

export async function validateRemoteStorage(remoteConfiguration) {
  if (!remoteConfiguration || !Array.isArray(remoteConfiguration.mounts)) {
    throw new TypeError('A validated remote configuration is required.');
  }
  await assertPinnedMounts(remoteConfiguration);
  const before = await lstat(remoteConfiguration.operationsConfigurationFile).catch(() => {
    throw configurationError();
  });
  if (!before.isFile() || before.isSymbolicLink()
    || !identityMatches(before, remoteConfiguration.operationsConfigurationIdentity)
    || (process.platform !== 'win32' && (before.mode & 0o7777) !== 0o600)) {
    throw configurationError();
  }
  const rawOperations = await readOperationsConfigurationFile(
    remoteConfiguration.operationsConfigurationFile,
  );
  const operations = await validateOperationsConfiguration(rawOperations, {
    liveWorkspaceRoot: remoteConfiguration.workspaceRoot,
  });
  const after = await lstat(remoteConfiguration.operationsConfigurationFile).catch(() => {
    throw configurationError();
  });
  if (!after.isFile() || after.isSymbolicLink() || !snapshotMatches(before, after)) {
    throw configurationError();
  }
  await assertPinnedMounts(remoteConfiguration);

  const requiredRoots = [
    { role: 'workspace', root: operations.workspaceRoot, identity: operations.workspaceIdentity },
    { role: 'control', root: operations.controlRoot },
    ...operations.backupDestinations.map(({ destinationId, root }) => ({
      role: `backup:${destinationId}`,
      root,
    })),
    ...operations.restoreDestinations.map(({ destinationId, root }) => ({
      role: `restore:${destinationId}`,
      root,
    })),
  ];
  const covered = requiredRoots.map((required) => {
    const matching = remoteConfiguration.mounts.filter((mount) => rootMatchesMount(required.root, mount));
    if (matching.length !== 1) throw configurationError();
    if (required.identity
      && (required.identity.device !== matching[0].identity.device
        || required.identity.inode !== matching[0].identity.inode)) {
      throw configurationError();
    }
    return Object.freeze({ role: required.role, mountId: matching[0].mountId, root: required.root });
  });
  if (covered.length !== remoteConfiguration.mounts.length) {
    throw configurationError();
  }
  return Object.freeze({
    operationsConfiguration: rawOperations,
    validatedOperations: operations,
    mounts: Object.freeze(covered),
  });
}
