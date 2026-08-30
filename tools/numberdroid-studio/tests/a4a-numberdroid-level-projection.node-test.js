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
    spaces: spec.spaces.map((entry) => ({ ...entry, seed: derivedSeed(spec.seed, `space/${entry.id}`) })),
    connections: spec.connections.map((entry) => ({
      ...entry,
      seed: derivedSeed(spec.seed, `connection/${entry.id}`),
      widthTiles: entry.widthTiles ?? (entry.kind === 'standard-door' ? 1 : 2),
      clearanceTiles: entry.clearanceTiles ?? spec.rules.defaultDoorClearance,
      lock: entry.lock ?? { mode: 'none' },
    })),
    props: spec.props.map((entry) => ({
      ...entry,
      seed: derivedSeed(spec.seed, `prop/${entry.id}`),
      quantity: entry.quantity ?? 1,
      required: entry.required ?? true,
      metadata: { id: entry.propId, tags: [], attachment: 'floor' },
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
  assert.equal(projection.capabilityDelta.baseline.fingerprint, NUMBERDROID_PROJECT_CAPABILITY_FINGERPRINT);
  assert.equal(NUMBERDROID_PROJECT_CAPABILITY_FINGERPRINT, '826a8b7942ccba97393f55efa356525529994ad34189446992a7dff58fe97049');
  assert.deepEqual(JSON.parse(projection.source.canonicalJson), input);
  assert.equal(projection.compiler.semanticPlan.levelId, input.id);
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
  assert.equal(numberdroidLevelAuthoringProjectionSha256(first), first.fingerprint);
  assert.equal(canonicalNumberdroidLevelAuthoringProjectionJson(first), canonicalNumberdroidLevelAuthoringProjectionJson(second));
  const serialized = JSON.parse(canonicalNumberdroidLevelAuthoringProjectionJson(first));
  assert.deepEqual(validateNumberdroidLevelAuthoringProjection(serialized), first);
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
    assert.ok(canonicalNumberdroidLevelAuthoringProjectionJson(projection).endsWith('\n'));
    assert.equal(calls, 0);
  } finally {
    delete Object.prototype.toJSON;
    delete Array.prototype.toJSON;
  }
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
    assert.throws(() => validateNumberdroidLevelAuthoringProjection(candidate));
  }
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
  assert.ok(projection.gaps.some(({ gapId, affectedPointers }) => (
    gapId === 'numberdroid.a3a.collection-limit-exceeded'
      && affectedPointers.includes('/spaces/512')
  )));
});

test('A4a projection fingerprint binds the complete immutable value', { timeout: 5_000 }, () => {
  const projection = create();
  const core = structuredClone(projection);
  delete core.fingerprint;
  const sorted = (value) => Array.isArray(value)
    ? value.map(sorted)
    : value && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]))
      : value;
  const expected = createHash('sha256').update(`${JSON.stringify(sorted(core), null, 2)}\n`).digest('hex');
  assert.equal(projection.fingerprint, expected);
});
