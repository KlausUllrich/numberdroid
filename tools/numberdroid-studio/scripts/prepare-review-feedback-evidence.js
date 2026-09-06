import { mkdir } from 'node:fs/promises';
import { basename, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startStudioHttpServer } from '../apps/studio-server/src/server.js';
import { inspectDirectoryPath } from './working-project.js';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));

export async function prepareReviewFeedbackEvidence(directory) {
  if (!directory || !isAbsolute(directory)) throw new Error('An explicit absolute new fixture directory is required.');
  const target = await inspectDirectoryPath(directory, { missingLeaf: true });
  const inside = relative(resolve(repositoryRoot), target);
  if (inside === '' || (!inside.startsWith(`..${sep}`) && inside !== '..' && !isAbsolute(inside))
      || basename(target).startsWith('.numberdroid-studio')) {
    throw new Error('Feedback fixtures must be outside the repository and never use an active workspace path.');
  }
  await mkdir(target, { mode: 0o700 });
  const projectId = 'project.review-feedback';
  const taskId = 'task.review-feedback';
  const owner = { actor: { id: 'local.designer', kind: 'human', displayName: 'Local designer' }, taskId: null, grantId: null, branchId: 'branch.main' };
  const running = await startStudioHttpServer({
    dataDirectory: target, host: '127.0.0.1', port: 0, storeMode: 'sqlite',
    pairingEnabled: false, operationsConfigurationFilename: null,
  });
  const command = (type, revision, id, payload) => ({
    schemaVersion: 1, commandId: `feedback.${id}`, idempotencyKey: `feedback.${id}`,
    type, projectId, baseRevision: revision, expectedVersion: revision, dryRun: false, payload,
  });
  try {
    await running.studioService.execute(command('project.create', 0, 'project', {
      name: 'Review feedback test project', ownerId: owner.actor.id,
      description: 'Synthetic review fixture. No real agent is started.',
    }), owner);
    const created = await running.agentTaskService.createTask({ projectId, task: {
      taskId, branchId: 'branch.review-feedback', agentId: 'studio.feedback.agent',
      title: 'Review two room templates',
      objective: 'Review two synthetic draft room templates. This fixture starts no agent and changes no production content.',
      capabilities: ['project.read', 'room.archetype.create'],
      objectScopes: [{ kind: 'project', id: projectId }],
      budget: { maxCommands: 6, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      autoAcceptPolicy: { enabled: false, allowedCommandTypes: [], maxChanges: 0 },
    } }, owner);
    const agent = {
      actor: { id: created.task.agentId, kind: 'agent', displayName: 'Fixture agent' },
      taskId, branchId: created.task.branchId, grantId: created.task.grantId,
    };
    for (const [id, name] of [['gathering', 'Gathering room template'], ['workshop', 'Workshop room template']]) {
      const revision = running.agentTaskService.readTask(projectId, taskId).task.headRevision;
      await running.agentTaskService.execute(command('room.archetype.create', revision, id, {
        roomArchetypeId: `archetype.feedback.${id}`, kind: 'room', displayName: name, tags: ['fixture'],
        dimensionPolicy: { width: { min: 3, preferred: 8, max: 16 }, height: { min: 3, preferred: 6, max: 16 } },
        structuralBands: { left: 0, right: 0, top: 0, bottom: 0 }, orientation: 'any',
        connectorPolicy: { min: 1, max: 8, requiredSides: [] },
        allowedAssetKinds: ['surface', 'prop', 'item'], allowedTags: [], requiredTags: [], rationality: 'neutral',
        governingRuleRefs: [{ ruleId: 'fixture.review-feedback', summary: 'Synthetic template for human review verification.' }],
      }), agent);
    }
    await running.agentTaskService.submitReview(projectId, taskId, { reviewId: 'review.feedback', actorId: owner.actor.id });
    const { task, review } = running.agentTaskService.readTask(projectId, taskId);
    const project = await running.studioService.readProjectTrusted(projectId);
    if (project.revision !== created.task.baseRevision || task.headRevision !== created.task.baseRevision + 2
        || task.state !== 'IN_REVIEW' || review.state !== 'OPEN'
        || review.items.length !== 2 || review.items.some((item) => item.disposition !== 'PENDING')) {
      throw new Error('Feedback fixture did not reach its exact pending review state.');
    }
    return { projectId, taskId, projectRevision: project.revision, reviewVersion: review.reviewVersion, itemCount: review.items.length };
  } finally {
    await new Promise((resolveClose, reject) => running.server.close((error) => error ? reject(error) : resolveClose()));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length !== 3) throw new Error('Usage: prepare-review-feedback-evidence.js ABSOLUTE_NEW_DIRECTORY');
  process.stdout.write(`${JSON.stringify(await prepareReviewFeedbackEvidence(process.argv[2]))}\n`);
}
