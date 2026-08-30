import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const SAFE_UPSTREAM_HEADERS = [
  'content-length',
  'content-security-policy',
  'content-type',
];

function loopbackUpstream(value) {
  const url = value instanceof URL ? value : new URL(value);
  if (url.protocol !== 'http:' || !['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname)
    || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new TypeError('upstreamOrigin must be a loopback HTTP origin.');
  }
  return url;
}

function safeRequestHeaders(request) {
  const headers = {};
  for (const name of ['accept', 'accept-language']) {
    const value = request.headers[name];
    if (typeof value === 'string' && value.length <= 1024 && !/[\r\n]/.test(value)) {
      headers[name] = value;
    }
  }
  return headers;
}

export class RemoteProxyError extends Error {
  constructor(code = 'REMOTE_UPSTREAM_UNAVAILABLE', status = 502) {
    super('Remote Studio request failed.');
    this.name = 'RemoteProxyError';
    this.code = code;
    this.status = status;
  }
}

export async function proxyRemoteRead({
  request,
  response,
  upstreamOrigin,
  target,
  fetchImpl = globalThis.fetch,
}) {
  if (!request || !response || typeof target !== 'string' || typeof fetchImpl !== 'function') {
    throw new TypeError('request, response, target, and fetchImpl are required.');
  }
  const upstream = loopbackUpstream(upstreamOrigin);
  const destination = new URL(target, upstream);
  if (destination.origin !== upstream.origin) throw new RemoteProxyError('REMOTE_ROUTE_FORBIDDEN', 404);
  const abortController = new AbortController();
  const abort = () => abortController.abort();
  request.once('aborted', abort);
  response.once('close', abort);
  let upstreamResponse;
  try {
    upstreamResponse = await fetchImpl(destination, {
      method: 'GET',
      headers: safeRequestHeaders(request),
      redirect: 'manual',
      signal: abortController.signal,
    });
  } catch (error) {
    if (abortController.signal.aborted) throw error;
    throw new RemoteProxyError();
  } finally {
    request.off('aborted', abort);
  }
  if (upstreamResponse.status >= 300 && upstreamResponse.status < 400) {
    await upstreamResponse.body?.cancel().catch(() => {});
    throw new RemoteProxyError('REMOTE_UPSTREAM_REDIRECT_FORBIDDEN', 502);
  }
  if (!upstreamResponse.ok) {
    await upstreamResponse.body?.cancel().catch(() => {});
    const status = upstreamResponse.status === 404 ? 404 : 502;
    throw new RemoteProxyError(status === 404 ? 'REMOTE_RESOURCE_NOT_FOUND' : 'REMOTE_UPSTREAM_UNAVAILABLE', status);
  }
  const headers = {
    'cache-control': 'no-store',
    pragma: 'no-cache',
    expires: '0',
    'cross-origin-resource-policy': 'same-origin',
    'referrer-policy': 'no-referrer',
    'strict-transport-security': 'max-age=31536000',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
  };
  for (const name of SAFE_UPSTREAM_HEADERS) {
    const value = upstreamResponse.headers.get(name);
    if (value !== null) headers[name] = value;
  }
  response.writeHead(upstreamResponse.status, headers);
  if (upstreamResponse.body === null) {
    response.end();
    return;
  }
  await pipeline(Readable.fromWeb(upstreamResponse.body), response, {
    signal: abortController.signal,
  });
}
