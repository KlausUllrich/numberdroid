import { join, resolve } from 'node:path';
import { StudioError, invariant } from '../../../domain/src/errors.js';
import { createBetterSqliteDatabase } from '../sqlite/sqlite-driver.js';

const LOCK_FILENAME = 'operations.lock';

function sqliteLockError(error) {
  return ['SQLITE_BUSY', 'SQLITE_LOCKED'].includes(error?.code)
    || /(?:database is locked|database table is locked)/i.test(error?.message ?? '');
}

/**
 * Process-lifetime operations lock backed by SQLite's operating-system lock.
 *
 * The file is deliberately never removed. A crashed process releases its
 * kernel lock and SQLite rolls back the open transaction when the next owner
 * connects, avoiding PID inspection and stale-file deletion races.
 */
export class OperationsLock {
  #database;
  #closed = false;

  static async acquire({
    controlRoot,
    databaseFactory = createBetterSqliteDatabase,
    busyTimeoutMs = 0,
  }) {
    invariant(typeof controlRoot === 'string' && controlRoot.length > 0, 'VALIDATION_ERROR', 'controlRoot is required.');
    invariant(Number.isSafeInteger(busyTimeoutMs) && busyTimeoutMs >= 0, 'VALIDATION_ERROR', 'busyTimeoutMs must be a non-negative integer.');
    const root = resolve(controlRoot);
    let database;
    try {
      database = databaseFactory(join(root, LOCK_FILENAME), { timeout: busyTimeoutMs });
      database.exec(`PRAGMA busy_timeout = ${busyTimeoutMs}`);
      const journalMode = String(database.pragma('journal_mode = DELETE', { simple: true })).toLowerCase();
      invariant(journalMode === 'delete', 'OPERATIONS_UNAVAILABLE', 'The operations lock requires SQLite rollback-journal mode.');
      database.pragma('synchronous = FULL');
      database.exec(`
        CREATE TABLE IF NOT EXISTS lock_identity (
          singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
          schema_version INTEGER NOT NULL CHECK (schema_version = 1)
        ) STRICT
      `);
      database.prepare(`
        INSERT INTO lock_identity(singleton, schema_version) VALUES (1, 1)
        ON CONFLICT(singleton) DO UPDATE SET schema_version = excluded.schema_version
      `).run();
      database.exec('BEGIN EXCLUSIVE');
      return new OperationsLock(database);
    } catch (error) {
      try { database?.exec('ROLLBACK'); } catch {}
      try { database?.close(); } catch {}
      if (sqliteLockError(error)) {
        throw new StudioError('OPERATIONS_UNAVAILABLE', 'Another Studio process owns the operations lock.');
      }
      if (error instanceof StudioError) throw error;
      throw new StudioError('OPERATIONS_UNAVAILABLE', 'The operations lock could not be acquired.');
    }
  }

  constructor(database) {
    invariant(database && typeof database.exec === 'function', 'VALIDATION_ERROR', 'SQLite lock database is required.');
    this.#database = database;
  }

  get isHeld() {
    if (this.#closed) return false;
    try {
      return this.#database.inTransaction === true;
    } catch {
      return false;
    }
  }

  close() {
    if (this.#closed) return;
    this.#closed = true;
    try { this.#database.exec('ROLLBACK'); } catch {}
    this.#database.close();
  }
}

export const OPERATIONS_LOCK_FILENAME = LOCK_FILENAME;
