import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BACKUP_BOOTSTRAP_MAX_FAILURES,
  BACKUP_BOOTSTRAP_TTL_MS,
  BACKUP_OPERATOR_ABSOLUTE_TTL_MS,
  BACKUP_OPERATOR_COOKIE,
  BACKUP_OPERATOR_IDLE_TTL_MS,
  WorkspaceOperatorSession,
  backupOperatorCookieToken,
  backupOperatorSetCookie,
  generateWorkspaceOperatorBootstrapSecret,
  writeWorkspaceOperatorBootstrapSecret,
} from '../apps/studio-server/src/workspace-operator-session.js';

const bootstrapSecret = Buffer.alloc(24, 0x31).toString('base64url');

function sessionHarness() {
  let now = 0;
  const session = new WorkspaceOperatorSession({
    bootstrapSecret,
    clock: () => now,
    randomSource: (size) => Buffer.alloc(size, 0x42),
  });
  return {
    session,
    setNow(value) { now = value; },
  };
}

test('O1b bootstrap and cookie shapes are bounded, host-only, path-scoped, and non-persistent', { timeout: 5_000 }, async () => {
  assert.equal(generateWorkspaceOperatorBootstrapSecret((size) => Buffer.alloc(size, 0x11)).length, 32);
  const { session } = sessionHarness();
  assert.equal(session.status(), 'OPERATOR_LOCKED');
  const token = session.exchange(bootstrapSecret);
  assert.equal(token.length, 43);
  const cookie = backupOperatorSetCookie(token);
  assert.equal(cookie, `${BACKUP_OPERATOR_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/api/backups`);
  assert.doesNotMatch(cookie, /(?:Domain|Expires|Max-Age|Secure)/i);
  assert.equal(backupOperatorCookieToken(cookie), token);
  assert.equal(backupOperatorCookieToken(`${cookie}; ${BACKUP_OPERATOR_COOKIE}=${token}`), null);
  assert.equal(backupOperatorCookieToken(`${BACKUP_OPERATOR_COOKIE}=not-a-token`), null);
  assert.equal(session.status(token), 'READY');
  assert.throws(() => session.authenticate(null), { code: 'OPERATIONS_UNAVAILABLE' });
  assert.equal(session.status(), 'OPERATIONS_UNAVAILABLE');
  assert.throws(
    () => session.exchange(bootstrapSecret),
    (error) => error.code === 'OPERATIONS_UNAVAILABLE' && !error.message.includes(bootstrapSecret),
  );
});

test('O1b bootstrap expires, exhausts after five failures, and never echoes submitted values', { timeout: 5_000 }, () => {
  const expired = sessionHarness();
  expired.setNow(BACKUP_BOOTSTRAP_TTL_MS);
  assert.equal(expired.session.status(), 'OPERATIONS_UNAVAILABLE');
  assert.throws(() => expired.session.exchange(bootstrapSecret), { code: 'OPERATIONS_UNAVAILABLE' });

  const exhausted = sessionHarness();
  const wrong = Buffer.alloc(24, 0x32).toString('base64url');
  for (let attempt = 0; attempt < BACKUP_BOOTSTRAP_MAX_FAILURES; attempt += 1) {
    assert.throws(
      () => exhausted.session.exchange(wrong),
      (error) => error.code === 'WORKSPACE_OPERATOR_FORBIDDEN'
        && !error.message.includes(wrong)
        && !JSON.stringify(error.details).includes(wrong),
    );
  }
  assert.equal(exhausted.session.status(), 'OPERATIONS_UNAVAILABLE');
  assert.throws(() => exhausted.session.exchange(bootstrapSecret), { code: 'OPERATIONS_UNAVAILABLE' });
});

test('O1b operator sessions enforce idle, absolute, and restart invalidation in memory', { timeout: 5_000 }, () => {
  const idle = sessionHarness();
  const idleToken = idle.session.exchange(bootstrapSecret);
  idle.setNow(BACKUP_OPERATOR_IDLE_TTL_MS - 1);
  idle.session.authenticate(idleToken);
  idle.setNow((2 * BACKUP_OPERATOR_IDLE_TTL_MS) - 2);
  idle.session.authenticate(idleToken);
  idle.setNow((3 * BACKUP_OPERATOR_IDLE_TTL_MS) - 2);
  assert.throws(() => idle.session.authenticate(idleToken), { code: 'OPERATIONS_UNAVAILABLE' });

  const absolute = sessionHarness();
  const absoluteToken = absolute.session.exchange(bootstrapSecret);
  for (let now = BACKUP_OPERATOR_IDLE_TTL_MS - 1;
    now < BACKUP_OPERATOR_ABSOLUTE_TTL_MS;
    now += BACKUP_OPERATOR_IDLE_TTL_MS - 1) {
    absolute.setNow(now);
    absolute.session.authenticate(absoluteToken);
  }
  absolute.setNow(BACKUP_OPERATOR_ABSOLUTE_TTL_MS);
  assert.throws(() => absolute.session.authenticate(absoluteToken), { code: 'OPERATIONS_UNAVAILABLE' });

  const restarted = sessionHarness();
  const restartedToken = restarted.session.exchange(bootstrapSecret);
  restarted.session.close();
  assert.throws(() => restarted.session.authenticate(restartedToken), { code: 'OPERATIONS_UNAVAILABLE' });
});

test('O1b launcher writes the bootstrap exactly once only to the controlling terminal', { timeout: 5_000 }, async () => {
  const calls = [];
  await writeWorkspaceOperatorBootstrapSecret(bootstrapSecret, {
    platform: 'linux',
    openFile: async (filename, flags) => ({
      async writeFile(value, options) { calls.push({ filename, flags, value, options }); },
      async close() { calls.push({ close: true }); },
    }),
  });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], {
    filename: '/dev/tty',
    flags: 'w',
    value: `Numberdroid Studio backup controls\nUnlock code: ${bootstrapSecret}\nExpires in 10 minutes; shown once.\n`,
    options: { encoding: 'utf8' },
  });
  assert.deepEqual(calls[1], { close: true });
  await assert.rejects(
    writeWorkspaceOperatorBootstrapSecret(bootstrapSecret, {
      platform: 'win32',
      openFile: async () => { throw new Error('private coordinate must not escape'); },
    }),
    (error) => error.code === 'OPERATIONS_UNAVAILABLE'
      && !error.message.includes(bootstrapSecret)
      && !error.message.includes('private coordinate'),
  );
});
