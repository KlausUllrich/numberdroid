import { closeSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { access, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { StudioError, invariant } from '../../../domain/src/errors.js';
import { createBetterSqliteDatabase } from './sqlite-driver.js';
import { runSqliteMigrations } from './migration-runner.js';

function processExists(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function acquireWriterLock(filename) {
  const lockPath = `${filename}.writer.lock`;
  const attempt = () => {
    const descriptor = openSync(lockPath, 'wx', 0o600);
    writeFileSync(descriptor, JSON.stringify({ pid: process.pid, openedAt: new Date().toISOString() }));
    return { descriptor, lockPath };
  };
  try {
    return attempt();
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let stale = false;
    try {
      const record = JSON.parse(readFileSync(lockPath, 'utf8'));
      stale = !processExists(record.pid);
    } catch {
      stale = false;
    }
    if (stale) {
      unlinkSync(lockPath);
      return attempt();
    }
    throw new StudioError('SQLITE_WRITER_LOCKED', 'Another Studio process owns the authoritative SQLite writer.', {
      database: filename,
      lockPath,
    });
  }
}

function releaseWriterLock(lock) {
  if (!lock) return;
  try { closeSync(lock.descriptor); } catch {}
  try { unlinkSync(lock.lockPath); } catch {}
}

function quoteSqliteString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export class SqliteWorkspace {
  #database;
  #filename;
  #writerLock;
  #faultInjector;
  #closed = false;

  static async open({
    filename,
    databaseFactory = createBetterSqliteDatabase,
    mode = 'writer',
    busyTimeoutMs = 5000,
    faultInjector = null,
  }) {
    invariant(typeof filename === 'string' && filename.length > 0, 'VALIDATION_ERROR', 'SQLite filename is required.');
    invariant(['writer', 'reader'].includes(mode), 'VALIDATION_ERROR', 'SQLite mode must be writer or reader.');
    const absoluteFilename = resolve(filename);
    mkdirSync(dirname(absoluteFilename), { recursive: true, mode: 0o700 });
    const writerLock = mode === 'writer' ? acquireWriterLock(absoluteFilename) : null;
    let database;
    try {
      database = databaseFactory(absoluteFilename, { timeout: busyTimeoutMs, readonly: mode === 'reader' });
      database.exec(`PRAGMA busy_timeout = ${Number(busyTimeoutMs)}`);
      database.exec('PRAGMA foreign_keys = ON');
      if (mode === 'writer') {
        database.exec('PRAGMA journal_mode = WAL');
        database.exec('PRAGMA synchronous = FULL');
        database.exec('PRAGMA wal_autocheckpoint = 1000');
        await runSqliteMigrations(database, { faultInjector });
      }
      return new SqliteWorkspace({ database, filename: absoluteFilename, writerLock, faultInjector });
    } catch (error) {
      try { database?.close(); } catch {}
      releaseWriterLock(writerLock);
      throw error;
    }
  }

  constructor({ database, filename, writerLock, faultInjector }) {
    this.#database = database;
    this.#filename = filename;
    this.#writerLock = writerLock;
    this.#faultInjector = faultInjector;
  }

  get database() { return this.#database; }
  get filename() { return this.#filename; }
  get isWriter() { return Boolean(this.#writerLock); }

  fault(point) { this.#faultInjector?.(point); }

  transaction(operation) {
    invariant(this.isWriter, 'SQLITE_READ_ONLY', 'A read-only SQLite workspace cannot mutate state.');
    this.#database.exec('BEGIN IMMEDIATE');
    try {
      const result = operation(this.#database);
      this.#database.exec('COMMIT');
      return result;
    } catch (error) {
      try { this.#database.exec('ROLLBACK'); } catch {}
      throw error;
    }
  }

  readTransaction(operation) {
    this.#database.exec('BEGIN');
    try {
      const result = operation(this.#database);
      this.#database.exec('COMMIT');
      return result;
    } catch (error) {
      try { this.#database.exec('ROLLBACK'); } catch {}
      throw error;
    }
  }

  integrityCheck() {
    const integrity = this.#database.prepare('PRAGMA integrity_check').all().map((row) => Object.values(row)[0]);
    const foreignKeys = this.#database.prepare('PRAGMA foreign_key_check').all();
    return {
      ok: integrity.length === 1 && integrity[0] === 'ok' && foreignKeys.length === 0,
      integrity,
      foreignKeys,
      userVersion: Number(this.#database.prepare('PRAGMA user_version').get().user_version),
    };
  }

  checkpoint(mode = 'TRUNCATE') {
    invariant(['PASSIVE', 'FULL', 'RESTART', 'TRUNCATE'].includes(mode), 'VALIDATION_ERROR', 'Invalid WAL checkpoint mode.');
    return this.#database.prepare(`PRAGMA wal_checkpoint(${mode})`).get();
  }

  async backupTo(destination) {
    const absoluteDestination = resolve(destination);
    invariant(absoluteDestination !== this.#filename, 'VALIDATION_ERROR', 'Backup destination must differ from the live database.');
    await mkdir(dirname(absoluteDestination), { recursive: true, mode: 0o700 });
    try {
      await access(absoluteDestination);
      throw new StudioError('BACKUP_DESTINATION_EXISTS', 'Backup never overwrites an existing database.', {
        destination: absoluteDestination,
      });
    } catch (error) {
      if (error instanceof StudioError) throw error;
      if (error.code !== 'ENOENT') throw error;
    }
    try {
      this.#database.exec(`VACUUM INTO ${quoteSqliteString(absoluteDestination)}`);
      return absoluteDestination;
    } catch (error) {
      await rm(absoluteDestination, { force: true }).catch(() => {});
      throw error;
    }
  }

  close() {
    if (this.#closed) return;
    this.#closed = true;
    try {
      if (this.isWriter) this.checkpoint('TRUNCATE');
    } finally {
      try { this.#database.close(); } finally { releaseWriterLock(this.#writerLock); }
    }
  }
}
