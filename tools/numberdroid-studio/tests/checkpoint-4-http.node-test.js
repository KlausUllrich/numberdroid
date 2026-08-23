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

test('Checkpoint 4 UI exposes task composition, truthful policy labels, timeline, review, merge, and revert controls', async () => {
  const client = await (await import('node:fs/promises')).readFile(new URL('../apps/studio-server/public/app.js', import.meta.url), 'utf8');
  const page = await (await import('node:fs/promises')).readFile(new URL('../apps/studio-server/public/index.html', import.meta.url), 'utf8');
  const styles = await (await import('node:fs/promises')).readFile(new URL('../apps/studio-server/public/styles.css', import.meta.url), 'utf8');
  assert.match(page, /data-workspace="tasks"/);
  assert.match(page, /Propose in draft<\/option>/);
  assert.match(client, /function renderTaskComposer/);
  assert.match(client, /AUTO_ACCEPTED_BY_POLICY/);
  assert.match(client, /Live timeline/);
  assert.match(client, /Merge accepted changes/);
  assert.match(client, /Revert merge/);
  assert.match(client, /Do not finalize, export, or publish/);
  assert.match(styles, /\.task-layout \{ display: grid/);
  assert.match(styles, /\.task-list-item \.status-pill \{ align-self: start; justify-self: end; \}/);
  assert.match(styles, /\.task-detail \.status-pill \{ flex: 0 0 auto; \}/);
  assert.match(styles, /\.task-list \{ display: grid; grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /\.task-list > h2 \{ min-width: 0; max-width: 100%; overflow-wrap: anywhere; \}/);
  assert.match(styles, /@media \(max-width: 1200px\)/);
  assert.match(styles, /\.task-form fieldset \{ grid-template-columns: repeat\(2/);
  assert.match(styles, /\.task-list-item \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(styles, /\.task-list-item \.status-pill \{ grid-column: 1; justify-self: start; \}/);
});
