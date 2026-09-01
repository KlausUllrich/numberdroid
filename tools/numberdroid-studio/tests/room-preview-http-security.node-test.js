import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createStudioHttpServer } from '../apps/studio-server/src/server.js';
import { StudioService } from '../packages/application/src/index.js';
import { InMemoryProjectStore } from '../packages/persistence/src/index.js';
import {
  OWNER,
  OWNER_CONTEXT,
  PROJECT_ID,
  createProject,
} from './test-helpers.js';

const DIGEST = '7'.repeat(64);
const ROOM_ID = 'room.preview-http';
const MISSING_ASSET_ROOM_ID = 'room.preview-http-missing-asset';

class TrackingRoomStore extends InMemoryProjectStore {
  supportsAtomicRoomDesigner = true;
  writeCalls = [];

  async createProject(document) {
    this.writeCalls.push({ operation: 'createProject', projectId: document.projectId });
    return super.createProject(document);
  }

  async appendRevision(projectId, expectedRevision, revision) {
    this.writeCalls.push({ operation: 'appendRevision', projectId, expectedRevision, revision: revision.number });
    return super.appendRevision(projectId, expectedRevision, revision);
  }
}

function placement({ placementId, assetId = 'asset.preview-http' }) {
  return {
    placementId,
    assetId,
    assetVersion: 1,
    metadataVersion: 1,
    layer: 'SET_DRESSING',
    anchor: { x: 1, y: 1 },
    rotation: 0,
    variantTag: null,
    proposalId: null,
    proposalItemId: null,
  };
}

function room(roomVariantId, assetId) {
  return {
    projectId: PROJECT_ID,
    roomVariantId,
    version: 1,
    roomArchetypeId: 'archetype.preview-http',
    archetypeVersion: 1,
    displayName: 'HTTP preview fixture',
    lifecycle: 'DRAFT',
    width: 4,
    height: 3,
    origin: { x: 0, y: 0 },
    intentTrace: [],
    connectors: [],
    placements: [placement({ placementId: `${roomVariantId}.placement`, assetId })],
    voidCells: [],
    blockedCells: [],
    acceptedWarningFindingIds: [],
    parentVariantVersion: null,
    parentFinalVersion: null,
    findings: [{
      findingId: 'finding.preview-http',
      severity: 'WARNING',
      ruleId: 'studio.room.preview-http',
      targetKind: 'roomPlacement',
      targetId: `${roomVariantId}.placement`,
      path: '/placements/0/anchor',
      explanation: 'Fixture finding.',
      remediation: 'Inspect the exact placement.',
      validatorVersion: 'numberdroid-studio.room-validator.v2',
    }],
    contentFingerprint: 'a'.repeat(64),
    createdAt: '2026-09-01T12:02:00.000Z',
    createdBy: OWNER.id,
    createdRevision: 2,
    proposalId: null,
    provenance: 'native_revision',
  };
}

function fixtureRevision(snapshot) {
  return {
    id: 'revision:2',
    number: 2,
    parentRevision: 1,
    committedAt: '2026-09-01T12:02:00.000Z',
    command: {
      schemaVersion: 1,
      commandId: 'cmd.preview-http.fixture',
      idempotencyKey: 'idem.preview-http.fixture',
      type: 'test.preview-http.fixture',
      actor: structuredClone(OWNER),
      taskId: null,
      grantId: null,
      fingerprint: 'b'.repeat(64),
    },
    snapshot,
    result: { seededRevision: 2 },
    event: {
      id: 'activity:cmd.preview-http.fixture',
      projectId: PROJECT_ID,
      revision: 2,
      occurredAt: '2026-09-01T12:02:00.000Z',
      actor: structuredClone(OWNER),
      taskId: null,
      commandId: 'cmd.preview-http.fixture',
      commandType: 'test.preview-http.fixture',
      status: 'committed',
      summary: 'Preview HTTP fixture.',
      changes: [{ entityType: 'preview_fixture', entityId: ROOM_ID, operation: 'created' }],
    },
  };
}

async function createFixture() {
  const store = new TrackingRoomStore();
  const studio = new StudioService({ store, clock: () => '2026-09-01T12:02:00.000Z' });
  await createProject(studio);
  const created = await store.loadProject(PROJECT_ID);
  const asset = {
    assetId: 'asset.preview-http',
    assetVersion: 1,
    metadataVersion: 1,
    name: 'Preview fixture',
    kind: 'prop',
    lifecycle: 'FINAL',
    metadata: {
      spanTiles: { width: 1, height: 1 },
      extensions: {
        // Generic extension data is intentionally hostile. The scene projection
        // must not turn it into resource, command, or authority output.
        'fixture.untrusted': {
          filePath: '/private/preview.png',
          resourceUri: 'https://example.invalid/preview.png',
          command: 'publish',
          authority: 'owner',
        },
      },
    },
    metadataFingerprint: 'c'.repeat(64),
    findings: [],
    sliceBinding: {
      projectId: PROJECT_ID,
      digest: DIGEST,
      artifactUri: `studio://artifacts/sha256/${DIGEST}`,
      mediaType: 'image/png',
      width: 32,
      height: 32,
    },
  };
  const exactRoom = room(ROOM_ID, asset.assetId);
  const missingAssetRoom = room(MISSING_ASSET_ROOM_ID, 'asset.not-present');
  const snapshot = {
    ...structuredClone(created.revisions.at(-1).snapshot),
    assetLibrary: { schemaVersion: 1, assets: [asset], proposals: [] },
    roomLibrary: {
      schemaVersion: 1,
      archetypes: [],
      variants: [exactRoom, missingAssetRoom].map((value) => ({
        roomVariantId: value.roomVariantId,
        headVersion: value.version,
        versions: [value],
      })),
      proposals: [],
    },
  };
  await store.appendRevision(PROJECT_ID, 1, fixtureRevision(snapshot));
  return { store, studio };
}

async function listen(context, server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

function previewPath({ projectRevision = 2, roomVariantId = ROOM_ID, roomVersion = 1 } = {}) {
  return `/api/projects/${encodeURIComponent(PROJECT_ID)}/revisions/${projectRevision}`
    + `/room-variants/${encodeURIComponent(roomVariantId)}/versions/${roomVersion}/preview-scene`;
}

function assertNoAuthorityOrResourceActions(scene) {
  const forbiddenKeys = /^(?:actor|taskId|grantId|branchId|authority|hostBinding|idempotencyKey|commandId|command|actions?|accept|approve|finalize|merge|publish|release|materialize|repository|engineBridge|artifactUri|uri|url|href|filePath|machinePath)$/i;
  const walk = (value, location = '$') => {
    if (value === null || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach((child, index) => walk(child, `${location}[${index}]`));
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      const childLocation = `${location}.${key}`;
      assert.doesNotMatch(key, forbiddenKeys, `forbidden scene key at ${childLocation}`);
      if (key === 'path') {
        assert.match(childLocation, /^\$(?:\.room)?\.findings\[\d+\]\.path$/);
        assert.match(child, /^\/(?:[A-Za-z0-9._~-]+(?:\/|$))*$/);
      }
      if (key === 'resourceUri') {
        assert.match(childLocation, /^\$\.entities\[\d+\](?:\.segments\[\d+\])?\.artifact\.resourceUri$/);
        assert.equal(
          child,
          `/api/projects/${encodeURIComponent(scene.source.projectId)}/artifacts/sha256/${value.digest}`,
        );
      }
      walk(child, childLocation);
    }
  };
  walk(scene);
  const serialized = JSON.stringify(scene);
  assert.doesNotMatch(serialized, /private\/preview|example\.invalid|studio:\/\/artifacts|\bpublish\b|\bowner\b/i);
}

test('room preview HTTP GET is exact, queryless, deterministic, and has no mutation authority', { timeout: 20_000 }, async (context) => {
  const { store, studio } = await createFixture();
  const calls = { readProjectTrusted: 0, queryRoomPreviewSource: 0, execute: 0 };
  const originalReadProjectTrusted = studio.readProjectTrusted.bind(studio);
  const originalQueryRoomPreviewSource = studio.queryRoomPreviewSource.bind(studio);
  const originalExecute = studio.execute.bind(studio);
  studio.readProjectTrusted = (...args) => {
    calls.readProjectTrusted += 1;
    return originalReadProjectTrusted(...args);
  };
  studio.queryRoomPreviewSource = (...args) => {
    calls.queryRoomPreviewSource += 1;
    return originalQueryRoomPreviewSource(...args);
  };
  studio.execute = (...args) => {
    calls.execute += 1;
    return originalExecute(...args);
  };

  const persistedBefore = JSON.stringify(await store.loadProject(PROJECT_ID));
  const writesBefore = structuredClone(store.writeCalls);
  const catalogBefore = JSON.stringify(studio.commandCatalog);
  const base = await listen(context, createStudioHttpServer({ studioService: studio }));
  const path = previewPath();

  for (const method of ['HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    const response = await fetch(`${base}${path}`, { method });
    assert.equal(response.status, 405, method);
    assert.equal(response.headers.get('allow'), 'GET', method);
  }
  assert.deepEqual(calls, { readProjectTrusted: 0, queryRoomPreviewSource: 0, execute: 0 });

  const queryResponse = await fetch(`${base}${path}?overlay=true`);
  assert.equal(queryResponse.status, 400);
  assert.equal((await queryResponse.json()).error.code, 'VALIDATION_ERROR');
  assert.deepEqual(calls, { readProjectTrusted: 0, queryRoomPreviewSource: 0, execute: 0 });

  const firstResponse = await fetch(`${base}${path}`);
  const firstText = await firstResponse.text();
  assert.equal(firstResponse.status, 200);
  assert.equal(firstResponse.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(firstResponse.headers.get('cache-control'), 'no-store');
  assert.equal(firstResponse.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(firstResponse.headers.get('cross-origin-resource-policy'), 'same-origin');
  const scene = JSON.parse(firstText);
  assert.deepEqual(scene.source, {
    projectId: PROJECT_ID,
    projectRevision: 2,
    roomVariantId: ROOM_ID,
    roomVersion: 1,
    roomContentFingerprint: 'a'.repeat(64),
  });
  assert.equal(scene.kind, 'studio.room-preview-scene');
  assert.equal(scene.entities.length, 1);
  assert.deepEqual(scene.entities[0].artifact, {
    digest: DIGEST,
    mediaType: 'image/png',
    pixelSize: { width: 32, height: 32 },
    resourceUri: `/api/projects/${encodeURIComponent(PROJECT_ID)}/artifacts/sha256/${DIGEST}`,
  });
  assert.equal(scene.entities[0].source.assetId, 'asset.preview-http');
  assert.equal(scene.entities[0].source.assetVersion, 1);
  assert.equal(scene.entities[0].source.metadataVersion, 1);
  assert.equal(scene.room.findings[0].path, '/placements/0/anchor');
  assertNoAuthorityOrResourceActions(scene);

  const secondResponse = await fetch(`${base}${path}`);
  const secondText = await secondResponse.text();
  assert.equal(secondResponse.status, 200);
  assert.equal(secondText, firstText);
  assert.deepEqual(JSON.parse(secondText), scene);

  const staleRevisionResponse = await fetch(`${base}${previewPath({ projectRevision: 1 })}`);
  assert.equal(staleRevisionResponse.status, 409);
  assert.equal((await staleRevisionResponse.json()).error.code, 'REVISION_CONFLICT');

  const staleRoomResponse = await fetch(`${base}${previewPath({ roomVersion: 2 })}`);
  assert.equal(staleRoomResponse.status, 409);
  assert.equal((await staleRoomResponse.json()).error.code, 'ROOM_VERSION_CONFLICT');

  const missingAssetResponse = await fetch(`${base}${previewPath({ roomVariantId: MISSING_ASSET_ROOM_ID })}`);
  assert.notEqual(missingAssetResponse.status, 200);
  const missingAsset = await missingAssetResponse.json();
  assert.equal(missingAsset.error.code, 'ROOM_ASSET_VERSION_NOT_FOUND');
  assert.equal(missingAsset.kind, undefined);
  assert.equal(missingAsset.entities, undefined);

  assert.deepEqual(calls, { readProjectTrusted: 5, queryRoomPreviewSource: 5, execute: 0 });
  assert.equal(JSON.stringify(await store.loadProject(PROJECT_ID)), persistedBefore);
  assert.deepEqual(store.writeCalls, writesBefore);
  assert.equal(JSON.stringify(studio.commandCatalog), catalogBefore);
});

test('room preview HTTP handler has no mutation, MCP, or EngineBridge call path', { timeout: 5_000 }, async () => {
  const source = await readFile(new URL('../apps/studio-server/src/server.js', import.meta.url), 'utf8');
  const start = source.indexOf('const roomPreviewSceneRequest = roomPreviewSceneRoute(url.pathname);');
  const end = source.indexOf('const roomRequest = roomRoute(url.pathname);', start);
  assert.ok(start >= 0 && end > start, 'room preview HTTP handler must remain an explicit bounded route');
  const handler = source.slice(start, end);
  assert.match(handler, /request\.method !== 'GET'/);
  assert.match(handler, /url\.search !== ''/);
  assert.match(handler, /queryRoomPreviewSource/);
  assert.doesNotMatch(handler, /\.execute\s*\(/);
  assert.doesNotMatch(handler, /assertHumanUiMutation|\/internal\/mcp|EngineBridge|validateCandidate/);
});
