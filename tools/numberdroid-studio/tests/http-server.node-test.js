import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Kept outside Vitest's discovery pattern; this package uses Node's test runner.
import { StudioService } from '../packages/application/src/index.js';
import { InMemoryProjectStore } from '../packages/persistence/src/index.js';
import { createStudioHttpServer, startStudioHttpServer } from '../apps/studio-server/src/server.js';
import { assetPreviewProjection, jobHttpProjection } from '../apps/studio-server/src/http-projections.js';

async function humanMutationHeaders(base) {
  const session = await fetch(`${base}/api/ui-session`).then((response) => response.json());
  return {
    origin: base,
    'sec-fetch-site': 'same-origin',
    'x-numberdroid-studio-csrf': session.csrfToken,
  };
}

test('Checkpoint 1B refuses a non-loopback HTTP listener before opening workspace data', async () => {
  await assert.rejects(
    startStudioHttpServer({ host: '0.0.0.0', storeMode: 'json' }),
    (error) => error.code === 'LOOPBACK_HOST_REQUIRED',
  );
});

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
  assert.match(page, /DOM state grants nothing/);
  assert.match(page, /Show host setup/);
  assert.match(page, /authorize the waiting host/);
  const clientScript = await fetch(`${base}/app.js`).then((response) => response.text());
  assert.match(clientScript, /idempotent-retry/);
  assert.match(clientScript, /post-revoke-attempt/);
  assert.match(clientScript, /PROCESSING: 'Preview processing'/);
  assert.match(clientScript, /LOAD_FAILED: 'Preview failed'/);
  assert.match(clientScript, /window\.confirm/);
  assert.match(clientScript, /operations: \{ define: null, preview: null, commit: null, cancel: null, retry: null, discard: null \}/);
  assert.match(clientScript, /operations\.define \?\?=/);
  assert.match(clientScript, /operations\.preview \?\?=/);
  assert.match(clientScript, /operations\.commit \?\?=/);
  assert.match(clientScript, /operations\.discard \?\?=/);
  assert.match(clientScript, /data-discard-cutter-job/);
  assert.match(clientScript, /Commit or discard the current preview job/);
  assert.match(clientScript, /aria-live', 'polite/);
  assert.match(clientScript, /response\.job\.atlasId !== requestedAtlasId/);
  assert.match(clientScript, /currentAtlas\?\.latestPreviewJobId !== jobId/);
  assert.match(clientScript, /cutterButton\.disabled = state\.cutterPending/);
  assert.match(clientScript, /let sourceIntakeFormCache = null/);
  assert.match(clientScript, /selectedSourceFile\?\.files\?\.length > 0/);
  assert.match(clientScript, /sourceFileChooserActive/);
  assert.match(clientScript, /Selected .* Ready to import/);
  assert.match(clientScript, /resetSourceIntakeForm\(\)/);
  assert.match(clientScript, /Resume staged intake .* selected file .* current import form will be cleared/s);
  assert.match(clientScript, /if \(file\) file\.value = ''/);
  assert.match(clientScript, /elements\['project-select'\]\.value !== state\.project\.projectId/);
  assert.match(clientScript, /const operationProjectId = state\.project\.projectId/);
  assert.match(clientScript, /const operationRevision = state\.project\.revision/);
  assert.match(clientScript, /const operationCsrf = state\.agentAccessCsrf/);
  assert.match(clientScript, /sourceOperationKey\('source-intake-upload', 'pending', operationProjectId\)/);
  assert.match(clientScript, /const commitIdempotencyTarget = stagedIntake\?\.intakeId \?\? 'pending'/);
  assert.match(clientScript, /'source-intake-commit', commitIdempotencyTarget, operationProjectId/);
  assert.match(clientScript, /state\.project\?\.projectId === operationProjectId[\s\S]*state\.project\.revision === operationRevision[\s\S]*state\.agentAccessCsrf === operationCsrf/);
  assert.match(clientScript, /intake\?\.schemaVersion !== 1 \|\| intake\.projectId !== operationProjectId/);
  assert.match(clientScript, /expectedRevision: operationRevision/);
  assert.match(clientScript, /committed\?\.schemaVersion !== 1 \|\| committed\.projectId !== operationProjectId[\s\S]*committed\.revision !== operationRevision \+ 1/);
  assert.match(clientScript, /let durableIntakeReady = Boolean\(stagedIntake\)/);
  assert.match(clientScript, /resetSourceIntakeForm\(\);[\s\S]*renderWorkspace\(\);[\s\S]*remains staged; retry commits this exact artifact or discard it/);
  const sourcePendingHelper = clientScript.slice(
    clientScript.indexOf('function setSourceIntakeFormPending'), clientScript.indexOf('function sourceOperationKey'),
  );
  assert.match(sourcePendingHelper, /querySelectorAll\('input, select, textarea, button'\)/);
  assert.match(sourcePendingHelper, /control\.disabled = true/);
  assert.doesNotMatch(sourcePendingHelper, /form\.inert/);
  const browserEvidenceScript = await readFile(
    new URL('../scripts/capture-studio-browser-evidence.js', import.meta.url), 'utf8',
  );
  assert.match(browserEvidenceScript, /allFormControlsDisabled/);
  assert.match(browserEvidenceScript, /selectedProjectWhilePending/);
  assert.match(browserEvidenceScript, /expectedRevision === sourceImportOperationIsolation\.operationRevision/);
  assert.match(browserEvidenceScript, /mismatch\.commitCount === 0/);
  assert.match(browserEvidenceScript, /commitFailureRecovery\.oldFileCount === 0/);
  assert.match(browserEvidenceScript, /commitFailureRecovery\.currentFileDisabled === true/);
  assert.match(browserEvidenceScript, /liveStatusOutsideInert === true/);
  assert.match(clientScript, /response\?\.projectId !== operationProjectId/);
  assert.match(clientScript, /response\.job\?\.jobId !== operationJobId/);
  assert.match(clientScript, /state\.cutterJob = response\.job/);
  assert.match(clientScript, /state\.cutterJobEvents = response\.events \?\? \[\]/);
  assert.match(clientScript, /state\.cutterJobEvents\.at\(-1\)\?\.state !== state\.cutterJob\?\.state/);
  assert.match(clientScript, /body: JSON\.stringify\(operation\)/);
  assert.match(clientScript, /Publish is never included/);
  assert.match(clientScript, /Command budget/);
  assert.match(clientScript, /MCP host authorized/);
  assert.match(clientScript, /dataset\.renderFingerprint/);
  assert.match(clientScript, /Close' : 'Open/);
  const sourcePreviewRenderer = clientScript.slice(
    clientScript.indexOf('function sourcePreview'), clientScript.indexOf('function card'),
  );
  assert.match(sourcePreviewRenderer, /link\.target = '_blank'/);
  assert.match(sourcePreviewRenderer, /link\.rel = 'noopener noreferrer'/);
  assert.match(sourcePreviewRenderer, /link\.referrerPolicy = 'no-referrer'/);
  assert.match(sourcePreviewRenderer, /Open .* original source image in a new tab/);
  assert.match(sourcePreviewRenderer, /caption\.textContent = 'Open original in new tab ↗'/);
  assert.match(sourcePreviewRenderer, /link\.setAttribute\('aria-describedby', caption\.id\)/);
  const overviewRenderer = clientScript.slice(
    clientScript.indexOf('function renderOverview'), clientScript.indexOf('function renderCollection'),
  );
  const collectionRenderer = clientScript.slice(
    clientScript.indexOf('function renderCollection'), clientScript.indexOf('function renderActivityWorkspace'),
  );
  assert.doesNotMatch(overviewRenderer, /workspace === 'assets'/);
  assert.match(collectionRenderer, /workspace === 'assets'.*asset-grid/s);
  assert.doesNotMatch(clientScript, /localStorage/);
  assert.doesNotMatch(clientScript, /NUMBERDROID_STUDIO_BINDING_TOKEN/);
  const styles = await fetch(`${base}/styles.css`).then((response) => response.text());
  assert.match(styles, /\.asset-preview/);
  assert.match(styles, /aspect-ratio: 1/);
  assert.match(styles, /object-fit: contain/);
  assert.match(styles, /\.source-preview-frame \{ width: min\(100%, 220px\)/);
  assert.match(styles, /\.source-preview \{[^}]*display: flex[^}]*align-items: center[^}]*justify-content: center[^}]*max-width: 220px[^}]*min-width: 0[^}]*min-height: 0[^}]*aspect-ratio: 1[^}]*padding: 6px[^}]*overflow: visible/);
  assert.match(styles, /\.source-preview img \{[^}]*width: auto[^}]*height: auto[^}]*min-width: 0[^}]*min-height: 0[^}]*max-width: 100%[^}]*max-height: 100%[^}]*object-fit: contain[^}]*object-position: center/);
  assert.match(styles, /\.source-preview-frame figcaption/);
  assert.match(styles, /@media \(max-width: 1200px\)/);
  assert.match(styles, /\.agent-access-input select \{ width: 150px/);

  const blindDemo = await fetch(`${base}/api/demo`, { method: 'POST' });
  assert.equal(blindDemo.status, 403);
  assert.equal((await blindDemo.json()).error.code, 'UI_ORIGIN_REQUIRED');
  const humanHeaders = await humanMutationHeaders(base);
  const demoResponse = await fetch(`${base}/api/demo`, { method: 'POST', headers: humanHeaders });
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
  assert.equal(access.hostBindingSupport, 'SQLITE_REQUIRED');
  assert.deepEqual(access.hostBindings, []);

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

  const retryResponse = await fetch(`${base}/api/demo/action?action=idempotent-retry`, { method: 'POST', headers: humanHeaders });
  assert.equal(retryResponse.status, 200);
  const retry = await retryResponse.json();
  assert.equal(retry.replayed, true);
  assert.equal(retry.revision, 3);
  assert.equal((await studioService.readProjectTrusted(demo.projectId)).revision, 5);

  const staleResponse = await fetch(`${base}/api/demo/action?action=stale-write`, { method: 'POST', headers: humanHeaders });
  assert.equal(staleResponse.status, 409);
  assert.equal((await staleResponse.json()).error.code, 'REVISION_CONFLICT');
  assert.equal((await studioService.readProjectTrusted(demo.projectId)).revision, 5);

  const revokeResponse = await fetch(`${base}/api/demo/action?action=revoke-grant`, { method: 'POST', headers: humanHeaders });
  assert.equal(revokeResponse.status, 200);
  const revoke = await revokeResponse.json();
  assert.equal(revoke.revision, 6);

  const deniedResponse = await fetch(`${base}/api/demo/action?action=post-revoke-attempt`, { method: 'POST', headers: humanHeaders });
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
  const humanHeaders = await humanMutationHeaders(base);
  const demo = await fetch(`${base}/api/demo`, { method: 'POST', headers: humanHeaders }).then((response) => response.json());
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
  assert.equal(proposal.changed, false);
  assert.equal(proposal.effectivePolicy.draftWorkspaceRequired, true);
  assert.equal(proposal.effectivePolicy.warnings.at(-1).code, 'DRAFT_BRANCH_NOT_AVAILABLE_1B');
  let project = await studioService.readProjectTrusted(demo.projectId);
  assert.equal(project.revision, 5);

  const readOnlyResponse = await change({
    mode: 'read_only', confirmBroaderAccess: true, idempotencyKey: 'access.read-only',
  });
  assert.equal(readOnlyResponse.status, 200);
  const readOnlyInitial = await readOnlyResponse.json();
  assert.equal(readOnlyInitial.effectivePolicy.state, 'ACTIVE_READ_ONLY');
  project = await studioService.readProjectTrusted(demo.projectId);
  assert.equal((await studioService.readProjectTrusted(demo.projectId)).revision, 7);
  let active = project.snapshot.grants.find((grant) => !grant.revokedAt);
  assert.deepEqual(active.scopes, ['project.read']);
  assert.equal(active.branchId, 'branch.demo-atlas');

  const replay = await change({ mode: 'read_only', idempotencyKey: 'access.read-only' }).then((response) => response.json());
  assert.equal(replay.idempotentReplay, true);
  assert.equal((await studioService.readProjectTrusted(demo.projectId)).revision, 7);

  const reusedKey = await change({ mode: 'execute_scoped', idempotencyKey: 'access.read-only' });
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
  const asset = { id: 'asset.preview', name: 'Preview tile', kind: 'surface', region: { x: 0, y: 0, width: 16, height: 16 } };
  assert.equal(assetPreviewProjection(asset, null).state, 'MISSING');
  assert.equal(assetPreviewProjection(asset, { artifactUri: 'studio://artifact', mediaType: 'image/svg+xml' }).state, 'UNSUPPORTED');
  assert.equal(assetPreviewProjection(asset, { artifactUri: 'studio://artifact', mediaType: 'image/png' }).state, 'PROCESSING');
  assert.equal(assetPreviewProjection({ ...asset, preview: { state: 'READY', resourceUri: 'https://evil.example/asset.png' } }, {}).state, 'LOAD_FAILED');
  assert.equal(assetPreviewProjection(asset, {
    artifactUri: `studio://artifacts/sha256/${'a'.repeat(64)}`,
    mediaType: 'image/png', width: 32, height: 32,
  }, { projectId: 'project.preview' }).state, 'PROCESSING');
  assert.deepEqual(assetPreviewProjection({
    ...asset,
    preview: {
      state: 'READY',
      resourceUri: `/api/projects/project.preview/artifacts/sha256/${'b'.repeat(64)}`,
      alt: 'Clean tile preview',
    },
  }, {}), {
    schemaVersion: 1,
    state: 'READY',
    resourceUri: `/api/projects/project.preview/artifacts/sha256/${'b'.repeat(64)}`,
    kind: 'surface',
    alt: 'Clean tile preview',
  });
});

test('job output projection yields only project-scoped same-origin preview resources', () => {
  const digest = 'c'.repeat(64);
  const projected = jobHttpProjection({
    schemaVersion: 1,
    projectId: 'project.preview',
    job: {
      jobId: 'job.preview',
      state: 'SUCCEEDED',
      outputs: [{
        rectangleId: 'rect.preview', digest, mediaType: 'image/png',
        byteSize: 4, width: 1, height: 1,
      }],
    },
  });
  assert.deepEqual(projected.job.outputs[0].preview, {
    schemaVersion: 1,
    state: 'READY',
    resourceUri: `/api/projects/project.preview/artifacts/sha256/${digest}`,
    alt: 'Atlas preview rect.preview',
  });
  assert.equal(jobHttpProjection({
    schemaVersion: 1,
    projectId: 'project.preview',
    job: { state: 'SUCCEEDED', outputs: [{ rectangleId: 'rect.bad', digest: 'not-a-digest', mediaType: 'image/png' }] },
  }).job.outputs[0].preview.resourceUri, null);
  assert.deepEqual(jobHttpProjection({
    schemaVersion: 1,
    projectId: 'project.preview',
    job: { state: 'DISCARDED', outputs: [{ rectangleId: 'rect.old', digest, mediaType: 'image/png' }] },
  }).job.outputs[0].preview, {
    schemaVersion: 1,
    state: 'MISSING',
    resourceUri: null,
    alt: 'Atlas preview rect.old',
  });
});
