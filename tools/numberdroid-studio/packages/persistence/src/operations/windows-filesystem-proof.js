import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StudioError, invariant } from '../../../domain/src/errors.js';

const MAX_HELPER_INPUT_BYTES = 16 * 1024;
const MAX_HELPER_OUTPUT_BYTES = 16 * 1024;
const HELPER_TIMEOUT_MS = 5000;
const WINDOWS_VOLUME_SERIAL_PATTERN = /^[A-F0-9]{16}$/;
const WINDOWS_FILE_ID_PATTERN = /^[A-F0-9]{32}$/;
const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const WINDOWS_INSPECT_HELPER = join(moduleDirectory, 'windows-root-inspect.ps1');
const WINDOWS_PUBLISH_HELPER = join(moduleDirectory, 'windows-publish.ps1');

function failure(code, message) {
  return new StudioError(code, message);
}

async function runFixedHelper(helper, payload, {
  spawnProcess,
  failureCode,
  timeoutMs = HELPER_TIMEOUT_MS,
  signal,
}) {
  if (signal !== undefined) AbortSignal.prototype.throwIfAborted.call(signal);
  const input = `${JSON.stringify(payload)}\n`;
  invariant(Buffer.byteLength(input) <= MAX_HELPER_INPUT_BYTES,
    failureCode, 'Windows filesystem proof input exceeds its fixed bound.');
  return new Promise((resolvePromise, rejectPromise) => {
    let child;
    let timer;
    let settled = false;
    let spawnConfirmed = false;
    let terminationReason = null;
    let abortListener = null;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (abortListener !== null) signal.removeEventListener('abort', abortListener);
      if (error !== null) rejectPromise(error); else resolvePromise(value);
    };
    try {
      child = spawnProcess('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', helper], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } catch {
      finish(failure(failureCode, 'Windows filesystem proof helper is unavailable.'));
      return;
    }

    const requestTermination = (reason) => {
      if (terminationReason === null) terminationReason = reason;
      try { child.kill(); } catch {}
    };

    if (signal !== undefined) {
      abortListener = () => {
        requestTermination(
          signal.reason ?? failure(failureCode, 'Windows filesystem proof was fenced.'),
        );
      };
      signal.addEventListener('abort', abortListener, { once: true });
      if (signal.aborted) abortListener();
    }

    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    timer = setTimeout(() => {
      requestTermination(
        terminationReason ?? failure(failureCode, 'Windows filesystem proof timed out.'),
      );
    }, timeoutMs);
    child.once('spawn', () => { spawnConfirmed = true; });
    child.on('error', () => {
      const helperError = failure(failureCode, 'Windows filesystem proof helper is unavailable.');
      if (!spawnConfirmed) {
        finish(terminationReason ?? helperError);
        return;
      }
      if (terminationReason === null) terminationReason = helperError;
    });
    child.stdin.on('error', () => {
      if (terminationReason === null) {
        requestTermination(failure(failureCode, 'Windows filesystem proof input failed.'));
      }
    });
    child.stdout.on('data', (chunk) => {
      if (terminationReason !== null) return;
      stdout = Buffer.concat([stdout, Buffer.from(chunk)]);
      if (stdout.length > MAX_HELPER_OUTPUT_BYTES) {
        requestTermination(failure(failureCode, 'Windows filesystem proof output exceeded its fixed bound.'));
      }
    });
    child.stderr.on('data', (chunk) => {
      if (terminationReason !== null) return;
      stderr = Buffer.concat([stderr, Buffer.from(chunk)]);
      if (stderr.length > MAX_HELPER_OUTPUT_BYTES) {
        requestTermination(failure(failureCode, 'Windows filesystem proof stderr exceeded its fixed bound.'));
      }
    });
    child.on('close', (code) => {
      if (settled) return;
      if (terminationReason !== null) {
        finish(terminationReason);
        return;
      }
      if (code !== 0 || stderr.length !== 0 || stdout.length === 0 || stdout.length > MAX_HELPER_OUTPUT_BYTES) {
        finish(failure(failureCode, 'Windows filesystem proof failed closed.'));
        return;
      }
      try {
        finish(null, JSON.parse(stdout.toString('utf8')));
      } catch {
        finish(failure(failureCode, 'Windows filesystem proof returned malformed output.'));
      }
    });
    child.stdin.end(input);
  });
}

function validateRootProof(proof) {
  invariant(proof && typeof proof === 'object' && !Array.isArray(proof),
    'BACKUP_PATH_UNSAFE', 'Windows root proof is invalid.');
  invariant(
    JSON.stringify(Object.keys(proof).sort())
      === JSON.stringify(['caseSensitive', 'code', 'fileId', 'filesystem', 'reparseTag', 'volumeSerial'].sort()),
    'BACKUP_PATH_UNSAFE',
    'Windows root proof contains unsupported fields.',
  );
  invariant(proof.code === 'OK' && proof.filesystem === 'NTFS'
      && proof.caseSensitive === false && proof.reparseTag === null
      && typeof proof.volumeSerial === 'string' && WINDOWS_VOLUME_SERIAL_PATTERN.test(proof.volumeSerial)
      && typeof proof.fileId === 'string' && WINDOWS_FILE_ID_PATTERN.test(proof.fileId),
  'BACKUP_PATH_UNSAFE', 'Windows root proof did not establish a safe local NTFS directory.');
  return Object.freeze({
    volumeSerial: proof.volumeSerial.toLowerCase(),
    fileId: proof.fileId.toLowerCase(),
  });
}

export async function inspectWindowsFilesystem(path, {
  expectedIdentity = null,
  inspectDescendants = false,
  spawnProcess = spawn,
  signal,
} = {}) {
  invariant(typeof path === 'string' && path.length > 0,
    'BACKUP_PATH_UNSAFE', 'Windows filesystem proof requires one fixed coordinate.');
  invariant(typeof inspectDescendants === 'boolean',
    'BACKUP_PATH_UNSAFE', 'Windows descendant proof mode is invalid.');
  if (expectedIdentity !== null) {
    invariant(expectedIdentity && typeof expectedIdentity === 'object'
        && typeof expectedIdentity.volumeSerial === 'string'
        && /^[a-f0-9]{16}$/.test(expectedIdentity.volumeSerial)
        && typeof expectedIdentity.fileId === 'string'
        && /^[a-f0-9]{32}$/.test(expectedIdentity.fileId),
    'BACKUP_PATH_UNSAFE', 'Expected Windows filesystem identity is invalid.');
  }
  const proof = validateRootProof(await runFixedHelper(WINDOWS_INSPECT_HELPER, {
    path,
    ...(inspectDescendants ? { inspectDescendants: true } : {}),
    ...(expectedIdentity ? {
      expectedVolumeSerial: expectedIdentity.volumeSerial,
      expectedFileId: expectedIdentity.fileId,
    } : {}),
  }, { spawnProcess, failureCode: 'BACKUP_PATH_UNSAFE', signal }));
  if (expectedIdentity !== null) {
    invariant(proof.volumeSerial === expectedIdentity.volumeSerial
        && proof.fileId === expectedIdentity.fileId,
    'BACKUP_PATH_UNSAFE', 'Windows filesystem identity changed.');
  }
  return proof;
}

export async function publishWindowsFilesystem(payload, { spawnProcess = spawn, signal } = {}) {
  const proof = await runFixedHelper(
    WINDOWS_PUBLISH_HELPER,
    payload,
    { spawnProcess, failureCode: 'BACKUP_DURABILITY_FAILED', signal },
  );
  invariant(proof && typeof proof === 'object' && !Array.isArray(proof)
      && JSON.stringify(Object.keys(proof)) === JSON.stringify(['code'])
      && ['OK', 'BACKUP_DESTINATION_CONFLICT', 'BACKUP_DURABILITY_FAILED', 'BACKUP_PATH_UNSAFE'].includes(proof.code),
  'BACKUP_DURABILITY_FAILED', 'Windows publication returned an invalid result.');
  return proof.code;
}
