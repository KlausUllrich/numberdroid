import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StudioError, invariant } from '../../../domain/src/errors.js';

const migrationDirectory = resolve(dirname(fileURLToPath(import.meta.url)), 'migrations');

// Checksums are intentionally fixed. A changed applied migration is corruption,
// not an implicit migration update.
export const SQLITE_MIGRATIONS = Object.freeze([
  { version: 1, name: 'foundation', file: '0001_foundation.sql', checksum: 'd0cf252a36124689d84639777885d9e92ac9175acb4ee1251c1b9864742dc111' },
  { version: 2, name: 'artifacts', file: '0002_artifacts.sql', checksum: 'da4786083fa1418d6287e3c62cd0863c89e3fb14b8992d6bace785fba7ccda2f' },
  { version: 3, name: 'grant_authority', file: '0003_grant_authority.sql', checksum: '3db848e63b8e58e6851235a0cceb36d96c9c0e639798d8264b328c3834c57f3d' },
  { version: 4, name: 'host_bindings', file: '0004_host_bindings.sql', checksum: '20fa7666371cac545958d25d3c94db4a6653aa0f76e84ef61eb1f349e854acfc' },
]);

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

export async function loadMigrationDefinitions() {
  return Promise.all(SQLITE_MIGRATIONS.map(async (migration) => {
    const sql = await readFile(resolve(migrationDirectory, migration.file), 'utf8');
    const actualChecksum = sha256(sql);
    invariant(
      actualChecksum === migration.checksum,
      'MIGRATION_CHECKSUM_MISMATCH',
      `Migration ${migration.file} differs from its fixed checksum.`,
      { expected: migration.checksum, actual: actualChecksum },
    );
    return { ...migration, sql };
  }));
}

function currentUserVersion(database) {
  return Number(database.prepare('PRAGMA user_version').get().user_version);
}

export async function runSqliteMigrations(database, { faultInjector = null } = {}) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL
    ) STRICT
  `);
  const migrations = await loadMigrationDefinitions();
  const latestSupported = migrations.at(-1)?.version ?? 0;
  const userVersion = currentUserVersion(database);
  invariant(userVersion <= latestSupported, 'DATABASE_SCHEMA_TOO_NEW', 'Database schema is newer than this Studio build.', {
    userVersion,
    latestSupported,
  });

  const applied = database.prepare('SELECT version, name, checksum FROM schema_migrations ORDER BY version').all();
  for (const row of applied) {
    const known = migrations.find((migration) => migration.version === Number(row.version));
    invariant(known, 'UNKNOWN_APPLIED_MIGRATION', 'Database contains an unknown migration.', { version: row.version });
    invariant(row.checksum === known.checksum, 'MIGRATION_CHECKSUM_MISMATCH', 'Applied migration checksum differs.', {
      version: row.version,
      expected: known.checksum,
      actual: row.checksum,
    });
  }

  for (const migration of migrations.filter((candidate) => candidate.version > userVersion)) {
    database.exec('BEGIN EXCLUSIVE');
    try {
      faultInjector?.(`before_migration_${migration.version}`);
      database.exec(migration.sql);
      database.prepare(`
        INSERT INTO schema_migrations(version, name, checksum, applied_at)
        VALUES (?, ?, ?, ?)
      `).run(migration.version, migration.name, migration.checksum, new Date().toISOString());
      database.exec(`PRAGMA user_version = ${migration.version}`);
      faultInjector?.(`after_migration_${migration.version}`);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }
  return { schemaVersion: latestSupported, applied: migrations.map(({ version, name, checksum }) => ({ version, name, checksum })) };
}

export function assertSqliteVersion(database, expectedVersion = SQLITE_MIGRATIONS.at(-1).version) {
  const actual = currentUserVersion(database);
  if (actual !== expectedVersion) {
    throw new StudioError('DATABASE_SCHEMA_VERSION_MISMATCH', 'Unexpected SQLite schema version.', {
      expectedVersion,
      actual,
    });
  }
}
