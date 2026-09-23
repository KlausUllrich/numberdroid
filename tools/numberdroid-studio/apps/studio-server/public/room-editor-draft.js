// One local Room draft. Saved authority changes only after an exact save receipt.
const clone = value => structuredClone(value);
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const fields = ['width', 'height', 'voidCells', 'blockedCells', 'intentTrace', 'connectors'];
const value = room => ({ ...Object.fromEntries(fields.map(key => [key, room[key] ?? []])), placements: room.placements });
const identity = context => context ? `${context.projectId}:${context.room.roomVariantId}` : null;
const rejectedSaveCodes = new Set([
  'VALIDATION_ERROR', 'INVALID_JSON', 'BODY_TOO_LARGE', 'CONTENT_TYPE_REQUIRED',
  'FORBIDDEN', 'UI_ORIGIN_REQUIRED', 'UI_ORIGIN_FORBIDDEN', 'CSRF_INVALID', 'UNTRUSTED_AUTHORITY_FIELD',
  'PROJECT_NOT_FOUND', 'ROOM_VARIANT_NOT_FOUND', 'ROOM_ARCHETYPE_NOT_FOUND', 'ROOM_ASSET_VERSION_NOT_FOUND', 'ROOM_PLACEMENT_NOT_FOUND',
  'REVISION_CONFLICT', 'ENTITY_VERSION_CONFLICT', 'IDEMPOTENCY_CONFLICT', 'COMMAND_ID_CONFLICT',
  'ROOM_EDIT_REQUIRES_DRAFT', 'ROOM_PROPOSAL_UNRESOLVED', 'ROOM_RESIZE_CLIPS_CONTENT', 'ROOM_VERSION_CONFLICT',
  'ROOM_PLACEMENT_LIMIT', 'ROOM_PLACEMENT_DUPLICATE', 'ROOM_CONNECTOR_LIMIT', 'ROOM_CONNECTOR_OUT_OF_BOUNDS',
  'ROOM_CELL_LIMIT', 'ROOM_DIMENSIONS_OUT_OF_POLICY', 'ROOM_DIMENSION_POLICY_INVALID', 'ROOM_CONNECTOR_POLICY_INVALID',
  'ROOM_SHAPE_CELL_CONFLICT', 'ROOM_SHAPE_CELL_DUPLICATE', 'ROOM_SHAPE_CELL_LIMIT', 'ROOM_SHAPE_DISCONNECTED', 'ROOM_SHAPE_EMPTY',
  'ROOM_INTENT_DUPLICATE', 'ROOM_TAG_POLICY_INVALID', 'ASSEMBLY_ROOM_UNSUPPORTED',
]);
const definitelyRejected = error => [400, 403, 404, 409, 413, 422].includes(error.status) && rejectedSaveCodes.has(error.code);
const canonical = input => JSON.stringify(input && typeof input === 'object'
  ? Array.isArray(input) ? input.map(item => JSON.parse(canonical(item)))
    : Object.fromEntries(Object.keys(input).sort().map(key => [key, JSON.parse(canonical(input[key]))])) : input);
export function roomEditorSavedMatches(room, draft) {
  for (const field of [...fields, 'placements']) {
    const normalize = input => Array.isArray(input) ? input.map(canonical).sort() : input;
    if (canonical(normalize(room[field] ?? [])) !== canonical(normalize(draft[field] ?? []))) return false;
  }
  return true;
}

export function roomEditorDelta(base, draft) {
  const before = new Map(base.placements.map(placement => [placement.placementId, placement]));
  const after = new Map(draft.placements.map(placement => [placement.placementId, placement]));
  if (after.size !== draft.placements.length || after.size > 256) throw new Error('A Room can contain at most 256 distinct placements.');
  const addPlacements = [], moves = [], removePlacements = [];
  for (const placement of draft.placements) {
    const prior = before.get(placement.placementId);
    if (!prior) { addPlacements.push(clone(placement)); continue; }
    const { anchor, rotation, ...fixed } = placement;
    const { anchor: priorAnchor, rotation: priorRotation, ...priorFixed } = prior;
    if (!same(fixed, priorFixed)) throw new Error('Existing placement image pins and provenance cannot change in a Room draft.');
    if (!same(anchor, priorAnchor) || rotation !== priorRotation) moves.push({ placementId: placement.placementId, expectedAssetId: prior.assetId, anchor: clone(anchor), rotation });
  }
  for (const prior of base.placements) if (!after.has(prior.placementId)) removePlacements.push({ placementId: prior.placementId, expectedAssetId: prior.assetId });
  return { ...Object.fromEntries(fields.map(key => [key, clone(draft[key] ?? [])])), addPlacements, moves, removePlacements };
}

export function createRoomEditorDraft({ context, send, adopt, changed, key = () => `room-editor:${crypto.randomUUID()}` }) {
  let owner = null, base = null, draft = null, revision = null, attempt = null, running = false, message = '', sequence = 0;
  const dirty = () => Boolean(base && draft && !same(value(base), value(draft)));
  const pending = () => dirty() || Boolean(attempt);
  const owns = () => owner === identity(context());
  const locked = () => Boolean(attempt) || running;
  function notify(kind = 'status') { changed(kind); }
  function begin() {
    const current = context();
    if (base && !dirty() && !attempt) { owner = null; base = null; draft = null; revision = null; }
    if (!current || current.blocked || locked()) { message = current?.blocked || 'Wait for the current save to finish.'; notify(); return false; }
    if (base && (!owns() || current.revision !== revision || current.room.version !== base.version)) {
      message = 'The saved Room changed. Your draft is retained; discard it before loading the newer Room.'; notify(); return false;
    }
    if (!base) { owner = identity(current); base = clone(current.room); draft = clone(current.room); revision = current.revision; }
    return true;
  }
  function project(room) { return base && owns() && room?.roomVariantId === base.roomVariantId ? draft : room; }
  function update(mutator, kind = 'content') {
    if (!begin()) return false;
    const next = clone(draft);
    try { mutator(next); roomEditorDelta(base, next); }
    catch (error) { message = error.message; notify(); return false; }
    if (same(value(next), value(draft))) {
      if (!dirty()) { owner = null; base = null; draft = null; revision = null; }
      return false;
    }
    draft = next; sequence += 1; message = '';
    if (!dirty()) { owner = null; base = null; draft = null; revision = null; }
    notify(kind); return true;
  }
  function apply(operation, body) {
    return update(room => {
      if (operation === 'room-shape-set') { room.voidCells = clone(body.voidCells); room.blockedCells = clone(body.blockedCells); }
      else if (operation === 'room-intent-set') room.intentTrace = clone(body.intentTrace);
      else if (operation === 'room-connectors-set') room.connectors = clone(body.connectors);
      else if (operation === 'room-resize') {
        room.width = body.width; room.height = body.height;
        room.voidCells = (room.voidCells ?? []).filter(cell => cell.x < room.width && cell.y < room.height);
        room.blockedCells = (room.blockedCells ?? []).filter(cell => cell.x < room.width && cell.y < room.height);
        room.placements = room.placements.filter(placement => !body.removePlacementIds.includes(placement.placementId));
        room.connectors = room.connectors.filter(connector => !body.removeConnectorIds.includes(connector.connectorId));
      } else if (operation === 'room-placement-add') room.placements.push(...clone(body.placements));
      else if (operation === 'room-placement-remove') room.placements = room.placements.filter(placement => !body.placements.some(item => item.placementId === placement.placementId && item.expectedAssetId === placement.assetId));
      else throw new Error('This action is not a local Room edit.');
    });
  }
  function enqueue(intent) {
    return update(room => {
      const placement = room.placements.find(item => item.placementId === intent.placementId && item.assetId === intent.expectedAssetId);
      if (!placement) throw new Error('The selected placement is no longer in this draft.');
      placement.anchor = clone(intent.anchor); placement.rotation = intent.rotation;
    }, 'move');
  }
  async function settle(retry = false) {
    if (running || !attempt) return false;
    running = true; notify(); const current = attempt;
    try {
      if (!owns()) throw new Error('Return to the original Room to resolve this save.');
      if (!current.response) {
        const response = await send(current.request);
        if (response?.projectId !== current.request.projectId || response.revision !== revision + 1
            || response.value?.roomVariantId !== base.roomVariantId || response.value?.roomVariantVersion !== base.version + 1) throw new Error('The save response could not be verified. Retry the same save.');
        current.response = response; current.phase = 'refresh'; notify();
      }
      const forceRead = current.adoptionAttempted === true;
      current.adoptionAttempted = true;
      await adopt(current.response, current.request, base, draft, { forceRead });
      attempt = null; owner = null; base = null; draft = null; revision = null; message = 'Saved'; sequence += 1;
      notify('saved'); return true;
    } catch (error) {
      if (current.response) { current.phase = 'refresh'; message = `Changes saved. ${error.message} Retry reading the saved Room.`; }
      else if (!retry && !current.uncertain && definitelyRejected(error)) {
        attempt = null; message = `Not saved: ${error.message} Your changes are still here; correct them or discard them.`;
      } else { current.phase = 'uncertain'; current.uncertain = true; message = 'Save not confirmed. Retry the same save. Do not close or discard this draft.'; }
      return false;
    } finally { running = false; notify(); }
  }
  function save() {
    if (!dirty() || !begin()) return Promise.resolve(false);
    const body = { expectedRevision: revision, idempotencyKey: key(), expectedRoomVariantVersion: base.version, ...roomEditorDelta(base, draft) };
    attempt = { phase: 'saving', uncertain: false, response: null, request: { projectId: context().projectId, roomVariantId: base.roomVariantId, body, serialized: JSON.stringify(body) } };
    return settle();
  }
  function discard() {
    if (locked()) return false;
    owner = null; base = null; draft = null; revision = null; message = ''; sequence += 1; notify('discard'); return true;
  }
  return { project, current: project, update, apply, enqueue, save, discard, retry: () => settle(true),
    hasPending: pending, isLocked: locked, isRunning: () => running,
    canInput: () => { const current = context(); return Boolean(current && !current.blocked && !locked()
      && (!base || (owns() && current.revision === revision && current.room.version === base.version))); },
    getState: () => ({ pending: pending(), dirty: dirty(), running, locked: locked(), sequence,
      phase: attempt?.phase ?? (dirty() ? 'draft' : 'idle'), queued: 0,
      message: message || (running ? 'Checking and saving all Room changes…' : dirty() ? 'Unsaved changes' : 'Saved'),
      request: attempt ? clone(attempt.request) : null }) };
}
