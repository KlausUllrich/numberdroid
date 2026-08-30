import {
  levelGraphSha256,
  levelRequirementSetSha256,
  logicGraphSha256,
  validateLevelGraph,
  validateLevelRequirementSet,
  validateLogicGraph,
} from '../../domain/src/level-authoring-kernel.js';
import {
  projectCapabilityManifestSha256,
  validateProjectCapabilityManifest,
} from '../../domain/src/project-capability-manifest.js';
import { invariant } from '../../domain/src/errors.js';
import { deepFreeze, fingerprint } from './value-utils.js';

export const LEVEL_AUTHORING_VALIDATION_KIND = 'studio.level-authoring-validation';
export const LEVEL_AUTHORING_VALIDATION_SCHEMA_VERSION = 1;
export const LEVEL_AUTHORING_VALIDATOR_VERSION = 'studio.level-authoring-validator.v1';

const SEVERITY_ORDER = Object.freeze({ ERROR: 0, WARNING: 1, INFO: 2 });
const REQUIRED_MODULES = Object.freeze({
  requirements: 'studio.level-requirements',
  levelGraph: 'studio.level-graph',
  actorRoute: 'studio.actor-route',
  typedLogic: 'studio.typed-logic',
  dialogueText: 'studio.dialogue-text',
});

const INPUT_DATA_LIMITS = Object.freeze({
  maxArrayLength: 4_096,
  maxDepth: 64,
  maxFields: 4_096,
  maxNodes: 100_000,
});

function assertPlainData(value, path, state, depth = 0) {
  if (value === null || typeof value !== 'object') return;
  invariant(
    depth <= INPUT_DATA_LIMITS.maxDepth,
    'LEVEL_AUTHORING_VALIDATION_INPUT_INVALID',
    `${path} exceeds the bounded plain-data depth.`,
    { field: path },
  );
  invariant(
    !state.seen.has(value),
    'LEVEL_AUTHORING_VALIDATION_INPUT_INVALID',
    `${path} must not contain cycles or shared object references.`,
    { field: path },
  );
  state.seen.add(value);
  state.nodes += 1;
  invariant(
    state.nodes <= INPUT_DATA_LIMITS.maxNodes,
    'LEVEL_AUTHORING_VALIDATION_INPUT_INVALID',
    `${path} exceeds the bounded plain-data size.`,
    { field: path },
  );
  if (Array.isArray(value)) {
    invariant(
      Object.getPrototypeOf(value) === Array.prototype
        && value.length <= INPUT_DATA_LIMITS.maxArrayLength,
      'LEVEL_AUTHORING_VALIDATION_INPUT_INVALID',
      `${path} must be a bounded plain data array.`,
      { field: path },
    );
    const keys = Reflect.ownKeys(value);
    invariant(
      keys.length <= INPUT_DATA_LIMITS.maxFields + 1,
      'LEVEL_AUTHORING_VALIDATION_INPUT_INVALID',
      `${path} has too many plain-data entries.`,
      { field: path },
    );
    for (const key of keys) {
      if (key === 'length') continue;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      const isIndex = typeof key === 'string'
        && /^(?:0|[1-9][0-9]*)$/.test(key)
        && Number(key) < value.length;
      invariant(
        isIndex && descriptor?.enumerable && 'value' in descriptor,
        'LEVEL_AUTHORING_VALIDATION_INPUT_INVALID',
        `${path}.${String(key)} must be an enumerable data entry.`,
        { field: `${path}.${String(key)}` },
      );
      assertPlainData(descriptor.value, `${path}[${key}]`, state, depth + 1);
    }
    for (let index = 0; index < value.length; index += 1) {
      invariant(
        Object.hasOwn(value, index),
        'LEVEL_AUTHORING_VALIDATION_INPUT_INVALID',
        `${path} must be dense.`,
        { field: `${path}[${index}]` },
      );
    }
    return;
  }
  const prototype = Object.getPrototypeOf(value);
  invariant(
    prototype === Object.prototype || prototype === null,
    'LEVEL_AUTHORING_VALIDATION_INPUT_INVALID',
    `${path} must be a plain data object.`,
    { field: path },
  );
  const keys = Reflect.ownKeys(value);
  invariant(
    keys.length <= INPUT_DATA_LIMITS.maxFields,
    'LEVEL_AUTHORING_VALIDATION_INPUT_INVALID',
    `${path} has too many plain-data fields.`,
    { field: path },
  );
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    invariant(
      typeof key === 'string' && descriptor?.enumerable && 'value' in descriptor,
      'LEVEL_AUTHORING_VALIDATION_INPUT_INVALID',
      `${path}.${String(key)} must be an enumerable data field.`,
      { field: `${path}.${String(key)}` },
    );
    assertPlainData(descriptor.value, `${path}.${key}`, state, depth + 1);
  }
}

function exactInput(value) {
  invariant(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    'LEVEL_AUTHORING_VALIDATION_INPUT_INVALID',
    'Level authoring validation input must be an object.',
  );
  const prototype = Object.getPrototypeOf(value);
  invariant(
    prototype === Object.prototype || prototype === null,
    'LEVEL_AUTHORING_VALIDATION_INPUT_INVALID',
    'Level authoring validation input must be a plain data object.',
  );
  const requiredFields = ['requirementSet', 'levelGraph', 'logicGraph', 'capabilityManifest'];
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    invariant(
      typeof key === 'string'
        && requiredFields.includes(key)
        && descriptor?.enumerable
        && 'value' in descriptor,
      'LEVEL_AUTHORING_VALIDATION_INPUT_INVALID',
      `Level authoring validation input field ${String(key)} is not permitted.`,
      { field: String(key) },
    );
  }
  for (const field of requiredFields) {
    invariant(
      Object.hasOwn(value, field),
      'LEVEL_AUTHORING_VALIDATION_INPUT_INVALID',
      `Level authoring validation input field ${field} is required.`,
      { field },
    );
  }
  assertPlainData(value, 'levelAuthoringValidationInput', {
    nodes: 0,
    seen: new WeakSet(),
  });
  return value;
}

function compareText(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function makeFinding({ severity = 'ERROR', ruleId, targetKind, targetId, path, explanation, remediation }) {
  return {
    findingId: fingerprint({
      validatorVersion: LEVEL_AUTHORING_VALIDATOR_VERSION,
      ruleId,
      targetKind,
      targetId,
      path,
    }),
    severity,
    ruleId,
    targetKind,
    targetId,
    path,
    explanation,
    remediation,
    validatorVersion: LEVEL_AUTHORING_VALIDATOR_VERSION,
  };
}

function sortFindings(findings) {
  return findings.sort((left, right) => (
    SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity]
      || compareText(left.ruleId, right.ruleId)
      || compareText(left.targetKind, right.targetKind)
      || compareText(left.targetId, right.targetId)
      || compareText(left.path, right.path)
  ));
}

function traceables(levelGraph, logicGraph) {
  const collections = [
    ['space', 'spaces', 'spaceId'],
    ['connection', 'connections', 'connectionId'],
    ['zone', 'zones', 'zoneId'],
    ['path', 'paths', 'pathId'],
    ['placement', 'placements', 'placementId'],
    ['actor', 'actors', 'actorId'],
    ['route', 'routes', 'routeId'],
    ['pickup', 'pickups', 'pickupId'],
    ['logic-binding', 'logicBindings', 'bindingId'],
  ];
  const logicCollections = [
    ['variable', 'variables', 'variableId'],
    ['text-reference', 'textReferences', 'textRefId'],
    ['condition', 'conditions', 'conditionId'],
    ['trigger', 'triggers', 'triggerId'],
    ['action', 'actions', 'actionId'],
  ];
  return [
    ...collections.flatMap(([targetKind, collection, idField]) => (
      levelGraph[collection].map((value, index) => ({
        targetKind,
        targetId: value[idField],
        path: `/levelGraph/${collection}/${index}`,
        value,
      }))
    )),
    ...logicCollections.flatMap(([targetKind, collection, idField]) => (
      logicGraph[collection].map((value, index) => ({
        targetKind,
        targetId: value[idField],
        path: `/logicGraph/${collection}/${index}`,
        value,
      }))
    )),
  ];
}

function levelEntitySets(levelGraph) {
  return {
    space: new Set(levelGraph.spaces.map(({ spaceId }) => spaceId)),
    connection: new Set(levelGraph.connections.map(({ connectionId }) => connectionId)),
    zone: new Set(levelGraph.zones.map(({ zoneId }) => zoneId)),
    path: new Set(levelGraph.paths.map(({ pathId }) => pathId)),
    placement: new Set(levelGraph.placements.map(({ placementId }) => placementId)),
    prop: new Set(levelGraph.placements.map(({ placementId }) => placementId)),
    actor: new Set(levelGraph.actors.map(({ actorId }) => actorId)),
    route: new Set(levelGraph.routes.map(({ routeId }) => routeId)),
    pickup: new Set(levelGraph.pickups.map(({ pickupId }) => pickupId)),
  };
}

function checkPin(findings, {
  actualId,
  actualVersion,
  actualFingerprint,
  expectedId,
  expectedVersion,
  expectedFingerprint,
  targetKind,
  targetId,
  path,
}) {
  if (
    actualId !== expectedId
    || actualVersion !== expectedVersion
    || actualFingerprint !== expectedFingerprint
  ) {
    findings.push(makeFinding({
      ruleId: 'LEVEL_AUTHORING_PIN_MISMATCH',
      targetKind,
      targetId,
      path,
      explanation: `${path} does not pin the supplied immutable value.`,
      remediation: 'Rebuild the referencing graph against the exact validated ID, version, and fingerprint.',
    }));
  }
}

function checkReference(findings, declaredIds, value, {
  targetKind,
  targetId,
  path,
  referencedKind,
}) {
  if (!declaredIds.has(value)) {
    findings.push(makeFinding({
      ruleId: 'LEVEL_AUTHORING_REFERENCE_UNKNOWN',
      targetKind,
      targetId,
      path,
      explanation: `${path} references unknown ${referencedKind} ${value}.`,
      remediation: `Reference a declared ${referencedKind} ID.`,
    }));
  }
}

function validateRequirementReferences(requirementSet, findings) {
  const requirementIds = new Set(requirementSet.requirements.map(({ requirementId }) => requirementId));
  const collections = [
    ['constraint', 'constraints', 'constraintId'],
    ['ambiguity', 'ambiguities', 'ambiguityId'],
    ['assumption', 'assumptions', 'assumptionId'],
    ['acceptance-criterion', 'acceptanceCriteria', 'criterionId'],
  ];
  for (const [targetKind, collection, idField] of collections) {
    requirementSet[collection].forEach((entry, index) => {
      entry.requirementIds.forEach((requirementId, requirementIndex) => {
        checkReference(findings, requirementIds, requirementId, {
          targetKind,
          targetId: entry[idField],
          path: `/requirementSet/${collection}/${index}/requirementIds/${requirementIndex}`,
          referencedKind: 'requirement',
        });
      });
    });
  }
  return requirementIds;
}

function validateTraceability(requirementSet, levelGraph, logicGraph, findings) {
  const requirementIds = validateRequirementReferences(requirementSet, findings);
  const assumptionIds = new Set(requirementSet.assumptions.map(({ assumptionId }) => assumptionId));
  const tracedRequirementIds = new Set();
  const untracedObjectRefs = [];
  for (const traceable of traceables(levelGraph, logicGraph)) {
    traceable.value.requirementIds.forEach((requirementId, index) => {
      if (requirementIds.has(requirementId)) tracedRequirementIds.add(requirementId);
      checkReference(findings, requirementIds, requirementId, {
        targetKind: traceable.targetKind,
        targetId: traceable.targetId,
        path: `${traceable.path}/requirementIds/${index}`,
        referencedKind: 'requirement',
      });
    });
    traceable.value.assumptionIds.forEach((assumptionId, index) => {
      checkReference(findings, assumptionIds, assumptionId, {
        targetKind: traceable.targetKind,
        targetId: traceable.targetId,
        path: `${traceable.path}/assumptionIds/${index}`,
        referencedKind: 'assumption',
      });
    });
    if (traceable.value.requirementIds.length === 0 && traceable.value.assumptionIds.length === 0) {
      const objectRef = `${traceable.targetKind}:${traceable.targetId}`;
      untracedObjectRefs.push(objectRef);
      findings.push(makeFinding({
        severity: 'WARNING',
        ruleId: 'LEVEL_AUTHORING_TRACE_MISSING',
        targetKind: traceable.targetKind,
        targetId: traceable.targetId,
        path: traceable.path,
        explanation: `${objectRef} has neither a requirement nor an assumption trace.`,
        remediation: 'Trace the object to a declared requirement or assumption.',
      }));
    }
  }

  const unmetRequiredRequirementIds = [];
  for (const requirement of requirementSet.requirements) {
    if (tracedRequirementIds.has(requirement.requirementId)) continue;
    if (requirement.priority === 'OPTIONAL') continue;
    const severity = requirement.priority === 'REQUIRED' ? 'ERROR' : 'WARNING';
    if (requirement.priority === 'REQUIRED') unmetRequiredRequirementIds.push(requirement.requirementId);
    findings.push(makeFinding({
      severity,
      ruleId: requirement.priority === 'REQUIRED'
        ? 'LEVEL_AUTHORING_REQUIRED_COVERAGE_MISSING'
        : 'LEVEL_AUTHORING_REQUIREMENT_COVERAGE_MISSING',
      targetKind: 'requirement',
      targetId: requirement.requirementId,
      path: `/requirementSet/requirements/${requirement.requirementId}`,
      explanation: `${requirement.priority} requirement ${requirement.requirementId} is not traced by the level or logic graph.`,
      remediation: 'Trace at least one graph object to the requirement or revise the requirement set.',
    }));
  }
  return {
    totalRequirements: requirementSet.requirements.length,
    tracedRequirementIds: [...tracedRequirementIds].sort(),
    unmetRequiredRequirementIds: unmetRequiredRequirementIds.sort(),
    untracedObjectRefs: untracedObjectRefs.sort(),
  };
}

function validateLevelReferences(levelGraph, logicGraph, findings) {
  const entities = levelEntitySets(levelGraph);
  const triggerIds = new Set(logicGraph.triggers.map(({ triggerId }) => triggerId));
  const triggersById = new Map(logicGraph.triggers.map((trigger) => [trigger.triggerId, trigger]));
  for (const [index, connection] of levelGraph.connections.entries()) {
    if (connection.fromSpaceId === connection.toSpaceId) {
      findings.push(makeFinding({
        ruleId: 'LEVEL_AUTHORING_CONNECTION_SELF_LOOP',
        targetKind: 'connection',
        targetId: connection.connectionId,
        path: `/levelGraph/connections/${index}`,
        explanation: `Connection ${connection.connectionId} starts and ends in ${connection.fromSpaceId}.`,
        remediation: 'Connect two different declared spaces.',
      }));
    }
    checkReference(findings, entities.space, connection.fromSpaceId, {
      targetKind: 'connection', targetId: connection.connectionId,
      path: `/levelGraph/connections/${index}/fromSpaceId`, referencedKind: 'space',
    });
    checkReference(findings, entities.space, connection.toSpaceId, {
      targetKind: 'connection', targetId: connection.connectionId,
      path: `/levelGraph/connections/${index}/toSpaceId`, referencedKind: 'space',
    });
  }
  for (const [index, zone] of levelGraph.zones.entries()) {
    checkReference(findings, entities.space, zone.spaceId, {
      targetKind: 'zone', targetId: zone.zoneId,
      path: `/levelGraph/zones/${index}/spaceId`, referencedKind: 'space',
    });
    if (zone.anchor.kind === 'space-center') {
      if (zone.anchor.targetId !== null) {
        findings.push(makeFinding({
          ruleId: 'LEVEL_AUTHORING_REFERENCE_INVALID',
          targetKind: 'zone',
          targetId: zone.zoneId,
          path: `/levelGraph/zones/${index}/anchor/targetId`,
          explanation: 'A space-center anchor must not name another target.',
          remediation: 'Set the space-center anchor targetId to null.',
        }));
      }
    } else if (!entities[zone.anchor.kind] || zone.anchor.targetId === null) {
      findings.push(makeFinding({
        ruleId: 'LEVEL_AUTHORING_REFERENCE_INVALID',
        targetKind: 'zone',
        targetId: zone.zoneId,
        path: `/levelGraph/zones/${index}/anchor`,
        explanation: `Zone anchor ${zone.anchor.kind} does not identify a supported graph target.`,
        remediation: 'Use a supported anchor kind and a declared target ID.',
      }));
    } else {
      checkReference(findings, entities[zone.anchor.kind], zone.anchor.targetId, {
        targetKind: 'zone', targetId: zone.zoneId,
        path: `/levelGraph/zones/${index}/anchor/targetId`, referencedKind: zone.anchor.kind,
      });
    }
  }
  for (const [collection, kind, idField] of [
    ['paths', 'path', 'pathId'],
    ['routes', 'route', 'routeId'],
  ]) {
    levelGraph[collection].forEach((entry, entryIndex) => {
      entry.spaceIds.forEach((spaceId, spaceIndex) => checkReference(findings, entities.space, spaceId, {
        targetKind: kind,
        targetId: entry[idField],
        path: `/levelGraph/${collection}/${entryIndex}/spaceIds/${spaceIndex}`,
        referencedKind: 'space',
      }));
    });
  }
  for (const [collection, kind, idField] of [
    ['placements', 'placement', 'placementId'],
    ['actors', 'actor', 'actorId'],
    ['pickups', 'pickup', 'pickupId'],
  ]) {
    levelGraph[collection].forEach((entry, index) => checkReference(findings, entities.space, entry.spaceId, {
      targetKind: kind,
      targetId: entry[idField],
      path: `/levelGraph/${collection}/${index}/spaceId`,
      referencedKind: 'space',
    }));
  }
  levelGraph.actors.forEach((actor, index) => {
    if (actor.routeId !== null) checkReference(findings, entities.route, actor.routeId, {
      targetKind: 'actor', targetId: actor.actorId,
      path: `/levelGraph/actors/${index}/routeId`, referencedKind: 'route',
    });
  });
  levelGraph.logicBindings.forEach((binding, index) => {
    const targets = entities[binding.target.kind];
    if (!targets) {
      findings.push(makeFinding({
        ruleId: 'LEVEL_AUTHORING_REFERENCE_INVALID',
        targetKind: 'logic-binding',
        targetId: binding.bindingId,
        path: `/levelGraph/logicBindings/${index}/target/kind`,
        explanation: `Logic binding target kind ${binding.target.kind} is unsupported.`,
        remediation: 'Bind logic to a supported declared level object.',
      }));
    } else {
      checkReference(findings, targets, binding.target.id, {
        targetKind: 'logic-binding', targetId: binding.bindingId,
        path: `/levelGraph/logicBindings/${index}/target/id`, referencedKind: binding.target.kind,
      });
    }
    binding.triggerIds.forEach((triggerId, triggerIndex) => checkReference(findings, triggerIds, triggerId, {
      targetKind: 'logic-binding', targetId: binding.bindingId,
      path: `/levelGraph/logicBindings/${index}/triggerIds/${triggerIndex}`, referencedKind: 'trigger',
    }));
    if (binding.target.kind === 'actor') {
      binding.triggerIds.forEach((triggerId, triggerIndex) => {
        const trigger = triggersById.get(triggerId);
        if (trigger && (trigger.kind !== 'actor-defeated' || trigger.actorId !== binding.target.id)) {
          findings.push(makeFinding({
            ruleId: 'LEVEL_AUTHORING_BINDING_TRIGGER_MISMATCH',
            targetKind: 'logic-binding',
            targetId: binding.bindingId,
            path: `/levelGraph/logicBindings/${index}/triggerIds/${triggerIndex}`,
            explanation: `Actor binding ${binding.bindingId} references a trigger for a different target.`,
            remediation: 'Bind the actor to an actor-defeated trigger for the same actor ID.',
          }));
        }
      });
    }
  });
  return entities;
}

function validateLogicReferences(levelGraph, logicGraph, findings) {
  const entities = validateLevelReferences(levelGraph, logicGraph, findings);
  const variableIds = new Set(logicGraph.variables.map(({ variableId }) => variableId));
  const textRefIds = new Set(logicGraph.textReferences.map(({ textRefId }) => textRefId));
  const conditionIds = new Set(logicGraph.conditions.map(({ conditionId }) => conditionId));
  const actionIds = new Set(logicGraph.actions.map(({ actionId }) => actionId));
  const actionsById = new Map(logicGraph.actions.map((action) => [action.actionId, action]));
  logicGraph.conditions.forEach((condition, index) => checkReference(findings, variableIds, condition.variableId, {
    targetKind: 'condition', targetId: condition.conditionId,
    path: `/logicGraph/conditions/${index}/variableId`, referencedKind: 'variable',
  }));
  logicGraph.triggers.forEach((trigger, index) => {
    const reference = trigger.kind === 'actor-defeated'
      ? ['actorId', entities.actor, 'actor']
      : trigger.kind === 'collect'
        ? ['pickupId', entities.pickup, 'pickup']
        : ['variableId', variableIds, 'variable'];
    checkReference(findings, reference[1], trigger[reference[0]], {
      targetKind: 'trigger', targetId: trigger.triggerId,
      path: `/logicGraph/triggers/${index}/${reference[0]}`, referencedKind: reference[2],
    });
    trigger.conditionIds.forEach((conditionId, conditionIndex) => checkReference(findings, conditionIds, conditionId, {
      targetKind: 'trigger', targetId: trigger.triggerId,
      path: `/logicGraph/triggers/${index}/conditionIds/${conditionIndex}`, referencedKind: 'condition',
    }));
    trigger.actionIds.forEach((actionId, actionIndex) => checkReference(findings, actionIds, actionId, {
      targetKind: 'trigger', targetId: trigger.triggerId,
      path: `/logicGraph/triggers/${index}/actionIds/${actionIndex}`, referencedKind: 'action',
    }));
    if (trigger.kind === 'actor-defeated') {
      trigger.actionIds.forEach((actionId, actionIndex) => {
        const action = actionsById.get(actionId);
        if (action?.kind === 'drop-item' && action.actorId !== trigger.actorId) {
          findings.push(makeFinding({
            ruleId: 'LEVEL_AUTHORING_TRIGGER_ACTION_MISMATCH',
            targetKind: 'trigger',
            targetId: trigger.triggerId,
            path: `/logicGraph/triggers/${index}/actionIds/${actionIndex}`,
            explanation: `Actor-defeated trigger ${trigger.triggerId} drops an item from a different actor.`,
            remediation: 'Use a drop-item action whose actorId matches the actor-defeated trigger.',
          }));
        }
      });
    }
  });
  logicGraph.actions.forEach((action, index) => {
    if (action.kind === 'drop-item') {
      checkReference(findings, entities.actor, action.actorId, {
        targetKind: 'action', targetId: action.actionId,
        path: `/logicGraph/actions/${index}/actorId`, referencedKind: 'actor',
      });
      checkReference(findings, entities.pickup, action.pickupId, {
        targetKind: 'action', targetId: action.actionId,
        path: `/logicGraph/actions/${index}/pickupId`, referencedKind: 'pickup',
      });
    }
    if (action.kind === 'set-variable') checkReference(findings, variableIds, action.variableId, {
      targetKind: 'action', targetId: action.actionId,
      path: `/logicGraph/actions/${index}/variableId`, referencedKind: 'variable',
    });
    if (action.kind === 'show-text') checkReference(findings, textRefIds, action.textRefId, {
      targetKind: 'action', targetId: action.actionId,
      path: `/logicGraph/actions/${index}/textRefId`, referencedKind: 'text-reference',
    });
  });
}

function requireModule(findings, moduleIds, moduleId, reason) {
  if (!moduleIds.has(moduleId)) {
    findings.push(makeFinding({
      ruleId: 'LEVEL_AUTHORING_MODULE_UNSUPPORTED',
      targetKind: 'capability-module',
      targetId: moduleId,
      path: '/capabilityManifest/modules',
      explanation: `${moduleId} is required for ${reason}.`,
      remediation: `Select a capability profile that declares ${moduleId}.`,
    }));
  }
}

function requireVocabulary(findings, supported, value, {
  field,
  targetKind,
  targetId,
  path,
}) {
  if (!supported.includes(value)) {
    findings.push(makeFinding({
      ruleId: 'LEVEL_AUTHORING_VOCABULARY_UNSUPPORTED',
      targetKind,
      targetId,
      path,
      explanation: `${value} is not declared by capability vocabulary ${field}.`,
      remediation: `Use a declared ${field} value or select a compatible capability profile.`,
    }));
  }
}

function validateCapabilities(levelGraph, logicGraph, capabilityManifest, findings) {
  const moduleIds = new Set(capabilityManifest.modules.map(({ id }) => id));
  requireModule(findings, moduleIds, REQUIRED_MODULES.requirements, 'level requirements');
  requireModule(findings, moduleIds, REQUIRED_MODULES.levelGraph, 'the level graph');
  if (levelGraph.actors.length > 0 || levelGraph.routes.length > 0) {
    requireModule(findings, moduleIds, REQUIRED_MODULES.actorRoute, 'actors and routes');
  }
  if (
    logicGraph.variables.length > 0
    || logicGraph.conditions.length > 0
    || logicGraph.triggers.length > 0
    || logicGraph.actions.length > 0
  ) {
    requireModule(findings, moduleIds, REQUIRED_MODULES.typedLogic, 'typed logic');
  }
  if (
    logicGraph.textReferences.length > 0
    || logicGraph.actions.some(({ kind }) => kind === 'show-text')
  ) {
    requireModule(findings, moduleIds, REQUIRED_MODULES.dialogueText, 'visible text references');
  }

  const mappings = [
    [levelGraph.spaces, 'spaceKinds', 'space', 'spaceId', 'levelGraph', 'spaces'],
    [levelGraph.connections, 'connectionKinds', 'connection', 'connectionId', 'levelGraph', 'connections'],
    [levelGraph.placements, 'propRoles', 'placement', 'placementId', 'levelGraph', 'placements'],
    [levelGraph.actors, 'actorKinds', 'actor', 'actorId', 'levelGraph', 'actors'],
    [levelGraph.routes, 'routeKinds', 'route', 'routeId', 'levelGraph', 'routes'],
    [levelGraph.pickups, 'pickupKinds', 'pickup', 'pickupId', 'levelGraph', 'pickups'],
    [logicGraph.conditions, 'conditionKinds', 'condition', 'conditionId', 'logicGraph', 'conditions'],
    [logicGraph.triggers, 'triggerKinds', 'trigger', 'triggerId', 'logicGraph', 'triggers'],
    [logicGraph.actions, 'actionKinds', 'action', 'actionId', 'logicGraph', 'actions'],
  ];
  for (const [entries, field, targetKind, idField, graphName, collection] of mappings) {
    entries.forEach((entry, index) => requireVocabulary(
      findings,
      capabilityManifest.vocabulary[field],
      entry.kind,
      {
        field,
        targetKind,
        targetId: entry[idField],
        path: `/${graphName}/${collection}/${index}/kind`,
      },
    ));
  }
  levelGraph.zones.forEach((zone, index) => requireVocabulary(
    findings,
    capabilityManifest.vocabulary.zoneAnchorKinds,
    zone.anchor.kind,
    {
      field: 'zoneAnchorKinds', targetKind: 'zone', targetId: zone.zoneId,
      path: `/levelGraph/zones/${index}/anchor/kind`,
    },
  ));
  logicGraph.variables.forEach((variable, index) => requireVocabulary(
    findings,
    capabilityManifest.vocabulary.variableTypes,
    variable.type,
    {
      field: 'variableTypes', targetKind: 'variable', targetId: variable.variableId,
      path: `/logicGraph/variables/${index}/type`,
    },
  ));
  const unitIds = new Set(capabilityManifest.coordinateModel.units.map(({ id }) => id));
  levelGraph.placements.forEach((placement, index) => checkReference(
    findings,
    unitIds,
    placement.transform.unitId,
    {
      targetKind: 'placement', targetId: placement.placementId,
      path: `/levelGraph/placements/${index}/transform/unitId`, referencedKind: 'coordinate unit',
    },
  ));
}

export function validateLevelAuthoringKernel(value) {
  const input = exactInput(value);
  const requirementSet = validateLevelRequirementSet(input.requirementSet);
  const levelGraph = validateLevelGraph(input.levelGraph);
  const logicGraph = validateLogicGraph(input.logicGraph);
  const capabilityManifest = validateProjectCapabilityManifest(input.capabilityManifest);
  const fingerprints = {
    requirementSet: levelRequirementSetSha256(requirementSet),
    levelGraph: levelGraphSha256(levelGraph),
    logicGraph: logicGraphSha256(logicGraph),
    capabilityManifest: projectCapabilityManifestSha256(capabilityManifest),
  };
  const findings = [];

  if (levelGraph.projectId !== requirementSet.projectId) {
    findings.push(makeFinding({
      ruleId: 'LEVEL_AUTHORING_PROJECT_MISMATCH',
      targetKind: 'level-graph', targetId: levelGraph.levelGraphId,
      path: '/levelGraph/projectId',
      explanation: 'LevelGraph and LevelRequirementSet project IDs differ.',
      remediation: 'Validate immutable values from the same project.',
    }));
  }
  if (logicGraph.projectId !== levelGraph.projectId) {
    findings.push(makeFinding({
      ruleId: 'LEVEL_AUTHORING_PROJECT_MISMATCH',
      targetKind: 'logic-graph', targetId: logicGraph.logicGraphId,
      path: '/logicGraph/projectId',
      explanation: 'LogicGraph and LevelGraph project IDs differ.',
      remediation: 'Validate immutable values from the same project.',
    }));
  }
  checkPin(findings, {
    actualId: levelGraph.requirementSet.requirementSetId,
    actualVersion: levelGraph.requirementSet.version,
    actualFingerprint: levelGraph.requirementSet.fingerprint,
    expectedId: requirementSet.requirementSetId,
    expectedVersion: requirementSet.version,
    expectedFingerprint: fingerprints.requirementSet,
    targetKind: 'level-graph',
    targetId: levelGraph.levelGraphId,
    path: '/levelGraph/requirementSet',
  });
  checkPin(findings, {
    actualId: logicGraph.levelGraph.levelGraphId,
    actualVersion: logicGraph.levelGraph.version,
    actualFingerprint: logicGraph.levelGraph.fingerprint,
    expectedId: levelGraph.levelGraphId,
    expectedVersion: levelGraph.version,
    expectedFingerprint: fingerprints.levelGraph,
    targetKind: 'logic-graph',
    targetId: logicGraph.logicGraphId,
    path: '/logicGraph/levelGraph',
  });
  validateLogicReferences(levelGraph, logicGraph, findings);
  const coverage = validateTraceability(requirementSet, levelGraph, logicGraph, findings);
  validateCapabilities(levelGraph, logicGraph, capabilityManifest, findings);

  const sorted = sortFindings(findings);
  const receipt = {
    schemaVersion: LEVEL_AUTHORING_VALIDATION_SCHEMA_VERSION,
    kind: LEVEL_AUTHORING_VALIDATION_KIND,
    validatorVersion: LEVEL_AUTHORING_VALIDATOR_VERSION,
    status: sorted.some(({ severity }) => severity === 'ERROR') ? 'BLOCKED' : 'VALID',
    fingerprints,
    coverage,
    findings: sorted,
  };
  return deepFreeze({ ...receipt, fingerprint: fingerprint(receipt) });
}
