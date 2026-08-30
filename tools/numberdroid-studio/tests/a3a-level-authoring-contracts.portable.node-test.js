import assert from 'node:assert/strict';
import test from 'node:test';
import {
  StudioError,
  canonicalLevelGraphJson,
  canonicalLevelRequirementSetJson,
  canonicalLogicGraphJson,
  levelGraphSha256,
  levelRequirementSetSha256,
  logicGraphSha256,
  validateLevelGraph,
  validateLevelRequirementSet,
  validateLogicGraph,
} from '../packages/domain/src/index.js';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

function trace() {
  return { requirementIds: ['req.exit', 'req.key'], assumptionIds: ['assumption.layout'] };
}

function requirementSetFixture() {
  return {
    schemaVersion: 1,
    kind: 'studio.level-requirement-set',
    projectId: 'project.fixture',
    requirementSetId: 'requirements.fixture',
    version: 1,
    requirements: [
      { requirementId: 'req.key', category: 'gameplay', priority: 'REQUIRED', statement: 'A defeated actor drops the access key.' },
      { requirementId: 'req.exit', category: 'feedback', priority: 'PREFERRED', statement: 'The key state change exposes visible text.' },
    ],
    constraints: [{
      constraintId: 'constraint.one-key',
      strength: 'HARD',
      kind: 'cardinality',
      statement: 'Exactly one access key exists.',
      requirementIds: ['req.key'],
    }],
    ambiguities: [{
      ambiguityId: 'ambiguity.copy',
      question: 'Should later copies repeat the text?',
      requirementIds: ['req.exit', 'req.key'],
    }],
    assumptions: [{
      assumptionId: 'assumption.layout',
      statement: 'The encounter and exit share one room.',
      requirementIds: ['req.exit', 'req.key'],
    }],
    acceptanceCriteria: [{
      criterionId: 'criterion.key-chain',
      statement: 'The complete key chain is referentially closed.',
      requirementIds: ['req.exit', 'req.key'],
    }],
  };
}

function levelGraphFixture() {
  return {
    schemaVersion: 1,
    kind: 'studio.level-graph',
    projectId: 'project.fixture',
    levelGraphId: 'level.fixture',
    version: 1,
    requirementSet: { requirementSetId: 'requirements.fixture', version: 1, fingerprint: HASH_A },
    spaces: [{ spaceId: 'space.room', kind: 'room', roomVariant: null, ...trace() }],
    connections: [],
    zones: [],
    paths: [{ pathId: 'path.exit', kind: 'critical', spaceIds: ['space.room'], ...trace() }],
    placements: [{
      placementId: 'placement.console',
      kind: 'hero',
      spaceId: 'space.room',
      asset: { assetId: 'asset.console', assetVersion: 1, metadataVersion: 1, fingerprint: HASH_B },
      transform: { unitId: 'tile', x: 3, y: 4, rotation: 0 },
      ...trace(),
    }],
    actors: [{
      actorId: 'actor.guard',
      kind: 'encounter',
      archetype: { archetypeId: 'archetype.guard', version: 1 },
      spaceId: 'space.room',
      routeId: 'route.guard',
      ...trace(),
    }],
    routes: [{ routeId: 'route.guard', kind: 'patrol', spaceIds: ['space.room'], ...trace() }],
    pickups: [{ pickupId: 'pickup.key', kind: 'access-key', itemId: 'item.key', spaceId: 'space.room', ...trace() }],
    logicBindings: [{
      bindingId: 'binding.guard',
      target: { kind: 'actor', id: 'actor.guard' },
      triggerIds: ['trigger.guard-defeated'],
      ...trace(),
    }],
  };
}

function logicGraphFixture() {
  return {
    schemaVersion: 1,
    kind: 'studio.logic-graph',
    projectId: 'project.fixture',
    logicGraphId: 'logic.fixture',
    version: 1,
    levelGraph: { levelGraphId: 'level.fixture', version: 1, fingerprint: HASH_B },
    variables: [{ variableId: 'state.has-key', type: 'boolean', initialValue: false, ...trace() }],
    textReferences: [{ textRefId: 'text.exit-open', ...trace() }],
    conditions: [{ conditionId: 'condition.has-key', kind: 'equals', variableId: 'state.has-key', value: true, ...trace() }],
    triggers: [{
      triggerId: 'trigger.guard-defeated',
      kind: 'actor-defeated',
      actorId: 'actor.guard',
      conditionIds: ['condition.has-key'],
      actionIds: ['action.drop-key', 'action.show-text'],
      ...trace(),
    }],
    actions: [
      { actionId: 'action.drop-key', kind: 'drop-item', actorId: 'actor.guard', pickupId: 'pickup.key', ...trace() },
      { actionId: 'action.show-text', kind: 'show-text', textRefId: 'text.exit-open', ...trace() },
    ],
  };
}

function assertStudioError(action, code) {
  assert.throws(
    action,
    (error) => error instanceof StudioError && error.code === code,
  );
}

test('A3a authoring values normalize unordered sets, preserve semantic order, and deep-freeze', { timeout: 5_000 }, () => {
  const requirements = validateLevelRequirementSet(requirementSetFixture());
  const levelGraph = validateLevelGraph(levelGraphFixture());
  const logicGraph = validateLogicGraph(logicGraphFixture());

  assert.ok(Object.isFrozen(requirements));
  assert.ok(Object.isFrozen(requirements.requirements));
  assert.ok(Object.isFrozen(levelGraph.placements[0].transform));
  assert.ok(Object.isFrozen(logicGraph.triggers[0].actionIds));
  assert.ok(canonicalLevelRequirementSetJson(requirements).endsWith('\n'));
  assert.ok(canonicalLevelGraphJson(levelGraph).endsWith('\n'));
  assert.ok(canonicalLogicGraphJson(logicGraph).endsWith('\n'));

  const reorderedRequirements = requirementSetFixture();
  reorderedRequirements.requirements.reverse();
  reorderedRequirements.ambiguities[0].requirementIds.reverse();
  reorderedRequirements.assumptions[0].requirementIds.reverse();
  assert.equal(
    levelRequirementSetSha256(reorderedRequirements),
    levelRequirementSetSha256(requirementSetFixture()),
  );

  const reorderedLevel = levelGraphFixture();
  reorderedLevel.spaces[0].requirementIds.reverse();
  assert.equal(levelGraphSha256(reorderedLevel), levelGraphSha256(levelGraphFixture()));

  const reversedActions = logicGraphFixture();
  reversedActions.triggers[0].actionIds.reverse();
  assert.notEqual(logicGraphSha256(reversedActions), logicGraphSha256(logicGraphFixture()));
});

test('A3a contracts reject unknown fields, versions, kinds, duplicates, sparse arrays, and invalid typed values', { timeout: 5_000 }, () => {
  const version = requirementSetFixture();
  version.schemaVersion = 2;
  assertStudioError(() => validateLevelRequirementSet(version), 'LEVEL_AUTHORING_CONTRACT_SCHEMA_UNSUPPORTED');

  for (const forbiddenField of ['authority', 'code', 'ui', 'path']) {
    const requirements = requirementSetFixture();
    requirements[forbiddenField] = 'forbidden';
    assertStudioError(() => validateLevelRequirementSet(requirements), 'LEVEL_AUTHORING_CONTRACT_FIELD_FORBIDDEN');
  }

  const duplicate = requirementSetFixture();
  duplicate.requirements.push(structuredClone(duplicate.requirements[0]));
  assertStudioError(() => validateLevelRequirementSet(duplicate), 'LEVEL_AUTHORING_CONTRACT_DUPLICATE');

  const sparse = levelGraphFixture();
  sparse.actors = new Array(1);
  assertStudioError(() => validateLevelGraph(sparse), 'LEVEL_AUTHORING_CONTRACT_INVALID');

  let accessorEvaluated = false;
  const accessor = levelGraphFixture();
  accessor.actors = [];
  Object.defineProperty(accessor.actors, 0, {
    enumerable: true,
    get() {
      accessorEvaluated = true;
      return levelGraphFixture().actors[0];
    },
  });
  assertStudioError(() => validateLevelGraph(accessor), 'LEVEL_AUTHORING_CONTRACT_INVALID');
  assert.equal(accessorEvaluated, false);

  const accessorRecord = requirementSetFixture();
  const originalStatement = accessorRecord.requirements[0].statement;
  Object.defineProperty(accessorRecord.requirements[0], 'statement', {
    enumerable: true,
    get() {
      accessorEvaluated = true;
      return originalStatement;
    },
  });
  assertStudioError(() => validateLevelRequirementSet(accessorRecord), 'LEVEL_AUTHORING_CONTRACT_FIELD_FORBIDDEN');
  assert.equal(accessorEvaluated, false);

  const unknownKind = logicGraphFixture();
  unknownKind.actions[0].kind = 'execute-code';
  assertStudioError(() => validateLogicGraph(unknownKind), 'LEVEL_AUTHORING_CONTRACT_INVALID');

  const invalidTypedValue = logicGraphFixture();
  invalidTypedValue.variables[0].initialValue = 'false';
  assertStudioError(() => validateLogicGraph(invalidTypedValue), 'LEVEL_AUTHORING_CONTRACT_INVALID');
});
