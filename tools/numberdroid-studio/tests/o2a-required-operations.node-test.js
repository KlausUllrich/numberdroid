import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startStudioHttpServer } from '../apps/studio-server/src/server.js';

async function fixture(context) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'numberdroid-o2a-required-operations-')));
  context.after(() => rm(root, { recursive: true, force: true }));
  const roots = Object.fromEntries(['live', 'control', 'backups', 'restored-copies']
    .map((name) => [name, join(root, name)]));
  await Promise.all(Object.values(roots).map((path) => mkdir(path, { mode: 0o700 })));
  const configurationFilename = join(root, 'operations.json');
  await writeFile(configurationFilename, JSON.stringify({
    schemaVersion: 1,
    controlRoot: roots.control,
    backupDestinations: [{
      destinationId: 'backup.o2a',
      label: 'O2a backups',
      root: roots.backups,
    }],
    restoreDestinations: [{
      destinationId: 'restore.o2a',
      label: 'O2a restored copies',
      root: roots['restored-copies'],
    }],
  }), { mode: 0o600 });
  return { roots, configurationFilename };
}

function closeServer(server) {
  if (!server.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections?.();
  });
}

test('O2a required operations rejects missing configuration before creating workspace data', { timeout: 10_000 }, async (context) => {
  const { roots } = await fixture(context);
  await assert.rejects(startStudioHttpServer({
    dataDirectory: roots.live,
    storeMode: 'sqlite',
    port: 0,
    operationsStartupPolicy: 'required',
  }), { code: 'OPERATIONS_UNAVAILABLE' });
});

test('O2a required operations propagates bootstrap/runtime failure and releases every startup lock', { timeout: 20_000 }, async (context) => {
  const { roots, configurationFilename } = await fixture(context);
  await assert.rejects(startStudioHttpServer({
    dataDirectory: roots.live,
    port: 0,
    operationsConfigurationFilename: configurationFilename,
    operationsStartupPolicy: 'required',
    pairingEnabled: false,
    operationsBootstrapWriter: async () => { throw new Error('injected bootstrap sink failure'); },
  }), /injected bootstrap sink failure/);

  const running = await startStudioHttpServer({
    dataDirectory: roots.live,
    port: 0,
    operationsConfigurationFilename: configurationFilename,
    operationsStartupPolicy: 'required',
    pairingEnabled: false,
    operationsBootstrapSecret: Buffer.alloc(24, 0x61).toString('base64url'),
  });
  context.after(() => closeServer(running.server));
  const response = await fetch(`http://127.0.0.1:${running.address.port}/api/backups`);
  assert.equal(response.status, 401);
});

test('O2a required operations rejects JSON composition and invalid policy before opening a listener', { timeout: 10_000 }, async (context) => {
  const { roots, configurationFilename } = await fixture(context);
  await assert.rejects(startStudioHttpServer({
    dataDirectory: roots.live,
    storeMode: 'json',
    port: 0,
    operationsConfigurationFilename: configurationFilename,
    operationsStartupPolicy: 'required',
  }), { code: 'OPERATIONS_UNAVAILABLE' });
  await assert.rejects(startStudioHttpServer({
    dataDirectory: roots.live,
    port: 0,
    operationsStartupPolicy: 'best-effort',
  }), { name: 'TypeError' });
  await assert.rejects(startStudioHttpServer({
    dataDirectory: roots.live,
    port: 0,
    operationsConfigurationFilename: configurationFilename,
    operationsConfigurationValue: { schemaVersion: 1 },
  }), { name: 'TypeError' });
});
