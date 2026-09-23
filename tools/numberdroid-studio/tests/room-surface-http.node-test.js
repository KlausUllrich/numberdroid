import assert from 'node:assert/strict';
import test from 'node:test';
import { createStudioHttpServer } from '../apps/studio-server/src/server.js';

async function listen(context, server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

function body() {
  return {
    expectedRevision: 7,
    idempotencyKey: 'surface.http.one',
    expectedRoomVariantVersion: 3,
    plannerVersion: 'numberdroid-studio.room-surface-plan.v1',
    scopeCells: [{ x: 1, y: 1 }],
    policy: 'replace',
    pool: [{ assetId: 'asset.floor', assetVersion: 2, metadataVersion: 3 }],
    baseRotation: 0,
    randomRotation: false,
    seed: 'seed.http',
    placementIdPrefix: 'surface.http',
    overlapKeepPlacementIds: [],
    planFingerprint: 'a'.repeat(64),
  };
}

function service() {
  const calls = [];
  return {
    calls,
    commandCatalog: [],
    durableClipStoreReady: false,
    durableReviewStoreReady: false,
    durableAssemblyStoreReady: false,
    durableAssetStoreReady: true,
    durableRoomStoreReady: true,
    async readProjectTrusted(projectId) {
      return { schemaVersion: 1, projectId, revision: 7, snapshot: { project: { ownerId: 'designer.one' }, grants: [] } };
    },
    async execute(command, context) {
      calls.push({ command: structuredClone(command), context: structuredClone(context) });
      return { schemaVersion: 1, projectId: command.projectId, revision: command.dryRun ? 7 : 8, value: { type: command.type }, replayed: false, ...(command.dryRun ? { dryRun: true } : {}) };
    },
  };
}

async function post(base, action, value, csrfToken) {
  return fetch(`${base}/api/projects/project.one/rooms/room.one/${action}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: base,
      'sec-fetch-site': 'same-origin',
      'x-numberdroid-studio-csrf': csrfToken,
    },
    body: JSON.stringify(value),
  });
}

test('Surface preview/apply/undo HTTP routes preserve dry-run and strict semantic payloads', async (context) => {
  const studio = service();
  const base = await listen(context, createStudioHttpServer({ studioService: studio }));
  const session = await fetch(`${base}/api/ui-session`).then((response) => response.json());

  const previewResponse = await post(base, 'surfaces-preview', body(), session.csrfToken);
  assert.equal(previewResponse.status, 200);
  assert.equal((await previewResponse.json()).dryRun, true);
  assert.equal(studio.calls[0].command.type, 'room.variant.surfaces.apply');
  assert.equal(studio.calls[0].command.dryRun, true);
  assert.deepEqual(studio.calls[0].command.payload.scopeCells, [{ x: 1, y: 1 }]);
  assert.equal(studio.calls[0].command.payload.planFingerprint, 'a'.repeat(64));

  const applyResponse = await post(base, 'surfaces-apply', body(), session.csrfToken);
  assert.equal(applyResponse.status, 200);
  assert.equal(studio.calls[1].command.type, 'room.variant.surfaces.apply');
  assert.equal(studio.calls[1].command.dryRun, false);
  assert.deepEqual(studio.calls[1].command.payload, studio.calls[0].command.payload);

  const undoResponse = await post(base, 'surfaces-undo', {
    expectedRevision: 8,
    idempotencyKey: 'surface.http.undo',
    expectedRoomVariantVersion: 4,
    appliedRoomVariantVersion: 4,
    appliedPlanFingerprint: 'a'.repeat(64),
  }, session.csrfToken);
  assert.equal(undoResponse.status, 200);
  assert.equal(studio.calls[2].command.type, 'room.variant.surfaces.undo');
  assert.equal(studio.calls[2].command.dryRun, false);
  assert.deepEqual(studio.calls[2].command.payload, {
    roomVariantId: 'room.one', expectedRoomVariantVersion: 4,
    appliedRoomVariantVersion: 4, appliedPlanFingerprint: 'a'.repeat(64),
  });

  const unknownResponse = await post(base, 'surfaces-apply', { ...body(), extra: true }, session.csrfToken);
  assert.equal(unknownResponse.status, 400);
  assert.equal((await unknownResponse.json()).error.code, 'VALIDATION_ERROR');
  assert.equal(studio.calls.length, 3);
});

test('Surface HTTP routes require same-origin CSRF and serve only explicit browser modules', async (context) => {
  const studio = service();
  const base = await listen(context, createStudioHttpServer({ studioService: studio }));
  const denied = await fetch(`${base}/api/projects/project.one/rooms/room.one/surfaces-apply`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body()),
  });
  assert.equal(denied.status, 403);
  assert.equal(studio.calls.length, 0);

  for (const path of [
    '/room-surface-editor.js',
    '/room-surface-plan.js',
    '/packages/domain/src/room-surface-plan.js',
  ]) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('content-type'), /^text\/javascript/);
    assert.ok((await response.text()).length > 0);
  }
});
