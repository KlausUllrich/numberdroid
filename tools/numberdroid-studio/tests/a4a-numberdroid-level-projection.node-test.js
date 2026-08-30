import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  NUMBERDROID_LEVEL_AUTHORING_PROJECTION_KIND,
  NUMBERDROID_PROJECT_CAPABILITY_FINGERPRINT,
  canonicalNumberdroidLevelAuthoringProjectionJson,
  createNumberdroidLevelAuthoringProjection,
  numberdroidLevelAuthoringProjectionSha256,
  validateNumberdroidLevelAuthoringProjection,
  validateNumberdroidLevelSpec,
} from '../packages/numberdroid-adapter/src/index.js';

const COMPILER_VERSION = `numberdroid-level-compiler.sha256:${'a'.repeat(64)}`;

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

function derivedSeed(seed, path) {
  return fnv1a32(`${normalizeSeed(seed)}:${path}`);
}

function canonicalJson(value) {
  const sorted = (candidate) => Array.isArray(candidate)
    ? candidate.map(sorted)
    : candidate && typeof candidate === 'object'
      ? Object.fromEntries(Object.keys(candidate).sort().map((key) => [key, sorted(candidate[key])]))
      : candidate;
  return `${JSON.stringify(sorted(value), null, 2)}\n`;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function resignProjection(projection) {
  const core = structuredClone(projection);
  delete core.fingerprint;
  projection.fingerprint = sha256(canonicalJson(core));
}

function resignCompilerClosure(projection) {
  projection.compiler.canonicalJson = canonicalJson(projection.compiler.semanticPlan);
  projection.compiler.sha256 = sha256(projection.compiler.canonicalJson);
  resignProjection(projection);
}

function levelSpec() {
  return {
    id: 'a4a.fixture',
    version: 3,
    seed: 'A4A-FIXTURE',
    ruleSetRefs: ['numberdroid/base'],
    rules: {
      ensureReachability: true,
      singleSharedWall: true,
      doorsEmbeddedInWalls: true,
      defaultCorridorWidth: { min: 1, preferred: 2, max: 3 },
      defaultDoorClearance: { before: 1, after: 1 },
    },
    runtime: {
      tileSize: 64,
      wallCollisionPx: 10,
      floorName: 'A4A Fixture',
      start: { spaceId: 'room.one', bodyId: 'pico', facing: 90, metaEnergy: 0 },
    },
    spaces: [
      { id: 'room.one', kind: 'room', archetype: 'plain-room', tags: ['fixture'], size: { class: 'small', width: { min: 3, preferred: 4, max: 5 } } },
      { id: 'hall.one', kind: 'corridor', width: { min: 1, preferred: 2, max: 3 }, orientation: 'horizontal' },
    ],
    connections: [{ id: 'door.one', from: 'room.one', to: 'hall.one', kind: 'standard-door', widthTiles: 1 }],
    props: [{ id: 'prop.console', propId: 'console', spaceId: 'room.one', role: 'hero', required: true }],
    encounters: [{
      id: 'actor.guard', spaceId: 'room.one', enemyId: 'sentry', bodyId: 'sentry', behavior: 'guard',
      mode: 'add-easy', mathLabel: '+ 6', mathRole: 'comfort', difficulty: 'easy',
    }],
    stagedActors: [{ id: 'actor.staged', actorType: 'maintenance-unit', initiallyPresent: false, defaultSpaceId: 'hall.one' }],
    routes: [{ id: 'route.guard', kind: 'patrol', spaceIds: ['room.one'], loop: true }],
    pickups: [{ id: 'pickup.key', kind: 'access-key', keyId: 'key.one', spaceId: 'room.one', label: 'KEY' }],
    zones: [{ id: 'zone.door', spaceId: 'room.one', anchor: { kind: 'connection', targetId: 'door.one' }, sizeTiles: { w: 2, h: 2 } }],
    triggers: [{ id: 'trigger.key', kind: 'collect', sourceId: 'pickup.key', eventIds: ['event.flag'], once: true }],
    events: [{ id: 'event.flag', kind: 'set-flag', flag: 'state.has-key', value: true }],
    overrides: [],
  };
}

function semanticPlan(spec) {
  return {
    levelId: spec.id,
    version: spec.version,
    seed: normalizeSeed(spec.seed),
    ruleSetRefs: [...spec.ruleSetRefs],
    rules: spec.rules,
    ...(spec.runtime ? { runtime: spec.runtime } : {}),
    spaces: spec.spaces.map((entry) => ({ ...entry, seed: derivedSeed(spec.seed, `space/${entry.id}`) })),
    connections: spec.connections.map((entry) => ({
      ...entry,
      seed: derivedSeed(spec.seed, `connection/${entry.id}`),
      widthTiles: entry.widthTiles ?? (entry.kind === 'standard-door' ? 1 : 2),
      clearanceTiles: entry.kind === 'opening' ? { before: 0, after: 0 } : entry.clearanceTiles ?? spec.rules.defaultDoorClearance,
      lock: entry.lock ?? { mode: 'none' },
    })),
    props: spec.props.map((entry) => ({
      ...entry,
      seed: derivedSeed(spec.seed, `prop/${entry.id}`),
      quantity: entry.quantity ?? 1,
      required: entry.required ?? true,
      metadata: {
        id: entry.propId,
        tags: [],
        attachment: 'floor',
        allowedRotations: [0],
        footprintTiles: { w: 1, h: 1 },
        placement: {},
      },
    })),
    encounters: spec.encounters.map((entry) => {
      const robotType = (spec.overrides ?? []).find((override) => override.targetId === entry.id)?.robotType;
      return {
        ...entry,
        ...(robotType ? { enemyId: robotType, bodyId: robotType } : {}),
        seed: derivedSeed(spec.seed, `encounter/${entry.id}`),
      };
    }),
    stagedActors: [...(spec.stagedActors ?? [])],
    routes: [...(spec.routes ?? [])],
    pickups: [...(spec.pickups ?? [])],
    zones: [...(spec.zones ?? [])],
    triggers: [...(spec.triggers ?? [])],
    events: [...(spec.events ?? [])],
    overrides: [...(spec.overrides ?? [])],
    diagnostics: [],
  };
}

function compiler(overrides = {}) {
  return {
    compilerVersion: COMPILER_VERSION,
    validatePlacementOverrides() {},
    compileLevelSpec: semanticPlan,
    ...overrides,
  };
}

function create(spec = levelSpec(), port = compiler()) {
  return createNumberdroidLevelAuthoringProjection({ levelSpec: spec, compiler: port });
}

function assertProjectionError(action, code) {
  assert.throws(action, (error) => error?.code === code);
}

test('A4a retains the complete Numberdroid closure and advertises no production capability', { timeout: 5_000 }, () => {
  const input = levelSpec();
  const projection = create(input);
  assert.equal(projection.kind, NUMBERDROID_LEVEL_AUTHORING_PROJECTION_KIND);
  assert.equal(projection.status, 'LOSSLESS_WITH_GAPS');
  assert.equal(projection.capabilityDelta.status, 'NOT_ADVERTISED');
  assert.equal(canonicalJson(projection.capabilityDelta), canonicalJson({
    status: 'NOT_ADVERTISED',
    baseline: {
      profileId: 'numberdroid.studio',
      profileVersion: 1,
      fingerprint: '826a8b7942ccba97393f55efa356525529994ad34189446992a7dff58fe97049',
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
  }));
  assert.equal(projection.capabilityDelta.baseline.fingerprint, NUMBERDROID_PROJECT_CAPABILITY_FINGERPRINT);
  assert.equal(NUMBERDROID_PROJECT_CAPABILITY_FINGERPRINT, '826a8b7942ccba97393f55efa356525529994ad34189446992a7dff58fe97049');
  assert.deepEqual(JSON.parse(projection.source.canonicalJson), input);
  assert.equal(projection.compiler.semanticPlan.levelId, input.id);
  assert.equal(canonicalJson(projection.compiler.semanticPlan.runtime), canonicalJson(input.runtime));
  assert.equal(projection.compiler.formatId, 'numberdroid.compiled-level-spec');
  assert.equal(projection.a3a.levelGraph.spaces.length, 2);
  assert.equal(projection.a3a.levelGraph.connections.length, 1);
  assert.equal(projection.a3a.levelGraph.placements.length, 0);
  assert.equal(projection.a3a.levelGraph.actors.length, 0);
  assert.equal(projection.a3a.logicGraph.actions.length, 0);
  const gapIds = new Set(projection.gaps.map(({ gapId }) => gapId));
  for (const gapId of [
    'numberdroid.requirement-trace.not-authored',
    'numberdroid.props.asset-transform-pins-missing',
    'numberdroid.encounters.archetype-version-missing',
    'numberdroid.staged-actors.archetype-version-missing',
    'numberdroid.logic.a3a-vocabulary-mismatch',
    'numberdroid.flags.declaration-type-initial-value-missing',
  ]) assert.ok(gapIds.has(gapId), gapId);
  assert.ok(projection.coverage.counts.a3a > 0);
  assert.ok(projection.coverage.counts.numberdroidClosure > 0);
  assert.ok(projection.coverage.counts.blocked > 0);
  assert.equal(projection.coverage.entries.length, projection.coverage.counts.total);
  assert.ok(projection.coverage.entries.every((entry) => entry.disposition !== 'BLOCKED' || entry.gapId));
  assert.ok(Object.isFrozen(projection));
  assert.ok(Object.isFrozen(projection.source.levelSpec.spaces[0]));
});

test('A4a hashes are deterministic, validate after serialization, and ignore later input mutation', { timeout: 5_000 }, () => {
  const input = levelSpec();
  const first = create(input);
  const second = create(structuredClone(input));
  assert.equal(first.fingerprint, second.fingerprint);
  assert.equal(numberdroidLevelAuthoringProjectionSha256(first, compiler()), first.fingerprint);
  assert.equal(canonicalNumberdroidLevelAuthoringProjectionJson(first, compiler()), canonicalNumberdroidLevelAuthoringProjectionJson(second, compiler()));
  const serialized = JSON.parse(canonicalNumberdroidLevelAuthoringProjectionJson(first, compiler()));
  assert.deepEqual(validateNumberdroidLevelAuthoringProjection(serialized, compiler()), first);
  input.spaces[0].archetype = 'mutated';
  assert.equal(first.source.levelSpec.spaces[0].archetype, 'plain-room');
});

test('A4a rejects getters, proxies, cycles, sparse arrays, custom prototypes, symbols, and prototype event names', { timeout: 5_000 }, () => {
  let getterCalls = 0;
  const accessor = levelSpec();
  Object.defineProperty(accessor, 'id', { enumerable: true, get() { getterCalls += 1; return 'bad'; } });
  assertProjectionError(() => create(accessor), 'NUMBERDROID_LEVEL_PROJECTION_FIELD_FORBIDDEN');
  assert.equal(getterCalls, 0);
  assertProjectionError(() => create(new Proxy(levelSpec(), {})), 'NUMBERDROID_LEVEL_PROJECTION_INPUT_INVALID');
  const cycle = levelSpec();
  cycle.loop = cycle;
  assertProjectionError(() => create(cycle), 'NUMBERDROID_LEVEL_PROJECTION_INPUT_INVALID');
  const shared = levelSpec();
  shared.spaces[1].width = shared.rules.defaultCorridorWidth;
  const sharedProjection = create(shared);
  assert.deepEqual(sharedProjection.source.levelSpec.spaces[1].width, sharedProjection.source.levelSpec.rules.defaultCorridorWidth);
  assert.notEqual(sharedProjection.source.levelSpec.spaces[1].width, sharedProjection.source.levelSpec.rules.defaultCorridorWidth);
  const sparse = levelSpec();
  sparse.spaces = new Array(1);
  assertProjectionError(() => create(sparse), 'NUMBERDROID_LEVEL_PROJECTION_INPUT_INVALID');
  const custom = levelSpec();
  Object.setPrototypeOf(custom.spaces[0], { inherited: true });
  assertProjectionError(() => create(custom), 'NUMBERDROID_LEVEL_PROJECTION_INPUT_INVALID');
  const symbol = levelSpec();
  symbol[Symbol('authority')] = true;
  assertProjectionError(() => create(symbol), 'NUMBERDROID_LEVEL_PROJECTION_FIELD_FORBIDDEN');
  for (const kind of ['__proto__', 'constructor', 'toString']) {
    const invalid = levelSpec();
    invalid.events[0].kind = kind;
    assertProjectionError(() => create(invalid), 'NUMBERDROID_LEVEL_PROJECTION_INPUT_INVALID');
  }
});

test('A4a canonicalization does not execute global toJSON hooks', { timeout: 5_000 }, () => {
  let calls = 0;
  Object.defineProperty(Object.prototype, 'toJSON', { configurable: true, value() { calls += 1; throw new Error('must not run'); } });
  Object.defineProperty(Array.prototype, 'toJSON', { configurable: true, value() { calls += 1; throw new Error('must not run'); } });
  try {
    const projection = create();
    assert.ok(canonicalNumberdroidLevelAuthoringProjectionJson(projection, compiler()).endsWith('\n'));
    assert.equal(calls, 0);
  } finally {
    delete Object.prototype.toJSON;
    delete Array.prototype.toJSON;
  }
});

test('A4a public canonicalization rejects hostile serialized envelopes without invoking accessors', { timeout: 5_000 }, () => {
  const projection = structuredClone(create());
  let getterCalls = 0;
  Object.defineProperty(projection.source, 'canonicalJson', {
    enumerable: true,
    get() { getterCalls += 1; return 'forged'; },
  });
  assertProjectionError(
    () => canonicalNumberdroidLevelAuthoringProjectionJson(projection, compiler()),
    'NUMBERDROID_LEVEL_PROJECTION_FIELD_FORBIDDEN',
  );
  assert.equal(getterCalls, 0);
  assertProjectionError(
    () => canonicalNumberdroidLevelAuthoringProjectionJson(new Proxy(structuredClone(create()), {}), compiler()),
    'NUMBERDROID_LEVEL_PROJECTION_INPUT_INVALID',
  );
});

test('A4a captures an exact compiler port and rejects mutation, nondeterminism, and raw compiler errors', { timeout: 5_000 }, () => {
  assertProjectionError(() => create(levelSpec(), { ...compiler(), extra: true }), 'NUMBERDROID_LEVEL_PROJECTION_COMPILER_INVALID');
  assertProjectionError(() => create(levelSpec(), compiler({ compilerVersion: 'dev' })), 'NUMBERDROID_LEVEL_PROJECTION_COMPILER_INVALID');
  let call = 0;
  assertProjectionError(() => create(levelSpec(), compiler({
    compileLevelSpec(spec) {
      const plan = semanticPlan(spec);
      plan.diagnostics.push({ level: 'info', code: 'ALTERNATING', message: String(call += 1) });
      return plan;
    },
  })), 'NUMBERDROID_LEVEL_PROJECTION_COMPILER_NONDETERMINISTIC');
  assertProjectionError(() => create(levelSpec(), compiler({
    validatePlacementOverrides(spec) { spec.id = 'mutated'; },
  })), 'NUMBERDROID_LEVEL_PROJECTION_OVERRIDE_VALIDATION_FAILED');
  assert.throws(
    () => create(levelSpec(), compiler({ compileLevelSpec() { throw new Error('/private/secret/token'); } })),
    (error) => error.code === 'NUMBERDROID_LEVEL_PROJECTION_COMPILE_FAILED'
      && !error.message.includes('private') && !error.message.includes('secret'),
  );
});

test('A4a preserves bounded deterministic compiler diagnostics for valid non-A3a identifiers', { timeout: 5_000 }, () => {
  const spec = levelSpec();
  spec.connections[0].id = 'door\none';
  spec.zones[0].anchor.targetId = 'door\none';
  const port = compiler({
    compileLevelSpec(input) {
      const plan = semanticPlan(input);
      plan.diagnostics.push({
        level: 'warning',
        code: 'KEY_SOURCE_NOT_YET_AUTHORED',
        targetId: 'door\none',
        message: 'Locked door door\none uses a key without a source.',
      });
      return plan;
    },
  });
  const projection = create(spec, port);
  assert.equal(projection.compiler.semanticPlan.diagnostics[0].message, 'Locked door door\none uses a key without a source.');
  assert.ok(projection.gaps.some(({ gapId }) => gapId === 'numberdroid.identifiers.a3a-vocabulary-mismatch'));

  const longSpec = levelSpec();
  const longId = 'd'.repeat(4_096);
  const longKey = 'k'.repeat(4_096);
  longSpec.connections[0].id = longId;
  longSpec.connections[0].lock = { mode: 'access-key', keyId: longKey };
  longSpec.zones[0].anchor.targetId = longId;
  const longMessage = `Locked door ${longId} uses key ${longKey} but no pickup/grant event currently provides it.`;
  const longPort = compiler({
    compileLevelSpec(input) {
      const plan = semanticPlan(input);
      plan.diagnostics.push({
        level: 'warning',
        code: 'KEY_SOURCE_NOT_YET_AUTHORED',
        targetId: longId,
        message: longMessage,
      });
      return plan;
    },
  });
  assert.equal(create(longSpec, longPort).compiler.semanticPlan.diagnostics[0].message, longMessage);
});

test('A4a admits the complete bounded compiler-diagnostic cardinality and rejects the next entry', { timeout: 30_000 }, () => {
  const diagnosticPort = (count) => compiler({
    compileLevelSpec(input) {
      const plan = semanticPlan(input);
      plan.diagnostics = Array.from({ length: count }, (_, index) => ({
        level: index % 2 === 0 ? 'info' : 'warning',
        code: 'BOUNDED_DIAGNOSTIC',
        message: `Bounded compiler diagnostic ${index}.`,
      }));
      return plan;
    },
  });

  assert.equal(create(levelSpec(), diagnosticPort(8_194)).compiler.semanticPlan.diagnostics.length, 8_194);
  assertProjectionError(
    () => create(levelSpec(), diagnosticPort(8_195)),
    'NUMBERDROID_LEVEL_PROJECTION_LIMIT_EXCEEDED',
  );
});

test('A4a semantic-plan limits admit deterministic compiler expansion beyond the source scalar budget', { timeout: 30_000 }, () => {
  const spec = levelSpec();
  spec.rules.ensureReachability = false;
  spec.ruleSetRefs = Array.from({ length: 3_180 }, (_, index) => `rules.${index}`);
  spec.spaces = Array.from({ length: 48 }, (_, index) => ({
    id: `room.scalar-volume.${index}`,
    kind: 'room',
    archetype: 'plain-room',
    tags: Array.from({ length: 4_096 }, () => 't'),
    size: { class: 'small' },
  }));
  spec.connections = [];
  spec.props = [];
  spec.encounters = [];
  spec.stagedActors = [];
  spec.routes = [];
  spec.pickups = [];
  spec.zones = [];
  spec.triggers = [];
  spec.events = [];
  delete spec.runtime;

  assert.doesNotThrow(() => validateNumberdroidLevelSpec(spec));
  assert.equal(create(spec).compiler.semanticPlan.spaces.length, 48);
});

test('A4a serialized validation rejects source, plan, A3a, coverage, delta, and fingerprint tampering', { timeout: 5_000 }, () => {
  const projection = create();
  const mutations = [
    (value) => { value.source.levelSpec.id = 'forged'; },
    (value) => { value.compiler.semanticPlan.levelId = 'forged'; },
    (value) => { value.a3a.levelGraph.spaces[0].kind = 'forged'; },
    (value) => { value.coverage.entries[0].disposition = 'FORGED'; },
    (value) => { value.capabilityDelta.status = 'ADVERTISED'; },
    (value) => { value.fingerprint = '0'.repeat(64); },
  ];
  for (const mutate of mutations) {
    const candidate = structuredClone(projection);
    mutate(candidate);
    assert.throws(() => validateNumberdroidLevelAuthoringProjection(candidate, compiler()));
  }
});

test('A4a rejects fully rehashed compiler and A3a forgeries against trusted authority', { timeout: 5_000 }, () => {
  const planForgeries = [
    (value) => { delete value.compiler.semanticPlan.runtime; },
    (value) => { value.compiler.semanticPlan.spaces[0].authority = 'forged'; },
    (value) => { value.compiler.semanticPlan.props[0].metadata.tags = ['forged']; },
    (value) => { value.compiler.semanticPlan.diagnostics.push({ level: 'info', code: 'FORGED', message: 'forged' }); },
  ];
  for (const forge of planForgeries) {
    const candidate = structuredClone(create());
    forge(candidate);
    resignCompilerClosure(candidate);
    assert.throws(() => validateNumberdroidLevelAuthoringProjection(candidate, compiler()));
  }

  const candidate = structuredClone(create());
  const forgedSpace = candidate.a3a.levelGraph.spaces.find(({ spaceId }) => spaceId === 'room.one');
  forgedSpace.kind = 'corridor';
  candidate.a3a.levelGraphFingerprint = sha256(canonicalJson(candidate.a3a.levelGraph));
  candidate.a3a.logicGraph.levelGraph.fingerprint = candidate.a3a.levelGraphFingerprint;
  candidate.a3a.logicGraphFingerprint = sha256(canonicalJson(candidate.a3a.logicGraph));
  resignProjection(candidate);
  assertProjectionError(
    () => validateNumberdroidLevelAuthoringProjection(candidate, compiler()),
    'NUMBERDROID_LEVEL_PROJECTION_A3A_FORGED',
  );
});

test('A4a retains valid non-A3a identifiers and repeated routes only in the Numberdroid closure', { timeout: 5_000 }, () => {
  const spec = levelSpec();
  spec.spaces[0].id = 'Room One';
  spec.runtime.start.spaceId = 'Room One';
  spec.connections[0].from = 'Room One';
  spec.props[0].spaceId = 'Room One';
  spec.encounters[0].spaceId = 'Room One';
  spec.routes[0].spaceIds = ['Room One', 'Room One'];
  spec.pickups[0].spaceId = 'Room One';
  spec.zones[0].spaceId = 'Room One';
  const projection = create(spec);
  assert.equal(projection.source.levelSpec.spaces[0].id, 'Room One');
  assert.equal(projection.compiler.semanticPlan.spaces[0].id, 'Room One');
  assert.ok(!projection.a3a.levelGraph.spaces.some(({ spaceId }) => spaceId === 'Room One'));
  assert.ok(!projection.a3a.levelGraph.routes.some(({ routeId }) => routeId === 'route.guard'));
  const gaps = new Set(projection.gaps.map(({ gapId }) => gapId));
  assert.ok(gaps.has('numberdroid.identifiers.a3a-vocabulary-mismatch'));
  assert.ok(gaps.has('numberdroid.routes.repeated-space-not-representable'));
});

test('A4a retains every current event, trigger, zone-anchor, override, and free-text shape', { timeout: 10_000 }, () => {
  const spec = levelSpec();
  spec.spaces[0].archetype = '';
  spec.spaces[0].tags = ['', ' spaced tag ', 'line\nbreak'];
  spec.encounters[0].mathLabel = '';
  spec.pickups[0].label = ' line\nbreak ';
  spec.pickups[0].propId = '';
  spec.runtime.floorName = '';
  spec.zones = [
    { id: 'zone.space', spaceId: 'room.one', anchor: { kind: 'space-center' } },
    { id: 'zone.connection', spaceId: 'room.one', anchor: { kind: 'connection', targetId: 'door.one' } },
    { id: 'zone.prop', spaceId: 'room.one', anchor: { kind: 'prop', targetId: 'prop.console' } },
    { id: 'zone.actor', spaceId: 'room.one', anchor: { kind: 'actor', targetId: 'actor.guard' } },
    { id: 'zone.route', spaceId: 'room.one', anchor: { kind: 'route', targetId: 'route.guard', position: 'middle' } },
    { id: 'zone.pickup', spaceId: 'room.one', anchor: { kind: 'pickup', targetId: 'pickup.key' } },
  ];
  const triggerKinds = ['enter-space', 'enter-zone', 'interact', 'collect', 'state-change', 'proximity', 'timer'];
  spec.triggers = triggerKinds.map((kind, index) => ({
    id: `trigger.${kind}`,
    kind,
    sourceId: kind === 'enter-space' ? 'room.one'
      : kind === 'enter-zone' ? 'zone.space'
        : kind === 'collect' ? 'pickup.key'
          : kind === 'timer' || kind === 'state-change' ? 'state.source'
            : 'prop.console',
    eventIds: ['event.set-flag'],
    once: index % 2 === 0,
    ...(kind === 'timer' ? { delayMs: 250 } : {}),
    ...(kind === 'proximity' ? { radiusTiles: 2 } : {}),
  }));
  spec.events = [
    { id: 'event.set-flag', kind: 'set-flag', flag: 'state.flag', value: ' line\nbreak ' },
    { id: 'event.grant-key', kind: 'grant-key', keyId: 'key.one' },
    { id: 'event.unlock-door', kind: 'unlock-door', doorId: 'door.one' },
    { id: 'event.lock-door', kind: 'lock-door', doorId: 'door.one' },
    { id: 'event.spawn-actor', kind: 'spawn-actor', actorId: 'actor.staged', spaceId: 'hall.one' },
    { id: 'event.despawn-actor', kind: 'despawn-actor', actorId: 'actor.staged' },
    { id: 'event.move-actor', kind: 'move-actor', actorId: 'actor.staged', routeId: 'route.guard' },
    { id: 'event.actor-passby', kind: 'actor-passby', actorId: 'actor.staged', routeId: 'route.guard', durationMs: 500 },
    { id: 'event.story-beat', kind: 'story-beat', beatId: 'beat.one', blocking: true },
  ];
  spec.overrides = [{
    targetId: 'room.one',
    lockGeometry: true,
    lockedGeometry: { offsetFromRootTiles: { x: 1, y: -1 }, sizeTiles: { w: 4, h: 5 } },
    lockPlacement: true,
    lockedPlacement: { offsetTiles: { x: -2, y: 3 }, rotation: 90, wallSide: null },
    offsetTiles: { x: 2, y: -3 },
    preferredSide: 'north',
    preferredWall: 'east',
    size: { class: 'medium', width: { min: 3, preferred: 4, max: 5 } },
    robotType: 'magnetar',
    seedSalt: 7,
  }];
  const projection = create(spec);
  assert.equal(projection.source.canonicalJson, canonicalJson(spec));
  assert.equal(projection.compiler.semanticPlan.events.length, spec.events.length);
  assert.equal(projection.compiler.semanticPlan.triggers.length, spec.triggers.length);
  assert.equal(projection.compiler.semanticPlan.zones.length, spec.zones.length);
  assert.equal(projection.compiler.semanticPlan.overrides.length, spec.overrides.length);
});

test('A4a makes the A3a 512-entry limit explicit without losing the Numberdroid closure', { timeout: 10_000 }, () => {
  const spec = levelSpec();
  spec.rules.ensureReachability = false;
  spec.spaces = Array.from({ length: 513 }, (_, index) => ({
    id: `room.${String(index).padStart(3, '0')}`,
    kind: 'room',
    archetype: 'plain-room',
    size: { class: 'small' },
  }));
  spec.connections = [];
  spec.props = [];
  spec.encounters = [];
  spec.stagedActors = [];
  spec.routes = [];
  spec.pickups = [];
  spec.zones = [];
  spec.triggers = [];
  spec.events = [];
  delete spec.runtime;
  const projection = create(spec);
  assert.equal(projection.source.levelSpec.spaces.length, 513);
  assert.equal(projection.compiler.semanticPlan.spaces.length, 513);
  assert.equal(projection.a3a.levelGraph.spaces.length, 512);
  const declaredGapIds = new Set(projection.gaps.map(({ gapId }) => gapId));
  assert.ok(projection.coverage.entries.every(({ disposition, gapId }) => (
    disposition !== 'BLOCKED' || declaredGapIds.has(gapId)
  )));
  assert.ok(projection.gaps.some(({ gapId, affectedPointers }) => (
    gapId === 'numberdroid.a3a.collection-limit-exceeded'
      && affectedPointers.includes('/spaces/512')
  )));
});

test('A4a reports route-anchor position and unprojected targets without false A3a coverage', { timeout: 5_000 }, () => {
  const anchored = levelSpec();
  anchored.zones = [{
    id: 'zone.route',
    spaceId: 'room.one',
    anchor: { kind: 'route', targetId: 'route.guard', position: 'end' },
  }];
  const projected = create(anchored);
  assert.equal(canonicalJson(projected.a3a.levelGraph.zones[0].anchor), canonicalJson({ kind: 'route', targetId: 'route.guard' }));
  assert.equal(
    canonicalJson(projected.coverage.entries.find(({ pointer }) => pointer === '/zones/0/anchor/position')),
    canonicalJson({ pointer: '/zones/0/anchor/position', disposition: 'NUMBERDROID_CLOSURE', gapId: null }),
  );

  anchored.routes[0].spaceIds = ['room.one', 'room.one'];
  const blocked = create(anchored);
  assert.ok(blocked.gaps.some(({ gapId, affectedPointers }) => (
    gapId === 'numberdroid.zones.anchor-target-not-projected'
      && affectedPointers.includes('/zones/0/anchor')
  )));
});

test('A4a preserves compiler normalization for opening clearance and runtime', { timeout: 5_000 }, () => {
  const spec = levelSpec();
  spec.connections[0] = {
    id: 'opening.one',
    from: 'room.one',
    to: 'hall.one',
    kind: 'opening',
    clearanceTiles: { before: 7, after: 9 },
  };
  spec.zones = [];
  const projection = create(spec);
  assert.equal(canonicalJson(projection.compiler.semanticPlan.connections[0].clearanceTiles), canonicalJson({ before: 0, after: 0 }));
  assert.equal(canonicalJson(projection.compiler.semanticPlan.runtime), canonicalJson(spec.runtime));
});

test('A4a applies an honest source text budget before building the duplicated envelope', { timeout: 15_000 }, () => {
  const withTagVolume = (spaceCount, tagCount) => {
    const spec = levelSpec();
    spec.rules.ensureReachability = false;
    spec.spaces = Array.from({ length: spaceCount }, (_, index) => ({
      id: `room.volume.${index}`,
      kind: 'room',
      archetype: 'plain-room',
      tags: Array.from({ length: tagCount }, () => 't'.repeat(120)),
      size: { class: 'small' },
    }));
    spec.connections = [];
    spec.props = [];
    spec.encounters = [];
    spec.stagedActors = [];
    spec.routes = [];
    spec.pickups = [];
    spec.zones = [];
    spec.triggers = [];
    spec.events = [];
    delete spec.runtime;
    return spec;
  };
  const withinBudget = withTagVolume(2, 3_500);
  assert.doesNotThrow(() => validateNumberdroidLevelSpec(withinBudget));
  assert.doesNotThrow(() => create(withinBudget));
  assertProjectionError(() => validateNumberdroidLevelSpec(withTagVolume(3, 3_000)), 'NUMBERDROID_LEVEL_PROJECTION_LIMIT_EXCEEDED');
});

test('A4a projection fingerprint binds the complete immutable value', { timeout: 5_000 }, () => {
  const projection = create();
  const core = structuredClone(projection);
  delete core.fingerprint;
  const expected = sha256(canonicalJson(core));
  assert.equal(projection.fingerprint, expected);
});
