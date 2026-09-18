import assert from 'node:assert/strict';
import test from 'node:test';
import { SourceLibraryService } from '../packages/application/src/index.js';
import { SqliteJobStore, SourceLibraryOperationStore } from '../packages/persistence/src/index.js';
import { assemblyFixture, projectId } from './assembly-test-helpers.js';

async function fixture(t) {
  const f = await assemblyFixture(t);
  const service = new SourceLibraryService({ projectStore: f.store,
    jobStore: new SqliteJobStore({ workspace: f.store.workspace }),
    operationStore: new SourceLibraryOperationStore({ workspace: f.store.workspace }) });
  const base = await f.http({ sourceLibraryService: service });
  const get = (path, options = {}) => fetch(`${base}${path}`, { signal: AbortSignal.timeout(8000), ...options });
  const csrf = (await (await get('/api/ui-session')).json()).csrfToken;
  const headers = { 'content-type': 'application/json', origin: base, 'sec-fetch-site': 'same-origin', 'x-numberdroid-studio-csrf': csrf };
  const path = `/api/projects/${projectId}/atlases/atlas.fixture/library`;
  const post = async (action, body, { headerOverrides = {}, target = path } = {}) => {
    const response = await get(`${target}/${action}`, { method: 'POST', headers: { ...headers, ...headerOverrides }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  return { ...f, get, post, path };
}

test('local owner HTTP bootstraps and plans without mutation, then saves and exactly replays', { timeout: 60_000 }, async t => {
  const f = await fixture(t), before = await f.studio.readProjectTrusted(projectId);
  const bootstrap = await f.post('bootstrap', {});
  assert.equal(bootstrap.status, 200); assert.equal(bootstrap.body.projectId, projectId);
  const b = bootstrap.body, p = f.payload();
  const request = { expectedRevision: b.revision, expectedAtlasVersion: b.expectedAtlasVersion, expectedAtlasFingerprint: b.expectedAtlasFingerprint,
    input: b.savedInput, items: [{ rectangleId: 'rect.fixture', destination: { operation: 'create', assetId: 'asset.http-library', name: p.name, kind: p.kind, metadata: p.metadata } }] };
  const plan = await f.post('plan', request);
  assert.equal(plan.status, 200, JSON.stringify(plan)); assert.equal(plan.body.canSave, true);
  assert.deepEqual(await f.studio.readProjectTrusted(projectId), before);
  const save = { ...request, idempotencyKey: 'library.http.save' };
  const saved = await f.post('save', save);
  assert.equal(saved.status, 200, JSON.stringify(saved)); assert.equal(saved.body.summary.created, 1);
  assert.equal(saved.body.items[0].lifecycle, 'DRAFT');
  const replay = await f.post('save', save);
  assert.equal(replay.status, 200); assert.deepEqual(replay.body, { ...saved.body, replayed: true });
  assert.equal((await f.studio.readProjectTrusted(projectId)).revision, saved.body.revision);
  const changed = structuredClone(save); changed.items[0].destination.name = 'Changed intent';
  assert.equal((await f.post('save', changed)).status, 409);
  const script = await f.get('/source-library-controller.js'); assert.equal(script.status, 200); await script.arrayBuffer();
});

test('Library HTTP rejects forged authority/coordinates, remote origins, missing CSRF and unbounded input without mutation', { timeout: 60_000 }, async t => {
  const f = await fixture(t), before = await f.studio.readProjectTrusted(projectId);
  for (const body of [{ projectId: 'project.foreign' }, { atlasId: 'atlas.foreign' }, { actor: { kind: 'human' } }, { grantId: 'grant.forged' }, { path: '/tmp/forged' }, []]) {
    assert.equal((await f.post('bootstrap', body)).status, 400, JSON.stringify(body));
  }
  for (const headerOverrides of [{ origin: 'https://remote.invalid' }, { origin: '' }, { 'sec-fetch-site': 'cross-site' },
    { 'x-numberdroid-studio-csrf': '' }, { authorization: 'Bearer forged' }]) {
    assert.equal((await f.post('bootstrap', {}, { headerOverrides })).status, 403);
  }
  assert.equal((await f.post('bootstrap?actor=forged', {})).status, 400);
  for (const method of ['GET', 'PUT', 'DELETE']) {
    const response = await f.get(`${f.path}/save`, { method }); assert.equal(response.status, 405); await response.arrayBuffer();
  }
  assert.equal((await f.post('bootstrap', { oversized: 'x'.repeat(256 * 1024) })).status, 400);
  assert.equal((await f.post('bootstrap', {}, { target: '/api/projects/project.foreign/atlases/atlas.fixture/library' })).status, 404);
  assert.equal((await f.post('bootstrap', {}, { target: `/api/projects/${projectId}/atlases/atlas.foreign/library` })).status, 404);
  assert.deepEqual(await f.studio.readProjectTrusted(projectId), before);
});
