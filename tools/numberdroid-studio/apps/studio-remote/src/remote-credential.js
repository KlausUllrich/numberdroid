import { scrypt, timingSafeEqual, randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { StudioError, invariant } from '../../../packages/domain/src/errors.js';

export const REMOTE_CREDENTIAL_SCHEMA_VERSION = 1;
export const REMOTE_CREDENTIAL_ALGORITHM = 'scrypt';
export const REMOTE_CREDENTIAL_SCRYPT_PARAMETERS = Object.freeze({
  N: 32_768,
  r: 8,
  p: 1,
  keyLength: 32,
});

const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;
const SALT_BYTES = 16;
const MAX_CREDENTIAL_FILE_BYTES = 4 * 1024;
const MIN_NEW_SECRET_BYTES = 12;
const MAX_SECRET_BYTES = 1024;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

function isPlainRecord(value) {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype
      || Object.getPrototypeOf(value) === null);
}

function exactKeys(value, keys, label) {
  invariant(isPlainRecord(value), 'REMOTE_CREDENTIAL_INVALID', `${label} must be an object.`);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  invariant(
    Object.values(descriptors).every((descriptor) => 'value' in descriptor),
    'REMOTE_CREDENTIAL_INVALID',
    `${label} must contain data fields only.`,
  );
  invariant(
    JSON.stringify(Object.keys(descriptors).sort()) === JSON.stringify([...keys].sort()),
    'REMOTE_CREDENTIAL_INVALID',
    `${label} contains unsupported or missing fields.`,
  );
}

function canonicalBase64url(value, byteLength, label) {
  invariant(
    typeof value === 'string' && BASE64URL_PATTERN.test(value),
    'REMOTE_CREDENTIAL_INVALID',
    `${label} is invalid.`,
  );
  const bytes = Buffer.from(value, 'base64url');
  invariant(
    bytes.length === byteLength && bytes.toString('base64url') === value,
    'REMOTE_CREDENTIAL_INVALID',
    `${label} is invalid.`,
  );
  return bytes;
}

function secretBytes(secret, { creating = false } = {}) {
  invariant(
    typeof secret === 'string',
    'REMOTE_CREDENTIAL_INVALID',
    'Remote credential input is invalid.',
  );
  const byteLength = Buffer.byteLength(secret, 'utf8');
  invariant(
    byteLength >= (creating ? MIN_NEW_SECRET_BYTES : 1) && byteLength <= MAX_SECRET_BYTES,
    'REMOTE_CREDENTIAL_INVALID',
    'Remote credential input is invalid.',
  );
  return secret;
}

function derive(secret, salt) {
  const { N, r, p, keyLength } = REMOTE_CREDENTIAL_SCRYPT_PARAMETERS;
  return new Promise((resolvePromise, rejectPromise) => {
    scrypt(secret, salt, keyLength, {
      N,
      r,
      p,
      maxmem: SCRYPT_MAX_MEMORY,
    }, (error, derivedKey) => {
      if (error) rejectPromise(error);
      else resolvePromise(derivedKey);
    });
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

async function assertNoLinkAncestors(path) {
  let current = dirname(resolve(path));
  while (true) {
    let info;
    try {
      info = await lstat(current);
    } catch {
      throw new StudioError(
        'REMOTE_CREDENTIAL_UNAVAILABLE',
        'The remote credential path is unavailable.',
      );
    }
    invariant(
      info.isDirectory() && !info.isSymbolicLink(),
      'REMOTE_CREDENTIAL_UNAVAILABLE',
      'The remote credential path must have no link ancestors.',
    );
    const parent = resolve(current, '..');
    if (parent === current) return;
    current = parent;
  }
}

export function validateRemoteCredentialDocument(value) {
  try {
    exactKeys(
      value,
      ['schemaVersion', 'algorithm', 'parameters', 'salt', 'verifier'],
      'Remote credential document',
    );
    invariant(
      value.schemaVersion === REMOTE_CREDENTIAL_SCHEMA_VERSION
        && value.algorithm === REMOTE_CREDENTIAL_ALGORITHM,
      'REMOTE_CREDENTIAL_INVALID',
      'Unsupported remote credential schema or algorithm.',
    );
    exactKeys(value.parameters, ['N', 'r', 'p', 'keyLength'], 'scrypt parameters');
    invariant(
      value.parameters.N === REMOTE_CREDENTIAL_SCRYPT_PARAMETERS.N
        && value.parameters.r === REMOTE_CREDENTIAL_SCRYPT_PARAMETERS.r
        && value.parameters.p === REMOTE_CREDENTIAL_SCRYPT_PARAMETERS.p
        && value.parameters.keyLength === REMOTE_CREDENTIAL_SCRYPT_PARAMETERS.keyLength,
      'REMOTE_CREDENTIAL_INVALID',
      'Unsupported remote credential parameters.',
    );
    canonicalBase64url(value.salt, SALT_BYTES, 'Remote credential salt');
    canonicalBase64url(
      value.verifier,
      REMOTE_CREDENTIAL_SCRYPT_PARAMETERS.keyLength,
      'Remote credential verifier',
    );
    return Object.freeze({
      schemaVersion: REMOTE_CREDENTIAL_SCHEMA_VERSION,
      algorithm: REMOTE_CREDENTIAL_ALGORITHM,
      parameters: REMOTE_CREDENTIAL_SCRYPT_PARAMETERS,
      salt: value.salt,
      verifier: value.verifier,
    });
  } catch (error) {
    if (error instanceof StudioError) throw error;
    throw new StudioError('REMOTE_CREDENTIAL_INVALID', 'Remote credential document is invalid.');
  }
}

export async function createRemoteCredentialDocument(secret, {
  randomSource = randomBytes,
} = {}) {
  secretBytes(secret, { creating: true });
  invariant(
    typeof randomSource === 'function',
    'REMOTE_CREDENTIAL_INVALID',
    'Remote credential entropy source is unavailable.',
  );
  let salt;
  try {
    salt = randomSource(SALT_BYTES);
  } catch {
    throw new StudioError(
      'REMOTE_CREDENTIAL_INVALID',
      'Remote credential entropy source is unavailable.',
    );
  }
  invariant(
    Buffer.isBuffer(salt) && salt.length === SALT_BYTES,
    'REMOTE_CREDENTIAL_INVALID',
    'Remote credential entropy source is unavailable.',
  );
  let verifier;
  try {
    verifier = await derive(secret, salt);
  } catch {
    throw new StudioError('REMOTE_CREDENTIAL_INVALID', 'Remote credential derivation failed.');
  }
  try {
    return Object.freeze({
      schemaVersion: REMOTE_CREDENTIAL_SCHEMA_VERSION,
      algorithm: REMOTE_CREDENTIAL_ALGORITHM,
      parameters: REMOTE_CREDENTIAL_SCRYPT_PARAMETERS,
      salt: salt.toString('base64url'),
      verifier: verifier.toString('base64url'),
    });
  } finally {
    verifier.fill(0);
    salt.fill(0);
  }
}

export async function verifyRemoteCredential(secret, document) {
  const credential = validateRemoteCredentialDocument(document);
  try {
    secretBytes(secret);
  } catch {
    return false;
  }
  const salt = canonicalBase64url(credential.salt, SALT_BYTES, 'Remote credential salt');
  const expected = canonicalBase64url(
    credential.verifier,
    REMOTE_CREDENTIAL_SCRYPT_PARAMETERS.keyLength,
    'Remote credential verifier',
  );
  let actual;
  try {
    actual = await derive(secret, salt);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    throw new StudioError('REMOTE_CREDENTIAL_UNAVAILABLE', 'Remote credential verification failed.');
  } finally {
    actual?.fill(0);
    expected.fill(0);
    salt.fill(0);
  }
}

export async function readRemoteCredentialFile(filename, {
  platform = process.platform,
} = {}) {
  invariant(
    typeof filename === 'string' && isAbsolute(filename),
    'REMOTE_CREDENTIAL_UNAVAILABLE',
    'Remote credential filename must be absolute.',
  );
  const inspectionPath = resolve(filename);
  await assertNoLinkAncestors(inspectionPath);
  let handle;
  try {
    const before = await lstat(inspectionPath);
    invariant(
      before.isFile() && !before.isSymbolicLink(),
      'REMOTE_CREDENTIAL_UNAVAILABLE',
      'Remote credential must be a regular no-follow file.',
    );
    if (platform !== 'win32') {
      invariant(
        (before.mode & 0o7777) === 0o600,
        'REMOTE_CREDENTIAL_UNAVAILABLE',
        'Remote credential must have POSIX mode 0600.',
      );
    }
    handle = await open(inspectionPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const opened = await handle.stat();
    invariant(
      opened.isFile() && sameFileSnapshot(opened, before)
        && opened.size > 0 && opened.size <= MAX_CREDENTIAL_FILE_BYTES,
      'REMOTE_CREDENTIAL_UNAVAILABLE',
      'Remote credential is empty, oversized, or changed during verification.',
    );
    if (platform !== 'win32') {
      invariant(
        (opened.mode & 0o7777) === 0o600,
        'REMOTE_CREDENTIAL_UNAVAILABLE',
        'Remote credential must have POSIX mode 0600.',
      );
    }
    const bytes = await handle.readFile();
    const after = await lstat(inspectionPath);
    invariant(
      bytes.length === opened.size
        && after.isFile() && !after.isSymbolicLink()
        && sameFileSnapshot(after, opened),
      'REMOTE_CREDENTIAL_UNAVAILABLE',
      'Remote credential changed while it was read.',
    );
    if (platform !== 'win32') {
      invariant(
        (after.mode & 0o7777) === 0o600,
        'REMOTE_CREDENTIAL_UNAVAILABLE',
        'Remote credential must have POSIX mode 0600.',
      );
    }
    let parsed;
    try {
      parsed = JSON.parse(bytes.toString('utf8'));
    } catch {
      throw new StudioError('REMOTE_CREDENTIAL_INVALID', 'Remote credential document is invalid.');
    }
    return validateRemoteCredentialDocument(parsed);
  } catch (error) {
    if (error instanceof StudioError) throw error;
    throw new StudioError('REMOTE_CREDENTIAL_UNAVAILABLE', 'Remote credential could not be read safely.');
  } finally {
    await handle?.close();
  }
}
