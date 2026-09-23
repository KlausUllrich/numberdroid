import { planRoomSurfaces } from '../../../packages/domain/src/room-surface-plan.js';

const VERSION = 'numberdroid-studio.room-surface-plan.v1';
const pinKey = value => `${value.assetId}@${value.assetVersion}:${value.metadataVersion}`;
const pin = ({ assetId, assetVersion, metadataVersion }) => ({ assetId, assetVersion, metadataVersion });
const cellKey = ({ x, y }) => `${x},${y}`;
const node = (tag, text, className) => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
};

export function surfaceRectangle(start, end) {
  const cells = [];
  for (let y = Math.min(start.y, end.y); y <= Math.max(start.y, end.y); y += 1) {
    for (let x = Math.min(start.x, end.x); x <= Math.max(start.x, end.x); x += 1) cells.push({ x, y });
  }
  return cells;
}

export function surfaceFootprintCells(placement, asset, spanOf) {
  const span = spanOf(asset, placement.rotation);
  return span ? surfaceRectangle(placement.anchor, {
    x: placement.anchor.x + span.width - 1, y: placement.anchor.y + span.height - 1,
  }) : [];
}

export function surfacePlacementLabel(placement, asset, index) {
  return `${asset?.name ?? placement.assetId} · copy ${index + 1} (${placement.anchor.x},${placement.anchor.y}, ${placement.rotation}°; …${placement.placementId.slice(-6)})`;
}

// The controller owns only unsaved planning state. Its adapter commits through
// the same semantic HTTP command as all other Studio clients.
export function createRoomSurfaceTools({ getContext, spanOf, send, saved, busyChanged, changed, visual, thumbnail }) {
  let contextKey = null;
  let mode = 'paint', scope = 'room', policy = 'emptyOnly', randomRotation = false, rotation = 0;
  let selection = new Map(), pool = [], preview = null, attempt = null, undo = null;
  let busy = false, message = '', queue = [], gesture = null, suppressClick = false;
  let revisionSeen = null, overlapCell = null;

  function sync() {
    const context = getContext();
    const nextKey = context?.room ? `${context.projectId}:${context.room.roomVariantId}` : null;
    if (nextKey !== contextKey && !attempt && !busy) {
      contextKey = nextKey; selection = new Map(); pool = []; preview = null; undo = null;
      message = ''; queue = []; overlapCell = null; revisionSeen = context?.revision;
    } else if (context && revisionSeen !== context.revision && !busy) {
      if (preview) message = 'The saved project changed. Preview the fill again before applying it.';
      preview = null; revisionSeen = context.revision;
    }
    return context;
  }

  const assetFor = (placement, context) => context.assets.find(asset => pinKey(asset) === pinKey(placement));
  const surfaces = context => context.room.placements.filter(item => item.layer === 'STRUCTURAL_SURFACE');
  function occupants(context) {
    const occupied = new Map();
    for (const placement of surfaces(context)) {
      for (const cell of surfaceFootprintCells(placement, assetFor(placement, context), spanOf)) {
        const key = cellKey(cell); if (!occupied.has(key)) occupied.set(key, []);
        occupied.get(key).push(placement);
      }
    }
    return occupied;
  }

  function invalidate() { preview = null; message = ''; overlapCell = null; changed(); }
  function reason(context) {
    if (!context?.room || context.room.lifecycle !== 'DRAFT') return 'Only an editable draft room can be changed.';
    if (context.readOnly) return 'Editing is available in the local Studio session only.';
    if (context.dirtyShape) return 'Save or discard the room-shape changes first.';
    if (!context.pinsReady) return 'Wait for the exact saved asset versions to load.';
    if (attempt) return 'Resolve the unconfirmed Surface change before starting another operation.';
    if (context.otherPending) return 'Wait for the current room operation to finish.';
    return '';
  }

  function action(label, handler, disabledReason = '', primary = false) {
    const button = node('button', label, primary ? '' : 'secondary'); button.type = 'button';
    button.dataset.surfaceAction = label.toLowerCase().replaceAll(' ', '-');
    button.disabled = Boolean(disabledReason); button.title = disabledReason || label;
    if (disabledReason) {
      button.setAttribute('aria-description', disabledReason);
      button.dataset.surfaceDisabledReason = disabledReason;
    }
    button.addEventListener('click', handler); return button;
  }

  function select(label, value, choices, handler, disabled) {
    const wrapper = node('label'); wrapper.append(node('span', label));
    const control = document.createElement('select'); control.setAttribute('aria-label', label);
    for (const [key, caption] of choices) { const option = node('option', caption); option.value = key; control.append(option); }
    control.value = value; control.disabled = disabled;
    control.addEventListener('change', () => { handler(control.value); invalidate(); });
    wrapper.append(control); return wrapper;
  }

  function requestFrom(context, options) {
    const input = {
      plannerVersion: VERSION, scopeCells: options.cells, policy: options.policy ?? policy,
      pool: options.pool ?? pool, baseRotation: options.rotation ?? rotation,
      randomRotation: options.randomRotation ?? randomRotation,
      seed: `seed:${crypto.randomUUID()}`, placementIdPrefix: `surface:${crypto.randomUUID()}`,
      overlapKeepPlacementIds: options.keepIds ?? [],
    };
    const neededPins = new Set([...context.room.placements, ...input.pool].map(pinKey));
    const plan = planRoomSurfaces({ room: context.room, archetype: context.archetype, assets: context.assets.filter(asset => neededPins.has(pinKey(asset))), ...input });
    const request = {
      projectId: context.projectId, roomVariantId: context.room.roomVariantId,
      body: { expectedRevision: context.revision, idempotencyKey: `surface:${crypto.randomUUID()}`,
        expectedRoomVariantVersion: context.room.version, ...input, planFingerprint: plan.fingerprint },
      plan,
    };
    return request;
  }

  function scopeCells(context) {
    if (scope === 'selection') return [...selection.values()];
    const outside = new Set((context.room.voidCells ?? []).map(cellKey)), bands = context.archetype.structuralBands;
    return surfaceRectangle({ x: bands.left, y: bands.top }, { x: context.room.width - bands.right - 1, y: context.room.height - bands.bottom - 1 })
      .filter(cell => !outside.has(cellKey(cell)));
  }

  function report(error) { message = error.message || String(error); changed(); }
  async function previewFill() {
    const context = sync(); const blocked = reason(context); if (blocked || busy) { message = blocked; changed(); return; }
    try {
      preview = requestFrom(context, { cells: scopeCells(context) });
      if (preview.plan.noOp) { message = 'No change needed. The selected cells already match or are being kept.'; preview = null; changed(); return; }
      busy = true; busyChanged(true); changed();
      const response = await send('surfaces-preview', preview);
      if (getContext().revision !== context.revision || response.projectId !== context.projectId
          || response.value?.surfacePlan?.fingerprint !== preview.plan.fingerprint) throw new Error('The saved context changed. Preview this fill again.');
      preview.plan = response.value.surfacePlan;
      message = 'Preview only — nothing has been saved. Apply this exact arrangement, Shuffle, or Cancel.';
    } catch (error) { preview = null; message = error.message; }
    finally { busy = false; busyChanged(false); changed(); }
  }

  async function commit(request, operation = 'surfaces-apply', retry = false) {
    if (busy) return false;
    attempt = { request, operation, uncertain: retry }; busy = true; busyChanged(true); changed();
    try {
      const response = await send(operation, request);
      if (response.projectId !== request.projectId || response.revision !== request.body.expectedRevision + 1
          || !response.value?.roomVariant) throw new Error('The save result could not be verified. Retry the same change.');
      const expectedFingerprint = request.body.planFingerprint ?? request.body.appliedPlanFingerprint;
      if (response.value.surfacePlan?.fingerprint !== expectedFingerprint
          || response.value.undoReceipt?.appliedPlanFingerprint !== expectedFingerprint) throw new Error('The exact saved arrangement could not be verified. Retry the same change.');
      saved(response, request);
      undo = operation === 'surfaces-apply' ? { ...response.value.undoReceipt, roomVariantId: request.roomVariantId } : null;
      attempt = null; preview = null; overlapCell = null; revisionSeen = response.revision;
      message = operation === 'surfaces-undo' ? 'Surface change undone in a new saved room version.' : `Saved · room version ${response.value.roomVariant.version}.`;
      return true;
    } catch (error) {
      // A definite first-attempt rejection did not commit. Once a result was
      // unknown, retain the original request even if a later retry gets a 4xx.
      const rejected = !retry && Number.isInteger(error.status) && error.status >= 400 && error.status < 500;
      if (rejected) {
        const unsent = queue.length; queue = []; attempt = null; preview = null;
        message = `${error.message} Nothing was changed by this request.${unsent ? ` ${unsent} further queued clicks were not saved.` : ''} Refresh, then preview or paint again.`;
      }
      else { attempt.uncertain = true; message = 'Save not confirmed. Retry the same Surface change below; its cells, images and rotation will not change or be duplicated.'; }
      return false;
    } finally { busy = false; busyChanged(false); changed(); }
  }

  async function retryPending() {
    if (!attempt || busy) return false;
    const pending = attempt;
    const result = await commit(pending.request, pending.operation, true);
    if (result) void drainPaint();
    return result;
  }

  async function drainPaint() {
    if (busy || attempt || !queue.length) return;
    const context = sync(), blocked = reason(context);
    if (blocked) { message = `${blocked} ${queue.length} queued click(s) have not been saved.`; changed(); return; }
    const item = queue[0];
    try {
      const asset = assetFor(item.pin, context);
      if (!asset) throw new Error('The selected exact Surface is no longer available. The queued clicks have not been saved.');
      const overlaps = occupants(context);
      const cells = surfaceFootprintCells({ anchor: item.anchor, rotation: item.rotation }, asset, spanOf);
      const span = spanOf(asset, item.rotation), bands = context.archetype.structuralBands;
      if ((item.anchor.x - bands.left) % span.width || (item.anchor.y - bands.top) % span.height) {
        throw new Error(`This Surface covers ${span.width}×${span.height} cells. Its upper-left corner must follow that grid, starting at ${bands.left},${bands.top}: move in steps of ${span.width} cells across and ${span.height} cells down. No placement was changed.`);
      }
      const conflict = cells.find(cell => (overlaps.get(cellKey(cell))?.length ?? 0) > 1);
      if (conflict) { overlapCell = cellKey(conflict); throw new Error(`Cell ${overlapCell} has more than one Surface. Choose which to keep below, then paint again.`); }
      const request = requestFrom(context, { cells, policy: 'replace', pool: [item.pin], rotation: item.rotation, randomRotation: item.randomRotation });
      queue.shift();
      if (request.plan.noOp) { message = 'Already matches — no new room version was created.'; changed(); void drainPaint(); return; }
      if (await commit(request)) void drainPaint();
    } catch (error) { queue = []; report(error); }
  }

  function clickCell(cell) {
    if (suppressClick) { suppressClick = false; return; }
    const context = sync();
    if (!context?.active) return;
    const blocked = reason(context);
    if (blocked && !busy) { message = blocked; changed(); return; }
    if (mode === 'fill') {
      if (busy || attempt) return;
      scope = 'selection'; const key = cellKey(cell);
      if (selection.has(key)) selection.delete(key); else selection.set(key, cell);
      invalidate(); return;
    }
    if (attempt && !busy) { message = 'Retry the unconfirmed change before painting another cell.'; changed(); return; }
    if (!pool.length) { message = 'Choose a READY Surface below, then click the room cells.'; changed(); return; }
    if (queue.length >= 256) { message = 'The paint queue is full. Wait for it to save before continuing.'; changed(); return; }
    queue.push({ pin: { ...pool[0] }, anchor: cell, rotation, randomRotation });
    changed(); void drainPaint();
  }

  async function repair(keep, group) {
    const context = sync(); if (reason(context) || busy) return;
    try {
      const cells = [...new Map(group.flatMap(item => surfaceFootprintCells(item, assetFor(item, context), spanOf)).map(cell => [cellKey(cell), cell])).values()];
      const names = group.flatMap((item, index) => item.placementId === keep.placementId ? [] : [surfacePlacementLabel(item, assetFor(item, context), index)]);
      const keptLabel = surfacePlacementLabel(keep, assetFor(keep, context), group.indexOf(keep));
      if (!window.confirm(`Keep ${keptLabel} and remove these whole room placements: ${names.join(', ')}? Library assets are not deleted.`)) return;
      await commit(requestFrom(context, { cells, pool: [], keepIds: [keep.placementId], policy: 'emptyOnly' }));
    } catch (error) { report(error); }
  }

  function render() {
    const context = sync(), panel = node('section', undefined, 'room-panel room-surface-tools');
    panel.dataset.surfaceTools = '';
    if (!context?.room) return panel;
    const blocked = reason(context), locked = busy || Boolean(attempt);
    panel.append(node('h3', 'Surfaces'));
    const tabs = node('nav', undefined, 'room-surface-tabs'); tabs.setAttribute('aria-label', 'Surface tools');
    for (const [value, label] of [['paint', 'Paint'], ['fill', 'Fill']]) {
      const button = action(label, () => { mode = value; invalidate(); }, locked ? 'Resolve the current save first.' : '');
      button.dataset.selected = String(mode === value); button.setAttribute('aria-pressed', String(mode === value)); tabs.append(button);
    }
    panel.append(tabs, node('p', mode === 'paint'
      ? 'Choose one Surface and click repeatedly to paint. Existing Surfaces are replaced; matching cells are left unchanged.'
      : 'Choose one or more compatible Surfaces. Preview the complete arrangement before saving it.'));
    if (mode === 'fill') {
      const options = node('div', undefined, 'room-surface-options');
      options.append(select('Fill area', scope, [['room', 'Whole room'], ['selection', `Selected cells (${selection.size})`]], value => { scope = value; }, locked));
      options.append(select('Existing Surfaces', policy, [['emptyOnly', 'Keep existing — fill empty cells only'], ['replace', 'Replace existing Surfaces']], value => { policy = value; }, locked));
      panel.append(options, node('p', 'Click to select a cell; drag a rectangle to select an area. Shift-drag adds to the selection. Tab to a cell and press Space to toggle it.'));
      panel.append(action('Clear selection', () => { selection.clear(); invalidate(); }, locked ? 'Resolve the current save first.' : ''));
    }
    const rotationOptions = node('div', undefined, 'room-surface-options');
    rotationOptions.append(select('Orientation', String(rotation), [0, 90, 180, 270].map(value => [String(value), `${value}°`]), value => { rotation = Number(value); }, locked));
    const randomLabel = node('label', undefined, 'room-surface-checkbox');
    const random = document.createElement('input'); random.type = 'checkbox'; random.checked = randomRotation; random.disabled = locked;
    random.addEventListener('change', () => { randomRotation = random.checked; invalidate(); });
    randomLabel.append(random, node('span', 'Random legal 90° rotations')); rotationOptions.append(randomLabel); panel.append(rotationOptions);
    const choices = node('div', undefined, 'room-surface-pool');
    const available = context.palette.filter(asset => asset.kind === 'surface');
    for (const asset of available) {
      const label = node('label', undefined, 'room-surface-choice'), input = document.createElement('input');
      input.type = mode === 'paint' ? 'radio' : 'checkbox'; input.name = 'surface-pool'; input.dataset.surfacePoolPin = pinKey(asset);
      const imagePreview = thumbnail(asset), image = imagePreview.querySelector('img');
      const imageReady = () => imagePreview.dataset.previewState === 'READY' && image?.complete && image.naturalWidth > 0;
      input.checked = pool.some(item => pinKey(item) === pinKey(asset)); input.disabled = locked || !imageReady();
      image?.addEventListener('load', () => { input.disabled = locked || !imageReady(); });
      image?.addEventListener('error', () => { input.disabled = true; });
      label.dataset.selected = String(input.checked);
      input.addEventListener('change', () => {
        if (!imageReady()) { message = 'Wait for the exact Surface image to load.'; changed(); return; }
        if (mode === 'paint') pool = [pin(asset)];
        else pool = input.checked ? [...pool, pin(asset)] : pool.filter(item => pinKey(item) !== pinKey(asset));
        invalidate();
      });
      label.append(input, imagePreview, node('span', `${asset.name} · ${asset.metadata?.spanTiles?.width ?? '?'}×${asset.metadata?.spanTiles?.height ?? '?'} · A${asset.assetVersion}/M${asset.metadataVersion}`));
      choices.append(label);
    }
    if (!available.length) choices.append(node('p', 'No Surfaces in this project yet. Add a Surface in the Library and make it READY first.'));
    panel.append(choices);
    const status = node('p', message || blocked || (mode === 'paint' ? 'Ready to paint.' : 'Choose your settings, then Preview fill.'), 'room-surface-status');
    status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    if (busy) status.textContent = `Saving or checking… ${queue.length ? `${queue.length} further paint click(s) queued.` : ''}`;
    if (queue.length && !busy) status.append(document.createTextNode(` ${queue.length} further click(s) are not saved yet.`));
    panel.append(status);
    const actions = node('div', undefined, 'room-surface-actions');
    if (attempt && !busy) actions.append(action('Retry same Surface change', () => void retryPending(), '', true));
    if (mode === 'fill') {
      if (preview) {
        const count = preview.plan.counts;
        panel.append(node('p', Object.entries(count ?? {}).map(([key, value]) => `${key.replace(/([A-Z])/g, ' $1')}: ${value}`).join(' · '), 'room-surface-counts'));
        actions.append(action('Apply fill', () => void commit(preview), busy ? 'Wait for the preview check.' : blocked, true),
          action('Shuffle', () => void previewFill(), locked ? 'Wait for the current operation.' : ''),
          action('Cancel', () => { preview = null; message = 'Preview cancelled. Saved room unchanged.'; changed(); }, locked ? 'Wait for the current operation.' : ''));
      } else actions.append(action('Preview fill', () => void previewFill(), busy ? 'Wait for the current operation.' : blocked || (!pool.length ? 'Choose at least one READY Surface.' : scope === 'selection' && !selection.size ? 'Select cells on the canvas first.' : ''), true));
    }
    if (queue.length && !busy) actions.append(action('Discard unsent clicks', () => { queue = []; changed(); }));
    const undoReason = locked ? 'Resolve the current save first.' : !undo ? 'No Surface change to undo in this session.'
      : undo.roomVariantId !== context.room.roomVariantId || context.room.version !== undo.appliedRoomVariantVersion
        ? 'The room has changed since this Surface operation. Its undo is no longer available.' : blocked;
    actions.append(action('Undo last Surface change', () => {
      const current = sync();
      void commit({ projectId: current.projectId, roomVariantId: current.room.roomVariantId, body: {
        expectedRevision: current.revision, idempotencyKey: `surface-undo:${crypto.randomUUID()}`,
        expectedRoomVariantVersion: current.room.version,
        appliedRoomVariantVersion: undo.appliedRoomVariantVersion, appliedPlanFingerprint: undo.appliedPlanFingerprint,
      } }, 'surfaces-undo');
    }, undoReason)); panel.append(actions);
    const overlaps = [...occupants(context)].filter(([, items]) => items.length > 1);
    if (overlaps.length) {
      const section = node('section', undefined, 'room-surface-overlaps');
      section.append(node('h4', `${overlaps.length} cell(s) have overlapping Surfaces`), node('p', 'Orange marks show where Surfaces are stacked. Choose a cell and explicitly keep one placement. The other whole room placements will be removed; Library assets remain.'));
      for (const [key, items] of overlaps) {
        const row = node('div'); row.append(action(`Cell ${key} · ${items.length} Surfaces`, () => { overlapCell = key; changed(); }));
        if (overlapCell === key) for (const [index, item] of items.entries()) {
          const choice = node('div', undefined, 'room-surface-overlap-choice');
          choice.append(node('small', `Placement ${item.placementId} · A${item.assetVersion}/M${item.metadataVersion}`));
          choice.append(action(`Keep ${surfacePlacementLabel(item, assetFor(item, context), index)}`, () => void repair(item, items), locked ? 'Resolve the current save first.' : blocked));
          row.append(choice);
        }
        section.append(row);
      }
      panel.append(section);
    }
    // Native disabled buttons cannot receive keyboard focus. Keep their reasons
    // visible as ordinary readable text as well as the pointer tooltip.
    const unavailable = [...panel.querySelectorAll('[data-surface-disabled-reason]')];
    if (unavailable.length) {
      const reasons = node('div', undefined, 'room-surface-disabled-reasons');
      for (const [index, button] of unavailable.entries()) {
        const description = node('p', `${button.textContent}: ${button.dataset.surfaceDisabledReason}`);
        description.id = `surface-action-reason-${index}`;
        button.setAttribute('aria-describedby', description.id);
        reasons.append(description);
      }
      panel.append(reasons);
    }
    return panel;
  }

  function decorate(board) {
    const context = sync(); if (!context?.room) return;
    board.querySelectorAll('[data-surface-overlay]').forEach(item => item.remove());
    board.dataset.surfaceEditing = String(Boolean(context.active));
    const occupied = occupants(context);
    for (const cell of board.querySelectorAll('[data-room-control="cell"]')) {
      const key = `${cell.dataset.x},${cell.dataset.y}`, overlap = (occupied.get(key)?.length ?? 0) > 1;
      cell.dataset.surfaceSelected = String(context.active && selection.has(key));
      cell.dataset.surfaceOverlap = String(overlap);
      const baseLabel = cell.getAttribute('aria-label').split(';')[0];
      cell.setAttribute('aria-label', `${baseLabel}${overlap ? '; overlapping Surfaces — choose which to keep' : ''}${selection.has(key) && context.active ? '; selected for fill' : ''}`);
      if (overlap || (context.active && selection.has(key))) {
        const marker = node('div', undefined, `room-surface-marker${overlap ? ' overlap' : ''}${selection.has(key) && context.active ? ' selected' : ''}`);
        marker.dataset.surfaceOverlay = ''; marker.style.left = `calc(${cell.dataset.x} * var(--room-cell))`; marker.style.top = `calc(${cell.dataset.y} * var(--room-cell))`; board.append(marker);
      }
    }
    if (!context.active || !preview) return;
    for (const placement of preview.plan.additions) {
      const asset = assetFor(placement, context), span = spanOf(asset, placement.rotation);
      if (!span) continue;
      const overlay = node('div', undefined, 'room-surface-preview'); overlay.dataset.surfaceOverlay = '';
      overlay.style.left = `calc(${placement.anchor.x} * var(--room-cell))`; overlay.style.top = `calc(${placement.anchor.y} * var(--room-cell))`;
      overlay.style.width = `calc(${span.width} * var(--room-cell))`; overlay.style.height = `calc(${span.height} * var(--room-cell))`;
      overlay.append(visual(asset, placement.rotation)); board.append(overlay);
    }
  }

  function pointer(event, cell, board) {
    const context = sync();
    if (!context?.active || mode !== 'fill' || locked() || event.button > 0) return false;
    if (event.type === 'pointerdown' && cell) {
      gesture = { id: event.pointerId, start: cell, end: cell, additive: event.shiftKey, original: new Map(selection), board };
      board.setPointerCapture(event.pointerId); event.preventDefault(); return true;
    }
    if (!gesture || event.pointerId !== gesture.id) return false;
    if (event.type === 'pointermove' && cell) {
      gesture.end = cell; selection = gesture.additive ? new Map(gesture.original) : new Map();
      for (const value of surfaceRectangle(gesture.start, cell)) selection.set(cellKey(value), value);
      preview = null; decorate(board); event.preventDefault(); return true;
    }
    if (['pointerup', 'pointercancel', 'lostpointercapture'].includes(event.type)) {
      const prior = gesture; gesture = null;
      if (event.type !== 'pointerup') selection = prior.original;
      else if (cellKey(prior.start) === cellKey(prior.end)) {
        selection = prior.original; const key = cellKey(prior.start);
        if (selection.has(key)) selection.delete(key); else selection.set(key, prior.start);
      }
      scope = 'selection'; preview = null; suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
      if (board.hasPointerCapture(prior.id)) board.releasePointerCapture(prior.id);
      changed(); return true;
    }
    return false;
  }
  const locked = () => busy || Boolean(attempt);
  return { render, decorate, clickCell, pointer, sync, retryPending,
    rotateBrush() { if (!locked()) { rotation = (rotation + 90) % 360; invalidate(); } },
    isLocked: locked, hasUnresolved: () => Boolean(attempt) || queue.length > 0,
    isBusy: () => busy, isSelecting: () => Boolean(gesture),
    getState: () => ({ mode, scope, policy, rotation, randomRotation, pool, selection: [...selection.values()], preview, attempt, undo, busy, queue, message }),
  };
}
