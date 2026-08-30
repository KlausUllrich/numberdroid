const UI_MODE_PATH = '/health';

function localMode() {
  return Object.freeze({ mode: 'local', readOnly: false });
}

function remoteMode(value) {
  if (value?.schemaVersion !== 1
    || value.status !== 'ok'
    || value.service !== 'numberdroid-studio-remote'
    || value.mode !== 'remote'
    || value.readOnly !== true) {
    throw new Error('The Studio UI mode projection is invalid.');
  }
  return Object.freeze({ mode: 'remote', readOnly: true });
}

export async function detectStudioUiMode({ fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function.');
  const response = await fetchImpl(UI_MODE_PATH, {
    method: 'GET',
    headers: { accept: 'application/json' },
    redirect: 'manual',
  });
  if (!response.ok) throw new Error('The Studio UI mode is unavailable.');
  const value = await response.json();
  if (value?.schemaVersion === 1
    && value.status === 'ok'
    && value.service === 'numberdroid-studio') {
    return localMode();
  }
  return remoteMode(value);
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
