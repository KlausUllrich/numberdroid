import { assemblySvg, createAssemblyArtwork, assemblySceneFrame } from './assembly-artwork-view.js';

const copy = value => structuredClone(value);
const node = (tag, text, className = '') => { const n = document.createElement(tag); n.textContent = text ?? ''; n.className = className; return n; };
const statuses = { ACCEPT: 'ACCEPTED', REQUEST_CHANGES: 'CHANGES_REQUESTED', DISCARD: 'DISCARDED' };
export function assemblyProposalDiffRows(proposal, currentAsset) {
  const content = proposal.content;
  const describe = component => component ? `${component.name} · ${component.asset.assetId}@${component.asset.assetVersion}:${component.asset.metadataVersion} · (${component.position.x}, ${component.position.y}) · ${component.rotationDegrees}° · scale ${component.scale} · states ${component.stateIds === null ? 'all' : component.stateIds.join(', ') || 'none'} · variants ${component.variantOverrides.map(v => `${v.variantId}: ${v.asset.assetId}@${v.asset.assetVersion}:${v.asset.metadataVersion}`).join(', ') || 'base'}` : 'Absent';
  const before = new Map((currentAsset?.assembly.components ?? []).map(component => [component.componentId, component]));
  const after = new Map(content.assembly.components.map(component => [component.componentId, component]));
  return [
    ['Name', currentAsset?.name ?? 'New Assembly', content.name],
    ['Kind', currentAsset?.kind ?? '—', content.kind],
    ['Metadata', JSON.stringify(currentAsset?.metadata ?? null), JSON.stringify(content.metadata)],
    ['Placement bounds', JSON.stringify(currentAsset?.assembly.placementBounds ?? null), JSON.stringify(content.assembly.placementBounds)],
    ['Anchor / units per pixel', JSON.stringify(currentAsset ? [currentAsset.assembly.anchor, currentAsset.assembly.unitsPerPixel] : null), JSON.stringify([content.assembly.anchor, content.assembly.unitsPerPixel])],
    ['State / variant definitions', JSON.stringify(currentAsset ? [currentAsset.assembly.states, currentAsset.assembly.variants, currentAsset.assembly.defaultStateId, currentAsset.assembly.defaultVariantId] : null), JSON.stringify([content.assembly.states, content.assembly.variants, content.assembly.defaultStateId, content.assembly.defaultVariantId])],
    ['Blocking', JSON.stringify(currentAsset?.assembly.blocking ?? null), JSON.stringify(content.assembly.blocking)],
    ['Front-to-back order', [...before.keys()].join(', ') || '—', [...after.keys()].join(', ')],
    ...[...new Set([...before.keys(), ...after.keys()])].map(id => [id, describe(before.get(id)), describe(after.get(id))]),
  ];
}
export function assemblyReviewIntent({ projectId, projectRevision, proposal, decision, feedback, idempotencyKey }) {
  if (!statuses[decision] || proposal.status !== 'PENDING') throw new Error('Choose an action for the exact pending proposal.');
  const message = feedback?.trim() || null;
  if (decision === 'REQUEST_CHANGES' && !message) throw new Error('Write feedback before requesting changes.');
  if (message && message.length > 2000) throw new Error('Keep feedback within 2,000 characters.');
  const payload = { expectedRevision: projectRevision, idempotencyKey, expectedProposalVersion: proposal.proposalVersion, decision, feedback: message, confirmed: true };
  return { projectId, proposalId: proposal.proposalId, payload, serialized: JSON.stringify(payload) };
}

export function createAssemblyReviewController({ initial, host }) {
  const element = node('section', '', 'proposal-review assembly-proposal-review');
  const state = { projectId: initial.projectId, projectRevision: initial.projectRevision, proposal: copy(initial.proposal), currentAsset: copy(initial.currentAsset ?? null),
    feedback: '', scene: null, selection: { stateId: initial.proposal.content.assembly.defaultStateId, variantId: initial.proposal.content.assembly.defaultVariantId },
    load: 'idle', error: null, status: 'idle', intent: null };
  let disposed = false, generation = 0, readController = null, mutationController = null;
  const current = () => host.getContext();
  const conflict = () => {
    const context = current();
    if (context.projectId !== state.projectId) return 'Return to this project to review this proposal.';
    if (context.projectRevision !== state.projectRevision || context.proposal?.proposalVersion !== state.proposal.proposalVersion || context.proposal?.status !== state.proposal.status) return 'The project or proposal changed. Recheck it before deciding; your feedback is retained.';
    const content = state.proposal.content;
    if (content.operation === 'update' && (!context.asset || context.asset.assetVersion !== content.expectedAssetVersion || context.asset.metadataVersion !== content.expectedMetadataVersion)) return 'The target Assembly changed. Ask the agent to revise this proposal against its current version.';
    if (content.operation === 'create' && context.asset) return 'This Assembly already exists. Ask the agent to revise the proposal.';
    return null;
  };
  function render() {
    if (disposed) return;
    const active = element.contains(document.activeElement) ? document.activeElement : null;
    const focused = active?.dataset.assemblyReviewFocus ?? null;
    const selection = active && typeof active.selectionStart === 'number' ? { start: active.selectionStart, end: active.selectionEnd, direction: active.selectionDirection } : null;
    const comparisonOpen = element.querySelector?.('[data-assembly-review-comparison]')?.open ?? false;
    element.dataset.assemblyProposal = state.proposal.proposalId; element.dataset.assemblyProposalVersion = String(state.proposal.proposalVersion);
    element.dataset.assemblyReviewStatus = state.status;
    const heading = node('h3', `${state.proposal.content.name} — ${state.proposal.status}`);
    const identity = node('p', `Proposal ${state.proposal.proposalId} · version ${state.proposal.proposalVersion} · ${state.proposal.content.operation} · target Asset ${state.proposal.content.expectedAssetVersion}/${state.proposal.content.expectedMetadataVersion}`, 'assembly-note');
    const nodes = [heading, identity];
    if (state.proposal.feedback) nodes.push(node('p', `Saved feedback: ${state.proposal.feedback}`));
    const preview = node('div', '', 'assembly-review-preview'); preview.style.maxWidth = '520px'; preview.style.height = '260px';
    if (state.scene) { const frame = assemblySceneFrame(state.scene, state.proposal.content.assembly), svg = assemblySvg('svg', { viewBox: `${frame.x} ${frame.y} ${frame.width} ${frame.height}`, role: 'img', 'aria-label': `${state.proposal.content.name} proposed composition` });
      svg.style.width = '100%'; svg.style.height = '100%'; svg.append(createAssemblyArtwork(state.scene, { projectId: state.projectId })); preview.append(svg); }
    else preview.append(node('p', state.load === 'loading' ? 'Resolving exact component versions…' : 'The proposed preview is unavailable. Recheck to retry.'));
    nodes.push(preview);
    const selectors = node('div', '', 'asset-card-actions');
    for (const [key, choices, id] of [['stateId', state.proposal.content.assembly.states, 'stateId'], ['variantId', state.proposal.content.assembly.variants, 'variantId']]) {
      const label = node('label', key === 'stateId' ? 'State ' : 'Variant '), select = node('select'); select.dataset.assemblyReviewSelection = key; select.dataset.assemblyReviewFocus = key;
      for (const choice of choices) { const option = node('option', choice.name); option.value = choice[id]; select.append(option); } select.value = state.selection[key]; select.disabled = state.status === 'saving' || state.status === 'uncertain'; label.append(select); selectors.append(label);
    }
    nodes.push(selectors);
    const details = node('details'), summary = node('summary', 'Compare current and proposed components / geometry'), table = node('table', '', 'proposal-diff');
    details.dataset.assemblyReviewComparison = ''; details.open = comparisonOpen;
    const header = node('tr'); for (const label of ['Property / component', 'Current', 'Proposed']) header.append(node('th', label)); table.append(header);
    for (const row of assemblyProposalDiffRows(state.proposal, state.currentAsset)) { const tr = node('tr'); for (const value of row) { const cell = node('td', value); cell.style.overflowWrap = 'anywhere'; tr.append(cell); } table.append(tr); }
    details.append(summary, table); nodes.push(details);
    const error = node('p', state.error ?? (state.status === 'done' ? 'Owner decision saved.' : conflict()) ?? '', 'assembly-validation'); error.setAttribute('role', 'status'); nodes.push(error);
    if (state.proposal.status === 'PENDING' && state.status !== 'done') {
      const label = node('label', 'Feedback to the agent'), feedback = node('textarea'); feedback.rows = 3; feedback.maxLength = 2000; feedback.value = state.feedback; feedback.dataset.assemblyReviewFeedback = ''; feedback.dataset.assemblyReviewFocus = 'feedback'; feedback.disabled = state.status === 'saving' || state.status === 'uncertain' || !host.canMutate(); label.append(feedback); nodes.push(label);
      const actions = node('div', '', 'asset-card-actions');
      const button = (action, text, disabled = false) => { const control = node('button', text, action === 'ACCEPT' ? 'primary' : 'secondary'); control.type = 'button'; control.dataset.assemblyReviewAction = action; control.dataset.assemblyReviewFocus = action; control.disabled = disabled; actions.append(control); };
      const locked = state.status === 'saving' || !host.canMutate();
      if (state.status === 'uncertain') { button('retry', 'Retry exact decision', locked); button('check', 'Refresh saved outcome', locked); }
      else { const stale = Boolean(conflict()); button('ACCEPT', 'Accept changes and save Assembly', locked || stale || state.load !== 'ready'); button('REQUEST_CHANGES', 'Request changes', locked || stale); button('DISCARD', 'Discard proposal', locked || stale); button('recheck', 'Recheck current proposal', locked); }
      nodes.push(actions);
    }
    element.replaceChildren(...nodes);
    if (focused && element.isConnected) { const control = [...element.querySelectorAll('[data-assembly-review-focus]')].find(item => item.dataset.assemblyReviewFocus === focused); control?.focus({ preventScroll: true }); if (selection) control?.setSelectionRange?.(selection.start, selection.end, selection.direction); }
  }
  async function loadPreview() {
    if (disposed || !host.canRead()) return;
    readController?.abort(); const controller = new AbortController(), own = ++generation; readController = controller;
    const revision = state.projectRevision, version = state.proposal.proposalVersion, selection = JSON.stringify(state.selection);
    const timer = setTimeout(() => controller.abort(), 8000); state.load = 'loading'; render();
    try {
      const draft = await host.resolveDraft(state.proposal.content, state.selection, revision, { signal: controller.signal });
      if (disposed || own !== generation || current().projectId !== state.projectId || current().projectRevision !== revision || state.proposal.proposalVersion !== version || JSON.stringify(state.selection) !== selection) return;
      state.scene = draft.scene; state.load = 'ready'; state.error = null;
    } catch (error) { if (!disposed && own === generation) { state.load = 'failed'; state.error = error.message; } }
    finally { clearTimeout(timer); if (readController === controller) readController = null; if (!disposed && own === generation) render(); }
  }
  async function decide(decision, retry = false) {
    if (disposed || state.status === 'saving' || !host.canMutate()) return;
    if (!retry) {
      if (state.status === 'uncertain') return;
      const stale = conflict(); if (stale) { state.error = stale; render(); return; }
      if (decision === 'ACCEPT' && state.load !== 'ready') { state.error = 'Resolve the exact proposed preview before accepting.'; render(); return; }
      try { state.intent = assemblyReviewIntent({ ...state, decision, idempotencyKey: `assembly.resolve.${crypto.randomUUID()}` }); }
      catch (error) { state.error = error.message; render(); return; }
    }
    const intent = state.intent; if (!intent || current().projectId !== intent.projectId) return;
    const previouslyUncertain = state.status === 'uncertain', controller = new AbortController(); mutationController = controller; const timer = setTimeout(() => controller.abort(), 15000);
    state.status = 'saving'; host.setMutationPending(true); render();
    try {
      const receipt = await host.resolve(intent, { signal: controller.signal });
      if (disposed) return;
      if (receipt.projectId !== intent.projectId || receipt.revision !== intent.payload.expectedRevision + 1 || receipt.value?.proposalId !== intent.proposalId || receipt.value.proposalVersion !== intent.payload.expectedProposalVersion + 1 || receipt.value.status !== statuses[intent.payload.decision]) throw new Error('The response did not identify this exact owner decision.');
      state.status = 'done'; state.intent = null; state.error = null;
      try { await host.onSaved(receipt); } catch { state.error = 'The decision was saved. Refresh the project to see its current result.'; }
    } catch (error) {
      if (disposed) return;
      const rejected = !previouslyUncertain && Number.isInteger(error.status) && error.status >= 400 && error.status < 500 && error.status !== 408;
      state.status = rejected ? 'idle' : 'uncertain'; if (rejected) state.intent = null;
      state.error = rejected ? error.message : 'The decision outcome is unconfirmed. Its exact request and key are retained. Retry it to obtain the original receipt; visible matching content cannot confirm delivery.';
    } finally { clearTimeout(timer); mutationController = null; host.setMutationPending(false); render(); }
  }
  async function recheck(uncertain = false) {
    if (disposed || state.status === 'saving') return;
    try {
      await host.refresh(); if (disposed || current().projectId !== state.projectId) return;
      if (uncertain) { state.error = 'The project was refreshed. Retry the exact decision to confirm its receipt.'; render(); return; }
      const context = current(); if (!context.proposal) throw new Error('This proposal is no longer available.');
      state.projectRevision = context.projectRevision; state.proposal = copy(context.proposal); state.currentAsset = copy(context.asset ?? null); state.status = 'idle'; state.error = null;
      state.selection = { stateId: state.proposal.content.assembly.defaultStateId, variantId: state.proposal.content.assembly.defaultVariantId }; await loadPreview();
    } catch (error) { state.error = error.message; render(); }
  }
  element.addEventListener('input', event => { if (event.target.matches('[data-assembly-review-feedback]')) state.feedback = event.target.value; });
  element.addEventListener('change', event => { const key = event.target.dataset.assemblyReviewSelection; if (key) { state.selection[key] = event.target.value; void loadPreview(); } });
  element.addEventListener('click', event => { const action = event.target.closest('[data-assembly-review-action]'); if (!action || action.disabled) return;
    const key = action.dataset.assemblyReviewAction; if (key === 'retry') void decide(null, true); else if (key === 'recheck' || key === 'check') void recheck(key === 'check'); else void decide(key); });
  render();
  return { element, getState: () => state, afterMount() { if (state.load === 'idle') void loadPreview(); }, reconcileContext() {
    const context = current();
    if (state.status === 'done' && context.projectId === state.projectId && context.proposal && context.proposal.status !== 'PENDING') {
      state.proposal = copy(context.proposal); state.currentAsset = copy(context.asset ?? null); state.projectRevision = context.projectRevision;
    }
    render();
  },
    requestLeave() { if (['saving', 'uncertain'].includes(state.status)) { host.announce('Resolve the pending Assembly review request before leaving.'); return false; } return true; },
    dispose() { disposed = true; generation += 1; readController?.abort(); mutationController?.abort(); } };
}
