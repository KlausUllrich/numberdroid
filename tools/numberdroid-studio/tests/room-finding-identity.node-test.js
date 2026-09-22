import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { AgentTaskService, StudioService } from '../packages/application/src/index.js';
import { fingerprint } from '../packages/application/src/value-utils.js';
import { ROOM_VALIDATOR_VERSION, validateRoomVariant } from '../packages/domain/src/index.js';
import {
  ContentAddressedArtifactStore, SqliteAgentTaskStore, SqliteProjectStore, TaskBranchProjectStore,
  canonicalBundleJson, createSqliteProjectBundle, importSqliteProjectBundle, projectSqlitePortableDocument,
  validateSqlitePortableProject, verifyWorkspaceIntegrity,
} from '../packages/persistence/src/index.js';
import { AGENT, OWNER, OWNER_CONTEXT, PROJECT_ID, command, createProject } from './test-helpers.js';
import { afterTestCleanup, nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';

const canonicalize = value => Array.isArray(value) ? value.map(canonicalize)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]))
    : value;
const identityHash = value => createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');

function archetype(overrides = {}) {
  return {
    projectId: PROJECT_ID, roomArchetypeId: 'archetype.finding-identity', version: 1, kind: 'room',
    displayName: 'Finding identity room', tags: [],
    dimensionPolicy: { width: { min: 3, preferred: 3, max: 8 }, height: { min: 3, preferred: 3, max: 8 } },
    structuralBands: { left: 0, right: 0, top: 0, bottom: 0 }, orientation: 'any',
    connectorPolicy: { min: 0, max: 8, requiredSides: [] }, allowedAssetKinds: ['surface', 'prop', 'item'],
    allowedTags: [], requiredTags: [], rationality: 'neutral', governingRuleRefs: [], ...overrides,
  };
}

function intent(layer, disposition = 'governing') {
  return { layer, ruleId: `rule.${layer}`, summary: `${layer} intent`, disposition };
}

function connector(connectorId, side = 'west', offset = 1) {
  return { connectorId, side, offset, width: 1, kind: 'standard-door', clearanceInside: 1,
    clearanceOutside: 0, required: true, tags: [], compatibilityProfile: 'door.standard' };
}

function placement(placementId, assetId, x, y, layer = 'STRUCTURAL_SURFACE') {
  return { placementId, assetId, assetVersion: 1, metadataVersion: 1, layer, anchor: { x, y }, rotation: 0,
    variantTag: null, proposalId: null, proposalItemId: null };
}

function asset(assetId, kind, { tags = [], blocked = false } = {}) {
  return { assetId, assetVersion: 1, metadataVersion: 1, kind, lifecycle: 'FINAL', metadata: {
    role: kind === 'surface' ? 'base' : 'furniture', tags, variantGroup: null, compatibilityGroups: [],
    spanTiles: { width: 1, height: 1 }, anchor: { x: 0, y: 0 }, attachment: 'ground', rotationPolicy: 'cardinal',
    placement: { modes: ['manual'], wallSafe: true, tags: [], confirmation: 'confirmed' },
    collision: blocked ? { mode: 'bounds', bounds: { x: 0, y: 0, width: 1, height: 1 }, parts: [] }
      : { mode: 'none', bounds: null, parts: [] },
    navigation: { effect: blocked ? 'blocked' : 'passable', cost: null }, runtimeEligible: true, connectors: [],
    continuityProfile: null, continuityTags: [], selectionPriority: 0, visualWeight: 'medium', extensions: {},
  } };
}

function floor() {
  return Array.from({ length: 9 }, (_, index) => placement(`floor.${index}`, 'asset.floor', index % 3, Math.floor(index / 3)));
}

function variant(overrides = {}) {
  return { projectId: PROJECT_ID, roomVariantId: 'room.finding-identity', version: 1,
    roomArchetypeId: 'archetype.finding-identity', archetypeVersion: 1, displayName: 'Finding identity room',
    lifecycle: 'DRAFT', width: 3, height: 3, origin: { x: 0, y: 0 },
    intentTrace: [intent('game_design'), intent('level_design'), intent('room_design')], connectors: [], placements: floor(),
    voidCells: [], blockedCells: [], acceptedWarningFindingIds: [], parentVariantVersion: null, parentFinalVersion: null,
    ...overrides };
}

const assets = () => new Map([
  ['asset.floor', asset('asset.floor', 'surface')],
  ['asset.prop', asset('asset.prop', 'prop', { blocked: true })],
]);

function findingsFor({ variant: candidate = variant(), roomArchetype = archetype(), roomAssets = assets() } = {}) {
  return validateRoomVariant({ variant: candidate, archetype: roomArchetype, assets: roomAssets });
}

test('same-rule Room causes have unique stable identities and resolving one sibling preserves the others', () => {
  const missingThree = findingsFor({ variant: variant({ intentTrace: [] }) });
  const missing = missingThree.findings.filter(({ ruleId }) => ruleId === 'studio.room.intent.layer_required');
  assert.equal(missing.length, 3);
  assert.equal(new Set(missing.map(({ findingId }) => findingId)).size, 3);
  assert.deepEqual(findingsFor({ variant: structuredClone(missingThree.variant) }).findings, missingThree.findings);

  const missingTwo = findingsFor({ variant: variant({ intentTrace: [intent('game_design')] }) }).findings
    .filter(({ ruleId }) => ruleId === 'studio.room.intent.layer_required');
  assert.equal(missingTwo.length, 2);
  for (const finding of missingTwo) {
    const original = missing.find(candidate => candidate.explanation === finding.explanation);
    assert.equal(finding.findingId, original.findingId);
  }

  const proposed = findingsFor({ variant: variant({ intentTrace: [intent('game_design', 'proposed'), intent('level_design'), intent('room_design')] }) });
  const warning = proposed.findings.find(({ ruleId }) => ruleId === 'studio.room.intent.proposed');
  assert.equal(warning.findingId, identityHash({ validatorVersion: ROOM_VALIDATOR_VERSION,
    ruleId: warning.ruleId, targetKind: warning.targetKind, targetId: warning.targetId, path: warning.path }));
  assert.equal(findingsFor().findings.length, 0);
  assert.equal(findingsFor().fingerprint, '989168a0047f6c7ca0a0316893bd26f6edc2d599304bec6a5cd5ef8a9ed11f4d');
});

test('required sides, required tags, and multiway overlaps never share finding IDs', () => {
  const roomArchetype = archetype({
    tags: [], allowedTags: ['domestic', 'medical'], requiredTags: ['domestic', 'medical'],
    connectorPolicy: { min: 0, max: 8, requiredSides: ['north', 'east', 'south'] },
  });
  const roomAssets = assets();
  const floorAsset = roomAssets.get('asset.floor');
  roomAssets.set('asset.floor', { ...floorAsset, metadata: { ...floorAsset.metadata, tags: [] } });
  const candidate = variant({ connectors: [connector('connector.a'), connector('connector.b'), connector('connector.c')],
    placements: [...floor(), placement('prop.a', 'asset.prop', 1, 1, 'SET_DRESSING'),
      placement('prop.b', 'asset.prop', 1, 1, 'SET_DRESSING'), placement('prop.c', 'asset.prop', 1, 1, 'SET_DRESSING')] });
  const findings = findingsFor({ variant: candidate, roomArchetype, roomAssets }).findings;
  const repeatedFamilies = new Set([
    'studio.room.connector.required_side', 'studio.room.archetype.required_tag',
    'studio.room.placement.required_tag_missing', 'studio.room.connector.overlap',
    'studio.room.placement.overlap', 'studio.room.collision.overlap',
  ]);
  const repeated = findings.filter(({ ruleId }) => repeatedFamilies.has(ruleId));
  assert.ok(repeated.length >= 12);
  assert.equal(new Set(repeated.map(({ findingId }) => findingId)).size, repeated.length);
  assert.equal(new Set(findings.map(({ findingId }) => findingId)).size, findings.length);
});

test('connector-clearance identity follows connector ID occurrence, not unrelated array position', () => {
  const placements = [...floor(), placement('prop.blocker', 'asset.prop', 0, 1, 'SET_DRESSING')];
  const withPrior = findingsFor({ variant: variant({ connectors: [connector('connector.a'), connector('connector.b')], placements }) }).findings;
  const before = withPrior.find(finding => finding.ruleId === 'studio.room.connector.clearance_blocked'
    && finding.explanation.includes('connector.b'));
  const withoutPrior = findingsFor({ variant: variant({ connectors: [connector('connector.b')], placements }) }).findings;
  const after = withoutPrior.find(finding => finding.ruleId === 'studio.room.connector.clearance_blocked'
    && finding.explanation.includes('connector.b'));
  assert.ok(before && after);
  assert.equal(after.findingId, before.findingId);

  const duplicates = findingsFor({ variant: variant({ connectors: [connector('connector.duplicate'), connector('connector.duplicate')], placements }) }).findings
    .filter(({ ruleId }) => ruleId === 'studio.room.connector.clearance_blocked');
  assert.equal(duplicates.length, 2);
  assert.equal(new Set(duplicates.map(({ findingId }) => findingId)).size, 2);
});

function archetypeCommand(expectedVersion, id = 'archetype.finding-identity') {
  const { projectId: _projectId, version: _version, ...payload } = archetype({ roomArchetypeId: id });
  return command({ commandId: `cmd.${id}.${expectedVersion}`, idempotencyKey: `idem.${id}.${expectedVersion}`,
    type: 'room.archetype.create', expectedVersion, payload });
}

function variantCommand(expectedVersion, intentTrace = [intent('game_design')]) {
  const payload = variant({ intentTrace, placements: [] });
  for (const key of ['projectId', 'version', 'lifecycle', 'origin', 'voidCells', 'blockedCells', 'acceptedWarningFindingIds', 'parentVariantVersion', 'parentFinalVersion']) delete payload[key];
  return command({ commandId: `cmd.room.finding-identity.${expectedVersion}`, idempotencyKey: `idem.room.finding-identity.${expectedVersion}`,
    type: 'room.variant.create', expectedVersion, payload });
}

function rewriteRoomContentFingerprint(project) {
  const version = project.roomLibrary.variants[0].versions[0];
  const { findings, contentFingerprint: _contentFingerprint, createdAt: _createdAt, createdBy: _createdBy,
    createdRevision: _createdRevision, proposalId: _proposalId, ...portableVariant } = version;
  version.contentFingerprint = fingerprint({ variant: portableVariant, findings });
  return project;
}

function legacyFindingId(finding, validatorVersion = finding.validatorVersion) {
  return fingerprint({ validatorVersion, ruleId: finding.ruleId, targetKind: finding.targetKind,
    targetId: finding.targetId, path: finding.path });
}

async function resignBundle(bundleDirectory, project) {
  const projectBytes = Buffer.from(canonicalBundleJson(project));
  const manifestPath = join(bundleDirectory, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath));
  manifest.project = { sha256: createHash('sha256').update(projectBytes).digest('hex'), byteSize: projectBytes.length };
  const manifestBytes = Buffer.from(canonicalBundleJson(manifest));
  await writeFile(join(bundleDirectory, 'project.json'), projectBytes);
  await writeFile(manifestPath, manifestBytes);
  await writeFile(join(bundleDirectory, 'manifest.sha256'), createHash('sha256').update(manifestBytes).digest('hex'));
}

async function sqliteFixture(context, prefix) {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  afterTestCleanup(context, () => rm(directory, { recursive: true, force: true }));
  const filename = join(directory, 'studio.sqlite');
  let store = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  afterTestCleanup(context, () => store?.close());
  const studio = new StudioService({ store, clock: () => '2026-09-22T12:00:00.000Z' });
  await createProject(studio);
  return { directory, filename, get store() { return store; }, set store(value) { store = value; }, studio };
}

test('an invalid owner-authored Room with two missing intent layers survives SQLite restart and integrity verification', async context => {
  const fixture = await sqliteFixture(context, 'numberdroid-room-finding-owner-');
  await fixture.studio.execute(archetypeCommand(1), OWNER_CONTEXT);
  await fixture.studio.execute(variantCommand(2), OWNER_CONTEXT);
  const before = (await fixture.studio.queryRooms({ schemaVersion: 1, projectId: PROJECT_ID,
    roomVariantId: 'room.finding-identity', includeVersions: true }, OWNER_CONTEXT)).variants[0].versions[0];
  assert.equal(before.findings.filter(({ ruleId }) => ruleId === 'studio.room.intent.layer_required').length, 2);
  assert.equal(new Set(before.findings.map(({ findingId }) => findingId)).size, before.findings.length);
  fixture.store.close();
  fixture.store = await SqliteProjectStore.open({ filename: fixture.filename, databaseFactory: nodeSqliteDatabaseFactory });
  const reopened = new StudioService({ store: fixture.store });
  const after = (await reopened.queryRooms({ schemaVersion: 1, projectId: PROJECT_ID,
    roomVariantId: 'room.finding-identity', includeVersions: true }, OWNER_CONTEXT)).variants[0].versions[0];
  assert.deepEqual(after, before);
  const artifactStore = new ContentAddressedArtifactStore({ rootDirectory: join(fixture.directory, 'artifacts') });
  await artifactStore.initialize();
  assert.equal((await verifyWorkspaceIntegrity({ projectStore: fixture.store, artifactStore })).rooms.ok, true);
});

test('portable Room bundles accept exact historical v2 and v1 finding hashes but reject re-fingerprinted semantic tampering', async context => {
  const fixture = await sqliteFixture(context, 'numberdroid-room-finding-bundle-');
  await fixture.studio.execute(archetypeCommand(1), OWNER_CONTEXT);
  await fixture.studio.execute(variantCommand(2, [intent('game_design'), intent('level_design')]), OWNER_CONTEXT);
  const artifactStore = new ContentAddressedArtifactStore({ rootDirectory: join(fixture.directory, 'source-artifacts') });
  await artifactStore.initialize();
  const currentBundle = join(fixture.directory, 'current-bundle');
  await createSqliteProjectBundle({ destinationDirectory: currentBundle, projectStore: fixture.store,
    artifactStore, projectId: PROJECT_ID });
  const currentProject = JSON.parse(await readFile(join(currentBundle, 'project.json')));
  assert.equal(currentProject.schemaVersion, 2);
  const currentVersion = currentProject.roomLibrary.variants[0].versions[0];
  const affected = currentVersion.findings.filter(({ ruleId }) => ruleId === 'studio.room.intent.layer_required');
  assert.equal(affected.length, 1);

  const currentDestination = join(fixture.directory, 'current-import');
  await importSqliteProjectBundle({ bundleDirectory: currentBundle, destinationDirectory: currentDestination,
    databaseFactory: nodeSqliteDatabaseFactory });
  const currentImported = await SqliteProjectStore.open({ filename: join(currentDestination, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory });
  afterTestCleanup(context, () => currentImported.close());
  assert.deepEqual(projectSqlitePortableDocument({ projectStore: currentImported, projectId: PROJECT_ID }).project, currentProject);

  const legacyProject = structuredClone(currentProject);
  const legacyFinding = legacyProject.roomLibrary.variants[0].versions[0].findings
    .find(({ ruleId }) => ruleId === 'studio.room.intent.layer_required');
  legacyFinding.findingId = legacyFindingId(legacyFinding);
  rewriteRoomContentFingerprint(legacyProject);
  assert.doesNotThrow(() => validateSqlitePortableProject(legacyProject));
  const legacyBundle = join(fixture.directory, 'legacy-v2-bundle');
  await cp(currentBundle, legacyBundle, { recursive: true });
  await resignBundle(legacyBundle, legacyProject);
  const legacyDestination = join(fixture.directory, 'legacy-v2-import');
  await importSqliteProjectBundle({ bundleDirectory: legacyBundle, destinationDirectory: legacyDestination,
    databaseFactory: nodeSqliteDatabaseFactory });
  const legacyImported = await SqliteProjectStore.open({ filename: join(legacyDestination, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory });
  afterTestCleanup(context, () => legacyImported.close());
  const importedLegacyVersion = (await new StudioService({ store: legacyImported }).queryRooms({ schemaVersion: 1,
    projectId: PROJECT_ID, roomVariantId: 'room.finding-identity', includeVersions: true }, OWNER_CONTEXT)).variants[0].versions[0];
  assert.deepEqual(importedLegacyVersion.findings, legacyProject.roomLibrary.variants[0].versions[0].findings);

  const legacyV1 = structuredClone(currentProject);
  for (const finding of legacyV1.roomLibrary.variants[0].versions[0].findings) {
    finding.validatorVersion = 'numberdroid-studio.room-validator.v1';
    finding.findingId = legacyFindingId(finding, finding.validatorVersion);
  }
  rewriteRoomContentFingerprint(legacyV1);
  assert.doesNotThrow(() => validateSqlitePortableProject(legacyV1));

  const tamperCases = [
    ['arbitrary finding ID', finding => { finding.findingId = 'f'.repeat(64); }],
    ['changed explanation', finding => { finding.explanation = 'Different English must not become identity.'; }],
    ['changed severity', finding => { finding.severity = 'WARNING'; }],
    ['changed path', finding => { finding.path = '/intentTrace/forged'; }],
    ['omitted finding', (_finding, findings) => { findings.length = 0; }],
    ['additional finding', (finding, findings) => { findings.push({ ...finding, findingId: 'e'.repeat(64) }); }],
  ];
  for (const [label, mutate] of tamperCases) {
    const tampered = structuredClone(legacyProject);
    const findings = tampered.roomLibrary.variants[0].versions[0].findings;
    mutate(findings[0], findings);
    rewriteRoomContentFingerprint(tampered);
    assert.throws(() => validateSqlitePortableProject(tampered), error => error.code === 'BUNDLE_SEMANTIC_INVALID', label);
  }
});

test('an isolated task can merge an accepted Room subset with every finding retained, replay idempotently, and revert without rewriting history', async context => {
  const fixture = await sqliteFixture(context, 'numberdroid-room-finding-merge-');
  const taskStore = new SqliteAgentTaskStore({ workspace: fixture.store.workspace });
  const tasks = new AgentTaskService({ studioService: fixture.studio, projectStore: fixture.store, taskStore,
    createBranchStore: ({ projectId, taskId }) => new TaskBranchProjectStore({ taskStore, projectId, taskId }),
    clock: () => '2026-09-22T12:00:01.000Z' });
  const created = await tasks.createTask({ projectId: PROJECT_ID, task: {
    taskId: 'task.room.finding-identity', branchId: 'branch.task.room.finding-identity', agentId: AGENT.id,
    title: 'Room finding identity', objective: 'Create one invalid Room without losing deterministic findings.',
    capabilities: ['project.read', 'room.archetype.create', 'room.variant.create'],
    objectScopes: [{ kind: 'project', id: PROJECT_ID }],
    budget: { maxCommands: 4, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 },
    expiresAt: '2026-09-22T14:00:00.000Z', autoAcceptPolicy: { enabled: false, allowedCommandTypes: [], maxChanges: 0 },
  } }, OWNER_CONTEXT);
  const agentContext = { actor: AGENT, taskId: created.task.taskId, branchId: created.task.branchId, grantId: created.task.grantId };
  await tasks.execute(archetypeCommand(created.task.baseRevision), agentContext);
  await tasks.execute(archetypeCommand(created.task.baseRevision + 1, 'archetype.unselected'), agentContext);
  await tasks.execute(variantCommand(created.task.baseRevision + 2), agentContext);
  const revisions = taskStore.listBranchRevisions(PROJECT_ID, created.task.taskId);
  const acceptedIds = new Set(revisions.filter(revision => revision.command.payload.roomArchetypeId === 'archetype.finding-identity'
    || revision.command.payload.roomVariantId === 'room.finding-identity').map(({ id }) => id));
  const submitted = await tasks.submitReview(PROJECT_ID, created.task.taskId, { reviewId: 'review.room.finding-identity', actorId: OWNER.id });
  await tasks.decideReview(PROJECT_ID, created.task.taskId, submitted.review.reviewId,
    submitted.review.items.map(item => ({ changeId: item.changeId, disposition: acceptedIds.has(item.changeId) ? 'USER_ACCEPTED' : 'USER_REJECTED', reason: 'Bounded subset decision.' })),
    { actorId: OWNER.id, expectedReviewVersion: submitted.review.reviewVersion });
  const merged = await tasks.mergeReview(PROJECT_ID, created.task.taskId, submitted.review.reviewId,
    { mergeId: 'merge.room.finding-identity', actorId: OWNER.id });
  assert.equal(merged.replayed, false);
  const mergedDocument = await fixture.store.loadProject(PROJECT_ID);
  const mergedRevisionCount = mergedDocument.revisions.length;
  const mergedRoom = mergedDocument.revisions.at(-1).snapshot.roomLibrary.variants[0].versions[0];
  assert.equal(mergedRoom.findings.filter(({ ruleId }) => ruleId === 'studio.room.intent.layer_required').length, 2);
  assert.equal(new Set(mergedRoom.findings.map(({ findingId }) => findingId)).size, mergedRoom.findings.length);
  const replay = await tasks.mergeReview(PROJECT_ID, created.task.taskId, submitted.review.reviewId,
    { mergeId: 'merge.room.finding-identity', actorId: OWNER.id });
  assert.equal(replay.replayed, true);
  assert.equal((await fixture.store.loadProject(PROJECT_ID)).revisions.length, mergedRevisionCount);
  await tasks.revertMerge(PROJECT_ID, merged.merge.mergeId, { revertId: 'revert.room.finding-identity', actorId: OWNER.id });
  const reverted = await fixture.store.loadProject(PROJECT_ID);
  assert.equal(reverted.revisions.at(-1).snapshot.roomLibrary?.variants?.length ?? 0, 0);
  assert.deepEqual(reverted.revisions.find(({ number }) => number === merged.merge.lastRevision).snapshot.roomLibrary.variants[0].versions[0], mergedRoom);
});
