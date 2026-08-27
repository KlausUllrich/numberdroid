import { createHash } from 'node:crypto';
import { invariant } from './errors.js';

export const PROJECT_CAPABILITY_MANIFEST_SCHEMA_VERSION = 1;
export const PROJECT_CAPABILITY_MANIFEST_KIND = 'studio.project-capability-manifest';
export const PROJECT_CAPABILITY_OPERATION_KINDS = Object.freeze([
  'snapshot',
  'validate',
  'compile',
  'candidate',
]);
export const PROJECT_CAPABILITY_VOCABULARY_FIELDS = Object.freeze([
  'spaceKinds',
  'relationKinds',
  'connectionKinds',
  'propRoles',
  'actorKinds',
  'routeKinds',
  'pickupKinds',
  'zoneAnchorKinds',
  'triggerKinds',
  'conditionKinds',
  'actionKinds',
  'variableTypes',
]);

const TOKEN_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;
const NAMESPACED_ID_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+$/;
const MEDIA_TYPE_PATTERN = /^[a-z][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/;
const SECRET_KEY_PATTERN = /(?:secret|token|password|credential|authority|grant|host.?binding|idempotency|lease|private.?key|access.?key)/i;
const PATH_KEY_PATTERN = /(?:^|_)(?:path|directory|filename|filepath)(?:$|_)/i;
const URI_KEY_PATTERN = /(?:^|_)(?:uri|url|href|callback|endpoint)(?:$|_)/i;
const EXECUTABLE_KEY_PATTERN = /(?:^|_)(?:script|code|command|shell|eval|executable|expression)(?:$|_)/i;
const MACHINE_PATH_PATTERN = /^(?:\/|\\|[A-Za-z]:[\\/])|(?:^|[\\/])\.\.(?:[\\/]|$)/;
const URI_VALUE_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const HORIZONTAL_DIRECTIONS = Object.freeze(['left', 'right']);
const VERTICAL_DIRECTIONS = Object.freeze(['up', 'down']);
const ORIGINS = Object.freeze(['top-left', 'bottom-left', 'center']);
const ROTATION_DIRECTIONS = Object.freeze(['clockwise', 'counter-clockwise']);

function exactFields(value, allowed, label) {
  invariant(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    'PROJECT_CAPABILITY_MANIFEST_INVALID',
    `${label} must be an object.`,
    { field: label },
  );
  for (const field of Object.keys(value)) {
    invariant(
      allowed.includes(field),
      'PROJECT_CAPABILITY_MANIFEST_FIELD_FORBIDDEN',
      `${label}.${field} is not permitted.`,
      { field: `${label}.${field}` },
    );
  }
  return value;
}

function requireString(value, label, { min = 1, max = 256 } = {}) {
  invariant(
    typeof value === 'string' && value.length >= min && value.length <= max && value.trim() === value,
    'PROJECT_CAPABILITY_MANIFEST_INVALID',
    `${label} must be a trimmed string containing between ${min} and ${max} characters.`,
    { field: label },
  );
  invariant(
    !CONTROL_CHARACTER_PATTERN.test(value),
    'PROJECT_CAPABILITY_MANIFEST_INVALID',
    `${label} must not contain control characters.`,
    { field: label },
  );
  return value;
}

function requireToken(value, label) {
  const token = requireString(value, label, { max: 64 });
  invariant(
    TOKEN_PATTERN.test(token),
    'PROJECT_CAPABILITY_MANIFEST_INVALID',
    `${label} must be a lowercase capability token.`,
    { field: label, value: token },
  );
  return token;
}

function requireNamespacedId(value, label) {
  const id = requireString(value, label, { max: 128 });
  invariant(
    NAMESPACED_ID_PATTERN.test(id),
    'PROJECT_CAPABILITY_MANIFEST_INVALID',
    `${label} must be a lowercase dotted identifier.`,
    { field: label, value: id },
  );
  return id;
}

function requireInteger(value, label, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  invariant(
    Number.isSafeInteger(value) && value >= min && value <= max,
    'PROJECT_CAPABILITY_MANIFEST_INVALID',
    `${label} must be a safe integer between ${min} and ${max}.`,
    { field: label, value, min, max },
  );
  return value;
}

function requireBoolean(value, label) {
  invariant(
    typeof value === 'boolean',
    'PROJECT_CAPABILITY_MANIFEST_INVALID',
    `${label} must be a boolean.`,
    { field: label },
  );
  return value;
}

function requireArray(value, label, { min = 0, max = 256 } = {}) {
  invariant(
    Array.isArray(value) && value.length >= min && value.length <= max,
    'PROJECT_CAPABILITY_MANIFEST_INVALID',
    `${label} must contain between ${min} and ${max} entries.`,
    { field: label },
  );
  return value;
}

function sortedUnique(values, label, normalizer, { min = 0, max = 256 } = {}) {
  const normalized = requireArray(values, label, { min, max })
    .map((value, index) => normalizer(value, `${label}[${index}]`));
  const seen = new Set();
  for (const value of normalized) {
    const identity = typeof value === 'string' ? value : value.id;
    invariant(
      !seen.has(identity),
      'PROJECT_CAPABILITY_MANIFEST_DUPLICATE',
      `${label} contains duplicate identifier ${identity}.`,
      { field: label, id: identity },
    );
    seen.add(identity);
  }
  return normalized.sort((left, right) => {
    const leftIdentity = typeof left === 'string' ? left : left.id;
    const rightIdentity = typeof right === 'string' ? right : right.id;
    return leftIdentity.localeCompare(rightIdentity);
  });
}

function normalizeCoordinateModel(value) {
  const model = exactFields(value, [
    'dimensions', 'origin', 'axes', 'units', 'defaultUnitId', 'rotation',
  ], 'coordinateModel');
  invariant(
    model.dimensions === 2,
    'PROJECT_CAPABILITY_MANIFEST_SCHEMA_UNSUPPORTED',
    'Project capability manifest schema v1 supports only explicit two-dimensional coordinate models.',
    { field: 'coordinateModel.dimensions', value: model.dimensions },
  );
  const axes = exactFields(model.axes, ['x', 'y'], 'coordinateModel.axes');
  const x = requireToken(axes.x, 'coordinateModel.axes.x');
  const y = requireToken(axes.y, 'coordinateModel.axes.y');
  invariant(
    HORIZONTAL_DIRECTIONS.includes(x) && VERTICAL_DIRECTIONS.includes(y),
    'PROJECT_CAPABILITY_MANIFEST_INVALID',
    'coordinateModel axes must declare one horizontal x direction and one vertical y direction.',
    { field: 'coordinateModel.axes', x, y },
  );
  const units = sortedUnique(model.units, 'coordinateModel.units', (candidate, label) => {
    const unit = exactFields(candidate, ['id', 'integer', 'pixelsPerUnit'], label);
    return {
      id: requireToken(unit.id, `${label}.id`),
      integer: requireBoolean(unit.integer, `${label}.integer`),
      pixelsPerUnit: unit.pixelsPerUnit === null
        ? null
        : requireInteger(unit.pixelsPerUnit, `${label}.pixelsPerUnit`, { min: 1 }),
    };
  }, { min: 1, max: 16 });
  const defaultUnitId = requireToken(model.defaultUnitId, 'coordinateModel.defaultUnitId');
  invariant(
    units.some((unit) => unit.id === defaultUnitId),
    'PROJECT_CAPABILITY_MANIFEST_REFERENCE_UNKNOWN',
    'coordinateModel.defaultUnitId must reference a declared unit.',
    { field: 'coordinateModel.defaultUnitId', id: defaultUnitId },
  );
  const rotation = exactFields(model.rotation, [
    'unit', 'positiveDirection', 'values',
  ], 'coordinateModel.rotation');
  invariant(
    rotation.unit === 'degrees',
    'PROJECT_CAPABILITY_MANIFEST_SCHEMA_UNSUPPORTED',
    'Project capability manifest schema v1 supports rotation values in degrees only.',
    { field: 'coordinateModel.rotation.unit', value: rotation.unit },
  );
  invariant(
    ROTATION_DIRECTIONS.includes(rotation.positiveDirection),
    'PROJECT_CAPABILITY_MANIFEST_INVALID',
    'coordinateModel.rotation.positiveDirection is unsupported.',
    { field: 'coordinateModel.rotation.positiveDirection', value: rotation.positiveDirection },
  );
  const values = requireArray(rotation.values, 'coordinateModel.rotation.values', { min: 1, max: 360 })
    .map((candidate, index) => requireInteger(candidate, `coordinateModel.rotation.values[${index}]`, { min: 0, max: 359 }));
  invariant(
    new Set(values).size === values.length,
    'PROJECT_CAPABILITY_MANIFEST_DUPLICATE',
    'coordinateModel.rotation.values must not contain duplicates.',
    { field: 'coordinateModel.rotation.values' },
  );
  return {
    dimensions: 2,
    origin: (() => {
      const origin = requireToken(model.origin, 'coordinateModel.origin');
      invariant(
        ORIGINS.includes(origin),
        'PROJECT_CAPABILITY_MANIFEST_INVALID',
        'coordinateModel.origin is unsupported.',
        { field: 'coordinateModel.origin', value: origin },
      );
      return origin;
    })(),
    axes: { x, y },
    units,
    defaultUnitId,
    rotation: {
      unit: 'degrees',
      positiveDirection: rotation.positiveDirection,
      values: values.sort((left, right) => left - right),
    },
  };
}

function normalizeExtensionValue(value, path, state, depth) {
  invariant(
    depth <= 5,
    'PROJECT_CAPABILITY_EXTENSION_INVALID',
    'Capability extension nesting exceeds five levels.',
    { path },
  );
  state.nodes += 1;
  invariant(
    state.nodes <= 256,
    'PROJECT_CAPABILITY_EXTENSION_INVALID',
    'Capability extensions exceed 256 total values.',
    { path },
  );
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    invariant(
      Number.isFinite(value),
      'PROJECT_CAPABILITY_EXTENSION_INVALID',
      'Capability extension numbers must be finite.',
      { path },
    );
    return value;
  }
  if (typeof value === 'string') {
    invariant(
      value.length <= 1024 && !CONTROL_CHARACTER_PATTERN.test(value),
      'PROJECT_CAPABILITY_EXTENSION_INVALID',
      'Capability extension strings must be bounded and free of control characters.',
      { path },
    );
    invariant(
      !MACHINE_PATH_PATTERN.test(value),
      'PROJECT_CAPABILITY_EXTENSION_INVALID',
      'Machine paths and traversal are not permitted in capability extensions.',
      { path },
    );
    invariant(
      !URI_VALUE_PATTERN.test(value),
      'PROJECT_CAPABILITY_EXTENSION_INVALID',
      'URI-shaped values are not permitted in capability extensions.',
      { path },
    );
    return value;
  }
  if (Array.isArray(value)) {
    invariant(
      value.length <= 64,
      'PROJECT_CAPABILITY_EXTENSION_INVALID',
      'Capability extension arrays may contain at most 64 entries.',
      { path },
    );
    return value.map((candidate, index) => normalizeExtensionValue(candidate, `${path}/${index}`, state, depth + 1));
  }
  invariant(
    value !== null && typeof value === 'object',
    'PROJECT_CAPABILITY_EXTENSION_INVALID',
    'Unsupported capability extension value.',
    { path },
  );
  const keys = Object.keys(value).sort();
  invariant(
    keys.length <= 64,
    'PROJECT_CAPABILITY_EXTENSION_INVALID',
    'Capability extension objects may contain at most 64 keys.',
    { path },
  );
  return Object.fromEntries(keys.map((key) => {
    invariant(
      key.length > 0 && key.length <= 64 && !CONTROL_CHARACTER_PATTERN.test(key),
      'PROJECT_CAPABILITY_EXTENSION_INVALID',
      'Capability extension keys must contain 1 to 64 safe characters.',
      { path: `${path}/${key}` },
    );
    invariant(
      !SECRET_KEY_PATTERN.test(key),
      'PROJECT_CAPABILITY_EXTENSION_INVALID',
      'Secrets and authority fields are not permitted in capability extensions.',
      { path: `${path}/${key}` },
    );
    invariant(
      !PATH_KEY_PATTERN.test(key) && !/(?:path|directory|filename)$/i.test(key),
      'PROJECT_CAPABILITY_EXTENSION_INVALID',
      'Machine path fields are not permitted in capability extensions.',
      { path: `${path}/${key}` },
    );
    invariant(
      !URI_KEY_PATTERN.test(key) && !/(?:uri|url|href|endpoint)$/i.test(key),
      'PROJECT_CAPABILITY_EXTENSION_INVALID',
      'URI fields are not permitted in capability extensions.',
      { path: `${path}/${key}` },
    );
    invariant(
      !EXECUTABLE_KEY_PATTERN.test(key),
      'PROJECT_CAPABILITY_EXTENSION_INVALID',
      'Executable payload fields are not permitted in capability extensions.',
      { path: `${path}/${key}` },
    );
    return [key, normalizeExtensionValue(value[key], `${path}/${key}`, state, depth + 1)];
  }));
}

function normalizeExtensions(value) {
  const extensions = exactFields(value, Object.keys(value ?? {}), 'extensions');
  const namespaces = Object.keys(extensions).sort();
  invariant(
    namespaces.length <= 32,
    'PROJECT_CAPABILITY_EXTENSION_INVALID',
    'At most 32 capability extension namespaces are permitted.',
  );
  const state = { nodes: 0 };
  return Object.fromEntries(namespaces.map((namespace) => {
    invariant(
      NAMESPACED_ID_PATTERN.test(namespace),
      'PROJECT_CAPABILITY_EXTENSION_INVALID',
      'Capability extension keys must be lowercase dotted namespaces.',
      { namespace },
    );
    invariant(
      !SECRET_KEY_PATTERN.test(namespace),
      'PROJECT_CAPABILITY_EXTENSION_INVALID',
      'Secret or authority namespaces are not permitted.',
      { namespace },
    );
    return [namespace, normalizeExtensionValue(extensions[namespace], `/extensions/${namespace}`, state, 1)];
  }));
}

function normalizeModule(value, label) {
  const module = exactFields(value, ['id', 'version'], label);
  return {
    id: requireNamespacedId(module.id, `${label}.id`),
    version: requireString(module.version, `${label}.version`, { max: 128 }),
  };
}

function normalizeOutputFormat(value, label) {
  const format = exactFields(value, ['id', 'version', 'mediaType'], label);
  const mediaType = requireString(format.mediaType, `${label}.mediaType`, { max: 128 }).toLowerCase();
  invariant(
    MEDIA_TYPE_PATTERN.test(mediaType),
    'PROJECT_CAPABILITY_MANIFEST_INVALID',
    `${label}.mediaType must be a normalized media type.`,
    { field: `${label}.mediaType`, value: mediaType },
  );
  return {
    id: requireNamespacedId(format.id, `${label}.id`),
    version: requireInteger(format.version, `${label}.version`, { min: 0 }),
    mediaType,
  };
}

function normalizeLimit(value, label) {
  const limit = exactFields(value, ['id', 'value', 'unit'], label);
  return {
    id: requireNamespacedId(limit.id, `${label}.id`),
    value: requireInteger(limit.value, `${label}.value`, { min: 1 }),
    unit: requireToken(limit.unit, `${label}.unit`),
  };
}

function normalizeOperation(value, label) {
  const operation = exactFields(value, [
    'id', 'kind', 'version', 'moduleIds', 'inputFormatIds', 'outputFormatIds',
  ], label);
  invariant(
    PROJECT_CAPABILITY_OPERATION_KINDS.includes(operation.kind),
    'PROJECT_CAPABILITY_MANIFEST_INVALID',
    `${label}.kind is unsupported.`,
    { field: `${label}.kind`, value: operation.kind },
  );
  return {
    id: requireNamespacedId(operation.id, `${label}.id`),
    kind: operation.kind,
    version: requireInteger(operation.version, `${label}.version`, { min: 1 }),
    moduleIds: sortedUnique(operation.moduleIds, `${label}.moduleIds`, requireNamespacedId, { min: 1, max: 32 }),
    inputFormatIds: sortedUnique(operation.inputFormatIds, `${label}.inputFormatIds`, requireNamespacedId, { min: 1, max: 32 }),
    outputFormatIds: sortedUnique(operation.outputFormatIds, `${label}.outputFormatIds`, requireNamespacedId, { max: 32 }),
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function validateProjectCapabilityManifest(value) {
  const manifest = exactFields(value, [
    'schemaVersion', 'kind', 'profileId', 'profileVersion', 'adapter',
    'assetKinds', 'coordinateModel', 'modules', 'vocabulary', 'operations',
    'outputFormats', 'limits', 'extensions',
  ], 'manifest');
  invariant(
    manifest.schemaVersion === PROJECT_CAPABILITY_MANIFEST_SCHEMA_VERSION,
    'PROJECT_CAPABILITY_MANIFEST_SCHEMA_UNSUPPORTED',
    'Unsupported project capability manifest schema version.',
    { value: manifest.schemaVersion },
  );
  invariant(
    manifest.kind === PROJECT_CAPABILITY_MANIFEST_KIND,
    'PROJECT_CAPABILITY_MANIFEST_INVALID',
    'Project capability manifest kind is invalid.',
    { value: manifest.kind },
  );
  const adapter = exactFields(manifest.adapter, ['id', 'version'], 'adapter');
  const modules = sortedUnique(manifest.modules, 'modules', normalizeModule, { min: 1, max: 64 });
  const outputFormats = sortedUnique(manifest.outputFormats, 'outputFormats', normalizeOutputFormat, { min: 1, max: 64 });
  const vocabulary = exactFields(manifest.vocabulary, PROJECT_CAPABILITY_VOCABULARY_FIELDS, 'vocabulary');
  const normalizedVocabulary = Object.fromEntries(PROJECT_CAPABILITY_VOCABULARY_FIELDS.map((field) => [
    field,
    sortedUnique(vocabulary[field], `vocabulary.${field}`, requireToken, { max: 128 }),
  ]));
  const operations = sortedUnique(manifest.operations, 'operations', normalizeOperation, { min: 1, max: 128 });
  const moduleIds = new Set(modules.map((entry) => entry.id));
  const outputFormatIds = new Set(outputFormats.map((entry) => entry.id));
  for (const operation of operations) {
    for (const moduleId of operation.moduleIds) {
      invariant(
        moduleIds.has(moduleId),
        'PROJECT_CAPABILITY_MANIFEST_REFERENCE_UNKNOWN',
        `Operation ${operation.id} references unknown module ${moduleId}.`,
        { operationId: operation.id, moduleId },
      );
    }
    for (const formatId of [...operation.inputFormatIds, ...operation.outputFormatIds]) {
      invariant(
        outputFormatIds.has(formatId),
        'PROJECT_CAPABILITY_MANIFEST_REFERENCE_UNKNOWN',
        `Operation ${operation.id} references unknown format ${formatId}.`,
        { operationId: operation.id, formatId },
      );
    }
  }
  const normalized = {
    schemaVersion: PROJECT_CAPABILITY_MANIFEST_SCHEMA_VERSION,
    kind: PROJECT_CAPABILITY_MANIFEST_KIND,
    profileId: requireNamespacedId(manifest.profileId, 'profileId'),
    profileVersion: requireInteger(manifest.profileVersion, 'profileVersion', { min: 1 }),
    adapter: {
      id: requireToken(adapter.id, 'adapter.id'),
      version: requireString(adapter.version, 'adapter.version', { max: 128 }),
    },
    assetKinds: sortedUnique(manifest.assetKinds, 'assetKinds', requireToken, { min: 1, max: 64 }),
    coordinateModel: normalizeCoordinateModel(manifest.coordinateModel),
    modules,
    vocabulary: normalizedVocabulary,
    operations,
    outputFormats,
    limits: sortedUnique(manifest.limits, 'limits', normalizeLimit, { max: 128 }),
    extensions: normalizeExtensions(manifest.extensions),
  };
  return deepFreeze(normalized);
}

export function canonicalProjectCapabilityManifestJson(value) {
  return `${JSON.stringify(canonicalize(validateProjectCapabilityManifest(value)), null, 2)}\n`;
}

export function projectCapabilityManifestSha256(value) {
  return createHash('sha256').update(canonicalProjectCapabilityManifestJson(value)).digest('hex');
}
