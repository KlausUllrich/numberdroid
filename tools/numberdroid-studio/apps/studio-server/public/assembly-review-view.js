import { assemblySvg, createAssemblyArtwork, updateAssemblyArtwork, assemblySceneFrame } from './assembly-artwork-view.js';
import { assemblyReviewChanges } from './assembly-review-summary.js';

const copy = value => structuredClone(value);
const node = (tag, text, className = '') => { const n = document.createElement(tag); n.textContent = text ?? ''; n.className = className; return n; };
const statuses = { ACCEPT: 'ACCEPTED', REQUEST_CHANGES: 'CHANGES_REQUESTED', DISCARD: 'DISCARDED' };
export function assemblyProposalDiffRows(proposal, currentAsset) {
  const content = proposal.content;
  const presentation = content => content.kind === 'none' ? 'none' : `${content.kind} ${content.asset.assetId}@${content.asset.assetVersion}:${content.asset.metadataVersion}`;
  const describe = component => component ? `${component.name} · ${presentation(component.content ?? { kind: 'image', asset: component.asset })} · (${component.position.x}, ${component.position.y}) · ${component.rotationDegrees}° · scale ${component.scale} · states ${component.stateIds === null ? 'all' : component.stateIds.join(', ') || 'none'} · variants ${component.variantOverrides.map(v => `${v.variantId}: ${presentation(v.content ?? { kind: 'image', asset: v.asset })}`).join(', ') || 'base'}${component.stateOverrides?.length ? ` · state content ${component.stateOverrides.map(v => `${v.stateId}: ${presentation(v.content)}`).join(', ')}` : ''}` : 'Absent';
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
    previewPlaying: false, feedback: '', scene: null, currentScene: null, leafAssets: [], currentPreviewMessage: null, previewSide: 'proposed', frame: null, selection: { stateId: initial.proposal.content.assembly.defaultStateId, variantId: initial.proposal.content.assembly.defaultVariantId },
    load: 'idle', error: null, status: 'idle', intent: null };
  let disposed = false, generation = 0, readController = null, mutationController = null, playbackFrame = null;
  const artworks = new Map();
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
    const moreOpen = element.querySelector?.('[data-assembly-review-more]')?.open ?? false;
    const scroll = [...element.querySelectorAll('[data-assembly-review-scroll]')].map(n => [n.dataset.assemblyReviewScroll, n.scrollTop, n.scrollLeft]);
    element.dataset.assemblyProposal = state.proposal.proposalId;
    element.dataset.assemblyProposalVersion = String(state.proposal.proposalVersion);
    element.dataset.assemblyReviewStatus = state.status;
    const locked = state.status === 'saving' || state.status === 'uncertain';
    const statusText = { PENDING: 'Needs review', CHANGES_REQUESTED: 'Changes requested', ACCEPTED: 'Accepted', DISCARDED: 'Discarded' }[state.proposal.status];
    const header = node('header', '', 'assembly-review-header'), heading = node('div');
    heading.append(node('p', 'Assembly changes', 'assembly-review-eyebrow'), node('h3', state.proposal.content.name));
    header.append(heading, node('span', statusText, 'assembly-review-badge'));
    const changes = assemblyReviewChanges({ ...state.proposal, leafAssets: state.leafAssets }, state.currentAsset);
    const body = node('div', '', 'assembly-review-body'), visual = node('div', '', 'assembly-review-visual');
    const toolbar = node('div', '', 'assembly-review-toolbar'), sides = node('div', '', 'assembly-review-sides');
    sides.setAttribute('aria-label', 'Compare saved and proposed content');
    for (const [side, label] of [['current', 'Current'], ['proposed', 'Proposed']]) {
      const button = node('button', label); button.type = 'button'; button.dataset.assemblyReviewSide = side;
      button.dataset.assemblyReviewFocus = `side:${side}`; button.setAttribute('aria-pressed', String(state.previewSide === side)); button.disabled = locked; sides.append(button);
    }
    toolbar.append(sides, node('span', 'Same scale and position', 'assembly-review-caption'));
    const preview = node('div', '', 'assembly-review-preview'); preview.dataset.assemblyReviewPreview = state.previewSide;
    const scene = state.previewSide === 'proposed' ? state.scene : state.currentScene;
    if (scene && state.load === 'ready' && state.frame) {
      const frame = state.frame, svg = assemblySvg('svg', { viewBox: `${frame.x} ${frame.y} ${frame.width} ${frame.height}`, role: 'img', 'aria-label': `${state.proposal.content.name} — ${state.previewSide} composition` });
      svg.dataset.assemblyReviewCanvas = '';
      let artwork = artworks.get(state.previewSide); if (!artwork) { artwork = createAssemblyArtwork(null, { projectId: state.projectId }); artworks.set(state.previewSide, artwork); }
      updateAssemblyArtwork(artwork, scene, { projectId: state.projectId, playing: state.previewPlaying }); svg.append(artwork); preview.append(svg);
    } else {
      const message = state.load === 'loading' ? 'Loading exact saved images…' : state.previewSide === 'current'
        ? state.currentPreviewMessage ?? 'The current preview is unavailable. Recheck to retry.'
        : 'The proposed preview is unavailable. Recheck to retry.';
      preview.append(node('p', message, 'assembly-review-empty'));
    }
    const selectors = node('div', '', 'assembly-review-selectors');
    for (const [key, choices, id] of [['stateId', state.proposal.content.assembly.states, 'stateId'], ['variantId', state.proposal.content.assembly.variants, 'variantId']]) {
      const label = node('label'), select = node('select'); label.append(node('span', key === 'stateId' ? 'State preview' : 'Variant preview'));
      select.dataset.assemblyReviewSelection = key; select.dataset.assemblyReviewFocus = key;
      for (const choice of choices) { const option = node('option', choice.name); option.value = choice[id]; select.append(option); }
      select.value = state.selection[key]; select.disabled = locked; label.append(select); selectors.append(label);
    }
    const play = node('button', state.previewPlaying ? 'Pause animations' : 'Play animations', 'secondary'); play.type = 'button'; play.dataset.assemblyReviewAction = 'playback'; play.dataset.assemblyReviewFocus = 'playback'; const hasAnimation = [state.scene, state.currentScene].some(scene => scene?.elements.some(item => item.contentKind === 'animation')); if (hasAnimation) selectors.append(play);
    visual.append(toolbar, preview, selectors, node('p', hasAnimation ? `${state.previewPlaying ? 'Animation playback' : 'Animations paused'} · read-only preview. Saved content stays unchanged until acceptance.` : 'Preview only · saved content stays unchanged until acceptance.', 'assembly-review-caption'));
    const changePanel = node('aside', '', 'assembly-review-changes'); changePanel.dataset.assemblyReviewChanges = '';
    changePanel.append(node('p', state.proposal.content.operation === 'create' ? 'New Assembly' : 'What changes', 'assembly-review-eyebrow'), node('h4', changes.headline));
    const list = node('ul', '', 'assembly-review-change-list'); list.dataset.assemblyReviewScroll = 'changes';
    for (const change of changes.changes) {
      const repeatsHeadline = changes.changes.length === 1 && change.label === changes.headline;
      if (repeatsHeadline && !change.detail) continue;
      const item = node('li'); if (!repeatsHeadline) item.append(node('strong', change.label));
      if (change.detail) item.append(node('p', change.detail)); list.append(item);
    }
    changePanel.append(list);
    if (changes.unchanged.length) { const unchanged = node('div', '', 'assembly-review-unchanged'); for (const text of changes.unchanged) unchanged.append(node('p', text)); changePanel.append(unchanged); }
    body.append(visual, changePanel);
    const status = node('div', '', 'assembly-review-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const message = state.error ?? (state.status === 'done' ? 'Your decision is saved.' : conflict());
    status.dataset.error = String(Boolean(state.error || conflict()));
    status.append(node('p', message ?? (state.proposal.status === 'PENDING' ? 'Acceptance saves this complete Assembly update. Component source Assets stay unchanged.' : state.proposal.status === 'CHANGES_REQUESTED' ? 'Feedback is saved for the next agent round. No content was accepted.' : 'This review is complete.')));
    const nodes = [header, body, status];
    if (state.proposal.feedback) { const saved = node('div', '', 'assembly-review-saved-feedback'); saved.append(node('strong', 'Saved feedback'), node('p', state.proposal.feedback)); nodes.push(saved); }
    const button = (action, text, disabled = false) => { const control = node('button', text, action === 'ACCEPT' ? 'primary' : 'secondary'); control.type = 'button'; control.dataset.assemblyReviewAction = action; control.dataset.assemblyReviewFocus = action; control.disabled = disabled; return control; };
    if (state.proposal.status === 'PENDING' && state.status !== 'done') {
      const feedbackArea = node('div', '', 'assembly-review-feedback-area'), label = node('label'), feedback = node('textarea');
      label.append(node('span', 'Feedback to the agent')); feedback.rows = 3; feedback.maxLength = 2000; feedback.value = state.feedback;
      feedback.placeholder = 'Describe what should change and why.'; feedback.dataset.assemblyReviewFeedback = ''; feedback.dataset.assemblyReviewFocus = 'feedback'; feedback.disabled = locked || !host.canMutate(); label.append(feedback);
      feedbackArea.append(label, node('p', 'Required when requesting changes. The next agent can read your saved feedback.', 'assembly-review-caption')); nodes.push(feedbackArea);
      const actions = node('div', '', 'assembly-review-actions'), disabled = state.status === 'saving' || !host.canMutate();
      if (state.status === 'uncertain') actions.append(button('retry', 'Retry exact decision', disabled), button('check', 'Refresh saved outcome', disabled));
      else {
        const stale = Boolean(conflict()); actions.append(button('ACCEPT', 'Accept changes and save Assembly', disabled || stale || state.load !== 'ready'), button('REQUEST_CHANGES', 'Request changes', disabled || stale));
        const more = node('details', '', 'assembly-review-more'); more.dataset.assemblyReviewMore = ''; more.open = moreOpen;
        more.append(node('summary', 'More actions'), button('recheck', 'Recheck current proposal', disabled), button('DISCARD', 'Discard proposal', disabled || stale)); actions.append(more);
      }
      nodes.push(actions);
    }
    const details = node('details', '', 'assembly-review-technical'); details.dataset.assemblyReviewComparison = ''; details.open = comparisonOpen;
    details.append(node('summary', 'Technical details and full comparison'), node('p', `Proposal ${state.proposal.proposalId} · version ${state.proposal.proposalVersion} · target Asset ${state.proposal.content.expectedAssetVersion}/${state.proposal.content.expectedMetadataVersion}`, 'assembly-review-caption'));
    const tableScroll = node('div', '', 'assembly-review-table-scroll'), table = node('table', '', 'proposal-diff');
    tableScroll.dataset.assemblyReviewScroll = 'technical';
    const tableHeader = node('tr'); for (const label of ['Property / component', 'Current', 'Proposed']) tableHeader.append(node('th', label)); table.append(tableHeader);
    for (const row of assemblyProposalDiffRows(state.proposal, state.currentAsset)) { const tr = node('tr'); for (const value of row) tr.append(node('td', value)); table.append(tr); }
    tableScroll.append(table); details.append(tableScroll); nodes.push(details); element.replaceChildren(...nodes);
    for (const [key, top, left] of scroll) { const n = [...element.querySelectorAll('[data-assembly-review-scroll]')].find(n => n.dataset.assemblyReviewScroll === key); if (n) { n.scrollTop = top; n.scrollLeft = left; } }
    if (playbackFrame === null && element.isConnected && [state.scene, state.currentScene].some(scene => scene?.elements.some(item => item.contentKind === 'animation'))) playbackFrame = requestAnimationFrame(tickPlayback);
    if (focused && element.isConnected) { const control = [...element.querySelectorAll('[data-assembly-review-focus]')].find(item => item.dataset.assemblyReviewFocus === focused); control?.focus({ preventScroll: true }); if (selection) control?.setSelectionRange?.(selection.start, selection.end, selection.direction); }
  }
  async function loadPreview() {
    if (disposed || !host.canRead()) return;
    readController?.abort(); const controller = new AbortController(), own = ++generation; readController = controller;
    const revision = state.projectRevision, version = state.proposal.proposalVersion, selection = JSON.stringify(state.selection);
    const proposed = copy(state.proposal.content), saved = copy(state.currentAsset);
    const selected = copy(state.selection);
    const currentExists = Boolean(saved), currentHasSelection = currentExists && saved.assembly.states.some(s => s.stateId === selected.stateId) && saved.assembly.variants.some(v => v.variantId === selected.variantId);
    state.currentPreviewMessage = !currentExists ? proposed.operation === 'create' ? 'This Assembly is new. There is no saved Current version.' : 'The current Assembly is unavailable.' : !currentHasSelection ? 'This state or variant does not exist in the saved Current version.' : null;
    const timer = setTimeout(() => controller.abort(), 8000); state.load = 'loading'; state.scene = null; state.currentScene = null; state.leafAssets = []; state.frame = null; render();
    try {
      const [draft, previous] = await Promise.all([
        host.resolveDraft(proposed, selected, revision, { signal: controller.signal }),
        currentHasSelection ? host.resolveDraft(saved, selected, revision, { signal: controller.signal }) : Promise.resolve(null),
      ]);
      if (disposed || own !== generation || current().projectId !== state.projectId || current().projectRevision !== revision || state.proposal.proposalVersion !== version || JSON.stringify(state.selection) !== selection) return;
      if (!draft?.scene || (currentHasSelection && !previous?.scene)) throw new Error('An exact comparison preview is unavailable. Recheck to retry.');
      state.scene = draft.scene; state.currentScene = previous?.scene ?? null;
      state.leafAssets = [...(previous?.leafAssets ?? []), ...(draft.leafAssets ?? [])];
      // Fit both sides to the same visible artwork extent. Invisible placement
      // space must not shrink the artwork; empty scenes retain a safe fallback.
      const frames = [draft.scene.visualBounds, previous?.scene?.visualBounds].filter(f => f && f.width > 0 && f.height > 0);
      if (!frames.length) frames.push(assemblySceneFrame(draft.scene, proposed.assembly));
      const x = Math.min(...frames.map(f => f.x)), y = Math.min(...frames.map(f => f.y));
      const width = Math.max(...frames.map(f => f.x + f.width)) - x, height = Math.max(...frames.map(f => f.y + f.height)) - y, pad = Math.max(width, height) * .08;
      state.frame = { x: x - pad, y: y - pad, width: width + 2 * pad, height: height + 2 * pad };
      state.load = 'ready'; state.error = null;
    } catch (error) { if (!disposed && own === generation) { state.load = 'failed'; state.scene = null; state.currentScene = null; state.error = error.message; } }
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
  element.addEventListener('click', event => { const side = event.target.closest('[data-assembly-review-side]');
    if (side && !side.disabled && ['current', 'proposed'].includes(side.dataset.assemblyReviewSide)) { state.previewSide = side.dataset.assemblyReviewSide; render(); return; }
    const action = event.target.closest('[data-assembly-review-action]'); if (!action || action.disabled) return;
    const key = action.dataset.assemblyReviewAction; if (key === 'playback') { state.previewPlaying = !state.previewPlaying; render(); } else if (key === 'retry') void decide(null, true); else if (key === 'recheck' || key === 'check') void recheck(key === 'check'); else void decide(key); });
  function tickPlayback(now) {
    playbackFrame = null; if (disposed) return;
    for (const [side, artwork] of artworks) { const scene = side === 'current' ? state.currentScene : state.scene;
      if (scene) updateAssemblyArtwork(artwork, scene, { projectId: state.projectId, playing: state.previewPlaying && element.isConnected && state.load === 'ready', now });
    }
    if (element.isConnected && state.previewPlaying && [state.scene, state.currentScene].some(scene => scene?.elements.some(item => item.contentKind === 'animation'))) playbackFrame = requestAnimationFrame(tickPlayback);
  }
  render();
  return { element, getState: () => state, afterMount() { if (state.load === 'idle') void loadPreview(); else render(); }, reconcileContext() {
    const context = current();
    if (state.status === 'done' && context.projectId === state.projectId && context.proposal && context.proposal.status !== 'PENDING') {
      state.proposal = copy(context.proposal); state.currentAsset = copy(context.asset ?? null); state.projectRevision = context.projectRevision;
    }
    render();
  },
    requestLeave() { if (['saving', 'uncertain'].includes(state.status)) { host.announce('Resolve the pending Assembly review request before leaving.'); return false; } return true; },
    dispose() { disposed = true; if (playbackFrame !== null) cancelAnimationFrame(playbackFrame); generation += 1; readController?.abort(); mutationController?.abort(); } };
}
