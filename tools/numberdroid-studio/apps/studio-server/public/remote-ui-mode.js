const REMOTE_SESSION_PATH = '/remote/session';

function localMode() {
  return Object.freeze({ mode: 'local', readOnly: false });
}

function remoteMode(value) {
  if (value?.schemaVersion !== 1
    || !value.session
    || typeof value.session.csrfToken !== 'string'
    || value.session.csrfToken.length !== 43) {
    throw new Error('The private remote session projection is invalid.');
  }
  return Object.freeze({ mode: 'remote', readOnly: true });
}

export async function detectStudioUiMode({ fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function.');
  const response = await fetchImpl(REMOTE_SESSION_PATH, {
    method: 'GET',
    headers: { accept: 'application/json' },
    redirect: 'manual',
  });
  if (response.status === 404) return localMode();
  if (!response.ok) throw new Error('The private remote session is unavailable.');
  return remoteMode(await response.json());
}

export function remoteReadOnlyAgentAccess(projectId) {
  return Object.freeze({
    effectivePolicy: Object.freeze({
      schemaVersion: 1,
      projectId,
      mode: 'off',
      state: 'OFF',
      taskId: null,
      branchId: null,
      scopes: Object.freeze([]),
      objectScopes: Object.freeze([]),
      expiresAt: null,
      budget: Object.freeze({ status: 'NOT_AVAILABLE', limits: null, used: null, remaining: null }),
      runningJobs: 0,
      warnings: Object.freeze([Object.freeze({
        code: 'REMOTE_READ_ONLY',
        severity: 'info',
        message: 'This private remote session is read-only. Agent access remains available only on the local Studio.',
      })]),
      options: Object.freeze([]),
      authoritySource: 'REMOTE_GATEWAY_NONE',
      selectionCreatesAuthority: false,
    }),
    hostBindingSupport: 'REMOTE_FORBIDDEN',
    hostBindings: Object.freeze([]),
    pendingHosts: Object.freeze([]),
    mcpLauncherConfig: null,
    csrfToken: null,
  });
}
