import { randomBytes } from 'node:crypto';
import { lstat } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { startStudioHttpServer } from '../../studio-server/src/server.js';
import { createRemoteAuthentication } from './remote-authentication.js';
import { readRemoteConfigurationFile } from './remote-config.js';
import { readRemoteCredentialFile } from './remote-credential.js';
import { createRemoteGateway } from './remote-gateway.js';
import { validateRemoteStorage } from './remote-storage.js';

function closeServer(server) {
  if (!server?.listening) return Promise.resolve();
  return new Promise((resolveClose, rejectClose) => {
    const force = setTimeout(() => server.closeAllConnections?.(), 30_000);
    force.unref();
    server.close((error) => {
      clearTimeout(force);
      if (error) rejectClose(error);
      else resolveClose();
    });
    server.closeIdleConnections?.();
  });
}

function identityMatches(info, identity) {
  return String(info.dev) === String(identity.device) && String(info.ino) === String(identity.inode);
}

async function readPinnedCredential(configuration) {
  const before = await lstat(configuration.credentialFile);
  if (!before.isFile() || before.isSymbolicLink()
    || !identityMatches(before, configuration.credentialIdentity)) {
    throw new Error('Remote credential identity changed before startup.');
  }
  const credential = await readRemoteCredentialFile(configuration.credentialFile);
  const after = await lstat(configuration.credentialFile);
  if (!after.isFile() || after.isSymbolicLink()
    || before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size) {
    throw new Error('Remote credential identity changed during startup.');
  }
  return credential;
}

function headlessOperationsBootstrap() {
  const bytes = randomBytes(24);
  try {
    return bytes.toString('base64url');
  } finally {
    bytes.fill(0);
  }
}

export async function startRemoteStudio({
  configurationFilename = process.env.NUMBERDROID_STUDIO_REMOTE_CONFIG ?? null,
} = {}) {
  if (typeof configurationFilename !== 'string' || !isAbsolute(configurationFilename)) {
    throw new Error('An absolute remote configuration filename is required.');
  }
  const configuration = await readRemoteConfigurationFile(resolve(configurationFilename));
  const credential = await readPinnedCredential(configuration);
  const storage = await validateRemoteStorage(configuration);
  const authentication = createRemoteAuthentication({ credential });
  let upstream = null;
  let gateway = null;
  let closePromise = null;
  try {
    upstream = await startStudioHttpServer({
      dataDirectory: configuration.workspaceRoot,
      host: '127.0.0.1',
      port: 0,
      storeMode: 'sqlite',
      pairingEnabled: false,
      operationsConfigurationValue: storage.operationsConfiguration,
      operationsStartupPolicy: 'required',
      operationsBootstrapSecret: headlessOperationsBootstrap(),
    });
    const upstreamOrigin = `http://127.0.0.1:${upstream.address.port}/`;
    gateway = createRemoteGateway({
      publicOrigin: configuration.publicOrigin,
      trustedProxyAddress: configuration.trustedProxyAddress,
      upstreamOrigin,
      authentication,
    });
    gateway.server.maxHeadersCount = 64;
    gateway.server.headersTimeout = 10_000;
    gateway.server.requestTimeout = 120_000;
    gateway.server.keepAliveTimeout = 5_000;
    gateway.server.maxRequestsPerSocket = 100;
    await new Promise((resolveListen, rejectListen) => {
      const onError = (error) => rejectListen(error);
      gateway.server.once('error', onError);
      gateway.server.listen(configuration.listen.port, configuration.listen.host, () => {
        gateway.server.off('error', onError);
        resolveListen();
      });
    });
    gateway.markReady();

    const close = () => {
      if (closePromise !== null) return closePromise;
      gateway.markClosing();
      closePromise = closeServer(gateway.server)
        .then(() => authentication.close())
        .then(() => closeServer(upstream.server));
      return closePromise;
    };
    return Object.freeze({
      address: gateway.server.address(),
      configuration,
      gateway: gateway.server,
      upstream: upstream.server,
      close,
    });
  } catch (error) {
    gateway?.markClosing();
    await Promise.allSettled([
      closeServer(gateway?.server),
      closeServer(upstream?.server),
    ]);
    authentication.close();
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length > 3) throw new Error('Too many remote configuration arguments.');
    const running = await startRemoteStudio({
      configurationFilename: process.argv[2]
        ?? process.env.NUMBERDROID_STUDIO_REMOTE_CONFIG
        ?? null,
    });
    process.stdout.write('Numberdroid Studio private remote adapter is ready.\n');
    let stopping = false;
    const shutdown = () => {
      if (stopping) return;
      stopping = true;
      running.close().catch(() => {
        process.stderr.write('Numberdroid Studio private remote adapter shutdown failed.\n');
        process.exitCode = 1;
      });
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch {
    process.stderr.write('Numberdroid Studio private remote adapter failed to start.\n');
    process.exitCode = 1;
  }
}
