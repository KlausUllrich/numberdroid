import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { proxyRemoteRead } from '../apps/studio-remote/src/remote-proxy.js';

function listen(context, server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      context.after(() => new Promise((resolveClose) => server.close(resolveClose)));
      resolve(`http://127.0.0.1:${server.address().port}/`);
    });
  });
}

test('O2a proxy forwards only bounded content negotiation and forces remote no-store headers', { timeout: 10_000 }, async (context) => {
  let observed = null;
  const upstream = createServer((request, response) => {
    observed = { url: request.url, headers: request.headers };
    const body = JSON.stringify({ schemaVersion: 1, projects: [] });
    response.writeHead(200, {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body),
      'cache-control': 'private, max-age=31536000, immutable',
      'set-cookie': 'upstream-secret=must-not-escape',
      location: 'https://attacker.example/',
      'access-control-allow-origin': '*',
    });
    response.end(body);
  });
  const upstreamOrigin = await listen(context, upstream);
  const gateway = createServer(async (request, response) => {
    await proxyRemoteRead({ request, response, upstreamOrigin, target: '/api/projects?view=summary' });
  });
  const gatewayOrigin = await listen(context, gateway);
  const result = await fetch(gatewayOrigin, {
    headers: {
      accept: 'application/json',
      'accept-language': 'de',
      authorization: 'Bearer remote-secret',
      cookie: '__Host-numberdroid_remote_session=remote-secret',
      'x-forwarded-for': '100.64.0.8',
    },
  });
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { schemaVersion: 1, projects: [] });
  assert.equal(observed.url, '/api/projects?view=summary');
  assert.equal(observed.headers.accept, 'application/json');
  assert.equal(observed.headers['accept-language'], 'de');
  for (const forbidden of ['authorization', 'cookie', 'x-forwarded-for', 'origin', 'x-numberdroid-studio-csrf']) {
    assert.equal(observed.headers[forbidden], undefined);
  }
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.equal(result.headers.get('set-cookie'), null);
  assert.equal(result.headers.get('location'), null);
  assert.equal(result.headers.get('access-control-allow-origin'), null);
  assert.equal(result.headers.get('strict-transport-security'), 'max-age=31536000');
});

test('O2a proxy refuses redirects without contacting their target or exposing Location', { timeout: 10_000 }, async (context) => {
  let redirected = 0;
  const target = createServer((_request, response) => {
    redirected += 1;
    response.end('must not be reached');
  });
  const targetOrigin = await listen(context, target);
  const redirector = createServer((_request, response) => {
    response.writeHead(307, { location: targetOrigin });
    response.end();
  });
  const upstreamOrigin = await listen(context, redirector);
  const gateway = createServer(async (request, response) => {
    try {
      await proxyRemoteRead({ request, response, upstreamOrigin, target: '/api/projects' });
    } catch (error) {
      response.writeHead(error.status).end(error.code);
    }
  });
  const result = await fetch(await listen(context, gateway));
  assert.equal(result.status, 502);
  assert.equal(await result.text(), 'REMOTE_UPSTREAM_REDIRECT_FORBIDDEN');
  assert.equal(result.headers.get('location'), null);
  assert.equal(redirected, 0);
});

test('O2a proxy normalizes upstream errors instead of forwarding private bodies', { timeout: 10_000 }, async (context) => {
  const upstream = createServer((_request, response) => {
    response.writeHead(500, { 'content-type': 'text/plain', 'set-cookie': 'secret=value' });
    response.end('/private/workspace/studio.sqlite');
  });
  const upstreamOrigin = await listen(context, upstream);
  const gateway = createServer(async (request, response) => {
    try {
      await proxyRemoteRead({ request, response, upstreamOrigin, target: '/api/projects' });
    } catch (error) {
      response.writeHead(error.status).end(error.code);
    }
  });
  const result = await fetch(await listen(context, gateway));
  assert.equal(result.status, 502);
  const body = await result.text();
  assert.equal(body, 'REMOTE_UPSTREAM_UNAVAILABLE');
  assert.doesNotMatch(body, /private|sqlite/);
  assert.equal(result.headers.get('set-cookie'), null);
});
