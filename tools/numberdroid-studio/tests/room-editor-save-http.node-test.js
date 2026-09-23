import assert from 'node:assert/strict';
import test from 'node:test';
import { createStudioHttpServer } from '../apps/studio-server/src/server.js';
import { StudioError } from '../packages/domain/src/index.js';

test('Room editor Save HTTP is strict local-owner/CSRF and carries only editable fields', { timeout: 10_000 }, async () => {
  const calls = []; let rejectedCode = null;
  const service = {
    commandCatalog: [],
    async readProjectTrusted(projectId) { return { projectId, revision: 7, snapshot: { project: { ownerId: 'designer.one' }, grants: [] } }; },
    async execute(command, context) {
      if (rejectedCode) throw new StudioError(rejectedCode, 'Draft rejected before commit.');
      calls.push({ command, context }); return { projectId: command.projectId, revision: 8, value: {} };
    },
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
    for (const code of ['ROOM_SHAPE_CELL_LIMIT', 'ROOM_SHAPE_CELL_DUPLICATE', 'ROOM_SHAPE_CELL_CONFLICT',
      'ROOM_SHAPE_EMPTY', 'ROOM_SHAPE_DISCONNECTED', 'ROOM_PLACEMENT_LIMIT', 'ROOM_PLACEMENT_DUPLICATE',
      'ROOM_CONNECTOR_LIMIT', 'ROOM_INTENT_DUPLICATE', 'UNTRUSTED_AUTHORITY_FIELD']) {
      rejectedCode = code;
      const response = await post(body);
      assert.equal(response.status, 400, code);
      assert.equal((await response.json()).error.code, code);
    }
    rejectedCode = 'UNEXPECTED_WRITER_FAILURE';
    assert.equal((await post(body)).status, 500, 'Unknown failures must remain uncertain, not pretend rejection.');
    assert.equal(calls.length, 1);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
