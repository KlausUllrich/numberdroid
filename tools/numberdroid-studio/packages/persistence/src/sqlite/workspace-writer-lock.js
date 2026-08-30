import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  readSync,
  unlinkSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { TextDecoder } from 'node:util';
import { StudioError, invariant } from '../../../domain/src/errors.js';
import { createBetterSqliteDatabase } from './sqlite-driver.js';

const LOCK_SUFFIX = '.writer.lock';
const SQLITE_HEADER = Buffer.from('SQLite format 3\0', 'binary');
const LEGACY_RECORD_MAX_BYTES = 4096;
const LOCK_KIND = 'numberdroid-workspace-writer';
const LOCK_SCHEMA_VERSION = 1;
const LOCK_SCHEMA_SQL = `
  CREATE TABLE lock_identity (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    schema_version INTEGER NOT NULL CHECK (schema_version = 1),
    lock_kind TEXT NOT NULL CHECK (lock_kind = '${LOCK_KIND}')
  ) STRICT
`;
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

function writerLocked(message = 'Another Studio process owns the authoritative SQLite writer.') {
  return new StudioError('SQLITE_WRITER_LOCKED', message);
}

function sqliteLockError(error) {
  return ['SQLITE_BUSY', 'SQLITE_LOCKED'].includes(error?.code)
    || /(?:database is locked|database table is locked)/i.test(error?.message ?? '');
}

function sameFileIdentity(left, right) {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.size === right.size
    && left.mtimeMs === right.mtimeMs
    && left.ctimeMs === right.ctimeMs;
}

function processState(pid) {
  try {
    process.kill(pid, 0);
    return 'RUNNING';
  } catch (error) {
    if (error?.code === 'EPERM') return 'RUNNING';
    if (error?.code === 'ESRCH') return 'EXITED';
    return 'UNKNOWN';
  }
}

function parseLegacyRecord(bytes) {
  let record;
  try {
    record = JSON.parse(utf8Decoder.decode(bytes));
  } catch {
    throw writerLocked('The authoritative SQLite writer lock state is malformed; Studio will not replace it.');
  }
  const keys = record && typeof record === 'object' && !Array.isArray(record)
    ? Object.keys(record).sort()
    : [];
  const openedAt = record?.openedAt;
  const openedAtMillis = typeof openedAt === 'string' ? Date.parse(openedAt) : Number.NaN;
  if (
    keys.length !== 2
    || keys[0] !== 'openedAt'
    || keys[1] !== 'pid'
    || !Number.isSafeInteger(record.pid)
    || record.pid <= 0
    || !Number.isFinite(openedAtMillis)
    || new Date(openedAtMillis).toISOString() !== openedAt
  ) {
    throw writerLocked('The authoritative SQLite writer lock state is malformed; Studio will not replace it.');
  }
  return record;
}

function readLockFile(lockPath) {
  let descriptor;
  let observedPath = false;
  try {
    const pathStatus = lstatSync(lockPath);
    observedPath = true;
    if (!pathStatus.isFile() || pathStatus.isSymbolicLink()) {
      throw writerLocked('The authoritative SQLite writer lock path is not a regular file.');
    }
    descriptor = openSync(lockPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const descriptorStatus = fstatSync(descriptor);
    if (!sameFileIdentity(pathStatus, descriptorStatus)) {
      throw writerLocked('The authoritative SQLite writer lock changed while it was inspected.');
    }
    const header = Buffer.alloc(SQLITE_HEADER.length);
    const headerBytes = readSync(descriptor, header, 0, header.length, 0);
    if (headerBytes === SQLITE_HEADER.length && header.equals(SQLITE_HEADER)) {
      return { kind: 'SQLITE', status: descriptorStatus };
    }
    if (descriptorStatus.size > LEGACY_RECORD_MAX_BYTES) {
      throw writerLocked('The authoritative SQLite writer lock state is malformed; Studio will not replace it.');
    }
    const bytes = readFileSync(descriptor);
    return { kind: 'LEGACY', bytes, status: descriptorStatus };
  } catch (error) {
    if (error?.code === 'ENOENT' && !observedPath) return { kind: 'MISSING' };
    if (error?.code === 'ENOENT') {
      throw writerLocked('The authoritative SQLite writer lock changed while it was inspected.');
    }
    if (error instanceof StudioError) throw error;
    throw writerLocked('The authoritative SQLite writer lock could not be inspected safely.');
  } finally {
    try { if (descriptor !== undefined) closeSync(descriptor); } catch {}
  }
}

function removeExitedLegacyRecord(lockPath, observation) {
  const current = readLockFile(lockPath);
  if (
    current.kind !== 'LEGACY'
    || !sameFileIdentity(observation.status, current.status)
    || !observation.bytes.equals(current.bytes)
  ) {
    throw writerLocked('The authoritative SQLite writer lock changed while legacy state was retired.');
  }
  try {
    unlinkSync(lockPath);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw writerLocked('The authoritative SQLite writer lock changed while legacy state was retired.');
    }
    throw writerLocked('The exited legacy SQLite writer lock could not be retired safely.');
  }
}

function prepareLockPath(lockPath) {
  const observation = readLockFile(lockPath);
  if (observation.kind === 'MISSING') return { mayInitialize: true };
  if (observation.kind === 'SQLITE') return { mayInitialize: false };
  const legacy = parseLegacyRecord(observation.bytes);
  const state = processState(legacy.pid);
  if (state !== 'EXITED') throw writerLocked();
  removeExitedLegacyRecord(lockPath, observation);
  return { mayInitialize: true };
}

function firstColumn(row) {
  return row && typeof row === 'object' ? Object.values(row)[0] : undefined;
}

function journalMode(database, assignment = '') {
  return String(firstColumn(database.prepare(`PRAGMA journal_mode${assignment}`).get()) ?? '').toLowerCase();
}

function initializeIdentity(database) {
  database.exec(LOCK_SCHEMA_SQL);
  database.prepare(`
    INSERT INTO lock_identity(singleton, schema_version, lock_kind)
    VALUES (1, ?, ?)
  `).run(LOCK_SCHEMA_VERSION, LOCK_KIND);
}

function assertIdentity(database, { mayInitialize }) {
  const objects = database.prepare(`
    SELECT type, name, sql
    FROM sqlite_schema
    WHERE name NOT LIKE 'sqlite_%'
    ORDER BY type, name
  `).all();
  if (objects.length === 0 && mayInitialize) {
    initializeIdentity(database);
    return;
  }
  if (
    objects.length !== 1
    || objects[0].type !== 'table'
    || objects[0].name !== 'lock_identity'
    || String(objects[0].sql).replaceAll(/\s+/gu, ' ').trim()
      !== LOCK_SCHEMA_SQL.replaceAll(/\s+/gu, ' ').trim()
  ) {
    throw writerLocked('The authoritative SQLite writer lock identity is invalid.');
  }
  const columns = database.prepare('PRAGMA table_info(lock_identity)').all()
    .map((column) => String(column.name));
  if (columns.join(',') !== 'singleton,schema_version,lock_kind') {
    throw writerLocked('The authoritative SQLite writer lock identity is invalid.');
  }
  const rows = database.prepare(`
    SELECT singleton, schema_version, lock_kind
    FROM lock_identity
  `).all();
  if (
    rows.length !== 1
    || Number(rows[0].singleton) !== 1
    || Number(rows[0].schema_version) !== LOCK_SCHEMA_VERSION
    || rows[0].lock_kind !== LOCK_KIND
  ) {
    throw writerLocked('The authoritative SQLite writer lock identity is invalid.');
  }
}

function databaseInTransaction(database) {
  if (typeof database?.inTransaction === 'boolean') return database.inTransaction;
  if (typeof database?.isTransaction === 'boolean') return database.isTransaction;
  return false;
}

/**
 * Process-lifetime workspace-writer lock backed by SQLite's operating-system lock.
 *
 * The rollback-journal lock file persists after close. A crashed process leaves
 * no stale ownership claim: the kernel releases the EXCLUSIVE transaction and
 * SQLite rolls it back when the next owner connects. The only file deletion is
 * the one-time transition of an exact legacy PID record whose process is proven
 * exited; malformed or ambiguous legacy state remains untouched and fails closed.
 */
export class WorkspaceWriterLock {
  #database;
  #closed = false;

  static async acquire({
    filename,
    databaseFactory = createBetterSqliteDatabase,
    busyTimeoutMs = 0,
  }) {
    invariant(typeof filename === 'string' && filename.length > 0, 'VALIDATION_ERROR', 'SQLite filename is required.');
    invariant(Number.isSafeInteger(busyTimeoutMs) && busyTimeoutMs >= 0, 'VALIDATION_ERROR', 'busyTimeoutMs must be a non-negative integer.');
    const lockPath = `${resolve(filename)}${LOCK_SUFFIX}`;
    const lockState = prepareLockPath(lockPath);
    let database;
    try {
      database = databaseFactory(lockPath, { timeout: busyTimeoutMs });
      database.exec(`PRAGMA busy_timeout = ${busyTimeoutMs}`);
      const mode = lockState.mayInitialize
        ? journalMode(database, ' = DELETE')
        : journalMode(database);
      if (mode !== 'delete') {
        throw writerLocked('The authoritative SQLite writer lock requires rollback-journal mode.');
      }
      database.exec('PRAGMA synchronous = FULL');
      assertIdentity(database, lockState);
      database.exec('BEGIN EXCLUSIVE');
      if (!databaseInTransaction(database)) {
        throw writerLocked('The authoritative SQLite writer lock transaction was not retained.');
      }
      return new WorkspaceWriterLock(database);
    } catch (error) {
      try { database?.exec('ROLLBACK'); } catch {}
      try { database?.close(); } catch {}
      if (sqliteLockError(error)) throw writerLocked();
      if (error instanceof StudioError) throw error;
      throw writerLocked('The authoritative SQLite writer lock could not be acquired safely.');
    }
  }

  constructor(database) {
    invariant(database && typeof database.exec === 'function', 'VALIDATION_ERROR', 'SQLite lock database is required.');
    this.#database = database;
  }

  get isHeld() {
    return !this.#closed && databaseInTransaction(this.#database);
  }

  close() {
    if (this.#closed) return;
    this.#closed = true;
    try { this.#database.exec('ROLLBACK'); } catch {}
    this.#database.close();
  }
}

export const WORKSPACE_WRITER_LOCK_SUFFIX = LOCK_SUFFIX;
