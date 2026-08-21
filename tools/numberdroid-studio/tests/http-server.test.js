import test from 'node:test';
import assert from 'node:assert/strict';
import { StudioService } from '../packages/application/src/index.js';
import { InMemoryProjectStore } from '../packages/persistence/src/index.js';
import { createStudioHttpServer } from '../apps/studio-server/src/server.js';

test('visual shell is clickable, creates the demo through commands, and exposes live activity', async (context) => {
  const studioService = new StudioService({ store: new InMemoryProjectStore() });
  const server = createStudioHttpServer({ studioService });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const page = await fetch(base).then((response) => response.text());
  assert.match(page, /Create \/ load demo/);
  assert.match(page, /Activity feed/);
  const clientScript = await fetch(`${base}/app.js`).then((response) => response.text());
  assert.match(clientScript, /idempotent-retry/);
  assert.match(clientScript, /post-revoke-attempt/);

  const demoResponse = await fetch(`${base}/api/demo`, { method: 'POST' });
  assert.equal(demoResponse.status, 200);
  const demo = await demoResponse.json();
  assert.equal(demo.revision, 5);
  assert.equal(demo.schemaVersion, 1);
  assert.equal(demo.snapshot.project.status, 'in_review');
  assert.equal(demo.snapshot.assets[0].kind, 'surface');
  assert.equal(demo.snapshot.assets[0].properties.role, 'floor');

  const activity = await fetch(`${base}/api/projects/${demo.projectId}/activity`).then((response) => response.json());
  assert.equal(activity.events.length, 5);
  assert.ok(activity.events.some((event) => event.actor.kind === 'agent' && event.taskId));

  const retryResponse = await fetch(`${base}/api/demo/action?action=idempotent-retry`, { method: 'POST' });
  assert.equal(retryResponse.status, 200);
  const retry = await retryResponse.json();
  assert.equal(retry.replayed, true);
  assert.equal(retry.revision, 3);
  assert.equal((await studioService.readProjectTrusted(demo.projectId)).revision, 5);

  const staleResponse = await fetch(`${base}/api/demo/action?action=stale-write`, { method: 'POST' });
  assert.equal(staleResponse.status, 409);
  assert.equal((await staleResponse.json()).error.code, 'REVISION_CONFLICT');
  assert.equal((await studioService.readProjectTrusted(demo.projectId)).revision, 5);

  const revokeResponse = await fetch(`${base}/api/demo/action?action=revoke-grant`, { method: 'POST' });
  assert.equal(revokeResponse.status, 200);
  const revoke = await revokeResponse.json();
  assert.equal(revoke.revision, 6);

  const deniedResponse = await fetch(`${base}/api/demo/action?action=post-revoke-attempt`, { method: 'POST' });
  assert.equal(deniedResponse.status, 403);
  assert.equal((await deniedResponse.json()).error.code, 'GRANT_REVOKED');
  const finalProject = await studioService.readProjectTrusted(demo.projectId);
  assert.equal(finalProject.revision, 6);
  assert.equal(finalProject.snapshot.sources.length, 1);
  assert.ok(finalProject.snapshot.grants[0].revokedAt);
  assert.equal((await studioService.listActivityTrusted(demo.projectId)).length, 6);

  const spoofedCommand = await fetch(`${base}/api/commands`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actor: { id: 'forged', kind: 'human' } }),
  });
  assert.equal(spoofedCommand.status, 404);

  const forbiddenMethod = await fetch(`${base}/api/commands`, { method: 'DELETE' });
  assert.equal(forbiddenMethod.status, 405);
});
