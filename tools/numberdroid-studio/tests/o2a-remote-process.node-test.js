import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startRemoteStudio } from '../apps/studio-remote/src/main.js';
import { createRemoteCredentialDocument } from '../apps/studio-remote/src/remote-credential.js';
import { REMOTE_MOUNT_MARKER_FILENAME } from '../apps/studio-remote/src/remote-config.js';

const require = createRequire(import.meta.url);
let sqliteAvailable = true;
try { require.resolve('better-sqlite3'); } catch { sqliteAvailable = false; }

function closeNodeServer(server) {
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

async function freePort() {
  const server = createServer((_request, response) => response.end());
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await closeNodeServer(server);
  return port;
}

async function remoteFixture(context, { port = null } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'numberdroid-o2a-process-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const roots = Object.fromEntries(['workspace', 'control', 'backups', 'restored']
    .map((name) => [name, join(root, name)]));
  await Promise.all(Object.values(roots).map((path) => mkdir(path, { mode: 0o700 })));
  const mounts = [
    ['workspace.primary', roots.workspace],
    ['control.primary', roots.control],
    ['backup.primary', roots.backups],
    ['restore.primary', roots.restored],
  ];
  await Promise.all(mounts.map(([mountId, mountRoot]) => writeFile(
    join(mountRoot, REMOTE_MOUNT_MARKER_FILENAME),
    `${JSON.stringify({ schemaVersion: 1, mountId })}\n`,
    { mode: 0o600 },
  )));
  const operationsConfigurationFile = join(root, 'operations.json');
  await writeFile(operationsConfigurationFile, `${JSON.stringify({
    schemaVersion: 1,
    controlRoot: roots.control,
    backupDestinations: [{ destinationId: 'backup.remote', label: 'Remote-host backups', root: roots.backups }],
    restoreDestinations: [{ destinationId: 'restore.remote', label: 'Remote-host restored copies', root: roots.restored }],
  })}\n`, { mode: 0o600 });
  const credentialFile = join(root, 'credential.json');
  await writeFile(credentialFile, `${JSON.stringify(
    await createRemoteCredentialDocument('correct horse battery staple'),
  )}\n`, { mode: 0o600 });
  const configurationFilename = join(root, 'remote.json');
  await writeFile(configurationFilename, `${JSON.stringify({
    schemaVersion: 1,
    publicOrigin: 'https://studio.example.test',
    listen: { host: '127.0.0.1', port: port ?? await freePort() },
    trustedProxyAddress: '127.0.0.1',
    workspaceRoot: roots.workspace,
    operationsConfigurationFile,
    credentialFile,
    mounts: mounts.map(([mountId, mountRoot]) => ({ mountId, root: mountRoot })),
  })}\n`, { mode: 0o600 });
  return { configurationFilename, roots };
}

function ingressHeaders(additional = {}) {
  return {
    'x-forwarded-proto': 'https',
    'x-forwarded-host': 'studio.example.test',
    'x-forwarded-for': '100.64.0.8',
    ...additional,
  };
}

async function login(origin) {
  const response = await fetch(`${origin}/remote/login`, {
    method: 'POST',
    redirect: 'manual',
    headers: ingressHeaders({
      origin: 'https://studio.example.test',
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/x-www-form-urlencoded',
    }),
    body: new URLSearchParams({ credential: 'correct horse battery staple' }),
  });
  assert.equal(response.status, 303);
  return response.headers.get('set-cookie').split(';', 1)[0];
}

async function seedLocalDemo(running) {
  const address = running.upstream.address();
  const origin = `http://127.0.0.1:${address.port}`;
  const csrf = await fetch(`${origin}/api/ui-session`).then((response) => response.json());
  const response = await fetch(`${origin}/api/demo`, {
    method: 'POST',
    headers: {
      origin,
      'sec-fetch-site': 'same-origin',
      'x-numberdroid-studio-csrf': csrf.csrfToken,
    },
  });
  assert.equal(response.status, 200);
}

test('O2a process authenticates read-only Studio, persists workspace across restart, and invalidates sessions', {
  timeout: 90_000,
  skip: !sqliteAvailable,
}, async (context) => {
  const fixture = await remoteFixture(context);
  let running = await startRemoteStudio(fixture);
  context.after(async () => { await running?.close(); });
  let origin = `http://127.0.0.1:${running.address.port}`;
  const firstCookie = await login(origin);
  let response = await fetch(`${origin}/remote/session`, {
    headers: ingressHeaders({ cookie: firstCookie }),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).session.csrfToken.length, 43);
  for (const path of ['/', '/app.js', '/remote-ui-mode.js', '/styles.css']) {
    response = await fetch(`${origin}${path}`, {
      headers: ingressHeaders({ cookie: firstCookie }),
    });
    assert.equal(response.status, 200, path);
  }
  await seedLocalDemo(running);
  response = await fetch(`${origin}/api/projects`, {
    headers: ingressHeaders({ cookie: firstCookie }),
  });
  assert.equal(response.status, 200);
  const projects = (await response.json()).projects;
  assert.equal(projects.length, 1);
  response = await fetch(`${origin}/api/ui-session`, {
    headers: ingressHeaders({ cookie: firstCookie }),
  });
  assert.equal(response.status, 404);
  response = await fetch(`${origin}/api/projects/${projects[0].projectId}/agent-access`, {
    headers: ingressHeaders({ cookie: firstCookie }),
  });
  assert.equal(response.status, 404);
  response = await fetch(`${origin}/api/backups`, {
    headers: ingressHeaders({ cookie: firstCookie }),
  });
  assert.equal(response.status, 404);

  await running.close();
  running = await startRemoteStudio(fixture);
  origin = `http://127.0.0.1:${running.address.port}`;
  response = await fetch(`${origin}/api/projects`, {
    headers: ingressHeaders({ cookie: firstCookie }),
  });
  assert.equal(response.status, 401);
  const secondCookie = await login(origin);
  response = await fetch(`${origin}/api/projects`, {
    headers: ingressHeaders({ cookie: secondCookie }),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).projects.length, 1);
});

test('O2a competing process and occupied gateway port fail closed and release startup locks', {
  timeout: 90_000,
  skip: !sqliteAvailable,
}, async (context) => {
  const port = await freePort();
  const fixture = await remoteFixture(context, { port });
  let running = await startRemoteStudio(fixture);
  context.after(async () => { await running?.close(); });
  await assert.rejects(startRemoteStudio(fixture), (error) => error.code === 'SQLITE_WRITER_LOCKED');
  await running.close();
  running = null;

  const blocker = createServer((_request, response) => response.end());
  await new Promise((resolve, reject) => {
    blocker.once('error', reject);
    blocker.listen(port, '127.0.0.1', resolve);
  });
  context.after(async () => { if (blocker.listening) await closeNodeServer(blocker); });
  await assert.rejects(startRemoteStudio(fixture), (error) => error.code === 'EADDRINUSE');
  await closeNodeServer(blocker);
  running = await startRemoteStudio(fixture);
  const response = await fetch(`http://127.0.0.1:${running.address.port}/readyz`);
  assert.equal(response.status, 200);
});
