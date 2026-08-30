import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detectStudioUiMode,
  remoteReadOnlyAgentAccess,
} from '../apps/studio-server/public/remote-ui-mode.js';

function response(status, value = null) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => value,
  };
}

test('O2a UI detects local and authenticated remote modes without granting mutation authority', {
  timeout: 5_000,
}, async () => {
  const local = await detectStudioUiMode({ fetchImpl: async () => response(404) });
  assert.deepEqual(local, { mode: 'local', readOnly: false });

  const remote = await detectStudioUiMode({ fetchImpl: async (target, options) => {
    assert.equal(target, '/remote/session');
    assert.equal(options.method, 'GET');
    return response(200, {
      schemaVersion: 1,
      session: { csrfToken: 'c'.repeat(43) },
    });
  } });
  assert.deepEqual(remote, { mode: 'remote', readOnly: true });

  const access = remoteReadOnlyAgentAccess('project.one');
  assert.equal(access.effectivePolicy.state, 'OFF');
  assert.deepEqual(access.effectivePolicy.scopes, []);
  assert.equal(access.csrfToken, null);
  assert.equal(access.hostBindingSupport, 'REMOTE_FORBIDDEN');
  assert.equal(access.mcpLauncherConfig, null);
  assert.equal(Object.isFrozen(access), true);
});

test('O2a UI fails closed when a remote session projection is unavailable or malformed', {
  timeout: 5_000,
}, async () => {
  await assert.rejects(
    detectStudioUiMode({ fetchImpl: async () => response(401) }),
    /remote session is unavailable/i,
  );
  await assert.rejects(
    detectStudioUiMode({ fetchImpl: async () => response(200, { schemaVersion: 1, session: {} }) }),
    /session projection is invalid/i,
  );
});
