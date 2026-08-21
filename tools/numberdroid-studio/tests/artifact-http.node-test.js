import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ContentAddressedArtifactStore,
  SqliteArtifactMetadataStore,
  SqliteProjectStore,
} from '../packages/persistence/src/index.js';
import { createStudioHttpServer } from '../apps/studio-server/src/server.js';
import { OWNER, OWNER_CONTEXT, PROJECT_ID, command, createHarness, createProject } from './test-helpers.js';
import { nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

test('human upload produces a project-scoped CAS resource and a READY Asset Library preview', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-artifact-http-'));
  const store = await SqliteProjectStore.open({
    filename: join(directory, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  const { studio } = createHarness(store);
  await createProject(studio);
  const artifactStore = new ContentAddressedArtifactStore({ rootDirectory: join(directory, 'artifacts') });
  const artifactMetadataStore = new SqliteArtifactMetadataStore({ workspace: store.workspace });
  const server = createStudioHttpServer({ studioService: studio, artifactStore, artifactMetadataStore });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    store.close();
    await rm(directory, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const access = await fetch(`${base}/api/projects/${PROJECT_ID}/agent-access`).then((response) => response.json());

  const uploadResponse = await fetch(`${base}/api/projects/${PROJECT_ID}/artifacts`, {
    method: 'POST',
    headers: {
      'content-type': 'image/png',
      origin: base,
      'sec-fetch-site': 'same-origin',
      'x-numberdroid-studio-csrf': access.csrfToken,
    },
    body: ONE_PIXEL_PNG,
  });
  assert.equal(uploadResponse.status, 201);
  const upload = await uploadResponse.json();
  assert.match(upload.artifact.digest, /^[a-f0-9]{64}$/);
  assert.equal(upload.artifact.uri, `studio://artifacts/sha256/${upload.artifact.digest}`);
  assert.equal(upload.artifact.width, 1);
  assert.equal(upload.artifact.height, 1);
  assert.equal(upload.artifact.deduplicated, false);
  assert.equal(upload.artifact.resourceUri, `/api/projects/${PROJECT_ID}/artifacts/sha256/${upload.artifact.digest}`);

  const duplicateResponse = await fetch(`${base}/api/projects/${PROJECT_ID}/artifacts`, {
    method: 'POST',
    headers: {
      'content-type': 'image/png',
      origin: base,
      'sec-fetch-site': 'same-origin',
      'x-numberdroid-studio-csrf': access.csrfToken,
      'x-numberdroid-expected-sha256': upload.artifact.digest,
    },
    body: ONE_PIXEL_PNG,
  });
  assert.equal(duplicateResponse.status, 201);
  assert.equal((await duplicateResponse.json()).artifact.deduplicated, true);

  const binaryResponse = await fetch(`${base}${upload.artifact.resourceUri}`);
  assert.equal(binaryResponse.status, 200);
  assert.equal(binaryResponse.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await binaryResponse.arrayBuffer()), ONE_PIXEL_PNG);

  await studio.execute(command({
    commandId: 'cmd.cas-source',
    idempotencyKey: 'idem.cas-source',
    type: 'source.register',
    expectedVersion: 1,
    payload: {
      sourceId: 'source.cas-atlas',
      name: 'CAS atlas',
      artifactUri: upload.artifact.uri,
      mediaType: 'image/png',
      width: 1,
      height: 1,
      provenance: { prompt: 'Approved local atlas', seed: 742 },
    },
  }), OWNER_CONTEXT);
  await studio.execute(command({
    commandId: 'cmd.cas-asset',
    idempotencyKey: 'idem.cas-asset',
    type: 'asset.define',
    expectedVersion: 2,
    payload: {
      assetId: 'tile.cas.floor',
      sourceId: 'source.cas-atlas',
      name: 'CAS floor preview',
      kind: 'surface',
      region: { x: 0, y: 0, width: 1, height: 1 },
      properties: { role: 'floor' },
    },
  }), OWNER_CONTEXT);
  const project = await fetch(`${base}/api/projects/${PROJECT_ID}`).then((response) => response.json());
  assert.deepEqual(project.snapshot.assets[0].preview, {
    schemaVersion: 1,
    state: 'READY',
    resourceUri: upload.artifact.resourceUri,
    kind: 'surface',
    alt: 'CAS floor preview preview',
  });

  const otherProjectId = 'project.other-artifacts';
  await studio.execute(command({
    commandId: 'cmd.other-artifact-project',
    idempotencyKey: 'idem.other-artifact-project',
    projectId: otherProjectId,
    payload: { name: 'Other artifacts', ownerId: OWNER.id },
  }), OWNER_CONTEXT);
  const crossProject = await fetch(`${base}/api/projects/${otherProjectId}/artifacts/sha256/${upload.artifact.digest}`);
  assert.equal(crossProject.status, 404);
  assert.equal((await crossProject.json()).error.code, 'ARTIFACT_NOT_FOUND');
});

test('canonical source revision and its CAS reference roll back in one SQLite transaction', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-artifact-atomic-'));
  let failReferenceCommit = false;
  const store = await SqliteProjectStore.open({
    filename: join(directory, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
    faultInjector(point) {
      if (failReferenceCommit && point === 'after_source_artifact_reference') throw new Error('source reference crash');
    },
  });
  context.after(async () => {
    store.close();
    await rm(directory, { recursive: true, force: true });
  });
  const { studio } = createHarness(store);
  await createProject(studio);
  const artifactStore = new ContentAddressedArtifactStore({ rootDirectory: join(directory, 'artifacts') });
  const artifact = await artifactStore.ingest(ONE_PIXEL_PNG, { mediaType: 'image/png' });
  const metadata = new SqliteArtifactMetadataStore({ workspace: store.workspace });
  metadata.registerAndReference(artifact, {
    projectId: PROJECT_ID, ownerKind: 'upload', ownerId: 'upload.atomic', createdRevision: 1,
  });
  failReferenceCommit = true;
  await assert.rejects(studio.execute(command({
    commandId: 'cmd.atomic-source',
    idempotencyKey: 'idem.atomic-source',
    type: 'source.register',
    expectedVersion: 1,
    payload: {
      sourceId: 'source.atomic', name: 'Atomic source', artifactUri: artifact.uri,
      mediaType: 'image/png', width: 1, height: 1,
      provenance: { prompt: 'Atomic CAS source', seed: 1 },
    },
  }), OWNER_CONTEXT), /source reference crash/);
  const project = await studio.readProjectTrusted(PROJECT_ID);
  assert.equal(project.revision, 1);
  assert.equal(project.snapshot.sources.length, 0);
  assert.equal(store.workspace.database.prepare(`
    SELECT count(*) AS count FROM artifact_references
    WHERE project_id = ? AND owner_kind = 'source'
  `).get(PROJECT_ID).count, 0);
});
