import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { createConnection } from 'node:net';
import {
  validateRemoteMutation,
  validateTrustedIngress,
} from '../apps/studio-remote/src/remote-ingress.js';

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

function probe(port, rawHeaders) {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const chunks = [];
    socket.once('error', reject);
    socket.on('data', (chunk) => chunks.push(chunk));
    socket.once('connect', () => {
      const fields = rawHeaders.map(([name, value]) => `${name}: ${value}`).join('\r\n');
      socket.end(`POST / HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\n${fields}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    });
    socket.once('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const [head, body = ''] = raw.split('\r\n\r\n', 2);
      resolve({ status: Number(/^HTTP\/1\.1 ([0-9]{3})/.exec(head)?.[1]), body });
    });
  });
}

const validHeaders = [
  ['x-forwarded-proto', 'https'],
  ['x-forwarded-host', 'studio.example.test'],
  ['x-forwarded-for', '100.64.0.8'],
  ['origin', 'https://studio.example.test'],
  ['sec-fetch-site', 'same-origin'],
];

test('O2a ingress accepts one exact loopback HTTPS proxy hop and same-origin mutation', { timeout: 5_000 }, async (context) => {
  const server = createServer((request, response) => {
    try {
      const ingress = validateTrustedIngress(request, {
        publicOrigin: 'https://studio.example.test',
        trustedProxyAddress: '127.0.0.1',
      });
      validateRemoteMutation(request, { publicOrigin: ingress.publicOrigin });
      response.writeHead(204).end();
    } catch (error) {
      response.writeHead(error.status ?? 500).end(error.code ?? error.name);
    }
  });
  context.after(() => close(server));
  const result = await probe(await listen(server), validHeaders);
  assert.equal(result.status, 204);
});

test('O2a ingress rejects missing, duplicate, comma-joined, contradictory, or insecure forwarding proof', { timeout: 10_000 }, async (context) => {
  const server = createServer((request, response) => {
    try {
      validateTrustedIngress(request, {
        publicOrigin: 'https://studio.example.test',
        trustedProxyAddress: '127.0.0.1',
      });
      response.writeHead(204).end();
    } catch (error) {
      response.writeHead(error.status ?? 500).end(error.code ?? error.name);
    }
  });
  context.after(() => close(server));
  const port = await listen(server);
  const variants = [
    validHeaders.filter(([name]) => name !== 'x-forwarded-proto'),
    validHeaders.map(([name, value]) => [name, name === 'x-forwarded-proto' ? 'http' : value]),
    [...validHeaders, ['x-forwarded-proto', 'https']],
    validHeaders.map(([name, value]) => [name, name === 'x-forwarded-for' ? '100.64.0.8, 127.0.0.1' : value]),
    [...validHeaders, ['forwarded', 'for=100.64.0.8;proto=https']],
    validHeaders.map(([name, value]) => [name, name === 'x-forwarded-host' ? 'other.example.test' : value]),
  ];
  for (const headers of variants) {
    const result = await probe(port, headers);
    assert.equal(result.status, 403, JSON.stringify(headers));
    assert.match(result.body, /REMOTE_INGRESS_FORBIDDEN/);
  }
});

test('O2a mutation proof requires exact Origin and Sec-Fetch-Site', { timeout: 10_000 }, async (context) => {
  const server = createServer((request, response) => {
    try {
      validateRemoteMutation(request, { publicOrigin: 'https://studio.example.test' });
      response.writeHead(204).end();
    } catch (error) {
      response.writeHead(error.status ?? 500).end(error.code ?? error.name);
    }
  });
  context.after(() => close(server));
  const port = await listen(server);
  for (const headers of [
    validHeaders.filter(([name]) => name !== 'origin'),
    validHeaders.map(([name, value]) => [name, name === 'origin' ? 'https://attacker.example' : value]),
    validHeaders.map(([name, value]) => [name, name === 'sec-fetch-site' ? 'cross-site' : value]),
  ]) {
    const result = await probe(port, headers);
    assert.equal(result.status, 403);
    assert.match(result.body, /REMOTE_ORIGIN_FORBIDDEN/);
  }
});
