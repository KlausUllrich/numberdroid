import { createRequire } from 'node:module';
import { StudioError } from '../../../domain/src/errors.js';

const require = createRequire(import.meta.url);

export function createBetterSqliteDatabase(filename, options = {}) {
  let BetterSqlite3;
  try {
    BetterSqlite3 = require('better-sqlite3');
  } catch (error) {
    throw new StudioError(
      'SQLITE_DRIVER_MISSING',
      'C1B SQLite persistence requires better-sqlite3. Install the pinned runtime dependency before starting the production adapter.',
      { dependency: 'better-sqlite3', cause: error.message },
    );
  }
  return new BetterSqlite3(filename, options);
}
