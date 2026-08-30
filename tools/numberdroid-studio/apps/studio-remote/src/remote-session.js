import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { StudioError, invariant } from '../../../packages/domain/src/errors.js';
import { verifyRemoteCredential } from './remote-credential.js';

export const REMOTE_SESSION_COOKIE = '__Host-numberdroid_remote_session';
export const REMOTE_SESSION_IDLE_TTL_MS = 15 * 60 * 1000;
export const REMOTE_SESSION_ABSOLUTE_TTL_MS = 8 * 60 * 60 * 1000;
export const REMOTE_SESSION_ROTATION_TTL_MS = 15 * 60 * 1000;
export const REMOTE_LOGIN_WINDOW_MS = 5 * 60 * 1000;
export const REMOTE_LOGIN_MAX_ATTEMPTS = 5;
export const REMOTE_LOGIN_GLOBAL_WINDOW_MS = 60 * 1000;
export const REMOTE_LOGIN_GLOBAL_MAX_ATTEMPTS = 50;

const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const MAX_COOKIE_HEADER_BYTES = 4096;
const DEFAULT_MAX_SESSIONS = 64;
const DEFAULT_MAX_RATE_LIMIT_KEYS = 1024;
const OVERFLOW_RATE_LIMIT_KEY = 'overflow';

function nowMilliseconds(clock) {
  const value = clock();
  const milliseconds = typeof value === 'number' ? value : Date.parse(value);
  invariant(
    Number.isFinite(milliseconds) && milliseconds >= 0,
    'REMOTE_AUTH_UNAVAILABLE',
    'Remote authentication clock is unavailable.',
  );
  return milliseconds;
}

function digest(value) {
  return createHash('sha256').update(value, 'utf8').digest();
}

function digestKey(value) {
  return digest(value).toString('hex');
}

function tokenMatchesDigest(token, expected) {
  if (typeof token !== 'string' || !TOKEN_PATTERN.test(token) || !Buffer.isBuffer(expected)) {
    return false;
  }
  const actual = digest(token);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function validatePositiveInteger(value, label, { maximum = Number.MAX_SAFE_INTEGER } = {}) {
  invariant(
    Number.isSafeInteger(value) && value > 0 && value <= maximum,
    'REMOTE_AUTH_UNAVAILABLE',
    `${label} is invalid.`,
  );
}

function validatedRateLimitKey(value) {
  invariant(
    typeof value === 'string' && value.length >= 1 && value.length <= 128
      && !/[\u0000-\u001f\u007f]/.test(value),
    'REMOTE_AUTH_UNAVAILABLE',
    'Remote login source identity is unavailable.',
  );
  return digestKey(value);
}

class RemoteLoginRateLimiter {
  #clock;
  #windowMs;
  #maxAttempts;
  #globalWindowMs;
  #globalMaxAttempts;
  #maxKeys;
  #entries = new Map();
  #globalWindowStartedAt = 0;
  #globalAttempts = 0;

  constructor({
    clock,
    windowMs,
    maxAttempts,
    globalWindowMs,
    globalMaxAttempts,
    maxKeys,
  }) {
    this.#clock = clock;
    this.#windowMs = windowMs;
    this.#maxAttempts = maxAttempts;
    this.#globalWindowMs = globalWindowMs;
    this.#globalMaxAttempts = globalMaxAttempts;
    this.#maxKeys = maxKeys;
    this.#globalWindowStartedAt = nowMilliseconds(clock);
  }

  #resetGlobalWindow(now) {
    if (now - this.#globalWindowStartedAt >= this.#globalWindowMs) {
      this.#globalWindowStartedAt = now;
      this.#globalAttempts = 0;
    }
  }

  #prune(now) {
    for (const [key, entry] of this.#entries) {
      if (now - entry.windowStartedAt >= this.#windowMs) this.#entries.delete(key);
    }
  }

  consume(sourceIdentity) {
    const now = nowMilliseconds(this.#clock);
    this.#resetGlobalWindow(now);
    let key = validatedRateLimitKey(sourceIdentity);
    let entry = this.#entries.get(key);
    if (entry && now - entry.windowStartedAt >= this.#windowMs) {
      this.#entries.delete(key);
      entry = undefined;
    }
    if (!entry) {
      if (this.#entries.size >= this.#maxKeys) this.#prune(now);
      if (this.#entries.size >= this.#maxKeys) key = OVERFLOW_RATE_LIMIT_KEY;
      entry = this.#entries.get(key);
      if (!entry || now - entry.windowStartedAt >= this.#windowMs) {
        entry = { windowStartedAt: now, attempts: 0 };
        this.#entries.set(key, entry);
      }
    }

    if (entry.attempts >= this.#maxAttempts) {
      throw new StudioError('REMOTE_LOGIN_RATE_LIMITED', 'Sign-in is temporarily unavailable.', {
        retryAfterMs: Math.max(1, this.#windowMs - (now - entry.windowStartedAt)),
      });
    }
    if (this.#globalAttempts >= this.#globalMaxAttempts) {
      throw new StudioError('REMOTE_LOGIN_RATE_LIMITED', 'Sign-in is temporarily unavailable.', {
        retryAfterMs: Math.max(
          1,
          this.#globalWindowMs - (now - this.#globalWindowStartedAt),
        ),
      });
    }
    entry.attempts += 1;
    this.#globalAttempts += 1;
    return key;
  }

  successful(key) {
    if (typeof key === 'string') this.#entries.delete(key);
  }

  clear() {
    this.#entries.clear();
    this.#globalAttempts = 0;
    this.#globalWindowStartedAt = 0;
  }
}

export function remoteSessionCookieToken(header) {
  if (typeof header !== 'string' || header.length === 0 || header.length > MAX_COOKIE_HEADER_BYTES) {
    return null;
  }
  const values = [];
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    if (name === REMOTE_SESSION_COOKIE) values.push(part.slice(separator + 1).trim());
  }
  return values.length === 1 && TOKEN_PATTERN.test(values[0]) ? values[0] : null;
}

export function remoteSessionSetCookie(token) {
  invariant(
    typeof token === 'string' && TOKEN_PATTERN.test(token),
    'REMOTE_AUTH_UNAVAILABLE',
    'Remote session token is unavailable.',
  );
  return `${REMOTE_SESSION_COOKIE}=${token}; Secure; HttpOnly; SameSite=Strict; Path=/`;
}

export function remoteSessionClearCookie() {
  return `${REMOTE_SESSION_COOKIE}=; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}

export class RemoteSessionManager {
  #clock;
  #randomSource;
  #idleTtlMs;
  #absoluteTtlMs;
  #rotationTtlMs;
  #maxSessions;
  #sessions = new Map();
  #loginLimiter;
  #closed = false;
  #revocationGeneration = 0;

  constructor({
    clock = Date.now,
    randomSource = randomBytes,
    idleTtlMs = REMOTE_SESSION_IDLE_TTL_MS,
    absoluteTtlMs = REMOTE_SESSION_ABSOLUTE_TTL_MS,
    rotationTtlMs = REMOTE_SESSION_ROTATION_TTL_MS,
    maxSessions = DEFAULT_MAX_SESSIONS,
    loginWindowMs = REMOTE_LOGIN_WINDOW_MS,
    loginMaxAttempts = REMOTE_LOGIN_MAX_ATTEMPTS,
    loginGlobalWindowMs = REMOTE_LOGIN_GLOBAL_WINDOW_MS,
    loginGlobalMaxAttempts = REMOTE_LOGIN_GLOBAL_MAX_ATTEMPTS,
    maxRateLimitKeys = DEFAULT_MAX_RATE_LIMIT_KEYS,
  } = {}) {
    invariant(
      typeof clock === 'function' && typeof randomSource === 'function',
      'REMOTE_AUTH_UNAVAILABLE',
      'Remote authentication dependencies are unavailable.',
    );
    for (const [value, label, maximum] of [
      [idleTtlMs, 'Remote session idle TTL', 24 * 60 * 60 * 1000],
      [absoluteTtlMs, 'Remote session absolute TTL', 7 * 24 * 60 * 60 * 1000],
      [rotationTtlMs, 'Remote session rotation TTL', 24 * 60 * 60 * 1000],
      [maxSessions, 'Remote session capacity', 4096],
      [loginWindowMs, 'Remote login window', 24 * 60 * 60 * 1000],
      [loginMaxAttempts, 'Remote login attempt limit', 1000],
      [loginGlobalWindowMs, 'Remote global login window', 24 * 60 * 60 * 1000],
      [loginGlobalMaxAttempts, 'Remote global login attempt limit', 100_000],
      [maxRateLimitKeys, 'Remote login source capacity', 100_000],
    ]) validatePositiveInteger(value, label, { maximum });
    invariant(
      rotationTtlMs <= idleTtlMs && idleTtlMs < absoluteTtlMs,
      'REMOTE_AUTH_UNAVAILABLE',
      'Remote session TTL ordering is invalid.',
    );
    this.#clock = clock;
    this.#randomSource = randomSource;
    this.#idleTtlMs = idleTtlMs;
    this.#absoluteTtlMs = absoluteTtlMs;
    this.#rotationTtlMs = rotationTtlMs;
    this.#maxSessions = maxSessions;
    this.#loginLimiter = new RemoteLoginRateLimiter({
      clock,
      windowMs: loginWindowMs,
      maxAttempts: loginMaxAttempts,
      globalWindowMs: loginGlobalWindowMs,
      globalMaxAttempts: loginGlobalMaxAttempts,
      maxKeys: maxRateLimitKeys,
    });
  }

  #now() {
    return nowMilliseconds(this.#clock);
  }

  #assertOpen() {
    invariant(
      !this.#closed,
      'REMOTE_AUTH_UNAVAILABLE',
      'Remote authentication is unavailable.',
    );
  }

  #newToken({ exclude = new Set() } = {}) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      let bytes;
      try {
        bytes = this.#randomSource(TOKEN_BYTES);
      } catch {
        throw new StudioError('REMOTE_AUTH_UNAVAILABLE', 'Remote session entropy is unavailable.');
      }
      invariant(
        Buffer.isBuffer(bytes) && bytes.length === TOKEN_BYTES,
        'REMOTE_AUTH_UNAVAILABLE',
        'Remote session entropy is unavailable.',
      );
      const token = bytes.toString('base64url');
      bytes.fill(0);
      if (!exclude.has(token) && !this.#sessions.has(digestKey(token))) return token;
    }
    throw new StudioError('REMOTE_AUTH_UNAVAILABLE', 'Remote session entropy is unavailable.');
  }

  #expired(entry, now) {
    return now - entry.createdAt >= this.#absoluteTtlMs
      || now - entry.lastSeenAt >= this.#idleTtlMs;
  }

  #discard(key) {
    const entry = this.#sessions.get(key);
    if (entry) {
      entry.csrfDigest.fill(0);
      entry.csrfToken = null;
      this.#sessions.delete(key);
    }
  }

  #discardAll() {
    for (const key of this.#sessions.keys()) this.#discard(key);
  }

  #purgeExpired(now) {
    for (const [key, entry] of this.#sessions) {
      if (this.#expired(entry, now)) this.#discard(key);
    }
  }

  #lookup(sessionToken, now) {
    if (typeof sessionToken !== 'string' || !TOKEN_PATTERN.test(sessionToken)) {
      throw new StudioError('REMOTE_AUTH_REQUIRED', 'A valid remote session is required.');
    }
    const key = digestKey(sessionToken);
    const entry = this.#sessions.get(key);
    if (!entry || this.#expired(entry, now)) {
      if (entry) this.#discard(key);
      throw new StudioError('REMOTE_AUTH_REQUIRED', 'A valid remote session is required.');
    }
    return { key, entry };
  }

  #issue(now, { createdAt = now, replacingKey = null } = {}) {
    this.#purgeExpired(now);
    const replacementCount = replacingKey !== null && this.#sessions.has(replacingKey) ? 1 : 0;
    invariant(
      this.#sessions.size - replacementCount < this.#maxSessions,
      'REMOTE_AUTH_UNAVAILABLE',
      'Remote session capacity is unavailable.',
    );
    const sessionToken = this.#newToken();
    const csrfToken = this.#newToken({ exclude: new Set([sessionToken]) });
    const key = digestKey(sessionToken);
    this.#sessions.set(key, {
      createdAt,
      lastSeenAt: now,
      rotatedAt: now,
      csrfToken,
      csrfDigest: digest(csrfToken),
    });
    if (replacingKey !== null) this.#discard(replacingKey);
    return Object.freeze({
      sessionToken,
      csrfToken,
      setCookie: remoteSessionSetCookie(sessionToken),
      absoluteExpiresAt: createdAt + this.#absoluteTtlMs,
      idleExpiresAt: now + this.#idleTtlMs,
    });
  }

  async login({ rateLimitKey, credential, secret } = {}) {
    this.#assertOpen();
    const generation = this.#revocationGeneration;
    const consumedKey = this.#loginLimiter.consume(rateLimitKey);
    const accepted = await verifyRemoteCredential(secret, credential);
    if (!accepted) {
      throw new StudioError('REMOTE_CREDENTIAL_REJECTED', 'The sign-in credential was not accepted.');
    }
    if (this.#closed || generation !== this.#revocationGeneration) {
      throw new StudioError('REMOTE_AUTH_UNAVAILABLE', 'Remote authentication changed during sign-in.');
    }
    const session = this.#issue(this.#now());
    this.#loginLimiter.successful(consumedKey);
    return session;
  }

  authenticate({
    sessionToken,
    csrfToken,
    requireCsrf = false,
    rotateIfDue = true,
  } = {}) {
    this.#assertOpen();
    invariant(
      typeof requireCsrf === 'boolean' && typeof rotateIfDue === 'boolean',
      'REMOTE_AUTH_REQUIRED',
      'Remote authentication request is invalid.',
    );
    const now = this.#now();
    const { key, entry } = this.#lookup(sessionToken, now);
    if (requireCsrf && !tokenMatchesDigest(csrfToken, entry.csrfDigest)) {
      throw new StudioError('REMOTE_CSRF_REJECTED', 'The remote CSRF proof was not accepted.');
    }

    if (rotateIfDue && now - entry.rotatedAt >= this.#rotationTtlMs) {
      const createdAt = entry.createdAt;
      const session = this.#issue(now, { createdAt, replacingKey: key });
      return Object.freeze({
        authenticated: true,
        rotated: true,
        ...session,
      });
    }

    entry.lastSeenAt = now;
    return Object.freeze({
      authenticated: true,
      rotated: false,
      sessionToken: null,
      csrfToken: entry.csrfToken,
      setCookie: null,
      absoluteExpiresAt: entry.createdAt + this.#absoluteTtlMs,
      idleExpiresAt: now + this.#idleTtlMs,
    });
  }

  rotate({ sessionToken, csrfToken } = {}) {
    this.#assertOpen();
    const now = this.#now();
    const { key, entry } = this.#lookup(sessionToken, now);
    if (!tokenMatchesDigest(csrfToken, entry.csrfDigest)) {
      throw new StudioError('REMOTE_CSRF_REJECTED', 'The remote CSRF proof was not accepted.');
    }
    return this.#issue(now, { createdAt: entry.createdAt, replacingKey: key });
  }

  logout({ sessionToken, csrfToken } = {}) {
    this.#assertOpen();
    const now = this.#now();
    const { key, entry } = this.#lookup(sessionToken, now);
    if (!tokenMatchesDigest(csrfToken, entry.csrfDigest)) {
      throw new StudioError('REMOTE_CSRF_REJECTED', 'The remote CSRF proof was not accepted.');
    }
    this.#discard(key);
    return Object.freeze({ loggedOut: true, setCookie: remoteSessionClearCookie() });
  }

  revokeAll({ sessionToken, csrfToken } = {}) {
    this.#assertOpen();
    const now = this.#now();
    const { entry } = this.#lookup(sessionToken, now);
    if (!tokenMatchesDigest(csrfToken, entry.csrfDigest)) {
      throw new StudioError('REMOTE_CSRF_REJECTED', 'The remote CSRF proof was not accepted.');
    }
    const revoked = this.#sessions.size;
    this.#discardAll();
    this.#revocationGeneration += 1;
    return Object.freeze({
      revoked,
      setCookie: remoteSessionClearCookie(),
    });
  }

  summary() {
    this.#assertOpen();
    const now = this.#now();
    this.#purgeExpired(now);
    return Object.freeze({ activeSessions: this.#sessions.size });
  }

  close() {
    if (this.#closed) return;
    this.#closed = true;
    this.#discardAll();
    this.#revocationGeneration += 1;
    this.#loginLimiter.clear();
  }
}
