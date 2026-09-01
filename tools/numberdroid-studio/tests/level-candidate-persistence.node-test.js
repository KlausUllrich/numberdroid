import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  AgentTaskService,
  StudioService,
} from '../packages/application/src/index.js';
import { fingerprint } from '../packages/application/src/value-utils.js';
import {
  createTaskCandidateDiff,
  createTaskCandidatePayload,
  createTaskCandidatePreview,
  createTaskCandidateSubmission,
  listA4cGrantScopes,
  validateCandidateManifest,
} from '../packages/domain/src/index.js';
import {
  NUMBERDROID_A4B_PROJECT_CAPABILITY_FINGERPRINT,
  NUMBERDROID_A4B_PROJECT_CAPABILITY_MANIFEST,
} from '../packages/numberdroid-adapter/src/index.js';
import {
  ContentAddressedArtifactStore,
  SqliteAgentTaskStore,
  SqliteLevelCandidateStore,
  SqliteProjectStore,
  TaskBranchProjectStore,
  projectSqlitePortableDocument,
  verifyWorkspaceIntegrity,
} from '../packages/persistence/src/index.js';
import { AGENT, OWNER_CONTEXT, PROJECT_ID, createProject } from './test-helpers.js';
import { afterTestCleanup, nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';

const COMPILER_VERSION = 'numberdroid-level-compiler.sha256:01b144303ff217054f01c0dcd85acc3d442a02c1727ad9b01291dcc5c2559ce1';
const BRIDGE = Object.freeze({ id: 'numberdroid.level-candidate-validator', version: 'numberdroid.a4c-bridge.v1' });

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

function canonicalJson(value) {
  return `${JSON.stringify(canonical(value), null, 2)}\n`;
}

function output(logicalPath, role, content) {
  return { logicalPath, mediaType: 'application/json', byteSize: Buffer.byteLength(content), sha256: sha256(content), role, content };
}

function candidateFixture({ projectId, taskId, branchId, baseRevision, branchHeadRevision, idempotencyKey }) {
  const source = output('candidate/levels/a4b-key-reference/level-spec.json', 'level-source', '{\n  "id": "a4b-key-reference"\n}\n');
  const plan = output('candidate/levels/a4b-key-reference/semantic-plan.json', 'compiled-plan', '{\n  "status": "compiled"\n}\n');
  const outputs = [source, plan].sort((left, right) => left.logicalPath.localeCompare(right.logicalPath));
  const descriptors = outputs.map(({ content: _content, ...descriptor }) => descriptor);
  const outputClosure = sha256(canonicalJson(descriptors));
  const projectionFingerprint = sha256('fixture-projection');
  const manifest = validateCandidateManifest({
    schemaVersion: 1,
    kind: 'studio.candidate-manifest',
    status: 'VERIFIED',
    project: { projectId, revision: branchHeadRevision },
    snapshot: { snapshotId: projectionFingerprint },
    capabilityProfile: {
      profileId: NUMBERDROID_A4B_PROJECT_CAPABILITY_MANIFEST.profileId,
      profileVersion: NUMBERDROID_A4B_PROJECT_CAPABILITY_MANIFEST.profileVersion,
      fingerprint: NUMBERDROID_A4B_PROJECT_CAPABILITY_FINGERPRINT,
    },
    adapter: { id: 'numberdroid', version: 'numberdroid-studio.adapter.v1', candidateHash: outputClosure },
    compiler: { id: 'numberdroid.level-compiler', version: COMPILER_VERSION, status: 'SUCCEEDED', evidenceHash: plan.sha256 },
    semanticRevisions: [{ kind: 'level-spec', id: 'a4b-key-reference', revision: 2, fingerprint: source.sha256 }],
    requirements: [],
    recipes: [],
    artifacts: [],
    outputs: descriptors.map((descriptor) => ({ kind: 'file', ...descriptor })),
    findings: [],
    stages: { candidate: 'VERIFIED', materialize: 'NOT_AUTHORIZED', commit: 'NOT_AUTHORIZED', publish: 'NOT_AUTHORIZED' },
  });
  const candidate = createTaskCandidatePayload({ candidateManifest: manifest, outputs });
  const preview = createTaskCandidatePreview({
    candidateFingerprint: candidate.candidateFingerprint,
    title: 'A4b Level Candidate',
    summary: 'Portable preview only.',
    facts: [{ factId: 'level-spec', label: 'LevelSpec', value: 'a4b-key-reference@2' }],
    steps: [{
      sequence: 1,
      triggerKind: 'actor-defeated',
      triggerRef: 'trigger.guard-defeated',
      actionKind: 'drop-item',
      actionRef: 'action.drop-guard-key',
      targetRef: 'guard-key',
    }],
  });
  const diff = createTaskCandidateDiff({
    projectId,
    taskId,
    branchId,
    baseRevision,
    branchHeadRevision,
    candidateFingerprint: candidate.candidateFingerprint,
    changes: [{ changeId: 'level-candidate:a4b-key-reference', operation: 'ADD', objectKind: 'level-candidate', objectRef: 'a4b-key-reference', summary: 'Add A4b candidate.' }],
    outputs: outputs.map(({ logicalPath, sha256: afterSha256 }) => ({ logicalPath, operation: 'ADD', beforeSha256: null, afterSha256 })),
  });
  const idempotencyKeyHash = sha256(idempotencyKey);
  const taskBoundKeyHash = sha256(`${taskId}\0${idempotencyKeyHash}`);
  const submission = createTaskCandidateSubmission({
    submissionId: `candidate:${taskBoundKeyHash}`,
    idempotencyKeyHash,
    projectId,
    taskId,
    branchId,
    baseRevision,
    branchHeadRevision,
    projectionFingerprint,
    candidate,
    preview,
    diff,
    compilerPins: [
      { id: 'numberdroid.level-compiler', version: COMPILER_VERSION, evidenceHash: plan.sha256 },
      { id: 'numberdroid.level-authoring-projection', version: 'numberdroid.level-authoring-projection.v2', evidenceHash: projectionFingerprint },
    ],
    engineBridgeReceipt: {
      schemaVersion: 1,
      kind: 'studio.engine-bridge.validation-receipt',
      status: 'VALIDATED',
      bridge: BRIDGE,
      candidateFingerprint: candidate.candidateFingerprint,
      evidenceHash: candidate.candidateFingerprint,
    },
  });
  const configuredBinding = {
    composer: {
      sourceId: 'a4b-key-reference',
      sourceVersion: 2,
      sourceSha256: source.sha256,
      compilerVersion: COMPILER_VERSION,
      planSha256: plan.sha256,
      projectionVersion: 'numberdroid.level-authoring-projection.v2',
      projectionFingerprint,
      profileId: NUMBERDROID_A4B_PROJECT_CAPABILITY_MANIFEST.profileId,
      profileVersion: 3,
      profileFingerprint: NUMBERDROID_A4B_PROJECT_CAPABILITY_FINGERPRINT,
      adapterId: 'numberdroid',
      adapterVersion: 'numberdroid-studio.adapter.v1',
      outputPaths: outputs.map(({ logicalPath }) => logicalPath),
    },
    capabilityManifestFingerprint: NUMBERDROID_A4B_PROJECT_CAPABILITY_FINGERPRINT,
    engineBridge: BRIDGE,
  };
  const sourceDescriptor = {
    schemaVersion: 1,
    kind: 'numberdroid.a4c-level-candidate-source',
    sourceId: 'a4b-key-reference',
    sourceVersion: 2,
    logicalPath: source.logicalPath,
    mediaType: source.mediaType,
    byteSize: source.byteSize,
    sha256: source.sha256,
    content: source.content,
  };
  return { submission, configuredBinding, idempotencyKeyHash, taskBoundKeyHash, sourceDescriptor };
}

async function fixture(context, {
  capabilities = ['project.read', 'source.write', 'level.candidate.create'],
} = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-a4c-candidate-'));
  afterTestCleanup(context, () => rm(directory, { recursive: true, force: true }));
  let faultPoint = null;
  const projectStore = await SqliteProjectStore.open({
    filename: join(directory, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
    faultInjector(point) { if (point === faultPoint) throw new Error(`fault:${point}`); },
  });
  afterTestCleanup(context, () => projectStore.close());
  const artifactStore = new ContentAddressedArtifactStore({ rootDirectory: join(directory, 'artifacts') });
  await artifactStore.initialize();
  const grantScopes = listA4cGrantScopes();
  const clock = () => '2026-09-01T12:00:00.000Z';
  const studio = new StudioService({ store: projectStore, clock, agentAttemptAuditReady: true, grantScopes });
  await createProject(studio);
  const taskStore = new SqliteAgentTaskStore({ workspace: projectStore.workspace });
  const tasks = new AgentTaskService({
    studioService: studio,
    projectStore,
    taskStore,
    createBranchStore: ({ projectId, taskId }) => new TaskBranchProjectStore({ taskStore, projectId, taskId }),
    clock,
    grantScopes,
  });
  const created = await tasks.createTask({
    projectId: PROJECT_ID,
    task: {
      taskId: 'task.a4c.candidate',
      branchId: 'branch.task.a4c.candidate',
      agentId: AGENT.id,
      title: 'A4c candidate',
      objective: 'Build one immutable A4b candidate.',
      capabilities,
      objectScopes: [{ kind: 'project', id: PROJECT_ID }],
      budget: { maxCommands: 1, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 },
      expiresAt: '2026-09-01T13:00:00.000Z',
      autoAcceptPolicy: { enabled: false, allowedCommandTypes: [], maxChanges: 0 },
    },
  }, OWNER_CONTEXT);
  const trustedContext = {
    actor: AGENT,
    taskId: created.task.taskId,
    branchId: created.task.branchId,
    grantId: created.task.grantId,
  };
  const initial = taskStore.getTask(PROJECT_ID, created.task.taskId);
  const candidate = candidateFixture({
    projectId: PROJECT_ID,
    taskId: initial.taskId,
    branchId: initial.branchId,
    baseRevision: initial.baseRevision,
    branchHeadRevision: initial.baseRevision + 1,
    idempotencyKey: 'idem.a4c.submit',
  });
  const store = new SqliteLevelCandidateStore({ workspace: projectStore.workspace, configuredBinding: candidate.configuredBinding });
  const requestFingerprint = sha256('request.a4c.submit');
  const identity = {
    projectId: PROJECT_ID,
    taskId: initial.taskId,
    branchId: initial.branchId,
    actorId: AGENT.id,
    grantId: initial.grantId,
    submissionId: candidate.submission.submissionId,
    idempotencyKeyHash: candidate.idempotencyKeyHash,
    requestFingerprint,
  };
  const current = taskStore.getTask(PROJECT_ID, created.task.taskId);
  const input = {
    identity,
    expectedBaseRevision: initial.baseRevision,
    expectedBranchHeadRevision: initial.baseRevision,
    reviewId: `review:${candidate.taskBoundKeyHash}`,
    source: candidate.sourceDescriptor,
    submission: candidate.submission,
    configuredBinding: candidate.configuredBinding,
    trustedContext,
    now: clock(),
  };
  return {
    projectStore, artifactStore, taskStore, tasks, store, initial, current, input,
    setFault(point) { faultPoint = point; },
  };
}

test('A4c Candidate submit atomically creates one source head and a PENDING-only review while leaving main unchanged', async (context) => {
  const { projectStore, artifactStore, taskStore, tasks, store, current, input } = await fixture(context);
  const mainBefore = await projectStore.loadProject(PROJECT_ID);
  const branchBefore = taskStore.loadBranchDocument(PROJECT_ID, current.taskId);
  const taskUsageBefore = structuredClone(current.usage);
  const grantUsageBefore = projectStore.workspace.database.prepare(`
    SELECT usage_json FROM grants WHERE project_id = ? AND grant_id = ?
  `).get(PROJECT_ID, current.grantId).usage_json;
  const created = store.submitCandidate(input);
  assert.equal(created.replayed, false);
  assert.equal(created.result.status, 'WAITING_FOR_HUMAN_REVIEW');
  assert.equal(created.result.message, 'Waiting for your review');
  assert.equal(taskStore.getTask(PROJECT_ID, current.taskId).state, 'IN_REVIEW');
  assert.equal(taskStore.getTask(PROJECT_ID, current.taskId).headRevision, current.headRevision + 1);
  assert.deepEqual(taskStore.getTask(PROJECT_ID, current.taskId).usage, {
    ...taskUsageBefore, commands: taskUsageBefore.commands + 1,
  });
  assert.equal(projectStore.workspace.database.prepare(`
    SELECT usage_json FROM grants WHERE project_id = ? AND grant_id = ?
  `).get(PROJECT_ID, current.grantId).usage_json, grantUsageBefore);
  assert.equal(taskStore.loadBranchDocument(PROJECT_ID, current.taskId).revisions.length, branchBefore.revisions.length + 1);
  assert.equal(taskStore.listBranchRevisions(PROJECT_ID, current.taskId).length, 1);
  assert.deepEqual(await projectStore.loadProject(PROJECT_ID), mainBefore);
  const review = taskStore.getReview(PROJECT_ID, current.taskId, input.reviewId);
  assert.equal(review.kind, 'studio.level-candidate-review');
  assert.equal(review.state, 'OPEN');
  assert.equal(review.items.length, 1);
  assert.ok(review.items.every(({ disposition }) => disposition === 'PENDING'));
  assert.equal(taskStore.listTimeline(PROJECT_ID, current.taskId).filter(({ type }) => type === 'REVIEW_SUBMITTED').length, 1);
  assert.equal(tasks.readTask(PROJECT_ID, current.taskId).task.effectiveState, 'IN_REVIEW');
  await assert.rejects(
    tasks.decideReview(PROJECT_ID, current.taskId, input.reviewId, [{
      changeId: review.items[0].changeId,
      disposition: 'USER_ACCEPTED',
      reason: 'Not authorized.',
    }], { actorId: OWNER_CONTEXT.actor.id }),
    (error) => error.code === 'LEVEL_CANDIDATE_REVIEW_DECISION_FORBIDDEN',
  );
  await assert.rejects(
    tasks.mergeReview(PROJECT_ID, current.taskId, input.reviewId, { mergeId: 'merge.a4c.forbidden', actorId: OWNER_CONTEXT.actor.id }),
    (error) => error.code === 'LEVEL_CANDIDATE_MERGE_FORBIDDEN',
  );
  const replayed = store.submitCandidate(input);
  assert.equal(replayed.replayed, true);
  assert.deepEqual(replayed.submission, created.submission);
  assert.equal(taskStore.listTimeline(PROJECT_ID, current.taskId).filter(({ type }) => type === 'REVIEW_SUBMITTED').length, 1);
  assert.equal((await verifyWorkspaceIntegrity({ projectStore, artifactStore })).tasks.ok, true);
});

for (const faultPoint of [
  'after_level_candidate_source_revision',
  'after_level_candidate_source_task',
  'after_level_candidate_source_timeline',
  'before_level_candidate_source_commit',
]) {
  test(`A4c atomic Candidate commit rolls back its source stage fully at ${faultPoint}`, async (context) => {
    const { projectStore, taskStore, store, initial, input, setFault } = await fixture(context);
    const mainBefore = await projectStore.loadProject(PROJECT_ID);
    const branchBefore = taskStore.loadBranchDocument(PROJECT_ID, initial.taskId);
    setFault(faultPoint);
    assert.throws(() => store.submitCandidate(input), new RegExp(`fault:${faultPoint}`));
    setFault(null);
    assert.equal(Number(projectStore.workspace.database.prepare('SELECT COUNT(*) AS count FROM task_branch_revisions').get().count), 0);
    assert.equal(Number(projectStore.workspace.database.prepare('SELECT COUNT(*) AS count FROM task_level_candidate_submissions').get().count), 0);
    assert.deepEqual(taskStore.getTask(PROJECT_ID, initial.taskId).usage, initial.usage);
    assert.equal(taskStore.getReview(PROJECT_ID, initial.taskId), null);
    assert.deepEqual(taskStore.loadBranchDocument(PROJECT_ID, initial.taskId), branchBefore);
    assert.deepEqual(await projectStore.loadProject(PROJECT_ID), mainBefore);
  });
}

test('A4c source-only state blocks generic review, decision, and merge paths without effects', async (context) => {
  const { projectStore, taskStore, tasks, store, current, input } = await fixture(context);
  store.submitCandidate(input);
  const database = projectStore.workspace.database;
  database.exec('DROP TRIGGER task_level_candidate_submissions_delete_forbidden');
  database.prepare('DELETE FROM task_level_candidate_submissions WHERE project_id = ? AND task_id = ?')
    .run(PROJECT_ID, current.taskId);
  database.prepare('DELETE FROM task_reviews WHERE project_id = ? AND task_id = ?')
    .run(PROJECT_ID, current.taskId);
  database.prepare("DELETE FROM task_timeline_events WHERE project_id = ? AND task_id = ? AND event_type = 'REVIEW_SUBMITTED'")
    .run(PROJECT_ID, current.taskId);
  const sourceOnlyTask = taskStore.getTask(PROJECT_ID, current.taskId);
  const activeTask = { ...sourceOnlyTask, state: 'ACTIVE', stateReason: null, updatedAt: input.now };
  database.prepare(`
    UPDATE agent_tasks SET state = 'ACTIVE', updated_at = ?, task_json = ?
    WHERE project_id = ? AND task_id = ?
  `).run(input.now, JSON.stringify(activeTask), PROJECT_ID, current.taskId);
  const mainBefore = await projectStore.loadProject(PROJECT_ID);
  const taskBefore = taskStore.getTask(PROJECT_ID, current.taskId);
  const branchBefore = taskStore.loadBranchDocument(PROJECT_ID, current.taskId);
  const timelineBefore = taskStore.listTimeline(PROJECT_ID, current.taskId);

  await assert.rejects(
    tasks.submitOwnReview(PROJECT_ID, 'review.a4c.agent.generic-forbidden', input.trustedContext),
    (error) => error.code === 'LEVEL_CANDIDATE_GENERIC_REVIEW_FORBIDDEN',
  );
  await assert.rejects(
    tasks.submitReview(PROJECT_ID, current.taskId, {
      reviewId: 'review.a4c.owner.generic-forbidden', actorId: OWNER_CONTEXT.actor.id,
    }),
    (error) => error.code === 'LEVEL_CANDIDATE_GENERIC_REVIEW_FORBIDDEN',
  );
  assert.equal(taskStore.getReview(PROJECT_ID, current.taskId), null);
  assert.deepEqual(taskStore.getTask(PROJECT_ID, current.taskId), taskBefore);
  assert.deepEqual(taskStore.loadBranchDocument(PROJECT_ID, current.taskId), branchBefore);
  assert.deepEqual(taskStore.listTimeline(PROJECT_ID, current.taskId), timelineBefore);
  assert.deepEqual(await projectStore.loadProject(PROJECT_ID), mainBefore);

  const legacyReview = {
    schemaVersion: 1,
    reviewId: 'review.a4c.legacy-generic',
    reviewVersion: 1,
    projectId: PROJECT_ID,
    taskId: current.taskId,
    branchId: current.branchId,
    baseRevision: current.baseRevision,
    branchHeadRevision: current.headRevision + 1,
    comparedMainRevision: mainBefore.revisions.at(-1).number,
    state: 'OPEN',
    items: [],
    conflicts: [],
    createdAt: input.now,
    createdBy: OWNER_CONTEXT.actor.id,
  };
  database.prepare(`
    INSERT INTO task_reviews(project_id, task_id, review_id, review_version, state, created_at, review_json)
    VALUES (?, ?, ?, 1, 'OPEN', ?, ?)
  `).run(PROJECT_ID, current.taskId, legacyReview.reviewId, input.now, JSON.stringify(legacyReview));
  const inReviewTask = { ...taskBefore, state: 'IN_REVIEW', updatedAt: input.now };
  database.prepare(`
    UPDATE agent_tasks SET state = 'IN_REVIEW', updated_at = ?, task_json = ?
    WHERE project_id = ? AND task_id = ?
  `).run(input.now, JSON.stringify(inReviewTask), PROJECT_ID, current.taskId);
  const persistedBefore = {
    task: taskStore.getTask(PROJECT_ID, current.taskId),
    review: taskStore.getReview(PROJECT_ID, current.taskId, legacyReview.reviewId),
    timeline: taskStore.listTimeline(PROJECT_ID, current.taskId),
    main: await projectStore.loadProject(PROJECT_ID),
  };
  await assert.rejects(
    tasks.decideReview(PROJECT_ID, current.taskId, legacyReview.reviewId, [], {
      actorId: OWNER_CONTEXT.actor.id,
    }),
    (error) => error.code === 'LEVEL_CANDIDATE_REVIEW_DECISION_FORBIDDEN',
  );
  await assert.rejects(
    tasks.mergeReview(PROJECT_ID, current.taskId, legacyReview.reviewId, {
      mergeId: 'merge.a4c.legacy-generic-forbidden', actorId: OWNER_CONTEXT.actor.id,
    }),
    (error) => error.code === 'LEVEL_CANDIDATE_MERGE_FORBIDDEN',
  );
  assert.deepEqual(taskStore.getTask(PROJECT_ID, current.taskId), persistedBefore.task);
  assert.deepEqual(taskStore.getReview(PROJECT_ID, current.taskId, legacyReview.reviewId), persistedBefore.review);
  assert.deepEqual(taskStore.listTimeline(PROJECT_ID, current.taskId), persistedBefore.timeline);
  assert.deepEqual(await projectStore.loadProject(PROJECT_ID), persistedBefore.main);
  assert.equal(taskStore.getMergeForTask(PROJECT_ID, current.taskId), null);
});

test('A4c workspace integrity detects a tampered Candidate ledger closure', async (context) => {
  const { projectStore, artifactStore, store, input } = await fixture(context);
  store.submitCandidate(input);
  const database = projectStore.workspace.database;
  database.exec('DROP TRIGGER task_level_candidate_submissions_immutable');
  const row = database.prepare(`
    SELECT result_json FROM task_level_candidate_submissions
    WHERE project_id = ? AND task_id = ?
  `).get(PROJECT_ID, input.identity.taskId);
  const result = JSON.parse(row.result_json);
  result.message = 'Tampered';
  database.prepare(`
    UPDATE task_level_candidate_submissions SET result_json = ?
    WHERE project_id = ? AND task_id = ?
  `).run(JSON.stringify(result), PROJECT_ID, input.identity.taskId);
  const integrity = await verifyWorkspaceIntegrity({ projectStore, artifactStore });
  assert.equal(integrity.tasks.ok, false);
  assert.ok(integrity.tasks.findings.some(({ code }) => code === 'TASK_LEVEL_CANDIDATE_SEMANTIC_MISMATCH'));
});

test('A4c integrity rejects re-signed configured-binding tamper and derived-review tamper', async (context) => {
  const bindingTamper = await fixture(context);
  bindingTamper.store.submitCandidate(bindingTamper.input);
  const bindingDb = bindingTamper.projectStore.workspace.database;
  bindingDb.exec('DROP TRIGGER task_level_candidate_submissions_immutable');
  const bindingRow = bindingDb.prepare(`
    SELECT configured_binding_json, aggregate_json FROM task_level_candidate_submissions
    WHERE project_id = ? AND task_id = ?
  `).get(PROJECT_ID, bindingTamper.input.identity.taskId);
  const configuredBinding = JSON.parse(bindingRow.configured_binding_json);
  const aggregate = JSON.parse(bindingRow.aggregate_json);
  configuredBinding.engineBridge.id = 'tampered.bridge';
  aggregate.configuredBinding = configuredBinding;
  delete aggregate.fingerprint;
  aggregate.fingerprint = fingerprint(aggregate);
  bindingDb.prepare(`
    UPDATE task_level_candidate_submissions SET configured_binding_json = ?, aggregate_json = ?
    WHERE project_id = ? AND task_id = ?
  `).run(JSON.stringify(configuredBinding), JSON.stringify(aggregate), PROJECT_ID, bindingTamper.input.identity.taskId);
  const bindingIntegrity = await verifyWorkspaceIntegrity({
    projectStore: bindingTamper.projectStore,
    artifactStore: bindingTamper.artifactStore,
  });
  assert.equal(bindingIntegrity.tasks.ok, false);

  const reviewTamper = await fixture(context);
  reviewTamper.store.submitCandidate(reviewTamper.input);
  const reviewDb = reviewTamper.projectStore.workspace.database;
  reviewDb.exec('DROP TRIGGER task_reviews_immutable');
  const reviewRow = reviewDb.prepare(`
    SELECT review_json FROM task_reviews WHERE project_id = ? AND task_id = ?
  `).get(PROJECT_ID, reviewTamper.input.identity.taskId);
  const review = JSON.parse(reviewRow.review_json);
  review.items[0].summary = 'Rewritten review summary';
  reviewDb.prepare(`
    UPDATE task_reviews SET review_json = ? WHERE project_id = ? AND task_id = ?
  `).run(JSON.stringify(review), PROJECT_ID, reviewTamper.input.identity.taskId);
  const reviewIntegrity = await verifyWorkspaceIntegrity({
    projectStore: reviewTamper.projectStore,
    artifactStore: reviewTamper.artifactStore,
  });
  assert.equal(reviewIntegrity.tasks.ok, false);
  assert.ok(reviewIntegrity.tasks.findings.some(({ code }) => code === 'TASK_LEVEL_CANDIDATE_SEMANTIC_MISMATCH'));
});

test('A4c Candidate blocks non-quiescent bundle projection and remains excluded after terminal cancellation', async (context) => {
  const { projectStore, tasks, store, input } = await fixture(context);
  store.submitCandidate(input);
  assert.throws(() => projectSqlitePortableDocument({ projectStore, projectId: PROJECT_ID }),
    (error) => error.code === 'BUNDLE_NOT_QUIESCENT');
  await tasks.control(PROJECT_ID, input.identity.taskId, 'cancel', {
    actorId: OWNER_CONTEXT.actor.id,
    reason: 'End the private Candidate task without accepting or merging it.',
  });
  const projected = projectSqlitePortableDocument({ projectStore, projectId: PROJECT_ID });
  assert.doesNotMatch(JSON.stringify(projected), /level-candidate|candidate:|a4b-key-reference/);
});

test('A4c workspace integrity detects orphaned Candidate review and timeline state after forced deletion', async (context) => {
  const { projectStore, artifactStore, store, input } = await fixture(context);
  store.submitCandidate(input);
  const database = projectStore.workspace.database;
  database.exec('DROP TRIGGER task_level_candidate_submissions_delete_forbidden');
  database.prepare('DELETE FROM task_level_candidate_submissions WHERE project_id = ? AND task_id = ?')
    .run(PROJECT_ID, input.identity.taskId);
  const integrity = await verifyWorkspaceIntegrity({ projectStore, artifactStore });
  assert.equal(integrity.tasks.ok, false);
  assert.ok(integrity.tasks.findings.some(({ code }) => code === 'TASK_LEVEL_CANDIDATE_REVIEW_ORPHANED'));
  assert.ok(integrity.tasks.findings.some(({ code }) => code === 'TASK_LEVEL_CANDIDATE_TIMELINE_ORPHANED'));
});

for (const faultPoint of [
  'after_level_candidate_insert',
  'after_level_candidate_review',
  'after_level_candidate_task_transition',
  'after_level_candidate_timeline',
  'before_level_candidate_commit',
]) {
  test(`A4c Candidate submit rolls back fully at ${faultPoint}`, async (context) => {
    const { projectStore, taskStore, store, current, input, setFault } = await fixture(context);
    const mainBefore = await projectStore.loadProject(PROJECT_ID);
    const branchBefore = taskStore.loadBranchDocument(PROJECT_ID, current.taskId);
    setFault(faultPoint);
    assert.throws(() => store.submitCandidate(input), new RegExp(`fault:${faultPoint}`));
    setFault(null);
    assert.equal(Number(projectStore.workspace.database.prepare('SELECT COUNT(*) AS count FROM task_level_candidate_submissions').get().count), 0);
    assert.equal(taskStore.getReview(PROJECT_ID, current.taskId), null);
    assert.equal(taskStore.getTask(PROJECT_ID, current.taskId).state, 'ACTIVE');
    assert.equal(taskStore.listTimeline(PROJECT_ID, current.taskId).filter(({ type }) => type === 'REVIEW_SUBMITTED').length, 0);
    assert.deepEqual(taskStore.loadBranchDocument(PROJECT_ID, current.taskId), branchBefore);
    assert.deepEqual(await projectStore.loadProject(PROJECT_ID), mainBefore);
  });
}

test('A4c lost response resolves ledger-first after close and reopen without another effect', async (context) => {
  const { projectStore, store, current, input, setFault } = await fixture(context);
  const filename = projectStore.workspace.filename;
  setFault('after_level_candidate_commit');
  assert.throws(() => store.submitCandidate(input), /fault:after_level_candidate_commit/);
  setFault(null);
  projectStore.close();
  const reopenedProjectStore = await SqliteProjectStore.open({
    filename,
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  afterTestCleanup(context, () => reopenedProjectStore.close());
  const reopenedTaskStore = new SqliteAgentTaskStore({ workspace: reopenedProjectStore.workspace });
  const reopenedStore = new SqliteLevelCandidateStore({
    workspace: reopenedProjectStore.workspace,
    configuredBinding: input.configuredBinding,
  });
  const replayed = reopenedStore.submitCandidate(input);
  assert.equal(replayed.replayed, true);
  assert.equal(reopenedTaskStore.getTask(PROJECT_ID, current.taskId).state, 'IN_REVIEW');
  assert.equal(reopenedTaskStore.listTimeline(PROJECT_ID, current.taskId).filter(({ type }) => type === 'REVIEW_SUBMITTED').length, 1);
  assert.equal(Number(reopenedProjectStore.workspace.database.prepare(
    "SELECT COUNT(*) AS count FROM task_branch_revisions WHERE command_type = 'level.candidate.create'",
  ).get().count), 1);
});

test('A4c denies stale, cross-principal, revoked, and idempotency-collision submissions without writes', async (context) => {
  const { projectStore, taskStore, store, current, input } = await fixture(context);
  for (const [identityPatch, code] of [
    [{ actorId: 'agent.other' }, 'LEVEL_CANDIDATE_CONTEXT_MISMATCH'],
    [{ grantId: 'grant.other' }, 'LEVEL_CANDIDATE_CONTEXT_MISMATCH'],
    [{ branchId: 'branch.other' }, 'LEVEL_CANDIDATE_BINDING_MISMATCH'],
  ]) {
    assert.throws(() => store.submitCandidate({
      ...input,
      identity: { ...input.identity, ...identityPatch },
    }), (error) => error.code === code);
  }
  assert.equal(Number(projectStore.workspace.database.prepare('SELECT COUNT(*) AS count FROM task_level_candidate_submissions').get().count), 0);
  assert.equal(Number(projectStore.workspace.database.prepare('SELECT COUNT(*) AS count FROM task_branch_revisions').get().count), 0);
  projectStore.workspace.database.prepare(`
    UPDATE grants SET status = 'REVOKED', authorization_status = 'REVOKED', revoked_at = ?
    WHERE project_id = ? AND grant_id = ?
  `).run(input.now, PROJECT_ID, current.grantId);
  assert.throws(() => store.submitCandidate(input), (error) => error.code === 'GRANT_REVOKED');
  assert.equal(Number(projectStore.workspace.database.prepare('SELECT COUNT(*) AS count FROM task_level_candidate_submissions').get().count), 0);
  assert.equal(Number(projectStore.workspace.database.prepare('SELECT COUNT(*) AS count FROM task_branch_revisions').get().count), 0);

  projectStore.workspace.database.prepare(`
    UPDATE grants SET status = 'ACTIVE', authorization_status = 'ACTIVE', revoked_at = NULL
    WHERE project_id = ? AND grant_id = ?
  `).run(PROJECT_ID, current.grantId);
  store.submitCandidate(input);
  assert.throws(() => store.lookupReplay({ ...input.identity, branchId: 'branch.other' }),
    (error) => error.code === 'LEVEL_CANDIDATE_REPLAY_CONTEXT_MISMATCH');
  assert.throws(() => store.lookupReplay({ ...input.identity, requestFingerprint: sha256('different request') }),
    (error) => error.code === 'IDEMPOTENCY_CONFLICT');
  assert.equal(taskStore.listTimeline(PROJECT_ID, current.taskId).filter(({ type }) => type === 'REVIEW_SUBMITTED').length, 1);
});

test('A4c source authority denies missing scope, expired grant, and exhausted command budget', async (context) => {
  const missingScope = await fixture(context, {
    capabilities: ['project.read', 'source.write'],
  });
  assert.throws(() => missingScope.store.submitCandidate(missingScope.input),
    (error) => error.code === 'TASK_CAPABILITY_MISSING');

  const expiredGrant = await fixture(context);
  const expiredDb = expiredGrant.projectStore.workspace.database;
  const expiredRow = expiredDb.prepare(`
    SELECT head_document_json FROM agent_tasks WHERE project_id = ? AND task_id = ?
  `).get(PROJECT_ID, expiredGrant.initial.taskId);
  const expiredDocument = JSON.parse(expiredRow.head_document_json);
  expiredDocument.revisions.at(-1).snapshot.grants
    .find(({ id }) => id === expiredGrant.initial.grantId).expiresAt = '2026-09-01T11:59:59.000Z';
  expiredDb.prepare('UPDATE grants SET expires_at = ? WHERE project_id = ? AND grant_id = ?')
    .run('2026-09-01T11:59:59.000Z', PROJECT_ID, expiredGrant.initial.grantId);
  expiredDb.prepare(`
    UPDATE agent_tasks SET head_document_json = ? WHERE project_id = ? AND task_id = ?
  `).run(JSON.stringify(expiredDocument), PROJECT_ID, expiredGrant.initial.taskId);
  assert.throws(() => expiredGrant.store.submitCandidate(expiredGrant.input),
    (error) => error.code === 'GRANT_EXPIRED');

  const exhausted = await fixture(context);
  const exhaustedDb = exhausted.projectStore.workspace.database;
  const exhaustedRow = exhaustedDb.prepare(`
    SELECT task_json, head_document_json FROM agent_tasks WHERE project_id = ? AND task_id = ?
  `).get(PROJECT_ID, exhausted.initial.taskId);
  const exhaustedTask = JSON.parse(exhaustedRow.task_json);
  const exhaustedDocument = JSON.parse(exhaustedRow.head_document_json);
  exhaustedTask.usage.commands = 1;
  exhaustedDocument.revisions.at(-1).snapshot.grants
    .find(({ id }) => id === exhausted.initial.grantId).usage.commands = 1;
  exhaustedDb.prepare('UPDATE grants SET usage_json = ? WHERE project_id = ? AND grant_id = ?')
    .run(JSON.stringify(exhaustedTask.usage), PROJECT_ID, exhausted.initial.grantId);
  exhaustedDb.prepare(`
    UPDATE agent_tasks SET task_json = ?, head_document_json = ? WHERE project_id = ? AND task_id = ?
  `).run(JSON.stringify(exhaustedTask), JSON.stringify(exhaustedDocument), PROJECT_ID, exhausted.initial.taskId);
  assert.throws(() => exhausted.store.submitCandidate(exhausted.input),
    (error) => error.code === 'BUDGET_EXCEEDED');
});

test('A4c task-bound submission identities allow the same idempotency key on two isolated tasks', async (context) => {
  const { projectStore, taskStore, tasks, store, input } = await fixture(context);
  const first = store.submitCandidate(input);
  const created = await tasks.createTask({
    projectId: PROJECT_ID,
    task: {
      taskId: 'task.a4c.candidate.second',
      branchId: 'branch.task.a4c.candidate.second',
      agentId: AGENT.id,
      title: 'Second A4c candidate',
      objective: 'Prove task-bound Candidate idempotency.',
      capabilities: ['project.read', 'source.write', 'level.candidate.create'],
      objectScopes: [{ kind: 'project', id: PROJECT_ID }],
      budget: { maxCommands: 1, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 },
      expiresAt: '2026-09-01T13:00:00.000Z',
      autoAcceptPolicy: { enabled: false, allowedCommandTypes: [], maxChanges: 0 },
    },
  }, OWNER_CONTEXT);
  const secondTask = taskStore.getTask(PROJECT_ID, created.task.taskId);
  const candidate = candidateFixture({
    projectId: PROJECT_ID,
    taskId: secondTask.taskId,
    branchId: secondTask.branchId,
    baseRevision: secondTask.baseRevision,
    branchHeadRevision: secondTask.baseRevision + 1,
    idempotencyKey: 'idem.a4c.submit',
  });
  const secondStore = new SqliteLevelCandidateStore({
    workspace: projectStore.workspace,
    configuredBinding: candidate.configuredBinding,
  });
  const identity = {
    projectId: PROJECT_ID,
    taskId: secondTask.taskId,
    branchId: secondTask.branchId,
    actorId: AGENT.id,
    grantId: secondTask.grantId,
    submissionId: candidate.submission.submissionId,
    idempotencyKeyHash: candidate.idempotencyKeyHash,
    requestFingerprint: sha256('request.a4c.submit.second'),
  };
  assert.throws(() => secondStore.submitCandidate({
    identity,
    expectedBaseRevision: secondTask.baseRevision,
    expectedBranchHeadRevision: secondTask.baseRevision,
    reviewId: `review:${candidate.taskBoundKeyHash}`,
    source: input.source,
    submission: input.submission,
    configuredBinding: candidate.configuredBinding,
    now: '2026-09-01T12:00:00.000Z',
  }), (error) => error.code === 'LEVEL_CANDIDATE_BINDING_MISMATCH');
  assert.equal(taskStore.listBranchRevisions(PROJECT_ID, secondTask.taskId).length, 0);
  assert.equal(taskStore.getReview(PROJECT_ID, secondTask.taskId), null);
  const second = secondStore.submitCandidate({
    identity,
    expectedBaseRevision: secondTask.baseRevision,
    expectedBranchHeadRevision: secondTask.baseRevision,
    reviewId: `review:${candidate.taskBoundKeyHash}`,
    source: candidate.sourceDescriptor,
    submission: candidate.submission,
    configuredBinding: candidate.configuredBinding,
    now: '2026-09-01T12:00:00.000Z',
  });
  assert.notEqual(first.submission.submissionId, second.submission.submissionId);
  assert.equal(Number(projectStore.workspace.database.prepare('SELECT COUNT(*) AS count FROM task_level_candidate_submissions').get().count), 2);
});

test('A4c denies paused and expired task authority before any Candidate write', async (context) => {
  const paused = await fixture(context);
  await paused.tasks.control(PROJECT_ID, paused.current.taskId, 'pause', {
    actorId: OWNER_CONTEXT.actor.id,
    reason: 'Pause before Candidate submission.',
  });
  assert.throws(() => paused.store.submitCandidate(paused.input), (error) => error.code === 'TASK_PAUSED');
  assert.equal(Number(paused.projectStore.workspace.database.prepare('SELECT COUNT(*) AS count FROM task_level_candidate_submissions').get().count), 0);

  const expired = await fixture(context);
  const database = expired.projectStore.workspace.database;
  const row = database.prepare('SELECT task_json FROM agent_tasks WHERE project_id = ? AND task_id = ?')
    .get(PROJECT_ID, expired.current.taskId);
  const task = JSON.parse(row.task_json);
  task.expiresAt = expired.input.now;
  database.prepare(`
    UPDATE agent_tasks SET expires_at = ?, task_json = ?
    WHERE project_id = ? AND task_id = ?
  `).run(expired.input.now, JSON.stringify(task), PROJECT_ID, expired.current.taskId);
  assert.throws(() => expired.store.submitCandidate(expired.input), (error) => error.code === 'TASK_EXPIRED');
  assert.equal(Number(database.prepare('SELECT COUNT(*) AS count FROM task_level_candidate_submissions').get().count), 0);
});
