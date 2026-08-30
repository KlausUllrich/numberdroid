import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { createRemoteGateway } from '../apps/studio-remote/src/remote-gateway.js';

const COOKIE_NAME = '__Host-numberdroid_remote_session';
const SESSION_COOKIE = `${COOKIE_NAME}=valid-session`;
const CLEAR_COOKIE = `${COOKIE_NAME}=; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
const CSRF = 'c'.repeat(43);

function authenticationHarness() {
  let revoked = false;
  return {
    async login(credential) {
      if (credential !== 'owner-secret') {
        const error = new Error('generic login failure');
        error.code = 'REMOTE_AUTHENTICATION_FAILED';
        error.status = 401;
        throw error;
      }
      revoked = false;
      return { setCookie: `${SESSION_COOKIE}; Secure; HttpOnly; SameSite=Strict; Path=/` };
    },
    async authenticate(cookie) {
      if (revoked || cookie !== SESSION_COOKIE) return null;
      return { csrfToken: CSRF, idleExpiresAt: '2026-08-30T10:00:00.000Z', absoluteExpiresAt: '2026-08-30T17:00:00.000Z' };
    },
    async logout(cookie, csrfToken) {
      if (cookie !== SESSION_COOKIE || csrfToken !== CSRF) {
        const error = new Error('forbidden');
        error.code = 'REMOTE_CSRF_INVALID';
        error.status = 403;
        throw error;
      }
      revoked = true;
      return { setCookie: CLEAR_COOKIE };
    },
    async rotate(cookie, csrfToken) {
      if (cookie !== SESSION_COOKIE || csrfToken !== CSRF) {
        const error = new Error('forbidden');
        error.code = 'REMOTE_CSRF_INVALID';
        error.status = 403;
        throw error;
      }
      return { setCookie: `${SESSION_COOKIE}; Secure; HttpOnly; SameSite=Strict; Path=/` };
    },
    async revokeAll(cookie, csrfToken) {
      return this.logout(cookie, csrfToken);
    },
  };
}

function listen(context, server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      context.after(() => new Promise((resolveClose) => server.close(resolveClose)));
      resolve(`http://127.0.0.1:${server.address().port}`);
    });
  });
}

function ingressHeaders(additional = {}) {
  return {
    'x-forwarded-proto': 'https',
    'x-forwarded-host': 'studio.example.test',
    'x-forwarded-for': '100.64.0.8',
    ...additional,
  };
}

test('O2a gateway login protects every Studio byte and never forwards the remote session', { timeout: 15_000 }, async (context) => {
  const observed = [];
  const upstream = createServer((request, response) => {
    observed.push({ url: request.url, headers: request.headers });
    const body = `${JSON.stringify({ schemaVersion: 1, projects: [] })}\n`;
    response.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
    response.end(body);
  });
  const upstreamOrigin = await listen(context, upstream);
  const gateway = createRemoteGateway({
    publicOrigin: 'https://studio.example.test',
    trustedProxyAddress: '127.0.0.1',
    upstreamOrigin,
    authentication: authenticationHarness(),
  });
  gateway.markReady();
  const origin = await listen(context, gateway.server);

  let response = await fetch(`${origin}/api/projects`, { headers: ingressHeaders() });
  assert.equal(response.status, 401);
  assert.equal(observed.length, 0);

  response = await fetch(`${origin}/remote/login`, {
    method: 'POST',
    redirect: 'manual',
    headers: ingressHeaders({
      origin: 'https://studio.example.test',
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/x-www-form-urlencoded',
    }),
    body: new URLSearchParams({ credential: 'owner-secret' }),
  });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/');
  assert.match(response.headers.get('set-cookie'), new RegExp(`^${COOKIE_NAME}=valid-session; Secure; HttpOnly; SameSite=Strict; Path=/$`));

  response = await fetch(`${origin}/api/projects`, {
    headers: ingressHeaders({ cookie: SESSION_COOKIE }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { schemaVersion: 1, projects: [] });
  assert.equal(observed.length, 1);
  assert.equal(observed[0].url, '/api/projects');
  assert.equal(observed[0].headers.cookie, undefined);
  assert.equal(observed[0].headers['x-forwarded-for'], undefined);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('O2a gateway denies backup, MCP, authority, demo, mutation, and encoded bypass routes after login', { timeout: 15_000 }, async (context) => {
  let upstreamRequests = 0;
  const upstream = createServer((_request, response) => {
    upstreamRequests += 1;
    response.end('unexpected');
  });
  const upstreamOrigin = await listen(context, upstream);
  const gateway = createRemoteGateway({
    publicOrigin: 'https://studio.example.test',
    trustedProxyAddress: '127.0.0.1',
    upstreamOrigin,
    authentication: authenticationHarness(),
  });
  gateway.markReady();
  const origin = await listen(context, gateway.server);
  const routes = [
    ['/api/backups', 'GET'],
    ['/api/backups/operations', 'POST'],
    ['/internal/mcp/read-project', 'GET'],
    ['/api/projects/project.one/agent-access', 'GET'],
    ['/api/demo', 'GET'],
    ['/api/%62ackups', 'GET'],
    ['/api/projects', 'POST'],
    ['/api/projects/project.one/future-route', 'GET'],
  ];
  for (const [path, method] of routes) {
    const response = await fetch(`${origin}${path}`, {
      method,
      headers: ingressHeaders({ cookie: SESSION_COOKIE }),
    });
    assert.ok([404, 405].includes(response.status), `${method} ${path}: ${response.status}`);
  }
  assert.equal(upstreamRequests, 0);
});

test('O2a gateway requires trusted ingress, supports generic health, and revokes the browser session', { timeout: 15_000 }, async (context) => {
  const upstream = createServer((_request, response) => response.end('{}'));
  const gateway = createRemoteGateway({
    publicOrigin: 'https://studio.example.test',
    trustedProxyAddress: '127.0.0.1',
    upstreamOrigin: await listen(context, upstream),
    authentication: authenticationHarness(),
  });
  const origin = await listen(context, gateway.server);
  let response = await fetch(`${origin}/livez`);
  assert.equal(response.status, 200);
  response = await fetch(`${origin}/readyz`);
  assert.equal(response.status, 503);
  gateway.markReady();
  response = await fetch(`${origin}/readyz`);
  assert.equal(response.status, 200);

  response = await fetch(`${origin}/health`, {
    headers: ingressHeaders({ cookie: SESSION_COOKIE }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    schemaVersion: 1,
    status: 'ok',
    service: 'numberdroid-studio-remote',
    mode: 'remote',
    readOnly: true,
  });

  response = await fetch(`${origin}/api/projects`, { headers: { cookie: SESSION_COOKIE } });
  assert.equal(response.status, 403);

  response = await fetch(`${origin}/remote/session/rotate`, {
    method: 'POST',
    redirect: 'manual',
    headers: ingressHeaders({
      cookie: SESSION_COOKIE,
      origin: 'https://studio.example.test',
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/x-www-form-urlencoded',
    }),
    body: new URLSearchParams({ csrfToken: CSRF }),
  });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/remote/account');
  assert.match(response.headers.get('set-cookie'), new RegExp(`^${COOKIE_NAME}=`));

  response = await fetch(`${origin}/remote/logout`, {
    method: 'POST',
    redirect: 'manual',
    headers: ingressHeaders({
      cookie: SESSION_COOKIE,
      origin: 'https://studio.example.test',
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/x-www-form-urlencoded',
    }),
    body: new URLSearchParams({ csrfToken: CSRF }),
  });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('set-cookie'), CLEAR_COOKIE);
  response = await fetch(`${origin}/api/projects`, {
    headers: ingressHeaders({ cookie: SESSION_COOKIE }),
  });
  assert.equal(response.status, 401);
});

test('O2a login failures remain generic and never echo submitted credential bytes', { timeout: 10_000 }, async (context) => {
  const upstream = createServer((_request, response) => response.end('{}'));
  const gateway = createRemoteGateway({
    publicOrigin: 'https://studio.example.test',
    trustedProxyAddress: '127.0.0.1',
    upstreamOrigin: await listen(context, upstream),
    authentication: authenticationHarness(),
  });
  const origin = await listen(context, gateway.server);
  const sentinel = 'wrong-private-credential';
  const response = await fetch(`${origin}/remote/login`, {
    method: 'POST',
    headers: ingressHeaders({
      origin: 'https://studio.example.test',
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/x-www-form-urlencoded',
    }),
    body: new URLSearchParams({ credential: sentinel }),
  });
  assert.equal(response.status, 401);
  const page = await response.text();
  assert.match(page, /Sign-in failed/);
  assert.doesNotMatch(page, new RegExp(sentinel));
});
