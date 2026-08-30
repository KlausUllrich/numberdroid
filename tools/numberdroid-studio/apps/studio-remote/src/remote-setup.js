import { randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import {
  REMOTE_MOUNT_MARKER_FILENAME,
  isValidRemoteMountId,
} from './remote-config.js';
import { createRemoteCredentialDocument } from './remote-credential.js';

const TOKEN_BYTES = 32;

async function assertPrivateDirectory(path) {
  const absolute = resolve(path);
  let current = absolute;
  while (true) {
    const info = await lstat(current).catch(() => null);
    if (!info || !info.isDirectory() || info.isSymbolicLink()) {
      throw new Error('The setup path must use existing no-follow directories.');
    }
    if (current === absolute && process.platform !== 'win32' && (info.mode & 0o077) !== 0) {
      throw new Error('The setup directory must not grant group or other permissions.');
    }
    const parent = resolve(current, '..');
    if (parent === current) break;
    current = parent;
  }
  const canonical = await realpath(absolute);
  if (canonical !== absolute) throw new Error('The setup directory must be canonical.');
  return canonical;
}

async function writeExclusivePrivateJson(filename, value) {
  if (typeof filename !== 'string' || !isAbsolute(filename)) {
    throw new Error('The setup filename must be absolute.');
  }
  const absolute = resolve(filename);
  await assertPrivateDirectory(dirname(absolute));
  let handle;
  try {
    handle = await open(
      absolute,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0),
      0o600,
    );
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await handle.sync();
    const info = await handle.stat();
    if (!info.isFile() || (process.platform !== 'win32' && (info.mode & 0o7777) !== 0o600)) {
      throw new Error('The setup file could not be created with owner-only permissions.');
    }
  } finally {
    await handle?.close();
  }
  return absolute;
}

function secureToken(randomSource) {
  let bytes;
  try {
    bytes = randomSource(TOKEN_BYTES);
  } catch {
    throw new Error('Remote credential entropy is unavailable.');
  }
  if (!Buffer.isBuffer(bytes) || bytes.length !== TOKEN_BYTES) {
    throw new Error('Remote credential entropy is unavailable.');
  }
  try {
    return bytes.toString('base64url');
  } finally {
    bytes.fill(0);
  }
}

export async function createRemoteCredentialFile({
  filename,
  revealSecret,
  tokenRandomSource = randomBytes,
  verifierRandomSource = randomBytes,
} = {}) {
  if (typeof revealSecret !== 'function') {
    throw new TypeError('A private terminal secret sink is required.');
  }
  const secret = secureToken(tokenRandomSource);
  const document = await createRemoteCredentialDocument(secret, {
    randomSource: verifierRandomSource,
  });
  const path = await writeExclusivePrivateJson(filename, document);
  await revealSecret(secret);
  return Object.freeze({ path, revealed: true });
}

export async function createRemoteMountMarker({ root, mountId } = {}) {
  if (typeof root !== 'string' || !isAbsolute(root) || !isValidRemoteMountId(mountId)) {
    throw new Error('An absolute private root and a valid mount ID are required.');
  }
  const canonicalRoot = await assertPrivateDirectory(root);
  const path = await writeExclusivePrivateJson(
    join(canonicalRoot, REMOTE_MOUNT_MARKER_FILENAME),
    { schemaVersion: 1, mountId },
  );
  return Object.freeze({ path, root: canonicalRoot, mountId });
}
