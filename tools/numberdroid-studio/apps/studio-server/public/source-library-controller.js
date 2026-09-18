import { assetEditorDefaultMetadata } from './asset-editor-state.js';

const clone = value => structuredClone(value);
const el = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const imageUri = (projectId, output) => output.preview?.resourceUri ?? `/api/projects/${encodeURIComponent(projectId)}/artifacts/sha256/${output.digest}`;

// Browser drafts and recovery payloads are conveniences only. Every request is
// re-authorized and its exact source/destination coordinates checked by the core.
export function createSourceLibraryController({ context, request, onSaved, onBusy, onOpenAsset, onRecheck = async () => {} }) {
  const element = el('section', undefined, 'source-library-workflow');
  element.dataset.sourceLibrary = '';
  let current = context, captured = null, bootstrap = null, rows = [], plan = null;
  let error = null, busy = false, dirty = false, uncertain = null, receipt = null, generation = 0, disposed = false;
  let recoveryDamaged = false, refreshFailed = false;
  const storageKey = `studio.image-library.pending:${context.projectId}:${context.atlas.id}`;
  try {
    const saved = sessionStorage.getItem(storageKey);
    if (saved) {
      const value = saved.length < 262144 ? JSON.parse(saved) : null;
      if (!value || typeof value !== 'object' || typeof value.idempotencyKey !== 'string'
          || !Array.isArray(value.items) || !value.items.length || !Number.isSafeInteger(value.expectedRevision)) {
        throw new Error('The retained save request is unreadable. Keep this page open and ask for recovery before starting another save.');
      }
      uncertain = value;
    }
  } catch (failure) { recoveryDamaged = true; error = failure.message; }
  const key = c => JSON.stringify([c.projectId, c.atlas.id, c.atlas.definitionVersion, c.atlas.definitionFingerprint, c.job?.jobId, c.job?.state]);
  const locked = () => busy || Boolean(uncertain) || recoveryDamaged;
  const stale = () => captured && (captured.revision !== current.revision || key(captured) !== key(current));
  const targetFor = row => bootstrap?.targets?.find(asset => asset.assetId === row.target);
  const button = (text, action, { disabled = false, reason = '', primary = false } = {}) => {
    const node = el('button', text, primary ? '' : 'secondary'); node.type = 'button'; node.dataset.sourceLibraryAction = action; node.disabled = disabled;
    if (!disabled) return node;
    node.title = reason; const wrapper = el('span', undefined, 'source-library-disabled'); wrapper.tabIndex = 0; wrapper.title = reason; wrapper.setAttribute('aria-label', `${text}. ${reason}`); wrapper.append(node); return wrapper;
  };
  function picture(output, name) {
    const link = el('a', undefined, 'source-library-image'); link.href = imageUri(current.projectId, output); link.target = '_blank'; link.rel = 'noopener'; link.title = 'Open full image in a new tab';
    const image = el('img'); image.src = link.href; image.alt = name; link.append(image); return link;
  }
  function field(label, node) { const wrapper = el('label'); wrapper.append(el('span', label), node); return wrapper; }
  function requestInput() {
    const input = captured.job?.state === 'SUCCEEDED'
      ? { mode: 'generated', jobId: captured.job.jobId } : clone(bootstrap.savedInput);
    return { expectedRevision: captured.revision, expectedAtlasVersion: captured.atlas.definitionVersion,
      expectedAtlasFingerprint: captured.atlas.definitionFingerprint, input,
      items: rows.map(row => ({ rectangleId: row.rectangleId, destination: row.target === 'skip' ? { operation: 'skip' }
        : row.target === 'new' ? { operation: 'create', assetId: row.assetId, name: row.name.trim(), kind: row.kind, metadata: assetEditorDefaultMetadata() }
          : { operation: 'update', assetId: row.target, expectedAssetVersion: row.targetVersion, expectedMetadataVersion: row.targetMetadataVersion, name: row.name.trim() } })) };
  }
  function initializeRows(preserve, { keepSkipped = false } = {}) {
    const previous = rows;
    const outputs = current.job?.state === 'SUCCEEDED' ? current.job.outputs.map(output => ({ ...output, rectangle: current.atlas.rectangles.find(r => r.rectangleId === output.rectangleId) }))
      : (bootstrap.savedInput?.slices ?? []).map(pin => current.atlas.sliceHeads.find(s => s.sliceId === pin.sliceId && s.version === pin.expectedSliceVersion)).filter(Boolean);
    rows = outputs.map((output, index) => {
      const rectangleId = output.rectangleId ?? output.rectangle?.rectangleId;
      const previousRow = previous.find(row => row.rectangleId === rectangleId);
      const skip = keepSkipped && (previousRow?.target === 'skip'
        || receipt?.items?.some(item => item.rectangleId === rectangleId && item.status === 'skipped'));
      const old = (preserve || skip) && previousRow;
      if (old) {
        const target = bootstrap.targets?.find(a => a.assetId === old.target);
        return { ...old, output, targetVersion: target?.assetVersion, targetMetadataVersion: target?.metadataVersion };
      }
      const mapping = bootstrap.priorMappings?.find(mapping => mapping.rectangleId === rectangleId);
      const matches = (bootstrap.targets ?? []).filter(asset => asset.sliceBinding?.sliceId === output.sliceId && asset.sliceBinding?.sliceVersion === output.version);
      const target = bootstrap.targets?.find(a => a.assetId === mapping?.assetId) ?? (matches.length === 1 ? matches[0] : null);
      return { rectangleId, output, name: target?.name ?? output.rectangle?.name ?? `Image ${index + 1}`, kind: target?.kind ?? 'prop',
        target: skip ? 'skip' : target?.assetId ?? 'new', assetId: `asset.image.${crypto.randomUUID()}`, targetVersion: target?.assetVersion, targetMetadataVersion: target?.metadataVersion };
    });
  }
  function validateBootstrap(result) {
    if (result.projectId !== current.projectId || result.atlasId !== current.atlas.id
        || result.revision !== current.revision || result.expectedAtlasVersion !== current.atlas.definitionVersion
        || result.expectedAtlasFingerprint !== current.atlas.definitionFingerprint) {
      throw new Error('The project changed while loading destinations. Recheck current versions to continue.');
    }
  }
  async function refresh({ preserve = false } = {}) {
    if (busy || uncertain || recoveryDamaged || disposed) return;
    const ticket = ++generation; busy = true; error = null; render();
    try {
      if (preserve) await onRecheck();
      const result = await request('bootstrap', {});
      if (disposed || ticket !== generation) return;
      validateBootstrap(result);
      bootstrap = result; captured = clone(current);
      initializeRows(preserve && !refreshFailed, { keepSkipped: refreshFailed });
      plan = null; receipt = null; dirty = preserve && dirty; refreshFailed = false;
    } catch (failure) { if (ticket === generation) error = failure.message; }
    finally { if (!disposed && ticket === generation) { busy = false; render(); } }
  }
  function render() {
    if (disposed) return;
    const active = document.activeElement; const inside = element.contains(active);
    const focus = inside ? active.dataset.sourceLibraryField : null; const rowKey = active?.dataset.rectangleId;
    const actionNode = inside ? (active.dataset.sourceLibraryAction ? active : active.querySelectorAll('[data-source-library-action]')[0]) : null;
    const actionFocus = actionNode ? { action: actionNode.dataset.sourceLibraryAction, assetId: actionNode.dataset.assetId } : null;
    const selection = active?.selectionStart; const selectionEnd = active?.selectionEnd; const page = { x: window.scrollX, y: window.scrollY };
    const restoreFocus = () => {
      const restored = focus
        ? [...element.querySelectorAll('[data-source-library-field]')].find(node => node.dataset.sourceLibraryField === focus && node.dataset.rectangleId === rowKey)
        : actionFocus && [...element.querySelectorAll('[data-source-library-action]')].find(node => node.dataset.sourceLibraryAction === actionFocus.action && node.dataset.assetId === actionFocus.assetId);
      (restored?.disabled ? restored.parentElement : restored)?.focus({ preventScroll: true });
      if (restored?.type === 'text' && Number.isInteger(selection)) restored.setSelectionRange(selection, Number.isInteger(selectionEnd) ? selectionEnd : selection);
    };
    element.replaceChildren(el('h3', 'Choose where these images go'), el('p', 'Add new Library images, update named images, or skip them. Your original and existing saved uses stay unchanged.', 'source-library-help'));
    if (uncertain) {
      const notice = el('div', undefined, 'source-library-notice'); notice.setAttribute('role', 'status');
      notice.append(el('strong', 'Confirm the previous save before editing'), el('p', 'The response was not confirmed. Retry sends exactly the same request; it cannot create a second copy.'), button('Retry the same save', 'save', { disabled: busy, reason: 'Waiting for the save response.', primary: true })); element.append(notice);
    }
    if (error) { const notice = el('p', error, 'source-library-error'); notice.setAttribute('role', 'alert'); element.append(notice); }
    if ((stale() || refreshFailed) && !uncertain) element.append(el('p', 'Recheck the current versions of the project and Library before saving again.', 'source-library-notice'), button('Recheck current versions', 'recheck', { disabled: locked(), reason: 'Resolve the pending operation first.' }));
    if (!bootstrap) { if (!uncertain && !recoveryDamaged) element.append(button(busy ? 'Loading Library destinations…' : 'Recheck Library destinations', 'recheck', { disabled: busy, reason: 'Loading the current saved destinations.' })); restoreFocus(); return; }
    const grid = el('div', undefined, 'source-library-grid');
    for (const row of rows) {
      const card = el('article', undefined, 'source-library-card'); card.dataset.sourceLibraryRectangle = row.rectangleId;
      const target = targetFor(row), result = plan?.items?.find(item => item.rectangleId === row.rectangleId);
      card.append(picture(row.output, row.name));
      const body = el('div', undefined, 'source-library-card-body'); body.append(el('h4', row.name || 'Unnamed image'), el('small', `${row.output.width} × ${row.output.height} px`));
      const name = el('input'); name.type = 'text'; name.value = row.name; name.maxLength = 160; name.dataset.sourceLibraryField = 'name'; name.dataset.rectangleId = row.rectangleId; name.disabled = locked(); body.append(field('Library name', name));
      const use = el('select'); use.dataset.sourceLibraryField = 'kind'; use.dataset.rectangleId = row.rectangleId;
      for (const [value, label] of [['prop', 'Prop'], ['item', 'Item'], ['surface', 'Surface']]) { const option = el('option', label); option.value = value; use.append(option); } use.value = target?.kind ?? row.kind; use.disabled = locked() || Boolean(target); body.append(field(target ? 'Use — retained from Library' : 'Use', use));
      const destination = el('select'); destination.dataset.sourceLibraryField = 'target'; destination.dataset.rectangleId = row.rectangleId;
      for (const [value, label] of [['new', 'Add as new Library image'], ...(bootstrap.targets ?? []).map(asset => [asset.assetId, `Update “${asset.name}” · v${asset.assetVersion}`]), ['skip', 'Skip this image']]) { const option = el('option', label); option.value = value; destination.append(option); }
      destination.value = row.target; destination.disabled = locked(); body.append(field('Library destination', destination));
      body.append(el('p', row.target === 'skip' ? 'No Library item is added or changed. Existing content is kept.' : target
        ? `Updates only “${target.name}”. Its placement settings stay unchanged; Rooms and Assemblies keep their saved versions.`
        : 'Creates an Image draft in Library. Set placement and blocking there before use.', 'source-library-consequence'));
      if (target && target.sliceBinding && target.sliceBinding.digest !== row.output.digest) {
        const compare = el('div', undefined, 'source-library-comparison');
        for (const [output, label] of [[target.sliceBinding, `In Library · v${target.assetVersion}`], [row.output, 'Your proposed image']]) { const figure = el('figure'); figure.append(picture(output, label), el('figcaption', label)); compare.append(figure); } body.append(compare);
      }
      if (result) {
        body.append(el('p', ({ created: 'Will be added', create: 'Will be added', updated: 'Will be updated', update: 'Will be updated', unchanged: 'Already in Library — no new version needed', skipped: 'Skipped', skip: 'Skipped' })[String(result.status).toLowerCase()] ?? result.status, 'source-library-result'));
        for (const finding of result.findings ?? []) body.append(el('small', finding.explanation ?? finding.message ?? finding.ruleId));
      }
      const saved = receipt?.items?.find(item => item.rectangleId === row.rectangleId && item.assetId);
      if (saved) { const open = button(`Open in Library · v${saved.assetVersion}`, 'open'); open.dataset.assetId = saved.assetId; body.append(open); }
      card.append(body); grid.append(card);
    }
    element.append(grid);
    if (!rows.length) element.append(el('p', 'Generate images from your selected cut areas to choose their Library destinations.'));
    if (plan?.guidance) element.append(el('p', typeof plan.guidance === 'string' ? plan.guidance : JSON.stringify(plan.guidance), 'source-library-notice'));
    if (plan?.status === 'REDUNDANT_OUTPUTS_DISCARD_REQUIRED' || plan?.code === 'REDUNDANT_OUTPUTS_DISCARD_REQUIRED') element.append(el('p', 'These images were already generated and saved. Use “Discard generated results” above to remove only this duplicate preview, then continue with the existing images. No Library image or original is deleted.', 'source-library-notice'));
    if (receipt) { const summary = receipt.summary; element.append(el('p', `Saved in Library: ${summary.created} added, ${summary.updated} updated, ${summary.unchanged} unchanged, ${summary.skipped} skipped.`, 'source-library-notice')); }
    const actions = el('div', undefined, 'source-library-actions');
    const blocked = locked() || stale() || refreshFailed || !rows.length || rows.some(row => row.target !== 'skip' && !row.name.trim());
    const reason = locked() ? 'Resolve the pending save first.' : stale() || refreshFailed ? 'Recheck the current project and destination versions.' : !rows.length ? 'Generate or reopen image outputs first.' : 'Give each included image a name.';
    const summary = plan?.summary;
    const saveLabel = summary ? (summary.updated ? `Save ${summary.updated} update${summary.updated === 1 ? '' : 's'} + ${summary.created} addition${summary.created === 1 ? '' : 's'}`
      : summary.created ? `Add ${summary.created} image${summary.created === 1 ? '' : 's'} to Library` : 'Confirm unchanged images') : 'Save to Library';
    actions.append(button('Check changes', 'plan', { disabled: blocked, reason }), button(busy ? 'Working…' : saveLabel, 'save', { disabled: blocked || !plan?.canSave, reason: blocked ? reason : 'Check the proposed changes before saving.', primary: true }));
    element.append(actions);
    restoreFocus();
    if (element.isConnected) window.scrollTo(page.x, page.y);
  }
  async function check() {
    if (locked() || stale() || refreshFailed || !captured) return;
    busy = true; error = null; render();
    const ticket = ++generation;
    try { const result = await request('plan', requestInput()); if (!disposed && ticket === generation) plan = result; }
    catch (failure) { if (!disposed && ticket === generation) { error = failure.message; plan = null; } }
    finally { if (!disposed && ticket === generation) { busy = false; render(); } }
  }
  async function save() {
    if (busy || recoveryDamaged || (!uncertain && (!plan?.canSave || stale() || refreshFailed))) return;
    const firstAttempt = !uncertain;
    if (firstAttempt) uncertain = { ...requestInput(), idempotencyKey: `image-library.${crypto.randomUUID()}` };
    try { sessionStorage.setItem(storageKey, JSON.stringify(uncertain)); }
    catch {
      error = 'Nothing was sent. The browser cannot retain this save for recovery. Allow session storage before saving.';
      if (firstAttempt) uncertain = null;
      render(); return;
    }
    busy = true; onBusy(true); render();
    let committed = false;
    try {
      const result = await request('save', clone(uncertain));
      if (disposed) return;
      if (result.projectId !== current.projectId || result.atlasId !== current.atlas.id || !Array.isArray(result.items)) throw new Error('The save response could not be verified. Retry the same save.');
      committed = true;
      receipt = result; uncertain = null; dirty = false; plan = null;
      try { sessionStorage.removeItem(storageKey); } catch { /* Replaying the retained payload is still safe. */ }
      await onSaved(result); captured = clone(current);
      const refreshed = await request('bootstrap', {}); if (disposed) return; validateBootstrap(refreshed); bootstrap = refreshed; initializeRows(false, { keepSkipped: true }); refreshFailed = false;
    } catch (failure) {
      error = committed ? `Saved successfully. The view could not refresh: ${failure.message}. Recheck current versions; do not create another copy.` : failure.message;
      if (committed) refreshFailed = true;
      // Only a definitive FIRST-attempt rejection proves that no save committed.
      // A later denial (including lost authority) says nothing about an earlier
      // ambiguous attempt. Keep its exact request/key, including after reload.
      if (!committed && firstAttempt && failure.code && failure.code !== 'IDEMPOTENCY_CONFLICT' && failure.status >= 400 && failure.status < 500 && failure.status !== 429) {
        uncertain = null; plan = null; try { sessionStorage.removeItem(storageKey); } catch {}
      }
    } finally { if (!disposed) { busy = false; onBusy(Boolean(uncertain)); render(); } }
  }
  element.addEventListener('change', event => {
    const node = event.target.closest('[data-source-library-field]'); if (!node || locked()) return;
    const row = rows.find(row => row.rectangleId === node.dataset.rectangleId); if (!row) return;
    row[node.dataset.sourceLibraryField] = node.value;
    if (node.dataset.sourceLibraryField === 'target') { const target = targetFor(row); row.targetVersion = target?.assetVersion; row.targetMetadataVersion = target?.metadataVersion; if (target) { row.name = target.name; row.kind = target.kind; } }
    dirty = true; plan = null; receipt = null; error = null; render();
  });
  element.addEventListener('click', event => {
    const node = event.target.closest('[data-source-library-action]'); if (!node || node.disabled) return;
    const action = node.dataset.sourceLibraryAction;
    if (action === 'plan') void check(); else if (action === 'save') void save(); else if (action === 'reload' || action === 'recheck') void refresh({ preserve: action === 'recheck' });
    else if (action === 'open') {
      const saved = receipt?.items?.find(item => item.assetId === node.dataset.assetId);
      if (saved) onOpenAsset({ assetId: saved.assetId, assetVersion: saved.assetVersion, metadataVersion: saved.metadataVersion });
    }
  });
  function update(next) {
    if (disposed) return; const prior = current; current = next;
    if (!same(prior, next) && !busy) { if (!uncertain && !dirty && key(prior) !== key(next)) void refresh(); else render(); }
  }
  render(); if (!uncertain && !error) void refresh(); else if (uncertain || recoveryDamaged) onBusy(true);
  return { element, update, hasPending: () => locked(), hasUncertain: () => Boolean(uncertain) || recoveryDamaged, dispose: () => { disposed = true; generation++; } };
}
