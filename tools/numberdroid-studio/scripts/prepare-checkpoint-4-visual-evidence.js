import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { startStudioHttpServer } from '../apps/studio-server/src/server.js';
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
  SqliteLevelCandidateStore,
  SqliteProjectStore,
  verifyWorkspaceIntegrity,
} from '../packages/persistence/src/index.js';

const dataDirectory = resolve(process.argv[2] ?? '.numberdroid-studio-checkpoint-4-visual');
const projectId = 'numberdroid-studio-checkpoint-4';
const owner = { id: 'local.designer', kind: 'human', displayName: 'Local designer' };
const ownerContext = { actor: owner, taskId: null, grantId: null, branchId: 'branch.main' };
let tick = 0;
const running = await startStudioHttpServer({
  dataDirectory,
  port: 0,
  clock: () => new Date(Date.UTC(2026, 7, 23, 10, 0, tick++)).toISOString(),
  agentTaskGrantScopes: listA4cGrantScopes(),
});

function command({ type, expectedVersion, id, payload }) {
  return {
    schemaVersion: 1,
    commandId: `visual.4.${id}`,
    idempotencyKey: `visual.4.${id}`,
    type,
    projectId,
    baseRevision: expectedVersion,
    expectedVersion,
    dryRun: false,
    payload,
  };
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function canonicalJson(value) {
  return `${JSON.stringify(canonical(value), null, 2)}\n`;
}

function candidateOutput(logicalPath, role, content) {
  return {
    logicalPath,
    mediaType: 'application/json',
    byteSize: Buffer.byteLength(content),
    sha256: sha256(content),
    role,
    content,
  };
}

function visualCandidateFixture(task) {
  const compilerVersion = 'numberdroid-level-compiler.sha256:01b144303ff217054f01c0dcd85acc3d442a02c1727ad9b01291dcc5c2559ce1';
  const bridge = { id: 'numberdroid.level-candidate-validator', version: 'numberdroid.a4c-bridge.v1' };
  const source = candidateOutput(
    'candidate/levels/a4b-key-reference/level-spec.json',
    'level-source',
    '{\n  "id": "a4b-key-reference",\n  "version": 2\n}\n',
  );
  const plan = candidateOutput(
    'candidate/levels/a4b-key-reference/semantic-plan.json',
    'compiled-plan',
    '{\n  "status": "compiled"\n}\n',
  );
  const outputs = [source, plan].sort((left, right) => left.logicalPath.localeCompare(right.logicalPath));
  const descriptors = outputs.map(({ content: _content, ...descriptor }) => descriptor);
  const projectionFingerprint = sha256('checkpoint-4-candidate-projection');
  const manifest = validateCandidateManifest({
    schemaVersion: 1,
    kind: 'studio.candidate-manifest',
    status: 'VERIFIED',
    project: { projectId, revision: task.baseRevision + 1 },
    snapshot: { snapshotId: projectionFingerprint },
    capabilityProfile: {
      profileId: NUMBERDROID_A4B_PROJECT_CAPABILITY_MANIFEST.profileId,
      profileVersion: NUMBERDROID_A4B_PROJECT_CAPABILITY_MANIFEST.profileVersion,
      fingerprint: NUMBERDROID_A4B_PROJECT_CAPABILITY_FINGERPRINT,
    },
    adapter: { id: 'numberdroid', version: 'numberdroid-studio.adapter.v1', candidateHash: sha256(canonicalJson(descriptors)) },
    compiler: { id: 'numberdroid.level-compiler', version: compilerVersion, status: 'SUCCEEDED', evidenceHash: plan.sha256 },
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
    taskId: task.taskId,
    branchId: task.branchId,
    baseRevision: task.baseRevision,
    branchHeadRevision: task.baseRevision + 1,
    candidateFingerprint: candidate.candidateFingerprint,
    changes: [{
      changeId: 'level-candidate:a4b-key-reference',
      operation: 'ADD',
      objectKind: 'level-candidate',
      objectRef: 'a4b-key-reference',
      summary: 'Add exact A4b LevelSpec-derived Candidate for read-only review.',
    }],
    outputs: outputs.map(({ logicalPath, sha256: afterSha256 }) => ({
      logicalPath,
      operation: 'ADD',
      beforeSha256: null,
      afterSha256,
    })),
  });
  const idempotencyKeyHash = sha256('checkpoint-4-candidate-submit');
  const taskBoundKeyHash = sha256(`${task.taskId}\0${idempotencyKeyHash}`);
  const submissionId = `candidate:${taskBoundKeyHash}`;
  const submission = createTaskCandidateSubmission({
    submissionId,
    idempotencyKeyHash,
    projectId,
    taskId: task.taskId,
    branchId: task.branchId,
    baseRevision: task.baseRevision,
    branchHeadRevision: task.baseRevision + 1,
    projectionFingerprint,
    candidate,
    preview,
    diff,
    compilerPins: [
      { id: 'numberdroid.level-compiler', version: compilerVersion, evidenceHash: plan.sha256 },
      { id: 'numberdroid.level-authoring-projection', version: 'numberdroid.level-authoring-projection.v2', evidenceHash: projectionFingerprint },
    ],
    engineBridgeReceipt: {
      schemaVersion: 1,
      kind: 'studio.engine-bridge.validation-receipt',
      status: 'VALIDATED',
      bridge,
      candidateFingerprint: candidate.candidateFingerprint,
      evidenceHash: candidate.candidateFingerprint,
    },
  });
  const configuredBinding = {
    composer: {
      sourceId: 'a4b-key-reference',
      sourceVersion: 2,
      sourceSha256: source.sha256,
      compilerVersion,
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
    engineBridge: bridge,
  };
  return {
    configuredBinding,
    source: {
      schemaVersion: 1,
      kind: 'numberdroid.a4c-level-candidate-source',
      sourceId: 'a4b-key-reference',
      sourceVersion: 2,
      logicalPath: source.logicalPath,
      mediaType: source.mediaType,
      byteSize: source.byteSize,
      sha256: source.sha256,
      content: source.content,
    },
    identity: {
      projectId,
      taskId: task.taskId,
      branchId: task.branchId,
      actorId: task.agentId,
      grantId: task.grantId,
      submissionId,
      idempotencyKeyHash,
      requestFingerprint: sha256('checkpoint-4-candidate-request'),
    },
    submission,
    reviewId: `review:${taskBoundKeyHash}`,
  };
}

function taskSpec(id, agentId) {
  const candidate = id === 'candidate';
  return {
    taskId: `task.checkpoint-4.${id}`,
    branchId: `branch.task.checkpoint-4.${id}`,
    agentId,
    title: id === 'accepted' ? 'Prepare approved source draft'
      : candidate ? 'Review immutable A4b Level Candidate' : 'Concurrent source refinement',
    objective: id === 'accepted'
      ? 'Register one bounded DRAFT source candidate on an isolated branch; never finalize, export, or publish.'
      : candidate
        ? 'Inspect one immutable Candidate without decision, merge, materialization, publication, or release authority.'
      : 'Independently refine the same semantic source and surface any concurrent overlap for human review.',
    capabilities: candidate ? ['project.read', 'source.write', 'level.candidate.create'] : ['project.read', 'source.write'],
    objectScopes: [{ kind: 'project', id: projectId }],
    budget: { maxCommands: 6, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 },
    expiresAt: '2026-08-24T10:00:00.000Z',
    autoAcceptPolicy: { enabled: false, allowedCommandTypes: [], maxChanges: 0 },
  };
}

function sourceCommand(expectedVersion, id, name) {
  return command({
    type: 'source.register',
    expectedVersion,
    id: `source.${id}`,
    payload: {
      sourceId: 'source.checkpoint-4.shared',
      name,
      artifactUri: `studio://numberdroid-studio-checkpoint-4/artifacts/${id}.png`,
      mediaType: 'image/png',
      width: 64,
      height: 64,
      provenance: { prompt: `Checkpoint 4 ${id} bounded fixture.`, seed: id },
    },
  });
}

try {
  await running.studioService.execute(command({
    type: 'project.create', expectedVersion: 0, id: 'project',
    payload: { name: 'Checkpoint 4 delegated workflow', ownerId: owner.id, description: 'Browser evidence for isolated agent task branches.' },
  }), ownerContext);

  const accepted = await running.agentTaskService.createTask({
    projectId,
    task: taskSpec('accepted', 'studio.source.agent.one'),
  }, ownerContext);
  const acceptedAgent = {
    actor: { id: accepted.task.agentId, kind: 'agent', displayName: 'Source agent one' },
    taskId: accepted.task.taskId,
    branchId: accepted.task.branchId,
    grantId: accepted.task.grantId,
  };
  await running.agentTaskService.execute(sourceCommand(accepted.task.baseRevision, 'accepted', 'Approved bounded source draft'), acceptedAgent);
  await running.agentTaskService.control(projectId, accepted.task.taskId, 'pause', { actorId: owner.id, reason: 'Inspect the isolated branch before review.' });
  await running.agentTaskService.control(projectId, accepted.task.taskId, 'resume', { actorId: owner.id, reason: 'Inspection complete; continue to review.' });
  const acceptedReview = await running.agentTaskService.submitReview(projectId, accepted.task.taskId, {
    reviewId: 'review.checkpoint-4.accepted', actorId: owner.id,
  });
  await running.agentTaskService.decideReview(projectId, accepted.task.taskId, acceptedReview.review.reviewId, [{
    changeId: acceptedReview.review.items[0].changeId,
    disposition: 'USER_ACCEPTED',
    reason: 'Human-reviewed bounded source change.',
  }], { actorId: owner.id });

  const concurrent = await running.agentTaskService.createTask({
    projectId,
    task: taskSpec('conflict', 'studio.source.agent.two'),
  }, ownerContext);
  const concurrentAgent = {
    actor: { id: concurrent.task.agentId, kind: 'agent', displayName: 'Source agent two' },
    taskId: concurrent.task.taskId,
    branchId: concurrent.task.branchId,
    grantId: concurrent.task.grantId,
  };
  await running.agentTaskService.execute(sourceCommand(concurrent.task.baseRevision, 'conflict', 'Concurrent bounded source draft'), concurrentAgent);

  const merged = await running.agentTaskService.mergeReview(projectId, accepted.task.taskId, acceptedReview.review.reviewId, {
    mergeId: 'merge.checkpoint-4.accepted', actorId: owner.id,
  });
  const conflictReview = await running.agentTaskService.submitReview(projectId, concurrent.task.taskId, {
    reviewId: 'review.checkpoint-4.conflict', actorId: owner.id,
  });
  if (conflictReview.review.conflicts.length !== 1) throw new Error('Checkpoint 4 fixture did not produce its exact semantic overlap.');

  const candidate = await running.agentTaskService.createTask({
    projectId,
    task: taskSpec('candidate', 'studio.level-candidate.agent'),
  }, ownerContext);
  const candidateFixture = visualCandidateFixture(candidate.task);
  const candidateStore = new SqliteLevelCandidateStore({
    workspace: running.agentTaskStore.workspace,
    configuredBinding: candidateFixture.configuredBinding,
  });
  candidateStore.submitCandidate({
    identity: candidateFixture.identity,
    expectedBaseRevision: candidate.task.baseRevision,
    expectedBranchHeadRevision: candidate.task.baseRevision,
    reviewId: candidateFixture.reviewId,
    source: candidateFixture.source,
    submission: candidateFixture.submission,
    configuredBinding: candidateFixture.configuredBinding,
    now: '2026-08-23T10:30:00.000Z',
  });
  const integrity = await verifyWorkspaceIntegrity({
    projectStore: new SqliteProjectStore({ workspace: running.agentTaskStore.workspace }),
    artifactStore: running.artifactStore,
  });
  if (!integrity.ok) {
    throw new Error(`Checkpoint 4 Candidate fixture failed workspace integrity: ${JSON.stringify(integrity.tasks.findings)}`);
  }

  const project = await running.studioService.readProjectTrusted(projectId);
  const tasks = running.agentTaskService.listTasks(projectId).tasks;
  if (project.revision !== 6 || tasks.length !== 3
    || !tasks.some(({ state }) => state === 'MERGED')
    || tasks.filter(({ state }) => state === 'IN_REVIEW').length !== 2) {
    throw new Error(`Checkpoint 4 fixture did not reach the exact merged, conflicting-review, and read-only Candidate state: ${JSON.stringify({ revision: project.revision, tasks: tasks.map(({ taskId, state }) => ({ taskId, state })) })}`);
  }
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 1,
    projectId,
    revision: project.revision,
    activityCount: project.revision,
    taskCount: tasks.length,
    mergedTaskId: accepted.task.taskId,
    conflictTaskId: concurrent.task.taskId,
    candidateTaskId: candidate.task.taskId,
    conflictCount: conflictReview.review.conflicts.length,
    mergeId: merged.merge.mergeId,
    address: running.address,
  }, null, 2)}\n`);
} finally {
  await new Promise((resolveClose) => running.server.close(resolveClose));
}
