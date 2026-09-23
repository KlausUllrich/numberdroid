import assert from 'node:assert/strict';
import test from 'node:test';
import { createStudioHttpServer } from '../apps/studio-server/src/server.js';

test('Room editor Save HTTP is strict local-owner/CSRF and carries only editable fields', { timeout: 10_000 }, async () => {
  const calls = [];
  const service = {
    commandCatalog: [],
    async readProjectTrusted(projectId) { return { projectId, revision: 7, snapshot: { project: { ownerId: 'designer.one' }, grants: [] } }; },
    async execute(command, context) { calls.push({ command, context }); return { projectId: command.projectId, revision: 8, value: {} }; },
  };
  const server = createStudioHttpServer({ studioService: service });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const { csrfToken } = await fetch(`${base}/api/ui-session`).then(response => response.json());
    const body = { expectedRevision: 7, idempotencyKey: 'editor.save.http', expectedRoomVariantVersion: 2,
      width: 5, height: 4, voidCells: [], blockedCells: [], intentTrace: [], connectors: [], addPlacements: [], moves: [], removePlacements: [] };
    const endpoint = `${base}/api/projects/project.one/rooms/room.one/editor-save`;
    const post = (value, headers = {}) => fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', origin: base, 'sec-fetch-site': 'same-origin', 'x-numberdroid-studio-csrf': csrfToken, ...headers }, body: JSON.stringify(value) });
    assert.equal((await post(body, { 'x-numberdroid-studio-csrf': 'invalid' })).status, 403);
    assert.equal((await post(body, { origin: 'https://foreign.invalid' })).status, 403);
    for (const extra of [{ actor: { id: 'forged' } }, { lifecycle: 'FINAL' }, { findings: [] }, { roomVariantId: 'other.room' }]) {
      assert.equal((await post({ ...body, ...extra })).status, 400);
    }
    assert.equal(calls.length, 0);
    assert.equal((await post(body)).status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].command.type, 'room.variant.editor.save');
    assert.equal(calls[0].context.actor.kind, 'human');
    assert.equal(calls[0].context.actor.id, 'designer.one');
    const { expectedRevision, idempotencyKey, ...editable } = body;
    assert.deepEqual(calls[0].command.payload, { roomVariantId: 'room.one', ...editable });
    assert.equal(calls[0].command.baseRevision, expectedRevision);
    assert.equal(calls[0].command.idempotencyKey, idempotencyKey);
    assert.equal((await fetch(`${base}/room-editor-draft.js`)).status, 200);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
