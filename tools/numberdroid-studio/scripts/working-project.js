import { randomUUID } from 'node:crypto';
import { copyFile, lstat, mkdir, mkdtemp, open, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export const WORKING_PROJECT_MANIFEST = '.numberdroid-working-project.json';
const QUARANTINE = '.numberdroid-restored-copy-quarantine.json';
const BACKUP = 'workspace-manifest.json';
const fail = (message) => { throw new Error(message); };

async function verifyDatabaseIdentity(databasePath, manifest) {
  // SQLite readers of a WAL-mode source may create its -shm/-wal files. Inspect
  // only a bounded private copy; include WAL so saved crash-recovery data is read.
  const copies = [];
  for (const suffix of ['', '-wal']) {
    const path = `${databasePath}${suffix}`;
    const status = await statOrMissing(path);
    if (status) {
      if (!status.isFile() || status.isSymbolicLink() || status.nlink !== 1) fail('Working project database has an unsafe shared path.');
      copies.push({ path, suffix, status });
    }
  }
  if (copies.reduce((sum, { status }) => sum + status.size, 0) > 512 * 1024 * 1024) fail('Working project exceeds the bounded database inspection limit.');
  const scratch = await mkdtemp(join(tmpdir(), 'numberdroid-project-inspect-'));
  let database;
  try {
    for (const { path, suffix } of copies) await copyFile(path, join(scratch, `studio.sqlite${suffix}`));
    for (const { path, status } of copies) {
      const after = await lstat(path);
      if (after.dev !== status.dev || after.ino !== status.ino || after.nlink !== 1
          || after.size !== status.size || after.mtimeMs !== status.mtimeMs || after.ctimeMs !== status.ctimeMs) fail('Working project changed during inspection. Stop its current Studio process before reopening.');
    }
    if (Boolean(await statOrMissing(`${databasePath}-wal`)) !== copies.some(({ suffix }) => suffix === '-wal')) fail('Working project WAL changed during inspection. Stop its current Studio process before reopening.');
    const { createBetterSqliteDatabase } = await import('../packages/persistence/src/sqlite/sqlite-driver.js');
    const { SQLITE_MIGRATIONS } = await import('../packages/persistence/src/sqlite/migration-runner.js');
    database = createBetterSqliteDatabase(join(scratch, 'studio.sqlite'), { readonly: true, fileMustExist: true, timeout: 1000 });
    const version = database.prepare('PRAGMA user_version').get().user_version;
    const migrations = database.prepare('SELECT version, name, checksum FROM schema_migrations ORDER BY version').all();
    if (version < 1 || version > SQLITE_MIGRATIONS.at(-1).version || migrations.length !== version
        || migrations.some((row, index) => row.version !== index + 1 || row.name !== SQLITE_MIGRATIONS[index]?.name
          || row.checksum !== SQLITE_MIGRATIONS[index]?.checksum)) fail('Working project has an unsupported or incomplete Studio schema.');
    const project = database.prepare('SELECT head_revision, head_snapshot_json FROM projects WHERE project_id = ?').get(manifest.projectId);
    const snapshot = project ? JSON.parse(project.head_snapshot_json) : null;
    if (!project || snapshot?.project?.name !== manifest.name) fail('Working-project identity does not match its saved Studio project.');
    const revision = database.prepare('SELECT revision_json FROM revisions WHERE project_id = ? AND revision_number = ?').get(manifest.projectId, project.head_revision);
    if (!revision || JSON.parse(revision.revision_json)?.snapshot?.project?.name !== manifest.name) fail('Working project has no matching saved head revision.');
  } catch (error) {
    throw new Error(`Working project database verification failed. Existing data was left unchanged. ${error.message}`);
  } finally {
    try { database?.close(); } finally { await rm(scratch, { recursive: true, force: true }); }
  }
}

function within(parent, child) {
  const difference = relative(parent, child);
  return difference === '' || (difference !== '..' && !difference.startsWith(`..${sep}`) && !isAbsolute(difference));
}

async function statOrMissing(path) {
  try { return await lstat(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

export async function inspectDirectoryPath(path, { missingLeaf = false } = {}) {
  if (typeof path !== 'string' || !isAbsolute(path)) fail('Working project directory must be an absolute path.');
  const target = resolve(path);
  let current = parse(target).root;
  for (const part of relative(current, target).split(sep).filter(Boolean)) {
    current = join(current, part);
    const status = await statOrMissing(current);
    if (!status && missingLeaf && current === target) return target;
    if (!status || !status.isDirectory() || status.isSymbolicLink()) fail(`Working project path must contain only real directories: ${current}`);
    // Junctions/reparse redirection must not alias a different coordinate.
    const physical = await realpath(current);
    const equal = process.platform === 'win32'
      ? physical.toLowerCase() === current.toLowerCase() : physical === current;
    if (!equal) fail(`Working project path redirects to another directory: ${current}`);
    if (await statOrMissing(join(current, QUARANTINE))) fail('RESTORED_COPY_QUARANTINED: Restored copies cannot be opened as working projects.');
    if (await statOrMissing(join(current, BACKUP))) fail('A backup directory cannot be opened as a working project.');
  }
  return target;
}

// Production location policy belongs at the CLI boundary. Lower-level helpers
// can be verified with isolated OS-temporary fixtures without weakening it.
export async function assertPersistentLocation(path, worktreePaths) {
  const target = await inspectDirectoryPath(path, { missingLeaf: true });
  const temporaryRoots = new Set([resolve(tmpdir()), ...(process.platform === 'win32' ? [] : ['/tmp', '/var/tmp'])]);
  if ([...temporaryRoots].some((root) => within(root, target))) fail('Working projects must be outside temporary storage.');
  for (const worktree of worktreePaths) {
    const root = await realpath(worktree);
    if (within(root, target) || within(target, root)) fail('Working projects must be separate from every repository worktree.');
  }
  return target;
}

export function validateProjectName(value) {
  const name = String(value ?? '').trim();
  if (!name || name.length > 160 || /[\u0000-\u001f\u007f]/.test(name)) fail('Project name must contain 1–160 readable characters.');
  return name;
}

export async function inspectWorkingProject(directory) {
  const root = await inspectDirectoryPath(directory);
  const manifestPath = join(root, WORKING_PROJECT_MANIFEST);
  const manifestStat = await statOrMissing(manifestPath);
  if (!manifestStat?.isFile() || manifestStat.isSymbolicLink() || manifestStat.size > 4096) fail('This directory has no valid working-project identity. Existing data was left unchanged.');
  let manifest;
  try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')); } catch { fail('Working-project identity is invalid. Existing data was left unchanged.'); }
  if (Object.keys(manifest ?? {}).sort().join(',') !== 'kind,name,projectId,schemaVersion'
      || manifest.schemaVersion !== 1 || manifest.kind !== 'numberdroid-working-project'
      || typeof manifest.name !== 'string' || validateProjectName(manifest.name) !== manifest.name
      || !/^project\.working\.[0-9a-f-]{36}$/.test(manifest.projectId ?? '')) fail('Working-project identity is invalid. Existing data was left unchanged.');
  const database = join(root, 'studio.sqlite');
  const databaseStat = await statOrMissing(database);
  const artifactStat = await statOrMissing(join(root, 'artifacts'));
  if (!databaseStat?.isFile() || databaseStat.isSymbolicLink() || databaseStat.size < 4096
      || !artifactStat?.isDirectory() || artifactStat.isSymbolicLink()) fail('Working project is incomplete. Existing data was left unchanged.');
  // Reject unsafe descendants before the server can create a lock or open CAS.
  const pending = [root]; let inspected = 0;
  while (pending.length) {
    const parent = pending.pop();
    for (const entry of await readdir(parent, { withFileTypes: true })) {
      if (++inspected > 100_000) fail('Working project exceeds the bounded path inspection limit.');
      const path = join(parent, entry.name);
      const status = await lstat(path);
      if (status.isSymbolicLink() || (!status.isDirectory() && !status.isFile())
          || (status.isFile() && status.nlink !== 1)) fail(`Working project contains an unsafe or multiply linked path: ${path}`);
      if (status.isDirectory()) pending.push(await inspectDirectoryPath(path));
    }
  }
  const handle = await open(database, 'r');
  try {
    const bytes = Buffer.alloc(16); await handle.read(bytes, 0, 16, 0);
    if (!bytes.equals(Buffer.from('SQLite format 3\0'))) fail('Working project database is not a complete SQLite file.');
  } finally { await handle.close(); }
  await verifyDatabaseIdentity(database, manifest);
  return { directory: root, ...manifest };
}

export async function createWorkingProject(directory, rawName) {
  const name = validateProjectName(rawName);
  const root = await inspectDirectoryPath(directory, { missingLeaf: true });
  // mkdir is deliberately exclusive: even an empty existing directory is not adopted.
  await mkdir(root, { mode: 0o700 });
  const projectId = `project.working.${randomUUID()}`;
  const { startStudioHttpServer } = await import('../apps/studio-server/src/server.js');
  const running = await startStudioHttpServer({
    dataDirectory: root, host: '127.0.0.1', port: 0, storeMode: 'sqlite',
    pairingEnabled: false, operationsConfigurationFilename: null,
  });
  try {
    await running.studioService.execute({
      schemaVersion: 1, commandId: `create.${projectId}`, idempotencyKey: `create.${projectId}`,
      type: 'project.create', projectId, baseRevision: 0, expectedVersion: 0, dryRun: false,
      payload: { name, ownerId: 'local.designer', description: 'Persistent local authoring project.' },
    }, { actor: { id: 'local.designer', kind: 'human', displayName: 'Local designer' }, taskId: null, grantId: null, branchId: 'branch.main' });
  } finally { await new Promise((resolveClose, reject) => running.server.close((error) => error ? reject(error) : resolveClose())); }
  const manifest = { schemaVersion: 1, kind: 'numberdroid-working-project', projectId, name };
  await writeFile(join(root, WORKING_PROJECT_MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  return inspectWorkingProject(root);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [operation, directory, name] = process.argv.slice(2);
  if (operation !== '--create' || !directory || !name || process.argv.length !== 5) fail('Usage: working-project.js --create ABSOLUTE_NEW_DIRECTORY NAME');
  await createWorkingProject(directory, name);
  process.stdout.write('Named working project created.\n');
}
