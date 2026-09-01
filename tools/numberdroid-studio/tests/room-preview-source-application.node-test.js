import assert from 'node:assert/strict';
import test from 'node:test';
import { StudioService } from '../packages/application/src/index.js';
import { InMemoryProjectStore } from '../packages/persistence/src/index.js';
import {
  OWNER,
  OWNER_CONTEXT,
  PROJECT_ID,
  createProject,
} from './test-helpers.js';

class TrackingRoomReadyStore extends InMemoryProjectStore {
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

function asset({
  assetId = 'asset.table', assetVersion = 1, metadataVersion = 1,
  digestDigit = '1', name = `Table v${assetVersion}`,
} = {}) {
  const digest = digestDigit.repeat(64);
  return {
    assetId,
    assetVersion,
    metadataVersion,
    name,
    kind: 'prop',
    lifecycle: 'FINAL',
    metadata: {
      spanTiles: { width: 1, height: 1 },
      anchor: { x: 0, y: 0 },
      selectionPriority: assetVersion,
      extensions: { previewMarker: `${assetId}@${assetVersion}:${metadataVersion}` },
    },
    metadataFingerprint: digest,
    findings: [],
    sliceBinding: {
      digest,
      artifactUri: `studio://artifacts/sha256/${digest}`,
      mediaType: 'image/png',
      width: 64,
      height: 64,
    },
    warningDispositions: [],
    createdAt: '2026-09-01T10:00:00.000Z',
    createdBy: OWNER.id,
    updatedAt: '2026-09-01T10:00:00.000Z',
    updatedBy: OWNER.id,
    proposal: null,
  };
}

function placement({ placementId, assetId = 'asset.table' }) {
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

function room({ roomVariantId, assetId = 'asset.table' }) {
  return {
    projectId: PROJECT_ID,
    roomVariantId,
    version: 1,
    roomArchetypeId: 'archetype.preview',
    archetypeVersion: 1,
    displayName: roomVariantId,
    lifecycle: 'DRAFT',
    width: 4,
    height: 3,
    origin: { x: 0, y: 0 },
    intentTrace: [],
    connectors: [],
    placements: [
      placement({ placementId: `${roomVariantId}.placement.1`, assetId }),
      placement({ placementId: `${roomVariantId}.placement.2`, assetId }),
    ],
    voidCells: [],
    blockedCells: [],
    acceptedWarningFindingIds: [],
    parentVariantVersion: null,
    parentFinalVersion: null,
    findings: [],
    contentFingerprint: 'a'.repeat(64),
    createdAt: '2026-09-01T10:02:00.000Z',
    createdBy: OWNER.id,
    createdRevision: 3,
    proposalId: null,
    provenance: 'native_revision',
  };
}

function revision({ number, snapshot }) {
  const committedAt = `2026-09-01T10:0${number}:00.000Z`;
  return {
    id: `revision:${number}`,
    number,
    parentRevision: number - 1,
    committedAt,
    command: {
      schemaVersion: 1,
      commandId: `cmd.preview.fixture.${number}`,
      idempotencyKey: `idem.preview.fixture.${number}`,
      type: 'test.preview.fixture',
      actor: structuredClone(OWNER),
      taskId: 'task.preview.fixture',
      grantId: null,
      fingerprint: String(number).repeat(64),
    },
    snapshot: structuredClone(snapshot),
    result: { seededRevision: number },
    event: {
      id: `activity:cmd.preview.fixture.${number}`,
      projectId: PROJECT_ID,
      revision: number,
      occurredAt: committedAt,
      actor: structuredClone(OWNER),
      taskId: 'task.preview.fixture',
      commandId: `cmd.preview.fixture.${number}`,
      commandType: 'test.preview.fixture',
      status: 'committed',
      summary: `Preview fixture revision ${number}.`,
      changes: [{ entityType: 'preview_fixture', entityId: `fixture.${number}`, operation: 'updated' }],
    },
  };
}

function assertDeepFrozen(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child, seen);
}

function persistedStateBytes(document) {
  return {
    document: JSON.stringify(document),
    revisions: JSON.stringify(document.revisions),
    activity: JSON.stringify(document.revisions.map(({ event }) => event)),
    tasks: JSON.stringify(document.revisions.map(({ command, event }) => ({
      commandTaskId: command.taskId,
      eventTaskId: event.taskId,
    }))),
    idempotency: JSON.stringify(document.revisions.map(({ command }) => ({
      commandId: command.commandId,
      idempotencyKey: command.idempotencyKey,
      fingerprint: command.fingerprint,
    }))),
  };
}

async function fixture() {
  const store = new TrackingRoomReadyStore();
  const studio = new StudioService({
    store,
    clock: () => '2026-09-01T10:00:00.000Z',
  });
  await createProject(studio);

  const created = await store.loadProject(PROJECT_ID);
  const baseSnapshot = created.revisions.at(-1).snapshot;
  const assetV1 = asset();
  const exactRoom = room({ roomVariantId: 'room.exact-preview' });
  const futureAssetRoom = room({ roomVariantId: 'room.future-asset', assetId: 'asset.future' });

  const revision2Snapshot = {
    ...structuredClone(baseSnapshot),
    assetLibrary: { schemaVersion: 1, assets: [assetV1], proposals: [] },
    roomLibrary: { schemaVersion: 1, archetypes: [], variants: [], proposals: [] },
  };
  await store.appendRevision(PROJECT_ID, 1, revision({ number: 2, snapshot: revision2Snapshot }));

  const revision3Snapshot = {
    ...structuredClone(revision2Snapshot),
    roomLibrary: {
      schemaVersion: 1,
      archetypes: [],
      variants: [
        { roomVariantId: exactRoom.roomVariantId, headVersion: 1, versions: [exactRoom] },
        { roomVariantId: futureAssetRoom.roomVariantId, headVersion: 1, versions: [futureAssetRoom] },
      ],
      proposals: [],
    },
  };
  await store.appendRevision(PROJECT_ID, 2, revision({ number: 3, snapshot: revision3Snapshot }));

  const revision4Snapshot = structuredClone(revision3Snapshot);
  revision4Snapshot.assetLibrary.assets = [
    asset({ assetVersion: 2, metadataVersion: 2, digestDigit: '2' }),
    asset({ assetId: 'asset.future', digestDigit: '3' }),
  ];
  await store.appendRevision(PROJECT_ID, 3, revision({ number: 4, snapshot: revision4Snapshot }));

  return { store, studio };
}

test('queryRoomPreviewSource resolves historical exact pins deterministically and performs no writes', { timeout: 10_000 }, async () => {
  const { store, studio } = await fixture();
  const current = await store.loadProject(PROJECT_ID);
  assert.equal(current.revisions.at(-1).snapshot.assetLibrary.assets[0].assetVersion, 2);
  assert.equal(current.revisions.at(-1).snapshot.assetLibrary.assets[0].metadataVersion, 2);
  const before = persistedStateBytes(current);
  const writesBefore = structuredClone(store.writeCalls);

  const request = {
    schemaVersion: 1,
    projectId: PROJECT_ID,
    projectRevision: 4,
    roomVariantId: 'room.exact-preview',
    roomVersion: 1,
  };
  const first = await studio.queryRoomPreviewSource(request, OWNER_CONTEXT);
  const second = await studio.queryRoomPreviewSource(structuredClone(request), OWNER_CONTEXT);

  assert.deepEqual(second, first);
  assert.equal(JSON.stringify(second), JSON.stringify(first));
  assertDeepFrozen(first);
  assertDeepFrozen(second);
  assert.equal(first.projectRevision, 4);
  assert.equal(first.room.roomVariantId, 'room.exact-preview');
  assert.equal(first.room.version, 1);
  assert.equal(first.room.createdRevision, 3);
  assert.equal(first.room.placements.length, 2);
  assert.equal(first.assets.length, 1);
  assert.deepEqual(
    first.assets.map(({ assetId, assetVersion, metadataVersion, name }) => ({ assetId, assetVersion, metadataVersion, name })),
    [{ assetId: 'asset.table', assetVersion: 1, metadataVersion: 1, name: 'Table v1' }],
  );
  assert.equal(first.assets[0].sliceBinding.digest, '1'.repeat(64));

  await assert.rejects(
    studio.queryRoomPreviewSource({ ...request, projectRevision: 3 }, OWNER_CONTEXT),
    (error) => error.code === 'REVISION_CONFLICT'
      && error.details.expectedRevision === 3
      && error.details.actualRevision === 4,
  );
  await assert.rejects(
    studio.queryRoomPreviewSource({ ...request, roomVersion: 2 }, OWNER_CONTEXT),
    (error) => error.code === 'ROOM_VERSION_CONFLICT'
      && error.details.expectedVersion === 2
      && error.details.actualVersion === 1,
  );
  await assert.rejects(
    studio.queryRoomPreviewSource({ ...request, roomVariantId: 'room.future-asset' }, OWNER_CONTEXT),
    (error) => error.code === 'ROOM_ASSET_VERSION_NOT_FOUND'
      && error.details.assetId === 'asset.future'
      && error.details.assetVersion === 1
      && error.details.metadataVersion === 1,
  );

  const after = persistedStateBytes(await store.loadProject(PROJECT_ID));
  assert.deepEqual(after, before);
  assert.deepEqual(store.writeCalls, writesBefore);
});
