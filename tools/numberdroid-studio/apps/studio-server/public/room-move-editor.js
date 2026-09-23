// Optimistic display is deliberately separate from the saved Room. Only the
// adapter may adopt an exact server-confirmed revision into authoritative state.
export function createRoomMoveEditor({ context, check, send, adopt, changed, key = () => `move:${crypto.randomUUID()}`, limit = 64 }) {
  let queue = [], attempt = null, running = false, message = '', owner = null;
  const identity = value => value ? `${value.projectId}:${value.room.roomVariantId}` : null;
  const pending = () => Boolean(attempt || queue.length || running);
  const owns = () => owner === identity(context());
  function project(room) {
    if (!pending() || !owns() || room.roomVariantId !== context().room.roomVariantId) return room;
    const moves = [...(attempt ? [attempt.intent] : []), ...queue];
    return { ...room, placements: room.placements.map(placement => {
      const move = moves.findLast(value => value.placementId === placement.placementId);
      return move ? { ...placement, anchor: { ...move.anchor }, rotation: move.rotation } : placement;
    }) };
  }
  function notify() { changed(); }
  function status() {
    if (!pending() && owner !== identity(context())) { owner = identity(context()); message = ''; }
    if (attempt?.phase === 'uncertain') return 'Save not confirmed. Retry the same move; do not close this page.';
    if (attempt?.phase === 'refresh') return 'Move saved. Confirming the saved Room — retry the read if interrupted.';
    if (pending()) return `${message ? `${message} ` : ''}Saving…${queue.length ? ` · ${queue.length} change${queue.length === 1 ? '' : 's'} waiting` : ''}`;
    return message;
  }
  function reject(error) {
    const remaining = queue.length; queue = []; attempt = null;
    message = `${error.message} This move was not saved.${remaining ? ` ${remaining} later change(s) were not saved either.` : ''} The last confirmed positions are shown.`;
  }
  async function settle(retry = false) {
    if (running || !attempt) return false;
    running = true; notify();
    const current = attempt;
    try {
      if (!owns()) throw new Error('The project or Room changed. Return to the original Room to resolve this save.');
      if (!current.response) {
        const response = await send(current.request);
        if (response?.projectId !== current.request.projectId || response.revision !== current.request.body.expectedRevision + 1
            || response.value?.roomVariantId !== current.request.roomVariantId
            || response.value?.roomVariantVersion !== current.request.body.expectedRoomVariantVersion + 1) {
          throw new Error('The save response could not be verified.');
        }
        current.response = response; current.phase = 'refresh'; notify();
      }
      // A failed read after a confirmed POST retries only the read, never writes.
      const continuous = await adopt(current.response, current.request, current.previous);
      attempt = null;
      if (!continuous) {
        const remaining = queue.length; queue = [];
        message = `Saved state refreshed.${remaining ? ` The project changed; ${remaining} further move(s) were not saved. Choose their positions again.` : ''}`;
      } else message = 'Saved';
      return true;
    } catch (error) {
      if (current.response) { current.phase = 'refresh'; message = error.message; }
      else if (!retry && !current.wasUncertain && Number.isInteger(error.status) && error.status >= 400 && error.status < 500) reject(error);
      else { current.phase = 'uncertain'; current.wasUncertain = true; message = error.message; }
      return false;
    } finally {
      running = false; notify();
      if (!attempt && queue.length) void drain();
    }
  }
  async function drain() {
    if (running || attempt || !queue.length) return;
    const current = context();
    if (!owns() || current.blocked) { queue = []; message = current?.blocked || 'The Room context changed. Queued moves were not saved.'; notify(); return; }
    const intent = queue.shift(), placement = current.room.placements.find(value => value.placementId === intent.placementId);
    if (!placement || placement.assetId !== intent.expectedAssetId) { reject(new Error('The selected placement changed.')); notify(); return; }
    if (placement.anchor.x === intent.anchor.x && placement.anchor.y === intent.anchor.y && placement.rotation === intent.rotation) { notify(); void drain(); return; }
    const reason = check(current.room, intent);
    if (reason) { reject(new Error(reason)); notify(); return; }
    const body = { expectedRevision: current.revision, idempotencyKey: key(), expectedRoomVariantVersion: current.room.version,
      moves: [{ ...intent, anchor: { ...intent.anchor } }] };
    attempt = { intent, previous: current.room, phase: 'saving', wasUncertain: false, response: null,
      request: { projectId: current.projectId, roomVariantId: current.room.roomVariantId, body, serialized: JSON.stringify(body) } };
    await settle();
  }
  function enqueue(intent) {
    const current = context();
    if (!current || current.blocked) { message = current?.blocked || 'No editable Room is open.'; notify(); return false; }
    if (attempt && ['uncertain', 'refresh'].includes(attempt.phase) && !running) { notify(); return false; }
    if (pending() && !owns()) { message = 'Resolve the original Room save before editing another Room.'; notify(); return false; }
    if (queue.length >= limit) { message = 'The move queue is full. Wait for it to save.'; notify(); return false; }
    const displayed = project(current.room), placement = displayed.placements.find(value => value.placementId === intent.placementId);
    if (!placement || placement.assetId !== intent.expectedAssetId) return false;
    if (placement.anchor.x === intent.anchor.x && placement.anchor.y === intent.anchor.y && placement.rotation === intent.rotation) return false;
    const reason = check(displayed, intent);
    if (reason) { message = reason; notify(); return false; }
    if (!pending()) owner = identity(current);
    queue.push(structuredClone(intent)); message = ''; notify(); void drain(); return true;
  }
  return { enqueue, project, hasPending: pending, isRunning: () => running,
    canInput: () => pending() && owns() && !(attempt && ['uncertain', 'refresh'].includes(attempt.phase) && !running),
    getState: () => ({ pending: pending(), running, phase: attempt?.phase ?? (queue.length ? 'queued' : 'idle'), queued: queue.length,
      message: status(), request: attempt ? structuredClone(attempt.request) : null }),
    retry: () => settle(true) };
}
