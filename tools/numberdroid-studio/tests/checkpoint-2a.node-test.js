import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StudioService } from '../packages/application/src/index.js';
import {
  ContentAddressedArtifactStore,
  createWorkspaceBackup,
  restoreWorkspaceBackup,
  SqliteAgentAttemptStore,
  SqliteArtifactMetadataStore,
  SqliteHostBindingStore,
  SqliteProjectStore,
  SqliteSourceIntakeStore,
  verifyWorkspaceBackup,
  verifyWorkspaceIntegrity,
} from '../packages/persistence/src/index.js';
import { createAgentToolCatalog } from '../packages/mcp-server/src/index.js';
import { createStudioHttpServer } from '../apps/studio-server/src/server.js';
import {
  AGENT, AGENT_CONTEXT, OWNER, OWNER_CONTEXT, PROJECT_ID, command, createHarness, createProject, issueGrant,
} from './test-helpers.js';
import { afterTestCleanup, nodeSqliteDatabaseFactory, pngHeader } from './persistence-test-helpers.js';

const studioRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FAMILY_HYGIENE_SOURCE = resolve(
  studioRoot,
  '../../art-source/approved/area-01-transfer-ship/floor-treatment/source/family-hygiene-floor-2x2__source-approved__2026-08-21.png',
);
const FAMILY_HYGIENE_DIGEST = '67b87430b0c78b6bb9b3af5b3a8bc75c9156a38d75b433a1cbbef8fd7979c71e';

function provenance(origin = 'human_upload') {
  return {
    origin,
    prompt: origin === 'imported_generation' ? 'Provider-neutral imported generation record.' : null,
    negativePrompt: null,
    seed: origin === 'imported_generation' ? 742 : null,
    provider: origin === 'imported_generation' ? 'fixture-provider' : null,
    model: origin === 'imported_generation' ? 'fixture-model' : null,
    modelVersion: origin === 'imported_generation' ? '2026-08' : null,
    generator: null,
    parameters: origin === 'imported_generation' ? { guidance: 7 } : {},
    referenceArtifactUris: [],
    parentSourceIds: [],
  };
}

function intakeCommand(artifact, overrides = {}) {
  return command({
    commandId: 'cmd.intake.commit',
    idempotencyKey: 'idem.intake.commit',
    type: 'source.intake.commit',
    expectedVersion: 2,
    payload: {
      intakeId: 'intake.family-hygiene',
      sourceId: 'source.family-hygiene',
      name: 'Family Hygiene floor atlas',
      artifactUri: artifact.uri,
      mediaType: artifact.mediaType,
      byteSize: artifact.byteSize,
      width: artifact.width,
      height: artifact.height,
      provenance: provenance(),
    },
    ...overrides,
  });
}

async function fixture(context, {
  faultInjector = null,
  scopes = ['project.read', 'source.write', 'source.intake.commit', 'source.review.propose'],
  budget = undefined,
} = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-checkpoint-2a-'));
  const store = await SqliteProjectStore.open({
    filename: join(directory, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
    faultInjector,
  });
  afterTestCleanup(context, async () => {
    store.close();
    await rm(directory, { recursive: true, force: true });
  });
  const { studio } = createHarness(store);
  await createProject(studio);
  await issueGrant(studio, { scopes, ...(budget ? { budget } : {}) });
  const artifacts = new ContentAddressedArtifactStore({ rootDirectory: join(directory, 'artifacts') });
  const artifact = await artifacts.ingest(pngHeader({ width: 24, height: 16, tail: 'checkpoint-2a' }), {
    mediaType: 'image/png',
  });
  const intakes = new SqliteSourceIntakeStore({ workspace: store.workspace });
  intakes.stage(artifact, {
    projectId: PROJECT_ID,
    intakeId: 'intake.family-hygiene',
    idempotencyKey: 'intake-upload.family-hygiene',
    origin: 'human_upload',
    createdRevision: 2,
    createdAt: '2026-08-21T12:00:02.000Z',
  });
  return { directory, store, studio, artifact, artifacts, intakes };
}

test('V2 source intake claim, canonical reference, revision, provenance, and review decision remain explicit', async (context) => {
  const { store, studio, artifact, intakes } = await fixture(context);
  const committed = await studio.execute(intakeCommand(artifact), AGENT_CONTEXT);
  assert.equal(committed.revision, 3);
  const source = (await studio.readProjectTrusted(PROJECT_ID)).snapshot.sources[0];
  assert.equal(source.schemaVersion, 2);
  assert.equal(source.lifecycle.state, 'IMPORTED');
  assert.equal(source.review.disposition, 'PENDING');
  assert.deepEqual(source.provenance, provenance());
  assert.equal(intakes.get(PROJECT_ID, 'intake.family-hygiene').state, 'CLAIMED');
  assert.equal(store.workspace.database.prepare(`
    SELECT count(*) AS count FROM artifact_references
    WHERE project_id = ? AND owner_kind = 'source' AND owner_id = ?
  `).get(PROJECT_ID, source.id).count, 1);
  assert.equal(store.workspace.database.prepare(`
    SELECT count(*) AS count FROM artifact_references
    WHERE project_id = ? AND owner_kind = 'source_intake' AND owner_id = ?
  `).get(PROJECT_ID, source.intakeId).count, 0);

  const replay = await studio.execute(intakeCommand(artifact, { commandId: 'cmd.intake.retry' }), AGENT_CONTEXT);
  assert.equal(replay.replayed, true);
  assert.equal(replay.revision, 3);

  await assert.rejects(studio.execute(intakeCommand(artifact, {
    commandId: 'cmd.intake.second-source',
    idempotencyKey: 'idem.intake.second-source',
    expectedVersion: 3,
    payload: { ...intakeCommand(artifact).payload, sourceId: 'source.second' },
  }), AGENT_CONTEXT), (error) => error.code === 'SOURCE_INTAKE_ALREADY_CLAIMED');
  assert.equal((await studio.readProjectTrusted(PROJECT_ID)).revision, 3);

  await studio.execute(command({
    commandId: 'cmd.review.propose',
    idempotencyKey: 'idem.review.propose',
    type: 'source.review.propose',
    expectedVersion: 3,
    payload: { sourceId: source.id, note: 'Ready for owner inspection.' },
  }), AGENT_CONTEXT);
  const proposedSource = (await studio.readProjectTrusted(PROJECT_ID)).snapshot.sources[0];
  assert.equal(proposedSource.lifecycle.state, 'REVIEWED');
  assert.equal(proposedSource.review.disposition, 'PENDING');
  await assert.rejects(studio.execute(command({
    commandId: 'cmd.review.agent-decision',
    idempotencyKey: 'idem.review.agent-decision',
    type: 'source.review.decide',
    expectedVersion: 4,
    payload: { sourceId: source.id, disposition: 'APPROVED' },
  }), AGENT_CONTEXT), (error) => error.code === 'FORBIDDEN');
  const approved = await studio.execute(command({
    commandId: 'cmd.review.owner-decision',
    idempotencyKey: 'idem.review.owner-decision',
    type: 'source.review.decide',
    expectedVersion: 4,
    payload: { sourceId: source.id, disposition: 'APPROVED', note: 'Original source accepted.' },
  }), OWNER_CONTEXT);
  assert.equal(approved.revision, 5);
  const finalSource = (await studio.readProjectTrusted(PROJECT_ID)).snapshot.sources[0];
  assert.equal(finalSource.lifecycle.state, 'APPROVED_SOURCE');
  assert.equal(finalSource.review.disposition, 'USER_APPROVED');
  await assert.rejects(studio.execute(command({
    commandId: 'cmd.review.approved-reproposal',
    idempotencyKey: 'idem.review.approved-reproposal',
    type: 'source.review.propose',
    expectedVersion: 5,
    payload: { sourceId: source.id },
  }), AGENT_CONTEXT), (error) => error.code === 'ENTITY_STATE_CONFLICT');
});

test('source intake claim rolls back together with source reference and revision', async (context) => {
  let armed = false;
  const fixtureValue = await fixture(context, {
    faultInjector(point) {
      if (armed && point === 'after_source_intake_claim') throw new Error('checkpoint-2a claim fault');
    },
  });
  armed = true;
  await assert.rejects(
    fixtureValue.studio.execute(intakeCommand(fixtureValue.artifact), AGENT_CONTEXT),
    /checkpoint-2a claim fault/,
  );
  assert.equal((await fixtureValue.studio.readProjectTrusted(PROJECT_ID)).revision, 2);
  assert.equal(fixtureValue.intakes.get(PROJECT_ID, 'intake.family-hygiene').state, 'STAGED');
  assert.equal(fixtureValue.store.workspace.database.prepare(`
    SELECT count(*) AS count FROM artifact_references WHERE owner_kind = 'source'
  `).get().count, 0);
  assert.equal(fixtureValue.store.workspace.database.prepare(`
    SELECT count(*) AS count FROM artifact_references WHERE owner_kind = 'source_intake'
  `).get().count, 1);
});

test('staged source intakes remain visible until an idempotent explicit abandon releases the reference', async (context) => {
  const { store, intakes } = await fixture(context);
  assert.deepEqual(intakes.list(PROJECT_ID, { state: 'STAGED' }).map(({ intakeId }) => intakeId), ['intake.family-hygiene']);
  const abandoned = intakes.abandon(PROJECT_ID, 'intake.family-hygiene', {
    idempotencyKey: 'intake-abandon.family-hygiene',
    abandonedBy: OWNER.id,
    abandonedAt: '2026-08-21T12:00:10.000Z',
  });
  assert.equal(abandoned.state, 'ABANDONED');
  assert.equal(abandoned.replayed, false);
  assert.equal(intakes.abandon(PROJECT_ID, 'intake.family-hygiene', {
    idempotencyKey: 'intake-abandon.family-hygiene',
    abandonedBy: OWNER.id,
  }).replayed, true);
  assert.equal(store.workspace.database.prepare(`
    SELECT count(*) AS count FROM artifact_references
    WHERE project_id = ? AND owner_kind = 'source_intake' AND owner_id = ?
  `).get(PROJECT_ID, 'intake.family-hygiene').count, 0);
  await assert.rejects(Promise.resolve().then(() => intakes.abandon(PROJECT_ID, 'intake.family-hygiene', {
    idempotencyKey: 'intake-abandon.changed',
    abandonedBy: OWNER.id,
  })), (error) => error.code === 'IDEMPOTENCY_CONFLICT');
});

test('source intake has a distinct scope and atomically charges artifact bytes once', async (context) => {
  const legacy = await fixture(context, { scopes: ['project.read', 'source.write', 'source.review.propose'] });
  await assert.rejects(legacy.studio.execute(intakeCommand(legacy.artifact), AGENT_CONTEXT), (error) => (
    error.code === 'GRANT_SCOPE_MISSING' && error.details.requiredScope === 'source.intake.commit'
  ));
  assert.equal((await legacy.studio.readProjectTrusted(PROJECT_ID)).revision, 2);

  const overrun = await fixture(context, {
    budget: { maxCommands: 100, maxJobs: 10, maxArtifactBytes: 1, maxCostCents: 0 },
  });
  await assert.rejects(overrun.studio.execute(intakeCommand(overrun.artifact), AGENT_CONTEXT), (error) => error.code === 'BUDGET_EXCEEDED');
  assert.equal((await overrun.studio.readProjectTrusted(PROJECT_ID)).snapshot.grants[0].usage.artifactBytes, 0);
  assert.equal(overrun.intakes.get(PROJECT_ID, 'intake.family-hygiene').state, 'STAGED');

  const charged = await fixture(context);
  await charged.studio.execute(intakeCommand(charged.artifact), AGENT_CONTEXT);
  const firstUsage = (await charged.studio.readProjectTrusted(PROJECT_ID)).snapshot.grants[0].usage;
  assert.equal(firstUsage.artifactBytes, charged.artifact.byteSize);
  await charged.studio.execute(intakeCommand(charged.artifact, { commandId: 'cmd.intake.budget-replay' }), AGENT_CONTEXT);
  const replayUsage = (await charged.studio.readProjectTrusted(PROJECT_ID)).snapshot.grants[0].usage;
  assert.deepEqual(replayUsage, firstUsage);
});

test('V2 provenance is discriminated, bounded, secret-free, and claims only project-live lineage artifacts', async (context) => {
  const fixtureValue = await fixture(context);
  const metadata = new SqliteArtifactMetadataStore({ workspace: fixtureValue.store.workspace });
  const lineage = await fixtureValue.artifacts.ingest(pngHeader({ width: 8, height: 8, tail: 'lineage' }), { mediaType: 'image/png' });
  metadata.register(lineage);
  const imported = provenance();
  imported.referenceArtifactUris = [lineage.uri];
  const lineageCommand = intakeCommand(fixtureValue.artifact, {
    payload: { ...intakeCommand(fixtureValue.artifact).payload, provenance: imported },
  });
  await assert.rejects(fixtureValue.studio.execute(lineageCommand, AGENT_CONTEXT), (error) => error.code === 'ARTIFACT_NOT_LIVE');
  assert.equal(fixtureValue.intakes.get(PROJECT_ID, 'intake.family-hygiene').state, 'STAGED');
  metadata.addReference({
    projectId: PROJECT_ID,
    ownerKind: 'upload',
    ownerId: 'upload.lineage',
    digest: lineage.digest,
    createdRevision: 2,
  });
  await fixtureValue.studio.execute(lineageCommand, AGENT_CONTEXT);
  assert.equal(fixtureValue.store.workspace.database.prepare(`
    SELECT count(*) AS count FROM artifact_references
    WHERE project_id = ? AND owner_kind = 'source_lineage' AND owner_id = ? AND digest = ?
  `).get(PROJECT_ID, 'source.family-hygiene', lineage.digest).count, 1);

  const invalidHuman = provenance();
  invalidHuman.provider = 'fake-provider';
  await assert.rejects(fixtureValue.studio.execute(intakeCommand(fixtureValue.artifact, {
    commandId: 'cmd.provenance.human-fake',
    idempotencyKey: 'idem.provenance.human-fake',
    expectedVersion: 3,
    payload: {
      ...intakeCommand(fixtureValue.artifact).payload,
      intakeId: 'intake.missing', sourceId: 'source.invalid-human', provenance: invalidHuman,
    },
  }), AGENT_CONTEXT), (error) => error.code === 'VALIDATION_ERROR');

  for (const [id, parameters] of [
    ['secret', { apiToken: 'redacted' }],
    ['uri', { output: 'https://provider.example/result.png' }],
    ['path', { output: '../../private/result.png' }],
  ]) {
    const invalidImported = provenance('imported_generation');
    invalidImported.parameters = parameters;
    await assert.rejects(fixtureValue.studio.execute(intakeCommand(fixtureValue.artifact, {
      commandId: `cmd.provenance.${id}`,
      idempotencyKey: `idem.provenance.${id}`,
      expectedVersion: 3,
      payload: {
        ...intakeCommand(fixtureValue.artifact).payload,
        intakeId: 'intake.missing', sourceId: `source.invalid-${id}`, provenance: invalidImported,
      },
    }), AGENT_CONTEXT), (error) => error.code === 'PROVENANCE_PARAMETER_FORBIDDEN');
  }
});

test('rejected V2 sources are terminal in 2A and legacy registrations cannot enter the review lifecycle', async (context) => {
  const rejectedFixture = await fixture(context);
  await rejectedFixture.studio.execute(intakeCommand(rejectedFixture.artifact), AGENT_CONTEXT);
  await rejectedFixture.studio.execute(command({
    commandId: 'cmd.review.reject-propose',
    idempotencyKey: 'idem.review.reject-propose',
    type: 'source.review.propose',
    expectedVersion: 3,
    payload: { sourceId: 'source.family-hygiene' },
  }), AGENT_CONTEXT);
  await assert.rejects(rejectedFixture.studio.execute(command({
    commandId: 'cmd.review.reject-without-note',
    idempotencyKey: 'idem.review.reject-without-note',
    type: 'source.review.decide',
    expectedVersion: 4,
    payload: { sourceId: 'source.family-hygiene', disposition: 'REJECTED' },
  }), OWNER_CONTEXT), (error) => error.code === 'VALIDATION_ERROR');
  assert.equal((await rejectedFixture.studio.readProjectTrusted(PROJECT_ID)).revision, 4);
  await rejectedFixture.studio.execute(command({
    commandId: 'cmd.review.reject-decision',
    idempotencyKey: 'idem.review.reject-decision',
    type: 'source.review.decide',
    expectedVersion: 4,
    payload: { sourceId: 'source.family-hygiene', disposition: 'REJECTED', note: 'Fixture rejection.' },
  }), OWNER_CONTEXT);
  const rejected = (await rejectedFixture.studio.readProjectTrusted(PROJECT_ID)).snapshot.sources[0];
  assert.equal(rejected.lifecycle.state, 'REJECTED');
  assert.equal(rejected.review.disposition, 'USER_REJECTED');
  assert.equal(rejected.artifactUri, rejectedFixture.artifact.uri);
  assert.deepEqual(rejected.provenance, provenance());
  await assert.rejects(rejectedFixture.studio.execute(command({
    commandId: 'cmd.review.reject-reproposal',
    idempotencyKey: 'idem.review.reject-reproposal',
    type: 'source.review.propose',
    expectedVersion: 5,
    payload: { sourceId: rejected.id },
  }), AGENT_CONTEXT), (error) => error.code === 'ENTITY_STATE_CONFLICT');

  const legacyFixture = await fixture(context);
  await legacyFixture.studio.execute(command({
    commandId: 'cmd.legacy-source',
    idempotencyKey: 'idem.legacy-source',
    type: 'source.register',
    expectedVersion: 2,
    payload: {
      sourceId: 'source.legacy',
      name: 'Legacy source',
      artifactUri: 'file:///legacy/source.png',
      mediaType: 'image/png',
      width: 24,
      height: 16,
      provenance: { prompt: 'Legacy prompt', seed: null, model: null, generator: null },
    },
  }), AGENT_CONTEXT);
  await assert.rejects(legacyFixture.studio.execute(command({
    commandId: 'cmd.legacy-review',
    idempotencyKey: 'idem.legacy-review',
    type: 'source.review.propose',
    expectedVersion: 3,
    payload: { sourceId: 'source.legacy' },
  }), AGENT_CONTEXT), (error) => error.code === 'ENTITY_STATE_CONFLICT');
});

test('new agent source mutations advertise only with durable attempt audit and never expose owner decision', async (context) => {
  const { store } = await fixture(context);
  const withoutAudit = new StudioService({ store });
  const hidden = createAgentToolCatalog(withoutAudit, {
    contextProvider: async () => ({ projectId: PROJECT_ID, ...AGENT_CONTEXT }),
  }).map(({ name }) => name);
  assert.ok(!hidden.includes('studio_source_intake_commit'));
  assert.ok(!hidden.includes('studio_source_review_propose'));

  const withAudit = new StudioService({ store, agentAttemptAuditReady: true });
  const visible = createAgentToolCatalog(withAudit, {
    contextProvider: async () => ({ projectId: PROJECT_ID, ...AGENT_CONTEXT }),
  }).map(({ name }) => name);
  assert.ok(visible.includes('studio_source_intake_commit'));
  assert.ok(visible.includes('studio_source_review_propose'));
  assert.ok(!visible.includes('studio_source_review_decide'));

  const attempts = new SqliteAgentAttemptStore({ workspace: store.workspace });
  attempts.recordFailure({
    attemptId: 'attempt.denied',
    projectId: PROJECT_ID,
    correlationId: 'mcp.denied',
    actorId: 'atlas.agent',
    taskId: 'task.atlas',
    branchId: 'branch.task.atlas',
    commandId: 'cmd.denied',
    commandType: 'source.intake.commit',
    targetId: PROJECT_ID,
    observedRevision: 2,
    status: 'DENIED',
    errorCode: 'GRANT_SCOPE_MISSING',
    details: { requiredScope: 'source.intake.commit' },
  });
  const [attempt] = attempts.listForProject(PROJECT_ID);
  assert.equal(attempt.status, 'DENIED');
  assert.deepEqual(attempt.details, { requiredScope: 'source.intake.commit' });
});

test('accepted agent commands stay in semantic Activity and audit-write failure fails closed for denied attempts', async (context) => {
  const { store, studio } = await fixture(context, { scopes: ['project.read', 'project.status.write'] });
  const bindings = new SqliteHostBindingStore({ workspace: store.workspace });
  const binding = bindings.issue({
    projectId: PROJECT_ID,
    grantId: 'grant.atlas',
    agentId: AGENT.id,
    taskId: AGENT_CONTEXT.taskId,
    branchId: AGENT_CONTEXT.branchId,
    issuedBy: OWNER.id,
  });
  const failingAudit = {
    isLive: true,
    recordFailure() { throw new Error('durable audit unavailable'); },
    listForProject() { return []; },
  };
  const server = createStudioHttpServer({ studioService: studio, hostBindingStore: bindings, agentAttemptStore: failingAudit });
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  afterTestCleanup(context, () => new Promise((resolveClose) => server.close(resolveClose)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const execute = (commandDto) => fetch(`${base}/internal/mcp/execute`, {
    method: 'POST',
    headers: { authorization: `Bearer ${binding.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ schemaVersion: 1, command: commandDto }),
  });
  const accepted = await execute(command({
    commandId: 'cmd.audit.accepted',
    idempotencyKey: 'idem.audit.accepted',
    type: 'project.status.set',
    expectedVersion: 2,
    payload: { status: 'active' },
  }));
  assert.equal(accepted.status, 200);
  assert.equal((await studio.readProjectTrusted(PROJECT_ID)).revision, 3);
  assert.equal(store.workspace.database.prepare('SELECT count(*) AS count FROM agent_attempts').get().count, 0);
  const failedClosed = await execute(command({
    commandId: 'cmd.audit.denied-write-failure',
    idempotencyKey: 'idem.audit.denied-write-failure',
    type: 'project.status.set',
    expectedVersion: 2,
    payload: { status: 'paused' },
  }));
  assert.equal(failedClosed.status, 500);
  assert.equal((await failedClosed.json()).error.code, 'INTERNAL_ERROR');
  assert.equal((await studio.readProjectTrusted(PROJECT_ID)).revision, 3);
});

test('loopback human intake/review is CSRF-bound and denied MCP attempts enter the redacted durable Activity ledger', async (context) => {
  const { store, studio, artifacts, intakes } = await fixture(context);
  const metadata = new SqliteArtifactMetadataStore({ workspace: store.workspace });
  const attempts = new SqliteAgentAttemptStore({ workspace: store.workspace });
  const bindings = new SqliteHostBindingStore({
    workspace: store.workspace,
    clock: () => '2026-08-21T12:00:20.000Z',
  });
  const binding = bindings.issue({
    projectId: PROJECT_ID,
    grantId: 'grant.atlas',
    agentId: AGENT.id,
    taskId: 'task.atlas',
    branchId: 'branch.task.atlas',
    issuedBy: OWNER.id,
  });
  const server = createStudioHttpServer({
    studioService: studio,
    hostBindingStore: bindings,
    artifactStore: artifacts,
    artifactMetadataStore: metadata,
    sourceIntakeStore: intakes,
    agentAttemptStore: attempts,
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  afterTestCleanup(context, () => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const session = await fetch(`${base}/api/ui-session`).then((response) => response.json());
  const bytes = pngHeader({ width: 30, height: 20, tail: 'http-intake' });
  const blind = await fetch(`${base}/api/projects/${PROJECT_ID}/source-intakes`, {
    method: 'POST',
    headers: {
      'content-type': 'image/png',
      'x-numberdroid-idempotency-key': 'http-intake.blind',
    },
    body: bytes,
  });
  assert.equal(blind.status, 403);
  assert.equal((await blind.json()).error.code, 'UI_ORIGIN_REQUIRED');
  const headers = {
    origin: base,
    'sec-fetch-site': 'same-origin',
    'x-numberdroid-studio-csrf': session.csrfToken,
  };
  const stagedResponse = await fetch(`${base}/api/projects/${PROJECT_ID}/source-intakes`, {
    method: 'POST',
    headers: {
      ...headers,
      'content-type': 'image/png',
      'x-numberdroid-idempotency-key': 'http-intake.family-hygiene',
      'x-numberdroid-source-origin': 'imported_generation',
    },
    body: bytes,
  });
  assert.equal(stagedResponse.status, 201);
  assert.equal(stagedResponse.headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.equal(stagedResponse.headers.get('referrer-policy'), 'no-referrer');
  const staged = await stagedResponse.json();
  assert.equal(staged.origin, 'imported_generation');
  const replayResponse = await fetch(`${base}/api/projects/${PROJECT_ID}/source-intakes`, {
    method: 'POST',
    headers: {
      ...headers,
      'content-type': 'image/png',
      'x-numberdroid-idempotency-key': 'http-intake.family-hygiene',
      'x-numberdroid-source-origin': 'imported_generation',
    },
    body: bytes,
  });
  assert.equal(replayResponse.status, 200);
  assert.equal((await replayResponse.json()).intakeId, staged.intakeId);
  const discardUpload = await fetch(`${base}/api/projects/${PROJECT_ID}/source-intakes`, {
    method: 'POST',
    headers: {
      ...headers,
      'content-type': 'image/png',
      'x-numberdroid-idempotency-key': 'http-intake.discard-upload',
      'x-numberdroid-source-origin': 'human_upload',
    },
    body: bytes,
  }).then((response) => response.json());
  const abandon = () => fetch(`${base}/api/projects/${PROJECT_ID}/source-intakes/${discardUpload.intakeId}/abandon`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ idempotencyKey: 'http-intake.discard' }),
  });
  assert.equal((await abandon()).status, 200);
  const abandonReplay = await abandon();
  assert.equal(abandonReplay.status, 200);
  assert.equal((await abandonReplay.json()).replayed, true);
  const listedIntakes = await fetch(`${base}/api/projects/${PROJECT_ID}/source-intakes`).then((response) => response.json());
  assert.equal(listedIntakes.intakes.find((intake) => intake.intakeId === discardUpload.intakeId).state, 'ABANDONED');

  const malformed = await fetch(`${base}/api/projects/${PROJECT_ID}/source-intakes`, {
    method: 'POST',
    headers: {
      ...headers,
      'content-type': 'image/png',
      'x-numberdroid-idempotency-key': 'http-intake.malformed',
    },
    body: Buffer.from('not-an-image'),
  });
  assert.equal(malformed.status, 400);
  const overDimensions = await fetch(`${base}/api/projects/${PROJECT_ID}/source-intakes`, {
    method: 'POST',
    headers: {
      ...headers,
      'content-type': 'image/png',
      'x-numberdroid-idempotency-key': 'http-intake.dimensions',
    },
    body: pngHeader({ width: 4097, height: 1 }),
  });
  assert.equal(overDimensions.status, 400);
  assert.equal((await overDimensions.json()).error.code, 'ARTIFACT_DIMENSIONS_EXCEEDED');
  async function* oversizedChunks() {
    yield Buffer.alloc(16 * 1024 * 1024);
    yield Buffer.alloc(1);
  }
  const oversized = await fetch(`${base}/api/projects/${PROJECT_ID}/source-intakes`, {
    method: 'POST',
    headers: {
      ...headers,
      'content-type': 'image/png',
      'x-numberdroid-idempotency-key': 'http-intake.chunked-oversize',
    },
    body: oversizedChunks(),
    duplex: 'half',
  });
  assert.equal(oversized.status, 413);
  assert.equal((await oversized.json()).error.code, 'ARTIFACT_TOO_LARGE');

  const committed = await fetch(`${base}/api/projects/${PROJECT_ID}/sources`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({
      expectedRevision: 2,
      idempotencyKey: 'http-source.family-hygiene',
      intakeId: staged.intakeId,
      sourceId: 'source.http-family-hygiene',
      name: 'HTTP Family Hygiene source',
      artifactUri: staged.artifact.uri,
      mediaType: staged.artifact.mediaType,
      byteSize: staged.artifact.byteSize,
      width: staged.artifact.width,
      height: staged.artifact.height,
      provenance: provenance('imported_generation'),
    }),
  });
  assert.equal(committed.status, 200);
  assert.equal((await committed.json()).revision, 3);
  const projected = await fetch(`${base}/api/projects/${PROJECT_ID}`).then((response) => response.json());
  assert.equal(projected.snapshot.sources[0].preview.state, 'READY');
  assert.equal(projected.snapshot.sources[0].preview.derivative, false);
  const previewResponse = await fetch(`${base}${projected.snapshot.sources[0].preview.resourceUri}`);
  assert.equal(previewResponse.headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.equal(previewResponse.headers.get('referrer-policy'), 'no-referrer');

  const proposed = await fetch(`${base}/api/projects/${PROJECT_ID}/sources/source.http-family-hygiene/review`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({
      expectedRevision: 3,
      idempotencyKey: 'http-review.propose',
      action: 'propose',
    }),
  });
  assert.equal(proposed.status, 200);
  const unconfirmed = await fetch(`${base}/api/projects/${PROJECT_ID}/sources/source.http-family-hygiene/review`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({
      expectedRevision: 4,
      idempotencyKey: 'http-review.decide',
      action: 'decide',
      disposition: 'APPROVED',
    }),
  });
  assert.equal(unconfirmed.status, 403);
  const rejectedWithoutNote = await fetch(`${base}/api/projects/${PROJECT_ID}/sources/source.http-family-hygiene/review`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({
      expectedRevision: 4,
      idempotencyKey: 'http-review.reject-without-note',
      action: 'decide',
      disposition: 'REJECTED',
      confirm: true,
    }),
  });
  assert.equal(rejectedWithoutNote.status, 400);
  const approved = await fetch(`${base}/api/projects/${PROJECT_ID}/sources/source.http-family-hygiene/review`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({
      expectedRevision: 4,
      idempotencyKey: 'http-review.decide',
      action: 'decide',
      disposition: 'APPROVED',
      confirm: true,
    }),
  });
  assert.equal(approved.status, 200);
  assert.equal((await approved.json()).revision, 5);

  const secretSentinel = 'private-prompt-path-uri-token-sentinel';
  const denied = await fetch(`${base}/internal/mcp/execute`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${binding.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      schemaVersion: 1,
      command: {
        schemaVersion: 1,
        commandId: 'cmd.audit.denied',
        idempotencyKey: secretSentinel,
        type: 'source.review.propose',
        projectId: PROJECT_ID,
        baseRevision: 5,
        expectedVersion: 5,
        payload: { sourceId: 'source.http-family-hygiene', note: secretSentinel },
      },
    }),
  });
  assert.equal(denied.status, 409);
  const rowJson = JSON.stringify(store.workspace.database.prepare(`
    SELECT * FROM agent_attempts WHERE command_id = 'cmd.audit.denied'
  `).get());
  assert.doesNotMatch(rowJson, new RegExp(secretSentinel));
  assert.doesNotMatch(rowJson, /grant\.atlas|Bearer|studio:\/\/|\/workspace/);
  const activity = await fetch(`${base}/api/projects/${PROJECT_ID}/activity`).then((response) => response.json());
  const deniedEvent = activity.events.find((event) => event.commandId === 'cmd.audit.denied');
  assert.equal(deniedEvent.status, 'denied');
  assert.equal(deniedEvent.summary, 'Agent command denied: DRAFT_BRANCH_NOT_AVAILABLE_1B.');
});

test('approved Family Hygiene source survives intake, original preview, review, and reopen byte-identically', async (context) => {
  const bytes = await readFile(FAMILY_HYGIENE_SOURCE);
  assert.equal(bytes.byteLength, 2_720_519);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), FAMILY_HYGIENE_DIGEST);
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-family-hygiene-e2e-'));
  const filename = join(directory, 'studio.sqlite');
  let store = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  let { studio } = createHarness(store);
  await createProject(studio);
  const artifacts = new ContentAddressedArtifactStore({ rootDirectory: join(directory, 'artifacts') });
  let server = createStudioHttpServer({
    studioService: studio,
    artifactStore: artifacts,
    artifactMetadataStore: new SqliteArtifactMetadataStore({ workspace: store.workspace }),
    sourceIntakeStore: new SqliteSourceIntakeStore({ workspace: store.workspace }),
    agentAttemptStore: new SqliteAgentAttemptStore({ workspace: store.workspace }),
  });
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  afterTestCleanup(context, async () => {
    if (server) await new Promise((resolveClose) => server.close(resolveClose));
    store?.close();
    await rm(directory, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const session = await fetch(`${base}/api/ui-session`).then((response) => response.json());
  const headers = {
    origin: base,
    'sec-fetch-site': 'same-origin',
    'x-numberdroid-studio-csrf': session.csrfToken,
  };
  const uploadResponse = await fetch(`${base}/api/projects/${PROJECT_ID}/source-intakes`, {
    method: 'POST',
    headers: {
      ...headers,
      'content-type': 'image/png',
      'x-numberdroid-idempotency-key': 'family-hygiene.upload',
      'x-numberdroid-source-origin': 'human_upload',
      'x-numberdroid-expected-sha256': FAMILY_HYGIENE_DIGEST,
    },
    body: bytes,
  });
  assert.equal(uploadResponse.status, 201);
  const intake = await uploadResponse.json();
  assert.deepEqual(
    { digest: intake.artifact.digest, byteSize: intake.artifact.byteSize, width: intake.artifact.width, height: intake.artifact.height },
    { digest: FAMILY_HYGIENE_DIGEST, byteSize: 2_720_519, width: 1254, height: 1254 },
  );
  const commitResponse = await fetch(`${base}/api/projects/${PROJECT_ID}/sources`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({
      expectedRevision: 1,
      idempotencyKey: 'family-hygiene.commit',
      intakeId: intake.intakeId,
      sourceId: 'source.family-hygiene-approved',
      name: 'Family Hygiene floor 2×2',
      artifactUri: intake.artifact.uri,
      mediaType: intake.artifact.mediaType,
      byteSize: intake.artifact.byteSize,
      width: intake.artifact.width,
      height: intake.artifact.height,
      provenance: provenance(),
    }),
  });
  assert.equal(commitResponse.status, 200);
  const projected = await fetch(`${base}/api/projects/${PROJECT_ID}`).then((response) => response.json());
  const originalSource = projected.snapshot.sources[0];
  assert.equal(originalSource.byteSize, 2_720_519);
  assert.equal(originalSource.preview.derivative, false);
  const preview = await fetch(`${base}${originalSource.preview.resourceUri}`);
  const previewBytes = Buffer.from(await preview.arrayBuffer());
  assert.equal(previewBytes.byteLength, bytes.byteLength);
  assert.equal(createHash('sha256').update(previewBytes).digest('hex'), FAMILY_HYGIENE_DIGEST);
  for (const [expectedRevision, action, extra, key] of [
    [2, 'propose', {}, 'family-hygiene.propose'],
    [3, 'decide', { disposition: 'APPROVED', confirm: true, note: 'Approved source fixture.' }, 'family-hygiene.approve'],
  ]) {
    const response = await fetch(`${base}/api/projects/${PROJECT_ID}/sources/${originalSource.id}/review`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ expectedRevision, idempotencyKey: key, action, ...extra }),
    });
    assert.equal(response.status, 200);
  }
  const beforeRestart = await studio.readProjectTrusted(PROJECT_ID);
  assert.equal(beforeRestart.revision, 4);
  await new Promise((resolveClose) => server.close(resolveClose));
  server = null;
  store.close();
  store = null;
  store = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  studio = new StudioService({ store });
  const afterRestart = await studio.readProjectTrusted(PROJECT_ID);
  assert.equal(afterRestart.revision, 4);
  assert.deepEqual(afterRestart.snapshot.sources[0], beforeRestart.snapshot.sources[0]);
});

test('migration 0006 resumes after a version-boundary fault and backup/restore preserves intake and audit state', async (context) => {
  const migrationDirectory = await mkdtemp(join(tmpdir(), 'numberdroid-checkpoint-2a-migration-'));
  const migrationFilename = join(migrationDirectory, 'studio.sqlite');
  afterTestCleanup(context, () => rm(migrationDirectory, { recursive: true, force: true }));
  await assert.rejects(SqliteProjectStore.open({
    filename: migrationFilename,
    databaseFactory: nodeSqliteDatabaseFactory,
    faultInjector(point) {
      if (point === 'after_migration_6') throw new Error('migration 0006 boundary fault');
    },
  }), /migration 0006 boundary fault/);
  const { DatabaseSync } = await import('node:sqlite');
  const interrupted = new DatabaseSync(migrationFilename);
  assert.equal(Number(interrupted.prepare('PRAGMA user_version').get().user_version), 5);
  assert.equal(interrupted.prepare(`
    SELECT count(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'source_intakes'
  `).get().count, 0);
  interrupted.close();
  const resumed = await SqliteProjectStore.open({
    filename: migrationFilename,
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  assert.equal(resumed.integrityCheck().userVersion, 11);
  resumed.close();

  const { directory, store, studio, artifact, artifacts } = await fixture(context);
  const lineage = await artifacts.ingest(pngHeader({ width: 6, height: 6, tail: 'backup-lineage' }), { mediaType: 'image/png' });
  new SqliteArtifactMetadataStore({ workspace: store.workspace }).registerAndReference(lineage, {
    projectId: PROJECT_ID,
    ownerKind: 'upload',
    ownerId: 'upload.backup-lineage',
    createdRevision: 2,
  });
  const backupProvenance = provenance();
  backupProvenance.referenceArtifactUris = [lineage.uri];
  await studio.execute(intakeCommand(artifact, {
    payload: { ...intakeCommand(artifact).payload, provenance: backupProvenance },
  }), AGENT_CONTEXT);
  const attempts = new SqliteAgentAttemptStore({ workspace: store.workspace });
  attempts.recordFailure({
    attemptId: 'attempt.backup-denied',
    projectId: PROJECT_ID,
    correlationId: 'mcp.backup-denied',
    actorId: AGENT_CONTEXT.actor.id,
    taskId: AGENT_CONTEXT.taskId,
    branchId: AGENT_CONTEXT.branchId,
    commandId: 'cmd.backup-denied',
    commandType: 'source.review.propose',
    targetId: PROJECT_ID,
    observedRevision: 3,
    status: 'DENIED',
    errorCode: 'GRANT_SCOPE_MISSING',
    details: { requiredScope: 'source.review.propose' },
  });
  const integrity = await verifyWorkspaceIntegrity({ projectStore: store, artifactStore: artifacts });
  assert.equal(integrity.ok, true, JSON.stringify(integrity));
  assert.equal(integrity.sourceIntakes.count, 1);
  assert.equal(integrity.agentAttempts.count, 1);

  const backupDirectory = join(directory, 'checkpoint-2a-backup');
  await createWorkspaceBackup({
    projectStore: store,
    artifactStore: artifacts,
    destinationDirectory: backupDirectory,
    clock: () => '2026-08-21T12:10:00.000Z',
  });
  assert.equal((await verifyWorkspaceBackup(backupDirectory)).ok, true);
  const restoredDatabase = join(directory, 'restored', 'studio.sqlite');
  const restoredArtifacts = join(directory, 'restored', 'artifacts');
  await restoreWorkspaceBackup({
    backupDirectory,
    databaseDestination: restoredDatabase,
    artifactDestination: restoredArtifacts,
  });
  const restored = await SqliteProjectStore.open({
    filename: restoredDatabase,
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  afterTestCleanup(context, () => restored.close());
  assert.equal(restored.workspace.database.prepare(`
    SELECT state FROM source_intakes WHERE intake_id = 'intake.family-hygiene'
  `).get().state, 'CLAIMED');
  assert.equal(restored.workspace.database.prepare(`
    SELECT status FROM agent_attempts WHERE attempt_id = 'attempt.backup-denied'
  `).get().status, 'DENIED');
  assert.equal(restored.workspace.database.prepare(`
    SELECT count(*) AS count FROM artifact_references
    WHERE owner_kind = 'source_lineage' AND owner_id = 'source.family-hygiene' AND digest = ?
  `).get(lineage.digest).count, 1);
  const restoredCas = new ContentAddressedArtifactStore({ rootDirectory: restoredArtifacts });
  assert.equal((await verifyWorkspaceIntegrity({ projectStore: restored, artifactStore: restoredCas })).ok, true);
});
