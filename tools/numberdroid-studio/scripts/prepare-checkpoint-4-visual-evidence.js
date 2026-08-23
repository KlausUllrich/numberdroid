import { resolve } from 'node:path';
import { startStudioHttpServer } from '../apps/studio-server/src/server.js';

const dataDirectory = resolve(process.argv[2] ?? '.numberdroid-studio-checkpoint-4-visual');
const projectId = 'numberdroid-studio-checkpoint-4';
const owner = { id: 'local.designer', kind: 'human', displayName: 'Local designer' };
const ownerContext = { actor: owner, taskId: null, grantId: null, branchId: 'branch.main' };
let tick = 0;
const running = await startStudioHttpServer({
  dataDirectory,
  port: 0,
  clock: () => new Date(Date.UTC(2026, 7, 23, 10, 0, tick++)).toISOString(),
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

function taskSpec(id, agentId) {
  return {
    taskId: `task.checkpoint-4.${id}`,
    branchId: `branch.task.checkpoint-4.${id}`,
    agentId,
    title: id === 'accepted' ? 'Prepare approved source draft' : 'Concurrent source refinement',
    objective: id === 'accepted'
      ? 'Register one bounded DRAFT source candidate on an isolated branch; never finalize, export, or publish.'
      : 'Independently refine the same semantic source and surface any concurrent overlap for human review.',
    capabilities: ['project.read', 'source.write'],
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

  const project = await running.studioService.readProjectTrusted(projectId);
  const tasks = running.agentTaskService.listTasks(projectId).tasks;
  if (project.revision !== 5 || tasks.length !== 2
    || !tasks.some(({ state }) => state === 'MERGED')
    || !tasks.some(({ state }) => state === 'IN_REVIEW')) {
    throw new Error('Checkpoint 4 fixture did not reach the exact merged plus conflicting-review state.');
  }
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 1,
    projectId,
    revision: project.revision,
    activityCount: project.revision,
    taskCount: tasks.length,
    mergedTaskId: accepted.task.taskId,
    conflictTaskId: concurrent.task.taskId,
    conflictCount: conflictReview.review.conflicts.length,
    mergeId: merged.merge.mergeId,
    address: running.address,
  }, null, 2)}\n`);
} finally {
  await new Promise((resolveClose) => running.server.close(resolveClose));
}
