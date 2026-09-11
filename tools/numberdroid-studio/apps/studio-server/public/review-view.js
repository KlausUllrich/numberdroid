import { libraryElement as el, libraryPreviewDescriptor } from './library-detail-view.js';
import { assemblySvg, createAssemblyArtwork, updateAssemblyArtwork } from './assembly-artwork-view.js';
import { clipFrameAtTime } from '../../../packages/domain/src/clip-playback.js';

const names = { image: 'Image', animation: 'Animation', assembly: 'Assembly' };
const playbackByState = new WeakMap();
const itemName = item => item?.proposed?.name ?? item?.proposedRecord?.name ?? item?.payload?.name ?? item?.current?.name ?? 'Unnamed content';
const remaining = group => (group?.items ?? []).filter(item => item.status === 'PENDING');
const comments = feedback => Array.isArray(feedback?.itemComments) ? feedback.itemComments : [];
const messageText = value => typeof value === 'string' ? value : value?.message ?? '';
const join = values => values.filter(value => value !== null && value !== undefined && value !== '').join(' · ');

export function reviewStatusLabel(group) {
  if (group?.status === 'CHANGES_REQUESTED') return group.nextActor?.kind === 'agent' || group.proposer?.actor?.kind === 'agent' ? 'Awaiting agent' : 'Changes requested';
  return { PENDING: 'Needs review', ACCEPTED: 'Accepted', DISCARDED: 'Discarded' }[group?.status] ?? 'Review unavailable';
}

/** This is the service's selected acceptance result, never a reconstruction of prospective saved content. */
export function reviewPreviewRecord(state, side = state.side) {
  const item = state.group?.items?.find(value => value.itemId === state.activeItemId) ?? state.group?.items?.[0];
  if (!item) return { item: null, record: null, message: 'No content is available in this review.' };
  if (side === 'current') return { item, record: item.resolvedCurrent ?? null, message: item.current ? 'The exact current preview is unavailable.' : 'No current content. This change creates it.' };
  const outcome = state.group.selectionOutcome;
  if (outcome?.state !== 'READY') return { item, record: null, message: 'The selected result is unavailable. Check the selection and its dependencies.' };
  if (JSON.stringify([...(outcome.selectedItemIds ?? [])].sort()) !== JSON.stringify([...(state.selectedItemIds ?? [])].sort())) return { item, record: null, message: 'Checking the selected result…' };
  const entry = outcome.items.find(value => value.itemId === item.itemId);
  return { item, record: entry?.resolved ?? null, message: entry?.record ? 'The exact selected preview is unavailable.' : 'This creation is not selected. It contributes nothing to the selected result.' };
}

function summaryFor(item) {
  const record = item.proposed ?? item.proposedRecord ?? item.payload, current = item.current;
  if (!current) return `Add ${names[item.contentKind]?.toLowerCase() ?? 'content'} to the Library.`;
  const changes = [];
  if (current.name !== record.name) changes.push('Name');
  if (JSON.stringify(current.metadata) !== JSON.stringify(record.metadata)) changes.push('descriptive properties');
  if (item.contentKind === 'image' && JSON.stringify(current.sliceBinding) !== JSON.stringify(record.sliceBinding)) changes.push('image source');
  if (item.contentKind === 'animation' && JSON.stringify(current.clip) !== JSON.stringify(record.clip)) changes.push('animation frames or playback');
  if (item.contentKind === 'assembly' && JSON.stringify(current.assembly) !== JSON.stringify(record.assembly)) changes.push('components or geometry');
  return changes.length ? `Update ${changes.join(', ')}.` : 'Save the proposed content version.';
}

function feedbackBlock(feedback, group, className = 'review-saved-feedback') {
  const box = el('section', className);
  box.append(el('small', 'review-meta', join(['Saved feedback', feedback?.createdAt ? new Date(feedback.createdAt).toLocaleString() : null, feedback?.reviewVersion ? `Review ${feedback.reviewVersion}` : null])));
  box.append(el('p', 'review-feedback-text', feedback?.summary ?? ''));
  for (const comment of comments(feedback)) {
    const row = el('div', 'review-saved-comment');
    row.append(el('strong', '', itemName(group.items.find(item => item.itemId === comment.itemId))), el('p', 'review-feedback-text', comment.text)); box.append(row);
  }
  return box;
}

export function renderReviewView({ state, view = {}, onAction = () => {}, onInput = () => {}, onSelection = () => {}, onDetails = () => {} }) {
  const root = el('section', 'review-workspace'); root.dataset.reviewWorkspace = ''; root.dataset.reviewId = state.group?.reviewId ?? ''; root.dataset.reviewVersion = String(state.group?.reviewVersion ?? '');
  const group = state.group, items = group?.items ?? [], pending = remaining(group), terminal = group && !['PENDING', 'CHANGES_REQUESTED'].includes(group.status);
  const playbackKey = JSON.stringify([group?.contentVersion, state.activeItemId, state.side, state.selection]);
  let playback = playbackByState.get(state);
  if (!playback || playback.key !== playbackKey) { playback = { key: playbackKey, playing: false, elapsedMs: 0 }; playbackByState.set(state, playback); }
  let disposed = false, raf = null, playing = playback.playing, last = null, elapsedMs = playback.elapsedMs;
  root.dispose = () => { disposed = true; playback.playing = playing; playback.elapsedMs = elapsedMs; if (raf !== null) cancelAnimationFrame(raf); raf = null; };
  const button = (action, text, disabled = false, payload, className = 'secondary') => {
    const node = el('button', className, text); node.type = 'button'; node.disabled = disabled; node.dataset.reviewAction = action; node.dataset.reviewFocus = `${action}${payload?.itemId ? `:${payload.itemId}` : typeof payload === 'string' ? `:${payload}` : ''}`;
    node.addEventListener('click', () => { if (!node.disabled) onAction(action, payload); }); return node;
  };
  const disclose = (id, title) => { const node = el('details', 'review-disclosure'); node.dataset.reviewDisclosure = id; const label = el('summary', '', title); label.dataset.reviewFocus = `disclosure:${id}`; node.append(label); return node; };
  const header = el('header', 'review-header'), title = el('div');
  title.append(el('p', 'review-eyebrow', state.readOnly ? 'Recorded review · read-only' : 'Review changes'), el('h2', '', group?.title ?? 'Loading review…'), el('p', 'review-meta', 'Compare the selected result, then decide what to keep.'));
  const headingActions = el('div', 'review-heading-actions'), badge = el('span', `review-badge${group?.status === 'CHANGES_REQUESTED' ? ' awaiting' : ''}`, reviewStatusLabel(group)); badge.dataset.reviewStatus = group?.status ?? 'loading'; headingActions.append(badge);
  if (group && !terminal && !state.readOnly) { const more = disclose('more', 'More actions'); more.classList.add('review-more'); more.append(button('discard', 'Discard remaining proposal', !view.canDiscard)); headingActions.append(more); }
  header.append(title, headingActions); root.append(header);
  if (!group) { root.append(el('p', 'review-message', messageText(state.error) || 'Loading exact saved review…')); return root; }
  const intent = el('section', 'review-intent'); intent.append(el('div', '', `${pending.length} remaining ${pending.length === 1 ? 'change' : 'changes'} · ${items.filter(item => item.status === 'ACCEPTED').length} already accepted`), el('small', 'review-meta', group.legacySource ? 'Existing proposal · opening this review saves nothing.' : 'Saved content stays unchanged until acceptance.')); root.append(intent);
  const layout = el('div', 'review-layout'), visual = el('div', 'review-visual'), toolbar = el('div', 'review-toolbar'), sides = el('div', 'review-sides');
  for (const side of ['current', 'proposed']) { const b = button('side', side === 'current' ? 'Current' : 'Proposed', false, side); b.setAttribute('aria-pressed', String(state.side === side)); sides.append(b); } toolbar.append(sides);
  const selection = reviewPreviewRecord(state), active = selection.item, fullRecord = active?.resolvedProposed ?? active?.resolvedCurrent, assembly = fullRecord?.assembly;
  if (assembly) { const controls = el('div', 'review-presentations'); for (const [key, label, choices, fallback] of [['stateId', 'State', assembly.states, assembly.defaultStateId], ['variantId', 'Variant', assembly.variants, assembly.defaultVariantId]]) {
    if (!choices?.length) continue; const field = el('label', '', label), select = el('select'); select.dataset.reviewFocus = key; select.dataset.reviewPresentation = key;
    for (const choice of choices) { const option = el('option', '', choice.name); option.value = choice[key]; option.selected = (state.selection?.[key] ?? fallback) === choice[key]; select.append(option); }
    select.addEventListener('change', () => onAction('presentation', { ...state.selection, [key]: select.value })); field.append(select); controls.append(field);
  } toolbar.append(controls); }
  const canvas = el('div', 'review-canvas'); canvas.dataset.reviewCanvas = ''; canvas.dataset.reviewPreviewSide = state.side; canvas.dataset.reviewPreviewItem = active?.itemId ?? '';
  visual.append(toolbar, canvas);
  const caption = el('div', 'review-caption'), highlightLabel = el('label', 'review-highlight-toggle'), highlight = el('input');
  highlight.type = 'checkbox'; highlight.checked = state.highlight !== false; highlight.dataset.reviewFocus = 'highlight'; highlight.dataset.reviewHighlight = ''; highlight.addEventListener('change', () => onAction('highlight', highlight.checked));
  highlightLabel.append(highlight, el('span', '', 'Highlight changes')); caption.append(highlightLabel, el('span', '', 'Presentation only · no game behavior')); visual.append(caption);
  const previewDetails = el('div', 'review-preview-details');
  for (const side of ['current', 'proposed']) { const control = el('button', 'secondary', `Inspect ${side} →`); control.type = 'button'; control.dataset.reviewFocus = `preview-details:${side}`; control.dataset.reviewDetails = side; control.dataset.reviewItemId = active?.itemId ?? ''; control.disabled = view.canInspect === false || !(side === 'current' ? active?.current : active?.proposed ?? active?.proposedRecord); control.addEventListener('click', () => { if (!control.disabled) onDetails({itemId:active.itemId,side}); }); previewDetails.append(control); }
  visual.append(previewDetails);
  let draw = () => {};
  if (!selection.record) canvas.append(el('p', 'review-preview-empty', selection.message));
  else try {
    const record = selection.record, descriptor = libraryPreviewDescriptor({ entry: { contentKind: active.contentKind }, record, projectId: state.projectId, proposed: true });
    // Both sides use the same frame so switching does not masquerade as a size change.
    const frames = [descriptor.bounds];
    for (const resolved of [active.resolvedCurrent, active.resolvedProposed]) if (resolved) try { frames.push(libraryPreviewDescriptor({ entry: { contentKind: active.contentKind }, record: resolved, projectId: state.projectId, proposed: true }).bounds); } catch { /* The selected exact preview still remains valid. */ }
    const x = Math.min(...frames.map(b => b.x)), y = Math.min(...frames.map(b => b.y)), width = Math.max(...frames.map(b => b.x + b.width)) - x, height = Math.max(...frames.map(b => b.y + b.height)) - y;
    const svg = assemblySvg('svg', { viewBox: `${x} ${y} ${width} ${height}`, preserveAspectRatio: 'xMidYMid meet', role: 'img', 'aria-label': `${record.name} — ${state.side === 'current' ? 'current content' : 'selected result'}` }); canvas.append(svg); canvas.dataset.reviewPreviewState = 'ready';
    if (active.contentKind === 'assembly') { const artwork = createAssemblyArtwork(record.scene, { projectId: state.projectId, playing, now: 0 }); svg.append(artwork); draw = () => updateAssemblyArtwork(artwork, record.scene, { projectId: state.projectId, playing, now: elapsedMs }); draw(); }
    else if (active.contentKind === 'animation') {
      const image = assemblySvg('image', { preserveAspectRatio: 'none' }); svg.append(image);
      draw = () => { const frame = record.clip.frames[clipFrameAtTime(record.clip, elapsedMs).frameIndex], binding = record.frameBindings.find(value => value.frameId === frame.frameId)?.sliceBinding;
        if (!binding || binding.projectId !== state.projectId || binding.sliceId !== frame.slice.sliceId || binding.sliceVersion !== frame.slice.sliceVersion || !/^[a-f0-9]{64}$/.test(binding.digest)) throw new Error('An exact Animation frame is unavailable.');
        for (const [key, value] of Object.entries({ href: `/api/projects/${encodeURIComponent(state.projectId)}/artifacts/sha256/${binding.digest}`, x: frame.offset.x, y: frame.offset.y, width: binding.width, height: binding.height })) image.setAttribute(key, value); svg.dataset.reviewFrame = frame.frameId; }; draw();
    } else for (const image of descriptor.images) { const { matrix, ...attrs } = image; svg.append(assemblySvg('image', { ...attrs, preserveAspectRatio: 'none', ...(matrix ? { transform: `matrix(${matrix.join(' ')})` } : {}) })); }
    if (state.highlight !== false && active.status === 'PENDING') {
      const before = active.current, after = active.proposed ?? active.proposedRecord;
      if (active.contentKind === 'assembly' && before?.assembly) {
        const beforeComponents = new Map(before.assembly.components.map(component => [component.componentId, component]));
        const afterComponents = new Map(after.assembly.components.map(component => [component.componentId, component]));
        for (const node of svg.querySelectorAll('g')) if (node.dataset.assemblyComponent && JSON.stringify(beforeComponents.get(node.dataset.assemblyComponent)) !== JSON.stringify(afterComponents.get(node.dataset.assemblyComponent))) {
          const region = node.querySelector?.('rect'); if (region) { region.setAttribute('stroke', '#efcc83'); region.setAttribute('stroke-width', '2'); region.setAttribute('vector-effect', 'non-scaling-stroke'); region.setAttribute('stroke-dasharray', '5 3'); }
        }
      } else if (!before || JSON.stringify(before.sliceBinding ?? before.clip) !== JSON.stringify(after?.sliceBinding ?? after?.clip)) svg.append(assemblySvg('rect', { x:descriptor.bounds.x, y:descriptor.bounds.y, width:descriptor.bounds.width, height:descriptor.bounds.height, fill:'none', stroke:'#efcc83', 'stroke-width':2, 'vector-effect':'non-scaling-stroke', 'stroke-dasharray':'5 3', 'pointer-events':'none' }));
    }
    for (const image of svg.querySelectorAll('image')) image.addEventListener('error', () => { root.dispose(); canvas.dataset.reviewPreviewState = 'unavailable'; canvas.replaceChildren(el('p', 'review-preview-empty', 'The exact source image could not be loaded. Recheck this review to retry.')); }, { once: true });
    if (active.contentKind === 'animation' || record.scene?.elements?.some(item => item.contentKind === 'animation')) {
      const play = el('button', 'secondary', playing ? 'Pause preview' : 'Play preview'); play.type = 'button'; play.dataset.reviewFocus = 'play'; play.dataset.reviewPlay = ''; caption.prepend(play);
      const tick = now => { raf = null; if (disposed || !playing || !root.isConnected) { playback.playing = playing; playback.elapsedMs = elapsedMs; last = null; return; } if (last !== null) elapsedMs += Math.max(0, now - last); last = now; draw(now); raf = requestAnimationFrame(tick); };
      if (playing) { draw(performance.now()); raf = requestAnimationFrame(tick); }
      play.addEventListener('click', () => { playing = !playing; last = null; play.textContent = playing ? 'Pause preview' : 'Play preview'; draw(performance.now()); if (playing && raf === null) raf = requestAnimationFrame(tick); else if (!playing && raf !== null) { cancelAnimationFrame(raf); raf = null; } });
    }
  } catch (error) { canvas.dataset.reviewPreviewState = 'unavailable'; canvas.replaceChildren(el('p', 'review-preview-empty', error.message)); }
  const panel = el('aside', 'review-panel'); panel.dataset.reviewScroll = 'panel';
  const notice = el('div', `review-message${state.error || view.stale ? ' warning' : ''}`); notice.dataset.reviewMessage = ''; notice.setAttribute('role', 'status'); notice.dataset.reviewScroll = 'message';
  notice.append(el('p', '', messageText(state.error) || messageText(view.message) || (state.readOnly ? 'This recorded review is read-only. Its feedback and decisions cannot be rewritten.' : state.feedback?.editing ? 'Save or cancel this feedback draft before acceptance. Saving feedback accepts no content.' : group.status === 'CHANGES_REQUESTED' ? 'Your feedback is saved. No agent was started. You may edit the feedback or accept this unchanged, valid proposal.' : 'Select changes to accept. Other changes remain available.')));
  if (view.canAdoptLatest || view.stale) notice.append(button('review-latest', view.stale === 'content' ? 'Review latest version →' : 'Review latest saved decision →', !view.canAdoptLatest));
  panel.append(notice);
  const feedback = state.feedback ?? {};
  if (feedback.editing) {
    panel.append(el('h3', '', group.feedback ? 'Edit saved feedback' : 'Request changes'), el('p', 'review-meta', 'Draft · only saved feedback is shared with the agent.'));
    const label = el('label', 'review-field', 'Feedback summary'), input = el('textarea', 'review-feedback-main'); input.rows = 4; input.maxLength = 4000; input.value = feedback.draftSummary ?? ''; input.dataset.reviewFocus = 'summary'; input.dataset.reviewInput = 'summary'; input.disabled = Boolean(view.locked);
    input.addEventListener('input', () => onInput('summary', input.value)); label.append(input); panel.append(label);
    const error = el('p', 'review-feedback-error', (view.feedbackErrors ?? []).map(messageText).join(' ')); error.setAttribute('role', 'status'); panel.append(error);
    for (const item of pending) { const disclosure = disclose(`comment:${item.itemId}`, `Comment on ${itemName(item)}`), textarea = el('textarea'); textarea.rows = 3; textarea.maxLength = 2000; textarea.value = feedback.draftItemComments?.[item.itemId] ?? ''; textarea.dataset.reviewFocus = `comment:${item.itemId}`; textarea.dataset.reviewItemComment = item.itemId; textarea.disabled = Boolean(view.locked); textarea.setAttribute('aria-label', `Comment on ${itemName(item)}`); textarea.addEventListener('input', () => onInput('comment', textarea.value, item.itemId)); disclosure.append(textarea); panel.append(disclosure); }
  } else {
    panel.append(el('h3', '', 'Changes to review'));
    for (const item of items) {
      const row = el('article', `review-choice${item.itemId === active?.itemId ? ' active' : ''}`); row.dataset.reviewItem = item.itemId;
      const top = el('div', 'review-choice-top'), checkbox = el('input'); checkbox.type = 'checkbox'; checkbox.checked = item.status === 'ACCEPTED' || (state.selectedItemIds ?? []).includes(item.itemId); checkbox.disabled = item.status !== 'PENDING' || Boolean(view.locked) || state.readOnly; checkbox.dataset.reviewFocus = `select:${item.itemId}`; checkbox.dataset.reviewSelect = item.itemId; checkbox.setAttribute('aria-label', `Include ${itemName(item)}`); checkbox.addEventListener('change', () => onSelection(item.itemId, checkbox.checked));
      const content = el('div'), focus = button('item', itemName(item), false, item.itemId, 'review-item-name'); focus.setAttribute('aria-pressed', String(item.itemId === active?.itemId)); content.append(focus, el('small', 'review-meta', join([names[item.contentKind], item.status === 'ACCEPTED' ? 'Already accepted' : item.status === 'DISCARDED' ? 'Discarded' : item.payload?.operation === 'create' ? 'New' : 'Update']))); top.append(checkbox, content); row.append(top, el('p', 'review-change-summary', summaryFor(item)));
      for (const dependency of item.dependsOn ?? []) { const target = items.find(value => value.itemId === dependency); row.append(el('p', 'review-dependency', `Needs ${itemName(target)}${target?.status === 'ACCEPTED' ? ' · already accepted' : (state.selectedItemIds ?? []).includes(dependency) ? ' · selected' : ' · select this too, or accept it first'}`)); }
      for (const finding of item.conflicts ?? []) row.append(el('p', 'review-finding', finding.message));
      const inspect = el('div', 'review-item-actions'); for (const side of ['current', 'proposed']) { const b = el('button', 'secondary', `${side === 'current' ? 'Current' : 'Proposed'} details →`); b.type = 'button'; b.disabled = view.canInspect === false || !(side === 'current' ? item.current : item.proposed ?? item.proposedRecord); b.dataset.reviewFocus = `details:${item.itemId}:${side}`; b.dataset.reviewDetails = side; b.dataset.reviewItemId = item.itemId; b.addEventListener('click', () => { if (!b.disabled) onDetails({ itemId: item.itemId, side }); }); inspect.append(b); } row.append(inspect); panel.append(row);
    }
    if (group.feedback) { const saved = feedbackBlock(group.feedback, group); if (!terminal && !state.readOnly) saved.append(button('edit-feedback', 'Edit feedback', !view.canEditFeedback)); panel.append(saved); }
  }
  if (feedback.olderDraft) { const old = feedback.olderDraft, retained = disclose('older-draft', 'Retained feedback from an older version'); retained.classList.add('review-older-draft'); retained.append(el('p', 'review-meta', `Not sent · Content ${old.contentVersion ?? '?'} · Review ${old.reviewVersion ?? '?'}`), el('p', 'review-feedback-text', old.summary)); for (const [id, text] of Object.entries(old.itemComments ?? {})) if (text) retained.append(el('p', 'review-feedback-text', `${itemName(items.find(item => item.itemId === id))}: ${text}`)); retained.append(button('copy-older-draft', 'Use as a new feedback draft', !view.canEditFeedback)); panel.append(retained); }
  if (group.history?.length) { const history = disclose('history', 'Saved feedback and decisions'); for (const version of [...group.history].reverse()) { const row = el('section', 'review-history-entry'); row.append(el('strong', '', join([`Review ${version.reviewVersion}`, { PENDING: 'Submitted for review', CHANGES_REQUESTED: 'Changes requested', ACCEPTED: 'Accepted', DISCARDED: 'Discarded' }[version.status]])), el('small', 'review-meta', new Date(version.createdAt).toLocaleString())); if (version.feedback && version.feedback.reviewVersion === version.reviewVersion) row.append(feedbackBlock(version.feedback, group)); if (version.decision?.action === 'ACCEPT') row.append(el('p', 'review-meta', `${version.decision.accepted?.length ?? 0} changes accepted · ${version.decision.remainingItemIds?.length ?? 0} remaining`)); history.append(row); } panel.append(history); }
  layout.append(visual, panel); root.append(layout);
  const footer = el('footer', 'review-footer'), consequence = el('div');
  consequence.append(el('p', '', state.readOnly ? 'Recorded event · inspection only. Open the current review separately to continue outstanding work.' : terminal ? 'This review is complete. Saved decisions and previously accepted content are preserved.' : feedback.editing ? 'Saving feedback accepts no content. The next agent round can read it; this action does not start an agent.' : 'Acceptance saves only the selected valid changes. Other saved uses keep their pinned versions.'), el('small', 'review-meta', join([group.proposer?.actor?.displayName ?? group.proposer?.actor?.id, group.proposer?.taskId, `Content ${group.contentVersion ?? 1}`, group.reviewVersion ? `Review ${group.reviewVersion}` : 'Existing proposal'])));
  const actions = el('div', 'review-actions');
  if (state.phase === 'uncertain') actions.append(button('check', 'Check saved outcome', false), button('retry', 'Retry exact request', !state.canMutate, undefined, 'primary'));
  else if (!terminal && !state.readOnly) {
    if (feedback.editing) actions.append(button('cancel-feedback', 'Cancel edit', Boolean(view.locked)), button('save-feedback', group.feedback ? 'Save updated feedback' : 'Request changes', !view.canFeedback, undefined, 'primary'));
    else actions.append(button(group.feedback ? 'edit-feedback' : 'request-changes', group.feedback ? 'Edit feedback' : 'Request changes', !view.canEditFeedback), button('accept', 'Accept selected changes', !view.canAccept, undefined, 'primary'));
  }
  if (!['saving', 'uncertain'].includes(state.phase)) actions.append(button('recheck', 'Recheck', false));
  footer.append(consequence, actions); root.append(footer);
  if (state.receipt?.value || state.receipt?.result) { const receipt = state.receipt.value ?? state.receipt.result, result = el('section', 'review-receipt'); result.dataset.reviewReceipt = ''; result.append(el('h3', '', receipt.status === 'DISCARDED' ? 'Remaining proposal discarded' : receipt.accepted?.length ? 'Selected changes saved' : 'Feedback saved'), el('p', '', `${receipt.accepted?.length ?? 0} changes accepted · ${receipt.remainingItemIds?.length ?? 0} remaining. Previously accepted content is preserved.`)); root.append(result); }
  return root;
}
