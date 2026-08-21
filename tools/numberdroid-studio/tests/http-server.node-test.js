import test from 'node:test';
import assert from 'node:assert/strict';

// Kept outside Vitest's discovery pattern; this package uses Node's test runner.
import { StudioService } from '../packages/application/src/index.js';
import { InMemoryProjectStore } from '../packages/persistence/src/index.js';
import { createStudioHttpServer } from '../apps/studio-server/src/server.js';
import { assetPreviewProjection } from '../apps/studio-server/src/http-projections.js';

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
  assert.match(page, /Agent access/);
  assert.match(page, /Propose in draft/);
  assert.match(page, /Effective agent policy/);
  assert.match(page, /Header selection never creates or widens authority/);
  const clientScript = await fetch(`${base}/app.js`).then((response) => response.text());
  assert.match(clientScript, /idempotent-retry/);
  assert.match(clientScript, /post-revoke-attempt/);
  assert.match(clientScript, /PROCESSING: 'Preview processing'/);
  assert.match(clientScript, /LOAD_FAILED: 'Preview failed'/);
  assert.match(clientScript, /window\.confirm/);
  assert.match(clientScript, /Publish is never included/);
  assert.match(clientScript, /Command budget/);
  const styles = await fetch(`${base}/styles.css`).then((response) => response.text());
  assert.match(styles, /\.asset-preview/);
  assert.match(styles, /aspect-ratio: 1/);
  assert.match(styles, /object-fit: contain/);

  const demoResponse = await fetch(`${base}/api/demo`, { method: 'POST' });
  assert.equal(demoResponse.status, 200);
  const demo = await demoResponse.json();
  assert.equal(demo.revision, 5);
  assert.equal(demo.schemaVersion, 1);
  assert.equal(demo.snapshot.project.status, 'in_review');
  assert.equal(demo.snapshot.assets[0].kind, 'surface');
  assert.equal(demo.snapshot.assets[0].properties.role, 'floor');

  const projectedProject = await fetch(`${base}/api/projects/${demo.projectId}`).then((response) => response.json());
  assert.deepEqual(projectedProject.snapshot.assets[0].preview, {
    schemaVersion: 1,
    state: 'PROCESSING',
    resourceUri: null,
    kind: 'surface',
    alt: 'surface preview: processing',
  });

  const accessResponse = await fetch(`${base}/api/projects/${demo.projectId}/agent-access`);
  assert.equal(accessResponse.status, 200);
  const access = await accessResponse.json();
  assert.equal(access.effectivePolicy.state, 'ACTIVE_EXECUTE');
  assert.equal(access.effectivePolicy.mode, 'execute_scoped');
  assert.equal(access.effectivePolicy.selectionCreatesAuthority, false);
  assert.equal(access.effectivePolicy.branchId, 'branch.demo-atlas');
  assert.equal(access.effectivePolicy.budget.status, 'ENFORCED');
  assert.equal(access.effectivePolicy.budget.remaining.commands, 97);
  assert.deepEqual(access.effectivePolicy.objectScopes, [{ kind: 'project', id: demo.projectId }]);
  assert.deepEqual(access.effectivePolicy.options.map(({ value }) => value), [
    'off', 'read_only', 'propose_draft', 'execute_scoped', 'custom',
  ]);
  assert.equal(typeof access.csrfToken, 'string');

  const missingOrigin = await fetch(`${base}/api/projects/${demo.projectId}/agent-access`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-numberdroid-studio-csrf': access.csrfToken },
    body: JSON.stringify({ mode: 'execute_scoped' }),
  });
  assert.equal(missingOrigin.status, 403);
  assert.equal((await missingOrigin.json()).error.code, 'UI_ORIGIN_REQUIRED');

  const missingCsrf = await fetch(`${base}/api/projects/${demo.projectId}/agent-access`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base, 'sec-fetch-site': 'same-origin' },
    body: JSON.stringify({ mode: 'execute_scoped' }),
  });
  assert.equal(missingCsrf.status, 403);
  assert.equal((await missingCsrf.json()).error.code, 'CSRF_INVALID');

  const crossOrigin = await fetch(`${base}/api/projects/${demo.projectId}/agent-access`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: `http://localhost:${port}`,
      'sec-fetch-site': 'cross-site',
      'x-numberdroid-studio-csrf': access.csrfToken,
    },
    body: JSON.stringify({ mode: 'execute_scoped' }),
  });
  assert.equal(crossOrigin.status, 403);
  assert.equal((await crossOrigin.json()).error.code, 'UI_ORIGIN_FORBIDDEN');

  const beforeAccessSelection = await studioService.readProjectTrusted(demo.projectId);
  const publishSpoof = await fetch(`${base}/api/projects/${demo.projectId}/agent-access`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: base,
      'sec-fetch-site': 'same-origin',
      'x-numberdroid-studio-csrf': access.csrfToken,
    },
    body: JSON.stringify({ mode: 'publish', confirmBroaderAccess: true, idempotencyKey: 'ui.spoof.publish' }),
  });
  assert.equal(publishSpoof.status, 400);
  assert.equal((await publishSpoof.json()).error.code, 'UNKNOWN_AGENT_ACCESS_MODE');

  const scopeSpoof = await fetch(`${base}/api/projects/${demo.projectId}/agent-access`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: base,
      'sec-fetch-site': 'same-origin',
      'x-numberdroid-studio-csrf': access.csrfToken,
    },
    body: JSON.stringify({
      mode: 'execute_scoped',
      confirmBroaderAccess: true,
      idempotencyKey: 'ui.spoof.scopes',
      scopes: ['publish'],
    }),
  });
  assert.equal(scopeSpoof.status, 400);
  assert.equal((await scopeSpoof.json()).error.code, 'VALIDATION_ERROR');
  const afterAccessSelection = await studioService.readProjectTrusted(demo.projectId);
  assert.deepEqual(afterAccessSelection, beforeAccessSelection);

  const custom = await fetch(`${base}/api/projects/${demo.projectId}/agent-access`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: base,
      'sec-fetch-site': 'same-origin',
      'x-numberdroid-studio-csrf': access.csrfToken,
    },
    body: JSON.stringify({ mode: 'custom' }),
  }).then((response) => response.json());
  assert.equal(custom.effectivePolicy.customEditorRequired, true);
  assert.equal(custom.effectivePolicy.selectionCreatesAuthority, false);

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
  const revokedAccess = await fetch(`${base}/api/projects/${demo.projectId}/agent-access`).then((response) => response.json());
  assert.equal(revokedAccess.effectivePolicy.state, 'REVOKED');
  assert.equal(revokedAccess.effectivePolicy.mode, 'off');

  const spoofedCommand = await fetch(`${base}/api/commands`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actor: { id: 'forged', kind: 'human' } }),
  });
  assert.equal(spoofedCommand.status, 404);

  const forbiddenMethod = await fetch(`${base}/api/commands`, { method: 'DELETE' });
  assert.equal(forbiddenMethod.status, 405);
});

test('human Agent access presets rotate immutable grants with confirmation and idempotent retry', async (context) => {
  const studioService = new StudioService({ store: new InMemoryProjectStore() });
  const server = createStudioHttpServer({ studioService });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  const demo = await fetch(`${base}/api/demo`, { method: 'POST' }).then((response) => response.json());
  const initialAccess = await fetch(`${base}/api/projects/${demo.projectId}/agent-access`).then((response) => response.json());
  assert.deepEqual(initialAccess.effectivePolicy.presets.read_only.scopes, ['project.read']);
  assert.ok(!initialAccess.effectivePolicy.presets.execute_scoped.scopes.some((scope) => scope.includes('publish')));
  assert.equal(initialAccess.effectivePolicy.presets.execute_scoped.branchId, 'branch.demo-atlas');
  assert.equal(initialAccess.effectivePolicy.presets.execute_scoped.budget.maxCommands, 100);
  const headers = {
    'content-type': 'application/json',
    origin: base,
    'sec-fetch-site': 'same-origin',
    'x-numberdroid-studio-csrf': initialAccess.csrfToken,
  };
  const change = (body) => fetch(`${base}/api/projects/${demo.projectId}/agent-access`, {
    method: 'POST', headers, body: JSON.stringify(body),
  });

  const proposalResponse = await change({ mode: 'propose_draft', idempotencyKey: 'access.proposal' });
  assert.equal(proposalResponse.status, 200);
  const proposal = await proposalResponse.json();
  assert.equal(proposal.changed, true);
  assert.equal(proposal.idempotentReplay, false);
  assert.equal(proposal.effectivePolicy.state, 'ACTIVE_DRAFT');
  let project = await studioService.readProjectTrusted(demo.projectId);
  assert.equal(project.revision, 7);
  assert.equal(project.snapshot.grants.length, 2);
  assert.ok(project.snapshot.grants[0].revokedAt);
  let active = project.snapshot.grants.find((grant) => !grant.revokedAt);
  assert.deepEqual(active.scopes, ['asset.write', 'project.read', 'source.write']);
  assert.equal(active.branchId, 'branch.demo-atlas');
  assert.deepEqual(active.objectScopes, [{ kind: 'project', id: demo.projectId }]);
  assert.equal(active.budget.maxCommands, 50);
  assert.ok(Date.parse(active.expiresAt) > Date.now());
  assert.ok(!active.scopes.some((scope) => scope.includes('publish')));

  const replay = await change({ mode: 'propose_draft', idempotencyKey: 'access.proposal' }).then((response) => response.json());
  assert.equal(replay.idempotentReplay, true);
  assert.equal((await studioService.readProjectTrusted(demo.projectId)).revision, 7);

  const reusedKey = await change({ mode: 'read_only', idempotencyKey: 'access.proposal' });
  assert.equal(reusedKey.status, 409);
  assert.equal((await reusedKey.json()).error.code, 'IDEMPOTENCY_CONFLICT');
  assert.equal((await studioService.readProjectTrusted(demo.projectId)).revision, 7);

  const unconfirmed = await change({ mode: 'execute_scoped', idempotencyKey: 'access.execute' });
  assert.equal(unconfirmed.status, 409);
  const confirmationError = await unconfirmed.json();
  assert.equal(confirmationError.error.code, 'BROADER_ACCESS_CONFIRMATION_REQUIRED');
  assert.equal(confirmationError.error.details.publishIncluded, false);
  assert.ok(!confirmationError.error.details.scopes.some((scope) => scope.includes('publish')));
  assert.equal((await studioService.readProjectTrusted(demo.projectId)).revision, 7);

  const executed = await change({
    mode: 'execute_scoped', confirmBroaderAccess: true, idempotencyKey: 'access.execute',
  }).then((response) => response.json());
  assert.equal(executed.effectivePolicy.state, 'ACTIVE_EXECUTE');
  project = await studioService.readProjectTrusted(demo.projectId);
  assert.equal(project.revision, 9);
  assert.equal(project.snapshot.grants.length, 3);
  active = project.snapshot.grants.find((grant) => !grant.revokedAt);
  assert.ok(active.scopes.includes('project.status.write'));
  assert.ok(!active.scopes.some((scope) => scope.includes('publish')));
  assert.equal(active.budget.maxCommands, 100);

  const turnedOff = await change({ mode: 'off', idempotencyKey: 'access.off' }).then((response) => response.json());
  assert.equal(turnedOff.changed, true);
  assert.equal(turnedOff.effectivePolicy.mode, 'off');
  project = await studioService.readProjectTrusted(demo.projectId);
  assert.equal(project.revision, 10);
  assert.equal(project.snapshot.grants.filter((grant) => !grant.revokedAt).length, 0);

  const offReplay = await change({ mode: 'off', idempotencyKey: 'access.off' }).then((response) => response.json());
  assert.equal(offReplay.idempotentReplay, true);
  assert.equal((await studioService.readProjectTrusted(demo.projectId)).revision, 10);

  const readWithoutConfirmation = await change({ mode: 'read_only', idempotencyKey: 'access.read' });
  assert.equal(readWithoutConfirmation.status, 409);
  assert.equal((await readWithoutConfirmation.json()).error.code, 'BROADER_ACCESS_CONFIRMATION_REQUIRED');
  const readOnly = await change({
    mode: 'read_only', confirmBroaderAccess: true, idempotencyKey: 'access.read',
  }).then((response) => response.json());
  assert.equal(readOnly.effectivePolicy.state, 'ACTIVE_READ_ONLY');
  project = await studioService.readProjectTrusted(demo.projectId);
  assert.equal(project.revision, 11);
  active = project.snapshot.grants.find((grant) => !grant.revokedAt);
  assert.deepEqual(active.scopes, ['project.read']);

  const beforeCustom = structuredClone(project);
  const custom = await change({ mode: 'custom' }).then((response) => response.json());
  assert.equal(custom.changed, false);
  assert.equal(custom.effectivePolicy.customEditorRequired, true);
  assert.deepEqual(await studioService.readProjectTrusted(demo.projectId), beforeCustom);
});

test('asset preview projection always yields a same-origin preview or a distinct accessible fallback', () => {
  const asset = { id: 'asset.preview', name: 'Preview tile', kind: 'surface' };
  assert.equal(assetPreviewProjection(asset, null).state, 'MISSING');
  assert.equal(assetPreviewProjection(asset, { artifactUri: 'studio://artifact', mediaType: 'image/svg+xml' }).state, 'UNSUPPORTED');
  assert.equal(assetPreviewProjection(asset, { artifactUri: 'studio://artifact', mediaType: 'image/png' }).state, 'PROCESSING');
  assert.equal(assetPreviewProjection({ ...asset, preview: { state: 'READY', resourceUri: 'https://evil.example/asset.png' } }, {}).state, 'LOAD_FAILED');
  assert.deepEqual(assetPreviewProjection({
    ...asset,
    preview: { state: 'READY', resourceUri: '/api/previews/sha256/demo', alt: 'Clean tile preview' },
  }, {}), {
    schemaVersion: 1,
    state: 'READY',
    resourceUri: '/api/previews/sha256/demo',
    kind: 'surface',
    alt: 'Clean tile preview',
  });
});
