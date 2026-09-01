import { types as utilTypes } from 'node:util';
import { AUTHORING_V2_PRIVATE_GRANT_SCOPES } from '../../domain/src/authoring-v2-registry.js';
import { A4C_PRIVATE_GRANT_SCOPES } from '../../domain/src/level-candidate-authority.js';
import { KNOWN_GRANT_SCOPES } from '../../domain/src/command-catalog.js';
import { invariant } from '../../domain/src/errors.js';

const SCOPE_PATTERN = /^[a-z][a-z0-9.-]{0,99}$/;
const LEGACY_SCOPES = Object.freeze([...KNOWN_GRANT_SCOPES].sort());
const AUTHORING_V2_SCOPES = Object.freeze([
  ...KNOWN_GRANT_SCOPES,
  ...AUTHORING_V2_PRIVATE_GRANT_SCOPES,
].sort());
const A4C_SCOPES = Object.freeze([
  ...KNOWN_GRANT_SCOPES,
  ...A4C_PRIVATE_GRANT_SCOPES,
].sort());

function sameScopes(left, right) {
  return left.length === right.length && left.every((scope, index) => scope === right[index]);
}

export function validateTrustedGrantScopes(value = KNOWN_GRANT_SCOPES) {
  invariant(
    Array.isArray(value)
      && !utilTypes.isProxy(value)
      && Object.getPrototypeOf(value) === Array.prototype
      && value.length >= KNOWN_GRANT_SCOPES.length
      && value.length <= A4C_SCOPES.length,
    'GRANT_SCOPE_CATALOG_INVALID',
    'The trusted grant-scope catalog must be a supported bounded plain array.',
  );
  const allowedKeys = new Set(['length', ...Array.from({ length: value.length }, (_, index) => String(index))]);
  invariant(
    Reflect.ownKeys(value).every((key) => typeof key === 'string' && allowedKeys.has(key)),
    'GRANT_SCOPE_CATALOG_INVALID',
    'The trusted grant-scope catalog contains unsupported fields.',
  );
  const scopes = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    invariant(
      descriptor
        && Object.hasOwn(descriptor, 'value')
        && descriptor.enumerable === true
        && typeof descriptor.value === 'string'
        && SCOPE_PATTERN.test(descriptor.value),
      'GRANT_SCOPE_CATALOG_INVALID',
      'The trusted grant-scope catalog contains an invalid scope.',
      { index },
    );
    scopes.push(descriptor.value);
  }
  scopes.sort();
  invariant(
    sameScopes(scopes, LEGACY_SCOPES)
      || sameScopes(scopes, AUTHORING_V2_SCOPES)
      || sameScopes(scopes, A4C_SCOPES),
    'GRANT_SCOPE_CATALOG_INVALID',
    'The trusted grant-scope catalog must exactly match a supported version.',
  );
  return Object.freeze(scopes);
}
