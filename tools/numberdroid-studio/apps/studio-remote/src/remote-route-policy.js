const STATIC_PATHS = new Set([
  '/',
  '/app.js',
  '/a1-7-state.js',
  '/o1b-backups-state.js',
  '/remote-ui-mode.js',
  '/styles.css',
  '/favicon.svg',
]);

const READ_PATH_PATTERNS = Object.freeze([
  /^\/api\/projects$/,
  /^\/api\/projects\/[^/]+$/,
  /^\/api\/projects\/[^/]+\/activity$/,
  /^\/api\/projects\/[^/]+\/tasks$/,
  /^\/api\/projects\/[^/]+\/tasks\/[^/]+$/,
  /^\/api\/projects\/[^/]+\/source-intakes$/,
  /^\/api\/projects\/[^/]+\/assets$/,
  /^\/api\/projects\/[^/]+\/assets\/[^/]+$/,
  /^\/api\/projects\/[^/]+\/rooms$/,
  /^\/api\/projects\/[^/]+\/rooms\/[^/]+$/,
  /^\/api\/projects\/[^/]+\/jobs\/[^/]+$/,
  /^\/api\/projects\/[^/]+\/artifacts\/sha256\/[a-f0-9]{64}$/,
  /^\/api\/projects\/[^/]+\/tasks\/[^/]+\/processing-result-adoptions$/,
]);

const PROCESSING_RESULT_PREVIEW_PATH =
  /^\/api\/projects\/[^/]+\/tasks\/[^/]+\/processing-result-adoptions\/([1-9][0-9]*)\/selected-output$/;

const HEX_ESCAPE = /^[0-9A-Fa-f]{2}$/;
const ENCODED_SEPARATOR = /%(?:2f|5c)/i;
const INVALID_RAW_CHARACTER = /[\u0000-\u0020\u007f]/;
const ABSOLUTE_FORM = /^[A-Za-z][A-Za-z0-9+.-]*:\/\/([^/?#]*)/;
const NETWORK_PATH_FORM = /^\/\/([^/?#]*)/;
const MAX_TARGET_BYTES = 8 * 1024;
const MAX_QUERY_VALUE_BYTES = 1024;

const ASSET_QUERY_KEYS = new Set([
  'proposalId', 'text', 'kinds', 'lifecycles', 'tags', 'findingSeverities',
  'includeProposals', 'limit',
]);
const ROOM_QUERY_KEYS = new Set([
  'roomArchetypeId', 'proposalId', 'kinds', 'lifecycles',
  'includeVersions', 'includeProposals', 'limit',
]);

function classification({ allowed, kind = null, pathname = null, search = null, reason = null }) {
  const value = { allowed, kind, pathname, search };
  if (reason !== null) value.reason = reason;
  return Object.freeze(value);
}

function denied(reason, pathname = null, search = null) {
  return classification({ allowed: false, pathname, search, reason });
}

function absoluteTargetDenial(target) {
  const absolute = ABSOLUTE_FORM.exec(target);
  if (absolute) {
    return absolute[1].includes('@') ? 'TARGET_USERINFO_FORBIDDEN' : 'TARGET_ABSOLUTE_FORM';
  }
  const networkPath = NETWORK_PATH_FORM.exec(target);
  if (networkPath) {
    return networkPath[1].includes('@') ? 'TARGET_USERINFO_FORBIDDEN' : 'TARGET_ABSOLUTE_FORM';
  }
  return null;
}

function validatePercentEncoding(target) {
  for (let index = 0; index < target.length; index += 1) {
    if (target[index] !== '%') continue;
    const escape = target.slice(index + 1, index + 3);
    if (!HEX_ESCAPE.test(escape)) return 'TARGET_MALFORMED_PERCENT_ENCODING';
    if (escape !== escape.toUpperCase()) return 'TARGET_NON_CANONICAL_ENCODING';
    index += 2;
  }
  try {
    decodeURIComponent(target);
  } catch {
    return 'TARGET_MALFORMED_PERCENT_ENCODING';
  }
  return null;
}

function canonicalPathDenial(pathname) {
  if (pathname.includes('//')) return 'TARGET_DOUBLE_SLASH';

  const segments = pathname.split('/').slice(1);
  for (const segment of segments) {
    if (segment === '') continue;
    let decoded;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      return 'TARGET_MALFORMED_PERCENT_ENCODING';
    }
    if (decoded === '.' || decoded === '..') return 'TARGET_DOT_SEGMENT';
    if (encodeURIComponent(decoded) !== segment) return 'TARGET_NON_CANONICAL_ENCODING';
  }
  return null;
}

function hardDenyReason(pathname) {
  if (/^\/api\/backups(?:\/|$)/.test(pathname)) return 'BACKUPS_ROUTE_FORBIDDEN';
  if (/^\/internal\/mcp(?:\/|$)/.test(pathname)) return 'MCP_ROUTE_FORBIDDEN';
  if (/^\/api\/demo(?:\/|$)/.test(pathname)) return 'DEMO_ROUTE_FORBIDDEN';
  if (/^\/api\/projects\/[^/]+\/(?:agent-access|pairing|bindings)(?:\/|$)/.test(pathname)
    || /^\/(?:api|internal)\/(?:agent-access|pairing|bindings)(?:\/|$)/.test(pathname)) {
    return 'AUTHORITY_ROUTE_FORBIDDEN';
  }
  return null;
}

function isReadPath(pathname) {
  if (READ_PATH_PATTERNS.some((pattern) => pattern.test(pathname))) return true;

  const preview = PROCESSING_RESULT_PREVIEW_PATH.exec(pathname);
  if (!preview) return false;
  const branchRevision = Number(preview[1]);
  return Number.isSafeInteger(branchRevision)
    && branchRevision >= 2
    && String(branchRevision) === preview[1];
}

function canonicalInteger(value, { allowZero = false } = {}) {
  const pattern = allowZero ? /^(?:0|[1-9][0-9]*)$/ : /^[1-9][0-9]*$/;
  if (!pattern.test(value)) return false;
  const number = Number(value);
  return Number.isSafeInteger(number) && (allowZero ? number >= 0 : number > 0)
    && String(number) === value;
}

function queryEntries(search) {
  if (search === '') return [];
  if (search === '?' || search.length > MAX_TARGET_BYTES) return null;
  const entries = [];
  for (const field of search.slice(1).split('&')) {
    const separator = field.indexOf('=');
    if (separator <= 0 || separator !== field.lastIndexOf('=')) return null;
    const rawKey = field.slice(0, separator);
    const rawValue = field.slice(separator + 1);
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(rawKey) || rawValue.includes('+')) return null;
    let value;
    try {
      value = decodeURIComponent(rawValue);
    } catch {
      return null;
    }
    if (encodeURIComponent(value) !== rawValue) return null;
    entries.push([rawKey, value]);
  }
  if (entries.length === 0 || entries.length > 32) return null;
  if (entries.some(([key, value]) => (
    key.length === 0
    || Buffer.byteLength(key, 'utf8') > 64
    || Buffer.byteLength(value, 'utf8') > MAX_QUERY_VALUE_BYTES
  ))) return null;
  return entries;
}

function validatedKnownQuery(entries, {
  allowedKeys,
  singularKeys,
  booleanKeys,
  integerKeys,
} = {}) {
  if (entries.some(([key]) => !allowedKeys.has(key))) return false;
  const grouped = new Map();
  for (const [key, value] of entries) {
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(value);
  }
  for (const [key, values] of grouped) {
    if (values.length > 8 || values.some((value) => value.length === 0)) return false;
    if (singularKeys.has(key) && values.length !== 1) return false;
    if (booleanKeys.has(key) && !['true', 'false'].includes(values[0])) return false;
    if (integerKeys.has(key) && !canonicalInteger(values[0])) return false;
  }
  return true;
}

function queryAllowed(pathname, search) {
  if (search === '') return true;
  const entries = queryEntries(search);
  if (entries === null) return false;

  if (/^\/api\/projects\/[^/]+\/activity$/.test(pathname)) {
    return entries.length === 1
      && entries[0][0] === 'afterRevision'
      && canonicalInteger(entries[0][1], { allowZero: true });
  }
  if (/^\/api\/projects\/[^/]+\/assets(?:\/[^/]+)?$/.test(pathname)) {
    return validatedKnownQuery(entries, {
      allowedKeys: ASSET_QUERY_KEYS,
      singularKeys: new Set(['proposalId', 'text', 'includeProposals', 'limit']),
      booleanKeys: new Set(['includeProposals']),
      integerKeys: new Set(['limit']),
    });
  }
  if (/^\/api\/projects\/[^/]+\/rooms(?:\/[^/]+)?$/.test(pathname)) {
    return validatedKnownQuery(entries, {
      allowedKeys: ROOM_QUERY_KEYS,
      singularKeys: new Set([
        'roomArchetypeId', 'proposalId', 'includeVersions', 'includeProposals', 'limit',
      ]),
      booleanKeys: new Set(['includeVersions', 'includeProposals']),
      integerKeys: new Set(['limit']),
    });
  }
  return false;
}

/**
 * Classifies one raw Node.js request target for the remote human gateway.
 *
 * This policy is intentionally a positive allowlist. It neither authenticates
 * the caller nor grants application authority; the gateway must perform those
 * checks before forwarding an allowed target.
 */
export function classifyRemoteRoute(input) {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('Remote route classification requires an input object.');
  }
  const { method, target } = input;
  if (typeof method !== 'string' || typeof target !== 'string') {
    throw new TypeError('Remote route classification requires string method and target values.');
  }

  if (Buffer.byteLength(target, 'utf8') > MAX_TARGET_BYTES) {
    return denied('TARGET_TOO_LARGE');
  }

  const absoluteDenial = absoluteTargetDenial(target);
  if (absoluteDenial !== null) return denied(absoluteDenial);
  if (!target.startsWith('/')) return denied('TARGET_NOT_ORIGIN_FORM');
  if (target.includes('#')) return denied('TARGET_FRAGMENT_FORBIDDEN');
  if (INVALID_RAW_CHARACTER.test(target)) return denied('TARGET_INVALID_RAW_CHARACTER');
  if (target.includes('\\')) return denied('TARGET_BACKSLASH_FORBIDDEN');

  if (ENCODED_SEPARATOR.test(target)) return denied('TARGET_ENCODED_SEPARATOR');
  const encodingDenial = validatePercentEncoding(target);
  if (encodingDenial !== null) return denied(encodingDenial);

  const queryIndex = target.indexOf('?');
  const pathname = queryIndex === -1 ? target : target.slice(0, queryIndex);
  const search = queryIndex === -1 ? '' : target.slice(queryIndex);
  const pathDenial = canonicalPathDenial(pathname);
  if (pathDenial !== null) return denied(pathDenial, pathname, search);

  const hardDenial = hardDenyReason(pathname);
  if (hardDenial !== null) return denied(hardDenial, pathname, search);
  if (method !== 'GET') return denied('METHOD_NOT_ALLOWED', pathname, search);

  if (STATIC_PATHS.has(pathname)) {
    if (search !== '') return denied('QUERY_NOT_ALLOWED', pathname, search);
    return classification({ allowed: true, kind: 'static', pathname, search });
  }
  if (isReadPath(pathname)) {
    if (!queryAllowed(pathname, search)) return denied('QUERY_NOT_ALLOWED', pathname, search);
    return classification({ allowed: true, kind: 'read', pathname, search });
  }
  return denied('ROUTE_NOT_ALLOWED', pathname, search);
}
