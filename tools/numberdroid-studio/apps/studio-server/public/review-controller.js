import { renderReviewView } from './review-view.js';
import { createReviewUiState, reviewPresentation, reviewPendingIds, reviewStaleness, beginReviewFeedback, cancelReviewFeedback,
  retainReviewDraft, reuseReviewDraft, adoptReviewGroup, createReviewIntent } from './review-state.js';

const copy = value => structuredClone(value);
const equalIds = (a = [], b = []) => a.length === b.length && a.every(id => b.includes(id));

export function captureReviewContext(element) {
  const active = element.ownerDocument?.activeElement;
  const focus = element.contains(active) ? active?.dataset?.reviewFocus : null;
  return {
    pageX: globalThis.scrollX ?? 0, pageY: globalThis.scrollY ?? 0, focus,
    selection: focus && typeof active.selectionStart === 'number' ? [active.selectionStart, active.selectionEnd, active.selectionDirection] : null,
    panels: [...element.querySelectorAll('[data-review-scroll]')].map(node => ({ key: node.dataset.reviewScroll, x: node.scrollLeft, y: node.scrollTop })),
    disclosures: [...element.querySelectorAll('[data-review-disclosure]')].map(node => ({ key: node.dataset.reviewDisclosure, open: node.open })),
  };
}
export function restoreReviewContext(element, snapshot) {
  if (!snapshot || !element.isConnected) return;
  // Restore disclosure geometry before scroll, avoiding clamped retained positions.
  for (const saved of snapshot.disclosures) {
    const node = [...element.querySelectorAll('[data-review-disclosure]')].find(candidate => candidate.dataset.reviewDisclosure === saved.key);
    if (node) node.open = saved.open;
  }
  for (const saved of snapshot.panels) {
    const node = [...element.querySelectorAll('[data-review-scroll]')].find(candidate => candidate.dataset.reviewScroll === saved.key);
    if (node) { node.scrollLeft = saved.x; node.scrollTop = saved.y; }
  }
  const focus = [...element.querySelectorAll('[data-review-focus]')].find(node => node.dataset.reviewFocus === snapshot.focus);
  if (focus && !focus.disabled) { focus.focus({ preventScroll: true }); if (snapshot.selection && typeof focus.setSelectionRange === 'function') focus.setSelectionRange(...snapshot.selection); }
  globalThis.scrollTo?.(snapshot.pageX, snapshot.pageY);
}

/** One controller owns one exact Review, including an unresolved write across detours. */
export function createReviewController({ context: initial, host, renderView = renderReviewView, createElement = () => document.createElement('section') }) {
  const element = createElement(), state = createReviewUiState(initial);
  element.className = 'shared-review-controller';
  let disposed = false, generation = 0, readController = null, mutationController = null, rendered = null, retainedContext = null;
  const current = () => host.context?.() ?? { projectId: state.projectId, projectRevision: state.projectRevision };
  const activeProject = () => current()?.projectId === state.projectId;
  const presentation = () => reviewPresentation(state, current());
  function render({ restore = true } = {}) {
    if (disposed) return;
    const snapshot = restore && element.isConnected ? captureReviewContext(element) : null;
    rendered?.dispose?.();
    rendered = renderView({ state, view: presentation(), onAction: dispatch, onInput: input, onSelection: select,
      onDetails: payload => inspect(payload) });
    element.replaceChildren(rendered);
    element.dataset.reviewId = state.reviewId ?? '';
    element.dataset.reviewVersion = String(state.group?.reviewVersion ?? '');
    element.dataset.reviewPhase = state.phase;
    if (snapshot) restoreReviewContext(element, snapshot);
  }
  function requestBody({ latest = false, version } = {}) {
    return { schemaVersion: 1, projectId: state.projectId,
      ...(state.legacySource ? { legacySource: copy(state.legacySource) } : { reviewId: state.reviewId }),
      ...(!state.legacySource && !latest && (version ?? state.group?.reviewVersion ?? state.requestedReviewVersion) !== undefined
        ? { reviewVersion: version ?? state.group?.reviewVersion ?? state.requestedReviewVersion } : {}),
      includeHistory: true,
      ...(state.group ? { selectedItemIds: [...state.selectedItemIds] } : {}),
      ...(Object.keys(state.selection).length ? { selection: copy(state.selection) } : {}) };
  }
  async function read({ mode = 'refresh', version } = {}) {
    if (disposed || !activeProject() || state.phase === 'saving') return false;
    readController?.abort(); const controller = new AbortController(), own = ++generation;
    readController = controller;
    const request = requestBody({ latest: ['latest', 'check'].includes(mode), version });
    const hadGroup = Boolean(state.group), wasUncertain = state.phase === 'uncertain';
    state.load = 'loading'; if (!wasUncertain) state.phase = 'loading'; render();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await host.read(copy(request), { signal: controller.signal });
      if (disposed || own !== generation || !activeProject()) return false;
      const group = response?.groups?.find(entry => !state.reviewId || entry.reviewId === state.reviewId);
      if (response?.projectId !== state.projectId || !Number.isInteger(response.revision) || !group) throw new Error('The response did not identify this exact Review.');
      if (request.reviewVersion !== undefined && group.reviewVersion !== request.reviewVersion) throw new Error('The response returned a different Review version.');
      if (wasUncertain || mode === 'check') {
        state.latest = copy(group); state.error = state.intent ? 'The latest saved state was checked. Retry the retained exact request to confirm its receipt.' : null;
        state.load = 'ready'; return true;
      }
      const newer = hadGroup && group.reviewVersion > state.group.reviewVersion;
      if (newer && mode !== 'adopt' && mode !== 'receipt') {
        state.latest = copy(group); state.load = 'ready'; state.error = null; return true;
      }
      const previousVersion = state.group?.reviewVersion;
      adoptReviewGroup(state, group, response.revision, { preserveSelection: hadGroup, retainDraft: mode === 'adopt' && group.reviewVersion !== previousVersion });
      if (mode === 'receipt') cancelReviewFeedback(state);
      if (mode === 'adopt') state.latest = null;
      // Selection result is authoritative; no local approximation can enable acceptance.
      if (!equalIds(group.eligibility?.selectedItemIds, state.selectedItemIds)) {
        state.load = 'idle';
      }
      return true;
    } catch (error) {
      if (!disposed && own === generation && activeProject()) { state.load = 'unavailable'; state.error = error.message || 'The Review could not be checked.'; }
      return false;
    } finally {
      clearTimeout(timer); if (readController === controller) readController = null;
      if (!disposed && own === generation) {
        if (!wasUncertain) state.phase = 'idle'; render();
        if (state.load === 'idle') void read();
      }
    }
  }
  function input(field, value, itemId) {
    if (disposed || !state.feedback.editing || presentation().locked || state.readOnly) return;
    if (field === 'summary') state.feedback.draftSummary = String(value);
    else if (field === 'comment' && reviewPendingIds(state.group).includes(itemId)) state.feedback.draftItemComments[itemId] = String(value);
    else return;
    state.error = null; render();
  }
  async function select(itemId, selected) {
    if (disposed || presentation().locked || !state.group?.items.some(item => item.itemId === itemId && item.status === 'PENDING')) return;
    state.selectedItemIds = state.group.items.filter(item => item.status === 'PENDING' && (item.itemId === itemId ? selected : state.selectedItemIds.includes(item.itemId))).map(item => item.itemId);
    state.error = null; return read();
  }
  function inspect({ itemId = state.activeItemId, side = state.side } = {}) {
    if (!presentation().canInspect || typeof host.onDetails !== 'function') return;
    const item = state.group.items.find(candidate => candidate.itemId === itemId);
    if (!item || !['current', 'proposed'].includes(side)) return;
    const record = side === 'current' ? item.current : item.proposed, resolved = side === 'current' ? item.resolvedCurrent : item.resolvedProposed;
    if (!record) return;
    if (element.isConnected) retainedContext = captureReviewContext(element);
    rendered?.dispose?.();
    host.onDetails(copy({ projectId: state.projectId, projectRevision: state.projectRevision, reviewId: state.reviewId,
      reviewVersion: state.group.reviewVersion, contentVersion: state.group.contentVersion,
      itemId, contentKind: item.contentKind, side, record, resolved, selection: state.selection,
      scene: resolved?.scene, leafAssets: resolved?.leafAssets, frameBindings: resolved?.frameBindings, readOnly: true }));
  }
  function validReceipt(receipt, intent) {
    const value = receipt?.value;
    if (receipt?.projectId !== intent.projectId || receipt.revision !== intent.body.expectedRevision + 1 || value?.reviewId !== intent.reviewId || value.reviewVersion !== intent.body.expectedReviewVersion + 1 || value.contentVersion !== intent.contentVersion) return false;
    if (intent.action === 'feedback') return value.status === 'CHANGES_REQUESTED';
    if (intent.action === 'discard') return value.status === 'DISCARDED';
    return ['PENDING', 'CHANGES_REQUESTED', 'ACCEPTED'].includes(value.status) && equalIds(value.accepted?.map(item => item.itemId), intent.body.selectedItemIds)
      && intent.acceptedPins.every(pin => {
        const actual = value.accepted.find(item => item.itemId === pin.itemId);
        return ['assetId', 'assetVersion', 'metadataVersion'].every(key => pin[key] !== undefined && actual?.[key] === pin[key]);
      });
  }
  async function mutate(action, retry = false) {
    if (disposed || state.phase === 'saving' || !activeProject() || !state.canMutate || state.readOnly) return false;
    if (!retry && state.intent) return false;
    if (retry && (!state.intent || state.phase !== 'uncertain')) return false;
    if (!retry) {
      try { state.intent = createReviewIntent(state, action, current(), `review.owner.${crypto.randomUUID()}`); }
      catch (error) { state.error = error.message; render(); return false; }
    }
    const intent = state.intent, wasUncertain = retry, controller = new AbortController(); mutationController = controller;
    readController?.abort(); generation += 1;
    state.phase = 'saving'; state.error = null; host.setMutationPending?.(true); render();
    const timer = setTimeout(() => controller.abort(), 15000); let receipt;
    try {
      receipt = await host.post(intent.action, { projectId: intent.projectId, reviewId: intent.reviewId, body: copy(intent.body), serialized: intent.serialized }, { signal: controller.signal });
      if (!validReceipt(receipt, intent)) throw new Error('The response did not confirm this exact Review decision.');
    } catch (error) {
      const rejected = !wasUncertain && Number.isInteger(error.status) && error.status >= 400 && error.status < 500 && error.status !== 408;
      if (!disposed) {
        state.phase = rejected ? 'idle' : 'uncertain'; if (rejected) state.intent = null;
        state.error = rejected ? error.message : 'The outcome is unconfirmed. Retry the retained exact request to recover its original receipt.';
      }
      return false;
    } finally {
      clearTimeout(timer); mutationController = null; host.setMutationPending?.(false);
      if (!receipt || !validReceipt(receipt, intent)) render();
    }
    if (disposed) return false;
    // A validated receipt is final even if the subsequent display refresh fails.
    state.receipt = copy(receipt); state.intent = null; state.phase = 'idle'; state.error = null;
    state.reviewId = receipt.value.reviewId; state.legacySource = null;
    cancelReviewFeedback(state);
    try { await host.onSaved?.(receipt); } catch { state.error = 'The decision was saved. Recheck to display its result.'; }
    if (!disposed && activeProject()) await read({ mode: 'receipt', version: receipt.value.reviewVersion });
    return true;
  }
  async function dispatch(action, payload) {
    if (disposed) return false;
    if (action === 'retry') return mutate(null, true);
    if (action === 'check') return read({ mode: 'check' });
    if (action === 'recheck') return read({ mode: 'latest' });
    if (action === 'accept' || action === 'discard') return mutate(action);
    if (action === 'save-feedback') return mutate('feedback');
    const view = presentation();
    if (view.locked) return false;
    if (action === 'request-changes' || action === 'edit-feedback') { if (view.canEditFeedback) { beginReviewFeedback(state); state.error = null; render(); } }
    else if (action === 'cancel-feedback') { cancelReviewFeedback(state); state.error = null; render(); }
    else if (action === 'copy-older-draft') { if (view.canEditFeedback) { reuseReviewDraft(state); render(); } }
    else if (action === 'review-latest') {
      if (!view.canAdoptLatest) return false;
      const latestVersion = state.latest?.reviewVersion ?? state.group.latestReviewVersion;
      return read({ mode: 'adopt', version: latestVersion });
    } else if (action === 'highlight') { state.highlight = payload === true; render(); }
    else if (action === 'side' && ['current', 'proposed'].includes(payload)) { state.side = payload; render(); }
    else if (action === 'item' && state.group?.items.some(item => item.itemId === payload)) { state.activeItemId = payload; render(); }
    else if (action === 'presentation') { state.selection = Object.fromEntries(['stateId', 'variantId'].filter(key => typeof payload?.[key] === 'string').map(key => [key, payload[key]])); return read(); }
    else if (action === 'details') inspect(payload);
    else if (action === 'back' && requestLeave()) host.onBack?.();
    return true;
  }
  function requestLeave() {
    if (state.intent || state.phase === 'saving') { host.announce?.('Confirm the pending Review outcome before leaving. Its exact request is retained.'); return false; }
    if (element.isConnected) retainedContext = captureReviewContext(element); return true;
  }
  render({ restore: false });
  return { element, getState: () => state, dispatch,
    afterMount() {
      render({ restore: false }); restoreReviewContext(element, retainedContext);
      if (state.load === 'idle') void read();
    },
    reconcileContext(next) {
      if (next) { if (next.canMutate !== undefined) state.canMutate = next.canMutate === true; if (next.readOnly !== undefined) state.readOnly = next.readOnly === true; }
      const context = next ?? current(), latest = context.latestGroup ?? context.group;
      if (context.projectId !== state.projectId) {
        readController?.abort(); generation += 1;
        if (!state.intent && state.load === 'loading') { state.load = 'idle'; state.phase = 'idle'; }
        render(); return;
      }
      if (latest?.reviewId === state.reviewId && latest.reviewVersion > (state.group?.reviewVersion ?? -1)) state.latest = copy(latest);
      render();
      if (!state.intent && (state.load === 'idle' || context.projectRevision !== state.projectRevision) && !reviewStaleness(state) && state.load !== 'loading') void read();
    },
    requestLeave,
    dispose() {
      // The host must keep an uncertain controller reachable until its receipt is confirmed.
      if (state.intent) { host.announce?.('The Review still owns an unconfirmed decision; retain it until reconciliation.'); return false; }
      disposed = true; generation += 1; readController?.abort(); mutationController?.abort(); rendered?.dispose?.(); return true;
    },
  };
}
