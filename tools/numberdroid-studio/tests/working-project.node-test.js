import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, link, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { startStudioHttpServer } from '../apps/studio-server/src/server.js';
import { assertPersistentLocation, createWorkingProject, inspectWorkingProject, WORKING_PROJECT_MANIFEST } from '../scripts/working-project.js';
import { stopChild } from '../scripts/start-worktree-studios.js';
import { fileURLToPath } from 'node:url';

const owner = { actor: { id: 'local.designer', kind: 'human', displayName: 'Local designer' }, taskId: null, grantId: null, branchId: 'branch.main' };
const close = (running) => new Promise((resolve, reject) => running.server.close((error) => error ? reject(error) : resolve()));
const start = (dataDirectory) => startStudioHttpServer({ dataDirectory, host: '127.0.0.1', port: 0, storeMode: 'sqlite', pairingEnabled: false, operationsConfigurationFilename: null });

async function fixture(context) {
  const root = await mkdtemp(join(tmpdir(), 'studio-working-project-test-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

async function fingerprint(root) {
  const hash = createHash('sha256');
  async function visit(path) {
    for (const entry of (await readdir(path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      hash.update(entry.name);
      if (entry.isDirectory()) await visit(join(path, entry.name));
      else hash.update(await readFile(join(path, entry.name)));
    }
  }
  await visit(root); return hash.digest('hex');
}

test('named project creates no demo and survives saved edits, shutdown, and reopen', { timeout: 20_000 }, async (context) => {
  const directory = join(await fixture(context), 'project');
  const identity = await createWorkingProject(directory, 'My room');
  let running = await start(directory);
  try {
    let project = await running.studioService.readProjectTrusted(identity.projectId);
    assert.equal(project.revision, 1);
    assert.equal(project.snapshot.project.name, 'My room');
    assert.deepEqual(project.snapshot.sources, []);
    await running.studioService.execute({
      schemaVersion: 1, commandId: 'working.saved-room', idempotencyKey: 'working.saved-room', type: 'room.archetype.create',
      projectId: identity.projectId, baseRevision: 1, expectedVersion: 1, dryRun: false,
      payload: {
        roomArchetypeId: 'archetype.saved-room', kind: 'room', displayName: 'Saved room', tags: [],
        dimensionPolicy: { width: { min: 3, preferred: 4, max: 16 }, height: { min: 3, preferred: 3, max: 16 } },
        structuralBands: { left: 0, right: 0, top: 0, bottom: 0 }, orientation: 'any',
        connectorPolicy: { min: 1, max: 8, requiredSides: [] }, allowedAssetKinds: ['surface', 'prop', 'item'],
        allowedTags: [], requiredTags: [], rationality: 'domestic',
        governingRuleRefs: [{ ruleId: 'gd.function-first', summary: 'Function before form.' }],
      },
    }, owner);
  } finally { await close(running); }
  const beforeInspection = await fingerprint(directory);
  assert.deepEqual(await inspectWorkingProject(directory), identity);
  assert.equal(await fingerprint(directory), beforeInspection);
  running = await start(directory);
  try {
    const project = await running.studioService.readProjectTrusted(identity.projectId);
    assert.equal(project.revision, 2);
    assert.equal(project.snapshot.roomLibrary.archetypes[0].displayName, 'Saved room');
    assert.equal(project.snapshot.project.name, 'My room');
  } finally { await close(running); }
});

test('new-project mode never adopts even an empty existing directory', async (context) => {
  const root = await fixture(context); const existing = join(root, 'existing'); await mkdir(existing);
  await assert.rejects(createWorkingProject(existing, 'Do not overwrite'), { code: 'EEXIST' });
  assert.deepEqual(await readdir(existing), []);
});

test('missing database, invalid identity and unknown directories stay unchanged', { timeout: 20_000 }, async (context) => {
  const root = await fixture(context);
  const unknown = join(root, 'unknown'); await mkdir(unknown); await writeFile(join(unknown, 'keep.txt'), 'Keep this');
  const beforeUnknown = await fingerprint(unknown);
  await assert.rejects(inspectWorkingProject(unknown), /no valid working-project identity/);
  assert.equal(await fingerprint(unknown), beforeUnknown);
  const directory = join(root, 'owned'); await createWorkingProject(directory, 'Owned');
  await rm(join(directory, 'studio.sqlite'));
  let before = await fingerprint(directory);
  await assert.rejects(inspectWorkingProject(directory), /incomplete/);
  assert.equal(await fingerprint(directory), before);
  await writeFile(join(directory, WORKING_PROJECT_MANIFEST), '{broken'); before = await fingerprint(directory);
  await assert.rejects(inspectWorkingProject(directory), /identity is invalid/);
  assert.equal(await fingerprint(directory), before);
});

test('backups and restored copies are refused before initialization or reopening', async (context) => {
  const root = await fixture(context);
  for (const marker of ['workspace-manifest.json', '.numberdroid-restored-copy-quarantine.json']) {
    const directory = join(root, marker.slice(1, 12)); await mkdir(directory); await writeFile(join(directory, marker), '{}');
    const before = await fingerprint(directory);
    await assert.rejects(inspectWorkingProject(directory), /backup|QUARANTINED/);
    await assert.rejects(createWorkingProject(join(directory, 'nested'), 'Forbidden'), /backup|QUARANTINED/);
    assert.equal(await fingerprint(directory), before);
  }
});

test('symlink or junction coordinates do not adopt another directory', async (context) => {
  const root = await fixture(context); const real = join(root, 'real'); await mkdir(real);
  const link = join(root, 'redirect');
  await symlink(real, link, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(createWorkingProject(join(link, 'new'), 'Forbidden'), /real directories|redirects/);
  await assert.rejects(inspectWorkingProject(link), /real directories|redirects/);
  assert.deepEqual(await readdir(real), []);
});

test('production CLI location policy refuses temporary directories and relative paths', async (context) => {
  const root = await fixture(context);
  await assert.rejects(assertPersistentLocation(join(root, 'persistent'), []), /temporary storage/);
  await assert.rejects(assertPersistentLocation('relative', []), /absolute path/);
});

test('second server cannot take over a working project and first writer remains usable', { timeout: 20_000 }, async (context) => {
  const directory = join(await fixture(context), 'project'); const identity = await createWorkingProject(directory, 'Exclusive');
  const running = await start(directory);
  try {
    await assert.rejects(start(directory), { code: 'SQLITE_WRITER_LOCKED' });
    assert.equal((await running.studioService.readProjectTrusted(identity.projectId)).revision, 1);
  } finally { await close(running); }
});

test('wrong project ID, wrong name, and foreign SQLite data are refused without changing the target', { timeout: 20_000 }, async (context) => {
  const root = await fixture(context); const directory = join(root, 'owned');
  const identity = await createWorkingProject(directory, 'Original');
  const manifestPath = join(directory, WORKING_PROJECT_MANIFEST);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  for (const changed of [{ ...manifest, name: 'Different name' }, { ...manifest, projectId: 'project.working.00000000-0000-0000-0000-000000000000' }]) {
    await writeFile(manifestPath, JSON.stringify(changed));
    const before = await fingerprint(directory);
    await assert.rejects(inspectWorkingProject(directory), /identity does not match/);
    assert.equal(await fingerprint(directory), before);
  }
  await writeFile(manifestPath, JSON.stringify(manifest));
  const foreign = join(root, 'foreign'); await createWorkingProject(foreign, 'Foreign');
  await copyFile(join(foreign, 'studio.sqlite'), join(directory, 'studio.sqlite'));
  const before = await fingerprint(directory);
  await assert.rejects(inspectWorkingProject(directory), /identity does not match/);
  assert.equal(await fingerprint(directory), before);
  assert.notEqual(identity.projectId, (await inspectWorkingProject(foreign)).projectId);
});

test('hardlinked database and sidecar files are refused without modifying either link', { timeout: 20_000 }, async (context) => {
  const root = await fixture(context); const directory = join(root, 'owned');
  await createWorkingProject(directory, 'Original');
  const database = join(directory, 'studio.sqlite'); const sibling = join(root, 'shared.sqlite');
  await link(database, sibling);
  let before = await fingerprint(root);
  await assert.rejects(inspectWorkingProject(directory), /multiply linked/);
  assert.equal(await fingerprint(root), before);
  await rm(sibling);
  const sidecar = join(directory, 'studio.sqlite-wal'); await writeFile(sidecar, 'sentinel');
  await link(sidecar, join(root, 'shared-wal'));
  before = await fingerprint(root);
  await assert.rejects(inspectWorkingProject(directory), /multiply linked/);
  assert.equal(await fingerprint(root), before);
});

test('database inspection includes saved WAL revisions without writing source sidecars', { timeout: 20_000 }, async (context) => {
  const directory = join(await fixture(context), 'project');
  const running = await start(directory);
  const projectId = 'project.working.11111111-1111-1111-1111-111111111111';
  try {
    await running.studioService.execute({
      schemaVersion: 1, commandId: 'create.wal', idempotencyKey: 'create.wal', type: 'project.create', projectId,
      baseRevision: 0, expectedVersion: 0, dryRun: false,
      payload: { name: 'Saved in WAL', ownerId: 'local.designer', description: '' },
    }, owner);
    await writeFile(join(directory, WORKING_PROJECT_MANIFEST), JSON.stringify({ schemaVersion: 1, kind: 'numberdroid-working-project', projectId, name: 'Saved in WAL' }));
    assert.ok((await readFile(join(directory, 'studio.sqlite-wal'))).length > 0);
    const before = await fingerprint(directory);
    assert.equal((await inspectWorkingProject(directory)).projectId, projectId);
    assert.equal(await fingerprint(directory), before);
  } finally { await close(running); }
});

test('private child IPC drains the real server and releases the writer for reopening', { timeout: 30_000 }, async (context) => {
  const directory = join(await fixture(context), 'project'); const identity = await createWorkingProject(directory, 'IPC shutdown');
  const serverPath = fileURLToPath(new URL('../apps/studio-server/src/server.js', import.meta.url));
  const environment = { ...process.env, NUMBERDROID_STUDIO_DATA: directory, NUMBERDROID_STUDIO_HOST: '127.0.0.1', NUMBERDROID_STUDIO_PORT: '0', NUMBERDROID_STUDIO_STORE: 'sqlite' };
  delete environment.NUMBERDROID_STUDIO_OPERATIONS_CONFIG;
  const child = spawn(process.execPath, [serverPath], {
    env: environment,
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  let acknowledgement = null; let stderr = '';
  child.on('message', (message) => { acknowledgement = message; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  try {
    await Promise.race([
      once(child.stdout, 'data'),
      once(child, 'exit').then(([code]) => { throw new Error(`Child exited before ready (${code}): ${stderr}`); }),
    ]);
    await stopChild({ child, log: { end() {} } });
    assert.deepEqual(acknowledgement, { type: 'numberdroid-studio-launcher-stopped', schemaVersion: 1, ok: true });
    assert.equal(child.exitCode, 0);
  } finally { await stopChild({ child, log: { end() {} } }); }
  const running = await start(directory);
  try { assert.equal((await running.studioService.readProjectTrusted(identity.projectId)).revision, 1); }
  finally { await close(running); }
});
