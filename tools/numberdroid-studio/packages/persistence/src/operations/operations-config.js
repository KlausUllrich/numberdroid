import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { StudioError, invariant } from '../../../domain/src/errors.js';

const MAX_CONFIG_BYTES = 64 * 1024;
const DESTINATION_ID_PATTERN = /^[a-z][a-z0-9._-]{2,63}$/;
const SAFE_LABEL_PATTERN = /^[^\u0000-\u001f\u007f]{1,80}$/;

function isPlainRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function exactKeys(value, keys, label) {
  invariant(isPlainRecord(value), 'BACKUP_PATH_UNSAFE', `${label} must be an object.`);
  invariant(
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()),
    'BACKUP_PATH_UNSAFE',
    `${label} contains unsupported fields.`,
  );
}

function normalizeForComparison(path, platform) {
  const normalized = resolve(path).replaceAll('\\', '/').replace(/\/+$/, '');
  return platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function pathsOverlap(left, right, platform) {
  const a = normalizeForComparison(left, platform);
  const b = normalizeForComparison(right, platform);
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

async function assertNoLinkAncestors(path) {
  let current = resolve(path);
  while (true) {
    const info = await lstat(current).catch((error) => {
      if (error.code === 'ENOENT') {
        throw new StudioError('BACKUP_PATH_UNSAFE', 'Configured operations root or ancestor is missing.');
      }
      throw error;
    });
    invariant(info.isDirectory() && !info.isSymbolicLink(), 'BACKUP_PATH_UNSAFE', 'Configured operations roots and ancestors must be no-follow directories.');
    const parent = resolve(current, '..');
    if (parent === current) break;
    current = parent;
  }
}

async function canonicalRoot(path, platform) {
  invariant(typeof path === 'string' && isAbsolute(path), 'BACKUP_PATH_UNSAFE', 'Configured operations roots must be absolute.');
  const absolute = resolve(path);
  if (platform !== 'win32') await assertNoLinkAncestors(absolute);
  const canonical = await realpath(absolute).catch((error) => {
    if (error.code === 'ENOENT') throw new StudioError('BACKUP_PATH_UNSAFE', 'Configured operations root is missing.');
    throw error;
  });
  const info = await lstat(canonical);
  invariant(info.isDirectory() && !info.isSymbolicLink(), 'BACKUP_PATH_UNSAFE', 'Configured operations root must be a no-follow directory.');
  return Object.freeze({
    inspectionPath: absolute,
    path: canonical,
    identity: Object.freeze({
      device: String(info.dev),
      inode: String(info.ino),
    }),
  });
}

function validateDestination(entry, kind) {
  exactKeys(entry, ['destinationId', 'label', 'root'], `${kind} destination`);
  invariant(DESTINATION_ID_PATTERN.test(entry.destinationId), 'BACKUP_PATH_UNSAFE', `${kind} destinationId is invalid.`);
  invariant(typeof entry.label === 'string' && SAFE_LABEL_PATTERN.test(entry.label.trim()),
    'BACKUP_PATH_UNSAFE', `${kind} destination label is invalid.`);
  invariant(typeof entry.root === 'string' && isAbsolute(entry.root),
    'BACKUP_PATH_UNSAFE', `${kind} destination root must be absolute.`);
}

export async function readOperationsConfigurationFile(filename) {
  invariant(typeof filename === 'string' && isAbsolute(filename), 'OPERATIONS_UNAVAILABLE', 'Operations configuration filename must be absolute.');
  let handle;
  try {
    handle = await open(filename, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const info = await handle.stat();
    invariant(info.isFile() && info.size > 0 && info.size <= MAX_CONFIG_BYTES,
      'OPERATIONS_UNAVAILABLE', 'Operations configuration is missing, oversized, or not a regular file.');
    return JSON.parse(await handle.readFile({ encoding: 'utf8' }));
  } catch (error) {
    if (error instanceof StudioError) throw error;
    throw new StudioError('OPERATIONS_UNAVAILABLE', 'Operations configuration could not be read safely.');
  } finally {
    await handle?.close();
  }
}

export async function validateOperationsConfiguration(configuration, {
  liveWorkspaceRoot,
  platform = process.platform,
} = {}) {
  exactKeys(configuration, ['schemaVersion', 'controlRoot', 'backupDestinations', 'restoreDestinations'], 'Operations configuration');
  invariant(configuration.schemaVersion === 1, 'OPERATIONS_UNAVAILABLE', 'Unsupported operations configuration schema.');
  invariant(typeof liveWorkspaceRoot === 'string' && isAbsolute(liveWorkspaceRoot),
    'BACKUP_PATH_UNSAFE', 'Live workspace root must be an absolute trusted coordinate.');
  invariant(Array.isArray(configuration.backupDestinations) && configuration.backupDestinations.length > 0,
    'OPERATIONS_UNAVAILABLE', 'At least one backup destination is required.');
  invariant(Array.isArray(configuration.restoreDestinations) && configuration.restoreDestinations.length > 0,
    'OPERATIONS_UNAVAILABLE', 'At least one restore-copy destination is required.');
  invariant(configuration.backupDestinations.length <= 32 && configuration.restoreDestinations.length <= 32,
    'OPERATIONS_UNAVAILABLE', 'Operations destination count exceeds the fixed limit.');
  for (const entry of configuration.backupDestinations) validateDestination(entry, 'Backup');
  for (const entry of configuration.restoreDestinations) validateDestination(entry, 'Restore');

  const allIds = [
    ...configuration.backupDestinations.map((entry) => entry.destinationId),
    ...configuration.restoreDestinations.map((entry) => entry.destinationId),
  ];
  invariant(new Set(allIds).size === allIds.length, 'BACKUP_PATH_UNSAFE', 'Destination IDs must be unique across registries.');

  const rawRoots = [
    { role: 'workspace', root: liveWorkspaceRoot },
    { role: 'control', root: configuration.controlRoot },
    ...configuration.backupDestinations.map((entry) => ({ role: 'backup', root: entry.root, entry })),
    ...configuration.restoreDestinations.map((entry) => ({ role: 'restore', root: entry.root, entry })),
  ];
  const roots = [];
  for (const candidate of rawRoots) {
    const canonical = await canonicalRoot(candidate.root, platform);
    roots.push({
      ...candidate,
      inspectionPath: canonical.inspectionPath,
      root: canonical.path,
      identity: canonical.identity,
    });
  }
  for (let left = 0; left < roots.length; left += 1) {
    for (let right = left + 1; right < roots.length; right += 1) {
      invariant(
        !pathsOverlap(roots[left].root, roots[right].root, platform),
        'BACKUP_PATH_UNSAFE',
        'Live, control, backup, and restore roots must be pairwise disjoint.',
      );
    }
  }

  const control = roots.find((entry) => entry.role === 'control');
  const workspace = roots.find((entry) => entry.role === 'workspace');
  const controlRoot = control.root;
  const workspaceRoot = workspace.root;
  const workspaceIdentity = workspace.identity;
  const backupRoots = roots.filter((entry) => entry.role === 'backup');
  const restoreRoots = roots.filter((entry) => entry.role === 'restore');
  return Object.freeze({
    schemaVersion: 1,
    controlRoot,
    controlInspectionPath: control.inspectionPath,
    workspaceRoot,
    workspaceInspectionPath: workspace.inspectionPath,
    workspaceIdentity,
    backupDestinations: Object.freeze(backupRoots.map(({ root, inspectionPath, entry }) => Object.freeze({
      destinationId: entry.destinationId,
      label: entry.label.trim(),
      root,
      inspectionPath,
    }))),
    restoreDestinations: Object.freeze(restoreRoots.map(({ root, inspectionPath, entry }) => Object.freeze({
      destinationId: entry.destinationId,
      label: entry.label.trim(),
      root,
      inspectionPath,
    }))),
  });
}

export function isPathWithin(root, candidate, platform = process.platform) {
  const normalizedRoot = normalizeForComparison(root, platform);
  const normalizedCandidate = normalizeForComparison(candidate, platform);
  const relation = relative(normalizedRoot, normalizedCandidate);
  return relation === '' || (!relation.startsWith(`..${sep}`) && relation !== '..' && !isAbsolute(relation));
}
