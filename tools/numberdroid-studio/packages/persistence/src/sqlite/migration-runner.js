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
  { version: 5, name: 'agent_access_operations', file: '0005_agent_access_operations.sql', checksum: 'c9a47d62a420555a47571fa8d1513801b8b5c8a1b79638eadcc20346132519f3' },
  { version: 6, name: 'source_intakes_and_agent_attempts', file: '0006_source_intakes_and_agent_attempts.sql', checksum: 'f7b785a60bf02cd0d03944d4bd5983a4845bd715bf2a8a88f9c3ddf8c5a419f5' },
  { version: 7, name: 'jobs_and_job_events', file: '0007_jobs_and_job_events.sql', checksum: 'aa951c02158f76f6343819271b78816e211bfe3015cc9f4f979947a075ef25e9' },
  { version: 8, name: 'authorized_agent_attempts', file: '0008_authorized_agent_attempts.sql', checksum: '2323dafbef16e418b752ba1602c6d62c1260f00935212358980e6c3e90936730' },
  { version: 9, name: 'asset_library', file: '0009_asset_library.sql', checksum: 'e387c3e56fb0bb03bd14743c6a7c7a6baad230c02dde8f158e485e25776e7175' },
  { version: 10, name: 'room_designer', file: '0010_room_designer.sql', checksum: '99d12a3a7ee7572dd9386bd183fb847631ceab0490b0190e3ba5f1b339cfd40e' },
  { version: 11, name: 'agent_task_branches', file: '0011_agent_task_branches.sql', checksum: 'f6ed508f3098e6cdeb3dca2af0a9be7baca12c18fcd9d518f75f4f353242639d' },
  { version: 12, name: 'room_shape_cells', file: '0012_room_shape_cells.sql', checksum: '1e48171a0c70c4d015001287d254aad8359ea34970bddcb17168a8a368dd17e1' },
]);

export function migrationChecksum(sql) {
  // Git may materialize text files with CRLF on Windows. Line endings are not a
  // semantic migration change, so hash the repository's canonical LF form.
  const canonicalSql = sql.replaceAll('\r\n', '\n');
  return createHash('sha256').update(canonicalSql).digest('hex');
}

export async function loadMigrationDefinitions() {
  return Promise.all(SQLITE_MIGRATIONS.map(async (migration) => {
    const sql = await readFile(resolve(migrationDirectory, migration.file), 'utf8');
    const actualChecksum = migrationChecksum(sql);
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
