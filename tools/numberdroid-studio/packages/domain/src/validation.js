import { invariant } from './errors.js';

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function requireRecord(value, label) {
  invariant(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    'VALIDATION_ERROR',
    `${label} must be an object.`,
    { field: label },
  );
  return value;
}

export function requireString(value, label, { min = 1, max = 4096 } = {}) {
  invariant(typeof value === 'string', 'VALIDATION_ERROR', `${label} must be a string.`, { field: label });
  const trimmed = value.trim();
  invariant(
    trimmed.length >= min && trimmed.length <= max,
    'VALIDATION_ERROR',
    `${label} must contain between ${min} and ${max} characters.`,
    { field: label },
  );
  return trimmed;
}

export function optionalString(value, label, options = {}) {
  return value === undefined || value === null || value === '' ? null : requireString(value, label, options);
}

export function requireId(value, label) {
  const id = requireString(value, label, { min: 1, max: 128 });
  invariant(ID_PATTERN.test(id), 'VALIDATION_ERROR', `${label} is not a valid stable identifier.`, {
    field: label,
    value: id,
  });
  return id;
}

export function requireInteger(value, label, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  invariant(Number.isInteger(value), 'VALIDATION_ERROR', `${label} must be an integer.`, { field: label });
  invariant(value >= min && value <= max, 'VALIDATION_ERROR', `${label} is outside its permitted range.`, {
    field: label,
    min,
    max,
  });
  return value;
}

export function requireEnum(value, label, allowed) {
  invariant(allowed.includes(value), 'VALIDATION_ERROR', `${label} must be one of: ${allowed.join(', ')}.`, {
    field: label,
    allowed,
  });
  return value;
}

export function requireIsoDate(value, label) {
  const date = requireString(value, label, { max: 64 });
  invariant(!Number.isNaN(Date.parse(date)), 'VALIDATION_ERROR', `${label} must be an ISO date-time.`, {
    field: label,
  });
  return date;
}

export function requireArtifactUri(value, label) {
  const uri = requireString(value, label, { max: 2048 });
  invariant(!uri.startsWith('data:'), 'VALIDATION_ERROR', `${label} must reference an artifact, not embed one.`, {
    field: label,
  });
  invariant(
    uri.startsWith('studio://') || uri.startsWith('file://') || uri.startsWith('https://'),
    'VALIDATION_ERROR',
    `${label} must use studio://, file://, or https://.`,
    { field: label },
  );
  return uri;
}

export function requireActor(value) {
  const actor = requireRecord(value, 'actor');
  return {
    id: requireId(actor.id, 'actor.id'),
    kind: requireEnum(actor.kind, 'actor.kind', ['human', 'agent', 'system']),
    displayName: optionalString(actor.displayName, 'actor.displayName', { max: 160 }),
  };
}
