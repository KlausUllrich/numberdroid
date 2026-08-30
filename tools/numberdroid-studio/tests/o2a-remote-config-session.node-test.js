import assert from 'node:assert/strict';
import test from 'node:test';
import {
  chmod,
  mkdir,
  mkdtemp,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  REMOTE_MOUNT_MARKER_FILENAME,
  readRemoteConfigurationFile,
  validateRemoteConfiguration,
} from '../apps/studio-remote/src/remote-config.js';
import {
  REMOTE_CREDENTIAL_SCRYPT_PARAMETERS,
  createRemoteCredentialDocument,
  readRemoteCredentialFile,
  validateRemoteCredentialDocument,
  verifyRemoteCredential,
} from '../apps/studio-remote/src/remote-credential.js';
import {
  REMOTE_SESSION_COOKIE,
  RemoteSessionManager,
  remoteSessionCookieToken,
  remoteSessionSetCookie,
} from '../apps/studio-remote/src/remote-session.js';
import { createRemoteAuthentication } from '../apps/studio-remote/src/remote-authentication.js';
import { validateRemoteStorage } from '../apps/studio-remote/src/remote-storage.js';

const acceptedSecret = 'correct horse battery staple';
const credentialDocumentPromise = createRemoteCredentialDocument(acceptedSecret, {
  randomSource: (size) => Buffer.alloc(size, 0x51),
});

function deterministicRandomSource() {
  let value = 1;
  return (size) => Buffer.alloc(size, value++);
}

async function configurationFixture(context) {
  const root = await mkdtemp(join(tmpdir(), 'numberdroid-o2a-remote-config-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const mounts = [];
  for (const mountId of ['workspace', 'operations-control', 'backups', 'restored-copies']) {
    const mountRoot = join(root, mountId);
    await mkdir(mountRoot, { mode: 0o700 });
    await writeFile(
      join(mountRoot, REMOTE_MOUNT_MARKER_FILENAME),
      `${JSON.stringify({ schemaVersion: 1, mountId })}\n`,
      { mode: 0o600 },
    );
    mounts.push({ mountId, root: mountRoot });
  }
  const operationsConfigurationFile = join(root, 'operations.json');
  await writeFile(operationsConfigurationFile, `${JSON.stringify({
    schemaVersion: 1,
    controlRoot: mounts[1].root,
    backupDestinations: [{
      destinationId: 'backup.primary',
      label: 'Private backup',
      root: mounts[2].root,
    }],
    restoreDestinations: [{
      destinationId: 'restore.primary',
      label: 'Quarantined copy',
      root: mounts[3].root,
    }],
  })}\n`, { mode: 0o600 });
  const credentialFile = join(root, 'credential.json');
  await writeFile(
    credentialFile,
    `${JSON.stringify(await credentialDocumentPromise, null, 2)}\n`,
    { mode: 0o600 },
  );
  const configuration = {
    schemaVersion: 1,
    publicOrigin: 'https://studio.private.example',
    listen: { host: '127.0.0.1', port: 4318 },
    trustedProxyAddress: '::ffff:127.0.0.1',
    workspaceRoot: mounts[0].root,
    operationsConfigurationFile,
    credentialFile,
    mounts,
  };
  const configurationFile = join(root, 'remote.json');
  await writeFile(configurationFile, `${JSON.stringify(configuration, null, 2)}\n`, { mode: 0o600 });
  return {
    root,
    mounts,
    configuration,
    configurationFile,
    credentialFile,
  };
}

test('O2a reads only the exact marked remote configuration and canonicalizes identities', {
  timeout: 15_000,
}, async (context) => {
  const fixture = await configurationFixture(context);
  const configuration = await readRemoteConfigurationFile(fixture.configurationFile);
  assert.equal(configuration.schemaVersion, 1);
  assert.equal(configuration.publicOrigin, 'https://studio.private.example');
  assert.deepEqual(configuration.listen, { host: '127.0.0.1', port: 4318 });
  assert.equal(configuration.trustedProxyAddress, '127.0.0.1');
  assert.equal(configuration.workspaceRoot, await realpath(fixture.mounts[0].root));
  assert.equal(configuration.workspaceMountId, 'workspace');
  assert.equal(configuration.mounts.length, 4);
  assert.equal(Object.isFrozen(configuration), true);
  for (const mount of configuration.mounts) {
    assert.match(mount.identity.device, /^\d+$/);
    assert.match(mount.identity.inode, /^\d+$/);
    assert.equal(mount.marker.mountId, mount.mountId);
    assert.equal(mount.marker.schemaVersion, 1);
  }
  assert.equal(
    new Set(configuration.mounts.map((mount) => `${mount.identity.device}:${mount.identity.inode}`)).size,
    4,
  );
});

test('O2a configuration fails closed on schema, ingress, mount, marker, and no-follow drift', {
  timeout: 20_000,
}, async (context) => {
  const fixture = await configurationFixture(context);
  await assert.rejects(
    validateRemoteConfiguration({ ...fixture.configuration, unexpected: true }),
    { code: 'REMOTE_CONFIGURATION_INVALID' },
  );
  for (const publicOrigin of [
    'http://studio.private.example',
    'https://studio.private.example/',
    'https://user@studio.private.example',
    'https://studio.private.example/path',
  ]) {
    await assert.rejects(
      validateRemoteConfiguration({ ...fixture.configuration, publicOrigin }),
      { code: 'REMOTE_CONFIGURATION_INVALID' },
    );
  }
  await assert.rejects(
    validateRemoteConfiguration({
      ...fixture.configuration,
      listen: { host: '0.0.0.0', port: 4318 },
    }),
    { code: 'REMOTE_CONFIGURATION_INVALID' },
  );
  await assert.rejects(
    validateRemoteConfiguration({ ...fixture.configuration, trustedProxyAddress: '10.0.0.4' }),
    { code: 'REMOTE_CONFIGURATION_INVALID' },
  );

  const nestedRoot = join(fixture.mounts[1].root, 'nested');
  await mkdir(nestedRoot);
  await writeFile(
    join(nestedRoot, REMOTE_MOUNT_MARKER_FILENAME),
    '{"schemaVersion":1,"mountId":"nested"}\n',
    { mode: 0o600 },
  );
  await assert.rejects(
    validateRemoteConfiguration({
      ...fixture.configuration,
      mounts: [...fixture.mounts, { mountId: 'nested', root: nestedRoot }],
    }),
    { code: 'REMOTE_CONFIGURATION_INVALID' },
  );

  await writeFile(
    join(fixture.mounts[2].root, REMOTE_MOUNT_MARKER_FILENAME),
    '{"schemaVersion":1,"mountId":"wrong-mount"}\n',
    { mode: 0o600 },
  );
  await assert.rejects(
    validateRemoteConfiguration(fixture.configuration),
    { code: 'REMOTE_CONFIGURATION_INVALID' },
  );

  if (process.platform !== 'win32') {
    await chmod(fixture.configurationFile, 0o640);
    await assert.rejects(
      readRemoteConfigurationFile(fixture.configurationFile),
      { code: 'REMOTE_CONFIGURATION_INVALID' },
    );
    await chmod(fixture.configurationFile, 0o600);
    await chmod(fixture.mounts[1].root, 0o750);
    await assert.rejects(
      readRemoteConfigurationFile(fixture.configurationFile),
      { code: 'REMOTE_CONFIGURATION_INVALID' },
    );
    await chmod(fixture.mounts[1].root, 0o700);
    const linkedConfiguration = join(fixture.root, 'remote-link.json');
    await symlink(fixture.configurationFile, linkedConfiguration);
    await assert.rejects(
      readRemoteConfigurationFile(linkedConfiguration),
      { code: 'REMOTE_CONFIGURATION_INVALID' },
    );
  }
});

test('O2a storage binds every O1 root to the captured marked mount identity', {
  timeout: 15_000,
}, async (context) => {
  const fixture = await configurationFixture(context);
  const configuration = await readRemoteConfigurationFile(fixture.configurationFile);
  const storage = await validateRemoteStorage(configuration);
  assert.deepEqual(storage.mounts.map(({ role, mountId }) => [role, mountId]), [
    ['workspace', 'workspace'],
    ['control', 'operations-control'],
    ['backup:backup.primary', 'backups'],
    ['restore:restore.primary', 'restored-copies'],
  ]);

  const displaced = `${fixture.mounts[2].root}.displaced`;
  await rename(fixture.mounts[2].root, displaced);
  await mkdir(fixture.mounts[2].root, { mode: 0o700 });
  await writeFile(
    join(fixture.mounts[2].root, REMOTE_MOUNT_MARKER_FILENAME),
    '{"schemaVersion":1,"mountId":"backups"}\n',
    { mode: 0o600 },
  );
  await assert.rejects(validateRemoteStorage(configuration), { code: 'REMOTE_STORAGE_INVALID' });
});

test('O2a credential document is fixed-cost scrypt and the file is no-follow 0600 on POSIX', {
  timeout: 20_000,
}, async (context) => {
  const fixture = await configurationFixture(context);
  const credential = await readRemoteCredentialFile(fixture.credentialFile);
  assert.deepEqual(credential.parameters, REMOTE_CREDENTIAL_SCRYPT_PARAMETERS);
  assert.equal(await verifyRemoteCredential(acceptedSecret, credential), true);
  assert.equal(await verifyRemoteCredential('wrong credential', credential), false);
  assert.equal(JSON.stringify(credential).includes(acceptedSecret), false);
  assert.throws(
    () => validateRemoteCredentialDocument({ ...credential, extra: true }),
    { code: 'REMOTE_CREDENTIAL_INVALID' },
  );
  assert.throws(
    () => validateRemoteCredentialDocument({
      ...credential,
      parameters: { ...credential.parameters, N: 2 },
    }),
    { code: 'REMOTE_CREDENTIAL_INVALID' },
  );
  await assert.rejects(
    createRemoteCredentialDocument('too-short', {
      randomSource: (size) => Buffer.alloc(size, 0x61),
    }),
    { code: 'REMOTE_CREDENTIAL_INVALID' },
  );

  if (process.platform !== 'win32') {
    await chmod(fixture.credentialFile, 0o640);
    await assert.rejects(
      readRemoteCredentialFile(fixture.credentialFile),
      { code: 'REMOTE_CREDENTIAL_UNAVAILABLE' },
    );
    await chmod(fixture.credentialFile, 0o600);
    const linkedCredential = join(fixture.root, 'credential-link.json');
    await symlink(fixture.credentialFile, linkedCredential);
    await assert.rejects(
      readRemoteCredentialFile(linkedCredential),
      { code: 'REMOTE_CREDENTIAL_UNAVAILABLE' },
    );
  }
});

test('O2a sessions use host-only secure cookies, per-session CSRF, rotation, and logout', {
  timeout: 20_000,
}, async () => {
  const credential = await credentialDocumentPromise;
  let now = 0;
  const manager = new RemoteSessionManager({
    clock: () => now,
    randomSource: deterministicRandomSource(),
    idleTtlMs: 1_000,
    absoluteTtlMs: 5_000,
    rotationTtlMs: 500,
  });
  const login = await manager.login({
    rateLimitKey: '127.0.0.1',
    credential,
    secret: acceptedSecret,
  });
  assert.equal(login.sessionToken.length, 43);
  assert.equal(login.csrfToken.length, 43);
  assert.notEqual(login.sessionToken, login.csrfToken);
  assert.equal(
    login.setCookie,
    `${REMOTE_SESSION_COOKIE}=${login.sessionToken}; Secure; HttpOnly; SameSite=Strict; Path=/`,
  );
  assert.equal(remoteSessionSetCookie(login.sessionToken), login.setCookie);
  assert.equal(remoteSessionCookieToken(login.setCookie), login.sessionToken);
  assert.equal(remoteSessionCookieToken(`${login.setCookie}; ${REMOTE_SESSION_COOKIE}=${login.sessionToken}`), null);
  assert.doesNotMatch(login.setCookie, /(?:Domain|Max-Age|Expires)=/i);
  assert.equal(JSON.stringify(manager).includes(login.sessionToken), false);
  assert.deepEqual(manager.summary(), { activeSessions: 1 });

  assert.throws(
    () => manager.authenticate({
      sessionToken: login.sessionToken,
      csrfToken: 'A'.repeat(43),
      requireCsrf: true,
    }),
    { code: 'REMOTE_CSRF_REJECTED' },
  );
  now = 500;
  const rotated = manager.authenticate({
    sessionToken: login.sessionToken,
    csrfToken: login.csrfToken,
    requireCsrf: true,
  });
  assert.equal(rotated.rotated, true);
  assert.notEqual(rotated.sessionToken, login.sessionToken);
  assert.notEqual(rotated.csrfToken, login.csrfToken);
  assert.throws(
    () => manager.authenticate({ sessionToken: login.sessionToken }),
    { code: 'REMOTE_AUTH_REQUIRED' },
  );
  const authenticated = manager.authenticate({
    sessionToken: rotated.sessionToken,
    rotateIfDue: false,
  });
  assert.equal(authenticated.authenticated, true);
  assert.equal(authenticated.csrfToken, rotated.csrfToken);
  const logout = manager.logout({
    sessionToken: rotated.sessionToken,
    csrfToken: rotated.csrfToken,
  });
  assert.equal(logout.loggedOut, true);
  assert.match(logout.setCookie, /Max-Age=0/);
  assert.throws(
    () => manager.authenticate({ sessionToken: rotated.sessionToken }),
    { code: 'REMOTE_AUTH_REQUIRED' },
  );
});

test('O2a authentication adapter returns reload-safe CSRF and atomically revokes every session', {
  timeout: 15_000,
}, async () => {
  const credential = await credentialDocumentPromise;
  const sessionManager = new RemoteSessionManager({
    clock: () => 0,
    randomSource: deterministicRandomSource(),
  });
  const authentication = createRemoteAuthentication({ credential, sessionManager });
  const login = await authentication.login(acceptedSecret, { clientAddress: '127.0.0.1' });
  const session = await authentication.authenticate(login.setCookie);
  assert.equal(session.csrfToken, login.csrfToken);
  assert.equal(session.setCookie, null);
  assert.match(session.idleExpiresAt, /Z$/);
  const rotated = await authentication.rotate(login.setCookie, session.csrfToken);
  assert.notEqual(rotated.setCookie, login.setCookie);
  const rotatedSession = await authentication.authenticate(rotated.setCookie);
  const revoked = await authentication.revokeAll(rotated.setCookie, rotatedSession.csrfToken);
  assert.match(revoked.setCookie, /Max-Age=0/);
  assert.equal(await authentication.authenticate(login.setCookie), null);
  authentication.close();
});

test('O2a sessions enforce bounded login attempts, idle/absolute TTL, revoke-all, and restart invalidation', {
  timeout: 30_000,
}, async () => {
  const credential = await credentialDocumentPromise;
  let now = 0;
  const rateLimited = new RemoteSessionManager({
    clock: () => now,
    randomSource: deterministicRandomSource(),
    loginWindowMs: 1_000,
    loginMaxAttempts: 2,
    loginGlobalWindowMs: 1_000,
    loginGlobalMaxAttempts: 10,
  });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await assert.rejects(
      rateLimited.login({
        rateLimitKey: '198.51.100.7',
        credential,
        secret: 'wrong credential',
      }),
      (error) => error.code === 'REMOTE_CREDENTIAL_REJECTED'
        && !error.message.includes('wrong credential'),
    );
  }
  await assert.rejects(
    rateLimited.login({
      rateLimitKey: '198.51.100.7',
      credential,
      secret: acceptedSecret,
    }),
    (error) => error.code === 'REMOTE_LOGIN_RATE_LIMITED'
      && error.details.retryAfterMs === 1_000,
  );
  now = 1_000;
  const recovered = await rateLimited.login({
    rateLimitKey: '198.51.100.7',
    credential,
    secret: acceptedSecret,
  });
  assert.equal(recovered.sessionToken.length, 43);

  const restarted = new RemoteSessionManager({
    clock: () => now,
    randomSource: deterministicRandomSource(),
  });
  assert.throws(
    () => restarted.authenticate({ sessionToken: recovered.sessionToken }),
    { code: 'REMOTE_AUTH_REQUIRED' },
  );

  const expiring = new RemoteSessionManager({
    clock: () => now,
    randomSource: deterministicRandomSource(),
    idleTtlMs: 1_000,
    absoluteTtlMs: 3_000,
    rotationTtlMs: 500,
  });
  const expiringLogin = await expiring.login({
    rateLimitKey: '127.0.0.1',
    credential,
    secret: acceptedSecret,
  });
  now = 2_000;
  assert.throws(
    () => expiring.authenticate({ sessionToken: expiringLogin.sessionToken }),
    { code: 'REMOTE_AUTH_REQUIRED' },
  );

  now = 3_000;
  const absolute = new RemoteSessionManager({
    clock: () => now,
    randomSource: deterministicRandomSource(),
    idleTtlMs: 1_000,
    absoluteTtlMs: 3_000,
    rotationTtlMs: 500,
  });
  let active = await absolute.login({
    rateLimitKey: '127.0.0.2',
    credential,
    secret: acceptedSecret,
  });
  for (const timestamp of [3_500, 4_000, 4_500, 5_000, 5_500]) {
    now = timestamp;
    active = absolute.rotate({
      sessionToken: active.sessionToken,
      csrfToken: active.csrfToken,
    });
  }
  now = 6_000;
  assert.throws(
    () => absolute.authenticate({ sessionToken: active.sessionToken }),
    { code: 'REMOTE_AUTH_REQUIRED' },
  );

  now = 7_000;
  const revocable = new RemoteSessionManager({
    clock: () => now,
    randomSource: deterministicRandomSource(),
  });
  const revocableLogin = await revocable.login({
    rateLimitKey: '127.0.0.3',
    credential,
    secret: acceptedSecret,
  });
  const revoked = revocable.revokeAll({
    sessionToken: revocableLogin.sessionToken,
    csrfToken: revocableLogin.csrfToken,
  });
  assert.equal(revoked.revoked, 1);
  assert.match(revoked.setCookie, /Max-Age=0/);
  assert.throws(
    () => revocable.authenticate({ sessionToken: revocableLogin.sessionToken }),
    { code: 'REMOTE_AUTH_REQUIRED' },
  );
  revocable.close();
  assert.throws(() => revocable.summary(), { code: 'REMOTE_AUTH_UNAVAILABLE' });
});
