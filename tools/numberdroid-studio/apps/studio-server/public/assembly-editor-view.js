import { assemblyEditorDirty, assemblyEditorIssues, selectedAssemblyComponent, assemblyEditorPreviewPin } from './assembly-editor-state.js';
import { assemblyAssetKey, assemblySelectedContent } from '../../../packages/domain/src/assembly-geometry.js';
import { assemblySvg as svg, createAssemblyArtwork, updateAssemblyArtwork, assemblyRegionNode, assemblySceneFrame, assemblyArtifactUrl } from './assembly-artwork-view.js';

const el = (tag, cls, value) => { const node = document.createElement(tag); if (cls) node.className = cls; if (value !== undefined) node.textContent = value; return node; };
const button = (text, action, value = '') => { const n = el('button', 'secondary', text); n.type = 'button'; n.dataset.assemblyAction = action; n.dataset.value = value; n.dataset.assemblyFocusKey = `${action}:${value}`; return n; };
const label = (caption, input) => { const n = el('label', 'assembly-field'); n.append(el('span', '', caption), input); return n; };
function field(key, value, caption, { type = 'text', row = '' } = {}) { const n = el('input'); n.type = type; if (type === 'number') n.step = 'any'; else n.maxLength = key === 'tags' ? 1000 : 160;
  n.value = String(value ?? ''); n.dataset.assemblyField = key; n.dataset.row = row; n.dataset.assemblyFocusKey = `field:${key}:${row}`; return label(caption, n); }
function choice(key, value, caption, options) { const n = el('select'); n.dataset.assemblyField = key; n.dataset.assemblyFocusKey = `field:${key}:`;
  for (const [id, name] of options) { const o = el('option', '', name); o.value = id; n.append(o); } n.value = value; return label(caption, n); }
function checkbox(key, checked, caption, value = '') { const n = el('input'); n.type = 'checkbox'; n.checked = checked; n.dataset.assemblyOption = key; n.dataset.value = value; n.dataset.assemblyFocusKey = `option:${key}:${value}`; return label(caption, n); }
const note = text => el('p', 'assembly-note', text);
const number = (key, value, caption) => field(key, value, caption, { type: 'number' });

export function createAssemblyEditorView(state) {
  const root = el('section', 'assembly-editor'); root.dataset.assemblyEditor = state.instanceId;
  const header = el('header', 'assembly-header'), heading = el('div'); heading.append(el('p', 'eyebrow', 'Library / Assembly'));
  const title = el('h2'); title.dataset.assemblyTitle = ''; heading.append(title, note('One reusable object, made from exact saved components.'));
  header.append(heading, button('Back to Library', 'back')); root.append(header);
  const status = el('div', 'assembly-status'); status.dataset.assemblyStatus = ''; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); root.append(status);
  const recovery = el('div', 'assembly-recovery'); recovery.dataset.assemblyRecovery = ''; root.append(recovery);
  const edit = el('section'); edit.dataset.assemblyView = 'edit';
  const preview = el('div', 'assembly-preview-selectors'); preview.dataset.assemblySelectors = ''; edit.append(preview);
  const layout = el('div', 'assembly-layout'), rail = el('nav', 'assembly-tools'); rail.setAttribute('aria-label', 'Assembly tools');
  for (const [action, title] of [['select-tool', 'Select'], ['add', '+ Add'], ['rotate', 'Rotate 90°'], ['forward', 'Forward'], ['backward', 'Back'], ['remove', 'Remove'], ['grid', 'Grid'], ['undo', 'Undo'], ['redo', 'Redo'], ['save', 'Save work']]) rail.append(button(title, action));
  const main = el('div', 'assembly-main'), zoom = el('div', 'assembly-zoom'); zoom.append(button('Fit', 'zoom', 'fit'), button('100%', 'zoom', '1'));
  const slider = el('input'); slider.type = 'range'; slider.min = '10'; slider.max = '400'; slider.step = '1'; slider.dataset.assemblyZoom = ''; slider.dataset.assemblyFocusKey = 'zoom'; slider.setAttribute('aria-label', 'Assembly canvas zoom percent');
  const output = el('output'); output.dataset.assemblyZoomLabel = ''; zoom.append(slider, output); main.append(zoom);
  const scroll = el('div', 'assembly-canvas-scroll'); scroll.dataset.assemblyScroll = 'canvas'; const stage = el('div', 'assembly-stage');
  const canvas = svg('svg', { tabindex: 0, role: 'group', 'aria-label': 'Assembly components, inherited or custom blocking, placement bounds and anchor' }); canvas.dataset.assemblyCanvas = ''; canvas.dataset.assemblyFocusKey = 'canvas';
  const grid = svg('g'); grid.dataset.assemblyLayer = 'grid'; canvas.append(grid, createAssemblyArtwork(null, { projectId: state.context.projectId }));
  for (const name of ['blocking', 'placement', 'selection']) { const group = svg('g'); group.dataset.assemblyLayer = name; canvas.append(group); }
  const caption = el('div', 'assembly-canvas-caption'), blockingVisibility = checkbox('show-blocking', state.showBlocking, 'Show blocking');
  blockingVisibility.classList.add('assembly-blocking-visibility');
  caption.append(blockingVisibility, note('Amber: blocking · blue: placement bounds · cyan: anchor. Preview does not run game behavior.'));
  stage.append(canvas); scroll.append(stage); main.append(scroll, caption);
  const inspector = el('aside', 'assembly-inspector'); inspector.dataset.assemblyScroll = 'inspector'; layout.append(rail, main, inspector); edit.append(layout); root.append(edit);
  const source = el('section', 'assembly-source'); source.dataset.assemblyView = 'source'; root.append(source);
  const picker = el('section', 'assembly-popup assembly-picker'); picker.dataset.assemblyPicker = ''; picker.setAttribute('role', 'dialog'); picker.setAttribute('aria-label', 'Choose a saved component Asset'); root.append(picker);
  const gridPopup = el('section', 'assembly-popup assembly-grid-popup'); gridPopup.dataset.assemblyGridPopup = ''; gridPopup.setAttribute('role', 'dialog'); gridPopup.setAttribute('aria-label', 'Assembly grid');
  gridPopup.append(el('h3', '', 'Grid & view'), button('Close', 'close-grid'), checkbox('grid.show', state.grid.show, 'Show grid guides'), checkbox('grid.snap', state.grid.snap, 'Snap component movement'), number('grid.step', state.grid.step, 'Grid spacing (assembly px)'), note('Alt bypasses snapping. Grid settings do not change saved content.')); root.append(gridPopup);
  const footer = el('footer', 'assembly-footer'); const saved = el('span'); saved.dataset.assemblySavedState = ''; footer.append(saved, button('Save Assembly', 'save')); root.append(footer); return root;
}

function inspectorContent(state, nativeAssets) {
  const box = el('div'), a = state.model.assembly;
  const tabs = el('nav', 'assembly-panel-tabs'); for (const [key, name] of [['component', 'Components'], ['blocking', 'Blocking'], ['presentation', 'States'], ['properties', 'Properties']]) { const b = button(name, 'panel', key); b.setAttribute('aria-pressed', String(state.panel === key)); tabs.append(b); } box.append(tabs);
  if (state.panel === 'properties') {
    box.append(field('name', state.model.name, 'Assembly name'), choice('kind', state.model.kind, 'Use', [['prop', 'Prop'], ['surface', 'Surface'], ['item', 'Item']]), field('role', state.model.metadata.role, 'Role (optional)'), field('tags', state.model.metadata.tags.join(', '), 'Tags (comma separated)'));
    box.append(el('h3', '', 'Placement bounds'), note('Bounds set placement space. Changing them leaves artwork and blocking fixed.'));
    const bounds = el('div', 'assembly-coordinates'); for (const [key, caption] of [['x', 'Left'], ['y', 'Top'], ['width', 'Width'], ['height', 'Height']]) bounds.append(number(`bounds.${key}`, a.placementBounds[key], `${caption} (px)`)); box.append(bounds);
    const anchor = el('div', 'assembly-coordinates'); anchor.append(number('anchor.x', a.anchor.x, 'Anchor X (px)'), number('anchor.y', a.anchor.y, 'Anchor Y (px)')); box.append(el('h3', '', 'Assembly anchor'), anchor, number('unitsPerPixel', a.unitsPerPixel, 'Project units per assembly pixel'));
    box.append(note('This Assembly can be saved and inspected in the Library. Room placement and runtime export are not supported in this version.')); return box;
  }
  if (state.panel === 'presentation') {
    box.append(el('h3', '', 'Presentation states'), note('Membership is authored below. The selectors above the canvas only preview it.'));
    for (const [kind, rows, key, defaultKey] of [['state', a.states, 'stateId', 'defaultStateId'], ['variant', a.variants, 'variantId', 'defaultVariantId']]) {
      if (kind === 'variant') box.append(el('h3', '', 'Cosmetic variants'), note('Each component may explicitly use another saved Asset for a variant.'));
      for (const row of rows) { const entry = el('div', 'assembly-catalog-row'); entry.append(field(`${kind}-name`, row.name, kind === 'state' ? 'State name' : 'Variant name', { row: row[key] }));
        const actions = el('div', 'assembly-small-actions'); const makeDefault = button(a[defaultKey] === row[key] ? 'Default' : 'Make default', `default-${kind}`, row[key]); makeDefault.disabled = a[defaultKey] === row[key];
        const remove = button('Remove', `remove-${kind}`, row[key]); remove.disabled = rows.length <= 1; actions.append(makeDefault, remove); entry.append(actions); box.append(entry); }
      const add = button(`+ Add ${kind}`, `add-${kind}`); add.disabled = rows.length >= 16; box.append(add);
    } return box;
  }
  if (state.panel === 'blocking') {
    box.append(el('h3', '', 'Assembly blocking'));
    const modes = el('fieldset', 'assembly-blocking-modes'); modes.append(el('legend', '', 'Choose where blocking comes from'));
    for (const [value, title, explanation] of [
      ['components', 'Use component blocking', 'Reuse each active component’s saved shapes. They follow its position, rotation and scale.'],
      ['custom', 'Custom assembly blocking', 'Draw shapes for the whole Assembly. They stay fixed when components move.'],
    ]) {
      const option = el('label', 'assembly-blocking-mode'), input = el('input'), copy = el('span');
      input.type = 'radio'; input.name = `assembly-blocking-mode-${state.instanceId}`; input.value = value; input.checked = a.blocking.mode === value;
      input.dataset.assemblyField = 'blocking-mode'; input.dataset.assemblyFocusKey = `field:blocking-mode:${value}`;
      copy.append(el('strong', '', title), el('small', '', explanation)); option.append(input, copy); modes.append(option);
    }
    box.append(modes);
    if (a.blocking.mode === 'components') box.append(note('Only image components used in this state contribute. Animation clips have no movement-blocking shapes. Hiding artwork or its blocking overlay does not remove blocking.'));
    else {
      box.append(note('Custom shapes apply to every state and variant. Choosing this mode for the first time copies the component blocking.'));
      const edit = button('Edit custom blocking', 'custom-geometry'); edit.classList.add('assembly-custom-edit'); box.append(edit);
      box.append(note('Draw or adjust shapes in the geometry editor, then use Back to Assembly. Save the Assembly when your work is ready.'));
    }
    if (state.customDraft?.issues?.length || state.customDraft?.session?.polygonDraft?.length) box.append(el('p', 'assembly-warning', 'Custom blocking has unfinished work. Reopen it to finish; Save is blocked.'));
    const list = el('div', 'assembly-region-list'); for (const r of state.scene?.regions ?? []) { const entry = el('div'); entry.append(el('strong', '', r.name), note(r.componentId ? `${r.asset?.assetId} · v${r.asset?.assetVersion} / metadata v${r.asset?.metadataVersion}` : 'Owned by this Assembly')); list.append(entry); }
    box.append(list.childElementCount ? list : note('No blocking regions in this preview. Rendered pixels do not automatically block movement.')); return box;
  }
  box.append(el('h3', '', 'Components'), note('Front to back · each entry is an independent use.'));
  const list = el('div', 'assembly-component-list'); list.dataset.assemblyScroll = 'components';
  for (const c of a.components) { const row = el('div', 'assembly-component-row'); const b = button(c.name, 'component', c.componentId); b.setAttribute('aria-pressed', String(c.componentId === state.selectedComponentId));
    const content = assemblySelectedContent(c, state.preview); b.append(el('small', '', content.kind === 'none' ? 'No content in this state' : `${content.kind === 'animation' ? 'Animation · ' : ''}${content.asset.assetId} · v${content.asset.assetVersion}`)); const eye = button(state.hidden.includes(c.componentId) ? 'Show' : 'Hide', 'eye', c.componentId); eye.setAttribute('aria-label', `${state.hidden.includes(c.componentId) ? 'Show' : 'Hide'} ${c.name} for inspection only`); row.append(b, eye); list.append(row); }
  box.append(list); if (!a.components.length) box.append(note('Add a saved Asset to begin.'), button('+ Add component', 'add'));
  const c = selectedAssemblyComponent(state); if (!c) return box;
  box.append(el('h3', '', 'Selected component'), field('component.name', c.name, 'Component name'));
  const coordinates = el('div', 'assembly-coordinates'); coordinates.append(number('position.x', c.position.x, 'Anchor X (px)'), number('position.y', c.position.y, 'Anchor Y (px)'), number('rotationDegrees', c.rotationDegrees, 'Rotation (degrees)'), number('scale', c.scale, 'Uniform scale')); box.append(coordinates);
  const pin = assemblyEditorPreviewPin(c, state.preview.variantId, state.preview.stateId), latest = pin && nativeAssets.find(asset => asset.assetId === pin.assetId);
  box.append(el('h3', '', 'Exact presentation'), note(pin ? `${pin.assetId} · Asset v${pin.assetVersion} · metadata v${pin.metadataVersion}` : 'This component has no visual content in the selected state.'));
  if (latest && assemblyAssetKey(latest) !== assemblyAssetKey(pin)) box.append(el('p', 'assembly-warning', `Library now has v${latest.assetVersion}. This component keeps its saved v${pin.assetVersion}.`));
  const inspect = button('Inspect source', 'source', c.componentId); inspect.disabled = !pin;
  box.append(inspect, button('Choose base content…', 'replace-base'));
  box.append(el('h3', '', 'Content by state'), note('A state choice takes priority over this component’s variant and base content. Other components keep their own variants.'));
  for (const stateChoice of a.states) {
    const override = c.stateOverrides?.find(entry => entry.stateId === stateChoice.stateId), entry = el('div', 'assembly-variant-entry');
    const content = override?.content;
    entry.append(el('strong', '', stateChoice.name), note(!content ? 'Uses variant or base content' : content.kind === 'none' ? 'No visual content' : `${content.kind === 'animation' ? 'Animation' : 'Image'} · ${content.asset.assetId} · v${content.asset.assetVersion}`), button('Choose image or Animation…', 'state-content', stateChoice.stateId), button('No content', 'state-none', stateChoice.stateId));
    if (override) entry.append(button('Use variant / base', 'clear-state-content', stateChoice.stateId)); box.append(entry);
  }
  box.append(el('h3', '', 'State membership'), checkbox('all-states', c.stateIds === null, 'Use in every state'));
  for (const s of a.states) { const item = checkbox('state-membership', c.stateIds === null || c.stateIds.includes(s.stateId), s.name, s.stateId); item.querySelector('input').disabled = c.stateIds === null; box.append(item); }
  box.append(el('h3', '', 'Variant sources'));
  for (const v of a.variants) { const override = c.variantOverrides.find(item => item.variantId === v.variantId); const entry = el('div', 'assembly-variant-entry'); entry.append(el('strong', '', v.name), note(override ? (override.content?.kind === 'none' ? 'No content' : `${(override.content?.asset ?? override.asset).assetId} · v${(override.content?.asset ?? override.asset).assetVersion}`) : 'Uses the base content'));
    entry.append(button(override ? 'Replace choice…' : 'Choose Asset…', 'variant-asset', v.variantId)); if (override) entry.append(button('Use base', 'clear-variant', v.variantId)); box.append(entry); }
  return box;
}

function updateSelectors(root, state) {
  const panel = root.querySelector('[data-assembly-selectors]');
  const signature = JSON.stringify([state.model.assembly.states, state.model.assembly.variants]);
  if (panel.dataset.signature !== signature) {
    const a = state.model.assembly;
    panel.replaceChildren(choice('preview.variantId', state.preview.variantId, 'Variant preview', a.variants.map(v => [v.variantId, v.name])), choice('preview.stateId', state.preview.stateId, 'State preview', a.states.map(s => [s.stateId, s.name])), button(state.previewPlaying ? 'Pause animations' : 'Play animations', 'playback'), note('Playback and state selection are inspection only. The game controls behavior.'));
    panel.dataset.signature = signature;
  }
  const play = panel.querySelector('[data-assembly-action="playback"]'); if (play) { play.textContent = state.previewPlaying ? 'Pause animations' : 'Play animations'; play.hidden = !state.scene?.elements.some(item => item.contentKind === 'animation'); }
  for (const field of panel.querySelectorAll('select')) field.value = state.preview[field.dataset.assemblyField.split('.')[1]];
}
export function syncAssemblyEditorCanvas(root, state) {
  const canvas = root.querySelector('[data-assembly-canvas]'), viewport = root.querySelector('[data-assembly-scroll="canvas"]');
  state.frame ??= assemblySceneFrame(state.scene, state.model.assembly); const frame = state.frame;
  const fit = Math.max(.05, Math.min(Math.max(160, viewport.clientWidth - 30) / frame.width, Math.max(240, viewport.clientHeight - 30) / frame.height));
  const scale = state.gesture?.scale ?? (state.zoom === 'fit' ? fit : Number(state.zoom)); state.scale = scale;
  canvas.setAttribute('viewBox', `${frame.x} ${frame.y} ${frame.width} ${frame.height}`); canvas.setAttribute('width', String(frame.width * scale)); canvas.setAttribute('height', String(frame.height * scale));
  root.querySelector('[data-assembly-zoom-label]').textContent = `${state.zoom === 'fit' ? 'Fit · ' : ''}${Math.round(scale * 100)}%`;
  const slider = root.querySelector('[data-assembly-zoom]'); if (document.activeElement !== slider) slider.value = String(Math.round(scale * 100));
  updateAssemblyArtwork(canvas.querySelector('[data-assembly-artwork]'), state.scene, { projectId: state.context.projectId, hidden: state.hidden, selectedComponentId: state.selectedComponentId, interactive: true, playing: state.previewPlaying && state.view === 'edit' && !state.embeddedOpen });
  const layer = name => canvas.querySelector(`[data-assembly-layer="${name}"]`);
  layer('blocking').replaceChildren(...(state.showBlocking ? state.scene?.regions ?? [] : []).map(r => assemblyRegionNode(r, { class: 'assembly-blocking-region' })));
  root.querySelector('[data-assembly-option="show-blocking"]').checked = state.showBlocking;
  const a = state.model.assembly, anchor = svg('g', { class: 'assembly-anchor' }); anchor.append(svg('circle', { cx: a.anchor.x, cy: a.anchor.y, r: 5 / scale }), svg('path', { d: `M${a.anchor.x - 10 / scale} ${a.anchor.y}h${20 / scale}M${a.anchor.x} ${a.anchor.y - 10 / scale}v${20 / scale}` }));
  layer('placement').replaceChildren(svg('rect', { ...a.placementBounds, class: 'assembly-placement-bounds' }), anchor);
  const c = selectedAssemblyComponent(state); layer('selection').replaceChildren(...(c ? [svg('circle', { cx: c.position.x, cy: c.position.y, r: 4 / scale, class: 'assembly-component-anchor' })] : []));
  const lines = []; if (state.grid.show && Number.isFinite(state.grid.step) && state.grid.step > 0) { const step = Math.max(state.grid.step, Math.max(frame.width, frame.height) / 1500);
    for (let x = Math.ceil(frame.x / step) * step; x <= frame.x + frame.width; x += step) lines.push(`M${x} ${frame.y}v${frame.height}`);
    for (let y = Math.ceil(frame.y / step) * step; y <= frame.y + frame.height; y += step) lines.push(`M${frame.x} ${y}h${frame.width}`); }
  layer('grid').replaceChildren(svg('path', { d: lines.join(' '), class: 'assembly-grid-lines' }));
}
function renderPicker(root, state, assets) {
  const picker = root.querySelector('[data-assembly-picker]'); picker.hidden = !state.pickerOpen; if (!state.pickerOpen) return;
  const signature = JSON.stringify([state.pickerPurpose, state.pickerSearch, assets.map(a => [a.assetId, a.assetVersion, a.metadataVersion, a.name])]);
  if (picker.dataset.signature === signature) return; picker.dataset.signature = signature;
  const search = el('input'); search.type = 'search'; search.value = state.pickerSearch; search.placeholder = 'Search saved Assets'; search.dataset.assemblyPickerSearch = ''; search.dataset.assemblyFocusKey = 'picker-search'; search.setAttribute('aria-label', 'Search saved component Assets');
  const list = el('div', 'assembly-picker-list'); list.dataset.assemblyScroll = 'picker';
  for (const asset of assets.filter(a => `${a.name} ${a.assetId}`.toLowerCase().includes(state.pickerSearch.toLowerCase()))) {
    if (asset.contentKind !== 'animation' && (asset.sliceBinding?.mediaType !== 'image/png' || !/^[a-f0-9]{64}$/.test(asset.sliceBinding?.digest ?? '') || asset.assembly)) continue;
    const b = button('', 'pick-asset', assemblyAssetKey(asset));
    let picture;
    if (asset.contentKind === 'animation') { picture = el('span', 'assembly-note', `Animation · ${asset.clip.frames.length} frames`); }
    else { picture = el('img'); picture.src = assemblyArtifactUrl(state.context.projectId, asset.sliceBinding.digest); picture.alt = ''; picture.loading = 'lazy'; }
    const caption = el('span'); caption.append(el('strong', '', asset.name), el('small', '', `${asset.kind} · v${asset.assetVersion} / metadata v${asset.metadataVersion}`)); b.append(picture, caption); list.append(b);
  }
  picker.replaceChildren(el('h3', '', state.pickerPurpose === 'add' ? 'Add a component' : 'Choose an exact saved Asset'), button('Close', 'close-picker'), note('Each choice uses this saved version. The source Asset stays unchanged.'), search, list);
  if (!list.childElementCount) list.append(note('No matching saved images or Animations. Save one in the Library first.'));
}
function renderSource(root, state) {
  const view = root.querySelector('[data-assembly-view="source"]'), source = state.source; if (!source) return;
  const key = assemblyAssetKey(source.asset); if (view.dataset.sourceKey === key) return; view.dataset.sourceKey = key;
  const asset = source.asset;
  if (asset.contentKind === 'animation') {
    const details = el('div'); details.append(el('p', 'eyebrow', 'Animation source · read-only'), el('h3', '', asset.name), note(`Saved v${asset.assetVersion} · ${asset.clip.frames.length} frames · ${asset.clip.playbackMode} · ${asset.clip.fps} FPS`), note('These are the exact saved frames. Newer Animation versions do not replace this component automatically.'), button('Return to Assembly', 'return-source'));
    const frames = el('div', 'assembly-picker-list');
    for (const frame of asset.frameBindings ?? []) { const binding = frame.sliceBinding, figure = el('figure'), image = el('img'); image.src = assemblyArtifactUrl(state.context.projectId, binding.digest); image.alt = asset.clip.frames.find(value => value.frameId === frame.frameId)?.name ?? frame.frameId; image.style.maxWidth = '160px'; image.style.maxHeight = '140px'; image.style.objectFit = 'contain';
      const link = el('a'); link.href = image.src; link.target = '_blank'; link.rel = 'noopener'; link.append(image); figure.append(link, el('figcaption', '', `${image.alt} · ${binding.sliceId} v${binding.sliceVersion}`)); frames.append(figure); }
    view.replaceChildren(details, frames); return;
  }
  const binding = asset.sliceBinding, figure = el('figure'), image = el('img'); image.src = assemblyArtifactUrl(state.context.projectId, binding.digest); image.alt = asset.name;
  const link = el('a'); link.href = image.src; link.target = '_blank'; link.rel = 'noopener'; link.append(image); figure.append(link, el('figcaption', '', `${binding.width} × ${binding.height} px · exact saved component image`));
  const details = el('div'); details.append(el('p', 'eyebrow', 'Source inspection · read-only'), el('h3', '', asset.name), note('This is the exact source used by your component. Inspecting it changes neither the source nor your Assembly.'));
  const facts = el('dl', 'assembly-source-facts'); for (const [name, value] of [['Asset', asset.assetId], ['Version', `v${asset.assetVersion} / metadata v${asset.metadataVersion}`], ['Original source', binding.sourceId], ['Atlas', binding.atlasId], ['Saved cut', `${binding.sliceId} · v${binding.sliceVersion}`], ['Rectangle', binding.rectangleId], ['Image digest', binding.digest]]) facts.append(el('dt', '', name), el('dd', '', value ?? 'Unavailable'));
  details.append(facts, button('Return to Assembly', 'return-source')); view.replaceChildren(figure, details);
}
export function updateAssemblyEditorView(root, state, { inspector = true, nativeAssets = [], issues = null } = {}) {
  const locked = ['saving', 'uncertain', 'checking'].includes(state.save.status) || state.embeddedOpen;
  root.querySelector('[data-assembly-title]').textContent = state.model.name || 'New Assembly';
  for (const view of root.querySelectorAll('[data-assembly-view]')) view.hidden = view.dataset.assemblyView !== state.view;
  updateSelectors(root, state); const findings = issues ?? assemblyEditorIssues(state, { geometry: false }), status = root.querySelector('[data-assembly-status]');
  status.textContent = state.error || state.conflict || (state.save.status === 'saving' ? 'Saving this exact Assembly version…' : state.save.status === 'checking' ? 'Checking the saved outcome…' : state.resolution.status === 'loading' ? 'Resolving exact saved component versions…' : findings[0] || `${state.model.assembly.components.length} independent components. ${state.model.assembly.blocking.mode === 'components' ? 'Blocking follows active components.' : 'Custom blocking remains fixed.'}`);
  status.dataset.error = String(Boolean(state.error || state.conflict || findings.length));
  if (inspector) { const node = root.querySelector('.assembly-inspector'); const scroll = node.scrollTop; node.replaceChildren(inspectorContent(state, nativeAssets)); node.scrollTop = scroll; }
  root.querySelector('[data-assembly-grid-popup]').hidden = !state.gridOpen; renderPicker(root, state, nativeAssets); if (state.view === 'source') renderSource(root, state);
  for (const control of root.querySelectorAll('button,input,select')) control.disabled = locked;
  const selected = selectedAssemblyComponent(state), index = state.model.assembly.components.indexOf(selected);
  for (const b of root.querySelectorAll('[data-assembly-action]')) { const action = b.dataset.assemblyAction;
    if (['rotate', 'forward', 'backward', 'remove', 'replace-base', 'variant-asset', 'state-content', 'state-none'].includes(action)) b.disabled ||= !selected;
    if (action === 'source') b.disabled ||= !selected || !assemblyEditorPreviewPin(selected, state.preview.variantId, state.preview.stateId);
    if (action === 'forward') b.disabled ||= index <= 0; if (action === 'backward') b.disabled ||= index === state.model.assembly.components.length - 1;
    if (action === 'undo') b.disabled ||= !state.history.past.length; if (action === 'redo') b.disabled ||= !state.history.future.length;
    if (action === 'save') b.disabled ||= Boolean(state.gesture || state.conflict || findings.length || state.resolution.status === 'loading');
    if (action === 'add') b.disabled ||= state.model.assembly.components.length >= 32;
    if (action.startsWith('remove-state')) b.disabled ||= state.model.assembly.states.length <= 1;
    if (action.startsWith('remove-variant')) b.disabled ||= state.model.assembly.variants.length <= 1;
    if (action === 'add-state') b.disabled ||= state.model.assembly.states.length >= 16;
    if (action === 'add-variant') b.disabled ||= state.model.assembly.variants.length >= 16;
    if (action === 'default-state') b.disabled ||= state.model.assembly.defaultStateId === b.dataset.value;
    if (action === 'default-variant') b.disabled ||= state.model.assembly.defaultVariantId === b.dataset.value;
  }
  for (const checkbox of root.querySelectorAll('[data-assembly-option="state-membership"]')) checkbox.disabled ||= selected?.stateIds === null;
  for (const input of root.querySelectorAll('[data-assembly-field]')) { const key = `${input.dataset.assemblyField}:${input.dataset.row ?? ''}`; if (state.fieldDrafts[key] !== undefined) input.value = state.fieldDrafts[key]; }
  const recovery = root.querySelector('[data-assembly-recovery]'); recovery.replaceChildren();
  if (state.save.status === 'uncertain') recovery.append(button('Check saved outcome', 'check-outcome'), button('Retry exact Save', 'retry'));
  else if (state.conflict) recovery.append(button('Recheck saved version', 'recheck'));
  root.querySelector('[data-assembly-saved-state]').textContent = assemblyEditorDirty(state) ? 'Unsaved Assembly work' : state.context.assetVersion ? `Saved Assembly v${state.context.assetVersion} · metadata v${state.context.metadataVersion}` : 'New Assembly · not saved yet';
  syncAssemblyEditorCanvas(root, state);
}
