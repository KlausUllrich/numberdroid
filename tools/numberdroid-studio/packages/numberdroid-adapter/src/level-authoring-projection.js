import { createHash } from 'node:crypto';
import { types as utilTypes } from 'node:util';
import {
  validateLevelGraph,
  validateLevelRequirementSet,
  validateLogicGraph,
} from '../../domain/src/index.js';
import { createNumberdroidProjectCapabilityProfile } from './project-capabilities.js';

export const NUMBERDROID_LEVEL_AUTHORING_PROJECTION_SCHEMA_VERSION = 1;
export const NUMBERDROID_LEVEL_AUTHORING_PROJECTION_KIND = 'numberdroid.level-authoring-projection';
export const NUMBERDROID_LEVEL_AUTHORING_PROJECTION_VERSION = 'numberdroid.level-authoring-projection.v1';

const ADAPTER_VERSION = 'numberdroid-studio.adapter.v1';
const BASELINE_CAPABILITY_FINGERPRINT = '826a8b7942ccba97393f55efa356525529994ad34189446992a7dff58fe97049';
const COMPILER_VERSION_PATTERN = /^numberdroid-level-compiler\.sha256:[a-f0-9]{64}$/;
const A3A_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const ARRAY_INDEX_PATTERN = /^(?:0|[1-9][0-9]*)$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const MAX_DEPTH = 64;
const MAX_ARRAY_ENTRIES = 4_096;
const MAX_OBJECT_FIELDS = 4_096;
const MAX_NODES = 100_000;
const MAX_VALUES = 200_000;
const MAX_STRING_LENGTH = 4_000_000;
const MAX_AGGREGATE_TEXT = 12_000_000;
const MAX_KEY_LENGTH = 128;
const MAX_NUMBER_MAGNITUDE = Number.MAX_SAFE_INTEGER;
const A3A_COLLECTION_LIMIT = 512;
const LEVEL_SPEC_SNAPSHOT_LIMITS = Object.freeze({
  maxStringLength: 65_536,
  maxAggregateText: 1_000_000,
});
const PROJECTION_SNAPSHOT_LIMITS = Object.freeze({
  maxDepth: MAX_DEPTH + 8,
  maxArrayEntries: 400_000,
  maxNodes: 750_000,
  maxValues: 2_000_000,
  maxStringLength: 8_000_000,
  maxAggregateText: 96_000_000,
});

const SPACE_KINDS = new Set(['room', 'corridor']);
const SIZE_CLASSES = new Set(['tiny', 'small', 'medium', 'large', 'hero']);
const RATIONALITIES = new Set(['domestic', 'neutral', 'ritual', 'system']);
const RELATIONS = new Set([
  'adjacent', 'north_of', 'south_of', 'east_of', 'west_of',
  'north_east_of', 'north_west_of', 'south_east_of', 'south_west_of',
]);
const CONSTRAINT_STRENGTHS = new Set(['required', 'preferred']);
const CARDINAL_DIRECTIONS = new Set(['north', 'south', 'east', 'west']);
const ORIENTATIONS = new Set(['horizontal', 'vertical', 'any']);
const CONNECTION_KINDS = new Set(['opening', 'standard-door', 'controlled-door']);
const PROP_ROLES = new Set(['hero', 'support', 'furniture', 'dressing']);
const ROUTE_KINDS = new Set(['patrol', 'passby', 'scripted']);
const ENEMIES = new Set(['sentry', 'magnetar', 'kronos']);
const BODIES = new Set(['pico', 'sentry', 'magnetar', 'kronos']);
const BEHAVIORS = new Set(['neutral', 'guard', 'patrol', 'aggressive']);
const MATH_MODES = new Set(['add-easy', 'add-normal', 'add-hard', 'subtract']);
const MATH_ROLES = new Set(['comfort', 'core', 'stretch', 'specialist', 'boss']);
const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const ZONE_ANCHOR_KINDS = new Set(['space-center', 'connection', 'prop', 'actor', 'route', 'pickup']);
const ROUTE_POSITIONS = new Set(['start', 'middle', 'end']);
const TRIGGER_KINDS = new Set(['enter-space', 'enter-zone', 'interact', 'collect', 'state-change', 'proximity', 'timer']);
const PROP_ROTATIONS = new Set([0, 90, 180, 270]);

const EVENT_FIELDS = Object.freeze(Object.assign(Object.create(null), {
  'set-flag': ['id', 'kind', 'flag', 'value'],
  'grant-key': ['id', 'kind', 'keyId'],
  'unlock-door': ['id', 'kind', 'doorId'],
  'lock-door': ['id', 'kind', 'doorId'],
  'spawn-actor': ['id', 'kind', 'actorId', 'spaceId'],
  'despawn-actor': ['id', 'kind', 'actorId'],
  'move-actor': ['id', 'kind', 'actorId', 'routeId'],
  'actor-passby': ['id', 'kind', 'actorId', 'routeId', 'durationMs'],
  'story-beat': ['id', 'kind', 'beatId', 'blocking'],
}));

const GAP_DESCRIPTIONS = Object.freeze({
  'numberdroid.requirement-trace.not-authored': 'Current Numberdroid LevelSpec values do not author A3a requirement and assumption traces.',
  'numberdroid.props.asset-transform-pins-missing': 'Numberdroid prop requests do not carry the immutable asset/version/metadata/fingerprint and transform pins required by A3a placements.',
  'numberdroid.encounters.archetype-version-missing': 'Numberdroid encounter intents do not carry an immutable actor archetype version pin.',
  'numberdroid.staged-actors.archetype-version-missing': 'Numberdroid staged actors do not carry an immutable actor archetype version pin.',
  'numberdroid.routes.repeated-space-not-representable': 'A3a routes require unique ordered space identifiers, while Numberdroid routes may repeat spaces.',
  'numberdroid.identifiers.a3a-vocabulary-mismatch': 'One or more valid Numberdroid identifiers are outside the stricter A3a identifier vocabulary.',
  'numberdroid.zones.anchor-target-not-projected': 'A Numberdroid zone anchor targets an entity that is not safely projected into the A3a level graph.',
  'numberdroid.logic.a3a-vocabulary-mismatch': 'Existing Numberdroid trigger/event semantics are retained in the compiler closure but are not the bounded A3a typed-logic vocabulary.',
  'numberdroid.flags.declaration-type-initial-value-missing': 'Numberdroid set-flag events do not declare the variable type and initial value required by A3a typed variables.',
  'numberdroid.a3a.collection-limit-exceeded': 'The lossless Numberdroid closure exceeds an A3a schema-v1 collection limit; the excess remains only in the Numberdroid closure.',
});

const BASELINE_CAPABILITY = createNumberdroidProjectCapabilityProfile(ADAPTER_VERSION);
if (BASELINE_CAPABILITY.fingerprint !== BASELINE_CAPABILITY_FINGERPRINT) {
  throw new Error('Numberdroid production capability baseline changed without an A4a contract update.');
}

export class NumberdroidLevelAuthoringProjectionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'NumberdroidLevelAuthoringProjectionError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new NumberdroidLevelAuthoringProjectionError(code, message, details);
}

function invariant(condition, code, message, details = {}) {
  if (!condition) fail(code, message, details);
}

function safely(action, label) {
  try {
    return action();
  } catch (error) {
    if (error instanceof NumberdroidLevelAuthoringProjectionError) throw error;
    fail('NUMBERDROID_LEVEL_PROJECTION_INPUT_INVALID', `${label} could not be inspected safely.`, { field: label });
  }
}

function snapshotPlainData(value, label = 'value', {
  rejectSharedReferences = true,
  maxDepth = MAX_DEPTH,
  maxArrayEntries = MAX_ARRAY_ENTRIES,
  maxObjectFields = MAX_OBJECT_FIELDS,
  maxNodes = MAX_NODES,
  maxValues = MAX_VALUES,
  maxStringLength = MAX_STRING_LENGTH,
  maxAggregateText = MAX_AGGREGATE_TEXT,
  maxKeyLength = MAX_KEY_LENGTH,
  maxNumberMagnitude = MAX_NUMBER_MAGNITUDE,
} = {}) {
  const state = { nodes: 0, values: 0, text: 0, seen: new WeakSet(), active: new WeakSet() };

  function visit(candidate, path, depth) {
    invariant(depth <= maxDepth, 'NUMBERDROID_LEVEL_PROJECTION_LIMIT_EXCEEDED', `${path} exceeds the maximum nesting depth.`, { field: path, limit: maxDepth });

    if (candidate === null || typeof candidate === 'boolean') {
      state.values += 1;
      invariant(state.values <= maxValues, 'NUMBERDROID_LEVEL_PROJECTION_LIMIT_EXCEEDED', 'The input contains too many scalar values.', { limit: maxValues });
      return candidate;
    }
    if (typeof candidate === 'string') {
      state.values += 1;
      state.text += candidate.length;
      invariant(candidate.length <= maxStringLength && state.text <= maxAggregateText,
        'NUMBERDROID_LEVEL_PROJECTION_LIMIT_EXCEEDED', `${path} exceeds the bounded text budget.`, { field: path });
      invariant(state.values <= maxValues, 'NUMBERDROID_LEVEL_PROJECTION_LIMIT_EXCEEDED', 'The input contains too many scalar values.', { limit: maxValues });
      return candidate;
    }
    if (typeof candidate === 'number') {
      state.values += 1;
      invariant(Number.isFinite(candidate) && Math.abs(candidate) <= maxNumberMagnitude && !Object.is(candidate, -0),
        'NUMBERDROID_LEVEL_PROJECTION_INPUT_INVALID', `${path} must be a bounded finite number and may not be negative zero.`, { field: path });
      invariant(state.values <= maxValues, 'NUMBERDROID_LEVEL_PROJECTION_LIMIT_EXCEEDED', 'The input contains too many scalar values.', { limit: maxValues });
      return candidate;
    }
    invariant(typeof candidate === 'object', 'NUMBERDROID_LEVEL_PROJECTION_INPUT_INVALID', `${path} must contain JSON-compatible plain data.`, { field: path });
    invariant(!utilTypes.isProxy(candidate), 'NUMBERDROID_LEVEL_PROJECTION_INPUT_INVALID', `${path} may not be a Proxy.`, { field: path });

    state.nodes += 1;
    invariant(state.nodes <= maxNodes, 'NUMBERDROID_LEVEL_PROJECTION_LIMIT_EXCEEDED', 'The input contains too many objects or arrays.', { limit: maxNodes });
    invariant(!state.active.has(candidate), 'NUMBERDROID_LEVEL_PROJECTION_INPUT_INVALID', `${path} contains a cycle.`, { field: path });
    invariant(!rejectSharedReferences || !state.seen.has(candidate), 'NUMBERDROID_LEVEL_PROJECTION_INPUT_INVALID', `${path} contains a repeated object reference.`, { field: path });
    state.seen.add(candidate);
    state.active.add(candidate);

    const prototype = safely(() => Object.getPrototypeOf(candidate), path);
    const keys = safely(() => Reflect.ownKeys(candidate), path);
    if (Array.isArray(candidate)) {
      invariant(prototype === Array.prototype, 'NUMBERDROID_LEVEL_PROJECTION_INPUT_INVALID', `${path} must be a standard array.`, { field: path });
      const lengthDescriptor = safely(() => Object.getOwnPropertyDescriptor(candidate, 'length'), `${path}.length`);
      const length = lengthDescriptor?.value;
      invariant(Number.isSafeInteger(length) && length >= 0 && length <= maxArrayEntries,
        'NUMBERDROID_LEVEL_PROJECTION_LIMIT_EXCEEDED', `${path} exceeds the array-entry limit.`, { field: path, limit: maxArrayEntries });
      for (const key of keys) {
        const isIndex = typeof key === 'string' && ARRAY_INDEX_PATTERN.test(key) && Number(key) < length;
        invariant(key === 'length' || isIndex, 'NUMBERDROID_LEVEL_PROJECTION_FIELD_FORBIDDEN', `${path}.${String(key)} is not permitted.`, { field: `${path}.${String(key)}` });
      }
      const result = [];
      for (let index = 0; index < length; index += 1) {
        const descriptor = safely(() => Object.getOwnPropertyDescriptor(candidate, String(index)), `${path}[${index}]`);
        invariant(descriptor?.enumerable && Object.hasOwn(descriptor, 'value'), 'NUMBERDROID_LEVEL_PROJECTION_INPUT_INVALID', `${path} must be a dense array of own data entries.`, { field: `${path}[${index}]` });
        result.push(visit(descriptor.value, `${path}[${index}]`, depth + 1));
      }
      state.active.delete(candidate);
      return result;
    }

    invariant(prototype === Object.prototype || prototype === null,
      'NUMBERDROID_LEVEL_PROJECTION_INPUT_INVALID', `${path} must be a plain data object.`, { field: path });
    invariant(keys.length <= maxObjectFields, 'NUMBERDROID_LEVEL_PROJECTION_LIMIT_EXCEEDED', `${path} exceeds the object-field limit.`, { field: path, limit: maxObjectFields });
    const result = Object.create(null);
    for (const key of keys) {
      invariant(typeof key === 'string' && key.length >= 1 && key.length <= maxKeyLength && !CONTROL_CHARACTER_PATTERN.test(key),
        'NUMBERDROID_LEVEL_PROJECTION_FIELD_FORBIDDEN', `${path}.${String(key)} is not a safe bounded field name.`, { field: `${path}.${String(key)}` });
      const descriptor = safely(() => Object.getOwnPropertyDescriptor(candidate, key), `${path}.${key}`);
      invariant(descriptor?.enumerable && Object.hasOwn(descriptor, 'value'),
        'NUMBERDROID_LEVEL_PROJECTION_FIELD_FORBIDDEN', `${path}.${key} must be an enumerable own data field.`, { field: `${path}.${key}` });
      Object.defineProperty(result, key, {
        value: visit(descriptor.value, `${path}.${key}`, depth + 1),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    state.active.delete(candidate);
    return result;
  }

  return visit(value, label, 0);
}

function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function canonicalJson(value) {
  function serialize(candidate, depth) {
    if (candidate === null || typeof candidate === 'boolean' || typeof candidate === 'number' || typeof candidate === 'string') {
      return JSON.stringify(candidate);
    }
    const indent = '  '.repeat(depth);
    const childIndent = '  '.repeat(depth + 1);
    if (Array.isArray(candidate)) {
      if (candidate.length === 0) return '[]';
      return `[\n${candidate.map((entry) => `${childIndent}${serialize(entry, depth + 1)}`).join(',\n')}\n${indent}]`;
    }
    const keys = Object.keys(candidate).sort();
    if (keys.length === 0) return '{}';
    return `{\n${keys.map((key) => `${childIndent}${JSON.stringify(key)}: ${serialize(candidate[key], depth + 1)}`).join(',\n')}\n${indent}}`;
  }
  return `${serialize(value, 0)}\n`;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function a3aSha256(value) {
  return sha256(canonicalJson(value));
}

function sameValue(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function exactRecord(value, required, optional, label) {
  invariant(value !== null && typeof value === 'object' && !Array.isArray(value),
    'NUMBERDROID_LEVEL_PROJECTION_INPUT_INVALID', `${label} must be an object.`, { field: label });
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(value)) {
    invariant(allowed.has(key), 'NUMBERDROID_LEVEL_PROJECTION_FIELD_FORBIDDEN', `${label}.${key} is not permitted.`, { field: `${label}.${key}` });
  }
  for (const key of required) {
    invariant(Object.hasOwn(value, key), 'NUMBERDROID_LEVEL_PROJECTION_INPUT_INVALID', `${label}.${key} is required.`, { field: `${label}.${key}` });
  }
  return value;
}

function requireArray(value, label, { min = 0, max = MAX_ARRAY_ENTRIES } = {}) {
  invariant(Array.isArray(value) && value.length >= min && value.length <= max,
    'NUMBERDROID_LEVEL_PROJECTION_INPUT_INVALID', `${label} must contain between ${min} and ${max} entries.`, { field: label });
  return value;
}

function requireBoolean(value, label) {
  invariant(typeof value === 'boolean', 'NUMBERDROID_LEVEL_PROJECTION_INPUT_INVALID', `${label} must be boolean.`, { field: label });
  return value;
}

function requireFinite(value, label, { min = -MAX_NUMBER_MAGNITUDE, max = MAX_NUMBER_MAGNITUDE } = {}) {
  invariant(typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0) && value >= min && value <= max,
    'NUMBERDROID_LEVEL_PROJECTION_INPUT_INVALID', `${label} must be a bounded finite number.`, { field: label });
  return value;
}

function requireInteger(value, label, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  invariant(Number.isSafeInteger(value) && value >= min && value <= max,
    'NUMBERDROID_LEVEL_PROJECTION_INPUT_INVALID', `${label} must be an integer between ${min} and ${max}.`, { field: label });
  return value;
}

function requireString(value, label, { max = 4_096, trimmed = true, empty = false } = {}) {
  invariant(typeof value === 'string' && value.length <= max && (empty || value.length > 0)
    && (!trimmed || value.trim() === value) && !CONTROL_CHARACTER_PATTERN.test(value),
  'NUMBERDROID_LEVEL_PROJECTION_INPUT_INVALID', `${label} must be a bounded${trimmed ? ', trimmed' : ''} string without control characters.`, { field: label });
  return value;
}

function requireId(value, label) {
  invariant(typeof value === 'string' && value.length <= 4_096 && value.trim().length > 0,
    'NUMBERDROID_LEVEL_PROJECTION_INPUT_INVALID', `${label} must be a bounded, non-blank string.`, { field: label });
  return value;
}

function requireSourceText(value, label, { max = 4_096, empty = true } = {}) {
  invariant(typeof value === 'string' && value.length <= max && (empty || value.length > 0),
    'NUMBERDROID_LEVEL_PROJECTION_INPUT_INVALID', `${label} must be a bounded string.`, { field: label });
  return value;
}

function requireEnum(value, allowed, label) {
  invariant(allowed.has(value), 'NUMBERDROID_LEVEL_PROJECTION_INPUT_INVALID', `${label} is unsupported.`, { field: label, value });
  return value;
}

function optional(record, key, validator) {
  if (Object.hasOwn(record, key)) validator(record[key]);
}

function validateStringArray(value, label, { ids = false, min = 0 } = {}) {
  requireArray(value, label, { min });
  value.forEach((entry, index) => (ids ? requireId(entry, `${label}[${index}]`) : requireSourceText(entry, `${label}[${index}]`, { max: 1_024 })));
}

function validateRange(value, label) {
  const range = exactRecord(value, ['min', 'preferred', 'max'], [], label);
  const min = requireFinite(range.min, `${label}.min`, { min: Number.MIN_VALUE });
  const preferred = requireFinite(range.preferred, `${label}.preferred`, { min: Number.MIN_VALUE });
  const max = requireFinite(range.max, `${label}.max`, { min: Number.MIN_VALUE });
  invariant(min <= preferred && preferred <= max, 'NUMBERDROID_LEVEL_PROJECTION_INPUT_INVALID', `${label} must satisfy min <= preferred <= max.`, { field: label });
}

function validateClearance(value, label) {
  const clearance = exactRecord(value, ['before', 'after'], [], label);
  requireFinite(clearance.before, `${label}.before`, { min: 0 });
  requireFinite(clearance.after, `${label}.after`, { min: 0 });
}

function validateRelations(value, label) {
  requireArray(value, label);
  value.forEach((candidate, index) => {
    const itemLabel = `${label}[${index}]`;
    const relation = exactRecord(candidate, ['targetId', 'relation'], ['strength'], itemLabel);
    requireId(relation.targetId, `${itemLabel}.targetId`);
    requireEnum(relation.relation, RELATIONS, `${itemLabel}.relation`);
    optional(relation, 'strength', (entry) => requireEnum(entry, CONSTRAINT_STRENGTHS, `${itemLabel}.strength`));
  });
}

function validateSizeSpec(value, label, { partial = false } = {}) {
  const size = exactRecord(value, partial ? [] : ['class'], ['class', 'width', 'height'].filter((key) => partial || key !== 'class'), label);
  optional(size, 'class', (entry) => requireEnum(entry, SIZE_CLASSES, `${label}.class`));
  optional(size, 'width', (entry) => validateRange(entry, `${label}.width`));
  optional(size, 'height', (entry) => validateRange(entry, `${label}.height`));
}

function validateSpace(value, label) {
  const base = exactRecord(value, ['id', 'kind'], ['archetype', 'tags', 'rationality', 'size', 'width', 'length', 'orientation', 'relations'], label);
  requireId(base.id, `${label}.id`);
  requireEnum(base.kind, SPACE_KINDS, `${label}.kind`);
  if (base.kind === 'room') {
    exactRecord(base, ['id', 'kind', 'archetype', 'size'], ['tags', 'rationality', 'relations'], label);
    requireSourceText(base.archetype, `${label}.archetype`);
    validateSizeSpec(base.size, `${label}.size`);
    optional(base, 'rationality', (entry) => requireEnum(entry, RATIONALITIES, `${label}.rationality`));
  } else {
    exactRecord(base, ['id', 'kind', 'width'], ['archetype', 'tags', 'length', 'orientation', 'relations'], label);
    validateRange(base.width, `${label}.width`);
    optional(base, 'archetype', (entry) => requireSourceText(entry, `${label}.archetype`));
    optional(base, 'length', (entry) => validateRange(entry, `${label}.length`));
    optional(base, 'orientation', (entry) => requireEnum(entry, ORIENTATIONS, `${label}.orientation`));
  }
  optional(base, 'tags', (entry) => validateStringArray(entry, `${label}.tags`));
  optional(base, 'relations', (entry) => validateRelations(entry, `${label}.relations`));
}

function validateConnection(value, label) {
  const connection = exactRecord(value, ['id', 'from', 'to', 'kind'], ['widthTiles', 'preferredSide', 'clearanceTiles', 'lock'], label);
  requireId(connection.id, `${label}.id`);
  requireId(connection.from, `${label}.from`);
  requireId(connection.to, `${label}.to`);
  requireEnum(connection.kind, CONNECTION_KINDS, `${label}.kind`);
  optional(connection, 'widthTiles', (entry) => requireFinite(entry, `${label}.widthTiles`, { min: Number.MIN_VALUE }));
  optional(connection, 'preferredSide', (entry) => requireEnum(entry, CARDINAL_DIRECTIONS, `${label}.preferredSide`));
  optional(connection, 'clearanceTiles', (entry) => validateClearance(entry, `${label}.clearanceTiles`));
  optional(connection, 'lock', (entry) => {
    const lock = exactRecord(entry, ['mode'], ['keyId'], `${label}.lock`);
    if (lock.mode === 'none') exactRecord(lock, ['mode'], [], `${label}.lock`);
    else {
      invariant(lock.mode === 'access-key', 'NUMBERDROID_LEVEL_PROJECTION_INPUT_INVALID', `${label}.lock.mode is unsupported.`, { field: `${label}.lock.mode` });
      exactRecord(lock, ['mode', 'keyId'], [], `${label}.lock`);
      requireId(lock.keyId, `${label}.lock.keyId`);
    }
  });
}

function validateProp(value, label) {
  const prop = exactRecord(value, ['id', 'propId', 'spaceId'], ['role', 'quantity', 'required', 'near', 'preferredWall'], label);
  requireId(prop.id, `${label}.id`);
  requireId(prop.propId, `${label}.propId`);
  requireId(prop.spaceId, `${label}.spaceId`);
  optional(prop, 'role', (entry) => requireEnum(entry, PROP_ROLES, `${label}.role`));
  optional(prop, 'quantity', (entry) => requireInteger(entry, `${label}.quantity`, { min: 1 }));
  optional(prop, 'required', (entry) => requireBoolean(entry, `${label}.required`));
  optional(prop, 'near', (entry) => validateStringArray(entry, `${label}.near`, { ids: true }));
  optional(prop, 'preferredWall', (entry) => requireEnum(entry, CARDINAL_DIRECTIONS, `${label}.preferredWall`));
}

function validateEncounter(value, label) {
  const encounter = exactRecord(value, ['id', 'spaceId', 'enemyId', 'bodyId', 'behavior', 'mode', 'mathLabel', 'difficulty'],
    ['mathRole', 'boss', 'tags', 'preferredWall', 'avoidDoorClearance', 'patrolRouteId'], label);
  requireId(encounter.id, `${label}.id`);
  requireId(encounter.spaceId, `${label}.spaceId`);
  requireEnum(encounter.enemyId, ENEMIES, `${label}.enemyId`);
  requireEnum(encounter.bodyId, BODIES, `${label}.bodyId`);
  requireEnum(encounter.behavior, BEHAVIORS, `${label}.behavior`);
  requireEnum(encounter.mode, MATH_MODES, `${label}.mode`);
  requireSourceText(encounter.mathLabel, `${label}.mathLabel`);
  requireEnum(encounter.difficulty, DIFFICULTIES, `${label}.difficulty`);
  optional(encounter, 'mathRole', (entry) => requireEnum(entry, MATH_ROLES, `${label}.mathRole`));
  optional(encounter, 'boss', (entry) => requireBoolean(entry, `${label}.boss`));
  optional(encounter, 'tags', (entry) => validateStringArray(entry, `${label}.tags`));
  optional(encounter, 'preferredWall', (entry) => requireEnum(entry, CARDINAL_DIRECTIONS, `${label}.preferredWall`));
  optional(encounter, 'avoidDoorClearance', (entry) => requireBoolean(entry, `${label}.avoidDoorClearance`));
  optional(encounter, 'patrolRouteId', (entry) => requireId(entry, `${label}.patrolRouteId`));
}

function validateStagedActor(value, label) {
  const actor = exactRecord(value, ['id', 'actorType'], ['tags', 'initiallyPresent', 'defaultSpaceId'], label);
  requireId(actor.id, `${label}.id`);
  requireId(actor.actorType, `${label}.actorType`);
  optional(actor, 'tags', (entry) => validateStringArray(entry, `${label}.tags`));
  optional(actor, 'initiallyPresent', (entry) => requireBoolean(entry, `${label}.initiallyPresent`));
  optional(actor, 'defaultSpaceId', (entry) => requireId(entry, `${label}.defaultSpaceId`));
}

function validateRoute(value, label) {
  const route = exactRecord(value, ['id', 'kind', 'spaceIds'], ['loop', 'tags'], label);
  requireId(route.id, `${label}.id`);
  requireEnum(route.kind, ROUTE_KINDS, `${label}.kind`);
  validateStringArray(route.spaceIds, `${label}.spaceIds`, { ids: true, min: 1 });
  optional(route, 'loop', (entry) => requireBoolean(entry, `${label}.loop`));
  optional(route, 'tags', (entry) => validateStringArray(entry, `${label}.tags`));
}

function validatePickup(value, label) {
  const pickup = exactRecord(value, ['id', 'kind', 'keyId', 'spaceId'], ['propId', 'label'], label);
  requireId(pickup.id, `${label}.id`);
  invariant(pickup.kind === 'access-key', 'NUMBERDROID_LEVEL_PROJECTION_INPUT_INVALID', `${label}.kind is unsupported.`, { field: `${label}.kind` });
  requireId(pickup.keyId, `${label}.keyId`);
  requireId(pickup.spaceId, `${label}.spaceId`);
  optional(pickup, 'propId', (entry) => requireSourceText(entry, `${label}.propId`));
  optional(pickup, 'label', (entry) => requireSourceText(entry, `${label}.label`));
}

function validateZone(value, label) {
  const zone = exactRecord(value, ['id', 'spaceId', 'anchor'], ['sizeTiles', 'tags'], label);
  requireId(zone.id, `${label}.id`);
  requireId(zone.spaceId, `${label}.spaceId`);
  const anchor = exactRecord(zone.anchor, ['kind'], ['targetId', 'position'], `${label}.anchor`);
  requireEnum(anchor.kind, ZONE_ANCHOR_KINDS, `${label}.anchor.kind`);
  if (anchor.kind === 'space-center') exactRecord(anchor, ['kind'], [], `${label}.anchor`);
  else {
    exactRecord(anchor, ['kind', 'targetId'], anchor.kind === 'route' ? ['position'] : [], `${label}.anchor`);
    requireId(anchor.targetId, `${label}.anchor.targetId`);
    optional(anchor, 'position', (entry) => requireEnum(entry, ROUTE_POSITIONS, `${label}.anchor.position`));
  }
  optional(zone, 'sizeTiles', (entry) => {
    const size = exactRecord(entry, ['w', 'h'], [], `${label}.sizeTiles`);
    requireInteger(size.w, `${label}.sizeTiles.w`, { min: 1 });
    requireInteger(size.h, `${label}.sizeTiles.h`, { min: 1 });
  });
  optional(zone, 'tags', (entry) => validateStringArray(entry, `${label}.tags`));
}

function validateTrigger(value, label) {
  const trigger = exactRecord(value, ['id', 'kind', 'sourceId', 'eventIds'], ['once', 'delayMs', 'radiusTiles'], label);
  requireId(trigger.id, `${label}.id`);
  requireEnum(trigger.kind, TRIGGER_KINDS, `${label}.kind`);
  requireId(trigger.sourceId, `${label}.sourceId`);
  validateStringArray(trigger.eventIds, `${label}.eventIds`, { ids: true, min: 1 });
  optional(trigger, 'once', (entry) => requireBoolean(entry, `${label}.once`));
  optional(trigger, 'delayMs', (entry) => requireFinite(entry, `${label}.delayMs`, { min: 0 }));
  optional(trigger, 'radiusTiles', (entry) => requireFinite(entry, `${label}.radiusTiles`, { min: Number.MIN_VALUE }));
}

function validateEvent(value, label) {
  const base = exactRecord(value, ['id', 'kind'], ['flag', 'value', 'keyId', 'doorId', 'actorId', 'spaceId', 'routeId', 'durationMs', 'beatId', 'blocking'], label);
  requireId(base.id, `${label}.id`);
  requireString(base.kind, `${label}.kind`, { max: 64 });
  invariant(Object.hasOwn(EVENT_FIELDS, base.kind), 'NUMBERDROID_LEVEL_PROJECTION_INPUT_INVALID', `${label}.kind is unsupported.`, { field: `${label}.kind`, value: base.kind });
  const fields = EVENT_FIELDS[base.kind];
  const optionalFields = base.kind === 'actor-passby' ? ['durationMs'] : base.kind === 'story-beat' ? ['blocking'] : [];
  exactRecord(base, fields.filter((field) => !optionalFields.includes(field)), optionalFields, label);
  if (base.kind === 'set-flag') {
    requireId(base.flag, `${label}.flag`);
    invariant(typeof base.value === 'boolean' || typeof base.value === 'string' || typeof base.value === 'number',
      'NUMBERDROID_LEVEL_PROJECTION_INPUT_INVALID', `${label}.value must be boolean, string, or number.`, { field: `${label}.value` });
    if (typeof base.value === 'number') requireFinite(base.value, `${label}.value`);
    if (typeof base.value === 'string') requireSourceText(base.value, `${label}.value`);
  }
  if (base.kind === 'grant-key') requireId(base.keyId, `${label}.keyId`);
  if (base.kind === 'unlock-door' || base.kind === 'lock-door') requireId(base.doorId, `${label}.doorId`);
  if (['spawn-actor', 'despawn-actor', 'move-actor', 'actor-passby'].includes(base.kind)) requireId(base.actorId, `${label}.actorId`);
  if (base.kind === 'spawn-actor') requireId(base.spaceId, `${label}.spaceId`);
  if (base.kind === 'move-actor' || base.kind === 'actor-passby') requireId(base.routeId, `${label}.routeId`);
  if (base.kind === 'actor-passby') optional(base, 'durationMs', (entry) => requireFinite(entry, `${label}.durationMs`, { min: Number.MIN_VALUE }));
  if (base.kind === 'story-beat') {
    requireId(base.beatId, `${label}.beatId`);
    optional(base, 'blocking', (entry) => requireBoolean(entry, `${label}.blocking`));
  }
}

function validateOverride(value, label) {
  const override = exactRecord(value, ['targetId'], [
    'lockGeometry', 'lockedGeometry', 'lockPlacement', 'lockedPlacement', 'offsetTiles',
    'preferredSide', 'preferredWall', 'size', 'robotType', 'seedSalt',
  ], label);
  requireId(override.targetId, `${label}.targetId`);
  optional(override, 'lockGeometry', (entry) => requireBoolean(entry, `${label}.lockGeometry`));
  optional(override, 'lockPlacement', (entry) => requireBoolean(entry, `${label}.lockPlacement`));
  optional(override, 'lockedGeometry', (entry) => {
    const lock = exactRecord(entry, ['offsetFromRootTiles', 'sizeTiles'], [], `${label}.lockedGeometry`);
    validateIntegerPoint(lock.offsetFromRootTiles, `${label}.lockedGeometry.offsetFromRootTiles`);
    validatePositiveIntegerSize(lock.sizeTiles, `${label}.lockedGeometry.sizeTiles`);
  });
  optional(override, 'lockedPlacement', (entry) => {
    const lock = exactRecord(entry, ['offsetTiles', 'rotation'], ['wallSide'], `${label}.lockedPlacement`);
    validateIntegerPoint(lock.offsetTiles, `${label}.lockedPlacement.offsetTiles`);
    requireEnum(lock.rotation, PROP_ROTATIONS, `${label}.lockedPlacement.rotation`);
    optional(lock, 'wallSide', (wall) => {
      invariant(wall === null || CARDINAL_DIRECTIONS.has(wall), 'NUMBERDROID_LEVEL_PROJECTION_INPUT_INVALID', `${label}.lockedPlacement.wallSide is unsupported.`, { field: `${label}.lockedPlacement.wallSide` });
    });
  });
  optional(override, 'offsetTiles', (entry) => validateIntegerPoint(entry, `${label}.offsetTiles`));
  optional(override, 'preferredSide', (entry) => requireEnum(entry, CARDINAL_DIRECTIONS, `${label}.preferredSide`));
  optional(override, 'preferredWall', (entry) => requireEnum(entry, CARDINAL_DIRECTIONS, `${label}.preferredWall`));
  optional(override, 'size', (entry) => validateSizeSpec(entry, `${label}.size`, { partial: true }));
  optional(override, 'robotType', (entry) => requireEnum(entry, ENEMIES, `${label}.robotType`));
  optional(override, 'seedSalt', (entry) => requireInteger(entry, `${label}.seedSalt`, { min: 0 }));
}

function validateIntegerPoint(value, label) {
  const point = exactRecord(value, ['x', 'y'], [], label);
  requireInteger(point.x, `${label}.x`);
  requireInteger(point.y, `${label}.y`);
}

function validatePositiveIntegerSize(value, label) {
  const size = exactRecord(value, ['w', 'h'], [], label);
  requireInteger(size.w, `${label}.w`, { min: 1 });
  requireInteger(size.h, `${label}.h`, { min: 1 });
}

function validateRuntime(value, label) {
  const runtime = exactRecord(value, [], ['tileSize', 'wallCollisionPx', 'wallVisualPx', 'floorName', 'subtitle', 'objectiveDefault', 'objectiveAfterEnergy', 'start'], label);
  for (const field of ['tileSize', 'wallCollisionPx', 'wallVisualPx']) optional(runtime, field, (entry) => requireFinite(entry, `${label}.${field}`, { min: Number.MIN_VALUE }));
  for (const field of ['floorName', 'subtitle', 'objectiveDefault', 'objectiveAfterEnergy']) optional(runtime, field, (entry) => requireSourceText(entry, `${label}.${field}`));
  optional(runtime, 'start', (entry) => {
    const start = exactRecord(entry, [], ['spaceId', 'bodyId', 'facing', 'metaEnergy', 'preferredSide'], `${label}.start`);
    optional(start, 'spaceId', (item) => requireId(item, `${label}.start.spaceId`));
    optional(start, 'bodyId', (item) => requireEnum(item, BODIES, `${label}.start.bodyId`));
    optional(start, 'facing', (item) => requireFinite(item, `${label}.start.facing`));
    optional(start, 'metaEnergy', (item) => requireFinite(item, `${label}.start.metaEnergy`));
    optional(start, 'preferredSide', (item) => requireEnum(item, CARDINAL_DIRECTIONS, `${label}.start.preferredSide`));
  });
}

function validateLevelSpecSnapshot(spec) {
  const root = exactRecord(spec, ['id', 'version', 'seed', 'ruleSetRefs', 'rules', 'spaces', 'connections', 'props', 'encounters'],
    ['runtime', 'stagedActors', 'routes', 'pickups', 'zones', 'triggers', 'events', 'overrides'], 'levelSpec');
  requireId(root.id, 'levelSpec.id');
  requireInteger(root.version, 'levelSpec.version', { min: 1 });
  if (typeof root.seed === 'string') requireId(root.seed, 'levelSpec.seed');
  else requireFinite(root.seed, 'levelSpec.seed');
  validateStringArray(root.ruleSetRefs, 'levelSpec.ruleSetRefs');
  const rules = exactRecord(root.rules, ['ensureReachability', 'singleSharedWall', 'doorsEmbeddedInWalls', 'defaultCorridorWidth', 'defaultDoorClearance'], [], 'levelSpec.rules');
  requireBoolean(rules.ensureReachability, 'levelSpec.rules.ensureReachability');
  requireBoolean(rules.singleSharedWall, 'levelSpec.rules.singleSharedWall');
  requireBoolean(rules.doorsEmbeddedInWalls, 'levelSpec.rules.doorsEmbeddedInWalls');
  validateRange(rules.defaultCorridorWidth, 'levelSpec.rules.defaultCorridorWidth');
  validateClearance(rules.defaultDoorClearance, 'levelSpec.rules.defaultDoorClearance');
  optional(root, 'runtime', (entry) => validateRuntime(entry, 'levelSpec.runtime'));

  const collections = [
    ['spaces', validateSpace, 1], ['connections', validateConnection, 0], ['props', validateProp, 0], ['encounters', validateEncounter, 0],
    ['stagedActors', validateStagedActor, 0], ['routes', validateRoute, 0], ['pickups', validatePickup, 0], ['zones', validateZone, 0],
    ['triggers', validateTrigger, 0], ['events', validateEvent, 0], ['overrides', validateOverride, 0],
  ];
  const semanticIds = new Set();
  for (const [field, validator, min] of collections) {
    const entries = Object.hasOwn(root, field) ? root[field] : [];
    requireArray(entries, `levelSpec.${field}`, { min });
    entries.forEach((entry, index) => {
      validator(entry, `levelSpec.${field}[${index}]`);
      if (field !== 'overrides') {
        invariant(!semanticIds.has(entry.id), 'NUMBERDROID_LEVEL_PROJECTION_DUPLICATE_ID', `Duplicate semantic id ${entry.id}.`, { field: `levelSpec.${field}[${index}].id`, id: entry.id });
        semanticIds.add(entry.id);
      }
    });
  }
  return spec;
}

export function validateNumberdroidLevelSpec(value) {
  // Current trusted Numberdroid fixtures deliberately reuse immutable range
  // constants. Reference identity has no LevelSpec/JSON semantics, so a DAG is
  // flattened into exact plain values while true cycles remain forbidden.
  return deepFreeze(validateLevelSpecSnapshot(snapshotPlainData(value, 'levelSpec', {
    ...LEVEL_SPEC_SNAPSHOT_LIMITS,
    rejectSharedReferences: false,
  })));
}

export function canonicalNumberdroidLevelSpecJson(value) {
  return canonicalJson(validateNumberdroidLevelSpec(value));
}

export function numberdroidLevelSpecSha256(value) {
  return sha256(canonicalNumberdroidLevelSpecJson(value));
}

function validateCompilerPort(value) {
  const label = 'compiler';
  invariant(value !== null && (typeof value === 'object' || typeof value === 'function') && !utilTypes.isProxy(value),
    'NUMBERDROID_LEVEL_PROJECTION_COMPILER_INVALID', 'compiler may not be a Proxy.', { field: label });
  const prototype = safely(() => Object.getPrototypeOf(value), label);
  invariant(value !== null && typeof value === 'object' && !Array.isArray(value) && (prototype === Object.prototype || prototype === null),
    'NUMBERDROID_LEVEL_PROJECTION_COMPILER_INVALID', 'compiler must be a plain exact port.', { field: label });
  const keys = safely(() => Reflect.ownKeys(value), label);
  invariant(keys.length === 3 && keys.every((key) => typeof key === 'string' && ['compilerVersion', 'compileLevelSpec', 'validatePlacementOverrides'].includes(key)),
    'NUMBERDROID_LEVEL_PROJECTION_COMPILER_INVALID', 'compiler must expose exactly compilerVersion, compileLevelSpec, and validatePlacementOverrides.', { field: label });
  const result = {};
  for (const key of keys) {
    const descriptor = safely(() => Object.getOwnPropertyDescriptor(value, key), `${label}.${key}`);
    invariant(descriptor?.enumerable && Object.hasOwn(descriptor, 'value'), 'NUMBERDROID_LEVEL_PROJECTION_COMPILER_INVALID', `${label}.${key} must be an enumerable own data field.`, { field: `${label}.${key}` });
    result[key] = descriptor.value;
  }
  invariant(typeof result.compilerVersion === 'string' && COMPILER_VERSION_PATTERN.test(result.compilerVersion),
    'NUMBERDROID_LEVEL_PROJECTION_COMPILER_INVALID', 'compiler.compilerVersion must pin the exact compiler source closure by SHA-256.', { field: 'compiler.compilerVersion' });
  invariant(typeof result.compileLevelSpec === 'function' && typeof result.validatePlacementOverrides === 'function'
    && !utilTypes.isProxy(result.compileLevelSpec) && !utilTypes.isProxy(result.validatePlacementOverrides),
    'NUMBERDROID_LEVEL_PROJECTION_COMPILER_INVALID', 'compiler operations must be functions.', { field: label });
  return result;
}

function safeThrownMessage(error) {
  void error;
  return 'The compiler rejected the LevelSpec.';
}

function callCompiler(operation, argument, code, label) {
  try {
    return operation(argument);
  } catch (error) {
    fail(code, `${label}: ${safeThrownMessage(error)}`);
  }
}

function fnv1a32(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function normalizeSeed(seed) {
  return typeof seed === 'number' ? Math.floor(seed) >>> 0 : fnv1a32(seed.trim());
}

function deriveSeed(seed, semanticPath) {
  return fnv1a32(`${normalizeSeed(seed)}:${semanticPath}`);
}

function assertSourceFieldsPreserved(source, compiled, label, ignored = new Set()) {
  invariant(compiled !== null && typeof compiled === 'object' && !Array.isArray(compiled),
    'NUMBERDROID_LEVEL_PROJECTION_PLAN_INVALID', `${label} must be an object.`, { field: label });
  for (const key of Object.keys(source)) {
    if (ignored.has(key)) continue;
    invariant(Object.hasOwn(compiled, key) && sameValue(compiled[key], source[key]),
      'NUMBERDROID_LEVEL_PROJECTION_PLAN_INVALID', `${label}.${key} does not preserve the source value.`, { field: `${label}.${key}` });
  }
}

function validatePropBounds(value, label) {
  const bounds = exactRecord(value, ['x', 'y', 'w', 'h'], [], label);
  requireFinite(bounds.x, `${label}.x`, { min: 0 });
  requireFinite(bounds.y, `${label}.y`, { min: 0 });
  requireFinite(bounds.w, `${label}.w`, { min: Number.MIN_VALUE });
  requireFinite(bounds.h, `${label}.h`, { min: Number.MIN_VALUE });
}

function validateCompiledPropMetadata(value, label, expectedId) {
  const metadata = exactRecord(value,
    ['id', 'tags', 'attachment', 'allowedRotations', 'footprintTiles', 'placement'], ['exactFit'], label);
  invariant(metadata.id === expectedId, 'NUMBERDROID_LEVEL_PROJECTION_PLAN_INVALID', `${label}.id does not match the source propId.`, { field: `${label}.id` });
  validateStringArray(metadata.tags, `${label}.tags`);
  invariant(['floor', 'wall', 'either'].includes(metadata.attachment),
    'NUMBERDROID_LEVEL_PROJECTION_PLAN_INVALID', `${label}.attachment is unsupported.`, { field: `${label}.attachment` });
  requireArray(metadata.allowedRotations, `${label}.allowedRotations`, { min: 1 });
  metadata.allowedRotations.forEach((rotation, index) => requireEnum(rotation, PROP_ROTATIONS, `${label}.allowedRotations[${index}]`));
  validatePositiveIntegerSize(metadata.footprintTiles, `${label}.footprintTiles`);
  const placement = exactRecord(metadata.placement, [], [
    'requiredSpaceTags', 'preferWallAdjacent', 'preferCorner', 'preferNearTags', 'preferRoomCenter',
    'forbidDoorClearance', 'forbidPrimaryPath', 'forbidInFrontOfWallProp', 'preferOppositeDoor',
    'approachDepthTiles', 'clearanceAroundTiles',
  ], `${label}.placement`);
  optional(placement, 'requiredSpaceTags', (entry) => validateStringArray(entry, `${label}.placement.requiredSpaceTags`));
  optional(placement, 'preferNearTags', (entry) => validateStringArray(entry, `${label}.placement.preferNearTags`));
  for (const field of [
    'preferWallAdjacent', 'preferCorner', 'preferRoomCenter', 'forbidDoorClearance', 'forbidPrimaryPath',
    'forbidInFrontOfWallProp', 'preferOppositeDoor',
  ]) optional(placement, field, (entry) => requireBoolean(entry, `${label}.placement.${field}`));
  for (const field of ['approachDepthTiles', 'clearanceAroundTiles']) {
    optional(placement, field, (entry) => requireFinite(entry, `${label}.placement.${field}`, { min: 0 }));
  }
  optional(metadata, 'exactFit', (entry) => {
    const exactFit = exactRecord(entry, [], [
      'visualBoundsTiles', 'collisionBoundsTiles', 'placementEnvelope', 'customEnvelopeTiles', 'wallBoundary',
    ], `${label}.exactFit`);
    optional(exactFit, 'visualBoundsTiles', (bounds) => validatePropBounds(bounds, `${label}.exactFit.visualBoundsTiles`));
    optional(exactFit, 'collisionBoundsTiles', (bounds) => validatePropBounds(bounds, `${label}.exactFit.collisionBoundsTiles`));
    optional(exactFit, 'customEnvelopeTiles', (bounds) => validatePropBounds(bounds, `${label}.exactFit.customEnvelopeTiles`));
    optional(exactFit, 'placementEnvelope', (kind) => {
      invariant(['visual', 'collision', 'custom'].includes(kind), 'NUMBERDROID_LEVEL_PROJECTION_PLAN_INVALID', `${label}.exactFit.placementEnvelope is unsupported.`);
      if (kind === 'custom') invariant(Object.hasOwn(exactFit, 'customEnvelopeTiles'), 'NUMBERDROID_LEVEL_PROJECTION_PLAN_INVALID', `${label}.exactFit.customEnvelopeTiles is required for a custom envelope.`);
    });
    optional(exactFit, 'wallBoundary', (kind) => {
      invariant(kind === 'visual' || kind === 'collision', 'NUMBERDROID_LEVEL_PROJECTION_PLAN_INVALID', `${label}.exactFit.wallBoundary is unsupported.`);
    });
  });
}

function validatePlanClosure(planValue, source) {
  const plan = snapshotPlainData(planValue, 'compiler.semanticPlan', { rejectSharedReferences: false });
  const required = ['levelId', 'version', 'seed', 'ruleSetRefs', 'rules', 'spaces', 'connections', 'props', 'encounters', 'stagedActors', 'routes', 'pickups', 'zones', 'triggers', 'events', 'overrides', 'diagnostics'];
  exactRecord(plan, required, ['runtime'], 'compiler.semanticPlan');
  invariant(plan.levelId === source.id && plan.version === source.version,
    'NUMBERDROID_LEVEL_PROJECTION_PLAN_INVALID', 'The semantic plan identity/version does not match the LevelSpec.');
  invariant(plan.seed === normalizeSeed(source.seed), 'NUMBERDROID_LEVEL_PROJECTION_PLAN_INVALID', 'The semantic plan seed is not the canonical Numberdroid seed.');
  invariant(sameValue(plan.ruleSetRefs, source.ruleSetRefs) && sameValue(plan.rules, source.rules),
    'NUMBERDROID_LEVEL_PROJECTION_PLAN_INVALID', 'The semantic plan does not preserve ruleSetRefs and rules.');
  invariant(Object.hasOwn(plan, 'runtime') === Object.hasOwn(source, 'runtime'),
    'NUMBERDROID_LEVEL_PROJECTION_PLAN_INVALID', 'The semantic-plan runtime presence does not match the LevelSpec.');
  if (Object.hasOwn(source, 'runtime')) invariant(sameValue(plan.runtime, source.runtime),
    'NUMBERDROID_LEVEL_PROJECTION_PLAN_INVALID', 'The semantic-plan runtime value does not preserve the LevelSpec runtime.');

  const collectionFields = ['spaces', 'connections', 'props', 'encounters', 'stagedActors', 'routes', 'pickups', 'zones', 'triggers', 'events', 'overrides'];
  for (const field of collectionFields) {
    const sourceEntries = source[field] ?? [];
    const planEntries = plan[field];
    invariant(Array.isArray(planEntries) && planEntries.length === sourceEntries.length,
      'NUMBERDROID_LEVEL_PROJECTION_PLAN_INVALID', `compiler.semanticPlan.${field} does not preserve collection cardinality.`, { field: `compiler.semanticPlan.${field}` });
    for (let index = 0; index < sourceEntries.length; index += 1) {
      const additions = {
        spaces: ['seed'],
        connections: ['seed', 'widthTiles', 'clearanceTiles', 'lock'],
        props: ['seed', 'quantity', 'required', 'metadata'],
        encounters: ['seed'],
      }[field] ?? [];
      exactRecord(planEntries[index], [...new Set([...Object.keys(sourceEntries[index]), ...additions])], [], `compiler.semanticPlan.${field}[${index}]`);
      const ignored = new Set();
      if (field === 'connections') {
        ignored.add('widthTiles');
        ignored.add('clearanceTiles');
        ignored.add('lock');
      }
      if (field === 'props') {
        ignored.add('quantity');
        ignored.add('required');
      }
      if (field === 'encounters') {
        const override = (source.overrides ?? []).find((entry) => entry.targetId === sourceEntries[index].id && entry.robotType);
        if (override) {
          ignored.add('enemyId');
          ignored.add('bodyId');
          invariant(planEntries[index].enemyId === override.robotType && planEntries[index].bodyId === override.robotType,
            'NUMBERDROID_LEVEL_PROJECTION_PLAN_INVALID', `compiler.semanticPlan.encounters[${index}] does not apply the explicit robotType override.`);
        }
      }
      assertSourceFieldsPreserved(sourceEntries[index], planEntries[index], `compiler.semanticPlan.${field}[${index}]`, ignored);
    }
  }

  for (const [field, semanticPrefix] of [['spaces', 'space'], ['connections', 'connection'], ['props', 'prop'], ['encounters', 'encounter']]) {
    plan[field].forEach((entry, index) => {
      invariant(entry.seed === deriveSeed(source.seed, `${semanticPrefix}/${source[field][index].id}`),
        'NUMBERDROID_LEVEL_PROJECTION_PLAN_INVALID', `compiler.semanticPlan.${field}[${index}].seed is not deterministic.`, { field: `compiler.semanticPlan.${field}[${index}].seed` });
    });
  }
  plan.connections.forEach((entry, index) => {
    const sourceEntry = source.connections[index];
    const expectedWidth = sourceEntry.widthTiles ?? (sourceEntry.kind === 'standard-door' ? 1 : 2);
    const expectedClearance = sourceEntry.kind === 'opening'
      ? { before: 0, after: 0 }
      : sourceEntry.clearanceTiles ?? source.rules.defaultDoorClearance;
    const expectedLock = sourceEntry.lock ?? { mode: 'none' };
    invariant(entry.widthTiles === expectedWidth && sameValue(entry.clearanceTiles, expectedClearance) && sameValue(entry.lock, expectedLock),
      'NUMBERDROID_LEVEL_PROJECTION_PLAN_INVALID', `compiler.semanticPlan.connections[${index}] does not preserve canonical connection defaults.`);
  });
  plan.props.forEach((entry, index) => {
    const sourceEntry = source.props[index];
    invariant(entry.quantity === (sourceEntry.quantity ?? 1) && entry.required === (sourceEntry.required ?? true),
      'NUMBERDROID_LEVEL_PROJECTION_PLAN_INVALID', `compiler.semanticPlan.props[${index}] does not preserve canonical prop defaults.`);
    validateCompiledPropMetadata(entry.metadata, `compiler.semanticPlan.props[${index}].metadata`, sourceEntry.propId);
  });
  requireArray(plan.diagnostics, 'compiler.semanticPlan.diagnostics');
  plan.diagnostics.forEach((candidate, index) => {
    const label = `compiler.semanticPlan.diagnostics[${index}]`;
    const diagnostic = exactRecord(candidate, ['level', 'code', 'message'], ['targetId'], label);
    invariant(diagnostic.level === 'info' || diagnostic.level === 'warning', 'NUMBERDROID_LEVEL_PROJECTION_PLAN_INVALID', `${label}.level is unsupported.`, { field: `${label}.level` });
    requireId(diagnostic.code, `${label}.code`);
    requireSourceText(diagnostic.message, `${label}.message`, { max: 16_384 });
    optional(diagnostic, 'targetId', (entry) => requireId(entry, `${label}.targetId`));
  });
  return plan;
}

function a3aId(value) {
  return typeof value === 'string' && A3A_ID_PATTERN.test(value);
}

function stableIdentity(sourceId) {
  return sha256(sourceId).slice(0, 32);
}

function trace() {
  return { requirementIds: [], assumptionIds: [] };
}

function buildA3aProjection(source) {
  const identity = stableIdentity(source.id);
  const projectId = 'numberdroid.project';
  const requirementSet = validateLevelRequirementSet({
    schemaVersion: 1,
    kind: 'studio.level-requirement-set',
    projectId,
    requirementSetId: `numberdroid.requirements.${identity}`,
    version: source.version,
    requirements: [],
    constraints: [],
    ambiguities: [],
    assumptions: [],
    acceptanceCriteria: [],
  });

  const spaces = source.spaces
    .filter((space) => a3aId(space.id))
    .slice(0, A3A_COLLECTION_LIMIT)
    .map((space) => ({ spaceId: space.id, kind: space.kind, roomVariant: null, ...trace() }));
  const spaceIds = new Set(spaces.map((space) => space.spaceId));
  const connections = source.connections
    .filter((connection) => a3aId(connection.id) && spaceIds.has(connection.from) && spaceIds.has(connection.to))
    .slice(0, A3A_COLLECTION_LIMIT)
    .map((connection) => ({
      connectionId: connection.id,
      kind: connection.kind,
      fromSpaceId: connection.from,
      toSpaceId: connection.to,
      ...trace(),
    }));
  const connectionIds = new Set(connections.map((connection) => connection.connectionId));
  const routes = (source.routes ?? [])
    .filter((route) => a3aId(route.id)
      && route.spaceIds.every((spaceId) => a3aId(spaceId) && spaceIds.has(spaceId))
      && new Set(route.spaceIds).size === route.spaceIds.length)
    .slice(0, A3A_COLLECTION_LIMIT)
    .map((route) => ({ routeId: route.id, kind: route.kind, spaceIds: [...route.spaceIds], ...trace() }));
  const routeIds = new Set(routes.map((route) => route.routeId));
  const pickups = (source.pickups ?? [])
    .filter((pickup) => a3aId(pickup.id) && a3aId(pickup.keyId) && spaceIds.has(pickup.spaceId))
    .slice(0, A3A_COLLECTION_LIMIT)
    .map((pickup) => ({
      pickupId: pickup.id,
      kind: pickup.kind,
      itemId: pickup.keyId,
      spaceId: pickup.spaceId,
      ...trace(),
    }));
  const pickupIds = new Set(pickups.map((pickup) => pickup.pickupId));
  const zones = (source.zones ?? []).flatMap((zone) => {
    if (!a3aId(zone.id) || !spaceIds.has(zone.spaceId)) return [];
    const anchor = zone.anchor;
    if (anchor.kind === 'space-center') {
      return [{ zoneId: zone.id, kind: 'trigger-zone', spaceId: zone.spaceId, anchor: { kind: anchor.kind, targetId: null }, ...trace() }];
    }
    const projectedTarget = (anchor.kind === 'connection' && connectionIds.has(anchor.targetId))
      || (anchor.kind === 'route' && routeIds.has(anchor.targetId))
      || (anchor.kind === 'pickup' && pickupIds.has(anchor.targetId));
    return projectedTarget && a3aId(anchor.targetId)
      ? [{ zoneId: zone.id, kind: 'trigger-zone', spaceId: zone.spaceId, anchor: { kind: anchor.kind, targetId: anchor.targetId }, ...trace() }]
      : [];
  }).slice(0, A3A_COLLECTION_LIMIT);

  const levelGraph = validateLevelGraph({
    schemaVersion: 1,
    kind: 'studio.level-graph',
    projectId,
    levelGraphId: `numberdroid.level.${identity}`,
    version: source.version,
    requirementSet: {
      requirementSetId: requirementSet.requirementSetId,
      version: requirementSet.version,
      fingerprint: a3aSha256(requirementSet),
    },
    spaces,
    connections,
    zones,
    paths: [],
    placements: [],
    actors: [],
    routes,
    pickups,
    logicBindings: [],
  });
  const logicGraph = validateLogicGraph({
    schemaVersion: 1,
    kind: 'studio.logic-graph',
    projectId,
    logicGraphId: `numberdroid.logic.${identity}`,
    version: source.version,
    levelGraph: {
      levelGraphId: levelGraph.levelGraphId,
      version: levelGraph.version,
      fingerprint: a3aSha256(levelGraph),
    },
    variables: [],
    textReferences: [],
    conditions: [],
    triggers: [],
    actions: [],
  });
  return {
    requirementSet,
    requirementSetFingerprint: a3aSha256(requirementSet),
    levelGraph,
    levelGraphFingerprint: a3aSha256(levelGraph),
    logicGraph,
    logicGraphFingerprint: a3aSha256(logicGraph),
  };
}

function escapePointer(segment) {
  return String(segment).replaceAll('~', '~0').replaceAll('/', '~1');
}

function leafPointers(value) {
  const pointers = [];
  function visit(candidate, pointer) {
    if (candidate === null || typeof candidate !== 'object') {
      pointers.push(pointer || '/');
      return;
    }
    const keys = Array.isArray(candidate) ? candidate.map((_, index) => String(index)) : Object.keys(candidate).sort();
    if (keys.length === 0) {
      pointers.push(pointer || '/');
      return;
    }
    for (const key of keys) visit(candidate[key], `${pointer}/${escapePointer(key)}`);
  }
  visit(value, '');
  return pointers.sort();
}

function unescapePointer(segment) {
  return segment.replaceAll('~1', '/').replaceAll('~0', '~');
}

function analyzeGaps(source, a3a) {
  const affected = new Map();
  const add = (gapId, pointer) => {
    if (!affected.has(gapId)) affected.set(gapId, new Set());
    affected.get(gapId).add(pointer);
  };
  add('numberdroid.requirement-trace.not-authored', '/');
  if (source.props.length) add('numberdroid.props.asset-transform-pins-missing', '/props');
  if (source.encounters.length) add('numberdroid.encounters.archetype-version-missing', '/encounters');
  if ((source.stagedActors ?? []).length) add('numberdroid.staged-actors.archetype-version-missing', '/stagedActors');
  (source.routes ?? []).forEach((route, index) => {
    if (new Set(route.spaceIds).size !== route.spaceIds.length) add('numberdroid.routes.repeated-space-not-representable', `/routes/${index}/spaceIds`);
  });
  const projected = {
    spaces: new Set(a3a.levelGraph.spaces.map((entry) => entry.spaceId)),
    connections: new Set(a3a.levelGraph.connections.map((entry) => entry.connectionId)),
    routes: new Set(a3a.levelGraph.routes.map((entry) => entry.routeId)),
    pickups: new Set(a3a.levelGraph.pickups.map((entry) => entry.pickupId)),
    zones: new Set(a3a.levelGraph.zones.map((entry) => entry.zoneId)),
  };
  source.spaces.forEach((entry, index) => {
    if (!projected.spaces.has(entry.id)) add(a3aId(entry.id)
      ? 'numberdroid.a3a.collection-limit-exceeded'
      : 'numberdroid.identifiers.a3a-vocabulary-mismatch', `/spaces/${index}`);
  });
  source.connections.forEach((entry, index) => {
    if (!projected.connections.has(entry.id)) add(a3aId(entry.id) && a3aId(entry.from) && a3aId(entry.to)
      ? 'numberdroid.a3a.collection-limit-exceeded'
      : 'numberdroid.identifiers.a3a-vocabulary-mismatch', `/connections/${index}`);
  });
  (source.routes ?? []).forEach((entry, index) => {
    if (!projected.routes.has(entry.id) && (new Set(entry.spaceIds).size === entry.spaceIds.length)) add(a3aId(entry.id) && entry.spaceIds.every(a3aId)
      ? 'numberdroid.a3a.collection-limit-exceeded'
      : 'numberdroid.identifiers.a3a-vocabulary-mismatch', `/routes/${index}`);
  });
  (source.pickups ?? []).forEach((entry, index) => {
    if (!projected.pickups.has(entry.id)) add(a3aId(entry.id) && a3aId(entry.keyId) && a3aId(entry.spaceId)
      ? 'numberdroid.a3a.collection-limit-exceeded'
      : 'numberdroid.identifiers.a3a-vocabulary-mismatch', `/pickups/${index}`);
  });
  (source.zones ?? []).forEach((entry, index) => {
    if (!projected.zones.has(entry.id)) {
      if (!a3aId(entry.id) || !a3aId(entry.spaceId) || ('targetId' in entry.anchor && !a3aId(entry.anchor.targetId))) add('numberdroid.identifiers.a3a-vocabulary-mismatch', `/zones/${index}`);
      else if (!projected.spaces.has(entry.spaceId)) add('numberdroid.a3a.collection-limit-exceeded', `/zones/${index}`);
      else if (entry.anchor.kind === 'prop' || entry.anchor.kind === 'actor'
        || (entry.anchor.kind === 'connection' && !projected.connections.has(entry.anchor.targetId))
        || (entry.anchor.kind === 'route' && !projected.routes.has(entry.anchor.targetId))
        || (entry.anchor.kind === 'pickup' && !projected.pickups.has(entry.anchor.targetId))) {
        add('numberdroid.zones.anchor-target-not-projected', `/zones/${index}/anchor`);
      } else add('numberdroid.a3a.collection-limit-exceeded', `/zones/${index}`);
    }
  });
  if ((source.triggers ?? []).length) add('numberdroid.logic.a3a-vocabulary-mismatch', '/triggers');
  if ((source.events ?? []).length) add('numberdroid.logic.a3a-vocabulary-mismatch', '/events');
  (source.events ?? []).forEach((event, index) => {
    if (event.kind === 'set-flag') add('numberdroid.flags.declaration-type-initial-value-missing', `/events/${index}`);
  });
  const gaps = [...affected.entries()].map(([gapId, pointers]) => ({
    gapId,
    status: 'OPEN',
    description: GAP_DESCRIPTIONS[gapId],
    affectedPointers: [...pointers].sort(),
  })).sort((left, right) => (left.gapId < right.gapId ? -1 : left.gapId > right.gapId ? 1 : 0));
  return { gaps, projected };
}

function gapForPointer(source, pointer, projected) {
  const segments = pointer === '/' ? [] : pointer.slice(1).split('/').map(unescapePointer);
  const [collection, indexText, field] = segments;
  const index = Number(indexText);
  if (collection === 'props' && source.props.length) return 'numberdroid.props.asset-transform-pins-missing';
  if (collection === 'encounters' && source.encounters.length) return 'numberdroid.encounters.archetype-version-missing';
  if (collection === 'stagedActors' && (source.stagedActors ?? []).length) return 'numberdroid.staged-actors.archetype-version-missing';
  if (collection === 'triggers' && (source.triggers ?? []).length) return 'numberdroid.logic.a3a-vocabulary-mismatch';
  if (collection === 'events' && (source.events ?? []).length) {
    if (source.events[index]?.kind === 'set-flag') return 'numberdroid.flags.declaration-type-initial-value-missing';
    return 'numberdroid.logic.a3a-vocabulary-mismatch';
  }
  const entry = Number.isInteger(index) ? source[collection]?.[index] : null;
  if (collection === 'spaces' && entry && !projected.spaces.has(entry.id)) return a3aId(entry.id)
    ? 'numberdroid.a3a.collection-limit-exceeded'
    : 'numberdroid.identifiers.a3a-vocabulary-mismatch';
  if (collection === 'connections' && entry && !projected.connections.has(entry.id)) return a3aId(entry.id) && a3aId(entry.from) && a3aId(entry.to)
    ? 'numberdroid.a3a.collection-limit-exceeded'
    : 'numberdroid.identifiers.a3a-vocabulary-mismatch';
  if (collection === 'routes' && entry && !projected.routes.has(entry.id)) {
    return new Set(entry.spaceIds).size !== entry.spaceIds.length
      ? 'numberdroid.routes.repeated-space-not-representable'
      : a3aId(entry.id) && entry.spaceIds.every(a3aId)
        ? 'numberdroid.a3a.collection-limit-exceeded'
        : 'numberdroid.identifiers.a3a-vocabulary-mismatch';
  }
  if (collection === 'pickups' && entry && !projected.pickups.has(entry.id)) return a3aId(entry.id) && a3aId(entry.keyId) && a3aId(entry.spaceId)
    ? 'numberdroid.a3a.collection-limit-exceeded'
    : 'numberdroid.identifiers.a3a-vocabulary-mismatch';
  if (collection === 'zones' && entry && !projected.zones.has(entry.id)) {
    return !a3aId(entry.id) || !a3aId(entry.spaceId) || ('targetId' in entry.anchor && !a3aId(entry.anchor.targetId))
      ? 'numberdroid.identifiers.a3a-vocabulary-mismatch'
      : !projected.spaces.has(entry.spaceId)
        ? 'numberdroid.a3a.collection-limit-exceeded'
        : entry.anchor.kind === 'prop' || entry.anchor.kind === 'actor'
          || (entry.anchor.kind === 'connection' && !projected.connections.has(entry.anchor.targetId))
          || (entry.anchor.kind === 'route' && !projected.routes.has(entry.anchor.targetId))
          || (entry.anchor.kind === 'pickup' && !projected.pickups.has(entry.anchor.targetId))
        ? 'numberdroid.zones.anchor-target-not-projected'
        : 'numberdroid.a3a.collection-limit-exceeded';
  }
  if (field === undefined && segments.length <= 2) return null;
  return null;
}

function a3aFieldPointer(source, pointer, projected) {
  const segments = pointer === '/' ? [] : pointer.slice(1).split('/').map(unescapePointer);
  const [collection, indexText, field, nested] = segments;
  const index = Number(indexText);
  const entry = Number.isInteger(index) ? source[collection]?.[index] : null;
  if (!entry) return false;
  if (collection === 'spaces' && projected.spaces.has(entry.id)) return ['id', 'kind'].includes(field);
  if (collection === 'connections' && projected.connections.has(entry.id)) return ['id', 'kind', 'from', 'to'].includes(field);
  if (collection === 'routes' && projected.routes.has(entry.id)) return ['id', 'kind'].includes(field) || (field === 'spaceIds' && nested !== undefined);
  if (collection === 'pickups' && projected.pickups.has(entry.id)) return ['id', 'kind', 'keyId', 'spaceId'].includes(field);
  if (collection === 'zones' && projected.zones.has(entry.id)) {
    return ['id', 'spaceId'].includes(field) || (field === 'anchor' && nested !== 'position');
  }
  return false;
}

function buildCoverage(source, projected, gaps) {
  const entries = leafPointers(source).map((pointer) => {
    const gapId = gapForPointer(source, pointer, projected);
    const disposition = gapId ? 'BLOCKED' : a3aFieldPointer(source, pointer, projected) ? 'A3A' : 'NUMBERDROID_CLOSURE';
    return { pointer, disposition, gapId };
  });
  return {
    entries,
    counts: {
      total: entries.length,
      a3a: entries.filter((entry) => entry.disposition === 'A3A').length,
      numberdroidClosure: entries.filter((entry) => entry.disposition === 'NUMBERDROID_CLOSURE').length,
      blocked: entries.filter((entry) => entry.disposition === 'BLOCKED').length,
    },
  };
}

function buildCapabilityDelta() {
  return {
    status: 'NOT_ADVERTISED',
    baseline: {
      profileId: BASELINE_CAPABILITY.manifest.profileId,
      profileVersion: BASELINE_CAPABILITY.manifest.profileVersion,
      fingerprint: BASELINE_CAPABILITY.fingerprint,
    },
    modules: [
      { id: 'studio.level-requirements', status: 'A3A_PROJECTION_ONLY' },
      { id: 'studio.level-graph', status: 'A3A_PROJECTION_ONLY' },
      { id: 'studio.actor-route', status: 'BLOCKED' },
      { id: 'studio.typed-logic', status: 'BLOCKED' },
      { id: 'studio.dialogue-text', status: 'BLOCKED' },
    ],
    vocabulary: {
      triggerKinds: [{ id: 'actor-defeated', status: 'BLOCKED' }],
      actionKinds: [
        { id: 'drop-item', status: 'BLOCKED' },
        { id: 'set-variable', status: 'BLOCKED' },
        { id: 'show-text', status: 'BLOCKED' },
      ],
      variableTypes: [{ id: 'boolean', status: 'BLOCKED' }],
    },
  };
}

function buildAnalysis(source) {
  const a3a = buildA3aProjection(source);
  const { gaps, projected } = analyzeGaps(source, a3a);
  return {
    a3a,
    gaps,
    coverage: buildCoverage(source, projected, gaps),
    capabilityDelta: buildCapabilityDelta(),
  };
}

function validateStoredHash(value, expected, label) {
  invariant(typeof value === 'string' && HASH_PATTERN.test(value) && value === expected,
    'NUMBERDROID_LEVEL_PROJECTION_HASH_MISMATCH', `${label} does not match its canonical value.`, { field: label });
}

function projectionFingerprint(value) {
  const core = { ...value };
  delete core.fingerprint;
  return sha256(canonicalJson(core));
}

export function validateNumberdroidLevelAuthoringProjection(value, compiler) {
  const projection = snapshotPlainData(value, 'projection', PROJECTION_SNAPSHOT_LIMITS);
  const port = validateCompilerPort(compiler);
  exactRecord(projection, ['schemaVersion', 'kind', 'projectionVersion', 'status', 'source', 'compiler', 'a3a', 'gaps', 'coverage', 'capabilityDelta', 'fingerprint'], [], 'projection');
  invariant(projection.schemaVersion === NUMBERDROID_LEVEL_AUTHORING_PROJECTION_SCHEMA_VERSION
    && projection.kind === NUMBERDROID_LEVEL_AUTHORING_PROJECTION_KIND
    && projection.projectionVersion === NUMBERDROID_LEVEL_AUTHORING_PROJECTION_VERSION,
  'NUMBERDROID_LEVEL_PROJECTION_SCHEMA_UNSUPPORTED', 'The Numberdroid level-authoring projection schema is unsupported.');
  invariant(projection.status === 'LOSSLESS_WITH_GAPS', 'NUMBERDROID_LEVEL_PROJECTION_INPUT_INVALID', 'projection.status must be LOSSLESS_WITH_GAPS.');

  const sourceRecord = exactRecord(projection.source, ['formatId', 'levelSpec', 'canonicalJson', 'sha256'], [], 'projection.source');
  invariant(sourceRecord.formatId === 'numberdroid.level-spec', 'NUMBERDROID_LEVEL_PROJECTION_INPUT_INVALID', 'projection.source.formatId is invalid.');
  const source = validateNumberdroidLevelSpec(sourceRecord.levelSpec);
  const expectedSourceJson = canonicalJson(source);
  invariant(sourceRecord.canonicalJson === expectedSourceJson, 'NUMBERDROID_LEVEL_PROJECTION_HASH_MISMATCH', 'projection.source.canonicalJson is not canonical.');
  validateStoredHash(sourceRecord.sha256, sha256(expectedSourceJson), 'projection.source.sha256');

  const compilerRecord = exactRecord(projection.compiler, ['compilerVersion', 'formatId', 'semanticPlan', 'canonicalJson', 'sha256'], [], 'projection.compiler');
  invariant(compilerRecord.compilerVersion === port.compilerVersion, 'NUMBERDROID_LEVEL_PROJECTION_COMPILER_INVALID', 'projection.compiler.compilerVersion does not match the trusted compiler port.');
  invariant(compilerRecord.formatId === 'numberdroid.compiled-level-spec', 'NUMBERDROID_LEVEL_PROJECTION_INPUT_INVALID', 'projection.compiler.formatId is invalid.');
  const plan = validatePlanClosure(compilerRecord.semanticPlan, source);
  const expectedPlanJson = canonicalJson(plan);
  invariant(compilerRecord.canonicalJson === expectedPlanJson, 'NUMBERDROID_LEVEL_PROJECTION_HASH_MISMATCH', 'projection.compiler.canonicalJson is not canonical.');
  validateStoredHash(compilerRecord.sha256, sha256(expectedPlanJson), 'projection.compiler.sha256');
  const trustedPlan = compileTrustedPlan(source, port, expectedSourceJson);
  invariant(sameValue(plan, trustedPlan), 'NUMBERDROID_LEVEL_PROJECTION_PLAN_FORGED', 'The compiler closure is not the exact output of the trusted pinned compiler port.');

  const a3aRecord = exactRecord(projection.a3a, ['requirementSet', 'requirementSetFingerprint', 'levelGraph', 'levelGraphFingerprint', 'logicGraph', 'logicGraphFingerprint'], [], 'projection.a3a');
  const requirementSet = validateLevelRequirementSet(a3aRecord.requirementSet);
  const levelGraph = validateLevelGraph(a3aRecord.levelGraph);
  const logicGraph = validateLogicGraph(a3aRecord.logicGraph);
  validateStoredHash(a3aRecord.requirementSetFingerprint, a3aSha256(requirementSet), 'projection.a3a.requirementSetFingerprint');
  validateStoredHash(a3aRecord.levelGraphFingerprint, a3aSha256(levelGraph), 'projection.a3a.levelGraphFingerprint');
  validateStoredHash(a3aRecord.logicGraphFingerprint, a3aSha256(logicGraph), 'projection.a3a.logicGraphFingerprint');

  const expected = buildAnalysis(source);
  invariant(sameValue(a3aRecord, expected.a3a), 'NUMBERDROID_LEVEL_PROJECTION_A3A_FORGED', 'The A3a graph closure is not the exact projection of the retained Numberdroid source.');
  invariant(sameValue(projection.gaps, expected.gaps) && sameValue(projection.coverage, expected.coverage)
    && sameValue(projection.capabilityDelta, expected.capabilityDelta),
  'NUMBERDROID_LEVEL_PROJECTION_ANALYSIS_MISMATCH', 'Gap, coverage, or capability-delta analysis does not match the source projection.');
  validateStoredHash(projection.fingerprint, projectionFingerprint(projection), 'projection.fingerprint');
  return deepFreeze(projection);
}

export function createNumberdroidLevelAuthoringProjection({ levelSpec, compiler }) {
  const source = validateNumberdroidLevelSpec(levelSpec);
  const port = validateCompilerPort(compiler);
  const sourceJson = canonicalJson(source);

  const plan = compileTrustedPlan(source, port, sourceJson);
  const planJson = canonicalJson(plan);
  const analysis = buildAnalysis(source);
  const projection = {
    schemaVersion: NUMBERDROID_LEVEL_AUTHORING_PROJECTION_SCHEMA_VERSION,
    kind: NUMBERDROID_LEVEL_AUTHORING_PROJECTION_KIND,
    projectionVersion: NUMBERDROID_LEVEL_AUTHORING_PROJECTION_VERSION,
    status: 'LOSSLESS_WITH_GAPS',
    source: {
      formatId: 'numberdroid.level-spec',
      levelSpec: source,
      canonicalJson: sourceJson,
      sha256: sha256(sourceJson),
    },
    compiler: {
      compilerVersion: port.compilerVersion,
      formatId: 'numberdroid.compiled-level-spec',
      semanticPlan: plan,
      canonicalJson: planJson,
      sha256: sha256(planJson),
    },
    ...analysis,
  };
  projection.fingerprint = projectionFingerprint(projection);
  return validateNumberdroidLevelAuthoringProjection(projection, port);
}

function compileTrustedPlan(source, port, sourceJson) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const validationInput = deepFreeze(snapshotPlainData(source, `compiler.validationInput[${attempt}]`));
    const result = callCompiler(port.validatePlacementOverrides, validationInput,
      'NUMBERDROID_LEVEL_PROJECTION_OVERRIDE_VALIDATION_FAILED', 'Numberdroid placement-override validation failed');
    invariant(result === undefined, 'NUMBERDROID_LEVEL_PROJECTION_COMPILER_INVALID', 'compiler.validatePlacementOverrides must return undefined on success.');
    invariant(canonicalJson(validationInput) === sourceJson, 'NUMBERDROID_LEVEL_PROJECTION_COMPILER_MUTATED_INPUT', 'compiler.validatePlacementOverrides mutated its input.');
  }

  const plans = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const compileInput = deepFreeze(snapshotPlainData(source, `compiler.compileInput[${attempt}]`));
    const rawPlan = callCompiler(port.compileLevelSpec, compileInput,
      'NUMBERDROID_LEVEL_PROJECTION_COMPILE_FAILED', 'Numberdroid LevelSpec compilation failed');
    invariant(canonicalJson(compileInput) === sourceJson, 'NUMBERDROID_LEVEL_PROJECTION_COMPILER_MUTATED_INPUT', 'compiler.compileLevelSpec mutated its input.');
    plans.push(validatePlanClosure(rawPlan, source));
  }
  invariant(sameValue(plans[0], plans[1]), 'NUMBERDROID_LEVEL_PROJECTION_COMPILER_NONDETERMINISTIC', 'The exact compiler port produced different semantic plans for the same LevelSpec.');
  return plans[0];
}

export function canonicalNumberdroidLevelAuthoringProjectionJson(value, compiler) {
  return canonicalJson(validateNumberdroidLevelAuthoringProjection(value, compiler));
}

export function numberdroidLevelAuthoringProjectionSha256(value, compiler) {
  return validateNumberdroidLevelAuthoringProjection(value, compiler).fingerprint;
}
