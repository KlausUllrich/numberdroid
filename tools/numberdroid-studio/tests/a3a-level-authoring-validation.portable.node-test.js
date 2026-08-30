import assert from 'node:assert/strict';
import test from 'node:test';
import {
  StudioError,
  levelGraphSha256,
  levelRequirementSetSha256,
  projectCapabilityManifestSha256,
  validateProjectCapabilityManifest,
} from '../packages/domain/src/index.js';
import {
  validateLevelAuthoringKernel,
} from '../packages/application/src/index.js';
import {
  NUMBERDROID_A4B_PROJECT_CAPABILITY_FINGERPRINT,
  NUMBERDROID_A4B_PROJECT_CAPABILITY_MANIFEST,
  NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT,
  NUMBERDROID_PROJECT_CAPABILITY_FINGERPRINT,
  NUMBERDROID_PROJECT_CAPABILITY_MANIFEST,
} from '../packages/numberdroid-adapter/src/index.js';

const REQUIRED_MODULES = [
  'studio.level-requirements',
  'studio.level-graph',
  'studio.actor-route',
  'studio.typed-logic',
  'studio.dialogue-text',
];
const TRACE = Object.freeze({ requirementIds: ['req.key-chain'], assumptionIds: [] });

function trace() {
  return structuredClone(TRACE);
}

function createSyntheticCapabilityManifest() {
  const manifest = structuredClone(NUMBERDROID_PROJECT_CAPABILITY_MANIFEST);
  manifest.profileId = 'synthetic.level-authoring';
  manifest.profileVersion += 1;
  for (const id of REQUIRED_MODULES) manifest.modules.push({ id, version: 'v1' });
  manifest.vocabulary.triggerKinds.push('actor-defeated');
  manifest.vocabulary.actionKinds.push('drop-item', 'set-variable', 'show-text');
  manifest.vocabulary.variableTypes.push('boolean');
  return validateProjectCapabilityManifest(manifest);
}

function createAuthoringFixture({ dangling = false, uncovered = false, incoherentActor = false } = {}) {
  const requirementSet = {
    schemaVersion: 1,
    kind: 'studio.level-requirement-set',
    projectId: 'project.fixture',
    requirementSetId: 'requirements.key-chain',
    version: 1,
    requirements: [{
      requirementId: 'req.key-chain',
      category: 'gameplay',
      priority: 'REQUIRED',
      statement: 'Defeating the guard exposes a key whose collection changes state and exposes text.',
    }],
    constraints: [],
    ambiguities: [],
    assumptions: [],
    acceptanceCriteria: [{
      criterionId: 'criterion.key-chain',
      statement: 'Every link in the key interaction chain resolves.',
      requirementIds: ['req.key-chain'],
    }],
  };
  if (uncovered) {
    requirementSet.requirements.push({
      requirementId: 'req.uncovered',
      category: 'navigation',
      priority: 'REQUIRED',
      statement: 'A required navigation outcome is represented.',
    });
  }

  const levelGraph = {
    schemaVersion: 1,
    kind: 'studio.level-graph',
    projectId: 'project.fixture',
    levelGraphId: 'level.key-chain',
    version: 1,
    requirementSet: {
      requirementSetId: requirementSet.requirementSetId,
      version: requirementSet.version,
      fingerprint: levelRequirementSetSha256(requirementSet),
    },
    spaces: [{ spaceId: 'space.encounter', kind: 'room', roomVariant: null, ...trace() }],
    connections: dangling ? [{
      connectionId: 'connection.self-loop',
      kind: 'standard-door',
      fromSpaceId: 'space.encounter',
      toSpaceId: 'space.encounter',
      ...trace(),
    }] : [],
    zones: [],
    paths: [],
    placements: [],
    actors: [{
      actorId: 'actor.guard',
      kind: 'encounter',
      archetype: { archetypeId: 'archetype.guard', version: 1 },
      spaceId: 'space.encounter',
      routeId: dangling ? 'route.missing' : 'route.guard',
      ...trace(),
    }, ...(incoherentActor ? [{
      actorId: 'actor.other',
      kind: 'encounter',
      archetype: { archetypeId: 'archetype.other', version: 1 },
      spaceId: 'space.encounter',
      routeId: null,
      ...trace(),
    }] : [])],
    routes: [{ routeId: 'route.guard', kind: 'patrol', spaceIds: ['space.encounter'], ...trace() }],
    pickups: [{
      pickupId: 'pickup.access-key',
      kind: 'access-key',
      itemId: 'item.access-key',
      spaceId: 'space.encounter',
      ...trace(),
    }],
    logicBindings: [
      {
        bindingId: 'binding.guard-defeated',
        target: { kind: 'actor', id: 'actor.guard' },
        triggerIds: ['trigger.guard-defeated'],
        ...trace(),
      },
      {
        bindingId: 'binding.key-collected',
        target: { kind: 'pickup', id: 'pickup.access-key' },
        triggerIds: ['trigger.key-collected'],
        ...trace(),
      },
      {
        bindingId: 'binding.key-state',
        target: { kind: 'space', id: 'space.encounter' },
        triggerIds: ['trigger.key-state'],
        ...trace(),
      },
    ],
  };

  const logicGraph = {
    schemaVersion: 1,
    kind: 'studio.logic-graph',
    projectId: 'project.fixture',
    logicGraphId: 'logic.key-chain',
    version: 1,
    levelGraph: {
      levelGraphId: levelGraph.levelGraphId,
      version: levelGraph.version,
      fingerprint: levelGraphSha256(levelGraph),
    },
    variables: [{ variableId: 'state.has-key', type: 'boolean', initialValue: false, ...trace() }],
    textReferences: [{ textRefId: 'text.key-collected', ...trace() }],
    conditions: [],
    triggers: [
      {
        triggerId: 'trigger.guard-defeated',
        kind: 'actor-defeated',
        actorId: incoherentActor ? 'actor.other' : 'actor.guard',
        conditionIds: [],
        actionIds: ['action.drop-key'],
        ...trace(),
      },
      {
        triggerId: 'trigger.key-collected',
        kind: 'collect',
        pickupId: 'pickup.access-key',
        conditionIds: [],
        actionIds: ['action.set-key-state'],
        ...trace(),
      },
      {
        triggerId: 'trigger.key-state',
        kind: 'state-change',
        variableId: 'state.has-key',
        conditionIds: [],
        actionIds: ['action.show-text'],
        ...trace(),
      },
    ],
    actions: [
      {
        actionId: 'action.drop-key',
        kind: 'drop-item',
        actorId: 'actor.guard',
        pickupId: 'pickup.access-key',
        ...trace(),
      },
      {
        actionId: 'action.set-key-state',
        kind: 'set-variable',
        variableId: dangling ? 'state.missing' : 'state.has-key',
        value: true,
        ...trace(),
      },
      {
        actionId: 'action.show-text',
        kind: 'show-text',
        textRefId: 'text.key-collected',
        ...trace(),
      },
    ],
  };
  return { requirementSet, levelGraph, logicGraph };
}

test('the synthetic A3a profile validates the closed actor-to-text reference chain', { timeout: 5_000 }, () => {
  const fixture = createAuthoringFixture();
  const result = validateLevelAuthoringKernel({
    ...fixture,
    capabilityManifest: createSyntheticCapabilityManifest(),
  });

  assert.equal(result.status, 'VALID');
  assert.deepEqual(result.findings, []);
  assert.deepEqual(result.coverage, {
    totalRequirements: 1,
    tracedRequirementIds: ['req.key-chain'],
    unmetRequiredRequirementIds: [],
    untracedObjectRefs: [],
  });
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.findings));
  assert.ok(Object.isFrozen(result.coverage.tracedRequirementIds));
});

test('the additive A4b profile validates the closed reference chain while v1/v2 pins remain exact', { timeout: 5_000 }, () => {
  assert.equal(NUMBERDROID_PROJECT_CAPABILITY_FINGERPRINT, '826a8b7942ccba97393f55efa356525529994ad34189446992a7dff58fe97049');
  assert.equal(NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT, '5488df72b2e45c738735d90046cd3c4a7a560a99922936cfeb5a3e84c63fc106');
  assert.equal(NUMBERDROID_A4B_PROJECT_CAPABILITY_FINGERPRINT, '6079209041cb71a3e7c8b36ea41796c2e38ea6ef828bf78829e8f0dc4ea3f074');
  assert.equal(NUMBERDROID_A4B_PROJECT_CAPABILITY_MANIFEST.profileVersion, 3);
  assert.equal(
    projectCapabilityManifestSha256(NUMBERDROID_A4B_PROJECT_CAPABILITY_MANIFEST),
    NUMBERDROID_A4B_PROJECT_CAPABILITY_FINGERPRINT,
  );
  const result = validateLevelAuthoringKernel({
    ...createAuthoringFixture(),
    capabilityManifest: NUMBERDROID_A4B_PROJECT_CAPABILITY_MANIFEST,
  });
  assert.equal(result.status, 'VALID');
  assert.deepEqual(result.findings, []);
  assert.deepEqual(NUMBERDROID_A4B_PROJECT_CAPABILITY_MANIFEST.vocabulary.conditionKinds, []);
  assert.ok(NUMBERDROID_A4B_PROJECT_CAPABILITY_MANIFEST.extensions['numberdroid.studio'].unsupportedFeatures.includes('typed-conditions'));
});

test('the bounded A4b profile rejects staged Actors as defeat/drop authority', { timeout: 5_000 }, () => {
  const fixture = createAuthoringFixture();
  fixture.levelGraph.actors[0].kind = 'staged';
  fixture.logicGraph.levelGraph.fingerprint = levelGraphSha256(fixture.levelGraph);
  const result = validateLevelAuthoringKernel({
    ...fixture,
    capabilityManifest: NUMBERDROID_A4B_PROJECT_CAPABILITY_MANIFEST,
  });
  assert.equal(result.status, 'BLOCKED');
  assert.ok(result.findings.some(({ ruleId, targetId }) =>
    ruleId === 'LEVEL_AUTHORING_VOCABULARY_UNSUPPORTED' && targetId === 'actor.guard'));
});

test('each advertised A4b module and vocabulary member is required independently', { timeout: 5_000 }, () => {
  const fixture = createAuthoringFixture();
  for (const moduleId of REQUIRED_MODULES) {
    const manifest = structuredClone(NUMBERDROID_A4B_PROJECT_CAPABILITY_MANIFEST);
    manifest.modules = manifest.modules.filter(({ id }) => id !== moduleId);
    const result = validateLevelAuthoringKernel({
      ...fixture,
      capabilityManifest: validateProjectCapabilityManifest(manifest),
    });
    assert.equal(result.status, 'BLOCKED', moduleId);
    assert.ok(result.findings.some(({ ruleId, targetId }) =>
      ruleId === 'LEVEL_AUTHORING_MODULE_UNSUPPORTED' && targetId === moduleId), moduleId);
  }

  const vocabularyCases = [
    ['triggerKinds', 'actor-defeated', 'trigger.guard-defeated'],
    ['actionKinds', 'drop-item', 'action.drop-key'],
    ['actionKinds', 'set-variable', 'action.set-key-state'],
    ['actionKinds', 'show-text', 'action.show-text'],
    ['variableTypes', 'boolean', 'state.has-key'],
  ];
  for (const [group, token, targetId] of vocabularyCases) {
    const manifest = structuredClone(NUMBERDROID_A4B_PROJECT_CAPABILITY_MANIFEST);
    manifest.vocabulary[group] = manifest.vocabulary[group].filter((entry) => entry !== token);
    const result = validateLevelAuthoringKernel({
      ...fixture,
      capabilityManifest: validateProjectCapabilityManifest(manifest),
    });
    assert.equal(result.status, 'BLOCKED', `${group}:${token}`);
    assert.ok(result.findings.some(({ ruleId, targetId: findingTargetId }) =>
      ruleId === 'LEVEL_AUTHORING_VOCABULARY_UNSUPPORTED' && findingTargetId === targetId), `${group}:${token}`);
  }
});

test('the unchanged Numberdroid capability profile blocks unsupported A3a behavior without mutation', { timeout: 5_000 }, () => {
  const fixture = createAuthoringFixture();
  const before = structuredClone(NUMBERDROID_PROJECT_CAPABILITY_MANIFEST);
  const result = validateLevelAuthoringKernel({
    ...fixture,
    capabilityManifest: NUMBERDROID_PROJECT_CAPABILITY_MANIFEST,
  });

  assert.equal(result.status, 'BLOCKED');
  assert.equal(
    result.fingerprints.capabilityManifest,
    '826a8b7942ccba97393f55efa356525529994ad34189446992a7dff58fe97049',
  );
  assert.equal(result.fingerprints.capabilityManifest, NUMBERDROID_PROJECT_CAPABILITY_FINGERPRINT);
  assert.deepEqual(NUMBERDROID_PROJECT_CAPABILITY_MANIFEST, before);

  const unsupportedModules = result.findings
    .filter(({ ruleId }) => ruleId === 'LEVEL_AUTHORING_MODULE_UNSUPPORTED')
    .map(({ targetId }) => targetId)
    .sort();
  assert.deepEqual(unsupportedModules, [...REQUIRED_MODULES].sort());
  const unsupportedVocabularyTargets = new Set(result.findings
    .filter(({ ruleId }) => ruleId === 'LEVEL_AUTHORING_VOCABULARY_UNSUPPORTED')
    .map(({ targetId }) => targetId));
  for (const targetId of [
    'state.has-key',
    'trigger.guard-defeated',
    'action.drop-key',
    'action.set-key-state',
    'action.show-text',
  ]) assert.ok(unsupportedVocabularyTargets.has(targetId));
});

test('dangling references and uncovered requirements yield stable sorted blocking findings', { timeout: 5_000 }, () => {
  const fixture = createAuthoringFixture({ dangling: true, uncovered: true, incoherentActor: true });
  const input = { ...fixture, capabilityManifest: createSyntheticCapabilityManifest() };
  const first = validateLevelAuthoringKernel(input);
  const second = validateLevelAuthoringKernel(structuredClone(input));

  assert.equal(first.status, 'BLOCKED');
  assert.deepEqual(first, second);
  assert.equal(first.fingerprint, second.fingerprint);
  assert.deepEqual(first.coverage.unmetRequiredRequirementIds, ['req.uncovered']);
  assert.ok(first.findings.some(({ ruleId, path }) => (
    ruleId === 'LEVEL_AUTHORING_REFERENCE_UNKNOWN' && path.endsWith('/routeId')
  )));
  assert.ok(first.findings.some(({ ruleId, path }) => (
    ruleId === 'LEVEL_AUTHORING_REFERENCE_UNKNOWN' && path.endsWith('/variableId')
  )));
  assert.ok(first.findings.some(({ ruleId, targetId }) => (
    ruleId === 'LEVEL_AUTHORING_CONNECTION_SELF_LOOP' && targetId === 'connection.self-loop'
  )));
  assert.ok(first.findings.some(({ ruleId }) => ruleId === 'LEVEL_AUTHORING_BINDING_TRIGGER_MISMATCH'));
  assert.ok(first.findings.some(({ ruleId }) => ruleId === 'LEVEL_AUTHORING_TRIGGER_ACTION_MISMATCH'));
  const order = { ERROR: 0, WARNING: 1, INFO: 2 };
  const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
  const sortedFindingIds = [...first.findings]
    .sort((left, right) => order[left.severity] - order[right.severity]
      || compareText(left.ruleId, right.ruleId)
      || compareText(left.targetKind, right.targetKind)
      || compareText(left.targetId, right.targetId)
      || compareText(left.path, right.path))
    .map(({ findingId }) => findingId);
  assert.deepEqual(first.findings.map(({ findingId }) => findingId), sortedFindingIds);
  assert.deepEqual(Object.keys(first).sort(), [
    'coverage', 'findings', 'fingerprint', 'fingerprints', 'kind', 'schemaVersion', 'status', 'validatorVersion',
  ]);

  let accessorEvaluated = false;
  const accessorLogicGraph = structuredClone(fixture.logicGraph);
  const originalActions = accessorLogicGraph.actions;
  Object.defineProperty(accessorLogicGraph, 'actions', {
    enumerable: true,
    get() {
      accessorEvaluated = true;
      return originalActions;
    },
  });
  const accessorInput = {
    requirementSet: fixture.requirementSet,
    levelGraph: fixture.levelGraph,
    logicGraph: accessorLogicGraph,
    capabilityManifest: input.capabilityManifest,
  };
  assert.throws(
    () => validateLevelAuthoringKernel(accessorInput),
    (error) => error instanceof StudioError && error.code === 'LEVEL_AUTHORING_VALIDATION_INPUT_INVALID',
  );
  assert.equal(accessorEvaluated, false);

  const missingFieldInput = { ...input };
  delete missingFieldInput.logicGraph;
  assert.throws(
    () => validateLevelAuthoringKernel(missingFieldInput),
    (error) => error instanceof StudioError && error.code === 'LEVEL_AUTHORING_VALIDATION_INPUT_INVALID',
  );

  const tooDeepInput = structuredClone(input);
  let cursor = tooDeepInput.capabilityManifest;
  for (let depth = 0; depth < 65; depth += 1) {
    cursor.nested = {};
    cursor = cursor.nested;
  }
  assert.throws(
    () => validateLevelAuthoringKernel(tooDeepInput),
    (error) => error instanceof StudioError && error.code === 'LEVEL_AUTHORING_VALIDATION_INPUT_INVALID',
  );
});
