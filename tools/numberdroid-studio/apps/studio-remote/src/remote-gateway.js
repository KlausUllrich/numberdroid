import { createServer } from 'node:http';
import { classifyRemoteRoute } from './remote-route-policy.js';
import { RemoteIngressError, validateRemoteMutation, validateTrustedIngress } from './remote-ingress.js';
import { proxyRemoteRead, RemoteProxyError } from './remote-proxy.js';

const MAX_FORM_BYTES = 4096;
const SECURITY_HEADERS = Object.freeze({
  'cache-control': 'no-store',
  pragma: 'no-cache',
  expires: '0',
  'cross-origin-resource-policy': 'same-origin',
  'referrer-policy': 'no-referrer',
  'strict-transport-security': 'max-age=31536000',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
});

function sendJson(response, status, value, headers = {}) {
  const body = `${JSON.stringify(value)}\n`;
  response.writeHead(status, {
    ...SECURITY_HEADERS,
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    ...headers,
  });
  response.end(body);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function loginPage({ failed = false } = {}) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Numberdroid Studio sign in</title>
<style>body{font:16px system-ui,sans-serif;max-width:32rem;margin:10vh auto;padding:1.5rem;background:#10151c;color:#f4f7fb}main{background:#18212c;border:1px solid #34465b;border-radius:12px;padding:1.5rem}label,input,button{display:block;width:100%;box-sizing:border-box}input,button{font:inherit;padding:.75rem;margin-top:.5rem}button{margin-top:1rem;font-weight:700}p{line-height:1.5}.error{color:#ffb4a9}</style>
</head><body><main><h1>Numberdroid Studio</h1><p>Sign in with the private owner credential for this Studio host.</p>
${failed ? '<p class="error" role="alert">Sign-in failed. Check the credential and try again later.</p>' : ''}
<form method="post" action="/remote/login"><label for="credential">Owner credential</label>
<input id="credential" name="credential" type="password" autocomplete="current-password" required maxlength="1024">
<button type="submit">Sign in</button></form></main></body></html>`;
}

function accountPage(session) {
  const csrf = escapeHtml(session.csrfToken);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Numberdroid Studio remote session</title></head><body><main><h1>Remote session</h1>
<p>This browser has an authenticated read-only Studio session.</p>
<p><a href="/">Return to Studio</a></p>
<form method="post" action="/remote/session/rotate"><input type="hidden" name="csrfToken" value="${csrf}"><button>Rotate this session</button></form>
<form method="post" action="/remote/logout"><input type="hidden" name="csrfToken" value="${csrf}"><button>Sign out</button></form>
<form method="post" action="/remote/sessions/revoke-all"><input type="hidden" name="csrfToken" value="${csrf}"><button>Sign out every browser</button></form>
</main></body></html>`;
}

function sendHtml(response, status, html, headers = {}) {
  response.writeHead(status, {
    ...SECURITY_HEADERS,
    'content-type': 'text/html; charset=utf-8',
    'content-length': Buffer.byteLength(html),
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    ...headers,
  });
  response.end(html);
}

async function readExactForm(request, allowedKeys) {
  const rawValues = (name) => {
    const values = [];
    for (let index = 0; index < request.rawHeaders.length; index += 2) {
      if (request.rawHeaders[index].toLowerCase() === name) values.push(request.rawHeaders[index + 1]);
    }
    return values;
  };
  const contentTypes = rawValues('content-type');
  const contentType = contentTypes.length === 1
    ? String(contentTypes[0]).split(';', 1)[0].trim().toLowerCase()
    : '';
  if (contentType !== 'application/x-www-form-urlencoded') {
    throw new RemoteGatewayError('REMOTE_REQUEST_INVALID', 400);
  }
  if (rawValues('content-encoding').length !== 0) {
    throw new RemoteGatewayError('REMOTE_REQUEST_INVALID', 400);
  }
  const lengths = rawValues('content-length');
  const transfers = rawValues('transfer-encoding');
  if (lengths.length > 1 || transfers.length > 1 || (lengths.length && transfers.length)) {
    throw new RemoteGatewayError('REMOTE_REQUEST_INVALID', 400);
  }
  const declared = lengths.length === 1 && /^(?:0|[1-9][0-9]*)$/.test(lengths[0])
    ? Number(lengths[0])
    : null;
  if ((lengths.length === 1 && (!Number.isSafeInteger(declared) || declared > MAX_FORM_BYTES))
    || (transfers.length === 1 && String(transfers[0]).toLowerCase() !== 'chunked')) {
    throw new RemoteGatewayError('REMOTE_REQUEST_INVALID', 400);
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_FORM_BYTES) throw new RemoteGatewayError('REMOTE_REQUEST_INVALID', 400);
    chunks.push(chunk);
  }
  if (declared !== null && size !== declared) {
    throw new RemoteGatewayError('REMOTE_REQUEST_INVALID', 400);
  }
  const bytes = Buffer.concat(chunks);
  try {
    const form = new URLSearchParams(bytes.toString('utf8'));
    const keys = [...form.keys()];
    if (keys.length !== allowedKeys.length
      || keys.some((key) => !allowedKeys.includes(key))
      || allowedKeys.some((key) => form.getAll(key).length !== 1)) {
      throw new RemoteGatewayError('REMOTE_REQUEST_INVALID', 400);
    }
    return Object.fromEntries(allowedKeys.map((key) => [key, form.get(key)]));
  } finally {
    bytes.fill(0);
    for (const chunk of chunks) chunk.fill(0);
  }
}

function wantsHtml(request) {
  return String(request.headers.accept ?? '').includes('text/html');
}

function cookieHeader(result) {
  if (typeof result?.setCookie === 'string') return result.setCookie;
  throw new TypeError('Authentication adapter must return setCookie.');
}

function sessionHeaders(session) {
  return typeof session?.setCookie === 'string' ? { 'set-cookie': session.setCookie } : {};
}

export class RemoteGatewayError extends Error {
  constructor(code, status) {
    super('Remote request failed.');
    this.name = 'RemoteGatewayError';
    this.code = code;
    this.status = status;
  }
}

export function createRemoteGateway({
  publicOrigin,
  trustedProxyAddress,
  upstreamOrigin,
  authentication,
  routeClassifier = classifyRemoteRoute,
  proxyRead = proxyRemoteRead,
} = {}) {
  if (!authentication
    || !['login', 'authenticate', 'rotate', 'logout', 'revokeAll']
      .every((name) => typeof authentication[name] === 'function')) {
    throw new TypeError('A complete remote authentication adapter is required.');
  }
  let ready = false;
  let closing = false;
  const server = createServer(async (request, response) => {
    const target = request.url ?? '/';
    const pathname = target.split('?', 1)[0];
    try {
      if (request.method === 'GET' && pathname === '/livez') {
        sendJson(response, 200, { schemaVersion: 1, status: 'alive' });
        return;
      }
      if (request.method === 'GET' && pathname === '/readyz') {
        sendJson(response, ready && !closing ? 200 : 503, {
          schemaVersion: 1,
          status: ready && !closing ? 'ready' : 'unavailable',
        });
        return;
      }
      const ingress = validateTrustedIngress(request, { publicOrigin, trustedProxyAddress });
      if (request.method === 'GET' && pathname === '/remote/login') {
        const session = await authentication.authenticate(request.headers.cookie ?? '');
        if (session) {
          response.writeHead(303, { ...SECURITY_HEADERS, location: '/' }).end();
        } else {
          sendHtml(response, 200, loginPage());
        }
        return;
      }
      if (request.method === 'POST' && pathname === '/remote/login') {
        validateRemoteMutation(request, { publicOrigin: ingress.publicOrigin });
        const body = await readExactForm(request, ['credential']);
        let result;
        try {
          result = await authentication.login(body.credential, {
            clientAddress: ingress.clientAddress,
          });
        } finally {
          body.credential = null;
        }
        response.writeHead(303, {
          ...SECURITY_HEADERS,
          'set-cookie': cookieHeader(result),
          location: '/',
        }).end();
        return;
      }
      const session = await authentication.authenticate(request.headers.cookie ?? '');
      if (!session) {
        if (wantsHtml(request) || pathname === '/') {
          response.writeHead(303, { ...SECURITY_HEADERS, location: '/remote/login' }).end();
        } else {
          sendJson(response, 401, { schemaVersion: 1, error: { code: 'REMOTE_AUTHENTICATION_REQUIRED' } });
        }
        return;
      }
      if (request.method === 'GET' && pathname === '/remote/account') {
        sendHtml(response, 200, accountPage(session), sessionHeaders(session));
        return;
      }
      if (request.method === 'GET' && pathname === '/remote/session') {
        sendJson(response, 200, {
          schemaVersion: 1,
          session: {
            csrfToken: session.csrfToken,
            idleExpiresAt: session.idleExpiresAt ?? null,
            absoluteExpiresAt: session.absoluteExpiresAt ?? null,
          },
        }, sessionHeaders(session));
        return;
      }
      if (request.method === 'POST' && [
        '/remote/session/rotate', '/remote/logout', '/remote/sessions/revoke-all',
      ].includes(pathname)) {
        validateRemoteMutation(request, { publicOrigin: ingress.publicOrigin });
        const body = await readExactForm(request, ['csrfToken']);
        const method = pathname.endsWith('/rotate')
          ? 'rotate'
          : pathname.endsWith('revoke-all') ? 'revokeAll' : 'logout';
        const result = await authentication[method](request.headers.cookie ?? '', body.csrfToken);
        response.writeHead(303, {
          ...SECURITY_HEADERS,
          'set-cookie': cookieHeader(result),
          location: method === 'rotate' ? '/remote/account' : '/remote/login',
        }).end();
        return;
      }
      const classification = routeClassifier({ method: request.method, target });
      if (!classification.allowed) {
        sendJson(response, classification.reason === 'METHOD_NOT_ALLOWED' ? 405 : 404, {
          schemaVersion: 1,
          error: { code: classification.reason === 'METHOD_NOT_ALLOWED' ? 'METHOD_NOT_ALLOWED' : 'NOT_FOUND' },
        }, sessionHeaders(session));
        return;
      }
      if (typeof session.setCookie === 'string') response.setHeader('set-cookie', session.setCookie);
      await proxyRead({
        request,
        response,
        upstreamOrigin,
        target: `${classification.pathname}${classification.search}`,
      });
    } catch (error) {
      if (response.headersSent || response.destroyed) {
        if (!response.destroyed) response.destroy();
        return;
      }
      if (pathname === '/remote/login' && request.method === 'POST'
        && (error.status === 401 || error.status === 429)) {
        sendHtml(response, error.status, loginPage({ failed: true }),
          error.status === 429 ? { 'retry-after': '300' } : {});
        return;
      }
      const known = error instanceof RemoteGatewayError
        || error instanceof RemoteIngressError
        || error instanceof RemoteProxyError
        || (Number.isInteger(error?.status) && /^REMOTE_/.test(error?.code ?? ''));
      sendJson(response, known ? error.status : 500, {
        schemaVersion: 1,
        error: { code: known ? error.code : 'REMOTE_INTERNAL_ERROR' },
      });
    }
  });
  return Object.freeze({
    server,
    markReady() {
      if (closing) throw new Error('Remote gateway is closing.');
      ready = true;
    },
    markClosing() {
      closing = true;
      ready = false;
    },
  });
}
