import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { open } from 'node:fs/promises';
import { StudioError, invariant } from '../../../packages/domain/src/errors.js';

export const BACKUP_OPERATOR_COOKIE = 'numberdroid_backup_operator';
export const BACKUP_OPERATOR_COOKIE_PATH = '/api/backups';
export const BACKUP_BOOTSTRAP_TTL_MS = 10 * 60 * 1000;
export const BACKUP_BOOTSTRAP_MAX_FAILURES = 5;
export const BACKUP_OPERATOR_IDLE_TTL_MS = 15 * 60 * 1000;
export const BACKUP_OPERATOR_ABSOLUTE_TTL_MS = 8 * 60 * 60 * 1000;

const BOOTSTRAP_PATTERN = /^[A-Za-z0-9_-]{32}$/;
const OPERATOR_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function digest(value) {
  return createHash('sha256').update(value, 'utf8').digest();
}

function matchesDigest(value, expected, pattern) {
  if (typeof value !== 'string' || !pattern.test(value) || !Buffer.isBuffer(expected)) return false;
  const actual = digest(value);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function nowMilliseconds(clock) {
  const value = clock();
  const milliseconds = typeof value === 'number' ? value : Date.parse(value);
  invariant(Number.isFinite(milliseconds) && milliseconds >= 0,
    'OPERATIONS_UNAVAILABLE', 'The workspace-operator clock is unavailable.');
  return milliseconds;
}

export function generateWorkspaceOperatorBootstrapSecret(randomSource = randomBytes) {
  const bytes = randomSource(24);
  invariant(Buffer.isBuffer(bytes) && bytes.length === 24,
    'OPERATIONS_UNAVAILABLE', 'The workspace-operator bootstrap source is unavailable.');
  return bytes.toString('base64url');
}

export async function writeWorkspaceOperatorBootstrapSecret(secret, {
  platform = process.platform,
  openFile = open,
} = {}) {
  invariant(typeof secret === 'string' && BOOTSTRAP_PATTERN.test(secret),
    'OPERATIONS_UNAVAILABLE', 'The workspace-operator bootstrap is unavailable.');
  const terminal = platform === 'win32' ? 'CONOUT$' : '/dev/tty';
  let handle;
  try {
    handle = await openFile(terminal, 'w');
    await handle.writeFile(
      `Numberdroid Studio backup controls\nUnlock code: ${secret}\nExpires in 10 minutes; shown once.\n`,
      { encoding: 'utf8' },
    );
  } catch {
    throw new StudioError(
      'OPERATIONS_UNAVAILABLE',
      'Backup controls require an attached controlling terminal.',
    );
  } finally {
    try { await handle?.close(); } catch {}
  }
}

export function backupOperatorCookieToken(header) {
  if (typeof header !== 'string' || header.length === 0 || header.length > 4096) return null;
  const values = [];
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    if (name === BACKUP_OPERATOR_COOKIE) values.push(part.slice(separator + 1).trim());
  }
  return values.length === 1 && OPERATOR_TOKEN_PATTERN.test(values[0]) ? values[0] : null;
}

export function backupOperatorSetCookie(token) {
  invariant(typeof token === 'string' && OPERATOR_TOKEN_PATTERN.test(token),
    'OPERATIONS_UNAVAILABLE', 'The workspace-operator token is unavailable.');
  return `${BACKUP_OPERATOR_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=${BACKUP_OPERATOR_COOKIE_PATH}`;
}

export class WorkspaceOperatorSession {
  #clock;
  #randomSource;
  #bootstrapDigest;
  #bootstrapCreatedAt;
  #bootstrapFailures = 0;
  #operatorDigest = null;
  #operatorCreatedAt = null;
  #operatorLastSeenAt = null;
  #closed = false;

  constructor({
    bootstrapSecret,
    clock = Date.now,
    randomSource = randomBytes,
  } = {}) {
    invariant(typeof bootstrapSecret === 'string' && BOOTSTRAP_PATTERN.test(bootstrapSecret),
      'OPERATIONS_UNAVAILABLE', 'A 192-bit workspace-operator bootstrap is required.');
    invariant(typeof clock === 'function' && typeof randomSource === 'function',
      'OPERATIONS_UNAVAILABLE', 'Workspace-operator session dependencies are unavailable.');
    this.#clock = clock;
    this.#randomSource = randomSource;
    this.#bootstrapDigest = digest(bootstrapSecret);
    this.#bootstrapCreatedAt = nowMilliseconds(this.#clock);
  }

  #now() {
    return nowMilliseconds(this.#clock);
  }

  #bootstrapAvailable(now) {
    const available = !this.#closed
      && this.#bootstrapDigest !== null
      && this.#bootstrapFailures < BACKUP_BOOTSTRAP_MAX_FAILURES
      && now - this.#bootstrapCreatedAt < BACKUP_BOOTSTRAP_TTL_MS;
    if (!available) this.#bootstrapDigest = null;
    return available;
  }

  #operatorAvailable(now) {
    const available = !this.#closed
      && this.#operatorDigest !== null
      && now - this.#operatorCreatedAt < BACKUP_OPERATOR_ABSOLUTE_TTL_MS
      && now - this.#operatorLastSeenAt < BACKUP_OPERATOR_IDLE_TTL_MS;
    if (!available) {
      this.#operatorDigest = null;
      this.#operatorCreatedAt = null;
      this.#operatorLastSeenAt = null;
    }
    return available;
  }

  status(token = null) {
    const now = this.#now();
    if (this.#operatorAvailable(now) && matchesDigest(token, this.#operatorDigest, OPERATOR_TOKEN_PATTERN)) {
      this.#operatorLastSeenAt = now;
      return 'READY';
    }
    return this.#bootstrapAvailable(now) ? 'OPERATOR_LOCKED' : 'OPERATIONS_UNAVAILABLE';
  }

  exchange(secret) {
    const now = this.#now();
    if (!this.#bootstrapAvailable(now)) {
      throw new StudioError('OPERATIONS_UNAVAILABLE', 'Backup controls require a new local service bootstrap.');
    }
    if (!matchesDigest(secret, this.#bootstrapDigest, BOOTSTRAP_PATTERN)) {
      this.#bootstrapFailures += 1;
      if (this.#bootstrapFailures >= BACKUP_BOOTSTRAP_MAX_FAILURES) this.#bootstrapDigest = null;
      throw new StudioError('WORKSPACE_OPERATOR_FORBIDDEN', 'The backup-controls unlock code was not accepted.');
    }
    this.#bootstrapDigest = null;
    const tokenBytes = this.#randomSource(32);
    invariant(Buffer.isBuffer(tokenBytes) && tokenBytes.length === 32,
      'OPERATIONS_UNAVAILABLE', 'The workspace-operator token source is unavailable.');
    const token = tokenBytes.toString('base64url');
    this.#operatorDigest = digest(token);
    this.#operatorCreatedAt = now;
    this.#operatorLastSeenAt = now;
    return token;
  }

  authenticate(token) {
    const now = this.#now();
    if (!this.#operatorAvailable(now)) {
      if (!this.#bootstrapAvailable(now)) {
        throw new StudioError('OPERATIONS_UNAVAILABLE', 'Backup controls require a new local service bootstrap.');
      }
      throw new StudioError('WORKSPACE_OPERATOR_REQUIRED', 'A live local backup-controls session is required.');
    }
    if (!matchesDigest(token, this.#operatorDigest, OPERATOR_TOKEN_PATTERN)) {
      if (!this.#bootstrapAvailable(now)) {
        throw new StudioError('OPERATIONS_UNAVAILABLE', 'Backup controls require a new local service bootstrap.');
      }
      throw new StudioError('WORKSPACE_OPERATOR_REQUIRED', 'A live local backup-controls session is required.');
    }
    this.#operatorLastSeenAt = now;
  }

  close() {
    this.#closed = true;
    this.#bootstrapDigest = null;
    this.#operatorDigest = null;
    this.#operatorCreatedAt = null;
    this.#operatorLastSeenAt = null;
  }
}
