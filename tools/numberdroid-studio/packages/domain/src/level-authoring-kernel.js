import { createHash } from 'node:crypto';
import { invariant } from './errors.js';

export const LEVEL_REQUIREMENT_SET_SCHEMA_VERSION = 1;
export const LEVEL_REQUIREMENT_SET_KIND = 'studio.level-requirement-set';
export const LEVEL_GRAPH_SCHEMA_VERSION = 1;
export const LEVEL_GRAPH_KIND = 'studio.level-graph';
export const LOGIC_GRAPH_SCHEMA_VERSION = 1;
export const LOGIC_GRAPH_KIND = 'studio.logic-graph';

const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const TOKEN_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const REQUIREMENT_PRIORITIES = Object.freeze(['REQUIRED', 'PREFERRED', 'OPTIONAL']);
const CONSTRAINT_STRENGTHS = Object.freeze(['HARD', 'SOFT']);
const TRIGGER_KINDS = Object.freeze(['actor-defeated', 'collect', 'state-change']);
const CONDITION_KINDS = Object.freeze(['equals']);
const ACTION_KINDS = Object.freeze(['drop-item', 'set-variable', 'show-text']);
const VARIABLE_TYPES = Object.freeze(['boolean']);

function exactRecord(value, allowed, label) {
  invariant(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    'LEVEL_AUTHORING_CONTRACT_INVALID',
    `${label} must be an object.`,
    { field: label },
  );
  const prototype = Object.getPrototypeOf(value);
  invariant(
    prototype === Object.prototype || prototype === null,
    'LEVEL_AUTHORING_CONTRACT_INVALID',
    `${label} must be a plain data object.`,
    { field: label },
  );
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    invariant(
      typeof key === 'string' && allowed.includes(key) && descriptor?.enumerable && 'value' in descriptor,
      'LEVEL_AUTHORING_CONTRACT_FIELD_FORBIDDEN',
      `${label}.${String(key)} is not permitted.`,
      { field: `${label}.${String(key)}` },
    );
  }
  return value;
}

function denseArray(value, label, { min = 0, max = 512 } = {}) {
  invariant(
    Array.isArray(value)
      && Object.getPrototypeOf(value) === Array.prototype
      && value.length >= min
      && value.length <= max,
    'LEVEL_AUTHORING_CONTRACT_INVALID',
    `${label} must contain between ${min} and ${max} entries.`,
    { field: label },
  );
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    invariant(
      descriptor?.enumerable && 'value' in descriptor,
      'LEVEL_AUTHORING_CONTRACT_INVALID',
      `${label} must be a dense array of plain data entries.`,
      { field: `${label}[${index}]` },
    );
  }
  for (const key of Reflect.ownKeys(value)) {
    const isIndex = typeof key === 'string'
      && /^(?:0|[1-9][0-9]*)$/.test(key)
      && Number(key) < value.length;
    invariant(
      key === 'length' || isIndex,
      'LEVEL_AUTHORING_CONTRACT_FIELD_FORBIDDEN',
      `${label}.${String(key)} is not permitted.`,
      { field: `${label}.${String(key)}` },
    );
  }
  return value;
}

function compareText(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function requireText(value, label, { max = 1024 } = {}) {
  invariant(
    typeof value === 'string'
      && value.length >= 1
      && value.length <= max
      && value.trim() === value
      && !CONTROL_CHARACTER_PATTERN.test(value),
    'LEVEL_AUTHORING_CONTRACT_INVALID',
    `${label} must be a bounded, trimmed string without control characters.`,
    { field: label },
  );
  return value;
}

function requireId(value, label) {
  const id = requireText(value, label, { max: 128 });
  invariant(
    ID_PATTERN.test(id),
    'LEVEL_AUTHORING_CONTRACT_INVALID',
    `${label} must be a safe stable identifier.`,
    { field: label, value: id },
  );
  return id;
}

function requireToken(value, label) {
  const token = requireText(value, label, { max: 64 });
  invariant(
    TOKEN_PATTERN.test(token),
    'LEVEL_AUTHORING_CONTRACT_INVALID',
    `${label} must be a lowercase token.`,
    { field: label, value: token },
  );
  return token;
}

function requireEnum(value, label, allowed) {
  invariant(
    allowed.includes(value),
    'LEVEL_AUTHORING_CONTRACT_INVALID',
    `${label} is unsupported.`,
    { field: label, value, allowed },
  );
  return value;
}

function requireVersion(value, label) {
  invariant(
    Number.isSafeInteger(value) && value >= 1,
    'LEVEL_AUTHORING_CONTRACT_INVALID',
    `${label} must be a positive safe integer.`,
    { field: label, value },
  );
  return value;
}

function requireFiniteNumber(value, label) {
  invariant(
    typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1_000_000,
    'LEVEL_AUTHORING_CONTRACT_INVALID',
    `${label} must be a bounded finite number.`,
    { field: label, value },
  );
  return Object.is(value, -0) ? 0 : value;
}

function requireFingerprint(value, label) {
  invariant(
    typeof value === 'string' && FINGERPRINT_PATTERN.test(value),
    'LEVEL_AUTHORING_CONTRACT_INVALID',
    `${label} must be a lowercase SHA-256 fingerprint.`,
    { field: label, value },
  );
  return value;
}

function sortedUnique(values, label, normalize, identity = (entry) => entry) {
  const normalized = denseArray(values, label).map((entry, index) => normalize(entry, `${label}[${index}]`));
  const seen = new Set();
  for (const entry of normalized) {
    const key = identity(entry);
    invariant(
      !seen.has(key),
      'LEVEL_AUTHORING_CONTRACT_DUPLICATE',
      `${label} contains duplicate identifier ${key}.`,
      { field: label, id: key },
    );
    seen.add(key);
  }
  return normalized.sort((left, right) => compareText(identity(left), identity(right)));
}

function orderedUniqueIds(values, label, { min = 0 } = {}) {
  const normalized = denseArray(values, label, { min }).map((entry, index) => requireId(entry, `${label}[${index}]`));
  invariant(
    new Set(normalized).size === normalized.length,
    'LEVEL_AUTHORING_CONTRACT_DUPLICATE',
    `${label} must not contain duplicate identifiers.`,
    { field: label },
  );
  return normalized;
}

function sortedIds(values, label) {
  return sortedUnique(values, label, requireId);
}

function normalizeTrace(record, label) {
  return {
    requirementIds: sortedIds(record.requirementIds, `${label}.requirementIds`),
    assumptionIds: sortedIds(record.assumptionIds, `${label}.assumptionIds`),
  };
}

function normalizeVersionFingerprintPin(value, label, idField) {
  const record = exactRecord(value, [idField, 'version', 'fingerprint'], label);
  return {
    [idField]: requireId(record[idField], `${label}.${idField}`),
    version: requireVersion(record.version, `${label}.version`),
    fingerprint: requireFingerprint(record.fingerprint, `${label}.fingerprint`),
  };
}

function normalizeRequirement(value, label) {
  const record = exactRecord(value, ['requirementId', 'category', 'priority', 'statement'], label);
  return {
    requirementId: requireId(record.requirementId, `${label}.requirementId`),
    category: requireToken(record.category, `${label}.category`),
    priority: requireEnum(record.priority, `${label}.priority`, REQUIREMENT_PRIORITIES),
    statement: requireText(record.statement, `${label}.statement`),
  };
}

function normalizeConstraint(value, label) {
  const record = exactRecord(value, ['constraintId', 'strength', 'kind', 'statement', 'requirementIds'], label);
  return {
    constraintId: requireId(record.constraintId, `${label}.constraintId`),
    strength: requireEnum(record.strength, `${label}.strength`, CONSTRAINT_STRENGTHS),
    kind: requireToken(record.kind, `${label}.kind`),
    statement: requireText(record.statement, `${label}.statement`),
    requirementIds: sortedIds(record.requirementIds, `${label}.requirementIds`),
  };
}

function normalizeAmbiguity(value, label) {
  const record = exactRecord(value, ['ambiguityId', 'question', 'requirementIds'], label);
  return {
    ambiguityId: requireId(record.ambiguityId, `${label}.ambiguityId`),
    question: requireText(record.question, `${label}.question`),
    requirementIds: sortedIds(record.requirementIds, `${label}.requirementIds`),
  };
}

function normalizeAssumption(value, label) {
  const record = exactRecord(value, ['assumptionId', 'statement', 'requirementIds'], label);
  return {
    assumptionId: requireId(record.assumptionId, `${label}.assumptionId`),
    statement: requireText(record.statement, `${label}.statement`),
    requirementIds: sortedIds(record.requirementIds, `${label}.requirementIds`),
  };
}

function normalizeAcceptanceCriterion(value, label) {
  const record = exactRecord(value, ['criterionId', 'statement', 'requirementIds'], label);
  return {
    criterionId: requireId(record.criterionId, `${label}.criterionId`),
    statement: requireText(record.statement, `${label}.statement`),
    requirementIds: sortedIds(record.requirementIds, `${label}.requirementIds`),
  };
}

function normalizeSpace(value, label) {
  const record = exactRecord(value, ['spaceId', 'kind', 'roomVariant', 'requirementIds', 'assumptionIds'], label);
  return {
    spaceId: requireId(record.spaceId, `${label}.spaceId`),
    kind: requireToken(record.kind, `${label}.kind`),
    roomVariant: record.roomVariant === null
      ? null
      : normalizeVersionFingerprintPin(record.roomVariant, `${label}.roomVariant`, 'roomVariantId'),
    ...normalizeTrace(record, label),
  };
}

function normalizeConnection(value, label) {
  const record = exactRecord(value, [
    'connectionId', 'kind', 'fromSpaceId', 'toSpaceId', 'requirementIds', 'assumptionIds',
  ], label);
  return {
    connectionId: requireId(record.connectionId, `${label}.connectionId`),
    kind: requireToken(record.kind, `${label}.kind`),
    fromSpaceId: requireId(record.fromSpaceId, `${label}.fromSpaceId`),
    toSpaceId: requireId(record.toSpaceId, `${label}.toSpaceId`),
    ...normalizeTrace(record, label),
  };
}

function normalizeZone(value, label) {
  const record = exactRecord(value, ['zoneId', 'kind', 'spaceId', 'anchor', 'requirementIds', 'assumptionIds'], label);
  const anchor = exactRecord(record.anchor, ['kind', 'targetId'], `${label}.anchor`);
  return {
    zoneId: requireId(record.zoneId, `${label}.zoneId`),
    kind: requireToken(record.kind, `${label}.kind`),
    spaceId: requireId(record.spaceId, `${label}.spaceId`),
    anchor: {
      kind: requireToken(anchor.kind, `${label}.anchor.kind`),
      targetId: anchor.targetId === null ? null : requireId(anchor.targetId, `${label}.anchor.targetId`),
    },
    ...normalizeTrace(record, label),
  };
}

function normalizePath(value, label) {
  const record = exactRecord(value, ['pathId', 'kind', 'spaceIds', 'requirementIds', 'assumptionIds'], label);
  return {
    pathId: requireId(record.pathId, `${label}.pathId`),
    kind: requireToken(record.kind, `${label}.kind`),
    spaceIds: orderedUniqueIds(record.spaceIds, `${label}.spaceIds`, { min: 1 }),
    ...normalizeTrace(record, label),
  };
}

function normalizePlacement(value, label) {
  const record = exactRecord(value, [
    'placementId', 'kind', 'spaceId', 'asset', 'transform', 'requirementIds', 'assumptionIds',
  ], label);
  const asset = exactRecord(record.asset, ['assetId', 'assetVersion', 'metadataVersion', 'fingerprint'], `${label}.asset`);
  const transform = exactRecord(record.transform, ['unitId', 'x', 'y', 'rotation'], `${label}.transform`);
  return {
    placementId: requireId(record.placementId, `${label}.placementId`),
    kind: requireToken(record.kind, `${label}.kind`),
    spaceId: requireId(record.spaceId, `${label}.spaceId`),
    asset: {
      assetId: requireId(asset.assetId, `${label}.asset.assetId`),
      assetVersion: requireVersion(asset.assetVersion, `${label}.asset.assetVersion`),
      metadataVersion: requireVersion(asset.metadataVersion, `${label}.asset.metadataVersion`),
      fingerprint: requireFingerprint(asset.fingerprint, `${label}.asset.fingerprint`),
    },
    transform: {
      unitId: requireToken(transform.unitId, `${label}.transform.unitId`),
      x: requireFiniteNumber(transform.x, `${label}.transform.x`),
      y: requireFiniteNumber(transform.y, `${label}.transform.y`),
      rotation: requireFiniteNumber(transform.rotation, `${label}.transform.rotation`),
    },
    ...normalizeTrace(record, label),
  };
}

function normalizeActor(value, label) {
  const record = exactRecord(value, [
    'actorId', 'kind', 'archetype', 'spaceId', 'routeId', 'requirementIds', 'assumptionIds',
  ], label);
  const archetype = exactRecord(record.archetype, ['archetypeId', 'version'], `${label}.archetype`);
  return {
    actorId: requireId(record.actorId, `${label}.actorId`),
    kind: requireToken(record.kind, `${label}.kind`),
    archetype: {
      archetypeId: requireId(archetype.archetypeId, `${label}.archetype.archetypeId`),
      version: requireVersion(archetype.version, `${label}.archetype.version`),
    },
    spaceId: requireId(record.spaceId, `${label}.spaceId`),
    routeId: record.routeId === null ? null : requireId(record.routeId, `${label}.routeId`),
    ...normalizeTrace(record, label),
  };
}

function normalizeRoute(value, label) {
  const record = exactRecord(value, ['routeId', 'kind', 'spaceIds', 'requirementIds', 'assumptionIds'], label);
  return {
    routeId: requireId(record.routeId, `${label}.routeId`),
    kind: requireToken(record.kind, `${label}.kind`),
    spaceIds: orderedUniqueIds(record.spaceIds, `${label}.spaceIds`, { min: 1 }),
    ...normalizeTrace(record, label),
  };
}

function normalizePickup(value, label) {
  const record = exactRecord(value, ['pickupId', 'kind', 'itemId', 'spaceId', 'requirementIds', 'assumptionIds'], label);
  return {
    pickupId: requireId(record.pickupId, `${label}.pickupId`),
    kind: requireToken(record.kind, `${label}.kind`),
    itemId: requireId(record.itemId, `${label}.itemId`),
    spaceId: requireId(record.spaceId, `${label}.spaceId`),
    ...normalizeTrace(record, label),
  };
}

function normalizeLogicBinding(value, label) {
  const record = exactRecord(value, ['bindingId', 'target', 'triggerIds', 'requirementIds', 'assumptionIds'], label);
  const target = exactRecord(record.target, ['kind', 'id'], `${label}.target`);
  return {
    bindingId: requireId(record.bindingId, `${label}.bindingId`),
    target: {
      kind: requireToken(target.kind, `${label}.target.kind`),
      id: requireId(target.id, `${label}.target.id`),
    },
    triggerIds: orderedUniqueIds(record.triggerIds, `${label}.triggerIds`, { min: 1 }),
    ...normalizeTrace(record, label),
  };
}

function normalizeVariable(value, label) {
  const record = exactRecord(value, ['variableId', 'type', 'initialValue', 'requirementIds', 'assumptionIds'], label);
  const type = requireEnum(record.type, `${label}.type`, VARIABLE_TYPES);
  invariant(
    type === 'boolean' && typeof record.initialValue === 'boolean',
    'LEVEL_AUTHORING_CONTRACT_INVALID',
    `${label}.initialValue does not match ${type}.`,
    { field: `${label}.initialValue`, type },
  );
  return {
    variableId: requireId(record.variableId, `${label}.variableId`),
    type,
    initialValue: record.initialValue,
    ...normalizeTrace(record, label),
  };
}

function normalizeTextReference(value, label) {
  const record = exactRecord(value, ['textRefId', 'requirementIds', 'assumptionIds'], label);
  return {
    textRefId: requireId(record.textRefId, `${label}.textRefId`),
    ...normalizeTrace(record, label),
  };
}

function normalizeCondition(value, label) {
  const record = exactRecord(value, [
    'conditionId', 'kind', 'variableId', 'value', 'requirementIds', 'assumptionIds',
  ], label);
  const kind = requireEnum(record.kind, `${label}.kind`, CONDITION_KINDS);
  invariant(
    typeof record.value === 'boolean',
    'LEVEL_AUTHORING_CONTRACT_INVALID',
    `${label}.value must be boolean for ${kind}.`,
    { field: `${label}.value` },
  );
  return {
    conditionId: requireId(record.conditionId, `${label}.conditionId`),
    kind,
    variableId: requireId(record.variableId, `${label}.variableId`),
    value: record.value,
    ...normalizeTrace(record, label),
  };
}

function normalizeTrigger(value, label) {
  const base = exactRecord(value, [
    'triggerId', 'kind', 'actorId', 'pickupId', 'variableId', 'conditionIds', 'actionIds',
    'requirementIds', 'assumptionIds',
  ], label);
  const kind = requireEnum(base.kind, `${label}.kind`, TRIGGER_KINDS);
  const allowedByKind = {
    'actor-defeated': ['triggerId', 'kind', 'actorId', 'conditionIds', 'actionIds', 'requirementIds', 'assumptionIds'],
    collect: ['triggerId', 'kind', 'pickupId', 'conditionIds', 'actionIds', 'requirementIds', 'assumptionIds'],
    'state-change': ['triggerId', 'kind', 'variableId', 'conditionIds', 'actionIds', 'requirementIds', 'assumptionIds'],
  };
  exactRecord(value, allowedByKind[kind], label);
  const normalized = {
    triggerId: requireId(base.triggerId, `${label}.triggerId`),
    kind,
    conditionIds: sortedIds(base.conditionIds, `${label}.conditionIds`),
    actionIds: orderedUniqueIds(base.actionIds, `${label}.actionIds`, { min: 1 }),
    ...normalizeTrace(base, label),
  };
  if (kind === 'actor-defeated') normalized.actorId = requireId(base.actorId, `${label}.actorId`);
  if (kind === 'collect') normalized.pickupId = requireId(base.pickupId, `${label}.pickupId`);
  if (kind === 'state-change') normalized.variableId = requireId(base.variableId, `${label}.variableId`);
  return normalized;
}

function normalizeAction(value, label) {
  const base = exactRecord(value, [
    'actionId', 'kind', 'actorId', 'pickupId', 'variableId', 'value', 'textRefId',
    'requirementIds', 'assumptionIds',
  ], label);
  const kind = requireEnum(base.kind, `${label}.kind`, ACTION_KINDS);
  const allowedByKind = {
    'drop-item': ['actionId', 'kind', 'actorId', 'pickupId', 'requirementIds', 'assumptionIds'],
    'set-variable': ['actionId', 'kind', 'variableId', 'value', 'requirementIds', 'assumptionIds'],
    'show-text': ['actionId', 'kind', 'textRefId', 'requirementIds', 'assumptionIds'],
  };
  exactRecord(value, allowedByKind[kind], label);
  const normalized = {
    actionId: requireId(base.actionId, `${label}.actionId`),
    kind,
    ...normalizeTrace(base, label),
  };
  if (kind === 'drop-item') {
    normalized.actorId = requireId(base.actorId, `${label}.actorId`);
    normalized.pickupId = requireId(base.pickupId, `${label}.pickupId`);
  }
  if (kind === 'set-variable') {
    normalized.variableId = requireId(base.variableId, `${label}.variableId`);
    invariant(
      typeof base.value === 'boolean',
      'LEVEL_AUTHORING_CONTRACT_INVALID',
      `${label}.value must be boolean.`,
      { field: `${label}.value` },
    );
    normalized.value = base.value;
  }
  if (kind === 'show-text') normalized.textRefId = requireId(base.textRefId, `${label}.textRefId`);
  return normalized;
}

function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function canonicalJson(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function validateLevelRequirementSet(value) {
  const record = exactRecord(value, [
    'schemaVersion', 'kind', 'projectId', 'requirementSetId', 'version', 'requirements',
    'constraints', 'ambiguities', 'assumptions', 'acceptanceCriteria',
  ], 'levelRequirementSet');
  invariant(
    record.schemaVersion === LEVEL_REQUIREMENT_SET_SCHEMA_VERSION,
    'LEVEL_AUTHORING_CONTRACT_SCHEMA_UNSUPPORTED',
    'Unsupported LevelRequirementSet schema version.',
    { value: record.schemaVersion },
  );
  invariant(
    record.kind === LEVEL_REQUIREMENT_SET_KIND,
    'LEVEL_AUTHORING_CONTRACT_INVALID',
    'LevelRequirementSet kind is invalid.',
    { value: record.kind },
  );
  return deepFreeze({
    schemaVersion: LEVEL_REQUIREMENT_SET_SCHEMA_VERSION,
    kind: LEVEL_REQUIREMENT_SET_KIND,
    projectId: requireId(record.projectId, 'levelRequirementSet.projectId'),
    requirementSetId: requireId(record.requirementSetId, 'levelRequirementSet.requirementSetId'),
    version: requireVersion(record.version, 'levelRequirementSet.version'),
    requirements: sortedUnique(record.requirements, 'levelRequirementSet.requirements', normalizeRequirement, (entry) => entry.requirementId),
    constraints: sortedUnique(record.constraints, 'levelRequirementSet.constraints', normalizeConstraint, (entry) => entry.constraintId),
    ambiguities: sortedUnique(record.ambiguities, 'levelRequirementSet.ambiguities', normalizeAmbiguity, (entry) => entry.ambiguityId),
    assumptions: sortedUnique(record.assumptions, 'levelRequirementSet.assumptions', normalizeAssumption, (entry) => entry.assumptionId),
    acceptanceCriteria: sortedUnique(record.acceptanceCriteria, 'levelRequirementSet.acceptanceCriteria', normalizeAcceptanceCriterion, (entry) => entry.criterionId),
  });
}

export function canonicalLevelRequirementSetJson(value) {
  return canonicalJson(validateLevelRequirementSet(value));
}

export function levelRequirementSetSha256(value) {
  return sha256(canonicalLevelRequirementSetJson(value));
}

export function validateLevelGraph(value) {
  const record = exactRecord(value, [
    'schemaVersion', 'kind', 'projectId', 'levelGraphId', 'version', 'requirementSet',
    'spaces', 'connections', 'zones', 'paths', 'placements', 'actors', 'routes', 'pickups',
    'logicBindings',
  ], 'levelGraph');
  invariant(
    record.schemaVersion === LEVEL_GRAPH_SCHEMA_VERSION,
    'LEVEL_AUTHORING_CONTRACT_SCHEMA_UNSUPPORTED',
    'Unsupported LevelGraph schema version.',
    { value: record.schemaVersion },
  );
  invariant(
    record.kind === LEVEL_GRAPH_KIND,
    'LEVEL_AUTHORING_CONTRACT_INVALID',
    'LevelGraph kind is invalid.',
    { value: record.kind },
  );
  return deepFreeze({
    schemaVersion: LEVEL_GRAPH_SCHEMA_VERSION,
    kind: LEVEL_GRAPH_KIND,
    projectId: requireId(record.projectId, 'levelGraph.projectId'),
    levelGraphId: requireId(record.levelGraphId, 'levelGraph.levelGraphId'),
    version: requireVersion(record.version, 'levelGraph.version'),
    requirementSet: normalizeVersionFingerprintPin(record.requirementSet, 'levelGraph.requirementSet', 'requirementSetId'),
    spaces: sortedUnique(record.spaces, 'levelGraph.spaces', normalizeSpace, (entry) => entry.spaceId),
    connections: sortedUnique(record.connections, 'levelGraph.connections', normalizeConnection, (entry) => entry.connectionId),
    zones: sortedUnique(record.zones, 'levelGraph.zones', normalizeZone, (entry) => entry.zoneId),
    paths: sortedUnique(record.paths, 'levelGraph.paths', normalizePath, (entry) => entry.pathId),
    placements: sortedUnique(record.placements, 'levelGraph.placements', normalizePlacement, (entry) => entry.placementId),
    actors: sortedUnique(record.actors, 'levelGraph.actors', normalizeActor, (entry) => entry.actorId),
    routes: sortedUnique(record.routes, 'levelGraph.routes', normalizeRoute, (entry) => entry.routeId),
    pickups: sortedUnique(record.pickups, 'levelGraph.pickups', normalizePickup, (entry) => entry.pickupId),
    logicBindings: sortedUnique(record.logicBindings, 'levelGraph.logicBindings', normalizeLogicBinding, (entry) => entry.bindingId),
  });
}

export function canonicalLevelGraphJson(value) {
  return canonicalJson(validateLevelGraph(value));
}

export function levelGraphSha256(value) {
  return sha256(canonicalLevelGraphJson(value));
}

export function validateLogicGraph(value) {
  const record = exactRecord(value, [
    'schemaVersion', 'kind', 'projectId', 'logicGraphId', 'version', 'levelGraph',
    'variables', 'textReferences', 'conditions', 'triggers', 'actions',
  ], 'logicGraph');
  invariant(
    record.schemaVersion === LOGIC_GRAPH_SCHEMA_VERSION,
    'LEVEL_AUTHORING_CONTRACT_SCHEMA_UNSUPPORTED',
    'Unsupported LogicGraph schema version.',
    { value: record.schemaVersion },
  );
  invariant(
    record.kind === LOGIC_GRAPH_KIND,
    'LEVEL_AUTHORING_CONTRACT_INVALID',
    'LogicGraph kind is invalid.',
    { value: record.kind },
  );
  return deepFreeze({
    schemaVersion: LOGIC_GRAPH_SCHEMA_VERSION,
    kind: LOGIC_GRAPH_KIND,
    projectId: requireId(record.projectId, 'logicGraph.projectId'),
    logicGraphId: requireId(record.logicGraphId, 'logicGraph.logicGraphId'),
    version: requireVersion(record.version, 'logicGraph.version'),
    levelGraph: normalizeVersionFingerprintPin(record.levelGraph, 'logicGraph.levelGraph', 'levelGraphId'),
    variables: sortedUnique(record.variables, 'logicGraph.variables', normalizeVariable, (entry) => entry.variableId),
    textReferences: sortedUnique(record.textReferences, 'logicGraph.textReferences', normalizeTextReference, (entry) => entry.textRefId),
    conditions: sortedUnique(record.conditions, 'logicGraph.conditions', normalizeCondition, (entry) => entry.conditionId),
    triggers: sortedUnique(record.triggers, 'logicGraph.triggers', normalizeTrigger, (entry) => entry.triggerId),
    actions: sortedUnique(record.actions, 'logicGraph.actions', normalizeAction, (entry) => entry.actionId),
  });
}

export function canonicalLogicGraphJson(value) {
  return canonicalJson(validateLogicGraph(value));
}

export function logicGraphSha256(value) {
  return sha256(canonicalLogicGraphJson(value));
}
