import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { isIP } from 'node:net';
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';
import { StudioError, invariant } from '../../../packages/domain/src/errors.js';

export const REMOTE_CONFIGURATION_SCHEMA_VERSION = 1;
export const REMOTE_MOUNT_MARKER_FILENAME = '.numberdroid-studio-mount.json';

const MAX_CONFIGURATION_BYTES = 64 * 1024;
const MAX_MARKER_BYTES = 4 * 1024;
const MOUNT_ID_PATTERN = /^[a-z][a-z0-9._-]{2,63}$/;
const CONFIGURATION_KEYS = Object.freeze([
  'schemaVersion',
  'publicOrigin',
  'listen',
  'trustedProxyAddress',
  'workspaceRoot',
  'operationsConfigurationFile',
  'credentialFile',
  'mounts',
]);

function isPlainRecord(value) {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype
      || Object.getPrototypeOf(value) === null);
}

function exactKeys(value, keys, label) {
  invariant(isPlainRecord(value), 'REMOTE_CONFIGURATION_INVALID', `${label} must be an object.`);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  invariant(
    Object.values(descriptors).every((descriptor) => 'value' in descriptor),
    'REMOTE_CONFIGURATION_INVALID',
    `${label} must contain data fields only.`,
  );
  invariant(
    JSON.stringify(Object.keys(descriptors).sort()) === JSON.stringify([...keys].sort()),
    'REMOTE_CONFIGURATION_INVALID',
    `${label} contains unsupported or missing fields.`,
  );
}

function identityOf(info) {
  return Object.freeze({
    device: String(info.dev),
    inode: String(info.ino),
  });
}

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function sameFileSnapshot(left, right) {
  return sameIdentity(left, right)
    && left.size === right.size
    && left.mtimeMs === right.mtimeMs
    && left.ctimeMs === right.ctimeMs;
}

function normalizePathForComparison(path, platform) {
  const normalized = resolve(path).replaceAll('\\', '/').replace(/\/+$/, '') || '/';
  return platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function pathsOverlap(left, right, platform) {
  const normalizedLeft = normalizePathForComparison(left, platform);
  const normalizedRight = normalizePathForComparison(right, platform);
  const leftContainsRight = normalizedLeft === '/'
    ? normalizedRight.startsWith('/')
    : normalizedRight.startsWith(`${normalizedLeft}/`);
  const rightContainsLeft = normalizedRight === '/'
    ? normalizedLeft.startsWith('/')
    : normalizedLeft.startsWith(`${normalizedRight}/`);
  return normalizedLeft === normalizedRight
    || leftContainsRight
    || rightContainsLeft;
}

async function assertNoLinkAncestors(path, { includeFinalDirectory = false } = {}) {
  let current = includeFinalDirectory ? resolve(path) : dirname(resolve(path));
  while (true) {
    let info;
    try {
      info = await lstat(current);
    } catch {
      throw new StudioError(
        'REMOTE_CONFIGURATION_INVALID',
        'A configured path or one of its ancestors is unavailable.',
      );
    }
    invariant(
      info.isDirectory() && !info.isSymbolicLink(),
      'REMOTE_CONFIGURATION_INVALID',
      'Configured paths and their ancestors must be no-follow directories.',
    );
    const parent = resolve(current, '..');
    if (parent === current) return;
    current = parent;
  }
}

async function inspectNoFollowDirectory(path, { platform = process.platform } = {}) {
  invariant(
    typeof path === 'string' && isAbsolute(path),
    'REMOTE_CONFIGURATION_INVALID',
    'Configured mount roots must be absolute.',
  );
  const inspectionPath = resolve(path);
  await assertNoLinkAncestors(inspectionPath, { includeFinalDirectory: true });
  let canonicalPath;
  try {
    canonicalPath = await realpath(inspectionPath);
  } catch {
    throw new StudioError('REMOTE_CONFIGURATION_INVALID', 'A configured mount root is unavailable.');
  }
  const before = await lstat(canonicalPath);
  invariant(
    before.isDirectory() && !before.isSymbolicLink(),
    'REMOTE_CONFIGURATION_INVALID',
    'Configured mount roots must be existing no-follow directories.',
  );
  if (platform !== 'win32') {
    invariant(
      (before.mode & 0o077) === 0,
      'REMOTE_CONFIGURATION_INVALID',
      'Configured mount roots must not grant group or other permissions.',
    );
  }

  // Linux is the first O2 deployment target. Holding a directory handle there
  // closes the final-component swap window; Windows still receives the two
  // lstat/realpath identity checks below and no remote deployment authority.
  let handle;
  try {
    if (platform !== 'win32') {
      handle = await open(
        canonicalPath,
        constants.O_RDONLY | (constants.O_DIRECTORY ?? 0) | (constants.O_NOFOLLOW ?? 0),
      );
      const opened = await handle.stat();
      invariant(
        opened.isDirectory() && sameIdentity(opened, before),
        'REMOTE_CONFIGURATION_INVALID',
        'A configured mount root changed during verification.',
      );
    }
    const after = await lstat(canonicalPath);
    invariant(
      after.isDirectory() && !after.isSymbolicLink() && sameIdentity(after, before),
      'REMOTE_CONFIGURATION_INVALID',
      'A configured mount root changed during verification.',
    );
  } catch (error) {
    if (error instanceof StudioError) throw error;
    throw new StudioError('REMOTE_CONFIGURATION_INVALID', 'A configured mount root is unavailable.');
  } finally {
    await handle?.close();
  }
  return Object.freeze({
    inspectionPath,
    root: canonicalPath,
    identity: identityOf(before),
  });
}

async function readNoFollowFile(filename, {
  maxBytes,
  label,
  ownerOnly = false,
  platform = process.platform,
} = {}) {
  invariant(
    typeof filename === 'string' && isAbsolute(filename),
    'REMOTE_CONFIGURATION_INVALID',
    `${label} filename must be absolute.`,
  );
  const inspectionPath = resolve(filename);
  await assertNoLinkAncestors(inspectionPath);
  let handle;
  try {
    const before = await lstat(inspectionPath);
    invariant(
      before.isFile() && !before.isSymbolicLink(),
      'REMOTE_CONFIGURATION_INVALID',
      `${label} must be a regular no-follow file.`,
    );
    if (ownerOnly && platform !== 'win32') {
      invariant(
        (before.mode & 0o7777) === 0o600,
        'REMOTE_CONFIGURATION_INVALID',
        `${label} must have POSIX mode 0600.`,
      );
    }
    handle = await open(inspectionPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const opened = await handle.stat();
    invariant(
      opened.isFile() && sameFileSnapshot(opened, before)
        && opened.size > 0 && opened.size <= maxBytes,
      'REMOTE_CONFIGURATION_INVALID',
      `${label} is empty, oversized, or changed during verification.`,
    );
    const bytes = await handle.readFile();
    invariant(
      bytes.length === opened.size && bytes.length <= maxBytes,
      'REMOTE_CONFIGURATION_INVALID',
      `${label} changed while it was read.`,
    );
    const after = await lstat(inspectionPath);
    invariant(
      after.isFile() && !after.isSymbolicLink() && sameFileSnapshot(after, opened),
      'REMOTE_CONFIGURATION_INVALID',
      `${label} changed while it was read.`,
    );
    return Object.freeze({
      bytes,
      inspectionPath,
      path: await realpath(inspectionPath),
      identity: identityOf(opened),
    });
  } catch (error) {
    if (error instanceof StudioError) throw error;
    throw new StudioError('REMOTE_CONFIGURATION_INVALID', `${label} could not be read safely.`);
  } finally {
    await handle?.close();
  }
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new StudioError('REMOTE_CONFIGURATION_INVALID', `${label} is not valid JSON.`);
  }
}

function canonicalPublicOrigin(value) {
  invariant(
    typeof value === 'string' && value.length >= 9 && value.length <= 2048,
    'REMOTE_CONFIGURATION_INVALID',
    'publicOrigin must be a bounded canonical HTTPS origin.',
  );
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new StudioError(
      'REMOTE_CONFIGURATION_INVALID',
      'publicOrigin must be a bounded canonical HTTPS origin.',
    );
  }
  invariant(
    parsed.protocol === 'https:'
      && parsed.username === ''
      && parsed.password === ''
      && parsed.pathname === '/'
      && parsed.search === ''
      && parsed.hash === ''
      && parsed.origin === value,
    'REMOTE_CONFIGURATION_INVALID',
    'publicOrigin must be a canonical HTTPS origin without credentials, path, query, or fragment.',
  );
  return parsed.origin;
}

function canonicalLoopbackAddress(value) {
  invariant(
    typeof value === 'string' && value.length > 0 && value.length <= 64,
    'REMOTE_CONFIGURATION_INVALID',
    'trustedProxyAddress must name exactly one loopback IP address.',
  );
  const mapped = /^::ffff:(127(?:\.\d{1,3}){3})$/i.exec(value);
  const candidate = mapped?.[1] ?? value;
  const family = isIP(candidate);
  const ipv4Loopback = family === 4 && candidate === '127.0.0.1';
  const ipv6Loopback = family === 6 && candidate === '::1';
  invariant(
    ipv4Loopback || ipv6Loopback,
    'REMOTE_CONFIGURATION_INVALID',
    'trustedProxyAddress must name exactly one loopback IP address.',
  );
  return candidate;
}

function validateListen(value) {
  exactKeys(value, ['host', 'port'], 'listen');
  invariant(
    value.host === '127.0.0.1' || value.host === '::1',
    'REMOTE_CONFIGURATION_INVALID',
    'The remote gateway listener must remain on an exact loopback host.',
  );
  invariant(
    Number.isSafeInteger(value.port) && value.port >= 1 && value.port <= 65_535,
    'REMOTE_CONFIGURATION_INVALID',
    'The remote gateway listener port is invalid.',
  );
  return Object.freeze({ host: value.host, port: value.port });
}

function validateMountInput(value) {
  exactKeys(value, ['mountId', 'root'], 'mount');
  invariant(
    typeof value.mountId === 'string' && MOUNT_ID_PATTERN.test(value.mountId),
    'REMOTE_CONFIGURATION_INVALID',
    'mountId is invalid.',
  );
  invariant(
    typeof value.root === 'string' && isAbsolute(value.root),
    'REMOTE_CONFIGURATION_INVALID',
    'Mount roots must be absolute.',
  );
}

export function isValidRemoteMountId(value) {
  return typeof value === 'string' && MOUNT_ID_PATTERN.test(value);
}

async function validateMount(value, options) {
  validateMountInput(value);
  const root = await inspectNoFollowDirectory(value.root, options);
  const markerPath = join(root.root, REMOTE_MOUNT_MARKER_FILENAME);
  const markerFile = await readNoFollowFile(markerPath, {
    maxBytes: MAX_MARKER_BYTES,
    label: 'Mount marker',
    ownerOnly: true,
    platform: options.platform,
  });
  const marker = parseJson(markerFile.bytes, 'Mount marker');
  exactKeys(marker, ['schemaVersion', 'mountId'], 'Mount marker');
  invariant(
    marker.schemaVersion === REMOTE_CONFIGURATION_SCHEMA_VERSION
      && marker.mountId === value.mountId,
    'REMOTE_CONFIGURATION_INVALID',
    'The mount marker does not match its configured identity.',
  );
  return Object.freeze({
    mountId: value.mountId,
    root: root.root,
    inspectionPath: root.inspectionPath,
    identity: root.identity,
    marker: Object.freeze({
      path: markerFile.path,
      identity: markerFile.identity,
      schemaVersion: REMOTE_CONFIGURATION_SCHEMA_VERSION,
      mountId: value.mountId,
    }),
  });
}

async function inspectReferencedFile(filename, label, { platform = process.platform } = {}) {
  const file = await readNoFollowFile(filename, {
    maxBytes: MAX_CONFIGURATION_BYTES,
    label,
    ownerOnly: true,
    platform,
  });
  return Object.freeze({
    path: file.path,
    inspectionPath: file.inspectionPath,
    identity: file.identity,
  });
}

export async function validateRemoteConfiguration(value, {
  platform = process.platform,
} = {}) {
  try {
    exactKeys(value, CONFIGURATION_KEYS, 'Remote configuration');
    invariant(
      value.schemaVersion === REMOTE_CONFIGURATION_SCHEMA_VERSION,
      'REMOTE_CONFIGURATION_INVALID',
      'Unsupported remote configuration schema.',
    );
    const publicOrigin = canonicalPublicOrigin(value.publicOrigin);
    const listen = validateListen(value.listen);
    const trustedProxyAddress = canonicalLoopbackAddress(value.trustedProxyAddress);
    invariant(
      typeof value.workspaceRoot === 'string' && isAbsolute(value.workspaceRoot),
      'REMOTE_CONFIGURATION_INVALID',
      'workspaceRoot must be absolute.',
    );
    invariant(
      Array.isArray(value.mounts) && value.mounts.length >= 1 && value.mounts.length <= 32,
      'REMOTE_CONFIGURATION_INVALID',
      'Remote configuration requires between one and 32 explicit mounts.',
    );
    for (const mount of value.mounts) validateMountInput(mount);
    invariant(
      new Set(value.mounts.map((mount) => mount.mountId)).size === value.mounts.length,
      'REMOTE_CONFIGURATION_INVALID',
      'mountId values must be unique.',
    );

    const mounts = [];
    for (const mount of value.mounts) mounts.push(await validateMount(mount, { platform }));
    for (let left = 0; left < mounts.length; left += 1) {
      for (let right = left + 1; right < mounts.length; right += 1) {
        invariant(
          !pathsOverlap(mounts[left].root, mounts[right].root, platform)
            && !(mounts[left].identity.device === mounts[right].identity.device
              && mounts[left].identity.inode === mounts[right].identity.inode),
          'REMOTE_CONFIGURATION_INVALID',
          'Configured mount roots must be pairwise disjoint and distinct.',
        );
      }
    }

    const workspace = await inspectNoFollowDirectory(value.workspaceRoot, { platform });
    const workspaceMount = mounts.find((mount) => (
      normalizePathForComparison(mount.root, platform)
        === normalizePathForComparison(workspace.root, platform)
      && mount.identity.device === workspace.identity.device
      && mount.identity.inode === workspace.identity.inode
    ));
    invariant(
      workspaceMount,
      'REMOTE_CONFIGURATION_INVALID',
      'workspaceRoot must be one of the explicitly marked mounts.',
    );

    const operationsConfiguration = await inspectReferencedFile(
      value.operationsConfigurationFile,
      'Operations configuration',
      { platform },
    );
    const credential = await inspectReferencedFile(
      value.credentialFile,
      'Remote credential',
      { platform },
    );

    return Object.freeze({
      schemaVersion: REMOTE_CONFIGURATION_SCHEMA_VERSION,
      publicOrigin,
      listen,
      trustedProxyAddress,
      workspaceRoot: workspace.root,
      workspaceIdentity: workspace.identity,
      workspaceMountId: workspaceMount.mountId,
      operationsConfigurationFile: operationsConfiguration.path,
      operationsConfigurationIdentity: operationsConfiguration.identity,
      credentialFile: credential.path,
      credentialIdentity: credential.identity,
      mounts: Object.freeze(mounts),
    });
  } catch (error) {
    if (error instanceof StudioError) throw error;
    throw new StudioError(
      'REMOTE_CONFIGURATION_INVALID',
      'Remote configuration could not be validated safely.',
    );
  }
}

export async function readRemoteConfigurationFile(filename, options = {}) {
  const configurationFile = await readNoFollowFile(filename, {
    maxBytes: MAX_CONFIGURATION_BYTES,
    label: 'Remote configuration',
    ownerOnly: true,
    platform: options.platform ?? process.platform,
  });
  const validated = await validateRemoteConfiguration(
    parseJson(configurationFile.bytes, 'Remote configuration'),
    options,
  );
  return Object.freeze({
    ...validated,
    configurationFile: configurationFile.path,
    configurationIdentity: configurationFile.identity,
  });
}

export function isRemotePathWithin(root, candidate, platform = process.platform) {
  const normalizedRoot = normalizePathForComparison(root, platform);
  const normalizedCandidate = normalizePathForComparison(candidate, platform);
  const relation = relative(normalizedRoot, normalizedCandidate);
  return relation === ''
    || (!relation.startsWith(`..${sep}`) && relation !== '..' && !isAbsolute(relation));
}
