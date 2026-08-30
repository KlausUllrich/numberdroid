import {
  RemoteSessionManager,
  remoteSessionClearCookie,
  remoteSessionCookieToken,
} from './remote-session.js';

function remoteAuthError(error) {
  const mapping = {
    REMOTE_CREDENTIAL_REJECTED: ['REMOTE_AUTHENTICATION_FAILED', 401],
    REMOTE_LOGIN_RATE_LIMITED: ['REMOTE_LOGIN_RATE_LIMITED', 429],
    REMOTE_AUTH_REQUIRED: ['REMOTE_AUTHENTICATION_REQUIRED', 401],
    REMOTE_CSRF_REJECTED: ['REMOTE_CSRF_INVALID', 403],
    REMOTE_AUTH_UNAVAILABLE: ['REMOTE_AUTHENTICATION_UNAVAILABLE', 503],
  };
  const [code, status] = mapping[error?.code] ?? ['REMOTE_AUTHENTICATION_UNAVAILABLE', 503];
  const projected = new Error('Remote authentication failed.');
  projected.name = 'RemoteAuthenticationError';
  projected.code = code;
  projected.status = status;
  return projected;
}

export function createRemoteAuthentication({
  credential,
  sessionManager = new RemoteSessionManager(),
} = {}) {
  if (!credential || !sessionManager) {
    throw new TypeError('credential and sessionManager are required.');
  }
  return Object.freeze({
    async login(secret, { clientAddress } = {}) {
      try {
        return await sessionManager.login({
          rateLimitKey: clientAddress,
          credential,
          secret,
        });
      } catch (error) {
        throw remoteAuthError(error);
      }
    },

    async authenticate(cookieHeader) {
      const sessionToken = remoteSessionCookieToken(cookieHeader);
      if (sessionToken === null) return null;
      try {
        const session = sessionManager.authenticate({ sessionToken, rotateIfDue: false });
        return Object.freeze({
          csrfToken: session.csrfToken,
          idleExpiresAt: new Date(session.idleExpiresAt).toISOString(),
          absoluteExpiresAt: new Date(session.absoluteExpiresAt).toISOString(),
          setCookie: session.setCookie,
        });
      } catch (error) {
        if (error?.code === 'REMOTE_AUTH_REQUIRED') return null;
        throw remoteAuthError(error);
      }
    },

    async logout(cookieHeader, csrfToken) {
      const sessionToken = remoteSessionCookieToken(cookieHeader);
      try {
        return sessionManager.logout({ sessionToken, csrfToken });
      } catch (error) {
        throw remoteAuthError(error);
      }
    },

    async rotate(cookieHeader, csrfToken) {
      const sessionToken = remoteSessionCookieToken(cookieHeader);
      try {
        return sessionManager.rotate({ sessionToken, csrfToken });
      } catch (error) {
        throw remoteAuthError(error);
      }
    },

    async revokeAll(cookieHeader, csrfToken) {
      const sessionToken = remoteSessionCookieToken(cookieHeader);
      try {
        sessionManager.revokeAll({ sessionToken, csrfToken });
        return Object.freeze({ setCookie: remoteSessionClearCookie() });
      } catch (error) {
        throw remoteAuthError(error);
      }
    },

    close() {
      sessionManager.close();
    },
  });
}
