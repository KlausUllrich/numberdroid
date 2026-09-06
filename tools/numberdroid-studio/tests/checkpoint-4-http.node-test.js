import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startStudioHttpServer } from '../apps/studio-server/src/server.js';
import { afterTestCleanup } from './persistence-test-helpers.js';

async function headers(base) {
  const session = await fetch(`${base}/api/ui-session`).then((response) => response.json());
  return {
    'content-type': 'application/json',
    origin: base,
    'sec-fetch-site': 'same-origin',
    'x-numberdroid-studio-csrf': session.csrfToken,
  };
}

test('Checkpoint 4 HTTP composer and controls are same-origin, CSRF-bound, exact, and durable', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-cp4-http-'));
  afterTestCleanup(context, () => rm(directory, { recursive: true, force: true }));
  const running = await startStudioHttpServer({ dataDirectory: directory, host: '127.0.0.1', port: 0 });
  afterTestCleanup(context, () => new Promise((resolve) => running.server.close(resolve)));
  const base = `http://127.0.0.1:${running.address.port}`;
  const mutationHeaders = await headers(base);
  const demo = await fetch(`${base}/api/demo`, { method: 'POST', headers: mutationHeaders }).then((response) => response.json());
  const path = `${base}/api/projects/${encodeURIComponent(demo.projectId)}/tasks`;
  const task = {
    taskId: 'task.http.cp4', branchId: 'branch.task.http.cp4', agentId: 'agent.http.cp4',
    title: 'HTTP task branch', objective: 'Exercise bounded task composition and control.',
    capabilities: ['project.read', 'room.variant.resize'],
    objectScopes: [{ kind: 'project', id: demo.projectId }],
    budget: { maxCommands: 4, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 },
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    autoAcceptPolicy: { enabled: false, allowedCommandTypes: [], maxChanges: 0 },
  };

  const blind = await fetch(path, { method: 'POST', body: JSON.stringify({ task }) });
  assert.equal(blind.status, 403);
  assert.equal((await blind.json()).error.code, 'UI_ORIGIN_REQUIRED');
  const unknown = await fetch(path, {
    method: 'POST', headers: mutationHeaders, body: JSON.stringify({ task, injectedAuthority: 'forbidden' }),
  });
  assert.equal(unknown.status, 400);
  assert.equal((await unknown.json()).error.code, 'VALIDATION_ERROR');

  const createdResponse = await fetch(path, {
    method: 'POST', headers: mutationHeaders, body: JSON.stringify({ task }),
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  assert.equal(created.task.state, 'ACTIVE');
  assert.equal(created.task.branchId, task.branchId);
  assert.equal(created.timeline[0].type, 'TASK_CREATED');
  const listed = await fetch(path).then((response) => response.json());
  assert.equal(listed.tasks.length, 1);
  assert.equal(listed.tasks[0].grantId, created.task.grantId);

  const itemPath = `${path}/${encodeURIComponent(task.taskId)}`;
  const paused = await fetch(`${itemPath}/pause`, {
    method: 'POST', headers: mutationHeaders, body: JSON.stringify({ reason: 'Human inspection.' }),
  }).then((response) => response.json());
  assert.equal(paused.task.state, 'PAUSED');
  assert.equal(paused.timeline.at(-1).type, 'TASK_PAUSE');
  const resumed = await fetch(`${itemPath}/resume`, {
    method: 'POST', headers: mutationHeaders, body: JSON.stringify({ reason: 'Continue.' }),
  }).then((response) => response.json());
  assert.equal(resumed.task.state, 'ACTIVE');
  assert.equal(resumed.timeline.at(-1).type, 'TASK_RESUME');

  const project = await running.studioService.readProjectTrusted(demo.projectId);
  assert.ok(project.snapshot.grants.some((grant) => grant.id === created.task.grantId && !grant.revokedAt));
  assert.equal(running.agentTaskStore.listTimeline(demo.projectId, task.taskId).length, 3);
});

test('owner HTTP review feedback requires exact version and correction text while legacy decisions remain valid', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-cp4-feedback-http-'));
  afterTestCleanup(context, () => rm(directory, { recursive: true, force: true }));
  const running = await startStudioHttpServer({ dataDirectory: directory, host: '127.0.0.1', port: 0 });
  afterTestCleanup(context, () => new Promise((resolve) => running.server.close(resolve)));
  const base = `http://127.0.0.1:${running.address.port}`;
  const mutationHeaders = await headers(base);
  const post = (path, body, requestHeaders = mutationHeaders) => fetch(`${base}${path}`, { method: 'POST', headers: requestHeaders, body: JSON.stringify(body) });
  const project = await (await post('/api/demo', {})).json();
  const taskPath = `/api/projects/${encodeURIComponent(project.projectId)}/tasks`;
  const task = {
    taskId: 'task.http.feedback', branchId: 'branch.task.http.feedback', agentId: 'agent.http.feedback',
    title: 'Review feedback', objective: 'Submit a source for explicit owner correction.',
    capabilities: ['project.read', 'source.write'], objectScopes: [{ kind: 'project', id: project.projectId }],
    budget: { maxCommands: 2, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 },
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), autoAcceptPolicy: { enabled: false, allowedCommandTypes: [], maxChanges: 0 },
  };
  const created = await (await post(taskPath, { task })).json();
  await running.agentTaskService.execute({
    schemaVersion: 1, commandId: 'source.http.feedback', idempotencyKey: 'source.http.feedback', type: 'source.register',
    projectId: project.projectId, baseRevision: created.task.baseRevision, expectedVersion: created.task.baseRevision, dryRun: false,
    payload: { sourceId: 'source.http.feedback', name: 'Source to review', artifactUri: `studio://${project.projectId}/artifacts/feedback.png`, mediaType: 'image/png', width: 16, height: 16, provenance: { prompt: 'Bounded review fixture.', seed: 1 } },
  }, { actor: { id: task.agentId, kind: 'agent', displayName: 'Fixture agent' }, taskId: task.taskId, branchId: task.branchId, grantId: created.task.grantId });
  const { review } = await (await post(`${taskPath}/${task.taskId}/submit-review`, { reviewId: 'review.http.feedback' })).json();
  const decidePath = `${taskPath}/${task.taskId}/reviews/${review.reviewId}/decide`;
  const decision = { changeId: review.items[0].changeId, disposition: 'USER_ACCEPTED', reason: null };
  const legacy = await post(decidePath, { decisions: [decision], confirm: true });
  assert.equal(legacy.status, 200);
  assert.equal((await legacy.json()).review.reviewVersion, 2);
  const corrections = [{ ...decision, disposition: 'CHANGES_REQUESTED', reason: 'Use the approved source name.' }];
  for (const extra of [
    { expectedReviewVersion: 2 },
    { feedbackSummary: 'Correct the name.' },
    { expectedReviewVersion: 2, feedbackSummary: '   ' },
    { expectedReviewVersion: 2, feedbackSummary: 'x'.repeat(4001) },
    { expectedReviewVersion: 2, feedbackSummary: 'Correct the name.', authorId: 'forged' },
  ]) {
    const response = await post(decidePath, { decisions: corrections, confirm: true, ...extra });
    assert.equal(response.status, 400); await response.json();
    assert.equal(running.agentTaskStore.getReview(project.projectId, task.taskId).reviewVersion, 2);
  }
  const stale = await post(decidePath, { decisions: corrections, confirm: true, expectedReviewVersion: 1, feedbackSummary: 'Stale feedback.' });
  assert.equal(stale.status, 409); assert.equal((await stale.json()).error.code, 'REVIEW_VERSION_CONFLICT');
  const withoutCsrf = { ...mutationHeaders }; delete withoutCsrf['x-numberdroid-studio-csrf'];
  const unauthorized = await post(decidePath, { decisions: corrections, confirm: true, expectedReviewVersion: 2, feedbackSummary: 'Correct the name.' }, withoutCsrf);
  assert.equal(unauthorized.status, 403); await unauthorized.json();
  const accepted = await post(decidePath, { decisions: corrections, confirm: true, expectedReviewVersion: 2, feedbackSummary: 'Correct the source name, then resubmit.' });
  assert.equal(accepted.status, 200);
  const result = (await accepted.json()).review;
  const ownerId = (await running.studioService.readProjectTrusted(project.projectId)).snapshot.project.ownerId;
  assert.equal(result.feedback.authorId, ownerId);
  assert.equal(result.feedback.basisReviewVersion, 2);
  assert.equal(result.items[0].reason, 'Use the approved source name.');
  assert.equal(running.agentTaskStore.getTask(project.projectId, task.taskId).state, 'CHANGES_REQUESTED');
});

test('Checkpoint 4 UI exposes task composition, truthful policy labels, timeline, review, merge, and revert controls', async () => {
  const client = await (await import('node:fs/promises')).readFile(new URL('../apps/studio-server/public/app.js', import.meta.url), 'utf8');
  const page = await (await import('node:fs/promises')).readFile(new URL('../apps/studio-server/public/index.html', import.meta.url), 'utf8');
  const styles = await (await import('node:fs/promises')).readFile(new URL('../apps/studio-server/public/styles.css', import.meta.url), 'utf8');
  assert.match(page, /data-workspace="tasks"/);
  assert.match(page, /Propose in draft<\/option>/);
  assert.match(client, /function renderTaskComposer/);
  assert.match(client, /AUTO_ACCEPTED_BY_POLICY/);
  assert.match(client, /Waiting for your review/);
  assert.match(client, /Progress/);
  assert.match(client, /Add accepted changes and complete task/);
  assert.match(client, /Undo task changes/);
  assert.match(client, /Do not finalize, export, or publish/i);
  assert.match(client, /function taskMergeBlockedReason/);
  assert.match(client, /const blockedReason = taskMergeBlockedReason\(entry\.review\)/);
  assert.match(client, /disabledByTaskPending/);
  assert.doesNotMatch(client, /control\.disabled = state\.taskMutationPending/);
  assert.match(styles, /\.task-layout \{ display: grid/);
  assert.match(styles, /\.task-list-item \.status-pill \{[^}]*max-width: 100%;[^}]*white-space: normal; \}/);
  assert.match(styles, /\.task-detail \.status-pill \{ flex: 0 0 auto; white-space: nowrap; \}/);
  assert.match(styles, /\.task-list \{ display: grid; grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /\.task-list > h2 \{ min-width: 0; max-width: 100%; overflow-wrap: anywhere; \}/);
  assert.match(styles, /@media \(max-width: 1200px\)/);
  assert.match(styles, /\.task-form fieldset \{ grid-template-columns: repeat\(2/);
  assert.match(styles, /\.task-list-item \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(styles, /\.task-list-item \.status-pill \{ grid-column: 1; justify-self: start; \}/);
});
