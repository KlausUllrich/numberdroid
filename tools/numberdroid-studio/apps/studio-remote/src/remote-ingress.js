import { isIP } from 'node:net';

const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1']);

function normalizedAddress(value) {
  if (value === '::ffff:127.0.0.1') return '127.0.0.1';
  return value;
}

function headerOccurrences(request, expectedName) {
  const values = [];
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    if (request.rawHeaders[index].toLowerCase() === expectedName) {
      values.push(request.rawHeaders[index + 1]);
    }
  }
  return values;
}

function exactHeader(request, name, {
  required = true,
  code = 'REMOTE_INGRESS_FORBIDDEN',
} = {}) {
  const normalizedName = name.toLowerCase();
  const values = headerOccurrences(request, normalizedName);
  if (values.length === 0 && !required) return null;
  if (values.length !== 1 || typeof values[0] !== 'string' || values[0].includes(',')) {
    throw new RemoteIngressError(code, 403);
  }
  const value = values[0].trim();
  if (!value) throw new RemoteIngressError(code, 403);
  return value;
}

function canonicalPublicOrigin(value) {
  const origin = value instanceof URL ? value : new URL(value);
  if (origin.protocol !== 'https:' || origin.username || origin.password
    || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new TypeError('publicOrigin must be a canonical HTTPS origin.');
  }
  return origin;
}

export class RemoteIngressError extends Error {
  constructor(code, status = 403) {
    super('Remote request rejected.');
    this.name = 'RemoteIngressError';
    this.code = code;
    this.status = status;
  }
}

export function validateTrustedIngress(request, {
  publicOrigin,
  trustedProxyAddress,
} = {}) {
  if (!request?.socket || !Array.isArray(request.rawHeaders)) {
    throw new TypeError('A Node HTTP request is required.');
  }
  const origin = canonicalPublicOrigin(publicOrigin);
  const trustedAddress = normalizedAddress(trustedProxyAddress);
  if (!LOOPBACK_ADDRESSES.has(trustedAddress)) {
    throw new TypeError('trustedProxyAddress must be one exact loopback address.');
  }
  if (normalizedAddress(request.socket.remoteAddress) !== trustedAddress) {
    throw new RemoteIngressError('REMOTE_INGRESS_FORBIDDEN', 403);
  }
  if (headerOccurrences(request, 'forwarded').length !== 0) {
    throw new RemoteIngressError('REMOTE_INGRESS_FORBIDDEN', 403);
  }
  const protocol = exactHeader(request, 'x-forwarded-proto');
  const host = exactHeader(request, 'x-forwarded-host');
  const clientAddress = exactHeader(request, 'x-forwarded-for');
  const forwardedPort = exactHeader(request, 'x-forwarded-port', { required: false });
  const expectedPort = origin.port || '443';
  if (protocol !== 'https' || host !== origin.host
    || (forwardedPort !== null && forwardedPort !== expectedPort)
    || !isIP(clientAddress)) {
    throw new RemoteIngressError('REMOTE_INGRESS_FORBIDDEN', 403);
  }
  return Object.freeze({
    clientAddress,
    publicOrigin: origin.origin,
  });
}

export function validateRemoteMutation(request, { publicOrigin } = {}) {
  const origin = canonicalPublicOrigin(publicOrigin);
  const requestOrigin = exactHeader(request, 'origin', { code: 'REMOTE_ORIGIN_FORBIDDEN' });
  const fetchSite = exactHeader(request, 'sec-fetch-site', { code: 'REMOTE_ORIGIN_FORBIDDEN' });
  if (requestOrigin !== origin.origin || fetchSite !== 'same-origin') {
    throw new RemoteIngressError('REMOTE_ORIGIN_FORBIDDEN', 403);
  }
}
