import assert from 'node:assert/strict';
import test from 'node:test';
import { createRoomMoveEditor } from '../apps/studio-server/public/room-move-editor.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
function harness(options = {}) {
  let revision = 3, room = { roomVariantId: 'room', version: 2, placements: [
    { placementId: 'table', assetId: 'asset', assetVersion: 1, metadataVersion: 2, anchor: { x: 0, y: 1 }, rotation: 0 },
  ] }, projectId = 'project', blocked = '', reads = 0, nextKey = 0;
  const calls = [], snapshots = [], deferred = [];
  const context = () => ({ projectId, revision, room, blocked });
  const editor = createRoomMoveEditor({ context, limit: options.limit ?? 64, key: () => `key${++nextKey}`,
    check: (_room, move) => move.anchor.x < 0 ? 'Outside room' : '',
    send(request) { calls.push(structuredClone(request)); return new Promise((resolve, reject) => deferred.push({ resolve, reject, request })); },
    async adopt(response, request) {
      reads += 1; if (options.readFailure?.(reads)) throw new Error('Read unavailable');
      revision = response.revision;
      room = { ...room, version: response.value.roomVariantVersion, placements: room.placements.map(value => ({ ...value,
        anchor: { ...request.body.moves[0].anchor }, rotation: request.body.moves[0].rotation })) };
      return options.continuous !== false;
    },
    changed: () => { snapshots.push({ revision, version: room.version }); },
  });
  function complete(index = 0) {
    const item = deferred[index]; item.resolve({ projectId: item.request.projectId, revision: item.request.body.expectedRevision + 1,
      value: { roomVariantId: 'room', roomVariantVersion: item.request.body.expectedRoomVariantVersion + 1 } });
  }
  const move = (x, rotation = 0) => editor.enqueue({ placementId: 'table', expectedAssetId: 'asset', anchor: { x, y: 1 }, rotation });
  return { editor, calls, deferred, context, snapshots, move, complete, reads: () => reads,
    setBlocked(value) { blocked = value; }, setProject(value) { projectId = value; } };
}

test('display is immediate; saved state stays immutable until exact confirmation', async () => {
  const h = harness(), saved = h.context().room;
  assert.equal(h.move(1), true); assert.equal(h.calls.length, 1);
  assert.equal(h.editor.project(saved).placements[0].anchor.x, 1);
  assert.equal(saved.placements[0].anchor.x, 0); assert.equal(h.context().revision, 3);
  assert.match(h.editor.getState().message, /Saving/);
  h.complete(); await tick();
  assert.equal(h.context().revision, 4); assert.equal(h.context().room.version, 3);
  assert.equal(h.editor.hasPending(), false); assert.equal(h.editor.getState().message, 'Saved');
});

test('rapid moves and rotation serialize, accumulate display, and use fresh confirmed CAS and keys', async () => {
  const h = harness(); h.move(1); h.move(2); h.move(2, 90); h.move(3, 90);
  assert.equal(h.calls.length, 1); assert.equal(h.editor.getState().queued, 3);
  assert.equal(h.editor.project(h.context().room).placements[0].anchor.x, 3);
  assert.equal(h.editor.project(h.context().room).placements[0].rotation, 90);
  for (let index = 0; index < 4; index += 1) {
    h.complete(index); await tick();
    assert.equal(h.editor.project(h.context().room).placements[0].anchor.x, 3, 'early acknowledgement does not snap back');
  }
  assert.deepEqual(h.calls.map(value => value.body.expectedRevision), [3, 4, 5, 6]);
  assert.deepEqual(h.calls.map(value => value.body.expectedRoomVariantVersion), [2, 3, 4, 5]);
  assert.equal(new Set(h.calls.map(value => value.body.idempotencyKey)).size, 4);
  assert.equal(h.context().room.placements[0].metadataVersion, 2);
});

test('unknown response retains frozen request and queue; retry sends identical bytes and key', async () => {
  const h = harness(); h.move(1); h.move(2);
  h.deferred[0].reject(new Error('Lost response')); await tick();
  assert.equal(h.editor.getState().phase, 'uncertain'); assert.equal(h.editor.canInput(), false);
  assert.equal(h.move(3), false); assert.equal(h.calls.length, 1);
  const retry = h.editor.retry(); assert.equal(h.calls[1].serialized, h.calls[0].serialized);
  h.deferred[1].reject(Object.assign(new Error('Denied'), { status: 403 })); await retry;
  assert.equal(h.editor.getState().phase, 'uncertain'); assert.equal(h.context().revision, 3);
  const again = h.editor.retry(); h.complete(2); await again; await tick();
  assert.equal(h.calls.length, 4); assert.equal(h.calls[3].body.expectedRevision, 4);
  h.complete(3); await tick(); assert.equal(h.context().room.placements[0].anchor.x, 2);
});

test('definite middle rejection retains earlier successful save and cancels later unsent intentions', async () => {
  const h = harness(); h.move(1); h.move(2); h.move(3); h.complete(); await tick();
  h.deferred[1].reject(Object.assign(new Error('Conflict'), { status: 409 })); await tick();
  assert.equal(h.calls.length, 2); assert.equal(h.editor.hasPending(), false);
  assert.equal(h.editor.project(h.context().room).placements[0].anchor.x, 1);
  assert.match(h.editor.getState().message, /1 later change/);
});

test('confirmed POST and interrupted read retries only read, never the write', async () => {
  const h = harness({ readFailure: count => count === 1 }); h.move(1); h.move(2); h.complete(); await tick();
  assert.equal(h.editor.getState().phase, 'refresh'); assert.equal(h.calls.length, 1);
  assert.equal(h.editor.canInput(), false); assert.match(h.editor.getState().message, /Move saved/);
  await h.editor.retry(); await tick();
  assert.equal(h.reads(), 2); assert.equal(h.calls.length, 2); assert.equal(h.calls[1].body.moves[0].anchor.x, 2);
  h.complete(1); await tick();
});

test('newer authoritative head stops queued intentions after confirmed save', async () => {
  const h = harness({ continuous: false }); h.move(1); h.move(2); h.complete(); await tick();
  assert.equal(h.calls.length, 1); assert.equal(h.editor.hasPending(), false);
  assert.match(h.editor.getState().message, /1 further move/);
});

test('manual refresh or dirty shape rejects input before preview, key or POST', () => {
  const h = harness(); h.setBlocked('Wait for Refresh');
  assert.equal(h.move(1), false); assert.equal(h.calls.length, 0); assert.equal(h.editor.hasPending(), false);
  assert.equal(h.editor.project(h.context().room).placements[0].anchor.x, 0);
});

test('queue is bounded and immediate preflight rejects out-of-room display', async () => {
  const h = harness({ limit: 2 }); assert.equal(h.move(-1), false);
  h.move(1); assert.equal(h.move(2), true); assert.equal(h.move(3), true); assert.equal(h.move(4), false);
  assert.match(h.editor.getState().message, /queue is full/);
  assert.equal(h.editor.project(h.context().room).placements[0].anchor.x, 3);
  for (let i = 0; i < 3; i += 1) { h.complete(i); await tick(); }
});

test('forced context switch never paints another Room or sends the queued request', async () => {
  const h = harness(); h.move(1); h.move(2); h.setProject('other');
  assert.equal(h.editor.project(h.context().room).placements[0].anchor.x, 0);
  h.deferred[0].reject(new Error('Connection lost')); await tick();
  assert.equal(h.editor.canInput(), false); assert.equal(h.move(3), false);
  await h.editor.retry(); assert.equal(h.calls.length, 1);
  h.setProject('project'); const retry = h.editor.retry(); h.complete(1); await retry; await tick();
  h.complete(2); await tick(); assert.equal(h.context().revision, 5);
});

test('malformed confirmation cannot become saved; exact retry remains available', async () => {
  const h = harness(); h.move(1); h.deferred[0].resolve({ projectId: 'other', revision: 4 }); await tick();
  assert.equal(h.editor.getState().phase, 'uncertain'); assert.equal(h.context().revision, 3); assert.equal(h.reads(), 0);
});
